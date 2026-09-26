/**
 * STORY SHARED -- HUMAN PLAYER (lazy-loaded with any human/* scenario)
 * ---------------------------------------------------------------------------
 * Beats reused across Westmarch's 15 scenarios (doc/story_bible.md §4 Human
 * arc, §13), keyed like scenario beats; a scenario defining the same key
 * wins. The arc's engine is Aldric (the Temple) against Corvin (the
 * Collegium), with Maren holding the kingdom together between them.
 * Aldric dies at B5 in the Martyr scenarios (bible §13.1, flag
 * "aldricFallen"), so his lines here drop out automatically; the ones that
 * matter fall back to Corvin or Maren. Threads living in
 * js/data/story/shared.js: bloodline, mercy, feud:*, whisper:*.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SHARED = window.GameData.STORY_SHARED || {};
window.GameData.STORY_SHARED.human = window.GameData.STORY_SHARED.human || {};

Object.assign(window.GameData.STORY_SHARED.human, {
  // ---------------------------------------------------------------- arc
  N: [
    { n: "Corvin returns that evening with a rubbing of the stone's inscription, and a frown." },
    { s: "corvin", t: "The runes have shifted, Majesty. The stone will not say *held* this time. Only *remains*.", m: "wry" },
    { s: "aldric", t: "Then the Dawn wills a war to the last.", m: "fervent" },
    { s: "corvin", t: "Or the *stone* does. Rocks rarely consult the Temple.", m: "wry" },
  ],
  R: [
    { n: "Westmarch could have claimed the Marches. The Queen refused." },
    { n: "At the heart of the Marches, the split Marchstone speaks." },
    { s: "stone", t: "NOT YET." },
    { s: "aldric", t: "The Dawn itself delays our victory!", m: "angry", alt: { s: "maren", t: "Not yet.", m: "resolute" } },
    { s: "corvin", t: "No, Lord-Paladin. *We* did. The stone is simply taking us at our word.", m: "wry", req: { charAlive: "aldric" },
      alt: "We refused it, Majesty. The stone is simply taking us at our word." },
  ],
  B3: [
    { n: "The royal council chamber of {capital}, packed to the rafters. Aldric stands before the assembled nobles of Westmarch, in white-and-gold plate, with the sunburst of the Dawn on his breastplate." },
    { s: "aldric", t: "The stone is broken, and the Marches are godless without it! Westmarch must march under the Dawn's banner: a holy war, blessed by the Temple!", m: "fervent" },
    { s: "corvin", t: "A holy war. Against *whom*, Lord-Paladin? You haven't said. I suspect the Dawn hasn't told you yet.", m: "wry" },
    { n: "Half the nobles cheer Aldric. The other half laugh with Corvin. Maren watches her court split down the middle, Temple on one side, Collegium on the other." },
    { s: "maren", t: "We are not fighting a holy war. We are not fighting a clever war. We are fighting *this* war, and I've already drawn the plan. Sit down, both of you, and read it.", m: "angry" },
    { s: "maren", t: "*(to the clerk)* …And write it down. Both versions.", m: "resolute" },
  ],
  B4: [
    { n: "The Collegium tower in {capital}, at midnight. Corvin has asked the Queen to come alone. Maps of the Marchstone's runes cover every table." },
    { s: "corvin", t: "It didn't break, Majesty. It *wore through*. We asked one rock to hold five crowns apart for a thousand years. Nothing holds forever: no stone, no Accord, no crown.", m: "wry" },
    { s: "maren", t: "Including mine.", m: "sad" },
    { s: "corvin", t: "Including yours. …Which brings me to the Dawn Omen.", m: "wry" },
    { n: "The Dawn Omen: the morning the sunrise poured through the Collegium windows and lit the young magus Maren like a lantern. It was the sign that made her Queen." },
    { s: "corvin", t: "I've been teaching light spells for thirty years, Majesty. I know what one looks like, especially one cast by a frightened student.", m: "wry" },
    { n: "Maren says nothing for a long moment." },
    { s: "maren", t: "And what will you do with that, Archmage?", m: "resolute" },
    { s: "corvin", t: "Tonight? Nothing. I only wanted you to know that I know.", m: "wry" },
  ],
  // The Rift: the Dawn Trial.
  B5: [
    { n: "The steps of the Dawn Cathedral in {capital}, at noon. Aldric stands before a crowd of priests and Knights of the Dawn, the Temple's holy order, holding a scroll with the Temple's seal." },
    { s: "aldric", t: "Majesty. The Temple demands a Dawn Trial: you will stand in the Cathedral at sunrise, and the light will prove your anointing true, before all Westmarch.", m: "fervent" },
    { n: "Across the square, Corvin stands on the Collegium steps with a scroll of his own." },
    { s: "corvin", t: "And the Collegium declares: if the Queen submits to *superstition*, the magi will withdraw her election. A monarch of Westmarch is chosen by reason, not by weather.", m: "angry" },
    { n: "The crowd falls silent. If Maren obeys either man, she loses the other half of her kingdom." },
    { s: "maren", t: "I will not stand trial before the sun, and I will not be un-crowned by a tantrum. I am your Queen *because Westmarch needs one*, today, in a war.", m: "angry" },
    { s: "maren", t: "Lord-Paladin. Archmage. You will both return to the council chamber, and you will both *sit down*.", m: "resolute" },
    { n: "Slowly, first Aldric, then Corvin, lowers his scroll. Westmarch holds, for now." },
  ],
  // The confession. With the Orcs in the game, Aldric confesses the Last
  // Parley to his sister; without them, Corvin digs it up first.
  B6: [
    { n: "The Dawn Cathedral, empty, before sunrise. Maren finds her brother kneeling alone before the great eastern window.", req: { inGame: "orc" },
      alt: "The Collegium archive, before sunrise. Corvin has found a clerk's record of the Last Parley, the border meeting with the Orcs that ended in blood, a season before the stone split." },
    { s: "aldric", t: "Sister. I must confess something. Not to the Temple. To you.", m: "sad", req: { inGame: "orc" } },
    { s: "maren", t: "The Last Parley.", m: "sad", req: { inGame: "orc" } },
    { s: "aldric", t: "The ground shook, and I thought the Orcs had set an ambush. I drew my sword. I struck first. The Orcs never broke faith. *I* did.", m: "sad", req: { inGame: "orc" } },
    { s: "maren", t: "And for a year you let me call Grukka Ironjaw an oath-breaker.", m: "angry", req: { inGame: "orc" } },
    { s: "aldric", t: "Yes. I was passed over for the crown, sister. I could not also be the man who started a war.", m: "sad", req: { inGame: "orc" } },
    { n: "The sun rises through the eastern window and falls across them both. Maren does not know whether the light means anything.", req: { inGame: "orc" } },
    { s: "maren", t: "Then you'll be the man who helps end one. Get up, Aldric.", m: "resolute", req: { inGame: "orc" } },
    // No orcs: Corvin finds it.
    { s: "corvin", t: "*(reading, alone)* “The Lord-Paladin drew first.” …Well. Well, well, well.", m: "wry", req: { notInGame: "orc" } },
    { n: "It is everything Corvin has ever wanted: proof that the Temple's champion lied to the Queen. With this, the Collegium could break the Temple for a generation.", req: { notInGame: "orc" } },
    { n: "That evening, he finds Aldric alone in the Cathedral, and puts the record in his hands.", req: { notInGame: "orc" } },
    { s: "aldric", t: "…You'll take this to the council.", m: "sad", req: { notInGame: "orc" } },
    { s: "corvin", t: "No. Not like this. I'll beat you *honestly*, Aldric. Tell her yourself. Tonight.", m: "wry", req: { notInGame: "orc" } },
    { s: "aldric", t: "*(after a long silence)* …Thank you, Archmage.", m: "sad", req: { notInGame: "orc" } },
    { s: "corvin", t: "Don't thank me. Being noble at you is bad enough. Being *thanked* for it is unbearable.", m: "wry", req: { notInGame: "orc" } },
  ],

  // ---------------------------------------------------------------- first contact
  "meet:dwarf": [
    { n: "Human scouts reach the northern foothills and the first dwarf hold. The Dwarves of Karrak have come down from their mountains." },
    { n: "In Karrak, High Thane Brunna Stonefast reads the scouts' report beside her uncle, Loremaster Oskar Grimgate, keeper of the Book of Grudges." },
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

  // ---------------------------------------------------------------- captures
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
  // ---------------------------------------------------------------- losses
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
  // ---------------------------------------------------------------- eliminations
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

  // ---------------------------------------------------------------- ultimates
  "ultimate:dwarf": [
    { n: "Human watchtowers on the northern border sound the alarm. Something enormous is walking down from the mountains: a Runeforged Titan, a giant golem of rune-carved stone built by the Dwarves." },
    { s: "maren", t: "So. The Cathedral's debt collector has arrived.", m: "resolute" },
    { n: "In the forges of Karrak, the runesmith who built it, Kazra Emberdeep, wife of the Dwarf Thane, wipes the soot from her hands." },
    { s: "kazra", t: "Titan's done. Point it at Westmarch.", m: "focused" },
  ],
  "ultimate:orc": [
    { n: "A shadow crosses the fields of Westmarch at noon. The Orcs have hatched a Dragon." },
    { s: "aldric", t: "A dragon. The Dawn tests us.", m: "fervent" },
    { s: "corvin", t: "The Dawn doesn't breathe fire, Lord-Paladin. *That* does. I'd prefer a plan to a prayer.", m: "wry", req: { charAlive: "aldric" },
      alt: "A dragon. Majesty, I'd prefer a plan to a prayer. Aldric would have given you the prayer anyway." },
    { n: "In the Bloodmire, Gnash, the huge ogre who serves as the clans' butcher, tries to pet the Dragon." },
    { s: "gnash", t: "Dragon bite Gnash! Dragon is GOOD dragon!", m: "happy" },
  ],
  "ultimate:human": [
    { n: "In the Collegium tower, a wizard of Westmarch completes the last of the great disciplines. For the first time in a century, the kingdom has a Grand Magus." },
    { s: "corvin", t: "Flight, fire, frost, invisibility, the lot. Proof, Lord-Paladin, that reason can do what the Temple only prays for.", m: "happy", req: { charAlive: "aldric" },
      alt: "Flight, fire, frost, invisibility, the lot. Aldric would have called it a heresy with a fireball. …I rather miss being called that." },
    { s: "aldric", t: "It is a heresy with a fireball.", m: "angry" },
    { s: "maren", t: "It is *our* heresy with a fireball.", m: "resolute" },
  ],

  // ---------------------------------------------------------------- relics (§7)
  "relic:found:kuvira": [
    { n: "Human soldiers return from a delve with a golden sword that shines in the dark: Kuvira, Light of Justice, the blade of Saint Kuvira, first Paladin of the Dawn." },
    { s: "aldric", t: "Saint Kuvira's blade. The Temple says whoever bears it is the Dawn's true chosen.", m: "fervent" },
    { s: "corvin", t: "*(quietly, to Maren)* Majesty, I'd keep that sword well away from anyone who has ever wanted your crown.", m: "wry", req: { charAlive: "aldric" } },
    { s: "maren", t: "It goes to the Cathedral. On the altar. Where *nobody* carries it.", m: "resolute" },
  ],
  "relic:news:kuvira": [
    { n: "News from a scout: another kingdom's delvers have found Kuvira, Light of Justice, the sword of the first Paladin of the Dawn." },
    { s: "aldric", t: "Saint Kuvira's blade, in *heathen* hands! Majesty, the Temple will not rest!", m: "angry", alt: { s: "maren", t: "Saint Kuvira's blade. Aldric would have ridden out tonight. …Bring it home.", m: "resolute" } },
    { s: "corvin", t: "It's a sword, Lord-Paladin. It won't mind who's holding it.", m: "wry", req: { charAlive: "aldric" } },
  ],
  "relic:found:rosepearl": [
    { n: "Human soldiers bring back a pearl that glows faintly purple: the Rosepearl, set in Westmarch's first crown and pledged to the Marchstone a thousand years ago." },
    { s: "aldric", t: "The Temple will restore it to the Queen, in the Cathedral, at dawn.", m: "fervent" },
    { s: "corvin", t: "The *Collegium* will restore it to the Queen, in the tower, with proper documentation.", m: "wry" },
    { s: "maren", t: "*I'll* restore it to myself, in the kitchen, before either of you can argue.", m: "happy" },
  ],
  "relic:news:rosepearl": [
    { n: "News from a scout: the Rosepearl, the jewel of Westmarch's first crown, has been found by another kingdom." },
    { s: "maren", t: "Our first crown's pearl, in someone else's treasury. Get it back.", m: "resolute" },
  ],
  "relic:found:arangil": [
    { n: "Human soldiers return with a scrying orb clouded with starlight: Arangil's Vision Glass, the orb of the founder of the Collegium." },
    { s: "corvin", t: "Arangil's own glass. Majesty, this is proof the Collegium is the true heir of Westmarch's founding. I may frame the Lord-Paladin's reaction.", m: "happy" },
    { s: "aldric", t: "It's a *glass ball*, Archmage.", m: "angry" },
    { s: "corvin", t: "So is the sun, Lord-Paladin, from far enough away.", m: "wry" },
  ],
  "relic:news:arangil": [
    { n: "News from a scout: Arangil's Vision Glass, the Collegium founder's scrying orb, has been found by another kingdom." },
    { s: "corvin", t: "The founder's own glass, in foreign hands. Majesty, I should like that back. *Personally*.", m: "angry" },
  ],
  "relic:found:amulet_of_aesia": [
    { n: "Human soldiers bring back a sunburst amulet that heals like a druid and blesses like a paladin: the Amulet of Aesia." },
    { s: "aldric", t: "Saint Aesia's amulet! A Dawn-saint's relic, home at last!", m: "fervent" },
    { s: "vaelis", t: "*(in the Silverwood, on hearing)* Aesia was a *druid*. My great-uncle knew her. The mayflies have stolen a dead woman's jewellery and given her a new religion.", m: "aloof", req: { inGame: "elf" } },
    { s: "corvin", t: "Two peoples claiming one saint. I shall enjoy the footnotes.", m: "wry" },
  ],
  "relic:news:amulet_of_aesia": [
    { n: "News from a scout: the Amulet of Aesia has been found, and Westmarch does not have it." },
    { s: "aldric", t: "Saint Aesia's amulet, in the wrong hands. The Temple will pray for its return. Loudly.", m: "fervent", alt: { s: "maren", t: "Saint Aesia's amulet. Aldric always said it belonged in the Cathedral. …Bring it home. For him.", m: "sad" } },
    { s: "vaelis", t: "*(in the Silverwood)* A druid's amulet, and the mayflies call it theirs. They name everything they cannot understand.", m: "aloof", req: { holder: "elf" } },
  ],
  "relic:news:mortedamos": [
    { n: "News from a scout: Mortedamos' Malefic Manuscript, the grimoire of every curse, sealed away by the Accord, has been found." },
    { s: "corvin", t: "The Malefic Manuscript. Majesty, the Collegium would give almost anything to study it.", m: "happy" },
    { s: "aldric", t: "The Temple would give almost anything to *burn* it.", m: "angry" },
    { s: "skarra", t: "*(in the Bloodmire)* MINE! Every curse in the Marches, and they're ALL SKARRA'S NOW!", m: "gleeful", req: { holder: "orc" } },
  ],

  // ---------------------------------------------------------------- growth
  "capital-threat": [
    { n: "Enemy soldiers stand within sight of {capital}. The Cathedral bells ring the alarm, and the Collegium towers begin to hum." },
    { s: "aldric", t: "The Knights of the Dawn will hold the Cathedral steps, Majesty. To the last.", m: "fervent" },
    { s: "corvin", t: "And the towers will hold everything else. Try not to stand in front of them, Lord-Paladin.", m: "wry", req: { charAlive: "aldric" },
      alt: "The towers will hold, Majesty. And the Knights will hold the Cathedral steps. For him." },
    { s: "maren", t: "Nobody is holding anything *to the last*. We hold it until they leave.", m: "resolute" },
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
  "tech:tier3": [
    { n: "The scholars of the Collegium complete their first great advancement of the war." },
    { s: "corvin", t: "A new discovery, Majesty. Achieved by reason, method, and a great deal of candle wax.", m: "happy" },
    { s: "aldric", t: "Achieved by the Dawn's grace, working through *very* ungrateful men.", m: "fervent", alt: { s: "corvin", t: "*(quietly)* Aldric would have thanked the Dawn for it. …Thank you, Dawn. Just this once.", m: "sad" } },
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
  "built:guild_hall": [
    { n: "In {city}, a Guild Hall opens, where Westmarch's soldiers are trained by professionals, and paid by the week." },
    { s: "maren", t: "Neutral ground. The Temple and the Collegium both have to do business here. …I may hold council meetings in it.", m: "happy" },
  ],
  "built:bazaar": [
    { n: "In {city}, a Bazaar opens, and merchants from every kingdom in the Marches come to sell, war or no war." },
    { s: "corvin", t: "Trade, Majesty. The only thing in the Marches older than grudges.", m: "wry" },
    { s: "maren", t: "A market pays for itself eventually. Trade is just another way to win.", m: "happy" },
  ],
  "trow:first": [
    { n: "Human soldiers report a strange figure near an old wardhouse ruin: the Treasure Trow, a hunched creature of the barrows, fiddling as it drags a sack of treasure." },
    { s: "corvin", t: "The ruins were wardhouses, Majesty. The Accord's own vaults. With the stone gone, the wards are failing, and everything they locked away is walking out.", m: "wry" },
    { s: "aldric", t: "A demon! Knights, to arms!", m: "angry", alt: { s: "maren", t: "Leave it be. We have enough enemies.", m: "resolute" } },
    { s: "corvin", t: "It's playing a *fiddle*, Lord-Paladin. Badly. That's not demonic. That's merely *unfortunate*.", m: "wry", req: { charAlive: "aldric" } },
  ],

  // ---------------------------------------------------------------- lovers (§5), seen from outside
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

  // ---------------------------------------------------------------- rival against rival
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
});

// ---------------------------------------------------------------------------
// 2026-09-26, user-directed threads (js/engine/story.js pollState):
//   maren:resolve     -- Maren stops refereeing and starts leading.
//   faith:1, faith:2  -- Aldric's faith, vindicated; Corvin is wrong.
//   rift:aldric-goldie -- first blood between Westmarch and the Hearthlands.
// ---------------------------------------------------------------------------
Object.assign(window.GameData.STORY_SHARED.human, {
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
    { s: "aldric", t: "I don't need you to believe, Archmage. I needed you to be here.", m: "happy" },
    { s: "corvin", t: "…I was. All night. I held the Tanner girl's hand. I don't know why I stayed.", m: "sad" },
    { s: "aldric", t: "I do.", m: "fervent" },
  ],
  "faith:2": [
    { n: "The eve of the Feast of First Light. Aldric warns the council that the enemy will strike tonight: on the holiest night of the Temple's year, when every soldier would rather be at prayer." },
    { s: "corvin", t: "Armies don't keep the Temple's calendar, Lord-Paladin. The wards on the walls are the finest the Collegium has ever cast. Nothing is getting through them tonight.", m: "wry" },
    { s: "maren", t: "Aldric. Take your knights to the walls anyway. If you're wrong, you'll have missed a feast.", m: "resolute" },
    { n: "At midnight, the Collegium's wards gutter out, all at once, like candles in a draught. The enemy is already at the walls. Aldric's knights are already waiting for them." },
    { n: "The paladins hold the breach until dawn, singing the Hymn of First Light. When the sun comes up behind them, the attackers break and run." },
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
});
