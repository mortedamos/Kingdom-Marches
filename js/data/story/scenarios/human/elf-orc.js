/**
 * STORY SCENARIO -- human/elf+orc, "Fire in the Canopy"
 * Orc camps burn the borderwood. Aelthir asks for help Maren can't give (no
 * oath binds), Skarra gloats over every burned grove, and Aldric's Parley
 * guilt grows. THREADS: the mercy BACKFIRES here (bible §13.2 exception):
 * Aelthir spares Aldric, who rides straight back into the war to repay the
 * debt, and at B5 dies at Orc hands holding a burning elf grove (§13.1).
 * B6: Corvin finds his unsent confession. Also: bloodline, feud, whisper.
 * Shared defaults: js/data/story/shared/human.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["human/elf+orc"] = {
  title: "Fire in the Canopy",
  beats: {
    B0: [
      { n: "Westmarch, the river kingdom of the Humans. At dawn, every bell in the Dawn Cathedral begins to ring on its own." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the throne room of Westmarch, Queen Maren Ashcroft sets down her pen. Two men arrive at once, from opposite doors, and glare at each other." },
      { n: "From the Dawn Cathedral comes Lord-Paladin Aldric Ashcroft, Maren's elder brother and champion of the Temple of the Dawn. From the Collegium tower, where the kingdom's wizards study, comes Archmage Corvin Varro." },
      { s: "aldric", t: "Majesty. The Cathedral bells rang without a hand on the ropes. It is a sign from the Dawn." },
      { s: "corvin", t: "It is an *earthquake*, Lord-Paladin. The Marchstone has split. The closing clause: the Marches pass to the crown that *holds* them, or failing that, to the crown that *remains*." },
      { n: "A season ago, Maren met the Orc Warchief at a border parley. The ground shook, blades were drawn, and blood was spilled. Each side swears the other broke faith." },
      { s: "maren", t: "The Orcs will come. And the Silverwood lies between their bog and our river." },
      { s: "aldric", t: "*(a moment too quickly)* The Orcs are oath-breakers, Majesty. The Dawn knows the truth." },
      { n: "In the Bloodmire, the Orcs' swamp country, the Bog Witch Skarra Ironjaw is already lighting torches." },
      { s: "skarra", t: "The tree-folk's pretty forest first! Skarra has waited EIGHTY YEARS to see the Silverwood burn!" },
      { n: "In the Silverwood, the Elves' Warden Aelthir Moonveil smells smoke on the wind. His heir, Lord Vaelis Nightbloom, does not look up from his book." },
      { s: "aelthir", t: "Write to the Queen of Westmarch. Tell her the fire will not stop at the forest's edge." },
      { s: "vaelis", t: "Ask the *mayflies* for help? Great-uncle, they cannot even help *themselves*." },
    ],
    B1: [
      { n: "{city}, Westmarch's second city, rises where two rivers meet. Surveyors and priests arrive on the same morning, and neither will wait for the other.", req: { cities: 2 },
        alt: "Westmarch's surveyors and priests ride out together to choose the site of a second city. Neither will let the other choose." },
      { s: "aldric", t: "It must be consecrated before a single stone is laid, Majesty." },
      { s: "corvin", t: "It must be *surveyed*. And, Majesty, from the tower I can see smoke over the Silverwood. Every day, a little more." },
      { s: "maren", t: "Consecrate it. Survey it. And keep a bucket chain ready. …And write it down." },
    ],
    B2: [
      { n: "The southern road, at dusk. Human soldiers and orc warriors have clashed over a raided supply wagon, the first battle of the war.", req: { firstBlood: "orc" },
        alt: "The forest's edge, at dusk. Human soldiers and elf rangers have clashed in the smoke, each thinking the other were orcs." },
      { s: "aldric", t: "Victory! The Dawn guided our swords!" },
      { s: "corvin", t: "The *Collegium's maps* guided our swords, Lord-Paladin. The Dawn was busy setting." },
      { s: "maren", t: "Grukka still thinks this is about the parley.", req: { firstBlood: "orc" },
        alt: "We fought the Elves. In the smoke. By *mistake*. …Write it down, and send the Warden an apology." },
      { n: "Aldric stares at the floor and says nothing, which is not like him.", req: { firstBlood: "orc" } },
    ],
    // Aelthir asks for help Maren can't give.
    B3: [
      { n: "The royal council chamber of {capital}. An elf envoy stands before the throne, ash in her silver hair. She has ridden through the burning borderwood to get here." },
      { s: "maren", t: "*(reading the Warden's letter)* “The Orcs are burning the Silverwood, grove by grove. Under the Accord, Westmarch was sworn to help. I know the stone is broken. I am asking anyway.”" },
      { s: "corvin", t: "No oath binds us, Majesty. The stone is broken. We owe the Silverwood nothing." },
      { s: "aldric", t: "The Dawn says we owe *everyone* something, Archmage. I… I have reason to know." },
      { n: "Corvin raises an eyebrow. The Lord-Paladin has never before argued for helping the Elves." },
      { s: "maren", t: "We can't send an army. We need every sword on our own border. Tell the Warden… tell him I'm sorry. …Write it down." },
      { s: "skarra", t: "*(at the Speaking Stones)* The Queen said NO! The tree-folk BURN, and the Queen says NO! Oh, this is the BEST war!" },
    ],
    // The mercy that backfires (bible §13.2 exception).
    mercy: {
      when: { inGame: "elf", seen: "bloodline" },
      lines: [
        { n: "The Elves have taken {city}. Among the prisoners is a figure the elf captains recognise at once.", req: { charAlive: "aldric" },
          alt: "The Elves have taken {city}. Among the prisoners, dragged before the elf captains, is the Archmage of the Collegium himself." },
        { n: "In the captured town square, Lord Vaelis Nightbloom, heir to the Silverwood, draws a slender blade of dark mythril." },
        { s: "vaelis", t: "The Queen's own brother. The Queen who would not help us. Kneel, Lord-Paladin. It will be brief. Everything about your kind is.", req: { charAlive: "aldric" },
          alt: "The Queen's pet conjuror. Kneel, Archmage. You of all people should appreciate a clean, rational ending." },
        { n: "A hand closes over Vaelis's wrist. Aelthir Moonveil, Warden of the Silverwood, has come himself." },
        { s: "aelthir", t: "No. Not this one, Vaelis. Not any of them." },
        { s: "vaelis", t: "Great-uncle. They left us to *burn*." },
        { s: "aelthir", t: "They are my blood. Release him. Give him a horse. And if you ever raise a blade to that family again, you will answer to me." },
        { n: "Riders bring the news to the Queen that night.", req: { charDead: "aldric" } },
        { s: "corvin", t: "The Warden spared me, Majesty. He called me *blood*. I have never been so insulted and so grateful in the same breath.", req: { charDead: "aldric" } },
        { n: "The Lord-Paladin does not ride home. He rides south, toward the smoke.", req: { charAlive: "aldric" } },
        { s: "aldric", t: "*(to his knights, on the forest road)* The Warden gave me my life. I owe him a debt, and the Dawn has shown me how to pay it. We ride for the burning groves." },
        { s: "maren", t: "*(in {capital}, reading his message)* He's gone into the Silverwood. Against the Orcs. Without orders. …Corvin, why would he *do* that?", req: { charAlive: "aldric" } },
        { s: "corvin", t: "I think, Majesty, your brother has been carrying something very heavy for a very long time. And someone has just shown him a way to put it down.", req: { charAlive: "aldric" } },
      ],
    },
    // THE MARTYR OF THE DAWN (bible §13.1): at Orc hands, in a burning grove.
    B5: [
      { n: "The borderwood, where the Silverwood meets the Bloodmire. A grove of silver trees is burning. Lord-Paladin Aldric Ashcroft and a handful of the Knights of the Dawn hold its only path.", req: { seen: "mercy" },
        alt: "The borderwood, where the Silverwood meets the Bloodmire. A grove of silver trees is burning, and elf children are trapped inside it. Lord-Paladin Aldric Ashcroft, riding the border, sees the smoke and does not wait for orders." },
      { s: "aldric", t: "*(to his knights)* The Warden spared my life. This is how I repay it. Nobody passes this path. *Nobody*.", req: { seen: "mercy" },
        alt: "*(to his knights)* The Dawn doesn't ask whose children they are. Nobody passes this path. *Nobody*." },
      { n: "Out of the smoke come Skarra's own war-band, and Skarra with them, a frog on her shoulder and a torch in each hand." },
      { s: "skarra", t: "The pretty paladin! Protecting TREES! Skarra thought the Queen said NO!" },
      { s: "aldric", t: "The Queen did. *I* didn't." },
      { n: "He holds the path until the last elf is out of the grove. The Knights of the Dawn will sing of it for a hundred years. But he is one man, and they are many, and the grove is burning." },
      { n: "When the smoke clears, the Lord-Paladin lies beneath a silver tree. In his saddlebag is a letter, sealed and unsent, addressed to the Warchief of the Bloodmire." },
      { fx: { kill: "aldric", flag: "aldricFallen" } },
      { s: "aelthir", t: "*(kneeling beside him, in the ashes)* He was my blood. He came to repay a debt I never asked of him. …Take him home to his sister. Gently.", req: { alive: "elf" } },
      { n: "They bring the Lord-Paladin home to {capital} on his own shield. The Temple rings every bell in the city for a day and a night." },
      { s: "maren", t: "*(standing over her brother)* The Orcs. The Orcs broke faith at the parley, and now they've killed my brother." },
      { n: "On the Cathedral steps, the priests are already calling him the Martyr of the Dawn. The crowd is chanting for a crusade." },
      { s: "maren", t: "Then they'll have one. Westmarch marches on the Bloodmire. Every knight. Every tower. …And write it down." },
      { n: "In the Collegium tower, Corvin listens to the chanting from his window, and closes the shutters." },
      { s: "corvin", t: "*(alone)* Twenty years I argued with that man. I never once let him win. He died saving *elf children*, and I never told him he was braver than me. …I'd give anything to lose one argument to him now." },
      { s: "corvin", t: "And listen to them. A martyr. A crusade. The Temple has found a saint to march behind. Reason won't get a word in for a generation." },
    ],
    // The unsent confession.
    B6: [
      { n: "The Lord-Paladin's chambers in the Cathedral, stripped bare for the funeral. Corvin has come for Aldric's saddlebag, at the Queen's request. In it he finds a letter, sealed and unsent." },
      { n: "It is addressed, in Aldric's square, careful hand: *To Grukka Ironjaw, Warchief of the Bloodmire. And to my sister.*" },
      { s: "corvin", t: "*(reading)* “At the parley, the ground shook, and I thought it was an ambush. I drew my sword. I struck first. The Orcs never broke faith. *I* did.”" },
      { s: "maren", t: "*(reading)* …He struck first. At the parley. And I've marched a crusade into the Bloodmire in his name." },
      { s: "corvin", t: "He was trying to put it right, Majesty. The groves, the elf children. I think every sword-stroke in that forest was an apology." },
      { s: "maren", t: "And I have told all Westmarch the Orcs broke faith. Twice." },
      { n: "Maren stands at the window for a long time. Below, the crowd is still chanting her brother's name." },
      { s: "maren", t: "Not yet. Not in the middle of a war. …But write it down, Corvin. Every word. And when this is over, I'll read it aloud on the Cathedral steps myself." },
    ],

    "E-Held": [
      { n: "Westmarch has won by holding the Marches." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "On the steps of the Dawn Cathedral, before the whole city, Queen Maren reads aloud a letter in her brother's hand.", req: { charDead: "aldric" },
        alt: "In the throne room of {capital}, Aldric drops to one knee." },
      { s: "maren", t: "“I struck first. The Orcs never broke faith.” …The Lord-Paladin wrote this. He died in a burning grove, saving elf children. He was a liar, and a hero, and my brother. …Write it down. All of it.", req: { charDead: "aldric" },
        alt: { s: "aldric", t: "A sign." } },
      { s: "maren", t: "No, brother. It's the land. It was always the land.", req: { charAlive: "aldric" } },
      { s: "aelthir", t: "*(in the Silverwood)* Plant a silver tree on the Cathedral steps. For the paladin who held the path.", req: { alive: "elf", charDead: "aldric" } },
      { s: "vaelis", t: "*(in the Silverwood)* A mayfly, remembered by the Silverwood. …He was *brief*. He was also, I admit, somewhat in the way of the fire.", req: { alive: "elf", charDead: "aldric" } },
      { s: "corvin", t: "Every generation must renew the charter, Majesty. Let this be the first thing they read in it.", req: { charDead: "aldric" }, alt: "A renewable Omen. How very *efficient*." },
    ],
    "E-Remains": [
      { n: "Westmarch has won by destroying the Silverwood and the Bloodmire. The forest and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Maren sits alone with the pen, and her brother's unsent letter.", req: { charDead: "aldric" },
        alt: "Maren sits alone with the pen. There is no one left to sign the new charter with, only to sign it for." },
      { s: "maren", t: "He died saving the Elves. And then I finished them anyway. And the Orcs, for a lie he was trying to take back. …Write it down, Corvin.", req: { charDead: "aldric" },
        alt: { s: "aldric", t: "*(very quietly)* Sister. The parley. I struck first. I have to tell you. Now, when it's too late to matter." } },
      { s: "corvin", t: "Every Accord begins with someone who won, Majesty. The trick is being the one who *stops*." },
    ],
    "E-Fallen": [
      { n: "The Orcs have broken Westmarch. {capital} is the last human city standing, and the war-bands of the Bloodmire are at its gates.", req: { conqueror: "orc" },
        alt: "The Elves have broken Westmarch. {capital} is the last human city standing, and black Shadowsteeds circle its walls." },
      { n: "On the steps of the Dawn Cathedral, the Knights of the Dawn hold the line beneath a banner with Aldric's face on it.", req: { charDead: "aldric" },
        alt: "On the steps of the Dawn Cathedral, Aldric draws his sword and takes his place at the head of the last defenders." },
      { s: "aldric", t: "For the first time in my life, Dawn, I am not asking for the Temple. Keep my sister safe." },
      { n: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves two things: the record of Maren's examination, and a letter in the Lord-Paladin's hand.", req: { charDead: "aldric" },
        alt: "In the Collegium tower, Corvin sets the great library alight rather than let it be taken. He saves a single book: the record of Maren's examination, the morning of the Dawn Omen." },
      { s: "maren", t: "Write it down. Someone… write it down." },
      { s: "skarra", t: "*(on the Cathedral steps)* WESTMARCH IS NO MORE! And the tree-folk NEXT! Skarra saved the best for LAST!", req: { conqueror: "orc" } },
      { s: "vaelis", t: "*(in the empty Cathedral)* They would not help us. And now there is nobody left to ask. …We shall let the forest have it.", req: { conqueror: "elf" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Orcs have won by holding the Marches, but Westmarch still stands.", req: { winner: "orc" },
        alt: "The Elves have won by holding the Marches, but Westmarch still stands." },
      { n: "Far away, the split Marchstone speaks, and not to Westmarch." },
      { s: "stone", t: "HELD." },
      { s: "aldric", t: "This is the conjurors' failure. We should have helped the Elves when they asked." },
      { s: "corvin", t: "The Temple will say we lost because we didn't pray hard enough for the Martyr, Majesty. I'm afraid they'll *believe* it.", req: { charDead: "aldric" },
        alt: "For once, Lord-Paladin, I agree with you. We should have helped." },
      { s: "maren", t: "Enough. I'm not standing with the Temple, and I'm not standing with the Collegium. I'm standing with *Westmarch*. We'll build roads for the new crown. Roads outlast crowns. …And write it down." },
    ],
  },
};
