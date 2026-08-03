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
  let humanCivId = null;
  let spectatorMode = false;
  let spectatorSpeed = 1; // 1x/2x/4x/8x/16x -- see the speed-btn row in index.html
  let spectatorPaused = false;
  let autoplayTimer = null;
  let aiDifficulty = "normal";
  let loadingStatusTimer = null; // see showLoadingScreen/hideLoadingScreen

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

  // --- Title screen music ---
  // Place your track at assets/music/title.mp3.
  let titleAudio = null;

  function initTitleAudio() {
    if (titleAudio) return titleAudio;
    console.log("[title music] creating Audio — assets/music/title.mp3");
    titleAudio = new Audio("assets/music/title.mp3");
    titleAudio.loop   = true;
    titleAudio.volume = 1.0;

    titleAudio.addEventListener("error", () => {
      const code = titleAudio.error?.code ?? "?";
      console.error(`[title music] load error code ${code} (1=ABORTED 2=NETWORK 3=DECODE 4=NOT_SUPPORTED)`);
      console.error("[title music] check that assets/music/title.mp3 exists and is a valid MP3");
      setMusicBtnState("error");
    });
    titleAudio.addEventListener("canplay", () =>
      console.log("[title music] canplay — file buffered and ready to play"));
    titleAudio.addEventListener("playing", () => {
      console.log("[title music] playing event — audio output confirmed");
      setMusicBtnState("playing");
    });
    titleAudio.addEventListener("pause", () => {
      console.log("[title music] paused");
      setMusicBtnState("idle");
    });
    return titleAudio;
  }

  function playTitleMusic() {
    const audio = initTitleAudio();
    console.log("[title music] calling play()…");
    audio.play()
      .then(() => console.log("[title music] play() resolved — waiting for playing event"))
      .catch((err) => {
        console.warn(`[title music] play() rejected — ${err.name}: ${err.message}`);
        console.warn("[title music] autoplay blocked; click the ♪ Play Music button to start");
        setMusicBtnState("idle");
      });
  }

  function toggleTitleMusic() {
    const audio = initTitleAudio();
    if (!audio.paused) {
      console.log("[title music] button: pausing");
      audio.pause();
    } else {
      console.log("[title music] button: playing");
      playTitleMusic();
    }
  }

  function stopTitleMusic() {
    if (!titleAudio) return;
    console.log("[title music] fading out for game start");
    const audio = titleAudio;
    fadeAudioTo(audio, 0, 1000, () => audio.pause());
  }

  function setMusicBtnState(state) {
    const btn = document.getElementById("title-music-btn");
    if (!btn) return;
    if (state === "playing") {
      btn.textContent = "♪ Stop Music";
      btn.disabled    = false;
    } else if (state === "idle") {
      btn.textContent = "♪ Play Music";
      btn.disabled    = false;
    } else if (state === "error") {
      btn.textContent = "♪ (no audio file)";
      btn.disabled    = true;
    }
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
  // Pacing experiment (2026-07-12): ~20% fewer tiles than the previous
  // 65x40 (2600) -- forces civs closer together for faster contact/
  // conflict. Same aspect ratio, scaled by sqrt(0.8). See
  // project_pacing_experiment memory. 58x36 (2088 tiles) is the REFERENCE
  // size this constant now scales from -- it's what this session's
  // balance/pacing testing was actually calibrated against, almost all of
  // it with 3 civs (Orc/Human/Halfellow), so a 3-civ game reproduces this
  // exact size unchanged.
  const REFERENCE_MAP_WIDTH = 58, REFERENCE_MAP_HEIGHT = 36, REFERENCE_CIV_COUNT = 3;
  // Dynamic map sizing (2026-07-12): a map sized for 3-4 civs left a LOT of
  // unclaimed land in 2-civ head-to-head testing -- confirmed directly (see
  // project_stuck_unit_bugs memory) as a real contributor to games timing
  // out at the 900-turn cap without either side reaching the 30% territory
  // victory threshold, purely because there was more empty map to cover
  // than a 2-civ game could realistically claim. Scaling map AREA linearly
  // with civ count (so width/height each scale by sqrt(civCount/3)) keeps
  // roughly the same amount of land PER CIV regardless of how many are in
  // the game -- fewer civs get a smaller, tighter map that forces contact
  // sooner; more civs get more room, same as the original 3-civ tuning
  // intended. Clamped to a sane floor/ceiling so a pathological civ count
  // can't produce a degenerate (or absurdly expensive to generate) map.
  const MIN_MAP_WIDTH = 44, MIN_MAP_HEIGHT = 27;
  const MAX_MAP_WIDTH = 90, MAX_MAP_HEIGHT = 56;
  // Orc-vs-Halfellow retest (2026-07-12) showed the civ-count scaling above
  // over-corrected: a 2-civ map (47x29) forced contact so early that Orc's
  // aggression started overwhelming Halfellow before it could establish any
  // defense (Orc win rate 60%->70%, Halfellow wiped out entirely in 30% of
  // games, vs. never before). A flat +20% AREA boost on top of the civ-count
  // scale (not instead of it) gives every civ count a bit more breathing
  // room to build up before first contact, same rationale as the original
  // "-20% tiles" pacing-experiment cut this partially reverses -- a linear
  // dimension scale of sqrt(1.2), not a flat 1.2x width/height (which would
  // compound to +44% area instead of +20%). See project_halfellow_tactics
  // and project_dynamic_map_sizing memory.
  const MAP_SIZE_BOOST = 1.20;
  // Per-civ-above-2 shrink (2026-07-12): an extra -5% AREA for every civ
  // beyond 2 (2 civs: unchanged; 3: -5%; 4: -10%; 5: -15%; 6: -20%),
  // applied on top of everything above. More civs already get a bigger map
  // from the civ-count scaling above (more civs need more land) -- this
  // trims that back down a bit per civ so a crowded 5-6 civ game doesn't
  // sprawl as much extra unclaimed space as the raw sqrt(civCount/3) scale
  // alone would give it. Floored well above zero so a hypothetical civ
  // count far past the UI's actual 2-6 range can't invert the map size.
  const CIV_ABOVE_TWO_SHRINK_RATE = 0.05;
  function mapSizeForCivCount(civCount) {
    const areaShrink = Math.max(0.2, 1 - CIV_ABOVE_TWO_SHRINK_RATE * Math.max(0, civCount - 2));
    const linearScale = Math.sqrt(civCount / REFERENCE_CIV_COUNT) * Math.sqrt(MAP_SIZE_BOOST) * Math.sqrt(areaShrink);
    const width = Math.round(Math.min(MAX_MAP_WIDTH, Math.max(MIN_MAP_WIDTH, REFERENCE_MAP_WIDTH * linearScale)));
    const height = Math.round(Math.min(MAX_MAP_HEIGHT, Math.max(MIN_MAP_HEIGHT, REFERENCE_MAP_HEIGHT * linearScale)));
    return { width, height };
  }

  function $(id) { return document.getElementById(id); }

  function showSetupScreen() {
    // Inject launch controls into the toolbar strip
    $("toolbar-controls").innerHTML = `
      <label class="toolbar-field">
        <input type="checkbox" id="spectator-toggle">
        All-AI Spectator
      </label>

      <div class="toolbar-field" id="human-race-section">
        <span>Race:</span>
        <select id="human-race-select">
          ${RACE_LIST.map((r) => `<option value="${r}">${window.GameData.getRace(r).label} — ${window.GameData.getRace(r).identity}</option>`).join("")}
        </select>
      </div>

      <label class="toolbar-field" id="opponent-count-field">
        <span>Opponents:</span>
        <select id="opponent-count">
          <option value="1">1</option>
          <option value="2" selected>2</option>
          <option value="3">3</option>
          <option value="4">4</option>
          <option value="5">5</option>
        </select>
      </label>

      <div class="toolbar-field" id="spectator-race-section" style="display:none;">
        <span>Races:</span>
        <div id="spectator-race-list" class="race-checklist"></div>
      </div>

      <label class="toolbar-field">
        <span>Difficulty:</span>
        <select id="difficulty-select">
          <option value="easy">Easy</option>
          <option value="normal" selected>Normal</option>
          <option value="hard">Hard</option>
        </select>
      </label>

      <label class="toolbar-field">
        <span>Seed:</span>
        <input type="text" id="seed-input" placeholder="random" style="width:80px">
      </label>
    `;

    // Spectator mode: pick exactly which races participate via checkboxes,
    // instead of a random subset sized by "Opponents" (that dropdown/random
    // pick is still how a human-player game picks its AI opponents).
    $("spectator-race-list").innerHTML = RACE_LIST.map((r) => `
      <label class="race-checklist-item">
        <input type="checkbox" class="spectator-race-checkbox" value="${r}" checked>
        ${window.GameData.getRace(r).label}
      </label>
    `).join("");

    $("spectator-toggle").addEventListener("change", (e) => {
      const isSpectator = e.target.checked;
      $("human-race-section").style.display = isSpectator ? "none" : "flex";
      $("opponent-count-field").style.display = isSpectator ? "none" : "flex";
      $("spectator-race-section").style.display = isSpectator ? "flex" : "none";
    });

    $("start-game-btn").addEventListener("click", startGame);

    $("title-music-btn").addEventListener("click", () => {
      console.log("[title music] button clicked");
      toggleTitleMusic();
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
    aiDifficulty = $("difficulty-select").value;
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

    gameState = createNewGame(racesInPlay, seed);
    // createNewGame leaves visibility empty -- without this, nothing is
    // visible (full fog) until the first End Turn runs beginRound.
    window.GameEngine.turns.refreshVisibility(gameState);
    updateMapSeedLabel();
    viewState = {
      scrollX: 0, scrollY: 0, zoomLevel: 1.0, showInfluence: false, showGrid: true,
      selectedUnit: null, selectedCity: null, selectedTile: null, humanCivId,
      // Tabbed tile inspector -- the selected* fields above are derived from
      // this now (see input.js's SELECTION MODEL).
      selection: null,
      is3D: false, // 3D view was reverted to disabled -- see render3d.js; the Interface menu's "Toggle 3D View" button was removed
      fogMode: "off", fogCivIds: new Set(Object.keys(gameState.civs)), // spectator-only; see setupFogControls
      tileScoreCivId: null, // Interface menu's Tile City Score overlay -- available in both spectator and human modes
      dialog: null, // in-game confirm/prompt/alert replacement -- see js/ui/dialog.js
    };

    stopTitleMusic();
    $("title-screen").style.display = "none";
    showLoadingScreen();

    // Sprites/music/sfx are all real network loads (hundreds of small
    // requests under connection-limit contention can take up to ~15-20s --
    // see render3d.js's own notes on this), and the game screen used to
    // appear immediately regardless, with most art/audio still streaming
    // in -- looked broken rather than loading. Gate showing it on all
    // three actually finishing. Each of these is designed to always
    // resolve, never reject (a missing asset is skipped, not an error --
    // see preloadAll's/SfxSystem.init's own doc comments), so this isn't
    // expected to hang, but a failsafe timeout still backs it up below in
    // case some future asset type doesn't hold to that.
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

  /** Runs once loading actually finishes (or the failsafe timeout fires) --
   *  see startGame's Promise.race. Everything here needs either real DOM
   *  layout (setupCanvas's getBoundingClientRect) or fully-loaded assets,
   *  so none of it could safely run before now. */
  function finishStartGame() {
    hideLoadingScreen();
    $("game-screen").style.display = "flex";
    // Match the two canvases' visibility to viewState.is3D (always false --
    // the 3D toggle was removed, see main.js's viewState init -- but the 3D
    // canvas elements/renderer are still left in place, so keep them hidden
    // explicitly rather than relying on their CSS defaults).
    $("map-canvas").style.display = viewState.is3D ? "none" : "block";
    $("map-canvas-3d").style.display = viewState.is3D ? "block" : "none";
    $("map-canvas-3d-hud").style.display = viewState.is3D ? "block" : "none";

    // Off-screen units shouldn't play sounds (2026-07-24, user-directed) --
    // e.g. a spectator-mode skirmish happening elsewhere on the map. Uses
    // the exact same on-screen test the renderer itself uses to cull
    // off-screen tiles (see render.js's isTileOnScreen); this is the only
    // place gameState/viewState/canvas are all in scope to wire it up.
    // In 3D mode the 2D canvas is display:none, which makes its own
    // getBoundingClientRect() (and so isTileOnScreen's bounds check)
    // collapse to zero -- every tile would wrongly read as "off-screen" and
    // mute every sound. render3d.js has no equivalent viewport-clipping
    // test yet, so this errs toward always audible in 3D rather than
    // silently muting everything.
    window.SfxSystem.setVisibilityCheck((x, y) =>
      viewState.is3D || window.UI.render.isTileOnScreen(x, y, $("map-canvas"), gameState, viewState));

    setupCanvas();
    centerViewOnStart();
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
    setupAudioControls();
    setupSpectatorControls(); // wired unconditionally -- a loaded save can switch modes later
    setupFileControls();
    setupFogControls();
    setupTileScoreControls();
    updateSpeedMenuVisibility();
    updateFogMenuVisibility();

    if (spectatorMode) startAutoplay();

    redraw();
    startAnimationLoop();
  }

  function hashStringToSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }

  function createNewGame(raceIds, seed) {
    const { width: mapWidth, height: mapHeight } = mapSizeForCivCount(raceIds.length);
    const map = window.GameEngine.worldgen.generateMap(mapWidth, mapHeight, seed);
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
    // civs until forced to by civ count exceeding landmass count, which
    // is the best this can do without rejecting/regenerating the whole
    // map -- there's no way to avoid sharing when raceIds.length exceeds
    // landmasses.length. Known limitation, not fixed further here: once
    // two civs DO share a small landmass, the 3-tile city-spacing rule
    // (cities.js MIN_CITY_SPACING) can leave the second civ to settle
    // there very little room, sometimes none. Confirmed via testing on
    // a 6-civs-on-4-landmasses map. Worth a smarter fairness pass later
    // (e.g. preferring bigger landmasses for the share-forced civs) but
    // out of scope for this prototype pass.

    const civs = {};
    let landmassIdx = 0;
    for (const raceId of raceIds) {
      const civId = raceId.toUpperCase();
      const race = window.GameData.getRace(raceId);
      const civ = {
        id: civId, raceId, cities: [], units: [], eliminated: false,
        completedTechs: new Set(), currentResearch: null, researchProgress: 0,
        doctrine: null, // grand-strategy layer -- see engine/strategy.js
        // Each race's 4 buildings are now gated by that race's tech tree (see techs.js
        // building-column nodes) rather than unlocked at civ creation.
        unlockedUnits: new Set(["pioneer", "galley"]), // Worker deprecated -- folded into Pioneer
        unlockedBuildings: new Set(),
        civicInfluenceBonus: 0, radiusBonus: 0, usedCityNames: [],
      };
      civ.completedTechs.add(race.startingTech);
      window.GameEngine.tech.applyTechEffects(civ, window.GameData.getTech(race.startingTech));
      // Human's tech tree fully replaces the shared trunk (no toolcraft/beast_sense) --
      // Scout is granted free at creation instead, same treatment as Pioneer/Galley.
      if (raceId === "human") civ.unlockedUnits.add("scout");

      const spot = pickStartSpot(landmasses, landmassIdx, map, civs, raceId);
      landmassIdx++;
      const settler = { typeId: "pioneer", civId, x: spot.x, y: spot.y, isCivilian: true };
      window.GameEngine.combat.initUnitHP(settler, civ);
      civ.units.push(settler);

      // Pacing experiment (2026-07-12): every race starts with 2 Scouts
      // (not just Human, which already got one via unlockedUnits above) --
      // fog clears faster and settle sites turn up sooner, instead of the
      // opening stretch being spent waiting on a single slow explorer, or
      // none at all for races that haven't researched beast_sense yet. Not
      // gated on the "scout" unlock -- these are handed out directly, same
      // as the Pioneer above, independent of whether the civ could build
      // MORE scouts yet. See project_pacing_experiment memory.
      //
      // Small-landmass swap (2026-07-18, user-directed): a civ starting on a
      // small island gets far less mileage out of a second land Scout (there's
      // only so much of a tiny island left to explore) than it would out of
      // being able to get off the island at all -- so its SECOND starting
      // unit is a free Galley instead, not a second Scout. The first Scout
      // is unconditional for every civ (fog-clearing still matters even on a
      // small island).
      const startingScoutCount = spot.landmassSize < SMALL_LANDMASS_GALLEY_THRESHOLD ? 1 : 2;
      for (let i = 0; i < startingScoutCount; i++) {
        // startingUnit (2026-07-14, user-directed): these free starting units
        // cost no upkeep, ever -- a one-time perk on these specific instances,
        // not a blanket Scout/Galley-type exemption. Anything built later (via
        // the normal chooseBuildAction/canAffordUnitUpkeep path) never gets
        // this flag and costs upkeep like any other unit. See GameData.unitUpkeep.
        const scout = { typeId: "scout", civId, x: spot.x, y: spot.y, isCivilian: true, startingUnit: true };
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

      civs[civId] = civ;
    }

    // Turn order: decided once, randomly, at game start -- then fixed for the
    // rest of the game (never reshuffled turn to turn). Drives both the
    // full-round runTurn and the granular advanceOneUnitStep in turns.js.
    const turnOrder = Object.keys(civs);
    for (let i = turnOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [turnOrder[i], turnOrder[j]] = [turnOrder[j], turnOrder[i]];
    }

    return {
      map, civs, turnNumber: 0, visibility: {}, explored: {}, tileMemory: {},
      turnOrder, turnStepIndex: 0, seed, aiActionLog: [],
    };
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
  // Racial terrain preference (2026-07-18, user-directed): a civ should
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

  /** Match #map-canvas's pixel buffer to its CSS layout size so there's no
   *  scaling. getBoundingClientRect() (and so this) returns all zeros for a
   *  display:none element -- since 3D is now the default view, the 2D
   *  canvas starts out hidden, so this must be re-run when switching TO 2D
   *  as well as on every real window resize, or the 2D canvas stays stuck
   *  at the 0x0 buffer size it captured while hidden (confirmed live: 2D
   *  view was solid-blank after toggling away from the 3D default). */
  function resizeMapCanvas() {
    const canvas = $("map-canvas");
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width);
    canvas.height = Math.floor(rect.height);
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
    const TILE_SIZE = window.UI.render.TILE_SIZE;
    // Find the human civ's starting settler, or fall back to map center
    let focusX = gameState.map.width / 2;
    let focusY = gameState.map.height / 2;
    if (humanCivId) {
      const civ = gameState.civs[humanCivId];
      const unit = civ && civ.units[0];
      if (unit) { focusX = unit.x; focusY = unit.y; }
    }
    viewState.scrollX = Math.max(0, focusX * TILE_SIZE - canvas.width  / 2);
    viewState.scrollY = Math.max(0, focusY * TILE_SIZE - canvas.height / 2);
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
      { btn: $("menu-report-btn"), dropdown: $("menu-report-dropdown") },
      { btn: $("menu-speed-btn"), dropdown: $("menu-speed-dropdown") },
    ];
    function closeAll() {
      for (const m of menus) { m.dropdown.style.display = "none"; m.btn.classList.remove("active"); }
    }
    for (const m of menus) {
      m.btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = m.dropdown.style.display === "none";
        closeAll();
        if (willOpen) { m.dropdown.style.display = "flex"; m.btn.classList.add("active"); }
      });
    }
    // Dropdown contents (speed buttons, audio slider, etc.) are wired by their
    // own setup functions and don't stopPropagation on their own clicks -- without
    // this, every click inside an open dropdown bubbles to the document listener
    // below and closes the menu it was just clicked in.
    document.querySelector(".menu-bar").addEventListener("click", (e) => e.stopPropagation());
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
  function setupAudioControls() {
    const muteCheckbox = $("audio-mute-checkbox");
    muteCheckbox.checked = window.MusicSystem.isMuted();
    muteCheckbox.addEventListener("change", () => {
      window.MusicSystem.setMuted(muteCheckbox.checked);
    });

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
  }

  function handleSaveGame() {
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      humanCivId, spectatorMode, aiDifficulty,
      gameState,
    };
    const json = window.GameEngine.savegame.serialize(payload);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arcane-empires-turn${gameState.turnNumber}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoadGameFile(e) {
    const file = e.target.files[0];
    e.target.value = ""; // reset so re-selecting the same file still fires change
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = window.GameEngine.savegame.deserialize(reader.result);
        applyLoadedPayload(payload);
      } catch (err) {
        alert(`Failed to load save file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  }

  /**
   * Replaces the live session with a loaded save. gameState/viewState are
   * mutated IN PLACE (properties cleared then reassigned) rather than
   * pointed at new objects -- window.UI.input.attach (called once, back in
   * startGame) closed over the original gameState/viewState object
   * references, so swapping in fresh objects here would leave mouse input
   * silently operating on the discarded pre-load state.
   */
  function applyLoadedPayload(payload) {
    for (const k of Object.keys(gameState)) delete gameState[k];
    Object.assign(gameState, payload.gameState);

    humanCivId = payload.humanCivId;
    spectatorMode = payload.spectatorMode;
    aiDifficulty = payload.aiDifficulty;

    for (const k of Object.keys(viewState)) delete viewState[k];
    Object.assign(viewState, {
      scrollX: 0, scrollY: 0, zoomLevel: 1.0, showInfluence: false, showGrid: true,
      selectedUnit: null, selectedCity: null, selectedTile: null, humanCivId,
      // Tabbed tile inspector -- the selected* fields above are derived from
      // this now (see input.js's SELECTION MODEL).
      selection: null,
      fogMode: "off", fogCivIds: new Set(Object.keys(gameState.civs)),
      tileScoreCivId: null, dialog: null,
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
    if (spectatorMode) startAutoplay();
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

  function handleEndTurnClick() {
    if (spectatorMode) return; // spectator turns advance automatically
    // Turn-end guard (2026-08-01, user-directed): surface anything the player
    // probably didn't mean to skip. Deliberately a confirm, not a block --
    // deliberately holding units in reserve or coasting a turn without
    // research is a legitimate choice, it just shouldn't happen by accident.
    const unresolved = collectUnresolvedTurnWork();
    if (unresolved.length) {
      viewState.dialog = {
        kind: "confirmEndTurn", items: unresolved,
        onAnswer: (ok) => {
          viewState.dialog = null;
          if (ok) offerHumanSettling(() => advanceTurn());
          else redraw();
        },
      };
      redraw();
      return;
    }
    // Before ending, any human Settler standing on a valid founding tile
    // gets a chance to found -- in-game dialog (see js/ui/dialog.js), one
    // pioneer at a time since this is now asynchronous (waits on a modal
    // button click) rather than the old blocking confirm()/prompt() pair.
    offerHumanSettling(() => advanceTurn());
  }

  /** Things the player very likely still wants to do this turn. Empty means
   *  End Turn goes straight through with no confirm. */
  function collectUnresolvedTurnWork() {
    if (!humanCivId) return [];
    const civ = gameState.civs[humanCivId];
    if (!civ) return [];
    const items = [];

    const waiting = window.GameEngine.orders.unitsNeedingOrders(gameState, humanCivId);
    if (waiting.length) {
      items.push(`${waiting.length} unit${waiting.length === 1 ? "" : "s"} still able to move or act`);
    }
    if (!civ.currentResearch) items.push("No research selected");
    const idleCities = civ.cities.filter((c) => !c.buildQueue);
    if (idleCities.length) {
      items.push(`${idleCities.length} cit${idleCities.length === 1 ? "y is" : "ies are"} not building anything`);
    }
    return items;
  }

  function offerHumanSettling(onDone) {
    if (!humanCivId) { onDone(); return; }
    const civ = gameState.civs[humanCivId];
    const eligible = civ.units.filter((u) => u.typeId === "pioneer"
      && window.GameEngine.cities.canFoundCityAt(gameState.map, gameState.civs, u.x, u.y, civ.raceId).ok);
    offerNextSettler(civ, eligible, 0, onDone);
  }

  /** Walks `eligible` one pioneer at a time, showing a found-city dialog for
   *  each and only calling onDone() once every offer's been answered
   *  (accepted or skipped) -- see offerHumanSettling. */
  function offerNextSettler(civ, eligible, idx, onDone) {
    if (idx >= eligible.length) { onDone(); return; }
    const unit = eligible[idx];
    // Re-check validity: founding an earlier pioneer in this same batch may
    // have changed what's valid nearby (city-spacing rules).
    const check = window.GameEngine.cities.canFoundCityAt(gameState.map, gameState.civs, unit.x, unit.y, civ.raceId);
    if (!check.ok) { offerNextSettler(civ, eligible, idx + 1, onDone); return; }

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
        }
        offerNextSettler(civ, eligible, idx + 1, onDone);
      },
    };
    redraw();
  }

  // Captured once at the start of each round (when turnStepIndex is 0) so the
  // "did the human's army just take losses" combat-music check can compare
  // across the WHOLE round, not just whichever single civ-step just ran.
  let pendingPreUnitCounts = null;

  function finishRoundBookkeeping(victoryResult) {
    if (humanCivId) {
      const civ = gameState.civs[humanCivId];
      if (civ.lastCompletedTech) {
        window.MusicSystem.notifySituation("discovery", true);
        civ.lastCompletedTech = null;
        setTimeout(() => window.MusicSystem.notifyDiscoveryTrackEndedNaturally(), 8000);
      }
      const before = pendingPreUnitCounts ? pendingPreUnitCounts[civ.id] : civ.units.length;
      const dropped = civ.units.length < before;
      window.MusicSystem.notifySituation("combat", dropped);
      if (dropped) setTimeout(() => window.MusicSystem.notifySituation("combat", false), 4000);
    }

    if (victoryResult) {
      clearInterval(autoplayTimer);
      const text = victoryResult.type === "elimination"
        ? `${victoryResult.winner} has conquered all rivals!`
        : `${victoryResult.winner} has achieved territorial dominance! (${(victoryResult.share * 100).toFixed(0)}% of the map)`;
      viewState.dialog = { kind: "message", title: "Victory!", text };
      // Switches music to the winning race's victory theme (2026-07-22,
      // user-directed) -- <race>_victory_#.mp3, falls back to that race's
      // normal theme if it doesn't have one yet (see music.js's resolveCurrent).
      window.MusicSystem.notifyVictory(gameState.civs[victoryResult.winner].raceId);
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
  function advanceTurn() {
    let stepResult;
    do {
      stepResult = advanceOneStep();
    } while (!stepResult.roundComplete);
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
    // Rebuild the selected tile's tab list from live state BEFORE anything
    // draws. The tabs hold direct references to units/cities/structures, any
    // of which can die, move, or be captured between redraws (autoplay does
    // this constantly), and the map renderers read the legacy
    // viewState.selected* fields this derives -- so it has to run ahead of
    // both of them, not just ahead of the sidebar. See input.js's
    // SELECTION MODEL comment.
    window.UI.input.resolveSelection(gameState, viewState);
    if (viewState.is3D) {
      window.UI.render3d.render($("map-canvas-3d"), gameState, viewState);
    } else {
      window.UI.render.render($("map-canvas"), gameState, viewState);
    }
    window.UI.sidebar.render($("sidebar"), gameState, viewState);
    const zoomLabel = $("zoom-level-label");
    if (zoomLabel) zoomLabel.textContent = `${Math.round((viewState.zoomLevel || 1) * 100)}%`;
    const endTurnBtn = $("end-turn-btn");
    if (endTurnBtn) endTurnBtn.onclick = handleEndTurnClick;
    const roadBtn = $("build-road-btn");
    if (roadBtn) roadBtn.onclick = handleBuildRoad;
    const disbandBtn = $("disband-unit-btn");
    if (disbandBtn) disbandBtn.onclick = handleDisbandUnit;
    const restBtn = $("rest-unit-btn");
    if (restBtn) restBtn.onclick = handleRestUnit;
    const defendBtn = $("defend-unit-btn");
    if (defendBtn) defendBtn.onclick = handleDefendUnit;
    const startProspectingBtn = $("start-prospecting-btn");
    if (startProspectingBtn) startProspectingBtn.onclick = () => handleStartChannel("prospecting");
    const startDelvingBtn = $("start-delving-btn");
    if (startDelvingBtn) startDelvingBtn.onclick = () => handleStartChannel("delving");
    const startFishingBtn = $("start-fishing-btn");
    if (startFishingBtn) startFishingBtn.onclick = () => handleStartChannel("fishing");
    const cancelChannelBtn = $("cancel-channel-btn");
    if (cancelChannelBtn) cancelChannelBtn.onclick = handleCancelChannel;
    const nextUnitBtn = $("next-unit-btn");
    if (nextUnitBtn) nextUnitBtn.onclick = handleNextUnit;

    // City production picker
    const openPickerBtn = $("open-build-picker-btn");
    if (openPickerBtn) openPickerBtn.onclick = () => {
      viewState.buildPickerCityId = openPickerBtn.dataset.cityKey;
      redraw();
    };
    const closePickerBtn = $("close-build-picker-btn");
    if (closePickerBtn) closePickerBtn.onclick = () => {
      viewState.buildPickerCityId = null;
      redraw();
    };
    const cancelBuildBtn = $("cancel-build-btn");
    if (cancelBuildBtn) cancelBuildBtn.onclick = () => {
      const city = viewState.selectedCity;
      if (city) window.GameEngine.orders.cancelBuild(city);
      redraw();
    };
    for (const btn of document.querySelectorAll(".build-option")) {
      btn.onclick = () => handleChooseBuild(Number(btn.dataset.buildIndex));
    }

    // Tile-inspector tabs, plus the in-panel shortcuts that jump to one (the
    // city panel's garrison list and the terrain panel's contents list) --
    // both carry the same data-tab-index, so one handler covers them.
    for (const btn of document.querySelectorAll(".tile-tab, .tile-tab-link")) {
      btn.onclick = () => {
        window.UI.input.setActiveTab(gameState, viewState, Number(btn.dataset.tabIndex));
        redraw();
      };
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
      const key = `${viewState.techTreeCivId}:${gameState.turnNumber}:${civ.currentResearch || ""}`;
      if (key !== lastRenderedTechTreeKey) {
        $("techtree-content").innerHTML = window.UI.techtree.render(civ, isPlayerCiv);
        lastRenderedTechTreeKey = key;
      }
      $("techtree-close-btn").onclick = () => { viewState.techTreeCivId = null; redraw(); };
      // Research selection (player's own tree only -- renderNode only emits
      // these buttons when isPlayerCiv).
      for (const node of document.querySelectorAll(".techtree-node-selectable")) {
        node.onclick = () => {
          window.GameEngine.tech.chooseResearch(civ, node.dataset.techId);
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
      $("reports-close-btn").onclick = () => { viewState.reportView = null; redraw(); };
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
        lastRenderedDialog = viewState.dialog;
        wireDialogButtons(viewState.dialog);
      }
      dialogOverlay.style.display = "flex";
    } else {
      lastRenderedDialog = null;
      if (dialogOverlay) dialogOverlay.style.display = "none";
    }
  }

  /** Wires the buttons for whichever dialog kind was just rendered into
   *  #game-dialog-modal (see redraw()'s dialog block / js/ui/dialog.js).
   *  Each answer clears viewState.dialog before invoking its callback, so a
   *  callback that immediately opens the NEXT dialog (offerNextSettler's
   *  founding-one-pioneer-at-a-time chain) still gets its own fresh render. */
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
    } else if (dialog.kind === "message") {
      const okBtn = $("game-dialog-ok-btn");
      if (okBtn) okBtn.onclick = () => {
        viewState.dialog = null;
        lastRenderedDialog = null;
        if (dialog.onDismiss) dialog.onDismiss();
        redraw();
      };
    }
  }

  function handleRestUnit() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.usedThisTurn) return;
    unit.resting = true;
    unit.usedThisTurn = true;
    redraw();
  }

  // Defend (2026-07-20, user-directed): a universal normal action, any
  // race/unit -- doubles this unit's own defense (see combat.js's
  // effectiveDefense) until the start of its next turn, same expiresAtTurn
  // convention ai.js's performDefend uses for the AI side.
  function handleDefendUnit() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.usedThisTurn) return;
    window.GameEngine.combat.setCondition(unit, "defending", { expiresAtTurn: (gameState.turnNumber || 0) + 1 });
    unit.usedThisTurn = true;
    redraw();
  }

  // Channeled actions (2026-07-21, user-directed): Prospector's Claim,
  // Dungeon Delve, and Galley Fishing are all explicitly started/cancelled
  // now -- see sidebar.js's channelActions for the button gating (tech
  // unlocked, right unit/tile, not already channeling) and turns.js's
  // onAnchor gate for what unit.channeling actually does turn to turn.
  function handleStartChannel(kind) {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.usedThisTurn || unit.channeling) return;
    unit.channeling = kind;
    unit.resting = true;
    unit.usedThisTurn = true;
    redraw();
  }

  function handleCancelChannel() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (!unit.channeling) return;
    unit.channeling = null;
    redraw();
  }

  /**
   * Queues the picked build. Units start immediately; buildings first drop
   * into placement mode -- the player clicks one of the highlighted legal
   * slots on the map and the build is queued bound to that tile
   * (2026-08-01, user-directed: placement is chosen at queue time, not on
   * completion, so walls can be planned deliberately).
   */
  function handleChooseBuild(index) {
    const city = viewState.selectedCity;
    if (!city || !humanCivId) return;
    const civ = gameState.civs[humanCivId];
    const options = window.GameEngine.ai.availableBuilds(civ, city, gameState);
    const option = options[index];
    if (!option) return;

    if (option.kind !== "building") {
      window.GameEngine.orders.queueBuild(city, civ, gameState, option, null);
      viewState.buildPickerCityId = null;
      redraw();
      return;
    }

    viewState.placement = {
      slots: option.slots,
      label: option.label,
      onPick: (slot) => {
        // A click outside the highlighted slots cancels rather than queuing
        // the building somewhere arbitrary.
        if (slot) {
          window.GameEngine.orders.queueBuild(city, civ, gameState, option, slot);
          viewState.buildPickerCityId = null;
        }
        viewState.placement = null;
        redraw();
      },
    };
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
    redraw();
  }

  /** Scrolls the 2D map so tile (x,y) sits in the middle of the viewport. */
  function centerViewOn(x, y) {
    const canvas = $("map-canvas");
    const ts = window.UI.render.TILE_SIZE * (viewState.zoomLevel || 1);
    viewState.scrollX = (x + 0.5) * ts - canvas.width / 2;
    viewState.scrollY = (y + 0.5) * ts - canvas.height / 2;
  }

  function handleBuildRoad() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.typeId !== "pioneer" || unit.usedThisTurn) return;
    const tile = gameState.map.tiles[unit.y * gameState.map.width + unit.x];
    if (!tile.hasRoad) {
      tile.hasRoad = true;
      unit.usedThisTurn = true;
    }
    redraw();
  }

  function handleDisbandUnit() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const humanCiv = gameState.civs[humanCivId];
    const unit = viewState.selectedUnit;
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
    newGame(raceIds, seed) {
      gameState = createNewGame(raceIds, seed);
      window.GameEngine.turns.refreshVisibility(gameState);
      return gameState;
    },
    getState: () => gameState,
    runTurn: (opts) => window.GameEngine.turns.runTurn(gameState, opts),
  };

  // Continuous animation loop — re-renders the map canvas every frame so
  // animated tile sprites play independently of turn progression or input.
  // The sidebar is not re-rendered here (data doesn't change between turns).
  let animFrameId = null;
  function startAnimationLoop() {
    if (animFrameId !== null) return; // already running
    function frame() {
      if (gameState && viewState) {
        if (viewState.is3D) {
          window.UI.render3d.render($("map-canvas-3d"), gameState, viewState);
        } else {
          window.UI.render.render($("map-canvas"), gameState, viewState);
        }
      }
      animFrameId = requestAnimationFrame(frame);
    }
    animFrameId = requestAnimationFrame(frame);
  }

  document.addEventListener("DOMContentLoaded", showSetupScreen);
})();
