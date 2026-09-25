/**
 * STORY SCENARIO -- dwarf/human+orc, "Caravan Guards"
 * The Orcs raid the Human roads that carry dwarf goods. Brunna ends up
 * defending a debtor's roads for her own profit, and hates it; Sigrun uses
 * the chaos to slip away. Threads: the lovers (shared B5 / lovers:meet).
 * Shared defaults: js/data/story/shared/dwarf.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/human+orc"] = {
  title: "Caravan Guards",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast gathers her family: her wife Kazra the runesmith, her uncle Oskar with the Book of Grudges, and her daughter Sigrun, a Metal Singer." },
      { s: "oskar", t: "The Accord's closing clause, Thane: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "brunna", t: "Then Karrak holds." },
      { s: "oskar", t: "Every ingot we sell travels down Westmarch's roads, Thane. The Humans owe us for their Dawn Cathedral. And the Orcs raid those roads for sport." },
      { s: "brunna", t: "So our debtor's roads carry our iron past our oldest enemy. Wonderful." },
      { n: "In Westmarch, Queen Maren Ashcroft reads Karrak's demand for the Cathedral debt, while the Lord-Paladin Aldric and the Archmage Corvin argue about who is to blame." },
      { s: "maren", t: "We'll pay in roads, not land. Write back and tell them. …And write it down." },
      { n: "In the Bloodmire, the Orcs' swamp country, Warchief Grukka Ironjaw watches a human caravan wind past the bog-edge, heavy with dwarf iron." },
      { s: "grukka", t: "Human roads. Dwarf iron. Two enemies, one wagon. The clans eat well this winter." },
      { n: "Back in Karrak, Sigrun has gone very quiet at the word *Orcs*." },
      { s: "sigrun", t: "Mother, the orcs at the Midsummer Fair… they weren't all like the stories." },
      { s: "brunna", t: "They were orcs, Sigrun." },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, hunting for the right rock to raise a second hold on." },
      { s: "brunna", t: "A second hold. And our own road out of it. We'll not trust our iron to Westmarch's." },
      { s: "oskar", t: "Our own road will run past the same bog, Thane." },
      { s: "brunna", t: "Then it'll have *walls*." },
    ],
    B2: [
      { n: "A burning caravan on the western road, at dusk. Orc raiders have hit a Westmarch wagon train carrying dwarf iron, and dwarf guards have fought back.", req: { firstBlood: "orc" },
        alt: "The river crossings below the mountains, at dusk. Dwarf and human soldiers have clashed over the Cathedral debt." },
      { s: "oskar", t: "Volume Seven, reopened.", req: { firstBlood: "orc" }, alt: "Entry {grudge} in the Book of Grudges: Westmarch. Debt *and* violence." },
      { s: "kazra", t: "I've started a Titan.", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { s: "brunna", t: "We're guarding a debtor's caravans against our oldest enemy. For *profit*. I hate every part of this.", req: { firstBlood: "orc" } },
      { s: "skarra", t: "*(in the Bloodmire)* Dwarf iron AND human wagons! Skarra loves a two-for-one! Ha! HA!", req: { firstBlood: "orc" } },
    ],
    B3: [
      { n: "The Thane's Hall, late at night. Oskar has marked every raided caravan on the map. Almost all of them were raided on nights Sigrun was *away*." },
      { s: "oskar", t: "Thane. Sigrun's been riding out with the caravan guards. Always the night runs. Always past the bog." },
      { s: "brunna", t: "She's guarding the iron, Uncle. Good girl." },
      { s: "oskar", t: "She comes back without a scratch, Thane. From the most-raided road in the Marches. Every time." },
      { n: "Kazra says nothing at all. Oskar notices that, too." },
    ],
    B6: [
      { n: "Night, on the walls of {capital}. Brunna finds her daughter alone, looking south toward the Orc bogs." },
      { s: "brunna", t: "Is he worth it?" },
      { s: "sigrun", t: "He's worth not killing, Mother. And he's never once raided a caravan I was guarding. Not once." },
      { s: "brunna", t: "…So that's why the night runs came home safe." },
      { s: "brunna", t: "Tell the boy he's the best caravan guard Karrak ever had. And that he's *never* getting paid." },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone, and the western road runs straight through it, guarded day and night." },
      { s: "stone", t: "HELD." },
      { s: "maren", t: "*(by letter)* “The Cathedral debt, repaid in full. We have also, at Karrak's request, hired orc outriders to guard the western road. …And write it down.”", req: { alive: ["human", "orc"] } },
      { s: "oskar", t: "Volume Seven: crossed out. The Cathedral debt: struck out. Orc *caravan guards*: I have no column for this." },
      { n: "At the victory feast, Sigrun plays her song for Varg aloud for the first time. The Orc Warchief stands in the doorway, alone and unarmed.", req: { alive: "orc" } },
      { s: "grukka", t: "I heard there was singing.", req: { alive: "orc" } },
      { s: "brunna", t: "Stay by the door, Warchief.", req: { alive: "orc" } },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying Westmarch and the Orcs. The western road is silent." },
      { s: "stone", t: "REMAINS." },
      { s: "oskar", t: "Debt closed. Volume Seven closed. The road runs nowhere now, Thane." },
      { s: "brunna", t: "Start a new book anyway. For what we owe." },
      { n: "Sigrun does not come to the victory feast. At an Underway door on the edge of the ruined bogs, Moss the dire wolf lies down in front of a door that will never open again, and waits." },
    ],
    "E-Fallen": [
      { n: "Karrak has fallen. {capital} is the last dwarf stronghold standing, and it is surrounded." },
      { s: "kazra", t: "The last Titan's ready. I'll take it into the breach.", req: { unit: "self:runeforged_titan" }, alt: "I'll hold the breach myself." },
      { s: "brunna", t: "Stone remembers, Kazra.", alt: { s: "sigrun", t: "Stone remembers." } },
      { n: "The Underways seal from within. The mountain goes dark." },
      { s: "maren", t: "We'll pay the Cathedral debt anyway. To whoever's left. …And write it down.", req: { conqueror: "human" } },
      { s: "varg", t: "*(alone, at the bog-edge)* Moss knows the way. There's no one at the end of it anymore.", req: { conqueror: "orc" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Orcs have won by holding the Marches. For the first time an orc crown rules the borderlands, but Karrak still stands.", req: { winner: "orc" },
        alt: "Westmarch has won by holding the Marches. Human roads run from the river to the mountains, but Karrak still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "brunna", t: "Write it as a debt, Uncle. Not a grudge.", alt: { s: "sigrun", t: "Write it as a debt, Uncle." } },
      { n: "A Wolf Rider on a big grey dire wolf is knocking at the gate. He says he's heard Karrak is hiring caravan guards.", req: { winner: "orc" } },
      { s: "brunna", t: "…Let him in. Walls first. Then we talk wages.", req: { winner: "orc" } },
    ],
  },
};
