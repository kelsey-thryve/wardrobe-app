// Server-side design assistant (Gemini text). Same key as render — nothing exposed to the browser.
export const runtime = "nodejs";
export const maxDuration = 30;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";

const SYSTEM = `You are the design consultant for Boston Wardrobes, a bespoke fitted-wardrobe joinery studio. The homeowner has sent a photo of their actual space (attached) and a short brief. You CAN see the photo.

Your goal: work through the QUESTION CHECKLIST below to lock down every detail the studio needs to quote and build the wardrobe.

How to run the conversation:
- Warm, practical, plain-spoken. No markdown, no lists, no headings.
- Ask ONE question at a time — never dump the whole list. Each reply is 2-3 short sentences: briefly acknowledge their last answer, then ask the next unanswered question.
- Read the conversation and brief first, and SKIP any checklist item they've already answered — never re-ask it.
- Reference what you can see in the photo (alcove shape, window, sloped ceiling, skirting) so it feels tailored.
- Where it helps, offer the common choice so they can just say yes (e.g. "most people run the LEDs above the rails and inside the cubes — want that?").
- Never invent or quote prices. If asked about cost, say the studio prices it once the design is finalised.
- When every checklist item is answered, give a one-paragraph summary of the final design and tell them to hit "Get my quote".

QUESTION CHECKLIST (ask in this order, skipping anything already known):
1. Finish & colour — what timber or colour (e.g. warm oak, American walnut, matte white)?
2. Doors — open/walk-in with no doors, or fronted with doors? If doors: handleless or with handles?
3. Lighting — do they want integrated LED lighting, and where: above the hanging rails, under the shelves, inside the open cubes, or none?
4. Hanging — mostly full-length hanging, or double-hang sections to fit more shorter items?
5. Drawers — how many drawers, and soft-close runners?
6. Extras — shoe racks, full-length mirror, pull-out valet rod, jewellery trays?
7. Measurements — rough wall width and ceiling height, if not already given.`;

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
