/**
 * PATHFINDING ENGINE
 * ------------------
 * Generic A* pathfinding over the tile grid. Terrain/unit-type cost rules
 * live with the caller (see ai.js getMoveCost) and are passed in as a
 * costFn -- this module only knows about the grid and the search.
 *
 * If the exact target tile is unreachable (impassable terrain, e.g. a land
 * unit "heading toward" a galley sitting on water, or a target cut off by
 * mountains/enemy-occupied tiles), the search falls back to the best-effort
 * path toward the reachable tile with the lowest heuristic distance to the
 * target, so callers get "walk as close as possible" instead of nothing.
 */

window.GameEngine = window.GameEngine || {};

(function () {
  /** Binary min-heap keyed by node.f, used as the A* open set. */
  class MinHeap {
    constructor() { this.items = []; }
    get size() { return this.items.length; }
    push(item) {
      const items = this.items;
      items.push(item);
      let i = items.length - 1;
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (items[parent].f <= items[i].f) break;
        [items[parent], items[i]] = [items[i], items[parent]];
        i = parent;
      }
    }
    pop() {
      const items = this.items;
      const top = items[0];
      const last = items.pop();
      if (items.length > 0) {
        items[0] = last;
        let i = 0;
        while (true) {
          const l = i * 2 + 1, r = i * 2 + 2;
          let smallest = i;
          if (l < items.length && items[l].f < items[smallest].f) smallest = l;
          if (r < items.length && items[r].f < items[smallest].f) smallest = r;
          if (smallest === i) break;
          [items[smallest], items[i]] = [items[i], items[smallest]];
          i = smallest;
        }
      }
      return top;
    }
  }

  /**
   * Finds a route from (fromX,fromY) to (toX,toY) across map.tiles.
   *
   * @param costFn(nx, ny, tile, fromIdx) -> number cost to enter (nx,ny), or
   *   window.GameData.IMPASSABLE to block it entirely. Called once per
   *   candidate neighbor tile during the search.
   * @param options.maxSearch cap on tiles expanded, keeps worst-case search
   *   bounded on large maps.
   * @returns Array of {x, y, cost} steps from (but not including) the start
   *   tile up to either the target or, if unreachable, the closest tile the
   *   search could reach. Returns [] if already at the target. Returns null
   *   only if no movement at all is possible (start has no passable neighbors).
   */
  function findPath(fromX, fromY, toX, toY, map, costFn, options = {}) {
    const maxSearch = options.maxSearch || 4000;
    const w = map.width, h = map.height;
    const chebyshev = window.GameEngine.influence.chebyshev;
    const startIdx = fromY * w + fromX;
    const targetIdx = toY * w + toX;
    if (startIdx === targetIdx) return [];

    const gScore = new Map([[startIdx, 0]]);
    const cameFrom = new Map();
    const closed = new Set();
    const open = new MinHeap();
    open.push({ idx: startIdx, f: chebyshev(fromX, fromY, toX, toY) });

    let bestIdx = startIdx;
    let bestHeuristic = chebyshev(fromX, fromY, toX, toY);
    let reachedTarget = false;

    while (open.size > 0 && closed.size < maxSearch) {
      const cur = open.pop();
      if (closed.has(cur.idx)) continue;
      closed.add(cur.idx);

      const cx = cur.idx % w, cy = Math.floor(cur.idx / w);
      const heuristic = chebyshev(cx, cy, toX, toY);
      if (heuristic < bestHeuristic) { bestHeuristic = heuristic; bestIdx = cur.idx; }
      if (cur.idx === targetIdx) { bestIdx = cur.idx; reachedTarget = true; break; }

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const nIdx = ny * w + nx;
          if (closed.has(nIdx)) continue;
          const tile = map.tiles[nIdx];
          const cost = costFn(nx, ny, tile, cur.idx);
          if (cost === window.GameData.IMPASSABLE || !(cost >= 0)) continue;
          const tentativeG = gScore.get(cur.idx) + cost;
          if (tentativeG < (gScore.has(nIdx) ? gScore.get(nIdx) : Infinity)) {
            cameFrom.set(nIdx, cur.idx);
            gScore.set(nIdx, tentativeG);
            const f = tentativeG + chebyshev(nx, ny, toX, toY);
            open.push({ idx: nIdx, f });
          }
        }
      }
    }

    if (!reachedTarget && bestIdx === startIdx) return null; // start is fully boxed in
    if (bestIdx === startIdx) return [];

    // Reconstruct path from bestIdx (target if reached, else closest approach) back to start.
    const path = [];
    let idx = bestIdx;
    while (idx !== startIdx) {
      const x = idx % w, y = Math.floor(idx / w);
      const parent = cameFrom.get(idx);
      path.push({ x, y, cost: gScore.get(idx) - gScore.get(parent) });
      idx = parent;
    }
    path.reverse();
    return path;
  }

  window.GameEngine.pathfinding = { findPath };
})();
