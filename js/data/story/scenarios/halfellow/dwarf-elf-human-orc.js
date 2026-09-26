/**
 * STORY SCENARIO -- halfellow/dwarf+elf+human+orc, "The Last Trick"
 * The canonical halfellow story: the smallest folk in the Marches against
 * every crown, and one last, very big trick. B3: Vaelis sets the crowns
 * against the Hearthlands (whisper, §13.11). B5: THE LAST TRICK -- Barnaby
 * forges four surrenders in perfect Accord calligraphy, and for one week
 * nobody in the Marches fights. The lovers meet in daylight at the pub.
 * B6: the week ends. Shared defaults: js/data/story/shared/halfellow.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/dwarf+elf+human+orc"] = {
  title: "The Last Trick",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll." },
      { s: "barnaby", t: "The Marchstone has split! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "flustered" },
      { s: "hobby", t: "Every crown, Uncle? Karrak, the Silverwood, Westmarch *and* the Bloodmire?", m: "sad" },
      { s: "barnaby", t: "Every crown that ever signed. All four of them. And us.", m: "flustered" },
      { s: "goldie", t: "The smallest folk in the Marches, against everyone. You've always wanted a trick big enough, love.", m: "stern" },
      { s: "hobby", t: "Not like this, Goldie. Never like this.", m: "sad" },
      { n: "Across the Marches, four crowns read the same news." },
      { s: "brunna", t: "Oskar. Open the Book. All the volumes.", m: "angry" },
      { s: "vaelis", t: "Four armies and a village. I do hope the village is amusing.", m: "aloof" },
      { s: "maren", t: "Every crown at once. May the Dawn have mercy on us all.", m: "resolute" },
      { s: "skarra", t: "EVERYONE! Skarra gets to fight EVERYONE! Oh, it's like Midwinter!", m: "gleeful" },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! Hedges, cellars, a pub, and the best forger in the Hearthlands.", m: "scheming" },
      { s: "barnaby", t: "*Forger*, Hobby?", m: "flustered" },
      { s: "hobby", t: "Calligrapher, Uncle. I meant *calligrapher*.", m: "scheming" },
    ],
    B2: [
      { n: "The barley fields, at dawn. Halfellow militia have clashed with dwarf warriors.", req: { firstBlood: "dwarf" },
        alt: { n: "The forest's edge, at dawn. Halfellow militia have clashed with elf rangers.", req: { firstBlood: "elf" },
          alt: { n: "The road to Westmarch, at dusk. Halfellow militia have clashed with human soldiers.", req: { firstBlood: "human" },
            alt: "The hedges of the Hearthlands, at dawn. Halfellow militia have clashed with orc raiders." } } },
      { s: "hobby", t: "First blood. The first of four, I expect.", m: "sad" },
      { s: "hobby", t: "Our traps are out. I used to laugh when those went off.", m: "sad", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love.", m: "sad" },
      { s: "hobby", t: "No. I don't think this one's funny.", m: "sad" },
    ],
    // Vaelis's whisper: every crown against the Hearthlands.
    B3: [
      { n: "Barnaby comes into The Goose & Kettle white-faced, holding three letters. Each was intercepted on the road, and each is addressed to a different crown." },
      { s: "barnaby", t: "Hobby. The Silverwood has written to Karrak, to Westmarch and to the Bloodmire. The same letter, three times.", m: "flustered" },
      { s: "vaelis", t: "*(his letter)* “The Hearthlands feed every army in this war, including yours. Starve the small folk, and every other crown starves with them. I merely point it out.”", m: "aloof" },
      { s: "goldie", t: "He's telling everyone to burn our fields.", m: "angry" },
      { s: "hobby", t: "He's telling everyone that *we* are the prize. Clever. Very clever.", m: "scheming" },
      { n: "Hobby reads the letter three times. Slowly, for the first time since the Marchstone split, she starts to grin." },
      { s: "hobby", t: "Uncle. How good is your handwriting, exactly?", m: "scheming" },
      { s: "barnaby", t: "…Oh, no.", m: "flustered" },
    ],
    // THE LAST TRICK.
    B5: [
      { n: "The Hearthlands Archive, at midnight. Barnaby Pickwort, keeper of the only complete copy of the Accord in the Marches, sits at his desk with four sheets of the finest vellum and a very guilty face." },
      { s: "barnaby", t: "Forty years of scholarship, Hobby. Forty years. And now I'm *forging surrenders*.", m: "flustered" },
      { s: "hobby", t: "Not surrenders, Uncle. *Offers of truce*. One from each crown to each of the others. In perfect Accord calligraphy. With the old seals.", m: "scheming" },
      { s: "goldie", t: "And when they find out?", m: "stern" },
      { s: "hobby", t: "They'll find out in a week. And for one week, nobody in the Marches will fight anybody.", m: "scheming" },
      { n: "The letters go out at dawn. By noon, four crowns are each reading an offer of truce from every other, and none of them wants to be the one to refuse first." },
      { n: "For seven days, the Marches are quiet. The armies stand in the fields and look at each other. Nobody draws a blade." },
      { n: "And on the third day, in broad daylight, a young dwarf with copper braids and an orc on a grey dire wolf walk into The Goose & Kettle together, and sit down at the bar." },
      { s: "goldie", t: "*(to Hobby, low)* The Dwarf Thane's daughter and the Orc Warchief's son. In *love*, Hobby. They heard about the truce. They thought it was *real*.", m: "sad", req: { notSeen: "lovers:meet" },
        alt: { s: "goldie", t: "*(to Hobby, low)* Our two lovebirds. They heard about the truce. They thought it was *real*.", m: "sad" } },
      { fx: { seen: "lovers:meet" } },
      { s: "hobby", t: "Then let it be real, Goldie. For one week. Pour them something nice.", m: "happy" },
      { n: "On the seventh day, the crowns compare their letters. The Marches erupt." },
      { s: "brunna", t: "*Forged*! Oskar, a new volume! Just for the halfellows!", m: "angry", req: { alive: "dwarf" } },
      { s: "maren", t: "Forged. Beautifully. Find me whoever did the calligraphy.", m: "happy", req: { alive: "human" } },
      { s: "skarra", t: "A WEEK! Skarra lost a whole WEEK! Skarra was going to burn things ALL WEEK!", m: "angry", req: { alive: "orc" } },
      { s: "vaelis", t: "*(very quietly, alone)* She used my letter. She read it, and she *used* it. …Magnificent.", m: "happy" },
    ],
    B6: [
      { n: "The Goose & Kettle, early evening. The truce is over. Goldie has cleared a table, laid a proper supper for one, and is standing over it with her arms folded." },
      { s: "goldie", t: "Sit. Eat. And then promise me something.", m: "stern" },
      { s: "hobby", t: "I've got a Moot in ten minutes, and four very angry crowns.", m: "scheming" },
      { s: "goldie", t: "That was it, love. That was the big one. There's no trick left after that.", m: "stern" },
      { s: "hobby", t: "…I know. Now we just have to *win*. The ordinary way.", m: "sad" },
      { s: "barnaby", t: "I've been asked for my calligraphy by three separate crowns. As a *commission*.", m: "flustered" },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the mountains to the forest, from the river to the bog, flies the gold of the Hearthlands. The smallest folk in the Marches hold all of it." },
      { s: "stone", t: "HELD." },
      { n: "That evening, Barnaby writes out a new Accord, in perfect calligraphy. And this time, every signature on it is real." },
      { s: "brunna", t: "Karrak signs. With the *real* seal.", m: "proud", req: { alive: "dwarf" } },
      { s: "maren", t: "Westmarch signs. Properly, this time.", m: "resolute", req: { alive: "human" } },
      { s: "vaelis", t: "The Silverwood signs. I checked the ink myself.", m: "aloof", req: { alive: "elf" } },
      { s: "grukka", t: "Bloodmire signs. Skarra is not allowed near the pen.", m: "defiant", req: { alive: "orc" } },
      { n: "At the bar, a young dwarf and an orc sit together in the daylight, and this time the truce is real.", req: { alive: ["dwarf", "orc"] } },
      { s: "goldie", t: "Supper's at six! And Hobby, *you're* on time for once.", m: "happy" },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying every other crown in the Marches. The mountains, the forest, the river cities and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "In the Archive, Barnaby keeps the four forged letters in a glass case. They are the last things any of those crowns ever agreed on." },
      { s: "goldie", t: "No more tricks, Hobby.", m: "sad" },
      { s: "hobby", t: "No. That was the last one. One week, Goldie. I gave them one week of peace, and it was the best thing I ever did.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Hearthlands have fallen. {capital}, the last halfellow town, has been surrounded." },
      { n: "There is no last trick left. Hobby used it. So the halfellows do what they have always done: every family slips out down the old smugglers' lanes, one by one, in silence." },
      { s: "barnaby", t: "I have the Accord. And the four letters. Somebody should remember the week the Marches stood still.", m: "sad" },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs.", m: "stern" },
      { s: "vaelis", t: "*(in the empty Archive)* The forger's desk. Still warm. …I shall keep the pen.", m: "sad", req: { conqueror: "elf" } },
      { s: "skarra", t: "*(in the ruins)* The goose-girl, GONE! And NO TRICKS! Skarra checked! Skarra checked EVERYWHERE!", m: "gleeful", req: { conqueror: "orc" } },
      { s: "maren", t: "*(in the empty pub)* One week of peace. She gave us that.", m: "sad", req: { conqueror: "human" } },
      { s: "brunna", t: "*(in the empty pub)* Oskar. Close the halfellow volume. …Leave the last page blank.", m: "sad", req: { conqueror: "dwarf" }, alt: { s: "sigrun", t: "*(in the empty pub)* This is where we sat. In the daylight. …Leave it standing.", m: "sad", req: { conqueror: "dwarf" } } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "dwarf" },
        alt: { n: "The Elves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "elf" },
          alt: { n: "Westmarch has won by holding the Marches, but the Hearthlands still stand.", req: { winner: "human" },
            alt: "The Orcs have won by holding the Marches, but the Hearthlands still stand." } } },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "Crowns come and go, dear. Supper's still at six. And they'll always remember the week.", m: "happy" },
      { s: "goldie", t: "And *you* are still going to be late for it.", m: "stern" },
    ],
  },
};
