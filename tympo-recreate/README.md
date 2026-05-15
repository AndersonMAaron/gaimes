# Tympo

A Guitar Hero–style rhythm game where the instrument is your QWERTY keyboard. Single HTML file, no build tools, no dependencies.

## Run

Open `tympo.html` in a modern browser (Chrome, Firefox, Edge). Audio playback and the Web Audio API require a user gesture, so settings only take effect after clicking **START**.

## How to play

1. Pick a local audio file.
2. Enter the song's **BPM**. Optionally set a different **Target BPM** to speed up or slow down the song while preserving pitch.
3. Pick a **Mode** and **Difficulty**.
4. Hit **START** and play along — press the key shown on each note as it crosses the hit zone.

### Setup screen

| Setting | Description |
|---|---|
| Audio File | Local audio (mp3/wav/ogg/m4a). |
| Song BPM | Intrinsic tempo of the file. |
| Target BPM | Desired playback tempo. Rate label turns gold when ≠ song BPM. |
| Offbeat | Shifts the note grid by half a beat. |
| Audio Offset | Manual ±150 ms slider, or use **CALIBRATE** to tap along to a click track. |
| Number Keys % | Probability a note is a digit instead of a letter. |

Navigate the setup screen with **↑ ↓** and tweak values with **← →**. **Enter** / **Space** activates a button.

### Modes

- **Straight Keys** – press the shown key. Shift / Ctrl / Alt are ignored.
- **Shifty Keys** – orange notes require **Shift** to be held while pressing.
- **Spacey Keys** – between each letter note, a purple bar requires **Space**.

### Difficulty

Controls step size between notes:

- Easy: whole notes
- Medium: half notes
- Hard: quarter notes
- Expert: eighth notes

### Powerups

Earn one charge every 12 notes in a row. Activate it with an arrow key:

| Key | Powerup | Duration |
|---|---|---|
| ↑ | ×2 multiplier | 10 s |
| → | P-P-P-P (any note is hit with `p`) | 8 s |
| ↓ | Hacker mode (any key hits any note) | 5 s |
| ← | Autopilot (notes auto-hit as Good) | 10 s |

### Scoring

- Perfect: 100 pts
- Good: 75 pts
- OK: 50 pts
- Miss: combo resets

Combo multiplier: ×1 (0+), ×2 (3+), ×3 (6+), ×4 (12+). Stacks with the ×2 powerup.

High scores are saved per song / mode / difficulty in `localStorage`.

### Controls

- Letter / number / space keys: hit notes
- Shift + key: hit shifty notes
- Arrow keys: activate a charged powerup
- ESC: pause / resume

## File layout

```
tympo-recreate/
├── tympo.html   single-file game (HTML + CSS + JS inline)
└── README.md    this file
```
