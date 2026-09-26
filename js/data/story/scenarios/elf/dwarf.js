/**
 * STORY SCENARIO -- elf/dwarf, "The Rootcut"
 * The dwarf tunnels are open again beneath the Silverwood, eight hundred
 * years after a grove of elder trees died above them. Vaelis would seal the
 * Holds with no more thought than closing a door; Aelthir remembers the
 * grove. Oskar's runes may reveal the grove died from the Marchstone's own
 * roots -- if so, the Silverwood's oldest grudge was a mistake.
 * Shared defaults: js/data/story/shared/elf.js. Bible §9.2.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/dwarf"] = {
  title: "The Rootcut",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood: the last living witness of the day the Long Accord was sworn over that stone." },
      { s: "aelthir", t: "I held the torch when they swore it. A thousand years of peace. Broken in a night.", m: "sad" },
      { n: "Beside him stand his niece Ysolde, the Archdruid, who speaks for the trees, and his grand-nephew and heir, Lord Vaelis Nightbloom, immaculate in polished mythril." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "uncanny" },
      { s: "vaelis", t: "Then the Silverwood holds them. Who else is there? The mud-folk?", m: "aloof" },
      { s: "ysolde", t: "The roots at the eastern edge are trembling, my son. Something is digging beneath them.", m: "uncanny" },
      { n: "Far to the east, in Karrak, the Dwarves' mountain realm, the Underways, the old dwarf tunnels beneath the Marches, have cracked open with the stone." },
      { s: "aelthir", t: "The Rootcut. Eight hundred years ago, dwarf tunnels ran beneath a grove of our elder trees, and every one of them died from the roots up.", m: "wistful" },
      { s: "vaelis", t: "Then let us finish what the mud-folk started, great-uncle. Seal their holes. The world will be quieter.", m: "aloof" },
      { s: "aelthir", t: "*(quietly)* I stood in that grove, Vaelis. It never *felt* like dwarves.", m: "wistful" },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted at the forest's edge.", req: { cities: 2 },
        alt: "Elf druids walk the forest's edge, choosing where a second grove-town will grow." },
      { s: "vaelis", t: "A grove, on the eastern edge. Facing the mud-folk. Let them see what they will never have.", m: "aloof" },
      { s: "ysolde", t: "The trees there are uneasy. They can hear digging.", m: "uncanny" },
      { s: "aelthir", t: "Then post rangers in the treetops, and let no tunnel come within a mile of a root.", m: "angry" },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Elf and dwarf warriors have clashed for the first time since the Accord." },
      { s: "aelthir", t: "First blood. Theirs and ours. I will remember every name, Vaelis. Even theirs.", m: "sad" },
      { s: "vaelis", t: "You mourn the mud-folk, great-uncle? They would not mourn *you*.", m: "aloof" },
      { s: "aelthir", t: "They have a book for their grudges. I have only my memory. Mine is longer.", m: "wistful" },
      { n: "In Karrak, the Dwarves' Loremaster Oskar opens an iron-bound tome, the Book of Grudges, to its very first page." },
      { s: "oskar", t: "Entry the First: the Rootcut. Reopened.", m: "grudging" },
    ],
    B4: [
      { n: "Beneath the Heartwood, Ysolde kneels among its roots with her eyes closed. She has been listening for three days." },
      { s: "ysolde", t: "The stone did not break, Warden. It *sighed*. And its roots run under half the Marches. Under the old Rootcut grove, too.", m: "uncanny" },
      { s: "aelthir", t: "…Its roots.", m: "sad" },
      { s: "ysolde", t: "When the stone drew power to hold the Accord, it drank that grove dry. The dwarves' tunnels never killed a thing. It was the *stone*, Warden.", m: "uncanny" },
      { n: "A dwarf herald arrives the next morning under a white flag, carrying rune-rubbings that say the same. Lord Vaelis reads them, and hands them back." },
      { s: "vaelis", t: "How thorough. Tell your Thane we are not interested in being *right*, herald. We are interested in being rid of you.", m: "aloof" },
      { s: "aelthir", t: "*(after the herald has gone)* We blamed them for eight hundred years, Vaelis.", m: "sad" },
      { s: "vaelis", t: "Then we have eight hundred years of practice, great-uncle. It would be a shame to waste it.", m: "aloof" },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. Aelthir has the dwarf rune-rubbings spread across the roots, and has read them a hundred times." },
      { s: "aelthir", t: "I owe the Holds of Karrak an apology, Ysolde. The oldest one in the Marches.", m: "sad" },
      { s: "ysolde", t: "Then give it, Warden. The trees would like to hear it.", m: "happy" },
      { s: "vaelis", t: "An apology from the Silverwood, to the mud-folk, in the middle of a war. Great-uncle, the Conclave will think you *senile*.", m: "angry" },
      { s: "aelthir", t: "The Conclave, Vaelis, may think what it likes. I stood in that grove.", m: "wistful" },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders. At the split Marchstone, Aelthir lays his hand on the stone and names every long-dead signatory of the Accord, one by one." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis.", m: "happy" },
      { s: "vaelis", t: "You would give the Silverwood to a woman who talks to *puddles*.", m: "angry" },
      { s: "ysolde", t: "And they, my son, have a great deal to say about you.", m: "uncanny" },
      { n: "A letter leaves the Heartwood for Karrak, sealed in moon-silver wax.", req: { alive: "dwarf" } },
      { s: "aelthir", t: "“I stood in that grove. I should have listened. I am sorry.”", m: "sad", req: { alive: "dwarf" } },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying the Dwarves. The mountains of Karrak are silent." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "The mud-folk, gone. The Rootcut, avenged. They ended, as brief things do.", m: "aloof" },
      { s: "aelthir", t: "It was never theirs to answer for, Vaelis. And now there is no one left to apologise to.", m: "sad" },
      { n: "Aelthir walks to the old Rootcut grove, where eight hundred years ago the trees died. A single sapling is growing there. He sits beside it until morning." },
    ],
    "E-Fallen": [
      { n: "The Dwarves have broken the Silverwood. The Heartwood still stands, and the forest is falling around it." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden. I have told them it is time.", m: "sad" },
      { n: "Beneath the Heartwood, Aelthir sits very still. The last witness of the Accord is going with it." },
      { s: "aelthir", t: "Tell the Thane of Karrak… it was never them. The grove. Tell her I knew.", m: "sad" },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly.", m: "aloof" },
      { n: "In the ruins, the Dwarves' Loremaster opens his Book of Grudges to its very first page." },
      { s: "oskar", t: "Entry the First. The Rootcut. …Struck out. Too late. It's always too late.", m: "sad" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches. A ring of dwarf stonework circles the Marchstone, but the Silverwood still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "The Dwarves hold the stone they cut. Perhaps that is fitting. I will witness their Accord. The second of my life.", m: "wistful" },
      { s: "vaelis", t: "You will *witness* the mud-folk's treaty, great-uncle? I shall be elsewhere. Anywhere.", m: "aloof" },
      { s: "ysolde", t: "Then I shall go with the Warden, my son. The trees want to see the stone kept by the people who were blamed for them.", m: "uncanny" },
    ],
  },
};
