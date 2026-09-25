/**
 * STORY SCENARIO -- human/dwarf+elf+orc, "Three Old Wars"
 * The Rootcut, the Mountain Wars and the Last Parley all reignite. Maren is
 * the youngest crown, and the only one who wasn't there for any of them.
 * THREADS: the Martyr of the Dawn (bible §13.1): at B5 Aldric rides to the
 * old parley ground under a white flag to confess, and Skarra's war-band
 * is waiting, tipped off by a letter sealed with silver leaves (Vaelis's
 * whisper, §13.10). B6: Corvin finds the unsent confession, and the seal.
 * Also: lovers, bloodline, mercy, feud (shared).
 * Shared defaults: shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/dwarf+elf+orc"] = {
  title: "Three Old Wars",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn." },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*." },
      { s: "corvin", t: "And every old war in the Marches wakes up with it, Majesty. The Rootcut, between the Dwarves and the Elves. The Mountain Wars, between the Dwarves and the Orcs. And our own: the Last Parley." },
      { n: "A season ago, Maren met the Orc Warchief at a border parley. The ground shook, blades were drawn, and blood was spilled. Each side swears the other broke faith." },
      { s: "maren", t: "Three old wars. And I wasn't there for any of them. I'm the youngest crown in the Marches." },
      { s: "aldric", t: "*(a moment too quickly)* The parley was the Orcs' doing, Majesty. The Dawn knows the truth." },
      { n: "In Karrak, Loremaster Oskar Grimgate opens three volumes of the Book of Grudges at once. In the Silverwood, Lord Vaelis Nightbloom sharpens a quill. In the Bloodmire, the Bog Witch Skarra is laughing so hard she has to sit down." },
      { s: "oskar", t: "Volume One, the Elves. Volume Seven, the Orcs. Volume Twelve, Westmarch. I'll need a bigger desk." },
      { s: "vaelis", t: "Three old wars, and one young Queen. I believe I shall write some letters." },
      { s: "skarra", t: "ALL the wars! At ONCE! Skarra doesn't know where to START!" },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises where two rivers meet. Surveyors and priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's surveyors and priests ride out together to choose the site of a second city. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty." },
      { s: "corvin", t: "It must be *surveyed*. Preferably somewhere none of the three old wars has ever been fought. I'm struggling to find one." },
      { s: "maren", t: "Consecrate it. Survey it. Build it. …And write it down." },
    ],
    B2: [
      { n: "The northern foothills, at dusk. Human soldiers and dwarf warriors have clashed over a surveyor's camp, the first battle of the war.", req: { firstBlood: "dwarf" },
        alt: { n: "The forest's edge, at dusk. Human soldiers and elf rangers have clashed over a surveyor's stake, the first battle of the war.", req: { firstBlood: "elf" },
          alt: "The southern road, at dusk. Human soldiers and orc warriors have clashed over a raided supply wagon, the first battle of the war." } },
      { s: "aldric", t: "Victory! The Dawn guided our swords!" },
      { s: "corvin", t: "The *Collegium's maps* guided our swords, Lord-Paladin. The Dawn was busy setting." },
      { s: "maren", t: "Grukka still thinks this is about the parley.", req: { firstBlood: "orc" },
        alt: "The first battle of a fourth old war. Ours. …Write it down." },
      { n: "Aldric stares at the floor and says nothing, which is not like him.", req: { firstBlood: "orc" } },
    ],
    B4: [
      { n: "The Collegium tower in {capital}, at midnight. Corvin has asked the Queen to come alone." },
      { s: "corvin", t: "It didn't break, Majesty. It *wore through*. Nothing holds forever: no stone, no Accord, no crown. …And, Majesty. Two things." },
      { s: "corvin", t: "The first: I know what the Dawn Omen was. I'll say nothing. Tonight." },
      { s: "maren", t: "And the second?" },
      { s: "corvin", t: "Your brother has been writing letters in the Cathedral every night, and burning them. And someone in the Silverwood has been writing letters too. To everyone. I've seen the seals: silver leaves." },
      { n: "In the Cathedral, Aldric kneels before the great eastern window, a half-written page on the floor beside him." },
      { s: "aldric", t: "*(alone)* The old parley ground. At dawn. Under a white flag. Dawn give me the courage to tell her. To tell *them*." },
    ],
    // THE MARTYR OF THE DAWN (bible §13.1), betrayed by a whisper (§13.10).
    B5: [
      { n: "The old parley ground on the Orc border, at dawn: a flat stone in a field of reeds, where Maren and Grukka met a season ago. Lord-Paladin Aldric Ashcroft rides to it alone, under a white flag. He carries a letter, sealed and unsent." },
      { s: "aldric", t: "*(to the empty reeds)* Warchief! I have come to parley. Again. And this time, to tell you the truth!" },
      { n: "It is not Grukka who answers. Out of the reeds come Skarra's own war-band, and Skarra with them. They have been waiting since midnight." },
      { s: "skarra", t: "*(waving a letter sealed with silver leaves)* A little bird told Skarra the pretty paladin was coming! A little *silver* bird! Skarra doesn't want the truth, paladin. Skarra LIKES the grudge!" },
      { n: "Aldric draws his sword. He fights well; the Knights of the Dawn will sing of it for a hundred years. But he is one man, in a bog, and they are many." },
      { n: "When Grukka Ironjaw arrives, too late, the Lord-Paladin lies across the parley stone with his white flag beneath him." },
      { fx: { kill: "aldric", flag: "aldricFallen" } },
      { s: "grukka", t: "*(to Skarra)* Under a white flag. On the *parley stone*. …Who told you he was coming?" },
      { s: "skarra", t: "A friend, little brother! Skarra has LOTS of friends now!" },
      { n: "They bring the Lord-Paladin home to {capital} on his own shield. The Temple rings every bell in the city for a day and a night." },
      { s: "maren", t: "*(standing over her brother)* On the parley stone. Under a white flag. The Orcs broke faith at the parley, and they've broken it again." },
      { n: "On the Cathedral steps, the priests are already calling him the Martyr of the Dawn. The crowd is chanting for a crusade." },
      { s: "maren", t: "Then they'll have one. Westmarch marches on the Bloodmire. Every knight. Every tower. …And write it down." },
      { s: "corvin", t: "*(alone, in the tower)* Twenty years I argued with that man. I never once let him win. …And now the Temple has a saint, the crowd has a crusade, and reason won't get a word in for a generation." },
      { s: "vaelis", t: "*(in the Silverwood, sealing another letter)* One old war, restarted. Two to go.", req: { alive: "elf" } },
    ],
    // The unsent confession, and the silver seal.
    B6: [
      { n: "The Lord-Paladin's chambers in the Cathedral, stripped bare for the funeral. Corvin has come for Aldric's saddlebag. In it he finds a letter, sealed and unsent: *To Grukka Ironjaw, Warchief of the Bloodmire. And to my sister.*" },
      { s: "corvin", t: "*(reading)* “At the parley, the ground shook, and I thought it was an ambush. I drew my sword. I struck first. The Orcs never broke faith. *I* did.”" },
      { n: "And pressed into the mud on the saddle's underside, where someone dropped it in the struggle, Corvin finds a scrap of wax: a seal of silver leaves." },
      { s: "maren", t: "*(reading the letter)* He struck first. At the parley. And he died going to confess it." },
      { s: "corvin", t: "And someone in the Silverwood told the Bog Witch exactly where he'd be, Majesty. Your brother was killed by a lie, a grudge and a letter. Only one of them was his." },
      { s: "maren", t: "And I have marched a crusade into the Bloodmire in his name. Exactly as Vaelis wanted." },
      { n: "Maren stands at the window for a long time. Below, the crowd is still chanting her brother's name." },
      { s: "maren", t: "Not yet. Not in the middle of a war. …But write it down, Corvin. Every word. The letter, and the seal. When this is over, I'll read both aloud on the Cathedral steps." },
    ],

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "On the steps of the Dawn Cathedral, before the whole city, Queen Maren reads aloud a letter in her brother's hand, and holds up a seal of silver leaves.", req: { charDead: "aldric" },
        alt: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "maren", t: "“I struck first.” …My brother wrote this. He died carrying it to the Orcs, betrayed by the Silverwood's heir. Westmarch owes the Bloodmire an apology. And Lord Vaelis owes *me* one.", req: { charDead: "aldric" },
        alt: { s: "aldric", t: "A sign." } },
      { s: "maren", t: "No, brother. It's the land. It was always the land.", req: { charAlive: "aldric" } },
      { s: "vaelis", t: "*(in the Silverwood)* I merely wrote a letter. The Bog Witch did the rest. …I shall not be apologising.", req: { alive: "elf", charDead: "aldric" } },
      { s: "aelthir", t: "*(in the Silverwood, very quietly)* Yes, Vaelis. You will. In person. To his sister.", req: { alive: "elf", charDead: "aldric" } },
      { s: "corvin", t: "Every generation must renew the charter, Majesty. Let this be the first thing they read in it.", req: { charDead: "aldric" }, alt: "A renewable Omen. How very *efficient*." },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying every other crown in the Marches. The mountains, the forest and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Three old wars, ended. There is nobody left to fight them. Maren sits alone with the pen, and her brother's unsent letter.", req: { charDead: "aldric" },
        alt: "Three old wars, ended. There is nobody left to fight them. Maren sits alone with the pen." },
      { s: "maren", t: "I was the youngest crown in the Marches, Corvin. The only one who wasn't there for any of the old wars. And I finished all three. …Write it down." },
      { s: "corvin", t: "Every Accord begins with someone who won, Majesty. The trick is being the one who *stops*." },
    ],
    "E-Fallen": [
      { n: "Westmarch has been broken. {capital} is the last human city standing." },
      { n: "On the steps of the Dawn Cathedral, the Knights of the Dawn hold the line beneath a banner with Aldric's face on it.", req: { charDead: "aldric" },
        alt: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe." },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves two things: the record of Maren's examination, and a letter in the Lord-Paladin's hand.", req: { charDead: "aldric" },
        alt: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "maren", t: "Write it down. Someone… write it down." },
      { s: "oskar", t: "*(on the Cathedral steps)* Volume Twelve, Westmarch. Closed. …I'll not need the bigger desk after all.", req: { conqueror: "dwarf" } },
      { s: "vaelis", t: "*(in the empty Cathedral)* Three old wars, and the youngest crown lost all of them. …I did warn her. By letter.", req: { conqueror: "elf" } },
      { s: "grukka", t: "*(on the Cathedral steps)* Next time, Queen, draw second.", req: { conqueror: "orc" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but Westmarch still stands.", req: { winner: "dwarf" },
        alt: { n: "The Elves have won by holding the Marches, but Westmarch still stands.", req: { winner: "elf" },
          alt: "The Orcs have won by holding the Marches, but Westmarch still stands." } },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure. The Collegium advised us badly." },
      { s: "corvin", t: "The Temple will say we lost because we didn't pray hard enough for the Martyr, Majesty. I'm afraid they'll *believe* it.", req: { charDead: "aldric" },
        alt: "It's the Temple's failure, Lord-Paladin. Three old wars, and you only ever prayed about one of them." },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*. We'll build roads for the new crown. Roads outlast crowns. …And write it down." },
    ],
  },
};
