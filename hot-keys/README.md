# HotKeyS

A Guitar Hero-style rhythm game played entirely with a standard keyboard. Alphanumeric keys are the instrument — notes fall down a perspective highway and must be pressed at the right moment to score points. All modes generate a continuous, beat-locked stream of random keys; the differences between modes are which extra inputs are required.

---

## Modes

| Mode | Description |
|------|-------------|
| **Straight Keys** | Random alphanumeric keys, no modifiers. Notes fall at their physical QWERTY position on the highway. |
| **Shifty Keys** | Same as Straight, but a fraction of notes (per difficulty) require Shift held simultaneously. Shift notes glow orange; plain notes glow green. |
| **Spacey Keys** | Same as Straight, but the Space bar must be pressed on the offbeat between every letter note. Space notes appear as a wide purple bar spanning the full highway width. |

---

## Difficulty

Four presets control the **note interval** (how often a note appears) and, in Shifty mode, the probability of a Shift note:

| Difficulty | Interval | Grid | Shifty shift% |
|------------|----------|------|---------------|
| Easy | Whole note | Every 4 beats | 25% |
| Medium | Half note | Every 2 beats | 35% |
| Hard | Quarter note | Every beat | 40% |
| Expert | Eighth note | Every half-beat | 45% |

At 120 BPM: whole = 2000 ms, half = 1000 ms, quarter = 500 ms, eighth = 250 ms.

Hit windows are **uniform across all difficulties**:

```javascript
function hitWindows() {
  const beatMs = 60000 / bpm;
  return {
    perfect: clamp(beatMs * 0.11,  16,  95),
    good:    clamp(beatMs * 0.22,  32, 160),
    ok:      clamp(beatMs * 0.36,  55, 240),
  };
}
```

---

## Note Generation

All three modes share a single generator. Notes form a continuous stream — no warmup silence, no rests:

```javascript
function getStepMs() {
  const step16 = (60000 / bpm) / 4;  // one 16th-note in ms
  switch (difficulty) {
    case 'easy':   return step16 * 16; // whole note
    case 'medium': return step16 * 8;  // half note
    case 'hard':   return step16 * 4;  // quarter note
    case 'expert': return step16 * 2;  // eighth note
  }
}

function generateNotes() {
  const beatMs        = 60000 / bpm;
  const stepMs        = getStepMs();
  const rawLeadIn     = Math.max(2200, TRAVEL_MS * 1.05);
  // Snap to a whole-beat boundary so the stream locks to the song's grid
  const snappedLeadIn = Math.ceil(rawLeadIn / beatMs) * beatMs;
  const offbeatShift  = offbeat ? beatMs / 2 : 0;

  streamAnchorMs = snappedLeadIn + offbeatShift;
  let t = streamAnchorMs;

  while (t < songDuration - 2000) {
    const char       = pickChar();   // random a-z or 0-9
    const needsShift = mode === 'shifty' && Math.random() < shiftPct;
    result.push({ char, hitTime: t, needsShift, ... });

    if (mode === 'spacey') {
      // Space note halfway between this and the next letter note
      result.push({ char: ' ', hitTime: t + stepMs / 2, ... });
    }

    t += stepMs;
  }
}
```

`streamAnchorMs` is stored globally and used by the beat indicator to stay phase-locked to the notes.

---

## Note Placement — Perspective Highway

All modes use a single-lane **perspective trapezoid** highway that is narrower at the top (vanishing point) and wider at the bottom hit zone:

```
FL_TOP    = 70     y coordinate of vanishing point
FL_HIT_Y  = 480    y coordinate of hit zone
FL_TOP_W  = 120    highway width at top
FL_BOT_W  = 380    highway width at hit zone
CW        = 900    canvas logical width
CH        = 800    canvas logical height
```

At any Y, the highway bounds are:

```javascript
function flatHBounds(y) {
  const t  = (y - FL_TOP) / (FL_HIT_Y - FL_TOP);
  const w  = FL_TOP_W + (FL_BOT_W - FL_TOP_W) * t;
  const sx = (CW - w) / 2;
  return { sx, w };
}
```

Each note's horizontal position is derived from its physical QWERTY key position — normalized 0–1 across the keyboard width. This means `q` falls near the left edge and `p` near the right, matching what the player sees on their actual keyboard:

```javascript
const KEY_POS = {
  '1':0.048, '2':0.143, '3':0.238, '4':0.333, '5':0.429,
  '6':0.524, '7':0.619, '8':0.714, '9':0.810, '0':0.905,
  'q':0.095, 'w':0.190, 'e':0.286, 'r':0.381, 't':0.476,
  'y':0.548, 'u':0.619, 'i':0.690, 'o':0.762, 'p':0.952,
  'a':0.119, 's':0.214, 'd':0.310, 'f':0.405, 'g':0.500,
  'h':0.571, 'j':0.643, 'k':0.714, 'l':0.881,
  'z':0.167, 'x':0.262, 'c':0.357, 'v':0.452, 'b':0.524,
  'n':0.619, 'm':0.738,
};

function flatNoteX(char, y) {
  const { sx, w } = flatHBounds(y);
  return sx + (KEY_POS[char] ?? 0.5) * w;
}
```

Space notes (`char === ' '`) are not positioned by `KEY_POS` — they are drawn as a full-width bar spanning the entire highway width at their Y position.

### Note Travel

All notes travel at constant speed regardless of difficulty:

```
TRAVEL_MS = 2400 ms
```

Y position at render time:

```javascript
const sy = FL_HIT_Y - ((note.hitTime - nowMs) / TRAVEL_MS) * (FL_HIT_Y - FL_TOP);
```

`nowMs` is always `audioEl.currentTime * 1000 + audioOffset` — never wall-clock — so notes stay locked to the audio even across tab switches or system jitter.

---

## Note Rendering

Notes are perspective-scaled: both width and height grow as they approach the hit zone.

```javascript
const depth = clamp((sy - FL_TOP) / (FL_HIT_Y - FL_TOP), 0, 1);
const nW = 16 + depth * 24;  // 16px at top → 40px at bottom
const nH = 12 + depth * 28;  // 12px at top → 40px at bottom
```

Color: Shifty notes that require Shift are `#ffaa44` (orange); all others are `#55ff99` (green). Space notes are `#cc88ff` (purple) and are always drawn as a full-width bar.

Each note has a rounded-rect body with a vertical gradient (lighter top, darker bottom) and a highlight stripe near the top. The key letter is rendered centered in the note in a bold monospace font, scaling with `depth`.

---

## Beat Indicator

A pulsing circle sits to the left of the hit zone (`x ≈ 210, y = FL_HIT_Y`). It fires in phase with the note stream:

```javascript
const phase = ((nowMs - streamAnchorMs) % stepMs + stepMs) % stepMs;
const pulse = clamp(1 - phase / (stepMs * 0.3), 0, 1);
// pulse = 1 at the beat moment, decays to 0 over 30% of the interval
```

The circle expands (base radius 14px → +9px at peak) and brightens with an outer radial glow. Color matches the active difficulty color. Useful for BPM calibration: if notes drift from the song, the BPM is wrong.

**BPM calibration tip:** If notes arrive ahead of the song, BPM is set too high; if they fall behind, too low. Adjust until the stream tracks the song consistently from start to finish.

---

## Keyboard Visualization

A miniature QWERTY keyboard (`rows: 1234567890 / qwertyuiop / asdfghjkl / zxcvm`) is rendered in the upper-left quadrant of the screen, left of the highway. Key size: 26×18 px with 3 px gaps. Left-pinned at x=12, bottom anchored at 62% down the highway height.

Keys glow as their corresponding note approaches the hit zone:

```javascript
glow = Math.sqrt(clamp(1 - timeUntilHit / TRAVEL_MS, 0, 1))
```

The sqrt curve means the glow ramps slowly when the note is far away, then accelerates as it reaches the hit zone.

When a key is physically pressed, it flashes bright green (`#55ff99`) for 180 ms, regardless of timing accuracy.

In Spacey Keys mode, a space bar is rendered below the four letter rows — a wide key (~5 key-widths) centered under the keyboard. It glows purple when a space note is approaching and flashes green when Space is pressed.

---

## Scoring

| Grade | Timing | Base Points |
|-------|--------|-------------|
| Perfect | Within perfect window | 100 |
| Good | Within good window | 75 |
| OK | Within OK window | 50 |
| Miss | Outside OK window | 0, combo reset |

Combo multiplier:

| Streak | Multiplier |
|--------|------------|
| 0–2 | ×1 |
| 3–5 | ×2 |
| 6–11 | ×3 |
| 12+ | ×4 |

High scores are persisted in `localStorage` keyed by `hs:{songTitle}:{mode}:{difficulty}`.

---

## Audio Sync

All timing uses `audioEl.currentTime * 1000 + audioOffset`. A calibration tool plays a Web Audio API click track at known BPM intervals and collects 8 tap timings, computing:

```
audioOffset = -(median of (tapTime − nearestBeatTime))
```

A positive `audioOffset` shifts the effective "now" forward, compensating for a user who taps consistently late. Manual offset trim is also available (±150 ms slider).

---

## Configuration

| Setting | Effect |
|---------|--------|
| **BPM** | Sets the beat grid. All note timing and hit windows scale with it. |
| **Difficulty** | Easy / Medium / Hard / Expert — controls note interval and Shifty shift probability. |
| **Number Keys %** | Fraction of notes drawn from `0–9` vs `a–z`. Default 5%. |
| **Offbeat** | Shifts the note grid by half a beat (notes land on eighth-note offbeats). Beat indicator phase shifts to match. |
| **Audio Offset** | Manual timing trim for when calibration isn't needed. |

---

## Regeneration Prompt

> The following is a self-contained prompt for a fresh Claude Code session to recreate this game from scratch.

---

Build a single-file browser rhythm game called **HotKeyS** (`keyhero.html`). No build tools, no dependencies — everything in one HTML file with inline CSS and JavaScript.

### Core concept

Guitar Hero-style, but the instrument is a QWERTY keyboard. The player loads a local audio file, enters the song BPM, and a continuous stream of random letter/number notes falls down a perspective highway. The player presses the correct key as each note crosses a hit zone near the bottom of the screen. All timing is locked to `audioEl.currentTime`, never `performance.now()`.

### Canvas setup

- Logical canvas size: `CW = 900`, `CH = 800`
- Support HiDPI: size the canvas backing store at `CW * devicePixelRatio * canvasScale`, where `canvasScale` is computed on resize to fit the window while preserving aspect ratio
- Apply the DPR+scale transform each frame with `ctx.setTransform(px, 0, 0, px, 0, 0)` where `px = canvasScale * devicePixelRatio`
- Dark background `#07070f` with a subtle scanline overlay (horizontal lines every 4px at 2.2% opacity)

### Highway geometry (flat / single-lane)

All three game modes use a single perspective trapezoid highway:

```
FL_TOP    = 70     vanishing point Y
FL_HIT_Y  = 480    hit zone Y
FL_TOP_W  = 120    highway width at vanishing point
FL_BOT_W  = 380    highway width at hit zone
```

`flatHBounds(y)` linearly interpolates width and centers it in `CW`. Note X position maps to physical QWERTY layout via normalized 0–1 positions in `KEY_POS` — `'q'` ≈ 0.095, `'a'` ≈ 0.119, `'z'` ≈ 0.167, `'p'` ≈ 0.952, spacing reflects stagger. The highway background is drawn as a perspective grid: converging vertical lane lines plus horizontal "road mark" lines that are denser near the vanishing point. A glow underlights the hit zone line.

### Note travel

```
TRAVEL_MS = 2400
```

A note's Y at render time: `FL_HIT_Y - ((note.hitTime - nowMs) / TRAVEL_MS) * (FL_HIT_Y - FL_TOP)`. Notes are perspective-scaled: width 16→40px, height 12→40px, radius 2→9px as `depth = (sy - FL_TOP) / (FL_HIT_Y - FL_TOP)` goes 0→1. Each note is a rounded rect with a vertical gradient (light top, dark bottom), a thin highlight stripe, and the uppercase key letter centered in a bold monospace font scaled with depth. Shift-required notes (Shifty mode) are orange `#ffaa44`; regular notes are green `#55ff99`; space bar notes (Spacey mode) are purple `#cc88ff` and drawn as a full-width bar spanning the entire highway rather than a positioned bubble.

### Note generation

All modes use one generator — a continuous stream, beat-snapped to a clean quarter-note boundary:

```javascript
const beatMs        = 60000 / bpm;
const stepMs        = getStepMs();          // see difficulty table
const rawLeadIn     = Math.max(2200, TRAVEL_MS * 1.05);
const snappedLeadIn = Math.ceil(rawLeadIn / beatMs) * beatMs;
const offbeatShift  = offbeat ? beatMs / 2 : 0;
streamAnchorMs      = snappedLeadIn + offbeatShift;
let t = streamAnchorMs;

while (t < songDuration - 2000) {
  emit letter note at t;
  if (mode === 'spacey') emit space note at t + stepMs/2;
  t += stepMs;
}
```

Step sizes by difficulty: Easy = `step16 * 16` (whole), Medium = `step16 * 8` (half), Hard = `step16 * 4` (quarter), Expert = `step16 * 2` (eighth), where `step16 = beatMs / 4`.

Random chars are drawn uniformly from `a–z` (95% by default) or `0–9` (5%), configurable via Number Keys %.

### Modes

**Straight Keys** — No modifiers. Press the shown key. Ignore any press with Shift/Ctrl/Alt held.

**Shifty Keys** — A per-difficulty fraction of notes have `needsShift = true`. Those notes are orange. In the keydown handler, resolve Shift+number keys back to their base digit (e.g. `!` → `1`). Call `processHitFlat(key, e.shiftKey)`.

**Spacey Keys** — Same as Straight, but between every letter note is a space bar note at `t + stepMs/2`. Space notes have `char = ' '` and match only when Space is pressed. Handle space before the `a-z0-9` filter in the keydown listener. Space notes render as a full-width purple bar; the key label shown is `␣`.

### Hit detection

`processHitFlat(char, shiftHeld)`:
1. `nowMs = audioEl.currentTime * 1000 + audioOffset`
2. Find active notes where `n.char === char && n.needsShift === shiftHeld && |nowMs - n.hitTime| <= okWindow`
3. Pick the closest by `|nowMs - n.hitTime|`
4. Grade it: perfect / good / ok based on hit windows; apply combo multiplier; award points; spawn hit-fx particle

Notes past `okWindow` after their hitTime are marked missed on the next game tick.

Hit windows (same for all difficulties):
```javascript
perfect: clamp(beatMs * 0.11, 16, 95)
good:    clamp(beatMs * 0.22, 32, 160)
ok:      clamp(beatMs * 0.36, 55, 240)
```

### Combo and scoring

Base points: Perfect = 100, Good = 75, OK = 50. Multiplied by current multiplier.

Multiplier thresholds: ×1 at 0+, ×2 at 3+, ×3 at 6+, ×4 at 12+. Any miss resets combo to 0.

Draw a vertical progress bar to the right of the highway showing the four multiplier tiers, filling upward as combo grows. Color each tier distinctly (blue, green, orange, pink).

### Beat indicator

A pulsing circle at approximately `x=210, y=FL_HIT_Y` (left of the highway). Phase-locked to notes:

```javascript
const phase = ((nowMs - streamAnchorMs) % stepMs + stepMs) % stepMs;
const pulse = clamp(1 - phase / (stepMs * 0.3), 0, 1);
```

At pulse=1 (beat moment): circle radius ~23px, full brightness, radial glow. Decays over 30% of the step interval. Color matches active difficulty color.

### Keyboard visualization

Miniature QWERTY in the upper-left quadrant, left of the highway. Four rows of keys:
- Numbers: `1234567890`, stagger 0
- Top: `qwertyuiop`, stagger 0.5 key-widths
- Home: `asdfghjkl`, stagger 0.75
- Bottom: `zxcvm`, stagger 1.25 (only up to m)

Key size 26×18 px, 3 px gaps. Left-pinned at x=12. Bottom edge anchored at 62% down the highway height.

Keys glow as their note approaches: `glow = sqrt(clamp(1 - timeUntilHit / TRAVEL_MS, 0, 1))`. The sqrt curve accelerates the brightening as the note nears. On keypress, flash green `#55ff99` for 180 ms regardless of accuracy.

In Spacey Keys mode, render a space bar below the four letter rows — approximately 5 key-widths wide, centered. It glows purple when a space note approaches, flashes green when Space is pressed.

### Next-note display

Below the hit zone, show a box with the next upcoming note's key (large bold text) and a queue of the following 4 notes as smaller tiles to the right. For space notes show `␣`. For Shifty notes that need Shift, show a `⇧ SHIFT` label beneath the key letter and make the box wider. All colors match the note type.

### Setup screen

Before the game, show a setup panel with:
- Audio file picker (local file, stored in `audioEl.src`)
- BPM input (number, 40–300)
- Offbeat toggle (checkbox — shifts grid by `beatMs/2`)
- Audio offset calibration: button opens a modal that plays a Web Audio API click track at the entered BPM, records 8 taps, computes `audioOffset = -median(tapTime - nearestBeatTime)`
- Manual audio offset slider (±150 ms)
- Mode selector: three cards — Straight Keys, Shifty Keys, Spacey Keys
- Difficulty selector: four buttons — Easy, Medium, Hard, Expert (each color-coded green/blue/orange/red)
- Number Keys % input (default 5)
- Start button (disabled until audio is loaded)

Arrow-key navigation through setup sections; left/right changes values; Enter/Space activates.

### Pause, results

Pressing Escape during play pauses the game. A results screen shows after the song ends: full-screen overlay with animated letter grade (S/A/B/C/D/F based on accuracy %), score, accuracy, max combo, perfect/good/ok/miss counts, new high score banner if applicable. High scores persisted in `localStorage` keyed by `hs:{songTitle}:{mode}:{difficulty}`. Two buttons: play again / back to setup.

### Countdown

After pressing Start, a 3-2-1-GO countdown plays over the paused highway before audio begins.

### Visual polish

- Rounded rects everywhere (`rrect` helper using `ctx.roundRect` or manual arc path)
- `lighten` / `darken` color helpers for gradients (parse hex, shift RGB, re-serialize)
- Hit-fx: floating grade text (`Perfect!`, `Good`, `OK`, `Miss`) that rises and fades over ~700 ms, spawned at the note's hit position
- Particle burst on Perfect hits: small colored squares that fly outward and fade
- Lane flash: brief highlight of the hit zone on any successful hit
- Difficulty colors: Easy `#55ff99`, Medium `#5599ff`, Hard `#ffaa44`, Expert `#ff5577`
- Mode colors: Straight `#55ff99`, Shifty `#ffdd55`, Spacey `#cc88ff`
