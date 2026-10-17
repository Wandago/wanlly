# Task contract

Fill this in before any generation starts. Without it, the model decides when
it's finished. With it, the acceptance criteria decide. Paste the filled-in
contract as the first message of a task, or save it as `docs/tasks/<slug>.md`
for long tasks.

```markdown
## Task: <one line>

### Deliverable
- Files: <exact paths to create or change>
- Format: <component / route / doc / migration ...>

### Constraints
- Dependencies allowed: <none | list>   (anything else needs the user to confirm)
- Style: follow `prototype/index.html` tokens; match surrounding code
- Budget: <max attempts before escalation, default per HARNESS.md>

### Non-goals
- <files, features or refactors that must not be touched>

### Acceptance criteria
- [ ] `scripts/check.sh` exits 0
- [ ] <observable condition, e.g. "`/dev/ui` renders Composer in light and dark">
- [ ] <edge case, e.g. "empty recents list shows the empty state">

### Scope change
<empty: list anything outside Deliverable you needed and why, then ask>
```

## Example

```markdown
## Task: Design tokens file (Phase 1.1)

### Deliverable
- Files: `src/styles/tokens.css`, `tailwind.config.ts`
- Format: CSS custom properties, mapped into Tailwind theme

### Constraints
- Dependencies allowed: none beyond what Phase 1 setup already installed
- Values copied exactly from `:root` in `prototype/index.html`

### Non-goals
- No components, no changes to the prototype

### Acceptance criteria
- [ ] `scripts/check.sh` exits 0
- [ ] Every `--*` variable in the prototype's light and dark `:root` exists in `tokens.css` with the same value
- [ ] Dark values apply under both `prefers-color-scheme: dark` and `[data-theme="dark"]`
```
