/**
 * STORY SCENARIO -- orc/dwarf+halfellow, "Stone and Hedge"
 * The two peoples who've beaten the clans before: the Dwarves at the great
 * gates, the halfellows at the Goose Rout. Gnash dreads the goose, and Varg
 * dreads his aunt. B3: Gnash nearly stumbles on the lovers. Threads: lovers
 * (shared B5 coup). Shared defaults: js/data/story/shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/dwarf+halfellow"] = {
  title: "Stone and Hedge",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!", m: "gleeful" },
      { s: "grukka", t: "The Dwarves of Karrak to the north. The halfellows of the Hearthlands to the east. The only two peoples who ever sent the Clans home beaten.", m: "defiant" },
      { s: "skarra", t: "The mud-diggers at their gates, and the goose-girl in her HEDGES! Skarra has grudges against BOTH! Skarra is SPOILED for choice!", m: "gleeful" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher." },
      { s: "gnash", t: "Dwarves, Gnash smash. Halfellows… is there goose?", m: "confused" },
      { s: "grukka", t: "Probably, Gnash." },
      { s: "gnash", t: "Gnash do dwarves.", m: "happy" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount. He is watching his aunt very carefully." },
    ],
    B2: [
      { n: "The eastern ridge, at dawn. Orc and dwarf warriors have clashed in the first skirmish of the war.", req: { firstBlood: "dwarf" },
        alt: "The hedgerows of the Hearthlands, at dawn. Orc raiders and halfellow militia have clashed for the first time since the Goose Rout." },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood! The ancestors are HUNGRY, little Warchief!", m: "gleeful" },
      { s: "gnash", t: "Was there goose? …Gnash hear honking. Gnash hear honking in Gnash's *dreams*.", m: "sad" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "The ancestors say avenge the fallen, Father. What if I don't want anyone to fall?", m: "sad" },
    ],
    // Gnash almost discovers the lovers.
    B3: [
      { n: "Midnight, at the edge of the bog. Gnash has been sent to guard the old stone door in the hillside, the one that leads into the Underways, the ancient dwarf tunnels. He is not very good at guarding." },
      { n: "Out of the door comes Varg, on Moss, and behind him a young dwarf with copper braids and an axe that doubles as a guitar." },
      { s: "gnash", t: "Varg! Gnash guarding! …Who is little metal lady?", m: "happy" },
      { s: "varg", t: "…A prisoner, Gnash. I caught her.", m: "bashful" },
      { s: "sigrun", t: "*(very loudly)* Oh no. I have been caught. By an orc. How terrible.", m: "happy" },
      { s: "gnash", t: "Why prisoner hugging Varg?", m: "confused" },
      { s: "varg", t: "It's a dwarf thing. They hug before they're interrogated.", m: "bashful" },
      { n: "Gnash counts on his fingers for a very long time." },
      { s: "gnash", t: "Gnash not understand. Gnash go tell Skarra. Skarra understand everything.", m: "confused" },
      { s: "varg", t: "Gnash! *Wait*. …There's a goose loose in the camp. Near Skarra's hut.", m: "bashful" },
      { n: "Gnash runs the other way, screaming. Sigrun laughs so hard she has to sit down." },
      { s: "sigrun", t: "Is that the one who's *afraid of geese*? I'm going to write a song about him.", m: "happy" },
      { fx: { seen: "lovers:meet" } },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "Across the Marches, the orc settlements have become real towns, with walls like the dwarves', and hedges like the halfellows'." },
      { s: "grukka", t: "Not a cage. A hearth. …Don't tell anyone I said hearth.", m: "happy" },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure.", m: "happy" },
      { n: "That night, in the Thane's Hall of Karrak, Sigrun plays a new song, out loud, for the first time. It is about an ogre who is afraid of geese.", req: { alive: "dwarf" } },
      { s: "gnash", t: "*(in the doorway)* …Song about Gnash? Gnash is FAMOUS!", m: "happy", req: { alive: "dwarf" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying the Dwarves and the halfellows. The mountains and the hedgerows are silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { s: "grukka", t: "The two peoples who beat us. Both gone. And I still don't know how they did it.", m: "sad" },
      { s: "varg", t: "You told me to keep talking, Father, so I'll say it. I had someone to keep. You took the whole mountain.", m: "sad" },
      { n: "Varg turns and rides away on Moss. At the edge of the bog, the great wolf stops beside an Underway door that will never open again, and lies down to wait." },
    ],
    "E-Fallen": [
      { n: "The Dwarves have broken the Orcs. {capital}, the last orc town, is burning.", req: { conqueror: "dwarf" },
        alt: "The halfellows have broken the Orcs. {capital}, the last orc town, is surrounded by hedges that weren't there yesterday." },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! Beaten by the same two AGAIN! Skarra always said so—", m: "angry" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die.", m: "sad" },
      { s: "grukka", t: "The same two who beat us before. Let them have the bog. They'll have to take it off my axe first.", m: "defiant" },
      { s: "grukka", t: "Take Moss. Ride, boy. Find the singer. She's the only one of them who ever looked at you properly.", m: "sad" },
      { n: "Varg rides into the bog on his dire wolf. No one follows." },
      { s: "oskar", t: "*(in Karrak)* The last entry in Volume Seven: “The Bloodmire Clans. Broken.” …Four hundred years of entries, and not one of them was about peace. I should have left a page for that.", m: "grudging", req: { conqueror: "dwarf" } },
      { n: "Somewhere behind the hedges, a goose honks. Gnash screams.", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "dwarf" },
        alt: "The halfellows have won by holding the Marches, but the Bloodmire Clans still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "Walls to the north, hedges to the east. Fine. This time we build our own. Walls like the dwarves. Hedges like the halfellows.", m: "defiant" },
      { s: "varg", t: "Father, I'm riding to Karrak.", m: "bashful", req: { alive: "dwarf" }, alt: "Then let's build, Father." },
      { s: "grukka", t: "…Knock loud. And stop at the halfellows' on the way. They'll know which door to use.", m: "happy", req: { alive: "dwarf" } },
    ],
  },
};
