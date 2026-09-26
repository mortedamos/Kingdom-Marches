/**
 * STORY SCENARIO -- dwarf/elf+halfellow, "The Soft Earth"
 * Forest and meadow, both "soft" lands, against the stone-folk. Brunna's
 * walls face Hobby's hedges and Aelthir's roots; Hobby pranks Vaelis, and
 * Oskar admits in the Book that this is "adequate."
 * Shared defaults: js/data/story/shared/dwarf.js. Bible §9.3.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/elf+halfellow"] = {
  title: "The Soft Earth",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast gathers her family: her wife Kazra the runesmith, her uncle Oskar with the Book of Grudges, and her daughter Sigrun." },
      { s: "oskar", t: "The Accord's closing clause, Thane: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "brunna", t: "Then Karrak holds. We cut that stone from under this mountain. I'll have our Heartstone back.", m: "proud" },
      { s: "oskar", t: "Two neighbours stand in the way. The Elves' forest to the west. The halfellows' meadows to the south." },
      { s: "kazra", t: "Soft ground, both of them. Roots and barley. Nothing you can build a proper wall on.", m: "focused" },
      { n: "In the Silverwood, the Elves' ancient forest, the Warden Aelthir Moonveil feels the stone split. His heir, Lord Vaelis Nightbloom, is already drafting orders." },
      { s: "vaelis", t: "The mud-folk to the east. The Trickgrin woman to the south. Two nuisances, great-uncle. I have been waiting forty years to deal with *her*.", m: "aloof" },
      { n: "In the Hearthlands, home of the halfellows, Mayor Hobby Trickgrin is late for three meetings, and grinning." },
      { s: "hobby", t: "Dwarves on one side, Elves on the other, and us in the middle with all the barley. Goldie, I have a little plan.", m: "scheming" },
      { s: "goldie", t: "Does it involve a goose?", m: "stern" },
      { s: "hobby", t: "Only *mostly*.", m: "scheming" },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, looking for rock hard enough to build a second hold on." },
      { s: "brunna", t: "Stone foundations. A proper cellar. And not a single blade of grass inside the walls.", m: "proud" },
      { s: "oskar", t: "The clan-moot asks if that's defence or taste, Thane." },
      { s: "brunna", t: "Yes.", m: "proud" },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Dwarf and elf warriors have clashed for the first time since the Accord.", req: { firstBlood: "elf" },
        alt: "The barley fields of the Hearthlands, at dawn. Dwarf and halfellow warriors have clashed for the first time since the Accord." },
      { s: "oskar", t: "First blood. Entry {grudge} in the Book of Grudges. The first of many, I expect.", m: "grudging" },
      { s: "kazra", t: "I've started a Titan.", m: "focused", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { s: "vaelis", t: "*(in the Silverwood)* The mud-folk fight like they dig. Slowly, and in the dark.", m: "aloof", req: { firstBlood: "elf" } },
      { s: "hobby", t: "*(in the Hearthlands)* First blood, with the Dwarves. I used to share a barrel with the Thane at the Midsummer Fair.", m: "sad", req: { firstBlood: "halfellow" } },
    ],
    B3: [
      { n: "A report reaches the Thane's Hall that makes even Kazra laugh: somebody filled Lord Vaelis's war-tent with honey, and then with geese." },
      { s: "oskar", t: "The halfellow Mayor pranked the elf heir. In the middle of a war. With *geese*.", m: "happy" },
      { s: "sigrun", t: "Put it in the Book, Uncle! Put it in the Book!", m: "happy" },
      { s: "oskar", t: "It's not *our* grudge, child.", m: "grudging" },
      { n: "He opens the Book anyway, and writes a small note in the margin." },
      { s: "oskar", t: "“The halfellows' conduct toward the Silverwood: *adequate*.” …That's the highest praise the Book has ever given anyone.", m: "grudging" },
    ],
    B6: [
      { n: "Night, on the walls of {capital}. Brunna looks out over forest to the west and meadow to the south." },
      { s: "brunna", t: "Soft ground, all of it. Roots and barley. And they've held against us longer than I thought they could.", m: "proud", alt: { s: "sigrun", t: "Soft ground, all of it. And they've held against us longer than Mother thought they could." } },
      { s: "kazra", t: "Soft ground holds, love. It just holds *differently*.", m: "happy" },
      { s: "brunna", t: "Then let's see which kind holds longest.", m: "proud", alt: { s: "sigrun", t: "Then let's see which kind holds longest.", m: "fierce" } },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone, with the forest on one side and a barley field on the other." },
      { s: "stone", t: "HELD." },
      { s: "oskar", t: "Entry the First, the Rootcut. And entry nine hundred and four, the ale tariff. Both struck out. Two in one day. I may need to lie down.", m: "happy" },
      { s: "hobby", t: "*(arriving uninvited with a barrel)* Congratulations, Thane! I brought the ale. Lord Vaelis sends his regards. He doesn't know he does.", m: "scheming", req: { alive: "halfellow" } },
      { s: "vaelis", t: "*(by letter)* “The Silverwood acknowledges the mud-folk's stones. It does not acknowledge the geese.”", m: "aloof", req: { alive: "elf" } },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying the Elves and the Halfellows. The forest is silent and the meadows are empty." },
      { s: "stone", t: "REMAINS." },
      { s: "oskar", t: "Two grudges settled, Thane. The Rootcut and the tariff. There's no one left to prove anything to, or to buy barley from.", m: "sad" },
      { n: "Sigrun sits on the walls of {capital} and plays one very quiet song, the kind the halfellows used to sing at Midsummer." },
      { s: "kazra", t: "Stone endures. It's lonelier than I thought.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "Karrak has fallen. {capital} is the last dwarf stronghold standing, and forest and meadow are closing around it." },
      { s: "kazra", t: "The last Titan's ready. I'll take it into the breach.", m: "focused", req: { unit: "self:runeforged_titan" }, alt: "I'll hold the breach myself." },
      { s: "brunna", t: "Stone remembers, Kazra.", m: "sad", alt: { s: "sigrun", t: "Stone remembers, Mother Kazra.", m: "sad" } },
      { n: "The Underways seal from within. The mountain goes dark." },
      { s: "vaelis", t: "The mud-folk, sealed in their own holes. How tidy.", m: "aloof", req: { conqueror: "elf" } },
      { s: "hobby", t: "Leave a barrel at the door, Goldie. For when they come back out.", m: "sad", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Elves have won by holding the Marches. The forest has walked back over the old borders, but Karrak still stands.", req: { winner: "elf" },
        alt: "The Halfellows have won by holding the Marches. Every field from the mountains to the river is one enormous neighbourhood, but Karrak still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "brunna", t: "Soft ground won. Write it as a debt, Uncle.", m: "proud", alt: { s: "sigrun", t: "Soft ground won. Write it as a debt, Uncle." } },
      { s: "oskar", t: "And the geese?", m: "grudging" },
      { s: "brunna", t: "The geese, Uncle, can stay a grudge.", m: "happy", alt: { s: "sigrun", t: "The geese can stay a grudge.", m: "happy" } },
    ],
  },
};
