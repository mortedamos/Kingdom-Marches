/**
 * STORY SCENARIO -- human/orc, "The Last Parley"
 * Maren and Grukka each blame the other for the blood spilled at the
 * parley. Aldric carries the truth, and Skarra fans the grudge, cackling.
 * THREAD (bible §13.1, the Martyr of the Dawn): at B5 Aldric rides out
 * under a white flag to confess to Grukka, and Skarra's war-band, who like
 * the grudge far too much to want the truth, cut him down before he can.
 * Maren turns to a crusade; Corvin grieves, and fears the Temple's
 * zealotry. B6: Corvin finds Aldric's unsent confession.
 * Shared defaults: js/data/story/shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/orc"] = {
  title: "The Last Parley",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn.", m: "fervent" },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*.", m: "wry" },
      { n: "A season ago, Maren met the Orc Warchief at a border parley. The ground shook, blades were drawn, and blood was spilled. Each side swears the other broke faith. The Last Parley has hung over Westmarch ever since." },
      { s: "maren", t: "The Orcs will come. Grukka Ironjaw still thinks we betrayed him at the parley. So we don't wait for him.", m: "resolute" },
      { s: "aldric", t: "*(a moment too quickly)* The Orcs lie, Majesty. The Dawn knows the truth.", m: "sad" },
      { n: "Corvin watches the Lord-Paladin with one eyebrow raised." },
      { n: "In the Bloodmire, the swamp country of the Orcs, Warchief Grukka Ironjaw stands before the Speaking Stones, an ancient ring of standing stones. Beside him, his elder sister Skarra, the Bog Witch, is dancing." },
      { s: "grukka", t: "Westmarch. The Queen who invited me to parley, then let her knight draw first blood. I haven't forgotten.", m: "angry" },
      { s: "skarra", t: "And Skarra hasn't forgotten either, little brother! Skarra NEVER forgets! Skarra keeps her grudges in a JAR!", m: "gleeful" },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises where two rivers meet. Surveyors and priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's surveyors and priests ride out together to choose the site of a second city. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty.", m: "fervent" },
      { s: "corvin", t: "It must be *surveyed*, and given walls. The Orcs are coming, Lord-Paladin. Hymns don't stop arrows.", m: "wry" },
      { s: "maren", t: "Consecrate it at sunrise. Survey it at noon. Wall it by evening. Then send scouts to the bog's edge. I'll know where Grukka camps before he knows where I sleep.", m: "resolute" },
    ],
    B2: [
      { n: "The southern road, at dusk. Human soldiers and orc warriors have clashed over a raided supply wagon, the first battle of the war." },
      { s: "aldric", t: "Victory! The Dawn guided our swords!", m: "fervent" },
      { s: "corvin", t: "The *Collegium's maps* guided our swords, Lord-Paladin. The Dawn was busy setting.", m: "wry" },
      { s: "aldric", t: "Then we'll share it, Archmage. Your maps found the ford. The Dawn kept my knights standing in it when the arrows came.", m: "fervent" },
      { s: "maren", t: "Grukka still thinks this is about the parley. Let him. We'll be three moves ahead while he's still remembering.", m: "sad" },
      { n: "Aldric stares at the floor and says nothing, which is not like him." },
      { n: "In the Bloodmire, the Speaking Stones glow red: when an orc falls, the ancestors demand vengeance. Skarra dances among them with a fat green frog on her shoulder." },
      { s: "skarra", t: "Human blood in the mud, little Warchief! The Queen's banners run RED! Ha! HA!", m: "gleeful" },
      { s: "grukka", t: "Skarra. If you're going to gloat, do it where I can't hear.", m: "angry" },
    ],
    B4: [
      { n: "The Collegium tower in {capital}, at midnight. Corvin has asked the Queen to come alone." },
      { s: "corvin", t: "It didn't break, Majesty. It *wore through*. Nothing holds forever: no stone, no Accord, no crown. …And, Majesty. Two things.", m: "wry" },
      { s: "corvin", t: "The first: I know what the Dawn Omen was. I've taught light spells for thirty years. I'll say nothing. Tonight.", m: "sad" },
      { s: "maren", t: "And the second?" },
      { s: "corvin", t: "Your brother hasn't slept in a week. He's been writing letters in the Cathedral, and burning them. I don't know what's in them. I'd very much like to.", m: "sad" },
      { n: "In the Cathedral, Aldric kneels before the great eastern window, a pen in his hand and a half-written page on the floor beside him." },
      { s: "aldric", t: "*(alone)* Dawn give me the courage to tell her. And to tell *them*.", m: "sad" },
    ],
    // THE MARTYR OF THE DAWN (bible §13.1)
    B5: [
      { n: "The Orc border, at dawn. Lord-Paladin Aldric Ashcroft rides alone into the Bloodmire under a white flag. He has told no one where he is going. He carries a letter in his saddlebag, sealed and unsent." },
      { s: "aldric", t: "*(to the empty bog)* Warchief! I have come to parley. Again. And this time, to tell you the truth!", m: "fervent" },
      { n: "It is not Grukka who answers. Out of the reeds come Skarra's own war-band, and Skarra with them, a frog on her shoulder and a grin on her face." },
      { s: "skarra", t: "The Queen's brother! Alone! Under a *white flag*! Oh, Skarra doesn't want the truth, pretty paladin. Skarra LIKES the grudge!", m: "gleeful" },
      { n: "Aldric draws his sword. He fights well; the Knights of the Dawn will sing of it for a hundred years. But he is one man, in a bog, and they are many." },
      { n: "When Grukka Ironjaw arrives, too late, the Lord-Paladin lies in the reeds with his white flag beneath him. The sealed letter is still in his saddlebag. Nobody opens it." },
      { fx: { kill: "aldric", flag: "aldricFallen" } },
      { s: "grukka", t: "*(to Skarra)* Under a white flag. You killed a man under a *white flag*.", m: "angry" },
      { s: "skarra", t: "So did he, little brother. Remember? At the parley. Skarra is only *returning the favour*.", m: "gleeful" },
      { n: "They bring the Lord-Paladin home to {capital} on his own shield. The Temple rings every bell in the city for a day and a night." },
      { s: "maren", t: "*(standing over her brother)* They killed him under a flag of truce. The Orcs broke faith at the parley, and they've broken it again.", m: "angry" },
      { n: "On the Cathedral steps, the priests are already calling him the Martyr of the Dawn. The crowd is chanting for a crusade." },
      { s: "maren", t: "Then they'll have one. Westmarch marches on the Bloodmire. Every knight. Every tower. Every spell the Collegium has.", m: "resolute" },
      { n: "In the Collegium tower, Corvin listens to the chanting from his window, and closes the shutters." },
      { s: "corvin", t: "*(alone)* Twenty years I argued with that man. Every council, every feast. I never once let him win. …I'd give anything to lose one argument to him now.", m: "sad" },
      { s: "corvin", t: "And listen to them. A martyr. A crusade. The Temple has found a *saint* to march behind. Reason won't get a word in for a generation.", m: "sad" },
    ],
    // The unsent confession.
    B6: [
      { n: "The Lord-Paladin's chambers in the Cathedral, stripped bare for the funeral. Corvin has come for Aldric's saddlebag, at the Queen's request. In it he finds a letter, sealed and unsent." },
      { n: "It is addressed, in Aldric's square, careful hand: *To Grukka Ironjaw, Warchief of the Bloodmire. And to my sister.*" },
      { s: "corvin", t: "*(reading)* “At the parley, the ground shook, and I thought it was an ambush. I drew my sword. I struck first. The Orcs never broke faith. *I* did.”", m: "sad" },
      { n: "Corvin reads it three times. Then he takes it to the Queen." },
      { s: "maren", t: "*(reading)* …He struck first. At the parley. He *struck first*.", m: "sad" },
      { s: "corvin", t: "He was riding to tell them, Majesty. That's why he went alone. Under a white flag. He was going to confess.", m: "sad" },
      { s: "maren", t: "And I have told all Westmarch that the Orcs broke faith. Twice. I have a crusade in the field built on my brother's lie.", m: "sad" },
      { s: "corvin", t: "You could tell them. The Temple will call it slander. The crowd will call it treason. And it would be the truth.", m: "sad" },
      { n: "Maren stands at the window for a long time. Below, the crowd is still chanting her brother's name." },
      { s: "maren", t: "Not yet. Not in the middle of a war. …But write it down, Corvin. Every word. And when this is over, I'll read it aloud on the Cathedral steps myself.", m: "resolute" },
    ],

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "On the steps of the Dawn Cathedral, before the whole city, Queen Maren reads aloud a letter in her brother's hand.", req: { charDead: "aldric" },
        alt: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "maren", t: "“I struck first. The Orcs never broke faith. *I* did.” …The Lord-Paladin wrote this. He died trying to deliver it. Westmarch owes the Bloodmire an apology, and I will deliver it myself.", m: "resolute", req: { charDead: "aldric" },
        alt: { s: "aldric", t: "A sign.", m: "fervent" } },
      { s: "maren", t: "No, brother. It's the land. It was always the land.", m: "sad", req: { charAlive: "aldric" } },
      { s: "grukka", t: "*(reading the Queen's letter in the Bloodmire)* …He was coming to tell me. Under a white flag. …Skarra. Get out of my sight.", m: "angry", req: { alive: "orc", charDead: "aldric" } },
      { s: "corvin", t: "Every generation must renew the charter, Majesty. Let this be the first thing they read in it.", m: "wry", req: { charDead: "aldric" },
        alt: "A renewable Omen. How very *efficient*." },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying the Orcs. The Bloodmire is silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Maren sits alone with the pen, and her brother's unsent letter.", req: { charDead: "aldric" },
        alt: "Maren sits alone with the pen. There is no one left to sign the new charter with, only to sign it for." },
      { s: "maren", t: "I burned their whole country for a lie my brother told. He died trying to take it back. …Write it down, Corvin. Write *all* of it down.", m: "sad", req: { charDead: "aldric" },
        alt: { s: "aldric", t: "*(very quietly)* Sister. The parley. I struck first. I have to tell you. Now, when it's too late to matter.", m: "sad" } },
      { s: "corvin", t: "Every Accord begins with someone who won, Majesty. The trick is being the one who *stops*.", m: "sad" },
      { n: "At dawn, Maren watches the sun rise over {capital} and wonders, as she always has, whether the Dawn lit that first morning, or she did." },
    ],
    "E-Fallen": [
      { n: "The Orcs have broken Westmarch. {capital} is the last human city standing, and the war-bands of the Bloodmire are at its gates." },
      { n: "On the steps of the Dawn Cathedral, the Knights of the Dawn hold the line beneath a banner with Aldric's face on it.", req: { charDead: "aldric" },
        alt: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe.", m: "sad" },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves two things: the record of Maren's examination, and a letter in the Lord-Paladin's hand.", req: { charDead: "aldric" },
        alt: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "corvin", t: "*(tucking them under his arm)* Somebody has to tell the truth, eventually. Even if it's only me.", m: "sad", req: { charDead: "aldric" },
        alt: "*(tucking it under his arm)* Some questions deserve to stay open." },
      { s: "maren", t: "Write it down. Someone… write it down.", m: "sad" },
      { n: "In the ruins, the Orc Warchief sits on the Cathedral steps and looks at the rising sun for a long time." },
      { s: "grukka", t: "Next time, Queen, draw second.", m: "defiant" },
      { s: "skarra", t: "WESTMARCH IS NO MORE! Skarra will wear the Queen's crown as a FROG HAT! Destiny, my frog, try it on!", m: "gleeful" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Orcs have won by holding the Marches. For the first time in history an orc crown rules the borderlands, but Westmarch still stands." },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure. The Collegium advised us badly.", m: "angry" },
      { s: "corvin", t: "It's the Temple's failure. Hymns don't stop war-bands, *Lord-Paladin*.", m: "angry", req: { charAlive: "aldric" },
        alt: "The Temple will say we lost because we didn't pray hard enough for the Martyr, Majesty. I'm afraid they'll *believe* it." },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*.", m: "angry" },
      { s: "maren", t: "Grukka Ironjaw holds the Marches now. Then Westmarch adapts, as it always has. …And we owe him an apology. Aldric, you'll deliver it.", m: "resolute", req: { charAlive: "aldric" },
        alt: "Grukka Ironjaw holds the Marches now. Then Westmarch adapts. And I'll bring him my brother's letter myself. …Crowns fall. The truth outlasts them." },
    ],
  },
};
