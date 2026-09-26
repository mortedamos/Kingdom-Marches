/**
 * STORY SCENARIO -- dwarf/halfellow+human+orc, "The Ledger and the Axe"
 * Money (Westmarch), food (the Halfellows) and war (the Orcs) against the
 * stone. Brunna has to learn which of the three Karrak can live without --
 * and whether it can live without its daughter's trust. Threads: the
 * lovers (shared B5 / lovers:meet). Shared defaults: shared/dwarf.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/halfellow+human+orc"] = {
  title: "The Ledger and the Axe",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast gathers her family: her wife Kazra the runesmith, her uncle Oskar with the Book of Grudges, and her daughter Sigrun, a Metal Singer." },
      { s: "oskar", t: "The closing clause, Thane: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "oskar", t: "And three neighbours. Westmarch owes us money, for their Dawn Cathedral. The halfellows sell us our bread and barley. And the Orcs want everything we have.", m: "grudging" },
      { s: "brunna", t: "The ledger, the larder and the axe. Karrak can't live without the first two, and can't live *with* the third.", m: "proud" },
      { n: "In Westmarch, Queen Maren Ashcroft reads Karrak's demand for the Cathedral debt. In the Hearthlands, Mayor Hobby Trickgrin raises the price of barley. In the Bloodmire, the Orc Warchief Grukka hears that the dwarves' doors are open." },
      { s: "maren", t: "We'll pay the Dwarves in gold and ward-work. Not one field.", m: "resolute" },
      { s: "hobby", t: "Barley's gone up, Goldie. War prices.", m: "scheming" },
      { s: "grukka", t: "Dwarves, bread, and human gold, all in one place. The clans will eat for a year.", m: "defiant" },
      { n: "Back in Karrak, Sigrun has gone very quiet at the word *Orcs*." },
      { s: "sigrun", t: "Mother, the orcs at the Midsummer Fair… they weren't all like the stories.", m: "sad" },
      { s: "brunna", t: "They were orcs, Sigrun.", m: "angry" },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, hunting for the right rock to raise a second hold on." },
      { s: "brunna", t: "A second hold. Granaries first this time, Uncle. Then walls. We can't eat walls.", m: "proud" },
      { s: "oskar", t: "I've never heard you say *then walls*, Thane.", m: "happy" },
      { s: "brunna", t: "Don't get used to it.", m: "proud" },
    ],
    B2: [
      { n: "The barley fields of the Hearthlands, at dawn. Dwarf and halfellow warriors have clashed.", req: { firstBlood: "halfellow" } },
      { n: "The river crossings, at dusk. Dwarf and human soldiers have clashed over the Cathedral debt.", req: { firstBlood: "human" } },
      { n: "The bog's edge, at dawn. Dwarf and orc warriors have clashed, and the Mountain Wars have begun again.", req: { firstBlood: "orc" } },
      { s: "oskar", t: "First blood. Entry {grudge} in the Book of Grudges. And one for the ledger, too.", m: "grudging" },
      { s: "kazra", t: "I've started a Titan.", m: "focused", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { s: "brunna", t: "The ledger, the larder, or the axe. One of them was always going to bleed first.", m: "sad" },
    ],
    B3: [
      { n: "The Thane's Hall. Sigrun has been asking, for weeks, to lead a war-band of Metal Singers south toward the Orc bogs. Tonight she asks again." },
      { s: "sigrun", t: "Let me take the southern border, Mother. I know the ground. Better than anyone.", m: "fierce" },
      { s: "brunna", t: "How do you know the bog-edge better than my scouts, daughter?", m: "angry" },
      { n: "Sigrun doesn't answer. Oskar writes something in the Book, then very carefully crosses it out." },
      { s: "kazra", t: "Let her take it, Brunna. She'll keep it safer than you'd think.", m: "happy" },
    ],
    B6: [
      { n: "Night, on the walls of {capital}. Brunna finds her daughter alone, looking south toward the Orc bogs." },
      { s: "brunna", t: "I've spent this whole war deciding which of three things Karrak can live without. The gold. The bread. The Orcs.", m: "sad" },
      { s: "sigrun", t: "And?" },
      { s: "brunna", t: "I got it wrong. The thing I can't live without is *you* trusting me. So. Is he worth it?", m: "sad" },
      { s: "sigrun", t: "He's worth not killing, Mother. That's all I'm asking.", m: "sad" },
      { s: "brunna", t: "Then that's what I'll give you. Tell the boy to keep his wolf out of the granaries.", m: "happy" },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone. A human mage-tower keeps watch over it, a field of halfellow barley grows beside it, and nobody is raiding either." },
      { s: "stone", t: "HELD." },
      { s: "oskar", t: "The debt: paid. The tariff: struck out. Volume Seven: crossed out. The ledger balances, Thane. So does the Book.", m: "happy" },
      { n: "At the victory feast, Sigrun plays her song for Varg aloud for the first time. The Orc Warchief stands in the doorway, alone and unarmed.", req: { alive: "orc" } },
      { s: "grukka", t: "I heard there was singing. And that the halfellows brought the barley.", m: "happy", req: { alive: "orc" } },
      { s: "brunna", t: "Stay by the door, Warchief. The bread's halfellow, the ale's ours, and the chairs are human. Try all three.", m: "happy", req: { alive: "orc" } },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying every rival. The river cities, the meadows and the bog are all silent." },
      { s: "stone", t: "REMAINS." },
      { s: "oskar", t: "No gold owed. No bread to buy. No axe at the door. The ledger's empty, Thane.", m: "sad" },
      { s: "brunna", t: "Start a new book anyway. For what we owe.", m: "sad" },
      { n: "Sigrun does not come to the victory feast. At an Underway door on the edge of the ruined bogs, Moss the dire wolf lies down in front of a door that will never open again, and waits." },
    ],
    "E-Fallen": [
      { n: "Karrak has fallen. {capital} is the last dwarf stronghold standing, and it is surrounded." },
      { s: "kazra", t: "The last Titan's ready. I'll take it into the breach.", m: "focused", req: { unit: "self:runeforged_titan" }, alt: "I'll hold the breach myself." },
      { s: "brunna", t: "Stone remembers, Kazra.", m: "sad", alt: { s: "sigrun", t: "Stone remembers.", m: "sad" } },
      { n: "The Underways seal from within. The mountain goes dark." },
      { s: "maren", t: "We'll pay the Cathedral debt anyway.", m: "resolute", req: { conqueror: "human" } },
      { s: "hobby", t: "Leave a barrel at the door, Goldie. For when they come back out.", m: "sad", req: { conqueror: "halfellow" } },
      { s: "varg", t: "*(at the bog-edge)* Moss knows the way. There's no one at the end of it anymore.", m: "sad", req: { conqueror: "orc" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Orcs have won by holding the Marches, but Karrak still stands.", req: { winner: "orc" } },
      { n: "The Halfellows have won by holding the Marches, but Karrak still stands.", req: { winner: "halfellow" } },
      { n: "Westmarch has won by holding the Marches, but Karrak still stands.", req: { winner: "human" } },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "brunna", t: "Write it in the ledger, Uncle. Not the Book. It's a debt.", m: "proud" },
      { n: "A Wolf Rider is knocking at the gate.", req: { winner: "orc" } },
      { s: "brunna", t: "Well? Let him in. Walls first. Then we talk.", m: "happy", req: { winner: "orc" } },
    ],
  },
};
