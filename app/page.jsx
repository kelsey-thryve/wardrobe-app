"use client";
import { useState, useRef } from "react";

const STUDIO = "Boston Wardrobes";

const CHIPS = [
  "Full-height hanging rails",
  "Bank of soft-close drawers",
  "Open cube shelves",
  "Dedicated shoe racks",
  "Integrated LED lighting",
  "Full-length mirror",
];

export default function Page() {
  const [photo, setPhoto] = useState(null);
  const [brief, setBrief] = useState("");
  const [picked, setPicked] = useState([]);
  const [stage, setStage] = useState("intake"); // intake | design | quote | done
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderImg, setRenderImg] = useState(null);
  const [renderErr, setRenderErr] = useState(null);
  const [lead, setLead] = useState({ name: "", email: "", phone: "", suburb: "" });
  const fileRef = useRef(null);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
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
          setPhoto(c.toDataURL("image/jpeg", 0.9));
        } catch {
          setPhoto(r.result);
        }
      };
      img.onerror = () => setPhoto(r.result);
      img.src = r.result;
    };
    r.readAsDataURL(f);
  };

  const toggleChip = (c) =>
    setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));

  const fullBrief = () => {
    const parts = [];
    if (picked.length) parts.push(picked.join(", "));
    if (brief.trim()) parts.push(brief.trim());
    return parts.join(". ");
  };

  const runRender = async () => {
    setRendering(true);
    setRenderErr(null);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: photo, mimeType: "image/jpeg", brief: fullBrief() }),
      });
      const data = await res.json();
      if (data.imageBase64) setRenderImg(data.imageBase64);
      else setRenderErr(data.error || "Render failed. Try again.");
    } catch {
      setRenderErr("Couldn't reach the render service. Try again.");
    }
    setRendering(false);
  };

  const askDesigner = async (msgs) => {
    try {
      const res = await fetch("/api/design", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: msgs, imageBase64: photo }),
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
    setThinking(true);
    runRender(); // fire the image in parallel
    const opener = [{ role: "user", content: `Here is my brief: ${fullBrief()}. The attached photo is the actual space this wardrobe will be fitted into.` }];
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
      { role: "user", content: `Here is my brief: ${fullBrief()}. The attached photo is the actual space.` },
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
              Upload a photo of your space, shape the layout with our studio designer, and see it
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
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
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
              <p className="lbl" style={{ marginTop: 14 }}>Anything else? Dimensions, style, finish…</p>
              <textarea
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. 2.4m wide wall, floor to 2.7m ceiling. Mostly hanging with 4 drawers and a shoe rack at the base. Finish: warm oak with matte black rails."
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
                <div className="steph">Your render</div>
                <div className="render">
                  {rendering && <div className="loading">Rendering your wardrobe into the room…<br />(10–30 seconds)</div>}
                  {!rendering && renderImg && <img src={renderImg} alt="Your wardrobe render" />}
                  {!rendering && renderErr && <div className="err">{renderErr}</div>}
                  {!rendering && renderImg && <div className="rlabel">Indicative render</div>}
                </div>
                {!rendering && (
                  <button className="rerender" onClick={runRender}>↻ Re-render with the latest changes</button>
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
            <p className="footnote" style={{ marginTop: 12 }}>Your photo, render and notes go straight to the workshop so they can price the exact build.</p>
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
