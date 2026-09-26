/**
 * STORY SCENARIO -- human/dwarf+elf, "Root and Stone"
 * The Rootcut reignites. The Temple wants a crusade against both, the
 * Collegium wants to sell to both, and the council chamber becomes a second
 * battlefield. Maren must choose between broker and vulture (B3).
 * Threads: bloodline, mercy, whisper (shared). No Orcs: at B6 Corvin
 * uncovers the Last Parley (shared). Shared defaults: shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/dwarf+elf"] = {
  title: "Root and Stone",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn.", m: "fervent" },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*.", m: "wry" },
      { s: "corvin", t: "And, Majesty. The Dwarves and the Elves. The Rootcut, the oldest feud in the Marches: dwarf tunnels that killed an elf grove, eight hundred years ago. The Accord was all that kept it quiet.", m: "wry" },
      { s: "maren", t: "Then they'll be at each other's throats by midsummer. So we choose where we stand before they choose it for us. Envoys to both, tonight.", m: "resolute" },
      { n: "In Karrak, the Dwarves' Loremaster Oskar Grimgate opens the Book of Grudges to Entry the First: the Rootcut. In the Silverwood, Lord Vaelis Nightbloom, heir to the Elves' Warden, reads the same news, bored." },
      { s: "oskar", t: "Entry the First. The Elves, for blaming us. We'll be needing a fresh volume.", m: "grudging" },
      { s: "vaelis", t: "The mud-folk will dig. The mayflies will build. We shall wait. We are very good at waiting.", m: "aloof" },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises where two rivers meet. Surveyors and priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's surveyors and priests ride out together to choose the site of a second city. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty.", m: "fervent" },
      { s: "corvin", t: "It must be *surveyed*. With neither dwarf stone nor elf timber. We don't want to be accused of taking sides.", m: "wry" },
      { s: "maren", t: "I chose the site myself, where both their borders can be watched. Consecrate it at sunrise. Survey it at noon. Build it by evening.", m: "resolute" },
    ],
    B2: [
      { n: "The northern foothills, at dusk. Human soldiers and dwarf warriors have clashed over a surveyor's camp, the first battle of the war.", req: { firstBlood: "dwarf" },
        alt: "The forest's edge, at dusk. Human soldiers and elf rangers have clashed over a surveyor's stake, the first battle of the war." },
      { s: "aldric", t: "Victory! The Dawn guided our swords!", m: "fervent" },
      { s: "corvin", t: "The *Collegium's maps* guided our swords, Lord-Paladin. The Dawn was busy setting.", m: "wry" },
      { s: "aldric", t: "Then we'll share it, Archmage. Your maps found the ford. The Dawn kept my knights standing in it when the arrows came.", m: "fervent" },
      { s: "maren", t: "So much for standing between them. We're in it now, so we set the terms. Not them.", m: "sad" },
    ],
    // Broker or vulture: the council chamber as second battlefield.
    B3: [
      { n: "The royal council chamber of {capital}, packed to the rafters. Two envoys wait in the antechamber: a dwarf with a contract, and an elf with a list of grievances." },
      { s: "aldric", t: "A crusade, Majesty! Against *both*! Tunnel-diggers and tree-worshippers, and neither kneels to the Dawn!", m: "fervent" },
      { s: "corvin", t: "Or we *sell* to both, Majesty. Steel to the Dwarves, grain to the Elves, and let them pay us to keep fighting.", m: "wry" },
      { s: "maren", t: "One of you wants me to be a zealot. The other wants me to be a vulture.", m: "angry" },
      { s: "corvin", t: "I prefer *broker*, Majesty.", m: "wry" },
      { s: "maren", t: "You would. …Send both envoys home. Westmarch sells nothing that kills, and blesses nothing that burns. We win this *ourselves*.", m: "resolute" },
      { n: "The dwarf envoy leaves grumbling. The elf envoy leaves without a word. That night, a letter arrives from the Silverwood." },
      { s: "vaelis", t: "*(his letter)* “How principled. The mud-folk will be delighted to hear that Westmarch is neutral. I have already told them you are not.”", m: "aloof" },
    ],

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "aldric", t: "A sign.", m: "fervent" },
      { s: "maren", t: "No, brother. It's the land. It was always the land.", m: "happy" },
      { n: "Maren writes the first line of the new charter for the Marches. Its first clause: every generation must renew it. Its second: *the Rootcut is closed*." },
      { s: "oskar", t: "*(in Karrak)* Closed? *Closed*? …Entry the First. Struck through. By a human. I'll need to lie down.", m: "happy", req: { alive: "dwarf" } },
      { s: "vaelis", t: "*(in the Silverwood)* A mayfly has ended an eight-hundred-year feud with a pen. It will not last. …It may last a little.", m: "aloof", req: { alive: "elf" } },
      { s: "corvin", t: "A renewable Omen. How very *efficient*.", m: "wry" },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying the Dwarves and the Elves. The mountains and the forest are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Maren sits alone with the pen. The Rootcut is over. There is nobody left on either side of it." },
      { s: "aldric", t: "The Temple proclaims a divine victory, Majesty.", m: "fervent" },
      { s: "corvin", t: "And the Collegium proclaims a rational one. We are, for once, in complete agreement that we won.", m: "wry" },
      { s: "maren", t: "We said we'd stand between them. We ended up standing on them.", m: "sad" },
      { s: "corvin", t: "Every Accord begins with someone who won, Majesty. The trick is being the one who *stops*.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Dwarves have broken Westmarch. {capital} is the last human city standing, and dwarf warriors are at its gates.", req: { conqueror: "dwarf" },
        alt: "The Elves have broken Westmarch. {capital} is the last human city standing, and black Shadowsteeds circle its walls." },
      { n: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe.", m: "sad" },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "corvin", t: "*(tucking it under his arm)* Some questions deserve to stay open.", m: "sad" },
      { s: "maren", t: "Write it down. Someone… write it down.", m: "sad" },
      { s: "brunna", t: "*(on the Cathedral steps)* Karrak stone, back in Karrak hands. Uncle, write it down: “Westmarch. Worthy foe.”", m: "proud", req: { conqueror: "dwarf" } },
      { s: "vaelis", t: "*(in the empty Cathedral)* Three hundred years of building. We shall let the forest have it back. It will take the forest a *week*.", m: "aloof", req: { conqueror: "elf" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but Westmarch still stands.", req: { winner: "dwarf" },
        alt: "The Elves have won by holding the Marches, but Westmarch still stands." },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure. They'd have sold swords to both sides.", m: "angry" },
      { s: "corvin", t: "It's the Temple's failure. You'd have *fought* both sides, Lord-Paladin.", m: "angry" },
      { n: "The council chamber erupts. The divide Maren held shut through every battle cracks open the moment the war is lost." },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*. We'll serve the new crown, and learn from it. Westmarch adapts. It always has.", m: "resolute" },
    ],
  },
};
