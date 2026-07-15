// ---------- Constants ----------
const ICON_BASE = "images/cs-small/"; // change if your folder has a different name

// Map of resource names → icon filenames
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

// Pre-built regex matching any resource name (longest first so "Plant Fiber"
// beats "Fiber", "Ancient Tablet" beats "Tablet", etc.).
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

// Wraps each occurrence of a resource name in an inline <img>.
function formatDescription(text) {
  if (!text) return "";
  // Replace with placeholders first (so the regex doesn't match inside the
  // alt attributes we'll inject next).
  const placeholders = [];
  const P = (i) => `\uE000${i}\uE001`;
  let working = text.replace(RESOURCE_REGEX, (match) => {
    placeholders.push(match);
    return P(placeholders.length - 1);
  });
  // Escape the working string (placeholders survive this — they contain no
  // HTML-special characters).
  let html = escapeHtml(working);
  // Swap placeholders for actual <img> + text.
  html = html.replace(/\uE000(\d+)\uE001/g, (_, i) => {
    const name = placeholders[Number(i)];
    // Find canonical key (case-insensitive) for the icon filename
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

// ---------- Progress bar (4 markers, scaled to 1000) ----------
function updateVoteProgress(count) {
  const pct = Math.max(0, Math.min((count / 1000) * 100, 100));
  $("vote-progress-fill").style.width = pct + "%";
  $("marker-250").classList.toggle("earned", count >= 250);
  $("marker-500").classList.toggle("earned", count >= 500);
  $("marker-750").classList.toggle("earned", count >= 750);
  $("marker-1000").classList.toggle("earned", count >= 1000);
}

// ---------- Pairing ----------
function getRandomPair() {
  const n = state.cornerstones.length;
  const prevIds = state.currentPair.map((c) => c && c.id).filter(Boolean);
  let aIdx, bIdx;
  for (let attempt = 0; attempt < 20; attempt++) {
    aIdx = Math.floor(Math.random() * n);
    bIdx = Math.floor(Math.random() * n);
    if (aIdx === bIdx) continue;
    const a = state.cornerstones[aIdx].id;
    const b = state.cornerstones[bIdx].id;
    if (prevIds.length === 2 && prevIds.includes(a) && prevIds.includes(b)) continue;
    break;
  }
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

  const sendVote = fetch("/api/vote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      winner: winner.id,
      loser: loser.id,
      winnerInitial: winner.initialRating,
      loserInitial:  loser.initialRating,
    }),
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Vote API: ${res.status}`);
      const data = await res.json();
      if (data.winner) state.ratings[data.winner.id] = data.winner;
      if (data.loser)  state.ratings[data.loser.id]  = data.loser;
      state.voteCount = data.totalVotes ?? state.voteCount + 1;
      $("vote-count").textContent = state.voteCount;
      updateVoteProgress(state.voteCount);
    })
    .catch((err) => console.error("Vote failed:", err));

  await wait(180);
  winnerEl.classList.remove("chosen");
  loserEl.classList.remove("rejected");
  showNewMatchup();
  state.isAnimating = false;
  await sendVote;
}

// ---------- Rankings modal (horizontal bar graph) ----------
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

  // Scale bars relative to the current top rating (floor at 1200 so the bar
  // doesn't look 100% full when everything is bunched near the initial values).
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