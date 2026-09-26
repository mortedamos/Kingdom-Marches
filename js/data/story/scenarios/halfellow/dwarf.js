/**
 * STORY SCENARIO -- halfellow/dwarf, "Tariffs and Tankards"
 * The ale war, from the barley side. Hobby likes Brunna, and that doesn't
 * stop her. Goldie runs the pub on smuggled Karrak ale. The most comic
 * Halfellow scenario; it ends with a toast whoever wins.
 * Shared defaults: js/data/story/shared/halfellow.js. Bible §9.5.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/dwarf"] = {
  title: "Tariffs and Tankards",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down her breakfast standing up. She is already late for three meetings." },
      { n: "Behind the bar, her younger sister Goldie, who keeps The Goose & Kettle, is checking the barrels. The door bangs open: their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, with a scroll." },
      { s: "barnaby", t: "The Marchstone has split! The Accord is gone! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "flustered" },
      { s: "hobby", t: "Uncle, breathe. What else?" },
      { s: "barnaby", t: "With the Accord gone, Hobby… so is the ale tariff. The one the Dwarves have complained about for a century.", m: "flustered" },
      { s: "goldie", t: "The *tariff*? Hobby, half our ale comes from Karrak. Without the Accord behind it, the Dwarves will stop paying that tariff, and we can't make them.", m: "stern" },
      { s: "hobby", t: "Then this war is about *ale*, Goldie. Or, well, the principle of ale.", m: "scheming" },
      { n: "In Karrak, the Dwarves' mountain realm, High Thane Brunna Stonefast reads the same clause and sets down her tankard, which is full of halfellow barley-ale." },
      { s: "brunna", t: "No more tariff. Uncle, write to the halfellow Mayor. Tell her Karrak is *delighted*.", m: "happy" },
      { s: "oskar", t: "Entry nine hundred and four in the Book of Grudges, the ale tariff: finally, *actionable*.", m: "grudging" },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot (the halfellow town meeting) and the harvest committee. She is late to both." },
      { s: "hobby", t: "Good morning, everyone! Lovely town! Plant barley. Lots of barley. Must dash!", m: "happy" },
      { s: "barnaby", t: "*Why* so much barley, Hobby?", m: "flustered" },
      { s: "hobby", t: "Because, Uncle, if the Dwarves want our barley, they'll have to *ask nicely*.", m: "scheming" },
    ],
    B2: [
      { n: "The barley fields at the edge of the Hearthlands, at dawn. Halfellow militia and dwarf warriors have clashed for the first time since the Accord. Someone has trampled the barley." },
      { s: "hobby", t: "First blood, with the Dwarves. I used to share a barrel with Brunna Stonefast at the Midsummer Fair.", m: "sad" },
      { s: "hobby", t: "Our traps are out now, too. I used to laugh when those went off.", m: "sad", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You still could share a barrel with her, love. After.", m: "happy", alt: { s: "barnaby", t: "You still could, Hobby. After.", m: "happy" } },
      { s: "oskar", t: "*(in Karrak)* Entry nine hundred and four, amended: the barley, *and* the fields it grew in.", m: "grudging" },
    ],
    B6: [
      { n: "The Goose & Kettle, early evening. Goldie has cleared a table, laid a proper supper for one, and poured a tankard of Karrak ale, smuggled in past both armies." },
      { s: "goldie", t: "Sit. Eat. Drink. That's the last barrel of dwarf ale in the Hearthlands, and I want you to *appreciate* it.", m: "stern" },
      { s: "hobby", t: "Goldie, where did you *get* this?", m: "happy" },
      { s: "goldie", t: "A pub hears everything, love. Including where the smugglers are. Now promise me: whatever you're planning next, it's the last scheme.", m: "stern" },
      { s: "hobby", t: "…The last one. And when it's over, I'm going to sit down with the Thane and settle that tariff over a proper drink.", m: "scheming" },
      { s: "barnaby", t: "*(from the doorway)* You'll lose." },
      { s: "hobby", t: "I'll lose *slowly*, Uncle. The dwarves will respect that.", m: "happy" },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the mountains to the river flies the gold of the Hearthlands. No one conquered the Marches. They simply became one enormous neighbourhood." },
      { s: "stone", t: "HELD." },
      { n: "That evening, in The Goose & Kettle, Hobby and High Thane Brunna Stonefast sit across a table with two tankards and a single sheet of paper: the new ale tariff.", req: { alive: "dwarf" } },
      { s: "brunna", t: "No tariff at all. In exchange for one barrel of halfellow ale a month, delivered to Karrak, forever.", m: "proud", req: { alive: "dwarf" }, alt: { s: "sigrun", t: "No tariff at all. One barrel a month, delivered to Karrak, forever. Mother would've haggled. I'm thirsty.", m: "happy", req: { alive: "dwarf" } } },
      { s: "hobby", t: "…Done. Goldie, fetch the good barrel.", m: "happy" },
      { s: "goldie", t: "It's *already* on the table, love. It's been on the table since *noon*.", m: "stern" },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying the Dwarves. The mountains of Karrak are silent." },
      { s: "stone", t: "REMAINS." },
      { s: "barnaby", t: "The ale tariff. There's no one left to pay it, or to be paid.", m: "sad" },
      { n: "That night, the halfellows light a great bonfire on the hill above {capital}. It is not a celebration." },
      { s: "goldie", t: "No more tricks, Hobby. And no more dwarf ale. Ever.", m: "sad", alt: { s: "barnaby", t: "No more tricks, Hobby. And no more dwarf ale. Ever.", m: "sad" } },
      { s: "hobby", t: "No. That was the last one. I'll pour one for the Thane, Goldie. Every Midsummer.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Dwarves have broken the Hearthlands. {capital}, the last halfellow town, has been surrounded, and dwarf warriors are at the brewery doors." },
      { n: "Hobby's last trick is her best. While the dwarf army searches empty houses, every halfellow family slips out down the old smugglers' lanes, one by one, in silence." },
      { s: "barnaby", t: "I have the Accord. The Archive's copy. The only complete one in the Marches.", m: "flustered" },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs.", m: "stern", alt: { s: "barnaby", t: "*(locking the pub door)* We'll be back. Goldie would want the tabs collected.", m: "sad" } },
      { n: "In the empty town square, the Dwarf Thane finds a single barrel of ale left at the gate, with a note: “No hard feelings. Well. A few. Hobby.”" },
      { s: "brunna", t: "…Uncle. Write it down. As a *courtesy*.", m: "sad", alt: { s: "sigrun", t: "…Uncle. Write it down. As a *courtesy*.", m: "sad" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches. A ring of dwarf stonework circles the Marchstone, but the Hearthlands still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "Crowns come and go, dear. Supper's still at six. And the Dwarves will still need barley.", m: "happy" },
      { s: "goldie", t: "And *you* are still going to be late for it.", m: "stern", alt: { s: "barnaby", t: "And you will still be late for it. She'd have said that.", m: "sad" } },
      { n: "A dwarf messenger arrives with a barrel and an invitation: supper in Karrak, every Midsummer, forever. Tariff-free." },
    ],
  },
};
