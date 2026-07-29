/**
 * SFX SYSTEM
 * ----------
 * Per-unit, per-action sound effects: assets/sfx/<race>_<unitId>_<action>_<n>.wav
 * (see js/data/sfx-actions.js for the naming convention and the full set of
 * combinations that should exist).
 *
 * Deliberately UNLIKE music.js: there is no fallback chain. Music always
 * wants *something* mood-appropriate playing, so it falls back through
 * situation -> race default -> silence. Sfx exists specifically to make an
 * Orc Raider's attack sound different from a Human Wizard's -- substituting
 * a generic/other-unit's sound would defeat that, so a missing combo simply
 * plays nothing. "Fail gracefully" here means exactly that: never throw,
 * never spam the console per call, just silently no-op.
 *
 * Availability is scanned once at startup (same probeFile approach as
 * music.js, including its fetch-then-Audio-element fallback for file://
 * contexts) so playAction() is a synchronous, instant lookup rather than a
 * per-call network probe.
 */

window.SfxSystem = (function () {
  let availability = null; // Map<"race_unitId_action_n", boolean> -- built once at startup
  let failedClips = new Set(); // clips that errored during playback; never retried this session
  let lastVariantPlayed = {}; // per "race_unitId_action" key, last variant index used (no-immediate-repeat)

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

  function clipPath(raceId, unitId, action, n) {
    return `assets/sfx/${window.GameData.sfxFileName(raceId, unitId, action, n)}`;
  }

  // Same rationale as music.js's PROBE_CONCURRENCY: probing every combo/
  // variant at once (170+ combos x up to 5 variants = 850+ requests) trips
  // the browser's per-origin connection cap, which falsely reports real
  // on-disk files as missing purely from contention.
  const PROBE_CONCURRENCY = 4;

  async function mapWithConcurrencyLimit(items, limit, worker) {
    const results = new Array(items.length);
    let nextIndex = 0;
    async function runNext() {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
      await runNext();
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
    return results;
  }

  /** Identical strategy to music.js's probeFile -- see that file's doc
   *  comment for why: a plain GET + immediate body cancel is used first
   *  (an HTTP status is a direct answer to "does this exist", and
   *  cache: "no-store" guards against a stale cached 404 from before the
   *  file existed), falling back to an <audio>-element load probe for
   *  file:// contexts where fetch() is blocked by Same Origin Policy. */
  async function probeFile(path) {
    try {
      const res = await fetch(path, { method: "GET", cache: "no-store" });
      if (res.body && res.body.cancel) {
        try { await res.body.cancel(); } catch (e) { /* already consumed/closed -- fine */ }
      }
      return res.ok;
    } catch (e) {
      return probeFileViaAudio(path);
    }
  }

  function probeFileViaAudio(path) {
    return new Promise((resolve) => {
      const audio = new Audio();
      const onError = () => { cleanup(); resolve(false); };
      const onCanPlay = () => { cleanup(); resolve(true); };
      function cleanup() {
        audio.removeEventListener("error", onError);
        audio.removeEventListener("loadedmetadata", onCanPlay);
      }
      audio.addEventListener("error", onError);
      audio.addEventListener("loadedmetadata", onCanPlay);
      audio.src = path;
      setTimeout(() => { cleanup(); resolve(false); }, 3000);
    });
  }

  /** Scans which clip files actually exist. Called once at startup. Never
   *  throws -- an entirely-missing sfx library (e.g. a fresh checkout before
   *  any files are curated) just means every playAction() call is a no-op. */
  async function scanAvailability() {
    availability = new Map();
    const tasks = [];
    for (const combo of window.GameData.sfxAllCombos()) {
      for (let n = 1; n <= window.GameData.SFX_MAX_VARIANTS; n++) {
        tasks.push({
          key: `${combo.raceId}_${combo.unitId}_${combo.action}_${n}`,
          path: clipPath(combo.raceId, combo.unitId, combo.action, n),
        });
      }
    }
    let found = 0;
    await mapWithConcurrencyLimit(tasks, PROBE_CONCURRENCY, async ({ key, path }) => {
      const exists = await probeFile(path);
      availability.set(key, exists);
      if (exists) found++;
    });
    console.log(`[sfx] availability scan complete: ${found} clips found, ${tasks.length - found} missing`);
  }

  function availableVariants(raceId, unitId, action) {
    if (!availability) return [];
    const variants = [];
    for (let n = 1; n <= window.GameData.SFX_MAX_VARIANTS; n++) {
      const key = `${raceId}_${unitId}_${action}_${n}`;
      if (availability.get(key) && !failedClips.has(key)) variants.push(n);
    }
    return variants;
  }

  /** Public: does at least one clip exist for this combo? Lets callers (e.g.
   *  combat resolution) decide whether to bother at all, though playAction()
   *  is already safe to call unconditionally either way. */
  function hasClip(raceId, unitId, action) {
    return availableVariants(raceId, unitId, action).length > 0;
  }

  /** Public: play one clip for (raceId, unitId, action), picking a random
   *  variant with no-immediate-repeat (same pattern as music.js's
   *  pickVariant) for variety across repeated actions. No-ops silently if
   *  nothing is available for this exact combo -- see file doc comment for
   *  why there's no fallback to a different unit/race's sound.
   *
   *  x/y (optional, tile coordinates): if given AND a visibility check is
   *  registered (see setVisibilityCheck), the whole call is skipped when
   *  that tile is off-screen -- e.g. ai.js's attack call sites pass the
   *  attacking unit's position so a battle happening elsewhere on the map
   *  doesn't play. Omit x/y for actions that are inherently already
   *  on-screen (e.g. input.js's click-to-select "move" sfx) to skip the
   *  gate entirely. */
  function playAction(raceId, unitId, action, x, y) {
    if (visibilityCheck && x !== undefined && y !== undefined && !visibilityCheck(x, y)) return;

    const variants = availableVariants(raceId, unitId, action);
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
    const audio = new Audio(clipPath(raceId, unitId, action, choice));

    // variable playback speed to add variety to the oft-repeated sfx
    const randSpeed = 0.8 + Math.random() * (1.7 - 0.8);
    audio.playbackRate = randSpeed;

    audio.volume = effectiveVolume();
    audio.addEventListener("error", () => {
      console.log(`[sfx] failed to play ${key}.wav -- will not retry this session`);
      failedClips.add(key);
    });
    audio.play().catch((e) => {
      console.log(`[sfx] play() rejected for ${key}.wav: ${e.message}`);
      failedClips.add(key);
    });
  }

  function setMasterVolume(v) { masterVolume = Math.max(0, Math.min(1, v)); }
  function setSfxVolume(v) { sfxVolume = Math.max(0, Math.min(1, v)); }
  function setMuted(v) { muted = !!v; }
  function isMuted() { return muted; }

  /** Public: register the (x, y) -> boolean predicate playAction() uses to
   *  skip off-screen sounds (see playAction's doc comment). Pass null to
   *  clear it (no gating -- every call plays regardless of position). */
  function setVisibilityCheck(fn) { visibilityCheck = fn || null; }

  async function init() {
    await scanAvailability();
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
