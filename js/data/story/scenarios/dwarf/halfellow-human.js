/**
 * STORY SCENARIO -- dwarf/halfellow+human, "The Market Below the Mountain"
 * Karrak's two biggest trading partners -- halfellow barley, human coin --
 * are now its rivals. The war is fought through prices as much as pikes,
 * and the Lord-Paladin's bar tab at The Goose & Kettle becomes a three-
 * kingdom scandal. Shared defaults: js/data/story/shared/dwarf.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/halfellow+human"] = {
  title: "The Market Below the Mountain",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast gathers her family: her wife Kazra the runesmith, her uncle Oskar with the Book of Grudges, and her daughter Sigrun, a Metal Singer." },
      { s: "oskar", t: "The Accord's closing clause, Thane: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "brunna", t: "Then Karrak holds.", m: "proud" },
      { s: "oskar", t: "Our two best customers stand in the way, Thane. The halfellows sell us barley. Westmarch, the Humans, owes us for their Cathedral. Half our treasury walks in through those two doors.", m: "grudging" },
      { s: "kazra", t: "Then we're about to find out how much of a war you can fight on credit.", m: "focused" },
      { n: "In the Hearthlands, home of the halfellows, Mayor Hobby Trickgrin is doing sums in The Goose & Kettle, the halfellows' oldest pub, with her sister Goldie." },
      { s: "goldie", t: "The Dwarves buy our barley, Hobby. The Humans buy our bread. And the Lord-Paladin of Westmarch owes this pub a fortune.", m: "stern" },
      { s: "hobby", t: "Then this war will be won with *prices*, dear. And a little plan.", m: "scheming" },
      { n: "In Westmarch, Queen Maren Ashcroft reads a letter from Karrak about the Dawn Cathedral debt. Her brother Aldric reads a letter from The Goose & Kettle about his tab." },
      { s: "aldric", t: "It is a *tithe*, Majesty. For the pub's spiritual wellbeing.", m: "fervent" },
      { s: "corvin", t: "It is four hundred silver, Lord-Paladin. The pub's spirit is *very* well, thank you.", m: "wry" },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, hunting for the right rock to raise a second hold on." },
      { s: "brunna", t: "A second hold. A market hall in the middle, so we can sell to whoever's still talking to us.", m: "proud" },
      { s: "oskar", t: "The halfellows have raised the price of barley, Thane. Westmarch has stopped paying the Cathedral instalments.", m: "grudging" },
      { s: "brunna", t: "Then we'll brew with *mushrooms* if we have to.", m: "angry" },
      { s: "sigrun", t: "Mother, *no*.", m: "angry" },
    ],
    B2: [
      { n: "The barley fields at the edge of the Hearthlands, at dawn. Dwarf and halfellow warriors have clashed for the first time since the Accord.", req: { firstBlood: "halfellow" },
        alt: "The river crossings below the mountains, at dusk. Dwarf and human soldiers have clashed over a merchant caravan." },
      { s: "oskar", t: "First blood. Entry {grudge} in the Book of Grudges. And I've started a *ledger*, too. The Book isn't built for prices.", m: "grudging" },
      { s: "kazra", t: "I've started a Titan.", m: "focused", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { s: "hobby", t: "*(in the Hearthlands)* First blood with the Dwarves. Goldie, raise the price of barley. Again.", m: "scheming", req: { firstBlood: "halfellow" } },
      { s: "aldric", t: "*(in Westmarch)* The Dawn guided our swords against the moneylenders!", m: "fervent", req: { firstBlood: "human" } },
    ],
    B3: [
      { n: "A bundle of letters reaches the Thane's Hall, intercepted from a human courier: the Lord-Paladin's correspondence with The Goose & Kettle." },
      { s: "oskar", t: "Thane. The Lord-Paladin of Westmarch owes the halfellows four hundred silver. In *ale*. And he's been paying the interest with Cathedral funds. *Our* Cathedral funds.", m: "angry" },
      { s: "sigrun", t: "He's drinking our debt? He's *drinking our debt*?", m: "angry" },
      { s: "brunna", t: "Send a copy to the halfellow Mayor. And one to the Queen of Westmarch. Let them sort out their own bar tab.", m: "proud" },
      { n: "A week later, word comes back: the Queen and the Mayor have both frozen the Lord-Paladin's accounts." },
      { s: "oskar", t: "Entry {grudge} in the Book of Grudges: *satisfying*. I'm allowed one of those a century.", m: "happy" },
    ],
    B6: [
      { n: "Night, on the walls of {capital}. Brunna and Oskar look out at two kingdoms that used to be customers." },
      { s: "brunna", t: "When this is over, Uncle, somebody has to buy our iron and sell us barley. It might as well be them.", m: "proud", alt: { s: "sigrun", t: "When this is over, Uncle, somebody still has to sell us barley. It might as well be them.", m: "happy" } },
      { s: "oskar", t: "Then don't burn the market hall, Thane." },
      { s: "brunna", t: "Walls first, Uncle. Market second. Everything else after.", m: "proud", alt: { s: "sigrun", t: "Walls first. Market second. Music third.", m: "happy" } },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone, and a market hall has been built just outside it, open to every kingdom." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "*(at the market's opening)* No tariff, Thane? None at all? …Goldie, pinch me.", m: "happy", req: { alive: "halfellow" } },
      { s: "maren", t: "*(by letter)* “The Cathedral debt, repaid in full. And the Lord-Paladin's bar tab, repaid in full, out of his own pocket.”", m: "happy", req: { alive: "human" } },
      { s: "oskar", t: "Two debts paid in one day. Entry {grudge} in the Book of Grudges: *struck out*. I'm keeping the ledger, though. Just in case.", m: "happy" },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying the Halfellows and Westmarch. The market hall stands empty." },
      { s: "stone", t: "REMAINS." },
      { s: "oskar", t: "No one to sell to. No one to buy from. No one to owe us anything. The ledger's balanced, Thane. It's also blank.", m: "sad" },
      { s: "kazra", t: "Stone endures, Oskar. It just doesn't trade much. We'll be a long time alone with it.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "Karrak has fallen. {capital} is the last dwarf stronghold standing, and its gates have been unlocked from the inside." },
      { s: "kazra", t: "The last Titan's ready. I'll take it into the breach.", m: "focused", req: { unit: "self:runeforged_titan" }, alt: "I'll hold the breach myself." },
      { s: "brunna", t: "Stone remembers, Kazra.", m: "sad", alt: { s: "sigrun", t: "Stone remembers.", m: "sad" } },
      { n: "The Underways seal from within. The mountain goes dark." },
      { s: "hobby", t: "Leave a barrel at the door, Goldie. For when they come back out.", m: "sad", req: { conqueror: "halfellow" } },
      { s: "maren", t: "We'll pay the Cathedral debt anyway. To whoever's left.", m: "resolute", req: { conqueror: "human" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Halfellows have won by holding the Marches. Every field from the mountains to the river is one enormous neighbourhood, but Karrak still stands.", req: { winner: "halfellow" },
        alt: "Westmarch has won by holding the Marches. Westmarch's banners fly from the river to the mountains, but Karrak still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "brunna", t: "Well. We'll just have to sell them more iron. Write it as a debt, Uncle.", m: "proud", alt: { s: "sigrun", t: "Then we'll sell them more iron. Write it as a debt, Uncle." } },
      { s: "oskar", t: "In the ledger, Thane. Not the Book.", m: "grudging" },
    ],
  },
};
