/**
 * STORY SCENARIO -- orc/dwarf+elf, "The Old Hoarders"
 * Forest and mountain: the two peoples who got the best land in the Accord.
 * Grukka's cause is at its clearest, and his son's secret at its most
 * dangerous: Vaelis learns of it too (B3), and would happily use it.
 * Threads: lovers (shared B5 coup), feud (shared), whisper (shared).
 * Shared defaults: js/data/story/shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/dwarf+elf"] = {
  title: "The Old Hoarders",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!", m: "gleeful" },
      { s: "grukka", t: "A thousand years ago, the Accord gave the Dwarves the mountains and the Elves the forest. The two old hoarders. And it gave us the bog.", m: "angry" },
      { s: "grukka", t: "That stone was a cage, sister. Cage bars break.", m: "defiant" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher, grinning over a cleaver the size of a door." },
      { s: "gnash", t: "Mountain AND forest? Gnash smash rocks AND trees! Gnash pick… both!", m: "happy" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount. He looks north, toward the mountains, a moment too long." },
      { n: "In Karrak, the Dwarves' Loremaster Oskar Grimgate opens Volume Seven of the Book of Grudges. In the Silverwood, Lord Vaelis Nightbloom, heir to the Elves' Warden, reads the news without interest." },
      { s: "oskar", t: "Volume Seven. The Orc volume. The only one we never closed.", m: "grudging" },
      { s: "vaelis", t: "The orcs are coming. Like weather. Tell the mud-folk. Perhaps the weather will fall on *them* first.", m: "aloof" },
    ],
    B2: [
      { n: "The eastern ridge, at dawn. Orc and dwarf warriors have clashed in the first skirmish of the war.", req: { firstBlood: "dwarf" },
        alt: "The forest's edge, at dawn. Orc warriors and elf rangers have clashed in the first skirmish of the war." },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood! The ancestors are HUNGRY, little Warchief! Avenge them! AVENGE THEM!", m: "gleeful" },
      { s: "gnash", t: "Gnash love avenging! Avenging is smashing with extra reasons!", m: "happy" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "The ancestors say avenge the fallen, Father. What if I don't want anyone to fall?", m: "sad" },
    ],
    // Vaelis learns the secret, and would use it.
    B3: [
      { n: "The orc war council in {capital}, around a roaring fire pit. A letter has arrived, sealed in silver wax with a pattern of leaves. Nobody in the Clans has ever received a letter from the Silverwood before." },
      { s: "grukka", t: "*(handing it to Varg)* You read, boy. Read it.", m: "angry" },
      { s: "varg", t: "*(reading, slowly going grey)* “Warchief. My rangers have seen your son at an old dwarf door, in the company of the Thane's daughter. I thought you would wish to know. Or perhaps the Thane would. I have not yet decided whom to tell first.”", m: "sad" },
      { n: "The fire pit crackles. Grukka looks at his son. Varg does not look away." },
      { s: "grukka", t: "…Is it true?", m: "angry", req: { notSeen: "B5" } },
      { s: "varg", t: "Her name is Sigrun, Father. And that elf is trying to break both of us with one letter.", m: "angry" },
      { s: "skarra", t: "*(delighted)* Oh, the tree-lord is CLEVER! Skarra could KISS him! …Skarra won't. He's very tall. But Skarra *could*.", m: "gleeful" },
      { s: "grukka", t: "Burn the letter. Nobody speaks of this. *Nobody*, Skarra.", m: "angry" },
      { n: "Skarra strokes her frog, and smiles, and says nothing at all. It is the most dangerous thing she has done all war." },
      { fx: { seen: "lovers:meet" } },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands, and the two old hoarders have had to share." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "Not a cage. A hearth.", m: "happy" },
      { s: "grukka", t: "…Don't tell anyone I said hearth.", m: "defiant" },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure.", m: "happy" },
      { n: "That night Grukka rides north to Karrak, where music thunders through the Thane's Hall. Sigrun is playing her song for Varg out loud, for the first time.", req: { alive: "dwarf" } },
      { s: "brunna", t: "Stay by the door, Warchief.", m: "happy", req: { alive: "dwarf" } },
      { s: "grukka", t: "I'll stay by the door.", m: "happy", req: { alive: "dwarf" } },
      { s: "vaelis", t: "*(in the Silverwood, on hearing)* I held the letter that could have ended them both. I waited too long. How *very* unlike me.", m: "sad", req: { alive: "elf" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying the Dwarves and the Elves. The mountains and the forest are silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { n: "Grukka sits atop the split Marchstone as if it were a throne. The stone is cold." },
      { s: "grukka", t: "Both hoarders, gone. Their mountain, their forest, all ours. And not one of us knows how to keep a tree alive.", m: "sad" },
      { s: "varg", t: "You told me to keep talking, Father, so I'll say it. I had someone to keep. You took the whole mountain.", m: "sad" },
      { n: "Varg turns and rides away on Moss. At the edge of the bog, the great wolf stops beside an Underway door that will never open again, and lies down to wait." },
    ],
    "E-Fallen": [
      { n: "The Dwarves have broken the Orcs. {capital}, the last orc town, is burning.", req: { conqueror: "dwarf" },
        alt: "The Elves have broken the Orcs. {capital}, the last orc town, is burning, and black Shadowsteeds circle through the smoke." },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! You lost the bog! Skarra always said so—", m: "angry" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die.", m: "sad" },
      { s: "grukka", t: "The two old hoarders, finally agreeing on something. Then I'll give them a last fight worth the agreement.", m: "defiant" },
      { s: "grukka", t: "Take Moss. Ride, boy. The hoarders will be counting orc heads by morning. Don't let yours be one of them.", m: "sad" },
      { n: "Varg rides into the bog on his dire wolf. No one follows." },
      { s: "oskar", t: "*(in Karrak)* The last entry in Volume Seven: “The Bloodmire Clans. Broken.” …Four hundred years, closed. I thought it would feel like a victory. It feels like losing an enemy I'd grown used to.", m: "grudging", req: { conqueror: "dwarf" } },
      { s: "vaelis", t: "*(in the ashes)* The weather has cleared. The mud-folk will be insufferable about it.", m: "aloof", req: { conqueror: "elf" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "dwarf" },
        alt: "The Elves have won by holding the Marches, but the Bloodmire Clans still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "The old hoarders hold the Marches again. New borders.", m: "defiant" },
      { s: "grukka", t: "The hoarders have their cage back. …This time, we build inside it. Something they'll want to trade with.", m: "defiant" },
      { s: "varg", t: "Father, I'm riding to Karrak.", m: "bashful", req: { alive: "dwarf" }, alt: "Then let's build, Father." },
      { s: "grukka", t: "…Knock loud. And if the elves are watching, knock louder.", m: "happy", req: { alive: "dwarf" } },
    ],
  },
};
