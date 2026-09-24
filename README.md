# Fitted Wardrobe Designer — lead-gen landing page

Upload a room photo → shape the design with an AI studio consultant → see a real Gemini
render of the wardrobe in the actual room → request a quote. The render and chat run
**server-side**, so your Gemini key is never exposed to visitors.

```
Browser (photo + brief)  ->  /api/render  ->  Gemini image API  ->  render back
Browser (chat)           ->  /api/design  ->  Gemini text API   ->  reply back
Browser (contact)        ->  /api/lead    ->  email / log
```

## Run locally

Requires Node 18+.

```bash
npm install
cp .env.example .env.local     # then paste your GEMINI_API_KEY into .env.local
npm run dev                     # http://localhost:3000
```

The key must be on a **billing-enabled** Google AI project — image models have no free tier.
Get/manage keys at https://aistudio.google.com/apikey.

## Deploy (Vercel)

1. Push this folder to a GitHub repo.
2. Import it at vercel.com → New Project.
3. Add an Environment Variable: `GEMINI_API_KEY` = your key. (Add the optional lead vars too.)
4. Deploy. Point your ads at the URL.

Works on any Node host (Render, Railway, Fly). Renders take 10–30s, so make sure your host
allows function timeouts of 60s — Vercel Hobby caps some functions lower; Pro is safest.

## Cost (as of Sep 2026)

| Model                    | ~ per render | Use it for                         |
|--------------------------|--------------|------------------------------------|
| `gemini-2.5-flash-image` | ~$0.039      | Cheapest — high-volume cold traffic |
| `gemini-3.1-flash-image` | ~$0.10       | Higher quality                     |
| `gemini-3-pro-image`     | ~$0.134      | Default — best quality             |

Switch via `GEMINI_IMAGE_MODEL`. Chat text (`gemini-3.6-flash`) is a fraction of a cent.

## Money-saving guardrails (important for paid traffic)

Every render costs you, and cold clicks are low-intent. Before scaling ad spend:

- **Gate the first render behind email capture**, or capture contact before "Get my quote",
  so every render you pay for is tied to a lead.
- **Cap re-renders** (the ↻ button) to ~3 per session.
- Consider running **flash** live in-page and offering **pro** as an "HD render" reward
  *after* the visitor gives their details — expensive renders only fire on real leads.

## Customise per client

- Brand: `STUDIO` constant + `.mark` wordmark in `app/page.jsx`; colours in `app/globals.css`.
- Feature chips: `CHIPS` array in `app/page.jsx`.
- Consultant behaviour: `SYSTEM` prompt in `app/api/design/route.js`.
- Render faithfulness: the prompt in `app/api/render/route.js`.
- Lead delivery: `app/api/lead/route.js` (wire to your CRM; store the render image in
  S3/Drive and link it rather than emailing inline).

## Security

- The key lives only in server env vars — never shipped to the browser. Good.
- Rotate any key you've ever pasted into a chat or shared. Keep billing alerts on in Google Cloud.
