# @wanlly/ui

The Wanlly design tokens, shared by Wanlly and Cadre.

- `tokens.css`: colour, type, radius and shadow tokens as CSS variables, light and dark.
- `theme.css`: the same tokens as a Tailwind v4 theme (`bg-surface`, `text-muted`, `text-tangerine-text`, `font-display`, `rounded-md` and so on).

```css
@import "tailwindcss";
@import "@wanlly/ui/tokens.css";
@import "@wanlly/ui/theme.css";
```

Rules from the design system: tangerine is a signal (the logo node, the one main action, money that needs attention), never decoration. Small tangerine text uses `tangerine-text`. Text on a tangerine fill uses `on-tangerine`. `faint` is only for timestamps, placeholders and eyebrow labels.
