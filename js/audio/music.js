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
  const RACES = ["human", "elf", "dwarf", "orc", "undead", "halfellow"];
  const SITUATIONS = ["default", "combat", "discovery", "neutral"];
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
  let musicVolume = 1.0;
  let muted = false;
  let trackChangeListeners = []; // notified with getCurrentTrackLabel()'s result whenever currentKey changes
  // Manual track override: when set, playback is pinned to this exact track
  // (looping it directly, ignoring the automatic race/situation resolution)
  // until cleared back to null ("Auto"). See setManualTrack/resolveCurrent.
  let manualTrackKey = null;

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

  /** "race_situation_n" / "neutral_n" -> a human-readable label. Shared by
   *  getAvailableTracks (track-picker dropdown) and getCurrentTrackLabel
   *  (now-playing display) so the two never drift out of sync. */
  function keyToLabel(key) {
    if (!key) return null;
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

  /** Scans which files actually exist. Called once at startup. Never throws. */
  async function scanAvailability() {
    availability = new Map();
    const checks = [];
    for (const race of RACES) {
      for (const situation of SITUATIONS) {
        if (situation === "neutral") continue; // neutral has no race, checked separately below
        for (let v = 1; v <= MAX_VARIANTS; v++) {
          const key = `${race}_${situation}_${v}`;
          checks.push(
            probeFile(trackPath(race, situation, v)).then((exists) => {
              availability.set(key, exists);
              if (!exists) console.log(`[music] missing: ${key}.mp3 - skipping`);
            })
          );
        }
      }
    }
    // Spectator-mode neutral track(s) -- no race prefix
    for (let v = 1; v <= MAX_VARIANTS; v++) {
      const key = `neutral_${v}`;
      checks.push(
        probeFile(`assets/music/neutral_${v}.mp3`).then((exists) => {
          availability.set(key, exists);
          if (!exists) console.log(`[music] missing: ${key}.mp3 - skipping`);
        })
      );
    }
    await Promise.all(checks);
  }

  function probeFile(path) {
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
      // Safety timeout in case neither event fires for some reason --
      // never let a probe hang forever and block startup.
      setTimeout(() => { cleanup(); resolve(false); }, 3000);
    });
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

  function pickVariant(race, situation) {
    const pairKey = `${race}_${situation}`;
    const variants = availableVariants(race, situation);
    if (variants.length === 0) return null;
    if (variants.length === 1) return variants[0];
    const last = lastVariantPlayed[pairKey];
    const pool = variants.filter((v) => v !== last);
    const choice = pool[Math.floor(Math.random() * pool.length)];
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

  /** Public: set which race's music to follow (null = spectator/no human race) */
  function setRace(raceId) {
    currentRace = raceId;
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

  function setMasterVolume(v) {
    masterVolume = Math.max(0, Math.min(1, v));
    if (currentAudio) currentAudio.volume = effectiveVolume();
    persistVolumes();
  }
  function setMusicVolume(v) {
    musicVolume = Math.max(0, Math.min(1, v));
    if (currentAudio) currentAudio.volume = effectiveVolume();
    persistVolumes();
  }

  /** Public: mute/unmute without touching the underlying volume levels --
   *  un-muting restores exactly whatever the sliders were left at. */
  function setMuted(v) {
    muted = !!v;
    if (currentAudio) currentAudio.volume = effectiveVolume();
    persistVolumes();
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

  async function init() {
    loadPersistedVolumes();
    await scanAvailability();
    console.log("[music] availability scan complete:",
      [...availability.entries()].filter(([, v]) => v).length, "tracks found,",
      [...availability.entries()].filter(([, v]) => !v).length, "missing (expected -- this is a prototype with no real mp3 files)");
  }

  return {
    init,
    setRace,
    notifySituation,
    notifyDiscoveryTrackEndedNaturally,
    setMasterVolume,
    setMusicVolume,
    getMasterVolume: () => masterVolume,
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
