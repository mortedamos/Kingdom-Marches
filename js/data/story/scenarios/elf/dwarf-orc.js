/**
 * STORY SCENARIO -- elf/dwarf+orc, "The Mountain War Returns"
 * The Dwarves and Orcs resume their blood-war, and Aelthir wants to stand
 * apart; the stone won't allow it -- there is no neutral ground in a Marches
 * without an oath. Ysolde senses the lovers; Vaelis proposes exposing them;
 * Aelthir refuses (shared/elf.js lovers:meet). The witches' feud runs too.
 * Shared defaults: js/data/story/shared/elf.js. Bible §9.2.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/dwarf+orc"] = {
  title: "The Mountain War Returns",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, the last living witness of the Long Accord, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "aelthir", t: "And to the east, the Dwarves of Karrak. To the south, the Orcs of the Bloodmire. They fought the Mountain Wars for centuries, until the Accord made them stop." },
      { s: "vaelis", t: "And now nothing will stop them. How *convenient*. We need only wait, great-uncle, and let them do our work." },
      { s: "aelthir", t: "I have no wish to stand in their war, Vaelis. The Silverwood will stay apart from it." },
      { s: "ysolde", t: "The trees do not think we will be allowed to, Warden." },
      { n: "In the Bloodmire, the orc Bog Witch Skarra cackles at the Speaking Stones. In Karrak, the Dwarves' Loremaster Oskar opens Volume Seven of his Book of Grudges, the Orc volume, never closed." },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted far from both the mountains and the bog.", req: { cities: 2 },
        alt: "Elf druids choose where a second grove-town will grow: as far from both the mountains and the bog as the forest allows." },
      { s: "aelthir", t: "Far from both of them. The Silverwood is not their battlefield." },
      { s: "vaelis", t: "The Silverwood, great-uncle, is between their battlefields. It is very difficult to stand apart from a war when you are standing in the *middle*." },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Elf rangers have clashed with dwarf warriors marching toward the bog.", req: { firstBlood: "dwarf" },
        alt: "The borderwood, at dawn. Elf rangers have clashed with orc war-bands marching toward the mountains." },
      { s: "aelthir", t: "First blood. We did not choose this fight. It walked through our forest." },
      { s: "ysolde", t: "Wars do that, Warden. They are not polite about trees." },
      { s: "vaelis", t: "Then let us be *impolite* back." },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. Aelthir has not slept. Smoke from the Mountain War drifts through the branches." },
      { s: "aelthir", t: "I wanted to stand apart, Ysolde. The stone would not let me. There is no neutral ground in a Marches without an oath." },
      { s: "ysolde", t: "There never was, Warden. The Accord only let us pretend." },
      { s: "vaelis", t: "Then stop pretending, great-uncle. Choose a side. Preferably *ours*." },
      { s: "aelthir", t: "I have, Vaelis. I chose the two in the tunnels. I will not let their parents' war end them.", req: { seen: "lovers:meet" },
        alt: "I have, Vaelis. I choose the forest. Not their war. Not *yours* either." },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders, right up to the mountains and the bog. The Mountain War has nowhere left to happen." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis." },
      { s: "vaelis", t: "You would give the Silverwood to a woman who talks to *puddles*." },
      { s: "ysolde", t: "And they, my son, have a great deal to say about you." },
      { n: "At the next Midsummer Fair, the Warden watches a young dwarf Metal Singer and an orc Wolf Rider walk through the forest together, in daylight, and says nothing to anyone.", req: { alive: ["dwarf", "orc"] , seen: "lovers:meet" } },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying the Dwarves and the Orcs. The Mountain War is over, because both sides are gone." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "They ended, great-uncle. As brief things do. We did not even have to push very hard." },
      { s: "aelthir", t: "The two in the tunnels, Vaelis. The Thane's daughter and the Warchief's son. I said I would not let their parents' war end them.", req: { seen: "lovers:meet" },
        alt: "I wanted to stand apart from their war, Vaelis. Instead I finished it." },
      { s: "aelthir", t: "I was wrong. I did not stop it. I only watched.", req: { seen: "lovers:meet" } },
    ],
    "E-Fallen": [
      { n: "The Silverwood has fallen. The Mountain War has finally come through the forest, and {capital} is lost." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden." },
      { s: "aelthir", t: "I wanted to stand apart. In the end, the war stood on *us*." },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly." },
      { s: "skarra", t: "The elf-witch's forest, ASH! Skarra wins!", req: { conqueror: "orc" } },
      { s: "oskar", t: "Entry the First, the Rootcut. Settled. Finally. It doesn't feel settled.", req: { conqueror: "dwarf" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Silverwood still stands.", req: { winner: "dwarf" },
        alt: "The Orcs have won by holding the Marches, but the Silverwood still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "One side of the Mountain War holds the Marches. I will witness their Accord, and I will ask for one clause: the tunnels stay open." },
      { s: "vaelis", t: "For *trade*, great-uncle?" },
      { s: "aelthir", t: "For two young people who taught me something, Vaelis.", req: { seen: "lovers:meet" }, alt: "For peace, Vaelis. Tunnels are how the mud-folk visit." },
    ],
  },
};
