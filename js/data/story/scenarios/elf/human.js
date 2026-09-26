/**
 * STORY SCENARIO -- elf/human, "Mayflies with Axes"
 * Aelthir sees Maren's grandmother in her: the same hunger, the same
 * brightness. The Temple calls the Elves godless, and Vaelis agrees,
 * gleefully. Aelthir learns the Accord failed the short-lived too. Threads:
 * the bloodline and Aelthir's mercy (shared.js) are at their most personal
 * here. Shared defaults: js/data/story/shared/elf.js. Bible §9.2.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/human"] = {
  title: "Mayflies with Axes",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, the last living witness of the Long Accord, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "uncanny" },
      { s: "vaelis", t: "And the mayflies of Westmarch will want it. They want everything. They simply don't live long enough to *keep* anything.", m: "aloof" },
      { s: "aelthir", t: "Their Queen, Maren. I taught her grandmother to read. I sent the family a sapling at her coronation.", m: "wistful" },
      { s: "ysolde", t: "She let it die, Warden. The trees told me.", m: "uncanny" },
      { s: "aelthir", t: "Yes. They always do.", m: "sad" },
      { n: "In Westmarch, the Human kingdom, Queen Maren Ashcroft sends Collegium scholars to measure the silver trees for study. Her brother Aldric, of the Temple of the Dawn, nods approvingly." },
      { s: "aldric", t: "The Elves are godless, Majesty. The Dawn will light our way through their forest.", m: "fervent" },
      { s: "vaelis", t: "*(reading the scouts' report)* Godless. I have been called many things. That one I shall have *framed*.", m: "aloof" },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted right across the human scholars' camp.", req: { cities: 2 },
        alt: "Elf druids walk the forest's edge, choosing where a second grove-town will grow, right across the human scholars' camp." },
      { s: "vaelis", t: "Let their surveyors measure *that*.", m: "aloof" },
      { s: "aelthir", t: "You planted a town out of *spite*, Vaelis.", m: "angry" },
      { s: "vaelis", t: "Great-uncle. I planted a town out of *foresight*. The spite is merely a pleasant side effect.", m: "aloof" },
    ],
    B2: [
      { n: "The forest's edge, at dusk. Elf rangers and human soldiers have clashed over the scholars' camp." },
      { s: "aelthir", t: "First blood with Westmarch. I remember when their grandfathers came to the Silverwood to *trade*.", m: "sad" },
      { s: "vaelis", t: "And now they come with axes. Mayflies, great-uncle. Bright, brief, and cutting down in a season what took us an age to grow.", m: "aloof" },
      { n: "In Westmarch, the Lord-Paladin Aldric and the Archmage Corvin argue, as ever, over who gets the credit." },
      { s: "aldric", t: "The Dawn guided our swords!", m: "fervent" },
      { s: "corvin", t: "The *Collegium's maps* guided our swords, Lord-Paladin. The Dawn was busy setting.", m: "wry" },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. Aelthir sits with a very old book, the first one he ever taught a human child to read." },
      { s: "aelthir", t: "The Accord failed them too, Ysolde. We had a thousand years. They had thirty, forty. How could they wait for peace to be *fair*?", m: "wistful" },
      { s: "ysolde", t: "They couldn't, Warden. So they built power instead. Magic and faith, bound in one fist.", m: "uncanny" },
      { s: "vaelis", t: "You are *pitying* them now, great-uncle? While their axes are in our trees?", m: "angry" },
      { s: "aelthir", t: "I am *understanding* them, Vaelis. You may find it useful one day. Probably not.", m: "wistful" },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders. The scholars' camp ends at a wall of oaks, and the oaks show no sign of moving." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis.", m: "happy" },
      { s: "vaelis", t: "You would give the Silverwood to a woman who talks to *puddles*.", m: "angry" },
      { s: "ysolde", t: "And they, my son, have a great deal to say about you.", m: "uncanny" },
      { n: "A sapling leaves the Silverwood for Westmarch, packed in moss, with a note in the Warden's hand.", req: { alive: "human" } },
      { s: "aelthir", t: "“For the Queen. Water it this time. I will visit. You are family, whether you like it or not.”", m: "happy", req: { alive: "human", seen: "bloodline" },
        alt: { s: "aelthir", t: "“For the Queen. Water it this time.”", m: "happy", req: { alive: "human" } } },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying Westmarch. The river cities are overgrown." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "They ended, great-uncle. As brief things do.", m: "aloof" },
      { s: "aelthir", t: "They were *my blood*, Vaelis. Diluted a thousand times. Still mine.", m: "sad", req: { seen: "bloodline" }, alt: "I taught their grandmother to read, Vaelis." },
      { n: "Aelthir walks the overgrown path to the ruins of Westmarch alone. In a burned garden he finds a dead sapling, the one he sent for the coronation. He plants a new one beside it." },
    ],
    "E-Fallen": [
      { n: "Westmarch has broken the Silverwood. Human axes ring through the forest, and {capital} is falling." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden. I have told them it is time.", m: "sad" },
      { s: "aelthir", t: "Tell the Queen of Westmarch… her grandmother read beautifully. She should know that.", m: "sad" },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly.", m: "aloof" },
      { n: "In the ruins, Queen Maren of Westmarch finds a single book beneath the Heartwood: a child's primer, a thousand years old, inscribed in her grandmother's hand." },
      { s: "maren", t: "…Write it down. All of it. Everything he taught her.", m: "sad" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "Westmarch has won by holding the Marches. Westmarch's banners fly from the river to the forest's edge, but the Silverwood still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "The mayflies hold the Marches. They will write a new Accord. I will witness it. The second of my life.", m: "wistful" },
      { s: "vaelis", t: "You will witness the mayflies' treaty, great-uncle?", m: "aloof" },
      { s: "aelthir", t: "I will do more than witness it, Vaelis. I will make sure it lasts longer than they do.", m: "happy" },
    ],
  },
};
