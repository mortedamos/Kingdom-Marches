/**
 * STORY SCENARIO -- elf/dwarf+human, "Axe and Pick"
 * The two peoples who cut, above ground and below: human axes, dwarf picks.
 * The Cathedral debt sets Dwarves and Humans against each other too, and
 * Vaelis suggests, idly, that they be allowed to exhaust each other -- then
 * helps them along (the Whispering War). Threads: the bloodline, mercy.
 * Shared defaults: js/data/story/shared/elf.js. Bible §9.2.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/dwarf+human"] = {
  title: "Axe and Pick",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, the last living witness of the Long Accord, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "uncanny" },
      { s: "ysolde", t: "The trees are frightened, Warden. Axes to the west. Picks to the east.", m: "sad" },
      { s: "vaelis", t: "Westmarch and Karrak. The two peoples who cut. One from above, one from below. Everyone wants a piece of the trees today.", m: "aloof" },
      { s: "aelthir", t: "And they owe each other money. The Humans' Dawn Cathedral was built on dwarf credit.", m: "wistful" },
      { s: "vaelis", t: "Then let the creditor and the debtor exhaust each other, great-uncle. I shall help, if they need encouragement.", m: "aloof" },
      { n: "In Westmarch, Queen Maren Ashcroft sends Collegium scholars to measure the silver trees. In Karrak, High Thane Brunna Stonefast plans tunnels beneath the forest. Neither has asked it." },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted where the human scholars' camps and the dwarves' tunnels would meet.", req: { cities: 2 },
        alt: "Elf druids choose where a second grove-town will grow: exactly where the human scholars' camps and the dwarves' tunnels would meet." },
      { s: "vaelis", t: "Let them both come. They can argue about whose axe gets there first.", m: "aloof" },
      { s: "ysolde", t: "The roots there are very deep, my son. Deeper than any pick.", m: "uncanny" },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Elf rangers have clashed with dwarf warriors.", req: { firstBlood: "dwarf" },
        alt: "The forest's edge, at dusk. Elf rangers have clashed with human woodcutters and their guards." },
      { s: "aelthir", t: "First blood. I will remember every name. Even theirs.", m: "sad" },
      { s: "vaelis", t: "The mud-folk, first. They always did dig their own graves.", m: "aloof", req: { firstBlood: "dwarf" }, alt: "The mayflies, first. They always were in a hurry." },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. Vaelis has laid out a map. Pins mark every battle between Westmarch and Karrak this season." },
      { s: "vaelis", t: "Eleven battles, great-uncle. Axe against pick. And not one of them near a tree.", m: "happy" },
      { s: "aelthir", t: "And how many of those battles began with a letter sealed in silver leaves, Vaelis?", m: "angry" },
      { s: "vaelis", t: "*(after a pause)* …Some." },
      { s: "aelthir", t: "Then you have saved the forest by feeding them to each other. And I can never thank you for it without shame.", m: "sad" },
      { s: "vaelis", t: "I did not ask for thanks, great-uncle. I asked for *results*.", m: "aloof" },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders. The human scholars stop at a wall of oaks; the dwarves' tunnels end at roots older than their mountains." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis.", m: "happy" },
      { s: "vaelis", t: "After everything I did for this forest? You would give it to a woman who talks to *puddles*.", m: "angry" },
      { s: "ysolde", t: "Yes, my son. *Because* of everything you did.", m: "uncanny" },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying Westmarch and Karrak. No axe or pick will ever touch the forest again." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "The two peoples who cut, cut down. They ended, as brief things do.", m: "aloof" },
      { s: "aelthir", t: "You fed them to each other, Vaelis. You made it *look* like they did it themselves.", m: "angry" },
      { s: "vaelis", t: "I made it *easy* for them, great-uncle. There is a difference. …Isn't there?", m: "sad" },
      { n: "For the first time in six hundred years, Lord Vaelis Nightbloom does not sound entirely sure of himself." },
    ],
    "E-Fallen": [
      { n: "The Silverwood has fallen. Axes and picks have reached the Heartwood, and {capital} is lost." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden.", m: "sad" },
      { s: "aelthir", t: "Tell them both, the Queen and the Thane: it was never the trees' quarrel.", m: "sad" },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly.", m: "aloof" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "Westmarch has won by holding the Marches, but the Silverwood still stands.", req: { winner: "human" },
        alt: "The Dwarves have won by holding the Marches, but the Silverwood still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "One of the peoples who cut holds the Marches now. I will witness their Accord, and I will make sure it has a clause about trees.", m: "wistful" },
      { s: "vaelis", t: "A *long* clause, great-uncle. With footnotes.", m: "aloof" },
    ],
  },
};
