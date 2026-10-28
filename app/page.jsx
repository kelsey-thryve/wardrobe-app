"use client";
import { useState, useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Elevation from "./Elevation";
import { drawWarped } from "../lib/warp";

const STUDIO = "Thryve Growth";

const MAX_PHOTOS = 5;
const RENDER_EXTRA_PHOTOS = 2; // extra views sent with a render; keeps the request under the host's size limit
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Read a measurement in mm; small numbers are taken as metres ("2.4" -> 2400).
const toMm = (v) => {
  const n = Number(String(v || "").replace(/[^\d.]/g, ""));
  if (!n) return null;
  const mm = n <= 20 ? n * 1000 : n;
  return mm >= 300 && mm <= 15000 ? Math.round(mm) : null;
};

// Downsize a data URL to a JPEG, for context photos and previous renders sent back to the server.
const shrink = (src, max, quality) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      try {
        resolve(c.toDataURL("image/jpeg", quality));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
const WALL_KEYS = ["left", "back", "right"];
const WALL_NAMES = ["Left wall", "Back wall", "Right wall"];

// Draw a wall's bare plan elevation (wall and joinery only) to a JPEG, as the layout guide for
// that wall's render.
const planImage = (wall, plan, max = 1280) =>
  new Promise((resolve) => {
    const svg = renderToStaticMarkup(<Elevation bare wall={wall} ceiling={plan.ceiling} colour={plan.colour} />);
    const img = new Image();
    img.onload = () => {
      const s = max / Math.max(wall.width, plan.ceiling);
      const c = document.createElement("canvas");
      c.width = Math.round(wall.width * s);
      c.height = Math.round(plan.ceiling * s);
      const g = c.getContext("2d");
      g.fillStyle = "#FFFFFF";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => resolve(null);
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });

const loadImage = (src) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

// The layout guide for the room view: the overview photo with each wall's plan drawing warped
// onto that wall (at the corners the planner found), so the room view follows the same plan.
const layoutGuide = async (photoSrc, plan) => {
  const walls = plan.walls.filter((w) => w.outline);
  if (!walls.length) return null;
  const photo = await loadImage(photoSrc);
  if (!photo) return null;
  const c = document.createElement("canvas");
  c.width = photo.width;
  c.height = photo.height;
  const g = c.getContext("2d");
  g.drawImage(photo, 0, 0);
  // Warp at full opacity on a separate layer (overlapping triangle edges would otherwise show
  // as seams), then blend the layer over the photo once.
  const layer = document.createElement("canvas");
  layer.width = c.width;
  layer.height = c.height;
  for (const w of walls) {
    const drawing = await loadImage(await planImage(w, plan, 900));
    if (drawing) drawWarped(layer.getContext("2d"), drawing, w.outline.map(([x, y]) => [x * c.width, y * c.height]));
  }
  g.globalAlpha = 0.94;
  g.drawImage(layer, 0, 0);
  g.globalAlpha = 1;
  return c.toDataURL("image/jpeg", 0.9);
};

// Walls that get their own face-on render. The room view already looks straight at the back
// wall, so it only appears there and in the Plan; the side walls, seen at a steep angle from
// the doorway, get their own views.
const faceOnWalls = (walls) => walls.map((w, i) => (/back/i.test(w.name) ? null : `w${i}`)).filter(Boolean);

const CHIPS = [
  "Full-height hanging rails",
  "Bank of soft-close drawers",
  "Open cube shelves",
  "Dedicated shoe racks",
  "Integrated LED lighting",
  "Full-length mirror",
];

export default function Page() {
  const [photos, setPhotos] = useState([]); // first photo is the main view the render is built on
  const photo = photos[0] || null;
  const [brief, setBrief] = useState("");
  const [picked, setPicked] = useState([]);
  const [stage, setStage] = useState("intake"); // intake | design | quote | done
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  // Walk-in mode: photo 1 shows the whole room from the doorway. On by default with 2+ photos.
  const [wallChoice, setWallChoice] = useState(null);
  const walkIn = wallChoice ?? photos.length > 1;
  const [plan, setPlan] = useState(null); // the walk-in layout plan every view is built from
  const [guide, setGuide] = useState(null); // the plan drawn onto the overview photo
  const [views, setViews] = useState({}); // render per view id: { img, err, loading }
  const [active, setActive] = useState("main");
  const [widths, setWidths] = useState({}); // wall widths: "main", or "left" / "back" / "right"
  const [ceiling, setCeiling] = useState("");
  const [depth, setDepth] = useState("");
  const [lead, setLead] = useState({ name: "", email: "", phone: "", suburb: "" });
  const fileRef = useRef(null);

  // Shrink a photo to a JPEG data URL so several fit in one request.
  const compress = (f) =>
    new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => {
        const img = new Image();
        img.onload = () => {
          const max = 1280;
          let { width, height } = img;
          if (Math.max(width, height) > max) {
            const s = max / Math.max(width, height);
            width = Math.round(width * s);
            height = Math.round(height * s);
          }
          const c = document.createElement("canvas");
          c.width = width;
          c.height = height;
          c.getContext("2d").drawImage(img, 0, 0, width, height);
          try {
            resolve(c.toDataURL("image/jpeg", 0.85));
          } catch {
            resolve(r.result);
          }
        };
        img.onerror = () => resolve(r.result);
        img.src = r.result;
      };
      r.onerror = () => resolve(null);
      r.readAsDataURL(f);
    });

  const onFile = async (e) => {
    const files = [...(e.target.files || [])].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = ""; // let the same file be picked again
    if (!files.length) return;
    const added = (await Promise.all(files.map(compress))).filter(Boolean);
    setPhotos((ps) => [...ps, ...added].slice(0, MAX_PHOTOS));
  };

  const removePhoto = (i) => setPhotos((ps) => ps.filter((_, j) => j !== i));
  const makeMain = (i) => setPhotos((ps) => [ps[i], ...ps.filter((_, j) => j !== i)]);

  const toggleChip = (c) =>
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const dims = () => ({
    widths: (walkIn ? WALL_KEYS : ["main"]).map((k) => toMm(widths[k])),
    ceiling: toMm(ceiling),
    depth: walkIn ? toMm(depth) : null,
  });

  const measurements = () => {
    const d = dims();
    const walls = walkIn
      ? d.widths.map((w, i) => (w ? `${WALL_NAMES[i].toLowerCase()} is ${w}mm wide` : null)).filter(Boolean)
      : d.widths[0] ? [`the wall is ${d.widths[0]}mm wide`] : [];
    const all = [...walls, d.ceiling && `ceiling height ${d.ceiling}mm`, d.depth && `room depth ${d.depth}mm`].filter(Boolean);
    return all.length ? `Measurements: ${all.join(", ")}` : "";
  };

  const fullBrief = () => {
    const parts = [];
    if (picked.length) parts.push(picked.join(", "));
    if (brief.trim()) parts.push(brief.trim());
    if (measurements()) parts.push(measurements());
    return parts.join(". ");
  };

  // Walk-in views: the room view, each wall face-on, and the to-scale plan drawings.
  const wallIds = plan ? faceOnWalls(plan.walls) : ["w0", "w2"];
  const viewIds = walkIn ? ["wide", ...wallIds, "plan"] : ["main"];
  const viewLabel = (id) =>
    id === "wide" ? "Room view" : id === "main" ? "Your render" : id === "plan" ? "Plan"
      : plan?.walls[Number(id.slice(1))]?.name || WALL_NAMES[Number(id.slice(1))];
  const rendering = viewIds.some((id) => views[id]?.loading);

  const renderView = async (id, body) => {
    setViews((v) => ({ ...v, [id]: { ...v[id], loading: true, err: null } }));
    let img = null;
    let err = null;
    try {
      const prev = views[id]?.img;
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mimeType: "image/jpeg",
          brief: fullBrief(),
          messages,
          dims: dims(),
          baseRender: prev ? await shrink(prev, 1024, 0.8) : undefined,
          ...body,
        }),
      });
      const data = await res.json();
      if (data.imageBase64) img = data.imageBase64;
      else err = data.error || "Render failed. Try again.";
    } catch {
      err = "Couldn't reach the render service. Try again.";
    }
    setViews((v) => ({ ...v, [id]: { img: img || v[id]?.img || null, err, loading: false } }));
    return img;
  };

  const runRender = async () => {
    if (!walkIn) {
      await renderView("main", { imageBase64: photo, extraImages: photos.slice(1, 1 + RENDER_EXTRA_PHOTOS) });
      return;
    }
    setViews((v) => Object.fromEntries(viewIds.map((id) => [id, { ...v[id], loading: true, err: null }])));
    const small = await Promise.all(photos.map((p) => shrink(p, 768, 0.75)));
    // 1. One exact layout plan for the whole room. Every view below is built from it.
    let shared = {};
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planOnly: true, imageBase64: small[0], extraImages: small.slice(1), brief: fullBrief(), messages, dims: dims() }),
      });
      shared = await res.json();
    } catch {}
    const p = shared.plan || null;
    setPlan(p);
    const ids = faceOnWalls(p?.walls || []);
    setViews((v) => ({
      ...Object.fromEntries(Object.entries(v).filter(([id]) => !/^w\d/.test(id) || ids.includes(id))),
      plan: { loading: false, err: p ? null : "Couldn't work out the layout. Try re-rendering." },
    }));
    const common = { spec: shared.spec, finish: shared.finish, plan: p };

    // 2. The room view on the overview photo, following the plan drawn onto that photo, then
    // each wall built from its own plan drawing. Both come from the same plan, so they match.
    const g = p ? await layoutGuide(photo, p) : null;
    setGuide(g);
    const room = await renderView("wide", { ...common, view: "wide", imageBase64: photo, extraImages: small.slice(1), layoutGuide: g || undefined });
    const base = room || views.wide?.img;
    if (!base || !p) {
      setViews((v) => ({ ...v, ...Object.fromEntries(ids.map((id) => [id, { ...v[id], loading: false, err: "The room view needs to render first. Try re-rendering." }])) }));
      return;
    }
    // Each wall: its to-scale plan drawing sets the layout, the room view sets the look.
    const roomImage = await shrink(base, 1024, 0.85);
    const guides = await Promise.all(p.walls.map((w) => planImage(w, p)));
    await Promise.all(
      ids.map(async (id, k) => {
        const i = Number(id.slice(1));
        await sleep(k * 400); // stagger starts so the image API isn't hit all at once
        if (!guides[i]) {
          setViews((v) => ({ ...v, [id]: { ...v[id], loading: false, err: "Couldn't draw this wall's plan. Try re-rendering." } }));
          return null;
        }
        return renderView(id, { ...common, view: "wall", wallIndex: i, imageBase64: guides[i], roomImage, baseRender: undefined });
      }),
    );
  };

  const askDesigner = async (msgs) => {
    try {
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, imageBase64: photo, extraImages: photos.slice(1) }),
      });
      const data = await res.json();
      return data.text || "Tell me a bit more about the space — wall width and ceiling height are the two the studio needs first.";
    } catch {
      return "Tell me a bit more about the space — wall width and ceiling height are the two the studio needs first.";
    }
  };

  const startDesign = async () => {
    if (!photo || !fullBrief()) return;
    setStage("design");
    setActive(walkIn ? "wide" : "main");
    setPlan(null);
    setGuide(null);
    setThinking(true);
    runRender(); // fire the images in parallel
    const opener = [{ role: "user", content: `Here is my brief: ${fullBrief()}. ${photos.length > 1 ? `The ${photos.length} attached photos show the actual space this wardrobe will be fitted into; the first is the main view.` : "The attached photo is the actual space this wardrobe will be fitted into."}` }];
    const reply = await askDesigner(opener);
    setMessages([{ role: "assistant", content: reply }]);
    setThinking(false);
  };

  const send = async () => {
    const t = input.trim();
    if (!t || thinking) return;
    const next = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    setThinking(true);
    const history = [
      { role: "user", content: `Here is my brief: ${fullBrief()}. ${photos.length > 1 ? `The ${photos.length} attached photos show the actual space; the first is the main view.` : "The attached photo is the actual space."}` },
      ...next,
    ];
    const reply = await askDesigner(history);
    setMessages([...next, { role: "assistant", content: reply }]);
    setThinking(false);
  };

  const submitLead = async () => {
    if (!lead.name || !lead.email) return;
    await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...lead, spec: [...picked, ...(brief.trim() ? [brief.trim()] : [])], notes: fullBrief() }),
    });
    setStage("done");
  };

  const spec = [...picked, ...(brief.trim() ? [brief.trim()] : [])];

  return (
    <div className="wrap">
      <div className="inner">
        <div className="topbar">
          <div className="logo-text">Thryve Growth</div>
          <div className="tag">Bespoke fitted wardrobes · designed to your room</div>
        </div>

        {stage !== "done" && (
          <div className="hero">
            <h1>Your wardrobe, drawn to fit.</h1>
            <p className="sub">
              Upload photos of your space, shape the layout with our studio designer, and see it
              in your own room. When it's right, request a quote from the joiners who'll build it.
            </p>
          </div>
        )}

        {stage === "intake" && (
          <div className="panel grid">
            <div className="col">
              <div className="stepnum">Step one</div>
              <div className="steph">Show us the space</div>
              <div className="drop" onClick={() => fileRef.current?.click()}>
                {photo ? <img src={photo} alt="Your space" /> : (
                  <>
                    <div className="ico">+</div>
                    <div>Tap to upload a photo of your wall, alcove or closet</div>
                    <div style={{ fontSize: 12 }}>Add a few angles if you can</div>
                  </>
                )}
              </div>
              {photos.length > 0 && (
                <div className="thumbs">
                  {photos.map((p, i) => (
                    <div key={i} className={"thumb" + (i === 0 ? " main" : "")}>
                      <img src={p} alt={i === 0 ? "Main view" : `Extra view ${i}`} onClick={() => i > 0 && makeMain(i)} title={i === 0 ? "Main view" : "Make this the main view"} />
                      {i === 0 && <span className="tag">Main</span>}
                      <button className="x" onClick={() => removePhoto(i)} aria-label="Remove photo">×</button>
                    </div>
                  ))}
                  {photos.length < MAX_PHOTOS && (
                    <button className="thumb add" onClick={() => fileRef.current?.click()}>+ Add</button>
                  )}
                </div>
              )}
              <p className="footnote" style={{ textAlign: "left", marginTop: 8 }}>
                Add up to {MAX_PHOTOS} photos from different angles. The main photo is the view we design on; tap another photo to make it the main one.
              </p>
              {photos.length > 0 && (
                <label className="wallmode">
                  <input type="checkbox" checked={walkIn} onChange={(e) => setWallChoice(e.target.checked)} />
                  <span>It's a walk-in: my main photo shows the whole room from the doorway. Show me the room fitted out, each wall face-on, and a to-scale plan. Extra photos can be close-ups.</span>
                </label>
              )}
              {photos.length > 0 && (
                <div className="dims">
                  <p className="lbl">Measurements (mm), so the design fits your real room:</p>
                  {(walkIn ? WALL_KEYS : ["main"]).map((k, i) => (
                    <label key={k} className="dim">
                      <span>{walkIn ? `${WALL_NAMES[i]} width (from the doorway)` : "Wall width"}</span>
                      <input inputMode="decimal" placeholder="e.g. 2400" value={widths[k] || ""} onChange={(e) => setWidths((w) => ({ ...w, [k]: e.target.value }))} />
                    </label>
                  ))}
                  <label className="dim">
                    <span>Ceiling height</span>
                    <input inputMode="decimal" placeholder="e.g. 2400" value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
                  </label>
                  {walkIn && (
                    <label className="dim">
                      <span>Room depth (door to back wall)</span>
                      <input inputMode="decimal" placeholder="e.g. 1800" value={depth} onChange={(e) => setDepth(e.target.value)} />
                    </label>
                  )}
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFile} style={{ display: "none" }} />
            </div>
            <div className="col">
              <div className="stepnum">Step two</div>
              <div className="steph">Tell us what you need</div>
              <p className="lbl">Add the essentials — tap any that apply:</p>
              <div className="chips">
                {CHIPS.map((c) => (
                  <button key={c} className={"chip" + (picked.includes(c) ? " on" : "")} onClick={() => toggleChip(c)}>{c}</button>
                ))}
              </div>
              <p className="lbl" style={{ marginTop: 14 }}>Anything else? Style, finish, what you store…</p>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. Mostly hanging with 4 drawers and a shoe rack at the base. Finish: warm oak with matte black rails."
              />
              <button className="cta" disabled={!photo || !fullBrief()} onClick={startDesign}>Generate my design</button>
            </div>
          </div>
        )}

        {stage === "design" && (
          <>
            <div className="panel grid">
              <div className="col">
                <div className="stepnum">Your space, reimagined</div>
                <div className="steph">{walkIn ? "Your renders" : "Your render"}</div>
                {walkIn && (
                  <div className="viewtabs">
                    {viewIds.map((id) => (
                      <button key={id} className={"vtab" + (active === id ? " on" : "")} onClick={() => setActive(id)}>
                        {viewLabel(id)}
                        {views[id]?.loading && <span className="dot" aria-label="rendering" />}
                      </button>
                    ))}
                  </div>
                )}
                {(() => {
                  const v = views[active] || {};
                  if (active === "plan") {
                    return (
                      <div className="planview">
                        {v.loading && <p className="note">Working out the layout…</p>}
                        {guide && (
                          <div>
                            <h4>Your plan in your room</h4>
                            <img src={guide} alt="The planned wardrobe drawn onto your photo" style={{ width: "100%", borderRadius: 3, display: "block" }} />
                          </div>
                        )}
                        {!v.loading && v.err && <p className="note">{v.err}</p>}
                        {plan?.walls.map((w) => (
                          <div key={w.name}>
                            <h4>{w.name} · {w.width}mm</h4>
                            <Elevation wall={w} ceiling={plan.ceiling} colour={plan.colour} finish={plan.finish} scaleTo={Math.max(...plan.walls.map((x) => x.width))} />
                          </div>
                        ))}
                        {plan && <p className="note">To-scale plan of the design{plan.finish ? ` in ${plan.finish}` : ""}. Every render is built from this layout; final sizes are confirmed at measure-up.</p>}
                      </div>
                    );
                  }
                  return (
                    <div className={"render" + (walkIn ? " fit" : "")}>
                      {v.loading && (
                        <div className="loading">
                          {walkIn ? (plan ? `Rendering the ${viewLabel(active).toLowerCase()}…` : "Planning the layout…") : "Rendering your wardrobe into the room…"}
                          <br />(10–30 seconds)
                        </div>
                      )}
                      {!v.loading && v.img && <img src={v.img} alt={`${viewLabel(active)} render`} />}
                      {!v.loading && v.err && <div className="err">{v.err}</div>}
                      {!v.loading && v.img && <div className="rlabel">{walkIn ? `${viewLabel(active)} · indicative render` : "Indicative render"}</div>}
                    </div>
                  );
                })()}
                {!rendering && (
                  <button className="rerender" onClick={runRender}>
                    ↻ Re-render {walkIn ? "all views" : ""} with the latest changes
                  </button>
                )}
              </div>

              <div className="col">
                <div className="stepnum">Studio designer</div>
                <div className="steph">Refine your design</div>
                <div className="chat">
                  {messages.map((m, i) => (
                    <div key={i} className={"msg " + (m.role === "user" ? "u" : "a")}>{m.content}</div>
                  ))}
                  {thinking && <div className="msg think">Designing…</div>}
                </div>
                <div className="composer">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && send()}
                    placeholder="Make the drawers deeper, add a mirror…"
                  />
                  <button onClick={send}>Send</button>
                </div>
              </div>
            </div>

            <button
              className="cta brass"
              onClick={() => setStage("quote")}
              style={{ marginTop: 18, maxWidth: 420, marginLeft: "auto", marginRight: "auto", display: "block" }}
            >
              Happy with your design? Next step: your details →
            </button>
          </>
        )}

        {stage === "quote" && (
          <div className="panel" style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
            <div className="stepnum">Almost there</div>
            <div className="steph">Where should the studio send your quote?</div>
            <input className="field" placeholder="Full name" value={lead.name} onChange={(e) => setLead({ ...lead, name: e.target.value })} />
            <input className="field" placeholder="Email" value={lead.email} onChange={(e) => setLead({ ...lead, email: e.target.value })} />
            <input className="field" placeholder="Phone (optional)" value={lead.phone} onChange={(e) => setLead({ ...lead, phone: e.target.value })} />
            <input className="field" placeholder="Suburb (optional)" value={lead.suburb} onChange={(e) => setLead({ ...lead, suburb: e.target.value })} />
            <button className="cta brass" disabled={!lead.name || !lead.email} onClick={submitLead}>Send my design to the studio</button>
            <p className="footnote" style={{ marginTop: 12 }}>Your photos, render and notes go straight to the workshop so they can price the exact build.</p>
          </div>
        )}

        {stage === "done" && (
          <div className="panel done">
            <div className="tick">✦</div>
            <h2>Your design is with the studio, {lead.name.split(" ")[0]}.</h2>
            <p style={{ color: "var(--muted)", maxWidth: 440, margin: "0 auto" }}>
              A joiner will review your space and come back with a fixed quote, usually within two working days.
            </p>
            <div className="package">
              <div className="k">Requested features</div>
              <p className="v">{spec.length ? spec.join(", ") : "Custom joinery"}</p>
              <div className="k">Contact</div>
              <p className="v">{lead.name} · {lead.email}{lead.phone ? " · " + lead.phone : ""}{lead.suburb ? " · " + lead.suburb : ""}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
