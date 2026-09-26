/**
 * STORY SCENARIO -- halfellow/elf+orc, "Hedge Against Horde"
 * The Bloodmire horde is coming; the Silverwood offers help, and makes it
 * sound like an insult. Ysolde and Hobby plant a living hedge together;
 * Vaelis sneers; Skarra hates them both. Threads: feud (Ysolde vs Skarra).
 * Shared defaults: js/data/story/shared/halfellow.js. Bible §9.5.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/elf+orc"] = {
  title: "Hedge Against Horde",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll." },
      { s: "barnaby", t: "The Marchstone has split! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "flustered" },
      { s: "hobby", t: "Orcs to the south in their bog. Elves to the north in their forest. And us in the middle, with all the hedges.", m: "scheming" },
      { n: "In the Bloodmire, the Orcs' swamp country, the Bog Witch Skarra Ironjaw stands at the Speaking Stones." },
      { s: "skarra", t: "The goose-girl's meadows first! Then the tree-folk! Skarra will burn a path straight through to the Wellspring!", m: "gleeful" },
      { n: "In the Silverwood, the Elves' Archdruid Ysolde, keeper of the sacred Wellspring, hears the threat on the wind. Her face goes very still." },
      { s: "ysolde", t: "Skarra. Of course it is Skarra. Then the Hearthlands are the Silverwood's first wall, whether they like it or not.", m: "angry" },
      { s: "vaelis", t: "A wall made of *farmers*. How reassuring.", m: "aloof" },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! Hedges on the south side, please. Thick ones. Thorny ones.", m: "happy" },
      { s: "barnaby", t: "And the north side?", m: "flustered" },
      { s: "hobby", t: "Leave the north side open, Uncle. The Elves like to *look down* on us. Let's give them a nice view.", m: "scheming" },
    ],
    B2: [
      { n: "The hedges of the Hearthlands, at dawn. Halfellow militia have clashed with orc raiders.", req: { firstBlood: "orc" },
        alt: "The forest's edge, at dawn. Halfellow militia have clashed with elf rangers. Nobody meant it to happen." },
      { s: "hobby", t: "First blood. Well. The hedges held.", m: "sad" },
      { s: "hobby", t: "Our traps are out. I used to laugh when those went off.", m: "sad", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love.", m: "sad" },
      { s: "hobby", t: "No. I don't think this one's funny.", m: "sad" },
    ],
    // The living hedge: Ysolde and Hobby, against the Bog Witch.
    B3: [
      { n: "The southern border of the Hearthlands. A small elf with bare feet and moss in her hair is kneeling in the mud beside the Mayor, planting blackthorn." },
      { n: "Ysolde, Archdruid of the Silverwood, has come herself. She sings to each sapling as it goes in, and it grows a hand's width while she sings." },
      { s: "ysolde", t: "Thorn and root. When Skarra's raiders come, this will be a wall no axe can cut in a night.", m: "uncanny" },
      { s: "hobby", t: "Why help us, Archdruid? Your son thinks we're a wall made of farmers.", m: "scheming" },
      { s: "ysolde", t: "My son thinks a great many things. Most of them are wrong. Skarra Ironjaw tried to set my hair on fire at a Midsummer Fair, eighty years ago. She failed. She will try again. That is enough.", m: "uncanny" },
      { n: "Lord Vaelis watches from his horse, and does not dismount." },
      { s: "vaelis", t: "The Archdruid of the Silverwood, in the mud, with a halfellow. I shall never be able to look at a hedge again.", m: "aloof" },
      { s: "goldie", t: "*(handing up a mug)* Then drink your tea, dear, and look at the sky.", m: "stern" },
      { n: "Far to the south, at the Speaking Stones, Skarra feels the hedge take root, and shrieks." },
      { s: "skarra", t: "THE MOSS-HAIRED CROW! Planting! In the goose-girl's mud! Skarra will burn it! Skarra will burn it ALL!", m: "angry" },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the bog to the forest flies the gold of the Hearthlands. And along the southern border, a blackthorn hedge twelve feet high has never once been cut." },
      { s: "stone", t: "HELD." },
      { s: "ysolde", t: "The hedge held, Mayor. So did you.", m: "happy", req: { alive: "elf" } },
      { s: "vaelis", t: "A kingdom of farmers holds the Marches. …I suppose someone must tell the Conclave.", m: "aloof", req: { alive: "elf" } },
      { s: "goldie", t: "Supper's at six! And Hobby, *you're* on time for once.", m: "happy" },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying the Silverwood and the Bloodmire. The forest and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "The blackthorn hedge still grows along the southern border. There is nothing left on the other side of it to keep out." },
      { s: "goldie", t: "No more tricks, Hobby.", m: "sad" },
      { s: "hobby", t: "No. That was the last one. She sang to those saplings, Goldie. And we burned her forest anyway.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Hearthlands have fallen. {capital}, the last halfellow town, has been surrounded." },
      { n: "Hobby's last trick is her best. While the soldiers search empty houses, every halfellow family slips out down the old smugglers' lanes, one by one, in silence." },
      { s: "barnaby", t: "I have the Accord. The Archive's copy. The only complete one in the Marches.", m: "sad" },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs.", m: "stern" },
      { s: "skarra", t: "*(in the ruins)* The hedge is ASH! The goose-girl is GONE! Now, moss-haired crow, YOUR turn!", m: "gleeful", req: { conqueror: "orc" } },
      { s: "vaelis", t: "*(in the empty square)* They left. All of them. …I shall have someone plant something here.", m: "sad", req: { conqueror: "elf" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Elves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "elf" },
        alt: "The Orcs have won by holding the Marches, but the Hearthlands still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "Crowns come and go, dear. Supper's still at six. And the hedge is still standing.", m: "happy" },
      { s: "goldie", t: "And *you* are still going to be late for it.", m: "stern" },
    ],
  },
};
