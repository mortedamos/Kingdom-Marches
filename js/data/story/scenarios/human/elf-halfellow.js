/**
 * STORY SCENARIO -- human/elf+halfellow, "The Gentle Front"
 * Two kingdoms that never wanted war, and Westmarch needs land from
 * both. Maren is plainly the aggressor, and Corvin says so; Aldric calls it
 * holy work. The Rift at B5 is at its worst here (override). Threads:
 * bloodline, mercy, whisper (shared). No Orcs: at B6 Corvin uncovers the
 * Last Parley (shared). Shared defaults: shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/elf+halfellow"] = {
  title: "The Gentle Front",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn.", m: "fervent" },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*.", m: "wry" },
      { s: "maren", t: "Our neighbours are the Elves of the Silverwood and the halfellows of the Hearthlands. Neither of them has raised a sword in a hundred years.", m: "resolute" },
      { s: "corvin", t: "Which leaves only one kingdom in this corner of the Marches that *looks* like a conqueror, Majesty. Ours.", m: "wry" },
      { n: "In the Silverwood, the Elves' Warden Aelthir Moonveil reads the news beneath the silver trees, with his heir, Lord Vaelis Nightbloom. In the Hearthlands, the halfellow Mayor Hobby Trickgrin reads it standing up, between meetings." },
      { s: "aelthir", t: "Westmarch will want land. Her Collegium wants power, and her Temple calls it holy. I had hoped her generation would ask before it took.", m: "sad" },
      { s: "vaelis", t: "Mayflies do not ask, great-uncle. They *hurry*.", m: "aloof" },
      { s: "hobby", t: "Westmarch is coming, and the Elves are the only ones between them and us. Goldie, bake something for the Warden. Something *big*.", m: "scheming" },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises where two rivers meet. Surveyors and priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's surveyors and priests ride out together to choose the site of a second city. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty.", m: "fervent" },
      { s: "corvin", t: "It must be *surveyed*. And, Majesty, it's on land the halfellows have farmed for two hundred years. Someone should tell them.", m: "wry" },
      { s: "maren", t: "…I'll tell them. Myself. Consecrate it. Survey it. And pay the halfellows before the first stone is laid, not after.", m: "sad" },
    ],
    B2: [
      { n: "The forest's edge, at dusk. Human soldiers and elf rangers have clashed over a surveyor's stake, the first battle of the war.", req: { firstBlood: "elf" },
        alt: "The road to the Hearthlands, at dusk. Human soldiers and halfellow militia have clashed over a bread cart, the first battle of the war." },
      { s: "aldric", t: "Victory! The Dawn guided our swords!", m: "fervent" },
      { s: "corvin", t: "Against people who didn't want to fight, Lord-Paladin. I'd keep the hymns *very* short.", m: "wry" },
      { s: "maren", t: "Nobody else in this war started it, Corvin. We did. We should remember that.", m: "sad" },
    ],
    // The Rift, at its worst: the Temple's holy work against the gentle.
    B5: [
      { n: "The steps of the Dawn Cathedral in {capital}, at noon. Aldric stands before a crowd of priests and Knights of the Dawn, holding a scroll with the Temple's seal." },
      { s: "aldric", t: "Majesty. The Temple declares this war *holy work*: to bring the Dawn to the godless forest and the heathen fields. And the Temple demands a Dawn Trial, to prove your anointing before we march on.", m: "fervent" },
      { n: "Across the square, Corvin stands on the Collegium steps with a scroll of his own. For the first time in twenty years, his hands are shaking." },
      { s: "corvin", t: "And the Collegium declares: *there is nothing holy about this war*. We are the aggressors. We started it. We are taking land from farmers and trees from the oldest people in the Marches, and if the Queen submits to the Temple's trial, the magi will withdraw her election.", m: "angry" },
      { n: "The crowd roars, half for Aldric, half for Corvin. Stones are thrown. For a moment, Westmarch is closer to civil war than to victory." },
      { s: "maren", t: "*Stop*.", m: "angry" },
      { n: "The square falls silent." },
      { s: "maren", t: "The Archmage is right. We started this. And the Lord-Paladin is right that we must finish it. I will not stand trial, and I will not be un-elected. I will win this war *quickly*, and then I will pay for it. Every field. Every tree.", m: "resolute" },
      { s: "maren", t: "Lord-Paladin. Archmage. Council chamber. Both of you. *Now*.", m: "resolute" },
      { n: "Slowly, both men lower their scrolls. Westmarch holds, barely." },
    ],

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "aldric", t: "A sign.", m: "fervent" },
      { s: "maren", t: "No, brother. It's the land. And we took it from people who didn't want to fight. We'll spend my whole reign paying for it.", m: "resolute" },
      { n: "The new charter's first clause: every generation must renew it. Its second: *reparations to the Silverwood and the Hearthlands, in full*." },
      { s: "hobby", t: "*(in the Hearthlands)* Reparations! In *writing*! Goldie, frame it.", m: "happy", req: { alive: "halfellow" } },
      { s: "aelthir", t: "*(in the Silverwood)* She asked forgiveness. Late. But she asked. Her great-great-grandmother would have too.", m: "wistful", req: { alive: "elf" } },
      { s: "corvin", t: "A renewable Omen, and an apology. How very *efficient*.", m: "wry" },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying the Silverwood and the Hearthlands. The forest and the fields are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Maren sits alone with the pen. There is no one left to pay reparations to." },
      { s: "aldric", t: "The Temple proclaims a divine victory, Majesty.", m: "fervent" },
      { s: "corvin", t: "Over two peoples who never wanted to fight us. Proclaim it quietly, Lord-Paladin.", m: "wry" },
      { s: "maren", t: "We were the conquerors, Corvin. The only ones. And never let anyone call it holy.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Elves have broken Westmarch. {capital} is the last human city standing, and black Shadowsteeds circle its walls.", req: { conqueror: "elf" },
        alt: "The halfellows have broken Westmarch. {capital} is the last human city standing, and nobody can quite work out how it happened." },
      { n: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe.", m: "sad" },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "corvin", t: "*(tucking it under his arm)* We started it, Majesty. The gentle ones finished it. There's a justice in that I don't enjoy.", m: "sad" },
      { s: "maren", t: "Write it down. Someone… write it down.", m: "sad" },
      { s: "aelthir", t: "*(on the Cathedral steps)* Leave the Cathedral standing. Leave the library's ashes. They will want to remember.", m: "wistful", req: { conqueror: "elf" } },
      { s: "hobby", t: "*(pinning a note to the Cathedral door)* “You started it. We finished it. Supper's at six. — H.T.”", m: "scheming", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Elves have won by holding the Marches, but Westmarch still stands.", req: { winner: "elf" },
        alt: "The halfellows have won by holding the Marches, but Westmarch still stands." },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure. They sapped the army's faith.", m: "angry" },
      { s: "corvin", t: "It's the Temple's failure. You called an invasion *holy*, Lord-Paladin. The land didn't agree.", m: "angry" },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*. We'll serve the new crown, and pay for every field we took. Westmarch adapts. It always has. Crowns.", m: "resolute" },
    ],
  },
};
