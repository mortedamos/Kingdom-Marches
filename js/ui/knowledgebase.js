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
  // linking to that condition's own writeup.
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
    forcedRest: "Shaken by a near-death blow -- forced to Rest for exactly one turn, then clears on its own.",
    defending: "Actively defending this turn -- doubles this unit's Defense against any attack.",
    killMomentum: "Riding the momentum of a recent kill (Orc's Violent Momentum) -- temporary bonuses to First Strike and Double Strike chance.",
    flying: "Moves over any terrain ignoring movement penalties, though a non-Ranged attacker still has a flat chance to simply miss it. Either a permanent trait of the unit type, or temporarily granted (e.g. the Human Flight tech).",
    crusadeAura: "Within a Paladin's Crusade aura: +2 Attack, +1 Defense, +25% Siege, and a small heal, refreshed every turn the aura still reaches it.",
    heavyMetalAura: "Within a Troubadour's Heavy Metal performance: +2 Defense, +30% Siege, and a small heal, refreshed every turn the aura still reaches it.",
    powerMetalAura: "Within a Troubadour's Power Metal performance: +2 Attack and +5% First Strike, refreshed every turn the aura still reaches it.",
    burning: "Aflame -- 1 damage at the start of every turn for 3 turns, unless standing on Coast, Ocean, or a river tile.",
    zombie: "A reanimated corpse fighting at a fraction of its living stats -- Undead's Raise Dead.",
    befuddled: "Confused by a Halfellow Trouble Maker's Riddle -- Attack, Movement, and Defense all cut by 75% for a few turns.",
    resting: "Standing down this turn to recover HP.",
    webbed: "Snared in webbing -- movement locked to zero for 1 turn, but it can still fight back at full strength if something is already adjacent.",
    poisoned: "Venom in its veins -- 1 damage at the start of every turn for 3 turns. Mechanically identical to Burning, just from a venomous source (e.g. the Marsh Adder) instead of fire.",
    keepingWatch: "Posted as a lookout (Halfellow's Keep an Eye Out) -- holds position with +3 Vision.",
    greatBonfireAura: "Within The Great Bonfire's warmth (Halfellow's Banish the Darkness): heals 10% of max HP per turn (minimum 1) regardless of resting, +2 Defense, +2 Vision, +1 Movement, +5% First Strike, and +10% Double Strike -- also cures, and grants immunity to, Burning, Poisoned, Frozen, Curse, Befuddled, and Webbed. Refreshed every turn the aura still reaches it.",
  };

  // Every stat shown on a unit's profile, cross-linked to its own KMKB
  // entry. `key` matches STAT_DESCRIPTIONS
  // below; `unitField`/`derive` say how renderUnitProfileHtml pulls this
  // stat's VALUE off a real unit -- most read a plain units.js field
  // directly, maxHp is derived (see units.js's own unitMaxHP). `icon`
  // -- same "small icon before the name"
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

  // Live Attack-vs-Defense simulator, embedded
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
  // Hand-picked display names for the rare condition whose real name can't
  // be mechanically derived from titleCase(conditionKey) -- e.g.
  // greatBonfireAura's possessive apostrophe ("Bonfire's Blessing"), which
  // no camelCase-to-spaced transform can produce. Falls back to titleCase
  // for every other condition, so this only ever needs an entry when that
  // plain transform would be wrong.
  const CONDITION_DISPLAY_NAME_OVERRIDES = {
    greatBonfireAura: "Bonfire's Blessing",
  };
  function conditionDisplayName(key) {
    return CONDITION_DISPLAY_NAME_OVERRIDES[key] || titleCase(key);
  }
  function pctLabel(x) {
    return `${Math.round(x * 100)}%`;
  }

  /** Every unit id, grouped for the list pane: Universal (no raceOnly, not a
   *  monster) first, then one group per real race, then Wandering Monsters
   *  last. Pure derivation from units.js/races.js -- add a unit anywhere in
   *  units.js and it appears in the right group automatically, no
   *  registration step.
   *
   *  `playerRaceId` (2026-08-27, user-directed): in a running single-player
   *  game, that race's own group is moved to right after Universal instead
   *  of sitting wherever RACE_LIST happens to put it -- the kingdom you're
   *  actually playing is what you look up units for most, so it shouldn't
   *  take extra scrolling to reach. Every other race keeps RACE_LIST's
   *  normal order behind it. Passing null/undefined (title screen, no game
   *  running, or spectating) leaves plain RACE_LIST order untouched -- see
   *  main.js's renderKnowledgeOverlay for how that's decided. */
  function groupedUnits(playerRaceId) {
    const groups = [];
    const universal = window.GameData.UNIT_LIST.filter((id) => {
      const u = window.GameData.getUnit(id);
      return !u.raceOnly && !window.GameData.MONSTER_UNIT_IDS.has(id);
    });
    if (universal.length) groups.push({ key: "universal", label: "Universal — Any Kingdom", units: universal });
    const orderedRaceIds = playerRaceId && window.GameData.RACE_LIST.includes(playerRaceId)
      ? [playerRaceId, ...window.GameData.RACE_LIST.filter((r) => r !== playerRaceId)]
      : window.GameData.RACE_LIST;
    for (const raceId of orderedRaceIds) {
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
   *  render it) onto `canvas`. If that art isn't already loaded -- e.g. the
   *  title screen, where nothing has been preloaded yet, or any race not in
   *  the current game -- the unit's `symbol` glyph is drawn immediately so
   *  the canvas is never blank, while a real, targeted load for just this
   *  one (unitId, raceId) pair is kicked off (sprites.js's
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
   *  unitConditionLinksHtml, so it isn't listed twice on the same page.
   *
   *  `actionKey` (2026-08-28, user-directed): when this capability has a
   *  matching entry on the Actions page, its key -- renderUnitProfileHtml
   *  turns that into a clickable cross-link, same jumpToAction pattern
   *  unitConditionLinksHtml's data-condition-link already uses. Left
   *  undefined for a capability with no real menu action behind it today
   *  (canImprove/canExplore aren't wired to any ring option anywhere in the
   *  engine -- see orders.js's contextMenuOptions -- and Naval Movement is a
   *  movement modifier, not a distinct action), which just renders as a
   *  plain, unlinked chip. */
  function availableActionsFor(unit) {
    const actions = [];
    // Dwarf "Bombardment": Bombard has no ordinary attack at all (see
    // units.js's noOrdinaryAttack/ai.js's considerAttackOrGarrison guard)
    // -- its only offense is the standalone Bombardment blast.
    if (unit.noOrdinaryAttack) actions.push({ label: "Bombardment", actionKey: "bombardment" });
    else if (unit.attack > 0) actions.push({ label: "Attack", actionKey: "attack" });
    if (unit.movement > 0) actions.push({ label: "Move", actionKey: "moveTo" });
    if (unit.canFoundCity) actions.push({ label: "Found a City", actionKey: "foundCity" });
    if (unit.canBuildRoad) actions.push({ label: "Build Roads", actionKey: "buildRoad" });
    if (unit.canImprove) actions.push({ label: "Improve Terrain" });
    if (unit.canProspect) actions.push({ label: "Gather Resources (Mine, Hunt, Farm, or Fish)", actionKey: "gatherResources" });
    if (unit.canExplore) actions.push({ label: "Auto-Explore" });
    if (unit.canCarryUnit) actions.push({ label: "Carry Another Unit", actionKey: "carryUnit" });
    if (unit.isNaval) actions.push({ label: "Naval Movement" });
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
          <span class="kb-condition-link-text">${escapeHtml(conditionDisplayName(link.conditionKey))} — ${escapeHtml(link.describe(unit[link.field]))}</span>
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
   *  (may be null) just controls which button gets the "selected" style.
   *  `playerRaceId` -- see groupedUnits' own doc comment. */
  function renderUnitListHtml(selectedUnitId, playerRaceId) {
    return groupedUnits(playerRaceId).map((g) => `
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
    // -- data-stat-link keys match STAT_INFO,
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

    // Actions page cross-links (2026-08-28, user-directed): a capability
    // with a real matching entry on the Actions page (see
    // availableActionsFor's own actionKey doc comment) renders as a
    // clickable chip -- data-action-link, wired in main.js's
    // renderKnowledgeOverlay same as data-condition-link/data-stat-link
    // just above.
    const actions = availableActionsFor(unit);
    const actionsHtml = actions.length
      ? `<h3>Available Actions</h3><div class="kb-chip-row">${actions.map((a) => a.actionKey
          ? `<button class="kb-chip kb-chip-action kb-chip-link" data-action-link="${escapeHtml(a.actionKey)}">${escapeHtml(a.label)}</button>`
          : `<span class="kb-chip kb-chip-action">${escapeHtml(a.label)}</span>`).join("")}</div>`
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

  /** Full HTML for the Units page: list pane + profile pane side by side.
   *  `playerRaceId` -- see groupedUnits' own doc comment (threaded through
   *  renderUnitListHtml, unused by the profile pane). */
  function renderUnits(selectedUnitId, playerRaceId) {
    return `
      <div class="kb-header"><h2>Units</h2></div>
      <div class="kb-body">
        <div class="kb-list-pane">${renderUnitListHtml(selectedUnitId, playerRaceId)}</div>
        <div class="kb-profile-pane">${renderUnitProfileHtml(selectedUnitId)}</div>
      </div>`;
  }

  // The same crafted glyph sidebar.js's economy table uses (index.html's
  // #icon-harvest/#icon-coin/#icon-lore <symbol> defs) -- resource key
  // doubles as the symbol id since they're already named "icon-harvest"
  // etc. Same small helper buildlist.js/techtree.js each keep their own
  // copy of.
  function resourceIconHtml(key) {
    return `<svg class="resource-icon"><use href="#icon-${key}"></use></svg>`;
  }

  /** Every building id, grouped for the list pane: Universal (walls and
   *  bridges -- the only two building ids without a raceOnly) first, then
   *  one group per real race. No "monsters" group -- monsters don't build
   *  structures. Pure derivation from buildings.js/races.js, same "add one
   *  anywhere, it shows up automatically" shape as groupedUnits above --
   *  including that same RACE_LIST scope, which quietly excludes Undead
   *  (not a playable race) the identical way groupedUnits already does for
   *  Undead units.
   *
   *  `playerRaceId` -- identical convention to groupedUnits' own: in a
   *  running single-player game, that race's own group moves to right
   *  after Universal instead of sitting wherever RACE_LIST order puts it.
   *  See main.js's renderKnowledgeOverlay for how that's decided. */
  function groupedStructures(playerRaceId) {
    const groups = [];
    const universal = window.GameData.BUILDING_LIST.filter((id) => !window.GameData.getBuilding(id).raceOnly);
    if (universal.length) groups.push({ key: "universal", label: "Universal — Any Kingdom", ids: universal });
    const orderedRaceIds = playerRaceId && window.GameData.RACE_LIST.includes(playerRaceId)
      ? [playerRaceId, ...window.GameData.RACE_LIST.filter((r) => r !== playerRaceId)]
      : window.GameData.RACE_LIST;
    for (const raceId of orderedRaceIds) {
      const ids = window.GameData.BUILDING_LIST.filter((id) => window.GameData.getBuilding(id).raceOnly === raceId);
      if (ids.length) groups.push({ key: raceId, label: window.GameData.getRace(raceId).label, ids });
    }
    return groups;
  }

  /** Which race's art to preview a universal structure (wall/bridge) with --
   *  same "human is as good a default as any" fallback portraitRaceFor uses
   *  for a raceOnly-less unit. */
  function structurePortraitRaceFor(building) {
    return building.raceOnly || "human";
  }

  /** Draws a static preview of `buildingId` (as `raceId` would render it)
   *  onto `canvas`. Buildings are single static images, not multi-frame
   *  idle animations like units -- see render.js's own building/wall draw
   *  passes, which read img.naturalWidth/Height directly with no
   *  manifest/currentFrame involved, mirrored here. No lazy ensure-load
   *  either, unlike drawUnitPortrait: sprites.js has no building equivalent
   *  of ensureUnitLoaded, so a race whose art isn't already preloaded for
   *  THIS session (any race not actually in the current game) just falls
   *  back to the symbol glyph below, same as a totally missing sprite
   *  would. Wall segments need an orientation -- "node" previews the plain,
   *  unconnected look a lone isolated wall tile actually has in a real
   *  game. Bottom-anchored, aspect-ratio preserved, same as how the map's
   *  own isometric tile draw sits a building/wall on its tile rather than
   *  stretching it to fill a square. */
  function drawStructurePortrait(canvas, buildingId, raceId) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const building = window.GameData.getBuilding(buildingId);
    const sprite = building.isWall
      ? window.UI.sprites.pickWallSegment(buildingId, raceId, "node", null)
      : window.UI.sprites.pickBuilding(buildingId, raceId, null);
    if (sprite) {
      const img = sprite.image;
      const scale = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
      const dw = img.naturalWidth * scale, dh = img.naturalHeight * scale;
      ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, (canvas.width - dw) / 2, canvas.height - dh, dw, dh);
      return;
    }
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${Math.round(canvas.width * 0.55)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#c9a857";
    ctx.fillText(building.symbol || "?", canvas.width / 2, canvas.height / 2 + canvas.width * 0.04);
  }

  /** Full HTML for the left-hand structure list, grouped by kingdom (plus
   *  Universal for walls/bridges) -- same shape as renderUnitListHtml.
   *  `playerRaceId` -- see groupedStructures' own doc comment. */
  function renderStructureListHtml(selectedBuildingId, playerRaceId) {
    return groupedStructures(playerRaceId).map((g) => `
      <div class="kb-list-group">
        <div class="kb-list-group-label">${escapeHtml(g.label)}</div>
        ${g.ids.map((id) => {
          const b = window.GameData.getBuilding(id);
          const selected = id === selectedBuildingId ? " kb-list-btn-selected" : "";
          return `<button class="kb-list-btn${selected}" data-structure-id="${escapeHtml(id)}">
            <span class="kb-list-btn-symbol">${escapeHtml(b.symbol || "")}</span>
            <span>${escapeHtml(b.label)}</span>
          </button>`;
        }).join("")}
      </div>
    `).join("");
  }

  /** Every structured effect field a building can carry, in display order,
   *  each formatted into one player-facing line -- deliberately data-driven
   *  only, same discipline availableActionsFor uses for units: a building
   *  whose whole effect lives in hardcoded engine logic (see buildings.js's
   *  own header comment on why most of them do) simply shows no Effects
   *  section at all, rather than this file trying to hand-transcribe every
   *  building's own code comment into prose that could drift out of sync
   *  with it. `defense` is deliberately NOT here -- it reads as a base
   *  combat stat (same page as Max HP), not a passive effect, so it's
   *  folded into the stats block below instead. */
  const STRUCTURE_EFFECTS = [
    ["yield", (v) => ["harvest", "coin", "lore"].filter((k) => v[k])
      .map((k) => `${resourceIconHtml(k)}+${v[k]} ${titleCase(k)}`).join(", ")],
    ["yieldPct", (v) => ["harvest", "coin", "lore"].filter((k) => v[k])
      .map((k) => `+${Math.round(v[k] * 100)}% ${titleCase(k)} (this city)`).join(", ")],
    ["influenceMult", (v) => `+${Math.round((v - 1) * 100)}% Influence (this city)`],
    ["radiusBonus", (v) => `+${v} Influence Radius`],
    ["visionRadiusBonus", (v) => `+${v} Vision Radius`],
    ["unitCostMult", (v) => `${Math.round((1 - v) * 100)}% cheaper and faster unit production here, plus a civ-wide upkeep discount`],
    ["coinPerAdjacentRoad", (v) => `+${v} Coin per adjacent Road tile`],
    ["lorePerAdjacentForest", (v) => `+${v} Lore per adjacent Forest tile`],
    ["contestedYieldPenaltyOverride", (v) => `Contested tiles here yield at ${Math.round(v * 100)}% instead of the usual penalty`],
    ["raiseDeadPowerBonus", (v) => `+${Math.round(v * 100)}% Raise Dead unit power`],
  ];

  /** Full HTML for the right-hand structure profile pane -- everything BUT
   *  the portrait canvas's actual pixels (drawStructurePortrait fills that
   *  in after this HTML is in the DOM, same split drawUnitPortrait uses).
   *  Null/unknown buildingId renders the "pick a structure" empty state. */
  function renderStructureProfileHtml(buildingId) {
    if (!buildingId || !window.GameData.BUILDINGS[buildingId]) {
      return `<div class="kb-profile-empty">Select a structure on the left to view its profile.</div>`;
    }
    const b = window.GameData.getBuilding(buildingId);
    const raceLabel = b.raceOnly ? window.GameData.getRace(b.raceOnly).label : "Universal — any kingdom can build this";
    const category = b.isWall ? "Wall" : b.isBridge ? "Bridge" : "Building";
    const portraitRaceId = structurePortraitRaceFor(b);

    // Full harvest/coin/lore breakdown when the unlocking tech's own
    // costBreakdown is available (see buildings.js's buildingBuildCost),
    // else the legacy flat-Coin fallback that function itself falls back
    // to -- same two-tier convention buildlist.js's own cost rendering
    // already follows for a build queue row.
    const cost = window.GameData.buildingBuildCost(buildingId);
    const costHtml = cost
      ? ["harvest", "coin", "lore"].filter((k) => cost[k]).map((k) => `${resourceIconHtml(k)}${cost[k]}`).join(" ")
      : `${resourceIconHtml("coin")}${b.coinCost || 0}`;

    const statsHtml = `
      <div class="stat-row"><span>Cost</span><span>${costHtml}</span></div>
      <div class="stat-row"><span>Max HP</span><span>${b.maxHp}</span></div>
      ${b.defense != null ? `<div class="stat-row"><span>Defense</span><span>${b.defense}</span></div>` : ""}
    `;

    // Placement chip: walls/bridges stack (one per open adjacent tile, see
    // buildings.js's own header comment on the exception), the 4 unique
    // race buildings don't (exactly one of each, ever, per kingdom).
    const placementNote = (b.isWall || b.isBridge)
      ? "Multiple per city — one per open adjacent tile"
      : "One of exactly 4 per kingdom — each race's own unique roster";
    const reqs = [];
    if (b.requiresHillsAdjacent) reqs.push("Requires adjacent Hills");
    if (b.requiresForestAdjacent) reqs.push("Requires adjacent Forest");
    const placementHtml = `<div class="kb-chip-row">
      <span class="kb-chip">${escapeHtml(placementNote)}</span>
      ${reqs.map((r) => `<span class="kb-chip">${escapeHtml(r)}</span>`).join("")}
    </div>`;

    const effectLines = STRUCTURE_EFFECTS
      .filter(([key]) => b[key] != null)
      .map(([key, fmt]) => `<div class="kb-tech-rel">${fmt(b[key])}</div>`)
      .join("");
    // A Wall's contribution to its CITY's own Defense score (2026-08-27,
    // user-directed) -- a SEPARATE number from the Defense stat above,
    // which only mitigates damage to the wall itself when IT'S the one
    // being attacked. Reads window.GameConfig.combat.cityDefensePerWall
    // directly rather than a building-data field, since that's genuinely
    // where the number lives (combat.js's cityDefenseValue) -- the same
    // engine constant sidebar.js's own city-panel Defense row already
    // reads for its "(+N from M walls)" tag, so this can never silently
    // drift from what an actual attack is resolved against.
    const wallCityDefenseHtml = b.isWall
      ? `<div class="kb-tech-rel">+${window.GameConfig.combat.cityDefensePerWall} to this city's own Defense score — stacks with every other alive Wall the city has, separate from this Wall's own Defense stat above</div>`
      : "";
    const effectsHtml = (effectLines || wallCityDefenseHtml) ? `<h3>Effects</h3>${wallCityDefenseHtml}${effectLines}` : "";

    // Single tech, not a multi-relation scan like techRelationsForUnit --
    // every building (walls/bridges included) resolves to exactly one
    // unlocking tech, see buildings.js's own techForBuilding.
    const techId = window.GameData.techForBuilding(buildingId);
    const unlockHtml = techId
      ? `<h3>Unlocked By</h3><div class="kb-tech-rel">${techBadge(window.GameData.getTech(techId))}</div>`
      : "";

    return `
      <div class="kb-profile-header">
        <canvas class="kb-unit-portrait" width="128" height="128" data-portrait-structure-id="${escapeHtml(buildingId)}" data-portrait-race-id="${escapeHtml(portraitRaceId)}"></canvas>
        <div>
          <h2>${escapeHtml(b.label)}</h2>
          <div class="kb-profile-subline">${escapeHtml(raceLabel)} · ${escapeHtml(category)}</div>
        </div>
      </div>
      <h3>Base Stats</h3>
      ${statsHtml}
      ${placementHtml}
      ${effectsHtml}
      ${unlockHtml}
    `;
  }

  /** Full HTML for the Structures page: list pane + profile pane side by
   *  side -- same layout as Units. `playerRaceId` -- see groupedStructures'
   *  own doc comment (threaded through renderStructureListHtml, unused by
   *  the profile pane). */
  function renderStructures(selectedBuildingId, playerRaceId) {
    return `
      <div class="kb-header"><h2>Structures</h2></div>
      <div class="kb-body">
        <div class="kb-list-pane">${renderStructureListHtml(selectedBuildingId, playerRaceId)}</div>
        <div class="kb-profile-pane">${renderStructureProfileHtml(selectedBuildingId)}</div>
      </div>`;
  }

  /**
   * ACTIONS PAGE
   * ------------
   * Every real ring-menu action in the game -- audited directly against
   * orders.js's contextMenuOptions (unit ring) and cityRingOptions (city
   * ring), the two functions that build what a player actually sees, as of
   * 2026-08-28. Hand-written, same "can't be derived from data alone"
   * reasoning as CONDITION_DESCRIPTIONS/STAT_DESCRIPTIONS above -- most of
   * these are bespoke engine logic (ai.js's perform* functions), not a
   * structured data field this file could read and format generically the
   * way STRUCTURE_EFFECTS does for a building.
   *
   * Deliberately NOT one entry per ring pill: a standing order's Cancel
   * variant (Cancel Sentry, Cancel Follow, Cancel Rest and Defend, ...) is
   * folded into its own entry's description rather than getting a second
   * profile, and the two-stage placement pills (Move To.../Attack.../Build
   * Road To...) share their target-tile sibling's single entry (moveTo/
   * attack/buildRoad) -- both pairs are the exact same action, just two
   * different entry points into choosing where it applies.
   *
   * `restriction` (optional): which kingdom/unit this is gated to, shown as
   * a chip on the profile -- omitted entirely for a universal action any
   * unit (subject to its own capability flags) or any city can take.
   */
  const CITY_ACTIONS = [
    {
      key: "buildUnit", label: "Build Unit", icon: "⚔️",
      description: "Opens this city's build list and queues a unit. The unit's full stockpile cost (Harvest/Coin/Lore, scaled by rarity and by how many of that unit this civ already fields) is paid immediately; the city then spends every turn afterward on a fixed countdown until it's ready, during which it can't be given a different order. Offered whenever the city isn't already mid-build or spending this turn on Gather Resources, and at least one unit is actually available to build.",
    },
    {
      key: "buildStructure", label: "Build Structure", icon: "🏛️",
      description: "Same build-list mechanism as Build Unit, but for a Wall, Bridge, or Building instead. The pill itself shows how many distinct structures are currently available (Walls/Bridges aren't counted individually there, since a city can build any number of those -- one per open adjacent tile).",
    },
    {
      key: "resourceProduction", label: "Gather More Resources", icon: "💰",
      description: "Devotes this city's production for the turn straight into the stockpile instead of a unit or building: an extra 100% of whatever Harvest/Coin/Lore the city would normally yield this turn, banked immediately on top of its ordinary income. Only offered once the city actually has something to double.",
    },
    {
      key: "research", label: "Research Tech", icon: "🔬",
      description: "Spends this city's production turn, PLUS a stockpile cost that scales with population, to cut turns off whatever tech the kingdom is currently researching -- the city's own population sets how many turns it can shave off in one go. Only offered while a tech is actually in progress and the civ can afford the stockpile price.",
    },
    {
      key: "expediteBuild", label: "Expedite Unit Build", icon: "⏩", restriction: "Requires a Bazaar (Human)",
      description: "Pays a stockpile premium -- roughly one turn's own share of the unit's cost, at a 3x markup -- to shave exactly one turn off a unit currently under construction. Only offered once at least 2 turns remain on the build, and only in a city that has a Bazaar.",
    },
    {
      key: "cancelBuild", label: "Cancel Build", icon: "🚫",
      description: "Abandons whatever this city is currently building, freeing it to be given a different order next turn. The stockpile already spent when the build was queued is NOT refunded.",
    },
    {
      key: "spreadCulture", label: "Spread Culture", icon: "🎭",
      description: "A paid, one-turn boost to this city's influence-tile spread rate (+50%), funded entirely from the civ's stockpile rather than the city's own production -- so it stacks freely with a queued build, Gather Resources, or Research Tech the very same turn. Cost scales with the city's population.",
    },
    {
      key: "toggleAutomate", label: "Automate City", icon: "🤖",
      description: "Hands this city's turn-by-turn decisions -- culture, resource gathering, or boosting research, whichever the engine judges most useful that turn -- to the AI, indefinitely, until switched back off. Never queues a unit or building on its own; a manually queued build still takes priority over the automation.",
    },
  ];

  const UNIT_ACTIONS = [
    // -- Universal (every unit, subject to its own capability flags) --
    {
      key: "moveTo", label: "Move", icon: "👣",
      description: "Walks the unit toward a chosen tile, spending movement points along the way -- terrain, roads, and rivers all change the cost per tile. Picking a tile beyond this turn's reach queues the rest as a standing order that continues automatically on future turns until it arrives, is cancelled (Stop Order), or is interrupted.",
    },
    {
      key: "attack", label: "Attack", icon: "⚔️",
      description: "Strikes an enemy unit, structure, or city within this unit's range. See the Attack and Defense stat pages for the exact damage formula -- melee (range 1) draws a counterattack back unless First Strike denies it, while a Ranged attack (range greater than 1) never does.",
    },
    {
      key: "buildRoad", label: "Build Roads", icon: "🛤️", restriction: "Pioneer only",
      description: "Lays one road tile, either on the Pioneer's own tile immediately (Build Road Here) or, via Build Road To..., one new segment per turn along the path toward a chosen destination -- a road under construction is never left half-finished with a gap partway through. Speeds movement, and boosts a nearby city's yield for certain kingdoms' techs.",
    },
    {
      key: "foundCity", label: "Found City", icon: "🏳️", restriction: "Pioneer only",
      description: "Consumes the Pioneer to found a new city on its current tile (Found City), or, from a remote tile's own ring, walks it there first (Found City Here). Only legal on suitable land, far enough from any existing city. The very first city a kingdom founds grants one free Tier 1 tech of the player's choice.",
    },
    {
      key: "buildBridge", label: "Build Bridge", icon: "🌉", restriction: "Pioneer only",
      description: "Offered while standing at the water's edge. Pays a flat Coin cost to lay one bridge segment on a chosen adjacent water tile -- a bridge counts as a road for movement/yield purposes, and lets land units cross the water it spans.",
    },
    {
      key: "helpBuild", label: "Help Build", icon: "🔨", restriction: "Pioneer only",
      description: "Offered to a Pioneer standing in a city of its own kingdom that's currently building a unit. Spends the Pioneer's turn to cut one extra turn off that build, on top of the automatic per-turn countdown.",
    },
    {
      key: "gatherResources", label: "Gather Resources", icon: "⛏️",
      description: "Channels a unit into a standing resource-collection order on the tile it's standing on -- Mine a gold/iron vein, Hunt Game, Farm fertile ground, Fish (Galley only), or Delve a Ruin, depending on the tile, the unit's own capabilities, and the kingdom's unlocked mechanics. Accumulates a stash turn after turn until Claim Gathered Resources banks it to the stockpile, or Cancel abandons it.",
    },
    {
      key: "openChest", label: "Open Chest", icon: "🎁",
      description: "Spends the unit's turn opening a chest resource tile. An 80% chance it pays out -- Coin, Lore, XP, a temporary map reveal, or a research-turn discount, one picked at random -- and a 20% chance it's trapped instead, dealing flat damage plus a status effect and no reward.",
    },
    {
      key: "restAndDefend", label: "Rest and Defend", icon: "🏕️",
      description: "A standing order, available to any unit that hasn't yet acted this turn: the unit holds position, healing and gaining doubled Defense against any attack, persisting automatically every turn until cancelled (Cancel Rest and Defend) or superseded by a new order.\n\nWhile standing in one of this kingdom's own cities, it additionally grants that city a defensive bonus package for as long as it stays there:\n- Heals every structure in the city -- every Wall and every ordinary Building alike -- by 1 HP per turn.\n- Raises the city's Wall potshot fire chance from 50% to 75%, and its Wall potshot attack by +2, on top of whatever its tier already grants.\n- The same +25 percentage point / +2 attack boost applies to a Human city's Mage College potshot too (75% to 100% fire chance).\n- Elf's Warden of the Trees, if unlocked: when the resting unit is itself a Scout, Ranger, Blade Dancer, or Druid, the city's Wall potshots use THAT unit's own attack power and on-hit properties (Poison/Frozen chance, Double Strike) instead of the flat tier value.\n- When the resting unit is specifically a military-category unit, the city's influence tiles also fill in faster: this kingdom's own Industriousness trait scaled by 50%, plus a flat +25% on top -- compounding multiplicatively with any tech that already speeds up fill-in.",
    },
    {
      key: "automate", label: "Automate Actions", icon: "🎛️",
      description: "Hands this one unit's turn-by-turn decisions to the same AI logic that runs every computer-controlled kingdom, indefinitely, until switched back off or given a manual order (which ends automation automatically). A Dire Wolf reads as \"Hunt for Prey\" instead, since its automated behavior is almost entirely about running down game.",
    },
    {
      key: "sentry", label: "Sentry", icon: "👁️",
      description: "A standing order for a unit with an attack stat: holds position doing nothing until an enemy comes within range, then attacks it on its own, without waiting for a fresh order. Persists turn after turn until cancelled (Cancel Sentry) or the unit is given something else to do.",
    },
    {
      key: "follow", label: "Follow…", icon: "🚶",
      description: "A standing order to move toward, and stay adjacent to, a chosen allied unit every turn -- the target can be any of this kingdom's other units, anywhere on the map. Persists until cancelled (Cancel Follow) or superseded.",
    },
    {
      key: "disband", label: "Disband Unit", icon: "💀",
      description: "Permanently removes the unit from the kingdom. No refund of whatever it cost to build.",
    },
    {
      key: "levelUp", label: "Level Up!", icon: "⭐",
      description: "Only appears once the unit has banked enough combat XP for a new veteran level. Opens a choice of permanent stat bonuses -- Attack, Defense, Siege, First Strike, or Double Strike, depending on what's on offer -- see those stats' own pages for what each one actually does in a fight.",
    },
    {
      key: "goHidden", label: "Go Hidden", icon: "🌙",
      description: "Offered to any unit whose kingdom has unlocked stealth, once eligible. Conceals the unit from enemy vision -- see the Hidden condition's own page for the full mechanical effect, including the extra movement cost and the +50% Defense if it's attacked anyway.",
    },
    {
      key: "stopOrder", label: "Stop Order", icon: "🛑",
      description: "Cancels a unit's standing multi-turn Move/Build Road order, leaving it exactly where it currently stands, free for a fresh order.",
    },
    {
      key: "carryUnit", label: "Carry / Board / Drop Off", icon: "🫴",
      description: "A carrier unit (Galley, Dragon, ...) can Carry an adjacent eligible passenger aboard, or a passenger can Board an adjacent carrier -- either way, both units spend their turn. Once aboard, Drop Off disembarks the passenger onto any open adjacent tile, without spending the carrier's own turn.",
    },
    {
      key: "enterCave", label: "Enter Cave", icon: "🕳️",
      description: "Any unit standing on a cave entrance can spend its turn to emerge instantly at that cave's one linked exit elsewhere on the map -- a universal terrain shortcut, available to every kingdom, no tech required.",
    },
    // -- Race-specific special abilities --
    {
      key: "actAsEnvoy", label: "Act as Envoy", icon: "📜", restriction: "Halfellow — Pioneer or Wanderer",
      description: "Standing on an already-in-radius but still-unclaimed tile of one of this kingdom's own cities, claims that tile outright on the spot -- instead of waiting for the city's normal gradual fill-in rate to reach it.",
    },
    {
      key: "castFlight", label: "Cast Fly", icon: "🪽", restriction: "Human — Wizard",
      description: "Grants an adjacent allied military unit the Flying property plus +3 Movement and +3 Vision for 5 turns -- it moves over any terrain, ignoring movement penalties, for the duration. Costs the Wizard's turn; does not spend the recipient's.",
    },
    {
      key: "activateAura", label: "Activate Aura", icon: "🎸", restriction: "Human — Troubadour",
      description: "Switches the Troubadour's performance on, buffing every ally within 1 tile (2 with Epic Metal) every turn it stays active -- see the Heavy Metal Aura/Power Metal Aura condition pages for exactly what each performance grants. An AI-controlled Troubadour's aura is always on; this toggle only matters for a human player's own.",
    },
    {
      key: "rootsOfTheWorld", label: "Roots of the World", icon: "🌳", restriction: "Elf — Druid",
      description: "Instantly moves the Druid itself, or a currently-adjacent ally, to any unoccupied, already-explored Forest tile -- no travel time, but Forest-only (compare Human's Teleportation, which can land anywhere). Costs the Druid's whole turn; the target's turn is also spent if it isn't the Druid itself.",
    },
    {
      key: "teleportation", label: "Teleportation", icon: "✨", restriction: "Human — Wizard",
      description: "Instantly moves the Wizard itself, or a currently-adjacent ally, to any unoccupied, already-explored tile of any terrain. The teleported unit has a 50% chance to land Befuddled for 1 turn from the disorientation. Costs the Wizard's whole turn; the target's turn is also spent if it isn't the Wizard itself.",
    },
    {
      key: "naturesGrace", label: "Nature's Grace", icon: "💚", restriction: "Elf — Druid",
      description: "Heals a chosen ally within the Druid's own attack range for a random 30%-60% of that ally's max HP (minimum 1). Costs the Druid's whole turn, no exhaustion afterward.",
    },
    {
      key: "fireball", label: "Fireball!", icon: "🔥", restriction: "Human — Wizard",
      description: "Blasts a 3x3 area anywhere within 3 tiles -- no target required inside it, the whole block is hit -- dealing damage to every unit and structure caught there, each independently rolling a 50% chance to also catch fire. Costs the Wizard's whole turn.",
    },
    {
      key: "bombardment", label: "Bombardment", icon: "💣", restriction: "Dwarf — Bombard",
      description: "Bombard's ONLY offensive action -- it has no ordinary melee/ranged attack at all. Blasts a 2x2 block anywhere within 3 tiles, dealing damage to every unit, structure, or city caught there, each independently rolling the Bombard's own burn chance to also catch fire.",
    },
    {
      key: "riddle", label: "Riddle", icon: "❓", restriction: "Halfellow — Trouble Maker or Wanderer",
      description: "A ranged debuff (reaches as far as the caster's own attack range) -- poses a riddle to the nearest enemy in range, which resists (nothing happens) with a chance equal to its race's own Curiosity trait × 0.75, or otherwise becomes Befuddled for 2 turns. Using it reveals the caster if it was Hidden. A 3-round cooldown applies per caster afterward, win or lose.",
    },
    {
      key: "resourceHeist", label: "Resource Heist", icon: "🥷", restriction: "Halfellow — Trouble Maker",
      description: "Steals an adjacent enemy unit's entire accumulated Gather Resources stash outright -- banking it for the thief's own kingdom instead -- and Befuddles the victim for 2 turns. If the Trouble Maker was Hidden, there's a chance (scaled by the victim's own race's Curiosity trait) it gets spotted in the act.",
    },
    {
      key: "unlockTheGate", label: "Unlock the Gate", icon: "🔓", restriction: "Halfellow — Trouble Maker",
      description: "Targets one enemy Wall segment: suppresses that city's ENTIRE wall-derived Defense score by 75% for 3 turns (every alive wall's contribution, not just the targeted one), AND separately makes that one specific wall passable to enemy movement for the same window -- every other wall the city has keeps blocking movement as normal.",
    },
    {
      key: "summonRaptor", label: "Summon Raptor", icon: "🦖", restriction: "Elf — Druid",
      description: "Instantly summons a Raptor on an open tile adjacent to the Druid -- one live Raptor per Druid at a time; once it dies (or hasn't been summoned yet), summoning again is free to do.",
    },
    {
      key: "summonShadowsteed", label: "Summon Shadowsteed", icon: "🐴", restriction: "Elf — Druid",
      description: "Instantly summons a Shadowsteed on an open tile adjacent to the Druid -- one live Shadowsteed per Druid at a time, same cap shape as Summon Raptor.",
    },
    {
      key: "direBearForm", label: "Become Dire Bear / Revert to Druid", icon: "🐻", restriction: "Elf — Druid or Dire Bear",
      description: "A Druid can transform into a Dire Bear (a heavier melee combat form) on the spot, and a Dire Bear can revert back to Druid form the same way -- current HP carries over proportionally to the new form's max HP either direction. A transformed Dire Bear has no access to any other Druid action (Nature's Grace, the summons, Roots of the World) until it reverts.",
    },
    {
      key: "summonWisp", label: "Summon Wisp", icon: "👻", restriction: "Orc — Bog Witch",
      description: "Instantly summons a Wisp at a chosen already-explored swamp tile. Capped civ-wide at one live Wisp per Bog Witch this kingdom currently fields, shared across the whole roster rather than one per caster.",
    },
    {
      key: "setTrap", label: "Set a Trap", icon: "🪤", restriction: "Halfellow — Trouble Maker",
      description: "Plants a Frost or Fire trap, hidden, on an unoccupied tile within 2 of the caster. The first enemy unit to end movement within 1 tile of it springs it: 4 flat damage plus Frozen (frost) or Burning (fire), then the trap is consumed. Capped civ-wide at one live trap per Trouble Maker, both flavors sharing the same pool.",
    },
    {
      key: "createGreatBonfire", label: "Create The Great Bonfire", icon: "🔥", restriction: "Halfellow — Wanderer",
      description: "Summons The Great Bonfire on an open adjacent tile, replacing this kingdom's existing one if it already has one. For 5 turns, every allied unit within 4 tiles gets a strong per-turn buff -- see the Bonfire's Blessing condition page for the full effect -- refreshed as long as it stays in range.",
    },
    {
      key: "whirlwindStrike", label: "Whirlwind Strike", icon: "🌪️", restriction: "Elf — Blade Dancer",
      description: "Attacks every visible enemy within 1 tile simultaneously, at 75% of this unit's normal attack power against each, while itself taking only 37.5% of the normal counter-damage back from each of them.",
    },
    {
      key: "bladeStorm", label: "Blade Storm", icon: "🗡️", restriction: "Elf — Blade Dancer",
      description: "Same simultaneous area-attack shape as Whirlwind Strike, but reaching 2 tiles at a reduced 50% attack power per target, and taking only 25% counter-damage back from each.",
    },
  ];

  const ACTIONS_BY_KEY = Object.fromEntries(
    [...CITY_ACTIONS, ...UNIT_ACTIONS].map((a) => [a.key, a])
  );

  /** Full HTML for the left-hand action list -- two groups, City Actions and
   *  Unit Actions, each in the hand-curated order declared above (universal
   *  unit actions first, then race-specific special abilities) rather than
   *  alphabetical -- a player scanning for "what can my Wizard do" reads
   *  better grouped by how central the action is than sorted by name. */
  function renderActionListHtml(selectedKey) {
    const groups = [
      { label: "City Actions", actions: CITY_ACTIONS },
      { label: "Unit Actions", actions: UNIT_ACTIONS },
    ];
    return groups.map((g) => `
      <div class="kb-list-group">
        <div class="kb-list-group-label">${escapeHtml(g.label)}</div>
        ${g.actions.map((a) => {
          const selected = a.key === selectedKey ? " kb-list-btn-selected" : "";
          return `<button class="kb-list-btn${selected}" data-action-id="${escapeHtml(a.key)}">
            <span class="kb-list-btn-symbol">${a.icon}</span>
            <span>${escapeHtml(a.label)}</span>
          </button>`;
        }).join("")}
      </div>
    `).join("");
  }

  /** Full HTML for the right-hand action profile pane. Null/unknown key
   *  renders the "pick an action" empty state, same convention as
   *  renderConditionProfileHtml. `backLabel` -- see that function's own doc
   *  comment, identical convention (a unit's "Available Actions" cross-link
   *  sets this so the Back button returns to the unit it came from). */
  function renderActionProfileHtml(actionKey, backLabel) {
    const backHtml = backLabel
      ? `<button class="kb-back-btn" id="kb-back-btn">← Back to ${escapeHtml(backLabel)}</button>` : "";
    const a = ACTIONS_BY_KEY[actionKey];
    if (!a) {
      return `${backHtml}<div class="kb-profile-empty">Select an action on the left to view its description.</div>`;
    }
    const restrictionHtml = a.restriction
      ? `<div class="kb-chip-row"><span class="kb-chip">${escapeHtml(a.restriction)}</span></div>` : "";
    return `
      ${backHtml}
      <div class="kb-profile-header">
        <div class="kb-condition-profile-icon">${a.icon}</div>
        <div>
          <h2>${escapeHtml(a.label)}</h2>
        </div>
      </div>
      ${restrictionHtml}
      <div class="kb-condition-profile-desc">${escapeHtml(a.description)}</div>
    `;
  }

  /** Full HTML for the Actions page -- same list+profile layout as Units/
   *  Structures/Conditions. `backLabel` threads through to
   *  renderActionProfileHtml. */
  function renderActions(selectedKey, backLabel) {
    return `
      <div class="kb-header"><h2>Actions</h2></div>
      <div class="kb-body">
        <div class="kb-list-pane">${renderActionListHtml(selectedKey)}</div>
        <div class="kb-profile-pane">${renderActionProfileHtml(selectedKey, backLabel)}</div>
      </div>`;
  }

  /** Full HTML for the left-hand condition list -- every icon overlays.js
   *  actually knows how to draw (read live from CONDITION_ICONS, not a
   *  second copy of that list), one flat list (conditions don't have a
   *  natural "kingdom" to group by the way units do). */
  function renderConditionListHtml(selectedKey) {
    const icons = (window.UI.overlays && window.UI.overlays.CONDITION_ICONS) || {};
    // Alphabetical by display name -- CONDITION_ICONS
    // itself stays in overlays.js's own declaration order (grouped loosely by
    // theme there), this is purely a display-order sort for this list.
    const sortedKeys = Object.keys(icons).sort((a, b) => conditionDisplayName(a).localeCompare(conditionDisplayName(b)));
    return `<div class="kb-list-group">${sortedKeys.map((key) => {
      const selected = key === selectedKey ? " kb-list-btn-selected" : "";
      return `<button class="kb-list-btn${selected}" data-condition-id="${escapeHtml(key)}">
        <span class="kb-list-btn-symbol">${icons[key]}</span>
        <span>${escapeHtml(conditionDisplayName(key))}</span>
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
          <h2>${escapeHtml(conditionDisplayName(conditionKey))}</h2>
        </div>
      </div>
      <div class="kb-condition-profile-desc">${escapeHtml(desc)}</div>
    `;
  }

  /** Full HTML for the Conditions page -- same list+profile layout as
   *  Units, for visual consistency between the
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
   *  -- one flat list, same as Conditions (no natural "kingdom" grouping). */
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
   *  Conditions. `backLabel` threads through to
   *  renderStatProfileHtml. */
  function renderStats(selectedKey, backLabel) {
    return `
      <div class="kb-header"><h2>Stats</h2></div>
      <div class="kb-body">
        <div class="kb-list-pane">${renderStatListHtml(selectedKey)}</div>
        <div class="kb-profile-pane">${renderStatProfileHtml(selectedKey, backLabel)}</div>
      </div>`;
  }

  // conditionDisplayName exported (2026-08-26) so techtree.js's own
  // condition cross-links (conditionLinksHtml) render the exact same label
  // this page's own list does, rather than a second hand-copied version
  // that could drift.
  window.UI.knowledgebase = {
    renderUnits, renderConditions, renderStats, renderStructures, renderActions,
    drawUnitPortrait, drawStructurePortrait, wireCombatSimulator, conditionDisplayName,
  };
})();
