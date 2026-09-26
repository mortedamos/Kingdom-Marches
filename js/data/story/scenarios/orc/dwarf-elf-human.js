/**
 * STORY SCENARIO -- orc/dwarf+elf+human, "The Three Fences"
 * Every border that boxed in the bogs: mountain, forest and tower. The purest
 * version of Grukka's grievance, and the hardest test of his love for Varg.
 * B3 override: the three fences on one map. B5 override: Skarra's coup with
 * the lovers' secret AND the Silverwood's forged proof (Vaelis's whisper);
 * Grukka must choose between the grievance and his son. Threads: feud,
 * bloodline, whisper (shared). Shared defaults: shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/dwarf+elf+human"] = {
  title: "The Three Fences",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!", m: "gleeful" },
      { s: "grukka", t: "The Dwarves' mountains to the north. The Elves' forest to the east. Westmarch's mage-towers to the west. Three fences, and the Clans in the middle, for a thousand years.", m: "angry" },
      { s: "grukka", t: "That stone was a fence, sister. Fences break. *All* of them.", m: "defiant" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher." },
      { s: "gnash", t: "Three fences! Gnash count them! One… two… many! MANY fences!", m: "confused" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount. He is looking north." },
      { n: "In the Silverwood, the Elves' Lord Vaelis Nightbloom reads the news, and reaches for his silver wax." },
      { s: "vaelis", t: "The orcs, the mud-folk and the mayflies. Three angry neighbours. I believe I shall write to all of them.", m: "aloof" },
    ],
    B2: [
      { n: "The eastern ridge, at dawn. Orc and dwarf warriors have clashed in the first skirmish of the war.", req: { firstBlood: "dwarf" },
        alt: { n: "The forest's edge, at dawn. Orc warriors and elf rangers have clashed in the first skirmish of the war.", req: { firstBlood: "elf" },
          alt: "The river road, at dusk. Orc raiders and human soldiers have clashed over a supply wagon, the first battle of the war." } },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood! The ancestors are HUNGRY, little Warchief!", m: "gleeful" },
      { s: "gnash", t: "Gnash love avenging! Avenging is smashing with extra reasons!", m: "happy" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "The ancestors say avenge the fallen, Father. What if I don't want anyone to fall?", m: "sad" },
    ],
    // The three fences on one map.
    B3: [
      { n: "The orc war council in {capital}. Grukka has had a map painted on a bull's hide: the bog in the middle, and three coloured lines around it. Bronze, silver and purple." },
      { s: "grukka", t: "Bronze: the Dwarves took the mountains. Silver: the Elves took the forest. Purple: the Humans raised mage-towers at the edge of the reeds. Every line on this hide was drawn *without us*.", m: "angry" },
      { s: "skarra", t: "And Skarra will burn every line off it!", m: "gleeful" },
      { s: "varg", t: "Father. What if one of those lines could be a door instead of a fence?", m: "bashful" },
      { s: "grukka", t: "Which one, boy?" },
      { n: "Varg's eyes go, for a moment, to the bronze line in the north. Only Skarra sees it." },
      { s: "varg", t: "…Any of them.", m: "bashful" },
      { s: "skarra", t: "*(stroking her frog, very softly)* *Any* of them. Of course, Varg. Hee hee.", m: "gleeful" },
    ],
    // Skarra's coup, with the Silverwood's help.
    B5: [
      { n: "Dawn at the Speaking Stones. Every clan of the Bloodmire has been summoned. Skarra stands atop the tallest stone, with Gnash beside her, holding a letter sealed in silver wax." },
      { s: "skarra", t: "Hear me, clans of Bloodmire! A friend in the Silverwood has sent Skarra PROOF! The Warchief's own son crawls through dwarf tunnels to meet the Thane's daughter!", m: "gleeful" },
      { fx: { seen: "lovers:meet" } },
      { n: "A roar of disbelief. Every eye turns to Varg. He doesn't deny it." },
      { s: "varg", t: "Her name is Sigrun.", m: "bashful" },
      { s: "skarra", t: "THREE fences, the Warchief says! And his son wants to open a *door* in one! Is this a Warchief's blood? It is TREASON!", m: "gleeful" },
      { s: "gnash", t: "Why Varg hug little metal lady? Gnash thought he was eating her slowly.", m: "confused" },
      { n: "Grukka looks at the bull-hide map, at the bronze line across the north, and then at his son. A thousand years of grievance on one side. His boy on the other." },
      { s: "grukka", t: "The Elves sent you this, Skarra. The same Elves who drew the silver line. They want the Clans at each other's throats. And you *helped* them.", m: "angry" },
      { s: "skarra", t: "Skarra would help ANYONE!", m: "gleeful" },
      { s: "grukka", t: "I've hated those three lines my whole life. I hate them more than I love anything. …Except him.", m: "sad" },
      { s: "grukka", t: "Get out of my bog, Skarra. Take your frog. And your *friend's* letter.", m: "angry" },
      { s: "gnash", t: "Gnash stay. Witch never has snacks.", m: "confused" },
      { n: "Skarra flees into the mist, shrieking. Destiny the frog hops the other way." },
      { s: "skarra", t: "This isn't over! The bog remembers! Destiny remembers! …Destiny! Come BACK, you ungrateful FROG!", m: "angry" },
      { s: "vaelis", t: "*(in the Silverwood, on hearing)* She chose the boy over the grievance. …I did not think orcs *could*.", m: "aloof", req: { alive: "elf" } },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "In Grukka's hall, the bull-hide map hangs on the wall. Someone has painted a door in the bronze line." },
      { s: "grukka", t: "Not a fence. A hearth. …Don't tell anyone I said hearth.", m: "happy" },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure.", m: "happy" },
      { n: "That night Grukka rides north to Karrak, where music thunders through the Thane's Hall. Sigrun is playing her song for Varg out loud, for the first time.", req: { alive: "dwarf" } },
      { s: "brunna", t: "Stay by the door, Warchief.", m: "happy", req: { alive: "dwarf" } },
      { s: "grukka", t: "I'll stay by the door. It's a good door.", m: "happy", req: { alive: "dwarf" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying every other crown in the Marches. The mountains, the forest and the river cities are silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { s: "grukka", t: "Three fences. All burned off the map. So what do we keep inside it now?", m: "sad" },
      { s: "varg", t: "You told me to keep talking, Father, so I'll say it. I wanted a door. You burned the whole wall, and everyone behind it.", m: "sad" },
      { n: "Varg turns and rides away on Moss. At the edge of the bog, the great wolf stops beside an Underway door that will never open again, and lies down to wait." },
    ],
    "E-Fallen": [
      { n: "The Dwarves have broken the Orcs. {capital}, the last orc town, is burning.", req: { conqueror: "dwarf" },
        alt: { n: "The Elves have broken the Orcs. {capital}, the last orc town, is burning, and black Shadowsteeds circle through the smoke.", req: { conqueror: "elf" },
          alt: "Westmarch has broken the Orcs. {capital}, the last orc town, is burning, and the Knights of the Dawn are at its gates." } },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! All three fences came for us at ONCE! Skarra always said so—", m: "angry" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die.", m: "sad" },
      { s: "grukka", t: "I'll die with my axe in my hand, sister. Like I always said.", m: "defiant" },
      { s: "grukka", t: "Take Moss. Ride north. Knock loud.", m: "sad" },
      { n: "Varg rides north on his dire wolf. No one follows." },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "dwarf" },
        alt: { n: "The Elves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "elf" },
          alt: "Westmarch has won by holding the Marches, but the Bloodmire Clans still stand." } },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "New fence. Same bog. …This time, we build inside it. And we put a door in it.", m: "defiant" },
      { s: "varg", t: "Father, I'm riding to Karrak.", m: "bashful", req: { alive: "dwarf" }, alt: "Then let's build, Father." },
      { s: "grukka", t: "…Knock loud. Dwarves are deaf from all that singing.", m: "happy", req: { alive: "dwarf" } },
    ],
  },
};
