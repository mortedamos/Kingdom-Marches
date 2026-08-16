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
  // viewState (or gameState) exists. "units" | "conditions" | "stats" | null;
  // knowledgeSelectedUnitId/knowledgeSelectedConditionKey/knowledgeSelectedStatKey
  // each only matter for their own page. See setupKnowledgeBase/renderKnowledgeOverlay.
  let knowledgeView = null;
  let knowledgeSelectedUnitId = null;
  let knowledgeSelectedConditionKey = null;
  let knowledgeSelectedStatKey = null;
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
  // The start screen has no control for AI difficulty (game-speed-slider
  // replaced it), so this just stays at its default. Left in place since
  // it's still a real, working lever (ai.js's applyDifficultyNoise), just
  // not currently reachable from the UI.
  let aiDifficulty = "normal";
  let loadingStatusTimer = null; // see showLoadingScreen/hideLoadingScreen

  // Game Speed slider controls how many turns units/buildings/research take
  // (GameConfig.pacing.slowness) -- see config.js's own doc comment for the
  // pace-factor system this scales uniformly. 100% reproduces the default
  // pace exactly; higher = faster (fewer turns), lower = slower, an inverse
  // relationship. BASE_PACING_SLOWNESS is captured ONCE here, before
  // applyGameSpeed ever runs, so every later call recomputes from this fixed
  // baseline rather than the live (possibly already-adjusted) config value --
  // otherwise repeated speed changes would compound/drift.
  const BASE_PACING_SLOWNESS = window.GameConfig.pacing.slowness;
  let gameSpeedPercent = 100;
  function applyGameSpeed(percent) {
    gameSpeedPercent = percent;
    window.GameConfig.pacing.slowness = BASE_PACING_SLOWNESS * (100 / percent);
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

  // See setupGlobalShortcuts. shiftHeld drives both the ring menu's "Next 3
  // turns: " label prefix and whether a shortcut/pill click schedules an
  // auto-repeat (see maybeScheduleAutoRepeat); panKeys is which of WASD are
  // currently held, read every animation-loop frame for continuous panning.
  let shiftHeld = false;
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
      // Drop the element so the next click builds a FRESH one (with the
      // cache-buster above) rather than retrying a permanently-errored one.
      titleAudio = null;
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
        // (typically NotSupportedError, which follows a failed load) means
        // the error listener above has already logged the true cause and put
        // the button into its retry state -- resetting to "idle" here would
        // clobber that and wrongly blame autoplay for a missing file.
        if (err.name === "NotAllowedError") {
          console.warn("[title music] autoplay blocked; click the button to start");
          setMusicBtnState("idle");
        }
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
      btn.textContent = "♪ Stop Title Music";
      btn.disabled    = false;
    } else if (state === "idle") {
      btn.textContent = "♪ Play Title Music";
      btn.disabled    = false;
    } else if (state === "error") {
      // Stays CLICKABLE -- clicking rebuilds the element with a cache-buster
      // (see initTitleAudio). The console line names the real cause.
      btn.textContent = "♪ Music failed — click to retry";
      btn.disabled    = false;
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
          <span>Game Speed</span>
          <span class="launch-row-slider">
            <input type="range" id="game-speed-slider" min="50" max="150" step="5" value="100">
            <span id="game-speed-pct">100%</span>
          </span>
        </label>
        <p class="launch-hint">How many turns units, buildings, and research take to complete -- lower is slower, higher is faster. 100% (the middle) is the default pace.</p>
        <label class="launch-row">
          <span>Max Monsters</span>
          <span class="launch-row-slider">
            <input type="range" id="monster-cap-slider" min="0" max="3" step="1" value="2">
            <span id="monster-cap-label">2 per kingdom</span>
          </span>
        </label>
        <p class="launch-hint">Caps how many Wandering Monsters can exist at once, scaled by the number of kingdoms in play. 0 turns them off entirely.</p>
        <label class="launch-row">
          <span>Map Seed</span>
          <input type="text" id="seed-input" placeholder="random">
        </label>
        <p class="launch-hint">Leave the seed blank for a random map, or reuse one to replay the same world.</p>
      </div>

      <div class="launch-section">
        <div class="launch-section-label">Audio</div>
        <button id="title-music-btn" class="launch-music-btn">♪ Play Title Music</button>
        <p class="launch-hint">In-game music and sound effect volumes are under the Audio menu once a game starts.</p>
      </div>

      <div class="launch-actions">
        <button id="start-game-btn" class="launch-start-btn">Start Game</button>
        <button id="view-credits-btn" class="launch-credits-btn">View Credits</button>
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

  function showSetupScreen() {
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

    // Game Speed slider: the percentage label moves live as the slider is
    // dragged -- actually applying the speed (mutating GameConfig.pacing.
    // slowness) waits for Start Game itself (see startGame's applyGameSpeed
    // call), same as every other launch option here.
    $("game-speed-slider").addEventListener("input", (e) => {
      $("game-speed-pct").textContent = `${e.target.value}%`;
    });

    // Max Monsters slider: same "label moves live, value only actually
    // applies at Start Game" pattern as Game Speed just above -- see
    // startGame's monsterCapPerKingdom read.
    $("monster-cap-slider").addEventListener("input", (e) => {
      const n = parseInt(e.target.value, 10);
      $("monster-cap-label").textContent = n === 0 ? "Off" : `${n} per kingdom`;
    });

    $("start-game-btn").addEventListener("click", startGame);

    $("title-music-btn").addEventListener("click", () => {
      console.log("[title music] button clicked");
      toggleTitleMusic();
    });

    setupLaunchOptionsOverlay();
    setupCreditsOverlay();
    setupContextMenuDismissal();
    setupButtonClickSfx();
    setupGlobalShortcuts();
    setupKeyboardShortcutsOverlay();
    setupKnowledgeBase();
    setupTitleMenuBar();
    setupTitleAudioControls();
    setupTitleLoadGameControl();
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
      reader.onload = () => {
        try {
          const payload = window.GameEngine.savegame.deserialize(reader.result);
          startGameFromSave(payload);
        } catch (err) {
          alert(`Failed to load save file: ${err.message}`);
        }
      };
      reader.readAsText(file);
    });
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
    const titleCheckbox = $("title-menu-audio-mute-checkbox");
    if (titleCheckbox) titleCheckbox.checked = muted;
    const gameCheckbox = $("audio-mute-checkbox");
    if (gameCheckbox) gameCheckbox.checked = muted;
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

  /** Title menu bar's Audio dropdown -- same Mute/Music/SFX controls as the
   *  in-game Audio menu (setupAudioControls), just without "Now Playing" or
   *  "Track" (nothing is playing/selectable until a race is actually in a
   *  running game), wired here so it works before "Begin" is ever clicked.
   *  Mute specifically routes through
   *  setGlobalMuted/syncAllMuteControls above so it never disagrees with the
   *  standalone "Mute Sound" button. */
  function setupTitleAudioControls() {
    const checkbox = $("title-menu-audio-mute-checkbox");
    if (!checkbox) return;
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
    menus[0].btn.closest(".menu-bar").addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", closeAll);
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
      // requirement the same way a direct button press would; playTitleMusic
      // (not toggleTitleMusic) since re-opening this modal on a later click
      // should never STOP music that's already playing -- play() on an
      // already-playing element is already a harmless no-op.
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

  /** Open/close wiring for the Keyboard Shortcuts window (2026-08-07,
   *  user-directed) -- same button/backdrop/Escape convention as
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
    if (knowledgeView === "conditions" || knowledgeView === "stats") {
      // "Units" is the only page a cross-link can currently arrive from,
      // so the back label is hardcoded here rather than threaded through
      // knowledgeBackTarget -- see jumpToCondition/jumpToStat/goBackToUnits.
      const backLabel = knowledgeBackTarget ? "Units" : null;
      if (knowledgeView === "conditions") {
        content.innerHTML = window.UI.knowledgebase.renderConditions(knowledgeSelectedConditionKey, backLabel);
        for (const btn of content.querySelectorAll(".kb-list-btn[data-condition-id]")) {
          btn.onclick = () => {
            knowledgeSelectedConditionKey = btn.dataset.conditionId;
            renderKnowledgeOverlay();
          };
        }
      } else {
        content.innerHTML = window.UI.knowledgebase.renderStats(knowledgeSelectedStatKey, backLabel);
        window.UI.knowledgebase.wireCombatSimulator(content);
        for (const btn of content.querySelectorAll(".kb-list-btn[data-stat-id]")) {
          btn.onclick = () => {
            knowledgeSelectedStatKey = btn.dataset.statId;
            renderKnowledgeOverlay();
          };
        }
      }
      const backBtn = $("kb-back-btn");
      if (backBtn) backBtn.onclick = goBackToUnits;
    } else {
      content.innerHTML = window.UI.knowledgebase.renderUnits(knowledgeSelectedUnitId);
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
    }
    const newListPane = content.querySelector(".kb-list-pane");
    if (newListPane) newListPane.scrollTop = prevListScrollTop;
    overlay.style.display = "flex";
  }

  function openKnowledge(view) {
    knowledgeView = view;
    knowledgeSelectedUnitId = null;
    knowledgeSelectedConditionKey = null;
    knowledgeSelectedStatKey = null;
    knowledgeBackTarget = null;
    renderKnowledgeOverlay();
  }
  function closeKnowledge() {
    knowledgeView = null;
    knowledgeBackTarget = null;
    renderKnowledgeOverlay();
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
  function goBackToUnits() {
    if (!knowledgeBackTarget) return;
    knowledgeView = "units";
    knowledgeSelectedUnitId = knowledgeBackTarget.unitId;
    knowledgeBackTarget = null;
    renderKnowledgeOverlay();
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
    const conditionsBtn = $("kb-conditions-btn");
    if (conditionsBtn) conditionsBtn.addEventListener("click", () => openKnowledge("conditions"));
    const statsBtn = $("kb-stats-btn");
    if (statsBtn) statsBtn.addEventListener("click", () => openKnowledge("stats"));
    const titleUnitsBtn = $("title-kb-units-btn");
    if (titleUnitsBtn) titleUnitsBtn.addEventListener("click", () => openKnowledge("units"));
    const titleConditionsBtn = $("title-kb-conditions-btn");
    if (titleConditionsBtn) titleConditionsBtn.addEventListener("click", () => openKnowledge("conditions"));
    const titleStatsBtn = $("title-kb-stats-btn");
    if (titleStatsBtn) titleStatsBtn.addEventListener("click", () => openKnowledge("stats"));
    $("knowledge-close-btn").addEventListener("click", closeKnowledge);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) closeKnowledge(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && knowledgeView) closeKnowledge();
    });
  }

  // Continuously re-scheduled while the credits overlay is open (2026-08-07,
  // user-directed) -- see startCreditsCrawl/closeCredits.
  let creditsAnimId = null;

  /** "View Credits" in the Game Options modal: closes that modal (per the
   *  user's own framing of the request) and fetches/parses credits.txt
   *  (root folder) fresh every time it's opened, so editing the file needs
   *  no rebuild -- see js/ui/credits.js for the tiny format it understands. */
  function openCredits() {
    $("launch-options-overlay").style.display = "none";
    fetch("credits.txt")
      .then((r) => r.text())
      .then((text) => {
        $("credits-content").innerHTML = window.UI.credits.render(text);
        $("credits-overlay").style.display = "flex";
        startCreditsCrawl();
      });
  }

  function closeCredits() {
    $("credits-overlay").style.display = "none";
    if (creditsAnimId != null) { cancelAnimationFrame(creditsAnimId); creditsAnimId = null; }
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
    $("view-credits-btn").addEventListener("click", openCredits);
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
    document.addEventListener("mousedown", (e) => {
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
    applyGameSpeed(parseInt($("game-speed-slider").value, 10));
    const monsterCapPerKingdom = parseInt($("monster-cap-slider").value, 10);
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

    gameState = createNewGame(racesInPlay, seed, monsterCapPerKingdom);
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
      is3D: false, // 2D-only for now -- see render3d.js; the Interface menu's "Toggle 3D View" button was removed
      fogMode: "off", fogCivIds: new Set(Object.keys(gameState.civs)), // spectator-only; see setupFogControls
      tileScoreCivId: null, // Interface menu's Tile City Score overlay -- available in both spectator and human modes
      dialog: null, // in-game confirm/prompt/alert replacement -- see js/ui/dialog.js
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
    aiDifficulty = payload.aiDifficulty;
    applyGameSpeed(payload.gameSpeedPercent || 100);
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
      is3D: false,
      fogMode: "off", fogCivIds: new Set(Object.keys(gameState.civs)),
      tileScoreCivId: null,
      dialog: null, turnBanner: null, ringMenu: null,
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

  function createNewGame(raceIds, seed, monsterCapPerKingdom) {
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
      // Game Options "Max Monsters" slider (2026-08-16, user-directed):
      // per-game override of config.js's worldEncounters.monsters.
      // perKingdomCap -- see ai.js's maybeSpawnMonster/seedInitialMonsters,
      // which both read this instead of the config default. Falls back to
      // the config default (via ?? at each read site) if omitted, so a
      // headless __sim.newGame call with no third argument still works.
      monsterCapPerKingdom: monsterCapPerKingdom ?? window.GameConfig.worldEncounters.monsters.perKingdomCap,
    };
    // World-gen-time Wandering Monster seeding (2026-08-16, user-directed:
    // "some monsters should exist at game start") -- see ai.js's
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
    // Cloud overlay (2026-08-06, user-directed) is layered pixel-for-pixel
    // over the map canvas, so it has to track the exact same size -- same
    // CSS-pixel convention (no devicePixelRatio scaling) as above, or the
    // cursor hole would land offset from the actual cursor.
    const cloudCanvas = $("map-clouds");
    if (cloudCanvas) {
      cloudCanvas.width = canvas.width;
      cloudCanvas.height = canvas.height;
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
    viewState.scrollX = Math.max(0, (focusX + 0.5) * ts - canvas.width  / 2);
    viewState.scrollY = Math.max(0, (focusY + 0.5) * ts - canvas.height / 2);
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
    // Scoped via .closest() rather than document.querySelector(".menu-bar")
    // (2026-08-12) -- the title screen now has its own separate .menu-bar
    // (see setupTitleMenuBar), and querySelector would only ever find
    // whichever one comes first in the DOM, silently breaking this one's
    // click-outside handling once the title screen's markup preceded it.
    menus[0].btn.closest(".menu-bar").addEventListener("click", (e) => e.stopPropagation());
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
   *  spectator-only (2026-08-06, user-directed): both reports expose an
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
    // the Keyboard Shortcuts window (2026-08-07, user-directed), not the
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
  }

  function handleSaveGame() {
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      humanCivId, spectatorMode, aiDifficulty, gameSpeedPercent,
      gameState,
    };
    const json = window.GameEngine.savegame.serialize(payload);
    // .kmsg extension, not .json (2026-08-07, user-directed; renamed
    // .kms->.kmsg 2026-08-10) -- the payload itself is still plain JSON text
    // (savegame.js's serialize/deserialize are untouched), this only changes
    // what the downloaded file is named.
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    // Filename includes the kingdom's race and a save timestamp (2026-08-10,
    // user-directed) so multiple saves/games don't collide or read as
    // interchangeable in a downloads folder.
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
   * Replaces the live session with a loaded save -- but first makes sure
   * every race the save actually needs has its art loaded (2026-08-10,
   * user-directed: "when loading a save game, we should make sure all
   * relevant graphics are loaded as well"). startGame's own
   * preloadAll(racesInPlay) call only ever fetched art for the CURRENT
   * session's own races -- e.g. a Human-vs-Dwarf game never touched Orc or
   * Undead art at all -- so loading an old save with a different race mix
   * would otherwise leave those civs rendering as bare color/symbol
   * placeholders (sprites.js's pick() silently falls back when nothing's
   * in its registry) until something else happened to trigger a fetch.
   * window.UI.sprites.preloadAll is idempotent per race (loadVariants' own
   * `if (registry[key]) return` guard skips anything already cached this
   * session), so re-calling it here with the SAVE's actual races is cheap
   * when they overlap the current session and correctly fills the gap when
   * they don't. Reuses the same loading screen startGame shows; the actual
   * state swap (finishApplyLoadedPayload) only happens once loading
   * settles, so the player is never looking at placeholder art for a race
   * that should have real art. Music/sfx are deliberately left alone here
   * -- out of scope for this fix, and forcing their progress rows to
   * a fake 100% just keeps the shared loading-screen markup honest about
   * what this specific reload actually touches. */
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
    aiDifficulty = payload.aiDifficulty;
    // Falls back to 100% (the default pace) for a save made before the Game
    // Speed slider existed, same "predates this field" convention as
    // civ.isHuman's own recompute just below.
    applyGameSpeed(payload.gameSpeedPercent || 100);
    // Recomputed rather than trusted from the save file itself (2026-08-04):
    // civ.isHuman didn't exist before this fix, so a save made prior to it
    // would otherwise load with the flag missing on every civ, silently
    // breaking the level-up picker below. Cheap to just derive it fresh from
    // humanCivId every load instead of treating it as save-worthy state.
    for (const civ of Object.values(gameState.civs)) civ.isHuman = civ.id === humanCivId;

    for (const k of Object.keys(viewState)) delete viewState[k];
    Object.assign(viewState, {
      scrollX: 0, scrollY: 0, zoomLevel: 1.0, showInfluence: true, showGrid: true,
      // Interface menu's "End Turn Reminders" checkbox (2026-08-12,
      // user-directed) -- gates handleEndTurnClick's confirmEndTurn dialog
      // entirely when off, same non-persisted per-session convention as
      // showGrid/showInfluence above (not part of the save file).
      endTurnRemindersEnabled: true,
      selectedUnit: null, selectedCity: null, selectedTile: null, humanCivId,
      // Tabbed tile inspector -- the selected* fields above are derived from
      // this now (see input.js's SELECTION MODEL).
      selection: null,
      fogMode: "off", fogCivIds: new Set(Object.keys(gameState.civs)),
      tileScoreCivId: null, dialog: null, turnBanner: null, ringMenu: null,
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

  function handleEndTurnClick() {
    if (spectatorMode) return; // spectator turns advance automatically
    // Turn-end guard (2026-08-01, user-directed): surface anything the player
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

  /** Things the player very likely still wants to do this turn. Empty means
   *  End Turn goes straight through with no confirm. Each item is
   *  { text, x, y, tabKind } (2026-08-04, user-directed: x/y/tabKind let
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
    // Affordability-gated (2026-08-05, user-directed): a civ that simply
    // can't afford ANY currently-available tech, or a city that can't
    // afford ANY currently-available build, has nothing it could actually
    // do about "no research selected"/"not building anything" right now --
    // nagging about it every turn would just be noise until income catches
    // up. window.GameEngine.ai.availableBuilds already tags every option
    // with `affordable` (see its own doc comment).
    if (!civ.currentResearch && window.GameEngine.tech.hasAffordableResearch(civ)) {
      // chooseResearch (2026-08-10, user-directed): renders a "Choose
      // Research" button instead of a tile "Go to" link -- see dialog.js's
      // confirmEndTurn branch and wireDialogButtons below.
      items.push({ text: "No research selected", chooseResearch: true });
    }
    for (const c of civ.cities) {
      // Shared with the sidebar's per-city idle tag and the map's idle
      // badge (2026-08-07, user-directed) -- see cities.js's isCityIdle for
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
   *  deliberately no automatic end-of-turn settler sweep anymore (2026-08-06,
   *  user-directed: never auto-prompt to found a city just because a
   *  pioneer happens to be standing on a valid tile; the player uses the
   *  button when they actually want to). `onDone` runs once the dialog is
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
          // Free first-city tech (2026-08-05, user-directed): mirrors
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

  /** Free first-city tech choice (2026-08-05, user-directed): opens right
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
  /** Manual order supersedes automation/pathing/garrison (2026-08-06, user-
   *  directed): any command the player issues to a unit ends whatever it
   *  was doing on its own -- an Automate Actions proposal/toggle, a multi-
   *  turn goto order, or a standing Garrison -- with no separate Stop
   *  Order/Stop Automating/Cancel Garrison click needed first. Idempotent
   *  (a plain unit with none of these set is untouched), so safe to call
   *  unconditionally at the top of every order-issuing handler below. Stop
   *  Order/Cancel Garrison themselves are deliberately NOT among those
   *  callers -- each stays scoped to undoing just its own thing, same as
   *  "Stop Automating" stays scoped to just automation. Only the "garrison"
   *  channel value is cleared here -- a resource channel (hunting,
   *  prospecting, ...) has its own forfeit-the-stash cancel path
   *  (handleCancelChannel) and isn't touched by this generic helper. */
  function endAutomationAndGoto(unit) {
    unit.automated = false;
    unit.pendingIntent = null;
    unit.gotoTarget = null;
    if (unit.channeling === "garrison") unit.channeling = null;
    // Sentry / Follow (2026-08-12, user-directed) -- same "any new order
    // supersedes a standing one" rule gotoTarget already gets here, so a
    // unit taken off Sentry/Follow by being given something else to do
    // doesn't keep re-triggering its old standing order next turn.
    unit.sentry = false;
    unit.followTarget = null;
  }

  /** Shift-held "repeat for the next 3 turns" (2026-08-07, user-directed):
   *  called by handleRestAndDefend/handleResourceProduction/
   *  handleCityResearch right after each has successfully applied its
   *  action once, normally. Holding Shift at the moment the action is
   *  chosen -- a ring click or the matching keyboard shortcut, both funnel
   *  through the same handler -- arms it to fire again automatically at the
   *  start of each of the next 3 turns; see turns.js's finishCivTurn, which
   *  reads and decrements this same field. A plain (non-Shift) invocation
   *  always clears any previous schedule, so re-choosing the action by hand
   *  is how the player turns auto-repeat back off. */
  function maybeScheduleAutoRepeat(entity, kind) {
    entity.autoRepeat = shiftHeld ? { kind, turnsLeft: 3 } : null;
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

  /** Global keyboard shortcuts (2026-08-07, user-directed). Registered ONCE
   *  at bootstrap, same "safe pre-game, guards internally" convention
   *  setupContextMenuDismissal uses -- every handler below re-checks
   *  gameState/viewState/humanCivId itself rather than assuming a game is
   *  running.
   *
   *  General: WASD and the arrow keys both pan the map, mapped onto the same
   *  panKeys entries (2026-08-12, user-directed -- arrows used to move the
   *  selected unit one tile; that's still reachable via a normal map click,
   *  just no longer a dedicated shortcut), continuous, applied every
   *  animation-loop frame while held -- see startAnimationLoop's panKeys
   *  read; Shift arms the "next 3 turns" auto-repeat on Rest and Defend/
   *  Gather More Resources/Research (see maybeScheduleAutoRepeat) and
   *  prefixes their ring-menu labels (see renderRingMenu); M toggles the
   *  same master mute both the title screen's and the in-game Audio menu's
   *  mute controls use. Unit context: Space = Rest and Defend (or End Turn
   *  when nothing is selected and there's nothing left to do this turn --
   *  see the Space handler's own comment). City context: Space = Gather
   *  More Resources. */
  function setupGlobalShortcuts() {
    function handleGlobalKeydown(e) {
      if (e.key === "Shift") {
        if (!shiftHeld) {
          shiftHeld = true;
          if (viewState && viewState.ringMenu) redraw();
        }
        return;
      }
      // Sync from the event's own modifier flag, not just the tracked
      // Shift keydown/keyup pair above -- a real held-Shift-then-press
      // always agrees with both, but this is the one source of truth that
      // can't drift (a keyup swallowed by another element, a synthetic/
      // chorded event that never sent its own separate "Shift" keydown).
      shiftHeld = e.shiftKey;
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

      // Enter = End Turn (2026-08-10, user-directed). Checked before the
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

      if (!gameState || !viewState || !humanCivId || anyOverlayOpen()) return;

      const key = e.key.toLowerCase();
      // Arrow keys pan the map exactly like WASD (2026-08-12, user-directed)
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
          // Nothing selected (2026-08-10, user-directed): jump to the next
          // idle city, or the next unit needing orders if there's no idle
          // city -- same priority goToNextIdleCityOrNextUnit already gives
          // the Next Idle City/Next Unit sidebar buttons. If THAT comes back
          // false (2026-08-12, user-directed: "if no cities are idle, and
          // all units have orders, then space should ... end turn") there is
          // nothing left to jump to this turn, so Space falls through to the
          // same End Turn path Enter already uses -- still routed through
          // handleEndTurnClick, so the confirmEndTurn reminder (when enabled)
          // still gets its say rather than skipping straight to advanceTurn.
          if (goToNextIdleCityOrNextUnit()) redraw();
          else handleEndTurnClick();
        }
        return;
      }

    }
    document.addEventListener("keydown", handleGlobalKeydown);

    document.addEventListener("keyup", (e) => {
      if (e.key === "Shift") {
        shiftHeld = false;
        if (viewState && viewState.ringMenu) redraw();
        return;
      }
      const key = e.key.toLowerCase();
      const ARROW_TO_PAN_KEY = { arrowup: "w", arrowdown: "s", arrowleft: "a", arrowright: "d" };
      const panKey = ARROW_TO_PAN_KEY[key] || (key === "w" || key === "a" || key === "s" || key === "d" ? key : null);
      if (panKey) panKeys.delete(panKey);
    });

    // Held keys must not survive a tab switch/alt-tab -- there's no keyup
    // event once focus leaves the page, so without this a key released
    // while the browser wasn't focused would pan forever.
    window.addEventListener("blur", () => { panKeys.clear(); shiftHeld = false; });
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

  /** "Found City Here" on a remote tile (2026-08-07, user-directed): if the
   *  site is already road-connected (or exempt -- see cities.js's
   *  canFoundCityAt), founds immediately; otherwise asks whether to build a
   *  road there first, since a new city must be road-connected to found. A
   *  "yes" answer starts the SAME buildRoad goto order Build Road to This
   *  Tile would, just tagged foundCity so advanceGotoOrder (orders.js) flags
   *  the unit on arrival instead of leaving it idle at the destination. */
  function handleFoundCityHere(x, y) {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    const civ = gameState.civs[humanCivId];
    if (!civ || unit.civId !== humanCivId) return;
    if (!window.GameData.getUnit(unit.typeId).canFoundCity) return;
    endAutomationAndGoto(unit);
    if (window.GameEngine.cities.canFoundCityAt(gameState.map, gameState.civs, x, y, civ.raceId).ok) {
      startFoundCityGoto(unit, x, y, false);
      return;
    }
    viewState.dialog = {
      kind: "confirm",
      title: "Road Needed",
      text: "New cities must be connected to other cities by a road. Would you like to build a road to this spot?",
      confirmLabel: "Yes",
      onAnswer: (ok) => {
        if (ok) startFoundCityGoto(unit, x, y, true);
      },
    };
    redraw();
  }

  function startFoundCityGoto(unit, x, y, buildRoad) {
    window.GameEngine.orders.startGotoOrder(unit, gameState, x, y, buildRoad, { foundCity: true });
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
    // Human defeat (2026-08-06, user-directed): two independent ways to
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
      if (finishedTechId) {
        window.MusicSystem.notifySituation("discovery", true);
        setTimeout(() => window.MusicSystem.notifyDiscoveryTrackEndedNaturally(), 8000);
      }
      const before = pendingPreUnitCounts ? pendingPreUnitCounts[civ.id] : civ.units.length;
      const dropped = civ.units.length < before;
      window.MusicSystem.notifySituation("combat", dropped);
      if (dropped) setTimeout(() => window.MusicSystem.notifySituation("combat", false), 4000);

      // Tech-researched / Unit-built announcements (2026-08-06, user-
      // directed): skipped once the game has actually ended THIS round
      // (below) -- nothing left to research or build toward, and the
      // Victory/Defeat dialog takes the one viewState.dialog slot instead.
      // Tech first, then the unit-built queue (if any) once THAT'S
      // dismissed, chained rather than raced, so neither silently drops
      // behind the other if both happen the same round (see
      // openTechResearchedDialog/offerNextUnitBuiltNotice).
      if (!victoryResult && !humanLost) {
        const afterUnitBuilt = () => offerNextTreasureNotice(civ, () => offerNextPendingIntent(civ, () => offerFoundCityIfPending(civ)));
        const afterTech = () => {
          if (finishedTechId) {
            openTechResearchedDialog(civ, finishedTechId, () => offerNextUnitBuiltNotice(civ, afterUnitBuilt));
          } else {
            offerNextUnitBuiltNotice(civ, afterUnitBuilt);
          }
        };
        // Starvation disband choice goes first (2026-08-10, user-directed) --
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
      openGameOverDialog(gameState.civs[humanCivId]);
    } else if (victoryResult) {
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

  /** Human defeat announcement (2026-08-06, user-directed) -- see
   *  finishRoundBookkeeping's humanLost check. Stats drawn from data
   *  already tracked civ-wide (no new tracking needed): cityEvents (see
   *  cities.js's foundCity/destroyCity) survives the civ's own elimination
   *  since it's an append-only log on the civ object, not derived from
   *  civ.cities itself (which is empty by the time this fires). */
  function openGameOverDialog(civ) {
    clearInterval(autoplayTimer);
    const events = civ.cityEvents || [];
    viewState.dialog = {
      kind: "gameOver",
      turnsSurvived: gameState.turnNumber || 0,
      citiesFounded: events.filter((e) => e.type === "founded").length,
      citiesLost: events.filter((e) => e.type === "razed").length,
      techsResearched: civ.completedTechs ? civ.completedTechs.size : 0,
      onReturnToTitle: handleReturnToTitle,
    };
    // Fixed game_over.mp3, overriding any situational/victory theme (see
    // music.js's resolveCurrent priority order).
    window.MusicSystem.notifyGameOver();
  }

  /** "Return to Title Screen" (2026-08-06, user-directed) -- a full reload
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

  /** Tech-researched announcement (2026-08-06, user-directed): opens the
   *  instant a tech finishes (see finishRoundBookkeeping). Lists every
   *  OTHER tech in this civ's race tree that named `techId` as a
   *  prerequisite -- "here's what just opened up" -- plus a shortcut
   *  straight into the tech tree. `onDone` runs once the dialog is
   *  answered either way (same chaining convention offerNextUnitBuiltNotice
   *  uses), so finishRoundBookkeeping can queue the
   *  unit-built notices right behind it. */
  /** Starvation unit-loss choice (2026-08-10, user-directed): drains
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

  /** Orc "Bog Spirit" Wisp cap choice (2026-08-10, user-directed): drains
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
      // Already-researching gate (2026-08-12, user-directed): a city's
      // "Research" boost action can finish `techId` early, mid-turn, ahead
      // of this notice actually showing (queued for round-end -- see
      // finishRoundBookkeeping). If the player had ALREADY picked a next
      // tech by then (civ.currentResearch is set again), offering "Choose
      // Next Research" here would re-prompt for a decision that's already
      // made -- dialog.js hides that button whenever this is true.
      alreadyResearching: !!civ.currentResearch,
      onChooseResearch: () => {
        // Defer onDone until the tech tree is actually CLOSED (2026-08-07,
        // user-directed bug fix), rather than firing it the instant the
        // player clicks through to the tech tree -- onDone is the head of
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
      // "View" link next to each unlocked tech (2026-08-10, user-directed):
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

  /** Unit-built announcements (2026-08-06, user-directed): drains
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

  /** Treasure find flavor text (2026-08-17, user-directed): names the
   *  object found, then its effect -- shared by the immediate "openChest"
   *  ring action below and offerNextTreasureNotice's deferred Ruin Delve
   *  notices, so both read identically. Trap results aren't routed through
   *  here -- nothing was "found," so they keep their own dedicated text. */
  function describeTreasureFind(unitLabel, result) {
    if (result.rewardType === "mapFragment") {
      return {
        title: "Map Fragment!",
        text: `${unitLabel} finds a map fragment -- unrolling it reveals a swath of unexplored land around (${result.revealed.x},${result.revealed.y}) for the rest of this turn.`,
      };
    }
    if (result.rewardType === "xp") {
      return {
        title: "Treasure Found!",
        text: `${unitLabel} finds an experience crystal -- absorbing it grants +${result.amount} XP.`,
      };
    }
    if (result.rewardType === "lore") {
      return {
        title: "Treasure Found!",
        text: `${unitLabel} finds an ancient tome -- its knowledge is worth +${result.amount} lore.`,
      };
    }
    return {
      title: "Treasure Found!",
      text: `${unitLabel} finds a pile of gold coins -- worth +${result.amount} coin.`,
    };
  }

  /** Ruin Delve treasure-find announcements (2026-08-17, user-directed):
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

  /** Automate Actions confirmation queue (2026-08-06, user-directed): drains
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
        }
        finish();
      },
      onDecline: () => finish(),
    };
    redraw();
  }

  /**
   * Off-screen attack notice (2026-08-06, user-directed): a snapshot/diff
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
   *  (processBatch, 2026-08-07, user-directed -- see the comment there) by
   *  the time this dialog appears, so its effects are still animating in
   *  view behind it. "Go to" (via goToTile) mainly selects the attacked
   *  unit/city's own sidebar tab now rather than moving the camera (already
   *  there); "Skip" just dismisses without that tab switch. Either way,
   *  `onDone` is what actually continues processing the rest of the turn
   *  (advanceTurn's processBatch). */
  // Orientation pause (2026-08-12, user-directed): after "Go to Attack" on
  // the PRE-attack notice specifically (see its offerAttackNotice call
  // below), the player has just been dropped onto the scene but the fight
  // hasn't happened yet -- give them a beat to actually look at it before
  // resolvePendingAIAttack fires. Not applied to "Skip" (they explicitly
  // didn't ask to look) or to the post-hoc notice (that attack already
  // happened -- see its own offerAttackNotice call, which passes no delay).
  const ATTACK_NOTICE_GO_TO_DELAY_MS = 1000;

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
   *  immediately (2026-08-10, user-directed pre-attack notice -- see
   *  processBatch's pendingAttack check and ai.js's considerAttackOrGarrison
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
  /** Turn-progress banner (2026-08-04, user-directed): End Turn used to
   *  resolve every other civ's whole turn synchronously in one blocking
   *  pass -- nothing painted until it was over, however long that took, so
   *  the player just sat looking at their last move with no feedback that
   *  anything was happening. Still resolves each CIV's own units in one
   *  tight synchronous batch (unchanged -- no per-unit pause, that would
   *  make a big army's turn crawl), but now yields via setTimeout at each
   *  civ BOUNDARY specifically so the "<Race> Kingdom Taking Its Turn..."
   *  banner set just before the yield actually gets a chance to paint.
   *  Skips announcing the human civ's own (already-acted) segment. */
  /** Idle-city default (2026-08-12, user-directed): a city the player never
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
        // Off-screen attack notice (2026-08-06, user-directed): checked
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

        // Pre-attack notice (2026-08-10, user-directed): a true BEFORE-the-
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
          if (!window.UI.render.isTileOnScreen(targetUnit.x, targetUnit.y, $("map-canvas"), gameState, viewState)) {
            centerViewOn(targetUnit.x, targetUnit.y);
          }
          redraw();
          const attackerBaseUnit = window.GameData.getUnit(steppedUnit.typeId);
          offerAttackNotice(
            { x: targetUnit.x, y: targetUnit.y, label: steppedUnit.name || attackerBaseUnit.label },
            () => { resolvePendingAIAttack(gameState.civs[steppedUnit.civId], steppedUnit); processBatch(); },
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
          // pause on. Arrive at the site immediately (2026-08-07,
          // user-directed), not only once the player manually clicks "Go to"
          // on the dialog below -- see offerAttackNotice for the dialog itself.
          centerViewOn(notice.x, notice.y);
          redraw();
          offerAttackNotice(notice, processBatch);
          return;
        }
      } while (!stepResult.steppedCivId || stepResult.steppedCivId === announcedCivId || stepResult.steppedCivId === humanCivId);
      announcedCivId = stepResult.steppedCivId;
      const civ = gameState.civs[announcedCivId];
      const race = window.GameData.getRace(civ.raceId);
      viewState.turnBanner = `${race.label} Kingdom Taking Its Turn...`;
      redraw();
      setTimeout(processBatch, 260);
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
    // The sidebar's own controls -- all that's left of them (2026-08-06,
    // user-directed). Every unit verb and the whole city production picker
    // moved to the radial map menu, so their wiring moved with them into
    // renderRingMenu below; what remains here is the footer, which is the
    // one place buttons genuinely belong in a panel that is otherwise just
    // information. The handleXxx functions themselves all still exist and
    // are unchanged -- handleContextMenuAction is simply their only caller
    // now, which is why nothing was stranded by the deletion.
    const endTurnBtn = $("end-turn-btn");
    if (endTurnBtn) endTurnBtn.onclick = handleEndTurnClick;
    const nextUnitBtn = $("next-unit-btn");
    if (nextUnitBtn) nextUnitBtn.onclick = handleNextUnit;
    const nextIdleCityBtn = $("next-idle-city-btn");
    if (nextIdleCityBtn) nextIdleCityBtn.onclick = handleNextIdleCity;
    const openResearchBtn = $("open-research-btn");
    if (openResearchBtn) openResearchBtn.onclick = () => { viewState.techTreeCivId = humanCivId; redraw(); };

    // Tile-inspector tabs, plus the in-panel shortcuts that jump to one (the
    // city panel's garrison list and the terrain panel's contents list) --
    // both carry the same data-tab-index, so one handler covers them.
    for (const btn of document.querySelectorAll(".tile-tab, .tile-tab-link")) {
      btn.onclick = () => {
        window.UI.input.setActiveTab(gameState, viewState, Number(btn.dataset.tabIndex));
        redraw();
      };
    }

    // Tile links (2026-08-03, user-directed): anything in the sidebar that
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
      // "Just opened" (2026-08-16, user-directed, replacing the old
      // collapsible-layer mechanic): the overlay's display is always reset
      // to "none" by the close handler below, and only ever set back to
      // "flex" by this block -- so display not already being "flex" here
      // means this render is the first one since the screen opened, which
      // is exactly the one-shot moment to auto-center on the highest
      // available layer (skipped if a focusTechId link is also driving its
      // own scroll target this render -- that one wins).
      const justOpened = overlay.style.display !== "flex";
      const key = `${viewState.techTreeCivId}:${gameState.turnNumber}:${civ.currentResearch || ""}`;
      if (key !== lastRenderedTechTreeKey) {
        const focusTechId = viewState.techTreeFocusTechId || null;
        $("techtree-content").innerHTML = window.UI.techtree.render(civ, isPlayerCiv, focusTechId, viewState.techTreeHoverId || null);
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
        viewState.techTreeCivId = null;
        viewState.techTreeHoverId = null;
        // Fires the deferred unit-built-notice/pendingIntent chain
        // (2026-08-07, user-directed bug fix) -- see openTechResearchedDialog's
        // onChooseResearch, which stashes it here instead of firing it the
        // instant the tech tree opens, specifically so those notices can't
        // pop up and steal focus while the player is still choosing research.
        // Cleared before calling: the callback itself may end up back at a
        // point that reopens the tech tree (unlikely today, but this ordering
        // means an onTechTreeClosed set during the callback is never
        // stomped by this line running after it).
        const onClosed = viewState.onTechTreeClosed;
        viewState.onTechTreeClosed = null;
        if (onClosed) onClosed();
        redraw();
      };
      // Research selection (player's own tree only -- renderNode only emits
      // these buttons when isPlayerCiv).
      for (const node of document.querySelectorAll(".techtree-node-selectable")) {
        node.onclick = () => {
          window.GameEngine.tech.chooseResearch(civ, node.dataset.techId);
          redraw();
        };
      }
      // Hover prereq/unlock highlighting (2026-08-10, user-directed;
      // dimming + layer force-open removed 2026-08-10, user-directed
      // follow-up -- too much visual "flicker" as the cursor moved
      // around): hovering any node highlights its prereq ancestors and
      // whatever it unlocks with a colored border, nothing else -- no
      // dimming of unrelated nodes, and layers never expand/collapse from a
      // hover (see techtree.js's computeRelations/relationKindFor). Forces
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
        // Confirm-action sfx (2026-08-06, user-directed): fires once, right
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
   * RADIAL MAP MENU (2026-08-06, user-directed) -- see js/ui/ringmenu.js for
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
      options = orders.cityRingOptions(city, gameState, humanCivId);
    } else {
      if (!orders.canCommand(unit, gameState, humanCivId)) return close();
      const unitOptions = orders.contextMenuOptions(unit, gameState, menu.x, menu.y, humanCivId);
      // MERGED RING (2026-08-06, user-directed): only when the ring's own
      // tile IS the unit's own tile -- a unit ring aimed at a REMOTE tile
      // (moveTo/attack against something elsewhere) still gets the single
      // city:open cross-link a few lines down, not a merge, since there's no
      // single shared tile to anchor a two-column ring to. See orders.js's
      // mapMenuOptions doc comment for the same distinction made there.
      if (city && unit.x === menu.x && unit.y === menu.y) {
        const cityOptions = orders.cityRingOptions(city, gameState, humanCivId);
        const merged = orders.mergeUnitCityOptions(unitOptions, cityOptions);
        options = merged.options;
        split = merged.split;
      } else {
        options = unitOptions;
        if (city) options.push({ kind: "city:open", label: "City Actions" });
      }
    }

    // Keyboard-shortcut hints (2026-08-07, user-directed): a static badge on
    // the two pills that always have one, plus the Shift-held "next 3
    // turns" prefix on all three auto-repeat-eligible pills (see
    // maybeScheduleAutoRepeat -- Space/restAndDefend/city:resourceProduction/
    // city:research all funnel through the same handler a click would).
    // Movement (arrow keys) has no single fixed pill to annotate this way --
    // "moveTo" only exists dynamically once a destination tile is clicked --
    // so it's left without a ring badge, a scoping call rather than an
    // oversight.
    for (const o of options) {
      if (o.kind === "restAndDefend" || o.kind === "city:resourceProduction") o.shortcut = "Space";
      if (shiftHeld && (o.kind === "restAndDefend" || o.kind === "city:resourceProduction" || o.kind === "city:research")) {
        o.label = `Next 3 turns: ${o.label}`;
      }
    }

    const center = window.UI.render.tileCenterOnMap(menu.x, menu.y, canvas, gameState, viewState);
    const ctx = {
      cx: center.x, cy: center.y, ts: center.ts,
      mapW: canvas.width, mapH: canvas.height, split,
    };

    // A sub-page (build list, level-up picker) replaces the ring rather than
    // sitting alongside it -- see ringmenu.js's renderPopover. Its own markup
    // and wiring, but the same root, key and reposition machinery.
    const page = menu.page ? buildRingPage(menu, city, unit, civ) : null;
    if (menu.page && !page) { viewState.ringMenu.page = null; }
    if (!page && !options.length) return close();

    const key = page
      ? `page:${menu.subject}:${menu.x},${menu.y}:${menu.page}:${page.body.length}`
      : `${menu.subject}:${menu.x},${menu.y}::${options.map((o) => o.kind).join("|")}${shiftHeld ? ":shift" : ""}`;

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
      // Per-item "Go to" links (2026-08-04, user-directed) -- jumping to fix
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
    } else if (dialog.kind === "gameOver") {
      const okBtn = $("game-dialog-ok-btn");
      if (okBtn) okBtn.onclick = () => dialog.onReturnToTitle();
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

  // Rest and Defend (2026-08-07, user-directed: merged from two separate
  // actions into one) -- both effects still apply: healUnit at end of turn
  // via unit.resting (turns.js), AND doubled defense until the start of
  // this unit's next turn via the "defending" condition (same
  // expiresAtTurn convention ai.js's performDefend uses for the AI side).
  // Only one badge shows for this (overlays.js's drawConditionBadges skips
  // the resting icon whenever "defending" is also active).
  function handleRestAndDefend() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (!window.GameEngine.orders.performRestAndDefend(unit, gameState)) return;
    maybeScheduleAutoRepeat(unit, "restAndDefend");
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

  /** Sentry (2026-08-12, user-directed): sits and does nothing until an
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

  /** Follow (2026-08-12, user-directed): opens tile-placement mode (same
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

  function handleCancelFollow() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (!unit.followTarget) return;
    unit.followTarget = null;
    redraw();
  }

  /** Automate Actions toggle (2026-08-06, user-directed) -- see sidebar.js's
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

  /** Garrison (2026-08-06, user-directed): the same x2-defense "defending"
   *  condition Rest and Defend also sets, but CHANNELED -- started once, then
   *  kept alive automatically every turn (see turns.js's finishCivTurn,
   *  which re-applies the condition for any human unit with
   *  unit.channeling === "garrison" so it never lapses on its own) instead
   *  of asking the player to re-click Defend every single turn. Reuses the
   *  unit.channeling field/isSpent exclusion the resource channels
   *  (hunting, prospecting, ...) already use, with a distinct value and no
   *  stash of its own. Only offered while standing in one of this civ's own
   *  cities. Ends via Cancel Garrison (handleCancelGarrison) or any other
   *  manual order (endAutomationAndGoto). */
  function handleGarrisonUnit() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    const civ = gameState.civs[humanCivId];
    if (!civ || unit.civId !== humanCivId) return;
    if (unit.usedThisTurn || unit.channeling) return;
    if (!civ.cities.some((c) => c.x === unit.x && c.y === unit.y)) return;
    endAutomationAndGoto(unit);
    unit.channeling = "garrison";
    window.GameEngine.combat.setCondition(unit, "defending", { expiresAtTurn: (gameState.turnNumber || 0) + 1 });
    unit.usedThisTurn = true;
    unit.resting = true;
    redraw();
  }

  /** Ends a standing Garrison (see handleGarrisonUnit) -- free, same as
   *  Cancel Channel/Cancel Hidden, since there's no stash to forfeit and
   *  nothing irreversible about stepping down from a brace. Drops the
   *  "defending" condition immediately rather than letting it linger to its
   *  nominal expiry, so the bonus visibly ends the instant the player asks
   *  it to. */
  function handleCancelGarrison() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.channeling !== "garrison") return;
    unit.channeling = null;
    window.GameEngine.combat.clearCondition(unit, "defending");
    redraw();
  }

  // Hidden/stealth (2026-08-03, user-reported): the engine mechanic
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

  // Channeled actions (2026-07-21, user-directed): Prospector's Claim,
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

  /** The "city:*" half of the ring's dispatch (2026-08-06, user-directed) --
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

    // NOT selectCityAt for the rest of these (2026-08-06, user-directed bug
    // fix): selectCityAt forces the sidebar's active tab to "city", and
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
      case "city:buildUnit":
      case "city:buildStructure":
        // Opens the real build list as a ring sub-page (see
        // ringmenu.js's renderPopover / buildlist.js) -- the ring stays open
        // rather than closing, so Back returns to the categories.
        //
        // subject: menu.subject, NOT a hardcoded "city" (2026-08-06,
        // user-directed): on the co-located tile (a unit standing on its own
        // city), menu.subject is "unit" and renderRingMenu renders the
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

  /** Dispatches whichever ring-menu entry the player picked (2026-08-06,
   *  user-directed -- see orders.js's contextMenuOptions for what each
   *  `kind` means and when it's offered, js/ui/ringmenu.js for how it's
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
        break;
      }
      case "buildRoadHere":
        handleBuildRoad();
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
      case "restAndDefend":
        handleRestAndDefend();
        break;
      case "automate":
        handleToggleAutomate();
        break;
      case "levelUp":
        // Sub-page, not an order -- keep the ring open on this unit's tile
        // and swap it for the picker (see renderRingMenu's buildRingPage).
        viewState.ringMenu = { x: menu.x, y: menu.y, subject: "unit", page: "levelUp" };
        break;
      case "garrison":
        handleGarrisonUnit();
        break;
      case "cancelGarrison":
        handleCancelGarrison();
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
              // Halfellow "Making Trouble" (2026-08-17, user-directed): a
              // Trouble Maker disarms a chest trap instead of springing it --
              // no damage, no condition.
              title = "Trap Disarmed!";
              text = `${unitLabel} finds a trap, but disarms it.`;
            } else if (result.trapped) {
              title = "It's a Trap!";
              text = `${unitLabel} springs a ${result.kind} trap: -${result.damage} HP and ${result.kind === "fire" ? "Burning" : "Frozen"}.`;
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
      default:
        // "startChannel:<kind>" (2026-08-06, user-directed full-list mirror)
        // -- one case per channel type would just repeat this same call
        // five times, so the channel kind is parsed out of the menu kind
        // string instead. See orders.js's contextMenuOptions for the exact
        // list (prospecting/delving/fishing/hunting/farming).
        if (kind && kind.startsWith("startChannel:")) {
          handleStartChannel(kind.slice("startChannel:".length));
        } else if (kind && kind.startsWith("castFlight:")) {
          // "castFlight:X,Y" (2026-08-06, user-directed bug fix) -- same
          // payload-in-the-kind-string convention as startChannel: above.
          // The target's coordinates ride along because orders.js's
          // contextMenuOptions can offer more than one of these at once (one
          // per eligible adjacent ally), so a bare "castFlight" kind
          // wouldn't say which. See ai.js's castFlightOnAlly, which
          // re-validates every condition that earned this pill its spot on
          // the ring -- the target could have moved, died, or already been
          // flighted since the ring was drawn, same "don't trust a menu that
          // might be stale" reasoning "attack"'s own re-lookup above uses.
          const [tx, ty] = kind.slice("castFlight:".length).split(",").map(Number);
          const civ = gameState.civs[humanCivId];
          const ally = civ.units.find((u) => u.x === tx && u.y === ty && u !== unit && !u.carriedBy);
          window.GameEngine.ai.castFlightOnAlly(civ, unit, ally, gameState);
        } else if (kind && kind.startsWith("carryUnit:")) {
          // "carryUnit:X,Y" (2026-08-10, user-directed): `unit` is the
          // carrier, the target at (X,Y) is the passenger it's picking up --
          // same payload-in-kind-string convention as castFlight above.
          handleCarryUnit(unit, kind.slice("carryUnit:".length));
        } else if (kind && kind.startsWith("boardCarrier:")) {
          // "boardCarrier:X,Y" -- `unit` is the passenger, the target at
          // (X,Y) is the carrier it's boarding. Mirrors carryUnit above with
          // the two roles swapped.
          handleCarryUnit(null, kind.slice("boardCarrier:".length), unit);
        } else if (kind === "dropOff") {
          // "Drop Off" (2026-08-11, user-directed): commits instantly, no
          // placement mode -- see orders.js's ring option, gated on
          // hasOpenDisembarkTile so this only ever appears when there's
          // somewhere to actually put the passenger down.
          const civ = gameState.civs[humanCivId];
          if (civ) {
            window.GameEngine.ai.performPlayerDisembark(civ, unit, gameState);
            // Same immediate-visibility fix as every other summon/placement
            // flow (2026-08-11, user-directed) -- the dropped passenger
            // otherwise wouldn't render until this civ's next visibility
            // refresh.
            window.GameEngine.turns.refreshVisibility(gameState);
          }
        } else if (kind === "summonWisp") {
          startWispSummonPlacement(unit);
        } else if (kind && kind.startsWith("setTrap:")) {
          // Halfellow "Set the Trap" (2026-08-11, user-directed): "setTrap:
          // frost"/"setTrap:fire" -- same payload-in-kind-string convention
          // as castFlight/carryUnit above.
          startTrapPlacement(unit, kind.slice("setTrap:".length));
        } else if (kind === "summonRaptor" || kind === "summonShadowsteed") {
          // Elf Druid (2026-08-10, user-directed): a single click, no
          // placement mode needed -- Raptor/Shadowsteed always land on an
          // open adjacent tile (see ai.js's spawnUnitAdjacentToUnit), unlike
          // the Wisp's arbitrary swamp destination just above.
          const civ = gameState.civs[humanCivId];
          if (civ) {
            window.GameEngine.ai.performPlayerDruidSummon(civ, unit, kind === "summonRaptor" ? "raptor" : "shadowsteed", gameState);
            // Same immediate-visibility fix as Summon Wisp/Set the Trap
            // (2026-08-11, user-directed) -- a freshly-spawned Raptor/
            // Shadowsteed otherwise wouldn't render until this civ's next
            // visibility refresh. Usually a no-op in practice (it lands
            // adjacent to a unit whose own vision almost always already
            // covers that tile), but there's no reason to leave this path
            // inconsistent with the other two summon flows.
            window.GameEngine.turns.refreshVisibility(gameState);
          }
        } else if (kind === "teleportSelf") {
          startTeleportPlacement(unit, unit);
        } else if (kind && kind.startsWith("teleportAlly:")) {
          const [tx, ty] = kind.slice("teleportAlly:".length).split(",").map(Number);
          const civ = gameState.civs[humanCivId];
          const ally = civ.units.find((u) => u.x === tx && u.y === ty && u !== unit && !u.carriedBy);
          if (ally) startTeleportPlacement(unit, ally);
        } else if (kind === "fireball") {
          startFireballPlacement(unit);
        } else if (kind && kind.startsWith("riddle:")) {
          // Halfellow "Riddle" (2026-08-11, user-directed) -- same shape as
          // Freezing Touch above.
          const [tx, ty] = kind.slice("riddle:".length).split(",").map(Number);
          const civ = gameState.civs[humanCivId];
          const found = window.GameEngine.orders.attackTargetAt(unit, gameState, tx, ty, humanCivId);
          if (civ && found && found.kind === "unit") {
            window.GameEngine.ai.performPlayerRiddle(civ, unit, found.unit, gameState);
          }
        } else if (kind && kind.startsWith("resourceHeist:")) {
          // Halfellow "Resource Heist" (2026-08-11, user-directed) -- same
          // shape as Freezing Touch above.
          const [tx, ty] = kind.slice("resourceHeist:".length).split(",").map(Number);
          const civ = gameState.civs[humanCivId];
          const found = window.GameEngine.orders.attackTargetAt(unit, gameState, tx, ty, humanCivId);
          if (civ && found && found.kind === "unit") {
            window.GameEngine.ai.performPlayerResourceHeist(civ, unit, found.unit, gameState);
          }
        } else if (kind && kind.startsWith("unlockTheGate:")) {
          // Halfellow "Unlock the Gate" (2026-08-11, user-directed):
          // targets a wall structure, not a unit -- uses cities.js's
          // findStructureAt (same lookup orders.js's ring option used to
          // build the pill) instead of attackTargetAt.
          const [tx, ty] = kind.slice("unlockTheGate:".length).split(",").map(Number);
          const civ = gameState.civs[humanCivId];
          const found = window.GameEngine.cities.findStructureAt(gameState, tx, ty);
          if (civ && found) {
            window.GameEngine.ai.performPlayerUnlockTheGate(
              civ, unit, { structure: found.record, city: found.city, civId: found.civ.id }, gameState);
          }
        } else if (kind && kind.startsWith("activateAura:")) {
          // "activateAura:heavy_metal"/"activateAura:power_metal"
          // (2026-08-10, user-directed) -- a free toggle, not a spent
          // action: see orders.js's contextMenuOptions for the two-techs-
          // known case offering both as separate pills.
          unit.activeAura = kind.slice("activateAura:".length);
          unit.auraActive = true;
        }
        break;
    }
    redraw();
  }

  /** Elf "Roots of the World" / Human "Teleportation" (2026-08-10/11,
   *  user-directed -- the latter promotes what used to be an AI-only
   *  mechanic, see ai.js's performWizardTeleport/attemptWizardTeleport/
   *  maybeTeleportStrike, to this exact same player-facing flow): opens
   *  tile-placement mode (same viewState.placement mechanism
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
    // Elf "Roots of the World" is Forest-only (2026-08-17, user-directed) --
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
      // previewUnitId/previewRaceId (2026-08-11, user-directed): same
      // half-transparent sprite preview as the summon flows -- shows the
      // unit actually being relocated (the caster itself, or the targeted
      // ally) standing on the hovered tile.
      previewUnitId: targetUnit.typeId, previewRaceId: civ.raceId,
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) {
          performTeleport(civ, caster, targetUnit, slot.x, slot.y, gameState);
          // Same immediate-visibility fix as Summon Wisp/Set the Trap
          // (2026-08-11, user-directed) -- teleporting onto a distant
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

  /** Human "Fireball!" (2026-08-17, user-directed): tile-placement mode over
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
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) window.GameEngine.ai.performPlayerFireball(civ, caster, slot.x, slot.y, gameState);
        redraw();
      },
    };
    redraw();
  }

  /** Orc "Bog Spirit" (2026-08-10, user-directed): same tile-placement
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
      // previewUnitId/previewRaceId (2026-08-11, user-directed): render.js's
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
          // would normally wait until this civ's next turn (2026-08-11,
          // user-directed: "should show up immediately, not wait for the
          // turn to end").
          window.GameEngine.turns.refreshVisibility(gameState);
        }
        redraw();
      },
    };
    redraw();
  }

  /** Halfellow "Set the Trap" (2026-08-11, user-directed): same
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
      // previewUnitId/previewRaceId (2026-08-11, user-directed): render.js's
      // drawPlacementOverlay draws a real, half-transparent trap sprite on
      // the hovered tile instead of the plain gold rectangle alone.
      previewUnitId: trapKind === "fire" ? "trap_fire" : "trap_frost", previewRaceId: civ.raceId,
      onPick: (slot) => {
        viewState.placement = null;
        if (slot) {
          window.GameEngine.ai.performPlayerTrapSet(civ, troubleMaker, trapKind, slot.x, slot.y, gameState);
          // Same immediate-visibility fix as Summon Wisp above -- a freshly
          // placed trap otherwise wouldn't render until this civ's next
          // visibility refresh (2026-08-11, user-directed).
          window.GameEngine.turns.refreshVisibility(gameState);
        }
        redraw();
      },
    };
    redraw();
  }

  /** Carry/Board (2026-08-10, user-directed): resolves the OTHER unit from
   *  its (x,y) coordinates -- exactly one of `carrier`/`passenger` is passed
   *  in already selected (whichever ring the player clicked from), the other
   *  is null and gets looked up here. Delegates the actual eligibility
   *  re-check and state mutation to orders.js's performCarry, same
   *  "re-validate, don't trust a menu that might be stale" reasoning
   *  castFlight's handler above already follows. */
  function handleCarryUnit(carrier, coordStr, passenger) {
    if (!humanCivId) return;
    const civ = gameState.civs[humanCivId];
    if (!civ) return;
    const [tx, ty] = coordStr.split(",").map(Number);
    if (!carrier) carrier = civ.units.find((u) => u.x === tx && u.y === ty);
    if (!passenger) passenger = civ.units.find((u) => u.x === tx && u.y === ty);
    if (!carrier || !passenger) return;
    window.GameEngine.orders.performCarry(carrier, passenger, civ);
  }

  function handleCancelChannel() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (!unit.channeling) return;
    unit.channeling = null;
    redraw();
  }

  /** "Claim Gathered Resources" (2026-08-06, user-directed): a clean
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
   * slots on the map and the build is queued bound to that tile
   * (2026-08-01, user-directed: placement is chosen at queue time, not on
   * completion, so walls can be planned deliberately).
   */
  /** Whether building one more `unitId` would push the civ's net income
   *  (income minus total unit upkeep) negative on any resource -- same math
   *  as sidebar.js's own Economy panel "Net (H/C/L)" row, just with this
   *  one hypothetical extra unit's upkeep folded in before committing
   *  (2026-08-10, user-directed). Returns a "H/C/L" label naming the
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
    // (2026-08-06, user-directed bug fix). This popover can be open while a
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
      // Negative-net-upkeep warning (2026-08-10, user-directed): same "Net
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

  /** "Resource Production" (2026-08-06, user-directed): spends this city's
   *  production for the CURRENT turn on resources instead of a unit or a
   *  building -- see cities.js's applyResourceProduction for the payout and
   *  why it lands on this turn rather than the next one.
   *
   *  Takes `city` explicitly (2026-08-06, user-reported fix -- a prior
   *  version of this read it back from viewState.ringMenu.x/y instead, which
   *  broke the button outright: handleContextMenuAction nulls
   *  viewState.ringMenu BEFORE calling handleCityRingAction, which is what
   *  calls this, so ringMenu was already null on every real click, not just
   *  the merged-ring case that rewrite was trying to fix. handleCityRingAction
   *  has already resolved the correct city by the time it calls this, the
   *  same way it already passes `city` directly to cancelBuild/
   *  applyResearchBoost right alongside this call -- no reason for this one
   *  case to read it back out of view state instead of just taking it. */
  function handleResourceProduction(city) {
    const civ = humanCivId && gameState.civs[humanCivId];
    if (!civ || !city || city.civId !== humanCivId) return;
    if (!window.GameEngine.cities.applyResourceProduction(city, civ, gameState)) return;
    maybeScheduleAutoRepeat(city, "resourceProduction");
    if (!goToNextIdleCityOrNextUnit()) redraw();
  }

  /** 2026-08-07, user-reported: finishing research via a city's own
   *  "Research" boost pill never triggered the "research complete" dialog --
   *  only turns.js's per-turn tickResearch path ever set civ.lastCompletedTech
   *  (see finishRoundBookkeeping, which reads and clears it every round).
   *  applyResearchBoost/reduceResearchTurns share the identical completion
   *  logic and return a receipt with the same shape (`{completed, techId}`),
   *  just never wrote it into that flag -- do so here so both paths notify
   *  the same way. Its own named handler (rather than inlined in
   *  handleCityRingAction) so the Space-bar shortcut and the Shift "next 3
   *  turns" auto-repeat (turns.js) can both call the exact same path a ring
   *  click does. */
  function handleCityResearch(city) {
    const civ = humanCivId && gameState.civs[humanCivId];
    if (!civ || !city || city.civId !== humanCivId) return;
    const result = window.GameEngine.cities.applyResearchBoost(city, civ, gameState);
    if (!result) return;
    if (result.completed) civ.lastCompletedTech = result.techId;
    maybeScheduleAutoRepeat(city, "research");
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

  /** Spends one pending level-up on `stat` for the currently selected unit
   *  (2026-08-04, user-reported): the player-facing counterpart to ai.js's
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
    // Flash the tile (2026-08-06, user-directed) -- see render.js's
    // drawFlashTile, driven by the existing per-frame animation loop.
    viewState.flashTile = { x: next.x, y: next.y, startTime: performance.now() };
    redraw();
  }

  /** "Next Idle City" (2026-08-07, user-directed) -- same cycler shape as
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

  /** After the player selects an action for a city (2026-08-07, user-
   *  directed): jump straight to the next idle city if any remain,
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
    // Brief flash (2026-08-12, user-directed) -- render.js's drawTileFlash
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
    viewState.scrollX = (x + 0.5) * ts - canvas.width / 2;
    viewState.scrollY = (y + 0.5) * ts - canvas.height / 2;
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

  /** Help Build (2026-08-12, user-directed): a Pioneer standing on its own
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
   *  offers (2026-08-04, user-reported) -- it used to fire immediately on
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
    newGame(raceIds, seed, monsterCapPerKingdom) {
      gameState = createNewGame(raceIds, seed, monsterCapPerKingdom);
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
  let lastPanMs = null;
  // WASD map panning (2026-08-07, user-directed) -- px/second at 100% zoom,
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
          // after the map beneath them (2026-08-06, user-directed). 2D only
          // -- the 3D path has no equivalent sky layer, and its canvas is a
          // different element entirely.
          window.UI.clouds.render($("map-clouds"), viewState);
        }
      }
      animFrameId = requestAnimationFrame(frame);
    }
    animFrameId = requestAnimationFrame(frame);
  }

  document.addEventListener("DOMContentLoaded", showSetupScreen);
})();
