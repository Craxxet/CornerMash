# CornerMash

A 1v1 head-to-head ranker for the annual Cornerstones from *Against the Storm*, deployed on Cloudflare Pages with persistent votes stored in Cloudflare KV.

Ratings are computed with the Bradley–Terry model (ELO-style incremental updates with $K = 24$, initial rating pre-seeded at  $1600, 1400, 1200, 1000, 800, 600, 400$ based on community surveys).
## File layout

| File                        | Description                                                                                                                                                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `index.html`                | The page's HTML skeleton. Defines the two-card layout for CS comparison, the vote buttons, the rankings modal, the vote counter, and the load order of the page's other assets.                                                                                 |
| `style.css`                 | All visual styling. The two-card grid, the chosen/rejected hover and click animations, the rankings modal, the responsive layout for mobile, the typography, and the background image.                                                                          |
| `app.js`                    | Client-side JavaScript. Loads `cornerstones.json`, runs the matchmaking algorithm, renders CSes into the cards, posts votes to `/api/vote`, fetches and renders `/api/rankings`, manages the matchup flow and animations, and handles the in-flight vote guard. |
| `cornerstones.json`         | The CS dataset. An array of 138 entries; each has an `id` (slug), a display name, an `image` filename, and the initial ELO rating (all start at 1000).                                                                                                          |
| `background.jpg`            | The site-wide background image, referenced from `style.css`.                                                                                                                                                                                                    |
| `cs/`                       | Folder of full-size CS card images. Filenames are slugified to match the `image` field in `cornerstones.json`.                                                                                                                                                  |
| `cs-small/`                 | Folder of CS thumbnail images used in the rankings modal where vertical space is tight. Same naming convention as `cs/`.                                                                                                                                        |
| `functions/api/vote.js`     | Cloudflare Pages Function. Receives `POST /api/vote`, validates the body, looks up the global `RatingsDO` via the binding, calls its `fetch` to record the vote, and returns the updated winner/loser ratings to the client.                                    |
| `functions/api/rankings.js` | Cloudflare Pages Function. Receives `GET /api/rankings`, fetches the current ratings table from `RatingsDO`, and returns it as JSON.                                                                                                                            |
