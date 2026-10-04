# Motion rules

What makes a film like this feel smooth, and what made ours feel stiff before we fixed it.

## Springs only

All motion comes from `kit/lib/motion.js`: closed-form damped springs, evaluated at any `t`.
No easing curves, no tweens, no CSS transitions, no per-frame integration.

| Preset | ω, ζ | Overshoot | Halfway | Settled (2%) | Use |
|---|---|---|---|---|---|
| `snappy` | 16, 0.82 | ~1.1% | 96 ms | 0.30 s | buttons, toggles, presses, leading edges, digits, fast exits |
| `default` | 10, 0.86 | ~0.5% | 156 ms | 0.47 s | cards, containers, windows, the camera, the cursor |
| `heavy` | 8.5, 1.0 | 0 | 198 ms | 0.68 s | big type, the logo lockup |
| `playful` | 9, 0.5 | ~16% | 144 ms | 0.89 s | visible bounce: mascots only, never UI or type |

Tiny overshoot on UI, none on type. These are tuned to a 128 BPM beat (469 ms): UI lands in
two-thirds of a beat, containers and camera in one beat, big type in a beat and a half.

**The stiffness lesson.** Our first presets settled in 0.14–0.29 s, under half a beat. Every move
snapped into place and then sat dead still until the next one, which reads as stiff and
mechanical even though every curve was a "spring". The fix was not new curves, it was time:
slower presets so moves overlap. If a film feels stiff, measure halfway/settle times against
the beat before changing anything else.

## track() for anything with more than one target

A value that goes A → B → C is `track(t, [[0, A], [t1, B], [t2, C]])`: one spring per change,
each starting at its own time, summed. Never restart a spring, never multiply an "in" spring by
`(1 - out spring)`, never blend two springs with a hand-made weight. Per-key presets are allowed
(`[t, value, 'snappy']`), e.g. a slow entrance and a fast exit on the same value.

- Two-edge indicators (selection rings, underlines) use `indicator()`: the leading edge on the
  stiffer spring, so the shape stretches toward its target and the trailing edge catches up.
- Text inside a morphing container uses `swapAlpha()` timing: in after the morph starts, out
  before the next one.
- Playheads (footage time, player progress bars) are `clock()`: constant speed, not eased.
- Slow drifts (dolly, parallax) are `glide()`: velocity ramps on a spring, position integrated
  exactly, so they start and stop without a jolt.
- Discrete state (which variant is showing) is `pick()`.

## Flow: overlap everything

- **Exits lead the next move.** Start an element's exit so it is leaving *while* the next thing
  arrives, never finishing beforehand. Our dead spots were all "copy left, then half a second of
  nothing, then the camera moved". Fixes: the camera leaves a sixteenth early (beat 11.75) while
  the copy is still lifting out; showcase labels stay until the box lifts, then leave on `snappy`.
- **Handovers, not cuts.** Consecutive shots overlap by ~0.1 s: the outgoing panel slides off to
  its own side as the incoming one slides in from the other, landing on the beat.
- **Clear the path first.** If an incoming object will cross an outgoing label, the label starts
  its exit ~0.2 s earlier on `snappy`, so it is gone before it can be crossed.
- **Arrive a hair early.** Entrances key ~0.08 s before their beat so they *land* on it.
- **Frame 0 is already moving.** The first shot's spring starts at a negative time.
- **Glides settle before their click.** A cursor on `default` takes ~0.47 s; key its target at
  least that long before the click (we key it a full beat early). A cursor arriving after the
  click sound is the most visible timing bug there is.
- **Anticipation before a convergence**: scale up 3% a beat before everything folds inward.

## One object, docked to a moving world

- The carried object is a screen-space element. When it belongs inside the 3D world (the page in
  the studio), compute the world rect's projection under the current camera every frame and
  blend toward it with a docking weight (`track()` from 1 to 0 and back), so it follows the
  camera exactly while docked and flies free in between.
- Only dock while the camera has no rotation (projection is then just scale + translate).
- Visual handoff from a world element to the screen element happens on a frame where they are
  pixel-identical (same rect, same content).
- Chrome (title bar, padding, radius) grows and shrinks as `track()`s of its own, so the object
  becomes a window and stops being one without a swap.

## Content swaps

Variant switches cross behind a short blur: the incoming look sharpens from 12 px on `snappy`
while the outgoing one blurs out underneath it (it stays opaque underneath, so the background never
flashes through). Footage in all variants shares one playhead, so a switch never jumps the content.

## Camera

- `default` springs on scale, rotations and focus point, one key per shot. Big moves (zoom to a
  toolbar button) take two beats; never more than one camera target per beat.
- Use full 3D (`preserve-3d`) only while something actually leaves the plane; flat otherwise. It
  renders the same and is several times cheaper.

## Visibility windows

Hide an element only after its spring has settled: windows are `[start, end + settle(preset)]`,
never a hard-coded few hundredths. When presets change, these must follow, so derive them from
`settle()`.

## Results come from the click

The result of a click appears **from the click point**, not from a screen edge: a generated file
jumps out of the button that made it (scale from ~0.15 at the cursor tip, an arc of ~110 px on a
default spring, settling just beside the button), then clears before the next move. A generic
corner toast was rejected on GreenSage ("doesn't look good; make it jump in from the click").
