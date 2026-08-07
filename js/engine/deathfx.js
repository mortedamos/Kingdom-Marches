/**
 * DEATH EFFECT EVENTS (2026-08-07, user-directed)
 * -------------------------------------------------
 * A brief puff-of-smoke-resolving-into-a-skull cosmetic, queued at (x, y)
 * rather than anchored to a unit -- the unit is already gone from civ.units
 * by the time this fires (see ai.js's otherCivRemoveDeadUnit, the single
 * chokepoint every combat-kill path funnels a dead unit through). Same
 * pull-based queue pattern as combat.js's spawnAreaEffect/floatingtext.js's
 * spawnFloatingText: engine code must never depend on window.UI, so the
 * event flows UI-ward via a private queue that overlays.js drains every
 * frame.
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

  window.GameEngine.deathFx = { spawnDeathEffect, drainDeathEffectEvents };
})();
