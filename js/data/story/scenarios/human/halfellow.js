/**
 * STORY SCENARIO -- human/halfellow, "The Unpaid Tab"
 * The granaries that feed Westmarch fly a rival banner, and Hobby Trickgrin
 * is far cleverer than the Temple expected. Aldric's tab becomes a matter
 * of state, and Corvin refuses to pay it on principle. No Orcs: at B6
 * Corvin uncovers the Last Parley (shared).
 * Shared defaults: js/data/story/shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/halfellow"] = {
  title: "The Unpaid Tab",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn.", m: "fervent" },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*.", m: "wry" },
      { s: "maren", t: "And the Hearthlands grow half the bread in our cities. If the halfellows choose to hold on to it, Westmarch goes hungry.", m: "resolute" },
      { n: "A messenger arrives with a parcel from the Hearthlands, the halfellows' country of hedgerows and round doors. It is tied with a ribbon." },
      { s: "corvin", t: "*(opening it)* A bill. From The Goose & Kettle, the halfellows' oldest pub. “Lord-Paladin Aldric Ashcroft: four hundred silver. *Overdue*.”", m: "wry" },
      { s: "aldric", t: "It is a *tithe*. For the pub's spiritual wellbeing.", m: "fervent" },
      { n: "In the Hearthlands, Mayor Hobby Trickgrin, leader of the halfellows, is already late for three meetings." },
      { s: "hobby", t: "Westmarch will want our granaries. Let them *ask*. Nicely. With the four hundred silver.", m: "scheming" },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises where two rivers meet. Surveyors and priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's surveyors and priests ride out together to choose the site of a second city. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty.", m: "fervent" },
      { s: "corvin", t: "It must be *surveyed*. And it needs its own fields. We can't keep buying bread from people we're at war with.", m: "wry" },
      { s: "maren", t: "Consecrate it. Survey it. And plant wheat. We'll grow our own bread before the halfellows think of holding theirs back.", m: "resolute" },
    ],
    B2: [
      { n: "The road to the Hearthlands, at dusk. Human soldiers and halfellow militia have clashed over a bread cart, the first battle of the war." },
      { s: "aldric", t: "Victory! The Dawn guided our swords!", m: "fervent" },
      { s: "corvin", t: "Against *bakers*, Lord-Paladin. I'd keep the hymns short.", m: "wry" },
      { s: "maren", t: "Three hundred years they fed us. And our first battle was over *bread*.", m: "sad" },
      { s: "hobby", t: "*(in the Hearthlands)* First blood. Over a bread cart. I'm not grinning, Goldie. Not this time.", m: "sad" },
    ],
    // The tab becomes a matter of state.
    B3: [
      { n: "The royal council chamber of {capital}. On the table, where the war maps should be, lies a very long scroll: the Lord-Paladin's bar tab at The Goose & Kettle." },
      { s: "corvin", t: "The halfellows have made it a condition of *any* truce, Majesty. The tab first. Then we can talk about granaries.", m: "wry" },
      { s: "aldric", t: "The Temple will not pay a pub! It is beneath the dignity of the Dawn!", m: "angry" },
      { s: "corvin", t: "And the Collegium will not pay it on *principle*. I didn't drink it.", m: "wry" },
      { s: "maren", t: "So Westmarch goes to war with its own granary because my brother likes *halfellow ale*.", m: "angry" },
      { s: "aldric", t: "…It is very good ale, sister.", m: "happy" },
      { s: "maren", t: "Pay it, Aldric. From your own purse. And then we'll talk about granaries.", m: "resolute" },
      { n: "Aldric pays. Hobby sends back a receipt, and a second bill, for interest." },
    ],

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "aldric", t: "A sign.", m: "fervent" },
      { s: "maren", t: "No, brother. It's the land. It was always the land.", m: "happy" },
      { n: "Maren writes the first line of the new charter for the Marches. Its first clause: every generation must renew it, or it lapses. Its second: *Westmarch thanks the Hearthlands for the bread*." },
      { s: "hobby", t: "*(reading it in the Hearthlands)* Three hundred years. And they finally said it. In *writing*.", m: "happy", req: { alive: "halfellow" } },
      { s: "corvin", t: "A renewable Omen, and a thank-you note. How very *efficient*.", m: "wry" }, { s: "aldric", t: "The thank-you note was mine, Archmage. I wrote it myself. I owed them that long before I owed them four hundred silver.", m: "happy" },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying the Hearthlands. The hedgerows are quiet, and the pub is shut." },
      { s: "stone", t: "REMAINS." },
      { n: "Maren sits alone with the pen, and a receipt for four hundred silver, marked *paid*." },
      { s: "aldric", t: "The Temple proclaims a divine victory, Majesty.", m: "fervent" },
      { s: "corvin", t: "Over the people who fed us. I'd keep that proclamation short, Lord-Paladin.", m: "wry" },
      { s: "maren", t: "Three hundred years of bread. And we never said thank you. Put that in the charter. First.", m: "sad" },
      { s: "corvin", t: "Every Accord begins with someone who won, Majesty. The trick is being the one who *stops*.", m: "sad" }, { s: "maren", t: "Then we stop here, today. Before there's no one left to stop *for*.", m: "resolute" },
    ],
    "E-Fallen": [
      { n: "The halfellows have broken Westmarch. {capital} is the last human city standing, and nobody can quite work out how it happened." },
      { n: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe.", m: "sad" },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "corvin", t: "*(tucking it under his arm)* Some questions deserve to stay open.", m: "sad" },
      { s: "maren", t: "Write it down. Someone… write it down.", m: "sad" },
      { n: "In the ruins, a halfellow in a patched coat climbs the Cathedral steps and pins a piece of paper to the great door." },
      { s: "hobby", t: "*(the paper)* “Tab: *closed*. — H.T.”", m: "scheming" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The halfellows have won by holding the Marches. Every field from the river to the hills flies the gold of the Hearthlands, but Westmarch still stands." },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure. The Collegium advised us badly.", m: "angry" },
      { s: "corvin", t: "It's the Temple's failure. We lost the Marches over a *bar tab*, Lord-Paladin.", m: "wry" },
      { n: "The council chamber erupts. The divide Maren held shut through every battle cracks open the moment the war is lost." },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*.", m: "angry" },
      { s: "maren", t: "The halfellows hold the Marches now. Then we learn to feed ourselves, and trade fairly for the rest. Westmarch adapts. …And, Aldric. Say *thank you* for the bread. In person.", m: "resolute" },
    ],
  },
};
