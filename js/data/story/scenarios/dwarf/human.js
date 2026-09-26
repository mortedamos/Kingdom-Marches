/**
 * STORY SCENARIO -- dwarf/human, "The Debt Comes Due"
 * The Cathedral debt, from the creditor's side: Westmarch's Dawn Cathedral
 * was built with Karrak stone on Karrak credit, "due when the Accord ends."
 * Aldric calls the debt blasphemy, Corvin calls it the Temple's problem, and
 * Brunna just wants what she's owed. Does collecting with an army make you
 * right? Shared defaults: js/data/story/shared/dwarf.js. Bible §9.3.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["dwarf/human"] = {
  title: "The Debt Comes Due",
  beats: {
    B0: [
      { n: "Karrak, the mountain realm of the Dwarves. Deep beneath the peaks, every forge falls silent as the whole mountain shudders." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In the Thane's Hall, the ancient throne room of Karrak, High Thane Brunna Stonefast reads the tremor-reports with her wife, the runesmith Kazra Emberdeep." },
      { s: "brunna", t: "The Marchstone has split, Kazra. The Accord is over.", m: "sad" },
      { n: "Brunna's uncle, Loremaster Oskar Grimgate, arrives with the Book of Grudges under one arm and a very old contract under the other." },
      { s: "oskar", t: "The Marches pass to the crown that *holds* them, or failing that, the crown that *remains*. And there's this, Thane. The Dawn Cathedral contract.", m: "grudging" },
      { s: "brunna", t: "Westmarch's great Cathedral. Built with our stone, on our credit.", m: "proud" },
      { s: "oskar", t: "“Payable when the Accord ends.” Their priests thought it was a joke clause. It's due, Thane. *Today*. With four hundred years of interest.", m: "grudging" },
      { s: "brunna", t: "Then Karrak collects. In land, if they haven't the coin.", m: "proud" },
      { n: "Far to the east, in Westmarch, the Human kingdom, the letter reaches Queen Maren Ashcroft's court. Her brother, Lord-Paladin Aldric of the Temple, reads it first." },
      { s: "aldric", t: "The Dwarves demand *payment* for the house of the Dawn? This is blasphemy!", m: "angry" },
      { s: "corvin", t: "It's *accounting*, Lord-Paladin. The Temple signed it. I did warn them about the fine print.", m: "wry" },
      { s: "maren", t: "We'll pay in gold and law, not land. Write back and tell them so.", m: "resolute" },
      { n: "Back in Karrak, Sigrun, the Thane's daughter and a Metal Singer, has been listening at the door." },
      { s: "sigrun", t: "We're going to war over a *receipt*?", m: "sad" },
      { s: "kazra", t: "Over four hundred years of interest, love. Walls first.", m: "happy" },
    ],
    B1: [
      { n: "{city}, a new dwarf hold, rises in the foothills: Karrak's second city.", req: { cities: 2 },
        alt: "Dwarf surveyors range across the foothills, hunting for the right rock to raise a second hold on." },
      { s: "brunna", t: "A second hold. Stone foundations, good walls, and a vault. A *large* vault. For the collections.", m: "proud" },
      { s: "oskar", t: "Westmarch has replied, Thane. They offer to pay the debt in *spells*. Collegium ward-work, for our walls.", m: "grudging" },
      { s: "brunna", t: "Spells. From *conjurors*, Uncle?", m: "angry" },
      { s: "oskar", t: "To us, presumably. So they can march here faster.", m: "grudging" },
    ],
    B2: [
      { n: "The river crossings at the foot of the mountains, at dusk. Dwarf and human soldiers have clashed over a surveyor's camp: the first battle of the war." },
      { s: "oskar", t: "First blood with Westmarch. Entry {grudge} in the Book of Grudges: debt *and* violence. Two columns now.", m: "grudging" },
      { s: "kazra", t: "I've started a Titan.", m: "focused", req: { tech: "self:dwarf_runeforged_titan" }, alt: "I've stoked every forge. The day we learn the runes for a Titan, I'll build one." },
      { n: "In Westmarch, the Lord-Paladin and the Archmage are, as ever, arguing." },
      { s: "aldric", t: "The Dawn guided our swords against the moneylenders!", m: "fervent" },
      { s: "corvin", t: "The *moneylenders*, Lord-Paladin, are also the masons who built your Cathedral. Try not to pray *too* hard at them.", m: "wry" },
    ],
    B3: [
      { n: "The Thane's Hall. A human envoy has arrived under a white flag: Archmage Corvin Varro himself, with a satchel of coin and a very dry expression." },
      { s: "corvin", t: "Thane. A first payment on the Cathedral, from the Collegium's own purse. The Temple refused to contribute. I thought you should know.", m: "wry" },
      { s: "brunna", t: "You'd pay your priests' debt out of your own pocket?", alt: { s: "sigrun", t: "You'd pay your priests' debt out of your own pocket?" } },
      { s: "corvin", t: "I'd pay a great deal, Thane, to watch the Lord-Paladin learn that the Dawn doesn't cover interest.", m: "wry" },
      { n: "When the envoy has gone, Oskar counts the coin twice." },
      { s: "oskar", t: "It's a tenth of what's owed. I'm writing the Archmage down as a grudge *and* a courtesy. First time I've ever needed both columns at once.", m: "grudging" },
    ],
    B6: [
      { n: "Night, on the walls of {capital}. Brunna looks east toward the distant spires of Westmarch." },
      { s: "brunna", t: "Kazra. If I take the Cathedral as payment, does that make me right?", m: "sad", alt: { s: "sigrun", t: "Mother Kazra. If we take the Cathedral as payment, does that make us right?", m: "sad" } },
      { s: "kazra", t: "It makes you *paid*. Right's a different ledger.", m: "focused" },
      { s: "oskar", t: "*(from the stair)* I keep that ledger too, you know. It's much thinner.", m: "grudging" },
    ],

    "E-Held": [
      { n: "The Dwarves have won by holding the Marches." },
      { n: "A ring of dwarf stonework now circles the split Marchstone. Karrak guards the stone where it stands." },
      { s: "stone", t: "HELD." },
      { n: "A letter arrives from the Queen of Westmarch, sealed in purple wax.", req: { alive: "human" } },
      { s: "maren", t: "“The Cathedral debt, paid in full, with interest. And a new clause: every stone Karrak ever lends us, we will repay in the Collegium's wards on Karrak's walls.”", m: "happy", req: { alive: "human" } },
      { s: "oskar", t: "Paid. *Paid*, Thane. Four hundred years. Entry {grudge} in the Book of Grudges: *struck out*. That's the most satisfying stroke I've ever made.", m: "happy" },
    ],
    "E-Remains": [
      { n: "The Dwarves have won by destroying Westmarch. The Human kingdom is no more." },
      { s: "stone", t: "REMAINS." },
      { n: "On the steps of the Dawn Cathedral, the stone Karrak quarried for it lies cold and silent. There is no one left to pay the debt, and no one left to owe it to." },
      { s: "oskar", t: "Collected, Thane. In full. …It doesn't feel like it balanced.", m: "sad" },
      { s: "brunna", t: "No. It doesn't.", m: "sad", alt: { s: "sigrun", t: "No. It doesn't. Mother wanted it *paid*, Uncle. Not *taken*.", m: "sad" } },
    ],
    "E-Fallen": [
      { n: "Westmarch has broken the Dwarves. {capital} is the last dwarf stronghold standing, and the Temple's knights are at its gates." },
      { s: "kazra", t: "The last Titan's ready. I'll take it into the breach.", m: "focused", req: { unit: "self:runeforged_titan" }, alt: "I'll hold the breach myself. The hammer's still warm." },
      { s: "oskar", t: "One last entry. Against Westmarch. Debt unpaid, *hold* unpaid, everything unpaid.", m: "angry" },
      { n: "The Underways seal from within. The mountain goes dark." },
      { n: "In the ruins, Queen Maren of Westmarch picks up the Cathedral contract from the Thane's table." },
      { s: "maren", t: "We'll pay it anyway. To whoever's left.", m: "resolute" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "Westmarch has won by holding the Marches. Westmarch's banners now fly from the river to the mountains, but Karrak still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Dwarves." },
      { s: "stone", t: "HELD." },
      { s: "brunna", t: "The debtor holds the Marches. Uncle, how does *that* go in the Book?", m: "sad", alt: { s: "sigrun", t: "The debtor holds the Marches. Uncle, how does *that* go in the Book?", m: "sad" } },
      { s: "oskar", t: "Carefully, Thane. Very carefully.", m: "grudging" },
      { n: "A Collegium wardwright arrives at the gate: the Queen has sent him to rune-ward Karrak's walls, free of charge. Payment, the letter says, in instalments." },
    ],
  },
};
