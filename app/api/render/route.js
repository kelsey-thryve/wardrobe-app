// Server-side render: the browser NEVER sees the Gemini key.
// Browser -> this route (holds key) -> Gemini image API -> image back.
export const runtime = "nodejs";
export const maxDuration = 60; // renders can take 10-30s

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";

function buildPrompt(brief) {
  return (
    "You are a photorealistic interior render engine for a bespoke fitted-wardrobe " +
    "joinery studio. Using the supplied photograph of the customer's actual room as the " +
    "exact base, design and render a custom fitted wardrobe built into the same wall/alcove. " +
    "CRITICAL: preserve the room's real geometry, perspective, wall positions, window and " +
    "door placement, flooring and natural lighting exactly as photographed — do not restyle " +
    "the room or move anything. Only add the wardrobe joinery, seamlessly integrated and " +
    "correctly scaled to the space, with realistic shadows and materials.\n\n" +
    `Wardrobe specification from the customer: ${brief}\n\n` +
    "Render as a single photorealistic image, same camera angle as the input photo."
  );
}

// Re-render: edit the previous render so the layout the customer liked is kept.
function buildEditPrompt(spec) {
  return (
    "You are a photorealistic interior render engine for a bespoke fitted-wardrobe " +
    "joinery studio. The supplied image is the current render of the customer's wardrobe " +
    "in their room. Edit this image so the wardrobe matches the final specification below. " +
    "Keep the room, camera angle, lighting and the wardrobe's overall position and size the " +
    "same, but you MUST change anything that differs from the specification — especially " +
    "the finish and colour of every carcass, door, panel and shelf. If the specification " +
    "names a timber or colour, the whole wardrobe must visibly be that timber or colour.\n\n" +
    `Final wardrobe specification: ${spec}\n\n` +
    "Render as a single photorealistic image."
  );
}

// Merge the original brief and the designer chat into one up-to-date spec, so changes
// agreed in the chat (e.g. "make it dark walnut") actually reach the image model.
async function consolidateSpec(key, brief, messages) {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "Customer" : "Designer"}: ${m.content}`)
    .join("\n");
  const fallback =
    `${brief}. Later changes from the customer, which override the above: ` +
    messages.filter((m) => m.role === "user").map((m) => m.content).join(". ");

  try {
    const r = await fetch(`${API_BASE}/${TEXT_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{
            text:
              "You turn a wardrobe design conversation into a render specification. Output ONLY " +
              "the final agreed specification as one plain paragraph: finish and colour, doors and " +
              "handles, lighting, hanging, drawers, shelves, extras and dimensions. Where the " +
              "customer changed their mind, use their LATEST choice and drop the old one. If the " +
              "customer agreed to a designer suggestion (e.g. said yes), include it. Do not mention " +
              "anything that was replaced.",
          }],
        },
        contents: [{ role: "user", parts: [{ text: `Original brief: ${brief}\n\nConversation:\n${transcript}` }] }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.2 },
      }),
    });
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text).join("").trim();
    return r.ok && text ? text : fallback;
  } catch {
    return fallback;
  }
}

export async function POST(request) {
  try {
    const { imageBase64, mimeType = "image/jpeg", brief = "", messages = [], baseRender } = await request.json();
    if (!imageBase64) return Response.json({ error: "Missing image" }, { status: 400 });

    const key = process.env.GEMINI_API_KEY;
    if (!key) return Response.json({ error: "Server not configured (GEMINI_API_KEY)" }, { status: 500 });

    const hasChat = messages.some((m) => m.role === "user");
    const spec = hasChat ? await consolidateSpec(key, brief, messages) : brief;

    // With a previous render, edit that image; otherwise render from the customer's photo.
    const source = baseRender || imageBase64;
    const sourceMime = baseRender ? (baseRender.match(/^data:([^;]+);/)?.[1] || "image/png") : mimeType;
    const data = source.includes(",") ? source.split(",")[1] : source;
    const prompt = baseRender ? buildEditPrompt(spec) : buildPrompt(spec);

    const payload = {
      contents: [{ parts: [{ inlineData: { mimeType: sourceMime, data } }, { text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    };

    const r = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
