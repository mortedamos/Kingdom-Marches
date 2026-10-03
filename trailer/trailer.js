/**
 * KINGDOM MARCHES -- TRAILER
 * --------------------------
 * A ~60 s scripted trailer built from the game's own art, portraits, music
 * and sfx. Every frame is a pure function of time (drawFrame(t)) -- no
 * Math.random, no performance.now -- so the in-browser preview and the
 * frame-by-frame MP4 export (see capture-server.pl) are identical.
 *
 *   ?t=12.5   draw a single still at that time (handy for checking a shot)
 *
 * Photosensitivity: nothing here flashes. Lightning is a single slow glow
 * (rise 0.25 s, decay 0.9 s), at most one every few seconds.
 */
(() => {
  "use strict";

  const W = 1920, H = 1080, FPS = 30, DURATION = 60;
  const A = "../assets/";

  // Section of title.mp3 used: its quiet passage runs up to ~115 s, then the
  // full orchestra comes in -- offset so that lands on the race parade.
  const MUSIC = { src: "music/title.mp3", offset: 100.5, vol: 0.9, fadeIn: 1.2, fadeOut: 3.5 };

  // ------------------------------------------------------------------ utils
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ramp = (t, a, b) => clamp((t - a) / (b - a));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  // In for `fi` seconds from a, out for `fo` seconds up to b.
  const window01 = (t, a, b, fi = 0.3, fo = 0.3) => Math.min(ramp(t, a, a + fi), 1 - ramp(t, b - fo, b));

  function vnoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const r = (i, j) => hash(i * 57.3 + j * 131.7 + seed * 17.1);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return lerp(lerp(r(xi, yi), r(xi + 1, yi), u), lerp(r(xi, yi + 1), r(xi + 1, yi + 1), u), v);
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.6 + vnoise(x * 2, y * 2, s + 1) * 0.3 + vnoise(x * 4, y * 4, s + 2) * 0.1;

  function hexRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };
  function lighten(hex, k) {
    const [r, g, b] = hexRgb(hex);
    const f = (c) => Math.round(c + (255 - c) * k).toString(16).padStart(2, "0");
    return `#${f(r)}${f(g)}${f(b)}`;
  }

  // ----------------------------------------------------------------- assets
  const RACES = {
    human:     { label: "Humans",     color: "#8e44ad", tag: "The Arcane Crown",               terrain: "plains",    units: ["knight_1", "wizard_1", "archer_2"],               city: "human_city_6" },
    elf:       { label: "Elves",      color: "#3f8f5c", tag: "Wardens of the Silverwood",      terrain: "forest",    units: ["ranger_1", "blade_dancer_2", "awakened_oak_1"],   city: "elf_city_6" },
    dwarf:     { label: "Dwarves",    color: "#9a7b56", tag: "Keepers of the Book of Grudges", terrain: "mountains", units: ["foehammer_1", "troubadour_2", "runeforged_titan"], city: "dwarf_city_6" },
    orc:       { label: "Orcs",       color: "#7a2e2e", tag: "The Bloodmire Clans",            terrain: "swamp",     units: ["raider", "wolf_rider_1", "ogre_1"],               city: "orc_city_6" },
    halfellow: { label: "Halfellows", color: "#c9a857", tag: "Homesteaders of the Hearthlands", terrain: "hills",    units: ["pony_patrol_1", "militia_2", "mycomancer_1"],     city: "halfellow_city_6" },
  };
  const RACE_ORDER = ["human", "elf", "dwarf", "orc", "halfellow"];

  const IMG = {};
  const imgPaths = {
    titleBg: "img/title-bg.png", logo: "img/logo.png",
    chestA: "enhancements/resource_chest_2.png", chestB: "enhancements/resource_chest_1.png",
    itemRock: "enhancements/item_lucky_rock_1.png", itemMythril: "enhancements/item_mythril_armor_1.png", itemAxe: "enhancements/item_axe_of_doom_1.png",
  };
  for (const t of ["plains", "hills", "forest", "swamp", "mountains", "tundra", "desert"]) for (let i = 1; i <= 3; i++) imgPaths[`${t}_${i}`] = `terrain/${t}_${i}.png`;
  for (const r of ["human", "elf", "dwarf", "orc", "halfellow"]) for (let i = 1; i <= 6; i++) imgPaths[`${r}_city_${i}`] = `cities/${r}_city_${i}.png`;
  for (const r of RACE_ORDER) imgPaths[`inf_${r}`] = `enhancements/influence_${r}_1.png`;
  for (const r of ["elf", "dwarf"]) for (let i = 2; i <= 4; i++) imgPaths[`inf_${r}_${i}`] = `enhancements/influence_${r}_${i}.png`;
  const unitFiles = new Set(["elf_pioneer", "dragon", "giltmaw_1", "highland_griffin_1", "basilisk_1", "treasure_trow_1", "dire_spider_1", "boar_sounder_1"]);
  for (const r of Object.values(RACES)) r.units.forEach((u) => unitFiles.add(u));
  unitFiles.forEach((u) => { imgPaths[u] = `units/${u}.png`; });
  const portraits = ["stone", "corvin_wry", "corvin_neutral", "skarra_gleeful", "gnash_confused", "gnash_sad", "gnash_happy", "gimlet_happy"];
  portraits.forEach((p) => { imgPaths[`p_${p}`] = `portraits/${p}.jpg`; });

  function loadImages() {
    return Promise.all(Object.entries(imgPaths).map(([k, p]) => new Promise((res) => {
      const im = new Image();
      im.onload = () => { IMG[k] = im; res(); };
      im.onerror = () => { console.warn("missing image", p); res(); };
      im.src = A + p;
    })));
  }

  // ------------------------------------------------------------ primitives
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d");
  const layer = document.createElement("canvas");
  layer.width = W; layer.height = H;
  const lctx = layer.getContext("2d");

  const vignette = document.createElement("canvas");
  vignette.width = W; vignette.height = H;
  {
    const v = vignette.getContext("2d");
    const g = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.0);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.62)");
    v.fillStyle = g; v.fillRect(0, 0, W, H);
  }

  const FONT = "Cinzel, Georgia, serif";

  function text(c, s, x, y, o = {}) {
    const size = o.size || 48;
    c.save();
    c.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    c.font = `${o.italic ? "italic " : ""}${o.weight || 700} ${size}px ${o.font || FONT}`;
    c.textAlign = o.align || "center";
    c.textBaseline = o.baseline || "middle";
    if ("letterSpacing" in c) c.letterSpacing = (o.spacing || 0) + "px";
    if (o.shadow !== false) { c.shadowColor = o.shadowColor || "rgba(0,0,0,0.85)"; c.shadowBlur = o.shadowBlur || size * 0.3; c.shadowOffsetY = size * 0.04; }
    if (o.stroke) { c.lineJoin = "round"; c.lineWidth = o.strokeWidth || size * 0.1; c.strokeStyle = o.stroke; c.strokeText(s, x, y); c.shadowColor = "transparent"; }
    c.fillStyle = o.color || "#f3e6c4";
    c.fillText(s, x, y);
    c.restore();
  }

  function goldText(c, s, x, y, size, o = {}) {
    const g = c.createLinearGradient(0, y - size * 0.55, 0, y + size * 0.45);
    g.addColorStop(0, "#fff6d2"); g.addColorStop(0.45, "#f0c867"); g.addColorStop(1, "#9a6420");
    text(c, s, x, y, Object.assign({ size, color: g, stroke: "#2a1706", strokeWidth: size * 0.08, spacing: size * 0.04 }, o));
  }

  // A caption that rises and fades in word by word, then fades out.
  function caption(c, s, lt, t0, t1, o = {}) {
    if (lt < t0 || lt > t1) return;
    const size = o.size || 72, y = o.y || 150;
    const out = 1 - ramp(lt, t1 - 0.35, t1);
    c.save();
    c.font = `700 ${size}px ${FONT}`;
    if ("letterSpacing" in c) c.letterSpacing = size * 0.04 + "px";
    const words = s.split(" ");
    const widths = words.map((w) => c.measureText(w + " ").width);
    const total = widths.reduce((a, b) => a + b, 0) - c.measureText(" ").width;
    let x = (o.x || W / 2) - (o.align === "left" ? 0 : total / 2);
    c.restore();
    words.forEach((w, i) => {
      const a = easeOut(ramp(lt, t0 + i * 0.07, t0 + i * 0.07 + 0.45)) * out;
      if (a > 0) goldText(c, w, x, y + (1 - a) * 22, size, { align: "left", alpha: a });
      x += widths[i];
    });
  }

  // Unit/terrain sprite sheets: square frames laid out horizontally.
  function sprite(c, key, frame, cx, bottom, size, o = {}) {
    const im = IMG[key]; if (!im) return;
    const fw = im.height, n = Math.max(1, Math.round(im.width / fw)), f = ((frame % n) + n) % n;
    c.save();
    c.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    c.translate(cx, bottom);
    if (o.rot) c.rotate(o.rot);
    c.scale(o.flip ? -1 : 1, 1);
    c.drawImage(im, f * fw, 0, fw, fw, -size / 2, -size, size, size);
    c.restore();
  }
  const unitFrame = (t, seed = 0) => Math.floor(t * 2 + seed * 3.7);

  function drawCover(c, im, cx, cy, scale) {
    if (!im) return;
    const s = Math.max(W / im.width, H / im.height) * scale;
    c.drawImage(im, cx - (im.width * s) / 2, cy - (im.height * s) / 2, im.width * s, im.height * s);
  }

  function embers(c, t, n, alpha = 1, seed = 0) {
    c.save();
    c.globalCompositeOperation = "lighter";
    for (let i = 0; i < n; i++) {
      const sp = 40 + hash(i + seed) * 90;
      const y = H + 40 - ((t * sp + hash(i * 3.1 + seed) * (H + 80)) % (H + 80));
      const x = hash(i * 7.7 + seed) * W + Math.sin(t * 0.6 + i) * 30;
      const r = 1.5 + hash(i * 1.3) * 2.5;
      const a = alpha * (0.35 + 0.35 * Math.sin(t * 0.8 + i * 2.1));
      c.fillStyle = `rgba(255,${150 + (i % 5) * 15},70,${a})`;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  // ---------------------------------------------------------------- weather
  function rain(c, t, k, seed = 0) {
    if (k <= 0) return;
    c.save();
    c.fillStyle = `rgba(12,18,34,${0.38 * k})`;
    c.fillRect(0, 0, W, H);
    c.strokeStyle = "rgba(190,205,230,1)";
    c.lineCap = "round";
    const n = Math.floor(420 * k);
    for (let i = 0; i < n; i++) {
      const sp = 1500 + hash(i * 1.7 + seed) * 700;
      const len = 26 + hash(i * 2.3) * 34;
      const y = ((t * sp + hash(i * 5.1 + seed) * H * 1.3) % (H * 1.3)) - 120;
      const x = hash(i * 9.3 + seed) * (W + 500) - 250 + y * 0.22;
      c.globalAlpha = (0.16 + hash(i * 4.4) * 0.26) * k;
      c.lineWidth = 1.2 + hash(i) * 1.3;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - len * 0.22, y - len); c.stroke();
    }
    // Splashes on the ground plane.
    c.lineWidth = 1.5;
    for (let j = 0; j < Math.floor(70 * k); j++) {
      const period = 0.5 + hash(j * 3.3) * 0.4;
      const ph = ((t + hash(j * 8.1) * period) % period) / period;
      const cycle = Math.floor((t + hash(j * 8.1) * period) / period);
      const x = hash(j * 11.1 + cycle * 0.37) * W, y = 300 + hash(j * 13.7 + cycle * 0.91) * (H - 300);
      c.globalAlpha = (1 - ph) * 0.35 * k;
      c.beginPath(); c.ellipse(x, y, 4 + ph * 14, 1.5 + ph * 4, 0, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }

  // One soft lightning pulse: glow envelope + a jagged bolt.
  function lightning(c, t, t0, seed, bx = W * 0.7) {
    const dt = t - t0;
    if (dt < 0 || dt > 1.2) return;
    const env = dt < 0.25 ? easeOut(dt / 0.25) : 1 - easeOut(clamp((dt - 0.25) / 0.9));
    c.save();
    c.globalCompositeOperation = "screen";
    const g = c.createRadialGradient(bx, 0, 50, bx, 0, W * 0.9);
    g.addColorStop(0, `rgba(170,190,255,${0.3 * env})`);
    g.addColorStop(1, "rgba(170,190,255,0)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = `rgba(225,232,255,${0.85 * env})`;
    c.shadowColor = "rgba(160,180,255,0.9)"; c.shadowBlur = 30;
    c.lineWidth = 4; c.lineJoin = "round";
    c.beginPath();
    let x = bx, y = -10;
    c.moveTo(x, y);
    for (let i = 0; i < 10; i++) { x += (hash(seed + i) - 0.5) * 90; y += 38 + hash(seed * 2 + i) * 22; c.lineTo(x, y); }
    c.stroke();
    c.restore();
  }

  function shake(t, hits, amp = 10) {
    let dx = 0, dy = 0;
    for (const h of hits) {
      const d = t - h;
      if (d >= 0 && d < 0.4) { const a = amp * (1 - d / 0.4); dx += Math.sin(d * 70) * a; dy += Math.cos(d * 55) * a * 0.6; }
    }
    return [dx, dy];
  }

  // ------------------------------------------------------------------ maps
  function buildMap(cols, rows, fn) {
    const g = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) g.push(fn(x, y));
    return { cols, rows, g, at: (x, y) => (x < 0 || y < 0 || x >= cols || y >= rows ? null : g[y * cols + x]) };
  }

  const tileVar = (x, y, s = 0) => 1 + Math.floor(hash(x * 7.13 + y * 13.7 + s) * 3);

  // cam: { x, y } = world tile at screen centre, s = pixels per tile.
  const toScreen = (cam, x, y) => [W / 2 + (x - cam.x) * cam.s, H / 2 + (y - cam.y) * cam.s];

  function drawMap(c, map, cam, t) {
    const ts = cam.s;
    const x0 = Math.max(0, Math.floor(cam.x - W / 2 / ts) - 1), x1 = Math.min(map.cols - 1, Math.ceil(cam.x + W / 2 / ts) + 1);
    const y0 = Math.max(0, Math.floor(cam.y - H / 2 / ts) - 1), y1 = Math.min(map.rows - 1, Math.ceil(cam.y + H / 2 / ts) + 1);
    c.fillStyle = "#2d6384"; c.fillRect(0, 0, W, H);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const tile = map.at(x, y);
      const [sx, sy] = toScreen(cam, x, y);
      if (tile.t === "water") {
        c.fillStyle = "#2f6a8c"; c.fillRect(sx, sy, ts + 1, ts + 1);
        c.strokeStyle = "rgba(200,230,255,0.22)"; c.lineWidth = Math.max(1.5, ts * 0.02);
        for (let k = 0; k < 2; k++) {
          const wy = sy + ts * (0.3 + k * 0.4) + Math.sin(t * 1.3 + x + k) * ts * 0.05;
          c.beginPath(); c.moveTo(sx + ts * 0.15, wy);
          c.quadraticCurveTo(sx + ts * 0.35, wy - ts * 0.06, sx + ts * 0.55, wy); c.stroke();
        }
        continue;
      }
      const im = IMG[`${tile.t}_${tile.v}`];
      if (!im) continue;
      const n = Math.max(1, Math.round(im.width / im.height));
      const f = n > 1 ? Math.floor(t * 2 + hash(x + y * 3) * 2) % n : 0;
      c.drawImage(im, f * im.height, 0, im.height, im.height, sx, sy, ts + 0.6, ts + 0.6);
    }
    // Soft shoreline: darken land edges that touch water.
    c.fillStyle = "rgba(20,50,70,0.35)";
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (map.at(x, y).t === "water") continue;
      const [sx, sy] = toScreen(cam, x, y), e = ts * 0.07;
      if (map.at(x, y - 1)?.t === "water") c.fillRect(sx, sy, ts, e);
      if (map.at(x, y + 1)?.t === "water") c.fillRect(sx, sy + ts - e, ts, e);
      if (map.at(x - 1, y)?.t === "water") c.fillRect(sx, sy, e, ts);
      if (map.at(x + 1, y)?.t === "water") c.fillRect(sx + ts - e, sy, e, ts);
    }
  }

  // own[i] = { race, t } -- tile i belongs to race from time t onward.
  function drawInfluence(c, map, own, cam, t, skip) {
    const ts = cam.s;
    const owned = (x, y) => { const o = map.at(x, y) && own[y * map.cols + x]; return o && t >= o.t ? o : null; };
    for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) {
      const o = owned(x, y); if (!o) continue;
      const [sx, sy] = toScreen(cam, x, y);
      if (sx < -ts || sy < -ts || sx > W || sy > H) continue;
      const a = easeOut(ramp(t, o.t, o.t + 0.4));
      const col = RACES[o.race].color;
      c.fillStyle = rgba(col, 0.34 * a); c.fillRect(sx, sy, ts, ts);
      // Worked-land decorations on some tiles, popping in after the claim.
      const tile = map.at(x, y);
      if (tile.t !== "water" && !(skip && skip.has(`${x},${y}`)) && hash(x * 3.7 + y * 9.1) < 0.2) {
        const p = ramp(t, o.t + 0.25, o.t + 0.6);
        if (p > 0) {
          const v = 1 + Math.floor(hash(x * 1.9 + y * 4.3) * 4);
          const im = IMG[v > 1 && IMG[`inf_${o.race}_${v}`] ? `inf_${o.race}_${v}` : `inf_${o.race}`];
          if (im) {
            const s = ts * easeBack(p);
            c.drawImage(im, sx + (ts - s) / 2, sy + (ts - s), s, s);
          }
        }
      }
      c.strokeStyle = rgba(lighten(col, 0.35), 0.95 * a);
      c.lineWidth = Math.max(3, ts * 0.055); c.lineCap = "round";
      const e = c.lineWidth / 2;
      const edge = (nx, ny, x1, y1, x2, y2) => {
        const n = owned(nx, ny);
        if (!n || n.race !== o.race) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
      };
      edge(x, y - 1, sx, sy + e, sx + ts, sy + e);
      edge(x, y + 1, sx, sy + ts - e, sx + ts, sy + ts - e);
      edge(x - 1, y, sx + e, sy, sx + e, sy + ts);
      edge(x + 1, y, sx + ts - e, sy, sx + ts - e, sy + ts);
    }
  }

  function computeClaims(map, sources) {
    const own = new Array(map.cols * map.rows).fill(null);
    for (let y = 0; y < map.rows; y++) for (let x = 0; x < map.cols; x++) {
      let best = null;
      for (const s of sources) {
        const d = Math.hypot(x - s.x, y - s.y);
        if (d > s.r) continue;
        const tt = s.t + d * s.speed + hash(x * 5.3 + y * 2.9) * 0.3;
        if (!best || tt < best.t) best = { race: s.race, t: tt };
      }
      own[y * map.cols + x] = best;
    }
    return own;
  }

  function dust(c, x, y, age, s) {
    if (age < 0 || age > 0.8) return;
    c.save();
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2, r = s * (0.2 + easeOut(age / 0.8) * 0.6);
      c.fillStyle = `rgba(215,195,160,${0.5 * (1 - age / 0.8)})`;
      c.beginPath(); c.arc(x + Math.cos(ang) * r, y + Math.sin(ang) * r * 0.45, s * 0.09 * (1 - age), 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function floatText(c, s, x, y, age, color, size = 44) {
    if (age < 0 || age > 1.4) return;
    const a = age < 0.15 ? age / 0.15 : 1 - ramp(age, 0.9, 1.4);
    text(c, s, x, y - easeOut(clamp(age / 1.4)) * 70, { size, color, alpha: a, stroke: "#140c05", strokeWidth: size * 0.14 });
  }

  // City: tier by time, bottom-anchored like render.js (drawn a little
  // larger than a tile so it reads on a trailer-sized frame), pop on tier-up.
  function drawCity(c, city, cam, t) {
    if (t < city.t0) return;
    let tier = city.tiers[0][1], changed = city.t0;
    for (const [tt, tr] of city.tiers) if (t >= tt) { tier = tr; changed = tt; }
    const im = IMG[`${city.race}_city_${tier}`]; if (!im) return;
    const [sx, sy] = toScreen(cam, city.x, city.y), ts = cam.s;
    const pop = 1 + 0.14 * (1 - easeOut(ramp(t, changed, changed + 0.4)));
    const found = easeBack(ramp(t, city.t0, city.t0 + 0.45));
    const w = ts * 1.3 * pop * found, h = w * (im.height / im.width);
    c.drawImage(im, sx + ts / 2 - w / 2, sy + ts * 1.05 - h, w, h);
    // Name plate with population badge.
    const col = RACES[city.race].color;
    const fs = Math.max(20, ts * 0.2);
    c.save();
    c.globalAlpha = found > 0 ? clamp(found) : 0;
    c.font = `700 ${Math.round(fs)}px ${FONT}`;
    const ph = fs * 1.5, tw = c.measureText(city.name).width + ph * 1.6;
    const px = sx + ts / 2 - tw / 2, py = sy + ts + ts * 0.04;
    c.fillStyle = "rgba(20,14,8,0.85)"; c.strokeStyle = lighten(col, 0.3); c.lineWidth = 2;
    c.beginPath(); c.roundRect(px, py, tw, ph, ph / 2); c.fill(); c.stroke();
    c.fillStyle = col; c.beginPath(); c.arc(px + ph / 2, py + ph / 2, ph * 0.42, 0, Math.PI * 2); c.fill();
    c.restore();
    text(c, String(tier), px + ph / 2, py + ph / 2 + 1, { size: fs * 0.9, color: "#fff", alpha: clamp(found), shadow: false });
    text(c, city.name, px + ph * 0.95, py + ph / 2 + 1, { size: fs, align: "left", color: "#f3e6c4", alpha: clamp(found), shadowBlur: 4 });
    if (t - changed < 1.4 && changed > city.t0 + 0.01) floatText(c, "+1 Pop", sx + ts / 2, sy + ts - h * 0.8, t - changed, lighten(col, 0.55), Math.max(30, ts * 0.26));
    dust(c, sx + ts / 2, sy + ts * 0.9, t - city.t0, ts * 1.2);
  }

  // ------------------------------------------------------------- dialogue
  // Parses "*emph*" and a leading "(stage direction)" into styled words;
  // `glue` marks a word that follows an emphasis with no space ("GEESE,").
  function styledWords(s) {
    const out = [];
    let dir = null;
    const m = s.match(/^\(([^)]*)\)\s*/);
    if (m) { dir = m[1]; s = s.slice(m[0].length); }
    if (dir) dir.split(" ").forEach((w, i, arr) => out.push({ w: (i === 0 ? "(" : "") + w + (i === arr.length - 1 ? ")" : ""), dir: true }));
    const segs = s.split("*");
    segs.forEach((seg, i) => seg.split(" ").forEach((w, j) => {
      if (w) out.push({ w, em: i % 2 === 1, glue: j === 0 && i > 0 && out.length > 0 && !segs[i - 1].endsWith(" ") });
    }));
    return out;
  }

  // who: { portrait, name, title, race }, side "left"|"right"; line text
  // reveals word by word from `start` like the in-game story panel.
  function dialogue(c, lt, who, side, line, start, o = {}) {
    const enterAt = o.enterAt == null ? start - 0.35 : o.enterAt;
    const enter = easeOut(ramp(lt, enterAt, enterAt + 0.4));
    const col = RACES[who.race] ? RACES[who.race].color : "#7c6a4a";
    const boxW = 1380, boxH = 250, bx = (W - boxW) / 2 + (side === "left" ? 120 : -120), by = H - boxH - 70;
    const pw = 400, ph = 500;
    const px = side === "left" ? bx - pw * 0.55 : bx + boxW - pw * 0.45;
    const py = by + boxH - ph + 10 + (1 - enter) * 60;
    c.save();
    c.globalAlpha *= enter;
    const g = c.createLinearGradient(0, by, 0, by + boxH);
    g.addColorStop(0, "rgba(34,24,14,0.94)"); g.addColorStop(1, "rgba(16,11,7,0.96)");
    c.fillStyle = g; c.strokeStyle = "#b8914a"; c.lineWidth = 4;
    c.beginPath(); c.roundRect(bx, by, boxW, boxH, 18); c.fill(); c.stroke();
    c.strokeStyle = "rgba(184,145,74,0.35)"; c.lineWidth = 1.5;
    c.beginPath(); c.roundRect(bx + 10, by + 10, boxW - 20, boxH - 20, 12); c.stroke();
    const im = IMG[`p_${who.portrait}`];
    c.save();
    c.shadowColor = "rgba(0,0,0,0.7)"; c.shadowBlur = 30;
    c.fillStyle = "#000"; c.fillRect(px - 6, py - 6, pw + 12, ph + 12);
    c.restore();
    if (im) c.drawImage(im, px, py, pw, ph);
    c.strokeStyle = "#c9a45a"; c.lineWidth = 6; c.strokeRect(px - 3, py - 3, pw + 6, ph + 6);
    c.fillStyle = col; c.fillRect(px - 3, py + ph - 8, pw + 6, 11);
    c.restore();
    const tx = side === "left" ? px + pw + 50 : bx + 50;
    const maxW = side === "left" ? bx + boxW - tx - 50 : px - tx - 50;
    text(c, who.name, tx, by + 48, { size: 38, align: "left", color: lighten(col, 0.45), alpha: enter });
    if (who.title) text(c, who.title, tx, by + 86, { size: 22, weight: 500, align: "left", color: "#bfae8a", alpha: enter });
    // Body text, word by word.
    const words = styledWords(line);
    const shown = Math.floor((lt - start) * 13);
    const size = o.size || 40;
    let x = tx, y = by + 142;
    c.save();
    c.globalAlpha *= enter;
    c.textBaseline = "middle"; c.textAlign = "left";
    c.shadowColor = "rgba(0,0,0,0.8)"; c.shadowBlur = 6;
    words.forEach((w, i) => {
      c.font = `${w.em || w.dir ? "italic " : ""}${w.em ? 700 : 400} ${size}px Georgia, serif`;
      if (w.glue) x -= c.measureText(" ").width;
      const ww = c.measureText(w.w + " ").width;
      if (x + ww - tx > maxW) { x = tx; y += size * 1.3; }
      if (i < shown) {
        c.fillStyle = w.dir ? "#a99c82" : w.em ? "#ffe29a" : "#f1e6cf";
        c.fillText(w.w, x, y);
      }
      x += ww;
    });
    c.restore();
  }

  // ----------------------------------------------------------- the shots
  // The glowing crack follows the one already painted on stone.jpg (480x600).
  const STONE_CRACK = [[244, 64], [238, 92], [230, 120], [222, 148], [214, 172], [206, 198], [199, 226]];
  const STONE_BRANCH = [[222, 148], [233, 168], [240, 192]];

  function shotStone(c, lt) {
    const [dx, dy] = shake(lt, [3.05], 12);
    const im = IMG.p_stone;
    const scale = lerp(1.0, 1.14, easeInOut(clamp(lt / 6.2)));
    const s = (H / 600) * 1.08 * scale;
    const ox = W / 2 - 240 * s + dx, oy = H / 2 - 320 * s + dy + lt * 4;
    // Wide blurred copy fills the frame, sharp stone in the middle.
    c.save(); c.filter = "blur(18px) brightness(0.55)"; drawCover(c, im, W / 2, H / 2, 1.15 * scale); c.restore();
    c.drawImage(im, ox, oy, 480 * s, 600 * s);
    const gl = c.createLinearGradient(ox, 0, ox + 480 * s, 0);
    gl.addColorStop(0, "rgba(0,0,0,0.9)"); gl.addColorStop(0.18, "rgba(0,0,0,0)"); gl.addColorStop(0.82, "rgba(0,0,0,0)"); gl.addColorStop(1, "rgba(0,0,0,0.9)");
    c.fillStyle = gl; c.fillRect(ox - 2, oy, 480 * s + 4, 600 * s);
    // Crack glow grows along the existing crack after the split.
    const grow = easeOut(ramp(lt, 3.0, 3.8));
    if (lt > 2.95) {
      const pts = STONE_CRACK.map(([x, y]) => [ox + x * s, oy + y * s]);
      const br = STONE_BRANCH.map(([x, y]) => [ox + x * s, oy + y * s]);
      const glow = 0.65 + 0.2 * Math.sin(lt * 2.2);
      c.save();
      c.globalCompositeOperation = "lighter";
      c.lineJoin = "round"; c.lineCap = "round";
      for (const [lw, a] of [[18, 0.16], [8, 0.4], [3, 0.95]]) {
        c.strokeStyle = `rgba(255,${190 + (lw < 10 ? 50 : 0)},110,${a * glow})`;
        c.lineWidth = lw * s * 0.6;
        const poly = (p, k) => { const n = Math.max(2, Math.ceil(p.length * k)); c.beginPath(); c.moveTo(p[0][0], p[0][1]); for (let i = 1; i < n; i++) c.lineTo(p[i][0], p[i][1]); c.stroke(); };
        poly(pts, grow);
        if (grow > 0.4) poly(br, ramp(grow, 0.4, 1));
      }
      c.restore();
    }
    rain(c, lt, easeOut(ramp(lt, 3.0, 4.2)), 1);
    lightning(c, lt, 2.95, 11, W * 0.62);
    caption(c, "For three hundred years,", lt, 0.5, 2.9, { y: 880, size: 60 });
    caption(c, "the Marchstone kept the peace.", lt, 1.3, 2.9, { y: 960, size: 60 });
    caption(c, "Then it split.", lt, 3.5, 6.2, { y: 920, size: 96 });
  }

  function shotCorvin(c, lt) {
    const im = IMG.p_stone;
    c.save(); c.filter = "blur(10px) brightness(0.6)"; drawCover(c, im, W / 2, H / 2 - 60, 1.3 + lt * 0.01); c.restore();
    rain(c, lt + 6, 1 - ramp(lt, 3.5, 4.8) * 0.4, 1);
    lightning(c, lt, 1.6, 23, W * 0.3);
    const who = { portrait: "corvin_wry", name: "Archmage Corvin Varro", title: "Archmage of the Collegium", race: "human" };
    const l1 = "The Marches pass to the crown that *holds* them…";
    const l2 = "…or failing that, to the crown that *remains*.";
    dialogue(c, lt, who, "left", lt < 2.5 ? l1 : l2, lt < 2.5 ? 0.4 : 2.5, { enterAt: 0.05, size: 46 });
  }

  function shotVista(c, lt) {
    const k = easeInOut(clamp(lt / 4.2));
    drawCover(c, IMG.titleBg, W / 2 + lerp(90, -60, k), H / 2 + lerp(40, -10, k), lerp(1.3, 1.08, k));
    c.fillStyle = "rgba(0,0,0,0.25)"; c.fillRect(0, 0, W, H);
    rain(c, lt + 11, 0.6 * (1 - ramp(lt, 0, 1.6)), 1);
    caption(c, "Five kingdoms.", lt, 0.5, 4.2, { y: 430, size: 104 });
    caption(c, "One contested land.", lt, 1.5, 4.2, { y: 570, size: 80 });
    embers(c, lt, 30, 0.5 * ramp(lt, 1, 2), 5);
  }

  const RACE_DUR = 1.72;
  function racePanel(c, id, u) {
    const r = RACES[id];
    const ts = 216;
    const scroll = u * 60;
    for (let y = 0; y < Math.ceil(H / ts) + 1; y++) for (let x = -1; x < Math.ceil(W / ts) + 1; x++) {
      const im = IMG[`${r.terrain}_${tileVar(x, y, 3)}`]; if (!im) continue;
      const n = Math.max(1, Math.round(im.width / im.height));
      const f = n > 1 ? Math.floor(u * 2 + hash(x + y)) % n : 0;
      c.drawImage(im, f * im.height, 0, im.height, im.height, x * ts - (scroll % ts), y * ts - 60, ts + 1, ts + 1);
    }
    const g = c.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "rgba(8,6,4,0.88)"); g.addColorStop(0.55, "rgba(8,6,4,0.55)"); g.addColorStop(1, "rgba(8,6,4,0.15)");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // Race-colour sash behind the name.
    c.save();
    c.fillStyle = rgba(r.color, 0.75);
    c.beginPath(); c.moveTo(0, 150); c.lineTo(1250, 150); c.lineTo(1170, 410); c.lineTo(0, 410); c.fill();
    c.fillStyle = rgba(lighten(r.color, 0.5), 0.9); c.fillRect(0, 404, 1172, 6);
    c.restore();
    const tIn = easeOut(ramp(u, 0.05, 0.45));
    text(c, r.label.toUpperCase(), 90 + (1 - tIn) * -80, 255, { size: 140, align: "left", alpha: tIn, color: "#fbf1da", spacing: 10, stroke: "rgba(0,0,0,0.6)", strokeWidth: 8 });
    text(c, r.tag, 96 + (1 - tIn) * -40, 355, { size: 46, align: "left", alpha: easeOut(ramp(u, 0.2, 0.6)), color: "#f7e7c0", weight: 600 });
    // Their capital on the right.
    const cs = 1 + u * 0.04;
    if (IMG[r.city]) {
      const im = IMG[r.city], w = 420 * cs, h = w * (im.height / im.width);
      c.drawImage(im, 1420 - w / 2, 1010 - h, w, h);
    }
    // Three units march in from the left.
    r.units.forEach((key, i) => {
      const p = easeOut(ramp(u, 0.08 + i * 0.08, 0.5 + i * 0.08));
      const x = 230 + i * 260 - (1 - p) * 500 + u * 25;
      const bob = Math.abs(Math.sin(u * 7 + i)) * 8 * (1 - p * 0.6);
      sprite(c, key, unitFrame(u, i), x, 960 - bob, 330, { alpha: p });
    });
  }

  function shotRaces(c, lt) {
    for (let i = 0; i < RACE_ORDER.length; i++) {
      const u = lt - i * RACE_DUR;
      if (u < 0 || u > RACE_DUR + 0.3) continue;
      const wipe = easeInOut(ramp(u, 0, 0.26));
      c.save();
      if (i > 0 && wipe < 1) {
        const wx = lerp(-260, W + 260, wipe);
        c.beginPath(); c.moveTo(0, 0); c.lineTo(wx + 200, 0); c.lineTo(wx - 200, H); c.lineTo(0, H); c.closePath(); c.clip();
      }
      racePanel(c, RACE_ORDER[i], u);
      if (i > 0 && wipe < 1) {
        // Bright edge on the wipe line, in the incoming race's colour.
        const wx = lerp(-260, W + 260, wipe);
        c.strokeStyle = lighten(RACES[RACE_ORDER[i]].color, 0.4); c.lineWidth = 10;
        c.beginPath(); c.moveTo(wx + 200, 0); c.lineTo(wx - 200, H); c.stroke();
      }
      c.restore();
    }
  }

  // --- Map: claim land + grow cities
  const MAP1 = buildMap(28, 16, (x, y) => {
    const lake = ((x - 14) / 3.4) ** 2 + ((y - 13) / 2.2) ** 2 < 1;
    const river = y < 12 && Math.abs(x - (13.6 + 1.1 * Math.sin(y * 0.75))) < 0.6;
    if (lake || river) return { t: "water" };
    const n = fbm(x * 0.35, y * 0.35, 4);
    let t = "plains";
    if (x < 12) t = n > 0.5 ? "forest" : "plains";
    else if (x > 16) t = n > 0.6 ? "mountains" : n > 0.46 ? "hills" : "plains";
    else if (n > 0.62) t = "hills";
    if ((x === 6 && y === 6) || (x === 8 && y === 11) || (x === 21 && y === 7)) t = "plains";
    return { t, v: tileVar(x, y) };
  });
  const CITIES1 = [
    { name: "Sylvaneth", race: "elf", x: 6, y: 6, t0: -5, tiers: [[-5, 2], [0.9, 3], [2.1, 4], [3.4, 5], [4.8, 6]] },
    { name: "Grimgate", race: "dwarf", x: 21, y: 7, t0: -5, tiers: [[-5, 2], [1.4, 3], [2.8, 4], [4.2, 5]] },
    { name: "Thalindor", race: "elf", x: 8, y: 11, t0: 2.3, tiers: [[2.3, 1], [3.9, 2], [5.3, 3]] },
  ];
  const OWN1 = computeClaims(MAP1, [
    { race: "elf", x: 6, y: 6, t: -0.8, r: 8.2, speed: 0.42 },
    { race: "dwarf", x: 21, y: 7, t: -0.6, r: 8.2, speed: 0.42 },
    { race: "elf", x: 8, y: 11, t: 2.35, r: 3.6, speed: 0.35 },
  ]);
  const CITY_KEYS1 = new Set(CITIES1.map((c) => `${c.x},${c.y}`));
  const PIONEER_PATH = [[6, 7], [6.5, 8.5], [7.3, 9.8], [8, 11]];

  function pathAt(path, p) {
    const segs = path.length - 1, f = clamp(p) * segs, i = Math.min(segs - 1, Math.floor(f)), k = f - i;
    return [lerp(path[i][0], path[i + 1][0], k), lerp(path[i][1], path[i + 1][1], k)];
  }

  function shotMap(c, lt) {
    const k = easeInOut(ramp(lt, 0, 4.8));
    const cam = { x: lerp(7.2, 13.4, k), y: lerp(8, 8.4, k), s: lerp(155, 92, k) };
    drawMap(c, MAP1, cam, lt);
    drawInfluence(c, MAP1, OWN1, cam, lt, CITY_KEYS1);
    for (const city of CITIES1) drawCity(c, city, cam, lt);
    // Pioneer walks out and founds Thalindor.
    if (lt < 2.45) {
      const [px, py] = pathAt(PIONEER_PATH, ramp(lt, 0.5, 2.2));
      const [sx, sy] = toScreen(cam, px, py);
      sprite(c, "elf_pioneer", unitFrame(lt), sx + cam.s / 2, sy + cam.s * 0.95 - Math.abs(Math.sin(lt * 9)) * cam.s * 0.04, cam.s * 1.3, { alpha: 1 - ramp(lt, 2.25, 2.45) });
    }
    caption(c, "Claim the land, tile by tile.", lt, 0.3, 3.2, { y: 120 });
    caption(c, "Raise mighty cities.", lt, 3.3, 6.2, { y: 120 });
  }

  // --- Battle in the rain
  const MAP2 = buildMap(16, 9, (x, y) => {
    const n = fbm(x * 0.4, y * 0.4, 9);
    let t = y < 2 && n > 0.45 ? "forest" : n > 0.62 ? "hills" : "plains";
    if (y >= 3 && y <= 5 && x >= 3 && x <= 10) t = "plains";
    return { t, v: tileVar(x, y, 2) };
  });

  function hpBar(c, x, y, w, frac, col) {
    c.fillStyle = "rgba(0,0,0,0.7)"; c.fillRect(x - w / 2 - 2, y - 2, w + 4, 14);
    c.fillStyle = frac > 0.5 ? "#5fbf4a" : frac > 0.25 ? "#e0b030" : "#d0442c";
    c.fillRect(x - w / 2, y, w * clamp(frac), 10);
    c.fillStyle = col; c.fillRect(x - w / 2 - 2, y + 12, w + 4, 3);
  }

  function sparks(c, x, y, age) {
    if (age < 0 || age > 0.35) return;
    c.save();
    c.strokeStyle = `rgba(255,200,120,${1 - age / 0.35})`; c.lineWidth = 4; c.lineCap = "round";
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, r0 = 20 + age * 160, r1 = r0 + 26;
      c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); c.stroke();
    }
    c.restore();
  }

  function shotBattle(c, lt) {
    const [dx, dy] = shake(lt, [1.25, 3.65], 9);
    const cam = { x: 6.0 - dx / 210, y: 4.2 - dy / 210, s: lerp(215, 235, clamp(lt / 6.2)) };
    drawMap(c, MAP2, cam, lt + 30);
    const ts = cam.s;
    const pos = (x, y) => { const [sx, sy] = toScreen(cam, x, y); return [sx + ts / 2, sy + ts * 0.92]; };
    const lunge = (a, b) => Math.sin(clamp((lt - a) / (b - a)) * Math.PI) * 0.55;
    const kx = 5 + lunge(0.9, 1.6) + lunge(3.3, 4.0);
    // Ogre HP 12 -> 7 -> 0, knight 10 -> 9, raider 5 -> 1.
    const ogreHp = lt < 1.9 ? 1 : lt < 4.25 ? 7 / 12 : 0;
    const raiderHp = lt < 2.95 ? 1 : 0.2;
    const knightHp = lt < 1.9 ? 1 : 0.9;
    const ogreDie = ramp(lt, 4.3, 5.1);
    const human = RACES.human.color, orc = RACES.orc.color;
    let [x, y] = pos(4, 5); sprite(c, "archer_2", unitFrame(lt, 1), x, y, ts * 1.4); hpBar(c, x, y + 8, ts * 0.55, 1, human);
    [x, y] = pos(8.2, 5); sprite(c, "raider", unitFrame(lt, 2), x, y, ts * 1.4, { flip: true }); hpBar(c, x, y + 8, ts * 0.55, raiderHp, orc);
    if (ogreDie < 1) {
      [x, y] = pos(7, 4);
      sprite(c, "ogre_1", unitFrame(lt, 3), x, y + ogreDie * ts * 0.25, ts * 1.6, { flip: true, alpha: 1 - ogreDie, rot: ogreDie * 0.5 });
      if (ogreDie === 0) hpBar(c, x, y + 8, ts * 0.55, ogreHp, orc);
    }
    [x, y] = pos(kx, 4); sprite(c, "knight_1", unitFrame(lt), x, y, ts * 1.5); hpBar(c, x, y + 8, ts * 0.55, knightHp, human);
    const [kxs, kys] = pos(5, 4), [ox, oy] = pos(7, 4), [rx, ry] = pos(8.2, 5), [ax, ay] = pos(4, 5);
    sparks(c, (kxs + ox) / 2 + ts * 0.1, oy - ts * 0.6, lt - 1.25);
    sparks(c, (kxs + ox) / 2 + ts * 0.1, oy - ts * 0.6, lt - 3.65);
    // Arrow arc from archer to raider.
    const ap = ramp(lt, 2.4, 2.95);
    if (ap > 0 && ap < 1) {
      const arc = ts * 0.9;
      const px = lerp(ax, rx, ap), py = lerp(ay, ry, ap) - ts * 0.6 - Math.sin(ap * Math.PI) * arc;
      const ang = Math.atan2(-Math.cos(ap * Math.PI) * Math.PI * arc, rx - ax);
      c.save(); c.translate(px, py); c.rotate(ang);
      c.strokeStyle = "#e8dcc0"; c.lineWidth = 5; c.beginPath(); c.moveTo(-40, 0); c.lineTo(10, 0); c.stroke();
      c.fillStyle = "#e8dcc0"; c.beginPath(); c.moveTo(22, 0); c.lineTo(6, -9); c.lineTo(6, 9); c.fill();
      c.restore();
    }
    floatText(c, "-5", ox, oy - ts * 1.2, lt - 1.9, "#ff6b4a", 64);
    floatText(c, "-1", kxs, kys - ts * 1.2, lt - 1.95, "#ff6b4a", 52);
    floatText(c, "-4", rx, ry - ts * 1.1, lt - 2.95, "#ff6b4a", 60);
    floatText(c, "-7", ox, oy - ts * 1.2, lt - 4.25, "#ff6b4a", 72);
    floatText(c, "+12 XP", kxs - ts * 0.9, kys - ts * 0.9, lt - 4.5, "#9fd8ff", 48);
    // Level up: a slow gold ring and banner, no flash.
    const lu = lt - 4.95;
    if (lu > 0) {
      const [lx, ly] = pos(5, 4);
      const rr = 40 + easeOut(clamp(lu)) * ts * 0.7;
      c.save();
      c.strokeStyle = `rgba(255,215,120,${0.8 * (1 - ramp(lu, 0, 1.0))})`; c.lineWidth = 8;
      c.beginPath(); c.ellipse(lx, ly - ts * 0.1, rr, rr * 0.35, 0, 0, Math.PI * 2); c.stroke();
      c.restore();
      const a = easeBack(ramp(lu, 0, 0.35));
      goldText(c, "Level Up!", lx, ly - ts * 1.6, 84 * a, { alpha: clamp(a) });
    }
    rain(c, lt + 30, 1, 2);
    lightning(c, lt, 0.4, 37, W * 0.82);
    lightning(c, lt, 3.9, 51, W * 0.2);
    caption(c, "Clash through storm and steel.", lt, 0.2, 3.3, { y: 120 });
    caption(c, "Veterans rise from every battle.", lt, 3.4, 6.2, { y: 120 });
  }

  // --- Tech tree
  const TECHS = ["Knighthood", "Wizardry", "Fireball!", "Longbow", "Walls", "Teleportation",
    "Home in the Trees", "The Murmuring of Leaves", "Aelderwatch", "Hound and Hunter", "Sanctuary under Green Boughs", "Watching, Hunting",
    "Stonecunning", "Heavy Metal", "Vault-Finder", "Ancestral Dolmen", "Deep Roads Rite", "Steely Eyed",
    "Dire Wolf", "Wolf Riders", "Dragon Riders", "Strike from the Shadows", "Rouse the People", "Undaunted",
    "Invulnerability", "Defend the Walls", "Battle Mage",
    "Set the Trap", "The Road Goes Ever On", "Keep an Eye Out", "Farm Soil", "Fishing", "Tending to the Earth",
    "Trebuchet Engineering", "Catapult Engineering", "Sail the Skies", "Altar of Ages"];
  const TECH_COLS = 7, TECH_ROWS = 5;

  function shotTech(c, lt) {
    const bg = c.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7);
    bg.addColorStop(0, "#2a2014"); bg.addColorStop(1, "#0b0805");
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const panX = lerp(120, -620, easeInOut(clamp(lt / 3.8)));
    const nw = 330, nh = 100, gx = 420, gy = 160, oy = 260;
    const node = (col, row) => [panX + col * gx, oy + row * gy];
    const unlockAt = (col, row) => 0.25 + col * 0.42 + hash(col * 7 + row) * 0.25;
    for (let col = 0; col < TECH_COLS - 1; col++) for (let row = 0; row < TECH_ROWS; row++) {
      const targets = [row, row + (hash(col + row * 5) > 0.5 ? 1 : -1)].filter((r) => r >= 0 && r < TECH_ROWS);
      for (const tr of targets) {
        const [x1, y1] = node(col, row), [x2, y2] = node(col + 1, tr);
        const lit = lt > Math.max(unlockAt(col, row), unlockAt(col + 1, tr));
        c.strokeStyle = lit ? "rgba(240,200,103,0.85)" : "rgba(140,120,90,0.35)";
        c.lineWidth = lit ? 4 : 2;
        c.beginPath(); c.moveTo(x1 + nw, y1 + nh / 2); c.bezierCurveTo(x1 + nw + 50, y1 + nh / 2, x2 - 50, y2 + nh / 2, x2, y2 + nh / 2); c.stroke();
      }
    }
    const raceCols = RACE_ORDER.map((r) => RACES[r].color);
    for (let col = 0; col < TECH_COLS; col++) for (let row = 0; row < TECH_ROWS; row++) {
      const [x, y] = node(col, row);
      if (x > W + 50 || x + nw < -50) continue;
      const u = ramp(lt, unlockAt(col, row), unlockAt(col, row) + 0.3);
      const name = TECHS[(col * TECH_ROWS + row) % TECHS.length];
      c.save();
      if (u > 0) { c.shadowColor = `rgba(255,200,90,${0.7 * u})`; c.shadowBlur = 26 * u; }
      c.fillStyle = u > 0 ? `rgba(${lerp(40, 70, u)},${lerp(32, 52, u)},${lerp(22, 24, u)},0.96)` : "rgba(36,30,24,0.9)";
      c.strokeStyle = u > 0 ? `rgba(240,200,103,${0.4 + 0.6 * u})` : "rgba(120,100,70,0.6)";
      c.lineWidth = 3;
      c.beginPath(); c.roundRect(x, y, nw, nh, 12); c.fill(); c.stroke();
      c.restore();
      c.fillStyle = raceCols[row]; c.beginPath(); c.arc(x + 38, y + nh / 2, 20, 0, Math.PI * 2); c.fill();
      if (u > 0) text(c, "✓", x + 38, y + nh / 2 + 1, { size: 26, color: "#fff", alpha: u, font: "Georgia, serif", shadow: false });
      text(c, name, x + 70, y + nh / 2 + 1, { size: name.length > 20 ? 21 : 26, align: "left", weight: 600, color: u > 0 ? "#ffeebb" : "#a89878", shadowBlur: 3 });
    }
    const n = Math.round(185 * easeOut(ramp(lt, 0.2, 3.0)));
    c.fillStyle = "rgba(10,7,4,0.75)"; c.fillRect(0, 0, W, 190);
    goldText(c, String(n), W / 2 - 250, 105, 120, { align: "right" });
    text(c, "technologies to discover", W / 2 - 220, 110, { size: 58, align: "left", color: "#f3e6c4" });
  }

  // --- Story
  function storyBg(c, lt, terrain) {
    c.save();
    c.filter = "blur(10px) brightness(0.45)";
    const ts = 260;
    for (let y = -1; y < 6; y++) for (let x = -1; x < 9; x++) {
      const im = IMG[`${terrain}_${tileVar(x, y, 8)}`]; if (!im) continue;
      c.drawImage(im, 0, 0, im.height, im.height, x * ts - lt * 12, y * ts, ts + 1, ts + 1);
    }
    c.restore();
    c.fillStyle = "rgba(10,6,4,0.35)"; c.fillRect(0, 0, W, H);
  }

  function shotStory(c, lt) {
    storyBg(c, lt, "swamp");
    if (lt < 1.7) {
      caption(c, "Every kingdom has a story.", lt, 0.1, 1.7, { y: 470, size: 92 });
      caption(c, "And its people remember what you did.", lt, 0.6, 1.7, { y: 590, size: 50 });
      return;
    }
    const skarra = { portrait: "skarra_gleeful", name: "Skarra Ironjaw, the Bog-Mother", title: "Bog Witch of Bloodmire", race: "orc" };
    const gnashC = { portrait: "gnash_confused", name: "Gnash", title: "The Butcher of Bloodmire", race: "orc" };
    const gnashS = Object.assign({}, gnashC, { portrait: "gnash_sad" });
    if (lt < 4.1) dialogue(c, lt, skarra, "right", "Skarra will turn their chapel into a *FROG POND!*", 1.95, { enterAt: 1.6 });
    else if (lt < 6.1) dialogue(c, lt, gnashC, "left", "Farmers have *GEESE*, chief.", 4.35, { enterAt: 4.1 });
    else dialogue(c, lt, gnashS, "left", "(shuddering) Goose bite Gnash in places Gnash not talk about.", 6.2, { enterAt: 6.1 });
  }

  // --- Treasure
  const MAP3 = buildMap(16, 9, (x, y) => {
    const n = fbm(x * 0.45, y * 0.45, 21);
    let t = n > 0.52 ? "forest" : "plains";
    if (y >= 3 && y <= 5 && x >= 3 && x <= 11) t = "plains";
    return { t, v: tileVar(x, y, 5) };
  });
  const ITEMS = [
    { key: "itemRock", name: "Lucky Rock", col: "#d8d0c0" },
    { key: "itemMythril", name: "Mythril Armor", col: "#7fb8ff" },
    { key: "itemAxe", name: "Axe of Doom", col: "#ffae4a" },
  ];

  function chest(c, key, cx, bottom, s, wob, open) {
    const im = IMG[key]; if (!im) return;
    c.save();
    c.translate(cx, bottom);
    c.rotate(Math.sin(wob * 40) * 0.08 * (wob > 0 ? 1 : 0));
    if (open > 0) {
      // Soft light rays behind the lid.
      c.save();
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.22 + Math.sin(open * 2 + i) * 0.03;
        const g = c.createLinearGradient(0, -s * 0.5, Math.cos(a) * s * 1.6, -s * 0.5 + Math.sin(a) * s * 1.6);
        g.addColorStop(0, `rgba(255,220,130,${0.45 * clamp(open * 3)})`); g.addColorStop(1, "rgba(255,220,130,0)");
        c.fillStyle = g;
        c.beginPath(); c.moveTo(0, -s * 0.5);
        c.lineTo(Math.cos(a - 0.07) * s * 1.6, -s * 0.5 + Math.sin(a - 0.07) * s * 1.6);
        c.lineTo(Math.cos(a + 0.07) * s * 1.6, -s * 0.5 + Math.sin(a + 0.07) * s * 1.6); c.fill();
      }
      c.restore();
    }
    c.drawImage(im, -s / 2, -s, s, s);
    c.restore();
  }

  function shotTreasure(c, lt) {
    const pan = easeInOut(ramp(lt, 3.0, 3.8));
    const cam = { x: lerp(5.6, 7.4, pan), y: 4.0, s: 200 };
    drawMap(c, MAP3, cam, lt + 47);
    const ts = cam.s;
    const pos = (x, y) => { const [sx, sy] = toScreen(cam, x, y); return [sx + ts / 2, sy + ts * 0.92]; };
    // Chest 1 at (6,5): pony patrol walks up, it wobbles and bursts open.
    const open = ramp(lt, 1.45, 3.0);
    let [cx, cy] = pos(6, 5);
    chest(c, "chestA", cx, cy, ts * 0.8, lt > 1.0 && lt < 1.45 ? lt : 0, open);
    const walk = ramp(lt, 0.2, 1.0);
    const [ux, uy] = pos(lerp(3.6, 5.1, walk), 5);
    sprite(c, "pony_patrol_1", unitFrame(lt), ux, uy - (walk > 0 && walk < 1 ? Math.abs(Math.sin(lt * 10)) * 8 : 0), ts * 1.3);
    ITEMS.forEach((it, i) => {
      const t0 = 1.55 + i * 0.22, p = easeOut(ramp(lt, t0, t0 + 0.55));
      if (p <= 0) return;
      const tx = cx + (i - 1) * ts * 1.3, ty = cy - ts * (i === 1 ? 1.75 : 1.45);
      const x = lerp(cx, tx, p), y = lerp(cy - ts * 0.5, ty, p) - Math.sin(p * Math.PI) * ts * 0.5;
      const bob = Math.sin(lt * 2.5 + i) * 6;
      c.save();
      c.shadowColor = it.col; c.shadowBlur = 30;
      const im = IMG[it.key]; if (im) c.drawImage(im, x - ts * 0.42, y - ts * 0.42 + bob, ts * 0.84, ts * 0.84);
      c.restore();
      text(c, it.name, x, y + ts * 0.5 + bob, { size: 32, color: it.col, alpha: ramp(p, 0.6, 1), stroke: "#140c05", strokeWidth: 6 });
    });
    // Chest 2 at (9,4): a Giltmaw.
    [cx, cy] = pos(9, 4);
    const reveal = ramp(lt, 3.8, 4.25);
    if (reveal <= 0) chest(c, "chestB", cx, cy, ts * 0.8, lt > 3.3 ? lt : 0, 0);
    else sprite(c, "giltmaw_1", unitFrame(lt * 1.5), cx, cy, ts * 1.3 * easeBack(reveal), { flip: true });
    caption(c, "Uncover lost treasure…", lt, 0.2, 3.5, { y: 120 });
    caption(c, "…if it doesn't bite first.", lt, 3.9, 5.8, { y: 120 });
    if (lt > 4.2) dialogue(c, lt, { portrait: "gnash_happy", name: "Gnash", title: "The Butcher of Bloodmire", race: "orc" }, "left", "Chest with *TEETH!* Gnash eat chest before chest eat Gnash!", 4.45, { enterAt: 4.2, size: 38 });
  }

  // --- Monsters & a dragon over a stormy map
  function shotMonsters(c, lt) {
    const cam = { x: 12 + lt * 0.5, y: 8, s: 100 };
    drawMap(c, MAP1, cam, lt + 52);
    drawInfluence(c, MAP1, OWN1, cam, 10, CITY_KEYS1);
    for (const city of CITIES1) drawCity(c, city, cam, 10);
    c.fillStyle = "rgba(30,10,40,0.3)"; c.fillRect(0, 0, W, H);
    rain(c, lt + 52, 0.55, 4);
    lightning(c, lt, 0.2, 71, W * 0.45);
    const mons = [["highland_griffin_1", "Highland Griffin"], ["basilisk_1", "Basilisk"], ["treasure_trow_1", "Treasure Trow"], ["dire_spider_1", "Dire Spider"]];
    mons.forEach(([k, name], i) => {
      const p = easeBack(ramp(lt, 0.5 + i * 0.25, 0.9 + i * 0.25));
      if (p <= 0) return;
      const x = 330 + i * 420, y = 1000;
      c.save(); c.fillStyle = "rgba(0,0,0,0.45)"; c.beginPath(); c.ellipse(x, y - 8, 140 * p, 26 * p, 0, 0, Math.PI * 2); c.fill(); c.restore();
      sprite(c, k, unitFrame(lt, i), x, y, 330 * p);
      text(c, name, x, y + 30, { size: 32, alpha: ramp(lt, 0.8 + i * 0.25, 1.1 + i * 0.25), color: "#f3e6c4", stroke: "#140c05", strokeWidth: 6 });
    });
    // Dragon swoops across.
    const dp = ramp(lt, 0.0, 2.9);
    if (dp > 0 && dp < 1) {
      const x = lerp(-420, W + 420, dp), y = 800 - Math.sin(dp * Math.PI) * 130;
      sprite(c, "dragon", Math.floor(lt * 4), x, y, 470, { flip: true, rot: 0.1 });
    }
    caption(c, "Beware what wanders the Marches.", lt, 0.25, 3.2, { y: 120 });
  }

  // --- Logo
  function shotLogo(c, lt) {
    c.save(); c.filter = "blur(8px) brightness(0.45)"; drawCover(c, IMG.titleBg, W / 2, H / 2, 1.1 + lt * 0.01); c.restore();
    embers(c, lt + 55, 70, 1, 9);
    const p = ramp(lt, 0.2, 1.3);
    const s = lerp(1.25, 1, easeOut(p));
    const im = IMG.logo;
    if (im) {
      const w = 820 * s, h = w * (im.height / im.width);
      c.save();
      c.globalAlpha = easeOut(p);
      c.shadowColor = "rgba(255,190,90,0.55)"; c.shadowBlur = 50;
      c.drawImage(im, W / 2 - w / 2, 440 - h / 2, w, h);
      c.restore();
    }
    const a = easeOut(ramp(lt, 1.4, 2.0));
    text(c, "A strategy game of five rival kingdoms", W / 2, 885, { size: 40, alpha: a, color: "#f0e2bf", weight: 600 });
    goldText(c, "PLAY FREE NOW", W / 2, 965, 64, { alpha: easeOut(ramp(lt, 1.8, 2.4)), spacing: 8 });
    // Gimlet pops up in the corner for the last word.
    const g = easeBack(ramp(lt, 2.4, 2.8));
    if (g > 0 && IMG.p_gimlet_happy) {
      const r = 105 * g, gx = W - 180, gy = H - 150;
      c.save();
      c.beginPath(); c.arc(gx, gy, r, 0, Math.PI * 2); c.closePath();
      c.fillStyle = "#000"; c.fill(); c.clip();
      c.drawImage(IMG.p_gimlet_happy, gx - r, gy - r * 1.05, r * 2, r * 2.5);
      c.restore();
      c.strokeStyle = "#c9a45a"; c.lineWidth = 6; c.beginPath(); c.arc(gx, gy, r, 0, Math.PI * 2); c.stroke();
      const b = easeBack(ramp(lt, 2.75, 3.05));
      if (b > 0) {
        c.save();
        c.translate(gx - 175, gy - 110); c.scale(b, b);
        c.fillStyle = "#f7efdc"; c.strokeStyle = "#3a2410"; c.lineWidth = 4;
        c.beginPath(); c.roundRect(-85, -42, 170, 84, 30); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(50, 38); c.lineTo(88, 70); c.lineTo(22, 40); c.fill();
        c.restore();
        text(c, "Arf!", gx - 175, gy - 108, { size: 44 * b, color: "#3a2410", shadow: false });
      }
    }
  }

  // [start, end, draw, fadeIn, fadeOut] -- overlapping ends crossfade.
  const SHOTS = [
    [0.0, 6.3, shotStone, 1.2, 0.4],
    [6.0, 10.8, shotCorvin, 0.4, 0.35],
    [10.5, 14.8, shotVista, 0.35, 0.2],
    [14.6, 23.2, shotRaces, 0.2, 0.3],
    [23.0, 29.2, shotMap, 0.3, 0.3],
    [29.0, 35.2, shotBattle, 0.3, 0.3],
    [35.0, 38.8, shotTech, 0.3, 0.3],
    [38.6, 47.2, shotStory, 0.3, 0.3],
    [47.0, 52.8, shotTreasure, 0.3, 0.3],
    [52.6, 55.8, shotMonsters, 0.3, 0.3],
    [55.6, 60.0, shotLogo, 0.3, 0.8],
  ];

  // Sound effects: { t, src, vol, dur, loop, fi, fo } (src relative to assets/).
  const CUES = [
    { t: 2.95, src: "sfx/weather_thunder_1.mp3", vol: 0.9 },
    { t: 3.0, src: "sfx/weather_storm_loop.mp3", vol: 0.45, dur: 8.0, loop: true, fi: 0.8, fo: 2.0 },
    { t: 7.6, src: "sfx/weather_thunder_2.mp3", vol: 0.5 },
    { t: 14.6, src: "sfx/human_knight_attack_1.mp3", vol: 0.5 },
    { t: 16.32, src: "sfx/elf_ranger_attack_1.mp3", vol: 0.5 },
    { t: 18.04, src: "sfx/dwarf_foehammer_attack_1.mp3", vol: 0.5 },
    { t: 19.76, src: "sfx/orc_ogre_attack_1.mp3", vol: 0.5 },
    { t: 21.48, src: "sfx/halfellow_pony_patrol_attack_1.mp3", vol: 0.5 },
    { t: 25.3, src: "sfx/elf_pioneer_found_1.mp3", vol: 0.6 },
    { t: 29.0, src: "sfx/weather_rain_loop.mp3", vol: 0.45, dur: 6.2, loop: true, fi: 0.4, fo: 0.6 },
    { t: 29.4, src: "sfx/weather_thunder_3.mp3", vol: 0.6 },
    { t: 30.2, src: "sfx/human_knight_attack_1.mp3", vol: 0.8 },
    { t: 31.4, src: "sfx/human_archer_attack_1.mp3", vol: 0.7 },
    { t: 32.6, src: "sfx/human_knight_attack_2.mp3", vol: 0.8 },
    { t: 32.9, src: "sfx/weather_thunder_1.mp3", vol: 0.45 },
    { t: 33.3, src: "sfx/orc_ogre_death_1.mp3", vol: 0.7 },
    { t: 33.95, src: "sfx/system_research_complete_1.mp3", vol: 0.6 },
    { t: 36.2, src: "sfx/system_research_complete_2.mp3", vol: 0.5 },
    { t: 48.4, src: "sfx/system_treasure_chest_open_1.mp3", vol: 0.8 },
    { t: 48.6, src: "sfx/system_unique_item_found_1.mp3", vol: 0.6 },
    { t: 50.85, src: "sfx/orc_dire_wolf_attack_2.mp3", vol: 0.7 },
    { t: 52.8, src: "sfx/weather_thunder_2.mp3", vol: 0.5 },
    { t: 53.1, src: "sfx/orc_dragon_attack_1.mp3", vol: 0.7 },
  ];

  function drawFrame(t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
    for (const [a, b, fn, fi, fo] of SHOTS) {
      if (t < a || t > b) continue;
      const alpha = window01(t, a, b, fi, fo);
      if (alpha <= 0) continue;
      lctx.setTransform(1, 0, 0, 1, 0, 0);
      lctx.globalAlpha = 1; lctx.filter = "none"; lctx.globalCompositeOperation = "source-over";
      lctx.clearRect(0, 0, W, H);
      fn(lctx, t - a);
      ctx.globalAlpha = alpha;
      ctx.drawImage(layer, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(vignette, 0, 0);
  }

  // ------------------------------------------------------------- playback
  const $ = (id) => document.getElementById(id);
  const playBtn = $("play"), scrub = $("scrub"), timeEl = $("time"), renderBtn = $("render"), status = $("status");
  scrub.max = DURATION;
  let actx = null, buffers = {}, playing = null;

  async function loadAudio() {
    actx = new AudioContext();
    const srcs = [MUSIC.src, ...new Set(CUES.map((c) => c.src))];
    await Promise.all(srcs.map(async (s) => {
      try { buffers[s] = await actx.decodeAudioData(await (await fetch(A + s)).arrayBuffer()); }
      catch (e) { console.warn("missing audio", s); }
    }));
  }

  function startAudio(from) {
    const t0 = actx.currentTime + 0.08, nodes = [];
    const add = (buf, when, offset, vol, dur, loop, fi, fo) => {
      const src = actx.createBufferSource(), g = actx.createGain();
      src.buffer = buf; src.loop = !!loop;
      src.connect(g).connect(actx.destination);
      const startAt = Math.max(t0, t0 + when - from), skip = Math.max(0, from - when);
      const end = t0 + when - from + dur;
      g.gain.setValueAtTime(fi && skip < fi ? 0 : vol, startAt);
      if (fi && skip < fi) g.gain.linearRampToValueAtTime(vol, startAt + fi - skip);
      if (fo) { g.gain.setValueAtTime(vol, Math.max(startAt, end - fo)); g.gain.linearRampToValueAtTime(0, end); }
      src.start(startAt, (offset + skip) % buf.duration);
      src.stop(end);
      nodes.push(src);
    };
    const m = buffers[MUSIC.src];
    if (m) add(m, 0, MUSIC.offset, MUSIC.vol, DURATION, false, MUSIC.fadeIn, MUSIC.fadeOut);
    for (const cue of CUES) {
      const b = buffers[cue.src]; if (!b) continue;
      const dur = cue.dur || b.duration;
      if (cue.t + dur < from) continue;
      add(b, cue.t, 0, cue.vol == null ? 1 : cue.vol, dur, cue.loop, cue.fi, cue.fo);
    }
    return { t0, from, nodes };
  }

  function stop() {
    if (!playing) return;
    playing.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* already stopped */ } });
    playing = null;
    playBtn.textContent = "Play";
  }

  function tick() {
    if (!playing) return;
    const t = actx.currentTime - playing.t0 + playing.from;
    if (t >= DURATION) { stop(); drawFrame(DURATION - 0.001); return; }
    drawFrame(Math.max(0, t));
    scrub.value = t; timeEl.textContent = Math.max(0, t).toFixed(2);
    requestAnimationFrame(tick);
  }

  playBtn.onclick = async () => {
    if (playing) { stop(); return; }
    await actx.resume();
    let from = parseFloat(scrub.value) || 0;
    if (from >= DURATION - 0.1) from = 0;
    playing = startAudio(from);
    playBtn.textContent = "Pause";
    requestAnimationFrame(tick);
  };
  scrub.oninput = () => { stop(); const t = parseFloat(scrub.value); drawFrame(t); timeEl.textContent = t.toFixed(2); };

  // ---------------------------------------------------------------- export
  // The audio mix, as ffmpeg arguments (paths relative to the repo root,
  // where capture-server.pl runs) -- built from the same MUSIC/CUES the
  // preview plays, so the MP4 sounds exactly like the page.
  function ffmpegArgs() {
    const args = ["-y", "-loglevel", "error", "-i", "trailer/out/video.mp4",
      "-ss", String(MUSIC.offset), "-t", String(DURATION), "-i", "assets/" + MUSIC.src];
    const fmt = "aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo";
    const filters = [`[1:a]${fmt},volume=${MUSIC.vol},afade=t=in:d=${MUSIC.fadeIn},afade=t=out:st=${DURATION - MUSIC.fadeOut}:d=${MUSIC.fadeOut}[m]`];
    const labels = ["[m]"];
    CUES.forEach((cue, i) => {
      if (cue.loop) args.push("-stream_loop", "-1");
      args.push("-i", "assets/" + cue.src);
      let f = `[${i + 2}:a]${fmt}`;
      if (cue.dur) f += `,atrim=0:${cue.dur},asetpts=PTS-STARTPTS`;
      f += `,volume=${cue.vol == null ? 1 : cue.vol}`;
      if (cue.fi) f += `,afade=t=in:d=${cue.fi}`;
      if (cue.fo && cue.dur) f += `,afade=t=out:st=${cue.dur - cue.fo}:d=${cue.fo}`;
      f += `,adelay=delays=${Math.round(cue.t * 1000)}:all=1[c${i}]`;
      filters.push(f); labels.push(`[c${i}]`);
    });
    filters.push(`${labels.join("")}amix=inputs=${labels.length}:normalize=0:duration=first,alimiter=limit=0.95[a]`);
    args.push("-filter_complex", filters.join(";"), "-map", "0:v", "-map", "[a]",
      "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest",
      "trailer/out/kingdom-marches-trailer.mp4");
    return args;
  }

  // resume: carry on from the frames the server already has (the encoder
  // keeps running server-side, so a crashed or reloaded tab loses nothing).
  async function renderMp4(opts = {}) {
    stop();
    renderBtn.disabled = playBtn.disabled = true;
    const N = Math.round(DURATION * FPS);
    let first = 0;
    if (opts.resume) first = Math.max(0, parseInt(await (await fetch("/capture/status")).text(), 10));
    if (!first) await fetch("/capture/start", { method: "POST", body: String(FPS) });
    const began = Date.now();
    for (let f = first; f < N; f++) {
      drawFrame(f / FPS);
      // toDataURL, not toBlob: in a background/hidden tab toBlob gets
      // deprioritised to ~1 s per frame, the synchronous path stays ~80 ms.
      const bin = atob(canvas.toDataURL("image/jpeg", 0.95).split(",")[1]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      for (let attempt = 0; ; attempt++) {
        try {
          const res = await fetch(`/capture/frame?i=${f}`, { method: "POST", body: bytes });
          if (res.ok) break;
          throw new Error(`frame ${f}: ${res.status} (server has ${await res.text()})`);
        } catch (e) {
          if (attempt >= 5) { status.textContent = `Render failed: ${e.message}`; renderBtn.disabled = playBtn.disabled = false; return; }
          await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        }
      }
      if (f % 10 === 0) {
        const eta = ((Date.now() - began) / (f - first + 1)) * (N - f) / 1000;
        status.textContent = `Rendering frame ${f + 1} / ${N}  (≈${Math.ceil(eta)} s left)`;
        scrub.value = f / FPS; timeEl.textContent = (f / FPS).toFixed(2);
      }
    }
    status.textContent = "Encoding and mixing audio…";
    const res = await fetch("/capture/finish", { method: "POST", body: ffmpegArgs().join("\n") });
    status.textContent = (await res.text()).replace(/^ok /, "Done: ");
    renderBtn.disabled = playBtn.disabled = false;
  }
  renderBtn.onclick = renderMp4;

  // ------------------------------------------------------------------ boot
  window.trailer = { drawFrame, renderMp4, ffmpegArgs, SHOTS, CUES, DURATION, FPS };
  (async () => {
    status.textContent = "Loading art and audio…";
    await Promise.all([loadImages(), document.fonts.load("700 40px Cinzel"), loadAudio()]);
    const q = new URLSearchParams(location.search);
    const t = q.has("t") ? parseFloat(q.get("t")) : 0;
    scrub.value = t; timeEl.textContent = t.toFixed(2);
    drawFrame(t);
    playBtn.textContent = "Play"; playBtn.disabled = false;
    status.textContent = "";
    try {
      const have = parseInt(await (await fetch("/capture/status")).text(), 10);
      renderBtn.disabled = false;
      if (have > 0) {
        renderBtn.textContent = `Resume render (${have} / ${Math.round(DURATION * FPS)})`;
        renderBtn.onclick = () => { renderBtn.textContent = "Render MP4"; renderBtn.onclick = renderMp4; renderMp4({ resume: true }); };
      }
    } catch (e) { /* plain static server: preview only */ }
    window.trailer.ready = true;
  })();
})();
