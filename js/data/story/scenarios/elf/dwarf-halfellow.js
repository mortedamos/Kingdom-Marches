/**
 * STORY SCENARIO -- elf/dwarf+halfellow, "Tunnels Under the Meadow"
 * Dwarves and halfellows are old brewing partners -- halfellow barley, dwarf
 * brewing -- and the Elves are the outsiders. Aelthir is lonely; Vaelis is
 * baffled anyone would want to be included, and quietly sets about breaking
 * the partnership (the Whispering War, shared.js whisper:*).
 * Shared defaults: js/data/story/shared/elf.js. Bible §9.2.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/dwarf+halfellow"] = {
  title: "Tunnels Under the Meadow",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, the last living witness of the Long Accord, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "uncanny" },
      { s: "vaelis", t: "Our neighbours: the mud-folk of Karrak in their mountains, and the halfellows of the Hearthlands in their meadows. And between them, great-uncle, a very old *partnership*.", m: "aloof" },
      { s: "aelthir", t: "The ale trade. Halfellow barley, dwarf brewing. They have shared a barrel at every Midsummer Fair for three hundred years.", m: "wistful" },
      { s: "vaelis", t: "And never once invited us.", m: "aloof" },
      { s: "ysolde", t: "Did you *want* to be invited, my son?", m: "happy" },
      { s: "vaelis", t: "Certainly not. I merely wished to be asked, so that I could refuse.", m: "aloof" },
      { n: "In Karrak, the Dwarves' Thane Brunna Stonefast raises a tankard of halfellow ale. In the Hearthlands, Mayor Hobby Trickgrin raises one of dwarf ale. Neither mentions the Elves." },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted between the mountains and the meadows.", req: { cities: 2 },
        alt: "Elf druids walk the forest's edge, choosing where a second grove-town will grow: right between the mountains and the meadows." },
      { s: "vaelis", t: "Right on their trade road. Every barrel of ale between Karrak and the Hearthlands will have to pass through *our* trees.", m: "happy" },
      { s: "aelthir", t: "You are taxing their *ale*, Vaelis.", m: "angry" },
      { s: "vaelis", t: "I am *inconveniencing* their friendship, great-uncle. The ale is merely a vehicle.", m: "aloof" },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Elf warriors have clashed with the Dwarves for the first time since the Accord.", req: { firstBlood: "dwarf" },
        alt: "The meadows' edge, at dawn. Elf warriors have clashed with the halfellows for the first time since the Accord." },
      { s: "aelthir", t: "First blood. And I wonder, Ysolde, how many of today's dead once shared a barrel with the people who killed them.", m: "sad" },
      { s: "oskar", t: "*(in Karrak)* Entry the First, the Rootcut. Reopened.", m: "grudging", req: { firstBlood: "dwarf" } },
      { s: "hobby", t: "*(in the Hearthlands)* First blood with the Elves. I used to take bets on who could make Lord Vaelis twitch.", m: "scheming", req: { firstBlood: "halfellow" } },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. Aelthir listens to distant music from the south-east: a dwarf and a halfellow song, sung together somewhere far away." },
      { s: "aelthir", t: "They are still singing together, Ysolde. In the middle of a war.", m: "wistful" },
      { s: "ysolde", t: "And we have never once been asked to sing, Warden.", m: "sad" },
      { s: "vaelis", t: "Elves do not *sing drinking songs*, mother.", m: "aloof" },
      { s: "ysolde", t: "No, my son. That, I think, is rather our problem.", m: "uncanny" },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders. The ale road still runs through it, and the trees let the barrels pass." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis.", m: "happy" },
      { s: "vaelis", t: "You would give the Silverwood to a woman who talks to *puddles*.", m: "angry" },
      { s: "ysolde", t: "And they, my son, have a great deal to say about you.", m: "uncanny" },
      { n: "At the next Midsummer Fair, a dwarf and a halfellow share a barrel at the Marchstone as they always have. This time, there are three tankards. The third is for the Warden.", req: { alive: ["dwarf", "halfellow"] } },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying the Dwarves and the Halfellows. The mountains and the meadows are silent." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "Their partnership is ended, great-uncle. As brief things do.", m: "aloof" },
      { s: "aelthir", t: "We were never invited, Vaelis. And now there is no one left to invite us.", m: "sad" },
      { n: "At the Marchstone, Aelthir finds an old barrel left over from the last Midsummer Fair. It is still half full. He does not drink from it." },
    ],
    "E-Fallen": [
      { n: "The Silverwood has fallen. Dwarf and halfellow banners fly together over {capital}." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden.", m: "sad" },
      { s: "aelthir", t: "They beat us *together*. I think that is what I envy most.", m: "wistful" },
      { s: "vaelis", t: "*(mounting his Shadowsteed)* I shall remember all of you. Briefly.", m: "aloof" },
      { s: "hobby", t: "*(in the ruins)* Leave a barrel under the Heartwood, dear. For the Warden. He always looked thirsty.", m: "sad", req: { conqueror: "halfellow" } },
      { s: "oskar", t: "*(in the ruins)* Entry the First. The Rootcut. Settled. Finally.", m: "grudging", req: { conqueror: "dwarf" } },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Dwarves have won by holding the Marches, but the Silverwood still stands.", req: { winner: "dwarf" },
        alt: "The Halfellows have won by holding the Marches, but the Silverwood still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { n: "A barrel arrives at the Heartwood, from both Karrak and the Hearthlands, with a note: “To the Warden. Finally invited. Don't be strange about it.”" },
      { s: "vaelis", t: "…We are *not* going.", m: "angry" },
      { s: "aelthir", t: "*We*, Vaelis, are going.", m: "happy" },
    ],
  },
};
