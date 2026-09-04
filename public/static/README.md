# Smart Mandi — plain HTML/CSS/JS version

No build step. Open `index.html` directly or serve the folder with any static server
(`python3 -m http.server`). Uses the same backend tables and the same `book_token` RPC.

| Original React file | Static replacement |
| --- | --- |
| `src/routes/index.tsx` | `index.html` + `js/landing.js` |
| `src/routes/auth.tsx` | `auth.html` + `js/auth.js` |
| `src/routes/_authenticated/farmer.tsx` | `farmer.html` + `js/farmer.js` |
| `src/routes/_authenticated/book.tsx` | `book.html` + `js/book.js` |
| `src/routes/_authenticated/token.$tokenId.tsx` | `token.html?id=…` + `js/token.js` |
| `src/routes/_authenticated/operator.tsx` | `operator.html` + `js/operator.js` |
| `src/routes/_authenticated/admin.tsx` | `admin.html` + `js/admin.js` |
| `src/lib/auth.tsx`, `src/lib/queue.ts`, `src/components/AppShell.tsx`, Supabase client, sonner | `js/shared.js` |
| `src/styles.css` (Tailwind theme) | `styles.css` |

Notes on things that are not 1:1:

- **Routing**: one HTML page per route; the dynamic `/token/$tokenId` route became
  `token.html?id=<uuid>&new=true`.
- **Auth gate**: `_authenticated/route.tsx` became `requireAuth()` in `shared.js`, called at the
  top of each protected page; it redirects to `auth.html` when there is no session.
- **react-query**: replaced with plain `async` fetches plus explicit `refresh()`/`render()` calls.
- **Realtime**: unchanged logic — the subscription callback now re-fetches and re-renders instead
  of invalidating query keys.
- **Dialog / Tabs / Select / Badge (shadcn)**: hand-written markup — a `.modal-backdrop` div,
  `aria-selected` tabs, a native `<select>`, and `.badge` spans.
- **recharts**: the bar chart is drawn with CSS-height divs (same booked/served series).
- **sonner**: small `toast()` helper appending to a `#toasts` container.
- **lucide-react icons**: emoji glyphs, so there is no dependency to load.
- The Supabase URL and publishable key are inlined in `js/shared.js` since there is no bundler to
  substitute env vars. Both are public values, as before.
- The static site keeps its own session storage key, so signing in here is separate from the
  React app's session.
