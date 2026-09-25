/**
 * STORY SCENARIO -- halfellow/orc, "The Second Rout"
 * Skarra is back for the revenge she planned forty years ago, and she has
 * brought Gnash. Hobby is tempted to do the goose trick again; Goldie
 * forbids it. THREAD (bible §13.7, Goldie's Fall): at B5 Skarra's raiders
 * burn The Goose & Kettle and Goldie dies defending her regulars. Hobby
 * turns to vengeance; the Militia rallies in Goldie's name.
 * Shared defaults: js/data/story/shared/halfellow.js. Bible §9.5.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/orc"] = {
  title: "The Second Rout",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll." },
      { s: "barnaby", t: "The Marchstone has split! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "hobby", t: "And the Accord's gone. Which means nothing is keeping the Orcs in their bog any more." },
      { n: "Over the bar hangs a single goose feather in a frame. Forty years ago, a young Trouble Maker named Hobby Trickgrin sent an orc raiding party home with traps, a bonfire and a very angry goose: the Goose Rout." },
      { n: "In the Bloodmire, the Orcs' swamp country, the Bog Witch Skarra Ironjaw stands at the Speaking Stones. She planned that raid. She has never forgiven it." },
      { s: "skarra", t: "The goose-girl is MAYOR now! Skarra has waited forty years for this! Gnash! Remember the goose?" },
      { s: "gnash", t: "*(shuddering)* Gnash remember goose. Goose bite Gnash in places Gnash not talk about." },
      { n: "Back in The Goose & Kettle, Hobby is looking at the framed feather with a very particular grin." },
      { s: "goldie", t: "No, Hobby. You promised me. *No more geese*." },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! Thick hedges, please. Very thick. With *surprises* in them." },
      { s: "barnaby", t: "Surprises, Hobby?" },
      { s: "hobby", t: "Traps, Uncle. But *friendly-looking* ones." },
    ],
    B2: [
      { n: "The hedges of the Hearthlands, at dawn. Halfellow militia and orc raiders have clashed for the first time since the Accord." },
      { s: "hobby", t: "First blood. With Skarra's people. Just like forty years ago. Except I'm not twenty any more." },
      { s: "hobby", t: "Our traps are out. I used to laugh when those went off.", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love." },
      { s: "hobby", t: "No. I don't think this one's funny." },
      { s: "skarra", t: "*(in the Bloodmire)* Halfellow blood! The goose-girl will PAY! Gnash, sharpen the big cleaver!" },
      { s: "gnash", t: "Gnash only HAVE big cleaver." },
    ],
    // GOLDIE'S FALL (bible §13.7)
    B5: [
      { n: "Night, in {capital}. Orc raiders, Skarra's own war-band, have slipped past the hedges while the militia were away on the border." },
      { n: "They go straight for The Goose & Kettle. Skarra knows exactly which building matters most." },
      { s: "skarra", t: "The goose-girl's PUB! Burn it! Burn the feather! Burn EVERYTHING!" },
      { n: "Inside, a dozen regulars are trapped. Goldie Trickgrin, keeper of The Goose & Kettle, holds the back door with a rolling pin until the last of them is out." },
      { s: "goldie", t: "Out! All of you! Out the back, and don't you *dare* come back for the barrels!" },
      { n: "The roof comes down. Goldie does not come out." },
      { fx: { kill: "goldie", flag: "goldieFallen" } },
      { n: "At dawn, Hobby Trickgrin stands in the ashes of The Goose & Kettle. In her hand is the goose feather from over the bar, singed at the tip. Barnaby stands beside her. Neither of them speaks for a long time." },
      { s: "barnaby", t: "She got every one of them out, Hobby. Every regular. Every one." },
      { s: "hobby", t: "Of course she did. She always did." },
      { n: "Hobby puts the singed feather in her hat. She is not grinning. Nobody in the Hearthlands has seen that face on her before." },
      { s: "hobby", t: "Ring the bells, Uncle. Every town. Every farm. Everyone who can hold a pitchfork." },
      { s: "barnaby", t: "The Militia?" },
      { s: "hobby", t: "The Militia. For Goldie." },
    ],
    B6: [
      { n: "The ashes of The Goose & Kettle, at dusk. Barnaby has laid a supper for one on a scorched table, badly. The bread is burnt." },
      { s: "barnaby", t: "Sit. Eat. She'd have insisted." },
      { s: "hobby", t: "I've a war to finish, Uncle." },
      { s: "barnaby", t: "You've a war to *end*, Hobby. Those aren't the same thing. She'd have told you that too." },
      { n: "Hobby sits. She eats the burnt bread without complaint, which is how Barnaby knows how bad it is." },
      { s: "hobby", t: "I promised her no more geese. I promised her the last trick." },
      { s: "barnaby", t: "Then keep the promise, Hobby. Make it the last one. Make it *count*." },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the bog to the river flies the gold of the Hearthlands. The Orcs have been hedged, trapped and out-farmed into a corner of their own swamp." },
      { s: "stone", t: "HELD." },
      { n: "The Goose & Kettle has been rebuilt, board for board, exactly as it was. Over the bar hangs a singed goose feather, and a painting of a laughing woman with a rolling pin.", req: { charDead: "goldie" },
        alt: "That evening, The Goose & Kettle hosts a supper for every militia-member in the Hearthlands, and a few very nervous orcs." },
      { s: "hobby", t: "Supper's at six, everyone. It always was. She'd want you on time.", req: { charDead: "goldie" }, alt: { s: "goldie", t: "Supper's at six! And Hobby, *you're* on time for once." } },
      { s: "barnaby", t: "I've written her into the Archive, Hobby. Page one. Above the Accord." },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying the Orcs. The Bloodmire is silent." },
      { s: "stone", t: "REMAINS." },
      { n: "That night, the halfellows light the Great Bonfire on the hill above {capital}. It is not a celebration." },
      { s: "hobby", t: "It's done, Goldie. Skarra, the raiders, all of it. The bog is quiet.", req: { charDead: "goldie" }, alt: { s: "goldie", t: "No more tricks, Hobby." } },
      { s: "barnaby", t: "You won the way you swore you never would, Hobby." },
      { s: "hobby", t: "I know, Uncle. I'll live with it. She'd have made me." },
    ],
    "E-Fallen": [
      { n: "The Orcs have broken the Hearthlands. {capital}, the last halfellow town, is burning." },
      { n: "Hobby's last trick is her best. While the orc war-bands search empty houses, every halfellow family slips out down the old smugglers' lanes, one by one, in silence." },
      { s: "barnaby", t: "I have the Accord. And the painting of Goldie. The Archive can burn. Those can't." },
      { s: "hobby", t: "We'll be back, Uncle. Somebody has to collect the tabs. She'd insist." },
      { s: "skarra", t: "*(in the ruins)* The goose-girl, GONE! Forty years, and Skarra WINS! …Where are the geese? WHERE ARE THE GEESE?" },
      { n: "Under the ashes of the pub, a very angry goose is waiting." },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Orcs have won by holding the Marches. For the first time an orc crown rules the borderlands, but the Hearthlands still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "Crowns come and go. Supper's still at six." },
      { s: "barnaby", t: "And you'll still be late for it. She'd have said that." },
      { s: "hobby", t: "*(touching the singed feather in her hat)* …I know, Uncle. I know." },
    ],
  },
};
