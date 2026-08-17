/**
 * COMBAT ENGINE
 * -------------
 * Simultaneous resolution (unless First Strike breaks the tie -- see below):
 * the attacker always deals full damage; the defender always counterattacks
 * for half damage (unless something negates, denies, or misses it). No
 * round-winner roll -- the old role/counter-triangle system (spear/cavalry/
 * archer counters) has been REMOVED entirely and replaced by unit PROPERTIES
 * (First Strike / Siege / Flying), which affect initiative, counter denial,
 * evasion, and siege damage instead of a rock-paper-scissors matchup. See
 * game_rules_adjustments.md for the confirmed design, and resolveRound's own
 * doc comment for First Strike's two-part mechanic and Flying's evasion miss
 * (both 2026-07-16).
 *
 * Damage formula: damage = damageRoll(atk) * atk/(atk+def), floored at 1 so
 * combat always makes progress (no defense-vs-healing stalemate). This is a
 * self-scaling ratio -- it doesn't need a fixed "typical defense" constant,
 * and stays meaningful as unit stats grow via tech.
 *
 * Buildings/structures/cities never counterattack -- attackStructure() is a
 * one-way hit. Garrisoned units always intercept: a structure/city can only
 * be damaged directly when no defender occupies its tile (enforced by the
 * caller in ai.js, not here).
 */

window.GameEngine = window.GameEngine || {};

(function () {
  const TERRAIN = window.GameData.TERRAIN;
  // Tuning lives in js/data/config.js -- see its COMBAT and VETERAN LEVELING
  // sections. Local names are kept so each value stays next to the comment
  // explaining what it does to a fight.
  const CFG = window.GameConfig.combat;
  const LVL_CFG = window.GameConfig.leveling;

  function roll1d6() { return 1 + Math.floor(Math.random() * 6); }
  function roll3d6() { return roll1d6() + roll1d6() + roll1d6(); }

  /**
   * Purely-cosmetic combat event queue, drained by the UI's render loop to
   * drive attack animations (slash effect + unit wiggle). Deliberately NOT
   * populated by resolveRound/resolveToTheDeath themselves -- those are also
   * used for hypothetical win-probability sampling (ai.js's
   * estimateWinProbability clones units and simulates many fights per
   * candidate target), so only the real, on-board attack call sites in
   * ai.js push an event here. Engine code otherwise never depends on the UI
   * layer; this keeps that boundary intact by having the UI pull from here
   * rather than the engine push into window.UI.
   */
  let pendingCombatEvents = [];

  /** Records one real (board) attack for the UI to animate. `atkUnit` is
   *  always a live unit; `defUnit` is the defending unit, or null when the
   *  target is a city/structure (dx/dy then point at its tile instead). */
  function recordCombatEvent(evt) {
    pendingCombatEvents.push(evt);
  }

  /** UI-side: pulls and clears every event recorded since the last drain. */
  function drainCombatEvents() {
    const events = pendingCombatEvents;
    pendingCombatEvents = [];
    return events;
  }

  /** Same pull-based queue pattern as pendingCombatEvents above, for a
   *  momentary "this tile radius was just affected" highlight -- Blade
   *  Dancer's Whirlwind Strike/Blade Storm sweep and Human Wizard's Fireball
   *  splash both cover an AREA rather than a single attacker/defender pair,
   *  so the usual attack-slash animation alone doesn't show a player which
   *  tiles were actually caught in it. `kind` picks the highlight's color in
   *  render.js, same convention as floatingtext.js's `kind`. */
  let pendingAreaEffectEvents = [];

  function spawnAreaEffect(x, y, radius, kind = "default") {
    pendingAreaEffectEvents.push({ x, y, radius, kind });
  }

  function drainAreaEffectEvents() {
    const events = pendingAreaEffectEvents;
    pendingAreaEffectEvents = [];
    return events;
  }

  /** Per-civ, per-unit-type override deltas/values from tech (attack/defense
   *  deltas, firstStrikePct/siegePct overrides, garrison bonuses). */
  function getUnitOverride(civ, typeId) {
    return (civ.unitOverrides && civ.unitOverrides[typeId]) || {};
  }

  /**
   * PROPERTIES -- generic lookup for any always-active unit trait (flying,
   * firstStrikePct, siegePct, canCarryUnit, ...): a tech-granted override on
   * the civ (civ.unitOverrides[typeId][key], via the unit_stat_upgrade tech
   * effect) if present, else the unit's own static data field (units.js),
   * else `fallback`. This is what lets a tech grant a brand new property to a
   * unit that doesn't have it in its base data (e.g. Dragon Riders granting
   * the Dragon canCarryUnit) without any bespoke plumbing -- one accessor
   * works for every property key, not just the ones anyone thought to wire
   * up tech-override support for individually.
   */
  function getUnitProperty(unit, civ, key, fallback = 0) {
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const ov = getUnitOverride(civ, unit.typeId);
    if (ov[key] != null) return ov[key];
    if (baseUnit[key] != null) return baseUnit[key];
    return fallback;
  }

  /** Halfellow "Strategic Reserve": civ-wide combat buff (+50% atk/def) to
   *  every Halfellow unit as long as the civ has at least one
   *  Armory actually built -- gated on construction, not just the tech.
   *  Scoped to the SPECIFIC city that produced the unit (unit.homeCityName,
   *  stamped at spawn time -- see ai.js's spawnUnitInCity/combat.js's
   *  maybeSpawnMilitia), not civ-wide: a unit trained elsewhere gets no
   *  bonus even if some other city of the same civ has an Armory. A unit
   *  with no recorded home city (an emergency Rouse the People militia
   *  spawned away from any named city) or whose home city has since been
   *  destroyed never qualifies. Doesn't stack with multiple Armories in
   *  the same city (cityHasStructure is a boolean, not a count). */
  function hasArmoryBonus(unit, civ) {
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("strategic_reserve")) return false;
    if (!unit.homeCityName) return false;
    const city = civ.cities.find((c) => c.name === unit.homeCityName);
    return !!(city && window.GameEngine.cities.cityHasStructure(city, "armory"));
  }

  /** Elf "Altar of Ages": +25% XP for a unit whose home city has the Altar
   *  of Ages built -- same homeCityName-gated shape as hasArmoryBonus above,
   *  just feeding a combat-XP multiplier (see ai.js's grantXPAndAutoLevel)
   *  instead of an attack/defense buff. */
  function hasAltarOfAgesBonus(unit, civ) {
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("altar_of_ages")) return false;
    if (!unit.homeCityName) return false;
    const city = civ.cities.find((c) => c.name === unit.homeCityName);
    return !!(city && window.GameEngine.cities.cityHasStructure(city, "altar_of_ages"));
  }

  /** Elf "Shadowsteed": while carrying a passenger, the Shadowsteed itself
   *  fights using the PASSENGER's own effective stats (see effectiveAttack/
   *  effectiveDefense/effectiveRange/effectiveSiegePct/effectiveFirstStrikePct
   *  below, each of which checks this first) rather than its own -- returns
   *  the carried unit if `unit` is a mounted Shadowsteed, else null. A
   *  passenger can never itself be carrying anyone (enforced wherever a
   *  carrier picks one up -- see ai.js), so this never recurses. */
  function shadowsteedMount(unit) {
    return unit.typeId === "shadowsteed" && unit.carries ? unit.carries : null;
  }

  // Deliberately NOT routed through getUnitProperty -- that helper is an
  // override-or-fallback (an override completely REPLACES the base value,
  // never adds to it), which is wrong here: a tech granting "+15%" should
  // stack on top of whatever the unit already has (e.g. Wolf Rider's base
  // 0.20 via Swift Hunters), the same way effectiveAttack/effectiveDefense
  // already add their own ov.attack/ov.defense on top of base rather than
  // replacing it. tech.js's unit_stat_upgrade already accumulates multiple
  // techs' firstStrikePct contributions additively into ov.firstStrikePct;
  // this is the other half -- adding that total on top of the unit's own
  // base value instead of discarding it.
  function effectiveFirstStrikePct(unit, civ) {
    // Elf "Shadowsteed": mounted, it fights with its RIDER's First Strike
    // (unless its own base is higher, per the tech's own wording "keeping
    // its own first strike if higher" -- the one stat where the Shadowsteed
    // doesn't fully defer to its passenger), plus a flat +2% on top while
    // carrying (same "gains X while carrying a unit" shape as the
    // attack/defense bonuses above).
    const mount = shadowsteedMount(unit);
    if (mount) {
      const ownBase = window.GameData.getUnit("shadowsteed").firstStrikePct || 0;
      return Math.max(ownBase, effectiveFirstStrikePct(mount, civ)) + 0.02;
    }
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const ov = getUnitOverride(civ, unit.typeId);
    let pct = (baseUnit.firstStrikePct || 0) + (ov.firstStrikePct || 0);
    // Dwarf "Power Metal"/"Epic Metal": Troubadour's aura -- see turns.js's
    // per-turn application and effectiveAttack's matching check above.
    pct += unit.conditions?.powerMetalAura?.firstStrikePctBonus || 0;
    // Orc "Violent Momentum": a unit that killed an enemy last turn gets a
    // temporary First Strike bump alongside its movement bonus -- see
    // ai.js's applyOrcCombatMechanics.
    pct += unit.conditions?.killMomentum?.firstStrikePctBonus || 0;
    // Elf "Sudden Doom": +10 percentage points First Strike while Hidden --
    // ends the instant the unit is no longer Hidden, same as its attack bonus
    // (see effectiveAttack below).
    if (unit.conditions?.hidden && civ.unlockedMechanics && civ.unlockedMechanics.has("sudden_doom")) pct += 0.10;
    // Veteran leveling -- see LEVELING section below.
    pct += unit.levelBonuses?.firstStrikePct || 0;
    // Undead "Zombie": a reanimated unit has no reflexes of its own left --
    // this overrides every other source above rather than stacking with them.
    if (unit.conditions?.zombie) return 0;
    // Halfellow "Riddle" (Trouble Maker/Wanderer): a Befuddled unit is too
    // confused to react fast, regardless of any other First Strike source --
    // same "overrides everything" shape as Zombie above.
    if (unit.conditions?.befuddled) return 0;
    return pct;
  }

  function effectiveSiegePct(unit, civ) {
    // Elf "Shadowsteed": mounted, it inherits its rider's siege score wholesale
    // (no +2/+1-style bonus of its own here -- see the tech's wording).
    const mount = shadowsteedMount(unit);
    if (mount) return effectiveSiegePct(mount, civ);
    let pct = getUnitProperty(unit, civ, "siegePct", 0);
    // Tech: siege_property_bonus (Orc "Siege Tactics") -- civ-wide, additive on
    // top of whatever siegePct the unit already has (including zero).
    pct += civ.siegePropertyBonus || 0;
    // Human "Crusade": Paladin's holy aura -- see turns.js's per-turn aura
    // application and effectiveAttack/effectiveDefense's matching checks.
    if (unit.conditions?.crusadeAura) pct += unit.conditions.crusadeAura.siegePctBonus || 0;
    // Dwarf "Heavy Metal"/"Epic Metal": Troubadour's aura -- same shape as Crusade.
    if (unit.conditions?.heavyMetalAura) pct += unit.conditions.heavyMetalAura.siegePctBonus || 0;
    // Veteran leveling -- see LEVELING section below.
    pct += unit.levelBonuses?.siegePct || 0;
    return pct;
  }

  /**
   * DOUBLE STRIKE -- a flat per-attack chance to
   * immediately swing a SECOND time at the same target. The follow-up hit
   * provokes no counterattack of its own (the defender already answered the
   * first hit, if it was going to), and unlike Siege it works at any range:
   * a Ranged unit firing from distance can loose a second shot exactly as a
   * melee unit can land a second blow. See resolveRound for the roll itself.
   *
   * Same additive-stacking shape as effectiveFirstStrikePct above, and for the
   * same reason: a tech granting "+5% Double Strike" should stack on top of
   * whatever base the unit already has, not replace it -- so this reads the
   * override directly rather than going through getUnitProperty.
   */
  function effectiveDoubleStrikePct(unit, civ) {
    // Elf "Shadowsteed": mounted, it fights with the higher of its own and its
    // rider's Double Strike -- the same "keeps its own if higher" rule the
    // tech's wording gives First Strike, since these are the same kind of
    // reflex-driven property.
    const mount = shadowsteedMount(unit);
    if (mount) {
      const ownBase = window.GameData.getUnit("shadowsteed").doubleStrikePct || 0;
      return Math.max(ownBase, effectiveDoubleStrikePct(mount, civ));
    }
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const ov = getUnitOverride(civ, unit.typeId);
    let pct = (baseUnit.doubleStrikePct || 0) + (ov.doubleStrikePct || 0);
    // Tech: double_strike_property_bonus -- civ-wide, additive on top of
    // whatever the unit already has (mirrors siege_property_bonus).
    pct += civ.doubleStrikePropertyBonus || 0;
    // Orc "Violent Momentum": same temporary bump as First Strike above,
    // same source condition -- see ai.js's applyOrcCombatMechanics.
    pct += unit.conditions?.killMomentum?.doubleStrikePctBonus || 0;
    // Veteran leveling -- see LEVELING section below.
    pct += unit.levelBonuses?.doubleStrikePct || 0;
    // A reanimated or befuddled unit can't manage a second swing, for the
    // same reason it loses First Strike -- overrides every source above.
    if (unit.conditions?.zombie) return 0;
    if (unit.conditions?.befuddled) return 0;
    return Math.max(0, Math.min(1, pct));
  }

  /**
   * LEVELING -- per-unit-instance veteran progression, earned through combat
   * XP, capped at MAX_UNIT_LEVEL. Distinct from tech-granted unitOverrides
   * (civ-wide, per unit TYPE) and from CONDITIONS below (temporary): a level
   * bonus is permanent and belongs to this one unit instance only, stored in
   * unit.levelBonuses (a plain {attack, defense, siegePct, firstStrikePct,
   * doubleStrikePct} bag, same shape convention as unit.conditions) and read
   * additively by effectiveAttack/effectiveDefense/effectiveSiegePct/
   * effectiveFirstStrikePct/effectiveDoubleStrikePct above/below, stacking
   * on top of every other source exactly the way ov.attack/ov.defense and
   * the aura bonuses already do.
   *
   * XP is granted only at REAL combat call sites (ai.js's attack/attackCity/
   * attackStructure handlers), never inside resolveRound itself -- resolveRound
   * is also used for hypothetical win-probability sampling (ai.js's
   * estimateWinProbability clones units and simulates many fights per
   * candidate target), so awarding XP there would pollute those clones'
   * stats-free simulation runs. This mirrors recordCombatEvent's existing
   * real-vs-simulated boundary.
   *
   * A unit that reaches MAX_UNIT_LEVEL stops earning XP entirely (grantXP is
   * a no-op past the cap) rather than accumulating unusable surplus forever.
   */
  const MAX_UNIT_LEVEL = LVL_CFG.maxUnitLevel;

  // Cumulative XP required to REACH level N (index 0 == level 1). Spaced out
  // (10/15/20/25/30 per level) so early levels come quickly -- a rewarding,
  // visible payoff for a unit that survives a few fights -- while level 5
  // stays a real achievement reserved for genuine long-game veterans.
  const XP_LEVEL_THRESHOLDS = LVL_CFG.xpThresholds;

  // Per-level stat bonus for each of the 7 player/AI-chosen upgrade paths.
  // Attack/Defense/visionRadius/movement are flat adds (see turns.js's
  // visibility sum and ai.js's computeMovementBudget for where visionRadius/
  // movement are actually read) matching every other flat stat bonus in
  // the game (ov.attack, crusadeAura.attackBonus, etc). Siege/First Strike/
  // Double Strike are percentage-point bonuses (all already stored as 0-1
  // fractions everywhere else in the codebase) kept deliberately smaller
  // per-level than Attack/Defense's proportional impact: siegePct only ever
  // applies against structures, firstStrikePct compounds every round of a
  // fight, so a Paladin's base 6% would nearly triple by level 5 at
  // +2%/level -- this is capped at +1%/level instead -- and doubleStrikePct
  // is a whole extra swing's worth of value per point, so 7%/level was
  // picked to land in the same rough per-level weight class as the other
  // two, not scaled to Attack/Defense's flat-point convention.
  const LEVEL_BONUS_VALUES = LVL_CFG.bonusValues;
  const LEVEL_UP_STATS = Object.keys(LEVEL_BONUS_VALUES);

  /** Adds combat XP to `unit`. No-op once it's hit MAX_UNIT_LEVEL -- nothing
   *  left to spend it on, so there's no point letting it pile up forever. */
  function grantXP(unit, amount) {
    if (!amount || amount <= 0) return;
    if ((unit.level || 0) >= MAX_UNIT_LEVEL) return;
    // Undead "Zombie": a reanimated unit never learns anything new again.
    if (unit.conditions?.zombie) return;
    unit.xp = (unit.xp || 0) + amount;
  }

  /** How many level-ups `unit` has earned via XP but not yet spent (0 if
   *  none) -- the gap between its current level and how far XP_LEVEL_
   *  THRESHOLDS says its accumulated xp should have carried it, capped at
   *  MAX_UNIT_LEVEL. Usually 0 or 1 (levels rarely happen in bursts), but
   *  can be >1 for a big single XP grant (e.g. a signature kill on a much
   *  stronger enemy) that vaults straight past an intermediate threshold. */
  function pendingLevelUps(unit) {
    const xp = unit.xp || 0;
    const level = unit.level || 0;
    let earned = 0;
    for (const threshold of XP_LEVEL_THRESHOLDS) {
      if (xp >= threshold) earned++;
    }
    earned = Math.min(earned, MAX_UNIT_LEVEL);
    return Math.max(0, earned - level);
  }

  /** Spends one pending level-up on `stat` (one of LEVEL_UP_STATS). Returns
   *  false (no-op) if there's no pending level-up to spend or `stat` isn't a
   *  recognized upgrade path. */
  function applyLevelUp(unit, stat) {
    if (pendingLevelUps(unit) <= 0) return false;
    if (!LEVEL_UP_STATS.includes(stat)) return false;
    unit.levelBonuses = unit.levelBonuses || {};
    unit.levelBonuses[stat] = (unit.levelBonuses[stat] || 0) + LEVEL_BONUS_VALUES[stat];
    unit.level = (unit.level || 0) + 1;
    return true;
  }

  /**
   * XP economy for one real attack (see doc comment above -- never called
   * from resolveRound itself). Rewards participation (a small flat amount for
   * simply fighting, so support/ranged units that rarely land the killing
   * blow still progress), damage actually dealt (scaled down so it doesn't
   * dwarf everything else), and a kill bonus scaled to the SLAIN unit's own
   * power (window.GameData.unitPower) -- killing something strong is worth
   * much more than farming something weak, which discourages grinding on
   * trivial targets to level up. `killedUnitTypeId` is null for a non-lethal
   * hit and for damage dealt to a structure/city (no unit died).
   */
  const XP_PARTICIPATION = LVL_CFG.xpParticipation;
  const XP_PER_DAMAGE = LVL_CFG.xpPerDamage;
  const XP_KILL_BASE = LVL_CFG.xpKillBase;
  const XP_KILL_POWER_MULT = LVL_CFG.xpKillPowerMult;

  function xpForCombatAction({ damage = 0, killedUnitTypeId = null } = {}) {
    let xp = XP_PARTICIPATION + damage * XP_PER_DAMAGE;
    if (killedUnitTypeId) xp += XP_KILL_BASE + window.GameData.unitPower(killedUnitTypeId) * XP_KILL_POWER_MULT;
    return xp;
  }

  /** Dwarf "Shield Wall": how many of `civ`'s OTHER military units are
   *  standing adjacent (Chebyshev 1) to `unit` right now -- read by
   *  effectiveDefense via context.adjacentAllyCount, computed fresh for both
   *  sides of every exchange in resolveRound (a unit's neighbors can change
   *  attack to attack, so this is never cached). */
  function countAdjacentMilitaryAllies(unit, civ) {
    if (!civ || !civ.units) return 0;
    let count = 0;
    for (const other of civ.units) {
      if (other === unit || other.carriedBy) continue;
      if (window.GameData.getUnit(other.typeId).category !== "military") continue;
      if (Math.max(Math.abs(other.x - unit.x), Math.abs(other.y - unit.y)) <= 1) count++;
    }
    return count;
  }

  /** Dwarf "The Long Reckoning": marks `attackerCivId` as a permanent rival
   *  on `defenderCiv` once it destroys one of defenderCiv's cities or
   *  (non-wall) buildings -- see ai.js's two attackCity/attackStructure
   *  destroy branches for the call sites. No-op unless defenderCiv actually
   *  has the mechanic unlocked. Never expires, never removed even if
   *  attackerCivId is later eliminated (the tech's own wording: "does not
   *  require the mark-holder to still be alive"). */
  function markRival(defenderCiv, attackerCivId) {
    if (!defenderCiv.unlockedMechanics || !defenderCiv.unlockedMechanics.has("the_long_reckoning")) return;
    defenderCiv.rivalCivIds = defenderCiv.rivalCivIds || new Set();
    defenderCiv.rivalCivIds.add(attackerCivId);
  }

  /** How many tiles away (Chebyshev) this unit can attack from -- 1 (melee,
   *  adjacent-only) unless the unit's base range is higher, plus any tech
   *  override on top (additive, same reasoning as effectiveFirstStrikePct
   *  above -- NOT routed through getUnitProperty, since a tech like Battle
   *  Mage's "+1 Ranged" needs to add to the Wizard's base range, not replace
   *  it outright). See units.js's PROPERTIES doc for the full set of rules
   *  this gates: no counterattack and no siege bonus against a non-adjacent
   *  target, and the attacker never moves toward a target it can already
   *  reach at range (see ai.js's targeting loops). */
  function effectiveRange(unit, civ) {
    // Elf "Shadowsteed": mounted, it fights at its rider's range.
    const mount = shadowsteedMount(unit);
    if (mount) return effectiveRange(mount, civ);
    const baseUnit = window.GameData.getUnit(unit.typeId);
    const ov = getUnitOverride(civ, unit.typeId);
    let base = (baseUnit.range || 1) + (ov.range || 0);
    // Elf "Upon the Wind": a Ranger gains +1 range while being carried (by a
    // Shadowsteed) -- checked here since this is the exact point every
    // Shadowsteed-mount range calc recurses into (see the shadowsteedMount
    // check above, which re-enters this same function with unit = the rider).
    if (unit.typeId === "ranger" && unit.carriedBy
        && civ.unlockedMechanics && civ.unlockedMechanics.has("upon_the_wind")) {
      base += 1;
    }
    // Halfellow "Boomerang": civ-wide FLOOR (Math.max), not an additive
    // bonus -- every unit gets AT LEAST this range, but a unit that
    // already has more (e.g. a future higher-range Halfellow unit, or a
    // per-unit-type tech override above) is never reduced by it.
    //
    // Scoped down (2026-07-14): `exemptFromUniversalRangeGrant` (units.js)
    // opts a specific unit OUT of this floor -- added after a live headless
    // trace showed Boomerang turning Halfellow's entire army into permanent,
    // zero-counterattack-risk skirmishers (Militia, its numerically dominant
    // late-game unit, included), not just an early-game toolkit as the tech
    // was designed for. Militia is now exempt so the floor still covers the
    // race's actual early/scouting units (Wanderer, Pony Patrol) without
    // extending risk-free ranged combat to its main standing-army unit too.
    // See project_pairwise_balance_human_orc_halfellow /
    // project_boomerang_scope_down memory.
    if (baseUnit.exemptFromUniversalRangeGrant) return base;
    return Math.max(base, civ.universalRangeGrant || 0);
  }

  // Base property (always-on for a unit type, e.g. Orc's Dragon) OR a
  // temporary per-instance grant -- Human "Flight" sets a "flying" condition
  // with an expiresAtTurn (see ai.js's performWizardGrantFlight) rather than
  // overriding unitOverrides, since it targets one specific unit instance for
  // a few turns, not every unit of a type civ-wide the way getUnitProperty's
  // overrides work.
  function isFlying(unit) {
    return !!window.GameData.getUnit(unit.typeId).flying || hasCondition(unit, "flying");
  }

  /**
   * CONDITIONS -- temporary, per-unit-instance status effects with a
   * duration (curse, teleport exhaustion, ...), as opposed to the
   * always-active PROPERTIES above. Stored in a single unit.conditions bag
   * (unit.conditions[key] = data) instead of one-off top-level fields like
   * the old _curseDebuff/exhausted, so:
   *   - every condition is discoverable in one place instead of grep-only,
   *   - turn-based expiry is centralized in tickConditions (below) instead of
   *     each condition needing its own hand-written expiry check wherever
   *     it's convenient to add one,
   *   - adding a new condition never requires touching the expiry loop at
   *     all, only setCondition/clearCondition calls at its own trigger sites.
   * A condition with `expiresAtTurn` auto-expires via tickConditions; one
   * without it (e.g. exhausted, which clears on full heal, not a timer) is
   * left alone by tickConditions and must be cleared explicitly by whatever
   * event ends it (see turns.js's heal phase for exhausted).
   */
  function setCondition(unit, key, data) {
    unit.conditions = unit.conditions || {};
    unit.conditions[key] = data;
  }

  function getCondition(unit, key) {
    return unit.conditions ? unit.conditions[key] : undefined;
  }

  function hasCondition(unit, key) {
    return !!(unit.conditions && unit.conditions[key]);
  }

  function clearCondition(unit, key) {
    if (unit.conditions) delete unit.conditions[key];
  }

  /** Centralized per-unit condition expiry -- called once per civ-turn (see
   *  ai.js's runAITurn). Removes any condition whose expiresAtTurn has been
   *  reached; conditions without expiresAtTurn (event-cleared ones) are left
   *  untouched here. `map` is optional -- only needed to evaluate Human
   *  "Flight" expiring over water (see below); safe to omit otherwise. */
  function tickConditions(unit, turnNumber, map) {
    if (!unit.conditions) return;
    for (const key of Object.keys(unit.conditions)) {
      const cond = unit.conditions[key];
      if (cond && cond.expiresAtTurn != null && turnNumber >= cond.expiresAtTurn) {
        delete unit.conditions[key];
        // Halfellow "Sneaking Around": Hidden expiring naturally still forces
        // the unit visible for at least 1 more turn before it can re-hide --
        // same rule as every other way Hidden can end (see revealHidden below).
        if (key === "hidden") {
          unit.conditions.forcedVisible = { expiresAtTurn: turnNumber + 1 };
        }
        // Human "Flight": a temporarily-flying unit still over water when the
        // grant runs out has nothing left to keep it up (or afloat) -- it
        // dies on the spot. Naval units are exempt (water is home for them;
        // reverting to normal there is nothing to die from). Only marks
        // unit.hp = 0 -- the caller (ai.js's runAITurn) is responsible for
        // actually removing a 0-hp unit from civ.units, same convention
        // every other death path in this codebase already follows.
        if (key === "flying" && map && !window.GameData.getUnit(unit.typeId).isNaval) {
          const tile = map.tiles[unit.y * map.width + unit.x];
          if (tile && TERRAIN[tile.terrain].isWater) unit.hp = 0;
        }
      }
    }
  }

  /** Can `unit` voluntarily go Hidden this turn? Granted by Halfellow's
   *  "Sneaking Around" (any unit) or Human's "Invisibility" (Wizard only).
   *  Either way: no existing Hidden/forcedVisible condition, and nothing
   *  enemy -- a unit, a city, or a structure (wall/building) -- on an
   *  adjacent tile. The city/structure half is
   *  what a siege actually looks like: an attacker sits adjacent to the
   *  same wall or city tile turn after turn, and without this it could
   *  vanish and re-ambush between hits mid-siege the same way it could
   *  against a unit before this check existed -- "in the middle of combat"
   *  isn't just "next to an enemy unit." */
  function canGoHidden(unit, civ, civs) {
    const mechanics = civ.unlockedMechanics;
    // Halfellow "Sneaking Around": narrowed to
    // the Wanderer only, unlike Elf's own unlock of the identical shared
    // "sneaking_around" flag (elf_shadowed_hush_unseen), which stays
    // race-wide -- keyed off raceId here rather than splitting the mechanic
    // into two ids, since every other consumer of "sneaking_around"
    // (enterHidden, revealHidden, ...) still treats it as one capability.
    const hasSneak = !!(mechanics && mechanics.has("sneaking_around")
      && (civ.raceId !== "halfellow" || unit.typeId === "wanderer"));
    const hasInvisibility = !!(mechanics && mechanics.has("invisibility") && unit.typeId === "wizard");
    // Halfellow "Making Trouble": the Trouble
    // Maker's own innate stealth, same unit-restricted shape as Invisibility
    // above -- doesn't need Sneaking Around researched separately.
    const hasTroubleStealth = !!(mechanics && mechanics.has("making_trouble") && unit.typeId === "trouble_maker");
    // Halfellow "Keep an Eye Out": civ-wide, ANY Halfellow unit -- same
    // unrestricted shape as Elf's own sneaking_around unlock.
    const hasKeepWatch = !!(mechanics && mechanics.has("keep_an_eye_out") && civ.raceId === "halfellow");
    // Orc "Bog Spirit": the Wisp's own innate stealth, same unit-restricted
    // shape as Invisibility/Trouble Maker above -- doesn't need Sneaking
    // Around researched separately, just the summon tech that lets Wisps
    // exist at all.
    const hasWispStealth = !!(mechanics && mechanics.has("wisp_summon") && unit.typeId === "wisp");
    if (!hasSneak && !hasInvisibility && !hasTroubleStealth && !hasKeepWatch && !hasWispStealth) return false;
    if (hasCondition(unit, "hidden") || hasCondition(unit, "forcedVisible")) return false;
    const adjacent = (x, y) => Math.max(Math.abs(x - unit.x), Math.abs(y - unit.y)) <= 1;
    for (const otherCiv of Object.values(civs)) {
      if (otherCiv.id === civ.id || otherCiv.eliminated) continue;
      for (const eu of otherCiv.units) {
        if (adjacent(eu.x, eu.y)) return false;
      }
      for (const city of otherCiv.cities) {
        if (adjacent(city.x, city.y)) return false;
        for (const s of city.structures) {
          if (adjacent(s.x, s.y)) return false;
        }
      }
    }
    return true;
  }

  /** Activates Hidden for 3 turns. A full-turn action -- the caller is
   *  responsible for also setting unit.usedThisTurn = true. */
  function enterHidden(unit, turnNumber) {
    setCondition(unit, "hidden", { expiresAtTurn: turnNumber + 3 });
  }

  /** Halfellow "Riddle"/"Resource Heist": -50% attack, 75% defense (a -25%
   *  cut), movement capped at 1 (see ai.js's computeMovementBudget), and 0%
   *  First Strike (see effectiveFirstStrikePct above) for 2 turns. A single
   *  shared helper since both abilities apply the exact same condition --
   *  keeps the numbers in one place for tuning instead of duplicated at both
   *  call sites. */
  function applyBefuddled(unit, turnNumber) {
    setCondition(unit, "befuddled", { expiresAtTurn: turnNumber + 2, attackMult: 0.5, defenseMult: 0.75 });
  }

  /** Centralizes ending Hidden for any REVEALED-BY-EVENT reason (enemy walked
   *  through this tile, this unit attacked, splash damage caught it, ...) --
   *  as opposed to natural expiry or a voluntary cancel, which the caller
   *  handles directly. Every such reveal forces the unit visible for at least
   *  1 more turn, same as natural expiry (see tickConditions above). */
  function revealHidden(unit, turnNumber) {
    if (!hasCondition(unit, "hidden")) return;
    clearCondition(unit, "hidden");
    setCondition(unit, "forcedVisible", { expiresAtTurn: turnNumber + 1 });
  }

  function hasFirstStrike(unit, civ) {
    return effectiveFirstStrikePct(unit, civ) > 0;
  }

  /** Computes a unit's current attack stat with race + tech-override modifiers */
  function effectiveAttack(unit, civ, context = {}) {
    // Elf "Shadowsteed": mounted, it fights with its RIDER's attack, +3 flat
    // on top of that (its own "gains 3 attack while carrying a unit" -- see
    // the tech's wording and shadowsteedMount's doc comment above).
    const mount = shadowsteedMount(unit);
    if (mount) return effectiveAttack(mount, civ, context) + 3;

    const baseUnit = window.GameData.getUnit(unit.typeId);
    const race = window.GameData.getRace(civ.raceId);
    const ov = getUnitOverride(civ, unit.typeId);
    let atk = baseUnit.attack + (ov.attack || 0) + (unit.levelBonuses?.attack || 0);

    // Orc Bog Witch curse (death-curse or Malefic Malediction): -50% attack while active.
    if (unit.conditions?.curse) atk *= unit.conditions.curse.attackMult;
    // Human "Freezing Touch": -25% attack while Frozen (movement is separately
    // zeroed in ai.js's moveUnitToward -- this condition is generic, not
    // Human-specific, so it applies to whichever race's unit gets frozen).
    if (unit.conditions?.frozen) atk *= unit.conditions.frozen.attackMult;
    // Undead "Zombie" (2026-07-22 rework of Raise Dead): a captured/reanimated
    // unit fights at a permanently reduced fraction of its own stats -- see
    // ai.js's maybeApplyZombie for how statMult is set (0.5 baseline, boosted
    // by Necropolis).
    if (unit.conditions?.zombie) atk *= unit.conditions.zombie.statMult;

    // Halfellow "Riddle"/"Resource Heist": Befuddled -- -50% attack for a
    // few turns (see applyBefuddled below). Same fixed-multiplier-on-the-
    // condition-object shape as curse/frozen above, not a hardcoded literal,
    // so a future tech/tuning pass can adjust attackMult without touching
    // every call site.
    if (unit.conditions?.befuddled) atk *= unit.conditions.befuddled.attackMult;

    // Tech: Halfellow "A Knife in the Dark" -- 166% attack while Hidden (the
    // attack itself then reveals the unit as normal -- see revealHidden's
    // call sites, all AFTER their resolveRound/attackCity/attackStructure call).
    if (unit.conditions?.hidden && civ.unlockedMechanics && civ.unlockedMechanics.has("knife_in_the_dark")) {
      atk *= 1.75;
    }

    // Tech: Elf "Strike from the Shadows"/"Sudden Doom" -- bonus attack while
    // Hidden, same shape as Knife in the Dark above. Mutually exclusive --
    // Sudden Doom's own wording ("replacing Strike from the Shadows") means
    // it always supersedes the lesser bonus once known, never stacks with it.
    if (unit.conditions?.hidden && civ.unlockedMechanics) {
      if (civ.unlockedMechanics.has("sudden_doom")) atk *= 2.0;
      else if (civ.unlockedMechanics.has("strike_from_the_shadows")) atk *= 1.5;
    }

    if (race.forestCombatBonus && context.attackerInForest) atk *= race.forestCombatBonus;
    else if (race.offForestPenalty && race.forestCombatBonus && !context.attackerInForest) atk *= race.offForestPenalty;

    // isSiege covers attacking a city, a building, or a wall alike (all three
    // go through this same flag -- see attackStructure/attackCity below).
    if (context.isSiege) {
      if (baseUnit.bonusVsCity) atk *= baseUnit.bonusVsCity;
      // Tech: siege_attack_bonus (e.g. Orc "Siege Tactics") -- civ-wide
      if (civ.siegeAttackBonus) atk *= (1 + civ.siegeAttackBonus);
      // Siege property (e.g. Catapult/Trebuchet/Fireball'd Wizard) -- per-unit
      const siegePct = effectiveSiegePct(unit, civ);
      if (siegePct) atk *= (1 + siegePct);
    }
    if (context.openField && baseUnit.weakInOpenField) atk *= baseUnit.weakInOpenField;
    if (context.isMelee && baseUnit.weakInMelee) atk *= baseUnit.weakInMelee;

    if (hasArmoryBonus(unit, civ)) atk *= 1.50;

    // Human "Crusade": Paladin's holy aura grants +1 flat attack to itself
    // and every allied unit within 1 tile -- see turns.js's per-turn
    // application of the crusadeAura condition.
    if (unit.conditions?.crusadeAura) atk += unit.conditions.crusadeAura.attackBonus || 0;

    // Dwarf "Power Metal"/"Epic Metal": Troubadour's aura -- same shape as
    // Crusade above, +2 flat attack to itself and every allied unit within
    // its aura radius (1 tile, or 2 with Epic Metal -- see turns.js). Mutually
    // exclusive with "Heavy Metal" being active on the same Troubadour at
    // the same time (see turns.js's beginCivTurn) -- a unit is never under
    // both conditions at once, so no double-dipping is possible here.
    if (unit.conditions?.powerMetalAura) atk += unit.conditions.powerMetalAura.attackBonus || 0;

    // Dwarf "The Long Reckoning": +25% attack against a civ marked as a
    // rival (see markRival below) -- applies to that civ's units, cities,
    // AND structures alike, since every real-damage call site below passes
    // `opposingCivId` through context.
    if (civ.rivalCivIds && context.opposingCivId && civ.rivalCivIds.has(context.opposingCivId)) {
      atk *= 1.25;
    }

    return Math.max(0, atk);
  }

  function effectiveDefense(unit, civ, context = {}) {
    // Elf "Shadowsteed": mounted, it fights with its RIDER's defense, +2 flat
    // on top of that (its own "gains ... 2 defense while carrying a unit").
    const mount = shadowsteedMount(unit);
    if (mount) return effectiveDefense(mount, civ, context) + 2;

    const baseUnit = window.GameData.getUnit(unit.typeId);
    const race = window.GameData.getRace(civ.raceId);
    const ov = getUnitOverride(civ, unit.typeId);
    let def = (baseUnit.defense + (ov.defense || 0) + (unit.levelBonuses?.defense || 0)) * (race.defenseMult || 1.0);

    // Undead "Zombie": same reduced-stats condition as effectiveAttack above.
    if (unit.conditions?.zombie) def *= unit.conditions.zombie.statMult;

    // Halfellow "Riddle"/"Resource Heist": Befuddled -- 75% defense (a -25%
    // cut) for a few turns. See effectiveAttack's matching check and
    // applyBefuddled below.
    if (unit.conditions?.befuddled) def *= unit.conditions.befuddled.defenseMult;

    // Hidden: staying concealed means fighting from cover/surprise -- +50% defense.
    if (unit.conditions?.hidden) def *= 1.5;

    // "Defend": a universal normal action, any
    // race/unit -- braces in place for x2 defense until the start of this
    // unit's own next turn (see ai.js's performDefend, which sets the
    // condition with an expiresAtTurn ticked by tickConditions). Stacks
    // multiplicatively with Hidden above, same as every other condition
    // multiplier here.
    if (unit.conditions?.defending) def *= 2;

    // Tech: Halfellow "High Ground" -- +50% defense while standing on Hills.
    if (context.defenderOnHills && civ.unlockedMechanics && civ.unlockedMechanics.has("high_ground")) def *= 1.50;

    // Tech: Elf "Sanctuary under Green Boughs" -- +20% defense while standing
    // in Forest. Same shape as High Ground above; context.defenderInForest is
    // computed by the caller (see ai.js's considerAttackOrGarrison).
    if (context.defenderInForest && civ.unlockedMechanics && civ.unlockedMechanics.has("sanctuary_under_green_boughs")) {
      def *= 1.20;
    }

    if (hasArmoryBonus(unit, civ)) def *= 1.50;

    // Human "Crusade": Paladin's holy aura grants +1 flat defense to itself
    // and every allied unit within 1 tile -- see turns.js.
    if (unit.conditions?.crusadeAura) def += unit.conditions.crusadeAura.defenseBonus || 0;

    // Dwarf "Heavy Metal"/"Epic Metal": Troubadour's aura -- same shape as Crusade.
    if (unit.conditions?.heavyMetalAura) def += unit.conditions.heavyMetalAura.defenseBonus || 0;

    // Dwarf "Shield Wall": flat +2 defense as long as at least one other
    // Dwarf military unit is adjacent -- doesn't scale with how many are
    // adjacent (2026-07-15: was +1/adjacent up to 3, now just a binary
    // gate). adjacentAllyCount is computed by the caller (resolveRound/
    // attackStructure/attackCity in ai.js, which alone has access to
    // civ.units' live positions) and passed through context.
    if (context.adjacentAllyCount > 0 && civ.unlockedMechanics && civ.unlockedMechanics.has("shieldwall")) {
      def += 2;
    }

    if (race.forestCombatBonus && context.defenderInForest) def *= race.forestCombatBonus;
    else if (race.offForestPenalty && race.forestCombatBonus && !context.defenderInForest) def *= race.offForestPenalty;

    if (context.defenderInCity) {
      def *= context.cityDefenseModifier || 1.30;
      def *= 1.0 + (race.cityDefenseBonusExtra || 0);
    }
    // Tech: garrison_defense_bonus (e.g. Human "Defense of the Kingdom") -- only
    // while the unit is standing in a city or on a friendly structure tile.
    if (context.garrisoned && ov.garrisonDefenseBonus) def += ov.garrisonDefenseBonus;

    if (context.isMelee && baseUnit.weakInMeleeDef) def *= baseUnit.weakInMeleeDef;
    if (context.defenderTerrainBonus) def *= context.terrainDefenseModifier || 1.25;

    return Math.max(0, def);
  }

  function damageRoll(attackStat) {
    const pct = roll3d6(); // 3-18, used as a percent
    const sign = Math.random() < 0.5 ? -1 : 1;
    const raw = attackStat * (1 + (sign * pct) / 100);
    return Math.max(0, raw);
  }

  /** Self-scaling mitigation: def reduces damage by def/(atk+def), floored at 1 dmg. */
  function mitigatedDamage(atkStat, defStat) {
    const raw = damageRoll(atkStat) * (atkStat / (atkStat + defStat || 1));
    return Math.max(1, Math.round(raw));
  }

  /** Chance for `unit` to negate ALL incoming damage this hit (Human Invulnerability). */
  function rollsInvulnerable(unit, civ) {
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("invulnerability_chance")) return false;
    if (unit.typeId !== "wizard") return false; // Human ability is Wizard-specific
    const chance = (civ.mechanicValues && civ.mechanicValues.invulnerability_chance) || 0;
    return Math.random() < chance;
  }

  // Halfellow "Resilient Spirit": each successful save permanently costs
  // this unit 15 percentage points off its OWN future trigger chance --
  // diminishing returns per unit instance, not a civ-wide cooldown, so a
  // unit that keeps clutch-surviving becomes steadily less reliable rather
  // than being able to cheat death indefinitely. Never resets or decays
  // back up; tracked on the unit itself (unit._resilientSpiritTriggers),
  // the same convention as other persistent (non-expiring) per-unit
  // counters like Dungeon Delve's unit._ritualTurns.
  const RESILIENT_SPIRIT_DECAY_PER_TRIGGER = CFG.resilientSpiritDecayPerTrigger;

  /** Halfellow "Resilient Spirit": if `damage` would be lethal for `unit`
   *  (every Halfellow unit type, forward OR counter), a chance to negate
   *  all of it instead -- starts at the tech's base value (50%), reduced
   *  15 percentage points per PAST trigger by this same unit (floored at
   *  0%, see RESILIENT_SPIRIT_DECAY_PER_TRIGGER above). Triggering forces
   *  a single Rest next turn (see the "forcedRest" condition, honored once
   *  by ai.js's maybeMoveUnits) and increments the unit's own trigger
   *  count for next time.
   *
   *  `simulated` (from context.simulated -- see ai.js's estimateWinProbability)
   *  means this exchange is a what-if being sampled by the AI, not a real
   *  blow: the save still rolls, so the estimate reflects the unit's true
   *  survivability, but neither persistent effect is applied. Without this,
   *  every attack the AI merely CONSIDERED left real units forced to rest. */
  function rollsDeathSave(unit, civ, damage, simulated) {
    if (unit.hp - damage > 0) return false; // not lethal -- nothing to save against
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("resilient_spirit")) return false;
    const baseChance = (civ.mechanicValues && civ.mechanicValues.resilient_spirit) || 0.5;
    const priorTriggers = unit._resilientSpiritTriggers || 0;
    const chance = Math.max(0, baseChance - RESILIENT_SPIRIT_DECAY_PER_TRIGGER * priorTriggers);
    if (Math.random() >= chance) return false;
    if (!simulated) {
      unit._resilientSpiritTriggers = priorTriggers + 1;
      setCondition(unit, "forcedRest", {});
    }
    return true;
  }

  // Dwarf "Unyielding": same death-save shape as Resilient Spirit above, and
  // now the same 15pp-per-trigger decay too -- the one remaining deliberate
  // difference is the forced Rest itself is only a 50% chance per trigger
  // rather than guaranteed every time. Tracked on its own counter
  // (unit._unyieldingTriggers) so the two mechanics never interfere with each
  // other even in the (currently impossible) case of a unit somehow having both.
  const UNYIELDING_DECAY_PER_TRIGGER = CFG.unyieldingDecayPerTrigger;

  /** Dwarf "Unyielding": if `damage` would be lethal for `unit`, a chance to
   *  negate all of it instead -- starts at the tech's base value (50%),
   *  reduced 15 percentage points per PAST trigger by this same unit
   *  (floored at 0%). Triggering has only a 50% chance to also force a
   *  single Rest next turn (unlike Resilient Spirit's guaranteed rest).
   *  `simulated`: see rollsDeathSave's doc comment. */
  function rollsUnyieldingSave(unit, civ, damage, simulated) {
    if (unit.hp - damage > 0) return false; // not lethal -- nothing to save against
    if (!civ.unlockedMechanics || !civ.unlockedMechanics.has("unyielding")) return false;
    const baseChance = (civ.mechanicValues && civ.mechanicValues.unyielding) || 0.5;
    const priorTriggers = unit._unyieldingTriggers || 0;
    const chance = Math.max(0, baseChance - UNYIELDING_DECAY_PER_TRIGGER * priorTriggers);
    if (Math.random() >= chance) return false;
    if (!simulated) {
      unit._unyieldingTriggers = priorTriggers + 1;
      if (Math.random() < CFG.unyieldingForcedRestChance) setCondition(unit, "forcedRest", {});
    }
    return true;
  }

  /**
   * Should the counterattack from `countererUnit` (against `recipientUnit`,
   * who would receive it) be negated this hit ENTIRELY? Only Invulnerability
   * is handled here -- First Strike's counter denial and Flying's evasion
   * miss are both separate, earlier-checked gates inside resolveRound's
   * dealReturn, not part of this function.
   */
  function counterIsNegated(recipientUnit, recipientCiv) {
    return rollsInvulnerable(recipientUnit, recipientCiv);
  }

  /** Flying (2026-07-16): flat chance a non-Ranged hitter (effectiveRange < 2)
   *  simply misses a Flying target outright, dealing no damage -- see
   *  resolveRound's doc comment and dealForward/dealReturn for the two
   *  (symmetric) places this is rolled. */
  const FLYING_EVASION_MISS_CHANCE = CFG.flyingEvasionMissChance;

  /**
   * Resolves ONE exchange between attacker and defender unit objects (each
   * must have .hp, .x, .y, .typeId, .civId set -- .x/.y are read here to
   * determine adjacency, not passed in via context). Mutates hp on both.
   * `context` may carry `attackerGarrisoned`/`defenderGarrisoned` (each
   * unit's own garrison status, independent of the other) which map to the
   * `garrisoned` flag `effectiveDefense` reads for garrison_defense_bonus.
   *
   * Ranged property (see effectiveRange/units.js): if the attacker isn't
   * adjacent to the defender, this is a Ranged attack from distance --
   * counterattack is impossible regardless of anything else (a unit can't
   * hit back at something that isn't next to it), so dealReturn is skipped
   * entirely and `counterOutOfRange` comes back true. First Strike has
   * nothing to act on either way, since there's no counter in play at all.
   *
   * First Strike property -- two independent effects, both driven by
   * effectiveFirstStrikePct (2026-07-16 redesign, see
   * project_first_strike_redesign memory for the simulation work behind the
   * numbers):
   *   1. ORDER: whichever side has the strictly higher First Strike %
   *      simply acts first -- a direct comparison, not a roll. Equal
   *      values (including the common both-zero case) resolve
   *      simultaneously, same as always. This only changes the outcome
   *      when the first-acting side's hit is LETHAL: the loser's hit is
   *      skipped entirely (they're already dead) -- a non-lethal hit
   *      changes nothing about the round regardless of order, exactly as
   *      before.
   *   2. COUNTER DENIAL: independently, the ATTACKER's own First Strike %
   *      (never a race against the defender's) is rolled fresh EVERY
   *      round as a flat chance to prevent the defender's counter from
   *      happening at all -- "hit them fast enough that they don't get to
   *      hit back." One-directional (only a counterattack can ever be
   *      denied this way, never the forward hit) and stacks with effect
   *      #1 rather than replacing it.
   *
   * Flying property (2026-07-16): a non-Ranged hitter (effectiveRange < 2 --
   * melee weaponry) has a flat FLYING_EVASION_MISS_CHANCE chance to simply
   * miss a Flying TARGET outright, dealing no damage at all, on every
   * exchange -- ground-bound melee genuinely struggles to connect with
   * something airborne. Checked per-HIT, not per-unit: it's whichever
   * side is throwing the punch (its own range) against whoever's on the
   * receiving end (their flying status) -- so a melee defender's counter
   * against a Flying attacker can miss too, independent of whether the
   * forward hit did. A Ranged hitter (effectiveRange >= 2) is unaffected
   * either direction -- a bow/gun/spell tracks a flying target fine.
   *
   * Returns { fullDamage, fullNegated, fullMissed, counterDamage,
   * counterNegated, counterDenied, counterMissed, forwardSkipped,
   * returnSkipped, counterOutOfRange }. forwardSkipped/returnSkipped are
   * true when a hit never happened because the other side's order-winning
   * Double Strike property (see effectiveDoubleStrikePct): after the exchange
   * above has fully resolved, the ATTACKER rolls its own Double Strike % for
   * a flat chance at one extra forward hit. That follow-up never draws a
   * counter (the counter, if any, already happened) and is range-agnostic --
   * a Ranged attacker gets a second shot from distance. It's reported
   * separately in `doubleStruck`/`doubleDamage`/`doubleNegated`/`doubleMissed`
   * so a caller can narrate/animate it as its own blow rather than silently
   * folding it into fullDamage.
   *
   * hit already killed its target first; counterDenied is First Strike's
   * effect #2 above (independent of lethality, checked every round);
   * fullMissed/counterMissed is the Flying-evasion miss described above;
   * counterNegated is a wholly different mechanism (currently only Human
   * Invulnerability); counterOutOfRange is the separate, Ranged-only case
   * where no counter was ever possible at all.
   */
  function resolveRound(attackerUnit, defenderUnit, civs, context = {}) {
    const attackerCiv = civs[attackerUnit.civId];
    const defenderCiv = civs[defenderUnit.civId];

    // Dwarf "Runeforged Titan": treated like a structure for incoming damage
    // (see units.js's `siegeTarget` doc) -- the forward hit against it goes
    // through effectiveAttack with isSiege forced on, same as attackStructure/
    // attackCity, so a Siege-property attacker (or Orc's siegeAttackBonus tech)
    // cuts through its otherwise very high defense the same way it would cut
    // through a wall. Only the FORWARD direction is affected -- the Titan's
    // own counter/offense isn't a siege attack just because it's a Titan.
    const attackingSiegeTarget = !!window.GameData.getUnit(defenderUnit.typeId).siegeTarget;

    const atkContext = { ...context, garrisoned: !!context.attackerGarrisoned,
      opposingCivId: defenderCiv.id, adjacentAllyCount: countAdjacentMilitaryAllies(attackerUnit, attackerCiv),
      isSiege: context.isSiege || attackingSiegeTarget };
    const defContext = { ...context, garrisoned: !!context.defenderGarrisoned,
      opposingCivId: attackerCiv.id, adjacentAllyCount: countAdjacentMilitaryAllies(defenderUnit, defenderCiv) };

    const isAdjacent = Math.max(Math.abs(attackerUnit.x - defenderUnit.x), Math.abs(attackerUnit.y - defenderUnit.y)) <= 1;

    const atkStat = effectiveAttack(attackerUnit, attackerCiv, atkContext);
    const defStat = effectiveDefense(defenderUnit, defenderCiv, defContext);
    let counterAtkStat = effectiveAttack(defenderUnit, defenderCiv, defContext);
    const counterDefStat = effectiveDefense(attackerUnit, attackerCiv, atkContext);

    // Order (effect #1, see doc comment above): a direct comparison, not a
    // roll. Never applies when not adjacent -- there's no counter to
    // out-pace either way (see dealReturn below).
    const atkFirstStrikePct = effectiveFirstStrikePct(attackerUnit, attackerCiv);
    const defFirstStrikePct = effectiveFirstStrikePct(defenderUnit, defenderCiv);
    const forwardFirst = isAdjacent && atkFirstStrikePct > defFirstStrikePct;
    const returnFirst = isAdjacent && defFirstStrikePct > atkFirstStrikePct;

    // Tech: Halfellow "High Ground" -- defender's counter deals +50% extra
    // damage while standing on Hills, regardless of First Strike.
    if (context.defenderOnHills
        && defenderCiv.unlockedMechanics && defenderCiv.unlockedMechanics.has("high_ground")) {
      counterAtkStat *= 1.50;
    }

    let fullDamage = 0, fullNegated = false, fullMissed = false;
    let counterDamage = 0, counterNegated = false, counterDenied = false, counterMissed = false;
    let forwardSkipped = false, returnSkipped = false, counterOutOfRange = false;
    let doubleStruck = false, doubleDamage = 0, doubleNegated = false, doubleMissed = false;

    /** One forward hit from attacker to defender, applied to the defender's
     *  HP. Split out from dealForward so Double Strike's follow-up swing can
     *  reuse the identical hit resolution (evasion, invulnerability, damage
     *  mult, death saves) while reporting into its OWN result fields rather
     *  than overwriting the first hit's. */
    function performForward() {
      // Flying evasion (see doc comment above): a non-Ranged attacker has a
      // flat chance to simply miss a Flying defender outright -- checked
      // first, before anything else, since a miss never connects at all.
      if (isFlying(defenderUnit) && effectiveRange(attackerUnit, attackerCiv) < 2
          && Math.random() < FLYING_EVASION_MISS_CHANCE) {
        return { damage: 0, negated: false, missed: true };
      }
      if (rollsInvulnerable(defenderUnit, defenderCiv)) {
        return { damage: 0, negated: true, missed: false };
      }
      let damage = mitigatedDamage(atkStat, defStat);
      // Elf "Whirlwind Strike"/"Blade Storm":
      // an AoE normal action that deals a FRACTION of a normal hit's
      // damage to every target in range -- scaled here, post-mitigation
      // (a straightforward "% of normal damage" reading), rather than by
      // shrinking atkStat pre-mitigation, which wouldn't scale linearly
      // through mitigatedDamage's ratio. Defaults to 1 (a no-op) for
      // every ordinary single-target call site. See ai.js's
      // performBladeSweep, the sole caller that passes this.
      if (context.attackDamageMult != null) damage = Math.round(damage * context.attackDamageMult);
      // Tech: Halfellow "Resilient Spirit" -- a would-be-lethal hit has a
      // 50% chance to be negated entirely instead (forces a Rest next turn).
      // Dwarf "Unyielding" -- same shape, own decay rate/probabilistic rest.
      if (rollsDeathSave(defenderUnit, defenderCiv, damage, context.simulated)
          || rollsUnyieldingSave(defenderUnit, defenderCiv, damage, context.simulated)) {
        return { damage: 0, negated: true, missed: false };
      }
      defenderUnit.hp -= damage;
      return { damage, negated: false, missed: false };
    }

    function dealForward() {
      const hit = performForward();
      fullDamage = hit.damage;
      fullNegated = hit.negated;
      fullMissed = hit.missed;
    }
    function dealReturn() {
      if (!isAdjacent) { counterOutOfRange = true; return; }
      // First Strike counter denial (effect #2, see doc comment above): the
      // ATTACKER's own First Strike % gets an independent, flat chance
      // EVERY round to prevent this counter from happening at all --
      // checked first since a denied counter never occurs in the first
      // place (Invulnerability/death-saves never even get evaluated).
      if (Math.random() < atkFirstStrikePct) {
        counterDenied = true;
        return;
      }
      // Flying evasion, mirrored for the counter direction: the counter-
      // attacker here is defenderUnit, and its target is attackerUnit.
      if (isFlying(attackerUnit) && effectiveRange(defenderUnit, defenderCiv) < 2
          && Math.random() < FLYING_EVASION_MISS_CHANCE) {
        counterMissed = true;
        return;
      }
      counterNegated = counterIsNegated(attackerUnit, attackerCiv);
      if (!counterNegated) {
        let dmg = Math.round(mitigatedDamage(counterAtkStat, counterDefStat) / 2);
        // Whirlwind Strike/Blade Storm (see attackDamageMult above) --
        // counterDamageMult scales an already-adjacent target's counter down
        // further (25%/16% effectiveness); a non-adjacent Blade Storm target
        // never reaches this function at all (isAdjacent already guards
        // dealReturn's entry above), so it needs no separate suppression here.
        if (context.counterDamageMult != null) dmg = Math.round(dmg * context.counterDamageMult);
        counterDamage = Math.max(0, dmg);
        // Tech: Halfellow "Resilient Spirit" -- same death-save, applied to a
        // would-be-lethal COUNTERATTACK against the original attacker.
        // Dwarf "Unyielding" -- same shape, own decay rate/probabilistic rest.
        if (rollsDeathSave(attackerUnit, attackerCiv, counterDamage, context.simulated)
            || rollsUnyieldingSave(attackerUnit, attackerCiv, counterDamage, context.simulated)) {
          counterNegated = true;
          counterDamage = 0;
        } else {
          attackerUnit.hp -= counterDamage;
        }
      }
    }

    if (returnFirst) {
      dealReturn();
      if (attackerUnit.hp > 0) dealForward();
      else forwardSkipped = true;
    } else if (forwardFirst) {
      dealForward();
      if (defenderUnit.hp > 0) dealReturn();
      else returnSkipped = true;
    } else {
      dealForward();
      dealReturn();
    }

    // Double Strike (see effectiveDoubleStrikePct): rolled once per round,
    // AFTER the exchange has fully resolved. Resolving it last is what makes
    // "no counterattack from the second hit" fall out for free -- dealReturn
    // has already happened (or been denied/skipped) and is never called
    // again. Gated on both sides still standing: an attacker cut down by the
    // counter doesn't get a follow-up, and there is nothing to swing at if
    // the first hit already killed the defender. Deliberately NOT gated on
    // adjacency -- per the mechanic's design, a Ranged attacker gets its
    // second shot at distance exactly like a melee unit gets a second blow.
    if (attackerUnit.hp > 0 && defenderUnit.hp > 0 && !forwardSkipped) {
      const doubleStrikePct = effectiveDoubleStrikePct(attackerUnit, attackerCiv);
      if (doubleStrikePct > 0 && Math.random() < doubleStrikePct) {
        doubleStruck = true;
        const hit = performForward();
        doubleDamage = hit.damage;
        doubleNegated = hit.negated;
        doubleMissed = hit.missed;
      }
    }

    return { fullDamage, fullNegated, fullMissed, counterDamage, counterNegated, counterDenied, counterMissed,
      forwardSkipped, returnSkipped, counterOutOfRange,
      doubleStruck, doubleDamage, doubleNegated, doubleMissed,
      // First Strike's ORDER effect actually deciding who went first this
      // round (see the doc comment above) -- exposed so a caller can narrate
      // it the same way doubleStruck narrates Double Strike's follow-up hit.
      // Both false when First Strike was tied (including the common
      // both-zero case) or the round wasn't adjacent at all.
      forwardFirst, returnFirst };
  }

  /**
   * Resolves a FULL engagement (multiple exchanges) until one side's HP <= 0.
   * Used for Guardian encounters and AI win-probability estimation.
   */
  function resolveToTheDeath(attackerUnit, defenderUnit, civs, context = {}, maxRounds = 50) {
    const rounds = [];
    let r = 0;
    while (attackerUnit.hp > 0 && defenderUnit.hp > 0 && r < maxRounds) {
      rounds.push(resolveRound(attackerUnit, defenderUnit, civs, context));
      r++;
    }
    let outcome;
    if (attackerUnit.hp <= 0 && defenderUnit.hp <= 0) outcome = "both_dead";
    else if (attackerUnit.hp <= 0) outcome = "defender_wins";
    else if (defenderUnit.hp <= 0) outcome = "attacker_wins";
    else outcome = "unresolved"; // hit maxRounds safety cap
    return { outcome, rounds };
  }

  /**
   * Initializes a unit instance's HP from its base type (called on
   * creation/raise). Also rolls and stamps `unit.gender` and `unit.name`
   * here -- the one choke point nearly every unit-creation call site
   * already runs through -- so the sprite picker (js/ui/sprites.js's
   * pick(), which reads unit.gender) and the name data (js/data/unit-
   * names.js, which is handed the same gender) always agree. `civ` is
   * optional only for callers that truly have none in scope; without it
   * gender/name are skipped (rare -- currently none of the real call
   * sites omit it).
   */
  function initUnitHP(unit, civ) {
    const baseUnit = window.GameData.getUnit(unit.typeId);
    unit.maxHp = window.GameData.unitMaxHP(baseUnit.attack || 0, baseUnit.defense || 0, unit.typeId);
    unit.hp = unit.maxHp;
    if (civ && civ.raceId && !unit.name) {
      // nameSpecial (ship/machine/construct/beast, see units.js's doc
      // comment) gets a proper-noun designation and no gender at all --
      // gendered naming only applies to units representing a PERSON.
      unit.gender = baseUnit.nameSpecial ? null : (Math.random() < 0.5 ? "male" : "female");
      unit.name = window.GameData.getRandomUnitName(civ.raceId, unit.typeId, unit.gender);
    }
    // Veteran leveling (see LEVELING section) -- guarded so a defensive
    // re-init call never wipes an already-in-progress unit's level.
    if (unit.level == null) {
      unit.xp = 0;
      unit.level = 0;
      unit.levelBonuses = {};
    }
    return unit;
  }

  /**
   * Healing -- Rest is now a required explicit action (see turns.js), not a
   * passive per-turn tick. Called only for units that chose to Rest this turn.
   */
  function healUnit(unit, civ, inOwnCity, tile, extraMult = 1) {
    const race = window.GameData.getRace(civ.raceId);
    if (race.noHealing) {
      // Undead only heal when standing on a ruin tile
      if (race.ruinHeal && tile && tile.isRuin) {
        // Minimum 1 HP: a percentage-of-maxHp
        // roll can round to 0 on a small unit/low roll, which reads as
        // "healing did nothing" -- every heal that actually triggers should
        // visibly do SOMETHING.
        const healAmount = Math.max(1, Math.round((unit.maxHp * 2 * roll3d6()) / 100));
        const before = unit.hp;
        unit.hp = Math.min(unit.maxHp, unit.hp + healAmount);
        window.GameEngine.floatingText.spawnHealGain(unit, unit.hp - before);
      }
      return unit.hp;
    }

    let multiplier = 2; // field rate: 2x(3d6)%
    if (inOwnCity) {
      multiplier = race.ownCityHealingMultiplier || 4;
    } else if (race.influenceHealMult && tile && tile.ownerCivId === civ.id) {
      // Halfellow: +25% heal rate when on any civ-owned tile outside a city
      multiplier = Math.round(multiplier * race.influenceHealMult);
    }
    if (!inOwnCity && civ.unlockedMechanics?.has("hearth_and_homeland")
        && window.GameEngine.cities.isTileFilledForCiv(civ, unit.x, unit.y)) {
      // Halfellow "Hearth and Homeland": bonus heal rate on any filled-in tile
      // within one of the civ's city borders, not just inside the city itself.
      multiplier += multiplier * (civ.mechanicValues?.hearth_and_homeland || 0);
    }
    // Halfellow "Devoted Companions": a carried passenger heals 33% faster
    // than normal -- see turns.js's automatic per-turn passenger heal (the
    // only caller that passes a non-default extraMult).
    multiplier *= extraMult;
    const pct = multiplier * roll3d6();
    // Minimum 1 HP -- a low roll on a small unit
    // (e.g. a 3-maxHP Scout resting at the 2x field rate) could round this to
    // 0, which reads as Rest having silently done nothing at all.
    const healAmount = Math.max(1, Math.round((unit.maxHp * pct) / 100));
    const before = unit.hp;
    unit.hp = Math.min(unit.maxHp, unit.hp + healAmount);
    window.GameEngine.floatingText.spawnHealGain(unit, unit.hp - before);
    return unit.hp;
  }

  /**
   * Halfellow "Rouse the People": once researched, a defended city/wall/
   * building fights back. Gains an attack stat (at least the Militia's,
   * never less than whatever it already had). No First-Strike discount --
   * Human's Ramparts has its own separate copy of that discount in
   * wallCounterattack below. A deliberate, confirmed exception to
   * "structures never counterattack" everywhere else in the game.
   *
   * Reach: derived from the Militia's own range (same convention as Human's
   * wallCounterattack deriving its reach from the Archer's range below) --
   * Militia has no `range` property, so this is melee-only (1 tile). An
   * attacker striking from further away (a Ranged unit standing off at
   * distance) is simply out of the structure's retaliatory reach and takes
   * no counter damage at all. Mutates attackerUnit.hp; returns the raw
   * counter damage dealt (0 if out of reach).
   */
  function structureCounterattack(structureRecord, defenderCiv, attackerUnit, attackerCiv) {
    const militia = window.GameData.getUnit("militia");
    const dist = Math.max(Math.abs(attackerUnit.x - structureRecord.x), Math.abs(attackerUnit.y - structureRecord.y));
    if (dist > (militia.range || 1)) return 0;
    const atk = Math.max(structureRecord.attack || 0, militia.attack);
    const defStat = effectiveDefense(attackerUnit, attackerCiv, {});
    const dmg = mitigatedDamage(atk, defStat);
    attackerUnit.hp -= dmg;
    return dmg;
  }

  /**
   * Human "Ramparts" (2026-08-17, user-directed rework): walls AND cities
   * (not other buildings) can counterattack ONLY while a unit is Garrisoned
   * (unit.channeling === "garrison") in this city -- see attackStructure
   * (walls) and attackCity (cities) for the two call sites. No garrison, no
   * counterattack at all (structureRecord's own base attack, if any, no
   * longer applies here either -- Ramparts' whole premise is now "the walls
   * fight as well as whoever's holding them"). The wall's attack rating AND
   * reach both become that garrisoned unit's own effectiveAttack/
   * effectiveRange, exactly ("becomes the same as that unit"). Same
   * structure-specific 25% First-Strike discount as Rouse the People/
   * Spikes! use. Mutates attackerUnit.hp; returns the raw counter damage
   * dealt (0 if nothing's garrisoned, or the attacker is out of the
   * garrisoned unit's reach).
   */
  function wallCounterattack(structureRecord, defenderCiv, attackerUnit, attackerCiv, gameState) {
    if (!gameState) return 0;
    // A wall segment can sit anywhere in the city's radius, not necessarily
    // on the city's own tile (unlike attackCity's call, where
    // structureRecord IS the city -- its x/y already ARE the city's own).
    // Resolve via the tile's structure pointer (cityX/cityY, same fields
    // cities.js's findStructureAt reads) when there is one; falls back to
    // structureRecord's own x/y otherwise, which is exactly correct for the
    // city-attack call.
    const { map } = gameState;
    const tile = map.tiles[structureRecord.y * map.width + structureRecord.x];
    const ptr = tile && tile.structure;
    const cityX = ptr ? ptr.cityX : structureRecord.x;
    const cityY = ptr ? ptr.cityY : structureRecord.y;
    const garrison = defenderCiv.units.find((u) =>
      u.channeling === "garrison" && u.x === cityX && u.y === cityY);
    if (!garrison) return 0;
    const range = effectiveRange(garrison, defenderCiv);
    const dist = Math.max(Math.abs(attackerUnit.x - structureRecord.x), Math.abs(attackerUnit.y - structureRecord.y));
    if (dist > range) return 0;
    const atk = effectiveAttack(garrison, defenderCiv, {});
    const defStat = effectiveDefense(attackerUnit, attackerCiv, {});
    let dmg = mitigatedDamage(atk, defStat);
    if (hasFirstStrike(attackerUnit, attackerCiv)) dmg = Math.round(dmg * 0.75);
    attackerUnit.hp -= dmg;
    return dmg;
  }

  /** Orc "Spikes!"/"Bigger Spikes!": the higher
   *  tech (if known) always wins rather than stacking with the lower one --
   *  same "upgrade tech" convention as e.g. Sudden Doom replacing Strike
   *  from the Shadows. 0 if the civ has neither. Ratings 2/4 (2026-08-17,
   *  user-directed, up from 1/2). */
  function spikesAttackRating(civ) {
    if (!civ.unlockedMechanics) return 0;
    if (civ.unlockedMechanics.has("bigger_spikes")) return 4;
    if (civ.unlockedMechanics.has("spikes")) return 2;
    return 0;
  }

  /** Orc "Spikes!"/"Bigger Spikes!": structurally identical to Human's
   *  Ramparts above (same Archer-derived reach, same 25% First-Strike
   *  discount, no militia spawn) but with a FLAT attack rating
   *  (spikesAttackRating) instead of deriving from the Archer -- never
   *  LOWERS the structure's existing attack, same max() convention as
   *  wallCounterattack/structureCounterattack. Mutates attackerUnit.hp;
   *  returns the raw counter damage dealt (0 if out of reach). */
  function spikesCounterattack(structureRecord, defenderCiv, attackerUnit, attackerCiv, flatAttack) {
    const archer = window.GameData.getUnit("archer");
    const dist = Math.max(Math.abs(attackerUnit.x - structureRecord.x), Math.abs(attackerUnit.y - structureRecord.y));
    if (dist > (archer.range || 1)) return 0;
    const baseAtk = Math.max(structureRecord.attack || 0, flatAttack);
    const defStat = effectiveDefense(attackerUnit, attackerCiv, {});
    let dmg = mitigatedDamage(baseAtk, defStat);
    if (hasFirstStrike(attackerUnit, attackerCiv)) dmg = Math.round(dmg * 0.75);
    attackerUnit.hp -= dmg;
    return dmg;
  }

  /** Halfellow "Rouse the People": `chance` probability a Militia spawns
   *  adjacent to (x,y) -- 5% on being attacked (2026-07-20, user-directed,
   *  raised from 1% -- see attackStructure/attackCity below), or 15%
   *  specifically when a building/wall is actually destroyed (see ai.js
   *  considerAttackOrGarrison's destroy handling). Returns the spawned
   *  unit, or null. */
  function maybeSpawnMilitia(defenderCiv, x, y, map, civs, chance = 0.05) {
    if (Math.random() >= chance) return null;
    const offsets = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
    for (const [dx, dy] of offsets.sort(() => Math.random() - 0.5)) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) continue;
      const terrain = window.GameData.TERRAIN[map.tiles[ny * map.width + nx].terrain];
      if (terrain.isWater || terrain.moveCostLand === window.GameData.IMPASSABLE) continue;
      if (Object.values(civs).some((c) => c.units.some((u) => u.x === nx && u.y === ny))) continue;
      const militia = { typeId: "militia", civId: defenderCiv.id, x: nx, y: ny, isCivilian: false };
      const homeCity = defenderCiv.cities && defenderCiv.cities.find((c) => c.x === x && c.y === y);
      if (homeCity) militia.homeCityName = homeCity.name;
      initUnitHP(militia, defenderCiv);
      defenderCiv.units.push(militia);
      return militia;
    }
    return null;
  }

  /** Orc "Hound and Hunter": 50% chance a Raider or a Dire Wolf (50/50
   *  between the two) spawns on a dead Wolf Rider's own tile -- unlike
   *  maybeSpawnMilitia's adjacent-tile search (that structure/city is
   *  still standing when it fires), the Wolf Rider's own tile is already
   *  vacated by its death, so there's nothing to search around. Only
   *  fires for wolf_rider deaths -- callers gate on `deadUnit.typeId`
   *  before calling this. Returns the spawned unit, or null. */
  function maybeSpawnHoundAndHunter(civ, x, y, map) {
    if (Math.random() >= 0.5) return null;
    const terrain = window.GameData.TERRAIN[map.tiles[y * map.width + x].terrain];
    if (terrain.isWater || terrain.moveCostLand === window.GameData.IMPASSABLE) return null;
    const replacementId = Math.random() < 0.5 ? "raider" : "dire_wolf";
    const replacement = { typeId: replacementId, civId: civ.id, x, y, isCivilian: false };
    initUnitHP(replacement, civ);
    civ.units.push(replacement);
    return replacement;
  }

  /** Halfellow "Undaunted": 25% chance a
   *  Wanderer spawns on a dead Pony Patrol's own tile -- same shape as Orc's
   *  Hound and Hunter above (spawns on the dead unit's own now-vacated
   *  tile), just a single replacement type instead of a 50/50 pick. Only
   *  fires for pony_patrol deaths -- callers gate on `deadUnit.typeId`
   *  before calling this. Returns the spawned unit, or null. */
  function maybeSpawnPonyReplacement(civ, x, y, map) {
    if (Math.random() >= 0.25) return null;
    const terrain = window.GameData.TERRAIN[map.tiles[y * map.width + x].terrain];
    if (terrain.isWater || terrain.moveCostLand === window.GameData.IMPASSABLE) return null;
    const replacement = { typeId: "wanderer", civId: civ.id, x, y, isCivilian: false };
    initUnitHP(replacement, civ);
    civ.units.push(replacement);
    return replacement;
  }

  /** Halfellow "Unlock the Gate": a Trouble
   *  Maker can disable a targeted wall (and every wall adjacent to it) for
   *  3 rounds -- zeroes its defense stat AND suppresses every special wall
   *  defense (Rouse the People, Ramparts, Spikes/Bigger Spikes, Treetop
   *  Snipers), regardless of which the defender has unlocked. A single flag
   *  on the structure record, checked at every one of those four call
   *  sites (attackStructure below, and ai.js's tickWallDefense) instead
   *  of each mechanic needing its own awareness of it. */
  function isWallDefenseSuppressed(structureRecord, turnNumber) {
    return structureRecord.gateUnlockedUntilTurn != null && (turnNumber || 0) < structureRecord.gateUnlockedUntilTurn;
  }

  /**
   * A unit attacks a static structure. Mutates the structure record's hp.
   * Returns { damage, destroyed, counterDamage, militiaSpawned }. Most
   * structures have no `defense` stat and take the raw damage roll
   * unmitigated, same as before walls existed; walls (and any future
   * structure with `defense` set) reduce it via the same self-scaling
   * def/(atk+def) formula unit-vs-unit combat uses (mitigatedDamage), so a
   * defended structure meaningfully outlasts a plain one instead of just
   * having more HP. `defenderCiv`/`gameState` are optional -- only needed to
   * evaluate Halfellow's "Rouse the People" (every other race's structures
   * still never counterattack) or Human's "Ramparts" (walls and cities).
   */
  function attackStructure(unit, structureRecord, attackerCiv, defenderCiv, gameState) {
    const building = window.GameData.getBuilding(structureRecord.id);
    const gateUnlocked = isWallDefenseSuppressed(structureRecord, gameState && gameState.turnNumber);
    // Siege property only applies when the attacker is actually adjacent --
    // a Ranged attack from further away (see effectiveRange) never benefits
    // from it, EXCEPT a unit with the base-data `siegeAtRange` property
    // (Catapult/Trebuchet), which keeps its siege bonus regardless of distance.
    const isAdjacent = Math.max(Math.abs(unit.x - structureRecord.x), Math.abs(unit.y - structureRecord.y)) <= 1;
    const isSiege = isAdjacent || !!window.GameData.getUnit(unit.typeId).siegeAtRange;
    const atk = effectiveAttack(unit, attackerCiv, { isSiege, opposingCivId: defenderCiv && defenderCiv.id });
    const rollHit = () => building.defense && !gateUnlocked
      ? mitigatedDamage(atk, building.defense)
      : Math.round(damageRoll(atk));
    const dmg = rollHit();
    structureRecord.hp -= dmg;
    // Double Strike (2026-08-12, user-directed: confirmed it can resolve
    // against structures, same as it already does against units in
    // resolveRound) -- a structure never counterattacks at all, so there's
    // no return-hit sequencing to worry about; just a flat second roll of
    // the same chance, gated on the first hit not already having destroyed
    // the structure.
    let doubleStruck = false, doubleDamage = 0;
    if (structureRecord.hp > 0) {
      const doubleStrikePct = effectiveDoubleStrikePct(unit, attackerCiv);
      if (doubleStrikePct > 0 && Math.random() < doubleStrikePct) {
        doubleStruck = true;
        doubleDamage = rollHit();
        structureRecord.hp -= doubleDamage;
      }
    }
    let counterDamage = 0, militiaSpawned = null;
    if (gateUnlocked) {
      // Every special wall defense suppressed -- fall straight through with
      // no counterattack of any kind, regardless of what's unlocked.
    } else if (defenderCiv && defenderCiv.unlockedMechanics && defenderCiv.unlockedMechanics.has("rouse_the_people")) {
      counterDamage = structureCounterattack(structureRecord, defenderCiv, unit, attackerCiv);
      if (gameState) militiaSpawned = maybeSpawnMilitia(defenderCiv, structureRecord.x, structureRecord.y, gameState.map, gameState.civs);
    } else if (building.isWall && defenderCiv && defenderCiv.unlockedMechanics && defenderCiv.unlockedMechanics.has("ramparts")) {
      counterDamage = wallCounterattack(structureRecord, defenderCiv, unit, attackerCiv, gameState);
    } else if (defenderCiv && spikesAttackRating(defenderCiv) > 0) {
      // Orc "Spikes!"/"Bigger Spikes!": scope
      // widened from walls-only to any structure (walls, buildings, and
      // cities via attackCity below) -- same "any structure" scope Rouse
      // the People already uses just above, no isWall gate anymore.
      counterDamage = spikesCounterattack(structureRecord, defenderCiv, unit, attackerCiv, spikesAttackRating(defenderCiv));
    }
    return { damage: dmg, destroyed: structureRecord.hp <= 0, counterDamage, militiaSpawned, doubleStruck, doubleDamage };
  }

  /**
   * CITY SIEGE
   * ----------
   * A city's level (== its population, 1-10) is both its influence strength
   * AND its structural integrity. An ungarrisoned city can be attacked
   * directly (garrisoned defenders are fought as normal units first -- the
   * caller in ai.js enforces this by only reaching here once the tile has no
   * defender). A city now carries a real HP pool (2026-08-04, user-directed
   * -- replaces the old single probabilistic win/lose roll): each attack
   * deals mitigatedDamage(atk, cityDefenseValue) straight off city.hp, same
   * formula and shape attackStructure already uses. When hp hits 0, the city
   * drops one population level and hp refills to the new (smaller) max --
   * no overkill carryover into that fresh pool, same as a unit or structure
   * dying doesn't cleave onto whatever's next. A level-1 city that hits 0 hp
   * is destroyed outright rather than dropping to a nonsensical level 0. A
   * city never counterattacks on its own (Rouse the People/Ramparts/Spikes
   * below are the only exceptions, same as before).
   */
  const CITY_BASE_DEFENSE = CFG.cityBaseDefense;
  const CITY_DEFENSE_PER_LEVEL = CFG.cityDefensePerLevel;
  const CITY_DEFENSE_PER_STRUCTURE = CFG.cityDefensePerStructure;
  const CITY_DEFENSE_PER_WALL = CFG.cityDefensePerWall;
  const CITY_HP_PER_LEVEL = CFG.cityHpPerLevel;

  /** Higher for a bigger, more built-up city -- deliberately has no defender
   *  garrison bonus of its own (that's the job of an actual defending unit;
   *  this value only matters once the city has none).
   *
   *  Walls count TWICE: once via the generic
   *  CITY_DEFENSE_PER_STRUCTURE every structure already contributes just for
   *  existing, and again via CITY_DEFENSE_PER_WALL specifically for being a
   *  wall -- the premium a wall is actually FOR. Only alive walls count
   *  (s.hp > 0): a wall battered down to 0 hp is removed from
   *  city.structures entirely elsewhere (destroyStructure), so this filter
   *  is mostly belt-and-suspenders, but it's the correct rule regardless of
   *  how that removal is implemented. */
  function cityDefenseValue(city) {
    const level = Math.max(1, Math.floor(city.population));
    const wallCount = city.structures.filter((s) => s.hp > 0 && window.GameData.getBuilding(s.id).isWall).length;
    return CITY_BASE_DEFENSE + level * CITY_DEFENSE_PER_LEVEL
      + city.structures.length * CITY_DEFENSE_PER_STRUCTURE
      + wallCount * CITY_DEFENSE_PER_WALL;
  }

  /** A city's max HP: purely population-based (CITY_HP_PER_LEVEL per level),
   *  no structure bonus -- that's what cityDefenseValue is for. Derived, not
   *  stored, so it always reflects the city's CURRENT population with no
   *  separate field to keep in sync when population changes elsewhere
   *  (growth, starvation). */
  function cityMaxHp(city) {
    return CITY_HP_PER_LEVEL * Math.max(1, Math.floor(city.population));
  }

  /** AI scoring/threshold heuristic (2026-08-04): no longer a literal win
   *  probability now that every attack lands for real damage (mitigated,
   *  floored at 1, same as any other attack in the game) rather than a
   *  binary hit/miss -- kept as the same atk/(atk+def) ratio anyway, since
   *  it's still a valid 0-1 "how favorable is this matchup" signal for
   *  ai.js's scoring and minAcceptableWinProbability threshold checks, just
   *  no longer literally interpreted as "chance this attack does anything."
   *  Siege-property units and the isSiege context already boost `atk` via
   *  effectiveAttack -- but only when the attacker is actually adjacent to
   *  the city (see attackStructure's matching comment and its
   *  `siegeAtRange` exception). */
  function cityAttackWinProbability(unit, city, attackerCiv, defenderCivId) {
    const isAdjacent = Math.max(Math.abs(unit.x - city.x), Math.abs(unit.y - city.y)) <= 1;
    const isSiege = isAdjacent || !!window.GameData.getUnit(unit.typeId).siegeAtRange;
    const atk = effectiveAttack(unit, attackerCiv, { isSiege, opposingCivId: defenderCivId });
    const def = cityDefenseValue(city);
    return atk / (atk + def);
  }

  /**
   * Resolves one attack against an ungarrisoned city. Mutates city.hp (and
   * city.population/city.hp again on a population loss). Returns
   * { damage, populationLost, destroyed, counterDamage, militiaSpawned,
   * hp, maxHp }. When destroyed is true, the caller is responsible for
   * removing the city (window.GameEngine.cities.destroyCity) and re-
   * checking that civ's elimination status -- this function only knows
   * about the single city, not the wider game state. `defenderCiv`/
   * `gameState` are optional -- only needed to evaluate Halfellow's "Rouse
   * the People" or Human's "Ramparts" (see attackStructure).
   */
  function attackCity(unit, city, attackerCiv, defenderCiv, gameState) {
    const isAdjacent = Math.max(Math.abs(unit.x - city.x), Math.abs(unit.y - city.y)) <= 1;
    const isSiege = isAdjacent || !!window.GameData.getUnit(unit.typeId).siegeAtRange;
    const atk = effectiveAttack(unit, attackerCiv, { isSiege, opposingCivId: defenderCiv && defenderCiv.id });
    const def = cityDefenseValue(city);
    const dmg = mitigatedDamage(atk, def);
    if (city.hp == null) city.hp = cityMaxHp(city); // defensive -- a city from an older save may predate this field
    city.hp -= dmg;
    // Growth pause: a city attacked this round
    // earns no growth toward its next population level on its own next
    // tick -- see cities.js's tickCity, which checks and clears this flag.
    city.attackedThisTurn = true;
    let destroyed = false, populationLost = false;
    if (city.hp <= 0) {
      const level = Math.floor(city.population);
      if (level <= 1) {
        destroyed = true;
      } else {
        city.population = level - 1;
        city.harvestSurplus = 0; // same reset starvation already applies on a population loss
        city.hp = cityMaxHp(city); // fresh pool at the new, smaller max -- no overkill carryover
        populationLost = true;
      }
    }
    let counterDamage = 0, militiaSpawned = null;
    if (defenderCiv && defenderCiv.unlockedMechanics && defenderCiv.unlockedMechanics.has("rouse_the_people")) {
      counterDamage = structureCounterattack(city, defenderCiv, unit, attackerCiv);
      if (gameState) militiaSpawned = maybeSpawnMilitia(defenderCiv, city.x, city.y, gameState.map, gameState.civs);
    } else if (defenderCiv && defenderCiv.unlockedMechanics && defenderCiv.unlockedMechanics.has("ramparts")) {
      counterDamage = wallCounterattack(city, defenderCiv, unit, attackerCiv, gameState);
    } else if (defenderCiv && spikesAttackRating(defenderCiv) > 0) {
      counterDamage = spikesCounterattack(city, defenderCiv, unit, attackerCiv, spikesAttackRating(defenderCiv));
    }
    return { damage: dmg, populationLost, destroyed, counterDamage, militiaSpawned, hp: Math.max(0, city.hp), maxHp: cityMaxHp(city) };
  }

  /**
   * Fireball-style splash: after a primary hit, deals damage to every enemy
   * unit AND structure adjacent to the target tile. `primaryCiv` is the
   * attacker's civ (used for effectiveAttack); `civs` is the full civs map.
   * `gameState` is needed to look up structures. Returns a log of hits.
   */
  function applySplashDamage(attackerUnit, attackerCiv, targetX, targetY, gameState) {
    const { map, civs } = gameState;
    const atk = effectiveAttack(attackerUnit, attackerCiv, {});
    const hits = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const x = targetX + dx, y = targetY + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        for (const otherCiv of Object.values(civs)) {
          if (otherCiv.id === attackerUnit.civId || otherCiv.eliminated) continue;
          const splashUnit = otherCiv.units.find((u) => u.x === x && u.y === y);
          if (splashUnit) {
            const dmg = Math.round(damageRoll(atk) * 0.5); // splash hits for half the primary roll
            splashUnit.hp -= dmg;
            // Hidden: an AoE effect isn't "aimed," so it can still catch a
            // Hidden unit by accident -- being hit this way reveals it.
            revealHidden(splashUnit, gameState.turnNumber || 0);
            // `unit` (a direct object reference, not just its coordinates)
            // lets a caller apply a follow-on unit-specific effect -- e.g.
            // ai.js's Burning -- without a
            // second lookup pass.
            hits.push({ kind: "unit", x, y, damage: dmg, civId: otherCiv.id, typeId: splashUnit.typeId, unit: splashUnit });
          }
        }
        const structFound = window.GameEngine.cities.findStructureAt(gameState, x, y);
        if (structFound && structFound.civ.id !== attackerUnit.civId) {
          const dmg = Math.round(damageRoll(atk) * 0.5);
          structFound.record.hp -= dmg;
          hits.push({ kind: "structure", x, y, damage: dmg, civId: structFound.civ.id, id: structFound.record.id, record: structFound.record });
        }
      }
    }
    return hits;
  }

  /**
   * Human "Fireball!" (2026-08-17, user-directed rework: was an automatic
   * half-damage splash tacked onto an ordinary attack, now its own standalone
   * targeted action -- see ai.js's performWizardFireball). Deals a FULL
   * damage roll (not applySplashDamage's half-roll) to every enemy unit AND
   * structure in the 3x3 area centered on (centerX, centerY) -- the target
   * tile itself, plus its 8 neighbors, no "primary target" distinction since
   * there's no ordinary attack this is riding on top of anymore. Never hits
   * the caster's own civ, or cities directly (same "structures, not cities"
   * scope applySplashDamage already uses). Returns a log of hits, same shape
   * as applySplashDamage's, for the caller to roll ignite chance against.
   */
  function applyFireballBlast(casterUnit, casterCiv, centerX, centerY, gameState) {
    const { map, civs } = gameState;
    const atk = effectiveAttack(casterUnit, casterCiv, {});
    const hits = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = centerX + dx, y = centerY + dy;
        if (x < 0 || x >= map.width || y < 0 || y >= map.height) continue;
        for (const otherCiv of Object.values(civs)) {
          if (otherCiv.id === casterUnit.civId || otherCiv.eliminated) continue;
          const hitUnit = otherCiv.units.find((u) => u.x === x && u.y === y);
          if (hitUnit) {
            const dmg = mitigatedDamage(atk, effectiveDefense(hitUnit, otherCiv, {}));
            hitUnit.hp -= dmg;
            // Hidden: an AoE blast isn't "aimed," so it can still catch a
            // Hidden unit by accident -- being hit this way reveals it.
            revealHidden(hitUnit, gameState.turnNumber || 0);
            hits.push({ kind: "unit", x, y, damage: dmg, civId: otherCiv.id, typeId: hitUnit.typeId, unit: hitUnit });
          }
        }
        const structFound = window.GameEngine.cities.findStructureAt(gameState, x, y);
        if (structFound && structFound.civ.id !== casterUnit.civId) {
          const dmg = mitigatedDamage(atk, 0);
          structFound.record.hp -= dmg;
          hits.push({ kind: "structure", x, y, damage: dmg, civId: structFound.civ.id, id: structFound.record.id, record: structFound.record });
        }
      }
    }
    return hits;
  }

  window.GameEngine.combat = {
    roll3d6,
    damageRoll,
    recordCombatEvent,
    drainCombatEvents,
    spawnAreaEffect,
    drainAreaEffectEvents,
    mitigatedDamage,
    effectiveAttack,
    effectiveDefense,
    effectiveFirstStrikePct,
    effectiveDoubleStrikePct,
    effectiveSiegePct,
    effectiveRange,
    getUnitProperty,
    isFlying,
    hasFirstStrike,
    setCondition,
    getCondition,
    hasCondition,
    clearCondition,
    tickConditions,
    canGoHidden,
    enterHidden,
    revealHidden,
    applyBefuddled,
    isWallDefenseSuppressed,
    resolveRound,
    resolveToTheDeath,
    initUnitHP,
    healUnit,
    attackStructure,
    applySplashDamage,
    applyFireballBlast,
    cityDefenseValue,
    cityMaxHp,
    cityAttackWinProbability,
    attackCity,
    maybeSpawnMilitia,
    maybeSpawnHoundAndHunter,
    maybeSpawnPonyReplacement,
    markRival,
    hasAltarOfAgesBonus,
    shadowsteedMount,
    MAX_UNIT_LEVEL,
    XP_LEVEL_THRESHOLDS,
    LEVEL_UP_STATS,
    LEVEL_BONUS_VALUES,
    grantXP,
    pendingLevelUps,
    applyLevelUp,
    xpForCombatAction,
  };
})();
