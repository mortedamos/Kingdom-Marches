/**
 * STORY SCENARIO -- halfellow/dwarf+human, "The Creditors' War"
 * Two rivals who both want what the halfellows have: food, land, the ale
 * tariff. The Dwarves are owed money by Westmarch (the Cathedral debt);
 * Westmarch owes the halfellows three hundred years of thank-yous. Barnaby's
 * copy of the Accord is the prize that matters: everyone wants to know what
 * it promised them. Threads: the Whispering War only if Elves exist (no).
 * Shared defaults: js/data/story/shared/halfellow.js. Bible §9.5.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/dwarf+human"] = {
  title: "The Creditors' War",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll, and this time he's clutching it very tightly." },
      { s: "barnaby", t: "The Marchstone has split! And, Hobby, the only complete copy of the Accord in the Marches is in *my Archive*. Every crown will want to read it.", m: "flustered" },
      { s: "hobby", t: "The closing clause, Uncle?", m: "scheming" },
      { s: "barnaby", t: "The Marches pass to the crown that *holds* them, or failing that, the crown that *remains*. And a great deal of fine print about *who owes whom*.", m: "flustered" },
      { n: "In Karrak, the Dwarves' Thane Brunna calls in Westmarch's debt for the Dawn Cathedral. In Westmarch, Queen Maren refuses to pay in land." },
      { s: "brunna", t: "Westmarch owes Karrak. The halfellows hold the barley. And the Accord says who owes what. I want that Archive.", m: "proud" },
      { s: "maren", t: "The halfellows' Archive will prove we owe the Dwarves nothing. I want that Archive.", m: "resolute" },
      { s: "hobby", t: "Everyone wants your scrolls, Uncle.", m: "scheming" },
      { s: "barnaby", t: "They may *look*. Nobody breathes on them.", m: "flustered" },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! And, Uncle, make a copy of the Accord. Several copies. Hide them in every cellar in the Hearthlands.", m: "scheming" },
      { s: "barnaby", t: "*Copies*? Of the *original*?", m: "flustered" },
      { s: "hobby", t: "If everyone has one, Uncle, nobody can steal the only one.", m: "scheming" },
    ],
    B2: [
      { n: "The barley fields, at dawn. Halfellow militia have clashed with dwarf warriors.", req: { firstBlood: "dwarf" },
        alt: "The road to Westmarch, at dusk. Halfellow militia have clashed with human soldiers." },
      { s: "hobby", t: "First blood. Over debts that aren't even *ours*.", m: "sad" },
      { s: "hobby", t: "Our traps are out. I used to laugh when those went off.", m: "sad", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love.", m: "sad" },
      { s: "hobby", t: "No. I don't think this one's funny.", m: "sad" },
    ],
    B3: [
      { n: "The reading room of the Hearthlands Archive. Barnaby has unrolled the Accord across three tables, and found something in the fine print." },
      { s: "barnaby", t: "Mayor. Clause twenty-two. The Cathedral debt Westmarch owes the Dwarves? It was paid for in *halfellow grain*, a hundred years ago. It's in the ledger. Nobody wrote it down on the Dwarf side.", m: "flustered" },
      { s: "hobby", t: "So Westmarch doesn't owe the Dwarves at all?", m: "scheming" },
      { s: "barnaby", t: "Westmarch owes the Dwarves nothing. The Dwarves owe *us* a hundred years of receipts. And Westmarch owes us a hundred years of *thank you*.", m: "happy" },
      { s: "goldie", t: "Hobby. We're the only ones in this war who aren't in debt.", m: "happy" },
      { s: "hobby", t: "Then we're the only ones who can afford to lose it. Which means, dear, we're the only ones who can afford to *win* it.", m: "scheming" },
    ],
    B6: [
      { n: "The Goose & Kettle, early evening. Goldie has cleared a table, laid a proper supper for one, and is standing over it with her arms folded." },
      { s: "goldie", t: "Sit. Eat. And then promise me something.", m: "stern" },
      { s: "hobby", t: "I've got a Moot in ten minutes.", m: "scheming" },
      { s: "goldie", t: "The Moot can wait. Whatever you're planning next, it's the last one. And then you send *both* of them a copy of clause twenty-two.", m: "stern" },
      { s: "hobby", t: "…The last one. And both of them. With footnotes.", m: "happy" },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the mountains to the river flies the gold of the Hearthlands." },
      { s: "stone", t: "HELD." },
      { n: "That evening, in The Goose & Kettle, the Dwarf Thane and the Human Queen each receive a copy of clause twenty-two, with footnotes.", req: { alive: ["dwarf", "human"] } },
      { s: "brunna", t: "*(reading)* …Paid. A century ago. In *grain*. Uncle, I owe the Queen of Westmarch an apology.", m: "sad", req: { alive: ["dwarf", "human"] } },
      { s: "maren", t: "And we owe the halfellows three hundred years of thank-yous. Every one of them.", m: "happy", req: { alive: ["dwarf", "human"] } },
      { s: "barnaby", t: "I told you nobody ever reads the fine print, Hobby.", m: "happy" },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying the Dwarves and Westmarch. The mountains and the river cities are silent." },
      { s: "stone", t: "REMAINS." },
      { s: "barnaby", t: "Clause twenty-two, Hobby. The debt was paid. Neither of them ever read it.", m: "sad" },
      { n: "That night, the halfellows light a great bonfire on the hill above {capital}. It is not a celebration." },
      { s: "hobby", t: "They fought over a debt that didn't exist, Uncle. And we let them.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Hearthlands have fallen. {capital}, the last halfellow town, has been surrounded." },
      { n: "Hobby's last trick is her best. While the soldiers search empty houses, every halfellow family slips out down the old smugglers' lanes, one by one, in silence." },
      { s: "barnaby", t: "I have the Accord. And the copies are in every cellar in the Hearthlands. They'll never find them all.", m: "flustered" },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs.", m: "stern" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "dwarf" },
        alt: "Westmarch has won by holding the Marches, but the Hearthlands still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "Crowns come and go, dear. Supper's still at six. Uncle, send them clause twenty-two.", m: "happy" },
      { s: "barnaby", t: "With footnotes?", m: "flustered" },
      { s: "hobby", t: "With *all* the footnotes.", m: "scheming" },
    ],
  },
};
