// Server-side design assistant (Gemini text). Same key as render — nothing exposed to the browser.
export const runtime = "nodejs";
export const maxDuration = 30;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";

const SYSTEM =
  "You are the design consultant for a bespoke fitted-wardrobe joinery studio. The homeowner " +
  "has sent a photo of their actual space (attached) and a short brief. You CAN see the photo. " +
  "Help them shape the wardrobe conversationally so the studio can quote accurately. " +
  "Warm, practical, plain-spoken. 2 to 4 short sentences per reply. No markdown or lists. " +
  "Reference what you actually see in the photo (alcove/wall shape, window, sloped ceiling, skirting). " +
  "Confirm what they've asked for, then ask about ONE important missing thing: wall width / ceiling " +
  "height, hanging-vs-shelving split, number of drawers, finish/colour, or reach-in vs walk-in. " +
  "Suggest a genuinely useful improvement when it fits. Never invent or quote prices — say the studio " +
  "prices it once the design is set, and nudge them to request a quote when the design feels complete.";

export async function POST(request) {
  try {
    const { messages = [], imageBase64, mimeType = "image/jpeg" } = await request.json();
    const key = process.env.GEMINI_API_KEY;
    if (!key) return Response.json({ error: "Server not configured (GEMINI_API_KEY)" }, { status: 500 });

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Attach the room photo to the first user turn so the consultant can see it.
    if (imageBase64 && contents.length && contents[0].role === "user") {
      const data = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
      contents[0].parts.unshift({ inlineData: { mimeType, data } });
    }

    const payload = {
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
    };

    const r = await fetch(`${API_BASE}/${MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (!r.ok) return Response.json({ error: j?.error?.message || "Gemini error" }, { status: r.status });

    const text = (j.candidates?.[0]?.content?.parts || []).map((p) => p.text).join("").trim();
    return Response.json({ text });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
