import './styles.css';
import type {EngineInput} from './contracts';
import {readDirectorOptions} from './engine/director';
import {createEngine} from './engine/engine';
import {SCRIPT} from './engine/script';
import {createScene} from './scene/index';
import {createMusic} from './music';
import {createSfx} from './sfx';
import {createVoice} from './voice';

const FRAME_MS = 1000 / 30; // the panel is 30 Hz; never run a 60 fps loop
const MAX_STEP_MS = 50; // matches the spring integrator's dt cap
/** How long the lens background takes to fade between levels. */
const BG_FADE_MS = 1500;

// Phone-browser preview: on a screen smaller than the 600×600 lens, styles.css zooms #root by --fit so
// the whole lens shows. Judged from the physical screen (the page width a phone reports can grow to
// fit the 600 px lens); the glasses' 600×600 screen and desktops stay at 1.
function fitToScreen(): void {
  const fit = Math.min(1, screen.width / 600, screen.height / 600);
  const root = document.documentElement;
  root.classList.toggle('phone', fit < 1);
  root.style.setProperty('--fit', fit.toFixed(4));
}
fitToScreen();
window.addEventListener('resize', fitToScreen);

const canvas = document.getElementById('lens') as HTMLCanvasElement;
const hit = document.getElementById('hit') as HTMLButtonElement;
const ctx = canvas.getContext('2d', {alpha: false});
if (!ctx) throw new Error('2D canvas unavailable');

const director = readDirectorOptions(location.search);
const music = createMusic(director.music, '/music/cosmic_heart.mp3');
const voice = createVoice(director.voice, speaking => music.duck(speaking));
// The bead click (#5) shares the voice switch, as on Android (AudioPlayer.beadClick).
const sfx = createSfx(director.voice);
// Text is drawn into the canvas: wait for Elms Sans before creating the scene, so its text
// sprites bake with the real font on the first frame (no fallback flash, no cold bake later).
await Promise.all([
  document.fonts.load('300 32px "Elms Sans"'),
  document.fonts.load('400 40px "Elms Sans"'),
]).catch(() => undefined);
const scene = createScene();
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
scene.reducedMotion = reducedMotion.matches;
reducedMotion.addEventListener('change', () => (scene.reducedMotion = reducedMotion.matches));

const engine = createEngine(
  {
    show: card => scene.apply(card),
    // "Take a moment." comes right at the first pinch: give its clip a moment to finish
    // downloading if the preload hasn't, then fall back to speech (the start screen holds 2 s).
    say: text => (text === SCRIPT.BEGIN ? voice.sayWhenReady(text, 600) : voice.say(text)),
    click: () => sfx.click(),
    music: level => music.level(level),
    background: opacity => scene.setBackground(opacity, BG_FADE_MS),
    ripple: () => scene.ripple(),
    log: message => console.info(`[momo] ${message}`),
  },
  director,
);

// Back = QuickExit. The app pushes exactly one history entry when a session starts, so the
// glasses' Back gesture lands on popstate instead of closing the app.
let sessionEntry = false;
history.replaceState({screen: 'start'}, '');

function send(input: EngineInput): void {
  if (input === 'Select' && !sessionEntry && engine.phase !== 'SAFE_IDLE') {
    history.pushState({screen: 'session'}, '');
    sessionEntry = true;
  }
  engine.input(input);
}

hit.addEventListener('click', () => {
  voice.unlock(engine.step);
  sfx.unlock();
  music.unlock();
  void keepDisplayAwake();
  if (engine.phase === 'SAFE_IDLE') {
    engine.start();
    return;
  }
  send('Select');
});

// Fetch the first lines while the start screen waits (no sound before a pinch), so "Take a
// moment." can play the instant the wearer pinches. Delayed past the first-load window.
window.setTimeout(() => voice.preload([SCRIPT.BEGIN, SCRIPT.SIT_DOWN, SCRIPT.SUPPORT]), 2500);

hit.addEventListener('keydown', event => {
  const input: EngineInput | null =
    event.key === 'ArrowLeft' || event.key === 'ArrowUp'
      ? 'Previous'
      : event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 'Next'
        : null;
  if (input) {
    event.preventDefault();
    engine.input(input);
  } else if (event.key === 'Escape' && sessionEntry) {
    event.preventDefault();
    history.back();
  }
});

window.addEventListener('popstate', () => {
  if (sessionEntry) {
    sessionEntry = false;
    engine.input('QuickExit');
  }
  hit.focus();
});

// The wake lock is undocumented on the glasses; harmless where unsupported.
let wakeLock: WakeLockSentinel | null = null;
async function keepDisplayAwake(): Promise<void> {
  if (wakeLock) return;
  try {
    wakeLock = (await navigator.wakeLock?.request('screen')) ?? null;
    wakeLock?.addEventListener('release', () => (wakeLock = null));
  } catch {
    wakeLock = null;
  }
}

// One virtual clock: real dt × director speed, fed identically to the engine and the scene.
let rafId = 0;
let last = 0;
function frame(now: number): void {
  rafId = requestAnimationFrame(frame);
  const elapsed = now - last;
  if (elapsed < FRAME_MS - 2) return;
  last = now;
  // Above 1× the scaled dt can exceed the springs' 50 ms cap, so advance in ≤ 50 ms slices to
  // keep the engine and the scene on the same clock.
  let remaining = Math.min(elapsed, MAX_STEP_MS) * director.speed;
  while (remaining > 0) {
    const dt = Math.min(remaining, MAX_STEP_MS);
    engine.tick(dt);
    scene.step(dt);
    remaining -= dt;
  }
  scene.draw(ctx!);
}

function startLoop(): void {
  if (rafId) return;
  last = performance.now();
  rafId = requestAnimationFrame(frame);
}

function stopLoop(): void {
  cancelAnimationFrame(rafId);
  rafId = 0;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopLoop();
    voice.stop();
    music.setHidden(true);
  } else {
    startLoop();
    music.setHidden(false);
    if (sessionEntry) void keepDisplayAwake();
  }
});

hit.focus();
engine.start();
scene.draw(ctx);
startLoop();
