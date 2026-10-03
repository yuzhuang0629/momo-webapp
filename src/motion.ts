// Motion primitives: exact port of momo-android glasses/MotionTokens.kt (Spring, SpringSpec,
// MotionTokens) and of GlassScene.kt's CubicBezier (GS:1663-1685) and small math helpers.

/** Spring parameters. Mass = 1. */
export interface SpringSpec {
  readonly stiffness: number;
  readonly dampingRatio: number;
}

export function springSpec(stiffness: number, dampingRatio: number): SpringSpec {
  return {stiffness, dampingRatio};
}

export const MotionTokens = {
  /** Size, position, opacity, pose morphs. No overshoot, ~900 ms. */
  Calm: springSpec(60, 1),
  /** Small confirmations only. ~5 % overshoot, ~450 ms. */
  Soft: springSpec(180, 0.72),
  Color: springSpec(30, 1),
  Glide: springSpec(22, 1),
  Slow: springSpec(4, 1),
  Dim: springSpec(8, 1),
  Follow: springSpec(140, 1),
  Track: springSpec(18, 1),
  Grow: springSpec(10, 1),
  Stem: springSpec(6, 1),
} as const;

/** Largest frame step the scene integrates at once (GS:617 clamps dt to [0, 50] ms). */
export const MAX_DT_MS = 50;

/**
 * Interruptible spring: a new target keeps the current value and velocity. Semi-implicit Euler,
 * sub-stepped at 240 Hz, snapping to the target once both error and velocity are below 1e-4.
 */
export class Spring {
  value: number;
  private _target: number;
  private velocity = 0;
  spec: SpringSpec;

  constructor(initial: number, spec: SpringSpec = MotionTokens.Calm) {
    this.value = initial;
    this._target = initial;
    this.spec = spec;
  }

  get target(): number {
    return this._target;
  }

  /** True while the spring still moves. */
  get moving(): boolean {
    return this.value !== this._target || this.velocity !== 0;
  }

  to(t: number, s?: SpringSpec): this {
    this._target = t;
    if (s) this.spec = s;
    return this;
  }

  set(v: number): this {
    this.value = v;
    this._target = v;
    this.velocity = 0;
    return this;
  }

  snap(): void {
    this.value = this._target;
    this.velocity = 0;
  }

  /** Advance by [dt] seconds. */
  step(dt: number): void {
    if (this.value === this._target && this.velocity === 0) return;
    const k = this.spec.stiffness;
    const d = 2 * this.spec.dampingRatio * Math.sqrt(k);
    const n = Math.max(1, Math.ceil(dt * 240));
    const h = dt / n;
    let x = this.value;
    let v = this.velocity;
    const target = this._target;
    for (let i = 0; i < n; i++) {
      const a = -k * (x - target) - d * v;
      v += a * h;
      x += v * h;
    }
    if (Math.abs(x - target) < 1e-4 && Math.abs(v) < 1e-4) {
      x = target;
      v = 0;
    }
    this.value = x;
    this.velocity = v;
  }
}

/** CSS `cubic-bezier(x1, y1, x2, y2)` timing function (Newton, then bisection; GS:1664-1685). */
export class CubicBezier {
  constructor(
    private readonly x1: number,
    private readonly y1: number,
    private readonly x2: number,
    private readonly y2: number,
  ) {}

  private bx(t: number): number {
    const u = 1 - t;
    return 3 * u * u * t * this.x1 + 3 * u * t * t * this.x2 + t * t * t;
  }

  private by(t: number): number {
    const u = 1 - t;
    return 3 * u * u * t * this.y1 + 3 * u * t * t * this.y2 + t * t * t;
  }

  private dbx(t: number): number {
    const u = 1 - t;
    return 3 * u * u * this.x1 + 6 * u * t * (this.x2 - this.x1) + 3 * t * t * (1 - this.x2);
  }

  /** Eased value for linear progress [x] in 0…1. */
  at(x: number): number {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const d = this.dbx(t);
      if (Math.abs(d) < 1e-5) continue;
      t = clamp(t - (this.bx(t) - x) / d, 0, 1);
    }
    if (Math.abs(this.bx(t) - x) > 1e-4) {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 30; i++) {
        t = (lo + hi) / 2;
        if (this.bx(t) < x) lo = t;
        else hi = t;
      }
    }
    return this.by(t);
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Cosine in-out on a clamped input (SupportFigure.ease, SF:149). */
export function cosEase(u: number): number {
  return 0.5 - 0.5 * Math.cos(Math.PI * clamp01(u));
}

export function easeOutSine(t: number): number {
  return Math.sin((t * Math.PI) / 2);
}
