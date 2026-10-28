// Draw an image onto a quadrilateral in perspective (canvas 2D has no perspective transform),
// by mapping a fine grid through a homography and drawing each cell as two affine triangles.

// Homography mapping the unit square (0,0),(1,0),(1,1),(0,1) to quad points p0..p3.
function squareToQuad([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]) {
  const dx1 = x1 - x2, dx2 = x3 - x2, dy1 = y1 - y2, dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3, sy = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h];
}

const apply = ([a, b, c, d, e, f, g, h], u, v) => {
  const w = g * u + h * v + 1;
  return [(a * u + b * v + c) / w, (d * u + e * v + f) / w];
};

// Draw triangle (s0,s1,s2) of the source image onto triangle (d0,d1,d2) of the canvas.
function drawTriangle(ctx, img, s, d) {
  const [[u0, v0], [u1, v1], [u2, v2]] = s;
  const [[x0, y0], [x1, y1], [x2, y2]] = d;
  ctx.save();
  // Grow the clip a hair so neighbouring triangles don't leave hairline seams.
  const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
  const grow = ([x, y]) => [x + Math.sign(x - cx) * 1.5, y + Math.sign(y - cy) * 1.5];
  const g = [grow([x0, y0]), grow([x1, y1]), grow([x2, y2])];
  ctx.beginPath();
  ctx.moveTo(...g[0]);
  ctx.lineTo(...g[1]);
  ctx.lineTo(...g[2]);
  ctx.closePath();
  ctx.clip();
  const den = u0 * (v1 - v2) + u1 * (v2 - v0) + u2 * (v0 - v1);
  if (Math.abs(den) > 1e-9) {
    const a = (x0 * (v1 - v2) + x1 * (v2 - v0) + x2 * (v0 - v1)) / den;
    const b = (y0 * (v1 - v2) + y1 * (v2 - v0) + y2 * (v0 - v1)) / den;
    const c = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / den;
    const dd = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / den;
    const e = (x0 * (u1 * v2 - u2 * v1) + x1 * (u2 * v0 - u0 * v2) + x2 * (u0 * v1 - u1 * v0)) / den;
    const f = (y0 * (u1 * v2 - u2 * v1) + y1 * (u2 * v0 - u0 * v2) + y2 * (u0 * v1 - u1 * v0)) / den;
    ctx.setTransform(a, b, c, dd, e, f);
    ctx.drawImage(img, 0, 0);
  }
  ctx.restore();
}

// Draw `img` so its corners land on `quad` (pixel points: top-left, top-right, bottom-right,
// bottom-left) on `ctx`.
export function drawWarped(ctx, img, quad, steps = 20) {
  const H = squareToQuad(quad);
  const W = img.width, Ht = img.height;
  const pt = (i, j) => apply(H, i / steps, j / steps);
  const src = (i, j) => [(i / steps) * W, (j / steps) * Ht];
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      drawTriangle(ctx, img, [src(i, j), src(i + 1, j), src(i + 1, j + 1)], [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1)]);
      drawTriangle(ctx, img, [src(i, j), src(i + 1, j + 1), src(i, j + 1)], [pt(i, j), pt(i + 1, j + 1), pt(i, j + 1)]);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// The reverse: cut the quadrilateral `quad` (pixel points: top-left, top-right, bottom-right,
// bottom-left) out of `img` and straighten it into the whole of `ctx`'s canvas, w x h.
export function drawUnwarped(ctx, img, quad, w, h, steps = 24) {
  const H = squareToQuad(quad);
  const src = (i, j) => apply(H, i / steps, j / steps);
  const dst = (i, j) => [(i / steps) * w, (j / steps) * h];
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      drawTriangle(ctx, img, [src(i, j), src(i + 1, j), src(i + 1, j + 1)], [dst(i, j), dst(i + 1, j), dst(i + 1, j + 1)]);
      drawTriangle(ctx, img, [src(i, j), src(i + 1, j + 1), src(i, j + 1)], [dst(i, j), dst(i + 1, j + 1), dst(i, j + 1)]);
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
