/**
 * STORY SHARED -- RESCUES ACROSS ENEMY LINES (2026-09-26, user-directed)
 * -----------------------------------------------------------------------
 * Later in the war, once real combat and real distrust already exist
 * between two kingdoms, one side's signature character stumbles onto
 * someone from the OTHER side in real danger -- a monster, an accident,
 * nothing to do with the war itself -- and saves them anyway. The one
 * saved always asks why. The answer is always in character:
 *   Aldric (human)     -- honor
 *   Aelthir (elf)       -- compassion
 *   Sigrun (dwarf)      -- "it was the right thing to do"
 *   Varg (orc)          -- "we aren't all monsters"
 *   Hobby (halfellow)   -- "it was the right thing to do" (her own way of
 *                          saying it -- warmer and more mischievous than
 *                          Sigrun's blunt version, same conviction)
 *
 * Sigrun and Varg never appear opposite each other here (no "duel:dwarf:orc"
 * either, see shared-duels.js) -- deliberately, per user direction: those
 * two are already saving each other's whole story elsewhere (bible §13.9),
 * and a rescue between them would just repeat that thread instead of
 * standing on its own. Each of them still gets to rescue someone from every
 * OTHER kingdom.
 *
 * One scene per (rescuer, victim) ordered pair -- 18 in total, both
 * directions written for every pairing except dwarf/orc -- so whichever of
 * the two kingdoms the player leads, there's a scene for it: either "one of
 * mine was saved" or "mine did the saving". Keyed "rescue:<rescuer>:<victim>"
 * in STORY_SHARED.any. Queued by js/engine/story.js's pollState: at most one
 * rescue per game, only once the two kingdoms involved have actually
 * fought (same shape as the duel mechanic just above it in that file).
 *
 * The victim is never that kingdom's OWN rescue-thread character (Aldric
 * doesn't save a human, etc.) and, per bible §12's Vaelis rule, he gets a
 * reaction line in every scene where the Elves are on stage but he isn't
 * the one being saved or doing the saving.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SHARED = window.GameData.STORY_SHARED || {};
window.GameData.STORY_SHARED.any = window.GameData.STORY_SHARED.any || {};

Object.assign(window.GameData.STORY_SHARED.any, {
  // ================================================================ ALDRIC
  "rescue:human:elf": {
    when: { inGame: ["human", "elf"], alive: ["human", "elf"], charAlive: ["aldric", "vaelis"] },
    lines: [
      { n: "The border woods between Westmarch and the Silverwood, where the two armies' patrols cross most often. Lord Vaelis Nightbloom rides alone, well ahead of his own rangers, exactly as he prefers." },
      { n: "A Highland Griffin drops out of the canopy before he can draw his blade, talons raking his mount out from under him." },
      { s: "vaelis", t: "*(pinned, furious)* Get OFF—", m: "angry" },
      { n: "A Westmarch patrol breaks from the treeline. Lord-Paladin Aldric Ashcroft throws himself between the elf and the griffin's next strike, taking the blow on his shield." },
      { s: "aldric", t: "Hold still, my lord! The Dawn didn't bring me here to watch!", m: "fervent" },
      { n: "The griffin is driven off. Vaelis lies in the leaf-litter, splattered in his own blood, staring up at the human who has just saved his life." },
      { s: "vaelis", t: "*(hoarse)* …Why?", m: "sad" },
      { s: "aldric", t: "Because you were dying, my lord, and I could stop it. My honor doesn't ask who you are first.", m: "fervent" },
      { n: "Vaelis says nothing the whole ride back to his own lines. He tells his rangers a wolf did it." },
      { fx: { flag: "rescueHumanElf" } },
    ],
  },
  "rescue:human:dwarf": {
    when: { inGame: ["human", "dwarf"], alive: ["human", "dwarf"], charAlive: ["aldric", "kazra"] },
    lines: [
      { n: "The mountain passes above the human border, where Karrak's rune-lore says the old quarry veins still run. Kazra, Karrak's runesmith, works alone, reading the stone for signs of the Heartstone." },
      { n: "The ledge she stands on gives way without warning. She catches a root one-handed, boots scrabbling over open air." },
      { n: "A Westmarch patrol on the ridge above hears the rockfall. Lord-Paladin Aldric Ashcroft is down the slope with her wrist in his hand before his own knights catch up." },
      { s: "aldric", t: "I have you! Don't look down, just climb!", m: "fervent" },
      { n: "He hauls her onto solid stone. Kazra sits in the scree a long moment, breathing hard, saying nothing." },
      { s: "kazra", t: "…Why.", m: "focused" },
      { s: "aldric", t: "Because letting you fall would have cost me nothing, and saved nothing either. My honor doesn't work that way.", m: "fervent" },
      { n: "Kazra climbs back to Karrak without another word to him. She doesn't tell Brunna how she got the bruises." },
      { fx: { flag: "rescueHumanDwarf" } },
    ],
  },
  "rescue:human:orc": {
    when: { inGame: ["human", "orc"], alive: ["human", "orc"], charAlive: ["aldric", "gnash"] },
    lines: [
      { n: "The bog's edge nearest Westmarch, where the mud swallows anything that stands still too long. Gnash, the ogre called the Butcher of Bloodmire, has just smashed a Marsh Adder's den and is delighted about it." },
      { n: "The mud is not delighted. It closes over his legs to the waist, and the harder he thrashes, the deeper he sinks." },
      { s: "gnash", t: "Gnash smash den! Den smash Gnash back! Not fair rule!", m: "confused" },
      { n: "A Westmarch patrol finds him roaring at the swamp. Lord-Paladin Aldric Ashcroft wades in past his own knees and gets a shoulder under Gnash's arm." },
      { s: "aldric", t: "Stop fighting it! Let the bog THINK it's winning!", m: "fervent" },
      { n: "Between his strength and Gnash's, the ogre comes free with a sound like a boot pulled from soup." },
      { s: "gnash", t: "*(sitting in the mud, blinking)* …Why paladin pull Gnash out? Gnash enemy.", m: "confused" },
      { s: "aldric", t: "Because the Dawn doesn't let me choose who drowns, friend. Only whether I helped.", m: "fervent" },
      { n: "Gnash tells Skarra a very large, very confused story about a shining man and a bog, and never once mentions being frightened." },
      { fx: { flag: "rescueHumanOrc" } },
    ],
  },
  "rescue:human:halfellow": {
    when: { inGame: ["human", "halfellow"], alive: ["human", "halfellow"], charAlive: ["aldric", "goldie"] },
    lines: [
      { n: "The supply road into the Hearthlands, where Goldie Trickgrin drives a cart of ale kegs to trade for grain, war or no war. A Boar Sounder herd bursts from the hedgerow and spooks her horse." },
      { n: "The cart overturns into the ditch. Goldie is thrown clear, but a loose keg rolls downhill, straight toward her." },
      { s: "goldie", t: "*(pinned by the wheel)* Oh, for— someone STOP that—", m: "angry" },
      { n: "Lord-Paladin Aldric Ashcroft, riding the same road with his own escort, is off his horse before the keg reaches her, and takes it on his shoulder instead of her ribs." },
      { s: "aldric", t: "Mistress Trickgrin! Are you hurt?", m: "fervent" },
      { n: "Goldie stares up at the man who owes her pub four hundred silver, now kneeling in a ditch with a keg-shaped bruise coming in." },
      { s: "goldie", t: "*(shaken)* Why, Aldric? We're at *war*.", m: "sad" },
      { s: "aldric", t: "Because you're my friend before you're the Hearthlands, Goldie. My honor never asked me to stop believing that.", m: "fervent" },
      { n: "She doesn't charge him for the keg. It's the first thing on his tab in years she hasn't." },
      { fx: { flag: "rescueHumanHalfellow" } },
    ],
  },

  // =============================================================== AELTHIR
  "rescue:elf:human": {
    when: { inGame: ["elf", "human"], alive: ["elf", "human"], charAlive: ["aelthir", "maren"] },
    lines: [
      { n: "The human front line, where Queen Maren Ashcroft rides out herself to see the war she's fighting, against her council's advice. A swollen river breaks its bank as she crosses the ford." },
      { n: "Her horse loses its footing. The current takes them both, and the far bank is mud and roots, nothing to catch." },
      { s: "maren", t: "*(fighting the water)* Someone—", m: "resolute" },
      { n: "Roots break the surface ahead of her, weaving into a hand's shape and hauling her clear. Warden Aelthir stands on the bank, water streaming from his robes, older than the war itself." },
      { s: "aelthir", t: "Be still, Majesty. The river listens to me, if to no one else here.", m: "wistful" },
      { n: "Maren sits in the mud, coughing river water, staring at the Warden who once taught her great-great-grandmother her letters." },
      { s: "maren", t: "*(hoarse)* Why would you help me?", m: "sad" },
      { s: "aelthir", t: "Because I have known five of your line, and buried four. I find I have no compassion left over for watching a fifth drown.", m: "wistful" },
      { n: "She tells no one at court how she survived the ford. Only that the river, this once, let her go." },
      { fx: { flag: "rescueElfHuman" } },
    ],
  },
  "rescue:elf:dwarf": {
    when: { inGame: ["elf", "dwarf"], alive: ["elf", "dwarf"], charAlive: ["aelthir", "oskar"] },
    lines: [
      { n: "The edge of the Silverwood, where old dwarf boundary-stones still stand from before the Accord. Oskar, Karrak's Loremaster, has come to read the runes on one, alone, against his nephew's advice." },
      { n: "The stone is hollow. It gives way beneath him into a buried cairn, and the roof begins to come down." },
      { s: "oskar", t: "*(muffled, under falling earth)* …Of course it's a trap. Entry four thousand and one.", m: "grudging" },
      { n: "Ancient roots punch through the collapsing earth and hold the roof up like a second set of rafters. Warden Aelthir stands at the cairn's mouth, one hand still raised." },
      { s: "aelthir", t: "Come out while the forest still minds me, loremaster. It won't hold forever out of politeness.", m: "wistful" },
      { n: "Oskar climbs out coated in dust, and looks up at the ancient elf who watched his own ancestors quarry that stone." },
      { s: "oskar", t: "…Why.", m: "grudging" },
      { s: "aelthir", t: "Because I have read that cairn's runes myself, child, in a year you have no word for. It seemed unkind to let you die learning them badly.", m: "wistful" },
      { n: "Oskar opens a new page in the Book of Grudges. For once, it isn't a grudge." },
      { s: "vaelis", t: "*(to Aelthir, later)* You saved a dwarf. Personally. I hope the mud was at least clean.", m: "aloof", req: { charAlive: "vaelis" } },
      { fx: { flag: "rescueElfDwarf" } },
    ],
  },
  "rescue:elf:orc": {
    when: { inGame: ["elf", "orc"], alive: ["elf", "orc"], charAlive: ["aelthir", "skarra"] },
    lines: [
      { n: "The bog's edge nearest the Silverwood, where Skarra, the Bog Witch, has come alone to summon a Wisp for a working she'd rather her brother not know about." },
      { n: "The Wisp comes wrong: too many, too bright, circling her like a noose of cold fire her own wards can't break." },
      { s: "skarra", t: "*(cackling, panicked)* Destiny, if you have ANY ideas—", m: "confused" },
      { n: "Cold roots close around the Wisps and smother them dark. Warden Aelthir steps from the treeline, uncle to the very Archdruid Skarra has feuded with for eighty years." },
      { s: "aelthir", t: "Careless work, witch. The dead don't like being asked twice.", m: "wistful" },
      { s: "skarra", t: "*(catching her breath)* You. Your niece would let me drown for the smell of it. Why didn't you?", m: "gleeful" },
      { s: "aelthir", t: "Because Ysolde's quarrel is hers, not mine, and I've buried too many for one grudge to change my mind about a second.", m: "wistful" },
      { n: "Skarra tells the tale for a week, embellished worse each time, and never once mentions being frightened." },
      { s: "vaelis", t: "*(to Aelthir)* You saved Ironjaw's sister. Mother's oldest enemy. I have so many questions, and I've decided to ask none of them.", m: "aloof", req: { charAlive: "vaelis" } },
      { fx: { flag: "rescueElfOrc" } },
    ],
  },
  "rescue:elf:halfellow": {
    when: { inGame: ["elf", "halfellow"], alive: ["elf", "halfellow"], charAlive: ["aelthir", "barnaby"] },
    lines: [
      { n: "A ruin at the Silverwood's edge, one of the old wardhouses the Hearthlands Archive has mapped but never entered. Professor Barnaby, cataloguing it alone, has just found out why no one enters it." },
      { n: "Something ancient and armored stirs in the rubble at the sound of his footsteps." },
      { s: "barnaby", t: "*(backing away, notes clutched to his chest)* Oh dear. Oh, this is NOT in my notes—", m: "flustered" },
      { n: "The ruin's own stones seem to lean away from the thing, roots and ivy hauling it down into the earth. Warden Aelthir steps from between two trees that were not, a moment ago, a path." },
      { s: "aelthir", t: "This place remembers me, historian, better than it remembers you. Come away from it.", m: "wistful" },
      { n: "Barnaby stares at the living witness to the very history he only ever reads about." },
      { s: "barnaby", t: "*(breathless)* Why save me, my lord? I've written unkind things about elves in Volume Four.", m: "flustered" },
      { s: "aelthir", t: "Because a scholar's unkind footnote has never once been worth a scholar's life, in any of the centuries I've read them.", m: "wistful" },
      { n: "Barnaby spends that evening rewriting Volume Four from the very first page." },
      { s: "vaelis", t: "*(to Aelthir)* An archivist. You saved an *archivist*. Did he at least thank you in footnotes?", m: "aloof", req: { charAlive: "vaelis" } },
      { fx: { flag: "rescueElfHalfellow" } },
    ],
  },

  // ================================================================ SIGRUN
  "rescue:dwarf:human": {
    when: { inGame: ["dwarf", "human"], alive: ["dwarf", "human"], charAlive: ["sigrun", "corvin"] },
    lines: [
      { n: "The mountain border, where the ground has shivered ever since the Marchstone split. Archmage Corvin Varro has come to measure the tremors himself, closer to Karrak's tunnels than any human usually gets." },
      { n: "The ground he's standing on isn't ground. It's a sinkhole waiting for one more footstep, and his is it." },
      { s: "corvin", t: "*(sliding)* That's- that's not ideal-", m: "wry" },
      { n: "An axe shaped like a guitar catches his collar and hauls him back over the lip. Sigrun, Karrak's Metal Singer, was testing a new riff on the ridge above and heard the ground go." },
      { s: "sigrun", t: "GOT you! Nearly lost a wizard down a hole, that would've been a TERRIBLE song!", m: "fierce" },
      { n: "Corvin sits on solid rock, adjusting his robes, doing the one thing he always does when he doesn't understand something." },
      { s: "corvin", t: "Why? I'm the enemy's own Archmage. Pull the thread on that and it should stop making sense.", m: "wry" },
      { s: "sigrun", t: "Didn't pull a thread, pulled a WIZARD. Wasn't a puzzle, Archmage. It was just right.", m: "fierce" },
      { n: "Corvin writes three pages on it that night, and reaches no conclusion he's willing to sign his name to." },
      { fx: { flag: "rescueDwarfHuman" } },
    ],
  },
  "rescue:dwarf:elf": {
    when: { inGame: ["dwarf", "elf"], alive: ["dwarf", "elf"], charAlive: ["sigrun", "ysolde"] },
    lines: [
      { n: "The dwarf foothills, farther from the Silverwood than any elf usually walks. Archdruid Ysolde followed what the roots told her this far, and the roots did not mention the mine shaft." },
      { n: "The old shaft's timber gives way under her weight. She falls further than any fall should be survivable." },
      { n: "Sigrun, Karrak's Metal Singer, is down the shaft on a rope before her own kin finish shouting for one, hauling the Archdruid up across her shoulders like a sack of ore." },
      { s: "sigrun", t: "Easy, easy- you're not dead, you're just VERY dusty!", m: "fierce" },
      { n: "Ysolde looks up at her rescuer with the same serene attention she gives a river, or a stubborn root." },
      { s: "ysolde", t: "…Why does an enemy climb down a hole for me?", m: "uncanny" },
      { s: "sigrun", t: "Because it was the right thing to do. Didn't need a better reason than that, and still don't.", m: "fierce" },
      { n: "Ysolde tells the trees about it that night. They find it interesting, she says." },
      { s: "vaelis", t: "Mother. A *dwarf* pulled you out of the ground. I don't know whether to be grateful or mortified.", m: "aloof", req: { charAlive: "vaelis" } },
      { fx: { flag: "rescueDwarfElf" } },
    ],
  },
  "rescue:dwarf:halfellow": {
    when: { inGame: ["dwarf", "halfellow"], alive: ["dwarf", "halfellow"], charAlive: ["sigrun", "goldie"] },
    lines: [
      { n: "A border track into the Hearthlands, closer to Karrak than Goldie Trickgrin usually delivers her ale. A Frost Lynx, starved and bold this deep in the war, corners her wagon against a rock face." },
      { s: "goldie", t: "*(backing up slowly)* Nice cat. Terrible cat. Go AWAY, cat—", m: "angry" },
      { n: "The lynx doesn't hear the axe-guitar coming until it's already between them, ringing a chord loud enough to shake snow off the rocks. It flees." },
      { s: "sigrun", t: "THAT'S how you clear a road! You alright, innkeep?", m: "fierce" },
      { n: "Goldie steadies herself on a barrel, staring at the dwarf who by rights should be on the other side of a battle line." },
      { s: "goldie", t: "Why help me, love? Your Thane and my Mayor aren't exactly sharing a drink these days.", m: "sad" },
      { s: "sigrun", t: "Because it was the right thing to do. Wasn't gonna let a good cask of ale get eaten by a cat, either.", m: "fierce" },
      { n: "Goldie sends a barrel to Karrak by a roundabout trader's route. No note. Sigrun drinks to her anyway." },
      { fx: { flag: "rescueDwarfHalfellow" } },
    ],
  },

  // =================================================================== VARG
  "rescue:orc:human": {
    when: { inGame: ["orc", "human"], alive: ["orc", "human"], charAlive: ["varg", "maren"] },
    lines: [
      { n: "The front line nearest the Bloodmire, where the war between Westmarch and the Clans has cost the most blood. Queen Maren Ashcroft rides to inspect her own troops, closer to the bog than her guard likes." },
      { n: "A Basilisk breaks from the reeds before anyone sees it coming, and her horse rears too late." },
      { s: "maren", t: "*(thrown, drawing a blade she barely knows how to use)* Guards! To me!", m: "resolute" },
      { n: "A grey dire wolf hits the Basilisk broadside before her own knights arrive. Varg, the Warchief's son, is off its back and between the Queen and the creature in the same motion." },
      { s: "varg", t: "Stay down, don't look it in the eyes!", m: "happy" },
      { n: "The Basilisk flees into the reeds. Maren gets to her feet, staring at the orc who just saved her life." },
      { s: "maren", t: "*(steady, but pale)* You're Grukka's son. Why would you save me?", m: "resolute" },
      { s: "varg", t: "Because we aren't all monsters, Majesty. Whatever Westmarch has been told. I couldn't watch that happen and just ride on.", m: "happy" },
      { n: "Maren says nothing of it to Aldric. She isn't ready to explain, even to herself, why she believes him.", req: { charAlive: "aldric" } },
      { fx: { flag: "rescueOrcHuman" } },
    ],
  },
  "rescue:orc:elf": {
    when: { inGame: ["orc", "elf"], alive: ["orc", "elf"], charAlive: ["varg", "vaelis"] },
    lines: [
      { n: "The forest's edge, where the Bloodmire's raiders and the Silverwood's rangers cross blades more than anywhere else in the Marches. Lord Vaelis Nightbloom, scouting alone as always, doesn't see the Dire Spider drop behind him." },
      { n: "Its bite catches his shoulder before he can turn. His own blade falls from a hand gone suddenly numb." },
      { s: "vaelis", t: "*(staggering)* That's- unusually rude, even for vermin-", m: "aloof" },
      { n: "A dire wolf slams the spider aside. Varg is down off Moss's back with a blade in the creature's flank before Vaelis's knees fully buckle." },
      { s: "varg", t: "Hold still! The venom passes if you don't fight it!", m: "happy" },
      { n: "Vaelis sits in the leaf-litter, numb to the shoulder, staring at the orc who has clearly just saved his six-hundred-year-old life." },
      { s: "vaelis", t: "*(slurred)* …Why. I have called your people vermin to your face.", m: "sad" },
      { s: "varg", t: "Because we aren't all monsters. Even the ones you've decided are.", m: "happy" },
      { n: "Vaelis says nothing of this to his great-uncle for a long time. When he finally does, he leaves out exactly whose venom it was.", req: { charAlive: "aelthir" } },
      { fx: { flag: "rescueOrcElf" } },
    ],
  },
  "rescue:orc:halfellow": {
    when: { inGame: ["orc", "halfellow"], alive: ["orc", "halfellow"], charAlive: ["varg", "barnaby"] },
    lines: [
      { n: "A ruin near the Bloodmire border, older than the Accord itself, which the Hearthlands Archive has never dared send anyone to map. Professor Barnaby has dared anyway, and now regrets it deeply." },
      { n: "Something with too many legs unfolds itself from the ruin's shadow, and Barnaby's notes scatter as he backs into a wall." },
      { s: "barnaby", t: "*(flattened against stone)* This was NOT in the Society's survey! I shall be filing a COMPLAINT—", m: "flustered" },
      { n: "A dire wolf's howl turns the creature's attention just long enough. Varg drags Barnaby clear by the collar of his coat, Moss snapping at the thing's legs." },
      { s: "varg", t: "Run first, complain later! I'll hold it!", m: "happy" },
      { n: "Between them they escape the ruin. Barnaby sits against a tree, clutching his scattered notes, staring at the orc catching his breath beside him." },
      { s: "barnaby", t: "*(shaking)* Why would you help me, of all people? I've catalogued your people as *raiders*, in triplicate.", m: "flustered" },
      { s: "varg", t: "Because we aren't all monsters, Professor. Not even the ones your Archive's written down as one.", m: "happy" },
      { n: "Barnaby adds a footnote to Volume Four that night. It is the first kind thing the Archive has ever said about the Bloodmire." },
      { fx: { flag: "rescueOrcHalfellow" } },
    ],
  },

  // ================================================================= HOBBY
  "rescue:halfellow:human": {
    when: { inGame: ["halfellow", "human"], alive: ["halfellow", "human"], charAlive: ["hobby", "corvin"] },
    lines: [
      { n: "A hedgerow near the Hearthlands border, where Archmage Corvin Varro has come to test a spell somewhere his own Collegium can't see it go wrong. It goes wrong." },
      { n: "The spell folds back on itself and catches the hedge alight around him, faster than he can step clear." },
      { s: "corvin", t: "*(coughing)* That's- new. That's a new failure mode-", m: "wry" },
      { n: "A little plan already in motion for entirely unrelated reasons turns out to involve a rain barrel. Mayor Hobby Trickgrin tips it straight over the Archmage and the fire both." },
      { s: "hobby", t: "There! Sorted. Are you on FIRE often, dear, or is today special?", m: "scheming" },
      { n: "Corvin sits soaked and singed in the ash of his own experiment, staring at the halfellow who just put him out." },
      { s: "corvin", t: "Why help me? I'm a rather important enemy asset, Mayor.", m: "wry" },
      { s: "hobby", t: "Because it was the right thing to do, dear. Wasn't really a choice, once you were on fire in my hedge.", m: "scheming" },
      { n: "Corvin cannot find a flaw in that logic, which bothers him far more than the singed eyebrows do." },
      { fx: { flag: "rescueHalfellowHuman" } },
    ],
  },
  "rescue:halfellow:elf": {
    when: { inGame: ["halfellow", "elf"], alive: ["halfellow", "elf"], charAlive: ["hobby", "ysolde"] },
    lines: [
      { n: "The hedgerows along the Silverwood border, thick with halfellow snares meant for orc raiders. Archdruid Ysolde, walking where the roots led her, doesn't recognize one until it's closed around her ankle." },
      { n: "She hangs upside down from an old oak, entirely serene about it, which is more than can be said for the oak." },
      { s: "ysolde", t: "*(calmly, inverted)* The tree apologizes. It says the rope isn't its idea.", m: "uncanny" },
      { n: "Mayor Hobby Trickgrin, checking her own militia's snares, finds an Archdruid instead of a boar and cuts her down with her belt-knife before asking a single question." },
      { s: "hobby", t: "Sorry about that, dear! Wrong sort of catch entirely.", m: "scheming" },
      { n: "Ysolde rights herself with great dignity and considers the halfellow who just freed an enemy from her own kingdom's trap." },
      { s: "ysolde", t: "…Why cut the rope, Mayor? Your snares are meant for people like me.", m: "uncanny" },
      { s: "hobby", t: "Because it was the right thing to do, dear. Can't very well leave an Archdruid dangling, war or no war.", m: "scheming" },
      { n: "Ysolde tells the oak it was right to apologize after all." },
      { s: "vaelis", t: "Mother. Hobby Trickgrin. Of every halfellow in the Hearthlands, *her*. I refuse to discuss this further.", m: "aloof", req: { charAlive: "vaelis" } },
      { fx: { flag: "rescueHalfellowElf" } },
    ],
  },
  "rescue:halfellow:dwarf": {
    when: { inGame: ["halfellow", "dwarf"], alive: ["halfellow", "dwarf"], charAlive: ["hobby", "brunna"] },
    lines: [
      { n: "A border quarry between Karrak and the Hearthlands, where High Thane Brunna has come to inspect stone for a wall he hasn't announced yet. The quarry face chooses that moment to give way." },
      { n: "He's buried to the waist before the dust settles, one arm pinned under rubble he can't shift alone." },
      { s: "brunna", t: "*(grim, not calling for help)* …Walls first. Should've remembered that applies to quarries too.", m: "proud" },
      { n: "Mayor Hobby Trickgrin, out checking a militia post nearby, hears the rockfall and comes running with two farmhands and a length of rope." },
      { s: "hobby", t: "Hold on, Thane! We'll have you out before the dust even settles properly!", m: "scheming" },
      { n: "Between the three of them, and a lot of complaining from the rope, Brunna comes free, filthy and furious at his own carelessness." },
      { s: "brunna", t: "*(catching his breath)* Why, Mayor. We haven't shared a barrel since the duel.", m: "sad" },
      { s: "hobby", t: "Because it was the right thing to do, dear. A barrel's a barrel. This was just a Thane.", m: "scheming" },
      { n: "Brunna sends a cask of Karrak's own to The Goose & Kettle that winter. No note is needed; Hobby already knows exactly who it's from." },
      { fx: { flag: "rescueHalfellowDwarf" } },
    ],
  },
  "rescue:halfellow:orc": {
    when: { inGame: ["halfellow", "orc"], alive: ["halfellow", "orc"], charAlive: ["hobby", "grukka"] },
    lines: [
      { n: "The hedges nearest the Bloodmire, ground both the Clans and the Hearthlands have bled over for years. Warchief Grukka Ironjaw hunts alone, as he always has, and doesn't see the Boar Sounder herd until it's already charging." },
      { n: "One boar catches his leg before he can set his stance. He goes down hard, and the rest of the herd doesn't slow." },
      { s: "grukka", t: "*(down, drawing his axe anyway)* Come on, then. All of you.", m: "defiant" },
      { n: "A militia horn scatters the herd before the axe is needed. Mayor Hobby Trickgrin arrives at a dead run, a very undignified pitchfork in hand." },
      { s: "hobby", t: "Warchief! Don't you DARE die on Hearthlands ground, I'll never hear the end of it!", m: "scheming" },
      { n: "Grukka lets her bind the leg, too winded to argue, and considers the Mayor who fought him and Gnash both to a draw and a duel." },
      { s: "grukka", t: "*(through his teeth)* Why, halfling. After the duel. After the geese. Why THIS?", m: "angry" },
      { s: "hobby", t: "Because it was the right thing to do, dear. Even for you. Especially for you, honestly.", m: "scheming" },
      { n: "Grukka says nothing to his clans about it. But the next Hearthlands raid he plans leaves an escape route open, and everyone who fought it wonders why." },
      { fx: { flag: "rescueHalfellowOrc" } },
    ],
  },
});
