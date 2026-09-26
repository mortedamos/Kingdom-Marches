/**
 * STORY SCENARIO -- halfellow/dwarf+orc, "The Pub Knows"
 * Goldie hears the rumour first (shared/halfellow.js lovers:meet): the Thane's
 * daughter and the Warchief's son. Hobby, the trickster, decides to *hide*
 * the lovers, and at B5 runs her cleverest scheme of the war keeping Skarra
 * from using them. Shared defaults: js/data/story/shared/halfellow.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/dwarf+orc"] = {
  title: "The Pub Knows",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll." },
      { s: "barnaby", t: "The Marchstone has split! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "flustered" },
      { s: "hobby", t: "And our neighbours are the Dwarves of Karrak and the Orcs of the Bloodmire. Who have hated each other for five hundred years.", m: "scheming" },
      { s: "goldie", t: "A pub hears everything, love. And I've heard a *lot* about those two lately. Travellers talk.", m: "stern" },
      { s: "hobby", t: "What sort of a lot?", m: "scheming" },
      { s: "goldie", t: "The sort I'm not telling you until I'm *sure*.", m: "stern" },
      { n: "In Karrak, the Dwarves' Loremaster opens Volume Seven of the Book of Grudges, the Orc volume. In the Bloodmire, the orc Bog Witch Skarra cackles at the Speaking Stones." },
      { s: "skarra", t: "Dwarves in their mountain, the goose-girl in her meadows! And Skarra's Wisps see EVERYTHING that happens in between!", m: "gleeful" },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! Plenty of cellars, please. Deep ones. With back doors.", m: "happy" },
      { s: "barnaby", t: "Why back doors, Hobby?", m: "flustered" },
      { s: "hobby", t: "Everyone needs a back door, Uncle. You never know who'll need to use it.", m: "scheming" },
    ],
    B2: [
      { n: "The barley fields, at dawn. Halfellow militia have clashed with dwarf warriors.", req: { firstBlood: "dwarf" },
        alt: "The hedges of the Hearthlands, at dawn. Halfellow militia have clashed with orc raiders." },
      { s: "hobby", t: "First blood. I'd hoped they'd be too busy fighting each other.", m: "sad" },
      { s: "hobby", t: "Our traps are out. I used to laugh when those went off.", m: "sad", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love.", m: "sad" },
      { s: "hobby", t: "No. I don't think this one's funny.", m: "sad" },
    ],
    // Hobby's cleverest scheme: hiding the lovers from Skarra.
    B5: [
      { n: "The back room of The Goose & Kettle, well after closing. Hobby spreads a map across the table. Every halfellow cellar with a back door is marked on it." },
      { s: "goldie", t: "I'm sure now, love. The rumour I wouldn't tell you. The Dwarf Thane's daughter and the Orc Warchief's son. They're in *love*. They've been meeting in the old tunnels.", m: "stern", req: { notSeen: "lovers:meet" } },
      { fx: { seen: "lovers:meet" } },
      { s: "hobby", t: "Skarra's Wisps are hunting them, Goldie. The Thane's daughter and the Warchief's son. She wants the secret, so she can use it to take her brother's throne.", m: "scheming" },
      { s: "goldie", t: "And you're going to *hide* them. From a Bog Witch. With *cellars*.", m: "stern" },
      { s: "hobby", t: "Wisps can't see underground. And halfellows have been hiding things in cellars since before there *was* an Accord.", m: "scheming" },
      { s: "barnaby", t: "Hobby. If either mother finds out we hid them, we'll have both Karrak and the Bloodmire at our door.", m: "flustered" },
      { s: "hobby", t: "Then they'd best not find out, Uncle.", m: "scheming" },
      { n: "For a month, a young dwarf with copper braids and an orc on a grey dire wolf move from cellar to cellar across the Hearthlands, always one step ahead of the green lights in the sky." },
      { n: "Skarra's Wisps search every meadow, every barn, every hedge. They never think to look *down*." },
      { s: "skarra", t: "*(in the Bloodmire)* WHERE ARE THEY? Skarra's Wisps see EVERYTHING! Everything except… *cellars*. …The GOOSE-GIRL!", m: "angry" },
      { n: "Back in The Goose & Kettle, Hobby grins for the first time in weeks. Goldie and Barnaby do not." },
      { s: "goldie", t: "You're enjoying this far too much, love.", m: "stern" },
      { s: "hobby", t: "I know, dear. That's what frightens me.", m: "scheming" },
    ],
    B6: [
      { n: "The Goose & Kettle, early evening. Goldie has cleared a table, laid a proper supper for *three*, and is standing over it with her arms folded." },
      { s: "goldie", t: "Sit. *All* of you. You too, dear. And get that wolf off my good rug.", m: "stern" },
      { n: "Sigrun Stonefast and Varg Ironjaw, the Thane's daughter and the Warchief's son, sit down at a halfellow table together, in the light, for the first time." },
      { s: "hobby", t: "The last scheme, Goldie. I promise. Once they're safe, it's done.", m: "happy" },
      { s: "goldie", t: "Then *eat*, all three of you. Love and war are both terrible on an empty stomach.", m: "happy" },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the mountains to the bog flies the gold of the Hearthlands. The Marches have become one enormous neighbourhood." },
      { s: "stone", t: "HELD." },
      { n: "That evening, The Goose & Kettle hosts the strangest supper in its history: a dwarf Thane, an orc Warchief, and their children, seated side by side at Goldie's table.", req: { alive: ["dwarf", "orc"] } },
      { s: "brunna", t: "*(to Grukka, very stiffly)* The halfellows hid them. From both of us.", m: "angry", req: { alive: ["dwarf", "orc"] } },
      { s: "grukka", t: "*(equally stiffly)* Then the halfellows are smarter than both of us.", m: "defiant", req: { alive: ["dwarf", "orc"] } },
      { s: "goldie", t: "They always were, dears. Now *eat*.", m: "stern" },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying the Dwarves and the Orcs. The mountains and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "In a halfellow cellar, a young dwarf and an orc sit together. Their kingdoms are gone. The halfellows hid them to the very end." },
      { s: "hobby", t: "We saved *them*, Goldie. Just not anyone else.", m: "sad" },
      { s: "goldie", t: "No more tricks, Hobby.", m: "sad" },
      { s: "hobby", t: "No. That was the last one.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Hearthlands have fallen. {capital}, the last halfellow town, has been surrounded." },
      { n: "Hobby's last trick is her best. While the soldiers search empty houses, every halfellow family slips out through the cellars, one by one, in silence." },
      { s: "barnaby", t: "The back doors, Hobby. You built them for the lovers. Now everyone's using them.", m: "sad" },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs.", m: "stern" },
      { s: "skarra", t: "*(in the ruins)* The goose-girl's cellars! All EMPTY! Every one! HOW?!", m: "angry", req: { conqueror: "orc" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "dwarf" },
        alt: "The Orcs have won by holding the Marches, but the Hearthlands still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "The Marches changed hands. Our cellars didn't. Set two extra places.", m: "happy" },
      { s: "goldie", t: "For the lovebirds? Already done, love. And a bowl for the wolf.", m: "happy" },
    ],
  },
};
