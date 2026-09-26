/**
 * STORY SCENARIO -- orc/halfellow+human, "The Breadbasket"
 * Human money runs on halfellow food. Grukka wonders whether he wants the
 * Marches, or just the kitchen (B3: the Clans eat well for the first time
 * in a generation, and Varg asks what happens next winter).
 * Shared defaults: js/data/story/shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/halfellow+human"] = {
  title: "The Breadbasket",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!", m: "gleeful" },
      { s: "grukka", t: "The halfellows grow the food. Westmarch buys it. Take the Hearthlands, and the Humans starve without a single battle.", m: "defiant" },
      { s: "skarra", t: "And the goose-girl gets what's coming to her! Forty years, Skarra has waited!", m: "gleeful" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher." },
      { s: "gnash", t: "Food! Gnash like food! …Food has geese?", m: "happy" },
      { s: "grukka", t: "Some food *is* geese, Gnash.", m: "happy" },
      { s: "gnash", t: "*(horrified)* Gnash never think of that.", m: "confused" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount." },
      { s: "varg", t: "And Westmarch still says we broke the parley, Father.", m: "sad" },
      { s: "grukka", t: "Then Westmarch can say it hungry.", m: "defiant" },
    ],
    B2: [
      { n: "The hedgerows of the Hearthlands, at dawn. Orc raiders and halfellow militia have clashed for the first time since the Goose Rout.", req: { firstBlood: "halfellow" },
        alt: "The river road, at dusk. Orc raiders and human soldiers have clashed over a grain wagon, the first battle of the war." },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood! The ancestors are HUNGRY, little Warchief!", m: "gleeful" },
      { s: "gnash", t: "Gnash hungry too. Is that same thing?", m: "confused" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "The ancestors say avenge the fallen, Father. What if I don't want anyone to fall?", m: "sad" },
    ],
    // The Marches, or the kitchen?
    B3: [
      { n: "A feast in {capital}. For the first time in a generation, every orc in the Clans has eaten well: halfellow bread, halfellow cheese, and a great many halfellow pies, all raided." },
      { s: "gnash", t: "*(asleep on a pile of crusts)* …pie…", m: "happy" },
      { s: "grukka", t: "Look at them, boy. Full. Warm. Singing. I've never seen the Clans like this.", m: "happy" },
      { s: "varg", t: "And next winter, Father? When we've eaten everything we took, and burned the farms we took it from?", m: "sad" },
      { n: "Grukka doesn't answer for a long time." },
      { s: "skarra", t: "Next winter we raid AGAIN! That's what raiding IS, you soft-hearted turnip!", m: "angry" },
      { s: "varg", t: "Then the halfellows will stop planting. And Westmarch will stop buying. And we'll be the only people in the Marches who know how to take, and nobody left who knows how to grow.", m: "sad" },
      { s: "grukka", t: "…Keep talking, boy. Do I want the Marches? Or do I just want the kitchen?", m: "sad" },
      { s: "varg", t: "I think you want to *never be hungry again*, Father. That's not the same thing as raiding.", m: "bashful" },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "Across the Marches, the orc settlements have become real towns, with fields that don't rot. The halfellows were paid to teach them how." },
      { s: "grukka", t: "Not a cage. A hearth. …And a *kitchen*. Don't tell anyone I said kitchen.", m: "happy" },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure. Also Gnash is cook now.", m: "happy" },
      { s: "hobby", t: "*(in the Hearthlands)* The Orcs have asked for *seed*. Not raids. *Seed*. Uncle, write it down.", m: "happy", req: { alive: "halfellow" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying the Hearthlands and Westmarch. The fields and the river cities are silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { n: "Grukka sits atop the split Marchstone as if it were a throne. The stone is cold. It is also, he realises, nearly winter." },
      { s: "grukka", t: "We took the kitchen, boy. And the cooks.", m: "sad" },
      { s: "varg", t: "Then learn to cook, Father. All of us. Before the snow.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "Westmarch has broken the Orcs. {capital}, the last orc town, is burning, and the Knights of the Dawn are at its gates.", req: { conqueror: "human" },
        alt: "The halfellows have broken the Orcs. {capital}, the last orc town, is surrounded by hedges that weren't there yesterday." },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! You lost the bog! Skarra always said so—", m: "angry" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die.", m: "sad" },
      { s: "grukka", t: "I'll die with my axe in my hand, sister. Like I always said.", m: "defiant" },
      { s: "grukka", t: "Take Moss. Ride. Don't look back.", m: "sad" },
      { n: "Varg rides into the bog on his dire wolf. No one follows." },
      { s: "maren", t: "*(in the ashes)* Their Warchief went to our parley unarmed.", m: "sad", req: { conqueror: "human" } },
      { s: "hobby", t: "*(setting a pie on the Speaking Stones)* For the Warchief. He only ever wanted to not be hungry. That's not so strange.", m: "sad", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "Westmarch has won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "human" },
        alt: "The halfellows have won by holding the Marches, but the Bloodmire Clans still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "New cage. Same bog.", m: "defiant" },
      { s: "grukka", t: "…This time, we build inside it. And we plant something. Boy, find me a halfellow who'll sell us seed.", m: "defiant" },
    ],
  },
};
