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
];

export const getStyle = (id: unknown) => (typeof id === "string" ? STYLES.find((s) => s.id === id) : undefined);

/** Where to find references: the person can screenshot a page they like and attach it. */
export const INSPIRATION: { name: string; url: string; what: string }[] = [
  { name: "Minimal Gallery", url: "https://minimal.gallery", what: "Calm, high-end sites" },
  { name: "Godly", url: "https://godly.website", what: "Bold, award-level sites" },
  { name: "Land-book", url: "https://land-book.com", what: "Landing pages" },
  { name: "Mobbin", url: "https://mobbin.com", what: "Mobile app screens" },
  { name: "Component Gallery", url: "https://component.gallery", what: "How design systems build each part" },
  { name: "Awwwards", url: "https://www.awwwards.com", what: "The year's best web design" },
];
