// Server-side render: the browser NEVER sees the Gemini key.
// Browser -> this route (holds key) -> Gemini image API -> image back.
export const runtime = "nodejs";
export const maxDuration = 60; // renders can take 10-30s

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

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

export async function POST(request) {
  try {
    const { imageBase64, mimeType = "image/jpeg", brief = "" } = await request.json();
    if (!imageBase64) return Response.json({ error: "Missing image" }, { status: 400 });

    const key = process.env.GEMINI_API_KEY;
    if (!key) return Response.json({ error: "Server not configured (GEMINI_API_KEY)" }, { status: 500 });

    const data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
    const payload = {
      contents: [{ parts: [{ inlineData: { mimeType, data } }, { text: buildPrompt(brief) }] }],
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
