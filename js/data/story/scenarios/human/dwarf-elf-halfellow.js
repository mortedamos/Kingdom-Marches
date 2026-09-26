/**
 * STORY SCENARIO -- human/dwarf+elf+halfellow, "The Quiet Kingdoms"
 * No Orcs, and no obvious villain. Everyone is reasonable, except Vaelis,
 * who is merely *uninterested*. Hobby keeps proposing a Moot, and Maren
 * realises Westmarch is the kingdom everyone fears (B3). Threads:
 * bloodline, mercy, whisper (shared). No Orcs: at B6 Corvin uncovers the
 * Last Parley (shared). Shared defaults: shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/dwarf+elf+halfellow"] = {
  title: "The Quiet Kingdoms",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn.", m: "fervent" },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*.", m: "wry" },
      { s: "maren", t: "Karrak, the Silverwood, the Hearthlands. Dwarves, Elves, halfellows. No Orcs, no raiders. Just sensible neighbours.", m: "happy" },
      { s: "corvin", t: "Sensible neighbours with armies, Majesty.", m: "wry" },
      { n: "In Karrak, High Thane Brunna Stonefast reaches for her ledgers. In the Hearthlands, Mayor Hobby Trickgrin reaches for a pen. In the Silverwood, Lord Vaelis Nightbloom does not reach for anything." },
      { s: "brunna", t: "Westmarch owes us for the Cathedral. We'll start there.", m: "proud" },
      { s: "hobby", t: "Everyone's being so *reasonable*. Let's have a Moot! All four crowns, one table, and a very large pie.", m: "happy" },
      { s: "vaelis", t: "A war between the reasonable. How *exhausting*. Wake me when it becomes interesting.", m: "aloof" },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises where two rivers meet. Surveyors and priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's surveyors and priests ride out together to choose the site of a second city. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty.", m: "fervent" },
      { s: "corvin", t: "It must be *surveyed*. And, Majesty, the halfellows have written. *Again*. About the Moot.", m: "wry" },
      { s: "maren", t: "Consecrate it. Survey it. Tell the Mayor… we'll think about it.", m: "resolute" },
    ],
    B2: [
      { n: "The northern foothills, at dusk. Human soldiers and dwarf warriors have clashed over a surveyor's camp, the first battle of the war.", req: { firstBlood: "dwarf" },
        alt: { n: "The forest's edge, at dusk. Human soldiers and elf rangers have clashed over a surveyor's stake, the first battle of the war.", req: { firstBlood: "elf" },
          alt: "The road to the Hearthlands, at dusk. Human soldiers and halfellow militia have clashed over a bread cart, the first battle of the war." } },
      { s: "aldric", t: "Victory! The Dawn guided our swords!", m: "fervent" },
      { s: "corvin", t: "The *Collegium's maps* guided our swords, Lord-Paladin. The Dawn was busy setting.", m: "wry" },
      { s: "maren", t: "Sensible neighbours. With armies. You did warn me, Archmage.", m: "sad" },
    ],
    // The kingdom everyone fears.
    B3: [
      { n: "The royal council chamber of {capital}. Corvin lays three intercepted letters on the table: one from Karrak, one from the Silverwood, one from the Hearthlands." },
      { s: "corvin", t: "The Dwarves to the halfellows: *Westmarch's mages answer to a sun-cult*. The halfellows to the Elves: *Westmarch has the biggest army in the Marches*. The Elves to the Dwarves, and I quote: *the mayflies are the only danger here*.", m: "wry" },
      { s: "aldric", t: "They fear the Dawn's might! As they should!", m: "fervent" },
      { s: "corvin", t: "They fear *us*, Lord-Paladin. Not the Dawn. Us. We're the Orcs in this story.", m: "sad" },
      { n: "Maren reads the letters twice. Nobody in the chamber speaks." },
      { s: "maren", t: "No Orcs. No villain. Three quiet kingdoms, and every one of them is afraid of Westmarch.", m: "sad" },
      { s: "maren", t: "…Write to the Mayor, Corvin. Tell her yes to the Moot. Let them see we can sit at a table.", m: "resolute" },
      { s: "hobby", t: "*(a week later, in the Hearthlands, reading the reply)* She said *yes*! Goldie! Pie! The biggest pie!", m: "happy" },
      { s: "vaelis", t: "*(in the Silverwood, reading the invitation)* A pie. The Queen of the only dangerous kingdom in the Marches has agreed to a *pie*. …I shall attend. Purely to observe.", m: "aloof" },
    ],

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "aldric", t: "A sign.", m: "fervent" },
      { s: "maren", t: "No, brother. It's the land. And the land was afraid of us. We'll spend my reign showing it why it needn't be.", m: "resolute" },
      { n: "The new charter's first clause: every generation must renew it. Its second: *a Moot, every year, at a halfellow table*." },
      { s: "hobby", t: "*(in the Hearthlands)* A Moot! Every year! In *writing*!", m: "happy", req: { alive: "halfellow" } },
      { s: "brunna", t: "*(in Karrak)* A Moot's fine. As long as the Cathedral debt's on the agenda.", m: "proud", req: { alive: "dwarf" } },
      { s: "vaelis", t: "*(in the Silverwood)* Every *year*? …I suppose I shall have to go. Purely to observe.", m: "aloof", req: { alive: "elf" } },
      { s: "corvin", t: "A renewable Omen, and an annual pie. How very *efficient*.", m: "wry" },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying every other crown in the Marches. The mountains, the forest and the fields are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Maren sits alone with the pen, and a halfellow invitation to a Moot that will never happen." },
      { s: "aldric", t: "The Temple proclaims a divine victory, Majesty.", m: "fervent" },
      { s: "corvin", t: "They were afraid of us, Majesty. And they were right.", m: "sad" },
      { s: "maren", t: "There were no villains in this war, Corvin. Until we won it.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "Westmarch has been broken. {capital} is the last human city standing." },
      { n: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe.", m: "sad" },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "corvin", t: "*(tucking it under his arm)* They were afraid of us. Three quiet kingdoms, afraid enough to band together. …We should have listened.", m: "sad" },
      { s: "maren", t: "Write it down. Someone… write it down.", m: "sad" },
      { s: "brunna", t: "*(on the Cathedral steps)* Karrak stone. Back in Karrak hands. Uncle, write it down: “Westmarch. Worthy foe.”", m: "proud", req: { conqueror: "dwarf" } },
      { s: "vaelis", t: "*(in the empty Cathedral)* The only dangerous kingdom in the Marches. …How *quiet* it is now.", m: "sad", req: { conqueror: "elf" } },
      { s: "hobby", t: "*(pinning a note to the Cathedral door)* “The Moot will still meet. Your chair's still there. — H.T.”", m: "sad", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but Westmarch still stands.", req: { winner: "dwarf" },
        alt: { n: "The Elves have won by holding the Marches, but Westmarch still stands.", req: { winner: "elf" },
          alt: "The halfellows have won by holding the Marches, but Westmarch still stands." } },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure. The Collegium advised us badly.", m: "angry" },
      { s: "corvin", t: "It's the Temple's failure. The Marches were afraid of us, Lord-Paladin, and you kept giving them reasons.", m: "angry" },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*. We'll serve the new crown, and go to every Moot we're invited to. Westmarch adapts. Crowns outlast crowns.", m: "resolute" },
    ],
  },
};
