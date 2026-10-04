// The lens scene: TypeScript port of momo-android glasses/GlassScene.kt (phone-mirror path,
// draw(transparent=false, lens=false)). apply() sets targets, step() advances springs and
// timelines on the virtual clock, draw() paints the 600×600 frame.
import type {GlassCard, ObjectKind, Pose} from '../cards';
import type {LensScene} from '../contracts';
import {MAX_DT_MS, MotionTokens, Spring, springSpec, type SpringSpec} from '../motion';
import {TOP_UP_FROM, drawBreathRing, stepBreath, warmBreath} from './breath';
import {beadPos, drawBeads, prebakeBeads, warmBeads} from './beads';
import {copyFor} from './copy';
import {drawFind, warmFind} from './find';
import {drawEnding, prebakeEnding} from './ending';
import {drawFingers, prebakeFingers} from './fingers';
import {GAZE_HOME_X, GAZE_HOME_Y, TRAIL_SAMPLE_MS, drawGaze, gazeAwayPoint, warmGaze} from './gaze';
import {drawIcons, warmIcons} from './icons';
import {drawListen, drawRipples, prebakeListen, warmListen} from './listen';
import {LOGO_DONE, drawIntro, introT, warmIntro} from './logo';
import {drawMomo, warmMomo} from './momo';
import {ACCENT, MINT, WHITE, hexRgb, type Rgb} from './palette';
import {drawSense, warmSense} from './sense';
import {State, type Mode} from './state';
import {T_RISE, drawSupport, prebakeSupport, warmSupport} from './support';
import {CAPTION_462, CAPTION_467, CAPTION_469, CAPTION_471, CAPTION_509, FIND_WRAP, Roles, prebakeCommon} from './text';

const RIPPLE_LIFE_MS = 1800;

class GlassScene implements LensScene {
  reducedMotion = false;
  private s = new State();
  /**
   * Bakes that need the font or the body PNGs, run one per frame (idle start-screen frames) so
   * no later transition pays for them. Each returns true when done, false to retry next frame.
   */
  private prebake: Array<() => boolean> = [warmIntro, prebakeCommon, prebakeSupport, prebakeBeads, prebakeFingers, prebakeListen, prebakeEnding];

  constructor() {
    // Bake the text-independent sprites up front so no glow is rasterised mid-animation.
    warmBreath();
    warmSupport();
    warmFind();
    warmSense();
    warmBeads();
    warmGaze();
    warmListen();
    warmIcons();
    warmMomo();
  }

  reset(): void {
    this.s = new State();
  }

  ripple(): void {
    const s = this.s;
    switch (s.mode) {
      // No tap ripple on the Figma-exact screens (GS:347-354).
      case 'BLANK': case 'OFF': case 'INTRO': case 'SUPPORT': case 'FIND': case 'SENSE': case 'BREATH': case 'BEADS':
      case 'FINGERS': case 'RINGS': case 'GAZE': case 'ENDING':
        return;
      case 'SWATCH':
        this.addRipple(300, 350, 0.5);
        return;
      default:
        this.addRipple(300, 250, 0.9);
    }
  }

  private addRipple(x: number, y: number, sc: number): void {
    if (!this.reducedMotion) this.s.ripples.push({x, y, s: sc, t0: this.s.now});
  }

  apply(card: GlassCard): void {
    const s = this.s;
    const rm = this.reducedMotion;
    s.epoch++;
    const prev: Mode = s.mode;
    const o = s.o;
    o.steady.to(0);
    o.drift.to(0);
    s.guideOp.to(0);
    if (card.kind !== 'Beads') s.beadsOp.to(0);
    if (card.kind !== 'Gaze') s.gazeOp.to(0);
    if (card.kind !== 'Support') s.supportOp.to(0, springSpec(100, 1));
    if (card.kind !== 'Find') {
      s.findCircleOp.to(0);
      s.findCupOp.to(0);
    }
    if (card.kind !== 'Sense') s.senseOp.to(0);
    if (card.kind !== 'SoundRings') s.listenOp.to(0);
    if (card.kind !== 'Fingers') s.fingersOp.to(0, springSpec(100, 1));
    if (card.kind !== 'Ending') s.endOp.to(0, springSpec(100, 1));
    // A pinch ripple started on the previous screen must not spill onto a Figma-exact one.
    if (card.kind === 'Intro' || card.kind === 'Support' || card.kind === 'Find' || card.kind === 'Sense' || card.kind === 'Breath' || card.kind === 'BreathStep' || card.kind === 'Beads' ||
      card.kind === 'Fingers' || card.kind === 'SoundRings' || card.kind === 'Gaze' || card.kind === 'Ending') s.ripples = [];
    if (card.kind !== 'Intro') s.introOp.to(0, springSpec(100, 1));
    if (card.kind !== 'BreathStep') s.breath = null;
    let icon: ObjectKind | null = null;

    switch (card.kind) {
      case 'Text': {
        s.mode = 'TEXT';
        const pose = card.pose ?? 'Orb';
        if (card.obj != null) {
          icon = card.obj;
          this.hideObj();
          if (card.obj === 'Stem') s.stem.set(0).to(1);
        } else if (card.fromSeed && !rm) {
          o.x.set(300); o.y.set(250); o.w.set(0); o.h.set(0); o.op.set(1); o.fill.set(1); o.corner.set(1); o.rot.set(0);
          this.color(ACCENT);
          o.r.snap(); o.g.snap(); o.b.snap();
          o.w.to(12, MotionTokens.Soft);
          o.h.to(12, MotionTokens.Soft);
          s.later(520, () => this.pose(pose));
        } else this.pose(pose);
        s.texts.grid(copyFor(card));
        break;
      }
      case 'Support':
        s.mode = 'SUPPORT';
        this.hideObj();
        if (prev !== 'SUPPORT') {
          s.supFrom = card.sitFirst ? 0 : T_RISE;
          s.supStart = s.now;
          s.supDur = Math.max(1, card.durationMs);
          s.supportOp.set(0).to(1, springSpec(25, 1)); // fades in from black (ω 5, ~0.8 s)
        }
        s.texts.set([]); // its two captions are part of the timeline (drawSupport)
        break;
      case 'Find': {
        s.mode = 'FIND';
        this.hideObj();
        // 6.1 is plain white; 6.2 / 6.3 use the item's colour.
        const rgb = card.stage === 'LOOK' ? WHITE : hexRgb(card.colorHex);
        s.findR.to(rgb[0]); s.findG.to(rgb[1]); s.findB.to(rgb[2]);
        // Snap the tint for 6.1 and when the circle comes back from invisible; spring only 6.1 → 6.2.
        if (prev !== 'FIND' || card.stage === 'LOOK' || s.findCircleOp.value < 0.05) {
          s.findR.snap(); s.findG.snap(); s.findB.snap();
        }
        // Each stage's pulse restarts at 30 %, except on 6.3 where the circle only fades out.
        if (prev !== 'FIND' || (card.stage !== s.findStage && card.stage !== 'ITEM')) s.findT0 = s.now;
        s.findStage = card.stage;
        s.findCircleOp.to(card.stage === 'ITEM' ? 0 : 1);
        s.findCupOp.to(card.stage === 'ITEM' ? 1 : 0);
        // 6.1 on one line; 6.2 / 6.3's text box has a fixed width (two lines).
        s.texts.caption(copyFor(card), CAPTION_471, card.stage === 'LOOK' ? 0 : FIND_WRAP);
        break;
      }
      case 'Sense':
        s.mode = 'SENSE';
        this.hideObj();
        s.senseKind = card.sense;
        if (prev !== 'SENSE') s.senseT0 = s.now;
        s.senseOp.to(1);
        s.texts.caption(copyFor(card), CAPTION_462);
        break;
      case 'Breath':
        // Starts on the inner circle (both dotted circles full) and opens out to the outer one.
        s.mode = 'BREATH';
        this.hideObj();
        s.bloom.set(0);
        s.ringInnerA = 1;
        s.ringOuterA = 1;
        s.guideOp.to(1);
        s.breath = rm || card.durationMs <= 0 ? null
          : {phase: 'EXHALE', start: s.now, dur: card.durationMs, from: 0, to: 1, innerFrom: 1, outerFrom: 1};
        s.texts.caption(copyFor(card), CAPTION_467);
        break;
      case 'BreathStep': {
        s.mode = 'BREATH';
        this.hideObj();
        s.guideOp.to(1);
        // Breathe In draws the ring in (outer → inner), Breathe Out lets it out; a cyclic sigh's
        // first inhale stops short and TOP_UP finishes it; HOLD stays put.
        const to = card.phase === 'INHALE' ? (card.topUp ? TOP_UP_FROM : 0)
          : card.phase === 'TOP_UP' ? 0
          : card.phase === 'HOLD' ? s.bloom.value
          : 1;
        if (rm) {
          s.breath = null;
          s.bloom.set(0);
          s.ringInnerA = 1;
          s.ringOuterA = 1;
        } else s.breath = {phase: card.phase, start: s.now, dur: card.durationMs, from: s.bloom.value, to, innerFrom: s.ringInnerA, outerFrom: s.ringOuterA};
        s.texts.caption(copyFor(card), CAPTION_467);
        break;
      }
      case 'SoundRings':
        // Figma 8.1: the ear in its dotted circle, four glowing dots on the circle.
        s.mode = 'RINGS';
        this.hideObj();
        if (prev !== 'RINGS') s.listenT0 = s.now;
        s.listenOp.to(1);
        s.texts.caption(copyFor(card), CAPTION_462);
        break;
      case 'Fingers':
        // Figma 5.0 → 5.3 → 5.1 on the team's timeline (drawFingers); its caption is part of it.
        s.mode = 'FINGERS';
        this.hideObj();
        if (prev !== 'FINGERS') {
          s.fingersT0 = s.now;
          s.fingersOp.set(0);
        }
        s.fingersOp.to(1, springSpec(25, 1));
        s.texts.set([]);
        break;
      case 'Ending':
        // Figma Component 10 on orbit.html's timeline (drawEnding); its words are part of it.
        s.mode = 'ENDING';
        this.hideObj();
        if (prev !== 'ENDING') {
          s.endT0 = s.now;
          s.endOp.set(0);
        }
        s.endOp.to(1, springSpec(25, 1));
        s.texts.set([]);
        break;
      case 'Beads': {
        s.mode = 'BEADS';
        this.hideObj();
        if (prev !== 'BEADS') {
          s.beadFrom = 0;
          s.beadTarget = 0;
          s.beadTurned = 0;
          s.beadPulseAt = -1;
        }
        const dir = card.dir ?? 1;
        const guide = card.guide ?? false;
        const delta = card.turned - s.beadTurned;
        if (guide || delta > 0) {
          s.beadFrom = beadPos(s);
          s.beadStart = s.now;
          s.beadTarget += dir * (guide ? 1 : delta);
          // Reduce motion: the beads jump (every spot looks the same after a turn), so the
          // bracelet dims briefly instead to show that a bead was turned.
          if (rm) {
            s.beadFrom = s.beadTarget;
            s.beadPulseAt = s.now;
          }
        }
        if (!guide) s.beadTurned = card.turned;
        s.beadsOp.to(1);
        s.texts.caption(copyFor(card), CAPTION_509); // Figma 4.0: "Swipe down to spin." under the bracelet
        break;
      }
      case 'Intro': {
        s.mode = 'INTRO';
        this.hideObj();
        const t = introT(s);
        const fresh = prev !== 'INTRO' || s.introOp.value < 0.01;
        // Opening draws the logo in from the bare centre dot (full opacity from frame 0); the
        // exit plays it backwards from wherever it is.
        s.introFrom = card.merging || !fresh ? t : 0;
        s.introTo = card.merging ? 0 : LOGO_DONE;
        s.introMerging = card.merging;
        s.introFadeMs = card.merging ? (card.fadeOutMs ?? 0) : 0;
        s.introStart = s.now;
        s.introDur = Math.max(1, card.durationMs);
        if (fresh && !card.merging) s.introOp.set(1);
        else s.introOp.to(1, springSpec(14, 1));
        if (rm) s.introFrom = s.introTo;
        s.texts.set([]);
        break;
      }
      case 'Gaze': {
        s.mode = 'GAZE';
        this.hideObj();
        // Figma 9.1: the light starts in its dotted circle and travels out and back with a tail.
        if (prev !== 'GAZE') {
          s.gazeX.set(GAZE_HOME_X);
          s.gazeY.set(GAZE_HOME_Y);
          s.trail.clear();
        }
        if (card.target === 'AWAY') {
          // Out along the card's angle as far as the frame allows (GS:590-597).
          const [tx, ty] = gazeAwayPoint(card.angleDeg ?? 0);
          s.gazeX.to(tx);
          s.gazeY.to(ty);
        } else {
          s.gazeX.to(GAZE_HOME_X);
          s.gazeY.to(GAZE_HOME_Y);
        }
        if (card.target === 'GONE') s.gazeOp.to(0, springSpec(3, 1));
        else s.gazeOp.to(1);
        s.texts.caption(copyFor(card), CAPTION_469);
        break;
      }
      case 'Off':
        s.mode = 'OFF';
        o.w.to(12); o.h.to(12); o.corner.to(1); o.rot.to(0); o.fill.to(1); o.y.to(250);
        s.later(500, () => o.op.to(0, springSpec(6, 1)));
        s.texts.set([]);
        break;
      case 'Blank':
        s.mode = 'BLANK';
        o.op.to(0);
        s.texts.set([]);
        break;
      // Legacy v1 cards (never emitted by the v2.1 engine): show their copy on the text grid only.
      case 'PhaseIntro':
        s.mode = 'PHASE';
        this.hideObj();
        s.texts.set([{str: card.word, role: Roles.PHASE, y: 384}, {str: `Part ${card.index + 1} of 3`, role: Roles.SUB, y: 430}]);
        break;
      case 'Swatch':
        s.mode = 'SWATCH';
        this.hideObj();
        s.texts.set([{str: card.label, role: Roles.TITLE, y: 430}, {str: card.sub, role: Roles.SUB, y: 478}]);
        break;
      case 'Fireflies':
      case 'Steps':
      case 'Phrase':
      case 'Choice':
        s.mode = card.kind === 'Fireflies' ? 'STAR' : card.kind === 'Steps' ? 'STEPS' : card.kind === 'Phrase' ? 'PHRASE' : 'CHOICE';
        this.hideObj();
        s.texts.grid(copyFor(card));
        break;
    }
    // Support's captions fade with supportOp, not as text layers: give the next words the same
    // 220 ms gap setTexts leaves after outgoing text (GS:549-551).
    if (prev === 'SUPPORT' && s.mode !== 'SUPPORT') s.texts.delayUnstarted(220);
    this.setIcon(icon);
    if (rm) s.snapAll();
  }

  private setIcon(kind: ObjectKind | null): void {
    const s = this.s;
    for (const i of s.icons) if (i.outAt < 0 && i.kind !== kind) i.outAt = s.now;
    if (kind == null) return;
    if (!s.icons.some((i) => i.outAt < 0 && i.kind === kind)) {
      s.icons.push({kind, born: s.now, op: new Spring(0).to(1), s: new Spring(0.88).to(1), outAt: -1});
    }
  }

  private hideObj(): void {
    const o = this.s.o;
    o.w.to(12); o.h.to(12); o.op.to(0); o.corner.to(1); o.rot.to(0);
  }

  private color(rgb: Rgb, spec: SpringSpec = MotionTokens.Color): void {
    const o = this.s.o;
    o.r.to(rgb[0], spec); o.g.to(rgb[1], spec); o.b.to(rgb[2], spec);
  }

  /** Momo dot poses (GS:572-590). Only Seed and Exhale are used by the v2.1 flow. */
  private pose(p: Pose): void {
    const o = this.s.o;
    const C = MotionTokens.Calm;
    let w = 140, h = 140, y = 250, fill = 1, op = 1, col: Rgb = ACCENT, drift = false, steady = false, slow = false, dim = false;
    switch (p) {
      case 'Seed': w = 12; h = 12; break;
      case 'Orb': drift = true; break;
      case 'Small': w = 56; h = 56; y = 180; drift = true; break;
      case 'Ring': fill = 0; drift = true; break;
      case 'Cool': col = MINT; drift = true; break;
      case 'Steady': steady = true; break;
      case 'Line': w = 6; h = 170; y = 235; break;
      case 'Dim': y = 270; op = 0.4; dim = true; break;
      case 'Exhale': w = 12; h = 12; slow = true; break;
    }
    const sz = slow ? MotionTokens.Slow : C;
    o.x.to(300, C);
    o.y.to(y, dim ? MotionTokens.Dim : C);
    o.w.to(w, sz);
    o.h.to(h, sz);
    o.fill.to(fill, C);
    o.op.to(op, dim ? MotionTokens.Dim : C);
    o.corner.to(1, C);
    o.rot.to(0, C);
    this.color(col);
    if (!this.reducedMotion) {
      o.drift.to(drift ? 1 : 0);
      o.steady.to(steady ? 1 : 0);
    }
  }

  step(dtMs: number): void {
    const s = this.s;
    const ms = Math.max(0, Math.min(MAX_DT_MS, dtMs));
    const dt = ms / 1000;
    const before = s.now;
    s.clock.now += ms;
    s.runLaters();
    stepBreath(s);
    // Gaze: step its springs in 60 Hz slices and sample the trail after each (mirror density).
    if (s.gazeOp.value > 0.003 || s.gazeOp.target > 0) this.stepGaze(before, ms);
    else {
      s.trail.clear();
      s.trailAt = -1;
      s.gazeX.step(dt); s.gazeY.step(dt); s.gazeOp.step(dt);
    }
    for (const sp of s.springs) {
      if (sp === s.gazeX || sp === s.gazeY || sp === s.gazeOp) continue;
      sp.step(dt);
    }
    s.texts.step(dt);
    const task = this.prebake[0];
    if (task && task()) this.prebake.shift();
    for (const ic of s.icons) {
      ic.op.step(dt);
      ic.s.step(dt);
    }
    const now = s.now;
    if (s.icons.some((i) => i.outAt >= 0 && now - i.outAt > 450)) s.icons = s.icons.filter((i) => !(i.outAt >= 0 && now - i.outAt > 450));
    if (s.ripples.some((r) => now - r.t0 > RIPPLE_LIFE_MS)) s.ripples = s.ripples.filter((r) => now - r.t0 <= RIPPLE_LIFE_MS);
  }

  private stepGaze(from: number, ms: number): void {
    const s = this.s;
    if (s.trailAt < 0) s.trailAt = from;
    let t = from;
    const end = from + ms;
    while (s.trailAt + TRAIL_SAMPLE_MS <= end) {
      const next = s.trailAt + TRAIL_SAMPLE_MS;
      const h = (next - t) / 1000;
      s.gazeX.step(h); s.gazeY.step(h); s.gazeOp.step(h);
      t = next;
      s.trailAt = next;
      if (s.gazeOp.value > 0.003) s.trail.push(s.gazeX.value, s.gazeY.value, next);
    }
    const h = (end - t) / 1000;
    if (h > 0) {
      s.gazeX.step(h); s.gazeY.step(h); s.gazeOp.step(h);
    }
    s.trail.dropOlderThan(end - 900);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const s = this.s;
    const rm = this.reducedMotion;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 600, 600);
    ctx.lineCap = 'round';
    ctx.setLineDash([]);
    // Each figure is drawn while its opacity > .003, so outgoing and incoming figures cross-fade.
    if (s.guideOp.value > 0.003) drawBreathRing(ctx, s, s.guideOp.value);
    if (s.supportOp.value > 0.003) drawSupport(ctx, s, s.supportOp.value, rm);
    if (s.findCircleOp.value > 0.003 || s.findCupOp.value > 0.003) drawFind(ctx, s, rm);
    if (s.senseOp.value > 0.003) drawSense(ctx, s, s.senseOp.value, rm);
    if (s.listenOp.value > 0.003) drawListen(ctx, s, s.listenOp.value, rm);
    if (s.fingersOp.value > 0.003) drawFingers(ctx, s, s.fingersOp.value, rm);
    if (s.endOp.value > 0.003) drawEnding(ctx, s, s.endOp.value, rm);
    drawIcons(ctx, s, rm);
    if (s.introOp.value > 0.003) drawIntro(ctx, s, s.introOp.value);
    if (s.beadsOp.value > 0.003) drawBeads(ctx, s, s.beadsOp.value);
    if (s.gazeOp.value > 0.003) drawGaze(ctx, s, s.gazeOp.value);
    drawMomo(ctx, s);
    if (s.ripples.length > 0) drawRipples(ctx, s);
    s.texts.draw(ctx);
    ctx.restore();
  }

  /** Lab/debug hook: the scene's coarse mode. */
  get mode(): Mode {
    return this.s.mode;
  }
}

export function createScene(): LensScene {
  return new GlassScene();
}

