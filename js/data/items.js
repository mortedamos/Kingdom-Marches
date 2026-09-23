/**
 * ITEM DATA
 * ---------
 * Permanent gear a unit CARRIES (unit.items = { <id>: true }), one of each id
 * per unit. Distinct from one-shot treasures (Tome, Elixir...), which act
 * instantly. Items can be left on the ground when their holder dies in combat
 * and picked up by any unit. Units flagged `noItems` in units.js (machines)
 * can't hold them. The rules and behaviour live in engine/items.js; drop
 * chances are tuning and live in config.js (worldEncounters.treasureChest's
 * itemDropChance / plunderDropChance).
 *
 * Fields:
 *   label    display name
 *   icon     emoji, also the fallback when a sprite is missing
 *   effect   optional special ability: "flight" (combat.js isFlying) or
 *            "hide" (combat.js hasHideAbility) -- read via
 *            GameEngine.items.hasItemEffect
 *   bonuses  { attack, defense, movement, vision, range, siegePct, doubleStrikePct } summed by
 *            GameEngine.items.itemStat (plus `rangeFloor`, a minimum range where the best
 *            item wins -- see itemStatMax) (combat.js's effectiveAttack/
 *            effectiveDefense/effectiveRange/effectiveSiegePct, turns.js's
 *            effectiveUnitVisionRadius, ai.js's computeMovementBudget)
 *   immunities  [condition keys] the bearer can't be afflicted with
 *            (combat.setCondition)
 *   onHit    [{ condition, chance, when? }] rolled per landed hit the bearer makes
 *            (`when: "dark"` = only in the dark window); onCounter is the same
 *            for the bearer's landed counterattacks (ai.js applyItemCombatEffects)
 *   actions  [action ids] ring actions the bearer gets regardless of unit type or
 *            tech: fireball, whirlwindStrike, teleport, goHidden, thunderstorm, naturesGrace,
 *            direBearForm, castRaptorFly, wolfForm, summonDireWolf, summonShadowsteed, riddle,
 *            setTrap (GameEngine.items.grantsAction)
 *   bolt     { damageMult, min } extra lightning damage after every landed hit the
 *            bearer makes, ignoring defense (ai.js applyItemCombatEffects)
 *   auras    [crusade | heavy_metal | power_metal] the bearer is a source of
 *            (turns.js aura loop)
 *   nightLight  { radius, color, flicker? } light the bearer carries in the
 *            dark hours (daynight.js)
 *   carryAura  optional aura kind ("elemental" | "purple_glow" | "shadow" |
 *            "golden_sparkle" | "lightning") -- an always-on ambient visual
 *            (day or night alike, unlike nightLight above) drawn around the
 *            bearer regardless of the day/night cycle. Read via
 *            GameEngine.items.carryAuraOf; drawn by overlays.js's
 *            drawItemAuraGlowBehind/drawItemAuraEffects (2026-09-23,
 *            user-directed).
 *   flags    { fullCounter, flames, grow, umbral, seesHidden, riddleStrike } one-off rules
 *   luck     { extraTreasureChance, delveMult, trapMult, conditionResist,
 *            resourceMult } treasure/affliction modifiers (Lucky Rock)
 *   rarity   "common" | "uncommon" | "rare" -- the Knowledge Base groups items under it. Unique
 *            items need none: they are always "Legendary".
 *   unique   optional. true = only ONE copy of this item may exist in the world at
 *            a time (carried, on the ground or in a chest). Unique items are never
 *            given by tech grants; they turn up as a bonus in Ruin delve treasure,
 *            in Giltmaw/Trow chests, and (rarely -- 2026-09-23, user-directed) in
 *            an ordinary Treasure Chest too (see GameEngine.items.pickUniqueItemFor,
 *            config.js's uniqueItemChance / giltmawUniqueChance / trowUniqueChance /
 *            ordinaryUniqueChance). A lost copy can be found again.
 *   text     rules text for the sidebar/Knowledge Base
 *   source   where it comes from, for the Knowledge Base
 *
 * The three chest items keep their ids from the old flag-style unit.items
 * ({flight, cloak, boots}) -- items.itemsOf normalises those legacy keys.
 *
 * To add an item: an entry here, a sprite at assets/enhancements/item_<id>_1.png
 * with a manifest entry in sprite-manifests.js, and (only if it has a special
 * effect) a hook wherever that effect is read. Everything else -- sidebar list,
 * Knowledge Base Items page, ground rendering -- reads this table.
 */
window.GameData = window.GameData || {};

const UNIQUE_SOURCE = "Unique -- Ruin delve treasure, the chest of a Giltmaw or Treasure Trow, or (rarely) any Treasure Chest";

window.GameData.ITEMS = {
  feather: { rarity: "rare", label: "Feather of Flying", icon: "🪶", effect: "flight", bonuses: {},
    text: "The bearer can fly: it crosses water and mountains and dodges melee attacks.", source: "Treasure Chest (rare)" },
  cloak: { rarity: "rare", label: "Cloak of Hiding", icon: "🧥", effect: "hide", bonuses: {},
    text: "The bearer can go Hidden, under the usual Hidden rules.", source: "Treasure Chest (rare)" },
  boots: { rarity: "rare", label: "Boots of Sprinting", icon: "🥾", bonuses: { movement: 1 },
    text: "+1 movement.", source: "Treasure Chest (rare)" },
  dwarven_hammer: { rarity: "uncommon", label: "Dwarven Hammer", icon: "🔨", bonuses: { attack: 1 },
    text: "+1 attack.", source: "Dwarf military units built in a city with a Deep Forge (Forgecraft)" },
  dwarven_armor: { rarity: "uncommon", label: "Dwarven Armor", icon: "🛡️", bonuses: { attack: 1, defense: 1 },
    text: "+1 defense, +1 attack.", source: "Dwarf military units built in a city with a Deep Forge, once Runeforged Armory is researched" },
  mythril_armor: { rarity: "uncommon", label: "Mythril Armor", icon: "🥋", bonuses: { defense: 1 },
    text: "+1 defense.", source: "Elf units built in a city with a Silverleaf Atelier" },

  // ---- Rare and unique items -------------------------------------------------
  // The 13 `unique` items below turn up only in Ruin delves and in Giltmaw/Trow
  // chests (one copy in the world at a time); Lucky Rock is a rare, non-unique
  // chest treasure. Effects are declarative -- see the field list above; the code
  // that reads each is found via the GameEngine.items query helpers.
  kuvira: { unique: true, label: "Kuvira, Light of Justice", icon: "⚔️",
    bonuses: { attack: 3 }, auras: ["crusade"], immunities: ["curse"],
    nightLight: { radius: 3, color: "#ffd98a" },
    text: "A radiant golden sword. +3 attack. The bearer carries the Crusade Aura (allies within 1 tile heal 10% and gain +2 attack, +1 defense, +25% siege), glows with light at night, and cannot be Cursed.",
    source: UNIQUE_SOURCE },
  rosepearl: { unique: true, label: "The Rosepearl", icon: "🦪",
    bonuses: { vision: 2 }, immunities: ["curse", "befuddled", "blind", "burning", "frozen", "poisoned", "webbed"],
    carryAura: "purple_glow",
    text: "+2 vision. The bearer is immune to Curse, Befuddled, Blind, Burning, Frozen, Poisoned and Webbed. Wrapped always in a soft purple glow.",
    source: UNIQUE_SOURCE },
  kurganos: { unique: true, label: "Kurganos, Crown of Elements", icon: "👑",
    bonuses: { attack: 2, siegePct: 1.0 }, immunities: ["frozen", "burning"],
    onHit: [{ condition: "frozen", chance: 0.5 }],
    actions: ["fireball", "whirlwindStrike", "thunderstorm"],
    carryAura: "elemental",
    text: "+2 attack and +100% siege. 50% chance to Freeze an enemy it attacks; immune to Frozen and Burning. The bearer can cast Fireball!, use Whirlwind Strike, and call a Thunderstorm for 3 turns (everyone's vision is reduced by 1 while it lasts). Wreathed always in flame and crackling lightning.",
    source: UNIQUE_SOURCE },
  mortedamos: { unique: true, label: "Mortedamos' Malefic Manuscript", icon: "📕",
    bonuses: { attack: 2, range: 1 },
    onHit: [
      { condition: "poisoned", chance: 0.5 }, { condition: "curse", chance: 0.5 }, { condition: "befuddled", chance: 0.5 },
      { condition: "frozen", chance: 0.5 }, { condition: "blind", chance: 0.5 }, { condition: "webbed", chance: 0.5 },
    ],
    text: "+2 attack and +1 range. Each time the bearer hits, each of Poison, Curse, Befuddled, Frozen, Blind and Webbed has its own 50% chance to afflict the target -- several can land at once.",
    source: UNIQUE_SOURCE },
  alunaria: { unique: true, label: "Alunaria, The Cold Moonlight", icon: "🌙",
    onHit: [{ condition: "frozen", chance: 0.75, when: "dark" }],
    actions: ["goHidden", "teleport"], nightLight: { radius: 3, color: "#bcd7ff" },
    text: "A staff of moonlight. At night the bearer has a 75% chance to Freeze an enemy it attacks, and glows with cold light. The bearer can go Hidden (invisibility) and Teleport, like a Human Wizard.",
    source: UNIQUE_SOURCE },
  agasou: { unique: true, label: "Spear of Agasou", icon: "🔱",
    bonuses: { attack: 2, defense: 2, movement: 1 },
    actions: ["direBearForm", "castRaptorFly", "wolfForm"],
    text: "A royal spear. +2 attack, +2 defense, +1 movement. The bearer can become a Dire Bear (and change back, as a Druid does); cast Fly on an ally, turning it into a raptor for 3 turns (it may end the spell early); or become a Dire Wolf for 3 turns with +4 movement (it may end the shapeshift early).",
    source: UNIQUE_SOURCE },
  xorthalos: { unique: true, label: "Shield of Xorthalos", icon: "🔥",
    bonuses: { defense: 4 }, immunities: ["burning"], flags: { fullCounter: true, flames: true },
    onHit: [{ condition: "burning", chance: 0.3 }], onCounter: [{ condition: "burning", chance: 0.3 }],
    nightLight: { radius: 3, color: "#ff9a3c", flicker: true },
    text: "A shield wreathed in living flame. +4 defense. The bearer counterattacks for full damage instead of a third, has a 30% chance to set an enemy Burning when it attacks or counterattacks, is immune to Burning, and is engulfed with flames of fury, giving off a flickering light.",
    source: UNIQUE_SOURCE },
  much_room_mushroom: { unique: true, label: "Much Room Mushroom", icon: "🍄",
    bonuses: { attack: 2, movement: 2, vision: 1 }, flags: { grow: 0.5 },
    text: "The bearer grows 50% larger. +2 attack, +2 movement, +1 vision.",
    source: UNIQUE_SOURCE },
  umbral_ring: { unique: true, label: "The Umbral Ring", icon: "💍",
    flags: { umbral: true, seesHidden: true },
    carryAura: "shadow",
    text: "Through the dark hours the bearer is Hidden, and cannot be revealed or unhidden -- not even by attacking. The bearer can also see every hidden unit within its vision. An aura of shadow clings to it at all hours.",
    source: UNIQUE_SOURCE },
  axe_of_doom: { unique: true, label: "The Axe of Doom", icon: "🪓",
    auras: ["heavy_metal", "power_metal"],
    text: "Both an axe and a heavy metal guitar. The bearer projects the Heavy Metal and Power Metal auras at once, always on.",
    source: UNIQUE_SOURCE },
  arangil: { unique: true, label: "Arangil's Vision Glass", icon: "🔮",
    bonuses: { vision: 3 }, actions: ["teleport"],
    text: "A magical glass orb. +3 vision. The bearer can Teleport, like a Human Wizard.",
    source: UNIQUE_SOURCE },
  mhorgrim: { unique: true, label: "Mhorgrim's Hunt", icon: "🔫",
    bonuses: { attack: 2, range: 1 }, onHit: [{ condition: "burning", chance: 0.25 }],
    actions: ["summonDireWolf", "setTrap"],
    text: "A magical musket. +2 attack, +1 range, and a 25% chance to set an enemy Burning. The bearer can summon a Dire Wolf under its control (one at a time), and can Set the Trap like a Halfellow Trouble Maker.",
    source: UNIQUE_SOURCE },
  eyrhild: { unique: true, label: "Eyrhild's Fury", icon: "🗡️",
    bonuses: { attack: 2, defense: 2, vision: 1 }, effect: "flight",
    actions: ["summonShadowsteed"],
    carryAura: "golden_sparkle",
    text: "A magical silver-lit sword. +2 attack, +2 defense, +1 vision, and the bearer can fly. The bearer can also summon a Shadowsteed under its control (one at a time). It sheds a golden, sparkling light of its own -- distinct from the shimmer of a pending level-up.",
    source: UNIQUE_SOURCE },
  riddle_of_steel: { unique: true, label: "The Riddle of Steel", icon: "🗡️",
    actions: ["riddle"], flags: { riddleStrike: true },
    text: "A magic dagger. The bearer can pose a Riddle, like a Halfellow Wanderer -- and every enemy it riddles also takes a hit as if the bearer had attacked it, using the bearer's attack (that hit can't be answered by a counterattack).",
    source: UNIQUE_SOURCE },
  amulet_of_aesia: { unique: true, label: "The Amulet of Aesia", icon: "☀️",
    bonuses: { defense: 2 }, actions: ["naturesGrace"], auras: ["crusade"],
    nightLight: { radius: 3, color: "#ffd27a" },
    text: "A golden amulet in the shape of a starburst. +2 defense. The bearer can cast Nature's Grace, like an Elf Druid (heal an ally in reach for 30-60% of its max HP), carries the Crusade Aura like a Human Paladin (allies within 1 tile heal 10% and gain +2 attack, +1 defense, +25% siege), and glows with warm light at night.",
    source: UNIQUE_SOURCE },
  arc_of_lightning: { unique: true, label: "The Arc of Lightning", icon: "🏹",
    bonuses: { vision: 1, movement: 1, rangeFloor: 3, doubleStrikePct: 0.2 },
    bolt: { damageMult: 0.5, min: 2 },
    carryAura: "lightning",
    text: "A magic bow. +1 vision, +1 movement, range 3 (if the bearer had less), and 20% double strike. Every hit the bearer lands is followed by a bolt of lightning that strikes the target for extra damage, ignoring its defense -- a double strike's second hit strikes too. Lightning arcs constantly around the bearer.",
    source: UNIQUE_SOURCE },
  lucky_rock: { rarity: "rare", label: "Lucky Rock", icon: "🪨",
    luck: { extraTreasureChance: 0.2, delveMult: 1.2, trapMult: 0.5, conditionResist: 0.5, resourceMult: 1.5 },
    text: "The bearer opens chests with +20% chance of an extra treasure and 50% more resources, finds delve treasure 20% more often, meets a trapped chest half as often, and has a 50% chance to shrug off each negative condition.",
    source: "Treasure Chest (rare)" },
};

/** Item definition by id (undefined for an unknown id). */
window.GameData.getItem = function (id) {
  return window.GameData.ITEMS[id];
};
