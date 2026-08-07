/**
 * UNIT DATA
 * ---------
 * Pure data: base attack/defense/movement/vision for every unit type. Race
 * modifiers (attackMult etc.) live in races.js and are applied by
 * engine/combat.js -- never baked into these base numbers.
 *
 * HP is derived, not stored: maxHP = round(attack + defense + unitTechLayer).
 * (2026-07-21, user-directed: dropped the flat HP_RATIO multiplier in favor
 * of adding the unit's own tech-tree depth -- see techs.js's unitTechLayer --
 * so later-tree units are innately tougher, not just better-statted.)
 *
 * visionRadius: how far (in tiles) this unit sees, feeding gameState.visibility
 * (see turns.js's refreshVisibility). Default 3 for every unit below; a tech
 * can raise it per unit-type via the unit_stat_upgrade effect (additive, same
 * convention as attack/defense/movement -- see tech.js).
 *
 * UNIT ROSTER: shared infrastructure units (pioneer/scout/galley -- Worker is
 * deprecated, folded into Pioneer's canImprove); Human, Halfellow, Dwarf,
 * Orc, and Elf each have a full researched roster (see techs.js); Undead
 * still has just its one basic melee unit (its tree isn't built out yet).
 *
 * Combat identity now comes from PROPERTIES, not the old role/counter-triangle
 * system (removed -- see game_rules_adjustments.md):
 *   firstStrikePct  0-1   two effects (see combat.js's resolveRound,
 *                          2026-07-16 redesign): (1) order -- whichever
 *                          side has the strictly higher value simply acts
 *                          first (a comparison, not a roll), which only
 *                          matters if that hit is lethal (skips the
 *                          loser's hit entirely); (2) counter denial --
 *                          independently, the ATTACKER's own value is
 *                          rolled fresh EVERY round as a flat chance to
 *                          prevent the defender's counter from happening
 *                          at all, lethal or not. Values are ~10x smaller
 *                          than the old system's since effect (2) now
 *                          fires on every exchange instead of only a
 *                          fight's final lethal round -- see
 *                          project_first_strike_redesign memory.
 *   doubleStrikePct 0-1   flat chance, rolled once per exchange, that this
 *                          unit immediately attacks a SECOND time (see
 *                          combat.js's resolveRound). The follow-up hit:
 *                            - provokes NO counterattack (the defender's
 *                              counter, if any, has already resolved against
 *                              the first hit -- the roll happens last, after
 *                              the whole exchange, which is what makes this
 *                              fall out rather than needing a special case)
 *                            - works at ANY range, unlike Siege: a Ranged
 *                              unit gets a second shot from distance exactly
 *                              as a melee unit gets a second blow
 *                            - only happens if BOTH sides are still standing
 *                              after the first exchange (nothing to swing at,
 *                              or nobody left to swing)
 *                            - is otherwise a completely ordinary forward hit
 *                              -- Flying evasion, Invulnerability, and the
 *                              death-save techs all apply to it normally
 *                          Stacks additively with a civ-wide
 *                          double_strike_property_bonus tech effect
 *                          (mirrors siege_property_bonus). No unit has a base
 *                          value yet -- the mechanic is built and ready to be
 *                          granted here or from a tech.
 *   siegePct        extra attack multiplier when attacking a structure/city
 *   flying          true  moves over all terrain, ignoring every terrain
 *                          movement penalty. Any unit can still target a
 *                          Flying one (no full targeting immunity), but a
 *                          non-Ranged hitter (effectiveRange < 2) has a flat
 *                          25% chance to simply miss it outright, dealing no
 *                          damage -- checked per-hit (see combat.js's
 *                          resolveRound/FLYING_EVASION_MISS_CHANCE), so this
 *                          applies to a melee defender's counter against a
 *                          Flying attacker just as much as a melee
 *                          attacker's forward hit against a Flying defender.
 *                          A Ranged hitter (effectiveRange >= 2) is
 *                          unaffected either direction. Always-on here for a
 *                          unit type (e.g. Orc's Dragon); can also be
 *                          granted temporarily to a specific unit INSTANCE
 *                          via a "flying" condition (e.g. Human's Flight
 *                          tech) -- see combat.js's isFlying, which checks
 *                          both.
 *   biggerPct       0-1   purely cosmetic render-size boost -- no gameplay
 *                          effect at all (occupies one tile like any other
 *                          unit, hitbox/selection unchanged). The unit's
 *                          sprite is scaled up by this fraction, anchored to
 *                          the same bottom-center point it normally draws
 *                          at, so the extra size grows upward and sideways
 *                          and can spill into neighboring tiles on screen.
 *                          See render.js's "Units" draw loop.
 *   range           tiles  how far away (Chebyshev distance) this unit can
 *                          attack from. Defaults to 1 (melee, adjacent-only)
 *                          when unset -- see combat.js's effectiveRange.
 *                          A Ranged attack (range > 1, actually used against
 *                          a non-adjacent target):
 *                            - needs a clear line to the target -- Mountains
 *                              block it, nothing else does (see ai.js's
 *                              hasRangedLineOfSight)
 *                            - gets NO counterattack back at all (the
 *                              defender isn't adjacent, so it can't reach
 *                              the attacker -- see resolveRound)
 *                            - gets NO siege bonus against a structure/city
 *                              (see attackStructure/cityAttackWinProbability)
 *                              -- EXCEPT a unit with `siegeAtRange: true`
 *                              (Catapult, Trebuchet), which keeps its siege
 *                              bonus regardless of distance
 *                            - never moves the attacker toward the target
 *                              first (see ai.js's targeting loops -- it's
 *                              simply willing to fire from further away, not
 *                              a move-then-attack combo)
 *   rare            true   a "pinnacle" unit meant to feel rare and
 *                          genuinely powerful, never mass-produced -- each
 *                          copy a civ already owns (or has queued) compounds
 *                          the cost AND build time of the next one (see
 *                          ai.js's buildUnitOption/RARE_UNIT_PREMIUM_RATE).
 *                          Currently Human's Paladin, Halfellow's Militia,
 *                          Orc's Dragon. Purely an economic throttle --
 *                          combat stats/mechanics are untouched by this
 *                          flag; a rare unit is still exactly as strong
 *                          per-copy, just steadily more expensive to field
 *                          a second, third, ... copy of.
 *   veryRare        true   one tier above `rare` (mutually exclusive with
 *                          it -- see ai.js's buildUnitOption/
 *                          VERY_RARE_UNIT_PREMIUM_RATE), for a unit meant to
 *                          feel like a once-in-a-game commitment rather than
 *                          a repeatable army anchor. Currently only Dwarf's
 *                          Runeforged Titan.
 *   siegeTarget     true   this unit is treated like a structure/wall for
 *                          incoming damage -- an attacker's Siege property
 *                          (effectiveSiegePct) applies against it exactly as
 *                          it would against a city or wall, cutting through
 *                          its defense the way attackStructure/attackCity do
 *                          (see combat.js's resolveRound, which forces
 *                          isSiege on for the forward hit whenever the
 *                          defender has this flag). Only affects the FORWARD
 *                          attack landing on this unit -- its own counter/
 *                          offense is never treated as a siege attack just
 *                          because it has this flag. Currently only Dwarf's
 *                          Runeforged Titan, paired with a high base defense:
 *                          near-indestructible to an ordinary attacker, but a
 *                          dedicated siege unit cuts through it like a wall.
 *   neverExplores   true   this unit type is excluded from the generic
 *                          curiosity-driven idle "go explore" fallback (see
 *                          ai.js's exploreWith call sites) -- it either has
 *                          its own dedicated AI behavior or should simply
 *                          hold position/garrison instead. Currently only
 *                          Dwarf's Runeforged Titan, which is meant to plod
 *                          deliberately toward an enemy city, not wander off.
 *   nameSpecial     true   this unit is a ship/machine/beast, not a person --
 *                          it gets a thematic proper-noun designation instead
 *                          of a gendered "First Epithet" name, and no gender
 *                          is ever rolled for it (see unit-names.js's
 *                          UNIT_TYPE_PROPER_NAMES and combat.js's
 *                          initUnitHP). Currently Galley, Catapult,
 *                          Trebuchet, Battering Ram, Runeforged Titan, Dragon,
 *                          Raptor, Shadowsteed, Awakened Oak.
 *   cityBuildable   false  opts a unit OUT of every city build-menu scoring
 *                          pass (ai.js's unlockedMilitary filter) even though
 *                          it's `unlock_unit`-registered (for techForUnit/
 *                          unitBuildCost purposes). Defaults to true (every
 *                          other unit) when unset. Currently Elf's Raptor and
 *                          Shadowsteed, which only the Druid can ever produce
 *                          (see ai.js's maybeElfDruidPlay/startDruidSummon).
 *   noUpkeep        true   this unit type costs zero ongoing upkeep, ever --
 *                          see techs.js's unitUpkeep, which short-circuits to
 *                          {0,0,0} before any power/layer-premium math. Not
 *                          to be confused with unit-INSTANCE `startingUnit`
 *                          (a one-time perk on specific civ-creation units)
 *                          or the race-level `noUpkeep` flag (Undead's whole
 *                          army) -- this is a per-unit-TYPE exemption.
 *                          Currently Elf's Raptor and Shadowsteed.
 *

 * Upkeep is NOT stored here -- it's derived, 10% of the unit's raw power
 * (see techs.js's unitUpkeep/unitPower), NOT its build cost.
 * `coinCost` here only matters for a unit whose unlocking tech has no
 * costBreakdown -- see ai.js's buildUnitOption's legacy-flat-coin fallback.
 * As of 2026-08-06 every unit, including Pioneer/Galley/Scout (each via its
 * own Level 0 tech's costBreakdown -- pioneer_infrastructure/
 * distant_shores/distant_horizons), resolves to the modern power-derived
 * multi-resource cost instead, so no unit currently carries a `coinCost`
 * field any more -- the fallback machinery is kept only as a defensive
 * path for a future tech authored without one.
 */


// 🧨 🔨 ⛏ ⚒ 🗡  ⚔ 💣 🏹 🛡 🧹

window.GameData = window.GameData || {};

window.GameData.UNITS = {
  // --- Shared infrastructure (non-combat) ---
  pioneer: {
    id: "pioneer", label: "Pioneer", symbol: "⌂", category: "civilian",
    attack: 0, defense: 2, movement: 2, visionRadius: 3,
    canFoundCity: true, canBuildRoad: true, canImprove: true, canProspect: true,
    // Hard floor on build time (2026-08-06, user-directed) -- see ai.js's
    // unitBuildTurns, which honors this the same way buildingBuildTurns
    // already honors wall_section's. Every Level 0 unit's low base stats put
    // it right at unitPower's rounding floor for every race, so without
    // this it always finished in 1 flat turn no matter what.
    minBuildTurns: 3,
  },
  scout: {
    id: "scout", label: "Tracker", symbol: "⊙", category: "civilian",
    attack: 1, defense: 1, movement: 3, visionRadius: 3, range: 2,
    canExplore: true, canProspect: true, attackChars: ["➵", "➳"],
    minBuildTurns: 3, // see pioneer's own minBuildTurns comment above
  },
  galley: {
    id: "galley", label: "Galley", symbol: "⛵", category: "military",
    attack: 1, defense: 2, movement: 4, visionRadius: 4, range: 1,
    isNaval: true, canCarryUnit: true, biggerPct: .5,
    minBuildTurns: 3, // see pioneer's own minBuildTurns comment above
    // A ship, not a person -- see unit-names.js's UNIT_TYPE_PROPER_NAMES doc.
    nameSpecial: true,
    // Opts out of Boomerang's civ-wide Ranged-2 floor (combat.js
    // effectiveRange), same reasoning as Militia's exemption above: a Galley
    // isn't a scouting/skirmish unit Boomerang is meant to cover (2026-07-21,
    // user-directed).
    exemptFromUniversalRangeGrant: true,
  },

  // --- HUMAN full roster (see tech_tree_design.md) ---
  spearguard: {
    id: "spearguard", label: "Spearguard", symbol: "⚔", category: "military", raceOnly: "human",
    attack: 3, defense: 5, movement: 1, visionRadius: 2, attackChars: ["𐃆"],
    coinCost: 15,
  },
  cavalry: {
    id: "cavalry", label: "Cavalry", symbol: "♞", category: "military", raceOnly: "human",
    attack: 6, defense: 4, movement: 4, visionRadius: 3, firstStrikePct: 0.03,
    coinCost: 22, biggerPct: .2,  attackChars: ["⚔", "🗡"],
  },
  knight: {
    id: "knight", label: "Knight", symbol: "♞", category: "military", raceOnly: "human",
    attack: 8, defense: 7, movement: 5, visionRadius: 3, // replaces Cavalry via the Knighthood tech
    coinCost: 32, firstStrikePct: 0.05, biggerPct: .25, attackChars: ["⚔", "🗡"],
  },
  paladin: {
    id: "paladin", label: "Paladin", symbol: "♞", category: "military", raceOnly: "human",
    attack: 10, defense: 8, movement: 5, visionRadius: 4, firstStrikePct: 0.06, // replaces Knight via the Chivalric Order tech
    coinCost: 42, biggerPct: .4, attackChars: ["⚔", "🗡", "🛡"], rare: true,
  },
  archer: {
    id: "archer", label: "Archer", symbol: "⌖", category: "military", raceOnly: "human",
    attack: 5, defense: 3, movement: 2, visionRadius: 3, range: 2, attackChars: ["➵", "➳"], 
    coinCost: 20, firstStrikePct: 0.01, 
  },
  longbowman: {
    id: "longbowman", label: "Longbowman", symbol: "⌖", category: "military", raceOnly: "human", range: 3, 
    attack: 6, defense: 4, movement: 2, visionRadius: 4,  // replaces Archer via the Longbow tech
    coinCost: 30, attackChars: ["➵", "➳"], firstStrikePct: 0.02,
  },
  catapult: {
    id: "catapult", label: "Catapult", symbol: "⚙", category: "military", raceOnly: "human", range: 2,
    attack: 7, defense: 3, movement: 2, visionRadius: 2, siegePct: 1.50, siegeAtRange: true, attackChars: ["🪨", "☄"],
    coinCost: 28, biggerPct: .5,
    nameSpecial: true, // a machine, not a person -- see unit-names.js
  },
  trebuchet: {
    id: "trebuchet", label: "Trebuchet", symbol: "⚙", category: "military", raceOnly: "human", range: 2,
    attack: 8, defense: 4, movement: 2, visionRadius: 2, siegePct: 2.00, siegeAtRange: true, // replaces Catapult
    coinCost: 40, attackChars: ["🪨", "☄"], biggerPct: .6,
    nameSpecial: true, // a machine, not a person -- see unit-names.js
  },
  wizard: {
    // attack/defense cut 5/5 -> 3/3 (2026-07-17, user-directed, alongside
    // moving the unlocking tech Wizardry to L2 -- see techs.js). Its combat
    // stats were already "deliberately unremarkable" (see ai.js's
    // UTILITY_UNIT_MECHANICS comment) since the real value is the spell kit
    // (Fireball/Teleportation/Freezing Touch/Flight/Dungeon Delve/
    // Invisibility/Invulnerability), not front-line stats -- this leans
    // further into that. The AI build-priority mechanism that ensures
    // Wizards actually get built (ai.js's UTILITY_UNIT_MECHANICS taper,
    // `relevantMechanics.length * 7 * 0.6^owned`) is entirely stat-
    // independent by design, so it needs no change here; verified this
    // still holds live after the cut, not just assumed.
    id: "wizard", label: "Wizard", symbol: "✦", category: "military", raceOnly: "human",
    attack: 3, defense: 3, movement: 2, visionRadius: 3, range: 2,
    coinCost: 35, attackChars: ["⚡", "❄️", "🔥", "☄", "✨"], doubleStrikePct: 0.1,
  },

  // --- ELF full roster (see techs.js) ---
  ranger: {
    id: "ranger", label: "Ranger", symbol: "⌖", category: "military", raceOnly: "elf",
    attack: 4, defense: 3, movement: 2, visionRadius: 4, range: 2, firstStrikePct: 0.05,
    coinCost: 15, attackChars: ["➵", "➳"], doubleStrikePct: 0.1,
  },
  blade_dancer: {
    id: "blade_dancer", label: "Blade Dancer", symbol: "⚔", category: "military", raceOnly: "elf",
    attack: 5, defense: 3, movement: 2, visionRadius: 3, firstStrikePct: 0.09,
    coinCost: 16, attackChars: ["🗡", "⚔"], doubleStrikePct: 0.1,
  },
  // Utility/caster unit, deliberately unremarkable in raw stats (same
  // convention as Human's Wizard, which this mirrors exactly -- its real
  // value is the spell/summon kit: Nature's Grace, Roots of the World,
  // Air Beneath Eyes Above's Raptor summon, Shadowsteed's Shadowsteed
  // summon -- see ai.js's UTILITY_UNIT_MECHANICS and maybeElfDruidPlay).
  druid: {
    id: "druid", label: "Druid", symbol: "✦", category: "military", raceOnly: "elf",
    attack: 3, defense: 3, movement: 2, visionRadius: 3, range: 2, siegePct: 0.1,
    canFoundCity: true, // additional settler option alongside the shared Pioneer -- see elf_druidism
    coinCost: 30, attackChars: ["🍃", "✨", "🌙"],
  },
  // Druid-summoned only (see elf_air_beneath_eyes_above/ai.js's
  // startDruidSummon) -- `cityBuildable: false` strips it back out of every
  // city build-menu scoring pass (ai.js's unlockedMilitary filter) even
  // though it's registered via unlock_unit for cost-lookup purposes. Explicit
  // stats from the tech's own wording -- deliberately fragile (1 HP): a pure
  // scout, not a fighter, so `neverExplores` is NOT set here (exploring IS
  // its job).
  raptor: {
    id: "raptor", label: "Raptor", symbol: "◈", category: "military", raceOnly: "elf",
    attack: 1, defense: 0, movement: 5, visionRadius: 7, flying: true, firstStrikePct: 0.02,
    coinCost: 20, attackChars: ["🦅"], biggerPct: -0.1, rare: true,
    // noUpkeep (2026-07-18, user-directed): a Druid-summoned support unit,
    // not a standing-army one -- see techs.js's unitUpkeep.
    cityBuildable: false, noUpkeep: true, nameSpecial: true, // a beast, not a person -- see unit-names.js
  },
  // Druid-summoned only, same convention as Raptor above. Weak alone by
  // design (Atk1/Def1) -- its real combat value only comes from carrying a
  // rider, whose stats it borrows -- see combat.js's shadowsteed-specific
  // branch in effectiveAttack/effectiveDefense/effectiveRange/effectiveSiegePct/
  // effectiveFirstStrikePct, and ai.js's operateShadowsteedCarry.
  shadowsteed: {
    id: "shadowsteed", label: "Shadowsteed", symbol: "♞", category: "military", raceOnly: "elf",
    attack: 1, defense: 2, movement: 6, visionRadius: 4, flying: true, canCarryUnit: true, firstStrikePct: 0.05,
    coinCost: 40, attackChars: ["ʊ"], biggerPct: 0.2, rare: true,
    // noUpkeep (2026-07-18, user-directed): a Druid-summoned support unit,
    // not a standing-army one -- see techs.js's unitUpkeep.
    // neverExplores (2026-07-19, user-directed): "they exist to find a
    // rider, then fight" -- excluded from the generic curiosity-driven
    // explore fallback (see ai.js's exploreWith call sites) the same way
    // Dwarf's Runeforged Titan is. Its own dedicated dispatch branch
    // (ai.js's "Shadowsteed first priority" block) never calls exploreWith
    // either, so this covers a MOUNTED Shadowsteed that falls through to
    // the ordinary cascade too.
    cityBuildable: false, noUpkeep: true, neverExplores: true, nameSpecial: true, // a construct, not a person -- see unit-names.js
  },
  // Pinnacle unit, but a deliberately different shape from Dwarf's
  // Runeforged Titan (see project_titan_very_rare / techs.js
  // elf_the_living_forest): `rare` (not `veryRare`) and no `siegeTarget` --
  // the elves' own siege unit is meant to be fielded in numbers ("a forest
  // of siege units marching"), not a singular, wall-tough city-crusher like
  // the Titan.
  awakened_oak: {
    id: "awakened_oak", label: "Awakened Oak", symbol: "♣", category: "military", raceOnly: "elf",
    attack: 11, defense: 11, movement: 3, visionRadius: 3, siegePct: 1.5,
    coinCost: 65, biggerPct: 1.0, attackChars: ["🌳", "💥"],
    rare: true, neverExplores: true,
    nameSpecial: true, // a living tree, not a person -- see unit-names.js
  },

  skeleton: {
    id: "skeleton", label: "Skeleton", symbol: "⚔", category: "military",
    attack: 6, defense: 7, movement: 2, visionRadius: 3, raceOnly: "undead",
    coinCost: 15,
  },
  // --- HALFELLOW full roster (see techs.js) ---
  wanderer: {
    id: "wanderer", label: "Wanderer", symbol: "⚔", category: "military", raceOnly: "halfellow",
    attack: 2, defense: 4, movement: 2, visionRadius: 3,
    canFoundCity: true, // additional settler option alongside the shared Pioneer -- see halfellow_arms
    coinCost: 15, attackChars: ["🥄", "🪃", "🔪", "🗡", "🎣"],
  },
  pony_patrol: {
    id: "pony_patrol", label: "Pony Patrol", symbol: "♞", category: "military", raceOnly: "halfellow",
    attack: 4, defense: 6, movement: 4, visionRadius: 3, firstStrikePct: 0.02,
    coinCost: 20, biggerPct: .2
  },
  militia: {
    id: "militia", label: "Militia", symbol: "⚔", category: "military", raceOnly: "halfellow",
    attack: 5, defense: 7, movement: 2, visionRadius: 4, siegePct: .3,
    coinCost: 22, attackChars: ["🔪", "🔱"], biggerPct: .2, rare: true, nameSpecial: true,
    // Opts out of Boomerang's civ-wide Ranged-2 floor (combat.js effectiveRange)
    // -- see the 2026-07-14 comment there. Militia is Halfellow's numerically
    // dominant standing-army unit; exempting it keeps Boomerang's risk-free
    // ranged combat scoped to the race's early/scouting units instead of the
    // whole army.
    exemptFromUniversalRangeGrant: true,
  },
  // Deliberately unremarkable combat stats, same "the real value is the
  // kit, not front-line stats" philosophy as Human's Wizard -- see
  // ai.js's UTILITY_UNIT_MECHANICS. Resource Heist and Unlock the Gate are
  // built into the unit itself (see "Making Trouble" in techs.js); Riddle
  // needs its own further tech ("The Riddle Game"). range:2 so Riddle
  // works at range independent of whether Boomerang is researched yet.
  trouble_maker: {
    id: "trouble_maker", label: "Trouble Maker", symbol: "?", category: "military", raceOnly: "halfellow",
    attack: 3, defense: 3, movement: 3, visionRadius: 3, range: 2,
    coinCost: 32, attackChars: ["🪤", "🔓"], doubleStrikePct: 0.1,
  },

  // --- DWARF full roster (redesigned tree, no stubs -- see techs.js) ---
  foehammer: {
    id: "foehammer", label: "FoeHammer", symbol: "⚔", category: "military", raceOnly: "dwarf",
    attack: 4, defense: 4, movement: 2, visionRadius: 2, attackChars: ["⛏", "🔨"],
    coinCost: 15,
  },
  troubadour: {
    id: "troubadour", label: "Metal Singer", symbol: "♪", category: "military", raceOnly: "dwarf",
    attack: 3, defense: 3, movement: 2, visionRadius: 3, range: 2,
    coinCost: 20, attackChars: ["🎸", "🤘", "🎶", "🎵", "🥁"],
  },
  musketeer: {
    id: "musketeer", label: "Musketeer", symbol: "⌐", category: "military", raceOnly: "dwarf",
    attack: 5, defense: 3, movement: 2, visionRadius: 3, range: 2,
    coinCost: 22, attackChars: ["💥", "●"],
  },
  // Pinnacle unit -- a slow, near-indestructible city-crusher rather than a
  // fast/flying flagship. 2026-07-15 redesign (replacing an earlier
  // damageReductionUnlessSiege flat-halving mechanic): defense raised to a
  // wall-tier 32 (vs. the next-highest unit defense in the game, 12) AND
  // `siegeTarget: true` (see the property doc above, combat.js's
  // resolveRound) makes it take damage exactly like a structure would --
  // an ordinary attacker's raw attack rarely dents it, but any unit with the
  // Siege property (Catapult, Trebuchet, Battering Ram, Dragon, Fireball'd
  // Wizard, ...) cuts through it the same way it cuts through a wall.
  // `veryRare` (2026-07-15, one tier above ordinary `rare`, e.g. Orc's
  // Dragon -- see ai.js buildUnitOption's VERY_RARE_UNIT_PREMIUM_RATE):
  // users observed Dwarf civs fielding multiple Titans, undermining its
  // intended feel as a once-in-a-game commitment.
  runeforged_titan: {
    id: "runeforged_titan", label: "Runeforged Titan", symbol: "▣", category: "military", raceOnly: "dwarf",
    // defense restored to the wall-tier 32 this unit's own doc comments above
    // describe (2026-07-30, user-directed fix: had regressed to 15 -- barely
    // above the next-highest unit's 11 -- making "near-indestructible to an
    // ordinary attacker" false in practice and causing the Resilient
    // Spirit/Unyielding death-save to fire on hits that were never supposed
    // to be anywhere near lethal against a full-health Titan).
    attack: 10, defense: 32, movement: 2, visionRadius: 2, siegePct: 3.50,
    coinCost: 60, biggerPct: 1.2, attackChars: ["🪨", "💥"],
    veryRare: true, neverExplores: true, siegeTarget: true,
    nameSpecial: true, // a construct, not a person -- see unit-names.js
  },

  // --- ORC full roster (redesigned tree, no stubs -- see techs.js) ---
  // Goblin Miscreant (2026-07-14, user-directed): deliberately the weakest
  // unit in the game -- not a scaled-down fighter, a gap-filler. `cheap:
  // true` gives it 30% off cost/build-time/upkeep on top of what its
  // already-minimal power would naturally cost (see ai.js buildUnitOption's
  // CHEAP_UNIT_DISCOUNT_RATE, mirror image of Dragon's `rare` premium).
  // Meant to be Orc's fallback build when nothing else is affordable or
  // worth building, and its expected deaths feed Honor the Dead's +5-lore-
  // per-death bonus automatically (no special-casing needed -- that tech
  // applies to any Orc unit dying).
  goblin_miscreant: {
    id: "goblin_miscreant", label: "Goblin Miscreant", symbol: "◇", category: "military", raceOnly: "orc",
    attack: 1, defense: 0, movement: 2, visionRadius: 2,
    coinCost: 8, attackChars: ["🔪", "💣", "🗡", "🧨"], biggerPct: -0.2, doubleStrikePct: 0.2,
    cheap: true,
  },
  raider: {
    id: "raider", label: "Raider", symbol: "⚔", category: "military", raceOnly: "orc",
    attack: 3, defense: 1, movement: 2, visionRadius: 2,
    coinCost: 15, attackChars: ["🪓", "🔪", "𓌜"],
  },
  // A beast, not a real fighter -- its value is the "hunt" AI behavior
  // (see ai.js's maybeDireWolfHunt), not raw combat stats. neverExplores +
  // nameSpecial for the same reason every other beast/machine unit gets
  // them (Dragon/Raptor/Shadowsteed/Runeforged Titan/Battering Ram): it has
  // its own dedicated AI job and isn't a person to be gendered/epitheted.
  dire_wolf: {
    id: "dire_wolf", label: "Dire Wolf", symbol: "🐺", category: "military", raceOnly: "orc",
    attack: 2, defense: 1, movement: 3, visionRadius: 3, firstStrikePct: 0.03,
    coinCost: 12, attackChars: ["🐾"],
    neverExplores: true, nameSpecial: true,
  },
  impaler: {
    id: "impaler", label: "Impaler", symbol: "▲", category: "military", raceOnly: "orc",
    attack: 4, defense: 3, movement: 2, visionRadius: 2, attackChars: ["𐃆"],
    coinCost: 18,
  },
  wolf_rider: {
    id: "wolf_rider", label: "Wolf Rider", symbol: "♞", category: "military", raceOnly: "orc",
    attack: 5, defense: 2, movement: 4, visionRadius: 3, firstStrikePct: 0.05, attackChars: ["➵", "➳"],
    coinCost: 20, biggerPct: .2,
  },
  bog_witch: {
    id: "bog_witch", label: "Bog Witch", symbol: "✦", category: "military", raceOnly: "orc",
    attack: 5, defense: 3, movement: 2, visionRadius: 3, range: 2,
    coinCost: 22,
    // Baked directly into the unit rather than a tech effect -- the curse is
    // inherent to the Bog Witch herself, always active the moment you have
    // one (Bog Witch tech only grants unlock_unit). Read by combat.js
    // whenever this unit dies -- applies to whichever unit lands the kill.
    curseOnDeath: { attackMult: 0.5, moveMult: 0.5, duration: 3 },
  },
  battering_ram: {
    id: "battering_ram", label: "Battering Ram", symbol: "⚙", category: "military", raceOnly: "orc",
    attack: 6, defense: 3, movement: 2, visionRadius: 2, siegePct: 1.75,
    coinCost: 30, biggerPct: .5, attackChars: ["💥"],
    nameSpecial: true, // a machine, not a person -- see unit-names.js
  },
  ogre: {
    id: "ogre", label: "Ogre", symbol: "⚔", category: "military", raceOnly: "orc",
    attack: 9, defense: 6, movement: 3, visionRadius: 3, siegePct: 0.50, attackChars: ["🪓", "💥", "🪨"],
    coinCost: 32,  biggerPct: .5, rare: true,
  },
  // Pinnacle unit (2026-07-12): meant to be the single most powerful unit
  // in the game and genuinely feared, not a mid-tier pick that happens to
  // scale well -- attack/defense raised (11/8 -> 14/10) on top of the
  // `rare` flag below, which makes each additional copy a civ owns
  // compound the NEXT one's cost/build time (see ai.js's buildUnitOption).
  // The two changes are deliberately paired: a Dragon should hit harder
  // AND be genuinely rare, not just expensive for its old power level.
  // See project_dragon_rebalance memory.
  dragon: {
    id: "dragon", label: "Dragon", symbol: "D", category: "military", raceOnly: "orc",
    attack: 11, defense: 8, movement: 4, visionRadius: 5, flying: true, range: 2, siegePct: 1.00,
    coinCost: 55, biggerPct: 1.0, attackChars: ["🔥"], rare: true,
    nameSpecial: true, // a beast, not a person -- see unit-names.js
  },
};

window.GameData.UNIT_LIST = Object.keys(window.GameData.UNITS);

window.GameData.getUnit = function (unitId) {
  const unit = window.GameData.UNITS[unitId];
  if (!unit) throw new Error(`[GameData] Unknown unit id: "${unitId}"`);
  return unit;
};

/**
 * Fallback attack-animation glyphs for any unit that doesn't define its own
 * `attackChars` array. Add a per-unit `attackChars: ["...", "..."]` to a unit
 * definition above to give it its own set -- one is picked at random each
 * time that unit attacks (see render.js's drawCombatSlashes).
 */
window.GameData.DEFAULT_ATTACK_CHARS = ["☽"];

window.GameData.getAttackChars = function (unitId) {
  const unit = window.GameData.UNITS[unitId];
  return (unit && unit.attackChars) || window.GameData.DEFAULT_ATTACK_CHARS;
};

window.GameData.unitMaxHP = function (attackStat, defenseStat, unitId) {
  const techLevel = unitId ? window.GameData.unitTechLayer(unitId) : 0;
  return Math.max(1, Math.round(attackStat + (defenseStat || 0) + techLevel));
};
