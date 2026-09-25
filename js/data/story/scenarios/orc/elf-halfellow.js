/**
 * STORY SCENARIO -- orc/elf+halfellow, "Hedge and Grove"
 * The two gentlest peoples, and the most land. Is taking from the soft ones
 * strength, or just hunger? B3: Grukka meets Hobby and Aelthir at the same
 * burned hedge, and doesn't enjoy the answer. Threads: feud (shared).
 * Shared defaults: js/data/story/shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/elf+halfellow"] = {
  title: "Hedge and Grove",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!" },
      { s: "grukka", t: "The Elves' forest. The halfellows' fields. The two softest peoples in the Marches, sitting on the most land. And us in the bog." },
      { s: "skarra", t: "The moss-haired crow AND the goose-girl! Skarra has waited SO LONG for this!" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher." },
      { s: "gnash", t: "Soft peoples! Gnash like soft! Soft is easy smash! …Soft peoples have geese?" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount." },
      { s: "varg", t: "If they're so soft, Father, why have they held that land for a thousand years, and we haven't held anything?" },
      { n: "Nobody at the Speaking Stones has an answer. Skarra hisses at him." },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Orc warriors and elf rangers have clashed in the first skirmish of the war.", req: { firstBlood: "elf" },
        alt: "The hedgerows of the Hearthlands, at dawn. Orc raiders and halfellow militia have clashed for the first time since the Goose Rout." },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood! The ancestors are HUNGRY, little Warchief!" },
      { s: "gnash", t: "Gnash love avenging! Avenging is smashing with extra reasons!" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "The ancestors say avenge the fallen, Father. What if I don't want anyone to fall?" },
    ],
    // Strength, or hunger?
    B3: [
      { n: "A burned hedge at the border where the Silverwood meets the Hearthlands. Grukka has come to see what his raiders did. He is not the only one." },
      { n: "An ancient elf in grey stands on one side of the ashes: Aelthir Moonveil, Warden of the Silverwood. A halfellow in a patched coat stands on the other: Hobby Trickgrin, Mayor of the Hearthlands." },
      { s: "hobby", t: "Warchief! Lovely to finally meet you. You burned my hedge." },
      { s: "grukka", t: "I did." },
      { s: "aelthir", t: "And three of my groves. May I ask why?" },
      { s: "grukka", t: "Because you have the land and we have the bog. Because you're soft, and we're strong." },
      { s: "hobby", t: "Are you, dear? You've burned a hedge. We'll grow it back by spring. What will *you* have by spring?" },
      { n: "Grukka opens his mouth, and finds he has no answer." },
      { s: "aelthir", t: "Taking is not strength, Warchief. It is only hunger. Strength is what you keep, afterwards." },
      { n: "They leave him standing in the ashes. On the ride home, he doesn't speak. Varg rides beside him and says nothing either, which is how he knows the boy agrees with them." },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "Across the Marches, the orc settlements have become real towns, with walls, wells, fields, and hedges. Somebody asked the halfellows how." },
      { s: "grukka", t: "Not a fence. A hearth. …Don't tell anyone I said hearth." },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure." },
      { s: "hobby", t: "*(in the Hearthlands)* She *kept* it. Uncle, the Orcs kept it! I'm almost proud.", req: { alive: "halfellow" } },
      { s: "aelthir", t: "*(in the Silverwood)* Strength is what you keep. He listened.", req: { alive: "elf" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying the Silverwood and the Hearthlands. The forest and the fields are silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { n: "Grukka sits atop the split Marchstone as if it were a throne. The stone is cold." },
      { s: "grukka", t: "All their land. All of it. And the hedges won't grow back by spring. There's nobody to grow them." },
      { s: "varg", t: "It was only hunger, Father. The Warden said so." },
      { s: "grukka", t: "…I know, boy. I know." },
    ],
    "E-Fallen": [
      { n: "The Elves have broken the Orcs. {capital}, the last orc town, is burning, and black Shadowsteeds circle through the smoke.", req: { conqueror: "elf" },
        alt: "The halfellows have broken the Orcs. {capital}, the last orc town, is surrounded by hedges that weren't there yesterday." },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! Beaten by the SOFT ones! Skarra always said so—" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die." },
      { s: "grukka", t: "I'll die with my axe in my hand, sister. Like I always said." },
      { s: "grukka", t: "Take Moss. Ride. Don't look back." },
      { n: "Varg rides into the bog on his dire wolf. No one follows." },
      { s: "vaelis", t: "*(in the ashes)* The weather has cleared. …I find I rather miss it.", req: { conqueror: "elf" } },
      { s: "hobby", t: "*(setting a pie on the Speaking Stones)* For the Warchief. He came to look at the hedge he burned. Most never do.", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Elves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "elf" },
        alt: "The halfellows have won by holding the Marches, but the Bloodmire Clans still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "The soft ones hold the Marches. Beaten by gardeners." },
      { s: "grukka", t: "New fence. Same bog. …This time, we build inside it. And we plant something. Something that grows back by spring." },
    ],
  },
};
