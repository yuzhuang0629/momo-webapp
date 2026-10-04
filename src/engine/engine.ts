// The session director for USER_FLOW v2.1. Port of momo-android session/SessionEngine.kt
// (snapshot 21:06). Every step is timed and also ends early on a pinch; nothing waits for
// confirmation. QuickExit and Stop cancel the script and run their own short ending.
//
// Web differences: no camera/AI (the find-three result is the director's preset, available at
// once), no balance check, haptics, heartbeat or music (phone-only), one virtual clock that only
// moves in tick(dtMs), and a seeded PRNG (?seed) in place of kotlin.random.Random so the gaze route
// is the same on every take.
import type {BreathPhase, GlassCard, SenseKind} from '../cards';
import type {DirectorOptions, EngineHost, EngineInput, SessionEngine} from '../contracts';
import {DEFAULT_CONFIG, RECONNECT_STEP_NUMBER, RECONNECT_STEPS, scaled, type SessionConfig} from './config';
import {colorAt, labelAt, presetById} from './presets';
import {CAPTION_OFF, LENS, reconnectMeta, SCRIPT} from './script';

/** Session states (SessionState.kt). */
export type Phase = 'IDLE' | 'PAUSE' | 'RECONNECT' | 'REENTER' | 'END' | 'QUICK' | 'SAFE_IDLE';

const isActive = (p: Phase): boolean => p !== 'IDLE' && p !== 'SAFE_IDLE';
const isEnding = (p: Phase): boolean => p === 'END' || p === 'QUICK';

const FIRST_STEP = 2;
const LAST_STEP = 12;

/** mulberry32: a tiny seeded PRNG; returns floats in [0, 1) like kotlin.random.Random.nextFloat(). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- coroutine runner
//
// Kotlin's suspend functions become generators: a script yields a Suspend ("wait ms for one of
// these inputs") and is resumed with the input that ended the wait, or null on timeout. The
// runner resumes it synchronously inside tick()/input(), with `now` set exactly to the deadline,
// so waits chain without drift and cards land in the same frame as their timer. Cancelling (=
// Kotlin job.cancel()) just drops the generator after running its finally blocks.

/** One suspension: wait `ms` (already scaled) for one of `kinds`. No kinds = plain delay. */
interface Suspend {
  readonly ms: number;
  readonly kinds: readonly EngineInput[];
}

type Co<T = void> = Generator<Suspend, T, EngineInput | null>;

class Runner {
  /** Virtual time in ms; only tick() moves it. */
  now = 0;
  private job: Co | null = null;
  private executing: Co | null = null;
  private deadline = Infinity;
  private kinds: readonly EngineInput[] = [];

  launch(job: Co): void {
    this.cancel();
    this.job = job;
    this.resume(null);
  }

  cancel(): void {
    const job = this.job;
    this.job = null;
    this.kinds = [];
    this.deadline = Infinity;
    // A generator cannot be closed while it is running; resume() closes it when it yields.
    if (job && job !== this.executing) job.return();
  }

  /** Hands an input to the current waiter. Inputs nobody is waiting for are dropped (SE:91-96). */
  deliver(input: EngineInput): void {
    if (!this.job || !this.kinds.includes(input)) return;
    this.kinds = [];
    this.resume(input);
  }

  tick(dtMs: number): void {
    if (!(dtMs > 0)) return;
    const target = this.now + dtMs;
    while (this.job && this.deadline <= target) {
      this.now = this.deadline;
      this.kinds = [];
      this.resume(null);
    }
    this.now = target;
  }

  private resume(value: EngineInput | null): void {
    const job = this.job;
    if (!job) return;
    const outer = this.executing;
    this.executing = job;
    let r: IteratorResult<Suspend, void>;
    try {
      r = job.next(value);
    } catch (e) {
      if (this.job === job) this.job = null;
      throw e;
    } finally {
      this.executing = outer;
    }
    if (this.job !== job) {
      job.return(); // cancelled (or replaced) while it ran
      return;
    }
    if (r.done) {
      this.job = null;
      this.deadline = Infinity;
      return;
    }
    this.deadline = this.now + r.value.ms;
    this.kinds = r.value.kinds;
  }
}

// ---------------------------------------------------------------- the engine

export function createEngine(host: EngineHost, opts: DirectorOptions, config: SessionConfig = DEFAULT_CONFIG): SessionEngine {
  const t = config.timings;
  const run = new Runner();
  // Kotlin asks the AI during #4 and falls back to a random preset; the web app fixes the set up
  // front so jumping straight to #7 or #8 shows the same items and branch.
  const findSet = presetById(opts.preset);
  const sense: SenseKind = opts.sense ?? (findSet.touchTargetHasSmell ? 'SCENT' : 'TEMPERATURE');

  // Re-seeded at every launch, so a restart or a director jump replays the same direction.
  let random = seededRandom(opts.seed);
  let phase: Phase = 'IDLE';
  let step = 0;
  let startedAt = 0;

  // ---- plumbing

  const s = (ms: number): number => scaled(config, ms);

  function log(message: string): void {
    const elapsed = Math.max(0, run.now - startedAt);
    const mm = String(Math.floor(elapsed / 60_000)).padStart(2, '0');
    const ss = ((elapsed % 60_000) / 1000).toFixed(3).padStart(6, '0');
    host.log(`${mm}:${ss}  ${message}`);
  }

  function setPhase(next: Phase): void {
    if (next !== phase) log(`${phase} → ${next}`);
    phase = next;
  }

  function setStep(n: number, name: string): void {
    step = n;
    log(`#${n} ${name}`);
  }

  const show = (card: GlassCard): void => host.show(card);
  const say = (line: string): void => host.say(line);

  /** Waits for one of `kinds` or the scaled timeout; null on timeout (SE:99-107). */
  function* waitFor(ms: number, ...kinds: EngineInput[]): Co<EngineInput | null> {
    return yield {ms: s(ms), kinds};
  }

  /** Uninterruptible delay: pinches during it are dropped (SE:121). */
  function* pause(ms: number): Co {
    yield {ms: s(ms), kinds: []};
  }

  /** Waits for a pinch; true if the user pinched (logged like Kotlin's haptic TICK). */
  function* pinch(ms: number, note = 'pinch → next'): Co<boolean> {
    const pinched = (yield* waitFor(ms, 'Select')) !== null;
    if (pinched) log(note);
    return pinched;
  }

  /** Show `card`, say `line`, then wait `ms` or until a pinch (SE:110-116). */
  function* hold(card: GlassCard, line: string | null, ms: number): Co<boolean> {
    show(card);
    if (line !== null) say(line);
    return yield* pinch(ms);
  }

  // ---- the flow (SE:157-362); `from` starts at the beginning of that USER_FLOW step

  function* session(from: number, autostart: boolean): Co {
    if (from <= 4) yield* pauseStage(from, autostart);
    if (from <= 10) yield* reconnectStage(from);
    if (from <= 11) yield* reenterStage();
    yield* endCompanionship();
  }

  // PAUSE (#2–#4)

  function* pauseStage(from: number, autostart: boolean): Co {
    setPhase('PAUSE');
    if (from <= 2) yield* startScreen(autostart);
    if (from <= 3) {
      setStep(3, 'feel the support');
      yield* feelSupport(true);
    }
    setStep(4, 'breathing');
    yield* breathe(2);
  }

  /** #2 The logo draws in; pinch starts (or it starts by itself), then it un-draws and fades. */
  function* startScreen(autostart: boolean): Co {
    setStep(2, 'start screen');
    show({kind: 'Intro', merging: false, durationMs: s(t.introOpen), fadeOutMs: 0});
    say(SCRIPT.BEGIN);
    // Director ?autostart: leave as soon as the logo has drawn in instead of waiting for a pinch.
    const wait = autostart ? t.introOpen : t.introAutoStart;
    yield* pinch(wait, 'pinch → start');
    show({kind: 'Intro', merging: true, durationMs: s(t.introMerge), fadeOutMs: s(t.introFade)});
    yield* pause(t.introMerge + t.introFade + t.introGap);
  }

  /** #3 One timeline: stand → sit under "Slowly Sit Down", then the support ring. Pinch ends the step. */
  function* feelSupport(sitFirst: boolean): Co {
    const total = (sitFirst ? t.supportSit : 0) + t.supportRings;
    show({kind: 'Support', sitFirst, durationMs: s(total)});
    if (sitFirst) {
      say(SCRIPT.SIT_DOWN);
      if (yield* pinch(t.supportSit)) return;
    }
    say(SCRIPT.SUPPORT);
    yield* pinch(t.supportRings);
  }

  /** #4 Intro (silent), then n cycles, one recorded line per cycle; any pinch ends all of breathing (SE:198-216). */
  function* breathe(n: number): Co {
    show({kind: 'Breath', breaths: n, durationMs: s(t.breathIntro)});
    if (yield* pinch(t.breathIntro, 'pinch → skip breathing')) return;
    const pattern = config.breathing;
    const seq: ReadonlyArray<readonly [BreathPhase, number]> =
      pattern === 'CALM'
        ? [['INHALE', t.calmIn], ['EXHALE', t.calmOut]]
        : pattern === 'CYCLIC_SIGH'
          ? [['INHALE', t.sighIn], ['TOP_UP', t.sighTopUp], ['EXHALE', t.sighOut]]
          : [['INHALE', t.countIn], ['HOLD', t.countHold], ['EXHALE', t.countOut]];
    for (let i = 0; i < n; i++) {
      for (const [p, ms] of seq) {
        show({
          kind: 'BreathStep',
          phase: p,
          durationMs: s(ms),
          index: i,
          total: n,
          countHold: pattern === 'COUNT_HOLD',
          topUp: pattern === 'CYCLIC_SIGH',
        });
        // One recorded line per cycle ("…breathe in… and breathe out"), as the inhale starts.
        if (p === 'INHALE') say(i === 0 ? SCRIPT.BREATH_1 : SCRIPT.BREATH_2);
        if (yield* pinch(ms)) return;
      }
    }
  }

  // RECONNECT (#5–#10)

  function* reconnectStage(from: number): Co {
    setPhase('RECONNECT');
    const order = RECONNECT_STEPS.filter(x => config.steps.has(x));
    for (let i = 0; i < order.length; i++) {
      const which = order[i];
      if (RECONNECT_STEP_NUMBER[which] < from) continue;
      const meta = reconnectMeta(i + 1, order.length);
      switch (which) {
        case 'BEADS':
          yield* beads(meta);
          break;
        case 'FINGERS':
          setStep(6, 'fingers');
          // Figma 5.0 → 5.3 → 5.1: the thumb rubs the bracelet twice, then the caption page.
          yield* hold({kind: 'Fingers', durationMs: s(t.fingers)}, SCRIPT.FINGERS, t.fingers);
          break;
        case 'FIND_THREE':
          yield* findThree();
          break;
        case 'TOUCH':
          yield* touch();
          break;
        case 'LISTEN':
          setStep(9, 'listen');
          // A first line, then the second after listenSecondLine unless the wearer pinched (SE:240-245).
          show({kind: 'SoundRings', prompt: LENS.LISTEN_PROMPT, title: LENS.LISTEN_TITLE, meta});
          say(SCRIPT.LISTEN);
          if (!(yield* pinch(t.listenSecondLine))) {
            say(SCRIPT.JUST_NOTICE);
            yield* pinch(t.listen - t.listenSecondLine);
          }
          break;
        case 'EXPAND_VIEW':
          yield* expandView(meta);
          break;
      }
    }
  }

  /**
   * #5 Virtual bracelet (Figma 4.0): fades in and waits still; swipes turn beads (down = like the
   * frame's arrow); auto-turns when idle (SessionEngine, Android 21:12).
   */
  function* beads(meta: string): Co {
    setStep(5, 'beads');
    const goal = config.beadsToTurn;
    const card = (turned: number, dir: number, guide = false): GlassCard =>
      ({kind: 'Beads', turned, total: goal, dir, guide, meta});
    say(SCRIPT.BEADS);
    // The bracelet fades in and waits still (Figma 4.0); a thumb swipe down turns one bead down,
    // as the frame's arrow shows. No demo turns (Android 21:12).
    let turned = 0;
    show(card(0, 1));
    const budget = s(t.beads);
    const startedAtMs = run.now;
    let sinceSwipe = 0;
    while (turned < goal) {
      const elapsed = run.now - startedAtMs;
      if (elapsed >= budget) break;
      // SE:265: the remaining budget is unscaled again because waitFor scales it.
      const wait = Math.min(t.beadAutoEvery, Math.max(1, Math.trunc((budget - elapsed) / config.timeScale)));
      const got = yield* waitFor(wait, 'Select', 'Next', 'Previous');
      if (got === 'Select') {
        log('pinch → next');
        return;
      } else if (got === 'Previous' || got === 'Next') {
        turned++;
        sinceSwipe = 0;
        show(card(turned, got === 'Previous' ? -1 : 1));
      } else {
        // No swipe (or no Neural Band): after 6 s idle, turn one bead per 2.5 s timeout so the
        // user can just watch and count. Auto turns do not reset the idle counter (SE:270-274).
        sinceSwipe += t.beadAutoEvery;
        if (sinceSwipe >= t.beadIdleBeforeAuto) {
          turned++;
          show(card(turned, 1));
        }
      }
    }
    log(`beads turned: ${turned}`);
  }

  /** #7 Three things by feature: LOOK → NOTICE (tinted circle) → ITEM (cup) per item (SE:306-322). */
  function* findThree(): Co {
    setStep(7, `find three (${findSet.name})`);
    // Per item (Android 21:54): 6.1 "Take a look around you." → 6.2 "Notice its color…" → 6.3 "Find one object nearby."
    for (let i = 0; i < findSet.features.length; i++) {
      const label = labelAt(findSet, i);
      const colorHex = colorAt(findSet, i);
      const total = findSet.features.length;
      show({kind: 'Find', stage: 'LOOK', label, colorHex, index: i, total});
      say(SCRIPT.LOOK_AROUND);
      yield* pinch(t.findLook, 'pinch → notice');
      show({kind: 'Find', stage: 'NOTICE', label, colorHex, index: i, total});
      say(SCRIPT.NOTICE_OBJECT); // the lens names the feature ("Notice the White Item Nearby.")
      if (yield* pinch(t.findNotice, 'pinch → next item')) continue;
      show({kind: 'Find', stage: 'ITEM', label, colorHex, index: i, total});
      say(SCRIPT.FIND_OBJECT);
      yield* pinch(t.findItem, 'pinch → next item');
    }
  }

  /**
   * #8 Scent or temperature (SE:329-337). Kotlin passes #7's vision result; here it is the preset.
   * The recording is the same for both branches; the lens says which. A pinch skips the second line.
   */
  function* touch(): Co {
    setStep(8, `touch → ${sense === 'SCENT' ? 'smell' : 'temperature'}`);
    show({kind: 'Sense', sense});
    say(SCRIPT.TOUCH);
    if (yield* pinch(t.senseSecondLine)) return;
    say(SCRIPT.TAKE_YOUR_TIME);
    yield* pinch(t.sense - t.senseSecondLine);
  }

  /**
   * #10 Figma 9.1: the light leaves its home once, slowly, in a random direction (one slow head
   * turn), rests there, then fades. A pinch only cuts the wait short (SE:340-351).
   */
  function* expandView(meta: string): Co {
    setStep(10, 'expand view');
    say(SCRIPT.GAZE);
    const angleDeg = random() * 360;
    log(`light → ${angleDeg.toFixed(1)}°`);
    show({kind: 'Gaze', target: 'AWAY', instruction: '', meta, angleDeg});
    yield* pinch(t.gazeMove + t.gazeHold);
    show({kind: 'Gaze', target: 'GONE', instruction: '', meta});
    yield* pause(t.fade);
  }

  // RE-ENTER (#11) and END (#12)

  function* reenterStage(): Co {
    setPhase('REENTER');
    setStep(11, 'get comfortable');
    show({kind: 'Text', title: LENS.COMFORTABLE_TITLE, subtitle: LENS.COMFORTABLE_SUB, pose: 'Orb', obj: 'Stem', over: LENS.REENTER_META});
    say(SCRIPT.COMFORTABLE);
    if (yield* pinch(t.comfortableSecondLine)) return;
    say(SCRIPT.CHECK_CAMERA);
    yield* pinch(t.comfortable - t.comfortableSecondLine);
  }

  function* endCompanionship(): Co {
    setPhase('END');
    setStep(12, 'end');
    show({kind: 'Text', title: LENS.END_TITLE, subtitle: LENS.END_SUB, pose: 'Seed'});
    say(SCRIPT.END);
    yield* pause(t.end);
    show({kind: 'Off'});
    yield* pause(t.fade);
    safeIdle();
  }

  // ---- endings

  function* quickExit(): Co {
    setPhase('QUICK');
    say(SCRIPT.QUICK);
    show({kind: 'Text', title: LENS.QUICK_TITLE, subtitle: null, pose: 'Exhale'});
    yield* pause(t.quick);
    show({kind: 'Off'});
    yield* pause(t.fade);
    safeIdle();
  }

  function stopNow(): void {
    log('Stop → end now');
    run.cancel();
    show({kind: 'Off'});
    safeIdle();
  }

  /** Every ending lands here. Kotlin's releaseAll() also stops speech (SE:388-397). */
  function safeIdle(): void {
    say('');
    setPhase('SAFE_IDLE');
    show({kind: 'Blank'});
    log(`released · caption "${CAPTION_OFF}"`);
  }

  // ---- public API

  function launchAt(from: number, autostart: boolean): void {
    run.cancel();
    phase = 'IDLE';
    step = 0;
    startedAt = run.now;
    random = seededRandom(opts.seed);
    run.launch(session(from, autostart));
  }

  const clampStep = (n: number): number =>
    Number.isFinite(n) ? Math.min(LAST_STEP, Math.max(FIRST_STEP, Math.trunc(n))) : FIRST_STEP;

  return {
    get phase(): string {
      return phase;
    },
    get step(): number {
      return step;
    },

    start(): void {
      if (isActive(phase)) return;
      const from = clampStep(opts.step ?? FIRST_STEP);
      host.log(`start at #${from} · preset ${findSet.id} · sense ${sense} · seed ${opts.seed}${opts.autostart ? ' · autostart' : ''}`);
      launchAt(from, opts.autostart);
    },

    input(input: EngineInput): void {
      if (!isActive(phase) || isEnding(phase)) return;
      if (input === 'QuickExit') {
        log('Back → QuickExit');
        run.launch(quickExit());
      } else if (input === 'Stop') {
        stopNow();
      } else {
        if (input === 'Select') host.ripple();
        run.deliver(input);
      }
    },

    tick(dtMs: number): void {
      run.tick(dtMs);
    },

    jumpTo(target: number): void {
      const from = clampStep(target);
      host.log(`director: jump to #${from}`);
      launchAt(from, false);
    },
  };
}
