/**
 * STORY SCENARIO -- orc/human, "The Last Parley"
 * Grukka kept his word, and he knows it. The truth about Aldric surfaces
 * through captured Temple records (B3 override, gated on a captured human
 * city; fallback: a deserter's word). Skarra would rather it didn't; she
 * likes the grudge. Shared defaults: js/data/story/shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/human"] = {
  title: "The Last Parley",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!" },
      { n: "A season ago, Grukka met the Human Queen of Westmarch at a border parley. The ground shook, a human knight drew his sword, and blood was spilled. Grukka has not forgotten." },
      { s: "grukka", t: "I went to that parley unarmed. I kept my word. Their knight struck first, and their Queen calls *us* oath-breakers." },
      { s: "skarra", t: "And Skarra LOVES it! A grudge this juicy only comes along once a century!" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher, grinning over a cleaver the size of a door." },
      { s: "gnash", t: "Humans! Gnash smash humans! They have shiny hats!" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount." },
      { s: "varg", t: "Father. What if the Queen doesn't know? What if her knight lied to her too?" },
      { s: "grukka", t: "Then she should ask him, boy. Loudly." },
    ],
    B2: [
      { n: "The river road, at dusk. Orc raiders and human soldiers have clashed over a supply wagon, the first battle of the war." },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Human blood on the road, little Warchief! The ancestors are HUNGRY! And so is Skarra's grudge-jar!" },
      { s: "gnash", t: "Gnash got shiny hat! …Hat has head in it. Gnash give head back." },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "The ancestors say avenge the fallen, Father. What if I don't want anyone to fall?" },
    ],
    // The Temple's records. Gated on taking a human city.
    B3: {
      req: { seen: "capture:human" },
      fallbackRound: 0,
      lines: [
        { n: "The orc war council in {capital}. Varg drops a bundle of scrolls on the table, bound in purple ribbon and sealed with the sunburst of the Temple of the Dawn." },
        { s: "varg", t: "Temple records, Father. From a chapel we raided. One of them is about the parley." },
        { s: "grukka", t: "I can't read human, boy." },
        { s: "varg", t: "I can. A little. *(reading slowly)* “The Lord-Paladin… drew first… the ground shook… he mistook it for… an ambush.”" },
        { n: "The fire pit crackles. Nobody at the council speaks." },
        { s: "grukka", t: "The Lord-Paladin. The Queen's own brother. He struck first. And he told her *we* did." },
        { s: "varg", t: "Father, we could send it to her. She might not know." },
        { s: "skarra", t: "*(snatching the scroll)* Send it? SEND it? And ruin the best grudge in a hundred years? Skarra will *eat* this scroll first!" },
        { s: "grukka", t: "Give it back, Skarra." },
        { n: "Skarra does not give it back. She tucks it into her robes, next to her frog, and cackles all the way back to the Speaking Stones." },
        { fx: { flag: "parleyScroll" } },
        { s: "grukka", t: "*(to Varg, quietly)* Doesn't matter. I know now. That's enough." },
      ],
      fallback: [
        { n: "The orc war council in {capital}. A human deserter has been dragged before the fire pit, a young squire of the Temple of the Dawn." },
        { s: "grukka", t: "You were at the parley, boy. I saw your face." },
        { n: "The squire nods, shaking." },
        { s: "grukka", t: "Who struck first?" },
        { n: "A very long silence. Then, so quietly the whole council has to lean in:" },
        { n: "“The Lord-Paladin. The Queen's brother. The ground shook, and he drew. Nobody's allowed to say it.”" },
        { s: "grukka", t: "*(to his captains)* Let him go. Give him a horse." },
        { s: "skarra", t: "LET HIM GO?! He knows the truth, brother! What if he TELLS someone? Skarra LIKES the grudge!" },
        { s: "grukka", t: "That's why I'm letting him go, Skarra." },
      ],
    },

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "Across the Marches, the orc settlements have become real towns, with walls, wells, and fields that don't rot." },
      { s: "grukka", t: "Not a fence. A hearth." },
      { s: "grukka", t: "…Don't tell anyone I said hearth." },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure." },
      { n: "That evening, a rider arrives from Westmarch under a white flag: the Lord-Paladin himself, alone and unarmed.", req: { alive: "human" } },
      { s: "aldric", t: "Warchief. At the parley. I struck first. The ground shook, and I was afraid. I have come to say so, to your face.", req: { alive: "human" } },
      { s: "grukka", t: "I know, paladin. I've known a long time. …Took you long enough.", req: { alive: "human" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying Westmarch. The river cities are silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { n: "Grukka sits atop the split Marchstone as if it were a throne. The stone is cold." },
      { s: "grukka", t: "The Queen never knew. Her brother never told her. And now there's nobody left to tell." },
      { s: "varg", t: "We knew, Father. We could have sent the truth. We sent an army instead." },
      { s: "grukka", t: "…Keep talking, boy. I deserve it." },
    ],
    "E-Fallen": [
      { n: "Westmarch has broken the Orcs. {capital}, the last orc town, is burning, and the Knights of the Dawn are at its gates." },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! You lost the bog! Skarra always said so—" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die." },
      { s: "grukka", t: "I'll die with my axe in my hand, sister. Like I always said." },
      { s: "grukka", t: "Take Moss. Ride. Don't look back." },
      { n: "Varg rides into the bog on his dire wolf. No one follows." },
      { n: "In the ashes, the Queen of Westmarch finds a scroll bound in purple ribbon, half-burned, sealed with the Temple's own sunburst. She reads it standing in the smoke.", req: { flag: "parleyScroll" } },
      { s: "maren", t: "“The Lord-Paladin drew first.” …Aldric. *Aldric*. …Write it down. All of it.", req: { flag: "parleyScroll" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "Westmarch has won by holding the Marches. Human roads run to the edge of the bog, but the Bloodmire Clans still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "The Queen holds the Marches. The Queen whose brother drew first." },
      { s: "grukka", t: "New fence. Same bog. …This time, we build inside it." },
      { s: "varg", t: "And the truth, Father?" },
      { s: "grukka", t: "Send it to her, boy. Wrapped in the ribbon. Let her read it on her new throne.", req: { flag: "parleyScroll" }, alt: "Tell her, boy. Loudly. Let her hear it on her new throne." },
    ],
  },
};
