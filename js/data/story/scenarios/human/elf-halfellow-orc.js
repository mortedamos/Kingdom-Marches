/**
 * STORY SCENARIO -- human/elf+halfellow+orc, "The Green March"
 * Forest, bog and meadow against the road-builder, and all three cast
 * Westmarch as the threat. The factions split: Aldric wants a crusade,
 * Corvin demands that Maren prove roads can serve (B3). Orcs in the game:
 * Aldric confesses at B6 (shared). Threads: bloodline, mercy, feud,
 * whisper (shared). Shared defaults: shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/elf+halfellow+orc"] = {
  title: "The Green March",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn." },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*." },
      { s: "maren", t: "The forest, the fields and the bog. Elves, halfellows and Orcs. And Westmarch, the only kingdom that builds roads." },
      { s: "corvin", t: "To them, Majesty, a road is just a very long wound." },
      { n: "In the Silverwood, the Elves' Lord Vaelis Nightbloom unrolls a map with Westmarch's roads marked in red. In the Hearthlands, Mayor Hobby Trickgrin looks at the same map. In the Bloodmire, the Bog Witch Skarra Ironjaw sets fire to it." },
      { s: "vaelis", t: "The mayflies pave. The rest of us grow. It is not complicated." },
      { s: "hobby", t: "Westmarch built a road straight through Goldie's cabbage patch once. She's *still* cross." },
      { s: "skarra", t: "Roads! Skarra LOVES roads! They lead straight to the people she wants to BURN!" },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises where two rivers meet. Surveyors and priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's surveyors and priests ride out together to choose the site of a second city. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty." },
      { s: "corvin", t: "It must be *surveyed*. And the road to it should go *around* the halfellow farms. Every one of them." },
      { s: "maren", t: "Consecrate it. Survey it. Go around. …And write it down." },
    ],
    B2: [
      { n: "The forest's edge, at dusk. Human soldiers and elf rangers have clashed over a surveyor's stake, the first battle of the war.", req: { firstBlood: "elf" },
        alt: { n: "The southern road, at dusk. Human soldiers and orc warriors have clashed over a raided supply wagon, the first battle of the war.", req: { firstBlood: "orc" },
          alt: "The road to the Hearthlands, at dusk. Human soldiers and halfellow militia have clashed over a bread cart, the first battle of the war." } },
      { s: "aldric", t: "Victory! The Dawn guided our swords!" },
      { s: "corvin", t: "The *Collegium's maps* guided our swords, Lord-Paladin. The Dawn was busy setting." },
      { s: "maren", t: "Grukka still thinks this is about the parley.", req: { firstBlood: "orc" },
        alt: "Over a *road*. …Write it down." },
      { n: "Aldric stares at the floor and says nothing, which is not like him.", req: { firstBlood: "orc" } },
    ],
    // Crusade, or prove the roads can serve.
    B3: [
      { n: "The royal council chamber of {capital}. A map covers the table: Westmarch in purple, surrounded on three sides by green, gold and red." },
      { s: "aldric", t: "Three heathen kingdoms, and all of them against the Dawn! Majesty, a crusade! Bring the light to forest, field and bog alike!" },
      { s: "corvin", t: "They're not against the *Dawn*, Lord-Paladin. They're against our *roads*. So prove them wrong. Majesty, build a road that *serves* them. Bread to the halfellows, trade to the Elves, anything to the Orcs that isn't a sword." },
      { s: "aldric", t: "You'd pave the way for our enemies?!" },
      { s: "corvin", t: "I'd pave the way for our enemies to stop *being* our enemies." },
      { n: "Maren looks at the map for a long time. Purple, surrounded by green and gold and red." },
      { s: "maren", t: "Both. We fight the war we're in, Lord-Paladin. And we build every road so that the day after it ends, it helps someone. …Write it down. Both versions." },
    ],

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "aldric", t: "A sign." },
      { s: "maren", t: "No, brother. It's the land. It was always the land." },
      { n: "The new charter's first clause: every generation must renew it. Its second: *every road shall serve those it passes*." },
      { s: "hobby", t: "*(in the Hearthlands)* Including Goldie's cabbage patch?", req: { alive: "halfellow" } },
      { s: "maren", t: "*(reading her letter)* …Including the cabbage patch. …Write it down.", req: { alive: "halfellow" } },
      { s: "vaelis", t: "*(in the Silverwood)* A road that serves. How novel. …We shall see.", req: { alive: "elf" } },
      { s: "corvin", t: "A renewable Omen. How very *efficient*." },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying every other crown in the Marches. The forest, the fields and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Maren's roads now run everywhere in the Marches. There is no one at the end of any of them." },
      { s: "aldric", t: "The Temple proclaims a divine victory, Majesty." },
      { s: "maren", t: "They said a road was just a very long wound, Corvin. They were right. …Write it down." },
      { s: "corvin", t: "Every Accord begins with someone who won, Majesty. The trick is being the one who *stops*." },
    ],
    "E-Fallen": [
      { n: "Westmarch has been broken. {capital} is the last human city standing." },
      { n: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe." },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "corvin", t: "*(tucking it under his arm)* Some questions deserve to stay open." },
      { s: "maren", t: "Write it down. Someone… write it down." },
      { s: "vaelis", t: "*(on the Cathedral steps)* Let the grass have the roads. It will take the grass a *season*.", req: { conqueror: "elf" } },
      { s: "skarra", t: "*(on the Cathedral steps)* WESTMARCH IS NO MORE! Skarra followed the roads, Queen! Just like she PROMISED!", req: { conqueror: "orc" } },
      { s: "hobby", t: "*(pinning a note to the Cathedral door)* “We'll keep the roads. We'll plant cabbages along them. — H.T.”", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Elves have won by holding the Marches, but Westmarch still stands.", req: { winner: "elf" },
        alt: { n: "The Orcs have won by holding the Marches, but Westmarch still stands.", req: { winner: "orc" },
          alt: "The halfellows have won by holding the Marches, but Westmarch still stands." } },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure. They'd have given our roads away." },
      { s: "corvin", t: "It's the Temple's failure. You wanted a crusade against *cabbages*, Lord-Paladin." },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*. We'll build roads for the new crown. Roads that serve. Roads outlast crowns. …And write it down." },
    ],
  },
};
