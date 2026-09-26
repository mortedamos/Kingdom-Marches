/**
 * STORY BARKS -- EVENTS
 * ---------------------
 * Pure data, loaded after barks.js (2026-09-25, user-directed: "more bark
 * and dialogue -- it's fun"). Same line format as barks.js; a line may
 * also carry `then: [lines]`, a short conversation (see story.js toBark).
 *
 * Rival pools, keyed "<trigger>:<rival race>":
 *   tookCity / lostCity -- a city changed hands between player and rival
 *   razed      -- the player razed one of the rival's cities (vengeance)
 *   razedYours -- the rival razed one of the player's (gloating)
 *   killed     -- the player killed one of the rival's units
 *   killedYours -- the rival killed one of the player's (for kingdoms
 *                  without a taunt voice; orcs and elves have taunts)
 * Home pools (only the player's own characters speak): first walls and
 * bridges, units lost, cities razed, gathering.
 */

window.GameData = window.GameData || {};
window.GameData.STORY_BARKS = window.GameData.STORY_BARKS || {};

Object.assign(window.GameData.STORY_BARKS.rival, {
  "tookCity:dwarf": {
    caption: "The Dwarves captured {city}.",
    lines: [
      { s: "brunna", t: "{city} is Karrak's now. We'll build it a proper wall. You're welcome.", m: "proud" },
      { s: "oskar", t: "{city}, taken. I've crossed out an entry in the Book of Grudges. One. Don't get excited.", m: "grudging" },
      { s: "sigrun", t: "{city} is OURS! I'm writing a song about it! Verse one: you lost!", m: "fierce" },
      { s: "kazra", t: "Your walls at {city} had a flaw. Third course, west face. I'd fix that next time. Oh, wait.", m: "focused" },
    ],
  },
  "lostCity:dwarf": {
    caption: "You captured the dwarf city {city}.",
    lines: [
      { s: "oskar", t: "{city}. Entry {grudge} in the Book of Grudges, {player}. I've given you your own *chapter*.", m: "angry" },
      { s: "brunna", t: "You'll give {city} back, {player}. Stone by stone, if I have to take it that way.", m: "angry" },
      { s: "sigrun", t: "{city}?! I *grew up* in {city}! You'll hear about this, {player}. In SONG!", m: "angry" },
      { s: "kazra", t: "Enjoy the forges in {city}. They'll never burn as hot for you as they did for us.", m: "sad" },
      { s: "oskar", t: "A dwarf never forgets, {player}. I'm the one who makes *sure* of it.", m: "grudging",
        then: [{ s: "brunna", t: "Write it big, Oskar.", m: "angry" }] },
    ],
  },
  "razed:dwarf": {
    caption: "You razed the dwarf city {city}.",
    lines: [
      { s: "brunna", t: "{city} stood four hundred years. You'll not stand forty, {player}. I swear it on every stone.", m: "angry" },
      { s: "oskar", t: "Entry {grudge} in the Book of Grudges: {city}. …I've run out of underlining. I'm using *red ink*.", m: "angry" },
      { s: "sigrun", t: "You burned {city}. My songs will follow you to your grave, {player}, and they will *not* be kind.", m: "fierce" },
      { s: "kazra", t: "I'll rebuild it. Every stone. And then I'll come for yours.", m: "angry" },
    ],
  },
  "razedYours:dwarf": {
    caption: "The Dwarves razed {city}.",
    lines: [
      { s: "brunna", t: "{city} was a grudge settled. Karrak pays its debts in full.", m: "proud" },
      { s: "oskar", t: "{city}. Crossed out. Entry {grudge}: *resolved*. Oh, that's satisfying.", m: "grudging" },
      { s: "kazra", t: "Bad foundations at {city}. We did you a favour.", m: "focused" },
    ],
  },
  "killed:elf": {
    caption: "You killed an elf {enemyUnit}.",
    lines: [
      { s: "vaelis", t: "You killed a {enemyUnit}. That elf was older than your kingdom, {player}. Think on that.", m: "angry" },
      { s: "aelthir", t: "Another name for me to carry. You are giving me so many, {player}.", m: "sad" },
      { s: "ysolde", t: "The forest felt that. It will remember whose boots were standing there.", m: "uncanny" },
    ],
  },
  "killed:human": {
    caption: "You killed a human {enemyUnit}.",
    lines: [
      { s: "aldric", t: "A soldier of the Dawn has fallen! The light will not forget this, {player}!", m: "angry" },
      { s: "maren", t: "I will write to the family of that {enemyUnit}, {player}. And then I will write to you.", m: "resolute" },
      { s: "corvin", t: "That one owed me money. You've cost me *twice*, {player}.", m: "wry" },
    ],
  },
  "killed:orc": {
    caption: "You killed an orc {enemyUnit}.",
    lines: [
      { s: "grukka", t: "You'll pay for that one, {player}. The Clans keep a tally too. Ours is written in teeth.", m: "angry" },
      { s: "gnash", t: "Hey! That Gnash's friend! …Gnash have many friends. But STILL!", m: "angry" },
      { s: "varg", t: "That was one of my riders. He had a name, {player}. You didn't even ask it.", m: "sad" },
    ],
  },
  "killed:halfellow": {
    caption: "You killed a halfellow {enemyUnit}.",
    lines: [
      { s: "hobby", t: "Oh, you *brute*. That was somebody's nephew, {player}. Everyone's somebody's nephew.", m: "angry" },
      { s: "goldie", t: "I'll be setting one less place at supper tonight. You remember that, {player}.", m: "sad" },
      { s: "barnaby", t: "I'm recording that in the Archive. Under *Atrocities*. It was a very short section.", m: "flustered" },
    ],
  },
  "killedYours:dwarf": {
    caption: "The Dwarves killed your {unit}.",
    lines: [
      { s: "sigrun", t: "HA! Did you hear it? That clang was your {unit}! Best note I've played all week!", m: "fierce" },
      { s: "brunna", t: "You walked into a dwarf's hall with a {unit}, {player}. That's not war. That's delivery.", m: "proud" },
      { s: "oskar", t: "A {unit}, gone. I'd feel sorry for you, but I've read what you've done. Chapter and verse.", m: "grudging" },
      { s: "kazra", t: "Good hammer-work, lads. Clean. Quick. Next.", m: "focused" },
    ],
  },
  "killedYours:human": {
    caption: "The Humans killed your {unit}.",
    lines: [
      { s: "aldric", t: "The Dawn guides our blades, {player}! Repent, and the light may yet forgive you!", m: "fervent" },
      { s: "maren", t: "I take no joy in it, {player}. Only in the peace that follows.", m: "resolute" },
      { s: "corvin", t: "Your {unit} walked into a spell I spent six years designing. I'm almost flattered.", m: "wry" },
    ],
  },
  "killedYours:halfellow": {
    caption: "The Halfellows killed your {unit}.",
    lines: [
      { s: "hobby", t: "Oops. Did your {unit} trip, dear? The Hearthlands are *full* of holes. We dug most of them.", m: "scheming" },
      { s: "goldie", t: "That's what you get for tramping through somebody's vegetable patch.", m: "stern" },
      { s: "barnaby", t: "Oh! Oh, we *won* one! I'll… I'll need a new section in the Archive!", m: "flustered" },
    ],
  },
  "tookCity:human": {
    caption: "The Humans captured {city}.",
    lines: [
      { s: "maren", t: "{city} is under the Crown's protection now. Its people will be treated well. Better than you did.", m: "resolute" },
      { s: "aldric", t: "The banner of the Dawn flies over {city}! Let every bell ring!", m: "fervent" },
      { s: "corvin", t: "{city}. Lovely place. The library's a disgrace, but I'll sort it out.", m: "wry" },
    ],
  },
  "lostCity:human": {
    caption: "You captured the human city {city}.",
    lines: [
      { s: "maren", t: "Those are *my* people in {city}, {player}. Harm one of them and I will know.", m: "angry" },
      { s: "aldric", t: "Heretic! {city} was consecrated to the Dawn! You stand on holy ground in dirty boots!", m: "angry" },
      { s: "corvin", t: "You took {city}. I had books there, {player}. *Books*. There will be consequences.", m: "angry" },
      { s: "maren", t: "Westmarch has lost cities before. It has taken every one of them back.", m: "resolute",
        then: [{ s: "aldric", t: "Every one! By the Dawn!", m: "fervent" }] },
    ],
  },
  "razed:human": {
    caption: "You razed the human city {city}.",
    lines: [
      { s: "maren", t: "You burned {city} to the ground. I will remember every name, {player}. Every single one.", m: "angry" },
      { s: "aldric", t: "The Dawn saw what you did at {city}. There is no shadow deep enough to hide you now.", m: "fervent" },
      { s: "corvin", t: "I've stopped being clever about you, {player}. Consider that a warning.", m: "angry" },
    ],
  },
  "razedYours:human": {
    caption: "The Humans razed {city}.",
    lines: [
      { s: "aldric", t: "{city} is cleansed by fire! The Dawn has spoken!", m: "fervent" },
      { s: "maren", t: "I did not want to burn {city}. You left me no other choice, {player}.", m: "resolute" },
      { s: "corvin", t: "Well. That's one less problem on the map. You're welcome to draw it back in, if you like.", m: "wry" },
    ],
  },
  "tookCity:halfellow": {
    caption: "The Halfellows captured {city}.",
    lines: [
      { s: "hobby", t: "{city} is ours now! Don't worry, we'll put flower boxes in every window.", m: "scheming" },
      { s: "goldie", t: "Took {city}. First thing, a proper kitchen. Second thing, somebody sweep that square.", m: "stern" },
      { s: "barnaby", t: "{city}! Our first conquest! No. Our first *acquisition*. Conquest sounds rude.", m: "flustered" },
    ],
  },
  "lostCity:halfellow": {
    caption: "You captured the halfellow city {city}.",
    lines: [
      { s: "hobby", t: "{city}. You took {city}. Oh, you'll be *sorry*, dear. I'll see to it personally.", m: "angry" },
      { s: "goldie", t: "There were pies cooling in {city}, {player}. Pies! Have you no *shame*?", m: "angry" },
      { s: "barnaby", t: "Th-the {city} records! The parish registers! Please tell me you didn't burn the registers!", m: "flustered" },
    ],
  },
  "razed:halfellow": {
    caption: "You razed the halfellow city {city}.",
    lines: [
      { s: "hobby", t: "{city} is ashes. I've stopped being nice, {player}. You won't like me when I've stopped being nice.", m: "angry" },
      { s: "goldie", t: "Every family in {city}. Every hearth. You'll answer for every one of them.", m: "angry" },
      { s: "barnaby", t: "Seven hundred years of history in {city}. Gone. I'll have to write it all down again. From *memory*.", m: "sad" },
    ],
  },
  "razedYours:halfellow": {
    caption: "The Halfellows razed {city}.",
    lines: [
      { s: "hobby", t: "Sorry about {city}, dear. Well. *Mostly* sorry.", m: "scheming" },
      { s: "goldie", t: "You came for the Hearthlands. The Hearthlands came back.", m: "stern" },
    ],
  },
  "lostCity:orc": {
    caption: "You captured the orc city {city}.",
    lines: [
      { s: "grukka", t: "{city}. You took {city}. Enjoy the swamp, {player}. It's going to swallow you.", m: "angry" },
      { s: "skarra", t: "{city}! You THIEF! Skarra will curse your cats! Skarra will curse your cats' *cats*!", m: "angry" },
      { s: "gnash", t: "Hey! That Gnash's favourite city! …Gnash have many favourite city. But STILL!", m: "angry" },
      { s: "varg", t: "Get out of {city}, {player}. There are pups there. There are *pups* there.", m: "angry" },
    ],
  },
  "razed:orc": {
    caption: "You razed the orc city {city}.",
    lines: [
      { s: "grukka", t: "You burned {city}. Every orc from here to the Bloodmire knows your name now, {player}. Pray they forget it.", m: "angry" },
      { s: "skarra", t: "{city} is ASH?! Oh, you've done it now, morsel. You've made Skarra *serious*.", m: "angry" },
      { s: "varg", t: "My riders grew up in {city}. I'll tell them who burned it. I'll tell them *slowly*.", m: "angry" },
      { s: "gnash", t: "Gnash SMASH YOU. Gnash smash you FOREVER. …And after forever. Gnash smash then too.", m: "angry" },
    ],
  },
  "razedYours:orc": {
    caption: "The Orcs razed {city}.",
    lines: [
      { s: "skarra", t: "BURN! BURN! Oh, {city} makes a *lovely* bonfire! Hee hee hee!", m: "gleeful" },
      { s: "grukka", t: "{city} is gone. That's what happens when you stand in the Clans' way.", m: "defiant" },
      { s: "gnash", t: "Gnash smash {city}! Is flat now! Gnash good at flat!", m: "happy" },
    ],
  },
  "razed:elf": {
    caption: "You razed the elf city {city}.",
    lines: [
      { s: "vaelis", t: "You burned {city}. Its trees were older than your oldest ancestor, {player}. I will not forget. I *cannot* forget.", m: "angry" },
      { s: "aelthir", t: "{city}… I planted the first grove there. Another memory, and this one burns.", m: "sad" },
      { s: "ysolde", t: "The ashes of {city} are whispering your name, {player}. They are not whispering kindly.", m: "uncanny" },
    ],
  },
  "razedYours:elf": {
    caption: "The Elves razed {city}.",
    lines: [
      { s: "vaelis", t: "{city} is gone. In a hundred years it will be a lovely meadow. You're welcome.", m: "aloof" },
      { s: "ysolde", t: "The roots will have {city} now. They were waiting.", m: "uncanny" },
      { s: "aelthir", t: "I did not wish to burn {city}. I have seen too many burn.", m: "sad" },
    ],
  },
});

// Existing rival pools get more lines.
(function (R) {
  R["tookCity:orc"].lines.push(
    { s: "grukka", t: "{city} belongs to the Clans now. Come and take it back. I'll wait.", m: "defiant" },
    { s: "varg", t: "We took {city}. I told the riders to leave the people be. …Most of them listened.", m: "bashful" },
  );
  R["tookCity:elf"].lines.push(
    { s: "aelthir", t: "{city}. We will plant a tree in its square. It will outlive all of us.", m: "wistful" },
    { s: "ysolde", t: "The forest will reclaim {city} gently. It is *very* patient.", m: "uncanny" },
  );
  R["lostCity:elf"].lines.push(
    { s: "aelthir", t: "{city} was ours for nine hundred years. It will be ours again. I can wait. I am *good* at waiting.", m: "wistful" },
    { s: "ysolde", t: "You have taken {city}. The trees there will not let you sleep.", m: "uncanny" },
  );
  R["killed:dwarf"].lines.push(
    { s: "brunna", t: "That {enemyUnit} had a family, {player}. So do you. Remember that.", m: "angry" },
    { s: "sigrun", t: "You'll get a verse for that. A *mean* verse.", m: "fierce" },
  );
})(window.GameData.STORY_BARKS.rival);

// ---------------------------------------------------------------------------
// SKARRA'S COVETED RELICS (2026-09-25, user-directed): she barks whenever the
// Umbral Ring or Mortedamos changes hands, as long as she's in the game.
// "got:<id>" -- the Orcs have it now; "lost:<id>" -- somebody else does.
// ---------------------------------------------------------------------------
window.GameData.STORY_BARKS.skarraCovets = {
  "got:umbral_ring": {
    caption: "The Orcs hold the Umbral Ring.",
    lines: [
      { s: "skarra", t: "The Umbral Ring! MINE! Mine mine mine! The shadows fit Skarra's finger *perfectly*!", m: "gleeful",
        then: [{ s: "grukka", t: "It's on a soldier's hand, sister. Not yours." }, { s: "skarra", t: "…For NOW.", m: "gleeful" }] },
      { s: "skarra", t: "The Ring is home! Can you feel it, Destiny, my darling frog? The dark is *purring*!", m: "gleeful" },
    ],
  },
  "lost:umbral_ring": {
    caption: "Another kingdom holds the Umbral Ring.",
    lines: [
      { s: "skarra", t: "Somebody ELSE has the Umbral Ring?! Skarra's ring! Skarra's shadows! Skarra will pull it off their finger. *With* the finger.", m: "angry" },
      { s: "skarra", t: "The Umbral Ring belongs in the bog, with Skarra, where it's *appreciated*. Tell them that. Tell them LOUDLY.", m: "angry" },
      { s: "skarra", t: "Skarra dreams of that ring, you know. Every night. Dark, cold, and *just her size*.", m: "sad" },
    ],
  },
  "got:mortedamos": {
    caption: "The Orcs hold Mortedamos' Malefic Manuscript.",
    lines: [
      { s: "skarra", t: "The Manuscript! Every curse! EVERY CURSE! Oh, where do I even *start*?!", m: "gleeful",
        then: [{ s: "gnash", t: "Start not on Gnash.", m: "confused" }, { s: "skarra", t: "…No promises.", m: "gleeful" }] },
      { s: "skarra", t: "Mortedamos, you old darling. Your book is in *good* hands now. Terrible hands. The best hands.", m: "gleeful" },
    ],
  },
  "lost:mortedamos": {
    caption: "Another kingdom holds Mortedamos' Malefic Manuscript.",
    lines: [
      { s: "skarra", t: "They have MY book! They can't even READ it! Half those curses need a *bog* to work!", m: "angry" },
      { s: "skarra", t: "Mortedamos wrote that book for someone like Skarra. Not for *them*. Skarra will get it back. Page. By. Page.", m: "angry" },
      { s: "skarra", t: "Every night Skarra lies awake thinking of that book. The binding. The whispers. The *smell*.", m: "sad" },
    ],
  },
};

// ---------------------------------------------------------------------------
// MORE HOME MOMENTS: first walls and bridges, losses, razings, gathering.
// Only the player's own characters speak (story.js homeBark).
// ---------------------------------------------------------------------------
Object.assign(window.GameData.STORY_BARKS.home, {
  "built:wall_section": {
    caption: "Your first wall rises at {city}.",
    lines: [
      { s: "maren", t: "A wall at {city}. Not because I fear them. Because I know them." },
      { s: "corvin", t: "Walls. The oldest spell there is: *stay out*.", m: "wry" },
      { s: "aldric", t: "Let the Dawn bless these stones, and let every foe break upon them!", m: "fervent" },
      { s: "vaelis", t: "A wall. How very… human of us. Still. It keeps the rabble at a distance.", m: "aloof" },
      { s: "ysolde", t: "The stones agreed to stand together. I asked them nicely.", m: "uncanny" },
      { s: "brunna", t: "The first wall at {city}. Karrak builds walls the way other kingdoms breathe.", m: "proud",
        then: [{ s: "kazra", t: "Mine's straighter than yours was, Thane.", m: "focused" }, { s: "brunna", t: "Nobody likes a show-off, Kazra.", m: "happy" }] },
      { s: "kazra", t: "Good stone, good mortar, good wall. Walls first, as the Thane says.", m: "focused" },
      { s: "grukka", t: "A wall? The Clans don't hide behind walls. …But the pups do sleep better.", m: "defiant" },
      { s: "gnash", t: "Wall! Gnash lean on wall! …Wall still up. GOOD wall.", m: "happy" },
      { s: "hobby", t: "A wall at {city}. Not a big one. Just big enough to be *rude*.", m: "scheming" },
      { s: "goldie", t: "A good fence makes a good neighbour. A good wall makes a *quiet* one.", m: "stern" },
    ],
  },
  "built:bridge_section": {
    caption: "Your first bridge spans the water near {city}.",
    lines: [
      { s: "maren", t: "A bridge. The river used to decide where we could go. Now we do.", m: "happy" },
      { s: "corvin", t: "A bridge. Unlike most ideas, this one actually connects two things.", m: "wry" },
      { s: "aelthir", t: "A bridge. The river will forgive us. Rivers usually do.", m: "wistful" },
      { s: "ysolde", t: "The river let us cross. It wants something in return. I'll find out what.", m: "uncanny" },
      { s: "oskar", t: "A bridge. Load-tested, documented and signed. If it falls, it's Kazra's fault.",
        then: [{ s: "kazra", t: "It won't fall.", m: "focused" }] },
      { s: "sigrun", t: "A bridge! Perfect acoustics under a bridge, you know. I'm going to go and shout under it.", m: "happy" },
      { s: "varg", t: "A bridge. Now the wolves don't have to swim. They hate swimming.", m: "happy" },
      { s: "gnash", t: "Gnash walk on bridge! Bridge say CREAK! …Gnash walk faster.", m: "confused" },
      { s: "barnaby", t: "A bridge! I'll have to redraw every map in the Archive. Oh, *wonderful*.", m: "happy" },
      { s: "hobby", t: "A bridge! Now we can visit the neighbours. And borrow things. And not give them back.", m: "scheming" },
    ],
  },
  unitLost: {
    caption: "Your {unit} has fallen.",
    lines: [
      { s: "maren", t: "Write the {unit}'s name down. Every name. That's the least a crown owes.", m: "sad" },
      { s: "aldric", t: "Rest now, friend. The Dawn will keep you.", m: "sad" },
      { s: "corvin", t: "Another one. I'm running out of clever things to say about it.", m: "sad" },
      { s: "aelthir", t: "So brief. They are always so brief.", m: "sad" },
      { s: "vaelis", t: "Tell me who did that. I would like a word with them. A *long* word.", m: "angry" },
      { s: "ysolde", t: "The earth has taken them back. It was gentle, at least.", m: "sad" },
      { s: "oskar", t: "Entry {grudge} in the Book of Grudges. For our {unit}. Underlined twice.", m: "grudging" },
      { s: "brunna", t: "Carve the name in the hall. Next to the others.", m: "sad" },
      { s: "sigrun", t: "I'll sing for them tonight. The slow one. Everybody knows the slow one.", m: "sad" },
      { s: "grukka", t: "They died with an axe in hand. That's all any of us can ask.", m: "defiant" },
      { s: "varg", t: "I knew that one. Not well. Well enough.", m: "sad" },
      { s: "gnash", t: "Gnash sad. Gnash going to smash something about it.", m: "sad" },
      { s: "goldie", t: "One less at supper. I'll still set the place. I always do.", m: "sad" },
      { s: "hobby", t: "Oh, no. No, no, no. Somebody write to the family. I'll write to the family.", m: "sad" },
      { s: "barnaby", t: "I'll put the name in the Archive. In the good ink.", m: "sad" },
    ],
  },
  cityRazed: {
    caption: "{city} has been razed.",
    lines: [
      { s: "maren", t: "{city} is gone. We will rebuild it, and we will remember who did this.", m: "resolute" },
      { s: "aldric", t: "{city}… Oh, Dawn, how could this be allowed?", m: "sad" },
      { s: "aelthir", t: "I remember when {city} was only a clearing. Now it is only a memory.", m: "sad" },
      { s: "vaelis", t: "They burned {city}. Good. Now I have a reason.", m: "angry" },
      { s: "brunna", t: "{city}. We'll build it back. Deeper this time.", m: "angry" },
      { s: "oskar", t: "{city}. I'll need a new book. This one isn't big enough.", m: "grudging" },
      { s: "grukka", t: "They burned {city}. So we burn theirs. That's how the Clans count.", m: "angry" },
      { s: "varg", t: "The pups from {city}… where do we put them now?", m: "sad" },
      { s: "goldie", t: "{city}… Every kitchen. Every hearth. All gone.", m: "sad" },
      { s: "hobby", t: "They burned {city}. Right. *Right*. No more Mayor Nice.", m: "angry" },
    ],
  },
  gather: {
    caption: "Your people are gathering resources.",
    lines: [
      { s: "maren", t: "Full granaries, full coffers. That is what wins a long war." },
      { s: "corvin", t: "Honest labour. Fascinating. I've read about it.", m: "wry" },
      { s: "aelthir", t: "Take only what the land offers. It remembers greed.", m: "wistful" },
      { s: "ysolde", t: "The land gives freely. I have told it to keep giving. It listens to me.", m: "uncanny" },
      { s: "oskar", t: "Another load in. I've logged it. I log everything.", m: "grudging" },
      { s: "grukka", t: "More for the Clans. Good. Hungry orcs are angry orcs. Angry at *us*.", m: "defiant" },
      { s: "goldie", t: "That'll feed a few hungry mouths. Keep it coming, lads.", m: "happy" },
      { s: "hobby", t: "Look at all that! Somebody fetch the good baskets.", m: "happy" },
    ],
  },
  "gather:fishing": {
    caption: "Your people are fishing.",
    lines: [
      { s: "corvin", t: "Fish again. The court is running out of ways to pretend to enjoy fish.", m: "wry" },
      { s: "aldric", t: "The nets are full! A blessing on the waters!", m: "happy" },
      { s: "ysolde", t: "The fish say the water is cold this year. They also say *please*.", m: "uncanny" },
      { s: "gnash", t: "FISH! Gnash eat fish whole! …Gnash eat bones too. Is fine.", m: "happy" },
      { s: "hobby", t: "Fishing! The best kind of work, dear. Mostly sitting.", m: "happy" },
      { s: "goldie", t: "Fresh fish for the Goose & Kettle. Somebody tell the cook.", m: "happy" },
      { s: "barnaby", t: "That's a *speckled* trout! There are only four drawings of those in the Archive!", m: "flustered" },
    ],
  },
  "gather:hunting": {
    caption: "Your people are hunting.",
    lines: [
      { s: "aldric", t: "Game for the table! The Dawn provides.", m: "happy" },
      { s: "vaelis", t: "A clean shot. Of course it was. We do not do *messy*.", m: "aloof" },
      { s: "aelthir", t: "Thank the deer. Always thank the deer.", m: "wistful" },
      { s: "varg", t: "Good hunting. The wolves get the first share. They earned it.", m: "happy" },
      { s: "grukka", t: "Meat. Good. The Clans eat tonight.", m: "happy" },
      { s: "hobby", t: "Venison! I know *exactly* what Goldie's going to say about that.", m: "happy" },
    ],
  },
  "gather:farming": {
    caption: "Your people are working the fields.",
    lines: [
      { s: "maren", t: "Good harvest. A kingdom marches on its bread." },
      { s: "ysolde", t: "The soil hums when it is happy. It is humming.", m: "uncanny" },
      { s: "brunna", t: "Farming. Up top. In the *sun*. Well, somebody has to." },
      { s: "gnash", t: "Gnash plant turnip! Turnip grow! Gnash very proud of turnip!", m: "happy" },
      { s: "goldie", t: "Good soil there. You can tell by the smell.", m: "happy" },
      { s: "hobby", t: "Nothing like a good row of cabbages. Nothing in the world.", m: "happy" },
    ],
  },
  "gather:mining": {
    caption: "Your people are mining.",
    lines: [
      { s: "kazra", t: "Good vein. Good ore. I can hear it ringing from here.", m: "focused" },
      { s: "brunna", t: "Dig deep. The mountain gives to those who ask properly.", m: "proud" },
      { s: "sigrun", t: "Pickaxes in rhythm! One-two, one-two! Now THAT'S a working song!", m: "happy" },
      { s: "oskar", t: "Gold. Lovely. Every ounce accounted for. *Every* ounce, Sigrun.", req: { resource: "gold" },
        then: [{ s: "sigrun", t: "That was ONE time!", m: "angry" }] },
      { s: "corvin", t: "Iron from the hills. Swords for Aldric, nails for everyone else.", req: { resource: "iron" }, m: "wry" },
      { s: "grukka", t: "Iron. Good. More axes.", req: { resource: "iron" } },
      { s: "gnash", t: "Shiny rocks! Gnash like shiny rocks! Gnash not eat shiny rocks. …Anymore.", m: "confused" },
      { s: "barnaby", t: "Mining! Dirty, dark and dangerous. I'll stay up here and write about it.", m: "flustered" },
    ],
  },
  "gather:delving": {
    caption: "Your people are delving into a ruin.",
    lines: [
      { s: "corvin", t: "An old ruin. If there are curses down there, I'd like first look.", m: "wry" },
      { s: "aelthir", t: "I remember when that ruin was a hall. There was music.", m: "wistful" },
      { s: "oskar", t: "An old wardhouse. Mind the runes. Mind the *floor*.", m: "grudging" },
      { s: "skarra", t: "Dig, dig, dig! Maybe there's a CURSE down there! Skarra LOVES a curse!", m: "gleeful" },
      { s: "barnaby", t: "A ruin! Oh, please bring me back anything with writing on it. *Anything*.", m: "happy" },
    ],
  },
});

// More lines for existing home and world pools.
window.GameData.STORY_BARKS.home.unitWin.lines.push(
  { s: "maren", t: "Well fought. Tell them the Crown saw it.", m: "happy" },
  { s: "corvin", t: "Victory! Somebody tell Aldric before he tells us.", m: "wry" },
  { s: "aelthir", t: "It is done. Do not celebrate. Remember.", m: "wistful" },
  { s: "ysolde", t: "The grass is already growing over the {enemyUnit}. The Marches are efficient.", m: "uncanny" },
  { s: "brunna", t: "That's how Karrak fights. Straight through.", m: "proud" },
  { s: "oskar", t: "One {enemyUnit}, dealt with. I've crossed out a line in the Book. It felt *wonderful*.", m: "grudging" },
  { s: "varg", t: "We won. …Is everyone all right? Everyone *ours*, I mean.", m: "bashful" },
  { s: "skarra", t: "Hee hee! Down they go! Skarra LOVES this part!", m: "gleeful" },
  { s: "goldie", t: "Serves them right, marching through our fields.", m: "stern" },
  { s: "barnaby", t: "A victory! I'll record it at once! In *bold*!", m: "happy" },
  { s: "aldric", t: "Another foe falls before the light! Rejoice!", m: "fervent",
    then: [{ s: "corvin", t: "He's going to sing now. I'd step back.", m: "wry" }] },
  { s: "sigrun", t: "Kazra! Did you see that?! Tell me you saw that!", m: "fierce",
    then: [{ s: "kazra", t: "I saw it. Your left foot was wrong.", m: "focused" }, { s: "sigrun", t: "My left foot was *perfect*!", m: "angry" }] },
);
window.GameData.STORY_BARKS.world.storm.lines.push(
  { s: "maren", t: "Keep the soldiers off the hilltops until it passes. The sky is no one's ally.", m: "resolute" },
  { s: "aelthir", t: "I have seen ten thousand storms. This one is loud. Most of them are loud.", m: "wistful" },
  { s: "vaelis", t: "Rain. On the silk. Wonderful.", m: "angry" },
  { s: "brunna", t: "Storm up top? Good thing we live under a mountain.", m: "happy" },
  { s: "sigrun", t: "THUNDER! The sky's got a drum solo! Kazra, come and listen!", m: "fierce" },
  { s: "kazra", t: "Lightning. Pure power, and it wastes it on *hills*.", m: "focused" },
  { s: "grukka", t: "Let it rain. The bog drinks, the Clans march.", m: "defiant" },
  { s: "varg", t: "The wolves hate thunder. I'm going to go and sit with them.", m: "bashful" },
  { s: "goldie", t: "Everybody inside! Boots off at the door! I *mean* it!", m: "stern" },
  { s: "gnash", t: "Lightning hit tree! Tree on FIRE! Gnash want to try! …Gnash *not* allowed to try.", m: "confused" },
);

// ---------------------------------------------------------------------------
// VAELIS'S SCOFFS (2026-09-25, user-directed): he truly believes the elves
// superior, and says so about everyone else's progress. "player" -- a rival
// Vaelis sneering at the player's advancement (added as the last card of
// the player's own advancement bark). "rival" -- when the player IS the
// Elves, their heir sneering at another kingdom's ({rival}) advancement.
// ---------------------------------------------------------------------------
window.GameData.STORY_BARKS.vaelisScoffs = {
  player: {
    caption: "The Elves hear of your {tech}.",
    lines: [
      { s: "vaelis", t: "{tech}? How *sweet*. We had that before your ancestors learned to stand upright.", m: "aloof" },
      { s: "vaelis", t: "Congratulations on {tech}, {player}. The Silverwood discarded it as primitive some four centuries ago.", m: "aloof" },
      { s: "vaelis", t: "{tech}. I shall have someone explain to me why this is considered an achievement. Slowly.", m: "aloof" },
      { s: "vaelis", t: "Oh, look. The lesser peoples have discovered {tech}. Next, perhaps, *fire*.", m: "happy" },
      { s: "vaelis", t: "{tech}. Adorable. Do you keep a little book of your firsts, {player}? You should. It will be a short book.", m: "aloof" },
      { s: "vaelis", t: "You mayflies learn so *quickly*. It is almost as if you know you have no time.", m: "aloof" },
      { s: "vaelis", t: "{tech}? Our *children* play with that. Well. Our children are three hundred years old. Still.", m: "aloof" },
      { s: "vaelis", t: "Do tell {realm} that the Silverwood is terribly impressed. It isn't. But do tell them.", m: "happy" },
    ],
  },
  rival: {
    caption: "{rival} completed {tech}.",
    lines: [
      { s: "vaelis", t: "{rival} has discovered {tech}. How touching. Great-uncle, shall we send them a card?", m: "aloof" },
      { s: "vaelis", t: "{tech}, from {rival}. I remember when we stopped bothering with that. I was very young.", m: "aloof" },
      { s: "vaelis", t: "The lesser peoples have learned {tech}. Someone wake me when they learn *manners*.", m: "aloof" },
      { s: "vaelis", t: "{rival} and their {tech}. A child with a new toy, waving it at a forest.", m: "happy" },
      { s: "vaelis", t: "{tech}? From {rival}? …No. No, it is still beneath us. I checked.", m: "aloof" },
      { s: "vaelis", t: "Our scouts report {rival} has mastered {tech}. I have asked them to report something *interesting* next time.", m: "aloof",
        then: [{ s: "aelthir", t: "Do not underestimate them, Vaelis. That is how it always begins.", m: "wistful" }] },
    ],
  },
};

// ---------------------------------------------------------------------------
// THE LUCKY ROCK (2026-09-25, user-directed): Gnash loves the Lucky Rock. It
// is both lucky AND a rock. holder "orc" -- the Orcs just found one;
// "other" -- the player (not an orc) found one, and Gnash covets it.
// ---------------------------------------------------------------------------
window.GameData.STORY_BARKS.luckyRock = {
  caption: "A Lucky Rock has been found.",
  lines: [
    { s: "gnash", t: "LUCKY ROCK! Is lucky! Is ROCK! Is BOTH! Best thing Gnash ever see!", m: "happy", req: { holder: "orc" } },
    { s: "gnash", t: "Gnash hold lucky rock. Gnash feel lucky. Also Gnash feel rock. Two feelings!", m: "happy", req: { holder: "orc" } },
    { s: "gnash", t: "Lucky rock! Gnash name it Rocky. No. Gnash name it LUCKY. No. Gnash name it Lucky Rocky.", m: "confused", req: { holder: "orc" },
      then: [{ s: "skarra", t: "It is a *rock*, you great lump.", m: "gleeful" }, { s: "gnash", t: "Is LUCKY rock. Witch jealous.", m: "happy" }] },
    { s: "gnash", t: "Gnash not throw lucky rock. Lucky rock too lucky for throw. Gnash throw OTHER rock.", m: "confused", req: { holder: "orc" } },
    { s: "gnash", t: "Hey! That LUCKY ROCK! Give Gnash lucky rock! Gnash trade… Gnash trade you normal rock!", m: "angry", req: { holder: "other" } },
    { s: "gnash", t: "You got lucky rock?! Is not fair! Is lucky AND rock! Gnash only have rock!", m: "sad", req: { holder: "other" } },
    { s: "gnash", t: "Gnash coming for lucky rock. Not for war. Just rock. …Also war.", m: "angry", req: { holder: "other" } },
  ],
};

// ---------------------------------------------------------------------------
// ALDRIC AND GOLDIE (2026-09-26, user-directed): an unlikely friendship
// between the Lord-Paladin and the keeper of The Goose & Kettle. Friendly
// until Westmarch and the Hearthlands have fought ("aldricGoldieFriendly");
// after that, hurt and angry, each sure the other should do more to end the
// war ("aldricGoldieSour"). Fired now and then by js/engine/story.js
// pollState when the player is human or halfellow and both are alive.
// ---------------------------------------------------------------------------
Object.assign(window.GameData.STORY_BARKS.world, {
  aldricGoldieFriendly: {
    caption: "A letter crosses between Westmarch and The Goose & Kettle.",
    lines: [
      { s: "aldric", t: "*(his letter)* “Mistress Trickgrin. Enclosed: forty silver toward my tab, and a blessing for the new ale. The Dawn approves of the new ale.”", m: "happy",
        then: [{ s: "goldie", t: "*(her reply)* “Forty silver, received. Three hundred and sixty to go. The ale doesn't need blessing, love. It needs *drinking*.”", m: "happy" }] },
      { s: "goldie", t: "*(her letter)* “Lord-Paladin. Your knights came through last week and nobody broke a single chair. I'm told you gave a speech about it. Thank you.”", m: "happy",
        then: [{ s: "aldric", t: "*(his reply)* “It was a *short* speech, Mistress Trickgrin. For me.”", m: "happy" }] },
      { s: "aldric", t: "*(his letter)* “I have been asked, by the Archmage, whether you and I are *friends*. I told him the Dawn smiles on anyone who keeps a warm hearth for strangers.”", m: "fervent",
        then: [{ s: "goldie", t: "*(her reply)* “Tell the Archmage yes. And tell him his tab's open too, now. He had two pies.”", m: "happy" }] },
      { s: "goldie", t: "*(her letter)* “Sending a pie for your paladins. Apple. Don't let the Temple bless it, it'll go cold.”", m: "happy",
        then: [{ s: "aldric", t: "*(his reply)* “We blessed it anyway. It was still warm. I believe that counts as a miracle.”", m: "fervent" }] },
      { s: "aldric", t: "*(his letter)* “Mistress Trickgrin. There is a war coming to the Marches. Whatever happens between our crowns, your door will always be safe from my knights. On my oath.”", m: "fervent",
        then: [{ s: "goldie", t: "*(her reply)* “And yours from my pitchforks, love. Mind you keep it.”", m: "stern" }] },
    ],
  },
  aldricGoldieSour: {
    caption: "A letter crosses between Westmarch and The Goose & Kettle.",
    lines: [
      { s: "goldie", t: "*(her letter)* “Another farm burned near the river. You swore on your Dawn my door would be safe. Is a farmhouse not a door?”", m: "angry",
        then: [{ s: "aldric", t: "*(his reply)* “I swore for my own knights, and I have kept it. Ask your Mayor who sent militia against our supply wagons.”", m: "angry" }] },
      { s: "aldric", t: "*(his letter)* “Goldie. Your pies are still being eaten in the Cathedral kitchens. Nobody will say where they came from. Please ask your sister to talk to mine.”", m: "sad",
        then: [{ s: "goldie", t: "*(her reply)* “I've asked her every night. Have *you* asked yours? Or just prayed at her?”", m: "angry" }] },
      { s: "goldie", t: "*(her letter)* “I closed your tab today. Not because you paid it. Because I don't want your name in my book any more.”", m: "sad",
        then: [{ s: "aldric", t: "*(his reply)* “Then I'll pay it anyway. Every silver. And I'll keep praying for your regulars, whether you want my prayers or not.”", m: "sad" }] },
      { s: "aldric", t: "*(his letter)* “Your militia laid a trap on the ford road. Two of my squires, Goldie. *Squires*. They were fourteen.”", m: "angry",
        then: [{ s: "goldie", t: "*(her reply)* “Tom Bramblewick was seventy. He taught you darts. Don't you dare count your dead at me as if mine don't count.”", m: "angry" }] },
      { s: "goldie", t: "*(her letter)* “You're the only one of them I ever liked. That's why I'm so angry with you, you great tin fool. *Do* something.”", m: "sad",
        then: [{ s: "aldric", t: "*(his reply)* “I am trying. You have no idea how hard I am trying. …Save me a stool. For after.”", m: "sad" }] },
    ],
  },
});

// Aldric, right: faith that holds when reason doesn't (2026-09-26, user-
// directed: he shouldn't only ever lose to Corvin).
window.GameData.STORY_BARKS.home.unitWin.lines.push(
  { s: "aldric", t: "The line held, Archmage. Your wards broke at the second charge. My knights didn't.", m: "fervent",
    then: [{ s: "corvin", t: "…Noted. With some irritation.", m: "wry" }] },
  { s: "aldric", t: "They broke when the sun rose behind us. Explain *that* in your lecture, Archmage.", m: "fervent",
    then: [{ s: "corvin", t: "Morale, glare, and timing. …I'll admit the timing was *uncanny*.", m: "wry" }] },
);
window.GameData.STORY_BARKS.home.unitLost.lines.push(
  { s: "aldric", t: "I sat with him at the end. He wasn't afraid. That's what the Dawn is for, Archmage. Not for winning.", m: "sad",
    then: [{ s: "corvin", t: "…I've never once seen a lens that could do that.", m: "sad" }] },
);
window.GameData.STORY_BARKS.world.storm.lines.push(
  { s: "corvin", t: "Lightning, Lord-Paladin. Simple weather. It strikes at random.", m: "wry", req: { alive: "human" },
    then: [{ s: "aldric", t: "Then explain why it missed every chapel and hit the enemy siege tower. *Twice*.", m: "fervent" }, { s: "corvin", t: "…I'm working on it.", m: "sad" }] },
);
window.GameData.STORY_BARKS.advance.human.lines.push(
  { s: "corvin", t: "{tech}. Odd. The spell only takes when the caster is certain it will. We don't have a word for that in the Collegium.", cat: "mystic", m: "wry",
    then: [{ s: "aldric", t: "The Temple does, Archmage. We call it faith.", m: "fervent" }, { s: "corvin", t: "…I'll need to think about that. Quietly. Somewhere you aren't.", m: "wry" }] },
  { s: "aldric", t: "{tech}. My knights will carry it into battle with a prayer on their lips. It will not fail them. Nothing has, yet.", cat: "military", m: "fervent",
    then: [{ s: "maren", t: "He's right, Archmage. Their losses are half what the Collegium predicted. Every time.", m: "resolute" }] },
);

// ---------------------------------------------------------------------------
// MAREN'S ORDERS (2026-09-26, user-directed: Maren should be proactive).
// After the "maren:resolve" scene, now and then she moves first -- see
// js/engine/story.js pollState.
// ---------------------------------------------------------------------------
window.GameData.STORY_BARKS.home.marenOrders = {
  caption: "The Queen's orders go out from {capital}.",
  lines: [
    { s: "maren", t: "New orders. We don't wait for their next move. We find out what they're planning, and we get there first.", m: "resolute" },
    { s: "maren", t: "Archmage, I want every enemy border scouted by the week's end. Lord-Paladin, have your knights ready to ride the day he reports.", m: "resolute",
      then: [{ s: "corvin", t: "The week's end. Yes, Majesty.", m: "happy" }] },
    { s: "maren", t: "I've read the reports. Our enemies expect us to defend. So we won't.", m: "resolute" },
    { s: "maren", t: "Send envoys to every crown in the Marches. Not to beg. To tell them what Westmarch will do, before they have to guess.", m: "resolute",
      then: [{ s: "aldric", t: "Finally. The Dawn favours the bold, sister.", m: "fervent" }] },
    { s: "maren", t: "I'm moving the war council to the front. If I'm going to give orders, I'd like to see where they land.", m: "resolute" },
    { s: "maren", t: "The Collegium and the Temple will both have their say. After I've already decided.", m: "happy" },
    { s: "maren", t: "Every city strengthens its walls this season, and every one of them is told *why*. A kingdom that knows the plan fights harder.", m: "resolute" },
  ],
};
