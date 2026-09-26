/**
 * STORY SCENARIO -- elf/halfellow+human+orc, "Hedge, Tower and Horde"
 * Three kinds of ambition press on the forest: halfellow hedges, human
 * mage-towers, the orc horde. Vaelis's B5 petition is at its most dangerous here
 * because the court is frightened -- it PASSES, and Aelthir must use the
 * Warden's veto for the first time in a thousand years. Threads: the
 * bloodline, mercy, the witches' feud, the Whispering War.
 * Shared defaults: js/data/story/shared/elf.js. Bible §9.2.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/halfellow+human+orc"] = {
  title: "Hedge, Tower and Horde",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, the last living witness of the Long Accord, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "uncanny" },
      { s: "vaelis", t: "Three kinds of ambition at our borders, great-uncle. The halfellows' hedges. Westmarch's mage-towers. The Orcs' horde. One creeps, one looms, one burns.", m: "aloof" },
      { s: "ysolde", t: "The Conclave is frightened, Warden. The elders have not been frightened since the Accord.", m: "sad" },
      { s: "aelthir", t: "Frightened elders make terrible decisions, Ysolde. I should know. I have been one.", m: "wistful" },
      { n: "In the Hearthlands, Mayor Hobby Trickgrin plants hedges. In Westmarch, Queen Maren Ashcroft raises mage-towers. In the Bloodmire, the Orc Warchief Grukka gathers his clans." },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted, and the Conclave argues for a week over which border it should face.", req: { cities: 2 },
        alt: "The Conclave argues for a week over where a second grove-town should grow, and which border it should face." },
      { s: "vaelis", t: "The elders cannot even agree which enemy to be afraid of first. I find it *instructive*.", m: "aloof" },
      { s: "aelthir", t: "Be careful what you learn from it, Vaelis.", m: "angry" },
    ],
    B2: [
      { n: "The meadows' edge, at dawn. Elf rangers have clashed with halfellow militia.", req: { firstBlood: "halfellow" } },
      { n: "The forest's edge, at dusk. Elf rangers have clashed with human soldiers and their battle-mages.", req: { firstBlood: "human" } },
      { n: "The borderwood, at dawn. Elf rangers have met orc war-bands in the smoke.", req: { firstBlood: "orc" } },
      { s: "aelthir", t: "First blood. And the Conclave is more frightened than ever.", m: "sad" },
      { s: "vaelis", t: "Good. Frightened elders *listen*, great-uncle. Eventually.", m: "aloof" },
    ],
    // Vaelis's petition PASSES; Aelthir's veto (bible §9.2).
    B5: [
      { n: "The Conclave of Elders, the council of the Silverwood's eldest, gathers beneath the Heartwood. Lord Vaelis stands before them, and the elders are afraid." },
      { s: "vaelis", t: "Elders. Hedges creep toward us. Towers loom over us. Fires burn us. And we are bound by promises to the very peoples doing it.", m: "aloof" },
      { s: "vaelis", t: "I petition the Conclave to *renounce* every promise the Accord made to the lesser peoples. Every one. Let the Silverwood owe the brief nothing.", m: "aloof" },
      { n: "The vote is called. One by one, the frightened elders raise their hands." },
      { s: "ysolde", t: "*(very quietly)* It is passing, Warden. By two voices.", m: "sad" },
      { n: "Aelthir Moonveil rises. He lays his hand on the Heartwood itself, and speaks a word no Warden has spoken in a thousand years." },
      { s: "aelthir", t: "*No*. The Warden's veto. The Silverwood keeps its promises, whether the stone holds us to them or not.", m: "angry" },
      { n: "The Conclave falls silent. Somewhere above, the Heartwood's leaves stop moving." },
      { s: "vaelis", t: "The veto. You have not used it since the Accord was sworn, great-uncle.", m: "angry" },
      { s: "aelthir", t: "I have not needed it, Vaelis. You have seen to that.", m: "sad" },
      { s: "vaelis", t: "*(bowing, very precisely)* Then we shall wait. We are *very* good at waiting. And the elders will remember that you overruled them.", m: "aloof" },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. The veto has cost Aelthir dearly: half the Conclave will no longer meet his eyes." },
      { s: "ysolde", t: "You spent a thousand years of authority in one word, Warden.", m: "uncanny" },
      { s: "aelthir", t: "It was what the authority was *for*, Ysolde.", m: "wistful" },
      { s: "vaelis", t: "*(from the shadows)* And when you are gone, great-uncle, and there is no veto?", m: "aloof" },
      { s: "aelthir", t: "Then I hope, Vaelis, that you will have learned why I used it.", m: "sad" },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders, and stopped, by the Warden's order, at every hedge and tower that had been built with care." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis.", m: "happy" },
      { s: "vaelis", t: "You would give the Silverwood to a woman who talks to *puddles*.", m: "angry" },
      { s: "ysolde", t: "And they, my son, voted *against* your petition. Every puddle. I counted.", m: "uncanny" },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying the halfellows, Westmarch and the Orcs. The hedges, towers and fires are all gone." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "No promises left to keep, great-uncle. No one left to keep them *to*. Your veto was for nothing.", m: "aloof" },
      { s: "aelthir", t: "No, Vaelis. It was for *us*. So that when this was over, we would still be people who keep our word.", m: "wistful" },
    ],
    "E-Fallen": [
      { n: "The Silverwood has fallen, and {capital} is lost." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden.", m: "sad" },
      { s: "aelthir", t: "I kept the promises, Ysolde. To the very end. That is something.", m: "sad" },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly. And I shall remember the veto. Longer than that.", m: "aloof" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Halfellows have won by holding the Marches, but the Silverwood still stands.", req: { winner: "halfellow" } },
      { n: "Westmarch has won by holding the Marches, but the Silverwood still stands.", req: { winner: "human" } },
      { n: "The Orcs have won by holding the Marches, but the Silverwood still stands.", req: { winner: "orc" } },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I will witness their Accord. And the Silverwood will keep its promises to them, as I swore it would.", m: "wistful" },
      { s: "vaelis", t: "Even to the *horde*, great-uncle?", m: "aloof", req: { winner: "orc" }, alt: "Even to the *lesser peoples*, great-uncle?" },
      { s: "aelthir", t: "Especially to them, Vaelis.", m: "happy" },
    ],
  },
};
