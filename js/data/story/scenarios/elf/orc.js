/**
 * STORY SCENARIO -- elf/orc, "Ash on the Wind"
 * Orc fire eats the borderwood. The witches' feud (shared.js feud:1-3) is
 * the heart of it: Ysolde and Skarra despise each other. Gnash wants to
 * smash "the pretty one" (Vaelis), who has never once looked at him.
 * Shared defaults: js/data/story/shared/elf.js. Bible §9.2, §13.3.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/orc"] = {
  title: "Ash on the Wind",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, the last living witness of the Long Accord, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { n: "On the southern wind comes the smell of smoke. The Orcs of the Bloodmire, the swamp country beyond the forest, have lit their fires." },
      { s: "ysolde", t: "And I smell *her*. Skarra. The bog-witch. She has been waiting eighty years for the Accord to break, so she can finish what she started." },
      { s: "aelthir", t: "The Midsummer Fair, eighty years ago. You and she, at the Marchstone. I never learned what happened." },
      { s: "ysolde", t: "She insulted my trees. I drowned her frog. It lived. She has never forgiven either." },
      { n: "In the Bloodmire, at the Speaking Stones, Skarra the Bog-Mother cackles over a pot. Beside her, the ogre Gnash sharpens a cleaver the size of a door." },
      { s: "skarra", t: "The elf-witch's precious forest! Skarra will BURN it, root and branch!" },
      { s: "gnash", t: "Gnash want to smash pretty one. The shiny elf. Pretty one never look at Gnash. Gnash make him *look*." },
      { s: "vaelis", t: "*(reading the scouts' report)* Something called *Gnash* wishes to speak with me? How extraordinary. No." },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted at the forest's southern edge.", req: { cities: 2 },
        alt: "Elf druids walk the forest's southern edge, choosing where a second grove-town will grow." },
      { s: "ysolde", t: "Plant it deep. The roots will need to be strong. She is going to try to burn them." },
      { s: "vaelis", t: "Then we shall plant it *wet*, mother. You have a spring for that." },
    ],
    B2: [
      { n: "The borderwood, at dawn. Orc war-bands have set the forest's edge alight, and elf rangers have met them in the smoke." },
      { s: "aelthir", t: "First blood. And first fire. The forest will remember this for a thousand years." },
      { s: "vaelis", t: "Fire-bringers. The forest's oldest enemy. Send the rangers, great-uncle. I shall not ask twice." },
      { n: "At the Speaking Stones, the ancient standing stones glow red. Skarra dances between them." },
      { s: "skarra", t: "Elf blood and elf ash! The ancestors are FEASTING, little Warchief!" },
      { s: "grukka", t: "Burn their trees, Skarra. Not our own camp. *Again*." },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. Ysolde returns from the burned southern groves with ash in her hair, and a strange expression." },
      { s: "ysolde", t: "Skarra left me a message, Warden. Burned into the bark of the oldest oak in the south." },
      { s: "aelthir", t: "What does it say?" },
      { s: "ysolde", t: "*Still angry about the frog.*" },
      { s: "vaelis", t: "Eighty years. A war. Burning groves. Over a *frog*." },
      { s: "ysolde", t: "Over *pride*, my son. You of all people should understand." },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders, and over the scorched land where the orc fires burned. New oaks are already growing through the ash." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis." },
      { s: "vaelis", t: "You would give the Silverwood to a woman who talks to *puddles*." },
      { s: "ysolde", t: "And they, my son, have a great deal to say about you." },
      { n: "In the Bloodmire, a frog is delivered to Skarra in a small wooden box, with a note from the Archdruid of the Silverwood.", req: { alive: "orc" } },
      { s: "skarra", t: "*(reading)* “Your frog. Returned. I kept it eighty years. It is well. — Y.” …She KEPT Destiny's *brother*?!", req: { alive: "orc" } },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying the Orcs. The Bloodmire is silent, and the fires are out." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "The fire-bringers, gone. They ended, as brief things do." },
      { s: "ysolde", t: "The bog-witch is gone. I expected to feel triumphant." },
      { s: "ysolde", t: "…I feel as though someone has closed a window. I shall miss hating her, Warden. Isn't that strange?" },
      { s: "aelthir", t: "No, Ysolde. It is the least strange thing you have ever said." },
    ],
    "E-Fallen": [
      { n: "The Orcs have broken the Silverwood. The forest is burning, and {capital} is falling." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden. The fire is too close." },
      { n: "Beneath the burning Heartwood, Aelthir sits very still. The last witness of the Accord is going with it." },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly." },
      { s: "gnash", t: "*(arriving, cleaver raised)* Pretty one! Pretty one LOOK at Gnash!" },
      { s: "vaelis", t: "*(not looking)* No." },
      { s: "skarra", t: "The elf-witch's forest, ASH! Skarra wins! Skarra WINS! …Where is she? WHERE IS SHE?" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Orcs have won by holding the Marches. For the first time an orc crown rules the borderlands, but the Silverwood still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "The Orcs hold the Marches. They will need to learn to keep them. Perhaps we can teach them how." },
      { s: "vaelis", t: "Teach the fire-bringers to garden, great-uncle? You have finally gone mad." },
      { s: "ysolde", t: "I shall go and teach Skarra myself. She will hate it. So shall I. It will be *wonderful*." },
    ],
  },
};
