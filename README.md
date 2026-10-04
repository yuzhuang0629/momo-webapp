# Momo — lens demo (Meta Ray-Ban Display Web App)

A web replica of what the wearer sees in the lens during a Momo session (three calm minutes
before a job interview). It exists to record the demo video; the real product is the Android
app in `momo-android`. No camera, no AI calls: the "find three things" results are presets.

Runs on Meta Ray-Ban Display glasses as a [Web App](https://wearables.developer.meta.com/docs/develop/webapps/)
(600×600 additive display, black = see-through, 30 Hz). Vanilla TypeScript + one 2D canvas;
the lens text is real text in Elms Sans (self-hosted, OFL).

## Run locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build && npm run preview -- --host 127.0.0.1 --port 4173
```

Preview in desktop Chrome with the
[Meta Ray-Ban Display Simulator](https://chromewebstore.google.com/detail/jpjlmmodokemlepklkdbimceggpbjcll)
extension. Keys: **Enter** = pinch (Select), **arrows** = swipe (Previous / Next),
**Escape** = Back (quick exit).

## Recording controls (URL parameters, never drawn on the lens)

| Parameter | Effect |
|---|---|
| `?speed=0.5` | Virtual-time multiplier (0.1–4) |
| `?step=7` | Start at USER_FLOW step 7 |
| `?autostart=1` | Skip the start screen wait |
| `?preset=b` | Which preset items "find three" shows (default `d`: one white item → temperature) |
| `?sense=scent` | Sense branch after the third item (`scent` / `temperature`) |
| `?voice=0` | Mute the spoken guidance |
| `?sim=1` | Simulated wearer's view over a photo, plays by itself and replays (for phones / desktop) |
| `?seed=7` | Seed for the guiding light's random route in #10 (default `1`); the same URL gives the same route on every take |

## Deploy

Public GitHub repo → Vercel Git import (Vite preset). Give the glasses the **production**
domain only (preview URLs sit behind Vercel login). Add it in the Meta AI app:
App Settings → Apps → Web Apps → Connect Web App. After a redeploy, middle-pinch → Restart.

## Record on the glasses

Meta AI app → Devices → your glasses → Record Display (or the glasses settings pane →
Display Recording). Each clip is at most 1 minute and includes the camera view and audio.
For a clean lens-only layer, record this page in Chrome on a black background and
composite it over POV footage with a Screen/Add blend.

## QR codes

- `qr/momo-install-qr.png`: scan with the phone camera to add Momo to the glasses (Meta's install
  link `fb-viewapp://web_app_deep_link?appName=Momo&appUrl=https%3A%2F%2Fmomo-webapp.vercel.app%2F`;
  Developer Mode must be on in the Meta AI app). A plain URL QR is not recognised for installing.
- `qr/momo-url-qr.png`: the plain URL, for opening the preview in a phone or desktop browser.
- `qr/momo-sim-qr.png`: `?sim=1`, the simulated wearer's view: the lens over a desk photo through a
  glasses frame, playing by itself on a loop (for people without the glasses).
