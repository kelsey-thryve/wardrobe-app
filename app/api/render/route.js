// Server-side render: the browser NEVER sees the Gemini key.
// Browser -> this route (holds key) -> Gemini image API -> image back.
export const runtime = "nodejs";
export const maxDuration = 60; // renders can take 10-30s

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image";
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";

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

function buildPrompt(spec, finish) {
  return (
    "You are a photorealistic interior render engine for a bespoke fitted-wardrobe " +
    "joinery studio. Using the supplied photograph of the customer's actual room as the " +
    "exact base, design and render a custom fitted wardrobe built into the same wall/alcove. " +
    "CRITICAL: preserve the room's real geometry, perspective, wall positions, window and " +
    "door placement, flooring and natural lighting exactly as photographed — do not restyle " +
    "the room or move anything. Only add the wardrobe joinery, seamlessly integrated and " +
    "correctly scaled to the space, with realistic shadows and materials.\n\n" +
    finishLine(finish) +
    `Wardrobe specification from the customer: ${spec}\n\n` +
    "Render as a single photorealistic image, same camera angle as the input photo."
  );
}

// Re-render: start again from the room photo, using the previous render only as a layout
// guide. Asking the model to edit the previous render tends to return it unchanged.
function buildRerenderPrompt(spec, finish) {
  return (
    "You are a photorealistic interior render engine for a bespoke fitted-wardrobe " +
    "joinery studio. Image 1 is a photograph of the customer's actual room. Image 2 is an " +
    "earlier concept of their wardrobe. Render the wardrobe into the room in image 1, " +
    "keeping the room's geometry, perspective, flooring and natural light exactly as " +
    "photographed. Use image 2 ONLY as a guide to the layout (where the hanging, shelves, " +
    "cubes, drawers and shoe racks sit). The materials, colour, doors and lighting MUST " +
    "follow the specification below, NOT image 2 — the customer has changed them.\n\n" +
    finishLine(finish) +
    `Final wardrobe specification: ${spec}\n\n` +
    "Render as a single photorealistic image, same camera angle as image 1."
  );
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
              "SPEC: <one plain paragraph: finish and colour, doors and handles, lighting, " +
              "hanging, drawers, shelves, extras and dimensions>\n" +
              "Where the customer changed their mind, use their LATEST choice and drop the old " +
              "one. If the customer agreed to a designer suggestion (e.g. said yes), include it. " +
              "Do not mention anything that was replaced.",
          }],
        },
        contents: [{ role: "user", parts: [{ text: `Original brief: ${brief}\n\nConversation:\n${transcript}` }] }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.2 },
      }),
    });
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text).join("").trim();
    if (!r.ok || !text) return fallback;

    const finish = text.match(/^FINISH:\s*(.+)$/im)?.[1]?.trim();
    const spec = text.match(/^SPEC:\s*([\s\S]+)$/im)?.[1]?.trim() || text;
    return { finish: finish && !/^none\.?$/i.test(finish) ? finish : null, spec };
  } catch {
    return fallback;
  }
}

const inline = (dataUrl, fallbackMime) => ({
  inlineData: {
    mimeType: dataUrl.match(/^data:([^;]+);/)?.[1] || fallbackMime,
    data: dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl,
  },
});

export async function POST(request) {
  try {
    const { imageBase64, mimeType = "image/jpeg", brief = "", messages = [], baseRender } = await request.json();
    if (!imageBase64) return Response.json({ error: "Missing image" }, { status: 400 });

    const key = process.env.GEMINI_API_KEY;
    if (!key) return Response.json({ error: "Server not configured (GEMINI_API_KEY)" }, { status: 500 });

    const hasChat = messages.some((m) => m.role === "user");
    const { finish, spec } = hasChat ? await consolidateSpec(key, brief, messages) : { finish: null, spec: brief };

    // Always render from the room photo; a previous render only guides the layout.
    const parts = [inline(imageBase64, mimeType)];
    if (baseRender) parts.push(inline(baseRender, "image/png"));
    parts.push({ text: baseRender ? buildRerenderPrompt(spec, finish) : buildPrompt(spec, finish) });

    // Visible in the host's function logs, to check what the image model was asked for.
    console.log("[render]", JSON.stringify({ rerender: !!baseRender, finish, spec }));

    const r = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
    });
    const j = await r.json();
    if (!r.ok) return Response.json({ error: j?.error?.message || "Gemini error" }, { status: r.status });

    let out = null;
    for (const c of j.candidates || [])
      for (const p of c.content?.parts || []) if (p.inlineData) out = p.inlineData.data;
    if (!out) return Response.json({ error: "No image returned" }, { status: 502 });

    return Response.json({ imageBase64: `data:image/png;base64,${out}` });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
