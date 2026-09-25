/**
 * STORY SCENARIO -- elf/halfellow+orc, "Wolves at the Hedge"
 * Skarra comes for the Hearthlands, the revenge she planned forty years ago.
 * Centuries ago Aelthir swore, under the Accord, to shelter the halfellows,
 * and he can't keep that oath now without fighting both. Threads: the
 * witches' feud, the Whispering War. Shared defaults: shared/elf.js.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/halfellow+orc"] = {
  title: "Wolves at the Hedge",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, the last living witness of the Long Accord, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*." },
      { s: "aelthir", t: "I held the torch when the halfellows' first Mayor swore the Accord. I swore, that day, to shelter them from any crown that marched on them." },
      { n: "On the south wind comes the smell of smoke. The Orcs of the Bloodmire are gathering, and they are looking at the Hearthlands." },
      { s: "ysolde", t: "Skarra. The bog-witch. She planned a raid on the halfellows forty years ago, and a halfellow girl with a goose made a fool of her. She has not forgotten." },
      { s: "vaelis", t: "Then the Orcs will eat the halfellows, and we shall eat what is left of the Orcs. The Accord is broken, great-uncle. So is your promise." },
      { s: "aelthir", t: "A promise does not break because the stone did, Vaelis. Only because I let it." },
      { n: "In the Hearthlands, Mayor Hobby Trickgrin, once that halfellow girl with the goose, reads the news and reaches for her hat." },
      { s: "hobby", t: "Skarra Ironjaw, back for another go. And the Elves on our other side. Goldie, I have a little plan. It has *two* geese in it." },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted at the forest's southern edge, between the Hearthlands and the bog.", req: { cities: 2 },
        alt: "Elf druids choose where a second grove-town will grow: between the Hearthlands and the bog." },
      { s: "aelthir", t: "There. Between the wolves and the hedge." },
      { s: "vaelis", t: "You planted a *town* as a *promise*, great-uncle." },
      { s: "aelthir", t: "I planted a town as a *reminder*, Vaelis. Mostly to myself." },
    ],
    B2: [
      { n: "The meadow's edge, at dawn. Elf rangers have clashed with halfellow militia over the forest's border.", req: { firstBlood: "halfellow" },
        alt: "The borderwood, at dawn. Elf rangers have clashed with an orc war-band marching on the Hearthlands." },
      { s: "aelthir", t: "First blood with the halfellows. The very people I swore to shelter.", req: { firstBlood: "halfellow" }, alt: "First blood with the Orcs, on the road to the Hearthlands. Good. Let them come through *us*." },
      { s: "vaelis", t: "The oath, great-uncle. It is starting to cost us arrows.", req: { firstBlood: "orc" }, alt: "You see, great-uncle? Your oath does not even stop *us* from fighting them." },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. A basket has been left at the Warden's feet: fresh bread, a pot of honey, and a note in a round, cheerful hand." },
      { s: "aelthir", t: "“Warden. You swore to shelter us. I know you can't now. So we're sheltering ourselves. The geese send regards. Hobby.”" },
      { s: "ysolde", t: "She is letting you go, Warden. From the oath." },
      { s: "aelthir", t: "She is *forgiving* me for it, Ysolde. That is worse. And far kinder." },
      { s: "vaelis", t: "*(from the shadows)* If that honey is from *my tent* again…" },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders, and stopped, very politely, at the hedges of the Hearthlands." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis. And I renew my oath: the halfellows are sheltered, for as long as the Silverwood stands." },
      { s: "vaelis", t: "An oath with no stone to hold you to it, great-uncle." },
      { s: "aelthir", t: "Then *I* shall hold me to it, Vaelis. That is what an oath is, in the end." },
      { s: "hobby", t: "*(by letter)* “Thank you, Warden. The geese are thrilled. Lord Vaelis, check your tent.”", req: { alive: "halfellow" } },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying the Halfellows and the Orcs. The Hearthlands are empty. The bog is silent." },
      { s: "stone", t: "REMAINS." },
      { s: "aelthir", t: "I swore to shelter them, Ysolde. I have sheltered them into the ground." },
      { s: "vaelis", t: "They would have fallen to the Orcs anyway, great-uncle." },
      { s: "aelthir", t: "Yes, Vaelis. And I would have been standing in front of them when they did. That was the *point*." },
    ],
    "E-Fallen": [
      { n: "The Silverwood has fallen, and {capital} is lost." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden." },
      { s: "aelthir", t: "Tell the halfellow Mayor… I tried. For a thousand years, I tried." },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly." },
      { s: "skarra", t: "The elf-witch's forest, ASH! And the goose-girl's next! Ha! HA!", req: { conqueror: "orc" } },
      { s: "hobby", t: "Leave the big tree standing, everyone. The Warden meant well. He always did.", req: { conqueror: "halfellow" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Halfellows have won by holding the Marches, but the Silverwood still stands.", req: { winner: "halfellow" },
        alt: "The Orcs have won by holding the Marches, but the Silverwood still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "The halfellows sheltered themselves after all. I will witness their Accord, and I will be proud to.", req: { winner: "halfellow" },
        alt: "The Orcs hold the Marches. Then the Silverwood shelters the halfellows *now*, oath or no oath." },
      { s: "vaelis", t: "Of course we do, great-uncle. Of course we do." },
    ],
  },
};
