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

  // Dialog kinds that ask "are you sure you want to do this?" -- see
  // redraw()'s dialog block, which plays system_confirm_action.mp3 the
  // instant one of these is first shown. Deliberately excludes the purely
  // informational kinds (message/techResearched/unitBuilt) and the N-way
  // "chooseTech" picker.
  const CONFIRM_ACTION_DIALOG_KINDS = new Set(["confirm", "confirmEndTurn", "foundCity", "confirmAutomatedAction"]);

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
      // cache-buster above) rather than retrying a permanently-errored
      // element. The old behaviour disabled the button outright, so a single
      // transient hiccup killed title music for the whole session with no
      // way back -- which is what "(no audio file)" was reporting even when
      // the file was perfectly fine.
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

  /**
   * Automated-testing switch (2026-08-03, user-directed): opening the game
   * with ?mute (or ?mute=1) starts it fully silent -- no music, no sfx.
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
    const params = new URLSearchParams(window.location.search);
    if (!params.has("mute") || params.get("mute") === "0") return;
    window.MusicSystem.setMuted(true, { persist: false });
    window.SfxSystem.setMuted(true); // sfx mute is in-memory only already
    titleAudioMuted = true;          // separate element -- see initTitleAudio
    if (titleAudio) titleAudio.volume = 0;
    console.log("[audio] ?mute in the URL -- music, sfx and title music start muted");
  }

  /**
   * LAUNCH OPTIONS (2026-08-03, user-directed)
   * -----------------------------------------
   * Every pre-game choice lives in one modal now, opened by the splash
   * screen's "Game Options" button, and the modal owns the Start Game button
   * too. Previously these controls sat in a permanent toolbar strip pinned
   * across the top of the splash screen, which fixed the number of options
   * at "however many fit on one row" -- the reason this moved is to leave
   * room for single-player options that don't exist yet.
   *
   * The control IDs are deliberately UNCHANGED from the old toolbar markup
   * (spectator-toggle, human-race-select, opponent-count, difficulty-select,
   * seed-input, .spectator-race-checkbox), so startGame() reads them exactly
   * as before and knows nothing about where they're rendered.
   *
   * Sections are shown/hidden by mode rather than mixed together: picking
   * All-AI Spectator swaps the Single Player block for the race checklist,
   * since "Race"/"Opponents" are meaningless in a spectator game and the old
   * flat strip left them sitting there greyed-in-spirit-only.
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
          <span>Your Race</span>
          <select id="human-race-select">
            ${RACE_LIST.map((r) => `<option value="${r}">${window.GameData.getRace(r).label} — ${window.GameData.getRace(r).identity}</option>`).join("")}
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
          <span>Difficulty</span>
          <select id="difficulty-select">
            <option value="easy">Easy</option>
            <option value="normal" selected>Normal</option>
            <option value="hard">Hard</option>
          </select>
        </label>
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
        ${renderBuildStamp()}
      </div>`;
  }

  /** "Which copy of the game is this" -- date/time/build number under the
   *  Start Game button. Empty placeholder here (2026-08-05, user-directed
   *  redesign -- replaces the old hand-bumped js/data/build-info.js, which
   *  is gone); the real content is filled in asynchronously by
   *  fetchBuildStamp below once the GitHub API call resolves. */
  function renderBuildStamp() {
    return `<div class="build-stamp" id="build-stamp"></div>`;
  }

  // Owner/repo this build stamp reads from -- see fetchBuildStamp.
  const BUILD_STAMP_REPO = "mortedamos/Kingdom-Marches";

  /** Fills in #build-stamp from the repo's actual commit history (2026-08-05,
   *  user-directed): "which copy of the game am I looking at" now reflects
   *  the real latest-pushed commit instead of a number someone has to
   *  remember to bump by hand. Build number = total commit count on the
   *  default branch, read off the GitHub API's own pagination Link header
   *  (requesting per_page=1 makes the `rel="last"` page number equal the
   *  total commit count -- avoids fetching/paging through full history just
   *  to count it) rather than a separately-tracked number. Short SHA
   *  alongside it for exact reproducibility (two different commits on the
   *  same day would otherwise be indistinguishable).
   *
   *  Graceful failure (2026-08-05, user-directed): offline, rate-limited
   *  (unauthenticated GitHub API caps at 60 req/hour per IP), or the repo
   *  otherwise unreachable -- #build-stamp is just left empty rather than
   *  showing a stale/wrong static fallback. Fire-and-forget from
   *  showSetupScreen; never blocks the (synchronous) rest of the launch
   *  screen from rendering. */
  async function fetchBuildStamp() {
    const el = $("build-stamp");
    if (!el) return;
    try {
      const res = await fetch(`https://api.github.com/repos/${BUILD_STAMP_REPO}/commits?per_page=1`);
      if (!res.ok) return;
      const commits = await res.json();
      const latest = commits && commits[0];
      const iso = latest && latest.commit && latest.commit.author && latest.commit.author.date;
      if (!iso) return;

      // rel="last" page number (at per_page=1) IS the total commit count.
      // No "last" link at all means everything fit on one page -- i.e. the
      // total is just how many commits this single response returned.
      const link = res.headers.get("link") || "";
      const lastMatch = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
      const buildNumber = lastMatch ? Number(lastMatch[1]) : commits.length;

      const sha = (latest.sha || "").slice(0, 7);
      const d = new Date(iso);
      const pad = (n) => String(n).padStart(2, "0");
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      // No escaping needed -- every piece here is either a regex-matched
      // number or a hex SHA, not free-form text.
      el.textContent = `${dateStr} ${timeStr} · build ${buildNumber} (${sha})`;
    } catch (e) {
      // Network failure, CORS, JSON parse error, etc. -- #build-stamp stays
      // empty, per user direction, rather than showing anything stale.
      console.warn("[build-stamp] fetch failed:", e);
    }
  }

  function showSetupScreen() {
    applyMuteUrlSwitch();
    $("launch-options-content").innerHTML = renderLaunchOptions();
    fetchBuildStamp(); // fire-and-forget -- see its own doc comment

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

    $("start-game-btn").addEventListener("click", startGame);

    $("title-music-btn").addEventListener("click", () => {
      console.log("[title music] button clicked");
      toggleTitleMusic();
    });

    setupLaunchOptionsOverlay();
    setupContextMenuDismissal();
    setupButtonClickSfx();
  }

  /** Open/close wiring for the launch options modal. Closing is deliberately
   *  generous (button, backdrop click, Escape) because this modal is the only
   *  thing on the splash screen -- there's nothing behind it to lose. */
  function setupLaunchOptionsOverlay() {
    const overlay = $("launch-options-overlay");
    const open = () => {
      overlay.style.display = "flex";
      // Start title music the moment "Begin" is clicked (2026-08-05, user-
      // directed) -- it used to only ever start from the modal's own "Play
      // Title Music" button, an easy-to-miss manual step. A click IS a real
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

  /** Dismissal wiring for the map context menu (2026-08-06, user-directed):
   *  registered ONCE at bootstrap (safe pre-game -- both listeners no-op
   *  until viewState.contextMenu is actually set), same convention
   *  setupLaunchOptionsOverlay uses for its own open/close wiring, rather
   *  than re-registering a fresh document listener every redraw(). A click
   *  anywhere outside the menu itself, or Escape, closes it without acting
   *  -- picking an option is the only thing that DOES act (see
   *  handleContextMenuAction). */
  function setupContextMenuDismissal() {
    document.addEventListener("mousedown", (e) => {
      if (!viewState || !viewState.contextMenu) return;
      const root = $("map-context-menu-root");
      if (root && root.contains(e.target)) return; // let the menu's own click-through happen
      viewState.contextMenu = null;
      redraw();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && viewState && viewState.contextMenu) {
        viewState.contextMenu = null;
        redraw();
      }
    });
  }

  /** Global "click" sfx (2026-08-06, user-directed): ANY button anywhere in
   *  the app plays system_button_click.mp3 -- registered ONCE, on `document`,
   *  using event bubbling, rather than wiring it into every individual
   *  button's own onclick. This is deliberately the only way to satisfy
   *  "any time a button is clicked": most buttons here are rebuilt from
   *  scratch on every innerHTML redraw (sidebar, dialogs, tech tree, the map
   *  context menu, ...), so a per-button listener would have to be
   *  re-registered on every single rebuild and would be trivial to miss one
   *  of. e.target.closest("button") catches a click landing on a button's
   *  own child element (an icon/span inside it) too, not just the exact
   *  node. A disabled button never fires a click event at all, so those are
   *  already excluded for free. */
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
      turnBanner: null, // "<Race> Kingdom Taking Its Turn..." -- see advanceTurn()
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
    setupFullscreenControl();
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
      const civ = {
        id: civId, raceId, cities: [], units: [], eliminated: false,
        // isHuman (2026-08-04, user-reported): the only human/AI marker
        // readable from deep inside ai.js's combat-resolution call sites
        // (grantXPAndAutoLevel/applyComputedXP), which never receive
        // viewState.humanCivId the way the UI/orders.js layer does -- see
        // applyComputedXP's use of it to skip auto-picking a human unit's
        // veteran bonus. humanCivId (this closure's own copy) is already
        // set by startGame() before createNewGame runs; null in spectator
        // mode, which correctly makes isHuman false for every civ.
        isHuman: civId === humanCivId,
        completedTechs: new Set(), currentResearch: null,
        doctrine: null, // grand-strategy layer -- see engine/strategy.js
        // Each race's 4 buildings are now gated by that race's tech tree (see techs.js
        // building-column nodes) rather than unlocked at civ creation.
        // unlockedUnits/unlockedBuildings start EMPTY now (2026-08-04) --
        // Pioneer/Galley/Scout/Wall all come from the Level 0 techs' own
        // effects just below instead of a hardcoded starting set.
        unlockedUnits: new Set(),
        unlockedBuildings: new Set(),
        civicInfluenceBonus: 0, radiusBonus: 0, usedCityNames: [],
      };
      // LEVEL 0 (2026-08-06, user-directed): every layer-0 tech for this
      // race is auto-completed for free at creation -- pioneer_infrastructure/
      // distant_horizons/distant_shores/hunt_game/farm_soil today, but
      // computed dynamically (by layer, not a hardcoded id list) so any
      // future Level 0 tech is automatically free too, matching the design
      // rule "Level 0 = always granted, never researched." Notably,
      // race.startingTech (each race's own signature Layer-1 combat unit --
      // Raider, Spearguard, etc.) is deliberately NOT auto-completed here;
      // it's a normal tech that has to actually be researched, same as
      // everything else at its layer. Scout is the civ's only quasi-combat
      // capability until that finishes.
      const levelZeroTechs = window.GameData.techsForRace(raceId)
        .filter((id) => window.GameData.getTech(id).layer === 0);
      for (const techId of levelZeroTechs) {
        civ.completedTechs.add(techId);
        window.GameEngine.tech.applyTechEffects(civ, window.GameData.getTech(techId));
      }
      // Registered in `civs` now rather than at the end of this loop
      // (2026-08-03) so buildOccupancySet/findClosestOpenPlacementTile
      // below can see THIS civ's own starting units as they're placed one
      // at a time -- harmless for pickStartSpot's own spacing check just
      // below, since an empty units/cities civ can never self-conflict.
      civs[civId] = civ;

      const spot = pickStartSpot(landmasses, landmassIdx, map, civs, raceId);
      landmassIdx++;
      // startingUnit (2026-08-03, user-reported bug fix): this free
      // starting Pioneer was missing the flag that exempts it from ongoing
      // upkeep -- GameData.unitUpkeep's own doc comment already documented
      // "civ-creation's free starting Pioneer/2-Scouts are stamped with this
      // flag" as the intended design, but this line never actually set it,
      // so the Pioneer was silently costing upkeep like any other unit while
      // its starting Scouts/Galley (below) correctly didn't. Same one-time
      // perk on this specific instance as those -- a Pioneer BUILT later
      // (via the normal build-queue path) still costs upkeep normally.
      const settler = { typeId: "pioneer", civId, x: spot.x, y: spot.y, isCivilian: true, startingUnit: true };
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
        //
        // Placed adjacent to the pioneer, not stacked on top of it
        // (2026-08-03, user-reported) -- recomputed fresh each iteration so
        // the SECOND scout also avoids the first one's just-claimed tile.
        // Falls back to the pioneer's own tile only if every neighbor is
        // somehow blocked (vanishingly unlikely at turn 0 on open land).
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
    // Fullscreen API's own change event).
    const interfaceBtn = $("menu-interface-btn");
    if (interfaceBtn) interfaceBtn.addEventListener("click", syncLabel);
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
    muteCheckbox.checked = window.MusicSystem.isMuted();
    window.SfxSystem.setMuted(muteCheckbox.checked);
    muteCheckbox.addEventListener("change", () => {
      window.MusicSystem.setMuted(muteCheckbox.checked);
      window.SfxSystem.setMuted(muteCheckbox.checked);
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
    // Recomputed rather than trusted from the save file itself (2026-08-04):
    // civ.isHuman didn't exist before this fix, so a save made prior to it
    // would otherwise load with the flag missing on every civ, silently
    // breaking the level-up picker below. Cheap to just derive it fresh from
    // humanCivId every load instead of treating it as save-worthy state.
    for (const civ of Object.values(gameState.civs)) civ.isHuman = civ.id === humanCivId;

    for (const k of Object.keys(viewState)) delete viewState[k];
    Object.assign(viewState, {
      scrollX: 0, scrollY: 0, zoomLevel: 1.0, showInfluence: false, showGrid: true,
      selectedUnit: null, selectedCity: null, selectedTile: null, humanCivId,
      // Tabbed tile inspector -- the selected* fields above are derived from
      // this now (see input.js's SELECTION MODEL).
      selection: null,
      fogMode: "off", fogCivIds: new Set(Object.keys(gameState.civs)),
      tileScoreCivId: null, dialog: null, turnBanner: null,
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
      items.push({ text: "No research selected" });
    }
    for (const c of civ.cities) {
      if (!c.buildQueue && window.GameEngine.ai.availableBuilds(civ, c, gameState).some((o) => o.affordable)) {
        items.push({ text: `${c.name} is not building anything`, x: c.x, y: c.y, tabKind: "city" });
      }
    }
    return items;
  }

  function offerHumanSettling(onDone) {
    if (!humanCivId) { onDone(); return; }
    const civ = gameState.civs[humanCivId];
    // Automated pioneers (2026-08-06, user-directed) are excluded here --
    // they get their OWN founding confirmation, staged as unit.pendingIntent
    // by ai.js's maybeFoundCity and drained one at a time by
    // offerNextPendingIntent (see finishRoundBookkeeping), so this
    // end-of-turn sweep doesn't double-prompt the same pioneer through two
    // different dialog flows in a row.
    const eligible = civ.units.filter((u) => u.typeId === "pioneer" && !u.automated
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

    openFoundCityDialog(civ, unit, () => offerNextSettler(civ, eligible, idx + 1, onDone));
  }

  /** Opens the name-and-confirm dialog for `unit` founding on its own tile,
   *  and does the founding itself if the player accepts. Shared by the
   *  end-turn settler sweep (offerNextSettler) and the unit panel's own
   *  "Found City" button (handleFoundCity) so the two can't diverge.
   *  `onDone` runs once the dialog is answered either way. */
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
  function handleFoundCity() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    const civ = gameState.civs[humanCivId];
    if (!civ || unit.civId !== humanCivId) return;
    if (!window.GameData.getUnit(unit.typeId).canFoundCity) return;
    if (!window.GameEngine.cities.canFoundCityAt(gameState.map, gameState.civs, unit.x, unit.y, civ.raceId).ok) return;
    unit.gotoTarget = null; // a fresh order supersedes any queued goto (2026-08-06)
    openFoundCityDialog(civ, unit, () => redraw());
  }

  // Captured once at the start of each round (when turnStepIndex is 0) so the
  // "did the human's army just take losses" combat-music check can compare
  // across the WHOLE round, not just whichever single civ-step just ran.
  let pendingPreUnitCounts = null;

  function finishRoundBookkeeping(victoryResult) {
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
      // Victory dialog takes the one viewState.dialog slot instead. Tech
      // first, then the unit-built queue (if any) once THAT'S dismissed,
      // chained rather than raced, so neither silently drops behind the
      // other if both happen the same round (see openTechResearchedDialog/
      // offerNextUnitBuiltNotice).
      if (!victoryResult) {
        const afterUnitBuilt = () => offerNextPendingIntent(civ);
        if (finishedTechId) {
          openTechResearchedDialog(civ, finishedTechId, () => offerNextUnitBuiltNotice(civ, afterUnitBuilt));
        } else {
          offerNextUnitBuiltNotice(civ, afterUnitBuilt);
        }
      } else {
        civ.pendingUnitBuiltNotices = [];
        for (const unit of civ.units) unit.pendingIntent = null;
      }
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

  /** Tech-researched announcement (2026-08-06, user-directed): opens the
   *  instant a tech finishes (see finishRoundBookkeeping). Lists every
   *  OTHER tech in this civ's race tree that named `techId` as a
   *  prerequisite -- "here's what just opened up" -- plus a shortcut
   *  straight into the tech tree. `onDone` runs once the dialog is
   *  answered either way (same chaining convention offerNextSettler/
   *  offerNextUnitBuiltNotice use), so finishRoundBookkeeping can queue the
   *  unit-built notices right behind it. */
  function openTechResearchedDialog(civ, techId, onDone) {
    const tech = window.GameData.getTech(techId);
    if (!tech) { if (onDone) onDone(); return; }
    const unlockedLabels = window.GameData.techsForRace(civ.raceId)
      .filter((id) => window.GameData.getTech(id).prereqs.includes(techId))
      .map((id) => window.GameData.getTech(id).label);
    window.SfxSystem.playResearchComplete();
    viewState.dialog = {
      kind: "techResearched",
      techLabel: tech.label,
      techDescription: tech.description || "",
      unlockedLabels,
      onChooseResearch: () => {
        viewState.techTreeCivId = civ.id;
        if (onDone) onDone();
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
          viewState.buildPickerCityId = `${city.x},${city.y}`;
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
        }
        finish();
      },
      onDecline: () => finish(),
    };
    redraw();
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
  function advanceTurn() {
    let announcedCivId = null;
    function processBatch() {
      let stepResult;
      do {
        stepResult = advanceOneStep();
        if (stepResult.roundComplete) {
          viewState.turnBanner = null;
          redraw();
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
    const endTurnBtn = $("end-turn-btn");
    if (endTurnBtn) endTurnBtn.onclick = handleEndTurnClick;
    const roadBtn = $("build-road-btn");
    if (roadBtn) roadBtn.onclick = handleBuildRoad;
    const foundCityBtn = $("found-city-btn");
    if (foundCityBtn) foundCityBtn.onclick = handleFoundCity;
    const disbandBtn = $("disband-unit-btn");
    if (disbandBtn) disbandBtn.onclick = handleDisbandUnit;
    const restBtn = $("rest-unit-btn");
    if (restBtn) restBtn.onclick = handleRestUnit;
    const defendBtn = $("defend-unit-btn");
    if (defendBtn) defendBtn.onclick = handleDefendUnit;
    const stopOrderBtn = $("stop-order-btn");
    if (stopOrderBtn) stopOrderBtn.onclick = handleStopOrder;
    const automateBtn = $("automate-actions-btn");
    if (automateBtn) automateBtn.onclick = handleToggleAutomate;
    const startProspectingBtn = $("start-prospecting-btn");
    if (startProspectingBtn) startProspectingBtn.onclick = () => handleStartChannel("prospecting");
    const startHuntingBtn = $("start-hunting-btn");
    if (startHuntingBtn) startHuntingBtn.onclick = () => handleStartChannel("hunting");
    const startFarmingBtn = $("start-farming-btn");
    if (startFarmingBtn) startFarmingBtn.onclick = () => handleStartChannel("farming");
    const startDelvingBtn = $("start-delving-btn");
    if (startDelvingBtn) startDelvingBtn.onclick = () => handleStartChannel("delving");
    const startFishingBtn = $("start-fishing-btn");
    if (startFishingBtn) startFishingBtn.onclick = () => handleStartChannel("fishing");
    const claimChannelBtn = $("claim-channel-btn");
    if (claimChannelBtn) claimChannelBtn.onclick = handleClaimChannel;
    const cancelChannelBtn = $("cancel-channel-btn");
    if (cancelChannelBtn) cancelChannelBtn.onclick = handleCancelChannel;
    const goHiddenBtn = $("go-hidden-btn");
    if (goHiddenBtn) goHiddenBtn.onclick = handleGoHidden;
    const cancelHiddenBtn = $("cancel-hidden-btn");
    if (cancelHiddenBtn) cancelHiddenBtn.onclick = handleCancelHidden;
    const nextUnitBtn = $("next-unit-btn");
    if (nextUnitBtn) nextUnitBtn.onclick = handleNextUnit;
    const openResearchBtn = $("open-research-btn");
    if (openResearchBtn) openResearchBtn.onclick = () => { viewState.techTreeCivId = humanCivId; redraw(); };

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
    for (const btn of document.querySelectorAll(".level-up-btn")) {
      btn.onclick = () => handleChooseLevelUp(btn.dataset.levelUpStat);
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
      // Collapsible layer rows (2026-08-06, user-directed): owned here (not
      // techtree.js, which stays a pure render function) so a header click
      // can mutate it directly -- see techtree.js's render() doc comment
      // for the exact shape/default-collapse rule.
      viewState.techTreeExpandedLayers = viewState.techTreeExpandedLayers || {};
      const key = `${viewState.techTreeCivId}:${gameState.turnNumber}:${civ.currentResearch || ""}`;
      if (key !== lastRenderedTechTreeKey) {
        $("techtree-content").innerHTML = window.UI.techtree.render(civ, isPlayerCiv, viewState.techTreeExpandedLayers);
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
      // Layer header click toggles that layer's row -- forces a rebuild
      // (the identity key above doesn't change on its own from a toggle)
      // by dropping lastRenderedTechTreeKey before redraw().
      for (const header of document.querySelectorAll(".techtree-layer-toggle[data-toggle-layer]")) {
        header.onclick = () => {
          const civExpanded = viewState.techTreeExpandedLayers[civ.id] || {};
          const layer = header.dataset.toggleLayer;
          civExpanded[layer] = !civExpanded[layer];
          viewState.techTreeExpandedLayers[civ.id] = civExpanded;
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

    // Map right-click context menu (2026-08-06, user-directed) -- rebuilt
    // fresh every redraw (unlike the modals above, which gate on an
    // identity key) since it's a short-lived, cheap-to-rebuild popup, not
    // worth the bookkeeping. Auto-closes itself if the option list it
    // would show has gone empty (e.g. the unit died, moved, or already
    // acted since the menu opened) rather than leaving a stale/broken menu
    // open. See orders.js's contextMenuOptions for what's offered.
    const contextMenuRoot = $("map-context-menu-root");
    if (contextMenuRoot) {
      if (viewState.contextMenu && humanCivId && viewState.selectedUnit) {
        const options = window.GameEngine.orders.contextMenuOptions(
          viewState.selectedUnit, gameState, viewState.contextMenu.x, viewState.contextMenu.y, humanCivId);
        if (!options.length) {
          viewState.contextMenu = null;
          contextMenuRoot.innerHTML = "";
        } else {
          contextMenuRoot.innerHTML = window.UI.contextmenu.render(viewState.contextMenu, options);
          for (const btn of contextMenuRoot.querySelectorAll(".map-context-menu-item")) {
            btn.onclick = () => handleContextMenuAction(btn.dataset.menuKind);
          }
        }
      } else {
        viewState.contextMenu = null;
        contextMenuRoot.innerHTML = "";
      }
    }

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
        for (const btn of modal.querySelectorAll(".tile-link")) {
          btn.onclick = () => {
            finish(false);
            goToTile(Number(btn.dataset.tileX), Number(btn.dataset.tileY), btn.dataset.tileTab || null);
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
    }
  }

  function handleRestUnit() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.usedThisTurn) return;
    unit.gotoTarget = null; // a fresh order supersedes any queued goto (2026-08-06)
    unit.resting = true;
    unit.usedThisTurn = true;
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

  // Defend (2026-07-20, user-directed): a universal normal action, any
  // race/unit -- doubles this unit's own defense (see combat.js's
  // effectiveDefense) until the start of its next turn, same expiresAtTurn
  // convention ai.js's performDefend uses for the AI side.
  function handleDefendUnit() {
    if (!humanCivId || !viewState.selectedUnit) return;
    const unit = viewState.selectedUnit;
    if (unit.usedThisTurn) return;
    unit.gotoTarget = null; // a fresh order supersedes any queued goto (2026-08-06)
    window.GameEngine.combat.setCondition(unit, "defending", { expiresAtTurn: (gameState.turnNumber || 0) + 1 });
    unit.usedThisTurn = true;
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
    unit.gotoTarget = null; // a fresh order supersedes any queued goto (2026-08-06)
    unit.channeling = kind;
    unit.resting = true;
    unit.usedThisTurn = true;
    redraw();
  }

  /** Dispatches whichever context-menu entry the player picked (2026-08-06,
   *  user-directed -- see orders.js's contextMenuOptions for what each
   *  `kind` means and when it's offered, js/ui/contextmenu.js for how it's
   *  rendered). Re-reads viewState.contextMenu/selectedUnit fresh rather
   *  than closing over anything from when the menu was built, same
   *  "recompute at click time" convention handleChooseBuild already uses
   *  for the city build picker. */
  function handleContextMenuAction(kind) {
    const menu = viewState.contextMenu;
    viewState.contextMenu = null;
    if (!menu || !humanCivId) { redraw(); return; }
    const unit = viewState.selectedUnit;
    if (!unit) { redraw(); return; }

    switch (kind) {
      case "moveTo":
      case "buildRoadTo":
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
        const target = window.GameEngine.orders.attackTargetAt(unit, gameState, menu.x, menu.y, humanCivId);
        window.GameEngine.orders.attack(unit, gameState, target, humanCivId);
        break;
      }
      case "buildRoadHere":
        handleBuildRoad();
        break;
      case "foundCity":
        handleFoundCity();
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
      case "rest":
        handleRestUnit();
        break;
      case "defend":
        handleDefendUnit();
        break;
      case "disband":
        handleDisbandUnit();
        break;
      case "stopOrder":
        handleStopOrder();
        break;
      default:
        // "startChannel:<kind>" (2026-08-06, user-directed full-list mirror)
        // -- one case per channel type would just repeat this same call
        // five times, so the channel kind is parsed out of the menu kind
        // string instead. See orders.js's contextMenuOptions for the exact
        // list (prospecting/delving/fishing/hunting/farming).
        if (kind && kind.startsWith("startChannel:")) {
          handleStartChannel(kind.slice("startChannel:".length));
        }
        break;
    }
    redraw();
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
    redraw();
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
    unit.gotoTarget = null; // a fresh order supersedes any queued goto (2026-08-06)
    const tile = gameState.map.tiles[unit.y * gameState.map.width + unit.x];
    if (!tile.hasRoad) {
      tile.hasRoad = true;
      unit.usedThisTurn = true;
    }
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
