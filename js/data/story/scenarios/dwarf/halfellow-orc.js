/**
 * STORY SCENARIO -- dwarf/halfellow+orc, "The Brewery Siege"
 * The Orcs want the dwarf breweries and the halfellow fields, and both
 * peoples remember the Goose Rout. Goldie hears the lovers' rumour at The
 * Goose & Kettle and warns Brunna gently; Brunna doesn't believe her.
 * Threads: the lovers (shared B5 / lovers:meet).
 * Shared defaults: js/data/story/shared/dwarf.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/halfellow+orc"] = {
  title: "The Brewery Siege",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent, and every barrel in the brewery cellars sloshes, as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast gathers her family: her wife Kazra the runesmith, her uncle Oskar with the Book of Grudges, and her daughter Sigrun, a Metal Singer." },
      { s: "oskar", t: "The Accord's closing clause, Thane: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "brunna", t: "Then Karrak holds." },
      { s: "oskar", t: "The Bloodmire Clans, the Orcs, will want our breweries. They've wanted them since the Mountain Wars. And the halfellows' barley fields lie right between us." },
      { n: "In the Bloodmire, the Orcs' swamp country, Warchief Grukka Ironjaw's sister Skarra, the Bog Witch, cackles at the Speaking Stones." },
      { s: "skarra", t: "Dwarf ale and halfellow barley! And the halfellow Mayor who ruined Skarra's raid forty years ago with a *goose*! Skarra will have ALL of it!" },
      { n: "In the Hearthlands, home of the halfellows, Mayor Hobby Trickgrin hears the news in The Goose & Kettle, the halfellows' oldest pub." },
      { s: "hobby", t: "Skarra Ironjaw, back for another go. Goldie, is the goose's hat still in the attic?" },
      { s: "goldie", t: "You promised me no more geese, Hobby Trickgrin." },
      { n: "Back in Karrak, Sigrun has gone very quiet at the word *Orcs*." },
      { s: "sigrun", t: "Mother, the orcs at the Midsummer Fair… they weren't all like the stories." },
      { s: "brunna", t: "They were orcs, Sigrun." },
      { n: "Kazra watches their daughter a moment too long." },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, hunting for the right rock to raise a second hold on." },
      { s: "brunna", t: "A second hold. Walls first. Then the brewery. *Inside* the walls." },
      { s: "kazra", t: "Put a Runewall round the brewery and the orcs'll never get near the ale." },
      { s: "sigrun", t: "Put a Runewall round the brewery and *I'll* never get near the ale." },
    ],
    B2: [
      { n: "The bog's edge, at dawn. Dwarf and orc warriors have clashed, and the Mountain Wars have begun again.", req: { firstBlood: "orc" },
        alt: "The barley fields of the Hearthlands, at dawn. Dwarf and halfellow warriors have clashed over the harvest." },
      { s: "oskar", t: "Volume Seven, reopened.", req: { firstBlood: "orc" }, alt: "Entry nine hundred and four, the ale tariff. Reopened, with *violence*." },
      { s: "kazra", t: "I've started a Titan.", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { s: "skarra", t: "*(in the Bloodmire)* Dwarf blood on the ridge! The ancestors are HUNGRY! Ha! HA!", req: { firstBlood: "orc" } },
      { s: "hobby", t: "*(in the Hearthlands)* First blood with the Dwarves. I used to share a barrel with the Thane at the Midsummer Fair.", req: { firstBlood: "halfellow" } },
    ],
    B3: [
      { n: "A halfellow messenger reaches the Thane's Hall with a letter from Goldie Trickgrin, keeper of The Goose & Kettle, the pub where every rumour in the Marches ends up." },
      { s: "goldie", t: "*(her letter)* “Thane, forgive me for writing. A traveller in my pub says your daughter has been seen at night near the bog-edge, with an orc Wolf Rider. I thought a mother should know. Gently, Goldie.”" },
      { s: "brunna", t: "*(crumpling it)* Halfellow gossip. Sigrun would never." },
      { s: "oskar", t: "Thane. The noise, and then the silence. For weeks." },
      { s: "brunna", t: "*Never*, Uncle." },
      { n: "Kazra says nothing at all. Oskar notices that, too." },
    ],
    B6: [
      { n: "Night, on the walls of {capital}. Brunna finds her daughter alone, looking south toward the Orc bogs." },
      { s: "brunna", t: "The halfellow was right. Goldie Trickgrin wrote to me weeks ago. I didn't believe her." },
      { s: "sigrun", t: "Is he worth it, you're going to ask." },
      { s: "brunna", t: "No. I'm going to ask if *you* are all right. Then I'm going to write Goldie an apology. Then I'll ask the other thing." },
      { s: "sigrun", t: "…He's worth not killing, Mother. That's all." },
      { s: "brunna", t: "Tell the boy to keep his wolf off my brewery." },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone. Outside it, by agreement, grows a field of halfellow barley." },
      { s: "stone", t: "HELD." },
      { s: "oskar", t: "The ale tariff: struck out. Volume Seven, the orc volume: crossed out. And the goose's hat…" },
      { s: "hobby", t: "*(arriving with a barrel)* …stays in the attic, where Goldie can keep an eye on it.", req: { alive: "halfellow" } },
      { n: "At the victory feast, Sigrun plays her song for Varg aloud for the first time. Grukka Ironjaw, Warchief of the Orcs, stands in the doorway, alone and unarmed.", req: { alive: "orc" } },
      { s: "grukka", t: "I heard there was singing. And ale.", req: { alive: "orc" } },
      { s: "brunna", t: "Stay by the door, Warchief. I'll bring you a tankard.", req: { alive: "orc" } },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying the Orcs and the Halfellows. The bog is empty. The meadows are empty." },
      { s: "stone", t: "REMAINS." },
      { s: "oskar", t: "Volume Seven closed. The tariff closed. There's no one left to sell us barley or steal our ale." },
      { s: "brunna", t: "Start a new book anyway, Uncle." },
      { n: "Sigrun does not come to the victory feast. Far below the mountain, at an Underway door on the edge of the ruined bogs, Moss the dire wolf lies down in front of a door that will never open again, and waits." },
    ],
    "E-Fallen": [
      { n: "Karrak has fallen. {capital} is the last dwarf stronghold standing, and the enemy is at the brewery doors." },
      { s: "kazra", t: "The last Titan's ready. I'll take it into the breach.", req: { unit: "self:runeforged_titan" }, alt: "I'll hold the breach myself." },
      { s: "brunna", t: "Stone remembers, Kazra.", alt: { s: "sigrun", t: "Stone remembers." } },
      { n: "The Underways seal from within. The mountain goes dark." },
      { s: "skarra", t: "The BREWERY is Skarra's! Destiny, fetch a tankard! No, a BUCKET!", req: { conqueror: "orc" } },
      { s: "hobby", t: "Leave a barrel at the door, Goldie. For when they come back out.", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Orcs have won by holding the Marches. For the first time an orc crown rules the borderlands, but Karrak still stands.", req: { winner: "orc" },
        alt: "The Halfellows have won by holding the Marches. Every field is one enormous neighbourhood, but Karrak still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "brunna", t: "Write it as a debt, Uncle. Not a grudge.", alt: { s: "sigrun", t: "Write it as a debt, Uncle." } },
      { n: "A Wolf Rider on a big grey dire wolf is knocking at the gate, with a barrel of halfellow ale strapped to the saddle.", req: { winner: "orc" } },
      { s: "brunna", t: "Well? Let him in. He's brought the ale.", req: { winner: "orc" } },
    ],
  },
};
