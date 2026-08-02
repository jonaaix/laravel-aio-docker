## Frontend assets
- No Vite dev server runs inside this container — edits to frontend assets are NOT picked up automatically.
- After changing frontend assets (JS, CSS, Vue/React components), run `npm run build` to make the changes visible.
- Never start `npm run dev` — a long-running dev server has no place in this environment.
