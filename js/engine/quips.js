/**
 * QUIP TRIGGER ENGINE
 * -------------------
 * Decides, RARELY and at random, whether a unit says something (see
 * js/data/quips.js for the actual text pools) right before taking an
 * action. Purely cosmetic -- no gameplay effect, same category as
 * combat.js's attack-animation event queue, which this deliberately
 * mirrors: a private pendingQuipEvents array that the UI's render loop
 * drains every frame to drive the on-screen word bubble (js/ui/render.js).
 * Engine code must never depend on window.UI, so events flow UI-ward via
 * this pull-based queue rather than the engine pushing straight into the
 * UI layer.
 *
 * Every triggered quip is ALSO written to gameState.aiActionLog (the same
 * cross-turn log the Reports > AI Actions screen already reads), so a
 * quip's flavor text is recoverable after the bubble itself has long
 * since vanished -- civ, unit type, and unit name are all included per
 * the original ask.
 */

window.GameEngine = window.GameEngine || {};

(function () {
  // "Rarely" -- most action attempts say nothing at all.
  const QUIP_CHANCE = 0.05;

  let pendingQuipEvents = [];

  /**
   * Call at any real, on-board action decision point (attack, move,
   * build_road, found, ...) right before the action actually executes.
   * No-ops silently if the roll fails, if this race/action combo has no
   * quip data, or if `unit`/`civ` are missing -- always safe to call
   * unconditionally from a call site.
   */
  function maybeQuip(unit, civ, action, gameState) {
    if (!unit || !civ) return;
    if (Math.random() >= QUIP_CHANCE) return;
    const text = window.GameData.getRandomQuip(civ.raceId, unit.typeId, action);
    if (!text) return;

    pendingQuipEvents.push({ unit, text });

    if (gameState) {
      const race = window.GameData.getRace(civ.raceId);
      const baseUnit = window.GameData.getUnit(unit.typeId);
      const who = unit.name ? `${unit.name} (${baseUnit.label})` : baseUnit.label;
      window.GameEngine.ai.appendAIActionLog(gameState, civ.id, [
        `${race.label} ${who} says: "${text}"`,
      ]);
    }
  }

  /**
   * Unconditional word-bubble spawn -- unlike maybeQuip above, no random
   * roll and no race/unit/action pool lookup, just shows `text` above
   * `unit` right now. Used e.g. by Halfellow's "Riddle" ability (see ai.js's
   * maybeRiddlePlay) to show the riddle question above the caster, then the
   * answer or a stumped response above the target. No aiActionLog entry
   * (the caller's own log line already covers it) -- purely cosmetic.
   */
  function spawnQuipText(unit, text) {
    if (!unit || !text) return;
    pendingQuipEvents.push({ unit, text });
  }

  /** UI-side: pulls and clears every quip triggered since the last drain. */
  function drainQuipEvents() {
    const events = pendingQuipEvents;
    pendingQuipEvents = [];
    return events;
  }

  window.GameEngine.quips = { maybeQuip, spawnQuipText, drainQuipEvents };
})();
