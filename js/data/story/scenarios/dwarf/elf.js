/**
 * STORY SCENARIO -- dwarf/elf, "Entry the First"
 * The Rootcut, from the dwarf side: eight hundred years ago a grove of elder
 * trees died above Karrak's tunnels, and the Elves have blamed Karrak ever
 * since -- the first entry in the Book of Grudges. Oskar's runes can prove
 * the grove died from the Marchstone's roots instead; Vaelis could not care
 * less. Shared defaults: js/data/story/shared/dwarf.js. Bible §9.3.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/elf"] = {
  title: "Entry the First",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast steadies herself against a pillar. Her wife, the runesmith Kazra Emberdeep, climbs up from the forges." },
      { s: "kazra", t: "The Deep is shaking, Brunna. Every forge in the mountain just went cold." },
      { s: "brunna", t: "The Marchstone has split. The great stone our ancestors cut from under this mountain and lent to the Long Accord. A thousand years of peace, gone." },
      { n: "Brunna's uncle, Loremaster Oskar Grimgate, arrives hugging the Book of Grudges, the iron-bound tome where the Dwarves record every wrong ever done to them." },
      { s: "oskar", t: "The closing clause stands, Thane: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "brunna", t: "Then Karrak holds. We cut that stone. We lent it for a peace. The peace is over, and I'll have our Heartstone back." },
      { s: "oskar", t: "The Silverwood will want it too. The Elves." },
      { n: "Oskar opens the Book to its very first page. The ink there is eight hundred years old." },
      { s: "oskar", t: "Entry the First in the Book of Grudges: *the Rootcut*. A grove of the Elves' elder trees died above our tunnels, and they blamed the whole of Karrak for it. They never once let us prove otherwise." },
      { n: "Far to the west, beneath the Heartwood, the great tree at the heart of the Silverwood, the Warden Aelthir Moonveil feels the stone split too. Beside him stands his heir, Lord Vaelis Nightbloom." },
      { s: "aelthir", t: "Karrak will march. I remember the Rootcut, Vaelis. I stood in that dying grove." },
      { s: "vaelis", t: "Then let us finish what the mud-folk started, great-uncle. Seal their holes. The world will be quieter." },
      { n: "Back in Karrak, Sigrun, the Thane's daughter and a Metal Singer, swings her axe-guitar onto her back." },
      { s: "sigrun", t: "Elves! Finally, someone worth writing a war-song about." },
      { s: "kazra", t: "Walls first, love." },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, hunting for the right rock to raise a second hold on." },
      { s: "brunna", t: "A second hold. Stone foundations, a proper cellar, and good thick walls. Nowhere near a tree." },
      { s: "oskar", t: "The clan-moot asks whether *nowhere near a tree* is policy, Thane." },
      { s: "brunna", t: "It is now." },
      { n: "Far to the west, an elf scout in the treetops watches the masons at work and sends word to the Silverwood." },
      { s: "vaelis", t: "They are digging again. Of course they are. It is the only thing they know how to do." },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Dwarf and elf warriors have clashed for the first time since the Accord." },
      { s: "oskar", t: "First blood with the Silverwood. I'll add it under Entry the First. It's a *long* entry now." },
      { s: "kazra", t: "I've started a Titan.", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { n: "Beneath the Heartwood, Lord Vaelis reads the report of the skirmish with visible boredom." },
      { s: "vaelis", t: "The mud-folk fight the way they dig: slowly, loudly, and in the dark." },
      { s: "ysolde", t: "The oaks at the eastern edge would like to walk against them, my son." },
      { s: "vaelis", t: "Let them walk, mother. I shall watch from somewhere clean." },
    ],
    B3: [
      { n: "The Thane's Hall, late at night. Oskar has covered the war table with maps of the old tunnels beneath the Rootcut grove." },
      { s: "oskar", t: "Thane, I've been reading the old mining records. Our tunnels under that grove were shallow. *Shallow*. Too shallow to kill an oak's roots." },
      { s: "brunna", t: "Then what killed the grove, Uncle?" },
      { s: "oskar", t: "I don't know yet. But it wasn't us. Eight hundred years, and it *wasn't us*." },
      { s: "sigrun", t: "Then tell them! March up to the Heartwood and read it to them!" },
      { s: "brunna", t: "Proof first, daughter. Then walls. Then we'll see who needs telling." },
    ],
    B4: [
      { n: "At the heart of the Marches, Oskar kneels beside the split Marchstone, tracing the deep runes carved into its base." },
      { s: "oskar", t: "The stone is *rooted*, Thane. Its veins run under half the Marches. Move it, and it dies." },
      { s: "brunna", t: "…So the Heartstone can never come home." },
      { s: "oskar", t: "There's more. The roots run straight under the old Rootcut grove. When the stone drew power to hold the Accord, it drank that grove dry. Our tunnels never killed a thing." },
      { n: "Oskar opens the Book of Grudges to its very first page, and his hand is shaking." },
      { s: "oskar", t: "Eight hundred years. It was the *stone*." },
      { n: "Far to the west, the news reaches the Silverwood by a dwarf herald under a white flag. Lord Vaelis reads the rune-proof, and hands it back." },
      { s: "vaelis", t: "How thorough. Do tell your Thane we are not interested in being *right*, herald. We are interested in being rid of you." },
      { s: "aelthir", t: "*(quietly, after the herald has gone)* …I stood in that grove, Vaelis. It never felt like dwarves." },
    ],
    B6: [
      { n: "Night, on the walls of {capital}. Brunna finds Oskar alone, the Book of Grudges open to its first page." },
      { s: "oskar", t: "I could strike it out, Thane. Entry the First. We *know* now. The Elves just won't hear it." },
      { s: "brunna", t: "Then strike it out anyway, Uncle. We don't keep grudges for them. We keep them for us.", alt: { s: "sigrun", t: "Then strike it out anyway, Uncle. Mother would have. We don't keep grudges for them." } },
      { s: "oskar", t: "…Not yet. When this is over. When it's *held*." },
      { s: "kazra", t: "Then let's get it held." },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone. Karrak did not carry the stone home. It guards the stone where it stands." },
      { s: "stone", t: "HELD." },
      { n: "Oskar opens the Book of Grudges to its very first page." },
      { s: "oskar", t: "Entry the First: *the Rootcut*. Struck out. Not because they forgave us. Because it was never ours." },
      { n: "A letter arrives from the Silverwood, sealed in moon-silver wax. It is from the Warden, Aelthir Moonveil, and it is one line long." },
      { s: "aelthir", t: "“I stood in that grove. I should have listened. I am sorry.”" },
      { s: "brunna", t: "…Frame that, Uncle.", alt: { s: "sigrun", t: "…Frame that, Uncle. Mother would've." } },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying the Elves. The Silverwood is silent." },
      { s: "stone", t: "REMAINS." },
      { s: "oskar", t: "Entry the First, Thane. The Rootcut. There's no one left to prove it to." },
      { s: "brunna", t: "Strike it out anyway.", alt: { s: "sigrun", t: "Strike it out anyway, Uncle." } },
      { s: "oskar", t: "I can't. It isn't settled. It's just *over*. Those aren't the same thing." },
      { n: "Where the Heartwood stood, the dwarves find a single sapling growing in the ashes. Kazra puts a small stone wall around it, and says nothing." },
    ],
    "E-Fallen": [
      { n: "The Elves have broken the Dwarves. {capital} is the last dwarf stronghold standing, and the forest is closing around it." },
      { s: "kazra", t: "The last Titan's ready. I'll take it into the breach.", req: { unit: "self:runeforged_titan" }, alt: "I'll hold the breach myself. The hammer's still warm." },
      { s: "brunna", t: "Stone remembers, Kazra.", alt: { s: "sigrun", t: "Stone remembers, Mother Kazra." } },
      { s: "oskar", t: "One last entry in the Book of Grudges. Then it goes to the deepest vault, for whoever comes after." },
      { n: "The Underways seal from within. The mountain goes dark." },
      { n: "In the ruins, Lord Vaelis turns over a fallen Book of Grudges with the toe of his boot, and finds his own name inside. Thirty-seven times." },
      { s: "vaelis", t: "Thirty-seven. I am *flattered*." },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Elves have won by holding the Marches. The forest has walked back over the old borders, but Karrak still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "brunna", t: "The Silverwood holds the Marches. Write it as a debt, Uncle, not a grudge. We'll pay it back.", alt: { s: "sigrun", t: "The Silverwood holds the Marches. Write it as a debt, Uncle. We'll pay it back. Loudly." } },
      { s: "oskar", t: "And Entry the First?" },
      { s: "brunna", t: "Send the rune-proof to the Warden. Every year. Until he reads it.", alt: { s: "sigrun", t: "Send the rune-proof to the Warden. Every year. Until he reads it." } },
    ],
  },
};
