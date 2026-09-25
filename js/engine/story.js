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
  const BARK_MIN_GAP_ROUNDS = 2;
  const BARK_TRIGGER_COOLDOWN = 10;
  const BARK_DEFER_ROUNDS = 3;         // a poll-born bark waits at most this long for a free round
  const VOICE_CAP = 6;
  const TAUNT_VOICE_GAP_ROUNDS = 6;
  const TAUNT_CHANCE_AFTER_FIRST = 1 / 3;
  const REPLY_CHANCE = 1 / 3;
  const UNIT_WIN_CHANCE = 1 / 4;       // Sigrun & co. commenting on a won fight
  const RESEARCH_ASIDE_CHANCE = 1 / 3; // Barnaby's research asides
  const TAUNT_TIER_BY_COUNT = [0, 0, 1, 1, 2, 3];
  const FEUD_GAP_ROUNDS = 10;          // between steps of the witches' feud / Vaelis's whispers

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
      } else if (k === "winner" || k === "conqueror" || k === "firstBlood" || k === "taunter" || k === "holder") {
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
      if (name === "city" || name === "enemyCity" || name === "unit" || name === "enemyUnit" || name === "item") {
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
    if (key.startsWith("relic")) return 3;
    if (key.startsWith("capture") || key.startsWith("lost") || key.startsWith("rival-vs-rival")
      || key.startsWith("feud") || key.startsWith("whisper")) return 4;
    if (key.startsWith("ultimate") || key.startsWith("titan")) return 5;
    return 6;
  }
  /** Scenes that skip the optional budget entirely (bible §4). */
  function skipsBudget(key) {
    return key.startsWith("eliminated:") || key.startsWith("meet:") || key === "lovers:reveal";
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
    }

    // The player's first copy of a signature building.
    for (const b of SIGNATURE_BUILDINGS[st.playerRace] || []) {
      if (st.builtSeen[b]) continue;
      const city = human.cities.find((c) => cityHas(c, b));
      if (!city) continue;
      st.builtSeen[b] = round(gs);
      q(`built:${b}`, { city: city.name });
      if (b === "runewall") q("titan:wall", { city: city.name });
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
    if (!st || !scenarioOf(st)) return [];
    const r = round(gs);
    const out = [];
    const take = (key, ctx, opts) => {
      const scene = buildScene(gs, humanCivId, key, ctx, opts);
      markSeen(gs, key);
      if (scene) out.push(scene);
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
    if (!st || st.endingsPlayed[kind]) return null;
    st.endingsPlayed[kind] = round(gs);
    const ctx = {
      winner: info.winnerCivId ? raceOf(gs, info.winnerCivId) : undefined,
      conqueror: st.lastConqueror || undefined,
    };
    const scene = buildScene(gs, humanCivId, kind, ctx);
    markSeen(gs, kind);
    return scene;
  }

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

  function pickFromPool(gs, poolKey, lines, E, extraFilter) {
    const st = gs.story;
    const used = st.usedLines[poolKey] || (st.usedLines[poolKey] = []);
    const candidates = lines.map((l, i) => ({ l, i })).filter(({ l, i }) =>
      !used.includes(i) && speakerAvailable(gs, l.s) && reqHolds(l.req, E) && (!extraFilter || extraFilter(l)));
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

  function toBark(st, line, caption, E) {
    return { caption: caption ? fillTokens(caption, E) : "", speaker: line.s, text: fillTokens(line.t, E), mood: line.m || null, ...speakerOverrides(st, line.s) };
  }

  function recordBark(st, r, triggerKey, speaker) {
    st.lastBarkRound = r;
    if (triggerKey) st.barkCooldowns[triggerKey] = r;
    st.voiceCounts[speaker] = (st.voiceCounts[speaker] || 0) + 1;
    st.voiceLastRound[speaker] = r;
  }

  /** A bark from a pool, checked against pacing and recorded. */
  function poolBark(gs, humanCivId, pool, poolKey, ctx, { triggerKey = poolKey, filter, cap = false } = {}) {
    const st = gs.story;
    if (!pool) return null;
    const r = round(gs);
    if (!barkAllowed(st, r, triggerKey)) return null;
    const E = env(gs, humanCivId, ctx);
    const line = pickFromPool(gs, poolKey, pool.lines, E, (l) =>
      (!cap || (st.voiceCounts[l.s] || 0) < VOICE_CAP) && (!filter || filter(l)));
    if (!line) return null;
    recordBark(st, r, triggerKey, line.s);
    return toBark(st, line, pool.caption, E);
  }

  /** The player's own kingdom reacting to its own play (bible §8b home
   *  moments) -- only the player's own characters speak. */
  function homeBark(gs, humanCivId, trigger, ctx) {
    const B = window.GameData.STORY_BARKS;
    const pool = B && B.home && B.home[trigger];
    const race = gs.story.playerRace;
    return poolBark(gs, humanCivId, pool, `home:${trigger}`, ctx, {
      filter: (l) => (characters()[l.s] || {}).race === race,
    });
  }

  /** Anyone present may speak (storms, the witches' feud gloats). */
  function worldBark(gs, humanCivId, trigger, ctx) {
    const B = window.GameData.STORY_BARKS;
    return poolBark(gs, humanCivId, B && B.world && B.world[trigger], `world:${trigger}`, ctx);
  }

  function rivalBark(gs, humanCivId, key, ctx) {
    const B = window.GameData.STORY_BARKS;
    return poolBark(gs, humanCivId, B && B.rival && B.rival[key], key, ctx, { cap: true });
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
          bark = tryTaunt(gs, humanCivId, killerRace, { unit: unitLabel(evt.victimTypeId) });
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
        if (from === humanCivId) {
          st.lastConqueror = toRace;
          enqueue(gs, humanCivId, `lost:${toRace}`, { city: evt.cityName });
          bark = rivalBark(gs, humanCivId, `tookCity:${toRace}`, { city: evt.cityName });
        } else if (to === humanCivId) {
          enqueue(gs, humanCivId, `capture:${fromRace}`, { enemyCity: evt.cityName });
          bark = rivalBark(gs, humanCivId, `lostCity:${fromRace}`, { city: evt.cityName });
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
      } else if (evt.type === "world" && evt.kind === "advancement") {
        if (evt.civId === humanCivId && Math.random() < RESEARCH_ASIDE_CHANCE) {
          const bark = homeBark(gs, humanCivId, "research", {});
          if (bark) barks.push(bark);
        }
      } else if (evt.type === "moment") {
        // Ability moments (riddles, Unlock the Gate, wolf hunts...).
        let bark = null;
        if (evt.civId === humanCivId) {
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
    push, resetBuffer, init, pump, nextScenes, endingScene, noteRefusal,
    reqHolds, fillTokens, numberToWords, buildScene, debugScene, scenarioIdFor, getSceneDef,
  };
})();
