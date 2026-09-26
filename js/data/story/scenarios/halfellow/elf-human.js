/**
 * STORY SCENARIO -- halfellow/elf+human, "The Settled Lands"
 * Two old, proud kingdoms who both think of the Hearthlands as a pantry.
 * Vaelis tries to recruit Hobby to starve Westmarch; Hobby says yes just
 * long enough to warn Corvin. Threads: bloodline, whisper (shared).
 * Shared defaults: js/data/story/shared/halfellow.js. Bible §9.5.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/elf+human"] = {
  title: "The Settled Lands",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll." },
      { s: "barnaby", t: "The Marchstone has split! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "flustered" },
      { s: "hobby", t: "The Elves of the Silverwood on one side, the Humans of Westmarch on the other. Both very old, very proud, and very hungry.", m: "scheming" },
      { s: "goldie", t: "They call this country *the settled lands*, love. As if we just sat down one day and never got up.", m: "stern" },
      { n: "In the Silverwood, the Elves' ancient forest, Lord Vaelis Nightbloom, heir to the Warden's seat, reads the news beneath the silver trees." },
      { s: "vaelis", t: "The humans will march. The small folk will feed whoever asks politely. How tiresome. How *useful*.", m: "aloof" },
      { n: "In Westmarch, the Human kingdom, Queen Maren Ashcroft studies a map of the granaries." },
      { s: "maren", t: "Half our bread comes from the Hearthlands. If the Elves get there first, Westmarch starves by winter.", m: "resolute" },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! Let's make sure it's *unsettled*. Lots of moving about. Fairs, markets, parades.", m: "happy" },
      { s: "barnaby", t: "Is that a strategy, Hobby?", m: "flustered" },
      { s: "hobby", t: "It's a *reputation*, Uncle. It's hard to conquer somebody who's never where you left them.", m: "scheming" },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Halfellow militia have clashed with elf rangers.", req: { firstBlood: "elf" },
        alt: "The road to Westmarch, at dusk. Halfellow militia have clashed with human soldiers." },
      { s: "hobby", t: "First blood. They thought we'd just hand over the harvest.", m: "sad" },
      { s: "hobby", t: "Our traps are out. I used to laugh when those went off.", m: "sad", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love.", m: "sad" },
      { s: "hobby", t: "No. I don't think this one's funny.", m: "sad" },
    ],
    // Vaelis tries to buy the Hearthlands' grain to starve Westmarch.
    B3: [
      { n: "The Goose & Kettle, at noon. A tall elf in silver and green ducks under the low door, and looks around the pub as if it were a burrow." },
      { n: "Lord Vaelis Nightbloom does not sit. He has never sat in a halfellow chair. He is not sure he would fit." },
      { s: "vaelis", t: "Mayor. The Silverwood will buy every sack of grain in the Hearthlands this season. At twice the price. On one condition: *none of it goes west*.", m: "aloof" },
      { s: "hobby", t: "You want me to starve Westmarch for you.", m: "angry" },
      { s: "vaelis", t: "I want you to *sell your bread*. What the humans eat is not your concern. It is barely mine.", m: "aloof" },
      { s: "goldie", t: "*(from behind the bar)* Would his lordship like a pint while he's plotting famines?", m: "stern" },
      { s: "vaelis", t: "His lordship would not.", m: "aloof" },
      { n: "Hobby shakes his hand, smiling. At the door, Vaelis pauses, and his composure slips. For forty years, Hobby Trickgrin has been the one creature in the Marches who can do that to him." },
      { s: "vaelis", t: "And Mayor. If I find a single frog in my saddlebags this time—", m: "angry" },
      { s: "hobby", t: "Wouldn't dream of it, my lord.", m: "scheming" },
      { n: "There are three frogs. The moment Vaelis is gone, Hobby is writing a letter." },
      { s: "hobby", t: "*(her letter)* “Archmage. An elf just tried to buy your winter. I said yes. Send carts. Lots of them. At night. — H.T.”", m: "scheming" },
      { s: "barnaby", t: "Hobby, you just double-crossed the heir to the Silverwood.", m: "flustered" },
      { s: "hobby", t: "Single-crossed, Uncle. I never crossed *Westmarch*.", m: "scheming" },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the forest to the river flies the gold of the Hearthlands. The settled lands have settled everything else." },
      { s: "stone", t: "HELD." },
      { n: "That evening, The Goose & Kettle hosts the Queen of Westmarch and the Warden of the Silverwood at the same table.", req: { alive: ["elf", "human"] } },
      { s: "maren", t: "We thought of you as our pantry, Mayor. I'm sorry.", m: "sad", req: { alive: "human" } },
      { s: "vaelis", t: "*(standing in the doorway, still not sitting)* Remarkable. The pantry has eaten the kitchen.", m: "aloof", req: { alive: "elf" } },
      { s: "goldie", t: "Sit *down*, dear. You're blocking the draught.", m: "stern" },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying the Silverwood and Westmarch. The forest and the river cities are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "That night, the halfellows light a great bonfire on the hill above {capital}. It is not a celebration." },
      { s: "goldie", t: "No more tricks, Hobby.", m: "sad" },
      { s: "hobby", t: "No. That was the last one. They called us *settled*, Goldie. I wanted to prove them wrong. Not like this.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Hearthlands have fallen. {capital}, the last halfellow town, has been surrounded." },
      { n: "Hobby's last trick is her best. While the soldiers search empty houses, every halfellow family slips out down the old smugglers' lanes, one by one, in silence." },
      { s: "barnaby", t: "I have the Accord. The Archive's copy. The only complete one in the Marches.", m: "sad" },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs.", m: "stern" },
      { s: "vaelis", t: "*(in the empty pub)* Gone. Every one of them. And they never *sat still* long enough to be conquered.", m: "sad", req: { conqueror: "elf" } },
      { s: "maren", t: "*(in the empty pub)* We've taken the pantry. And there's no one left to bake.", m: "sad", req: { conqueror: "human" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Elves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "elf" },
        alt: "Westmarch has won by holding the Marches, but the Hearthlands still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "Let them hold it. Supper's still at six, and someone still has to grow it. It's still us.", m: "happy" },
      { s: "goldie", t: "And *you* are still going to be late for it.", m: "stern" },
    ],
  },
};
