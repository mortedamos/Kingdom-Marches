/**
 * STORY CHARACTER PROFILES
 * ------------------------
 * Pure data for the Knowledge menu's Characters page (js/ui/knowledgebase.js
 * renderCharacters). One article per story character: who they are, their
 * virtues and flaws, and a little background.
 *
 * SPOILER RULE (2026-09-25, user-directed): these articles are readable
 * before a game starts. Nothing here may give away a plot point -- no
 * secrets, romances, betrayals, deaths or twists from doc/story_bible.md.
 * Write only what the character's own kingdom openly knows about them.
 *
 * Keys match js/data/story/characters.js.
 */

window.GameData = window.GameData || {};

window.GameData.STORY_CHARACTER_PROFILES = {
  // ------------------------------------------------------------ WESTMARCH
  maren: {
    role: "Leader of Westmarch",
    background: "A trained magus of the Collegium who became queen after the Dawn Omen: at her examination, the sunrise poured through the College windows and lit her like a lantern. The Temple called it a sign, the Collegium called it remarkable, and for the first time in a century both agreed on a monarch. She rules a kingdom that fuses arcane learning with holy mandate, and knows exactly how dangerous that makes it look.",
    virtues: ["Decisive: she makes the call and stands by it.", "Pragmatic: she cares what works, not who gets the credit.", "A believer in institutions, and in keeping them honest."],
    flaws: ["Secretive: she keeps her own counsel, sometimes too long.", "Her pragmatism reads as godlessness to the Temple."],
    quirks: "Speaks in plans. Never says \"the gods willed it.\" Stands between her brother and her old tutor so often she has worn a groove in the council floor.",
    relations: "Sister to Lord-Paladin Aldric. Former student of Archmage Corvin. As a girl she learned to read from the elf Warden Aelthir, who taught her grandmother before her.",
    quote: "The Temple says I was chosen. The Collegium says I was *elected*. I say the war won't win itself.",
  },
  aldric: {
    role: "Lord-Paladin of the Temple of the Dawn",
    background: "Maren's elder brother, raised to be king and trained as a Knight of the Dawn, then passed over when the Omen chose his little sister. He commands the Temple's paladins and speaks for the Temple at court, where he and the Collegium's Archmage have not agreed on anything in living memory.",
    virtues: ["Brave: first into every breach, and he means it.", "Sincere: he believes every word he says, loudly."],
    flaws: ["Over-proud: he cannot bear to be wrong in front of the Collegium.", "Sanctimonious to the point of absurdity."],
    quirks: "Prays at people. Near their windows. Runs a famously large bar tab at The Goose & Kettle, which he insists is a tithe.",
    relations: "Brother to Queen Maren, whom he serves loyally. Open rival of Archmage Corvin. Owes the halfellows' oldest pub a great deal of silver.",
    quote: "The Dawn guides my blade. And my blade has *opinions*.",
  },
  corvin: {
    role: "Archmage of the Collegium",
    background: "Maren's old tutor and the finest scholar of the Marchstone alive; he deciphered the Accord's closing clause before anyone else. He wants a Westmarch governed by reason, which is to say by the Collegium, and considers the Temple useful for anointing and very little else.",
    virtues: ["Brilliant: the sharpest mind in Westmarch, and he'd tell you so.", "Honest about what he sees, even when it's inconvenient."],
    flaws: ["Condescending to everyone except the Queen.", "Ambitious for the Collegium, and for himself."],
    quirks: "One eyebrow permanently raised. Calls the sun \"a large, hot object\" within earshot of paladins. Has never once set the library on fire. Twice doesn't count.",
    relations: "Tutor to Queen Maren. Open rival of Lord-Paladin Aldric.",
    quote: "If prayer could hold a wall, Lord-Paladin, I'd be out of a job.",
  },

  // ----------------------------------------------------------- SILVERWOOD
  aelthir: {
    role: "Warden of the Silverwood",
    background: "Ancient beyond reckoning, and the last living witness of the Long Accord's swearing: he held the torch when the five crowns swore it. He has buried every other witness. Gentle and grave, he leads the Silverwood through a war he remembers the beginning of.",
    virtues: ["Wise: a thousand years of seeing how things end.", "Patient: the forest's own patience, which has buried cities."],
    flaws: ["Stuck in the past: he cannot let the old promises go.", "His grief for mortal friends can look like weakness."],
    quirks: "Measures time in centuries. Addresses other rulers by their ancestors' names. Remembers every name, including his enemies'.",
    relations: "Great-uncle to Lord Vaelis, his heir. Uncle to the Archdruid Ysolde. Once taught the grandmother of Westmarch's queen to read.",
    quote: "I held the torch when your ancestors swore. I remember how young they all looked.",
  },
  ysolde: {
    role: "Archdruid of the Wellspring",
    background: "The voice of the trees, keeper of the Wellspring, and the one who wakes the Awakened Oaks. Serene, literal and unsettling, she answers exactly the question you asked, which is rarely the one you meant. She and the orc Bog Witch Skarra have despised each other for eighty years.",
    virtues: ["Perceptive: nothing escapes her, least of all her own family.", "Unshakeable: nothing seems to frighten her."],
    flaws: ["Cold: she feels too little, and says so.", "Her literal answers unnerve friend and foe alike."],
    quirks: "Relays the opinions of rivers, oaks and frogs as if they were council members. Speaks of her son the way a gardener speaks of a branch.",
    relations: "Mother of Lord Vaelis. Niece of Warden Aelthir. Sworn enemy of Skarra Ironjaw since a certain Midsummer Fair.",
    quote: "The stone did not break, Warden. It *sighed*.",
  },
  vaelis: {
    role: "Heir to the Warden's Seat, Master of Shadowsteeds",
    background: "Aelthir's grand-nephew and heir, only six hundred years old, which among elves is barely out of the nursery. Immaculate in polished Silverleaf mythril, he regards every other people as brief, loud, half-finished creatures, and says so politely.",
    virtues: ["Poised: nothing provokes him. Almost nothing.", "Formidable: a clever, patient and dangerous rival."],
    flaws: ["Aloof: his contempt for the \"lesser peoples\" is total.", "Vain, and far less wise than he believes."],
    quirks: "Calls other races \"the brief\" and \"mayflies.\" Forgets other rulers' names on purpose. Never raises his voice. Cannot abide the halfellow Mayor, Hobby Trickgrin, or her geese.",
    relations: "Grand-nephew and heir of Warden Aelthir. Son of the Archdruid Ysolde, who is serenely disappointed in him.",
    quote: "One does not converse with mayflies. One outlives them.",
  },

  // ----------------------------------------------------------------- KARRAK
  brunna: {
    role: "High Thane of Karrak",
    background: "A master mason before she was Thane. Karrak's rune-lore says the Marchstone was quarried from beneath her own mountain, the Heartstone of Karrak, lent to the Accord and never returned, and she means to have it back.",
    virtues: ["Steadfast: when Brunna holds a wall, the wall holds.", "Practical: she builds for the next thousand years."],
    flaws: ["Unforgiving: slow to anger and slower still to forgive.", "A fierce mother, and a somewhat oblivious one."],
    quirks: "\"Walls first\" is her answer to most questions. Would like her daughter to tune that axe.",
    relations: "Wife of the runesmith Kazra for thirty years, the steadiest thing in Karrak. Mother of Sigrun. Niece of Loremaster Oskar.",
    quote: "We cut that stone. We carried it. We lent it for a peace. The peace is over. I'll have it back.",
  },
  kazra: {
    role: "Master Runesmith of Karrak",
    background: "Builder of the Runeforged Titans, the mountains that march. A dwarf of few words, all of them heavy. Orcs killed her brother in the Mountain Wars, and she has not spoken his name since.",
    virtues: ["Devoted: to her family, utterly and without condition.", "A genius at the forge."],
    flaws: ["Ruthless: she builds Titans to flatten cities and sleeps soundly.", "Taciturn to a fault; she keeps things to herself."],
    quirks: "Answers most problems with \"Point a Titan at it.\" Wears her wedding ring on a chain around her neck, because rings and forges don't mix.",
    relations: "Wife of High Thane Brunna. Mother of Sigrun.",
    quote: "Titan's done. Point it at something you don't like.",
  },
  oskar: {
    role: "Loremaster and Keeper of the Book of Grudges",
    background: "Brunna's uncle, reader of the deep runes, and keeper of the Book of Grudges: every slight against Karrak for eight hundred years, numbered, dated and underlined. Entry the First concerns the Elves. He is currently somewhere past entry four thousand.",
    virtues: ["Meticulous: if it happened, it's in the Book.", "Learned in the old runes like no one else alive."],
    flaws: ["Petty: forgives nothing, forgets less.", "Deadpan to the point of being mistaken for a wall."],
    quirks: "Reads grudge entries aloud, with the number. Hates his great-niece's music, and adores her.",
    relations: "Uncle of High Thane Brunna. Great-uncle of Sigrun, whose power ballads have their own entries.",
    quote: "The runes say the stone is rooted. I don't like what the runes say. I'm writing *them* in the book.",
  },
  sigrun: {
    role: "Metal Singer of Karrak",
    background: "The Thane's daughter and the loudest dwarf in Karrak: a Metal Singer, whose war-axe is also an electric guitar. Dwarven music is a weapon, and she plays it at full volume. Her dream is to find the legendary Axe of Doom.",
    virtues: ["Brave: she'll charge anything, singing.", "Passionate and funny, with a big heart."],
    flaws: ["Keeps things close to her chest, despite being very, very loud.", "Defiant, especially toward her mother."],
    quirks: "Heavy Metal for the walls, Power Metal for the charge. Writes songs about everything, including battles she's still in.",
    relations: "Daughter of High Thane Brunna and the runesmith Kazra. Great-niece of Oskar, whose Book she is frequently in.",
    quote: "Heavy Metal for the walls, Power Metal for the charge, and a *very* quiet ballad for later.",
  },

  // -------------------------------------------------------------- BLOODMIRE
  grukka: {
    role: "Warchief of the Bloodmire Clans",
    background: "A massive, scarred warlord who united the clans by strength and by keeping his word, which is rare in the bogs. The Accord gave the orcs the worst land in the Marches, and to Grukka the Marchstone was always a fence. He is a widower, and raised his son alone.",
    virtues: ["Honourable: when Grukka gives his word, it holds.", "A born leader the clans actually follow."],
    flaws: ["Wrathful: his temper is legendary, and quick.", "He knows how to take, and is only beginning to wonder how to keep."],
    quirks: "Measures people with one cocked eyebrow. Tells his sister to plot more quietly. Never forgot the Last Parley with Westmarch, which ended in blood.",
    relations: "Father of Varg. Younger brother of Skarra, who has resented him since the day the clans chose him.",
    quote: "Your stone was a fence. Fences break.",
  },
  skarra: {
    role: "Bog Witch of Bloodmire, the Bog-Mother",
    background: "Grukka's elder sister, voice of the ancestors at the Speaking Stones, summoner of Wisps, and the most theatrical person in the Marches. The clans passed her over for Warchief twenty years ago, and she has made sure everyone regrets it. Her constant companion is her pet frog, Destiny, a fat green frog who rides on her shoulder.",
    virtues: ["Cunning: a genuinely clever schemer.", "Fearless in a crisis, and endlessly resourceful."],
    flaws: ["Cruel, and delighted by other people's misfortune.", "Needs an audience for everything, including her plots."],
    quirks: "Cackles. Monologues. Calls her brother \"little Warchief\" and her enemies \"morsel.\" Talks to Destiny the frog constantly; Destiny occasionally runs away. Covets the legendary Umbral Ring and Mortedamos' Malefic Manuscript. Curses anyone who kills a Bog Witch.",
    relations: "Elder sister of Warchief Grukka. Aunt of Varg. Keeper of Destiny the frog. Commander (in her own mind) of Gnash. Sworn enemy of the elf Archdruid Ysolde.",
    quote: "Weep! Wail! Write sad little songs! Skarra *feeds* on sad little songs!",
  },
  gnash: {
    role: "The Butcher of Bloodmire",
    background: "An enormous ogre who smashes walls for fun and serves as Skarra's muscle, because she promised to make him second Warchief (second is more than first; Gnash counted). He is very strong, very cheerful, and not very bright.",
    virtues: ["Loyal: once Gnash is yours, Gnash is yours.", "Cheerful, even in the worst of situations."],
    flaws: ["Happily brutal.", "Too dim to notice what's right in front of him."],
    quirks: "\"Crunchy\" is his highest praise. Counts on his fingers and loses count. Terrified of geese, since the Goose Rout. Loves the Lucky Rock above all treasures: it is both lucky AND a rock.",
    relations: "Loyal to Skarra. Frightened of geese. Devoted to any Lucky Rock he can get his hands on.",
    quote: "Gnash SMASH wall. Wall was a door? Gnash smash door AGAIN, to be sure.",
  },
  varg: {
    role: "Wolf Rider of the Bloodmire",
    background: "Grukka's son and a Wolf Rider. His grey dire wolf, Moss, always knows the way. The gentlest orc in the clans, and the first to wonder aloud whether the orcs could ever build something they keep.",
    virtues: ["Kind: he cares about his riders, and about the people they ride against.", "A dreamer with good ideas."],
    flaws: ["Timid: too afraid of his father and his aunt to say what he thinks.", "Slow to stand up for himself."],
    quirks: "Talks to Moss more than to most orcs. Poetic in a clumsy way. Asks questions no orc is supposed to ask.",
    relations: "Son of Warchief Grukka. Nephew of Skarra. Rider of the dire wolf Moss.",
    quote: "The ancestors say avenge the fallen. What if I don't want anyone to fall?",
  },

  // ------------------------------------------------------------ HEARTHLANDS
  hobby: {
    role: "Mayor of the Hearthlands",
    background: "A legendary former Trouble Maker. Decades ago she masterminded the Goose Rout, when traps, a bonfire and one very angry goose sent an orc raiding party home humiliated, and she was elected Mayor on the strength of it. She runs the Moot, the militia, the harvest and a war, usually all at once.",
    virtues: ["Clever: her plans are brilliant.", "Warm: she genuinely loves her people, and they love her back."],
    flaws: ["Reckless: she takes far too many risks.", "Can't delegate, which is why she is always, always late."],
    quirks: "Calls monarchs \"dear.\" Everything is \"a little plan.\" Grins before bad news. Keeps a goose feather in her hat. Delights in making Lord Vaelis twitch.",
    relations: "Elder sister of Goldie. Niece of Professor Barnaby. The person Lord Vaelis least wants to hear from.",
    quote: "I have a little plan. It involves a goose. No, a *different* goose.",
  },
  goldie: {
    role: "Keeper of The Goose & Kettle",
    background: "Hobby's younger sister, and keeper of The Goose & Kettle, the oldest pub in the Hearthlands, named for the goose of the Goose Rout. Every rumour in the Marches ends up at her bar sooner or later, and she hears all of them.",
    virtues: ["Kind: she feeds everyone who comes through her door.", "Shrewd: nothing gets past her."],
    flaws: ["Meddlesome: she minds everyone's business.", "A dreadful gossip, and proud of it."],
    quirks: "The only person who can make Hobby sit down. Hates Hobby's riskier tricks. Keeps the Lord-Paladin of Westmarch's bar tab, with interest.",
    relations: "Younger sister of Mayor Hobby. Niece of Professor Barnaby. Creditor of Lord-Paladin Aldric.",
    quote: "Sit. Eat. The war will still be there after pie.",
  },
  barnaby: {
    role: "Keeper of the Hearthlands Archive",
    background: "A fussy, pedantic historian who owns the only complete copy of the Long Accord's text, and the Historical Society's maps of every ruin in the Marches. The authority on the old relics, with footnotes.",
    virtues: ["Learned: if it was written down, he has read it.", "Loyal, far more than he lets on."],
    flaws: ["Pompous: he lectures, corrects and footnotes.", "Flusters easily, especially around trouble."],
    quirks: "Won't let anyone breathe on the original Accord. Considers his niece the Mayor \"a menace to good order,\" says so often, and keeps every letter she ever wrote him.",
    relations: "Uncle of Hobby and Goldie.",
    quote: "The ruins were wardhouses. The Society has known for two hundred years. Nobody ever *asks*.",
  },

  // --------------------------------------------------------- THE MARCHSTONE
  stone: {
    role: "The heart of the Long Accord",
    background: "The great stone at the heart of the Marches, on which the five crowns swore the Long Accord a thousand years ago. It kept the peace for a thousand years. When it split, it spoke, and it has something to say about who holds the Marches next.",
    virtues: ["It is the one voice in the story without a flaw."],
    flaws: [],
    quirks: "Speaks rarely, and only in capitals.",
    relations: "Every crown in the Marches wants it. None of them agree on why.",
    quote: "HOLD… OR REMAIN.",
  },
};
