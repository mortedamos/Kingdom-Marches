/**
 * STORY SCENARIO -- elf/dwarf+halfellow+orc, "Deep, Bog and Burrow"
 * Everyone else lives under or beside the ground -- dwarf halls, orc bogs,
 * halfellow burrows -- and only the Elves live *with* the trees. No Humans,
 * so no charter to fight over, only old wounds. The lovers run underneath;
 * Skarra is loud over all of it. Threads: lovers (seen by the Elves), the
 * witches' feud, the Whispering War. Shared defaults: shared/elf.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/dwarf+halfellow+orc"] = {
  title: "Deep, Bog and Burrow",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, the last living witness of the Long Accord, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "vaelis", t: "Our neighbours, great-uncle: the mud-folk in their holes, the Orcs in their bog, the halfellows in their burrows. Everyone in the Marches lives *underground* except us." },
      { s: "ysolde", t: "They live in the earth, my son. We live in the trees. The trees live in the earth. It is all the same soil." },
      { s: "vaelis", t: "Mother, please do not make me *related* to the mud-folk before breakfast." },
      { n: "Old wounds stir across the Marches: the Rootcut, the Mountain Wars, the Goose Rout. At the Speaking Stones of the Bloodmire, the orc Bog Witch Skarra cackles loudest of all." },
      { s: "skarra", t: "Dwarves AND elves AND the goose-girl's people! Skarra has curses for EVERYONE!" },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted, its roots reaching deep.", req: { cities: 2 },
        alt: "Elf druids choose where a second grove-town will grow, where the roots can reach deepest." },
      { s: "ysolde", t: "Deep roots. The trees want to hear what the tunnels and the bogs are saying." },
      { s: "vaelis", t: "They are saying *dig*, mother. And *burn*. And *pie*. It is not a sophisticated conversation." },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Elf rangers have clashed with dwarf warriors.", req: { firstBlood: "dwarf" } },
      { n: "The meadows' edge, at dawn. Elf rangers have clashed with halfellow militia.", req: { firstBlood: "halfellow" } },
      { n: "The borderwood, at dawn. Elf rangers have met orc war-bands in the smoke.", req: { firstBlood: "orc" } },
      { s: "aelthir", t: "First blood. Every one of these peoples has an old wound with us. Now they have a new one." },
      { s: "vaelis", t: "Then let us make it a *memorable* one, great-uncle." },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. Ysolde has pressed her ear to the roots for hours, listening." },
      { s: "ysolde", t: "Under the whole Marches, Warden: dwarf tunnels, orc bog-water, halfellow cellars. All touching. All the same soil." },
      { s: "aelthir", t: "And the Marchstone's roots through all of it." },
      { s: "ysolde", t: "Yes. Everyone is standing on the same stone, and fighting over who owns the top of it." },
      { s: "vaelis", t: "Then let us own the *top*, great-uncle. The view is better." },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders. Its roots now run alongside the dwarf tunnels, the orc bog and the halfellow cellars, all the same soil." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis." },
      { s: "vaelis", t: "You would give the Silverwood to a woman who talks to *puddles*." },
      { s: "ysolde", t: "And to *bogs* now, my son. And *tunnels*. They all have a great deal to say about you." },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying every rival. The tunnels, the bog and the burrows are silent." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "No one underground any more, great-uncle. We have the whole Marches to ourselves." },
      { s: "ysolde", t: "The roots are quiet, Warden. No tunnels. No bog-water. No cellars. It is very lonely down there." },
      { s: "aelthir", t: "It is very lonely up here too, Ysolde." },
    ],
    "E-Fallen": [
      { n: "The Silverwood has fallen, and {capital} is lost." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden." },
      { s: "aelthir", t: "Same soil, Ysolde. They will grow something here. It may even be good." },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly." },
      { s: "skarra", t: "The elf-witch's forest, ASH! Ha! HA!", req: { conqueror: "orc" } },
      { s: "oskar", t: "Entry the First. Settled. It doesn't feel settled.", req: { conqueror: "dwarf" } },
      { s: "hobby", t: "Leave the big tree standing, everyone. Put a bench under it.", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Silverwood still stands.", req: { winner: "dwarf" } },
      { n: "The Orcs have won by holding the Marches, but the Silverwood still stands.", req: { winner: "orc" } },
      { n: "The Halfellows have won by holding the Marches, but the Silverwood still stands.", req: { winner: "halfellow" } },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "One of the underground peoples holds the Marches. I will witness their Accord. It is all the same soil, in the end." },
      { s: "vaelis", t: "Please stop saying that, great-uncle." },
    ],
  },
};
