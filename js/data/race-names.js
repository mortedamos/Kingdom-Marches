/**
 * RACE CITY-NAME DATA
 * -------------------
 * Pure data: curated city name lists per race, used by engine/cities.js
 * for naming. See realms_of_influence_city_naming_addendum.md for the
 * mechanic this data feeds (AI auto-assigns in order; list exhaustion
 * cycles back with " II", " III", etc.).
 *
 * A realm's own name (story.js's REALMS: Westmarch, the Silverwood, Karrak,
 * the Bloodmire, the Hearthlands) must never appear as a city name in that
 * realm's list (user rule, 2026-10-03) -- the story calls the whole kingdom
 * by that name, so a town of the same name inside it reads as a mistake.
 */

window.GameData = window.GameData || {};

window.GameData.CITY_NAMES = {
  human: [
    "Rivermeet", "Kingsford", "Ashbrook", "Thornwell", "Millhaven",
    "Stonebridge", "Fairhollow", "Oakstead", "Larkspur", "Brightwater",
    "Hallowmere", "Eastgate", "Wheaton", "Crossford", "Dunmoor",
    "Greyfen", "Harrow's End", "Long Acre", "Allstone", "Drachenhorn", 
  ],
  elf: [
    "Sylvaneth", "Thalindor", "Aerivel", "Mistleaf", "Eldhollow",
    "Elarion", "Moonglade", "Liriel", "Thornveil", "Aelindra",
    "Whisperwood", "Caelthorn", "Faelyn", "Greenward", "Aurelune",
    "Verdantis", "Niraleth", "Sylmara",
  ],
  dwarf: [
    "Grimgate", "Ironhold", "Deepforge", "Stonereach", "Hammerfall",
    "Boulderhome", "Coalspire", "Underkeep", "Anvilrest", "Granitehall",
    "Emberdeep", "Thrundak", "Hollowpeak", "Stonefast", "Drakenvault",
    "Moltenhearth", "Ridgehollow", "Darrowmine", "Brewhiem",
  ],
  orc: [
    "Gorewatch", "Skullfen", "Bloodfang Camp", "Ironjaw", "Warhost Reach",
    "Grimskar", "Ashmaw", "Direfang", "Bonecrush", "Ragefall",
    "Thornspike", "Skarvok", "Mauler's Rest", "Crimson Stake", "Wargrip",
    "Grimtusk", "Ironscar", "Fangmoor",
  ],
  undead: [
    "Barrowdeep", "Hollowgrave", "Mournhold", "Ashen Rest", "Greyfall",
    "Cinderwake", "Duskbarrow", "Nightmere", "Soulmire", "Wraithfen",
    "Pale Hollow", "Gravemoor", "Sorrowvale", "Bonewatch", "Shroudfen",
    "Quietus", "Ebonrest", "Wither Hold",
  ],
  halfellow: [
    "Hearthmeadow", "Brookside", "Honeyfield", "Clover Hollow", "Sunnybrook",
    "Appleford", "Mossy Dell", "Thistledown", "Berryvale", "Hearthstead",
    "Lazy Hollow", "Greenburrow", "Sweetwater", "Cozy Hollow", "Millbrook",
    "Goldmeadow", "Quietbrook", "Hollyhock",
  ],
};

/**
 * Returns the next unused name for a civ, cycling with " II", " III", etc.
 * once the base list is exhausted. `usedNames` is an array of names this
 * specific civ has already used (tracked in the civ's state object).
 */
window.GameData.getNextCityName = function (raceId, usedNames) {
  const list = window.GameData.CITY_NAMES[raceId];
  if (!list) {
    throw new Error(`[GameData] No city name list for race "${raceId}"`);
  }
  const usedSet = new Set(usedNames);

  // First pass: any unused base name
  for (const name of list) {
    if (!usedSet.has(name)) return name;
  }

  // Exhausted: cycle through appending " II", " III", ...
  let suffix = 2;
  while (suffix < 50) { // sane upper bound, not an infinite loop
    for (const name of list) {
      const candidate = `${name} ${toRoman(suffix)}`;
      if (!usedSet.has(candidate)) return candidate;
    }
    suffix++;
  }
  // Extremely unlikely fallback
  return `${list[0]} (${usedNames.length + 1})`;
};

function toRoman(num) {
  const romans = ["I","II","III","IV","V","VI","VII","VIII","IX","X"];
  return romans[num - 1] || String(num);
}
