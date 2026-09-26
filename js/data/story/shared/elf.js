/**
 * STORY SHARED -- ELF PLAYER (lazy-loaded with any elf/* scenario)
 * -------------------------------------------------------------------
 * Beats reused across the Elves' 15 scenarios (doc/story_bible.md §4 Elf
 * arc, §13), keyed like scenario beats; a scenario defining the same key
 * wins. Vaelis is the court's cold dissenting voice and speaks whenever the
 * Elves are on stage (bible §3 standing rule). Threads that live in
 * js/data/story/shared.js: bloodline, mercy, feud:*, whisper:*.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SHARED = window.GameData.STORY_SHARED || {};
window.GameData.STORY_SHARED.elf = window.GameData.STORY_SHARED.elf || {};

Object.assign(window.GameData.STORY_SHARED.elf, {
  // ---------------------------------------------------------------- arc
  N: [
    { n: "Ysolde lays her palm against the Heartwood's bark, and listens to the stone's words once more." },
    { s: "ysolde", t: "The stone has changed its mind, Warden. It will not say *held* this time. Only *remains*.", m: "uncanny" },
    { s: "vaelis", t: "Then it will be a long war, great-uncle. Good. We are the only ones who can afford one.", m: "aloof" },
  ],
  R: [
    { n: "The Silverwood could have claimed the Marches. The Warden refused." },
    { n: "At the heart of the Marches, the split Marchstone speaks." },
    { s: "stone", t: "NOT YET." },
    { s: "vaelis", t: "You *declined* it, great-uncle? The Marches, offered on a leaf, and you declined?", m: "angry" },
    { s: "aelthir", t: "I have waited a thousand years, Vaelis. I can wait until it is *right*.", m: "wistful" },
  ],
  B3: [
    { n: "The Wellspring, the sacred spring at the heart of the Silverwood, turns black at midnight. Shadowsteeds, horses of living smoke summoned by elven druids, are drinking from it." },
    { n: "Lord Vaelis Nightbloom sits his own Shadowsteed at the water's edge. He summoned them here without the Warden's leave." },
    { s: "ysolde", t: "You have fouled the Wellspring, my son.", m: "angry" },
    { s: "vaelis", t: "I have *armed* it, mother. The lesser peoples are at our borders, and great-uncle wants to wait them out. I prefer to *outride* them.", m: "aloof" },
    { s: "ysolde", t: "The water will remember this.", m: "uncanny" },
    { s: "vaelis", t: "Let it. Water forgets everything eventually. That is rather the point of water.", m: "aloof" },
    { s: "aelthir", t: "*(arriving)* Send them away, Vaelis. Now. We do not win this by becoming what we fear.", m: "angry" },
    { n: "The Shadowsteeds dissolve into mist. Vaelis bows, exactly as deeply as courtesy requires, and not one hair deeper." },
  ],
  B4: [
    { n: "Beneath the Heartwood, Ysolde kneels among its roots with her eyes closed. She has been listening to them for three days." },
    { s: "ysolde", t: "The stone did not break, Warden. It *sighed*. A thousand years of holding five crowns apart, and it was simply… tired.", m: "uncanny" },
    { s: "aelthir", t: "Then the Accord cannot be restored.", m: "sad" },
    { s: "ysolde", t: "Only replaced. The trees are quite certain. They are rarely certain.", m: "uncanny" },
    { n: "Aelthir is silent for a long time. When he speaks, he sounds older than the tree above him." },
    { s: "aelthir", t: "I held the torch when they swore it, Ysolde. I have spent a thousand years guarding a promise that was already dying.", m: "sad" },
    { s: "vaelis", t: "*(from the shadows)* Then stop guarding it, great-uncle. Let the old promises die, and let the Silverwood *rule*.", m: "aloof" },
  ],
  B5: [
    { n: "The Conclave of Elders, the council of the Silverwood's eldest, gathers beneath the Heartwood. Lord Vaelis stands before them, the first time in six hundred years he has asked to speak." },
    { s: "vaelis", t: "Elders. The Accord is broken. Every promise it made to the lesser peoples died with it. I petition the Conclave to *renounce* them, all of them, formally.", m: "aloof" },
    { s: "vaelis", t: "Let the Silverwood owe the brief nothing. Not shelter, not mercy, not memory. They will not remember us. Why should we remember *them*?", m: "aloof" },
    { n: "A murmur runs through the Conclave. Some of the eldest are nodding." },
    { s: "aelthir", t: "Because I held the torch, Vaelis. Because I watched their ancestors swear, and I remember how young they looked.", m: "wistful" },
    { s: "ysolde", t: "The trees vote against my son. All of them. I am sorry, Vaelis. I am also not.", m: "uncanny" },
    { n: "The petition fails, by three voices. Vaelis bows, unbothered, and turns to go." },
    { s: "vaelis", t: "Then we shall wait, great-uncle. We are *very* good at waiting.", m: "angry" },
  ],

  // ---------------------------------------------------------------- first contact
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

  // ---------------------------------------------------------------- captures (player takes)
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
  // ---------------------------------------------------------------- losses
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
  // ---------------------------------------------------------------- eliminations
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

  // ---------------------------------------------------------------- ultimates
  "ultimate:dwarf": [
    { n: "The ground shakes at the forest's edge. A Runeforged Titan, a giant golem of rune-carved stone, walks out of the mountains of Karrak." },
    { s: "vaelis", t: "The mud-folk have built a walking hill. How very like them.", m: "aloof" },
    { s: "ysolde", t: "Then the oaks will walk too. They have been asking.", m: "uncanny" },
  ],
  "ultimate:orc": [
    { n: "A shadow crosses the Silverwood at noon. The Orcs have hatched a Dragon." },
    { s: "vaelis", t: "Fire with wings. The Orcs' answer to everything, finally airborne.", m: "aloof" },
    { s: "aelthir", t: "The last time a dragon flew over this forest, I was young. Every ranger to the treetops.", m: "wistful" },
  ],
  "ultimate:human": [
    { n: "News from Westmarch: the Collegium has made its first Grand Magus, a wizard master of every discipline." },
    { s: "vaelis", t: "The mayflies have learned a *trick*. How charming.", m: "aloof" },
    { s: "aelthir", t: "*(quietly)* It is our blood that makes their magic, Vaelis. Our blood, waking.", m: "wistful", req: { seen: "bloodline" } },
  ],

  // ---------------------------------------------------------------- relics
  "relic:found:alunaria": [
    { n: "Elf delvers return from an old Accord wardhouse carrying a staff that glows with cold moonlight: Alunaria, the heirloom of House Moonveil." },
    { s: "aelthir", t: "My father pledged that staff to the Accord. I was there. I have not seen it in a thousand years.", m: "wistful" },
    { s: "vaelis", t: "Then it comes home to the family. To the *heir*, naturally.", m: "happy" },
    { s: "ysolde", t: "Naturally, my son. When you are one.", m: "uncanny" },
  ],
  "relic:news:alunaria": [
    { n: "Word reaches the Heartwood: a rival kingdom has found Alunaria, the moonlight staff of House Moonveil." },
    { s: "aelthir", t: "My father's staff. In the hands of strangers.", m: "sad" },
    { s: "vaelis", t: "Then we take it back, great-uncle. For once, I think we agree.", m: "angry" },
  ],
  "relic:found:eyrhild": [
    { n: "Elf delvers bring back Eyrhild's Fury, the silver-lit sword of the Silverwood's greatest Blade Dancer." },
    { s: "vaelis", t: "Eyrhild. My ancestor. I have waited six hundred years for the lesser peoples to return it. I did not expect them to *lose* it first.", m: "aloof" },
  ],
  "relic:news:eyrhild": [
    { n: "Word reaches the Heartwood: a rival kingdom has found Eyrhild's Fury, the sword of Vaelis's own ancestor." },
    { s: "vaelis", t: "My ancestor's sword, in mud-caked hands. I shall collect it personally. I shall also collect the hands.", m: "angry" },
    { s: "aelthir", t: "Vaelis." },
    { s: "vaelis", t: "Figuratively, great-uncle. *Mostly*.", m: "aloof" },
  ],
  "relic:found:amulet_of_aesia": [
    { n: "Elf delvers bring back a golden amulet shaped like a sunburst: the Amulet of Aesia, which the Humans' Temple claims for its saints." },
    { s: "aelthir", t: "Aesia was no human saint. She was a druid of the Silverwood. I knew her. She laughed at everything.", m: "happy" },
    { s: "vaelis", t: "Then let the Temple of the Dawn come and claim it. I should enjoy watching them try.", m: "happy" },
  ],
  "relic:news:amulet_of_aesia": [
    { n: "Word reaches the Heartwood: the Amulet of Aesia has been found, and the Humans' Temple calls it a relic of its saints." },
    { s: "aelthir", t: "Aesia was a druid. My friend. They have made her a saint of their sun.", m: "wistful" },
    { s: "ysolde", t: "She would have found that very funny, Warden.", m: "happy" },
  ],
  "relic:news:agasou": [
    { n: "Word reaches the Heartwood: the Spear of Agasou, which the elves say was stolen from a druid grove with the druids' beast-shapes, has been found." },
    { s: "ysolde", t: "The spear that learned our shapes. Bear, raptor, wolf. It should never have left the grove.", m: "uncanny" },
    { s: "vaelis", t: "Then we shall return it to the grove. Point first, into whoever holds it.", m: "angry" },
  ],
  "relic:news:umbral_ring": [
    { n: "Word reaches the Heartwood: the Umbral Ring, a shadow-ring the Accord sealed away, has been found." },
    { s: "vaelis", t: "*(very quietly)* The Umbral Ring. Now *that* is a thing of beauty.", m: "happy" },
    { s: "ysolde", t: "No, my son.", m: "angry" },
  ],

  // ---------------------------------------------------------------- misc
  "capital-threat": [
    { n: "Enemy soldiers stand within sight of {capital}. The rangers in the Treetop Watches have not slept in three days." },
    { s: "aelthir", t: "The forest is patient, Vaelis. It has buried cities before.", m: "wistful" },
    { s: "vaelis", t: "Then let it bury this one's besiegers, great-uncle. *Quickly*, for once.", m: "angry" },
  ],
  "found:6": [
    { n: "The Silverwood's sixth grove-town is planted. The forest has grown further in one war than in the last three centuries." },
    { s: "ysolde", t: "The trees are pleased. They have not been this busy since the Accord.", m: "happy" },
    { s: "vaelis", t: "Six groves. Perhaps the Silverwood is finally remembering what it is.", m: "aloof" },
  ],
  "tech:tier3": [
    { n: "The Silverwood's scholars complete their first great advancement of the war." },
    { s: "aelthir", t: "New learning. My grandmother would have called it a fad.", m: "wistful" },
    { s: "vaelis", t: "Your grandmother, great-uncle, called *agriculture* a fad.", m: "aloof" },
  ],
  "built:altar_of_ages": [
    { n: "In {city}, an Altar of Ages is raised, where the young of the Silverwood learn from the old." },
    { s: "vaelis", t: "Another place for the elders to tell me I am young. Splendid.", m: "aloof" },
    { s: "aelthir", t: "You *are* young, Vaelis. That is not an insult. It is a warning.", m: "wistful" },
  ],
  "built:wellspring_grove": [
    { n: "In {city}, a Wellspring Grove is planted, carrying the healing waters of the Silverwood's sacred spring." },
    { s: "ysolde", t: "The Wellspring has a daughter. She will be less patient than her mother. Good.", m: "uncanny" },
  ],
  "built:treetop_watch": [
    { n: "Above {city}, a Treetop Watch is raised, and the elves' eyes reach twice as far." },
    { s: "aelthir", t: "Vigilance is the oldest thing we do. Older than the Accord. Older than me.", m: "wistful" },
  ],
  "built:silverleaf_atelier": [
    { n: "In {city}, the first Silverleaf Atelier opens, and its artisans begin forging mythril armour." },
    { s: "vaelis", t: "At last. A building in this war with some *taste*.", m: "happy" },
  ],
  "trow:first": [
    { n: "Elf rangers report a strange figure near an old wardhouse ruin: the Treasure Trow, a hunched creature of the barrows, fiddling as it drags a sack of treasure." },
    { s: "ysolde", t: "A Trow. The wards the Accord set are failing. Everything they kept locked away is walking out.", m: "uncanny" },
    { s: "vaelis", t: "A creature that hoards shiny things in a sack and plays music badly. It reminds me of the dwarves.", m: "aloof" },
  ],

  // ---------------------------------------------------------------- lovers (§5), seen by the Elves
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
});

// Rival-against-rival (bible §8), overheard beneath the Heartwood.
Object.assign(window.GameData.STORY_SHARED.elf, {
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
});
