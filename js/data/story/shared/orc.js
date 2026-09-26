/**
 * STORY SHARED -- ORC PLAYER (lazy-loaded with any orc/* scenario)
 * ---------------------------------------------------------------------------
 * Beats reused across the Bloodmire's 15 scenarios (doc/story_bible.md §4
 * Orc arc, §13), keyed like scenario beats; a scenario defining the same
 * key wins. Skarra is the player's OWN internal enemy here: she schemes all
 * war and makes her coup at B5. With the Dwarves in the game her weapon is
 * Varg's secret (§5); without them, it's the Warchief's "softness".
 * Moss dies in the Moss Falls scenarios (bible §13.11, flag "mossDead"), so
 * every Moss mention here carries a variant. Threads living in
 * js/data/story/shared.js: feud:* (orc), found:3 (Varg the builder).
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SHARED = window.GameData.STORY_SHARED || {};
window.GameData.STORY_SHARED.orc = window.GameData.STORY_SHARED.orc || {};

Object.assign(window.GameData.STORY_SHARED.orc, {
  // ---------------------------------------------------------------- arc
  N: [
    { n: "Skarra casts her bones a second time, and scowls at how they land." },
    { s: "skarra", t: "The stone has changed its tune, little Warchief. It won't say HOLD this time. Only REMAIN.", m: "gleeful" },
    { s: "grukka", t: "Good. Holding was never our way anyway.", m: "defiant" },
  ],
  R: [
    { n: "The Orcs could have claimed the Marches. The Warchief refused." },
    { n: "At the heart of the Marches, the split Marchstone speaks." },
    { s: "stone", t: "NOT YET." },
    { s: "grukka", t: "Holding. Bah. We finish this the orc way.", m: "defiant" },
    { s: "varg", t: "…That's what I was afraid of.", m: "sad", req: { notFlag: "mossDead" }, alt: "Good. Finish all of them." },
  ],
  // Building-gated (bible §12 rule 21): the second settlement AND the first
  // War Camp; the fallback plays on round 15 without the War Camp.
  B1: {
    req: { building: "self:war_camp" },
    fallbackRound: 15,
    lines: [
      { n: "{city}, the Orcs' second settlement, raises its first War Camp: a training ground of spikes, smoke and red banners.", req: { cities: 2 },
        alt: "The clans' first War Camp rises on the bog's edge: a training ground of spikes, smoke and red banners." },
      { s: "grukka", t: "Our first War Camp. Warriors trained here will march harder and strike first.", m: "defiant" },
      { s: "skarra", t: "A camp, brother? It's just a bog with ambitions.", m: "gleeful" },
      { s: "grukka", t: "So am I.", m: "defiant" },
      { n: "Gnash celebrates by smashing the War Camp's brand-new gate." },
      { s: "gnash", t: "Gnash smash gate for luck! …Gnash build new gate? Gnash smash that one too. More luck.", m: "happy" },
    ],
    fallback: [
      { n: "{city}, the Orcs' second settlement, rises on the bog's edge: mud huts, a fire pit, and a great many spikes.", req: { cities: 2 },
        alt: "Orc scouts range across the bog's edge, sniffing out ground for a second settlement." },
      { s: "grukka", t: "A second settlement. Next, we teach it to fight.", m: "defiant", req: { cities: 2 }, alt: "A second settlement, soon. Then we teach it to fight." },
      { s: "skarra", t: "A settlement, brother? It's just a bog with ambitions.", m: "gleeful" },
      { s: "grukka", t: "So am I.", m: "defiant" },
      { n: "Gnash celebrates anyway, by smashing a perfectly good fence." },
      { s: "gnash", t: "Gnash smash fence for luck! …Was Gnash's fence. Gnash still lucky.", m: "happy" },
    ],
  },
  B3: [
    { n: "The orc war council in {capital}, around a roaring fire pit. Grukka's captains are boasting of new ground taken." },
    { s: "grukka", t: "More ground this season than in a hundred years. So why the long face, boy?", m: "defiant" },
    { s: "varg", t: "Because we take it, Father, and then we move on. The camps empty. The fields rot. If all we do is take, the Clans will scatter the moment we stop winning.", m: "sad" },
    { s: "skarra", t: "Listen to him! Soft as bog-moss! Is this a Warchief's son or a farmer?", m: "gleeful" },
    { n: "Varg flinches. Skarra smiles, and strokes her frog, Destiny." },
    { s: "grukka", t: "Enough, Skarra.", m: "angry" },
    { s: "grukka", t: "…Keep talking, boy. I'm listening." },
  ],
  B4: [
    { n: "The Speaking Stones in {capital}, under a blood-red moon. Skarra dances between the standing stones, casting bones into the black bog-water." },
    { s: "skarra", t: "The ancestors have spoken, little Warchief! The Marchstone didn't break. It LET GO, of the Marches and of every oath ever sworn on it!" },
    { s: "grukka", t: "So?" },
    { s: "skarra", t: "So no oath binds anyone anymore. Not dwarves. Not elves. Not… *brothers*. It has LET GO, and so shall I!" },
    { n: "Grukka laughs, and the clans laugh with him. It is a mistake." },
    { s: "grukka", t: "Let go of what, Skarra? Your frog?" },
  ],
  // Skarra's coup. With Dwarves in the game it's the lovers' secret; the
  // Dwarf-player-less scenarios that want the full lovers version (orc/dwarf
  // etc.) override B5. Without Dwarves, she brands the Warchief soft.
  B5: [
    { n: "Dawn at the Speaking Stones. Every clan of the Bloodmire has been summoned. Skarra stands atop the tallest stone, with Gnash and his cleaver beside her." },
    { s: "skarra", t: "Hear me, clans of Bloodmire! My Wisps have seen the truth! The Warchief's own son crawls through dwarf tunnels to meet a dwarf princess, the Thane's own daughter!", m: "gleeful", req: { inGame: "dwarf" },
      alt: "Hear me, clans of Bloodmire! Your Warchief has gone SOFT! His son builds wells! His camps plant *turnips*! The ancestors did not die in the Mountain Wars for TURNIPS!" },
    { fx: { seen: "lovers:meet" }, req: { inGame: "dwarf" } },
    { s: "varg", t: "Her name is Sigrun.", m: "bashful", req: { inGame: "dwarf" },
      alt: "Wells keep a town alive, aunt. So do turnips." },
    { s: "skarra", t: "A Warchief who can't rule his own son can't rule the Clans! The seat is MINE!", m: "gleeful" },
    { s: "gnash", t: "Why Varg hug little metal lady? Gnash thought he was eating her slowly.", m: "confused", req: { inGame: "dwarf" },
      alt: { s: "gnash", t: "Gnash like turnip. Turnip is crunchy. …Gnash on Skarra's side, though. Probably.", m: "confused" } },
    { n: "The clans hold their breath. Grukka steps up onto the stone opposite his sister's." },
    { s: "grukka", t: "You'd hand my son to the dwarves' axes to steal my seat, Skarra.", m: "angry", req: { inGame: "dwarf" },
      alt: "Soft. I've broken more cage bars than you've cursed frogs, sister. The clans follow me because I keep my word." },
    { s: "skarra", t: "Skarra would hand ANYONE to ANYONE!", m: "gleeful" },
    { s: "grukka", t: "And my word is this: get out of my bog. Take your frog.", m: "angry" },
    { n: "Gnash looks from one sister to the other, counting on his fingers." },
    { s: "gnash", t: "Gnash stay. Witch never has snacks.", m: "confused" },
    { n: "Skarra flees into the mist, shrieking. Destiny the frog hops the other way." },
    { s: "skarra", t: "This isn't over! The bog remembers! Destiny remembers! …Destiny! Come BACK, you ungrateful FROG!", m: "angry" },
    { n: "When the clans have gone, Grukka stands alone with his son among the standing stones." },
    { s: "grukka", t: "I'm not done being angry, boy.", m: "angry" },
    { s: "varg", t: "I know.", m: "sad" },
    { s: "grukka", t: "…But I'm done being angry at *you* first.", m: "sad" },
  ],
  B6: [
    { n: "Evening in {capital}. Varg has been busy. Where tents stood there are now timber halls, a stone-lined well, and a smithy." },
    { s: "grukka", t: "What's all this?", m: "angry" },
    { s: "varg", t: "Something Sigrun taught me. Dwarves don't just take a mountain. They dig in and stay. Cellars. Walls. Wells. Things you *keep*.", m: "bashful", req: { inGame: "dwarf" },
      alt: "Something I learned watching our enemies. They don't just take land. They dig in and stay. Cellars. Walls. Wells. Things you *keep*." },
    { s: "grukka", t: "Orcs don't keep, boy. Orcs take.", m: "defiant" },
    { s: "varg", t: "Then the next orc will take it from us. Unless we build something worth holding.", m: "bashful" },
    { n: "Grukka runs a scarred hand along the new timber wall. It's solid." },
    { s: "grukka", t: "Taking is easy. I've done it my whole life. …Show me how you keep it.", m: "happy" },
  ],

  // ---------------------------------------------------------------- first contact
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

  // ---------------------------------------------------------------- captures
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
  // ---------------------------------------------------------------- losses
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
  // ---------------------------------------------------------------- eliminations
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

  // ---------------------------------------------------------------- ultimates
  "ultimate:dwarf": [
    { n: "Orc scouts come howling back from the mountains. Something enormous is walking out of Karrak: a Runeforged Titan, a giant golem of rune-carved stone." },
    { s: "gnash", t: "Big stone man! Gnash smash big stone man! …Gnash smash *little bit* of big stone man.", m: "confused" },
    { s: "grukka", t: "Smash its feet, Gnash. Everything that walks has feet.", m: "defiant" },
  ],
  "ultimate:orc": [
    { n: "The Dragon Den, deep in the steaming heart of the bog. An enormous egg cracks, and a young Dragon unfolds its wings." },
    { s: "grukka", t: "Look at it. Four hundred years since the Clans flew a Dragon.", m: "defiant" },
    { s: "gnash", t: "Can Gnash ride it? Can Gnash pet it? Can Gnash— OW. Dragon bite Gnash. Dragon is GOOD dragon.", m: "happy" },
  ],
  "ultimate:human": [
    { n: "News from Westmarch: the Collegium has made its first Grand Magus, a wizard master of every discipline." },
    { s: "skarra", t: "A wizard with ALL the spells? Skarra has all the CURSES! We'll see whose are *louder*!", m: "gleeful" },
    { s: "grukka", t: "Everything bleeds, sister. Even wizards.", m: "defiant" },
  ],

  // ---------------------------------------------------------------- relics (§7)
  "relic:found:kurganos": [
    { n: "Orc delvers drag something out of a crumbling ruin, one of the old wardhouses from the days of the Accord: a crown that burns with fire, frost and lightning." },
    { s: "grukka", t: "Kurganos. The Crown of Elements. Our trophy from the only raid that ever broke the great gates of Karrak. Home again.", m: "happy" },
    { s: "skarra", t: "Give it to Skarra, brother! A crown for a witch! The ancestors *insist*!", m: "gleeful" },
    { s: "grukka", t: "The ancestors can insist all they like. It goes to our finest warrior.", m: "defiant" },
  ],
  "relic:news:kurganos": [
    { n: "A goblin scout splashes into {capital} with news: Kurganos, the Crown of Elements, has been found, and the Clans don't have it." },
    { s: "grukka", t: "Our crown. Our trophy from the only raid in history that ever broke the gates of Karrak.", m: "defiant" },
    { s: "gnash", t: "Gnash take crown back! Gnash wear crown! …Gnash head too big. Gnash wear crown on toe.", m: "confused" },
  ],
  "relic:found:agasou": [
    { n: "Orc warriors return from a ruin with a royal spear that shifts in the hand like a living thing: the Spear of Agasou, the first Warchief." },
    { s: "grukka", t: "Agasou's spear. The first Warchief. The Elves say he stole the druids' beast-shapes with it. The Clans say he *earned* them.", m: "defiant" },
    { s: "skarra", t: "The moss-haired crow will SCREAM when she hears! Oh, let Skarra tell her! PLEASE let Skarra tell her!", m: "gleeful" },
    { s: "vaelis", t: "*(in the Silverwood)* The orcs have the spear. Again. How very *tiresome*.", m: "aloof", req: { inGame: "elf" } },
  ],
  "relic:news:agasou": [
    { n: "News crosses the bog: the Spear of Agasou, the first Warchief's shapeshifting spear, has been found, and not by the Clans." },
    { s: "grukka", t: "Agasou's spear. Every Warchief since has sworn on it. I want it *back*.", m: "defiant" },
    { s: "skarra", t: "If the tree-folk have it, Skarra will curse every tree in the Silverwood until they give it back!", m: "angry", req: { holder: "elf" } },
  ],
  "relic:found:xorthalos": [
    { n: "Orc delvers bring back a shield forged from a single black-red scale: the Shield of Xorthalos, the first dragon." },
    { s: "skarra", t: "XORTHALOS! Give it to Skarra! It PROVES the ancestors chose HER, little Warchief! It PROVES it!", m: "gleeful" },
    { s: "grukka", t: "It proves somebody found a shield, Skarra.", m: "defiant" },
    { s: "gnash", t: "Shield is dragon? Gnash pet shield. …Shield not bite. Shield is *bad* dragon.", m: "confused" },
  ],
  "relic:news:xorthalos": [
    { n: "News crosses the bog: the Shield of Xorthalos, venerated by every Dragon Den in the Clans, has been found by another kingdom." },
    { s: "skarra", t: "THIEVES! That shield belongs to the Dragon Dens! It belongs to the ANCESTORS! It belongs to SKARRA!", m: "angry" },
    { s: "grukka", t: "It belongs to the Clans, sister. And the Clans will take it back.", m: "defiant" },
  ],
  "relic:found:mortedamos": [
    { n: "Orc delvers pull a black book out of a sealed vault, chained shut, whispering: Mortedamos' Malefic Manuscript, the grimoire of every curse." },
    { s: "skarra", t: "*(snatching it)* EVERY CURSE! Every curse in the Marches, and they're ALL SKARRA'S!", m: "gleeful" },
    { s: "grukka", t: "Skarra. Give me the book.", m: "angry" },
    { s: "skarra", t: "…No.", m: "gleeful" },
    { n: "For the next week, Skarra is *unbearable*." },
  ],
  "relic:news:mortedamos": [
    { n: "News crosses the bog: Mortedamos' Malefic Manuscript, the grimoire of every curse, has been found by another kingdom." },
    { s: "skarra", t: "SOMEONE ELSE has Skarra's book?! Skarra's CURSES?! Skarra will curse them with their own curses!", m: "angry" },
  ],
  "relic:news:mhorgrim": [
    { n: "News crosses the bog: Mhorgrim's Hunt, a dwarf rune-musket that calls a dire wolf, has been found." },
    { s: "varg", t: "The dwarves say the wolf was always theirs. The Clans say different. …Moss says nothing. Moss is asleep.", m: "bashful", req: { notFlag: "mossDead" },
      alt: "A musket that calls a wolf. …I had a wolf." },
  ],
  "relic:news:umbral_ring": [
    { n: "News crosses the bog: the Umbral Ring, a shadow-ring the Accord sealed away, has been found." },
    { s: "skarra", t: "The Umbral Ring! Skarra wants it! Skarra NEEDS it! …Skarra will explain why later!", m: "gleeful" },
    { s: "grukka", t: "No.", m: "defiant" },
  ],

  // ---------------------------------------------------------------- growth
  "capital-threat": [
    { n: "Enemy warriors stand within sight of {capital}. At the Speaking Stones, the standing stones are glowing red all by themselves." },
    { s: "grukka", t: "Every orc with an axe, to the stones. We hold here, or we're just a bog again.", m: "defiant" },
    { s: "gnash", t: "Gnash hold! Gnash VERY good at holding! Gnash hold cleaver *all day*!", m: "happy" },
  ],
  "found:6": [
    { n: "{city} rises, the Clans' sixth settlement. Orc banners now fly from the bog to the hills." },
    { s: "grukka", t: "Six towns. My grandmother had one bog.", m: "happy" },
    { s: "varg", t: "Six towns to *keep*, Father. That's the hard part.", m: "bashful", req: { notFlag: "mossDead" }, alt: "Six towns. Six places for them to hide from us." },
  ],
  "tech:tier3": [
    { n: "The Clans' shamans and smiths complete their first great advancement of the war." },
    { s: "skarra", t: "The ancestors taught it to Skarra! In a dream! …Also the smiths helped. A little.", m: "gleeful" },
    { s: "grukka", t: "The smiths did it, Skarra.", m: "defiant" },
  ],
  "built:war_camp": [
    { n: "In {city}, a War Camp rises: spikes, smoke and red banners. Warriors trained here march harder and strike first." },
    { s: "grukka", t: "Another camp. Good. Every orc a warrior.", m: "defiant" },
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
  "built:ancestral_dolmen": [
    { n: "In {city}, an Ancestral Dolmen is raised: a stone shrine that carries the voices of the Speaking Stones out to the rest of the Clans. When one orc falls near it, the others rise to avenge." },
    { s: "skarra", t: "The ancestors' voice, carried *farther*! Now EVERY orc can hear them scream! …And hear SKARRA.", m: "gleeful" },
    { s: "grukka", t: "That's what I was afraid of.", m: "defiant" },
  ],
  "trow:first": [
    { n: "Orc scouts report a strange figure near an old wardhouse ruin: the Treasure Trow, a hunched creature of the barrows, fiddling as it drags a sack of treasure." },
    { s: "gnash", t: "Little fiddle man has SACK! Gnash want sack!", m: "happy" },
    { s: "skarra", t: "The wards are failing, little Warchief! Every treasure the Accord locked up is walking out! And the ancestors say: *take it*!", m: "gleeful" },
    { s: "grukka", t: "The ancestors always say *take it*.", m: "defiant" },
  ],

  // ---------------------------------------------------------------- lovers (§5), from inside the Clans
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

  // ---------------------------------------------------------------- rival against rival
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
});
