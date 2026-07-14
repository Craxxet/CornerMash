# Cornerstone Matchmaker

A 1v1 head-to-head ranker for the annual Cornerstones from *Against the Storm*,
deployed on Cloudflare Pages with persistent votes stored in Cloudflare KV.
Ratings are computed with the Bradley–Terry model (ELO-style incremental
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