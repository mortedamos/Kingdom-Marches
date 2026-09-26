/**
 * STORY SCENARIO -- halfellow/human, "The Unpaid Tab"
 * The friends who forgot to say thank you. Hobby must fight the people her
 * farms have fed for generations. Goldie demands the Lord-Paladin's bar tab
 * as war reparations; Aldric insists it's a tithe; Corvin sides with Goldie.
 * Shared defaults: js/data/story/shared/halfellow.js. Bible §9.5.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/human"] = {
  title: "The Unpaid Tab",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll." },
      { s: "barnaby", t: "The Marchstone has split! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "flustered" },
      { s: "hobby", t: "And Westmarch will want it. The Humans. We've fed their cities for three hundred years.", m: "scheming" },
      { s: "goldie", t: "And not once said thank you. And the Lord-Paladin of Westmarch, the Queen's own brother, owes *this pub* four hundred silver.", m: "stern" },
      { n: "In Westmarch, the Human kingdom, Queen Maren Ashcroft reads the news with her brother Aldric, of the Temple of the Dawn, and her Archmage, Corvin Varro." },
      { s: "maren", t: "The Hearthlands hold half the granaries in the Marches. We'll need them, one way or another.", m: "resolute" },
      { s: "corvin", t: "Before we march on the bakers, Majesty, perhaps the Lord-Paladin should settle his bar tab with them.", m: "wry" },
      { s: "aldric", t: "It is a *tithe*, Archmage. For the pub's spiritual wellbeing.", m: "fervent" },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town among the hedgerows." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! Plant wheat. And *don't* sell any of it to Westmarch until they say please.", m: "scheming" },
      { s: "barnaby", t: "Hobby, that's an *embargo*.", m: "flustered" },
      { s: "hobby", t: "It's *manners*, Uncle.", m: "scheming" },
    ],
    B2: [
      { n: "The road to Westmarch, at dusk. Halfellow militia and human soldiers have clashed over a bread cart for the first time since the Accord." },
      { s: "hobby", t: "First blood. Over *bread*. Three hundred years we've fed them, and it's come to this.", m: "sad" },
      { s: "hobby", t: "Our traps are out now, too. I used to laugh when those went off.", m: "sad", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love.", m: "sad", alt: { s: "barnaby", t: "You're not grinning, Hobby.", m: "sad" } },
      { s: "hobby", t: "No. I don't think this one's funny.", m: "sad" },
    ],
    B3: [
      { n: "The reading room of the Hearthlands Archive. Barnaby has unrolled the Accord, and next to it, a much longer document: the Lord-Paladin's bar tab." },
      { s: "barnaby", t: "Mayor, the complete text of the Long Accord. And the complete text of Lord Aldric's tab. The tab is longer.", m: "flustered" },
      { s: "goldie", t: "Four hundred silver, Hobby. I want it *in the peace treaty*.", m: "stern" },
      { s: "hobby", t: "Goldie, there's no peace treaty. The stone's broken. Nobody can swear anything.", m: "sad" },
      { s: "goldie", t: "Then I want it in the *war*.", m: "stern" },
      { n: "A letter arrives from Westmarch the next day, in a dry, precise hand." },
      { s: "corvin", t: "*(his letter)* “Mistress Trickgrin. The Collegium formally supports your claim against the Lord-Paladin. I have never enjoyed a war aim more. Corvin Varro.”", m: "wry" },
    ],
    B6: [
      { n: "The Goose & Kettle, early evening. Goldie has cleared a table, laid a proper supper for one, and is standing over it with her arms folded." },
      { s: "goldie", t: "Sit. Eat. And then promise me something.", m: "stern" },
      { s: "hobby", t: "I've got a Moot in ten minutes.", m: "scheming" },
      { s: "goldie", t: "Whatever you're planning next, it's the last one. And when this is over, you're going to Westmarch and you're collecting that tab *in person*.", m: "stern" },
      { s: "hobby", t: "…The last one. And yes. In person. With interest.", m: "scheming" },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the river to the hills flies the gold of the Hearthlands. No one conquered the Marches. They simply became one enormous neighbourhood." },
      { s: "stone", t: "HELD." },
      { n: "That evening, The Goose & Kettle hosts the Queen of Westmarch and her court. At the end of the meal, the Lord-Paladin is presented with a bill.", req: { alive: "human" } },
      { s: "aldric", t: "…Four hundred silver. *And* supper.", m: "sad", req: { alive: "human" } },
      { s: "maren", t: "Pay it, brother. And say thank you. We've three hundred years of them to catch up on.", m: "resolute", req: { alive: "human" } },
      { s: "goldie", t: "*(counting the coins)* Tab: *closed*.", m: "happy" },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying Westmarch. The river cities are empty." },
      { s: "stone", t: "REMAINS." },
      { s: "goldie", t: "The tab's still open, Hobby. There's no one left to pay it.", m: "sad", alt: { s: "barnaby", t: "The tab's still open. There's no one left to pay it.", m: "sad" } },
      { n: "That night, the halfellows light a great bonfire on the hill above {capital}. It is not a celebration." },
      { s: "hobby", t: "Three hundred years of bread, Goldie. And we never once heard them say thank you. Now we never will.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "Westmarch has broken the Hearthlands. {capital}, the last halfellow town, has been surrounded." },
      { n: "Hobby's last trick is her best. While the human army searches empty houses, every halfellow family slips out down the old smugglers' lanes, one by one, in silence." },
      { s: "barnaby", t: "I have the Accord. The Archive's copy. The only complete one in the Marches.", m: "sad" },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs.", m: "stern" },
      { n: "In the empty pub, Queen Maren of Westmarch finds the Lord-Paladin's tab, framed, over the bar." },
      { s: "maren", t: "Aldric. Pay it. *Now*. To whoever's left.", m: "angry" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "Westmarch has won by holding the Marches. Westmarch's banners fly from the river to the hills, but the Hearthlands still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "Crowns come and go, dear. Supper's still at six. And they'll still need our bread.", m: "happy" },
      { s: "goldie", t: "And *you* are still going to be late for it.", m: "stern" },
      { n: "A messenger from Westmarch arrives at The Goose & Kettle with a heavy purse and a note: “Four hundred silver. And thank you. For the bread. All of it. — M.”" },
    ],
  },
};
