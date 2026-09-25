/**
 * STORY SCENARIO -- dwarf/elf+human+orc, "The Underways Hold"
 * Three rivals each claim the land above Karrak, and the Underways are both
 * Karrak's lifeline and Sigrun's escape route. THREADS COLLIDE (bible §5 +
 * §13.9): at B5 Brunna follows Sigrun into the Underways, discovers the
 * lovers, and dies shielding both from Skarra's war-band. Sigrun becomes
 * High Thane -- in love with the Warchief's son, whose people killed her
 * mother, and who carried her mother home.
 * Shared defaults: js/data/story/shared/dwarf.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/elf+human+orc"] = {
  title: "The Underways Hold",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast gathers her family: her wife Kazra the runesmith, her uncle Oskar with the Book of Grudges, and her daughter Sigrun, a Metal Singer." },
      { s: "oskar", t: "The closing clause, Thane: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "kazra", t: "And the Underways, Brunna. The old tunnels beneath the Marches. The split cracked their seals. Every one of them is open again." },
      { s: "brunna", t: "Then Karrak can be anywhere in the Marches by morning. And so can anyone who finds a door." },
      { n: "Three rivals stir. In the Silverwood, the Elf heir Lord Vaelis smiles thinly at the news. In Westmarch, the Human Queen Maren reads Karrak's demand for the Dawn Cathedral debt. In the Bloodmire, the Orc Warchief Grukka sharpens his axe." },
      { s: "vaelis", t: "Dwarves, Humans and Orcs. Three quarrels to tend. I shall be *so* busy." },
      { s: "grukka", t: "The dwarves' doors are open. Doors break. Open ones break easier." },
      { n: "Back in Karrak, Sigrun has gone very quiet at the word *Orcs*." },
      { s: "sigrun", t: "Mother, the orcs at the Midsummer Fair… they weren't all like the stories." },
      { s: "brunna", t: "They were orcs, Sigrun." },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, hunting for the right rock to raise a second hold on." },
      { s: "brunna", t: "A second hold. And a guard on every Underway door within a day's walk of it." },
      { s: "kazra", t: "*(too quickly)* I'll see to the doors myself." },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Dwarf and elf warriors have clashed.", req: { firstBlood: "elf" } },
      { n: "The river crossings, at dusk. Dwarf and human soldiers have clashed.", req: { firstBlood: "human" } },
      { n: "The bog's edge, at dawn. Dwarf and orc warriors have clashed, and the Mountain Wars have begun again.", req: { firstBlood: "orc" } },
      { s: "oskar", t: "First blood. Entry {grudge} in the Book of Grudges." },
      { s: "kazra", t: "I've started a Titan.", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { s: "brunna", t: "Three enemies, and a hundred open doors. Walls first, Uncle. And locks." },
    ],
    B3: [
      { n: "The Thane's Hall, late at night. Oskar has marked every Underway door on the war table. One of them, near the Orc bogs, has fresh boot-prints and wolf-prints, side by side." },
      { s: "oskar", t: "Somebody's using the bog-door, Thane. A dwarf. And a *wolf*." },
      { s: "brunna", t: "Orc scouts. Double the guard." },
      { s: "kazra", t: "I'll see to it." },
      { n: "Oskar watches Kazra leave, and writes nothing down at all." },
    ],
    // THE THANE FALLS + THE LOVERS (bible §5, §13.9)
    B5: [
      { n: "Midnight, in the Underways beneath the Orc bogs. Brunna Stonefast has followed the boot-prints herself, hammer in hand." },
      { n: "At the bog-door she finds her daughter, and an orc: Varg Ironjaw, the Warchief's son, with his grey dire wolf Moss at his side. They are holding hands." },
      { s: "brunna", t: "*Sigrun*." },
      { s: "sigrun", t: "Mother— his name is Varg. Since the Midsummer Fair. He isn't what they say—" },
      { n: "Green light flares in the tunnel behind them: Wisps, the spirit-lights of the orc Bog Witch Skarra. She has followed her nephew, and she has brought a war-band." },
      { s: "skarra", t: "The Warchief's son and the Thane's girl! TOGETHER! And the Thane HERSELF! Oh, the ancestors are *generous* tonight!" },
      { s: "brunna", t: "Behind me. *Both* of you." },
      { n: "The High Thane of Karrak holds the tunnel alone, hammer against the whole war-band, long enough for Varg to drag Sigrun through the door. She does not follow them." },
      { fx: { kill: "brunna" } },
      { n: "At dawn, an orc Wolf Rider walks up to the gates of {capital}, unarmed, carrying the High Thane's body in his arms. His wolf walks behind him, head low." },
      { s: "varg", t: "She saved us. Both of us. My aunt did this. My *family* did this. I'm sorry. I'm so sorry." },
      { n: "Kazra takes her wife from the orc's arms. She looks at Varg for a long moment, then at Sigrun, and says the words to both of them." },
      { s: "kazra", t: "I knew. I forged the locks on those doors. I knew, and I didn't tell her. I lost a brother to this feud, and now I've lost a wife." },
      { s: "oskar", t: "The Thane is dead. Long live the Thane." },
      { fx: { name: { sigrun: "High Thane Sigrun Stonefast" }, title: { sigrun: "High Thane of Karrak" }, address: "Thane Sigrun", flag: "sigrunThane" } },
      { s: "sigrun", t: "Let him go, Uncle. He carried her home. Karrak doesn't punish the ones who carry us home." },
    ],
    B6: [
      { n: "Night, on the walls of {capital}. High Thane Sigrun Stonefast stands where her mother used to, looking south toward the Orc bogs." },
      { s: "oskar", t: "The Orcs killed your mother, Thane. The clan-moot wants Volume Seven *finished*." },
      { s: "sigrun", t: "The *Bog Witch* killed my mother, Uncle. And the Warchief's son carried her home. I'll finish Skarra. I won't finish *him*." },
      { s: "kazra", t: "That's not a Thane's answer." },
      { s: "sigrun", t: "It's *my* answer, Mother Kazra. It'll have to be a Thane's now." },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone. On its largest stone, Kazra has carved a single name.", req: { charDead: "brunna" },
        alt: "A ring of dwarf stonework now circles the split Marchstone. Karrak guards the stone where it stands." },
      { s: "stone", t: "HELD." },
      { s: "sigrun", t: "Held, Mother. You held the tunnel. I held the rest.", req: { charDead: "brunna" }, alt: { s: "brunna", t: "Held. Close the book, Uncle." } },
      { n: "At the victory feast, the High Thane plays the song she wrote for Varg, aloud, for the first time. An orc Wolf Rider stands in the doorway, alone and unarmed.", req: { alive: "orc", charDead: "brunna" } },
      { s: "varg", t: "I heard there was singing.", req: { alive: "orc", charDead: "brunna" } },
      { s: "kazra", t: "Stay by the door, boy. …She'd have said that. Then she'd have let you in.", req: { alive: "orc", charDead: "brunna" } },
      { s: "oskar", t: "Volume Seven. The last page. *(A long pause.)* Crossed out. For the one who carried her home." },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying every rival. The forest, the river roads and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { s: "oskar", t: "Every book closed, Thane." },
      { s: "sigrun", t: "Every book, Uncle. Even the one I didn't want closed.", req: { charDead: "brunna" }, alt: { s: "brunna", t: "Start a new book anyway." } },
      { n: "At an Underway door on the edge of the ruined bogs, Moss the dire wolf lies down in front of a door that will never open again, and waits. Sometimes, at night, the High Thane goes down and sits with him." },
    ],
    "E-Fallen": [
      { n: "Karrak has fallen. {capital} is the last dwarf stronghold standing, and every door in the Underways is breached." },
      { s: "kazra", t: "The last Titan's ready. I'll take it into the breach.", req: { unit: "self:runeforged_titan" }, alt: "I'll hold the breach myself." },
      { s: "sigrun", t: "Then I'll hold the wall. Where she would have.", req: { charDead: "brunna" }, alt: { s: "brunna", t: "Stone remembers, Kazra." } },
      { n: "The Underways seal from within, one door at a time. The mountain goes dark." },
      { s: "skarra", t: "The Thane AND the mountain! Skarra has had a VERY good war!", req: { conqueror: "orc" } },
      { s: "varg", t: "*(at the bog-door)* Moss knows the way. There's no one at the end of it anymore.", req: { alive: "orc" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Orcs have won by holding the Marches, but Karrak still stands.", req: { winner: "orc" } },
      { n: "The Silverwood has won by holding the Marches, but Karrak still stands.", req: { winner: "elf" } },
      { n: "Westmarch has won by holding the Marches, but Karrak still stands.", req: { winner: "human" } },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "sigrun", t: "Write it as a debt, Uncle. Mother would have.", req: { charDead: "brunna" }, alt: { s: "brunna", t: "Write it as a debt, Uncle. Not a grudge." } },
      { n: "A Wolf Rider is knocking at the gate. He has brought flowers for a grave.", req: { alive: "orc", charDead: "brunna" } },
    ],
  },
};
