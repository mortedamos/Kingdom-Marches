/**
 * STORY SCENARIO -- elf/dwarf+human+orc, "The Last Witness"
 * Three crowns each demand Aelthir, the only living witness of the Accord,
 * testify that it favoured them. He can't -- it favoured none of them.
 * Vaelis offers to testify *instead*, falsely, for a price. Threads: the
 * lovers (seen by the Elves), the bloodline, mercy, the witches' feud, the
 * Whispering War. Shared defaults: js/data/story/shared/elf.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/dwarf+human+orc"] = {
  title: "The Last Witness",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { n: "Aelthir is the last living person who saw the Long Accord sworn. Every other witness is a thousand years dead." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "uncanny" },
      { s: "vaelis", t: "Every crown in the Marches will want to know what the Accord *promised* them, great-uncle. And only one person alive was in the room.", m: "aloof" },
      { s: "aelthir", t: "I held the torch. I remember every word.", m: "wistful" },
      { s: "vaelis", t: "Then you are the most valuable thing in the Silverwood. I do hope you realise that.", m: "aloof" },
      { n: "Three letters arrive before dawn: from the Dwarf Thane in Karrak, the Human Queen in Westmarch, and the Orc Warchief in the Bloodmire. Each asks the same question." },
      { s: "ysolde", t: "“Tell us what the Accord owed *us*.”", m: "uncanny" },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted, and three envoys arrive the same week, each demanding an audience with the Warden.", req: { cities: 2 },
        alt: "Three envoys arrive the same week, each demanding an audience with the Warden." },
      { s: "vaelis", t: "The Dwarves want you to say the Marchstone was theirs. The Humans want you to say the Accord blessed their crown. The Orcs want you to say it cheated them.", m: "aloof" },
      { s: "aelthir", t: "It gave the Dwarves nothing but a debt of stone. It gave the Humans nothing but time. And it did cheat the Orcs, Vaelis. It cheated them of the good land.", m: "wistful" },
      { s: "vaelis", t: "Then say *none* of that, great-uncle. Say whatever wins us the war.", m: "aloof" },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Elf rangers have clashed with dwarf warriors.", req: { firstBlood: "dwarf" } },
      { n: "The forest's edge, at dusk. Elf rangers have clashed with human soldiers and their battle-mages.", req: { firstBlood: "human" } },
      { n: "The borderwood, at dawn. Elf rangers have met orc war-bands in the smoke.", req: { firstBlood: "orc" } },
      { s: "aelthir", t: "First blood. And every one of them still wants my testimony.", m: "sad" },
      { s: "vaelis", t: "Then sell it, great-uncle. To the highest bidder. I will handle the negotiations.", m: "aloof" },
    ],
    B3: [
      { n: "Beneath the Heartwood. Lord Vaelis has returned from a secret meeting, and he is smiling his thinnest smile." },
      { s: "vaelis", t: "Great-uncle, the Dwarves will leave our forest alone if the last witness swears the Marchstone was theirs by right. I have agreed to swear it. On your behalf.", m: "aloof" },
      { s: "aelthir", t: "You have *what*?", m: "angry" },
      { s: "vaelis", t: "You are the last witness. I am your heir. When you are gone, great-uncle, my testimony will be the only testimony there is. I thought I would start early.", m: "aloof" },
      { s: "ysolde", t: "My son. That is a *lie*.", m: "angry" },
      { s: "vaelis", t: "It is a *negotiation*, mother. The lesser peoples cannot tell the difference. Neither, frankly, can I.", m: "aloof" },
      { s: "aelthir", t: "The Accord favoured no one, Vaelis. That was the entire point of it. I will not lie about it. Not for the forest. Not for you.", m: "angry" },
    ],
    B6: [
      { n: "Night, at the split Marchstone. Aelthir has come alone, to stand where he stood a thousand years ago holding a torch." },
      { s: "aelthir", t: "They all want me to say it was theirs. It was never anyone's. That was why it worked.", m: "wistful" },
      { n: "Ysolde finds him there at dawn. She has brought Vaelis. He looks, for once, uncertain." },
      { s: "ysolde", t: "Tell them the truth, Warden. All of them, together. Then no one can lie about it after you're gone.", m: "uncanny" },
      { s: "vaelis", t: "…Not even me, great-uncle. I suppose that is the point.", m: "sad" },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "At the split Marchstone, the last witness of the Long Accord tells every surviving crown exactly what it promised: nothing to anyone, and peace to everyone." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis.", m: "happy" },
      { s: "vaelis", t: "Because I tried to lie for you.", m: "angry" },
      { s: "aelthir", t: "Because you tried to lie *as* me, Vaelis. When you understand the difference, come and see me.", m: "sad" },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying every rival. There is no one left to ask what the Accord promised." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "No one left to testify to, great-uncle. Your memory is the only record now. It is ours to write.", m: "aloof" },
      { s: "aelthir", t: "Then I will write the truth, Vaelis. Even if no one reads it.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Silverwood has fallen. Beneath the Heartwood, the last witness of the Long Accord is dying." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden.", m: "sad" },
      { s: "aelthir", t: "Write it down, Ysolde. Every word of the Accord. The truth. Before Vaelis can tell it any other way.", m: "sad" },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly. And I shall remember it *correctly*, great-uncle. I promise.", m: "aloof" },
      { n: "It is the first promise anyone has ever heard Lord Vaelis make." },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Silverwood still stands.", req: { winner: "dwarf" } },
      { n: "Westmarch has won by holding the Marches, but the Silverwood still stands.", req: { winner: "human" } },
      { n: "The Orcs have won by holding the Marches, but the Silverwood still stands.", req: { winner: "orc" } },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "They will write a new Accord. I will witness it, the second of my life, and I will tell them what the first one really said, so they do not repeat its mistakes.", m: "wistful" },
      { s: "vaelis", t: "And I shall stand beside you, great-uncle, and *not* improve on it.", m: "happy" },
    ],
  },
};
