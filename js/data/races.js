/**
 * RACE DATA
 * ---------
 * Pure data only -- no game logic here. Every race-specific number used
 * anywhere in the engine (combat.js, cities.js, ai.js, etc.) should be
 * read FROM this file, never hardcoded inline in logic files.
 *
 * Combat modifiers (defenseMult/forestCombatBonus/etc.) and
 * terrain/feature yield bonuses (tileBonuses/featureBonuses) are NOT
 * defined here -- they are unlocked entirely through the tech tree
 * (see tech_tree_design.md). Races start combat- and yield-neutral;
 * all engine call sites already fall back to neutral defaults (1.0
 * multiplier / no bonus) when a race has no such field set.
 *
 * Values are placeholders pending real playtesting, consistent with the
 * design docs -- see realms_of_influence_race_redesign_v2.md for full
 * rationale behind every number here.
 *
 * FIELD REFERENCE (2026-07-22, user-directed audit of every consumer in
 * the engine) -- every field below is read via `race.xxx ?? <default>` at
 * each call site, so a race that omits a field silently gets that default,
 * never a crash or undefined behavior:
 *
 * THE FIVE "PERSONALITY" TRAITS (0.0-1.0 each) -- the real behavioral
 * core of a race. All five feed `racialWeights()` (ai.js, via a shared
 * `trait()` curve) AND `chooseStrategy()` (strategy.js), which together
 * pick and weight what an idle unit/city does this turn (settle vs. build
 * vs. hunt vs. explore vs. garrison). Default 0.5 wherever read directly.
 *   - militarism: NEVER read directly -- always through
 *     `effectiveMilitarism(civ)` (ai.js), which adds any civ-wide bonus
 *     earned so far (e.g. Halfellow's "every military tech completed"
 *     creep) on top of the race's base value. Drives: garrison-holding
 *     desire (blended with industriousness), the population-scaled army
 *     size cap/target, the wall-per-soldier build gate, offense/defense
 *     score weighting in chooseBuildAction, and the "hold vs. commit" bar
 *     in tactical combat decisions.
 *   - expansionism: Pioneer/Galley build-score weighting (how hard a civ
 *     chases new cities/coastal expansion) in chooseBuildAction and
 *     strategy.js's settle-focus scoring.
 *   - curiosity: research-focus weighting in strategy.js/racialWeights,
 *     PLUS several one-off "will this civ try something risky/new" rolls
 *     elsewhere (Dungeon Delve pursuit, Anti-Titan tactical learning) that
 *     reuse it as a general "how adaptable is this civ" knob rather than
 *     inventing a second trait.
 *   - industriousness: city-build-focus weighting, `raceUnitBuildRate`
 *     (how fast units complete), `advanceCityFill`'s per-turn tile
 *     fill-in rate, and `cities.js`'s influence-per-population multiplier
 *     (`industriousnessInfluenceMult` -- Halfellow's 1.0 ceiling reproduces
 *     the old flat 1.30 multiplier entirely through this one field now).
 *   - aggressiveness: read directly (not "effective") everywhere.
 *     `minAcceptableWinProbability(civ)` = 0.9 - aggressiveness*0.4 --
 *     the actual combat-odds bar a unit needs to clear before attacking.
 *     Also the flat per-turn probability an idle unit proactively hunts/
 *     raids instead of waiting for a fight to come to it.
 *
 * OTHER FIELDS:
 *   - startingTech: the one tech id every civ of this race starts the
 *     game with already completed (see main.js's civ-init, which both
 *     adds it to completedTechs and runs applyTechEffects on it).
 *   - uniqueUnits / uniqueBuildings: NOT read by any engine or data code
 *     anywhere -- purely a human-readable roster list for this file's own
 *     documentation/cross-checking. Safe to edit freely; nothing breaks
 *     if it drifts out of sync with the actual tech tree (though it
 *     shouldn't).
 *   - color / citySymbol / label / identity / id: cosmetic only --
 *     consumed by the UI layer (render.js/sidebar.js) for civ-colored
 *     sprites/borders and display text, never by engine logic.
 *
 * RACE-SPECIFIC ONE-OFFS (currently Undead and Halfellow only -- every
 * other race simply omits these, falling back to the "no bonus" default
 * noted at each call site):
 *   - noUpkeep (Undead): skips per-turn Coin/Harvest upkeep entirely
 *     (turns.js), and swaps in a much higher/steeper army-size cap curve
 *     in ai.js's computeMilitaryCap (since normal economic strain, the
 *     usual brake on army size, never applies to them).
 *   - noHealing / ruinHeal (Undead): combat.js's healUnit -- Undead never
 *     get the normal per-turn field/city heal tick, EXCEPT at full rate
 *     while standing on a Ruin tile.
 *   - healOnKillPct (Undead): ai.js -- on any kill, the attacker heals
 *     this % of its own max HP immediately (checked at every attack-
 *     resolution call site, not just one).
 *   - raiseDeadChance / raiseDeadPowerRatio (Undead): ai.js's
 *     maybeApplyZombie -- chance a defeated enemy unit is transferred to
 *     the Undead civ's control IN PLACE (same unit object, not a new one)
 *     under a persistent "zombie" condition (2026-07-22 rework): stats
 *     scaled to raiseDeadPowerRatio x the original (boosted further by the
 *     Necropolis building), 0% First Strike, level/XP reset and frozen at
 *     level 1 forever after. See combat.js's effectiveAttack/effectiveDefense/
 *     effectiveFirstStrikePct/grantXP for the actual effect implementation.
 *   - ownCityHealingMultiplier / influenceHealMult (Halfellow):
 *     combat.js's healUnit -- a flat multiplier on the heal roll while
 *     resting in this civ's OWN city (replaces the universal 4x default),
 *     further scaled by influenceHealMult while on any tile this civ owns
 *     at all (not just inside a city).
 */

window.GameData = window.GameData || {};

window.GameData.RACES = {
  human: {
    id: "human",
    label: "Human",
    identity: "The Trade Connector",
    color: "#8e44ad",
    citySymbol: "⌂",

    // Aggressiveness: flat value (0.0 - 1.0), used by ai.js threshold formula.
    aggressiveness: 0.5,

    // Personality traits (0.0–1.0) — drive all AI scoring and behavior.
    // See ai.js racialWeights() for how each trait maps to decisions.
    militarism:      0.6, // balanced-leaning-defensive — builds armies when threatened, not as first instinct 
    expansionism:    0.8, // eager settlers; Humans expand aggressively by land and sea
    curiosity:       0.9, // strong research drive; adaptability through tech
    industriousness: 0.7, // solid city development; roads and markets before barracks

    // Starting tech id (must exist in techs.js)
    startingTech: "spears_raised",

    uniqueUnits: ["spearguard", "cavalry", "knight", "archer", "longbowman", "catapult", "trebuchet", "wizard"],
    uniqueBuildings: ["bazaar", "guild_hall", "mage_college", "palace"],
  },

  elf: {
    id: "elf",
    label: "Elf",
    identity: "The Forest/Nature Specialist",
    color: "#3f8f5c",
    citySymbol: "♣",

    // Forest is the elves' racial terrain (movement/harvest/lore/defense, plus
    // a permanent map-wide reveal at L4) -- see techs.js's elf_* civic/
    // military techs, mirroring how Dwarf's Mountain identity works.

    aggressiveness: 0.3, // flat, race-wide -- no longer scales with local terrain

    // Personality traits
    militarism:      0.8, // strong standing armies
    expansionism:    0.4, 
    curiosity:       0.4, 
    industriousness: 0.6, // deeply invested in city development and grove infrastructure

    startingTech: "elf_watching_hunting",

    uniqueUnits: ["ranger", "blade_dancer", "druid", "raptor", "shadowsteed", "awakened_oak"],
    uniqueBuildings: ["treetop_watch", "silverleaf_atelier", "altar_of_ages", "wellspring_grove"],
  },

  dwarf: {
    id: "dwarf",
    label: "Dwarf",
    identity: "The Underground/Highland Specialist",
    color: "#9a7b56",
    citySymbol: "◆",

    // Hills movement + mountain tunneling (was a free default) is now unlocked
    // via the dwarf_stonecunning L1 civic tech -- see techs.js.

    aggressiveness: 0.4, // flat, race-wide -- no longer scales with local terrain

    // Personality traits
    militarism:      0.7, // strong standing armies; every hold must be defended
    expansionism:    0.2, // slow to expand; dwarves deepen what they hold rather than spreading thin
    curiosity:       0.4, // practical research — engineering and stonecraft over abstract lore
    industriousness: 0.9, // maximum city development; forges, walls, and deep roads first

    startingTech: "dwarf_foe_hammer",

    uniqueUnits: ["foehammer", "troubadour", "musketeer", "runeforged_titan"],
    uniqueBuildings: ["deep_forge", "great_hall", "runewall", "deep_gate"],
  },

  orc: {
    id: "orc",
    label: "Orc",
    identity: "The Raider Economy",
    color: "#7a2e2e",
    citySymbol: "✖",

    aggressiveness: 0.9,

    // Personality traits
    militarism:      0.9, // maximum armies; orcs measure status in blades
    expansionism:    0.6, // expand aggressively but not strategically — raid first, settle later
    curiosity:       0.2, // minimal research; cold iron and sharp instinct over scholarship
    industriousness: 0.3, // low city investment; war camps over workshops

    startingTech: "orc_raiders",

    uniqueUnits: ["raider", "impaler", "wolf_rider", "bog_witch", "battering_ram", "ogre", "dragon", "dire_wolf"],
    uniqueBuildings: ["war_camp", "butchery", "dragon_den", "ancestral_dolmen"],
  },

  undead: {
    id: "undead",
    label: "Undead",
    identity: "The Relentless Occupier",
    color: "#5b5470",
    citySymbol: "✝",

    noUpkeep: true,       // units never cost ongoing Coin/Harvest upkeep
    noHealing: true,      // never heals via normal field/city tick — only on ruin tiles or on kill
    ruinHeal: true,       // heals at field rate when standing on a ruin tile
    healOnKillPct: 30,    // restores 30% maxHp when this civ's unit kills an enemy

    // Raise Dead
    raiseDeadChance: 1.0,     // confirmed: always triggers
    raiseDeadPowerRatio: 0.5, // raised unit's stats = 0.5x the defeated unit's

    aggressiveness: 0.9,

    // Personality traits
    militarism:      0.8, // every claimed tile is held; undead do not give ground
    expansionism:    0.4, // slow deliberate expansion — consolidate fully before advancing
    curiosity:       0.1, // dark knowledge is static; undead rarely innovate
    industriousness: 0.2, // moderate city development; barrows and wards before markets

    startingTech: "undead_arms",

    uniqueUnits: ["skeleton"],
    uniqueBuildings: ["barrow", "bone_reliquary", "cursed_obelisk", "necropolis"],
  },

  halfellow: {
    id: "halfellow",
    label: "Halfellow",
    identity: "The Homesteader",
    color: "#c9a857",
    citySymbol: "♥",

    // Influence-per-population is no longer a flat per-race field here --
    // it's derived from industriousness alone (see cities.js
    // industriousnessInfluenceMult). Halfellow's industriousness of 1.0
    // (the max any race has) already reproduces the old 1.30 ceiling.

    // Healing: bonus in own territory and cities
    ownCityHealingMultiplier: 6, // 6x(3d6)% instead of universal 4x(3d6)%
    influenceHealMult: 1.25,     // +25% heal rate when on any tile owned by this civ

    aggressiveness: 0.1,

    // Personality traits
    militarism:      0.2, // minimal standing armies; halfellows rely on community, not soldiers
    expansionism:    0.3, // 
    curiosity:       0.6, // strong research; halfellows value hearth-wisdom and practical craft
    industriousness: 0.8, // maximum city investment; halls, hearths, and gardens before walls

    startingTech: "halfellow_arms",

    uniqueUnits: ["wanderer", "pony_patrol", "militia", "trouble_maker"],
    uniqueBuildings: ["farmers_market", "neighborhood_pub", "historical_society", "armory"],
  },
};

window.GameData.RACE_LIST = Object.keys(window.GameData.RACES);

/** Helper: get race data by id, throws loudly if unknown (fail fast, not silently undefined) */
window.GameData.getRace = function (raceId) {
  const race = window.GameData.RACES[raceId];
  if (!race) {
    throw new Error(`[GameData] Unknown race id: "${raceId}"`);
  }
  return race;
};
