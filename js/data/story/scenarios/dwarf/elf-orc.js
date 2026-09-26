/**
 * STORY SCENARIO -- dwarf/elf+orc, "Two Volumes Open"
 * Two ancient grudges open at once -- Entry the First (the Rootcut, the
 * Elves) and Volume Seven (the Mountain Wars, the Orcs) -- while Sigrun slips
 * away through the Underways to Varg. Vaelis learns the secret and threatens
 * to use it. Threads: the lovers (shared B5 / lovers:meet), the witches'
 * feud (shared.any). Shared defaults: js/data/story/shared/dwarf.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/elf+orc"] = {
  title: "Two Volumes Open",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast gathers her family: her wife Kazra the runesmith, her uncle Oskar with the Book of Grudges, and her daughter Sigrun, a Metal Singer." },
      { s: "oskar", t: "The Accord's closing clause, Thane: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "brunna", t: "Then Karrak holds. I'll have our Heartstone back.", m: "proud" },
      { n: "Oskar opens the Book of Grudges in two places at once, a thumb in each." },
      { s: "oskar", t: "Entry the First: the Rootcut, against the Elves of the Silverwood. And Volume Seven: the Mountain Wars, against the Orcs of the Bloodmire. Both open. Both at once. I'll need more ink.", m: "grudging" },
      { n: "In the Silverwood, the Warden Aelthir Moonveil feels the stone split. His heir, Lord Vaelis Nightbloom, smiles thinly." },
      { s: "vaelis", t: "Dwarves and Orcs, both at our borders. How fortunate that they hate each other more than they hate us.", m: "aloof" },
      { n: "In the Bloodmire, the Orcs' swamp country, Warchief Grukka Ironjaw stands before the Speaking Stones with his sister Skarra, the Bog Witch." },
      { s: "skarra", t: "Dwarves in the mountains! Elves in the trees! And the elf-witch Ysolde in her precious spring! Skarra has so MANY curses to spend!", m: "gleeful" },
      { n: "Back in Karrak, Sigrun has gone very quiet at the word *Orcs*." },
      { s: "sigrun", t: "Mother, the orcs at the Midsummer Fair… they weren't all like the stories.", m: "sad" },
      { s: "brunna", t: "They were orcs, Sigrun.", m: "angry" },
      { n: "Kazra watches their daughter a moment too long." },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, hunting for the right rock to raise a second hold on." },
      { s: "brunna", t: "A second hold. Walls toward the forest, walls toward the bog. Walls both ways.", m: "proud" },
      { s: "oskar", t: "The clan-moot asks which way is *first*, Thane." },
      { s: "brunna", t: "Both, Uncle. Walls first. Both ways first.", m: "proud" },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Dwarf and elf warriors have clashed for the first time since the Accord.", req: { firstBlood: "elf" },
        alt: "The bog's edge, at dawn. Dwarf and orc warriors have clashed, and the Mountain Wars have begun again." },
      { s: "oskar", t: "Entry the First, reopened.", m: "grudging", req: { firstBlood: "elf" }, alt: "Volume Seven, reopened." },
      { s: "kazra", t: "I've started a Titan.", m: "focused", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { s: "vaelis", t: "*(in the Silverwood)* The mud-folk have come to argue about a grove. We shall answer them with arrows.", m: "aloof", req: { firstBlood: "elf" } },
      { s: "skarra", t: "*(in the Bloodmire)* Dwarf blood on the ridge! The ancestors are HUNGRY! Ha! HA!", m: "gleeful", req: { firstBlood: "orc" } },
    ],
    B3: [
      { n: "The Thane's Hall, late at night. Oskar has run out of room in both volumes and started a third, just for cross-references." },
      { s: "oskar", t: "Thane, a word. About Sigrun. For weeks now: the noise, and then the silence. And the silence is always on nights the Underways are open.", m: "sad" },
      { s: "brunna", t: "She's young, Uncle. Young dwarves go quiet." },
      { s: "kazra", t: "*(too quickly)* She is. They do.", m: "sad" },
      { n: "In the Silverwood, an elf scout has returned from the bog-edge with a strange report. Lord Vaelis reads it twice." },
      { s: "vaelis", t: "The Thane's daughter. And the Warchief's *son*. In the tunnels, at midnight. Oh, this is *exquisite*.", m: "happy" },
      { s: "ysolde", t: "What will you do with it, my son?", m: "uncanny" },
      { s: "vaelis", t: "Nothing, mother. Yet. A secret is like wine. It improves with *waiting*.", m: "aloof" },
    ],
    B6: [
      { n: "Night, on the walls of {capital}. Brunna finds her daughter alone, looking south toward the Orc bogs." },
      { s: "brunna", t: "Is he worth it?" },
      { s: "sigrun", t: "He's worth not killing, Mother. That's all I'm asking.", m: "sad" },
      { s: "brunna", t: "The elf heir sent me a letter today. He knows. He says if I don't pull back from the forest, he'll tell the Warchief *everything*, and let his son pay for it.", m: "angry" },
      { s: "sigrun", t: "…Mother.", m: "sad" },
      { s: "brunna", t: "I burned it, daughter. Karrak doesn't bargain with blackmailers. And I'll not have Vaelis Nightbloom decide who my daughter loves.", m: "proud" },
      { s: "kazra", t: "*(from the stair)* Thirty years, and she can still surprise me.", m: "happy" },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone, the forest on one side and the bog on the other." },
      { s: "stone", t: "HELD." },
      { s: "oskar", t: "Entry the First: struck out. Volume Seven, last page: *crossed out*. Two grudges, one night. I need to sit down.", m: "happy" },
      { n: "At the victory feast, Sigrun plays her song for Varg aloud for the first time. Grukka Ironjaw, Warchief of the Orcs, stands in the doorway, alone and unarmed.", req: { alive: "orc" } },
      { s: "grukka", t: "I heard there was singing. The elves heard it too. They sent me to tell you it was too loud.", m: "happy", req: { alive: "orc" } },
      { s: "brunna", t: "Stay by the door, Warchief.", req: { alive: "orc" } },
      { s: "vaelis", t: "*(by letter)* “The Silverwood notes that a dwarf and an orc are now attending the same *feasts*. It declines to comment further.”", m: "aloof", req: { alive: "elf" } },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying the Elves and the Orcs. The forest is silent. The bog is empty." },
      { s: "stone", t: "REMAINS." },
      { s: "oskar", t: "Both volumes closed, Thane. No one left to write about.", m: "sad" },
      { s: "brunna", t: "Start a new book anyway. For what we owe.", m: "sad" },
      { n: "Sigrun does not come to the victory feast. Far below the mountain, at an Underway door on the edge of the ruined bogs, Moss the dire wolf lies down in front of a door that will never open again, and waits." },
    ],
    "E-Fallen": [
      { n: "Karrak has fallen. {capital} is the last dwarf stronghold standing, and it is surrounded." },
      { s: "kazra", t: "The last Titan's ready. I'll take it into the breach.", m: "focused", req: { unit: "self:runeforged_titan" }, alt: "I'll hold the breach myself." },
      { s: "brunna", t: "Stone remembers, Kazra.", m: "sad", alt: { s: "sigrun", t: "Stone remembers, Mother Kazra.", m: "sad" } },
      { n: "The Underways seal from within. The mountain goes dark." },
      { s: "skarra", t: "Sealed in their own holes! Skarra LOVES it when they do the work themselves! Ha! HA!", m: "gleeful", req: { conqueror: "orc" } },
      { s: "varg", t: "*(alone, at the bog-edge)* Moss knows the way. There's no one at the end of it anymore.", m: "sad", req: { conqueror: "orc" } },
      { s: "vaelis", t: "The mud-folk, sealed in. The Rootcut avenged. I feel nothing. How disappointing.", m: "aloof", req: { conqueror: "elf" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Orcs have won by holding the Marches. For the first time an orc crown rules the borderlands, but Karrak still stands.", req: { winner: "orc" },
        alt: "The Elves have won by holding the Marches. The forest has walked back over the old borders, but Karrak still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "brunna", t: "Write it as a debt, Uncle. Not a grudge.", m: "proud", alt: { s: "sigrun", t: "Write it as a debt, Uncle." } },
      { n: "Sigrun bursts into the hall. A Wolf Rider is at the gate, on a big grey dire wolf, and he's knocking.", req: { winner: "orc" } },
      { s: "brunna", t: "Well? Let him in. Walls first. Then we talk.", m: "happy", req: { winner: "orc" } },
    ],
  },
};
