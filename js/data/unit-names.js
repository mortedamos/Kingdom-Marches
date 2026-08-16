/**
 * UNIT PERSONAL-NAME DATA
 * -----------------------
 * Pure data: curated first-name + epithet pools per race, used to give
 * every individual unit instance a name (distinct from its unit TYPE
 * label, e.g. "Aldric Ironhand" the Cavalry, not just "Cavalry"). Purely
 * cosmetic/flavor -- no gameplay effect. See js/engine/combat.js's
 * initUnitHP for where this gets stamped onto a unit at creation (a unit
 * later turned into an Undead zombie via ai.js's maybeApplyZombie keeps its
 * original name -- it's the same unit, just reanimated), and js/ui/sidebar.js
 * for where it's displayed.
 *
 * Mirrors race-names.js's CITY_NAMES pattern (curated per-race lists +
 * a picker function) but deliberately does NOT track/dedupe used names
 * the way city names do -- a game can spawn far more units than cities
 * over its lifetime (including disposable ones), so exact-uniqueness
 * bookkeeping isn't worth it; repeats are acceptable and even a little
 * charming (real armies have plenty of soldiers who share a first name).
 *
 * Two epithet pools per race (not one flat list) so a unit's TYPE, not
 * just its civ, shapes the name: `military` for combat units, `civilian`
 * for Pioneer/Scout/Galley-category units (see units.js's `category`
 * field) -- the one coarse type distinction the data model already has
 * cleanly. Format is always "First Epithet" (e.g. "Aldric the Bold",
 * "Thrundak Ironfist") -- epithets are written as either a bare title
 * ("the Bold") or a compound surname ("Ironfist") so both read naturally
 * appended after a first name. Epithets themselves are gender-neutral by
 * design (read fine after either a male or female first name); only the
 * first-name lists are split by gender, below.
 *
 * First names are split male/female because a unit's `gender` (rolled at
 * creation, see combat.js's initUnitHP) also decides which sprite variant
 * renders for it (js/ui/sprites.js's pick()) -- the name has to agree
 * with the portrait, not be picked independently of it.
 */

window.GameData = window.GameData || {};

window.GameData.UNIT_FIRST_NAMES = {
  human: {
    male: ["Aldric", "Marcus", "Edwin", "Roland", "Cedric", "Gareth", "Osric", "Baldwin", "Thomas", "Henry", "Aethelford", "Ashford"],
    female: ["Elena", "Margaret", "Beatrice", "Isolde", "Rosalind", "Agnes", "Eleanor", "Clara", "Adelaide", "Matilda", "Emma", "Elizabeth"],
  },
  elf: {
    male: ["Thalindor", "Aerivel", "Sylvaneth", "Faelyn", "Caelthorn", "Eldrin", "Orindel", "Aelric", "Sylas", "Niraleth", "Mordouin", "Arangil", "Edrehdel", "Elandor"],
    female: ["Liriel", "Aurelune", "Mistleaf", "Sorina", "Vaelith", "Thessaly", "Ysolde", "Nimriel", "Calanthe", "Verdaine", "Suzara", "Sylvara"],
  },
  dwarf: {
    male: ["Thrundak", "Borgrim", "Karrak", "Ottokar", "Bruntag", "Dagnar", "Grubben", "Falkir", "Torvald", "Ulfric", "Amon"],
    female: ["Hilde", "Gudrun", "Astrid", "Freya", "Sigrun", "Ragna", "Brenna", "Ingrid", "Helga", "Kormak", "Mathilda"],
  },
  orc: {
    male: ["Uzgar", "Krull", "Mog", "Gorrath", "Skarn", "Thokk", "Vrag", "Karg", "Mug", "Drogga", "Ollum", "Gorthagg", "Morag"],
    female: ["Nagra", "Grosha", "Vashka", "Ruka", "Zulga", "Brakka", "Skreela", "Ogra", "Yorka", "Fenka", "Murgeh", "Thokka", "Brim"],
  },
  undead: {
    male: ["Mortimer", "Wraithe", "Ashen", "Grimsby", "Malachai", "Bonewick", "Morrow", "Ambrose", "Winter", "Barrowe", "Mortedamos"],
    female: ["Cadaverine", "Sepulchra", "Nightshade", "Cerys", "Ossalind", "Vesper", "Doloria", "Grave", "Elowyn", "Corvina"],
  },
  halfellow: {
    male: ["Tobin", "Bramble", "Pip", "Fennel", "Barley", "Basil", "Wren", "Bramwell", "Nutmeg", "Thistle", "Shawn", "Willow"],
    female: ["Willow", "Clover", "Hazel", "Rosie", "Marigold", "Sorrel", "Poppy", "Daisy", "Honey", "Buttercup", "Blossom", "Marigold"],
  },
};

window.GameData.UNIT_EPITHETS = {
  human: {
    military: [
      "the Bold", "Ironhand", "the Steadfast", "Longstrider", "the Vigilant",
      "Stonewall", "the Relentless", "Swiftblade", "the Unbroken", "Trueshot",
      "the Wary", "Coinguard",
    ],
    civilian: [
      "the Prudent", "Fair-Ledger", "the Thrifty", "Quickfoot", "the Diligent",
      "Roadwise", "the Patient", "Farsight", "the Practical", "Penny-wise",
    ],
  },
  elf: {
    military: [
      "the Keen-Eyed", "Moonblade", "the Unhurried", "Leafwhisper",
      "the Patient Blade", "Starfall", "the Watchful", "Windsong",
      "the Ancient", "Duskrunner",
    ],
    civilian: [
      "the Wandering", "Grovekeeper", "the Quiet", "Farwalker", "the Curious",
      "Mossfoot", "the Serene", "Longsight", "the Idle", "Fern-touched",
    ],
  },
  dwarf: {
    military: [
      "Ironfist", "the Stubborn", "Stonebeard", "Grudgekeeper",
      "the Unmovable", "Deepdelver", "the Blunt", "Anvilheart",
      "the Grumbling", "Hammerhand",
    ],
    civilian: [
      "the Practical", "Coalstained", "the Thorough", "Ledgerhand",
      "the Patient", "Goldcounter", "the Sturdy", "Deeproad", "the Careful",
      "Beardwise",
    ],
  },
  orc: {
    military: [
      "Skullcrusher", "the Loud", "Bonecrunch", "Ironjaw", "the Furious", "SkinFlayer", 
      "Gravelknuckle", "the Untamed", "Ragefist", "the Boastful", "Wargrip",
    ],
    civilian: [
      "the Nosy", "Ratherfast", "the Sneaky", "Quickpockets", "the Wandering",
      "Loot-eye", "the Unbothered", "Trailsniff", "the Restless",
      "Camp-runner",
    ],
  },
  undead: {
    military: [
      "the Unbothered", "Bonegrinder", "the Already-Dead", "Graveworn",
      "the Patient", "Deadweight", "the Silent", "Ashbound", "the Persistent",
      "Rot-hardened",
    ],
    civilian: [
      "the Weary", "Slowfoot", "the Undeterred", "Coldhand", "the Unblinking",
      "Grave-shift", "the Quiet One", "Palewalker", "the Stiff", "Dust-worn",
    ],
  },
  halfellow: {
    military: [
      "the Surprisingly Handy", "Pie-thrower", "the Determined", "Broomswing",
      "the Feisty", "Ladlefist", "the Unlikely Hero", "Stew-hardened",
      "the Brave", "Garden-tough",
    ],
    civilian: [
      "the Homely", "Breadbaker", "the Cheerful", "Gardenhand", "the Kindly",
      "Honeypot", "the Curious", "Meadowfoot", "the Wholesome", "Pantry-wise",
    ],
  },
};

/**
 * Proper-noun designations for `nameSpecial: true` unit types (see units.js's
 * doc comment on that flag) -- ships, siege machines, a construct, a beast.
 * These aren't "people" so they skip the gendered First+Epithet system
 * entirely: no first-name list, no gender roll (combat.js's initUnitHP never
 * sets `unit.gender` for one of these), just a single flat pool of thematic
 * names per unit TYPE (not race, since e.g. Galley is built by every race
 * and a ship name doesn't need per-civ flavor the way a person's name does).
 * getRandomUnitName checks this FIRST, before the race/gender path below.
 */
window.GameData.UNIT_TYPE_PROPER_NAMES = {
  galley: [
    "The Saltwake", "Windrunner", "Tideclaw", "The Grey Gull", "Farreach", 
    "Stormwake", "The Long Crossing",
  ],
  catapult: [
    "Old Thunderer", "The Widowmaker", "Skybreaker", "Groundshaker",
    "The Equalizer", "Long Reach", "Stonecaster", "The Persuader",
  ],
  trebuchet: [
    "The Reckoning", "Wallbreaker", "The Last Word", "Siege Queen",
    "The Convincer", "Doomsayer", "The Mountain's Fist",
  ],
  battering_ram: [
    "Skullknocker", "The Door Opener", "Gate-Biter", "Bone Splitter",
    "The Introduction", "Polite Society", "Knock-Knock", 
  ],
  runeforged_titan: [
    "Grudge-Bearer", "The Iron Oath", "Stonewrath", "The Unforgiving Hammer",
    "Deepforge's Vengeance", "The Last Anvil", "Oathkeeper", "Rock and a Hard Place", 
  ],
  dragon: [
    "Emberclaw", "Ashwing", "Voidmaw", "Scaleterror", "The Sky Tyrant",
    "Cinderjaw", "Doomscale", "Dacorax", "Korganadraxis"
  ],
  militia: [
	"Willowshire Wardens", "Concerned Citizens Brigade", "Mossmeadow Sentinels", "Greenhill Rangers", "Applefoot Watch", "Merry Meadow Militia", "Dapplethorn Defenders", 
	"Angry Applemeadow Association", "Greenburrow Defenders", "Quietbrook Shouters", "Barrowdeep Busy-Bodies"
  ],
  raptor: [
    "Skyfeather", "Windtalon", "Duskwing", "Farsight", "Cloudstrider",
    "Nettleclaw", "Highwind", "Swiftshadow", "Swiftwing"
  ],
  shadowsteed: [
    "Nightmane", "Duskgallop", "Umbrastride", "Shadow", "Moonshade",
    "Starless", "Gloomhoof", "Dreadmane", "Voidmane"
  ],
  awakened_oak: [
    "Old Growth", "Rootbreaker", "Elder Bough", "Stormcrown", "Deeproot", "Thornbark", "Moss Heart", "Leafwhisper",
    "The Standing Grove", "Ashwold", "Thornwake", "Earthchewer", "Great Alder", "Rootwarden", "Branchweaver",
  ],
  dire_wolf: [
    "Bloodfang", "Grimjaw", "Nightstalker", "Ashclaw", "Ironhowl", "The Grey Terror",
    "Bonecrusher", "Redmuzzle", "Widowfang", "The Long Howl",
  ],
  wisp: [
    "Marshlight", "Foxfire", "The Drowned Flame", "Bogglow", "Willowisp",
    "The Peat Ember", "Mireflicker", "Fenspark", "The Sunken Candle",
  ],
  // Wandering Monsters (see doc/world_encounters_design.md) -- required,
  // not decorative: getRandomUnitName below throws for any raceId with no
  // UNIT_FIRST_NAMES/UNIT_EPITHETS entry (the "monster" race has neither,
  // deliberately -- see races.js's MONSTER_RACE), and a proper-noun pool
  // here is the ONLY thing that lets it return before ever touching
  // race-keyed data. `nameSpecial: true` alone (units.js) is NOT enough on
  // its own -- it only controls gender, not which naming path is taken.
  boar_sounder: [
    "Tusker", "The Charging Sounder", "Mudback", "Old Gorer", "The Bristling Herd",
  ],
  dire_spider: [
    "The Weaver", "Eightfang", "Shadowsilk", "The Canopy Lurker", "Widowspin",
  ],
  highland_griffin: [
    "Stormwing", "The Crag Talon", "Skyhunter", "The High Watcher", "Windrazor",
  ],
  basilisk: [
    "The Sand Coil", "Duneback", "Old Scaleback", "The Buried Fang", "Sunbasker",
  ],
  marsh_adder: [
    "The Sunken Coil", "Bogvenom", "The Still Water", "Mireslither", "Rootfang",
  ],
  frost_lynx: [
    "Rimefang", "The White Stalker", "Frostpaw", "The Silent Drift", "Icewhisker",
  ],
};

/**
 * Picks a random "First Epithet" name for a new unit instance, or a
 * proper-noun designation for a `nameSpecial` type (see
 * UNIT_TYPE_PROPER_NAMES above) -- checked first, since those units skip the
 * person-name system entirely. `unitTypeId` decides whether the military or
 * civilian epithet pool is used (via that type's `category` in units.js);
 * falls back to military for any unknown type. `gender` ("male"|"female")
 * selects the matching first-name sublist -- callers must pass the SAME
 * gender used to pick the unit's sprite variant (see sprites.js's pick()),
 * so name and portrait agree; falls back to "male" for any unrecognized
 * value (irrelevant for nameSpecial types, which ignore gender). No dedup/
 * tracking -- see file header.
 */
window.GameData.getRandomUnitName = function (raceId, unitTypeId, gender) {
  const properNounPool = window.GameData.UNIT_TYPE_PROPER_NAMES[unitTypeId];
  if (properNounPool) {
    return properNounPool[Math.floor(Math.random() * properNounPool.length)];
  }

  const firstNamesByGender = window.GameData.UNIT_FIRST_NAMES[raceId];
  const epithetPools = window.GameData.UNIT_EPITHETS[raceId];
  if (!firstNamesByGender || !epithetPools) {
    throw new Error(`[GameData] No unit-name data for race "${raceId}"`);
  }
  const genderKey = gender === "female" ? "female" : "male";
  const firstNames = firstNamesByGender[genderKey];
  const unitDef = window.GameData.UNITS[unitTypeId];
  const category = unitDef && unitDef.category === "civilian" ? "civilian" : "military";
  const epithets = epithetPools[category];
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const epithet = epithets[Math.floor(Math.random() * epithets.length)];
  return `${first} ${epithet}`;
};
