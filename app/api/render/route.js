// Server-side render: the browser NEVER sees the Gemini key.
// Browser -> this route (holds key) -> Gemini image API -> image back.
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

function buildPrompt(spec, finish, extras = 0) {
  return (
    "You are a photorealistic interior render engine for a bespoke fitted-wardrobe " +
    "joinery studio. Using image 1, the photograph of the customer's actual room, as the " +
    "exact base, design and render a custom fitted wardrobe built into the same wall/alcove. " +
    "CRITICAL: preserve the room's real geometry, perspective, wall positions, window and " +
    "door placement, flooring and natural lighting exactly as photographed — do not restyle " +
    "the room or move anything. Only add the wardrobe joinery, seamlessly integrated and " +
    "correctly scaled to the space, with realistic shadows and materials.\n\n" +
    extraLine(extras) +
    finishLine(finish) +
    `Wardrobe specification from the customer: ${spec}\n\n` +
    "Render as a single photorealistic image, same camera angle as image 1."
  );
}

// Re-render: start again from the room photo, using the previous render only as a layout
// guide. Asking the model to edit the previous render tends to return it unchanged.
function buildRerenderPrompt(spec, finish, extras = 0) {
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
    finishLine(finish) +
    `Final wardrobe specification: ${spec}\n\n` +
    "Render as a single photorealistic image, same camera angle as image 1."
  );
}

// Walk-in mode: the customer sent one photo per wall. Each wall gets a face-on render, plus
// one wide shot of the whole room, all from the same spec so the walls stay consistent.
function wallPlanLine(plan) {
  return plan ? `What this wall holds (follow this): ${plan}\n\n` : "";
}

function buildWallPrompt(spec, finish, wall, walls, others, plan, hasConcept) {
  const concept = 2 + others;
  return (
    "You are a photorealistic interior render engine for a bespoke fitted-wardrobe " +
    `joinery studio. The customer photographed each wall of their room. Image 1 is wall ${wall} ` +
    `of ${walls}. ` +
    (others ? `Images 2 to ${others + 1} are the other walls, for context only, so the design ` +
      "matches across walls and the corners line up. " : "") +
    "Render a FACE-ON view of the wall in image 1 with its custom fitted wardrobe built in: " +
    "camera centred and square to the wall at standing eye height, vertical lines straight, " +
    "the whole wall in frame from floor to ceiling. Keep the wall's real width, height, " +
    "windows, doors, sloped ceiling, skirting, flooring and lighting from image 1. " +
    (hasConcept ? `Image ${concept} is an earlier face-on concept of this wall: use it ONLY as a ` +
      "guide to the layout; the materials, colour, doors and lighting MUST follow the " +
      "specification below — the customer may have changed them. " : "") +
    "\n\n" +
    wallPlanLine(plan) +
    finishLine(finish) +
    `Wardrobe specification for the whole room: ${spec}\n\n` +
    "Render as a single photorealistic image."
  );
}

function buildWidePrompt(spec, finish, walls, hasConcept) {
  return (
    "You are a photorealistic interior render engine for a bespoke fitted-wardrobe " +
    `joinery studio. Images 1 to ${walls} are photos of each wall of the customer's room, in ` +
    "order. Render ONE wide-angle view of the whole room fitted out, as if standing in the " +
    "doorway looking in, showing as many walls as possible. Keep the room's real shape, " +
    "size, windows, doors, ceiling and flooring from the photos. Every wall's joinery must " +
    "match its own face-on design and share one consistent finish. " +
    (hasConcept ? `Image ${walls + 1} is an earlier wide concept: use it ONLY as a guide to the ` +
      "layout; the materials, colour, doors and lighting MUST follow the specification below. " : "") +
    "\n\n" +
    finishLine(finish) +
    `Wardrobe specification for the whole room: ${spec}\n\n` +
    "Render as a single photorealistic image."
  );
}

// Merge the original brief and the designer chat into one up-to-date spec, so changes
// agreed in the chat (e.g. "make it American walnut") actually reach the image model.
async function consolidateSpec(key, brief, messages, walls = 1, images = []) {
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
    const r = await fetch(`${API_BASE}/${TEXT_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text:
              "You turn a wardrobe design conversation into a render specification. Reply in " +
              "exactly two lines and nothing else:\n" +
              "FINISH: <the timber or colour of the whole wardrobe, e.g. 'dark American walnut " +
              "timber veneer', or 'none' if never chosen>\n" +
              (walls > 1
                ? `Then exactly ${walls} lines, one per wall photo in order, each 'WALL n: <what the ` +
                  "wardrobe on this wall holds and where, e.g. long hanging left, drawers and " +
                  "shelves right; or 'no joinery' with the reason if the wall can't take any>'. " +
                  "Spread the brief sensibly across the walls, using what the photos show (doors, " +
                  "windows, wall width). Then:\n"
                : "") +
              "SPEC: <one plain paragraph: finish and colour, doors and handles, lighting, " +
              "hanging, drawers, shelves, extras and dimensions>\n" +
              "Where the customer changed their mind, use their LATEST choice and drop the old " +
              "one. If the customer agreed to a designer suggestion (e.g. said yes), include it. " +
              "Do not mention anything that was replaced.",
          }],
        },
        contents: [{
          role: "user",
          parts: [
            ...images.slice(0, MAX_WALL_PHOTOS).map((img) => inline(img, "image/jpeg")),
            { text: `Original brief: ${brief}\n\nConversation:\n${transcript || "(none yet)"}` },
          ],
        }],
        generationConfig: { maxOutputTokens: 900, temperature: 0.2 },
      }),
    });
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text).join("").trim();
    if (!r.ok || !text) return fallback;

    const finish = text.match(/^FINISH:\s*(.+)$/im)?.[1]?.trim();
    const spec = text.match(/^SPEC:\s*([\s\S]+)$/im)?.[1]?.trim() || text;
    const wallPlans = Array.from({ length: walls > 1 ? walls : 0 }, (_, i) =>
      text.match(new RegExp(`^WALL ${i + 1}:\\s*(.+)$`, "im"))?.[1]?.trim() || null);
    return { finish: finish && !/^none\.?$/i.test(finish) ? finish : null, spec, wallPlans };
  } catch {
    return fallback;
  }
}

export async function POST(request) {
  const started = Date.now();
  try {
    const {
      imageBase64, extraImages = [], mimeType = "image/jpeg", brief = "", messages = [], baseRender,
      // Walk-in mode: "specOnly" returns the shared spec; "wall" and "wide" render one view of it.
      specOnly = false, view = "match", wall = 1, walls = 1, spec: givenSpec, finish: givenFinish, wallPlan,
    } = await request.json();

    const key = process.env.GEMINI_API_KEY;
    if (!key) return Response.json({ error: "Server not configured (GEMINI_API_KEY)" }, { status: 500 });

    if (specOnly) {
      const images = [imageBase64, ...extraImages].filter(Boolean);
      return Response.json(await consolidateSpec(key, brief, messages, walls, images));
    }
    if (!imageBase64) return Response.json({ error: "Missing image" }, { status: 400 });

    const hasChat = messages.some((m) => m.role === "user");
    const { finish, spec } = givenSpec
      ? { finish: givenFinish || null, spec: givenSpec }
      : hasChat ? await consolidateSpec(key, brief, messages) : { finish: null, spec: brief };

    // Always render from the room photos; a previous render only guides the layout.
    const extras = extraImages.slice(0, view === "match" ? MAX_EXTRA_PHOTOS : MAX_WALL_PHOTOS - 1);
    const parts = [inline(imageBase64, mimeType), ...extras.map((img) => inline(img, mimeType))];
    if (baseRender) parts.push(inline(baseRender, "image/png"));
    const prompt =
      view === "wall" ? buildWallPrompt(spec, finish, wall, walls, extras.length, wallPlan, !!baseRender)
      : view === "wide" ? buildWidePrompt(spec, finish, 1 + extras.length, !!baseRender)
      : baseRender ? buildRerenderPrompt(spec, finish, extras.length)
      : buildPrompt(spec, finish, extras.length);
    parts.push({ text: prompt });

    // Visible in the host's function logs, to check what the image model was asked for.
    console.log("[render]", JSON.stringify({ view, wall, walls, rerender: !!baseRender, extraPhotos: extras.length, finish, wallPlan, spec }));

    const attempts = [MODEL, MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL)];
    const body = JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } });
    let out = null;
    let lastError = BUSY_MESSAGE;

    for (let i = 0; i < attempts.length && !out; i++) {
      if (Date.now() - started > START_CUTOFF_MS) break;
      if (i === 1) await sleep(1500); // brief pause before retrying the same model
      const model = attempts[i];
      try {
        const r = await fetch(`${API_BASE}/${model}:generateContent?key=${key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        const j = await r.json();
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
