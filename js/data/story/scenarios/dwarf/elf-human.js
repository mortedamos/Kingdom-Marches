/**
 * STORY SCENARIO -- dwarf/elf+human, "Creditors and Grudges"
 * One rival owes Karrak money (Westmarch, the Cathedral debt); the other owes
 * it an apology (the Silverwood, the Rootcut). Brunna tries to collect both.
 * THREAD (bible §13.9, The Thane Falls): B5 is Brunna's death on the walls;
 * Sigrun becomes High Thane for the rest of the game. Human+Elf lineups also
 * carry the bloodline rumour (shared.any).
 * Shared defaults: js/data/story/shared/dwarf.js. Bible §9.3.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/elf+human"] = {
  title: "Creditors and Grudges",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast gathers her family: her wife Kazra the runesmith, her uncle Oskar with the Book of Grudges, and her daughter Sigrun, a Metal Singer." },
      { s: "oskar", t: "The Accord's closing clause, Thane: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "brunna", t: "Then Karrak holds. And Karrak collects." },
      { s: "oskar", t: "Two accounts outstanding. Westmarch, the Humans: the Dawn Cathedral debt, four hundred years of interest. The Silverwood, the Elves: Entry the First, the Rootcut, eight hundred years unapologised." },
      { s: "brunna", t: "One owes us gold. One owes us an apology. I'll take either. I'll take both." },
      { n: "In Westmarch, Queen Maren Ashcroft reads Karrak's letter while her brother Aldric, of the Temple, fumes." },
      { s: "aldric", t: "The Dwarves demand payment for the house of the Dawn!" },
      { s: "corvin", t: "The Temple signed it, Lord-Paladin. You'll find God rarely co-signs." },
      { n: "In the Silverwood, the Warden Aelthir hears of Karrak's demands. His heir, Lord Vaelis, laughs for the first time in a decade." },
      { s: "vaelis", t: "An *apology*. From the Silverwood. To the mud-folk. Great-uncle, may I write it myself? I should like it to be very short." },
      { s: "sigrun", t: "*(in Karrak)* So we're fighting a bank and a forest. Brilliant. I'll need a louder axe." },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, hunting for the right rock to raise a second hold on." },
      { s: "brunna", t: "A second hold. A proper cellar, good walls, and a vault for what we're owed." },
      { s: "kazra", t: "And a forge. You'll want a forge, for when they don't pay." },
      { s: "oskar", t: "Westmarch has replied, Thane. They offer to settle in *roads*. The Silverwood has replied too." },
      { s: "brunna", t: "And?" },
      { s: "oskar", t: "It's a single leaf. Unsigned. I believe it's rude." },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Dwarf and elf warriors have clashed for the first time since the Accord.", req: { firstBlood: "elf" },
        alt: "The river crossings below the mountains, at dusk. Dwarf and human soldiers have clashed over a surveyor's camp." },
      { s: "oskar", t: "First blood. Entry {grudge} in the Book of Grudges. The accounts are *open*." },
      { s: "kazra", t: "I've started a Titan.", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { s: "vaelis", t: "*(in the Silverwood)* The mud-folk came to collect. We have paid them in arrows. Tell them there is plenty more where those came from.", req: { firstBlood: "elf" } },
      { s: "aldric", t: "*(in Westmarch)* The Dawn guided our swords against the moneylenders!", req: { firstBlood: "human" } },
      { s: "corvin", t: "*(in Westmarch)* Those moneylenders built your Cathedral, Lord-Paladin. Pray more quietly.", req: { firstBlood: "human" } },
    ],
    B3: [
      { n: "The Thane's Hall, late at night. Oskar has split the Book of Grudges into two neat columns across the war table." },
      { s: "oskar", t: "Westmarch, left column: owes us four hundred years of interest. The Silverwood, right column: owes us eight hundred years of *sorry*." },
      { s: "sigrun", t: "Which one's bigger, Uncle?" },
      { s: "oskar", t: "The sorry. It always is." },
      { s: "brunna", t: "Then we collect the sorry first. Gold keeps. Pride doesn't." },
      { n: "Kazra watches her wife with an expression Oskar has never seen on her: worry." },
      { s: "kazra", t: "You've been on the walls every night this month, Brunna. Let someone else stand watch." },
      { s: "brunna", t: "A Thane stands on her own walls, love. Always has. Always will." },
    ],
    // THE THANE FALLS (bible §13.9)
    B5: [
      { n: "Night, and fire. Human knights assault the walls of {capital} while elven archers, Lord Vaelis's own Shadowsteed riders, shoot from the dark treeline beyond." },
      { n: "High Thane Brunna Stonefast stands on her own walls, as she always said she would, hammer raised, shouting orders over the din." },
      { s: "brunna", t: "Hold the gate! Walls first! Walls fir—" },
      { n: "An elven arrow, black-fletched, finds the gap beneath her collar. The Thane of Karrak falls without another word." },
      { fx: { kill: "brunna" } },
      { n: "At dawn, the attack has been thrown back. In the Thane's Hall, Brunna lies on the great stone table where she once planned every wall in Karrak. Kazra has not let go of her hand." },
      { s: "kazra", t: "Thirty years. She never once let someone else stand watch." },
      { n: "Oskar opens the Book of Grudges. For a long moment, he can't write anything at all." },
      { s: "oskar", t: "Entry {grudge} in the Book of Grudges. The Silverwood. For Brunna." },
      { n: "Then he closes the Book, turns to Sigrun, and kneels, which no one in Karrak has ever seen him do." },
      { s: "oskar", t: "The Thane is dead. Long live the Thane." },
      { fx: { name: { sigrun: "High Thane Sigrun Stonefast" }, title: { sigrun: "High Thane of Karrak" }, address: "Thane Sigrun", flag: "sigrunThane" } },
      { s: "sigrun", t: "…I'm not ready, Uncle. I'm a *singer*." },
      { s: "kazra", t: "Neither was she, once. Stand up, Thane. Your people are watching." },
      { s: "sigrun", t: "Then they'll hear me. All of them. *Walls first.*" },
    ],
    B6: [
      { n: "Night, on the walls of {capital}, on the very spot where her mother fell. High Thane Sigrun Stonefast stands watch alone, her axe-guitar silent." },
      { s: "sigrun", t: "Mother wanted the Heartstone back. Oskar says it's rooted now. That moving it would kill it." },
      { s: "kazra", t: "She'd worked that out, near the end. She'd stopped wanting to *own* it. She just wanted it *kept*." },
      { s: "sigrun", t: "Then that's what we'll do. Keep it. For her." },
      { s: "oskar", t: "And the accounts, Thane? The Cathedral. The Rootcut." },
      { s: "sigrun", t: "The Silverwood owes us a *Thane* now, Uncle. That goes at the top of both columns.", req: { flag: "sigrunThane" },
        alt: "Collect what's fair, Uncle. Not a copper more." },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone. On its largest stone, Kazra has carved a single name.", req: { charDead: "brunna" },
        alt: "A ring of dwarf stonework now circles the split Marchstone. Karrak guards the stone where it stands." },
      { s: "stone", t: "HELD." },
      { s: "sigrun", t: "It's held, Mother. We kept it. …I'm going to write you a song now. A really loud one.", req: { charDead: "brunna" },
        alt: { s: "brunna", t: "Held. Karrak keeps its word, Uncle. Close the accounts." } },
      { s: "oskar", t: "Westmarch has paid the Cathedral debt in full. The Silverwood has sent…", req: { alive: ["human", "elf"] } },
      { s: "aelthir", t: "*(by letter)* “Karrak was right about the Rootcut. I stood in that grove. I should have listened. I am sorry, for that and for your mother.”", req: { alive: "elf" } },
      { s: "oskar", t: "Entry the First. Struck out. *Finally*." },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying Westmarch and the Silverwood. Only one crown remains in the Marches." },
      { s: "stone", t: "REMAINS." },
      { s: "oskar", t: "Both accounts closed, Thane. The debt. The Rootcut. No one left to pay either." },
      { s: "sigrun", t: "Mother would've wanted them *paid*, Uncle. Not *gone*.", req: { charDead: "brunna" },
        alt: { s: "brunna", t: "I wanted them paid, Uncle. Not gone. …Start a new book anyway. For what we owe." } },
      { s: "kazra", t: "Stone endures. It's lonelier than I thought." },
    ],
    "E-Fallen": [
      { n: "Karrak has fallen. {capital} is the last dwarf stronghold standing, and both armies are at its gates." },
      { s: "kazra", t: "The last Titan's ready. I'll take it into the breach.", req: { unit: "self:runeforged_titan" }, alt: "I'll hold the breach myself." },
      { s: "sigrun", t: "Then I'll hold the wall. Where she did.", req: { charDead: "brunna" }, alt: { s: "brunna", t: "Stone remembers, Kazra." } },
      { s: "oskar", t: "One last entry. Against both of them. Then the Book goes to the deepest vault." },
      { n: "The Underways seal from within. The mountain goes dark." },
      { s: "maren", t: "*(in the ruins)* We'll pay the Cathedral debt anyway. To whoever's left. …And write it down.", req: { conqueror: "human" } },
      { s: "vaelis", t: "*(in the ruins)* The mud-folk, sealed in their holes. The Rootcut is finally avenged. I feel nothing. How disappointing.", req: { conqueror: "elf" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "Westmarch has won by holding the Marches. Human roads run from the river to the mountains, but Karrak still stands.", req: { winner: "human" },
        alt: "The Silverwood has won by holding the Marches. The forest has walked back over the old borders, but Karrak still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "sigrun", t: "We didn't hold it, Mother. But we're still here. That has to count for something.", req: { charDead: "brunna" },
        alt: { s: "brunna", t: "Write it as a debt, Uncle. Not a grudge. We'll pay it back." } },
      { s: "oskar", t: "As a debt, Thane. The first one Karrak ever *owed*." },
    ],
  },
};
