/**
 * SFX SYSTEM
 * ----------
 * Per-unit, per-action sound effects: assets/sfx/<race>_<unitId>_<action>_<n>.{mp3,wav}
 * (see js/data/sfx-actions.js for the naming convention and the full set of
 * combinations that should exist). mp3 is tried first (smaller files), then
 * wav, so files can be converted from wav to mp3 gradually without any
 * coordinated switchover.
 *
 * Deliberately UNLIKE music.js: there is no fallback chain. Music always
 * wants *something* mood-appropriate playing, so it falls back through
 * situation -> race default -> silence. Sfx exists specifically to make an
 * Orc Raider's attack sound different from a Human Wizard's -- substituting
 * a generic/other-unit's sound would defeat that, so a missing combo simply
 * plays nothing. "Fail gracefully" here means exactly that: never throw,
 * and never repeat a failed lookup.
 *
 * No upfront availability scan. Whether a clip exists is discovered lazily,
 * on the first actual playAction() call that wants it, by just trying to
 * play it -- there used to be a startup scan that probed every possible
 * (race, unit, action, variant, extension) combination over the network up
 * front (170+ combos x 5 variants x 2 extensions), which flooded devtools
 * with a "failed to load resource" line per miss (a browser-level network
 * log, not something a JS try/catch can suppress) before a single turn had
 * even been played. Trying lazily means a missing clip is only ever
 * requested (at most) once per session, the moment something actually wants
 * it, and every outcome -- found, wrong extension, genuinely missing -- is
 * cached so that exact clip is never requested again this session.
 */

window.SfxSystem = (function () {
  // Checked in this order -- mp3 first (smaller files, faster load).
  const SFX_EXTENSIONS = ["mp3", "wav"];

  // "race_unitId_action_n" -> extension it actually plays with, once a play
  // attempt has succeeded. Lets repeat plays of the same clip skip straight
  // to the right file instead of re-trying mp3 first every time.
  let resolvedExt = new Map();
  // "race_unitId_action_n" combos confirmed missing under every extension --
  // permanently excluded from future variant choices this session.
  let failedClips = new Set();
  // per "race_unitId_action" key, last variant index used (no-immediate-repeat)
  let lastVariantPlayed = {};

  let masterVolume = 1.0;
  let sfxVolume = 1.0;
  let muted = false;
  // Optional (x, y) -> boolean predicate, registered by main.js once a game
  // is running (see setVisibilityCheck) -- lets playAction() skip sounds for
  // units currently off-screen (2026-07-24, user-directed). null = no
  // gating, e.g. before a game starts, or in a headless sim context that
  // never registers one -- see js/ui/render.js's isTileOnScreen for the
  // actual on-screen test this wraps.
  let visibilityCheck = null;

  function effectiveVolume() {
    return muted ? 0 : masterVolume * sfxVolume;
  }

  function clipPath(raceId, unitId, action, n, ext) {
    return `assets/sfx/${window.GameData.sfxFileName(raceId, unitId, action, n, ext)}`;
  }

  /** Every variant slot (1..SFX_MAX_VARIANTS) not yet confirmed missing for
   *  this combo -- optimistic, since without an upfront scan we don't know
   *  which slots are real until something actually tries them. Narrows down
   *  to just the real ones over the course of a session as misses land in
   *  failedClips. */
  function candidateVariants(raceId, unitId, action) {
    const variants = [];
    for (let n = 1; n <= window.GameData.SFX_MAX_VARIANTS; n++) {
      const key = `${raceId}_${unitId}_${action}_${n}`;
      if (!failedClips.has(key)) variants.push(n);
    }
    return variants;
  }

  /** Public: is this combo still worth trying? Lets callers (e.g. combat
   *  resolution) decide whether to bother at all, though playAction() is
   *  already safe to call unconditionally either way. Optimistic (see
   *  candidateVariants) until a real attempt proves otherwise. */
  function hasClip(raceId, unitId, action) {
    return candidateVariants(raceId, unitId, action).length > 0;
  }

  /** Actually attempts playback of one specific (raceId, unitId, action, n)
   *  clip, trying each extension in turn. Called at most once per clip per
   *  extension per session -- a miss on every extension permanently marks
   *  the clip failed (see failedClips) so playAction() never picks that
   *  variant again. Never throws: both the load-error path and the
   *  play()-rejection path (autoplay-policy blocks, an already-known-good
   *  clip briefly unavailable, etc.) are caught and simply drop the sound. */
  function tryPlay(raceId, unitId, action, n, key, extIndex) {
    if (extIndex >= SFX_EXTENSIONS.length) {
      failedClips.add(key);
      return;
    }
    const ext = SFX_EXTENSIONS[extIndex];
    const audio = new Audio(clipPath(raceId, unitId, action, n, ext));

    // variable playback speed to add variety to the oft-repeated sfx
    audio.playbackRate = 0.8 + Math.random() * (1.7 - 0.8);
    audio.volume = effectiveVolume();

    audio.addEventListener("error", () => tryPlay(raceId, unitId, action, n, key, extIndex + 1));
    audio.play().then(
      () => { resolvedExt.set(key, ext); },
      () => { /* autoplay-policy rejection etc. -- not a missing-file signal, don't burn the other extension */ }
    );
  }

  /** Public: play one clip for (raceId, unitId, action), picking a random
   *  variant with no-immediate-repeat (same pattern as music.js's
   *  pickVariant) for variety across repeated actions. No-ops silently if
   *  nothing is left to try for this exact combo -- see file doc comment for
   *  why there's no fallback to a different unit/race's sound.
   *
   *  x/y (optional, tile coordinates): if given AND a visibility check is
   *  registered (see setVisibilityCheck), the whole call is skipped when
   *  that tile is off-screen -- e.g. ai.js's attack call sites pass the
   *  attacking unit's position so a battle happening elsewhere on the map
   *  doesn't play. Omit x/y for actions that are inherently already
   *  on-screen (e.g. input.js's click-to-select "move" sfx) to skip the
   *  gate entirely.
   *
   *  delayMs (optional): defers the whole call (variant pick, visibility
   *  check, and playback) by this many ms -- e.g. ai.js's death sfx, which
   *  wants to land a beat after the killing blow's own "attack" clip
   *  instead of overlapping it (2026-07-30, user-directed). */
  function playAction(raceId, unitId, action, x, y, delayMs) {
    if (delayMs) { setTimeout(() => playAction(raceId, unitId, action, x, y), delayMs); return; }
    if (visibilityCheck && x !== undefined && y !== undefined && !visibilityCheck(x, y)) return;

    const variants = candidateVariants(raceId, unitId, action);
    if (variants.length === 0) return;

    const pairKey = `${raceId}_${unitId}_${action}`;
    let choice;
    if (variants.length === 1) {
      choice = variants[0];
    } else {
      const last = lastVariantPlayed[pairKey];
      const pool = variants.filter((v) => v !== last);
      choice = pool[Math.floor(Math.random() * pool.length)];
    }
    lastVariantPlayed[pairKey] = choice;

    const key = `${pairKey}_${choice}`;
    const knownExt = resolvedExt.get(key);
    tryPlay(raceId, unitId, action, choice, key, knownExt ? SFX_EXTENSIONS.indexOf(knownExt) : 0);
  }

  function setMasterVolume(v) { masterVolume = Math.max(0, Math.min(1, v)); }
  function setSfxVolume(v) { sfxVolume = Math.max(0, Math.min(1, v)); }
  function setMuted(v) { muted = !!v; }
  function isMuted() { return muted; }

  /** Public: register the (x, y) -> boolean predicate playAction() uses to
   *  skip off-screen sounds (see playAction's doc comment). Pass null to
   *  clear it (no gating -- every call plays regardless of position). */
  function setVisibilityCheck(fn) { visibilityCheck = fn || null; }

  /** Public: reset per-session learned state for a fresh game. Resolves
   *  immediately -- kept async/awaitable (and keeps the racesInPlay/
   *  onProgress params, unused now) purely so main.js's existing
   *  Promise.all([...]).then(finishStartGame) loading gate needs no change. */
  async function init(racesInPlay, onProgress) {
    resolvedExt = new Map();
    failedClips = new Set();
    lastVariantPlayed = {};
    if (onProgress) onProgress(1, 1);
  }

  return {
    init,
    hasClip,
    playAction,
    setMasterVolume,
    setSfxVolume,
    setMuted,
    isMuted,
    setVisibilityCheck,
    getMasterVolume: () => masterVolume,
    getSfxVolume: () => sfxVolume,
  };
})();
