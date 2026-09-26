/**
 * STORY SCENARIO -- dwarf/elf+halfellow+orc, "Old Books, New Wars"
 * No Humans, so no debt -- only grudges: the Rootcut (Elves), the ale tariff
 * (Halfellows), the Mountain Wars (Orcs). Oskar must choose which grudge to
 * settle first, and discovers the one being written in his own family.
 * Threads: the lovers (shared B5 / lovers:meet), the witches' feud.
 * Shared defaults: js/data/story/shared/dwarf.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/elf+halfellow+orc"] = {
  title: "Old Books, New Wars",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast gathers her family: her wife Kazra the runesmith, her uncle Oskar with the Book of Grudges, and her daughter Sigrun, a Metal Singer." },
      { s: "oskar", t: "The closing clause, Thane: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "brunna", t: "Then Karrak holds.", m: "proud" },
      { n: "Oskar lays the Book of Grudges on the war table and opens it in three places at once." },
      { s: "oskar", t: "Entry the First: the Rootcut, against the Elves. Entry nine hundred and four: the ale tariff, against the halfellows. Volume Seven: the Mountain Wars, against the Orcs. Every one of them is on our border.", m: "grudging" },
      { s: "brunna", t: "Which do we settle first, Uncle?" },
      { s: "oskar", t: "That's the only question I've never had to answer. The Book was always for *remembering*, Thane. Not for *choosing*.", m: "sad" },
      { n: "Across the Marches the other crowns stir: the Elf heir Lord Vaelis drafting orders beneath the Heartwood; the orc Bog Witch Skarra cackling at the Speaking Stones; Mayor Hobby Trickgrin of the halfellows doing sums in The Goose & Kettle." },
      { s: "vaelis", t: "Dwarves, Orcs and halfellows, and not one human to break the tedium. How very *rural*.", m: "aloof" },
      { n: "Back in Karrak, Sigrun has gone very quiet at the word *Orcs*." },
      { s: "sigrun", t: "Mother, the orcs at the Midsummer Fair… they weren't all like the stories.", m: "sad" },
      { s: "brunna", t: "They were orcs, Sigrun.", m: "angry" },
      { n: "Kazra watches their daughter a moment too long." },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, hunting for the right rock to raise a second hold on." },
      { s: "brunna", t: "A second hold. Walls toward the forest, the meadows *and* the bog.", m: "proud" },
      { s: "kazra", t: "That's three walls, love.", m: "happy" },
      { s: "brunna", t: "Walls first. Three times.", m: "proud" },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Dwarf and elf warriors have clashed.", req: { firstBlood: "elf" } },
      { n: "The barley fields of the Hearthlands, at dawn. Dwarf and halfellow warriors have clashed.", req: { firstBlood: "halfellow" } },
      { n: "The bog's edge, at dawn. Dwarf and orc warriors have clashed, and the Mountain Wars have begun again.", req: { firstBlood: "orc" } },
      { s: "oskar", t: "Entry the First, reopened.", m: "grudging", req: { firstBlood: "elf" } },
      { s: "oskar", t: "Entry nine hundred and four, reopened. With *violence*.", m: "angry", req: { firstBlood: "halfellow" } },
      { s: "oskar", t: "Volume Seven, reopened.", m: "grudging", req: { firstBlood: "orc" } },
      { s: "kazra", t: "I've started a Titan.", m: "focused", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { s: "brunna", t: "One grudge settled at a time, Uncle. Or none at all.", m: "angry" },
    ],
    B3: [
      { n: "The Thane's Hall, late at night. Oskar has been reading the Book of Grudges by candlelight for hours, and he has started a new page. It has no heading yet." },
      { s: "oskar", t: "Thane, a word. About Sigrun. The noise, and then the silence. Always on nights the Underways are open.", m: "sad" },
      { s: "brunna", t: "She's young, Uncle." },
      { s: "oskar", t: "I've a page here with no name at the top. I don't want to write the name I think goes there.", m: "sad" },
      { n: "Kazra quietly takes the candle and snuffs it." },
      { s: "kazra", t: "Then don't, Oskar. Not tonight.", m: "sad" },
    ],
    B6: [
      { n: "Night, on the walls of {capital}. Oskar finds the Thane and her daughter together, looking south toward the Orc bogs. He is carrying the Book." },
      { s: "oskar", t: "I've decided which grudge to settle first, Thane.", m: "grudging" },
      { s: "brunna", t: "Which one, Uncle?" },
      { s: "oskar", t: "The one I never wrote. The page with no name." },
      { n: "He tears it out, very carefully, and hands it to Sigrun." },
      { s: "oskar", t: "Some grudges aren't worth keeping, child. I'm old. I'm allowed to change my mind *once*.", m: "happy" },
      { s: "sigrun", t: "…Uncle Oskar.", m: "sad" },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone, with forest, meadow and bog all around it." },
      { s: "stone", t: "HELD." },
      { s: "oskar", t: "Entry the First: struck out. Nine hundred and four: struck out. Volume Seven: crossed out. The Book's never been this *light*.", m: "happy" },
      { n: "At the victory feast, Sigrun plays her song for Varg aloud for the first time. The Orc Warchief stands in the doorway, alone and unarmed. A halfellow Mayor has brought the ale.", req: { alive: "orc" } },
      { s: "grukka", t: "I heard there was singing.", m: "happy", req: { alive: "orc" } },
      { s: "brunna", t: "Stay by the door, Warchief.", req: { alive: "orc" } },
      { s: "vaelis", t: "*(by letter)* “The Silverwood notes that it has not been invited. The Silverwood is *relieved*.”", m: "aloof", req: { alive: "elf" } },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying every rival. The forest, the meadows and the bog are all silent." },
      { s: "stone", t: "REMAINS." },
      { s: "oskar", t: "Every grudge settled, Thane. The Book is finished. There's no one left in it who can read.", m: "sad" },
      { s: "brunna", t: "Start a new book anyway.", m: "sad" },
      { n: "Sigrun does not come to the victory feast. At an Underway door on the edge of the ruined bogs, Moss the dire wolf lies down in front of a door that will never open again, and waits." },
    ],
    "E-Fallen": [
      { n: "Karrak has fallen. {capital} is the last dwarf stronghold standing, and it is surrounded." },
      { s: "kazra", t: "The last Titan's ready. I'll take it into the breach.", m: "focused", req: { unit: "self:runeforged_titan" }, alt: "I'll hold the breach myself." },
      { s: "oskar", t: "The Book goes to the deepest vault. Every grudge unsettled. Someone will have to finish it.", m: "sad" },
      { n: "The Underways seal from within. The mountain goes dark." },
      { s: "skarra", t: "Sealed in their holes! Skarra LOVES it when they do the work themselves!", m: "gleeful", req: { conqueror: "orc" } },
      { s: "vaelis", t: "The Rootcut, avenged. I feel nothing. How disappointing.", m: "aloof", req: { conqueror: "elf" } },
      { s: "hobby", t: "Leave a barrel at the door, Goldie. For when they come back out.", m: "sad", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Orcs have won by holding the Marches, but Karrak still stands.", req: { winner: "orc" } },
      { n: "The Silverwood has won by holding the Marches, but Karrak still stands.", req: { winner: "elf" } },
      { n: "The Halfellows have won by holding the Marches, but Karrak still stands.", req: { winner: "halfellow" } },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "brunna", t: "Write it as a debt, Uncle. Not a grudge. We've had enough grudges for one lifetime.", m: "proud" },
      { s: "oskar", t: "For *several* lifetimes, Thane.", m: "grudging" },
    ],
  },
};
