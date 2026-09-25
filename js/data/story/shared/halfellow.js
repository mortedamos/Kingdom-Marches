/**
 * STORY SHARED -- HALFELLOW PLAYER (lazy-loaded with any halfellow/* scenario)
 * ---------------------------------------------------------------------------
 * Beats reused across the Halfellows' 15 scenarios (doc/story_bible.md §4
 * Halfellow arc, §13), keyed like scenario beats; a scenario defining the
 * same key wins. Goldie dies in the Goldie's Fall scenarios (bible §13.7),
 * so every line of hers here either drops out automatically or falls back
 * to Barnaby. Threads living in js/data/story/shared.js: bloodline (any),
 * feud:* (any), whisper:* (any).
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SHARED = window.GameData.STORY_SHARED || {};
window.GameData.STORY_SHARED.halfellow = window.GameData.STORY_SHARED.halfellow || {};

Object.assign(window.GameData.STORY_SHARED.halfellow, {
  // ---------------------------------------------------------------- arc
  N: [
    { n: "Barnaby returns that evening with the Accord's text, a magnifying glass, and a worried look." },
    { s: "barnaby", t: "The stone's words have changed, Mayor. It won't say *held* this time. Only *remains*." },
    { s: "hobby", t: "Then it's a longer war than I wanted, Uncle. Tell the harvest committee." },
  ],
  R: [
    { n: "The Halfellows could have claimed the Marches. The Mayor refused." },
    { n: "At the heart of the Marches, the split Marchstone speaks." },
    { s: "stone", t: "NOT YET." },
    { s: "barnaby", t: "It won't offer *held* again, Mayor. Only *remains*. Footnote fifteen." },
    { s: "hobby", t: "Then it's the long way round. It usually is, with me." },
  ],
  B3: [
    { n: "The reading room of the Hearthlands Archive, stacked floor to rafters with maps and ledgers. Professor Barnaby Pickwort, the Archive's keeper, has unrolled the Accord across three tables." },
    { s: "barnaby", t: "Mayor, the complete text of the Long Accord. The only one in the Marches. I have annotated it. Lightly." },
    { s: "hobby", t: "Uncle, there are more footnotes than Accord." },
    { s: "barnaby", t: "The Accord was *badly written*, Hobby. Someone had to fix it. Footnote nine: every crown swore peace. Footnote nine-*a*: none of them meant it." },
    { s: "goldie", t: "Eat something while you read, both of you. Footnotes don't count as supper.", alt: { s: "barnaby", t: "*(quietly)* Goldie would have made us eat something while we read." } },
  ],
  B4: [
    { n: "Midnight in the Hearthlands Archive. Barnaby has found something in the Accord's margins, and has woken the whole family to show it." },
    { s: "barnaby", t: "The clause, Mayor. It says the crown that “holds *or* remains”. Not “conquers”. *Holds*. You don't have to beat anyone to hold the Marches. You just have to be *everywhere*." },
    { n: "Slowly, the grin returns to Hobby's face." },
    { s: "hobby", t: "Every field, every lane, every little garden, until the whole Marches are our neighbourhood. …Uncle, that's the biggest trick of all." },
    { s: "barnaby", t: "It's not a *trick*, Hobby. It's *agriculture*." },
    { s: "hobby", t: "Uncle. It's *both*." },
  ],
  B5: [
    { n: "The back room of The Goose & Kettle, the halfellows' oldest pub, well after closing. Hobby spreads a hand-drawn map across the table: a route into the heart of the enemy's lines." },
    { s: "hobby", t: "I'm going in. Alone, tonight. Their war plans are in the command tent, and I'm going to walk out with them in my hat." },
    { s: "goldie", t: "No. You're not twenty, Hobby, and that goose is dead. If they catch you, the Hearthlands lose their Mayor in the middle of a war.",
      alt: { s: "barnaby", t: "No. Goldie would have said no, and she'd have been right. You're not twenty, Hobby." } },
    { s: "barnaby", t: "For once in my life, I agree with your sister. It is *reckless*, even by your standards.", req: { charAlive: "goldie" } },
    { n: "Hobby goes anyway, without her family behind her, for the first time." },
    { n: "At dawn she walks back into The Goose & Kettle with the enemy's war plans folded inside her hat. Nobody says well done. It worked, and she enjoyed it, and that frightens all of them." },
    { s: "hobby", t: "…I'm turning into one of *them*, aren't I, Uncle. The ones who win wars." },
    { s: "barnaby", t: "Not yet, Hobby. But you're close enough to see the house from here." },
  ],
  B6: [
    { n: "The Goose & Kettle, early evening. Goldie has cleared a table, laid a proper supper for one, and is standing over it with her arms folded.",
      req: { charAlive: "goldie" }, alt: "The Goose & Kettle, early evening. Barnaby has laid a supper for one on Goldie's old table, badly. The bread is burnt." },
    { s: "goldie", t: "Sit. Eat. And then promise me something.", alt: { s: "barnaby", t: "Sit. Eat. She'd have insisted. And then promise *me* something." } },
    { s: "hobby", t: "I've got a Moot in ten minutes." },
    { s: "goldie", t: "The Moot can wait ten minutes. Whatever you're planning next, it's the last one. The last scheme, the last trick. Then we go home.",
      alt: { s: "barnaby", t: "The Moot can wait. Whatever you're planning next, it's the last one. For her." } },
    { s: "hobby", t: "…The last one. I promise." },
  ],

  // ---------------------------------------------------------------- first contact
  "meet:dwarf": [
    { n: "Halfellow pedlars reach the foothills of Karrak, the Dwarves' mountain realm. The dwarves buy their barley, and complain about the price." },
    { s: "hobby", t: "The Dwarves! Lovely. Tell them the ale tariff is *not* up for discussion. Unless they're paying." },
    { s: "brunna", t: "*(in Karrak)* Halfellows. Good neighbours. Terrible trade terms.", alt: { s: "sigrun", t: "*(in Karrak)* Halfellows! They make the *pies*!" } },
  ],
  "meet:elf": [
    { n: "Halfellow farmers plant barley right up to the edge of the Silverwood, the Elves' forest, and wave at the watchers in the trees." },
    { s: "hobby", t: "The Elves. Oh, I *like* the Elves. Most of them. Uncle, is Lord Vaelis still the heir?" },
    { s: "barnaby", t: "He is, Hobby. Please don't." },
    { s: "vaelis", t: "*(in the Silverwood)* The Trickgrin woman's people. Count the geese. Count them *twice*." },
  ],
  "meet:human": [
    { n: "Halfellow carts reach the river roads of Westmarch, the Human kingdom, loaded with bread for its cities as they have been for generations." },
    { s: "hobby", t: "Westmarch. They eat our bread and forget to say thank you. Always have." },
    { s: "goldie", t: "And the Lord-Paladin still owes this pub four hundred silver.", alt: { s: "barnaby", t: "And the Lord-Paladin still owes The Goose & Kettle four hundred silver. Goldie would want it collected." } },
  ],
  "meet:orc": [
    { n: "Smoke on the horizon. The Orcs of the Bloodmire have come to the edge of the Hearthlands, and they remember this place." },
    { s: "hobby", t: "The Orcs. Forty years since I sent their raiders home with a goose on their heels." },
    { s: "skarra", t: "*(in the Bloodmire)* The goose-girl! Skarra *remembers* the goose-girl! This time, the goose is DINNER!" },
    { s: "barnaby", t: "Hobby. She remembers you." },
    { s: "hobby", t: "Everyone does, Uncle. That's rather the problem." },
  ],

  // ---------------------------------------------------------------- captures
  "capture:dwarf": [
    { n: "Halfellow militia take {enemyCity}, a dwarf hold, through gates that were somehow unlocked." },
    { s: "hobby", t: "Their brewery's in the cellar, everyone. Nobody touch it. Well. Nobody touch it *much*." },
    { s: "oskar", t: "*(in Karrak)* Unlocked. *Unlocked*. Entry {grudge} in the Book of Grudges: cheating." },
  ],
  "capture:elf": [
    { n: "Halfellow militia march into {enemyCity}, an elf grove-town, and hang the gold banner of the Hearthlands from its tallest branch." },
    { s: "hobby", t: "I've never owned a tree before. Do we water it, or does it water itself?" },
    { s: "vaelis", t: "*(in the Silverwood)* {enemyCity} has stood for nine hundred years. It has been taken by people who eat seven meals a day." },
  ],
  "capture:human": [
    { n: "Halfellow militia take {enemyCity}, a human town of Westmarch." },
    { s: "hobby", t: "Well! All that bread we sold them, and now we've got the bakery back." },
    { s: "corvin", t: "*(in Westmarch)* We lost a town to *farmers*. The Temple will call it a test of faith. I'll call it poor planning." },
  ],
  "capture:orc": [
    { n: "Halfellow militia drive the Orcs out of {enemyCity}. Witnesses mention traps, a bonfire, and at least one goose." },
    { s: "hobby", t: "Just like old times!" },
    { s: "skarra", t: "*(in the Bloodmire)* The GOOSE-GIRL! AGAIN! Skarra will curse every goose in the Marches!" },
  ],
  // ---------------------------------------------------------------- losses
  "lost:dwarf": [
    { n: "Dwarf warriors have taken {city}, a halfellow town. The first thing they seized was the brewery." },
    { s: "hobby", t: "Of course they took the brewery. Of *course* they did." },
    { s: "barnaby", t: "I'll add it to the Archive's list of grievances. It's a short list. I've been meaning to make it longer." },
  ],
  "lost:elf": [
    { n: "Elf warriors have taken {city}, a halfellow town. Word reaches The Goose & Kettle before the smoke has cleared." },
    { s: "vaelis", t: "*(in the captured town)* Round doors. Round windows. Round *everything*. It is like conquering a basket of bread rolls." },
    { s: "hobby", t: "*(very quietly)* Uncle. Fetch me the map. And the good geese." },
  ],
  "lost:human": [
    { n: "Human soldiers of Westmarch have taken {city}, a halfellow town. The Temple has already sent priests to bless it." },
    { s: "hobby", t: "We fed them for three hundred years. Three hundred years of bread, and not *once* did they say thank you." },
    { s: "goldie", t: "Put it on the Lord-Paladin's tab, love.", alt: { s: "barnaby", t: "Put it on the Lord-Paladin's tab. It's what Goldie would have done." } },
  ],
  "lost:orc": [
    { n: "Orc war-bands have burned their way into {city}, a halfellow town." },
    { s: "skarra", t: "*(in the captured town)* The goose-girl's town is MINE! Where are the geese? WHERE ARE THE GEESE?" },
    { s: "hobby", t: "Hidden, Skarra. Where they'll do the most good." },
  ],
  // ---------------------------------------------------------------- eliminations
  "eliminated:dwarf": [
    { n: "The last dwarf hold has fallen. The Holds of Karrak are no more." },
    { s: "oskar", t: "Entry nine hundred and four. The ale tariff. …Tell the Mayor it's settled. There's nobody left to pay it." },
    { s: "hobby", t: "No more dwarf ale, Uncle. Ever. …Pour one for the Thane." },
  ],
  "eliminated:elf": [
    { n: "The last elf grove has fallen. The Silverwood Court is no more." },
    { s: "vaelis", t: "…That was not supposed to happen. The lesser peoples were supposed to *tire*." },
    { s: "hobby", t: "We had supper, dear. It helps." },
    { s: "barnaby", t: "The Warden swore to shelter us once. I'll put that in the Archive. Somebody should remember he meant it." },
  ],
  "eliminated:human": [
    { n: "The last human city has fallen. Westmarch is no more." },
    { s: "maren", t: "Tell the Mayor… thank you for the bread. We never said it. …Write it down." },
    { s: "hobby", t: "Three hundred years, and they finally said it." },
  ],
  "eliminated:orc": [
    { n: "The last orc settlement has fallen. The Bloodmire Clans are no more." },
    { s: "skarra", t: "This isn't the end, goose-girl! The bog REMEMBERS! …Destiny, come *back*!" },
    { s: "hobby", t: "Forty years, Skarra. I almost miss you already." },
  ],

  // ---------------------------------------------------------------- ultimates
  "ultimate:dwarf": [
    { n: "A shadow crosses the barley fields. A Runeforged Titan, a giant golem of rune-carved stone, is walking out of the mountains of Karrak." },
    { s: "hobby", t: "Oh. Oh, that's *big*. Uncle, what does the Archive say about stopping one of those?" },
    { s: "barnaby", t: "Page forty. It says “don't”." },
  ],
  "ultimate:orc": [
    { n: "A shadow crosses the Hearthlands at noon. The Orcs have hatched a Dragon." },
    { s: "hobby", t: "A dragon. Right. Everyone indoors. Goldie, put the kettle on. We're going to need it.", alt: "A dragon. Right. Everyone indoors. Somebody put the kettle on. We're going to need it." },
    { s: "barnaby", t: "The last dragon over the Hearthlands was four hundred years ago. The Archive has a *pamphlet*." },
  ],
  "ultimate:human": [
    { n: "News from Westmarch: the Collegium has made its first Grand Magus, a wizard master of every discipline." },
    { s: "barnaby", t: "Fire, flight, invisibility. The Archive has catalogued eleven ways it could ruin a harvest." },
    { s: "hobby", t: "Then let's make sure it never sees one." },
  ],

  // ---------------------------------------------------------------- relics
  "relic:found:riddle_of_steel": [
    { n: "Halfellow delvers bring back a slim, battered dagger from an old wardhouse ruin: the Riddle of Steel, a blade that strikes whoever it riddles." },
    { s: "barnaby", t: "Hobby. That's your great-grandmother's dagger. The first Trouble Maker. It's been lost for a century." },
    { s: "hobby", t: "*(very quietly)* I know, Uncle. She used to say, “Every lock is a question. Every question has an answer.”" },
    { s: "goldie", t: "You're not going to cry in front of the militia, are you, love?", alt: { s: "barnaby", t: "Goldie would have told you not to cry in front of the militia." } },
    { s: "hobby", t: "Absolutely not. *(sniff)*" },
  ],
  "relic:news:riddle_of_steel": [
    { n: "Word reaches The Goose & Kettle: a rival kingdom has found the Riddle of Steel, the dagger of Hobby's great-grandmother, the very first Trouble Maker." },
    { s: "hobby", t: "Someone's got Great-Gran's dagger. Someone's going to be *very* sorry about that." },
  ],
  "relic:found:much_room_mushroom": [
    { n: "Halfellow delvers carry a glowing, enormous mushroom out of an old wardhouse ruin." },
    { s: "barnaby", t: "The Much Room Mushroom! Six hundred years missing! Whoever carries it grows half again as large." },
    { s: "hobby", t: "…Uncle, I want you to know I'm resisting a very big temptation right now." },
  ],
  "relic:news:much_room_mushroom": [
    { n: "Word reaches The Goose & Kettle: a rival kingdom has found the Much Room Mushroom, sacred to the halfellows' mushroom-growers." },
    { s: "barnaby", t: "It's on page one of the Archive! *Page one!*" },
  ],

  // ---------------------------------------------------------------- misc
  "capital-threat": [
    { n: "Enemy soldiers stand within sight of {capital}. The Moot has been called in the middle of the night." },
    { s: "hobby", t: "Everybody with a pitchfork, on the hedges. Everybody with a pie, in the cellars. Everybody with a goose… well. You know who you are." },
  ],
  "found:3": [
    { n: "A third halfellow town is founded: round doors, vegetable plots, and a signpost that already needs repainting." },
    { s: "hobby", t: "Three towns! And I've been late to the founding of every single one." },
    { s: "barnaby", t: "That's a *record*, Hobby. I've checked." },
  ],
  "found:6": [
    { n: "The Hearthlands' sixth town is founded. The Marches are starting to look like one very large neighbourhood." },
    { s: "barnaby", t: "Six towns. At this rate we'll hold the Marches by *accident*." },
    { s: "hobby", t: "Nothing I do is an accident, Uncle. It just *looks* like one. That's the trick." },
  ],
  "tech:tier3": [
    { n: "The Hearthlands' scholars complete their first great advancement of the war." },
    { s: "barnaby", t: "A new discovery! I'll add it to the Archive, next to the old discovery it's clearly copied from." },
  ],
  "built:neighborhood_pub": [
    { n: "A new Neighborhood Pub opens its doors in {city}. Travellers from every corner of the Marches stop in for a pint and a gossip." },
    { s: "goldie", t: "Another pub! Twice the travellers. Twice the gossip. I'll know what our enemies had for breakfast by Thursday.",
      alt: { s: "barnaby", t: "Another pub. Goldie always said a pub hears everything. I'll… try to listen the way she did." } },
    { s: "hobby", t: "Name it after Goldie.", req: { charDead: "goldie" } },
  ],
  "built:historical_society": [
    { n: "In {city}, a branch of the Historical Society opens, and its antiquarians begin mapping every ruin in the Marches." },
    { s: "barnaby", t: "A *branch*. Of *my* Society. Hobby, I may weep. I shan't. But I *may*." },
  ],
  "built:farmers_market": [
    { n: "In {city}, a Farmers Market opens, and every soldier trained there will march well-fed." },
    { s: "hobby", t: "Nobody fights well on an empty stomach, dear. That's not strategy. It's *common sense*." },
  ],
  "built:armory": [
    { n: "In {city}, an Armory is raised, and the town's own militia will fight hardest for their own streets." },
    { s: "barnaby", t: "An armoury. In the Hearthlands. I never thought I'd see the day." },
    { s: "hobby", t: "Neither did I, Uncle. I don't like seeing it now." },
  ],
  "trow:first": [
    { n: "Halfellow farmers report a strange figure near an old wardhouse ruin: the Treasure Trow, a hunched creature of the barrows, fiddling as it drags a sack of treasure." },
    { s: "barnaby", t: "A Trow! The ruins were wardhouses, Hobby. The Archive has known for two hundred years. Nobody ever *asks*." },
    { s: "hobby", t: "I'm asking now, Uncle." },
    { s: "barnaby", t: "…Oh. Well. The wards are failing. Everything the Accord locked away is walking out. Footnote thirty." },
  ],

  // ---------------------------------------------------------------- lovers (§5), heard at The Goose & Kettle
  "lovers:meet": {
    when: { inGame: ["dwarf", "orc"] },
    lines: [
      { n: "The Goose & Kettle, late at night, where every rumour in the Marches ends up. A traveller has had one pint too many, and is talking." },
      { s: "goldie", t: "Hobby. A traveller says the Dwarf Thane's daughter has been sneaking out at night, down the old tunnels, to meet the Orc Warchief's son.",
        alt: { s: "barnaby", t: "Hobby. A traveller in the pub says the Dwarf Thane's daughter has been meeting the Orc Warchief's son. In secret. Goldie would have known what to do with that." } },
      { s: "hobby", t: "A dwarf and an orc. The two oldest enemies in the Marches." },
      { s: "barnaby", t: "One letter to either mother, Hobby, and Karrak and the Bloodmire tear each other apart. It would win us the war." },
      { s: "hobby", t: "…No. No, Uncle. We're going to *hide* them." },
      { s: "barnaby", t: "*Hide* them? From both their parents? In the middle of a war?" },
      { s: "hobby", t: "It's the best trick I've ever been asked to play. And nobody even asked." },
    ],
  },
});

// Rival-against-rival (bible §8), overheard at The Goose & Kettle.
Object.assign(window.GameData.STORY_SHARED.halfellow, {
  "rival-vs-rival:dwarf:elf": [
    { n: "News at The Goose & Kettle: the Dwarves have taken {enemyCity}, an elf grove-town." },
    { s: "barnaby", t: "The Rootcut, again. Eight hundred years, and they're *still* at it." },
  ],
  "rival-vs-rival:dwarf:human": [
    { n: "News at The Goose & Kettle: the Dwarves have taken {enemyCity} from Westmarch, over the Cathedral debt." },
    { s: "hobby", t: "Collecting debts with an army. Remind me to pay the Dwarves for the ale on time, Uncle." },
  ],
  "rival-vs-rival:dwarf:orc": [
    { n: "News at The Goose & Kettle: the Dwarves have stormed {enemyCity}, an orc settlement." },
    { s: "barnaby", t: "The Mountain Wars again. The Archive has *nine volumes* on those." },
  ],
  "rival-vs-rival:elf:dwarf": [
    { n: "News at The Goose & Kettle: the Elves have taken {enemyCity}, a dwarf hold." },
    { s: "hobby", t: "Lord Vaelis in a dwarf hold. He'll hate the ceilings." },
  ],
  "rival-vs-rival:elf:human": [
    { n: "News at The Goose & Kettle: the Elves have taken {enemyCity}, a human town." },
    { s: "barnaby", t: "Elves against Westmarch. The Warden used to teach their Queen's grandmother to read, you know. It's in the Archive." },
  ],
  "rival-vs-rival:elf:orc": [
    { n: "News at The Goose & Kettle: the Elves have burned the Orcs out of {enemyCity}." },
    { s: "hobby", t: "The two witches, at it again. I'd pay good money to watch." },
  ],
  "rival-vs-rival:human:dwarf": [
    { n: "News at The Goose & Kettle: Westmarch has taken {enemyCity}, a dwarf hold." },
    { s: "hobby", t: "The debtors robbing the creditors. Big folk do have interesting ideas about money." },
  ],
  "rival-vs-rival:human:elf": [
    { n: "News at The Goose & Kettle: Westmarch has taken {enemyCity}, an elf grove-town." },
    { s: "barnaby", t: "Axes in the Silverwood. The Warden will be heartbroken." },
  ],
  "rival-vs-rival:human:orc": [
    { n: "News at The Goose & Kettle: Westmarch has taken {enemyCity} from the Orcs." },
    { s: "hobby", t: "Good. Fewer raiders near the barley." },
  ],
  "rival-vs-rival:orc:dwarf": [
    { n: "News at The Goose & Kettle: the Orcs have taken {enemyCity}, a dwarf hold." },
    { s: "barnaby", t: "They'll be after the breweries next. And *then* the barley." },
  ],
  "rival-vs-rival:orc:elf": [
    { n: "News at The Goose & Kettle: the Orcs have burned {enemyCity}, an elf grove-town." },
    { s: "hobby", t: "Poor Warden. Poor trees. …Not poor Lord Vaelis. He'll be fine. He's always fine." },
  ],
  "rival-vs-rival:orc:human": [
    { n: "News at The Goose & Kettle: the Orcs have taken {enemyCity} from Westmarch." },
    { s: "barnaby", t: "The Lord-Paladin will call it a crusade. The Archmage will call it bad maths. They'll both be a bit right." },
  ],
});
