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

  /**
   * TREASURE TROW REACTION SEQUENCE
   * -------------------------------
   * When a Treasure Trow is struck, ai.js's onTrowStruck resolves everything
   * in game state instantly, then queues ONE event describing what happened
   * here. overlays.js/render.js play it back as a strict sequence of beats so
   * the player sees each one on its own (hurt, then panic, then the escape,
   * then -- only if it happened -- the prank on the attacker), never all at
   * once. The beat boundaries live HERE, in one place, because two sides need
   * to agree on them: the sfx onTrowStruck schedules (via SfxSystem's delayMs)
   * and the animation overlays.js draws.
   *
   * Event shape: { trow, from: {x,y}, to: {x,y}, escape: "run"|"teleport",
   * chest: {x,y}|null, prank: { kind: "curse"|"blind"|"befuddled", attacker }|null }
   */
  const TROW_TIMELINE = {
    hurtStart: 0,       // flinch at the spot it was hit; chest drops
    panicStart: 450,    // hopping in place, panic frame
    escapeStart: 1500,  // runs off, or vanishes in a teleport sparkle
    prankStart: 2300,   // laugh + the attacker's condition shows up (if rolled)
    end: 2300,          // sequence length without a prank
    endWithPrank: 2900,
  };

  let pendingTrowSequenceEvents = [];

  function queueTrowSequence(evt) {
    pendingTrowSequenceEvents.push(evt);
  }

  function drainTrowSequenceEvents() {
    const events = pendingTrowSequenceEvents;
    pendingTrowSequenceEvents = [];
    return events;
  }

  /** Read-only look at events queued but not yet drained by the UI -- lets
   *  main.js's enemy-turn pacing notice a sequence in the instant between an
   *  AI unit striking a Trow and overlays.js's next frame picking it up. */
  function peekTrowSequenceEvents() {
    return pendingTrowSequenceEvents;
  }

  window.GameEngine.deathFx = {
    spawnDeathEffect, drainDeathEffectEvents,
    spawnChestDrop, drainChestDropEvents,
    TROW_TIMELINE, queueTrowSequence, drainTrowSequenceEvents, peekTrowSequenceEvents,
  };
})();
