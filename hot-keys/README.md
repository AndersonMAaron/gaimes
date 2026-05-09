# HotKeyS

A Guitar Hero-style rhythm game played entirely with a standard keyboard. Alphanumeric keys are the instrument — notes fall down a perspective highway and must be pressed at the right moment to score points.

---

## Modes

| Mode | Description |
|------|-------------|
| **Straight Keys** | Plain keypresses only. Notes fall at positions matching their physical QWERTY location. |
| **Shifty Keys** | ~25–45% of notes require Shift. Shift-required notes glow orange; plain notes glow green. |
| **HotKeyS** | Four modifier lanes: None, Shift, Ctrl, Alt. The full experience. |
| **Stream** | Continuous stream of random keys at a fixed rhythm determined by difficulty. No rests, no warmup. Used for timing calibration and pure rhythm practice. Includes a beat indicator circle to the left of the hit zone. |

---

## Difficulty

Difficulty is selected from four preset levels: **Easy**, **Medium**, **Hard**, and **Expert**. Each controls three things: the note generation phrase weights, the Shifty-mode Shift probability, and the HotKeyS modifier-lane distribution.

Hit windows are **uniform across all difficulties** (equivalent to the old Hotness 7 window at 120 BPM).

```javascript
function hitWindows() {
  const beatMs = 60000 / bpm;
  const m = 1.0; // same for all difficulties
  return {
    perfect: clamp(beatMs × 0.11 × m,  16,  95),
    good:    clamp(beatMs × 0.22 × m,  32, 160),
    ok:      clamp(beatMs × 0.36 × m,  55, 240),
  };
}
```

**Example at 120 BPM (beatMs = 500 ms):**

| Window  | Size   |
|---------|--------|
| Perfect | 55 ms  |
| Good    | 110 ms |
| OK      | 180 ms |

---

## Note Generation — Phrase Grid

Notes are generated in **phrases** of 2 or 4 measures (67% chance of 4 measures). Each phrase picks a single rhythmic grid from a weighted set, then stamps that grid across every measure in the phrase. There is a **5-measure silence** at the start of every song before the first note appears.

### 16th-Note Grid System

All grids are defined as positions within a 4/4 measure, indexed in 16th-note steps (0 = beat 1, 4 = beat 2, 8 = beat 3, 12 = beat 4):

| Grid | Positions | Notes per measure |
|------|-----------|-------------------|
| `rest` | `[]` | 0 |
| `whole` | `[0]` | 1 |
| `half` | `[0, 8]` | 2 |
| `quarter` | `[0, 4, 8, 12]` | 4 |
| `eighth` | `[0, 2, 4, 6, 8, 10, 12, 14]` | 8 |
| `sixteenth` | `[0–15]` | 16 |

```
stepMs  = (60000 / bpm) / 4       — one 16th note in ms
measureMs = stepMs × 16            — one 4/4 measure in ms
```

### Phrase Weight Interpolation

At each phrase boundary, a grid type is chosen by weighted random selection. The weights **interpolate linearly** between an `early` set and a `late` set based on how far through the song's content the playhead is:

```javascript
weight[i] = early[i] + (late[i] - early[i]) × progress
// progress = 0 at first phrase, 1 at last phrase
```

Weight arrays map to: `[rest, whole, half, quarter, eighth, sixteenth]`

| Difficulty | early weights | late weights |
|------------|--------------|--------------|
| Easy | `[0.15, 0.75, 0.10, 0, 0, 0]` | `[0.20, 0.25, 0.55, 0, 0, 0]` |
| Medium | `[0.10, 0.10, 0.70, 0.10, 0, 0]` | `[0.05, 0.05, 0.35, 0.55, 0, 0]` |
| Hard | `[0.05, 0.05, 0.65, 0.25, 0, 0]` | `[0.00, 0.05, 0.15, 0.70, 0.10, 0]` |
| Expert | `[0, 0, 0.05, 0.25, 0.70, 0]` | `[0, 0, 0, 0.15, 0.70, 0.15]` |

**Reading the table:** Easy starts on whole notes and gradually shifts toward half notes by the end of the song; rests appear throughout. Expert opens with mostly eighth notes and introduces light sixteenth-note phrases only late in the song.

### HotKeyS Lane Locking

In HotKeyS mode, each phrase has a 50% chance of locking all its notes to the same modifier lane — giving the feel of a chord pattern or modifier hold within the phrase. Per-note lane selection uses the weighted distribution:

| Difficulty | None | Shift | Ctrl | Alt |
|------------|------|-------|------|-----|
| Easy | 0.80 | 0.12 | 0.06 | 0.02 |
| Medium | 0.60 | 0.24 | 0.12 | 0.04 |
| Hard | 0.44 | 0.28 | 0.18 | 0.10 |
| Expert | 0.28 | 0.28 | 0.24 | 0.20 |

---

## Stream Mode

Stream mode generates a **continuous, uninterrupted sequence** of random keys at a fixed rhythmic interval — no warmup silence, no rests between phrases.

### Stream Grid by Difficulty

| Difficulty | Grid | Interval at 120 BPM |
|------------|------|---------------------|
| Easy | Whole note | 2000 ms |
| Medium | Half note | 1000 ms |
| Hard | Quarter note | 500 ms |
| Expert | Eighth note | 250 ms |

### Beat Alignment

The first stream note is snapped to the next whole-beat boundary after the travel lead-in:

```javascript
const snappedLeadIn = Math.ceil(rawLeadIn / beatMs) * beatMs;
```

This ensures the stream starts exactly on a musical beat (assuming the song's downbeat is at `t = 0`).

### Beat Indicator

A pulsing circle is rendered to the left of the hit zone. Its phase is computed from `streamAnchorMs` — the hitTime of the first generated note — so the indicator stays locked to the note stream regardless of when the audio actually starts:

```javascript
const phase = ((nowMs - streamAnchorMs) % stepMs + stepMs) % stepMs;
const pulse = clamp(1 - phase / (stepMs × 0.3), 0, 1);
```

The circle expands and brightens at each beat moment, then decays over the first 30% of the interval. Its color matches the active difficulty.

### Using Stream for BPM Calibration

Because every note must land exactly on a beat, any BPM mismatch compounds note-by-note and becomes visible within the first few seconds. If the notes appear to drift ahead of the song, the entered BPM is too high; if they fall behind, it is too low. Adjust the BPM slider until the notes track the song consistently from start to finish.

---

## Note Placement — Perspective Highway

All modes except Stream use a **perspective trapezoid** highway. The highway is narrowest at the top (vanishing point) and widest at the bottom hit zone.

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

Key buttons in HotKeyS are centered vertically on `HIT_ZONE_Y` (top at `HIT_ZONE_Y - 42`, bottom at `HIT_ZONE_Y + 42`).

### Straight / Shifty / Stream Geometry

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

## Keyboard Visualization

A miniature QWERTY keyboard is rendered in the upper-left quadrant of the screen, left of the highway. Keys glow as their corresponding note approaches the hit zone:

```javascript
glow = sqrt(clamp(1 - (note.hitTime - nowMs) / TRAVEL_MS, 0, 1))
```

The glow ramps from 0 (note at top of highway) to 1 (note at hit zone). When a key is physically pressed, it flashes bright green for 180 ms regardless of hit accuracy.

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
| 0–2   | ×1 |
| 3–5   | ×2 |
| 6–11  | ×3 |
| 12+   | ×4 |

Multiplier thresholds are halved compared to typical rhythm games to reward shorter consistent streaks.

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
| **Difficulty** | Easy / Medium / Hard / Expert — controls note density, modifier frequency, and phrase grid weights. |
| **Number Keys %** | Fraction of notes drawn from `0–9` vs `a–z`. Default 5%. |
| **Offbeat** | Shifts the entire note grid by half a beat, placing all notes on the eighth-note offbeats. In Stream mode the beat indicator shifts to match. |
| **Audio Offset** | Manual trim (±500 ms) for cases where calibration isn't needed. |
