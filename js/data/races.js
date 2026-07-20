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
    militarism:      0.65, // balanced-leaning-defensive — builds armies when threatened, not as first instinct 
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
    industriousness: 0.9, // deeply invested in city development and grove infrastructure

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
    expansionism:    0.4, // slow to expand; dwarves deepen what they hold rather than spreading thin
    curiosity:       0.6, // practical research — engineering and stonecraft over abstract lore
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

    aggressiveness: 0.6,

    // Personality traits
    militarism:      0.8, // every claimed tile is held; undead do not give ground
    expansionism:    0.4, // slow deliberate expansion — consolidate fully before advancing
    curiosity:       0.3, // dark knowledge is static; undead rarely innovate
    industriousness: 0.5, // moderate city development; barrows and wards before markets

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
    expansionism:    0.5, // 
    curiosity:       0.8, // strong research; halfellows value hearth-wisdom and practical craft
    industriousness: 1.0, // maximum city investment; halls, hearths, and gardens before walls

    startingTech: "halfellow_arms",

    uniqueUnits: ["wanderer", "pony_patrol", "militia"],
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
