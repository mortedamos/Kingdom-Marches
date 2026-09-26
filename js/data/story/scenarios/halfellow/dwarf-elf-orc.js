/**
 * STORY SCENARIO -- halfellow/dwarf+elf+orc, "The Hedge Holds"
 * The lovers' rumour could be Hobby's secret weapon: tell Skarra, and the
 * Bog Witch would turn on her own sister's throne and leave the Hearthlands
 * alone. Vaelis advises exactly that. Hobby refuses, and it costs her (B5).
 * Threads: feud (Ysolde vs Skarra), whisper (Vaelis).
 * Shared defaults: js/data/story/shared/halfellow.js. Bible §9.5.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/dwarf+elf+orc"] = {
  title: "The Hedge Holds",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll." },
      { s: "barnaby", t: "The Marchstone has split! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "flustered" },
      { s: "hobby", t: "Dwarves in the mountains. Elves in the forest. Orcs in the bog. And every one of them has to cross *our* hedges to reach the others.", m: "scheming" },
      { s: "goldie", t: "Then we'd best keep the hedges thick, love.", m: "stern" },
      { n: "In Karrak, the Dwarves' Loremaster Oskar Grimgate opens the Book of Grudges. In the Silverwood, Lord Vaelis Nightbloom sets out three chess pieces, and one very small one." },
      { s: "vaelis", t: "Stone, bog, and the small folk in the middle. The small piece is the interesting one. It moves in ways the others do not expect.", m: "aloof" },
      { n: "In the Bloodmire, the Orcs' swamp country, the Bog Witch Skarra Ironjaw cackles at the Speaking Stones." },
      { s: "skarra", t: "Skarra's Wisps are flying, goose-girl! Over your hedges, over your meadows! Skarra sees EVERYTHING!", m: "gleeful" },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! Hedges on *every* side, please. We've neighbours on every side.", m: "happy" },
      { s: "barnaby", t: "That's a great deal of hedge, Hobby.", m: "flustered" },
      { s: "hobby", t: "It's a great deal of neighbours, Uncle.", m: "scheming" },
    ],
    B2: [
      { n: "The barley fields, at dawn. Halfellow militia have clashed with dwarf warriors.", req: { firstBlood: "dwarf" },
        alt: { n: "The forest's edge, at dawn. Halfellow militia have clashed with elf rangers.", req: { firstBlood: "elf" },
          alt: "The hedges of the Hearthlands, at dawn. Halfellow militia have clashed with orc raiders." } },
      { s: "hobby", t: "First blood. The hedges didn't hold everyone out.", m: "sad" },
      { s: "hobby", t: "Our traps are out. I used to laugh when those went off.", m: "sad", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love.", m: "sad" },
      { s: "hobby", t: "No. I don't think this one's funny.", m: "sad" },
    ],
    // The secret weapon Hobby refuses to use.
    B5: [
      { n: "The back room of The Goose & Kettle, well after closing. A letter lies on the table, sealed in silver wax. It is from the Silverwood." },
      { s: "goldie", t: "Before you open that, love. The rumour I've been sitting on. The Dwarf Thane's daughter and the Orc Warchief's son. They're in *love*. It's true.", m: "stern", req: { notSeen: "lovers:meet" } },
      { fx: { seen: "lovers:meet" } },
      { s: "vaelis", t: "*(his letter)* “Mayor. You know what I know about the Thane's daughter and the Warchief's son. Tell the Bog Witch. She will use it to seize her brother's throne, the Orcs will tear themselves apart, and your hedges will never see another raider. It is the obvious move. Even for you.”", m: "aloof" },
      { s: "barnaby", t: "He's right, Hobby. That's the horrible thing. It would work.", m: "sad" },
      { s: "hobby", t: "It would work. And two children would be dead by the end of the month.", m: "sad" },
      { s: "goldie", t: "So what are you going to do?", m: "stern" },
      { n: "Hobby Trickgrin holds the letter over a candle until the silver wax runs." },
      { s: "hobby", t: "Nothing, Goldie. For once in my life, the trick is to do *nothing*.", m: "sad" },
      { n: "A month later, Skarra's raiders come over the southern hedges in the night. They burn a dozen farms before the militia can muster. The Hearthlands had no warning; the one secret that could have bought one stayed secret." },
      { s: "skarra", t: "*(at the Speaking Stones)* The goose-girl's hedges, BROKEN! What happened to all your little TRICKS?", m: "gleeful" },
      { s: "vaelis", t: "*(in the Silverwood)* She had the winning piece in her hand, and she put it back in the box. …How very *irritating*.", m: "angry" },
      { s: "hobby", t: "It cost us a dozen farms, Uncle. I'd pay it again.", m: "sad" },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the mountains to the forest to the bog flies the gold of the Hearthlands." },
      { s: "stone", t: "HELD." },
      { n: "That evening, a young dwarf with copper braids and an orc on a grey dire wolf ride up to The Goose & Kettle. They do not have to hide any more.", req: { alive: ["dwarf", "orc"] } },
      { s: "vaelis", t: "You kept their secret, and you still won. I shall have to reconsider several things. Not many.", m: "aloof", req: { alive: "elf" } },
      { s: "goldie", t: "Supper's at six! And Hobby, *you're* on time for once.", m: "happy" },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying the Dwarves, the Elves and the Orcs. The mountains, the forest and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Hobby kept the lovers' secret to the very end. There is no one left to keep it from." },
      { s: "goldie", t: "No more tricks, Hobby.", m: "sad" },
      { s: "hobby", t: "No. That was the last one. I did nothing when it mattered, Goldie. And then I did everything, when it didn't.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Hearthlands have fallen. {capital}, the last halfellow town, has been surrounded." },
      { n: "Hobby's last trick is her best. While the soldiers search empty houses, every halfellow family slips out down the old smugglers' lanes, one by one, in silence." },
      { s: "barnaby", t: "I have the Accord. And you still never told anyone, Hobby. Not even now.", m: "sad" },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs.", m: "stern" },
      { s: "skarra", t: "*(in the ruins)* The goose-girl, GONE! And her secrets with her! …She HAD secrets. Skarra KNOWS she had secrets!", m: "angry", req: { conqueror: "orc" } },
      { s: "vaelis", t: "*(in the empty square)* She could have won with one sentence. She chose to lose with her mouth shut. I do not understand the small folk.", m: "sad", req: { conqueror: "elf" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "dwarf" },
        alt: { n: "The Elves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "elf" },
          alt: "The Orcs have won by holding the Marches, but the Hearthlands still stand." } },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "Let them hold it. We'll hold our tongues, and our suppers. And the secret's still safe.", m: "happy" },
      { s: "goldie", t: "And *you* are still going to be late for it.", m: "stern" },
    ],
  },
};
