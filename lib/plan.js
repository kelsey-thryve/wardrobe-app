// The walk-in layout plan: the single source of truth that the room view, the face-on wall
// views and the to-scale elevation drawings are all built from, so they match each other.
//
// plan = {
//   finish: "light oak timber veneer",      // words for the image model
//   colour: "#D8C3A0",                      // swatch for the drawings
//   ceiling: 2400,                          // mm
//   walls: [{
//     name: "Left wall",                    // as seen from the overview photo
//     width: 2400,                          // mm, corner to corner
//     sections: [{ type: "double-hang", width: 900 }, ...],   // left to right
//     outline: [[x, y] x4] | null,          // the wall in the overview photo, as fractions of
//                                           // the image: top-left, top-right, bottom-right,
//                                           // bottom-left (ceiling and floor corners)
//   }],
// }

export const SECTION_TYPES = {
  "long-hang": "Long hanging",
  "double-hang": "Double hanging",
  shelves: "Shelves",
  drawers: "Drawers",
  "drawers-shelves": "Drawers with shelves above",
  shoes: "Shoe shelves",
  "corner-shelves": "Corner shelves",
  bench: "Low drawers with bench top",
  mirror: "Full-length mirror",
  window: "Window (no joinery)",
  door: "Door (no joinery)",
  gap: "Open wall",
};

const num = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};

// Four [x, y] points (fractions of the photo, a little outside the frame allowed) or null.
function cleanOutline(o) {
  if (!Array.isArray(o) || o.length !== 4) return null;
  const pts = o.map((p) => (Array.isArray(p) ? p.slice(0, 2).map(Number) : [NaN, NaN]));
  if (!pts.every(([x, y]) => x >= -0.5 && x <= 1.5 && y >= -0.5 && y <= 1.5)) return null;
  // Twice the signed area: reject points that don't make a real quadrilateral.
  const area = pts.reduce((t, [x, y], i) => { const [nx, ny] = pts[(i + 1) % 4]; return t + x * ny - nx * y; }, 0);
  return Math.abs(area) > 0.002 ? pts.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]) : null;
}

// Clean up a plan from the model: known section types only, sensible sizes, and section
// widths scaled so each wall's sections add up to the wall's width.
export function normalisePlan(raw, { widths = [], ceiling } = {}) {
  if (!raw || !Array.isArray(raw.walls)) return null;
  const walls = raw.walls.slice(0, 5).map((w, i) => {
    const width = num(widths[i], 300, 15000) || num(w?.width, 300, 15000) || 2400;
    let sections = (Array.isArray(w?.sections) ? w.sections : [])
      .map((s) => ({ type: SECTION_TYPES[s?.type] ? s.type : "shelves", width: num(s?.width, 100, 6000) || 600 }))
      .slice(0, 12);
    if (!sections.length) sections = [{ type: "gap", width }];
    const total = sections.reduce((t, s) => t + s.width, 0);
    sections = sections.map((s) => ({ ...s, width: Math.round((s.width * width) / total) }));
    return { name: String(w?.name || `Wall ${i + 1}`).slice(0, 40), width, sections, outline: cleanOutline(w?.outline) };
  });
  if (!walls.length) return null;
  const colour = /^#[0-9a-f]{6}$/i.test(raw.colour || "") ? raw.colour : "#E8E2D6";
  return {
    finish: String(raw.finish || "").slice(0, 120) || null,
    colour,
    ceiling: num(ceiling, 1800, 6000) || num(raw.ceiling, 1800, 6000) || 2400,
    walls,
  };
}

// One line per wall for the image prompts.
export function planWallText(wall) {
  return `${wall.name}, ${wall.width}mm wide, left to right: ` +
    wall.sections.map((s) => `${SECTION_TYPES[s.type].toLowerCase()} ${s.width}mm`).join(", ");
}
