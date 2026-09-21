// Lead capture: assembles the quote request and sends it to the studio.
// If RESEND_API_KEY + LEAD_TO_EMAIL are set, it emails the lead. Otherwise it logs to the server.
export const runtime = "nodejs";

export async function POST(request) {
  try {
    const lead = await request.json();
    const summary =
      `New wardrobe quote request\n\n` +
      `Name:     ${lead.name || "-"}\n` +
      `Email:    ${lead.email || "-"}\n` +
      `Phone:    ${lead.phone || "-"}\n` +
      `Suburb:   ${lead.suburb || "-"}\n` +
      `Features: ${(lead.spec || []).join(", ") || "-"}\n` +
      `Notes:    ${lead.notes || "-"}\n`;

    if (process.env.RESEND_API_KEY && process.env.LEAD_TO_EMAIL) {
      // NOTE: the rendered image + original photo are base64 and large — store them in
      // S3/Drive and link, rather than emailing inline. Left as a TODO for your CRM.
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.LEAD_FROM_EMAIL || "leads@yourdomain.com",
          to: process.env.LEAD_TO_EMAIL,
          subject: `New wardrobe quote request — ${lead.name || "lead"}`,
          text: summary,
        }),
      });
    } else {
      console.log("[LEAD]", summary);
    }

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
