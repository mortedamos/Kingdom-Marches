/**
 * STORY SHARED -- DUELS OF HONOUR (2026-09-26, user-directed)
 * ------------------------------------------------------------
 * Later in the war (after the arc's midpoint, B4), a kingdom's champion
 * challenges another's to single combat to end the war. The fight is tense,
 * both are hurt, and neither wins: something different stops each pairing.
 * The results are messy, and the war goes on, worse than before.
 *
 * One scene per pairing of the five martial characters: Aldric (Westmarch),
 * Vaelis (the Silverwood), Brunna (Karrak), Grukka (the Bloodmire) and Hobby
 * (the Hearthlands). Keyed "duel:<race>:<race>", races in alphabetical
 * order, in STORY_SHARED.any so it plays for whichever of the two kingdoms
 * the player leads. Queued by js/engine/story.js pollState: each champion duels only once,
 * and the player's champion is in every duel, so at most one per game.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SHARED = window.GameData.STORY_SHARED || {};
window.GameData.STORY_SHARED.any = window.GameData.STORY_SHARED.any || {};

Object.assign(window.GameData.STORY_SHARED.any, {
  // ------------------------------------------------ Aldric vs Grukka
  "duel:human:orc": {
    when: { inGame: ["human", "orc"], alive: ["human", "orc"], charAlive: ["aldric", "grukka"] },
    lines: [
      { n: "A herald rides into the Bloodmire under a white flag, carrying a challenge from the Lord-Paladin of Westmarch: single combat with the Warchief, at the old parley ground, to end the war between their peoples." },
      { s: "grukka", t: "The Lord-Paladin. At the parley ground. Under a white flag. …I accept. Tell him to keep his sword in its sheath until we start. Last time, his was out before anyone said a word.", m: "defiant" },
      { s: "aldric", t: "*(at the parley ground)* Warchief. One of us walks away, and the war walks away with him. On my oath before the Dawn.", m: "fervent" },
      { s: "grukka", t: "Your oath. We'll see what that's worth this time, paladin.", m: "angry" },
      { n: "They fight for most of an hour: axe against sword, the Warchief's strength against the paladin's steel. Aldric takes a blow that splits his shield; Grukka takes a cut across the ribs that should have dropped him." },
      { n: "Then the ground shakes. The Marchstone, far away, shudders in its roots, exactly as it did on the day of the Last Parley." },
      { n: "Both men freeze. Behind them, both armies see their leader hesitate, and both are sure it's an ambush. Someone draws. Then everyone does." },
      { s: "aldric", t: "*(bleeding, shouting over the melee)* HOLD! Hold, in the Dawn's name! It's the stone, not them!", m: "angry" },
      { s: "grukka", t: "*(dragging a wounded rider out of the mud)* Tell it to your knights, paladin! They didn't wait to ask!", m: "angry" },
      { n: "By nightfall, both sides have buried more dead than a month of war would have cost. Neither leader won. Both kingdoms are sure the other one cheated, again." },
      { fx: { flag: "duelHumanOrc" } },
    ],
  },

  // ------------------------------------------------ Aldric vs Vaelis
  "duel:elf:human": {
    when: { inGame: ["elf", "human"], alive: ["elf", "human"], charAlive: ["aldric", "vaelis"] },
    lines: [
      { n: "Lord Vaelis Nightbloom sends Westmarch a single silver leaf, written on in a flawless hand: he will meet the Lord-Paladin's *famous* sword at the forest's edge, at dawn, if the man insists on being tiresome." },
      { s: "aldric", t: "At dawn. He chose *dawn*. Archmage, the man is either very brave or very foolish.", m: "fervent" },
      { s: "corvin", t: "He's six hundred years old, Lord-Paladin. It's possible to be both.", m: "wry", req: { charAlive: "corvin" } },
      { s: "vaelis", t: "*(at the forest's edge)* Do try to be quick. I have a great many centuries left, and I should hate to spend another morning of them on you.", m: "aloof" },
      { n: "Vaelis is a blur of mythril and shadow; Aldric is a wall. For long minutes neither lands a blow. Then the elf's blade opens Aldric's cheek, and the paladin's shield-rim cracks two of Vaelis's ribs." },
      { n: "The sun clears the hills behind Aldric. For one breath, Vaelis is fighting straight into the Dawn, and his guard falters. Aldric's sword stops at his throat." },
      { s: "aldric", t: "Yield, my lord. The Dawn has spoken for me.", m: "fervent" },
      { n: "The forest answers first. Silver roots burst from the earth and wrap both men to the knees, then the waist, dragging them apart. Somewhere in the trees, an Archdruid's voice is very calm." },
      { s: "ysolde", t: "*(unseen)* Neither of you will die at my forest's edge this morning. The trees have decided.", m: "uncanny", req: { charAlive: "ysolde" } },
      { s: "vaelis", t: "*(furious, trapped)* Mother. You have made me look *ridiculous*.", m: "angry" },
      { n: "The Temple proclaims a miracle of the Dawn. The Silverwood calls it a mortal's cheap trick with the sun. Both courts are insulted, and the war at the forest's edge grows crueller by the week." },
      { fx: { flag: "duelElfHuman" } },
    ],
  },

  // ------------------------------------------------ Aldric vs Brunna
  "duel:dwarf:human": {
    when: { inGame: ["dwarf", "human"], alive: ["dwarf", "human"], charAlive: ["aldric", "brunna"] },
    lines: [
      { n: "The High Thane of Karrak challenges Westmarch's Lord-Paladin to single combat on the old border stones, to settle the war and the Cathedral debt with it." },
      { s: "brunna", t: "Win, and the debt's forgiven. Lose, and Westmarch pays it in full, with every year's interest. Walls first, paladin. Then talk. Then this.", m: "proud" },
      { s: "aldric", t: "I accept, Thane. And whatever happens, the Temple will honour it. I swear it.", m: "fervent" },
      { s: "oskar", t: "*(writing)* The terms of the duel. Entry four thousand and— never mind. I'll number it later.", m: "grudging", req: { charAlive: "oskar" } },
      { n: "Hammer against sword on the border stones. Brunna fights like a landslide; Aldric like a man who has never once considered stepping back. Her hammer cracks his breastplate. His sword opens her arm to the bone." },
      { n: "Then the ground beneath the border stones gives way. Underneath runs an old Underway tunnel, forgotten for a thousand years, and both of them fall into the dark." },
      { n: "Their armies spend two days digging. Each is certain the other side dug the pit." },
      { s: "brunna", t: "*(hauled out, filthy, bleeding)* Two days in the dark with a paladin. He *prayed*. The whole time. Out loud.", m: "angry" },
      { s: "aldric", t: "*(hauled out, pale)* She *sang*, sister. Mining songs. The whole time. Out loud.", m: "angry" },
      { n: "Neither of them won. Karrak calls the collapse Westmarch's treachery; Westmarch calls it a dwarf trap. The debt is still unpaid, and now it has a grudge attached." },
      { fx: { flag: "duelDwarfHuman" } },
    ],
  },

  // ------------------------------------------------ Aldric vs Hobby
  "duel:halfellow:human": {
    when: { inGame: ["halfellow", "human"], alive: ["halfellow", "human"], charAlive: ["aldric", "hobby"] },
    lines: [
      { n: "Mayor Hobby Trickgrin challenges the Lord-Paladin of Westmarch to a duel of honour, in the meadow outside The Goose & Kettle. She brings a rapier and a sling. She promises, in writing, no tricks." },
      { s: "aldric", t: "A duel, Mayor? You come up to my *belt*.", m: "sad" },
      { s: "hobby", t: "Then I'll aim for the belt, dear. It's where you keep the tab money.", m: "scheming" },
      { n: "It is not a joke for long. Hobby is fast, and low, and everywhere; Aldric can't find her with his sword. A sling-stone rings off his helm; her rapier finds the gap at his knee. He catches her with the flat of his shield, and she goes down hard and gets up bleeding." },
      { n: "Then the door of The Goose & Kettle bangs open, and Goldie Trickgrin marches across the meadow with a ladle in her hand and her apron still on." },
      { s: "goldie", t: "STOP IT. Both of you. *Now*.", m: "angry", req: { charAlive: "goldie" }, alt: { s: "barnaby", t: "*(running onto the field, waving a book)* STOP! Both of you! This is *not* in the Accord's rules of honour! I have the page!", m: "flustered" } },
      { s: "goldie", t: "You great tin fool. My sister. You'd put a sword in my *sister*? And you, Hobby Trickgrin, you promised me no more of *this*.", m: "angry", req: { charAlive: "goldie" } },
      { n: "Aldric's knights rush forward to protect him from the ladle. The militia rush forward to protect Goldie from the knights. The meadow becomes a brawl, then a battle." },
      { s: "hobby", t: "*(holding her side)* Well. That went *extremely* badly.", m: "sad" },
      { s: "aldric", t: "*(to no one)* I would never have struck her. I would never have—", m: "sad" },
      { n: "Nobody won. The Goose & Kettle has a broken window and three dead on its doorstep, and the Hearthlands will never believe Westmarch came in good faith." },
      { fx: { flag: "duelHalfellowHuman" } },
    ],
  },

  // ------------------------------------------------ Grukka vs Vaelis
  "duel:elf:orc": {
    when: { inGame: ["elf", "orc"], alive: ["elf", "orc"], charAlive: ["grukka", "vaelis"] },
    lines: [
      { n: "Warchief Grukka Ironjaw walks alone to the forest's edge and shouts a challenge into the trees: one champion of the Silverwood, against him, for the war." },
      { s: "vaelis", t: "*(from a branch above him)* How loud. I accept. It will be a short lesson.", m: "aloof" },
      { s: "grukka", t: "Get down here, elf. And learn my name first. I want you to know who beat you.", m: "defiant" },
      { s: "vaelis", t: "I really don't think I shall.", m: "aloof" },
      { n: "The elf is faster than anything Grukka has ever fought; the Warchief is harder than anything Vaelis has ever cut. Blood runs down the orc's arm from a dozen shallow cuts. Then Grukka's axe-haft catches Vaelis across the chest, and the heir of the Silverwood goes down in the mud." },
      { n: "On opposite sides of the clearing, two witches have been watching. Each has been quietly helping her own champion. Neither has told anyone." },
      { s: "skarra", t: "*(from the reeds)* Oh, NO, you don't, moss-crow—", m: "angry", req: { charAlive: "skarra" } },
      { s: "ysolde", t: "*(from the trees)* Bog-witch. Take your hand off my son's fight.", m: "angry", req: { charAlive: "ysolde" } },
      { n: "A curse and a blessing collide over the duel ground. The blast throws both champions across the clearing and sets the forest's edge alight." },
      { s: "grukka", t: "*(getting up, singed)* SKARRA. I said *alone*.", m: "angry" },
      { s: "vaelis", t: "*(getting up, singed, his mythril blackened)* …I shall remember this. Not your name. *This*.", m: "angry" },
      { n: "The fire burns three groves before the rain comes. The Silverwood calls it orc treachery; the Clans call it elf witchcraft. Nobody won, and the feud between the witches is worse than ever." },
      { fx: { flag: "duelElfOrc" } },
    ],
  },

  // ------------------------------------------------ Grukka vs Brunna
  "duel:dwarf:orc": {
    when: { inGame: ["dwarf", "orc"], alive: ["dwarf", "orc"], charAlive: ["grukka", "brunna"] },
    lines: [
      { n: "The High Thane of Karrak and the Warchief of the Bloodmire meet on the eastern ridge where the Mountain Wars began, four hundred years ago. One fight, to finish Volume Seven." },
      { s: "brunna", t: "Four hundred years, Warchief. It ends today, one way or the other.", m: "proud" },
      { s: "grukka", t: "That's what your great-grandmother said to mine, Thane. Let's see if we're any smarter.", m: "defiant" },
      { n: "Hammer against axe. It is the most brutal fight either army has ever seen. Brunna's hammer breaks the Warchief's jaw-plate; Grukka's axe bites through the Thane's pauldron. Both are on their knees, and both get up." },
      { n: "Then two figures break from opposite lines and run into the circle: a young dwarf with copper braids, and a young orc on a grey dire wolf. They stand between their parents, back to back, as if they had practised it." },
      { s: "sigrun", t: "Mother. Stop. *Please*.", m: "sad", req: { charAlive: "sigrun" } },
      { s: "varg", t: "Father. Put it down. I'm asking you. I've never asked you for anything.", m: "sad", req: { charAlive: "varg" } },
      { s: "brunna", t: "*(breathing hard, staring at the orc boy)* …Sigrun. Why is he standing at your back?", m: "angry" },
      { s: "grukka", t: "*(staring at the dwarf girl)* …Boy. Why does she know your name?", m: "angry" },
      { n: "Neither child answers. Both armies are shouting now. The duel is over, and nobody knows who won, and both parents walk away with a question they are afraid to ask again." },
      { s: "oskar", t: "*(in Karrak, that night)* I've opened a new page, Thane. It has no heading. I don't know what to call it.", m: "sad", req: { charAlive: "oskar" } },
      { fx: { flag: "duelDwarfOrc" } },
    ],
  },

  // ------------------------------------------------ Grukka vs Hobby
  "duel:halfellow:orc": {
    when: { inGame: ["halfellow", "orc"], alive: ["halfellow", "orc"], charAlive: ["grukka", "hobby"] },
    lines: [
      { n: "Forty years after the Goose Rout, Mayor Hobby Trickgrin challenges the Warchief of the Bloodmire to single combat. Grukka accepts at once, on one condition: no geese." },
      { s: "hobby", t: "No geese. On my honour as Mayor. Not a single one.", m: "scheming" },
      { s: "grukka", t: "Swear it on something you actually care about.", m: "defiant" },
      { s: "hobby", t: "…On Goldie's pies.", m: "sad" },
      { s: "grukka", t: "Good enough.", m: "defiant" },
      { n: "The fight is ugly. Grukka is twice her height and five times her weight; Hobby is quicker than any orc alive. She opens his thigh with her rapier. He catches her once with the back of his hand, and she flies ten feet and lies still for a long, terrible moment, then gets up." },
      { n: "And then, from the Hearthlands side of the field, come the geese. Dozens of them. Honking, furious, loose from a farmyard pen that somebody, in all the excitement, has left open." },
      { s: "gnash", t: "*(from the orc lines)* GEESE. GEESE! GNASH SAID NO GEESE!", m: "confused", req: { charAlive: "gnash" } },
      { n: "Gnash panics, and flees straight through the duel ring. The orc lines break around him. The halfellows cheer. Everyone is fighting, and nobody is fighting the right person." },
      { s: "grukka", t: "*(limping, furious)* You *swore*, halfling. On the pies.", m: "angry" },
      { s: "hobby", t: "*(bleeding, just as furious)* I didn't let them out! Somebody left a GATE open! …I think it was one of *yours*.", m: "angry" },
      { n: "Nobody won. The Clans call it the Second Goose Rout and swear revenge for it; the Hearthlands swear Hobby kept her word. Raids along the hedges double by the end of the month." },
      { fx: { flag: "duelHalfellowOrc" } },
    ],
  },

  // ------------------------------------------------ Brunna vs Vaelis
  "duel:dwarf:elf": {
    when: { inGame: ["dwarf", "elf"], alive: ["dwarf", "elf"], charAlive: ["brunna", "vaelis"] },
    lines: [
      { n: "Lord Vaelis Nightbloom offers the High Thane of Karrak a duel at the split Marchstone itself, to settle the Rootcut and the war at once. Brunna accepts before her council can argue." },
      { s: "brunna", t: "Eight hundred years you've blamed us for that grove. Let's see you prove it.", m: "angry" },
      { s: "vaelis", t: "I am not here to prove anything, mud-thane. I am here to be *done* with you.", m: "aloof" },
      { n: "They fight in the shadow of the split stone. Vaelis's blade finds every gap in the Thane's armour; Brunna's hammer finds nothing but air, until it doesn't. One blow shatters the elf's mythril vambrace and his forearm under it." },
      { n: "Vaelis staggers back against the Marchstone. Brunna's hammer comes down, misses him by an inch, and strikes the stone." },
      { n: "The Marchstone cracks further, a new fissure running from the old split, and light pours out of it, gold and blinding. Both duellists are thrown to the ground." },
      { s: "stone", t: "NOT LIKE THIS." },
      { s: "vaelis", t: "*(dazed, clutching his arm)* …It spoke. To *us*.", m: "sad" },
      { s: "brunna", t: "*(dazed, on her back)* I cracked it. Our own Heartstone. I cracked it.", m: "sad" },
      { n: "Karrak says the stone chose Karrak; the Silverwood says it rebuked the dwarves. Nobody won. The stone is more broken than it was, and both kingdoms blame the other for that too." },
      { fx: { flag: "duelDwarfElf" } },
    ],
  },

  // ------------------------------------------------ Vaelis vs Hobby
  "duel:elf:halfellow": {
    when: { inGame: ["elf", "halfellow"], alive: ["elf", "halfellow"], charAlive: ["vaelis", "hobby"] },
    lines: [
      { n: "After forty years of geese, pies and pranks, Mayor Hobby Trickgrin finally challenges Lord Vaelis Nightbloom to a proper duel. He accepts at once. It is the most animated anyone has ever seen him." },
      { s: "vaelis", t: "Forty years I have waited for you to face me *honestly*, Trickgrin. No geese. No honey in my tent. No tricks.", m: "angry" },
      { s: "hobby", t: "No tricks, dear. Just you and me. I swore it in front of the whole Moot.", m: "happy" },
      { n: "It is a real duel, and it is close. Vaelis is faster; Hobby is lower, and cleverer, and utterly without fear. His blade opens her shoulder. Her rapier opens his cheek, the first mark anyone has ever put on that face." },
      { n: "Then the ground under both of them drops a foot. A snare-pit, dug the night before by halfellow militia who did not trust the Lord of the Shadowsteeds to fight fair, and did not tell their Mayor." },
      { s: "vaelis", t: "*(in the pit, in the mud, his mythril ruined)* *NO TRICKS*, she says.", m: "angry" },
      { s: "hobby", t: "*(in the pit beside him)* I didn't— this wasn't *me*— who dug this? WHO DUG THIS?", m: "angry" },
      { n: "Nobody will admit to it. Vaelis is hauled out by his rangers, shaking with a fury none of them have ever seen. Hobby is hauled out by her militia, and does not speak to any of them for a week." },
      { s: "vaelis", t: "*(to his great-uncle)* She finally faced me honestly, and her own people made a liar of her. I do not know which of us that humiliates more.", m: "sad", req: { charAlive: "aelthir" } },
      { n: "Nobody won. The Silverwood no longer believes a halfellow's word about anything, and the war along the hedges turns cold and cruel." },
      { fx: { flag: "duelElfHalfellow" } },
    ],
  },

  // ------------------------------------------------ Brunna vs Hobby
  "duel:dwarf:halfellow": {
    when: { inGame: ["dwarf", "halfellow"], alive: ["dwarf", "halfellow"], charAlive: ["brunna", "hobby"] },
    lines: [
      { n: "The High Thane of Karrak and the Mayor of the Hearthlands have shared a barrel at every Midsummer Fair for twenty years. Now, with the war going badly for both, they agree to settle it the old way: one fight, on the barley fields between their borders." },
      { s: "brunna", t: "No hard feelings, Hobby. Well. A few.", m: "sad" },
      { s: "hobby", t: "A few. Mind the knees. Mine are old.", m: "sad" },
      { n: "They fight in a rising storm. Neither pulls a blow. Brunna's hammer breaks two of Hobby's fingers; Hobby's rapier finds the gap at the Thane's collar and draws a long red line." },
      { n: "Then the sky splits. A bolt of lightning strikes the field between them, close enough to throw them both into the barley. Where it hit, the ground is scorched black and ashen in a wide ring." },
      { s: "brunna", t: "*(on her back, ears ringing)* …Was that you?", m: "angry" },
      { s: "hobby", t: "*(on her back, hair smoking)* I'm *good*, dear. I'm not *that* good.", m: "sad" },
      { n: "Both armies saw the lightning fall. Karrak's priests say the sky struck the halfellow; the Hearthlands' hedge-wives say it struck the dwarf. Both say it proves their side was right." },
      { s: "barnaby", t: "*(in the Archive)* The Accord has no rule for *weather*. I've checked. Twice. I'm going to have to write one.", m: "flustered", req: { charAlive: "barnaby" } },
      { n: "Nobody won. The barley field is ash, the ale tariff is still unsettled, and neither leader will share a barrel at the next Midsummer Fair." },
      { fx: { flag: "duelDwarfHalfellow" } },
    ],
  },
});
