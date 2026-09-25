/**
 * STORY SCENARIO -- human/dwarf+halfellow+orc, "Hammer, Blade and Hearth"
 * With no Elves in the game, no one living witnessed the Accord, and
 * Barnaby holds the only text (B3). The Goose & Kettle is where the lovers'
 * rumour surfaces first (lovers:meet override: Corvin hears it at the pub).
 * Orcs in the game: Aldric confesses at B6 (shared).
 * Shared defaults: shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/dwarf+halfellow+orc"] = {
  title: "Hammer, Blade and Hearth",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn." },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*." },
      { s: "maren", t: "Dwarves to the north. Orcs to the south. The halfellows in between. And a parley that ended in blood, a season ago." },
      { s: "aldric", t: "*(a moment too quickly)* The Orcs broke faith, Majesty. The Dawn knows the truth." },
      { n: "In Karrak, the Dwarves' High Thane Brunna Stonefast calls in the Cathedral debt. In the Bloodmire, the Orc Warchief Grukka Ironjaw sharpens his grudge. In the Hearthlands, Mayor Hobby Trickgrin is late for everything." },
      { s: "brunna", t: "Westmarch owes Karrak for the Cathedral. It's time they paid." },
      { s: "grukka", t: "The Queen who let her knight draw first. I haven't forgotten." },
      { s: "hobby", t: "Three armies, and all of them want our bread. Goldie, lock the pantry." },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises where two rivers meet. Surveyors and priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's surveyors and priests ride out together to choose the site of a second city. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty." },
      { s: "corvin", t: "It must be *surveyed*. And walled. Hammer to the north, blade to the south, Majesty. We're the anvil." },
      { s: "maren", t: "Consecrate it. Survey it. Wall it. …And write it down." },
    ],
    B2: [
      { n: "The northern foothills, at dusk. Human soldiers and dwarf warriors have clashed over a surveyor's camp, the first battle of the war.", req: { firstBlood: "dwarf" },
        alt: { n: "The southern road, at dusk. Human soldiers and orc warriors have clashed over a raided supply wagon, the first battle of the war.", req: { firstBlood: "orc" },
          alt: "The road to the Hearthlands, at dusk. Human soldiers and halfellow militia have clashed over a bread cart, the first battle of the war." } },
      { s: "aldric", t: "Victory! The Dawn guided our swords!" },
      { s: "corvin", t: "The *Collegium's maps* guided our swords, Lord-Paladin. The Dawn was busy setting." },
      { s: "maren", t: "Grukka still thinks this is about the parley.", req: { firstBlood: "orc" },
        alt: "The first of three. …Write it down." },
      { n: "Aldric stares at the floor and says nothing, which is not like him.", req: { firstBlood: "orc" } },
    ],
    // The only copy of the Accord.
    B3: [
      { n: "The Hearthlands Archive, a halfellow library stacked floor to rafters with ledgers. Corvin has come in disguise, which is to say in a slightly less violet robe." },
      { n: "Professor Barnaby Pickwort, keeper of the Archive, has unrolled the only complete copy of the Accord left in the Marches." },
      { s: "barnaby", t: "No Elves in this war, Archmage. Which means no one alive was *there* when the Accord was sworn. This is all anyone has." },
      { s: "corvin", t: "May I…?" },
      { s: "barnaby", t: "You may *look*. Nobody breathes on it." },
      { n: "Corvin reads for three hours. Then he finds a clause he has never seen quoted anywhere." },
      { s: "corvin", t: "*(reading)* “Should the stone fail, the crowns shall first *meet*, at the stone, before they fight.” …Nobody did. Not one of us." },
      { s: "barnaby", t: "Nobody ever reads the fine print, Archmage." },
      { n: "Corvin takes the clause home to the Queen. She reads it, and says nothing for a long time." },
      { s: "maren", t: "We skipped the first step. All of us. …Write it down. And send it to every crown in the Marches." },
    ],
    // The rumour surfaces at The Goose & Kettle.
    "lovers:meet": {
      when: { inGame: ["dwarf", "orc"] },
      lines: [
        { n: "The Goose & Kettle, the halfellows' oldest pub. Corvin is there, strictly on Collegium business, which involves a pint." },
        { n: "At the bar, Goldie Trickgrin, the pub's keeper, is talking to her regulars in a voice she thinks is low." },
        { s: "goldie", t: "…the Dwarf Thane's daughter, I'm telling you. And the Orc Warchief's son. Down the old tunnels, every full moon. *In love*." },
        { n: "Corvin finishes his pint very slowly, and rides home very fast." },
        { s: "corvin", t: "Majesty. Sigrun Stonefast and Varg Ironjaw. The heirs of Karrak and the Bloodmire. We're holding a secret that could break *both* our enemies." },
        { n: "Maren is silent for a long moment." },
        { s: "maren", t: "We're holding a *rumour*, Archmage. From a pub. Tell no one. Not even my brother." },
      ],
    },

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "aldric", t: "A sign." },
      { s: "maren", t: "No, brother. It's the land. It was always the land." },
      { n: "The new charter's first clause: every generation must renew it. Its second, copied word for word from the halfellows' Archive: *should the stone fail, the crowns shall first meet*." },
      { s: "barnaby", t: "*(in the Hearthlands)* She read the fine print! Hobby! Somebody *read the fine print*!", req: { alive: "halfellow" } },
      { n: "A month later, a bronze-sealed letter arrives from Karrak. The Thane's daughter will sing at a feast, and the Orc Warchief has been invited to stand by the door. Maren smiles, and burns nothing.", req: { alive: ["dwarf", "orc"], seen: "lovers:meet" } },
      { s: "corvin", t: "A renewable Omen. How very *efficient*." },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying every other crown in the Marches. The mountains, the fields and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Maren sits alone with the pen, and a copy of a clause nobody followed." },
      { s: "aldric", t: "The Temple proclaims a divine victory, Majesty." },
      { s: "maren", t: "“The crowns shall first meet.” We never met, Corvin. Not once. …Write it down." },
      { s: "corvin", t: "Every Accord begins with someone who won, Majesty. The trick is being the one who *stops*." },
    ],
    "E-Fallen": [
      { n: "Westmarch has been broken. {capital} is the last human city standing." },
      { n: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe." },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "corvin", t: "*(tucking it under his arm)* The halfellows have the Accord. Somebody should have the rest." },
      { s: "maren", t: "Write it down. Someone… write it down." },
      { s: "brunna", t: "*(on the Cathedral steps)* Debt paid. Uncle, write it down: “Westmarch. Worthy foe.”", req: { conqueror: "dwarf" } },
      { s: "grukka", t: "*(on the Cathedral steps)* Next time, Queen, draw second.", req: { conqueror: "orc" } },
      { s: "hobby", t: "*(pinning a note to the Cathedral door)* “You should have read the fine print. — H.T.”", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but Westmarch still stands.", req: { winner: "dwarf" },
        alt: { n: "The Orcs have won by holding the Marches, but Westmarch still stands.", req: { winner: "orc" },
          alt: "The halfellows have won by holding the Marches, but Westmarch still stands." } },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure. The Collegium advised us badly." },
      { s: "corvin", t: "It's the Temple's failure. You started this war at the parley, *Lord-Paladin*.", req: { seen: "B6" },
        alt: "It's the Temple's failure. And everyone else's. Not one of us read the fine print." },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*. We'll build roads for the new crown. Roads outlast crowns. …And write it down." },
    ],
  },
};
