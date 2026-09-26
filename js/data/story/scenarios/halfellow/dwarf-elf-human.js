/**
 * STORY SCENARIO -- halfellow/dwarf+elf+human, "The Moot That Never Was"
 * Hobby calls the Moot: every crown at one table, stew served. No one's
 * oath means anything with the stone broken, and they come anyway. The most
 * hopeful and the saddest halfellow scenario. B3 is the Moot; B6 is the
 * table, set again, for whoever is left. Threads: bloodline, whisper.
 * Shared defaults: js/data/story/shared/halfellow.js. Bible §9.5.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/dwarf+elf+human"] = {
  title: "The Moot That Never Was",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll." },
      { s: "barnaby", t: "The Marchstone has split! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "flustered" },
      { s: "hobby", t: "Dwarves, Elves and Humans. Three crowns, and every one of them signed the Accord with us.", m: "scheming" },
      { s: "barnaby", t: "And none of them can swear a new one. The stone's broken, Hobby. An oath means nothing now.", m: "flustered" },
      { s: "hobby", t: "Then I'll just have to invite them to something that isn't an oath.", m: "scheming" },
      { s: "goldie", t: "Oh, no. You're going to call a *Moot*.", m: "stern" },
      { s: "hobby", t: "The biggest Moot the Marches have ever seen, dear. Every crown. One table. And you're doing the stew.", m: "scheming" },
      { n: "In Karrak, the Silverwood and Westmarch, three crowns read the news, and one invitation." },
      { s: "brunna", t: "A Moot. With the halfellows. During a *war*. …Oskar, is there a grudge for turning down soup?", m: "angry" },
      { s: "vaelis", t: "A Moot. How *quaint*. Tell the Mayor the Silverwood does not attend picnics.", m: "aloof" },
      { s: "maren", t: "We'll go. We'll listen. And we'll keep our armies exactly where they are.", m: "resolute" },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot planning committee and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! Now, who has the biggest table? I need to borrow it. For about… three crowns.", m: "happy" },
      { s: "barnaby", t: "Hobby, the elves said no.", m: "flustered" },
      { s: "hobby", t: "Vaelis said no, Uncle. The *Warden* hasn't answered yet.", m: "scheming" },
    ],
    B2: [
      { n: "The barley fields, at dawn. Halfellow militia have clashed with dwarf warriors.", req: { firstBlood: "dwarf" },
        alt: { n: "The forest's edge, at dawn. Halfellow militia have clashed with elf rangers.", req: { firstBlood: "elf" },
          alt: "The road to Westmarch, at dusk. Halfellow militia have clashed with human soldiers." } },
      { s: "hobby", t: "First blood. And the Moot's in a fortnight.", m: "sad" },
      { s: "hobby", t: "Our traps are out. I used to laugh when those went off.", m: "sad", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love.", m: "sad" },
      { s: "hobby", t: "No. But they're still invited.", m: "scheming" },
    ],
    // The Moot.
    B3: [
      { n: "The great hall of {capital}, on a rainy evening. There is a long table, and on it a very large pot of Goldie's stew." },
      { n: "They come. Nobody expected them to, and they come anyway: the High Thane of Karrak with her Loremaster, the Queen of Westmarch with her brother and her Archmage, and old Aelthir Moonveil, Warden of the Silverwood." },
      { n: "And, at the very last moment, looking as if he has arrived somewhere by mistake, Lord Vaelis.", req: { alive: "elf" } },
      { s: "hobby", t: "Welcome to the Moot! Nobody can swear anything, so nobody has to. Eat. Talk. Argue, if you like. Just don't draw steel on the tablecloth. Goldie ironed it.", m: "happy" },
      { s: "brunna", t: "*(to Maren)* Your Cathedral debt, Majesty.", m: "angry" },
      { s: "maren", t: "*(to Brunna)* Your tariff, Thane.", m: "angry" },
      { s: "aelthir", t: "*(to both)* The soup, friends. Try the soup.", m: "happy" },
      { n: "For three hours, the crowns of the Marches argue across a halfellow table. Oskar takes notes. Corvin and Aldric disagree about everything, including the bread." },
      { s: "oskar", t: "*(writing)* Entry {grudge} in the Book of Grudges: the Queen of Westmarch took the last dumpling. …Struck through. She offered it to the Thane first.", m: "grudging" },
      { s: "vaelis", t: "*(still standing)* This is the most absurd evening of my very long life.", m: "aloof" },
      { s: "goldie", t: "Then *sit down* for it, dear.", m: "stern" },
      { n: "He does. Nobody at the table has ever seen him sit before." },
      { n: "At midnight, the crowns go home. Nobody has promised anything. The armies are exactly where they were." },
      { s: "barnaby", t: "Nothing came of it, Hobby.", m: "sad" },
      { s: "hobby", t: "They sat at one table, Uncle. For three hours. Nobody's done *that* in a hundred years.", m: "happy" },
    ],
    // The table, set again.
    B6: [
      { n: "The great hall of {capital}. Goldie has laid the long table again, exactly as it was for the Moot." },
      { n: "Some of the chairs will not be filled. The crowns that sat in them are gone.", req: { anyDead: ["dwarf", "elf", "human"] },
        alt: "Every crown is still in the war. None of them will come twice." },
      { s: "goldie", t: "Sit. Eat. And then promise me something.", m: "stern" },
      { s: "hobby", t: "I've a war to finish, Goldie.", m: "scheming" },
      { s: "goldie", t: "Whatever you're planning next, it's the last one. And when it's over, you call the Moot again. Whoever's left.", m: "stern" },
      { s: "hobby", t: "…The last one. And whoever's left, dear. Every chair.", m: "sad" },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the mountains to the forest to the river flies the gold of the Hearthlands." },
      { s: "stone", t: "HELD." },
      { n: "That evening, Hobby calls the Moot again. And this time, when the crowns sit down at the long table, the stone is whole, and their words mean something." },
      { s: "brunna", t: "Then I'll swear it, Mayor. Karrak will keep the peace.", m: "proud", req: { alive: "dwarf" } },
      { s: "maren", t: "Westmarch swears it. *All* of it.", m: "resolute", req: { alive: "human" } },
      { s: "vaelis", t: "*(sitting, without being asked)* The Silverwood… swears it. Do not tell anyone I sat.", m: "aloof", req: { alive: "elf" } },
      { s: "goldie", t: "The Moot That Finally Was. Supper's at six, dears.", m: "happy" },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying every other crown. The mountains, the forest and the river cities are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Goldie lays the long table one last time. Every chair is empty but three." },
      { s: "goldie", t: "No more tricks, Hobby.", m: "sad" },
      { s: "hobby", t: "No. That was the last one. They all sat here once, Goldie. All of them. At *our* table.", m: "sad" },
      { s: "barnaby", t: "I'll write it in the Archive, Hobby. The Moot That Never Was.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Hearthlands have fallen. {capital}, the last halfellow town, has been surrounded." },
      { n: "Hobby's last trick is her best. While the soldiers search empty houses, every halfellow family slips out down the old smugglers' lanes, one by one, in silence." },
      { s: "barnaby", t: "I have the Accord. And the minutes of the Moot. Every word.", m: "sad" },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs.", m: "stern" },
      { n: "In the great hall, the conquerors find the long table still laid, and a single card on it: *The Moot will reconvene. Whoever's left.*" },
      { s: "vaelis", t: "*(reading it)* …I sat at this table. I shall not sit at it again.", m: "sad", req: { conqueror: "elf" } },
      { s: "brunna", t: "*(reading it)* Oskar. No grudge for this one.", m: "sad", req: { conqueror: "dwarf" }, alt: { s: "sigrun", t: "*(reading it)* No grudge for this one. …She fed us.", m: "sad", req: { conqueror: "dwarf" } } },
      { s: "maren", t: "*(reading it)* Leave the table. Exactly as it is.", m: "sad", req: { conqueror: "human" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "dwarf" },
        alt: { n: "The Elves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "elf" },
          alt: "Westmarch has won by holding the Marches, but the Hearthlands still stand." } },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "Crowns come and go, dear. Supper's still at six. And the Moot is still open.", m: "happy" },
      { s: "goldie", t: "And *you* are still going to be late for it.", m: "stern" },
    ],
  },
};
