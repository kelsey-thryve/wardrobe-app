// Brand settings for each version of the app. The same designer runs on "/" (Thryve Growth)
// and "/boston" (Boston Wardrobes); a brand changes the look, the copy, and what the designer
// and image model are told about the products and design rules.

const THRYVE = {
  key: "thryve",
  name: "Thryve Growth",
  tag: "Bespoke fitted wardrobes · designed to your room",
  heroTitle: "Your wardrobe, drawn to fit.",
  heroSub:
    "Upload photos of your space, shape the layout with our studio designer, and see it in your " +
    "own room. When it's right, request a quote from the joiners who'll build it.",
  chips: [
    "Full-height hanging rails",
    "Bank of soft-close drawers",
    "Open cube shelves",
    "Dedicated shoe racks",
    "Integrated LED lighting",
    "Full-length mirror",
  ],
  briefPlaceholder: "e.g. Mostly hanging with 4 drawers and a shoe rack at the base. Finish: warm oak with matte black rails.",
  designer: "Studio designer",
  team: "the studio",
  quoteTitle: "Where should the studio send your quote?",
  quoteButton: "Send my design to the studio",
  quoteNote: "Your photos, render and notes go straight to the workshop so they can price the exact build.",
  doneTitle: "Your design is with the studio",
  doneText: "A joiner will review your space and come back with a fixed quote, usually within two working days.",
  kinds: null,
  ranges: null,
  doors: null,
};

// Boston Wardrobes' ranges, from their 2024 brochures. `rules` is what the designer and the
// image model are told about the range.
const BOSTON_RANGES = [
  {
    id: "select",
    name: "Select",
    blurb: "Cost-efficient organiser in white, wall-hung or floor-based.",
    rules:
      "Boston SELECT range: white 18mm melamine only (no other colours), 300mm and 400mm deep " +
      "shelving, polycarbonate locking shelf supports, wall-hung from a heavy-duty aluminium wall " +
      "extrusion (or floor-based), open-top drawers fitted with soft-closers. Simple and " +
      "efficient, made to order to the space.",
  },
  {
    id: "flex",
    name: "Flex",
    blurb: "Floor-mounted, endless options, 100+ colours and wood-grains.",
    rules:
      "Boston FLEX range: floor-mounted organiser in 18mm or 25mm melamine, in over 100 colours " +
      "and wood-grains. Adjustable shelving and hanger bars, premium toe-kicks, drawers open-top, " +
      "push to open or with handles (Hettich or Blum soft-closing), optional LED lighting, " +
      "custom fitted by Boston's installers.",
  },
  {
    id: "innova",
    name: "Innova",
    blurb: "Industrial chic: anodised aluminium stanchions, easily moved.",
    rules:
      "Boston INNOVA range: sleek anodised aluminium wall stanchions (slim vertical uprights) " +
      "carrying 25mm melamine shelves, hanging rails and drawer units, in over 100 colours and " +
      "wood-grains. Minimalist, industrial-chic look with the aluminium uprights visible; easily " +
      "dismantled and moved. Drawers open-top, push to open or with handles (Hettich or Blum " +
      "soft-closing).",
  },
  {
    id: "viva",
    name: "Viva",
    blurb: "Freestanding with hinged doors. No building work needed.",
    rules:
      "Boston VIVA range: freestanding 18mm melamine wardrobe units with solid back panels and " +
      "toe-kicks, permanently fixed to the wall, fronted with HINGED doors. For rooms without a " +
      "built-in wardrobe space; no building work needed. Over 100 colours and wood-grains. " +
      "Drawers open-top, push to open or with handles (Hettich or Blum soft-closing).",
  },
];

// Boston's wardrobe doors, from bostonwardrobes.co.nz/wardrobe-doors.
const BOSTON_DOORS = [
  {
    id: "decor",
    name: "Decor",
    blurb: "Cost-effective sliding doors in melamine or mirror.",
    rules:
      "Boston DECOR sliding doors: floor-mounted sliding doors on aluminium top and bottom tracks, " +
      "9mm melamine panels or 4mm safety-backed mirror, over 150 colours and textures, with a thin " +
      "Bright White, Soft White or Silver Grey aluminium trim around each door.",
  },
  {
    id: "fusion",
    name: "Fusion",
    blurb: "Sliding, bi-fold or pivot; panels split up to five times.",
    rules:
      "Boston FUSION doors: sliding (or bi-fold or pivot) doors on top and bottom tracks, 9mm or " +
      "18mm melamine, mirror or glass panels in over 150 colours and textures; each door can be " +
      "split into up to five horizontal sections mixing finishes, with slim aluminium trim.",
  },
  {
    id: "wave",
    name: "Wave",
    blurb: "Sliding doors in melamine, mirror or glass, up to five sections.",
    rules:
      "Boston WAVE sliding doors: floor-mounted 9mm panels in over 150 colours and textures, " +
      "mirror or glass, each door split into up to five sections, with slim trim.",
  },
  {
    id: "mirror",
    name: "Frameless Mirror",
    blurb: "Full-height mirror sliding doors with no frame.",
    rules:
      "Boston FRAMELESS MIRROR sliding doors: full-height 4mm safety-backed mirror glass doors with " +
      "no frame around the glass, on aluminium top and bottom tracks (Bright White or Silver Grey).",
  },
  {
    id: "villa",
    name: "Villa",
    blurb: "Paint-ready panelled doors, sliding or bi-fold, no trim.",
    rules:
      "Boston VILLA doors: top-hung 40mm panelled timber doors (sliding or bi-fold), painted in any " +
      "colour with a seamless look and no trim, with a slim handle; classic villa-style panel detail.",
  },
  {
    id: "flush",
    name: "Flush Panel",
    blurb: "Plain paint-ready doors, sliding or bi-fold, no trim.",
    rules:
      "Boston FLUSH PANEL doors: top-hung 40mm plain flat timber doors (sliding or bi-fold), " +
      "painted in any colour with a seamless look and no trim, with a slim handle.",
  },
  { id: "none", name: "No doors", blurb: "Open organiser, or I'll decide later.", rules: "" },
];

// Boston's Reach-in and Walk-in Wardrobe Design Guides, as rules for the designer.
const BOSTON_GUIDE = {
  common:
    "Boston Wardrobes design rules (from their design guides):\n" +
    "- Internal depth 600mm: suit jackets and coats need 600mm.\n" +
    "- Shelves at least 400mm deep and 400mm wide (folded garments are about 350mm). Recommended shelving depth 400mm.\n" +
    "- Double hanging (one rail above another) is the most common; it needs at least 2100mm of height. Also offer long hanging and 3/4 hanging for dresses and coats, at custom heights.\n" +
    "- Drawers are for underwear, socks, t-shirts, sports gear and nightwear; offer a jewellery or knick-knack drawer. All drawers have soft-close runners and come in different depths.\n" +
    "- Shoes: women's shoes need 180-200mm of shelf width per pair, men's dress shoes 230-250mm; shoe shelves are 300mm deep.\n" +
    "- Panels are New Zealand made melamine on sustainably sourced NZ MDF, in a huge range of finishes and colours.\n",
  "reach-in":
    "Reach-in wardrobes:\n" +
    "- Allow at least 1800mm of wardrobe length per person.\n" +
    "- Usually fronted with a pair of sliding doors for full-width access; if the opening is narrow, a builder can widen it (a break-out).\n" +
    "- Boston organisers (except Viva) have no backs, so the wardrobe walls are lined and finished like the rest of the house.\n",
  "walk-in":
    "Walk-in wardrobes:\n" +
    "- Allow at least 2400mm of wall space per person.\n" +
    "- Run hanging rails into the corners rather than fitting corner shelving: more practical and less costly. Do not use corner shelves.\n" +
    "- Hanging clothes protrude up to 600mm into the room; allow another 100mm for easy viewing and access when planning units either side.\n" +
    "- Avoid windows and skylights where possible (light fades clothing); if there is one, suggest a UV blocker. Soft artificial lighting is best.\n",
};

const BOSTON = {
  key: "boston",
  name: "Boston Wardrobes",
  tag: "boston.co.nz",
  heroTitle: "Design your Boston wardrobe.",
  heroSub:
    "Choose your wardrobe, upload photos of your space, and see a Boston design in your own room. " +
    "When it's right, send it to our consultants for a quote.",
  chips: [
    "Double hanging",
    "Long hanging",
    "Soft-close drawers",
    "Open shelving",
    "Shoe shelves",
    "Jewellery drawer",
    "LED lighting",
    "Full-length mirror",
  ],
  briefPlaceholder: "e.g. Two people. Mostly double hanging, some long hanging for coats, 6 drawers and shelves for shoes. Finish: warm oak wood-grain.",
  designer: "Boston design consultant",
  team: "Boston Wardrobes",
  quoteTitle: "Where should Boston send your quote?",
  quoteButton: "Send my design to Boston",
  quoteNote: "Your photos, renders and notes go straight to our design team in Grafton so they can price your wardrobe.",
  doneTitle: "Your design is with Boston Wardrobes",
  doneText:
    "A Boston design consultant will review your space and be in touch, usually within two working days. " +
    "You're welcome to visit Auckland's largest wardrobe showroom on Nugent Street, Grafton.",
  contact: "Nugent Street, Grafton, Auckland | 09 377 5799 | info@boston.co.nz",
  site: "boston.co.nz",
  strapline: "Creating organised homes you love to live in, for more than 35 years.",
  kinds: [
    { id: "reach-in", name: "Reach-in wardrobe", blurb: "A wardrobe along one wall or in an alcove, usually with doors." },
    { id: "walk-in", name: "Walk-in wardrobe", blurb: "A dressing room you walk into, with storage on several walls." },
  ],
  ranges: [...BOSTON_RANGES, { id: "unsure", name: "Not sure yet", blurb: "Our consultant will recommend the right range.", rules: "" }],
  doors: BOSTON_DOORS,
  doorNote: "Every door is custom made to your opening. 10 year parts and labour guarantee when fitted by Boston.",
};

export const BRANDS = { thryve: THRYVE, boston: BOSTON };
export const getBrand = (key) => BRANDS[key] || THRYVE;

// What the designer and image model must follow for this brand, range and kind of wardrobe
// (empty for brands without product rules).
export function brandRules(key, rangeId, kind, doorId) {
  if (key !== "boston") return "";
  const range = BOSTON_RANGES.find((r) => r.id === rangeId);
  const door = BOSTON_DOORS.find((d) => d.id === doorId);
  return (
    `The wardrobe is designed and built by Boston Wardrobes (Auckland, NZ). ` +
    (range
      ? `The customer chose the ${range.name} range; design ONLY with it. ${range.rules}\n`
      : `The customer hasn't chosen a range yet. Boston's ranges: ${BOSTON_RANGES.map((r) => r.rules).join(" ")} ` +
        "Design with Flex unless the brief suits another range better.\n") +
    (rangeId === "viva" ? "" : door?.rules
      ? `Doors: ${door.rules} Show the doors partly open (slid to one side) so the organiser inside is visible.\n`
      : doorId === "none" ? "No doors: show the organiser open.\n" : "") +
    BOSTON_GUIDE.common +
    (BOSTON_GUIDE[kind] || "")
  );
}
