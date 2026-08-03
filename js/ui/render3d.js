/**
 * 3D MAP RENDERER (experimental, toggleable)
 * -------------------------------------------
 * WebGL alternative to render.js's flat top-down canvas view. Reads the
 * SAME gameState render.js does (no engine changes) and draws it as a
 * heightmap world: each tile is a small flat-topped plateau connected to
 * its neighbors by brief elevation steps at the edges (see buildTerrainMesh),
 * textured with a generated, non-directional material (not the game's real
 * illustrated tile art -- that art bakes in its own directional shading to
 * fake relief on a flat 2D tile, which fights real 3D lighting once draped
 * over sloped geometry). Units/cities are real sprite billboards that always
 * face the camera.
 *
 * Height comes from real classified terrain (map.tiles[i].terrain), not a
 * fake noise field -- worldgen.js only keeps the classified id per tile
 * (its raw elevation sample is discarded after classification, see
 * worldgen.js Pass 2), so height here is a BASE band per terrain type
 * (ocean/coast flat at water level, hills/mountains progressively raised),
 * not continuous elevation -- see elevationVarianceAt/v9 below for how
 * hills/mountains vary around that base instead of sitting dead flat.
 * Same "plateau + edge skirt" meshing technique validated in the standalone
 * WebGL prototype still applies on top of that.
 *
 * v1 scope: terrain (all 9 types) + city + unit billboards + orbit camera.
 * v2 adds roads and rivers as flat ground decals, using the real road/river
 * sprite art (not procedural -- these are already flat overlay stamps, not
 * full-tile relief paintings, so they don't have the terrain art's shading
 * problem) rotated per-tile the same way render.js's drawRoadOverlay/
 * drawRiverOverlay composite them, just in world space instead of on a 2D
 * canvas (see buildDecalQuad and the ROAD_CARDINAL_ANGLE/ROAD_DIAGONAL_ANGLE
 * tables, kept in exact agreement with render.js's).
 *
 * v3 adds city structures (every built building, including walls) as
 * width-driven billboards -- unlike units/cities (a fixed height, width
 * follows the art's aspect ratio), structures fit the tile's width and let
 * height bleed upward for tall art, matching render.js's own sizing formula
 * (`drawHeight = ts * (img.naturalHeight / img.naturalWidth)`). Walls use
 * the same race+orientation art selection as 2D (see the ported
 * wallOrientation), just as a billboard instead of procedural 3D geometry
 * (boxes/cylinders) -- simpler and reuses the exact same real wall art the
 * 2D view does, at the cost of not being real connected geometry.
 *
 * v4 adds click-to-select: a click (not a drag) ray-casts into the world
 * and resolves to a tile (see pickTileAtClient), then hands off to
 * input.js's own handleTileClick (exported for this reuse -- same
 * selection logic 2D uses, no duplicated game rules) so the sidebar shows
 * whatever's on that tile exactly like clicking it in 2D would. No mesh
 * intersection or depth-buffer read needed for the picking itself: since
 * every tile is still a flat plateau, the ray is tested against every
 * distinct real height present in the built map (originally just the 4
 * bands in HEIGHT_BY_TERRAIN; see v9 for why that grew to a live per-map
 * set) and only a hit landing on a tile whose real height agrees with
 * that plane counts, closest-to-camera wins -- equivalent to real depth
 * testing for this terrain shape. Note this picks by ground footprint,
 * not billboard geometry -- clicking squarely on a tall sprite that's
 * leaning toward camera can occasionally resolve to its neighbor.
 *
 * v5 adds full fog of war -- previously terrain/roads/rivers always
 * rendered the whole map regardless of exploration state (only billboards
 * were gated). Now a 1-texel-per-tile mask texture (see
 * updateFogMaskTexture), rebuilt every frame from resolveFogSets (which
 * mirrors render.js's humanCivId/spectator split exactly, including the
 * Interface menu's fog-mode selector for spectator games), drives both the
 * terrain and decal fragment shaders: never-explored tiles render as flat
 * near-black, explored-but-not-currently-visible tiles render dimmed, and
 * visible tiles render at full brightness -- the same three states 2D's
 * black-fill/remembered-scrim/live-bright convention shows. Roads/rivers
 * still build geometry from LIVE tile data every frame rather than a
 * per-civ remembered snapshot (2D's tileMemory), so a remembered-but-not-
 * visible tile's road could in principle be a turn or two stale relative
 * to what that civ last actually saw -- a minor, documented simplification,
 * not a real information leak (a road tile's presence still requires
 * having explored it at all).
 *
 * v6 adds billboard animation: getBillboardTexture now uploads a sprite's
 * FULL sheet (previously cropped to frame 0 only), and every render() call
 * resolves each billboard's CURRENT frame through sprites.js's own
 * currentFrame() state machine (same per-instance hold/play/loop timing and
 * phase-staggering 2D uses -- reused as-is, not reimplemented), remapping
 * the billboard quad's UV into that frame's sub-rect via uFrameUVMin/Max.
 * Frame Y coordinates need an explicit flip in that remap (V = 1 -
 * pixelRow/imgH) to stay consistent with UNPACK_FLIP_Y_WEBGL=true, which
 * every other texture upload in this file already relies on.
 *
 * v7 replaces wall billboards with real 3D geometry (buildWallGroup),
 * ported from the standalone WebGL prototype: straight box runs for
 * horizontal/vertical wall tiles (see the ported wallOrientation), round
 * towers for corner/junction/isolated ones, textured with the same
 * procedural stone material terrain uses for hills/mountains. Rebuilt from
 * live structure data every render() call like roads (walls can be built
 * -- and sieged down -- mid-game), and drawn through the existing
 * fog-aware terrainProg rather than a new shader, since wall geometry is
 * only ever built for tiles already confirmed visible.
 *
 * v8 replaces rivers' flat sprite-decal rendering (the v2 approach, still
 * used by roads) with a genuine second pass over the terrain height field
 * -- a flat texture stamp read fine in the old top-down 2D canvas view but
 * looks pasted-on now that the game is 3D by default, and doesn't visually
 * connect between tiles. See buildRiverNetwork/carveDepthAt/
 * buildRiverTileGrid: every river tile gets one deterministic waypoint
 * near its own center (riverWaypoint, hashed from tile index -- never
 * jittered per-viewer, so it's identical no matter which tile's geometry
 * asks for it), and connecting neighboring river tiles' waypoints with
 * straight segments builds a network that's continuous BY CONSTRUCTION --
 * two tiles sharing an edge always reference the exact same shared
 * waypoint, unlike the earlier per-tile-local-curve approach this replaced
 * (which anchored curves at each tile's own edge midpoint and only
 * approximately bridged the gap with a separate decal). Ground height at
 * any world position is then just undisturbed height minus a falloff to
 * the nearest network segment -- a pure function of world position, so a
 * river-adjacent tile's flat plateau+skirt+corner fans are replaced with
 * one unified carved grid (buildRiverTileGrid) spanning its FULL
 * footprint, not just the margin-inset interior, and two neighboring such
 * tiles evaluate identically along their shared boundary with no
 * pinning/tapering trick required. A separate static water-ribbon mesh
 * (buildRiverWaterRibbon, built once per map like the terrain itself, no
 * per-frame rebuild and no async sprite-load dependency to retry against
 * unlike the old decal system) follows the same network, one ribbon strip
 * per segment, meeting exactly at shared waypoints the same way the carve
 * does. The water shader (waterVS/waterFS) is procedural, not a texture --
 * two uTime-scrolling bands fake flow -- and is this file's first real
 * alpha-blended surface (gl.BLEND is enabled/disabled tightly around just
 * that one draw call). Roads are unaffected and keep the old flat-decal
 * technique.
 *
 * v9 adds elevation variance + snow peaks: previously every hill tile sat
 * at the exact same HILLS_HEIGHT and every mountain tile at the exact same
 * MOUNTAINS_HEIGHT, which read as one uniform plateau rather than a range.
 * See elevationVarianceAt: a hill/mountain tile now adds a small bump on
 * top of that base height, scaled by how many of its 8 neighbors are also
 * hills/mountains (mountains only count OTHER mountains; hills count either)
 * -- so a tile buried deep in a range reads taller than one at its edge.
 * Mountains get a SECOND term on top of that immediate-neighbor density:
 * mountainDepth counts how many full rings of solid mountain surround a
 * tile before hitting a non-mountain tile or the map edge (capped at
 * MOUNTAIN_DEPTH_MAX), because density alone saturates the instant all 8
 * neighbors are mountains and so can't tell a large massif's true center
 * apart from a tile just one ring in from a small cluster's edge -- both
 * read as equally "surrounded" to density, but depth keeps climbing ring
 * by ring for the real one. Deliberately NOT randomized per tile (an
 * earlier version of this added a
 * small independent hash-based jitter on top of the density term) -- that
 * made every same-terrain tile boundary a real slope discontinuity instead
 * of the flat, invisible skirt a uniform-height field used to have, which
 * under this renderer's flat (never smoothed/averaged) per-triangle normals
 * read as a field of torn-looking facets rather than rolling terrain, and
 * the random noise between neighbors swamped the one trend that's actually
 * supposed to read: taller toward a range's interior. isMountainPeak then
 * flags any mountain tile at least as tall as every neighboring mountain
 * (an isolated mountain is vacuously its own peak, and ties -- now common
 * without jitter -- both count as peaks) for a snow cap: a new per-vertex
 * aSnow attribute (0 normally, 1 on a peak tile's whole plateau+skirt, see
 * buildTerrainMesh's snowVal) blended toward white in terrainFS. Since
 * hill/mountain heights are no longer one fixed value per terrain type,
 * pickTileAtClient's ray-plane test (see the v4 note) now tests against
 * st.heightPlanes -- every distinct real height in the CURRENT map,
 * collected once in buildTerrainMesh -- instead of the static
 * HEIGHT_BY_TERRAIN table, and cellHeight/buildRiverNetwork's hcA/hcB both
 * route through the same terrainHeightAt used for meshing so units,
 * shadows, walls, and river carves/water all still sit flush on the
 * (now-bumpy) ground with no seam against it.
 *
 * This is now a fairly complete implementation of the core loop: terrain,
 * roads/rivers, structures/walls, billboard animation, full fog of war,
 * click-to-select, and orbit camera controls all work together.
 */

window.UI = window.UI || {};

(function () {
  const TILE = 1.0;
  const WATER_HEIGHT = -0.15;
  const HILLS_HEIGHT = 0.35;
  const MOUNTAINS_HEIGHT = 0.70;
  const TILE_MARGIN = 0.20;
  const TILE_BLEED = 0.006; // seam-hiding overlap, see buildTerrainMesh
  const UNIT_HEIGHT = 0.75;
  const CITY_HEIGHT = 1.15;
  const STRUCTURE_WIDTH = 0.85; // width-driven (not height-driven) to match render.js's "fits the tile, bleeds upward" sizing
  const STRUCTURE_BLEND = 0.7; // same lean-correction as cities -- structures are similarly tall/flat-faced
  const MIN_DISTANCE = 4;
  // Real 3D wall geometry (not a billboard, unlike every other structure) --
  // straight runs span a full tile edge-to-edge so neighboring segments
  // touch with no gap, corner/junction/isolated tiles get a round tower
  // instead (same WALL_RECT-per-cell scheme validated in the standalone
  // WebGL prototype, just driven by real wallOrientation() classification
  // instead of a fixed rectangle). Dimensions kept identical to the
  // prototype's tuned values.
  const WALL_HEIGHT = 0.42, WALL_THICK = 0.14;
  const WALL_TOWER_RADIUS = TILE / 2, WALL_TOWER_HEIGHT = 0.56, WALL_TOWER_SEGMENTS = 10;
  // Each decal layer gets its own tiny Y offset above the terrain surface --
  // hub/cardinal/diagonal are all full-tile quads (the real road/river art
  // is authored as full-tile stamps, not thin stubs), so at a junction tile
  // several of them are otherwise perfectly coincident and would z-fight.
  // Rivers sit below roads (see render.js: "so a road crossing a river reads
  // as passing over it").
  const ROAD_HUB_LIFT = 0.013, ROAD_CARDINAL_LIFT = 0.014, ROAD_DIAGONAL_LIFT = 0.015;
  // River carve tuning (see the v8 header comment). Numbers are chosen so
  // the trench reads as a shallow groove -- RIVER_CARVE_DEPTH is well short
  // of WATER_HEIGHT's 0.15 magnitude -- not a canyon, and RIVER_WAYPOINT_JITTER
  // stays a comfortable margin inside TILE/2 so a tile's waypoint can never
  // drift into a neighboring tile's footprint.
  const RIVER_CARVE_DEPTH = 0.06; // max dip below undisturbed height
  const RIVER_CHANNEL_HALF_WIDTH = 0.11; // flat-bottomed core half-width
  const RIVER_BANK_WIDTH = 0.09; // smoothstep ramp back to flat beyond the core
  const RIVER_WAYPOINT_JITTER = 0.15; // max drift of a river tile's waypoint from tile center
  const RIVER_GRID_N = 12; // NxN quads spanning a river-adjacent tile's FULL footprint (replaces its plateau+skirt+corner fans)
  const WATER_SURFACE_LIFT = 0.04; // water sits this far ABOVE the carved ground -- raised well up into the channel (not just a thin puddle at the very bottom) while staying under undisturbed bank height (RIVER_CARVE_DEPTH - WATER_SURFACE_LIFT = 0.02 of clearance) so it never breaches the banks
  const WATER_RIBBON_HALF_WIDTH = 0.075; // < RIVER_CHANNEL_HALF_WIDTH so water always sits over the carve's flat bottom, leaving a visible bank rim
  const WATER_MOUTH_TAPER = 0.35; // distance (from the water tile's own center) over which a river mouth's carve fades to 0 -- see buildRiverWaterRibbon
  const SHADOW_RADIUS = 0.32, SHADOW_Y_LIFT = 0.017; // above every other decal layer -- sits "on top" under the unit
  // Ground-plane overlay decals (grid/influence/aura tint -- see
  // buildGridDecalGroup/buildInfluenceDecalGroups/buildAuraDecalGroups),
  // parity with render.js's showGrid/showInfluence/aura-radius overlays.
  // Ordered bottom-to-top, all still comfortably below the road lifts above
  // so a road/river never gets tinted-over by a translucent overlay.
  const GRID_Y_LIFT = 0.010, INFLUENCE_Y_LIFT = 0.0115, AURA_Y_LIFT = 0.012;

  // Kept in exact agreement with render.js's tables of the same name --
  // both describe the same road/river stub art, just rotated in world
  // space here instead of on a 2D canvas. See buildDecalQuad for how the
  // angle is applied (matches ctx.rotate's clockwise-in-screen-space
  // convention, since world +X/+Z here map directly to screen east/south).
  const ROAD_CARDINAL_ANGLE = { e: 0, s: 90, w: 180, n: 270 };
  const ROAD_DIAGONAL_ANGLE = { ne: 0, se: 90, sw: 180, nw: 270 };

  const HEIGHT_BY_TERRAIN = {
    ocean: WATER_HEIGHT, coast: WATER_HEIGHT,
    plains: 0, forest: 0, desert: 0, swamp: 0, tundra: 0,
    hills: HILLS_HEIGHT, mountains: MOUNTAINS_HEIGHT,
  };
  const MARGIN_BY_TERRAIN = { hills: 0.25, mountains: 0.30 };
  // Elevation variance (see terrainHeightAt/v9 header note): HEIGHT_BY_TERRAIN
  // is only the BASE height for hills/mountains now -- a tile packed in with
  // more of its own kind (surrounded by other hills/mountains) reads taller
  // than an isolated one, so a range builds up toward its interior instead of
  // every tile in the band sitting at the exact same plateau height. Kept
  // well short of the gap between HILLS_HEIGHT and MOUNTAINS_HEIGHT so a
  // heavily-packed hill can never out-rise a sparse mountain.
  // Deliberately NOT randomized per-tile (an earlier version added a small
  // independent hash-based jitter on top of this) -- that made every single
  // same-terrain tile boundary a real (if tiny) slope discontinuity instead
  // of the flat, invisible skirt a uniform-height field used to have, which
  // under this renderer's flat per-triangle shading (see pushTri -- normals
  // are never smoothed/averaged across triangles) read as a field of torn-
  // looking facets rather than rolling terrain, and the random up/down
  // noise between neighbors also swamped the one trend that's supposed to
  // be visible (taller toward a range's interior). Purely density-based
  // (no jitter) keeps adjacent same-density tiles perfectly flat against
  // each other (matching the old flat look) while still trending upward
  // tile-by-tile toward a range's interior over its full width.
  // Magnitudes below are deliberately large relative to HILLS_HEIGHT/
  // MOUNTAINS_HEIGHT themselves (up to ~60-75% on top of the base) -- an
  // earlier, more conservative pass (~0.16 max either term) was correct by
  // the numbers (verified against live map data: real, monotonic height
  // growth toward a range's interior) but came out visually as a flat
  // plateau in practice anyway. At this camera's usual elevation angle, a
  // gentle rise spread tile-by-tile across a MARGIN-width skirt (see
  // MARGIN_BY_TERRAIN) reads as basically flat unless the rise per tile is
  // a decent fraction of the terrain type's OWN base height -- so these
  // are sized to be unmistakable rather than merely correct.
  const HILLS_ELEV_VARIANCE = 0.22; // max extra height a hill gains from neighboring hills/mountains
  // Mountains get TWO additive terms (see elevationVarianceAt): an immediate
  // 8-neighbor density term (like hills' -- gives even a small, shallow
  // mountain cluster some relief) PLUS a depth term (see mountainDepth) that
  // keeps climbing for tiles genuinely deep inside a large range. Density
  // alone saturates the instant all 8 neighbors are mountains, so it can't
  // tell a true massif's center apart from a tile just one ring in from the
  // edge of a small blob -- both read as equally "surrounded". Depth (how
  // many full rings of solid mountain surround a tile before hitting a
  // non-mountain or the map edge) keeps growing ring by ring instead, so a
  // real center outranks a shallow one. Capped at MOUNTAIN_DEPTH_MAX rings
  // so an arbitrarily huge range doesn't grow arbitrarily tall -- 3 (not 4)
  // because real generated ranges rarely go deeper than that (verified: the
  // largest range on a real generated map topped out at depth 3), so a
  // lower cap means genuinely large ranges actually reach their full bonus
  // instead of asymptotically approaching it.
  const MOUNTAINS_ELEV_VARIANCE = 0.18; // max extra height from immediate 8-neighbor density
  // Verified directly against the running mesh-building code (via a
  // temporary debug hook into terrainHeightAt, since removed): a real
  // 47-tile range's shell sat at 0.79 and its depth-2 interior at 1.11 with
  // this term at 0.35 -- a real, correctly-computed 41% rise. Even so it
  // read as visually flat in-game: a 0.3-unit rise spread over several
  // tiles is gentle enough, and generated ranges rarely reach even
  // MOUNTAIN_DEPTH_MAX rings deep, that it doesn't register against a
  // busy rock texture. Raised well past "correct" into "unmistakable" --
  // confirmed visually afterward: a real depth-3 range (114 tiles) now
  // reads as a genuine raised massif with a cliff-like edge, snow cap
  // sitting at its highest, most central point.
  const MOUNTAINS_DEPTH_BONUS = 0.70; // max extra height from being deep inside a large range -- the dominant term, since this is specifically the "center of the range" signal
  const MOUNTAIN_DEPTH_MAX = 3; // rings of solid mountain before the depth bonus caps out

  // ---------- math helpers (column-major mat4), same as the WebGL prototype ----------
  function mat4Perspective(fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    const m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f;
    m[10] = (far + near) / (near - far); m[11] = -1;
    m[14] = (2 * far * near) / (near - far);
    return m;
  }
  function sub(a, b) { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
  function cross(a, b) { return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]; }
  function dot(a, b) { return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
  function norm(a) { const l = Math.hypot(a[0],a[1],a[2]) || 1; return [a[0]/l, a[1]/l, a[2]/l]; }
  function mix3(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
  // edge0 may be > edge1 (a descending falloff) -- t still clamps to [0,1]
  // and interpolates correctly in either direction, same as GLSL's smoothstep.
  function smoothstep(edge0, edge1, x) {
    if (edge0 === edge1) return x < edge0 ? 0 : 1;
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }
  function mat4LookAt(eye, target, up) {
    const z = norm(sub(eye, target));
    const x = norm(cross(up, z));
    const y = cross(z, x);
    const m = new Float32Array(16);
    m[0]=x[0]; m[1]=y[0]; m[2]=z[0]; m[3]=0;
    m[4]=x[1]; m[5]=y[1]; m[6]=z[1]; m[7]=0;
    m[8]=x[2]; m[9]=y[2]; m[10]=z[2]; m[11]=0;
    m[12]=-dot(x,eye); m[13]=-dot(y,eye); m[14]=-dot(z,eye); m[15]=1;
    return m;
  }
  function mat4Multiply(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let s = 0;
        for (let k = 0; k < 4; k++) s += a[k*4+row] * b[col*4+k];
        out[col*4+row] = s;
      }
    }
    return out;
  }

  // ---------- procedural, non-directional material textures (one per real
  // terrain type, built once and reused across every game/map) ----------
  function makeMaterialCanvas(size, base, blotchA, blotchB, speckColor, lineColor, lineCount) {
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgb(" + base.join(",") + ")";
    ctx.fillRect(0, 0, size, size);
    let i, x, y, r;
    for (i = 0; i < 90; i++) {
      x = Math.random()*size; y = Math.random()*size; r = 8+Math.random()*20;
      ctx.globalAlpha = 0.10 + Math.random()*0.14;
      ctx.fillStyle = "rgb(" + blotchA.join(",") + ")";
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }
    for (i = 0; i < 90; i++) {
      x = Math.random()*size; y = Math.random()*size; r = 6+Math.random()*16;
      ctx.globalAlpha = 0.10 + Math.random()*0.14;
      ctx.fillStyle = "rgb(" + blotchB.join(",") + ")";
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 1;
    for (i = 0; i < lineCount; i++) {
      ctx.globalAlpha = 0.2 + Math.random()*0.3;
      const x1 = Math.random()*size, y1 = Math.random()*size;
      const ang = Math.random()*Math.PI*2, len = 4+Math.random()*14;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1+Math.cos(ang)*len, y1+Math.sin(ang)*len);
      ctx.stroke();
    }
    ctx.fillStyle = speckColor;
    for (i = 0; i < 700; i++) {
      x = Math.random()*size; y = Math.random()*size;
      ctx.globalAlpha = 0.15 + Math.random()*0.3;
      ctx.fillRect(x, y, 1.3, 1.3);
    }
    ctx.globalAlpha = 1;
    return c;
  }
  const MATERIAL_PALETTES = {
    ocean:     [[28,63,94],    [45,90,120],   [18,40,64],   "rgba(255,255,255,0.12)", "rgba(140,180,200,0.25)", 60],
    coast:     [[58,111,143],  [110,160,180], [75,125,120], "rgba(255,255,255,0.20)", "rgba(200,220,225,0.30)", 50],
    plains:    [[155,179,91],  [175,195,110], [125,150,70], "rgba(70,90,40,0.40)",    "rgba(100,120,60,0.30)",  30],
    forest:    [[63,107,63],   [85,130,80],   [40,75,42],   "rgba(20,35,18,0.50)",    "rgba(30,55,28,0.40)",    45],
    desert:    [[203,184,120], [222,205,150], [175,150,95], "rgba(140,115,70,0.35)",  "rgba(180,160,110,0.30)", 55],
    swamp:     [[83,107,77],   [100,120,80],  [55,70,48],   "rgba(25,30,18,0.50)",    "rgba(60,75,45,0.35)",    35],
    tundra:    [[196,205,209], [215,220,222], [165,172,175],"rgba(140,148,150,0.30)", "rgba(180,188,190,0.30)", 25],
    mountains: [[107,107,112], [135,128,118], [78,78,84],   "rgba(15,15,18,0.6)",     "rgba(40,40,45,0.55)",    70],
    hills:     [[160,139,95],  [126,138,86],  [176,156,110],"rgba(40,70,25,0.55)",    "rgba(90,80,50,0.4)",     40],
  };

  // ---------- shaders ----------
  // Fog of war: uFogTex is a 1-texel-per-tile mask (see updateFogMaskTexture)
  // sampled by both terrain and decals to hide/dim tiles exactly like
  // render.js's black-fill/dimmed-remembered/live-bright three states.
  // NEAREST-filtered so a fragment always reads its OWN tile's state, never
  // blended with a neighbor's across the tile boundary. World position maps
  // to map UV directly (vMapUV = aPos.xz / mapSize + 0.5) rather than
  // needing a dedicated per-vertex attribute, since every vertex already
  // carries its true world position.
  const FOG_GLSL_FS =
    "uniform sampler2D uFogTex;\n" +
    "varying vec2 vMapUV;\n" +
    "float fogFactor() {\n" +
    "  float f = texture2D(uFogTex, vMapUV).r;\n" +
    "  if (f < 0.2) return -1.0;\n" + // never explored -- caller discards or flat-fills
    "  if (f < 0.6) return 0.35;\n" + // explored, not currently visible -- dimmed
    "  return 1.0;\n" + // currently visible -- full bright
    "}\n";
  const terrainVS =
    "attribute vec3 aPos;\n" +
    "attribute vec3 aNormal;\n" +
    "attribute vec2 aUV;\n" +
    "attribute float aSnow;\n" +
    "uniform mat4 uViewProj;\n" +
    "uniform vec3 uLightDir;\n" +
    "uniform vec2 uMapSize;\n" +
    "varying vec2 vUV;\n" +
    "varying float vLight;\n" +
    "varying vec2 vMapUV;\n" +
    "varying float vSnow;\n" +
    "void main() {\n" +
    "  float diff = max(dot(normalize(aNormal), normalize(uLightDir)), 0.0);\n" +
    "  vLight = min(0.55 + diff * 0.55, 1.0);\n" +
    "  vUV = aUV;\n" +
    "  vSnow = aSnow;\n" +
    "  vMapUV = vec2(aPos.x / uMapSize.x + 0.5, aPos.z / uMapSize.y + 0.5);\n" +
    "  gl_Position = uViewProj * vec4(aPos, 1.0);\n" +
    "}\n";
  const terrainFS =
    "precision mediump float;\n" +
    "uniform sampler2D uTex;\n" +
    // Shares the SAME location as terrainVS's own uMapSize (WebGL merges a
    // uniform declared in both stages of one program into a single slot),
    // so no extra JS-side upload is needed -- reused here purely to hash a
    // stable per-TILE seed (see tileIndex below) for the snow patch's
    // wobble, unrelated to its original job feeding vMapUV. Precision must
    // match the vertex shader's (implicitly highp there, since vertex
    // shaders default to highp) or linking fails.
    "uniform highp vec2 uMapSize;\n" +
    "varying vec2 vUV;\n" +
    "varying float vLight;\n" +
    "varying float vSnow;\n" +
    FOG_GLSL_FS +
    "void main() {\n" +
    "  float fog = fogFactor();\n" +
    "  if (fog < 0.0) { gl_FragColor = vec4(0.06, 0.06, 0.07, 1.0); return; }\n" +
    // Mountain peaks (see isMountainPeak) get a snow cap: a solid white
    // patch confined to the middle of the tile (vUV is the fragment's own
    // position local to its tile, see pushTri) fading into the ordinary
    // rock texture toward the edges -- not a uniform white tint over the
    // whole tile, so a peak reads as "mountain texture with snow on top",
    // not "a white tile". The patch's outer edge is angle-wobbled -- four
    // sine harmonics (frequencies 2/5/9/13, deliberately not a clean
    // low-order sequence like 3/5/7) each at their OWN independently-hashed
    // phase AND amplitude -- rather than a perfect circle, so it reads as
    // an irregular, jagged snowcap radiating outward from the tile's
    // center instead of a uniform disc. An earlier version shared one
    // phase across all three harmonics with amplitude dominated by the
    // lowest frequency, which just rotated the same clean 3-lobed
    // "pinwheel" shape per tile rather than actually varying its
    // raggedness -- independent hashes per harmonic (see seed/seedB/
    // seedC/seedD, all from the tile's own integer index via
    // vMapUV*uMapSize) make every peak's silhouette genuinely different,
    // not just a rotated copy of the same one.
    "  vec3 texColor = texture2D(uTex, vUV).rgb;\n" +
    "  vec3 snowColor = vec3(0.98, 0.99, 1.0);\n" +
    "  vec2 tileIndex = floor(vMapUV * uMapSize);\n" +
    "  float seed  = fract(sin(dot(tileIndex, vec2(12.9898, 78.233))) * 43758.5453);\n" +
    "  float seedB = fract(sin(dot(tileIndex, vec2(39.346, 11.135))) * 24634.6345);\n" +
    "  float seedC = fract(sin(dot(tileIndex, vec2(73.156, 52.235))) * 12765.3421);\n" +
    "  float seedD = fract(sin(dot(tileIndex, vec2(21.233, 66.123))) * 31415.9265);\n" +
    "  vec2 delta = vUV - vec2(0.5, 0.5);\n" +
    "  float distFromCenter = length(delta);\n" +
    "  float angle = atan(delta.y, delta.x);\n" +
    "  float wobble = sin(angle * 2.0  + seed  * 6.2831853) * (0.015 + seedB * 0.025)\n" +
    "               + sin(angle * 5.0  + seedB * 6.2831853) * (0.012 + seedC * 0.018)\n" +
    "               + sin(angle * 9.0  + seedC * 6.2831853) * (0.006 + seedD * 0.014)\n" +
    "               + sin(angle * 13.0 + seedD * 6.2831853) * (0.004 + seed  * 0.008);\n" +
    "  float edgeDist = distFromCenter - wobble;\n" +
    "  float snowPatch = (1.0 - smoothstep(0.05, 0.20, edgeDist)) * vSnow;\n" +
    "  vec3 baseColor = mix(texColor, snowColor, snowPatch);\n" +
    "  gl_FragColor = vec4(baseColor * vLight * fog, 1.0);\n" +
    "}\n";
  const billboardVS =
    "attribute vec3 aCenter;\n" +
    "attribute vec2 aOffset;\n" +
    "attribute vec2 aUV;\n" +
    "uniform mat4 uViewProj;\n" +
    "uniform vec3 uRight;\n" +
    "uniform vec3 uUp;\n" +
    // The quad's own UVs always span the full 0..1 unit square (see
    // makeBillboardVbo) -- uFrameUVMin/Max remap that into whichever
    // sub-rect of the real (possibly multi-frame) sprite sheet is the
    // CURRENT animation frame, computed in JS every render() call via
    // sprites.js's own currentFrame() state machine (see collectBillboards),
    // reused as-is rather than re-implemented here.
    "uniform vec2 uFrameUVMin;\n" +
    "uniform vec2 uFrameUVMax;\n" +
    "varying vec2 vUV;\n" +
    "void main() {\n" +
    "  vec3 worldPos = aCenter + uRight * aOffset.x + uUp * aOffset.y;\n" +
    "  vUV = uFrameUVMin + aUV * (uFrameUVMax - uFrameUVMin);\n" +
    "  gl_Position = uViewProj * vec4(worldPos, 1.0);\n" +
    "}\n";
  const billboardFS =
    "precision mediump float;\n" +
    "uniform sampler2D uTex;\n" +
    "varying vec2 vUV;\n" +
    "void main() {\n" +
    "  vec4 c = texture2D(uTex, vUV);\n" +
    "  if (c.a < 0.5) discard;\n" +
    "  gl_FragColor = vec4(c.rgb, 1.0);\n" +
    "}\n";
  // 0 = full spherical (always face-on), 1 = fully upright (cylindrical) --
  // see the WebGL prototype's billboard comment for why this is blended as
  // an axis vector rather than a per-vertex position correction (the latter
  // is unbounded and can invert the geometry at steep top-down angles).
  const UNIT_BLEND = 0.4, CITY_BLEND = 0.7;

  // Flat ground decal (roads/rivers): plain textured quad at a fixed world
  // position, unlit (matches how the 2D view draws these -- a flat overlay
  // stamp on top of already-lit terrain, not its own lit surface), with the
  // same alpha-discard cutout as billboards for a hard stamp edge.
  const decalVS =
    "attribute vec3 aPos;\n" +
    "attribute vec2 aUV;\n" +
    "uniform mat4 uViewProj;\n" +
    "uniform vec2 uMapSize;\n" +
    "varying vec2 vUV;\n" +
    "varying vec2 vMapUV;\n" +
    "void main() {\n" +
    "  vUV = aUV;\n" +
    "  vMapUV = vec2(aPos.x / uMapSize.x + 0.5, aPos.z / uMapSize.y + 0.5);\n" +
    "  gl_Position = uViewProj * vec4(aPos, 1.0);\n" +
    "}\n";
  const decalFS =
    "precision mediump float;\n" +
    "uniform sampler2D uTex;\n" +
    "varying vec2 vUV;\n" +
    FOG_GLSL_FS +
    "void main() {\n" +
    "  float fog = fogFactor();\n" +
    "  if (fog < 0.0) discard;\n" +
    "  vec4 c = texture2D(uTex, vUV);\n" +
    "  if (c.a < 0.5) discard;\n" +
    "  gl_FragColor = vec4(c.rgb * fog, 1.0);\n" +
    "}\n";

  // Ground-plane TINT overlay (grid/influence/aura -- see
  // buildGridDecalGroup/buildInfluenceDecalGroups/buildAuraDecalGroups):
  // genuinely translucent, unlike decalFS's hard alpha-discard cutout
  // above (a stamped-on road/river stub is either "there" or "not", never
  // partially see-through). Shares decalVS exactly (same aPos/aUV -> vUV/
  // vMapUV, aUV just goes unused when the mask texture is a flat fill) --
  // the texture supplies a grayscale MASK shape only (grid: a thin border;
  // solid fill: fully opaque; hatch: diagonal stripes), and color/opacity
  // come from uColor/uAlpha uniforms instead of being baked in, so one
  // shared mask texture per shape serves every civ's color. This is the
  // file's second real alpha-blended draw (see waterFS/render()'s
  // tightly-scoped gl.enable(BLEND) for the first, and the same pattern
  // reused for this one).
  const tintFS =
    "precision mediump float;\n" +
    "uniform sampler2D uTex;\n" +
    "uniform vec3 uColor;\n" +
    "uniform float uAlpha;\n" +
    "varying vec2 vUV;\n" +
    FOG_GLSL_FS +
    "void main() {\n" +
    "  float fog = fogFactor();\n" +
    "  if (fog < 0.0) discard;\n" +
    "  float mask = texture2D(uTex, vUV).a;\n" +
    "  if (mask < 0.01) discard;\n" +
    "  gl_FragColor = vec4(uColor * fog, mask * uAlpha);\n" +
    "}\n";

  // River water surface (see buildRiverWaterRibbon): procedural, not a
  // texture -- matches this file's "material not picture" philosophy for
  // terrain (see MATERIAL_PALETTES) -- and this file's first real
  // alpha-blended draw (see render()'s tightly-scoped gl.enable(BLEND)).
  // aSide is -1..+1 across the ribbon's width (soft edge fade instead of a
  // hard alpha-discard cutout). No flow-direction attribute: an earlier
  // version scrolled bands along cumulative arc-length, but that length
  // was ordered by tile-scan order, not by actual downstream direction, so
  // it visibly flowed backwards on some segments -- the position-based
  // shimmer below has no notion of "direction" at all, sidestepping that.
  const waterVS =
    "attribute vec3 aPos;\n" +
    "attribute float aSide;\n" +
    "uniform mat4 uViewProj;\n" +
    "uniform vec2 uMapSize;\n" +
    "varying float vSide;\n" +
    "varying vec2 vMapUV;\n" +
    "void main() {\n" +
    "  vSide = aSide;\n" +
    "  vMapUV = vec2(aPos.x / uMapSize.x + 0.5, aPos.z / uMapSize.y + 0.5);\n" +
    "  gl_Position = uViewProj * vec4(aPos, 1.0);\n" +
    "}\n";
  const waterFS =
    "precision mediump float;\n" +
    "uniform float uTime;\n" +
    "varying float vSide;\n" +
    FOG_GLSL_FS +
    "void main() {\n" +
    "  float fog = fogFactor();\n" +
    "  if (fog < 0.0) discard;\n" +
    // Subtle shimmer: a slow, non-directional sparkle pattern in world
    // (map-UV) space -- two crossed sine waves sharpened into sparse bright
    // points via a steep smoothstep, so it reads as light glinting off the
    // surface rather than a moving current.
    "  float n = sin(vMapUV.x * 140.0 + uTime * 0.35) * sin(vMapUV.y * 120.0 - uTime * 0.28);\n" +
    "  float shimmer = smoothstep(0.82, 1.0, n * 0.5 + 0.5);\n" +
    // Coast palette base/blotchA (see MATERIAL_PALETTES.coast) so the
    // water reads as the same "water" color family the style guide already
    // uses for river/coast, not an arbitrary blue.
    "  vec3 base = vec3(0.227, 0.435, 0.561);\n" +
    "  vec3 hi = vec3(0.431, 0.627, 0.706);\n" +
    "  vec3 rgb = mix(base, hi, shimmer * 0.4) * fog;\n" +
    "  float edgeFade = smoothstep(1.0, 0.55, abs(vSide));\n" +
    "  gl_FragColor = vec4(rgb, 0.62 * edgeFade);\n" +
    "}\n";

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function link(gl, vsSrc, fsSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }

  // Per-canvas render state (gl context, programs, buffers, camera). Keyed
  // off the canvas element so a second call with the same canvas reuses it.
  let state = null;

  function ensureInit(canvas) {
    if (state && state.canvas === canvas) return state;
    const gl = canvas.getContext("webgl", { antialias: true, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error("WebGL is not available in this browser.");
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    // Default UNPACK_ALIGNMENT is 4 bytes: WebGL assumes each row of a
    // raw-array texture upload starts at a 4-byte-aligned offset unless
    // told otherwise, silently padding/misreading any row whose width
    // isn't a multiple of 4. The only raw-array upload in this file is the
    // fog mask (updateFogMaskTexture, one byte per texel, width = map.width
    // which is NOT guaranteed to be a multiple of 4 -- real maps run
    // 52-80 tiles wide) -- without this, the mask silently reads corrupted/
    // shifted data on any map whose width isn't a multiple of 4. Canvas/
    // Image-sourced uploads (terrain materials, sprites) are unaffected by
    // this setting, so it's safe to leave on globally rather than toggling
    // it per-upload.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.56, 0.65, 0.74, 1.0);

    const terrainProg = link(gl, terrainVS, terrainFS);
    const billboardProg = link(gl, billboardVS, billboardFS);
    const decalProg = link(gl, decalVS, decalFS);
    const waterProg = link(gl, waterVS, waterFS);
    const tintProg = link(gl, decalVS, tintFS); // shares decalVS -- see tintFS's own comment

    state = {
      canvas, gl, terrainProg, billboardProg, decalProg, waterProg, tintProg,
      tStride: 9 * 4,
      t_aPos: gl.getAttribLocation(terrainProg, "aPos"),
      t_aNormal: gl.getAttribLocation(terrainProg, "aNormal"),
      t_aUV: gl.getAttribLocation(terrainProg, "aUV"),
      t_aSnow: gl.getAttribLocation(terrainProg, "aSnow"),
      t_uViewProj: gl.getUniformLocation(terrainProg, "uViewProj"),
      t_uLightDir: gl.getUniformLocation(terrainProg, "uLightDir"),
      t_uTex: gl.getUniformLocation(terrainProg, "uTex"),
      t_uMapSize: gl.getUniformLocation(terrainProg, "uMapSize"),
      t_uFogTex: gl.getUniformLocation(terrainProg, "uFogTex"),
      b_aCenter: gl.getAttribLocation(billboardProg, "aCenter"),
      b_aOffset: gl.getAttribLocation(billboardProg, "aOffset"),
      b_aUV: gl.getAttribLocation(billboardProg, "aUV"),
      b_uViewProj: gl.getUniformLocation(billboardProg, "uViewProj"),
      b_uRight: gl.getUniformLocation(billboardProg, "uRight"),
      b_uUp: gl.getUniformLocation(billboardProg, "uUp"),
      b_uTex: gl.getUniformLocation(billboardProg, "uTex"),
      b_uFrameUVMin: gl.getUniformLocation(billboardProg, "uFrameUVMin"),
      b_uFrameUVMax: gl.getUniformLocation(billboardProg, "uFrameUVMax"),
      d_aPos: gl.getAttribLocation(decalProg, "aPos"),
      d_aUV: gl.getAttribLocation(decalProg, "aUV"),
      d_uViewProj: gl.getUniformLocation(decalProg, "uViewProj"),
      d_uTex: gl.getUniformLocation(decalProg, "uTex"),
      d_uMapSize: gl.getUniformLocation(decalProg, "uMapSize"),
      d_uFogTex: gl.getUniformLocation(decalProg, "uFogTex"),
      tint_aPos: gl.getAttribLocation(tintProg, "aPos"),
      tint_aUV: gl.getAttribLocation(tintProg, "aUV"),
      tint_uViewProj: gl.getUniformLocation(tintProg, "uViewProj"),
      tint_uTex: gl.getUniformLocation(tintProg, "uTex"),
      tint_uMapSize: gl.getUniformLocation(tintProg, "uMapSize"),
      tint_uFogTex: gl.getUniformLocation(tintProg, "uFogTex"),
      tint_uColor: gl.getUniformLocation(tintProg, "uColor"),
      tint_uAlpha: gl.getUniformLocation(tintProg, "uAlpha"),
      w_aPos: gl.getAttribLocation(waterProg, "aPos"),
      w_aSide: gl.getAttribLocation(waterProg, "aSide"),
      w_uViewProj: gl.getUniformLocation(waterProg, "uViewProj"),
      w_uMapSize: gl.getUniformLocation(waterProg, "uMapSize"),
      w_uTime: gl.getUniformLocation(waterProg, "uTime"),
      w_uFogTex: gl.getUniformLocation(waterProg, "uFogTex"),
      terrainTextures: {}, // terrainId -> WebGLTexture, built once
      billboardTexCache: new WeakMap(), // Image -> {tex, aspect, bottomPadFrac}
      terrainDrawGroups: [],
      heightPlanes: null, // real per-tile heights present in the built map -- see pickTileAtClient
      riverWaterGroup: null, // static once built -- see buildRiverWaterRibbon
      builtForMap: null,
      mapWidth: 0, mapHeight: 0,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
      fogTexture: gl.createTexture(),
      fogTexW: 0, fogTexH: 0, // texel dims currently allocated -- see updateFogMaskTexture
    };
    buildTerrainTextures(state);
    {
      const gl2 = state.gl;
      gl2.bindTexture(gl2.TEXTURE_2D, state.fogTexture);
      gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_S, gl2.CLAMP_TO_EDGE);
      gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_WRAP_T, gl2.CLAMP_TO_EDGE);
      gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MIN_FILTER, gl2.NEAREST);
      gl2.texParameteri(gl2.TEXTURE_2D, gl2.TEXTURE_MAG_FILTER, gl2.NEAREST);
    }
    attachControls(canvas);
    return state;
  }

  function buildTerrainTextures(st) {
    const gl = st.gl;
    for (const id of Object.keys(MATERIAL_PALETTES)) {
      const [base, ba, bb, speck, line, lineCount] = MATERIAL_PALETTES[id];
      const canvasTex = makeMaterialCanvas(128, base, ba, bb, speck, line, lineCount);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvasTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      st.terrainTextures[id] = tex;
    }
    // Stone material for wall geometry -- same generator, same "material,
    // not a picture" reasoning as terrain, so real lighting on the box/
    // cylinder shapes does the shape-telling.
    const wallCanvas = makeMaterialCanvas(128, [150,148,145], [172,169,163], [110,108,106], "rgba(60,58,55,0.5)", "rgba(70,68,64,0.6)", 110);
    const wallTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, wallTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, wallCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    st.wallTexture = wallTex;
  }

  function worldX(st, tx) { return (tx - st.mapWidth / 2) * TILE; }
  function worldZ(st, tz) { return (tz - st.mapHeight / 2) * TILE; }

  // ---------- terrain mesh: each tile is a flat-topped plateau, its outer
  // margin stepping down/up to meet neighbors -- see the WebGL prototype's
  // buildTileGeometry comment for the watertight-seam proof (every step
  // height is the average of the tile's own flat height and its neighbor's,
  // computed identically from both sides of a shared boundary). ----------
  // ---------- shared math/height helpers (module scope so both
  // buildTerrainMesh and the river-carve/water-ribbon builders below use
  // the identical logic -- see the v8 header comment) ----------
  // ---------- elevation variance + snow peaks (v9, see header note): hills/
  // mountains no longer sit at one exact plateau height per terrain type --
  // see HILLS_ELEV_VARIANCE/MOUNTAINS_ELEV_VARIANCE above for why (and for
  // why this is purely neighbor-density-based, no per-tile random jitter). ----------
  function isHillOrMountain(terrain) { return terrain === "hills" || terrain === "mountains"; }
  function neighborMatchCount(map, cx, cz, matchFn) {
    let n = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nx >= map.width || nz < 0 || nz >= map.height) continue;
        if (matchFn(map.tiles[nz * map.width + nx].terrain)) n++;
      }
    }
    return n;
  }
  /** True only if every tile in the (2r+1)x(2r+1) square centered at
   *  (cx,cz) is "mountains" AND in-bounds (off-map counts as non-mountain,
   *  so a range against the map edge tapers the same way it would against
   *  open ground) -- see mountainDepth, the only caller. */
  function isFullMountainSquare(map, cx, cz, r) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nx >= map.width || nz < 0 || nz >= map.height) return false;
        if (map.tiles[nz * map.width + nx].terrain !== "mountains") return false;
      }
    }
    return true;
  }
  /** How many full rings of solid mountain surround (cx,cz) before hitting
   *  a non-mountain tile or the map edge, capped at MOUNTAIN_DEPTH_MAX --
   *  0 for any tile on the shell of its cluster (at least one non-mountain
   *  neighbor within the very first ring), climbing by 1 for each further
   *  ring that's still entirely mountain. See elevationVarianceAt for why
   *  this (not just immediate-neighbor density) is needed to make a large
   *  range's true center outrank its shallower interior. */
  function mountainDepth(map, cx, cz) {
    let depth = 0;
    for (let r = 1; r <= MOUNTAIN_DEPTH_MAX; r++) {
      if (!isFullMountainSquare(map, cx, cz, r)) break;
      depth = r;
    }
    return depth;
  }
  function elevationVarianceAt(map, cx, cz, terrain) {
    if (terrain === "hills") {
      const n = neighborMatchCount(map, cx, cz, isHillOrMountain);
      return (n / 8) * HILLS_ELEV_VARIANCE;
    }
    if (terrain === "mountains") {
      const n = neighborMatchCount(map, cx, cz, (t) => t === "mountains");
      const depth = mountainDepth(map, cx, cz);
      return (n / 8) * MOUNTAINS_ELEV_VARIANCE + (depth / MOUNTAIN_DEPTH_MAX) * MOUNTAINS_DEPTH_BONUS;
    }
    return 0;
  }
  function terrainHeightAt(map, cx, cz) {
    cx = Math.max(0, Math.min(map.width - 1, cx));
    cz = Math.max(0, Math.min(map.height - 1, cz));
    const terrain = map.tiles[cz * map.width + cx].terrain;
    return (HEIGHT_BY_TERRAIN[terrain] ?? 0) + elevationVarianceAt(map, cx, cz, terrain);
  }
  /** A tile's own flat height plus every neighbor-averaged edge/corner
   *  height and margin fraction its plateau+skirt fan (or, for a
   *  river-adjacent tile, buildRiverTileGrid's carved grid) needs --
   *  factored out so buildTerrainMesh's tile loop and the water ribbon
   *  (see buildRiverWaterRibbon) compute the exact same ground shape from
   *  the same source instead of two independently-written formulas that
   *  could quietly drift apart. */
  function tileShapeAt(map, tx, tz) {
    const hcAt = (cx, cz) => terrainHeightAt(map, cx, cz);
    const hc = hcAt(tx, tz);
    const terrainId = map.tiles[tz * map.width + tx].terrain;
    return {
      hc,
      mFrac: (MARGIN_BY_TERRAIN[terrainId] || TILE_MARGIN) / TILE,
      bN: (hc + hcAt(tx,tz-1)) / 2,
      bS: (hc + hcAt(tx,tz+1)) / 2,
      bW: (hc + hcAt(tx-1,tz)) / 2,
      bE: (hc + hcAt(tx+1,tz)) / 2,
      bNW: (hc + hcAt(tx,tz-1) + hcAt(tx-1,tz) + hcAt(tx-1,tz-1)) / 4,
      bNE: (hc + hcAt(tx,tz-1) + hcAt(tx+1,tz) + hcAt(tx+1,tz-1)) / 4,
      bSE: (hc + hcAt(tx,tz+1) + hcAt(tx+1,tz) + hcAt(tx+1,tz+1)) / 4,
      bSW: (hc + hcAt(tx,tz+1) + hcAt(tx-1,tz) + hcAt(tx-1,tz+1)) / 4,
    };
  }
  /** A mountain tile is a "peak" (gets a snow cap, see buildTerrainMesh's
   *  snowVal) if it's at least as tall as every neighboring MOUNTAIN tile --
   *  non-mountain neighbors (hills, plains, ...) aren't peers and don't
   *  count. Ties both cap (a ridgeline reads more natural than one arbitrary
   *  winner among equally-dense neighbors). An isolated mountain with no
   *  mountain neighbors is vacuously its own peak. */
  function isMountainPeak(map, cx, cz) {
    const h = terrainHeightAt(map, cx, cz);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nx >= map.width || nz < 0 || nz >= map.height) continue;
        if (map.tiles[nz * map.width + nx].terrain !== "mountains") continue;
        if (terrainHeightAt(map, nx, nz) > h) return false;
      }
    }
    return true;
  }
  function pushTri(g, p0, p1, p2, x0, z0, snow) {
    let n = norm(cross(sub(p1,p0), sub(p2,p0)));
    if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
    g.positions.push(p0[0],p0[1],p0[2], p1[0],p1[1],p1[2], p2[0],p2[1],p2[2]);
    g.normals.push(n[0],n[1],n[2], n[0],n[1],n[2], n[0],n[1],n[2]);
    g.uvs.push(p0[0]-x0, p0[2]-z0, p1[0]-x0, p1[2]-z0, p2[0]-x0, p2[2]-z0);
    const s = snow || 0;
    g.snow.push(s, s, s);
  }

  // ---------- river carving: a genuine second pass over the terrain height
  // field, not a decal. Two tiles that share a river edge each derive a
  // "waypoint" purely from their OWN tile index (see riverHash) -- since
  // both tiles reference the exact same waypoint for a shared tile, a
  // network of straight segments built by connecting neighboring tiles'
  // waypoints is continuous by construction, with no taper/bridging trick
  // needed to hide a seam (contrast the earlier per-tile-local-curve
  // approach this replaced, see the v8 header comment). Ground height at
  // any world (x,z) is then just undisturbed-height minus a smoothstep
  // falloff to the nearest network segment -- a pure function of world
  // position, so two neighboring tiles evaluating it at their shared
  // boundary always agree exactly, whether that point is deep in one
  // tile's "interior" or out in its margin/skirt band. See
  // buildRiverTileGrid for how this replaces the flat plateau+skirt+corner
  // fans for any tile near a river; tiles with nothing nearby keep the
  // original cheap fan path in buildTerrainMesh untouched. ----------
  function riverHash(tx, tz, salt) {
    let h = (tx * 374761393 + tz * 668265263 + salt * 2246822519) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    h = h ^ (h >>> 16);
    return ((h >>> 0) % 100000) / 100000;
  }
  // Deterministic point near a tile's center, jittered enough that
  // connecting consecutive tiles' waypoints reads as a gentle meander, but
  // bounded well inside TILE/2 so it can never drift into a neighboring
  // tile's own footprint.
  function riverWaypoint(st, tx, tz) {
    const cx = worldX(st, tx) + TILE / 2, cz = worldZ(st, tz) + TILE / 2;
    const wx = (riverHash(tx, tz, 11) - 0.5) * 2 * RIVER_WAYPOINT_JITTER;
    const wz = (riverHash(tx, tz, 13) - 0.5) * 2 * RIVER_WAYPOINT_JITTER;
    return [cx + wx, cz + wz];
  }
  function tileCenter(st, tx, tz) {
    return [worldX(st, tx) + TILE / 2, worldZ(st, tz) + TILE / 2];
  }
  /** One segment per river edge, plus a tile->segment[] spatial index for
   *  cheap nearby-segment lookups during meshing. Only checks e/s per tile
   *  -- hasRiver is stamped symmetrically on both non-water banks of an
   *  edge (see worldgen.js's generateRivers), so an edge's n/w flag on one
   *  tile is always some OTHER tile's s/e flag, and checking e/s from
   *  every tile visits each edge exactly once. A land tile facing open
   *  water gets a short "mouth" stub out to the shared edge midpoint
   *  instead of a neighbor waypoint (the water tile itself never carries
   *  hasRiver, so it has no waypoint of its own to connect to). */
  function buildRiverNetwork(st, map) {
    const segments = [];
    const index = new Map(); // "tx,tz" -> segment[]
    function addToIndex(tx, tz, seg) {
      const key = tx + "," + tz;
      let arr = index.get(key);
      if (!arr) { arr = []; index.set(key, arr); }
      arr.push(seg);
    }
    for (let tz = 0; tz < map.height; tz++) {
      for (let tx = 0; tx < map.width; tx++) {
        const tile = map.tiles[tz * map.width + tx];
        const r = tile.hasRiver;
        const hcA = terrainHeightAt(map, tx, tz);
        for (const dir of ["e", "s"]) {
          if (!r[dir]) continue;
          const ntx = tx + (dir === "e" ? 1 : 0), ntz = tz + (dir === "s" ? 1 : 0);
          const neighborTile = map.tiles[ntz * map.width + ntx];
          const isWater = neighborTile.terrain === "ocean" || neighborTile.terrain === "coast";
          const a = riverWaypoint(st, tx, tz);
          const hcB = terrainHeightAt(map, ntx, ntz);
          // A mouth's far endpoint is the WATER tile's own center (not the
          // shared edge midpoint) -- an earlier version stopped exactly on
          // the boundary line, which never actually entered the water
          // tile's footprint and read as the river stopping just short of
          // the sea. Ending at the center instead makes the ribbon (and the
          // ground carve, which also runs along a/b -- see carveDepthAt)
          // genuinely overlap the water tile, the same way a real river
          // waypoint would for an ordinary land-to-land connection; see
          // buildRiverWaterRibbon for how the carve is tapered back to 0
          // over that stretch instead of digging an ever-deeper trench into
          // open sea.
          const b = isWater ? tileCenter(st, ntx, ntz) : riverWaypoint(st, ntx, ntz);
          // tx/tz/ntx/ntz let the water ribbon (see buildRiverWaterRibbon)
          // look up each endpoint tile's own ground shape instead of just
          // its flat hc, for both land-to-land and mouth segments alike.
          const seg = { a, b, hcA, hcB, mouthWater: isWater, tx, tz, ntx, ntz };
          segments.push(seg);
          addToIndex(tx, tz, seg);
          addToIndex(ntx, ntz, seg);
        }
      }
    }
    return { segments, index };
  }
  /** Every segment that could possibly reach into this tile's own
   *  geometry -- the carve falloff radius is well under one tile, so the
   *  tile's own bucket plus its 8 neighbors' is always sufficient. Returns
   *  null (not []) when there's nothing nearby, so callers can cheaply
   *  branch back to the fast non-river path. */
  function nearbySegments(index, tx, tz) {
    let out = null;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const arr = index.get((tx + dx) + "," + (tz + dz));
        if (arr) { if (!out) out = []; out.push(...arr); }
      }
    }
    return out;
  }
  function pointSegDist(px, pz, a, b) {
    const abx = b[0]-a[0], abz = b[1]-a[1];
    const len2 = abx*abx + abz*abz;
    let t = len2 > 0 ? ((px-a[0])*abx + (pz-a[1])*abz) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const dx = px - (a[0]+abx*t), dz = pz - (a[1]+abz*t);
    return Math.hypot(dx, dz);
  }
  /** Depth below undisturbed height at world (x,z), unioned (max) across
   *  every nearby segment -- confluences and river mouths naturally pool
   *  since overlapping falloffs just take the deepest. Distance-to-SEGMENT
   *  (not to-infinite-line) means a leaf endpoint (a spring source, a
   *  river mouth) caps off as a rounded pool for free -- no explicit
   *  end-taper needed, unlike the per-curve approach this replaced. */
  function carveDepthAt(x, z, segments) {
    if (!segments) return 0;
    let best = Infinity;
    for (const seg of segments) {
      const d = pointSegDist(x, z, seg.a, seg.b);
      if (d < best) best = d;
    }
    return smoothstep(RIVER_CHANNEL_HALF_WIDTH + RIVER_BANK_WIDTH, RIVER_CHANNEL_HALF_WIDTH, best) * RIVER_CARVE_DEPTH;
  }
  /** Continuous stand-in for the plateau+skirt+corner fan shape (flat
   *  interior at hc, sloping down/up to the neighbor-averaged edge/corner
   *  height within the margin band) -- agrees with the fan's own vertices
   *  exactly (verified at every corner/edge-midpoint case), but unlike the
   *  fan it's defined at ANY (u,v), so a river-adjacent tile can be
   *  resampled at whatever grid resolution the carve needs without the two
   *  shapes disagreeing. u/v are normalized 0..1 across the tile's FULL
   *  footprint (0/1 = true edge, not the margin-inset plateau edge). */
  function unshapedHeightAt(u, v, mFrac, hc, bN, bS, bE, bW, bNW, bNE, bSE, bSW) {
    const distN = v, distS = 1-v, distW = u, distE = 1-u;
    const dMin = Math.min(distN, distS, distW, distE);
    if (dMin >= mFrac) return hc;
    const nearN = distN < mFrac, nearS = distS < mFrac, nearW = distW < mFrac, nearE = distE < mFrac;
    let edgeVal;
    if (nearN && nearW) edgeVal = bNW;
    else if (nearN && nearE) edgeVal = bNE;
    else if (nearS && nearW) edgeVal = bSW;
    else if (nearS && nearE) edgeVal = bSE;
    else if (nearN) edgeVal = bN;
    else if (nearS) edgeVal = bS;
    else if (nearW) edgeVal = bW;
    else edgeVal = bE;
    const t = 1 - dMin / mFrac;
    return hc + (edgeVal - hc) * t;
  }
  /** Replaces a river-adjacent tile's flat plateau+skirt+corner fans with
   *  one unified (N+1)x(N+1) grid spanning the tile's FULL footprint,
   *  height = unshapedHeightAt(...) - carveDepthAt(...). Because both are
   *  pure functions of world position rather than tile-local fan topology,
   *  two neighboring river-adjacent tiles evaluate identically along their
   *  shared edge -- carved connectivity by construction, not a pinning or
   *  tapering trick. */
  function buildRiverTileGrid(g, x0, x1, z0, z1, hc, bN, bS, bE, bW, bNW, bNE, bSE, bSW, mFrac, segments, snow) {
    const N = RIVER_GRID_N;
    const rows = [];
    for (let j = 0; j <= N; j++) {
      const v = j / N, fz = z0 + (z1 - z0) * v;
      const row = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, fx = x0 + (x1 - x0) * u;
        const base = unshapedHeightAt(u, v, mFrac, hc, bN, bS, bE, bW, bNW, bNE, bSE, bSW);
        row.push([fx, base - carveDepthAt(fx, fz, segments), fz]);
      }
      rows.push(row);
    }
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const p00 = rows[j][i], p10 = rows[j][i+1], p01 = rows[j+1][i], p11 = rows[j+1][i+1];
        pushTri(g, p00, p10, p11, x0, z0, snow);
        pushTri(g, p00, p11, p01, x0, z0, snow);
      }
    }
  }
  /** Whole-map water ribbon: one strip of quads per network segment, built
   *  once (see buildTerrainMesh) -- not per-frame, no async art-loading
   *  dependency to retry against (the water shader is procedural). A
   *  segment's ribbon starts/ends at the exact same waypoint its
   *  neighboring segments use, so ribbons from adjacent tiles meet exactly
   *  with no separate bridging step.
   *
   *  Height along a segment is NOT a straight lerp between its two endpoint
   *  tiles' flat heights (an earlier version did that) -- a waypoint sits
   *  near its tile's CENTER, well outside that tile's own margin band (see
   *  MARGIN_BY_TERRAIN), so the real ground stays flat at that tile's own
   *  hc for most of the segment's length and only ramps within the narrow
   *  margin band close to the shared edge. A straight lerp ignores that and
   *  drifts away from the real ground the whole way, which barely showed
   *  when neighboring tiles' heights were all close together but became
   *  obvious once elevationVarianceAt (v9) let them differ by a lot more --
   *  the water visibly floated above (or sank below) the actual carved
   *  channel through most of a tile, reading as the river cutting out and
   *  picking up again rather than flowing continuously. Instead, each
   *  segment is sampled at RIVER_WATER_SAMPLES points, and every sample
   *  resolves to whichever endpoint tile's footprint it actually falls in
   *  and evaluates THAT tile's own unshapedHeightAt -- the exact same
   *  function the ground mesh uses -- so the water surface hugs the true
   *  flat-then-ramp ground contour instead of a straight line, and the two
   *  are seamless by construction rather than by luck. Minus a carve amount
   *  -- full RIVER_CARVE_DEPTH for an ordinary land-to-land segment, valid
   *  because distance-to-segment is ~0 everywhere ON the segment so
   *  carveDepthAt is already saturated along its whole length -- plus a
   *  lift so the water renders above the carved dirt, never underneath it.
   *  A river MOUTH's far endpoint (b) is the water tile's own CENTER, not
   *  the shared edge (see buildRiverNetwork) -- stopping exactly on the
   *  boundary line read as the river halting just short of the sea instead
   *  of reaching it -- so the ribbon genuinely enters that tile's footprint
   *  the same way a normal waypoint connection would. Its carve amount
   *  tapers smoothly to 0 as a sample nears b, since past the shore it's
   *  open sea, not an ever-deepening trench. Emits an interleaved {pos3,
   *  side1} VBO: side is -1/+1 across the ribbon's width, used for a soft
   *  edge fade instead of a hard alpha-discard
   *  cutout. */
  const RIVER_WATER_SAMPLES = 8; // subdivisions per segment, see above
  function buildRiverWaterRibbon(st, map, network) {
    const positions = [], sides = [];
    function emitQuad(aL, aR, bL, bR) {
      positions.push(aL[0],aL[1],aL[2]); sides.push(1);
      positions.push(aR[0],aR[1],aR[2]); sides.push(-1);
      positions.push(bR[0],bR[1],bR[2]); sides.push(-1);
      positions.push(aL[0],aL[1],aL[2]); sides.push(1);
      positions.push(bR[0],bR[1],bR[2]); sides.push(-1);
      positions.push(bL[0],bL[1],bL[2]); sides.push(1);
    }
    function localUV(tx, tz, wx, wz) {
      const x0 = worldX(st, tx), x1 = worldX(st, tx+1);
      const z0 = worldZ(st, tz), z1 = worldZ(st, tz+1);
      return [(wx - x0) / (x1 - x0), (wz - z0) / (z1 - z0)];
    }
    function insideUnit(u, v) { return u >= 0 && u <= 1 && v >= 0 && v <= 1; }
    function groundHeightAt(shape, tx, tz, wx, wz) {
      const [u, v] = localUV(tx, tz, wx, wz);
      return unshapedHeightAt(u, v, shape.mFrac, shape.hc, shape.bN, shape.bS, shape.bE, shape.bW, shape.bNW, shape.bNE, shape.bSE, shape.bSW);
    }
    for (const seg of network.segments) {
      const [ax, az] = seg.a, [bx, bz] = seg.b;
      const dx = bx-ax, dz = bz-az;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz/len, pz = dx/len;
      const hw = WATER_RIBBON_HALF_WIDTH;
      const shapeA = tileShapeAt(map, seg.tx, seg.tz);
      // Computed unconditionally now (even for a mouth segment) -- b sits at
      // the WATER tile's own center (see buildRiverNetwork/tileCenter), not
      // the shared edge, so the ribbon actually enters that tile's footprint
      // instead of stopping exactly on the boundary line.
      const shapeB = tileShapeAt(map, seg.ntx, seg.ntz);
      let prevL = null, prevR = null;
      for (let i = 0; i <= RIVER_WATER_SAMPLES; i++) {
        const t = i / RIVER_WATER_SAMPLES;
        const wx = ax + dx * t, wz = az + dz * t;
        const uvA = localUV(seg.tx, seg.tz, wx, wz);
        const useB = !insideUnit(uvA[0], uvA[1]);
        const ground = useB
          ? groundHeightAt(shapeB, seg.ntx, seg.ntz, wx, wz)
          : groundHeightAt(shapeA, seg.tx, seg.tz, wx, wz);
        // An ordinary land-to-land segment carves at full depth everywhere
        // on its length (see carveDepthAt's doc comment: distance-to-self is
        // always 0 on the segment, so it's already saturated). A river
        // MOUTH is different -- past the shore it's the open sea, not an
        // ever-deepening channel, so taper the carve smoothly to 0 as the
        // sample approaches b (the water tile's own center) rather than
        // cutting off abruptly at the boundary. Distance-to-b (not
        // parametric t) is what's tapered against, since t=0..1 spans the
        // whole segment including its land-side half, which must stay at
        // full depth regardless of the segment's total length.
        const carveAmt = seg.mouthWater
          ? RIVER_CARVE_DEPTH * smoothstep(0, WATER_MOUTH_TAPER, Math.hypot(wx - bx, wz - bz))
          : RIVER_CARVE_DEPTH;
        const y = ground - carveAmt + WATER_SURFACE_LIFT;
        const L = [wx+px*hw, y, wz+pz*hw], R = [wx-px*hw, y, wz-pz*hw];
        if (i > 0) emitQuad(prevL, prevR, L, R);
        prevL = L; prevR = R;
      }
    }
    const vertCount = positions.length / 3;
    if (vertCount === 0) return null;
    const interleaved = new Float32Array(vertCount * 4);
    for (let i = 0; i < vertCount; i++) {
      interleaved[i*4+0]=positions[i*3+0]; interleaved[i*4+1]=positions[i*3+1]; interleaved[i*4+2]=positions[i*3+2];
      interleaved[i*4+3]=sides[i];
    }
    const vbo = st.gl.createBuffer();
    st.gl.bindBuffer(st.gl.ARRAY_BUFFER, vbo);
    st.gl.bufferData(st.gl.ARRAY_BUFFER, interleaved, st.gl.STATIC_DRAW);
    return { vbo, vertCount };
  }

  function buildTerrainMesh(st, map) {
    const gl = st.gl;
    st.mapWidth = map.width;
    st.mapHeight = map.height;

    const groups = {};
    for (const id of Object.keys(MATERIAL_PALETTES)) groups[id] = { positions: [], normals: [], uvs: [], snow: [] };

    // Built once per map, ahead of the tile loop -- see buildRiverNetwork.
    // Every tile below looks up its own 3x3 neighborhood via
    // network.index; tiles with nothing nearby fall straight through to
    // the original fast plateau+skirt+corner path, untouched.
    const network = buildRiverNetwork(st, map);

    // Every real per-tile height that occurs in THIS map -- hills/mountains
    // no longer share one exact height per terrain type (see
    // elevationVarianceAt), so pickTileAtClient can't test against the
    // static HEIGHT_BY_TERRAIN table anymore; it uses this instead (see
    // st.heightPlanes there).
    const heightSet = new Set();

    for (let tz = 0; tz < map.height; tz++) {
      for (let tx = 0; tx < map.width; tx++) {
        const tile = map.tiles[tz * map.width + tx];
        const terrainId = tile.terrain;
        const g = groups[terrainId];
        if (!g) continue; // unknown terrain id -- skip rather than throw
        const x0 = worldX(st, tx) - TILE_BLEED, x1 = worldX(st, tx+1) + TILE_BLEED;
        const z0 = worldZ(st, tz) - TILE_BLEED, z1 = worldZ(st, tz+1) + TILE_BLEED;
        // Same shape data the water ribbon uses (see tileShapeAt/
        // buildRiverWaterRibbon) -- one source of truth for both.
        const shape = tileShapeAt(map, tx, tz);
        const { hc, bN, bS, bE, bW, bNW, bNE, bSE, bSW } = shape;
        heightSet.add(hc);
        const snowVal = terrainId === "mountains" && isMountainPeak(map, tx, tz) ? 1 : 0;
        const m = shape.mFrac * TILE;

        const nearSegs = nearbySegments(network.index, tx, tz);
        if (nearSegs) {
          buildRiverTileGrid(g, x0, x1, z0, z1, hc, bN, bS, bE, bW, bNW, bNE, bSE, bSW, shape.mFrac, nearSegs, snowVal);
          continue;
        }

        const ix0 = x0+m, ix1 = x1-m, iz0 = z0+m, iz1 = z1-m;
        const cNW=[ix0,hc,iz0], cNE=[ix1,hc,iz0], cSE=[ix1,hc,iz1], cSW=[ix0,hc,iz1];

        pushTri(g, cNW, cNE, cSE, x0, z0, snowVal);
        pushTri(g, cNW, cSE, cSW, x0, z0, snowVal);

        const nA=[x0+m,bN,z0], nB=[x1-m,bN,z0];
        pushTri(g, nA, nB, cNE, x0, z0, snowVal);
        pushTri(g, nA, cNE, cNW, x0, z0, snowVal);
        const sA=[x1-m,bS,z1], sB=[x0+m,bS,z1];
        pushTri(g, sA, sB, cSW, x0, z0, snowVal);
        pushTri(g, sA, cSW, cSE, x0, z0, snowVal);
        const wA=[x0,bW,z0+m], wB=[x0,bW,z1-m];
        pushTri(g, wA, wB, cSW, x0, z0, snowVal);
        pushTri(g, wA, cSW, cNW, x0, z0, snowVal);
        const eA=[x1,bE,z1-m], eB=[x1,bE,z0+m];
        pushTri(g, eA, eB, cNE, x0, z0, snowVal);
        pushTri(g, eA, cNE, cSE, x0, z0, snowVal);

        pushTri(g, [x0,bNW,z0], nA, cNW, x0, z0, snowVal);
        pushTri(g, [x0,bNW,z0], cNW, wA, x0, z0, snowVal);
        pushTri(g, [x1,bNE,z0], cNE, nB, x0, z0, snowVal);
        pushTri(g, [x1,bNE,z0], eB, cNE, x0, z0, snowVal);
        pushTri(g, [x1,bSE,z1], sA, cSE, x0, z0, snowVal);
        pushTri(g, [x1,bSE,z1], cSE, eA, x0, z0, snowVal);
        pushTri(g, [x0,bSW,z1], cSW, sB, x0, z0, snowVal);
        pushTri(g, [x0,bSW,z1], wB, cSW, x0, z0, snowVal);
      }
    }

    for (const g of st.terrainDrawGroups) gl.deleteBuffer(g.vbo);
    st.terrainDrawGroups = [];
    for (const terrainId of Object.keys(groups)) {
      const g = groups[terrainId];
      const vertCount = g.positions.length / 3;
      if (vertCount === 0) continue;
      const interleaved = new Float32Array(vertCount * 9);
      for (let i = 0; i < vertCount; i++) {
        interleaved[i*9+0]=g.positions[i*3+0]; interleaved[i*9+1]=g.positions[i*3+1]; interleaved[i*9+2]=g.positions[i*3+2];
        interleaved[i*9+3]=g.normals[i*3+0]; interleaved[i*9+4]=g.normals[i*3+1]; interleaved[i*9+5]=g.normals[i*3+2];
        interleaved[i*9+6]=g.uvs[i*2+0]; interleaved[i*9+7]=g.uvs[i*2+1];
        interleaved[i*9+8]=g.snow[i];
      }
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
      st.terrainDrawGroups.push({ texture: st.terrainTextures[terrainId], vbo, vertCount });
    }
    st.heightPlanes = heightSet;

    // Rivers never change after worldgen (see worldgen.js's generateRivers),
    // and unlike the old sprite-decal system this has no async art-loading
    // dependency to retry against (the water shader is procedural), so the
    // ribbon just gets built once, right here, alongside the terrain mesh.
    if (st.riverWaterGroup) gl.deleteBuffer(st.riverWaterGroup.vbo);
    st.riverWaterGroup = buildRiverWaterRibbon(st, map, network);

    st.builtForMap = map;

    // Re-center the camera default target/distance on this map's real size
    // the first time we build it for a given viewState (see render()).
    st.lastMapWforCam = map.width;
    st.lastMapHforCam = map.height;
  }

  // ---------- road/river decals: full-tile flat quads, textured with the
  // real overlay art and rotated per-direction the same way render.js's
  // drawOverlayStub composites them on a 2D canvas. The stub art's default
  // (0deg) orientation points EAST (matches ROAD_CARDINAL_ANGLE.e === 0),
  // so an unrotated quad's 4 corners are just the tile's own footprint with
  // UV (0,0) at the NW corner -- rotating by angleDeg here uses the same
  // formula ctx.rotate() produces in a Y-down screen space, which is exactly
  // what world (+X east, +Z south) already is, so no axis flip is needed. ----------
  function buildDecalQuad(positions, uvs, worldCx, worldCz, height, angleDeg, halfSize) {
    const hs = halfSize != null ? halfSize : TILE / 2;
    const rad = (angleDeg * Math.PI) / 180;
    const cosA = Math.cos(rad), sinA = Math.sin(rad);
    function corner(lx, lz) {
      const rx = lx * cosA - lz * sinA;
      const rz = lx * sinA + lz * cosA;
      return [worldCx + rx, height, worldCz + rz];
    }
    const nw = corner(-hs, -hs), ne = corner(hs, -hs), se = corner(hs, hs), sw = corner(-hs, hs);
    positions.push(nw[0],nw[1],nw[2], ne[0],ne[1],ne[2], se[0],se[1],se[2]);
    uvs.push(0,0, 1,0, 1,1);
    positions.push(nw[0],nw[1],nw[2], se[0],se[1],se[2], sw[0],sw[1],sw[2]);
    uvs.push(0,0, 1,1, 0,1);
  }

  function buildDecalVbo(gl, positions, uvs) {
    const vertCount = positions.length / 3;
    if (vertCount === 0) return null;
    const interleaved = new Float32Array(vertCount * 5);
    for (let i = 0; i < vertCount; i++) {
      interleaved[i*5+0]=positions[i*3+0]; interleaved[i*5+1]=positions[i*3+1]; interleaved[i*5+2]=positions[i*3+2];
      interleaved[i*5+3]=uvs[i*2+0]; interleaved[i*5+4]=uvs[i*2+1];
    }
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
    return { vbo, vertCount };
  }

  /** Roads can be built mid-game (see main.js's handleBuildRoad), so unlike
   *  rivers this rebuilds from live tile data every render() call rather
   *  than being cached with the terrain mesh. Cheap relative to the terrain
   *  mesh itself: most tiles have no road, so this is a fast skip-most scan
   *  plus a handful of quads for however many actually do. */
  function buildRoadDecalGroups(st, map) {
    const cardinalSprite = window.UI.sprites.pick("road/cardinal");
    const diagonalSprite = window.UI.sprites.pick("road/diagonal");
    const hubSprite = window.UI.sprites.pick("road/hub");
    if (!cardinalSprite || !diagonalSprite || !hubSprite) return [];
    const cardinalTex = getBillboardTexture(st, cardinalSprite.image, cardinalSprite.manifest);
    const diagonalTex = getBillboardTexture(st, diagonalSprite.image, diagonalSprite.manifest);
    const hubTex = getBillboardTexture(st, hubSprite.image, hubSprite.manifest);
    if (!cardinalTex.tex || !diagonalTex.tex || !hubTex.tex) return []; // texture upload failed (see notifyFileProtocolLimitation)
    const cardinalPos = [], cardinalUv = [], diagonalPos = [], diagonalUv = [], hubPos = [], hubUv = [];
    const hasRoadAt = (tx, tz) => tx >= 0 && tx < map.width && tz >= 0 && tz < map.height && map.tiles[tz * map.width + tx].hasRoad;
    for (let tz = 0; tz < map.height; tz++) {
      for (let tx = 0; tx < map.width; tx++) {
        if (!map.tiles[tz * map.width + tx].hasRoad) continue;
        const cx = worldX(st, tx) + TILE/2, cz = worldZ(st, tz) + TILE/2;
        const baseY = cellHeight(map, tx, tz);
        const hubY = baseY + ROAD_HUB_LIFT;
        buildDecalQuad(hubPos, hubUv, cx, cz, hubY, 0);
        // Cardinal/diagonal stub height is the AVERAGE of this tile's own
        // height and that specific neighbor's -- not just this tile's own
        // height. Terrain elevation (hills/mountains) varies per tile (see
        // elevationVarianceAt), so two adjacent road tiles can easily sit
        // at different heights; each used to draw its own half-stub at its
        // OWN height only, so the two halves met at the shared edge at
        // different elevations -- a visible vertical step that read as
        // "roads don't connect" (confirmed live: an isolated-looking gap
        // at every hill/plain road boundary). Averaging is symmetric (this
        // tile averaging with that neighbor produces the exact same value
        // the neighbor computes averaging back with this tile), so both
        // halves of a connection always land at the identical height.
        if (hasRoadAt(tx, tz-1)) buildDecalQuad(cardinalPos, cardinalUv, cx, cz, (baseY + cellHeight(map, tx, tz-1)) / 2 + ROAD_CARDINAL_LIFT, ROAD_CARDINAL_ANGLE.n);
        if (hasRoadAt(tx, tz+1)) buildDecalQuad(cardinalPos, cardinalUv, cx, cz, (baseY + cellHeight(map, tx, tz+1)) / 2 + ROAD_CARDINAL_LIFT, ROAD_CARDINAL_ANGLE.s);
        if (hasRoadAt(tx+1, tz)) buildDecalQuad(cardinalPos, cardinalUv, cx, cz, (baseY + cellHeight(map, tx+1, tz)) / 2 + ROAD_CARDINAL_LIFT, ROAD_CARDINAL_ANGLE.e);
        if (hasRoadAt(tx-1, tz)) buildDecalQuad(cardinalPos, cardinalUv, cx, cz, (baseY + cellHeight(map, tx-1, tz)) / 2 + ROAD_CARDINAL_LIFT, ROAD_CARDINAL_ANGLE.w);
        if (hasRoadAt(tx+1, tz-1)) buildDecalQuad(diagonalPos, diagonalUv, cx, cz, (baseY + cellHeight(map, tx+1, tz-1)) / 2 + ROAD_DIAGONAL_LIFT, ROAD_DIAGONAL_ANGLE.ne);
        if (hasRoadAt(tx+1, tz+1)) buildDecalQuad(diagonalPos, diagonalUv, cx, cz, (baseY + cellHeight(map, tx+1, tz+1)) / 2 + ROAD_DIAGONAL_LIFT, ROAD_DIAGONAL_ANGLE.se);
        if (hasRoadAt(tx-1, tz+1)) buildDecalQuad(diagonalPos, diagonalUv, cx, cz, (baseY + cellHeight(map, tx-1, tz+1)) / 2 + ROAD_DIAGONAL_LIFT, ROAD_DIAGONAL_ANGLE.sw);
        if (hasRoadAt(tx-1, tz-1)) buildDecalQuad(diagonalPos, diagonalUv, cx, cz, (baseY + cellHeight(map, tx-1, tz-1)) / 2 + ROAD_DIAGONAL_LIFT, ROAD_DIAGONAL_ANGLE.nw);
      }
    }
    const groups = [];
    const hubVbo = buildDecalVbo(st.gl, hubPos, hubUv);
    if (hubVbo) groups.push({ texture: hubTex.tex, ...hubVbo, dynamic: true });
    const cardinalVbo = buildDecalVbo(st.gl, cardinalPos, cardinalUv);
    if (cardinalVbo) groups.push({ texture: cardinalTex.tex, ...cardinalVbo, dynamic: true });
    const diagonalVbo = buildDecalVbo(st.gl, diagonalPos, diagonalUv);
    if (diagonalVbo) groups.push({ texture: diagonalTex.tex, ...diagonalVbo, dynamic: true });
    return groups;
  }

  /** One small colored disc per unit billboard (see makeShadowCanvas),
   *  grouped by civ color for batched draws -- rebuilt from the SAME
   *  already-collected billboards list every frame (not re-derived from
   *  gameState), so a shadow always agrees exactly with where its unit is
   *  actually drawn, mid-glide position included. */
  function buildShadowDecalGroups(st, map, billboards) {
    const byColor = new Map();
    for (const b of billboards) {
      if (!b.color) continue;
      let arr = byColor.get(b.color);
      if (!arr) { arr = []; byColor.set(b.color, arr); }
      arr.push(b);
    }
    const groups = [];
    for (const [color, items] of byColor) {
      const shadowCanvas = makeShadowCanvas(color);
      const tex = getBillboardTexture(st, shadowCanvas, singleFrameManifest(shadowCanvas));
      if (!tex.tex) continue;
      const positions = [], uvs = [];
      for (const b of items) {
        const cx = worldX(st, b.x) + TILE/2 + b.dx, cz = worldZ(st, b.y) + TILE/2 + b.dz;
        const y = cellHeight(map, b.x, b.y) + SHADOW_Y_LIFT;
        buildDecalQuad(positions, uvs, cx, cz, y, 0, SHADOW_RADIUS);
      }
      const vbo = buildDecalVbo(st.gl, positions, uvs);
      if (vbo) groups.push({ texture: tex.tex, ...vbo });
    }
    return groups;
  }

  function drawDecalGroup(st, g) {
    const gl = st.gl;
    gl.bindTexture(gl.TEXTURE_2D, g.texture);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo);
    const stride = 5 * 4;
    gl.enableVertexAttribArray(st.d_aPos);
    gl.vertexAttribPointer(st.d_aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(st.d_aUV);
    gl.vertexAttribPointer(st.d_aUV, 2, gl.FLOAT, false, stride, 12);
    gl.drawArrays(gl.TRIANGLES, 0, g.vertCount);
  }

  /** Same vertex layout/stride as drawDecalGroup (both quads come from
   *  buildDecalQuad/buildDecalVbo), through tintProg instead of decalProg
   *  -- see tintFS's own comment for why the ground-tint overlays (grid/
   *  influence/aura) need a real alpha-blended shader rather than
   *  decalFS's hard cutout. `g.color`/`g.alpha` are per-group uniforms
   *  (see buildGridDecalGroup/buildInfluenceDecalGroups/buildAuraDecalGroups),
   *  not baked into the (colorless) mask texture. */
  function drawTintGroup(st, g) {
    const gl = st.gl;
    gl.uniform3f(st.tint_uColor, g.color[0], g.color[1], g.color[2]);
    gl.uniform1f(st.tint_uAlpha, g.alpha);
    gl.bindTexture(gl.TEXTURE_2D, g.texture);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo);
    const stride = 5 * 4;
    gl.enableVertexAttribArray(st.tint_aPos);
    gl.vertexAttribPointer(st.tint_aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(st.tint_aUV);
    gl.vertexAttribPointer(st.tint_aUV, 2, gl.FLOAT, false, stride, 12);
    gl.drawArrays(gl.TRIANGLES, 0, g.vertCount);
  }

  /** cx/cz can be fractional -- a mid-glide unit's visual position (see
   *  getVisualPos) -- floored to the containing tile rather than truncated,
   *  since Math.min/max above already clamp to [0, dimension-1] and a
   *  fractional cx just inside that range (e.g. width-0.5) must still land
   *  on a real integer tile index, not produce a non-integer array index
   *  (map.tiles[5.3] is undefined, not tiles[5]). */
  function cellHeight(map, cx, cz) {
    cx = Math.floor(Math.max(0, Math.min(map.width - 1, cx)));
    cz = Math.floor(Math.max(0, Math.min(map.height - 1, cz)));
    return terrainHeightAt(map, cx, cz);
  }

  /** "#rrggbb" -> [r,g,b] floats in 0..1, for a GL uniform3f -- distinct
   *  from overlays.hexToRgba, which returns a CSS rgba() STRING for 2D
   *  canvas fillStyle, not usable directly as GL uniform components. */
  function hexToFloatRgb(hex) {
    return [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255,
    ];
  }

  /** Grid-line overlay (render.js's showGrid), as a decal group spanning
   *  the WHOLE map. Unlike influence/aura below, this never changes shape
   *  once built (a tile's grid line never moves), so it's cached on `st`
   *  and only rebuilt when the terrain mesh itself is (see render()'s
   *  `st.builtForMap !== map` check) -- rebuilding a ~map.width*map.height
   *  quad decal group every single animation frame (this overlay defaults
   *  ON) would be needless GPU churn for something that's genuinely static.
   *  Drawn through tintProg (see tintFS) with the same fog-texture pass as
   *  every other decal, so it's automatically dimmed/hidden by fog exactly
   *  like roads/shadows -- no separate visibility filtering needed here. */
  function buildGridDecalGroup(st, map) {
    const img = makeGridMaskCanvas();
    const tex = getBillboardTexture(st, img, singleFrameManifest(img));
    if (!tex.tex) return null;
    const positions = [], uvs = [];
    for (let tz = 0; tz < map.height; tz++) {
      for (let tx = 0; tx < map.width; tx++) {
        const cx = worldX(st, tx) + TILE / 2, cz = worldZ(st, tz) + TILE / 2;
        buildDecalQuad(positions, uvs, cx, cz, cellHeight(map, tx, tz) + GRID_Y_LIFT, 0);
      }
    }
    const vbo = buildDecalVbo(st.gl, positions, uvs);
    return vbo ? { texture: tex.tex, color: [0, 0, 0], alpha: 0.5, ...vbo } : null;
  }

  /** Influence overlay (render.js's showInfluence): owned tiles get a flat
   *  civ-colored tint, contested tiles get the diagonal hatch pattern --
   *  same shapes as the 2D renderer's hexToRgba fill/drawHatch, drawn
   *  through tintProg with each group's own civ color/alpha as a uniform
   *  (see tintFS) rather than baked into a per-color texture. Bucketed by
   *  (status, color) so every civ's owned tiles batch into one draw call,
   *  same convention as buildShadowDecalGroups' per-color bucketing. Only
   *  ever called when the overlay toggle is on and cached by the caller
   *  (see render()) keyed to gameState.turnNumber -- territory only
   *  changes at turn-resolution boundaries, so it's wasted work to rebuild
   *  this every animation frame of an unchanged turn the way roads/shadows
   *  do (those genuinely can change from a player action mid-turn;
   *  ownership can't). */
  function buildInfluenceDecalGroups(st, gameState, map, visible) {
    const owned = new Map(), contested = new Map();
    for (let tz = 0; tz < map.height; tz++) {
      for (let tx = 0; tx < map.width; tx++) {
        const idx = tz * map.width + tx;
        if (!visible.has(idx)) continue;
        const tile = map.tiles[idx];
        if (tile.status === "neutral" || !tile.ownerCivId) continue;
        const bucket = tile.status === "owned" ? owned : tile.status === "contested" ? contested : null;
        if (!bucket) continue;
        const civ = gameState.civs[tile.ownerCivId];
        const color = civ ? window.GameData.getRace(civ.raceId).color : "#888888";
        let arr = bucket.get(color);
        if (!arr) { arr = { positions: [], uvs: [] }; bucket.set(color, arr); }
        const cx = worldX(st, tx) + TILE / 2, cz = worldZ(st, tz) + TILE / 2;
        buildDecalQuad(arr.positions, arr.uvs, cx, cz, cellHeight(map, tx, tz) + INFLUENCE_Y_LIFT, 0);
      }
    }
    const solidTex = getBillboardTexture(st, makeSolidMaskCanvas(), singleFrameManifest(makeSolidMaskCanvas()));
    const hatchTex = getBillboardTexture(st, makeHatchMaskCanvas(), singleFrameManifest(makeHatchMaskCanvas()));
    const groups = [];
    if (solidTex.tex) {
      for (const [color, arr] of owned) {
        const vbo = buildDecalVbo(st.gl, arr.positions, arr.uvs);
        if (vbo) groups.push({ texture: solidTex.tex, color: hexToFloatRgb(color), alpha: 0.45, ...vbo });
      }
    }
    if (hatchTex.tex) {
      for (const [color, arr] of contested) {
        const vbo = buildDecalVbo(st.gl, arr.positions, arr.uvs);
        if (vbo) groups.push({ texture: hatchTex.tex, color: hexToFloatRgb(color), alpha: 0.6, ...vbo });
      }
    }
    return groups;
  }

  /** Aura-radius tint (render.js's Crusade Paladin / Heavy-Power Metal
   *  Troubadour tiles, see overlays.auraInfoForUnit) -- rebuilt every frame
   *  unlike influence above: there are only ever a handful of aura-bearing
   *  units on the whole map (rare unit types + a tech unlock gate), so a
   *  full rescan is cheap regardless of turn boundaries, and a human
   *  player CAN flip a Troubadour's activeAura mid-turn (a UI action, not a
   *  turn-resolution event), so caching by turnNumber alone would miss that. */
  function buildAuraDecalGroups(st, gameState, map, visible) {
    const byColor = new Map();
    for (const civ of Object.values(gameState.civs)) {
      for (const unit of civ.units) {
        const aura = window.UI.overlays.auraInfoForUnit(unit, civ);
        if (!aura) continue;
        const idx = unit.y * map.width + unit.x;
        if (!visible.has(idx)) continue;
        let arr = byColor.get(aura.color);
        if (!arr) { arr = { positions: [], uvs: [] }; byColor.set(aura.color, arr); }
        const { radius } = aura;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const tx = unit.x + dx, ty = unit.y + dy;
            if (tx < 0 || tx >= map.width || ty < 0 || ty >= map.height) continue;
            if (!visible.has(ty * map.width + tx)) continue;
            const cx = worldX(st, tx) + TILE / 2, cz = worldZ(st, ty) + TILE / 2;
            buildDecalQuad(arr.positions, arr.uvs, cx, cz, cellHeight(map, tx, ty) + AURA_Y_LIFT, 0);
          }
        }
      }
    }
    const solidTex = getBillboardTexture(st, makeSolidMaskCanvas(), singleFrameManifest(makeSolidMaskCanvas()));
    const groups = [];
    if (solidTex.tex) {
      for (const [color, arr] of byColor) {
        const vbo = buildDecalVbo(st.gl, arr.positions, arr.uvs);
        if (vbo) groups.push({ texture: solidTex.tex, color: hexToFloatRgb(color), alpha: 0.16, ...vbo });
      }
    }
    return groups;
  }

  // ---------- wall geometry: real 3D boxes/cylinders instead of a
  // billboard, ported from the standalone WebGL prototype. Vertex format
  // matches the terrain mesh exactly (pos3+normal3+uv2, interleaved) so
  // walls draw through st.terrainProg -- no separate shader needed, and
  // fog-of-war naturally falls out correctly: this geometry is only ever
  // built for tiles already confirmed visible (see buildWallGroup), and
  // the terrain shader's fog sampling at a visible tile's own position
  // always reads the "visible" tier anyway. ----------
  function pushWallTri(positions, normals, uvs, p0, p1, p2, n, uvA, uvB, uvC) {
    positions.push(p0[0],p0[1],p0[2], p1[0],p1[1],p1[2], p2[0],p2[1],p2[2]);
    normals.push(n[0],n[1],n[2], n[0],n[1],n[2], n[0],n[1],n[2]);
    uvs.push(uvA[0],uvA[1], uvB[0],uvB[1], uvC[0],uvC[1]);
  }
  function pushWallBox(positions, normals, uvs, cx, baseY, cz, w, h, d) {
    const hx = w/2, hz = d/2, y0 = baseY, y1 = baseY + h;
    const X0 = cx-hx, X1 = cx+hx, Z0 = cz-hz, Z1 = cz+hz;
    function face(p0, p1, p2, p3, n) {
      pushWallTri(positions, normals, uvs, p0, p1, p2, n, [0,0], [1,0], [1,1]);
      pushWallTri(positions, normals, uvs, p0, p2, p3, n, [0,0], [1,1], [0,1]);
    }
    face([X0,y0,Z0], [X1,y0,Z0], [X1,y1,Z0], [X0,y1,Z0], [0,0,-1]);
    face([X1,y0,Z1], [X0,y0,Z1], [X0,y1,Z1], [X1,y1,Z1], [0,0,1]);
    face([X0,y0,Z1], [X0,y0,Z0], [X0,y1,Z0], [X0,y1,Z1], [-1,0,0]);
    face([X1,y0,Z0], [X1,y0,Z1], [X1,y1,Z1], [X1,y1,Z0], [1,0,0]);
    face([X0,y1,Z0], [X1,y1,Z0], [X1,y1,Z1], [X0,y1,Z1], [0,1,0]);
  }
  function pushWallCylinder(positions, normals, uvs, cx, baseY, cz, radius, height, segments) {
    const y0 = baseY, y1 = baseY + height;
    for (let i = 0; i < segments; i++) {
      const t0 = i / segments, t1 = (i + 1) / segments;
      const a0 = t0 * Math.PI * 2, a1 = t1 * Math.PI * 2;
      const p0 = [cx + Math.cos(a0)*radius, y0, cz + Math.sin(a0)*radius];
      const p1 = [cx + Math.cos(a1)*radius, y0, cz + Math.sin(a1)*radius];
      const p2 = [cx + Math.cos(a1)*radius, y1, cz + Math.sin(a1)*radius];
      const p3 = [cx + Math.cos(a0)*radius, y1, cz + Math.sin(a0)*radius];
      const amid = (a0 + a1) / 2;
      const n = [Math.cos(amid), 0, Math.sin(amid)];
      pushWallTri(positions, normals, uvs, p0, p1, p2, n, [t0,0], [t1,0], [t1,1]);
      pushWallTri(positions, normals, uvs, p0, p2, p3, n, [t0,0], [t1,1], [t0,1]);
      // top cap (fan from center)
      pushWallTri(positions, normals, uvs, [cx,y1,cz], p3, p2, [0,1,0],
        [0.5,0.5], [Math.cos(a0)*0.5+0.5, Math.sin(a0)*0.5+0.5], [Math.cos(a1)*0.5+0.5, Math.sin(a1)*0.5+0.5]);
    }
  }

  /** Rebuilt from live structure data every render() call, same reasoning
   *  as roads: walls can be built (and destroyed, e.g. sieged down) mid-
   *  game. Gated on the SAME visible set structures/billboards use (not
   *  explored) -- matches render.js's own structures loop, which never
   *  shows a structure from memory either. `visible` is resolved once per
   *  frame by render() and passed in -- see updateFogMaskTexture's comment
   *  for why. */
  function buildWallGroup(st, gameState, map, visible) {
    const positions = [], normals = [], uvs = [];
    for (const civId of Object.keys(gameState.civs)) {
      const civ = gameState.civs[civId];
      if (civ.eliminated) continue;
      for (const city of civ.cities) {
        for (const s of city.structures) {
          const building = window.GameData.getBuilding(s.id);
          if (!building.isWall) continue;
          const idx = s.y * map.width + s.x;
          if (!visible.has(idx)) continue;
          const wx = worldX(st, s.x) + TILE/2, wz = worldZ(st, s.y) + TILE/2;
          const wy = cellHeight(map, s.x, s.y);
          const orientation = wallOrientation(map, civ.id, s.x, s.y);
          if (orientation === "node") {
            pushWallCylinder(positions, normals, uvs, wx, wy, wz, WALL_TOWER_RADIUS, WALL_TOWER_HEIGHT, WALL_TOWER_SEGMENTS);
          } else if (orientation === "horizontal") {
            pushWallBox(positions, normals, uvs, wx, wy, wz, TILE, WALL_HEIGHT, WALL_THICK);
          } else {
            pushWallBox(positions, normals, uvs, wx, wy, wz, WALL_THICK, WALL_HEIGHT, TILE);
          }
        }
      }
    }
    const vertCount = positions.length / 3;
    if (vertCount === 0) return null;
    const gl = st.gl;
    // 9th float is aSnow (see buildTerrainMesh) -- always 0 here, walls
    // share terrainProg's vertex layout but never get a snow cap.
    const interleaved = new Float32Array(vertCount * 9);
    for (let i = 0; i < vertCount; i++) {
      interleaved[i*9+0]=positions[i*3+0]; interleaved[i*9+1]=positions[i*3+1]; interleaved[i*9+2]=positions[i*3+2];
      interleaved[i*9+3]=normals[i*3+0]; interleaved[i*9+4]=normals[i*3+1]; interleaved[i*9+5]=normals[i*3+2];
      interleaved[i*9+6]=uvs[i*2+0]; interleaved[i*9+7]=uvs[i*2+1];
      interleaved[i*9+8]=0;
    }
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.DYNAMIC_DRAW);
    return { texture: st.wallTexture, vbo, vertCount };
  }

  // ---------- billboard textures: real game sprite art, uploaded as its
  // full sheet (every animation frame, see uFrameUVMin/Max) and measured
  // for bottom transparent padding so buildings sit flush on the ground
  // instead of floating on their own baked-in canvas padding (generalizes
  // the manual per-asset measurement used during the WebGL prototype into an automatic
  // runtime check that works for the whole roster, not just a few samples). ----------
  /** Fallback manifest for sprites.js's pickCityTier(), which returns just
   *  {image} -- no manifest, since tiered city art is a single static image
   *  per tier, not an animated sheet. Needs a real .animations.idle (not
   *  just frame dimensions) or sprites.js's currentFrame() would throw
   *  trying to read manifest.animations.idle off an undefined field. */
  function singleFrameManifest(image) {
    return {
      frameWidth: image.naturalWidth || image.width, frameHeight: image.naturalHeight || image.height, layout: "horizontal",
      animations: { idle: { frames: [0], fps: 1 } },
    };
  }

  /** Fallback for a unit/city/structure with no shipped art at all (pick()
   *  returns null -- distinct from a texture upload FAILING, see
   *  notifyFileProtocolLimitation) -- mirrors render.js's own fallback
   *  exactly: a race-colored disc with the unit/building's first initial,
   *  instead of silently rendering nothing (which is what happened before
   *  this existed, and reads exactly like "no units are showing up" for
   *  any race/unit combination whose art isn't finished yet). Built once
   *  per (color, label) pair and cached -- reuses getBillboardTexture's own
   *  pipeline (it accepts a canvas source too) rather than a parallel one. */
  const fallbackMarkerCache = new Map();
  function makeFallbackMarkerCanvas(color, label) {
    const key = color + "|" + label;
    let c = fallbackMarkerCache.get(key);
    if (c) return c;
    const size = 128;
    c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse(size/2, size/2, size*0.42, size*0.42, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = size * 0.035;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(size*0.44)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = size * 0.05;
    ctx.strokeText(label, size/2, size/2 + size*0.02);
    ctx.fillText(label, size/2, size/2 + size*0.02);
    fallbackMarkerCache.set(key, c);
    return c;
  }

  /** Civ-colored ground shadow under every unit -- mirrors render.js's
   *  drawUnitShadow (a flat race-colored ellipse under EVERY unit, real
   *  sprite or fallback alike), which 3D had no equivalent of: a billboard
   *  alone gives no at-a-glance ownership cue the way a colored disc
   *  planted on the ground does. Solid through ~65% of its radius then
   *  fading to transparent, so the alpha-discard cutout decalFS already
   *  uses (see drawDecalGroup) reads as a soft-edged blob instead of a
   *  hard-edged disc, without needing real alpha blending (not enabled
   *  anywhere in this file) or a dedicated shader. */
  const shadowTexCache = new Map();
  function makeShadowCanvas(color) {
    let c = shadowTexCache.get(color);
    if (c) return c;
    const size = 64;
    c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
    grad.addColorStop(0, color);
    grad.addColorStop(0.65, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
    ctx.fill();
    shadowTexCache.set(color, c);
    return c;
  }

  /** Three shared, colorless MASK textures for the ground-tint overlay pass
   *  (grid/influence/aura -- see buildGridDecalGroup/buildInfluenceDecalGroups
   *  /buildAuraDecalGroups and tintFS's own comment): each is just a shape in
   *  the alpha channel (RGB unused), drawn through tintProg with a uColor/
   *  uAlpha uniform supplying the actual civ color and opacity at draw time
   *  -- one singleton texture per SHAPE serves every civ's color, rather
   *  than needing a texture per (shape, color) combination. Built once and
   *  cached at module scope (not per-`st`/canvas) since they're plain 2D
   *  canvases with no GL state of their own; getBillboardTexture handles
   *  uploading/caching the actual WebGLTexture per `st`. */
  let gridMaskCanvas = null;
  function makeGridMaskCanvas() {
    if (gridMaskCanvas) return gridMaskCanvas;
    const size = 64;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);
    gridMaskCanvas = c;
    return c;
  }

  let solidMaskCanvas = null;
  function makeSolidMaskCanvas() {
    if (solidMaskCanvas) return solidMaskCanvas;
    const size = 8;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.fillRect(0, 0, size, size);
    solidMaskCanvas = c;
    return c;
  }

  /** Diagonal-hatch mask for the influence overlay's "contested" tiles --
   *  same stripe geometry as overlays.js's drawHatch (spacing/lineWidth
   *  fractions), just stroked colorless/opaque here since tintFS supplies
   *  the real color+alpha; drawHatch itself bakes both directly into the
   *  stroke and so isn't reusable as-is for a shape-only mask. */
  let hatchMaskCanvas = null;
  function makeHatchMaskCanvas() {
    if (hatchMaskCanvas) return hatchMaskCanvas;
    const size = 32;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const ctx = c.getContext("2d");
    ctx.strokeStyle = "rgba(255,255,255,1)";
    ctx.lineWidth = 1.5;
    const spacing = size * 0.18;
    for (let i = -size; i < size * 2; i += spacing) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
    hatchMaskCanvas = c;
    return c;
  }

  /** Uploads the sprite's FULL sheet (no crop) so every animation frame is
   *  available -- see collectBillboards/uFrameUVMin/Max for how a specific
   *  frame gets picked out at draw time. Padding is still measured from
   *  frame 0 only (assumed representative of the whole idle cycle -- an
   *  idle animation sways/bobs a character but its ground anchor point
   *  should stay put, and this only needs to be roughly right). */
  function getBillboardTexture(st, image, manifest) {
    let entry = st.billboardTexCache.get(image);
    if (entry) return entry;
    const gl = st.gl;
    // Also accepts a <canvas> (naturalWidth/Height don't exist there, only
    // width/height) -- see makeFallbackMarkerCanvas, which reuses this same
    // texture pipeline for race-colored markers instead of duplicating it.
    const iw = image.naturalWidth || image.width || 1, ih = image.naturalHeight || image.height || 1;
    const fw = manifest.frameWidth || iw, fh = manifest.frameHeight || ih;
    let bottomPadFrac = 0;
    try {
      const c = document.createElement("canvas");
      c.width = fw; c.height = fh;
      const cctx = c.getContext("2d");
      cctx.drawImage(image, 0, 0, fw, fh, 0, 0, fw, fh);
      const data = cctx.getImageData(0, 0, fw, fh).data;
      let padRows = 0;
      outer:
      for (let row = fh - 1; row >= 0; row--) {
        for (let col = 0; col < fw; col++) {
          if (data[(row * fw + col) * 4 + 3] > 10) break outer;
        }
        padRows++;
      }
      bottomPadFrac = fh > 0 ? padRows / fh : 0;
    } catch (e) {
      // getImageData can throw on a tainted canvas (e.g. asset served
      // cross-origin without CORS headers) -- fall back to no padding
      // correction rather than breaking the whole billboard.
      bottomPadFrac = 0;
    }
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    } catch (e) {
      // A WebGL texture upload requires the image be same-origin or served
      // with CORS headers. Serving the game over HTTP (the only supported
      // way to run it) satisfies that, so this should never fire -- but a
      // future asset pulled from another origin without CORS would land
      // here. `tex: null` signals every caller (billboard draw loop,
      // road/river decal builders) to skip this asset rather than crash.
      gl.deleteTexture(tex);
      console.warn("[render3d] Texture upload failed for an asset (not same-origin/CORS-enabled); skipping it.", e);
      entry = { tex: null, aspect: fw / fh, bottomPadFrac, imgW: iw, imgH: ih };
      st.billboardTexCache.set(image, entry);
      return entry;
    }
    entry = { tex, aspect: fw / fh, bottomPadFrac, imgW: iw, imgH: ih };
    st.billboardTexCache.set(image, entry);
    return entry;
  }

  function makeBillboardVbo(gl, width, height) {
    const x0=-width/2, x1=width/2, y0=0, y1=height;
    const verts = [
      x0,y0, 0,0,  x1,y0, 1,0,  x1,y1, 1,1,
      x0,y0, 0,0,  x1,y1, 1,1,  x0,y1, 0,1,
    ];
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.DYNAMIC_DRAW);
    return vbo;
  }

  // Cities currently on the map, by tile index -- used to nudge a garrisoned
  // unit's billboard off-center so it doesn't perfectly overlap its city's.
  function buildCityTileSet(gameState, mapWidth) {
    const set = new Set();
    for (const civId of Object.keys(gameState.civs)) {
      const civ = gameState.civs[civId];
      if (civ.eliminated) continue;
      for (const city of civ.cities) set.add(city.y * mapWidth + city.x);
    }
    return set;
  }

  /** { visible, explored } tile index sets for whoever's "eyes" we're
   *  rendering through -- mirrors render.js's own humanCivId/spectator
   *  split exactly, including the Interface menu's spectator fog-mode
   *  selector (off/all/selected + fogCivIds), so 3D respects the same fog
   *  rules 2D does rather than always showing an omniscient view. */
  function resolveFogSets(gameState, viewState) {
    const map = gameState.map;
    if (viewState.humanCivId) {
      return {
        visible: gameState.visibility[viewState.humanCivId] || new Set(),
        explored: gameState.explored?.[viewState.humanCivId] || new Set(),
      };
    }
    const mode = viewState.fogMode || "off";
    if (mode === "off") {
      const full = new Set();
      for (let i = 0; i < map.tiles.length; i++) full.add(i);
      return { visible: full, explored: full };
    }
    const civIds = mode === "selected" ? [...(viewState.fogCivIds || [])] : Object.keys(gameState.civs);
    const visible = new Set(), explored = new Set();
    for (const civId of civIds) {
      const vis = gameState.visibility[civId];
      if (vis) for (const idx of vis) visible.add(idx);
      const exp = gameState.explored?.[civId];
      if (exp) for (const idx of exp) explored.add(idx);
    }
    return { visible, explored };
  }

  /** Builds/updates the 1-texel-per-tile fog mask (see FOG_GLSL_FS): 0 =
   *  never explored, 128 = explored but not currently visible, 255 =
   *  currently visible. Cheap enough to rebuild every frame (a handful of
   *  thousand Set.has() checks even on the largest maps) rather than only
   *  when visibility actually changes, which would need its own dirty-
   *  tracking for no real benefit at this size. Takes the already-resolved
   *  {visible, explored} sets (see render()) rather than calling
   *  resolveFogSets itself -- buildWallGroup/collectBillboards need the
   *  same sets this same frame, and re-deriving them (each a fresh
   *  Object.keys/Set.add pass, or a full map.tiles.length Set in
   *  spectator "off" mode) 3-4 times per frame is pure waste. */
  function updateFogMaskTexture(st, map, visible, explored) {
    const gl = st.gl;
    const w = map.width, h = map.height;
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) {
      mask[i] = visible.has(i) ? 255 : explored.has(i) ? 128 : 0;
    }
    gl.bindTexture(gl.TEXTURE_2D, st.fogTexture);
    // ensureInit sets UNPACK_FLIP_Y_WEBGL=true globally (needed for image-
    // sourced textures -- terrain materials, sprites). This mask is a raw
    // data array, not an image; flipping it would swap vMapUV's north/south
    // sense against how mask[] is actually laid out (row 0 = tz=0), so it's
    // turned off just for this upload.
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    if (st.fogTexW !== w || st.fogTexH !== h) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, w, h, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, mask);
      st.fogTexW = w; st.fogTexH = h;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.LUMINANCE, gl.UNSIGNED_BYTE, mask);
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }

  /** Ported from render.js's wallOrientation (not exported there) -- see its
   *  own comment for why walls pick between purpose-authored orientation
   *  variants instead of rotating one stub like roads/rivers do (a wall's
   *  art has an upright tree growing through the stonework that a 90deg
   *  rotation would tip onto its side). */
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

  /** Real sprite if one loaded, else render.js's own fallback (a race-
   *  colored disc + initial -- see makeFallbackMarkerCanvas), instead of
   *  the old behavior of silently rendering nothing for any unit/building
   *  whose art isn't shipped yet, which for a race/civ combo with
   *  incomplete art coverage reads as "no units are showing up at all". */
  function resolveBillboardSprite(sprite, color, label) {
    if (sprite && sprite.image && sprite.image.complete) {
      return { image: sprite.image, manifest: sprite.manifest || singleFrameManifest(sprite.image) };
    }
    const marker = makeFallbackMarkerCanvas(color, label);
    return { image: marker, manifest: singleFrameManifest(marker) };
  }

  /** `visible` is resolved once per frame by render() and passed in -- see
   *  updateFogMaskTexture's comment for why. */
  // Small per-tile fan-out for units sharing a tile (a garrison, a stacked
  // army waiting to attack, several units boarding the same carrier's tile
  // before embarking) -- without this, every such unit's billboard quad
  // lands at the EXACT same world (x,z), and with depth testing on (see
  // ensureInit's gl.enable(DEPTH_TEST)) that's textbook z-fighting: which
  // coincident quad wins the depth test flips on sub-pixel floating-point
  // noise as the camera moves (this game's fly-camera moves every frame),
  // so one sprite visibly blinks in and out from one frame to the next.
  // Confirmed live (2026-07-31 spectator "sprites disappear" investigation)
  // -- two garrisoned units landed at identical __gx/__gz. The first unit
  // on a tile stays dead-center (matches the common single-occupant case
  // exactly as before); the 2nd+ fan out around it in a small ring, spaced
  // by the golden angle so the pattern never lines up into a visible grid.
  const UNIT_STACK_OFFSET = 0.14;
  const GOLDEN_ANGLE = 2.39996;
  function unitStackOffset(n) {
    if (n === 0) return { dx: 0, dz: 0 };
    const angle = n * GOLDEN_ANGLE;
    return { dx: Math.cos(angle) * UNIT_STACK_OFFSET, dz: Math.sin(angle) * UNIT_STACK_OFFSET };
  }

  function collectBillboards(gameState, viewState, mapWidth, visible) {
    const list = [];
    const map = gameState.map;
    const cityTiles = buildCityTileSet(gameState, mapWidth);
    const unitStackCounts = new Map(); // tile idx -> units already placed there this frame
    for (const civId of Object.keys(gameState.civs)) {
      const civ = gameState.civs[civId];
      if (civ.eliminated) continue;
      const race = window.GameData.getRace(civ.raceId);
      for (const city of civ.cities) {
        const idx = city.y * mapWidth + city.x;
        if (!visible.has(idx)) continue;
        const pop = Math.floor(city.population);
        const tiered = window.UI.sprites.pickCityTier(civ.raceId, pop);
        const sprite = tiered || window.UI.sprites.pick(`city/${civ.raceId}`, city);
        const resolved = resolveBillboardSprite(sprite, race.color, "C");
        list.push({ x: city.x, y: city.y, dx: 0, dz: 0, image: resolved.image, manifest: resolved.manifest, seed: city, size: CITY_HEIGHT, sizeAxis: "height", blend: CITY_BLEND, kind: "city", civId, city });
        for (const s of city.structures) {
          const building = window.GameData.getBuilding(s.id);
          if (building.isWall) continue; // real 3D geometry now -- see buildWallGroup, drawn separately
          const sIdx = s.y * mapWidth + s.x;
          if (!visible.has(sIdx)) continue;
          const sSprite = window.UI.sprites.pickBuilding(s.id, civ.raceId, s);
          const sLabel = (building.label || building.symbol || "?").charAt(0).toUpperCase();
          const sResolved = resolveBillboardSprite(sSprite, race.color, sLabel);
          list.push({ x: s.x, y: s.y, dx: 0, dz: 0, image: sResolved.image, manifest: sResolved.manifest, seed: s, size: STRUCTURE_WIDTH, sizeAxis: "width", blend: STRUCTURE_BLEND, kind: "structure", civId, structure: s });
        }
      }
      for (const unit of civ.units) {
        if (unit.carriedBy) continue; // aboard a carrier -- not drawn at its stale tile (mirrors render.js's 2D unit loop)
        const idx = unit.y * mapWidth + unit.x;
        if (!visible.has(idx)) continue;
        if (unit.conditions && unit.conditions.hidden && viewState.humanCivId != null && unit.civId !== viewState.humanCivId) continue;
        const sprite = window.UI.sprites.pickUnit(unit.typeId, civ.raceId, unit);
        const baseUnit = window.GameData.UNITS[unit.typeId];
        const uLabel = (baseUnit && baseUnit.label || "?").charAt(0).toUpperCase();
        const uResolved = resolveBillboardSprite(sprite, race.color, uLabel);
        const onCityTile = cityTiles.has(idx);
        const stackN = unitStackCounts.get(idx) || 0;
        unitStackCounts.set(idx, stackN + 1);
        const stackOffset = unitStackOffset(stackN);
        // Same visual-position glide 2D uses (getVisualPos, exported from
        // render.js for this reuse) -- units move instantly in game logic
        // (a whole turn resolves in one call), but both views re-render
        // every animation frame regardless of turn timing, so without this
        // a unit would just pop to its destination tile instead of sliding
        // there. Shared state on the unit object itself, so glide progress
        // stays consistent even if the player toggles between 2D/3D mid-move.
        const visPos = window.UI.render.getVisualPos(unit);
        list.push({
          x: visPos.x, y: visPos.y, dx: (onCityTile ? 0.28 : 0) + stackOffset.dx, dz: stackOffset.dz,
          image: uResolved.image, manifest: uResolved.manifest, seed: unit, size: UNIT_HEIGHT, sizeAxis: "height", blend: UNIT_BLEND,
          color: race.color, kind: "unit", civId, unit,
        });
      }
    }
    return list;
  }

  const FOV_DEG = 45; // must match render()'s mat4Perspective call -- shared by pickTileAtClient's ray construction

  function cameraEyeAndBasis(cam) {
    const elevRad = cam.elevationDeg * Math.PI / 180;
    const eye = [
      cam.target[0] + cam.distance * Math.cos(elevRad) * Math.sin(cam.azimuth),
      cam.target[1] + cam.distance * Math.sin(elevRad),
      cam.target[2] + cam.distance * Math.cos(elevRad) * Math.cos(cam.azimuth),
    ];
    const camBack = norm(sub(eye, cam.target));
    const camRight = norm(cross([0,1,0], camBack));
    const camUp = cross(camBack, camRight);
    return { eye, camRight, camUp, camBack };
  }

  /** Ray-casts a screen click into a tile (x,y), or null if it misses the
   *  map entirely. No depth buffer / mesh intersection needed -- every tile
   *  is still a flat plateau (just not all tiles of one terrain type share
   *  an exact height anymore, see elevationVarianceAt), so this intersects
   *  the ray against every DISTINCT real height actually present in the
   *  built map (st.heightPlanes, collected once in buildTerrainMesh -- far
   *  fewer than one-per-tile since most land tiles still share height 0),
   *  keeps only hits that land on a tile whose OWN real height actually
   *  matches that plane (a hit on, say, the water plane that lands on a
   *  plains tile's footprint is a false positive -- that tile isn't
   *  actually at water height, so skip it), and picks the closest
   *  surviving hit to the camera -- which naturally handles a mountain
   *  occluding whatever is behind it, the same way real depth testing
   *  would. */
  function pickTileAtClient(canvas, map, clientX, clientY) {
    if (!canvas.__cam || canvas.width === 0 || canvas.height === 0) return null;
    const cam = canvas.__cam;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const pxDpr = canvas.width / rect.width, pyDpr = canvas.height / rect.height;
    const px = (clientX - rect.left) * pxDpr;
    const py = (clientY - rect.top) * pyDpr;
    const ndcX = (px / canvas.width) * 2 - 1;
    const ndcY = 1 - (py / canvas.height) * 2;
    const { eye, camRight, camUp, camBack } = cameraEyeAndBasis(cam);
    const aspect = canvas.width / canvas.height;
    const halfHeight = Math.tan((FOV_DEG * Math.PI / 180) / 2);
    const halfWidth = halfHeight * aspect;
    const dir = norm([
      -camBack[0] + ndcX*halfWidth*camRight[0] + ndcY*halfHeight*camUp[0],
      -camBack[1] + ndcX*halfWidth*camRight[1] + ndcY*halfHeight*camUp[1],
      -camBack[2] + ndcX*halfWidth*camRight[2] + ndcY*halfHeight*camUp[2],
    ]);
    let best = null;
    const planes = (state && state.canvas === canvas && state.heightPlanes) ? state.heightPlanes : new Set(Object.values(HEIGHT_BY_TERRAIN));
    for (const planeY of planes) {
      if (Math.abs(dir[1]) < 1e-6) continue;
      const t = (planeY - eye[1]) / dir[1];
      if (t <= 0) continue;
      const hitX = eye[0] + dir[0]*t, hitZ = eye[2] + dir[2]*t;
      const tx = Math.floor(hitX / TILE + map.width/2);
      const tz = Math.floor(hitZ / TILE + map.height/2);
      if (tx < 0 || tx >= map.width || tz < 0 || tz >= map.height) continue;
      if (Math.abs(cellHeight(map, tx, tz) - planeY) > 1e-4) continue;
      if (!best || t < best.t) best = { t, tx, tz };
    }
    return best ? { x: best.tx, y: best.tz } : null;
  }

  /** Projects a world-space point to canvas pixel coordinates -- the
   *  inverse of pickTileAtClient's ray cast, using the exact same camera
   *  basis/FOV math (so the two stay consistent with each other). Returns
   *  null if the point is behind the camera (nothing meaningful to draw
   *  there). Used by the HUD overlay pass (drawHud) to anchor screen-space
   *  UI -- HP bars, selection rings, condition badges, quips, floating
   *  text, combat slashes -- to a unit/city/structure's real 3D position,
   *  since those elements are drawn on a separate 2D canvas layered over
   *  the WebGL canvas rather than as WebGL geometry themselves. */
  function worldToScreen(canvas, wx, wy, wz) {
    if (!canvas.__cam || canvas.width === 0 || canvas.height === 0) return null;
    const cam = canvas.__cam;
    const { eye, camRight, camUp, camBack } = cameraEyeAndBasis(cam);
    const aspect = canvas.width / canvas.height;
    const halfHeight = Math.tan((FOV_DEG * Math.PI / 180) / 2);
    const halfWidth = halfHeight * aspect;
    const rx = wx - eye[0], ry = wy - eye[1], rz = wz - eye[2];
    const vx = rx * camRight[0] + ry * camRight[1] + rz * camRight[2];
    const vy = rx * camUp[0] + ry * camUp[1] + rz * camUp[2];
    const vz = rx * camBack[0] + ry * camBack[1] + rz * camBack[2];
    const depth = -vz; // camBack points AWAY from where the camera looks
    if (depth <= 1e-4) return null;
    const ndcX = vx / (depth * halfWidth);
    const ndcY = vy / (depth * halfHeight);
    return {
      x: (ndcX + 1) / 2 * canvas.width,
      y: (1 - ndcY) / 2 * canvas.height,
      depth,
    };
  }

  /** Local screen-space pixels-per-world-tile at world point (wx,wy,wz) --
   *  projects that point and a point one tile-width further along world X,
   *  and measures the pixel distance between them. Perspective means this
   *  varies by depth and screen position, unlike the 2D renderer's single
   *  global `ts` constant, so HUD elements must recompute it per anchor
   *  rather than reuse one value for the whole frame. Returns 0 if either
   *  projection fails (point behind camera) -- callers should skip drawing
   *  in that case rather than divide by it. */
  function localPixelScale(canvas, wx, wy, wz) {
    const a = worldToScreen(canvas, wx, wy, wz);
    const b = worldToScreen(canvas, wx + TILE, wy, wz);
    if (!a || !b) return 0;
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  // ---------- camera controls + click-to-select ----------
  // Continuous keyboard "fly" pan (item -- see file header): WASD/arrows
  // move the camera target across the ground plane while held, speed
  // scaled by current zoom distance (so panning feels consistent whether
  // zoomed in tight or pulled back) and real elapsed time (frame-rate
  // independent). Global listeners (not on the canvas) since a canvas
  // needs explicit focus to receive key events otherwise, and the player
  // shouldn't have to click the map first -- guarded by both "is 3D mode
  // actually showing" and "is the player typing somewhere else" so this
  // never steals keys from a text field or from 2D mode.
  const PAN_KEYS = {
    w: [0,-1], ArrowUp: [0,-1], s: [0,1], ArrowDown: [0,1],
    a: [-1,0], ArrowLeft: [-1,0], d: [1,0], ArrowRight: [1,0],
  };
  function isTypingInField() {
    const el = document.activeElement;
    return !!(el && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA"));
  }
  function attachControls(canvas) {
    if (canvas.__render3dControlsAttached) return;
    canvas.__render3dControlsAttached = true;
    canvas.__heldPanKeys = new Set();
    let dragging = false, dragButton = 0, lastX = 0, lastY = 0, downX = 0, downY = 0, dragMoved = false;
    const CLICK_MOVE_THRESHOLD = 4; // px -- matches input.js's dragMoved suppression
    canvas.style.touchAction = "none";
    canvas.addEventListener("contextmenu", (e) => e.preventDefault()); // right-drag pans instead of opening a menu
    canvas.addEventListener("pointerdown", (e) => {
      if (!canvas.__cam) return;
      dragging = true; dragButton = e.button; dragMoved = false;
      lastX = e.clientX; lastY = e.clientY;
      downX = e.clientX; downY = e.clientY;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging || !canvas.__cam) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > CLICK_MOVE_THRESHOLD) dragMoved = true;
      const cam = canvas.__cam;
      if (dragButton === 2) {
        // Right-drag: pan the target across the ground plane, same basis
        // the keyboard fly controls use, scaled by distance so a drag
        // covers the same apparent ground distance at any zoom level.
        const { camRight, camBack } = cameraEyeAndBasis(cam);
        const fwdGround = norm([-camBack[0], 0, -camBack[2]]);
        const rightGround = norm([camRight[0], 0, camRight[2]]);
        const scale = cam.distance * 0.0018;
        cam.target[0] += (-rightGround[0]*dx + fwdGround[0]*dy) * scale;
        cam.target[2] += (-rightGround[2]*dx + fwdGround[2]*dy) * scale;
      } else {
        cam.azimuth -= dx * 0.008;
        cam.elevationDeg = Math.max(20, Math.min(85, cam.elevationDeg - dy * 0.15));
      }
    });
    function endDrag(e) {
      dragging = false;
      canvas.style.cursor = "grab";
      if (dragButton === 2 || dragMoved || !canvas.__gameState || !canvas.__viewState) return;
      const map = canvas.__gameState.map;
      const hit = pickTileAtClient(canvas, map, e.clientX, e.clientY);
      if (!hit) return;
      window.UI.input.handleTileClick(hit, canvas.__gameState, canvas.__viewState);
      // Must be the SAME post-selection refresh a 2D click triggers -- not
      // just re-rendering the sidebar's HTML, but re-wiring its action
      // buttons too (main.js's redraw() does both; a bare sidebar.render()
      // call would leave Rest/Defend/Disband/etc. with no click handler,
      // since replacing the sidebar's innerHTML drops the old ones). See
      // setRedrawCallback, wired once from main.js's setup.
      if (redrawCallback) redrawCallback();
      else if (window.UI.sidebar) window.UI.sidebar.render(document.getElementById("sidebar"), canvas.__gameState, canvas.__viewState);
    }
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", () => { dragging = false; canvas.style.cursor = "grab"; });
    canvas.addEventListener("wheel", (e) => {
      if (!canvas.__cam) return;
      e.preventDefault();
      const cam = canvas.__cam;
      cam.distance = Math.max(MIN_DISTANCE, Math.min(cam.maxDistance, cam.distance + e.deltaY * 0.04));
    }, { passive: false });
    canvas.style.cursor = "grab";

    window.addEventListener("keydown", (e) => {
      if (!(e.key in PAN_KEYS)) return;
      if (canvas.style.display === "none" || isTypingInField()) return;
      canvas.__heldPanKeys.add(e.key);
    });
    window.addEventListener("keyup", (e) => {
      if (e.key in PAN_KEYS) canvas.__heldPanKeys.delete(e.key);
    });
    // Held keys otherwise keep panning forever if focus leaves the page
    // entirely (alt-tab, etc.) while a key is physically still down --
    // window loses the eventual keyup.
    window.addEventListener("blur", () => canvas.__heldPanKeys.clear());
  }

  /** Applies this frame's share of any held WASD/arrow pan, scaled by real
   *  elapsed time (deltaMs) and current zoom distance -- see attachControls. */
  function applyKeyboardPan(canvas, cam, deltaMs) {
    const keys = canvas.__heldPanKeys;
    if (!keys || keys.size === 0) return;
    let fwd = 0, right = 0;
    for (const key of keys) {
      const [dx, dz] = PAN_KEYS[key];
      right += dx; fwd -= dz;
    }
    if (fwd === 0 && right === 0) return;
    const { camRight, camBack } = cameraEyeAndBasis(cam);
    const fwdGround = norm([-camBack[0], 0, -camBack[2]]);
    const rightGround = norm([camRight[0], 0, camRight[2]]);
    const speed = cam.distance * 1.1 * (deltaMs / 1000); // world units/sec, scaled by zoom
    cam.target[0] += (rightGround[0]*right + fwdGround[0]*fwd) * speed;
    cam.target[2] += (rightGround[2]*right + fwdGround[2]*fwd) * speed;
  }

  function resize(gl, canvas, dpr) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw; canvas.height = ph;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function render(canvas, gameState, viewState) {
    if (!gameState || !gameState.map) return;
    const now = performance.now();
    // Drains window.GameEngine.combat/quips/floatingText's pending-event
    // queues every frame regardless of which renderer is active -- before
    // this call existed here, those queues were only ever drained inside
    // render.js's own render() (see overlays.js's header comment), which
    // this function never calls, so with 3D as the default view the queues
    // grew unbounded for the whole game and nothing ever animated in 3D.
    window.UI.overlays.tick(now);
    const st = ensureInit(canvas);
    const gl = st.gl;
    const map = gameState.map;
    // Stashed for the click handler (attachControls), which fires from a
    // real DOM event outside render()'s call stack and needs the current
    // gameState/viewState to resolve a click into a selection.
    canvas.__gameState = gameState;
    canvas.__viewState = viewState;

    if (st.builtForMap !== map) {
      buildTerrainMesh(st, map);
      // Grid lines never move once built (see buildGridDecalGroup's own
      // comment) -- rebuilt alongside the terrain mesh, not every frame.
      if (st.gridDecalGroup) gl.deleteBuffer(st.gridDecalGroup.vbo);
      st.gridDecalGroup = buildGridDecalGroup(st, map);
    }

    const { visible: fogVisible, explored: fogExplored } = resolveFogSets(gameState, viewState);

    // Starting a new game (title screen -> game screen is not a page
    // reload, so the canvas element and everything hung off it survives
    // across games) must reset the camera, not just the terrain mesh --
    // otherwise a second game in the same browser session inherits
    // wherever the camera was left in the FIRST one, which has no
    // relationship to the new map at all (different seed, different size,
    // different fog state) and can easily be aimed at nothing but black.
    if (canvas.__cam && canvas.__camBuiltForMap !== map) canvas.__cam = null;

    if (!canvas.__cam) {
      canvas.__camBuiltForMap = map;
      // Default target/distance frame somewhere the fog system actually
      // shows something, not the map's geometric center -- centering on an
      // arbitrary point that happens to be unexplored (or, in spectator
      // games with the Fog of War panel set to All/Selected instead of the
      // default Off, simply not currently visible to anyone being watched)
      // reads as "nothing rendered at all" even though it's working
      // correctly (confirmed live: reported as "just a black screen" both
      // for a fresh human game and for a spectator game with fog enabled).
      //
      // Priority: the human player's own first unit (matches main.js's own
      // centerViewOnStart() for 2D) if there is one; otherwise any real
      // civ's city or unit that's currently visible (NOT the mathematical
      // centroid of every visible tile -- tried that first, but visible
      // territory is often an irregular, non-convex, or multi-blob shape,
      // so the coordinate AVERAGE can land in a gap between two explored
      // clusters that isn't itself visible at all, confirmed live: still
      // mostly black). Picking one real populated tile guarantees landing
      // somewhere actually rendered, since it's a member of the visible set
      // itself, not a synthetic point derived from it.
      let focusTx = null, focusTz = null;
      if (viewState.humanCivId) {
        const civ = gameState.civs[viewState.humanCivId];
        const unit = civ && civ.units[0];
        if (unit) { focusTx = unit.x; focusTz = unit.y; }
      }
      if (focusTx === null) {
        outer:
        for (const civId of Object.keys(gameState.civs)) {
          const civ = gameState.civs[civId];
          if (civ.eliminated) continue;
          for (const city of civ.cities) {
            if (fogVisible.has(city.y * map.width + city.x)) { focusTx = city.x; focusTz = city.y; break outer; }
          }
          for (const unit of civ.units) {
            if (fogVisible.has(unit.y * map.width + unit.x)) { focusTx = unit.x; focusTz = unit.y; break outer; }
          }
        }
      }
      if (focusTx === null && fogVisible.size > 0) {
        const idx = fogVisible.values().next().value; // any real visible tile, not an average
        focusTx = idx % map.width;
        focusTz = Math.floor(idx / map.width);
      }
      if (focusTx === null) { focusTx = map.width / 2; focusTz = map.height / 2; }
      canvas.__cam = {
        azimuth: 0.6, elevationDeg: 55,
        distance: 12, // close enough to clearly frame the starting area, not the whole map
        maxDistance: Math.max(map.width, map.height) * 2.2,
        target: [worldX(st, focusTx) + TILE/2, 0.15, worldZ(st, focusTz) + TILE/2],
      };
    }
    const cam = canvas.__cam;

    const deltaMs = canvas.__lastFrameAt ? Math.min(200, now - canvas.__lastFrameAt) : 16; // clamp a long gap (tab was hidden, etc.) instead of jumping
    canvas.__lastFrameAt = now;
    applyKeyboardPan(canvas, cam, deltaMs);

    resize(gl, canvas, st.dpr);
    if (canvas.width === 0 || canvas.height === 0) return;

    const { eye, camRight, camUp, camBack } = cameraEyeAndBasis(cam);
    const view = mat4LookAt(eye, cam.target, [0, 1, 0]);
    const aspect = canvas.width / canvas.height;
    const farPlane = Math.max(100, cam.maxDistance * 2);
    // Near plane deliberately NOT 0.1: the depth buffer's precision is
    // distributed non-linearly, almost all of it packed into the range just
    // past `near` -- with MIN_DISTANCE 4 (the camera never actually gets
    // closer than that to its target) and every billboard well under 1.2
    // world units tall, a near of 0.1 wastes essentially the whole depth
    // buffer on [0.1, ~1], a range nothing ever renders into, leaving almost
    // none for the [4, farPlane] range where the terrain/billboards actually
    // are. Cutting the far/near ratio by 10x is a real precision win
    // regardless, and 1.0 keeps a comfortable margin below MIN_DISTANCE
    // (nothing solid ever renders that close to the eye).
    const proj = mat4Perspective((FOV_DEG * Math.PI) / 180, aspect, 1.0, farPlane);
    const viewProj = mat4Multiply(proj, view);

    updateFogMaskTexture(st, map, fogVisible, fogExplored);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(st.terrainProg);
    gl.uniformMatrix4fv(st.t_uViewProj, false, viewProj);
    gl.uniform3f(st.t_uLightDir, 0.45, 1.0, 0.35);
    gl.uniform2f(st.t_uMapSize, map.width, map.height);
    gl.uniform1i(st.t_uTex, 0);
    gl.uniform1i(st.t_uFogTex, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, st.fogTexture);
    gl.activeTexture(gl.TEXTURE0);
    for (const g of st.terrainDrawGroups) {
      gl.bindTexture(gl.TEXTURE_2D, g.texture);
      gl.bindBuffer(gl.ARRAY_BUFFER, g.vbo);
      gl.enableVertexAttribArray(st.t_aPos);
      gl.vertexAttribPointer(st.t_aPos, 3, gl.FLOAT, false, st.tStride, 0);
      gl.enableVertexAttribArray(st.t_aNormal);
      gl.vertexAttribPointer(st.t_aNormal, 3, gl.FLOAT, false, st.tStride, 12);
      gl.enableVertexAttribArray(st.t_aUV);
      gl.vertexAttribPointer(st.t_aUV, 2, gl.FLOAT, false, st.tStride, 24);
      gl.enableVertexAttribArray(st.t_aSnow);
      gl.vertexAttribPointer(st.t_aSnow, 1, gl.FLOAT, false, st.tStride, 32);
      gl.drawArrays(gl.TRIANGLES, 0, g.vertCount);
    }

    // Walls: real 3D geometry, drawn through the same terrainProg (still
    // bound, same uniforms already set) rather than a dedicated shader --
    // see buildWallGroup's comment for why this is fog-safe despite reusing
    // the fog-aware terrain shader unmodified.
    const wallGroup = buildWallGroup(st, gameState, map, fogVisible);
    if (wallGroup) {
      gl.bindTexture(gl.TEXTURE_2D, wallGroup.texture);
      gl.bindBuffer(gl.ARRAY_BUFFER, wallGroup.vbo);
      gl.enableVertexAttribArray(st.t_aPos);
      gl.vertexAttribPointer(st.t_aPos, 3, gl.FLOAT, false, st.tStride, 0);
      gl.enableVertexAttribArray(st.t_aNormal);
      gl.vertexAttribPointer(st.t_aNormal, 3, gl.FLOAT, false, st.tStride, 12);
      gl.enableVertexAttribArray(st.t_aUV);
      gl.vertexAttribPointer(st.t_aUV, 2, gl.FLOAT, false, st.tStride, 24);
      gl.enableVertexAttribArray(st.t_aSnow);
      gl.vertexAttribPointer(st.t_aSnow, 1, gl.FLOAT, false, st.tStride, 32);
      gl.drawArrays(gl.TRIANGLES, 0, wallGroup.vertCount);
      gl.deleteBuffer(wallGroup.vbo); // rebuilt fresh every frame -- see buildWallGroup
    }

    // Water (rivers): real carved geometry drawn in buildTerrainMesh, but
    // the animated surface itself is its own program/draw -- this file's
    // first real alpha-blended surface, so gl.BLEND is enabled/disabled
    // tightly around just this one call rather than left on for the
    // decal/billboard draws that follow. Drawn before road decals so a
    // road crossing a river still reads as passing over it (matches
    // render.js's 2D river-under-road convention).
    if (st.riverWaterGroup) {
      gl.useProgram(st.waterProg);
      gl.uniformMatrix4fv(st.w_uViewProj, false, viewProj);
      gl.uniform2f(st.w_uMapSize, map.width, map.height);
      gl.uniform1f(st.w_uTime, performance.now() / 1000);
      gl.uniform1i(st.w_uFogTex, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, st.fogTexture);
      gl.bindBuffer(gl.ARRAY_BUFFER, st.riverWaterGroup.vbo);
      const wStride = 4 * 4;
      gl.enableVertexAttribArray(st.w_aPos);
      gl.vertexAttribPointer(st.w_aPos, 3, gl.FLOAT, false, wStride, 0);
      gl.enableVertexAttribArray(st.w_aSide);
      gl.vertexAttribPointer(st.w_aSide, 1, gl.FLOAT, false, wStride, 12);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.TRIANGLES, 0, st.riverWaterGroup.vertCount);
      gl.disable(gl.BLEND);
    }

    const roadDrawGroups = buildRoadDecalGroups(st, map);
    const billboards = collectBillboards(gameState, viewState, map.width, fogVisible);
    const shadowDrawGroups = buildShadowDecalGroups(st, map, billboards);
    gl.useProgram(st.decalProg);
    gl.uniformMatrix4fv(st.d_uViewProj, false, viewProj);
    gl.uniform2f(st.d_uMapSize, map.width, map.height);
    gl.uniform1i(st.d_uTex, 0);
    gl.uniform1i(st.d_uFogTex, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, st.fogTexture);
    gl.activeTexture(gl.TEXTURE0);
    for (const g of roadDrawGroups) drawDecalGroup(st, g);
    for (const g of roadDrawGroups) gl.deleteBuffer(g.vbo); // rebuilt fresh every frame -- see buildRoadDecalGroups
    for (const g of shadowDrawGroups) drawDecalGroup(st, g);
    for (const g of shadowDrawGroups) gl.deleteBuffer(g.vbo); // rebuilt fresh every frame, positions move every turn

    // Ground-tint overlays (grid/influence/aura -- see tintFS's own comment
    // for why these need a real alpha-blended shader instead of decalProg's
    // hard cutout). Grid is cached on st.gridDecalGroup (rebuilt only when
    // the map itself changes, see the st.builtForMap check above). Influence
    // is cached on st.influenceDecalGroups keyed to gameState.turnNumber
    // (territory only changes at turn-resolution boundaries). Aura is cheap
    // enough (a handful of units at most) to just rebuild every frame.
    if (viewState.showInfluence) {
      const turnKey = gameState.turnNumber || 0;
      if (st.influenceCacheKey !== turnKey || !st.influenceDecalGroups) {
        if (st.influenceDecalGroups) for (const g of st.influenceDecalGroups) gl.deleteBuffer(g.vbo);
        st.influenceDecalGroups = buildInfluenceDecalGroups(st, gameState, map, fogVisible);
        st.influenceCacheKey = turnKey;
      }
    } else if (st.influenceDecalGroups) {
      for (const g of st.influenceDecalGroups) gl.deleteBuffer(g.vbo);
      st.influenceDecalGroups = null;
      st.influenceCacheKey = null;
    }
    const auraDrawGroups = buildAuraDecalGroups(st, gameState, map, fogVisible);
    if (st.gridDecalGroup || (viewState.showInfluence && st.influenceDecalGroups) || auraDrawGroups.length) {
      gl.useProgram(st.tintProg);
      gl.uniformMatrix4fv(st.tint_uViewProj, false, viewProj);
      gl.uniform2f(st.tint_uMapSize, map.width, map.height);
      gl.uniform1i(st.tint_uTex, 0);
      gl.uniform1i(st.tint_uFogTex, 1);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, st.fogTexture);
      gl.activeTexture(gl.TEXTURE0);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      if (viewState.showGrid && st.gridDecalGroup) drawTintGroup(st, st.gridDecalGroup);
      if (viewState.showInfluence && st.influenceDecalGroups) {
        for (const g of st.influenceDecalGroups) drawTintGroup(st, g);
      }
      for (const g of auraDrawGroups) drawTintGroup(st, g);
      gl.disable(gl.BLEND);
    }
    for (const g of auraDrawGroups) gl.deleteBuffer(g.vbo); // rebuilt fresh every frame -- see buildAuraDecalGroups

    gl.useProgram(st.billboardProg);
    gl.uniformMatrix4fv(st.b_uViewProj, false, viewProj);
    gl.uniform3f(st.b_uRight, camRight[0], camRight[1], camRight[2]);
    gl.uniform1i(st.b_uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    const bStride = 4 * 4;
    for (const b of billboards) {
      const tex = getBillboardTexture(st, b.image, b.manifest);
      if (!tex.tex) continue; // texture upload failed (see notifyFileProtocolLimitation) -- nothing to draw
      let w, h;
      if (b.sizeAxis === "width") { w = b.size; h = w / tex.aspect; }
      else { h = b.size; w = h * tex.aspect; }
      const gx = worldX(st, b.x) + TILE/2 + b.dx, gz = worldZ(st, b.y) + TILE/2 + b.dz;
      const gy = cellHeight(map, b.x, b.y) - tex.bottomPadFrac * h;
      // Cached for the HUD overlay pass (drawHud, called after this WebGL
      // draw finishes) -- lets it anchor screen-space UI (HP bars, badges,
      // quips, ...) to the EXACT same world box just drawn here, without
      // re-deriving the texture lookup (tex.bottomPadFrac/aspect) itself.
      b.__gx = gx; b.__gz = gz; b.__gyBottom = gy; b.__gyTop = gy + h; b.__w = w; b.__h = h;
      const up = norm(mix3(camUp, [0, 1, 0], b.blend));
      gl.uniform3f(st.b_uUp, up[0], up[1], up[2]);
      // Per-instance idle-animation frame, via sprites.js's own state
      // machine (currentFrame) so 3D billboards animate exactly like 2D's
      // sprites do -- same hold/play/loop timing, same per-instance phase
      // (keyed on b.seed, the real unit/city/structure object) so units
      // don't all animate in lockstep.
      const frame = window.UI.sprites.currentFrame(b.manifest, "idle", b.seed);
      // Y is flipped relative to raw pixel rows: ensureInit sets
      // UNPACK_FLIP_Y_WEBGL=true (needed so a billboard's bottom edge, UV.y
      // 0, samples the source image's BOTTOM row -- e.g. a character's
      // feet -- matching the game's art convention), which means texture
      // V=0 corresponds to pixel row (imgH-1), not row 0. frame.sy/sh are
      // plain top-down pixel coordinates from sprites.js, so they need
      // inverting here (V = 1 - pixelRow/imgH), not used directly.
      const vTop = 1 - frame.sy / tex.imgH;
      const vBottom = 1 - (frame.sy + frame.sh) / tex.imgH;
      gl.uniform2f(st.b_uFrameUVMin, frame.sx / tex.imgW, vBottom);
      gl.uniform2f(st.b_uFrameUVMax, (frame.sx + frame.sw) / tex.imgW, vTop);
      gl.bindTexture(gl.TEXTURE_2D, tex.tex);
      const vbo = makeBillboardVbo(gl, w, h);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.disableVertexAttribArray(st.b_aCenter);
      gl.vertexAttrib3f(st.b_aCenter, gx, gy, gz);
      gl.enableVertexAttribArray(st.b_aOffset);
      gl.vertexAttribPointer(st.b_aOffset, 2, gl.FLOAT, false, bStride, 0);
      gl.enableVertexAttribArray(st.b_aUV);
      gl.vertexAttribPointer(st.b_aUV, 2, gl.FLOAT, false, bStride, 8);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.deleteBuffer(vbo);
    }

    drawHud(canvas, gameState, viewState, billboards, map, fogVisible, now);
  }

  /** Same resize convention as the WebGL canvas's own resize() -- CSS size
   *  times devicePixelRatio -- kept in exact pixel agreement with `canvas`
   *  so worldToScreen's projections (computed against `canvas`'s own
   *  width/height) land at the right spot on this overlay. Cached on the
   *  hud canvas element itself; resize() only touches it when it's
   *  actually out of date, same guard style as the WebGL canvas's resize. */
  function getHudCtx(canvas) {
    const hud = document.getElementById("map-canvas-3d-hud");
    if (!hud) return null;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
    if (hud.width !== pw || hud.height !== ph) { hud.width = pw; hud.height = ph; }
    if (!hud.__ctx) hud.__ctx = hud.getContext("2d");
    return hud.__ctx;
  }

  /** Projects a footprint of `radius` tiles around tile (cx,cz) to screen
   *  and strokes its outline -- used for the aura-radius perimeter and the
   *  city-influence-radius debug border (render.js draws both as a plain
   *  axis-aligned strokeRect in its own flat tile-grid space; there's no
   *  single affine transform that does the same in a perspective camera,
   *  so this projects the footprint's actual 4 world-space corners and
   *  strokes whatever quadrilateral they land on instead of assuming a
   *  screen-space rectangle). All 4 corners sample ground height at the
   *  center tile (cx,cz) rather than each corner's own terrain height -- a
   *  flat approximation, same tier of fidelity as drawAreaEffectBox's
   *  bounding box, reasonable for the small radii these overlays ever use. */
  function strokeProjectedFootprint(ctx, canvas, map, cx, cz, radius, color, alpha, dashed) {
    const y = cellHeight(map, cx, cz) + AURA_Y_LIFT + 0.002; // just above the aura/influence fill so it doesn't z-fight
    const x0 = worldX({ mapWidth: map.width }, cx - radius), x1 = worldX({ mapWidth: map.width }, cx + radius + 1);
    const z0 = worldZ({ mapHeight: map.height }, cz - radius), z1 = worldZ({ mapHeight: map.height }, cz + radius + 1);
    const corners = [
      worldToScreen(canvas, x0, y, z0), worldToScreen(canvas, x1, y, z0),
      worldToScreen(canvas, x1, y, z1), worldToScreen(canvas, x0, y, z1),
    ];
    if (corners.some((c) => !c)) return; // some corner behind the camera -- skip rather than draw a garbled partial shape
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2;
    if (dashed) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < corners.length; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Screen-space HUD overlay for the 3D view -- HP bars, selection rings,
   * condition badges/tints, channel labels, quips, floating text, combat
   * slashes/shake, plus the aura/city-border outlines and (when enabled)
   * the Tile City Score debug numbers. Everything here is genuinely
   * screen-space (drawn on the transparent #map-canvas-3d-hud canvas
   * layered over the WebGL canvas, see index.html/style.css), unlike the
   * ground-plane tint decals above which are real WebGL geometry --
   * projected per-anchor via worldToScreen/localPixelScale rather than a
   * single affine transform, since perspective means there's no one
   * (offsetX,offsetY,ts) that maps the whole frame the way the 2D renderer
   * gets away with.
   *
   * Draws directly off `billboards` (already fog/hidden-filtered by
   * collectBillboards -- see its own comments) so unit/city/structure HUD
   * elements automatically respect the exact same visibility rules as the
   * billboards actually drawn this frame, with no separate filtering
   * needed here.
   */
  function drawHud(canvas, gameState, viewState, billboards, map, visible, now) {
    const ctx = getHudCtx(canvas);
    if (!ctx) return;
    const hud = ctx.canvas;
    ctx.clearRect(0, 0, hud.width, hud.height);
    const overlays = window.UI.overlays;
    const { selectedUnit, selectedCity, humanCivId } = viewState;

    // Tile City Score debug overlay (Interface menu) -- independent of the
    // CURRENT viewer's own fog, same as render.js's own tileScoreMemory
    // read (always the selected race's own discovered scores, regardless
    // of who's actually watching), so this iterates the memory object's
    // own keys rather than gating on `visible`.
    if (viewState.tileScoreCivId) {
      const mem = gameState.tileMemory?.[viewState.tileScoreCivId];
      if (mem) {
        for (const idxKey of Object.keys(mem)) {
          const score = mem[idxKey]?.cityScore;
          if (score == null) continue;
          const idx = Number(idxKey);
          const tx = idx % map.width, tz = Math.floor(idx / map.width);
          const cx = worldX({ mapWidth: map.width }, tx) + TILE / 2, cz = worldZ({ mapHeight: map.height }, tz) + TILE / 2;
          const y = cellHeight(map, tx, tz) + AURA_Y_LIFT + 0.003;
          const p = worldToScreen(canvas, cx, y, cz);
          if (!p) continue;
          const ts = localPixelScale(canvas, cx, y, cz);
          if (ts <= 0) continue;
          overlays.drawTileScoreOverlay(ctx, p.x - ts / 2, p.y - ts / 2, ts, score);
        }
      }
    }

    // Aura-radius perimeter outline -- unconditional, same as render.js's
    // own aura loop (not gated by showInfluence; the fill is a ground decal,
    // see buildAuraDecalGroups, the outline is screen-space here).
    for (const civ of Object.values(gameState.civs)) {
      for (const unit of civ.units) {
        const aura = overlays.auraInfoForUnit(unit, civ);
        if (!aura) continue;
        const idx = unit.y * map.width + unit.x;
        if (!visible.has(idx)) continue;
        strokeProjectedFootprint(ctx, canvas, map, unit.x, unit.y, aura.radius, aura.color, 0.85, false);
      }
    }

    // City influence-radius debug border -- gated on showInfluence, same as
    // render.js's own city-border loop.
    if (viewState.showInfluence) {
      for (const civ of Object.values(gameState.civs)) {
        const race = window.GameData.getRace(civ.raceId);
        for (const city of civ.cities) {
          const idx = city.y * map.width + city.x;
          if (!visible.has(idx)) continue;
          strokeProjectedFootprint(ctx, canvas, map, city.x, city.y, city.influenceRadius, race.color, 1, true);
        }
      }
    }

    // Per-billboard HUD: HP bars, selection rings, condition badges/tints,
    // channel labels, quips, floating text -- queued quip/floating-text
    // draws happen AFTER this loop (see below), same layering render.js
    // uses (drawn last so they're never occluded by a later unit/effect).
    const quipQueue = [], floatQueue = [];
    for (const b of billboards) {
      if (b.__gx == null) continue; // this billboard's texture failed to load this frame (see the WebGL loop above) -- nothing to anchor to
      const top = worldToScreen(canvas, b.__gx, b.__gyTop, b.__gz);
      const bottom = worldToScreen(canvas, b.__gx, b.__gyBottom, b.__gz);
      if (!top || !bottom) continue;
      const boxSize = Math.max(1, Math.hypot(bottom.x - top.x, bottom.y - top.y));
      let boxX = top.x - boxSize / 2, boxY = top.y;
      const ts = localPixelScale(canvas, b.__gx, b.__gyBottom, b.__gz);
      const screenX = top.x - ts / 2, screenY = top.y;

      if (b.kind === "unit") {
        const unit = b.unit;
        const shake = overlays.getUnitShakeOffset(unit, ts, now);
        boxX += shake.x; boxY += shake.y;
        const sx = screenX + shake.x, sy = screenY + shake.y;

        overlays.drawConditionVisualEffects(ctx, unit, { image: b.image, manifest: b.manifest }, boxX, boxY, boxSize, now);

        if (unit.hp != null && unit.maxHp && unit.hp < unit.maxHp) {
          const pct = Math.max(0, unit.hp / unit.maxHp);
          const barW = boxSize - 4, barX = boxX + 2, barY = boxY + boxSize - 3;
          ctx.fillStyle = "#400"; ctx.fillRect(barX, barY, barW, 2);
          ctx.fillStyle = "#4caf50"; ctx.fillRect(barX, barY, barW * pct, 2);
        }
        if (selectedUnit === unit) {
          ctx.strokeStyle = "#ffeb3b"; ctx.lineWidth = 2;
          ctx.strokeRect(boxX + 1, boxY + 1, boxSize - 2, boxSize - 2);
        }
        overlays.drawConditionBadges(ctx, unit, boxX, boxY, boxSize, ts);
        overlays.drawChannelStashLabel(ctx, unit, sx, sy, ts);
        if (overlays.hasActiveQuip(unit)) quipQueue.push({ unit, screenX: sx, screenY: sy, ts });
        if (overlays.hasActiveFloatingText(unit)) floatQueue.push({ unit, screenX: sx, screenY: sy, ts });
      } else if (b.kind === "structure") {
        const s = b.structure;
        if (s.hp < s.maxHp) {
          const barPad = boxSize * 0.1, bw = boxSize - barPad * 2, bh = Math.max(2, boxSize * 0.08);
          const bx = boxX + barPad, by = boxY + boxSize - barPad - bh;
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(bx, by, bw, bh);
          ctx.fillStyle = "#5fbf5f"; ctx.fillRect(bx, by, bw * Math.max(0, s.hp) / s.maxHp, bh);
        }
        if (overlays.hasActiveFloatingText(s)) floatQueue.push({ unit: s, screenX, screenY, ts });
      } else if (b.kind === "city") {
        const city = b.city;
        const pop = Math.floor(city.population);
        ctx.save();
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(9, boxSize * 0.22)}px monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.strokeStyle = "#000"; ctx.lineWidth = 2;
        const px = boxX + boxSize / 2, py = boxY + boxSize * 0.85;
        ctx.strokeText(String(pop), px, py);
        ctx.fillText(String(pop), px, py);
        ctx.restore();
        if (selectedCity === city) {
          ctx.strokeStyle = "#ffeb3b"; ctx.lineWidth = 2;
          ctx.strokeRect(boxX + 1, boxY + 1, boxSize - 2, boxSize - 2);
        }
      }
    }

    // Area effects (Blade Storm sweep / Fireball splash -- see
    // combat.js's spawnAreaEffect) -- each effect's own screen-space
    // bounding box, projected from its world footprint corners (see
    // drawAreaEffectBox's own comment on why this can't reuse render.js's
    // single-affine-transform version).
    for (const a of overlays.getActiveAreaEffects()) {
      const y = cellHeight(map, Math.max(0, Math.min(map.width - 1, a.x)), Math.max(0, Math.min(map.height - 1, a.y))) + AURA_Y_LIFT + 0.004;
      const x0 = worldX({ mapWidth: map.width }, a.x - a.radius), x1 = worldX({ mapWidth: map.width }, a.x + a.radius + 1);
      const z0 = worldZ({ mapHeight: map.height }, a.y - a.radius), z1 = worldZ({ mapHeight: map.height }, a.y + a.radius + 1);
      const c0 = worldToScreen(canvas, x0, y, z0), c1 = worldToScreen(canvas, x1, y, z1);
      if (!c0 || !c1) continue;
      const minX = Math.min(c0.x, c1.x), maxX = Math.max(c0.x, c1.x);
      const minY = Math.min(c0.y, c1.y), maxY = Math.max(c0.y, c1.y);
      const ts = localPixelScale(canvas, (x0 + x1) / 2, y, (z0 + z1) / 2);
      overlays.drawAreaEffectBox(ctx, a, minX, minY, maxX, maxY, Math.max(1, ts), now);
    }

    // Combat slashes -- each anim's own attacker/defender tile projected
    // individually (see drawCombatSlashAt's own comment).
    for (const a of overlays.getActiveCombatAnims()) {
      const ay = cellHeight(map, Math.max(0, Math.min(map.width - 1, a.ax)), Math.max(0, Math.min(map.height - 1, a.ay))) + AURA_Y_LIFT + 0.004;
      const dy = cellHeight(map, Math.max(0, Math.min(map.width - 1, a.dx)), Math.max(0, Math.min(map.height - 1, a.dy))) + AURA_Y_LIFT + 0.004;
      const aw = worldX({ mapWidth: map.width }, a.ax) + TILE / 2, az = worldZ({ mapHeight: map.height }, a.ay) + TILE / 2;
      const dw = worldX({ mapWidth: map.width }, a.dx) + TILE / 2, dz = worldZ({ mapHeight: map.height }, a.dy) + TILE / 2;
      const sa = worldToScreen(canvas, aw, ay, az), sd = worldToScreen(canvas, dw, dy, dz);
      if (!sa || !sd) continue;
      const ts = localPixelScale(canvas, (aw + dw) / 2, (ay + dy) / 2, (az + dz) / 2);
      overlays.drawCombatSlashAt(ctx, a, sa.x, sa.y, sd.x, sd.y, Math.max(1, ts), now);
    }

    for (const { unit, screenX, screenY, ts } of quipQueue) overlays.drawQuipBubble(ctx, unit, screenX, screenY, Math.max(1, ts), now);
    for (const { unit, screenX, screenY, ts } of floatQueue) overlays.drawFloatingTexts(ctx, unit, screenX, screenY, Math.max(1, ts), now);
  }

  /** Set once by main.js to its own redraw() -- see the click handler's
   *  comment for why this can't just be a sidebar.render() call. */
  let redrawCallback = null;
  function setRedrawCallback(fn) { redrawCallback = fn; }

  window.UI.render3d = { render, setRedrawCallback };
})();
