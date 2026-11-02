// Server-side design assistant (Gemini text). Same key as render — nothing exposed to the browser.
export const runtime = "nodejs";
export const maxDuration = 30;

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.6-flash";

// The consultant's brief and question checklist are per client: see lib/client.js.
import { client, spaceOf } from "../../../lib/client";

export async function POST(request) {
  try {
    const { messages = [], imageBase64, extraImages = [], mimeType = "image/jpeg", space: rawSpace } = await request.json();
    const SYSTEM = client.consultant(spaceOf(rawSpace));
    const key = process.env.GEMINI_API_KEY;
    if (!key) return Response.json({ error: "Server not configured (GEMINI_API_KEY)" }, { status: 500 });

    const contents = messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Attach the room photos (main view first) to the first user turn so the consultant can see them.
    if (imageBase64 && contents.length && contents[0].role === "user") {
      const photos = [imageBase64, ...extraImages.slice(0, 4)].map((img) => ({
        inlineData: {
          mimeType: img.match(/^data:([^;]+);/)?.[1] || mimeType,
          data: img.includes(",") ? img.split(",")[1] : img,
        },
      }));
      contents[0].parts.unshift(...photos);
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
