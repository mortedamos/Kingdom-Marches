/**
 * UNIT QUIP DATA
 * --------------
 * Pure data: short, wry one-liners a unit occasionally says in a comic-
 * book word bubble right before taking an action. Purely cosmetic/flavor
 * -- no gameplay effect. See js/engine/quips.js for the RARE random
 * trigger (this file has no opinion on how often a unit speaks, only
 * what it says once the engine has already decided to trigger one) and
 * js/ui/render.js for the bubble rendering.
 *
 * Structure (2026-07-18, user-directed): UNIT_QUIPS[raceId][unitTypeId][action]
 * -- every race x unit-type x action combination that can actually occur in
 * play gets its OWN dedicated pool. There is deliberately no race-wide
 * fallback anymore (a Human Spearguard and a Human Knight used to be able
 * to fall back to the same generic "human" pool; they no longer can) and no
 * separate unit-type-only override layer either -- one flat, fully
 * cross-referenced structure. getRandomQuip() looks up the exact triple and
 * returns null (no quip this time, not a generic substitute) if that exact
 * cell has no data.
 *
 * Shared infrastructure units (Pioneer/Scout/Galley) still get full
 * per-RACE variation -- a Human Pioneer and an Elf Pioneer say different
 * things -- since the same unit TYPE reads very differently through six
 * different racial voices.
 *
 * Actions covered are the ones with a real decision point worth a quip:
 * "attack" and "move" (any unit that can do either), "build_road" and
 * "found" (Pioneer, plus any other canFoundCity unit -- Halfellow's
 * Wanderer, Elf's Druid), and a handful of unit-specific ones: "summon_raptor"/
 * "summon_shadowsteed" (Elf Druid, see ai.js startDruidSummon), "seek_target"
 * (Dwarf Runeforged Titan picking a new city to march on, see ai.js
 * maybeTitanMarch), "prospect" (a unit settling in to start a Gold Vein
 * claim, see ai.js maybeProspectorsClaimPlay). Keep every line well under
 * 40 characters -- render.js sizes the bubble to the text but a short line
 * reads better in a bubble than a paragraph ever would.
 */

window.GameData = window.GameData || {};

window.GameData.UNIT_QUIPS = {
  // =========================================================================
  // HUMAN
  // =========================================================================
  human: {
    pioneer: {
      move: [
        "Westward, or wherever's cheapest.",
        "Boots on, hopes up.",
        "New land waits for no one.",
      ],
      build_road: [
        "A road pays for itself eventually.",
        "Straight, sturdy, taxed later.",
        "This'll speed up the wagons.",
      ],
      found: [
        "Right, claim the deed and dig in.",
        "A city needs a name. And a wall.",
        "Future taxes start right here.",
      ],
    },
    scout: {
      move: [
        "Scouting ahead, as ordered.",
        "Maps don't draw themselves.",
        "Eyes open, boots quiet.",
      ],
      attack: [
        "Didn't expect that, did you.",
        "A quick jab, then I'm gone.",
        "Not what I'm usually paid for.",
      ],
    },
    galley: {
      move: [
        "Set sail, chart the coast.",
        "Trade routes don't map themselves.",
        "Wind's fair. Let's move.",
      ],
      attack: [
        "Ramming speed! Well, some speed.",
        "Not built for this, but here we are.",
        "Hold the line, or the hull.",
      ],
    },
    spearguard: {
      attack: [
        "Hold the line. Hold it well.",
        "This is what the drills were for.",
        "Steady. Strike. Steady again.",
      ],
      move: [
        "Forward, in good order.",
        "Formation holds, boots march.",
        "One step, then the next.",
      ],
    },
    cavalry: {
      attack: [
        "Charge first, questions later.",
        "Out of the saddle, into the fray.",
        "This is the fun part, honestly.",
      ],
      move: [
        "Hooves down, dust up.",
        "Fastest way there, always.",
        "Scouting's for walkers. I ride.",
      ],
    },
    knight: {
      attack: [
        "For honor, mostly. Some glory too.",
        "A duel, if you insist.",
        "Chivalry has limits. This isn't one.",
      ],
      move: [
        "Onward, banner held high.",
        "The road to glory is often muddy.",
        "A knight's errand, more or less.",
      ],
    },
    archer: {
      attack: [
        "Mark. Draw. Regret.",
        "From here, you never saw it coming.",
        "Distance is my best friend.",
      ],
      move: [
        "Higher ground, always higher ground.",
        "Quiver full, patience thin.",
        "Scouting the next good vantage point.",
      ],
    },
    longbowman: {
      attack: [
        "Further than you'd think. Trust me.",
        "This bow's earned its reputation.",
        "One shaft, one very bad day for you.",
      ],
      move: [
        "A longbow needs room to work.",
        "Vantage points, always vantage points.",
        "Marching to where the range favors me.",
      ],
    },
    catapult: {
      attack: [
        "Loading. Releasing. No regrets.",
        "Gravity does most of the work, really.",
        "Incoming! That part's obvious.",
      ],
      move: [
        "Slowly. Very, very slowly.",
        "Wheels turning, dignity intact.",
        "We'll get there. Eventually.",
      ],
    },
    trebuchet: {
      attack: [
        "Physics, but make it violent.",
        "That wall had it coming.",
        "Counterweight's counting on you.",
      ],
      move: [
        "An inch at a time, with purpose.",
        "Siege engines move slow. So do I.",
        "Slow is a feature, not a bug.",
      ],
    },
    wizard: {
      attack: [
        "Let me just... consult the theory first.",
        "This spell is mostly tested!",
        "Ah, the fun kind of magic.",
      ],
      move: [
        "Consulting the map. And the stars.",
        "Walking, but thinking hard about it.",
        "The theory suggests this way.",
      ],
    },
  },

  // =========================================================================
  // ELF
  // =========================================================================
  elf: {
    pioneer: {
      move: [
        "The land will tell me where.",
        "Slow steps, patient roots.",
        "Somewhere quiet calls.",
      ],
      build_road: [
        "A gentle path, nothing more.",
        "The soil forgives a light touch.",
        "No scars, just a suggestion.",
      ],
      found: [
        "Here. The trees already agreed.",
        "Roots before rooftops.",
        "A hundred years, then we'll see.",
      ],
    },
    scout: {
      move: [
        "Watching, always watching.",
        "The wind tells me where to look.",
        "Quietly, as elves do.",
      ],
      attack: [
        "A warning shot. Mostly a warning.",
        "You saw me too late.",
        "Elegant, brief, unavoidable.",
      ],
    },
    galley: {
      move: [
        "The tide agrees with us today.",
        "Quiet water, quieter oars.",
        "We drift where the current allows.",
      ],
      attack: [
        "The sea remembers this too.",
        "A brief, unwelcome encounter.",
        "We didn't start this. We'll end it.",
      ],
    },
    ranger: {
      attack: [
        "From here, you never had a chance.",
        "One shot. That's usually enough.",
        "The forest aimed this one for me.",
      ],
      move: [
        "Silent, as the trees prefer.",
        "Tracking something. Or someone.",
        "The path finds itself, mostly.",
      ],
    },
    blade_dancer: {
      attack: [
        "A dance, brief and final.",
        "Wind and steel, in that order.",
        "You blinked. That was the mistake.",
      ],
      move: [
        "Light feet, lighter conscience.",
        "Every step is half a step, really.",
        "Grace first. Everything else follows.",
      ],
    },
    druid: {
      attack: [
        "Nature has opinions about you.",
        "Not my favorite way to help, but fine.",
        "The forest lends me its patience. Briefly.",
      ],
      move: [
        "The old paths remember me.",
        "Roots guide, I merely follow.",
        "Somewhere the forest needs me.",
      ],
      found: [
        "The grove approves of this spot.",
        "New roots, ancient patience.",
        "A druid's blessing on this ground.",
      ],
      summon_raptor: [
        "Come, little scout. Fly far.",
        "Eyes in the sky, if you please.",
        "Hatch swift. The forest needs sight.",
        "One egg, one favor asked.",
      ],
      summon_shadowsteed: [
        "Shadow, take shape. Take a rider.",
        "From dusk, a steed. From need, a weapon.",
        "This one is not for scouting.",
        "Come, and carry something dangerous.",
      ],
    },
    raptor: {
      move: [
        "Wings up, eyes sharper.",
        "So much sky, so little time.",
        "Scouting is simply flying with purpose.",
      ],
      attack: [
        "Talons out. Wasn't the plan.",
        "A scout, forced to fight.",
        "This is not what I'm good at.",
      ],
    },
    shadowsteed: {
      attack: [
        "We strike as one shadow now.",
        "Borrowed strength, freely spent.",
        "The dark carries more than hooves.",
      ],
      move: [
        "Silent hooves on silent ground.",
        "Shadow-born, shadow-swift.",
        "Somewhere out there, a rider waits.",
      ],
    },
    awakened_oak: {
      attack: [
        "The forest itself objects to you.",
        "Slow to anger. Thorough once angered.",
        "Centuries of patience, spent all at once.",
      ],
      move: [
        "Roots become legs, briefly.",
        "The grove sent its oldest.",
        "One step shakes the ground.",
      ],
    },
  },

  // =========================================================================
  // DWARF
  // =========================================================================
  dwarf: {
    pioneer: {
      move: [
        "Better ground's out there somewhere.",
        "Pack's heavy, feet are heavier.",
        "Onward, before I reconsider.",
      ],
      build_road: [
        "Proper stonework, none of that mud.",
        "Level it twice, dig once.",
        "This'll carry ore for centuries.",
      ],
      found: [
        "Solid rock underfoot. Good sign.",
        "Cellar first, everything after.",
        "Stake the claim, mind the boundary.",
      ],
    },
    scout: {
      move: [
        "Someone's got to map the tunnels.",
        "Eyes forward, boots steady.",
        "Scouting's dull work, honestly.",
      ],
      attack: [
        "Didn't sign up for this, but fine.",
        "One good jab, then I run.",
        "Not my job, but I'll manage.",
      ],
    },
    galley: {
      move: [
        "Water's not stone, but it'll do.",
        "Onward, against my better judgment.",
        "Ballast checked. Onward.",
      ],
      attack: [
        "Not what this hull was built for.",
        "Ramming's basically masonry, right?",
        "Hold steady, brace the timbers.",
      ],
    },
    foehammer: {
      attack: [
        "This is going in the grudge book too.",
        "Hammer down, questions later.",
        "Stand still. It's faster that way.",
      ],
      move: [
        "Onward, boots and all.",
        "Marching builds character, allegedly.",
        "Uphill again. Naturally.",
      ],
      prospect: [
        "Gold in this rock. I can feel it.",
        "Right, staking my claim here.",
        "Nobody touches my vein. Nobody.",
        "This'll do. Settling in.",
      ],
    },
    troubadour: {
      attack: [
        "A power chord, and a real one.",
        "This riff's about to get violent.",
        "Let the axe-guitar do the talking.",
      ],
      move: [
        "Tuning up for the march.",
        "Every journey needs a soundtrack.",
        "Onward, with feeling.",
      ],
    },
    musketeer: {
      attack: [
        "Powder's dry, aim's true.",
        "Loud, sudden, effective.",
        "Reloading is the only slow part.",
      ],
      move: [
        "Rifle slung, boots steady.",
        "Scouting before the shooting starts.",
        "Onward, mind the powder horn.",
      ],
    },
    runeforged_titan: {
      attack: [
        "The forge remembers.",
        "Runes charged. Regret imminent.",
      ],
      move: [
        "One step. The ground remembers it.",
        "Slow, deliberate, unstoppable.",
        "The forge sent me walking.",
      ],
      seek_target: [
        "That one. That city will do.",
        "A destination, finally.",
        "Mark it. We march at dawn.",
        "Something to crush on the horizon.",
      ],
    },
  },

  // =========================================================================
  // ORC
  // =========================================================================
  orc: {
    pioneer: {
      move: [
        "MOVING. FOUND NOTHING YET.",
        "New dirt, same ambitions.",
        "Somewhere to plant a flag.",
      ],
      build_road: [
        "Flatten it, we're not fussy.",
        "Fastest route to the fighting.",
        "Good enough. Next.",
      ],
      found: [
        "Mine now. Say otherwise, I dare you.",
        "New camp, old grudges.",
        "Claimed. Someone bring the flag.",
      ],
    },
    scout: {
      move: [
        "SNEAKING. LOUDLY, APPARENTLY.",
        "Looking for trouble, per usual.",
        "Scouting means finding a fight first.",
      ],
      attack: [
        "Free hit, don't mind if I do.",
        "Wasn't planning to, but here we are.",
        "Small blade, big attitude.",
      ],
    },
    galley: {
      move: [
        "FLOATING. LOUDLY.",
        "The sea's just wet ground.",
        "Onward, before someone gets seasick.",
      ],
      attack: [
        "Ram it! Ram it now!",
        "Wet fighting's still fighting.",
        "Wood versus wood, let's go.",
      ],
    },
    raider: {
      attack: [
        "Didn't even warm up first.",
        "This is the whole plan, actually.",
        "Hit first, brag later.",
      ],
      move: [
        "MOVING. TOWARD TROUBLE, PROBABLY.",
        "Somewhere to be. Probably a fight.",
        "Walking's just fighting that hasn't started.",
      ],
    },
    impaler: {
      attack: [
        "Point first. Questions never.",
        "Hold still, this works better that way.",
        "SPEAR SAYS HELLO.",
      ],
      move: [
        "Marching, spear at the ready.",
        "Somewhere sharp needs to be.",
        "Onward, point forward.",
      ],
    },
    wolf_rider: {
      attack: [
        "Fast in, faster out.",
        "The wolf agrees with this plan.",
        "Bite first, ask never.",
      ],
      move: [
        "Wolf's faster than you'd like.",
        "Scouting at a dead sprint.",
        "Somewhere to be, quickly.",
      ],
    },
    bog_witch: {
      attack: [
        "A little curse for your trouble.",
        "The bog whispers your name now.",
        "This will sting. And linger.",
      ],
      move: [
        "The bog whispers directions.",
        "Slow steps, old magic.",
        "Somewhere damp calls to me.",
      ],
    },
    battering_ram: {
      attack: [
        "That door's not an obstacle anymore.",
        "Wood versus wood. Wood wins.",
        "Knock knock. Ram's home.",
      ],
      move: [
        "Rolling forward, slow and heavy.",
        "Onward, one creak at a time.",
        "The door doesn't know yet.",
      ],
    },
    ogre: {
      attack: [
        "OGRE SMASH.",
        "Small target. Big swing.",
        "SMASH!",
        "Heh heh heh...",
        "Fee Fi Fo Fum...",
      ],
      move: [
        "Big steps. Bigger dents in the road.",
        "Walking is basically smashing, slowly.",
        "Onward. Ground complains, mostly.",
      ],
    },
    dragon: {
      attack: [
        "You woke me up for this.",
        "Flame first, questions never.",
      ],
      move: [
        "I smell dinner...",
        "Wings first, thoughts later.",
        "The sky belongs to me anyway.",
      ],
    },
    goblin_miscreant: {
      attack: [
        "Small blade, surprising results.",
        "In, stab, out. Simple plan.",
        "Nobody expects the little one.",
		"Hahahahaha!",
      ],
      move: [
        "Scurrying toward mischief.",
        "Somewhere small and useful to be.",
        "Fast feet, quick blade...",
      ],
    },
  },

  // =========================================================================
  // UNDEAD
  // =========================================================================
  undead: {
    pioneer: {
      move: [
        "No rush. Eternity's patient.",
        "One more place to eventually own.",
        "Shambling toward destiny.",
      ],
      build_road: [
        "A road the living will use, mostly.",
        "Digging suits me. Familiar.",
        "Well-worn, like everything about me.",
      ],
      found: [
        "A new plot. Fitting, really.",
        "This will do for the centuries ahead.",
        "Settling in. Permanently, I'd wager.",
      ],
    },
    scout: {
      move: [
        "Wandering has no urgency for me.",
        "I've seen this ground before. Maybe.",
        "Looking, without much hope.",
      ],
      attack: [
        "A jab from beyond, so to speak.",
        "Barely worth the effort. Still.",
        "Even scouts must occasionally bite.",
      ],
    },
    galley: {
      move: [
        "The waves don't bother me anymore.",
        "Drifting toward the next shore.",
        "No breath needed for this voyage.",
      ],
      attack: [
        "Even drowned men can still fight.",
        "This won't take long. Nothing does.",
        "The hull creaks. So do I.",
      ],
    },
    skeleton: {
      attack: [
        "Bone against flesh. Bone usually wins.",
        "Already dead. Nothing left to lose.",
        "This won't take long. Nothing does.",
      ],
      move: [
        "Rattling toward purpose.",
        "No hurry. I've got eternity.",
        "One bone in front of the other.",
      ],
    },
  },

  // =========================================================================
  // HALFELLOW
  // =========================================================================
  halfellow: {
    pioneer: {
      move: [
        "Onward! Snack break at noon.",
        "New ground, new garden plots.",
        "Let's find somewhere lovely.",
      ],
      build_road: [
        "A tidy little lane, if I say so.",
        "Good for carts and picnics both.",
        "There, all properly connected.",
      ],
      found: [
        "Cozy spot. Room for a garden.",
        "This calls for tea, I think.",
        "Home! Someone put the kettle on.",
      ],
    },
    scout: {
      move: [
        "Just having a look 'round!",
        "Nosing about, as one does.",
        "Someone's got to check the map.",
      ],
      attack: [
        "Oh! Well, that escalated.",
        "Didn't mean to, but there it is.",
        "A little poke, nothing personal.",
      ],
    },
    galley: {
      move: [
        "Off we sail! Pack the snacks.",
        "Lovely day for it, all told.",
        "Anchors up, kettle on.",
      ],
      attack: [
        "Oh dear, a sea battle now?",
        "Didn't pack for THIS.",
        "Right, brace yourselves, everyone!",
      ],
    },
    wanderer: {
      attack: [
        "Well, this is unexpected!",
        "Sorry in advance, truly.",
        "Right, deep breath, here goes!",
      ],
      move: [
        "Off on an adventure, apparently.",
        "Packed light, hoping for the best.",
        "Wandering with purpose, mostly.",
      ],
      found: [
        "What a lovely spot to settle!",
        "This'll do nicely, I think.",
        "New home! Kettle's going on.",
      ],
    },
    pony_patrol: {
      attack: [
        "Didn't expect to gallop into THIS.",
        "Quick trot, quicker regrets.",
        "Sorry, pony! Had to be done.",
      ],
      move: [
        "Trotting along, nice and steady.",
        "Ponies love a good ride, mostly.",
        "Off we clip-clop!",
      ],
    },
    militia: {
      attack: [
        "Right, everyone, form up! Sort of!",
        "We practiced this. Sort of.",
        "For hearth and home, then!",
      ],
      move: [
        "Marching in, uh, formation-ish.",
        "Boots on, resolve wobbly but present.",
        "Off to defend something, probably.",
      ],
    },
  },
};

/**
 * Returns a random quip string for the exact (race, unit type, action)
 * triple, or null if that cell has no data -- callers should skip the quip
 * entirely, not fall back to something generic (there is no generic pool
 * anymore, see the file header for why).
 */
window.GameData.getRandomQuip = function (raceId, unitTypeId, action) {
  const pool = window.GameData.UNIT_QUIPS[raceId]?.[unitTypeId]?.[action];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
};
