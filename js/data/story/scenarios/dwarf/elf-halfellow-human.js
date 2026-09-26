/**
 * STORY SCENARIO -- dwarf/elf+halfellow+human, "The Surface Kingdoms"
 * All three rivals live under the open sky; Karrak is the lone deep folk.
 * The lore scenario: Oskar's rune reveal about the stone's roots plays
 * largest. THREAD (bible §13.9, The Thane Falls): Brunna dies at the
 * Marchstone at B5 defending the rune-readers; Sigrun becomes High Thane.
 * Also carries the bloodline rumour and Vaelis's whispers (shared.any).
 * Shared defaults: js/data/story/shared/dwarf.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/elf+halfellow+human"] = {
  title: "The Surface Kingdoms",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast gathers her family: her wife Kazra the runesmith, her uncle Oskar with the Book of Grudges, and her daughter Sigrun, a Metal Singer." },
      { s: "oskar", t: "The closing clause, Thane: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "kazra", t: "The Deep is shaking. Worse than the stone. Something under the Marches is moving.", m: "focused" },
      { s: "brunna", t: "Then we're the only ones who'll hear it. Everyone else lives on top.", m: "proud" },
      { s: "oskar", t: "Three surface kingdoms, Thane. The Elves' forest. The halfellows' meadows. Westmarch's mage-towers. They see the Marches. We see what's *under* them.", m: "grudging" },
      { n: "In the Silverwood, Lord Vaelis, heir to the Warden, reads a report of dwarf surveyors in the hills." },
      { s: "vaelis", t: "The mud-folk will dig. They always dig. Let them. We have three kingdoms to play against each other, and they have only rocks.", m: "aloof" },
      { n: "In Westmarch, Queen Maren Ashcroft is told the Dwarves have called in the Dawn Cathedral debt. In the Hearthlands, Mayor Hobby Trickgrin is told the ale tariff is dead." },
      { s: "maren", t: "Everyone wants something from the Marches. The Dwarves want what's underneath them. Remember that, Corvin. It worries me.", m: "resolute" },
      { s: "hobby", t: "The Dwarves never look up, dear. That's how you win against them. You stand on their roof.", m: "scheming" },
      { s: "brunna", t: "*(in Karrak)* Walls first. And somebody keep an eye on the roof.", m: "proud" },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, hunting for the right rock to raise a second hold on." },
      { s: "brunna", t: "A second hold. And a deep shaft beneath it. I want to know what's shaking down there." },
      { s: "kazra", t: "I'll go down myself.", m: "focused" },
      { s: "oskar", t: "Entry {grudge} in the Book of Grudges, pre-emptively: whatever's down there.", m: "grudging" },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Dwarf and elf warriors have clashed.", req: { firstBlood: "elf" } },
      { n: "The barley fields of the Hearthlands, at dawn. Dwarf and halfellow warriors have clashed.", req: { firstBlood: "halfellow" } },
      { n: "The river crossings below the mountains, at dusk. Dwarf and human soldiers have clashed.", req: { firstBlood: "human" } },
      { s: "oskar", t: "First blood with the surface. Entry {grudge} in the Book of Grudges.", m: "grudging" },
      { s: "kazra", t: "I've started a Titan.", m: "focused", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { s: "brunna", t: "Three kingdoms up there, and every one of them thinks the ground is just something to stand on.", m: "angry" },
    ],
    B3: [
      { n: "Kazra returns from the deep shaft beneath the new hold, soot-black, carrying a slab of black-veined granite that hums faintly in her hands." },
      { s: "kazra", t: "Roots, Brunna. Stone roots. The same black granite as the Marchstone, running under half the Marches. Like veins.", m: "focused" },
      { s: "oskar", t: "The Marchstone… has *roots*?", m: "sad" },
      { s: "kazra", t: "The Marchstone *is* roots. The bit on top is just the part you can see.", m: "focused" },
      { s: "brunna", t: "Then I need to read what's carved on it. At the stone itself. Uncle, pack your quills.", m: "proud" },
    ],
    B4: [
      { n: "At the heart of the Marches, Oskar kneels beside the split Marchstone, tracing the deep runes carved into its base. Brunna stands guard with her hammer; Kazra holds the lantern." },
      { s: "oskar", t: "It's all here, Thane. The stone was cut from under Karrak, yes. But it grew. A thousand years of holding five crowns apart, and it put down roots through the whole Marches." },
      { s: "oskar", t: "Move it, and it dies. Leave it, and it holds. *Held*, Thane. That's what the clause means. Not taken. *Held*.", m: "grudging" },
      { s: "brunna", t: "…So the Heartstone can never come home.", m: "sad" },
      { s: "kazra", t: "Then maybe home goes to it.", m: "focused" },
      { n: "Beyond the lantern-light, something moves in the long grass. The surface kingdoms have noticed dwarves at the Marchstone." },
    ],
    // THE THANE FALLS (bible §13.9)
    B5: [
      { n: "The Marchstone, at dawn. Oskar and Kazra have been reading the deep runes for three nights. Brunna has not slept once." },
      { n: "Out of the mist come riders: the surface kingdoms, come to stop the Dwarves claiming the stone. There are too many of them." },
      { s: "brunna", t: "Uncle. Kazra. Take the rune-rubbings and *run*. That's an order.", m: "proud" },
      { s: "kazra", t: "Brunna—", m: "sad" },
      { s: "brunna", t: "Karrak needs what's on those pages more than it needs me. Walls first, love. Today *I'm* the wall.", m: "proud" },
      { n: "The High Thane of Karrak holds the ground before the Marchstone alone, long enough for the others to reach the Underways. She does not follow them." },
      { fx: { kill: "brunna" } },
      { n: "In the Thane's Hall, Oskar lays the rune-rubbings on the great stone table. They are stained with the Marchstone's dust, and with something darker." },
      { s: "oskar", t: "She bought us every word on these pages. Entry {grudge} in the Book of Grudges: *the surface*. All of it.", m: "angry" },
      { n: "Then he turns to Sigrun, and kneels, which no one in Karrak has ever seen him do." },
      { s: "oskar", t: "The Thane is dead. Long live the Thane.", m: "sad" },
      { fx: { name: { sigrun: "High Thane Sigrun Stonefast" }, title: { sigrun: "High Thane of Karrak" }, address: "Thane Sigrun", flag: "sigrunThane" } },
      { s: "sigrun", t: "She told me once that a Thane stands on her own walls. I didn't know she meant *this*.", m: "sad" },
      { s: "kazra", t: "Stand up, Thane. Read what she died for. Then make them pay for it.", m: "angry" },
    ],
    B6: [
      { n: "Night, in the Thane's Hall of {capital}. High Thane Sigrun Stonefast has read the rune-rubbings through three times." },
      { s: "sigrun", t: "It says the stone is held by whoever keeps the Marches. Not owns. *Keeps*. Mother died for a sentence about gardening, Uncle.", m: "sad" },
      { s: "oskar", t: "She died for Karrak, Thane. The sentence was just where she was standing.", m: "sad" },
      { s: "sigrun", t: "Then Karrak keeps the Marches. All of it. The surface can look up at us for a change.", m: "fierce" },
      { s: "kazra", t: "*(quietly)* She'd have said that. Louder, but she'd have said it.", m: "sad" },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone, built over the roots Kazra found. On its largest stone, a single name is carved.", req: { charDead: "brunna" },
        alt: "A ring of dwarf stonework now circles the split Marchstone, built over the roots Kazra found." },
      { s: "stone", t: "HELD." },
      { s: "sigrun", t: "Held, Mother. Not owned. Held. You were right.", m: "sad", req: { charDead: "brunna" }, alt: { s: "brunna", t: "Held. Not owned. Uncle, put the rune-rubbings in the deepest vault.", m: "proud" } },
      { s: "oskar", t: "Entry the First: struck out. The ale tariff: struck out. The Cathedral debt: struck out. Three in one day.", m: "happy" },
      { s: "kazra", t: "The Deep's stopped shaking.", m: "happy" },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying every surface kingdom. Only Karrak remains." },
      { s: "stone", t: "REMAINS." },
      { s: "oskar", t: "Nobody left on the surface, Thane. Nobody left to look up at us.", m: "sad" },
      { s: "sigrun", t: "Then we'll have to go up there ourselves. Mother always hated the sun.", m: "fierce", req: { charDead: "brunna" }, alt: { s: "brunna", t: "Start a new book anyway, Uncle. For what we owe.", m: "sad" } },
      { s: "kazra", t: "The Deep's quiet. Too quiet.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The surface has broken Karrak. {capital} is the last dwarf stronghold standing, and it is surrounded." },
      { s: "kazra", t: "The last Titan's ready. I'll take it into the breach.", m: "focused", req: { unit: "self:runeforged_titan" }, alt: "I'll hold the breach myself." },
      { s: "oskar", t: "The rune-rubbings go to the deepest vault. With the Book. For whoever comes after.", m: "sad" },
      { n: "The Underways seal from within. The mountain goes dark." },
      { s: "vaelis", t: "*(in the ruins)* They sealed themselves in with their precious runes. How very *them*.", m: "aloof", req: { conqueror: "elf" } },
      { s: "hobby", t: "*(in the ruins)* Leave a barrel at the door, Goldie. For when they come back out.", m: "sad", req: { conqueror: "halfellow" } },
      { s: "maren", t: "*(in the ruins)* We'll pay the Cathedral debt anyway. To whoever's left.", m: "resolute", req: { conqueror: "human" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Silverwood has won by holding the Marches, but Karrak still stands.", req: { winner: "elf" } },
      { n: "The Halfellows have won by holding the Marches, but Karrak still stands.", req: { winner: "halfellow" } },
      { n: "Westmarch has won by holding the Marches, but Karrak still stands.", req: { winner: "human" } },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "sigrun", t: "Somebody on the surface holds it now. Send them the rune-rubbings, Uncle. They'll need them. They don't know what's underneath.", m: "sad", req: { charDead: "brunna" },
        alt: { s: "brunna", t: "Send them the rune-rubbings, Uncle. They don't know what's underneath.", m: "proud" } },
    ],
  },
};
