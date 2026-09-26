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
        { s: "vaelis", t: "They will blame each other for forging it. Trust me.", m: "aloof" },
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
        alt: { s: "sigrun", t: "Then build it, Mother Kazra. For her.", m: "sad" } },
      { s: "kazra", t: "Now I just need a mountain.", m: "focused", req: { charAlive: "brunna" },
        alt: "Now I just need a mountain. …She'd have liked to see it walk." },
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
        alt: "Karrak's third hold is founded. In the Thane's Hall, High Thane Sigrun Stonefast, the young Metal Singer who inherited her mother's crown, paces with an idea." },
      { s: "sigrun", t: "Three holds, Mother. That's three borders to guard. Give me a war-band. Metal Singers, all of us. We'll hold the loudest border in the Marches.", m: "fierce", req: { charAlive: "brunna" },
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
});
