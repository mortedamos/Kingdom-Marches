/**
 * STORY SCENARIO -- orc/dwarf+elf+halfellow, "The Old Peoples"
 * Each rival has a war with the orcs in its memory: the Mountain Wars, the
 * burned borderwood, the Goose Rout. Grukka's son is writing a different
 * story (B3: Varg and Sigrun's plan for peace, heard by a Wisp). Threads:
 * lovers (shared B5 coup), feud, whisper (shared).
 * Shared defaults: js/data/story/shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/dwarf+elf+halfellow"] = {
  title: "The Old Peoples",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!", m: "gleeful" },
      { s: "grukka", t: "The Dwarves remember the Mountain Wars. The Elves remember the burning groves. The halfellows remember the Goose Rout. Every old people in the Marches has a war with us in its memory.", m: "defiant" },
      { s: "skarra", t: "And Skarra remembers ALL of them! Fondly!", m: "gleeful" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher." },
      { s: "gnash", t: "Gnash remember goose. Gnash remember it EVERY NIGHT.", m: "confused" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount." },
      { s: "varg", t: "Every song about us is about a war, Father. Maybe someone should write a different one.", m: "sad" },
      { s: "skarra", t: "*(stroking her frog)* Oh, Varg. Skarra thinks someone already *is*. Hee hee.", m: "gleeful" },
    ],
    B2: [
      { n: "The eastern ridge, at dawn. Orc and dwarf warriors have clashed in the first skirmish of the war.", req: { firstBlood: "dwarf" },
        alt: { n: "The forest's edge, at dawn. Orc warriors and elf rangers have clashed in the first skirmish of the war.", req: { firstBlood: "elf" },
          alt: "The hedgerows of the Hearthlands, at dawn. Orc raiders and halfellow militia have clashed for the first time since the Goose Rout." } },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood! The ancestors are HUNGRY, little Warchief!", m: "gleeful" },
      { s: "gnash", t: "Gnash love avenging! Avenging is smashing with extra reasons!", m: "happy" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "The ancestors say avenge the fallen, Father. What if I don't want anyone to fall?", m: "sad" },
    ],
    // A different song, overheard.
    B3: [
      { n: "Midnight, in the Underways, the ancient dwarf tunnels beneath the Marches. Varg sits beside a young dwarf with copper braids: Sigrun Stonefast, the Dwarf Thane's daughter. They have a map spread between them." },
      { s: "sigrun", t: "Here's the Hearthlands, here's the Silverwood, here's Karrak, here's your bog. Every border on this map is a war someone remembers.", m: "sad" },
      { s: "varg", t: "So we draw a new map. One where nobody's wall is anyone else's cage.", m: "bashful" },
      { s: "sigrun", t: "My mother would call that treason.", m: "sad" },
      { s: "varg", t: "Mine would call it *soft*. …And then he'd listen. He always listens, in the end.", m: "bashful" },
      { n: "Moss lifts his great grey head and growls at the dark. Behind them in the tunnel, a sickly green light flickers: a Wisp, one of Skarra's bog-spirits. It has heard every word." },
      { fx: { seen: "lovers:meet" } },
      { n: "At the Speaking Stones, Skarra listens to what the Wisp whispers, and laughs until she has to sit down." },
      { s: "skarra", t: "A new MAP! With the Thane's BRAT! Oh, little Warchief. Your boy has just handed Skarra your whole bog.", m: "gleeful" },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "On the table in Grukka's hall lies a map, much folded, drawn in two hands, one dwarvish and one orcish. Every border on it is a road." },
      { s: "grukka", t: "Not a cage. A hearth. …Don't tell anyone I said hearth.", m: "happy" },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure.", m: "happy" },
      { n: "That night Grukka rides north to Karrak, where music thunders through the Thane's Hall. Sigrun is playing her song for Varg out loud, for the first time.", req: { alive: "dwarf" } },
      { s: "brunna", t: "Stay by the door, Warchief.", m: "happy", req: { alive: "dwarf" } },
      { s: "grukka", t: "I'll stay by the door.", m: "happy", req: { alive: "dwarf" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying every other crown in the Marches. The mountains, the forest and the fields are silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { s: "grukka", t: "Every old people who remembered a war with us. All gone. Now there's nobody left to remember us at all.", m: "sad" },
      { s: "varg", t: "We drew a map, Father. Sigrun and I. Every border was a road. …You burned all the places on it.", m: "sad" },
      { n: "Varg turns and rides away on Moss. At the edge of the bog, the great wolf stops beside an Underway door that will never open again, and lies down to wait." },
    ],
    "E-Fallen": [
      { n: "The Dwarves have broken the Orcs. {capital}, the last orc town, is burning.", req: { conqueror: "dwarf" },
        alt: { n: "The Elves have broken the Orcs. {capital}, the last orc town, is burning, and black Shadowsteeds circle through the smoke.", req: { conqueror: "elf" },
          alt: "The halfellows have broken the Orcs. {capital}, the last orc town, is surrounded by hedges that weren't there yesterday." } },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! Every old people at ONCE! Skarra always said so—", m: "angry" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die.", m: "sad" },
      { s: "grukka", t: "Every old people in the Marches, at our door at once. Good. They can all watch me die with my axe in my hand.", m: "defiant" },
      { s: "grukka", t: "Take Moss. Take the map. Ride. Don't look back.", m: "sad" },
      { n: "Varg rides into the bog on his dire wolf, the folded map inside his shirt. No one follows." },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "dwarf" },
        alt: { n: "The Elves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "elf" },
          alt: "The halfellows have won by holding the Marches, but the Bloodmire Clans still stand." } },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "A new cage, drawn by the old peoples. …Boy. That map of yours. Show it to me.", m: "defiant" },
      { s: "varg", t: "Every border's a road, Father.", m: "bashful" },
      { s: "grukka", t: "…Then we build roads. Inside the old cage, and out.", m: "happy" },
    ],
  },
};
