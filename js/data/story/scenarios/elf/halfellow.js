/**
 * STORY SCENARIO -- elf/halfellow, "Mushrooms and Oaks"
 * The gentlest Elf scenario. Hobby Trickgrin pranks Vaelis mercilessly and
 * he loses his composure for the first time in three centuries; Aelthir
 * secretly enjoys every trick. The druid-versus-mycomancer argument holds
 * the answer to the stone: "decay makes room."
 * Shared defaults: js/data/story/shared/elf.js. Bible §9.2.
 */
window.GameData = window.GameData || {};
window.GameData.STORY_SCENARIOS = window.GameData.STORY_SCENARIOS || {};

window.GameData.STORY_SCENARIOS["elf/halfellow"] = {
  title: "Mushrooms and Oaks",
  beats: {
    B0: [
      { n: "The Silverwood, the forest realm of the Elves. At midnight, the Heartwood, the great tree at the forest's heart, groans down to its deepest roots." },
      { n: "Far away, at the heart of the Marches, the ancient Marchstone splits with a crack of gold, and speaks." },
      { s: "stone", t: "HOLD… OR REMAIN." },
      { n: "Beneath the Heartwood stands Aelthir Moonveil, Warden of the Silverwood, the last living witness of the Long Accord, with his niece Ysolde the Archdruid and his heir, Lord Vaelis Nightbloom." },
      { s: "ysolde", t: "The stone's last words, Warden: the Marches pass to the crown that *holds* them, or failing that, the crown that *remains*.", m: "uncanny" },
      { s: "aelthir", t: "And to the south, the Hearthlands. The halfellows. I held the torch when their first Mayor swore the Accord. I promised, then, to shelter them.", m: "wistful" },
      { s: "vaelis", t: "You promised a great many things to a great many small people, great-uncle. The stone that held you to those promises is broken.", m: "aloof" },
      { s: "ysolde", t: "The oaks are asking whether this war means mushrooms.", m: "uncanny" },
      { s: "vaelis", t: "It will mean *pies*, mother. Thrown ones. The Trickgrin woman has been an embarrassment to me for forty years.", m: "angry" },
      { n: "In the Hearthlands, home of the halfellows, Mayor Hobby Trickgrin reads the news in The Goose & Kettle, the halfellows' oldest pub, and grins." },
      { s: "hobby", t: "The Elves. Oh, bother. I *like* the Elves. …Well. Most of them.", m: "sad" },
    ],
    B1: [
      { n: "{city}, a new grove-town of the Silverwood, is planted at the forest's southern edge, facing the halfellow meadows.", req: { cities: 2 },
        alt: "Elf druids walk the forest's southern edge, choosing where a second grove-town will grow." },
      { s: "vaelis", t: "A grove facing the Hearthlands. The halfellows will see it every morning and remember who was here first.", m: "aloof" },
      { n: "By the next morning, somebody has planted a neat row of mushrooms all the way around the new grove, spelling out a word." },
      { s: "ysolde", t: "It says *HELLO*, my son. In mushrooms. They are very good mushrooms.", m: "happy" },
      { s: "vaelis", t: "*Burn* them.", m: "angry" },
    ],
    B2: [
      { n: "The forest's edge, at dawn. Elf and halfellow warriors have clashed for the first time since the Accord." },
      { s: "aelthir", t: "First blood, with the halfellows. I swore to shelter them, Ysolde.", m: "sad" },
      { s: "ysolde", t: "The Accord is broken, Warden. So is the oath. The trees say you may stop feeling guilty. They do not think you will.", m: "uncanny" },
      { n: "In The Goose & Kettle, Hobby hears the news quietly, and for once she doesn't grin." },
      { s: "hobby", t: "First blood. With the *Elves*. I used to take bets on who could make Lord Vaelis twitch.", m: "scheming" },
    ],
    B3: [
      { n: "Lord Vaelis's war-tent, at dawn. The heir of the Silverwood wakes to find it full of honey, and then, very quickly, full of geese." },
      { s: "vaelis", t: "*TRICKGRIN*.", m: "angry" },
      { n: "It is the first time in three centuries anyone has heard Lord Vaelis Nightbloom raise his voice. Every elf in the camp stops to listen." },
      { s: "ysolde", t: "The geese are wearing little hats, my son.", m: "happy" },
      { s: "vaelis", t: "I can *see* the hats, mother.", m: "angry" },
      { n: "Beneath the Heartwood, the ancient Warden hears the story, and laughs until he has to sit down." },
      { s: "aelthir", t: "I have not laughed like that since the Accord. Tell no one, Ysolde.", m: "happy" },
    ],
    B4: [
      { n: "Beneath the Heartwood, Ysolde kneels among the roots. Beside her, remarkably, sits a halfellow: the Mycomancer who grew the mushrooms, captured and very polite." },
      { s: "ysolde", t: "The druids have argued with the mycomancers about the rot beneath the forest for three hundred years. I asked her what she thought of the stone.", m: "uncanny" },
      { s: "ysolde", t: "She said: “Decay makes room, dear.” The stone did not break, Warden. It *sighed*, and rotted, and made room. For whatever grows next.", m: "uncanny" },
      { s: "aelthir", t: "Then the Accord cannot be restored.", m: "sad" },
      { s: "ysolde", t: "Only replaced. The halfellow and the trees agree. That has never happened before.", m: "happy" },
      { s: "vaelis", t: "I am losing this war to *mushrooms*.", m: "angry" },
    ],
    B6: [
      { n: "Night, beneath the Heartwood. A basket has been left at the Warden's feet: fresh bread, a pot of honey, and a note in a round, cheerful hand." },
      { s: "aelthir", t: "“Warden, you swore to shelter us once. I know you can't now. No hard feelings. The honey's from the geese. Hobby.”", m: "happy" },
      { s: "ysolde", t: "Geese do not make honey, Warden.", m: "uncanny" },
      { s: "aelthir", t: "I know, Ysolde. That is rather the joke.", m: "happy" },
      { s: "vaelis", t: "*(from the shadows)* If that honey is from *my tent*, great-uncle, I will have her *head*.", m: "angry" },
    ],

    "E-Held": [
      { n: "The Elves have won by holding the Marches." },
      { n: "The forest has walked back over the old borders, and at the edge of every grove, somebody has planted mushrooms. The trees seem to like them." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I name Ysolde my heir. Not Vaelis.", m: "happy" },
      { s: "vaelis", t: "You would give the Silverwood to a woman who talks to *puddles*.", m: "angry" },
      { s: "ysolde", t: "And to mushrooms now, my son. They have a great deal to say about you.", m: "uncanny" },
      { n: "A halfellow messenger arrives with an invitation to supper at The Goose & Kettle. It is addressed to Lord Vaelis personally.", req: { alive: "halfellow" } },
      { s: "vaelis", t: "…Tell her I shall come. And that I am bringing my *own* geese.", m: "aloof", req: { alive: "halfellow" } },
    ],
    "E-Remains": [
      { n: "The Elves have won by destroying the Halfellows. The Hearthlands are empty, and the meadows are going back to forest." },
      { s: "stone", t: "REMAINS." },
      { s: "vaelis", t: "The Trickgrin woman is gone. The Silverwood will be quieter.", m: "aloof" },
      { n: "Vaelis stands at the edge of an empty meadow for a very long time." },
      { s: "vaelis", t: "…I find I do not care for the quiet, great-uncle.", m: "sad" },
      { s: "aelthir", t: "Nor I, child. I swore to shelter them.", m: "sad" },
    ],
    "E-Fallen": [
      { n: "The Halfellows have broken the Silverwood. {capital} has been surrounded by barley fields and very polite militia." },
      { s: "ysolde", t: "The oaks are going back to sleep, Warden. The mushrooms are staying up.", m: "uncanny" },
      { s: "aelthir", t: "I swore to shelter them. In the end, they sheltered themselves. Tell the Mayor I am proud of her.", m: "wistful" },
      { n: "Lord Vaelis mounts his Shadowsteed. A goose is sitting on its saddle." },
      { s: "vaelis", t: "I shall remember all of you. Briefly. Except *her*. Her I shall remember *forever*.", m: "angry" },
      { s: "hobby", t: "*(in the ruins)* Leave the Warden's tree alone, everybody. And put the kettle on.", m: "sad" },
      { s: "stone", t: "NOT YOU." },
    ],
    "E-Eclipsed": [
      { n: "The Halfellows have won by holding the Marches. Every field is one enormous neighbourhood, but the Silverwood still stands." },
      { n: "Far away, the split Marchstone speaks, and not to the Elves." },
      { s: "stone", t: "HELD." },
      { s: "aelthir", t: "I swore to shelter them, Ysolde. They have ended up sheltering the whole Marches.", m: "happy" },
      { n: "A letter arrives from The Goose & Kettle: supper, every Midsummer, forever. Lord Vaelis reads it twice." },
      { s: "vaelis", t: "…I suppose one supper would not *kill* me.", m: "aloof" },
    ],
  },
};
