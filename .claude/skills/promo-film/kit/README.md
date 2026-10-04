# Kit

Copy into a new film project as a starting point:

```
cp -r kit/* <project>/ && cd <project>
npm init -y && npm i playwright@<version matching the installed Chromium>
cp timeline.example.json timeline.json      # then re-time it for your storyboard
python3 audio/score.py                       # -> audio/score.wav, beats.json
# write film.html (+ film.js): window.seek, prepare, LOOP, BEAT_TIMES, filmReady
node render.mjs --contact                    # look at it
node tools/strip.mjs 5.3 6.3 8               # look at every transition
node render.mjs --out <name>                 # -> out/<name>.mp4
```

`prep.mjs` is optional: it reads a `footage.json` of the form
`{ "looks": { key: file, ... }, "hero": file, "replay": { "useFrom", "useTo", "skip" } }`
and extracts frames to `build/frames/<key>/`. Adapt it to the footage your film needs, and call
it from `render.mjs` (the copy here already does) or remove that call.
