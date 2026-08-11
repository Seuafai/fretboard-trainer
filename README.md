# Fretboard Trainer

A guitar fretboard note-learning app: a visual tuner, and a "Find It"
drill with two inputs — play a note on each string by ear through the
mic, or click where it lives on the highlighted string.

## Run it locally

```bash
npm install
npm run dev
```

Then open the local URL it prints (usually http://localhost:5173).
Microphone features need `localhost` or `https` — both are fine, but
plain `http` on a non-localhost address will block mic access in most
browsers.

## Put it on GitHub

```bash
cd fretboard-trainer
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

(Create the empty repo on GitHub first — github.com → New repository —
then use the URL it gives you in place of the one above.)

## Deploy it so you can use it on your phone

Any static host works since this builds to plain HTML/JS/CSS. Two easy options:

### Option A — GitHub Pages
```bash
npm install
npm run build
npm run deploy
```
This pushes the `dist/` folder to a `gh-pages` branch. Then in your
GitHub repo: **Settings → Pages → Source → gh-pages branch**. Your
app will be live at `https://<your-username>.github.io/<repo-name>/`.

### Option B — Vercel or Netlify (usually simpler)
Go to vercel.com or netlify.com → "Import project" → pick your GitHub
repo. Both auto-detect Vite, run `npm run build`, and deploy — no
commands needed on your end. Every future `git push` auto-redeploys.

## Notes

- Tuning and quiz stats are saved in the browser's `localStorage`, so
  they're per-device/per-browser, not synced across devices.
- The mic-based "Find It" mode and the Tuner both need microphone
  permission — the browser will prompt for it the first time.
- Scales are spelled the way they're written in the key: each degree of a
  7-note scale gets its own letter (D minor → `D E F G A B♭ C`, not
  `D E F G A A♯ C`), pentatonic/blues/arpeggio notes get the natural
  letter they sit nearest in the key's direction (`G blues` → `G B♭ C D♭
  D F`), and the spelling direction switches so no double accidentals
  ever appear (C♯ minor → `C♯ D♯ E F♯ G♯ A B`, never `D♭ E♭ F♭ G♭ A♭
  B♭♭ C♭`). The notation view renders those spellings on the staff, with
  the root/3rd/5th coloured to match the fretboard highlight.
- The app is fully offline-capable: notes are synthesized in-browser via
  the Web Audio API (no samples), and the fonts are bundled locally, so
  nothing is fetched from the network once the page has loaded.
- The Scales page can auto-scroll the neck to follow the note being
  played or heard, and the layout widens into a fretboard-first view on
  landscape / desktop screens (the settings panel collapses to save
  height).
