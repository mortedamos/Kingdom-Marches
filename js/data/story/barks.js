/**
 * STORY BARKS (character moments)
 * --------------------------------
 * Pure data: the shared line pools for barks -- the small, non-blocking
 * portrait cards (doc/story_bible.md §8b). Scenario files never hold barks;
 * every scenario draws from these same pools, so Skarra's taunts aren't
 * duplicated across the 40-odd scenarios she appears in.
 *
 * A pool entry is { s: speakerId, t: text, req? } -- `req` is the same
 * predicate object scenario lines use (see js/engine/story.js's reqHolds).
 * Tokens in text ({capital}, {grudge}, {player}, ...) are resolved at show
 * time by story.js's fillTokens. `*word*` renders as emphasis.
 *
 * Captions are one short italic line saying what happened; `{unit}` /
 * `{enemyUnit}` / `{city}` come from the triggering event.
 */

window.GameData = window.GameData || {};

window.GameData.STORY_BARKS = {
  // ---------------------------------------------------------------------
  // RIVAL VOICES -- taunts when a rival kingdom kills one of the player's
  // units. Four escalating tiers each (bible §8/§8b); the tier is picked by
  // how many taunts this voice has already made this game.
  // ---------------------------------------------------------------------
  taunts: {
    orc: {
      caption: "The Orcs killed your {unit}.",
      tiers: [
        [ // 1 -- gleeful
          { s: "skarra", t: "Another of yours face-down in MY bog! The ancestors are laughing, morsel! So is Skarra!" },
          { s: "skarra", t: "Did it hurt? Oh, I *do* hope it hurt." },
          { s: "skarra", t: "Weep! Wail! Write sad little songs! Skarra *feeds* on sad little songs!" },
          { s: "skarra", t: "Down it goes, into the mud! Destiny, my frog, did you see? We saw!" },
          { s: "gnash", t: "Gnash count your soldiers. One less. Gnash good at counting *less*." },
        ],
        [ // 2 -- personal: she knows the player's leader by name now
          { s: "skarra", t: "{player}! Skarra knows your name now, morsel. She will carve it on her privy door!" },
          { s: "skarra", t: "Is this the best {realm} can send? Skarra has *frogs* braver than that!" },
          { s: "skarra", t: "Oh, {player}, your soldiers fall so *prettily*. Send more. Skarra is collecting." },
          { s: "skarra", t: "The ancestors asked Skarra who {player} is. Skarra said: *nobody*, soon!" },
        ],
        [ // 3 -- scheming: hints at her plots
          { s: "skarra", t: "The Warchief's whelp and the Thane's little singer! You KNOW, don't you? Skarra's Wisps know EVERYTHING! Hee hee!", req: { alive: "dwarf" } },
          { s: "skarra", t: "Skarra has a secret, morsel. A *delicious* one. When it hatches, my brother will weep!" },
          { s: "skarra", t: "Enjoy your little war, {player}. Skarra is busy planning a bigger one. Hee hee hee!" },
          { s: "skarra", t: "My brother thinks he rules the Clans. My brother thinks a LOT of things. Hee hee!" },
        ],
        [ // 4 -- unhinged
          { s: "skarra", t: "You think you've WON? Skarra has been cursed, laughed at, and bitten by her own frog, and still she— *hsssss*—" },
          { s: "skarra", t: "The bog REMEMBERS, {player}! Destiny REMEMBERS! …Destiny, come *back*!" },
          { s: "skarra", t: "Ha! HA! HAAA! …Skarra has forgotten why she was laughing. Ha! HA!" },
        ],
      ],
    },
    elf: {
      caption: "The Elves killed your {unit}.",
      tiers: [
        [ // 1 -- dismissive
          { s: "vaelis", t: "One of yours has fallen. I would offer condolences, but I did not catch its name. I did not try." },
          { s: "vaelis", t: "How brief. Your soldiers live like mayflies and die like them, too." },
          { s: "vaelis", t: "Was that meant to be a soldier? Forgive me. From the Silverwood, the lesser peoples all look alike." },
          { s: "vaelis", t: "Another small life, ended. The forest will not remember it. Neither will I." },
        ],
        [ // 2 -- condescending: explains the player's mistakes to them
          { s: "vaelis", t: "{player}, you marched through the forest in daylight. Were you *hoping* we would notice?" },
          { s: "vaelis", t: "Allow me to explain, {player}, slowly: the trees are ours. Every one of them. Stop walking into them." },
          { s: "vaelis", t: "You keep sending them in ones and twos, {player}. I would call it a strategy, but I am trying to be kind." },
        ],
        [ // 3 -- cutting: names what the player values and belittles it
          { s: "vaelis", t: "You build your little {realm} as though it will last, {player}. I have watched three kingdoms like it rot into meadows." },
          { s: "vaelis", t: "Your people will tell stories of today, {player}. For perhaps a generation. Then they will forget you. We will not have noticed." },
          { s: "vaelis", t: "Your capital, {capital}. I have seen it, you know. Charming. Temporary, but charming." },
        ],
        [ // 4 -- cracked: only once the elves are losing
          { s: "vaelis", t: "That was… not supposed to happen. Great-uncle said the lesser peoples would tire. They have not tired.", req: { losing: "elf" } },
          { s: "vaelis", t: "You are *still here*. Why are you still here?", req: { losing: "elf" } },
          { s: "vaelis", t: "Do you know how long six hundred years is, {player}? No. Of course you don't. That is the *problem*." },
        ],
      ],
    },
  },

  /** A Bog Witch's curse on the player's unit that killed her (bible §8,
   *  `taunt:bogwitch`) -- outside the taunt cap, at most once per game. */
  bogwitchCurse: {
    caption: "You slew an orc Bog Witch, and your soldier was Cursed for it.",
    lines: [
      { s: "skarra", t: "You'll PAY for that! For five turns! FIVE TERRIBLE TURNS!" },
    ],
  },

  /** The player's own characters answering a taunt (about 1 in 3 taunts). */
  replies: {
    human: [
      { s: "aldric", t: "That witch will answer to the Dawn!", req: { taunter: "skarra" } },
      { s: "corvin", t: "Fascinating. She's *actually* hissing.", req: { taunter: "skarra" } },
      { s: "aldric", t: "The elf mocks the Dawn itself. Majesty, permit me to pray at him. Loudly.", req: { taunter: "vaelis" } },
      { s: "corvin", t: "Six hundred years old and he still hasn't learned to lose gracefully. I look forward to teaching him.", req: { taunter: "vaelis" } },
      { s: "maren", t: "Noted. …And write it down." },
    ],
    elf: [
      { s: "vaelis", t: "How loud. Is the bog-witch aware that shrieking is not a strategy?", req: { taunter: "skarra" } },
      { s: "ysolde", t: "The frogs have asked me to tell her she is embarrassing them.", req: { taunter: "skarra" } },
      { s: "aelthir", t: "Another name for me to remember. I have room. I always have room." },
    ],
    dwarf: [
      { s: "oskar", t: "Entry {grudge} in the Book of Grudges: that bog witch. Underlined." },
      { s: "brunna", t: "Carve it deep, witch. Dwarf names last.", req: { taunter: "skarra" } },
      { s: "oskar", t: "Entry {grudge} in the Book of Grudges: the elf, for being like that. Twice underlined.", req: { taunter: "vaelis" } },
      { s: "kazra", t: "Point a Titan at him.", req: { taunter: "vaelis" } },
    ],
    orc: [
      { s: "grukka", t: "Say it to my axe, elf.", req: { taunter: "vaelis" } },
      { s: "gnash", t: "Pretty one talk too much. Gnash smash pretty one. Soon.", req: { taunter: "vaelis" } },
    ],
    halfellow: [
      { s: "hobby", t: "He noticed. He's been *practising* that line.", req: { taunter: "vaelis" } },
      { s: "barnaby", t: "Rude. I'm writing that down." },
      { s: "goldie", t: "That witch'd curdle milk just by *looking* at it.", req: { taunter: "skarra" } },
      { s: "hobby", t: "Oh, she's awful. I'd almost like her if she weren't trying to kill us.", req: { taunter: "skarra" } },
    ],
  },

  // ---------------------------------------------------------------------
  // RIVAL MOMENTS -- one voice per rival kingdom reacting to what that
  // kingdom does to the player, or what the player does to it (bible §8b).
  // Keyed "<trigger>:<rival race>".
  // ---------------------------------------------------------------------
  rival: {
    "tookCity:elf": {
      caption: "The Elves captured {city}.",
      lines: [
        { s: "vaelis", t: "{city} belongs to the Silverwood now. I confess I had not noticed it was standing." },
        { s: "vaelis", t: "Another of your little towns. I shall add it to the list of things I have not noticed." },
        { s: "vaelis", t: "{city}. Is that what you called it? We shall think of something better. Something *older*." },
      ],
    },
    "lostCity:elf": {
      caption: "You captured the elf city {city}.",
      lines: [
        { s: "vaelis", t: "Keep it, then. We have outlived every city the lesser peoples ever took from us." },
        { s: "vaelis", t: "You have taken {city}. Enjoy it. You will be dead long before the trees forget you." },
        { s: "vaelis", t: "{city}… That was— never mind. It does not matter. Nothing *you* do matters for long.", req: { losing: "elf" } },
      ],
    },
    "killed:dwarf": {
      caption: "You killed a dwarf {enemyUnit}.",
      lines: [
        { s: "oskar", t: "Entry {grudge} in the Book of Grudges, against *you*, {player}. Underlined. Get comfortable in there." },
        { s: "oskar", t: "Entry {grudge} in the Book of Grudges: {realm}, for the {enemyUnit}. I've started you a whole page." },
        { s: "oskar", t: "Entry {grudge} in the Book of Grudges. You're filling pages faster than the Orcs, {player}. That's *not* a compliment." },
      ],
    },
    "tookCity:orc": {
      caption: "The Orcs captured {city}.",
      lines: [
        { s: "skarra", t: "{city} is OURS! Skarra will turn your town hall into a frog pond! Ha! HA!" },
        { s: "gnash", t: "Gnash smash {city} gate! Gnash live in {city} now! …Gnash need bigger door." },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// HOME MOMENTS -- the player's own characters reacting to their own play
// (bible §8b, §13.12). Only lines whose speaker belongs to the player's own
// kingdom are ever picked from these pools. Keyed by trigger.
// ---------------------------------------------------------------------------
window.GameData.STORY_BARKS.home = {
  riddleWin: {
    caption: "A halfellow riddle left an enemy befuddled.",
    lines: [
      { s: "barnaby", t: "Third century! Nobody ever gets the third-century ones." },
      { s: "barnaby", t: "That riddle has a footnote, you know. Three footnotes. The enemy read none of them." },
      { s: "hobby", t: "Stumped! Nothing beats a good riddle, dear. Except two riddles." },
      { s: "goldie", t: "That one's been told at The Goose & Kettle for forty years. Nobody gets it there either." },
    ],
  },
  riddleFail: {
    caption: "An enemy answered a halfellow riddle.",
    lines: [
      { s: "barnaby", t: "…In fairness, that one *is* in the Archive's *easy* section." },
      { s: "hobby", t: "They got it? Oh, *bother*. Somebody's been reading." },
      { s: "barnaby", t: "Answered correctly. I shall be writing to whoever taught them. Sternly." },
    ],
  },
  unlockGate: {
    caption: "A Trouble Maker unlocked an enemy gate at {city}.",
    lines: [
      { s: "hobby", t: "Knock knock. Oh, you've no door now. Never mind." },
      { s: "hobby", t: "Walls are just very tall suggestions, dear." },
      { s: "barnaby", t: "I'd like it recorded that the Archive does *not* endorse picking locks. …Though that was very neat." },
    ],
  },
  wolfHunt: {
    caption: "An orc dire wolf picked up the scent of an enemy.",
    lines: [
      { s: "varg", t: "The wolves always know the way. Moss taught them that.", req: { notFlag: "mossDead" } },
      { s: "varg", t: "Run them down. All of them. For Moss.", req: { flag: "mossDead" } },
      { s: "gnash", t: "Wolf smell enemy! Wolf go fast! Gnash go… medium!" },
      { s: "grukka", t: "Let the wolves eat first. They've earned it." },
    ],
  },
  oaks3: {
    caption: "A third Awakened Oak walks the Silverwood.",
    lines: [
      { s: "ysolde", t: "The forest has decided to take a walk. I did not ask it to. It did not ask me." },
      { s: "vaelis", t: "Three walking oaks. Finally, an army with some *dignity*." },
      { s: "aelthir", t: "The last time the trees marched, I was young. I had hoped not to see it again." },
    ],
  },
  militiaGoldie: {
    caption: "New militia answered the call, in Goldie's name.",
    lines: [
      { s: "hobby", t: "For Goldie." },
      { s: "barnaby", t: "They're signing up faster than the Archive can register them. She'd have fed every one." },
      { s: "hobby", t: "Every farmer in the Hearthlands with a pitchfork. Good. For Goldie." },
    ],
  },
  unitWin: {
    caption: "Your forces won a fight against a {enemyUnit}.",
    lines: [
      { s: "sigrun", t: "Now THAT'S a chorus!" },
      { s: "sigrun", t: "Did you hear that? The clang? That's the best song there is!" },
      { s: "sigrun", t: "Again! Again! Somebody find me another one!" },
      { s: "kazra", t: "Good hammer-work." },
      { s: "gnash", t: "CRUNCHY." },
      { s: "grukka", t: "Good. Next." },
      { s: "aldric", t: "The Dawn guides our blades!" },
      { s: "vaelis", t: "One fewer. The Marches grow quieter, and better for it." },
      { s: "hobby", t: "Oh! Well, that went better than expected." },
    ],
  },
  research: {
    caption: "Your scholars completed a new advancement.",
    lines: [
      { s: "barnaby", t: "A new discovery! I'll add it to the Archive. Next to the *old* discovery it's clearly copied from." },
      { s: "barnaby", t: "Splendid. I've cross-referenced it with four earlier works. Three of them were mine." },
      { s: "barnaby", t: "Research complete. Footnote to follow. Footnote to the footnote to follow after that." },
      { s: "corvin", t: "Progress. The Temple will call it a miracle. I'll call it Tuesday." },
      { s: "oskar", t: "New learning. Entry {grudge} in the Book of Grudges: everyone who said we couldn't." },
    ],
  },
};

// ---------------------------------------------------------------------------
// WORLD MOMENTS -- anyone present may speak (storms, the witches' feud).
// ---------------------------------------------------------------------------
window.GameData.STORY_BARKS.world = {
  storm: {
    caption: "A thunderstorm rolls across the Marches.",
    lines: [
      { s: "gnash", t: "THUNDER! Gnash not scared. Gnash is under table for *other reasons*." },
      { s: "gnash", t: "Sky is SMASHING! Who let sky smash?! Only Gnash smash!" },
      { s: "aldric", t: "The Dawn is angry! Repent, conjurors!" },
      { s: "corvin", t: "It is *weather*, Lord-Paladin. Warm air, cold air. Sit down." },
      { s: "oskar", t: "Entry {grudge} in the Book of Grudges: the weather. Again." },
      { s: "hobby", t: "Rain! Good planting weather! …Well. After the lightning." },
      { s: "barnaby", t: "A storm of this size was last recorded two hundred years ago. I have the *pamphlet*." },
      { s: "ysolde", t: "The clouds are arguing. I have told them it is unbecoming." },
      { s: "skarra", t: "Ha! HA! The sky is CURSING you, morsels! Skarra approves!" },
    ],
  },
  feudYsolde: {
    caption: "An orc Bog Witch fell to the Elves.",
    lines: [
      { s: "ysolde", t: "Another of the bog-witch's sisters, gone to the mud. Tell Skarra she is next." },
      { s: "ysolde", t: "One fewer Bog Witch. The frogs of the Marches may sleep easier tonight." },
    ],
  },
  feudSkarra: {
    caption: "An elf Druid fell to the Orcs.",
    lines: [
      { s: "skarra", t: "One of the elf-witch's precious DRUIDS, face-down in the bog! Ysolde, do you HEAR me?!" },
      { s: "skarra", t: "A druid! Skarra will press its leaves in her Book of Spite! Hee hee!" },
    ],
  },
};

// Rival voices for ability moments aimed at the player (bible §8b).
Object.assign(window.GameData.STORY_BARKS.rival, {
  "riddleWin:halfellow": {
    caption: "A halfellow riddle befuddled one of your units.",
    lines: [
      { s: "hobby", t: "Oh dear, was that one too hard? Terribly sorry. Not *very* sorry." },
      { s: "barnaby", t: "Third century riddle. Nobody ever gets those. Don't feel bad. Well, feel a *little* bad." },
    ],
  },
  "unlockGate:halfellow": {
    caption: "A halfellow Trouble Maker unlocked the gate at {city}.",
    lines: [
      { s: "hobby", t: "Knock knock! Oh. You've no gate now. Never mind, dear." },
      { s: "hobby", t: "Lovely walls. Shame about the lock." },
    ],
  },
});
