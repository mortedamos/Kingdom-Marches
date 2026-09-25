/**
 * STORY SCENARIO -- elf/dwarf+halfellow+human+orc, "The Long Memory"
 * The canonical Elf story: the descendants of every crown Aelthir watched
 * swear, an heir who wants him gone, and the old world ending one kingdom at
 * a time. Every thread can run: the lovers (seen by the Elves), the
 * bloodline, mercy, the witches' feud, the Whispering War.
 * Shared defaults: js/data/story/shared/elf.js. Bible §9.2.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/dwarf+halfellow+human+orc"] = {
  title: "The Long Memory",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood. He is ancient: the last living witness of the day the Long Accord was sworn. He has buried every other witness." },
      { s: "aelthir", t: "I held the torch when the five crowns swore it. A human Queen. A dwarf Thane. An orc Warchief. A halfellow Mayor. And my own grandmother." },
      { s: "aelthir", t: "I remember how young they all looked." },
      { n: "Beside him stand his niece Ysolde, the Archdruid, who speaks for the trees, and his grand-nephew and heir, Lord Vaelis Nightbloom, immaculate in polished mythril." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "vaelis", t: "Then every one of their descendants will come for it. Four kingdoms of the brief, great-uncle, and only one of the *enduring*." },
      { s: "aelthir", t: "I have outlived the Accord, Vaelis. I intend to outlive its breaking too." },
      { s: "vaelis", t: "Oh, I have no doubt of it, great-uncle. The question is whether the Silverwood will outlive *you*." },
      { n: "One by one, across the Marches, the descendants of the five crowns feel the stone split: in Karrak, in Westmarch, in the Hearthlands, in the Bloodmire." },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted at the forest's edge.", req: { cities: 2 },
        alt: "Elf druids walk the forest's edge, choosing where a second grove-town will grow." },
      { s: "vaelis", t: "A grove, great-uncle. The land was wasted on the brief before." },
      { s: "aelthir", t: "The land was *lent* to the brief before, Vaelis. By an Accord I swore to." },
      { s: "vaelis", t: "An Accord that no longer exists." },
      { s: "aelthir", t: "I do. That will have to be enough for now." },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Elf rangers have clashed with dwarf warriors.", req: { firstBlood: "dwarf" } },
      { n: "The meadows' edge, at dawn. Elf rangers have clashed with halfellow militia.", req: { firstBlood: "halfellow" } },
      { n: "The forest's edge, at dusk. Elf rangers have clashed with human road-builders.", req: { firstBlood: "human" } },
      { n: "The borderwood, at dawn. Elf rangers have met orc war-bands in the smoke.", req: { firstBlood: "orc" } },
      { s: "aelthir", t: "First blood. I will remember every name, Vaelis, ours and theirs. That is what the long memory is for." },
      { s: "vaelis", t: "You mourn the enemy, great-uncle? It embarrasses the court." },
      { s: "aelthir", t: "Then let the court be embarrassed. I knew their ancestors." },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. Aelthir sits with a very old book. Inside it, in five hands, are the names of the Accord's signatories." },
      { s: "aelthir", t: "The old world is ending, Ysolde. One kingdom at a time. And I have to decide what the Silverwood carries into the new one." },
      { s: "ysolde", t: "And who carries it, Warden." },
      { n: "They both look at Vaelis, who stands at the edge of the clearing with his arms folded." },
      { s: "vaelis", t: "Carry the Silverwood forward, great-uncle, not those five dead names. Let the old promises die with the old world." },
      { s: "aelthir", t: "No, Vaelis. The names are the only thing worth carrying." },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest walks back into the Marches. At the split Marchstone, Aelthir lays his hand on the stone and says the names of every long-dead signatory, one by one, and asks it to rest." },
      { s: "stone", t: "HELD." },
      { n: "For the first time in a thousand years, the last witness of the Accord plans for the future instead of guarding the past." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis." },
      { s: "vaelis", t: "You would give the Silverwood to a woman who talks to *puddles*." },
      { s: "ysolde", t: "And they, my son, have a great deal to say about you." },
      { s: "aelthir", t: "And I will write a new Accord, with every crown still standing. This time, I will not be its only witness." },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying every other kingdom. The last witness is the last crown." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "They ended, great-uncle. As brief things do. I told you they would." },
      { s: "aelthir", t: "I outlived the Accord, and everyone who swore it. And now I have outlived their children's children too." },
      { n: "It is quiet beneath the Heartwood, and hollow." },
      { s: "aelthir", t: "Sit down, Vaelis. I am going to teach you the names. All of them. Someone has to remember what the brief were *for*." },
    ],
    "E-Fallen": [
      { n: "The Silverwood has fallen. The Heartwood still stands, and the forest is falling around it." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden. I have told them it is time." },
      { n: "Beneath the Heartwood, Aelthir sits very still with the book of signatories in his lap. The last witness of the Accord is going with it." },
      { s: "aelthir", t: "Take the book, Ysolde. The names. Someone must remember them." },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly." },
      { s: "ysolde", t: "*(taking the book)* No, my son. *I* shall remember them. Properly." },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Silverwood still stands.", req: { winner: "dwarf" } },
      { n: "The Halfellows have won by holding the Marches, but the Silverwood still stands.", req: { winner: "halfellow" } },
      { n: "Westmarch has won by holding the Marches, but the Silverwood still stands.", req: { winner: "human" } },
      { n: "The Orcs have won by holding the Marches, but the Silverwood still stands.", req: { winner: "orc" } },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "A new Accord will be sworn. I will witness it, the second of my life. I remember how young they all looked. They still do." },
      { s: "vaelis", t: "You will outlive this one too, great-uncle." },
      { s: "aelthir", t: "Perhaps, Vaelis. But this time I will not be the only one who remembers. I will make sure of it." },
    ],
  },
};
