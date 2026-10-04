// Simulated view (?sim=1), for people who scan a QR code on a phone or open the link on a desktop:
// the glasses seen from the wearer's side, a thick dark smoky frame with its arms running back to
// the lower corners, clear lenses, on a slate-blue gradient, with the Momo display (the lens canvas,
// background colour and all) as a rounded block low in the right lens, where Meta Ray-Ban Display
// shows its content. Drawn after the team's reference render (an original drawing, no logos or
// photos); everything but the display is baked once per resize. Purely visual; the session plays
// by itself.

/** The drawing's own coordinate space (the reference render's 800 × 420). */
const REF_W = 800;
const REF_H = 420;
/** The display block in the right lens (reference px): centre and side. */
const DISPLAY_CX = 556;
const DISPLAY_CY = 210;
const DISPLAY_SIDE = 122;
/** The display's own corner radius (Figma frame 17: 18 of 600). */
const DISPLAY_CORNER = 18 / 600;

const LEFT_LENS: readonly [number, number, number, number, number[]] = [135, 118, 245, 172, [28, 30, 62, 58]];
const RIGHT_LENS: readonly [number, number, number, number, number[]] = [425, 118, 250, 174, [30, 28, 58, 62]];

export interface SimView {
  /** Draw the glasses with the current lens frame in the right lens (after the lens canvas is drawn). */
  draw(lens: HTMLCanvasElement): void;
}

function lensRect(p: Path2D, l: typeof LEFT_LENS): void {
  p.roundRect(l[0], l[1], l[2], l[3], l[4]);
}

/** The front of the frame round both lenses, with the open nose gap under the bridge. */
function frontPath(): Path2D {
  const p = new Path2D();
  p.moveTo(68, 104);
  p.quadraticCurveTo(400, 62, 732, 104); // top edge, gently arched
  p.bezierCurveTo(748, 140, 744, 250, 716, 300); // right outer side
  p.bezierCurveTo(700, 326, 660, 330, 610, 328); // right bottom corner
  p.lineTo(470, 322); // right bottom rim
  p.bezierCurveTo(440, 318, 432, 290, 428, 250); // up the right nose side
  p.bezierCurveTo(424, 205, 418, 178, 400, 176); // under the bridge
  p.bezierCurveTo(382, 178, 376, 205, 372, 250);
  p.bezierCurveTo(368, 290, 360, 318, 330, 322); // down the left nose side
  p.lineTo(190, 328); // left bottom rim
  p.bezierCurveTo(140, 330, 100, 326, 84, 300); // left bottom corner
  p.bezierCurveTo(56, 250, 52, 140, 68, 104); // left outer side
  p.closePath();
  return p;
}

/** One arm: the hinge block at the frame's outer corner and the temple running back and down. */
function templePath(mirror: boolean): Path2D {
  const X = (x: number) => (mirror ? REF_W - x : x);
  const p = new Path2D();
  p.moveTo(X(70), Y(96));
  p.bezierCurveTo(X(100), Y(98), X(128), Y(104), X(134), Y(118));
  p.lineTo(X(130), Y(262));
  p.bezierCurveTo(X(124), Y(300), X(112), Y(340), X(112), Y(430));
  p.lineTo(X(-10), Y(430));
  p.bezierCurveTo(X(10), Y(360), X(36), Y(300), X(44), Y(240));
  p.bezierCurveTo(X(50), Y(170), X(52), Y(110), X(70), Y(96));
  p.closePath();
  return p;
  function Y(y: number): number {
    return y;
  }
}

export function createSimView(): SimView {
  const view = document.createElement('canvas');
  view.className = 'sim-world';
  view.setAttribute('aria-hidden', 'true');
  document.body.prepend(view);
  const ctx = view.getContext('2d', {alpha: false});
  if (!ctx) throw new Error('2D canvas unavailable');

  let dpr = 1;
  let scale = 1;
  let ox = 0;
  let oy = 0;
  const backdrop = document.createElement('canvas');

  function layout(): void {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(window.innerWidth * dpr));
    const H = Math.max(1, Math.round(window.innerHeight * dpr));
    view.width = backdrop.width = W;
    view.height = backdrop.height = H;
    scale = Math.min(W / REF_W, H / REF_H);
    ox = (W - REF_W * scale) / 2;
    oy = (H - REF_H * scale) / 2;
    const b = backdrop.getContext('2d');
    if (!b) return;

    // Slate-blue backdrop over the whole screen.
    const bg = b.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#5B6F81');
    bg.addColorStop(1, '#A6B6BF');
    b.fillStyle = bg;
    b.fillRect(0, 0, W, H);

    b.save();
    b.setTransform(scale, 0, 0, scale, ox, oy);

    // The arms, behind the front.
    for (const mirror of [false, true]) {
      const t = templePath(mirror);
      const g = b.createLinearGradient(mirror ? REF_W : 0, 0, mirror ? REF_W - 140 : 140, 0);
      g.addColorStop(0, '#0E0E10');
      g.addColorStop(1, '#2A2A2E');
      b.fillStyle = g;
      b.fill(t);
      b.strokeStyle = 'rgba(190,205,220,.22)';
      b.lineWidth = 1.5;
      b.stroke(t);
      // Hinge screw and sensor dot.
      const hx = mirror ? REF_W - 92 : 92;
      b.fillStyle = 'rgba(200,210,220,.55)';
      b.beginPath();
      b.arc(hx, 178, 4.5, 0, Math.PI * 2);
      b.fill();
      b.fillStyle = 'rgba(0,0,0,.6)';
      b.beginPath();
      b.arc(hx, 178, 2, 0, Math.PI * 2);
      b.fill();
    }

    // The front, with the lenses cut out.
    const front = frontPath();
    lensRect(front, LEFT_LENS);
    lensRect(front, RIGHT_LENS);
    const fg = b.createLinearGradient(0, 70, 0, 330);
    fg.addColorStop(0, '#26252A');
    fg.addColorStop(0.45, '#151517');
    fg.addColorStop(1, '#1D1D21');
    b.fillStyle = fg;
    b.fill(front, 'evenodd');
    // Warm smoky glow along the top middle (the acetate catching the light).
    b.save();
    b.clip(front, 'evenodd');
    const glow = b.createRadialGradient(400, 78, 6, 400, 78, 240);
    glow.addColorStop(0, 'rgba(214,140,86,.65)');
    glow.addColorStop(0.45, 'rgba(150,92,60,.25)');
    glow.addColorStop(1, 'rgba(120,80,60,0)');
    b.fillStyle = glow;
    b.fillRect(0, 0, REF_W, REF_H);
    // Cool reflections on the outer top corners.
    for (const cx of [120, 680]) {
      const c = b.createRadialGradient(cx, 110, 4, cx, 110, 90);
      c.addColorStop(0, 'rgba(170,190,210,.28)');
      c.addColorStop(1, 'rgba(170,190,210,0)');
      b.fillStyle = c;
      b.fillRect(0, 0, REF_W, REF_H);
    }
    b.restore();
    // Rim highlights: a thin light edge along the top and round each lens opening.
    b.strokeStyle = 'rgba(210,220,230,.18)';
    b.lineWidth = 1.6;
    const top = new Path2D();
    top.moveTo(80, 103);
    top.quadraticCurveTo(400, 65, 720, 103);
    b.stroke(top);
    for (const l of [LEFT_LENS, RIGHT_LENS]) {
      const p = new Path2D();
      lensRect(p, l);
      b.strokeStyle = 'rgba(200,215,228,.16)';
      b.lineWidth = 3;
      b.stroke(p);
      // Clear glass: only a faint reflection.
      b.save();
      b.clip(p);
      const r = b.createLinearGradient(l[0], l[1], l[0] + l[2] * 0.6, l[1] + l[3]);
      r.addColorStop(0, 'rgba(255,255,255,.10)');
      r.addColorStop(0.4, 'rgba(255,255,255,0)');
      b.fillStyle = r;
      b.fillRect(l[0], l[1], l[2], l[3]);
      b.restore();
    }

    // A quiet label between the arms; on a portrait phone, a hint to turn it.
    b.fillStyle = 'rgba(255,255,255,.7)';
    b.font = '300 13px "Elms Sans", sans-serif';
    b.textAlign = 'center';
    b.textBaseline = 'middle';
    b.fillText('Momo · simulated view through the glasses', 400, 372);
    if (H > W) b.fillText('Turn your phone sideways for a larger view', 400, 392);
    b.restore();
  }

  layout();
  window.addEventListener('resize', layout);
  // The label uses Elms Sans: re-bake once the font has loaded.
  void document.fonts.ready.then(layout);

  return {
    draw(lens) {
      ctx.drawImage(backdrop, 0, 0);
      // The display block, with its own background colour, low in the right lens; clipped to its
      // rounded corners so the lens canvas's black corner pixels don't show.
      const s = DISPLAY_SIDE * scale;
      const x = ox + DISPLAY_CX * scale - s / 2;
      const y = oy + DISPLAY_CY * scale - s / 2;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, s, s, s * DISPLAY_CORNER);
      ctx.clip();
      ctx.drawImage(lens, x, y, s, s);
      ctx.restore();
    },
  };
}
