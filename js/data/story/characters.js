/**
 * STORY CHARACTERS
 * ----------------
 * Pure data: every named speaker in the single-player story system (see
 * doc/story_bible.md §3 for who they are, and js/engine/story.js for how
 * scenes are chosen). Scenario files and the shared line pools refer to
 * speakers only by the keys below.
 *
 *   name      nameplate text (shown in capitals by the UI)
 *   title     italic subtitle beside the name
 *   race      whose gilded border frames them (RACES[race]); null = the
 *             Marchstone, which has its own stone panel
 *   initials  fallback portrait text if an image fails to load
 *   signature this character's fifth, personal mood (see STORY_MOODS_CORE)
 *   portrait  true = mood portraits exist at assets/portraits/<id>_<mood>.jpg
 *             (480x600, 4:5) for every mood in storyMoodsFor(id); false =
 *             no art (the Marchstone draws its own SVG).
 *
 * A dialogue line picks its portrait with `m: "<mood>"` (see js/engine/
 * story.js); an untagged line, or a mood the character doesn't have, shows
 * "neutral".
 */

window.GameData = window.GameData || {};

window.GameData.STORY_CHARACTERS = {
  stone: { name: "The Marchstone", title: "", race: null, initials: "", signature: null, portrait: false },

  // --- Human: Westmarch -------------------------------------------------
  maren:  { name: "Queen Maren Ashcroft", title: "Queen of Westmarch", race: "human", initials: "MA", signature: "resolute", portrait: true },
  aldric: { name: "Lord-Paladin Aldric Ashcroft", title: "Shield of the Dawn", race: "human", initials: "AA", signature: "fervent", portrait: true },
  corvin: { name: "Archmage Corvin Varro", title: "Archmage of the Collegium", race: "human", initials: "CV", signature: "wry", portrait: true },

  // --- Elf: the Silverwood Court ----------------------------------------
  aelthir: { name: "Aelthir Moonveil", title: "Warden of the Silverwood", race: "elf", initials: "AM", signature: "wistful", portrait: true },
  ysolde:  { name: "Ysolde of the Wellspring", title: "Archdruid", race: "elf", initials: "YW", signature: "uncanny", portrait: true },
  vaelis:  { name: "Lord Vaelis Nightbloom", title: "Heir to the Warden's Seat", race: "elf", initials: "VN", signature: "aloof", portrait: true },

  // --- Dwarf: the Holds of Karrak ----------------------------------------
  brunna: { name: "High Thane Brunna Stonefast", title: "High Thane of Karrak", race: "dwarf", initials: "BS", signature: "proud", portrait: true },
  kazra:  { name: "Kazra Emberdeep", title: "Master Runesmith", race: "dwarf", initials: "KE", signature: "focused", portrait: true },
  oskar:  { name: "Loremaster Oskar Grimgate", title: "Keeper of the Book of Grudges", race: "dwarf", initials: "OG", signature: "grudging", portrait: true },
  sigrun: { name: "Sigrun Stonefast", title: "Metal Singer", race: "dwarf", initials: "SS", signature: "fierce", portrait: true },

  // --- Orc: the Bloodmire Clans -------------------------------------------
  grukka: { name: "Warchief Grukka Ironjaw", title: "Warchief of the Bloodmire Clans", race: "orc", initials: "GI", signature: "defiant", portrait: true },
  skarra: { name: "Skarra Ironjaw, the Bog-Mother", title: "Bog Witch of Bloodmire", race: "orc", initials: "SI", signature: "gleeful", portrait: true },
  gnash:  { name: "Gnash", title: "The Butcher of Bloodmire", race: "orc", initials: "G", signature: "confused", portrait: true },
  varg:   { name: "Varg Ironjaw", title: "Wolf Rider", race: "orc", initials: "VI", signature: "bashful", portrait: true },

  // --- Halfellow: the Hearthlands Moot -----------------------------------
  hobby:   { name: "Mayor Hobby Trickgrin", title: "Mayor of the Hearthlands", race: "halfellow", initials: "HT", signature: "scheming", portrait: true },
  goldie:  { name: "Goldie Trickgrin", title: "Keeper of The Goose & Kettle", race: "halfellow", initials: "GT", signature: "stern", portrait: true },
  barnaby: { name: "Professor Barnaby Pickwort", title: "Keeper of the Hearthlands Archive", race: "halfellow", initials: "BP", signature: "flustered", portrait: true },
};

/** Moods every character has a portrait for; each also has one signature
 *  mood of their own (STORY_CHARACTERS[id].signature). */
window.GameData.STORY_MOODS_CORE = ["neutral", "happy", "angry", "sad"];

/** The full mood list for one character ([] for the Marchstone). */
window.GameData.storyMoodsFor = function (id) {
  const ch = (window.GameData.STORY_CHARACTERS || {})[id];
  if (!ch || !ch.portrait) return [];
  return ch.signature ? [...window.GameData.STORY_MOODS_CORE, ch.signature] : [...window.GameData.STORY_MOODS_CORE];
};

/** Each playable race's leader -- used for generic lines (epitaphs, replies)
 *  that need "whoever leads this kingdom". */
window.GameData.STORY_LEADERS = {
  human: "maren", elf: "aelthir", dwarf: "brunna", orc: "grukka", halfellow: "hobby",
};
