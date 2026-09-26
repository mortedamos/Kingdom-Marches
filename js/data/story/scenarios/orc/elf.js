/**
 * STORY SCENARIO -- orc/elf, "The Fenced Forest"
 * The elves kept the best land for a thousand years, and Vaelis doesn't
 * know Grukka's name. Skarra and Ysolde's eighty-year feud comes to a head
 * (shared feud:*). THREAD (bible §13.11, Moss Falls): at B4 Moss is shot by
 * elven rangers on Vaelis's order; Varg turns cruel. Skarra is delighted,
 * and at B5 tries to recruit him for her coup. Grukka is torn. Endings
 * shaded by whether Varg comes back: on Held he does, slowly; on Remains
 * he doesn't. Shared defaults: js/data/story/shared/orc.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["orc/elf"] = {
  title: "The Fenced Forest",
  beats: {
    B0: [
      { n: "The Bloodmire, the swamp country of the Orcs. Mist hangs low over the mud huts and fire pits, and every frog in the bog has gone silent." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "At the Speaking Stones, an ancient ring of standing stones where the Bog Witches speak with the orc dead, Warchief Grukka Ironjaw, ruler of the Bloodmire Clans, watches the stones tremble." },
      { n: "His elder sister, Skarra the Bog-Mother, rises from the mud with bones rattling in her wild hair. A fat green frog named Destiny rides on her shoulder." },
      { s: "skarra", t: "The Marchstone, little Warchief! SPLIT in two! Now the Marches pass to the crown that HOLDS them, or else to the crown that REMAINS!", m: "gleeful" },
      { s: "grukka", t: "The Accord gave the Elves the Silverwood, the best land in the Marches. It gave us the bog. That stone was a fence, sister. Fences break.", m: "angry" },
      { n: "A huge shape shoulders through the crowd: Gnash, the ogre who serves as the clans' butcher, grinning over a cleaver the size of a door." },
      { s: "gnash", t: "Fence break! Gnash smash fence MORE, to be sure!", m: "happy" },
      { n: "At the edge of the torchlight stands Varg, Grukka's son, one hand buried in the fur of Moss, his grey dire wolf mount." },
      { s: "varg", t: "Moss can smell the forest from here, Father. It smells like… rain. Like things growing.", m: "bashful" },
      { s: "skarra", t: "It smells like the moss-haired crow! Eighty years, Skarra has waited to burn that witch's spring!", m: "gleeful" },
      { n: "In the Silverwood, the Elves' ancient forest, Lord Vaelis Nightbloom, heir to the Warden's seat, is told that the Orcs are coming." },
      { s: "vaelis", t: "Orcs. Yes. Who leads them now?", m: "aloof" },
      { s: "vaelis", t: "…No, don't tell me. It will change by spring.", m: "aloof" },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Orc warriors and elf rangers have clashed in the first skirmish of the war." },
      { n: "At the Speaking Stones, the ancient standing stones glow red. When an orc falls, the ancestors demand vengeance." },
      { s: "skarra", t: "Blood under the trees! The ancestors are HUNGRY, little Warchief! Avenge them!", m: "gleeful" },
      { s: "gnash", t: "Gnash love avenging! Avenging is smashing with extra reasons!", m: "happy" },
      { n: "Varg says nothing. Grukka notices." },
      { s: "varg", t: "The ancestors say avenge the fallen, Father. What if I don't want anyone to fall?", m: "sad" },
      { s: "vaelis", t: "*(in the Silverwood)* Orcs at the edge of the forest. Like weather. Someone close the shutters.", m: "aloof" },
    ],
    // MOSS FALLS (bible §13.11)
    B4: [
      { n: "The forest's edge, at dusk. Varg has ridden out alone on Moss to scout the elf lines, as he has a hundred times before. Moss always knows the way." },
      { n: "An arrow sings out of the silver trees. Then another. Elf rangers, on the border, with orders." },
      { n: "Moss takes both arrows meant for his rider, and carries Varg home through the reeds before he lies down in the mud at the edge of {capital}, and does not get up." },
      { fx: { flag: "mossDead" } },
      { s: "varg", t: "*(holding the wolf's great grey head)* Moss. Moss. You know the way. You always know the way. …Get *up*.", m: "sad" },
      { n: "A message arrives from the Silverwood the next morning, in fine silver ink, addressed to no one in particular." },
      { s: "vaelis", t: "*(his message)* “Our rangers report they have removed a wolf that had been scouting our borders. We trust the matter is closed.”", m: "aloof" },
      { n: "Varg reads it twice. Then he burns it, and buries Moss himself, alone, under a dead tree at the edge of the bog." },
      { s: "varg", t: "*(to his father)* You always wanted me harder, Father. You've got it. I want every ranger in that forest dead. I want *him* dead.", m: "angry" },
      { s: "skarra", t: "*(delighted)* FINALLY! A Warchief's son with TEETH! Oh, Skarra is so PROUD!", m: "gleeful" },
      { n: "Grukka looks at his son for a long time. He has wanted this all the boy's life. Now that he has it, he finds he doesn't want it at all." },
      { s: "grukka", t: "…Boy.", m: "sad" },
    ],
    // Skarra's coup, courting the new Varg.
    B5: [
      { n: "Dawn at the Speaking Stones. Every clan of the Bloodmire has been summoned. Skarra stands atop the tallest stone, with Gnash and his cleaver beside her. And, to one side, Varg." },
      { s: "skarra", t: "Hear me, clans of Bloodmire! The elves shot the Warchief's son's wolf, and what did the Warchief do? *Nothing*! He's gone SOFT!", m: "gleeful" },
      { s: "skarra", t: "But his SON hasn't! Varg! Stand with Skarra! Together we'll burn the Silverwood to the roots, for Moss!", m: "gleeful", req: { flag: "mossDead" } },
      { n: "Every eye turns to Varg. For a long moment, he says nothing." },
      { s: "varg", t: "I'll burn the Silverwood, aunt. But I won't do it for *you*. You never once said his name before today.", m: "angry" },
      { s: "grukka", t: "You heard him, Skarra. You'd use my son's grief to steal my seat.", m: "angry" },
      { s: "skarra", t: "Skarra would use ANYTHING!", m: "gleeful" },
      { s: "grukka", t: "I keep my word. That's why the Clans follow me. And my word is this: get out of my bog. Take your frog.", m: "angry" },
      { s: "gnash", t: "Gnash stay. Witch never has snacks.", m: "confused" },
      { n: "Skarra flees into the mist, shrieking. Destiny the frog hops the other way." },
      { s: "skarra", t: "This isn't over! The bog remembers! Destiny remembers! …Destiny! Come BACK, you ungrateful FROG!", m: "angry" },
      { n: "When the clans have gone, Grukka stands alone with his son among the standing stones." },
      { s: "grukka", t: "You didn't go with her.", m: "sad" },
      { s: "varg", t: "She'd have made me a weapon, Father. I'd rather be one on my own.", m: "angry" },
    ],
    // Varg doesn't build any more.
    B6: [
      { n: "Evening in {capital}. The timber halls Varg started building before the war stand half-finished. He hasn't touched them since Moss died." },
      { s: "grukka", t: "Your halls, boy. You were going to show me how we keep things.", m: "sad" },
      { s: "varg", t: "We don't keep things, Father. They shoot them. So we take theirs.", m: "angry" },
      { n: "Grukka runs a scarred hand along the unfinished timber wall. It's solid. It's the best thing anyone in the Clans has built in a hundred years." },
      { s: "grukka", t: "I spent your whole life telling you to be harder. …I was wrong, boy. Finish the wall. For Moss. He'd want somewhere dry to lie.", m: "sad" },
      { n: "Varg doesn't answer. But the next morning, somebody has put up two more planks." },
    ],

    "E-Held": [
      { n: "The Orcs have won by holding the Marches. For the first time in history, an orc crown rules the borderlands." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "HELD." },
      { n: "Across the Marches, the orc settlements have become real towns, with walls, wells, and fields that don't rot. The best land in the Marches is no longer behind anyone's fence." },
      { s: "grukka", t: "Not a fence. A hearth.", m: "happy" },
      { s: "grukka", t: "…Don't tell anyone I said hearth.", m: "defiant" },
      { s: "gnash", t: "EVERYONE HEARD. Gnash tell everyone anyway, to be sure.", m: "happy" },
      { s: "vaelis", t: "*(in the Silverwood)* The orcs hold the Marches. …What *was* the Warchief's name?", m: "aloof", req: { alive: "elf" } },
      { s: "grukka", t: "*(on hearing)* Somebody go and tell him. Slowly. Twice.", m: "angry", req: { alive: "elf" } },
      { n: "That evening, Varg finishes the last wall of his timber hall. At its door, he carves a wolf.", req: { flag: "mossDead" },
        alt: "That evening, Varg finishes the last wall of his timber hall. Moss sleeps in the doorway." },
      { s: "varg", t: "*(to the carving)* You'd like it here, Moss. It's dry.", m: "sad", req: { flag: "mossDead" } },
      { n: "Varg doesn't smile yet. But he's closer than he was.", req: { flag: "mossDead" } },
    ],
    "E-Remains": [
      { n: "The Orcs have won by destroying the Elves. The Silverwood is silent." },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "REMAINS." },
      { n: "Grukka sits atop the split Marchstone as if it were a throne. The stone is cold." },
      { s: "grukka", t: "We broke the fence. The best land in the Marches is ours. So what do we keep inside it now?", m: "sad" },
      { n: "Varg stands below, his axe still wet. He burned the last grove himself.", req: { flag: "mossDead" },
        alt: "Varg stands below, one hand in Moss's grey fur." },
      { s: "varg", t: "Nothing, Father. There's nothing left to keep. That was the point.", m: "sad", req: { flag: "mossDead" },
        alt: "Each other, Father. Try that." },
      { s: "grukka", t: "*(very quietly)* …I wanted you harder. I got my wish. Ancestors forgive me.", m: "sad", req: { flag: "mossDead" } },
    ],
    "E-Fallen": [
      { n: "The Elves have broken the Orcs. {capital}, the last orc town, is burning, and black Shadowsteeds circle through the smoke." },
      { n: "Skarra staggers out of the smoke, back from exile, clutching Destiny the frog to her chest." },
      { s: "skarra", t: "Look what you've DONE, little Warchief! You lost the bog! You lost the Clans! Skarra always said so, Skarra ALWAYS SAID—", m: "angry" },
      { s: "skarra", t: "*(her voice cracks)* …You were always the favourite. I HATE you. Don't die.", m: "sad" },
      { s: "grukka", t: "I'll die with my axe in my hand, sister. Like I always said.", m: "defiant" },
      { s: "grukka", t: "Ride, boy. Don't look back.", m: "sad", req: { flag: "mossDead" }, alt: "Take Moss. Ride. Don't look back." },
      { n: "Varg rides into the bog on a borrowed wolf that doesn't know the way. No one follows.", req: { flag: "mossDead" },
        alt: "Varg rides into the bog on his dire wolf. No one follows." },
      { s: "vaelis", t: "*(in the ashes)* The Warchief is dead. Someone should record his name. …Does anyone know it?", m: "aloof" },
      { n: "At the heart of the Marches, the split Marchstone speaks." },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Elves have won by holding the Marches. The forest walks back into the borderlands, but the Bloodmire Clans still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Orcs." },
      { s: "stone", t: "HELD." },
      { s: "grukka", t: "The Elves hold the Marches. They've drawn new borders.", m: "defiant" },
      { s: "grukka", t: "New fence. Same bog.", m: "defiant" },
      { n: "Grukka stares at the new borders for a long time. Then he looks at the timber halls his son built." },
      { s: "grukka", t: "…This time, we build inside it.", m: "defiant" },
      { s: "varg", t: "Build, Father. And I'll guard it. Nobody shoots anything of ours again.", m: "angry", req: { flag: "mossDead" },
        alt: "Then let's build, Father. Moss wants a porch." },
    ],
  },
};
