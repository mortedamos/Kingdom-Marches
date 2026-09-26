/**
 * STORY BARKS -- ADVANCEMENTS
 * ---------------------------
 * Pure data: what the player's own characters say when their kingdom
 * completes an advancement (js/engine/story.js advanceBark). Every
 * advancement gets a line (2026-09-25, user-directed).
 *
 * One pool per player race. Each entry is a normal bark line plus:
 *   techs: [ids]  -- only for these advancements, and always preferred
 *   cat: "..."    -- only for advancements of this category
 *                    (building / civic / military / mystic)
 *   then: [lines] -- a short conversation: each follow-up appears as a
 *                    reply card; it stops at a speaker who can't talk
 * Lines with neither `techs` nor `cat` fit any advancement. `{tech}` is
 * the advancement's name. Pools recycle once used up.
 */

window.GameData = window.GameData || {};
window.GameData.STORY_BARKS = window.GameData.STORY_BARKS || {};

window.GameData.STORY_BARKS.advance = {
  // -------------------------------------------------------------- HUMAN
  human: {
    caption: "Advancement complete: {tech}.",
    lines: [
      { s: "maren", t: "{tech}. Good. Westmarch was built by people who learned faster than their enemies." },
      { s: "corvin", t: "{tech}, Majesty. Filed, catalogued, and already being misunderstood by the Temple.", m: "wry" },
      { s: "aldric", t: "{tech}! The Dawn smiles on patient study. …And on me, for waiting through the lecture.", m: "happy" },
      { s: "maren", t: "Another page in the book. Keep writing, all of you.", m: "resolute" },
      { s: "corvin", t: "Do you know what I love about {tech}, Majesty? It works whether anyone prays over it or not.", m: "wry",
        then: [{ s: "aldric", t: "I prayed over it anyway.", m: "fervent" }, { s: "maren", t: "And it works. Everyone's happy. Moving on." }] },
      { s: "aldric", t: "{tech}. I confess I did not follow a word of Corvin's explanation. But I am *very* proud.", m: "happy" },

      { s: "maren", t: "{tech}. Masons first, then everything else. That's how my grandmother built {capital}.", cat: "building" },
      { s: "corvin", t: "{tech}. New plans for the builders. They'll ignore half of them, and the half they keep will be brilliant.", cat: "building", m: "wry" },
      { s: "aldric", t: "{tech}! Stone that stands is a prayer that stays, Majesty.", cat: "building", m: "fervent" },

      { s: "maren", t: "{tech}. A realm is its learning, its faith and its people. Mostly its people.", cat: "civic" },
      { s: "corvin", t: "{tech}: the least glamorous kind of progress, and the only kind that lasts.", cat: "civic", m: "wry" },
      { s: "maren", t: "{tech}. The ledgers will be pleased. The ledger-*keepers* will complain. Both mean it's working.", cat: "civic", m: "happy" },

      { s: "aldric", t: "{tech}! Let the Marches see the Shield of the Dawn made sharper!", cat: "military", m: "fervent" },
      { s: "maren", t: "{tech}. I would rather never need it. I will not be caught without it.", cat: "military", m: "resolute" },
      { s: "aldric", t: "{tech}. The soldiers will drill until dusk. I'll drill with them. Somebody fetch my good boots.", cat: "military", m: "happy",
        then: [{ s: "corvin", t: "He means the boots with the *sun* on them. There are four pairs.", m: "wry" }] },

      { s: "corvin", t: "{tech}! Now *that* is magic done properly. No incense, no chanting, just arithmetic and nerve.", cat: "mystic", m: "happy",
        then: [{ s: "aldric", t: "It is *still* sorcery.", m: "angry" }, { s: "maren", t: "It is still *ours*, Lord-Paladin. Be glad of it.", m: "resolute" }] },
      { s: "maren", t: "{tech}. I studied this once, you know, before the crown. I miss it more than I say.", cat: "mystic", m: "sad" },
      { s: "aldric", t: "{tech}. The Temple will need to be… consulted. Very quietly. After the fact.", cat: "mystic" },

      { s: "corvin", t: "Wizardry, Majesty. Real wizardry, taught in the open. Do you know how long I've waited to say that?", techs: ["wizardry"], m: "happy",
        then: [{ s: "maren", t: "About as long as I have.", m: "happy" }] },
      { s: "corvin", t: "Fireball. I'd like it noted that I have *never once* set the library on fire. Twice doesn't count.", techs: ["fireball"], m: "wry" },
      { s: "aldric", t: "Knighthood! Oaths sworn in the light! Oh, Majesty, I may weep.", techs: ["knighthood", "chivalric_order"], m: "fervent",
        then: [{ s: "corvin", t: "He's weeping.", m: "wry" }] },
      { s: "maren", t: "Sovereign Power. The crown was always heavy. Now it will be *felt*.", techs: ["sovereign_power"], m: "resolute" },
      { s: "aldric", t: "A Crusade! At last, the Dawn marches under its own banner!", techs: ["crusade"], m: "fervent",
        then: [{ s: "maren", t: "Under *my* banner, Aldric. The Dawn may walk beside it.", m: "resolute" }] },
      { s: "corvin", t: "Flight. Somewhere, my old tutor is spinning in his grave. He said it couldn't be done. He also said I'd amount to nothing.", techs: ["flight", "sail_the_skies"], m: "wry" },
      { s: "maren", t: "A Palace Charter. Not for my comfort. For theirs, so they can see the crown is going nowhere.", techs: ["palace_charter"] },
      { s: "corvin", t: "Invisibility. The Temple will be relieved. They can't disapprove of what they can't see.", techs: ["invisibility"], m: "wry" },
      { s: "aldric", t: "Invulnerability? No blade may touch them? Majesty, this is surely a miracle.", techs: ["invulnerability"], m: "fervent",
        then: [{ s: "corvin", t: "It's a *spell*. I wrote it. On a Tuesday.", m: "wry" }] },
      { s: "maren", t: "Walls. The first thing a kingdom learns, and the last thing it should forget.", techs: ["walls", "human_defend_the_walls"] },
      { s: "maren", t: "Trebuchets. If they will not open their gates, we will open them ourselves.", techs: ["trebuchet_engineering", "catapult_engineering"], m: "resolute" },
    ],
  },

  // ---------------------------------------------------------------- ELF
  elf: {
    caption: "Advancement complete: {tech}.",
    lines: [
      { s: "aelthir", t: "{tech}. We knew this once, long ago. It is good to remember it.", m: "wistful" },
      { s: "vaelis", t: "{tech}. The lesser peoples will need a century to match it. Let them try.", m: "aloof" },
      { s: "ysolde", t: "{tech}. The leaves were whispering about it yesterday. I simply listened.", m: "uncanny" },
      { s: "aelthir", t: "{tech}. Another thing learned. Another thing I shall carry.", m: "sad" },
      { s: "vaelis", t: "{tech}, Great-uncle. Shall I have it recited at the next council? Slowly, for the humans?", m: "aloof",
        then: [{ s: "aelthir", t: "There are no humans at the council, Vaelis." }, { s: "vaelis", t: "Then it will be *very* quick." }] },
      { s: "ysolde", t: "{tech}. The old oaks nodded. That is rare. They are not easily impressed.", m: "happy" },

      { s: "ysolde", t: "{tech}. We will not *build* it, exactly. We will ask the forest, and the forest will agree.", cat: "building", m: "uncanny" },
      { s: "aelthir", t: "{tech}. Build it well. Whatever we raise, I will have to watch fall one day.", cat: "building", m: "wistful" },
      { s: "vaelis", t: "{tech}. Finally, architecture that does not look like a pile of stacked mud.", cat: "building", m: "aloof" },

      { s: "aelthir", t: "{tech}. The Silverwood grows wiser, and a little kinder. That is enough.", cat: "civic" },
      { s: "ysolde", t: "{tech}. The rivers approve. I asked them.", cat: "civic", m: "uncanny" },
      { s: "vaelis", t: "{tech}. Useful. Dull, but useful. I shall pretend to have thought of it.", cat: "civic" },

      { s: "vaelis", t: "{tech}. Now our blades are as quick as our wit. Well. Nearly.", cat: "military", m: "happy" },
      { s: "aelthir", t: "{tech}. Our children learn war again. I had hoped that lesson was over.", cat: "military", m: "sad",
        then: [{ s: "vaelis", t: "It is never over, Great-uncle. It is only paused." }] },
      { s: "vaelis", t: "{tech}. Let the lesser peoples march in straight lines. We will be in the trees.", cat: "military", m: "aloof" },

      { s: "ysolde", t: "{tech}. The old magic stirs. It asks after you, Warden.", cat: "mystic", m: "uncanny",
        then: [{ s: "aelthir", t: "Tell it I am well. Tell it I am tired.", m: "wistful" }] },
      { s: "aelthir", t: "{tech}. My mother taught me this, the year the stars moved. I had almost forgotten her voice.", cat: "mystic", m: "wistful" },
      { s: "ysolde", t: "{tech}. Something in the deep roots just opened one eye. It is pleased with us.", cat: "mystic", m: "uncanny" },

      { s: "ysolde", t: "Druidism. The forest has a voice again, and it is very, very old.", techs: ["elf_druidism"], m: "uncanny" },
      { s: "aelthir", t: "The Living Forest. The trees remember every war. Now they may answer for it.", techs: ["elf_the_living_forest"], m: "wistful" },
      { s: "ysolde", t: "Nature's Fury. Warden, I would not stand between the forest and its anger. Neither should they.", techs: ["elf_natures_fury"], m: "uncanny" },
      { s: "vaelis", t: "Shadowsteed. Horses made of dusk. I shall ride one to the humans' door and knock.", techs: ["elf_shadowsteed"], m: "happy" },
      { s: "aelthir", t: "Tending to the Earth. The forest gives, when you ask it kindly. We had forgotten how to ask.", techs: ["elf_tending_to_the_earth"],
        then: [{ s: "ysolde", t: "It never forgot how to give.", m: "happy" }] },
      { s: "vaelis", t: "Upon the Wind. Now even the air takes our side. How fitting.", techs: ["elf_upon_the_wind"], m: "aloof" },
      { s: "aelthir", t: "Roots of the World. Everything is connected beneath the soil. Every grave, every seed.", techs: ["elf_roots_of_the_world"], m: "wistful" },
      { s: "vaelis", t: "Blade Storm. I have been practising the flourish in the mirror. Do not tell anyone.", techs: ["elf_blade_storm", "elf_whirlwind_strike"], m: "happy" },
      { s: "ysolde", t: "Poisonous Extracts. The mushrooms offered. It would have been rude to refuse.", techs: ["elf_poisonous_extracts"], m: "uncanny" },
    ],
  },

  // -------------------------------------------------------------- DWARF
  dwarf: {
    caption: "Advancement complete: {tech}.",
    lines: [
      { s: "oskar", t: "{tech}. Recorded in the Chronicle. The *good* book, Thane. Not the other one." },
      { s: "brunna", t: "{tech}. Karrak doesn't learn fast. Karrak learns *once*, and properly.", m: "proud" },
      { s: "kazra", t: "{tech}. Good. Now give me a week and a hammer and I'll make it better.", m: "focused" },
      { s: "sigrun", t: "{tech}! Somebody write a song about it! …Fine, I'll write a song about it.", m: "happy" },
      { s: "oskar", t: "{tech}. Entry {grudge} in the Book of Grudges: everyone who said it couldn't be done. Underlined.", m: "grudging",
        then: [{ s: "brunna", t: "How many is that now, Oskar?" }, { s: "oskar", t: "Enough, Thane. Never enough.", m: "grudging" }] },
      { s: "brunna", t: "{tech}. My father would have wanted to see this. I'll tell his stone tonight.", m: "sad" },

      { s: "kazra", t: "{tech}. Stone's already cut. I cut it last night. I had a feeling.", cat: "building", m: "focused" },
      { s: "brunna", t: "{tech}. Build it deep, build it thick, build it to outlast us all.", cat: "building", m: "proud" },
      { s: "oskar", t: "{tech}. The masons are singing. Sigrun, please stop teaching the masons to sing.", cat: "building",
        then: [{ s: "sigrun", t: "Never!", m: "fierce" }] },

      { s: "oskar", t: "{tech}. A tidy ledger is a strong hold. I've already balanced it twice.", cat: "civic" },
      { s: "brunna", t: "{tech}. The clans will eat better and grumble less. Well. Eat better.", cat: "civic", m: "happy" },
      { s: "kazra", t: "{tech}. Not glamorous. Neither's a keel. Try sailing without one.", cat: "civic" },

      { s: "sigrun", t: "{tech}! Now the war has a *rhythm*! Hear it? Boom, boom, CRASH!", cat: "military", m: "fierce" },
      { s: "brunna", t: "{tech}. We didn't start this war. We'll finish it.", cat: "military", m: "proud" },
      { s: "kazra", t: "{tech}. Point it at something that's annoying you, Thane. I'll wait.", cat: "military", m: "focused" },

      { s: "kazra", t: "{tech}. The runes are waking up. Stand back. No, further.", cat: "mystic", m: "focused" },
      { s: "oskar", t: "{tech}. There are secrets in the stone older than the Book. I'm not sure I want to read them.", cat: "mystic" },
      { s: "sigrun", t: "{tech}! Magic you can *hear*! Why did no one tell me magic could be loud?", cat: "mystic", m: "happy" },

      { s: "kazra", t: "Runecraft. Every stone in Karrak just got a little bit angrier. I did that.", techs: ["dwarf_runecraft"], m: "focused",
        then: [{ s: "brunna", t: "Well done, runesmith.", m: "proud" }] },
      { s: "kazra", t: "The Runeforged Titan. Thane, I've dreamed of this since I was apprenticed. Give me the forge.", techs: ["dwarf_runeforged_titan"], m: "focused",
        then: [{ s: "brunna", t: "It's yours. All of it.", m: "proud" }] },
      { s: "sigrun", t: "Heavy Metal! It's a *real* discipline now, Oskar! Write that in your book!", techs: ["dwarf_heavy_metal", "dwarf_power_metal", "dwarf_epic_metal"], m: "fierce",
        then: [{ s: "oskar", t: "I have. In the *other* book.", m: "grudging" }] },
      { s: "oskar", t: "The Long Reckoning. Every grudge settled, in time. Every single one.", techs: ["dwarf_the_long_reckoning"], m: "grudging" },
      { s: "brunna", t: "A Meeting of the Clans. Every hold, one table. Nobody bring an axe. …Nobody bring *two* axes.", techs: ["dwarf_meeting_of_the_clans", "dwarf_council_of_the_deep"] },
      { s: "kazra", t: "Arquebus engineering. Hammer, meet your noisy little cousin.", techs: ["dwarf_arquebus_engineering", "dwarf_bombardment", "dwarf_thunder_from_stone"], m: "happy" },
      { s: "oskar", t: "Chronicle in Stone. Our deeds, carved where no fire can reach. Good. I'm running out of vellum.", techs: ["dwarf_chronicle_in_stone"] },
      { s: "brunna", t: "Shield Wall. Let them come. Let them *all* come.", techs: ["dwarf_shield_wall", "dwarf_unyielding"], m: "proud" },
      { s: "kazra", t: "The Deep Mines. There's iron down there nobody's touched since the world was young.", techs: ["dwarf_the_deep_mines", "dwarf_dwarven_mining", "dwarf_prospectors_claim"], m: "focused" },
    ],
  },

  // ---------------------------------------------------------------- ORC
  orc: {
    caption: "Advancement complete: {tech}.",
    lines: [
      { s: "grukka", t: "{tech}. Good. The Clans get stronger. Their enemies get nervous.", m: "defiant" },
      { s: "gnash", t: "Gnash learn new thing! What thing? …Gnash forget. But it good thing!", m: "confused" },
      { s: "skarra", t: "{tech}! Hee hee! The ancestors whispered it to Skarra first, you know. They *like* Skarra.", m: "gleeful" },
      { s: "varg", t: "{tech}. That'll help. I think that'll really help, Father.", m: "happy" },
      { s: "grukka", t: "{tech}. Remember this day. The day the Bloodmire stopped being a joke to them.", m: "defiant",
        then: [{ s: "gnash", t: "Bloodmire never joke! …What is joke?", m: "confused" }] },
      { s: "skarra", t: "{tech}. Destiny, my frog, croaked twice. Twice is *very* good. Once is death. Don't ask about three.", m: "gleeful" },

      { s: "grukka", t: "{tech}. Build it big. Build it ugly. Let them see it from their walls.", cat: "building", m: "defiant" },
      { s: "gnash", t: "Gnash carry big rocks for {tech}! Gnash best at rocks!", cat: "building", m: "happy" },
      { s: "varg", t: "{tech}. Something that stays. We don't have enough things that stay.", cat: "building", m: "bashful" },

      { s: "grukka", t: "{tech}. A full belly fights harder. Even orcs know that.", cat: "civic" },
      { s: "varg", t: "{tech}. The pups in the camps will eat better this winter.", cat: "civic", m: "happy" },
      { s: "skarra", t: "{tech}? Boring! Where is the *fire*? Where are the *screams*? …Fine. It's useful. Hmph.", cat: "civic", m: "angry" },

      { s: "grukka", t: "{tech}. Sharpen everything. We march when I say.", cat: "military", m: "defiant" },
      { s: "gnash", t: "New way to SMASH! Gnash love {tech}! Gnash love all smash!", cat: "military", m: "happy",
        then: [{ s: "grukka", t: "Easy, Gnash. Save it for them.", m: "happy" }] },
      { s: "varg", t: "{tech}. I'll teach it to my riders. They'll come home. All of them. I'll make sure.", cat: "military" },

      { s: "skarra", t: "{tech}! The bog BUBBLES with it! Oh, it smells *wonderful*!", cat: "mystic", m: "gleeful" },
      { s: "grukka", t: "{tech}. My sister's work. I don't ask how. I don't want to know.", cat: "mystic",
        then: [{ s: "skarra", t: "You *never* want to know! It's the best part!", m: "gleeful" }] },
      { s: "gnash", t: "{tech} make Gnash's ears tingle. Gnash not like tingle.", cat: "mystic", m: "confused" },

      { s: "varg", t: "Dire wolves! Moss is going to have *so* many brothers and sisters.", techs: ["orc_dire_wolf", "orc_wolf_riders", "orc_hound_and_hunter"], m: "happy", req: { notFlag: "mossDead" } },
      { s: "varg", t: "Dire wolves. …Moss would have liked them.", techs: ["orc_dire_wolf", "orc_wolf_riders", "orc_hound_and_hunter"], m: "sad", req: { flag: "mossDead" } },
      { s: "gnash", t: "Ogres! More Gnash! …Not *more Gnash*. More *like* Gnash. Gnash only one Gnash.", techs: ["orc_ogre"], m: "happy",
        then: [{ s: "skarra", t: "Thank the ancestors for *that*.", m: "gleeful" }] },
      { s: "skarra", t: "The Bog Witches! My sisters, my *darlings*! Rise, rise from the mud!", techs: ["orc_bog_witch", "orc_bog_spirit"], m: "gleeful" },
      { s: "grukka", t: "Dragon riders. My grandfather said the dragons would come back to the Clans. Nobody believed him.", techs: ["orc_dragon_riders", "orc_draconic_mastery", "orc_dragon_den_rite"], m: "defiant",
        then: [{ s: "varg", t: "I believed him.", m: "bashful" }] },
      { s: "skarra", t: "Burn It All Down! Oh, brother, you DO love me!", techs: ["orc_burn_it_all_down", "orc_pyromania"], m: "gleeful",
        then: [{ s: "grukka", t: "Don't make me regret it." }] },
      { s: "grukka", t: "Plunder. What they won't give, we take. What they won't sell, we take twice.", techs: ["orc_plunder", "orc_pillage_and_loot", "orc_spoils_of_war"], m: "defiant" },
      { s: "skarra", t: "Malefic Malediction! Every curse Skarra ever dreamed of! Where do I *start*?", techs: ["orc_malefic_malediction", "orc_afflictions_of_anguish"], m: "gleeful" },
      { s: "grukka", t: "The Old Ways. Before the Accord. Before the walls. When the Marches feared us.", techs: ["orc_the_old_ways"] },
      { s: "gnash", t: "Battering ram! Is like Gnash, but wood! Gnash approve!", techs: ["orc_battering_ram", "orc_siege_tactics"], m: "happy" },
    ],
  },

  // ---------------------------------------------------------- HALFELLOW
  halfellow: {
    caption: "Advancement complete: {tech}.",
    lines: [
      { s: "barnaby", t: "{tech}! I'll have the pamphlet written by teatime. Two pamphlets. One with pictures.", m: "happy" },
      { s: "hobby", t: "{tech}. Lovely! And nobody even had to miss second breakfast for it.", m: "happy" },
      { s: "goldie", t: "{tech}. Very clever. Now everyone wash up, supper's in an hour.", m: "stern" },
      { s: "barnaby", t: "{tech}. Cross-referenced, indexed and footnoted. The footnotes have footnotes.",
        then: [{ s: "hobby", t: "Barnaby, dear, nobody reads the footnotes." }, { s: "barnaby", t: "*I* read the footnotes!", m: "flustered" }] },
      { s: "hobby", t: "{tech}. Now, I have a *little* idea about what we might do with it…", m: "scheming" },
      { s: "goldie", t: "{tech}. My mother would have called it newfangled. Then she'd have used it every day.", m: "happy" },

      { s: "goldie", t: "{tech}. Build it proper. Round doors, deep cellars, and a good kitchen.", cat: "building", m: "stern" },
      { s: "hobby", t: "{tech}. A new building! I'll have the ribbon ready. Where did I put the scissors?", cat: "building", m: "happy" },
      { s: "barnaby", t: "{tech}. I've drafted the plans. The builders have drafted objections. We'll meet in the middle.", cat: "building", m: "flustered" },

      { s: "hobby", t: "{tech}. A happier Hearthlands is a harder Hearthlands to conquer, dear.", cat: "civic", m: "scheming" },
      { s: "goldie", t: "{tech}. More in the larder and more at the table. That's what matters.", cat: "civic", m: "happy" },
      { s: "barnaby", t: "{tech}. A civic triumph! I'll add it to the Archive, under *Triumphs, civic, minor but lovely*.", cat: "civic", m: "happy" },

      { s: "hobby", t: "{tech}. We're small, dear. We don't have to be *easy*.", cat: "military", m: "scheming" },
      { s: "goldie", t: "{tech}. I don't like it. But I'll like it better than the alternative.", cat: "military", m: "stern" },
      { s: "barnaby", t: "{tech}. Oh dear. Oh dear, oh dear. It's very effective. I've read the reports.", cat: "military", m: "flustered",
        then: [{ s: "hobby", t: "That's rather the point, Barnaby.", m: "scheming" }] },

      { s: "barnaby", t: "{tech}! Mushrooms, fairy rings and riddles. The three pillars of halfellow scholarship.", cat: "mystic", m: "happy" },
      { s: "hobby", t: "{tech}. A bit of old magic. Just enough to be surprising. That's the best amount.", cat: "mystic", m: "scheming" },
      { s: "goldie", t: "{tech}. Keep it out of my kitchen. Last time the soup started talking.", cat: "mystic", m: "stern" },

      { s: "barnaby", t: "The Riddle Game! At last, the Archive's *true* purpose! I have eleven hundred riddles ready!", techs: ["halfellow_riddle_game"], m: "happy",
        then: [{ s: "hobby", t: "Start with the easy ones, dear.", m: "happy" }, { s: "barnaby", t: "There *are* no easy ones!", m: "flustered" }] },
      { s: "goldie", t: "Throw a Party! Now *that's* a proper advancement. I'll start the pies.", techs: ["halfellow_throw_a_party", "halfellow_pub_crawl"], m: "happy" },
      { s: "hobby", t: "Making Trouble. Oh, I've been *waiting* for this one.", techs: ["halfellow_making_trouble", "halfellow_sneaking_around", "halfellow_knife_in_the_dark"], m: "scheming" },
      { s: "goldie", t: "Rouse the Militia. Every farmer, every pitchfork. Nobody takes the Hearthlands lying down.", techs: ["halfellow_rouse_the_militia", "halfellow_rouse_the_people"], m: "stern" },
      { s: "barnaby", t: "Mycomancer! Mushroom magic! I've a whole shelf on it. Nobody has *ever* borrowed from that shelf.", techs: ["halfellow_mycomancer", "halfellow_poisonous_puff", "halfellow_fairy_ring"], m: "happy" },
      { s: "hobby", t: "A Nice Day Fishing. Honestly, dear, it's the best thing we've learned all year.", techs: ["halfellow_nice_day_fishing", "halfellow_riverfolk"], m: "happy" },
      { s: "goldie", t: "Family and Friendship. We didn't need an advancement for that. …But it's nice to have it written down.", techs: ["halfellow_family_and_friendship", "halfellow_community_fellowship"], m: "happy" },
      { s: "barnaby", t: "The Road Goes Ever On. Beautiful phrase. I wish I'd written it. I didn't. I checked.", techs: ["halfellow_road_goes_ever_on"] },
      { s: "hobby", t: "Pony Patrol! Little ponies, little riders, very big surprise.", techs: ["halfellow_pony_patrol"], m: "scheming" },
      { s: "hobby", t: "Boomerangs! They come *back*, dear. Unlike our enemies, with any luck.", techs: ["halfellow_boomerang"], m: "scheming" },
    ],
  },
};
