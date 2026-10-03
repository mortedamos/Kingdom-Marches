/**
 * STORY SHARED SCENES (story threads)
 * -----------------------------------
 * Pure data: optional scenes written ONCE and reused by every scenario they
 * fit (doc/story_bible.md §13), keyed STORY_SHARED[playerRace][sceneKey] or
 * STORY_SHARED.any[sceneKey]. A lineup's own scenario file always wins when
 * it defines the same key (js/engine/story.js's getSceneDef) -- e.g.
 * human/elf+orc writes its own "mercy", the one where Aelthir's mercy
 * backfires.
 *
 * Same line format as scenario files; `when` gates a whole scene on the
 * lineup (reqHolds). Writing rules: bible §12 (narration opens every scene,
 * gloss names, never name a city -- use tokens, never assume a building).
 */

window.GameData = window.GameData || {};

window.GameData.STORY_SHARED = {
  // =======================================================================
  // HUMAN PLAYER
  // =======================================================================
  human: {
    // §13.2 -- the first Human/Elf battle.
    bloodline: {
      when: { inGame: "elf" },
      lines: [
        { n: "The Collegium tower, late at night. Archmage Corvin Varro has been reading the Collegium's oldest genealogies since the first battle with the Elves. He sends for the Queen." },
        { s: "corvin", t: "Majesty. Why can humans work magic at all? Dwarves can't. Halfellows can't. The Temple says the Dawn chose us. I went looking for a less flattering answer.", m: "wry" },
        { s: "maren", t: "And?" },
        { s: "corvin", t: "Nine hundred years ago, an elf of the Silverwood loved a human woman. Their child's children founded the old magus families. The Ashcrofts. The Varros. The blood thinned, but it never left.", m: "wry" },
        { n: "He turns the ancient page toward her. The elf's name is written in a looping silver hand: *Aelthir Moonveil*." },
        { s: "maren", t: "The Warden of the Silverwood. Our enemy is our… great-grandfather, several hundred times over.", m: "sad" },
        { s: "corvin", t: "Which means the Dawn Omen may simply have been his blood waking in you. I'm sorry, Majesty. I did say it was a less flattering answer.", m: "wry" },
        { s: "aldric", t: "*(from the doorway, pale)* The Temple must never hear of this.", m: "sad", req: { charAlive: "aldric" } },
      ],
    },
    // §13.2 -- the Elves take a Human city; Aelthir stops an execution.
    mercy: {
      when: { inGame: "elf", seen: "bloodline" },
      lines: [
        { n: "The Elves have taken {city}. Among the prisoners is a figure the elf captains recognise at once.", req: { charAlive: "aldric" },
          alt: "The Elves have taken {city}. Among the prisoners, dragged before the elf captains, is the Archmage of the Collegium himself." },
        { n: "In the captured town square, Lord Vaelis Nightbloom, heir to the Silverwood, draws a slender blade of dark mythril." },
        { s: "vaelis", t: "The Queen's own brother. Kneel, Lord-Paladin. It will be brief. Everything about your kind is.", m: "aloof", req: { charAlive: "aldric" },
          alt: "The Queen's pet conjuror. Kneel, Archmage. You of all people should appreciate a clean, rational ending." },
        { n: "A hand closes over Vaelis's wrist. Aelthir Moonveil, Warden of the Silverwood, has come himself." },
        { s: "aelthir", t: "No. Not this one, Vaelis. Not any of them.", m: "angry" },
        { s: "vaelis", t: "Great-uncle. They are *mayflies*. They are at *war* with us.", m: "angry" },
        { s: "aelthir", t: "They are my blood. Release him. Give him a horse. And if you ever raise a blade to that family again, you will answer to me.", m: "angry" },
        { n: "Riders bring the news to the Queen that night." },
        { s: "aldric", t: "The elf spared me, sister. The Warden himself. He looked at me as though he *knew* me.", m: "sad", req: { charAlive: "aldric" },
          alt: { s: "corvin", t: "The Warden spared me, Majesty. He called me *blood*. I have never been so insulted and so grateful in the same breath.", m: "wry" } },
        { s: "maren", t: "He does know us. Better than we know ourselves, it seems.", m: "sad", req: { seen: "bloodline" },
          alt: "Why would the Warden of the Silverwood spare anyone of ours? Corvin. Find out." },
      ],
    },
    // §13.3 -- witnessing the witches' feud.
    "feud:1": {
      when: { inGame: ["elf", "orc"] },
      lines: [
        { n: "Human scouts return from the borderwood, where the Elves' forest meets the Orcs' bog, with a strange report: a whole grove turned black overnight, the trees weeping green sap." },
        { s: "corvin", t: "A curse. Orcish work, a Bog Witch's. And a grove that ancient is sacred to the Elves' Archdruid. Someone is picking a very personal fight.", m: "wry" },
        { s: "aldric", t: "Witchcraft against witchcraft. The Dawn keeps us from both.", m: "fervent", req: { charAlive: "aldric" },
          alt: { s: "maren", t: "Let the witches claw at each other. Every curse they throw is one not thrown at us.", m: "resolute" } },
      ],
    },
    "feud:2": {
      when: { inGame: ["elf", "orc"] },
      lines: [
        { n: "Rumours cross the Marches: a swarm of sickly green spirit-lights, Wisps from the Orc bog, poured into the Elves' sacred Wellspring. Then the Wellspring rose and drowned them." },
        { s: "corvin", t: "The orc witch Skarra and the elf Archdruid Ysolde. They despise each other more than either despises us. I find that almost restful.", m: "happy" },
      ],
    },
    "feud:3": {
      when: { inGame: ["elf", "orc"] },
      lines: [
        { n: "At dawn, travellers see two witches meet at the split Marchstone itself: the elf Archdruid Ysolde and the orc Bog Witch Skarra. The ground smokes. The sky turns the colour of a bruise." },
        { n: "When the storm clears, both are gone, and neither has won. The stone is scorched in a perfect ring." },
        { s: "maren", t: "Two of the most powerful women in the Marches, and all they wanted was each other's heads. There's a lesson in that.", m: "resolute" },
      ],
    },
    // §13.10 -- finding Vaelis's hand in a war between two other kingdoms.
    "whisper:1": {
      when: { inGame: "elf", kingdoms: 3 },
      lines: [
        { n: "News of fighting between two of Westmarch's rivals arrives with a curious detail: the order that started it bore a seal of silver leaves." },
        { s: "corvin", t: "Silver leaves. That's not orcish, dwarvish or halfellow. That's the Silverwood. Someone in the elf court is writing other people's wars for them.", m: "wry" },
        { s: "maren", t: "Vaelis. The Warden's heir. Watch him, Archmage. A man who starts other people's wars will start ours too.", m: "resolute" },
      ],
    },
    "whisper:2": {
      when: { inGame: "elf", kingdoms: 3 },
      lines: [
        { n: "Another war between Westmarch's rivals, another tidy pile of evidence: an elven arrow at a massacre that no elf was seen at." },
        { s: "corvin", t: "He's very good. Every kingdom in the Marches is at someone's throat, and the Silverwood has barely drawn a bow.", m: "wry" },
        { s: "maren", t: "Then let's not be the next one he plays. Keep our quarrels our own.", m: "resolute" },
      ],
    },
    // 2026-09-26, user-directed threads (js/engine/story.js pollState),
    // recovered 2026-09-27 (user-reported: never played -- these lived only
    // in the orphaned js/data/story/shared/human.js, which nothing has
    // loaded since shared.js was consolidated; see that file's own header):
    //   maren:resolve      -- Maren stops refereeing and starts leading.
    //   faith:1, faith:2   -- Aldric's faith, vindicated; Corvin is wrong.
    //   rift:aldric-goldie -- first blood between Westmarch and the
    //                         Hearthlands, as Aldric and Maren feel it (the
    //                         Hearthlands' own side of it is in the
    //                         `halfellow` section below).
    "maren:resolve": [
      { n: "The council chamber of {capital}, past midnight. Aldric and Corvin have argued for three hours about the war. Maren has listened to all of it, and ruled on every point, as she always does." },
      { s: "corvin", t: "Majesty. May I say something as your old tutor, not your Archmage?", m: "sad" },
      { s: "corvin", t: "You've spent this whole war deciding which of *us* is right. Neither of us is running this war. Our enemies are. You answer them. You never make them answer *you*.", m: "wry" },
      { s: "aldric", t: "*(quietly)* He's right, sister. I hate that he's right. You were the best student the College ever had. You never waited for anyone to tell you the answer.", m: "sad", req: { charAlive: "aldric" } },
      { n: "Maren is silent for a long moment. Then she sweeps the reports off the war table, and unrolls a blank map." },
      { s: "maren", t: "Then no more answering. From tonight, Westmarch moves first. Every time.", m: "resolute" },
      { s: "maren", t: "Archmage: I want the Collegium's scouts on every border by dawn, and a report on what our enemies *fear*, not what they want. Lord-Paladin: pick your best knights. We strike where they haven't looked yet.", m: "resolute" },
      { s: "corvin", t: "*(smiling for the first time in weeks)* There she is.", m: "happy" },
      { s: "aldric", t: "The Dawn waited a long time for this, sister. So did I.", m: "fervent", req: { charAlive: "aldric" } },
    ],
    "faith:1": [
      { n: "A fever sweeps through {capital}. The Collegium's physicians try every tincture in their books, and the sick keep dying. On the seventh night, Aldric opens the Dawn Cathedral to every family who has nowhere left to go." },
      { s: "corvin", t: "Lord-Paladin, you're packing the sick into one room. That will *spread* it. It's the opposite of medicine.", m: "angry" },
      { s: "aldric", t: "Your medicine has had seven days, Archmage. Give the Dawn one night.", m: "fervent" },
      { n: "Aldric and his paladins keep vigil through the night, kneeling among the cots, praying aloud, holding the hands of the dying. At sunrise, light pours through the great eastern window and falls across the whole nave." },
      { n: "By noon, the fevers have broken. Every one." },
      { s: "corvin", t: "*(checking his instruments, three times)* The light… did something. My lenses measured it. My books have no word for it.", m: "sad" },
      { s: "maren", t: "Write down what you saw, Archmage. Not what you can explain. Just what you saw.", m: "resolute" },
      { s: "aldric", t: "The Dawn doesn't need your instruments, Corvin. Only your eyes.", m: "fervent" },
    ],
    "faith:2": [
      { n: "The siege wards Corvin raised over {capital} fail at midnight, silently, with no sound to warn anyone. Enemy raiders are inside the walls before a single bell rings." },
      { s: "corvin", t: "*(shouting across the courtyard)* THE WARDS ARE DOWN! Everyone to the walls, NOW!", m: "angry" },
      { n: "Aldric is already there. He was there before the wards failed, keeping his own vigil, exactly as he does every night the Temple lets him." },
      { s: "aldric", t: "I never trusted a ward I couldn't kneel behind, Archmage! Move!", m: "fervent" },
      { n: "By dawn the raiders are driven out. Corvin finds Aldric still on the wall, bloodied, having held the line the wards were supposed to." },
      { s: "corvin", t: "*(in council, the next morning)* The wards failed. My wards. The Lord-Paladin was right, and I was wrong, and I'd like that in the record, Majesty. Exactly as I said it.", m: "sad" },
      { s: "maren", t: "I'll do better. I'll have it carved over the Collegium door.", m: "happy" },
      { s: "aldric", t: "Don't, sister. He came to the walls himself at midnight, with every mage he had. He was wrong about the wards. He was right about his people.", m: "happy" },
      { s: "corvin", t: "…Now you're just being *gracious* at me. It's unbearable.", m: "wry" },
    ],
    "rift:aldric-goldie": {
      when: { charAlive: ["aldric", "goldie"], alive: ["human", "halfellow"] },
      lines: [
        { n: "The first battle between Westmarch and the Hearthlands. By nightfall, the names of the dead are read out in both kingdoms: knights of the Dawn, and farmers from the villages around The Goose & Kettle." },
        { n: "Aldric reads the halfellow list twice. He knows some of the names. He has bought them drinks." },
        { s: "aldric", t: "Old Tom Bramblewick. He taught me to throw darts. He called me *Lord Paladin Two-Pints*.", m: "sad" },
        { n: "A letter arrives from The Goose & Kettle, in Goldie Trickgrin's round, careful hand. It has no greeting." },
        { s: "goldie", t: "*(her letter)* “Your knights rode through Tom Bramblewick's barley with their swords out. You told me once your Dawn protected the weak. Tell your Queen to stop this, or don't come back to my pub.”", m: "angry" },
        { s: "aldric", t: "*(to Maren)* I've asked you. I've asked the Temple. Does she think I *want* this?", m: "angry" },
        { s: "maren", t: "She thinks you're the one of us she can reach. That's the cruellest compliment there is.", m: "sad" },
        { s: "aldric", t: "Then I'll write back. And I'll tell her the Hearthlands could lay down their pitchforks too.", m: "angry" },
      ],
    },
  },

  // =======================================================================
  // ELF PLAYER
  // =======================================================================
  elf: {
    bloodline: {
      when: { inGame: "human" },
      lines: [
        { n: "Beneath the Heartwood, the great tree at the heart of the Silverwood, the Warden Aelthir Moonveil sits alone after the first battle with the Humans. His niece Ysolde finds him there." },
        { s: "ysolde", t: "You grieve for the human dead more than our own, Warden. The trees have noticed. They are too polite to ask why.", m: "uncanny" },
        { s: "aelthir", t: "Nine hundred years ago, I loved a human woman. We had a son. He lived a whole life in the time it takes an oak to thicken. His children's children founded the magus families of Westmarch.", m: "wistful" },
        { s: "ysolde", t: "Then the Humans' magic…", m: "uncanny" },
        { s: "aelthir", t: "…is mine. Diluted, a thousand times over. The Queen of Westmarch is my descendant. So is her brother. So is her Archmage.", m: "wistful" },
        { n: "A leaf cracks underfoot. Lord Vaelis Nightbloom stands at the edge of the clearing. His face has gone perfectly white." },
        { s: "vaelis", t: "You are telling me I share blood with *mayflies*.", m: "angry" },
        { s: "aelthir", t: "I am telling you that you share *me* with them, Vaelis. Whether that shames you is your affair.", m: "wistful" },
        { s: "vaelis", t: "It does not shame me, great-uncle. It *explains* you.", m: "aloof" },
      ],
    },
    mercy: {
      when: { inGame: "human", seen: "bloodline" },
      lines: [
        { n: "Elf warriors have taken {enemyCity}, a human town. Among the prisoners is Lord-Paladin Aldric Ashcroft, the Queen of Westmarch's own brother.", req: { charAlive: "aldric" },
          alt: "Elf warriors have taken {enemyCity}, a human town. Among the prisoners is Archmage Corvin Varro, the Queen of Westmarch's chief wizard." },
        { s: "vaelis", t: "A prize. I shall make an example of him, great-uncle, the kind the lesser peoples remember. Briefly.", m: "aloof" },
        { s: "aelthir", t: "You will not.", m: "angry" },
        { s: "vaelis", t: "He is the *enemy*.", m: "angry" },
        { s: "aelthir", t: "He is my blood, as you know very well. Give him a horse and an escort to the border. That is the Warden's word.", m: "angry" },
        { n: "Vaelis sheathes his blade slowly, and bows exactly as deeply as courtesy requires, and not one hair deeper." },
        { s: "vaelis", t: "As the Warden commands. I shall remember this, great-uncle. I remember everything.", m: "angry" },
        { s: "ysolde", t: "So do the trees, my son. And they remember *you* sulking.", m: "uncanny" },
      ],
    },
    "feud:1": {
      when: { inGame: "orc" },
      lines: [
        { n: "A grove on the Silverwood's southern edge has turned black overnight, its ancient trees weeping green sap. Ysolde, the Archdruid, kneels among the roots." },
        { s: "ysolde", t: "Bog-rot. Wisp-poison. This is Skarra's hand, the orc witch. She has cursed a grove that was old when the Accord was sworn.", m: "angry" },
        { s: "vaelis", t: "Then flood her bog, mother. With something that does not wash out.", m: "aloof" },
        { s: "ysolde", t: "Oh, I intend to, my son. I intend to.", m: "uncanny" },
      ],
    },
    "feud:2": {
      when: { inGame: "orc" },
      lines: [
        { n: "At midnight, a swarm of sickly green Wisps pours out of the Orc bogs toward the Wellspring, the sacred spring at the heart of the Silverwood." },
        { n: "The Wellspring rises to meet them. By dawn, the Wisps are gone, and the spring runs clear and very, very cold." },
        { s: "ysolde", t: "She sent her spirits to drown in my water. I drowned them instead. Tell the bog-witch the Wellspring says *hello*.", m: "uncanny" },
        { s: "aelthir", t: "Ysolde. This feud will cost us more than the war.", m: "sad" },
        { s: "ysolde", t: "Everything costs, Warden. This one I will pay gladly.", m: "uncanny" },
      ],
    },
    "feud:3": {
      when: { inGame: "orc" },
      lines: [
        { n: "At dawn, Ysolde walks alone to the split Marchstone at the heart of the Marches. Skarra, the Bog-Mother, is already waiting, her frog Destiny on her shoulder." },
        { s: "ysolde", t: "You cursed my grove.", m: "angry" },
        { s: "skarra", t: "You drowned my Wisps! And you laughed! Skarra HEARD you laugh!", m: "angry" },
        { s: "ysolde", t: "I did. It was the first time in a century.", m: "happy" },
        { n: "The ground smokes. The sky bruises. When it clears, both witches are gone, and the stone is scorched in a perfect ring. Neither won." },
        { s: "vaelis", t: "My mother has returned with singed hair and the first smile I have seen on her in three hundred years. I find it deeply unsettling.", m: "aloof" },
      ],
    },
    // §13.10 -- Vaelis's schemes, as the Elf player sees them.
    "whisper:1": {
      when: { kingdoms: 3 },
      lines: [
        { n: "The Warden's council chamber beneath the Heartwood. News has come that two of the Silverwood's rivals are at each other's throats. Vaelis looks very pleased with himself." },
        { s: "vaelis", t: "A forged letter, great-uncle. A seal of the right colour, a grievance of the right size. The lesser peoples do the rest. They always do.", m: "aloof" },
        { s: "aelthir", t: "You started a war.", m: "angry" },
        { s: "vaelis", t: "I *redirected* one. They were always going to fight someone. Better each other than us.", m: "aloof" },
        { s: "aelthir", t: "And when they find the seal, Vaelis?", m: "angry" },
        { s: "vaelis", t: "They will blame each other for forging it, great-uncle. A grudge is always easier to believe than the truth.", m: "aloof" },
      ],
    },
    "whisper:2": {
      when: { kingdoms: 3 },
      lines: [
        { n: "Another war between the Silverwood's rivals. Vaelis has left an elven arrow at a massacre no elf attended, pointing the blame exactly where he wants it." },
        { s: "ysolde", t: "You are playing with the Marches the way a child plays with ants, my son.", m: "angry" },
        { s: "vaelis", t: "Ants do not mind, mother. Ants do not *notice*.", m: "aloof" },
        { s: "aelthir", t: "Ants remember, Vaelis. Everything does, in the end. I will not always be here to stand between you and what you've sown.", m: "sad" },
      ],
    },
  },

  // =======================================================================
  // DWARF PLAYER -- Kazra's Titan (bible §13.4)
  // =======================================================================
  dwarf: {
    "titan:runes": [
      { n: "Kazra Emberdeep's forge, deep in the mountain. The runesmith, wife of the High Thane, has chalked a single enormous rune across the forge floor." },
      { s: "kazra", t: "New rune-lore from the scholars. Good. Gives me somewhere to start.", m: "focused" },
      { s: "oskar", t: "Start what, exactly?", m: "grudging" },
      { s: "kazra", t: "A mountain that walks, Oskar.", m: "focused" },
      { s: "oskar", t: "Entry {grudge} in the Book of Grudges: Kazra, for being cryptic in a forge.", m: "grudging" },
    ],
    "titan:relic": [
      { n: "Dwarf delvers have brought back {item}, a legendary relic from the old Accord wardhouses. Kazra takes it straight down to her forge." },
      { s: "kazra", t: "Every relic from that age has a heartbeat. Runes older than ours, holding power still. I want to know how.", m: "focused" },
      { s: "brunna", t: "Kazra, that's a relic of the Accord. It's not a *spare part*.", m: "angry", req: { charAlive: "brunna" },
        alt: { s: "sigrun", t: "Mother Kazra, that's a relic of the Accord. You can't take it apart!", m: "angry" } },
      { s: "kazra", t: "I'm not taking it apart. I'm *listening* to it. …Then I might take it apart a little.", m: "focused" },
    ],
    "titan:wall": [
      { n: "The first Runewall of Karrak stands complete: a wall carved with fighting runes that strike at any enemy who comes near. Kazra lays her palm flat against the stone." },
      { s: "kazra", t: "It hums. Good. Titan-grade runes, tested on a wall that can't walk away if they go wrong.", m: "focused" },
      { s: "oskar", t: "And if they go *wrong*?", m: "grudging" },
      { s: "kazra", t: "Then we'll need a new wall. Walls first.", m: "happy" },
    ],
    "titan:tech": [
      { n: "In Kazra's forge, the last rune of the great design is finally understood. The chalk lines on the floor now cover a space larger than the Thane's Hall." },
      { s: "kazra", t: "It's done. The design. Every rune for a Runeforged Titan.", m: "focused" },
      { s: "brunna", t: "Then build it, love.", m: "proud", req: { charAlive: "brunna" },
        alt: { s: "sigrun", t: "Then build it, Mother Kazra. For him.", m: "sad" } },
      { s: "kazra", t: "Now I just need a mountain.", m: "focused", req: { charAlive: "brunna" },
        alt: "Now I just need a mountain. …He'd have liked to see it walk." },
    ],
  },

  // =======================================================================
  // ORC PLAYER
  // =======================================================================
  orc: {
    "feud:1": {
      when: { inGame: "elf" },
      lines: [
        { n: "At the Speaking Stones, the orcs' ancient ring of standing stones, Skarra the Bog-Mother cackles over a bubbling pot. Grukka, her brother and Warchief, watches warily." },
        { s: "skarra", t: "Skarra has cursed the elf-witch's favourite grove, little Warchief! Every tree, weeping green! She'll SMELL it from her fancy spring!", m: "gleeful" },
        { s: "grukka", t: "We're at war with the whole Silverwood, and you're fighting one witch.", m: "angry" },
        { s: "skarra", t: "One witch is *all the war Skarra needs*.", m: "gleeful" },
      ],
    },
    "feud:2": {
      when: { inGame: "elf" },
      lines: [
        { n: "Dawn at the Speaking Stones. Skarra sent every Wisp she had to poison the Elves' sacred Wellspring. None have come back." },
        { s: "skarra", t: "She DROWNED them! All of them! And she *laughed*, Skarra heard it on the wind!", m: "angry" },
        { s: "gnash", t: "Wisps can drown? Gnash thought Wisps were made of *glow*.", m: "confused" },
        { s: "skarra", t: "Everything drowns if the witch is spiteful enough, you great lump.", m: "angry" },
      ],
    },
    "feud:3": {
      when: { inGame: "elf" },
      lines: [
        { n: "Skarra returns from the split Marchstone at nightfall, her hair singed, her frog Destiny clinging to her shoulder with all four feet." },
        { s: "grukka", t: "Well? Did you win?", m: "defiant" },
        { s: "skarra", t: "…Skarra doesn't want to talk about it.", m: "sad" },
        { s: "gnash", t: "Witch lost. Gnash can tell. Witch only quiet when she lose.", m: "happy" },
        { s: "skarra", t: "Neither of us lost! *Neither* of us! …Next time, Skarra brings MORE frogs.", m: "angry" },
      ],
    },
  },

  // =======================================================================
  // ANY PLAYER -- threads witnessed from outside
  // =======================================================================
  any: {
    bloodline: {
      when: { inGame: ["human", "elf"] },
      lines: [
        { n: "A strange rumour crosses the Marches: the ancient Warden of the Silverwood once had a child with a human woman, and the magic of Westmarch runs in his blood." },
        { n: "Some say that is why the Warden grieves the human dead. Some say it is why Lord Vaelis, his heir, has not smiled in a week." },
      ],
    },
    "feud:1": {
      when: { inGame: ["elf", "orc"] },
      lines: [
        { n: "Scouts return from the borderwood with a strange report: a whole elven grove turned black overnight, weeping green sap. The work, they say, of the orc Bog Witch Skarra, aimed at the elf Archdruid Ysolde. The two witches despise each other." },
      ],
    },
    "feud:3": {
      when: { inGame: ["elf", "orc"] },
      lines: [
        { n: "Travellers saw two witches meet at the split Marchstone at dawn: the elf Archdruid Ysolde and the orc Bog Witch Skarra. The sky turned the colour of a bruise. Neither won. The stone is scorched in a perfect ring." },
      ],
    },
    "whisper:1": {
      when: { inGame: "elf", kingdoms: 3 },
      lines: [
        { n: "News of a new war between two of your rivals comes with a curious detail: the order that started it was sealed with silver leaves, the mark of the Elves' Silverwood court." },
        { n: "Someone at the elf court is writing other people's wars. Most suspect the Warden's heir, Lord Vaelis Nightbloom." },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// Sigrun and Varg on their own (bible §13.5): personality beyond the
// romance, for games where the other lover's kingdom isn't present.
// ---------------------------------------------------------------------------
Object.assign(window.GameData.STORY_SHARED.dwarf, {
  "found:3": {
    when: { notInGame: "orc" },
    lines: [
      { n: "Karrak's third hold is founded. In the Thane's Hall, Sigrun Stonefast, the Thane's daughter and a Metal Singer, has been waiting all day to ask something.", req: { charAlive: "brunna" },
        alt: "Karrak's third hold is founded. In the Thane's Hall, High Thane Sigrun Stonefast, the young Metal Singer who inherited her father's crown, paces with an idea." },
      { s: "sigrun", t: "Three holds, Father. That's three borders to guard. Give me a war-band. Metal Singers, all of us. We'll hold the loudest border in the Marches.", m: "fierce", req: { charAlive: "brunna" },
        alt: "Three holds now. That's three borders. I'm Thane, so I'm giving *myself* a war-band. Metal Singers. The loudest border in the Marches." },
      { s: "oskar", t: "Entry {grudge} in the Book of Grudges, *pre-emptively*: the noise.", m: "grudging" },
      { s: "brunna", t: "…Fine. But you tune those axes before you march.", m: "proud", req: { charAlive: "brunna" } },
      { s: "sigrun", t: "HA! You won't regret it!", m: "happy" },
      { s: "kazra", t: "She will.", m: "happy" },
    ],
  },
  "relic:found:axe_of_doom": [
    { n: "Dwarf delvers carry something out of an old wardhouse ruin: an axe that is also a guitar, humming with Heavy Metal and Power Metal at once. The legendary Axe of Doom." },
    { s: "sigrun", t: "The Axe of Doom. THE Axe of Doom. The first Metal Singer's own axe. I've dreamed about this since I could *hold* a pick!", m: "fierce" },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges: whoever let her near it.", m: "grudging" },
    { s: "kazra", t: "Give it here a moment. I want to hear its runes.", m: "focused" },
    { s: "sigrun", t: "You can hear its runes from *there*, Mother Kazra. Everyone can. That's the *point*.", m: "happy" },
  ],
  "relic:news:axe_of_doom": [
    { n: "Word reaches the Thane's Hall: a rival kingdom has found the Axe of Doom, the legendary axe-guitar of the very first Metal Singer." },
    { s: "sigrun", t: "The Axe of Doom? In *their* hands? They don't even know which end you strum!", m: "angry" },
    { s: "brunna", t: "Then go and get it back, daughter.", m: "proud", req: { charAlive: "brunna" }, alt: { s: "kazra", t: "Then go and get it back, Thane.", m: "focused" } },
    { s: "sigrun", t: "Gladly.", m: "fierce" },
  ],
});

Object.assign(window.GameData.STORY_SHARED.orc, {
  "found:3": {
    when: { notInGame: "dwarf" },
    lines: [
      { n: "The Orcs' third settlement rises on the bog's edge. Varg, the Warchief's son, walks its muddy lanes with Moss, his grey dire wolf, padding at his side.", req: { notFlag: "mossDead" },
        alt: "The Orcs' third settlement rises on the bog's edge. Varg, the Warchief's son, walks its muddy lanes alone now." },
      { s: "varg", t: "Father. Three camps, and all three will be empty by spring if we just take and move on. Let me build something here. Walls. A well. Something we *keep*.", m: "bashful", req: { notFlag: "mossDead" },
        alt: "Three camps. Good. More places to raise warriors. More warriors to make them pay." },
      { s: "grukka", t: "Orcs don't keep, boy.", m: "defiant", req: { notFlag: "mossDead" }, alt: "…You used to want to build things, boy." },
      { s: "varg", t: "Then orcs have never had anything worth keeping. Let's change that.", m: "bashful", req: { notFlag: "mossDead" }, alt: "I used to have Moss." },
      { s: "skarra", t: "Soft! SOFT! Skarra has frogs with harder hearts!", m: "gleeful", req: { notFlag: "mossDead" },
        alt: "Finally! A Warchief's son with *teeth*! Skarra has waited years for this!" },
    ],
  },
  // Arangil's Vision Glass (2026-09-26, user-directed): Gnash finds it,
  // looks in, and is suddenly, briefly, unsettlingly brilliant -- then
  // Skarra takes it away and he's himself again. No `when`/fx needed, same
  // shape as relic:found:axe_of_doom just above -- pollState already only
  // queues this for the race actually holding the item.
  "relic:found:arangil": [
    { n: "Orc raiders dig a glowing glass orb out of an old ruin. Gnash, delighted by anything that shines, claims it before anyone else can even reach for it." },
    { s: "gnash", t: "SHINY! Gnash keep! Gnash look inside!", m: "happy" },
    { n: "He peers into Arangil's Vision Glass. Light pours across his face, and for one long moment, Gnash doesn't move at all." },
    { s: "gnash", t: "…Fascinating. The currents beneath the bog run east. Redirect them, and the human supply road floods by autumn.", m: "focused" },
    { s: "skarra", t: "*(staring)* …Gnash?", m: "confused" },
    { s: "gnash", t: "I've also calculated the average lifespan of a Bog Witch's patience with her own brother. It is shorter than you'd like.", m: "focused" },
    { n: "Skarra recovers fast, and snatches the orb out of his hands before he can say another disquieting word." },
    { s: "skarra", t: "NO. Bad orb. Skarra will hold this for... safekeeping.", m: "angry" },
    { s: "gnash", t: "*(blinking)* …Skarra have shiny? Gnash want shiny back!", m: "confused" },
    { s: "skarra", t: "*(pocketing it quickly)* Go smash something instead. You're good at smashing.", m: "gleeful" },
    { s: "gnash", t: "Gnash GOOD at smashing! Gnash smash... something! What smash?", m: "happy" },
  ],
});

// ---------------------------------------------------------------------------
// GIMLET (2026-09-26, user-directed): Goldie Trickgrin's dog goes missing,
// turns up one kingdom at a time visiting every rival in the war, and comes
// home at the end -- the halfellow player's own window into every OTHER
// kingdom's characters, none of the politics required. Not magical; she
// just talks like a dog ("Arf!", "Grrr", a tilted head), and somehow every
// warded tower, every hostile camp, and every ancient forest lets her
// through anyway. Queued by js/engine/story.js's pollState, halfellow player
// only: "gimlet:missing" first, then one "gimlet:<race>" per rival actually
// in the game, in random order, then "gimlet:home" once she's seen them all.
//
// STORY_SHARED has no top-level "halfellow" key yet in this file (unlike
// human/elf/dwarf/orc, just above) -- initialized defensively here, same
// "|| {}" shape shared-duels.js already uses for STORY_SHARED.any, rather
// than assuming it exists.
// ---------------------------------------------------------------------------
window.GameData.STORY_SHARED.halfellow = window.GameData.STORY_SHARED.halfellow || {};
Object.assign(window.GameData.STORY_SHARED.halfellow, {
  "gimlet:missing": {
    when: { charAlive: "goldie" },
    lines: [
      { n: "The Goose & Kettle, early morning. Goldie Trickgrin has looked under every table twice." },
      { s: "goldie", t: "Gimlet? Gimlet, love, breakfast's out!", m: "stern" },
      { n: "No claws on the floorboards. No tail thumping the bar. Just an empty dog-bed by the hearth, still warm." },
      { s: "goldie", t: "*(to no one)* Where in the Hearthlands has that dog got to now?", m: "sad" },
      { s: "barnaby", t: "She was chewing on my Volume Four this morning. I may have... encouraged her to go elsewhere.", m: "flustered", req: { charAlive: "barnaby" } },
      { s: "goldie", t: "Barnaby Pickwort, if that dog is lost because of your footnotes—", m: "angry", req: { charAlive: "barnaby" } },
    ],
  },
  "gimlet:human": {
    when: { inGame: "human", alive: "human" },
    lines: [
      { n: "The Collegium tower, deep within Westmarch, warded against scrying, intrusion, and at least four kinds of assassination. Archmage Corvin Varro looks up from his desk to find a small brown dog sitting on it." },
      { s: "corvin", t: "…How. I have wards on every door, every window, and the chimney. How did you get in HERE.", m: "wry" },
      { n: "The dog tilts her head, one ear up, utterly unbothered by seven layers of arcane defense." },
      { s: "gimlet", t: "*(head tilts)* Arf!", m: "happy" },
      { n: "Queen Maren Ashcroft finds them there an hour later: her Archmage, cross-legged on the floor of his own warded tower, scratching a strange dog's ears and looking faintly haunted." },
      { s: "maren", t: "Corvin. Whose dog is this?", m: "happy" },
      { s: "corvin", t: "No idea, Majesty. I would very much like to know how it evaded every ward I own.", m: "wry" },
      { n: "Maren crouches and lets the dog sniff her hand. Watching her wag her whole body, with no war to fight and nowhere she has to be, the Queen almost envies her." },
      { s: "maren", t: "*(quietly)* Must be nice. Going wherever you like. No throne waiting on you.", m: "sad" },
      { n: "The dog licks her hand once, then trots off toward the kitchens, entirely unconcerned with the burdens of monarchy." },
    ],
  },
  "gimlet:elf": {
    when: { inGame: "elf", alive: "elf" },
    lines: [
      { n: "A clearing at the Silverwood's heart, where Archdruid Ysolde is listening to the trees when something considerably louder crashes out of the underbrush." },
      { s: "gimlet", t: "*(tail a blur)* Arf! Arf arf!", m: "happy" },
      { n: "Ysolde's whole composure breaks at once, which nothing in eighty years of war has managed." },
      { s: "ysolde", t: "*(delighted, unusually loud)* Oh! OH. Hello, little one! Yes, YES, you may absolutely climb into my lap!", m: "happy" },
      { n: "Vaelis finds his mother sitting in the dirt with a strange halfellow dog draped across her knees, apparently mid-conversation.", req: { charAlive: "vaelis" } },
      { s: "vaelis", t: "Mother. Are you... speaking with it?", m: "aloof", req: { charAlive: "vaelis" } },
      { s: "ysolde", t: "She says the mushrooms past the old oak are very good this year, and that she is an excellent girl. Both are true.", m: "uncanny" },
      { s: "vaelis", t: "That is not a language, Mother. That is barking.", m: "aloof", req: { charAlive: "vaelis" } },
      { s: "ysolde", t: "Everything is a language, Vaelis. You've simply never been polite enough to listen.", m: "uncanny" },
      { n: "The dog, sensing she has won, rolls over for a belly rub. Ysolde obliges immediately." },
    ],
  },
  "gimlet:dwarf": {
    when: { inGame: "dwarf", alive: "dwarf" },
    lines: [
      { n: "Karrak's great forge, where Loremaster Oskar keeps the Book of Grudges under lock, key, and a very suspicious eye. A small halfellow dog has been asleep on his ledger for an hour." },
      { s: "oskar", t: "*(checking every entry twice)* Four thousand and twelve entries. Not one dog. Not one paw print. How is that possible.", m: "grudging" },
      { n: "He checks the door, then checks it again. Satisfied that no one at all is watching, Oskar allows himself something dangerously close to a smile." },
      { s: "oskar", t: "*(quietly, scratching behind her ears)* …Don't tell Brunna I said this, but you may be the least grudging thing in this entire mountain.", m: "grudging" },
      { s: "gimlet", t: "*(one paw on his knee)* Arf!", m: "happy" },
      { n: "Footsteps in the corridor. Oskar is upright, stern-faced and elbow-deep in the Book of Grudges again before the door even opens, as if nothing at all happened." },
    ],
  },
  "gimlet:orc": {
    when: { inGame: "orc", alive: "orc" },
    lines: [
      { n: "The Bloodmire's outer camp, where Gnash is delighted to discover a small, extremely muddy dog has wandered in and decided to stay." },
      { s: "gnash", t: "SMALL LOUD THING! Gnash like! Gnash keep? Gnash keep!", m: "happy" },
      { s: "gimlet", t: "*(tail wagging furiously)* Arf! Arf!", m: "happy" },
      { n: "Skarra arrives to find her frog, Destiny, puffed up to twice her size on her shoulder, and the dog staring at her with intense, focused interest." },
      { s: "skarra", t: "*(stepping between them)* NO. Stay AWAY from Destiny, you horrible little— thing!", m: "angry" },
      { s: "gimlet", t: "*(crouched low, tail up)* Grrr… Arf!", m: "confused" },
      { s: "skarra", t: "Destiny is a fearsome swamp familiar, not a CHEW TOY! Back! Back, I say!", m: "angry" },
      { n: "Destiny, unbothered, croaks once. Gimlet's head tilts hard to one side, deeply confused by the sound, and croaks nothing back, because she is a dog." },
      { s: "gnash", t: "*(delighted)* Frog say ribbit! Dog say arf! Gnash say... SMASH!", m: "happy" },
      { s: "skarra", t: "Nobody asked you, Gnash. Take the dog. Take it FAR away from my frog.", m: "angry" },
      { n: "Gnash scoops her up under one arm, beaming. Behind him, Destiny gives one last, triumphant ribbit. Gimlet answers with a single, unimpressed arf." },
    ],
  },
  "gimlet:home": {
    when: { charAlive: "goldie" },
    lines: [
      { n: "The Goose & Kettle, weeks later. The door bangs open, and something small, filthy and delighted trots in like it never left." },
      { s: "goldie", t: "*(dropping a tray)* GIMLET. Where in the FIVE KINGDOMS have you been?!", m: "happy" },
      { s: "gimlet", t: "*(tail a blur, muddy paws on Goldie's apron)* Arf! Arf arf!", m: "happy" },
      { n: "She smells like bog, pine, stone-dust, and, faintly, a singed hedge. Goldie decides she doesn't want to know, and hugs her anyway." },
      { s: "goldie", t: "You went and saw the whole war, didn't you. Lucky thing. Someone in this family should get to.", m: "sad" },
      { n: "Gimlet answers with a single, contented arf, and falls asleep under the bar exactly where she always does, as if she'd never been anywhere at all." },
    ],
  },
  // 2026-09-26, user-directed, recovered 2026-09-27 (user-reported: never
  // played -- see the matching note beside the human section's own copy of
  // this thread, above): first blood between the Hearthlands and Westmarch,
  // as Goldie and Hobby and Barnaby feel it. Westmarch's own side of the
  // same event is "rift:aldric-goldie" in the `human` section above.
  "rift:aldric-goldie": {
    when: { charAlive: ["aldric", "goldie"], alive: ["human", "halfellow"] },
    lines: [
      { n: "The first battle between the Hearthlands and Westmarch. That night, The Goose & Kettle is full and silent. Tom Bramblewick's stool at the end of the bar is empty." },
      { s: "goldie", t: "Tom taught the Lord-Paladin to throw darts. Right there. Laughed himself sick. *Lord Paladin Two-Pints*, he called him.", m: "sad" },
      { s: "hobby", t: "Goldie…", m: "sad", req: { charAlive: "hobby" } },
      { s: "goldie", t: "I'm writing to him. Somebody over there has to *hear* it.", m: "angry" },
      { n: "The answer comes back from Westmarch a week later, sealed with the Dawn's sunburst." },
      { s: "aldric", t: "*(his letter)* “I mourn Tom Bramblewick. I will pray for him every morning I have left. But your militia put three of my knights in the ground at the same ford. The Hearthlands could lay down their pitchforks too, Goldie.”", m: "sad" },
      { s: "goldie", t: "*Pitchforks*. We have pitchforks because they have *swords*.", m: "angry" },
      { s: "barnaby", t: "He did say he'd pray for Tom. Every morning. That's… not nothing, Goldie.", m: "sad", req: { charAlive: "barnaby" } },
      { s: "goldie", t: "It's not enough, either.", m: "stern" },
    ],
  },
});

// ---------------------------------------------------------------------------
// RECOVERED 2026-09-27 (user-reported: js/engine/story.js's pollState actively
// queues meet:/capture:/lost:/eliminated:/rival-vs-rival:/relic:/built:/
// tech:tier3/trow:first/ultimate:/capital-threat/found:6/lovers:meet every game,
// but almost none of them existed in this file -- the content below lived only
// in the orphaned js/data/story/shared/human.js, which nothing has loaded since
// this file (shared.js) was consolidated. Ported verbatim, unchanged.
// ---------------------------------------------------------------------------
Object.assign(window.GameData.STORY_SHARED.human, {
  "built:bazaar": [
    { n: "In {city}, a Bazaar opens, and merchants from every kingdom in the Marches come to sell, war or no war." },
    { s: "corvin", t: "Trade, Majesty. The only thing in the Marches older than grudges.", m: "wry" },
    { s: "maren", t: "A market pays for itself eventually. Trade is just another way to win.", m: "happy" },
  ],
  "built:guild_hall": [
    { n: "In {city}, a Guild Hall opens, where Westmarch's soldiers are trained by professionals, and paid by the week." },
    { s: "maren", t: "Neutral ground. The Temple and the Collegium both have to do business here. …I may hold council meetings in it.", m: "happy" },
  ],
  "built:mage_college": [
    { n: "In {city}, a Mage College opens its doors: a tower of blue stone whose crystal crown can strike enemies from afar." },
    { s: "corvin", t: "A Mage College, at last. Its tower will strike any enemy who comes within range. *No prayer required.*", m: "happy" },
    { s: "aldric", t: "I've asked the Temple to bless it anyway.", m: "fervent" },
    { s: "corvin", t: "Please don't. Last time a priest blessed a tower, it wouldn't stop humming hymns.", m: "wry", req: { charAlive: "aldric" } },
  ],
  "built:palace": [
    { n: "In {city}, a Palace rises, with a chapel of the Dawn at its heart where the Knights of the Temple swear their vows." },
    { s: "aldric", t: "The Dawn's own house, Majesty. My knights will train here, and pray here, and *win* here.", m: "fervent", alt: { s: "maren", t: "The Palace chapel. Aldric's knights will swear their vows here now. In his name.", m: "sad" } },
    { s: "corvin", t: "And the Collegium will be allowed to visit on alternate Tuesdays. I've checked the rota.", m: "wry" },
  ],
  "capital-threat": [
    { n: "Enemy soldiers stand within sight of {capital}. The Cathedral bells ring the alarm, and the Collegium towers begin to hum." },
    { s: "aldric", t: "The Knights of the Dawn will hold the Cathedral steps, Majesty. To the last.", m: "fervent" },
    { s: "corvin", t: "And the towers will hold everything else. Try not to stand in front of them, Lord-Paladin.", m: "wry", req: { charAlive: "aldric" },
      alt: "The towers will hold, Majesty. And the Knights will hold the Cathedral steps. For him." },
    { s: "maren", t: "Nobody is holding anything *to the last*. We hold it until they leave.", m: "resolute" },
  ],
  "capture:dwarf": [
    { n: "Human soldiers take {enemyCity}, a dwarf hold, and raise the purple banner of Westmarch over its gate." },
    { s: "corvin", t: "Consider it a *repayment*, Thane. In instalments.", m: "wry" },
    { s: "oskar", t: "*(in Karrak)* Entry {grudge} in the Book of Grudges: Westmarch, for paying their debt in *our own houses*.", m: "angry" },
  ],
  "capture:elf": [
    { n: "Human soldiers march into {enemyCity}, an elf grove-town. The silver trees are very quiet." },
    { s: "aldric", t: "The Dawn shines even in the deep woods, Majesty.", m: "fervent", alt: { s: "maren", t: "Nobody cuts a single tree. Not one.", m: "resolute" } },
    { s: "vaelis", t: "*(in the Silverwood)* {enemyCity} has stood for nine hundred years. It will outlast whoever is holding it this week.", m: "aloof" },
  ],
  "capture:halfellow": [
    { n: "Human soldiers take {enemyCity}, a halfellow town. The granary is full. Nobody feels proud of it." },
    { s: "maren", t: "We took a town that feeds us. Send the Mayor an apology, whether she reads it or not.", m: "sad" },
    { s: "hobby", t: "*(in the Hearthlands)* Tell Westmarch the bread's *extra* now.", m: "angry" },
  ],
  "capture:orc": [
    { n: "Human soldiers drive the Orcs out of {enemyCity}, and the Temple's priests follow them in to bless the ground." },
    { s: "aldric", t: "Another nest of oath-breakers cleansed!", m: "fervent", req: { notSeen: "B6" }, alt: { s: "aldric", t: "…Bless it, and leave it. We've wronged these people enough.", m: "sad" } },
    { s: "skarra", t: "*(in the Bloodmire)* The Queen took {enemyCity}! Skarra will curse her TOWERS! Every one! They'll all sink into a BOG!", m: "angry" },
  ],
  "eliminated:dwarf": [
    { n: "The last dwarf hold has fallen. The Holds of Karrak are no more." },
    { s: "corvin", t: "The Cathedral debt, Majesty. There is no one left to collect it.", m: "sad" },
    { s: "maren", t: "Then pay it anyway. To whoever carries their name.", m: "resolute" },
  ],
  "eliminated:elf": [
    { n: "The last elf grove has fallen. The Silverwood Court is no more." },
    { s: "vaelis", t: "…The mayflies. *The mayflies*. We were supposed to watch them die.", m: "sad" },
    { s: "maren", t: "He taught my great-great-grandmother to read. And I let his sapling die. …Write it down, Corvin. All of it.", m: "sad" },
  ],
  "eliminated:halfellow": [
    { n: "The last halfellow town has fallen. The Hearthlands Moot is no more." },
    { s: "hobby", t: "Tell Westmarch… the tab's closed. There's no one left to collect it.", m: "sad" },
    { s: "maren", t: "Three hundred years of bread. We never once said thank you.", m: "sad" },
  ],
  "eliminated:orc": [
    { n: "The last orc settlement has fallen. The Bloodmire Clans are no more." },
    { s: "skarra", t: "This isn't the end, Queen! The bog REMEMBERS! …Destiny? Come *back*, my precious frog!", m: "angry" },
    { s: "aldric", t: "*(alone, in the Cathedral)* Dawn forgive me. I started this. At the parley. I started all of it.", m: "sad", req: { seen: "B6" } },
    { s: "maren", t: "The parley. It all began at the parley.", m: "sad" },
  ],
  "found:3": [
    { n: "A third city of Westmarch is founded, {city}. The Temple blesses the square, and the Collegium wards the walls, on the same morning." },
    { s: "maren", t: "Three cities. Three altars, three towers, one crown. That's how a kingdom starts to look like one.", m: "happy" },
    { s: "corvin", t: "An altar *and* a ward-stone in every one, blessed and cast on the same morning. We've finally learned to share a calendar.", m: "wry" },
  ],
  "found:6": [
    { n: "{city} is founded, Westmarch's sixth city. The Queen's banners now fly from the river to the hills." },
    { s: "corvin", t: "Six cities, Majesty. Westmarch is now the kingdom everybody else is afraid of.", m: "wry" },
    { s: "maren", t: "I know. I'd hoped we'd be the kingdom everybody else *learns from*. We'll get there.", m: "sad" },
  ],
  "lost:dwarf": [
    { n: "Dwarf warriors have taken {city}, a city of Westmarch. Collateral, they call it." },
    { s: "brunna", t: "*(in the captured city)* The Cathedral debt, Majesty. One city down. I'll send you a receipt.", m: "proud", alt: { s: "oskar", t: "*(in the captured city)* Collateral, collected. I'll send Westmarch a receipt.", m: "grudging" } },
    { s: "corvin", t: "The Temple ran up the debt, and a Collegium city pays it. As usual.", m: "wry" },
  ],
  "lost:elf": [
    { n: "Elf warriors on black Shadowsteeds have taken {city}, a city of Westmarch." },
    { s: "vaelis", t: "*(in the captured city)* A city of the mayflies. Clean the streets. I dislike the smell of hurry.", m: "aloof" },
    { s: "maren", t: "Aelthir would never have ordered that. Vaelis would.", m: "angry" },
  ],
  "lost:halfellow": [
    { n: "Halfellow militia have taken {city}, a city of Westmarch. Nobody saw them coming. Several soldiers report being tripped by a goose." },
    { s: "hobby", t: "*(in the captured city)* Consider it a *deposit*, Majesty. Against the Lord-Paladin's tab.", m: "scheming" },
    { s: "corvin", t: "I did tell you to pay it, Lord-Paladin.", m: "wry", alt: "The Lord-Paladin's tab, Majesty. It has finally been called in." },
  ],
  "lost:orc": [
    { n: "Orc war-bands have burned their way into {city}, a city of Westmarch." },
    { s: "skarra", t: "*(in the captured city)* The Queen's city is MINE! Skarra will turn the Cathedral bells into FROG-POTS!", m: "gleeful" },
    { s: "grukka", t: "*(in the Bloodmire)* That's for the parley, Queen.", m: "defiant" },
    { s: "aldric", t: "*(very quietly)* …Yes. It is.", m: "sad", req: { notSeen: "B6" } },
  ],
  "lovers:meet": {
    when: { inGame: ["dwarf", "orc"] },
    lines: [
      { n: "Human scouts on the border catch an orc Wolf Rider slipping out of an old stone door in a hillside. He escapes on his dire wolf, but drops a letter." },
      { n: "In {capital}, Corvin brings the letter to the Queen. Its seal is dwarvish bronze." },
      { s: "corvin", t: "The door leads into the Underways, the ancient dwarf tunnels beneath the Marches, sealed since the Accord. Someone has reopened them. And someone wrote *this*.", m: "wry" },
      { s: "maren", t: "*(reading)* “Varg. Moss ate my other boot. Come anyway. — S.” …Varg. That's the Orc Warchief's son. And “S”…", m: "sad" },
      { s: "corvin", t: "Sigrun Stonefast. The Dwarf Thane's daughter. Majesty, we're holding a secret that could break *both* our enemies.", m: "wry" },
      { n: "Maren folds the letter slowly and slides it into her sleeve." },
      { s: "maren", t: "We're holding a letter, Archmage. Nothing more. Tell no one. Not even my brother.", m: "resolute" },
    ],
  },
  "meet:dwarf": [
    { n: "Human scouts reach the northern foothills and the first dwarf hold. The Dwarves of Karrak have come down from their mountains." },
    { n: "In Karrak, High Thane Brunna Stonefast reads the scouts' report beside his uncle, Loremaster Oskar Grimgate, keeper of the Book of Grudges." },
    { s: "brunna", t: "Westmarch's soldiers, at our door. The Cathedral debt is long overdue, Uncle.", m: "proud" },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges: Westmarch, interest unpaid. I've been saving it.", m: "grudging" },
    { s: "corvin", t: "*(in {capital}, reading the same report)* The Dwarves. Our creditors. The debt was the *Temple's* idea, you know. I say so often.", m: "wry" },
  ],
  "meet:elf": [
    { n: "Collegium scholars reach the edge of the Silverwood, the Elves' ancient forest. At the first silver tree, their instruments go quiet, as if something had told them to." },
    { s: "maren", t: "Aelthir Moonveil taught my great-great-grandmother to read. He sent a sapling to my coronation. …I let it die. I've always wondered if he knows.", m: "sad" },
    { n: "In the Silverwood, Lord Vaelis Nightbloom, heir to the Warden's seat, reads the scholars' report without interest." },
    { s: "vaelis", t: "The mayflies have brought their little instruments to our trees. How industrious. Someone take them away.", m: "aloof" },
  ],
  "meet:halfellow": [
    { n: "Human carts reach the hedgerows of the Hearthlands, where the halfellows grow half the bread in the Marches." },
    { s: "corvin", t: "The halfellows, Majesty. They've fed our cities for three hundred years. And the Lord-Paladin, I'm told, owes their oldest pub four hundred silver.", m: "wry" },
    { s: "aldric", t: "It is a *tithe*. For the pub's spiritual wellbeing.", m: "fervent" },
    { s: "hobby", t: "*(in the Hearthlands)* Westmarch! Lovely. Tell the Lord-Paladin his tab is *still* open.", m: "scheming" },
  ],
  "meet:orc": [
    { n: "Human scouts reach the southern bogs, where the Orcs of the Bloodmire have raised their spiked settlements." },
    { n: "In the Bloodmire, Warchief Grukka Ironjaw hears the news beside his elder sister, the Bog Witch Skarra." },
    { s: "grukka", t: "Westmarch soldiers. The parley-breakers.", m: "angry" },
    { s: "skarra", t: "Fresh morsels for the bog! Skarra will learn their Queen's name, and then she will SING it! Badly!", m: "gleeful" },
    { s: "aldric", t: "*(in {capital})* The Orcs. I— the Temple will pray for our soldiers.", m: "sad" },
    { n: "Corvin notices that the Lord-Paladin did not say *the oath-breakers*.", req: { charAlive: "aldric" } },
  ],
  "relic:found:amulet_of_aesia": [
    { n: "Human soldiers bring back a sunburst amulet that heals like a druid and blesses like a paladin: the Amulet of Aesia." },
    { s: "aldric", t: "Saint Aesia's amulet! A Dawn-saint's relic, home at last!", m: "fervent" },
    { s: "vaelis", t: "*(in the Silverwood, on hearing)* Aesia was a *druid*. My great-uncle knew her. The mayflies have stolen a dead woman's jewellery and given her a new religion.", m: "aloof", req: { inGame: "elf" } },
    { s: "corvin", t: "Two peoples claiming one saint. I shall enjoy the footnotes.", m: "wry" },
  ],
  "relic:found:arangil": [
    { n: "Human soldiers return with a scrying orb clouded with starlight: Arangil's Vision Glass, the orb of the founder of the Collegium." },
    { s: "corvin", t: "Arangil's own glass. Majesty, this is proof the Collegium is the true heir of Westmarch's founding. I may frame the Lord-Paladin's reaction.", m: "happy" },
    { s: "aldric", t: "It's a *glass ball*, Archmage.", m: "angry" },
    { s: "corvin", t: "So is the sun, Lord-Paladin, from far enough away.", m: "wry" },
  ],
  "relic:found:kuvira": [
    { n: "Human soldiers return from a delve with a golden sword that shines in the dark: Kuvira, Light of Justice, the blade of Saint Kuvira, first Paladin of the Dawn." },
    { s: "aldric", t: "Saint Kuvira's blade. The Temple says whoever bears it is the Dawn's true chosen.", m: "fervent" },
    { s: "corvin", t: "*(quietly, to Maren)* Majesty, I'd keep that sword well away from anyone who has ever wanted your crown.", m: "wry", req: { charAlive: "aldric" } },
    { s: "maren", t: "It goes to the Cathedral. On the altar. Where *nobody* carries it.", m: "resolute" },
  ],
  "relic:found:rosepearl": [
    { n: "Human soldiers bring back a pearl that glows faintly purple: the Rosepearl, set in Westmarch's first crown and pledged to the Marchstone a thousand years ago." },
    { s: "aldric", t: "The Temple will restore it to the Queen, in the Cathedral, at dawn.", m: "fervent" },
    { s: "corvin", t: "The *Collegium* will restore it to the Queen, in the tower, with proper documentation.", m: "wry" },
    { s: "maren", t: "*I'll* restore it to myself, in the kitchen, before either of you can argue.", m: "happy" },
  ],
  "relic:news:amulet_of_aesia": [
    { n: "News from a scout: the Amulet of Aesia has been found, and Westmarch does not have it." },
    { s: "aldric", t: "Saint Aesia's amulet, in the wrong hands. The Temple will pray for its return. Loudly.", m: "fervent", alt: { s: "maren", t: "Saint Aesia's amulet. Aldric always said it belonged in the Cathedral. …Bring it home. For him.", m: "sad" } },
    { s: "vaelis", t: "*(in the Silverwood)* A druid's amulet, and the mayflies call it theirs. They name everything they cannot understand.", m: "aloof", req: { holder: "elf" } },
  ],
  "relic:news:arangil": [
    { n: "News from a scout: Arangil's Vision Glass, the Collegium founder's scrying orb, has been found by another kingdom." },
    { s: "corvin", t: "The founder's own glass, in foreign hands. Majesty, I should like that back. *Personally*.", m: "angry" },
  ],
  "relic:news:kuvira": [
    { n: "News from a scout: another kingdom's delvers have found Kuvira, Light of Justice, the sword of the first Paladin of the Dawn." },
    { s: "aldric", t: "Saint Kuvira's blade, in *heathen* hands! Majesty, the Temple will not rest!", m: "angry", alt: { s: "maren", t: "Saint Kuvira's blade. Aldric would have ridden out tonight. …Bring it home.", m: "resolute" } },
    { s: "corvin", t: "It's a sword, Lord-Paladin. It won't mind who's holding it.", m: "wry", req: { charAlive: "aldric" } },
  ],
  "relic:news:mortedamos": [
    { n: "News from a scout: Mortedamos' Malefic Manuscript, the grimoire of every curse, sealed away by the Accord, has been found." },
    { s: "corvin", t: "The Malefic Manuscript. Majesty, the Collegium would give almost anything to study it.", m: "happy" },
    { s: "aldric", t: "The Temple would give almost anything to *burn* it.", m: "angry" },
    { s: "skarra", t: "*(in the Bloodmire)* MINE! Every curse in the Marches, and they're ALL SKARRA'S NOW!", m: "gleeful", req: { holder: "orc" } },
  ],
  "relic:news:rosepearl": [
    { n: "News from a scout: the Rosepearl, the jewel of Westmarch's first crown, has been found by another kingdom." },
    { s: "maren", t: "Our first crown's pearl, in someone else's treasury. Get it back.", m: "resolute" },
  ],
  "rival-vs-rival:dwarf:elf": [
    { n: "News reaches {capital}: the Dwarves have taken {enemyCity}, an elf grove-town. The Rootcut, the oldest feud in the Marches, has flared again." },
    { s: "corvin", t: "Eight hundred years, and they're still arguing about one grove. Even the Collegium's faculty feuds don't last *that* long.", m: "wry" },
    { s: "vaelis", t: "*(in the Silverwood)* The mud-folk have taken {enemyCity}. They will dig it up, I suppose. They dig *everything* up.", m: "aloof" },
  ],
  "rival-vs-rival:dwarf:halfellow": [
    { n: "News reaches {capital}: the Dwarves have taken {enemyCity} from the halfellows. The ale tariff has become a war." },
    { s: "maren", t: "Westmarch brokered the ale trade between those two. We should have seen this coming.", m: "sad" },
    { s: "hobby", t: "*(in the Hearthlands)* They took the brewery first. Of *course* they did.", m: "angry" },
  ],
  "rival-vs-rival:dwarf:orc": [
    { n: "News from the south: the Dwarves have stormed {enemyCity}, an orc settlement, and the old Mountain Wars have flared again." },
    { s: "aldric", t: "The Dawn smites the Orcs, and uses dwarves to do it. Its ways are mysterious.", m: "fervent" },
    { s: "corvin", t: "Its ways are *a Runewall and a grudge*, Lord-Paladin. Nothing mysterious about it.", m: "wry", req: { charAlive: "aldric" } },
    { s: "skarra", t: "*(in the Bloodmire)* The mud-diggers took {enemyCity}! Skarra will curse their beards! ALL their beards!", m: "angry" },
  ],
  "rival-vs-rival:elf:dwarf": [
    { n: "News reaches {capital}: the Elves have taken {enemyCity}, a dwarf hold. Black Shadowsteeds were seen in the tunnels." },
    { s: "oskar", t: "*(in Karrak)* Entry {grudge} in the Book of Grudges: the Elves. Filed under *Rootcut, continued*.", m: "grudging" },
    { s: "vaelis", t: "*(in the captured hold)* So many *tunnels*. It is like conquering a sponge.", m: "aloof" },
  ],
  "rival-vs-rival:elf:halfellow": [
    { n: "News reaches {capital}: the Elves have taken {enemyCity}, a halfellow town." },
    { s: "vaelis", t: "*(in the captured town)* Round doors. Round windows. Round everything. And somewhere in here, the Trickgrin woman has hidden a *goose*.", m: "aloof" },
    { s: "corvin", t: "Poor Vaelis. Forty years of pranks, and now he has to live in one.", m: "wry" },
  ],
  "rival-vs-rival:elf:orc": [
    { n: "News reaches {capital}: the Elves have taken {enemyCity}, an orc settlement, and the Silverwood has sent its Archdruid to salt the bog." },
    { s: "skarra", t: "*(in the Bloodmire)* The moss-haired CROW! In Skarra's bog! Skarra will curse her ROOTS!", m: "angry" },
    { s: "vaelis", t: "*(in the Silverwood)* The bog was *improved* by the change of ownership. I have not visited. I shall not visit.", m: "aloof" },
  ],
  "rival-vs-rival:halfellow:dwarf": [
    { n: "News reaches {capital}: the halfellows have taken {enemyCity}, a dwarf hold. Witnesses mention unlocked gates and a very persuasive pie." },
    { s: "oskar", t: "*(in Karrak)* Entry {grudge} in the Book of Grudges: the Hearthlands. *Cheating*. Underlined.", m: "angry" },
    { s: "maren", t: "I really must stop underestimating the halfellows. Remind me. Often.", m: "happy" },
  ],
  "rival-vs-rival:halfellow:elf": [
    { n: "News reaches {capital}: the halfellows have taken {enemyCity}, an elf grove-town, and hung the gold banner of the Hearthlands from its tallest branch." },
    { s: "vaelis", t: "*(in the Silverwood)* A grove of nine centuries. Taken by people who eat seven meals a day. …I shall not speak of it.", m: "sad" },
    { s: "corvin", t: "Lord Vaelis has lost a city to Hobby Trickgrin. I would pay good money to see his face.", m: "wry" },
  ],
  "rival-vs-rival:halfellow:orc": [
    { n: "News reaches {capital}: the halfellows have driven the Orcs out of {enemyCity}. Witnesses mention traps, a bonfire, and at least one goose." },
    { s: "skarra", t: "*(in the Bloodmire)* The GOOSE-GIRL! AGAIN! Forty years, and AGAIN!", m: "angry" },
    { s: "gnash", t: "*(hiding)* Goose come back?", m: "confused" },
  ],
  "rival-vs-rival:orc:dwarf": [
    { n: "A rider gallops into {capital} with news from the east. The Orcs have taken {enemyCity}, a dwarf hold, and the Mountain Wars between the Dwarves and the Orcs have begun again." },
    { s: "corvin", t: "Excellent. Let them bleed each other. Every orc fighting a dwarf is an orc not raiding our wagons.", m: "happy" },
    { s: "aldric", t: "You'd cheer for Orcs, Archmage?", m: "angry" },
    { s: "corvin", t: "I'd cheer for *weather*, Lord-Paladin, if it fell on our enemies.", m: "wry", req: { charAlive: "aldric" } },
    { s: "oskar", t: "*(in Karrak)* Volume Seven of the Book of Grudges, the Orc volume: “{enemyCity}, taken.” I've underlined it three times.", m: "happy" },
  ],
  "rival-vs-rival:orc:elf": [
    { n: "News reaches {capital}: the Orcs have burned their way into {enemyCity}, an elf grove-town. The smoke can be seen from the Collegium tower." },
    { s: "skarra", t: "*(in the burning grove)* Tree-folk! Your pretty trees make LOVELY smoke!", m: "gleeful" },
    { s: "vaelis", t: "*(in the Silverwood)* A grove of the Silverwood, burned by *weather with axes*. I find I am… displeased.", m: "angry" },
  ],
  "rival-vs-rival:orc:halfellow": [
    { n: "News reaches {capital}: the Orcs have burned their way into {enemyCity}, a halfellow town." },
    { s: "skarra", t: "*(in the captured town)* The goose-girl's town is MINE! Where are the geese? WHERE ARE THE GEESE?", m: "gleeful" },
    { s: "maren", t: "Half our bread comes from the Hearthlands. If the Orcs keep burning it, Westmarch starves.", m: "sad" },
  ],
  "tech:tier3": [
    { n: "The scholars of the Collegium complete their first great advancement of the war." },
    { s: "corvin", t: "A new discovery, Majesty. Achieved by reason, method, and a great deal of candle wax.", m: "happy" },
    { s: "aldric", t: "Achieved by the Dawn's grace, working through *very* ungrateful men.", m: "fervent", alt: { s: "corvin", t: "*(quietly)* Aldric would have thanked the Dawn for it. …Thank you, Dawn. Just this once.", m: "sad" } },
  ],
  "trow:first": [
    { n: "Human soldiers report a strange figure near an old wardhouse ruin: the Treasure Trow, a hunched creature of the barrows, fiddling as it drags a sack of treasure." },
    { s: "corvin", t: "The ruins were wardhouses, Majesty. The Accord's own vaults. With the stone gone, the wards are failing, and everything they locked away is walking out.", m: "wry" },
    { s: "aldric", t: "A demon! Knights, to arms!", m: "angry", alt: { s: "maren", t: "Leave it be. We have enough enemies.", m: "resolute" } },
    { s: "corvin", t: "It's playing a *fiddle*, Lord-Paladin. Badly. That's not demonic. That's merely *unfortunate*.", m: "wry", req: { charAlive: "aldric" } },
  ],
  "ultimate:dwarf": [
    { n: "Human watchtowers on the northern border sound the alarm. Something enormous is walking down from the mountains: a Runeforged Titan, a giant golem of rune-carved stone built by the Dwarves." },
    { s: "maren", t: "So. The Cathedral's debt collector has arrived.", m: "resolute" },
    { n: "In the forges of Karrak, the runesmith who built it, Kazra Emberdeep, wife of the Dwarf Thane, wipes the soot from her hands." },
    { s: "kazra", t: "Titan's done. Point it at Westmarch.", m: "focused" },
  ],
  "ultimate:human": [
    { n: "In the Collegium tower, a wizard of Westmarch completes the last of the great disciplines. For the first time in a century, the kingdom has a Grand Magus." },
    { s: "corvin", t: "Flight, fire, frost, invisibility, the lot. Proof, Lord-Paladin, that reason can do what the Temple only prays for.", m: "happy", req: { charAlive: "aldric" },
      alt: "Flight, fire, frost, invisibility, the lot. Aldric would have called it a heresy with a fireball. …I rather miss being called that." },
    { s: "aldric", t: "It is a heresy with a fireball.", m: "angry" },
    { s: "maren", t: "It is *our* heresy with a fireball.", m: "resolute" },
  ],
  "ultimate:orc": [
    { n: "A shadow crosses the fields of Westmarch at noon. The Orcs have hatched a Dragon." },
    { s: "aldric", t: "A dragon. The Dawn tests us.", m: "fervent" },
    { s: "corvin", t: "The Dawn doesn't breathe fire, Lord-Paladin. *That* does. I'd prefer a plan to a prayer.", m: "wry", req: { charAlive: "aldric" },
      alt: "A dragon. Majesty, I'd prefer a plan to a prayer. Aldric would have given you the prayer anyway." },
    { n: "In the Bloodmire, Gnash, the huge ogre who serves as the clans' butcher, tries to pet the Dragon." },
    { s: "gnash", t: "Dragon bite Gnash! Dragon is GOOD dragon!", m: "happy" },
  ],
});

// ---------------------------------------------------------------------------
// RECOVERED 2026-09-27 (user-reported, same issue as the human section above):
// content ported verbatim from the orphaned js/data/story/shared/elf.js.
// ---------------------------------------------------------------------------
Object.assign(window.GameData.STORY_SHARED.elf, {
  "built:altar_of_ages": [
    { n: "In {city}, an Altar of Ages is raised, where the young of the Silverwood learn from the old." },
    { s: "vaelis", t: "Another place for the elders to tell me I am young. Splendid.", m: "aloof" },
    { s: "aelthir", t: "You *are* young, Vaelis. That is not an insult. It is a warning.", m: "wistful" },
  ],
  "built:silverleaf_atelier": [
    { n: "In {city}, the first Silverleaf Atelier opens, and its artisans begin forging mythril armour." },
    { s: "vaelis", t: "At last. A building in this war with some *taste*.", m: "happy" },
  ],
  "built:treetop_watch": [
    { n: "Above {city}, a Treetop Watch is raised, and the elves' eyes reach twice as far." },
    { s: "aelthir", t: "Vigilance is the oldest thing we do. Older than the Accord. Older than me.", m: "wistful" },
  ],
  "built:wellspring_grove": [
    { n: "In {city}, a Wellspring Grove is planted, carrying the healing waters of the Silverwood's sacred spring." },
    { s: "ysolde", t: "The Wellspring has a daughter. She will be less patient than her mother. Good.", m: "uncanny" },
  ],
  "capital-threat": [
    { n: "Enemy soldiers stand within sight of {capital}. The rangers in the Treetop Watches have not slept in three days." },
    { s: "aelthir", t: "The forest is patient, Vaelis. It has buried cities before.", m: "wistful" },
    { s: "vaelis", t: "Then let it bury this one's besiegers, great-uncle. *Quickly*, for once.", m: "angry" },
  ],
  "capture:dwarf": [
    { n: "Elf warriors take {enemyCity}, a dwarf hold, and walk its stone halls in silence." },
    { s: "vaelis", t: "Stone halls. Stone doors. Stone *everything*. It is like conquering a very large gravel pit.", m: "aloof" },
    { s: "oskar", t: "*(in Karrak)* Entry {grudge} in the Book of Grudges: {enemyCity}. The Silverwood. Underlined until the quill breaks.", m: "angry" },
  ],
  "capture:halfellow": [
    { n: "Elf warriors take {enemyCity}, a halfellow town, all round doors and vegetable gardens." },
    { s: "vaelis", t: "Round doors. Round windows. It is like conquering a basket of bread rolls.", m: "aloof" },
    { s: "aelthir", t: "Leave their gardens as they were, Vaelis. Every one.", m: "angry" },
    { s: "vaelis", t: "Great-uncle. They are *turnips*.", m: "aloof" },
  ],
  "capture:human": [
    { n: "Elf warriors take {enemyCity}, a human town of Westmarch." },
    { s: "vaelis", t: "Another mayfly town. It will be a meadow again in three hundred years. I shall watch.", m: "aloof" },
    { s: "aelthir", t: "*(quietly)* Treat the prisoners well. All of them.", m: "sad", req: { seen: "bloodline" }, alt: "Treat the prisoners well." },
  ],
  "capture:orc": [
    { n: "Elf warriors drive the Orcs out of {enemyCity}, and put out their fires." },
    { s: "ysolde", t: "The bog will heal. In a century or two.", m: "uncanny" },
    { s: "skarra", t: "*(in the Bloodmire)* They took {enemyCity}! Skarra will curse the elf-witch's roots! EVERY root!", m: "angry" },
  ],
  "eliminated:dwarf": [
    { n: "The last dwarf hold has fallen. The Holds of Karrak are no more." },
    { n: "In the ruined Thane's Hall, Loremaster Oskar closes the Book of Grudges for the last time." },
    { s: "oskar", t: "Entry the First. The Rootcut. It was never us. *(He closes the Book.)* Nobody's listening now anyway.", m: "sad" },
    { s: "aelthir", t: "*(beneath the Heartwood)* …I stood in that grove. I never believed it was them. I should have said so, while there was someone to say it to.", m: "sad" },
  ],
  "eliminated:halfellow": [
    { n: "The last halfellow town has fallen. The Hearthlands are no more." },
    { s: "hobby", t: "Crowns come and go, dear. Tell Lord Vaelis I'll miss him. …No. Don't tell him that.", m: "sad" },
    { s: "vaelis", t: "The Trickgrin woman is gone. The Silverwood will be *quieter*. …I find I do not care for the quiet.", m: "sad" },
  ],
  "eliminated:human": [
    { n: "The last human city has fallen. Westmarch is no more." },
    { s: "maren", t: "Tell the Warden… his blood was good to us.", m: "sad", req: { seen: "bloodline" }, alt: "Tell the Warden he taught my great-great-grandmother well." },
    { s: "aelthir", t: "I held the torch when their ancestors swore. I have outlived them too.", m: "sad" },
    { s: "vaelis", t: "Brief things end, great-uncle. That is what brief *means*.", m: "aloof" },
  ],
  "eliminated:orc": [
    { n: "The last orc settlement has fallen. The Bloodmire Clans are no more." },
    { s: "skarra", t: "This isn't the end! The bog remembers! Destiny remembers! …Destiny? Come *back*, my precious frog!", m: "angry" },
    { s: "ysolde", t: "The bog-witch is gone. I expected to feel triumphant. I feel as though someone has closed a window.", m: "sad" },
  ],
  "found:6": [
    { n: "The Silverwood's sixth grove-town is planted. The forest has grown further in one war than in the last three centuries." },
    { s: "ysolde", t: "The trees are pleased. They have not been this busy since the Accord.", m: "happy" },
    { s: "vaelis", t: "Six groves. Perhaps the Silverwood is finally remembering what it is.", m: "aloof" },
  ],
  "lost:dwarf": [
    { n: "Dwarf warriors have taken {city}, an elf grove-town. Word reaches the Heartwood by nightfall." },
    { s: "vaelis", t: "The mud-folk have taken a grove. They will fell every tree in it and call it progress.", m: "angry" },
    { s: "ysolde", t: "The trees there are screaming, Warden. I can hear them from here.", m: "sad" },
  ],
  "lost:halfellow": [
    { n: "Halfellow militia have slipped into {city}, an elf grove-town, through gates that were somehow unlocked." },
    { s: "vaelis", t: "Unlocked. The Trickgrin woman, again. Forty years, great-uncle. *Forty years*.", m: "angry" },
    { s: "hobby", t: "*(in the captured town)* Lovely trees! Do tell Lord Vaelis I left him a present in his tent.", m: "scheming" },
  ],
  "lost:human": [
    { n: "Human soldiers of Westmarch have taken {city}, an elf grove-town. Their woodcutters arrived with the soldiers." },
    { s: "vaelis", t: "First the measuring rods, then the axes. I did *say*.", m: "aloof" },
    { s: "aelthir", t: "They are cutting the oldest trees first. They always do.", m: "sad" },
  ],
  "lost:orc": [
    { n: "Orc war-bands have burned their way into {city}, an elf grove-town." },
    { s: "skarra", t: "*(in the burning grove)* The elf-witch's precious trees! BURNING! Skarra will send her the ashes!", m: "gleeful" },
    { s: "ysolde", t: "Then I shall send her the flood.", m: "angry" },
  ],
  "lovers:meet": {
    when: { inGame: ["dwarf", "orc"] },
    lines: [
      { n: "Beneath the Heartwood, Ysolde opens her eyes suddenly in the middle of the night." },
      { s: "ysolde", t: "Old tunnel-wards, waking, deep under the Marches. The dwarves' Underways. Someone is using them. A dwarf and an orc. Together. Every night.", m: "uncanny" },
      { s: "vaelis", t: "Oh, I *know*. My scouts found the tracks weeks ago: the Thane's own daughter and the Warchief's own son. I have been saving it.", m: "happy" },
      { s: "vaelis", t: "Great-uncle, one letter to each of their parents, and Karrak and the Bloodmire tear each other apart. Two nuisances, ended at once.", m: "aloof" },
      { s: "aelthir", t: "No.", m: "angry" },
      { s: "vaelis", t: "It would win us the *war*.", m: "angry" },
      { s: "aelthir", t: "The Silverwood will not break a love to win a war, Vaelis. Not while I am Warden.", m: "angry" },
      { s: "vaelis", t: "*(bowing)* Sentimental, great-uncle. As always.", m: "aloof" },
    ],
  },
  "meet:dwarf": [
    { n: "Elf scouts in the eastern treetops watch dwarf surveyors come down from the mountains of Karrak, hammers on their belts." },
    { s: "vaelis", t: "The mud-folk. Digging again. Tell them the Silverwood remembers the Rootcut, and so do I.", m: "aloof" },
    { s: "aelthir", t: "I stood in that dying grove, Vaelis. I remember it too. …I have never been certain it was them.", m: "wistful" },
  ],
  "meet:halfellow": [
    { n: "Elf scouts watch halfellow farmers plant barley right up to the edge of the Silverwood, whistling." },
    { s: "vaelis", t: "The Trickgrin woman's people. Keep them out of the Heartwood. And count the geese.", m: "aloof" },
    { s: "aelthir", t: "I once swore to shelter them, Vaelis. Under the Accord.", m: "wistful" },
    { s: "vaelis", t: "The Accord is broken, great-uncle. So, happily, is the promise.", m: "happy" },
  ],
  "meet:human": [
    { n: "Elf scouts watch Collegium scholars of Westmarch measuring the silver trees at the forest's edge." },
    { s: "vaelis", t: "Mayflies with measuring rods. They have come to learn what the forest is, so they can decide how much of it to take.", m: "aloof" },
    { s: "aelthir", t: "I taught their Queen's great-great-grandmother to read. She always turned the page before I had finished the line. I expect the girl is the same.", m: "wistful" },
  ],
  "meet:orc": [
    { n: "Smoke on the southern wind. Orc war-bands have lit their first fires at the edge of the Silverwood." },
    { s: "ysolde", t: "The bog-witch's people. Skarra. I can smell her curses from here.", m: "angry" },
    { s: "vaelis", t: "Fire-bringers. How *predictable*. Send rangers, great-uncle. I shall not ask twice.", m: "aloof" },
  ],
  "relic:found:alunaria": [
    { n: "Elf delvers return from an old Accord wardhouse carrying a staff that glows with cold moonlight: Alunaria, the heirloom of House Moonveil." },
    { s: "aelthir", t: "My father pledged that staff to the Accord. I was there. I have not seen it in a thousand years.", m: "wistful" },
    { s: "vaelis", t: "Then it comes home to the family. To the *heir*, naturally.", m: "happy" },
    { s: "ysolde", t: "Naturally, my son. When you are one.", m: "uncanny" },
  ],
  "relic:found:amulet_of_aesia": [
    { n: "Elf delvers bring back a golden amulet shaped like a sunburst: the Amulet of Aesia, which the Humans' Temple claims for its saints." },
    { s: "aelthir", t: "Aesia was no human saint. She was a druid of the Silverwood. I knew her. She laughed at everything.", m: "happy" },
    { s: "vaelis", t: "Then let the Temple of the Dawn come and claim it. I should enjoy watching them try.", m: "happy" },
  ],
  "relic:found:eyrhild": [
    { n: "Elf delvers bring back Eyrhild's Fury, the silver-lit sword of the Silverwood's greatest Blade Dancer." },
    { s: "vaelis", t: "Eyrhild. My ancestor. I have waited six hundred years for the lesser peoples to return it. I did not expect them to *lose* it first.", m: "aloof" },
  ],
  "relic:news:agasou": [
    { n: "Word reaches the Heartwood: the Spear of Agasou, which the elves say was stolen from a druid grove with the druids' beast-shapes, has been found." },
    { s: "ysolde", t: "The spear that learned our shapes. Bear, raptor, wolf. It should never have left the grove.", m: "uncanny" },
    { s: "vaelis", t: "Then we shall return it to the grove. Point first, into whoever holds it.", m: "angry" },
  ],
  "relic:news:alunaria": [
    { n: "Word reaches the Heartwood: a rival kingdom has found Alunaria, the moonlight staff of House Moonveil." },
    { s: "aelthir", t: "My father's staff. In the hands of strangers.", m: "sad" },
    { s: "vaelis", t: "Then we take it back, great-uncle. For once, I think we agree.", m: "angry" },
  ],
  "relic:news:amulet_of_aesia": [
    { n: "Word reaches the Heartwood: the Amulet of Aesia has been found, and the Humans' Temple calls it a relic of its saints." },
    { s: "aelthir", t: "Aesia was a druid. My friend. They have made her a saint of their sun.", m: "wistful" },
    { s: "ysolde", t: "She would have found that very funny, Warden.", m: "happy" },
  ],
  "relic:news:eyrhild": [
    { n: "Word reaches the Heartwood: a rival kingdom has found Eyrhild's Fury, the sword of Vaelis's own ancestor." },
    { s: "vaelis", t: "My ancestor's sword, in mud-caked hands. I shall collect it personally. I shall also collect the hands.", m: "angry" },
    { s: "aelthir", t: "Vaelis." },
    { s: "vaelis", t: "Figuratively, great-uncle. *Mostly*.", m: "aloof" },
  ],
  "relic:news:umbral_ring": [
    { n: "Word reaches the Heartwood: the Umbral Ring, a shadow-ring the Accord sealed away, has been found." },
    { s: "vaelis", t: "*(very quietly)* The Umbral Ring. Now *that* is a thing of beauty.", m: "happy" },
    { s: "ysolde", t: "No, my son.", m: "angry" },
  ],
  "rival-vs-rival:dwarf:halfellow": [
    { n: "News reaches the Silverwood: the Dwarves have taken {enemyCity}, a halfellow town. The first thing they seized was the brewery." },
    { s: "vaelis", t: "The mud-folk have conquered a *brewery*. I do hope it was worth it.", m: "aloof" },
  ],
  "rival-vs-rival:dwarf:human": [
    { n: "News reaches the Silverwood: the Dwarves have taken {enemyCity} from Westmarch, to settle an old debt." },
    { s: "vaelis", t: "The moneylenders collect from the mayflies. Let them. Every coin they fight over is one less arrow at our trees.", m: "aloof" },
  ],
  "rival-vs-rival:dwarf:orc": [
    { n: "News reaches the Silverwood: the Dwarves have stormed {enemyCity}, an orc settlement. The Mountain Wars have begun again." },
    { s: "vaelis", t: "Dwarves and Orcs, killing each other again. The Marches are healing themselves.", m: "aloof" },
    { s: "aelthir", t: "Do not *enjoy* it, Vaelis.", m: "angry" },
    { s: "vaelis", t: "I am not enjoying it, great-uncle. I am *appreciating* it.", m: "aloof" },
  ],
  "rival-vs-rival:halfellow:dwarf": [
    { n: "News reaches the Silverwood: halfellow militia have taken {enemyCity}, a dwarf hold, through gates that were somehow unlocked." },
    { s: "vaelis", t: "The Trickgrin woman picks dwarf locks as well. I am almost *impressed*. I am not.", m: "aloof" },
  ],
  "rival-vs-rival:halfellow:human": [
    { n: "News reaches the Silverwood: the halfellows have taken {enemyCity} from Westmarch." },
    { s: "vaelis", t: "Farmers, defeating mayflies. A war between two kinds of *brief*.", m: "aloof" },
  ],
  "rival-vs-rival:halfellow:orc": [
    { n: "News reaches the Silverwood: halfellow militia have routed the Orcs from {enemyCity}. Witnesses mention traps, a bonfire, and a goose." },
    { s: "vaelis", t: "*(very quietly)* …The goose again.", m: "sad" },
  ],
  "rival-vs-rival:human:dwarf": [
    { n: "News reaches the Silverwood: Westmarch has taken {enemyCity}, a dwarf hold." },
    { s: "vaelis", t: "The debtors, robbing the creditors. The lesser peoples have such *interesting* economics.", m: "aloof" },
  ],
  "rival-vs-rival:human:halfellow": [
    { n: "News reaches the Silverwood: Westmarch has taken {enemyCity}, a halfellow town." },
    { s: "aelthir", t: "I swore once to shelter the halfellows. From exactly this.", m: "sad" },
    { s: "vaelis", t: "And the Accord is broken, great-uncle. So is the oath. You may stop feeling guilty. You won't, of course.", m: "aloof" },
  ],
  "rival-vs-rival:human:orc": [
    { n: "News reaches the Silverwood: Westmarch has taken {enemyCity} from the Orcs." },
    { s: "vaelis", t: "Mayflies against fire-bringers. I shall watch from somewhere clean.", m: "aloof" },
  ],
  "rival-vs-rival:orc:dwarf": [
    { n: "News reaches the Silverwood: the Orcs have taken {enemyCity}, a dwarf hold." },
    { s: "vaelis", t: "The Mountain Wars resume. We need do nothing but *wait*. We are very good at waiting.", m: "aloof" },
  ],
  "rival-vs-rival:orc:halfellow": [
    { n: "News reaches the Silverwood: the Orcs have raided {enemyCity}, a halfellow town." },
    { s: "aelthir", t: "The halfellows. I swore to shelter them, once.", m: "sad" },
    { s: "ysolde", t: "Skarra's work. I can smell it.", m: "angry" },
  ],
  "rival-vs-rival:orc:human": [
    { n: "News reaches the Silverwood: the Orcs have taken {enemyCity} from Westmarch." },
    { s: "aelthir", t: "*(quietly)* My blood, burning.", m: "sad", req: { seen: "bloodline" }, alt: "More fire. Always more fire." },
    { s: "vaelis", t: "Mayflies and fire-bringers. Let them exhaust each other, great-uncle. It is the kindest thing we can do.", m: "aloof" },
  ],
  "tech:tier3": [
    { n: "The Silverwood's scholars complete their first great advancement of the war." },
    { s: "aelthir", t: "New learning. My grandmother would have called it a fad.", m: "wistful" },
    { s: "vaelis", t: "Your grandmother, great-uncle, called *agriculture* a fad.", m: "aloof" },
  ],
  "trow:first": [
    { n: "Elf rangers report a strange figure near an old wardhouse ruin: the Treasure Trow, a hunched creature of the barrows, fiddling as it drags a sack of treasure." },
    { s: "ysolde", t: "A Trow. The wards the Accord set are failing. Everything they kept locked away is walking out.", m: "uncanny" },
    { s: "vaelis", t: "A creature that hoards shiny things in a sack and plays music badly. It reminds me of the dwarves.", m: "aloof" },
  ],
  "ultimate:dwarf": [
    { n: "The ground shakes at the forest's edge. A Runeforged Titan, a giant golem of rune-carved stone, walks out of the mountains of Karrak." },
    { s: "vaelis", t: "The mud-folk have built a walking hill. How very like them.", m: "aloof" },
    { s: "ysolde", t: "Then the oaks will walk too. They have been asking.", m: "uncanny" },
  ],
  "ultimate:human": [
    { n: "News from Westmarch: the Collegium has made its first Grand Magus, a wizard master of every discipline." },
    { s: "vaelis", t: "The mayflies have learned a *trick*. How charming.", m: "aloof" },
    { s: "aelthir", t: "*(quietly)* It is our blood that makes their magic, Vaelis. Our blood, waking.", m: "wistful", req: { seen: "bloodline" } },
  ],
  "ultimate:orc": [
    { n: "A shadow crosses the Silverwood at noon. The Orcs have hatched a Dragon." },
    { s: "vaelis", t: "Fire with wings. The Orcs' answer to everything, finally airborne.", m: "aloof" },
    { s: "aelthir", t: "The last time a dragon flew over this forest, I was young. Every ranger to the treetops.", m: "wistful" },
  ],
});

// ---------------------------------------------------------------------------
// RECOVERED 2026-09-27 (user-reported, same issue as the human section above):
// content ported verbatim from the orphaned js/data/story/shared/dwarf.js.
// ---------------------------------------------------------------------------
Object.assign(window.GameData.STORY_SHARED.dwarf, {
  "built:deep_forge": [
    { n: "In {city}, the fires of a Deep Forge are lit, and every soldier trained there will march with a Dwarven Hammer." },
    { s: "kazra", t: "A proper forge. Every recruit gets a hammer. Point it at something you don't like.", m: "focused" },
  ],
  "built:deep_gate": [
    { n: "Beneath {city}, the Dwarves open their first Deep Gate: an old Underway door, re-forged so that a dwarf may step through it and out of any other Deep Gate in Karrak." },
    { s: "kazra", t: "The Underways, open again. Anywhere Karrak holds, a dwarf can be there by morning.", m: "focused" },
    { s: "sigrun", t: "*Anywhere*? …Good. Very good. For the war. Obviously.", m: "happy", req: { inGame: "orc" }, alt: "*Anywhere*? Brilliant. For the war, obviously." },
  ],
  "built:great_hall": [
    { n: "In {city}, the Dwarves raise a Great Hall: a vast feasting hall that doubles as a fortress for any warrior resting within." },
    { s: "sigrun", t: "A Great Hall! Finally, somewhere with *acoustics*!", m: "happy" },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges, pre-emptively: the acoustics.", m: "grudging" },
  ],
  "built:runewall": [
    { n: "At {city}, Kazra cuts the last rune into Karrak's first Runewall. The stones hum, and for a moment the whole wall glows like a banked forge." },
    { s: "kazra", t: "Every stone keyed to every other. Hit one, and the rest hit *back*.", m: "focused" },
    { s: "brunna", t: "Walls that fight. My grandmother would have wept to see it.", m: "proud" },
    { s: "oskar", t: "I've written the date in the margin. In case anyone ever *does* try it.", m: "grudging" },
  ],
  "capital-threat": [
    { n: "Enemy soldiers stand within sight of {capital}'s gates. In the Thane's Hall, the clan-moot has gone very quiet." },
    { s: "brunna", t: "Walls first. Every dwarf who can hold a hammer, on the walls.", m: "proud", alt: { s: "sigrun", t: "Every dwarf who can hold a hammer, on the walls! And every Metal Singer, *louder*!", m: "fierce" } },
    { s: "kazra", t: "They'll need more than soldiers to break these walls.", m: "focused" },
  ],
  "capture:elf": [
    { n: "Dwarf warriors march into {enemyCity}, an elf grove-town, and plant Karrak's banner beneath its trees." },
    { s: "kazra", t: "Good timber. Terrible for tunnels.", m: "focused" },
    { n: "In the Silverwood, Lord Vaelis reads the news without expression." },
    { s: "vaelis", t: "The mud-folk have taken a grove. They will fell every tree in it and call it *progress*. Put it in their book, great-uncle. They like books.", m: "aloof" },
  ],
  "capture:halfellow": [
    { n: "Dwarf warriors take {enemyCity}, a halfellow town. The first thing they find is the brewery." },
    { s: "sigrun", t: "The brewery! We've taken the BREWERY!", m: "happy" },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges, *struck out*: the ale tariff. We own the ale now.", m: "happy" },
    { s: "hobby", t: "*(in the Hearthlands)* They took the brewery. Of course they took the brewery. Goldie, hide the good barrels.", m: "sad", alt: { s: "barnaby", t: "*(in the Hearthlands)* They took the brewery. Hobby would have hidden the good barrels.", m: "sad" } },
  ],
  "capture:human": [
    { n: "Dwarf warriors take {enemyCity}, a human town. Oskar arrives with a ledger before the smoke has cleared." },
    { s: "oskar", t: "The Cathedral debt, first instalment. Collected.", m: "grudging" },
    { s: "brunna", t: "Collateral, Uncle. Write it as collateral.", m: "proud", alt: { s: "sigrun", t: "Collateral! Write it down, Uncle!", m: "happy" } },
    { s: "corvin", t: "*(in Westmarch)* The Dwarves are collecting in land. I did warn the Temple about the fine print.", m: "wry" },
  ],
  "capture:orc": [
    { n: "Dwarf warriors storm {enemyCity}, an orc settlement, and tear down the red banners." },
    { s: "oskar", t: "Volume Seven of the Book of Grudges, the Orc volume: {enemyCity}, *taken back*. First happy entry in four hundred years.", m: "happy" },
    { s: "kazra", t: "Good.", m: "focused" },
    { s: "skarra", t: "*(in the Bloodmire)* They took {enemyCity}! Skarra will curse their beards! ALL of their beards!", m: "angry" },
  ],
  "eliminated:elf": [
    { n: "The last elf grove has fallen. The Silverwood Court is no more." },
    { n: "Beneath the dying Heartwood, the ancient Warden Aelthir sits very still. His heir, Lord Vaelis, stands at his side, his mythril collar dented, his composure gone." },
    { s: "vaelis", t: "…That was not supposed to happen. The mud-folk were supposed to *tire*.", m: "sad" },
    { s: "aelthir", t: "I remember the Rootcut, child. I remember everything. Now there is no one left to remember it with.", m: "wistful" },
    { s: "oskar", t: "*(in Karrak)* Entry the First in the Book of Grudges: the Rootcut. …I suppose it's settled now. It doesn't feel settled.", m: "sad" },
  ],
  "eliminated:halfellow": [
    { n: "The last halfellow town has fallen. The Hearthlands are no more." },
    { n: "Somewhere on a back lane, Mayor Hobby Trickgrin leads the last families away in silence, her goose feather still in her hat." },
    { s: "hobby", t: "Well. We'll plant somewhere else. We always have.", m: "sad" },
    { s: "sigrun", t: "*(in Karrak)* No more halfellow ale. Ever. …Father, what have we *done*?", m: "sad", alt: { s: "kazra", t: "*(in Karrak)* No more halfellow ale. Sigrun will never forgive us.", m: "sad" } },
  ],
  "eliminated:human": [
    { n: "The last human city has fallen. Westmarch is no more." },
    { n: "On the steps of the Dawn Cathedral, built with Karrak stone, the Queen of Westmarch lays down her circlet." },
    { s: "maren", t: "Tell the Thane the debt is paid.", m: "sad" },
    { s: "oskar", t: "*(in Karrak)* Entry {grudge} in the Book of Grudges: Westmarch. Debt settled. *Worthy* debtors, in the end.", m: "grudging" },
  ],
  "eliminated:orc": [
    { n: "The last orc settlement has fallen. The Bloodmire Clans are no more." },
    { n: "At the Speaking Stones, Warchief Grukka Ironjaw stands among the last of his clans." },
    { s: "grukka", t: "Good walls. Best I ever broke. Carve that somewhere, dwarves.", m: "defiant" },
    { s: "oskar", t: "*(in Karrak)* Volume Seven of the Book of Grudges is closed. There's no one left to write it about.", m: "sad" },
    { s: "sigrun", t: "*(very quietly)* …Varg.", m: "sad" },
  ],
  "found:6": [
    { n: "Karrak's sixth hold is founded. The Thane's map of the Marches has more bronze on it than green now." },
    { s: "oskar", t: "Six holds. I've had to start a new *volume* just for the boundary disputes.", m: "grudging" },
    { s: "brunna", t: "Walls first, Uncle. Then boundaries. Then more walls.", m: "proud", alt: { s: "sigrun", t: "Six holds! Six walls to sing on!", m: "happy" } },
  ],
  "lost:elf": [
    { n: "Elf warriors have taken {city}, a dwarf hold. Word reaches the Thane's Hall by nightfall." },
    { s: "vaelis", t: "*(in the captured hold)* Stone halls. Stone doors. Stone *everything*. It is like conquering a very large gravel pit.", m: "aloof" },
    { s: "brunna", t: "Uncle. The Book.", m: "angry", alt: { s: "sigrun", t: "Uncle. The Book. *Now*.", m: "angry" } },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges: {city}. The Silverwood. Underlined until the quill breaks.", m: "angry" },
  ],
  "lost:halfellow": [
    { n: "Halfellow militia have slipped into {city}, a dwarf hold, while its gates were mysteriously unlocked." },
    { s: "oskar", t: "Unlocked. *Unlocked*, Thane. They didn't even break the door. Entry {grudge} in the Book of Grudges: cheating.", m: "angry" },
    { s: "hobby", t: "*(in the Hearthlands)* Lovely halls. Do tell the Thane I left the ale where it was.", m: "scheming" },
  ],
  "lost:human": [
    { n: "Human soldiers have taken {city}, a dwarf hold. The Temple of the Dawn has already sent priests to bless it." },
    { s: "brunna", t: "They owe us a Cathedral, and they're paying us back with *our own hold*.", m: "angry", alt: { s: "sigrun", t: "They owe us a Cathedral, and they've taken one of *our* holds.", m: "angry" } },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges: Westmarch. Debt *and* theft. Two columns.", m: "grudging" },
  ],
  "lost:orc": [
    { n: "Orc war-bands have burned their way into {city}, a dwarf hold. Word reaches the Thane's Hall by nightfall." },
    { s: "skarra", t: "*(in the captured hold)* Stone walls! Skarra LOVES stone walls! They echo when she laughs! Ha! HA!", m: "gleeful" },
    { s: "kazra", t: "I'll get it back.", m: "angry" },
    { s: "oskar", t: "Volume Seven of the Book of Grudges: {city}. The ink's running out, Thane. I'm using my *own blood* next.", m: "grudging" },
  ],
  "lovers:meet": {
    when: { inGame: "orc" },
    lines: [
      { n: "Midnight, deep below the mountain. The Underways, ancient dwarf tunnels beneath the Marches that have been sealed since the Accord, should be empty. They aren't." },
      { n: "A huge grey dire wolf pads out of the dark: Moss, the mount of Varg Ironjaw, the Orc Warchief's son. Varg follows, ducking his tusks under the low stone." },
      { s: "varg", t: "Moss found the way again. Moss always finds the way to you. That's the problem.", m: "bashful" },
      { s: "sigrun", t: "You're late. And your wolf is eating my boot.", m: "happy" },
      { s: "varg", t: "He likes you. Everyone likes you. That's also the problem.", m: "bashful" },
      { s: "sigrun", t: "Varg. Our parents are at war.", m: "sad" },
      { s: "varg", t: "Our parents have always been at war. We just weren't old enough to notice.", m: "sad" },
      { n: "They met a year ago at the Midsummer Fair, where every people traded at the Marchstone under the Accord's peace. Neither has told a soul." },
      { s: "sigrun", t: "I wrote you a song. I can't play it. Not anywhere. Not ever.", m: "sad" },
      { s: "varg", t: "Then hum it. Quietly. I'll remember.", m: "bashful" },
    ],
  },
  "meet:elf": [
    { n: "Dwarf scouts reach the edge of the Silverwood, the Elves' ancient forest. Eyes watch them from every branch." },
    { n: "Beneath the Heartwood, the Warden Aelthir Moonveil hears the report. His grand-nephew and heir, Lord Vaelis Nightbloom, does not look up from his book." },
    { s: "vaelis", t: "The mud-folk have come out of their holes. Tell them the trees remember the Rootcut, and so do I.", m: "aloof" },
    { s: "oskar", t: "*(in Karrak)* Entry the First in the Book of Grudges: the Rootcut. They still blame us for the grove. I still blame *them* for blaming us.", m: "grudging" },
  ],
  "meet:halfellow": [
    { n: "Dwarf scouts reach the Hearthlands, home of the halfellows, all round doors and barley fields as far as the eye can see." },
    { n: "In The Goose & Kettle, the halfellows' oldest pub, Mayor Hobby Trickgrin reads the scouts' letter between two meetings." },
    { s: "hobby", t: "The Dwarves! Oh, lovely. Goldie, tell them the ale tariff is *not* up for discussion. Unless they're paying.", m: "scheming" },
    { s: "brunna", t: "*(in Karrak)* Halfellows. Good neighbours. Terrible trade terms.", m: "proud", alt: { s: "sigrun", t: "*(in Karrak)* Halfellows! They brew with our barley and charge us for it. Cheek.", m: "angry" } },
  ],
  "meet:human": [
    { n: "Dwarf scouts reach the river country of Westmarch, the Human kingdom, where the Dawn Cathedral rises over the plain, built with Karrak stone on Karrak credit." },
    { n: "In Westmarch, Queen Maren Ashcroft reads the scouts' approach report with her Archmage, Corvin Varro." },
    { s: "corvin", t: "The Dwarves, Majesty. Our creditors. They'll want to talk about the Cathedral.", m: "wry" },
    { s: "oskar", t: "*(in Karrak)* Entry {grudge} in the Book of Grudges: Westmarch, interest unpaid. I've been saving it.", m: "grudging" },
  ],
  "meet:orc": [
    { n: "Dwarf scouts reach the Bloodmire, the Orcs' swamp country, and the stink of it reaches them first." },
    { n: "At the Speaking Stones, Warchief Grukka Ironjaw hears that the Dwarves have come down from their mountain. His sister, the Bog Witch Skarra, cackles." },
    { s: "skarra", t: "The mud-diggers! Skarra has cursed their beards before. She'll curse them AGAIN!", m: "gleeful" },
    { s: "oskar", t: "*(in Karrak)* Volume Seven of the Book of Grudges. The Orc volume. The only one we never closed.", m: "grudging" },
  ],
  "relic:found:kurganos": [
    { n: "Dwarf delvers return from a crumbling ruin, one of the old wardhouses from the days of the Accord. They carry a crown wreathed in fire, frost and crackling lightning." },
    { s: "brunna", t: "Kurganos. The Crown of Elements. The crown of High Thane Kurganos himself.", m: "proud", alt: { s: "sigrun", t: "Kurganos. The Crown of Elements. Father always said we'd find it.", m: "happy" } },
    { s: "oskar", t: "Volume Seven of the Book of Grudges, first page: “The Orcs broke the great gates of Karrak and carried off the High Thane's crown.” Four hundred years, that entry's stood.", m: "grudging" },
    { s: "kazra", t: "Give it to our finest warrior. Let everyone see it coming.", m: "focused" },
  ],
  "relic:found:mhorgrim": [
    { n: "Dwarf delvers bring back a rune-musket from an old wardhouse ruin: Mhorgrim's Hunt, the weapon of Karrak's greatest huntmaster, which can call a dire wolf to heel." },
    { s: "kazra", t: "Mhorgrim's own runes. I've only ever seen drawings.", m: "focused" },
    { s: "sigrun", t: "It summons a *wolf*? Oh, I know someone who'd— …never mind.", m: "happy", req: { inGame: "orc" }, alt: "It summons a *wolf*? Brilliant. I want one." },
  ],
  "relic:news:kurganos": [
    { n: "Word reaches Karrak: a rival kingdom has dug Kurganos, the Crown of Elements, out of an old Accord wardhouse. The crown of the High Thanes of Karrak." },
    { s: "oskar", t: "The Orcs stole it from our great gates four hundred years ago. Now *someone else* is wearing it.", m: "angry", req: { holder: "orc" },
      alt: "Stolen by the Orcs four hundred years ago, lost, and now found by *somebody else entirely*. Entry {grudge} in the Book of Grudges." },
    { s: "brunna", t: "Then we take it back. Underline it, Uncle.", m: "angry", alt: { s: "sigrun", t: "Then we take it back! Underline it, Uncle!", m: "fierce" } },
  ],
  "relic:news:mhorgrim": [
    { n: "Word reaches Karrak: a rival kingdom has found Mhorgrim's Hunt, the rune-musket of Karrak's greatest huntmaster." },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges: whoever is holding Mhorgrim's musket. *Wrong end first*, probably.", m: "grudging" },
  ],
  "rival-vs-rival:elf:halfellow": [
    { n: "News reaches Karrak: the Elves have taken {enemyCity}, a halfellow town." },
    { s: "vaelis", t: "*(in the captured town)* Round doors. Round windows. It is like conquering a basket of bread rolls.", m: "aloof" },
    { s: "sigrun", t: "The Elves took a *halfellow* town? Who's going to bake our bread now?", m: "sad" },
  ],
  "rival-vs-rival:elf:human": [
    { n: "News reaches Karrak: the Elves have taken {enemyCity}, a human town of Westmarch." },
    { s: "oskar", t: "The Silverwood is collecting from Westmarch before *we* can. Entry {grudge} in the Book of Grudges: queue-jumping.", m: "grudging" },
  ],
  "rival-vs-rival:elf:orc": [
    { n: "News reaches Karrak: the Elves have burned the Orcs out of {enemyCity}, a bog settlement." },
    { s: "kazra", t: "Fire against fire. Let them.", m: "focused" },
  ],
  "rival-vs-rival:halfellow:elf": [
    { n: "News reaches Karrak: halfellow militia have taken {enemyCity}, an elf grove-town. The gates were, apparently, unlocked." },
    { s: "oskar", t: "The halfellows beat the Elves. With *locksmithing*. Entry {grudge} in the Book of Grudges: *adequate*.", m: "happy" },
  ],
  "rival-vs-rival:halfellow:human": [
    { n: "News reaches Karrak: the halfellows have taken {enemyCity} from Westmarch." },
    { s: "brunna", t: "Westmarch can't even hold a town against farmers. And they want *credit* from us.", m: "proud", alt: { s: "sigrun", t: "Westmarch lost a town to *farmers*. Brilliant.", m: "happy" } },
  ],
  "rival-vs-rival:halfellow:orc": [
    { n: "News reaches Karrak: halfellow militia have driven the Orcs out of {enemyCity}. Witnesses mention traps, a bonfire, and a goose." },
    { s: "sigrun", t: "The goose is BACK?", m: "happy" },
  ],
  "rival-vs-rival:human:elf": [
    { n: "News reaches Karrak: Westmarch's soldiers have taken {enemyCity}, an elf grove-town." },
    { s: "oskar", t: "The Humans are chopping down the Silverwood. The Elves blamed *us* for one grove. Let's see what they say about *this*.", m: "grudging" },
  ],
  "rival-vs-rival:human:halfellow": [
    { n: "News reaches Karrak: Westmarch has taken {enemyCity}, a halfellow town." },
    { s: "brunna", t: "The Humans are taking the halfellows' bread. Which means *our* bread goes up again.", m: "angry", alt: { s: "sigrun", t: "Humans taking halfellow towns. Bread's going to cost a fortune.", m: "sad" } },
  ],
  "rival-vs-rival:human:orc": [
    { n: "News reaches Karrak: Westmarch has taken {enemyCity} from the Orcs." },
    { s: "kazra", t: "Good. Fewer raiders on our roads.", m: "happy" },
  ],
  "rival-vs-rival:orc:elf": [
    { n: "News reaches Karrak: the Orcs have burned {enemyCity}, an elf grove-town, and taken what was left." },
    { s: "oskar", t: "The Orcs are doing to the Elves exactly what the Elves said *we* did to them. Entry {grudge} in the Book of Grudges: *irony*.", m: "grudging" },
  ],
  "rival-vs-rival:orc:halfellow": [
    { n: "News reaches Karrak: the Orcs have raided {enemyCity}, a halfellow town." },
    { s: "sigrun", t: "They're going after the *halfellows*? They make the *pies*!", m: "angry" },
    { s: "kazra", t: "They'll come for our breweries next.", m: "focused" },
  ],
  "rival-vs-rival:orc:human": [
    { n: "News reaches Karrak: the Orcs have taken {enemyCity} from Westmarch." },
    { s: "oskar", t: "The Humans owe us money, and the Orcs are taking their towns. Entry {grudge} in the Book of Grudges: *our collateral*.", m: "grudging" },
  ],
  "tech:tier3": [
    { n: "Karrak's scholars complete their first great advancement, and the clan-moot debates it for three days." },
    { s: "oskar", t: "Progress. Entry {grudge} in the Book of Grudges: everyone who said we couldn't.", m: "grudging" },
    { s: "kazra", t: "Good. Now make it useful.", m: "focused" },
  ],
  "trow:first": [
    { n: "Dwarf patrols report a strange figure near an old wardhouse ruin: the Treasure Trow, a hunched creature of the barrows, fiddling as it drags a bulging sack of treasure." },
    { s: "oskar", t: "A Trow, out of the old wardhouse barrow. Sixty years since one was seen above ground.", m: "grudging" },
    { s: "kazra", t: "The wardhouses are failing. Everything the Accord kept locked away is walking out.", m: "focused" },
    { s: "sigrun", t: "Or it's lucky! Trows are lucky.", m: "happy" },
    { s: "oskar", t: "Trows are lucky for *Trows*. Entry {grudge} in the Book of Grudges.", m: "grudging" },
  ],
  "ultimate:dwarf": [
    { n: "Deep in Kazra's forge, the chalk lines on the floor finally have a body standing on them. A Runeforged Titan, a giant golem of rune-carved stone, opens its glowing eyes for the first time." },
    { s: "kazra", t: "It walks.", m: "focused" },
    { s: "brunna", t: "It walks. Kazra… it's beautiful.", m: "happy", alt: { s: "sigrun", t: "It walks. He'd have loved to see this, Mother Kazra.", m: "sad" } },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges, *cancelled*: everyone who said a mountain couldn't march.", m: "happy" },
  ],
  "ultimate:human": [
    { n: "News from Westmarch: the Humans' Collegium has made its first Grand Magus, a wizard master of every discipline, fire and flight and invisibility alike." },
    { s: "kazra", t: "Magic. Fast, loud, and it doesn't last. Give me runes.", m: "focused" },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges: Westmarch, for showing off.", m: "grudging" },
  ],
  "ultimate:orc": [
    { n: "Dwarf scouts come running down from the watchtowers, faces pale. The Orcs have hatched a Dragon in their Dragon Den." },
    { s: "kazra", t: "A Dragon.", m: "focused" },
    { s: "brunna", t: "Then the Titan walks.", m: "proud", req: { unit: "self:runeforged_titan" }, alt: "Then we'd better have a Titan by the time it lands." },
    { s: "kazra", t: "It walks.", m: "focused", req: { unit: "self:runeforged_titan" }, alt: "It will." },
    { s: "sigrun", t: "Your father has a Dragon, Varg…", m: "sad", req: { alive: "orc", seen: "lovers:meet" } },
  ],
});

// ---------------------------------------------------------------------------
// RECOVERED 2026-09-27 (user-reported, same issue as the human section above):
// content ported verbatim from the orphaned js/data/story/shared/orc.js.
// ---------------------------------------------------------------------------
Object.assign(window.GameData.STORY_SHARED.orc, {
  "built:ancestral_dolmen": [
    { n: "In {city}, an Ancestral Dolmen is raised: a stone shrine that carries the voices of the Speaking Stones out to the rest of the Clans. When one orc falls near it, the others rise to avenge." },
    { s: "skarra", t: "The ancestors' voice, carried *farther*! Now EVERY orc can hear them scream! …And hear SKARRA.", m: "gleeful" },
    { s: "grukka", t: "That's what I was afraid of.", m: "defiant" },
  ],
  "built:butchery": [
    { n: "In {city}, a Butchery opens. Orcs who fight nearby are fed by every kill they make." },
    { s: "gnash", t: "BUTCHERY! Gnash's favourite building! Gnash was a butcher before Gnash was a *Butcher*!", m: "happy" },
    { s: "grukka", t: "War feeds on war, Gnash. Don't eat the customers.", m: "defiant" },
  ],
  "built:dragon_den": [
    { n: "In {city}, a Dragon Den is dug deep into the steaming heart of the bog, warm enough to hatch the egg of a dragon." },
    { s: "grukka", t: "A Dragon Den. Four hundred years since the Clans had a dragon. Not much longer now.", m: "defiant" },
    { s: "gnash", t: "Gnash will be dragon's *mother*!", m: "happy" },
  ],
  "built:war_camp": [
    { n: "In {city}, a War Camp rises: spikes, smoke and red banners. Warriors trained here march harder and strike first." },
    { s: "grukka", t: "Another camp. Good. Every orc a warrior.", m: "defiant" },
  ],
  "capital-threat": [
    { n: "Enemy warriors stand within sight of {capital}. At the Speaking Stones, the standing stones are glowing red all by themselves." },
    { s: "grukka", t: "Every orc with an axe, to the stones. We hold here, or we're just a bog again.", m: "defiant" },
    { s: "gnash", t: "Gnash hold! Gnash VERY good at holding! Gnash hold cleaver *all day*!", m: "happy" },
  ],
  "capture:dwarf": [
    { n: "Orc warriors break the gates of {enemyCity}, a dwarf hold, and pour inside." },
    { s: "gnash", t: "Gnash smash gate! Gate was stone! Gnash hand hurt! Gnash smash AGAIN!", m: "angry" },
    { s: "oskar", t: "*(in Karrak)* Entry {grudge} in the Book of Grudges: {enemyCity}. Taken by *Orcs*. I need a new quill. I've snapped this one.", m: "grudging" },
  ],
  "capture:elf": [
    { n: "Orc warriors take {enemyCity}, an elf grove-town. The trees are very old, and very quiet." },
    { s: "grukka", t: "Good land. Soft land. Ours now.", m: "defiant" },
    { s: "vaelis", t: "*(in the Silverwood)* {enemyCity}, taken by orcs. …I suppose I must learn the Warchief's name after all.", m: "aloof" },
  ],
  "capture:halfellow": [
    { n: "Orc warriors take {enemyCity}, a halfellow town. The larders are full. The geese are missing." },
    { s: "gnash", t: "*(peering into every cellar)* Goose? …Goose? GOOSE, SHOW YOURSELF!", m: "confused" },
    { s: "grukka", t: "No army, and they still hold this much land. Fields, mills, cellars. How do they *keep* it all?", m: "defiant" },
  ],
  "capture:human": [
    { n: "Orc warriors take {enemyCity}, a city of Westmarch. The Temple's bells ring the alarm across the river." },
    { s: "grukka", t: "That's for the parley, Queen.", m: "defiant" },
    { s: "skarra", t: "Skarra will turn their chapel into a FROG POND!", m: "gleeful" },
  ],
  "eliminated:dwarf": [
    { n: "The last dwarf hold has fallen. The Holds of Karrak are no more." },
    { s: "oskar", t: "Volume Seven of the Book of Grudges. The Orc volume. …Unfinished. Somebody finish it for me.", m: "sad" },
    { s: "grukka", t: "Karrak. The gates we broke once. We broke them for good.", m: "defiant" },
    { s: "varg", t: "*(very quietly)* Sigrun…", m: "sad", req: { seen: "lovers:meet" } },
  ],
  "eliminated:elf": [
    { n: "The last elf grove has fallen. The Silverwood Court is no more." },
    { s: "vaelis", t: "Weather. I thought you were *weather*. …What *is* your name, Warchief?", m: "sad" },
    { s: "grukka", t: "Grukka Ironjaw. Remember it. You've got a little time left to.", m: "defiant" },
  ],
  "eliminated:halfellow": [
    { n: "The last halfellow town has fallen. The Hearthlands Moot is no more." },
    { s: "skarra", t: "The goose-girl is BEATEN! Forty years! FORTY! Skarra WINS!", m: "gleeful" },
    { s: "gnash", t: "…Goose too?", m: "confused" },
    { s: "grukka", t: "They held all that land without an army. I still don't know how.", m: "defiant" },
  ],
  "eliminated:human": [
    { n: "The last human city has fallen. Westmarch is no more." },
    { s: "grukka", t: "The parley. It ends where it began: with a Queen who couldn't keep her word.", m: "defiant" },
    { s: "skarra", t: "Skarra will wear their crown as a FROG HAT! Destiny, my frog, try it on!", m: "gleeful" },
  ],
  "found:6": [
    { n: "{city} rises, the Clans' sixth settlement. Orc banners now fly from the bog to the hills." },
    { s: "grukka", t: "Six towns. My grandmother had one bog.", m: "happy" },
    { s: "varg", t: "Six towns to *keep*, Father. That's the hard part.", m: "bashful", req: { notFlag: "mossDead" }, alt: "Six towns. Six places for them to hide from us." },
  ],
  "lost:dwarf": [
    { n: "Dwarf warriors have taken {city}, an orc settlement. Their axes are still ringing." },
    { s: "grukka", t: "They'll pay for that in blood.", m: "angry" },
    { n: "At the Speaking Stones, the standing stones glow red. The ancestors demand vengeance." },
  ],
  "lost:elf": [
    { n: "Elf riders on black Shadowsteeds have taken {city}, an orc settlement." },
    { s: "vaelis", t: "*(in the captured town)* Mud huts. Spikes. A *frog pond*. I have conquered a puddle.", m: "aloof" },
    { s: "grukka", t: "He still doesn't know my name. He will.", m: "angry" },
  ],
  "lost:halfellow": [
    { n: "Halfellow militia have taken {city}, an orc settlement. Witnesses mention traps, a bonfire, and a goose." },
    { s: "gnash", t: "*(hiding behind Grukka)* GOOSE. Gnash KNEW it. Gnash said goose.", m: "confused" },
    { s: "skarra", t: "The goose-girl! AGAIN! Skarra will curse every goose in the Marches!", m: "angry" },
  ],
  "lost:human": [
    { n: "Human soldiers of Westmarch have taken {city}, an orc settlement. Priests of the Dawn follow them in to bless the mud." },
    { s: "grukka", t: "First the parley. Now this. The Queen keeps nothing but grudges.", m: "angry" },
    { s: "skarra", t: "Blessing our BOG! Skarra will curse their SUN!", m: "angry" },
  ],
  "lovers:meet": {
    when: { inGame: "dwarf" },
    lines: [
      { n: "Midnight at the bog's edge. While {capital} sleeps, Varg quietly saddles Moss, his dire wolf." },
      { s: "varg", t: "Quiet, Moss. Quiet. You know the way.", m: "bashful" },
      { n: "Moss leads him through an old stone door into the Underways, ancient dwarf tunnels beneath the Marches that have been sealed since the Accord. At the far end waits a young dwarf with copper braids and an axe that doubles as a guitar." },
      { n: "This is Sigrun Stonefast, the Dwarf Thane's daughter, a Metal Singer. She and Varg met a year ago at the Midsummer Fair, where every people traded at the Marchstone under the Accord's peace." },
      { s: "sigrun", t: "You're late. And your wolf is eating my boot.", m: "happy" },
      { s: "varg", t: "He likes you. Everyone likes you. That's the problem.", m: "bashful" },
      { s: "sigrun", t: "Varg. Our parents are at war.", m: "sad" },
      { s: "varg", t: "Our parents have always been at war. We just weren't old enough to notice.", m: "sad" },
      { n: "Behind them in the tunnel, a sickly green light flickers: a Wisp, one of the bog-spirits Skarra summons. Then it's gone." },
    ],
  },
  "meet:dwarf": [
    { n: "Orc scouts reach the foothills of Karrak, the Dwarves' mountain realm, and the great bronze gates that the Clans broke only once in history." },
    { s: "grukka", t: "Karrak. They sit on their mountain like it's a treasure chest.", m: "defiant" },
    { s: "gnash", t: "Gnash like treasure! Gnash like chests! Gnash like… mountain? Mountain is big chest!", m: "happy" },
    { n: "In Karrak, the Dwarves' Loremaster Oskar Grimgate opens Volume Seven of the Book of Grudges, the Orc volume." },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges: the Orcs, for coming *back*.", m: "grudging" },
  ],
  "meet:elf": [
    { n: "Orc scouts reach the edge of the Silverwood, the Elves' ancient forest: the best land in the Marches, and the Accord gave all of it to the Elves." },
    { s: "grukka", t: "A thousand years they've kept the good land behind their pretty trees. Not any more.", m: "defiant" },
    { s: "skarra", t: "The moss-haired crow's forest! Skarra can smell her spring from HERE!", m: "gleeful" },
    { n: "In the Silverwood, Lord Vaelis Nightbloom, heir to the Elves' Warden, reads the scouts' report." },
    { s: "vaelis", t: "Orcs. At the forest's edge. Like weather. Someone close the shutters.", m: "aloof" },
    { s: "grukka", t: "*(on hearing it)* He doesn't know my name, does he?", m: "angry" },
  ],
  "meet:halfellow": [
    { n: "Orc scouts reach the hedgerows of the Hearthlands, the halfellows' country of round doors and full larders." },
    { s: "skarra", t: "The goose-girl's meadows! Forty years, Skarra has waited! GNASH! Remember the GOOSE?", m: "gleeful" },
    { s: "gnash", t: "*(shuddering)* Gnash remember goose. Goose bite Gnash in places Gnash not talk about.", m: "sad" },
    { s: "grukka", t: "They're farmers, Gnash.", m: "defiant" },
    { s: "gnash", t: "Farmers have GEESE, chief.", m: "confused" },
  ],
  "meet:human": [
    { n: "Orc scouts reach the river cities of Westmarch, the Human kingdom, and the purple banners of the Queen who called the Last Parley." },
    { s: "grukka", t: "Westmarch. The Queen who invited me to parley, then let her knight draw first blood. I haven't forgotten.", m: "angry" },
    { s: "skarra", t: "Neither has Skarra! Skarra keeps her grudges in a JAR!", m: "gleeful" },
    { s: "varg", t: "Father. Are we sure the humans struck first?", m: "bashful" },
    { s: "grukka", t: "I was there, boy. I kept my word. *They* didn't.", m: "angry" },
  ],
  "relic:found:agasou": [
    { n: "Orc warriors return from a ruin with a royal spear that shifts in the hand like a living thing: the Spear of Agasou, the first Warchief." },
    { s: "grukka", t: "Agasou's spear. The first Warchief. The Elves say he stole the druids' beast-shapes with it. The Clans say he *earned* them.", m: "defiant" },
    { s: "skarra", t: "The moss-haired crow will SCREAM when she hears! Oh, let Skarra tell her! PLEASE let Skarra tell her!", m: "gleeful" },
    { s: "vaelis", t: "*(in the Silverwood)* The orcs have the spear. Again. How very *tiresome*.", m: "aloof", req: { inGame: "elf" } },
  ],
  "relic:found:kurganos": [
    { n: "Orc delvers drag something out of a crumbling ruin, one of the old wardhouses from the days of the Accord: a crown that burns with fire, frost and lightning." },
    { s: "grukka", t: "Kurganos. The Crown of Elements. Our trophy from the only raid that ever broke the great gates of Karrak. Home again.", m: "happy" },
    { s: "skarra", t: "Give it to Skarra, brother! A crown for a witch! The ancestors *insist*!", m: "gleeful" },
    { s: "grukka", t: "The ancestors can insist all they like. It goes to our finest warrior.", m: "defiant" },
  ],
  "relic:found:mortedamos": [
    { n: "Orc delvers pull a black book out of a sealed vault, chained shut, whispering: Mortedamos' Malefic Manuscript, the grimoire of every curse." },
    { s: "skarra", t: "*(snatching it)* EVERY CURSE! Every curse in the Marches, and they're ALL SKARRA'S!", m: "gleeful" },
    { s: "grukka", t: "Skarra. Give me the book.", m: "angry" },
    { s: "skarra", t: "…No.", m: "gleeful" },
    { n: "For the next week, Skarra is *unbearable*." },
  ],
  "relic:found:xorthalos": [
    { n: "Orc delvers bring back a shield forged from a single black-red scale: the Shield of Xorthalos, the first dragon." },
    { s: "skarra", t: "XORTHALOS! Give it to Skarra! It PROVES the ancestors chose HER, little Warchief! It PROVES it!", m: "gleeful" },
    { s: "grukka", t: "It proves somebody found a shield, Skarra.", m: "defiant" },
    { s: "gnash", t: "Shield is dragon? Gnash pet shield. …Shield not bite. Shield is *bad* dragon.", m: "confused" },
  ],
  "relic:news:agasou": [
    { n: "News crosses the bog: the Spear of Agasou, the first Warchief's shapeshifting spear, has been found, and not by the Clans." },
    { s: "grukka", t: "Agasou's spear. Every Warchief since has sworn on it. I want it *back*.", m: "defiant" },
    { s: "skarra", t: "If the tree-folk have it, Skarra will curse every tree in the Silverwood until they give it back!", m: "angry", req: { holder: "elf" } },
  ],
  "relic:news:kurganos": [
    { n: "A goblin scout splashes into {capital} with news: Kurganos, the Crown of Elements, has been found, and the Clans don't have it." },
    { s: "grukka", t: "Our crown. Our trophy from the only raid in history that ever broke the gates of Karrak.", m: "defiant" },
    { s: "gnash", t: "Gnash take crown back! Gnash wear crown! …Gnash head too big. Gnash wear crown on toe.", m: "confused" },
  ],
  "relic:news:mhorgrim": [
    { n: "News crosses the bog: Mhorgrim's Hunt, a dwarf rune-musket that calls a dire wolf, has been found." },
    { s: "varg", t: "The dwarves say the wolf was always theirs. The Clans say different. …Moss says nothing. Moss is asleep.", m: "bashful", req: { notFlag: "mossDead" },
      alt: "A musket that calls a wolf. …I had a wolf." },
  ],
  "relic:news:mortedamos": [
    { n: "News crosses the bog: Mortedamos' Malefic Manuscript, the grimoire of every curse, has been found by another kingdom." },
    { s: "skarra", t: "SOMEONE ELSE has Skarra's book?! Skarra's CURSES?! Skarra will curse them with their own curses!", m: "angry" },
  ],
  "relic:news:umbral_ring": [
    { n: "News crosses the bog: the Umbral Ring, a shadow-ring the Accord sealed away, has been found." },
    { s: "skarra", t: "The Umbral Ring! Skarra wants it! Skarra NEEDS it! …Skarra will explain why later!", m: "gleeful" },
    { s: "grukka", t: "No.", m: "defiant" },
  ],
  "relic:news:xorthalos": [
    { n: "News crosses the bog: the Shield of Xorthalos, venerated by every Dragon Den in the Clans, has been found by another kingdom." },
    { s: "skarra", t: "THIEVES! That shield belongs to the Dragon Dens! It belongs to the ANCESTORS! It belongs to SKARRA!", m: "angry" },
    { s: "grukka", t: "It belongs to the Clans, sister. And the Clans will take it back.", m: "defiant" },
  ],
  "rival-vs-rival:dwarf:elf": [
    { n: "News crosses the bog: the Dwarves have taken {enemyCity}, an elf grove-town. The Rootcut, the old feud of root and tunnel, has flared again." },
    { s: "grukka", t: "The two old hoarders, at each other's throats. Let them. Every axe they swing at each other is one they don't swing at us.", m: "defiant" },
  ],
  "rival-vs-rival:dwarf:halfellow": [
    { n: "News crosses the bog: the Dwarves have taken {enemyCity} from the halfellows. Something about the price of ale." },
    { s: "gnash", t: "Dwarves took goose-town? Did dwarves take *goose*? Gnash like dwarves now. A little.", m: "confused" },
  ],
  "rival-vs-rival:dwarf:human": [
    { n: "News crosses the bog: the Dwarves have taken {enemyCity} from Westmarch, over the Cathedral debt." },
    { s: "grukka", t: "The creditor and the debtor. Neither one keeps their word unless it's written down. Good.", m: "defiant" },
  ],
  "rival-vs-rival:elf:dwarf": [
    { n: "News crosses the bog: the Elves have taken {enemyCity}, a dwarf hold. Black Shadowsteeds were seen in the tunnels." },
    { s: "skarra", t: "The tree-folk in the mud-diggers' tunnels! Oh, Skarra hopes they BOTH lose!", m: "gleeful" },
  ],
  "rival-vs-rival:elf:halfellow": [
    { n: "News crosses the bog: the Elves have taken {enemyCity}, a halfellow town." },
    { s: "grukka", t: "The Elves already have the best land in the Marches. Now they want the *second* best. Nobody calls *them* raiders.", m: "angry" },
  ],
  "rival-vs-rival:elf:human": [
    { n: "News crosses the bog: the Elves have taken {enemyCity}, a city of Westmarch." },
    { s: "vaelis", t: "*(in the captured city)* Square towers. Square houses. Everything in such a *hurry*.", m: "aloof" },
    { s: "grukka", t: "Tower and root. Two bars of the bog's cage, fighting each other. I could watch this all day.", m: "happy" },
  ],
  "rival-vs-rival:halfellow:dwarf": [
    { n: "News crosses the bog: the halfellows have taken {enemyCity}, a dwarf hold. Witnesses mention unlocked gates, and a very persuasive pie." },
    { s: "gnash", t: "Little farmers beat dwarves? …Gnash scared of little farmers now. Gnash was ALREADY scared of little farmers.", m: "confused" },
  ],
  "rival-vs-rival:halfellow:elf": [
    { n: "News crosses the bog: the halfellows have taken {enemyCity}, an elf grove-town, and hung their gold banner from its tallest branch." },
    { s: "skarra", t: "The goose-girl took a TREE-TOWN! …Skarra hates this. Skarra hates this SO much. Who is Skarra supposed to root for?", m: "angry" },
  ],
  "rival-vs-rival:halfellow:human": [
    { n: "News crosses the bog: the halfellows have taken {enemyCity} from Westmarch. The humans never saw them coming." },
    { s: "grukka", t: "No army, and they take a human city. How do they *do* it?", m: "defiant" },
  ],
  "rival-vs-rival:human:dwarf": [
    { n: "News crosses the bog: Westmarch has taken {enemyCity}, a dwarf hold." },
    { s: "grukka", t: "The Queen's paying her debts with swords now. At least she's honest about it this time.", m: "defiant" },
  ],
  "rival-vs-rival:human:elf": [
    { n: "News crosses the bog: Westmarch has taken {enemyCity}, an elf grove-town. Their priests are blessing the trees." },
    { s: "skarra", t: "The tin-folk in the tree-folk's forest! Skarra wishes she could curse them BOTH at once! …Skarra will practise.", m: "gleeful" },
  ],
  "rival-vs-rival:human:halfellow": [
    { n: "News crosses the bog: Westmarch has taken {enemyCity} from the halfellows, the people who've fed them for three hundred years." },
    { s: "grukka", t: "They took from the ones who fed them. And *we're* the raiders.", m: "angry" },
  ],
  "tech:tier3": [
    { n: "The Clans' shamans and smiths complete their first great advancement of the war." },
    { s: "skarra", t: "The ancestors taught it to Skarra! In a dream! …Also the smiths helped. A little.", m: "gleeful" },
    { s: "grukka", t: "The smiths did it, Skarra.", m: "defiant" },
  ],
  "trow:first": [
    { n: "Orc scouts report a strange figure near an old wardhouse ruin: the Treasure Trow, a hunched creature of the barrows, fiddling as it drags a sack of treasure." },
    { s: "gnash", t: "Little fiddle man has SACK! Gnash want sack!", m: "happy" },
    { s: "skarra", t: "The wards are failing, little Warchief! Every treasure the Accord locked up is walking out! And the ancestors say: *take it*!", m: "gleeful" },
    { s: "grukka", t: "The ancestors always say *take it*.", m: "defiant" },
  ],
  "ultimate:dwarf": [
    { n: "Orc scouts come howling back from the mountains. Something enormous is walking out of Karrak: a Runeforged Titan, a giant golem of rune-carved stone." },
    { s: "gnash", t: "Big stone man! Gnash smash big stone man! …Gnash smash *little bit* of big stone man.", m: "confused" },
    { s: "grukka", t: "Smash its feet, Gnash. Everything that walks has feet.", m: "defiant" },
  ],
  "ultimate:human": [
    { n: "News from Westmarch: the Collegium has made its first Grand Magus, a wizard master of every discipline." },
    { s: "skarra", t: "A wizard with ALL the spells? Skarra has all the CURSES! We'll see whose are *louder*!", m: "gleeful" },
    { s: "grukka", t: "Everything bleeds, sister. Even wizards.", m: "defiant" },
  ],
  "ultimate:orc": [
    { n: "The Dragon Den, deep in the steaming heart of the bog. An enormous egg cracks, and a young Dragon unfolds its wings." },
    { s: "grukka", t: "Look at it. Four hundred years since the Clans flew a Dragon.", m: "defiant" },
    { s: "gnash", t: "Can Gnash ride it? Can Gnash pet it? Can Gnash— OW. Dragon bite Gnash. Dragon is GOOD dragon.", m: "happy" },
  ],
});

// ---------------------------------------------------------------------------
// RECOVERED 2026-09-27 (user-reported, same issue as the human section above):
// content ported verbatim from the orphaned js/data/story/shared/halfellow.js.
// ---------------------------------------------------------------------------
Object.assign(window.GameData.STORY_SHARED.halfellow, {
  "built:armory": [
    { n: "In {city}, an Armory is raised, and the town's own militia will fight hardest for their own streets." },
    { s: "barnaby", t: "An armoury. In the Hearthlands. I never thought I'd see the day.", m: "flustered" },
    { s: "hobby", t: "Neither did I, Uncle. I don't like seeing it now.", m: "sad" },
  ],
  "built:farmers_market": [
    { n: "In {city}, a Farmers Market opens, and every soldier trained there will march well-fed." },
    { s: "hobby", t: "Nobody fights well on an empty stomach. That's not strategy. It's *common sense*.", m: "scheming" },
  ],
  "built:historical_society": [
    { n: "In {city}, a branch of the Historical Society opens, and its antiquarians begin mapping every ruin in the Marches." },
    { s: "barnaby", t: "A *branch*. Of *my* Society. Hobby, I may weep. I shan't. But I *may*.", m: "happy" },
  ],
  "built:neighborhood_pub": [
    { n: "A new Neighborhood Pub opens its doors in {city}. Travellers from every corner of the Marches stop in for a pint and a gossip." },
    { s: "goldie", t: "Another pub! Twice the travellers. Twice the gossip. I'll know what our enemies had for breakfast by Thursday.", m: "happy",
      alt: { s: "barnaby", t: "Another pub. Goldie always said a pub hears everything. I'll… try to listen the way she did.", m: "sad" } },
    { s: "hobby", t: "Name it after Goldie.", m: "sad", req: { charDead: "goldie" } },
  ],
  "capital-threat": [
    { n: "Enemy soldiers stand within sight of {capital}. The Moot has been called in the middle of the night." },
    { s: "hobby", t: "Everybody with a pitchfork, on the hedges. Everybody with a pie, in the cellars. Everybody with a goose… well. You know who you are.", m: "scheming" },
  ],
  "capture:dwarf": [
    { n: "Halfellow militia take {enemyCity}, a dwarf hold, through gates that were somehow unlocked." },
    { s: "hobby", t: "Their brewery's in the cellar, everyone. Nobody touch it. Well. Nobody touch it *much*.", m: "happy" },
    { s: "oskar", t: "*(in Karrak)* Unlocked. *Unlocked*. Entry {grudge} in the Book of Grudges: cheating.", m: "angry" },
  ],
  "capture:elf": [
    { n: "Halfellow militia march into {enemyCity}, an elf grove-town, and hang the gold banner of the Hearthlands from its tallest branch." },
    { s: "hobby", t: "I've never owned a tree before. Do we water it, or does it water itself?", m: "happy" },
    { s: "vaelis", t: "*(in the Silverwood)* {enemyCity} has stood for nine hundred years. It has been taken by people who eat seven meals a day.", m: "aloof" },
  ],
  "capture:human": [
    { n: "Halfellow militia take {enemyCity}, a human town of Westmarch." },
    { s: "hobby", t: "Well! All that bread we sold them, and now we've got the bakery back.", m: "happy" },
    { s: "corvin", t: "*(in Westmarch)* We lost a town to *farmers*. The Temple will call it a test of faith. I'll call it poor planning.", m: "wry" },
  ],
  "capture:orc": [
    { n: "Halfellow militia drive the Orcs out of {enemyCity}. Witnesses mention traps, a bonfire, and at least one goose." },
    { s: "hobby", t: "Just like old times!", m: "happy" },
    { s: "skarra", t: "*(in the Bloodmire)* The GOOSE-GIRL! AGAIN! Skarra will curse every goose in the Marches!", m: "angry" },
  ],
  "eliminated:dwarf": [
    { n: "The last dwarf hold has fallen. The Holds of Karrak are no more." },
    { s: "oskar", t: "Entry nine hundred and four. The ale tariff. …Tell the Mayor it's settled. There's nobody left to pay it.", m: "sad" },
    { s: "hobby", t: "No more dwarf ale, Uncle. Ever. …Pour one for the Thane.", m: "sad" },
  ],
  "eliminated:elf": [
    { n: "The last elf grove has fallen. The Silverwood Court is no more." },
    { s: "vaelis", t: "…That was not supposed to happen. The lesser peoples were supposed to *tire*.", m: "sad" },
    { s: "hobby", t: "We had supper, dear. It helps.", m: "happy" },
    { s: "barnaby", t: "The Warden swore to shelter us once. I'll put that in the Archive. Somebody should remember he meant it.", m: "sad" },
  ],
  "eliminated:human": [
    { n: "The last human city has fallen. Westmarch is no more." },
    { s: "maren", t: "Tell the Mayor… thank you for the bread. We never said it.", m: "sad" },
    { s: "hobby", t: "Three hundred years, and they finally said it.", m: "sad" },
  ],
  "eliminated:orc": [
    { n: "The last orc settlement has fallen. The Bloodmire Clans are no more." },
    { s: "skarra", t: "This isn't the end, goose-girl! The bog REMEMBERS! …Destiny? Come *back*, my precious frog!", m: "angry" },
    { s: "hobby", t: "Forty years, Skarra. I almost miss you already.", m: "happy" },
  ],
  "found:3": [
    { n: "A third halfellow town is founded: round doors, vegetable plots, and a signpost that already needs repainting." },
    { s: "hobby", t: "Three towns! And I've been late to the founding of every single one.", m: "happy" },
    { s: "barnaby", t: "That's a *record*, Hobby. I've checked.", m: "flustered" },
  ],
  "found:6": [
    { n: "The Hearthlands' sixth town is founded. The Marches are starting to look like one very large neighbourhood." },
    { s: "barnaby", t: "Six towns. At this rate we'll hold the Marches by *accident*.", m: "happy" },
    { s: "hobby", t: "Nothing I do is an accident, Uncle. It just *looks* like one. That's the trick.", m: "scheming" },
  ],
  "lost:dwarf": [
    { n: "Dwarf warriors have taken {city}, a halfellow town. The first thing they seized was the brewery." },
    { s: "hobby", t: "Of course they took the brewery. Of *course* they did.", m: "angry" },
    { s: "barnaby", t: "I'll add it to the Archive's list of grievances. It's a short list. I've been meaning to make it longer.", m: "flustered" },
  ],
  "lost:elf": [
    { n: "Elf warriors have taken {city}, a halfellow town. Word reaches The Goose & Kettle before the smoke has cleared." },
    { s: "vaelis", t: "*(in the captured town)* Round doors. Round windows. Round *everything*. It is like conquering a basket of bread rolls.", m: "aloof" },
    { s: "hobby", t: "*(very quietly)* Uncle. Fetch me the map. And the good geese.", m: "angry" },
  ],
  "lost:human": [
    { n: "Human soldiers of Westmarch have taken {city}, a halfellow town. The Temple has already sent priests to bless it." },
    { s: "hobby", t: "We fed them for three hundred years. Three hundred years of bread, and not *once* did they say thank you.", m: "angry" },
    { s: "goldie", t: "Put it on the Lord-Paladin's tab, love.", m: "stern", alt: { s: "barnaby", t: "Put it on the Lord-Paladin's tab. It's what Goldie would have done.", m: "sad" } },
  ],
  "lost:orc": [
    { n: "Orc war-bands have burned their way into {city}, a halfellow town." },
    { s: "skarra", t: "*(in the captured town)* The goose-girl's town is MINE! Where are the geese? WHERE ARE THE GEESE?", m: "gleeful" },
    { s: "hobby", t: "Hidden, Skarra. Where they'll do the most good.", m: "scheming" },
  ],
  "lovers:meet": {
    when: { inGame: ["dwarf", "orc"] },
    lines: [
      { n: "The Goose & Kettle, late at night, where every rumour in the Marches ends up. A traveller has had one pint too many, and is talking." },
      { s: "goldie", t: "Hobby. A traveller says the Dwarf Thane's daughter has been sneaking out at night, down the old tunnels, to meet the Orc Warchief's son.", m: "stern",
        alt: { s: "barnaby", t: "Hobby. A traveller in the pub says the Dwarf Thane's daughter has been meeting the Orc Warchief's son. In secret. Goldie would have known what to do with that.", m: "flustered" } },
      { s: "hobby", t: "A dwarf and an orc. The two oldest enemies in the Marches.", m: "scheming" },
      { s: "barnaby", t: "One letter to either parent, Hobby, and Karrak and the Bloodmire tear each other apart. It would win us the war.", m: "flustered" },
      { s: "hobby", t: "…No. No, Uncle. We're going to *hide* them.", m: "scheming" },
      { s: "barnaby", t: "*Hide* them? From both their parents? In the middle of a war?", m: "flustered" },
      { s: "hobby", t: "It's the best trick I've ever been asked to play. And nobody even asked.", m: "happy" },
    ],
  },
  "meet:dwarf": [
    { n: "Halfellow pedlars reach the foothills of Karrak, the Dwarves' mountain realm. The dwarves buy their barley, and complain about the price." },
    { s: "hobby", t: "The Dwarves! Lovely. Tell them the ale tariff is *not* up for discussion. Unless they're paying.", m: "scheming" },
    { s: "brunna", t: "*(in Karrak)* Halfellows. Good neighbours. Terrible trade terms.", m: "proud", alt: { s: "sigrun", t: "*(in Karrak)* Halfellows! They make the *pies*!", m: "happy" } },
  ],
  "meet:elf": [
    { n: "Halfellow farmers plant barley right up to the edge of the Silverwood, the Elves' forest, and wave at the watchers in the trees." },
    { s: "hobby", t: "The Elves. Oh, I *like* the Elves. Most of them. Uncle, is Lord Vaelis still the heir?", m: "scheming" },
    { s: "barnaby", t: "He is, Hobby. Please don't.", m: "flustered" },
    { s: "vaelis", t: "*(in the Silverwood)* The Trickgrin woman's people. Count the geese. Count them *twice*.", m: "aloof" },
  ],
  "meet:human": [
    { n: "Halfellow carts reach the river cities of Westmarch, the Human kingdom, loaded with bread, as they have been for generations." },
    { s: "hobby", t: "Westmarch. They eat our bread and forget to say thank you. Always have.", m: "angry" },
    { s: "goldie", t: "And the Lord-Paladin still owes this pub four hundred silver.", m: "stern", alt: { s: "barnaby", t: "And the Lord-Paladin still owes The Goose & Kettle four hundred silver. Goldie would want it collected.", m: "sad" } },
  ],
  "meet:orc": [
    { n: "Smoke on the horizon. The Orcs of the Bloodmire have come to the edge of the Hearthlands, and they remember this place." },
    { s: "hobby", t: "The Orcs. Forty years since I sent their raiders home with a goose on their heels.", m: "scheming" },
    { s: "skarra", t: "*(in the Bloodmire)* The goose-girl! Skarra *remembers* the goose-girl! This time, the goose is DINNER!", m: "gleeful" },
    { s: "barnaby", t: "Hobby. She remembers you.", m: "flustered" },
    { s: "hobby", t: "Everyone does, Uncle. That's rather the problem.", m: "happy" },
  ],
  "relic:found:much_room_mushroom": [
    { n: "Halfellow delvers carry a glowing, enormous mushroom out of an old wardhouse ruin." },
    { s: "barnaby", t: "The Much Room Mushroom! Six hundred years missing! Whoever carries it grows half again as large.", m: "happy" },
    { s: "hobby", t: "…Uncle, I want you to know I'm resisting a very big temptation right now.", m: "scheming" },
  ],
  "relic:found:riddle_of_steel": [
    { n: "Halfellow delvers bring back a slim, battered dagger from an old wardhouse ruin: the Riddle of Steel, a blade that strikes whoever it riddles." },
    { s: "barnaby", t: "Hobby. That's your great-grandmother's dagger. The first Trouble Maker. It's been lost for a century.", m: "sad" },
    { s: "hobby", t: "*(very quietly)* I know, Uncle. She used to say, “Every lock is a question. Every question has an answer.”", m: "sad" },
    { s: "goldie", t: "You're not going to cry in front of the militia, are you, love?", m: "stern", alt: { s: "barnaby", t: "Goldie would have told you not to cry in front of the militia.", m: "sad" } },
    { s: "hobby", t: "Absolutely not. *(sniff)*", m: "sad" },
  ],
  "relic:news:much_room_mushroom": [
    { n: "Word reaches The Goose & Kettle: a rival kingdom has found the Much Room Mushroom, sacred to the halfellows' mushroom-growers." },
    { s: "barnaby", t: "It's on page one of the Archive! *Page one!*", m: "flustered" },
  ],
  "relic:news:riddle_of_steel": [
    { n: "Word reaches The Goose & Kettle: a rival kingdom has found the Riddle of Steel, the dagger of Hobby's great-grandmother, the very first Trouble Maker." },
    { s: "hobby", t: "Someone's got Great-Gran's dagger. Someone's going to be *very* sorry about that.", m: "angry" },
  ],
  "rival-vs-rival:dwarf:elf": [
    { n: "News at The Goose & Kettle: the Dwarves have taken {enemyCity}, an elf grove-town." },
    { s: "barnaby", t: "The Rootcut, again. Eight hundred years, and they're *still* at it.", m: "flustered" },
  ],
  "rival-vs-rival:dwarf:human": [
    { n: "News at The Goose & Kettle: the Dwarves have taken {enemyCity} from Westmarch, over the Cathedral debt." },
    { s: "hobby", t: "Collecting debts with an army. Remind me to pay the Dwarves for the ale on time, Uncle.", m: "scheming" },
  ],
  "rival-vs-rival:dwarf:orc": [
    { n: "News at The Goose & Kettle: the Dwarves have stormed {enemyCity}, an orc settlement." },
    { s: "barnaby", t: "The Mountain Wars again. The Archive has *nine volumes* on those.", m: "flustered" },
  ],
  "rival-vs-rival:elf:dwarf": [
    { n: "News at The Goose & Kettle: the Elves have taken {enemyCity}, a dwarf hold." },
    { s: "hobby", t: "Lord Vaelis in a dwarf hold. He'll hate the ceilings.", m: "happy" },
  ],
  "rival-vs-rival:elf:human": [
    { n: "News at The Goose & Kettle: the Elves have taken {enemyCity}, a human town." },
    { s: "barnaby", t: "Elves against Westmarch. The Warden used to teach their Queen's great-great-grandmother to read, you know. It's in the Archive.", m: "flustered" },
  ],
  "rival-vs-rival:elf:orc": [
    { n: "News at The Goose & Kettle: the Elves have burned the Orcs out of {enemyCity}." },
    { s: "hobby", t: "The two witches, at it again. I'd pay good money to watch.", m: "happy" },
  ],
  "rival-vs-rival:human:dwarf": [
    { n: "News at The Goose & Kettle: Westmarch has taken {enemyCity}, a dwarf hold." },
    { s: "hobby", t: "The debtors robbing the creditors. Big folk do have interesting ideas about money.", m: "scheming" },
  ],
  "rival-vs-rival:human:elf": [
    { n: "News at The Goose & Kettle: Westmarch has taken {enemyCity}, an elf grove-town." },
    { s: "barnaby", t: "Axes in the Silverwood. The Warden will be heartbroken.", m: "sad" },
  ],
  "rival-vs-rival:human:orc": [
    { n: "News at The Goose & Kettle: Westmarch has taken {enemyCity} from the Orcs." },
    { s: "hobby", t: "Good. Fewer raiders near the barley.", m: "happy" },
  ],
  "rival-vs-rival:orc:dwarf": [
    { n: "News at The Goose & Kettle: the Orcs have taken {enemyCity}, a dwarf hold." },
    { s: "barnaby", t: "They'll be after the breweries next. And *then* the barley.", m: "flustered" },
  ],
  "rival-vs-rival:orc:elf": [
    { n: "News at The Goose & Kettle: the Orcs have burned {enemyCity}, an elf grove-town." },
    { s: "hobby", t: "Poor Warden. Poor trees. …Not poor Lord Vaelis. He'll be fine. He's always fine.", m: "happy" },
  ],
  "rival-vs-rival:orc:human": [
    { n: "News at The Goose & Kettle: the Orcs have taken {enemyCity} from Westmarch." },
    { s: "barnaby", t: "The Lord-Paladin will call it a crusade. The Archmage will call it bad maths. They'll both be a bit right.", m: "happy" },
  ],
  "tech:tier3": [
    { n: "The Hearthlands' scholars complete their first great advancement of the war." },
    { s: "barnaby", t: "A new discovery! I'll add it to the Archive, next to the old discovery it's clearly copied from.", m: "happy" },
  ],
  "trow:first": [
    { n: "Halfellow farmers report a strange figure near an old wardhouse ruin: the Treasure Trow, a hunched creature of the barrows, fiddling as it drags a sack of treasure." },
    { s: "barnaby", t: "A Trow! The ruins were wardhouses, Hobby. The Archive has known for two hundred years. Nobody ever *asks*.", m: "flustered" },
    { s: "hobby", t: "I'm asking now, Uncle.", m: "happy" },
    { s: "barnaby", t: "…Oh. Well. The wards are failing. Everything the Accord locked away is walking out. Footnote thirty.", m: "flustered" },
  ],
  "ultimate:dwarf": [
    { n: "A shadow crosses the barley fields. A Runeforged Titan, a giant golem of rune-carved stone, is walking out of the mountains of Karrak." },
    { s: "hobby", t: "Oh. Oh, that's *big*. Uncle, what does the Archive say about stopping one of those?", m: "sad" },
    { s: "barnaby", t: "Page forty. It says “don't”.", m: "flustered" },
  ],
  "ultimate:human": [
    { n: "News from Westmarch: the Collegium has made its first Grand Magus, a wizard master of every discipline." },
    { s: "barnaby", t: "Fire, flight, invisibility. The Archive has catalogued eleven ways it could ruin a harvest.", m: "flustered" },
    { s: "hobby", t: "Then let's make sure it never sees one.", m: "scheming" },
  ],
  "ultimate:orc": [
    { n: "A shadow crosses the Hearthlands at noon. The Orcs have hatched a Dragon." },
    { s: "hobby", t: "A dragon. Right. Everyone indoors. Goldie, put the kettle on. We're going to need it.", m: "scheming", alt: "A dragon. Right. Everyone indoors. Somebody put the kettle on. We're going to need it." },
    { s: "barnaby", t: "The last dragon over the Hearthlands was four hundred years ago. The Archive has a *pamphlet*.", m: "flustered" },
  ],
});
