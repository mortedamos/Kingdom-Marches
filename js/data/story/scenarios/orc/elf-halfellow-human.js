/**
 * STORY SCENARIO -- orc/elf+halfellow+human, "The Soft March"
 * Winning looks easy and isn't; holding it is the real test. THREAD (bible
 * §13.11, Moss Falls): at B4 Moss is shot by elven rangers on Vaelis's
 * order; Varg turns cruel and stops arguing for building, just when the
 * Clans need a builder most. B5: Skarra courts him for her coup. Endings
 * shaded by whether Varg comes back (Held: slowly; Remains: no).
 * Threads: feud, whisper (shared). Shared defaults: shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/elf+halfellow+human"] = {
  title: "The Soft March",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!" },
      { s: "grukka", t: "No Dwarves. No mountain walls. Just forest, fields and roads. The softest march in the whole of the Marches." },
      { s: "skarra", t: "SOFT! Skarra LOVES soft! Soft BURNS!" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher." },
      { s: "gnash", t: "Soft! Easy smash! …Soft places have geese. Gnash KNOWS it." },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount." },
      { s: "varg", t: "Taking soft land is easy, Father. Keeping it isn't. Nobody's ever kept the Marches by burning them." },
      { s: "grukka", t: "Then you'll show me how, boy. You and that wolf of yours." },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Orc warriors and elf rangers have clashed in the first skirmish of the war.", req: { firstBlood: "elf" },
        alt: { n: "The hedgerows of the Hearthlands, at dawn. Orc raiders and halfellow militia have clashed for the first time since the Goose Rout.", req: { firstBlood: "halfellow" },
          alt: "The river road, at dusk. Orc raiders and human soldiers have clashed over a supply wagon, the first battle of the war." } },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood! The ancestors are HUNGRY, little Warchief!" },
      { s: "gnash", t: "Gnash love avenging! Avenging is smashing with extra reasons!" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "The ancestors say avenge the fallen, Father. What if I don't want anyone to fall?" },
    ],
    // MOSS FALLS (bible §13.11)
    B4: [
      { n: "The forest's edge, at dusk. Varg has ridden out alone on Moss to scout the elf lines, as he has a hundred times before. Moss always knows the way." },
      { n: "An arrow sings out of the silver trees. Then another. Elf rangers, on the border, with orders." },
      { n: "Moss takes both arrows meant for his rider, and carries Varg home through the reeds before he lies down in the mud at the edge of {capital}, and does not get up." },
      { fx: { flag: "mossDead" } },
      { s: "varg", t: "*(holding the wolf's great grey head)* Moss. Moss. You know the way. You always know the way. …Get *up*." },
      { n: "A message arrives from the Silverwood the next morning, in fine silver ink, addressed to no one in particular." },
      { s: "vaelis", t: "*(his message)* “Our rangers report they have removed a wolf that had been scouting our borders. We trust the matter is closed.”" },
      { n: "Varg buries Moss himself, alone, under a dead tree at the edge of the bog. When he comes back, he walks straight past his half-built halls without looking at them." },
      { s: "varg", t: "*(to his father)* No more building. Forest, fields, roads. We burn all of it. Starting with the trees." },
      { s: "skarra", t: "*(delighted)* FINALLY! A Warchief's son with TEETH! Oh, Skarra is so PROUD!" },
      { n: "Grukka looks at his son for a long time. He has wanted this all the boy's life. Now that he has it, he finds he doesn't want it at all." },
    ],
    // Skarra's coup, courting the new Varg.
    B5: [
      { n: "Dawn at the Speaking Stones. Every clan of the Bloodmire has been summoned. Skarra stands atop the tallest stone, with Gnash and his cleaver beside her. And, to one side, Varg." },
      { s: "skarra", t: "Hear me, clans of Bloodmire! The elves shot the Warchief's son's wolf, and what did the Warchief do? *Nothing*! He's gone SOFT! Soft as the march he wants to *keep*!" },
      { s: "skarra", t: "But her SON hasn't! Varg! Stand with Skarra! Together we'll burn the whole soft march, for Moss!" },
      { n: "Every eye turns to Varg. For a long moment, he says nothing." },
      { s: "varg", t: "I'll burn it, aunt. But not for you. You never once said his name before today." },
      { s: "grukka", t: "You'd use my son's grief to steal my seat, Skarra." },
      { s: "skarra", t: "Skarra would use ANYTHING!" },
      { s: "grukka", t: "I keep my word. That's why the Clans follow me. And my word is this: get out of my bog. Take your frog." },
      { s: "gnash", t: "Gnash stay. Witch never has snacks." },
      { n: "Skarra flees into the mist, shrieking. Destiny the frog hops the other way." },
      { s: "skarra", t: "This isn't over! The bog remembers! Destiny remembers! …Destiny, come BACK!" },
      { s: "grukka", t: "*(to Varg, when the clans have gone)* You didn't go with her." },
      { s: "varg", t: "She'd have made me a weapon, Father. I'd rather be one on my own." },
    ],
    B6: [
      { n: "Evening in {capital}. The timber halls Varg started before the war stand half-finished. The soft march is burning at its edges, and nobody in the Clans knows how to hold what they've taken." },
      { s: "grukka", t: "Your halls, boy. We need them now. Every town we've taken is emptying. Nobody knows how to *keep*." },
      { s: "varg", t: "Moss knew the way, Father. I don't any more." },
      { s: "grukka", t: "I spent your whole life telling you to be harder. …I was wrong, boy. Finish the wall. For Moss. He'd want somewhere dry to lie." },
      { n: "Varg doesn't answer. But the next morning, somebody has put up two more planks." },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands. The soft march has been kept." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "Not a fence. A hearth. …Don't tell anyone I said hearth." },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure." },
      { n: "That evening, Varg finishes the last wall of his timber hall. At its door, he carves a wolf.", req: { flag: "mossDead" },
        alt: "That evening, Varg finishes the last wall of his timber hall. Moss sleeps in the doorway." },
      { s: "varg", t: "*(to the carving)* You'd like it here, Moss. It's dry.", req: { flag: "mossDead" } },
      { n: "Varg doesn't smile yet. But he's closer than he was.", req: { flag: "mossDead" } },
      { s: "hobby", t: "*(in the Hearthlands)* The Orcs kept the Marches. With halls, and walls, and a carved wolf on every door. Uncle, write it down.", req: { alive: "halfellow", flag: "mossDead" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying the Silverwood, the Hearthlands and Westmarch. The forest, the fields and the roads are silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { n: "Grukka sits atop the split Marchstone as if it were a throne. The stone is cold." },
      { s: "grukka", t: "We took the soft march. All of it. And nobody kept anything." },
      { n: "Varg stands below, his axe still wet. He burned the last grove himself.", req: { flag: "mossDead" },
        alt: "Varg stands below, one hand in Moss's grey fur." },
      { s: "varg", t: "Nothing to keep, Father. That was the point.", req: { flag: "mossDead" },
        alt: "Each other, Father. Try that." },
      { s: "grukka", t: "*(very quietly)* …I wanted you harder. I got my wish. Ancestors forgive me.", req: { flag: "mossDead" } },
    ],
    "E-Fallen": [
      { n: "The Elves have broken the Orcs. {capital}, the last orc town, is burning, and black Shadowsteeds circle through the smoke.", req: { conqueror: "elf" },
        alt: { n: "The halfellows have broken the Orcs. {capital}, the last orc town, is surrounded by hedges that weren't there yesterday.", req: { conqueror: "halfellow" },
          alt: "Westmarch has broken the Orcs. {capital}, the last orc town, is burning, and the Knights of the Dawn are at its gates." } },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! Beaten by the SOFT march! Skarra always said so—" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die." },
      { s: "grukka", t: "I'll die with my axe in my hand, sister. Like I always said." },
      { s: "grukka", t: "Ride, boy. Don't look back.", req: { flag: "mossDead" }, alt: "Take Moss. Ride. Don't look back." },
      { n: "Varg rides into the bog on a borrowed wolf that doesn't know the way. No one follows.", req: { flag: "mossDead" },
        alt: "Varg rides into the bog on his dire wolf. No one follows." },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Elves have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "elf" },
        alt: { n: "The halfellows have won by holding the Marches, but the Bloodmire Clans still stand.", req: { winner: "halfellow" },
          alt: "Westmarch has won by holding the Marches, but the Bloodmire Clans still stand." } },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "New fence. Same bog. …This time, we build inside it." },
      { s: "varg", t: "Build, Father. And I'll guard it. Nobody shoots anything of ours again.", req: { flag: "mossDead" },
        alt: "Then let's build, Father. Moss wants a porch." },
    ],
  },
};
