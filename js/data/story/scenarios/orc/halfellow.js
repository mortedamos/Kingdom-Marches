/**
 * STORY SCENARIO -- orc/halfellow, "Revenge for the Rout"
 * The clans come back for the Hearthlands. Skarra planned the original raid
 * forty years ago and wants revenge; Gnash is terrified of geese; and
 * Grukka comes to admire a people who hold land without an army (B3).
 * Shared defaults: js/data/story/shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/halfellow"] = {
  title: "Revenge for the Rout",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!" },
      { s: "grukka", t: "That stone was a fence, sister. Fences break.", m: "defiant" },
      { n: "Forty years ago, Skarra sent a raiding party into the Hearthlands, the halfellows' country to the north. A young halfellow named Hobby Trickgrin sent it home with traps, a bonfire and a very angry goose: the Goose Rout." },
      { s: "skarra", t: "And the goose-girl is MAYOR now! Forty years, Skarra has waited! Gnash! Remember the goose?", m: "gleeful" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher. At the word *goose*, he goes pale." },
      { s: "gnash", t: "*(shuddering)* Gnash remember goose. Goose bite Gnash in places Gnash not talk about.", m: "sad" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount." },
      { s: "varg", t: "The halfellows don't even have an army, Father.", m: "bashful" },
      { s: "grukka", t: "That's what we said last time, boy.", m: "defiant" },
    ],
    B2: [
      { n: "The hedgerows of the Hearthlands, at dawn. Orc raiders and halfellow militia have clashed for the first time since the Goose Rout." },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood in the goose-girl's hedges! The ancestors are HUNGRY!", m: "gleeful" },
      { s: "gnash", t: "Was there goose? Gnash only go if no goose.", m: "confused" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "They set traps, Father. In *hedges*. With *jam* in them. Who fights like that?", m: "sad" },
    ],
    // Grukka admires a people who hold without an army.
    B3: [
      { n: "A hill above the Hearthlands, at sunset. Grukka has come to look at the land his raiders keep failing to take." },
      { n: "Below him, as far as he can see: fields, mills, orchards, round doors and smoking chimneys. Not a single wall. Not a single soldier." },
      { s: "grukka", t: "No army. No walls. And they hold more land than the Clans have ever held. How?", m: "defiant" },
      { s: "varg", t: "They *live* on it, Father. Every field has a family. Every family has a cellar. You can't raid a place where everyone is home.", m: "bashful" },
      { s: "skarra", t: "They hold it with GEESE and TRICKERY! It's CHEATING!", m: "angry" },
      { s: "grukka", t: "It's *keeping*, sister. …I want to learn it.", m: "happy" },
      { n: "Far below, a halfellow farmer looks up at the orcs on the hill, and waves." },
      { s: "gnash", t: "*(waving back, very slowly)* …Gnash confused.", m: "confused" },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "Across the Marches, the orc settlements have become real towns, with fields and families and cellars. Someone has planted hedges." },
      { s: "grukka", t: "Not a fence. A hearth.", m: "happy" },
      { s: "grukka", t: "…Don't tell anyone I said hearth.", m: "defiant" },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure.", m: "happy" },
      { s: "hobby", t: "*(in the Hearthlands, on reading the news)* The Orcs, holding the Marches. With *hedges*. …I'm almost proud.", m: "happy", req: { alive: "halfellow" } },
      { n: "Somewhere deep in the bog, Skarra's distant shriek echoes as she curses destiny from exile. Destiny the frog, sunning on a lily pad, ignores her." },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying the Hearthlands. The fields are empty, the cellars are open, and no one is home." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { n: "Grukka sits atop the split Marchstone as if it were a throne. The stone is cold." },
      { s: "grukka", t: "We broke the fence. We took their fields. And there's nobody left to show us how to *keep* them.", m: "sad" },
      { s: "varg", t: "Each other, Father. Try that.", m: "sad" },
      { s: "skarra", t: "*(from somewhere in the reeds)* FORTY YEARS! SKARRA WINS! …Where are the geese?", m: "gleeful" },
    ],
    "E-Fallen": [
      { n: "The halfellows have broken the Orcs. {capital}, the last orc town, is surrounded by hedges that weren't there yesterday." },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! Beaten by FARMERS! AGAIN! Skarra always said so—", m: "angry" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die.", m: "sad" },
      { s: "grukka", t: "I'll die with my axe in my hand, sister. Like I always said.", m: "defiant" },
      { s: "grukka", t: "Take Moss. Ride. Don't look back.", m: "sad" },
      { n: "Varg rides into the bog on his dire wolf. No one follows." },
      { n: "In the ruins, a small halfellow in a patched coat walks up to the Speaking Stones and sets down a pie." },
      { s: "hobby", t: "For the Warchief. He kept his word. That's rarer than geese.", m: "sad" },
      { n: "Somewhere behind her, a goose honks. Gnash screams." },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The halfellows have won by holding the Marches. Every field from the bog to the hills flies their gold banner, but the Bloodmire Clans still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "The halfellows hold the Marches. No army. No walls. Just… *everywhere*.", m: "defiant" },
      { s: "grukka", t: "New fence. Same bog. …This time, we build inside it. Plant a hedge, boy.", m: "defiant" },
      { s: "varg", t: "A hedge, Father?", m: "bashful" },
      { s: "grukka", t: "They beat us with hedges twice. I'm not too proud to learn.", m: "defiant" },
    ],
  },
};
