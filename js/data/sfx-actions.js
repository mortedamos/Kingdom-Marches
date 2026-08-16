/**
 * SFX ACTION TAXONOMY
 * -------------------
 * Which (race, unit, action) combinations should have a sound effect.
 * Pure data, derived from units.js/races.js rather than hand-duplicated, so
 * it can't drift out of sync with the real unit roster (e.g. if a unit's
 * attack stat or raceOnly ever changes, its sfx rows update automatically).
 *
 * File naming convention (2026-07-23, user-directed; mp3-only since
 * 2026-08-03 -- wav is no longer looked for at all):
 *   assets/sfx/<race>_<unitId>_<action>_<n>.mp3
 * where <unitId> is the EXACT key from GameData.UNITS (matches sprites.js's
 * asset keying one-for-one -- see unit/{unitId}/{raceId} in sprites.js --
 * so there's no separate naming table to keep in sync), <action> is one of
 * the strings below (itself sometimes multi-word/underscored, e.g.
 * "summon_raptor" -- filenames are always CONSTRUCTED from known parts, per
 * race/unit/action/n, never parsed back apart, so an action's own internal
 * underscore is never ambiguous), and <n> is a 1-based variant number for
 * pick-one-of-several-at-random playback (see js/audio/sfx.js), mirroring
 * music.js's same numbered-variant convention.
 *
 * Universal units (pioneer/scout/galley) are usable by every race and get a
 * race-qualified sfx set for each one, exactly like their race-qualified art
 * (sprites.js's unit/{unitId}/{raceId} pattern) -- there is no unqualified
 * fallback file for them.
 */

window.GameData = window.GameData || {};

// How many numbered variants (_1, _2, _3) a combination may have.
// Lowered 5 -> 3 (2026-08-03, user-directed): nothing on disk has ever used
// a _4 or _5 slot, so the extra headroom only widened the manifest scan and
// the coverage tracker's grid for no benefit. Shared by js/audio/sfx.js,
// working/tools/build-sfx-manifest.ps1 and working/tools/sfx-tracker.html so
// all three agree on the range.
window.GameData.SFX_MAX_VARIANTS = 3;

// unitId -> extra actions beyond the universal core (attack/move/death).
// Only units with a confirmed, distinct in-code mechanic get an entry here
// -- see the 2026-07-22 research pass (ai.js/combat.js) this was built
// from. Deliberately NOT included: passive/AI-internal states with no
// distinct player-facing moment (Troubadour's aura, Titan's march-target
// selection, Dire Wolf's hunt targeting) -- those already read through
// "attack"/"move".
window.GameData.SFX_SPECIAL_ACTIONS = {
  pioneer: ["found", "build_road"],
  galley: ["carry"],
  wizard: ["fireball"],
  druid: ["found", "heal", "blink", "summon_raptor", "summon_shadowsteed"],
  shadowsteed: ["carry"],
  goblin_miscreant: ["ignite"],
  bog_witch: ["curse"],
  dragon: ["ignite"],
  skeleton: ["raise_dead"],
  wanderer: ["found"],
};

/** Every action a given unit type should have sfx for: attack (only if the
 *  unit can actually attack -- e.g. Pioneer's attack stat is 0, so it never
 *  gets an "attack" row), move, death, plus any SFX_SPECIAL_ACTIONS entry. */
window.GameData.sfxActionsForUnit = function (unitId) {
  const unit = window.GameData.getUnit(unitId);
  const actions = [];
  if (unit.attack > 0) actions.push("attack");
  actions.push("move", "death");
  const specials = window.GameData.SFX_SPECIAL_ACTIONS[unitId];
  if (specials) actions.push(...specials);
  return actions;
};

/** Every race that can field a given unit type: just that unit's raceOnly
 *  race, or every race for a universal (raceOnly-less) unit -- except the
 *  Wandering Monster roster, which is fielded ONLY by the "monster" pseudo-
 *  civ (see ai.js's ensureMonsterCiv, which sets civ.raceId to
 *  GameData.MONSTER_RACE.id) and would otherwise wrongly get a full
 *  human/elf/dwarf/orc/halfelven combo set that civ.raceId never actually
 *  requests at playAction() time. */
window.GameData.sfxRacesForUnit = function (unitId) {
  if (window.GameData.MONSTER_UNIT_IDS.has(unitId)) return [window.GameData.MONSTER_RACE.id];
  const unit = window.GameData.getUnit(unitId);
  return unit.raceOnly ? [unit.raceOnly] : window.GameData.RACE_LIST;
};

/** Every (raceId, unitId, action) combination that should have sfx, flattened
 *  for iteration by both the runtime (availability scan) and the coverage
 *  tracker tool. */
window.GameData.sfxAllCombos = function () {
  const combos = [];
  for (const unitId of window.GameData.UNIT_LIST) {
    const races = window.GameData.sfxRacesForUnit(unitId);
    const actions = window.GameData.sfxActionsForUnit(unitId);
    for (const raceId of races) {
      for (const action of actions) {
        combos.push({ raceId, unitId, action });
      }
    }
  }
  return combos;
};

/** "<race>_<unitId>_<action>_<n>.mp3" -- the one place this filename pattern
 *  is assembled, so runtime and tooling can never disagree on it. */
window.GameData.sfxFileName = function (raceId, unitId, action, n, ext) {
  return `${raceId}_${unitId}_${action}_${n}.${ext}`;
};
