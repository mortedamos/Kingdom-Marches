/**
 * GRAND STRATEGY LAYER
 * --------------------
 * A persistent, periodically-recomputed "doctrine" per civ that sits above
 * the turn-local tactical AI in ai.js. Where ai.js's chooseStrategy() and
 * scoreNextResearch() re-score everything from scratch every single turn,
 * this module gives each civ a multi-turn plan derived from its race
 * personality traits, aimed squarely at the actual win condition (holding
 * >= VICTORY_SHARE_THRESHOLD of claimable land via influence -- see
 * turns.js checkVictory / VICTORY_SHARE_THRESHOLD).
 *
 * civ.doctrine = {
 *   techSpine: "civic" | "building" | "military",
 *   techTarget: <tech id> | null,   // deepest-layer tech in that spine for this race
 *   macroGoal: "expand" | "consolidate" | "conquest",
 *   turnsUntilRecompute: <int>,
 *   techSpineFallback: bool,        // true if not currently on the top-favored spine
 *   macroGoalFallback: bool,        // true if not currently on the top-favored goal
 * }
 *
 * Stagnation fallback: each doctrine dimension (tech spine, macro goal) is
 * tracked against land-share progress (the actual win-condition metric --
 * see turns.js checkVictory). If a civ has pursued the same top-favored
 * choice for STAGNATION_CYCLES recompute cycles without gaining at least
 * MIN_PROGRESS land share, that choice is temporarily demoted and the civ
 * falls back to its next-most-favored option for a cooldown period, then
 * is free to return to its favorite once the cooldown expires.
 *
 * This is purely additive: it re-weights existing scoring functions in
 * ai.js (scoreNextResearch, chooseStrategy, exploreWith) rather than
 * replacing any tactical logic. Emergency/reactive behavior (threat
 * detection, disbanding, combat) is untouched.
 */

window.GameEngine = window.GameEngine || {};

(function () {
  const RECOMPUTE_INTERVAL = 8; // turns between doctrine re-evaluation
  const STAGNATION_CYCLES = 3; // recompute cycles to judge a choice as stalled (~24 turns)
  const MIN_PROGRESS = 0.02; // minimum land-share gain over that window to count as "working"
  const DEMOTION_COOLDOWN_CYCLES = 2; // cycles a stalled choice is excluded before it's eligible again
  const SPINES = ["civic", "building", "military"];
  const MACRO_GOALS = ["expand", "consolidate", "conquest"];

  /** How strongly this race's traits favor each of the 3 tech spines. Civic
   *  now also carries what used to be the separate "mechanics" spine
   *  (terrain movement, race-flavor abilities) since that column was folded
   *  into Civic across every race's tree. */
  function spineScores(civ, race) {
    const militarism = window.GameEngine.ai.effectiveMilitarism(civ);
    const expansionism = race.expansionism ?? 0.5;
    const curiosity = race.curiosity ?? 0.5;
    const industriousness = race.industriousness ?? 0.5;
    return {
      civic: expansionism * 0.6 + curiosity * 0.4,
      building: industriousness,
      military: militarism,
    };
  }

  /** Deepest-layer tech available to this race in the given category, walking
   *  the shared trunk too (raceOnly undefined) since not every race has a
   *  fully bespoke column yet. Ties broken by lowest cost (cheaper/simpler capstone). */
  function findCapstone(raceId, category) {
    let best = null;
    for (const tech of Object.values(window.GameData.TECHS)) {
      if (tech.category !== category) continue;
      if (tech.raceOnly && tech.raceOnly !== raceId) continue;
      if (tech.excludedRaces && tech.excludedRaces.includes(raceId)) continue;
      const layer = tech.layer ?? 0;
      if (!best || layer > best.layer || (layer === best.layer && tech.cost < best.cost)) {
        best = { id: tech.id, layer, cost: tech.cost };
      }
    }
    return best ? best.id : null;
  }

  /** This civ's current share of claimable land (0..1) and whether it's leading. */
  function landStanding(civ, gameState) {
    const { counts, totalClaimable } = window.GameEngine.influence.countTerritory(gameState);
    const myShare = totalClaimable > 0 ? (counts[civ.id] || 0) / totalClaimable : 0;
    let leadingShare = 0;
    for (const [civId, count] of Object.entries(counts)) {
      if (civId === civ.id) continue;
      const share = totalClaimable > 0 ? count / totalClaimable : 0;
      if (share > leadingShare) leadingShare = share;
    }
    return { myShare, leadingShare, isLeading: myShare >= leadingShare };
  }

  /** How strongly this race's traits + current land standing favor each of
   *  the 3 macro goals. Trait preference is the baseline (this is "who this
   *  race is"); standing nudges it situationally (falling behind pushes
   *  toward expand/conquest, leading pushes toward consolidate).
   *
   *  `cityGateShortfall` (see tech.js nextGatedTechLayer) is a hard,
   *  race-agnostic override on top of all of that: when a tech is blocked
   *  purely on city count, "expand" gets a bonus large enough to win outright
   *  regardless of personality. Without this, a highly militaristic/
   *  aggressive race (Orc: militarism 0.9, aggressiveness 0.9) scores
   *  `conquest` so far above `expand` that it would never prioritize the
   *  cities it actually needs to keep researching -- conquest's maximum
   *  possible value here is warlikeness(1.0) + trailingBonus(0.4)*warlikeness
   *  (1.0) = 1.4, so the bonus below (1.5 minimum) is sized to clear that in
   *  every case, not just typical ones.
   *
   *  `cityDelta` (2026-07-23, user-directed -- see ai.js's recentCityDelta
   *  and the 2026-07-23 balance-audit memory): founded-minus-razed city
   *  count over the last ~30 turns. `cityGateBonus` above is deliberately
   *  sized to beat even a fully-warlike race's `conquest` score -- fine
   *  when the civ is actually converting pioneers into lasting cities, but
   *  when it's net LOSING cities (an aggressive neighbor razing new
   *  settlements as fast as they're founded -- confirmed live for both
   *  Halfellow-vs-Orc and Human-vs-Elf/Dwarf), that same override just
   *  marches it back into the fire every cycle. Tapers `cityGateBonus`
   *  toward 0 as `cityDelta` goes more negative (fully gone by -4), and
   *  redirects that same energy into `consolidate` instead -- "stop
   *  expanding, hold what's left" is the actually-correct response to a
   *  losing streak, not "try to expand again." A civ that's flat or
   *  growing (cityDelta >= 0) sees no change at all. */
  function macroGoalScores(civ, race, standing, cityGateShortfall = 0, cityDelta = 0) {
    const militarism = window.GameEngine.ai.effectiveMilitarism(civ);
    const expansionism = race.expansionism ?? 0.5;
    const curiosity = race.curiosity ?? 0.5;
    const industriousness = race.industriousness ?? 0.5;
    const aggressiveness = race.aggressiveness ?? 0.5;
    const warlikeness = (militarism + aggressiveness) / 2;
    const { myShare, leadingShare, isLeading } = standing;
    const trailingBy = Math.max(0, leadingShare - myShare);
    const leadingBonus = isLeading || trailingBy < 0.05 ? 0.4 : 0;
    const trailingBonus = Math.min(0.4, trailingBy * 2);
    const cityLossTaper = cityDelta < 0 ? Math.max(0, 1 + cityDelta * 0.25) : 1;
    const cityGateBonus = (cityGateShortfall > 0 ? 1.5 + (cityGateShortfall - 1) * 0.5 : 0) * cityLossTaper;
    const consolidateLossBonus = cityDelta < 0 ? Math.min(2, -cityDelta * 0.5) : 0;
    return {
      conquest: warlikeness + trailingBonus * warlikeness,
      expand: expansionism + trailingBonus * (1 - warlikeness) + cityGateBonus,
      consolidate: (industriousness + curiosity) / 2 + leadingBonus + consolidateLossBonus,
    };
  }

  /** Picks the highest-scoring key not currently in `demoted`, falling back
   *  to the overall best if every candidate happens to be demoted. */
  function pickBestExcluding(scores, keys, demoted) {
    let best = null, bestScore = -Infinity;
    for (const key of keys) {
      if (demoted[key] > 0) continue;
      if (scores[key] > bestScore) { bestScore = scores[key]; best = key; }
    }
    if (best) return best;
    return keys.reduce((a, b) => (scores[b] > scores[a] ? b : a));
  }

  /** Ticks down active demotion cooldowns in place. */
  function tickDemotions(demoted) {
    for (const key of Object.keys(demoted)) {
      if (demoted[key] > 0) demoted[key]--;
    }
  }

  function initMemory(civ, techSpine, macroGoal, myShare) {
    civ._strategyMemory = {
      techSpine: { current: techSpine, shareAtStart: myShare, cyclesActive: 0 },
      macroGoal: { current: macroGoal, shareAtStart: myShare, cyclesActive: 0 },
      demotedSpines: {},
      demotedGoals: {},
    };
    return civ._strategyMemory;
  }

  /** Advances one tracked dimension (tech spine or macro goal) by one recompute
   *  cycle: if it's been active >= STAGNATION_CYCLES without gaining
   *  MIN_PROGRESS land share, demote the current choice for a cooldown and
   *  reset the tracking window. Always re-picks the best non-demoted choice
   *  (which may just be re-confirming the same one if nothing changed).
   *
   *  `suppressDemotion`: when true, skip the demotion this cycle even if
   *  land-share stagnated. Used so a civ actively pursuing "expand" because a
   *  tech is genuinely blocked on city count (see computeDoctrine) doesn't
   *  get punished for a lack of LAND-SHARE growth while it's still in the
   *  middle of doing the right thing -- a new city can take several turns to
   *  found and grow before it moves the land-share needle at all. */
  function advanceDimension(track, demoted, scores, keys, myShare, suppressDemotion = false) {
    track.cyclesActive++;
    if (track.cyclesActive >= STAGNATION_CYCLES) {
      const progress = myShare - track.shareAtStart;
      if (progress < MIN_PROGRESS && !suppressDemotion) {
        demoted[track.current] = DEMOTION_COOLDOWN_CYCLES;
      }
      track.shareAtStart = myShare;
      track.cyclesActive = 0;
    }
    const picked = pickBestExcluding(scores, keys, demoted);
    const topChoice = keys.reduce((a, b) => (scores[b] > scores[a] ? b : a));
    if (picked !== track.current) {
      track.current = picked;
      track.shareAtStart = myShare;
      track.cyclesActive = 0;
    }
    return { value: picked, isFallback: picked !== topChoice };
  }

  /** Recomputes civ.doctrine if it's missing or its recompute timer elapsed;
   *  otherwise just ticks the timer down. Cheap no-op on off-turns. */
  function computeDoctrine(civ, gameState) {
    if (civ.doctrine && civ.doctrine.turnsUntilRecompute > 0) {
      civ.doctrine.turnsUntilRecompute--;
      return civ.doctrine;
    }
    const race = window.GameData.getRace(civ.raceId);
    const standing = landStanding(civ, gameState);
    // Tech-tree city gate awareness (see tech.js nextGatedTechLayer, and the
    // matching computation in ai.js's chooseStrategy/chooseBuildAction): when
    // a tech is blocked purely on city count, that's treated as a hard,
    // race-agnostic reason to favor (and stick with) "expand" -- see
    // macroGoalScores and the suppressDemotion use below.
    const gatedLayer = window.GameEngine.tech.nextGatedTechLayer(civ);
    const cityGateShortfall = gatedLayer !== null ? Math.max(0, gatedLayer - civ.cities.length) : 0;
    // See macroGoalScores' doc comment and ai.js's recentCityDelta.
    const cityDelta = window.GameEngine.ai.recentCityDelta(civ, gameState);

    const spScores = spineScores(civ, race);
    const mgScores = macroGoalScores(civ, race, standing, cityGateShortfall, cityDelta);

    if (!civ._strategyMemory) {
      const topSpine = SPINES.reduce((a, b) => (spScores[b] > spScores[a] ? b : a));
      const topGoal = MACRO_GOALS.reduce((a, b) => (mgScores[b] > mgScores[a] ? b : a));
      initMemory(civ, topSpine, topGoal, standing.myShare);
    }
    const mem = civ._strategyMemory;
    tickDemotions(mem.demotedSpines);
    tickDemotions(mem.demotedGoals);
    // A genuine, currently-active tech-count block always wins: clear any
    // stale demotion "expand" is still serving out from an earlier, unrelated
    // stagnation cycle, so the strong macroGoalScores bonus above can
    // actually take effect immediately instead of waiting out a cooldown.
    // Gated on cityDelta >= 0 (2026-07-23, user-directed): a civ that's net
    // LOSING cities lately is NOT "in the middle of doing the right thing"
    // -- expand isn't working for it right now, so it should stay eligible
    // for the ordinary stagnation-fallback demotion instead of this
    // override permanently protecting it. See macroGoalScores' doc comment.
    if (cityGateShortfall > 0 && cityDelta >= 0) mem.demotedGoals.expand = 0;

    const spineResult = advanceDimension(mem.techSpine, mem.demotedSpines, spScores, SPINES, standing.myShare);
    const goalResult = advanceDimension(mem.macroGoal, mem.demotedGoals, mgScores, MACRO_GOALS, standing.myShare,
      mem.macroGoal.current === "expand" && cityGateShortfall > 0 && cityDelta >= 0);

    const techSpine = spineResult.value;
    const techTarget = findCapstone(civ.raceId, techSpine);
    civ.doctrine = {
      techSpine, techTarget, macroGoal: goalResult.value,
      turnsUntilRecompute: RECOMPUTE_INTERVAL,
      techSpineFallback: spineResult.isFallback,
      macroGoalFallback: goalResult.isFallback,
    };
    return civ.doctrine;
  }

  function getDoctrine(civ) {
    return civ.doctrine || null;
  }

  /** True if `techId` is a (possibly indirect) prerequisite of `targetId`. */
  function isAncestorOf(techId, targetId, seen = new Set()) {
    if (!targetId || seen.has(targetId)) return false;
    seen.add(targetId);
    const target = window.GameData.TECHS[targetId];
    if (!target) return false;
    if (target.prereqs.includes(techId)) return true;
    return target.prereqs.some((p) => isAncestorOf(techId, p, seen));
  }

  window.GameEngine.strategy = { computeDoctrine, getDoctrine, isAncestorOf };
})();
