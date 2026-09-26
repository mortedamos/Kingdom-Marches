/**
 * STORY SCENARIO -- human/dwarf, "The Cathedral Debt"
 * Brunna calls in the Cathedral debt, payable in land. The Temple is
 * outraged at owing anyone but the Dawn; Corvin is smug that it was "the
 * Temple's idea". The engine of the story is the two factions blaming each
 * other while the Dwarves take land. No Orcs: at B6 Corvin uncovers the
 * Last Parley (shared). Shared defaults: js/data/story/shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/dwarf"] = {
  title: "The Cathedral Debt",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn.", m: "fervent" },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*.", m: "wry" },
      { n: "A messenger arrives before anyone can answer. He carries a letter sealed in dwarvish bronze, from Karrak, the mountain realm of the Dwarves." },
      { s: "brunna", t: "*(her letter)* “Majesty. Your Dawn Cathedral was built with Karrak stone, on Karrak credit, *due when the Accord ends*. It has ended. Karrak will accept payment in land. — Brunna Stonefast, High Thane.”", m: "proud" },
      { s: "aldric", t: "The Temple owes *nobody* but the Dawn!", m: "angry" },
      { s: "corvin", t: "The Temple owes Karrak eleven thousand gold, Lord-Paladin. The debt was the *Temple's* idea. I have the minutes.", m: "wry" },
      { s: "maren", t: "Then we'll settle it. In gold, in law, and without handing over a single field.", m: "resolute" },
      { n: "In Karrak, the Dwarf Thane's uncle, Loremaster Oskar Grimgate, opens the Book of Grudges to a very old page." },
      { s: "oskar", t: "Entry nine hundred and three: Westmarch, the Cathedral. Payment deferred. I've waited a thousand years to write the word *overdue*.", m: "grudging" },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises where two rivers meet. Surveyors and priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's surveyors and priests ride out together to choose the site of a second city. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty.", m: "fervent" },
      { s: "corvin", t: "It must be *surveyed* before a single stone is laid. And, Majesty, not with Karrak stone. We can't afford the interest.", m: "wry" },
      { s: "maren", t: "Consecrate it at sunrise. Survey it at noon. Build it by evening. With *local* stone.", m: "resolute" },
    ],
    B2: [
      { n: "The northern foothills, at dusk. Human soldiers and dwarf warriors have clashed over a surveyor's camp, the first battle of the war." },
      { s: "aldric", t: "Victory! The Dawn guided our swords!", m: "fervent" },
      { s: "corvin", t: "The *Collegium's maps* guided our swords, Lord-Paladin. The Dawn was busy setting.", m: "wry" },
      { s: "maren", t: "The Dwarves are collecting their debt with axes now. Brunna Stonefast always did prefer cash on delivery.", m: "happy" },
      { n: "In Karrak, Oskar opens the Book of Grudges." },
      { s: "oskar", t: "Entry {grudge} in the Book of Grudges: Westmarch. Late payers. *Armed* late payers.", m: "grudging" },
    ],
    // The factions blame each other while the Dwarves take land.
    B3: [
      { n: "The royal council chamber of {capital}, packed to the rafters. On the table lies the original loan contract for the Dawn Cathedral, a thousand years old, in dwarvish and in human script." },
      { s: "corvin", t: "Clause four. “Signed on behalf of the Temple of the Dawn.” Not the Crown. Not the Collegium. The *Temple*.", m: "wry" },
      { s: "aldric", t: "The Temple built the Cathedral for *all* Westmarch! The debt belongs to the Crown!", m: "angry" },
      { s: "corvin", t: "Then the Crown will want the Cathedral back, I suppose. We could use it as a library.", m: "wry" },
      { n: "Half the council cheers. The other half shouts. A dwarf envoy stands at the back of the chamber, patiently waiting for the arguing to stop." },
      { s: "maren", t: "*(to the envoy)* Tell your Thane that Westmarch will pay. In gold. Once we've decided who's paying.", m: "resolute" },
      { s: "brunna", t: "*(later, reading the envoy's report)* They're still arguing about whose debt it is. Good. Take another valley while they decide.", m: "proud" },
    ],

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "aldric", t: "A sign.", m: "fervent" },
      { s: "maren", t: "No, brother. It's the land. It was always the land.", m: "happy" },
      { n: "Maren writes the first line of the new charter for the Marches. Its first clause, one the old Accord never had: every generation must renew it, or it lapses." },
      { s: "maren", t: "And its second clause, Archmage: the Cathedral debt, paid in full. In gold. With interest. By the *Crown*.", m: "resolute" },
      { s: "brunna", t: "*(reading it in Karrak)* Paid. In full. Uncle, strike entry nine hundred and three.", m: "proud", req: { alive: "dwarf" } },
      { s: "oskar", t: "*(striking it, very slowly)* A thousand years. …I shall miss it.", m: "sad", req: { alive: "dwarf" } },
      { s: "corvin", t: "A renewable Omen, and a paid debt. How very *efficient*.", m: "wry" },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying the Dwarves. The mountain holds are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Maren sits alone with the pen, and a thousand-year-old loan contract that no one will ever collect." },
      { s: "aldric", t: "The Temple proclaims a divine victory, Majesty. And the debt is… void.", m: "fervent" },
      { s: "corvin", t: "Nobody left to pay, Lord-Paladin. The Temple has found the most expensive way to settle an account in history.", m: "wry" },
      { s: "maren", t: "Find their Loremaster's book, if it survived. Open it to entry nine hundred and three. And write *paid*.", m: "sad" },
      { s: "corvin", t: "Every Accord begins with someone who won, Majesty. The trick is being the one who *stops*.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Dwarves have broken Westmarch. {capital} is the last human city standing, and dwarf warriors are at its gates." },
      { n: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe.", m: "sad" },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "corvin", t: "*(tucking it under his arm)* Some questions deserve to stay open.", m: "sad" },
      { s: "maren", t: "Write it down. Someone… write it down.", m: "sad" },
      { n: "In the ruins, the Dwarf Thane climbs the Cathedral steps, the stone her ancestors quarried for it cold beneath her boots." },
      { s: "brunna", t: "Debt paid. Uncle, write it down: “Westmarch. Worthy foe.”", m: "proud", alt: { s: "oskar", t: "Debt paid. Entry nine hundred and three: *collected*. …Westmarch. Worthy foe.", m: "grudging" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches. A ring of dwarf stonework circles the Marchstone, but Westmarch still stands." },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure. The Collegium advised us badly.", m: "angry" },
      { s: "corvin", t: "It's the Temple's failure. It was the Temple's *debt*, Lord-Paladin.", m: "angry" },
      { n: "The council chamber erupts. The divide Maren held shut through every battle cracks open the moment the war is lost." },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*.", m: "angry" },
      { s: "maren", t: "The Dwarves hold the Marches now. Then we'll pay the Cathedral debt. In full. With interest. And we'll learn everything their runesmiths will teach us. Westmarch adapts. …Corvin, stop smiling.", m: "resolute" },
    ],
  },
};
