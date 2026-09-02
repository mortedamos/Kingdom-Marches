/**
 * DEATH-ADJACENT COSMETIC EVENTS
 * -------------------------------
 * Two brief, unrelated cosmetics, both fired from ai.js's
 * otherCivRemoveDeadUnit (the single chokepoint every combat-kill path
 * funnels a dead unit through) -- queued at (x, y) rather than anchored to
 * a unit/tile object, since the unit is already gone from civ.units by the
 * time either fires:
 *
 *   - Death effect: a puff-of-smoke-resolving-into-a-skull, on every death.
 *   - Chest drop: a quick "just fell to the ground" cosmetic, only on the
 *     (chance-gated) deaths that actually drop a Treasure Chest -- see
 *     ai.js's maybeSpawnDeathChest.
 *
 * Same pull-based queue pattern as combat.js's spawnAreaEffect/
 * floatingtext.js's spawnFloatingText: engine code must never depend on
 * window.UI, so each event flows UI-ward via its own private queue that
 * overlays.js drains every frame.
 */
window.GameEngine = window.GameEngine || {};

(function () {
  let pendingDeathEffectEvents = [];

  function spawnDeathEffect(x, y) {
    pendingDeathEffectEvents.push({ x, y });
  }

  function drainDeathEffectEvents() {
    const events = pendingDeathEffectEvents;
    pendingDeathEffectEvents = [];
    return events;
  }

  let pendingChestDropEvents = [];

  function spawnChestDrop(x, y) {
    pendingChestDropEvents.push({ x, y });
  }

  function drainChestDropEvents() {
    const events = pendingChestDropEvents;
    pendingChestDropEvents = [];
    return events;
  }

  window.GameEngine.deathFx = {
    spawnDeathEffect, drainDeathEffectEvents,
    spawnChestDrop, drainChestDropEvents,
  };
})();
