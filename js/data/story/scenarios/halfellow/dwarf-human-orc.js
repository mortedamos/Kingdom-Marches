/**
 * STORY SCENARIO -- halfellow/dwarf+human+orc, "Supper and Siege"
 * Barnaby's footnotes carry a surprising amount of the strategy (B3: the
 * old Accord maps of the Underways), and The Goose & Kettle carries the
 * secret (B5: the lovers, hidden in the pub cellar while {capital} is
 * besieged and Goldie serves supper to everyone upstairs).
 * Shared defaults: js/data/story/shared/halfellow.js. Bible §9.5.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/dwarf+human+orc"] = {
  title: "Supper and Siege",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll, and an armful of footnotes." },
      { s: "barnaby", t: "The Marchstone has split! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*. See footnote one. And two. And, Hobby, *all* of them.", m: "flustered" },
      { s: "hobby", t: "Dwarves, Humans and Orcs, Uncle. I haven't *time* for footnotes.", m: "scheming" },
      { s: "barnaby", t: "You never have. That's why I write them.", m: "flustered" },
      { n: "In Karrak, High Thane Brunna Stonefast calls her war council. In Westmarch, Queen Maren Ashcroft calls hers. In the Bloodmire, the Bog Witch Skarra Ironjaw simply screams at the Speaking Stones." },
      { s: "brunna", t: "The halfellows will fold to whoever reaches them first. Make sure it's us.", m: "proud" },
      { s: "maren", t: "The Hearthlands are our granary. Nobody else touches them.", m: "resolute" },
      { s: "skarra", t: "The goose-girl's pub! Skarra wants the goose-girl's PUB!", m: "gleeful" },
      { s: "goldie", t: "*(folding her arms)* Well. She can't have it.", m: "stern" },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! Uncle, where should the walls go?", m: "happy" },
      { s: "barnaby", t: "*(unrolling a map)* Footnote nine. Where the Accord surveyors put the boundary stones, three hundred years ago. They picked the high ground.", m: "flustered" },
      { s: "hobby", t: "…Footnote nine. Right. I'll read the others. Eventually.", m: "scheming" },
    ],
    B2: [
      { n: "The barley fields, at dawn. Halfellow militia have clashed with dwarf warriors.", req: { firstBlood: "dwarf" },
        alt: { n: "The road to Westmarch, at dusk. Halfellow militia have clashed with human soldiers.", req: { firstBlood: "human" },
          alt: "The hedges of the Hearthlands, at dawn. Halfellow militia have clashed with orc raiders." } },
      { s: "hobby", t: "First blood. Three kingdoms, and we're the supper.", m: "sad" },
      { s: "hobby", t: "Our traps are out. I used to laugh when those went off.", m: "sad", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love.", m: "sad" },
      { s: "hobby", t: "No. I don't think this one's funny.", m: "sad" },
    ],
    // Barnaby's footnotes: the old Accord maps of the Underways.
    B3: [
      { n: "The reading room of the Hearthlands Archive. Barnaby has spread out a map so old it crackles. Nobody but him has unrolled it in a hundred years." },
      { s: "barnaby", t: "Footnote forty. The Accord surveyors mapped the Underways, the old dwarf tunnels. Every one of them. Including the ones that run *under the Bloodmire*, and the ones that come up *behind Westmarch's walls*.", m: "flustered" },
      { s: "hobby", t: "Uncle. Does *anybody* else have this map?", m: "scheming" },
      { s: "barnaby", t: "The Dwarves had one. They lost it in a flood. It's in their Book of Grudges: *the flood, for taking the map*.", m: "flustered" },
      { s: "hobby", t: "*(finally grinning)* Uncle Barnaby. I am going to read every single one of your footnotes.", m: "scheming" },
      { s: "barnaby", t: "…I'd like that in writing.", m: "happy" },
      { n: "There is one more thing on the old map, in faded ink: a tunnel that runs from the mountains to the bog, marked *disused*. Somebody has been using it. Recently." },
    ],
    // The siege supper: the secret in the cellar.
    B5: [
      { n: "{capital}, on a tense night. Enemy scouts have been seen on every road, and the town has shut its gates. Upstairs in The Goose & Kettle, Goldie is serving supper to every halfellow who can't sleep, as if nothing were wrong at all." },
      { n: "Downstairs, in the cellar, behind the barrels, a young dwarf with copper braids and an orc with a grey dire wolf are sitting very, very quietly." },
      { s: "goldie", t: "*(to Hobby, low)* The Dwarf Thane's daughter and the Orc Warchief's son. They came up Barnaby's disused tunnel last night. They're in *love*, Hobby, and every army out there would kill them for it.", m: "stern", req: { notSeen: "lovers:meet" },
        alt: { s: "goldie", t: "*(to Hobby, low)* Our two lovebirds came up Barnaby's disused tunnel last night. Every army out there would kill them for it.", m: "stern" } },
      { fx: { seen: "lovers:meet" } },
      { s: "hobby", t: "Then the safest place in the Marches is a pub cellar in a town with its gates shut. Nobody searches the *frightened* for runaways.", m: "scheming" },
      { s: "barnaby", t: "Footnote forty-one, Hobby. That tunnel runs *out* as well as in.", m: "flustered" },
      { n: "At midnight, while Goldie serves second helpings upstairs and sings very loudly, the lovers slip away down the old tunnel with a sack of Goldie's pies. The enemy scouts on the roads never see a thing." },
      { s: "skarra", t: "*(at the Speaking Stones)* Skarra's Wisps saw them go INTO the goose-girl's town! And they never came OUT! Where ARE they?!", m: "angry" },
      { s: "goldie", t: "*(clearing the plates)* More pie, anyone?", m: "stern" },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the mountains to the bog to the river flies the gold of the Hearthlands. Barnaby's footnotes are read aloud in the Moot, all hundred and twelve of them." },
      { s: "stone", t: "HELD." },
      { n: "That evening, a young dwarf and an orc come up out of the pub cellar for the last time, into the light, and nobody draws a blade.", req: { alive: ["dwarf", "orc"] } },
      { s: "maren", t: "We came to take your granaries, Mayor. You fed us instead.", m: "happy", req: { alive: "human" } },
      { s: "goldie", t: "Supper's at six! And Hobby, *you're* on time for once.", m: "happy" },
      { s: "barnaby", t: "Footnote one hundred and thirteen: *she was on time*.", m: "happy" },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying Karrak, Westmarch and the Bloodmire. The mountains, the river cities and the bog are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "Barnaby's tunnel map lies on the Archive table. Every route on it leads somewhere empty now." },
      { s: "goldie", t: "No more tricks, Hobby.", m: "sad" },
      { s: "hobby", t: "No. That was the last one. We read every footnote, Goldie. We just never found the one that said *stop*.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Hearthlands have fallen. {capital}, the last halfellow town, has been surrounded." },
      { n: "Hobby's last trick is her best. While the soldiers search empty houses, every halfellow family slips down the pub cellar and away through Barnaby's disused tunnel, one by one, in silence." },
      { s: "barnaby", t: "Footnote forty-one, Hobby. It runs out as well as in.", m: "flustered" },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs.", m: "stern" },
      { s: "skarra", t: "*(in the ruins)* The goose-girl, GONE! Down a HOLE! Like the lovers! Like EVERYONE!", m: "gleeful", req: { conqueror: "orc" } },
      { s: "maren", t: "*(in the empty pub)* There's a supper laid upstairs. Still warm.", m: "sad", req: { conqueror: "human" } },
      { s: "brunna", t: "*(in the empty cellar)* That's one of *our* tunnels. …Oskar, strike that. We lost the map. Fair's fair.", m: "happy", req: { conqueror: "dwarf" }, alt: { s: "sigrun", t: "*(in the empty cellar)* That's one of our tunnels. I know it well.", m: "happy", req: { conqueror: "dwarf" } } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "dwarf" },
        alt: { n: "Westmarch has won by holding the Marches, but the Hearthlands still stand.", req: { winner: "human" },
          alt: "The Orcs have won by holding the Marches, but the Hearthlands still stand." } },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "Crowns come and go, dear. Supper's still at six. Uncle, there must be a footnote for this.", m: "happy" },
      { s: "barnaby", t: "Footnote eighty. *Crowns come and go*. I wrote it years ago. For you.", m: "happy" },
    ],
  },
};
