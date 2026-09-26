/**
 * STORY SCENARIO -- orc/dwarf+human, "Ledger and Anvil"
 * The creditor and the debtor, and the clans raid both. Grukka's grievance
 * with Westmarch is the Last Parley; with Karrak, a thousand years. B3: the
 * Clans intercept Brunna's debt-collectors and Maren's gold on the same
 * road. Threads: lovers (shared B5 coup).
 * Shared defaults: js/data/story/shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/dwarf+human"] = {
  title: "Ledger and Anvil",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!", m: "gleeful" },
      { s: "grukka", t: "Karrak and Westmarch. The Dwarves lent the Humans a cathedral, and now they'll squabble over the bill. And neither of them will be watching the bog.", m: "defiant" },
      { s: "grukka", t: "And the Queen of Westmarch owes *me* something too. An apology, for the parley. I'll collect it the orc way.", m: "angry" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher." },
      { s: "gnash", t: "Gnash collect! Gnash VERY good collector! Gnash collect heads!", m: "happy" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount." },
      { s: "varg", t: "Father. The dwarves I met at the Midsummer Fair… they weren't all like the songs say.", m: "bashful" },
      { s: "skarra", t: "*(stroking her frog)* No, Varg. I'm *sure* they weren't. Hee hee.", m: "gleeful" },
    ],
    B2: [
      { n: "The eastern ridge, at dawn. Orc and dwarf warriors have clashed in the first skirmish of the war.", req: { firstBlood: "dwarf" },
        alt: "The river road, at dusk. Orc raiders and human soldiers have clashed over a supply wagon, the first battle of the war." },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood! The ancestors are HUNGRY, little Warchief!", m: "gleeful" },
      { s: "gnash", t: "Gnash love avenging! Avenging is smashing with extra reasons!", m: "happy" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "The ancestors say avenge the fallen, Father. What if I don't want anyone to fall?", m: "sad" },
    ],
    // The ledger and the anvil, robbed on the same road.
    B3: [
      { n: "A crossroads between the mountains and the river. Orc raiders have ambushed two convoys on the same morning: a Westmarch wagon of gold, and a dwarf escort sent to collect it." },
      { n: "The gold is the first payment on the Cathedral debt, the loan Karrak made Westmarch a thousand years ago. The Clans now have all of it." },
      { s: "gnash", t: "*(sitting on the pile)* Shiny! Gnash rich! Gnash buy… more cleaver!", m: "happy" },
      { s: "grukka", t: "The Humans paid it. The Dwarves never got it. Each one will blame the other.", m: "defiant" },
      { s: "varg", t: "Father, we could give it back. To either one. They'd owe us.", m: "bashful" },
      { s: "skarra", t: "GIVE IT BACK? Varg, you are so SOFT! Is this a Warchief's son or a dwarf's *bookkeeper*?", m: "gleeful" },
      { n: "Varg flinches. Skarra smiles." },
      { s: "grukka", t: "Keep the gold. Keep talking, boy. I'm listening. …Just not about this.", m: "defiant" },
      { n: "In Karrak, Loremaster Oskar Grimgate opens the Book of Grudges to an old page, and a new one." },
      { s: "oskar", t: "Entry {grudge} in the Book of Grudges: the Orcs, for robbing Westmarch of *our* money. The first grudge I've ever written on the Humans' behalf. I feel unwell.", m: "grudging" },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "Across the Marches, the orc settlements have become real towns, with walls, wells, and fields that don't rot. Paid for, in part, with Westmarch's gold." },
      { s: "grukka", t: "Not a fence. A hearth. …Don't tell anyone I said hearth.", m: "happy" },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure.", m: "happy" },
      { n: "That night Grukka rides north to Karrak, where music thunders through the Thane's Hall. Sigrun is playing her song for Varg out loud, for the first time.", req: { alive: "dwarf" } },
      { s: "brunna", t: "Stay by the door, Warchief. And the gold. We'll discuss the gold.", m: "happy", req: { alive: "dwarf" } },
      { s: "grukka", t: "I'll stay by the door. The gold stays with me.", m: "defiant", req: { alive: "dwarf" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying Karrak and Westmarch. The mountains and the river cities are silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { s: "grukka", t: "The ledger and the anvil. Both broken. All the gold in the Marches is ours, and nothing to spend it on.", m: "sad" },
      { s: "varg", t: "You told me to keep talking, Father, so I'll say it. I had someone to keep. You took the whole mountain.", m: "sad" },
      { n: "Varg turns and rides away on Moss. At the edge of the bog, the great wolf stops beside an Underway door that will never open again, and lies down to wait." },
    ],
    "E-Fallen": [
      { n: "The Dwarves have broken the Orcs. {capital}, the last orc town, is burning.", req: { conqueror: "dwarf" },
        alt: "Westmarch has broken the Orcs. {capital}, the last orc town, is burning, and the Knights of the Dawn are at its gates." },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! You lost the bog! Skarra always said so—", m: "angry" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die.", m: "sad" },
      { s: "grukka", t: "I'll die with my axe in my hand, sister. Like I always said.", m: "defiant" },
      { s: "grukka", t: "Take Moss. Ride. Don't look back.", m: "sad" },
      { n: "Varg rides into the bog on his dire wolf. No one follows." },
      { s: "oskar", t: "*(in Karrak)* The last entry in Volume Seven: “The Bloodmire Clans. Broken.” …And the gold, recovered. Amend it. “Worthy foe.”", m: "grudging", req: { conqueror: "dwarf" } },
      { s: "maren", t: "*(in the ashes)* Their Warchief went to our parley unarmed.", m: "sad", req: { conqueror: "human" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "dwarf" },
        alt: "Westmarch has won by holding the Marches, but the Bloodmire Clans still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "New fence. Same bog. …This time, we build inside it. We've the gold for it.", m: "defiant" },
      { s: "varg", t: "Father, I'm riding to Karrak.", m: "bashful", req: { alive: "dwarf" }, alt: "Then let's build, Father." },
      { s: "grukka", t: "…Knock loud. And take them their gold back. *Some* of it.", m: "happy", req: { alive: "dwarf" } },
    ],
  },
};
