# Fantasy Civilizations — Art Style & Gemini Generation Guide

Reference doc for generating new game art with Gemini and dropping it straight
into `assets/`. Style and specs below are reverse-engineered from the assets
that already work in-engine (`assets/cities/orc_city_*.png`,
`assets/units/raider.png`, `assets/units/skeleton.png`, `assets/terrain/*.png`)
plus the loader contract in `js/ui/sprites.js` and `js/data/sprite-manifests.js`.

`assets/img/logo.png` and `assets/img/title-bg.png` are painterly splash-screen
placeholders in an unrelated style — out of scope for this guide.

---

## 1. Style definition

**Name:** Weathered Cel-Shaded Outline, elevated 3/4 view.

Thick, clean black outlines around the silhouette and major interior
linework; sharp details; cel-shaded flat colors with a limited palette —
hard-edged shadow/highlight blocks, not soft painterly gradients. This is
tested-successful phrasing for this project's Gemini generations (see
below) and takes priority over softer painterly shading: at the engine's
actual on-screen render sizes (tiles as small as ~14px, up to ~100px at
max zoom — see `render.js` `TILE_SIZE`/zoom range), soft gradients wash
out to mud while flat cel-shaded blocks stay legible. Think Clash
Royale/Dofus-style outlined cel-shade, not SNES-era painterly pixel art.

- **Outlines:** thick, clean, consistent-weight black outlines on every
  asset's outer silhouette and major internal edges (armor plates, weapon
  lines, roof edges). This is the single most load-bearing trait for
  legibility at small size — never omit it from a prompt.
- **Shading:** cel-shaded flat color fills, 2–3 tonal steps per surface
  (base, shadow, occasional highlight), hard edges between steps — no
  smooth/airbrushed gradients, no soft ambient occlusion blur.
- **Palette:** limited palette per asset, still pulled from a muted,
  desaturated, earthy family — olive greens, weathered browns, stone
  grays, faded ochres. No saturated cartoon colors. Dark-fantasy mood,
  not cute/whimsical.
- **Legibility & silhouette:** must read clearly at small size and when
  zoomed out. Confirmed by testing (Orc Raider sample vs. the existing
  `raider.png`, downscaled and compared at 128/102/34/14px): outlines and
  cel-shading alone aren't enough — the following three rules are what
  actually determine whether an asset survives downscale to the game's
  default ~34px render size:
  - **High contrast between adjacent regions.** Neighboring color areas
    (skin vs. armor vs. weapon vs. shield) need a real value/color jump,
    not two similar mid-tones touching — similar-tone edges are exactly
    what blur into mud first. A bright/light element (metal, bone, pale
    wood) against a dark body reads far longer than two muted mid-tones.
  - **Open, non-overlapping silhouette for key identifying shapes.** Hold
    weapons/shields/emblems out and away from the body rather than raised
    across or overlapping the head/torso — overlapping shapes merge into
    one blob at small size; separated shapes stay individually readable.
  - **Minimal ornamental detail.** Skip rivets, straps, small fabric
    folds, and other fine texture that's invisible past ~128px anyway —
    it only competes for pixels during downscale and muddies edges that
    should stay clean. Favor a small number of bold, simple shapes over
    surface texture.

  **Round 2 result confirms these rules work:** a second Orc Raider test
  applying all three (silver axe held out and down, shield held clear of
  the torso, straps/rivets stripped down to one or two) read clearly at
  34px where round 1 collapsed into a blob — on par with, arguably better
  than, the existing `raider.png` at the same size. Treat this as the
  validated default, not just a theory.
- **Lighting:** single consistent light direction (upper-left-ish) implied
  by the shadow/highlight color steps, not by soft rendered light.
- **Perspective:** elevated 3/4 "diorama" angle (~30–40° downward tilt),
  consistent across cities and terrain. Units are drawn in the same 3/4
  top-down angle, mostly facing the camera or slightly right.
- **Character proportions:** stubby/chibi, roughly 1:3 head-to-body ratio
  (see `raider.png`, `skeleton.png`) — reads clearly at small in-game scale.
  Confirmed by review: male variants have trended slightly larger-headed
  than their female counterpart on the same unit (most visible on
  Spearguard, marginal on Wizard/Archer) — when prompting a male/female
  pair, state the 1:3 ratio explicitly for both and note it should be the
  same ratio for both genders, not just "stubby/chibi" in general terms.
- **Materials over color:** race identity comes from architecture and
  materials (thatch vs. carved stone vs. bone vs. living wood), not from
  the race's UI accent color. See §4.
- **Edges:** clean silhouettes, no soft photographic blur, no anti-aliasing
  halos outside the subject — assets sit directly on tile art with no glow/
  drop-shadow baked in (the engine doesn't expect one).

---

## 2. Reference assets (ground truth — point Gemini at these when possible)

| File | What it demonstrates |
|---|---|
| `assets/cities/orc_city_4.png` | City diorama angle, lighting, weathering, banner-as-accent-color |
| `assets/units/raider.png` | Unit proportions, framing, edge treatment |
| `assets/units/skeleton.png` | 2-frame idle sheet layout, alternate race material (bone) |
| `assets/terrain/plains_1.png` | Terrain tile texture, subtlety of "3D" suggestion within a flat tile |

---

## 3. Technical spec by asset category

All assets are PNG, transparent background, no baked-in drop shadow.

| Category | Canvas size | Frames/layout | Filename pattern | Notes |
|---|---|---|---|---|
| Terrain tile | 64×64 per frame | 1 static frame, or 4-frame horizontal idle sheet (256×64 total, default — see §7) | `assets/terrain/{terrainId}_{n}.png` (n = 1–3 for random variants) | Content should fill the tile edge-to-edge so tiles abut seamlessly; subtle depth only, not a full isometric diorama |
| Unit sprite | 128×128 per frame | 1 static frame, or 4-frame horizontal idle sheet (512×128 total, default — see §7) | `assets/units/{unitId}.png` for race-locked units (e.g. `raider.png`, Orc-only); `assets/units/{raceId}_{unitId}.png` for the 3 universal units — Pioneer, Scout, Galley (e.g. `human_pioneer.png`) | Centered, ~10% padding on all sides within the frame. Universal-unit race art is optional per race — `pickUnit(unitId, raceId, seed)` in `js/ui/sprites.js` tries the race-qualified art first and falls back to a plain `{unitId}.png` (not currently shipped for these 3) if that race doesn't have custom art yet, so partial rollout across races never breaks rendering |
| City tier | 128×128 | Single static image | `assets/cities/{raceId}_city_{tier}.png` (tier 1–6) | Full isometric diorama, transparent around the silhouette (not a filled square, see reference); tier 1 = small camp/hamlet, tier 6 = large fortified city — scale up structure count, wall height, and fortification with tier |
| Building (individual) | 128×128 | Single static image | `assets/buildings/{buildingId}.png` (or `_1..._3` for variants) | Elevated diorama angle matching city tier art, single structure only; **not yet wired into the renderer** — `render.js` currently only draws the per-tier city diorama, no per-building sprite lookup exists yet, so this is a forward-looking spec |
| Wall segment | 128×128 | Single static image | `assets/buildings/wall_section.png` (or `_1..._3` for variants) | Universal across all races (not race-specific, per `buildings.js`); same forward-looking caveat as individual buildings above |
| Enhancement / resource icon | 64×64 per frame | 1 static frame, or 4-frame idle sheet (256×64, default — see §7) | `assets/enhancements/{enhancementId}_{n}.png` | Same treatment as terrain tiles — small overlay icon, not a full scene |
| Ruin | 64×64 | 1 static frame or idle sheet | `assets/enhancements/ruin_{n}.png` | Same as enhancement icons |

City/building/wall art all standardize on 128×128 (matching unit sprite
size) rather than the original 1024×1024 city renders — every asset is
downscaled to the same on-screen tile size at render time regardless of
source resolution (see `render.js`'s `ctx.drawImage(..., ts, ts)`), so the
extra resolution bought nothing but generation cost and file size.

An optional same-named `.json` next to any PNG can override
`frameWidth`/`frameHeight`/`layout`/`animations` if a generated asset doesn't
match the default grid — see the comment block at the top of `js/ui/sprites.js`.

### Gendered units: male and female as random variants, not a coin-flip per asset

Humanoid unit art should not default to depicting only male figures.
**Going forward, ship a male variant and a female variant for every new
humanoid unit**, using the existing `_1`/`_2`/`_3` variant mechanism
(`pick(key, seed)` in `js/ui/sprites.js` already picks randomly per unit
instance and remembers the choice for that instance's lifetime — no new
engine code needed). Same pose set, same equipment, same race materials
— generate the female variant through the identical 2x2 grid pipeline
(§7), just with the character description changed. Ships (Galley) and
any other non-humanoid subject are exempt.

This is **not retroactive** — Raider, Skeleton, Human Pioneer, and Human
Scout ship male-only and are not being redone. It applies starting with
whatever humanoid unit work comes next (e.g. the remaining 5 races for
Pioneer/Scout). Note the filename implication: adding a `_2` variant
means the existing single file must also become `_1` (see `loadVariants()`
in `js/ui/sprites.js` — it always tries `_1` through `_6` first and only
falls back to the bare `{id}.png` if *none* of those exist, so a lone
`_2.png` sitting next to an un-numbered file would silently orphan the
un-numbered one).

### Racial/skin-tone diversity: same mechanism, extra slots

For select humanoid Human and Halfellow units, a second skin-tone pair
extends the same `_1`/`_2` male/female pattern into `_3`/`_4` (deeper
skin tone, male/female) — `pick()` treats every numbered slot as one
flat, equally-weighted random pool (raised from a 3-slot to a 6-slot
cap in `loadVariants()` specifically to make room for this), so adding
`_3`/`_4` alongside an existing `_1`/`_2` pair keeps the gender split
even automatically as long as tone variants are always added in
matched male/female pairs — there's no separate gender or tone axis in
the code, just a convention to add slots two at a time. Same pose set,
same equipment, same race materials, same 2x2 grid pipeline (§7) — only
the character description's skin tone changes. Not retroactive to every
shipped unit; applied incrementally to common Human/Halfellow units:
first pass used "a deep brown skin tone" (Human Spearguard/Archer,
Halfellow Wanderer); second pass used "a warm golden-tan skin tone"
for an Asian-coded tone (Human Cavalry, Halfellow Pony Patrol). Units
still without a `_3`/`_4` pair: Human Knight, Paladin, Longbowman,
Wizard (Catapult/Trebuchet are vehicles, not humanoid figures, so skin
tone doesn't apply).

Halfellow Militia is a deliberate exception to this whole mechanism
(2026-07-15 redesign, user-directed): instead of a single character
with a skin-tone variant pair, each numbered slot (`militia_1/2/3`) is
now a small ANGRY MOB scene of 2-4 halfellows together in one image —
torches, pitchforks, rolling pins, a kitchen cleaver — with visibly
different skin tones baked into each individual group scene rather
than spread across separate variant files. `militia_4` (the old
single-character deep-brown-tone sheet) was pulled from rotation
entirely, since a lone-character sheet would look inconsistent mixed
into a group-scene rotation. This is the only unit in the game with
more than one figure per sprite; the "exactly ONE character" CRITICAL
clause used everywhere else becomes "exactly N figures, same N
individuals/weapons across all four panels" for this unit specifically
— see `tools/prompts/halfellow_militia_{1,2,3}_2x2.txt` for the
template if any other unit ever needs a group treatment.

Dwarf's full combat roster (FoeHammer, Troubadour, Musketeer) got both
male/female (`_1`/`_2`) AND a skin-tone pair from the start, since
these were brand-new units with no pre-existing single-tone baseline to
extend later — FoeHammer got "a deep brown skin tone," Troubadour and
Musketeer got "a warm golden-tan skin tone" (kept the two tones roughly
balanced game-wide: 5 units deep-brown, 4 golden-tan after this batch).
Runeforged Titan (Dwarf's rare pinnacle unit, like Orc's Dragon) is a
single-variant stone/rune construct, not a humanoid figure — no
male/female, no skin tone, same reasoning as Dragon/Battering Ram.
Dwarf's established race palette (from Pioneer/Scout): stone gray,
tan/brown leather, iron gray, faded ochre, with a muted tan/brown
(#9a7b56) accent — reused across all three new combat units.

Recurring pose-generation defect worth flagging for any future
"looking the other way" panel: without an explicit guard, Gemini
sometimes draws panel 3 as a full back-view turnaround instead of a
head/torso turn while staying frontal (caught on Troubadour male,
fixed via edit-mode regeneration of just that panel). Prompts now
include an explicit "CRITICAL: ... NEVER a full turnaround, chest must
always be clearly visible" clause for panel 3 to prevent this
proactively.

### Transparency is not optional — and Gemini won't give it to you directly

Gemini's image models don't reliably output clean alpha transparency. **Always
generate on a solid, saturated chroma-key background** (pure magenta
`#FF00FF` works well — it doesn't occur in the muted in-game palette) and key
it out to alpha transparency as a post-processing pass before the file goes
into `assets/`. Do not ask Gemini for "transparent background" and use the
result as-is — check it. **`tools/chroma-key.ps1` does this** — see §8.

### Gemini adds stray decorative elements — strip them, don't keep prompting against it

Confirmed by testing across two separate generations: a small sparkle/star
decoration showed up in the same bottom-right corner both times, despite an
explicit "do not include... sparkle/star decorations" instruction. Treat
this as a systematic quirk, not bad luck. `tools/chroma-key.ps1` runs a
connected-component pass after chroma-keying: it finds the largest
contiguous non-transparent blob (the actual subject) and clears any
smaller, disconnected blob elsewhere in the frame automatically (tunable
via `-MinComponentFraction`/`-MinComponentAbsolute`), rather than relying
on prompt wording to prevent them. Validated on both Orc Raider test
generations — zero magenta fringing, sparkle removed cleanly both times.

### Requested canvas size is not reliable either

Confirmed by testing: Gemini does not reliably respect an exact requested
output resolution (a 128×128 unit sprite request came back as 1024×1024).
Don't rely on prompt wording for final dimensions — **always resize to the
target spec (§3) as an explicit post-processing step**, regardless of what
size Gemini actually returns. `tools/chroma-key.ps1 -ResizeTo <n>` does the
resize in the same pass, after keying (never before — resizing a flat
magenta background first smears magenta into edge pixels over a much wider
band once alpha exists).

---

## 4. Race identity — materials, not color

Each race's UI color (`js/data/races.js`) is a **banner/flag/trim accent
only**. It should appear on cloth, painted markings, or small trim details —
never as the dominant hue of stone, wood, or skin. Base materials follow lore:

| Race | Accent (banners/trim only) | Architecture & materials |
|---|---|---|
| Human | `#8e44ad` (purple) | Dressed stone, tiled roofs, orderly fortified towns — think the white castle towers already visible in `title-bg.png` for tone reference |
| Elf | `#3f8f5c` (green) | Living wood, grown-together architecture, canopy integration, minimal stone |
| Dwarf | `#9a7b56` (tan/brown) | Carved mountain stone, deep halls, heavy masonry, forge motifs |
| Orc | `#7a2e2e` (dark red) | Green-skinned, weathered wood palisades, bone/skull trophies, tribal thatch — see `orc_city_4.png` as the baseline |
| Undead | `#5b5470` (purple-gray) | Bone, rotted timber, gray decayed stone, necrotic fog/mist accents |
| Halfellow | `#c9a857` (gold) | Cozy homestead thatch, warm wood, garden plots, small-scale domestic architecture |

### Elf units specifically — decided with the user before generating

- **Body type: tall and slender, NOT the stubby chibi ~1:3 ratio used
  for other races.** User correction after the first Elf Ranger attempt
  used the default ratio verbatim: elves should use a noticeably
  smaller head relative to body height, roughly **1:4.5 head-to-body**
  — an elongated, elegant build. State this explicitly for both gender
  variants together (same reason as the general rule below: male
  variants trend larger-headed if not made explicit, and this is the
  same failure mode, just needing a different target ratio for this
  race). Confirmed on Ranger (male + female); apply to all further Elf
  humanoid units (Blade Dancer, Druid, etc.).

### Halfellow units specifically — decided with the user before generating

- **Body type: literal small hobbits, not human-scaled.** Short and
  stocky, noticeably shorter than the Human/Orc units at the same
  camera distance and scale — large bare feet (no shoes), curly hair.
  Because they're shorter, leave visibly more empty padding above the
  head than the ~10% used for Human/Orc units, rather than filling the
  frame to the same height — the standard per-category framing block's
  padding assumes human-height figures and doesn't apply as-is here.
- **Weapon tone: improvised farm/kitchen tools, not proper soldier
  gear.** Reluctant citizen-defenders grabbing whatever's at hand
  (pitchforks, rolling pins, kitchen cleavers, slings, hatchets) —
  matches the race's low militarism (0.2) and its whimsical in-game
  attack icons (spoon, boomerang, knife) for the Wanderer unit. Militia
  (a later, stronger unit than Wanderer) can look slightly more
  organized/coordinated but should still read as homespun, not
  military-issue.
- **Pony Patrol's mount: a comically small pony**, not a proportionally
  -scaled cavalry mount — genuinely stout and small, rider's legs sit
  high, a playful scale contrast rather than a serious warhorse read.

---

## 5. Master Gemini prompt template

Gemini's image models respond better to a descriptive paragraph than a
keyword list — keep prose, not tags. Fill in the bracketed parts per asset.

```
Game asset: [UNIT/ASSET NAME] (race: [RACE], category: [terrain/unit/
city tier/building/wall/enhancement]).

A single game asset in a cel-shaded outline style: thick, clean black
outlines around the silhouette and major interior linework, sharp
details, cel-shaded flat colors with a limited palette (2-3 hard-edged
tonal steps per surface — base, shadow, occasional highlight — no soft
airbrushed gradients or blurry ambient occlusion). Clear legibility when
zoomed out to a small size. Muted, desaturated, earthy fantasy palette
(olive greens, weathered browns, stone grays, faded ochres) — no
saturated cartoon colors. Dark-fantasy mood, weathered and lived-in, not
cute or whimsical. Single consistent light direction from the upper left,
implied by the shadow/highlight color steps rather than rendered soft
light.

This asset must stay legible when shrunk down to a very small size, so:
use strong contrast between neighboring color regions (a bright/light
element against a dark one, not two similar mid-tones touching); hold
weapons, shields, or other identifying details out and away from the
body/silhouette rather than overlapping the head or torso, so key shapes
don't merge together; and keep ornamental detail minimal — favor a
small number of bold, simple shapes over fine texture like rivets,
straps, or fabric folds that won't survive downscaling anyway.

Subject: [DESCRIBE THE SPECIFIC SUBJECT — see filled examples below]

Framing: [FRAMING — see per-category guidance]

Background: a single flat, solid, saturated magenta (#FF00FF) background,
completely uniform, no gradient, no shadow cast onto it, no vignette —
this will be chroma-keyed out, so nothing in the subject itself should be
magenta or near-magenta.

Race material language (if applicable): [race materials from §4 — NOT the
race's accent color as a dominant hue; that color may only appear as a
small banner, trim, or cloth accent].

Do not include any text, watermark, logo, UI elements, or border in the
image.
```

The `Game asset: [name]` label is mainly for prompt traceability once we're
generating many of these, not a shortcut for the Subject description —
don't rely on the unit/building name alone to convey appearance. Naming an
archetype (e.g. "raider") can pull in genre-trope assumptions (cluttered
gear, extra trophies) that fight the legibility rules above; the explicit
Subject description is what should win.

### Per-category framing block

- **Terrain tile:** `Framing: top-down flattened tile view, square 1:1
  composition, content fills the frame edge-to-edge so it can tile
  seamlessly against identical neighboring tiles, only a subtle suggestion
  of height/depth — not a full isometric scene.`
- **Unit sprite:** `Framing: elevated 3/4 top-down "strategy game" view,
  single character centered with ~10% padding on all sides, stubby
  proportions at roughly 1:3 head-to-body ratio — the SAME ratio as the
  character's opposite-gender variant of this same unit, not a larger
  head — facing the camera or slightly to the right, full body visible
  head to feet.`
- **City tier:** `Framing: elevated isometric diorama angle (~30-40°
  downward tilt), the full settlement visible as a self-contained island
  silhouette (not a filled square background), square 1:1 composition.`
- **Enhancement/resource icon:** `Framing: top-down flattened icon view,
  square 1:1 composition, small overlay-scale detail, not a full scene.`

---

## 6. Filled examples

**Missing terrain — Ocean tile:**
> ...Subject: open ocean water, small rolling wave crests catching the
> light, a scattering of pixel-art foam highlights. Framing: top-down
> flattened tile view, square 1:1 composition, content fills the frame
> edge-to-edge so it can tile seamlessly against identical neighboring
> ocean tiles, only a subtle suggestion of height/depth...

**Missing unit — Human Cavalry:**
> ...Subject: a mounted human cavalry soldier in dressed-steel armor
> atop a warhorse, lance held upright, a small purple (#8e44ad) banner
> pennant on the lance as the only accent-color element, otherwise
> muted steel-gray and leather-brown. Framing: elevated 3/4 top-down
> "strategy game" view, single character (with mount) centered with
> ~10% padding on all sides, stubby proportions at roughly 1:3
> head-to-body ratio, facing slightly right, full body visible head to
> feet...

**Missing city — Human, tier 1:**
> ...Subject: a small fortified human hamlet, a handful of dressed-stone
> and timber buildings with tiled roofs around a central well, a low
> wooden perimeter fence, one small purple (#8e44ad) banner over the
> gate as the only accent-color element. Framing: elevated isometric
> diorama angle (~30-40° downward tilt), the full settlement visible as
> a self-contained island silhouette, square 1:1 composition...

**Missing enhancement — Iron deposit:**
> ...Subject: a small outcrop of raw iron ore veins jutting from gray
> rock, dark metallic glints catching the rim light. Framing: top-down
> flattened icon view, square 1:1 composition, small overlay-scale
> detail...

---

## 7. Animation frames — multi-call generation strategy

### Scope: idle only, for now

Confirmed by reading `render.js`: every sprite draw call in the entire
renderer — terrain, resources, ruins, units, all of it — requests the
`"idle"` animation explicitly. The only branch that isn't `"idle"` is city
tier selection (`tier1`...`tier6`), which is a population-tier lookup, not
an animation state. There is no code path that selects a `"walk"` or
`"attack"` frame, and no tile-to-tile movement tweening either — units
appear to jump directly between tiles on turn resolution, so a walk cycle
wouldn't even be visible if it existed. Combat already has its own
lightweight visual feedback independent of unit sprites (`updateCombatAnims`
— a glyph/slash overlay that grows and fades between attacker/defender
tiles), so "attacking" as a per-unit animation isn't just unbuilt, it's
arguably already covered more cheaply.

**Generate idle frames only** — mechanical units shifting parts, characters
glancing around, banners fluttering, that kind of subtle idle variation.
Walking/attacking/special-pose (wizard channeling, halfellow hiding, etc.)
frame sets are real art investment for animation states the engine has no
mechanism to select yet — don't generate them speculatively. If/when we
want them, it's an engine change first (named-animation selection in
`render.js` based on unit state, plus movement tweening for walking
specifically to have anything to animate into), and the art follows once
there's somewhere for it to render.

### Frame count: 4, default

Default idle sheets are **4 frames**, played back at the existing manifest
fps convention (1–2, see `js/data/sprite-manifests.js`) — a slow ambient
cycle, not fluid motion. Four keyframes buy enough range for a real loop
(e.g. a mechanical unit's part cycling through a full rotation, not just
an A/B toggle) while staying well short of anything that needs to look
smooth frame-to-frame. Existing 2-frame assets (`skeleton.png`, terrain)
remain valid as-is — the engine reads whatever `frames` array the manifest
declares — this is only the default for new generation going forward.

### Playback is hold/play/loop, not a rigid fps cycle

`currentFrame()` in `js/ui/sprites.js` does **not** just step through
`frames` on a fixed fps-locked timer anymore (that read as mechanical —
every instance of the same sprite animated in perfect lockstep). It's a
per-instance state machine, keyed on a stable `seed` object (the unit/
tile/city instance, same object passed to `pick()`):

1. **Hold** `frames[0]` for a few (jittered) seconds.
2. **Play** through the rest of `frames[]` at the manifest's fps.
3. **Hold** on the last frame reached for a few more (jittered) seconds.
4. **Loop back** to step 1.

Each cycle has a chance (`partialChance`, default 35%) of only playing up
to `frames[partialUpTo]` (default index 1, i.e. "frame 2") instead of all
the way to the end, before holding and looping back — so not every cycle
is the full sweep. Hold durations default to ~3s (first) / ~2s (last)
with ±40% jitter, and are overridable per-animation in a manifest via
`holdFirstMs`/`holdLastMs`/`partialChance`/`partialUpTo` if a specific
asset needs different pacing. Newly-seen instances are staggered to a
random point within their first hold so a batch spawned at once (e.g.
game start) doesn't animate in sync.

**Every `currentFrame()` call site must pass a seed** (see the call sites
in `render.js`) — without one it silently falls back to the old
wall-clock-synced modulo cycle, which is fine for one-off/preview
rendering but would resync every instance if used for real gameplay
rendering.

### Multi-call generation — validated default: the 2x2 grid, one shot

**Current default, proven across 5 assets (Orc Raider, Skeleton, Human
Pioneer/Scout/Galley): generate all 4 frames in ONE call as a 2x2 grid of
equal square panels, not as separate per-frame API calls.** This reverses
earlier guidance in this section (kept below in "superseded approach" for
the reasoning) — early testing showed edit-mode (feeding frame 1 back in
as a reference for each subsequent frame) barely moves the pose at all,
regardless of wording or temperature. The 2x2 grid sidesteps that
entirely: the model composes all 4 panels together with full simultaneous
context, so it isn't anchored to a fixed reference image it won't deviate
from.

Prompt structure (see `tools/prompts/*_sheet_2x2.txt` for full examples):

1. State up front this is a 2x2 grid, 4 equal square panels with a thin
   gap, all 4 must be the SAME character/subject — identity, style,
   colors, proportions, equipment, camera angle all locked; only pose
   changes.
2. **Guard against whole-character duplication explicitly, up front, in
   strong language** (e.g. "CRITICAL: there is exactly ONE character in
   this image, appearing exactly once per panel... never two, never a
   duplicate, twin, or mirrored copy standing side by side"). Confirmed
   failure mode on the Human Scout attempt: without this the model
   sometimes draws two copies of the character in a panel, especially
   for a "looking alert/wary" pose — costly to catch late, cheap to guard
   against up front. Regenerate immediately (no fix-up) if it happens
   anyway; don't try to salvage a panel with two figures in it.
3. Anatomical-correctness and same-hand/same-side reminders (§5 template
   already has these) still matter — without them, weapons/tools have
   drifted to the wrong hand or been held backwards on individual panels.
4. Describe panel 3 ("looking the other way") WITHOUT the word "mirror"
   or "flipped" — that wording alone was enough to make the model
   horizontally flip the whole character (swapping which hand holds what)
   even with an explicit same-hand constraint elsewhere in the prompt.
   Describe the opposite head/torso turn directly instead.
5. Moderate motion language ("a clear, obvious amount... immediately
   noticeable, not subtle... but a natural repositioning, not a dramatic
   wide swinging arc") is the calibrated middle ground — "dramatic/wide
   arc" language produced anatomically broken results (weapon swung
   behind the back, held backwards); pure "subtle" language produced
   near-zero motion, the same dead end edit-mode hit.
6. If a Retry happens (regenerating after a bad roll — duplication,
   near-zero motion, or otherwise), just re-run the identical prompt.
   Generation quality varies call to call; don't assume a bad result
   means the prompt needs changing until you've seen the same failure
   mode repeat across 2+ attempts (that's when it's a real prompt
   problem, e.g. the duplication case above).
7. A duplicated prop (extra weapon/tool) doesn't always need a full
   regenerate — `tools/erase-region.ps1` surgically removes a stray
   object via seeded, bounding-box-constrained flood fill, cheaper than
   another API call. Only safe when the duplicate is genuinely separable
   from the character: check first with a connected-component scan (see
   §8) — one component total means it's topologically fused to the body
   (regenerate instead, editing risks damaging real anatomy); the
   duplicate axe/staff cases that got removed cleanly this way weren't
   actually gripped by a second hand, just visually crossing near the
   body. A duplicate that's clearly a second full limb/arm (confirmed
   fused) is a regenerate, not an edit.

Pipeline after generation:

1. `tools/slice-grid.ps1 -InputPath sheet.png -Rows 2 -Cols 2 -OutputDir
   out` — cuts the 4 panels apart. Trims a small edge margin
   (`-EdgeTrim`, default 6px) since the model's grid divider line rarely
   lands exactly on the computed midpoint; without the trim, a sliver of
   the divider survives as a stray opaque line down one edge of two
   adjacent panels.
2. `tools/chroma-key.ps1 -InputPath out -ResizeTo 128` on the sliced
   panels (see §3 transparency section) — also strips any stray
   disconnected artifacts per panel.
3. `tools/order-frames.ps1 -FramePaths ... -OutputDir ordered` — finds
   the cyclic frame order that minimizes visual jump between consecutive
   frames (including the wrap-around from frame 4 back to frame 1, since
   that's how the engine actually plays these — see the note on
   `currentFrame()`'s hold/play/loop model below). Not always a no-op:
   on the Skeleton set it found a genuinely better order than the raw
   generation order.
4. `tools/compose-sheet.ps1 -FramePaths ... -OutputPath sheet.png` —
   **auto-recenters every frame's bounding-box center to frame 1's
   before compositing** (default behavior; `-NoAutoRecenter` to skip).
   Confirmed necessary in practice: the Human Pioneer set had an inherent
   ~11-16px translation drift baked into the source generation itself
   (present even before reordering) that read as a visible sideways
   jitter at the game's actual ~34px render size. Recentering fixes
   translation drift; it can't fix genuine scale differences (e.g. a
   raised weapon or a streaming flag legitimately extending the bounding
   box in one frame) — those still get flagged by the `-MaxShiftPx`
   check and need a visual judgment call, same as before.

### Superseded approach — edit-mode from a reference frame

Kept for the reasoning, not as current guidance: the original plan was
separate API calls per frame, each an image-to-image edit of frame 1
(fed back in as the reference), instructing "keep everything identical,
change only X." Confirmed **very sticky to the reference pose** — across
five separate levers on the Orc Raider test (stronger wording, generation
temperature up to 2.0, the Pro-tier model, explicitly loosening the
"keep identical" framing), average per-pixel delta from frame 1 stayed
in the same ~8-12 (out of 0-765) near-static range regardless. Identity/
scale/palette lock-in was essentially perfect, but so was pose
preservation — the opposite problem from what the 2x2 grid approach
above solves. Independent per-frame generation with no reference image
was tried as the other extreme and produced real motion but ~162 average
delta of inconsistency (different body proportions, weapon angle, scale)
— also not usable as-is. The 2x2 grid supersedes both: it gets the
motion of independent generation with close to the consistency of
edit-mode, because the model has all 4 panels in view together instead
of being anchored to one fixed reference it won't deviate from.

---

## 9. Terrain art plan — full replacement pass, decided with the user

This section documents a full terrain-art overhaul (all 9 terrain types),
decided with the user before generating. It supersedes any earlier
per-tile prompts and refines §3/§5's general terrain framing with
terrain-specific rules.

### Tileability and cross-terrain melding are two different problems

The renderer (`render.js`) draws each tile as an independent square, edge
to edge, with **no neighbor-aware blending or autotiling** — there is no
code that inspects a tile's neighbors and picks a transition graphic.
That means:

- **Same-terrain tiling** (e.g. two `plains` tiles side by side) must be
  genuinely seamless — content fills the frame edge-to-edge with no
  border/vignette/frame-relative lighting that would create a visible
  repeat seam when identical or same-type-variant tiles sit adjacent.
  This is fully achievable through art alone and must be verified by
  eye (tile a few variants in a small grid and look for seams) before
  shipping.
- **Cross-terrain melding** (e.g. plains next to hills) can only be
  approximated through palette harmony — designing each terrain's
  colors to sit close in hue/value to its natural neighbor's colors —
  since there's no transition-tile rendering mechanism. This softens
  the visual jump at a boundary; it does not remove the hard tile edge.
  True seamless cross-terrain blending would require new engine work
  (directional edge-transition sprites + render logic to select them
  based on actual neighbors) — out of scope for this pass, art-only.

### Palette chain (art-only harmonization)

Ocean → Coast → Plains → Hills → Mountains form one deliberate
progression from saturated blue through teal, green, olive, to cool
gray — each adjacent pair shares enough hue/value kinship that the
tile-to-tile jump reads as a gradient, not a clash. Forest branches off
Plains (a richer, darker version of the same green family, not an
unrelated hue). Swamp branches off Plains/Forest (the same green family
pushed toward murky/desaturated brown-green). Desert (warm sandy tan)
and Tundra (pale cold gray-blue) are exempt from the chain per the
user — they can neighbor anything without a color relationship
requirement, since they're meant to read as a distinct biome break.

| Terrain | Target palette | Blends toward |
|---|---|---|
| Ocean | deep saturated blue | Coast |
| Coast | lighter teal-blue, hint of sandy edge tone | Ocean, Plains |
| Plains | mid grass green | Coast, Hills, Forest |
| Hills | olive/tan-green (transitional) | Plains, Mountains |
| Mountains | cool simple gray rock | Hills |
| Forest | deeper, richer saturated green | Plains |
| Swamp | murky desaturated green-brown | Plains, Forest |
| Desert | warm sandy tan (exempt from chain) | — |
| Tundra | pale cold gray-blue (exempt from chain) | — |

### Landform shading — soft and muted, not the crisp unit-style outline

Decided with the user after seeing the first hills attempts: a hard
black cel-shading outline around a terrain landform shape (e.g. a hill
mound) reads as an OBJECT sitting on top of the ground — a rock, a
ball — not as the ground itself rising. Units and other foreground
objects should keep the bold black cel-shaded outline treatment from
§1; terrain landform shapes must do close to the opposite, so terrain
recedes and units pop:

- **The base/bottom of a landform shape blends seamlessly into the
  surrounding flat fill color** — no hard edge, no outline, a soft
  gradient fade. It should look like the land is quietly rising out of
  the ground, not an object placed on top of it.
- **Only the top ridge/crest of a raised landform gets an outline**,
  and that outline is a **muted dark shade of the same hue family**
  (e.g. a dark desaturated olive-brown for hills), never black — just
  enough to separate the silhouette from the sky/distance beyond it.
- **Small foreground marks are the one exception**: grass tufts, scrub,
  and similarly tiny detail marks scattered on top of the terrain keep
  their normal thin black outline (matching the plains convention) —
  the muted/no-outline rule is specifically about the land SHAPE
  itself, not every mark drawn on it.
- Shade the landform with a soft gradient (a gentle highlight on the
  lit side, fading toward the base), not hard 2-3-step cel-shaded
  blocks — this is a deliberate exception to §1's general hard-edge
  cel-shading rule, scoped to terrain landform shapes only.

### Elevated 3/4 view for terrain with real topography

Also decided with the user: terrain that represents actual raised or
lowered ground (hills, mountains, and similarly undulating types) uses
the same **elevated 3/4 "strategy game" view as units/cities** (~30-40°
downward tilt), not the flat orthographic top-down view — a hill drawn
from directly overhead reads as a flat coin/pancake shape, not a rise
in the land. This supersedes the flat-top-down default for this
specific case.

Flat terrain with no real topography (plains, tundra, open desert,
water) keeps the flat orthographic top-down framing from §5 — there is
no elevation to suggest, and the flat view is what makes edge-to-edge
seamless tiling straightforward for those types.

### Simplicity — stricter than the general unit/city rules

Terrain sits *behind* units and other tile overlays (resources, roads,
rivers, city markers) and repeats across dozens of tiles on screen at
once — any single tile's detail matters far less than the whole map
reading cleanly. Confirmed by the user's own test: a "complex mountain
graphic with snowcapped peaks and several mountains" read as blurry
in-game despite following the general style guide. Going forward for
terrain specifically:

- **One or two bold, simple shapes per tile, max.** A single rock mass
  for mountains, not a mountain range with peaks and snowcaps. A
  handful of grass-tuft or dune-ripple marks, not a detailed field.
- **No fine linework or texture that only reads at full generation
  resolution.** If it wouldn't survive downscale to ~34px (the game's
  default render size, per §8 point 5), don't draw it.
- **Flat, top-down, no diorama elevation** — terrain uses the flat
  top-down framing from §5's per-category block, not the 3/4 elevated
  angle used for units/cities.

### Animation and variant plan per terrain

| Terrain | Variants | Frames | Notes |
|---|---|---|---|
| Plains | 3 | 2 (idle sway) | matches existing convention |
| Forest | 3 | 2 (idle sway) | subtle canopy shift |
| Hills | 3 | 2 (idle sway) | subtle, matches Plains |
| Swamp | 3 | 2 (idle sway) | subtle mist/bubble |
| Mountains | 3 | 1 (static) | rock doesn't naturally animate; stillness reads cleaner than forced motion |
| Desert | 3 | 1 (static) | dunes don't naturally animate |
| Tundra | 3 | 1 (static) | same reasoning |
| Coast | 2 | 2 (gentle shimmer) | calmer than Ocean; fewer variants so open water reads uniform, not chaotic |
| Ocean | 2 | 4 (full wave cycle) | generated via the same 2x2-grid multi-frame pipeline as units (§7); the one terrain type that gets real, prominent motion per the user's request |

2-frame idle sheets use the existing `terrain/*` manifest convention
(horizontal layout, fps 2, `frames: [0, 1]`) already in
`js/data/sprite-manifests.js`. The 4-frame Ocean sheet needs its own
manifest entry (or per-file `.json`) since no default terrain manifest
currently declares 4 frames.

### Resize step must use `-SeamlessEdges` for terrain, never for units

`tools/chroma-key.ps1 -ResizeTo` uses GDI+'s HighQualityBicubic, which
samples slightly *outside* the source rect near every edge. For unit
sprites this is harmless (§8's `-BorderClearPx` default clears the
resulting sliver to transparent, invisible inside the sprite's normal
padding). For terrain it's a real bug: terrain tiles are edge-to-edge
opaque fill with zero padding by design, so that same sliver becomes a
faint but genuinely visible seam once identical tiles repeat across a
map — confirmed via `tools/tile-preview.ps1` on the tundra and desert
sets (tundra's pale flat color made it obvious; desert's busier ripple
pattern had the same seam, just harder to spot).

Fix, part 1 (generation-time, for new terrain going forward): pass
`-SeamlessEdges` (added to chroma-key.ps1) alongside `-BorderClearPx 0`
for every terrain chroma-key call. It sets the resize's wrap mode to
mirror-tile (`WrapMode.TileFlipXY`) so bicubic sampling past the source
edge pulls from the tile's own mirrored content instead of an
inconsistent edge blend — the standard fix for resizing seamless
textures. Used for tundra, and for ocean/coast's edit-mode animation
frames.

Fix, part 2 (post-process, for already-installed art): `-SeamlessEdges`
only prevents *new* resize artifacts — it can't fix a tile whose source
content already touches the edge asymmetrically (confirmed on hills_3,
where a hill's shadow reached the right edge but not the left, and on
both ocean variants, where the wave-crest band crossing the corner
didn't line up run-to-run). `tools/make-seamless.ps1` fixes this
directly on the final installed PNG, no regeneration or draft-version
guessing required: it force-blends each edge's outer few pixels with
its wrapped opposite edge (feathered, default 6px), so col-0 matches
col-(width-1) and row-0 matches row-(height-1) exactly. Applied to
every installed terrain tile (plains, hills, mountains, forest, swamp,
desert, tundra, coast, ocean) — confirmed via a direct pixel diff at
each wrapped edge that every tile now measures 0 (down from as high as
97 on hills_3 and 436 on ocean_1). Run it again on any future terrain
art after chroma-keying:
`.\tools\make-seamless.ps1 -InputPath assets\terrain\X.png -OutputPath assets\terrain\X.png -FrameWidth 64`.

Note: `tools/tile-preview.ps1`'s 4x4 same-tile mosaic still shows a
faint grid at the seam even on tiles verified at 0 pixel diff — this is
a perceptual/Moiré effect inherent to zooming into any tightly repeated
small tile, not a data defect, and isn't fixable by further pixel
correction. It's far less noticeable at the game's actual render size
(~34px) surrounded by mixed adjacent terrain rather than a same-tile
mosaic.

---

## 10. Road and river overlays — procedural, not Gemini (2026-07-16)

These are the one asset category NOT generated by Gemini at all — the
combinatorics don't fit that pipeline. A road can connect to any of a
tile's 8 neighbors (256 combinations); pre-baking one image per
combination doesn't scale, and Gemini can't hit the pixel-exact center/
edge/corner anchoring the layering trick below depends on. Instead:
`tools/make-road-stubs.ps1` and `tools/make-river-stubs.ps1` draw a
handful of small stub PNGs programmatically (System.Drawing, not the
API), and `js/ui/render.js`'s `drawRoadOverlay`/`drawRiverOverlay`
layer+rotate them at draw time to build any connection pattern live.

**The stub set, per user design (roads) and the same technique adapted
for rivers:**
- `*_cardinal` — one stub from tile CENTER to an EDGE midpoint,
  authored pointing EAST, rotated 0/90/180/270 for N/E/S/W.
- `road_diagonal` — center to a CORNER, authored NE, rotated for the
  other 3 corners. Rivers have no diagonal variant: worldgen
  (`generateRivers`) only ever flags cardinal edges.
- `*_hub` — a small patch at tile center. Always drawn: blends
  wherever stub(s) meet, and stands alone for a road with zero
  connections ("road to nowhere") or a river tile with just one edge
  (reads as a spring/pool).

**Three hard constraints on the stub art itself, all from direct user
correction after the first pass:**
1. **No rim/border.** A dark outline around the tan/blue fill (the
   initial attempt had one, matching the unit-sprite convention) shows
   as a hard seam wherever two stubs overlap or two tiles' pieces meet
   — the opposite of what terrain art does, but required here since
   pieces stack, terrain tiles don't. Single flat fill color only.
2. **Not perfectly straight.** A geometric bar/line reads as fake.
   Each stub is a hand-built wavy polygon band (`Draw-Band` in the
   scripts) with sinusoidal wobble on the centerline and both edges,
   plus a few subtle darker/lighter texture dabs clipped to the band.
   The wobble **tapers to zero at the center and at the edge/corner
   crossing** (see `Get-Taper`) so adjacent tiles' pieces still line
   up exactly — the roughness lives only in the middle stretch.
3. **Stubs overlap slightly at center**, starting a few px past center
   rather than exactly at it (`$overshoot`), so opposite-direction
   stubs merge into each other instead of just touching — a flat butt
   join between two rimless fills still leaves a faint seam even
   without a border.

**Paint order: river UNDER road.** Both overlays draw right after
terrain, river first then road, in both the live tile loop and
`drawRememberedTile` — a road crossing a river should read as a
bridge/ford over it, not have the river erase the road.

**River color must match coast, not be an arbitrary blue.** Rivers
flow into coast/ocean tiles at their mouth; if the river's blue and
the coast tile's blue don't match, the river looks like it's made of a
different substance right where they should blend into one body of
water. `river_cardinal`/`river_hub`'s fill is sampled directly from
the currently-installed `assets/terrain/coast_1.png` base pixel
(`#2c7694` as of this writing) rather than hand-picked — re-sample and
regenerate if coast's palette ever shifts again (see §9's
recolor-shift.ps1 history — it already moved once).

**Rivers never render on water tiles.** `generateRivers` walks
downhill from a source and stamps `hasRiver[edge]` on both the current
tile and the neighbor it's flowing into, every step, with no terrain
check — so the coast/ocean tile a river empties into used to get a
river edge stamped on it too, which is pure clutter on an already-blue
tile. Fixed at the data layer (not just a render-side skip): the step
that stamps the *incoming* neighbor's edge now checks
`!TERRAIN[...].isWater` first. The outgoing land tile's own edge is
still stamped unconditionally, so the river still visually runs right
up to the coastline — it just doesn't paint anything on the water
tile itself. Verified on a fresh map: 183 river-flagged tiles, 0 of
them water.

**Verification note:** the `computer`/screenshot tool was unreliable
this session (timed out repeatedly, unrelated to any code change here
— retried across fresh tabs and reloads with the same result). Fell
back to `canvas.toDataURL()` cropped small + hand-transcribed base64
once (worked but is fragile and not worth repeating), then switched to
direct pixel sampling via `ctx.getImageData()` at computed tile-center
screen coordinates — fully textual, no screenshot dependency. Two real
gotchas hit along the way, worth knowing before doing this again:
- `viewState.fogMode`/`fogCivIds` (the spectator fog-override controls)
  are only consulted when `viewState.humanCivId` is falsy — a normal
  single-player game has `humanCivId` set, so real fog-of-war
  (`gameState.visibility[humanCivId]`) applies regardless of
  `fogMode`. Set `vs.humanCivId = null` to force the spectator path
  if you need to inspect arbitrary unexplored tiles.
- `render()` mutates `viewState.scrollX/scrollY` in place (clamps them
  to map bounds) — read them back *after* calling render, not the
  values you set going in, when computing screen coordinates for a
  manual pixel sample.

---

## 11. Workflow checklist

1. Fill the template for the specific asset (§5/§6), save it to
   `tools/prompts/<name>.txt`.
2. Generate with `tools/gemini-generate.ps1 -PromptFile tools\prompts\
   <name>.txt -OutputPath <working file>` (add `-ReferenceImage <frame1>`
   for edit-mode animation frames per §7) — single call for static assets,
   or the multi-call frame strategy from §7 for animated ones. Expect the
   output resolution to ignore whatever was requested. Requires
   `GEMINI_API_KEY` set as a User-scope environment variable and a
   billing-enabled project (the free tier has zero image-generation
   quota). Occasional `IMAGE_RECITATION` finish reasons are a known
   transient quirk — just retry.
3. Run `tools/chroma-key.ps1 -InputPath <file or folder> -ResizeTo <size
   from §3>` — keys out the magenta to real alpha, strips stray
   disconnected artifacts (e.g. the sparkle decoration), and resizes to
   spec, all in one pass. Output lands in a `keyed/` subfolder next to
   the input by default.
4. Check edges for magenta fringing/bleed before saving (spot-check by
   compositing over a saturated non-magenta color, not just eyeballing
   on a light UI background where a faint fringe can hide).
5. **Legibility-at-scale check:** downscale the resized asset to the
   engine's actual render sizes (~34px default zoom, ~14px min zoom, up
   to ~100px max zoom — see `render.js` `TILE_SIZE`/zoom range) and look
   at it. If key identifying shapes (weapon, emblem, silhouette) have
   collapsed into a blob at ~34px, fix it at the prompt level (§1
   legibility rules) and regenerate rather than shipping it — don't
   discover this after it's already in `assets/`.
6. For animated assets, run the alignment check from §7 before compositing.
7. **If a panel has a duplicated prop** (see §7 point 7): run a
   connected-component scan on the keyed frame first. One component
   total → fused to the body, regenerate. More than one, or a scan
   confirms the duplicate doesn't touch the real character → try
   `tools/erase-region.ps1` (seed a point clearly on the stray object,
   bound the flood fill to a box that can't reach anything you want to
   keep), inspect the result zoomed over a contrasting background before
   committing it, then re-run compose-sheet.
8. Save to the correct path/filename from §3.
9. If it's a variant (`_1`/`_2`/`_3`) or non-default frame size, verify
   against `js/ui/sprites.js` loader expectations; add a sibling `.json`
   manifest only if the frame grid differs from the category default.
