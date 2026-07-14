// ---------- State ----------
const state = {
  cornerstones: [],
  ratings: {},     // id -> { rating, wins, losses }
  currentPair: [null, null],
  voteCount: 0,
  isAnimating: false,
};

const $ = (id) => document.getElementById(id);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Init ----------
async function init() {
  try {
    const res = await fetch("data/cornerstones.json");
    if (!res.ok) throw new Error(`Failed to load CS data: ${res.status}`);
    state.cornerstones = await res.json();
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
  } catch (err) {
    console.warn("Could not fetch rankings, using initial ratings:", err);
    state.ratings = {};
  }
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
    const img = $(`${prefix}-img`);
    // URL-encode so spaces/apostrophes in the file name are safe
    img.src = encodeURI(cs.image);
    img.alt = cs.name;
    img.onerror = () => {
      img.onerror = null;
      img.style.display = "none";
      img.parentElement.classList.add("no-image");
    };
    $(`${prefix}-name`).textContent = cs.name;
    $(`${prefix}-desc`).textContent = cs.description;
    const rarity = cs.rarity || "Epic";
	const rar = $(`${prefix}-rarity`);
	rar.textContent = rarity;
	rar.className = `cs-rarity rarity-${rarity.toLowerCase()}`;
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

  // Send initial ratings so the server can seed CSs it has never seen
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
    })
    .catch((err) => console.error("Vote failed:", err));

  await wait(180);
  winnerEl.classList.remove("chosen");
  loserEl.classList.remove("rejected");
  showNewMatchup();
  state.isAnimating = false;
  await sendVote;
}

// ---------- Rankings modal ----------
function showRankings() {
  const list = $("rankings-list");
  const sorted = state.cornerstones
    .map((cs) => {
      // Stored rating wins; otherwise fall back to the per-CS initial rating
      const stored = state.ratings[cs.id];
      const rating = stored ? stored.rating   : cs.initialRating;
      const wins   = stored ? stored.wins     : 0;
      const losses = stored ? stored.losses   : 0;
      return { ...cs, rating, wins, losses };
    })
    .sort((x, y) => y.rating - x.rating);

  list.innerHTML = sorted
    .map(
      (cs, i) => `
      <li>
        <span class="rank">#${i + 1}</span>
        <span class="name">${escapeHtml(cs.name)}</span>
        <span class="record">${cs.wins}–${cs.losses}</span>
        <span class="rating">${Math.round(cs.rating)}</span>
      </li>`
    )
    .join("");

  $("rankings-modal").hidden = false;
}

function closeRankings() { $("rankings-modal").hidden = true; }

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

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