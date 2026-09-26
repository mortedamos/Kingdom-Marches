/**
 * STORY SCENARIO -- human/elf, "Beneath the Silver Trees"
 * The Collegium asks leave to study the Silverwood's silver trees, the
 * oldest magic in the Marches. Aelthir refuses with sorrow; Vaelis doesn't
 * bother to refuse, because he doesn't consider the request to have been made
 * by anyone. Aldric and Vaelis over the Amulet of Aesia is the scenario's cold war. Threads: bloodline, mercy (shared). No Orcs:
 * at B6 Corvin uncovers the Last Parley (shared).
 * Shared defaults: js/data/story/shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/elf"] = {
  title: "Beneath the Silver Trees",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn.", m: "fervent" },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*.", m: "wry" },
      { s: "maren", t: "Then Westmarch needs every advantage there is. And the oldest magic in the Marches grows in the Silverwood.", m: "resolute" },
      { n: "The Silverwood: the Elves' ancient forest, older than any kingdom in the Marches. Its Warden, Aelthir Moonveil, taught Maren's great-great-grandmother to read." },
      { s: "corvin", t: "The silver trees, Majesty. The Collegium has wanted to study them for three centuries. What they are. Why our spells answer to them.", m: "wry" },
      { s: "maren", t: "Write to the Warden, Corvin. Politely. Ask to send scholars.", m: "resolute" },
      { n: "In the Silverwood, beneath the silver trees, the letter is read aloud to the Warden and his heir." },
      { s: "aelthir", t: "Scholars, to measure the silver trees. She asks kindly. And I must say no, just as kindly. Every one of those trees is older than her kingdom.", m: "wistful" },
      { s: "vaelis", t: "You are answering it, great-uncle? A request from a mayfly is not a request. It is a *noise*.", m: "aloof" },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises at the forest's edge. Collegium scholars and Temple priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's scholars and priests ride out together to choose the site of a second city, at the forest's edge. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty.", m: "fervent" },
      { s: "corvin", t: "It must be *warded*. And, Majesty, if one silver tree so much as singes, the Elves will remember it for a thousand years.", m: "wry" },
      { s: "maren", t: "Then nobody touches a tree. We build around them.", m: "resolute" },
    ],
    B2: [
      { n: "The forest's edge, at dusk. Human soldiers and elf rangers have clashed over a Collegium scholar's marker stake, the first battle of the war." },
      { s: "aldric", t: "Victory! The Dawn guided our swords!", m: "fervent" },
      { s: "corvin", t: "The *Collegium's maps* guided our swords, Lord-Paladin. The Dawn was busy setting.", m: "wry" },
      { s: "aldric", t: "Then we'll share it, Archmage. Your maps found the ford. The Dawn kept my knights standing in it when the arrows came.", m: "fervent" },
      { s: "maren", t: "Over a *stake*. A piece of wood with a painted tip. The Elves think we meant to cut the forest down.", m: "angry" },
      { s: "vaelis", t: "*(in the Silverwood)* The mayflies have drawn blood. How very like them. They always hurry to the end.", m: "aloof" },
    ],
    // The Amulet of Aesia cold war.
    B3: [
      { n: "The royal council chamber of {capital}. Aldric stands before the council with a painting of a woman in a sunburst amulet: Saint Aesia, a healer of the Dawn." },
      { s: "aldric", t: "The Amulet of Aesia is a relic of the Dawn! It was lost to the Accord's vaults, and the Elves claim it as *theirs*! The Temple demands its return!", m: "fervent" },
      { n: "A letter from the Silverwood arrives the same week, in a hand as fine as spider-silk." },
      { s: "vaelis", t: "*(his letter)* “The Lord-Paladin should know that Aesia was a druid of the Silverwood. My great-uncle knew her. She did not pray to your sun. She found it *loud*.”", m: "aloof" },
      { s: "aldric", t: "*Loud*? Aesia healed the sick in the Dawn's name for forty years. The Temple keeps her letters. Every one of them begins with a prayer.", m: "angry" },
      { s: "corvin", t: "He's right, Majesty. I've read those letters. She thanks the sun in every one. …And complains about how early it rises in half of them. They may both be telling the truth.", m: "wry" },
      { s: "maren", t: "Nobody is fighting a war over a *necklace*. And, Aldric, stop drafting that reply.", m: "angry" },
    ],

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "aldric", t: "A sign.", m: "fervent" },
      { s: "maren", t: "No, brother. It's the land. It was always the land.", m: "happy" },
      { n: "Maren writes the first line of the new charter for the Marches. Its first clause: every generation must renew it, or it lapses. Its second: *no spell, saw or scholar shall harm a silver tree*." },
      { s: "aelthir", t: "*(reading it in the Silverwood)* She left the trees alone. Her great-great-grandmother would be proud. So am I.", m: "happy", req: { alive: "elf" } },
      { s: "vaelis", t: "*(reading over his shoulder)* A charter, from a mayfly. It will last almost as long as she does.", m: "aloof", req: { alive: "elf" } },
      { s: "corvin", t: "A renewable Omen. How very *efficient*.", m: "wry" }, { s: "aldric", t: "Not an Omen, Archmage. A vow. The Dawn has never asked us for anything we couldn't renew.", m: "fervent" },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying the Silverwood. The forest stands, but there is no one left to sing in it." },
      { s: "stone", t: "REMAINS." },
      { n: "Maren walks beneath the silver trees alone. The Collegium wants to fell one and study it. She has forbidden it." },
      { s: "maren", t: "He taught my great-great-grandmother to read. He sent a sapling to my coronation. I let it die. …And now this.", m: "sad" },
      { s: "corvin", t: "Every Accord begins with someone who won, Majesty. The trick is being the one who *stops*.", m: "sad" }, { s: "aldric", t: "The Warden is gone, Archmage. Whatever you believe, pray with me for him. Just this once.", m: "sad" },
      { s: "maren", t: "Plant a sapling, Corvin. Here, at the forest's edge. And this time, I'll water it myself.", m: "resolute" },
    ],
    "E-Fallen": [
      { n: "The Elves have broken Westmarch. {capital} is the last human city standing, and black Shadowsteeds circle its walls." },
      { n: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe.", m: "sad" },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "corvin", t: "*(tucking it under his arm)* Some questions deserve to stay open.", m: "sad" },
      { s: "maren", t: "Write it down. Someone… write it down.", m: "sad" },
      { n: "In the ruins, Lord Vaelis walks through the empty Cathedral, and pauses beneath the great eastern window." },
      { s: "vaelis", t: "They built all this in three hundred years. …We shall let the forest have it back. It will take the forest a *week*.", m: "aloof" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Elves have won by holding the Marches. The forest walks back into the borderlands, but Westmarch still stands." },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure. The Collegium advised us badly.", m: "angry" },
      { s: "corvin", t: "It's the Temple's failure. You picked a fight over a *necklace*, Lord-Paladin.", m: "angry" },
      { n: "The council chamber erupts. The divide Maren held shut through every battle cracks open the moment the war is lost." },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*.", m: "angry" },
      { s: "maren", t: "The Elves hold the Marches now. Then we learn from them. Westmarch adapts, Archmage. It always has. It's what we do best.", m: "resolute" },
    ],
  },
};
