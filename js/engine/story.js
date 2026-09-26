/**
 * STORY ENGINE (single player only)
 * ---------------------------------
 * Decides WHICH story scenes and barks play, and WHEN. Pure logic: no DOM,
 * no rendering (js/ui/story.js draws; main.js chains scenes into the
 * existing one-dialog-at-a-time notice queue). See doc/story_bible.md for
 * the design this implements -- §4 (beat skeleton and pacing), §8 (optional
 * event scenes), §8b (barks), §12 (writing rules), §13 (story threads).
 *
 * STATE: everything persistent lives in gameState.story -- plain objects,
 * numbers and strings only, so savegame.js's generic JSON walk round-trips
 * it with no special handling. `null` means the story is off (spectator
 * mode, the Story checkbox unticked, or a lineup with no scenario).
 *
 * EVENTS: engine hook sites (combat.js's recordCombatEvent, ai.js's
 * otherCivRemoveDeadUnit and ability plays, turns.js's pushSignificantEvent)
 * call push() with small JSON records. main.js drains them via pump() --
 * barks come back immediately (they're non-blocking); scene candidates are
 * queued in gameState.story.pending and only shown at the start of the
 * human's turn by nextScenes().
 *
 * SCENE DATA -- two sources, looked up in this order (getSceneDef):
 *   1. window.GameData.STORY_SCENARIOS[id].beats[key]: the lineup's own
 *      scenario file, loaded lazily by js/ui/story.js.
 *   2. window.GameData.STORY_SHARED[playerRace][key], then .any[key]:
 *      thread scenes written once and reused by every scenario they fit
 *      (Kazra's Titan, the bloodline reveal, the witches' feud...).
 * A scene is an array of lines, or { when?, req?, lines, fallback?,
 * fallbackRound? }:
 *   when       eligibility (reqHolds) -- the scene only exists if it holds
 *   req/fallback/fallbackRound  a building-gated guaranteed beat (bible §12
 *              rule 21): `lines` once req holds, `fallback` on fallbackRound
 * Lines:
 *   { n: "narration" }                 parchment box, no portrait
 *   { s: "speakerId", t: "text" }      a character (STORY_CHARACTERS)
 *   { s, t, m: "angry" }               ...with a mood portrait: one of
 *              STORY_MOODS_CORE or the speaker's signature mood; untagged =
 *              "neutral". Text markup: *italic*, **bold**, ***both***
 *   { fx: { kill, title, name, flag, seen } } an effect, applied when the
 *              scene plays (bible §13.13); never shown. `seen` marks other
 *              scene keys as told (and unqueues them); a `req` on an fx line
 *              makes the effect conditional
 *   any line may carry `req` (see reqHolds) + `alt` (used when req fails; a
 *   string keeps the line's kind, speaker and mood), and `posthumous: true` (a
 *   dead character's letter or memory -- otherwise their lines drop out).
 */

window.GameEngine = window.GameEngine || {};

window.GameEngine.story = (function () {
  const PLAYABLE = ["human", "elf", "dwarf", "orc", "halfellow"];

  /** Realm names -- lore names are realms, never cities (bible §12 rule 23). */
  const REALMS = { human: "Westmarch", elf: "the Silverwood", dwarf: "Karrak", orc: "the Bloodmire", halfellow: "the Hearthlands" };

  /** How rivals address the player's leader in barks ({player}). Overridden
   *  when a leader falls (e.g. Sigrun as Thane) via st.address. */
  const LEADER_ADDRESS = { human: "Queen Maren", elf: "Warden Aelthir", dwarf: "Thane Brunna", orc: "Warchief Grukka", halfellow: "Mayor Hobby" };

  /** The Grand Magus (bible §8): a Human Wizard fielded once every one of
   *  these wizard advances is complete. */
  const WIZARD_TECHS = ["wizardry", "freezing_touch", "flight", "arcane_studies", "battle_mage", "teleportation", "fireball", "invulnerability", "invisibility"];
  const ULTIMATE_UNITS = { runeforged_titan: "dwarf", dragon: "orc" };
  const RUNE_TECHS = ["dwarf_runecraft", "dwarf_runeforged_tools", "dwarf_runeforged_armory"];

  /** Buildings whose FIRST construction by the player can open a
   *  `built:<id>` scene (bible §8). Only scenes that exist are ever queued. */
  const SIGNATURE_BUILDINGS = {
    human: ["mage_college", "palace", "guild_hall", "bazaar"],
    elf: ["altar_of_ages", "wellspring_grove", "treetop_watch", "silverleaf_atelier"],
    dwarf: ["great_hall", "deep_forge", "deep_gate", "runewall"],
    orc: ["war_camp", "butchery", "dragon_den", "ancestral_dolmen"],
    halfellow: ["neighborhood_pub", "historical_society", "farmers_market", "armory"],
  };
  /** Every race's shared structures: first build gets a home bark. */
  const COMMON_BUILDINGS = ["wall_section", "bridge_section"];
  /** Relics Skarra covets (2026-09-25, user-directed): she barks whenever
   *  one changes hands -- gloating if the Orcs got it, scheming if not. */
  const SKARRA_COVETS = ["umbral_ring", "mortedamos"];

  /** Optional-scene pacing by number of rivals (bible §4 "Scaling with
   *  lineup size"). */
  const PACING = { 1: { spacing: 8, expiry: 15 }, 2: { spacing: 6, expiry: 18 }, 3: { spacing: 5, expiry: 20 }, 4: { spacing: 4, expiry: 22 } };

  const GUARANTEED = ["B1", "B2", "B3", "B4", "B5", "B6"];
  const BEAT_LABELS = {
    B0: "Opening", N: "Opening", B1: "First Claim", B2: "First Blood", B3: "Rising", B4: "The Stone Stirs",
    B5: "The Rift", B6: "Eve", R: "Not Yet", "E-Held": "Held", "E-Remains": "Remains",
    "E-Fallen": "Fallen", "E-Eclipsed": "Eclipsed",
  };

  // Bark pacing (bible §8b).
  // 2026-09-25, user-directed ("more bark and dialogue -- it's fun"):
  // loosened from 2 / 10 / 6 / 6 / 1/3 / 1/3 / 1/4.
  const BARK_MIN_GAP_ROUNDS = 1;
  const BARK_TRIGGER_COOLDOWN = 5;
  const BARK_DEFER_ROUNDS = 3;         // a poll-born bark waits at most this long for a free round
  const VOICE_CAP = 10;
  const TAUNT_VOICE_GAP_ROUNDS = 4;
  const TAUNT_CHANCE_AFTER_FIRST = 1 / 2;
  const REPLY_CHANCE = 1 / 2;
  const UNIT_WIN_CHANCE = 1 / 3;       // Sigrun & co. commenting on a won fight
  const UNIT_LOST_CHANCE = 1 / 4;      // the player's own people mourning a loss (when no taunt)
  const VAELIS_SCOFF_CHANCE = 1 / 5;   // Vaelis sneering at a non-elf advancement
  const CITY_FALL_CHANCE = 3 / 4;      // the losing kingdom shouting about a city taken or razed
  const GATHER_CHANCE = 1 / 6;         // per gathering unit per round
  const TAUNT_TIER_BY_COUNT = [0, 0, 1, 1, 2, 3];
  const FEUD_GAP_ROUNDS = 10;          // between steps of the witches' feud / Vaelis's whispers
  const ALDRIC_GOLDIE_GAP_ROUNDS = 14; // between Aldric and Goldie's exchanges
  const MAREN_ORDERS_GAP_ROUNDS = 12;  // between Maren's unprompted orders (after maren:resolve)
  const DUEL_CHANCE = 1 / 4;           // per poll, once a duel is possible

  let buffer = [];

  /** Engine hook sites call this with a small JSON record. Never throws,
   *  never touches gameState -- safe to call from anywhere mid-turn. */
  function push(evt) {
    if (buffer.length < 4000) buffer.push(evt);
  }
  function resetBuffer() { buffer = []; }

  // ------------------------------------------------------------------ helpers

  function monsterCivId() { return window.GameConfig.worldEncounters.monsters.civId; }
  function realCivs(gs) { return Object.values(gs.civs).filter((c) => c.id !== monsterCivId()); }
  function civOfRace(gs, race) { return realCivs(gs).find((c) => c.raceId === race) || null; }
  function raceOf(gs, civId) { const c = gs.civs[civId]; return c && c.id !== monsterCivId() ? c.raceId : null; }
  function round(gs) { return gs.turnNumber || 0; }
  function scenarioOf(st) {
    const all = window.GameData.STORY_SCENARIOS || {};
    return st ? all[st.id] || null : null;
  }
  function characters() { return window.GameData.STORY_CHARACTERS || {}; }
  function capitalName(civ) { return civ && civ.cities && civ.cities.length ? civ.cities[0].name : null; }
  function unitLabel(typeId) {
    const u = window.GameData.UNITS && window.GameData.UNITS[typeId];
    return u ? u.label : "soldier";
  }

  /** A scene definition: the scenario's own first, then the shared thread
   *  pools for the player's race, then the pool shared by every race. */
  function getSceneDef(st, key) {
    const sc = scenarioOf(st);
    if (sc && sc.beats && sc.beats[key]) return sc.beats[key];
    const shared = window.GameData.STORY_SHARED || {};
    return (shared[st.playerRace] && shared[st.playerRace][key]) || (shared.any && shared.any[key]) || null;
  }
  function sceneEligible(gs, humanCivId, def) {
    return !!def && (Array.isArray(def) || !def.when || reqHolds(def.when, env(gs, humanCivId, {})));
  }

  function territoryShares(gs) {
    const { counts } = window.GameEngine.influence.countTerritory(gs);
    const target = window.GameEngine.turns.VICTORY_TILE_TARGET || 400;
    const out = {};
    for (const c of realCivs(gs)) out[c.id] = (counts[c.id] || 0) / target;
    return out;
  }

  function cityHas(city, id) {
    const C = window.GameEngine.cities;
    return (C.cityHasStructure && C.cityHasStructure(city, id)) || (city.buildings || []).includes(id);
  }

  const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
    "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  function under100(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? "-" + ONES[n % 10] : ""); }
  /** 4013 -> "four thousand and thirteen"; Oskar reads entry numbers aloud. */
  function numberToWords(n) {
    const th = Math.floor(n / 1000), h = Math.floor((n % 1000) / 100), rest = n % 100;
    const parts = [];
    if (th) parts.push(`${under100(th)} thousand`);
    if (h) parts.push(`${ONES[h]} hundred`);
    let s = parts.join(", ");
    if (rest) s += (s ? " and " : "") + under100(rest);
    return s || "zero";
  }

  // ------------------------------------------------------------------ setup

  function scenarioIdFor(playerRace, rivalRaces) {
    return `${playerRace}/${[...rivalRaces].sort().join("+")}`;
  }

  /** Called once by main.js's startGame, after createNewGame. Leaves
   *  gameState.story null whenever the story can't or shouldn't run. */
  function init(gs, humanCivId, opts = {}) {
    resetBuffer();
    gs.story = null;
    if (!humanCivId || opts.enabled === false) return;
    const human = gs.civs[humanCivId];
    const rivals = realCivs(gs).filter((c) => c.id !== humanCivId).map((c) => c.raceId);
    if (!human || !PLAYABLE.includes(human.raceId) || !rivals.length || rivals.some((r) => !PLAYABLE.includes(r))) return;
    gs.story = {
      id: scenarioIdFor(human.raceId, rivals),
      playerRace: human.raceId,
      rivals: [...rivals].sort(),
      rivalCount: rivals.length,
      territoryDisabledAtStart: !!gs.disableTerritorialVictory,
      seen: {},              // scene key -> round shown
      queued: {},            // scene key -> true once ever queued (queue each key at most once)
      pending: [],           // [{ key, round, ctx }] optional scenes waiting for a slot
      lastBeatRound: -99,
      lastOptionalRound: -99,
      lastSceneRound: -99,
      lastBarkRound: -99,
      barkCooldowns: {},     // trigger key -> round last fired
      voiceCounts: {},       // speaker -> barks so far (rival voice cap)
      voiceLastRound: {},    // speaker -> round of last bark
      usedLines: {},         // pool key -> [indices used]
      pendingBarks: [],      // poll-born barks waiting for a free round: [{ bark, round }]
      grudge: 4012,          // Oskar's Book of Grudges running entry number (bible §8b)
      firstCombat: {},       // rival race -> round of first fight with the player
      firstBloodRace: null,  // the rival B2 First Blood was about
      eliminatedSeen: {},
      ultimateSeen: {},
      relicHolder: {},       // unique item id -> race holding it (or null)
      builtSeen: {},
      dead: {},              // character id -> round they fell (bible §13)
      names: {},             // character id -> overridden nameplate (e.g. "High Thane Sigrun Stonefast")
      titles: {},            // character id -> overridden title
      address: null,         // overrides LEADER_ADDRESS once a leader falls
      counters: {},          // thread counters (feud/whisper steps, militia seen...)
      flags: {},
      lastConqueror: null,   // race that took the player's most recent city
      endingsPlayed: {},
    };
  }

  /** Fills in state fields added after a save was made, so older saves keep
   *  working as the engine grows. */
  function ensureState(st) {
    if (!st) return st;
    for (const k of ["dead", "names", "titles", "counters", "flags", "seen", "queued", "barkCooldowns", "voiceCounts", "voiceLastRound", "usedLines", "firstCombat", "eliminatedSeen", "ultimateSeen", "relicHolder", "builtSeen", "endingsPlayed"]) {
      if (!st[k]) st[k] = {};
    }
    if (!st.pending) st.pending = [];
    if (!st.pendingBarks) st.pendingBarks = [];
    return st;
  }

  // ------------------------------------------------------------------ predicates & tokens

  function env(gs, humanCivId, ctx = {}) {
    return { gs, humanCivId, st: gs.story, ctx };
  }

  function civForSpec(E, spec) {
    return spec === "self" || spec === "player" ? E.gs.civs[E.humanCivId] : civOfRace(E.gs, spec);
  }

  /** Is `race` clearly losing? Holding under half the player's territory, or
   *  already down to its last city. */
  function isLosing(E, race) {
    const civ = civOfRace(E.gs, race);
    if (!civ || civ.eliminated) return true;
    if (civ.cities.length <= 1) return true;
    const shares = E.ctx._shares || (E.ctx._shares = territoryShares(E.gs));
    return (shares[civ.id] || 0) < (shares[E.humanCivId] || 0) * 0.5;
  }

  /** Every key present must hold. Unknown keys fail closed (skip the line)
   *  rather than open, so a typo never plays a line out of context. */
  function reqHolds(req, E) {
    if (!req) return true;
    for (const [k, v] of Object.entries(req)) {
      if (k === "unit" || k === "tech" || k === "building") {
        const [spec, id] = String(v).split(":");
        const civ = civForSpec(E, spec);
        if (!civ || civ.eliminated) return false;
        if (k === "unit" && !civ.units.some((u) => u.typeId === id)) return false;
        if (k === "tech" && !(civ.completedTechs && civ.completedTechs.has(id))) return false;
        if (k === "building" && !civ.cities.some((c) => cityHas(c, id))) return false;
      } else if (k === "alive") {
        // A race, or a list of races that must ALL still stand.
        for (const race of [].concat(v)) {
          const civ = civOfRace(E.gs, race);
          if (!civ || civ.eliminated) return false;
        }
      } else if (k === "dead") {
        for (const race of [].concat(v)) {
          const civ = civOfRace(E.gs, race);
          if (!civ || !civ.eliminated) return false;
        }
      } else if (k === "anyDead") {
        if (![].concat(v).some((race) => { const civ = civOfRace(E.gs, race); return civ && civ.eliminated; })) return false;
      } else if (k === "inGame") {
        for (const race of [].concat(v)) if (!civOfRace(E.gs, race)) return false;
      } else if (k === "notInGame") {
        for (const race of [].concat(v)) if (civOfRace(E.gs, race)) return false;
      } else if (k === "kingdoms") {
        // At least this many kingdoms in the game, player included.
        if (realCivs(E.gs).length < v) return false;
      } else if (k === "cities") {
        if ((E.gs.civs[E.humanCivId].cities || []).length < v) return false;
      } else if (k === "charAlive") {
        for (const id of [].concat(v)) if (E.st.dead[id] != null) return false;
      } else if (k === "charDead") {
        for (const id of [].concat(v)) if (E.st.dead[id] == null) return false;
      } else if (k === "losing") {
        if (!isLosing(E, v)) return false;
      } else if (k === "winner" || k === "conqueror" || k === "firstBlood" || k === "taunter" || k === "holder" || k === "resource") {
        if (E.ctx[k] !== v) return false;
      } else if (k === "seen") {
        if (E.st.seen[v] == null) return false;
      } else if (k === "notSeen") {
        if (E.st.seen[v] != null) return false;
      } else if (k === "flag") {
        if (!E.st.flags[v]) return false;
      } else if (k === "notFlag") {
        if (E.st.flags[v]) return false;
      } else {
        return false;
      }
    }
    return true;
  }

  function fillTokens(text, E) {
    return String(text).replace(/\{([a-zA-Z]+)(?::([a-z]+))?\}/g, (whole, name, arg) => {
      const gs = E.gs;
      const player = gs.civs[E.humanCivId];
      if (name === "capital") {
        const civ = arg ? civOfRace(gs, arg) : player;
        return capitalName(civ) || (civ ? REALMS[civ.raceId] : whole);
      }
      // An advancement's name is always shown in bold (2026-09-26,
      // user-directed) -- js/ui/story.js formatText renders **...**.
      if (name === "tech") return E.ctx.tech != null ? `**${E.ctx.tech}**` : "";
      if (name === "city" || name === "enemyCity" || name === "unit" || name === "enemyUnit" || name === "item"
        || name === "building" || name === "rival") {
        // No event city: fall back to the capital, then the realm (turn 1
        // has no cities at all -- bible §12 rule 23).
        return E.ctx[name] != null ? E.ctx[name] : name === "city" ? (capitalName(player) || REALMS[player.raceId]) : "";
      }
      if (name === "player") return E.st.address || LEADER_ADDRESS[player.raceId] || "Ruler";
      if (name === "realm") return REALMS[arg || player.raceId] || "";
      if (name === "grudge") { E.st.grudge += 1; return numberToWords(E.st.grudge); }
      return whole;
    });
  }

  /** Effect lines (bible §13.13), applied as the scene plays. */
  function applyFx(fx, st) {
    if (fx.kill) for (const id of [].concat(fx.kill)) if (st.dead[id] == null) st.dead[id] = st._round;
    if (fx.flag) for (const f of [].concat(fx.flag)) st.flags[f] = true;
    if (fx.title) Object.assign(st.titles, fx.title);
    if (fx.name) Object.assign(st.names, fx.name);
    if (fx.address) st.address = fx.address;
    // Mark scenes as already told (a beat that folds another scene's
    // reveal into itself), and drop them if they were waiting to play.
    if (fx.seen) for (const k of [].concat(fx.seen)) {
      if (st.seen[k] == null) st.seen[k] = st._round;
      delete st.queued[k];
      st.pending = st.pending.filter((p) => p.key !== k);
    }
  }

  /** Nameplate overrides for a speaker (a fallen leader's successor, etc). */
  function speakerOverrides(st, id) {
    const out = {};
    if (st.names[id]) out.name = st.names[id];
    if (st.titles[id] != null) out.title = st.titles[id];
    return out;
  }

  /** One scene/pool line -> a render-ready line, or null. */
  function resolveLine(line, E) {
    if (line.fx) { if (!line.req || reqHolds(line.req, E)) applyFx(line.fx, E.st); return null; }
    const speakerDead = line.s && E.st.dead[line.s] != null && !line.posthumous;
    if (speakerDead || (line.req && !reqHolds(line.req, E))) {
      if (line.alt == null) return null;
      // A string alt keeps the line's kind (narration stays narration) and,
      // for dialogue, its speaker.
      const alt = typeof line.alt === "string"
        ? (line.n != null ? { n: line.alt } : { s: line.s, t: line.alt, m: line.m, posthumous: line.posthumous })
        : line.alt;
      if (speakerDead && alt.s === line.s && !alt.posthumous) return null;
      return resolveLine(alt, E);
    }
    if (line.n != null) return { narration: true, text: fillTokens(line.n, E) };
    return { speaker: line.s, text: fillTokens(line.t, E), mood: line.m || null, ...speakerOverrides(E.st, line.s) };
  }

  // ------------------------------------------------------------------ scenes

  function buildScene(gs, humanCivId, key, ctx = {}, opts = {}) {
    const st = gs.story;
    const def = getSceneDef(st, key);
    if (!def) return null;
    const E = env(gs, humanCivId, ctx);
    if (!Array.isArray(def) && def.when && !reqHolds(def.when, E)) return null;
    const raw = Array.isArray(def) ? def : (opts.useFallback ? def.fallback : def.lines);
    if (!Array.isArray(raw)) return null;
    st._round = round(gs);
    const lines = raw.map((l) => resolveLine(l, E)).filter(Boolean);
    if (!lines.length) return null;
    const sc = scenarioOf(st);
    return {
      key,
      title: (sc && sc.title) || "",
      label: BEAT_LABELS[key] || opts.label || "",
      playerRace: st.playerRace,
      lines,
    };
  }

  function markSeen(gs, key) {
    const st = gs.story;
    st.seen[key] = round(gs);
    st.lastSceneRound = round(gs);
  }

  /** Default game-state trigger for each guaranteed beat (bible §4). */
  function beatDue(key, snap) {
    const { r, cities, land, anyElim, rivalsLeft, rivalCount, firstCombat } = snap;
    switch (key) {
      case "B1": return cities >= 2 || r >= 10;
      case "B2": return firstCombat || r >= 30;
      case "B3": return land >= 0.25 || r >= 50;
      case "B4": return land >= 0.5 || anyElim || r >= 80;
      case "B5": return land >= 0.6 || r >= 110;
      case "B6": return land >= 0.75 || (rivalCount >= 2 && rivalsLeft === 1) || r >= 140;
      default: return false;
    }
  }

  function snapshot(gs, humanCivId, shares) {
    const st = gs.story;
    const human = gs.civs[humanCivId];
    const rivals = realCivs(gs).filter((c) => c.id !== humanCivId);
    return {
      r: round(gs),
      cities: human.cities.length,
      land: shares[humanCivId] || 0,
      anyElim: rivals.some((c) => c.eliminated),
      rivalsLeft: rivals.filter((c) => !c.eliminated).length,
      rivalCount: st.rivalCount,
      firstCombat: Object.keys(st.firstCombat).length > 0,
    };
  }

  function optionalPriority(key) {
    if (key.startsWith("lovers")) return 1;
    if (key.startsWith("eliminated") || key === "mercy" || key === "bloodline") return 2;
    if (key.startsWith("relic") || key === "maren:resolve" || key.startsWith("rift:")) return 3;
    if (key.startsWith("capture") || key.startsWith("lost") || key.startsWith("rival-vs-rival")
      || key.startsWith("feud") || key.startsWith("whisper") || key.startsWith("faith")) return 4;
    if (key.startsWith("ultimate") || key.startsWith("titan")) return 5;
    return 6;
  }
  /** Scenes that skip the optional budget entirely (bible §4). */
  function skipsBudget(key) {
    // built:* too (2026-09-25, user-directed): a first building should
    // always get its moment, not expire behind other optional scenes.
    // duel:* too (2026-09-26, user-directed): a duel of honour is a major
    // moment, queued rarely and never allowed to expire unplayed.
    return key.startsWith("eliminated:") || key.startsWith("meet:") || key.startsWith("built:") || key.startsWith("duel:")
      || key === "lovers:reveal";
  }

  function enqueue(gs, humanCivId, key, ctx = {}) {
    const st = gs.story;
    if (!st || st.queued[key] || st.seen[key] != null) return false;
    if (!sceneEligible(gs, humanCivId, getSceneDef(st, key))) return false;
    st.queued[key] = true;
    st.pending.push({ key, round: round(gs), ctx });
    return true;
  }

  /** A thread's next step (feud:1 -> feud:2 -> ...), each at least
   *  FEUD_GAP_ROUNDS after the previous one was SEEN. */
  function enqueueChainStep(gs, humanCivId, prefix, max, ctx = {}) {
    const st = gs.story;
    let lastSeen = -Infinity;
    for (let i = 1; i <= max; i++) {
      const key = `${prefix}:${i}`;
      // Steps with no scene for this player (an outside observer may only
      // witness the first and last) are skipped, not waited on.
      if (!sceneEligible(gs, humanCivId, getSceneDef(st, key))) continue;
      if (st.seen[key] != null) { lastSeen = st.seen[key]; continue; }
      if (st.queued[key]) return;
      if (round(gs) - lastSeen < FEUD_GAP_ROUNDS) return;
      enqueue(gs, humanCivId, key, ctx);
      return;
    }
  }

  /** Polls game state once per human turn start and queues any newly-true
   *  optional scene triggers, plus poll-born barks (storms, forests...). */
  function pollState(gs, humanCivId, shares) {
    const st = gs.story;
    const human = gs.civs[humanCivId];
    const civs = realCivs(gs);
    const q = (key, ctx) => enqueue(gs, humanCivId, key, ctx);

    for (const c of civs) {
      if (c.id === humanCivId) continue;
      if (c.eliminated && !st.eliminatedSeen[c.raceId]) {
        st.eliminatedSeen[c.raceId] = round(gs);
        q(`eliminated:${c.raceId}`);
      }
      const share = shares[c.id] || 0;
      if (!c.eliminated && share >= 0.75) q(`W:${c.raceId}`);
    }

    // Ultimates: first Titan / Dragon on the map, first Grand Magus.
    for (const c of civs) {
      if (c.eliminated) continue;
      for (const u of c.units) {
        const race = ULTIMATE_UNITS[u.typeId];
        if (race && race === c.raceId && !st.ultimateSeen[race]) {
          st.ultimateSeen[race] = round(gs);
          q(`ultimate:${race}`);
        }
      }
      if (c.raceId === "human" && !st.ultimateSeen.human
        && WIZARD_TECHS.every((t) => c.completedTechs && c.completedTechs.has(t))
        && c.units.some((u) => u.typeId === "wizard")) {
        st.ultimateSeen.human = round(gs);
        q("ultimate:human");
      }
    }

    // Relics: who holds each unique item now vs. last poll.
    const defs = window.GameData.ITEMS || {};
    const holderNow = {};
    for (const c of civs) {
      if (c.eliminated) continue;
      for (const u of c.units) {
        for (const id of Object.keys(window.GameEngine.items.itemsOf(u))) {
          if (defs[id] && defs[id].unique) holderNow[id] = c.raceId;
        }
      }
    }
    for (const [id, race] of Object.entries(holderNow)) {
      if (st.relicHolder[id] === race) continue;
      st.relicHolder[id] = race;
      const ctx = { item: defs[id].label, holder: race };
      if (race === st.playerRace) {
        q(`relic:found:${id}`, ctx);
        // Kazra studies any relic for her Titan (bible §13.4).
        if (st.playerRace === "dwarf") q("titan:relic", ctx);
      } else {
        q(`relic:news:${id}`, ctx);
      }
      if (SKARRA_COVETS.includes(id) && speakerAvailable(gs, "skarra")) {
        const B = window.GameData.STORY_BARKS;
        const pool = B && B.skarraCovets && B.skarraCovets[`${race === "orc" ? "got" : "lost"}:${id}`];
        queueBark(gs, humanCivId, poolBark(gs, humanCivId, pool, `covet:${race === "orc" ? "got" : "lost"}:${id}`,
          ctx, { triggerKey: null, force: true, recycle: true }));
      }
    }

    // The player's first copy of each building type: its `built:<id>` scene
    // where one exists (signature buildings), otherwise a home bark from
    // `home["built:<id>"]` (walls, bridges). One bark per poll; any other
    // new building waits for the next round, so they don't pile up.
    let builtBarked = false;
    for (const b of [...(SIGNATURE_BUILDINGS[st.playerRace] || []), ...COMMON_BUILDINGS]) {
      if (st.builtSeen[b]) continue;
      const city = human.cities.find((c) => cityHas(c, b));
      if (!city) continue;
      const def = (window.GameData.BUILDINGS || {})[b];
      const ctx = { city: city.name, building: def ? def.label : b };
      if (getSceneDef(st, `built:${b}`)) {
        st.builtSeen[b] = round(gs);
        q(`built:${b}`, ctx);
        if (b === "runewall") q("titan:wall", ctx);
        continue;
      }
      if (builtBarked) continue;
      // A forced bark in a scene round is deferred into pendingBarks by
      // poolBark itself (and comes back null), so count the queue too.
      const queued = st.pendingBarks.length;
      const bark = homeBark(gs, humanCivId, `built:${b}`, ctx, { force: true });
      st.builtSeen[b] = round(gs);
      if (bark) queueBark(gs, humanCivId, bark);
      if (st.pendingBarks.length > queued) builtBarked = true;
    }

    // Kazra's Titan chain: rune technologies (bible §13.4).
    if (st.playerRace === "dwarf" && human.completedTechs) {
      if (RUNE_TECHS.some((t) => human.completedTechs.has(t))) q("titan:runes");
      if (human.completedTechs.has("dwarf_runeforged_titan")) q("titan:tech");
    }

    if (human.cities.length >= 3) q("found:3", { city: human.cities[human.cities.length - 1].name });
    if (human.cities.length >= 6) q("found:6", { city: human.cities[human.cities.length - 1].name });

    const techs = window.GameData.TECHS || {};
    if (human.completedTechs && [...human.completedTechs].some((t) => techs[t] && techs[t].layer === 3)) q("tech:tier3");

    // An enemy unit next to the capital.
    const cap = human.cities[0];
    if (cap && !st.queued["capital-threat"] && getSceneDef(st, "capital-threat")) {
      const cheb = window.GameEngine.influence.chebyshev;
      const threat = civs.some((c) => c.id !== humanCivId && !c.eliminated && c.units.some((u) => cheb(u.x, u.y, cap.x, cap.y) <= 1));
      if (threat) q("capital-threat");
    }

    // First Treasure Trow sighting (the Trow itself never speaks -- bible §8).
    if (!st.queued["trow:first"] && getSceneDef(st, "trow:first")) {
      const monsters = gs.civs[monsterCivId()];
      const vis = gs.visibility && gs.visibility[humanCivId];
      const w = gs.map.width;
      if (monsters && vis && monsters.units.some((u) => u.typeId === "treasure_trow" && vis.has(u.y * w + u.x))) q("trow:first");
    }

    // First contact with each rival after the first (the first is B2).
    for (const race of Object.keys(st.firstCombat)) {
      if (race !== st.firstBloodRace) q(`meet:${race}`);
    }
    if (st.flags.dwarfOrcCombat) q("lovers:meet");
    if (st.flags.humanElfCombat) q("bloodline");
    // Aelthir's mercy waits for the bloodline to be revealed (its `when`).
    if (st.flags.elfTookHuman) q("mercy", { city: st.counters.mercyCity, enemyCity: st.counters.mercyCity });
    if (st.flags.elfOrcCombat) enqueueChainStep(gs, humanCivId, "feud", 3);

    // 2026-09-26, user-directed threads:
    // Maren stops refereeing and starts leading (a few rounds after First Blood).
    if (st.playerRace === "human" && st.seen.B2 != null && round(gs) - st.seen.B2 >= 3) q("maren:resolve");
    // …and from then on she moves first, now and then, unprompted.
    if (st.playerRace === "human" && st.seen["maren:resolve"] != null
      && round(gs) - (st.counters.marenOrdersRound ?? st.seen["maren:resolve"]) >= MAREN_ORDERS_GAP_ROUNDS && Math.random() < 0.5) {
      const bark = homeBark(gs, humanCivId, "marenOrders", {});
      if (bark) { st.counters.marenOrdersRound = round(gs); queueBark(gs, humanCivId, bark); }
    }
    // Aldric's faith, vindicated: two steps once the war is under way.
    if (st.playerRace === "human" && st.seen.B2 != null && st.dead.aldric == null) enqueueChainStep(gs, humanCivId, "faith", 2);
    // The first blood between Westmarch and the Hearthlands, as Aldric and
    // Goldie feel it (each kingdom's own side of it).
    if (st.flags.humanHalfellowCombat && (st.playerRace === "human" || st.playerRace === "halfellow")) q("rift:aldric-goldie");
    // Aldric and Goldie's running exchange: friendly, until their peoples
    // have fought; hurt and angry after.
    if ((st.playerRace === "human" || st.playerRace === "halfellow")
      && civOfRace(gs, "human") && civOfRace(gs, "halfellow")
      && speakerAvailable(gs, "aldric") && speakerAvailable(gs, "goldie")
      && round(gs) - (st.counters.aldricGoldieRound ?? -99) >= ALDRIC_GOLDIE_GAP_ROUNDS && Math.random() < 0.5) {
      const bark = worldBark(gs, humanCivId, st.flags.humanHalfellowCombat ? "aldricGoldieSour" : "aldricGoldieFriendly", {});
      if (bark) { st.counters.aldricGoldieRound = round(gs); queueBark(gs, humanCivId, bark); }
    }
    // Duels of honour, later in the war (after the arc's midpoint): the
    // player's leader and a rival's champion. Each champion fights only one
    // duel (2026-09-26, user-directed), and the player's own champion is in
    // every one, so a game gets at most ONE duel, however many kingdoms.
    if (st.seen.B4 != null && st.counters.duelRound == null && Math.random() < DUEL_CHANCE) {
      const rivals = st.rivals.filter((race) => st.firstCombat[race] != null)
        .sort(() => Math.random() - 0.5);
      for (const race of rivals) {
        const civ = civOfRace(gs, race);
        if (!civ || civ.eliminated) continue;
        if (q(`duel:${[st.playerRace, race].sort().join(":")}`)) { st.counters.duelRound = round(gs); break; }
      }
    }

    // Poll-born barks.
    const weather = window.GameEngine.turns.currentWeather ? window.GameEngine.turns.currentWeather(gs) : null;
    const storming = !!(weather && weather.storming);
    if (storming && !st.flags.wasStorming) queueBark(gs, humanCivId, worldBark(gs, humanCivId, "storm", {}));
    st.flags.wasStorming = storming;

    if (st.playerRace === "elf" && !st.flags.oaks3 && human.units.filter((u) => u.typeId === "awakened_oak").length >= 3) {
      st.flags.oaks3 = true;
      queueBark(gs, humanCivId, homeBark(gs, humanCivId, "oaks3", {}));
    }
    if (st.playerRace === "halfellow" && st.dead.goldie != null) {
      const militia = human.units.filter((u) => u.typeId === "militia").length;
      if (militia > (st.counters.militia || 0)) queueBark(gs, humanCivId, homeBark(gs, humanCivId, "militiaGoldie", {}));
      st.counters.militia = militia;
    }
  }

  /**
   * Called at the start of the human's turn (main.js's finishRoundBookkeeping
   * chain, and once at game start for the Opening). Returns the scenes to
   * play now, in order: at most one guaranteed beat, any budget-skipping
   * scenes, then at most one budgeted optional scene. Marks them seen.
   */
  function nextScenes(gs, humanCivId) {
    const st = gs.story;
    ensureState(st);
    if (!st || !scenarioOf(st) || st.hidden) return [];
    const r = round(gs);
    const out = [];
    const take = (key, ctx, opts) => {
      const scene = buildScene(gs, humanCivId, key, ctx, opts);
      markSeen(gs, key);
      if (scene) { out.push(scene); logScene(gs, scene); }
      return scene;
    };

    if (st.seen.B0 == null) {
      take("B0");
      if (st.territoryDisabledAtStart && getSceneDef(st, "N")) take("N");
      st.lastBeatRound = r;
      return out;
    }

    const shares = territoryShares(gs);
    pollState(gs, humanCivId, shares);

    let guaranteedThisRound = false;

    if (st.flags.refused && st.seen.R == null && getSceneDef(st, "R")) {
      take("R");
      st.lastBeatRound = r;
      guaranteedThisRound = true;
    }

    const nextKey = GUARANTEED.find((k) => st.seen[k] == null);
    if (!guaranteedThisRound && nextKey && r > st.lastBeatRound) {
      const snap = snapshot(gs, humanCivId, shares);
      const raw = getSceneDef(st, nextKey);
      let play = null;
      if (beatDue(nextKey, snap)) {
        const ctx = {};
        if (nextKey === "B1" && gs.civs[humanCivId].cities.length >= 2) ctx.city = gs.civs[humanCivId].cities[1].name;
        if (nextKey === "B2") ctx.firstBlood = st.firstBloodRace;
        if (st.lastConqueror) ctx.conqueror = st.lastConqueror;
        if (raw && !Array.isArray(raw) && raw.req) {
          if (reqHolds(raw.req, env(gs, humanCivId, ctx))) play = { ctx };
          else if (r >= (raw.fallbackRound || 0)) play = { ctx, useFallback: true };
        } else {
          play = { ctx };
        }
      }
      if (play) {
        take(nextKey, play.ctx, { useFallback: play.useFallback });
        st.lastBeatRound = r;
        guaranteedThisRound = true;
      }
    }

    const pace = PACING[Math.min(4, Math.max(1, st.rivalCount))];
    st.pending = st.pending.filter((p) => skipsBudget(p.key) || r - p.round <= pace.expiry);
    for (const p of st.pending.filter((q) => skipsBudget(q.key))) take(p.key, p.ctx);
    st.pending = st.pending.filter((p) => !skipsBudget(p.key));

    if (!guaranteedThisRound && st.pending.length && r - st.lastOptionalRound >= pace.spacing) {
      st.pending.sort((a, b) => optionalPriority(a.key) - optionalPriority(b.key) || a.round - b.round);
      const p = st.pending.shift();
      if (take(p.key, p.ctx)) st.lastOptionalRound = r;
    }
    return out;
  }

  /** The ending scene for this game's outcome, played at most once each. */
  function endingScene(gs, humanCivId, kind, info = {}) {
    const st = gs.story;
    ensureState(st);
    if (!st || st.hidden || st.endingsPlayed[kind]) return null;
    st.endingsPlayed[kind] = round(gs);
    const ctx = {
      winner: info.winnerCivId ? raceOf(gs, info.winnerCivId) : undefined,
      conqueror: st.lastConqueror || undefined,
    };
    const scene = buildScene(gs, humanCivId, kind, ctx);
    markSeen(gs, kind);
    if (scene) logScene(gs, scene);
    return scene;
  }

  // ------------------------------------------------------------------ replay

  const RACE_PLURAL = { human: "Westmarch", elf: "the Elves", dwarf: "the Dwarves", orc: "the Orcs", halfellow: "the Halfellows" };
  /** A readable name for a scene key, for the Interface menu's replay list. */
  function sceneDisplayName(key, label) {
    if (label) return label;
    const [kind, a, b] = key.split(":");
    const race = (r) => RACE_PLURAL[r] || r;
    const building = (id) => ((window.GameData.BUILDINGS || {})[id] || {}).label || id;
    const item = (id) => ((window.GameData.ITEMS || {})[id] || {}).label || id;
    switch (kind) {
      case "N": case "R": return "The Stone's Answer";
      case "meet": return `First Contact: ${race(a)}`;
      case "capture": return `A City Taken from ${race(a)}`;
      case "lost": return `A City Lost to ${race(a)}`;
      case "eliminated": return `The Fall of ${race(a)}`;
      case "rival-vs-rival": return `${race(a)} against ${race(b)}`;
      case "built": return `First ${building(a)}`;
      case "relic": return a === "found" ? `Relic Found: ${item(b)}` : `Relic News: ${item(b)}`;
      case "ultimate": return `A Legend Takes the Field (${race(a)})`;
      case "lovers": return "The Lovers";
      case "feud": return "The Witches' Feud";
      case "whisper": return "The Whispering War";
      case "titan": return "Kazra's Titan";
      case "trow": return "The Treasure Trow";
      case "found": return `The ${a === "3" ? "Third" : "Sixth"} City`;
      case "tech": return "New Learning";
      case "duel": return `A Duel of Honour: ${race(a)} and ${race(b)}`;
      case "faith": return a === "1" ? "The Fever Vigil" : "The Wards That Failed";
      case "maren": return "The Queen's Resolve";
      case "rift": return "The Lord-Paladin and the Innkeeper";
      case "capital-threat": return "The Capital Threatened";
      case "E-Held": case "E-Remains": case "E-Fallen": case "E-Eclipsed": return "The Ending";
      default: return kind.charAt(0).toUpperCase() + kind.slice(1);
    }
  }
  /** Every scene the player has seen this game, kept (already resolved) so
   *  the Interface menu can replay it -- see main.js's openStoryReplay. */
  function logScene(gs, scene) {
    const st = gs.story;
    if (!st.log) st.log = [];
    st.log.push({ key: scene.key, round: round(gs), name: sceneDisplayName(scene.key, scene.label), scene });
  }
  function getLog(gs) { return (gs && gs.story && gs.story.log) || []; }
  /** Interface menu "Show Story": hidden, no scenes or barks play (the
   *  story state keeps tracking the war, so it can pick up again). */
  function setHidden(gs, hidden) { if (gs && gs.story) gs.story.hidden = !!hidden; }
  function isHidden(gs) { return !!(gs && gs.story && gs.story.hidden); }

  function noteRefusal(gs) {
    if (gs.story) gs.story.flags.refused = true;
  }

  // ------------------------------------------------------------------ barks

  /** Can this speaker talk right now? Alive in the story, and their kingdom
   *  is in the game and standing (the Marchstone can always speak). */
  function speakerAvailable(gs, speaker) {
    const st = gs.story;
    if (st.dead[speaker] != null) return false;
    const ch = characters()[speaker];
    if (!ch) return false;
    if (!ch.race) return true;
    const civ = civOfRace(gs, ch.race);
    return !!civ && !civ.eliminated;
  }

  /** `recycle`: once every fitting line has been used, start over rather
   *  than go quiet (for pools that fire all game long, like advancements). */
  function pickFromPool(gs, poolKey, lines, E, extraFilter, { recycle = false } = {}) {
    const st = gs.story;
    const used = st.usedLines[poolKey] || (st.usedLines[poolKey] = []);
    const fits = ({ l }) => speakerAvailable(gs, l.s) && reqHolds(l.req, E) && (!extraFilter || extraFilter(l));
    const all = lines.map((l, i) => ({ l, i }));
    let candidates = all.filter((c) => !used.includes(c.i) && fits(c));
    if (!candidates.length && recycle) {
      const fitting = all.filter(fits);
      st.usedLines[poolKey] = used.filter((i) => !fitting.some((c) => c.i === i));
      return pickFromPool(gs, poolKey, lines, E, extraFilter);
    }
    if (!candidates.length) return null;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    used.push(pick.i);
    return pick.l;
  }

  function barkAllowed(st, r, triggerKey, { bypassGap = false } = {}) {
    if (r === st.lastSceneRound) return false;
    if (!bypassGap && r - st.lastBarkRound < BARK_MIN_GAP_ROUNDS) return false;
    if (r === st.lastBarkRound) return false;
    if (triggerKey && st.barkCooldowns[triggerKey] != null && r - st.barkCooldowns[triggerKey] < BARK_TRIGGER_COOLDOWN) return false;
    return true;
  }

  /** A pool line may carry `then: [{s, t, m?, req?}, ...]` -- a short
   *  conversation. Each follow-up becomes the previous card's `reply`; the
   *  chain stops at the first line whose speaker can't talk right now. */
  function toBark(st, line, caption, E) {
    const bark = { caption: caption ? fillTokens(caption, E) : "", speaker: line.s, text: fillTokens(line.t, E), mood: line.m || null, ...speakerOverrides(st, line.s) };
    let tail = bark;
    for (const f of line.then || []) {
      if (!speakerAvailable(E.gs, f.s) || !reqHolds(f.req, E)) break;
      tail = tail.reply = { speaker: f.s, text: fillTokens(f.t, E), mood: f.m || null, ...speakerOverrides(st, f.s) };
    }
    return bark;
  }

  function recordBark(st, r, triggerKey, speaker) {
    st.lastBarkRound = r;
    if (triggerKey) st.barkCooldowns[triggerKey] = r;
    st.voiceCounts[speaker] = (st.voiceCounts[speaker] || 0) + 1;
    st.voiceLastRound[speaker] = r;
  }

  /** A bark from a pool, checked against pacing and recorded. `force`
   *  skips the pacing checks (events that should ALWAYS get a line: first
   *  buildings, advancements, a city falling) -- it still never talks over
   *  a scene: in a scene round the bark is deferred via pendingBarks.
   *  `noDefer` skips that scene-round deferral, for barks main.js holds
   *  back itself (advancements wait for their own "complete" window).
   *  `prefer(line)` > 0 picks from the best-scoring lines first. */
  function poolBark(gs, humanCivId, pool, poolKey, ctx, { triggerKey = poolKey, filter, cap = false, force = false, recycle = false, prefer, noDefer = false } = {}) {
    const st = gs.story;
    if (!pool) return null;
    const r = round(gs);
    if (!force && !barkAllowed(st, r, triggerKey)) return null;
    const E = env(gs, humanCivId, ctx);
    const base = (l) => (!cap || (st.voiceCounts[l.s] || 0) < VOICE_CAP) && (!filter || filter(l));
    let line = null;
    if (prefer) {
      const scores = [...new Set(pool.lines.map(prefer))].filter((s) => s > 0).sort((a, b) => b - a);
      for (const s of scores) {
        line = pickFromPool(gs, `${poolKey}#${s}`, pool.lines, E, (l) => base(l) && prefer(l) === s, { recycle });
        if (line) break;
      }
    }
    if (!line) line = pickFromPool(gs, poolKey, pool.lines, E, base, { recycle });
    if (!line) return null;
    recordBark(st, r, triggerKey, line.s);
    const bark = toBark(st, line, pool.caption, E);
    if (force && !noDefer && r === st.lastSceneRound) { queueBark(gs, humanCivId, bark); return null; }
    return bark;
  }

  /** The player's own kingdom reacting to its own play (bible §8b home
   *  moments) -- only the player's own characters speak. */
  function homeBark(gs, humanCivId, trigger, ctx, opts = {}) {
    const B = window.GameData.STORY_BARKS;
    const pool = B && B.home && B.home[trigger];
    const race = gs.story.playerRace;
    return poolBark(gs, humanCivId, pool, `home:${trigger}`, ctx, {
      ...opts,
      filter: (l) => (characters()[l.s] || {}).race === race && (!opts.filter || opts.filter(l)),
    });
  }

  /** Anyone present may speak (storms, the witches' feud gloats). */
  function worldBark(gs, humanCivId, trigger, ctx) {
    const B = window.GameData.STORY_BARKS;
    return poolBark(gs, humanCivId, B && B.world && B.world[trigger], `world:${trigger}`, ctx);
  }

  function rivalBark(gs, humanCivId, key, ctx, opts = {}) {
    const B = window.GameData.STORY_BARKS;
    return poolBark(gs, humanCivId, B && B.rival && B.rival[key], key, ctx, { cap: true, ...opts });
  }

  /** An advancement's name for a line of dialogue: labels like "Fireball!"
   *  lose their trailing punctuation so "{tech}." reads cleanly. */
  function techLabel(tech) { return String(tech.label).replace(/[!.?]+$/, ""); }

  /** Vaelis sneering at someone else's advancement: `who` is "player" (a
   *  rival's jab at the player) or "rival" (the elf player's own heir
   *  scoffing at another kingdom). Paced by its own trigger cooldown. */
  function vaelisScoff(gs, humanCivId, who, ctx) {
    if (!speakerAvailable(gs, "vaelis")) return null;
    const B = window.GameData.STORY_BARKS;
    const pool = B && B.vaelisScoffs && B.vaelisScoffs[who];
    return poolBark(gs, humanCivId, pool, `vaelisScoff:${who}`, ctx, { triggerKey: "vaelisScoff", recycle: true, force: who === "player", noDefer: who === "player" });
  }

  /** Every advancement the player makes gets a line (2026-09-25,
   *  user-directed): the advance pool's lines for this exact tech first,
   *  else any line for its category or none -- sometimes a short
   *  conversation (`then`). */
  function advanceBark(gs, humanCivId, techId) {
    const tech = (window.GameData.TECHS || {})[techId];
    if (!tech) return null;
    const B = window.GameData.STORY_BARKS;
    const pool = B && B.advance && B.advance[gs.story.playerRace];
    return poolBark(gs, humanCivId, pool, `advance:${gs.story.playerRace}`, { tech: techLabel(tech) }, {
      triggerKey: null, force: true, recycle: true, noDefer: true,
      filter: (l) => (!l.techs || l.techs.includes(techId)) && (!l.cat || l.cat === tech.category),
      prefer: (l) => (l.techs ? 1 : 0),
    });
  }

  /** Poll-born barks (produced at turn start, when a scene may be showing)
   *  wait up to BARK_DEFER_ROUNDS for a free round. poolBark already
   *  recorded pacing; this only defers the DISPLAY. */
  function queueBark(gs, humanCivId, bark) {
    if (bark) gs.story.pendingBarks.push({ bark, round: round(gs) });
  }

  /** A rival kingdom killed one of the player's units: maybe a taunt. */
  function tryTaunt(gs, humanCivId, killerRace, ctx) {
    const st = gs.story;
    const B = window.GameData.STORY_BARKS;
    const def = B && B.taunts && B.taunts[killerRace];
    if (!def) return null;
    const voice = killerRace === "orc" ? "skarra" : "vaelis";
    if (!speakerAvailable(gs, voice)) return null;
    const count = st.voiceCounts[voice] || 0;
    if (count >= VOICE_CAP) return null;
    const r = round(gs);
    const first = count === 0;
    if (!first) {
      if (r - (st.voiceLastRound[voice] || -99) < TAUNT_VOICE_GAP_ROUNDS) return null;
      if (Math.random() >= TAUNT_CHANCE_AFTER_FIRST) return null;
    }
    if (!barkAllowed(st, r, null, { bypassGap: first })) return null;
    const tier = TAUNT_TIER_BY_COUNT[Math.min(count, TAUNT_TIER_BY_COUNT.length - 1)];
    const E = env(gs, humanCivId, ctx);
    let line = null;
    for (let t = tier; t >= 0 && !line; t--) line = pickFromPool(gs, `taunt:${killerRace}:${t}`, def.tiers[t], E);
    if (!line) return null;
    recordBark(st, r, null, voice);
    const bark = toBark(st, line, def.caption, E);
    if (Math.random() < REPLY_CHANCE) {
      const replies = (B.replies && B.replies[st.playerRace]) || [];
      const reply = pickFromPool(gs, `reply:${st.playerRace}`, replies, env(gs, humanCivId, { ...ctx, taunter: line.s }));
      if (reply) bark.reply = { speaker: reply.s, text: fillTokens(reply.t, E), mood: reply.m || null, ...speakerOverrides(st, reply.s) };
    }
    return bark;
  }

  function tauntDefs() {
    const B = window.GameData.STORY_BARKS;
    return (B && B.taunts) || {};
  }

  function tileOwnerCivId(gs, x, y) {
    if (x == null || y == null || !gs.map) return null;
    for (const c of Object.values(gs.civs)) {
      if (c.cities.some((city) => city.x === x && city.y === y)) return c.id;
    }
    const t = gs.map.tiles[y * gs.map.width + x];
    return t ? t.ownerCivId || null : null;
  }

  function flagPair(st, races, a, b, flag, r) {
    if (races.includes(a) && races.includes(b)) st.flags[flag] = true;
  }

  /**
   * Drains buffered engine events into story state. Returns barks to show
   * right away (non-blocking); scene candidates are queued for nextScenes.
   * Cheap when nothing happened -- main.js calls this on every redraw().
   */
  function pump(gs, humanCivId) {
    const barks = pumpEvents(gs, humanCivId);
    return isHidden(gs) ? [] : barks;
  }

  function pumpEvents(gs, humanCivId) {
    const st = gs && gs.story;
    ensureState(st);
    if (!st || !humanCivId || !gs.civs[humanCivId]) { buffer = []; return []; }
    const r = round(gs);
    const barks = [];

    // Deferred poll-born barks first (storms, oaks...), once a round is free.
    if (st.pendingBarks.length && r !== st.lastSceneRound) {
      for (const p of st.pendingBarks) if (r - p.round <= BARK_DEFER_ROUNDS) barks.push(p.bark);
      st.pendingBarks = [];
    }
    if (!buffer.length) return barks;
    const events = buffer;
    buffer = [];
    const monsters = monsterCivId();

    for (const evt of events) {
      if (evt.type === "combat") {
        const atk = evt.atkCivId;
        const def = evt.defCivId || tileOwnerCivId(gs, evt.dx, evt.dy);
        if (!atk || !def || atk === def || atk === monsters || def === monsters) continue;
        const races = [raceOf(gs, atk), raceOf(gs, def)];
        if (atk === humanCivId || def === humanCivId) {
          const other = atk === humanCivId ? races[1] : races[0];
          if (other && st.firstCombat[other] == null) {
            st.firstCombat[other] = r;
            if (!st.firstBloodRace) st.firstBloodRace = other;
          }
        }
        flagPair(st, races, "dwarf", "orc", "dwarfOrcCombat", r);
        flagPair(st, races, "human", "elf", "humanElfCombat", r);
        flagPair(st, races, "human", "halfellow", "humanHalfellowCombat", r);
        if (races.includes("elf") && races.includes("orc")) st.flags.elfOrcCombat = true;
      } else if (evt.type === "unitKilled") {
        const victim = evt.victimCivId, killer = evt.killerCivId;
        if (!victim || !killer || killer === monsters || victim === monsters) continue;
        const killerRace = raceOf(gs, killer), victimRace = raceOf(gs, victim);
        let bark = null;
        // The witches' feud (bible §13.3): the other witch gloats when a
        // Bog Witch falls to elves, or a Druid to orcs -- whoever's army.
        if (evt.victimTypeId === "bog_witch" && killerRace === "elf") bark = worldBark(gs, humanCivId, "feudYsolde", {});
        else if (evt.victimTypeId === "druid" && killerRace === "orc") bark = worldBark(gs, humanCivId, "feudSkarra", {});
        if (!bark && victim === humanCivId && killerRace && killerRace !== st.playerRace) {
          const ctx = { unit: unitLabel(evt.victimTypeId) };
          bark = tryTaunt(gs, humanCivId, killerRace, ctx);
          // Kingdoms without a taunting voice (Dwarves, Humans, Halfellows)
          // still speak up now and then from rival["killedYours:<race>"].
          if (!bark && !(tauntDefs()[killerRace]) && Math.random() < UNIT_WIN_CHANCE) bark = rivalBark(gs, humanCivId, `killedYours:${killerRace}`, ctx);
          if (!bark && Math.random() < UNIT_LOST_CHANCE) bark = homeBark(gs, humanCivId, "unitLost", ctx);
        } else if (!bark && killer === humanCivId && victimRace) {
          if (evt.victimTypeId === "bog_witch" && !st.flags.bogwitchCursed) {
            const B = window.GameData.STORY_BARKS;
            if (B && B.bogwitchCurse && r !== st.lastSceneRound && speakerAvailable(gs, "skarra")) {
              st.flags.bogwitchCursed = true;
              bark = poolBark(gs, humanCivId, B.bogwitchCurse, "bogwitchCurse", {}, { triggerKey: null });
            }
          }
          if (!bark) bark = rivalBark(gs, humanCivId, `killed:${victimRace}`, { enemyUnit: unitLabel(evt.victimTypeId) });
          if (!bark && Math.random() < UNIT_WIN_CHANCE) bark = homeBark(gs, humanCivId, "unitWin", { enemyUnit: unitLabel(evt.victimTypeId) });
        }
        if (bark) barks.push(bark);
      } else if (evt.type === "world" && evt.kind === "cityCaptured") {
        const from = evt.civId, to = evt.capturedByCivId;
        const fromRace = raceOf(gs, from), toRace = raceOf(gs, to);
        if (!fromRace || !toRace) continue;
        let bark = null;
        const cityFall = Math.random() < CITY_FALL_CHANCE ? { force: true } : {};
        if (from === humanCivId) {
          st.lastConqueror = toRace;
          enqueue(gs, humanCivId, `lost:${toRace}`, { city: evt.cityName });
          bark = rivalBark(gs, humanCivId, `tookCity:${toRace}`, { city: evt.cityName }, cityFall);
        } else if (to === humanCivId) {
          enqueue(gs, humanCivId, `capture:${fromRace}`, { enemyCity: evt.cityName });
          bark = rivalBark(gs, humanCivId, `lostCity:${fromRace}`, { city: evt.cityName }, cityFall);
        } else {
          enqueue(gs, humanCivId, `rival-vs-rival:${toRace}:${fromRace}`, { enemyCity: evt.cityName });
          // Vaelis's Whispering War (bible §13.10): two NON-elf kingdoms
          // fighting, in a game the Elves are part of.
          if (fromRace !== "elf" && toRace !== "elf" && civOfRace(gs, "elf")) {
            enqueueChainStep(gs, humanCivId, "whisper", 2, { enemyCity: evt.cityName });
          }
        }
        // Aelthir's mercy (bible §13.2): the Elves take a Human city.
        if (toRace === "elf" && fromRace === "human" && !st.flags.elfTookHuman) {
          st.flags.elfTookHuman = true;
          st.counters.mercyCity = evt.cityName;
        }
        if (bark) barks.push(bark);
      } else if (evt.type === "world" && evt.kind === "cityDestroyed") {
        // A city razed. For the player's own raze (main.js) the city was
        // captured first, so civId is the player and formerOwnerCivId the
        // kingdom that lost it; an AI raze passes the victim as civId.
        const victim = evt.formerOwnerCivId || evt.civId, razer = evt.razedByCivId;
        const victimRace = raceOf(gs, victim), razerRace = raceOf(gs, razer);
        if (!victimRace || !razerRace || victim === razer) continue;
        let bark = null;
        if (razer === humanCivId) {
          // The kingdom that lost it swears vengeance.
          if (Math.random() < CITY_FALL_CHANCE) bark = rivalBark(gs, humanCivId, `razed:${victimRace}`, { city: evt.cityName }, { force: true });
        } else if (victim === humanCivId) {
          bark = rivalBark(gs, humanCivId, `razedYours:${razerRace}`, { city: evt.cityName }, { force: true });
          const grief = homeBark(gs, humanCivId, "cityRazed", { city: evt.cityName }, { force: true });
          if (bark && grief) { let t = bark; while (t.reply) t = t.reply; t.reply = { ...grief, caption: "" }; }
          else bark = bark || grief;
        }
        if (bark) barks.push(bark);
      } else if (evt.type === "world" && evt.kind === "advancement") {
        const tech = (window.GameData.TECHS || {})[evt.techId];
        const advRace = raceOf(gs, evt.civId);
        if (evt.civId === humanCivId) {
          let bark = advanceBark(gs, humanCivId, evt.techId);
          // Vaelis, a rival, now and then sneers at the player's progress
          // (2026-09-25, user-directed: he truly believes elves superior).
          if (st.playerRace !== "elf" && tech && Math.random() < VAELIS_SCOFF_CHANCE) {
            const scoff = vaelisScoff(gs, humanCivId, "player", { tech: techLabel(tech) });
            if (bark && scoff) { let t = bark; while (t.reply) t = t.reply; t.reply = { ...scoff, caption: "" }; }
            else bark = bark || scoff;
          }
          // Held by main.js until the "advancement complete" window for this
          // tech has been shown and closed -- the event fires mid-turn, well
          // before that window opens (see main.js's pumpStory).
          if (bark) { bark.afterTech = evt.techId; barks.push(bark); }
        } else if (st.playerRace === "elf" && advRace && advRace !== "elf" && tech && Math.random() < VAELIS_SCOFF_CHANCE / 2) {
          // Playing the Elves: he sneers at the other kingdoms' advances.
          const scoff = vaelisScoff(gs, humanCivId, "rival", { tech: techLabel(tech), rival: REALMS[advRace] });
          if (scoff) barks.push(scoff);
        }
      } else if (evt.type === "gather") {
        // A gathering round (turns.js's storyGatherMoment): sometimes a
        // remark, from home["gather:<channel>"] or the general home.gather.
        if (evt.civId === humanCivId && Math.random() < GATHER_CHANCE) {
          const ctx = { resource: evt.resource };
          const bark = homeBark(gs, humanCivId, `gather:${evt.channel}`, ctx, { triggerKey: "gather" })
            || homeBark(gs, humanCivId, "gather", ctx, { triggerKey: "gather" });
          if (bark) barks.push(bark);
        }
      } else if (evt.type === "moment") {
        // Ability moments (riddles, Unlock the Gate, wolf hunts...).
        let bark = null;
        if (evt.trigger === "luckyRock") {
          // Gnash LOVES a Lucky Rock: his own kingdom's (delight), or the
          // player's (envy) -- one pool, lines split by `req.holder`.
          const race = raceOf(gs, evt.civId);
          if ((evt.civId === humanCivId || race === "orc") && speakerAvailable(gs, "gnash")) {
            const B = window.GameData.STORY_BARKS;
            bark = poolBark(gs, humanCivId, B && B.luckyRock, "luckyRock",
              { holder: race === "orc" ? "orc" : "other" }, { triggerKey: "luckyRock", force: true, recycle: true });
          }
        } else if (evt.civId === humanCivId) {
          bark = homeBark(gs, humanCivId, evt.trigger, { city: evt.city });
        } else if (evt.targetCivId === humanCivId) {
          const race = raceOf(gs, evt.civId);
          if (race) bark = rivalBark(gs, humanCivId, `${evt.trigger}:${race}`, { city: evt.city });
        }
        if (bark) barks.push(bark);
      }
    }
    return barks;
  }

  // ------------------------------------------------------------------ debug

  /** Console helper for testing scenes without playing to them:
   *  GameEngine.story.debugScene(gameState, humanCivId, "B3"). */
  function debugScene(gs, humanCivId, key, ctx = {}) {
    return buildScene(gs, humanCivId, key, ctx);
  }

  return {
    PLAYABLE, REALMS, SIGNATURE_BUILDINGS,
    push, resetBuffer, init, pump, nextScenes, endingScene, noteRefusal, getLog, setHidden, isHidden, sceneDisplayName,
    reqHolds, fillTokens, numberToWords, buildScene, debugScene, scenarioIdFor, getSceneDef,
  };
})();
