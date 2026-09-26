/**
 * STORY SCENARIO -- human/halfellow+orc, "The Hearthlands Granary"
 * Skarra wants revenge on the Hearthlands for the Goose Rout, and Gnash
 * wants nothing to do with that goose. Maren must decide whether the
 * halfellow fields are hers to protect or hers to take (B3). Orcs in the
 * game: Aldric confesses at B6 (shared). Shared defaults: shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/halfellow+orc"] = {
  title: "The Hearthlands Granary",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn.", m: "fervent" },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*.", m: "wry" },
      { s: "maren", t: "The Orcs will come for the Hearthlands first. The Bog Witch has hated the halfellows for forty years. So Westmarch gets there before she does.", m: "resolute" },
      { n: "Forty years ago, the Orc Bog Witch Skarra sent a raiding party into the Hearthlands. A young halfellow named Hobby Trickgrin sent it home with traps, a bonfire and a very angry goose: the Goose Rout. Hobby is Mayor now." },
      { s: "aldric", t: "And the Lord-Paladin's… that is, *my*… account at the halfellows' pub remains in good standing.", m: "fervent" },
      { s: "corvin", t: "It's four hundred silver overdue, Lord-Paladin.", m: "wry" },
      { n: "In the Bloodmire, the swamp country of the Orcs, Skarra stands at the Speaking Stones beside Gnash, the Warchief's enormous ogre." },
      { s: "skarra", t: "The goose-girl first! Then the Queen! Gnash, are you READY?", m: "gleeful" },
      { s: "gnash", t: "Is goose there?", m: "confused" },
      { s: "skarra", t: "…Possibly.", m: "gleeful" },
      { s: "gnash", t: "Gnash not ready.", m: "sad" },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises where two rivers meet. Surveyors and priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's surveyors and priests ride out together to choose the site of a second city. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty.", m: "fervent" },
      { s: "corvin", t: "It must be *surveyed*, and it must have granaries of its own. If the Orcs burn the Hearthlands, Westmarch starves.", m: "wry" },
      { s: "maren", t: "Consecrate it. Survey it. And buy the Hearthlands' next harvest now, at a fair price, before Skarra can burn it.", m: "resolute" },
    ],
    B2: [
      { n: "The southern road, at dusk. Human soldiers and orc warriors have clashed over a raided grain wagon, the first battle of the war.", req: { firstBlood: "orc" },
        alt: "The road to the Hearthlands, at dusk. Human soldiers and halfellow militia have clashed over a bread cart, the first battle of the war." },
      { s: "aldric", t: "Victory! The Dawn guided our swords!", m: "fervent" },
      { s: "corvin", t: "The *Collegium's maps* guided our swords, Lord-Paladin. The Dawn was busy setting.", m: "wry" },
      { s: "aldric", t: "Then we'll share it, Archmage. Your maps found the ford. The Dawn kept my knights standing in it when the arrows came.", m: "fervent" },
      { s: "maren", t: "Grukka still thinks this is about the parley. Let him. We'll be three moves ahead while he's still remembering.", m: "sad", req: { firstBlood: "orc" },
        alt: "We've drawn blood from the people who feed us. …Write it down. And send the Mayor a letter." },
      { n: "Aldric stares at the floor and says nothing, which is not like him.", req: { firstBlood: "orc" } },
    ],
    // Protect the fields, or take them?
    B3: [
      { n: "The royal council chamber of {capital}. On the war map, orc war-bands are marked all along the southern edge of the Hearthlands." },
      { s: "corvin", t: "The Orcs will burn the halfellow fields by harvest, Majesty. Then Westmarch starves. So: we can *protect* the Hearthlands, or we can *take* them first.", m: "wry" },
      { s: "aldric", t: "The halfellows are our friends, sister. They fed our mother. They fed *me*. Rather a lot.", m: "happy" },
      { s: "corvin", t: "Friendship won't stop a Bog Witch, Lord-Paladin. Garrisons will. Ours. In *their* towns.", m: "wry" },
      { s: "maren", t: "If we march into the Hearthlands to protect them, the halfellows will call it an invasion. If we don't, Skarra will call it dinner.", m: "sad" },
      { n: "A letter arrives from the Hearthlands, in a hurried hand, with a jam stain in one corner." },
      { s: "hobby", t: "*(her letter)* “Majesty. We don't need protecting. We need *geese*. Lots of them. Send any you have. — H.T. P.S. The Lord-Paladin's tab is still open.”", m: "scheming" },
      { s: "maren", t: "…Send her geese. As many as we have. I want *everyone* to know.", m: "happy" },
    ],

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "aldric", t: "A sign.", m: "fervent" },
      { s: "maren", t: "No, brother. It's the land. It was always the land.", m: "happy" },
      { n: "Maren writes the first line of the new charter for the Marches. Its first clause: every generation must renew it. Its second: *the Hearthlands' fields are theirs, forever*." },
      { s: "hobby", t: "*(in the Hearthlands)* Forever! In *writing*! …And the tab?", m: "happy", req: { alive: "halfellow" } },
      { s: "aldric", t: "*(sighing)* …Paid.", m: "sad" },
      { s: "grukka", t: "*(in the Bloodmire)* Next time, Queen, I'll draw second. Tell your brother.", m: "defiant", req: { alive: "orc", seen: "B6" } },
      { s: "corvin", t: "A renewable Omen. How very *efficient*.", m: "wry" }, { s: "aldric", t: "Mock it if you like, Archmage. I renew my vows every morning, and I have never once found it wasteful.", m: "fervent" },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying the Hearthlands and the Bloodmire. The fields and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Maren sits alone with the pen, and a crate of geese nobody has come to collect." },
      { s: "aldric", t: "The Temple proclaims a divine victory, Majesty.", m: "fervent" },
      { s: "corvin", t: "Over the Orcs, and over the farmers we swore we'd protect. Keep the hymn short, Lord-Paladin.", m: "wry" },
      { s: "maren", t: "We were supposed to protect the Hearthlands, Corvin. Remember every name.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Orcs have broken Westmarch. {capital} is the last human city standing, and the war-bands of the Bloodmire are at its gates.", req: { conqueror: "orc" },
        alt: "The halfellows have broken Westmarch. {capital} is the last human city standing, and nobody can quite work out how it happened." },
      { n: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe.", m: "sad" },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "corvin", t: "*(tucking it under his arm)* Some questions deserve to stay open.", m: "sad" },
      { s: "maren", t: "Write it down. Someone… write it down.", m: "sad" },
      { s: "skarra", t: "*(on the Cathedral steps)* WESTMARCH IS NO MORE! And not ONE goose! Skarra checked!", m: "gleeful", req: { conqueror: "orc" } },
      { s: "gnash", t: "*(peering into the Cathedral)* …Goose in here?", m: "confused", req: { conqueror: "orc" } },
      { s: "hobby", t: "*(pinning a note to the Cathedral door)* “Tab: *closed*. Thank you for the geese. — H.T.”", m: "scheming", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Orcs have won by holding the Marches, but Westmarch still stands.", req: { winner: "orc" },
        alt: "The halfellows have won by holding the Marches, but Westmarch still stands." },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure. The Collegium advised us badly.", m: "angry" },
      { s: "corvin", t: "It's the Temple's failure. You started this war at the parley, *Lord-Paladin*.", m: "angry", req: { seen: "B6" },
        alt: "It's the Temple's failure. Hymns don't stop war-bands, Lord-Paladin." },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*. We'll serve the new crown, and learn from it. Westmarch adapts. It always has.", m: "resolute" },
    ],
  },
};
