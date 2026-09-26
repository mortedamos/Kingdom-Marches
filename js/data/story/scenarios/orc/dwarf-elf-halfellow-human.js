/**
 * STORY SCENARIO -- orc/dwarf+elf+halfellow+human, "Break the Fence"
 * The canonical orc story: from raider to ruler, and from Warchief to
 * father, with a sister at his back holding a knife. Every crown in the
 * Marches drew a line around the bog. B3: the fences, named. B5: Skarra's
 * coup with the lovers' secret (shared). B6 override: Sigrun comes to the
 * bog herself, and the Thane's daughter teaches the Warchief to build.
 * Threads: lovers, feud, whisper (shared).
 * Shared defaults: js/data/story/shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/dwarf+elf+halfellow+human"] = {
  title: "Break the Fence",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { s: "grukka", t: "Felt that in my teeth. What was it?", m: "angry" },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! The great stone of the Long Accord, SPLIT in two! The ancestors are SCREAMING!", m: "gleeful" },
      { s: "grukka", t: "The Accord. The peace that gave the Elves their forests, the Dwarves their mountains, the Humans their rivers, the halfellows their fields… and us the bog.", m: "angry" },
      { s: "skarra", t: "And the ancestors say more! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!", m: "gleeful" },
      { s: "grukka", t: "That stone was a fence, sister. Every crown in the Marches helped build it. Fences break.", m: "defiant" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher, grinning over a cleaver the size of a door." },
      { s: "gnash", t: "Free! Free to SMASH! Who we smash first, chief?", m: "happy" },
      { s: "grukka", t: "Everyone, Gnash. One at a time.", m: "defiant" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount." },
      { s: "varg", t: "Father, the people I met at the Midsummer Fair… they weren't all like the songs say.", m: "bashful" },
      { s: "grukka", t: "They were *them*, Varg.", m: "angry" },
      { n: "Skarra's green eyes narrow at her nephew." },
      { s: "skarra", t: "Yes, Varg. They were *them*. Hee hee.", m: "gleeful" },
    ],
    B2: [
      { n: "The eastern ridge, at dawn. Orc and dwarf warriors have clashed in the first skirmish of the war.", req: { firstBlood: "dwarf" },
        alt: { n: "The forest's edge, at dawn. Orc warriors and elf rangers have clashed in the first skirmish of the war.", req: { firstBlood: "elf" },
          alt: { n: "The hedgerows of the Hearthlands, at dawn. Orc raiders and halfellow militia have clashed for the first time since the Goose Rout.", req: { firstBlood: "halfellow" },
            alt: "The river road, at dusk. Orc raiders and human soldiers have clashed over a supply wagon, the first battle of the war." } } },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood! The ancestors are HUNGRY, little Warchief! Avenge them! AVENGE THEM!", m: "gleeful" },
      { s: "gnash", t: "Gnash love avenging! Avenging is smashing with extra reasons!", m: "happy" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "grukka", t: "You're quiet, boy. Quiet isn't orc.", m: "angry" },
      { s: "varg", t: "The ancestors say avenge the fallen, Father. What if I don't want anyone to fall?", m: "sad" },
    ],
    // The fences, named.
    B3: [
      { n: "The orc war council in {capital}, around a roaring fire pit. Grukka's captains are boasting of new ground taken, from every direction at once." },
      { s: "grukka", t: "Mountain, forest, field and tower. Four fences. We've broken through all of them this season. So why the long face, boy?", m: "defiant" },
      { s: "varg", t: "Because we take it, Father, and then we move on. The camps empty. The fields rot. If all we do is take, the Clans will scatter the moment we stop winning.", m: "sad" },
      { s: "varg", t: "The Dwarves dig in. The halfellows plant. The Humans pave. Even the Elves grow things. We're the only people in the Marches who've never *kept* anything.", m: "sad" },
      { s: "skarra", t: "Listen to him! Soft as bog-moss! Is this a Warchief's son or a dwarf's pet?", m: "gleeful" },
      { n: "Varg flinches. Skarra smiles, and strokes her frog." },
      { s: "grukka", t: "Enough, Skarra.", m: "angry" },
      { s: "grukka", t: "…Keep talking, boy. I'm listening." },
    ],
    // The Thane's daughter comes to the bog.
    B6: [
      { n: "Evening in {capital}, a week after Skarra's exile. Varg has been busy. Where tents stood there are now timber halls, a stone-lined well, and a smithy." },
      { n: "Working the smithy's bellows, sleeves rolled, copper braids tied back, is a young dwarf. Every orc in {capital} is pretending not to stare." },
      { s: "grukka", t: "…That's the Thane's daughter. In my bog. Shoeing my wolves.", m: "angry" },
      { s: "sigrun", t: "*(not looking up)* Your son's wall was leaning, Warchief. I fixed it. You're welcome.", m: "happy" },
      { s: "varg", t: "Dwarves don't just take a mountain, Father. They dig in and stay. Cellars. Walls. Wells. Things you *keep*. She's been teaching me.", m: "bashful" },
      { s: "grukka", t: "Orcs don't keep, boy. Orcs take.", m: "defiant" },
      { s: "sigrun", t: "Then the next orc will take it from you. Unless you build something worth holding. …Hand me that hammer.", m: "happy" },
      { n: "Grukka looks at the hammer. Then at the dwarf. Then at his son. Then he hands it over." },
      { s: "grukka", t: "Taking is easy. I've done it my whole life. …Show me how you keep it. Both of you.", m: "happy" },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "Across the Marches, the orc settlements have become real towns, with walls, wells, and fields that don't rot. Every fence the Accord drew is a road now." },
      { s: "grukka", t: "Not a fence. A hearth.", m: "happy" },
      { s: "grukka", t: "…Don't tell anyone I said hearth.", m: "defiant" },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure.", m: "happy" },
      { n: "Somewhere deep in the bog, Skarra's distant shriek echoes as she curses destiny from exile. Destiny the frog, sunning on a lily pad, ignores her." },
      { n: "That night Grukka rides north to Karrak, the Dwarf capital, where music thunders through the Thane's Hall. Sigrun is playing her song for Varg out loud, for the first time.", req: { alive: "dwarf" } },
      { n: "Grukka stands in the doorway, alone and unarmed. At the far end of the hall, the Dwarf Thane Brunna rises from her seat.", req: { alive: "dwarf" } },
      { s: "grukka", t: "I heard there was singing.", m: "happy", req: { alive: "dwarf" } },
      { s: "brunna", t: "Stay by the door, Warchief.", m: "happy", req: { alive: "dwarf" } },
      { s: "grukka", t: "I'll stay by the door.", m: "happy", req: { alive: "dwarf" } },
      { n: "Neither parent leaves. Varg sits beside Sigrun, grinning, and Moss howls along with the song.", req: { alive: "dwarf" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying every other crown in the Marches. The mountains, the forest, the fields and the river cities are silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { n: "Grukka sits atop the split Marchstone as if it were a throne. The stone is cold." },
      { s: "grukka", t: "We broke the fence. Every one of them. So what do we keep inside it now?", m: "sad" },
      { n: "Varg stands below. He hasn't spoken to his mother since the mountain fell." },
      { s: "varg", t: "You told me to keep talking, Father, so I'll say it. I had someone to keep. You took the whole mountain.", m: "sad" },
      { s: "grukka", t: "…Boy.", m: "sad" },
      { n: "Varg turns and rides away on Moss. At the edge of the bog, the great wolf stops beside an Underway door that will never open again, and lies down to wait." },
    ],
    "E-Fallen": [
      { n: "The Dwarves have broken the Orcs. {capital}, the last orc town, is burning.", req: { conqueror: "dwarf" },
        alt: { n: "The Elves have broken the Orcs. {capital}, the last orc town, is burning, and black Shadowsteeds circle through the smoke.", req: { conqueror: "elf" },
          alt: { n: "The halfellows have broken the Orcs. {capital}, the last orc town, is surrounded by hedges that weren't there yesterday.", req: { conqueror: "halfellow" },
            alt: "Westmarch has broken the Orcs. {capital}, the last orc town, is burning, and the Knights of the Dawn are at its gates." } } },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! You lost the bog! You lost the Clans! Skarra always said so, Skarra ALWAYS SAID—", m: "angry" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die.", m: "sad" },
      { s: "grukka", t: "I'll die with my axe in my hand, sister. Like I always said.", m: "defiant" },
      { n: "Grukka turns to his son one last time." },
      { s: "grukka", t: "Take Moss. Ride. Don't look back.", m: "sad" },
      { n: "Varg rides into the bog on his dire wolf. No one follows." },
      { s: "oskar", t: "*(in Karrak)* The last entry in Volume Seven of the Book of Grudges: “The Bloodmire Clans. Broken.” …Amend it. “Worthy foe.”", m: "grudging", req: { conqueror: "dwarf" } },
      { s: "vaelis", t: "*(in the ashes)* The weather has cleared. …I find I rather miss it.", m: "sad", req: { conqueror: "elf" } },
      { s: "hobby", t: "*(setting a pie on the Speaking Stones)* For the Warchief. He kept his word. That's rarer than geese.", m: "sad", req: { conqueror: "halfellow" } },
      { s: "maren", t: "*(in the ashes)* Their Warchief went to our parley unarmed.", m: "sad", req: { conqueror: "human" } },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "dwarf" },
        alt: { n: "The Elves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "elf" },
          alt: { n: "The halfellows have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "halfellow" },
            alt: "Westmarch has won by holding the Marches, but the Bloodmire Clans still stand." } } },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "Another crown holds the Marches. They've drawn new borders.", m: "defiant" },
      { s: "grukka", t: "New fence. Same bog.", m: "defiant" },
      { n: "Grukka stares at the new borders for a long time. Then he looks at the timber halls his son built." },
      { s: "grukka", t: "…This time, we build inside it.", m: "defiant" },
      { s: "varg", t: "Father, I'm riding to Karrak.", m: "bashful", req: { alive: "dwarf" }, alt: "Then let's build, Father." },
      { s: "grukka", t: "To fight?", m: "angry", req: { alive: "dwarf" } },
      { s: "varg", t: "To knock.", m: "bashful", req: { alive: "dwarf" } },
      { s: "grukka", t: "…Knock loud. Dwarves are deaf from all that singing.", m: "happy", req: { alive: "dwarf" } },
    ],
  },
};
