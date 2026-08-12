/**
 * SAVE / LOAD
 * -----------
 * Serializes a save payload -- { version, humanCivId, spectatorMode,
 * aiDifficulty, savedAt, gameState } (main.js's session state plus the live
 * gameState; humanCivId/spectatorMode/aiDifficulty live outside gameState as
 * main.js closure variables, so they have to be captured explicitly to fully
 * restore a session, not just the board) -- into a JSON string (and back) for
 * save-to-file / load-from-file. Two things standard JSON can't handle
 * directly, both confined to payload.gameState:
 *
 *  1. Sets -- civ.completedTechs/unlockedUnits/unlockedBuildings/
 *     unlockedMechanics, city.filledOffsets, gameState.visibility[civId] are
 *     all Sets. Encoded as { __type: "Set", values: [...] } and restored by
 *     the reviver.
 *  2. Cross-unit refs -- a carrying unit and its passenger point at each
 *     other (unit.carries <-> passenger.carriedBy, circular), and a
 *     Following unit points at whoever it's following (unit.followTarget,
 *     one-way but same problem: left alone, JSON.stringify would serialize
 *     a full duplicate of the target instead of preserving identity).
 *     Every unit is given a transient numeric __uid before stringify, these
 *     three fields are replaced with a { __type: "unitRef", uid } marker
 *     instead of the real object, and __uid is stripped again immediately
 *     after (finally block) so normal play is never affected. On load, a
 *     uid -> unit map is built from the (still-present, JSON-round-tripped)
 *     __uid fields, then every unitRef marker is resolved back to the real
 *     unit object it points to.
 *
 * Also re-attaches the `baseCityInfluence` getter on every loaded city --
 * JSON.stringify evaluates getters to a plain snapshot value, so a naive
 * round-trip would freeze that number instead of leaving it live-computed
 * from population (see cities.js createCity).
 */
window.GameEngine = window.GameEngine || {};

(function () {
  function serialize(payload) {
    const gameState = payload.gameState;
    const uidMap = new Map();
    let counter = 0;
    for (const civ of Object.values(gameState.civs)) {
      for (const unit of civ.units) {
        uidMap.set(unit, counter);
        unit.__uid = counter;
        counter++;
      }
    }
    // Spectator mode's per-unit stepping (turns.js's advanceOneUnitStep) can
    // leave gameState._civTurnCtx set between calls while a civ is mid-turn
    // (some units stepped, some not) -- a save could land in that window. It
    // holds a live `processedUnits` Set of unit object references, which
    // would deep-copy under JSON.stringify rather than preserve reference
    // identity (breaking `.has(unit)` checks against the reloaded civ.units
    // array), and there's nothing worth resuming anyway -- a reload always
    // restarts that civ's turn cleanly from the top, same as the __uid
    // pattern just above: strip before stringify, put back after.
    const savedTurnCtx = gameState._civTurnCtx;
    delete gameState._civTurnCtx;
    try {
      return JSON.stringify(payload, (key, value) => {
        // followTarget (2026-08-12, user-directed Follow order) is a
        // one-way reference, not a cycle like carries/carriedBy, but still
        // needs the same uid-marker treatment: left as a plain object
        // reference, JSON.stringify would serialize a full DUPLICATE copy
        // of the target unit rather than preserve identity, so after a
        // reload followTarget would point at a stale clone instead of the
        // real, live unit in civ.units.
        if ((key === "carries" || key === "carriedBy" || key === "followTarget") && value && typeof value === "object") {
          return { __type: "unitRef", uid: uidMap.has(value) ? uidMap.get(value) : null };
        }
        if (value instanceof Set) {
          return { __type: "Set", values: Array.from(value) };
        }
        return value;
      });
    } finally {
      for (const civ of Object.values(gameState.civs)) {
        for (const unit of civ.units) delete unit.__uid;
      }
      if (savedTurnCtx !== undefined) gameState._civTurnCtx = savedTurnCtx;
    }
  }

  function deserialize(jsonString) {
    const payload = JSON.parse(jsonString, (key, value) => {
      if (value && typeof value === "object" && value.__type === "Set") return new Set(value.values);
      return value;
    });
    const gameState = payload.gameState;

    const uidToUnit = new Map();
    for (const civ of Object.values(gameState.civs)) {
      for (const unit of civ.units) {
        if (typeof unit.__uid === "number") {
          uidToUnit.set(unit.__uid, unit);
          delete unit.__uid;
        }
      }
    }
    for (const civ of Object.values(gameState.civs)) {
      for (const unit of civ.units) {
        for (const field of ["carries", "carriedBy", "followTarget"]) {
          const ref = unit[field];
          if (ref && typeof ref === "object" && ref.__type === "unitRef") {
            unit[field] = ref.uid !== null && uidToUnit.has(ref.uid) ? uidToUnit.get(ref.uid) : null;
          }
        }
      }
      const race = window.GameData.getRace(civ.raceId);
      for (const city of civ.cities) {
        delete city.baseCityInfluence; // stale snapshot value from JSON.stringify's getter evaluation
        Object.defineProperty(city, "baseCityInfluence", {
          enumerable: true,
          get() { return 1.0 * this.population * window.GameEngine.cities.industriousnessInfluenceMult(race); },
        });
      }
    }
    return payload;
  }

  window.GameEngine.savegame = { serialize, deserialize };
})();
