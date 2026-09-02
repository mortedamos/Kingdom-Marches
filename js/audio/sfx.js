/**
 * SFX SYSTEM
 * ----------
 * Per-unit, per-action sound effects: assets/sfx/<race>_<unitId>_<action>_<n>.mp3
 * (see js/data/sfx-actions.js for the naming convention and the full set of
 * combinations that should exist). Also a small set of race/unit-independent
 * SYSTEM sfx (button clicks, confirm-action prompts, research-complete
 * stings -- see playButtonClick/playConfirmAction/playResearchComplete near
 * the bottom) that reuse this same preload/voice machinery directly rather
 * than going through the manifest-driven model.
 *
 * Deliberately UNLIKE music.js: there is no fallback chain. Music always
 * wants *something* mood-appropriate playing, so it falls back through
 * situation -> race default -> silence. Sfx exists specifically to make an
 * Orc Raider's attack sound different from a Human Wizard's -- substituting
 * a generic/other-unit's sound would defeat that, so a missing combo simply
 * plays nothing.
 *
 * WHICH CLIPS EXIST: read from js/data/sfx-manifest.js, a generated list of
 * the real contents of assets/sfx/ (regenerate with
 * working/tools/build-sfx-manifest.ps1 after adding clips) rather than
 * discovered by probing every plausible filename and watching which ones
 * 404 -- that avoids the browser-level "failed to load resource" console
 * noise a probe-and-learn scheme produces, and guarantees a variant pick
 * never lands on a nonexistent file.
 *
 * PRELOADING: init() fetches and decodes every clip belonging to the races in
 * play, up front, behind the loading screen (the "Sound Effects" progress bar
 * in index.html reports this). Playback then clones an already-decoded
 * element, so it starts on the same frame it's asked for. Clips whose race is
 * not in play are never fetched at all; if one is somehow requested anyway it
 * loads on demand and is cached from then on, so nothing is ever unplayable,
 * just late once.
 */

window.SfxSystem = (function () {
  // Every sfx file is mp3 -- there is no wav support, since none are planned.
  const SFX_EXTENSION = "mp3";

  // How many simultaneous voices one clip may occupy. Beyond this, the oldest
  // is rewound and reused rather than allocating without bound -- a 16x-speed
  // spectator battle can otherwise ask for the same attack clip dozens of
  // times a second.
  const MAX_VOICES_PER_CLIP = 4;

  // "race_unitId_action" -> { raceId, variants: [numbers that actually exist] },
  // derived from the manifest once at load. Never mutated at runtime. raceId
  // is stored rather than re-derived from the key: an action can contain an
  // underscore, so keys are only ever built from known parts, never split.
  let clipIndex = new Map();
  // "race_unitId_action_n" -> preloaded <audio> template (the element that
  // holds the decoded data; playback uses cloneNode of this).
  let loaded = new Map();
  // "race_unitId_action_n" -> live clones currently in the voice pool.
  let voices = new Map();
  // per "race_unitId_action" key, last variant index used (no-immediate-repeat)
  let lastVariantPlayed = {};

  let masterVolume = 1.0;
  let sfxVolume = 1.0;
  let muted = false;
  // Window/tab focus suspension -- mirrors music.js's own flag exactly (see
  // its comment for why this is separate from `muted` rather than driving
  // it). Every entry point below returns early while it's set, so an
  // off-screen tab doesn't even allocate voices, let alone play them.
  let focusSuspended = false;
  // Optional (x, y) -> boolean predicate, registered by main.js once a game
  // is running (see setVisibilityCheck) -- lets playAction() skip sounds for
  // units currently off-screen. null = no gating, e.g. before a game starts,
  // or in a headless sim context that never registers one -- see
  // js/ui/render.js's isTileOnScreen for the actual on-screen test this wraps.
  let visibilityCheck = null;

  function effectiveVolume() {
    return muted ? 0 : masterVolume * sfxVolume;
  }

  // Volume persistence, mirroring music.js's own (separate key, so the two
  // sliders are independent). `muted` is deliberately NOT stored here: mute
  // is a single cross-system toggle owned by music.js's settings (see
  // main.js's setupAudioControls, which drives both systems from one
  // checkbox).
  const SFX_SETTINGS_KEY = "roi_sfx_settings";
  function loadPersistedVolume() {
    try {
      const stored = JSON.parse(localStorage.getItem(SFX_SETTINGS_KEY) || "{}");
      if (typeof stored.sfxVolume === "number") sfxVolume = stored.sfxVolume;
    } catch (e) {
      // localStorage unavailable -- fall back to the in-memory default
      // silently, same "never throw" rule as the rest of this module.
    }
  }
  function persistVolume() {
    try {
      localStorage.setItem(SFX_SETTINGS_KEY, JSON.stringify({ sfxVolume }));
    } catch (e) { /* non-fatal */ }
  }
  loadPersistedVolume();

  function clipPath(key) {
    return `assets/sfx/${key}.${SFX_EXTENSION}`;
  }

  /**
   * Parses the generated manifest into the clip index. Filenames are matched
   * against the CONSTRUCTED name for each known (race, unit, action, variant)
   * combination rather than parsed apart -- an action can contain its own
   * underscore ("build_road", "summon_raptor"), so splitting a filename on
   * "_" is ambiguous, while building the expected name from known parts never
   * is (the same reasoning as sfx-actions.js's own sfxFileName doc comment).
   *
   * A file in assets/sfx/ that doesn't correspond to any real combination is
   * simply ignored -- nothing would ever ask for it.
   */
  function buildIndex() {
    clipIndex = new Map();
    const present = new Set(window.GameData.SFX_FILES || []);
    for (const { raceId, unitId, action } of window.GameData.sfxAllCombos()) {
      const pairKey = `${raceId}_${unitId}_${action}`;
      const variants = [];
      for (let n = 1; n <= window.GameData.SFX_MAX_VARIANTS; n++) {
        if (present.has(window.GameData.sfxFileName(raceId, unitId, action, n, SFX_EXTENSION))) {
          variants.push(n);
        }
      }
      // unitId retained alongside raceId (2026-09-02) so clipKeysForRaces can
      // sort clips into critical/background by unit without re-parsing
      // pairKey -- unsafe in general, since an action can itself contain an
      // underscore (see this function's own doc comment above).
      if (variants.length) clipIndex.set(pairKey, { raceId, unitId, variants });
    }
  }

  /** Every variant that really exists for this combo (empty array if none). */
  function candidateVariants(raceId, unitId, action) {
    const entry = clipIndex.get(`${raceId}_${unitId}_${action}`);
    return entry ? entry.variants : [];
  }

  /** Public: does this combo have any clip at all? playAction() is safe to
   *  call unconditionally either way. */
  function hasClip(raceId, unitId, action) {
    return candidateVariants(raceId, unitId, action).length > 0;
  }

  /**
   * Fetches and decodes one clip, resolving once it's actually playable.
   * Never rejects: a clip that fails to load resolves anyway and is simply
   * left out of `loaded`, so a bad file costs one silent sound rather than
   * hanging the loading screen behind it.
   */
  function preloadClip(key) {
    if (loaded.has(key)) return Promise.resolve();
    return new Promise((resolve) => {
      const audio = new Audio();
      audio.preload = "auto";
      // A template is only ever cloned, never played -- keep it silent so a
      // stray play() on one (a bug, or a future caller) can't blast a clip at
      // full volume regardless of the mute setting. Clones get their real
      // volume set in playAction.
      audio.volume = 0;
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      audio.addEventListener("canplaythrough", () => { loaded.set(key, audio); done(); }, { once: true });
      audio.addEventListener("error", done, { once: true });
      // A clip that never fires either event (a stalled connection, a codec
      // the browser accepts but can't buffer) must not hold the loading
      // screen open on its own.
      setTimeout(done, 15000);
      audio.src = clipPath(key);
      audio.load();
    });
  }

  /** Every clip key belonging to one of `racesInPlay`, split into a
   *  CRITICAL tier (Pioneer, Scout, and that race's own starting combat
   *  unit -- the exact "guaranteed on screen from turn 1" set sprites.js's
   *  preloadAll uses for its own critical/background split, see races.js's
   *  raceStartingUnitId) and a BACKGROUND tier (every other unit). Clips for
   *  races that aren't in this game are skipped entirely either way --
   *  there are ~190 files total and a 5-race game only ever needs its own
   *  slice of them.
   *
   *  2026-09-02, user-directed: sfx never split critical from background
   *  before -- init() awaited this whole list in one flat batch, so a 4-5
   *  race game's ENTIRE sound library gated the loading screen equally,
   *  whether it was Pioneer's move sound needed the instant the game
   *  screen appears or a Dragon's death roar needed only many turns in. */
  function clipKeysForRaces(racesInPlay) {
    const wanted = racesInPlay && racesInPlay.length ? new Set(racesInPlay) : null;
    const criticalUnitIds = new Set(["pioneer", "scout"]);
    if (wanted) {
      for (const raceId of wanted) {
        const startingUnitId = window.GameData.raceStartingUnitId(raceId);
        if (startingUnitId) criticalUnitIds.add(startingUnitId);
      }
    }
    const critical = [], background = [];
    for (const [pairKey, { raceId, unitId, variants }] of clipIndex) {
      if (wanted && !wanted.has(raceId)) continue;
      const bucket = criticalUnitIds.has(unitId) ? critical : background;
      for (const n of variants) bucket.push(`${pairKey}_${n}`);
    }
    return { critical, background };
  }

  /** One playable voice for `key`, reusing a finished clone when possible so
   *  repeated plays don't allocate an element each time. */
  function acquireVoice(key) {
    const template = loaded.get(key);
    let pool = voices.get(key);
    if (!pool) { pool = []; voices.set(key, pool); }

    const free = pool.find((a) => a.ended || a.paused);
    if (free) { free.currentTime = 0; return free; }
    if (pool.length >= MAX_VOICES_PER_CLIP) {
      // Steal the oldest rather than growing without bound.
      const oldest = pool.shift();
      pool.push(oldest);
      oldest.currentTime = 0;
      return oldest;
    }
    // cloneNode on a loaded element reuses its already-decoded media; a bare
    // new Audio(src) here would be a fresh (cache-warm but still async) load.
    const voice = template ? template.cloneNode() : new Audio(clipPath(key));
    pool.push(voice);
    return voice;
  }

  /** Public: play one clip for (raceId, unitId, action), picking a random
   *  variant with no-immediate-repeat (same pattern as music.js's
   *  pickVariant) for variety across repeated actions. No-ops silently if
   *  this combo has no clips at all -- see file doc comment for why there's
   *  no fallback to a different unit/race's sound.
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
   *  instead of overlapping it. */
  function playAction(raceId, unitId, action, x, y, delayMs) {
    if (delayMs) { setTimeout(() => playAction(raceId, unitId, action, x, y), delayMs); return; }
    // Re-checked AFTER the delay resolves, not before it -- the point is
    // whether the window has focus when the clip would actually sound.
    if (focusSuspended) return;
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
    const voice = acquireVoice(key);
    // variable playback speed to add variety to the oft-repeated sfx
    voice.playbackRate = 0.8 + Math.random() * (1.7 - 0.8);
    voice.volume = effectiveVolume();
    // Only ever rejects on an autoplay-policy block (no user gesture yet) --
    // not a missing-file signal, and nothing useful to do about it here.
    const played = voice.play();
    if (played && played.catch) played.catch(() => {});

    // A clip that wasn't in the preload set (a race that joined via a loaded
    // save, say) is now warm for next time.
    if (!loaded.has(key)) loaded.set(key, voice);
  }

  // SYSTEM SFX: UI sounds -- a button click, a tech-researched sting -- that
  // aren't tied to any race/unit/action combo the manifest-driven model
  // above covers. Deliberately NOT folded into that model (there's no
  // "system" race and no unit to key off), but reuses its low-level plumbing
  // directly: preloadClip/acquireVoice/clipPath are already generic on an
  // arbitrary string key, so "system_button_click" and
  // "system_research_complete_1/2/3" work as literal keys with zero new
  // machinery. Preloaded alongside everything else in init() below so
  // they're warm the first time they're needed.
  const SYSTEM_BUTTON_CLICK_KEY = "system_button_click";
  const SYSTEM_CONFIRM_ACTION_KEY = "system_confirm_action";
  const SYSTEM_TREASURE_CHEST_OPEN_KEY = "system_treasure_chest_open_1";
  const SYSTEM_RESEARCH_COMPLETE_VARIANTS = 3;
  let lastResearchCompleteVariant = null;

  function systemKeys() {
    const keys = [SYSTEM_BUTTON_CLICK_KEY, SYSTEM_CONFIRM_ACTION_KEY, SYSTEM_TREASURE_CHEST_OPEN_KEY];
    for (let n = 1; n <= SYSTEM_RESEARCH_COMPLETE_VARIANTS; n++) keys.push(`system_research_complete_${n}`);
    return keys;
  }

  /** Plays a single already-preloaded (or lazily-loaded) system clip by its
   *  literal key -- shared tail end for both public functions below. */
  function playSystemKey(key) {
    if (focusSuspended) return;
    const voice = acquireVoice(key);
    voice.playbackRate = 1;
    voice.volume = effectiveVolume();
    const played = voice.play();
    if (played && played.catch) played.catch(() => {});
    if (!loaded.has(key)) loaded.set(key, voice);
  }

  /** Public: every player button click (see main.js's global click listener). */
  function playButtonClick() {
    playSystemKey(SYSTEM_BUTTON_CLICK_KEY);
  }

  /** Public: the player is being presented with a confirm-an-action prompt
   *  (Disband Unit, Found City, End Turn with unresolved work, an Automate
   *  Actions proposal, ... -- see main.js's redraw(), which fires this once
   *  per freshly-opened confirm-style dialog). */
  function playConfirmAction() {
    playSystemKey(SYSTEM_CONFIRM_ACTION_KEY);
  }

  /** Public: a tech finished researching (see main.js's tech-researched
   *  modal). No-immediate-repeat across the 3 variants, same convention
   *  playAction/music.js's pickVariant both use for variety. */
  function playResearchComplete() {
    const variants = [1, 2, 3];
    const pool = variants.filter((v) => v !== lastResearchCompleteVariant);
    const choice = pool[Math.floor(Math.random() * pool.length)];
    lastResearchCompleteVariant = choice;
    playSystemKey(`system_research_complete_${choice}`);
  }

  /** Public: a Treasure Chest or Ruin Delve treasure find modal is about to
   *  show -- see main.js's "openChest" case and the Ruin Delve treasure-find
   *  dialog. */
  function playTreasureChestOpen() {
    playSystemKey(SYSTEM_TREASURE_CHEST_OPEN_KEY);
  }

  function setMasterVolume(v) { masterVolume = Math.max(0, Math.min(1, v)); }
  /** Public: the Audio menu's Sound Effects slider. Only affects clips
   *  started AFTER this call -- an in-flight clip is a few hundred ms long,
   *  so re-walking the live voice pool to retune it isn't worth the code. */
  function setSfxVolume(v) {
    sfxVolume = Math.max(0, Math.min(1, v));
    persistVolume();
  }
  function setMuted(v) { muted = !!v; }
  function isMuted() { return muted; }
  /** Public: suppress sfx entirely while the window/tab isn't focused --
   *  see music.js's setFocusSuspended and main.js's setupFocusMuting. No
   *  in-flight clip to stop: sfx are a few hundred ms long, so by the time
   *  a tab switch registers they are already over. */
  function setFocusSuspended(v) { focusSuspended = !!v; }
  function isFocusSuspended() { return focusSuspended; }

  /** Public: register the (x, y) -> boolean predicate playAction() uses to
   *  skip off-screen sounds (see playAction's doc comment). Pass null to
   *  clear it (no gating -- every call plays regardless of position). */
  function setVisibilityCheck(fn) { visibilityCheck = fn || null; }

  /**
   * Public: build the clip index and preload the CRITICAL tier of clips for
   * `racesInPlay`, reporting (done, total) to onProgress as it goes, then
   * keeps loading the BACKGROUND tier afterward without making the caller
   * wait on it (same split as sprites.js's preloadAll/runTiered -- see
   * clipKeysForRaces' own doc comment for exactly what falls in each tier).
   * Awaited by main.js's loading gate alongside sprites and music, which
   * only ever waits on the critical half now.
   *
   * Loads in small batches rather than all at once: ~40 clips fired
   * simultaneously contend with the sprite and music preloads for the
   * browser's per-host connection limit, and starving those makes the whole
   * loading screen slower even though this bar finishes sooner.
   */
  async function init(racesInPlay, onProgress) {
    buildIndex();
    loaded = new Map();
    voices = new Map();
    lastVariantPlayed = {};
    lastResearchCompleteVariant = null;

    // System sfx (button click, research-complete stings) are race-
    // independent -- always queued here regardless of which races are in
    // play, unlike clipKeysForRaces' per-race slice below. Always critical:
    // both can fire the instant the title screen's own buttons are clicked,
    // well before a game (or its races) even exists.
    const { critical, background } = clipKeysForRaces(racesInPlay);
    const criticalKeys = [...systemKeys(), ...critical];
    const total = criticalKeys.length;
    const BATCH = 6;

    if (total) {
      let done = 0;
      for (let i = 0; i < criticalKeys.length; i += BATCH) {
        await Promise.all(criticalKeys.slice(i, i + BATCH).map((k) => preloadClip(k).then(() => {
          done++;
          if (onProgress) onProgress(done, total);
        })));
      }
    } else if (onProgress) {
      onProgress(1, 1);
    }

    // Background tier: fire-and-forget, same as sprites.js's runTiered --
    // keeps loading after the loading screen has already moved on.
    (async () => {
      for (let i = 0; i < background.length; i += BATCH) {
        await Promise.all(background.slice(i, i + BATCH).map((k) => preloadClip(k)));
      }
    })();
  }

  return {
    init,
    hasClip,
    playAction,
    playButtonClick,
    playConfirmAction,
    playResearchComplete,
    playTreasureChestOpen,
    setMasterVolume,
    setSfxVolume,
    setMuted,
    isMuted,
    setFocusSuspended,
    isFocusSuspended,
    setVisibilityCheck,
    getMasterVolume: () => masterVolume,
    getSfxVolume: () => sfxVolume,
  };
})();
