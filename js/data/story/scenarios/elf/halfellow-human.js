/**
 * STORY SCENARIO -- elf/halfellow+human, "The Settled Lands"
 * The farmers (Halfellows) and the road-builders (Westmarch) both expand
 * into the wild. The Elves' quiet dread is a *tamed* Marches: no one is
 * cruel, they are just thorough. Vaelis's cold answer is to let the wild
 * take it all back. Threads: the bloodline, mercy, the Whispering War.
 * Shared defaults: js/data/story/shared/elf.js. Bible §9.2.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/halfellow+human"] = {
  title: "The Settled Lands",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, the last living witness of the Long Accord, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "ysolde", t: "The trees are afraid, Warden. Not of fire. Not of axes. Of *fences*." },
      { s: "aelthir", t: "The halfellows of the Hearthlands plant a field wherever there is sun. The Humans of Westmarch lay a road wherever there is a field. Between them, the wild has been shrinking for three hundred years." },
      { s: "vaelis", t: "They will not burn the Marches, great-uncle. They will *tidy* them. Every meadow fenced, every stream bridged, every tree counted. I would rather they burned it." },
      { n: "In the Hearthlands, Mayor Hobby Trickgrin unrolls a map with a hundred new farms on it. In Westmarch, Queen Maren Ashcroft unrolls a map with a hundred new roads connecting them." },
      { s: "hobby", t: "Lovely soil out there, Goldie. Wasted on *trees*." },
      { s: "maren", t: "Roads, law, and a charter. …Write it down." },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted at the forest's edge, where the halfellows' fields meet the humans' roads.", req: { cities: 2 },
        alt: "Elf druids choose where a second grove-town will grow, where the halfellows' fields meet the humans' roads." },
      { s: "ysolde", t: "Let the wild grow here, where they cannot fence it." },
      { s: "vaelis", t: "They will fence *around* it, mother. They always do." },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Elf rangers have clashed with halfellow militia over a new field cut into the trees.", req: { firstBlood: "halfellow" },
        alt: "The forest's edge, at dusk. Elf rangers have clashed with human road-builders and their guards." },
      { s: "aelthir", t: "First blood. And none of them meant any harm. That is the worst of it, Ysolde. They only meant to *plant something*." },
      { s: "vaelis", t: "Good intentions and a plough, great-uncle. The deadliest weapons in the Marches." },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. Aelthir walks the forest's edge with Ysolde. On one side, trees. On the other, neat fields, straight roads and warm windows." },
      { s: "aelthir", t: "It is beautiful, Ysolde. Their way. I did not want it to be." },
      { s: "ysolde", t: "The trees say both can be true. The wild, and the tame. They only need a border that holds." },
      { s: "vaelis", t: "A border that holds. How very *Accord* of you both." },
      { s: "aelthir", t: "Yes, Vaelis. Exactly how very Accord. That was always the point of it." },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders, but not everywhere. Where the fields and the roads were loved, the Warden told the trees to stop." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis." },
      { s: "vaelis", t: "You would give the Silverwood to a woman who talks to *puddles*." },
      { s: "ysolde", t: "And they, my son, have a great deal to say about you." },
      { s: "vaelis", t: "You *stopped* the forest, great-uncle? At their *turnip fields*?" },
      { s: "aelthir", t: "At the ones that were tended well, Vaelis. A border that holds." },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying the Halfellows and Westmarch. The fields are going wild again." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "The Marches are wild again, great-uncle. Untamed. Unfenced. Exactly as you wanted." },
      { s: "aelthir", t: "No, Vaelis. Exactly as *you* wanted. I wanted a border that held. Now there is nothing on the other side of it." },
      { n: "In an overgrown field, Ysolde finds a halfellow scarecrow still standing, its straw hat full of birds. She leaves it where it is." },
    ],
    "E-Fallen": [
      { n: "The Silverwood has fallen. Fields and roads have reached the Heartwood, and {capital} is lost." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden. They would rather not see what comes next." },
      { s: "aelthir", t: "Tell them to leave the Heartwood standing. One tree. In the middle of the fields. So they remember." },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly." },
      { s: "hobby", t: "*(in the ruins)* Nobody touches that big tree, everyone. We'll put a bench under it.", req: { conqueror: "halfellow" } },
      { s: "maren", t: "*(in the ruins)* The Heartwood stays. Write it into the charter.", req: { conqueror: "human" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Halfellows have won by holding the Marches, but the Silverwood still stands.", req: { winner: "halfellow" },
        alt: "Westmarch has won by holding the Marches, but the Silverwood still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "The settled lands hold the Marches. I will witness their Accord. I will ask for one thing: a border that holds." },
      { s: "vaelis", t: "And a fence around the Silverwood, great-uncle, to keep the *turnips* out." },
    ],
  },
};
