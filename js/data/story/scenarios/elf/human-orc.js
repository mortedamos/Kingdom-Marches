/**
 * STORY SCENARIO -- elf/human+orc, "Between Road and Raid"
 * Westmarch's roads on one side, the Orcs' fires on the other, and the Last
 * Parley's grudge between them. Aelthir must choose which loss he can bear,
 * while Vaelis suggests both. Threads: the bloodline and mercy (his blood
 * is on one side of this war), the witches' feud, the Whispering War.
 * Shared defaults: js/data/story/shared/elf.js. Bible §9.2.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/human+orc"] = {
  title: "Between Road and Raid",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, the last living witness of the Long Accord, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "vaelis", t: "West: Westmarch, the Humans, and their roads. South: the Bloodmire, the Orcs, and their fires. And the Silverwood in between, like a pie between two very hungry guests." },
      { s: "aelthir", t: "They met at a parley last season, the Queen of Westmarch and the Orc Warchief. It ended in blood. Each blames the other." },
      { s: "ysolde", t: "The trees say the ground shook first, Warden. Before any sword was drawn. Nobody asked the trees." },
      { n: "In Westmarch, Queen Maren Ashcroft's brother, the Lord-Paladin Aldric, preaches war on the Orcs from the Cathedral steps. In the Bloodmire, the Orc Warchief Grukka Ironjaw sharpens his axe, remembering the parley." },
      { s: "aldric", t: "The Orcs broke faith at the parley! The Dawn demands justice!" },
      { s: "grukka", t: "The Queen's knight drew first. I kept my word. I *always* keep my word." },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted at the forest's edge, between the human road and the orc bog.", req: { cities: 2 },
        alt: "Elf druids choose where a second grove-town will grow: between the human road and the orc bog." },
      { s: "vaelis", t: "Between the road and the raid. Let them both break their teeth on it." },
      { s: "aelthir", t: "Or let them both see that there is something here worth *not* breaking." },
      { s: "vaelis", t: "Great-uncle. You have met the lesser peoples." },
    ],
    B2: [
      { n: "The forest's edge, at dusk. Elf rangers have clashed with human road-builders and their guards.", req: { firstBlood: "human" },
        alt: "The borderwood, at dawn. Elf rangers have met orc war-bands in the smoke of burning trees." },
      { s: "aelthir", t: "First blood. I had hoped they would fight each other and leave us out of it." },
      { s: "vaelis", t: "They will, great-uncle. With a little *encouragement*. Leave that to me." },
      { s: "ysolde", t: "My son, what are you planning?" },
      { s: "vaelis", t: "A letter, mother. Only a letter." },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. Aelthir stands between two glows on the horizon: the lanterns of the human roads to the west, the orc fires to the south." },
      { s: "aelthir", t: "Roads that cut, fires that burn. I have to choose which loss I can bear, Ysolde." },
      { s: "vaelis", t: "Why choose, great-uncle? Let them both lose. I have arranged it rather well." },
      { s: "aelthir", t: "Because one of them is *my blood*, Vaelis. And the other kept her word at a parley no one believed her about.", req: { seen: "bloodline" },
        alt: "Because both of them were wronged at that parley, Vaelis, and neither of them knows it." },
      { s: "ysolde", t: "The trees say the ground shook first, Warden. Perhaps someone should finally tell them." },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders, between the road and the bog. On the Warden's order, a new clearing has been left at the Marchstone, for a parley." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis." },
      { s: "vaelis", t: "You would give the Silverwood to a woman who talks to *puddles*." },
      { s: "ysolde", t: "And they, my son, have a great deal to say about you." },
      { n: "At the clearing, the Warden sits between the Queen of Westmarch and the Orc Warchief, and tells them both, finally, that the ground shook first.", req: { alive: ["human", "orc"] } },
      { s: "grukka", t: "…I *told* them I kept my word.", req: { alive: ["human", "orc"] } },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying Westmarch and the Orcs. The road and the raid are both gone." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "They ended, great-uncle, as brief things do. Each blaming the other to the last. I barely had to write a word." },
      { s: "aelthir", t: "The ground shook first, Vaelis. Nobody ever told them. Nobody ever will now." },
    ],
    "E-Fallen": [
      { n: "The Silverwood has fallen, and {capital} is lost." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden." },
      { s: "aelthir", t: "Tell them, Ysolde. Whoever comes. Tell them the ground shook first." },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly." },
      { s: "maren", t: "*(in the ruins)* …He taught my grandmother to read. Write that down.", req: { conqueror: "human" } },
      { s: "skarra", t: "*(in the ruins)* The elf-witch's forest, ASH! Ha! HA!", req: { conqueror: "orc" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "Westmarch has won by holding the Marches, but the Silverwood still stands.", req: { winner: "human" },
        alt: "The Orcs have won by holding the Marches, but the Silverwood still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I will witness their Accord. And before anyone signs, I will tell them all what really happened at the parley." },
      { s: "vaelis", t: "You will spoil a perfectly good grudge, great-uncle." },
      { s: "aelthir", t: "Yes, Vaelis. That is the best thing I can do with it." },
    ],
  },
};
