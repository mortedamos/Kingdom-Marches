/**
 * STORY SCENARIO -- human/dwarf+halfellow, "The Ale Tariff"
 * The ale tariff explodes, and Westmarch, which brokered that trade, is
 * caught in the middle. The lightest human scenario: Aldric's tab, Goldie's
 * ledger and Oskar's one halfellow grudge all collide (B3). No Orcs: at B6
 * Corvin uncovers the Last Parley (shared). Shared defaults: shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/dwarf+halfellow"] = {
  title: "The Ale Tariff",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn.", m: "fervent" },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*.", m: "wry" },
      { s: "corvin", t: "And the first casualty of the war, Majesty, is the *ale tariff*. Karrak's brewers use halfellow barley. Westmarch set the price between them, a hundred years ago.", m: "wry" },
      { s: "maren", t: "So the Dwarves and the halfellows will both blame *us* for the price of beer.", m: "resolute" },
      { s: "aldric", t: "A grave matter, sister. Gravely grave.", m: "fervent" },
      { s: "corvin", t: "The Lord-Paladin speaks from long personal experience.", m: "wry" },
      { n: "In Karrak, the Dwarves' mountain realm, Loremaster Oskar Grimgate opens the Book of Grudges. In the Hearthlands, the halfellow Mayor Hobby Trickgrin is already late for the harvest committee." },
      { s: "oskar", t: "Entry nine hundred and four: the ale tariff. My only grudge against the halfellows. I've polished it for a century.", m: "grudging" },
      { s: "hobby", t: "The Dwarves want our barley cheaper, Westmarch wants our bread cheaper, and *nobody* wants to pay the Lord-Paladin's bar tab.", m: "scheming" },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises where two rivers meet. Surveyors and priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's surveyors and priests ride out together to choose the site of a second city. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty. And it must have a tavern. For the *soldiers*.", m: "fervent" },
      { s: "corvin", t: "For the soldiers. Of course, Lord-Paladin.", m: "wry" },
      { s: "maren", t: "Consecrate it. Survey it. Build a brewery, and stop buying ale from people we're fighting.", m: "resolute" },
    ],
    B2: [
      { n: "The northern foothills, at dusk. Human soldiers and dwarf warriors have clashed over a barley convoy, the first battle of the war.", req: { firstBlood: "dwarf" },
        alt: "The road to the Hearthlands, at dusk. Human soldiers and halfellow militia have clashed over a bread cart, the first battle of the war." },
      { s: "aldric", t: "Victory! The Dawn guided our swords!", m: "fervent" },
      { s: "corvin", t: "Over *beer*, Lord-Paladin. I'd keep the hymns short.", m: "wry" },
      { s: "maren", t: "The first battle of the war for the Marches, and it was about the price of ale. …Write it down. Someone will laugh at this in a hundred years.", m: "happy" },
    ],
    // The tab, the ledger and the grudge collide.
    B3: [
      { n: "A tent at the border, flying three banners: the purple of Westmarch, the bronze of Karrak and the gold of the Hearthlands. Maren has called a trade meeting, war or no war." },
      { n: "Present: the Dwarves' Loremaster Oskar Grimgate with the Book of Grudges; Goldie Trickgrin, keeper of the halfellows' oldest pub, with her ledger; and, unwisely, the Lord-Paladin." },
      { s: "goldie", t: "Before we talk tariffs, Majesty. *Four hundred silver*. Lord-Paladin Aldric Ashcroft. Overdue.", m: "stern" },
      { s: "aldric", t: "It is a *tithe*—", m: "angry" },
      { s: "oskar", t: "*(opening the Book)* Entry nine hundred and four, the ale tariff. *Sub-entry*: the Lord-Paladin, for drinking dwarf ale at a halfellow pub and paying neither.", m: "grudging" },
      { s: "goldie", t: "*(opening her ledger)* He had seven pints of it. On the twelfth of last month. I have it *here*.", m: "stern" },
      { s: "corvin", t: "Majesty, I believe this is the first time in history a dwarf and a halfellow have agreed on anything.", m: "wry" },
      { s: "maren", t: "Aldric. Pay them. Both of them. From your own purse. This is the only treaty this war is going to get.", m: "resolute" },
    ],

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "aldric", t: "A sign.", m: "fervent" },
      { s: "maren", t: "No, brother. It's the land. It was always the land.", m: "happy" },
      { n: "Maren writes the first line of the new charter for the Marches. Its first clause: every generation must renew it. Its second: *a fair price for ale*." },
      { s: "oskar", t: "*(in Karrak)* Entry nine hundred and four. Struck through. I've nothing left against the halfellows. I feel quite naked.", m: "grudging", req: { alive: "dwarf" } },
      { s: "goldie", t: "*(in the Hearthlands)* And the Lord-Paladin's tab, Majesty?", m: "stern", req: { alive: "halfellow" } },
      { s: "aldric", t: "*(sighing)* …Paid. In full. With interest.", m: "sad" },
      { s: "corvin", t: "A renewable Omen, a fair price for beer, and a paid bar tab. How very *efficient*.", m: "wry" },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying the Dwarves and the halfellows. The mountain breweries and the barley fields are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Maren sits alone with the pen. On the table beside it: a receipt for four hundred silver, marked *paid*, and a page torn from a very old book." },
      { s: "aldric", t: "The Temple proclaims a divine victory, Majesty.", m: "fervent" },
      { s: "corvin", t: "Over the brewers and the bakers. I'd keep the hymns short, Lord-Paladin.", m: "wry" },
      { s: "maren", t: "It started with the price of ale. Nobody will laugh at this in a hundred years. …Write it down anyway.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Dwarves have broken Westmarch. {capital} is the last human city standing, and dwarf warriors are at its gates.", req: { conqueror: "dwarf" },
        alt: "The halfellows have broken Westmarch. {capital} is the last human city standing, and nobody can quite work out how it happened." },
      { n: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe.", m: "sad" },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "corvin", t: "*(tucking it under his arm)* Some questions deserve to stay open.", m: "sad" },
      { s: "maren", t: "Write it down. Someone… write it down.", m: "sad" },
      { s: "oskar", t: "*(on the Cathedral steps)* Entry nine hundred and three, the Cathedral debt: collected. Entry nine hundred and four: …the tab. Also collected.", m: "grudging", req: { conqueror: "dwarf" } },
      { s: "hobby", t: "*(pinning a note to the Cathedral door)* “Tab: *closed*. — H.T.”", m: "sad", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but Westmarch still stands.", req: { winner: "dwarf" },
        alt: "The halfellows have won by holding the Marches, but Westmarch still stands." },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure.", m: "angry" },
      { s: "corvin", t: "It's the Temple's failure. And, specifically, the Temple's *bar tab*.", m: "wry" },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*. We'll serve the new crown, and learn from it. Westmarch adapts. …And we'll pay for our own ale.", m: "resolute" },
    ],
  },
};
