/**
 * FLOATING TEXT EVENTS
 * --------------------
 * Cosmetic-only feedback text that drifts up from a unit's tile and fades
 * out -- "Level Up!", "+N XP" (see combat.js's LEVELING section / ai.js's
 * grantXPAndAutoLevel), and per-turn resource gains from a unit-anchored
 * mechanic (Human "Dungeon Delve", Dwarf "Prospector's Claim" -- see
 * turns.js's beginCivTurn). Same pull-based queue pattern as combat.js's
 * recordCombatEvent/quips.js's maybeQuip: engine code must never depend on
 * window.UI, so events flow UI-ward via a private queue that render.js
 * drains every frame, rather than the engine pushing straight into the UI
 * layer.
 */
window.GameEngine = window.GameEngine || {};

(function () {
  let pendingFloatingTextEvents = [];

  /** Queues floating text above `unit`'s tile. `kind` picks the color/style
   *  in render.js (e.g. "levelup", "xp", "resource"). No-op without a unit
   *  to anchor to -- there's nowhere on the board to draw it. */
  function spawnFloatingText(unit, text, kind = "default") {
    if (!unit || !text) return;
    pendingFloatingTextEvents.push({ unit, text, kind });
  }

  /** Convenience wrapper for a combined harvest/coin/lore gain in one popup
   *  (e.g. "+3 Harvest  +10 Coin  +4 Lore") instead of three separate,
   *  overlapping ones for the same turn's single payout. No-op if every
   *  amount is zero (nothing was actually gained this turn). */
  function spawnResourceGain(unit, { harvest = 0, coin = 0, lore = 0 } = {}) {
    const parts = [];
    if (harvest) parts.push(`+${Math.round(harvest)} Harvest`);
    if (coin) parts.push(`+${Math.round(coin)} Coin`);
    if (lore) parts.push(`+${Math.round(lore)} Lore`);
    if (!parts.length) return;
    spawnFloatingText(unit, parts.join("  "), "resource");
  }

  /** "+N HP" popup for any actual healing a unit receives -- Rest, an aura
   *  (Crusade/Heavy Metal/Wellspring Grove), Nature's Grace, Devoted
   *  Companions' passenger bonus, Undead's heal-on-kill, ... any call site
   *  that increases unit.hp toward unit.maxHp. No-op if `amount` rounds to
   *  0 (already full, or a healed-for-0 edge case) -- nothing to show. */
  function spawnHealGain(unit, amount) {
    const rounded = Math.round(amount);
    if (rounded <= 0) return;
    spawnFloatingText(unit, `+${rounded} HP`, "heal");
  }

  /** UI-side: pulls and clears every floating-text event queued since the
   *  last drain. */
  function drainFloatingTextEvents() {
    const events = pendingFloatingTextEvents;
    pendingFloatingTextEvents = [];
    return events;
  }

  window.GameEngine.floatingText = { spawnFloatingText, spawnResourceGain, spawnHealGain, drainFloatingTextEvents };
})();
