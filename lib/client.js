// Per-client setup. One codebase, one deployment per client: set NEXT_PUBLIC_CLIENT in the
// host's environment variables (e.g. "ccg"). Unset, the app is the Thryve Growth demo exactly as before.
//
// Everything a client changes lives here: brand words, units, feature chips, the consultant's
// questions, depth rules for the renderer, and the space types offered (closet / garage).

const THRYVE_CONSULTANT = `You are the design consultant for Thryve Growth, a bespoke fitted-wardrobe joinery studio. The homeowner has sent one or more photos of their actual space (attached; the first is the main view, any others show it from other angles) and a short brief. You CAN see the photos.

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

const CCG_RULES = `How to run the conversation:
- Warm, practical, plain-spoken American English. No markdown, no lists, no headings.
- Ask ONE question at a time. Each reply is 2-3 short sentences: briefly acknowledge their last answer, then ask the next unanswered question.
- Read the conversation and brief first, and SKIP any checklist item they have already answered. Never re-ask it.
- Reference what you can see in the photos so it feels tailored.
- Where it helps, offer the common choice so they can just say yes.
- Measurements are in inches and feet.
- Never invent or quote prices, timelines or discounts. If asked about cost, say Richard prices it once the design is final, after a free in-home design meeting.
- If the space is L-shaped, angled, has a sloped ceiling or is otherwise complex, say the online design is a starting point and suggest booking the free in-home design consultation so the team can measure it properly.
- When every checklist item is answered, give a one-paragraph summary of the final design and tell them to tap "Next step: your details" to send it to Custom Closet Guys.`;

const CCG_CLOSET_CONSULTANT = `You are the design consultant for Custom Closet Guys, a custom closet company serving Albuquerque, Santa Fe and surrounding communities in New Mexico. They build walk-ins, reach-in closets and mudrooms with solid wood drawers. The homeowner has sent one or more photos of their actual space (attached; the first is the main view) and a short brief. You CAN see the photos.

Your goal: work through the QUESTION CHECKLIST below to lock down what the team needs to design and price the closet.

${CCG_RULES}

Standard build depths (mention them if depth comes up): hanging sections 16 inches, dressers and drawer banks 22 inches, shelving 12 or 16 inches.

QUESTION CHECKLIST (ask in this order, skipping anything already known):
1. Finish and color: white, a painted color, or a wood tone?
2. Fronts: open shelving, or doors and drawer fronts? Shaker or flat fronts, and what hardware finish?
3. Hanging: mostly long hanging, or double-hang sections for shirts and pants?
4. Drawers: how many drawers, and anything special in them (jewelry trays, dividers)?
5. Shoes, bags and extras: shoe shelves, purse cubbies, a center island, valet rod, mirror, vanity or desk?
6. Lighting: integrated LED lighting over the hanging or in the shelves, or none?
7. Measurements: rough wall widths and ceiling height, if not already given.`;

const CCG_GARAGE_CONSULTANT = `You are the design consultant for Custom Closet Guys, who build custom closets and garage storage in Albuquerque, Santa Fe and surrounding communities in New Mexico. The homeowner has sent photos of their actual garage (attached; the first is the main view) and a short brief. You CAN see the photos.

Your goal: work through the QUESTION CHECKLIST below to lock down what the team needs to design and price the garage.

${CCG_RULES}

QUESTION CHECKLIST (ask in this order, skipping anything already known):
1. Use: what needs a home (tools, sports gear, bikes, workshop, overflow storage), and do cars still park inside?
2. Slatwall: which walls, and what color?
3. Cabinets: base cabinets, wall cabinets or tall cabinets, and what color?
4. Workbench: do they want one, and where?
5. Floor: an epoxy floor coating, and what color?
6. Extras: space for a second fridge or freezer, a gun safe, a poker or game table, overhead storage racks?
7. Measurements: rough wall widths and ceiling height, if not already given.`;

// Swap the renderer's wardrobe words for a client's own (prompts are written for fitted wardrobes).
const closetWords = (t) =>
  t
    .replace(/bespoke fitted-wardrobe joinery studio/g, "custom closet company")
    .replace(/fitted-wardrobe joinery studio/g, "custom closet company")
    .replace(/joinery studio/g, "custom closet company")
    .replace(/fitted wardrobes/gi, "custom closets")
    .replace(/fitted wardrobe/gi, "custom closet")
    .replace(/Wardrobes/g, "Closets").replace(/wardrobes/g, "closets")
    .replace(/Wardrobe/g, "Closet").replace(/wardrobe/g, "closet")
    .replace(/joinery/g, "closet system").replace(/joiners?/g, "installer");

const garageWords = (t) =>
  closetWords(t)
    .replace(/custom closet company/g, "garage storage company")
    .replace(/custom closets?/g, "garage storage system")
    .replace(/closet system/g, "garage storage system")
    .replace(/closets/g, "garage storage systems")
    .replace(/closet/g, "garage storage system");

const CLIENTS = {
  thryve: {
    id: "thryve",
    studio: "Thryve Growth",
    tagline: "Bespoke fitted wardrobes · designed to your room",
    title: "Thryve Growth wardrobe app",
    description: "Upload your space, shape the design, and get a quote from the studio that builds it.",
    h1: "Your wardrobe, drawn to fit.",
    sub: "Upload photos of your space, shape the layout with our studio designer, and see it in your own room. When it's right, request a quote from the joiners who'll build it.",
    units: "mm",
    spaces: null,
    chips: {
      closet: ["Full-height hanging rails", "Bank of soft-close drawers", "Open cube shelves", "Dedicated shoe racks", "Integrated LED lighting", "Full-length mirror"],
    },
    briefPlaceholder: {
      closet: "e.g. Mostly hanging with 4 drawers and a shoe rack at the base. Finish: warm oak with matte black rails.",
    },
    locality: "Suburb",
    quoteHeading: "Where should the studio send your quote?",
    quoteFoot: "Your photos, render and notes go straight to the workshop so they can price the exact build.",
    sendLabel: "Send my design to the studio",
    doneHeading: (first) => `Your design is with the studio, ${first}.`,
    doneText: "A joiner will review your space and come back with a fixed quote, usually within two working days.",
    leadSubject: "New wardrobe quote request",
    consultant: () => THRYVE_CONSULTANT,
    depthRule: () => "hanging sections are about 600mm deep",
    words: (t) => t,
    extraRule: () => "",
  },

  ccg: {
    id: "ccg",
    studio: "Custom Closet Guys",
    tagline: "Custom closets · Albuquerque and Santa Fe",
    title: "Design your closet | Custom Closet Guys",
    description: "Upload a photo of your closet or garage and see a custom design in your own room.",
    h1: "See it in your room before anything is built.",
    sub: "Upload a photo of your space, tick what you need, and shape the design with our designer. When it's right, send it to us and we'll set up your free in-home design meeting.",
    units: "in",
    spaces: [
      { id: "closet", label: "Closet, walk-in or mudroom" },
      { id: "garage", label: "Garage" },
    ],
    chips: {
      closet: ["Full-height hanging rails", "Bank of soft-close drawers", "Open cube shelves", "Dedicated shoe racks", "Integrated LED lighting", "Full-length mirror", "Island with drawers", "Glass-front doors", "Vanity or desk"],
      garage: ["Slatwall", "Base and wall cabinets", "Workbench", "Epoxy floor", "Fridge space", "Gun safe space", "Overhead storage", "Tool wall", "Poker or game table"],
    },
    briefPlaceholder: {
      closet: "e.g. Mostly hanging with 4 drawers and a shoe rack at the base. Finish: white with matte black rods.",
      garage: "e.g. Slatwall down one side with cabinets under, gray epoxy floor, space for a second fridge.",
    },
    locality: "City",
    quoteHeading: "Where should we send your design?",
    quoteFoot: "Your photos, design and notes go straight to Richard, who will call to set up your free in-home design meeting.",
    sendLabel: "Send my design to Custom Closet Guys",
    doneHeading: (first) => `Your design is with Custom Closet Guys, ${first}.`,
    doneText: "Richard will look over your space and call you to set up a free in-home design meeting, where we measure up and finalize the design.",
    leadSubject: "New design request from the website",
    consultant: (space) => (space === "garage" ? CCG_GARAGE_CONSULTANT : CCG_CLOSET_CONSULTANT),
    depthRule: (space) =>
      space === "garage"
        ? "keep cabinets to normal garage cabinet depths and leave clear floor to park and walk"
        : "hanging sections are 16 inches (406mm) deep, drawer banks and dressers are 22 inches (559mm) deep, and shelving is 12 or 16 inches (305 or 406mm) deep",
    words: (t, space) => (space === "garage" ? garageWords(t) : closetWords(t)),
    extraRule: (space) =>
      space === "garage"
        ? "\n\nGARAGE: this is a garage. Add only the garage storage the brief asks for (slatwall " +
          "panels, base, wall or tall cabinets, a workbench, overhead racks) in the requested " +
          "colors. If the brief asks for an epoxy floor, give the existing floor a glossy epoxy " +
          "coating in that color; otherwise keep the floor exactly as it is. Keep the garage door, " +
          "any cars, windows and doors where they are."
        : "",
  },
};

export const CLIENT_ID = (process.env.NEXT_PUBLIC_CLIENT || "thryve").toLowerCase();
export const client = CLIENTS[CLIENT_ID] || CLIENTS.thryve;
export const spaceOf = (s) => (client.spaces && client.spaces.some((x) => x.id === s) ? s : "closet");

// Lengths: stored in mm everywhere; shown in the client's units.
export const fmtLen = (mm) => {
  if (client.units !== "in") return `${Math.round(mm)}mm`;
  const inches = Math.round(mm / 25.4);
  return `${inches}"`;
};

// Parse a typed measurement into mm.
// mm clients: small numbers are metres ("2.4" -> 2400).
// inch clients: inches, with feet accepted ("8" or 8' -> 96", 8'6" -> 102", "96" -> 96").
export const toMm = (v) => {
  const s = String(v || "").trim();
  if (!s) return null;
  let mm;
  if (client.units === "in") {
    const ftIn = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet)\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inches)?)?$/i);
    if (ftIn) mm = (Number(ftIn[1]) * 12 + Number(ftIn[2] || 0)) * 25.4;
    else {
      const n = Number(s.replace(/[^\d.]/g, ""));
      if (!n) return null;
      mm = (n <= 20 ? n * 12 : n) * 25.4;
    }
  } else {
    const n = Number(s.replace(/[^\d.]/g, ""));
    if (!n) return null;
    mm = n <= 20 ? n * 1000 : n;
  }
  return mm >= 300 && mm <= 15000 ? Math.round(mm) : null;
};
