/**
 * STORY SHARED -- DWARF PLAYER (lazy-loaded with any dwarf/* scenario)
 * -----------------------------------------------------------------------
 * Beats reused across the Dwarves' 15 scenarios (doc/story_bible.md §4
 * Dwarf arc, §5 lovers, §13), keyed like scenario beats. A scenario file
 * that defines the same key always wins (js/engine/story.js getSceneDef),
 * so these are the DEFAULTS: first contact, captures, losses and
 * eliminations against each rival race, the arc's shared midpoint (B4) and
 * rift (B5), and the lovers' meeting whenever the Orcs are in the game.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SHARED = window.GameData.STORY_SHARED || {};
window.GameData.STORY_SHARED.dwarf = window.GameData.STORY_SHARED.dwarf || {};

Object.assign(window.GameData.STORY_SHARED.dwarf, {
  // ---------------------------------------------------------------- arc
  N: [
    { n: "Oskar runs a finger down the stone's closing clause a second time, and frowns." },
    { s: "oskar", t: "Odd. The stone's words have… shifted, Thane. It won't say *held* this time. Only *remains*.", m: "sad" },
    { s: "brunna", t: "Then there's only one way this ends. Walls first.", m: "proud", alt: { s: "sigrun", t: "Then there's only one way this ends. Loudly.", m: "fierce" } },
  ],
  R: [
    { n: "Karrak could have claimed the Marches. The Thane refused." },
    { n: "At the heart of the Marches, the split Marchstone speaks." },
    { s: "stone", t: "NOT YET." },
    { s: "oskar", t: "It's changed its mind, Thane. It won't say *held* again. Only *remains*.", m: "sad" },
    { s: "brunna", t: "Then we finish it. Walls first. Then everything else.", m: "proud", alt: { s: "sigrun", t: "Then we finish it. Every last verse.", m: "fierce" } },
  ],
  B4: [
    { n: "At the heart of the Marches, Oskar kneels beside the split Marchstone, tracing the runes carved into its base. Kazra, the runesmith, crouches beside him." },
    { s: "oskar", t: "I've read the deep runes, Thane. I don't like what they say.", m: "sad" },
    { s: "brunna", t: "Say it anyway.", alt: { s: "sigrun", t: "Say it anyway, Uncle." } },
    { s: "oskar", t: "The stone was cut from under Karrak, that's true. But it's stood here a thousand years. It's *rooted*: its veins run under half the Marches. Move it, and it dies.", m: "sad" },
    { s: "brunna", t: "…So the Heartstone can never come home.", m: "sad", alt: { s: "sigrun", t: "…So Mother's Heartstone can never come home.", m: "sad" } },
    { s: "kazra", t: "Then maybe home goes to it.", m: "focused" },
    { n: "Oskar opens the Book of Grudges with a sour expression." },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges: the runes. As a grudge. Against the *runes*.", m: "grudging" },
  ],
  // The Rift (bible §4): the lovers revealed when the Orcs are in the game;
  // otherwise Brunna overrules Oskar's grudge-war. Thane-falls scenarios
  // (§13.9) write their own B5.
  B5: [
    { n: "The Thane's Hall of {capital}, emptied of everyone but family. Oskar enters, mud to his knees, the Book of Grudges clutched to his chest.", req: { inGame: "orc" },
      alt: "The Thane's Hall of {capital}. Oskar has spread the Book of Grudges open across the war table, every page a list of wrongs to avenge." },
    // -- with the Orcs: the lovers revealed
    { s: "oskar", t: "Thane. Last night I followed Sigrun down through the Underways, the old tunnels beneath the Marches, all the way to the edge of the Orc bogs.", m: "sad", req: { inGame: "orc" } },
    { s: "brunna", t: "Followed her? Why?", m: "angry", req: { inGame: "orc" } },
    { s: "oskar", t: "She meets someone there. An orc Wolf Rider: Varg Ironjaw, the Orc Warchief's own son.", m: "sad", req: { inGame: "orc" } },
    { n: "Brunna turns slowly to her daughter. Sigrun's hand closes around the wolf-tooth charm hidden in her braid.", req: { inGame: "orc" } },
    { s: "sigrun", t: "His name is Varg, Mother. Since the Midsummer Fair. He isn't what they say. None of them are.", m: "fierce", req: { inGame: "orc" } },
    { s: "brunna", t: "Kazra. Say something to your daughter.", m: "angry", req: { inGame: "orc" } },
    { s: "kazra", t: "I forged the locks on those old doors, Brunna. I know exactly who uses them.", m: "focused", req: { inGame: "orc" } },
    { n: "For the first time in thirty years of marriage, the Thane stares at her wife as if at a stranger.", req: { inGame: "orc" } },
    { s: "kazra", t: "Orcs killed my brother in the Mountain Wars. I lost him to this feud. I won't lose our daughter to it.", m: "sad", req: { inGame: "orc" } },
    { s: "brunna", t: "…The war first. Then this. Go.", m: "angry", req: { inGame: "orc" } },
    // -- without the Orcs: the grudge-war overruled
    { s: "oskar", t: "Every one of these wrongs is owed, Thane. The Book says march. On all of them. Now, while we're strong.", m: "grudging", req: { notInGame: "orc" } },
    { s: "brunna", t: "The Book says a great many things, Uncle. It doesn't have to feed the holds through winter.", m: "proud", req: { notInGame: "orc" } },
    { s: "sigrun", t: "I'm with Uncle Oskar, Mother! A proper war-song, start to finish!", m: "fierce", req: { notInGame: "orc" } },
    { s: "kazra", t: "You'd both march the whole mountain off a cliff for a grudge.", m: "angry", req: { notInGame: "orc" } },
    { s: "brunna", t: "We hold what we have. We take what we need. No more. That's the Thane's word.", m: "proud", req: { notInGame: "orc" } },
    { n: "Oskar closes the Book very slowly, then opens it again at the last page.", req: { notInGame: "orc" } },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges: the High Thane, for overruling the Book. …I'm sorry, Brunna. The Book is the Book.", m: "grudging", req: { notInGame: "orc" } },
  ],

  // ---------------------------------------------------------------- lovers (§5)
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

  // ---------------------------------------------------------------- first contact
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

  // ---------------------------------------------------------------- captures (player takes)
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
  // ---------------------------------------------------------------- losses (rival takes)
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
  // ---------------------------------------------------------------- eliminations
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
    { s: "sigrun", t: "*(in Karrak)* No more halfellow ale. Ever. …Mother, what have we *done*?", m: "sad", alt: { s: "kazra", t: "*(in Karrak)* No more halfellow ale. Sigrun will never forgive us.", m: "sad" } },
  ],
  "eliminated:human": [
    { n: "The last human city has fallen. Westmarch is no more." },
    { n: "On the steps of the Dawn Cathedral, built with Karrak stone, the Queen of Westmarch lays down her circlet." },
    { s: "maren", t: "Tell the Thane her debt is paid.", m: "sad" },
    { s: "oskar", t: "*(in Karrak)* Entry {grudge} in the Book of Grudges: Westmarch. Debt settled. *Worthy* debtors, in the end.", m: "grudging" },
  ],
  "eliminated:orc": [
    { n: "The last orc settlement has fallen. The Bloodmire Clans are no more." },
    { n: "At the Speaking Stones, Warchief Grukka Ironjaw stands among the last of his clans." },
    { s: "grukka", t: "Good walls. Best I ever broke. Carve that somewhere, dwarves.", m: "defiant" },
    { s: "oskar", t: "*(in Karrak)* Volume Seven of the Book of Grudges is closed. There's no one left to write it about.", m: "sad" },
    { s: "sigrun", t: "*(very quietly)* …Varg.", m: "sad" },
  ],

  // ---------------------------------------------------------------- ultimates
  "ultimate:dwarf": [
    { n: "Deep in Kazra's forge, the chalk lines on the floor finally have a body standing on them. A Runeforged Titan, a giant golem of rune-carved stone, opens its glowing eyes for the first time." },
    { s: "kazra", t: "It walks.", m: "focused" },
    { s: "brunna", t: "It walks. Kazra… it's beautiful.", m: "happy", alt: { s: "sigrun", t: "It walks. She'd have loved to see this, Mother Kazra.", m: "sad" } },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges, *cancelled*: everyone who said a mountain couldn't march.", m: "happy" },
  ],
  "ultimate:orc": [
    { n: "Dwarf scouts come running down from the watchtowers, faces pale. The Orcs have hatched a Dragon in their Dragon Den." },
    { s: "kazra", t: "A Dragon.", m: "focused" },
    { s: "brunna", t: "Then the Titan walks.", m: "proud", req: { unit: "self:runeforged_titan" }, alt: "Then we'd better have a Titan by the time it lands." },
    { s: "kazra", t: "It walks.", m: "focused", req: { unit: "self:runeforged_titan" }, alt: "It will." },
    { s: "sigrun", t: "Your father has a Dragon, Varg…", m: "sad", req: { alive: "orc", seen: "lovers:meet" } },
  ],
  "ultimate:human": [
    { n: "News from Westmarch: the Humans' Collegium has made its first Grand Magus, a wizard master of every discipline, fire and flight and invisibility alike." },
    { s: "kazra", t: "Magic. Fast, loud, and it doesn't last. Give me runes.", m: "focused" },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges: Westmarch, for showing off.", m: "grudging" },
  ],

  // ---------------------------------------------------------------- relics
  "relic:found:kurganos": [
    { n: "Dwarf delvers return from a crumbling ruin, one of the old wardhouses from the days of the Accord. They carry a crown wreathed in fire, frost and crackling lightning." },
    { s: "brunna", t: "Kurganos. The Crown of Elements. The crown of High Thane Kurganos himself.", m: "proud", alt: { s: "sigrun", t: "Kurganos. The Crown of Elements. Mother always said we'd find it.", m: "happy" } },
    { s: "oskar", t: "Volume Seven of the Book of Grudges, first page: “The Orcs broke the great gates of Karrak and carried off the High Thane's crown.” Four hundred years, that entry's stood.", m: "grudging" },
    { s: "kazra", t: "Give it to our finest warrior. Let everyone see it coming.", m: "focused" },
  ],
  "relic:news:kurganos": [
    { n: "Word reaches Karrak: a rival kingdom has dug Kurganos, the Crown of Elements, out of an old Accord wardhouse. The crown of the High Thanes of Karrak." },
    { s: "oskar", t: "The Orcs stole it from our great gates four hundred years ago. Now *someone else* is wearing it.", m: "angry", req: { holder: "orc" },
      alt: "Stolen by the Orcs four hundred years ago, lost, and now found by *somebody else entirely*. Entry {grudge} in the Book of Grudges." },
    { s: "brunna", t: "Then we take it back. Underline it, Uncle.", m: "angry", alt: { s: "sigrun", t: "Then we take it back! Underline it, Uncle!", m: "fierce" } },
  ],
  "relic:found:mhorgrim": [
    { n: "Dwarf delvers bring back a rune-musket from an old wardhouse ruin: Mhorgrim's Hunt, the weapon of Karrak's greatest huntmaster, which can call a dire wolf to heel." },
    { s: "kazra", t: "Mhorgrim's own runes. I've only ever seen drawings.", m: "focused" },
    { s: "sigrun", t: "It summons a *wolf*? Oh, I know someone who'd— …never mind.", m: "happy", req: { inGame: "orc" }, alt: "It summons a *wolf*? Brilliant. I want one." },
  ],
  "relic:news:mhorgrim": [
    { n: "Word reaches Karrak: a rival kingdom has found Mhorgrim's Hunt, the rune-musket of Karrak's greatest huntmaster." },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges: whoever is holding Mhorgrim's musket. *Wrong end first*, probably.", m: "grudging" },
  ],

  // ---------------------------------------------------------------- misc
  "capital-threat": [
    { n: "Enemy soldiers stand within sight of {capital}'s gates. In the Thane's Hall, the clan-moot has gone very quiet." },
    { s: "brunna", t: "Walls first. Every dwarf who can hold a hammer, on the walls.", m: "proud", alt: { s: "sigrun", t: "Every dwarf who can hold a hammer, on the walls! And every Metal Singer, *louder*!", m: "fierce" } },
    { s: "kazra", t: "They'll need more than soldiers to break these walls.", m: "focused" },
  ],
  "found:6": [
    { n: "Karrak's sixth hold is founded. The Thane's map of the Marches has more bronze on it than green now." },
    { s: "oskar", t: "Six holds. I've had to start a new *volume* just for the boundary disputes.", m: "grudging" },
    { s: "brunna", t: "Walls first, Uncle. Then boundaries. Then more walls.", m: "proud", alt: { s: "sigrun", t: "Six holds! Six walls to sing on!", m: "happy" } },
  ],
  "tech:tier3": [
    { n: "Karrak's scholars complete their first great advancement, and the clan-moot debates it for three days." },
    { s: "oskar", t: "Progress. Entry {grudge} in the Book of Grudges: everyone who said we couldn't.", m: "grudging" },
    { s: "kazra", t: "Good. Now make it useful.", m: "focused" },
  ],
  "built:great_hall": [
    { n: "In {city}, the Dwarves raise a Great Hall: a vast feasting hall that doubles as a fortress for any warrior resting within." },
    { s: "sigrun", t: "A Great Hall! Finally, somewhere with *acoustics*!", m: "happy" },
    { s: "oskar", t: "Entry {grudge} in the Book of Grudges, pre-emptively: the acoustics.", m: "grudging" },
  ],
  "built:deep_gate": [
    { n: "Beneath {city}, the Dwarves open their first Deep Gate: an old Underway door, re-forged so that a dwarf may step through it and out of any other Deep Gate in Karrak." },
    { s: "kazra", t: "The Underways, open again. Anywhere Karrak holds, a dwarf can be there by morning.", m: "focused" },
    { s: "sigrun", t: "*Anywhere*? …Good. Very good. For the war. Obviously.", m: "happy", req: { inGame: "orc" }, alt: "*Anywhere*? Brilliant. For the war, obviously." },
  ],
  "built:runewall": [
    { n: "At {city}, Kazra cuts the last rune into Karrak's first Runewall. The stones hum, and for a moment the whole wall glows like a banked forge." },
    { s: "kazra", t: "Every stone keyed to every other. Hit one, and the rest hit *back*.", m: "focused" },
    { s: "brunna", t: "Walls that fight. My grandmother would have wept to see it.", m: "proud" },
    { s: "oskar", t: "I've written the date in the margin. In case anyone ever *does* try it.", m: "grudging" },
  ],
  "built:deep_forge": [
    { n: "In {city}, the fires of a Deep Forge are lit, and every soldier trained there will march with a Dwarven Hammer." },
    { s: "kazra", t: "A proper forge. Every recruit gets a hammer. Point it at something you don't like.", m: "focused" },
  ],
  "trow:first": [
    { n: "Dwarf patrols report a strange figure near an old wardhouse ruin: the Treasure Trow, a hunched creature of the barrows, fiddling as it drags a bulging sack of treasure." },
    { s: "oskar", t: "A Trow, out of the old wardhouse barrow. Sixty years since one was seen above ground.", m: "grudging" },
    { s: "kazra", t: "The wardhouses are failing. Everything the Accord kept locked away is walking out.", m: "focused" },
    { s: "sigrun", t: "Or it's lucky! Trows are lucky.", m: "happy" },
    { s: "oskar", t: "Trows are lucky for *Trows*. Entry {grudge} in the Book of Grudges.", m: "grudging" },
  ],
});

// Rival-against-rival (bible §8): two of Karrak's rivals fighting each
// other, overheard from the Thane's Hall. Key: rival-vs-rival:<taker>:<loser>.
Object.assign(window.GameData.STORY_SHARED.dwarf, {
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
});
