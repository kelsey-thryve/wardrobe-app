import { SECTION_TYPES } from "../lib/plan";

// To-scale front elevation of one wall, drawn in mm (1 SVG unit = 1 mm, y measured down from
// the ceiling). Joinery is drawn in the plan's colour; windows, doors and open wall are not.

const T = 18; // panel thickness
const PLINTH = 100; // kickboard height
const HIGH_CEILING = 2700; // above this the joinery stops at JOINERY_MAX with a top shelf
const JOINERY_MAX = 2400;

const INK = "#3B3631";
const MUTED = "#776D63";
const FAINT = "#C9C1B6";
const WALL = "#FAF8F5";
const GLASS = "#E6EDF0";

const SHORT = {
  "long-hang": "Long hang",
  "double-hang": "Double hang",
  shelves: "Shelves",
  drawers: "Drawers",
  "drawers-shelves": "Drawers, shelves",
  shoes: "Shoes",
  "corner-shelves": "Corner",
  bench: "Bench",
  mirror: "Mirror",
  window: "Window",
  door: "Door",
  gap: "Open",
};
const NO_JOINERY = new Set(["window", "door", "gap"]);

// Mix a #rrggbb colour towards black (amt > 0) or white (amt < 0).
function shade(hex, amt) {
  const n = parseInt(/^#[0-9a-f]{6}$/i.test(hex || "") ? hex.slice(1) : "E8E2D6", 16);
  const to = amt > 0 ? 0 : 255;
  const a = Math.abs(amt);
  const ch = (v) => Math.round(v + (to - v) * a).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}

// Greedy word wrap to a character budget.
function wrap(text, max) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= max || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Fit a section label into its width: full label, else the short one, else truncated.
function fitLabel(type, width, fs) {
  const max = Math.max(3, Math.floor(width / (fs * 0.56)));
  const full = (SECTION_TYPES[type] || type).replace(/ \(no joinery\)/, "");
  let lines = wrap(full, max);
  if (lines.length <= 2 && lines.every((l) => l.length <= max)) return lines;
  lines = wrap(SHORT[type] || full, max);
  if (lines.length <= 3 && lines.every((l) => l.length <= max)) return lines;
  const s = SHORT[type] || full;
  return [s.length <= max ? s : `${s.slice(0, Math.max(2, max - 1))}.`];
}

export default function Elevation({ wall, ceiling = 2400, colour = "#E8E2D6", finish }) {
  if (!wall) return null;
  const H = ceiling;
  const W = wall.width;
  const sections = wall.sections || [];
  const topJ = H > HIGH_CEILING ? JOINERY_MAX : H; // top of joinery
  const Y = (mm) => H - mm; // height above floor -> SVG y

  // Text grows more slowly than the drawing so small and large walls both stay legible.
  const extent = Math.max(W, H);
  const fs = 92 * Math.sqrt(extent / 2400);
  const unit = fs / 2.4;
  const mL = unit * 9;
  const mR = unit * 4;
  const mT = unit * 9;
  const mB = unit * 15;

  const fill = colour;
  const edge = shade(colour, 0.38);
  const inside = shade(colour, -0.35);
  const plinth = shade(colour, 0.12);
  const garment = shade(colour, -0.15);

  const line = (w) => ({ vectorEffect: "non-scaling-stroke", strokeWidth: w });
  const panel = { fill, stroke: edge, ...line(0.8) };

  const shelf = (key, x0, x1, h) => <rect key={key} x={x0} y={Y(h)} width={x1 - x0} height={T} {...panel} />;

  const shelvesBetween = (key, x0, x1, from, to, pitch = 300) => {
    const n = Math.max(1, Math.round((to - from) / pitch));
    const step = (to - from) / n;
    return Array.from({ length: n - 1 }, (_, i) => shelf(`${key}${i}`, x0, x1, from + step * (i + 1)));
  };

  const drawerStack = (key, x0, x1, from, to, pitch = 200) => {
    const n = Math.max(1, Math.round((to - from) / pitch));
    const step = (to - from) / n;
    const hw = Math.min(160, (x1 - x0) * 0.3);
    const cx = (x0 + x1) / 2;
    return Array.from({ length: n }, (_, i) => {
      const top = to - step * i;
      return (
        <g key={`${key}${i}`}>
          <rect x={x0 + 2} y={Y(top) + 2} width={x1 - x0 - 4} height={step - 4} {...panel} />
          <line x1={cx - hw / 2} x2={cx + hw / 2} y1={Y(top) + 40} y2={Y(top) + 40} stroke={INK} strokeLinecap="round" {...line(1.4)} />
        </g>
      );
    });
  };

  // Rail with hangers and faint garment outlines (alternating lengths) to show the hanging zone.
  const rail = (key, x0, x1, h, len) => {
    const step = 140;
    const n = Math.max(1, Math.floor((x1 - x0 - 80) / step) + 1);
    const start = (x0 + x1) / 2 - ((n - 1) * step) / 2;
    const gw = 118;
    return (
      <g key={key}>
        {Array.from({ length: n }, (_, i) => {
          const cx = start + i * step;
          const l = len * [1, 0.82, 0.93, 0.76][i % 4];
          return (
            <g key={i}>
              <rect x={cx - gw / 2} y={Y(h) + 66} width={gw} height={l} rx={22} fill={garment} stroke={FAINT} {...line(0.6)} />
              <path d={`M${cx} ${Y(h)} v24 l-55 40 h110 z`} fill="none" stroke={MUTED} strokeLinejoin="round" {...line(0.7)} />
            </g>
          );
        })}
        <line x1={x0} x2={x1} y1={Y(h)} y2={Y(h)} stroke={INK} strokeLinecap="round" {...line(2)} />
      </g>
    );
  };

  let x = 0;
  const parts = sections.map((s, i) => {
    const x0 = x;
    const w = s.width;
    x += w;
    const ix0 = x0 + T;
    const ix1 = x0 + w - T;
    const k = `s${i}`;
    const out = [];

    if (!NO_JOINERY.has(s.type)) {
      const top = s.type === "bench" ? 880 : topJ;
      out.push(<rect key="plinth" x={x0} y={Y(PLINTH)} width={w} height={PLINTH} fill={plinth} stroke={edge} {...line(0.8)} />);
      out.push(<rect key="body" x={x0} y={Y(top)} width={w} height={top - PLINTH} {...panel} />);
      if (s.type !== "bench") {
        out.push(<rect key="back" x={ix0} y={Y(top - T)} width={ix1 - ix0} height={top - PLINTH - 2 * T} fill={inside} stroke={edge} {...line(0.6)} />);
      }
    }
    const capShelf = topJ - T - 320; // high shelf above hanging / open space

    switch (s.type) {
      case "long-hang": {
        out.push(shelf("ts", ix0, ix1, capShelf));
        if (topJ - capShelf > 600) out.push(...shelvesBetween("tsx", ix0, ix1, capShelf, topJ - T));
        out.push(rail("r", ix0, ix1, capShelf - 60, Math.min(1500, capShelf - 60 - PLINTH - 260)));
        break;
      }
      case "double-hang": {
        const mid = 1050;
        out.push(shelf("ts", ix0, ix1, capShelf));
        if (topJ - capShelf > 600) out.push(...shelvesBetween("tsx", ix0, ix1, capShelf, topJ - T));
        out.push(shelf("ms", ix0, ix1, mid));
        out.push(rail("ru", ix0, ix1, capShelf - 60, Math.min(850, capShelf - 60 - mid - 180)));
        out.push(rail("rl", ix0, ix1, mid - 60, 720));
        break;
      }
      case "shelves":
        out.push(...shelvesBetween("sh", ix0, ix1, PLINTH + T, topJ - T));
        break;
      case "corner-shelves": {
        const from = PLINTH + T;
        const to = topJ - T;
        const n = Math.max(1, Math.round((to - from) / 300));
        const step = (to - from) / n;
        for (let j = 1; j < n; j++) {
          const h = from + step * j;
          // Curved shelf front: a shallow bow below the shelf line.
          out.push(
            <path key={`cs${j}`} d={`M${ix0} ${Y(h)} h${ix1 - ix0} v${T} Q${(ix0 + ix1) / 2} ${Y(h) + T + 34} ${ix0} ${Y(h) + T} z`} {...panel} />,
          );
        }
        break;
      }
      case "drawers":
        out.push(...drawerStack("d", ix0, ix1, PLINTH + T, 1000, 180));
        out.push(shelf("dt", ix0, ix1, 1000));
        out.push(shelf("ts", ix0, ix1, capShelf));
        break;
      case "drawers-shelves":
        out.push(...drawerStack("d", ix0, ix1, PLINTH + T, 900, 195));
        out.push(shelf("dt", ix0, ix1, 900));
        out.push(...shelvesBetween("sh", ix0, ix1, 900 + T, topJ - T));
        break;
      case "shoes": {
        const shoeTop = Math.min(1300, topJ - 400);
        const n = Math.max(1, Math.round((shoeTop - PLINTH - T) / 220));
        const step = (shoeTop - PLINTH - T) / n;
        for (let j = 0; j < n; j++) {
          const h = PLINTH + T + step * j + 30;
          // Angled shoe shelf seen from the front: sloping board with a heel fence.
          out.push(
            <g key={`sh${j}`}>
              <rect x={ix0} y={Y(h + 70)} width={ix1 - ix0} height={70} fill={plinth} opacity={0.45} />
              <line x1={ix0} x2={ix1} y1={Y(h + 70)} y2={Y(h + 70)} stroke={edge} {...line(0.8)} />
              <rect x={ix0} y={Y(h) - 4} width={ix1 - ix0} height={22} {...panel} />
            </g>,
          );
        }
        out.push(shelf("st", ix0, ix1, shoeTop));
        out.push(...shelvesBetween("sa", ix0, ix1, shoeTop + T, topJ - T));
        break;
      }
      case "bench":
        out.push(...drawerStack("d", x0 + T, x0 + w - T, PLINTH, 850, 250));
        out.push(<rect key="top" x={x0} y={Y(880)} width={w} height={30} fill={shade(colour, 0.06)} stroke={edge} {...line(0.9)} />);
        break;
      case "mirror": {
        const gx = ix0 + 30;
        const gw = ix1 - ix0 - 60;
        const gTop = topJ - T - 120;
        const gBot = PLINTH + T + 80;
        const gh = gTop - gBot;
        out.push(<rect key="front" x={x0 + 2} y={Y(topJ) + 2} width={w - 4} height={topJ - PLINTH - 4} {...panel} />);
        out.push(<rect key="glass" x={gx} y={Y(gTop)} width={gw} height={gh} fill={GLASS} stroke={MUTED} {...line(0.8)} />);
        const L = Math.min(gw, gh) * 0.55;
        [[0.12, 0.08, 1], [0.32, 0.08, 0.6], [0.2, 0.55, 0.45]].forEach(([fx, fy, fl], j) => {
          const sx = gx + gw * fx;
          const sy = Y(gTop) + gh * fy;
          const len = Math.min(L * fl, gx + gw - sx - 20);
          out.push(<line key={`sheen${j}`} x1={sx} y1={sy + len} x2={sx + len} y2={sy} stroke="#FFFFFF" strokeLinecap="round" {...line(2.5)} />);
        });
        break;
      }
      case "window": {
        const inset = Math.min(120, w * 0.12);
        const wx0 = x0 + inset;
        const wx1 = x0 + w - inset;
        const head = Math.min(2100, H - 200);
        const sill = Math.min(900, head - 400);
        const f = 50;
        const panes = wx1 - wx0 > 800 ? 2 : 1;
        const pw = (wx1 - wx0 - f * (panes + 1)) / panes;
        out.push(<rect key="frame" x={wx0} y={Y(head)} width={wx1 - wx0} height={head - sill} fill="#FFFFFF" stroke={INK} {...line(1.1)} />);
        for (let j = 0; j < panes; j++) {
          out.push(<rect key={`p${j}`} x={wx0 + f + j * (pw + f)} y={Y(head) + f} width={pw} height={head - sill - 2 * f} fill={GLASS} stroke={MUTED} {...line(0.6)} />);
        }
        out.push(<rect key="sill" x={wx0 - 40} y={Y(sill)} width={wx1 - wx0 + 80} height={30} fill="#FFFFFF" stroke={INK} {...line(0.9)} />);
        out.push(<line key="sk" x1={x0} x2={x0 + w} y1={Y(90)} y2={Y(90)} stroke={FAINT} {...line(0.7)} />);
        break;
      }
      case "door": {
        const arch = 60;
        const dw = Math.min(w - 2 * arch - 20, 920);
        const dx0 = x0 + (w - dw) / 2;
        const head = Math.min(2040, H - 120);
        out.push(<line key="skl" x1={x0} x2={dx0 - arch} y1={Y(90)} y2={Y(90)} stroke={FAINT} {...line(0.7)} />);
        out.push(<line key="skr" x1={dx0 + dw + arch} x2={x0 + w} y1={Y(90)} y2={Y(90)} stroke={FAINT} {...line(0.7)} />);
        out.push(<path key="arch" d={`M${dx0 - arch} ${Y(0)} V${Y(head + arch)} H${dx0 + dw + arch} V${Y(0)}`} fill="#FFFFFF" stroke={INK} {...line(1)} />);
        out.push(<rect key="leaf" x={dx0} y={Y(head)} width={dw} height={head} fill="#FFFFFF" stroke={INK} {...line(1)} />);
        out.push(<rect key="panel" x={dx0 + dw * 0.18} y={Y(head) + 160} width={dw * 0.64} height={head - 320} fill="none" stroke={FAINT} {...line(0.6)} />);
        const hx = dx0 + dw - 70;
        out.push(<line key="h" x1={hx} x2={hx - 120} y1={Y(1000)} y2={Y(1000)} stroke={INK} strokeLinecap="round" {...line(2)} />);
        out.push(<circle key="hr" cx={hx} cy={Y(1000)} r={22} fill="#FFFFFF" stroke={INK} {...line(0.8)} />);
        break;
      }
      default: // gap: plain wall with skirting
        out.push(<line key="sk" x1={x0} x2={x0 + w} y1={Y(90)} y2={Y(90)} stroke={FAINT} {...line(0.7)} />);
    }

    // Top shelf where the joinery stops short of a high ceiling.
    if (!NO_JOINERY.has(s.type) && s.type !== "bench" && topJ < H) {
      out.push(<rect key="cap" x={x0} y={Y(topJ)} width={w} height={T} {...panel} />);
    }
    return <g key={k}>{out}</g>;
  });

  // Dimension line with architectural ticks; `vertical` runs it up the left side.
  const tick = fs * 0.35;
  const dim = (key, a, b, at, label, { vertical = false, below = false, size = fs } = {}) => {
    const mid = (a + b) / 2;
    const tk = (p) => (vertical
      ? <line key={p} x1={at - tick} y1={p + tick} x2={at + tick} y2={p - tick} stroke={INK} {...line(0.9)} />
      : <line key={p} x1={p - tick} y1={at + tick} x2={p + tick} y2={at - tick} stroke={INK} {...line(0.9)} />);
    return (
      <g key={key}>
        {vertical
          ? <line x1={at} x2={at} y1={a} y2={b} stroke={INK} {...line(0.6)} />
          : <line x1={a} x2={b} y1={at} y2={at} stroke={INK} {...line(0.6)} />}
        {tk(a)}
        {tk(b)}
        {vertical ? (
          <text x={at - fs * 0.45} y={mid} transform={`rotate(-90 ${at - fs * 0.45} ${mid})`} textAnchor="middle" fontSize={size} fill={INK}>{label}</text>
        ) : (
          <text x={mid} y={below ? at + size * 1.15 : at - size * 0.45} textAnchor="middle" fontSize={size} fill={INK}>{label}</text>
        )}
      </g>
    );
  };

  const extTop = -mT * 0.55;
  const extBot = H + mB * 0.2;
  const ext = (key, px, y0, y1) => <line key={key} x1={px} x2={px} y1={y0} y2={y1} stroke={MUTED} {...line(0.5)} />;

  let sx = 0;
  const below = sections.map((s, i) => {
    const x0 = sx;
    sx += s.width;
    const label = String(s.width);
    const size = Math.max(fs * 0.62, Math.min(fs * 0.9, s.width / (label.length * 0.62)));
    const lfs = fs * 0.78;
    const lines = fitLabel(s.type, s.width - 30, lfs);
    const ly = extBot + fs * 1.9;
    return (
      <g key={`b${i}`}>
        {dim(`d${i}`, x0, x0 + s.width, extBot, label, { below: true, size })}
        {lines.map((l, j) => (
          <text key={j} x={x0 + s.width / 2} y={ly + j * lfs * 1.2} textAnchor="middle" fontSize={lfs} fill={MUTED}>{l}</text>
        ))}
      </g>
    );
  });
  const edges = [0, ...sections.map((s) => s.width)].map((_, i, arr) => arr.slice(1, i + 1).reduce((t, v) => t + v, 0));

  const groundTicks = [];
  for (let gx = -unit * 2; gx < W + unit * 2; gx += 60) {
    groundTicks.push(<line key={gx} x1={gx} y1={H + 50} x2={gx + 50} y2={H} stroke={FAINT} {...line(0.5)} />);
  }

  const summary = `${wall.name}: front elevation, ${W} mm wide with a ${H} mm ceiling${finish ? `, in ${finish}` : ""}. ` +
    `Left to right: ${sections.map((s) => `${(SECTION_TYPES[s.type] || s.type).toLowerCase()} ${s.width} mm`).join(", ")}.`;

  return (
    <svg
      viewBox={`${-mL} ${-mT} ${W + mL + mR} ${H + mT + mB}`}
      role="img"
      aria-label={summary}
      style={{ width: "100%", height: "auto", display: "block", fontFamily: "inherit" }}
    >
      <title>{summary}</title>
      <rect x={0} y={0} width={W} height={H} fill={WALL} />
      {groundTicks}
      <rect x={-unit * 2} y={H} width={W + unit * 4} height={50} fill="#FFFFFF" opacity={0.6} />
      {parts}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke={INK} {...line(1.4)} />
      <line x1={-unit * 2} x2={W + unit * 2} y1={H} y2={H} stroke={INK} {...line(2)} />

      {ext("et0", 0, extTop - tick, -unit * 1)}
      {ext("et1", W, extTop - tick, -unit * 1)}
      {dim("overall", 0, W, extTop, String(W))}
      {edges.map((px, i) => ext(`eb${i}`, px, H + unit * 1, extBot + tick))}
      {below}
      <line x1={-mL * 0.75} x2={-unit * 1} y1={0} y2={0} stroke={MUTED} {...line(0.5)} />
      <line x1={-mL * 0.75} x2={-unit * 1} y1={H} y2={H} stroke={MUTED} {...line(0.5)} />
      {dim("ceiling", 0, H, -mL * 0.55, String(H), { vertical: true })}
    </svg>
  );
}
