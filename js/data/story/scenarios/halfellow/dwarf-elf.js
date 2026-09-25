/**
 * STORY SCENARIO -- halfellow/dwarf+elf, "Old Friends, Old Feuds"
 * The Rootcut feud (Dwarves vs Elves) is back, with the Hearthlands stuck in
 * between. Hobby keeps hosting peace suppers no one can swear at, and
 * leaves each one early. Threads: the Whispering War (Vaelis).
 * Shared defaults: js/data/story/shared/halfellow.js. Bible §9.5.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["halfellow/dwarf+elf"] = {
  title: "Old Friends, Old Feuds",
  beats: {
    B0: [
      { n: "The Hearthlands, home of the halfellows. It's a busy market morning, until every jug of milk in the country turns sour at once." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "In The Goose & Kettle, the oldest pub in the Hearthlands, Mayor Hobby Trickgrin gulps down breakfast standing up, while her sister Goldie, who keeps the pub, frowns at a jug of curdled milk." },
      { n: "Their uncle, Professor Barnaby Pickwort, keeper of the Hearthlands Archive, bursts in with a scroll." },
      { s: "barnaby", t: "The Marchstone has split! The closing clause: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "barnaby", t: "And, Hobby, the Dwarves and the Elves. The Rootcut feud. Eight hundred years of it, and the Accord was the only thing keeping it quiet." },
      { s: "hobby", t: "The Dwarves on one side, the Elves on the other, and us in the middle with all the barley. Wonderful." },
      { s: "goldie", t: "They'll both want our bread, love. And they'll both want us to say *they're* in the right." },
      { s: "hobby", t: "Then we'll feed them both, and agree with neither. That's a little plan." },
      { n: "In Karrak, the Dwarves' Loremaster Oskar opens the Book of Grudges to Entry the First: the Rootcut. In the Silverwood, the Elf heir Lord Vaelis reads the same news and smiles." },
      { s: "vaelis", t: "The mud-folk to the east, the Trickgrin woman in the middle. How *convenient*." },
    ],
    B1: [
      { n: "{city}, the second town of the Hearthlands, is founded among the hedgerows, exactly halfway between the mountains and the forest.", req: { cities: 2 },
        alt: "Halfellow families pack their carts to found a second town, exactly halfway between the mountains and the forest." },
      { n: "Hobby arrives at the founding ceremony at a run, between the Moot and the harvest committee. She is late to both." },
      { s: "hobby", t: "Lovely town! Build a big table in the square, everyone. Big enough for a dwarf *and* an elf." },
      { s: "barnaby", t: "They'll never sit at it, Hobby." },
      { s: "hobby", t: "No, Uncle. But they'll *know it's there*." },
    ],
    B2: [
      { n: "The barley fields, at dawn. Halfellow militia have clashed with dwarf warriors.", req: { firstBlood: "dwarf" },
        alt: "The forest's edge, at dawn. Halfellow militia have clashed with elf rangers." },
      { s: "hobby", t: "First blood. And we didn't even start the feud." },
      { s: "hobby", t: "Our traps are out. I used to laugh when those went off.", req: { tech: "self:halfellow_set_the_trap" } },
      { s: "goldie", t: "You're not grinning, love." },
      { s: "hobby", t: "No. I don't think this one's funny." },
    ],
    B3: [
      { n: "The big table in {capital}'s square. Hobby has invited the Dwarf Thane and the Elf Warden to a peace supper. Neither can swear an oath, with the stone broken. They come anyway." },
      { s: "brunna", t: "*(eyeing the elves)* I'll not eat at a table with the people who blamed Karrak for the Rootcut." },
      { s: "vaelis", t: "*(eyeing the dwarves)* I shall not eat at *any* table. I am here to observe." },
      { s: "aelthir", t: "The soup is very good, Mayor." },
      { s: "hobby", t: "Thank you, Warden. Lovely to see you. I've a Moot. Must dash." },
      { n: "She leaves them sitting at the table together. When she comes back two hours later, the Thane and the Warden are still there, still arguing, and the soup is gone." },
      { s: "barnaby", t: "They ate it, Hobby. All of it. Both of them." },
      { s: "hobby", t: "That's the trick, Uncle. Leave early." },
    ],
    B6: [
      { n: "The Goose & Kettle, early evening. Goldie has cleared a table, laid a proper supper for one, and is standing over it with her arms folded." },
      { s: "goldie", t: "Sit. Eat. And stay for the *whole* meal this time." },
      { s: "hobby", t: "Goldie, I left them alone at the table on *purpose*." },
      { s: "goldie", t: "I know. And it worked. Now it's your turn. Whatever you're planning next, it's the last one." },
      { s: "hobby", t: "…The last one. And then the biggest supper the Marches have ever seen." },
    ],

    "E-Held": [
      { n: "The Halfellows have won by holding the Marches." },
      { n: "Every field from the mountains to the forest flies the gold of the Hearthlands. The Marches have become one enormous neighbourhood." },
      { s: "stone", t: "HELD." },
      { n: "That evening, at the big table in {capital}'s square, a dwarf Thane and an elf Warden sit side by side, arguing about a grove that died eight hundred years ago. They are both smiling.", req: { alive: ["dwarf", "elf"] } },
      { s: "goldie", t: "Supper's at six, everyone! Hobby, *you're* on time for once." },
      { s: "hobby", t: "Only because I *live* here, dear." },
    ],
    "E-Remains": [
      { n: "The Halfellows have won by destroying the Dwarves and the Elves. The mountains and the forest are silent." },
      { s: "stone", t: "REMAINS." },
      { n: "The big table still stands in {capital}'s square. Nobody sits at it any more." },
      { s: "goldie", t: "No more tricks, Hobby." },
      { s: "hobby", t: "No. That was the last one. We were supposed to feed them both, Goldie. Not *this*." },
    ],
    "E-Fallen": [
      { n: "The Hearthlands have fallen. {capital}, the last halfellow town, has been surrounded." },
      { n: "Hobby's last trick is her best. While the soldiers search empty houses, every halfellow family slips out down the old smugglers' lanes, one by one, in silence." },
      { s: "barnaby", t: "I have the Accord. The Archive's copy. The only complete one in the Marches." },
      { s: "goldie", t: "*(locking the pub door)* We'll be back. Somebody has to collect the tabs." },
      { s: "vaelis", t: "*(in the empty square)* A table. Set for two enemies. How very *her*.", req: { conqueror: "elf" } },
      { s: "brunna", t: "*(in the empty square)* She left supper out. For *us*. …Don't touch it, anyone.", req: { conqueror: "dwarf" }, alt: { s: "sigrun", t: "*(in the empty square)* She left supper out. For *us*.", req: { conqueror: "dwarf" } } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Hearthlands still stand.", req: { winner: "dwarf" },
        alt: "The Elves have won by holding the Marches, but the Hearthlands still stand." },
      { n: "Far away, the split Marchstone speaks, and not to the Halfellows." },
      { s: "stone", t: "HELD." },
      { s: "hobby", t: "Crowns come and go, dear. Supper's still at six. Set the big table. Both of them are invited." },
      { s: "goldie", t: "And *you* are still going to be late for it." },
    ],
  },
};
