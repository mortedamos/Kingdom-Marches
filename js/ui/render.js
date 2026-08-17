/**
 * MAP RENDERER
 * ------------
 * Canvas-based rendering of the tile grid, units, cities, and the
 * toggleable influence overlay. See map_ui_design.md for the visual spec
 * this implements (flat 2D tiles, civ-colored units/cities, hatched
 * pattern for contested tiles, clean default view).
 */

window.UI = window.UI || {};

(function () {
  // Base tile size in px; actual rendered size = TILE_SIZE * zoomLevel.
  // Values live in js/data/config.js's VIEW section. The default view is
  // meant to read as 100% zoom, so the intended default is baked into
  // TILE_SIZE itself rather than shipped as a zoomLevel > 1 default.
  const TILE_SIZE = window.GameConfig.view.tileSize;
  const MIN_ZOOM = window.GameConfig.view.minZoom;
  const MAX_ZOOM = window.GameConfig.view.maxZoom;
  const RUIN_ICON_SCALE = .75; // ruins read as a little bigger than a tile-fill resource icon (see per-resource iconScale in terrain.js)
  const MOVE_ANIM_MS = window.GameConfig.view.moveAnimMs; // purely visual glide duration for unit movement

  // Combat anims, area effects, quips, floating text, condition badges/tints,
  // and the aura/hatch/tile-score color helpers all now live in overlays.js
  // (window.UI.overlays), shared with render3d.js -- see that file's header
  // comment for why this moved (in short: render3d.js's render() never called
  // this file's own update*/drain* functions, so with 3D as the default view
  // those event queues grew unbounded and nothing animated in 3D at all).
  const overlays = window.UI.overlays;

  /**
   * Units move instantly in game logic (a whole turn resolves in one call),
   * but the map re-renders every animation frame regardless of turn timing.
   * This tracks each unit's on-screen ("visual") position separately from
   * its logical grid position, and glides visual->logical over MOVE_ANIM_MS
   * whenever the logical position changes -- so a unit slides to its
   * destination instead of popping there instantly. Purely cosmetic state,
   * stored on the unit object itself (mirrors the pattern used for other
   * transient per-unit tracking fields like _lastRitualX).
   */
  function getVisualPos(unit) {
    const now = performance.now();
    if (unit._lastLogicalX === undefined) {
      // First time this unit has been rendered -- no glide, just place it.
      unit._lastLogicalX = unit.x;
      unit._lastLogicalY = unit.y;
      unit._renderX = unit.x;
      unit._renderY = unit.y;
      unit._animStart = 0;
    } else if (unit.x !== unit._lastLogicalX || unit.y !== unit._lastLogicalY) {
      // Logical position changed since we last checked -- glide from wherever
      // it's currently drawn (in case a prior glide was interrupted) to the new spot.
      unit._animFromX = unit._renderX;
      unit._animFromY = unit._renderY;
      unit._animToX = unit.x;
      unit._animToY = unit.y;
      unit._animStart = now;
      unit._lastLogicalX = unit.x;
      unit._lastLogicalY = unit.y;
    }
    if (unit._animStart) {
      const t = Math.min(1, (now - unit._animStart) / MOVE_ANIM_MS);
      unit._renderX = unit._animFromX + (unit._animToX - unit._animFromX) * t;
      unit._renderY = unit._animFromY + (unit._animToY - unit._animFromY) * t;
      if (t >= 1) unit._animStart = 0;
    }
    return { x: unit._renderX, y: unit._renderY };
  }

  // Stable pseudo-random horizontal slot (0=left, 1=center, 2=right) for a
  // tile enhancement icon (resource/ruin), seeded by tile coordinates so
  // it's identical for a live tile and its remembered/fog-of-war snapshot,
  // and never jitters frame to frame.
  function tileIconSlot(x, y) {
    const h = ((x * 374761393) ^ (y * 668265263)) >>> 0;
    return h % 3;
  }

  // Deterministic hash of (x, y, mapSeed) for the civ-influence ambient
  // overlay's variant pick (see below) -- folds in the map seed so a tile's
  // chosen variant is reproducible across reloads of the SAME map, unlike
  // sprites.js's pick(), which re-rolls randomly once per session (see that
  // function's own doc comment). A murmur3-style finalizer, not
  // cryptographic -- just needs to scatter well enough that adjacent tiles
  // don't visibly cluster on the same variant.
  function tileInfluenceVariantHash(x, y, mapSeed) {
    let h = ((x * 374761393) ^ (y * 668265263) ^ ((mapSeed >>> 0) * 2246822519)) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  // A terrain sprite variant is "tall" (e.g. the dramatic overhanging
  // mountain_peak art) if its aspect ratio departs meaningfully from square
  // -- flat terrain sprites are exactly ts:ts square, while tall variants
  // are cropped-to-content portraits. 10% tolerance keeps this robust to
  // minor crop-bbox noise without misclassifying a genuinely square sprite.
  //
  // Checked against the manifest's per-FRAME dimensions, not the raw
  // image's naturalWidth/naturalHeight -- animated terrain (plains, hills,
  // forest, swamp, coast, ocean; see sprite-manifests.js) ships as a wide
  // horizontal strip of 2-4 square frames, so the raw sheet itself is far
  // from square and would otherwise get wrongly flagged "tall," sending the
  // whole strip through the bottom-anchored overhang path and squeezing it
  // into half a tile's height. Single-frame art (mountains, both flat and
  // tall peak) has frameWidth/frameHeight equal to the image's own
  // dimensions (see sprites.js's resolveManifest), so this is unaffected
  // for them.
  function isTallTerrainSprite(manifest) {
    return Math.abs(manifest.frameHeight / manifest.frameWidth - 1) > 0.1;
  }

  // Of mountain tiles ELIGIBLE for the dramatic tall/overhanging peak art
  // (interior of a large range -- see worldgen.js's
  // markTallMountainEligibility), only this fraction actually roll it, so
  // a big range reads as "one or two standout peaks," not "every interior
  // tile is a spire." Deterministic (map-seed-based, like
  // tileInfluenceVariantHash above) rather than sprites.js's session-random
  // pick(), so which tiles are the tall ones stays put across reloads of
  // the same map instead of re-rolling into different (or zero) tall tiles
  // each session. A distinct XOR salt from the civ-influence overlay's own
  // use of the same hash function keeps the two rolls independent.
  const TALL_MOUNTAIN_CHANCE = 0.2;
  const TALL_MOUNTAIN_HASH_SALT = 0x2545f491;

  // Sprite pool key for a tile's own terrain -- every terrain type just
  // uses its own pool unchanged, except Mountains, which is split across
  // two pools (see sprites.js's preloadAll): terrain/mountains (flat,
  // tile-filling) and terrain/mountains_tall (the overhang art), gated by
  // eligibility + the rarity roll above rather than a single pool sprites.js
  // would pick from uniformly at random.
  function terrainSpriteKey(tile, x, y, mapSeed) {
    if (tile.terrain !== "mountains" || !tile.tallMountainEligible) return `terrain/${tile.terrain}`;
    const roll = tileInfluenceVariantHash(x, y, (mapSeed ^ TALL_MOUNTAIN_HASH_SALT) >>> 0) % 100;
    return roll < TALL_MOUNTAIN_CHANCE * 100 ? "terrain/mountains_tall" : "terrain/mountains";
  }

  // Draws a "tall" terrain sprite bottom-anchored to its tile, scaled to the
  // tile's width with height following the image's own aspect ratio -- same
  // bottom-anchored/aspect-driven approach as the city-tier portrait art
  // (see the Cities pass below), so a sufficiently tall peak overhangs
  // upward into the tile north of it instead of being squashed into ts:ts.
  function drawTallTerrainSprite(ctx, img, screenX, screenY, ts) {
    const drawHeight = ts * (img.naturalHeight / img.naturalWidth);
    const drawY = screenY + ts - drawHeight;
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, screenX, drawY, ts, drawHeight);
  }

  // Jump-to-tile flash -- see goToTile in main.js for where this gets armed.
  // Pure fade-out, no pulsing/looping: a single clear "you are here" beat,
  // not an ongoing distraction.
  const TILE_FLASH_ANIM_MS = 800;
  /** Draws the fading highlight for `tileFlash` ({x,y,start}) if it's still
   *  within its animation window. Returns `tileFlash` while still active, or
   *  null once it's expired -- the caller nulls out viewState.tileFlash on a
   *  null return so this is a one-shot effect, not a permanent per-frame
   *  no-op check. */
  function drawTileFlash(ctx, tileFlash, offsetX, offsetY, ts, now) {
    const age = now - tileFlash.start;
    if (age > TILE_FLASH_ANIM_MS) return null;
    const alpha = 1 - age / TILE_FLASH_ANIM_MS;
    const screenX = tileFlash.x * ts + offsetX, screenY = tileFlash.y * ts + offsetY;
    ctx.save();
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = "#ffe08a";
    ctx.fillRect(screenX, screenY, ts, ts);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#ffe08a";
    ctx.lineWidth = 3;
    ctx.strokeRect(screenX + 1.5, screenY + 1.5, ts - 3, ts - 3);
    ctx.restore();
    return tileFlash;
  }

  const RESOURCE_ICON_MARGIN_FRAC = 0.08; // space kept between the tile edge and the icon

  // Bottom-anchored box position for a tile enhancement icon of size `sz`,
  // in one of 3 horizontal slots (tileIconSlot) with margin from the tile
  // edges -- icons sit low-left/low-center/low-right, never dead-center,
  // with breathing room from the edge. Mirrors units' bottom-anchored
  // biggerPct growth (see the unit draw loop below) rather than growing from
  // a fixed center point, so `sz` is as freely adjustable per resource/ruin
  // as biggerPct is per unit.
  function tileIconBox(screenX, screenY, ts, sz, x, y) {
    const margin = ts * RESOURCE_ICON_MARGIN_FRAC;
    const slot = tileIconSlot(x, y);
    const boxX = slot === 0 ? screenX + margin
      : slot === 2 ? screenX + ts - margin - sz
      : screenX + (ts - sz) / 2;
    const boxY = screenY + ts - margin - sz;
    return { boxX, boxY };
  }

  function clampOffset(offsetX, offsetY, canvas, map, ts) {
    const maxX = Math.max(0, map.width  * ts - canvas.width);
    const maxY = Math.max(0, map.height * ts - canvas.height);
    return {
      x: Math.max(0, Math.min(offsetX, maxX)),
      y: Math.max(0, Math.min(offsetY, maxY)),
    };
  }

  function render(canvas, gameState, viewState) {
    const ctx = canvas.getContext("2d");
    const { map, civs } = gameState;
    const { showInfluence, showGrid, selectedUnit, selectedCity, humanCivId } = viewState;
    // Rounded to a whole pixel count -- with a fractional ts (e.g. zoomLevel
    // 1.37 * TILE_SIZE 34), per-tile screenX/screenY below would land on
    // sub-pixel positions, and default canvas image smoothing then blends a
    // sliver of each tile's edge into its neighbor, showing up as a faint
    // seam at every tile boundary even with the grid-line stroke (showGrid)
    // toggled off entirely -- a separate rendering artifact from that
    // intentional stroke, not fixed by gating it. Every screenX/screenY in
    // this function derives from this same ts + a rounded offset below, so
    // rounding it once here keeps the whole frame's tile grid pixel-aligned.
    const ts = Math.round(TILE_SIZE * (viewState.zoomLevel || 1));
    const now = performance.now();
    overlays.tick(now);

    // Clamp scroll so we never go out of bounds
    const clamped = clampOffset(viewState.scrollX || 0, viewState.scrollY || 0, canvas, map, ts);
    viewState.scrollX = clamped.x; // kept at full precision so smooth dragging keeps accumulating cleanly
    viewState.scrollY = clamped.y;
    // ...but the offset actually used for drawing is rounded too, for the
    // same pixel-alignment reason as ts above.
    const offsetX = -Math.round(clamped.x);
    const offsetY = -Math.round(clamped.y);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const visible = humanCivId
      ? (gameState.visibility[humanCivId] || new Set())
      : spectatorVisibilitySet(gameState, viewState);
    // Explored: every tile ever seen (persists once discovered, see turns.js's
    // refreshVisibility). Memory: each explored tile's terrain/road/river/
    // resource/ruin/city/structure as of the LAST time it was actually
    // visible -- deliberately stale otherwise, and never includes units.
    const explored = humanCivId
      ? (gameState.explored?.[humanCivId] || new Set())
      : spectatorExploredSet(gameState, viewState);
    const memory = humanCivId
      ? (gameState.tileMemory?.[humanCivId] || {})
      : spectatorMemory(gameState, viewState);
    // Tile City Score overlay (Interface menu) -- independent of the current
    // viewer's own fog above; this is always the SELECTED race's own
    // tileMemory, read directly, so it shows exactly what that civ has
    // discovered regardless of who's actually looking at the screen.
    const tileScoreMemory = viewState.tileScoreCivId
      ? (gameState.tileMemory?.[viewState.tileScoreCivId] || {})
      : null;

    // Resource/ruin icons can render larger than one tile (iconScale/
    // RUIN_ICON_SCALE > 1.0, e.g. a big Ruin or Fish Shoal) and are now
    // bottom-anchored in one of 3 horizontal slots, so an oversized icon can
    // legitimately overhang into a neighboring tile's screen area. Drawing
    // them inline in the per-tile loop below meant that overhang got
    // silently painted over the moment the next tile in raster order (to
    // the right, or on the row below) drew its own opaque terrain fill on
    // top of it. Fix: collect their draws here and flush them in one pass
    // AFTER the whole terrain/river/road grid is painted (but still before
    // cities/units, which already get their own later pass for the same
    // reason) so overhang always lands on top of terrain, never under it.
    const deferredIcons = [];

    // City-center tile lookup for the civ-influence ambient overlay below --
    // a city's own tile has no dedicated `tile.city` pointer (unlike
    // `tile.structure`, which buildings/walls DO stamp directly, see below),
    // so this is the one place that needs to scan every civ's `cities` list
    // itself. Built once per frame rather than re-scanned per tile.
    const cityTileKeys = new Set();
    for (const c of Object.values(civs)) {
      for (const city of c.cities) cityTileKeys.add(`${city.x},${city.y}`);
    }

    // Construction placeholders: every queued building/wall already has its
    // final tile locked in at queue time
    // (city.buildQueue.placeAt -- see orders.js's queueBuild), even though
    // the actual structure record doesn't exist until completion. Built
    // once per frame so the tile loop below is a plain lookup instead of
    // scanning every civ's cities per tile. See overlays.js's
    // drawConstructionSite for the actual draw.
    const constructionSites = new Map();
    for (const civ of Object.values(civs)) {
      for (const city of civ.cities) {
        const bq = city.buildQueue;
        if (bq && bq.kind === "building" && bq.placeAt) {
          constructionSites.set(`${bq.placeAt.x},${bq.placeAt.y}`, bq);
        }
      }
    }

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const idx = y * map.width + x;
        const screenX = x * ts + offsetX;
        const screenY = y * ts + offsetY;
        if (screenX < -ts || screenX > canvas.width || screenY < -ts || screenY > canvas.height) continue;

        const tile = map.tiles[idx];
        const isVisible = visible.has(idx);

        if (!isVisible) {
          if (explored.has(idx)) {
            // Road connections for a remembered tile read from the snapshot
            // memory, not live tiles, so the fogged view stays consistent
            // with what was last observed.
            const roadConn = memory[idx]?.hasRoad
              ? roadConnections(
                  (tx, ty) => tx >= 0 && tx < map.width && ty >= 0 && ty < map.height &&
                              memory[ty * map.width + tx]?.hasRoad,
                  x, y
                )
              : null;
            drawRememberedTile(ctx, screenX, screenY, ts, memory[idx], roadConn, x, y, showGrid, deferredIcons, gameState.seed);
            if (tileScoreMemory) overlays.drawTileScoreOverlay(ctx, screenX, screenY, ts, tileScoreMemory[idx]?.cityScore);
          } else {
            ctx.fillStyle = "#1a1a1a";
            ctx.fillRect(screenX, screenY, ts, ts);
          }
          continue; // fog of war: nothing live (units, current buildings/roads) renders for unseen tiles
        }

        // Terrain — sprite drawn over a flat color-matched backing fill, not
        // sprite-only: some terrain art still carries a leftover chroma-key
        // resize seam (translucent edge pixels -- see doc/art_style_guide.md's
        // SeamlessEdges section) that would otherwise blend with whatever's
        // behind the canvas and show as a faint line at every tile edge. The
        // backing fill (also the sprite-missing fallback) hides it regardless
        // of which terrain PNGs still have the defect.
        ctx.fillStyle = window.GameData.TERRAIN[tile.terrain].color;
        ctx.fillRect(screenX, screenY, ts, ts);
        const terrainSprite = window.UI.sprites.pick(terrainSpriteKey(tile, x, y, gameState.seed), tile);
        if (terrainSprite) {
          if (isTallTerrainSprite(terrainSprite.manifest)) {
            // Deferred (not drawn immediately here) for the same clipping
            // reason as resource/ruin icons below -- an overhang into the
            // tile above must not be able to get painted over by that
            // tile's own deferred icons, which flush after the whole grid.
            const img = terrainSprite.image;
            deferredIcons.push(() => drawTallTerrainSprite(ctx, img, screenX, screenY, ts));
          } else {
            const f = window.UI.sprites.currentFrame(terrainSprite.manifest, "idle", tile);
            ctx.drawImage(terrainSprite.image, f.sx, f.sy, f.sw, f.sh, screenX, screenY, ts, ts);
          }
        }

        // River — composited stub overlay, drawn UNDER roads (see
        // drawRiverOverlay) so a road crossing a river reads as on top of it.
        drawRiverOverlay(ctx, screenX, screenY, ts, tile.hasRiver);

        // Road — composited stub overlay drawn on top of rivers, before enhancements
        if (tile.hasRoad) {
          const conn = roadConnections(
            (tx, ty) => tx >= 0 && tx < map.width && ty >= 0 && ty < map.height &&
                        map.tiles[ty * map.width + tx].hasRoad,
            x, y
          );
          drawRoadOverlay(ctx, screenX, screenY, ts, conn);
        }

        // Resource — sprite if available, otherwise gold dot. Drawn bottom-
        // anchored in one of 3 stable-random horizontal slots (see
        // tileIconBox), not dead-center, at the resource's own iconScale
        // (terrain.js) times ts -- relative sizing between resource types
        // (a small fish shoal vs. a bigger ruin) is a render-time scale
        // knob, not baked into the source art. The sprite's own transparent
        // padding is what lets terrain/road/river show through around it.
        // Actual draw is deferred (see deferredIcons above) so any overhang
        // past this tile's bounds isn't clipped by a later tile's terrain.
        if (tile.resource) {
          const resSprite = window.UI.sprites.pick(`enhancement/resource_${tile.resource}`, tile);
          if (resSprite) {
            const f = window.UI.sprites.currentFrame(resSprite.manifest, "idle", tile);
            const resDef = window.GameData.RESOURCES[tile.resource];
            const iconScale = (resDef && resDef.iconScale) || 1.0;
            const sz = ts * iconScale;
            const { boxX, boxY } = tileIconBox(screenX, screenY, ts, sz, x, y);
            deferredIcons.push(() => ctx.drawImage(resSprite.image, f.sx, f.sy, f.sw, f.sh, boxX, boxY, sz, sz));
          } else {
            deferredIcons.push(() => {
              ctx.fillStyle = "#f0d060";
              ctx.beginPath();
              ctx.arc(screenX + ts * 0.75, screenY + ts * 0.25, Math.max(1.5, ts * 0.09), 0, Math.PI * 2);
              ctx.fill();
            });
          }
        }

        // Ruin — sprite if available, otherwise "?" text. Same bottom-
        // anchored slot placement as resources, a little bigger
        // (RUIN_ICON_SCALE). Also deferred, same reasoning as Resource above.
        if (tile.isRuin) {
          const ruinSprite = window.UI.sprites.pick("enhancement/ruin", tile);
          if (ruinSprite) {
            const f = window.UI.sprites.currentFrame(ruinSprite.manifest, "idle", tile);
            const sz = ts * RUIN_ICON_SCALE;
            const { boxX, boxY } = tileIconBox(screenX, screenY, ts, sz, x, y);
            deferredIcons.push(() => ctx.drawImage(ruinSprite.image, f.sx, f.sy, f.sw, f.sh, boxX, boxY, sz, sz));
          } else {
            deferredIcons.push(() => {
              ctx.fillStyle = "#b08060";
              ctx.font = `${Math.max(8, ts * 0.36)}px monospace`;
              ctx.fillText("?", screenX + ts / 2 - ts * 0.11, screenY + ts / 2 + ts * 0.11);
            });
          }
        }

        // Civ-influence ambient overlay: small non-animated per-race flavor
        // sprites (assets/enhancements/influence_{raceId}_{1..5}.png) drawn
        // on owned tiles so occupied land reads as "occupied and worked,"
        // independent of the `showInfluence` tint toggle below (always-on
        // ambient detail, not a debug overlay). Skips tiles with a
        // building/wall (`tile.structure`), a city center (`cityTileKeys`),
        // or a river (`tile.hasRiver`); every other owned tile shows it,
        // including resource/ruin tiles and tiles with a road (drawn on top
        // of them, same as resource/ruin icons). Gated on
        // `tile.status === "owned"` only, not "contested" -- meant to read
        // as settled ground. Picked deterministically
        // (tileInfluenceVariantHash) rather than through sprites.js's
        // pick(), so the same tile always shows the same variant across
        // reloads of the same map.
        //
        // Coast/ocean tiles route to a SEPARATE sprite pool
        // (`enhancement/influence-water/${raceId}`, one non-animated variant
        // per race) instead of the land pool above -- land-themed art has no
        // business sitting on open water, and ocean/coast tiles are a legal
        // fill/claim target (see cities.js's isOffsetFilled). Falls through
        // to drawing nothing if a race's water variant hasn't been generated
        // yet.
        if (tile.status === "owned" && tile.ownerCivId && !tile.structure
            && !cityTileKeys.has(`${x},${y}`) && !(tile.hasRiver && (tile.hasRiver.n || tile.hasRiver.s || tile.hasRiver.e || tile.hasRiver.w))) {
          const ownerCiv = civs[tile.ownerCivId];
          if (ownerCiv) {
            const influenceKey = window.GameData.TERRAIN[tile.terrain].isWater
              ? `enhancement/influence-water/${ownerCiv.raceId}`
              : `enhancement/influence/${ownerCiv.raceId}`;
            const influenceSprite = window.UI.sprites.pickDeterministic(
              influenceKey, tileInfluenceVariantHash(x, y, gameState.seed)
            );
            if (influenceSprite) {
              const f = window.UI.sprites.currentFrame(influenceSprite.manifest, "idle", tile);
              deferredIcons.push(() => ctx.drawImage(influenceSprite.image, f.sx, f.sy, f.sw, f.sh, screenX, screenY, ts, ts));
            }
          }
        }

        // Construction placeholder -- see constructionSites above.
        const construction = constructionSites.get(`${x},${y}`);
        if (construction) overlays.drawConstructionSite(ctx, screenX, screenY, ts, construction);

        // Influence overlay
        if (showInfluence && tile.status !== "neutral" && tile.ownerCivId) {
          const civ = civs[tile.ownerCivId];
          const color = civ ? window.GameData.getRace(civ.raceId).color : "#888";
          if (tile.status === "owned") {
            ctx.fillStyle = overlays.hexToRgba(color, 0.45);
            ctx.fillRect(screenX, screenY, ts, ts);
          } else if (tile.status === "contested") {
            overlays.drawHatch(ctx, screenX, screenY, ts, color);
          }
        }

        // Grid line — toggleable via the Interface menu
        if (showGrid) {
          ctx.strokeStyle = "rgba(0,0,0,0.15)";
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX, screenY, ts, ts);
        }

        if (tileScoreMemory) overlays.drawTileScoreOverlay(ctx, screenX, screenY, ts, tileScoreMemory[idx]?.cityScore);
      }
    }

    // Flush deferred resource/ruin icon draws now that every tile's terrain
    // is painted (see deferredIcons comment above) -- still ahead of
    // cities/units below, preserving the normal stacking order.
    for (const draw of deferredIcons) draw();

    // Order overlay sits above terrain but BELOW cities/units, so it tints
    // the ground a unit could move onto without washing out whatever is
    // standing there. The path preview is drawn later, on top of everything.
    drawReachableOverlay(ctx, gameState, viewState, offsetX, offsetY, ts);
    drawPlacementOverlay(ctx, viewState, offsetX, offsetY, ts);

    // Jump-to-tile flash: a brief highlight on whichever tile a coordinate
    // link (sidebar mission text, a dialog's "Go to", ...) just centered the
    // view on -- same layer as the reachable/
    // placement overlays just above (over terrain, under cities/units), so
    // it's still visible under whatever's standing there without hiding it.
    if (viewState.tileFlash) {
      if (!drawTileFlash(ctx, viewState.tileFlash, offsetX, offsetY, ts, now)) viewState.tileFlash = null;
    }

    // Cities
    // Fed to villagers.js's tick/draw below -- the cities currently visible
    // on screen, so ambient figures never spawn (or keep animating)
    // somewhere the player can't actually see.
    const villagerCities = [];
    for (const civ of Object.values(civs)) {
      const race = window.GameData.getRace(civ.raceId);
      const citySymbol = race.citySymbol || "★";
      for (const city of civ.cities) {
        const idx = city.y * map.width + city.x;
        if (!visible.has(idx)) continue;
        villagerCities.push({ civ, city });
        const screenX = city.x * ts + offsetX;
        const screenY = city.y * ts + offsetY;
        const cx = screenX + ts / 2, cy = screenY + ts / 2;

        const pop = Math.floor(city.population);
        // Prefer separate per-tier images (assets/cities/${raceId}_city_{1..6}.png)
        // if this race has any; otherwise fall back to the older shared-sheet
        // "tier1"/"tier2"/... animation convention.
        const tieredSprite = window.UI.sprites.pickCityTier(civ.raceId, pop);
        const citySprite = tieredSprite || window.UI.sprites.pick(`city/${civ.raceId}`, city);
        if (citySprite) {
          if (tieredSprite) {
            // Draw height follows the image's own aspect ratio, anchored to
            // the BOTTOM of the city's tile -- a square image draws at
            // drawHeight = ts, while a portrait image (e.g. Elf's taller
            // tiers, see art style guide §12) bleeds upward into the tile
            // north of the city instead of being squashed into one tile. No
            // per-race format flag needed; the renderer just follows the art.
            const img = tieredSprite.image;
            const drawHeight = ts * (img.naturalHeight / img.naturalWidth);
            const drawY = screenY + ts - drawHeight;
            ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, screenX, drawY, ts, drawHeight);
          } else {
            // Sprite frame = population tier (frame 0 = pop 1, frame 1 = pop 2, etc.)
            const tierAnim = citySprite.manifest.animations[`tier${pop}`] || citySprite.manifest.animations.idle;
            const f = window.UI.sprites.currentFrame(citySprite.manifest, tierAnim ? `tier${pop}` : "idle", city);
            ctx.drawImage(citySprite.image, f.sx, f.sy, f.sw, f.sh, screenX, screenY, ts, ts);
          }
          // Always draw population number on top of sprite
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.max(6, ts * 0.25)}px monospace`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 2;
          ctx.strokeText(String(pop), cx, screenY + ts * 0.85);
          ctx.fillText(String(pop), cx, screenY + ts * 0.85);
        } else {
          // Fallback: colored circle with race symbol
          const radius = Math.min(ts * 0.45, ts * 0.3 + pop * ts / 56);
          ctx.fillStyle = race.color;
          ctx.beginPath();
          ctx.arc(cx, cy, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = city.isPort ? "#7fd4f7" : "#fff";
          ctx.lineWidth = city.isPort ? 2 : 1.5;
          ctx.stroke();
          ctx.fillStyle = "#fff";
          ctx.font = `bold ${Math.max(7, ts * 0.32)}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(citySymbol, cx, cy - ts * 0.07);
          ctx.font = `bold ${Math.max(6, ts * 0.25)}px monospace`;
          ctx.fillText(String(pop), cx, cy + ts * 0.18);
        }

        if (selectedCity === city) {
          ctx.strokeStyle = "#ffeb3b";
          ctx.lineWidth = 2;
          ctx.strokeRect(screenX + 1, screenY + 1, ts - 2, ts - 2);
        }

        // Idle badge -- human-civ-only (no visibility into a foreign civ's
        // build queue, and no agency over it anyway; see cities.js's
        // isCityIdle, shared with the sidebar's per-city tag and the End
        // Turn nag).
        if (humanCivId && civ.id === humanCivId && window.GameEngine.cities.isCityIdle(civ, city, gameState)) {
          overlays.drawIdleCityBadge(ctx, screenX, screenY, ts);
        }
      }
    }

    // City influence-radius border (debug aid): outlines the exact square
    // city.influenceRadius covers, so fill-in tiles or influence appearing
    // outside that boundary are easy to spot visually. Shown alongside the
    // influence overlay toggle since that's when this matters.
    if (showInfluence) {
      for (const civ of Object.values(civs)) {
        const race = window.GameData.getRace(civ.raceId);
        for (const city of civ.cities) {
          const idx = city.y * map.width + city.x;
          if (!visible.has(idx)) continue;
          const radius = city.influenceRadius;
          const borderX = (city.x - radius) * ts + offsetX;
          const borderY = (city.y - radius) * ts + offsetY;
          const size = (radius * 2 + 1) * ts;
          ctx.save();
          ctx.strokeStyle = race.color;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.strokeRect(borderX, borderY, size, size);
          ctx.restore();
        }
      }
    }

    // Deferred-pass queues, populated by the Structures loop below (burning
    // walls/buildings) as well as the Units loop -- floating text should
    // never be occluded by a unit sprite drawn later in the position-sorted
    // pass.
    const quipBubbleQueue = [];
    const floatingTextQueue = [];

    // Cities can raise floating text too ("Resource Production" -- see
    // cities.js's applyResourceProduction), matched by object identity
    // exactly like a unit or a structure record. Its own pass rather than a
    // push inside the city loop above, which runs before these queues exist.
    for (const civ of Object.values(civs)) {
      for (const city of civ.cities) {
        if (!visible.has(city.y * map.width + city.x)) continue;
        if (!overlays.hasActiveFloatingText(city)) continue;
        floatingTextQueue.push({ unit: city, screenX: city.x * ts + offsetX, screenY: city.y * ts + offsetY });
      }
    }

    // Structures (buildings placed on any tile adjacent to their city)
    for (const civ of Object.values(civs)) {
      const race = window.GameData.getRace(civ.raceId);
      for (const city of civ.cities) {
        for (const s of city.structures) {
          const idx = s.y * map.width + s.x;
          if (!visible.has(idx)) continue;
          const building = window.GameData.getBuilding(s.id);
          const screenX = s.x * ts + offsetX;
          const screenY = s.y * ts + offsetY;
          // Prefer real art (assets/buildings/{id}.png) if shipped; same
          // aspect-ratio/bottom-anchor formula as city tiers (see art style
          // guide §13) so a taller building (e.g. a watchtower) bleeds
          // upward instead of being squashed into one tile -- capped by the
          // art itself to stay shorter than any city tier, not by code here.
          // Walls additionally vary by orientation (see wallOrientation()
          // above) so a run of segments connects visually.
          const sprite = building.isWall
            ? window.UI.sprites.pickWallSegment(s.id, civ.raceId, wallOrientation(map, civ.id, s.x, s.y), s)
            : window.UI.sprites.pickBuilding(s.id, civ.raceId, s);
          if (sprite) {
            const img = sprite.image;
            const drawHeight = ts * (img.naturalHeight / img.naturalWidth);
            const drawY = screenY + ts - drawHeight;
            ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, screenX, drawY, ts, drawHeight);
          } else {
            const pad = ts * 0.2;
            // Body: civ-colored rounded square
            ctx.fillStyle = overlays.hexToRgba(race.color, 0.85);
            ctx.fillRect(screenX + pad, screenY + pad, ts - pad * 2, ts - pad * 2);
            ctx.strokeStyle = "rgba(0,0,0,0.5)";
            ctx.lineWidth = 1;
            ctx.strokeRect(screenX + pad, screenY + pad, ts - pad * 2, ts - pad * 2);
            // Symbol
            ctx.fillStyle = "#fff";
            ctx.font = `bold ${Math.max(7, ts * 0.32)}px serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(building.symbol || "▪", screenX + ts / 2, screenY + ts / 2 - ts * 0.03);
          }
          // HP bar (only when damaged) -- always tile-relative, independent
          // of whether a sprite or the placeholder was drawn above.
          if (s.hp < s.maxHp) {
            const barPad = ts * 0.1;
            const bw = ts - barPad * 2, bh = Math.max(2, ts * 0.08);
            const bx = screenX + barPad, by = screenY + ts - barPad - bh;
            ctx.fillStyle = "rgba(0,0,0,0.6)";
            ctx.fillRect(bx, by, bw, bh);
            ctx.fillStyle = "#5fbf5f";
            ctx.fillRect(bx, by, bw * Math.max(0, s.hp) / s.maxHp, bh);
          }
          // Floating text anchored to a STRUCTURE record rather than a unit
          // (burning walls/buildings) -- matched by object identity against
          // activeFloatingTexts, same convention as the per-unit queue
          // below, just populated from this loop instead since a structure
          // record never appears in civ.units.
          if (overlays.hasActiveFloatingText(s)) {
            floatingTextQueue.push({ unit: s, screenX, screenY });
          }
        }
      }
    }

    // Aura radius overlay (Human "Crusade" Paladin / Dwarf "Heavy Metal"/
    // "Power Metal" Troubadour) -- see auraInfoForUnit. Drawn under the unit
    // sprites (before the Units pass below) so units/terrain stay legible on
    // top of the tint. Per-tile fill plus a single perimeter outline, same
    // convention as the city influence-radius border above.
    for (const civ of Object.values(civs)) {
      for (const unit of civ.units) {
        const aura = overlays.auraInfoForUnit(unit, civ);
        if (!aura) continue;
        const idx = unit.y * map.width + unit.x;
        if (!visible.has(idx)) continue;
        const { radius, color } = aura;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const tx = unit.x + dx, ty = unit.y + dy;
            if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
            if (!visible.has(ty * map.width + tx)) continue;
            ctx.fillStyle = overlays.hexToRgba(color, 0.16);
            ctx.fillRect(tx * ts + offsetX, ty * ts + offsetY, ts, ts);
          }
        }
        ctx.save();
        ctx.strokeStyle = overlays.hexToRgba(color, 0.85);
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          (unit.x - radius) * ts + offsetX, (unit.y - radius) * ts + offsetY,
          (radius * 2 + 1) * ts, (radius * 2 + 1) * ts,
        );
        ctx.restore();
      }
    }

    // Units
    // Drawn in a flat, position-sorted pass (top-to-bottom, then
    // left-to-right) across all civs together, rather than grouped by civ --
    // this is what makes a "bigger" unit's overflow draw UNDER whatever is
    // below/right of it and OVER whatever is above/left of it, matching how
    // overlapping sprites should stack. Ordinary tile-sized units never
    // overlap a neighbor, so this sort is a no-op for them.
    const unitsToDraw = [];
    for (const civ of Object.values(civs)) {
      for (const unit of civ.units) {
        if (unit.carriedBy) continue; // aboard a carrier -- not drawn at its stale tile
        const idx = unit.y * map.width + unit.x;
        if (!visible.has(idx)) continue;
        // An enemy unit's Hidden condition actually hides it from the human
        // player -- own units stay visible regardless (see isOwnHidden
        // below), and spectator mode (humanCivId null) shows everyone.
        if (unit.conditions?.hidden && humanCivId != null && unit.civId !== humanCivId) continue;
        unitsToDraw.push({ civ, unit, visualPos: getVisualPos(unit) });
      }
    }
    unitsToDraw.sort((a, b) => a.visualPos.y - b.visualPos.y || a.visualPos.x - b.visualPos.x);

    for (const { civ, unit, visualPos } of unitsToDraw) {
      const race = window.GameData.getRace(civ.raceId);
      const shake = overlays.getUnitShakeOffset(unit, ts, now);
      const screenX = visualPos.x * ts + offsetX + shake.x;
      const screenY = visualPos.y * ts + offsetY + shake.y;
      const baseUnit = window.GameData.getUnit(unit.typeId);
      const initial = (baseUnit.label || "?").charAt(0).toUpperCase();
      const pad = ts * 0.11;
      const unitSprite = window.UI.sprites.pickUnit(unit.typeId, race.id, unit);

      // "bigger" scales the drawn box up around its bottom-center anchor --
      // the tile's normal bottom-inset stays fixed, extra size grows upward
      // and sideways (see units.js's biggerPct doc comment).
      const scale = 1 + (baseUnit.biggerPct || 0);
      const normalSize = ts - pad * 2;
      const boxSize = normalSize * scale;
      const boxX = screenX + ts / 2 - boxSize / 2;
      const boxY = screenY + pad + normalSize - boxSize;

      // Slight alpha reduction on OWN hidden units only (own units are
      // always fully visible to their own civ regardless of Hidden -- this
      // is a "notice at a glance which of my units are hidden" affordance,
      // not a fog-of-war effect; an opponent's hidden unit is never drawn
      // here at all, gated upstream by tile visibility). Applies uniformly
      // in spectator mode (humanCivId null), where every civ's units are
      // equally "own" to the viewer.
      const isOwnHidden = !!unit.conditions?.hidden && (humanCivId == null || unit.civId === humanCivId);
      const spriteAlpha = isOwnHidden ? 0.55 : 1;
      overlays.drawLevelUpGlowBehind(ctx, unit, boxX, boxY, boxSize, now);
      ctx.save();
      ctx.globalAlpha = spriteAlpha;
      if (unitSprite) {
        const f = window.UI.sprites.currentFrame(unitSprite.manifest, "idle", unit);
        drawUnitShadow(ctx, screenX, screenY, ts, race.color, scale);
        ctx.drawImage(unitSprite.image, f.sx, f.sy, f.sw, f.sh, boxX, boxY, boxSize, boxSize);
      } else {
        // Fallback: race-colored shadow + unicode symbol, outlined for
        // contrast now that there's no solid tile behind it to guarantee that.
        drawUnitShadow(ctx, screenX, screenY, ts, race.color, scale);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(7, ts * 0.32 * scale)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = Math.max(1, ts * 0.05 * scale);
        ctx.strokeText(initial, boxX + boxSize / 2, boxY + boxSize / 2);
        ctx.fillText(initial, boxX + boxSize / 2, boxY + boxSize / 2);
      }
      ctx.restore();
      overlays.drawConditionVisualEffects(ctx, unit, unitSprite, boxX, boxY, boxSize, now);

      // HP bar
      if (unit.hp != null && unit.maxHp && unit.hp < unit.maxHp) {
        const pct = Math.max(0, unit.hp / unit.maxHp);
        const barW = boxSize - 4, barX = boxX + 2, barY = boxY + boxSize - 3;
        ctx.fillStyle = "#400";
        ctx.fillRect(barX, barY, barW, 2);
        ctx.fillStyle = "#4caf50";
        ctx.fillRect(barX, barY, barW * pct, 2);
      }
      if (selectedUnit === unit) {
        ctx.strokeStyle = "#ffeb3b";
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX + 1, boxY + 1, boxSize - 2, boxSize - 2);
      }
      overlays.drawConditionBadges(ctx, unit, boxX, boxY, boxSize, ts);
      overlays.drawChannelStashLabel(ctx, unit, screenX, screenY, ts);
      overlays.drawLevelUpSparkles(ctx, unit, boxX, boxY, boxSize, now);

      if (overlays.hasActiveQuip(unit)) {
        quipBubbleQueue.push({ unit, screenX, screenY });
      }
      if (overlays.hasActiveFloatingText(unit)) {
        floatingTextQueue.push({ unit, screenX, screenY });
      }
    }

    // Ambient villager figures -- drawn after Cities/Structures/Units so
    // they're never hidden behind a building or wall they're walking past.
    // See villagers.js's own doc comment.
    window.UI.villagers.tick(villagerCities, map);
    window.UI.villagers.draw(ctx, offsetX, offsetY, ts, villagerCities);

    // Where the player's self-directing units are headed -- above units,
    // below the hover preview, same reasoning as the path preview: a route
    // is only useful if it reads THROUGH whatever it passes over.
    drawPlannedPaths(ctx, gameState, viewState, offsetX, offsetY, ts, now);

    // "Next Unit" flash: drawn above cities/units so it reads clearly
    // regardless of what's standing on the tile.
    drawFlashTile(ctx, viewState, offsetX, offsetY, ts, now);

    // Enemy-in-range reticles: a persistent small target over every enemy
    // unit the CURRENTLY SELECTED unit could actually attack right now, so
    // the player doesn't have to hover each enemy one at a time to find out
    // which ones are in range. Drawn before
    // the hover-driven order preview just below, so that preview's own
    // fuller attack reticle still reads clearly on top for whichever tile
    // is actually being considered.
    drawEnemyTargets(ctx, gameState, viewState, offsetX, offsetY, ts);

    // Path preview last-but-one: it must read clearly over units and terrain
    // alike, since the whole point is showing a route THROUGH them.
    drawOrderPreview(ctx, gameState, viewState, offsetX, offsetY, ts);

    overlays.drawAreaEffects(ctx, offsetX, offsetY, ts, now);
    overlays.drawCombatSlashes(ctx, offsetX, offsetY, ts, now);
    overlays.drawDeathEffects(ctx, offsetX, offsetY, ts, now);
    for (const { unit, screenX, screenY } of quipBubbleQueue) {
      overlays.drawQuipBubble(ctx, unit, screenX, screenY, ts, now);
    }
    // Drawn last (on top of quip bubbles too) -- floating text is the most
    // immediate, momentary feedback and shouldn't be occluded by anything.
    for (const { unit, screenX, screenY } of floatingTextQueue) {
      overlays.drawFloatingTexts(ctx, unit, screenX, screenY, ts, now);
    }
  }

  // --- Player order overlays ----------------------------------------------
  // Only ever drawn for a unit the HUMAN player can actually command -- an AI
  // civ's units and a spectator game get none of this, since there's no order
  // to give. See js/engine/orders.js for the rules these visualize; this file
  // only paints what that module reports, so the overlay can never promise a
  // move the engine would then refuse.

  /** Tints every tile the selected unit could end its move on, brighter for
   *  cheaper tiles so the movement gradient is legible at a glance. */
  function drawReachableOverlay(ctx, gameState, viewState, offsetX, offsetY, ts) {
    const orders = window.GameEngine.orders;
    const unit = viewState.selectedUnit;
    if (!orders || !orders.canCommand(unit, gameState, viewState.humanCivId)) return;
    const reach = orders.reachableTiles(unit, gameState);
    if (!reach.size) return;

    const budget = unit.movesRemaining != null ? unit.movesRemaining : 1;
    for (const { x, y, cost } of reach.values()) {
      const screenX = x * ts + offsetX;
      const screenY = y * ts + offsetY;
      if (screenX < -ts || screenX > ctx.canvas.width || screenY < -ts || screenY > ctx.canvas.height) continue;
      // Cheap tiles read as "comfortably in reach", expensive ones as "this
      // uses your whole turn" -- same information the cost number carries,
      // but available without hovering every tile.
      const spentFrac = budget > 0 ? Math.min(1, cost / budget) : 1;
      ctx.fillStyle = `rgba(120, 190, 255, ${0.28 - 0.14 * spentFrac})`;
      ctx.fillRect(screenX, screenY, ts, ts);
    }

    // Outline the reachable region's edge so its extent is unmistakable even
    // where the fill is faintest: a tile is on the border if a neighbour is
    // outside the set.
    ctx.strokeStyle = "rgba(150, 205, 255, 0.75)";
    ctx.lineWidth = 1.5;
    for (const { x, y } of reach.values()) {
      const screenX = x * ts + offsetX;
      const screenY = y * ts + offsetY;
      if (screenX < -ts || screenX > ctx.canvas.width || screenY < -ts || screenY > ctx.canvas.height) continue;
      ctx.beginPath();
      if (!reach.has(`${x},${y - 1}`)) { ctx.moveTo(screenX, screenY); ctx.lineTo(screenX + ts, screenY); }
      if (!reach.has(`${x},${y + 1}`)) { ctx.moveTo(screenX, screenY + ts); ctx.lineTo(screenX + ts, screenY + ts); }
      if (!reach.has(`${x - 1},${y}`)) { ctx.moveTo(screenX, screenY); ctx.lineTo(screenX, screenY + ts); }
      if (!reach.has(`${x + 1},${y}`)) { ctx.moveTo(screenX + ts, screenY); ctx.lineTo(screenX + ts, screenY + ts); }
      ctx.stroke();
    }
  }

  /**
   * Structure-placement mode: highlights every tile the queued building could
   * legally stand on, so the player picks a real slot rather than guessing.
   * Active only while viewState.placement is set (see main.js's
   * handleOpenBuildPicker flow); the slot list comes from
   * cities.js's validStructureSlots, the same rules placeStructure enforces.
   *
   * Unit-summon placements (Orc Wisp, Halfellow Frost/Fire Trap -- see
   * main.js's startWispSummonPlacement/startTrapPlacement) additionally set
   * placement.previewUnitId/previewRaceId: every valid slot still gets the
   * plain gold wash below so the candidate set reads at a glance, but the
   * tile currently under the cursor (the one that would actually be picked)
   * additionally gets a real, half-transparent render of the unit that would
   * appear there (drawPlacementPreviewUnit).
   */
  function drawPlacementOverlay(ctx, viewState, offsetX, offsetY, ts) {
    const placement = viewState.placement;
    if (!placement || !placement.slots || !placement.slots.length) return;
    const hover = viewState.hoverTile;

    const pulse = 0.5 + 0.25 * Math.sin(performance.now() / 300);
    for (const slot of placement.slots) {
      const screenX = slot.x * ts + offsetX;
      const screenY = slot.y * ts + offsetY;
      if (screenX < -ts || screenX > ctx.canvas.width || screenY < -ts || screenY > ctx.canvas.height) continue;
      const isHovered = hover && hover.x === slot.x && hover.y === slot.y;
      if (placement.targeting) {
        drawTargetReticle(ctx, screenX, screenY, ts, isHovered, pulse);
        continue;
      }
      ctx.fillStyle = isHovered ? "rgba(255, 215, 90, 0.35)" : `rgba(255, 215, 90, ${0.22 * pulse + 0.12})`;
      ctx.fillRect(screenX, screenY, ts, ts);
      ctx.strokeStyle = isHovered ? "#ffd75a" : "rgba(255, 215, 90, 0.8)";
      ctx.lineWidth = isHovered ? 3 : 1.5;
      ctx.strokeRect(screenX + 1, screenY + 1, ts - 2, ts - 2);
      if (isHovered && placement.previewUnitId) {
        drawPlacementPreviewUnit(ctx, placement.previewUnitId, placement.previewRaceId, screenX, screenY, ts);
      }
    }
  }

  /** Target-selection mode's per-candidate marker (see main.js's
   *  startTargetSelection): a cyan corner-bracket reticle around the unit
   *  rather than the gold full-tile wash a build slot gets -- the player is
   *  picking an existing unit here, not empty ground, and a solid wash would
   *  sit on top of the very sprite they're trying to identify. Deliberately
   *  leaves the tile centre clear for the same reason; only the hovered
   *  candidate gets a faint fill, as confirmation of what a click would hit. */
  function drawTargetReticle(ctx, screenX, screenY, ts, isHovered, pulse) {
    const inset = ts * 0.07;
    const arm = ts * 0.26;
    const x0 = screenX + inset, y0 = screenY + inset;
    const x1 = screenX + ts - inset, y1 = screenY + ts - inset;
    ctx.save();
    if (isHovered) {
      ctx.fillStyle = "rgba(90, 230, 230, 0.20)";
      ctx.fillRect(screenX, screenY, ts, ts);
    }
    ctx.strokeStyle = isHovered ? "#7bf5f5" : `rgba(90, 220, 220, ${0.55 * pulse + 0.35})`;
    ctx.lineWidth = Math.max(1.5, ts * (isHovered ? 0.055 : 0.04));
    ctx.lineCap = "round";
    ctx.beginPath();
    // Four corner brackets.
    ctx.moveTo(x0, y0 + arm); ctx.lineTo(x0, y0); ctx.lineTo(x0 + arm, y0);
    ctx.moveTo(x1 - arm, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + arm);
    ctx.moveTo(x0, y1 - arm); ctx.lineTo(x0, y1); ctx.lineTo(x0 + arm, y1);
    ctx.moveTo(x1 - arm, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - arm);
    ctx.stroke();
    ctx.restore();
  }

  /** Half-transparent preview of the unit a summon placement would actually
   *  create, drawn on the hovered tile (see drawPlacementOverlay above).
   *  Reuses the exact same sprite lookup the real Units draw pass uses
   *  (pickUnit + currentFrame) rather than any bespoke placeholder art --
   *  seed is null since every summon-placeable unit (Wisp, the two traps)
   *  ships exactly one art variant and a single-frame idle animation, so
   *  there's nothing for a stable per-instance seed to disambiguate here. */
  function drawPlacementPreviewUnit(ctx, unitId, raceId, screenX, screenY, ts) {
    const unitSprite = window.UI.sprites.pickUnit(unitId, raceId, null);
    if (!unitSprite) return;
    const f = window.UI.sprites.currentFrame(unitSprite.manifest, "idle", null);
    const pad = ts * 0.11;
    const boxSize = ts - pad * 2;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.drawImage(unitSprite.image, f.sx, f.sy, f.sw, f.sh, screenX + pad, screenY + pad, boxSize, boxSize);
    ctx.restore();
  }

  const FLASH_TILE_MS = 900;

  /** "Next Unit" flash: a brief, brightening-then-fading ring drawn on
   *  whichever tile main.js's handleNextUnit just jumped to, so a click that
   *  recenters the map onto a unit the player wasn't already looking at
   *  actually draws the eye there instead of landing silently.
   *  viewState.flashTile = { x, y, startTime } is set once per jump and
   *  self-clears here once FLASH_TILE_MS has elapsed -- no separate timer in
   *  main.js needed, same "just stop drawing it" approach
   *  drawPlacementOverlay's own pulse uses for its animation. */
  function drawFlashTile(ctx, viewState, offsetX, offsetY, ts, now) {
    const flash = viewState.flashTile;
    if (!flash) return;
    const elapsed = now - flash.startTime;
    if (elapsed >= FLASH_TILE_MS) { viewState.flashTile = null; return; }

    const t = elapsed / FLASH_TILE_MS; // 0 (just jumped) -> 1 (about to clear)
    const screenX = flash.x * ts + offsetX;
    const screenY = flash.y * ts + offsetY;
    // Two quick pulses rather than one slow fade -- more eye-catching for
    // something meant to be noticed in under a second.
    const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 4);
    const alpha = (1 - t) * pulse;

    ctx.save();
    ctx.strokeStyle = `rgba(255, 235, 90, ${0.35 + 0.65 * alpha})`;
    ctx.lineWidth = 3 + 3 * alpha;
    ctx.strokeRect(screenX + 2, screenY + 2, ts - 4, ts - 4);
    ctx.restore();
  }

  // Route colors by what's driving the unit -- a player-issued goto reuses
  // the move preview's own blue (same thing, just already committed), a
  // build-road order the roads' earthy tone, and an automated unit a distinct
  // green so "I told it to go there" never reads the same as "it decided to
  // go there on its own".
  const PLANNED_PATH_COLORS = { goto: "#7fd4f7", buildRoad: "#e0b26a", auto: "#9ad97f" };
  const PATH_DASH_MS_PER_CYCLE = 700; // one dash+gap of travel; lower = faster crawl

  /**
   * Every self-directing unit's route, drawn on the map: a dashed line
   * crawling from the unit along the exact path it will take, with an X on
   * the tile it's headed for. Covers units mid
   * multi-turn goto order and units running on Automate Actions -- see
   * orders.js's plannedPath, which decides what (if anything) each unit is
   * aiming at and does the pathfinding.
   *
   * Drawn for ALL of the player's own such units at once, not just the
   * selected one, so a dozen automated units read as a set of plans at a
   * glance -- the unselected ones at reduced alpha so the selected unit's own
   * route still stands out from the crowd. Never drawn for another civ's
   * units: their intentions aren't the player's to see.
   */
  function drawPlannedPaths(ctx, gameState, viewState, offsetX, offsetY, ts, now) {
    const orders = window.GameEngine.orders;
    const civ = viewState.humanCivId ? gameState.civs[viewState.humanCivId] : null;
    if (!orders || !orders.plannedPath || !civ) return;

    // Marching dashes: the offset runs negative so the pattern travels
    // FORWARD along the stroke, i.e. toward the destination.
    const dashCycle = 14;
    const dashOffset = -((now % PATH_DASH_MS_PER_CYCLE) / PATH_DASH_MS_PER_CYCLE) * dashCycle;

    for (const unit of civ.units) {
      // Only the selected unit's route is drawn -- showing every unit's
      // planned path at once clutters a busy map with lines for units the
      // player isn't even looking at right now.
      if (unit !== viewState.selectedUnit) continue;
      const plan = orders.plannedPath(unit, gameState);
      if (!plan) continue;

      const visual = getVisualPos(unit);
      const points = [{ x: (visual.x + 0.5) * ts + offsetX, y: (visual.y + 0.5) * ts + offsetY }];
      for (const step of plan.path) {
        points.push({ x: (step.x + 0.5) * ts + offsetX, y: (step.y + 0.5) * ts + offsetY });
      }
      const targetX = (plan.target.x + 0.5) * ts + offsetX;
      const targetY = (plan.target.y + 0.5) * ts + offsetY;

      // Whole-route cull: nothing to draw if the line and its X both sit well
      // off-canvas (a long cross-map order is common, and stroking one costs
      // more than the bounds check).
      const xs = points.map((p) => p.x).concat(targetX);
      const ys = points.map((p) => p.y).concat(targetY);
      if (Math.max(...xs) < -ts || Math.min(...xs) > ctx.canvas.width + ts
        || Math.max(...ys) < -ts || Math.min(...ys) > ctx.canvas.height + ts) continue;

      const color = PLANNED_PATH_COLORS[plan.kind] || PLANNED_PATH_COLORS.goto;

      ctx.save();
      ctx.globalAlpha = 1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      // Solid dark backing first, so the dashes stay legible over bright
      // terrain (sand, snow) as well as dark (deep water, forest).
      ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
      ctx.lineWidth = Math.max(3, ts * 0.09);
      ctx.stroke();
      ctx.setLineDash([7, 7]);
      ctx.lineDashOffset = dashOffset;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, ts * 0.05);
      ctx.stroke();
      ctx.setLineDash([]);

      // Destination X. Anchored to the ORDER's target, which is not always
      // the end of the drawn route -- an unreachable target gets a path that
      // stops at the closest approach (see plannedPath), and marking where
      // the unit is actually TRYING to get to is the more useful of the two.
      const arm = ts * 0.22;
      ctx.beginPath();
      ctx.moveTo(targetX - arm, targetY - arm);
      ctx.lineTo(targetX + arm, targetY + arm);
      ctx.moveTo(targetX + arm, targetY - arm);
      ctx.lineTo(targetX - arm, targetY + arm);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
      ctx.lineWidth = Math.max(4, ts * 0.11);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(2, ts * 0.06);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Small red target reticle over every enemy unit currently in range of
   * the selected unit -- reuses ai.js's canAttackUnitNow (the same
   * range/visibility/line-of-sight/
   * reachability check considerAttackOrGarrison itself consults) rather
   * than re-deriving range logic here, so this can never promise a target
   * that clicking wouldn't actually let the player attack. Deliberately
   * simpler than drawOrderPreview's own attack reticle (no odds label, no
   * tile-square outline) -- this is an at-a-glance "these are in range"
   * scan across the whole visible board, not a considered look at one tile.
   */
  function drawEnemyTargets(ctx, gameState, viewState, offsetX, offsetY, ts) {
    const orders = window.GameEngine.orders;
    const ai = window.GameEngine.ai;
    const unit = viewState.selectedUnit;
    if (!orders || !ai || !orders.canCommand(unit, gameState, viewState.humanCivId)) return;
    const civ = gameState.civs[unit.civId];
    if (!civ) return;

    for (const otherCiv of Object.values(gameState.civs)) {
      if (otherCiv.id === civ.id) continue;
      for (const enemy of otherCiv.units) {
        if (enemy.carriedBy) continue; // not a real, targetable board presence
        if (!ai.canAttackUnitNow(civ, unit, enemy, gameState)) continue;
        const screenX = enemy.x * ts + offsetX, screenY = enemy.y * ts + offsetY;
        if (screenX < -ts || screenX > ctx.canvas.width || screenY < -ts || screenY > ctx.canvas.height) continue;
        const cx = screenX + ts / 2, cy = screenY + ts / 2;

        ctx.save();
        ctx.strokeStyle = "rgba(255,60,60,0.85)";
        ctx.lineWidth = Math.max(1, ts * 0.03);
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.24, 0, Math.PI * 2);
        ctx.stroke();
        // Crosshair ticks, gapped around the ring rather than crossing all
        // the way through the center -- reads as a "target" mark, not just
        // a circle-with-a-plus.
        ctx.beginPath();
        ctx.moveTo(cx - ts * 0.32, cy); ctx.lineTo(cx - ts * 0.17, cy);
        ctx.moveTo(cx + ts * 0.17, cy); ctx.lineTo(cx + ts * 0.32, cy);
        ctx.moveTo(cx, cy - ts * 0.32); ctx.lineTo(cx, cy - ts * 0.17);
        ctx.moveTo(cx, cy + 0.17 * ts); ctx.lineTo(cx, cy + ts * 0.32);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,60,60,0.85)";
        ctx.beginPath();
        ctx.arc(cx, cy, ts * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /** The hovered tile's order preview: an attack reticle with odds, a move
   *  cost pip, or a struck-through marker when the order isn't legal. */
  function drawOrderPreview(ctx, gameState, viewState, offsetX, offsetY, ts) {
    const orders = window.GameEngine.orders;
    const unit = viewState.selectedUnit;
    const hover = viewState.hoverTile;
    if (!orders || !hover) return;
    if (!orders.canCommand(unit, gameState, viewState.humanCivId)) return;
    if (hover.x === unit.x && hover.y === unit.y) return;

    const preview = orders.previewOrder(unit, gameState, hover.x, hover.y, viewState.humanCivId);
    const screenX = hover.x * ts + offsetX;
    const screenY = hover.y * ts + offsetY;
    const cx = screenX + ts / 2, cy = screenY + ts / 2;

    const COLORS = { attack: "#ff5c5c", move: "#7fd4f7", blocked: "#888" };
    const color = COLORS[preview.kind] || COLORS.blocked;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(screenX + 1, screenY + 1, ts - 2, ts - 2);

    if (preview.kind === "attack") {
      // Reticle + odds. The odds come from the same estimator the AI consults
      // before committing (estimateWinProbability / cityAttackWinProbability),
      // so the player is reading the engine's real assessment, not a guess.
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.30, 0, Math.PI * 2);
      ctx.stroke();
      if (preview.odds != null) {
        drawPreviewLabel(ctx, `${Math.round(preview.odds * 100)}%`, cx, screenY - 2, color);
      }
    } else if (preview.kind === "move") {
      // Spelled out rather than abbreviated ("mp") since it floats on the
      // map with nothing nearby to decode it from, unlike H/C/L which the
      // sidebar spells out elsewhere first.
      drawPreviewLabel(ctx, `${preview.cost} movement point${preview.cost === 1 ? "" : "s"}`, cx, screenY - 2, color);
    } else {
      // Blocked: a slash through the tile, plus why.
      ctx.beginPath();
      ctx.moveTo(screenX + 4, screenY + 4);
      ctx.lineTo(screenX + ts - 4, screenY + ts - 4);
      ctx.stroke();
      if (preview.reason) drawPreviewLabel(ctx, preview.reason, cx, screenY - 2, color);
    }
    ctx.restore();
  }

  /** Small pill label above a tile, used by the order preview. */
  function drawPreviewLabel(ctx, text, cx, bottomY, color) {
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const w = ctx.measureText(text).width + 8;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(cx - w / 2, bottomY - 14, w, 14);
    ctx.fillStyle = color;
    ctx.fillText(text, cx, bottomY - 2);
  }

  /**
   * Race-colored "shadow" beneath a unit -- a squashed, slightly-oversized
   * oval sitting toward the bottom of the tile, as if cast by whatever's
   * standing there, rather than a solid tint filling the whole tile. Keeps
   * the civ identifiable at a glance without obscuring the terrain or the
   * sprite drawn on top of it.
   */
  function drawUnitShadow(ctx, screenX, screenY, ts, color, scale = 1) {
    const cx = screenX + ts / 2;
    const cy = screenY + ts * 0.80;
    const radiusX = ts * 0.42 * scale;
    const radiusY = ts * 0.15 * scale;
    ctx.fillStyle = overlays.hexToRgba(color, 0.6);
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- Road overlay: draw-time compositing of rotatable stubs -------------
  // A road connects to any of the 8 neighbours that also have a road. Rather
  // than storing one baked image per connection combination (256 of them),
  // we layer three mostly-transparent stubs (assets/roads/*, see
  // tools/make-road-stubs.ps1) rotated to face each connected neighbour:
  //   road/cardinal -- centre -> edge midpoint, authored pointing EAST
  //   road/diagonal -- centre -> corner,        authored pointing NE
  //   road/hub      -- small rimless patch at centre; fills the join, and
  //                    stands alone as the "road to nowhere" when isolated
  // The stubs are rimless single-tone tan, so overlapping/adjacent pieces
  // merge seamlessly with no border seams. Rotations are only ever multiples
  // of 90 deg (a purpose-drawn diagonal art avoids any 45-deg resampling).
  const ROAD_CARDINAL_ANGLE = { e: 0, s: 90, w: 180, n: 270 };
  const ROAD_DIAGONAL_ANGLE = { ne: 0, se: 90, sw: 180, nw: 270 };

  // Shared by both the road and river overlays below -- rotates an
  // (already tile-sized) stub image around the tile's center by angleDeg.
  function drawOverlayStub(ctx, image, screenX, screenY, ts, angleDeg) {
    ctx.save();
    ctx.translate(screenX + ts / 2, screenY + ts / 2);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.drawImage(image, -ts / 2, -ts / 2, ts, ts);
    ctx.restore();
  }

  /**
   * Draws the composited road overlay for one tile. `conn` has boolean
   * n/s/e/w/ne/se/sw/nw flags for which neighbours have a road. Falls back
   * to a plain brown cross if the road art hasn't loaded yet.
   */
  function drawRoadOverlay(ctx, screenX, screenY, ts, conn) {
    const cardinal = window.UI.sprites.pick("road/cardinal");
    const diagonal = window.UI.sprites.pick("road/diagonal");
    const hub = window.UI.sprites.pick("road/hub");
    if (!cardinal || !diagonal || !hub) {
      const roadW = Math.max(2, ts * 0.18);
      ctx.fillStyle = "#8b6520";
      ctx.fillRect(screenX, screenY + (ts - roadW) / 2, ts, roadW);
      ctx.fillRect(screenX + (ts - roadW) / 2, screenY, roadW, ts);
      return;
    }
    // hub first: fills the centre join (and is the whole graphic when isolated)
    drawOverlayStub(ctx, hub.image, screenX, screenY, ts, 0);
    for (const d of ["e", "s", "w", "n"])
      if (conn[d]) drawOverlayStub(ctx, cardinal.image, screenX, screenY, ts, ROAD_CARDINAL_ANGLE[d]);
    for (const d of ["ne", "se", "sw", "nw"])
      if (conn[d]) drawOverlayStub(ctx, diagonal.image, screenX, screenY, ts, ROAD_DIAGONAL_ANGLE[d]);
  }

  /** 8-neighbour road-connection flags for tile (x,y). `hasRoadAt(tx,ty)`
   *  must bounds-check and read whichever source (live tiles vs. remembered
   *  snapshots) the caller is rendering from. */
  function roadConnections(hasRoadAt, x, y) {
    return {
      n: hasRoadAt(x, y - 1), s: hasRoadAt(x, y + 1),
      e: hasRoadAt(x + 1, y), w: hasRoadAt(x - 1, y),
      ne: hasRoadAt(x + 1, y - 1), se: hasRoadAt(x + 1, y + 1),
      sw: hasRoadAt(x - 1, y + 1), nw: hasRoadAt(x - 1, y - 1),
    };
  }

  /** Classifies a wall_section tile's ORIENTATION from its same-civ cardinal
   *  wall neighbors (map.tiles[...].structure), so wall art can connect
   *  visually with adjacent segments instead of every tile showing the same
   *  fixed diorama regardless of layout (see art style guide §13). Unlike
   *  the road/river overlays above, walls can't just rotate one stub at draw
   *  time -- a wall's art has an upright tree growing through the
   *  stonework, and rotating the whole image 90°
   *  would tip that tree onto its side. So this picks between a small set of
   *  purpose-authored full-tile variants instead of compositing rotated
   *  pieces:
   *  - "horizontal": a same-civ wall neighbor to the east and/or west only.
   *  - "vertical": a same-civ wall neighbor to the north and/or south only.
   *  - "node": neighbors on BOTH axes (a corner or junction) OR no wall
   *    neighbor at all (isolated) -- both read naturally as a reinforced
   *    strongpoint/watchtower rather than a plain straight run, so they
   *    deliberately share one variant instead of needing four more (true
   *    NE/NW/SE/SW corners) or a separate lone-segment asset. */
  function wallOrientation(map, civId, x, y) {
    const isSameCivWall = (nx, ny) => {
      if (nx < 0 || nx >= map.width || ny < 0 || ny >= map.height) return false;
      const s = map.tiles[ny * map.width + nx].structure;
      return !!s && s.id === "wall_section" && s.civId === civId;
    };
    const horiz = isSameCivWall(x + 1, y) || isSameCivWall(x - 1, y);
    const vert = isSameCivWall(x, y - 1) || isSameCivWall(x, y + 1);
    if (horiz && !vert) return "horizontal";
    if (vert && !horiz) return "vertical";
    return "node";
  }

  // --- River overlay: same draw-time compositing technique as roads, one
  // asset short. Rivers never flow diagonally (js/engine/worldgen.js
  // generateRivers only ever stamps hasRiver.n/s/e/w), so there's no
  // river/diagonal stub, and a river tile's own hasRiver flags already
  // fully describe which edges it connects to -- both banks of a shared
  // border are stamped symmetrically at generation time, so unlike roads
  // no neighbor lookup is needed here at all. Rendered UNDER roads (drawn
  // first, right after terrain) so a road crossing a river reads as
  // passing over it. See tools/make-river-stubs.ps1.
  function drawRiverOverlay(ctx, screenX, screenY, ts, hasRiver) {
    if (!hasRiver || !(hasRiver.n || hasRiver.s || hasRiver.e || hasRiver.w)) return;
    const cardinal = window.UI.sprites.pick("river/cardinal");
    const hub = window.UI.sprites.pick("river/hub");
    if (!cardinal || !hub) {
      ctx.strokeStyle = "#3a8fc9";
      ctx.lineWidth = Math.max(1, ts * 0.07);
      ctx.beginPath();
      if (hasRiver.n) { ctx.moveTo(screenX, screenY); ctx.lineTo(screenX + ts, screenY); }
      if (hasRiver.s) { ctx.moveTo(screenX, screenY + ts); ctx.lineTo(screenX + ts, screenY + ts); }
      if (hasRiver.e) { ctx.moveTo(screenX + ts, screenY); ctx.lineTo(screenX + ts, screenY + ts); }
      if (hasRiver.w) { ctx.moveTo(screenX, screenY); ctx.lineTo(screenX, screenY + ts); }
      ctx.stroke();
      return;
    }
    drawOverlayStub(ctx, hub.image, screenX, screenY, ts, 0);
    for (const d of ["e", "s", "w", "n"])
      if (hasRiver[d]) drawOverlayStub(ctx, cardinal.image, screenX, screenY, ts, ROAD_CARDINAL_ANGLE[d]);
  }

  function fullVisibilitySet(map) {
    const s = new Set();
    for (let i = 0; i < map.tiles.length; i++) s.add(i);
    return s;
  }

  /**
   * Spectator-mode visibility: no single civ's vision to render, so it's
   * driven by the Fog of War panel (Interface menu, spectator games only --
   * see main.js's setupFogControls). "off" is the traditional spectator
   * god's-eye view (whole map); "all"/"selected" instead union together the
   * real per-civ visibility sets (gameState.visibility, same data ai.js
   * itself is limited to) for every civ, or just the checked ones, so a
   * spectator can audit what a given set of civs would actually see.
   */
  function spectatorVisibilitySet(gameState, viewState) {
    const mode = viewState.fogMode || "off";
    if (mode === "off") return fullVisibilitySet(gameState.map);
    const civIds = mode === "selected"
      ? [...(viewState.fogCivIds || [])]
      : Object.keys(gameState.civs);
    const union = new Set();
    for (const civId of civIds) {
      const vis = gameState.visibility[civId];
      if (vis) for (const idx of vis) union.add(idx);
    }
    return union;
  }

  /** Spectator equivalent of gameState.explored[humanCivId] -- union of every
   *  selected civ's persistent explored set. Unused (never consulted) when
   *  fogMode is "off" since spectatorVisibilitySet already marks every tile
   *  visible in that mode. */
  function spectatorExploredSet(gameState, viewState) {
    const mode = viewState.fogMode || "off";
    if (mode === "off") return new Set();
    const civIds = mode === "selected"
      ? [...(viewState.fogCivIds || [])]
      : Object.keys(gameState.civs);
    const union = new Set();
    for (const civId of civIds) {
      const exp = gameState.explored?.[civId];
      if (exp) for (const idx of exp) union.add(idx);
    }
    return union;
  }

  /** Spectator equivalent of gameState.tileMemory[humanCivId] -- merges every
   *  selected civ's remembered-tile snapshots. Where two civs remember the
   *  same tile differently, the more recently-updated snapshot (higher
   *  turnNumber) wins, so the view always reflects the freshest information
   *  any of the selected civs actually has. */
  function spectatorMemory(gameState, viewState) {
    const mode = viewState.fogMode || "off";
    if (mode === "off") return {};
    const civIds = mode === "selected"
      ? [...(viewState.fogCivIds || [])]
      : Object.keys(gameState.civs);
    const merged = {};
    for (const civId of civIds) {
      const mem = gameState.tileMemory?.[civId];
      if (!mem) continue;
      for (const idxKey of Object.keys(mem)) {
        const entry = mem[idxKey];
        const existing = merged[idxKey];
        if (!existing || (entry.turnNumber || 0) >= (existing.turnNumber || 0)) merged[idxKey] = entry;
      }
    }
    return merged;
  }

  /**
   * Draws an explored-but-not-currently-visible tile from its remembered
   * snapshot (see turns.js's refreshVisibility) instead of live tile data --
   * terrain/road/river/resource/ruin plus a dimmed city/structure marker if
   * one was there when last observed. Never draws units (those are never
   * snapshotted -- unit positions/movement only ever render when currently
   * visible). Finished with a dark scrim so it reads as visibly "remembered,
   * possibly stale" rather than currently seen.
   */
  function drawRememberedTile(ctx, screenX, screenY, ts, snapshot, roadConn, x, y, showGrid, deferredIcons, mapSeed) {
    if (!snapshot) {
      // Explored should always have a matching memory entry, but fall back
      // to plain fog rather than throw if the two ever disagree.
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(screenX, screenY, ts, ts);
      return;
    }

    // Flat backing fill under the sprite, same seam-hiding reasoning as the
    // live render() terrain block above.
    ctx.fillStyle = window.GameData.TERRAIN[snapshot.terrain].color;
    ctx.fillRect(screenX, screenY, ts, ts);
    const terrainSprite = window.UI.sprites.pick(terrainSpriteKey(snapshot, x, y, mapSeed), snapshot);
    if (terrainSprite) {
      if (isTallTerrainSprite(terrainSprite.manifest)) {
        // Deferred + dimmed inline, same reasoning as the resource/ruin
        // icons just below: deferring avoids the clipping problem, but
        // skips the post-return dimming scrim, so the "stale memory" dim
        // is applied by hand inside the closure instead.
        const img = terrainSprite.image;
        deferredIcons.push(() => {
          const prevAlpha = ctx.globalAlpha;
          ctx.globalAlpha = prevAlpha * 0.6;
          drawTallTerrainSprite(ctx, img, screenX, screenY, ts);
          ctx.globalAlpha = prevAlpha;
        });
      } else {
        const f = window.UI.sprites.currentFrame(terrainSprite.manifest, "idle", snapshot);
        ctx.drawImage(terrainSprite.image, f.sx, f.sy, f.sw, f.sh, screenX, screenY, ts, ts);
      }
    }

    // River drawn UNDER road, same reasoning as the live render loop.
    drawRiverOverlay(ctx, screenX, screenY, ts, snapshot.hasRiver);

    if (snapshot.hasRoad) {
      drawRoadOverlay(ctx, screenX, screenY, ts, roadConn || {});
    }

    // Resource/ruin draws are deferred to the same post-grid flush pass as
    // the live tile loop (see render()'s deferredIcons), for the same
    // clipping reason -- an oversized icon here would otherwise get painted
    // over by the next tile's terrain fill. Remembered tiles get their own
    // dimming scrim drawn AFTER this function returns (see the bottom of
    // this function), which would normally darken the icon too since it was
    // drawn before the scrim -- deferring the icon draw would skip that, so
    // dim it directly via globalAlpha instead to keep the same "this is a
    // stale memory, not live" look.
    if (snapshot.resource) {
      const resSprite = window.UI.sprites.pick(`enhancement/resource_${snapshot.resource}`, snapshot);
      if (resSprite) {
        const f = window.UI.sprites.currentFrame(resSprite.manifest, "idle", snapshot);
        const resDef = window.GameData.RESOURCES[snapshot.resource];
        const iconScale = (resDef && resDef.iconScale) || 1.0;
        const sz = ts * iconScale;
        const { boxX, boxY } = tileIconBox(screenX, screenY, ts, sz, x, y);
        deferredIcons.push(() => {
          const prevAlpha = ctx.globalAlpha;
          ctx.globalAlpha = prevAlpha * 0.6;
          ctx.drawImage(resSprite.image, f.sx, f.sy, f.sw, f.sh, boxX, boxY, sz, sz);
          ctx.globalAlpha = prevAlpha;
        });
      } else {
        deferredIcons.push(() => {
          ctx.fillStyle = "#f0d060";
          ctx.beginPath();
          ctx.arc(screenX + ts * 0.75, screenY + ts * 0.25, Math.max(1.5, ts * 0.09), 0, Math.PI * 2);
          ctx.fill();
        });
      }
    }

    if (snapshot.isRuin) {
      const ruinSprite = window.UI.sprites.pick("enhancement/ruin", snapshot);
      if (ruinSprite) {
        const f = window.UI.sprites.currentFrame(ruinSprite.manifest, "idle", snapshot);
        const sz = ts * RUIN_ICON_SCALE;
        const { boxX, boxY } = tileIconBox(screenX, screenY, ts, sz, x, y);
        deferredIcons.push(() => {
          const prevAlpha = ctx.globalAlpha;
          ctx.globalAlpha = prevAlpha * 0.6;
          ctx.drawImage(ruinSprite.image, f.sx, f.sy, f.sw, f.sh, boxX, boxY, sz, sz);
          ctx.globalAlpha = prevAlpha;
        });
      } else {
        deferredIcons.push(() => {
          ctx.fillStyle = "#b08060";
          ctx.font = `${Math.max(8, ts * 0.36)}px monospace`;
          ctx.fillText("?", screenX + ts / 2 - ts * 0.11, screenY + ts / 2 + ts * 0.11);
        });
      }
    }

    // Last-known city/structure occupant -- a simplified dimmed marker, not
    // the live sprite/HP-bar treatment, since this may well be stale.
    if (snapshot.city) {
      const race = window.GameData.getRace(snapshot.city.raceId);
      const cx = screenX + ts / 2, cy = screenY + ts / 2;
      ctx.fillStyle = overlays.hexToRgba(race.color, 0.4);
      ctx.beginPath();
      ctx.arc(cx, cy, ts * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      ctx.font = `bold ${Math.max(6, ts * 0.22)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(snapshot.city.population), cx, cy);
    } else if (snapshot.structure) {
      const race = window.GameData.getRace(snapshot.structure.raceId);
      const pad = ts * 0.22;
      ctx.fillStyle = overlays.hexToRgba(race.color, 0.35);
      ctx.fillRect(screenX + pad, screenY + pad, ts - pad * 2, ts - pad * 2);
    }

    // Dimming scrim + subdued grid line -- visually distinct from a tile
    // currently in vision (which gets full brightness and a lighter grid line).
    // Grid line itself is toggleable via the Interface menu, same as the
    // live-tile grid line.
    ctx.fillStyle = "rgba(10,12,16,0.55)";
    ctx.fillRect(screenX, screenY, ts, ts);
    if (showGrid) {
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      ctx.strokeRect(screenX, screenY, ts, ts);
    }
  }

  /** Converts a screen pixel coordinate to tile (x,y), or null if out of bounds */
  function screenToTile(px, py, viewState, map) {
    const ts = TILE_SIZE * (viewState.zoomLevel || 1);
    const x = Math.floor((px + (viewState.scrollX || 0)) / ts);
    const y = Math.floor((py + (viewState.scrollY || 0)) / ts);
    if (x < 0 || x >= map.width || y < 0 || y >= map.height) return null;
    return { x, y };
  }

  /** Whether tile (x,y) currently falls within the camera viewport -- the
   *  exact same on-screen test the main draw loop (above) uses to skip
   *  rendering off-screen tiles, factored out so other systems can ask "is
   *  this actually visible right now" without duplicating the scroll/zoom/
   *  clamp math (e.g. main.js's sfx visibility gating, which skips playing a
   *  unit's sound if it's off-screen). A pure query -- unlike render(), it
   *  does NOT clamp/mutate viewState.scrollX/Y. */
  function isTileOnScreen(x, y, canvas, gameState, viewState) {
    const { map } = gameState;
    const ts = Math.round(TILE_SIZE * (viewState.zoomLevel || 1));
    const clamped = clampOffset(viewState.scrollX || 0, viewState.scrollY || 0, canvas, map, ts);
    const offsetX = -Math.round(clamped.x);
    const offsetY = -Math.round(clamped.y);
    const screenX = x * ts + offsetX;
    const screenY = y * ts + offsetY;
    return !(screenX < -ts || screenX > canvas.width || screenY < -ts || screenY > canvas.height);
  }

  /**
   * The CENTER of tile (x,y) in pixels relative to the map canvas's own top-
   * left -- the anchor a DOM overlay positioned inside .map-area needs (see
   * js/ui/ringmenu.js). Pure, like isTileOnScreen above: it does NOT clamp or
   * mutate viewState.scrollX/Y the way render() does.
   *
   * Deliberately duplicates render()'s ts/offset derivation rather than
   * inverting screenToTile, which looks like the obvious way to do this and
   * is wrong: screenToTile uses the UNROUNDED
   * tile size, while everything actually drawn uses Math.round(ts) and a
   * rounded offset (see render()'s own comment on why). At zoom 1.37 that's
   * 71.24 vs 71 px per tile -- a drift that accumulates across the map, so a
   * ring anchored from the inverse would sit visibly off the sprite it
   * belongs to. Anchor from what's drawn, not from what's hit-tested.
   *
   * Returns { x, y, ts } -- ts comes along because callers sizing themselves
   * against the tile (a ring radius, a highlight circle) all need it and
   * would otherwise recompute the same rounding a third time.
   */
  function tileCenterOnMap(x, y, canvas, gameState, viewState) {
    const ts = Math.round(TILE_SIZE * (viewState.zoomLevel || 1));
    const clamped = clampOffset(viewState.scrollX || 0, viewState.scrollY || 0, canvas, gameState.map, ts);
    return {
      x: (x + 0.5) * ts - Math.round(clamped.x),
      y: (y + 0.5) * ts - Math.round(clamped.y),
      ts,
    };
  }

  window.UI.render = {
    render, screenToTile, isTileOnScreen, tileCenterOnMap, fullVisibilitySet, getVisualPos,
    get TILE_SIZE() { return TILE_SIZE; },
    MIN_ZOOM, MAX_ZOOM,
  };
})();
