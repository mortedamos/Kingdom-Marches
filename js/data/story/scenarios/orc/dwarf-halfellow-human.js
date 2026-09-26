/**
 * STORY SCENARIO -- orc/dwarf+halfellow+human, "The Builders' Alliance"
 * They can't swear an alliance, but they fight *like* one: stone, hedge and
 * tower. Grukka learns what he's missing -- builders -- and Varg has been
 * learning from a dwarf (B3: he shows him a wall he built). Threads: lovers
 * (shared B5 coup). Shared defaults: js/data/story/shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/dwarf+halfellow+human"] = {
  title: "The Builders' Alliance",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!", m: "gleeful" },
      { s: "grukka", t: "The Dwarves build walls. The halfellows build farms. Westmarch builds towers. Everyone in the Marches builds something, sister. Except us.", m: "sad" },
      { s: "skarra", t: "We build GRUDGES! Big ones! Tall as mountains!", m: "gleeful" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher." },
      { s: "gnash", t: "Gnash build too! Gnash build pile of smashed things! Very tall pile!", m: "happy" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount. His hands are covered in mortar dust. Nobody asks why." },
    ],
    B2: [
      { n: "The eastern ridge, at dawn. Orc and dwarf warriors have clashed in the first skirmish of the war.", req: { firstBlood: "dwarf" },
        alt: { n: "The hedgerows of the Hearthlands, at dawn. Orc raiders and halfellow militia have clashed for the first time since the Goose Rout.", req: { firstBlood: "halfellow" },
          alt: "The river road, at dusk. Orc raiders and human soldiers have clashed over a supply wagon, the first battle of the war." } },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood! The ancestors are HUNGRY, little Warchief!", m: "gleeful" },
      { s: "gnash", t: "Gnash love avenging! Avenging is smashing with extra reasons!", m: "happy" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "They fight like they're on the same side, Father. They can't swear an oath to each other, not with the stone broken. They stand together anyway.", m: "sad" },
    ],
    // Varg's wall.
    B3: [
      { n: "The edge of {capital}, at dusk. Varg has brought his father to see something. It is a wall." },
      { n: "It is not a pile of logs, or a ring of spikes. It is a real wall: dressed stone, mortared, with a gate that swings true." },
      { s: "grukka", t: "…Who built this?", m: "angry" },
      { s: "varg", t: "I did, Father.", m: "bashful" },
      { s: "grukka", t: "Orcs don't build walls, boy. Who *taught* you?", m: "angry" },
      { n: "Varg is quiet for a moment too long." },
      { s: "varg", t: "Someone who builds very good walls.", m: "bashful" },
      { n: "Grukka runs a scarred hand along the stone. It is the finest thing anyone in the Clans has made in a hundred years. It is also, very clearly, dwarvish work." },
      { s: "skarra", t: "*(appearing from nowhere)* A DWARF wall, brother. In OUR bog. Skarra wonders how *that* happened. Hee hee.", m: "gleeful" },
      { s: "grukka", t: "*(not looking away from the wall)* Go away, Skarra. …Build more of these, boy. As many as you can.", m: "defiant" },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "Across the Marches, the orc settlements have become real towns, with walls like the dwarves', hedges like the halfellows', and towers like Westmarch's." },
      { s: "grukka", t: "Not a cage. A hearth. …Don't tell anyone I said hearth.", m: "happy" },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure.", m: "happy" },
      { n: "That night Grukka rides north to Karrak, where music thunders through the Thane's Hall. Sigrun is playing her song for Varg out loud, for the first time.", req: { alive: "dwarf" } },
      { s: "brunna", t: "Stay by the door, Warchief.", m: "happy", req: { alive: "dwarf" } },
      { s: "grukka", t: "I'll stay by the door. …Your daughter builds a good wall, Thane.", m: "happy", req: { alive: "dwarf" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying every other crown in the Marches. The mountains, the fields and the river cities are silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { s: "grukka", t: "All the builders, gone. And we never learned how.", m: "sad" },
      { s: "varg", t: "I did, Father. She taught me. …You took the whole mountain.", m: "sad" },
      { n: "Varg turns and rides away on Moss. At the edge of the bog, the great wolf stops beside an Underway door that will never open again, and lies down to wait." },
    ],
    "E-Fallen": [
      { n: "The Dwarves have broken the Orcs. {capital}, the last orc town, is burning.", req: { conqueror: "dwarf" },
        alt: { n: "The halfellows have broken the Orcs. {capital}, the last orc town, is surrounded by hedges that weren't there yesterday.", req: { conqueror: "halfellow" },
          alt: "Westmarch has broken the Orcs. {capital}, the last orc town, is burning, and the Knights of the Dawn are at its gates." } },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! You lost the bog! Skarra always said so—", m: "angry" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die.", m: "sad" },
      { s: "grukka", t: "I'll die by the boy's wall, sister, with my axe in my hand. It's the best thing in the bog. It should have a guard.", m: "defiant" },
      { s: "grukka", t: "Take Moss and ride. Build your walls somewhere they can't find them. Don't look back.", m: "sad" },
      { n: "Varg rides into the bog on his dire wolf. No one follows. His wall is the last thing in {capital} still standing." },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "dwarf" },
        alt: { n: "The halfellows have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "halfellow" },
          alt: "Westmarch has won by holding the Marches, but the Bloodmire Clans still stand." } },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "A cage again. But a cage is only walls, and the boy knows walls now. …Boy. More of them.", m: "defiant" },
      { s: "varg", t: "Father, I'm riding to Karrak. I need a better trowel.", m: "bashful", req: { alive: "dwarf" }, alt: "As many as I can, Father." },
    ],
  },
};
