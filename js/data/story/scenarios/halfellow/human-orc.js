/**
 * STORY SCENARIO -- halfellow/human+orc, "The Kitchen and the Horde"
 * The orcs want the farms; the humans *need* them. Both come for the
 * Hearthlands' larder. THREAD (bible §13.7, Goldie's Fall): at B5 the
 * Goose & Kettle burns with Goldie inside. The raiders are whoever last
 * took a halfellow city (ctx.conqueror): Westmarch requisitioners if it
 * was the humans, otherwise Skarra's war-band. Hobby turns to vengeance.
 * Shared defaults: js/data/story/shared/halfellow.js. Bible §9.5.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/human+orc"] = {
  title: "The Kitchen and the Horde",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll." },
      { s: "barnaby", t: "The Marchstone has split! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "hobby", t: "The Orcs want our farms. Westmarch *needs* our farms. And we're the ones standing in them." },
      { s: "goldie", t: "The whole Marches is coming to my kitchen, love. And none of them have booked." },
      { n: "In the Bloodmire, the Orcs' swamp country, the Bog Witch Skarra Ironjaw stands at the Speaking Stones, with Gnash, the Warchief's enormous ogre, at her side." },
      { s: "skarra", t: "The goose-girl's larder! Skarra will eat her pies and burn her pub, and the humans can STARVE!" },
      { s: "gnash", t: "Gnash like pie." },
      { n: "In Westmarch, the Human kingdom, Queen Maren Ashcroft reads the same news with her Archmage, Corvin Varro." },
      { s: "maren", t: "If the Orcs take the Hearthlands, Westmarch starves. So we must take them first. For their protection. …Write it down." },
      { s: "corvin", t: "Majesty, I'm not sure the halfellows will see it as *protection*." },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! Big granary, please. With a *very* good lock." },
      { s: "goldie", t: "And a kitchen. Every town needs a kitchen." },
      { s: "hobby", t: "Goldie, we're at war." },
      { s: "goldie", t: "*Especially* at war, love." },
    ],
    B2: [
      { n: "The hedges of the Hearthlands, at dawn. Halfellow militia have clashed with orc raiders.", req: { firstBlood: "orc" },
        alt: "The road to Westmarch, at dusk. Halfellow militia have clashed with human soldiers sent to 'protect' a granary." },
      { s: "hobby", t: "First blood. Over *food*. Everyone's fighting over food, and we're the ones who grow it." },
      { s: "hobby", t: "Our traps are out. I used to laugh when those went off.", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love." },
      { s: "hobby", t: "No. I don't think this one's funny." },
    ],
    // GOLDIE'S FALL (bible §13.7): the raiders are whoever last took a
    // halfellow city; orcs by default.
    B5: [
      { n: "Night, in {capital}. Westmarch soldiers have come with carts and an order signed by the Queen: *requisition every granary for the protection of the realm*.", req: { conqueror: "human" },
        alt: "Night, in {capital}. Orc raiders, Skarra's own war-band, have slipped past the hedges while the militia were away on the border. They go straight for The Goose & Kettle: Skarra knows exactly which building matters most." },
      { n: "The Goose & Kettle's cellar is the biggest larder in town. The soldiers break the door. Somebody knocks over a lantern. Nobody means for it to happen, and that makes no difference at all.", req: { conqueror: "human" },
        alt: { s: "skarra", t: "The goose-girl's KITCHEN! Take the pies! Burn the rest!" } },
      { n: "Inside, a dozen regulars are trapped. Goldie Trickgrin, keeper of The Goose & Kettle, holds the back door with a rolling pin until the last of them is out." },
      { s: "goldie", t: "Out! All of you! Out the back, and don't you *dare* come back for the barrels!" },
      { n: "The roof comes down. Goldie does not come out." },
      { fx: { kill: "goldie", flag: "goldieFallen" } },
      { n: "At dawn, Hobby Trickgrin stands in the ashes of The Goose & Kettle. Barnaby stands beside her. Neither of them speaks for a long time." },
      { s: "barnaby", t: "She got every one of them out, Hobby. Every regular. Every one." },
      { s: "hobby", t: "Of course she did. She always did." },
      { n: "A letter arrives from Westmarch two days later, in a dry, precise hand. Hobby burns it without reading it.", req: { conqueror: "human" } },
      { n: "Hobby Trickgrin is not grinning. Nobody in the Hearthlands has seen that face on her before." },
      { s: "hobby", t: "Ring the bells, Uncle. Every town. Every farm. Everyone who can hold a pitchfork." },
      { s: "barnaby", t: "The Militia?" },
      { s: "hobby", t: "The Militia. For Goldie." },
    ],
    B6: [
      { n: "The ashes of The Goose & Kettle, at dusk. Barnaby has laid a supper for one on a scorched table, badly. The soup is cold. He has put salt in it twice." },
      { s: "barnaby", t: "Sit. Eat. She'd have insisted." },
      { s: "hobby", t: "I've a war to finish, Uncle." },
      { s: "barnaby", t: "You've a war to *end*, Hobby. Those aren't the same thing. She'd have told you that too." },
      { n: "Hobby sits. She eats the whole bowl without complaint, which is how Barnaby knows how bad it is." },
      { s: "barnaby", t: "I heard a rumour today. At the market. About… something. I've forgotten what. I'm very bad at this, Hobby." },
      { s: "hobby", t: "*(almost smiling)* You are, Uncle. You're *terrible* at it." },
      { s: "hobby", t: "One last trick. For her. And then I'm done." },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the bog to the river flies the gold of the Hearthlands. The Marches will eat, and the halfellows decide who's invited." },
      { s: "stone", t: "HELD." },
      { n: "The Goose & Kettle has been rebuilt, board for board. Over the bar hangs a painting of a laughing woman with a rolling pin.", req: { charDead: "goldie" },
        alt: "That evening, The Goose & Kettle hosts a supper for every militia-member in the Hearthlands." },
      { s: "maren", t: "*(at the bar)* Mayor. We came to your kitchen as if it were ours. I'm sorry. …Write it down.", req: { alive: "human" } },
      { s: "hobby", t: "Supper's at six, everyone. It always was. She'd want you on time.", req: { charDead: "goldie" }, alt: { s: "goldie", t: "Supper's at six! And Hobby, *you're* on time for once." } },
      { s: "barnaby", t: "Everyone's fed, Hobby. That's how she'd have scored it." },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying Westmarch and the Bloodmire. The river cities and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "That night, the halfellows light the Great Bonfire on the hill above {capital}. It is not a celebration." },
      { s: "hobby", t: "It's done, Goldie. All of it. There's no one left to come to the kitchen.", req: { charDead: "goldie" }, alt: { s: "goldie", t: "No more tricks, Hobby." } },
      { s: "barnaby", t: "You won the way you swore you never would, Hobby." },
      { s: "hobby", t: "I know, Uncle. I'll live with it. She'd have made me." },
    ],
    "E-Fallen": [
      { n: "The Hearthlands have fallen. {capital}, the last halfellow town, has been surrounded." },
      { n: "Hobby's last trick is her best. While the soldiers search empty houses, every halfellow family slips out down the old smugglers' lanes, one by one, in silence." },
      { s: "barnaby", t: "I have the Accord. The Archive's copy. The only complete one in the Marches." },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs.",
        alt: { s: "hobby", t: "We'll be back, Uncle. Somebody has to collect the tabs. She'd insist." } },
      { s: "skarra", t: "*(in the ruins)* The goose-girl's larder, EMPTY! Where are the PIES?!", req: { conqueror: "orc" } },
      { s: "gnash", t: "*(sadly)* No pie.", req: { conqueror: "orc" } },
      { s: "maren", t: "*(in the empty granary)* We came to protect their food. There's no one left to grow it. …Write it down.", req: { conqueror: "human" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "Westmarch has won by holding the Marches, but the Hearthlands still stand.", req: { winner: "human" },
        alt: "The Orcs have won by holding the Marches, but the Hearthlands still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "Crowns come and go. Supper's still at six. And they'll still need our bread." },
      { s: "goldie", t: "And *you* are still going to be late for it, love.", alt: { s: "barnaby", t: "And you'll still be late for it. She'd have said that." } },
    ],
  },
};
