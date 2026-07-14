# Cornerstone Matchmaker

A 1v1 head-to-head ranker for the annual Cornerstones from *Against the Storm*,
deployed on Cloudflare Pages with persistent votes stored in Cloudflare KV.
Ratings are computed with the Bradley–Terry model (Elo-style incremental
updates with $K = 24$, initial rating $1000$).

## File layout

| Path | Purpose |
|---|---|
| `index.html` | Page structure |
| `style.css`  | Minimalist dark theme + animations |
| `app.js`     | Frontend logic, fetch/POST, rankings modal |
| `data/cornerstones.json` | The CS dataset (editable) |
| `images/background.jpg`  | Optional background image |
| `images/cs/<id>.png`     | Optional per-cornerstone image |
| `functions/api/vote.js`   | `POST /api/vote` — updates Elo |
| `functions/api/rankings.js` | `GET /api/rankings` — returns ratings |

## First-time deployment

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Build settings: leave **Build command** and **Build output directory** empty.
4. **KV** → Create namespace `cs-votes`. Note the namespace ID.
5. Project → **Settings** → **Functions** → **KV namespace bindings**:
   - Variable name: `VOTES`
   - Namespace: `cs-votes`
6. Save. Cloudflare redeploys automatically; visit the `*.pages.dev` URL.

## Adding your own images & descriptions

* Drop one image per CS into `images/cs/` named after the `id` field
  (e.g. `alarm-bells.png`). PNG/JPG/WebP all work.
* If an image is missing, the site shows a "No image" placeholder so it stays functional.
* For the page background, drop a wide image at `images/background.jpg`.
  Without one, a dark gradient is used.
* Edit `data/cornerstones.json` to change any name, description, rarity, or `image` path.
  The site reads it on every page load — no rebuild required.

## Customising the algorithm

In `functions/api/vote.js`:
* `K_FACTOR` — update aggressiveness. Default `24`. Higher = ratings shift faster.
* `INITIAL_RATING` — starting score for new CSs. Default `1000`.
* `FLOOR` — minimum allowed rating. Default `1` (prevents degenerate values).

## Resetting the data

In the Cloudflare dashboard:
* **Workers & Pages → KV → cs-votes** → delete all keys, *or*
* Delete and recreate the `cs-votes` namespace and re-bind it.