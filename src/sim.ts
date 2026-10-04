// Simulated wearer's view (?sim=1), for people who scan a QR code on a phone or open the link on a
// desktop: the real-world photo through the right lens, a dark frame around it, and the lens image
// laid over the world additively ('screen': black lets the world through, light glows over it),
// like the earlier momo-lens-simulator.html. Purely visual; the session plays by itself.

/** Where the display sits in the view: centred a little above the middle, sized to the screen. */
const LENS_SCALE = 0.62;
const LENS_CY = 0.46;

export interface SimView {
  /** Composite the current lens frame over the world (call after the lens canvas is drawn). */
  draw(lens: HTMLCanvasElement): void;
}

export function createSimView(photoUrl: string): SimView {
  const world = document.createElement('canvas');
  world.className = 'sim-world';
  world.setAttribute('aria-hidden', 'true');
  document.body.prepend(world);
  const ctx = world.getContext('2d', {alpha: false});
  if (!ctx) throw new Error('2D canvas unavailable');

  // The photo, vignette and frame only change on resize: baked into one background canvas.
  const back = document.createElement('canvas');
  const bx = back.getContext('2d');
  const photo = new Image();
  let ready = false;

  function layout(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(window.innerWidth * dpr));
    const h = Math.max(1, Math.round(window.innerHeight * dpr));
    world.width = back.width = w;
    world.height = back.height = h;
    if (!bx) return;
    bx.fillStyle = '#111';
    bx.fillRect(0, 0, w, h);
    if (ready) {
      // Cover, focused a little below the middle (the desk).
      const s = Math.max(w / photo.width, h / photo.height);
      bx.drawImage(photo, (w - photo.width * s) / 2, (h - photo.height * s) * 0.55, photo.width * s, photo.height * s);
    }
    const v = bx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,.45)');
    bx.fillStyle = v;
    bx.fillRect(0, 0, w, h);
    // The frame: dark everywhere except one rounded lens opening, with a soft inner edge.
    const inset = Math.min(w, h) * 0.04;
    const radius = Math.min(w, h) * 0.22;
    bx.save();
    bx.fillStyle = 'rgba(8,8,9,.96)';
    bx.beginPath();
    bx.rect(0, 0, w, h);
    bx.roundRect(inset, inset, w - 2 * inset, h - 2 * inset, radius);
    bx.fill('evenodd');
    bx.strokeStyle = 'rgba(255,255,255,.06)';
    bx.lineWidth = Math.max(1, dpr);
    bx.beginPath();
    bx.roundRect(inset, inset, w - 2 * inset, h - 2 * inset, radius);
    bx.stroke();
    bx.restore();
  }

  photo.onload = () => {
    ready = true;
    layout();
  };
  photo.src = photoUrl;
  layout();
  window.addEventListener('resize', layout);

  return {
    draw(lens) {
      const w = world.width;
      const h = world.height;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.drawImage(back, 0, 0);
      const s = Math.min(w, h) * LENS_SCALE;
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(lens, (w - s) / 2, h * LENS_CY - s / 2, s, s);
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
