// ─── Color palette ────────────────────────────────────────────────
const C = {
  accent:     "#4f9cff",
  accent2:    "#7c3aed",
  pass:       "#34d399",
  fail:       "#f87171",
  warn:       "#fbbf24",
  grid:       "#1a2540",
  text:       "#5a6a85",
  textBright: "#a8b8d0",
  bg:         "#080d18",
  surface2:   "#0d1524",
  // Category palette
  cat: ["#4f9cff","#7c3aed","#34d399","#fbbf24","#f87171","#06b6d4","#a78bfa","#fb923c"],
};

// ─── Shared utilities ─────────────────────────────────────────────

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function formatXP(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} MB`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)} kB`;
  return `${n} B`;
}

function fmtDate(d) {
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function fmtDateFull(d) {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Tooltip engine ───────────────────────────────────────────────

const Tooltip = (() => {
  const el = document.getElementById("graph-tooltip");
  if (!el) return { show(){}, hide(){} };

  function show(html, e) {
    el.innerHTML = html;
    el.classList.add("visible");
    el.setAttribute("aria-hidden", "false");
    move(e);
  }

  function move(e) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = el.offsetWidth + 16, h = el.offsetHeight + 16;
    let x = e.clientX + 14;
    let y = e.clientY - 10;
    if (x + w > vw) x = e.clientX - w + 2;
    if (y + h > vh) y = e.clientY - h - 4;
    el.style.left = x + "px";
    el.style.top  = y + "px";
  }

  function hide() {
    el.classList.remove("visible");
    el.setAttribute("aria-hidden", "true");
  }

  return { show, move, hide };
})();

// ═════════════════════════════════════════════════════════════════
// GRAPH 1 — XP Over Time (Animated Line + Area + Tooltip)
// ═════════════════════════════════════════════════════════════════

function drawLineGraph(containerId, transactions) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!transactions || transactions.length === 0) {
    container.innerHTML = `<p class="graph-empty">No XP data available.</p>`;
    return;
  }

  const W = 800, H = 280;
  const PL = 70, PR = 28, PT = 28, PB = 50;
  const gW = W - PL - PR, gH = H - PT - PB;

  const sorted = [...transactions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  let cum = 0;
  const pts = sorted.map(tx => ({
    date: new Date(tx.createdAt),
    xp: (cum += tx.amount),
    amount: tx.amount,
    path: tx.path,
  }));

  const minDate  = pts[0].date.getTime();
  const maxDate  = pts[pts.length - 1].date.getTime();
  const maxXP    = pts[pts.length - 1].xp;
  const dateRange = maxDate - minDate || 1;

  const sx = d => PL + ((d.getTime() - minDate) / dateRange) * gW;
  const sy = v => PT + gH - (v / maxXP) * gH;

  const linePoints = pts.map(p => `${sx(p.date).toFixed(1)},${sy(p.xp).toFixed(1)}`).join(" ");
  const firstX = sx(pts[0].date).toFixed(1);
  const lastX  = sx(pts[pts.length - 1].date).toFixed(1);
  const bottom = (PT + gH).toFixed(1);
  const areaD  = `M${firstX},${bottom} L${linePoints.replace(/ /g, " L")} L${lastX},${bottom}Z`;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ v: maxXP * f, y: sy(maxXP * f) }));
  const xCount = Math.min(6, pts.length);
  const xTicks = Array.from({ length: xCount }, (_, i) => {
    const idx = Math.round((i / (xCount - 1 || 1)) * (pts.length - 1));
    return { date: pts[idx].date, x: sx(pts[idx].date) };
  });

  const totalLen = pts.reduce((acc, p, i) => {
    if (i === 0) return acc;
    const prev = pts[i - 1];
    return acc + Math.hypot(sx(p.date) - sx(prev.date), sy(p.xp) - sy(prev.xp));
  }, 0) + 10;

  const uid = "lg_" + Math.random().toString(36).slice(2, 7);
  const fmtY = v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : Math.round(v).toString();

  // Sample dots (every N-th + last)
  const step = Math.max(1, Math.floor(pts.length / 60));
  const dotPts = pts.filter((_, i) => i % step === 0 || i === pts.length - 1);

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": "XP earned over time line chart",
    style: "width:100%;height:auto;display:block;overflow:visible",
  });

  svg.innerHTML = `
    <defs>
      <linearGradient id="${uid}_grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="${C.accent}" stop-opacity="0.30"/>
        <stop offset="100%" stop-color="${C.accent}" stop-opacity="0.01"/>
      </linearGradient>
      <linearGradient id="${uid}_line" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%"   stop-color="${C.accent2}"/>
        <stop offset="100%" stop-color="${C.accent}"/>
      </linearGradient>
      <filter id="${uid}_glow">
        <feGaussianBlur stdDeviation="2.5" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <clipPath id="${uid}_clip">
        <rect x="${PL}" y="${PT - 4}" width="${gW}" height="${gH + 8}"/>
      </clipPath>
    </defs>

    ${yTicks.map(t => `
      <line x1="${PL}" y1="${t.y.toFixed(1)}" x2="${W - PR}" y2="${t.y.toFixed(1)}"
        stroke="${C.grid}" stroke-width="1" stroke-dasharray="4 6" opacity="0.8"/>
      <text x="${PL - 10}" y="${t.y.toFixed(1)}"
        text-anchor="end" dominant-baseline="middle"
        font-size="11" fill="${C.text}" font-family="JetBrains Mono,monospace"
      >${fmtY(t.v)}</text>
    `).join("")}

    <path d="${areaD}" fill="url(#${uid}_grad)" clip-path="url(#${uid}_clip)"/>

    <polyline points="${linePoints}"
      fill="none"
      stroke="url(#${uid}_line)"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      filter="url(#${uid}_glow)"
      stroke-dasharray="${totalLen}"
      stroke-dashoffset="${totalLen}"
      clip-path="url(#${uid}_clip)">
      <animate attributeName="stroke-dashoffset"
        from="${totalLen}" to="0"
        dur="1.6s" calcMode="spline"
        keySplines="0.25 0.1 0.25 1"
        fill="freeze"/>
    </polyline>

    <!-- Invisible wider hit areas for tooltip -->
    ${dotPts.map((p, i) => `
      <circle class="lg-dot" cx="${sx(p.date).toFixed(1)}" cy="${sy(p.xp).toFixed(1)}"
        r="6" fill="transparent"
        data-xp="${p.xp}" data-amount="${p.amount}"
        data-date="${p.date.toISOString()}"
        data-path="${p.path || ""}"
        clip-path="url(#${uid}_clip)"/>
      <circle cx="${sx(p.date).toFixed(1)}" cy="${sy(p.xp).toFixed(1)}"
        r="3" fill="${C.accent}" opacity="0.8" pointer-events="none"
        clip-path="url(#${uid}_clip)">
        <animate attributeName="opacity" from="0" to="0.8"
          dur="0.3s" begin="${0.8 + i * 0.015}s" fill="freeze"/>
      </circle>
    `).join("")}

    ${xTicks.map(t => `
      <text x="${t.x.toFixed(1)}" y="${H - PB + 18}"
        text-anchor="middle" font-size="11"
        fill="${C.text}" font-family="JetBrains Mono,monospace"
      >${fmtDate(t.date)}</text>
    `).join("")}

    <line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT + gH}"
      stroke="${C.textBright}" stroke-width="1" opacity="0.15"/>
    <line x1="${PL}" y1="${PT + gH}" x2="${W - PR}" y2="${PT + gH}"
      stroke="${C.textBright}" stroke-width="1" opacity="0.15"/>

    <text x="${W - PR - 2}" y="${sy(maxXP) - 10}"
      text-anchor="end" font-size="12" font-weight="600"
      fill="${C.accent}" font-family="JetBrains Mono,monospace"
    >${formatXP(maxXP)}</text>
  `;

  // Hover
  svg.querySelectorAll(".lg-dot").forEach(dot => {
    dot.style.cursor = "crosshair";
    dot.addEventListener("mouseenter", e => {
      const xp  = parseInt(dot.dataset.xp, 10);
      const amt = parseInt(dot.dataset.amount, 10);
      const d   = new Date(dot.dataset.date);
      const p   = dot.dataset.path ? dot.dataset.path.split("/").filter(Boolean).pop() : null;
      Tooltip.show(`
        <strong>${formatXP(xp)}</strong>
        <span class="tt-sub">+${formatXP(amt)} earned</span>
        <span class="tt-sub">${fmtDateFull(d)}</span>
        ${p ? `<span class="tt-sub">${p}</span>` : ""}
      `, e);
    });
    dot.addEventListener("mousemove", e => Tooltip.move(e));
    dot.addEventListener("mouseleave", () => Tooltip.hide());
  });

  container.innerHTML = "";
  container.appendChild(svg);
}

// ═════════════════════════════════════════════════════════════════
// GRAPH 2 — Pass / Fail Donut
// ═════════════════════════════════════════════════════════════════

function drawDonutChart(containerId, legendId, passCount, failCount) {
  const container = document.getElementById(containerId);
  const legend    = document.getElementById(legendId);
  if (!container) return;

  const total = passCount + failCount;
  if (total === 0) {
    container.innerHTML = `<p class="graph-empty">No data available.</p>`;
    return;
  }

  const SIZE = 240, cx = 120, cy = 120, R = 95, r = 58;

  function polarXY(deg, radius) {
    const rad = ((deg - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function arcPath(startDeg, endDeg, outerR, innerR) {
    const s  = polarXY(startDeg, outerR);
    const e  = polarXY(endDeg,   outerR);
    const is = polarXY(endDeg,   innerR);
    const ie = polarXY(startDeg, innerR);
    const large = (endDeg - startDeg) > 180 ? 1 : 0;
    return [
      `M${s.x.toFixed(2)},${s.y.toFixed(2)}`,
      `A${outerR},${outerR} 0 ${large} 1 ${e.x.toFixed(2)},${e.y.toFixed(2)}`,
      `L${is.x.toFixed(2)},${is.y.toFixed(2)}`,
      `A${innerR},${innerR} 0 ${large} 0 ${ie.x.toFixed(2)},${ie.y.toFixed(2)}`,
      "Z",
    ].join(" ");
  }

  const slices = [
    { label: "PASS", count: passCount, color: C.pass },
    { label: "FAIL", count: failCount, color: C.fail },
  ];

  const GAP = 3;
  let angle = 0;
  const paths = slices.map(s => {
    if (s.count === 0) return "";
    const sweep = (s.count / total) * 360;
    const start = angle + GAP, end = angle + sweep - GAP;
    angle += sweep;
    const pct = ((s.count / total) * 100).toFixed(1);
    const mid  = (start + end) / 2;
    const lp   = polarXY(mid, (R + r) / 2);
    return `
      <path class="donut-slice" d="${arcPath(start, end, R, r)}"
        fill="${s.color}" opacity="0.9"
        data-label="${s.label}" data-count="${s.count}" data-pct="${pct}"
        style="cursor:default;transition:opacity 0.15s,filter 0.15s"/>
    `;
  }).join("");

  const passPct = ((passCount / total) * 100).toFixed(0);
  const uid = "dc_" + Math.random().toString(36).slice(2, 7);

  const svg = svgEl("svg", {
    viewBox: `0 0 ${SIZE} ${SIZE}`,
    role: "img",
    "aria-label": "Pass fail ratio donut chart",
    style: "width:100%;max-width:240px;height:auto;display:block;",
  });

  svg.innerHTML = `
    <defs>
      <filter id="${uid}_glow">
        <feGaussianBlur stdDeviation="3" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${R + 5}" fill="none"
      stroke="${C.grid}" stroke-width="1" opacity="0.5"/>
    ${paths}
    <text x="${cx}" y="${cy - 10}" text-anchor="middle"
      font-size="30" font-weight="700" fill="${C.pass}"
      font-family="JetBrains Mono,monospace">${passPct}%</text>
    <text x="${cx}" y="${cy + 10}" text-anchor="middle"
      font-size="10.5" fill="${C.text}"
      font-family="JetBrains Mono,monospace">pass rate</text>
    <text x="${cx}" y="${cy + 26}" text-anchor="middle"
      font-size="10.5" fill="${C.textBright}"
      font-family="JetBrains Mono,monospace">${total} total</text>
  `;

  svg.querySelectorAll(".donut-slice").forEach((el, i) => {
    const d = el.getAttribute("d");
    el.addEventListener("mouseenter", e => {
      el.style.opacity = "1";
      el.style.filter = `drop-shadow(0 0 6px ${el.getAttribute("fill")})`;
      Tooltip.show(`
        <strong>${el.dataset.label}</strong>
        <span class="tt-sub">${el.dataset.count} projects · ${el.dataset.pct}%</span>
      `, e);
    });
    el.addEventListener("mousemove", e => Tooltip.move(e));
    el.addEventListener("mouseleave", () => {
      el.style.opacity = "0.9";
      el.style.filter = "none";
      Tooltip.hide();
    });
    // Draw-in animation
    setTimeout(() => {
      el.style.transition += ",transform 0.5s";
    }, 200 + i * 150);
  });

  container.innerHTML = "";
  container.appendChild(svg);

  if (legend) {
    legend.innerHTML = slices.map(s => {
      const pct = total > 0 ? ((s.count / total) * 100).toFixed(1) : "0.0";
      return `
        <div class="legend-row">
          <div class="legend-swatch" style="background:${s.color}"></div>
          <div>
            <div class="legend-lbl">${s.label}</div>
            <div class="legend-val">${s.count} <span class="legend-sub">(${pct}%)</span></div>
          </div>
        </div>`;
    }).join("");
  }
}

// ═════════════════════════════════════════════════════════════════
// GRAPH 3 — Top Projects by XP (Horizontal Bars)
// ═════════════════════════════════════════════════════════════════

function drawBarChart(containerId, transactions) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!transactions || transactions.length === 0) {
    container.innerHTML = `<p class="graph-empty">No XP data available.</p>`;
    return;
  }

  const byProject = {};
  for (const tx of transactions) {
    const name = tx.path ? tx.path.split("/").filter(Boolean).pop() : "unknown";
    byProject[name] = (byProject[name] || 0) + tx.amount;
  }

  const topN = Object.entries(byProject).sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (topN.length === 0) {
    container.innerHTML = `<p class="graph-empty">No project data found.</p>`;
    return;
  }

  const BAR_H = 28, GAP = 9, PL = 155, PR = 90, PT = 12, PB = 12;
  const W = 640, H = PT + topN.length * (BAR_H + GAP) - GAP + PB;
  const maxVal = topN[0][1];
  const barW   = W - PL - PR;

  const barColor = i => {
    const t = i / Math.max(topN.length - 1, 1);
    const r = Math.round(79  + (124 - 79)  * t);
    const g = Math.round(156 + (58  - 156) * t);
    const b = Math.round(255 + (237 - 255) * t);
    return `rgb(${r},${g},${b})`;
  };

  const bars = topN.map(([name, xp], i) => {
    const y   = PT + i * (BAR_H + GAP);
    const fw  = (xp / maxVal) * barW;
    const dn  = name.length > 22 ? name.slice(0, 20) + "…" : name;
    const col = barColor(i);
    return `
      <text x="${PL - 10}" y="${y + BAR_H / 2}"
        text-anchor="end" dominant-baseline="middle"
        font-size="11.5" fill="${C.textBright}"
        font-family="JetBrains Mono,monospace">${dn}</text>
      <rect x="${PL}" y="${y}" width="${barW}" height="${BAR_H}"
        rx="5" fill="${C.grid}" opacity="0.5"/>
      <rect class="bar-rect" x="${PL}" y="${y}" width="${fw.toFixed(1)}" height="${BAR_H}"
        rx="5" fill="${col}" opacity="0.85"
        data-name="${name}" data-xp="${xp}">
        <animate attributeName="width"
          from="0" to="${fw.toFixed(1)}"
          dur="${0.45 + i * 0.055}s" begin="${i * 0.035}s"
          calcMode="spline" keySplines="0.25 0.1 0.25 1"
          fill="freeze"/>
      </rect>
      <text x="${PL + fw + 7}" y="${y + BAR_H / 2}"
        dominant-baseline="middle"
        font-size="11" fill="${col}"
        font-family="JetBrains Mono,monospace" opacity="0">
        ${formatXP(xp)}
        <animate attributeName="opacity" from="0" to="1"
          dur="0.3s" begin="${0.35 + i * 0.04}s" fill="freeze"/>
      </text>
    `;
  }).join("");

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": "Top projects by XP bar chart",
    style: "width:100%;height:auto;display:block;",
  });
  svg.innerHTML = bars;

  svg.querySelectorAll(".bar-rect").forEach(el => {
    el.style.cursor = "default";
    el.addEventListener("mouseenter", e => {
      el.style.opacity = "1";
      el.style.filter = "brightness(1.25)";
      Tooltip.show(`
        <strong>${el.dataset.name}</strong>
        <span class="tt-sub">${formatXP(parseInt(el.dataset.xp, 10))} earned</span>
      `, e);
    });
    el.addEventListener("mousemove", e => Tooltip.move(e));
    el.addEventListener("mouseleave", () => {
      el.style.opacity = "0.85";
      el.style.filter = "none";
      Tooltip.hide();
    });
  });

  container.innerHTML = "";
  container.appendChild(svg);
}

// ═════════════════════════════════════════════════════════════════
// GRAPH 4 — Audit Bars: big ratio number + two spaced bars
// ═════════════════════════════════════════════════════════════════

function drawAuditBars(containerId, done, received) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (done === 0 && received === 0) {
    container.innerHTML = `<p class="graph-empty">No audit data available.</p>`;
    return;
  }

  const ratio = received > 0 ? done / received : (done > 0 ? 999 : 0);
  let ratioColor = C.fail;
  if (ratio >= 0.8) ratioColor = C.warn;
  if (ratio >= 1.2) ratioColor = C.pass;

  const W      = 500;
  const BAR_H  = 150;   // bar height
  const GAP    = 50;   // space between the two bars
  const max    = Math.max(done, received, 1);

  const doneW = Math.max((done     / max) * W, 6);
  const recvW = Math.max((received / max) * W, 6);

  const ratioY = 100;   // baseline of ratio number
  const doneY  = ratioY + 40;   // top of done bar — gap below ratio text
  const recvY  = doneY + BAR_H + GAP;  // top of received bar
  const H      = recvY + BAR_H + 16;   // total height with bottom padding

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": "Audit ratio bars",
    style: "width:100%;height:auto;display:block;",
  });

  svg.innerHTML = `
    <defs>
      <linearGradient id="ag_done" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${C.pass}" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="${C.pass}"/>
      </linearGradient>
      <linearGradient id="ag_recv" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${C.fail}" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="${C.fail}"/>
      </linearGradient>
    </defs>

    <!-- Ratio number -->
    <text x="0" y="${ratioY}"
      text-anchor="start" dominant-baseline="auto"
      font-size="70" font-weight="700" fill="${ratioColor}"
      font-family="JetBrains Mono,monospace"
    >${ratio > 99 ? "∞" : ratio.toFixed(2)}</text>
    <text x="${ratio > 99 ? 30 : ratio.toFixed(2).length * 45 + 6}" y="${ratioY}"
      text-anchor="start" dominant-baseline="auto"
      font-size="24" fill="${C.text}" letter-spacing="0.04em"
      font-family="JetBrains Mono,monospace">ratio</text>

    <!-- Done bar track -->
    <rect x="0" y="${doneY}" width="${W}" height="${BAR_H}"
      rx="6" fill="${C.grid}" opacity="0.55"/>
    <!-- Done bar fill -->
    <rect class="ag-bar"
      x="0" y="${doneY}" width="0" height="${BAR_H}"
      rx="6" fill="url(#ag_done)" opacity="0.85"
      data-label="done" data-value="${formatXP(done)}" data-color="${C.pass}"
      style="cursor:default;transition:opacity 0.15s,filter 0.15s">
      <animate attributeName="width"
        from="0" to="${doneW.toFixed(1)}"
        dur="0.7s" calcMode="spline" keySplines="0.25 0.1 0.25 1" fill="freeze"/>
    </rect>

    <!-- Received bar track -->
    <rect x="0" y="${recvY}" width="${W}" height="${BAR_H}"
      rx="6" fill="${C.grid}" opacity="0.55"/>
    <!-- Received bar fill -->
    <rect class="ag-bar"
      x="0" y="${recvY}" width="0" height="${BAR_H}"
      rx="6" fill="url(#ag_recv)" opacity="0.85"
      data-label="received" data-value="${formatXP(received)}" data-color="${C.fail}"
      style="cursor:default;transition:opacity 0.15s,filter 0.15s">
      <animate attributeName="width"
        from="0" to="${recvW.toFixed(1)}"
        dur="0.7s" begin="0.1s" calcMode="spline" keySplines="0.25 0.1 0.25 1" fill="freeze"/>
    </rect>
  `;

  svg.querySelectorAll(".ag-bar").forEach(el => {
    el.addEventListener("mouseenter", e => {
      el.style.opacity = "1";
      el.style.filter  = `drop-shadow(0 0 6px ${el.dataset.color})`;
      Tooltip.show(`
        <strong>${el.dataset.label}</strong>
        <span class="tt-sub">${el.dataset.value}</span>
      `, e);
    });
    el.addEventListener("mousemove", e => Tooltip.move(e));
    el.addEventListener("mouseleave", () => {
      el.style.opacity = "0.85";
      el.style.filter  = "none";
      Tooltip.hide();
    });
  });

  container.innerHTML = "";
  container.appendChild(svg);
}

// ═════════════════════════════════════════════════════════════════
// GRAPH 5 — Sparkline (mini line in XP card)
// ═════════════════════════════════════════════════════════════════

function drawSparkline(containerId, transactions) {
  const container = document.getElementById(containerId);
  if (!container || !transactions || transactions.length < 2) return;

  const sorted = [...transactions].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  let cum = 0;
  const pts = sorted.map(tx => (cum += tx.amount));

  const W = 400, H = 120;
  const max = pts[pts.length - 1], min = pts[0];
  const range = max - min || 1;

  const sx = i => (i / (pts.length - 1)) * W;
  const sy = v => H - ((v - min) / range) * (H - 8) - 4;

  const lineStr = pts.map((v, i) => `${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
  const uid = "sp_" + Math.random().toString(36).slice(2, 7);

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    style: "width:100%;height:120px;display:block;",
    "aria-hidden": "true",
  });

  svg.innerHTML = `
    <defs>
      <linearGradient id="${uid}_sg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%"   stop-color="#4f9cff" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#4f9cff" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <path d="M0,${H} L${lineStr.replace(/ /g, " L")} L${W},${H}Z"
      fill="url(#${uid}_sg)"/>
    <polyline points="${lineStr}"
      fill="none" stroke="#4f9cff" stroke-width="2.2"
      stroke-linecap="round" stroke-linejoin="round" opacity="0.95"/>
  `;

  container.innerHTML = "";
  container.appendChild(svg);
}

// ═════════════════════════════════════════════════════════════════
// GRAPH 6 — Monthly Activity Heatmap (NEW)
// ═════════════════════════════════════════════════════════════════

function drawActivityHeatmap(containerId, transactions) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!transactions || transactions.length === 0) {
    container.innerHTML = `<p class="graph-empty">No activity data available.</p>`;
    return;
  }

  // Aggregate XP per month
  const monthly = {};
  for (const tx of transactions) {
    const d   = new Date(tx.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthly[key] = (monthly[key] || 0) + tx.amount;
  }

  // Build last 18 months of data
  const months = [];
  const now = new Date();
  for (let i = 17; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ key, date: d, xp: monthly[key] || 0 });
  }

  const maxXP = Math.max(...months.map(m => m.xp), 1);

  const COLS   = 6;
  const ROWS   = Math.ceil(months.length / COLS);
  const CW     = 72, CH = 54, GAP = 8;
  const PL     = 8, PT = 30, PR = 8, PB = 8;
  const W      = PL + COLS * (CW + GAP) - GAP + PR;
  const H      = PT + ROWS * (CH + GAP) - GAP + PB;

  function intensity(xp) {
    if (xp === 0) return 0;
    return 0.12 + (xp / maxXP) * 0.88;
  }

  function cellColor(xp) {
    const t = xp / maxXP;
    if (xp === 0) return C.grid;
    // gradient from surface2 → accent2 → accent
    const r = Math.round(13  + (79 - 13)   * t);
    const g = Math.round(21  + (156 - 21)  * t);
    const b = Math.round(36  + (255 - 36)  * t);
    return `rgb(${r},${g},${b})`;
  }

  const monthLabels = months.slice(0, COLS).map((m, i) => {
    const x = PL + i * (CW + GAP) + CW / 2;
    return `<text x="${x}" y="18" text-anchor="middle" font-size="10"
      fill="${C.text}" font-family="JetBrains Mono,monospace">
      ${m.date.toLocaleDateString("en-GB", { month: "short" })}
    </text>`;
  });

  const cells = months.map((m, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x   = PL + col * (CW + GAP);
    const y   = PT + row * (CH + GAP);
    const col_ = cellColor(m.xp);
    const op   = m.xp === 0 ? 0.4 : 0.88;
    const label = m.date.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    return `
      <rect class="hm-cell" x="${x}" y="${y}" width="${CW}" height="${CH}"
        rx="6" fill="${col_}" opacity="${op}"
        data-key="${m.key}" data-xp="${m.xp}" data-label="${label}"
        style="cursor:default;transition:opacity 0.15s,filter 0.15s"/>
      <text x="${x + CW / 2}" y="${y + CH / 2 - 6}" text-anchor="middle"
        dominant-baseline="middle" font-size="9.5"
        fill="${m.xp === 0 ? C.text : "#fff"}" opacity="${m.xp === 0 ? 0.5 : 0.9}"
        font-family="JetBrains Mono,monospace" pointer-events="none"
      >${label}</text>
      ${m.xp > 0 ? `<text x="${x + CW / 2}" y="${y + CH / 2 + 9}" text-anchor="middle"
        dominant-baseline="middle" font-size="10" font-weight="600"
        fill="#fff" opacity="0.85"
        font-family="JetBrains Mono,monospace" pointer-events="none"
      >${formatXP(m.xp)}</text>` : ""}
    `;
  }).join("");

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": "Monthly XP activity heatmap",
    style: "width:100%;height:auto;display:block;",
  });

  svg.innerHTML = cells;

  svg.querySelectorAll(".hm-cell").forEach(el => {
    el.addEventListener("mouseenter", e => {
      el.style.opacity = "1";
      el.style.filter  = "brightness(1.3)";
      const xp  = parseInt(el.dataset.xp, 10);
      const lbl = el.dataset.label;
      Tooltip.show(`
        <strong>${lbl}</strong>
        <span class="tt-sub">${xp > 0 ? formatXP(xp) + " earned" : "No activity"}</span>
      `, e);
    });
    el.addEventListener("mousemove", e => Tooltip.move(e));
    el.addEventListener("mouseleave", () => {
      const xp = parseInt(el.dataset.xp, 10);
      el.style.opacity = xp === 0 ? "0.4" : "0.88";
      el.style.filter  = "none";
      Tooltip.hide();
    });
  });

  container.innerHTML = "";
  container.appendChild(svg);
}

// ═════════════════════════════════════════════════════════════════
// GRAPH 7 — XP by Category (Radial / Stacked Bars) (NEW)
// ═════════════════════════════════════════════════════════════════

function drawCategoryChart(containerId, transactions) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!transactions || transactions.length === 0) {
    container.innerHTML = `<p class="graph-empty">No data available.</p>`;
    return;
  }

  // Extract category from path (e.g. /gritlab/div-01/go → "div-01" or "go")
  const catMap = {};
  for (const tx of transactions) {
    if (!tx.path) continue;
    const parts = tx.path.split("/").filter(Boolean);
    // Use segment index 2 if it exists (e.g. "div-01"), else segment 1
    let cat = parts[2] || parts[1] || parts[0] || "other";
    // Normalise known patterns
    if (cat.startsWith("piscine")) cat = "piscine";
    catMap[cat] = (catMap[cat] || 0) + tx.amount;
  }

  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (sorted.length === 0) {
    container.innerHTML = `<p class="graph-empty">No category data found.</p>`;
    return;
  }

  const totalXP = sorted.reduce((s, [, v]) => s + v, 0);
  const maxXP   = sorted[0][1];

  // Horizontal stacked / proportional bars
  const W     = 800;
  const BAR_H = 36;
  const GAP   = 10;
  const PL    = 130, PR = 110, PT = 16, PB = 16;
  const barW  = W - PL - PR;
  const H     = PT + sorted.length * (BAR_H + GAP) - GAP + PB;

  const bars = sorted.map(([cat, xp], i) => {
    const fw  = (xp / maxXP) * barW;
    const pct = ((xp / totalXP) * 100).toFixed(1);
    const col = C.cat[i % C.cat.length];
    const y   = PT + i * (BAR_H + GAP);
    const dn  = cat.length > 18 ? cat.slice(0, 16) + "…" : cat;

    return `
      <text x="${PL - 10}" y="${y + BAR_H / 2}"
        text-anchor="end" dominant-baseline="middle"
        font-size="12" fill="${C.textBright}"
        font-family="JetBrains Mono,monospace">${dn}</text>

      <rect x="${PL}" y="${y}" width="${barW}" height="${BAR_H}"
        rx="6" fill="${C.grid}" opacity="0.45"/>

      <rect class="cat-bar" x="${PL}" y="${y}" width="${fw.toFixed(1)}" height="${BAR_H}"
        rx="6" fill="${col}" opacity="0.88"
        data-cat="${cat}" data-xp="${xp}" data-pct="${pct}">
        <animate attributeName="width"
          from="0" to="${fw.toFixed(1)}"
          dur="${0.5 + i * 0.06}s" begin="${i * 0.04}s"
          calcMode="spline" keySplines="0.25 0.1 0.25 1"
          fill="freeze"/>
      </rect>

      <!-- Pct label inside bar if wide enough -->
      ${fw > 50 ? `<text x="${PL + 10}" y="${y + BAR_H / 2}"
        dominant-baseline="middle" font-size="10.5" fill="rgba(255,255,255,0.6)"
        font-family="JetBrains Mono,monospace" pointer-events="none">${pct}%</text>` : ""}

      <text x="${PL + fw + 8}" y="${y + BAR_H / 2}"
        dominant-baseline="middle"
        font-size="11" fill="${col}"
        font-family="JetBrains Mono,monospace" opacity="0">
        ${formatXP(xp)}
        <animate attributeName="opacity" from="0" to="1"
          dur="0.3s" begin="${0.4 + i * 0.04}s" fill="freeze"/>
      </text>
    `;
  }).join("");

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": "XP by category bar chart",
    style: "width:100%;height:auto;display:block;",
  });
  svg.innerHTML = bars;

  svg.querySelectorAll(".cat-bar").forEach(el => {
    el.style.cursor = "default";
    el.addEventListener("mouseenter", e => {
      el.style.opacity = "1";
      el.style.filter  = "brightness(1.2)";
      Tooltip.show(`
        <strong>${el.dataset.cat}</strong>
        <span class="tt-sub">${formatXP(parseInt(el.dataset.xp, 10))} · ${el.dataset.pct}% of total</span>
      `, e);
    });
    el.addEventListener("mousemove", e => Tooltip.move(e));
    el.addEventListener("mouseleave", () => {
      el.style.opacity = "0.88";
      el.style.filter  = "none";
      Tooltip.hide();
    });
  });

  container.innerHTML = "";
  container.appendChild(svg);
}

// ═════════════════════════════════════════════════════════════════
// GRAPH 8 — Attempts per Exercise (Bubble/Column Chart) (NEW)
// ═════════════════════════════════════════════════════════════════

function drawAttemptsChart(containerId, progress) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!progress || progress.length === 0) {
    container.innerHTML = `<p class="graph-empty">No progress data available.</p>`;
    return;
  }

  // Count attempts and pass status per exercise
  const exerciseMap = {};
  for (const p of progress) {
    const name = p.object?.name || "Unknown";
    if (!exerciseMap[name]) exerciseMap[name] = { attempts: 0, passed: false };
    exerciseMap[name].attempts++;
    if (p.grade >= 1) exerciseMap[name].passed = true;
  }

  // Top exercises by attempt count (most retried first)
  const sorted = Object.entries(exerciseMap)
    .sort((a, b) => b[1].attempts - a[1].attempts)
    .slice(0, 14);

  if (sorted.length === 0) {
    container.innerHTML = `<p class="graph-empty">No attempt data found.</p>`;
    return;
  }

  const maxAtt = Math.max(...sorted.map(([, v]) => v.attempts));

  const W  = 800, H = 220;
  const PL = 12, PR = 12, PT = 24, PB = 50;
  const gW = W - PL - PR, gH = H - PT - PB;

  const colW  = gW / sorted.length;
  const colGap = Math.max(4, colW * 0.25);
  const barW_ = colW - colGap;

  const cols = sorted.map(([name, data], i) => {
    const bh  = data.attempts === 0 ? 0 : Math.max(8, (data.attempts / maxAtt) * gH);
    const x   = PL + i * colW + colGap / 2;
    const y   = PT + gH - bh;
    const col = data.passed ? C.pass : C.fail;
    const dn  = name.length > 10 ? name.slice(0, 9) + "…" : name;

    return `
      <rect class="att-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}"
        width="${barW_.toFixed(1)}" height="${bh.toFixed(1)}"
        rx="4" fill="${col}" opacity="0.80"
        data-name="${name}" data-attempts="${data.attempts}"
        data-passed="${data.passed}">
        <animate attributeName="height" from="0" to="${bh.toFixed(1)}"
          dur="${0.4 + i * 0.04}s" begin="${i * 0.03}s"
          calcMode="spline" keySplines="0.25 0.1 0.25 1"
          fill="freeze"/>
        <animate attributeName="y" from="${PT + gH}" to="${y.toFixed(1)}"
          dur="${0.4 + i * 0.04}s" begin="${i * 0.03}s"
          calcMode="spline" keySplines="0.25 0.1 0.25 1"
          fill="freeze"/>
      </rect>
      ${data.attempts > 1 ? `<text x="${(x + barW_ / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}"
        text-anchor="middle" font-size="9.5" fill="${col}"
        font-family="JetBrains Mono,monospace" pointer-events="none"
        opacity="0">
        ${data.attempts}×
        <animate attributeName="opacity" from="0" to="1"
          dur="0.3s" begin="${0.5 + i * 0.035}s" fill="freeze"/>
      </text>` : ""}
      <text x="${(x + barW_ / 2).toFixed(1)}" y="${H - PB + 14}"
        text-anchor="middle" font-size="9"
        fill="${C.text}" font-family="JetBrains Mono,monospace"
        transform="rotate(-35 ${(x + barW_ / 2).toFixed(1)} ${H - PB + 14})"
      >${dn}</text>
    `;
  }).join("");

  // Y axis labels
  const yTicks = [0, 0.5, 1].map(f => ({
    v: Math.round(maxAtt * f),
    y: PT + gH - f * gH,
  }));

  const svg = svgEl("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": "Attempts per exercise column chart",
    style: "width:100%;height:auto;display:block;",
  });

  svg.innerHTML = `
    ${yTicks.map(t => `
      <line x1="${PL}" y1="${t.y.toFixed(1)}" x2="${W - PR}" y2="${t.y.toFixed(1)}"
        stroke="${C.grid}" stroke-width="1" stroke-dasharray="4 6" opacity="0.7"/>
      <text x="${PL - 2}" y="${t.y.toFixed(1)}"
        text-anchor="start" dominant-baseline="middle"
        font-size="9.5" fill="${C.text}"
        font-family="JetBrains Mono,monospace">${t.v}</text>
    `).join("")}

    ${cols}

    <line x1="${PL}" y1="${PT + gH}" x2="${W - PR}" y2="${PT + gH}"
      stroke="${C.textBright}" stroke-width="1" opacity="0.15"/>

    <!-- Legend -->
    <rect x="${W - PR - 110}" y="4" width="10" height="10" rx="2" fill="${C.pass}" opacity="0.8"/>
    <text x="${W - PR - 96}" y="13" font-size="10" fill="${C.text}"
      font-family="JetBrains Mono,monospace">Passed</text>
    <rect x="${W - PR - 45}" y="4" width="10" height="10" rx="2" fill="${C.fail}" opacity="0.8"/>
    <text x="${W - PR - 31}" y="13" font-size="10" fill="${C.text}"
      font-family="JetBrains Mono,monospace">Failed</text>
  `;

  svg.querySelectorAll(".att-bar").forEach(el => {
    el.style.cursor = "default";
    el.addEventListener("mouseenter", e => {
      el.style.opacity = "1";
      el.style.filter  = "brightness(1.2)";
      const passed = el.dataset.passed === "true";
      Tooltip.show(`
        <strong>${el.dataset.name}</strong>
        <span class="tt-sub">${el.dataset.attempts} attempt${el.dataset.attempts > 1 ? "s" : ""}</span>
        <span class="tt-sub" style="color:${passed ? "#34d399" : "#f87171"}">${passed ? "✓ Passed" : "✗ Not yet passed"}</span>
      `, e);
    });
    el.addEventListener("mousemove", e => Tooltip.move(e));
    el.addEventListener("mouseleave", () => {
      el.style.opacity = "0.80";
      el.style.filter  = "none";
      Tooltip.hide();
    });
  });

  container.innerHTML = "";
  container.appendChild(svg);
}