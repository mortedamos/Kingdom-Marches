/**
 * STORY SCENARIO -- halfellow/elf+human+orc, "The Kettle's On"
 * Outnumbered by bigger folk in every direction; the humour at its warmest,
 * the stakes at their highest. B3: Goldie's kettle diplomacy, three crowns'
 * envoys in one pub. THREAD (bible §13.7, Goldie's Fall): B5, raiders are
 * whoever last took a halfellow city (orcs by default). VAELIS'S WHISPER
 * (§13.11): B6 reveals the Silverwood steered the orc raid south, onto the
 * Hearthlands and away from the forest.
 * Shared defaults: js/data/story/shared/halfellow.js. Bible §9.5.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/elf+human+orc"] = {
  title: "The Kettle's On",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll." },
      { s: "barnaby", t: "The Marchstone has split! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "flustered" },
      { s: "hobby", t: "Elves to the north. Humans to the west. Orcs to the south. Every one of them twice our size.", m: "sad" },
      { s: "goldie", t: "Then put the kettle on, love. Big folk always calm down with a cup of tea in their hands.", m: "stern" },
      { s: "hobby", t: "Goldie, it's a *war*.", m: "angry" },
      { s: "goldie", t: "Then put the *big* kettle on.", m: "stern" },
      { n: "In the Silverwood, Lord Vaelis Nightbloom looks at a map, and at the Bloodmire to the south of the forest, and at the Hearthlands in between." },
      { s: "vaelis", t: "The Bog Witch must burn *something*. It is simply a question of what.", m: "aloof" },
      { n: "In Westmarch, Queen Maren Ashcroft signs an order for more grain carts. In the Bloodmire, the Bog Witch Skarra Ironjaw cackles at the Speaking Stones." },
      { s: "skarra", t: "Tree-folk, tin-folk, and the goose-girl in the middle! Skarra will start with the one who screams LOUDEST!", m: "gleeful" },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! First building: a pub. Second building: a bigger pub.", m: "happy" },
      { s: "barnaby", t: "Hobby, a *wall*, perhaps?", m: "flustered" },
      { s: "hobby", t: "Uncle, a wall keeps people out. A pub keeps them *talking*. I want to know what they're saying.", m: "scheming" },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Halfellow militia have clashed with elf rangers.", req: { firstBlood: "elf" },
        alt: { n: "The road to Westmarch, at dusk. Halfellow militia have clashed with human soldiers.", req: { firstBlood: "human" },
          alt: "The hedges of the Hearthlands, at dawn. Halfellow militia have clashed with orc raiders." } },
      { s: "hobby", t: "First blood. And every one of them is bigger than us.", m: "sad" },
      { s: "hobby", t: "Our traps are out. I used to laugh when those went off.", m: "sad", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love.", m: "sad" },
      { s: "hobby", t: "No. I don't think this one's funny.", m: "sad" },
    ],
    // Kettle diplomacy.
    B3: [
      { n: "The Goose & Kettle, on market day. By pure accident (which is to say, by Goldie's careful planning) an elf envoy, a human envoy and an orc envoy have all come in out of the rain at once." },
      { s: "goldie", t: "Sit down, all of you. No swords on the bar. Tea's on.", m: "stern" },
      { n: "The orc is enormous. He sits on a halfellow stool, very carefully, and it survives. He takes his teacup between two fingers." },
      { s: "goldie", t: "*(to the elf)* Milk?", m: "stern" },
      { s: "hobby", t: "*(whispering to Barnaby)* She's going to make them *friends*, Uncle. In one afternoon. With *scones*.", m: "happy" },
      { s: "barnaby", t: "She did it to me at your christening. I've never recovered.", m: "flustered" },
      { n: "Nobody makes friends. But for one afternoon, three envoys from three armies sit at one table and complain about the weather. The orc asks for the scone recipe." },
      { n: "That evening, a letter comes from the Silverwood.", req: { alive: "elf" } },
      { s: "vaelis", t: "*(his letter)* “Mistress Trickgrin. My envoy reports that your tea was adequate and your company was not. I shall not send him again. He has asked to go back.”", m: "aloof", req: { alive: "elf" } },
      { s: "skarra", t: "*(at the Speaking Stones)* SCONES? Skarra's envoy went for WAR and came back with SCONES?!", m: "angry", req: { alive: "orc" } },
    ],
    // GOLDIE'S FALL (bible §13.7): raiders are whoever last took a
    // halfellow city; orcs by default.
    B5: [
      { n: "Night, in {capital}. Westmarch soldiers have come with carts and an order signed by the Queen: *requisition every granary for the protection of the realm*.", req: { conqueror: "human" },
        alt: { n: "Night, in {capital}. Elf riders on black Shadowsteeds come out of the dark, with orders to burn the stores and leave nothing an enemy could use.", req: { conqueror: "elf" },
          alt: "Night, in {capital}. Orc raiders, Skarra's own war-band, have come up from the south, far from their usual roads, as if someone had pointed them this way. They go straight for The Goose & Kettle." } },
      { n: "The Goose & Kettle's cellar is the biggest larder in town. The soldiers break the door. Somebody knocks over a lantern. Nobody means for it to happen, and that makes no difference at all.", req: { conqueror: "human" },
        alt: { n: "The fire spreads from the granary to the pub next door faster than anyone can carry water.", req: { conqueror: "elf" },
          alt: { s: "skarra", t: "The goose-girl's KETTLE! Burn it! Burn the scones!", m: "gleeful" } } },
      { n: "Inside, a dozen regulars are trapped. Goldie Trickgrin, keeper of The Goose & Kettle, holds the back door with a rolling pin until the last of them is out." },
      { s: "goldie", t: "Out! All of you! Out the back, and don't you *dare* come back for the kettle!", m: "stern" },
      { n: "The roof comes down. Goldie does not come out." },
      { fx: { kill: "goldie", flag: "goldieFallen" } },
      { fx: { flag: "pubRaidNotOrc" }, req: { conqueror: "human" } },
      { fx: { flag: "pubRaidNotOrc" }, req: { conqueror: "elf" } },
      { n: "At dawn, Hobby Trickgrin stands in the ashes of The Goose & Kettle. In the ashes at her feet is the big kettle, dented and black. Barnaby stands beside her. Neither of them speaks for a long time." },
      { s: "barnaby", t: "She got every one of them out, Hobby. Every regular. Every one.", m: "sad" },
      { s: "hobby", t: "Of course she did. She always did.", m: "sad" },
      { n: "Hobby Trickgrin picks up the kettle. She is not grinning. Nobody in the Hearthlands has seen that face on her before." },
      { s: "hobby", t: "Ring the bells, Uncle. Every town. Every farm. Everyone who can hold a pitchfork.", m: "angry" },
      { s: "barnaby", t: "The Militia?", m: "sad" },
      { s: "hobby", t: "The Militia. For Goldie.", m: "angry" },
    ],
    // The whisper: who sent the raiders south.
    B6: [
      { n: "The ashes of The Goose & Kettle, at dusk. Barnaby has laid a supper for one on a scorched table, badly. He has made tea in the dented kettle. It tastes of smoke." },
      { s: "barnaby", t: "Sit. Drink. She'd have insisted.", m: "sad" },
      { s: "barnaby", t: "And, Hobby. The orc scouts we captured. They say their orders came from the Speaking Stones, but the *map* came from somewhere else. A map drawn on silver paper.", m: "sad", req: { alive: "elf", notFlag: "pubRaidNotOrc" } },
      { s: "hobby", t: "Silver paper. Vaelis. He pointed the Bog Witch at *us*, so she'd burn our town instead of his forest.", m: "angry", req: { alive: "elf", notFlag: "pubRaidNotOrc" } },
      { s: "barnaby", t: "What will you do?", m: "sad", req: { alive: "elf", notFlag: "pubRaidNotOrc" } },
      { n: "For a long moment, Hobby says nothing. Then she pours two cups of smoky tea, and pushes one across the table to an empty chair." },
      { s: "hobby", t: "The last trick, Goldie. For you. And he'll never see it coming.", m: "scheming", req: { alive: "elf", notFlag: "pubRaidNotOrc" }, alt: "The last trick, Goldie. For you. And then I'm done." },
      { s: "vaelis", t: "*(in the Silverwood, some days later, reading a very small note)* “I know about the map. — H.T.” …How very *unsettling*.", m: "sad", req: { alive: "elf", notFlag: "pubRaidNotOrc" } },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the forest to the river to the bog flies the gold of the Hearthlands. The smallest folk in the Marches have outlasted every big one." },
      { s: "stone", t: "HELD." },
      { n: "The Goose & Kettle has been rebuilt, board for board. Over the bar hangs a painting of a laughing woman with a rolling pin, and beneath it, on its own shelf, a dented black kettle.", req: { charDead: "goldie" },
        alt: "That evening, The Goose & Kettle hosts envoys from every kingdom in the Marches. The orc asks for the scone recipe again." },
      { s: "vaelis", t: "*(in the doorway)* Mayor. I have come to… The map was… I— …Is there tea?", m: "sad", req: { alive: "elf", seen: "B6", notFlag: "pubRaidNotOrc" } },
      { s: "hobby", t: "There's always tea, my lord. Sit down. Goldie would have made you.", m: "sad", req: { charDead: "goldie" }, alt: { s: "goldie", t: "Supper's at six! And Hobby, *you're* on time for once.", m: "happy" } },
      { s: "barnaby", t: "The kettle's on, Hobby. It always was.", m: "sad" },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying the Silverwood, Westmarch and the Bloodmire. The forest, the river cities and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "That night, the halfellows light the Great Bonfire on the hill above {capital}. It is not a celebration." },
      { s: "hobby", t: "It's done, Goldie. All of them. There's nobody left to put the kettle on for.", m: "sad", req: { charDead: "goldie" }, alt: { s: "goldie", t: "No more tricks, Hobby.", m: "sad" } },
      { s: "barnaby", t: "You won the way you swore you never would, Hobby.", m: "sad" },
      { s: "hobby", t: "I know, Uncle. I'll live with it. She'd have made me.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Hearthlands have fallen. {capital}, the last halfellow town, has been surrounded." },
      { n: "Hobby's last trick is her best. While the soldiers search empty houses, every halfellow family slips out down the old smugglers' lanes, one by one, in silence." },
      { s: "barnaby", t: "I have the Accord. And the kettle. The Archive can burn. Those can't.", m: "sad" },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs.", m: "stern",
        alt: { s: "hobby", t: "We'll be back, Uncle. Somebody has to collect the tabs. She'd insist.", m: "sad" } },
      { s: "vaelis", t: "*(in the empty square)* The small folk are gone. I find I… do not care for the quiet.", m: "sad", req: { conqueror: "elf" } },
      { s: "maren", t: "*(in the empty granary)* We came for their bread. There's no one left to bake it.", m: "sad", req: { conqueror: "human" } },
      { s: "skarra", t: "*(in the ruins)* The goose-girl, GONE! Skarra WINS! …Is there any tea?", m: "gleeful", req: { conqueror: "orc" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Elves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "elf" },
        alt: { n: "Westmarch has won by holding the Marches, but the Hearthlands still stand.", req: { winner: "human" },
          alt: "The Orcs have won by holding the Marches, but the Hearthlands still stand." } },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "It's someone else's Marches now. But supper's still at six, and the kettle's on.", m: "sad" },
      { s: "goldie", t: "And *you* are still going to be late for it, love.", m: "stern", alt: { s: "barnaby", t: "And you'll still be late for it. She'd have said that.", m: "sad" } },
    ],
  },
};
