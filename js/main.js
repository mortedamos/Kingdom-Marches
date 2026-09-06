/**
 * MAIN
 * ----
 * Bootstraps the game: setup screen (race/civ selection, spectator mode),
 * initial world+civ creation, and the main render/turn loop. This file
 * intentionally contains minimal logic of its own -- it wires together
 * the data/, engine/, audio/, and ui/ modules.
 */

(function () {
  let gameState = null;
  let viewState = null;
  // Knowledge Base state is module-level rather than part of viewState --
  // the Knowledge menu has to work from the title screen too, before
  // viewState (or gameState) exists. "units" | "structures" | "terrain" |
  // "conditions" | "stats" | "actions" | "techtrees" | null;
  // knowledgeSelectedUnitId/knowledgeSelectedStructureId/
  // knowledgeSelectedTerrainKey/knowledgeSelectedConditionKey/
  // knowledgeSelectedStatKey/knowledgeSelectedRaceId each only matter for
  // their own page. See setupKnowledgeBase/renderKnowledgeOverlay.
  let knowledgeView = null;
  let knowledgeSelectedUnitId = null;
  let knowledgeSelectedStructureId = null;
  let knowledgeSelectedConditionKey = null;
  let knowledgeSelectedStatKey = null;
  let knowledgeSelectedActionKey = null;
  // Terrain page (2026-08-31, user-directed): which catalog entry is open.
  // One key space across all three of its groups (terrain ids, resource
  // ids, and the feature keys ruin/cave/river/road/bridge) -- see
  // knowledgebase.js's terrainCatalog, which the page resolves through.
  let knowledgeSelectedTerrainKey = null;
  // Tech Trees page (2026-08-26, user-directed): which race's tree is
  // showing. Reference-only, gameplay-free -- see buildReferenceCiv --
  // unlike the sidebar's "View Tech Tree" (a specific LIVE civ's actual
  // progress) or the spectator Report menu's "AI Tech Trees" (every civ
  // CURRENTLY IN a running game); this browses any of the 5 playable
  // races' full trees from a stock, freshly-started state, works before a
  // game even exists, and is never interactive (always isPlayerCiv: false
  // in the techtree.js render call, same as the spectator report).
  let knowledgeSelectedRaceId = null;
  // Set when a unit profile's condition or stat cross-link is clicked --
  // remembers which unit to return to so the Conditions/Stats page's "Back"
  // button can jump straight back to it. null whenever that page was opened
  // directly from the menu instead.
  let knowledgeBackTarget = null;
  let humanCivId = null;
  let spectatorMode = false;
  let spectatorSpeed = 1; // 1x/2x/4x/8x/16x -- see the speed-btn row in index.html
  let spectatorPaused = false;
  let autoplayTimer = null;
  // Game Difficulty (2026-08-31, user-directed -- replaces the old AI
  // Aggression slider). THE session-level source of truth: the string form
  // is what the save file carries and what the per-civ difficultyByCiv fan-out
  // (advanceOneStep below) delivers to ai.js's applyDifficultyNoise, while
  // config.js's difficulty.levelIndex carries the same choice for everything
  // else. applyDifficulty keeps the two in lockstep -- never set either alone.
  let aiDifficulty = "normal";
  let loadingStatusTimer = null; // see showLoadingScreen/hideLoadingScreen

  // Game Speed slider controls how many turns units/buildings/research take
  // (GameConfig.pacing.speedLevelIndex -- see config.js's own doc comment
  // for the researchTurnsByLayer/buildTurnsByLayer table system this
  // indexes into). `percent` is kept as the wire format for save games and
  // multiplayer payloads (gameSpeedPercent, already the established field
  // name there) even though the UI itself now only ever produces one of
  // GAME_SPEED_LEVELS' 5 exact values -- an OLDER save/payload could still
  // carry an in-between percent from before this slider had named levels,
  // so this maps to the CLOSEST level rather than requiring an exact match.
  let gameSpeedPercent = 100;
  function applyGameSpeed(percent) {
    gameSpeedPercent = percent;
    let bestIndex = 2, bestDist = Infinity;
    GAME_SPEED_LEVELS.forEach((level, i) => {
      const dist = Math.abs(level.percent - percent);
      if (dist < bestDist) { bestDist = dist; bestIndex = i; }
    });
    window.GameConfig.pacing.speedLevelIndex = bestIndex;
  }

  // Game Difficulty slider (2026-08-31, user-directed). Sets BOTH halves of
  // the setting at once -- config.js's live level index (build/research
  // speed, military cap, head start, culture gate) and the legacy
  // `aiDifficulty` string (the save-file field, and what
  // applyDifficultyNoise consumes). config.js's level ids are exactly the
  // strings ai.js's DIFFICULTY_SPREAD is keyed by, so no mapping table
  // exists to drift.
  //
  // Universal -- applies in Spectator mode too, where every civ is AI.
  const DIFFICULTY_DEFAULT_INDEX = 1; // Normal
  function applyDifficulty(levelIndex) {
    const levels = window.GameConfig.difficulty.levels;
    const level = levels[levelIndex] ?? levels[DIFFICULTY_DEFAULT_INDEX];
    window.GameConfig.difficulty.levelIndex = levels.indexOf(level);
    aiDifficulty = level.id;
  }
  /** Save files persist the difficulty STRING, not the index (the string
   *  predates this slider -- see aiDifficulty above), so loading re-derives
   *  the index from it. An unknown/missing id falls back to Normal. */
  function difficultyIndexFromId(id) {
    const i = window.GameConfig.difficulty.levels.findIndex((l) => l.id === id);
    return i >= 0 ? i : DIFFICULTY_DEFAULT_INDEX;
  }

  // Identity of whatever's currently rendered into the tech tree/reports/
  // dialog modals -- redraw() only rebuilds a modal's innerHTML when its
  // identity actually changes, not on every single call (redraw fires on
  // every autoplay tick, up to ~25ms apart at 16x speed; rebuilding a
  // button's DOM node that often meant a click landing between two ticks
  // could hit an element that had already been replaced, silently eating
  // the click -- see redraw()'s modal blocks below).
  let lastRenderedTechTreeKey = null;
  let lastRenderedReportKey = null;
  let lastRenderedDialog = null;
  let lastRenderedRingKey = null;

  // See setupGlobalShortcuts. panKeys is which of WASD are currently held,
  // read every animation-loop frame for continuous panning.
  const panKeys = new Set();

  // Dialog kinds that ask "are you sure you want to do this?" -- see
  // redraw()'s dialog block, which plays system_confirm_action.mp3 the
  // instant one of these is first shown. Deliberately excludes the purely
  // informational kinds (message/techResearched/unitBuilt) and the N-way
  // "chooseTech" picker.
  const CONFIRM_ACTION_DIALOG_KINDS = new Set(["confirm", "confirmEndTurn", "foundCity", "confirmAutomatedAction", "attackNotice"]);

  // --- Title screen music ---
  // Place your track at assets/music/title.mp3.
  let titleAudio = null;
  // The title track is its own <audio> element, NOT routed through
  // MusicSystem, so MusicSystem.setMuted has no effect on it. ?mute has to
  // silence it separately or an unattended test run still plays sound (see
  // applyMuteUrlSwitch).
  let titleAudioMuted = false;

  const TITLE_TRACK_PATH = "assets/music/title.mp3";
  // Counts how many times we've built the element. A retry appends a
  // cache-busting query: a browser that CACHED A 404 for this path -- e.g.
  // from a session before the file was in place, or a moment when the local
  // server wasn't serving it -- keeps replaying that cached miss on every
  // normal reload until a hard refresh. music.js guards its own probes
  // against exactly this with cache:"no-store" (see probeFile's comment);
  // a bare <audio> element has no equivalent, so the retry does it by URL.
  let titleAudioAttempts = 0;

  // Media error codes, for a log line that says what actually went wrong
  // instead of a bare number.
  const MEDIA_ERROR_MEANING = {
    1: "load aborted",
    2: "network error (server closed/stalled the connection)",
    3: "decode error (file is corrupt or not really an MP3)",
    4: "not supported (usually a 404 -- the file isn't being served)",
  };

  function initTitleAudio() {
    if (titleAudio) return titleAudio;
    titleAudioAttempts++;
    const src = titleAudioAttempts > 1
      ? `${TITLE_TRACK_PATH}?retry=${Date.now()}`
      : TITLE_TRACK_PATH;
    console.log(`[title music] creating Audio — ${src}`);
    titleAudio = new Audio(src);
    titleAudio.loop   = true;
    titleAudio.volume = titleAudioMuted ? 0 : 1.0;

    titleAudio.addEventListener("error", () => {
      const code = titleAudio.error?.code ?? 0;
      console.error(`[title music] load failed for ${src}: ${MEDIA_ERROR_MEANING[code] || "unknown error"} (code ${code})`);
      console.error(`[title music] open ${new URL(src, location.href).href} directly to see what the server returns`);
      // Drop the element so the next attempt builds a FRESH one (with the
      // cache-buster above) rather than retrying a permanently-errored one.
      titleAudio = null;
    });
    titleAudio.addEventListener("canplay", () =>
      console.log("[title music] canplay — file buffered and ready to play"));
    titleAudio.addEventListener("playing", () =>
      console.log("[title music] playing event — audio output confirmed"));
    titleAudio.addEventListener("pause", () =>
      console.log("[title music] paused"));
    return titleAudio;
  }

  function playTitleMusic() {
    // titleAudio is a standalone element outside MusicSystem, so without this
    // check it would start playing regardless of the Audio dropdown/in-game
    // menu's mute checkbox -- most visibly when clicking "Begin", which calls
    // this unconditionally to seed the browser's autoplay permission.
    // setGlobalMuted keeps titleAudioMuted/titleAudio.volume in sync with the
    // real mute state, so this one check covers every call site.
    if (titleAudioMuted) {
      console.log("[title music] muted -- not starting playback");
      return;
    }
    const audio = initTitleAudio();
    console.log("[title music] calling play()…");
    audio.play()
      .then(() => console.log("[title music] play() resolved — waiting for playing event"))
      .catch((err) => {
        console.warn(`[title music] play() rejected — ${err.name}: ${err.message}`);
        // Only NotAllowedError is a real autoplay block. Anything else
        // (typically NotSupportedError, which follows a failed load) has
        // already been logged with its true cause by the error listener
        // above, so there's nothing to add here.
        if (err.name === "NotAllowedError") {
          console.warn("[title music] autoplay blocked; needs another user gesture");
        }
      });
  }

  function stopTitleMusic() {
    if (!titleAudio) return;
    console.log("[title music] fading out for game start");
    const audio = titleAudio;
    fadeAudioTo(audio, 0, 1000, () => audio.pause());
  }

  function fadeAudioTo(audio, targetVolume, durationMs, onDone) {
    const steps    = Math.round(durationMs / 50);
    const startVol = audio.volume;
    const delta    = (targetVolume - startVol) / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      audio.volume = Math.max(0, Math.min(1, startVol + delta * step));
      if (step >= steps) {
        clearInterval(timer);
        audio.volume = targetVolume;
        onDone?.();
      }
    }, 50);
  }

  const RACE_LIST = window.GameData.RACE_LIST;
  // Game Options "World Type" slider (2026-08-19): index -> worldgen.js's
  // WORLD_TYPE_CONFIG key, plus the label shown next to the slider.
  // "Continent" sits in the middle at index 2 (the default) since it's the
  // original, unparametrized generation behavior every other type is
  // defined relative to -- see worldgen.js's own doc comment.
  const WORLD_TYPE_SLIDER_VALUES = ["islands", "normal", "continent", "noWater"];
  const WORLD_TYPE_LABELS = { islands: "Islands", normal: "Normal", continent: "Continent", noWater: "No Water" };
  const WORLD_TYPE_HINTS = {
    islands: "Many small islands scattered across open water, each usually room for 1-2 cities.",
    normal: "About 15% more water than Continent.",
    continent: "The default world shape -- a handful of large landmasses.",
    noWater: "No ocean or coast at all -- one unbroken landmass.",
  };
  const WORLD_TYPE_DEFAULT_INDEX = WORLD_TYPE_SLIDER_VALUES.indexOf("continent");
  // Game Options "Game Speed" slider (2026-08-21): was a free 50-150% range
  // slider (step 5); replaced with 5 named levels, same "index -> lookup
  // table" shape as World Type just above. Evenly spaced across the same
  // 50-150% span the old slider covered, so applyGameSpeed's actual pacing
  // math (and everything downstream of it -- save games, multiplayer sync,
  // which all still pass around a raw percent) is untouched; only the launch
  // screen's own index-to-label mapping changed. "Normal" sits in the
  // middle at index 2 (the default, 100% -- the original, unscaled pace).
  const GAME_SPEED_LEVELS = [
    { id: "slowest", label: "Slowest", percent: 50 },
    { id: "slow", label: "Slow", percent: 75 },
    { id: "normal", label: "Normal", percent: 100 },
    { id: "fast", label: "Fast", percent: 125 },
    { id: "fastest", label: "Fastest", percent: 150 },
  ];
  const GAME_SPEED_DEFAULT_INDEX = GAME_SPEED_LEVELS.findIndex((l) => l.id === "normal");
  // Game Options "Difficulty" slider (2026-08-31, user-directed): unlike
  // World Type/Game Speed, the levels themselves (label + tuning values)
  // live in config.js's difficulty.levels, not duplicated here -- main.js
  // only needs the index/label for the UI, and config.js is what the engine
  // reads live, so config.js is the single source of truth. Its default
  // index lives with applyDifficulty (DIFFICULTY_DEFAULT_INDEX) rather than
  // here, since load has to reach it too.
  // Pacing experiment (2026-07-12): ~20% fewer tiles than the previous
  // 65x40 (2600) -- forces civs closer together for faster contact/
  // conflict. Same aspect ratio, scaled by sqrt(0.8). See
  // 58x36 (2088 tiles) is the REFERENCE size mapSizeForCivCount scales from.
  // Balance/pacing testing was calibrated against this size with 3 civs
  // (Orc/Human/Halfellow), so a 3-civ game reproduces it unchanged.
  const REFERENCE_MAP_WIDTH = 58, REFERENCE_MAP_HEIGHT = 36, REFERENCE_CIV_COUNT = 3;
  // Dynamic map sizing: scales map AREA linearly with civ count (width/
  // height each scale by sqrt(civCount/3)) so each civ gets roughly the
  // same amount of land regardless of how many are in the game -- fewer
  // civs get a smaller, tighter map that forces contact sooner; more civs
  // get more room. Clamped to a floor/ceiling so a pathological civ count
  // can't produce a degenerate (or absurdly expensive to generate) map.
  const MIN_MAP_WIDTH = 44, MIN_MAP_HEIGHT = 27;
  const MAX_MAP_WIDTH = 90, MAX_MAP_HEIGHT = 56;
  // Flat +20% AREA boost on top of the civ-count scaling above (not instead
  // of it) -- gives every civ count more breathing room to build up before
  // first contact. A linear dimension scale of sqrt(1.2), not a flat 1.2x
  // width/height (which would compound to +44% area instead of +20%).
  const MAP_SIZE_BOOST = 1.20;
  // Per-civ-above-2 shrink: an extra -5% AREA for every civ beyond 2 (2
  // civs: unchanged; 3: -5%; 4: -10%; 5: -15%; 6: -20%), applied on top of
  // everything above -- trims back some of the extra land the civ-count
  // scaling above grants so a crowded 5-6 civ game doesn't sprawl as much
  // extra unclaimed space. Floored well above zero so a civ count far past
  // the UI's actual 2-6 range can't invert the map size.
  const CIV_ABOVE_TWO_SHRINK_RATE = 0.05;
  // Two separate -10% AREA cuts on top of everything above, applied as
  // sqrt() to the linear dimension scale (same convention as MAP_SIZE_BOOST
  // and CIV_ABOVE_TWO_SHRINK_RATE) -- width/height each shrink by sqrt(0.9)
  // per constant (~5.1%), not 10% each. The two compound to -19% AREA
  // combined (0.9*0.9 = 0.81), not -20%.
  const MAP_SIZE_USER_SHRINK = 0.9;
  const MAP_SIZE_USER_SHRINK_2 = 0.9;
  function mapSizeForCivCount(civCount) {
    const areaShrink = Math.max(0.2, 1 - CIV_ABOVE_TWO_SHRINK_RATE * Math.max(0, civCount - 2));
    const linearScale = Math.sqrt(civCount / REFERENCE_CIV_COUNT) * Math.sqrt(MAP_SIZE_BOOST) * Math.sqrt(areaShrink) * Math.sqrt(MAP_SIZE_USER_SHRINK) * Math.sqrt(MAP_SIZE_USER_SHRINK_2);
    const width = Math.round(Math.min(MAX_MAP_WIDTH, Math.max(MIN_MAP_WIDTH, REFERENCE_MAP_WIDTH * linearScale)));
    const height = Math.round(Math.min(MAX_MAP_HEIGHT, Math.max(MIN_MAP_HEIGHT, REFERENCE_MAP_HEIGHT * linearScale)));
    return { width, height };
  }

  function $(id) { return document.getElementById(id); }

  /** Forces the browser to synchronously flush any pending layout/paint
   *  before continuing -- reading a layout property (offsetHeight) is the
   *  standard, engine-agnostic trick for this. Needed by setupMenuBar/
   *  setupTitleMenuBar (2026-08-31, user-reported): on the mobile drawer,
   *  each menu section's own `.menu-bar` ancestor is a GPU-composited layer
   *  (it slides via `transform: translateX(...)`, see css/mobile.css), and
   *  on at least one real device a `display` toggle on a DESCENDANT of that
   *  layer -- opening the Knowledge accordion, by far the tallest dropdown
   *  at 7 rows -- never got repainted: the section visually vanished until
   *  an unrelated later click forced some other repaint. Could not
   *  reproduce in emulation (synthetic events skip the browser's own
   *  input/compositing pipeline), so this is a defensive fix for the
   *  documented failure mode, not a confirmed root cause. */
  function forceReflow(el) { if (el) void el.offsetHeight; }

  /**
   * Opening the game with ?mute (or ?mute=1) starts it fully silent -- no
   * music, no sfx.
   *
   * Driving a real game from a test harness otherwise blasts audio out of
   * whatever machine the browser is running on, which is exactly what you
   * don't want from a check that's supposed to run unattended. This is a
   * deliberate URL switch rather than a default, so normal play is untouched:
   * the Audio menu's Mute checkbox reads back through MusicSystem.isMuted(),
   * so it shows the muted state correctly and can still be unticked by hand.
   *
   * Muting is applied HERE, at bootstrap, so it's already in effect before
   * the title-music button, MusicSystem.init, or startGame can play anything.
   *
   * Deliberately NOT persisted (see MusicSystem.setMuted's `persist` option):
   * music.js normally writes the mute state to localStorage, which would mean
   * one ?mute test run left every later NORMAL session silent for no visible
   * reason.
   */
  function applyMuteUrlSwitch() {
    // Seed titleAudioMuted from whatever mute state music.js already
    // persisted/loaded -- otherwise this standalone flag stays at its
    // `false` default until the player re-toggles mute THIS session, so
    // clicking "Begin" would start title music right through a still-in-
    // effect mute from a previous session.
    titleAudioMuted = window.MusicSystem.isMuted();
    const params = new URLSearchParams(window.location.search);
    if (!params.has("mute") || params.get("mute") === "0") return;
    window.MusicSystem.setMuted(true, { persist: false });
    window.SfxSystem.setMuted(true); // sfx mute is in-memory only already
    titleAudioMuted = true;          // separate element -- see initTitleAudio
    if (titleAudio) titleAudio.volume = 0;
    console.log("[audio] ?mute in the URL -- music, sfx and title music start muted");
  }

  /**
   * LAUNCH OPTIONS
   * --------------
   * Every pre-game choice lives in one modal, opened by the splash screen's
   * "Game Options" button, which also owns the Start Game button. Control
   * IDs (spectator-toggle, human-race-select, opponent-count, game-speed-
   * slider, seed-input, .spectator-race-checkbox) are read directly by
   * startGame(), which knows nothing about where they're rendered.
   *
   * Sections are shown/hidden by mode rather than mixed together: picking
   * All-AI Spectator swaps the Single Player block for the race checklist,
   * since "Race"/"Opponents" are meaningless in a spectator game.
   */
  function renderLaunchOptions() {
    return `
      <h2 class="launch-title">Game Options</h2>

      <div class="launch-grid">
      <div class="launch-section">
        <div class="launch-section-label">Mode</div>
        <label class="launch-row launch-row-check">
          <span>All-AI Spectator</span>
          <input type="checkbox" id="spectator-toggle">
        </label>
        <p class="launch-hint">Watch the AI races play each other. No player civ.</p>
      </div>

      <div class="launch-section" id="single-player-section">
        <div class="launch-section-label">Single Player</div>
        <label class="launch-row">
          <span>Select Your Kingdom</span>
          <select id="human-race-select">
            ${RACE_LIST.map((r) => `<option value="${r}">${window.GameData.getRace(r).label}</option>`).join("")}
          </select>
        </label>
        <label class="launch-row">
          <span>Opponents</span>
          <select id="opponent-count">
            <option value="1">1</option>
            <option value="2" selected>2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </label>
      </div>

      <div class="launch-section" id="spectator-race-section" style="display:none;">
        <div class="launch-section-label">Races in Play</div>
        <div id="spectator-race-list" class="launch-race-list"></div>
        <p class="launch-hint">Pick at least two.</p>
      </div>

      <div class="launch-section">
        <div class="launch-section-label">World</div>
        <label class="launch-row">
          <span>World Type</span>
          <span class="launch-row-slider">
            <input type="range" id="world-type-slider" min="0" max="${WORLD_TYPE_SLIDER_VALUES.length - 1}" step="1" value="${WORLD_TYPE_DEFAULT_INDEX}">
            <span id="world-type-label">${WORLD_TYPE_LABELS[WORLD_TYPE_SLIDER_VALUES[WORLD_TYPE_DEFAULT_INDEX]]}</span>
          </span>
        </label>
        <p class="launch-hint" id="world-type-hint">${WORLD_TYPE_HINTS[WORLD_TYPE_SLIDER_VALUES[WORLD_TYPE_DEFAULT_INDEX]]}</p>
        <label class="launch-row">
          <span>Map Seed</span>
          <input type="text" id="seed-input" placeholder="random">
        </label>
        <p class="launch-hint">Leave the seed blank for a random map, or reuse one to replay the same world.</p>
      </div>

      <!-- Split out of the World card (2026-08-26) as part of the cascade
           layout -- see css/style.css's .launch-grid. World held five
           controls and four hint paragraphs, making it ~400px tall against
           Mode's ~90px, so it was most of the modal's height on its own and
           no column arrangement could balance around it. Two cards of
           comparable size cascade evenly; the split is along a real seam
           too, since "what the map looks like" and "how fast/hard the game
           runs" are separate decisions. -->
      <div class="launch-section">
        <div class="launch-section-label">Pace &amp; Difficulty</div>
        <label class="launch-row">
          <span>Game Speed</span>
          <span class="launch-row-slider">
            <input type="range" id="game-speed-slider" min="0" max="${GAME_SPEED_LEVELS.length - 1}" step="1" value="${GAME_SPEED_DEFAULT_INDEX}">
            <span id="game-speed-pct">${GAME_SPEED_LEVELS[GAME_SPEED_DEFAULT_INDEX].label}</span>
          </span>
        </label>
        <p class="launch-hint">How long units, buildings, and research take to finish. Normal is the default pace.</p>
        <label class="launch-row">
          <span>Difficulty</span>
          <span class="launch-row-slider">
            <input type="range" id="difficulty-slider" min="0" max="${window.GameConfig.difficulty.levels.length - 1}" step="1" value="${DIFFICULTY_DEFAULT_INDEX}">
            <span id="difficulty-label">${window.GameConfig.difficulty.levels[DIFFICULTY_DEFAULT_INDEX].label}</span>
          </span>
        </label>
        <p class="launch-hint">How fast AI kingdoms develop, how big their armies grow, and how strong they start. Your own kingdom is never slowed down.</p>
        <label class="launch-row">
          <span>Max Monsters</span>
          <span class="launch-row-slider">
            <input type="range" id="monster-cap-slider" min="0" max="3" step="1" value="2">
            <span id="monster-cap-label">2 per kingdom</span>
          </span>
        </label>
        <p class="launch-hint">Caps Wandering Monsters, scaled by kingdom count. 0 disables them.</p>
        <label class="launch-row launch-row-check">
          <span>Territorial Victory</span>
          <input type="checkbox" id="territorial-victory-toggle" checked>
        </label>
        <p class="launch-hint">Win by controlling enough of the map. Turn off to require Elimination instead.</p>
      </div>
      </div>

      <div class="launch-actions">
        <button id="start-game-btn" class="launch-start-btn">Start Game</button>
      </div>`;
  }

  /** "Which copy of the game is this" -- date/time/build number, read
   *  straight from js/data/config.js's `build` section. Lives in the
   *  lower-right corner of the base title screen, visible before the player
   *  opens the Game Options modal.
   *
   *  Synchronous, and that's the point: a config value always renders,
   *  offline included, at the cost of having to be bumped by hand (see
   *  config.js's own note on that trade). */
  function renderBuildStamp() {
    const build = window.GameConfig.build || {};
    const when = [build.date, build.time].filter(Boolean).join(" ");
    const stamp = build.number != null
      ? `${when}${when ? " · " : ""}build ${build.number}`
      : when;
    // Nothing rendered at all if the section is missing or blank, rather than
    // a stray "build undefined".
    if (!stamp) return "";
    // Not escaped, and doesn't need to be: every piece is a scalar typed by
    // hand into js/data/config.js by whoever cut the build.
    return stamp;
  }

  /** Decides once, at startup, whether this is the phone build, and stamps
   *  `body.mobile` -- the gate every rule in css/mobile.css hangs off.
   *
   *  Deliberately NOT a user-agent sniff (unreliable, and ages badly as
   *  devices change) and deliberately NOT a live media query. A desktop
   *  browser dragged narrow must not flip into the phone layout mid-session:
   *  the whole layout would swap underneath the player, and canvas sizing and
   *  input handling would have to renegotiate on the fly. Evaluated once and
   *  left alone; a real device never changes category anyway.
   *
   *  Two signals, both required. `pointer: coarse` says the primary input is
   *  a finger, which rules out a desktop with a touchscreen. The width test
   *  rules IN phones only -- tablets are explicitly out of scope for now
   *  (user-directed): a 10-inch screen mostly wants the desktop layout with a
   *  narrower sidebar, which is a different and much smaller problem.
   *
   *  `?mobile` and `?desktop` force it either way, so the phone build can be
   *  worked on in a desktop browser without faking a device. */
  const MOBILE_MAX_WIDTH = 820;
  function detectMobile() {
    const q = window.location.search;
    if (/[?&]desktop\b/.test(q)) return false;
    if (/[?&]mobile\b/.test(q)) return true;
    const coarse = window.matchMedia?.("(pointer: coarse)").matches;
    const narrow = Math.min(window.innerWidth, window.innerHeight) <= MOBILE_MAX_WIDTH;
    return !!coarse && narrow;
  }

  // ==========================================================================
  // MOBILE SHELL  (2026-08-25, mobile phase 1)
  // Bottom sheet, End Turn FAB, status pill, menu drawer.
  //
  // Everything here DRIVES existing controls rather than replacing them. The
  // FAB forwards its tap to the real #end-turn-btn the sidebar renders; the
  // hamburger toggles the existing .menu-bar. So none of main.js's several
  // dozen id-bound handlers need to know the phone layout exists, and there
  // is no second implementation of ending a turn to keep in sync.
  //
  // Bound once, at startup, to elements that live OUTSIDE #sidebar --
  // sidebar.js replaces its container's innerHTML on every redraw, so
  // anything bound in there would be detached seconds later.
  // ==========================================================================

  /** Moves the sheet to a detent by name, clamped to the ends. Also syncs
   *  #m-sheet-toggle-btn -- the single choke point for that sync no matter
   *  which of this function's callers moved the sheet (the button itself,
   *  or a new-turn reset). The button gets its OWN copy of data-detent, not
   *  just an icon update: it tracks the sheet's position via its own
   *  `bottom` rather than sharing #sidebar's transform (see css/mobile.css's
   *  `.m-sheet-toggle` rule block for why: a display:contents-wrapper
   *  version of this didn't reliably repaint on real testing). */
  function setSheetDetent(name) {
    const sheet = $("sidebar");
    if (!sheet) return;
    sheet.dataset.detent = name;
    // The FAB rides above the sheet's lip at rest, and gets out of the way
    // once the sheet is up -- otherwise it covers the panel the player just
    // opened.
    sheet.style.setProperty("--m-fab-bottom", name === "peek" ? "5.6rem" : "1rem");
    const toggle = $("m-sheet-toggle-btn");
    if (toggle) {
      toggle.dataset.detent = name;
      const open = name !== "peek";
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Collapse panel" : "Show panel");
      // Flips the CSS-drawn chevron (mobile.css's .m-sheet-toggle-arrow)
      // between pointing up (collapsed, "tap to raise") and down (open,
      // "tap to lower") -- a class toggle, not an innerHTML swap, since the
      // arrow is a bordered span now, not a text glyph (2026-08-26,
      // user-reported: the old Unicode arrow was too faint to see).
      toggle.classList.toggle("m-sheet-toggle-open", open);
    }
  }

  /** Turn number, stockpile, research progress, and (mobile only) the FAB's
   *  awaiting-orders badge. Cheap enough to run on every redraw; reads the
   *  same sources the sidebar does. Drives TWO parallel element sets now
   *  (2026-08-27, user-directed: desktop gets its own always-visible
   *  turn/resource and research pills, #d-status/#d-research in the menu
   *  bar, matching the mobile #m-status/#m-research pills' content exactly)
   *  -- updateStatusPair below is the shared logic, called once per id
   *  prefix. Only one prefix's elements exist as anything but CSS-hidden
   *  markup on a given platform (see css/mobile.css's `body.mobile
   *  .d-status, .d-research { display: none; }` and the unscoped "desktop
   *  keeps none of #m-topbar" rule), so updating the invisible set is
   *  harmless, not just tolerated. */
  function updateStatusPair(turnId, resId, researchId, researchLabelId, researchFillId) {
    const turnEl = $(turnId), resEl = $(resId);
    if (!turnEl || !gameState) return;

    turnEl.textContent = `Turn ${gameState.turnNumber || 0}`;
    const civ = humanCivId ? gameState.civs[humanCivId] : null;
    if (civ && resEl) {
      const s = civ.stockpile || {};
      const n = (v) => Math.round(v || 0).toLocaleString();
      // Icons, not just numbers -- a bare "1,240 · 88 · 42" doesn't say
      // which figure is which at a glance (unlike the Kingdom tab's economy
      // table, which already pairs each row with an icon; see sidebar.js's
      // RESOURCE_ROWS).
      resEl.innerHTML = ["harvest", "coin", "lore"].map((k) =>
        `<svg class="resource-icon"><use href="#icon-${k}"></use></svg>${n(s[k])}`
      ).join(" ");
    } else if (resEl) {
      resEl.textContent = "";
    }

    // Research progress pill (2026-08-27, user-directed): hidden entirely
    // whenever nothing is being researched, rather than showing an empty
    // bar -- same "civ.currentResearch truthy" gate the sidebar's own
    // RESEARCH section and techtree.js's "researching" tag use. Percent
    // math mirrors techtree.js's renderNode exactly (same
    // researchTotalTurns/researchTurnsRemaining pair), so the two can
    // never silently disagree.
    const researchEl = $(researchId);
    if (researchEl) {
      if (civ && civ.currentResearch) {
        const tech = window.GameData.getTech(civ.currentResearch);
        const pct = civ.researchTotalTurns
          ? Math.min(100, Math.floor(100 * (civ.researchTotalTurns - civ.researchTurnsRemaining) / civ.researchTotalTurns))
          : 0;
        researchEl.hidden = false;
        const labelEl = $(researchLabelId);
        if (labelEl) labelEl.textContent = `${tech.label} · ${pct}%`;
        const fillEl = $(researchFillId);
        if (fillEl) fillEl.style.width = `${pct}%`;
      } else {
        researchEl.hidden = true;
      }
    }
  }

  function updateMobileStatus() {
    updateStatusPair("m-status-turn", "m-status-res", "m-research", "m-research-label", "m-research-fill");
    updateStatusPair("d-status-turn", "d-status-res", "d-research", "d-research-label", "d-research-fill");
    if (!gameState) return; // updateStatusPair already no-ops per-pair; the FAB logic below still needs its own guard.

    const fab = $("m-endturn-fab"), badge = $("m-fab-badge");
    if (!fab || !badge) return;
    const civ = humanCivId ? gameState.civs[humanCivId] : null;

    // Other kingdoms taking their turn (2026-08-27, user-directed):
    // advanceTurn sets viewState.turnBanner for exactly this window --
    // "<Race> Kingdom Taking Its Turn..." -- clearing it the instant
    // control returns to the player. Neither "Next" nor "End Turn" means
    // anything while it's up (there's nothing of the player's own left to
    // jump to or end), so the button says so instead and goes inert --
    // `disabled` blocks both a tap and wireLongPress's pointerdown-driven
    // long-press in one step, no separate guard needed in either handler.
    if (viewState.turnBanner) {
      fab.disabled = true;
      fab.classList.remove("m-ready");
      badge.hidden = true;
      const waitLabel = fab.querySelector(".m-fab-label");
      if (waitLabel) waitLabel.textContent = "Wait";
      return;
    }
    fab.disabled = false;

    // Same three "still owes this turn" categories sidebar.js's own End
    // Turn button label uses, and collectUnresolvedTurnWork checks for the
    // confirm-on-force-end dialog -- kept in sync by eye, matching this
    // codebase's existing convention for this exact predicate set (see
    // sidebar.js's own comment on it appearing in three places already).
    const idleCities = civ
      ? civ.cities.filter((c) => window.GameEngine.cities.isCityIdle(civ, c, gameState)).length : 0;
    const waitingUnits = civ ? window.GameEngine.orders.unitsNeedingOrders(gameState, humanCivId).length : 0;
    const researchOwed = civ && !civ.currentResearch && window.GameEngine.tech.hasAffordableResearch(civ)
      && (civ.researchSkipUntilTurn || 0) <= (gameState.turnNumber || 0) ? 1 : 0;
    const owed = idleCities + waitingUnits + researchOwed;
    badge.hidden = owed === 0;
    badge.textContent = owed > 99 ? "99+" : String(owed);
    const label = fab.querySelector(".m-fab-label");
    if (label) label.innerHTML = owed === 0 ? "End<br>Turn" : "Next";
    // Colour, not motion -- see css/mobile.css's note on the no-flashing rule.
    fab.classList.toggle("m-ready", !!civ && owed === 0);
  }

  // Re-armed on returning to portrait, not stored across sessions -- see
  // index.html's #m-rotate-notice comment on why this is a reminder rather
  // than a one-time dismissal.
  let rotateNoticeDismissed = false;

  /** Shows/hides #m-rotate-notice against the device's CURRENT orientation.
   *  Bound to resize (which also fires on a rotation) rather than a bare
   *  CSS media query so dismissal can be tracked at all -- pure CSS has no
   *  concept of "the player already said continue anyway this time." */
  function updateRotateNotice() {
    if (!document.body.classList.contains("mobile")) return;
    const isLandscape = window.matchMedia("(orientation: landscape)").matches;
    if (!isLandscape) rotateNoticeDismissed = false;
    document.body.classList.toggle("m-landscape", isLandscape && !rotateNoticeDismissed);
  }

  /** Drives body.m-menu-open, the single class css/mobile.css keys the
   *  drawer transform off of -- shared by BOTH the in-game hamburger
   *  (#m-menu-btn/#m-scrim, inside #game-screen) and the title screen's own
   *  (#title-m-menu-btn/#title-m-scrim, 2026-08-27) rather than one
   *  function per screen, since the two never need to coexist visibly (only
   *  one screen is ever display:flex at a time) -- whichever pair actually
   *  exists in the DOM right now is the one this updates; the other simply
   *  has nothing to find. */
  function setMobileMenuOpen(open) {
    document.body.classList.toggle("m-menu-open", open);
    for (const id of ["m-menu-btn", "title-m-menu-btn"]) {
      $(id)?.setAttribute("aria-expanded", open ? "true" : "false");
    }
    for (const id of ["m-scrim", "title-m-scrim"]) {
      const scrim = $(id);
      if (scrim) scrim.hidden = !open;
    }
  }

  /** Shows/hides the sheet via #m-sheet-toggle-btn (2026-08-26,
   *  user-directed): the only two states left since selection no longer
   *  auto-raises it (see the removed revealSheetForSelection). Replaces an
   *  earlier drag-to-resize gesture; see css/mobile.css's `#sidebar` rule
   *  block for why. */
  function setupSheetToggle() {
    $("m-sheet-toggle-btn")?.addEventListener("click", () => {
      const sheet = $("sidebar");
      if (!sheet) return;
      setSheetDetent((sheet.dataset.detent || "peek") === "peek" ? "full" : "peek");
    });
  }

  /** Swipe a full-screen destination down to close it.
   *
   *  Dismisses by clicking the modal's OWN `.techtree-close-btn` rather than
   *  hiding anything directly -- each overlay's close path does more than set
   *  display:none (knowledge resets its view, reports clear cached series),
   *  and reproducing that here would mean four more things to keep in step.
   *  Same forwarding trick the End Turn FAB uses.
   *
   *  Only claims presses starting in the top strip, so the content below
   *  keeps its own scrolling. */
  const SWIPE_GRAB_ZONE_PX = 56;
  const SWIPE_DISMISS_PX = 110;
  function setupSwipeToDismiss(modal) {
    if (!modal) return;
    let startY = 0, dy = 0, active = false;

    modal.addEventListener("pointerdown", (e) => {
      // Never start a dismiss on the close button itself -- let the tap land.
      if (e.target.closest(".techtree-close-btn")) return;
      const rect = modal.getBoundingClientRect();
      if (e.clientY - rect.top > SWIPE_GRAB_ZONE_PX) return;
      active = true;
      startY = e.clientY;
      dy = 0;
      modal.classList.add("m-swiping");
      try { modal.setPointerCapture(e.pointerId); } catch (_) { /* not capturable */ }
    });

    modal.addEventListener("pointermove", (e) => {
      if (!active) return;
      dy = Math.max(0, e.clientY - startY);   // downward only
      modal.style.transform = `translateY(${dy}px)`;
    });

    function end(e) {
      if (!active) return;
      active = false;
      modal.classList.remove("m-swiping");
      modal.style.transform = "";
      // Settle before releasing capture -- releasePointerCapture throws when
      // the pointer is already gone, which is the normal case on
      // pointercancel, and that throw would skip the dismiss below.
      const shouldClose = dy > SWIPE_DISMISS_PX;
      try { modal.releasePointerCapture(e.pointerId); } catch (_) { /* already released */ }
      if (shouldClose) modal.querySelector(".techtree-close-btn")?.click();
    }
    modal.addEventListener("pointerup", end);
    modal.addEventListener("pointercancel", end);
  }

  function setupMobileShell() {
    if (!document.body.classList.contains("mobile")) return;

    if ($("sidebar")) setSheetDetent("peek");
    setupSheetToggle();

    // Forwards a plain tap to the sidebar's own End Turn (re-rendered
    // constantly, so looked up at tap time, never cached) -- which now goes
    // through handleEndTurnButtonClick same as a real click there would,
    // since that's wired via addEventListener, not .onclick, and .click()
    // synthesizes a real event either way. A long-press, unlike a plain
    // forwarded tap, skips the sidebar button entirely and force-ends the
    // turn directly -- wired once here rather than per-redraw since,
    // unlike #end-turn-btn, this FAB is never rebuilt.
    wireLongPress($("m-endturn-fab"), () => $("end-turn-btn")?.click(), handleEndTurnClick);

    $("m-menu-btn")?.addEventListener("click", () => {
      setMobileMenuOpen(!document.body.classList.contains("m-menu-open"));
    });
    $("m-scrim")?.addEventListener("click", () => setMobileMenuOpen(false));

    // Tapping the map dismisses the drawer and drops an un-pinned sheet back
    // to peek, so the map is one tap away from anywhere.
    $("map-canvas")?.addEventListener("pointerdown", () => {
      if (document.body.classList.contains("m-menu-open")) setMobileMenuOpen(false);
    });

    // The status pill expands the Kingdom view -- the pill is a summary, and
    // tapping a summary should open the thing it summarises.
    $("m-status")?.addEventListener("click", () => setSheetDetent("full"));
    // The research pill opens the Tech Tree directly -- same "tapping a
    // summary opens the thing it summarises" reasoning as the status pill
    // above, and matches the in-game "Choose Research"/"View Tech Tree"
    // buttons' own viewState.techTreeCivId = humanCivId convention.
    $("m-research")?.addEventListener("click", () => {
      if (!humanCivId) return;
      viewState.techTreeCivId = humanCivId;
      redraw();
    });

    // Destinations: swipe down to leave. #game-dialog-modal is deliberately
    // absent -- see setupSwipeToDismiss.
    ["techtree-modal", "reports-modal", "knowledge-modal", "keyboard-shortcuts-modal"]
      .forEach((id) => setupSwipeToDismiss($(id)));

    // Opening a destination should not leave the drawer stacked behind it.
    // Delegated to the drawer and matched on the LEAF buttons -- the section
    // headers (#menu-knowledge-btn etc.) only expand an accordion and must
    // keep the drawer open, so binding to those would close it on the way in.
    //
    // Reached via .closest() from a button known to be in the GAME menu bar,
    // never document.querySelector(".menu-bar"): the title screen has its own
    // .menu-bar earlier in the DOM, so a bare query returns that one and this
    // silently never fires. Same trap setupMenuBar documents above.
    $("menu-file-btn")?.closest(".menu-bar")?.addEventListener("click", (e) => {
      if (e.target.closest(".menu-dropdown-btn")) setMobileMenuOpen(false);
    });

    $("m-rotate-dismiss")?.addEventListener("click", () => {
      rotateNoticeDismissed = true;
      updateRotateNotice();
    });
    // Rotation fires resize on every browser this needs to support, so this
    // rides the same event resizeMapCanvas already listens to rather than
    // needing its own 'orientationchange' binding.
    window.addEventListener("resize", updateRotateNotice);
    updateRotateNotice();

    updateMobileStatus();
  }

  function showSetupScreen() {
    if (detectMobile()) document.body.classList.add("mobile");
    window.UI.motion.init();
    applyMuteUrlSwitch();
    $("title-build-stamp").textContent = renderBuildStamp();
    $("launch-options-content").innerHTML = renderLaunchOptions();

    // Spectator mode: pick exactly which races participate via checkboxes,
    // instead of a random subset sized by "Opponents" (that dropdown/random
    // pick is still how a human-player game picks its AI opponents).
    $("spectator-race-list").innerHTML = RACE_LIST.map((r) => `
      <label class="launch-race-item">
        <input type="checkbox" class="spectator-race-checkbox" value="${r}" checked>
        ${window.GameData.getRace(r).label}
      </label>
    `).join("");

    $("spectator-toggle").addEventListener("change", (e) => {
      const isSpectator = e.target.checked;
      $("single-player-section").style.display = isSpectator ? "none" : "block";
      $("spectator-race-section").style.display = isSpectator ? "block" : "none";
    });

    // World Type slider: same "label moves live, value only actually
    // applies at Start Game" pattern as Game Speed/Max Monsters below --
    // see startGame's worldType read.
    $("world-type-slider").addEventListener("input", (e) => {
      const worldType = WORLD_TYPE_SLIDER_VALUES[parseInt(e.target.value, 10)];
      $("world-type-label").textContent = WORLD_TYPE_LABELS[worldType];
      $("world-type-hint").textContent = WORLD_TYPE_HINTS[worldType];
    });

    // Game Speed slider: the level label moves live as the slider is
    // dragged -- actually applying the speed (mutating GameConfig.pacing.
    // slowness) waits for Start Game itself (see startGame's applyGameSpeed
    // call), same as every other launch option here.
    $("game-speed-slider").addEventListener("input", (e) => {
      $("game-speed-pct").textContent = GAME_SPEED_LEVELS[parseInt(e.target.value, 10)].label;
    });

    // Difficulty slider: same "label moves live, value only actually applies
    // at Start Game" pattern as Game Speed just above -- see startGame's
    // applyDifficulty call.
    $("difficulty-slider").addEventListener("input", (e) => {
      $("difficulty-label").textContent = window.GameConfig.difficulty.levels[parseInt(e.target.value, 10)].label;
    });

    // Max Monsters slider: same "label moves live, value only actually
    // applies at Start Game" pattern as Game Speed just above -- see
    // startGame's monsterCapPerKingdom read.
    $("monster-cap-slider").addEventListener("input", (e) => {
      const n = parseInt(e.target.value, 10);
      $("monster-cap-label").textContent = n === 0 ? "Off" : `${n} per kingdom`;
    });

    $("start-game-btn").addEventListener("click", startGame);

    setupLaunchOptionsOverlay();
    setupCreditsOverlay();
    setupContextMenuDismissal();
    setupButtonClickSfx();
    setupGlobalShortcuts();
    setupKeyboardShortcutsOverlay();
    setupKnowledgeBase();
    setupTitleMenuBar();
    setupTitleMobileMenu();
    setupTitleAudioControls();
    setupFocusMuting();
    setupTitleLoadGameControl();
    setupMotionControls();
  }

  /** Title menu bar's File > Load Game: loads a save straight from the title
   *  screen, before "Begin" has ever been clicked -- unlike the in-game File
   *  menu's Load Game (handleLoadGameFile/finishApplyLoadedPayload), which
   *  REPLACES an already-running session's gameState/viewState in place
   *  because window.UI.input.attach already closed over those exact object
   *  references. Here neither object exists yet, so there's nothing to
   *  preserve identity for -- startGameFromSave just assigns them fresh, same
   *  as startGame's own `gameState = createNewGame(...)`, and reuses
   *  startGame's asset-loading/finishStartGame tail via
   *  beginGameScreenTransition. A separate file input/handler from the
   *  in-game one on purpose, so the two load paths can never cross wires. */
  function setupTitleLoadGameControl() {
    const btn = $("title-load-game-btn");
    const fileInput = $("title-load-game-file-input");
    if (!btn || !fileInput) return;
    btn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          // See the in-game Load Game handler's own comment
          // (handleLoadGameFile) for why this reads bytes, not text.
          const payload = await window.GameEngine.savegame.deserializeFromArrayBuffer(reader.result);
          startGameFromSave(payload);
        } catch (err) {
          alert(`Failed to load save file: ${err.message}`);
        }
      };
      reader.readAsArrayBuffer(file);
    });
    $("title-quick-load-btn")?.addEventListener("click", quickLoad);
    updateQuickLoadButtons();
  }

  /** Every mute control across the app -- the title menu bar's Audio
   *  checkbox (2026-08-12), the in-game Audio menu's checkbox, and the "M"
   *  global shortcut -- all drive and reflect this one shared pair of
   *  functions rather than each keeping its own copy of the mute state, so
   *  none of them can ever drift out of sync with the others no matter which
   *  one the player actually uses (a control that isn't in the DOM yet, e.g.
   *  the in-game checkbox before a game starts, is just skipped). */
  function syncAllMuteControls() {
    const muted = window.MusicSystem.isMuted();
    for (const id of ["title-menu-audio-mute-checkbox", "title-mute-checkbox", "audio-mute-checkbox"]) {
      const el = $(id);
      if (el) el.checked = muted;
    }
  }
  function setGlobalMuted(muted) {
    window.MusicSystem.setMuted(muted);
    window.SfxSystem.setMuted(muted);
    // titleAudio is a standalone <audio> element outside MusicSystem entirely
    // (see initTitleAudio), so without this it never learns about a mute
    // toggled through the Audio dropdown/in-game menu. Kept in lockstep here
    // so an already-playing title track goes silent immediately too, not
    // just future play() calls -- see playTitleMusic's own mute check for
    // the "don't even start" half of this.
    titleAudioMuted = muted;
    if (titleAudio) titleAudio.volume = muted ? 0 : 1.0;
    syncAllMuteControls();
  }

  /**
   * FOCUS MUTING (2026-08-26, user-reported: "in mobile view the sound and
   * music continue when the user does not have focus on the browser window.
   * Detect if the window has focus. If not, mute.")
   * ----------------------------------------------------------------------
   * Two signals, because neither alone covers both platforms: `blur`/`focus`
   * is what fires when a desktop player switches to another window (the tab
   * is still visible, so visibilitychange never fires), and
   * `visibilitychange` is what fires when a phone backgrounds the browser or
   * the player switches tabs (blur is not reliably delivered there). Both
   * funnel through the same resolver so the two can't disagree.
   *
   * Deliberately NOT routed through setGlobalMuted: that is the player's own
   * mute preference -- persisted, mirrored into every mute checkbox, and
   * theirs to set. A tab switch must leave it exactly as they left it, so
   * the audio systems carry a separate "suspended" flag that stacks on top
   * of it (see music.js/sfx.js's setFocusSuspended). Coming back therefore
   * restores whatever the player chose, muted or not.
   *
   * titleAudio is handled here rather than in music.js because it is a
   * standalone <audio> element outside MusicSystem entirely (see
   * initTitleAudio) -- the same reason setGlobalMuted has to poke at it by
   * hand. Whether it was actually PLAYING is captured on the way out, so
   * coming back doesn't start title music that wasn't running.
   */
  let audioFocusSuspended = false;
  let titleAudioWasPlaying = false;

  function windowHasAudioFocus() {
    if (typeof document === "undefined") return true;
    if (document.visibilityState === "hidden") return false;
    return typeof document.hasFocus === "function" ? document.hasFocus() : true;
  }

  function applyAudioFocus() {
    const suspended = !windowHasAudioFocus();
    if (suspended === audioFocusSuspended) return;
    audioFocusSuspended = suspended;
    window.MusicSystem.setFocusSuspended(suspended);
    window.SfxSystem.setFocusSuspended(suspended);
    if (!titleAudio) return;
    if (suspended) {
      titleAudioWasPlaying = !titleAudio.paused;
      titleAudio.volume = 0;
      titleAudio.pause();
    } else if (titleAudioWasPlaying && !titleAudioMuted) {
      titleAudio.volume = 1.0;
      titleAudio.play().catch(() => { /* needs a fresh gesture -- nothing to do */ });
    }
  }

  function setupFocusMuting() {
    window.addEventListener("blur", applyAudioFocus);
    window.addEventListener("focus", applyAudioFocus);
    document.addEventListener("visibilitychange", applyAudioFocus);
    // pagehide covers the iOS/Android case where a tab is frozen without a
    // visibilitychange ever landing; pageshow is its restore counterpart
    // (including a back-forward-cache restore, where no focus event fires).
    window.addEventListener("pagehide", applyAudioFocus);
    window.addEventListener("pageshow", applyAudioFocus);
  }

  /** Title menu bar's Audio dropdown -- same Mute/Music/SFX controls as the
   *  in-game Audio menu (setupAudioControls), just without "Now Playing" or
   *  "Track" (nothing is playing/selectable until a race is actually in a
   *  running game), wired here so it works before "Begin" is ever clicked.
   *  Mute specifically routes through
   *  setGlobalMuted/syncAllMuteControls above so it never disagrees with the
   *  standalone "Mute Sound" button. */
  function setupTitleAudioControls() {
    // The splash screen's own "Mute Audio" box, under Begin. Wired first and
    // separately from the menu-bar controls below, which early-return
    // together if their dropdown isn't in the DOM.
    const splashMute = $("title-mute-checkbox");
    if (splashMute) splashMute.addEventListener("change", () => setGlobalMuted(splashMute.checked));

    const checkbox = $("title-menu-audio-mute-checkbox");
    if (!checkbox) { syncAllMuteControls(); return; }
    syncAllMuteControls();
    checkbox.addEventListener("change", () => setGlobalMuted(checkbox.checked));

    const volumeSlider = $("title-menu-audio-volume-slider");
    volumeSlider.value = Math.round(window.MusicSystem.getMusicVolume() * 100);
    volumeSlider.addEventListener("input", () => {
      window.MusicSystem.setMusicVolume(parseInt(volumeSlider.value, 10) / 100);
    });

    const sfxSlider = $("title-menu-sfx-volume-slider");
    sfxSlider.value = Math.round(window.SfxSystem.getSfxVolume() * 100);
    sfxSlider.addEventListener("input", () => {
      window.SfxSystem.setSfxVolume(parseInt(sfxSlider.value, 10) / 100);
    });
  }

  /** Wires BOTH the title-screen and in-game "Motion" <select> controls
   *  (window.UI.motion's Auto/Full/Reduced mode) to the same underlying
   *  state -- both elements exist in the DOM unconditionally (unlike most
   *  in-game-only controls), so this runs once from showSetupScreen rather
   *  than needing a separate in-game wiring pass. Kept in sync with each
   *  other (and with whatever the OS preference resolves "Auto" to) via
   *  window.UI.motion.onChange, the same "one state, N listening controls"
   *  shape syncAllMuteControls uses for the mute checkbox. */
  function setupMotionControls() {
    const selects = [$("title-menu-motion-select"), $("motion-select")].filter(Boolean);
    if (!selects.length) return;
    const sync = () => { for (const sel of selects) sel.value = window.UI.motion.getMode(); };
    sync();
    for (const sel of selects) {
      sel.addEventListener("change", () => window.UI.motion.setMode(sel.value));
    }
    window.UI.motion.onChange(sync);
  }

  /** Open/close wiring for the title screen's own menu bar -- same
   *  click-to-toggle/click-outside-closes shape as the in-game
   *  setupMenuBar, kept as a fully separate instance (own menu list, own
   *  document click listener) rather than a shared/generalized one. Safe to
   *  keep separate since the two menu bars never need to coexist visibly --
   *  this one's container is hidden the moment a game actually starts (see
   *  startGame/startGameFromSave's `$("title-screen").style.display =
   *  "none"`). */
  function setupTitleMenuBar() {
    const menus = [
      { btn: $("title-menu-file-btn"), dropdown: $("title-menu-file-dropdown") },
      { btn: $("title-menu-interface-btn"), dropdown: $("title-menu-interface-dropdown") },
      { btn: $("title-menu-audio-btn"), dropdown: $("title-menu-audio-dropdown") },
      { btn: $("title-menu-knowledge-btn"), dropdown: $("title-menu-knowledge-dropdown") },
    ];
    if (!menus[0].btn) return;
    const bar = menus[0].btn.closest(".menu-bar");
    function closeAll() {
      for (const m of menus) { m.dropdown.style.display = "none"; m.btn.classList.remove("active"); }
    }
    for (const m of menus) {
      m.btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = m.dropdown.style.display === "none";
        closeAll();
        if (willOpen) { m.dropdown.style.display = "flex"; m.btn.classList.add("active"); }
        forceReflow(bar);
      });
    }
    bar.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", closeAll);
  }

  /** Hamburger/scrim wiring for the title screen's own mobile drawer
   *  (2026-08-27, user-directed) -- same click-to-toggle/tap-scrim-to-close
   *  shape as #game-screen's own #m-menu-btn/#m-scrim wiring in
   *  setupMobileShell, just against the title screen's own ids and called
   *  from showSetupScreen (title screen setup) instead of finishStartGame
   *  (in-game setup) since it has to work before "Begin" is ever clicked.
   *  Both pairs drive the SAME body.m-menu-open class (see
   *  setMobileMenuOpen's own doc comment) -- no separate open/close STATE
   *  here, only the click targets differ. */
  function setupTitleMobileMenu() {
    $("title-m-menu-btn")?.addEventListener("click", () => {
      setMobileMenuOpen(!document.body.classList.contains("m-menu-open"));
    });
    $("title-m-scrim")?.addEventListener("click", () => setMobileMenuOpen(false));
    // Opening a destination must not leave the drawer stacked behind it --
    // the exact counterpart of setupMobileShell's own delegation for the
    // in-game menu bar, which this was missing (2026-08-31): picking
    // Knowledge > Units here opened the page with the drawer AND its scrim
    // still up underneath, so closing the page dumped you back into an open
    // drawer you never asked to still be there.
    //
    // Same two constraints as that one: matched on the LEAF buttons only
    // (a section header like #title-menu-knowledge-btn just expands an
    // accordion and must keep the drawer open), and reached via .closest()
    // from a button known to be in the TITLE menu bar rather than a bare
    // document.querySelector(".menu-bar") -- see setupMenuBar's own comment
    // on why that query silently finds the wrong one of the two.
    $("title-menu-file-btn")?.closest(".menu-bar")?.addEventListener("click", (e) => {
      if (e.target.closest(".menu-dropdown-btn")) setMobileMenuOpen(false);
    });
  }

  /** Open/close wiring for the launch options modal. Closing is deliberately
   *  generous (button, backdrop click, Escape) because this modal is the only
   *  thing on the splash screen -- there's nothing behind it to lose. */
  function setupLaunchOptionsOverlay() {
    const overlay = $("launch-options-overlay");
    const open = () => {
      overlay.style.display = "flex";
      // Start title music the moment "Begin" is clicked -- a click IS a real
      // user gesture, so this satisfies the browser's autoplay-permission
      // requirement the same way a direct button press would. Re-opening
      // this modal on a later click never STOPS music that's already
      // playing -- play() on an already-playing element is a harmless no-op.
      playTitleMusic();
    };
    const close = () => { overlay.style.display = "none"; };

    $("title-options-btn").addEventListener("click", open);
    $("launch-options-close-btn").addEventListener("click", close);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.style.display === "flex") close();
    });
  }

  /** Open/close wiring for the Keyboard Shortcuts window -- same button/backdrop/Escape convention as
   *  setupLaunchOptionsOverlay. Opened from the Interface menu's
   *  "Keyboard Shortcuts" button; the "Enter Full Screen" button lives
   *  INSIDE this window (see index.html). Also opened from the title menu
   *  bar's own Interface > Keyboard Shortcuts button -- same overlay, just a
   *  second trigger reachable before a game starts. */
  function setupKeyboardShortcutsOverlay() {
    const overlay = $("keyboard-shortcuts-overlay");
    if (!overlay) return;
    const close = () => { overlay.style.display = "none"; };
    const open = () => { overlay.style.display = "flex"; };
    const btn = $("keyboard-shortcuts-btn");
    if (btn) btn.addEventListener("click", open);
    const titleBtn = $("title-menu-keyboard-shortcuts-btn");
    if (titleBtn) titleBtn.addEventListener("click", open);
    $("keyboard-shortcuts-close-btn").addEventListener("click", close);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.style.display === "flex") close();
    });
  }

  /** A synthetic, gameplay-free civ for the Knowledge menu's Tech Trees
   *  page -- same shape createNewGame stamps on a REAL civ at turn 0
   *  (Level 0 techs already auto-completed via applyTechEffects, matching
   *  the actual state every game truly begins in -- showing them as
   *  un-researched would be misleading, since a player never actually
   *  chooses to research them), just never placed on a map or given
   *  units/cities. Enough for techtree.js's render (raceId, completedTechs,
   *  currentResearch, cities.length, stockpile) and ai.js's
   *  previewNextResearch (via racialWeights/scoreNextResearch) to run
   *  safely -- neither needs anything more than that. */
  function buildReferenceCiv(raceId) {
    const civ = {
      id: raceId.toUpperCase(), raceId, cities: [], units: [], eliminated: false,
      isHuman: false, completedTechs: new Set(), currentResearch: null,
      doctrine: null, unlockedUnits: new Set(), unlockedBuildings: new Set(),
      civicInfluenceBonus: 0, radiusBonus: 0, usedCityNames: [],
      stockpile: {
        harvest: window.GameConfig.units.startingHarvest,
        coin: window.GameConfig.units.startingCoin,
        lore: window.GameConfig.units.startingLore,
      },
    };
    const levelZeroTechs = window.GameData.techsForRace(raceId)
      .filter((id) => window.GameData.getTech(id).layer === 0);
    for (const techId of levelZeroTechs) {
      civ.completedTechs.add(techId);
      window.GameEngine.tech.applyTechEffects(civ, window.GameData.getTech(techId));
    }
    return civ;
  }

  /** Renders whatever the Knowledge Base overlay is currently showing
   *  (knowledgeView/knowledgeSelectedUnitId) into #knowledge-content, and
   *  shows/hides the overlay itself. Standalone rather than folded into the
   *  main redraw() loop -- it has to work identically before a game exists
   *  (no gameState/viewState to hang a re-render key off of) and mid-game,
   *  and its content never goes stale on its own (pure reference data, not
   *  live game state), so there's nothing for a per-frame redraw to refresh
   *  -- every call site that changes knowledgeView/knowledgeSelectedUnitId
   *  calls this directly. */
  function renderKnowledgeOverlay() {
    const overlay = $("knowledge-overlay");
    if (!knowledgeView) {
      overlay.style.display = "none";
      return;
    }
    // Narrows the backdrop to stop at the sidebar's edge only while an
    // actual game is running (#game-screen visible) -- from the title
    // screen there's no sidebar to avoid, so the base full-viewport rule
    // applies instead. See .knowledge-overlay-ingame's own CSS comment.
    const inGame = $("game-screen").style.display !== "none";
    overlay.classList.toggle("knowledge-overlay-ingame", inGame);

    const content = $("knowledge-content");
    // Preserve the left-hand list's scroll position across re-renders --
    // every content.innerHTML assignment below destroys and recreates the
    // whole pane, .kb-list-pane included. Captured once here since all
    // three views (units/conditions/stats) share the same .kb-list-pane
    // structure.
    const prevListPane = content.querySelector(".kb-list-pane");
    const prevListScrollTop = prevListPane ? prevListPane.scrollTop : 0;
    if (knowledgeView === "conditions" || knowledgeView === "stats" || knowledgeView === "actions") {
      // "Units" is the only page a cross-link can currently arrive from,
      // so the back label is hardcoded here rather than threaded through
      // knowledgeBackTarget -- see jumpToCondition/jumpToStat/jumpToAction/
      // goBackToUnits.
      const backLabel = knowledgeBackTarget ? "Units" : null;
      if (knowledgeView === "conditions") {
        content.innerHTML = window.UI.knowledgebase.renderConditions(knowledgeSelectedConditionKey, backLabel);
        for (const btn of content.querySelectorAll(".kb-list-btn[data-condition-id]")) {
          btn.onclick = () => {
            knowledgeSelectedConditionKey = btn.dataset.conditionId;
            renderKnowledgeOverlay();
          };
        }
      } else if (knowledgeView === "stats") {
        content.innerHTML = window.UI.knowledgebase.renderStats(knowledgeSelectedStatKey, backLabel);
        window.UI.knowledgebase.wireCombatSimulator(content);
        for (const btn of content.querySelectorAll(".kb-list-btn[data-stat-id]")) {
          btn.onclick = () => {
            knowledgeSelectedStatKey = btn.dataset.statId;
            renderKnowledgeOverlay();
          };
        }
      } else {
        content.innerHTML = window.UI.knowledgebase.renderActions(knowledgeSelectedActionKey, backLabel);
        for (const btn of content.querySelectorAll(".kb-list-btn[data-action-id]")) {
          btn.onclick = () => {
            knowledgeSelectedActionKey = btn.dataset.actionId;
            renderKnowledgeOverlay();
          };
        }
      }
      const backBtn = $("kb-back-btn");
      if (backBtn) backBtn.onclick = goBackToUnits;
    } else if (knowledgeView === "techtrees") {
      // Reference-only (see buildReferenceCiv) -- never a live civ, so
      // there's no re-render key to chase the way the sidebar's own "View
      // Tech Tree" does; the race picker is the only thing that can change
      // this page, and it re-renders explicitly on its own onchange below.
      if (!knowledgeSelectedRaceId) {
        // Default to the human player's own kingdom in single player (same
        // "player's kingdom first" convention as Units/Structures above),
        // falling back to the first race in spectator mode or if there's no
        // live game yet.
        const playerRaceId = (humanCivId && !spectatorMode && gameState?.civs[humanCivId])
          ? gameState.civs[humanCivId].raceId : null;
        knowledgeSelectedRaceId = playerRaceId || window.GameData.RACE_LIST[0];
      }
      const refCiv = buildReferenceCiv(knowledgeSelectedRaceId);
      const raceOptionsHtml = window.GameData.RACE_LIST.map((r) =>
        `<option value="${r}"${r === knowledgeSelectedRaceId ? " selected" : ""}>${window.GameData.getRace(r).label}</option>`
      ).join("");
      content.innerHTML = `
        <div class="techtree-modal-scroll">
          <div class="ai-action-log-controls">
            <label>Race:
              <select id="kb-techtree-race-select">${raceOptionsHtml}</select>
            </label>
          </div>
          ${window.UI.techtree.render(refCiv, false, null, null, /* isReference */ true)}
        </div>`;
      const raceSelect = $("kb-techtree-race-select");
      if (raceSelect) raceSelect.onchange = () => {
        knowledgeSelectedRaceId = raceSelect.value;
        renderKnowledgeOverlay();
      };
      // Unit/condition cross-links (techtree.js's renderNode) -- already
      // inside the Knowledge Base overlay, so no overlay-switching needed,
      // just flip which page it's showing.
      wireTechTreeKbLinks(content);
    } else if (knowledgeView === "structures") {
      // Structures page (2026-08-27, user-directed): same list+profile
      // layout and same "player's kingdom first" reordering as Units --
      // see knowledgebase.js's groupedStructures for how that reorder is
      // decided, identical convention to groupedUnits just above.
      const playerRaceId = (humanCivId && !spectatorMode && gameState?.civs[humanCivId])
        ? gameState.civs[humanCivId].raceId : null;
      content.innerHTML = window.UI.knowledgebase.renderStructures(knowledgeSelectedStructureId, playerRaceId);
      const canvas = content.querySelector(".kb-unit-portrait");
      if (canvas) {
        window.UI.knowledgebase.drawStructurePortrait(canvas, canvas.dataset.portraitStructureId, canvas.dataset.portraitRaceId);
      }
      for (const btn of content.querySelectorAll(".kb-list-btn[data-structure-id]")) {
        btn.onclick = () => {
          knowledgeSelectedStructureId = btn.dataset.structureId;
          renderKnowledgeOverlay();
        };
      }
    } else if (knowledgeView === "terrain") {
      // Terrain page (2026-08-31, user-directed): every terrain type plus
      // the resource/ruin/cave/river/road/bridge layers that sit on one.
      // No playerRaceId reordering, unlike Units/Structures -- terrain
      // isn't owned by a kingdom, so there's no "your kingdom's own" group
      // to float to the top.
      content.innerHTML = window.UI.knowledgebase.renderTerrain(knowledgeSelectedTerrainKey);
      const canvas = content.querySelector(".kb-terrain-portrait");
      if (canvas) {
        window.UI.knowledgebase.drawTerrainPortrait(canvas, canvas.dataset.portraitTerrainKey);
      }
      for (const btn of content.querySelectorAll(".kb-list-btn[data-terrain-id]")) {
        btn.onclick = () => {
          knowledgeSelectedTerrainKey = btn.dataset.terrainId;
          renderKnowledgeOverlay();
        };
      }
    } else {
      // Player's own kingdom first (2026-08-27, user-directed): only in a
      // running single-player game (not spectating, not the title screen,
      // where there's no "your kingdom" to prioritize) -- see
      // knowledgebase.js's groupedUnits for how this reorders the list.
      const playerRaceId = (humanCivId && !spectatorMode && gameState?.civs[humanCivId])
        ? gameState.civs[humanCivId].raceId : null;
      content.innerHTML = window.UI.knowledgebase.renderUnits(knowledgeSelectedUnitId, playerRaceId);
      const canvas = content.querySelector(".kb-unit-portrait");
      if (canvas) {
        window.UI.knowledgebase.drawUnitPortrait(canvas, canvas.dataset.portraitUnitId, canvas.dataset.portraitRaceId);
      }
      for (const btn of content.querySelectorAll(".kb-list-btn[data-unit-id]")) {
        btn.onclick = () => {
          knowledgeSelectedUnitId = btn.dataset.unitId;
          renderKnowledgeOverlay();
        };
      }
      for (const link of content.querySelectorAll(".kb-condition-link[data-condition-link]")) {
        link.onclick = () => jumpToCondition(link.dataset.conditionLink);
      }
      for (const link of content.querySelectorAll(".kb-stat-link[data-stat-link]")) {
        link.onclick = () => jumpToStat(link.dataset.statLink);
      }
      for (const link of content.querySelectorAll(".kb-chip-link[data-action-link]")) {
        link.onclick = () => jumpToAction(link.dataset.actionLink);
      }
    }
    const newListPane = content.querySelector(".kb-list-pane");
    if (newListPane) newListPane.scrollTop = prevListScrollTop;
    overlay.style.display = "flex";
  }

  function openKnowledge(view) {
    knowledgeView = view;
    knowledgeSelectedUnitId = null;
    knowledgeSelectedStructureId = null;
    knowledgeSelectedConditionKey = null;
    knowledgeSelectedStatKey = null;
    knowledgeSelectedActionKey = null;
    knowledgeSelectedTerrainKey = null;
    knowledgeSelectedRaceId = null;
    knowledgeBackTarget = null;
    renderKnowledgeOverlay();
  }
  function closeKnowledge() {
    knowledgeView = null;
    knowledgeBackTarget = null;
    renderKnowledgeOverlay();
  }

  /** Closes the in-game "View Tech Tree" overlay (#techtree-overlay) --
   *  state mutation only, no redraw() of its own, so callers can do
   *  whatever comes next (open a different overlay, redraw the main game)
   *  without an intermediate frame flickering through neither. Factored out
   *  (2026-08-26) from the Close button's own handler below, which was the
   *  only caller until the tech tree's unit/condition cross-links
   *  (wireTechTreeKbLinks) needed to close this overlay on their way to
   *  opening the Knowledge Base one -- same close, different next step. */
  function closeTechTreeOverlay() {
    viewState.techTreeCivId = null;
    viewState.techTreeHoverId = null;
    // Reset, not just left stale: the render block below lazy-inits this
    // back to its Level-0-collapsed default the next time the tree opens,
    // rather than reopening wherever the player last left it expanded.
    viewState.techTreeCollapsedLayers = null;
    // Fires the deferred unit-built-notice/pendingIntent chain -- see
    // openTechResearchedDialog's onChooseResearch, which stashes it here
    // instead of firing it the instant the tech tree opens, specifically so
    // those notices can't pop up and steal focus while the player is still
    // choosing research. Cleared before calling: the callback itself may end
    // up back at a point that reopens the tech tree (unlikely today, but
    // this ordering means an onTechTreeClosed set during the callback is
    // never stomped by this line running after it).
    const onClosed = viewState.onTechTreeClosed;
    viewState.onTechTreeClosed = null;
    if (onClosed) onClosed();
  }
  /** A unit profile's condition cross-link (e.g. Wizard's "Burning — 5%
   *  chance to inflict on hit") -- jumps to that condition's own page,
   *  remembering the unit so "Back" can return to it. */
  function jumpToCondition(conditionKey) {
    knowledgeBackTarget = { unitId: knowledgeSelectedUnitId };
    knowledgeView = "conditions";
    knowledgeSelectedConditionKey = conditionKey;
    renderKnowledgeOverlay();
  }
  /** A unit profile's stat cross-link (e.g. "Attack") -- jumps to that
   *  stat's own page, remembering the unit so "Back" can return to it. */
  function jumpToStat(statKey) {
    knowledgeBackTarget = { unitId: knowledgeSelectedUnitId };
    knowledgeView = "stats";
    knowledgeSelectedStatKey = statKey;
    renderKnowledgeOverlay();
  }
  /** A unit profile's "Available Actions" cross-link (2026-08-28, user-
   *  directed) -- jumps to that action's own entry on the Actions page,
   *  remembering the unit so "Back" can return to it, same shape as
   *  jumpToCondition/jumpToStat above. */
  function jumpToAction(actionKey) {
    knowledgeBackTarget = { unitId: knowledgeSelectedUnitId };
    knowledgeView = "actions";
    knowledgeSelectedActionKey = actionKey;
    renderKnowledgeOverlay();
  }
  function goBackToUnits() {
    if (!knowledgeBackTarget) return;
    knowledgeView = "units";
    knowledgeSelectedUnitId = knowledgeBackTarget.unitId;
    knowledgeBackTarget = null;
    renderKnowledgeOverlay();
  }

  /** A tech tree node's "unlocks this unit" / "grants this condition"
   *  cross-links (techtree.js's renderNode: unitStatsHtml/conditionLinksHtml)
   *  -- jump straight to that Knowledge Base page. 2026-08-26, user-
   *  directed.
   *
   *  No back-target, unlike jumpToCondition/jumpToStat above: those return
   *  to the SPECIFIC unit profile a player was just reading, which makes
   *  sense as a "Back" button. A tech-tree jump has no equivalent single
   *  screen to return to -- it could be the Knowledge Base's own Tech Trees
   *  tab (a race picker + scroll position) or the entirely separate in-game
   *  "View Tech Tree" overlay (see wireTechTreeKbLinks) -- so this doesn't
   *  try to fake one. */
  function jumpToUnitFromTechTree(unitId) {
    knowledgeBackTarget = null;
    knowledgeView = "units";
    knowledgeSelectedUnitId = unitId;
    renderKnowledgeOverlay();
  }
  /** Same, for a tech's "grants X condition" cross-link. */
  function jumpToConditionFromTechTree(conditionKey) {
    knowledgeBackTarget = null;
    knowledgeView = "conditions";
    knowledgeSelectedConditionKey = conditionKey;
    renderKnowledgeOverlay();
  }

  /** Wires every techtree.js cross-link (`[data-kb-unit]`/
   *  `[data-kb-condition]`) inside `container` to jump into the Knowledge
   *  Base. Shared by both places techtree.js's render() lands -- the
   *  Knowledge Base's own Tech Trees tab and the in-game "View Tech Tree"
   *  overlay -- so the two can't drift out of sync with each other.
   *
   *  `closeLiveTree`, when passed, is called before jumping -- the in-game
   *  overlay is a SEPARATE modal from the Knowledge Base one (#techtree-
   *  overlay vs #knowledge-overlay), so that call site has to close the
   *  first before the second can show; the Knowledge Base's own Tech Trees
   *  tab is already inside the overlay being navigated, so it passes
   *  nothing.
   *
   *  e.stopPropagation() is load-bearing, not defensive: a tech that's
   *  currently available to research renders its WHOLE node as a real
   *  <button> with its own onclick (start researching this -- see the
   *  ".techtree-node-selectable" wiring below). These links are plain
   *  <span>s specifically so they can sit inside that button without
   *  producing invalid nested-button markup, but a click still bubbles --
   *  without this, following a "View unit" link on a researchable tech
   *  would also silently kick off researching it. */
  function wireTechTreeKbLinks(container, closeLiveTree) {
    for (const el of container.querySelectorAll("[data-kb-unit]")) {
      el.onclick = (e) => {
        e.stopPropagation();
        if (closeLiveTree) closeLiveTree();
        jumpToUnitFromTechTree(el.dataset.kbUnit);
      };
    }
    for (const el of container.querySelectorAll("[data-kb-condition]")) {
      el.onclick = (e) => {
        e.stopPropagation();
        if (closeLiveTree) closeLiveTree();
        jumpToConditionFromTechTree(el.dataset.kbCondition);
      };
    }
  }

  /** Wires the "Knowledge" menu's Units/Conditions/Stats buttons on BOTH
   *  menu bars (title screen and in-game -- same "one shared overlay, two
   *  triggers" convention as setupKeyboardShortcutsOverlay just above) plus
   *  the overlay's own close button/backdrop-click/Escape. */
  function setupKnowledgeBase() {
    const overlay = $("knowledge-overlay");
    if (!overlay) return;
    const unitsBtn = $("kb-units-btn");
    if (unitsBtn) unitsBtn.addEventListener("click", () => openKnowledge("units"));
    const structuresBtn = $("kb-structures-btn");
    if (structuresBtn) structuresBtn.addEventListener("click", () => openKnowledge("structures"));
    const terrainBtn = $("kb-terrain-btn");
    if (terrainBtn) terrainBtn.addEventListener("click", () => openKnowledge("terrain"));
    const actionsBtn = $("kb-actions-btn");
    if (actionsBtn) actionsBtn.addEventListener("click", () => openKnowledge("actions"));
    const conditionsBtn = $("kb-conditions-btn");
    if (conditionsBtn) conditionsBtn.addEventListener("click", () => openKnowledge("conditions"));
    const statsBtn = $("kb-stats-btn");
    if (statsBtn) statsBtn.addEventListener("click", () => openKnowledge("stats"));
    const techTreesBtn = $("kb-techtrees-btn");
    if (techTreesBtn) techTreesBtn.addEventListener("click", () => openKnowledge("techtrees"));
    const titleUnitsBtn = $("title-kb-units-btn");
    if (titleUnitsBtn) titleUnitsBtn.addEventListener("click", () => openKnowledge("units"));
    const titleStructuresBtn = $("title-kb-structures-btn");
    if (titleStructuresBtn) titleStructuresBtn.addEventListener("click", () => openKnowledge("structures"));
    const titleTerrainBtn = $("title-kb-terrain-btn");
    if (titleTerrainBtn) titleTerrainBtn.addEventListener("click", () => openKnowledge("terrain"));
    const titleActionsBtn = $("title-kb-actions-btn");
    if (titleActionsBtn) titleActionsBtn.addEventListener("click", () => openKnowledge("actions"));
    const titleConditionsBtn = $("title-kb-conditions-btn");
    if (titleConditionsBtn) titleConditionsBtn.addEventListener("click", () => openKnowledge("conditions"));
    const titleStatsBtn = $("title-kb-stats-btn");
    if (titleStatsBtn) titleStatsBtn.addEventListener("click", () => openKnowledge("stats"));
    const titleTechTreesBtn = $("title-kb-techtrees-btn");
    if (titleTechTreesBtn) titleTechTreesBtn.addEventListener("click", () => openKnowledge("techtrees"));
    $("knowledge-close-btn").addEventListener("click", closeKnowledge);
    // Pointer, not mouse (2026-08-31): a real touch tap fires a
    // browser-synthesized compatibility mousedown AFTER touchend, and
    // Safari re-hit-tests it against whatever is under the finger at that
    // moment -- which, for a tap that just opened this overlay, is this
    // overlay. A mousedown listener therefore reads its own opening tap as
    // a click on the backdrop and closes the page immediately. Same ghost-
    // event trap (and same fix) setupContextMenuDismissal documents at
    // length for the ring menu; Chrome's touch emulation does NOT reproduce
    // it, so this is deliberately fixed by matching that known-good
    // precedent rather than by repro.
    overlay.addEventListener("pointerdown", (e) => { if (e.target === overlay) closeKnowledge(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && knowledgeView) closeKnowledge();
    });
  }

  // Continuously re-scheduled while the credits overlay is open -- see startCreditsCrawl/closeCredits.
  let creditsAnimId = null;

  /** "View Credits", lower-left of the base title screen: fetches/parses
   *  credits.txt (root folder) fresh every time it's opened, so editing the
   *  file needs no rebuild -- see js/ui/credits.js for the tiny format it
   *  understands. No longer needs to close the Game Options modal first
   *  (2026-08-17, moved out of that modal) -- the button now lives outside
   *  it, and that modal's full-screen overlay physically covers this button
   *  while open, so there's no path to reach here with it still up. */
  function openCredits() {
    fetch("credits.txt")
      .then((r) => r.text())
      .then((text) => {
        $("credits-content").innerHTML = window.UI.credits.render(text);
        $("credits-overlay").style.display = "flex";
        startCreditsCrawl();
        playTitleMusic();
      });
  }

  function closeCredits() {
    $("credits-overlay").style.display = "none";
    if (creditsAnimId != null) { cancelAnimationFrame(creditsAnimId); creditsAnimId = null; }
    if (titleAudio) titleAudio.pause();
  }

  /** Drives the bottom-to-top scroll with rAF + measured pixel heights
   *  (rather than a CSS % keyframe) so the crawl always starts fully below
   *  the viewport and ends fully above it regardless of how long the credits
   *  text is -- then loops, since nothing here ever forces the overlay
   *  closed on its own. */
  function startCreditsCrawl() {
    if (creditsAnimId != null) cancelAnimationFrame(creditsAnimId);
    const viewport = $("credits-viewport");
    const content = $("credits-content");
    const PX_PER_SEC = 40;
    let y = viewport.clientHeight;
    let last = null;
    function frame(now) {
      if (last == null) last = now;
      y -= PX_PER_SEC * ((now - last) / 1000);
      last = now;
      if (y < -content.offsetHeight) y = viewport.clientHeight;
      content.style.transform = `translateY(${y}px)`;
      creditsAnimId = requestAnimationFrame(frame);
    }
    creditsAnimId = requestAnimationFrame(frame);
  }

  /** Open/close wiring for the credits crawl -- same generous-dismissal
   *  convention as setupLaunchOptionsOverlay (button, backdrop, Escape). */
  function setupCreditsOverlay() {
    const overlay = $("credits-overlay");
    $("title-credits-btn").addEventListener("click", openCredits);
    $("credits-close-btn").addEventListener("click", closeCredits);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) closeCredits(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.style.display === "flex") closeCredits();
    });
  }

  /** Dismissal wiring for the map context menu: registered ONCE at bootstrap
   *  (safe pre-game -- both listeners no-op until viewState.ringMenu is
   *  actually set), rather than re-registering a fresh document listener
   *  every redraw(). A click anywhere outside the menu itself, or Escape,
   *  closes it without acting -- picking an option is the only thing that
   *  DOES act (see handleContextMenuAction). */
  function setupContextMenuDismissal() {
    // Pointer, not mouse: a real touch tap's pointerup (which opens the ring
    // -- see input.js's endPointer) is followed by a browser-synthesized
    // compatibility mousedown/click for legacy web compat. That ghost
    // mousedown targets whatever was physically touched (the canvas), never
    // the ring itself, so a mousedown listener here would see it as an
    // outside click and slam the ring shut milliseconds after opening it.
    // Pointer Events don't have that ghost-duplication problem -- one real
    // gesture is exactly one pointerdown (2026-08-27, mobile single-tap ring
    // menu closing itself instantly on real touchscreens).
    document.addEventListener("pointerdown", (e) => {
      if (!viewState || !viewState.ringMenu) return;
      const root = $("map-context-menu-root");
      if (root && root.contains(e.target)) return; // let the menu's own click-through happen
      viewState.ringMenu = null;
      redraw();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !viewState || !viewState.ringMenu) return;
      // Two-level: a ring showing a sub-page (the build list, the level-up
      // picker) backs out to the ring itself first, so Escape never throws
      // away more context than the player expected.
      if (viewState.ringMenu.page) viewState.ringMenu.page = null;
      else viewState.ringMenu = null;
      redraw();
    });
  }

  /** Global "click" sfx: ANY button anywhere in the app plays
   *  system_button_click.mp3 -- registered ONCE, on `document`, using event
   *  bubbling, rather than wiring it into every individual button's own
   *  onclick. This is deliberately the only way to satisfy "any time a
   *  button is clicked": most buttons here are rebuilt from scratch on every
   *  innerHTML redraw (sidebar, dialogs, tech tree, the map context menu,
   *  ...), so a per-button listener would have to be re-registered on every
   *  single rebuild and would be trivial to miss one of.
   *  e.target.closest("button") catches a click landing on a button's own
   *  child element (an icon/span inside it) too, not just the exact node. A
   *  disabled button never fires a click event at all, so those are already
   *  excluded for free. */
  function setupButtonClickSfx() {
    document.addEventListener("click", (e) => {
      if (e.target.closest("button")) window.SfxSystem.playButtonClick();
    });
  }

  const LOADING_STATUS_PHRASES = [
    "Loading terrain...", "Loading sprites...", "Loading music...",
    "Loading sound effects...", "Rolling the dice...", "Almost there...",
  ];
  function showLoadingScreen() {
    $("loading-screen").style.display = "flex";
    let i = 0;
    $("loading-status-text").textContent = LOADING_STATUS_PHRASES[0];
    loadingStatusTimer = setInterval(() => {
      i = (i + 1) % LOADING_STATUS_PHRASES.length;
      $("loading-status-text").textContent = LOADING_STATUS_PHRASES[i];
    }, 1400);
    for (const key of ["sprites", "music", "sfx"]) setLoadingProgress(key, 0, 1);
  }
  /** Updates one of the three loading-screen progress bars (see index.html's
   *  loading-progress-list). done/total of 0/0 (nothing to load, e.g. sfx
   *  library entirely absent) reads as 100% rather than NaN. */
  function setLoadingProgress(key, done, total) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 100;
    const fillEl = $(`loading-progress-${key}`);
    const pctEl = $(`loading-progress-${key}-pct`);
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (pctEl) pctEl.textContent = `${pct}%`;
  }
  function hideLoadingScreen() {
    $("loading-screen").style.display = "none";
    if (loadingStatusTimer) { clearInterval(loadingStatusTimer); loadingStatusTimer = null; }
  }

  function startGame() {
    spectatorMode = $("spectator-toggle").checked;
    const checkedSpectatorRaces = [...document.querySelectorAll(".spectator-race-checkbox:checked")].map((cb) => cb.value);
    if (spectatorMode && checkedSpectatorRaces.length < 2) {
      window.alert("Select at least 2 races to spectate.");
      return;
    }
    const opponentCount = parseInt($("opponent-count").value, 10);
    applyGameSpeed(GAME_SPEED_LEVELS[parseInt($("game-speed-slider").value, 10)].percent);
    // Universal -- applies in Spectator mode too, not just Single Player,
    // same as Game Speed/Max Monsters above. MUST run before createNewGame
    // below: the difficulty head start (free combat tech + bonus units) is
    // read at world creation, not per-turn.
    applyDifficulty(parseInt($("difficulty-slider").value, 10));
    const monsterCapPerKingdom = parseInt($("monster-cap-slider").value, 10);
    const worldType = WORLD_TYPE_SLIDER_VALUES[parseInt($("world-type-slider").value, 10)];
    const seedInput = $("seed-input").value.trim();
    const seed = seedInput ? (parseInt(seedInput, 10) || hashStringToSeed(seedInput)) : Math.floor(Math.random() * 1e9);
    if (spectatorMode) console.log(`[spectator] map seed: ${seed}`);

    const shuffledRaces = [...RACE_LIST].sort(() => Math.random() - 0.5);
    let racesInPlay;
    if (spectatorMode) {
      racesInPlay = checkedSpectatorRaces;
      humanCivId = null;
    } else {
      const humanRace = $("human-race-select").value;
      const others = shuffledRaces.filter((r) => r !== humanRace).slice(0, opponentCount);
      racesInPlay = [humanRace, ...others];
      humanCivId = humanRace.toUpperCase();
    }

    gameState = createNewGame(racesInPlay, seed, monsterCapPerKingdom, worldType);
    // Territorial Victory toggle (2026-09-02, user-directed): reuses the
    // exact flag "Keep Fighting!" already sets mid-game when a human
    // player declines a territorial win (see turns.js's checkVictory,
    // dialog.js) -- unchecking this here just sets that same flag UP
    // FRONT instead of reactively, so Elimination becomes the only way to
    // win from turn 1. A plain gameState boolean, so save/load round-trips
    // it for free through savegame.js's generic JSON walk -- no special
    // handling needed there.
    gameState.disableTerritorialVictory = !$("territorial-victory-toggle").checked;
    // createNewGame leaves visibility empty -- without this, nothing is
    // visible (full fog) until the first End Turn runs beginRound.
    window.GameEngine.turns.refreshVisibility(gameState);
    updateMapSeedLabel();
    viewState = {
      scrollX: 0, scrollY: 0, zoomLevel: 1.0, showInfluence: true, showGrid: true,
      // Interface menu's "End Turn Reminders" checkbox -- gates
      // handleEndTurnClick's confirmEndTurn dialog entirely when off, a
      // non-persisted per-session setting (not part of the save file).
      endTurnRemindersEnabled: true,
      selectedUnit: null, selectedCity: null, selectedTile: null, humanCivId,
      // Tabbed tile inspector -- the selected* fields above are derived from
      // this now (see input.js's SELECTION MODEL).
      selection: null,
      // Read-only peek at some OTHER tile, shown in the sidebar in place of
      // (never alongside) the real selection above -- see input.js's INSPECT
      // doc comment. Cleared automatically the moment a real (re)selection
      // happens, so this never needs explicit resetting on its own.
      inspect: null,
      is3D: false, // 2D-only for now -- see render3d.js; the Interface menu's "Toggle 3D View" button was removed
      fogMode: "off", fogCivIds: new Set(Object.keys(gameState.civs)), // spectator-only; see setupFogControls
      tileScoreCivId: null, // Interface menu's Tile City Score overlay -- available in both spectator and human modes
      dialog: null, // in-game confirm/prompt/alert replacement -- see js/ui/dialog.js
      // Stashed gameOver dialog while the Influence report is open on top of
      // it -- see openGameOverDialog's onViewInfluenceReport and
      // reports-close-btn's handler, which hands it back.
      dialogBeforeReport: null,
      turnBanner: null, // "<Race> Kingdom Taking Its Turn..." -- see advanceTurn()
      // { x, y, start } while a jump-to-tile link's brief highlight is
      // animating -- see goToTile/render.js's drawTileFlash.
      tileFlash: null,
      // Radial map menu -- { x, y, subject, page } while open. Declared here
      // rather than only set lazily so the field is discoverable alongside
      // the rest of the view model; the load path below must declare it
      // too, or a loaded game keeps whatever the previous one had.
      ringMenu: null,
      // Deferred callback for the unit-built-notice/pendingIntent chain a
      // tech-completion dialog's "Choose Research" stashes here instead of
      // firing immediately -- see openTechResearchedDialog's onChooseResearch
      // and the tech tree close button that reads/clears this.
      onTechTreeClosed: null,
    };

    beginGameScreenTransition(racesInPlay);
  }

  /**
   * Shared tail of "leave the title screen and actually get into a game" --
   * used by both a fresh New Game (startGame, above) and a save loaded
   * straight from the title screen (startGameFromSave, below). Both callers
   * have already fully populated gameState/viewState/humanCivId/
   * spectatorMode by the time this runs; all this does is hide the title
   * screen, preload every asset the given races need, and hand off to
   * finishStartGame once that settles.
   *
   * Sprites/music/sfx are all real network loads (hundreds of small requests
   * under connection-limit contention can take up to ~15-20s -- see
   * render3d.js's own notes on this). The game screen is gated on all three
   * finishing so the player never sees it with most art/audio still
   * streaming in. Each of these is designed to always resolve, never reject
   * (a missing asset is skipped, not an error -- see preloadAll's/
   * SfxSystem.init's own doc comments), so this isn't expected to hang, but
   * a failsafe timeout still backs it up below in case some future asset
   * type doesn't hold to that.
   */
  function beginGameScreenTransition(racesInPlay) {
    stopTitleMusic();
    $("title-screen").style.display = "none";
    showLoadingScreen();

    const musicPromise = window.MusicSystem.init(racesInPlay, (done, total) => setLoadingProgress("music", done, total)).then(() => {
      window.MusicSystem.setRace(humanCivId ? gameState.civs[humanCivId].raceId : null);
      populateAudioTrackOptions();
    });
    const sfxPromise = window.SfxSystem.init(racesInPlay, (done, total) => setLoadingProgress("sfx", done, total));
    const spritesPromise = window.UI.sprites.preloadAll(racesInPlay, (done, total) => setLoadingProgress("sprites", done, total));
    const LOADING_FAILSAFE_MS = 30000;
    Promise.race([
      Promise.all([musicPromise, sfxPromise, spritesPromise]),
      new Promise((resolve) => setTimeout(resolve, LOADING_FAILSAFE_MS)),
    ]).then(finishStartGame);
  }

  /** Title screen's File > Load Game -- see setupTitleLoadGameControl's own
   *  doc comment for why this is a separate path from the in-game Load
   *  Game's finishApplyLoadedPayload rather than a shared one: gameState/
   *  viewState don't exist yet, so there's nothing to mutate in place, only
   *  to assign fresh -- same shape as startGame's own `gameState =
   *  createNewGame(...)` just above, just fed a save's data instead of a
   *  freshly generated map. */
  function startGameFromSave(payload) {
    gameState = payload.gameState;
    humanCivId = payload.humanCivId;
    spectatorMode = payload.spectatorMode;
    applyGameSpeed(payload.gameSpeedPercent || 100);
    // `difficultyChosen` marks a save written AFTER the Difficulty slider
    // shipped, and is the ONLY way to tell a real player choice from the
    // frozen pre-slider default. Both look like aiDifficulty:"normal" on the
    // wire, and "Normal" now means a HARDER game than the one an old save was
    // actually played under (config.js: Easy is the level reproducing the old
    // balance). So: no marker -> legacy save -> load as Easy, preserving the
    // balance it was played at. Marker present -> honor the stored choice,
    // including a genuine "normal".
    //
    // applyDifficulty re-derives the config index AND re-assigns
    // aiDifficulty, so there is no separate assignment for it here.
    applyDifficulty(payload.difficultyChosen
      ? difficultyIndexFromId(payload.aiDifficulty)
      : 0);
    for (const civ of Object.values(gameState.civs)) civ.isHuman = civ.id === humanCivId;
    updateMapSeedLabel();
    viewState = {
      scrollX: 0, scrollY: 0, zoomLevel: 1.0, showInfluence: true, showGrid: true,
      // Interface menu's "End Turn Reminders" checkbox -- gates
      // handleEndTurnClick's confirmEndTurn dialog entirely when off, a
      // non-persisted per-session setting (not part of the save file).
      endTurnRemindersEnabled: true,
      selectedUnit: null, selectedCity: null, selectedTile: null, humanCivId,
      selection: null,
      inspect: null,
      is3D: false,
      fogMode: "off", fogCivIds: new Set(Object.keys(gameState.civs)),
      tileScoreCivId: null,
      dialog: null, dialogBeforeReport: null, turnBanner: null, ringMenu: null,
      onTechTreeClosed: null,
    };
    const racesInPlay = [...new Set(Object.values(gameState.civs).map((c) => c.raceId))];
    beginGameScreenTransition(racesInPlay);
  }

  /** Runs once loading actually finishes (or the failsafe timeout fires) --
   *  see startGame's Promise.race. Everything here needs either real DOM
   *  layout (setupCanvas's getBoundingClientRect) or fully-loaded assets,
   *  so none of it could safely run before now. */
  function finishStartGame() {
    hideLoadingScreen();
    $("game-screen").style.display = "flex";
    // Phone layout: bottom sheet, FAB, status pill, menu drawer. Wired here
    // rather than at setup because the sheet measures itself on open, and
    // getBoundingClientRect returns zeros while #game-screen is display:none.
    // No-ops on desktop.
    setupMobileShell();
    // Match the two canvases' visibility to viewState.is3D (always false --
    // the 3D toggle was removed, but the 3D canvas elements/renderer are
    // still left in place, so keep them hidden explicitly rather than
    // relying on their CSS defaults).
    $("map-canvas").style.display = viewState.is3D ? "none" : "block";
    $("map-canvas-3d").style.display = viewState.is3D ? "block" : "none";
    $("map-canvas-3d-hud").style.display = viewState.is3D ? "block" : "none";

    // Off-screen units shouldn't play sounds -- e.g. a spectator-mode
    // skirmish happening elsewhere on the map. Uses the exact same
    // on-screen test the renderer itself uses to cull off-screen tiles (see
    // render.js's isTileOnScreen); this is the only place gameState/
    // viewState/canvas are all in scope to wire it up.
    // In 3D mode the 2D canvas is display:none, which makes its own
    // getBoundingClientRect() (and so isTileOnScreen's bounds check)
    // collapse to zero -- every tile would wrongly read as "off-screen" and
    // mute every sound. render3d.js has no equivalent viewport-clipping
    // test yet, so this errs toward always audible in 3D rather than
    // silently muting everything.
    window.SfxSystem.setVisibilityCheck((x, y) =>
      viewState.is3D || window.UI.render.isTileOnScreen(x, y, $("map-canvas"), gameState, viewState));
    window.MusicSystem.setVisibilityCheck((x, y) =>
      viewState.is3D || window.UI.render.isTileOnScreen(x, y, $("map-canvas"), gameState, viewState));

    setupCanvas();
    centerViewOnStart();
    // Cloud layer -- built once per game start, after setupCanvas has sized
    // the canvas so the initial scatter covers the real viewport. Purely
    // cosmetic; see js/ui/clouds.js.
    window.UI.clouds.init($("map-canvas").width, $("map-canvas").height);
    window.UI.input.attach($("map-canvas"), gameState, viewState, redraw);
    // 3D click-to-select needs to trigger the exact same post-selection
    // refresh a 2D click does -- not just re-rendering the sidebar's HTML,
    // but re-wiring its action buttons too (redraw() does both; see its
    // body below). Handing it the whole function once, rather than just
    // "render the sidebar", keeps that button-wiring logic in one place.
    window.UI.render3d.setRedrawCallback(redraw);
    $("influence-toggle-btn").addEventListener("click", () => {
      viewState.showInfluence = !viewState.showInfluence;
      redraw();
    });
    $("grid-toggle-btn").addEventListener("click", () => {
      viewState.showGrid = !viewState.showGrid;
      redraw();
    });
    // "End Turn Reminders": checked/on by default, matching
    // viewState.endTurnRemindersEnabled's own default -- synced here in case
    // a page reload or a loaded save left the checkbox's own DOM state stale
    // from a previous session's toggle.
    const endTurnRemindersToggle = $("end-turn-reminders-toggle");
    endTurnRemindersToggle.checked = viewState.endTurnRemindersEnabled;
    endTurnRemindersToggle.addEventListener("change", () => {
      viewState.endTurnRemindersEnabled = endTurnRemindersToggle.checked;
    });
    $("report-influence-btn").addEventListener("click", () => {
      viewState.reportView = "influence";
      redraw();
    });
    $("report-power-btn").addEventListener("click", () => {
      viewState.reportView = "power";
      redraw();
    });
    $("report-ai-actions-btn").addEventListener("click", () => {
      viewState.reportView = "ai_actions";
      redraw();
    });
    $("report-ai-tech-trees-btn").addEventListener("click", () => {
      viewState.reportView = "ai_tech_trees";
      redraw();
    });
    $("zoom-in-btn").addEventListener("click", () => adjustZoom(1.25));
    $("zoom-out-btn").addEventListener("click", () => adjustZoom(0.8));
    setupMenuBar();
    setupFullscreenControl();
    setupAudioControls();
    setupSpectatorControls(); // wired unconditionally -- a loaded save can switch modes later
    setupFileControls();
    setupFogControls();
    setupTileScoreControls();
    updateSpeedMenuVisibility();
    updateFogMenuVisibility();
    updateAiReportsMenuVisibility();

    if (spectatorMode) startAutoplay();

    redraw();
    startAnimationLoop();
  }

  function hashStringToSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  function createNewGame(raceIds, seed, monsterCapPerKingdom, worldType) {
    const { width: mapWidth, height: mapHeight } = mapSizeForCivCount(raceIds.length);
    const map = window.GameEngine.worldgen.generateMap(mapWidth, mapHeight, seed, worldType, raceIds.length);
    const MIN_STARTING_ISLAND_SIZE = 8;
    // A civ that starts on a landmass smaller than this gets a free Galley
    // in place of its second starting Scout (see the starting-unit loop
    // below) -- a small island has little left to explore with a second
    // land Scout, but getting off it at all is a much bigger deal. Well
    // above MIN_STARTING_ISLAND_SIZE (the bar for even being a legal start
    // at all) -- this is about "cramped," not "barely valid."
    const SMALL_LANDMASS_GALLEY_THRESHOLD = 25;
    // Islands under the minimum size are still real, explorable/settleable
    // land (worldgen only erases landmasses under 3 tiles entirely) -- they're
    // just excluded from the pool a civ can START on. Falls back to the full,
    // unfiltered list in the (extreme, shouldn't-happen-on-a-normal-map) case
    // where every single landmass is smaller than the minimum, so civ
    // creation never has zero landmasses to choose from.
    const eligibleLandmasses = map.landmasses.filter((lm) => lm.length >= MIN_STARTING_ISLAND_SIZE);
    const landmasses = (eligibleLandmasses.length > 0 ? eligibleLandmasses : map.landmasses)
      .slice().sort((a, b) => b.length - a.length);
    // Round-robin assignment already avoids sharing a landmass between
    // civs until forced to by civ count exceeding landmass count -- there's
    // no way to avoid sharing when raceIds.length exceeds landmasses.length.
    // Known limitation: once two civs DO share a small landmass, the 3-tile
    // city-spacing rule (cities.js MIN_CITY_SPACING) can leave the second
    // civ very little room to settle there, sometimes none. Worth a smarter
    // fairness pass later (e.g. preferring bigger landmasses for the
    // share-forced civs) but out of scope for now.

    const civs = {};
    let landmassIdx = 0;
    for (const raceId of raceIds) {
      const civId = raceId.toUpperCase();
      const civ = {
        id: civId, raceId, cities: [], units: [], eliminated: false,
        // isHuman is the only human/AI marker readable from deep inside
        // ai.js's combat-resolution call sites (grantXPAndAutoLevel/
        // applyComputedXP), which never receive viewState.humanCivId the
        // way the UI/orders.js layer does -- see applyComputedXP's use of it
        // to skip auto-picking a human unit's veteran bonus. humanCivId
        // (this closure's own copy) is already set by startGame() before
        // createNewGame runs; null in spectator mode, which correctly makes
        // isHuman false for every civ.
        isHuman: civId === humanCivId,
        completedTechs: new Set(), currentResearch: null,
        doctrine: null, // grand-strategy layer -- see engine/strategy.js
        // Each race's 4 buildings are gated by that race's tech tree (see
        // techs.js building-column nodes) rather than unlocked at civ
        // creation. unlockedUnits/unlockedBuildings start EMPTY -- Pioneer/
        // Galley/Scout/Wall all come from the Level 0 techs' own effects
        // just below instead of a hardcoded starting set.
        unlockedUnits: new Set(),
        unlockedBuildings: new Set(),
        civicInfluenceBonus: 0, radiusBonus: 0, usedCityNames: [],
        // Every kingdom starts with a flat stockpile of all three resources --
        // see config.js's units.startingHarvest/startingCoin/startingLore.
        stockpile: {
          harvest: window.GameConfig.units.startingHarvest,
          coin: window.GameConfig.units.startingCoin,
          lore: window.GameConfig.units.startingLore,
        },
      };
      // LEVEL 0: every layer-0 tech for this race is auto-completed for free
      // at creation -- computed dynamically (by layer, not a hardcoded id
      // list) so any future Level 0 tech is automatically free too, matching
      // the design rule "Level 0 = always granted, never researched."
      // Notably, race.startingTech (each race's own signature Layer-1 combat
      // unit -- Raider, Spearguard, etc.) is deliberately NOT auto-completed
      // here; it's a normal tech that has to actually be researched, same as
      // everything else at its layer. Scout is the civ's only quasi-combat
      // capability until that finishes.
      const levelZeroTechs = window.GameData.techsForRace(raceId)
        .filter((id) => window.GameData.getTech(id).layer === 0);
      for (const techId of levelZeroTechs) {
        civ.completedTechs.add(techId);
        window.GameEngine.tech.applyTechEffects(civ, window.GameData.getTech(techId));
      }

      // Game Difficulty head start (2026-08-31, user-directed). AI civs only
      // -- civ.isHuman is assigned just above, so the human always reads the
      // identity level and starts with exactly the loadout described in the
      // comment above this block.
      //
      // grantsStartingTech reverses precisely the decision that comment
      // documents, and only for the AI: it hands over race.startingTech so an
      // AI kingdom can build its signature fighter from turn 1 instead of
      // spending its first several turns researching the ability to. That is
      // also what makes bonusStartingUnits possible at all -- until this
      // lands, a civ's only unlocked units are Pioneer/Scout/Galley, so there
      // is no military unit for the unit grant below to pick.
      const dLevels = window.GameConfig.difficulty.levels;
      const dLevel = civ.isHuman
        ? dLevels[0]
        : (dLevels[window.GameConfig.difficulty.levelIndex] ?? dLevels[1]);
      const startingTech = window.GameData.getRace(raceId).startingTech;
      if (dLevel.grantsStartingTech && startingTech
          && !civ.completedTechs.has(startingTech)) {
        window.GameEngine.tech.grantFreeTech(civ, startingTech);
      }
      // Registered in `civs` before the starting units below so
      // buildOccupancySet/findClosestOpenPlacementTile can see THIS civ's
      // own starting units as they're placed one at a time -- harmless for
      // pickStartSpot's own spacing check just below, since an empty
      // units/cities civ can never self-conflict.
      civs[civId] = civ;

      const spot = pickStartSpot(landmasses, landmassIdx, map, civs, raceId);
      landmassIdx++;
      // startingUnit exempts this free starting Pioneer from ongoing upkeep
      // -- same one-time perk on this specific instance as the starting
      // Scouts/Galley below. A Pioneer BUILT later (via the normal
      // build-queue path) still costs upkeep normally.
      const settler = { typeId: "pioneer", civId, x: spot.x, y: spot.y, isCivilian: true, startingUnit: true };
      window.GameEngine.combat.initUnitHP(settler, civ);
      civ.units.push(settler);

      // Every race starts with 2 Scouts (not just Human, which already got
      // one via unlockedUnits above) -- fog clears faster and settle sites
      // turn up sooner. Not gated on the "scout" unlock -- these are handed
      // out directly, same as the Pioneer above, independent of whether the
      // civ could build MORE scouts yet.
      //
      // A civ starting on a small island gets far less mileage out of a
      // second land Scout (there's only so much of a tiny island left to
      // explore) than it would out of being able to get off the island at
      // all -- so its SECOND starting unit is a free Galley instead, not a
      // second Scout. The first Scout is unconditional for every civ
      // (fog-clearing still matters even on a small island).
      const startingScoutCount = spot.landmassSize < SMALL_LANDMASS_GALLEY_THRESHOLD ? 1 : 2;
      for (let i = 0; i < startingScoutCount; i++) {
        // These free starting units cost no upkeep, ever -- a one-time perk
        // on these specific instances, not a blanket Scout/Galley-type
        // exemption. Anything built later (via the normal chooseBuildAction/
        // canAffordUnitUpkeep path) never gets this flag and costs upkeep
        // like any other unit. See GameData.unitUpkeep.
        //
        // Placed adjacent to the pioneer, not stacked on top of it --
        // recomputed fresh each iteration so the SECOND scout also avoids
        // the first one's just-claimed tile. Falls back to the pioneer's
        // own tile only if every neighbor is somehow blocked (vanishingly
        // unlikely at turn 0 on open land).
        const occupied = window.GameEngine.ai.buildOccupancySet(civs, null);
        const scoutSpot = window.GameEngine.ai.findClosestOpenPlacementTile(spot.x, spot.y, map, civs, occupied, civId)
          || { x: spot.x, y: spot.y };
        const scout = { typeId: "scout", civId, x: scoutSpot.x, y: scoutSpot.y, isCivilian: true, startingUnit: true };
        window.GameEngine.combat.initUnitHP(scout, civ);
        civ.units.push(scout);
      }
      if (spot.landmassSize < SMALL_LANDMASS_GALLEY_THRESHOLD) {
        // Naval units must spawn on water -- same fallback chain
        // spawnUnitInCity uses for a built Galley, since a small island's
        // starting tile itself is never actually water.
        const waterSpot = window.GameEngine.ai.findAdjacentWater(spot.x, spot.y, map)
          || window.GameEngine.ai.findNearestCoastalWaterFor(spot.x, spot.y, map, 15);
        if (waterSpot) {
          const galley = { typeId: "galley", civId, x: waterSpot.x, y: waterSpot.y, isCivilian: false, startingUnit: true };
          window.GameEngine.combat.initUnitHP(galley, civ);
          civ.units.push(galley);
        }
      }

      // Game Difficulty head start, second half: bonus military units for AI
      // civs (dLevel resolved above -- the identity level for the human, so
      // this is a no-op for the player).
      //
      // Depends on grantsStartingTech having run above: it is what puts a
      // buildable land fighter in unlockedUnits at all. Guarded on `pick`
      // anyway, so a level with bonusStartingUnits but no starting tech
      // silently grants nothing instead of throwing.
      //
      // Placed last so the occupancy search sees the Pioneer, Scouts and
      // Galley already down. startingUnit:true matches every other free
      // starting unit -- upkeep-exempt, since a turn-0 civ has no income yet.
      const bonusUnits = dLevel.bonusStartingUnits || 0;
      if (bonusUnits > 0) {
        const pick = [...civ.unlockedUnits].find((id) => {
          const ud = window.GameData.getUnit(id);
          return ud && ud.category === "military" && !ud.isNaval && ud.cityBuildable !== false;
        });
        if (pick) {
          for (let i = 0; i < bonusUnits; i++) {
            const occupied = window.GameEngine.ai.buildOccupancySet(civs, null);
            const spawnSpot = window.GameEngine.ai.findClosestOpenPlacementTile(spot.x, spot.y, map, civs, occupied, civId)
              || { x: spot.x, y: spot.y };
            const unit = { typeId: pick, civId, x: spawnSpot.x, y: spawnSpot.y, isCivilian: false, startingUnit: true };
            window.GameEngine.combat.initUnitHP(unit, civ);
            civ.units.push(unit);
          }
        }
      }
    }

    // Turn order: decided once, randomly, at game start -- then fixed for the
    // rest of the game (never reshuffled turn to turn). Drives both the
    // full-round runTurn and the granular advanceOneUnitStep in turns.js.
    const turnOrder = Object.keys(civs);
    for (let i = turnOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
    }

    const gameState = {
      map, civs, turnNumber: 0, visibility: {}, explored: {}, tileMemory: {},
      turnOrder, turnStepIndex: 0, seed, aiActionLog: [],
      // Victory-stats screen's "Total Time Taken" (2026-08-19, user-
      // directed) -- real wall-clock time, not active-play time; a save
      // reloaded later just resumes counting from whenever the game was
      // first created, same as a save file's own age would read. Plain
      // JSON.stringify-able number, so savegame.js's generic round-trip
      // preserves it with no special-casing needed (see that file's own
      // doc comment on what DOES need special handling).
      startedAt: Date.now(),
      // Game Options "Max Monsters" slider:
      // per-game override of config.js's worldEncounters.monsters.
      // perKingdomCap -- see ai.js's maybeSpawnMonster/seedInitialMonsters,
      // which both read this instead of the config default. Falls back to
      // the config default (via ?? at each read site) if omitted, so a
      // headless __sim.newGame call with no third argument still works.
      monsterCapPerKingdom: monsterCapPerKingdom ?? window.GameConfig.worldEncounters.monsters.perKingdomCap,
    };
    // World-gen-time Wandering Monster seeding -- see ai.js's
    // seedInitialMonsters for placement rules. Deliberately after the civs
    // above are fully placed, not before: it needs every civ's starting
    // units already on the map to keep its own placements clear of them.
    window.GameEngine.ai.seedInitialMonsters(gameState);
    return gameState;
  }

  /**
   * Picks a starting tile for a new pioneer. Tries the round-robin-preferred
   * landmass first (for landmass diversity across civs), but the 8-tile
   * separation requirement is enforced across ALL eligible landmasses, not
   * just the preferred one -- two civs assigned to different but nearby
   * small islands could otherwise end up only a few tiles apart across open
   * water (raw chebyshev distance doesn't know about land/water), silently
   * violating separation. Falling through to the next-best landmass instead
   * of relaxing the requirement on the preferred one fixes that. Only if
   * NO eligible landmass anywhere has a spot satisfying separation (far more
   * civs than the map can fit that way) does it fall back to relaxing the
   * requirement, on the originally preferred landmass, rather than fail to
   * place the civ at all.
   */
  // Racial terrain preference: a civ should
  // start somewhere that plays to its own tech-tree identity, mirroring the
  // terrain each race's civic techs actually key off. Dwarf can never start
  // ON Mountains at all (see scoreLocation's hard exclusion below), so
  // Hills -- its next-closest thematic terrain, and the terrain several of
  // its own techs key off too -- stands in for it. Undead has no terrain-
  // keyed tech at all (its bonuses are ruin/kill-based) -- omitted here on
  // purpose, no preference bonus ever applies to it.
  const RACE_PREFERRED_TERRAIN = {
    elf: ["forest"],
    dwarf: ["hills"],
    orc: ["swamp"],
    halfellow: ["hills"],
    human: ["plains"],
  };
  // Races whose tech tree also has a river-keyed bonus -- boosts the
  // (already-universal, smaller) river bonus below rather than introducing
  // a wholly separate scoring term.
  const RACE_PREFERS_RIVER = new Set(["halfellow", "human", "elf"]);

  function pickStartSpot(landmasses, preferredIdx, map, existingCivs, raceId) {
    const MIN_SEPARATION = 8; // chebyshev distance floor from every other starting pioneer
    const SCORE_RADIUS = 3;
    // How much weight actively maximizing distance from the nearest rival
    // carries, on top of the MIN_SEPARATION floor above (2026-07-18, user-
    // directed: "as far away from other civs as possible", not merely
    // "far enough") -- capped so it meaningfully breaks ties between
    // otherwise-similar sites without letting a merely-adequate site far
    // out in the middle of nowhere beat a genuinely great one nearby.
    const DISTANCE_BONUS_WEIGHT = 0.8;
    const DISTANCE_BONUS_CAP = 40;

    const preferredTerrain = RACE_PREFERRED_TERRAIN[raceId];
    const prefersRiver = RACE_PREFERS_RIVER.has(raceId);

    function tileYield(t) {
      const y = window.GameData.TERRAIN[t.terrain].yield || {};
      return (y.harvest || 0) + (y.coin || 0) + (y.lore || 0);
    }

    function scoreLocation(t) {
      // Can't start on water, mountains, or tundra
      const terrain = window.GameData.TERRAIN[t.terrain];
      if (terrain.isWater || t.terrain === "mountains" || t.terrain === "tundra") return -Infinity;
      let score = tileYield(t);
      if (preferredTerrain && preferredTerrain.includes(t.terrain)) score += 12;
      // Add yield of surrounding tiles within radius
      for (let dy = -SCORE_RADIUS; dy <= SCORE_RADIUS; dy++) {
        for (let dx = -SCORE_RADIUS; dx <= SCORE_RADIUS; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = t.x + dx, ny = t.y + dy;
          if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
          const nt = map.tiles[ny * map.width + nx];
          score += tileYield(nt) * 0.5;
          if (nt.resource) score += 4;
          if (preferredTerrain && preferredTerrain.includes(nt.terrain)) score += 1.5;
          if (nt.hasRiver && (nt.hasRiver.n || nt.hasRiver.s || nt.hasRiver.e || nt.hasRiver.w)) {
            score += prefersRiver ? 2.5 : 1;
          }
        }
      }
      // Coastal bonus
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = t.x + dx, ny = t.y + dy;
        if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
        if (window.GameData.TERRAIN[map.tiles[ny * map.width + nx].terrain].isWater) { score += 3; break; }
      }
      return score;
    }

    function sampleOf(landmass) {
      // Up to 80 random tiles to keep scoring fast on large landmasses
      return landmass.length <= 80
        ? landmass
        : Array.from({ length: 80 }, () => landmass[Math.floor(Math.random() * landmass.length)]);
    }

    function nearestRivalDist(t) {
      let best = Infinity;
      for (const civ of Object.values(existingCivs)) {
        for (const u of civ.units) {
          const d = window.GameEngine.influence.chebyshev(t.x, t.y, u.x, u.y);
          if (d < best) best = d;
        }
      }
      return best;
    }

    function bestSeparatedSpot(landmass) {
      const candidates = sampleOf(landmass)
        .map((idx) => ({ t: map.tiles[idx], score: scoreLocation(map.tiles[idx]) }))
        .filter(({ score }) => isFinite(score))
        .map(({ t, score }) => ({ t, score, dist: nearestRivalDist(t) }))
        .filter(({ dist }) => dist >= MIN_SEPARATION) // MIN_SEPARATION floor (Infinity for the first civ trivially passes)
        .map(({ t, score, dist }) => ({ t, score: score + Math.min(dist, DISTANCE_BONUS_CAP) * DISTANCE_BONUS_WEIGHT }))
        .sort((a, b) => b.score - a.score);
      return candidates.length > 0 ? candidates[0].t : null;
    }

    const preferred = landmasses[preferredIdx % landmasses.length];
    let spot = bestSeparatedSpot(preferred);
    if (spot) return { x: spot.x, y: spot.y, landmassSize: preferred.length };

    for (const lm of landmasses) {
      if (lm === preferred) continue;
      spot = bestSeparatedSpot(lm);
      if (spot) return { x: spot.x, y: spot.y, landmassSize: lm.length };
    }

    // Absolute last resort: no landmass anywhere has a spot satisfying
    // separation. Relax the requirement on the preferred landmass.
    const fallback = sampleOf(preferred)
      .map((idx) => ({ t: map.tiles[idx], score: scoreLocation(map.tiles[idx]) }))
      .filter(({ score }) => isFinite(score))
      .sort((a, b) => b.score - a.score);
    if (fallback.length > 0) return { x: fallback[0].t.x, y: fallback[0].t.y, landmassSize: preferred.length };

    const fb = map.tiles[preferred[0]];
    return { x: fb.x, y: fb.y, landmassSize: preferred.length };
  }

  /** Match #map-canvas's pixel buffer to its CSS layout size, scaled by the
   *  display's pixel ratio. getBoundingClientRect() (and so this) returns all
   *  zeros for a display:none element -- since 3D is now the default view,
   *  the 2D canvas starts out hidden, so this must be re-run when switching
   *  TO 2D as well as on every real window resize, or the 2D canvas stays
   *  stuck at the 0x0 buffer size it captured while hidden (confirmed live:
   *  2D view was solid-blank after toggling away from the 3D default).
   *
   *  DEVICE PIXEL RATIO (2026-08-25, mobile phase 0): this used to size the
   *  buffer in CSS pixels flat, which on a 2-3x phone screen meant every
   *  sprite and label was upscaled by the compositor and visibly soft. The
   *  buffer is now DPR-scaled and the context pre-scaled to match, so all
   *  drawing code keeps working in CSS-pixel coordinates and nothing
   *  downstream (screenToTile, the ring menu's tile anchoring, hit testing)
   *  has to know this happened.
   *
   *  The old comment's warning still holds and is why both canvases scale
   *  TOGETHER: #map-clouds is layered pixel-for-pixel over the map, so if the
   *  two ever disagree the cursor hole lands offset from the actual cursor.
   *
   *  Capped at 2x deliberately. A 3x phone would be asked to fill 9x the
   *  pixels of a 1x screen for a difference nobody can see at arm's length,
   *  and this canvas is fully repainted every frame.
   *
   *  Guarded against no-op resizes. Assigning canvas.width ALWAYS clears the
   *  canvas and reallocates the buffer even when the value is unchanged, so
   *  an unconditional write here (this runs on every resize event, and mobile
   *  browsers fire those continuously as their chrome slides in and out)
   *  produces exactly the repaint-every-frame flicker the project's
   *  no-flashing rule exists to prevent. */
  const MAX_CANVAS_DPR = 2;
  function resizeMapCanvas() {
    const canvas = $("map-canvas");
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(MAX_CANVAS_DPR, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));

    const cloudCanvas = $("map-clouds");
    const unchanged = canvas.width === w && canvas.height === h
      && (!cloudCanvas || (cloudCanvas.width === w && cloudCanvas.height === h));
    if (unchanged) return;

    canvas.width = w;
    canvas.height = h;
    // Pre-scale so every drawing call downstream still speaks CSS pixels.
    canvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
    // ...and publish that logical size, because canvas.width no longer IS it.
    // Screen-space math (scroll clamping, off-screen culling, centring, ring
    // anchoring) has to keep working in the same CSS-pixel space the context
    // draws in -- see render.js's cssW/cssH, which read these.
    canvas.__cssW = rect.width;
    canvas.__cssH = rect.height;
    if (cloudCanvas) {
      cloudCanvas.width = w;
      cloudCanvas.height = h;
      cloudCanvas.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
      cloudCanvas.__cssW = rect.width;
      cloudCanvas.__cssH = rect.height;
    }
    redraw();
  }

  function setupCanvas() {
    window.addEventListener("resize", resizeMapCanvas);
    // Size synchronously now so callers right after setupCanvas() (namely
    // centerViewOnStart) see real canvas.width/height instead of the stale
    // pre-layout default -- getBoundingClientRect() forces a layout, so this
    // is accurate even though game-screen's display was just flipped to flex.
    resizeMapCanvas();
    // Extra safety net in case layout still settles after this tick.
    requestAnimationFrame(resizeMapCanvas);
  }

  function centerViewOnStart() {
    const canvas = $("map-canvas");
    // Scaled by the current zoom, same as centerViewOn/render's own math --
    // this used to use the raw TILE_SIZE, which silently mis-centered the
    // opening view by the zoom factor whenever zoomLevel wasn't exactly 1.
    const ts = window.UI.render.TILE_SIZE * (viewState.zoomLevel || 1);
    // Find the human civ's starting settler, or fall back to map center
    let focusX = gameState.map.width / 2;
    let focusY = gameState.map.height / 2;
    if (humanCivId) {
      const civ = gameState.civs[humanCivId];
      const unit = civ && civ.units[0];
      if (unit) { focusX = unit.x; focusY = unit.y; }
    }
    // CSS-pixel size, not the DPR-scaled buffer size -- see resizeMapCanvas
    // and centerViewOn's identical fallback. Using the raw backing-store
    // canvas.width/height here (pre-2026-08-27) silently over-scrolled on
    // any HiDPI screen, leaving the starting Pioneer stranded off toward a
    // corner instead of centered.
    const cssW = canvas.__cssW || canvas.width;
    const cssH = canvas.__cssH || canvas.height;
    viewState.scrollX = Math.max(0, (focusX + 0.5) * ts - cssW / 2);
    viewState.scrollY = Math.max(0, (focusY + 0.5) * ts - cssH / 2);
  }

  /** Menu-bar zoom in/out buttons -- same clamp and cursor/anchor-relative
   *  math as input.js's Ctrl+scroll zoom, just anchored on the viewport's
   *  center instead of the mouse position (a button click has no cursor
   *  location on the map to anchor to). render()'s own clampOffset call
   *  keeps the resulting scroll in bounds regardless of anchor point. */
  function adjustZoom(factor) {
    const canvas = $("map-canvas");
    const { MIN_ZOOM, MAX_ZOOM } = window.UI.render;
    const oldZoom = viewState.zoomLevel || 1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor));
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const scrollX = viewState.scrollX || 0, scrollY = viewState.scrollY || 0;
    viewState.scrollX = (cx + scrollX) * (newZoom / oldZoom) - cx;
    viewState.scrollY = (cy + scrollY) * (newZoom / oldZoom) - cy;
    viewState.zoomLevel = newZoom;
    redraw();
  }

  /**
   * Wires the top-left menu bar (File / Interface / Audio / Speed): each
   * menu button toggles its own dropdown, closing any other open one, and
   * clicking anywhere outside the menu bar closes whatever's open. Individual
   * dropdown contents (audio controls, speed buttons, etc.) are wired by
   * their own setup functions -- this only owns open/close behavior.
   */
  function setupMenuBar() {
    const menus = [
      { btn: $("menu-file-btn"), dropdown: $("menu-file-dropdown") },
      { btn: $("menu-interface-btn"), dropdown: $("menu-interface-dropdown") },
      { btn: $("menu-audio-btn"), dropdown: $("menu-audio-dropdown") },
      { btn: $("menu-knowledge-btn"), dropdown: $("menu-knowledge-dropdown") },
      { btn: $("menu-report-btn"), dropdown: $("menu-report-dropdown") },
      { btn: $("menu-speed-btn"), dropdown: $("menu-speed-dropdown") },
    ];
    const bar = menus[0].btn.closest(".menu-bar");
    function closeAll() {
      for (const m of menus) { m.dropdown.style.display = "none"; m.btn.classList.remove("active"); }
    }
    for (const m of menus) {
      m.btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = m.dropdown.style.display === "none";
        closeAll();
        if (willOpen) { m.dropdown.style.display = "flex"; m.btn.classList.add("active"); }
        forceReflow(bar);
      });
    }
    // Dropdown contents (speed buttons, audio slider, etc.) are wired by their
    // own setup functions and don't stopPropagation on their own clicks -- without
    // this, every click inside an open dropdown bubbles to the document listener
    // below and closes the menu it was just clicked in.
    // Scoped via .closest() rather than document.querySelector(".menu-bar")
    // (2026-08-12) -- the title screen now has its own separate .menu-bar
    // (see setupTitleMenuBar), and querySelector would only ever find
    // whichever one comes first in the DOM, silently breaking this one's
    // click-outside handling once the title screen's markup preceded it.
    bar.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", closeAll);
  }

  /** Shows/hides the Speed menu item -- only meaningful in spectator mode
   *  (human-mode turns advance via the End Turn button, not autoplay).
   *  Called at game start and again after loading a save, since a save can
   *  switch modes from whatever the page originally started in. */
  function updateSpeedMenuVisibility() {
    $("menu-speed-item").style.display = spectatorMode ? "" : "none";
  }

  /** Shows/hides the Fog of War panel in the Interface menu -- spectator-only,
   *  same reasoning as updateSpeedMenuVisibility. In human-player games the
   *  map always just shows that civ's own vision (see render.js), so the
   *  panel is irrelevant and hidden. */
  function updateFogMenuVisibility() {
    $("fog-of-war-panel").style.display = spectatorMode ? "" : "none";
  }

  /** Shows/hides the "AI Actions"/"AI Tech Trees" Report menu items --
   *  spectator-only: both reports expose an
   *  opponent's decision-making/tech progress, which is spectator-mode
   *  observability, not something a single-player human should be able to
   *  peek at about their own opponents. Same call-site convention as
   *  updateSpeedMenuVisibility/updateFogMenuVisibility above. */
  function updateAiReportsMenuVisibility() {
    $("report-ai-actions-btn").style.display = spectatorMode ? "" : "none";
    $("report-ai-tech-trees-btn").style.display = spectatorMode ? "" : "none";
  }

  /** Wires the Fog of War panel's mode radios once per page load. Actual
   *  state reset (radio selection, race checkbox list) happens in
   *  resetFogControls, called here and again on every new game/load since
   *  the civ roster changes each time. */
  function setupFogControls() {
    document.querySelectorAll('input[name="fow-mode"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        if (!radio.checked) return;
        viewState.fogMode = radio.value;
        $("fow-race-list").style.display = radio.value === "selected" ? "" : "none";
        redraw();
      });
    });
    resetFogControls();
  }

  /** Resets the Fog of War panel back to "Off" and rebuilds the per-race
   *  checkbox list from the current game's civs (defaulting every race
   *  checked, so switching to "Selected Races" starts equivalent to "All"
   *  until the spectator narrows it down). Called on every new game and
   *  every load, since both can hand us a different civ roster. */
  function resetFogControls() {
    const offRadio = $("fow-mode-off");
    if (offRadio) offRadio.checked = true;
    $("fow-race-list").style.display = "none";

    const list = $("fow-race-list");
    list.innerHTML = "";
    for (const civ of Object.values(gameState.civs)) {
      const race = window.GameData.getRace(civ.raceId);
      const row = document.createElement("label");
      row.className = "audio-panel-row";
      const span = document.createElement("span");
      span.textContent = race.label;
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = viewState.fogCivIds.has(civ.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) viewState.fogCivIds.add(civ.id);
        else viewState.fogCivIds.delete(civ.id);
        redraw();
      });
      row.appendChild(span);
      row.appendChild(checkbox);
      list.appendChild(row);
    }
  }

  /**
   * Wires the Tile City Score overlay (Interface menu): a checkbox toggle
   * plus a race <select>. Unlike the Fog of War panel, this is available in
   * BOTH spectator and human-player games -- no visibility gating -- so the
   * dropdown always lists every civ in the current game, opponents included.
   * viewState.tileScoreCivId is null (off) until the checkbox is both
   * checked AND a race is selected; render.js only draws the overlay then.
   */
  function setupTileScoreControls() {
    $("tile-score-toggle").addEventListener("change", () => {
      const select = $("tile-score-race-select");
      viewState.tileScoreCivId = $("tile-score-toggle").checked ? (select.value || null) : null;
      redraw();
    });
    $("tile-score-race-select").addEventListener("change", (e) => {
      viewState.tileScoreCivId = $("tile-score-toggle").checked ? (e.target.value || null) : null;
      redraw();
    });
    resetTileScoreControls();
  }

  /** Rebuilds the Tile City Score race dropdown from the current game's civs
   *  and resets the toggle off -- called on every new game and every load,
   *  since both can hand us a different civ roster. */
  function resetTileScoreControls() {
    $("tile-score-toggle").checked = false;
    const select = $("tile-score-race-select");
    select.innerHTML = "";
    for (const civ of Object.values(gameState.civs)) {
      const race = window.GameData.getRace(civ.raceId);
      const opt = document.createElement("option");
      opt.value = civ.id;
      opt.textContent = race.label;
      select.appendChild(opt);
    }
  }

  /** Wires the in-game audio panel (mute toggle, volume slider, track picker).
   *  The panel itself is populated with actual track options once
   *  MusicSystem.init() resolves -- see populateAudioTrackOptions. */
  /**
   * Interface menu's Full Screen toggle.
   *
   * Two DIFFERENT fullscreen mechanisms are in play and it's worth being
   * clear about which one this is. F11 is the BROWSER's own fullscreen; the
   * page cannot bind or intercept it (browsers reserve the key), so the
   * "F11" text next to this item is a hint about a key the browser handles,
   * not a shortcut this code registers. The button itself uses the
   * Fullscreen API on <html>, which is a separate mechanism that happens to
   * look identical to the player. Either route triggers `fullscreenchange`
   * often enough to keep the label honest, and the label falls back to
   * re-reading document.fullscreenElement whenever the menu is opened.
   *
   * requestFullscreen() can reject (an iframe without the `allow-fullscreen`
   * permission, or a browser policy that wants a more direct user gesture) --
   * that's caught and logged rather than thrown, since F11 still works.
   */
  function setupFullscreenControl() {
    const btn = $("fullscreen-toggle-btn");
    if (!btn) return;
    const label = btn.querySelector("span");

    function syncLabel() {
      if (label) label.textContent = document.fullscreenElement ? "Exit Full Screen" : "Enter Full Screen";
    }

    btn.addEventListener("click", () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((e) => console.warn(`[fullscreen] exit failed: ${e.message}`));
      } else {
        const req = document.documentElement.requestFullscreen;
        if (!req) {
          console.warn("[fullscreen] Fullscreen API unavailable in this browser -- use F11 instead.");
          return;
        }
        req.call(document.documentElement).catch((e) => {
          console.warn(`[fullscreen] request rejected (${e.name}: ${e.message}) -- F11 still works.`);
        });
      }
    });

    document.addEventListener("fullscreenchange", syncLabel);
    // Opening the menu re-reads the real state, which covers the player
    // having used F11 (browser-level fullscreen doesn't always fire the
    // Fullscreen API's own change event). The button itself now lives in
    // the Keyboard Shortcuts window, not the
    // Interface dropdown -- resync on whichever one the player actually
    // opens next.
    const interfaceBtn = $("menu-interface-btn");
    if (interfaceBtn) interfaceBtn.addEventListener("click", syncLabel);
    const shortcutsBtn = $("keyboard-shortcuts-btn");
    if (shortcutsBtn) shortcutsBtn.addEventListener("click", syncLabel);
    syncLabel();
  }

  function setupAudioControls() {
    // Mute covers BOTH systems (2026-08-03): it used to silence music only,
    // so a "muted" game still had units shouting over every attack -- which
    // reads as the checkbox being broken rather than as a deliberate split.
    // The two VOLUME sliders below stay independent; mute is the one master
    // switch. Music's mute persists (it owns the stored audio settings);
    // sfx's is in-memory and re-derived from the checkbox on load.
    const muteCheckbox = $("audio-mute-checkbox");
    syncAllMuteControls();
    window.SfxSystem.setMuted(muteCheckbox.checked);
    muteCheckbox.addEventListener("change", () => setGlobalMuted(muteCheckbox.checked));

    const volumeSlider = $("audio-volume-slider");
    volumeSlider.value = Math.round(window.MusicSystem.getMusicVolume() * 100);
    volumeSlider.addEventListener("input", () => {
      window.MusicSystem.setMusicVolume(parseInt(volumeSlider.value, 10) / 100);
    });

    const sfxSlider = $("sfx-volume-slider");
    sfxSlider.value = Math.round(window.SfxSystem.getSfxVolume() * 100);
    sfxSlider.addEventListener("input", () => {
      window.SfxSystem.setSfxVolume(parseInt(sfxSlider.value, 10) / 100);
    });

    $("audio-track-select").addEventListener("change", (e) => {
      window.MusicSystem.setManualTrack(e.target.value || null);
    });

    // Now Playing: reflects whatever's actually resolved/playing, kept live
    // via onTrackChange since the track can change from many places (situation
    // change, race change, manual pin, natural loop) without any user click here.
    updateNowPlayingLabel(window.MusicSystem.getCurrentTrackLabel());
    window.MusicSystem.onTrackChange(updateNowPlayingLabel);
  }

  function updateNowPlayingLabel(label) {
    const el = $("now-playing-label");
    if (el) el.textContent = label || "(silence)";
  }

  /** File menu's Map Seed readout -- the seed never changes mid-game, so
   *  this is only ever set once per game (new game or load), unlike the
   *  live-updating Now Playing label above. Older save files predate this
   *  field and won't have `gameState.seed` -- falls back to "unknown"
   *  rather than showing a blank/undefined value. */
  function updateMapSeedLabel() {
    const el = $("map-seed-label");
    if (el) el.textContent = gameState.seed != null ? String(gameState.seed) : "unknown";
  }

  /** Fills the track <select> with every track the startup scan actually
   *  found (plus the "Auto" option already in the markup), and reflects
   *  whichever manual pin (if any) is currently active. */
  function populateAudioTrackOptions() {
    const select = $("audio-track-select");
    for (const track of window.MusicSystem.getAvailableTracks()) {
      const opt = document.createElement("option");
      opt.value = track.key;
      opt.textContent = track.label;
      select.appendChild(opt);
    }
    select.value = window.MusicSystem.getManualTrack() || "";
  }

  function setupSpectatorControls() {
    document.querySelectorAll(".speed-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        spectatorSpeed = parseInt(btn.dataset.speed, 10);
        document.querySelectorAll(".speed-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        restartAutoplay();
      });
    });
    $("spectator-pause-btn").addEventListener("click", () => {
      spectatorPaused = !spectatorPaused;
      $("spectator-pause-btn").textContent = spectatorPaused ? "Resume" : "Pause";
      if (spectatorPaused) clearInterval(autoplayTimer);
      else startAutoplay();
    });
  }

  /** Wires the File menu's Save Game (download a JSON snapshot) and Load
   *  Game (pick a JSON file, replace the running session with it) buttons. */
  function setupFileControls() {
    $("save-game-btn").addEventListener("click", handleSaveGame);
    $("load-game-btn").addEventListener("click", () => $("load-game-file-input").click());
    $("load-game-file-input").addEventListener("change", handleLoadGameFile);
    $("quick-save-btn").addEventListener("click", () => quickSave());
    $("quick-load-btn").addEventListener("click", quickLoad);
  }

  async function handleSaveGame() {
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      humanCivId, spectatorMode, aiDifficulty, gameSpeedPercent,
      // Marks this save as written after the Difficulty slider shipped -- see
      // the load path, which needs it to tell a real "normal" choice from the
      // frozen pre-slider default.
      difficultyChosen: true,
      gameState,
    };
    // .kmsg extension regardless of whether this browser could gzip it
    // (savegame.js's serializeToBlob falls back to plain JSON on its own
    // when it can't) -- loading detects the actual format from the file's
    // own bytes, not the extension, so this name never has to change.
    const blob = await window.GameEngine.savegame.serializeToBlob(payload);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Filename includes the kingdom's race and a save timestamp so multiple
    // saves/games don't collide or read as interchangeable in a downloads folder.
    const civ = gameState.civs[humanCivId];
    const raceName = civ ? window.GameData.getRace(civ.raceId).label : "kingdom";
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      + `_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    a.download = `kingdom-marches-${raceName}-${timestamp}.kmsg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadGameFile(e) {
    const file = e.target.files[0];
    e.target.value = ""; // reset so re-selecting the same file still fires change
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        // Raw bytes, not text -- a gzip-compressed save's binary content
        // would be corrupted by reading it as text first (see savegame.js's
        // deserializeFromArrayBuffer, which detects gzip vs. an OLD plain-
        // JSON save from its own magic bytes, not the file extension).
        const payload = await window.GameEngine.savegame.deserializeFromArrayBuffer(reader.result);
        applyLoadedPayload(payload);
      } catch (err) {
        alert(`Failed to load save file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  /** Quick Save / Quick Load: same payload shape and serializer as the
   *  File > Save Game / Load Game buttons above, just to/from a single
   *  fixed localStorage slot instead of a downloaded/picked file -- see
   *  QUICKSAVE_KEY. */
  const QUICKSAVE_KEY = "kingdom-marches-quicksave";

  /** Enables/disables every Quick Load entry (title screen + in-game) based
   *  on whether a quicksave currently exists -- called once at bootstrap
   *  (setupTitleLoadGameControl) and again after every successful Quick
   *  Save, so "nothing saved yet" reads as a disabled button rather than a
   *  confusing alert on first click. */
  function updateQuickLoadButtons() {
    const has = !!localStorage.getItem(QUICKSAVE_KEY);
    for (const id of ["quick-load-btn", "title-quick-load-btn"]) {
      const btn = $(id);
      if (btn) btn.disabled = !has;
    }
  }

  /** `silent`: true for the automatic every-10-turns save (see
   *  finishRoundBookkeeping) -- skips the button-flash confirmation
   *  (nothing was clicked, so nothing to flash) and downgrades a quota
   *  failure to a console.warn instead of a blocking alert() (a full quota
   *  would otherwise re-alert the player every 10 turns forever). A
   *  manually-triggered Quick Save (button/F5) always gets the loud,
   *  explicit feedback since the player is waiting on it. */
  async function quickSave({ silent = false } = {}) {
    if (!gameState) return;
    const payload = {
      version: 1, savedAt: new Date().toISOString(),
      humanCivId, spectatorMode, aiDifficulty, gameSpeedPercent,
      // Marks this save as written after the Difficulty slider shipped -- see
      // the load path, which needs it to tell a real "normal" choice from the
      // frozen pre-slider default.
      difficultyChosen: true,
      gameState,
    };
    try {
      // serializeToLocalStorageString stringifies `payload` synchronously
      // before its own async gzip step, so this snapshot is safe even
      // though gameState itself keeps mutating (redraw, AI turns, etc.)
      // while the await below is in flight.
      const value = await window.GameEngine.savegame.serializeToLocalStorageString(payload);
      localStorage.setItem(QUICKSAVE_KEY, value);
    } catch (err) {
      if (silent) console.warn(`Auto-quicksave failed: ${err.message}`);
      else alert(`Quick Save failed (likely out of browser storage space): ${err.message}`);
      return;
    }
    updateQuickLoadButtons();
    if (silent) return;
    const label = $("quick-save-btn-label");
    if (label) {
      const original = label.textContent;
      label.textContent = "Saved ✓";
      setTimeout(() => { label.textContent = original; }, 1200);
    }
  }

  /** Same dual-context branch File > Load Game already needs two SEPARATE
   *  handlers for (title screen vs. in-game, see setupTitleLoadGameControl's
   *  own doc comment) -- one function here instead, since there's no file
   *  input/FileReader step to duplicate: gameState existing (or not) is
   *  enough to tell which context this call landed in. */
  async function quickLoad() {
    const value = localStorage.getItem(QUICKSAVE_KEY);
    if (!value) { alert("No quicksave found."); return; }
    try {
      const payload = await window.GameEngine.savegame.deserializeFromLocalStorageString(value);
      if (gameState) applyLoadedPayload(payload);
      else startGameFromSave(payload);
    } catch (err) {
      alert(`Failed to load quicksave: ${err.message}`);
    }
  }

  /**
   * Replaces the live session with a loaded save -- but first makes sure
   * every race the save actually needs has its art loaded, since startGame's
   * own preloadAll(racesInPlay) call only ever fetches art for the CURRENT
   * session's own races, and sprites.js's pick() would otherwise silently
   * fall back to placeholders for a save with a different race mix.
   * window.UI.sprites.preloadAll is idempotent per race, so re-calling it
   * here with the SAVE's actual races is cheap when they overlap the current
   * session and correctly fills the gap when they don't. Reuses the same
   * loading screen startGame shows; the actual state swap
   * (finishApplyLoadedPayload) only happens once loading settles. Music/sfx
   * are deliberately left alone here -- their progress rows just stay as-is
   * rather than being forced to a fake 100%. */
  function applyLoadedPayload(payload) {
    // Stopped immediately, not deferred to finishApplyLoadedPayload -- a
    // spectator autoplay tick firing against the soon-to-be-discarded OLD
    // gameState during the (up to several seconds) art-loading wait would
    // be pure wasted work at best, a stray redraw glitch at worst.
    clearInterval(autoplayTimer);
    const racesInPlay = [...new Set(Object.values(payload.gameState.civs).map((c) => c.raceId))];
    showLoadingScreen();
    setLoadingProgress("music", 1, 1);
    setLoadingProgress("sfx", 1, 1);
    const spritesPromise = window.UI.sprites.preloadAll(racesInPlay, (done, total) => setLoadingProgress("sprites", done, total));
    const LOADING_FAILSAFE_MS = 30000;
    Promise.race([
      spritesPromise,
      new Promise((resolve) => setTimeout(resolve, LOADING_FAILSAFE_MS)),
    ]).then(() => finishApplyLoadedPayload(payload));
  }

  /** The actual state swap, deferred until applyLoadedPayload's art preload
   *  settles (see its own doc comment). gameState/viewState are mutated IN
   *  PLACE (properties cleared then reassigned) rather than pointed at new
   *  objects -- window.UI.input.attach (called once, back in startGame)
   *  closed over the original gameState/viewState object references, so
   *  swapping in fresh objects here would leave mouse input silently
   *  operating on the discarded pre-load state. */
  function finishApplyLoadedPayload(payload) {
    for (const k of Object.keys(gameState)) delete gameState[k];
    Object.assign(gameState, payload.gameState);

    humanCivId = payload.humanCivId;
    spectatorMode = payload.spectatorMode;
    // Falls back to 100% (the default pace) for a save made before the Game
    // Speed slider existed, same "predates this field" convention as
    // civ.isHuman's own recompute just below.
    applyGameSpeed(payload.gameSpeedPercent || 100);
    // Same difficultyChosen handling as startGameFromSave above -- a save
    // with no marker predates the Difficulty slider and loads as Easy, which
    // is the level that reproduces the balance it was played at.
    // applyDifficulty re-assigns aiDifficulty itself.
    applyDifficulty(payload.difficultyChosen
      ? difficultyIndexFromId(payload.aiDifficulty)
      : 0);
    // Recomputed rather than trusted from the save file itself (2026-08-04):
    // civ.isHuman didn't exist before this fix, so a save made prior to it
    // would otherwise load with the flag missing on every civ, silently
    // breaking the level-up picker below. Cheap to just derive it fresh from
    // humanCivId every load instead of treating it as save-worthy state.
    for (const civ of Object.values(gameState.civs)) civ.isHuman = civ.id === humanCivId;

    for (const k of Object.keys(viewState)) delete viewState[k];
    Object.assign(viewState, {
      scrollX: 0, scrollY: 0, zoomLevel: 1.0, showInfluence: true, showGrid: true,
      // Interface menu's "End Turn Reminders" checkbox -- gates
      // handleEndTurnClick's confirmEndTurn dialog entirely when off, same
      // non-persisted per-session convention as
      // showGrid/showInfluence above (not part of the save file).
      endTurnRemindersEnabled: true,
      selectedUnit: null, selectedCity: null, selectedTile: null, humanCivId,
      // Tabbed tile inspector -- the selected* fields above are derived from
      // this now (see input.js's SELECTION MODEL).
      selection: null,
      // Read-only peek at some OTHER tile, shown in the sidebar in place of
      // (never alongside) the real selection above -- see input.js's INSPECT
      // doc comment. Cleared automatically the moment a real (re)selection
      // happens, so this never needs explicit resetting on its own.
      inspect: null,
      fogMode: "off", fogCivIds: new Set(Object.keys(gameState.civs)),
      tileScoreCivId: null, dialog: null, dialogBeforeReport: null, turnBanner: null, ringMenu: null,
      onTechTreeClosed: null,
    });

    clearInterval(autoplayTimer);
    spectatorPaused = false;
    $("spectator-pause-btn").textContent = "Pause";

    window.MusicSystem.setRace(humanCivId ? gameState.civs[humanCivId].raceId : null);
    updateMapSeedLabel();

    resetFogControls();
    resetTileScoreControls();
    centerViewOnStart();
    updateSpeedMenuVisibility();
    updateFogMenuVisibility();
    updateAiReportsMenuVisibility();
    if (spectatorMode) startAutoplay();
    hideLoadingScreen();
    redraw();
  }

  function startAutoplay() {
    clearInterval(autoplayTimer);
    // One UNIT-step per tick (not a whole civ, and not a full round) -- this
    // is what makes AI units visibly act one at a time, in the order they
    // were created, in spectator mode, instead of a civ's whole army
    // resolving in one instant flash. 400ms roughly matches render.js's own
    // MOVE_ANIM_MS glide duration, so one unit's move/attack animation has
    // time to finish before the next unit's tick fires at 1x speed. The
    // speed slider still controls overall pacing, just at unit granularity
    // now rather than civ granularity.
    const baseMs = 400;
    autoplayTimer = setInterval(() => {
      if (!spectatorPaused) advanceOneStep();
    }, baseMs / spectatorSpeed);
  }
  function restartAutoplay() {
    if (!spectatorPaused) startAutoplay();
  }

  /** Force-ends the turn regardless of what's still unresolved -- the
   *  confirm-dialog safety net for doing that on purpose. Called directly by
   *  a long-press on the End Turn button/FAB (2026-08-26, user-directed:
   *  long-pressing always reaches this, even while the button reads "Next"
   *  -- see wireLongPress below), and by handleEndTurnButtonClick's own
   *  plain click once nothing is left to jump to. */
  function handleEndTurnClick() {
    if (spectatorMode) return; // spectator turns advance automatically
    // Turn-end guard: surface anything the player
    // probably didn't mean to skip. Deliberately a confirm, not a block --
    // deliberately holding units in reserve or coasting a turn without
    // research is a legitimate choice, it just shouldn't happen by accident.
    const unresolved = viewState.endTurnRemindersEnabled ? collectUnresolvedTurnWork() : [];
    if (unresolved.length) {
      viewState.dialog = {
        kind: "confirmEndTurn", items: unresolved,
        onAnswer: (ok) => {
          viewState.dialog = null;
          if (ok) advanceTurn();
          else redraw();
        },
      };
      redraw();
      return;
    }
    advanceTurn();
  }

  /** Jumps to the next thing the player still owes this turn -- idle
   *  cities, then units needing orders (both via the existing cyclers just
   *  below, previously wired together for this same purpose after a city
   *  order), then finally the tech tree if research is unassigned and
   *  something's affordable. Returns whether it actually navigated, same
   *  convention goToNextIdleCityOrNextUnit already uses, so
   *  handleEndTurnButtonClick knows whether to fall through to actually
   *  ending the turn. */
  function handleNextAttentionItem() {
    if (goToNextIdleCityOrNextUnit()) return true;
    if (!humanCivId) return false;
    const civ = gameState.civs[humanCivId];
    if (civ && !civ.currentResearch && window.GameEngine.tech.hasAffordableResearch(civ)
        && (civ.researchSkipUntilTurn || 0) <= (gameState.turnNumber || 0)) {
      viewState.techTreeCivId = humanCivId;
      lastRenderedTechTreeKey = null;
      redraw();
      return true;
    }
    return false;
  }

  /** The End Turn button's normal click (2026-08-26, user-directed): while
   *  there's still unresolved work -- sidebar.js's button reads "Next" and
   *  turns green only once this is false, same three checks
   *  collectUnresolvedTurnWork uses, kept in sync by eye across the two
   *  files -- a plain click jumps to the next thing needing attention
   *  instead of trying to end the turn. Only once nothing is left does it
   *  fall through to actually ending it. */
  function handleEndTurnButtonClick() {
    if (spectatorMode) return;
    if (handleNextAttentionItem()) return;
    handleEndTurnClick();
  }

  /** Wires `btn` so a normal click/tap fires `onClick` but holding it past
   *  END_TURN_LONG_PRESS_MS fires `onLongPress` instead -- used by the End
   *  Turn button/FAB so a long-press always ends the turn even while
   *  unresolved work has a plain click jumping around the map instead
   *  (2026-08-26, user-directed). Suppresses the click a touch/mouse always
   *  synthesizes after release, long press or not, so onClick never fires
   *  as a follow-up to onLongPress. Not map-gesture machinery like
   *  input.js's own long-press -- this is one button, so no pointer capture
   *  or move-triggered cancellation, just leave-cancels-the-hold. */
  const END_TURN_LONG_PRESS_MS = 500;
  function wireLongPress(btn, onClick, onLongPress) {
    if (!btn) return;
    let timer = null, fired = false;
    const cancel = () => { if (timer !== null) { clearTimeout(timer); timer = null; } };
    btn.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return; // right/middle click, not a press-and-hold
      fired = false;
      cancel();
      timer = window.setTimeout(() => {
        timer = null;
        fired = true;
        navigator.vibrate?.(10);
        onLongPress();
      }, END_TURN_LONG_PRESS_MS);
    });
    btn.addEventListener("pointerup", cancel);
    btn.addEventListener("pointerleave", cancel);
    btn.addEventListener("pointercancel", cancel);
    btn.addEventListener("click", (e) => {
      if (fired) { fired = false; e.preventDefault(); e.stopPropagation(); return; }
      onClick();
    });
  }

  /** Things the player very likely still wants to do this turn. Empty means
   *  End Turn goes straight through with no confirm. Each item is
   *  { text, x, y, tabKind } -- x/y/tabKind let
   *  the dialog render a tile-link jump-and-select button next to the text,
   *  same as sidebar.js's own tileLink -- x/y are omitted for "No research
   *  selected", which isn't tied to any one tile). Cities are listed
   *  individually (there are rarely more than a handful) so each gets its
   *  own jump link; units stay a single aggregate line -- the count is
   *  routinely double digits by the midgame, and one line per idle unit
   *  would turn the dialog into a scrollable unit roster -- linked to
   *  whichever one Next Unit would land on first. */
  function collectUnresolvedTurnWork() {
    if (!humanCivId) return [];
    const civ = gameState.civs[humanCivId];
    if (!civ) return [];
    const items = [];

    const waiting = window.GameEngine.orders.unitsNeedingOrders(gameState, humanCivId);
    if (waiting.length) {
      const first = waiting[0];
      items.push({
        text: `${waiting.length} unit${waiting.length === 1 ? "" : "s"} still able to move or act`,
        x: first.x, y: first.y, tabKind: "unit",
      });
    }
    // Affordability-gated: a civ that simply
    // can't afford ANY currently-available tech, or a city that can't
    // afford ANY currently-available build, has nothing it could actually
    // do about "no research selected"/"not building anything" right now --
    // nagging about it every turn would just be noise until income catches
    // up. window.GameEngine.ai.availableBuilds already tags every option
    // with `affordable` (see its own doc comment).
    // researchSkipUntilTurn (2026-08-28, user-directed): the tech tree
    // overlay's "Skip" button snoozes this specific nag for the rest of
    // this turn and all of next -- see main.js's techtree-skip-btn wiring.
    // A manual "Choose Research" click still works fine regardless; this
    // only silences the automatic reminder.
    if (!civ.currentResearch && window.GameEngine.tech.hasAffordableResearch(civ)
        && (civ.researchSkipUntilTurn || 0) <= (gameState.turnNumber || 0)) {
      // chooseResearch: renders a "Choose
      // Research" button instead of a tile "Go to" link -- see dialog.js's
      // confirmEndTurn branch and wireDialogButtons below.
      items.push({ text: "No research selected", chooseResearch: true });
    }
    for (const c of civ.cities) {
      // Shared with the sidebar's per-city idle tag and the map's idle
      // badge -- see cities.js's isCityIdle for
      // the exact rules (a city that spent this turn's production on
      // resources or research HAS made its choice, it's no more unresolved
      // than one mid-build).
      if (window.GameEngine.cities.isCityIdle(civ, c, gameState)) {
        items.push({ text: `${c.name} is not building anything`, x: c.x, y: c.y, tabKind: "city" });
      }
    }
    return items;
  }

  /** Opens the name-and-confirm dialog for `unit` founding on its own tile,
   *  and does the founding itself if the player accepts. Reachable only via
   *  the unit panel's own "Found City" button (handleFoundCity) -- there is
   *  deliberately no automatic end-of-turn settler sweep: never auto-prompt
   *  to found a city just because a pioneer happens to be standing on a
   *  valid tile; the player uses the button when they actually want to.
   *  `onDone` runs once the dialog is
   *  answered either way. */
  function openFoundCityDialog(civ, unit, onDone) {
    const suggested = window.GameData.getNextCityName(civ.raceId, civ.usedCityNames || []);
    viewState.dialog = {
      kind: "foundCity", x: unit.x, y: unit.y, suggested,
      onAnswer: (name) => {
        if (name) {
          const city = window.GameEngine.cities.createCity({ x: unit.x, y: unit.y, civId: civ.id, raceId: civ.raceId, name, map: gameState.map, radiusBonus: civ.radiusBonus || 0 });
          civ.cities.push(city);
          civ.usedCityNames = civ.usedCityNames || [];
          civ.usedCityNames.push(name);
          civ.hasFoundedCity = true; // see cities.js foundCity -- gates the "no cities = eliminated" check
          // Mirrors cities.js foundCity's event push (this path duplicates
          // foundCity's logic for the found-city dialog rather than calling
          // it directly) -- keeps ai.js's recentCityDelta accurate even for
          // a human-founded city, in case any AI civ's scoring ever needs it.
          civ.cityEvents = civ.cityEvents || [];
          civ.cityEvents.push({ turn: gameState.turnNumber || 0, type: "founded" });
          civ.units = civ.units.filter((u) => u !== unit);
          window.GameEngine.orders.invalidateReachCache();
          window.GameEngine.turns.refreshVisibility(gameState);
          window.SfxSystem.playAction(civ.raceId, unit.typeId, "found", unit.x, unit.y);
          // Free first-city tech: mirrors
          // cities.js foundCity's own civ.cities.length === 1 grant for AI
          // civs -- this path duplicates that check since it never calls
          // that function. Interactive for the human player instead of an
          // auto-pick: opens a SECOND dialog immediately, chaining into
          // `onDone` only once that one is answered too.
          if (civ.cities.length === 1) {
            openChooseTechDialog(civ, onDone);
            return;
          }
        }
        if (onDone) onDone();
      },
    };
    redraw();
  }

  /** Free first-city tech choice: opens right
   *  after a civ's FIRST city is founded (see openFoundCityDialog above),
   *  offering every Layer-1 tech for its race as a free pick -- see
   *  tech.js's firstCityTechChoices/grantFreeTech. No-ops straight to
   *  onDone if the race somehow has no Layer-1 techs left to offer. */
  function openChooseTechDialog(civ, onDone) {
    const choices = window.GameEngine.tech.firstCityTechChoices(civ);
    if (choices.length === 0) { if (onDone) onDone(); return; }
    viewState.dialog = {
      kind: "chooseTech",
      title: "Choose a Free Tech",
      text: "Founding your first city grants one Tier 1 tech, free.",
      options: choices.map((id) => {
        const tech = window.GameData.getTech(id);
        return { id, label: tech.label, description: tech.description || "" };
      }),
      onAnswer: (techId) => {
        if (techId) window.GameEngine.tech.grantFreeTech(civ, techId);
        if (onDone) onDone();
      },
    };
    redraw();
  }

  /** Unit panel's "Found City" button (see sidebar.js's pioneerActions).
   *  Founding used to be reachable ONLY through the end-turn settler sweep,
   *  which meant a player who wanted a city right now had no way to ask for
   *  one -- the panel just told them to end their turn. */
  /** Manual order supersedes automation/pathing/Rest and Defend (2026-08-06,
   *  user-directed): any command the player issues to a unit ends whatever
   *  it was doing on its own -- an Automate Actions proposal/toggle, a
   *  multi-turn goto order, or a standing Rest and Defend (formerly a
   *  separate Garrison action; merged 2026-08-19, user-directed) -- with no
   *  separate Stop Order/Stop Automating/Cancel Rest and Defend click needed
   *  first. Idempotent (a plain unit with none of these set is untouched),
   *  so safe to call unconditionally at the top of every order-issuing
   *  handler below. Stop Order/Cancel Rest and Defend themselves are
   *  deliberately NOT among those callers -- each stays scoped to undoing
   *  just its own thing, same as "Stop Automating" stays scoped to just
   *  automation. Only the "restAndDefend" channel value is cleared here --
   *  a resource channel (hunting, prospecting, ...) has its own forfeit-
   *  the-stash cancel path (handleCancelChannel) and isn't touched by this
   *  generic helper. */
  function endAutomationAndGoto(unit) {
    unit.automated = false;
    unit.pendingIntent = null;
    unit.gotoTarget = null;
    if (unit.channeling === "restAndDefend") unit.channeling = null;
    // Sentry / Follow -- same "any new order
    // supersedes a standing one" rule gotoTarget already gets here, so a
    // unit taken off Sentry/Follow by being given something else to do
    // doesn't keep re-triggering its old standing order next turn.
    unit.sentry = false;
    unit.followTarget = null;
  }

  const SHORTCUT_OVERLAY_IDS = [
    "launch-options-overlay", "credits-overlay", "techtree-overlay",
    "reports-overlay", "game-dialog-overlay", "keyboard-shortcuts-overlay",
    "knowledge-overlay",
  ];

  /** True while any full-screen modal is up -- gates the gameplay shortcuts
   *  (WASD pan, Space, arrows) below so they can't reach through a dialog
   *  the player is actually looking at (e.g. Space toggling Rest and Defend
   *  on the unit behind a "Research Complete" popup). Checks actual
   *  rendered size, not display style: launch-options-overlay in particular
   *  is never explicitly closed when Start Game is clicked -- only its
   *  ancestor #title-screen is hidden (see startGame) -- so its OWN
   *  style.display, and even its OWN getComputedStyle().display, stay
   *  "flex" for the rest of the session even though the whole subtree
   *  renders nothing once that ancestor is display:none (getComputedStyle
   *  reports an element's own resolved display value, not whether an
   *  ancestor is hiding it). getBoundingClientRect, unlike either of those,
   *  collapses to 0x0 whenever anything up the ancestor chain is
   *  display:none, so it's the one check that's actually reliable here. */
  function anyOverlayOpen() {
    return SHORTCUT_OVERLAY_IDS.some((id) => {
      const el = $(id);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  function isTypingTarget(el) {
    return !!(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" || el.isContentEditable));
  }

  /** Global keyboard shortcuts. Registered ONCE
   *  at bootstrap, same "safe pre-game, guards internally" convention
   *  setupContextMenuDismissal uses -- every handler below re-checks
   *  gameState/viewState/humanCivId itself rather than assuming a game is
   *  running.
   *
   *  General: WASD and the arrow keys both pan the map, mapped onto the same
   *  panKeys entries, continuous, applied every
   *  animation-loop frame while held -- see startAnimationLoop's panKeys
   *  read; M toggles the same master mute both the title screen's and the
   *  in-game Audio menu's mute controls use. Unit context: Space = Rest and
   *  Defend (or End Turn when nothing is selected and there's nothing left
   *  to do this turn -- see the Space handler's own comment). City context:
   *  Space = Gather More Resources; C = Spread Culture, then jump to the
   *  next idle city. */
  function setupGlobalShortcuts() {
    function handleGlobalKeydown(e) {
      if (isTypingTarget(document.activeElement)) return;

      // M: global mute toggle -- works even before a game has started (the
      // title screen has its own dedicated button for this, but the key
      // should too, matching every other "general" shortcut's always-on
      // scope). Not gated on anyOverlayOpen(): muting sound is harmless to
      // fire through a dialog, unlike the movement/action shortcuts below.
      if (e.key === "m" || e.key === "M") {
        setGlobalMuted(!window.MusicSystem.isMuted());
        return;
      }

      // Escape cancels an open tile-placement (Move To, Follow, Teleport,
      // Fireball, ...): every one of those flows already cancels on a tap
      // OUTSIDE its highlighted slots (input.js's endPointer), which was
      // plenty of an escape hatch while every placement's candidate set was
      // some small subset of the map -- Move To's (2026-08-27) is nearly
      // the WHOLE map, leaving almost nowhere to tap that isn't itself a
      // valid destination. General fix, not Move-To-specific: every
      // placement flow gets a keyboard cancel now, matching the Escape
      // convention already used for ring menus/overlays.
      if (e.key === "Escape" && viewState && viewState.placement) {
        viewState.placement = null;
        redraw();
        return;
      }

      // Enter = End Turn. Checked before the
      // overlay gate below so it also confirms the "There's still work you
      // can do this turn" dialog (game-dialog-confirm-btn is already wired
      // to its End Turn action by wireDialogButtons) -- every OTHER overlay
      // still blocks it via the early return, same as every shortcut below.
      if (e.key === "Enter") {
        if (e.repeat) return;
        if (viewState && viewState.dialog && viewState.dialog.kind === "confirmEndTurn") {
          const btn = $("game-dialog-confirm-btn");
          if (btn) btn.click();
          return;
        }
        if (!gameState || !viewState || !humanCivId || anyOverlayOpen()) return;
        e.preventDefault();
        handleEndTurnClick();
        return;
      }

      // F5/F9: Quick Save/Quick Load (see quickSave/quickLoad above).
      // Checked here, before the gameState/humanCivId gate below, because
      // Quick Load must also work from the title screen (no game running
      // yet) -- same reasoning as M/Enter above. Quick Save has no title-
      // screen equivalent (nothing to save yet), so it stays gated on
      // gameState existing.
      if (e.key === "F5") {
        e.preventDefault(); // stop the browser's own page reload
        if (e.repeat || anyOverlayOpen() || !gameState) return;
        quickSave();
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        if (e.repeat || anyOverlayOpen()) return;
        quickLoad();
        return;
      }

      if (!gameState || !viewState || !humanCivId || anyOverlayOpen()) return;

      const key = e.key.toLowerCase();
      // Arrow keys pan the map exactly like WASD
      // -- mapped onto the SAME panKeys entries (ArrowUp -> "w", etc.) rather
      // than a parallel set, so startAnimationLoop's per-frame pan read
      // (below) needs no changes and the two input methods can never drift.
      // Previously moved the selected unit one tile; that's still reachable
      // via a map click/drag same as any other move order, just no longer a
      // dedicated shortcut.
      const ARROW_TO_PAN_KEY = { arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" };
      const panKey = ARROW_TO_PAN_KEY[key] || (key === "w" || key === "a" || key === "s" || key === "d" ? key : null);
      if (panKey) {
        if (ARROW_TO_PAN_KEY[key]) e.preventDefault(); // stop the page itself from scrolling
        panKeys.add(panKey);
        return;
      }

      if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault(); // stop the page itself from scrolling
        if (e.repeat) return;
        if (viewState.selectedUnit && viewState.selectedUnit.civId === humanCivId) {
          handleRestAndDefend();
        } else if (viewState.selectedCity && viewState.selectedCity.civId === humanCivId) {
          handleResourceProduction(viewState.selectedCity);
        } else {
          // Nothing selected: jump to the next
          // idle city, or the next unit needing orders if there's no idle
          // city -- same priority goToNextIdleCityOrNextUnit already gives
          // the Next Idle City/Next Unit sidebar buttons. If THAT comes back
          // false, there is nothing left to jump to this turn, so Space falls through to the
          // same End Turn path Enter already uses -- still routed through
          // handleEndTurnClick, so the confirmEndTurn reminder (when enabled)
          // still gets its say rather than skipping straight to advanceTurn.
          if (goToNextIdleCityOrNextUnit()) redraw();
          else handleEndTurnClick();
        }
        return;
      }

      // C: Spread Culture on the selected city, then jump to the next idle
      // city -- same "act, then cycle" shape as Space's city branch above.
      if (key === "c") {
        if (viewState.selectedCity && viewState.selectedCity.civId === humanCivId) {
          handleSpreadCulture(viewState.selectedCity);
          handleNextIdleCity();
        }
        return;
      }

      // Q: make the selected unit quip on demand (2026-08-19, user-
      // directed) -- unlike every other quips.js trigger, this one isn't
      // gated behind maybeQuip's 5% roll or a real action decision point;
      // it's a deliberate "say something" press, so it goes straight to
      // getRandomQuip and shows the bubble unconditionally via
      // spawnQuipText. Uses the "move" action pool specifically -- per
      // quips.js's own data-file doc comment, that's the one pool defined
      // for every unit type that can move at all, so it's the closest
      // thing to a universal "just talk" line this data model has.
      if (key === "q") {
        if (viewState.selectedUnit && viewState.selectedUnit.civId === humanCivId) {
          const unit = viewState.selectedUnit;
          const unitCiv = gameState.civs[unit.civId];
          const text = window.GameData.getRandomQuip(unitCiv.raceId, unit.typeId, "move");
          if (text) {
            window.GameEngine.quips.spawnQuipText(unit, text);
            redraw();
          }
        }
        return;
      }

    }
    document.addEventListener("keydown", handleGlobalKeydown);

    document.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      const ARROW_TO_PAN_KEY = { arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" };
      const panKey = ARROW_TO_PAN_KEY[key] || (key === "w" || key === "a" || key === "s" || key === "d" ? key : null);
      if (panKey) panKeys.delete(panKey);
    });

    // Held keys must not survive a tab switch/alt-tab -- there's no keyup
    // event once focus leaves the page, so without this a key released
    // while the browser wasn't focused would pan forever.
    window.addEventListener("blur", () => { panKeys.clear(); });
  }

  function handleFoundCity() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    const civ = gameState.civs[humanCivId];
    if (!civ || unit.civId !== humanCivId) return;
    if (!window.GameData.getUnit(unit.typeId).canFoundCity) return;
    if (!window.GameEngine.cities.canFoundCityAt(gameState.map, gameState.civs, unit.x, unit.y, civ.raceId).ok) return;
    endAutomationAndGoto(unit);
    openFoundCityDialog(civ, unit, () => redraw());
  }

  /** "Found City Here" on a remote tile: sends the unit there via the
   *  same goto order Move to This Tile would, tagged foundCity so
   *  advanceGotoOrder (orders.js) flags the unit on arrival instead of
   *  leaving it idle at the destination. */
  function handleFoundCityHere(x, y) {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    const civ = gameState.civs[humanCivId];
    if (!civ || unit.civId !== humanCivId) return;
    if (!window.GameData.getUnit(unit.typeId).canFoundCity) return;
    endAutomationAndGoto(unit);
    startFoundCityGoto(unit, x, y);
  }

  function startFoundCityGoto(unit, x, y) {
    window.GameEngine.orders.startGotoOrder(unit, gameState, x, y, false, { foundCity: true });
    if (viewState.selection) {
      viewState.selection.x = unit.x;
      viewState.selection.y = unit.y;
    }
    offerFoundCityIfPending(gameState.civs[humanCivId]);
  }

  /** Drains unit._foundCityPending (set by orders.js's advanceGotoOrder on
   *  arrival at a "Found City Here" destination) into the real found-city
   *  dialog. Called both right after issuing the order (same-turn arrival)
   *  and from finishRoundBookkeeping's notification chain (multi-turn
   *  arrival, after the relevant End Turn). */
  function offerFoundCityIfPending(civ, onDone) {
    if (!civ) { if (onDone) onDone(); return; }
    const unit = civ.units.find((u) => u._foundCityPending);
    if (!unit) { if (onDone) onDone(); return; }
    unit._foundCityPending = false;
    const check = window.GameEngine.cities.canFoundCityAt(gameState.map, gameState.civs, unit.x, unit.y, civ.raceId);
    if (!check.ok) {
      // Site went bad between order-issue and arrival (e.g. someone else
      // founded nearby in the meantime) -- tell the player instead of
      // silently stranding the unit with no explanation.
      const baseUnit = window.GameData.getUnit(unit.typeId);
      viewState.dialog = {
        kind: "message",
        title: "Can't Found a City Here",
        text: `${unit.name || baseUnit.label} arrived, but can no longer found a city here: ${check.reason}.`,
        onDismiss: () => offerFoundCityIfPending(civ, onDone),
      };
      redraw();
      return;
    }
    openFoundCityDialog(civ, unit, () => offerFoundCityIfPending(civ, onDone));
  }

  // Captured once at the start of each round (when turnStepIndex is 0) so the
  // "did the human's army just take losses" combat-music check can compare
  // across the WHOLE round, not just whichever single civ-step just ran.
  let pendingPreUnitCounts = null;

  function finishRoundBookkeeping(victoryResult) {
    // Collapse the mobile sheet back to peek (2026-08-26, user-reported):
    // whatever it ended the previous turn at -- raised by a tap-to-select
    // mid-turn, or left open by the player -- a new round should always
    // start with the map fully visible, not however much screen the sheet
    // happened to be covering when the player hit End Turn. Unconditional,
    // ahead of every dialog this function might raise below, so a dialog
    // that itself wants the sheet up (none currently do) would still win.
    if (document.body.classList.contains("mobile")) setSheetDetent("peek");

    // Auto-quicksave (2026-08-26, user-directed): every 10 turns, quietly
    // -- same single localStorage slot and quickSave() function the manual
    // Quick Save button/F5 use, just silenced (no button flash, no alert on
    // a quota failure) since nothing was clicked. turns.js's endRound has
    // already incremented gameState.turnNumber by the time this fires (see
    // advanceOneUnitStep's roundComplete check, this function's only caller).
    if (gameState.turnNumber % 10 === 0) quickSave({ silent: true });

    // A leftover gameState.immediateVictoryResult (see checkImmediateVictory)
    // from earlier this same round, never consumed because some OTHER
    // dialog kept occupying viewState.dialog's one slot every redraw() until
    // now -- the natural end-of-round path below is about to handle this
    // exact same condition fresh (endRound's own checkVictory re-derives it
    // independently), so clear the stale flag rather than let it linger into
    // a LATER round and pop a redundant, already-shown "Victory!" once the
    // player eventually dismisses whatever's up right now.
    if (victoryResult) gameState.immediateVictoryResult = null;

    // Human defeat: two independent ways to
    // lose in single player -- this civ's own elimination (all cities
    // destroyed after founding at least one, or wiped before founding --
    // see turns.js's checkElimination), which can happen while OTHER civs
    // are still fighting it out (no victoryResult yet at all), or another
    // civ reaching a victory condition first (victoryResult.winner is set,
    // but not to this civ). Checked before either branch below reads
    // victoryResult, since a defeated human should see ONLY the defeat
    // dialog -- never the game's own Victory message, even on the exact
    // round some other civ's win coincides with this civ's elimination.
    const humanLost = !!humanCivId
      && ((victoryResult && victoryResult.winner !== humanCivId) || !!gameState.civs[humanCivId]?.eliminated);

    if (humanCivId) {
      const civ = gameState.civs[humanCivId];
      const finishedTechId = civ.lastCompletedTech;
      civ.lastCompletedTech = null;
      // Tech-researched / Unit-built announcements (2026-08-06, user-
      // directed): skipped once the game has actually ended THIS round
      // (below) -- nothing left to research or build toward, and the
      // Victory/Defeat dialog takes the one viewState.dialog slot instead.
      // Tech first, then the unit-built queue (if any) once THAT'S
      // dismissed, chained rather than raced, so neither silently drops
      // behind the other if both happen the same round (see
      // openTechResearchedDialog/offerNextUnitBuiltNotice).
      if (!victoryResult && !humanLost) {
        // Keep-or-raze decisions lead the post-unit-built chain (2026-08-25):
        // a city changing hands is the most consequential thing that can have
        // happened during an automated unit's turn, and it's a DECISION the
        // player still owes rather than an announcement, so it shouldn't sit
        // behind treasure notices. A capture from a hand-clicked attack was
        // already offered at the moment of the attack; this catches the
        // automated-unit case, where the queue is drained at round end.
        const afterUnitBuilt = () => offerNextCityCaptureDecision(civ,
          () => offerNextTreasureNotice(civ, () => offerNextPendingIntent(civ, () => offerFoundCityIfPending(civ))));
        const afterTech = () => {
          if (finishedTechId) {
            openTechResearchedDialog(civ, finishedTechId, () => offerNextUnitBuiltNotice(civ, afterUnitBuilt));
          } else {
            offerNextUnitBuiltNotice(civ, afterUnitBuilt);
          }
        };
        // Starvation disband choice goes first --
        // it's the one entry in this chain reporting a LOSS rather than
        // progress, so it leads rather than getting buried behind good news.
        // The Wisp-cap disband choice (also a loss notice, see turns.js's
        // beginCivTurn wisp-cap enforcement) chains right behind it.
        offerNextStarvationDisband(civ, () => offerNextWispDisband(civ, afterTech));
      } else {
        civ.pendingStarvationDisbands = [];
        civ.pendingWispDisbands = [];
        civ.pendingUnitBuiltNotices = [];
        civ.pendingTreasureNotices = [];
        for (const unit of civ.units) { unit.pendingIntent = null; unit._foundCityPending = false; }
      }
    }

    if (humanLost) {
      openGameOverDialog(gameState.civs[humanCivId], victoryResult);
    } else if (victoryResult) {
      const text = victoryResult.type === "elimination"
        ? `${victoryResult.winner} has conquered all rivals!`
        : `${victoryResult.winner} has achieved territorial dominance! (${(victoryResult.share * 100).toFixed(0)}% of the map)`;
      showVictorySequence(victoryResult.winner, text, victoryResult.type);
    }
  }

  /** Full victory presentation (2026-08-19, user-directed): stops autoplay
   *  and switches music immediately -- the win is real the instant this is
   *  called, regardless of how long the player takes to click through what
   *  follows -- then announces every still-queued kingdom elimination
   *  BEFORE the "Victory!" message (see announceEliminationsThen's own doc
   *  comment for why: an elimination that wins the game would otherwise
   *  visually leapfrog ahead of its own "X has been eliminated" notice),
   *  then the message itself, then the stats screen (openVictoryStatsDialog).
   *  Fireworks start now and run continuously through both the message and
   *  the stats screen -- there's no explicit stop call anywhere in this
   *  chain because the only way out is Return to Title, a full page
   *  reload (handleReturnToTitle), which tears down everything for free. */
  function showVictorySequence(winnerCivId, text, victoryType) {
    clearInterval(autoplayTimer);
    // Switches music to the winning race's victory theme --
    // <race>_victory_#.mp3, falls back to that race's
    // normal theme if it doesn't have one yet (see music.js's resolveCurrent).
    window.MusicSystem.notifyVictory(gameState.civs[winnerCivId].raceId);
    window.UI.fireworks.start();
    announceEliminationsThen(() => {
      viewState.dialog = {
        kind: "message", title: "Victory!", text,
        // "Keep Fighting!" (2026-08-26, user-directed): only a territorial
        // win can be declined -- an Elimination win has nothing left to
        // keep fighting FOR (every rival is already gone), and All-AI
        // Spectator has no human stake to opt out on anyone's behalf.
        // Permanently disables territorial victory for the rest of THIS
        // game (gameState.disableTerritorialVictory, read by turns.js's
        // checkVictory) -- only Elimination can end it from here on.
        onKeepFighting: (victoryType === "territory" && !spectatorMode) ? () => {
          gameState.disableTerritorialVictory = true;
          window.UI.fireworks.stop();
        } : undefined,
        onDismiss: () => openVictoryStatsDialog(winnerCivId),
      };
      redraw();
    });
  }

  /** Drains gameState.pendingKingdomEliminations one entry at a time,
   *  chained via the "message" dialog's own onDismiss hook, before calling
   *  `showVictory` -- same source queue and skip-human's-own-elimination
   *  rule as checkPendingKingdomEliminations' per-redraw draining (that
   *  function still runs too, for the ordinary mid-game case where an
   *  elimination DOESN'T end the game; by the time it next runs here it
   *  just finds this queue already empty and no-ops). Recurses one entry
   *  at a time rather than looping, since each notice has to actually be
   *  SEEN (dismissed) before the next one shows. */
  function announceEliminationsThen(showVictory) {
    const queue = gameState.pendingKingdomEliminations;
    if (queue) {
      while (queue.length && queue[0] === humanCivId) queue.shift();
    }
    if (!queue || !queue.length) { showVictory(); return; }
    // All-AI Spectator: no human stake in any kingdom's survival, same
    // "log it, don't modal it" treatment checkPendingKingdomEliminations
    // already gives the ordinary mid-game case -- drain the rest of the
    // queue quietly rather than interrupting the win with a chain of
    // notices nobody needs to individually dismiss.
    if (spectatorMode) {
      while (queue.length) {
        const c = gameState.civs[queue.shift()];
        if (!c) continue;
        console.log(`[spectator] ${window.GameData.getRace(c.raceId).label} has been eliminated from the game.`);
      }
      showVictory();
      return;
    }
    const civId = queue.shift();
    const civ = gameState.civs[civId];
    if (!civ) { announceEliminationsThen(showVictory); return; }
    const race = window.GameData.getRace(civ.raceId);
    viewState.dialog = {
      kind: "message", title: "Kingdom Eliminated",
      text: `${race.label} has been eliminated from the game!`,
      onDismiss: () => announceEliminationsThen(showVictory),
    };
    redraw();
  }

  /** Victory stats screen (2026-08-19, user-directed): total real-world
   *  time since the game was created (gameState.startedAt), total turns,
   *  the winning civ's current military power (same flat sum-of-unitPower
   *  metric turns.js's recordHistory already uses for the Report screen's
   *  line graph), influence level (owned tiles alongside the fixed
   *  territorial-victory target it's being measured against -- see
   *  turns.js's VICTORY_TILE_TARGET -- added 2026-08-20 so a win by
   *  elimination or a narrow territorial win both read the same number the
   *  same way), unit kills/losses (civ.unitsKilled/unitsLostInBattle,
   *  tallied at every real combat death in the game -- see ai.js's
   *  otherCivRemoveDeadUnit), and every rival kingdom's own standing
   *  (2026-08-20) -- owned tiles if still in the game, or "Eliminated"
   *  if not (civ.eliminated), skipping the wandering-monsters pseudo-civ
   *  (window.GameConfig.worldEncounters.monsters.civId) since it's never
   *  treated as a real kingdom anywhere else in the UI either. */
  function openVictoryStatsDialog(winnerCivId) {
    const civ = gameState.civs[winnerCivId];
    const race = window.GameData.getRace(civ.raceId);
    const elapsedMs = Date.now() - (gameState.startedAt || Date.now());
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const timeTaken = hours > 0 ? `${hours}h ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s`;
    const militaryPower = Math.round(civ.units.reduce((sum, u) => sum + window.GameData.unitPower(u.typeId), 0));
    const { counts } = window.GameEngine.influence.countTerritory(gameState);
    const tilesOf = (civId) => Math.round(counts[civId] || 0);
    // 2026-08-25: territorial victory is an absolute tile count, so the
    // victory screen reports tiles rather than a share of the map.
    const tileTarget = window.GameEngine.turns.VICTORY_TILE_TARGET;
    const influenceLevel = `${tilesOf(winnerCivId)} / ${tileTarget} tiles`;
    const monsterCivId = window.GameConfig.worldEncounters.monsters.civId;
    const rivals = Object.values(gameState.civs)
      .filter((c) => c.id !== winnerCivId && c.id !== monsterCivId)
      .map((c) => {
        const r = window.GameData.getRace(c.raceId);
        return {
          label: r.label, color: r.color, eliminated: !!c.eliminated,
          territoryPct: `${tilesOf(c.id)} tiles`,
        };
      });
    viewState.dialog = {
      kind: "victoryStats",
      raceId: civ.raceId, raceLabel: race.label,
      timeTaken, totalTurns: gameState.turnNumber || 0, militaryPower, influenceLevel,
      unitKills: civ.unitsKilled || 0, unitsLost: civ.unitsLostInBattle || 0,
      rivals,
      onReturnToTitle: handleReturnToTitle,
    };
    redraw();
  }

  /** Human defeat announcement -- see
   *  finishRoundBookkeeping's humanLost check. Stats drawn from data
   *  already tracked civ-wide (no new tracking needed): cityEvents (see
   *  cities.js's foundCity/destroyCity) survives the civ's own elimination
   *  since it's an append-only log on the civ object, not derived from
   *  civ.cities itself (which is empty by the time this fires).
   *
   *  `victoryResult` (2026-09-02, user-directed) is whichever result made
   *  this a loss -- checkImmediateVictory's is always elimination-type
   *  (only checkEliminationVictory runs mid-round), finishRoundBookkeeping's
   *  own endRound sweep can be either. Only a territorial win that ISN'T
   *  this civ's own elimination gets the influence-loss treatment below --
   *  an elimination loss has no tile count to show and no army left to
   *  "keep fighting" with. */
  function openGameOverDialog(civ, victoryResult) {
    clearInterval(autoplayTimer);
    const events = civ.cityEvents || [];
    const lostToInfluence = !!(victoryResult && victoryResult.type === "territory"
      && victoryResult.winner !== civ.id && !civ.eliminated);
    let influenceInfo = null;
    if (lostToInfluence) {
      const winnerCiv = gameState.civs[victoryResult.winner];
      const winnerRace = window.GameData.getRace(winnerCiv.raceId);
      const { counts } = window.GameEngine.influence.countTerritory(gameState);
      influenceInfo = {
        winnerLabel: winnerRace.label,
        winnerTiles: Math.round(counts[victoryResult.winner] || 0),
        ownTiles: Math.round(counts[civ.id] || 0),
        tileTarget: window.GameEngine.turns.VICTORY_TILE_TARGET,
      };
    }
    viewState.dialog = {
      kind: "gameOver",
      turnsSurvived: gameState.turnNumber || 0,
      citiesFounded: events.filter((e) => e.type === "founded").length,
      citiesLost: events.filter((e) => e.type === "razed").length,
      techsResearched: civ.completedTechs ? civ.completedTechs.size : 0,
      influenceInfo,
      // Stashes the gameOver dialog itself and hands off to the Influence
      // report overlay -- reports-close-btn's own handler (redraw()) hands
      // it right back so the player returns to this exact screen rather than
      // straight into gameplay. Needs to CLEAR viewState.dialog (not just
      // leave it set underneath) since #game-dialog-overlay sits later in
      // the DOM than #reports-overlay and would otherwise render on top of
      // it, hiding the report entirely.
      onViewInfluenceReport: influenceInfo ? () => {
        viewState.dialogBeforeReport = viewState.dialog;
        viewState.dialog = null;
        viewState.reportView = "influence";
      } : undefined,
      // "Keep On Fighting!" (2026-09-02, user-directed): the losing-side
      // counterpart to showVictorySequence's "Keep Fighting!" -- same flag,
      // same permanent-for-the-rest-of-this-game effect, just reached from
      // the other end. Drops straight back into ordinary play rather than
      // Return to Title.
      onKeepFighting: influenceInfo ? () => {
        gameState.disableTerritorialVictory = true;
      } : undefined,
      onReturnToTitle: handleReturnToTitle,
    };
    // Fixed game_over.mp3, overriding any situational/victory theme (see
    // music.js's resolveCurrent priority order).
    window.MusicSystem.notifyGameOver();
  }

  /** Immediate military-victory check (2026-08-17, user-directed): a civ's
   *  elimination can decide the whole game the instant its last city falls
   *  -- ai.js's considerAttackOrGarrison stashes the result on
   *  gameState.immediateVictoryResult right there (see turns.js's
   *  checkEliminationVictory for why that's safe to compute mid-round), and
   *  this checks for it at the top of every redraw() so the player sees the
   *  outcome the instant it happens, rather than having to click End Turn
   *  first and wait for the round to fully close out.
   *
   *  Deferred (left set, tried again next redraw()) rather than shown
   *  immediately if some OTHER dialog already has viewState.dialog's one
   *  slot -- same "don't stomp a dialog already up" caution every other
   *  notice queue in this game already takes care around.
   *
   *  Same humanLost priority finishRoundBookkeeping's own victory branch
   *  uses: if this elimination is what took the human player OUT (their own
   *  last city fell to someone else, same round), they see the defeat
   *  screen, never a "Victory!" message for a civ that isn't theirs.
   *  checkVictory's own once-per-round sweep (turns.js's endRound) still
   *  independently re-detects this exact same elimination on its normal
   *  schedule regardless (unchanged) -- this is purely a "tell the player
   *  sooner" path, not the only path that catches it. */
  function checkImmediateVictory() {
    const victoryResult = gameState && gameState.immediateVictoryResult;
    if (!victoryResult || viewState.dialog) return;
    gameState.immediateVictoryResult = null;
    const humanLost = !!humanCivId && victoryResult.winner !== humanCivId
      && !!gameState.civs[humanCivId]?.eliminated;
    if (humanLost) {
      openGameOverDialog(gameState.civs[humanCivId], victoryResult);
    } else {
      // Same plain-civId text finishRoundBookkeeping's own elimination-type
      // victory branch uses ("HUMAN has conquered all rivals!", not the
      // prettier race label) -- this is that exact same message, just shown
      // sooner, so it should read identically either way it gets triggered.
      showVictorySequence(victoryResult.winner, `${victoryResult.winner} has conquered all rivals!`, "elimination");
    }
  }

  /** Kingdom-elimination announcement queue (2026-08-17, user-directed; see
   *  turns.js's eliminateCiv, the single place every elimination path queues
   *  into gameState.pendingKingdomEliminations). Drains at most one entry
   *  per redraw() call, same "defer rather than clobber" caution
   *  checkImmediateVictory uses -- an entry left in the queue just gets
   *  picked up again next redraw() rather than lost.
   *
   *  Checked AFTER checkImmediateVictory at this function's one call site in
   *  redraw(), but that ordering only matters for the ORDINARY mid-game
   *  case (an elimination that doesn't decide the game) -- a GAME-ENDING
   *  elimination is instead announced by showVictorySequence's own
   *  announceEliminationsThen, called synchronously the moment victory is
   *  detected, BEFORE the Victory dialog (2026-08-19, user-directed: the
   *  civ whose defeat won the game should be announced before, not after,
   *  the win itself). That drains the same queue this function reads, so
   *  by the time control reaches here on the next redraw() for a
   *  game-ending elimination, the queue is already empty and this is a
   *  no-op -- the two never race or double-announce.
   *
   *  The human player's own elimination is skipped entirely (not deferred,
   *  just dropped) -- that already gets its own richer, dedicated Game Over
   *  screen via checkImmediateVictory/finishRoundBookkeeping's humanLost
   *  branch, so announcing it a second time here would be redundant. */
  function checkPendingKingdomEliminations() {
    const queue = gameState && gameState.pendingKingdomEliminations;
    if (!queue) return;
    while (queue.length && queue[0] === humanCivId) queue.shift();
    if (!queue.length) return;
    // All-AI Spectator (2026-08-19, user-directed): no human stake in any
    // kingdom's survival, so the modal is just noise interrupting the watch.
    // Still drained quietly to the console rather than dropped outright.
    if (spectatorMode) {
      while (queue.length) {
        const civ = gameState.civs[queue.shift()];
        if (!civ) continue;
        console.log(`[spectator] ${window.GameData.getRace(civ.raceId).label} has been eliminated from the game.`);
      }
      return;
    }
    if (viewState.dialog) return;
    const civ = gameState.civs[queue.shift()];
    if (!civ) return; // defensive -- civ objects are never removed from gameState.civs
    const race = window.GameData.getRace(civ.raceId);
    viewState.dialog = {
      kind: "message", title: "Kingdom Eliminated",
      text: `${race.label} has been eliminated from the game!`,
    };
  }

  /** "Return to Title Screen" -- a full reload
   *  rather than a hand-rolled teardown of gameState/viewState/timers/
   *  music/sfx visibility hooks/etc: the game has already ended, there's
   *  nothing left to preserve, and a reload guarantees every piece of
   *  session state (several of which, like music.js's victoryRace/
   *  gameOverActive, are deliberately one-way-until-a-fresh-game) actually
   *  resets instead of relying on this file remembering every place that
   *  would need to be manually cleared. */
  function handleReturnToTitle() {
    location.reload();
  }

  /** Tech-researched announcement: opens the
   *  instant a tech finishes (see finishRoundBookkeeping). Lists every
   *  OTHER tech in this civ's race tree that named `techId` as a
   *  prerequisite -- "here's what just opened up" -- plus a shortcut
   *  straight into the tech tree. `onDone` runs once the dialog is
   *  answered either way (same chaining convention offerNextUnitBuiltNotice
   *  uses), so finishRoundBookkeeping can queue the
   *  unit-built notices right behind it. */
  /** Starvation unit-loss choice: drains
   *  civ.pendingStarvationDisbands one at a time -- turns.js pushes one
   *  entry per round the human civ's stockpile goes negative with units
   *  left to lose (see its own doc comment for why the AI doesn't use this
   *  path). Same one-at-a-time blocking-modal chaining convention as
   *  offerNextUnitBuiltNotice. Defensively drops a candidate that's somehow
   *  already gone (died/carried off/etc. since the round processed) rather
   *  than crash on a stale reference -- if that empties the list entirely,
   *  no dialog needed after all. */
  function offerNextStarvationDisband(civ, onDone) {
    const pending = civ.pendingStarvationDisbands;
    if (!pending || !pending.length) { if (onDone) onDone(); return; }
    const entry = pending.shift();
    const candidates = entry.candidates.filter((u) => civ.units.includes(u));
    if (!candidates.length) { offerNextStarvationDisband(civ, onDone); return; }
    const race = window.GameData.getRace(civ.raceId);
    viewState.dialog = {
      kind: "chooseStarvationDisband",
      civLabel: race.label,
      candidates: candidates.map((u) => {
        const baseUnit = window.GameData.getUnit(u.typeId);
        return {
          label: u.name || baseUnit.label,
          description: `${baseUnit.label} -- at (${u.x}, ${u.y})`,
        };
      }),
      onAnswer: (index) => {
        const victim = candidates[index];
        if (victim && civ.units.includes(victim)) {
          if (victim.carries) victim.carries.carriedBy = null;
          civ.units = civ.units.filter((u) => u !== victim);
        }
        offerNextStarvationDisband(civ, onDone);
      },
    };
    redraw();
  }

  /** Orc "Bog Spirit" Wisp cap choice: drains
   *  civ.pendingWispDisbands one at a time -- turns.js's beginCivTurn pushes
   *  one entry per excess Wisp a dead Bog Witch left behind (see its own
   *  doc comment for why the AI doesn't use this path). Same shape as
   *  offerNextStarvationDisband right above, down to the defensive re-filter
   *  against a candidate that's somehow already gone. */
  function offerNextWispDisband(civ, onDone) {
    const pending = civ.pendingWispDisbands;
    if (!pending || !pending.length) { if (onDone) onDone(); return; }
    const entry = pending.shift();
    const candidates = entry.candidates.filter((u) => civ.units.includes(u));
    if (!candidates.length) { offerNextWispDisband(civ, onDone); return; }
    const race = window.GameData.getRace(civ.raceId);
    viewState.dialog = {
      kind: "chooseWispDisband",
      civLabel: race.label,
      candidates: candidates.map((u) => {
        const baseUnit = window.GameData.getUnit(u.typeId);
        return {
          label: u.name || baseUnit.label,
          description: `${baseUnit.label} -- at (${u.x}, ${u.y})`,
        };
      }),
      onAnswer: (index) => {
        const victim = candidates[index];
        if (victim && civ.units.includes(victim)) {
          civ.units = civ.units.filter((u) => u !== victim);
        }
        offerNextWispDisband(civ, onDone);
      },
    };
    redraw();
  }

  function openTechResearchedDialog(civ, techId, onDone) {
    const tech = window.GameData.getTech(techId);
    if (!tech) { if (onDone) onDone(); return; }
    const unlockedTechs = window.GameData.techsForRace(civ.raceId)
      .filter((id) => window.GameData.getTech(id).prereqs.includes(techId))
      .map((id) => ({ id, label: window.GameData.getTech(id).label }));
    window.SfxSystem.playResearchComplete();
    viewState.dialog = {
      kind: "techResearched",
      techLabel: tech.label,
      techDescription: tech.description || "",
      unlockedTechs,
      // Already-researching gate: a city's
      // "Research" boost action can finish `techId` early, mid-turn, ahead
      // of this notice actually showing (queued for round-end -- see
      // finishRoundBookkeeping). If the player had ALREADY picked a next
      // tech by then (civ.currentResearch is set again), offering "Choose
      // Next Research" here would re-prompt for a decision that's already
      // made -- dialog.js hides that button whenever this is true. Also
      // true when nothing on the tech tree is currently affordable (see
      // tech.js's hasAffordableResearch) -- prompting to pick a tech the
      // kingdom can't yet pay for isn't a real choice, just a nag.
      alreadyResearching: !!civ.currentResearch || !window.GameEngine.tech.hasAffordableResearch(civ),
      onChooseResearch: () => {
        // Defer onDone until the tech tree is actually CLOSED, rather than
        // firing it the instant the player clicks through to the tech tree
        // -- onDone is the head of
        // the unit-built-notice/pendingIntent chain (see
        // finishRoundBookkeeping), and firing it here raced a fresh
        // "unitBuilt" dialog open against the tech tree overlay the player
        // just asked for, stealing focus back immediately: "the research
        // selection screen is interrupted by messages for city production
        // completion." viewState.onTechTreeClosed is read (and cleared)
        // once, by the tech tree's own close button below.
        viewState.techTreeCivId = civ.id;
        viewState.onTechTreeClosed = onDone;
        lastRenderedTechTreeKey = null;
      },
      // "View" link next to each unlocked tech:
      // opens the tree already scrolled to and pulsing on that tech, with
      // its layer forced open even if it would otherwise be collapsed (see
      // techtree.js's render/renderNode focusTechId handling).
      onViewTech: (viewTechId) => {
        viewState.techTreeCivId = civ.id;
        viewState.techTreeFocusTechId = viewTechId;
        viewState.onTechTreeClosed = onDone;
        lastRenderedTechTreeKey = null;
      },
      onDismiss: () => { if (onDone) onDone(); },
    };
    redraw();
  }

  /** Unit-built announcements: drains
   *  civ.pendingUnitBuiltNotices one at a time (ai.js's
   *  queueUnitBuiltNotice pushes one per completed build -- an ARRAY since,
   *  unlike tech, more than one city can finish a unit in the same round),
   *  each its own modal, chained via its own onGoToCity/onGoToUnit answer
   *  so a second/third completion the same round never gets silently
   *  dropped behind the first. No-ops straight through if the queue is
   *  empty. Defensively skips a unit that's somehow already gone (died/
   *  disbanded) between being built and this notice firing -- shouldn't
   *  happen within the same round, but redraw()'s dialog rendering assumes
   *  a live unit. */
  /** Keep-or-raze after the human player conquers a city (2026-08-25).
   *  Drains civ.pendingCityCaptureDecisions one at a time, same chained shape
   *  as offerNextUnitBuiltNotice below, so taking two cities in one turn asks
   *  about both instead of silently keeping the second.
   *
   *  The city is ALREADY captured by the time this runs (see ai.js's conquest
   *  branch) -- that keeps game state consistent whenever the modal is
   *  answered, and makes "Raze it" simply destroyCity on a city the player
   *  now owns. Defensively skips a city that's no longer theirs, which can
   *  happen if it was retaken before they answered. */
  /** Convenience wrapper: offers any queued keep-or-raze decisions for the
   *  human civ, if there are any and no other modal is already up. Safe to
   *  call after any action that might have taken a city. */
  function maybeOfferCityCaptureDecisions(onDone) {
    const civ = humanCivId && gameState.civs[humanCivId];
    if (!civ || viewState.dialog) { if (onDone) onDone(); return; }
    if (!civ.pendingCityCaptureDecisions || !civ.pendingCityCaptureDecisions.length) { if (onDone) onDone(); return; }
    offerNextCityCaptureDecision(civ, onDone);
  }

  function offerNextCityCaptureDecision(civ, onDone) {
    const queue = civ.pendingCityCaptureDecisions;
    if (!queue || !queue.length) { if (onDone) onDone(); return; }
    const { cityName, formerOwnerId, city } = queue.shift();
    if (!civ.cities.includes(city)) { offerNextCityCaptureDecision(civ, onDone); return; }
    const formerCiv = gameState.civs[formerOwnerId];
    const formerRace = formerCiv ? window.GameData.getRace(formerCiv.raceId) : null;
    const finish = () => { redraw(); offerNextCityCaptureDecision(civ, onDone); };
    viewState.dialog = {
      kind: "cityCaptured",
      cityName,
      formerOwnerLabel: formerRace ? `the ${formerRace.label} Kingdom` : formerOwnerId,
      onAnswer: (keep) => {
        if (!keep) {
          window.GameEngine.cities.destroyCity(gameState, civ, city);
          // Razing our own just-taken city can't eliminate anyone (the
          // previous owner already lost it on capture), so no elimination
          // re-check is needed here -- unlike the AI raze path in ai.js.
          window.GameEngine.turns.refreshVisibility(gameState);
        }
        finish();
      },
    };
    redraw();
  }

  function offerNextUnitBuiltNotice(civ, onDone) {
    const notices = civ.pendingUnitBuiltNotices;
    if (!notices || !notices.length) { if (onDone) onDone(); return; }
    const { cityName, unit } = notices.shift();
    if (!civ.units.includes(unit)) { offerNextUnitBuiltNotice(civ, onDone); return; }
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const city = civ.cities.find((c) => c.name === cityName) || null;
    window.SfxSystem.playAction(civ.raceId, unit.typeId, "move");
    viewState.dialog = {
      kind: "unitBuilt",
      cityName,
      unitLabel: baseUnit.label,
      unitProperName: unit.name || baseUnit.label,
      onGoToCity: () => {
        if (city) {
          goToTile(city.x, city.y, "city");
          // Land ready to choose what's next, not one click short of it.
          // Used to open the sidebar's build picker; that picker is the ring
          // now (2026-08-06), so open the ring instead.
          viewState.ringMenu = { x: city.x, y: city.y, subject: "city", page: null };
        }
        offerNextUnitBuiltNotice(civ, onDone);
      },
      onGoToUnit: () => {
        goToTile(unit.x, unit.y, "unit");
        offerNextUnitBuiltNotice(civ, onDone);
      },
    };
    redraw();
  }

  /** Treasure find flavor text: names the
   *  object found, then its effect -- shared by the immediate "openChest"
   *  ring action below and offerNextTreasureNotice's deferred Ruin Delve
   *  notices, so both read identically. Trap results aren't routed through
   *  here -- nothing was "found," so they keep their own dedicated text. */
  function describeTreasureFind(unitLabel, result) {
    let found;
    if (result.rewardType === "mapFragment") {
      found = {
        title: "Map Fragment!",
        text: `${unitLabel} finds a map fragment -- unrolling it reveals a swath of unexplored land around (${result.revealed.x},${result.revealed.y}) for the rest of this turn.`,
      };
    } else if (result.rewardType === "xp") {
      found = {
        title: "Treasure Found!",
        text: `${unitLabel} finds an experience crystal -- absorbing it grants +${result.amount} XP.`,
      };
    } else if (result.rewardType === "lore") {
      found = {
        title: "Treasure Found!",
        text: `${unitLabel} finds an ancient tome -- its knowledge is worth +${result.amount} lore.`,
      };
    } else {
      found = {
        title: "Treasure Found!",
        text: `${unitLabel} finds a pile of gold coins -- worth +${result.amount} coin.`,
      };
    }
    // Orc's Plunder tech (2026-08-26, user-directed): a chest that paid
    // something other than coin also pays a bonus coin haul, tacked on
    // as a second sentence rather than its own branch above.
    if (result.bonusCoin) {
      found.text += ` Plunder turns up an extra ${result.bonusCoin} coin besides.`;
    }
    return found;
  }

  /** Ruin Delve treasure-find announcements:
   *  same drain-one-at-a-time-as-its-own-modal shape as
   *  offerNextUnitBuiltNotice above -- ai.js's queueTreasureNotice (called
   *  from turns.js's once-per-Ruin treasure roll) pushes one per find onto
   *  civ.pendingTreasureNotices. Set unconditionally for every civ (see
   *  queueTreasureNotice's own doc comment); only reached here for the
   *  human civ. */
  function offerNextTreasureNotice(civ, onDone) {
    const notices = civ.pendingTreasureNotices;
    if (!notices || !notices.length) { if (onDone) onDone(); return; }
    const { unitLabel, result } = notices.shift();
    const { title, text } = describeTreasureFind(unitLabel, result);
    window.SfxSystem.playTreasureChestOpen();
    viewState.dialog = { kind: "message", title, text, onDismiss: () => offerNextTreasureNotice(civ, onDone) };
    redraw();
  }

  /** Automate Actions confirmation queue: drains
   *  civ.units for a pendingIntent one at a time (staged by the
   *  unit.automated && !opts.forcedX gates in ai.js's considerAttackOrGarrison/
   *  maybeFoundCity/startDruidSummon), same one-at-a-time blocking-modal
   *  chaining convention as offerNextUnitBuiltNotice. Confirming re-invokes
   *  the SAME commit path a manual player action would use -- orders.js's
   *  attack() for combat, openFoundCityDialog for founding (so a confirmed
   *  automated founding gets identical naming/free-tech-choice treatment to
   *  a manual one), ai.js's startDruidSummon(..., confirmed=true) for
   *  summons. Declining just drops the intent -- the unit already spent its
   *  turn proposing it (see the usedThisTurn stamped alongside each
   *  pendingIntent), so it naturally reconsiders fresh next turn. */
  function offerNextPendingIntent(civ, onDone) {
    const unit = civ.units.find((u) => u.pendingIntent);
    if (!unit) { if (onDone) onDone(); return; }
    const intent = unit.pendingIntent;
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const finish = () => { unit.pendingIntent = null; offerNextPendingIntent(civ, onDone); };
    viewState.dialog = {
      kind: "confirmAutomatedAction",
      unitLabel: unit.name || baseUnit.label,
      actionLabel: intent.label,
      onConfirm: () => {
        if (intent.kind === "foundCity") {
          unit.pendingIntent = null;
          openFoundCityDialog(civ, unit, () => offerNextPendingIntent(civ, onDone));
          return;
        }
        if (intent.kind === "attack") {
          // The staging gate stamped usedThisTurn=true so runUnitTurn
          // wouldn't also move/act this same civ-turn (see
          // considerAttackOrGarrison) -- orders.js's attack() itself refuses
          // to fire on a unit already marked used, so that has to be undone
          // right here, immediately before the real attack call, not any
          // earlier (undoing it sooner would let something else spend the
          // unit's turn out from under this pending confirmation).
          unit.usedThisTurn = false;
          window.GameEngine.orders.attack(unit, gameState, intent.target, humanCivId);
        } else if (intent.kind === "summon") {
          const log = civ.lastAILog || [];
          window.GameEngine.ai.startDruidSummon(civ, unit, intent.summonUnitId, gameState, log, true);
        } else if (intent.kind === "summonWisp") {
          window.GameEngine.ai.performPlayerBogWitchSummon(civ, unit, intent.summonTargetX, intent.summonTargetY, gameState);
          window.GameEngine.turns.refreshVisibility(gameState);
        } else if (intent.kind === "setTrap") {
          window.GameEngine.ai.performPlayerTrapSet(civ, unit, intent.trapKind, intent.trapTargetX, intent.trapTargetY, gameState);
          window.GameEngine.turns.refreshVisibility(gameState);
        } else if (intent.kind === "createGreatBonfire") {
          window.GameEngine.ai.performPlayerWandererBonfireSummon(civ, unit, gameState);
          window.GameEngine.turns.refreshVisibility(gameState);
        } else if (intent.kind === "createMushroom") {
          window.GameEngine.ai.performPlayerMushroomancerCreateMushroom(civ, unit, gameState);
          window.GameEngine.turns.refreshVisibility(gameState);
        }
        finish();
      },
      onDecline: () => finish(),
    };
    redraw();
  }

  /**
   * Off-screen attack notice: a snapshot/diff
   * pair, NOT a hook threaded into combat.js/ai.js -- takes a cheap
   * before-picture of the human civ's own units'/cities' hp+position right
   * before a single enemy unit-step runs (see advanceTurn's processBatch
   * below), then compares after. Deliberately doesn't care WHY the hp
   * dropped (or the unit/city vanished) -- any of it reads as "this got
   * attacked," which is exactly what the player needs to hear about,
   * without this file needing to know anything about siege/splash/counter-
   * attack/spikes/wall-defense/etc mechanics or keep that list in sync as
   * new ones are added.
   */
  function snapshotHumanDefense() {
    if (!humanCivId) return null;
    const civ = gameState.civs[humanCivId];
    if (!civ) return null;
    return {
      units: civ.units.map((u) => ({ ref: u, hp: u.hp, x: u.x, y: u.y, typeId: u.typeId, name: u.name })),
      cities: civ.cities.map((c) => ({ ref: c, hp: c.hp, x: c.x, y: c.y, name: c.name })),
    };
  }

  /** Compares `before` (see snapshotHumanDefense) against the CURRENT state.
   *  Returns the first unit or city that lost hp or was destroyed since the
   *  snapshot was taken, as { x, y, label }, or null if nothing changed. */
  function detectHumanAttack(before) {
    if (!before || !humanCivId) return null;
    const civ = gameState.civs[humanCivId];
    if (!civ) return null;
    for (const snap of before.units) {
      const stillAlive = civ.units.includes(snap.ref);
      if (!stillAlive || snap.ref.hp < snap.hp) {
        const baseUnit = window.GameData.getUnit(snap.typeId);
        return { x: snap.x, y: snap.y, label: snap.name || baseUnit.label };
      }
    }
    for (const snap of before.cities) {
      const stillStanding = civ.cities.includes(snap.ref);
      if (!stillStanding || snap.ref.hp < snap.hp) {
        return { x: snap.x, y: snap.y, label: snap.name };
      }
    }
    return null;
  }

  /** Shows the "X is being attacked" modal (see js/ui/dialog.js's
   *  "attackNotice" kind) and pauses turn processing until it's answered.
   *  The camera has already been recentered on the attack by the caller
   *  (processBatch) by the time this dialog appears, so its effects are
   *  still animating in
   *  view behind it. "Go to" (via goToTile) mainly selects the attacked
   *  unit/city's own sidebar tab now rather than moving the camera (already
   *  there); "Skip" just dismisses without that tab switch. Either way,
   *  `onDone` is what actually continues processing the rest of the turn
   *  (advanceTurn's processBatch). */
  // Orientation pause: after "Go to Attack" on
  // the PRE-attack notice specifically (see its offerAttackNotice call
  // below), the player has just been dropped onto the scene but the fight
  // hasn't happened yet -- give them a beat to actually look at it before
  // resolvePendingAIAttack fires. Not applied to "Skip" (they explicitly
  // didn't ask to look) or to the post-hoc notice (that attack already
  // happened -- see its own offerAttackNotice call, which passes no delay).
  const ATTACK_NOTICE_GO_TO_DELAY_MS = 1000;
  // "X Kingdom Taking Its Turn..." banner pause, single player only -- see
  // advanceTurn's processBatch. All-AI Spectator keeps its own much
  // shorter, hardcoded 260ms cycle instead (that mode's whole appeal is
  // watching civs cycle fast).
  const TURN_BANNER_PAUSE_MS = 1500;
  // Post-attack pause (2026-08-19, user-directed): separate from the delay
  // above, which only ever ran BEFORE the hit landed (letting the camera
  // settle on "Go To", nothing at all on "Skip"). Once an AI attack against
  // the player actually resolves -- win, lose, or off-screen -- processBatch
  // used to immediately move on to the next AI unit's turn with zero pause,
  // so the floating damage number/HP bar change from the hit that just
  // landed was gone before the player had a chance to actually look at it.
  // Applied after EVERY attack-notice dismissal, "Go To" or "Skip" alike,
  // and to the post-hoc (already-happened) notice too -- see both call
  // sites below.
  const ATTACK_RESULT_PAUSE_MS = 1000;

  function offerAttackNotice(notice, onDone, { goToDelayMs = 0 } = {}) {
    viewState.dialog = {
      kind: "attackNotice",
      unitLabel: notice.label,
      onGoTo: () => {
        goToTile(notice.x, notice.y);
        if (goToDelayMs > 0) { redraw(); setTimeout(onDone, goToDelayMs); }
        else onDone();
      },
      onSkip: () => { onDone(); },
    };
    redraw();
  }

  /** Fires the attack an enemy AI unit staged instead of resolving
   *  immediately -- see processBatch's pendingAttack check and ai.js's
   *  considerAttackOrGarrison
   *  defenderIsHuman branch). Same forcedTarget re-invocation shape
   *  offerNextPendingIntent uses for the human's OWN automated units, minus
   *  the Confirm/Decline choice -- the player gets advance notice of an
   *  enemy's attack, not a veto over it, so this always proceeds once
   *  called. `unit.usedThisTurn` has to be undone first (the staging gate
   *  set it so runUnitTurn wouldn't also move/act this same civ-turn) --
   *  considerAttackOrGarrison/canAttackUnitNow would otherwise refuse a unit
   *  already marked used. */
  function resolvePendingAIAttack(civ, unit) {
    const intent = unit.pendingIntent;
    unit.pendingIntent = null;
    if (!civ || !intent || intent.kind !== "attack") return;
    unit.usedThisTurn = false;
    const weights = window.GameEngine.ai.racialWeights(civ);
    const log = civ.lastAILog || [];
    const didAttack = window.GameEngine.ai.considerAttackOrGarrison(
      civ, unit, gameState, weights, aiDifficulty, log, { forcedTarget: intent.target.unit });
    if (log.length) window.GameEngine.ai.appendAIActionLog(gameState, civ.id, log);
    if (didAttack) {
      window.GameEngine.orders.invalidateReachCache();
      window.GameEngine.turns.refreshVisibility(gameState);
    }
  }

  /**
   * Advances exactly ONE unit's turn (per gameState.turnOrder/turnStepIndex/
   * _civTurnCtx -- see turns.js's advanceOneUnitStep), redraws, and runs the
   * once-per-round bookkeeping once the round actually completes. This is
   * what makes AI units visibly act one at a time, in the order they were
   * created, in spectator mode (see startAutoplay, which calls this once
   * per timer tick) instead of a whole civ's army resolving at once.
   */
  function advanceOneStep() {
    // "Start of round" now means turnStepIndex is still 0 AND there's no
    // civ mid-turn (_civTurnCtx null) -- turnStepIndex alone no longer flips
    // away from 0 on every call the way it did when each call advanced a
    // whole civ; it now only advances once a civ's LAST unit has stepped.
    if (!(gameState.turnStepIndex > 0) && !gameState._civTurnCtx) {
      pendingPreUnitCounts = {};
      for (const civ of Object.values(gameState.civs)) pendingPreUnitCounts[civ.id] = civ.units.length;
    }

    const difficultyByCiv = {};
    for (const civId of Object.keys(gameState.civs)) {
      if (civId !== humanCivId) difficultyByCiv[civId] = aiDifficulty;
    }
    const stepResult = window.GameEngine.turns.advanceOneUnitStep(gameState, { humanCivId, difficultyByCiv });
    if (stepResult.roundComplete) finishRoundBookkeeping(stepResult.victoryResult);
    redraw();
    return stepResult;
  }

  /**
   * Human-mode "End Turn": resolves the whole round synchronously in one
   * click, same end-to-end behavior as before this change -- just built on
   * the same granular per-unit stepping API spectator mode now uses for its
   * visible one-at-a-time stagger (many more loop iterations than before,
   * one per AI unit rather than one per civ, but still fully synchronous).
   * (Redraw happens on every intermediate step too, but since this loop
   * runs synchronously with no yield back to the browser, only the final
   * state actually paints -- no mid-loop flicker.)
   */
  /** Turn-progress banner: End Turn used to
   *  resolve every other civ's whole turn synchronously in one blocking
   *  pass -- nothing painted until it was over, however long that took, so
   *  the player just sat looking at their last move with no feedback that
   *  anything was happening. Still resolves each CIV's own units in one
   *  tight synchronous batch (unchanged -- no per-unit pause, that would
   *  make a big army's turn crawl), but now yields via setTimeout at each
   *  civ BOUNDARY specifically so the "<Race> Kingdom Taking Its Turn..."
   *  banner set just before the yield actually gets a chance to paint.
   *  Skips announcing the human civ's own (already-acted) segment. */
  /** Idle-city default: a city the player never
   *  gave an action to this turn defaults to Gather Resources rather than
   *  producing nothing at all -- matches the confirmEndTurn dialog's own
   *  "these will gather resources" text (see collectUnresolvedTurnWork's
   *  caller in dialog.js), so it fires here at the one spot BOTH the
   *  reminder-confirmed-anyway path and the no-reminder-shown path funnel
   *  through before the round actually resolves. isCityIdle is the exact
   *  same predicate the reminder itself used to flag these cities, so
   *  nothing already spoken for (a build, resources, research) is touched. */
  function defaultIdleCitiesToGatherResources() {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    for (const city of civ.cities) {
      if (window.GameEngine.cities.isCityIdle(civ, city, gameState)) {
        window.GameEngine.cities.applyResourceProduction(city, civ, gameState);
      }
    }
  }

  function advanceTurn() {
    defaultIdleCitiesToGatherResources();
    let announcedCivId = null;
    function processBatch() {
      let stepResult;
      do {
        // Off-screen attack notice: checked
        // around every single unit-step, not just once per civ/round, so an
        // attack pauses the batch the moment it happens rather than after
        // however many more units act first. Skipped on the step that
        // completes the round -- finishRoundBookkeeping's own tech/unit-
        // built/pendingIntent dialog chain already claims viewState.dialog
        // for that step, and round-end is rare enough as the exact instant
        // of an attack that this is an acceptable gap.
        const preAttackSnap = snapshotHumanDefense();
        stepResult = advanceOneStep();
        if (stepResult.roundComplete) {
          viewState.turnBanner = null;
          redraw();
          return;
        }

        // Pre-attack notice: a true BEFORE-the-
        // hit hook, not the post-hoc snapshot-diff below. An AI unit that
        // just decided to attack a human-owned unit stages that decision
        // instead of resolving it (see ai.js's considerAttackOrGarrison's
        // defenderIsHuman branch) -- stepResult.steppedUnit is that exact
        // unit, so its pendingIntent (if any) is checked here, BEFORE the
        // loop's own detectHumanAttack call below, and resolved via
        // resolvePendingAIAttack only once the player has seen the notice.
        const steppedUnit = stepResult.steppedUnit;
        const pendingAttack = steppedUnit && steppedUnit.civId !== humanCivId
          && steppedUnit.pendingIntent && steppedUnit.pendingIntent.kind === "attack"
          ? steppedUnit.pendingIntent : null;
        if (pendingAttack && pendingAttack.target.civ?.isHuman) {
          const targetUnit = pendingAttack.target.unit;
          const onScreen = window.UI.render.isTileOnScreen(targetUnit.x, targetUnit.y, $("map-canvas"), gameState, viewState);
          if (!onScreen) centerViewOn(targetUnit.x, targetUnit.y);
          redraw();
          // Already-visible skip (2026-08-24 bugfix): this branch used to
          // always show the modal, only using onScreen to decide whether to
          // recenter -- the fallback notice just below already skipped the
          // whole modal when on-screen, this one now matches it.
          if (onScreen) {
            resolvePendingAIAttack(gameState.civs[steppedUnit.civId], steppedUnit);
            redraw();
            setTimeout(processBatch, ATTACK_RESULT_PAUSE_MS);
            return;
          }
          const targetBaseUnit = window.GameData.getUnit(targetUnit.typeId);
          offerAttackNotice(
            // 2026-08-24 bugfix: this used to read the ATTACKER's
            // (steppedUnit's) name/label instead of the defender's.
            { x: targetUnit.x, y: targetUnit.y, label: targetUnit.name || targetBaseUnit.label },
            () => {
              resolvePendingAIAttack(gameState.civs[steppedUnit.civId], steppedUnit);
              redraw();
              setTimeout(processBatch, ATTACK_RESULT_PAUSE_MS);
            },
            { goToDelayMs: ATTACK_NOTICE_GO_TO_DELAY_MS },
          );
          return;
        }

        const notice = detectHumanAttack(preAttackSnap);
        if (notice && !window.UI.render.isTileOnScreen(notice.x, notice.y, $("map-canvas"), gameState, viewState)) {
          // Fallback for damage that doesn't come through the pre-attack
          // hook above -- wall auto-attacks, Burning ticks, Fireball splash,
          // siege, anything else that changes the human civ's hp without an
          // ai.js considerAttackOrGarrison decision to hang a pre-attack
          // pause on. Arrive at the site immediately, not only once the
          // player manually clicks "Go to" on the dialog below -- see
          // offerAttackNotice for the dialog itself.
          centerViewOn(notice.x, notice.y);
          redraw();
          offerAttackNotice(notice, () => setTimeout(processBatch, ATTACK_RESULT_PAUSE_MS));
          return;
        }
      } while (!stepResult.steppedCivId || stepResult.steppedCivId === announcedCivId || stepResult.steppedCivId === humanCivId);
      announcedCivId = stepResult.steppedCivId;
      const civ = gameState.civs[announcedCivId];
      const race = window.GameData.getRace(civ.raceId);
      viewState.turnBanner = `${race.label} Kingdom Taking Its Turn...`;
      redraw();
      // Single player (2026-08-26, user-directed; shortened to 1.5s on
      // 2026-09-04): long enough to actually read the banner before it's
      // overwritten by the next civ's. All-AI Spectator keeps the original
      // quick cycle -- that mode's whole appeal is watching many civs cycle
      // fast, even faster still at the Speed menu's higher multipliers, and
      // a forced per-civ floor would fight that at every setting.
      setTimeout(processBatch, spectatorMode ? 260 : TURN_BANNER_PAUSE_MS);
    }
    processBatch();
  }

  /** True while an interactive control (a <select> or <input>) inside
   *  `container` is focused -- used to defer an innerHTML data-refresh
   *  rebuild of that container during autoplay, same root cause as the
   *  reports/techtree Close-button fix above: at high game speed the
   *  content div gets rebuilt many times a second, and rebuilding while a
   *  <select>'s native options popup is open yanks that element out from
   *  under the click, which the browser reports as the dropdown simply
   *  closing itself before a pick can land (e.g. the "AI Tech Trees" civ
   *  picker). Skipping the rebuild while focused doesn't lose the pending
   *  refresh -- lastRenderedReportKey/lastRenderedTechTreeKey are left
   *  unchanged, so the very next redraw() after the control blurs (a
   *  selection was made, or the user clicked elsewhere) picks it up. */
  function hasFocusedControlIn(container) {
    const active = document.activeElement;
    return !!(container && active && container.contains(active) &&
      (active.tagName === "SELECT" || active.tagName === "INPUT" || active.tagName === "TEXTAREA"));
  }

  function redraw() {
    // Immediate victory/kingdom-elimination checks (2026-08-17,
    // user-directed) -- run first, before anything else in this function,
    // so a dialog either one raises is what the very rebuild about to
    // happen actually reflects, same "settle state before drawing" ordering
    // the tab-rebuild comment just below already follows for a different
    // reason. See their own doc comments just above this function.
    checkImmediateVictory();
    checkPendingKingdomEliminations();

    // Rebuild the selected tile's tab list from live state BEFORE anything
    // draws. The tabs hold direct references to units/cities/structures, any
    // of which can die, move, or be captured between redraws (autoplay does
    // this constantly), and the map renderers read the legacy
    // viewState.selected* fields this derives -- so it has to run ahead of
    // both of them, not just ahead of the sidebar. See input.js's
    // SELECTION MODEL comment.
    window.UI.input.resolveSelection(gameState, viewState);
    // Same staleness guard as the real selection, for whatever's merely
    // being peeked at (viewState.inspect) -- see input.js's INSPECT doc
    // comment. No-ops when nothing is being inspected.
    window.UI.input.resolveInspect(gameState, viewState);
    if (viewState.is3D) {
      window.UI.render3d.render($("map-canvas-3d"), gameState, viewState);
    } else {
      window.UI.render.render($("map-canvas"), gameState, viewState);
    }
    window.UI.sidebar.render($("sidebar"), gameState, viewState);
    // Mirrors turn/stockpile/research progress into BOTH the mobile status/
    // research pills and their desktop menu-bar equivalents (2026-08-27),
    // plus the mobile FAB's awaiting-orders badge (that part alone stays a
    // true no-op on desktop -- the FAB itself is mobile-only markup).
    updateMobileStatus();
    const zoomLabel = $("zoom-level-label");
    if (zoomLabel) zoomLabel.textContent = `${Math.round((viewState.zoomLevel || 1) * 100)}%`;
    // Unit verbs and city production live in the radial map menu
    // (renderRingMenu / handleContextMenuAction); the sidebar only owns
    // the footer buttons, since everything else here is just information.
    // wireLongPress, not a plain .onclick, since a long-press on this same
    // button must always end the turn (see its own doc comment) -- re-wired
    // every redraw same as .onclick always was, because sidebar.js rebuilds
    // this element's innerHTML (a fresh node) each time, taking any
    // previously-attached listeners with it.
    wireLongPress($("end-turn-btn"), handleEndTurnButtonClick, handleEndTurnClick);
    const nextUnitBtn = $("next-unit-btn");
    if (nextUnitBtn) nextUnitBtn.onclick = handleNextUnit;
    const nextIdleCityBtn = $("next-idle-city-btn");
    if (nextIdleCityBtn) nextIdleCityBtn.onclick = handleNextIdleCity;
    const openResearchBtn = $("open-research-btn");
    if (openResearchBtn) openResearchBtn.onclick = () => { viewState.techTreeCivId = humanCivId; redraw(); };

    // Tile-inspector tabs, plus the in-panel shortcuts that jump to one (the
    // city panel's garrison list and the terrain panel's contents list) --
    // both carry the same data-tab-index, so one handler covers them.
    // data-inspect marks a button rendered for a peek (sidebar.js's
    // isInspect) rather than the real selection -- routes to the INSPECT
    // counterpart so switching tabs within a peek can never touch the real
    // selection (see input.js's INSPECT doc comment).
    for (const btn of document.querySelectorAll(".tile-tab, .tile-tab-link")) {
      btn.onclick = () => {
        if (btn.dataset.inspect) {
          window.UI.input.setInspectActiveTab(gameState, viewState, Number(btn.dataset.tabIndex));
        } else {
          window.UI.input.setActiveTab(gameState, viewState, Number(btn.dataset.tabIndex));
        }
        redraw();
      };
    }

    // Tile links: anything in the sidebar that
    // names a specific tile -- a city in the Kingdom tab, the coordinates
    // inside an AI unit's mission text, a queued building's chosen site --
    // jumps the map there. See sidebar.js's tileLink/linkifyCoords for the
    // markup and goToTile below for what "jump" means.
    for (const btn of document.querySelectorAll(".tile-link")) {
      btn.onclick = () => goToTile(
        Number(btn.dataset.tileX), Number(btn.dataset.tileY), btn.dataset.tileTab || null);
    }

    for (const btn of document.querySelectorAll(".view-tech-tree-btn")) {
      btn.onclick = () => { viewState.techTreeCivId = btn.dataset.civId; redraw(); };
    }

    // The Close button on each of these modals is static markup in
    // index.html now, OUTSIDE the div whose innerHTML gets replaced when the
    // underlying data refreshes (#techtree-content/#reports-content) -- it
    // used to be part of that same regenerated markup, which meant every
    // data refresh during autoplay (once per round -- the report/tech-tree
    // data itself changes that often) destroyed and recreated the Close
    // button along with it. A click straddling that instant landed on an
    // element that had already been removed from the DOM, so nothing fired
    // -- this is what looked like "the browser stealing focus" at high
    // speed; it wasn't focus, it was the button itself getting swapped out
    // from under the click. The button is now permanently stable for as
    // long as the modal stays open, so its onclick is simply reassigned
    // every redraw() call (cheap -- same node every time) instead of only
    // right after a rebuild. The content div's rebuild is still gated on an
    // identity key purely as a data-refresh-rate optimization now, not as
    // the fix itself.
    const overlay = $("techtree-overlay");
    if (viewState.techTreeCivId && gameState.civs[viewState.techTreeCivId]) {
      const isPlayerCiv = viewState.techTreeCivId === humanCivId;
      // The player's own tree also has to rebuild the moment they PICK
      // something, not just once per turn -- otherwise the node they clicked
      // wouldn't visibly become "Researching" until the turn rolled over.
      const civ = gameState.civs[viewState.techTreeCivId];
      // "Just opened": the overlay's display is always reset to "none" by
      // the close handler below, and only ever set back to "flex" by this
      // block -- so display not already being "flex" here means this render
      // is the first one since the screen opened, which is the one-shot
      // moment to auto-center on the highest available layer (skipped if a
      // focusTechId link is also driving its own scroll target this render
      // -- that one wins).
      const justOpened = overlay.style.display !== "flex";
      // Level 0 collapsed by default (2026-08-27, user-directed) -- it's
      // auto-granted for free at civ creation (createNewGame) and never has
      // anything to research, so it's pure clutter every tree opens under.
      // Lazy-inited here rather than at every viewState.techTreeCivId
      // assignment (there are several call sites) -- closeTechTreeOverlay
      // resets it to null so this always re-defaults on the NEXT open,
      // while still surviving re-renders (research picks, hovers) within
      // one open session.
      if (!viewState.techTreeCollapsedLayers) viewState.techTreeCollapsedLayers = new Set([0]);
      const key = `${viewState.techTreeCivId}:${gameState.turnNumber}:${civ.currentResearch || ""}`;
      if (key !== lastRenderedTechTreeKey) {
        const focusTechId = viewState.techTreeFocusTechId || null;
        // A cross-link's target has to actually be visible to scroll/pulse
        // onto -- force its own layer open even if it's Level 0.
        if (focusTechId) {
          const focusTech = window.GameData.getTech(focusTechId);
          if (focusTech) viewState.techTreeCollapsedLayers.delete(focusTech.layer ?? 1);
        }
        $("techtree-content").innerHTML = window.UI.techtree.render(
          civ, isPlayerCiv, focusTechId, viewState.techTreeHoverId || null, false, viewState.techTreeCollapsedLayers);
        lastRenderedTechTreeKey = key;
        if (focusTechId) {
          viewState.techTreeFocusTechId = null; // one-shot: scroll/pulse once, not on every future open
          // display has to be "flex" (not the pre-open "none") BEFORE
          // scrollIntoView runs, or the overlay's still-unlaid-out subtree
          // gives it nothing to scroll (2026-08-10 bug fix -- overlay.style.
          // display used to be set only at the bottom of this block, after
          // this ran).
          overlay.style.display = "flex";
          const node = $("techtree-content").querySelector(`.techtree-node[data-tech-id="${focusTechId}"]`);
          if (node) node.scrollIntoView({ block: "center", behavior: "smooth" });
        } else if (justOpened) {
          // Same display-before-scroll ordering as the focusTechId case
          // above. Rows render in ascending layer order, so the LAST
          // data-avail="true" row is the highest available layer -- no
          // available layer at all (everything done/unaffordable) just
          // leaves the view at its default scroll position.
          overlay.style.display = "flex";
          const rows = $("techtree-content").querySelectorAll('.techtree-layer[data-avail="true"]');
          const target = rows[rows.length - 1];
          if (target) target.scrollIntoView({ block: "center" });
        }
      }
      $("techtree-close-btn").onclick = () => {
        closeTechTreeOverlay();
        redraw();
      };
      // "Skip" (2026-08-28, user-directed): only meaningful while this IS
      // the "you need to pick research" screen -- the player's own tree,
      // with nothing currently selected. Browsing an ally/AI civ's tree
      // (isPlayerCiv false) or your own tree just to plan ahead while
      // something's already researching gets no Skip button, same scoping
      // collectUnresolvedTurnWork's own nag uses.
      const skipBtn = $("techtree-skip-btn");
      if (skipBtn) {
        skipBtn.style.display = (isPlayerCiv && !civ.currentResearch) ? "flex" : "none";
        skipBtn.onclick = () => {
          // +2, not +1: suppresses the nag for the REST of this turn AND
          // all of next turn, only resuming once next turn actually ends --
          // see collectUnresolvedTurnWork/handleNextAttentionItem's matching
          // researchSkipUntilTurn check. A plain "Choose Research" from the
          // sidebar still works at any time; this only snoozes the
          // automatic nag/jump, it doesn't block a manual pick.
          civ.researchSkipUntilTurn = (gameState.turnNumber || 0) + 2;
          closeTechTreeOverlay();
          redraw();
        };
      }
      // Research selection (player's own tree only -- renderNode only emits
      // these buttons when isPlayerCiv).
      for (const node of document.querySelectorAll(".techtree-node-selectable")) {
        node.onclick = () => {
          window.GameEngine.tech.chooseResearch(civ, node.dataset.techId);
          redraw();
        };
      }
      // Layer collapse/expand toggles (techtree.js's per-layer
      // .techtree-layer-label button). Forces a rebuild the same way the
      // hover handlers below do, since collapse state isn't part of the
      // identity key either.
      for (const btn of document.querySelectorAll("[data-layer-toggle]")) {
        btn.onclick = () => {
          const layer = Number(btn.dataset.layerToggle);
          if (viewState.techTreeCollapsedLayers.has(layer)) viewState.techTreeCollapsedLayers.delete(layer);
          else viewState.techTreeCollapsedLayers.add(layer);
          lastRenderedTechTreeKey = null;
          redraw();
        };
      }
      // Unit/condition cross-links (techtree.js's renderNode) -- this
      // overlay is a SEPARATE modal from the Knowledge Base's own, so
      // following one has to close this before the Knowledge Base can show;
      // see wireTechTreeKbLinks's own doc comment on why a redraw() has to
      // land in between rather than folding into jumpTo*FromTechTree itself.
      wireTechTreeKbLinks($("techtree-content"), () => { closeTechTreeOverlay(); redraw(); });
      // Hover prereq/unlock highlighting: hovering any node highlights its
      // prereq ancestors and whatever it unlocks with a colored border,
      // nothing else -- no dimming of unrelated nodes, and layers never
      // expand/collapse from a hover (see techtree.js's
      // computeRelations/relationKindFor). Forces
      // a rebuild the same way the toggle handler above does
      // (mouseenter/mouseleave aren't part of the identity key), so the
      // highlight classes actually appear. The node the cursor is
      // physically over gets swapped out by that rebuild, but browsers
      // don't re-fire mouseenter for a DOM swap under a stationary cursor
      // -- that's fine here, since the highlight comes from
      // viewState.techTreeHoverId (already set) being baked into the fresh
      // render, not from a second mouseenter; the freshly-wired node's own
      // mouseleave still fires normally on real pointer movement.
      for (const node of document.querySelectorAll(".techtree-node[data-tech-id]")) {
        node.onmouseenter = () => {
          if (viewState.techTreeHoverId === node.dataset.techId) return;
          viewState.techTreeHoverId = node.dataset.techId;
          lastRenderedTechTreeKey = null;
          redraw();
        };
        node.onmouseleave = () => {
          if (!viewState.techTreeHoverId) return;
          viewState.techTreeHoverId = null;
          lastRenderedTechTreeKey = null;
          redraw();
        };
      }
      overlay.style.display = "flex";
    } else {
      lastRenderedTechTreeKey = null;
      if (overlay) overlay.style.display = "none";
    }

    const reportsOverlay = $("reports-overlay");
    if (viewState.reportView) {
      // AI Actions grows every civ-turn (not once per round like history),
      // so it needs its own freshness signal -- gameState.history.turns.length
      // would barely ever change while this view is open. AI Tech Trees also
      // changes every civ-turn (research progress %, completions) -- same
      // reasoning as the tech-tree overlay's own key just above, keyed on
      // turnNumber rather than history length.
      const key = viewState.reportView === "ai_actions"
        ? `ai_actions:${gameState.aiActionLog ? gameState.aiActionLog.length : 0}`
        : viewState.reportView === "ai_tech_trees"
        ? `ai_tech_trees:${gameState.turnNumber}`
        : `${viewState.reportView}:${gameState.history ? gameState.history.turns.length : 0}`;
      if (key !== lastRenderedReportKey && !hasFocusedControlIn($("reports-content"))) {
        $("reports-content").innerHTML = window.UI.reports.render(gameState, viewState.reportView);
        lastRenderedReportKey = key;
      }
      // Widen the modal for AI Tech Trees' 4-column grid (see .reports-modal-
      // wide in style.css) -- every other report type keeps the narrower
      // default sized for its chart/log content.
      $("reports-modal").classList.toggle("reports-modal-wide", viewState.reportView === "ai_tech_trees");
      $("reports-close-btn").onclick = () => {
        viewState.reportView = null;
        // Hands the game-over screen back if that's what sent the player
        // here (see openGameOverDialog's onViewInfluenceReport) -- otherwise
        // this is the ordinary top-menu Reports flow and there's nothing to
        // restore.
        if (viewState.dialogBeforeReport) {
          viewState.dialog = viewState.dialogBeforeReport;
          viewState.dialogBeforeReport = null;
        }
        redraw();
      };
      reportsOverlay.style.display = "flex";
    } else {
      lastRenderedReportKey = null;
      if (reportsOverlay) reportsOverlay.style.display = "none";
    }

    const dialogOverlay = $("game-dialog-overlay");
    if (viewState.dialog) {
      if (viewState.dialog !== lastRenderedDialog) {
        const modal = $("game-dialog-modal");
        modal.innerHTML = window.UI.dialog.render(viewState.dialog);
        // Victory stats gets the grander treatment plus the winning
        // kingdom's own gilded border (2026-08-20, user-directed) -- same
        // race-<raceId> class convention sidebar.js uses for the sidebar's
        // border, see style.css's ".sidebar.race-*"/".game-dialog-victory.
        // race-*" rules. Every other dialog kind keeps the plain base class.
        // cityAutomation drops .game-dialog-modal deliberately: that class
        // sets overflow-y:auto on the modal itself, which would scroll its
        // X button away with the content. It supplies its own
        // .techtree-modal-scroll body wrapper instead (see dialog.js), the
        // same chrome-fixed/body-scrolls split the tech tree uses.
        modal.className = viewState.dialog.kind === "victoryStats"
          ? `techtree-modal game-dialog-modal game-dialog-victory race-${viewState.dialog.raceId}`
          : viewState.dialog.kind === "cityAutomation"
            ? "techtree-modal game-dialog-automation"
            : "techtree-modal game-dialog-modal";
        lastRenderedDialog = viewState.dialog;
        wireDialogButtons(viewState.dialog);
        // Confirm-action sfx: fires once, right
        // here, the instant a confirm-an-action prompt is FIRST shown to the
        // player -- not on the button click that answers it (that's
        // playButtonClick's job, via main.js's global click listener).
        // Scoped to dialog kinds that are actually asking "are you sure you
        // want to do this?" (Disband Unit's generic "confirm", Found City,
        // the End Turn unresolved-work nag, an Automate Actions proposal) --
        // NOT the purely informational kinds (message/techResearched/
        // unitBuilt) or the N-way "chooseTech" picker, neither of which fit
        // "confirm an action."
        if (CONFIRM_ACTION_DIALOG_KINDS.has(viewState.dialog.kind)) {
          window.SfxSystem.playConfirmAction();
        }
      }
      dialogOverlay.style.display = "flex";
    } else {
      lastRenderedDialog = null;
      if (dialogOverlay) dialogOverlay.style.display = "none";
    }

    renderRingMenu();

    const turnBanner = $("turn-progress-banner");
    if (turnBanner) {
      if (viewState.turnBanner) {
        turnBanner.textContent = viewState.turnBanner;
        turnBanner.style.display = "block";
      } else {
        turnBanner.style.display = "none";
      }
    }
  }

  /**
   * RADIAL MAP MENU -- see js/ui/ringmenu.js for
   * the geometry and js/engine/orders.js for what each subject is offered.
   *
   * Two things this has to get right, both learned the hard way elsewhere in
   * this file:
   *
   * 1. DOM STABILITY. The markup is rebuilt only when the identity key
   *    changes (subject, tile, page, and the exact option kinds), the same
   *    guard the tech tree and reports blocks use above -- redraw() runs on
   *    every hover, every animation-driven state change and every autoplay
   *    tick, and replacing a button's node out from under an in-flight click
   *    silently eats it. Positioning and click wiring are then re-applied to
   *    those STABLE nodes every redraw, so the ring still follows the map
   *    when it's panned or zoomed while open. Reassigning .onclick on the
   *    same node is idempotent and leak-free, same convention as the sidebar.
   *
   * 2. LIVENESS. The old menu self-closed when its option list came back
   *    empty, which is necessary but not sufficient: a city captured while
   *    the ring is open still returns a perfectly good option list -- for its
   *    NEW owner. So the subject is re-resolved against live state each pass,
   *    and the ring also closes if the map has scrolled its subject off the
   *    screen (a Next Unit jump, say), rather than floating over unrelated
   *    terrain.
   */
  function renderRingMenu() {
    const root = $("map-context-menu-root");
    if (!root) return;
    const close = () => {
      viewState.ringMenu = null;
      lastRenderedRingKey = null;
      root.innerHTML = "";
    };

    const menu = viewState.ringMenu;
    const canvas = $("map-canvas");
    if (!menu || !humanCivId || !canvas) return close();
    if (!window.UI.render.isTileOnScreen(menu.x, menu.y, canvas, gameState, viewState)) return close();

    // Subject liveness, re-resolved against live state every pass. An empty
    // option list is NOT a sufficient test on its own: a city captured while
    // its ring is open still returns a perfectly good list -- for its new
    // owner -- and a unit that died mid-turn would leave its ring hanging
    // over whatever moved onto the tile.
    const civ = gameState.civs[humanCivId];
    const city = civ && civ.cities.find((c) => c.x === menu.x && c.y === menu.y);
    const unit = viewState.selectedUnit;
    const orders = window.GameEngine.orders;
    let options, split = null;
    if (menu.subject === "city") {
      if (!city) return close();
      options = orders.cityRingOptions(city, gameState, humanCivId).concat(orders.ABOUT_THIS_SPACE_OPTION);
    } else if (menu.subject === "tile") {
      // Nothing of the player's own on this tile at all -- see orders.js's
      // mapMenuOptions doc comment on ABOUT_THIS_SPACE_OPTION. The only
      // subject with no unit/city requirement at all, so it's checked before
      // the canCommand guard just below rather than falling through it.
      options = [orders.ABOUT_THIS_SPACE_OPTION];
    } else {
      if (!orders.canCommand(unit, gameState, humanCivId)) return close();
      const unitOptions = orders.contextMenuOptions(unit, gameState, menu.x, menu.y, humanCivId)
        .concat(orders.ABOUT_THIS_SPACE_OPTION);
      // CATEGORY RING: only when the ring's own tile IS the unit's own tile
      // -- a unit ring aimed at a REMOTE tile (moveTo/attack against
      // something elsewhere) still gets the single city:open cross-link a
      // few lines down, not a category split, since there's no single
      // shared tile to anchor it to. See orders.js's mapMenuOptions doc
      // comment for the same distinction made there.
      //
      // Two-step rather than one merged two-column ring (2026-08-27,
      // user-directed): the ring opens with just "<Unit> Actions"/"City
      // Actions", and picking one swaps in that side's own options via
      // menu.page -- same page mechanic buildRingPage's popovers use, just
      // rendered as a normal ring instead of a rich popover, and with its
      // own synthetic "Back" pill (category:back) since there's no
      // buildRingPage entry backing it.
      if (city && unit.x === menu.x && unit.y === menu.y) {
        const cityOptions = orders.cityRingOptions(city, gameState, humanCivId);
        if (!cityOptions.length) {
          options = unitOptions;
        } else if (menu.page === "unitActions") {
          options = unitOptions.concat([{ kind: "category:back", label: "Back" }]);
        } else if (menu.page === "cityActions") {
          options = cityOptions.concat([{ kind: "category:back", label: "Back" }, orders.ABOUT_THIS_SPACE_OPTION]);
        } else {
          const unitLabel = window.GameData.getUnit(unit.typeId).label;
          // Rest and Defend is a standing, channeled order (see orders.js's
          // own doc comment on it) -- worth flagging right on this pill so
          // the player doesn't have to drill in to notice the unit is
          // parked defending rather than idle. A one-off Defend (AI-only,
          // ai.js's performDefend) sets the same conditions.defending but
          // isn't this channel, so it deliberately doesn't qualify.
          const unitActionsLabel = unit.channeling === "restAndDefend"
            ? `${unitLabel} Actions (defending)`
            : `${unitLabel} Actions`;
          options = [
            { kind: "category:unit", label: unitActionsLabel },
            { kind: "category:city", label: "City Actions" },
            orders.ABOUT_THIS_SPACE_OPTION,
          ];
        }
      } else {
        options = unitOptions;
        if (city) options.push({ kind: "city:open", label: "City Actions" });
      }
    }

    // Keyboard-shortcut hints: a static badge on the two pills that always
    // have one. Movement (arrow keys) has no single fixed pill to annotate
    // this way -- "moveTo" only exists dynamically once a destination tile
    // is clicked -- so it's left without a ring badge, a scoping call
    // rather than an oversight.
    for (const o of options) {
      if (o.kind === "restAndDefend" || o.kind === "city:resourceProduction") o.shortcut = "Space";
    }

    const center = window.UI.render.tileCenterOnMap(menu.x, menu.y, canvas, gameState, viewState);
    const ctx = {
      cx: center.x, cy: center.y, ts: center.ts,
      // CSS pixels: the ring is positioned in DOM space, and the canvas
      // buffer is DPR-scaled (see resizeMapCanvas).
      mapW: canvas.__cssW || canvas.width, mapH: canvas.__cssH || canvas.height, split,
    };

    // A sub-page (build list, level-up picker) replaces the ring rather than
    // sitting alongside it -- see ringmenu.js's renderPopover. Its own markup
    // and wiring, but the same root, key and reposition machinery.
    const page = menu.page ? buildRingPage(menu, city, unit, civ) : null;
    if (menu.page && !page) { viewState.ringMenu.page = null; }
    if (!page && !options.length) return close();

    const key = page
      ? `page:${menu.subject}:${menu.x},${menu.y}:${menu.page}:${page.body.length}`
      : `${menu.subject}:${menu.x},${menu.y}::${options.map((o) => o.kind).join("|")}`;

    // Reposition first and rebuild only if that reports the markup is no
    // longer the right shape -- so a pan or zoom with the ring open moves the
    // existing buttons instead of replacing them.
    if (key !== lastRenderedRingKey || !window.UI.ringmenu.position(root, options, ctx)) {
      root.innerHTML = page
        ? window.UI.ringmenu.renderPopover(page.title, page.body)
        : window.UI.ringmenu.render(options, ctx);
      window.UI.ringmenu.position(root, options, ctx);
      lastRenderedRingKey = key;
    }
    for (const btn of root.querySelectorAll(".map-ring-item")) {
      btn.onclick = () => handleContextMenuAction(btn.dataset.ringKind);
    }
    // The sub-page's own controls. Wired HERE rather than in redraw()'s
    // sidebar block, which runs earlier and would never see these nodes.
    for (const btn of root.querySelectorAll("[data-ring-back]")) {
      btn.onclick = () => { viewState.ringMenu.page = null; redraw(); };
    }
    for (const btn of root.querySelectorAll(".build-option")) {
      btn.onclick = () => handleChooseBuild(Number(btn.dataset.buildIndex));
    }
    for (const btn of root.querySelectorAll(".level-up-btn")) {
      btn.onclick = () => handleChooseLevelUp(btn.dataset.levelUpStat);
    }
  }

  /** The contents of whichever ring sub-page is open, or null if it can no
   *  longer be shown (the city started building, the level-ups were spent) --
   *  in which case renderRingMenu drops back to the ring itself. */
  function buildRingPage(menu, city, unit, civ) {
    if (menu.page === "buildUnit" || menu.page === "buildStructure") {
      if (!city || city.buildQueue) return null;
      const kind = menu.page === "buildUnit" ? "unit" : "building";
      return {
        title: kind === "unit" ? "Build Unit" : "Build Structure",
        body: window.UI.buildlist.render(civ, city, gameState, kind),
      };
    }
    if (menu.page === "levelUp") {
      if (!unit || window.GameEngine.combat.pendingLevelUps(unit) <= 0) return null;
      return { title: "Level Up", body: window.UI.sidebar.levelUpChoicesHtml(unit, civ, gameState) };
    }
    return null;
  }

  /** Wires the buttons for whichever dialog kind was just rendered into
   *  #game-dialog-modal (see redraw()'s dialog block / js/ui/dialog.js).
   *  Each answer clears viewState.dialog before invoking its callback, so a
   *  callback that immediately opens the NEXT dialog (offerNextPendingIntent's
   *  one-automated-unit-at-a-time chain) still gets its own fresh render. */
  function wireDialogButtons(dialog) {
    if (dialog.kind === "foundCity") {
      const input = $("game-dialog-name-input");
      const confirmBtn = $("game-dialog-confirm-btn");
      const skipBtn = $("game-dialog-skip-btn");
      const finish = (name) => {
        viewState.dialog = null;
        lastRenderedDialog = null;
        dialog.onAnswer(name);
        redraw();
      };
      if (confirmBtn) confirmBtn.onclick = () => finish((input && input.value.trim()) || dialog.suggested);
      if (skipBtn) skipBtn.onclick = () => finish(null);
      if (input) {
        input.focus();
        input.select();
        input.onkeydown = (e) => { if (e.key === "Enter") confirmBtn.click(); };
      }
    } else if (dialog.kind === "confirmEndTurn") {
      const confirmBtn = $("game-dialog-confirm-btn");
      const cancelBtn = $("game-dialog-cancel-btn");
      // onAnswer clears viewState.dialog itself (see handleEndTurnClick), but
      // lastRenderedDialog has to be dropped here too or the next dialog the
      // callback opens would be considered "already rendered" and never drawn.
      const finish = (ok) => {
        lastRenderedDialog = null;
        dialog.onAnswer(ok);
        redraw();
      };
      if (confirmBtn) confirmBtn.onclick = () => finish(true);
      if (cancelBtn) cancelBtn.onclick = () => finish(false);
      // Per-item "Go to" links -- jumping to fix
      // the thing the dialog just flagged means the player isn't ending the
      // turn after all, so this dismisses the dialog exactly like "Keep
      // Playing" (finish(false)) rather than leaving it open over the map.
      const modal = $("game-dialog-modal");
      if (modal) {
        for (const btn of modal.querySelectorAll(".tile-link[data-tile-x]")) {
          btn.onclick = () => {
            finish(false);
            goToTile(Number(btn.dataset.tileX), Number(btn.dataset.tileY), btn.dataset.tileTab || null);
          };
        }
        const chooseResearchBtn = modal.querySelector("[data-choose-research]");
        if (chooseResearchBtn) {
          chooseResearchBtn.onclick = () => {
            viewState.techTreeCivId = humanCivId;
            lastRenderedTechTreeKey = null;
            finish(false);
          };
        }
      }
    } else if (dialog.kind === "cityCaptured") {
      // Confirm = keep, Cancel = raze. Reuses the standard confirm/cancel
      // button ids; the markup gives Raze the danger treatment.
      const keepBtn = $("game-dialog-confirm-btn");
      const razeBtn = $("game-dialog-cancel-btn");
      const finish = (keep) => {
        viewState.dialog = null;
        lastRenderedDialog = null;
        dialog.onAnswer(keep);
      };
      if (keepBtn) keepBtn.onclick = () => finish(true);
      if (razeBtn) razeBtn.onclick = () => finish(false);
    } else if (dialog.kind === "cityAutomation") {
      // Three sliders + OK + X. The live label update mirrors the launch
      // screen's own slider wiring (index into a labels array, write the
      // adjacent span). Reading values only at OK time -- and never
      // rebuilding this modal mid-adjustment, which the lastRenderedDialog
      // identity guard above guarantees as long as the dialog object isn't
      // recreated per redraw -- is what keeps a half-set slider from being
      // wiped by an unrelated redraw.
      const LEVELS = window.UI.dialog.AUTOMATION_LEVELS;
      const KEYS = ["research", "culture", "resources"];
      const summary = $("city-auto-summary");
      const readAll = () => {
        const out = {};
        for (const k of KEYS) {
          const el = $(`city-auto-${k}`);
          out[k] = el ? parseInt(el.value, 10) : 0;
        }
        return out;
      };
      // Live "what this actually means" line: the sliders are relative
      // weights, so the same setting can read very differently depending on
      // the other two. Showing the resolved percentages avoids the player
      // having to do that arithmetic themselves.
      const refreshSummary = () => {
        const w = readAll();
        const total = w.research + w.culture + w.resources;
        const okBtn = $("game-dialog-confirm-btn");
        if (!total) {
          if (summary) summary.textContent = "Every slider is set to Never — this city would do nothing. Raise at least one.";
          if (okBtn) okBtn.disabled = true;
          return;
        }
        if (okBtn) okBtn.disabled = false;
        if (summary) {
          summary.textContent = KEYS
            .filter((k) => w[k] > 0)
            .map((k) => `${k === "resources" ? "Gather" : k === "culture" ? "Culture" : "Research"} ${Math.round((w[k] / total) * 100)}%`)
            .join(" · ");
        }
      };
      for (const k of KEYS) {
        const el = $(`city-auto-${k}`);
        if (!el) continue;
        el.addEventListener("input", (e) => {
          const lbl = $(`city-auto-${k}-label`);
          if (lbl) lbl.textContent = LEVELS[parseInt(e.target.value, 10)];
          refreshSummary();
        });
      }
      refreshSummary();
      const finish = (weights) => {
        viewState.dialog = null;
        lastRenderedDialog = null;
        dialog.onAnswer(weights); // null => cancelled
        redraw();
      };
      const okBtn = $("game-dialog-confirm-btn");
      const closeBtn = $("city-auto-close-btn");
      if (okBtn) okBtn.onclick = () => { if (!okBtn.disabled) finish(readAll()); };
      if (closeBtn) closeBtn.onclick = () => finish(null);
    } else if (dialog.kind === "confirm") {
      const confirmBtn = $("game-dialog-confirm-btn");
      const cancelBtn = $("game-dialog-cancel-btn");
      const finish = (ok) => {
        viewState.dialog = null;
        lastRenderedDialog = null;
        dialog.onAnswer(ok);
        redraw();
      };
      if (confirmBtn) confirmBtn.onclick = () => finish(true);
      if (cancelBtn) cancelBtn.onclick = () => finish(false);
    } else if (dialog.kind === "message") {
      const okBtn = $("game-dialog-ok-btn");
      if (okBtn) okBtn.onclick = () => {
        viewState.dialog = null;
        lastRenderedDialog = null;
        if (dialog.onDismiss) dialog.onDismiss();
        redraw();
      };
      // "Keep Fighting!" (see dialog.js's own doc comment) -- deliberately
      // does NOT also call dialog.onDismiss: declining the win skips the
      // victory stats screen that OK leads into and drops straight back
      // into ordinary play.
      const keepFightingBtn = $("game-dialog-keep-fighting-btn");
      if (keepFightingBtn) keepFightingBtn.onclick = () => {
        viewState.dialog = null;
        lastRenderedDialog = null;
        dialog.onKeepFighting();
        redraw();
      };
    } else if (dialog.kind === "gameOver" || dialog.kind === "victoryStats") {
      const okBtn = $("game-dialog-ok-btn");
      if (okBtn) okBtn.onclick = () => dialog.onReturnToTitle();
      if (dialog.kind === "gameOver") {
        const viewReportBtn = $("game-dialog-view-report-btn");
        if (viewReportBtn) viewReportBtn.onclick = () => {
          dialog.onViewInfluenceReport();
          redraw();
        };
        // Deliberately does NOT also call dialog.onReturnToTitle -- same
        // "decline and drop straight back into play" shape as the "message"
        // kind's own Keep Fighting button above.
        const keepFightingBtn = $("game-dialog-keep-fighting-btn");
        if (keepFightingBtn) keepFightingBtn.onclick = () => {
          viewState.dialog = null;
          lastRenderedDialog = null;
          dialog.onKeepFighting();
          redraw();
        };
      }
    } else if (dialog.kind === "chooseTech") {
      const modal = $("game-dialog-modal");
      if (modal) {
        for (const btn of modal.querySelectorAll(".game-dialog-choice")) {
          btn.onclick = () => {
            viewState.dialog = null;
            lastRenderedDialog = null;
            dialog.onAnswer(btn.dataset.techId);
            redraw();
          };
        }
      }
    } else if (dialog.kind === "chooseStarvationDisband" || dialog.kind === "chooseWispDisband") {
      const modal = $("game-dialog-modal");
      if (modal) {
        for (const btn of modal.querySelectorAll("[data-disband-index]")) {
          btn.onclick = () => {
            viewState.dialog = null;
            lastRenderedDialog = null;
            dialog.onAnswer(Number(btn.dataset.disbandIndex));
            redraw();
          };
        }
      }
    } else if (dialog.kind === "techResearched") {
      const okBtn = $("game-dialog-ok-btn");
      const confirmBtn = $("game-dialog-confirm-btn");
      const finish = (chooseNext) => {
        viewState.dialog = null;
        lastRenderedDialog = null;
        if (chooseNext) dialog.onChooseResearch(); else dialog.onDismiss();
        redraw();
      };
      if (okBtn) okBtn.onclick = () => finish(false);
      if (confirmBtn) confirmBtn.onclick = () => finish(true);
      const modal = $("game-dialog-modal");
      if (modal) {
        for (const btn of modal.querySelectorAll("[data-goto-tech-id]")) {
          btn.onclick = () => {
            viewState.dialog = null;
            lastRenderedDialog = null;
            dialog.onViewTech(btn.dataset.gotoTechId);
            redraw();
          };
        }
      }
    } else if (dialog.kind === "unitBuilt") {
      const cityBtn = $("game-dialog-cancel-btn"); // "Go to City"
      const unitBtn = $("game-dialog-confirm-btn"); // "Go to Unit"
      const finish = (goToUnit) => {
        viewState.dialog = null;
        lastRenderedDialog = null;
        if (goToUnit) dialog.onGoToUnit(); else dialog.onGoToCity();
        redraw();
      };
      if (cityBtn) cityBtn.onclick = () => finish(false);
      if (unitBtn) unitBtn.onclick = () => finish(true);
    } else if (dialog.kind === "confirmAutomatedAction") {
      const confirmBtn = $("game-dialog-confirm-btn");
      const cancelBtn = $("game-dialog-cancel-btn");
      const finish = (ok) => {
        viewState.dialog = null;
        lastRenderedDialog = null;
        if (ok) dialog.onConfirm(); else dialog.onDecline();
        redraw();
      };
      if (confirmBtn) confirmBtn.onclick = () => finish(true);
      if (cancelBtn) cancelBtn.onclick = () => finish(false);
    } else if (dialog.kind === "attackNotice") {
      const goToBtn = $("game-dialog-confirm-btn");
      const skipBtn = $("game-dialog-cancel-btn");
      const finish = (goTo) => {
        viewState.dialog = null;
        lastRenderedDialog = null;
        if (goTo) dialog.onGoTo(); else dialog.onSkip();
        redraw();
      };
      if (goToBtn) goToBtn.onclick = () => finish(true);
      if (skipBtn) skipBtn.onclick = () => finish(false);
    }
  }

  /** Enter Cave (2026-08-19, user-directed) -- see orders.js's
   *  performEnterCave for the actual relocate/turn-consuming logic; this is
   *  just the sidebar/ring-menu's UI-side twin, same shape as
   *  handleRestAndDefend below. */
  function handleEnterCave() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (!window.GameEngine.orders.performEnterCave(unit, gameState)) return;
    redraw();
  }

  // Rest and Defend -- both effects apply: healUnit at end of turn
  // via unit.resting (turns.js), AND doubled defense via the "defending"
  // condition (same expiresAtTurn convention ai.js's performDefend uses for
  // the AI side). Only one badge shows for this (overlays.js's
  // drawConditionBadges skips the resting icon whenever "defending" is also
  // active). Channeled (see performRestAndDefend), so it persists on its
  // own every turn until cancelled (2026-08-19, user-directed merge with
  // the old separate Garrison action) -- see handleCancelRestAndDefend.
  function handleRestAndDefend() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (!window.GameEngine.orders.performRestAndDefend(unit, gameState)) return;
    redraw();
  }

  /** Sidebar twin of the context menu's "Stop" entry (2026-08-06, user-
   *  directed) -- cancels a unit's in-progress multi-turn goto order
   *  without needing to know the right-click-your-own-tile trick. Doesn't
   *  touch usedThisTurn/movesRemaining -- the unit is free to take a
   *  completely different action with whatever budget it has left this
   *  turn, same as any other order being superseded by a new one. */
  function handleStopOrder() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    window.GameEngine.orders.stopGotoOrder(unit);
    redraw();
  }

  /** Sentry: sits and does nothing until an
   *  enemy comes within range, then attacks it -- see orders.js's
   *  advanceSentryOrder for the per-turn check (run from turns.js's
   *  finishCivTurn) and isSpent for why a sentried unit never nags for a
   *  new order. Doesn't spend usedThisTurn itself (unlike Rest and Defend)
   *  -- a unit going on watch hasn't actually DONE anything yet this turn;
   *  the eventual attack, if any, spends it the normal way. */
  function handleSentry() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.usedThisTurn || unit.channeling) return;
    endAutomationAndGoto(unit);
    unit.sentry = true;
    unit.currentMission = "On Sentry";
    redraw();
  }

  function handleCancelSentry() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (!unit.sentry) return;
    unit.sentry = false;
    redraw();
  }

  /** Move To...: opens tile-placement mode over the ENTIRE map (minus the
   *  unit's own tile, tapping which is this flow's only cancel besides
   *  Escape -- see handleGlobalKeydown) -- an explicit ring entry point
   *  into the exact same order the existing "Move to This Tile" pill on a
   *  remote tile's own ring already issues (2026-08-27, user-directed).
   *  Deliberately no reachability/terrain filtering on WHICH tiles are legal
   *  slots, same permissiveness as that existing pill: startGotoOrder
   *  resolves whatever path (or lack of one) the destination actually has.
   *  Every slot is still tagged with oneTurn (2026-08-27, user-directed:
   *  differentiate one-turn from multi-turn destinations) so
   *  drawPlacementOverlay can render them differently -- reusing
   *  orders.reachableTiles verbatim (the same memoized Dijkstra flood fill
   *  that already paints the plain blue "movement range" tint under a
   *  selected unit, see render.js's drawReachableOverlay) rather than a
   *  second, potentially-drifting notion of "reachable". */
  function startMoveToPlacement(unit) {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const { map } = gameState;
    const reach = window.GameEngine.orders.reachableTiles(unit, gameState);
    const slots = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (x === unit.x && y === unit.y) continue;
        slots.push({ x, y, oneTurn: reach.has(`${x},${y}`) });
      }
    }
    viewState.placement = {
      slots,
      label: "Move To...",
      previewUnitId: unit.typeId, previewRaceId: civ.raceId,
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) {
          endAutomationAndGoto(unit); // supersede before staging the NEW goto order
          window.GameEngine.orders.startGotoOrder(unit, gameState, slot.x, slot.y, false);
          // Same "follow the unit onto wherever it actually ended up this
          // turn" fixup as the remote-tile moveTo/buildRoadTo handler.
          if (viewState.selection) {
            viewState.selection.x = unit.x;
            viewState.selection.y = unit.y;
          }
        }
        redraw();
      },
    };
    redraw();
  }

  /** Attack...: same two-stage shape as Move To just above, but reuses
   *  startTargetSelection (see its own doc comment) rather than a bespoke
   *  placement block -- attackTargets' candidates are live enemy unit
   *  objects, not tiles, which is exactly what that shared "pick the
   *  ability, then click the target" flow already exists for (Cast Fly,
   *  Carry, Board all go through it the same way). Re-resolves the actual
   *  target via attackTargetAt at commit time rather than trusting the
   *  picked object is still legal, same "don't trust a menu that might be
   *  stale" reasoning the remote-tile "attack" ring case already follows. */
  function startAttackPlacement(unit) {
    const targets = window.GameEngine.orders.attackTargets(unit, gameState, humanCivId);
    startTargetSelection("Attack...", targets, (picked) => {
      endAutomationAndGoto(unit);
      const target = window.GameEngine.orders.attackTargetAt(unit, gameState, picked.x, picked.y, humanCivId);
      if (target) {
        window.GameEngine.orders.attack(unit, gameState, target, humanCivId);
        maybeOfferCityCaptureDecisions();
      }
    });
  }

  /** Build Road To...: identical shape to startMoveToPlacement just above
   *  (same full-map slot list, same oneTurn tagging so the overlay
   *  differentiates one-turn from multi-turn destinations the same way),
   *  the only difference being the `true` (buildRoad) flag passed to
   *  startGotoOrder instead of `false` -- matching the remote-tile "Build
   *  Road to This Tile" pill's own order exactly, just reached via the
   *  unit's own ring instead of right-clicking/long-pressing the
   *  destination directly (2026-08-27, user-directed). */
  function startBuildRoadToPlacement(unit) {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const { map } = gameState;
    const reach = window.GameEngine.orders.reachableTiles(unit, gameState);
    const slots = [];
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        if (x === unit.x && y === unit.y) continue;
        slots.push({ x, y, oneTurn: reach.has(`${x},${y}`) });
      }
    }
    viewState.placement = {
      slots,
      label: "Build Road To...",
      previewUnitId: unit.typeId, previewRaceId: civ.raceId,
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) {
          endAutomationAndGoto(unit);
          window.GameEngine.orders.startGotoOrder(unit, gameState, slot.x, slot.y, true);
          if (viewState.selection) {
            viewState.selection.x = unit.x;
            viewState.selection.y = unit.y;
          }
        }
        redraw();
      },
    };
    redraw();
  }

  /** Follow: opens tile-placement mode (same
   *  mechanism startTeleportPlacement/startWispSummonPlacement use), but
   *  the highlighted "slots" are wherever this civ's OTHER units currently
   *  stand rather than empty terrain -- picking one sets unit.followTarget
   *  to that unit (a direct object reference, same convention as
   *  unit.carries/carriedBy; see savegame.js's serialize/deserialize for
   *  the matching round-trip handling). See orders.js's advanceFollowOrder
   *  for the per-turn movement this then drives. */
  function startFollowPlacement(unit) {
    if (!humanCivId || unit.usedThisTurn || unit.channeling) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const slots = civ.units
      .filter((u) => u !== unit && !u.carriedBy)
      .map((u) => ({ x: u.x, y: u.y, unit: u }));
    if (!slots.length) return;
    endAutomationAndGoto(unit);
    viewState.placement = {
      slots,
      label: "Follow...",
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) unit.followTarget = slot.unit;
        redraw();
      },
    };
    redraw();
  }

  /** Build Bridge: same tile-placement mechanism as Follow/Teleport above,
   *  but the slots are the unit's own (up to 8) adjacent water tiles with
   *  no existing structure (cities.js's canBuildBridgeSegment) -- one
   *  segment at a time, same shape as Build Road Here (2026-08-19: replaces
   *  the old whole-span-up-front design). Picking one commits via orders.js's
   *  startBridgeOrder, which spends this segment's build turns (see
   *  advanceGotoOrder's buildBridge branch); reaching further across the
   *  water is a separate "Build Bridge..." order issued again once the
   *  Pioneer is standing on the new segment. */
  function startBridgePlacement(unit) {
    if (!humanCivId || unit.usedThisTurn || unit.channeling) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const { map } = gameState;
    const slots = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = unit.x + dx, y = unit.y + dy;
        if (window.GameEngine.cities.canBuildBridgeSegment(map, unit, x, y)) slots.push({ x, y });
      }
    }
    if (!slots.length) return;
    endAutomationAndGoto(unit);
    viewState.placement = {
      slots,
      label: "Build Bridge...",
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) window.GameEngine.orders.startBridgeOrder(unit, gameState, slot.x, slot.y);
        redraw();
      },
    };
    redraw();
  }

  function handleCancelFollow() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (!unit.followTarget) return;
    unit.followTarget = null;
    redraw();
  }

  /** Automate Actions toggle -- see sidebar.js's
   *  automateBtn and ai.js's runAutomatedUnitTurn/turns.js's finishCivTurn
   *  hook for the actual per-turn behavior this flag switches on. Turning
   *  it off drops any pendingIntent still waiting on a confirmation the
   *  player will never see now that the unit isn't automated anymore. */
  function handleToggleAutomate() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.civId !== humanCivId) return;
    unit.automated = !unit.automated;
    if (!unit.automated) unit.pendingIntent = null;
    redraw();
  }

  /** Ends a standing Rest and Defend (see performRestAndDefend/handleRestAndDefend;
   *  formerly a separate "Cancel Garrison", merged 2026-08-19, user-directed)
   *  -- free, same as Cancel Channel/Cancel Hidden, since there's no stash to
   *  forfeit and nothing irreversible about stepping down from a brace.
   *  Drops the "defending" condition immediately rather than letting it
   *  linger to its nominal expiry, so the bonus visibly ends the instant the
   *  player asks it to. */
  function handleCancelRestAndDefend() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.channeling !== "restAndDefend") return;
    unit.channeling = null;
    window.GameEngine.combat.clearCondition(unit, "defending");
    redraw();
  }

  // Hidden/stealth: the engine mechanic
  // (combat.js's canGoHidden/enterHidden/revealHidden) existed with only AI
  // call sites -- see sidebar.js's stealthActions for the button gating.
  // Entering is a full-turn action, same contract enterHidden documents for
  // every AI call site; canceling early is free (the tech's own "voluntarily
  // cancellable early" wording) and reuses revealHidden, which still applies
  // the standard 1-turn forced-visible cooldown before re-hiding -- same as
  // any other way Hidden ends.
  function handleGoHidden() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    const civ = gameState.civs[humanCivId];
    if (unit.usedThisTurn) return;
    if (!window.GameEngine.combat.canGoHidden(unit, civ, gameState.civs)) return;
    endAutomationAndGoto(unit);
    window.GameEngine.combat.enterHidden(unit, gameState.turnNumber || 0);
    unit.usedThisTurn = true;
    redraw();
  }

  function handleCancelHidden() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    window.GameEngine.combat.revealHidden(unit, gameState.turnNumber || 0);
    redraw();
  }

  // Channeled actions: Prospector's Claim,
  // Dungeon Delve, and Galley Fishing are all explicitly started/cancelled
  // now -- see sidebar.js's channelActions for the button gating (tech
  // unlocked, right unit/tile, not already channeling) and turns.js's
  // onAnchor gate for what unit.channeling actually does turn to turn.
  function handleStartChannel(kind) {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.usedThisTurn || unit.channeling) return;
    endAutomationAndGoto(unit);
    unit.channeling = kind;
    unit.resting = true;
    unit.usedThisTurn = true;
    redraw();
  }

  /** Points the tile inspector at the city on (x,y) and returns it, so a city
   *  ring action and the sidebar are always talking about the same city --
   *  the downstream handlers (handleResourceProduction, cancelBuild,
   *  handleChooseBuild) all read viewState.selectedCity. Forcing the city tab
   *  matters on a garrisoned tile, where handleTileClick would otherwise hand
   *  the tab to the unit standing there (see input.js's SELECTION MODEL). */
  function selectCityAt(x, y) {
    const civ = gameState.civs[humanCivId];
    const city = civ && civ.cities.find((c) => c.x === x && c.y === y);
    if (!city) return null;
    window.UI.input.handleTileClick({ x, y }, gameState, viewState);
    const sel = viewState.selection;
    if (sel) {
      const idx = sel.tabs.findIndex((t) => t.kind === "city");
      if (idx >= 0) window.UI.input.setActiveTab(gameState, viewState, idx);
    }
    return city;
  }

  /** The "city:*" half of the ring's dispatch --
   *  see orders.js's cityRingOptions for what's offered and when. Split out
   *  of handleContextMenuAction because these run without a selected unit,
   *  which that function's own guard rules out. */
  function handleCityRingAction(kind, menu) {
    // "City Actions" is a navigation pill, not an order: it swaps the ring
    // over to the city standing on this tile. It exists because a unit on
    // your own city always wins the sidebar's tab, so the city ring would
    // otherwise be unreachable exactly where it's most useful.
    if (kind === "city:open") {
      if (selectCityAt(menu.x, menu.y)) {
        viewState.ringMenu = { x: menu.x, y: menu.y, subject: "city", page: null };
      }
      redraw();
      return;
    }

    // "Next city needing orders" carries its target in the kind string, the
    // same convention startChannel:<kind> uses below.
    if (kind.startsWith("city:nextProduction:")) {
      const [nx, ny] = kind.slice("city:nextProduction:".length).split(",").map(Number);
      goToTile(nx, ny, "city");
      if (selectCityAt(nx, ny)) {
        viewState.ringMenu = { x: nx, y: ny, subject: "city", page: null };
      }
      redraw();
      return;
    }

    // NOT selectCityAt for the rest of these: selectCityAt forces the
    // sidebar's active tab to "city", and
    // syncLegacySelection nulls every OTHER legacy selected* field the
    // instant it does -- including viewState.selectedUnit. On a merged ring
    // (menu.subject "unit", a unit standing on its own city), the very next
    // renderRingMenu pass reads viewState.selectedUnit to rebuild that ring;
    // finding it null made canCommand fail and the whole ring silently
    // close instead of showing the build popover. A plain lookup plus a
    // direct field write has none of that side effect -- and needs none of
    // it, since these are incidental actions taken from wherever the ring
    // was opened, not a request to navigate the sidebar to the city (that's
    // what the dedicated "City Actions"/"Next City Needing Orders" pills
    // above are for, and they still use selectCityAt on purpose). The
    // direct write only has to survive until the switch below reads it --
    // redraw()'s resolveSelection() re-derives selectedCity from the
    // (unchanged) active tab right after, same as if this were never set.
    const civ = gameState.civs[humanCivId];
    const city = civ && civ.cities.find((c) => c.x === menu.x && c.y === menu.y);
    if (!city) { redraw(); return; }
    viewState.selectedCity = city;

    switch (kind) {
      case "city:cancelBuild":
        window.GameEngine.orders.cancelBuild(city);
        break;
      case "city:resourceProduction":
        handleResourceProduction(city);
        break;
      case "city:research":
        handleCityResearch(city);
        break;
      case "city:spreadCulture":
        handleSpreadCulture(city);
        break;
      case "city:throwAParty":
        handleThrowAParty(city);
        break;
      case "city:expediteBuild":
        handleExpediteBuild(city);
        break;
      case "city:toggleAutomate":
        handleToggleAutomateCity(city);
        break;
      case "city:buildUnit":
      case "city:buildStructure":
        // Opens the real build list as a ring sub-page (see
        // ringmenu.js's renderPopover / buildlist.js) -- the ring stays open
        // rather than closing, so Back returns to the categories.
        //
        // subject: menu.subject, NOT a hardcoded "city": on the co-located
        // tile (a unit standing on its own city), menu.subject is "unit" and
        // renderRingMenu renders the
        // MERGED unit+city ring for that -- see its own onUnitOwnTile check.
        // Hardcoding "city" here would silently drop back to a city-only
        // ring the moment Back is pressed after opening a build list from
        // that merged view. Preserving whatever subject the ring already had
        // keeps a standalone city ring (subject "city") behaving exactly as
        // before.
        viewState.ringMenu = {
          x: city.x, y: city.y, subject: menu.subject,
          page: kind === "city:buildUnit" ? "buildUnit" : "buildStructure",
        };
        break;
      default:
        break;
    }
    redraw();
  }

  /** Dispatches whichever ring-menu entry the player picked -- see
   *  orders.js's contextMenuOptions for what each `kind` means and
   *  when it's offered, js/ui/ringmenu.js for how it's
   *  rendered). Re-reads viewState.ringMenu/selectedUnit fresh rather
   *  than closing over anything from when the menu was built, same
   *  "recompute at click time" convention handleChooseBuild already uses
   *  for the city build picker. */
  function handleContextMenuAction(kind) {
    const menu = viewState.ringMenu;
    viewState.ringMenu = null;
    if (!menu || !humanCivId) { redraw(); return; }

    // City actions run before the unit guard below -- a city ring is opened
    // on tiles where there may be no selected unit at all.
    if (kind && kind.startsWith("city:")) {
      handleCityRingAction(kind, menu);
      return;
    }

    // "About This Space" (2026-08-28, user-directed; 2026-09-02: switched to
    // a read-only peek): same "runs before the unit guard" reasoning as City
    // Actions just above -- orders.js's mapMenuOptions offers this pill on
    // EVERY ring, including a tile with no unit selected and nothing else on
    // it at all, so this has to work without one too. Uses inspectTile, not
    // handleTileClick -- "About This Space" is a look, not a selection, so
    // it must never disturb whatever the player actually has selected (see
    // input.js's INSPECT doc comment). Forces the Terrain tab specifically
    // (not whichever tab inspectTile would otherwise default to, e.g. a unit
    // standing there) -- "About This Space" means the tile itself, same
    // reasoning selectCityAt below forces the City tab on a garrisoned one.
    if (kind === "aboutThisSpace") {
      window.UI.input.inspectTile(gameState, viewState, menu.x, menu.y);
      const insp = viewState.inspect;
      if (insp) {
        const idx = insp.tabs.findIndex((t) => t.kind === "terrain");
        if (idx >= 0) window.UI.input.setInspectActiveTab(gameState, viewState, idx);
      }
      // Mobile (2026-08-28, user-directed): the sidebar is a collapsible
      // bottom sheet there (see setSheetDetent's own doc comment), so
      // selecting the tile alone doesn't actually show its info unless the
      // sheet happens to already be raised -- "About This Space" means to
      // SEE that info, so this raises it the same way tapping #m-status
      // already does (line ~769).
      if (document.body.classList.contains("mobile")) setSheetDetent("full");
      redraw();
      return;
    }

    const unit = viewState.selectedUnit;
    if (!unit) { redraw(); return; }

    switch (kind) {
      case "moveTo":
      case "buildRoadTo":
        endAutomationAndGoto(unit); // supersede before staging the NEW goto order
        window.GameEngine.orders.startGotoOrder(unit, gameState, menu.x, menu.y, kind === "buildRoadTo");
        // Follow the unit onto wherever it actually ended up this turn
        // (2026-08-04 behavior, carried over from the old immediate-move
        // handler) -- viewState.selection is keyed on a fixed (x,y), not
        // the unit itself, so leaving it pointed at the tile the unit just
        // left would silently lose the unit from the sidebar on the very
        // next redraw.
        if (viewState.selection) {
          viewState.selection.x = unit.x;
          viewState.selection.y = unit.y;
        }
        break;
      case "attack": {
        endAutomationAndGoto(unit);
        const target = window.GameEngine.orders.attackTargetAt(unit, gameState, menu.x, menu.y, humanCivId);
        window.GameEngine.orders.attack(unit, gameState, target, humanCivId);
        // A conquered city queues a keep-or-raze decision (see ai.js's
        // conquest branch); ask about it immediately rather than making the
        // player wait for End Turn to find out they took a city.
        maybeOfferCityCaptureDecisions();
        break;
      }
      case "buildRoadHere":
        handleBuildRoad();
        break;
      case "buildBridge":
        startBridgePlacement(unit);
        break;
      case "helpBuild":
        handleHelpBuild();
        break;
      case "foundCity":
        handleFoundCity();
        break;
      case "foundCityHere":
        handleFoundCityHere(menu.x, menu.y);
        break;
      case "claimChannel":
        handleClaimChannel();
        break;
      case "cancelChannel":
        handleCancelChannel();
        break;
      case "goHidden":
        handleGoHidden();
        break;
      case "cancelHidden":
        handleCancelHidden();
        break;
      case "enterCave":
        handleEnterCave();
        break;
      case "restAndDefend":
        handleRestAndDefend();
        break;
      case "cancelRestAndDefend":
        handleCancelRestAndDefend();
        break;
      case "automate":
        handleToggleAutomate();
        break;
      case "levelUp":
        // Sub-page, not an order -- keep the ring open on this unit's tile
        // and swap it for the picker (see renderRingMenu's buildRingPage).
        viewState.ringMenu = { x: menu.x, y: menu.y, subject: "unit", page: "levelUp" };
        break;
      // Category-ring navigation (see renderRingMenu's CATEGORY RING note) --
      // pure page swaps, never an order, so each just re-anchors the ring on
      // the same tile with a new page and lets the trailing redraw() below
      // repaint it.
      case "category:unit":
        viewState.ringMenu = { x: menu.x, y: menu.y, subject: "unit", page: "unitActions" };
        break;
      case "category:city":
        viewState.ringMenu = { x: menu.x, y: menu.y, subject: "unit", page: "cityActions" };
        break;
      case "category:back":
        viewState.ringMenu = { x: menu.x, y: menu.y, subject: "unit", page: null };
        break;
      case "disband":
        handleDisbandUnit();
        break;
      case "stopOrder":
        handleStopOrder();
        break;
      case "sentry":
        handleSentry();
        break;
      case "cancelSentry":
        handleCancelSentry();
        break;
      case "moveToPlacement":
        startMoveToPlacement(unit);
        break;
      case "attackPlacement":
        startAttackPlacement(unit);
        break;
      case "buildRoadToPlacement":
        startBuildRoadToPlacement(unit);
        break;
      case "follow":
        startFollowPlacement(unit);
        break;
      case "cancelFollow":
        handleCancelFollow();
        break;
      case "deactivateAura":
        unit.auraActive = false;
        break;
      case "openChest": {
        // See doc/world_encounters_design.md -- ai.js's openTreasureChest
        // does the actual resolution (trap vs. reward) and returns a result
        // object with no UI dependency of its own; this is the one place
        // that turns it into a modal, same "message" dialog shape as the
        // "Can't Found a City Here" popup above.
        const civ = gameState.civs[humanCivId];
        if (civ) {
          const result = window.GameEngine.ai.openTreasureChest(civ, unit, gameState);
          if (result) {
            const unitLabel = unit.name || window.GameData.getUnit(unit.typeId).label;
            let title, text;
            if (result.disarmed) {
              // Halfellow "Making Trouble": a
              // Trouble Maker disarms a chest trap instead of springing it --
              // no damage, no condition.
              title = "Trap Disarmed!";
              text = `${unitLabel} finds a trap, but disarms it.`;
            } else if (result.trapped) {
              title = "It's a Trap!";
              const trapEffectLabel = { fire: "Burning", frost: "Frozen", poison: "Poisoned", befuddle: "Befuddled" }[result.kind];
              text = `${unitLabel} springs a ${result.kind} trap: -${result.damage} HP and ${trapEffectLabel}.`;
            } else {
              ({ title, text } = describeTreasureFind(unitLabel, result));
              window.SfxSystem.playTreasureChestOpen();
            }
            viewState.dialog = { kind: "message", title, text };
            redraw();
          }
        }
        break;
      }
      case "battlefieldPromotion": {
        // Human "Battlefield Promotion": ai.js's resolveBattlefieldPromotion
        // re-validates eligibility
        // (upgrade path still unlocked, still affordable) and does its own
        // floating-text confirmation, since the stockpile could have been
        // spent on something else between when the ring was drawn and when
        // this click resolves -- no dialog needed, just redraw.
        const civ = gameState.civs[humanCivId];
        if (civ) window.GameEngine.ai.resolveBattlefieldPromotion(civ, unit, gameState);
        redraw();
        break;
      }
      default:
        // "startChannel:<kind>" -- one case per channel type would just
        // repeat this same call five times, so the channel kind is parsed
        // out of the menu kind
        // string instead. See orders.js's contextMenuOptions for the exact
        // list (prospecting/delving/fishing/hunting/farming).
        if (kind && kind.startsWith("startChannel:")) {
          handleStartChannel(kind.slice("startChannel:".length));
        } else if (kind === "castFlight") {
          // Human "Flight". ai.js's castFlightOnAlly still re-validates every
          // condition that earned this pill its spot on the ring (and walks
          // the Wizard into range) -- the target could have moved, died, or
          // already been flighted since the ring was drawn, same "don't trust
          // a menu that might be stale" reasoning "attack"'s own re-lookup
          // above uses.
          const civ = gameState.civs[humanCivId];
          startTargetSelection("Cast Fly",
            window.GameEngine.orders.flightTargets(unit, gameState, humanCivId),
            (target) => window.GameEngine.ai.castFlightOnAlly(civ, unit, target, gameState));
        } else if (kind === "carryUnit") {
          // `unit` is the carrier; the picked target is the passenger.
          startTargetSelection("Carry",
            window.GameEngine.orders.carryTargets(unit, gameState, humanCivId),
            (target) => handleCarryUnit(unit, target));
        } else if (kind === "boardCarrier") {
          // Mirrors carryUnit with the two roles swapped: `unit` is the
          // passenger, the picked target is the carrier it boards.
          startTargetSelection("Board",
            window.GameEngine.orders.boardTargets(unit, gameState, humanCivId),
            (target) => handleCarryUnit(target, unit));
        } else if (kind === "dropOff") {
          // "Drop Off": commits instantly, no
          // placement mode -- see orders.js's ring option, gated on
          // hasOpenDisembarkTile so this only ever appears when there's
          // somewhere to actually put the passenger down.
          const civ = gameState.civs[humanCivId];
          if (civ) {
            window.GameEngine.ai.performPlayerDisembark(civ, unit, gameState);
            // Same immediate-visibility fix as every other summon/placement
            // flow -- the dropped passenger
            // otherwise wouldn't render until this civ's next visibility
            // refresh.
            window.GameEngine.turns.refreshVisibility(gameState);
          }
        } else if (kind === "summonWisp") {
          startWispSummonPlacement(unit);
        } else if (kind && kind.startsWith("setTrap:")) {
          // Halfellow "Set the Trap": "setTrap:
          // frost"/"setTrap:fire" -- same payload-in-kind-string convention
          // as castFlight/carryUnit above.
          startTrapPlacement(unit, kind.slice("setTrap:".length));
        } else if (kind === "createGreatBonfire") {
          // Halfellow "Banish the Darkness": tile-placement mode
          // (2026-08-24) -- the player picks which open adjacent tile the
          // Bonfire lands on, same shape as Set the Trap.
          startGreatBonfirePlacement(unit);
        } else if (kind === "createMushroom") {
          // Halfellow "Fairy Ring": same tile-placement shape as Create The
          // Great Bonfire just above, for the Mushroomancer.
          startMushroomPlacement(unit);
        } else if (kind === "whirlwindStrike" || kind === "bladeStorm") {
          // Elf "Whirlwind Strike"/"Blade Storm": single click, no
          // placement mode -- it's a self-centered radius sweep, not a
          // targeted tile (see ai.js's performPlayerBladeSweep).
          const civ = gameState.civs[humanCivId];
          if (civ) {
            window.GameEngine.ai.performPlayerBladeSweep(civ, unit, kind, gameState);
            window.GameEngine.turns.refreshVisibility(gameState);
          }
        } else if (kind === "summonRaptor" || kind === "summonShadowsteed") {
          // Elf Druid: a single click, no
          // placement mode needed -- Raptor/Shadowsteed always land on an
          // open adjacent tile (see ai.js's spawnUnitAdjacentToUnit), unlike
          // the Wisp's arbitrary swamp destination just above.
          const civ = gameState.civs[humanCivId];
          if (civ) {
            window.GameEngine.ai.performPlayerDruidSummon(civ, unit, kind === "summonRaptor" ? "raptor" : "shadowsteed", gameState);
            // Same immediate-visibility fix as Summon Wisp/Set the Trap
            // -- a freshly-spawned Raptor/
            // Shadowsteed otherwise wouldn't render until this civ's next
            // visibility refresh. Usually a no-op in practice (it lands
            // adjacent to a unit whose own vision almost always already
            // covers that tile), but there's no reason to leave this path
            // inconsistent with the other two summon flows.
            window.GameEngine.turns.refreshVisibility(gameState);
          }
        } else if (kind === "direBearForm") {
          // Elf "Nature's Fury": single click, no placement mode needed --
          // ai.js's performDireBearTransform picks the direction off the
          // unit's own typeId, same "one kind string" shape as Roots of the
          // World/Teleportation just below.
          const civ = gameState.civs[humanCivId];
          if (civ) window.GameEngine.ai.performDireBearTransform(civ, unit, gameState);
        } else if (kind === "teleport") {
          // The only TWO-stage targeted action: pick who moves, then (via
          // startTeleportPlacement) where they land.
          startTargetSelection(unit.typeId === "druid" ? "Roots of the World" : "Teleportation",
            window.GameEngine.orders.teleportTargets(unit, gameState, humanCivId),
            (target) => startTeleportPlacement(unit, target));
        } else if (kind === "naturesGrace") {
          const civ = gameState.civs[humanCivId];
          startTargetSelection("Nature's Grace",
            window.GameEngine.orders.naturesGraceTargets(unit, gameState, humanCivId),
            (target) => window.GameEngine.ai.performPlayerNaturesGrace(civ, unit, target, gameState));
        } else if (kind === "fireball") {
          startFireballPlacement(unit);
        } else if (kind === "bombardment") {
          startBombardmentPlacement(unit);
        } else if (kind === "riddle") {
          const civ = gameState.civs[humanCivId];
          startTargetSelection("Riddle",
            window.GameEngine.orders.riddleTargets(unit, gameState, humanCivId),
            (target) => window.GameEngine.ai.performPlayerRiddle(civ, unit, target, gameState));
        } else if (kind === "resourceHeist") {
          const civ = gameState.civs[humanCivId];
          startTargetSelection("Resource Heist",
            window.GameEngine.orders.resourceHeistTargets(unit, gameState, humanCivId),
            (target) => window.GameEngine.ai.performPlayerResourceHeist(civ, unit, target, gameState));
        } else if (kind === "unlockTheGate") {
          // The one targeted action aimed at a STRUCTURE rather than a unit:
          // its candidates carry a cities.js findStructureAt record (see
          // orders.js's unlockTheGateTargets) instead of being units.
          const civ = gameState.civs[humanCivId];
          startTargetSelection("Unlock the Gate",
            window.GameEngine.orders.unlockTheGateTargets(unit, gameState, humanCivId),
            (target) => window.GameEngine.ai.performPlayerUnlockTheGate(civ, unit, {
              structure: target.structure.record,
              city: target.structure.city,
              civId: target.structure.civ.id,
            }, gameState));
        } else if (kind && kind.startsWith("activateAura:")) {
          // "activateAura:heavy_metal"/"activateAura:power_metal"
          // -- a free toggle, not a spent
          // action: see orders.js's contextMenuOptions for the two-techs-
          // known case offering both as separate pills.
          unit.activeAura = kind.slice("activateAura:".length);
          unit.auraActive = true;
        }
        break;
    }
    redraw();
  }

  /**
   * TARGET-SELECTION MODE
   * ---------------------
   * The shared "one ability pill, then left-click the target" flow behind
   * every targeted action. Each ability contributes only its candidate list
   * (orders.js's flightTargets/teleportTargets/... -- see that file's own
   * section comment for the per-ability eligibility rules) and what to do
   * with the picked entry; everything else is common.
   *
   * Reuses viewState.placement wholesale rather than adding a parallel modal
   * mode: placement was already "highlight a slot list, swallow the next
   * left-click, resolve via onPick, cancel on a click outside the list or on
   * right-click" (see input.js's two handlers). `targeting: true` is the only
   * new field -- it switches render.js and sidebar.js to the "pick a unit"
   * treatment instead of the gold build-slot wash, since the player is
   * choosing an existing unit here, not empty ground to put something on.
   *
   * `targets` entries are either live unit objects or the {x, y, structure}
   * records unlockTheGateTargets returns -- input.js matches on .x/.y, which
   * both shapes carry, and hands the matched entry straight to onPick. Two
   * candidates can never share a tile (every list excludes carried units), so
   * a tile identifies a target unambiguously.
   */
  function startTargetSelection(label, targets, onPick) {
    if (!humanCivId || !targets || !targets.length) return;
    viewState.placement = {
      slots: targets,
      label,
      targeting: true,
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) onPick(slot);
        redraw();
      },
    };
    redraw();
  }

  /** Elf "Roots of the World" / Human "Teleportation" -- see ai.js's
   *  performWizardTeleport/attemptWizardTeleport/maybeTeleportStrike for
   *  the AI side of this same mechanic. Stage TWO of the teleport flow: the
   *  caster and the unit being moved were already chosen in
   *  target-selection mode (see the "teleport" ring case), so this only
   *  picks the destination. Opens tile-placement mode (same
   *  viewState.placement mechanism
   *  handleOpenBuildPicker uses for structure slots) with every currently-
   *  EXPLORED, currently-legal teleport tile as a slot -- see ai.js's
   *  isValidTeleportTile, the same gate performDruidTeleport/
   *  performWizardTeleport themselves re-check at landing time. `caster` is
   *  the Druid or Wizard doing the teleporting; picking a slot commits via
   *  whichever of performPlayerDruidTeleport/performPlayerWizardTeleport
   *  matches caster.typeId -- clicking outside every highlighted tile
   *  cancels, same convention as building placement. */
  function startTeleportPlacement(caster, targetUnit) {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const explored = gameState.explored[civ.id] || new Set();
    const { map } = gameState;
    const isWizard = caster.typeId === "wizard";
    // Elf "Roots of the World" is Forest-only --
    // Human "Teleportation" isn't restricted by terrain.
    const isValidSlot = isWizard ? window.GameEngine.ai.isValidTeleportTile : window.GameEngine.ai.isValidForestTeleportTile;
    const slots = [];
    for (const idx of explored) {
      const x = idx % map.width, y = Math.floor(idx / map.width);
      if (isValidSlot(gameState, x, y, targetUnit)) slots.push({ x, y });
    }
    const abilityLabel = isWizard ? "Teleportation" : "Roots of the World";
    const performTeleport = isWizard
      ? window.GameEngine.ai.performPlayerWizardTeleport
      : window.GameEngine.ai.performPlayerDruidTeleport;
    viewState.placement = {
      slots,
      label: targetUnit === caster ? abilityLabel : `${abilityLabel}: ${targetUnit.name || window.GameData.getUnit(targetUnit.typeId).label}`,
      // previewUnitId/previewRaceId: same
      // half-transparent sprite preview as the summon flows -- shows the
      // unit actually being relocated (the caster itself, or the targeted
      // ally) standing on the hovered tile.
      previewUnitId: targetUnit.typeId, previewRaceId: civ.raceId,
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) {
          performTeleport(civ, caster, targetUnit, slot.x, slot.y, gameState);
          // Same immediate-visibility fix as Summon Wisp/Set the Trap
          // -- teleporting onto a distant
          // explored-but-not-currently-visible tile is exactly the "shows
          // up late" case, arguably more exposed to it than either of those
          // two since the destination can be anywhere already explored.
          window.GameEngine.turns.refreshVisibility(gameState);
        }
        redraw();
      },
    };
    redraw();
  }

  /** Human "Fireball!": tile-placement mode over
   *  every in-bounds tile within FIREBALL_RANGE (3, mirrored here as a
   *  literal -- see ai.js) of the caster -- no explored/visibility
   *  requirement, matching orders.js's own gate on the ring option. Picking
   *  a slot commits via performPlayerFireball; clicking outside every
   *  highlighted tile cancels, same convention as every other placement
   *  flow. No preview sprite (see startTeleportPlacement's previewUnitId)
   *  -- Fireball doesn't relocate a unit, it detonates on the chosen tile. */
  function startFireballPlacement(caster) {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const { map } = gameState;
    const range = 3; // FIREBALL_RANGE, ai.js
    const slots = [];
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const x = caster.x + dx, y = caster.y + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        if (window.GameEngine.influence.chebyshev(caster.x, caster.y, x, y) > range) continue;
        slots.push({ x, y });
      }
    }
    viewState.placement = {
      slots,
      label: "Fireball!",
      // Blast preview (render.js's drawPlacementOverlay): the hovered
      // tile's own 3x3 blast (see combat.js's applyFireballBlast) drawn as
      // an offset list, not just the single anchor tile -- so the player
      // can actually see what the blast will hit before committing.
      aoeOffsets: (() => {
        const offs = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) offs.push({ dx, dy });
        return offs;
      })(),
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) window.GameEngine.ai.performPlayerFireball(civ, caster, slot.x, slot.y, gameState);
        redraw();
      },
    };
    redraw();
  }

  /** Dwarf "Bombardment": same tile-placement shape as Fireball! just
   *  above -- Bombard's ONLY offense (see units.js's noOrdinaryAttack), so
   *  this is unconditional rather than gated behind a second tech. The
   *  picked tile becomes one CORNER of the 2x2 blast (see combat.js's
   *  bombardBlastOffsets/applyBombardBlast), not a center -- which corner
   *  depends on which side of the Bombard the hovered tile is on, so the
   *  same convention orders.js's ring pill/ai.js's scoreBombardBlast use. */
  function startBombardmentPlacement(caster) {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const { map } = gameState;
    const range = 3; // BOMBARDMENT_RANGE, ai.js
    const slots = [];
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        const x = caster.x + dx, y = caster.y + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        if (window.GameEngine.influence.chebyshev(caster.x, caster.y, x, y) > range) continue;
        slots.push({ x, y });
      }
    }
    viewState.placement = {
      slots,
      label: "Bombardment",
      // Blast preview (render.js's drawPlacementOverlay): the hovered
      // tile's own 2x2 blast (see combat.js's bombardBlastOffsets --
      // extends toward the Bombard, so which corner the hovered tile is
      // depends on which side of the Bombard it's on) drawn as an offset
      // list, not just the single anchor tile -- so the player can
      // actually see the other 3 tiles that would also get hit before
      // committing. A function of the hovered tile, not a fixed list --
      // see render.js's drawPlacementOverlay for the caller side.
      aoeOffsets: (tile) => window.GameEngine.combat.bombardBlastOffsets(caster.x, tile.x),
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) window.GameEngine.ai.performPlayerBombardment(civ, caster, slot.x, slot.y, gameState);
        redraw();
      },
    };
    redraw();
  }

  /** Orc "Bog Spirit": same tile-placement
   *  mechanism as Roots of the World above, but the slot list is every
   *  ever-EXPLORED swamp tile (see ai.js's isValidWispSummonTile) -- a Wisp
   *  is permanently confined to swamp terrain, so nowhere else is legal to
   *  summon one into. Picking a slot commits via performPlayerBogWitchSummon;
   *  clicking outside every highlighted tile cancels, same convention as
   *  every other placement flow. */
  function startWispSummonPlacement(bogWitch) {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const explored = gameState.explored[civ.id] || new Set();
    const { map } = gameState;
    const slots = [];
    for (const idx of explored) {
      const x = idx % map.width, y = Math.floor(idx / map.width);
      if (window.GameEngine.ai.isValidWispSummonTile(gameState, civ.id, x, y)) slots.push({ x, y });
    }
    viewState.placement = {
      slots,
      label: "Summon Wisp",
      // previewUnitId/previewRaceId: render.js's
      // drawPlacementOverlay draws a real, half-transparent Wisp sprite on
      // the hovered tile instead of a placeholder rune.
      previewUnitId: "wisp", previewRaceId: civ.raceId,
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) {
          window.GameEngine.ai.performPlayerBogWitchSummon(civ, bogWitch, slot.x, slot.y, gameState);
          // The Wisp's own vision (and the newly-claimed tile itself) won't
          // show up until the next visibility refresh otherwise -- see
          // render.js's Units pass, gated on `visible.has(idx)` -- which
          // would normally wait until this civ's next turn.
          window.GameEngine.turns.refreshVisibility(gameState);
        }
        redraw();
      },
    };
    redraw();
  }

  /** Halfellow "Set the Trap": same
   *  tile-placement mechanism as Summon Wisp above, but the slot list is a
   *  small bounding box around the Trouble Maker itself (TRAP_PLACEMENT_RANGE
   *  in ai.js), not the whole ever-explored set -- a trap is snuck in right
   *  under its own feet, not summoned from afar, so scanning the full
   *  explored set the way Wisp does would be pure waste. `trapKind` is
   *  "frost" or "fire" (see the setTrap:frost/setTrap:fire ring options in
   *  orders.js), threaded through to performPlayerTrapSet on pick. No
   *  bespoke overlay kind -- falls through to render.js's plain gold
   *  pulsing-rectangle default, same as most other placement flows. */
  function startTrapPlacement(troubleMaker, trapKind) {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const RANGE = 2; // mirrors ai.js's TRAP_PLACEMENT_RANGE
    const slots = [];
    for (let dy = -RANGE; dy <= RANGE; dy++) {
      for (let dx = -RANGE; dx <= RANGE; dx++) {
        const x = troubleMaker.x + dx, y = troubleMaker.y + dy;
        if (window.GameEngine.ai.isValidTrapPlacementTile(gameState, civ.id, x, y, troubleMaker)) slots.push({ x, y });
      }
    }
    viewState.placement = {
      slots,
      label: trapKind === "fire" ? "Set Fire Trap" : "Set Frost Trap",
      // previewUnitId/previewRaceId: render.js's
      // drawPlacementOverlay draws a real, half-transparent trap sprite on
      // the hovered tile instead of the plain gold rectangle alone.
      previewUnitId: trapKind === "fire" ? "trap_fire" : "trap_frost", previewRaceId: civ.raceId,
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) {
          window.GameEngine.ai.performPlayerTrapSet(civ, troubleMaker, trapKind, slot.x, slot.y, gameState);
          // Same immediate-visibility fix as Summon Wisp above -- a freshly
          // placed trap otherwise wouldn't render until this civ's next
          // visibility refresh.
          window.GameEngine.turns.refreshVisibility(gameState);
        }
        redraw();
      },
    };
    redraw();
  }

  /** Halfellow "Banish the Darkness" (2026-08-24): same tile-placement
   *  mechanism as Set the Trap just above, but range 1 -- true 8-neighbor
   *  adjacency, matching the Bonfire's original random-pick reach (see
   *  ai.js's spawnUnitAdjacentToUnit) -- rather than that range-2 bounding
   *  box. Slot list built from ai.js's isValidGreatBonfirePlacementTile,
   *  which already excludes occupied tiles (any unit, friend or foe),
   *  water/impassable terrain, and enemy structures/cities -- same
   *  occupancy rule every other instant-placement flow in this file uses. */
  function startGreatBonfirePlacement(wanderer) {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const slots = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = wanderer.x + dx, y = wanderer.y + dy;
        if (window.GameEngine.ai.isValidGreatBonfirePlacementTile(gameState, civ.id, x, y, wanderer)) slots.push({ x, y });
      }
    }
    viewState.placement = {
      slots,
      label: "Create The Great Bonfire",
      // previewUnitId/previewRaceId: render.js's drawPlacementOverlay draws
      // a real, half-transparent Great Bonfire sprite on the hovered tile.
      previewUnitId: "great_bonfire", previewRaceId: civ.raceId,
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) {
          window.GameEngine.ai.performPlayerWandererBonfireSummon(civ, wanderer, gameState, slot.x, slot.y);
          window.GameEngine.turns.refreshVisibility(gameState);
        }
        redraw();
      },
    };
    redraw();
  }

  /** Halfellow "Fairy Ring": same tile-placement mechanism as Create The
   *  Great Bonfire just above, for the Mushroomancer's Create Mushroom
   *  instead -- see ai.js's isValidMushroomPlacementTile. */
  function startMushroomPlacement(mushroomancer) {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const slots = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = mushroomancer.x + dx, y = mushroomancer.y + dy;
        if (window.GameEngine.ai.isValidMushroomPlacementTile(gameState, civ.id, x, y, mushroomancer)) slots.push({ x, y });
      }
    }
    viewState.placement = {
      slots,
      label: "Create Mushroom",
      previewUnitId: "mushroom", previewRaceId: civ.raceId,
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) {
          window.GameEngine.ai.performPlayerMushroomancerCreateMushroom(civ, mushroomancer, gameState, slot.x, slot.y);
          window.GameEngine.turns.refreshVisibility(gameState);
        }
        redraw();
      },
    };
    redraw();
  }

  /** Carry/Board: whichever ring the player opened decides which of the two
   *  is the acting unit and which was picked in target-selection mode -- the
   *  two call sites pass them in the right roles. Delegates the actual
   *  eligibility re-check and state mutation to orders.js's performCarry,
   *  same "re-validate, don't trust a menu that might be stale" reasoning
   *  castFlight's handler already follows. */
  function handleCarryUnit(carrier, passenger) {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ || !carrier || !passenger) return;
    window.GameEngine.orders.performCarry(carrier, passenger, civ);
  }

  function handleCancelChannel() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (!unit.channeling) return;
    unit.channeling = null;
    redraw();
  }

  /** "Claim Gathered Resources": a clean
   *  voluntary stop that BANKS unit._channelStash into the civ's stockpile
   *  before clearing the channel -- mirrors ai.js's maybeCashOutChannel
   *  (the AI's own voluntary-stop path) exactly, just player-triggered
   *  instead of value/danger-triggered. Distinct from handleCancelChannel
   *  just above, which forfeits the stash (turns.js's own documented rule
   *  for a forced-style interruption) -- this is the "stop and keep it"
   *  option. */
  function handleClaimChannel() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    const civ = gameState.civs[humanCivId];
    if (!civ || !unit.channeling) return;
    unit.automated = false;
    unit.pendingIntent = null;
    unit.channeling = null;
    window.GameEngine.turns.bankChannelStash(unit, civ);
    unit.resting = true;
    unit.usedThisTurn = true;
    redraw();
  }

  /**
   * Queues the picked build. Units start immediately; buildings first drop
   * into placement mode -- the player clicks one of the highlighted legal
   * slots on the map and the build is queued bound to that tile, so
   * placement is chosen at queue time, not on completion.
   */
  /** Whether building one more `unitId` would push the civ's net income
   *  (income minus total unit upkeep) negative on any resource -- same math
   *  as sidebar.js's own Economy panel "Net (H/C/L)" row, just with this
   *  one hypothetical extra unit's upkeep folded in before committing
   *. Returns a "H/C/L" label naming the
   *  resource(s) that would go negative, or null if the build is safe. */
  function wouldUpkeepGoNegative(civ, unitId) {
    const res = civ.resources || { harvest: 0, coin: 0, lore: 0 };
    const newUpkeep = window.GameData.unitUpkeep(unitId, civ);
    const totals = civ.units.reduce((acc, u) => {
      const up = window.GameData.unitUpkeep(u.typeId, civ, u);
      acc.harvest += up.harvest || 0; acc.coin += up.coin || 0; acc.lore += up.lore || 0;
      return acc;
    }, { harvest: 0, coin: 0, lore: 0 });
    const net = {
      harvest: res.harvest - totals.harvest - (newUpkeep.harvest || 0),
      coin: res.coin - totals.coin - (newUpkeep.coin || 0),
      lore: res.lore - totals.lore - (newUpkeep.lore || 0),
    };
    const negatives = [];
    if (net.harvest < 0) negatives.push("Harvest");
    if (net.coin < 0) negatives.push("Coin");
    if (net.lore < 0) negatives.push("Lore");
    return negatives.length ? negatives.join(", ") : null;
  }

  function handleChooseBuild(index) {
    // Resolved from viewState.ringMenu, NOT viewState.selectedCity
    //. This popover can be open while a
    // MERGED ring's subject is "unit" (a unit standing on its own city --
    // see orders.js's mergeUnitCityOptions), in which case the sidebar's
    // active tab is deliberately left on the unit, so selectedCity is null
    // by the time this fires -- resolveSelection() resets it on every
    // redraw in between opening the popover and clicking a row in it.
    // ringMenu.x/y always names the right city regardless: it's the tile
    // this whole popover is anchored to.
    if (!humanCivId || !viewState.ringMenu) return;
    const civ = gameState.civs[humanCivId];
    const city = civ.cities.find((c) => c.x === viewState.ringMenu.x && c.y === viewState.ringMenu.y);
    if (!city) return;
    const options = window.GameEngine.ai.availableBuilds(civ, city, gameState);
    const option = options[index];
    if (!option) return;

    // Close the ring FIRST, before either branch (2026-08-06). The building
    // branch below hands the map over to placement mode, which is a modal
    // cursor that swallows left-clicks -- an open popover sitting on top of
    // the very slots the player now has to click would be actively in the
    // way, and right-click (the placement escape hatch) would be ambiguous.
    viewState.ringMenu = null;

    if (option.kind !== "building") {
      // Negative-net-upkeep warning: same "Net
      // (H/C/L)" math as the sidebar's own Economy panel (js/ui/sidebar.js),
      // just previewing this one MORE unit's upkeep added on top before
      // committing, rather than only showing it after the fact.
      const wouldGoNegative = wouldUpkeepGoNegative(civ, option.id);
      if (wouldGoNegative) {
        viewState.dialog = {
          kind: "confirm",
          title: "Build Anyway?",
          text: `Building this unit would put your net income into the negative (${wouldGoNegative}). Build anyway?`,
          confirmLabel: "Build Anyway",
          // wireDialogButtons' "confirm" branch already nulls viewState.dialog
          // and calls redraw() after this returns -- goToNextIdleCityOrNextUnit
          // triggers its own selection change, which that redraw() picks up.
          onAnswer: (ok) => {
            if (ok) {
              const queued = window.GameEngine.orders.queueBuild(city, civ, gameState, option, null);
              if (queued) goToNextIdleCityOrNextUnit();
            }
          },
        };
        redraw();
        return;
      }
      const queued = window.GameEngine.orders.queueBuild(city, civ, gameState, option, null);
      if (!queued || !goToNextIdleCityOrNextUnit()) redraw();
      return;
    }

    viewState.placement = {
      slots: option.slots,
      label: option.label,
      onPick: (slot) => {
        // A click outside the highlighted slots cancels rather than queuing
        // the building somewhere arbitrary -- and rather than navigating
        // away, since nothing was actually queued.
        const queued = slot ? window.GameEngine.orders.queueBuild(city, civ, gameState, option, slot) : false;
        viewState.placement = null;
        if (!queued || !goToNextIdleCityOrNextUnit()) redraw();
      },
    };
    redraw();
  }

  /** "Resource Production": spends this city's
   *  production for the CURRENT turn on resources instead of a unit or a
   *  building -- see cities.js's applyResourceProduction for the payout and
   *  why it lands on this turn rather than the next one.
   *
   *  Takes `city` explicitly rather than reading it back from
   *  viewState.ringMenu.x/y: handleContextMenuAction nulls
   *  viewState.ringMenu BEFORE calling handleCityRingAction, which is what
   *  calls this, so ringMenu is already null by the time this runs.
   *  handleCityRingAction has already resolved the correct city by the time
   *  it calls this, the same way it already passes `city` directly to
   *  cancelBuild/applyResearchBoost right alongside this call. */
  function handleResourceProduction(city) {
    const civ = humanCivId && gameState.civs[humanCivId];
    if (!civ || !city || city.civId !== humanCivId) return;
    if (!window.GameEngine.cities.applyResourceProduction(city, civ, gameState)) return;
    if (!goToNextIdleCityOrNextUnit()) redraw();
  }

  /** Finishing research via a city's own "Research" boost pill must also
   *  trigger the "research complete" dialog, not just turns.js's per-turn
   *  tickResearch path -- both need to set civ.lastCompletedTech (see
   *  finishRoundBookkeeping, which reads and clears it every round).
   *  applyResearchBoost/reduceResearchTurns share the identical completion
   *  logic and return a receipt with the same shape (`{completed, techId}`),
   *  just never wrote it into that flag -- do so here so both paths notify
   *  the same way. Its own named handler (rather than inlined in
   *  handleCityRingAction) so the Space-bar shortcut can call the exact
   *  same path a ring click does. */
  function handleCityResearch(city) {
    const civ = humanCivId && gameState.civs[humanCivId];
    if (!civ || !city || city.civId !== humanCivId) return;
    const result = window.GameEngine.cities.applyResearchBoost(city, civ, gameState);
    if (!result) return;
    if (result.completed) civ.lastCompletedTech = result.techId;
    if (!goToNextIdleCityOrNextUnit()) redraw();
  }

  /** Unlike handleResourceProduction/handleCityResearch above, Spread
   *  Culture doesn't consume the city's turn (see cities.js's
   *  applyCultureSpread -- it's paid from stockpile, not production), so
   *  isCityIdle still considers this city idle right after it fires. Stays
   *  on the same city (just redraw()) rather than jumping to the next idle
   *  city/unit, since the player likely still wants to also queue a build
   *  here. */
  function handleSpreadCulture(city) {
    const civ = humanCivId && gameState.civs[humanCivId];
    if (!civ || !city || city.civId !== humanCivId) return;
    if (!window.GameEngine.cities.applyCultureSpread(city, civ, gameState)) return;
    redraw();
  }

  /** Halfellow "Throw a Party" (see cities.js's applyThrowAParty). Same
   *  shape as handleSpreadCulture just above -- stockpile-paid, doesn't
   *  consume the city's turn, stays on the same city rather than jumping
   *  away. Its own sfx/confetti/radius-pulse cosmetics all fire from inside
   *  applyThrowAParty itself, not here. */
  function handleThrowAParty(city) {
    const civ = humanCivId && gameState.civs[humanCivId];
    if (!civ || !city || city.civId !== humanCivId) return;
    if (!window.GameEngine.cities.applyThrowAParty(city, civ, gameState)) return;
    redraw();
  }

  /** "Expedite Unit Build" -- the Human Bazaar's city action (see cities.js's
   *  applyExpediteBuild). Same shape as handleSpreadCulture just above: paid
   *  from stockpile rather than the city's production turn, so it neither
   *  spends this city's build slot nor moves the selection anywhere -- the
   *  player is most likely to want to look at (or expedite again next turn)
   *  the very city they just clicked. */
  function handleExpediteBuild(city) {
    const civ = humanCivId && gameState.civs[humanCivId];
    if (!civ || !city || city.civId !== humanCivId) return;
    if (!window.GameEngine.cities.applyExpediteBuild(city, civ, gameState)) return;
    window.SfxSystem.playConfirmAction();
    redraw();
  }

  /** Toggles city automation
   *  -- the city-side counterpart of toggleAutomateUnit below. See cities.js's
   *  runCityAutomation for what an automated city actually does each turn
   *  (culture / gather / research, never a build) and turns.js's beginCivTurn
   *  for where it's driven from.
   *
   *  Fires one automated action IMMEDIATELY on switch-on rather than waiting
   *  for the next turn to roll around: beginCivTurn already ran for this turn
   *  before the player could click anything, so without this the city would
   *  visibly sit idle for the rest of the turn it was just automated on,
   *  which reads as the toggle not having worked. Turning automation OFF
   *  can't un-spend an action that already fired, so that direction just
   *  clears the flag. */
  function handleToggleAutomateCity(city) {
    const civ = humanCivId && gameState.civs[humanCivId];
    if (!civ || !city || city.civId !== humanCivId) return;
    // Switching ON opens the mix dialog first (2026-08-24) -- automation is
    // driven by a player-set quota now, not a fixed priority order, so there
    // are settings to collect before it can run. Cancelling (the X) leaves
    // the city un-automated rather than automating it with defaults.
    // Switching OFF is unchanged: no settings needed to stop.
    if (!city.automated) {
      viewState.dialog = {
        kind: "cityAutomation",
        cityName: city.name,
        // Pre-filled from this city's own last-used mix, so re-automating a
        // city the player already tuned doesn't make them redo it.
        weights: city.automationWeights || { research: 2, culture: 2, resources: 2 },
        onAnswer: (weights) => {
          if (!weights) return; // cancelled -- leave automation off
          city.automationWeights = weights;
          // Counts are per-configuration: keeping the old tallies would make
          // the quota spend its first turns "catching up" against a mix the
          // player just replaced.
          city.automationCounts = { research: 0, culture: 0, resources: 0 };
          city.automated = true;
          window.GameEngine.cities.runCityAutomation(civ, city, gameState);
          redraw();
        },
      };
      redraw();
      return;
    }
    city.automated = !city.automated;
    // A research boost that completes a tech raises the "research complete"
    // dialog through civ.lastCompletedTech, which runCityAutomation already
    // sets and finishRoundBookkeeping reads and clears at the end of the
    // round -- exactly the same indirection handleCityResearch relies on for
    // a manual boost. Deliberately NOT calling finishRoundBookkeeping here:
    // it also resolves victory/defeat and music state against
    // pendingPreUnitCounts, none of which is valid mid-turn.
    if (city.automated) window.GameEngine.cities.runCityAutomation(civ, city, gameState);
    redraw();
  }

  /** Spends one pending level-up on `stat` for the currently selected unit
   *: the player-facing counterpart to ai.js's
   *  chooseLevelUpStat -- see sidebar.js's levelUpActions for the button
   *  markup and ai.js's applyComputedXP for why a human-controlled unit's
   *  level-up is left pending instead of auto-resolved in the first place. */
  function handleChooseLevelUp(stat) {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.civId !== humanCivId) return;
    window.GameEngine.combat.applyLevelUp(unit, stat);
    redraw();
  }

  /** Selects the next unit still awaiting orders and scrolls the map to it.
   *  Cycles in roster order, resuming after whichever unit is currently
   *  selected rather than always restarting at the first -- so repeated
   *  presses walk the whole list instead of bouncing between two units. */
  function handleNextUnit() {
    if (!humanCivId) return;
    const waiting = window.GameEngine.orders.unitsNeedingOrders(gameState, humanCivId);
    if (!waiting.length) return;
    const current = viewState.selectedUnit;
    const currentIdx = current ? waiting.indexOf(current) : -1;
    const next = waiting[(currentIdx + 1) % waiting.length];
    window.UI.input.handleTileClick({ x: next.x, y: next.y }, gameState, viewState);
    // Make sure the unit's own tab is the active one -- handleTileClick keeps
    // the previously-active tab KIND, so arriving from a Terrain tab would
    // otherwise land on Terrain again and hide the unit you just jumped to.
    const sel = viewState.selection;
    if (sel) {
      const idx = sel.tabs.findIndex((t) => t.kind === "unit" && t.unit === next);
      if (idx >= 0) window.UI.input.setActiveTab(gameState, viewState, idx);
    }
    centerViewOn(next.x, next.y);
    // Flash the tile -- see render.js's
    // drawFlashTile, driven by the existing per-frame animation loop.
    viewState.flashTile = { x: next.x, y: next.y, startTime: performance.now() };
    redraw();
  }

  /** "Next Idle City" -- same cycler shape as
   *  handleNextUnit just above, for cities.js's isCityIdle predicate (the
   *  same one backing the sidebar's per-city Idle tag, the map's idle
   *  badge, and the End Turn nag) instead of units needing orders. Mirrors
   *  handleNextUnit's exact step order (select+tab, THEN center, THEN
   *  flash, THEN one redraw at the end) rather than calling goToTile --
   *  that helper redraws internally, which would land the flash flag one
   *  frame too late. */
  function handleNextIdleCity() {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const idle = civ.cities.filter((c) => window.GameEngine.cities.isCityIdle(civ, c, gameState));
    if (!idle.length) return;
    const current = viewState.selectedCity;
    const currentIdx = current ? idle.indexOf(current) : -1;
    const next = idle[(currentIdx + 1) % idle.length];
    window.UI.input.handleTileClick({ x: next.x, y: next.y }, gameState, viewState);
    const sel = viewState.selection;
    if (sel) {
      const idx = sel.tabs.findIndex((t) => t.kind === "city" && t.city === next);
      if (idx >= 0) window.UI.input.setActiveTab(gameState, viewState, idx);
    }
    centerViewOn(next.x, next.y);
    viewState.flashTile = { x: next.x, y: next.y, startTime: performance.now() };
    redraw();
  }

  /** After the player selects an action for a city: jump straight to
   *  the next idle city if any remain,
   *  otherwise the next unit still awaiting orders, otherwise leave the
   *  camera where it is. Reuses the exact same cyclers the sidebar's own
   *  "Next Idle City"/"Next Unit" buttons call (handleNextIdleCity/
   *  handleNextUnit just above) so the player doesn't have to reach for
   *  those by hand after every single city order. Returns whether it
   *  actually navigated -- both cyclers already redraw() internally, so a
   *  caller that navigated should skip its own redraw() rather than
   *  double up. */
  function goToNextIdleCityOrNextUnit() {
    if (!humanCivId) return false;
    const civ = gameState.civs[humanCivId];
    if (!civ) return false;
    if (civ.cities.some((c) => window.GameEngine.cities.isCityIdle(civ, c, gameState))) {
      handleNextIdleCity();
      return true;
    }
    if (window.GameEngine.orders.unitsNeedingOrders(gameState, humanCivId).length) {
      handleNextUnit();
      return true;
    }
    return false;
  }

  /**
   * Recenters the map on tile (x,y) and selects it, optionally forcing a
   * particular inspector tab open -- e.g. a city name in the Kingdom tab
   * jumps to the city AND opens its City tab, rather than landing on
   * whichever tab the normal click rules would have picked.
   *
   * Silently ignores an out-of-bounds tile: link coordinates come from live
   * game state, but a save loaded onto a smaller map (or a stale sidebar
   * still on screen) shouldn't throw.
   */
  function goToTile(x, y, tabKind) {
    if (!gameState || !Number.isFinite(x) || !Number.isFinite(y)) return;
    const { map } = gameState;
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;

    window.UI.input.handleTileClick({ x, y }, gameState, viewState);
    if (tabKind) {
      const sel = viewState.selection;
      const idx = sel ? sel.tabs.findIndex((t) => t.kind === tabKind) : -1;
      if (idx >= 0) window.UI.input.setActiveTab(gameState, viewState, idx);
    }
    centerViewOn(x, y);
    // Brief flash -- render.js's drawTileFlash
    // fades this out on its own over TILE_FLASH_ANIM_MS; the animation loop
    // already calls render() every frame regardless (see startAnimationLoop),
    // so no extra redraw scheduling is needed to animate it.
    viewState.tileFlash = { x, y, start: performance.now() };
    redraw();
  }

  /** Scrolls the 2D map so tile (x,y) sits in the middle of the viewport. */
  function centerViewOn(x, y) {
    const canvas = $("map-canvas");
    const ts = window.UI.render.TILE_SIZE * (viewState.zoomLevel || 1);
    // CSS-pixel size, not the DPR-scaled buffer size -- see resizeMapCanvas.
    viewState.scrollX = (x + 0.5) * ts - (canvas.__cssW || canvas.width) / 2;
    viewState.scrollY = (y + 0.5) * ts - (canvas.__cssH || canvas.height) / 2;
  }

  function handleBuildRoad() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.typeId !== "pioneer" || unit.usedThisTurn) return;
    endAutomationAndGoto(unit);
    const tile = gameState.map.tiles[unit.y * gameState.map.width + unit.x];
    if (!tile.hasRoad) {
      tile.hasRoad = true;
      unit.usedThisTurn = true;
    }
    redraw();
  }

  /** Help Build: a Pioneer standing on its own
   *  city cuts 1 turn off whatever that city is currently building -- see
   *  orders.js's contextMenuOptions for the "helpBuild" ring option this
   *  answers, gated the same way handleBuildRoad is (typeId, not just the
   *  canBuildRoad data flag, to match that existing convention). Spends the
   *  Pioneer's action for the turn, same as Build Road Here. */
  function handleHelpBuild() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.typeId !== "pioneer" || unit.usedThisTurn) return;
    const civ = gameState.civs[humanCivId];
    const city = civ && civ.cities.find((c) => c.x === unit.x && c.y === unit.y);
    if (!city || !city.buildQueue || city.buildQueue.turnsRemaining === undefined) return;
    endAutomationAndGoto(unit);
    city.buildQueue.turnsRemaining--;
    unit.usedThisTurn = true;
    redraw();
  }

  /** Disband is the only permanent, no-undo action a unit's own action list
   *  offers -- it used to fire immediately on
   *  click, one text-color away from Rest/Defend in the same button list,
   *  while Found City (fully reversible -- you just don't get a city) asked
   *  for confirmation. Gated behind the same generic confirm dialog Found
   *  City itself uses (see js/ui/dialog.js's "confirm" kind), `danger: true`
   *  for the matching red fill. */
  function handleDisbandUnit() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    const baseUnit = window.GameData.getUnit(unit.typeId);
    viewState.dialog = {
      kind: "confirm",
      title: "Disband Unit?",
      text: `Disband this ${baseUnit.label}${unit.name ? ` (${unit.name})` : ""}? This cannot be undone.`,
      confirmLabel: "Disband",
      danger: true,
      onAnswer: (ok) => {
        if (!ok) return;
        const humanCiv = gameState.civs[humanCivId];
        // If this unit is carrying something, drop the cargo at its position
        if (unit.carries) {
          unit.carries.carriedBy = null;
          unit.carries.x = unit.x;
          unit.carries.y = unit.y;
          unit.carries = null;
        }
        // If this unit is being carried, detach from carrier
        if (unit.carriedBy) {
          unit.carriedBy.carries = null;
          unit.carriedBy = null;
        }
        humanCiv.units = humanCiv.units.filter(u => u !== unit);
        // Drop the tab's pin on this now-deleted unit. Without this, the next
        // resolveSelection would still be hunting for it by reference; it falls
        // back gracefully either way, but clearing the ref lets it pick the
        // tile's remaining content cleanly instead of matching on kind alone.
        viewState.selectedUnit = null;
        if (viewState.selection) {
          viewState.selection.activeRef = null;
          viewState.selection.activeKind = null;
        }
      },
    };
    redraw();
  }

  // Expose for sidebar button wiring
  window.UI.actions = window.UI.actions || {};
  window.UI.actions.buildRoad = () => handleBuildRoad();

  // Headless simulation test hook (temporary scaffolding for balance
  // testing -- not part of normal gameplay). Reuses the real
  // createNewGame/runTurn code paths so AI-vs-AI games run identically to a
  // real spectator game, just without the UI/render loop.
  window.__sim = {
    newGame(raceIds, seed, monsterCapPerKingdom, worldType) {
      gameState = createNewGame(raceIds, seed, monsterCapPerKingdom, worldType);
      window.GameEngine.turns.refreshVisibility(gameState);
      return gameState;
    },
    getState: () => gameState,
    // View-side counterpart to getState -- lets a test drive the real input
    // path (render.js's tileCenterOnMap needs viewState to turn a tile into
    // the pixel to click) instead of reaching past the UI to call handlers
    // directly, which is what makes modal flows like target-selection
    // verifiable at all.
    getViewState: () => viewState,
    runTurn: (opts) => window.GameEngine.turns.runTurn(gameState, opts),
  };

  // Continuous animation loop — re-renders the map canvas every frame so
  // animated tile sprites play independently of turn progression or input.
  // The sidebar is not re-rendered here (data doesn't change between turns).
  let animFrameId = null;
  let lastPanMs = null;
  // WASD map panning -- px/second at 100% zoom,
  // applied every frame while a key is held (see setupGlobalShortcuts'
  // panKeys) rather than one fixed step per keydown, so holding a key pans
  // smoothly regardless of the OS's key-repeat rate. 2D only, same scoping
  // as the clouds layer a few lines down -- the 3D renderer has its own
  // separate camera model this doesn't touch.
  const PAN_SPEED = 900;
  function startAnimationLoop() {
    if (animFrameId !== null) return; // already running
    function frame() {
      if (gameState && viewState) {
        if (viewState.is3D) {
          window.UI.render3d.render($("map-canvas-3d"), gameState, viewState);
        } else {
          if (panKeys.size) {
            const now = performance.now();
            const dt = lastPanMs === null ? 0 : Math.min(0.1, (now - lastPanMs) / 1000);
            lastPanMs = now;
            const delta = PAN_SPEED * dt;
            viewState.scrollX = viewState.scrollX || 0;
            viewState.scrollY = viewState.scrollY || 0;
            if (panKeys.has("w")) viewState.scrollY -= delta;
            if (panKeys.has("s")) viewState.scrollY += delta;
            if (panKeys.has("a")) viewState.scrollX -= delta;
            if (panKeys.has("d")) viewState.scrollX += delta;
          } else {
            lastPanMs = null; // next hold starts from dt=0, not a stale gap
          }
          window.UI.render.render($("map-canvas"), gameState, viewState);
          // Clouds ride this same loop, drawn onto their own overlay canvas
          // after the map beneath them. 2D only
          // -- the 3D path has no equivalent sky layer, and its canvas is a
          // different element entirely.
          window.UI.clouds.render($("map-clouds"), viewState);
        }
      }
      animFrameId = requestAnimationFrame(frame);
    }
    animFrameId = requestAnimationFrame(frame);
  }

  /** Registers sw.js -- see that file's own header for the network-first
   *  strategy and why it's safe to leave on during active development (a
   *  cache-first shell would otherwise keep serving a stale js/main.js after
   *  every edit until a hard refresh).
   *
   *  Fire-and-forget, after `load` rather than DOMContentLoaded: registering
   *  a service worker triggers its own network activity, which has no
   *  reason to compete with the title screen's own asset loading for
   *  bandwidth or main-thread time on a slow connection. Guarded on
   *  serviceWorker existing in navigator at all, so this is silently a
   *  no-op for file:// or any browser without support -- never a console
   *  error blocking anything else. */
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  }

  document.addEventListener("DOMContentLoaded", showSetupScreen);
  window.addEventListener("load", registerServiceWorker);
})();
