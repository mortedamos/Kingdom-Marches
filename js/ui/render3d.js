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
 * worldgen.js Pass 2), so height here is a fixed band per terrain type
 * (ocean/coast flat at water level, hills/mountains progressively raised)
 * rather than continuous elevation. Same "plateau + edge skirt" meshing
 * technique validated in the standalone WebGL prototype still applies on
 * top of that.
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
 * terrain is flat within one of only 4 discrete height bands (see
 * HEIGHT_BY_TERRAIN), the ray is tested against each band's horizontal
 * plane and only a hit landing on a tile whose real height agrees with
 * that plane counts, closest-to-camera wins -- equivalent to real depth
 * testing for this terrain shape. Note this picks by ground footprint,
 * not billboard geometry -- clicking squarely on a tall sprite that's
 * leaning toward camera can occasionally resolve to its neighbor.
 *
 * Not yet included: real 3D wall geometry (currently a billboard like any
 * other structure), billboard animation, and full spectator fog-mode
 * parity (spectator mode shows the union of every civ's vision instead of
 * respecting the Interface menu's fog-of-war selector). All are natural
 * fast-follows once this core loop is proven out.
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
  // Each decal layer gets its own tiny Y offset above the terrain surface --
  // hub/cardinal/diagonal are all full-tile quads (the real road/river art
  // is authored as full-tile stamps, not thin stubs), so at a junction tile
  // several of them are otherwise perfectly coincident and would z-fight.
  // Rivers sit below roads (see render.js: "so a road crossing a river reads
  // as passing over it").
  const RIVER_HUB_LIFT = 0.010, RIVER_CARDINAL_LIFT = 0.011;
  const ROAD_HUB_LIFT = 0.013, ROAD_CARDINAL_LIFT = 0.014, ROAD_DIAGONAL_LIFT = 0.015;

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
  const terrainVS =
    "attribute vec3 aPos;\n" +
    "attribute vec3 aNormal;\n" +
    "attribute vec2 aUV;\n" +
    "uniform mat4 uViewProj;\n" +
    "uniform vec3 uLightDir;\n" +
    "varying vec2 vUV;\n" +
    "varying float vLight;\n" +
    "void main() {\n" +
    "  float diff = max(dot(normalize(aNormal), normalize(uLightDir)), 0.0);\n" +
    "  vLight = min(0.55 + diff * 0.55, 1.0);\n" +
    "  vUV = aUV;\n" +
    "  gl_Position = uViewProj * vec4(aPos, 1.0);\n" +
    "}\n";
  const terrainFS =
    "precision mediump float;\n" +
    "uniform sampler2D uTex;\n" +
    "varying vec2 vUV;\n" +
    "varying float vLight;\n" +
    "void main() {\n" +
    "  gl_FragColor = vec4(texture2D(uTex, vUV).rgb * vLight, 1.0);\n" +
    "}\n";
  const billboardVS =
    "attribute vec3 aCenter;\n" +
    "attribute vec2 aOffset;\n" +
    "attribute vec2 aUV;\n" +
    "uniform mat4 uViewProj;\n" +
    "uniform vec3 uRight;\n" +
    "uniform vec3 uUp;\n" +
    "varying vec2 vUV;\n" +
    "void main() {\n" +
    "  vec3 worldPos = aCenter + uRight * aOffset.x + uUp * aOffset.y;\n" +
    "  vUV = aUV;\n" +
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
    "varying vec2 vUV;\n" +
    "void main() {\n" +
    "  vUV = aUV;\n" +
    "  gl_Position = uViewProj * vec4(aPos, 1.0);\n" +
    "}\n";
  const decalFS =
    "precision mediump float;\n" +
    "uniform sampler2D uTex;\n" +
    "varying vec2 vUV;\n" +
    "void main() {\n" +
    "  vec4 c = texture2D(uTex, vUV);\n" +
    "  if (c.a < 0.5) discard;\n" +
    "  gl_FragColor = vec4(c.rgb, 1.0);\n" +
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
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0.56, 0.65, 0.74, 1.0);

    const terrainProg = link(gl, terrainVS, terrainFS);
    const billboardProg = link(gl, billboardVS, billboardFS);
    const decalProg = link(gl, decalVS, decalFS);

    state = {
      canvas, gl, terrainProg, billboardProg, decalProg,
      tStride: 8 * 4,
      t_aPos: gl.getAttribLocation(terrainProg, "aPos"),
      t_aNormal: gl.getAttribLocation(terrainProg, "aNormal"),
      t_aUV: gl.getAttribLocation(terrainProg, "aUV"),
      t_uViewProj: gl.getUniformLocation(terrainProg, "uViewProj"),
      t_uLightDir: gl.getUniformLocation(terrainProg, "uLightDir"),
      t_uTex: gl.getUniformLocation(terrainProg, "uTex"),
      b_aCenter: gl.getAttribLocation(billboardProg, "aCenter"),
      b_aOffset: gl.getAttribLocation(billboardProg, "aOffset"),
      b_aUV: gl.getAttribLocation(billboardProg, "aUV"),
      b_uViewProj: gl.getUniformLocation(billboardProg, "uViewProj"),
      b_uRight: gl.getUniformLocation(billboardProg, "uRight"),
      b_uUp: gl.getUniformLocation(billboardProg, "uUp"),
      b_uTex: gl.getUniformLocation(billboardProg, "uTex"),
      d_aPos: gl.getAttribLocation(decalProg, "aPos"),
      d_aUV: gl.getAttribLocation(decalProg, "aUV"),
      d_uViewProj: gl.getUniformLocation(decalProg, "uViewProj"),
      d_uTex: gl.getUniformLocation(decalProg, "uTex"),
      terrainTextures: {}, // terrainId -> WebGLTexture, built once
      billboardTexCache: new WeakMap(), // Image -> {tex, aspect, bottomPadFrac}
      terrainDrawGroups: [],
      riverDrawGroups: [], // static once built -- see ensureRiverGroups
      riverGroupsReady: false,
      builtForMap: null,
      mapWidth: 0, mapHeight: 0,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    };
    buildTerrainTextures(state);
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
  }

  function worldX(st, tx) { return (tx - st.mapWidth / 2) * TILE; }
  function worldZ(st, tz) { return (tz - st.mapHeight / 2) * TILE; }

  // ---------- terrain mesh: each tile is a flat-topped plateau, its outer
  // margin stepping down/up to meet neighbors -- see the WebGL prototype's
  // buildTileGeometry comment for the watertight-seam proof (every step
  // height is the average of the tile's own flat height and its neighbor's,
  // computed identically from both sides of a shared boundary). ----------
  function buildTerrainMesh(st, map) {
    const gl = st.gl;
    st.mapWidth = map.width;
    st.mapHeight = map.height;

    function hcAt(cx, cz) {
      cx = Math.max(0, Math.min(map.width - 1, cx));
      cz = Math.max(0, Math.min(map.height - 1, cz));
      const terrain = map.tiles[cz * map.width + cx].terrain;
      return HEIGHT_BY_TERRAIN[terrain] ?? 0;
    }

    const groups = {};
    for (const id of Object.keys(MATERIAL_PALETTES)) groups[id] = { positions: [], normals: [], uvs: [] };

    function pushTri(g, p0, p1, p2, x0, z0) {
      let n = norm(cross(sub(p1,p0), sub(p2,p0)));
      if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
      g.positions.push(p0[0],p0[1],p0[2], p1[0],p1[1],p1[2], p2[0],p2[1],p2[2]);
      g.normals.push(n[0],n[1],n[2], n[0],n[1],n[2], n[0],n[1],n[2]);
      g.uvs.push(p0[0]-x0, p0[2]-z0, p1[0]-x0, p1[2]-z0, p2[0]-x0, p2[2]-z0);
    }

    for (let tz = 0; tz < map.height; tz++) {
      for (let tx = 0; tx < map.width; tx++) {
        const terrainId = map.tiles[tz * map.width + tx].terrain;
        const g = groups[terrainId];
        if (!g) continue; // unknown terrain id -- skip rather than throw
        const x0 = worldX(st, tx) - TILE_BLEED, x1 = worldX(st, tx+1) + TILE_BLEED;
        const z0 = worldZ(st, tz) - TILE_BLEED, z1 = worldZ(st, tz+1) + TILE_BLEED;
        const hc = hcAt(tx, tz);
        const m = MARGIN_BY_TERRAIN[terrainId] || TILE_MARGIN;
        const bN = (hc + hcAt(tx,tz-1)) / 2;
        const bS = (hc + hcAt(tx,tz+1)) / 2;
        const bW = (hc + hcAt(tx-1,tz)) / 2;
        const bE = (hc + hcAt(tx+1,tz)) / 2;
        const bNW = (hc + hcAt(tx,tz-1) + hcAt(tx-1,tz) + hcAt(tx-1,tz-1)) / 4;
        const bNE = (hc + hcAt(tx,tz-1) + hcAt(tx+1,tz) + hcAt(tx+1,tz-1)) / 4;
        const bSE = (hc + hcAt(tx,tz+1) + hcAt(tx+1,tz) + hcAt(tx+1,tz+1)) / 4;
        const bSW = (hc + hcAt(tx,tz+1) + hcAt(tx-1,tz) + hcAt(tx-1,tz+1)) / 4;
        const ix0 = x0+m, ix1 = x1-m, iz0 = z0+m, iz1 = z1-m;
        const cNW=[ix0,hc,iz0], cNE=[ix1,hc,iz0], cSE=[ix1,hc,iz1], cSW=[ix0,hc,iz1];

        pushTri(g, cNW, cNE, cSE, x0, z0);
        pushTri(g, cNW, cSE, cSW, x0, z0);

        const nA=[x0+m,bN,z0], nB=[x1-m,bN,z0];
        pushTri(g, nA, nB, cNE, x0, z0);
        pushTri(g, nA, cNE, cNW, x0, z0);
        const sA=[x1-m,bS,z1], sB=[x0+m,bS,z1];
        pushTri(g, sA, sB, cSW, x0, z0);
        pushTri(g, sA, cSW, cSE, x0, z0);
        const wA=[x0,bW,z0+m], wB=[x0,bW,z1-m];
        pushTri(g, wA, wB, cSW, x0, z0);
        pushTri(g, wA, cSW, cNW, x0, z0);
        const eA=[x1,bE,z1-m], eB=[x1,bE,z0+m];
        pushTri(g, eA, eB, cNE, x0, z0);
        pushTri(g, eA, cNE, cSE, x0, z0);

        pushTri(g, [x0,bNW,z0], nA, cNW, x0, z0);
        pushTri(g, [x0,bNW,z0], cNW, wA, x0, z0);
        pushTri(g, [x1,bNE,z0], cNE, nB, x0, z0);
        pushTri(g, [x1,bNE,z0], eB, cNE, x0, z0);
        pushTri(g, [x1,bSE,z1], sA, cSE, x0, z0);
        pushTri(g, [x1,bSE,z1], cSE, eA, x0, z0);
        pushTri(g, [x0,bSW,z1], cSW, sB, x0, z0);
        pushTri(g, [x0,bSW,z1], wB, cSW, x0, z0);
      }
    }

    for (const g of st.terrainDrawGroups) gl.deleteBuffer(g.vbo);
    st.terrainDrawGroups = [];
    for (const terrainId of Object.keys(groups)) {
      const g = groups[terrainId];
      const vertCount = g.positions.length / 3;
      if (vertCount === 0) continue;
      const interleaved = new Float32Array(vertCount * 8);
      for (let i = 0; i < vertCount; i++) {
        interleaved[i*8+0]=g.positions[i*3+0]; interleaved[i*8+1]=g.positions[i*3+1]; interleaved[i*8+2]=g.positions[i*3+2];
        interleaved[i*8+3]=g.normals[i*3+0]; interleaved[i*8+4]=g.normals[i*3+1]; interleaved[i*8+5]=g.normals[i*3+2];
        interleaved[i*8+6]=g.uvs[i*2+0]; interleaved[i*8+7]=g.uvs[i*2+1];
      }
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
      st.terrainDrawGroups.push({ texture: st.terrainTextures[terrainId], vbo, vertCount });
    }

    // Rivers never change after worldgen (see worldgen.js's generateRivers),
    // so in steady state they only need building once per map -- but NOT
    // here: at the moment the map first changes, the river/hub sprite art
    // may still be mid-load (sprites.js's preloadAll is async), and
    // buildRiverDecalGroups silently returns [] until it's ready. Caching
    // that empty result here would permanently starve rivers for this
    // map's whole lifetime. See ensureRiverGroups (called every render()
    // frame instead), which retries until the sprites are actually ready.
    st.riverGroupsReady = false;

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
  function buildDecalQuad(positions, uvs, worldCx, worldCz, height, angleDeg) {
    const hs = TILE / 2;
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

  function buildRiverDecalGroups(st, map) {
    const cardinalSprite = window.UI.sprites.pick("river/cardinal");
    const hubSprite = window.UI.sprites.pick("river/hub");
    if (!cardinalSprite || !hubSprite) return [];
    const cardinalTex = getBillboardTexture(st, cardinalSprite.image, cardinalSprite.manifest);
    const hubTex = getBillboardTexture(st, hubSprite.image, hubSprite.manifest);
    const cardinalPos = [], cardinalUv = [], hubPos = [], hubUv = [];
    for (let tz = 0; tz < map.height; tz++) {
      for (let tx = 0; tx < map.width; tx++) {
        const tile = map.tiles[tz * map.width + tx];
        const r = tile.hasRiver;
        if (!r || !(r.n || r.s || r.e || r.w)) continue;
        const cx = worldX(st, tx) + TILE/2, cz = worldZ(st, tz) + TILE/2;
        const baseY = cellHeight(map, tx, tz);
        buildDecalQuad(hubPos, hubUv, cx, cz, baseY + RIVER_HUB_LIFT, 0);
        for (const d of ["e", "s", "w", "n"]) {
          if (r[d]) buildDecalQuad(cardinalPos, cardinalUv, cx, cz, baseY + RIVER_CARDINAL_LIFT, ROAD_CARDINAL_ANGLE[d]);
        }
      }
    }
    const groups = [];
    const hubVbo = buildDecalVbo(st.gl, hubPos, hubUv);
    if (hubVbo) groups.push({ texture: hubTex.tex, ...hubVbo });
    const cardinalVbo = buildDecalVbo(st.gl, cardinalPos, cardinalUv);
    if (cardinalVbo) groups.push({ texture: cardinalTex.tex, ...cardinalVbo });
    return groups;
  }

  /** Called every render() frame. Cheap no-op once river groups are
   *  already built for the current map; retries (via two sprite pick()
   *  lookups) for as many frames as it takes the river art to finish
   *  loading, then does the real per-tile scan exactly once. */
  function ensureRiverGroups(st, map) {
    if (st.riverGroupsReady) return;
    const cardinalSprite = window.UI.sprites.pick("river/cardinal");
    const hubSprite = window.UI.sprites.pick("river/hub");
    if (!cardinalSprite || !hubSprite) return; // still loading -- try again next frame
    for (const g of st.riverDrawGroups) st.gl.deleteBuffer(g.vbo);
    st.riverDrawGroups = buildRiverDecalGroups(st, map);
    st.riverGroupsReady = true;
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
    const cardinalPos = [], cardinalUv = [], diagonalPos = [], diagonalUv = [], hubPos = [], hubUv = [];
    const hasRoadAt = (tx, tz) => tx >= 0 && tx < map.width && tz >= 0 && tz < map.height && map.tiles[tz * map.width + tx].hasRoad;
    for (let tz = 0; tz < map.height; tz++) {
      for (let tx = 0; tx < map.width; tx++) {
        if (!map.tiles[tz * map.width + tx].hasRoad) continue;
        const cx = worldX(st, tx) + TILE/2, cz = worldZ(st, tz) + TILE/2;
        const baseY = cellHeight(map, tx, tz);
        const hubY = baseY + ROAD_HUB_LIFT, cardY = baseY + ROAD_CARDINAL_LIFT, diagY = baseY + ROAD_DIAGONAL_LIFT;
        buildDecalQuad(hubPos, hubUv, cx, cz, hubY, 0);
        if (hasRoadAt(tx, tz-1)) buildDecalQuad(cardinalPos, cardinalUv, cx, cz, cardY, ROAD_CARDINAL_ANGLE.n);
        if (hasRoadAt(tx, tz+1)) buildDecalQuad(cardinalPos, cardinalUv, cx, cz, cardY, ROAD_CARDINAL_ANGLE.s);
        if (hasRoadAt(tx+1, tz)) buildDecalQuad(cardinalPos, cardinalUv, cx, cz, cardY, ROAD_CARDINAL_ANGLE.e);
        if (hasRoadAt(tx-1, tz)) buildDecalQuad(cardinalPos, cardinalUv, cx, cz, cardY, ROAD_CARDINAL_ANGLE.w);
        if (hasRoadAt(tx+1, tz-1)) buildDecalQuad(diagonalPos, diagonalUv, cx, cz, diagY, ROAD_DIAGONAL_ANGLE.ne);
        if (hasRoadAt(tx+1, tz+1)) buildDecalQuad(diagonalPos, diagonalUv, cx, cz, diagY, ROAD_DIAGONAL_ANGLE.se);
        if (hasRoadAt(tx-1, tz+1)) buildDecalQuad(diagonalPos, diagonalUv, cx, cz, diagY, ROAD_DIAGONAL_ANGLE.sw);
        if (hasRoadAt(tx-1, tz-1)) buildDecalQuad(diagonalPos, diagonalUv, cx, cz, diagY, ROAD_DIAGONAL_ANGLE.nw);
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

  function cellHeight(map, cx, cz) {
    cx = Math.max(0, Math.min(map.width - 1, cx));
    cz = Math.max(0, Math.min(map.height - 1, cz));
    return HEIGHT_BY_TERRAIN[map.tiles[cz * map.width + cx].terrain] ?? 0;
  }

  // ---------- billboard textures: real game sprite art, cropped to frame 0
  // (no in-3D animation yet -- see file header) and measured for bottom
  // transparent padding so buildings sit flush on the ground instead of
  // floating on their own baked-in canvas padding (generalizes the manual
  // per-asset measurement used during the WebGL prototype into an automatic
  // runtime check that works for the whole roster, not just a few samples). ----------
  function getBillboardTexture(st, image, manifest) {
    let entry = st.billboardTexCache.get(image);
    if (entry) return entry;
    const gl = st.gl;
    const fw = manifest.frameWidth || image.naturalWidth || 1;
    const fh = manifest.frameHeight || image.naturalHeight || 1;
    const c = document.createElement("canvas");
    c.width = fw; c.height = fh;
    const cctx = c.getContext("2d");
    cctx.drawImage(image, 0, 0, fw, fh, 0, 0, fw, fh);
    let bottomPadFrac = 0;
    try {
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    entry = { tex, aspect: fw / fh, bottomPadFrac };
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

  /** Currently-visible tile index set for whoever's "eyes" we're rendering
   *  through. Human civ: exactly what render.js uses. Spectator (no human
   *  civ): union of every civ's vision -- a v1 simplification, not yet
   *  respecting the Interface menu's per-civ fog-mode selector the 2D
   *  spectator view has (see file header). */
  function visibleTileSet(gameState, humanCivId) {
    if (humanCivId) return gameState.visibility[humanCivId] || new Set();
    const union = new Set();
    for (const civId of Object.keys(gameState.civs)) {
      const v = gameState.visibility[civId];
      if (v) for (const idx of v) union.add(idx);
    }
    return union;
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

  function collectBillboards(gameState, viewState, mapWidth) {
    const list = [];
    const map = gameState.map;
    const visible = visibleTileSet(gameState, viewState.humanCivId);
    const cityTiles = buildCityTileSet(gameState, mapWidth);
    for (const civId of Object.keys(gameState.civs)) {
      const civ = gameState.civs[civId];
      if (civ.eliminated) continue;
      for (const city of civ.cities) {
        const idx = city.y * mapWidth + city.x;
        if (!visible.has(idx)) continue;
        const pop = Math.floor(city.population);
        const tiered = window.UI.sprites.pickCityTier(civ.raceId, pop);
        const sprite = tiered || window.UI.sprites.pick(`city/${civ.raceId}`, city);
        if (sprite && sprite.image && sprite.image.complete) {
          const manifest = sprite.manifest || { frameWidth: sprite.image.naturalWidth, frameHeight: sprite.image.naturalHeight };
          list.push({ x: city.x, y: city.y, dx: 0, dz: 0, image: sprite.image, manifest, size: CITY_HEIGHT, sizeAxis: "height", blend: CITY_BLEND });
        }
        for (const s of city.structures) {
          const sIdx = s.y * mapWidth + s.x;
          if (!visible.has(sIdx)) continue;
          const building = window.GameData.getBuilding(s.id);
          const sSprite = building.isWall
            ? window.UI.sprites.pickWallSegment(s.id, civ.raceId, wallOrientation(map, civ.id, s.x, s.y), s)
            : window.UI.sprites.pickBuilding(s.id, civ.raceId, s);
          if (!sSprite || !sSprite.image || !sSprite.image.complete) continue;
          const manifest = sSprite.manifest || { frameWidth: sSprite.image.naturalWidth, frameHeight: sSprite.image.naturalHeight };
          list.push({ x: s.x, y: s.y, dx: 0, dz: 0, image: sSprite.image, manifest, size: STRUCTURE_WIDTH, sizeAxis: "width", blend: STRUCTURE_BLEND });
        }
      }
      for (const unit of civ.units) {
        const idx = unit.y * mapWidth + unit.x;
        if (!visible.has(idx)) continue;
        if (unit.conditions && unit.conditions.hidden && viewState.humanCivId != null && unit.civId !== viewState.humanCivId) continue;
        const sprite = window.UI.sprites.pickUnit(unit.typeId, civ.raceId, unit);
        if (!sprite || !sprite.image || !sprite.image.complete) continue;
        const onCityTile = cityTiles.has(idx);
        list.push({
          x: unit.x, y: unit.y, dx: onCityTile ? 0.28 : 0, dz: 0,
          image: sprite.image, manifest: sprite.manifest, size: UNIT_HEIGHT, sizeAxis: "height", blend: UNIT_BLEND,
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
   *  map entirely. No depth buffer / mesh intersection needed -- our
   *  terrain is flat within one of only 4 distinct height bands (see
   *  HEIGHT_BY_TERRAIN), so this intersects the ray against each band's
   *  horizontal plane, keeps only hits that land on a tile whose OWN real
   *  height actually matches that plane (a hit on, say, the water plane
   *  that lands on a plains tile's footprint is a false positive -- that
   *  tile isn't actually at water height, so skip it), and picks the
   *  closest surviving hit to the camera -- which naturally handles a
   *  mountain occluding whatever is behind it, the same way real depth
   *  testing would. */
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
    for (const planeY of new Set(Object.values(HEIGHT_BY_TERRAIN))) {
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

  // ---------- camera controls + click-to-select ----------
  function attachControls(canvas) {
    if (canvas.__render3dControlsAttached) return;
    canvas.__render3dControlsAttached = true;
    let dragging = false, lastX = 0, lastY = 0, downX = 0, downY = 0, dragMoved = false;
    const CLICK_MOVE_THRESHOLD = 4; // px -- matches input.js's dragMoved suppression
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", (e) => {
      if (!canvas.__cam) return;
      dragging = true; dragMoved = false;
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
      cam.azimuth -= dx * 0.008;
      cam.elevationDeg = Math.max(20, Math.min(85, cam.elevationDeg - dy * 0.15));
    });
    function endDrag(e) {
      dragging = false;
      canvas.style.cursor = "grab";
      if (dragMoved || !canvas.__gameState || !canvas.__viewState) return;
      const map = canvas.__gameState.map;
      const hit = pickTileAtClient(canvas, map, e.clientX, e.clientY);
      if (!hit) return;
      window.UI.input.handleTileClick(hit, canvas.__gameState, canvas.__viewState);
      const sidebarEl = document.getElementById("sidebar");
      if (sidebarEl) window.UI.sidebar.render(sidebarEl, canvas.__gameState, canvas.__viewState);
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
    const st = ensureInit(canvas);
    const gl = st.gl;
    const map = gameState.map;
    // Stashed for the click handler (attachControls), which fires from a
    // real DOM event outside render()'s call stack and needs the current
    // gameState/viewState to resolve a click into a selection.
    canvas.__gameState = gameState;
    canvas.__viewState = viewState;

    if (st.builtForMap !== map) buildTerrainMesh(st, map);
    ensureRiverGroups(st, map);

    if (!canvas.__cam) {
      canvas.__cam = {
        azimuth: 0.6, elevationDeg: 55,
        distance: Math.max(map.width, map.height) * 0.75,
        maxDistance: Math.max(map.width, map.height) * 2.2,
        target: [0, 0.15, 0],
      };
    }
    const cam = canvas.__cam;

    resize(gl, canvas, st.dpr);
    if (canvas.width === 0 || canvas.height === 0) return;

    const { eye, camRight, camUp, camBack } = cameraEyeAndBasis(cam);
    const view = mat4LookAt(eye, cam.target, [0, 1, 0]);
    const aspect = canvas.width / canvas.height;
    const farPlane = Math.max(100, cam.maxDistance * 2);
    const proj = mat4Perspective((FOV_DEG * Math.PI) / 180, aspect, 0.1, farPlane);
    const viewProj = mat4Multiply(proj, view);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(st.terrainProg);
    gl.uniformMatrix4fv(st.t_uViewProj, false, viewProj);
    gl.uniform3f(st.t_uLightDir, 0.45, 1.0, 0.35);
    gl.uniform1i(st.t_uTex, 0);
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
      gl.drawArrays(gl.TRIANGLES, 0, g.vertCount);
    }

    const roadDrawGroups = buildRoadDecalGroups(st, map);
    gl.useProgram(st.decalProg);
    gl.uniformMatrix4fv(st.d_uViewProj, false, viewProj);
    gl.uniform1i(st.d_uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    for (const g of st.riverDrawGroups) drawDecalGroup(st, g);
    for (const g of roadDrawGroups) drawDecalGroup(st, g);
    for (const g of roadDrawGroups) gl.deleteBuffer(g.vbo); // rebuilt fresh every frame -- see buildRoadDecalGroups

    const billboards = collectBillboards(gameState, viewState, map.width);
    gl.useProgram(st.billboardProg);
    gl.uniformMatrix4fv(st.b_uViewProj, false, viewProj);
    gl.uniform3f(st.b_uRight, camRight[0], camRight[1], camRight[2]);
    gl.uniform1i(st.b_uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    const bStride = 4 * 4;
    for (const b of billboards) {
      const tex = getBillboardTexture(st, b.image, b.manifest);
      let w, h;
      if (b.sizeAxis === "width") { w = b.size; h = w / tex.aspect; }
      else { h = b.size; w = h * tex.aspect; }
      const gx = worldX(st, b.x) + TILE/2 + b.dx, gz = worldZ(st, b.y) + TILE/2 + b.dz;
      const gy = cellHeight(map, b.x, b.y) - tex.bottomPadFrac * h;
      const up = norm(mix3(camUp, [0, 1, 0], b.blend));
      gl.uniform3f(st.b_uUp, up[0], up[1], up[2]);
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
  }

  window.UI.render3d = { render };
})();
