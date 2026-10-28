// Server-side render: the browser NEVER sees the Gemini key.
// Browser -> this route (holds key) -> Gemini image API -> image back.
import { cleanOutline, normalisePlan, planWallText } from "../../../lib/plan";

export const runtime = "nodejs";
export const maxDuration = 60; // renders can take 10-30s

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image";
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";

// The best image model is often overloaded (503). Retry it once, then fall back to the
// next-best models so the customer still gets a render.
const FALLBACK_MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image"];
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const START_CUTOFF_MS = 35000; // don't start a new attempt this late; maxDuration is 60s
const BUSY_MESSAGE = "Our image designer is very busy right now. Please try again in a minute.";
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
// Thinking tokens count against maxOutputTokens; keep thinking short so answers aren't cut off.
const THINKING = /^gemini-2\.5/.test(TEXT_MODEL) ? { thinkingBudget: 512 } : /^gemini-[3-9]/.test(TEXT_MODEL) ? { thinkingLevel: "low" } : undefined;

// Ask the text model; returns { ok, text } with thought parts left out. If the model doesn't
// accept the thinking setting, asks again without it.
async function askText(key, body) {
  const ask = (thinking) =>
    fetch(`${API_BASE}/${TEXT_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        generationConfig: { ...body.generationConfig, ...(thinking && { thinkingConfig: thinking }) },
      }),
    });
  let r = await ask(THINKING);
  let j = await r.json();
  if (r.status === 400 && THINKING && /think/i.test(j?.error?.message || "")) {
    r = await ask(undefined);
    j = await r.json();
  }
  const text = (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || "").join("").trim();
  return { ok: r.ok, text };
}

const inline = (dataUrl, fallbackMime) => ({
  inlineData: {
    mimeType: dataUrl.match(/^data:([^;]+);/)?.[1] || fallbackMime,
    data: dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl,
  },
});

// Image models tend to default to white joinery, so the finish is stated first and
// spelled out for every part of the wardrobe.
function finishLine(finish) {
  if (!finish) return "";
  return (
    `FINISH (most important): every visible part of the wardrobe — carcass, side panels, ` +
    `top, shelves, drawer fronts, doors and cube dividers — is ${finish}. The joinery must ` +
    `clearly read as ${finish}; do not render it white or painted unless that is the finish.\n\n`
  );
}

const MAX_EXTRA_PHOTOS = 2; // other views of the room, for context
const MAX_WALL_PHOTOS = 5; // walk-in mode: every wall photo is sent (downsized by the browser)

// Real measurements from the customer (mm). They fix the size of the room and the joinery,
// because the image model otherwise tends to make rooms bigger than they are.
const mm = (n) => `${Math.round(n)}mm`;
const validMm = (n) => (Number.isFinite(n) && n >= 300 && n <= 15000 ? n : null);

const SCALE_RULE =
  "SCALE: keep the room exactly the size it is in the photos. Do not lengthen walls, raise " +
  "the ceiling, widen or deepen the room, or add floor space, and do not add wardrobe " +
  "sections that would not fit. Never mirror or flip a photo: windows, doors and corners " +
  "stay on the same side as in the photo.\n\n";

function sizeLine(width, ceiling, depth) {
  const w = validMm(width), h = validMm(ceiling), d = validMm(depth);
  if (!w && !h && !d) return SCALE_RULE;
  const facts = [
    w && `the wall is ${mm(w)} wide from corner to corner`,
    h && `the ceiling is ${mm(h)} high`,
    d && `the room is ${mm(d)} deep from the doorway to the back wall`,
  ].filter(Boolean).join(", ");
  // A typical wardrobe section is 450-900mm wide; give the model a sensible split to draw.
  const bays = w ? Math.max(1, Math.round(w / 800)) : 0;
  const fit = [
    w && `split the wall into ${bays} section${bays > 1 ? "s" : ""} of about ${mm(w / bays)} each`,
    h && `run the joinery up to ${mm(h)}`,
    "hanging sections are about 600mm deep",
    d && `leave the rest of the ${mm(d)} depth as clear floor`,
  ].filter(Boolean).join(", ");
  return (
    `MEASUREMENTS (exact, the real room): ${facts}. Draw everything to this scale: ${fit}. ` +
    "A standard door is about 2040mm tall and 820mm wide; use that to keep proportions right.\n" +
    SCALE_RULE
  );
}

// Images 2..n+1: other photos of the same room, to help the model understand it.
function extraLine(n) {
  if (!n) return "";
  const which = n === 1 ? "Image 2 is another photo" : `Images 2 to ${n + 1} are other photos`;
  return (
    `${which} of the same room from a different angle. Use ${n === 1 ? "it" : "them"} ONLY to ` +
    "understand the space (its depth, wall lengths, ceiling, and what is out of frame in " +
    "image 1). Do not render from their viewpoints.\n\n"
  );
}

function buildPrompt(spec, finish, extras = 0, size = SCALE_RULE) {
  return (
    "You are a photorealistic interior render engine for a bespoke fitted-wardrobe " +
    "joinery studio. Using image 1, the photograph of the customer's actual room, as the " +
    "exact base, design and render a custom fitted wardrobe built into the same wall/alcove. " +
    "CRITICAL: preserve the room's real geometry, perspective, wall positions, window and " +
    "door placement, flooring and natural lighting exactly as photographed — do not restyle " +
    "the room or move anything. Only add the wardrobe joinery, seamlessly integrated and " +
    "correctly scaled to the space, with realistic shadows and materials.\n\n" +
    extraLine(extras) +
    size +
    finishLine(finish) +
    `Wardrobe specification from the customer: ${spec}\n\n` +
    "Render as a single photorealistic image, same camera angle as image 1."
  );
}

// Re-render: start again from the room photo, using the previous render only as a layout
// guide. Asking the model to edit the previous render tends to return it unchanged.
function buildRerenderPrompt(spec, finish, extras = 0, size = SCALE_RULE) {
  const concept = 2 + extras;
  return (
    "You are a photorealistic interior render engine for a bespoke fitted-wardrobe " +
    `joinery studio. Image 1 is a photograph of the customer's actual room. Image ${concept} is an ` +
    "earlier concept of their wardrobe. Render the wardrobe into the room in image 1, " +
    "keeping the room's geometry, perspective, flooring and natural light exactly as " +
    `photographed. Use image ${concept} ONLY as a guide to the layout (where the hanging, shelves, ` +
    "cubes, drawers and shoe racks sit). The materials, colour, doors and lighting MUST " +
    `follow the specification below, NOT image ${concept} — the customer has changed them.\n\n` +
    extraLine(extras) +
    size +
    finishLine(finish) +
    `Final wardrobe specification: ${spec}\n\n` +
    "Render as a single photorealistic image, same camera angle as image 1."
  );
}

// Walk-in mode. Photo 1 is an overview of the room from the doorway; any others are close-ups.
// One layout plan drives everything: the room view is rendered on the overview photo, each
// wall's face-on view is a reframing of that finished room view (so the joinery is the same),
// and the browser draws to-scale elevations from the plan itself.
function planLines(plan) {
  return plan ? `LAYOUT (follow exactly, walls as seen from the doorway):\n${plan.walls.map((w) => `- ${planWallText(w)}`).join("\n")}\n\n` : "";
}

function buildRoomPrompt(spec, finish, plan, closeups, hasConcept, size = SCALE_RULE, hasGuide = false) {
  if (hasGuide) return buildGuidedRoomPrompt(spec, finish, plan, hasConcept, size);
  const concept = 2 + closeups;
  return (
    "You are a photorealistic interior render engine for a bespoke fitted-wardrobe " +
    "joinery studio. Image 1 is the customer's room photographed from the doorway. " +
    (closeups ? `${closeups === 1 ? "Image 2 is a close-up" : `Images 2 to ${closeups + 1} are close-ups`} ` +
      "of parts of the same room, for detail only; do not render from their viewpoints. " : "") +
    "Render the room in image 1 from exactly the same camera angle with the custom fitted " +
    "wardrobe built in, following the layout below wall by wall. Replace any existing " +
    "shelving with the new design. The result MUST clearly show the new fitted wardrobe. Keep " +
    "the room's real geometry, perspective, windows, doors, ceiling, flooring and light exactly " +
    "as photographed. " +
    (hasConcept ? `Image ${concept} is an earlier concept of this view: use it ONLY as a guide; ` +
      "the layout below and the specification win. " : "") +
    "\n\n" +
    planLines(plan) +
    size +
    finishLine(finish) +
    `Wardrobe specification: ${spec}\n\n` +
    "Render as a single photorealistic image, same camera angle as image 1."
  );
}

// With a layout guide (image 2: the photo with each wall's plan drawing warped onto it), the
// room view has to follow the same plan the wall views are drawn from.
function buildGuidedRoomPrompt(spec, finish, plan, hasConcept, size) {
  return (
    "You are a photorealistic interior render engine for a bespoke fitted-wardrobe " +
    "joinery studio. Image 1 is the customer's room photographed from the doorway. Image 2 is " +
    "the APPROVED layout: the same photo with the planned fitted wardrobe drawn flat onto each " +
    "wall. Render image 1 from exactly the same camera angle as a real photograph with that " +
    "wardrobe built in: on every wall, the same sections in the same places, at the same widths " +
    "and heights, with the shelves, hanging rails, drawers, windows and doors exactly where " +
    "image 2 shows them. Do not add, remove or rearrange sections. Image 2 is only a diagram: " +
    "use real materials, depth, shadows and lighting, not its flat drawing style. Replace any " +
    "existing shelving with this design. Keep the room's real geometry, perspective, windows, " +
    "doors, ceiling, flooring and light exactly as photographed. " +
    (hasConcept ? "Image 3 is an earlier render of this view: use it only for the look; image 2 " +
      "wins on layout. " : "") +
    "\n\n" +
    planLines(plan) +
    size +
    finishLine(finish) +
    `Wardrobe specification: ${spec}\n\n` +
    "Render as a single photorealistic image, same camera angle as image 1."
  );
}

// Each wall is drawn from its own to-scale plan drawing (image 1) for layout and proportions,
// and the approved room view (image 2) for materials and lighting, so it matches both.
function buildWallPrompt(spec, finish, plan, wallIndex, hasRoom, size = SCALE_RULE) {
  const wall = plan.walls[wallIndex];
  return (
    "You are a photorealistic interior render engine for a bespoke fitted-wardrobe " +
    `joinery studio. Image 1 is the APPROVED to-scale layout drawing of the ${wall.name.toLowerCase()}: ` +
    `it shows the whole wall edge to edge and floor to ceiling (${mm(wall.width)} wide, ` +
    `${mm(plan.ceiling)} high), with every section, shelf, hanging rail, drawer, window and door ` +
    "at its exact position and size. " +
    (hasRoom ? "Image 2 is the approved render of the same room: it shows the materials, finish, " +
      "handles, lighting, flooring and wall colour. " : "") +
    "Render a photorealistic, face-on photo of this wall that matches image 1 EXACTLY in layout " +
    "and proportions: the same framing (the left and right edges of the photo are the wall's " +
    "corners, the floor is at the bottom and the ceiling at the top), the same number and widths " +
    "of sections, shelves and drawers at the same heights, and windows and doors exactly where " +
    "they are drawn. " +
    (hasRoom ? "Match image 2 for materials, colours, finish, handles and lighting. " : "") +
    "Do not add, remove, widen or move anything, and show no labels or dimension lines. The " +
    "garment shapes in the drawing only mark hanging space; show the rails with a few clothes or " +
    "empty.\n\n" +
    `This wall: ${planWallText(wall)}.\n` +
    size +
    finishLine(finish) +
    `Wardrobe specification: ${spec}\n\n` +
    "Render as a single photorealistic image."
  );
}

// Closest aspect ratio the image model supports, so a wall render has the wall's own shape.
const RATIOS = ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"];
function closestRatio(w, h) {
  const target = Math.log(w / h);
  return RATIOS.reduce((best, r) => {
    const [a, b] = r.split(":").map(Number);
    const [c, d] = best.split(":").map(Number);
    return Math.abs(Math.log(a / b) - target) < Math.abs(Math.log(c / d) - target) ? r : best;
  });
}

// Merge the original brief and the designer chat into one up-to-date spec, so changes
// agreed in the chat (e.g. "make it American walnut") actually reach the image model.
async function consolidateSpec(key, brief, messages) {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "Customer" : "Designer"}: ${m.content}`)
    .join("\n");
  const fallback = {
    finish: null,
    spec:
      `${brief}. Later changes from the customer, which override the above: ` +
      messages.filter((m) => m.role === "user").map((m) => m.content).join(". "),
  };

  try {
    const { ok, text } = await askText(key, {
      systemInstruction: {
        parts: [{
          text:
            "You turn a wardrobe design conversation into a render specification. Reply in " +
            "exactly two lines and nothing else:\n" +
            "FINISH: <the timber or colour of the whole wardrobe, e.g. 'dark American walnut " +
            "timber veneer', or 'none' if never chosen>\n" +
            "SPEC: <one plain paragraph: finish and colour, doors and handles, lighting, " +
            "hanging, drawers, shelves, extras and dimensions>\n" +
            "Where the customer changed their mind, use their LATEST choice and drop the old " +
            "one. If the customer agreed to a designer suggestion (e.g. said yes), include it. " +
            "Do not mention anything that was replaced.",
        }],
      },
      contents: [{ role: "user", parts: [{ text: `Original brief: ${brief}\n\nConversation:\n${transcript}` }] }],
      generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
    });
    if (!ok || !text) return fallback;

    const finish = text.match(/^FINISH:\s*(.+)$/im)?.[1]?.trim();
    const spec = text.match(/^SPEC:\s*([\s\S]+)$/im)?.[1]?.trim() || text;
    return { finish: finish && !/^none\.?$/i.test(finish) ? finish : null, spec };
  } catch {
    return fallback;
  }
}

const SECTION_LIST =
  "long-hang, double-hang, shelves, drawers, drawers-shelves, shoes, corner-shelves, bench, " +
  "mirror, window, door, gap";

// Walk-in mode: one exact layout plan for the whole room, from the brief, chat, photos and
// measurements. Returns { finish, spec, plan } (plan normalised by lib/plan.js).
async function planLayout(key, brief, messages, images, dims) {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "Customer" : "Designer"}: ${m.content}`)
    .join("\n");
  const widths = Array.isArray(dims.widths) ? dims.widths.map(Number) : [];
  const known = ["left", "back", "right"]
    .map((n, i) => (validMm(widths[i]) ? `${n} wall ${mm(widths[i])} wide` : null)).filter(Boolean);
  const facts = [...known, validMm(Number(dims.ceiling)) && `ceiling ${mm(Number(dims.ceiling))}`,
    validMm(Number(dims.depth)) && `room depth ${mm(Number(dims.depth))}`].filter(Boolean);
  try {
    const { ok, text } = await askText(key, {
      systemInstruction: {
        parts: [{
          text:
            "You are the lead designer at a fitted-wardrobe joinery studio. Image 1 shows the " +
            "customer's walk-in room from the doorway; any other images are close-ups of it. " +
            "Design the fitted wardrobe and return ONLY JSON:\n" +
            '{"finish": "<timber or colour, e.g. light oak timber veneer>", "colour": "<hex of ' +
            'that finish>", "spec": "<one plain paragraph describing the finished design>", ' +
            '"walls": [{"name": "Left wall", "width": <mm>, "sections": [{"type": "<type>", ' +
            '"width": <mm>}], "outline": [[x, y], [x, y], [x, y], [x, y]]}]}\n' +
            "Walls are as seen from the doorway in image 1, in order: Left wall, Back wall, " +
            "Right wall (skip any that isn't visible). Sections run left to right as you face " +
            `that wall, their widths add up to the wall width. Section types: ${SECTION_LIST}. ` +
            "Mark real windows and doors with the window and door types at their true positions. " +
            "Use the customer's measurements exactly where given; otherwise estimate from the " +
            "photos. Typical widths: hanging 600-1000mm, drawers 450-900mm, shelves 300-900mm. " +
            "Follow the brief and the customer's latest choices in the conversation. " +
            "outline is where that whole wall appears in image 1, as fractions of image 1's width " +
            "and height (0 to 1, origin top left), in this order: the wall's top-left corner (where " +
            "it meets the ceiling), top-right corner, bottom-right corner (where it meets the " +
            "floor), bottom-left corner. Left and right are as seen in image 1. A corner hidden " +
            "out of frame may lie a little outside 0 to 1. Be precise: the layout is drawn onto " +
            "the photo at these corners.",
        }],
      },
      contents: [{
        role: "user",
        parts: [
          ...images.slice(0, MAX_WALL_PHOTOS).map((img) => inline(img, "image/jpeg")),
          { text: `Brief: ${brief}\n${facts.length ? `Measurements: ${facts.join(", ")}\n` : ""}\nConversation:\n${transcript || "(none yet)"}` },
        ],
      }],
      generationConfig: { maxOutputTokens: 4096, temperature: 0.2, responseMimeType: "application/json" },
    });
    if (!ok || !text) return { finish: null, spec: brief, plan: null };
    const raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    const plan = normalisePlan(raw, { widths, ceiling: dims.ceiling });
    return { finish: plan?.finish || null, spec: String(raw.spec || brief), plan };
  } catch {
    return { finish: null, spec: brief, plan: null };
  }
}

const wallSide = (name) => (/left/i.test(name) ? "left" : /right/i.test(name) ? "right" : /back|rear|end/i.test(name) ? "back" : null);

// Walk-in mode: where the left, back and right walls sit in the doorway photo, as four
// corners each (fractions of the image), so the plan can be drawn onto the photo.
async function findWalls(key, image) {
  if (!image) return {};
  try {
    const { ok, text } = await askText(key, {
      systemInstruction: {
        parts: [{
          text:
            "You locate the walls of a room in a photo taken from its doorway. Find the corners " +
            "where the walls meet each other, the ceiling and the floor. Return ONLY JSON:\n" +
            '{"left": Q, "back": Q, "right": Q} where each Q is {"top_left": [x, y], ' +
            '"top_right": [x, y], "bottom_right": [x, y], "bottom_left": [x, y]} or null if that ' +
            "wall isn't visible.\n" +
            "x and y are integers from 0 to 1000 across the image's width and down its height " +
            "(0,0 is the top-left of the image). The back wall faces the camera. The left wall " +
            "runs from the camera to the back wall on the left: its right edge is the corner " +
            "where it meets the back wall, its left edge is nearest the camera. The right wall " +
            "mirrors it: its left edge is the corner with the back wall. Top corners are where " +
            "a wall meets the ceiling, bottom corners where it meets the floor. The left wall's " +
            "right edge and the back wall's left edge are the same vertical corner line, and " +
            "likewise on the right. Corners nearest the camera are often out of frame: give " +
            "their position extended past the edge of the image (below 0 or above 1000). " +
            "Locate the real corner lines in the photo; furniture and clutter don't move them.",
        }],
      },
      contents: [{ role: "user", parts: [inline(image, "image/jpeg"), { text: "Locate the walls." }] }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0, responseMimeType: "application/json" },
    });
    if (!ok || !text) return {};
    const raw = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    const out = {};
    for (const side of ["left", "back", "right"]) {
      const q = raw?.[side];
      const pts = q && ["top_left", "top_right", "bottom_right", "bottom_left"].map((k) => q[k]);
      const o = pts && cleanOutline(pts.map((p) => (Array.isArray(p) ? [p[0] / 1000, p[1] / 1000] : null)));
      if (o) out[side] = o;
    }
    return out;
  } catch {
    return {};
  }
}

export async function POST(request) {
  const started = Date.now();
  try {
    const {
      imageBase64, extraImages = [], mimeType = "image/jpeg", brief = "", messages = [], baseRender,
      // Walk-in mode: "planOnly" returns the shared plan; "wide" and "wall" render from it.
      planOnly = false, view = "match", wallIndex = 0, spec: givenSpec, finish: givenFinish, plan: givenPlan,
      dims = {}, roomImage, layoutGuide,
    } = await request.json();

    const key = process.env.GEMINI_API_KEY;
    if (!key) return Response.json({ error: "Server not configured (GEMINI_API_KEY)" }, { status: 500 });

    if (planOnly) {
      const images = [imageBase64, ...extraImages].filter(Boolean);
      // The wall corners come from their own focused call, run alongside the design.
      const [out, corners] = await Promise.all([planLayout(key, brief, messages, images, dims), findWalls(key, images[0])]);
      if (out.plan) {
        out.plan.walls = out.plan.walls.map((w) => ({ ...w, outline: corners[wallSide(w.name)] || w.outline }));
        console.log("[plan] outlines", JSON.stringify(out.plan.walls.map((w) => [w.name, w.outline])));
      }
      return Response.json(out);
    }
    if (!imageBase64) return Response.json({ error: "Missing image" }, { status: 400 });

    const hasChat = messages.some((m) => m.role === "user");
    const { finish, spec } = givenSpec
      ? { finish: givenFinish || null, spec: givenSpec }
      : hasChat ? await consolidateSpec(key, brief, messages) : { finish: null, spec: brief };

    // Always render from the room photo; a previous render only guides the layout.
    const walkIn = view === "wide" || view === "wall";
    const plan = walkIn ? normalisePlan(givenPlan, { widths: dims.widths, ceiling: dims.ceiling }) : null;
    if (view === "wall" && !plan?.walls[wallIndex]) return Response.json({ error: "Missing layout plan" }, { status: 400 });
    const guided = view === "wide" && !!layoutGuide;
    const extras = view === "wall" || guided ? [] : extraImages.slice(0, view === "match" ? MAX_EXTRA_PHOTOS : MAX_WALL_PHOTOS - 1);
    const concept = baseRender && (view === "match" || view === "wide");
    const parts = [inline(imageBase64, mimeType), ...extras.map((img) => inline(img, mimeType))];
    if (view === "wall" && roomImage) parts.push(inline(roomImage, "image/jpeg"));
    if (guided) parts.push(inline(layoutGuide, "image/jpeg"));
    if (concept) parts.push(inline(baseRender, "image/png"));
    const widths = Array.isArray(dims.widths) ? dims.widths.map(Number) : [];
    const ceiling = Number(dims.ceiling) || plan?.ceiling, depth = Number(dims.depth);
    const roomSize = plan
      ? `WALL WIDTHS (exact): ${plan.walls.map((w) => `${w.name.toLowerCase()} ${mm(w.width)}`).join(", ")}.\n` + sizeLine(undefined, ceiling, depth)
      : sizeLine(undefined, ceiling, depth);
    const prompt =
      view === "wall" ? buildWallPrompt(spec, finish, plan, wallIndex, !!roomImage, sizeLine(plan.walls[wallIndex].width, ceiling, depth))
      : view === "wide" ? buildRoomPrompt(spec, finish, plan, extras.length, concept, roomSize, guided)
      : baseRender ? buildRerenderPrompt(spec, finish, extras.length, sizeLine(widths[0], ceiling, depth))
      : buildPrompt(spec, finish, extras.length, sizeLine(widths[0], ceiling, depth));
    parts.push({ text: prompt });

    // Visible in the host's function logs, to check what the image model was asked for.
    console.log("[render]", JSON.stringify({ view, wallIndex, dims, roomImage: !!roomImage, guided, rerender: !!concept, extraPhotos: extras.length, finish, plan: plan && plan.walls.map(planWallText), spec }));

    const attempts = [MODEL, MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL)];
    // Wall renders take the wall's own shape (width to ceiling height).
    const aspectRatio = view === "wall" ? closestRatio(plan.walls[wallIndex].width, plan.ceiling) : null;
    const makeBody = (withRatio) => JSON.stringify({
      contents: [{ parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"], ...(withRatio && aspectRatio && { imageConfig: { aspectRatio } }) },
    });
    let useRatio = true;
    let out = null;
    let lastError = BUSY_MESSAGE;

    for (let i = 0; i < attempts.length && !out; i++) {
      if (Date.now() - started > START_CUTOFF_MS) break;
      if (i === 1) await sleep(1500); // brief pause before retrying the same model
      const model = attempts[i];
      try {
        let r = await fetch(`${API_BASE}/${model}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: makeBody(useRatio),
        });
        let j = await r.json();
        // A model that doesn't take an aspect ratio: ask again without it.
        if (r.status === 400 && useRatio && aspectRatio && /aspect|image_?config/i.test(j?.error?.message || "")) {
          useRatio = false;
          r = await fetch(`${API_BASE}/${model}:generateContent?key=${key}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: makeBody(false),
          });
          j = await r.json();
        }
        if (!r.ok) {
          console.log("[render] attempt failed", JSON.stringify({ model, status: r.status, error: j?.error?.message }));
          if (!RETRYABLE.has(r.status)) return Response.json({ error: j?.error?.message || "Gemini error" }, { status: r.status });
          continue;
        }
        for (const c of j.candidates || [])
          for (const p of c.content?.parts || []) if (p.inlineData) out = p.inlineData.data;
        if (!out) {
          console.log("[render] attempt failed", JSON.stringify({ model, error: "no image returned" }));
          lastError = "No image came back. Please try again.";
        } else if (model !== MODEL) {
          console.log("[render] used fallback model", model);
        }
      } catch (e) {
        console.log("[render] attempt failed", JSON.stringify({ model, error: String(e) }));
      }
    }
    if (!out) return Response.json({ error: lastError }, { status: 503 });

    return Response.json({ imageBase64: `data:image/png;base64,${out}` });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
