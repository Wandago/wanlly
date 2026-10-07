# Wanlly

A free, ad-supported AI workspace: Chat, Code, Design and Images in one composer, paid for by sponsor spots people choose to see.

- Build plan, stack and costs: [`docs/PLAN.md`](docs/PLAN.md)
- Original clickable mockup: [`prototype/index.html`](prototype/index.html)

## Status

Phase 1 (UI shell). The interface is real; model replies, credits and ads are simulated in the browser until the backend lands.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run build
```

## Where things live

| Path | What it is |
|---|---|
| `src/app/globals.css` | Design tokens (light and dark) and base styles |
| `src/lib/catalog.ts` | Models, tools, sponsors and credit prices |
| `src/lib/workspace-store.tsx` | Client state: credits, jobs, the out-of-credits gate |
| `src/components/job-view.tsx` | The shared job flow: prompt → working card → result → sponsor line |
| `src/components/sponsor.tsx` | Sponsor card, sponsor line and the inline rewarded spot |
| `src/components/composer.tsx` | Composer with the tool switch and the out-of-credits gate |
