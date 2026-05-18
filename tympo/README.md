# TricKeys

A Guitar Hero-style rhythm game played entirely with a standard keyboard. Alphanumeric keys are the instrument — notes fall down a perspective highway and must be pressed at the right moment to score points. All modes generate a continuous, beat-locked stream of random keys; the differences between modes are which extra inputs are required.

---

## Modes

There are **two modes**. Both share the same foundation (a continuous, beat-locked stream of keys on a perspective highway); they differ only in how note *styles* are arranged over time.

| Mode | Description |
|------|-------------|
| **Straight Keys** | A steady stream of random alphanumeric keys at the difficulty's interval. Three independent, **combinable** options in the menu shape it: **Shifty**, **Double**, **Spacey** (see below). With all options off it is plain single keys. |
| **TricKeys** | Same foundation, but the song is split into a random chain of **Tricks** — runs of **2–4 measures** (1 measure = 4 beats), each in one randomly-chosen *pure* style. No extra options; the Straight Keys toggles are ignored here. |

### Styles / Straight Keys options

A "style" is just which modifiers are active for a stretch of song. Straight Keys uses one composite style for the whole song (whichever options are toggled, mixed probabilistically). TricKeys picks one pure style per Trick.

| Style | Effect | Color |
|-------|--------|-------|
| (plain) | Single key at its QWERTY position | green `#55ff99` |
| **Shifty** | A per-difficulty fraction of notes require Shift (`shiftPct`); those glow orange `#ffaa44`. Space is never Shift-modified. |
| **Double** | A note is a **duo of two distinct keys** that must both be pressed within the window (order-independent), joined by a glowing connector with a semi-transparent `K1+K2` combo plate centred between them. As a Straight option, a per-difficulty `doublePct` of notes become duos; as a TricKeys *double* Trick, every note in the chunk is a duo. Pink `#ff66cc`. |
| **Spacey** | A Space note sits on every offbeat (`t + stepMs/2`), drawn as a wide purple bar. Purple `#cc88ff`. |
| **Wordy** | Whole words fall as wide cyan banners, typed letter-by-letter. Only reachable as a TricKeys *wordy* Trick (it is no longer a standalone mode). Cyan `#44ddff`. |
| **Alphabetter** | **Timed challenge** (not beat-bound): type the whole alphabet A→Z as fast as possible within a 4-measure window. TricKeys-only. Gold `#f5c84b`. |
| **Mot a Trois** | The grid switches to triplets — one key emitted three times at `stepMs/3` spacing before the next key. Three pips over each note count the beat-of-three. Beat-bound. TricKeys-only. Coral `#ff7a59`. |
| **Login Odyssey 2026** | **Timed challenge**: enter 4 random 6-digit MFA codes (24 digits) as fast as possible within a 4-measure window. TricKeys-only. Mint `#5ce6b0`. |
| **Crazy Cutter** | **Timed challenge**: trace a continuous keyboard loop (a string of adjacent keys, e.g. `qwertyuioplmnbvcxzaq`) in order, as fast as possible within a 3-measure window. TricKeys-only. Lime `#aef24a`. |

**Timed-challenge Tricks** (Alphabetter / Login Odyssey / Crazy Cutter) are *not* beat-bound. Each is a self-paced minigame: the Trick occupies a fixed window (`CHALLENGE_MEASURES` — alphabet 4, mfa 4, path 3), and a single challenge object is generated for the whole window instead of a note stream. The player types the entire scripted sequence as quickly as they can; correct keys advance progress (each worth a small base score + combo), and **finishing pays a speed bonus scaled by the fraction of the window still left** (`400 + 1600·frac`, × multiplier). A wrong key just flashes ✕ (no penalty); if the window expires, every unsolved item is a miss and the combo resets. Mot a Trois stays beat-bound (a note stream). In Straight Keys, a single note is plain **or** Shift **or** a duo (Shifty and Double never apply to the same note); Spacey adds Space notes on top of whatever else is active. TricKeys style pool weights: straight 0.20, shifty 0.15, double 0.13, spacey 0.10, wordy 0.10, alphabetter 0.09, triplet 0.09, login 0.07, cutter 0.07 — renormalized over whichever Tricks are enabled in MaTricks.

---

## Difficulty

Four presets control the **note interval** (how often a note appears), the Shift / Double probabilities (when those styles are active), and word complexity in wordy Tricks:

| Difficulty | Interval | Grid | shiftPct | doublePct | Wordy words |
|------------|----------|------|----------|-----------|-------------|
| Easy | Whole note | Every 4 beats | 25% | 12% | 3–4 letter common words |
| Medium | Half note | Every 2 beats | 35% | 20% | 5–6 letter common words |
| Hard | Quarter note | Every beat | 40% | 30% | 6–8 letter uncommon words |
| Expert | Eighth note | Every half-beat | 45% | 40% | 8–12 letter rare/technical words |

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

Both modes share a single generator that produces a continuous stream — no warmup silence, no rests. `getStepMs()` returns the note interval by difficulty:

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
```

`generateNotes()` first builds a list of **segments** `{ end, shiftProb, doubleProb, spacey, wordy }`, then walks the step grid emitting notes for whichever segment the current time falls in. `t` carries across segment boundaries so the grid stays continuous; because `stepMs` always divides `measureMs` (`beatMs * 4`), segments stay measure-aligned.

- **Straight Keys** → one segment spanning the whole song: `shiftProb = optShifty ? shiftPct : 0`, `doubleProb = optDouble ? doublePct : 0`, `spacey = optSpacey`.
- **TricKeys** → a chain of segments, each `2 + floor(rand*3)` measures long (2–4), with parameters from a randomly-weighted pure style (`styleParams(pickTrickStyle())`).

Per step: roll `doubleProb` (→ a `{char, char2, isDouble, got1, got2}` duo with two distinct keys), else roll `shiftProb` (→ `needsShift`), else a plain key; if `spacey`, also push a Space note at `t + stepMs/2`. A `wordy` segment instead emits word notes at `stepMs * 2`. `streamAnchorMs` is stored globally and used by the beat indicator to stay phase-locked.

---

## Note Placement — Perspective Highway

All modes use a single-lane **perspective trapezoid** highway that is narrower at the top (vanishing point) and wider at the bottom hit zone:

```
FL_TOP    = 70     y coordinate of vanishing point
FL_HIT_Y  = 480    y coordinate of hit zone
FL_TOP_W  = 120    highway width at vanishing point
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

Each note is a rounded rect drawn **centered** on `sy` (so the note straddles the hit line at the perfect-hit moment), with a vertical gradient (lighter top, darker bottom) and a thin white highlight stripe near the top. The key letter is rendered centered on the note in dark `#0a0a18` bold monospace, scaling with `depth`.

The hit zone line is a single 3px stroke in the active **mode color** (`#55ff99` Straight, `#ffdd55` Shifty, `#cc88ff` Spacey, `#44ddff` Wordy) with a 30px shadow blur. Successful hits trigger a brief mode-color flash band along the hit line.

### Hit-Trail Zone & Hit Pulse

Two effects use the **beat color** — `DIFFICULTY_DEFS[difficulty].color`, the exact same source as the [Beat Indicator](#beat-indicator) (orange `#ffaa44` on Hard, green/blue/red on Easy/Medium/Expert). A shared `_beatColor()` helper keeps the trail, the pulse, and the beat indicator visually locked together.

- **Hit-trail zone** (`drawHitTrailZone`) — a `TRAIL_PX = 80` fade-out band directly *below* the hit line, drawn under the falling notes. A vertical gradient (`0.16 → 0.05 → 0` alpha in the beat color) plus faint per-key "drip" guides under each `KEY_POS`. Plain single-letter notes keep falling past the line and fade to transparent across this band (hit *or* missed) so they dissolve instead of hard-cutting; word/double/space notes still clip at the line.
- **Hit pulse** (`drawHitPulses`, spawned by `spawnPulse()` on every clean hit, autopilot score, completed duo, or wordy letter) — a single upward shockwave spanning the **whole hit line** (not per-key): a beat-color sheet of light rising off the entire line following the highway taper, a bright crest that lifts off the line as it fades, and a brief white flash along the line at impact. Each pulse lives ~18 frames (`life -= 0.055`).

---

## Beat Indicator

A pulsing circle sits to the left of the hit zone (`x ≈ 210, y = FL_HIT_Y`). It fires in phase with the note stream:

```javascript
const phase = ((nowMs - streamAnchorMs) % stepMs + stepMs) % stepMs;
const pulse = clamp(1 - phase / (stepMs * 0.3), 0, 1);
// pulse = 1 at the beat moment, decays to 0 over 30% of the interval
```

The filled disc expands (radius `12 + 13 * pulse` → 12px idle, 25px at peak) and brightens with a difficulty-color shadow blur (`10 + 30 * pulse`). A ghost ring (`25 + (1 - pulse) * 40` radius) expands outward as the pulse decays, creating a ripple effect. Color matches the active difficulty color. Useful for BPM calibration: if notes drift from the song, the BPM is wrong.

**BPM calibration tip:** If notes arrive ahead of the song, BPM is set too high; if they fall behind, too low. Adjust until the stream tracks the song consistently from start to finish.

---

## Wordy Style

Wordy is no longer a standalone mode — it appears only as a *wordy* Trick inside TricKeys. Words are generated from a per-difficulty dictionary and fall as wide cyan banners down the highway. One word occupies one note slot in the beat schedule. The word queue (`wordyQueue`) is seeded once per game in `generateNotes()` and drawn from across all wordy Tricks.

**Dictionaries** (`WORDY_DICT`):
- `easy` — ~100 words, 3–4 letters (cat, dog, run, sky…)
- `medium` — ~130 words, 5–6 letters (about, dance, magic, scene…)
- `hard` — ~150 words, 6–8 letters (ancient, culture, enhance, rhythm…)
- `expert` — ~130 words, 8–12 letters (benchmark, elaborate, magnitude…)

Words are shuffled each game; the queue reshuffles when exhausted. The active word is `wordyNextWord()` drawing from `wordyQueue`.

**Frequency:** Within a wordy Trick, words spawn at **2× the normal step interval** (`stepMs * 2`) — giving the player time to type each word fully before the next arrives.

**Typing gate:** The player **cannot type a word until it crosses the hit line**. `processHitWordy` filters to `arrived = active.filter(n => nowMs >= n.hitTime - ok_window)` and silently ignores keypresses when nothing has arrived yet.

**Scoring:** The grade (Perfect / Good / OK) is determined **once, on the first letter**, based on how closely the player hits the word's `hitTime`. Every subsequent letter in the same word earns the identical grade and point value. A word-completion bonus (+50 × multiplier) fires on the last letter. Wrong letter: error flash (`✕`), no miss penalty — keep trying until the deadline.

**Miss deadline:** `hitTime + (remaining_letters × 350ms) + ok_window`. Each untyped letter at expiry = one miss, combo reset.

**Highway display:** Words render as a full-width perspective banner (same trapezoidal scaling). Once a word crosses the hit line it **freezes at `FL_HIT_Y`** (`drawY = Math.min(sy, FL_HIT_Y)`) and stays visible there until typed or expired — filling the empty space between words. Letter-level progress is overlaid: typed letters dark/dim, next letter white/full-brightness, remaining letters in dim cyan.

**Typing-trainer preview** (`drawWordyPreview`): Only appears once the word has crossed the hit line (same gate as input). Replaces the single-char box below the hit zone with a wide panel showing each character of the current word individually — typed letters dim with strikethrough, the next letter in bright white with a glowing underline cursor, remaining letters in half-opacity cyan. If space allows, the next word (still approaching) appears in a smaller box to the right.

---

## Double Style

Double is a Straight Keys option and a TricKeys Trick style — not a standalone mode. As a Straight option, a per-difficulty `doublePct` of notes become duos (Easy 0.12 → Expert 0.40). As a *double* Trick, **every** note in that chunk is a duo (`doubleProb = 1`). Each duo carries two distinct keys — `char` and `char2` — both letters/digits (no Space, no Shift); the pair is regenerated until the keys differ.

**Hit logic** (`processHitDouble`): Each keypress looks for the nearest active double note (within the OK window) that still needs that specific key, and sets its `got1`/`got2` flag. The note is **not scored until both keys are down**; the completing press is graded via the normal `scoreNote` timing windows (one combo unit per duo). The first key of a pair gives light particle feedback only. Stray keys cause no penalty. A duo that expires with only one key pressed is a single miss and resets the combo. Autopilot/Hacker powerups score the whole duo at once.

**Highway display:** Both keys are drawn at their own QWERTY x-positions on the same scroll line, joined by a glowing pink connector. If the two keys are close enough that the bubbles would overlap, they are spread symmetrically around their midpoint (`minSep = w + 6 + 4*depth`) so both stay readable. A larger (1.5× note height), semi-transparent (~0.42 alpha) combo plate showing `K1+K2` is centred between them, with the two solid key bubbles on top. A key bubble already pressed for that duo turns green and dims to 55% alpha. Color is pink `#ff66cc`. The keyboard visualization glows for **both** keys of an upcoming duo, and the next-note box widens to fit the `K1+K2` label.

---

## TricKeys

TricKeys reuses the Straight Keys foundation but splits the song into a random chain of **Tricks**. A Trick's length comes from `styleMeasures()`: beat-bound Tricks are `2 + floor(rand*3)` measures (2–4); timed-challenge Tricks use their fixed `CHALLENGE_MEASURES` window (1 measure = `beatMs * 4`). `pickTrickStyle()` draws from `TRICK_WEIGHTS` but only over Tricks left enabled in MaTricks (`trickEnabled`), renormalizing the weights; at least one Trick is always enabled. `styleParams()` maps a style to its generator (`gen: 'normal' | 'alphabet' | 'triplet' | 'mfa' | 'path'`, plus `wordy`/`spacey`/prob flags). For beat-bound segments `t` carries across Trick boundaries so the grid never breaks; a challenge segment emits one challenge object and snaps `t` to its end so following beat-bound Tricks stay aligned.

Input is routed by **what is actually on the highway**, not a global mode. A live timed challenge owns *all* key input first (`activeChallenge()` → `processChallengeKey()`), ahead of powerups. Otherwise each keypress checks (1) is a word arrived & being typed → `processHitWordy`; (2) does this key advance a pending duo in the window → `processHitDouble`; (3) otherwise `processHitFlat(key, shiftHeld)` (plain / Shift / Space). Mot a Trois is a plain single-key note stream, so it routes through `processHitFlat`. The hit-zone line is teal `#33ddbb` (or, during a single-Trick trial, that Trick's accent color).

### Trying a single Trick

The MaTricks detail panel has a **▶ Try this Trick** button (enabled once a music file is loaded). It snapshots the current Main Menu settings (song, BPM/target BPM, difficulty, etc.), sets `trialStyle`, and launches a single-Trick run via `beginGame()`. `generateNotes()` builds one segment of that style sized by `styleMeasures()` (beat-bound trials = 8 measures; challenge trials = that challenge's window). `gameLoop()` ends the run at `trialEndMs` — segment end + travel for beat-bound, or shortly after the challenge resolves/expires — and shows the normal results screen, labeled *Trick Trial · &lt;name&gt;* with no high-score write. Returning to setup clears `trialStyle`.

### Trick name panel

`generateNotes()` records a module-level `trickTimeline` of `{ start, end, style }`. During play, `drawTrickPanel()` finds the active (or first upcoming) Trick via `currentTrick(nowMs)` and shows a small panel on the **left, just above the keyboard visualizer**: a `▸ TRICK` eyebrow, the Trick's clever name in its accent color, and a one-line blurb. A left accent bar and a ~550 ms glow/pop emphasize each Trick change. The panel only renders in TricKeys (Straight Keys has no Tricks).

| Style | Name | Blurb | Color |
|-------|------|-------|-------|
| straight | **Clean Run** | Single keys, nothing fancy | `#55ff99` |
| shifty | **Shift Happens** | Some keys need Shift | `#ffaa44` |
| double | **Double Trouble** | Two keys at once | `#ff66cc` |
| spacey | **Space Oddity** | Space on every offbeat | `#cc88ff` |
| wordy | **Word Up** | Type the whole word | `#44ddff` |
| alphabetter | **Alphabetter** | Type the alphabet in order | `#f5c84b` |
| triplet | **Mot a Trois** | Triplets — one key, ×3 | `#ff7a59` |
| login | **Login Odyssey 2026** | Enter the MFA codes | `#5ce6b0` |
| cutter | **Crazy Cutter** | Trace the keyboard loop | `#aef24a` |

**In-highway challenge overlay.** The three timed challenges take over the highway with a large focused panel (`drawChallenge()`, drawn over a dimmed highway; `challengeInWindow()` selects it and `drawNextNote()` early-returns so the box is suppressed). It shows the Trick name, a depleting **time bar**, and a kind-specific body: **Alphabetter** → an A–Z grid (typed dim, current lit, remaining outlined); **Login Odyssey 2026** → 4 stacked code rows of digit boxes that fill as you type, completed codes checked; **Crazy Cutter** → a large keyboard with the loop as a polyline and a glowing tracer on the next key. The footer shows progress, and on finish a **SOLVED · +bonus** banner (or **TIME** on expiry); the bar freezes at the fraction earned. **Mot a Trois** stays beat-bound — the normal next-note box plus three pips above each highway note marking the beat-of-three.

### MaTricks (trick guide)

A small **MaTricks** button (a pun on *Matrix* / *"ma tricks"*) sits just below the TricKeys mode card on the setup screen. It opens a two-panel reference popup (`#mtOverlay`):

- **Left panel** (`#mtList`) — a clickable list of all Trick names, color-accented per Trick. Each row has an **ON/OFF** pill that toggles whether that Trick appears in the random TricKeys rotation (`trickEnabled`); the last enabled Trick can't be turned off (it shake-rejects). Up/Down/Left/Right arrows cycle the selection while the popup is open.
- **Right panel** (`#mtDetail`) — the selected Trick's name (in its accent color), one-line blurb, a CSS-rendered **visual preview**, a longer description, an **IN ROTATION / EXCLUDED** toggle, and a **▶ Try this Trick** button (disabled until a song is loaded; see *Trying a single Trick* above).

Closed via the ✕ button, an overlay-backdrop click, or Escape. Names, blurbs, and colors are sourced from the same `TRICK_INFO` map used by the in-game Trick panel; the popup adds only the longer copy (`MATRICKS`) and the preview markup (`mtPreview()`). A capture-phase `keydown` listener keeps Escape/arrow keys from reaching the setup-screen handler while the popup is open.

---

## Frequency Visualizer (WMP-style)

A Windows Media Player "Bars and Waves"-style frequency visualizer sits to the left of the highway, centered around `x ≈ 92`. 26 vertical bars span roughly 0–8 kHz using logarithmic frequency mapping (bass left, treble right), rising from a dark panel floor. Each bar's height is proportional to the peak amplitude in its frequency bucket. A white peak-dot sits above each bar and falls at ~1.2 px/frame.

```javascript
gameAnalyser.fftSize = 512;            // ~11.6ms slice — short window like WMP
gameAnalyser.smoothingTimeConstant = 0.75;
gameAnalyser.getByteFrequencyData(freqData); // 256 frequency bins, 0–255
```

**Frequency mapping:** 26 bars are logarithmically spaced over bins 0–93 (≈ 0–8 kHz at 44100 Hz) using `t = (b / NUM_BARS) ^ 1.7` to weight bass bars wider. Each bar takes the max value across its bin range.

**Bar rendering:** Each bar is filled with a fixed blue gradient — `#1a3370` (dim base) → `#55aaff` (mid) → `#ddeeff` (bright tip) — with a `#55aaff` shadow blur. A small `FREQ` label sits above the panel; the panel itself is a 130×86 rounded rect with a translucent dark fill and a soft blue border. The peak dot is a 2px white bar.

**Peak decay:** Stored in `wmpPeaks` (`Float32Array`, module-level), reset when the analyser reconnects. Each frame: `peak = max(peak - 1.2, currentBarHeight)`.

The analyser is created via `ensureAnalyser()` on game start, which calls `createMediaElementSource(audioEl)` on a shared `AudioContext`. The source reconnects automatically if a new audio file is loaded. The visualizer only draws during `PLAYING` state.

---

## Keyboard Visualization

A miniature QWERTY keyboard (`rows: 1234567890 / qwertyuiop / asdfghjkl / zxcvbnm`) is rendered in the upper-left quadrant of the screen, left of the highway. Key size: **21×15 px** with 3 px gaps (deliberately compact so the keyboard never clips into the perspective highway). Left-pinned at x=12, bottom anchored at 62% down the highway height. Key labels are 10px bold monospace; the Spacey space bar label is 9px.

Keys glow as their corresponding note approaches the hit zone:

```javascript
glow = Math.sqrt(clamp(1 - timeUntilHit / TRAVEL_MS, 0, 1))
```

The sqrt curve means the glow ramps slowly when the note is far away, then accelerates as it reaches the hit zone.

When a key is physically pressed, it flashes bright green (`#55ff99`) for 180 ms, regardless of timing accuracy.

A space bar is always rendered below the four letter rows — a wide key (~5 key-widths) centered under the keyboard (Space notes can appear in either mode via the Spacey option or a spacey Trick). It glows purple when a space note is approaching and flashes green when Space is pressed.

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

A vertical multiplier bar (28×full-highway-height at `x=750`) shows the four tiers as stacked rounded slots. Each tier slot lights up with its own color (`×1` blue, `×2` green, `×3` orange, `×4` pink) once its threshold is reached, with the label rendered in white in the centre of the slot. When the **×2** powerup is active, all reached tiers turn gold (`#ffdd55`) and the labels switch to the doubled values (×2/×4/×6/×8).

The in-game HUD is intentionally minimal: a `SCORE` label and the live score (`#88ccff`, 32px monospace) at top-left, the current combo (`{n}× COMBO`, gold) just below; the active difficulty (in its color) and mode (in mode color) right-aligned at top-right; and the playback rate (`× 1.25`) below them when Target BPM ≠ Song BPM.

---

## Powerups

Every 12th consecutive hit while at the ×4 multiplier (with no powerup already active) charges one consumable powerup. A `⬆ POWERUP READY` banner appears. Press an **arrow key** to activate:

| Key | Name | Duration | Effect |
|-----|------|----------|--------|
| ↑ ArrowUp | **×2** | 10 s | Current multiplier is doubled while active |
| → ArrowRight | **P-P-P-P** | 8 s | Every keypress is treated as `P`, hitting any note in the window |
| ↓ ArrowDown | **HACKER MODE** | 5 s | Any keypress hits any note in the window; if no note is queued, awards a free +25 points |
| ← ArrowLeft | **AUTOPILOT** | 10 s | Notes in the hit window are automatically scored as Good without any input |

Only one powerup can be active at a time. The charge is consumed on activation; a new charge can be earned after the active powerup expires.

Four powerup slot icons are stacked **vertically at `x=815`, to the right of the multiplier bar**, in the order ↑ ↓ → ←. Each slot is a 40×40 circle showing:
- A translucent dark fill with a faint gray border when uncharged
- A bright color glow ring (the powerup's color) when charged or active
- A depleting clockwise arc inside the circle that tracks remaining duration while active
- The arrow icon (22px) centered, with a short label (`×2` / `PPPP` / `HACK` / `AUTO`) below

---

## Audio Sync

All timing uses `audioEl.currentTime * 1000 + audioOffset`. A calibration tool plays a Web Audio API click track at known BPM intervals and collects taps, computing:

```
audioOffset = median of (tapTime − nearestBeatTime)
```

A positive `audioOffset` shifts the effective "now" forward — if the user naturally taps 30 ms after the beat, applying +30 ms centres their hits in the window. Manual offset trim is also available (±150 ms input).

---

## Configuration

| Setting | Effect |
|---------|--------|
| **BPM** | The song's actual tempo. Sets the beat grid for note generation and hit windows. |
| **Target BPM** | The tempo the song is played at. `audioEl.playbackRate = targetBpm / bpm`, pitch-preserving. Equal to BPM = no speed change. Auto-tracks BPM until manually edited. |
| **Difficulty** | Easy / Medium / Hard / Expert — controls note interval, `shiftPct`, and `doublePct`. |
| **Mode** | Straight Keys or TricKeys. |
| **Options** | Four checkboxes: **Offbeat** (both modes) plus **Shifty / Double / Spacey** (Straight Keys only — combinable; ignored by TricKeys). ←→ moves the sub-cursor, Enter toggles. |
| **Number Keys %** | Fraction of notes drawn from `0–9` vs `a–z`. Default 5%. |
| **Offbeat** | Shifts the note grid by half a beat (notes land on eighth-note offbeats). Beat indicator phase shifts to match. |
| **Audio Offset** | Manual timing trim for when calibration isn't needed. |

### Tempo Shift (Target BPM)

The setup screen has two BPM inputs:

- **BPM** — the song's intrinsic tempo, used by the note generator.
- **Target BPM** — the desired playback tempo.

On game start:

```javascript
audioEl.preservesPitch = true;
audioEl.playbackRate   = targetBpm / bpm;
```

`audioEl.currentTime` is the song's intrinsic-time position; with `playbackRate = r` it advances `r` seconds per wall-clock second. Note generation, hit windows, and the beat indicator all operate on intrinsic time (`nowMs = audioEl.currentTime * 1000 + audioOffset`), so they automatically render as Target BPM in wall-clock — the highway visibly speeds up or slows down to match.

Target BPM defaults to 120 and auto-tracks the BPM input (including the TAP detector) until the user manually edits it, at which point the two become independent.

---

## Regeneration Prompt

> The following is a self-contained prompt for a fresh Claude Code session to recreate this game from scratch.

---

Build a single-file browser rhythm game called **TricKeys** (`keyhero.html`). No build tools, no dependencies — everything in one HTML file with inline CSS and JavaScript.

### Core concept

Guitar Hero-style, but the instrument is a QWERTY keyboard. The player loads a local audio file, enters the song BPM, and a continuous stream of random letter/number notes falls down a perspective highway. The player presses the correct key as each note crosses a hit zone near the bottom of the screen. All timing is locked to `audioEl.currentTime`, never `performance.now()`.

### Canvas setup

- Logical canvas size: `CW = 900`, `CH = 800`
- Support HiDPI: size the canvas backing store at `CW * devicePixelRatio * canvasScale`, where `canvasScale` is computed on resize to fit the window while preserving aspect ratio
- Apply the DPR+scale transform each frame with `ctx.setTransform(px, 0, 0, px, 0, 0)` where `px = canvasScale * devicePixelRatio`
- Dark background `#03030c` with a subtle scanline overlay (horizontal lines every 4px at 2.2% opacity)

### Highway geometry (flat / single-lane)

All three game modes use a single perspective trapezoid highway:

```
FL_TOP    = 70     vanishing point Y
FL_HIT_Y  = 560    hit zone Y
FL_TOP_W  = 120    highway width at vanishing point
FL_BOT_W  = 420    highway width at hit zone
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
2. Check active powerup first (see Powerups section)
3. Find active notes where `n.char === char && n.needsShift === shiftHeld && |nowMs - n.hitTime| <= okWindow`
4. Pick the closest by `|nowMs - n.hitTime|`
5. Grade it: perfect / good / ok based on hit windows; apply combo multiplier; award points; spawn hit-fx particle

Notes past `okWindow` after their hitTime are marked missed on the next game tick.

Hit windows (same for all difficulties):
```javascript
perfect: clamp(beatMs * 0.11, 16, 95)
good:    clamp(beatMs * 0.22, 32, 160)
ok:      clamp(beatMs * 0.36, 55, 240)
```

### Combo and scoring

Base points: Perfect = 100, Good = 75, OK = 50. Multiplied by current multiplier (doubled again if ×2 powerup is active).

Multiplier thresholds: ×1 at 0+, ×2 at 3+, ×3 at 6+, ×4 at 12+. Any miss resets combo to 0.

Draw a vertical progress bar to the right of the highway showing the four multiplier tiers, filling upward as combo grows. Color each tier distinctly (blue, green, orange, pink). To the right of this bar, stack the four powerup slot icons vertically (see Powerups).

When the ×2 powerup is active, tier labels update to show the effective doubled values (×2/×4/×6/×8 instead of ×1/×2/×3/×4). All reached-tier labels render in gold (`#ffdd55`) with a glow to signal the boosted state.

### Powerups

State: `powerupCharge` (0 or 1), `activePowerup` (null or object with `{ type, label, color, icon, expiresAt, duration }`).

**Earning a charge:** Inside `scoreNote`, after awarding points: if `combo % 12 === 0 && powerupCharge === 0 && !activePowerup`, set `powerupCharge = 1` and spawn a `⬆ POWERUP READY` banner.

**Activating:** Arrow keys during PLAYING state. If `powerupCharge === 1`, consume the charge and set `activePowerup` with the selected type and an `expiresAt = nowMs + duration`. In the game tick, clear `activePowerup` when `nowMs >= expiresAt`.

```javascript
const POWERUPS = {
  ArrowUp:    { type:'double',    label:'×2',          color:'#ffdd55', icon:'↑', duration:10000 },
  ArrowRight: { type:'allP',      label:'P-P-P-P',     color:'#55ffcc', icon:'→', duration:8000  },
  ArrowDown:  { type:'hacker',    label:'HACKER MODE', color:'#55ff99', icon:'↓', duration:5000  },
  ArrowLeft:  { type:'autopilot', label:'AUTOPILOT',   color:'#ff88cc', icon:'←', duration:10000 },
};
```

**Hit detection overrides** (check before normal matching):
- `hacker`: any keypress hits the nearest note in the ok window; if no note is present, award +25 points and return
- `allP`: only `p` keypresses are accepted, but `p` matches any note in the ok window (ignores `char`)
- `double`: no hit override — multiplier is doubled in scoring
- `autopilot`: no keypress override — in `checkMisses`, auto-score notes that enter the ok window as Good

**Powerup slot UI:** Four icons stacked vertically to the right of the mult bar, from top to bottom: ↑ ↓ → ← (or ArrowUp, ArrowDown, ArrowRight, ArrowLeft order). Each slot: dim circle background; bright glow ring when this slot's powerup is charged or active; depleting arc (clockwise drain) while active showing remaining fraction; the arrow icon centered; a short label below. Color each slot with its powerup color.

### Frequency visualizer (WMP-style bars)

A Windows Media Player-style bar visualizer is rendered to the left of the highway (centered `x=92`). Connect the audio element to a Web Audio `AnalyserNode` via `ensureAnalyser()` — `audioCtx.createMediaElementSource(audioEl)`, route source → analyser → destination. Store the analyser, a `Uint8Array(analyser.frequencyBinCount)` frequency buffer, a `Float32Array(NUM_BARS)` peak tracker (`wmpPeaks`), and a reference to `audioEl` to detect reconnects.

Each frame during PLAYING state, call `analyser.getByteFrequencyData(freqData)`. Render 26 bars logarithmically spaced over bins 0–93 (~8 kHz). Each bar takes the max value across its bin range, maps to a height over an 86px panel, and is drawn with a vertical gradient (dim base → bright tip → near-white) plus a glow pass. A white peak dot sits above each bar and decays at 1.2 px/frame (`wmpPeaks[b] = max(wmpPeaks[b] - 1.2, barH)`).

```javascript
analyser.fftSize = 512;               // ~11.6ms slices — short window like WMP
analyser.smoothingTimeConstant = 0.75;
```

When the ×2 powerup is active, show doubled multiplier tier labels (×2/×4/×6/×8) in the mult bar with gold highlighting.

### Beat indicator

A pulsing circle at approximately `x=210, y=FL_HIT_Y` (left of the highway). Phase-locked to notes:

```javascript
const phase = ((nowMs - streamAnchorMs) % stepMs + stepMs) % stepMs;
const pulse = clamp(1 - phase / (stepMs * 0.3), 0, 1);
```

At pulse=1 (beat moment): circle radius ~25px, full brightness, radial glow, plus a ghost ring that expands outward as the pulse decays. Decays over 30% of the step interval. Color matches active difficulty color.

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
- BPM input (number, 40–300) — the song's intrinsic tempo
- Target BPM input (number, 40–300) — the desired playback tempo. Show a rate label (`× = targetBpm / bpm`) next to the input — gold when ≠ 1, dim white when = 1. Default 120, auto-tracks BPM (including the TAP detector) until the user manually edits it. On game start, set `audioEl.preservesPitch = true` and `audioEl.playbackRate = targetBpm / bpm`. All note timing is in intrinsic audio time, so the highway visibly speeds up or slows down to match.
- Offbeat toggle (checkbox — shifts grid by `beatMs/2`)
- Audio offset calibration: button opens a modal that plays a Web Audio API click track at 80 BPM, records 10 taps, computes `audioOffset = median(tapTime - nearestBeatTime)` (positive = user taps late = shift hit window forward)
- Manual audio offset slider (±150 ms)
- Mode selector: three cards — Straight Keys, Shifty Keys, Spacey Keys. Shifty carries a faint orange ambient glow (`rgba(255,221,85,0.09)`) even when unselected; Spacey carries faint purple (`rgba(204,136,255,0.09)`).
- Difficulty selector: four buttons — Easy, Medium, Hard, Expert (each color-coded green/blue/orange/red). Each button has a faint per-color ambient glow (`box-shadow`) even when unselected, using `data-diff` CSS selectors.
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
- Powerup active: tint the active powerup's color subtly across the UI (mult bar glow, banner text)
