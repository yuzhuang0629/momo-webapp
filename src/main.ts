import './styles.css';
import type {EngineInput} from './contracts';
import {readDirectorOptions} from './engine/director';
import {createEngine} from './engine/engine';
import {SCRIPT} from './engine/script';
import {createScene} from './scene/index';
import {createVoice} from './voice';

const FRAME_MS = 1000 / 30; // the panel is 30 Hz; never run a 60 fps loop
const MAX_STEP_MS = 50; // matches the spring integrator's dt cap

const canvas = document.getElementById('lens') as HTMLCanvasElement;
const hit = document.getElementById('hit') as HTMLButtonElement;
const ctx = canvas.getContext('2d', {alpha: false});
if (!ctx) throw new Error('2D canvas unavailable');

const director = readDirectorOptions(location.search);
const voice = createVoice(director.voice);
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
    say: text => voice.say(text),
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

let firstPinch = true;
hit.addEventListener('click', () => {
  voice.unlock(engine.step);
  void keepDisplayAwake();
  if (engine.phase === 'SAFE_IDLE') {
    engine.start();
    return;
  }
  // "Take a moment." belongs to the start screen, but sound is only allowed from the wearer's
  // first pinch, which is the pinch that leaves it. Say it then: the logo's exit and the black
  // hold take 3 s before #3's first line, so it fits (speech if the clip isn't down in 1.2 s).
  const onStartScreen = firstPinch && engine.step === 2;
  firstPinch = false;
  send('Select');
  if (onStartScreen) voice.sayWhenReady(SCRIPT.BEGIN, 1200);
});

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
  } else {
    startLoop();
    if (sessionEntry) void keepDisplayAwake();
  }
});

hit.focus();
engine.start();
scene.draw(ctx);
startLoop();
