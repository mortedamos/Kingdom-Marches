/**
 * STORY SCENARIO -- dwarf/halfellow, "Tariffs and Tankards"
 * The ale war, for real: halfellow barley plus dwarf brewing made the
 * realm's finest ales, and the Accord froze a tariff both sides have hated
 * for a century. Brunna and Hobby are clearly fond of each other; Oskar's
 * single halfellow grudge-entry grows by the round. The comic scenario.
 * Shared defaults: js/data/story/shared/dwarf.js. Bible §9.3.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/halfellow"] = {
  title: "Tariffs and Tankards",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent, and every barrel in the brewery cellars sloshes, as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast sets down her tankard. Her wife, the runesmith Kazra Emberdeep, climbs up from the forges." },
      { s: "kazra", t: "The Marchstone's split, Brunna. The Accord's gone." },
      { n: "Brunna's uncle, Loremaster Oskar Grimgate, hurries in hugging the Book of Grudges, where the Dwarves record every wrong ever done to them." },
      { s: "oskar", t: "The closing clause stands, Thane: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*. And, Thane… with the Accord gone, so is the ale tariff." },
      { s: "brunna", t: "…The *ale tariff*?" },
      { s: "oskar", t: "A century of paying the halfellows through the nose for barley. Frozen by the Accord. It's the only halfellow entry in the whole Book. Entry nine hundred and four. I've underlined it forty times." },
      { n: "Far to the south, in the Hearthlands, home of the halfellows, Mayor Hobby Trickgrin is reading the same clause in The Goose & Kettle, the halfellows' oldest pub." },
      { s: "hobby", t: "No more Accord, Goldie. Which means no more *frozen tariff*." },
      { s: "goldie", t: "Hobby Trickgrin, you are not starting a war over *ale*." },
      { s: "hobby", t: "Not over ale, dear. Over the *principle* of ale." },
      { n: "Back in Karrak, Sigrun, the Thane's daughter and a Metal Singer, looks from her mother to her great-uncle and back." },
      { s: "sigrun", t: "Are we going to war with the *halfellows*? They make the *pies*!" },
      { s: "brunna", t: "We're going to war for the Heartstone, daughter. If the barley comes with it, so be it." },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, hunting for the right rock to raise a second hold on." },
      { s: "brunna", t: "A second hold. Stone foundations, a proper cellar. A *very* proper cellar." },
      { s: "oskar", t: "The clan-moot wants to know if the cellar is for defence or for ale, Thane." },
      { s: "brunna", t: "Yes." },
      { n: "In the Hearthlands, a halfellow pedlar brings Hobby a sketch of the new dwarf hold." },
      { s: "hobby", t: "Look at the size of that cellar, Goldie. They're planning to *brew their own*. The cheek." },
    ],
    B2: [
      { n: "The barley fields at the edge of the Hearthlands, at dawn. Dwarf and halfellow warriors have clashed for the first time since the Accord. Someone has trampled the barley." },
      { s: "oskar", t: "Entry nine hundred and four, amended: the barley, *and* the fields it grew in." },
      { s: "kazra", t: "I've started a Titan.", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { s: "sigrun", t: "Mother Kazra, you can't march a *Titan* at *halfellows*. It'd step on them by accident." },
      { n: "In The Goose & Kettle, Hobby hears the news quietly, and for once she doesn't grin." },
      { s: "hobby", t: "First blood, with the Dwarves. I used to share a barrel with Brunna Stonefast at the Midsummer Fair." },
      { s: "goldie", t: "You still could, love. After." },
    ],
    B3: [
      { n: "The Thane's Hall, late at night. Oskar has brought the Book of Grudges to the Thane, open to a single, heavily annotated page." },
      { s: "oskar", t: "Entry nine hundred and four, Thane. It's grown. It's now eleven pages long. I've had to start *sub-entries*." },
      { s: "brunna", t: "Read me the worst one." },
      { s: "oskar", t: "Nine hundred and four, part K: “The halfellow Mayor sent a goose into our supply train. The goose was *wearing a hat*.”" },
      { s: "sigrun", t: "*(trying very hard not to laugh)* …Was it a nice hat?" },
      { s: "oskar", t: "That is *not the point*, child." },
      { s: "brunna", t: "Hobby Trickgrin. She always did fight like a festival." },
    ],
    B6: [
      { n: "Night, on the walls of {capital}. Brunna and Kazra share the last barrel of halfellow ale left in Karrak." },
      { s: "brunna", t: "When this is done, I'm going to sit down with Hobby Trickgrin and settle that tariff over a proper drink.", alt: { s: "sigrun", t: "When this is done, I'm going to sit down with Hobby Trickgrin and settle that tariff. Mother always meant to." } },
      { s: "kazra", t: "You'll lose." },
      { s: "brunna", t: "I'll lose *slowly*. That's the dwarf way.", alt: { s: "sigrun", t: "I'll lose *loudly*. That's *my* way." } },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone, and a barley field has been planted just outside it, by agreement." },
      { s: "stone", t: "HELD." },
      { n: "That evening, in the Thane's Hall, Brunna and Hobby Trickgrin sit across a table with two tankards and a single sheet of paper: the new ale tariff.", req: { alive: "halfellow" } },
      { s: "hobby", t: "Nothing. Zero. No tariff at all. In exchange for one barrel a month, delivered to The Goose & Kettle, forever.", req: { alive: "halfellow" } },
      { s: "brunna", t: "…Done.", req: { alive: "halfellow" }, alt: { s: "sigrun", t: "…Done. Mother would've haggled. I'm thirsty.", req: { alive: "halfellow" } } },
      { s: "oskar", t: "Entry nine hundred and four, all eleven pages. *Struck out*. …And the goose's hat. Struck out as well. It was a very nice hat." },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying the Halfellows. The Hearthlands are empty." },
      { s: "stone", t: "REMAINS." },
      { s: "oskar", t: "Entry nine hundred and four, Thane. The tariff. There's no one left to pay it, or to be paid." },
      { n: "Sigrun sits on the walls of {capital} with her axe-guitar across her knees, and doesn't play a note." },
      { s: "sigrun", t: "No more pies. No more ale. No more geese in hats. Was the barley worth it, Uncle?" },
      { s: "oskar", t: "*(closing the Book)* No, child. It never is." },
    ],
    "E-Fallen": [
      { n: "The Halfellows have broken the Dwarves. {capital} is the last dwarf stronghold standing, and its gates have been mysteriously unlocked." },
      { s: "oskar", t: "Unlocked, Thane. Not broken. Unlocked. They didn't even have the decency to *siege* us." },
      { s: "brunna", t: "Stone remembers, Kazra. Even when it loses to a goose.", alt: { s: "sigrun", t: "Stone remembers, Mother Kazra. Even when it loses to a goose." } },
      { n: "The halfellow Mayor walks into the Thane's Hall alone, with two tankards." },
      { s: "hobby", t: "No hard feelings, dear. Well. A few hard feelings. Drink?" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Halfellows have won by holding the Marches. Every field from the mountains to the river has become one enormous, well-fed neighbourhood." },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "brunna", t: "Beaten by barley. Write it down, Uncle. As a debt, not a grudge.", alt: { s: "sigrun", t: "Beaten by barley. Write it as a debt, Uncle." } },
      { s: "oskar", t: "A debt to the halfellows. Payable in…?" },
      { n: "A halfellow messenger arrives at the gate with an invitation: supper at The Goose & Kettle, every Midsummer, forever. Tariff-free." },
      { s: "kazra", t: "Payable in *attendance*, it seems." },
    ],
  },
};
