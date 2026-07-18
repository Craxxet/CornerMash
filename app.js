// ---------- Constants ----------
const ICON_BASE = "images/cs-small/";

const RESOURCE_ICONS = {
  "Ale": "Ale.png",
  "Amber": "Amber.png",
  "Ancient Tablet": "Ancient Tablet.png",
  "Barrels": "Barrels.png",
  "Berries": "Berries.png",
  "Biscuits": "Biscuits.png",
  "Clay": "Clay.png",
  "Coal": "Coal.png",
  "Copper Ore": "Copper Ore.png",
  "Crystallized Dew": "Crystallized Dew.png",
  "Dangerous": "Dangerous.png",
  "Drizzle Water": "Drizzle Water.png",
  "Dye": "Dye.png",
  "Eggs": "Eggs.png",
  "Flour": "Flour.png",
  "Forbidden": "Forbidden.png",
  "Grain": "Grain.png",
  "Herbs": "Herbs.png",
  "Insects": "Insects.png",
  "Jerky": "Jerky.png",
  "Leather": "Leather.png",
  "Meat": "Meat.png",
  "Mushrooms": "Mushrooms.png",
  "Oil": "Oil.png",
  "Parts": "Parts.png",
  "Pickled Goods": "Pickled Goods.png",
  "Pie": "Pie.png",
  "Planks": "Planks.png",
  "Plant Fiber": "Plant Fiber.png",
  "Porridge": "Porridge.png",
  "Provisions": "Provisions.png",
  "Reeds": "Reeds.png",
  "Resin": "Resin.png",
  "Roots": "Roots.png",
  "Sea Marrow": "Sea Marrow.png",
  "Simple Tools": "Simple Tools.png",
  "Skewers": "Skewers.png",
  "Stone": "Stone.png",
  "Trade Goods": "Trade Goods.png",
  "Training Gear": "Training Gear.png",
  "Vegetables": "Vegetables.png",
  "Waterskins": "Waterskins.png",
  "Wildfire": "Wildfire.png",
  "Wine": "Wine.png",
  "Wood": "Wood.png",
};

const RESOURCE_REGEX = (() => {
  const names = Object.keys(RESOURCE_ICONS).sort((a, b) => b.length - a.length);
  const escaped = names.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(`\\b(${escaped})\\b`, "gi");
})();

// ---------- State ----------
const state = {
  cornerstones: [],
  ratings: {},
  currentPair: [null, null],
  voteCount: 0,
  isAnimating: false,
};

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Helpers ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function rarityClass(r) {
  return `rarity-${String(r || "N/A").toLowerCase().replace(/\//g, "-")}`;
}

function formatDescription(text) {
  if (!text) return "";
  const placeholders = [];
  const P = (i) => `\uE000${i}\uE001`;
  let working = text.replace(RESOURCE_REGEX, (match) => {
    placeholders.push(match);
    return P(placeholders.length - 1);
  });
  let html = escapeHtml(working);
  html = html.replace(/\uE000(\d+)\uE001/g, (_, i) => {
    const name = placeholders[Number(i)];
    const key = Object.keys(RESOURCE_ICONS).find(k => k.toLowerCase() === name.toLowerCase());
    const src = encodeURI(ICON_BASE + RESOURCE_ICONS[key]);
    return `<img class="inline-icon" src="${src}" alt="${escapeHtml(name)}" loading="lazy">${escapeHtml(name)}`;
  });
  return html;
}

// ---------- Init ----------
async function init() {
  try {
    const res = await fetch("data/cornerstones.json");
    if (!res.ok) throw new Error(`HTTP ${res.status} — check data/cornerstones.json`);
    state.cornerstones = await res.json();
    if (!Array.isArray(state.cornerstones)) {
      throw new Error("cornerstones.json is not a JSON array");
    }
    await refreshRankings();
    showNewMatchup();
  } catch (err) {
    console.error(err);
    $("cs-a-name").textContent = "Failed to load";
    $("cs-b-name").textContent = err.message || String(err);
  } finally {
    // Always hide the loading screen, success or failure.
    const loader = document.getElementById("loading");
    if (loader) loader.classList.add("hidden");
  }
}

async function refreshRankings() {
  try {
    const res = await fetch("/api/rankings");
    if (!res.ok) throw new Error(`Rankings API: ${res.status}`);
    const data = await res.json();
    state.ratings = data.ratings || {};
    state.voteCount = data.totalVotes || 0;
    $("vote-count").textContent = state.voteCount;
    updateVoteProgress(state.voteCount);
  } catch (err) {
    console.warn("Could not fetch rankings, using initial ratings:", err);
    state.ratings = {};
    updateVoteProgress(0);
  }
}

function updateVoteProgress(count) {
  const max = 5000;             // was 1000 — the new full-scale target
  const pct = Math.max(0, Math.min((count / max) * 100, 100));
  $("vote-progress-fill").style.width = pct + "%";

  // Light up every marker whose threshold the count has passed.
  // Works for any number of markers — add or remove them in HTML
  // without touching this function.
  document.querySelectorAll(".vote-progress-marker").forEach((marker) => {
    const threshold = parseInt(marker.dataset.threshold, 10);
    marker.classList.toggle("earned", count >= threshold);
  });
}

// ---------- Pairing ----------
function getRandomPair() {
  const cornerstones = state.cornerstones;
  const ratings     = state.ratings || {};
  const n           = cornerstones.length;
  const BAND        = 200;     // prefer pairs within 200 ELO of each other

  // Helper: was this exact pair just shown? Used to avoid back-to-back repeats.
  const prevIds = state.currentPair.map((c) => c && c.id).filter(Boolean);
  const isPreviousPair = (aId, bId) =>
    prevIds.length === 2 && prevIds.includes(aId) && prevIds.includes(bId);

  // Tier 1: try to find a same-band, non-repeating pair (up to 20 attempts).
  for (let attempt = 0; attempt < 20; attempt++) {
    const aIdx = Math.floor(Math.random() * n);
    const bIdx = Math.floor(Math.random() * n);
    if (aIdx === bIdx) continue;

    const a = cornerstones[aIdx];
    const b = cornerstones[bIdx];
    const aRating = ratings[a.id]?.rating ?? 1000;
    const bRating = ratings[b.id]?.rating ?? 1000;

    // The actual band filter — this is the line that does the work.
    if (Math.abs(aRating - bRating) > BAND) continue;

    if (isPreviousPair(a.id, b.id)) continue;

    return [aIdx, bIdx];
  }

  // Tier 2: relax the band filter, still avoid the previous pair.
  // (This kicks in only if a is an extreme outlier with no neighbors in band.)
  for (let attempt = 0; attempt < 20; attempt++) {
    const aIdx = Math.floor(Math.random() * n);
    const bIdx = Math.floor(Math.random() * n);
    if (aIdx === bIdx) continue;
    if (isPreviousPair(cornerstones[aIdx].id, cornerstones[bIdx].id)) continue;
    return [aIdx, bIdx];
  }

  // Tier 3: any non-self pair, period. Should never be reached
  // with 138 CSes, but the safety net is one line.
  const aIdx = Math.floor(Math.random() * n);
  let bIdx   = Math.floor(Math.random() * n);
  while (bIdx === aIdx) bIdx = Math.floor(Math.random() * n);
  return [aIdx, bIdx];
}

function showNewMatchup() {
  const [aIdx, bIdx] = getRandomPair();
  let left = state.cornerstones[aIdx];
  let right = state.cornerstones[bIdx];
  if (Math.random() < 0.5) [left, right] = [right, left];
  state.currentPair = [left, right];
  renderMatchup();
}

function renderMatchup() {
  for (const [cs, prefix] of [
    [state.currentPair[0], "cs-a"],
    [state.currentPair[1], "cs-b"],
  ]) {
    const rarity = cs.rarity || "N/A";
    const img = $(`${prefix}-img`);
    img.src = encodeURI(cs.image);
    img.alt = cs.name;
    img.onerror = () => {
      img.onerror = null;
      img.style.display = "none";
      img.parentElement.classList.add("no-image");
    };
    $(`${prefix}-name`).textContent = cs.name;
    $(`${prefix}-desc`).innerHTML = formatDescription(cs.description);
    const rar = $(`${prefix}-rarity`);
    rar.textContent = rarity;
    rar.className = `cs-rarity ${rarityClass(rarity)}`;
  }
  document.querySelectorAll(".cs-card").forEach((c) => {
    c.classList.remove("swap-in");
    void c.offsetWidth;
    c.classList.add("swap-in");
  });
}

// ---------- Voting ----------
async function vote(winnerIdx) {
  if (state.isAnimating) return;
  state.isAnimating = true;

  const [a, b] = state.currentPair;
  const winner = winnerIdx === 0 ? a : b;
  const loser  = winnerIdx === 0 ? b : a;

  const winnerEl = winnerIdx === 0 ? $("cs-a") : $("cs-b");
  const loserEl  = winnerIdx === 0 ? $("cs-b") : $("cs-a");

  winnerEl.classList.add("chosen");
  loserEl.classList.add("rejected");
  await wait(420);

  let voteOk = false;
  try {
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        winner: winner.id,
        loser:  loser.id,
        winnerInitial: winner.initialRating,
        loserInitial:  loser.initialRating,
      }),
    });
    if (!res.ok) throw new Error(`Vote API: ${res.status}`);

    const data = await res.json();
    if (data.winner) state.ratings[data.winner.id] = data.winner;
    if (data.loser)  state.ratings[data.loser.id]  = data.loser;
    state.voteCount = data.totalVotes ?? state.voteCount + 1;
    $("vote-count").textContent = state.voteCount;
    updateVoteProgress(state.voteCount);
    voteOk = true;
  } catch (err) {
    console.error("Vote failed:", err);
    // voteOk stays false → same matchup stays visible
  }

  await wait(180);
  winnerEl.classList.remove("chosen");
  loserEl.classList.remove("rejected");

  // Only advance to the next matchup if the server actually got the vote.
  // If the fetch failed, the user sees the same matchup and can click again.
  if (voteOk) showNewMatchup();
  state.isAnimating = false;
}

// ---------- Rankings modal ----------
function showRankings() {
  const list = $("rankings-list");
  const sorted = state.cornerstones
    .map((cs) => {
      const stored = state.ratings[cs.id];
      const rating = stored ? stored.rating : cs.initialRating;
      const wins   = stored ? stored.wins   : 0;
      const losses = stored ? stored.losses : 0;
      return { ...cs, rating, wins, losses };
    })
    .sort((x, y) => y.rating - x.rating);

  const maxRating = Math.max(...sorted.map(cs => cs.rating), 1200);

  list.innerHTML = sorted.map((cs, i) => {
    const pct = Math.max(2, (cs.rating / maxRating) * 100);
    const rarity = cs.rarity || "N/A";
    const rClass = rarityClass(rarity);
    const iconSrc = encodeURI(cs.image || "");
    return `
      <li class="rankings-bar-item">
        <span class="rankings-bar-rank">#${i + 1}</span>
        <img class="rankings-bar-icon" src="${iconSrc}" alt="" loading="lazy"
             onerror="this.onerror=null; this.style.visibility='hidden';">
        <div class="rankings-bar-info">
          <div class="rankings-bar-name-row">
            <span class="rankings-bar-name">${escapeHtml(cs.name)}</span>
            <span class="rankings-bar-rarity ${rClass}">${escapeHtml(rarity)}</span>
            <span class="rankings-bar-record">${cs.wins}–${cs.losses}</span>
          </div>
          <div class="rankings-bar-track">
            <div class="rankings-bar-fill ${rClass}" style="width: ${pct.toFixed(1)}%"></div>
          </div>
        </div>
        <span class="rankings-bar-rating">${Math.round(cs.rating)}</span>
      </li>`;
  }).join("");

  $("rankings-modal").hidden = false;
}

function closeRankings() { $("rankings-modal").hidden = true; }

// ---------- Wire up ----------
$("cs-a").addEventListener("click", () => vote(0));
$("cs-b").addEventListener("click", () => vote(1));
$("rankings-btn").addEventListener("click", showRankings);
$("close-modal").addEventListener("click", closeRankings);
$("rankings-modal").addEventListener("click", (e) => {
  if (e.target.id === "rankings-modal") closeRankings();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeRankings();
  if (e.key === "ArrowLeft")  vote(0);
  if (e.key === "ArrowRight") vote(1);
});

init();

// TEMPORARY: uncomment to preview the progress bar
// updateVoteProgress(2300);