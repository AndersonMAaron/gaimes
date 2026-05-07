# HotKeyS

A Guitar Hero-style rhythm game played entirely with a standard keyboard. Alphanumeric keys are the instrument — notes fall down a perspective highway and must be pressed at the right moment to score points.

---

## Modes

| Mode | Description |
|------|-------------|
| **Straight Keys** | Plain keypresses only. Notes fall at positions matching their physical QWERTY location. |
| **Shifty Keys** | ~40% of notes require Shift. Shift-required notes glow orange; plain notes glow green. |
| **HotKeyS** | Four modifier lanes: None, Shift, Ctrl, Alt. The full experience. |

---

## Hotness (Difficulty)

Difficulty is controlled by a single **Hotness** slider from 1–10. Each level is defined by three parameters:

```
HOTNESS[level - 1] = { sub, den, hitM }
```

| Level | sub   | den  | hitM |
|-------|-------|------|------|
| 1     | 4.00  | 0.55 | 2.20 |
| 2     | 3.00  | 0.58 | 2.00 |
| 3     | 2.00  | 0.62 | 1.70 |
| 4     | 1.50  | 0.65 | 1.50 |
| 5     | 1.00  | 0.68 | 1.30 |
| 6     | 0.75  | 0.70 | 1.10 |
| 7     | 0.50  | 0.72 | 0.90 |
| 8     | 0.33  | 0.73 | 0.75 |
| 9     | 0.25  | 0.75 | 0.62 |
| 10    | 0.17  | 0.77 | 0.50 |

### `sub` — Beat Subdivision

`sub` is a multiplier applied to the beat interval to produce the note-grid step size:

```
stepMs = (60000 / bpm) × sub
```

A beat at 120 BPM is 500 ms. With `sub = 1.00` (level 5), notes are placed on every beat (500 ms apart). With `sub = 0.25` (level 9), notes are placed on every sixteenth note (125 ms apart). With `sub = 0.17` (level 10), notes approach sixteenth-note triplet density (~83 ms apart).

Clean musical fractions were chosen intentionally so note grids stay rhythmically coherent regardless of BPM:

| sub  | Equivalent subdivision |
|------|------------------------|
| 4.00 | Every 4 beats (whole note) |
| 2.00 | Every 2 beats (half note) |
| 1.00 | Every beat (quarter note) |
| 0.50 | Eighth note |
| 0.25 | Sixteenth note |
| 0.17 | ~Sixteenth triplet |

### `den` — Note Density

After the grid step places a candidate slot, `den` is the probability that slot actually spawns a note:

```javascript
if (Math.random() >= h.den) continue;  // skip this slot
```

At level 1, `den = 0.55` means roughly 55% of grid slots produce a note. At level 10, `den = 0.77`. This interacts multiplicatively with `sub`: a fine grid with low density can feel similar in note count to a coarse grid with high density, but the fine grid forces more precise timing even for the notes that do appear.

### `hitM` — Hit Window Multiplier

`hitM` scales the three hit windows around each note's target time:

```javascript
function hitWindows() {
  const beatMs = 60000 / bpm;
  const m = HOTNESS[hotness - 1].hitM;
  return {
    perfect: clamp(beatMs × 0.11 × m,  16,  95),
    good:    clamp(beatMs × 0.22 × m,  32, 160),
    ok:      clamp(beatMs × 0.36 × m,  55, 240),
  };
}
```

Base windows are proportional to the beat (11%, 22%, 36% of one beat), then scaled by `hitM` and clamped to prevent extremes at very high or very low BPM. At level 1 (`hitM = 2.2`) the windows are more than double their base size. At level 10 (`hitM = 0.5`) they are halved, demanding near-perfect timing.

**Example at 120 BPM (beatMs = 500 ms):**

| Level | hitM | Perfect window | Good window | OK window |
|-------|------|---------------|-------------|-----------|
| 1     | 2.20 | 95 ms (capped) | 160 ms (capped) | 240 ms (capped) |
| 5     | 1.30 | 71 ms | 143 ms | 234 ms |
| 10    | 0.50 | 27 ms | 55 ms | 90 ms |

---

## Note Placement — Perspective Highway

All three modes use a **perspective trapezoid** highway. The highway is narrowest at the top (vanishing point) and widest at the bottom hit zone.

### HotKeyS (Multi-lane) Geometry

```
HWY_TOP    = 70    (y coordinate of vanishing point)
HIT_ZONE_Y = 480   (y coordinate of hit zone)
TOP_W      = 220   (highway width at top)
BOT_W      = 600   (highway width at hit zone)
LANE_COUNT = 4
```

At any screen Y, the highway width and left edge are:

```javascript
function hBounds(y) {
  const t  = (y - HWY_TOP) / HWY_H;        // 0 at top, 1 at hit zone
  const w  = TOP_W + (BOT_W - TOP_W) * t;  // linear interpolation
  const sx = (CW - w) / 2;                  // centered
  return { sx, w, lw: w / LANE_COUNT };
}
```

Notes in each lane are centered at `sx + (lane + 0.5) × lw`.

### Straight / Shifty Geometry

These modes use the same trapezoid formula with narrower dimensions (`FL_TOP_W = 120`, `FL_BOT_W = 380`), and place each note horizontally according to its **physical QWERTY position**:

```javascript
const KEY_POS = {
  '1':0.048, '2':0.143, ... '0':0.905,
  'q':0.095, 'w':0.190, ... 'p':0.952,
  'a':0.119, 's':0.214, ... 'l':0.881,
  'z':0.167, 'x':0.262, ... 'm':0.738,
};

function flatNoteX(char, y) {
  const { sx, w } = flatHBounds(y);
  return sx + (KEY_POS[char] ?? 0.5) * w;
}
```

`KEY_POS` values are normalized 0–1 positions derived from the standard QWERTY stagger, so the note for `'q'` falls near the left edge of the highway and `'p'` near the right. The perspective scaling means notes visually spread apart as they approach the hit zone — matching the physical spread of the keyboard the player is looking at.

### Note Travel

All notes travel at the same constant speed regardless of difficulty:

```
TRAVEL_MS = 2400 ms  (time for a note to travel from top to hit zone)
```

The Y position of a note at any render frame is:

```javascript
const sy = HIT_ZONE_Y - ((note.hitTime - nowMs) / TRAVEL_MS) × HWY_H;
```

`nowMs` is derived from `audioEl.currentTime` rather than `performance.now()`, so note positions stay locked to the audio playhead even after tab focus changes or system jitter.

---

## HotKeyS Lane Distribution

In HotKeyS mode, which modifier lane a note falls in is drawn from a weighted random distribution that shifts toward modifier lanes as hotness increases:

```
LANE_WEIGHTS[hotness - 1] = [none, shift, ctrl, alt]
```

| Level | None | Shift | Ctrl | Alt  |
|-------|------|-------|------|------|
| 1     | 0.80 | 0.12  | 0.06 | 0.02 |
| 5     | 0.44 | 0.28  | 0.18 | 0.10 |
| 10    | 0.25 | 0.25  | 0.25 | 0.25 |

At level 1, 80% of notes require no modifier — ideal for learning the feel of the highway. At level 10, all four lanes are equally likely. The cumulative distribution is sampled with a single random roll:

```javascript
function pickLane() {
  const r = Math.random(); let c = 0;
  for (let i = 0; i < LANE_COUNT; i++) {
    c += lw[i];
    if (r < c) return i;
  }
  return 0;
}
```

A **lane run** mechanic adds short bursts of the same modifier: with 22% probability a run of 1–3 consecutive same-lane notes is started, giving the feel of a chord pattern or modifier hold.

---

## Scoring

| Grade   | Timing             | Base Points |
|---------|--------------------|-------------|
| Perfect | Within perfect window | 100 |
| Good    | Within good window    | 75  |
| OK      | Within OK window      | 50  |
| Miss    | Outside OK window     | 0, combo reset |

Points are multiplied by the current **combo multiplier**:

| Combo streak | Multiplier |
|---|---|
| 0–4   | ×1 |
| 5–12  | ×2 |
| 13–24 | ×3 |
| 25+   | ×4 |

---

## Audio Sync

Timing is always computed from `audioEl.currentTime * 1000 + audioOffset` rather than wall-clock time. `audioOffset` is set by the calibration tool, which plays a Web Audio API metronome at known intervals and computes the median tap offset over 8 beats:

```
audioOffset = -(median of (tapTime − nearestBeatTime))
```

A negative measured offset (user taps late) produces a positive `audioOffset`, shifting the effective "now" forward to compensate.

---

## Configuration

| Setting | Effect |
|---------|--------|
| **BPM** | Sets the beat grid. All note timing and hit windows scale with it. |
| **Hotness 1–10** | Controls `sub` (note density grid), `den` (spawn probability), and `hitM` (hit window size). |
| **Number Keys %** | Fraction of notes drawn from `0–9` vs `a–z`. Default 5%. |
| **Offbeat** | Shifts the entire note grid by half a beat, placing all notes on the eighth-note offbeats. |
| **Audio Offset** | Manual trim (±500 ms) for cases where calibration isn't needed. |
