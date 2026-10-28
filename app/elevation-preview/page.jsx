// DEV PREVIEW ONLY: a visual check for app/Elevation.jsx. Not linked from the app; safe to delete.
import Elevation from "../Elevation";

const PLAN = {
  finish: "light oak timber veneer",
  colour: "#D8C3A0",
  ceiling: 2400,
  walls: [
    { name: "Left wall", width: 2400, sections: [{ type: "double-hang", width: 900 }, { type: "drawers-shelves", width: 600 }, { type: "long-hang", width: 900 }] },
    { name: "Back wall", width: 1800, sections: [{ type: "shelves", width: 450 }, { type: "window", width: 900 }, { type: "shelves", width: 450 }] },
    { name: "Right wall", width: 2400, sections: [{ type: "long-hang", width: 900 }, { type: "drawers", width: 600 }, { type: "shoes", width: 900 }] },
  ],
};

// Every section type on one wall, with a high ceiling so the joinery stops at 2400.
const ALL_TYPES = {
  name: "Every section type",
  width: 9100,
  sections: [
    { type: "long-hang", width: 900 },
    { type: "double-hang", width: 900 },
    { type: "shelves", width: 600 },
    { type: "drawers", width: 600 },
    { type: "drawers-shelves", width: 600 },
    { type: "shoes", width: 600 },
    { type: "corner-shelves", width: 500 },
    { type: "bench", width: 1200 },
    { type: "mirror", width: 600 },
    { type: "window", width: 1200 },
    { type: "door", width: 1000 },
    { type: "gap", width: 400 },
  ],
};

const card = { background: "#FFFFFF", border: "1px solid #E7DDD4", borderRadius: 4, padding: 20 };
const h2 = { fontSize: 15, fontWeight: 600, margin: "0 0 12px" };

export default function ElevationPreview() {
  return (
    <main className="wrap">
      <div className="inner">
        <h1 style={{ fontSize: 22, margin: "0 0 18px" }}>Elevation preview (dev only)</h1>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {PLAN.walls.map((w) => (
            <section key={w.name} style={card}>
              <h2 style={h2}>{w.name}</h2>
              <Elevation wall={w} ceiling={PLAN.ceiling} colour={PLAN.colour} finish={PLAN.finish} />
            </section>
          ))}
        </div>
        <section style={{ ...card, marginTop: 16 }}>
          <h2 style={h2}>{ALL_TYPES.name} (3000 ceiling)</h2>
          <Elevation wall={ALL_TYPES} ceiling={3000} colour="#E8E2D6" finish="white satin" />
        </section>
      </div>
    </main>
  );
}
