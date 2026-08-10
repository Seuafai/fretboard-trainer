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
