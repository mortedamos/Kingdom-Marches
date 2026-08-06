/**
 * MUSIC SYSTEM
 * ------------
 * Full implementation of the music addendum's spec:
 *  - File convention: <race>_<situation>_<#>.mp3 in assets/music/
 *  - Situations: default, combat, discovery -- priority combat > discovery > default
 *  - Up to 3 variants per race/situation, no-repeat cycling
 *  - Missing files never crash -- logged to console, gracefully skipped
 *  - A track that fails to play is never retried this session
 *  - Crossfade on situation change; fixed short pause between loops
 *  - File existence scanned once at game start
 *  - Master + music volume, both persisted (best-effort; falls back to
 *    in-memory only if persistence is unavailable -- this is a browser
 *    artifact context, not a guarantee of localStorage availability)
 *
 * This module is entirely self-contained -- nothing outside audio/music.js
 * needs to know HOW music works, only that MusicSystem.notifySituation(...)
 * and MusicSystem.setRace(...) exist.
 */

window.MusicSystem = (function () {
  // "victory" (2026-07-22, user-directed): <race>_victory_#.mp3, scanned and
  // resolved exactly like every other per-race situation below -- no special
  // casing needed there, only in resolveCurrent's priority order (see
  // notifyVictory/victoryRace).
  const SITUATIONS = ["default", "combat", "discovery", "neutral", "victory"];
  const MAX_VARIANTS = 3;
  const LOOP_PAUSE_MS = 1500; // fixed ~1-2s pause between same-situation loops
  const FADE_MS = 2500; // "a few seconds" crossfade, each direction
  const FADE_STEP_MS = 50;

  let availability = null; // Map<"race_situation_n", boolean> -- built once at startup
  let failedTracks = new Set(); // tracks that errored during playback; never retried
  let currentAudio = null;
  let currentKey = null;
  let lastVariantPlayed = {}; // per race_situation key, the last variant index used
  let activeSituation = "default";
  let currentRace = null;
  let loopTimer = null;
  let fadeIntervalId = null;

  let masterVolume = 1.0;
  // Default lowered from 1.0 to 0.75 (2026-08-06, user-directed): music was
  // drowning out sfx. Only the DEFAULT for a first-ever session -- a
  // persisted user setting (loadPersistedVolumes below) still overrides it,
  // same as any other volume preference already saved.
  let musicVolume = 0.75;
  let muted = false;
  let trackChangeListeners = []; // notified with getCurrentTrackLabel()'s result whenever currentKey changes
  // Manual track override: when set, playback is pinned to this exact track
  // (looping it directly, ignoring the automatic race/situation resolution)
  // until cleared back to null ("Auto"). See setManualTrack/resolveCurrent.
  let manualTrackKey = null;
  // Set once a civ wins (2026-07-22, user-directed) -- see notifyVictory.
  // Reset back to null by setRace (2026-08-06, user-directed fix -- see its
  // own comment) whenever a fresh game actually starts, so returning to the
  // title screen and starting a new game doesn't keep the PREVIOUS game's
  // victory theme playing forever. Still overridable by a manual track pin,
  // same precedence as everything else -- see resolveCurrent.
  let victoryRace = null;
  // Set once the human player loses (2026-08-06, user-directed) -- see
  // notifyGameOver. Same one-way-until-a-fresh-game shape and reset point
  // (setRace) as victoryRace above; takes priority over it in resolveCurrent
  // since a loss is this session's own outcome, not just informational.
  let gameOverActive = false;

  function loadPersistedVolumes() {
    try {
      const stored = JSON.parse(localStorage.getItem("roi_audio_settings") || "{}");
      if (typeof stored.masterVolume === "number") masterVolume = stored.masterVolume;
      if (typeof stored.musicVolume === "number") musicVolume = stored.musicVolume;
      if (typeof stored.muted === "boolean") muted = stored.muted;
    } catch (e) {
      // localStorage unavailable (e.g. sandboxed artifact context) -- fall
      // back to in-memory defaults silently, per the "never crash" rule.
      console.log("[music] persistence unavailable, using in-memory volume defaults");
    }
  }

  function persistVolumes() {
    try {
      localStorage.setItem("roi_audio_settings", JSON.stringify({ masterVolume, musicVolume, muted }));
    } catch (e) {
      // Non-fatal -- see loadPersistedVolumes note above.
    }
  }

  /** Actual playback volume right now -- 0 whenever muted, regardless of the
   *  underlying master/music volume levels (which are preserved, not reset,
   *  so un-muting restores exactly where the sliders were left). */
  function effectiveVolume() {
    return muted ? 0 : masterVolume * musicVolume;
  }

  function trackPath(race, situation, variant) {
    return `assets/music/${race}_${situation}_${variant}.mp3`;
  }

  /** "race_situation_n" / "neutral_n" / "game_over" -> a human-readable
   *  label. Shared by getAvailableTracks (track-picker dropdown) and
   *  getCurrentTrackLabel (now-playing display) so the two never drift out
   *  of sync. */
  function keyToLabel(key) {
    if (!key) return null;
    if (key === "game_over") return "Game Over";
    const parts = key.split("_");
    return parts[0] === "neutral"
      ? `Neutral ${parts[1]}`
      : `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)} — ${parts[1]} ${parts[2]}`;
  }

  /** Sets currentKey and notifies now-playing listeners -- the single place
   *  currentKey ever changes (playResolved's normal path, and
   *  crossfadeOutCurrent's silence path), so every trigger (situation
   *  change, race change, manual pin, natural loop, error fallback) reaches
   *  the UI through this one spot. */
  function setCurrentKey(key) {
    currentKey = key;
    const label = keyToLabel(currentKey);
    for (const cb of trackChangeListeners) cb(label);
  }

  // Browsers cap simultaneous connections per origin (Chrome: 6) -- probing
  // every race/situation/variant combo (90+ files) via one big Promise.all
  // fires them all at once, so most just sit queued behind that cap until
  // probeFile's own 3s safety timeout falsely resolves them "missing" (found
  // 2026-07-22: real, on-disk files were reporting missing purely from this
  // contention, not from actually failing to load -- see PROBE_CONCURRENCY).
  const PROBE_CONCURRENCY = 4;

  /** Runs `worker` over every item in `items`, at most `limit` in flight at
   *  once, preserving each result's position in the returned array. Generic
   *  concurrency-limited alternative to Promise.all for a batch large enough
   *  to trip a per-origin connection cap (see PROBE_CONCURRENCY above). */
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

  // Bumped every scanAvailability() call, so a still-in-flight probe from a
  // SUPERSEDED scan (e.g. init() somehow re-triggered mid-session) can tell
  // its own results are stale and skip writing them into the current
  // `availability` map -- without this, a late-arriving write from an old
  // scan could land in the map a newer scan already replaced, since the
  // probe closures below capture the OUTER `availability` binding, not a
  // snapshot of it. Belt-and-suspenders: nothing in this codebase currently
  // re-triggers MusicSystem.init() after the first page-load call, but nothing
  // guarantees that stays true either.
  let scanGeneration = 0;

  /** Scans which files actually exist. Called once at startup. Never throws.
   *  racesInPlay (array of race ids -- normal games pass [humanRace,
   *  ...opponents], spectator games pass the checked spectator races) scopes
   *  the scan to just those races -- most of a match's 6-race library can
   *  never be heard this game (see sprites.js's preloadAll, which got the
   *  same racesInPlay scoping for the same reason).
   *
   *  Further split into a CRITICAL tier ("default" situation for every
   *  racesInPlay race, plus the race-less "neutral" tracks) that the
   *  returned promise waits on, and a BACKGROUND tier (combat/discovery/
   *  victory -- situations that can't possibly be needed until whatever
   *  triggers them actually happens in-game) that keeps scanning afterward
   *  without making the loading screen wait on it. "default" is what's
   *  ACTUALLY playing the instant a game starts (see main.js's startGame --
   *  no notifySituation call happens before then, so resolveCurrent always
   *  lands on "default"), and "neutral" is what spectator mode's pool needs
   *  even before any race-specific situation is relevant (see
   *  resolveSpectatorTrack). onProgress(done, total) is called only for the
   *  critical tier, matching sprites.js/sfx.js's own critical/background
   *  split. */
  async function scanAvailability(racesInPlay, onProgress) {
    const myGeneration = ++scanGeneration;
    availability = new Map();
    const criticalTasks = [];
    const backgroundTasks = [];
    for (const race of racesInPlay) {
      for (const situation of SITUATIONS) {
        if (situation === "neutral") continue; // neutral has no race, checked separately below
        const bucket = situation === "default" ? criticalTasks : backgroundTasks;
        for (let v = 1; v <= MAX_VARIANTS; v++) {
          bucket.push({ key: `${race}_${situation}_${v}`, path: trackPath(race, situation, v) });
        }
      }
    }
    // Spectator-mode neutral track(s) -- no race prefix
    for (let v = 1; v <= MAX_VARIANTS; v++) {
      criticalTasks.push({ key: `neutral_${v}`, path: `assets/music/neutral_${v}.mp3` });
    }
    // Game over (2026-08-06, user-directed) -- single fixed file, no race
    // prefix, same "no race" shape as neutral above.
    criticalTasks.push({ key: "game_over", path: "assets/music/game_over.mp3" });
    async function runTask({ key, path }) {
      const exists = await probeFile(path);
      if (myGeneration !== scanGeneration) return; // superseded -- see scanGeneration's doc comment
      availability.set(key, exists);
      if (!exists) console.log(`[music] missing: ${key}.mp3 - skipping`);
    }
    let done = 0;
    await mapWithConcurrencyLimit(criticalTasks, PROBE_CONCURRENCY, async (task) => {
      await runTask(task);
      done++;
      if (onProgress) onProgress(done, criticalTasks.length);
    });
    mapWithConcurrencyLimit(backgroundTasks, PROBE_CONCURRENCY, runTask); // fire-and-forget
  }

  /** Existence check via a plain GET + immediate body cancel (2026-07-22,
   *  rewritten from an Audio-element "wait for loadedmetadata" probe, which
   *  turned out unreliable against this project's dev static server: real,
   *  on-disk files were intermittently reported missing because the server
   *  doesn't support HEAD, and separately because loadedmetadata's timing
   *  depends on codec/media-pipeline quirks this doesn't need to care about
   *  at all -- an HTTP status code is a far more direct answer to "does this
   *  file exist"). Cancelling the body right after the status arrives avoids
   *  downloading the full mp3 just to probe it. `cache: "no-store"` guards
   *  against a real failure mode: a browser that cached a 404 for this path
   *  from BEFORE the file existed (e.g. probed once with an empty
   *  assets/music/ folder, then a track was dropped in later) would
   *  otherwise keep reporting it missing on a normal reload until a hard
   *  refresh -- this makes every scan a true, current disk check.
   *
   *  The game is served over HTTP (2026-08-03, user-directed), so fetch()
   *  always works here; the old Audio-element fallback that existed purely
   *  for a file:// origin was removed. A thrown fetch() now means a genuine
   *  network failure, which reads the same as "not available". */
  async function probeFile(path) {
    try {
      const res = await fetch(path, { method: "GET", cache: "no-store" });
      if (res.body && res.body.cancel) {
        try { await res.body.cancel(); } catch (e) { /* already consumed/closed -- fine */ }
      }
      return res.ok;
    } catch (e) {
      return false;
    }
  }

  function availableVariants(race, situation) {
    if (!availability) return [];
    const variants = [];
    for (let v = 1; v <= MAX_VARIANTS; v++) {
      const key = `${race}_${situation}_${v}`;
      if (availability.get(key) && !failedTracks.has(key)) variants.push(v);
    }
    return variants;
  }

  /** Sequential round-robin (2026-08-05, user-directed): cycles through
   *  EVERY available variant in order (1, 2, 3, back to 1...) before any
   *  one repeats. Replaces the old random-no-immediate-repeat picker, which
   *  only guaranteed the SAME variant never played twice in a row -- e.g.
   *  1,3,1,3,1,3... was a perfectly valid random sequence under the old
   *  rule that never once touched variant 2, which is exactly the
   *  user-reported symptom ("only one track plays, the others never get
   *  played"). `lastVariantPlayed` is keyed per race+situation and persists
   *  across situation changes (module-level, not reset), so returning to
   *  "default" after a combat/discovery interruption resumes the rotation
   *  where it left off rather than restarting at variant 1. */
  function pickVariant(race, situation) {
    const pairKey = `${race}_${situation}`;
    const variants = availableVariants(race, situation);
    if (variants.length === 0) return null;
    if (variants.length === 1) return variants[0];
    const last = lastVariantPlayed[pairKey];
    const lastIdx = last == null ? -1 : variants.indexOf(last);
    const choice = variants[(lastIdx + 1) % variants.length];
    lastVariantPlayed[pairKey] = choice;
    return choice;
  }

  /** Resolves the actual track to play for the current race+situation, with
   *  the documented fallback chain: situation -> race default -> silence. */
  function resolveTrack(race, situation) {
    let variant = pickVariant(race, situation);
    let actualSituation = situation;
    if (variant === null && situation !== "default") {
      console.log(`[music] no available variant for ${race}_${situation}, falling back to default`);
      variant = pickVariant(race, "default");
      actualSituation = "default";
    }
    if (variant === null) {
      console.log(`[music] no available track for ${race} at all -- playing silence`);
      return null;
    }
    return { path: trackPath(race, actualSituation, variant), key: `${race}_${actualSituation}_${variant}` };
  }

  /**
   * Spectator mode (no human civ selected): rather than restrict to the
   * neutral_N.mp3 tracks, pool EVERY available track -- any race, any
   * situation, plus the neutral ones -- and pick uniformly at random, with
   * a no-immediate-repeat rule (same pattern as pickVariant's per-pair
   * no-repeat, just keyed on a single shared "spectator pool" slot instead
   * of per race/situation).
   */
  function resolveSpectatorTrack() {
    if (!availability) return null;
    const pool = [];
    for (const [key, exists] of availability.entries()) {
      if (exists && !failedTracks.has(key)) pool.push(key);
    }
    if (pool.length === 0) return null;
    const lastKey = lastVariantPlayed.__spectator__;
    const candidates = pool.length > 1 ? pool.filter((k) => k !== lastKey) : pool;
    const chosenKey = candidates[Math.floor(Math.random() * candidates.length)];
    lastVariantPlayed.__spectator__ = chosenKey;
    // key is "race_situation_variant" or "neutral_variant"
    const parts = chosenKey.split("_");
    const path = parts[0] === "neutral"
      ? `assets/music/neutral_${parts[1]}.mp3`
      : trackPath(parts[0], parts[1], parts[2]);
    return { path, key: chosenKey };
  }

  /** Resolves the manually-pinned track (see setManualTrack), or null if it's
   *  gone missing/failed since being picked (falls back to automatic mode). */
  function resolveManualTrack(key) {
    if (!availability || !availability.get(key) || failedTracks.has(key)) return null;
    const parts = key.split("_");
    const path = parts[0] === "neutral"
      ? `assets/music/neutral_${parts[1]}.mp3`
      : trackPath(parts[0], parts[1], parts[2]);
    return { path, key };
  }

  /** Single source of truth for "what should be playing right now" -- a
   *  manual pin takes priority over the automatic race/situation resolution,
   *  which itself falls back to the spectator pool with no race selected.
   *  Shared by refreshNowPlaying and playResolved's loop/error-fallback
   *  handlers so manual mode is respected everywhere, not just on first pick. */
  function resolveCurrent() {
    if (manualTrackKey) {
      const manual = resolveManualTrack(manualTrackKey);
      if (manual) return manual;
      console.log(`[music] manually-selected track ${manualTrackKey}.mp3 unavailable -- reverting to Auto`);
      manualTrackKey = null;
    }
    // Game over (2026-08-06, user-directed): the human player's own loss
    // outranks even a victory theme (shouldn't ever coincide in practice --
    // the human losing and some OTHER civ winning both resolve the same
    // round -- but if it ever does, this is the human's own outcome and
    // wins the tiebreak). Single fixed file, no race, so it bypasses
    // resolveTrack's race-keyed fallback chain entirely.
    if (gameOverActive) return { path: "assets/music/game_over.mp3", key: "game_over" };
    // Victory (2026-07-22, user-directed): once a civ has won, its theme
    // takes priority over the ordinary race/situation resolution below --
    // reuses resolveTrack's existing fallback chain (victory -> that race's
    // own default -> silence), so a race with no dedicated victory track yet
    // (every race but Elf, currently) just keeps playing its normal theme
    // instead of going silent at the exact moment the game ends.
    if (victoryRace) return resolveTrack(victoryRace, "victory");
    return currentRace ? resolveTrack(currentRace, activeSituation) : resolveSpectatorTrack();
  }

  function playResolved(resolved) {
    clearTimeout(loopTimer);
    if (!resolved) {
      crossfadeOutCurrent();
      return;
    }
    const newAudio = new Audio(resolved.path);
    newAudio.volume = 0;
    newAudio.addEventListener("error", () => {
      console.log(`[music] failed to play ${resolved.key}.mp3 -- will not retry this session`);
      failedTracks.add(resolved.key);
      // Try again with the fallback chain, once.
      const fallback = resolveCurrent();
      if (fallback && fallback.key !== resolved.key) playResolved(fallback);
    });
    newAudio.addEventListener("ended", () => {
      loopTimer = setTimeout(() => playResolved(resolveCurrent()), LOOP_PAUSE_MS);
    });

    const oldAudio = currentAudio;
    currentAudio = newAudio;
    setCurrentKey(resolved.key);
    newAudio.play().catch((e) => {
      console.log(`[music] play() rejected for ${resolved.key}.mp3: ${e.message}`);
      failedTracks.add(resolved.key);
    });
    crossfade(oldAudio, newAudio);
  }

  function crossfade(oldAudio, newAudio) {
    clearInterval(fadeIntervalId);
    const steps = FADE_MS / FADE_STEP_MS;
    let step = 0;
    const targetVol = effectiveVolume();
    fadeIntervalId = setInterval(() => {
      step++;
      const t = Math.min(1, step / steps);
      if (oldAudio) oldAudio.volume = Math.max(0, targetVol * (1 - t));
      if (newAudio) newAudio.volume = Math.min(targetVol, targetVol * t);
      if (t >= 1) {
        clearInterval(fadeIntervalId);
        if (oldAudio) oldAudio.pause();
      }
    }, FADE_STEP_MS);
  }

  function crossfadeOutCurrent() {
    clearInterval(fadeIntervalId);
    const oldAudio = currentAudio;
    currentAudio = null;
    setCurrentKey(null);
    if (!oldAudio) return;
    const steps = FADE_MS / FADE_STEP_MS;
    let step = 0;
    const startVol = oldAudio.volume;
    fadeIntervalId = setInterval(() => {
      step++;
      const t = Math.min(1, step / steps);
      oldAudio.volume = Math.max(0, startVol * (1 - t));
      if (t >= 1) { clearInterval(fadeIntervalId); oldAudio.pause(); }
    }, FADE_STEP_MS);
  }

  /** Public: set which race's music to follow (null = spectator/no human race).
   *  Called once at the start of every game (fresh or loaded) -- also the
   *  reset point for victoryRace/gameOverActive (2026-08-06, user-directed
   *  fix), so a new game started after a previous one ended doesn't keep
   *  playing that OLD game's victory/game-over music. */
  function setRace(raceId) {
    currentRace = raceId;
    victoryRace = null;
    gameOverActive = false;
    refreshNowPlaying();
  }

  /**
   * Public: notify the system a situation has started/ended.
   * situation: "combat" | "discovery" | null (null = situation ended, return to default)
   * Priority: combat > discovery > default, per the music addendum §2.
   */
  let combatActive = false;
  let discoveryActive = false;

  function notifySituation(situation, isActive) {
    if (situation === "combat") combatActive = isActive;
    if (situation === "discovery") discoveryActive = isActive;
    const resolved = combatActive ? "combat" : discoveryActive ? "discovery" : "default";
    if (resolved !== activeSituation) {
      activeSituation = resolved;
      refreshNowPlaying();
    }
  }

  /** Public: a civ has won -- switch to that race's victory theme (see
   *  resolveCurrent's priority order). `raceId` is the winning civ's race
   *  (e.g. "elf"), not its civId -- callers should pass
   *  gameState.civs[victoryResult.winner].raceId. Permanent for the rest of
   *  the session (see victoryRace's own doc comment above); calling it again
   *  is harmless (refreshNowPlaying no-ops if nothing actually changed). */
  function notifyVictory(raceId) {
    victoryRace = raceId;
    refreshNowPlaying();
  }

  /** Public: the human player has lost -- switch to the fixed game_over.mp3
   *  track (see resolveCurrent's priority order, which puts this ABOVE even
   *  a victory theme). No race involved -- a single shared file, not one
   *  per race. Permanent for the rest of the session (same shape as
   *  notifyVictory/victoryRace -- see setRace for the reset point). */
  function notifyGameOver() {
    gameOverActive = true;
    refreshNowPlaying();
  }

  /** Discovery tracks play to their natural end unless combat interrupts (confirmed in addendum §7) */
  function notifyDiscoveryTrackEndedNaturally() {
    if (!combatActive) {
      discoveryActive = false;
      activeSituation = "default";
      refreshNowPlaying();
    }
  }

  function refreshNowPlaying() {
    const resolved = resolveCurrent();
    // Already playing this exact track (e.g. setRace/notifySituation fired
    // while a manual pin is active) -- skip restarting/crossfading into itself.
    if (resolved && resolved.key === currentKey) return;
    playResolved(resolved);
  }

  function setMusicVolume(v) {
    musicVolume = Math.max(0, Math.min(1, v));
    if (currentAudio) currentAudio.volume = effectiveVolume();
    persistVolumes();
  }

  /** Public: mute/unmute without touching the underlying volume levels --
   *  un-muting restores exactly whatever the sliders were left at.
   *
   *  `persist` defaults to true (a user ticking the Audio menu's Mute box
   *  expects it to stick across reloads). Pass false for a mute the player
   *  didn't ask for and shouldn't inherit later -- specifically main.js's
   *  ?mute test switch, which would otherwise write muted:true into
   *  localStorage and leave every subsequent NORMAL session silent with no
   *  visible cause. */
  function setMuted(v, { persist = true } = {}) {
    muted = !!v;
    if (currentAudio) currentAudio.volume = effectiveVolume();
    if (persist) persistVolumes();
  }
  function isMuted() { return muted; }

  /**
   * Public: pin playback to one specific track (by its "race_situation_n" or
   * "neutral_n" key, as returned by getAvailableTracks), looping it directly
   * and ignoring the automatic race/situation resolution until cleared.
   * Pass null/falsy to clear the pin and return to automatic ("Auto") mode.
   */
  function setManualTrack(key) {
    manualTrackKey = key || null;
    refreshNowPlaying();
  }
  function getManualTrack() { return manualTrackKey; }

  /** Public: human-readable label for whatever's actually playing right now
   *  (null if nothing is -- e.g. no matching track exists at all). */
  function getCurrentTrackLabel() { return keyToLabel(currentKey); }

  /** Public: subscribe to now-playing changes -- callback receives the same
   *  label getCurrentTrackLabel() would return, fired every time currentKey
   *  actually changes (situation change, race change, manual pin, natural
   *  loop, error fallback). No unsubscribe -- callers are expected to
   *  register once for the lifetime of the page, same as the rest of this
   *  module's setup. */
  function onTrackChange(cb) { trackChangeListeners.push(cb); }

  /** Public: every track that actually exists (per the startup scan), for a
   *  track-picker UI. Returns [{ key, label }], sorted for a stable, sane
   *  dropdown order (neutral tracks first, then race/situation/variant). */
  function getAvailableTracks() {
    if (!availability) return [];
    const tracks = [];
    for (const [key, exists] of availability.entries()) {
      if (!exists) continue;
      tracks.push({ key, label: keyToLabel(key) });
    }
    tracks.sort((a, b) => a.key.localeCompare(b.key));
    return tracks;
  }

  async function init(racesInPlay, onProgress) {
    loadPersistedVolumes();
    await scanAvailability(racesInPlay, onProgress);
    // Only the critical tier (see scanAvailability's doc comment) has
    // settled by this point -- background situations (combat/discovery/
    // victory) are still being scanned, so these counts will keep rising
    // afterward as those settle too.
    console.log("[music] critical availability scan complete:",
      [...availability.entries()].filter(([, v]) => v).length, "tracks found so far,",
      [...availability.entries()].filter(([, v]) => !v).length, "missing so far (expected -- this is a prototype with no real mp3 files)");
  }

  return {
    init,
    setRace,
    notifySituation,
    notifyVictory,
    notifyGameOver,
    notifyDiscoveryTrackEndedNaturally,
    setMusicVolume,
    getMusicVolume: () => musicVolume,
    setMuted,
    isMuted,
    setManualTrack,
    getManualTrack,
    getAvailableTracks,
    getCurrentTrackLabel,
    onTrackChange,
  };
})();
