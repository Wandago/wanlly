/*
 * Built-in design styles for the Design tool: short art-direction guides, written for Wanlly, that
 * the model follows when someone picks one. Each says what to use (type, colour, layout, motion)
 * and what to avoid, so results look designed rather than generic. A style may allow a script
 * library from jsDelivr; the preview's CSP allows that host and nothing else.
 */

export type DesignStyle = { id: string; name: string; blurb: string; guide: string; libs?: (keyof typeof LIBS)[] };

/** Script libraries a style may load, pinned to exact versions. */
export const LIBS = {
  gsap: '<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script> and <script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>',
  anime: '<script src="https://cdn.jsdelivr.net/npm/animejs@3.2.2/lib/anime.min.js"></script>',
  three: '<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"}}</script> then <script type="module">import * as THREE from "three"; …</script>',
} as const;

export const STYLES: DesignStyle[] = [
  {
    id: "editorial",
    name: "Editorial",
    blurb: "Magazine type, lots of air",
    guide: `Art direction: a high-end editorial site, like a design studio or a quality magazine.
- Type: a characterful serif for display ("Instrument Serif" or "Fraunces", 400 weight, tight -0.02em tracking, sizes up to 7–9rem on desktop) with a clean grotesk for text ("Inter Tight" 400/500, 16–18px, line-height 1.6).
- Colour: warm off-white background (#f4f1ea or similar), near-black ink, one restrained accent used sparingly (deep red, forest green or ink blue). No gradients, no shadows.
- Layout: asymmetric 12-column grid, wide margins, text columns no wider than 65 characters. Let big headlines break the grid. Thin 1px rules to separate sections, small uppercase labels with letter-spacing for section names and numbers (01, 02…).
- Images: large, cropped boldly; when there are none, use flat colour blocks or simple SVG line art.
- Details: italic serif for emphasis, generous whitespace (sections 120–200px apart on desktop), understated links with underline offset.
- Avoid: cards everywhere, centred-everything layouts, emoji icons, rounded pill buttons.`,
  },
  {
    id: "swiss",
    name: "Swiss grid",
    blurb: "Strict grid, bold sans, red accent",
    guide: `Art direction: International Typographic Style.
- Type: one strong grotesk ("Inter Tight" or "Archivo") in 2–3 weights. Very large, tight headlines (letter-spacing -0.04em), small precise body text. Flush left, ragged right; never centred body text.
- Colour: white, black and one signal colour (#e30613 red or #0047ff blue), used in solid blocks.
- Layout: a visible, strict 12-column grid with consistent gutters; align every element to it. Numbered sections, big index numbers, rules and boxes. Asymmetry and tension, but rigorous alignment.
- Details: data shown as clean tables or simple bar shapes; arrows (→) as the only ornament; square corners everywhere.
- Avoid: rounded corners, soft shadows, gradients, decorative illustrations, more than one accent colour.`,
  },
  {
    id: "product",
    name: "Clean product",
    blurb: "Crisp app UI, shadcn-like",
    guide: `Art direction: a polished product interface in the spirit of modern component libraries (shadcn/ui).
- Type: "Inter" or "Geist" 400/500/600; 14px UI text, 13px secondary, clear heading scale (24/20/16).
- Colour: neutral zinc or slate greys (#09090b to #fafafa), one brand accent for primary actions and focus rings, semantic green/amber/red for states. Light theme by default; borders do the work, shadows are subtle (0 1px 2px).
- Components: 8px radius, 1px borders, 36–40px controls, visible focus rings, consistent 4/8px spacing. Real states: hover, selected, disabled, empty, loading skeleton, error.
- Layout: sidebar + header + content for apps; cards in a calm grid for dashboards; tables with aligned numbers (tabular figures).
- Details: realistic data, small inline icons drawn as simple SVG strokes (1.5px), keyboard hints, toasts and badges.
- Avoid: giant hero text inside apps, heavy colour, decorative gradients, more than two font weights per screen.`,
  },
  {
    id: "corporate",
    name: "Corporate",
    blurb: "Trusted, official, data-led",
    guide: `Art direction: a trustworthy institution, such as a bank, ministry, regulator or listed company: annual reports, official presentations and investor pages.
- Type: a serious serif for headlines ("IBM Plex Serif" 600 or "Source Serif 4") with a clean sans for everything else ("IBM Plex Sans" 400/500/600). Calm sizes; nothing shouty.
- Colour: deep navy (#0b2a5b) as the main colour, white and cool light greys (#f6f7f9, #dfe3ea), one restrained gold or green accent for highlights. Green for growth, red only for real declines.
- Layout: orderly 12-column grid, generous margins, clear sections with eyebrow labels. Key numbers in a KPI strip with dividers; simple bar or line charts with labelled values and years; tables with right-aligned figures.
- Details: 6–10px radii, thin 1px borders, soft shadows at most, source notes and dates under figures, a clear primary action (download the report, read the statement).
- Slides: one message per slide as a full-sentence headline, the evidence (chart or 3 numbers) below it, and a small footer with the organisation and slide number.
- Avoid: playful shapes, bright gradients, stock clichés like handshakes and globes, decorative fonts, and copying any real organisation's logo or name unless the brief is from them.`,
  },
  {
    id: "dark-premium",
    name: "Dark premium",
    blurb: "Sleek SaaS launch page",
    guide: `Art direction: a premium dark launch page for a modern software product.
- Type: "Geist" or "Inter Tight" for UI and body, a tight display weight (600) for headlines with -0.04em tracking; mono ("Geist Mono") for small labels.
- Colour: deep background (#0a0a0b), surfaces one step lighter (#111113), hairline borders (rgba(255,255,255,.08)), text at 92% and 60% white. One vivid accent (electric lime, orange or violet). A single soft radial glow behind the hero is allowed; nothing else glows.
- Layout: centred hero with a short punchy headline (max ~8 words), a one-line subhead, two buttons; then a product screenshot mock built in HTML; then a bento grid of 5–7 feature tiles of different sizes; logos strip; pricing; FAQ; big closing CTA.
- Details: subtle grid or dot background in the hero, 12–16px radii, small "New" pill above the headline, numbers and code snippets in mono.
- Avoid: stock-looking purple-to-blue gradients across whole sections, walls of text, more than one accent.`,
  },
  {
    id: "playful",
    name: "Bold & playful",
    blurb: "Chunky type, bright colour",
    guide: `Art direction: confident, youthful and fun, a little neo-brutalist.
- Type: a chunky display face ("Bricolage Grotesque" 800 or "Syne" 700) at very large sizes, with "DM Sans" for text.
- Colour: 3–4 bright flat colours on cream or white (for example tomato #ff5a36, lemon #ffd23f, mint #2ec4b6, ink #111). Solid fills, no gradients.
- Shapes: thick 2–3px black outlines, hard offset shadows (6px 6px 0 #111), rounded 16–24px corners, sticker-like badges set at slight angles, simple SVG blobs, stars and squiggles.
- Layout: big blocks of colour per section, tilted cards, marquee strips of text, large friendly buttons that press down on hover.
- Copy: short, warm, a bit cheeky.
- Avoid: thin grey text, subtle low-contrast palettes, corporate stock phrasing.`,
  },
  {
    id: "motion",
    name: "Motion-rich",
    blurb: "Scroll reveals, kinetic type",
    libs: ["gsap"],
    guide: `Art direction: an award-style site where motion carries the story.
- Use GSAP with ScrollTrigger for: a kinetic hero headline (words or letters rising in with a short stagger), sections that reveal as they scroll in, one pinned section that steps through 3–4 states, numbers counting up, and a horizontal-scrolling strip.
- Keep motion purposeful: 0.6–0.9s, ease "power3.out" or "expo.out", small distances (20–60px). Nothing loops forever except one subtle marquee.
- Always respect reduced motion: wrap animations in gsap.matchMedia() with "(prefers-reduced-motion: no-preference)" and make the page fully readable without them. Content must be visible if scripts fail (start from visible CSS; animate from() values).
- Type and colour: big confident display type ("Bricolage Grotesque" or "Inter Tight" 600), a dark or a light base with one strong accent.
- Avoid: animating everything, parallax on body text, scroll-jacking, long delays before content appears.`,
  },
  {
    id: "glass",
    name: "Glass & depth",
    blurb: "Layered translucent panels",
    guide: `Art direction: depth and light, with frosted-glass surfaces.
- Background: a rich backdrop of 2–3 large soft colour shapes (blurred circles or blobs) behind everything, on a dark navy or a pale tinted base.
- Surfaces: panels with background rgba(255,255,255,.08–.14) (or dark equivalent), backdrop-filter: blur(18px) saturate(140%), a 1px light inner border (rgba(255,255,255,.18)) and a soft large shadow. Layer panels so they overlap.
- Type: "Inter" or "Manrope", clean and medium weight, high contrast against the glass (check AA contrast on every panel).
- Details: 20–28px radii, subtle highlights on top edges, floating cards at slight offsets, icons as simple outlined SVG.
- Avoid: glass on glass on glass that kills contrast, tiny grey text on blur, using glass for long reading text.`,
  },
  {
    id: "3d",
    name: "3D hero",
    blurb: "Three.js scene up top",
    libs: ["three"],
    guide: `Art direction: a striking landing page with a live 3D hero made with three.js.
- Hero: a full-width canvas behind the headline showing one elegant 3D idea that fits the brief (an icosahedron or torus knot with a physical material, a slowly rotating particle field, or soft floating shapes). Gentle rotation, subtle mouse parallax, a light fog, and a solid fallback background colour if WebGL is missing.
- Performance: one scene, under ~5,000 particles or a few meshes, devicePixelRatio capped at 2, pause the animation when the tab is hidden, resize with the window. Respect prefers-reduced-motion (render one still frame).
- Below the hero the page is calm and readable: clear sections, strong type ("Inter Tight" or "Space Grotesk"), a dark base with one accent that matches the 3D material.
- Avoid: heavy post-processing, external models or textures (build geometry in code), text inside the canvas.`,
  },
  {
    id: "afro-modern",
    name: "Afro-modern",
    blurb: "Warm palette, bold pattern",
    guide: `Art direction: contemporary African design: modern, confident and warm, rooted in craft rather than clichés.
- Colour: earth and sun, such as terracotta #c4532c, ochre #d9a441, deep indigo #1f2a5a, forest #1e5a3c, on warm sand #f3e9d8 or near-black. Solid, flat colour.
- Pattern: geometric patterns drawn in SVG (stripes, triangles, diamonds and checks, inspired by woven textiles and beadwork), used as borders, section dividers or one large hero panel, never behind body text.
- Type: a bold geometric display face ("Syne" 700 or "Space Grotesk" 700) with "DM Sans" for text.
- Content: local, specific detail when the brief allows (place names, M-Pesa or mobile money, real neighbourhoods), real people-first copy.
- Avoid: safari and savanna clichés, tribal stereotypes, random mixing of unrelated cultural symbols.`,
  },
  {
    id: "minimal",
    name: "Minimal",
    blurb: "Quiet, white, lots of space",
    guide: `Art direction: radical restraint, like a top architect's or photographer's portfolio.
- Type: one family ("Inter" 300/400/500). Small UI text (13–14px), one large light-weight statement (44–56px, weight 300, tight tracking). Secondary words in light grey inside the same sentence.
- Colour: white or off-white, black text, greys for secondary text. No accent colour, or one tiny one.
- Layout: huge margins (80px+), lots of empty space, a simple grid of large images with a one-line caption and year under each. Navigation is three words.
- Details: no borders, no shadows, no rounded corners, no icons. Hover states are a subtle underline or opacity change.
- Avoid: anything decorative. If in doubt, remove it.`,
  },
  {
    id: "luxury",
    name: "Luxury",
    blurb: "Black, ivory and gold",
    guide: `Art direction: a luxury hotel, fashion house or fine jeweller.
- Type: an elegant high-contrast serif for headlines ("Cormorant Garamond" 400, large, with italic for one emphasised word) and a light geometric sans for text ("Jost" 300/400). Small uppercase labels with wide letter-spacing (0.3em).
- Colour: near-black (#0f0d0b) or ivory (#f5efe6) backgrounds, warm off-white text, a muted gold accent (#d9c29a). Nothing bright.
- Layout: centred, symmetrical, cinematic: one large atmospheric image block with the headline over it, then a refined booking or enquiry bar with thin dividers.
- Details: hairline borders, no rounded corners, slow and calm. Prices stated quietly ("From KES 64,000 / night").
- Avoid: bold sans headlines, bright buttons, emoji, crowded layouts, discount language.`,
  },
  {
    id: "brutalist",
    name: "Brutalist",
    blurb: "Raw, loud, unapologetic",
    guide: `Art direction: web brutalism, like an independent radio station, zine or art collective.
- Type: a massive heavy display face ("Archivo Black", all caps, very tight) with a monospace for everything else ("Space Mono" 400/700).
- Colour: off-white or paper (#f0f0e8) and black, plus one or two pure, loud colours used as solid blocks (#ff0000, #0000ff, #ffff00).
- Layout: thick black borders (3–4px) dividing the page into a visible grid of boxes, like a table. A tab-like top bar, a news ticker strip, big numbers.
- Details: square corners, no shadows, no gradients, labels as black tags with inverted text, dashed rules in lists.
- Avoid: softness, rounded corners, subtle greys, polished stock UI. It should feel handmade on purpose, but still be readable and usable.`,
  },
  {
    id: "retro",
    name: "Retro",
    blurb: "90s arcade nostalgia",
    guide: `Art direction: playful 80s and 90s nostalgia: arcades, mixtapes, old operating systems.
- Type: a rounded retro display face ("Righteous") with stacked offset text-shadows in two colours, a pixel or terminal face for small text ("VT323"), and "Space Grotesk" for body text.
- Colour: pastel pink or cream background with electric purple (#6a2cff), teal (#00d1c1), sun yellow (#ffd23f) and deep navy outlines.
- Shapes: an old-style window with a title bar and _ □ × buttons, a cassette tape, a striped sunset circle, a checkerboard floor strip, stars and sparkles.
- Details: thick navy outlines and hard offset shadows on buttons and cards, chunky pill tags.
- Avoid: modern minimal greys, thin type, glassy effects.`,
  },
  {
    id: "organic",
    name: "Organic",
    blurb: "Earthy, soft, natural",
    guide: `Art direction: natural and wholesome, like an organic farm, wellness brand or eco product.
- Type: a soft, warm serif ("Fraunces" 400/600, with italic for emphasis) and a friendly rounded sans for text ("Nunito Sans").
- Colour: oat or cream backgrounds (#f4efe3), deep leaf green (#3e5a2e), sage (#c9d8b6), terracotta (#b5653a) and honey (#e2a53b).
- Shapes: soft blobs, leaves and circles drawn in SVG, pill-shaped buttons, cards with large radii (20–28px) and soft shadows.
- Copy: warm, specific and local (farms, places, people), with clear benefits.
- Avoid: harsh black, neon colours, sharp corners, techy layouts.`,
  },
  {
    id: "kids",
    name: "Kids & learning",
    blurb: "Friendly, bright, rounded",
    guide: `Art direction: a joyful learning product for children, parents and teachers.
- Type: a rounded, friendly display face ("Baloo 2" 700/800) and "Nunito" 700 for text. Large sizes everywhere; body text at least 18px.
- Colour: a light sky background (#e9f6ff) with bright, cheerful colours that each have a job: orange (#ff7a00), green (#00a86b), indigo (#5b5bf0), pink (#ff4f7b), sunshine yellow.
- Shapes: big rounded buttons (20px+ radius) with a solid darker "pressed" shadow beneath, simple friendly SVG characters (diverse, smiling), letter blocks, stars.
- Copy: simple words, short sentences, encouraging tone. Show ages and languages clearly (English and Kiswahili).
- Avoid: small text, dark themes, thin lines, scary or sarcastic tone, anything that looks like an ad aimed at children.`,
  },
  {
    id: "newspaper",
    name: "Newspaper",
    blurb: "Columns, headlines, news",
    guide: `Art direction: a respected daily newspaper or long-form news site.
- Type: a bold high-contrast serif masthead and headlines ("Playfair Display" 700/900), a readable text serif for articles ("Source Serif 4"), and a small sans ("Inter" 600) for labels, bylines and data.
- Colour: newsprint off-white (#fbfaf6), black ink, one red for section kickers and alerts, green/red only for market moves.
- Layout: centred masthead with the date bar above and section links between double rules; a lead story with a big headline, photo and two justified text columns with a drop cap; narrower side columns separated by thin vertical rules.
- Details: kicker labels in small caps above headlines, bylines with reading time, a small markets table.
- Avoid: big rounded cards, bright colours, marketing-style buttons.`,
  },
  {
    id: "sport",
    name: "Sport",
    blurb: "Fast, slanted, high energy",
    guide: `Art direction: a big sports event, team or sportswear launch.
- Type: an italic extra-bold condensed face ("Barlow Condensed" 800/900 italic, all caps) for headlines and numbers, "Barlow" for text.
- Colour: near-black (#0b0f14) with one electric accent (volt #d4ff00) and a hot second accent (red #ff3b30). Big diagonal stripes of solid colour cutting across the page.
- Layout: a huge slanted headline, skewed buttons (transform: skewX(-12deg)), a bold athlete silhouette or shape, a strip of big stats (distance, runners, prize money) and a countdown.
- Details: everything leans forward; numbers are huge; labels are small uppercase with tracking.
- Avoid: calm pastel palettes, serif type, centred quiet layouts.`,
  },
  {
    id: "bento",
    name: "Bento",
    blurb: "Product tiles, Apple-like",
    guide: `Art direction: a premium product showcase built from a bento grid of tiles, in the spirit of modern phone and laptop launch pages.
- Type: "Inter Tight" 600/700 with tight tracking for headlines, 500 for text. A short centred headline and price line above the grid.
- Colour: light grey page (#f5f5f7), white tiles, one dark hero tile, and pale tinted tiles (blue, green, peach) for individual features.
- Layout: a 4-column grid of tiles with 28px radii and 16–20px gaps: one large tile spanning 2×2 with the product, then smaller tiles, each with one feature, one short headline, one line of copy and one big visual or number.
- Details: big numbers for specs (6000 mAh, 50 MP), colour swatches as dots, product drawn in CSS/SVG.
- Avoid: long paragraphs inside tiles, more than one idea per tile, heavy borders.`,
  },
  {
    id: "restaurant",
    name: "Restaurant",
    blurb: "Warm, appetising, inviting",
    guide: `Art direction: a warm restaurant, café or food brand that makes people hungry.
- Type: an expressive serif for headlines ("Playfair Display" 600 with a 500 italic word) and "Karla" for text.
- Colour: deep warm brown or charcoal backgrounds (#2b1a12), cream text (#f6e9d8), a glowing ember accent (#e8913a) and food colours (tomato, herb green, turmeric).
- Layout: split screen: copy, booking buttons and a short menu on one side; a large, rich food illustration or photo area on the other. Menu items with dotted leaders to prices and a one-line description.
- Details: opening hours, location and a rating badge; buttons with small radii; generous line height.
- Avoid: cold blues, techy UI, stock "chef's hat" clip art.`,
  },
];

export const getStyle = (id: unknown) => (typeof id === "string" ? STYLES.find((s) => s.id === id) : undefined);

/**
 * Example pages per kind of design, so each tab shows looks that fit it: slide decks for Slides,
 * phone screens for apps, components for codebases, token sheets for design systems. `dir` is the
 * folder under public/styles ("" for the website pages). Made by scripts/style-samples.
 */
export const LOOK_SETS = [
  { key: "slides", label: "Slides", kind: "slides", dir: "slides", ids: ["corporate", "editorial", "swiss", "dark-premium", "playful", "minimal", "afro-modern", "luxury"] },
  { key: "app", label: "App screens", kind: "design", dir: "app", ids: ["product", "dark-premium", "playful", "glass", "organic", "kids"] },
  { key: "web", label: "Websites", kind: "design", dir: "", ids: STYLES.map((s) => s.id) },
  { key: "codebase", label: "Codebase", kind: "codebase", dir: "codebase", ids: ["product", "dark-premium", "minimal", "playful"] },
  { key: "system", label: "Design system", kind: "system", dir: "system", ids: ["corporate", "product", "playful", "afro-modern"] },
] as const;

export type LookSet = (typeof LOOK_SETS)[number];

/** The preview image for a style, from a set's folder ("" = websites). */
export const lookImage = (id: string, dir = "") => (dir ? `/styles/${dir}/${id}.webp` : `/styles/${id}.webp`);

/** For a design's kind: its own examples first, then every other style shown as a website. */
export function looksForKind(kind: string): { id: string; dir: string }[] {
  const own = kind === "design" ? [] : (LOOK_SETS.find((s) => s.kind === kind && s.key !== "web")?.ids ?? []);
  const dir = LOOK_SETS.find((s) => s.kind === kind && s.key !== "web")?.dir ?? "";
  return [...own.map((id) => ({ id, dir })), ...STYLES.filter((s) => !(own as readonly string[]).includes(s.id)).map((s) => ({ id: s.id, dir: "" }))];
}
