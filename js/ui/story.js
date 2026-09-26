/**
 * STORY UI
 * --------
 * Rendering half of the single-player story system (logic lives in
 * js/engine/story.js; design in doc/story_bible.md):
 *
 *  - renderScene(dialog): innerHTML for one line of a story scene, drawn
 *    into #game-dialog-modal like every other dialog kind (dialog.js's
 *    header explains that shared chrome). main.js owns the { kind: "story",
 *    scene, index } dialog state and wires the Next/Skip buttons.
 *  - sceneModalClass(dialog): the modal's class list for the CURRENT line --
 *    the gilded border follows the speaker's kingdom (narration uses the
 *    player's; the Marchstone gets its own stone panel).
 *  - showBark(bark): a small, non-blocking portrait card in the corner that
 *    dismisses itself. Fades only -- never flashes (photosensitivity rule).
 *  - loadScenario(id): lazily injects one scenario data file. Only the
 *    active lineup's file is ever loaded (bible §10), so the other 74 cost
 *    nothing. It also preloads that lineup's mood portraits.
 *  - Portraits: assets/portraits/<id>_<mood>.jpg, picked by the line's mood
 *    (falls back to neutral, then to the initials tile). Speakers alternate
 *    left/right within a scene (speakerSide); each scene starts on the left.
 *  - startReveal(root): fills the line in word by word (opacity fades only);
 *    speed from the Interface menu's Text Speed (get/setTextSpeed), instant
 *    when motion is reduced.
 */

window.UI = window.UI || {};

(function () {
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  /** Scenario text markup (bible §12): *italic*, **bold**, ***both***.
   *  Escaped first, so markup can only ever produce <em>/<strong>; an
   *  unclosed marker simply stays a literal asterisk. */
  function formatText(s) {
    return escapeHtml(s)
      .replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  function character(id) {
    return (window.GameData.STORY_CHARACTERS || {})[id] || { name: id, title: "", race: null, initials: "?" };
  }

  // ------------------------------------------------------------------ portraits

  const STONE_PORTRAIT = "assets/portraits/stone.jpg";

  /** assets/portraits/<id>_<mood>.jpg -- 480x600 mood portraits. */
  function portraitSrc(id, mood) {
    return `assets/portraits/${id}_${mood}.jpg`;
  }

  /** The mood a line will actually show: its own if the character has that
   *  portrait, otherwise neutral. null = no art (initials tile). */
  function resolveMood(id, mood) {
    const moods = window.GameData.storyMoodsFor ? window.GameData.storyMoodsFor(id) : [];
    if (!moods.length) return null;
    return mood && moods.includes(mood) ? mood : "neutral";
  }

  function portraitHtml(id, size = "", mood = null) {
    if (id === "stone") {
      // One portrait, no moods (assets/portraits/stone.jpg); the SVG stays
      // underneath as the fallback if the image can't load.
      return `<div class="story-portrait story-portrait-stone ${size}" aria-hidden="true">
        <svg viewBox="0 0 60 80"><path d="M14 76 L10 30 Q12 8 30 4 Q48 8 50 30 L46 76 Z" class="story-stone-body"/>
        <path d="M31 6 L27 24 L33 36 L26 52 L31 64 L28 76" class="story-stone-crack"/></svg>
        <img src="${STONE_PORTRAIT}" alt="" onerror="this.remove()"></div>`;
    }
    const ch = character(id);
    const race = ch.race && window.GameData.getRace ? window.GameData.getRace(ch.race) : null;
    const color = race ? race.color : "#555";
    const shown = resolveMood(id, mood);
    // The initials tile sits underneath; a missing file just removes the img.
    const img = shown ? `<img src="${escapeHtml(portraitSrc(id, shown))}" alt="" onerror="this.remove()">` : "";
    return `<div class="story-portrait ${size}" style="--story-race-color:${escapeHtml(color)}">
      <span class="story-initials">${escapeHtml(ch.initials || "?")}</span>${img}</div>`;
  }

  /** Loads every portrait of every character from the lineup's kingdoms
   *  (plus the Marchstone's) so mood changes between lines never blink.
   *  Resolves once they've all loaded or failed -- loadScenario waits on it,
   *  so the game's loading screen covers it and the opening scene's faces
   *  are ready the moment it appears. Capped so a slow file can't hold the
   *  loading screen hostage. */
  const preloaded = new Map();
  const PORTRAIT_PRELOAD_CAP_MS = 8000;
  function preloadPortraits(races) {
    const chars = window.GameData.STORY_CHARACTERS || {};
    const srcs = [STONE_PORTRAIT];
    for (const [id, ch] of Object.entries(chars)) {
      if (!ch.portrait || (races && !races.includes(ch.race))) continue;
      for (const mood of window.GameData.storyMoodsFor(id)) srcs.push(portraitSrc(id, mood));
    }
    const waits = srcs.map((src) => {
      if (!preloaded.has(src)) {
        preloaded.set(src, new Promise((resolve) => {
          const img = new Image();
          img.onload = img.onerror = () => resolve();
          img.src = src;
        }));
      }
      return preloaded.get(src);
    });
    const cap = new Promise((resolve) => setTimeout(resolve, PORTRAIT_PRELOAD_CAP_MS));
    return Promise.race([Promise.all(waits), cap]);
  }

  /** Which side the speaker of line `index` stands on. The first speaker of
   *  a scene is on the left; each change of speaker swaps sides (a third
   *  speaker, or the first one again, comes back left). Narration never
   *  counts. Worked out from the scene itself, so it resets per scene and
   *  survives a reload mid-scene. */
  function speakerSide(scene, index) {
    let side = "left";
    let prev = null;
    for (let i = 0; i <= index; i++) {
      const l = scene.lines[i];
      if (!l || l.narration) continue;
      if (prev !== null && l.speaker !== prev) side = side === "left" ? "right" : "left";
      prev = l.speaker;
    }
    return side;
  }

  // ------------------------------------------------------------------ word reveal

  /** Milliseconds per word by speed setting; 0 = show at once. */
  const TEXT_SPEEDS = { slow: 110, normal: 70, fast: 35, instant: 0 };
  const PUNCT_PAUSE = { ",": 2, ";": 2.5, ":": 2.5, ".": 4, "!": 4, "?": 4, "…": 5, "—": 2.5 };
  const SPEED_KEY = "roi_story_text_speed";
  let textSpeed = "normal";
  try {
    const stored = localStorage.getItem(SPEED_KEY);
    if (stored && TEXT_SPEEDS[stored] != null) textSpeed = stored;
  } catch (e) { /* no storage: keep the default */ }

  function getTextSpeed() { return textSpeed; }
  function setTextSpeed(s) {
    if (TEXT_SPEEDS[s] == null) return;
    textSpeed = s;
    try { localStorage.setItem(SPEED_KEY, s); } catch (e) { /* non-fatal */ }
  }

  function motionReduced() {
    return !!(window.UI.motion && window.UI.motion.isReduced && window.UI.motion.isReduced());
  }

  /** Wraps every word inside `el` (walking through <em>/<strong>) in a
   *  hidden span, keeping the finished layout in place so nothing reflows. */
  function wrapWords(el) {
    const spans = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const texts = [];
    while (walker.nextNode()) texts.push(walker.currentNode);
    for (const node of texts) {
      const parts = node.nodeValue.split(/(\s+)/);
      const frag = document.createDocumentFragment();
      for (const part of parts) {
        if (!part) continue;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
        const span = document.createElement("span");
        span.className = "story-w";
        span.textContent = part;
        frag.appendChild(span);
        spans.push(span);
      }
      node.parentNode.replaceChild(frag, node);
    }
    return spans;
  }

  /**
   * Fills the text of a rendered line in word by word. Returns a handle:
   * `done` (all words shown) and `finish()` (show the rest at once -- the
   * first Next click). Opacity fades only, never flashing (photosensitivity
   * rule); instant when the speed setting says so or motion is reduced.
   */
  function startReveal(root, { fast = false } = {}) {
    const handle = { done: true, finish() {} };
    const textEl = root && root.querySelector(".story-text, .story-bark-text");
    if (!textEl) return handle;
    const perWord = fast ? Math.round(TEXT_SPEEDS[textSpeed] * 0.6) : TEXT_SPEEDS[textSpeed];
    if (!perWord || motionReduced()) return handle;
    const slow = textEl.classList.contains("story-stone-words") ? 2 : 1;
    const spans = wrapWords(textEl);
    textEl.classList.add("story-revealing");
    let i = 0;
    let timer = null;
    const finish = () => {
      if (handle.done) return;
      clearTimeout(timer);
      for (const s of spans) s.classList.add("on");
      handle.done = true;
    };
    const step = () => {
      if (i >= spans.length) { handle.done = true; return; }
      const span = spans[i++];
      span.classList.add("on");
      const lastChar = span.textContent.slice(-1);
      timer = setTimeout(step, perWord * slow * (PUNCT_PAUSE[lastChar] || 1));
    };
    handle.done = false;
    handle.finish = finish;
    step();
    return handle;
  }

  function renderScene(dialog) {
    const { scene, index } = dialog;
    const line = scene.lines[index];
    const last = index >= scene.lines.length - 1;
    const header = [scene.title, scene.label].filter(Boolean).map(escapeHtml).join(" · ");
    let body;
    if (line.narration) {
      body = `<div class="story-line story-line-narration"><p class="story-text">${formatText(line.text)}</p></div>`;
    } else if (line.speaker === "stone") {
      body = `<div class="story-line story-line-stone story-side-${speakerSide(scene, index)}">
        ${portraitHtml("stone")}
        <div class="story-body"><div class="story-nameplate"><span class="story-name">The Marchstone</span></div>
        <p class="story-text story-stone-words">${formatText(line.text)}</p></div></div>`;
    } else {
      // Name/title overrides come from story state (a fallen leader's
      // successor -- bible §13), resolved by the engine onto the line.
      const ch = character(line.speaker);
      const name = line.name || ch.name;
      const title = line.title != null ? line.title : ch.title;
      body = `<div class="story-line story-side-${speakerSide(scene, index)}">
        ${portraitHtml(line.speaker, "", line.mood)}
        <div class="story-body">
          <div class="story-nameplate"><span class="story-name">${escapeHtml(name)}</span>${title ? `<span class="story-title">${escapeHtml(title)}</span>` : ""}</div>
          <p class="story-text">${formatText(line.text)}</p>
        </div></div>`;
    }
    // Skip is the corner X (ends the whole scene); Back steps to the
    // previous line and is disabled on the first.
    return `
      <button class="story-close" id="story-skip-btn" title="Skip scene" aria-label="Skip scene">✕</button>
      ${header ? `<div class="story-header">${header}</div>` : ""}
      ${body}
      <div class="story-actions">
        <span class="story-progress">${index + 1} / ${scene.lines.length}</span>
        <button class="menu-dropdown-btn" id="story-back-btn"${index === 0 ? " disabled" : ""}>◂ Back</button>
        <button class="menu-dropdown-btn game-dialog-primary" id="story-next-btn">${last ? "Continue" : "Next ▸"}</button>
      </div>`;
  }

  /** The speaker's short vocalization (js/audio/sfx.js playCharacterVoice)
   *  when a line opens -- only when the speaker changes (or opens the
   *  scene), so a character with several lines in a row grunts once. */
  function voiceLine(dialog) {
    const { scene, index } = dialog;
    const line = scene.lines[index];
    if (!line || line.narration || !line.speaker) return;
    const prev = index > 0 ? scene.lines[index - 1] : null;
    if (prev && !prev.narration && prev.speaker === line.speaker) return;
    playVoice(line.speaker, line.mood);
  }
  function playVoice(speaker, mood) {
    if (window.SfxSystem && window.SfxSystem.playCharacterVoice) window.SfxSystem.playCharacterVoice(speaker, mood);
  }

  function sceneModalClass(dialog) {
    const line = dialog.scene.lines[dialog.index];
    if (line.speaker === "stone") return "techtree-modal game-dialog-modal game-dialog-story story-stone";
    const race = line.narration ? dialog.scene.playerRace : character(line.speaker).race || dialog.scene.playerRace;
    return `techtree-modal game-dialog-modal game-dialog-story race-${race}${line.narration ? " story-narration" : ""}`;
  }

  // ------------------------------------------------------------------ barks

  const BARK_MS = 7000;
  const REPLY_DELAY_MS = 2200;
  let barkQueue = [];
  let barkShowing = false;

  function barkCardHtml(speakerId, text, caption, nameOverride, mood) {
    const ch = character(speakerId);
    const raceClass = ch.race ? `race-${ch.race}` : "story-stone";
    return `<div class="story-bark ${raceClass}" role="status">
      ${portraitHtml(speakerId, "story-portrait-small", mood)}
      <div class="story-bark-body">
        ${caption ? `<div class="story-bark-caption">${formatText(caption)}</div>` : ""}
        <div class="story-bark-name">${escapeHtml(nameOverride || ch.name)}</div>
        <div class="story-bark-text">${formatText(text)}</div>
      </div></div>`;
  }

  function stack() {
    let el = document.getElementById("story-bark-stack");
    if (!el) {
      el = document.createElement("div");
      el.id = "story-bark-stack";
      document.body.appendChild(el);
    }
    return el;
  }

  function mountCard(html) {
    const wrap = document.createElement("div");
    wrap.innerHTML = html.trim();
    const card = wrap.firstChild;
    stack().appendChild(card);
    startReveal(card, { fast: true });
    // Next frame, so the opacity transition actually runs.
    requestAnimationFrame(() => card.classList.add("story-bark-in"));
    setTimeout(() => card.classList.add("story-bark-in"), 50);
    return card;
  }
  function unmountCard(card) {
    card.classList.remove("story-bark-in");
    setTimeout(() => card.remove(), 400);
  }

  let barkToken = 0;

  function showNextBark() {
    if (barkShowing || !barkQueue.length) return;
    barkShowing = true;
    const token = ++barkToken;
    const bark = barkQueue.shift();
    const cards = [mountCard(barkCardHtml(bark.speaker, bark.text, bark.caption, bark.name, bark.mood))];
    playVoice(bark.speaker, bark.mood);
    let total = BARK_MS;
    // A reply may itself carry a reply: a short conversation, each card
    // arriving REPLY_DELAY_MS after the one before (longer lines wait longer).
    let delay = 0;
    let prevText = bark.text;
    for (let r = bark.reply; r; r = r.reply) {
      const reply = r;
      delay += REPLY_DELAY_MS + Math.min(2500, String(prevText).split(/\s+/).length * 60);
      prevText = reply.text;
      setTimeout(() => {
        if (token === barkToken && barkShowing) {
          cards.push(mountCard(barkCardHtml(reply.speaker, reply.text, "", reply.name, reply.mood)));
          playVoice(reply.speaker, reply.mood);
        }
      }, delay);
    }
    total += delay;
    const finish = () => {
      if (!barkShowing || token !== barkToken) return;
      cards.forEach(unmountCard);
      barkShowing = false;
      setTimeout(showNextBark, 450);
    };
    for (const c of cards) c.addEventListener("click", finish);
    stack().onclick = finish;
    // Mobile (2026-09-26, user-directed): no auto-dismiss timer at all -- the
    // bark stays up until tapped. Reading a small on-screen card while also
    // working the touch controls takes longer than the desktop BARK_MS
    // window assumes, and a bark that vanishes on its own before it's been
    // read is just lost. `body.mobile` is main.js's own one-time device
    // detection (detectMobile, coarse pointer + narrow viewport) -- same
    // class every other mobile-specific check in the codebase reads.
    if (!document.body.classList.contains("mobile")) setTimeout(finish, total);
  }

  function showBark(bark) {
    if (!bark) return;
    barkQueue.push(bark);
    showNextBark();
  }

  function clearBarks() {
    barkQueue = [];
    const el = document.getElementById("story-bark-stack");
    if (el) el.innerHTML = "";
    barkShowing = false;
  }

  // ------------------------------------------------------------------ loading

  /** "human/dwarf+orc" -> js/data/story/scenarios/human/dwarf-orc.js */
  function scenarioPath(id) {
    const [player, rivals] = id.split("/");
    return `js/data/story/scenarios/${player}/${rivals.split("+").join("-")}.js`;
  }

  /** Injects one script; always resolves (false when the file is missing). */
  function loadScript(src) {
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve(true);
      s.onerror = () => { s.remove(); resolve(false); };
      document.head.appendChild(s);
    });
  }

  const loadedRacePools = new Set();

  /** Resolves true once the scenario is registered, false if its file is
   *  missing (the story then simply stays quiet for this lineup). Also
   *  loads the player race's shared pair scenes (js/data/story/shared/
   *  <race>.js -- first contact, captures, eliminations and other beats
   *  reused across that race's 15 scenarios). */
  function loadScenario(id) {
    if (!id) return Promise.resolve(false);
    window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};
    const race = id.split("/")[0];
    const portraits = preloadPortraits([race, ...(id.split("/")[1] || "").split("+")]);
    const racePool = loadedRacePools.has(race)
      ? Promise.resolve(true)
      : loadScript(`js/data/story/shared/${race}.js`).then((ok) => { if (ok) loadedRacePools.add(race); return ok; });
    const scenario = window.GameData.STORY_SCENARIOS[id]
      ? Promise.resolve(true)
      : loadScript(scenarioPath(id)).then(() => !!window.GameData.STORY_SCENARIOS[id]);
    return Promise.all([racePool, scenario, portraits]).then(([, ok]) => ok);
  }

  window.UI.story = {
    renderScene, sceneModalClass, voiceLine, showBark, clearBarks, loadScenario, scenarioPath,
    startReveal, getTextSpeed, setTextSpeed, formatText, speakerSide, resolveMood, preloadPortraits,
  };
})();
