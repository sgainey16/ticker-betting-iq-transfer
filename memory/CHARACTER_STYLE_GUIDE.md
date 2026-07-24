# The Ticker · Character Style Guide

Paste the following prompt into ChatGPT (or Midjourney, Nano Banana, etc.)
when generating new contact sheets so every expression matches Reggie's and
Marc's canonical hero art exactly.

---

## 1. Universal style anchor (always include)

> **Style:** 3D stylized cartoon portrait, painterly Pixar-adjacent shading,
> warm skin tones with saturated highlights, expressive oversized features,
> soft rim light. Same character identity as the reference image — face
> shape, hair, wardrobe, and studio backdrop MUST match exactly. Framing:
> waist-up press-conference shot, character centered, small tabletop
> microphone with THE TICKER shield logo in the lower-third foreground.
> Studio backdrop: dark navy blue with repeating "THE TICKER · AI SPORTS
> NETWORK" wordmark and blue shield logo pattern behind them. Broadcast key
> light from front-left, cinematic rim from back-right.

**Always attach `reggie_hero_crop.png` or `marc_hero_crop.png` as the
reference image** so the model locks the identity.

---

## 2. Character bibles

### REGGIE BANKS — Lead Anchor · Ex-NHL
- Late 20s, athletic build
- Short spiky brown hair swept back, thick dark eyebrows, blue eyes
- Trimmed dark stubble, angular jaw
- Wardrobe: dark navy blazer over crisp white shirt, dark burgundy tie
- Confident, playful energy; chirper personality

### MARC COLLINS — Analytics Co-Host
- 60 years old, warm and paternal
- Full wavy silver-gray hair
- Thick bushy silver-gray handlebar mustache
- Warm brown eyes with laugh lines, ruddy pinkish complexion
- Wardrobe: dark royal-blue blazer over white shirt, dotted navy tie
- Calm, professorial, measured

---

## 3. Contact-sheet layout instructions

> Please arrange 20 portraits of {character} in a single image, laid out as
> a **5-column × 4-row** grid (landscape orientation, roughly 1536×1024).
> Each cell should be labeled at the top with a small dark badge showing
> the number and shot name. **DO NOT vary the character, wardrobe, or
> backdrop between cells** — only the pose and facial expression change.

### Reggie & Marc solo — 20 expressions each (SAME NAMES for both hosts)

1. `neutral`           — calm at the desk, mouth closed, gentle smile, hands folded
2. `explaining`        — mid-sentence, one hand open in gesture, engaged eye contact
3. `pointing`          — index finger pointing at camera, confident stance
4. `leaning`           — leaning forward on the desk, elbow down, animated
5. `hands-open`        — both palms up in an "obviously" gesture
6. `counting`          — one hand with 2 fingers up as if counting reasons
7. `looking-notes`     — head down, glancing at a stat sheet on the desk
8. `looking-monitor`   — head turned slightly, looking at a monitor off-camera
9. `listening-off`     — head turned right, listening to the other host off-camera
10. `skeptical`        — one eyebrow arched, mouth pulled to one side
11. `smirking`         — slight smirk, tilted head, mischievous
12. `laughing`         — full laugh, mouth open showing teeth, eyes crinkled
13. `yelling`          — mouth wide, arm raised, big reaction (goal call energy)
14. `disappointed`     — head shake, mouth flat, brow furrowed
15. `serious`          — cold stare into camera, mouth firm
16. `chirping`         — mid-chirp, mouth open, cocky smirk
17. `celebrating`      — arm raised in fist pump / applause
18. `thinking`         — hand on chin, contemplative
19. `hot-take`         — index finger raised, hot-take gesture, intense
20. `mic-drop`         — signature signoff, warm big smile at the desk

### Together (two-shot) — 20 arrangements

Framing: Reggie on the LEFT half, Marc on the RIGHT half. Both visible
waist-up. Same backdrop and desk continuity.

1. `neutral-open`         — both looking at camera, calm intro pose
2. `cold-open`            — opening beat, both leaning in, mid-conversation
3. `panel-wide`           — clean wide two-shot, both engaged with each other
4. `side-two-shot`        — 3/4 profile of both, side view
5. `reggie-leads`         — Reggie speaking, Marc listening intently
6. `marc-leads`           — Marc speaking, Reggie listening intently
7. `friendly-debate`      — animated back-and-forth, warm energy
8. `arguing`              — Reggie pointing at Marc, Marc protesting
9. `hot-take-clash`       — both leaning in with strong opinions
10. `in-agreement`        — Marc nodding, Reggie gesturing "exactly!"
11. `serious-analysis`    — both looking at monitor, focused
12. `reviewing-tape`      — both looking down at a stat sheet
13. `looking-at-monitor`  — both turned slightly, watching a replay
14. `both-thinking`       — both with hands on chins
15. `both-pointing`       — both pointing at each other, playful accusation
16. `shocked`             — jaw-drop reaction from both
17. `laughing`            — both cracking up, big smiles
18. `celebrating`         — both cheering / high-fiving
19. `punchline`           — Reggie delivering joke, Marc losing it laughing
20. `signoff`             — both waving off-camera, warm end-of-show

---

## 4. Slicing back into the app

Once ChatGPT delivers a sheet, save it to `/app/backend/scripts/` and run:

```bash
# Reggie / Marc solos (either portrait or landscape sheet accepted)
python3 /app/backend/scripts/slice_contact_sheet.py reggie /app/backend/scripts/reggie_contact_sheet.png
python3 /app/backend/scripts/slice_contact_sheet.py marc   /app/backend/scripts/marc_contact_sheet.png

# Two-shots
python3 /app/backend/scripts/slice_contact_sheet.py together /app/backend/scripts/together_contact_sheet.png
```

Files land in `/app/backend/static/hosts/expressions/<host>/<slug>.png` and
the desk system picks them up automatically — no other code changes needed.
Verify visually at `https://<preview-url>/desk-preview`.
