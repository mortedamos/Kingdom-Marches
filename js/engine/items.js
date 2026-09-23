/**
 * ITEMS (2026-09-21, user-directed) -- permanent, transferable gear.
 *
 * Definitions are data (data/items.js's window.GameData.ITEMS); this module is
 * the rules. A unit carries one of each id in unit.items = { <itemId>: true }.
 * An item is an OBJECT, not a stamped number like level bonuses or
 * unit.buildingBonuses: it can be dropped when its holder dies in combat and
 * picked up by any unit. Everything that decides whether an item can go to a
 * unit lives in canReceiveItem/giveItem, so chests, tech grants, pickups and
 * the AI all obey the same rules.
 *
 * Callers elsewhere: combat.js (stat/effect hooks in effectiveAttack/
 * effectiveDefense/isFlying/hasHideAbility), ai.js (movement budget, chest
 * treasures, tech grants, death drops, the AI's pickup play), orders.js/main.js
 * (the Pick Up action), sidebar.js and knowledgebase.js (display).
 */
(function () {
  "use strict";

  /** Normalised copy of a unit's items, as { <itemId>: true }. Also reads the
   *  previous build's flag-style shape ({ flight: true, cloak: true, boots: N })
   *  so saves/units from before the Items system keep working: flight -> feather,
   *  boots N -> boots. */
  function itemsOf(unit) {
    const raw = unit && unit.items;
    if (!raw) return {};
    const out = {};
    for (const [key, val] of Object.entries(raw)) {
      if (!val) continue;
      out[key === "flight" ? "feather" : key] = true;
    }
    return out;
  }

  function hasItem(unit, itemId) {
    return !!itemsOf(unit)[itemId];
  }

  /** Sum of one stat ("attack" | "defense" | "movement") across carried items. */
  function itemStat(unit, stat) {
    const defs = window.GameData.ITEMS;
    let total = 0;
    for (const id of Object.keys(itemsOf(unit))) total += (defs[id] && defs[id].bonuses && defs[id].bonuses[stat]) || 0;
    return total;
  }

  /** Largest value of one bonus key across carried items (for FLOORS such as `rangeFloor`,
   *  where the best item wins instead of the values adding up). */
  function itemStatMax(unit, stat) {
    let best = 0;
    for (const d of heldDefs(unit)) best = Math.max(best, (d.bonuses && d.bonuses[stat]) || 0);
    return best;
  }

  /** The strongest lightning bolt the bearer's items add to every landed hit ({damageMult, min}) or null. */
  function itemBolt(unit) {
    let best = null;
    for (const d of heldDefs(unit)) if (d.bolt && (!best || d.bolt.damageMult > best.damageMult)) best = d.bolt;
    return best;
  }

  /** Does any carried item grant `effect` ("flight" | "hide")? */
  function hasItemEffect(unit, effect) {
    const defs = window.GameData.ITEMS;
    return Object.keys(itemsOf(unit)).some((id) => defs[id] && defs[id].effect === effect);
  }

  /** Definitions of every item `unit` carries (unknown ids skipped). */
  function heldDefs(unit) {
    const defs = window.GameData.ITEMS;
    return Object.keys(itemsOf(unit)).map((id) => defs[id]).filter(Boolean);
  }

  /** Can the bearer be afflicted with condition `key`? True = immune. */
  function hasImmunity(unit, key) {
    return heldDefs(unit).some((d) => d.immunities && d.immunities.includes(key));
  }

  /** The bearer's on-hit (attack) or on-counter condition rolls, as [{condition, chance, when?}]. */
  function onHitEffects(unit, kind) {
    const field = kind === "counter" ? "onCounter" : "onHit";
    const out = [];
    for (const d of heldDefs(unit)) if (d[field]) out.push(...d[field]);
    return out;
  }

  /** Does an item give the bearer ring action `actionId`? */
  function grantsAction(unit, actionId) {
    return heldDefs(unit).some((d) => d.actions && d.actions.includes(actionId));
  }

  /** Aura ids ("crusade" | "heavy_metal" | "power_metal") the bearer is a source of. */
  function itemAuras(unit) {
    const out = new Set();
    for (const d of heldDefs(unit)) if (d.auras) for (const a of d.auras) out.add(a);
    return out;
  }

  /** Numeric/boolean one-off flag across carried items: boolean flags OR together,
   *  numeric ones (grow) sum. */
  function itemFlag(unit, flag) {
    let value = false;
    for (const d of heldDefs(unit)) {
      const v = d.flags && d.flags[flag];
      if (v === undefined) continue;
      value = typeof v === "number" ? (typeof value === "number" ? value : 0) + v : (value || v);
    }
    return value;
  }

  /** Does the bearer carry a UNIQUE (legendary) item? Drives its "epic" look (render.js). */
  function hasUniqueItem(unit) {
    return heldDefs(unit).some((d) => d.unique);
  }

  /** The largest night light the bearer carries ({radius, color, flicker?}) or null. */
  function nightLightOf(unit) {
    let best = null;
    for (const d of heldDefs(unit)) if (d.nightLight && (!best || d.nightLight.radius > best.radius)) best = d.nightLight;
    return best;
  }

  /** The carried-item ambient aura kind the bearer shows (data/items.js
   *  `carryAura`; drawn by overlays.js's drawItemAuraGlowBehind/
   *  drawItemAuraEffects), or null. Unlike nightLightOf, which picks the
   *  BIGGEST light when several are carried, this just takes the first held
   *  aura-bearing item (heldDefs' own iteration order) -- stacking auras
   *  would read as visual clutter, not information, and there's no natural
   *  "biggest" to compare across different aura kinds the way there is for a
   *  light's radius. */
  function carryAuraOf(unit) {
    for (const d of heldDefs(unit)) if (d.carryAura) return d.carryAura;
    return null;
  }

  /** Aggregate treasure/affliction luck of the bearer (multipliers default to 1, chances to 0). */
  function itemLuck(unit) {
    const luck = { extraTreasureChance: 0, delveMult: 1, trapMult: 1, conditionResist: 0, resourceMult: 1 };
    for (const d of heldDefs(unit)) {
      const l = d.luck;
      if (!l) continue;
      luck.extraTreasureChance += l.extraTreasureChance || 0;
      luck.delveMult *= l.delveMult || 1;
      luck.trapMult *= l.trapMult || 1;
      luck.conditionResist = 1 - (1 - luck.conditionResist) * (1 - (l.conditionResist || 0));
      luck.resourceMult *= l.resourceMult || 1;
    }
    return luck;
  }

  /** Machines (units.js `noItems`) can't hold items. */
  function canUseItems(unit) {
    return !window.GameData.getUnit(unit.typeId).noItems;
  }

  /** Would this item do nothing for `unit` (it already has that ability by other means)? */
  function itemUseless(unit, civ, id) {
    const combat = window.GameEngine.combat;
    if (id === "feather") return combat.isFlying(unit);
    if (id === "cloak") return combat.hasHideAbility(unit, civ);
    if (id === "boots") return !(window.GameData.getUnit(unit.typeId).movement > 0);
    return false;
  }

  function canReceiveItem(unit, civ, id) {
    return !!window.GameData.getItem(id) && unit.hp > 0 && canUseItems(unit)
      && !hasItem(unit, id) && !itemUseless(unit, civ, id);
  }

  /** Gives `unit` the item if it can take it. Returns true on success. */
  function giveItem(unit, civ, id) {
    if (!canReceiveItem(unit, civ, id)) return false;
    unit.items = itemsOf(unit); // also migrates the old flag-style shape
    unit.items[id] = true;
    return true;
  }

  /** Puts item `id` on the ground at (x, y) -- or, if that tile is water, the
   *  nearest land tile within 2 -- and plays the chest-drop animation. Several
   *  items can share a tile (tile.groundItems is an array of ids). Returns the
   *  tile {x,y} it landed on, or null if there was no land nearby (the item is
   *  lost, e.g. a ship sinking far from shore). */
  function dropItemAt(x, y, id, gameState) {
    const { map } = gameState;
    const T = window.GameData.TERRAIN;
    const isLand = (tx, ty) => {
      if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) return false;
      return !T[map.tiles[ty * map.width + tx].terrain].isWater;
    };
    for (let r = 0; r <= 2; r++) {
      const ring = [];
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (isLand(x + dx, y + dy)) ring.push({ x: x + dx, y: y + dy });
      }
      if (!ring.length) continue;
      const spot = ring[Math.floor(Math.random() * ring.length)];
      const tile = map.tiles[spot.y * map.width + spot.x];
      tile.groundItems = tile.groundItems || [];
      tile.groundItems.push(id);
      window.GameEngine.deathFx.spawnChestDrop(spot.x, spot.y);
      return spot;
    }
    return null;
  }

  /** Ids of items lying on `unit`'s own tile that it could pick up right now. */
  function pickableItemsAt(civ, unit, gameState) {
    const tile = gameState.map.tiles[unit.y * gameState.map.width + unit.x];
    if (!tile || !tile.groundItems) return [];
    return tile.groundItems.filter((id) => canReceiveItem(unit, civ, id));
  }

  /** "Give Item" (2026-09-23, user-directed): moves item `id` from `giver` to
   *  `receiver`, both already validated by the caller (orders.js's
   *  giveItemTargets checks adjacency and canReceiveItem before the pill is
   *  even offered) -- re-checked here too, since either unit could have
   *  changed state between the ring being drawn and this actually resolving,
   *  same "don't trust a stale menu" caution every other targeted action in
   *  this codebase takes. Spends the GIVER's action, same as Pick Up; the
   *  receiver's own turn is untouched, mirroring how a chest/pickup grant
   *  never costs the recipient anything either. Returns true on success. */
  function transferItem(giver, receiver, civ, id) {
    if (!giver || giver.usedThisTurn || !hasItem(giver, id) || !canReceiveItem(receiver, civ, id)) return false;
    giver.items = itemsOf(giver); // also migrates the old flag-style shape, same as giveItem
    delete giver.items[id];
    giveItem(receiver, civ, id);
    giver.usedThisTurn = true;
    return true;
  }

  /** The "Pick Up" action: takes the first holdable item on the unit's tile,
   *  spends its action. Returns the item id, or null if there was nothing valid. */
  function pickUpItem(civ, unit, gameState) {
    const ids = pickableItemsAt(civ, unit, gameState);
    if (!ids.length || unit.usedThisTurn) return null;
    const id = ids[0];
    const tile = gameState.map.tiles[unit.y * gameState.map.width + unit.x];
    giveItem(unit, civ, id);
    tile.groundItems.splice(tile.groundItems.indexOf(id), 1);
    if (!tile.groundItems.length) delete tile.groundItems;
    unit.usedThisTurn = true;
    window.GameEngine.floatingText.spawnFloatingText(unit, `${window.GameData.getItem(id).label}!`, "aura");
    return id;
  }

  // ---------------------------------------------------------------------------
  // UNIQUE ITEMS -- items flagged `unique: true` in data/items.js: at most ONE
  // copy of each type may exist in the world at a time. "Exists" is decided by
  // scanning the world (nothing is registered anywhere), so an item that was
  // lost -- its holder died and it didn't drop, a ship sank far from land, a
  // unit starved -- is simply absent from the scan and becomes findable again.
  // ---------------------------------------------------------------------------

  /** True if a copy of item `id` is carried by any unit (any kingdom, including
   *  monsters), lies on the ground, or sits in a death chest. */
  function isItemInPlay(gameState, id) {
    for (const civ of Object.values(gameState.civs)) {
      for (const u of civ.units) {
        if (hasItem(u, id)) return true;
        if (u.carries && hasItem(u.carries, id)) return true;
      }
    }
    for (const tile of gameState.map.tiles) {
      if (tile.groundItems && tile.groundItems.includes(id)) return true;
      if (tile.chestItems && tile.chestItems.includes(id)) return true;
    }
    return false;
  }

  /** A random unique item that isn't in play yet and that `unit` could take, or
   *  null if none qualifies. */
  function pickUniqueItemFor(unit, civ, gameState) {
    const pool = Object.keys(window.GameData.ITEMS).filter((id) =>
      window.GameData.ITEMS[id].unique && !isItemInPlay(gameState, id) && canReceiveItem(unit, civ, id));
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }

  window.GameEngine = window.GameEngine || {};
  window.GameEngine.items = {
    itemsOf, hasItem, itemStat, hasItemEffect, canUseItems,
    itemStatMax, itemBolt,
    hasUniqueItem,
    heldDefs, hasImmunity, onHitEffects, grantsAction, itemAuras, itemFlag, nightLightOf, carryAuraOf, itemLuck,
    canReceiveItem, giveItem, transferItem, dropItemAt, pickableItemsAt, pickUpItem,
    isItemInPlay, pickUniqueItemFor,
  };
})();
