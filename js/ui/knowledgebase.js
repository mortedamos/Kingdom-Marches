/**
 * KINGDOM MARCHES KNOWLEDGE BASE (KMKB)
 * --------------------------------------
 * In-game reference documents, opened from the "Knowledge" menu (both the
 * title screen and the in-game menu bar -- see main.js's setupMenuBar/
 * setupTitleMenuBar and the #knowledge-overlay block in redraw()).
 *
 * Two pages, both pure-render functions over live game DATA (units.js/
 * races.js/techs.js/overlays.js), never hand-maintained prose about a
 * specific unit's numbers -- the whole point is that this can never drift
 * out of sync with a balance change the way a static wiki page would:
 *
 *   - Units: every unit in the game, grouped by kingdom (plus Universal and
 *     Wandering Monsters), with a profile showing its live base stats
 *     (straight from units.js -- change a number there, this updates for
 *     free), its available actions (derived from its capability flags,
 *     e.g. canFoundCity/canProspect), and which techs unlock/upgrade/
 *     replace it (derived by scanning techs.js's raw effect objects for
 *     one that names this unit -- see techRelationsForUnit).
 *   - Conditions: every status-effect icon overlays.js knows how to draw
 *     (read directly from window.UI.overlays.CONDITION_ICONS, not a second
 *     hand-copied list), each with a hand-written description of its actual
 *     mechanical effect -- the icon set is data-driven, the prose isn't
 *     (there's no other source of truth for "what does Burning do" to pull
 *     from), same convention as a tech's own description text in techs.js.
 *     Same list+profile layout as the Units page (2026-08-16, user-
 *     directed), for visual consistency between the two pages.
 *
 * A unit's OWN default properties that correspond to a condition (its
 * chance to inflict Burning on a hit, an inherent Flying flag, Bog Witch's
 * curseOnDeath, ...) are shown together on its profile and cross-link
 * straight to that condition's own page/profile -- see UNIT_CONDITION_LINKS
 * and jumpToCondition (wired in main.js's renderKnowledgeOverlay). Jumping
 * that way remembers where you came from (main.js's knowledgeBackTarget) so
 * a "Back" button can return you to the exact unit you were reading.
 *
 * Stats shown are BASE units.js numbers, not one specific civ's tech-
 * upgraded numbers -- this is a reference manual, not a live combat readout,
 * and it has to work identically whether opened from the title screen (no
 * civ exists yet) or mid-game. Tech-driven upgrades are listed separately,
 * by name, under "Upgraded By" instead of being silently folded into the
 * base stat block.
 */

window.UI = window.UI || {};

(function () {
  // Default unit-data properties that correspond 1:1 with an entry on the
  // Conditions page -- shown together on a unit's profile, each cross-
  // linking to that condition's own writeup (2026-08-16, user-directed).
  // Hand-maintained, same "small table, extended when a new mechanic ships"
  // convention as overlays.js's own CONDITION_ICONS or sfx-actions.js's
  // SFX_SPECIAL_ACTIONS -- a unit that already carries one of these fields
  // (existing or brand new) is picked up automatically; a genuinely NEW
  // kind of default property needs one more entry here.
  const UNIT_CONDITION_LINKS = [
    { field: "flying", conditionKey: "flying", describe: () => "Always Flying" },
    { field: "burnChancePct", conditionKey: "burning", describe: (v) => `${pctLabel(v)} chance to inflict on hit` },
    { field: "frozenChancePct", conditionKey: "frozen", describe: (v) => `${pctLabel(v)} chance to inflict on hit` },
    { field: "webChancePct", conditionKey: "webbed", describe: (v) => `${pctLabel(v)} chance to inflict on hit` },
    { field: "poisonChancePct", conditionKey: "poisoned", describe: (v) => `${pctLabel(v)} chance to inflict on hit` },
    {
      field: "curseOnDeath", conditionKey: "curse",
      describe: (v) => `Curses its killer on death: -${Math.round((1 - v.attackMult) * 100)}% Attack, `
        + `-${Math.round((1 - v.moveMult) * 100)}% Movement for ${v.duration} turns`,
    },
  ];

  // Hand-written mechanical descriptions -- see this file's top doc comment
  // for why this half of the Conditions page can't be data-driven the way
  // the icon set itself is. Numbers verified against the actual engine code
  // (combat.js's effectiveAttack/effectiveDefense, ai.js's applyBurning/
  // applyWebbed/applyPoisoned, turns.js's aura blocks) as of 2026-08-16, not
  // guessed -- re-check here if any of those change.
  const CONDITION_DESCRIPTIONS = {
    hidden: "Concealed from enemy vision and can't be targeted directly (an area-effect attack can still catch it by accident). Costs extra movement to reposition while staying hidden, and grants +50% Defense if attacked anyway. Expires back to visible after a few turns.",
    forcedVisible: "Forced back into the open after a Hidden grant just expired -- can't go Hidden again until this wears off.",
    frozen: "Movement locked to zero and Attack cut by 25%, for 3 turns. Caused by ice magic, frost traps, and cold-natured monsters.",
    curse: "Attack and Movement cut by a fixed percentage for a limited time -- the Bog Witch's death curse and Malefic Malediction.",
    exhausted: "Worn out from a taxing ability (teleportation, a Druid's Blink) -- forced to Rest every turn until healed back to full HP.",
    forcedRest: "Shaken by a near-death blow -- forced to Rest for exactly one turn, then clears on its own.",
    defending: "Actively defending this turn -- doubles this unit's Defense against any attack.",
    killMomentum: "Riding the momentum of a recent kill (Orc's Violent Momentum) -- temporary bonuses to First Strike and Double Strike chance.",
    flying: "Moves over any terrain ignoring movement penalties, though a non-Ranged attacker still has a flat chance to simply miss it. Either a permanent trait of the unit type, or temporarily granted (e.g. the Human Flight tech).",
    crusadeAura: "Within a Paladin's Crusade aura: +2 Attack, +1 Defense, +25% Siege, and a small heal, refreshed every turn the aura still reaches it.",
    heavyMetalAura: "Within a Troubadour's Heavy Metal performance: +2 Defense, +30% Siege, and a small heal, refreshed every turn the aura still reaches it.",
    powerMetalAura: "Within a Troubadour's Power Metal performance: +2 Attack and +5% First Strike, refreshed every turn the aura still reaches it.",
    deepMinesGuard: "Guarding a Gold or Iron Vein under the Deep Mines tech: +2 Defense while it holds its claim.",
    burning: "Aflame -- 1 damage at the start of every turn for 3 turns, unless standing on Coast, Ocean, or a river tile.",
    zombie: "A reanimated corpse fighting at a fraction of its living stats -- Undead's Raise Dead.",
    befuddled: "Confused by a Halfellow Trouble Maker's Riddle -- Attack cut by 50% and Defense cut by 25% for a few turns.",
    resting: "Standing down this turn to recover HP.",
    webbed: "Snared in webbing -- movement locked to zero for 1 turn, but it can still fight back at full strength if something is already adjacent.",
    poisoned: "Venom in its veins -- 1 damage at the start of every turn for 3 turns. Mechanically identical to Burning, just from a venomous source (e.g. the Marsh Adder) instead of fire.",
    keepingWatch: "Posted as a lookout (Halfellow's Keep an Eye Out) -- holds position with +3 Vision.",
  };

  // Every stat shown on a unit's profile, cross-linked to its own KMKB
  // entry (2026-08-17, user-directed). `key` matches STAT_DESCRIPTIONS
  // below; `unitField`/`derive` say how renderUnitProfileHtml pulls this
  // stat's VALUE off a real unit -- most read a plain units.js field
  // directly, maxHp is derived (see units.js's own unitMaxHP). `icon`
  // (2026-08-17, user-directed) -- same "small icon before the name"
  // treatment the unit list (symbol) and Conditions list (CONDITION_ICONS)
  // already get, shown in the stat list, that stat's own profile header,
  // AND next to its cross-link label on a unit's profile.
  const STAT_INFO = [
    { key: "attack", label: "Attack", icon: "⚔️" },
    { key: "defense", label: "Defense", icon: "🛡️" },
    { key: "maxHp", label: "Max HP", icon: "❤️" },
    { key: "movement", label: "Movement", icon: "👣" },
    { key: "visionRadius", label: "Vision", icon: "👁️" },
    { key: "range", label: "Range", icon: "🎯" },
    { key: "siegePct", label: "Siege Bonus", icon: "🏰" },
    { key: "firstStrikePct", label: "First Strike", icon: "⚡" },
    { key: "doubleStrikePct", label: "Double Strike", icon: "🔁" },
  ];
  const STAT_LABEL_BY_KEY = Object.fromEntries(STAT_INFO.map((s) => [s.key, s.label]));
  const STAT_ICON_BY_KEY = Object.fromEntries(STAT_INFO.map((s) => [s.key, s.icon]));

  // Hand-written explanations of what each stat actually DOES mechanically,
  // including the real combat formula where one applies (2026-08-17, user-
  // directed) -- same "can't be derived from data alone" reasoning as
  // CONDITION_DESCRIPTIONS above. Verified against the actual engine code
  // (combat.js's damageRoll/mitigatedDamage/resolveRound, units.js's own
  // unitMaxHP) as of 2026-08-17 -- re-check here if any of those change.
  // attack/defense additionally render the live simulator (see
  // COMBAT_SIM_HTML/wireCombatSimulator) right under their prose.
  const STAT_DESCRIPTIONS = {
    attack: "This unit's base combat power. Each hit's raw damage starts as this value, randomly varied by roughly ±3-18% (a 3d6 roll used as a percentage, bell-curved around ±10-11%, rolled fresh every hit), THEN reduced by the target's Defense -- see Defense's own entry for the exact mitigation formula. The same Attack value is also what this unit swings back with on a counterattack.",
    defense: "Reduces incoming damage using a self-scaling RATIO, not a flat subtraction:\n\ndamage = round( randomized_attack_roll × Attack / (Attack + Defense) ), floored at a minimum of 1.\n\nEqual Attack and Defense lets roughly half the roll through; doubling Defense relative to Attack cuts it to about a third. Defense can never fully block a hit -- every attack deals at least 1 damage.",
    maxHp: "How much damage this unit can take before dying. Not set directly on the unit -- always round(Attack + Defense + this unit's own tech-tree depth), so a unit whose kit sits deeper in its race's tech tree is innately tougher, on top of whatever Attack/Defense it has.",
    movement: "How many tiles this unit can move in a single turn, before terrain movement costs and any movement-affecting conditions (Frozen, Webbed, Hidden's own movement penalty, ...) are applied.",
    visionRadius: "How far (in tiles) this unit can see, feeding the fog of war -- a tile within Vision range of any of a kingdom's units or cities is visible that turn.",
    range: "How far away (in tiles, measured diagonally-inclusive) this unit can attack from. 1 means melee-only (adjacent targets only). A Ranged attack (greater than 1) needs a clear line to its target -- Mountains block it, nothing else does -- gets NO counterattack back (the defender isn't adjacent, so it can't reach the attacker), and gets no Siege bonus against a structure/city unless this unit ALSO has the separate \"even at range\" Siege property (e.g. Catapult, Trebuchet).",
    siegePct: "An extra attack multiplier applied only when attacking a structure, wall, or city (or a unit that's itself treated as a structure for incoming damage, like Dwarf's Runeforged Titan) -- irrelevant in an ordinary unit-vs-unit fight. A Ranged unit only keeps this bonus at range if it also carries the separate \"even at range\" Siege property.",
    firstStrikePct: "Two separate effects from this one percentage: (1) in an adjacent fight, whichever side has the STRICTLY HIGHER First Strike value simply acts first -- a direct comparison, not a roll -- and if that first hit is lethal, the loser never gets to swing back at all; (2) independently, the ATTACKER's own First Strike chance is rolled fresh every single exchange as a flat chance to deny the defender's counterattack entirely, whether or not the forward hit was lethal.",
    doubleStrikePct: "A flat chance, rolled once per exchange, that this unit immediately attacks a second time. The follow-up hit provokes no counterattack, works at any range (a Ranged unit's second shot still comes from distance), and only happens if both sides are still standing after the first exchange.",
  };

  /** Mirrors combat.js's real damageRoll()+mitigatedDamage() exactly (see
   *  that file for the authoritative version) -- `pctVariance` stands in
   *  for the signed 3d6-as-a-percent roll (-18..+18 in the real engine,
   *  mean 0), so callers can compute the worst hit (-18), average hit (0,
   *  since the roll is symmetric around 0), and best hit (+18) for a given
   *  Attack/Defense pair without duplicating combat.js's own RNG. Powers
   *  both the Attack/Defense pages' live simulator and could be reused
   *  anywhere else a "what would this fight look like" preview is useful. */
  function simDamage(atk, def, pctVariance) {
    const raw = atk * (1 + pctVariance / 100);
    const mitigated = raw * (atk / (atk + def || 1));
    return Math.max(1, Math.round(mitigated));
  }

  // Live Attack-vs-Defense simulator (2026-08-17, user-directed), embedded
  // on both the Attack and Defense stat pages since the formula genuinely
  // involves both. Deliberately NOT wired through the normal
  // knowledgeSelectedXxx/renderKnowledgeOverlay redraw cycle -- its own
  // atk/def state is trivial, purely local to this one widget, and doesn't
  // need to survive navigating away, so wireCombatSimulator (below,
  // exported) just closures over it directly the same way a small
  // standalone UI component would, without adding new global KB state for
  // something this self-contained.
  const COMBAT_SIM_HTML = `
    <div class="kb-sim">
      <div class="kb-sim-row">
        <span class="kb-sim-label">Attack</span>
        <button class="kb-sim-btn" data-sim-adjust="atk:-1">−</button>
        <span class="kb-sim-value" data-sim-value="atk"></span>
        <button class="kb-sim-btn" data-sim-adjust="atk:1">+</button>
      </div>
      <div class="kb-sim-row">
        <span class="kb-sim-label">Defense</span>
        <button class="kb-sim-btn" data-sim-adjust="def:-1">−</button>
        <span class="kb-sim-value" data-sim-value="def"></span>
        <button class="kb-sim-btn" data-sim-adjust="def:1">+</button>
      </div>
      <div class="kb-sim-result">
        <div class="stat-row"><span>Average Damage per Hit</span><span data-sim-result="avg"></span></div>
        <div class="stat-row"><span>Possible Range</span><span data-sim-result="range"></span></div>
      </div>
    </div>`;

  /** Wires up COMBAT_SIM_HTML's +/- buttons within `root` (a freshly-
   *  inserted DOM subtree containing it) -- no-ops if this page doesn't
   *  have the simulator. Exported so main.js can call it once per redraw,
   *  same "pure render module, caller wires interactivity" split as
   *  drawUnitPortrait. */
  function wireCombatSimulator(root) {
    const sim = root.querySelector(".kb-sim");
    if (!sim) return;
    let atk = 5, def = 5;
    const MIN_STAT = 1, MAX_STAT = 30;
    function update() {
      sim.querySelector('[data-sim-value="atk"]').textContent = atk;
      sim.querySelector('[data-sim-value="def"]').textContent = def;
      sim.querySelector('[data-sim-result="avg"]').textContent = simDamage(atk, def, 0);
      const min = simDamage(atk, def, -18), max = simDamage(atk, def, 18);
      sim.querySelector('[data-sim-result="range"]').textContent = min === max ? `${min}` : `${min} – ${max}`;
    }
    for (const btn of sim.querySelectorAll("[data-sim-adjust]")) {
      btn.onclick = () => {
        const [key, deltaStr] = btn.dataset.simAdjust.split(":");
        const delta = parseInt(deltaStr, 10);
        if (key === "atk") atk = Math.max(MIN_STAT, Math.min(MAX_STAT, atk + delta));
        else def = Math.max(0, Math.min(MAX_STAT, def + delta));
        update();
      };
    }
    update();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function titleCase(s) {
    return String(s)
      .replace(/([a-z])([A-Z])/g, "$1 $2") // camelCase -> spaced
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function pctLabel(x) {
    return `${Math.round(x * 100)}%`;
  }

  /** Every unit id, grouped for the list pane: Universal (no raceOnly, not a
   *  monster) first, then one group per real race in RACE_LIST order, then
   *  Wandering Monsters last. Pure derivation from units.js/races.js --
   *  add a unit anywhere in units.js and it appears in the right group
   *  automatically, no registration step. */
  function groupedUnits() {
    const groups = [];
    const universal = window.GameData.UNIT_LIST.filter((id) => {
      const u = window.GameData.getUnit(id);
      return !u.raceOnly && !window.GameData.MONSTER_UNIT_IDS.has(id);
    });
    if (universal.length) groups.push({ key: "universal", label: "Universal — Any Kingdom", units: universal });
    for (const raceId of window.GameData.RACE_LIST) {
      const units = window.GameData.UNIT_LIST.filter((id) => window.GameData.getUnit(id).raceOnly === raceId);
      if (units.length) groups.push({ key: raceId, label: window.GameData.getRace(raceId).label, units });
    }
    const monsters = [...window.GameData.MONSTER_UNIT_IDS];
    if (monsters.length) groups.push({ key: "monsters", label: "Wandering Monsters", units: monsters });
    return groups;
  }

  /** Which race's art to preview a raceOnly-less unit with -- a monster uses
   *  its own pseudo-race (sprites.js's pickUnit falls back to the
   *  unqualified "unit/<id>" art regardless, since monster sprites were
   *  only ever registered unqualified -- see sprite-manifests.js), a
   *  universal unit just needs SOME race-qualified art to preview, so
   *  "human" is as good a default as any. */
  function portraitRaceFor(unit) {
    if (unit.raceOnly) return unit.raceOnly;
    if (window.GameData.MONSTER_UNIT_IDS.has(unit.id)) return window.GameData.MONSTER_RACE.id;
    return "human";
  }

  /** Draws a static idle-frame portrait of `unitId` (as `raceId` would
   *  render it) onto `canvas`. If that art isn't already loaded (2026-08-17,
   *  user-reported: this used to just fall back to the unit's `symbol`
   *  glyph permanently in this case -- e.g. the title screen, where nothing
   *  has been preloaded yet, or ANY race not in the current game, which
   *  includes every universal unit whenever this module's own default
   *  preview race isn't in play) the glyph is drawn immediately so the
   *  canvas is never blank, but a real, targeted load for just this one
   *  (unitId, raceId) pair is also kicked off (sprites.js's
   *  ensureUnitLoaded) -- the KMKB browses every unit in the game
   *  regardless of what's actually in the current game, unlike normal
   *  play, so it can't rely on preloadAll's own in-play-races scoping the
   *  way the rest of the renderer does. Redraws itself once that resolves,
   *  guarded against a stale canvas (the player already navigated
   *  elsewhere by the time the load finishes) by re-checking the canvas is
   *  still attached AND still showing this exact unit/race pair. Exported
   *  so main.js can call it once per redraw after inserting the profile's
   *  HTML (a canvas has to already be in the DOM before you can draw to
   *  it). */
  function drawUnitPortrait(canvas, unitId, raceId) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const unit = window.GameData.getUnit(unitId);
    const sprite = window.UI.sprites.pickUnit(unitId, raceId, null);
    if (sprite) {
      const f = window.UI.sprites.currentFrame(sprite.manifest, "idle", null);
      ctx.drawImage(sprite.image, f.sx, f.sy, f.sw, f.sh, 0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${Math.round(canvas.width * 0.55)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#c9a857";
    ctx.fillText(unit.symbol || "?", canvas.width / 2, canvas.height / 2 + canvas.width * 0.04);

    if (window.UI.sprites.ensureUnitLoaded) {
      window.UI.sprites.ensureUnitLoaded(unitId, raceId).then(() => {
        if (canvas.isConnected && canvas.dataset.portraitUnitId === unitId && canvas.dataset.portraitRaceId === raceId) {
          drawUnitPortrait(canvas, unitId, raceId);
        }
      });
    }
  }

  /** Player-facing capability list, derived purely from the unit's own
   *  boolean/numeric flags in units.js -- not a hand-maintained per-unit
   *  description. Flying is deliberately excluded here -- it's covered
   *  (with a cross-link) in the unified Conditions block instead, see
   *  unitConditionLinksHtml, so it isn't listed twice on the same page. */
  function availableActionsFor(unit) {
    const actions = [];
    if (unit.attack > 0) actions.push("Attack");
    if (unit.movement > 0) actions.push("Move");
    if (unit.canFoundCity) actions.push("Found a City");
    if (unit.canBuildRoad) actions.push("Build Roads");
    if (unit.canImprove) actions.push("Improve Terrain");
    if (unit.canProspect) actions.push("Gather Resources (Mine, Hunt, Farm, or Fish)");
    if (unit.canExplore) actions.push("Auto-Explore");
    if (unit.canCarryUnit) actions.push("Carry Another Unit");
    if (unit.isNaval) actions.push("Naval Movement");
    return actions;
  }

  /** HTML for the unit profile's unified "Conditions" block -- every
   *  UNIT_CONDITION_LINKS entry this unit actually has, each a clickable
   *  cross-link (data-condition-link, wired in main.js) to that condition's
   *  own page. Empty string if this unit has none. */
  function unitConditionLinksHtml(unit) {
    const icons = (window.UI.overlays && window.UI.overlays.CONDITION_ICONS) || {};
    const rows = UNIT_CONDITION_LINKS
      .filter((link) => unit[link.field])
      .map((link) => {
        const icon = icons[link.conditionKey] || "";
        return `<button class="kb-condition-link" data-condition-link="${escapeHtml(link.conditionKey)}">
          <span class="kb-condition-link-icon">${icon}</span>
          <span class="kb-condition-link-text">${escapeHtml(titleCase(link.conditionKey))} — ${escapeHtml(link.describe(unit[link.field]))}</span>
          <span class="kb-condition-link-arrow">View →</span>
        </button>`;
      });
    return rows.length ? `<h3>Conditions</h3>${rows.join("")}` : "";
  }

  /** Every tech relationship this unit has, derived by scanning EVERY
   *  tech's raw `effects` array (window.GameData.TECHS, not just one race's
   *  tree -- a universal unit like Pioneer can be upgraded by more than one
   *  race's own tech) for an effect object that names this exact unit id.
   *  Fully generic: a brand new tech added to techs.js with a
   *  unit_stat_upgrade/unlock_unit/replace_unit naming this unit shows up
   *  here with no change to this file. */
  function techRelationsForUnit(unitId) {
    const unlockedBy = [], upgrades = [], replacedBy = [], replaces = [];
    for (const techId of window.GameData.TECH_LIST) {
      const tech = window.GameData.getTech(techId);
      const effects = tech.effects || [];
      for (const eff of effects) {
        if (eff.type === "unlock_unit" && eff.unit === unitId) {
          unlockedBy.push({ tech });
        }
        if (eff.type === "unit_stat_upgrade" && eff.unit === unitId) {
          const mech = effects.find((e) => e.type === "unlock_mechanic");
          upgrades.push({ tech, changes: eff.changes || {}, mechanic: mech ? mech.mechanic : null });
        }
        if (eff.type === "replace_unit" && eff.from === unitId) {
          replacedBy.push({ tech, to: eff.to });
        }
        if (eff.type === "replace_unit" && eff.to === unitId) {
          replaces.push({ tech, from: eff.from });
        }
      }
    }
    return { unlockedBy, upgrades, replacedBy, replaces };
  }

  const STAT_CHANGE_LABELS = {
    attack: "Attack", defense: "Defense", movement: "Movement", visionRadius: "Vision",
    range: "Range", siegePct: "Siege", firstStrikePct: "First Strike", doubleStrikePct: "Double Strike",
    burnChancePct: "Burn Chance", frozenChancePct: "Frozen Chance", webChancePct: "Web Chance",
    poisonChancePct: "Poison Chance", flying: "Flying", canCarryUnit: "Carry",
  };
  function formatChanges(changes) {
    return Object.entries(changes).map(([key, value]) => {
      const label = STAT_CHANGE_LABELS[key] || titleCase(key);
      if (typeof value === "boolean") return value ? `Grants ${label}` : `Removes ${label}`;
      if (/Pct$/.test(key)) return `${value > 0 ? "+" : ""}${Math.round(value * 100)}% ${label}`;
      return `${value > 0 ? "+" : ""}${value} ${label}`;
    }).join(", ");
  }
  function techBadge(tech) {
    const race = tech.raceOnly ? window.GameData.getRace(tech.raceOnly).label : "Universal";
    return `${escapeHtml(tech.label)} <span class="kb-tech-badge">${escapeHtml(race)} · Layer ${tech.layer}</span>`;
  }

  /** Full HTML for the left-hand unit list, grouped by kingdom. `selectedUnitId`
   *  (may be null) just controls which button gets the "selected" style. */
  function renderUnitListHtml(selectedUnitId) {
    return groupedUnits().map((g) => `
      <div class="kb-list-group">
        <div class="kb-list-group-label">${escapeHtml(g.label)}</div>
        ${g.units.map((id) => {
          const u = window.GameData.getUnit(id);
          const selected = id === selectedUnitId ? " kb-list-btn-selected" : "";
          return `<button class="kb-list-btn${selected}" data-unit-id="${escapeHtml(id)}">
            <span class="kb-list-btn-symbol">${escapeHtml(u.symbol || "")}</span>
            <span>${escapeHtml(u.label)}</span>
          </button>`;
        }).join("")}
      </div>
    `).join("");
  }

  /** Full HTML for the right-hand profile pane -- everything BUT the
   *  portrait canvas's actual pixels (drawUnitPortrait fills that in after
   *  this HTML is in the DOM). Null unitId renders the "pick a unit" empty
   *  state. */
  function renderUnitProfileHtml(unitId) {
    if (!unitId || !window.GameData.UNITS[unitId]) {
      return `<div class="kb-profile-empty">Select a unit on the left to view its profile.</div>`;
    }
    const unit = window.GameData.getUnit(unitId);
    const raceLabel = unit.raceOnly
      ? window.GameData.getRace(unit.raceOnly).label
      : window.GameData.MONSTER_UNIT_IDS.has(unitId) ? "Wandering Monster" : "Universal — any kingdom can build this";
    const maxHp = window.GameData.unitMaxHP(unit.attack, unit.defense, unitId);
    const portraitRaceId = portraitRaceFor(unit);

    // Each row's label cross-links to that stat's own KMKB entry
    // (2026-08-17, user-directed) -- data-stat-link keys match STAT_INFO,
    // wired in main.js's renderKnowledgeOverlay (same jumpToStat/
    // knowledgeBackTarget pattern the Conditions cross-links already use).
    const statRows = [["attack", unit.attack], ["defense", unit.defense], ["maxHp", maxHp],
      ["movement", unit.movement], ["visionRadius", unit.visionRadius]];
    if ((unit.range || 1) > 1) statRows.push(["range", unit.range]);
    if (unit.siegePct) statRows.push(["siegePct", pctLabel(unit.siegePct) + (unit.siegeAtRange ? " (even at range)" : "")]);
    if (unit.firstStrikePct) statRows.push(["firstStrikePct", pctLabel(unit.firstStrikePct)]);
    if (unit.doubleStrikePct) statRows.push(["doubleStrikePct", pctLabel(unit.doubleStrikePct)]);
    const statsHtml = statRows.map(([key, v]) => `<div class="stat-row">`
      + `<button class="kb-stat-link" data-stat-link="${escapeHtml(key)}">${STAT_ICON_BY_KEY[key]} ${escapeHtml(STAT_LABEL_BY_KEY[key])}</button>`
      + `<span>${escapeHtml(String(v))}</span></div>`).join("");

    const flagChips = [];
    if (unit.canCarryUnit) flagChips.push("Carries a Unit");
    if (unit.isNaval) flagChips.push("Naval");
    if (unit.siegeTarget) flagChips.push("Treated as a Structure");
    if (unit.rare) flagChips.push("Rare");
    if (unit.veryRare) flagChips.push("Very Rare");
    if (unit.restrictedToTerrain) flagChips.push(`Confined to ${titleCase(unit.restrictedToTerrain)}`);
    const flagsHtml = flagChips.length
      ? `<div class="kb-chip-row">${flagChips.map((c) => `<span class="kb-chip">${escapeHtml(c)}</span>`).join("")}</div>` : "";

    const conditionLinksHtml = unitConditionLinksHtml(unit);

    const actions = availableActionsFor(unit);
    const actionsHtml = actions.length
      ? `<h3>Available Actions</h3><div class="kb-chip-row">${actions.map((a) => `<span class="kb-chip kb-chip-action">${escapeHtml(a)}</span>`).join("")}</div>`
      : "";

    const rel = techRelationsForUnit(unitId);
    const relParts = [];
    if (rel.unlockedBy.length) {
      relParts.push(`<div class="kb-tech-rel"><span class="kb-tech-rel-label">Unlocked by</span> ${
        rel.unlockedBy.map((r) => techBadge(r.tech)).join(", ")}</div>`);
    }
    if (rel.replaces.length) {
      relParts.push(...rel.replaces.map((r) => `<div class="kb-tech-rel"><span class="kb-tech-rel-label">Replaces</span> ${
        escapeHtml(window.GameData.getUnit(r.from).label)} via ${techBadge(r.tech)}</div>`));
    }
    if (rel.replacedBy.length) {
      relParts.push(...rel.replacedBy.map((r) => `<div class="kb-tech-rel"><span class="kb-tech-rel-label">Replaced by</span> ${
        escapeHtml(window.GameData.getUnit(r.to).label)} via ${techBadge(r.tech)}</div>`));
    }
    if (rel.upgrades.length) {
      relParts.push(...rel.upgrades.map((r) => {
        const changeText = formatChanges(r.changes);
        const mechText = r.mechanic ? ` — also unlocks <em>${escapeHtml(titleCase(r.mechanic))}</em>` : "";
        return `<div class="kb-tech-rel"><span class="kb-tech-rel-label">Upgraded by</span> ${techBadge(r.tech)}: ${escapeHtml(changeText)}${mechText}</div>`;
      }));
    }
    const unlockSection = relParts.length
      ? `<h3>Unlockable Actions &amp; Upgrades</h3>${relParts.join("")}`
      : `<h3>Unlockable Actions &amp; Upgrades</h3><div class="kb-profile-empty-inline">No techs currently reference this unit.</div>`;

    return `
      <div class="kb-profile-header">
        <canvas class="kb-unit-portrait" width="128" height="128" data-portrait-unit-id="${escapeHtml(unitId)}" data-portrait-race-id="${escapeHtml(portraitRaceId)}"></canvas>
        <div>
          <h2>${escapeHtml(unit.label)}</h2>
          <div class="kb-profile-subline">${escapeHtml(raceLabel)} · ${unit.category === "civilian" ? "Civilian" : "Military"}</div>
          ${flagsHtml}
        </div>
      </div>
      <h3>Base Stats</h3>
      ${statsHtml}
      ${conditionLinksHtml}
      ${actionsHtml}
      ${unlockSection}
    `;
  }

  /** Full HTML for the Units page: list pane + profile pane side by side. */
  function renderUnits(selectedUnitId) {
    return `
      <div class="kb-header"><h2>Units</h2></div>
      <div class="kb-body">
        <div class="kb-list-pane">${renderUnitListHtml(selectedUnitId)}</div>
        <div class="kb-profile-pane">${renderUnitProfileHtml(selectedUnitId)}</div>
      </div>`;
  }

  /** Full HTML for the left-hand condition list -- every icon overlays.js
   *  actually knows how to draw (read live from CONDITION_ICONS, not a
   *  second copy of that list), one flat list (conditions don't have a
   *  natural "kingdom" to group by the way units do). */
  function renderConditionListHtml(selectedKey) {
    const icons = (window.UI.overlays && window.UI.overlays.CONDITION_ICONS) || {};
    // Alphabetical by display name (2026-08-17, user-directed) -- CONDITION_ICONS
    // itself stays in overlays.js's own declaration order (grouped loosely by
    // theme there), this is purely a display-order sort for this list.
    const sortedKeys = Object.keys(icons).sort((a, b) => titleCase(a).localeCompare(titleCase(b)));
    return `<div class="kb-list-group">${sortedKeys.map((key) => {
      const selected = key === selectedKey ? " kb-list-btn-selected" : "";
      return `<button class="kb-list-btn${selected}" data-condition-id="${escapeHtml(key)}">
        <span class="kb-list-btn-symbol">${icons[key]}</span>
        <span>${escapeHtml(titleCase(key))}</span>
      </button>`;
    }).join("")}</div>`;
  }

  /** Full HTML for the right-hand condition profile pane. Null/unknown key
   *  renders the "pick a condition" empty state, same convention as
   *  renderUnitProfileHtml. `backLabel` (optional) renders a Back button
   *  above the profile when this page was reached via a unit's cross-link
   *  -- see main.js's knowledgeBackTarget; wired there, not here, since
   *  going back mutates state this pure-render module doesn't own. */
  function renderConditionProfileHtml(conditionKey, backLabel) {
    const backHtml = backLabel
      ? `<button class="kb-back-btn" id="kb-back-btn">← Back to ${escapeHtml(backLabel)}</button>` : "";
    const icons = (window.UI.overlays && window.UI.overlays.CONDITION_ICONS) || {};
    if (!conditionKey || !icons[conditionKey]) {
      return `${backHtml}<div class="kb-profile-empty">Select a condition on the left to view its description.</div>`;
    }
    const desc = CONDITION_DESCRIPTIONS[conditionKey] || "No description written up yet.";
    return `
      ${backHtml}
      <div class="kb-profile-header">
        <div class="kb-condition-profile-icon">${icons[conditionKey]}</div>
        <div>
          <h2>${escapeHtml(titleCase(conditionKey))}</h2>
        </div>
      </div>
      <div class="kb-condition-profile-desc">${escapeHtml(desc)}</div>
    `;
  }

  /** Full HTML for the Conditions page -- same list+profile layout as
   *  Units (2026-08-16, user-directed), for visual consistency between the
   *  two pages. `backLabel` threads through to renderConditionProfileHtml. */
  function renderConditions(selectedKey, backLabel) {
    return `
      <div class="kb-header"><h2>Conditions</h2></div>
      <div class="kb-body">
        <div class="kb-list-pane">${renderConditionListHtml(selectedKey)}</div>
        <div class="kb-profile-pane">${renderConditionProfileHtml(selectedKey, backLabel)}</div>
      </div>`;
  }

  /** Full HTML for the left-hand stat list, alphabetical by display label
   *  (2026-08-17, user-directed, matching Conditions' own alphabetical
   *  order) -- one flat list, same reasoning as Conditions (no natural
   *  "kingdom" grouping). */
  function renderStatListHtml(selectedKey) {
    const sorted = [...STAT_INFO].sort((a, b) => a.label.localeCompare(b.label));
    return `<div class="kb-list-group">${sorted.map((s) => {
      const selected = s.key === selectedKey ? " kb-list-btn-selected" : "";
      return `<button class="kb-list-btn${selected}" data-stat-id="${escapeHtml(s.key)}">
        <span class="kb-list-btn-symbol">${s.icon}</span>
        <span>${escapeHtml(s.label)}</span>
      </button>`;
    }).join("")}</div>`;
  }

  /** Full HTML for the right-hand stat profile pane. Attack/Defense also
   *  get the live simulator (COMBAT_SIM_HTML) appended below their prose --
   *  wireCombatSimulator (exported) makes it interactive once this HTML is
   *  actually in the DOM, same "render then wire" split as
   *  drawUnitPortrait. `backLabel` -- see renderConditionProfileHtml's own
   *  doc comment, identical convention. */
  function renderStatProfileHtml(statKey, backLabel) {
    const backHtml = backLabel
      ? `<button class="kb-back-btn" id="kb-back-btn">← Back to ${escapeHtml(backLabel)}</button>` : "";
    const label = STAT_LABEL_BY_KEY[statKey];
    if (!label) {
      return `${backHtml}<div class="kb-profile-empty">Select a stat on the left to view its description.</div>`;
    }
    const desc = STAT_DESCRIPTIONS[statKey] || "No description written up yet.";
    const simHtml = (statKey === "attack" || statKey === "defense") ? COMBAT_SIM_HTML : "";
    return `
      ${backHtml}
      <div class="kb-profile-header">
        <div class="kb-condition-profile-icon">${STAT_ICON_BY_KEY[statKey]}</div>
        <div>
          <h2>${escapeHtml(label)}</h2>
        </div>
      </div>
      <div class="kb-condition-profile-desc">${escapeHtml(desc)}</div>
      ${simHtml}
    `;
  }

  /** Full HTML for the Stats page -- same list+profile layout as Units and
   *  Conditions (2026-08-17, user-directed). `backLabel` threads through to
   *  renderStatProfileHtml. */
  function renderStats(selectedKey, backLabel) {
    return `
      <div class="kb-header"><h2>Stats</h2></div>
      <div class="kb-body">
        <div class="kb-list-pane">${renderStatListHtml(selectedKey)}</div>
        <div class="kb-profile-pane">${renderStatProfileHtml(selectedKey, backLabel)}</div>
      </div>`;
  }

  window.UI.knowledgebase = { renderUnits, renderConditions, renderStats, drawUnitPortrait, wireCombatSimulator };
})();
