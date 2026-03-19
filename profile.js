// Redirect to login if not authenticated
if (!requireAuth()) {
  throw new Error("Unauthenticated");
}

// ── Queries ───────────────────────────────────────────────────────

// Normal query — no arguments
const QUERY_USER = `
  query {
    user {
      id
      login
      email
      createdAt
      totalUp
      totalDown
    }
  }
`;

// Args query — where + order_by
const QUERY_XP = `
  query {
    transaction(
      where: { 
      type: { _eq: "xp" },
      path: { _like: "%/div-01/%" },
      }
      order_by: { createdAt: asc }
    ) {
      amount
      createdAt
      path
    }
  }
`;

// Level query — highest level transaction
const QUERY_LEVEL = `
  query {
    transaction(
      where: {
        type: { _eq: "level" }
        path: { _like: "%/div-01/%" }
      }
      order_by: { amount: desc }
      limit: 1
    ) {
      amount
    }
  }
`;

// Nested query — progress → object
const QUERY_PROGRESS = `
  query {
    progress(order_by: { createdAt: desc }, limit: 200) {
      id
      grade
      createdAt
      object {
        name
        type
      }
    }
  }
`;

// ── Utils ─────────────────────────────────────────────────────────

function setOverlay(show) {
  const el = document.getElementById("loading-overlay");
  if (el) el.style.display = show ? "flex" : "none";
}

function showCardError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="data-error">⚠ ${msg}</div>`;
}

function formatXP(xp) {
  if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(2)} MB`;
  if (xp >= 1_000)     return `${(xp / 1_000).toFixed(1)} kB`;
  return `${xp} B`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30)  return `${d}d ago`;
  const m = Math.floor(d / 30);
  if (m < 12)  return `${m}mo ago`;
  return `${Math.floor(m / 12)}y ago`;
}


// ── Renderers ─────────────────────────────────────────────────────

function renderUserInfo(user) {
  const el = document.getElementById("user-info");
  if (!el) return;

  const joined = new Date(user.createdAt).toLocaleDateString("en-GB", {
    year: "numeric", month: "long", day: "numeric",
  });

  el.innerHTML = `
    <div class="user-hero">
      <div class="user-details">
        <div class="user-login">${user.login}</div>
        <div class="user-email">${user.email || "—"}</div>
        <div class="user-meta">ID #${user.id} · Joined ${joined}</div>
      </div>
    </div>
  `;

  const nav = document.getElementById("nav-greeting");
  if (nav) nav.textContent = user.login;
}

function renderLevelBar(level) {
  const el = document.getElementById("user-level-bar");
  if (!el) return;

  el.innerHTML = `
    <div class="level-bar-label">
      <span>Level ${level}</span>
    </div>
  `;
}

function renderXPInfo(transactions) {
  const el = document.getElementById("xp-info");
  if (!el) return;

  if (!transactions?.length) {
    el.innerHTML = `<div class="data-empty">No XP transactions found.</div>`;
    return;
  }

  const totalXP = transactions.reduce((s, t) => s + t.amount, 0);
  const latest  = transactions[transactions.length - 1];
  const latestProject = latest.path
    ? latest.path.split("/").filter(Boolean).pop()
    : "—";

  el.innerHTML = `
    <div class="xp-hero">
      <div class="xp-num">${formatXP(totalXP)}</div>
      <div class="xp-sub">total experience earned</div>
    </div>
    <div class="stat-row">
      <div class="stat-item">
        <span class="stat-label">Transactions</span>
        <span class="stat-value">${transactions.length}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Latest XP</span>
        <span class="stat-value accent">${formatXP(latest.amount)}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Last project</span>
        <span class="stat-value small">${latestProject}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Last activity</span>
        <span class="stat-value">${timeAgo(latest.createdAt)}</span>
      </div>
    </div>
  `;
}

function renderAuditInfo(user) {
  const done     = user.totalUp   || 0;
  const received = user.totalDown || 0;

  // Clear the audit-info placeholder — the SVG carries all the data
  const el = document.getElementById("audit-info");
  if (el) el.innerHTML = "";

  drawAuditBars("audit-gauge", done, received);
}

function renderProgress(progress) {
  const el = document.getElementById("progress-info");
  if (!el) return;

  if (!progress?.length) {
    el.innerHTML = `<div class="data-empty">No progress data found.</div>`;
    drawDonutChart("pass-fail-donut", null, 0, 0);
    return;
  }

  const passed   = progress.filter(p => p.grade >= 1);
  const failed   = progress.filter(p => p.grade < 1);
  const passRate = ((passed.length / progress.length) * 100).toFixed(1);
  const recent   = progress.slice(0, 8);

  el.innerHTML = `
    <div class="stat-row four">
      <div class="stat-item">
        <span class="stat-label">Attempts</span>
        <span class="stat-value">${progress.length}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Passed</span>
        <span class="stat-value pass">${passed.length}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Failed</span>
        <span class="stat-value fail">${failed.length}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">Pass Rate</span>
        <span class="stat-value accent">${passRate}%</span>
      </div>
    </div>
    <div class="section-label">Recent Projects</div>
    <div class="recent-list">
      ${recent.map(p => `
        <div class="recent-item ${p.grade >= 1 ? "is-pass" : "is-fail"}">
          <span class="recent-name">${p.object?.name ?? "Unknown"}</span>
          <span class="recent-badge">${p.grade >= 1 ? "PASS" : "FAIL"}</span>
        </div>
      `).join("")}
    </div>
  `;

  drawDonutChart("pass-fail-donut", null, passed.length, failed.length);
}

// ── Init ──────────────────────────────────────────────────────────

async function initProfile() {
  setOverlay(true);

  try {
    const [userData, xpData, progressData, levelData] = await Promise.all([
      gqlRequest(QUERY_USER),
      gqlRequest(QUERY_XP),
      gqlRequest(QUERY_PROGRESS),
      gqlRequest(QUERY_LEVEL),
    ]);

    // ── User + Audit ──────────────────────────────────────────────
    const user = userData?.user?.[0];
    if (user) {
      renderUserInfo(user);
      renderAuditInfo(user);
    } else {
      showCardError("user-info",  "Could not load user info.");
      showCardError("audit-info", "No audit data.");
    }

    // ── XP ────────────────────────────────────────────────────────
    const txs = xpData?.transaction ?? [];
    renderXPInfo(txs);

    if (txs.length > 0) {
      const level = levelData?.transaction?.[0]?.amount ?? 0;
      renderLevelBar(level);
      drawSparkline("xp-sparkline", txs);
    }

    drawLineGraph("xp-line-graph",    txs);
    drawBarChart("xp-bar-chart",      txs);
    drawActivityHeatmap("activity-heatmap", txs);
    drawCategoryChart("xp-category-chart",  txs);

    // ── Progress ──────────────────────────────────────────────────
    const progress = progressData?.progress ?? [];
    renderProgress(progress);
    drawAttemptsChart("attempts-chart", progress);

  } catch (err) {
    console.error("Profile load failed:", err);
    ["user-info", "xp-info", "progress-info", "audit-info"].forEach(id =>
      showCardError(id, "Failed to load. Please refresh or log in again.")
    );
  } finally {
    setOverlay(false);
  }
}

initProfile();