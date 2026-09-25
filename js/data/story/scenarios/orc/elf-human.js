/**
 * STORY SCENARIO -- orc/elf+human, "Road and Root"
 * The human roads and the elf forest boxed in the bogs: the story of the
 * fence, from two sides. B3: Grukka stands on the one hill where both
 * borders meet, and sees the fence whole. Threads: feud, bloodline (as
 * outside witness), whisper (shared). Shared defaults: shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/elf+human"] = {
  title: "Road and Root",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!" },
      { s: "grukka", t: "On one side of the bog, the Elves' forest. On the other, Westmarch's roads. Between them, a thousand years, they built our fence." },
      { s: "grukka", t: "And the Queen of Westmarch owes me an apology for the parley. I'll collect it the orc way." },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher." },
      { s: "gnash", t: "Trees AND roads! Gnash smash tree, then walk on road! Efficient!" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount." },
      { s: "varg", t: "Moss hates roads. They go straight. Nothing real goes straight." },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Orc warriors and elf rangers have clashed in the first skirmish of the war.", req: { firstBlood: "elf" },
        alt: "The river road, at dusk. Orc raiders and human soldiers have clashed over a supply wagon, the first battle of the war." },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood! The ancestors are HUNGRY, little Warchief!" },
      { s: "gnash", t: "Gnash love avenging! Avenging is smashing with extra reasons!" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "The ancestors say avenge the fallen, Father. What if I don't want anyone to fall?" },
    ],
    // The fence, seen whole.
    B3: [
      { n: "A lonely hill at the edge of the bog, the only high ground for a day's ride. Grukka has climbed it with his son." },
      { n: "To the north, the silver trees of the Silverwood, a wall of green that never ends. To the west, the straight grey lines of Westmarch's roads, running right up to the reeds." },
      { s: "grukka", t: "Look at it, boy. Root on one side, road on the other. A thousand years, and they never needed a wall. They *were* the wall." },
      { s: "varg", t: "They don't hate us, Father. They just never looked at us." },
      { s: "grukka", t: "That's worse." },
      { n: "Far to the north, in the Silverwood, Lord Vaelis Nightbloom, heir to the Elves' Warden, receives a report of orcs on the hill." },
      { s: "vaelis", t: "Orcs on the hill. Looking at us. How *peculiar*. They have never done that before." },
      { n: "Far to the west, in Westmarch, the Human Queen Maren Ashcroft receives the same report." },
      { s: "maren", t: "The Warchief's looking at our roads. …Write it down. I want to know what he sees." },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "Across the Marches, the orc settlements have become real towns. Their roads bend. Their groves have gates." },
      { s: "grukka", t: "Not a fence. A hearth. …Don't tell anyone I said hearth." },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure." },
      { s: "maren", t: "*(in Westmarch)* The Warchief holds the Marches. …I owe him an apology. Write it down. Then help me write *that*.", req: { alive: "human" } },
      { s: "vaelis", t: "*(in the Silverwood)* The orcs hold the Marches. I shall have to learn the Warchief's name. …How tiresome.", req: { alive: "elf" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying the Silverwood and Westmarch. The forest and the river cities are silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { n: "Grukka climbs the lonely hill again. The trees are ash. The roads are empty. There is no fence at all." },
      { s: "grukka", t: "No fence. No one on the other side of it, either." },
      { s: "varg", t: "Each other, Father. That's all that's left to keep. Try that." },
    ],
    "E-Fallen": [
      { n: "The Elves have broken the Orcs. {capital}, the last orc town, is burning, and black Shadowsteeds circle through the smoke.", req: { conqueror: "elf" },
        alt: "Westmarch has broken the Orcs. {capital}, the last orc town, is burning, and the Knights of the Dawn are at its gates." },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! You lost the bog! Skarra always said so—" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die." },
      { s: "grukka", t: "I'll die with my axe in my hand, sister. Like I always said." },
      { s: "grukka", t: "Take Moss. Ride. Don't look back." },
      { n: "Varg rides into the bog on his dire wolf. No one follows." },
      { s: "vaelis", t: "*(in the ashes)* The weather has cleared. …I find I rather miss it.", req: { conqueror: "elf" } },
      { s: "maren", t: "*(in the ashes)* Their Warchief went to our parley unarmed. …Write it down.", req: { conqueror: "human" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Elves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "elf" },
        alt: "Westmarch has won by holding the Marches, but the Bloodmire Clans still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "Root and road. The old fence, put back up." },
      { s: "grukka", t: "New fence. Same bog. …This time, we build inside it. And we make them *look*." },
    ],
  },
};
