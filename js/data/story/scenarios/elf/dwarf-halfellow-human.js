/**
 * STORY SCENARIO -- elf/dwarf+halfellow+human, "The Builders"
 * Every rival builds -- forges, farms, roads -- and only the Elves grow.
 * Aelthir comes to see the new world will be built whatever he does; his
 * choice is who builds it, and whether Vaelis inherits what's left.
 * Threads: the bloodline, mercy, the Whispering War.
 * Shared defaults: js/data/story/shared/elf.js. Bible §9.2.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/dwarf+halfellow+human"] = {
  title: "The Builders",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, the last living witness of the Long Accord, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "vaelis", t: "Three neighbours, great-uncle, and every one of them a *builder*. The mud-folk of Karrak with their forges. The halfellows with their farms. Westmarch with its roads." },
      { s: "ysolde", t: "And we grow. That is all we have ever done." },
      { s: "aelthir", t: "Builders finish things, Ysolde. The forest never finishes. I used to think that made us wiser." },
      { n: "In Karrak, the Dwarves' Thane Brunna orders walls. In the Hearthlands, Mayor Hobby Trickgrin orders granaries. In Westmarch, Queen Maren orders roads. Nobody orders trees." },
      { s: "vaelis", t: "Three kingdoms building the future, and not one of them has asked what it will look like in five hundred years. I have. It looks like *rubble*." },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted, and does not so much rise as *grow*.", req: { cities: 2 },
        alt: "Elf druids choose where a second grove-town will grow. It will take a century to be finished. Nothing in the Silverwood is ever finished." },
      { s: "vaelis", t: "The halfellows built a whole town last week. In a *week*, great-uncle." },
      { s: "aelthir", t: "And ours will still be standing when theirs is a meadow, Vaelis." },
      { s: "vaelis", t: "Yes. Standing *alone*." },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Elf rangers have clashed with dwarf warriors.", req: { firstBlood: "dwarf" } },
      { n: "The meadows' edge, at dawn. Elf rangers have clashed with halfellow militia.", req: { firstBlood: "halfellow" } },
      { n: "The forest's edge, at dusk. Elf rangers have clashed with human road-builders.", req: { firstBlood: "human" } },
      { s: "aelthir", t: "First blood. The builders have come to measure the forest." },
      { s: "vaelis", t: "Then let us show them what it costs to build here, great-uncle." },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. Aelthir walks the forest's edge. On every side, the lights of things being built: forges, farms, roads." },
      { s: "aelthir", t: "The new world will be built, Ysolde, whatever I do. The only question is who builds it." },
      { s: "ysolde", t: "And who inherits the Silverwood when it is." },
      { n: "They both look at Vaelis, who is polishing his mythril collar and pretending not to listen." },
      { s: "vaelis", t: "I am *right here*, great-uncle." },
      { s: "aelthir", t: "I know, Vaelis. That is precisely what worries me." },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders. Where the builders built well, the trees grow around their work instead of over it." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis." },
      { s: "vaelis", t: "You would give the Silverwood to a woman who talks to *puddles*." },
      { s: "ysolde", t: "And they, my son, have a great deal to say about you." },
      { s: "aelthir", t: "And I ask the builders, all of them, to teach us something. The Silverwood has never finished anything. It is time we learned." },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying every builder in the Marches. The forges are cold, the farms are wild, the roads are overgrown." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "Rubble, great-uncle. As I predicted. A little early, that's all." },
      { s: "aelthir", t: "They built, and we grew over what they built. It is not the same as winning, Vaelis." },
    ],
    "E-Fallen": [
      { n: "The Silverwood has fallen. Walls, farms and roads have reached the Heartwood, and {capital} is lost." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden." },
      { s: "aelthir", t: "Let them build here, Ysolde. Let them build well. That is all I ask." },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly." },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Silverwood still stands.", req: { winner: "dwarf" } },
      { n: "The Halfellows have won by holding the Marches, but the Silverwood still stands.", req: { winner: "halfellow" } },
      { n: "Westmarch has won by holding the Marches, but the Silverwood still stands.", req: { winner: "human" } },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "The builders hold the Marches. I will witness their Accord, and ask them to leave room for things that grow." },
      { s: "vaelis", t: "They will build a *fence* around us, great-uncle." },
      { s: "aelthir", t: "Then we will grow over it, Vaelis. Slowly. We are very good at slowly." },
    ],
  },
};
