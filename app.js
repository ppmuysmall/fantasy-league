(function () {
  "use strict";

  var DATA = window.LEAGUE_DATA;
  var seasonKeys = Object.keys(DATA.seasons).sort().reverse(); // newest first
  var state = {
    season: DATA.currentSeason || seasonKeys[0],
    manager: null,
    week: null,
  };

  var tooltipEl = document.getElementById("tooltip");

  // ---------------- helpers ----------------
  function fmt1(n) { return (Math.round(n * 10) / 10).toFixed(1); }
  function fmt2(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function pct(n) { return Math.round(n * 1000) / 10 + "%"; }
  function signed(n) {
    if (n > 0) return "+" + n;
    return String(n);
  }
  function record(w, l, t) {
    return t ? (w + "-" + l + "-" + t) : (w + "-" + l);
  }
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === "class") e.className = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (typeof c === "string") e.appendChild(document.createTextNode(c));
      else if (c) e.appendChild(c);
    });
    return e;
  }
  function svg(tag, attrs) {
    var e = document.createElementNS("http://www.w3.org/2000/svg", tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    return e;
  }

  var LUCK_META = {
    "Deserved Win":  { cls: "good",     label: "Deserved Win"  },
    "Lucky Win":     { cls: "warning",  label: "Lucky Win"     },
    "Unlucky Loss":  { cls: "serious",  label: "Unlucky Loss"  },
    "Deserved Loss": { cls: "critical", label: "Deserved Loss" },
    "Tie":           { cls: "neutral",  label: "Tie"           },
  };
  function luckChip(label) {
    var meta = LUCK_META[label] || { cls: "neutral", label: label || "—" };
    var chip = el("span", { class: "chip " + meta.cls });
    chip.appendChild(el("span", { class: "dot" }));
    chip.appendChild(document.createTextNode(meta.label));
    return chip;
  }

  function currentData() { return DATA.seasons[state.season]; }

  function showTooltip(x, y, html) {
    tooltipEl.innerHTML = html;
    tooltipEl.style.left = x + "px";
    tooltipEl.style.top = y + "px";
    tooltipEl.classList.add("show");
  }
  function hideTooltip() { tooltipEl.classList.remove("show"); }

  // ---------------- header / season toggle / tabs ----------------
  function buildSeasonToggle() {
    var wrap = document.getElementById("season-toggle");
    wrap.innerHTML = "";
    seasonKeys.forEach(function (key) {
      var btn = el("button", {}, [key]);
      if (key === state.season) btn.classList.add("active");
      btn.addEventListener("click", function () {
        state.season = key;
        state.manager = null;
        state.week = null;
        buildSeasonToggle();
        renderAll();
      });
      wrap.appendChild(btn);
    });
  }

  function buildTabs() {
    var buttons = document.querySelectorAll("#tabs button");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        buttons.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        document.querySelectorAll(".panel").forEach(function (p) { p.classList.remove("active"); });
        document.getElementById("panel-" + btn.dataset.tab).classList.add("active");
      });
    });
  }

  // ---------------- Standings ----------------
  function renderStandings() {
    var d = currentData();
    var rows = d.standings.slice().sort(function (a, b) { return a.actualRank - b.actualRank; });

    document.getElementById("header-subtitle").textContent =
      d.season + " — " + d.weeksLogged + " week" + (d.weeksLogged === 1 ? "" : "s") + " logged";

    var tbody = document.querySelector("#standings-table tbody");
    tbody.innerHTML = "";
    rows.forEach(function (r) {
      var tr = el("tr");
      tr.appendChild(el("td", { class: "rank" }, [String(r.actualRank)]));
      var teamCell = el("td", { class: "team-cell" });
      teamCell.appendChild(el("span", { class: "team-name" }, [r.team]));
      teamCell.appendChild(el("span", { class: "manager-name" }, [r.manager]));
      tr.appendChild(teamCell);
      tr.appendChild(el("td", {}, [record(r.wins, r.losses, r.ties)]));
      tr.appendChild(el("td", {}, [record(r.medianWins, r.games - r.medianWins, 0)]));
      var luckCls = r.luckRating > 0 ? "pos" : (r.luckRating < 0 ? "neg" : "zero");
      tr.appendChild(el("td", {}, [el("span", { class: "num " + luckCls }, [signed(r.luckRating)])]));
      tr.appendChild(el("td", {}, [r.allPlayWins + " wins (" + pct(r.allPlayWinPct) + ")"]));
      tr.appendChild(el("td", {}, [fmt2(r.pointsFor)]));
      tr.appendChild(el("td", {}, [fmt2(r.pointsAgainst)]));
      tbody.appendChild(tr);
    });

    renderLuckChart(rows);
  }

  function renderLuckChart(rows) {
    var host = document.getElementById("luck-chart");
    host.innerHTML = "";
    var sorted = rows.slice().sort(function (a, b) { return b.luckRating - a.luckRating; });

    var W = 640, rowH = 30, padTop = 10, padBottom = 10, labelW = 170, padRight = 40, valueGutter = 34;
    var H = sorted.length * rowH + padTop + padBottom;
    var maxAbs = Math.max(1, Math.max.apply(null, sorted.map(function (r) { return Math.abs(r.luckRating); })));
    var chartW = W - labelW - padRight;
    var mid = labelW + chartW / 2;
    var halfW = chartW / 2 - valueGutter; // reserve room for the value label at the far end
    var scale = halfW / maxAbs;

    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Luck rating by team" });
    s.appendChild(svg("line", { class: "baseline", x1: mid, x2: mid, y1: padTop, y2: H - padBottom }));

    sorted.forEach(function (r, i) {
      var y = padTop + i * rowH;
      var barW = Math.abs(r.luckRating) * scale;
      var x = r.luckRating >= 0 ? mid : mid - barW;
      var color = r.luckRating > 0 ? "var(--diverge-pos)" : (r.luckRating < 0 ? "var(--diverge-neg)" : "var(--baseline)");

      var label = svg("text", { x: labelW - 10, y: y + rowH / 2 + 4, "text-anchor": "end", class: "tick-label", "font-weight": "600" });
      label.textContent = r.team.length > 20 ? r.team.slice(0, 19) + "…" : r.team;
      s.appendChild(label);

      var rect = svg("rect", {
        x: Math.max(x, mid - chartW / 2), y: y + 5, width: Math.max(barW, 1), height: rowH - 12,
        rx: 4, fill: color,
      });
      s.appendChild(rect);

      var valText = svg("text", {
        x: r.luckRating >= 0 ? mid + barW + 6 : mid - barW - 6,
        y: y + rowH / 2 + 4,
        "text-anchor": r.luckRating >= 0 ? "start" : "end",
        class: "bar-label",
      });
      valText.textContent = signed(r.luckRating);
      s.appendChild(valText);
    });

    host.appendChild(s);
  }

  // ---------------- Team Detail ----------------
  function buildTeamSelect() {
    var d = currentData();
    var sel = document.getElementById("team-select");
    sel.innerHTML = "";
    var sorted = d.standings.slice().sort(function (a, b) { return a.actualRank - b.actualRank; });
    sorted.forEach(function (r) {
      var opt = el("option", { value: r.manager }, [r.team + " (" + r.manager + ")"]);
      sel.appendChild(opt);
    });
    if (!state.manager || !d.standings.some(function (r) { return r.manager === state.manager; })) {
      var mine = d.standings.some(function (r) { return r.manager === "Spencer"; });
      state.manager = mine ? "Spencer" : sorted[0].manager;
    }
    sel.value = state.manager;
    sel.onchange = function () { state.manager = sel.value; renderTeamDetail(); };
  }

  function renderTeamDetail() {
    var d = currentData();
    var teamRows = d.log.filter(function (r) { return r.manager === state.manager; })
      .sort(function (a, b) { return a.week - b.week; });
    var standing = d.standings.filter(function (r) { return r.manager === state.manager; })[0];

    var statsHost = document.getElementById("team-stats");
    statsHost.innerHTML = "";
    var tiles = [
      { label: "Record", value: record(standing.wins, standing.losses, standing.ties) },
      { label: "Median Record", value: record(standing.medianWins, standing.games - standing.medianWins, 0) },
      { label: "Luck Rating", value: signed(standing.luckRating), cls: standing.luckRating > 0 ? "pos" : (standing.luckRating < 0 ? "neg" : "") },
      { label: "All-Play Win %", value: pct(standing.allPlayWinPct) },
    ];
    tiles.forEach(function (t) {
      var tile = el("div", { class: "stat-tile" });
      tile.appendChild(el("div", { class: "label" }, [t.label]));
      tile.appendChild(el("div", { class: "value " + (t.cls || "") }, [t.value]));
      statsHost.appendChild(tile);
    });

    var tbody = document.querySelector("#team-table tbody");
    tbody.innerHTML = "";
    teamRows.forEach(function (r) {
      var tr = el("tr");
      tr.appendChild(el("td", {}, [String(r.week)]));
      tr.appendChild(el("td", {}, [r.oppTeam]));
      tr.appendChild(el("td", {}, [fmt2(r.pf)]));
      tr.appendChild(el("td", {}, [fmt2(r.pa)]));
      tr.appendChild(el("td", {}, [fmt2(r.weekMedian)]));
      tr.appendChild(el("td", {}, [luckChip(r.luck)]));
      tbody.appendChild(tr);
    });

    renderTeamChart(teamRows);
  }

  function renderTeamChart(rows) {
    var host = document.getElementById("team-chart");
    host.innerHTML = "";
    if (!rows.length) { host.appendChild(el("p", { class: "panel-intro" }, ["No games logged yet."])); return; }

    var W = 640, H = 260, padL = 40, padR = 16, padT = 16, padB = 28;
    var plotW = W - padL - padR, plotH = H - padT - padB;

    var allVals = [];
    rows.forEach(function (r) { allVals.push(r.pf, r.weekMedian); });
    var minV = Math.min.apply(null, allVals), maxV = Math.max.apply(null, allVals);
    var pad = (maxV - minV) * 0.15 || 10;
    minV -= pad; maxV += pad;

    function xOf(i) { return rows.length > 1 ? padL + (i / (rows.length - 1)) * plotW : padL + plotW / 2; }
    function yOf(v) { return padT + plotH - ((v - minV) / (maxV - minV)) * plotH; }

    var s = svg("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Score versus median by week" });

    // gridlines (4)
    for (var g = 0; g <= 3; g++) {
      var gv = minV + (g / 3) * (maxV - minV);
      var gy = yOf(gv);
      s.appendChild(svg("line", { class: "gridline", x1: padL, x2: W - padR, y1: gy, y2: gy }));
      var gt = svg("text", { x: padL - 8, y: gy + 3, "text-anchor": "end", class: "tick-label" });
      gt.textContent = Math.round(gv);
      s.appendChild(gt);
    }
    // x labels (week numbers)
    rows.forEach(function (r, i) {
      if (rows.length > 14 && i % 2 === 1) return;
      var t = svg("text", { x: xOf(i), y: H - 8, "text-anchor": "middle", class: "tick-label" });
      t.textContent = "W" + r.week;
      s.appendChild(t);
    });

    function pathFor(key) {
      return rows.map(function (r, i) { return (i === 0 ? "M" : "L") + xOf(i) + "," + yOf(r[key]); }).join(" ");
    }

    s.appendChild(svg("path", { d: pathFor("weekMedian"), fill: "none", stroke: "var(--text-muted)", "stroke-width": 2, "stroke-dasharray": "5,4", opacity: 0.7 }));
    s.appendChild(svg("path", { d: pathFor("pf"), fill: "none", stroke: "var(--series-1)", "stroke-width": 2.5 }));

    if (rows.length === 1) {
      s.appendChild(svg("circle", { cx: xOf(0), cy: yOf(rows[0].weekMedian), r: 4, fill: "var(--surface)", stroke: "var(--text-muted)", "stroke-width": 2 }));
    }

    rows.forEach(function (r, i) {
      var cx = xOf(i), cy = yOf(r.pf);
      var dot = svg("circle", { class: "hover-dot", cx: cx, cy: cy, r: 4, stroke: "var(--series-1)" });
      s.appendChild(dot);
      var hit = svg("circle", { cx: cx, cy: cy, r: 10, fill: "transparent", style: "cursor:pointer" });
      hit.addEventListener("mousemove", function (evt) {
        var rect = s.getBoundingClientRect();
        var scaleX = rect.width / W;
        showTooltip(rect.left + window.scrollX + cx * scaleX, rect.top + window.scrollY + cy * scaleX,
          "<strong>Week " + r.week + "</strong> vs " + r.oppTeam + "<br>" +
          fmt2(r.pf) + " pts (median " + fmt2(r.weekMedian) + ")<br>" + (LUCK_META[r.luck] || {}).label);
      });
      hit.addEventListener("mouseleave", hideTooltip);
      s.appendChild(hit);
    });

    host.appendChild(s);
  }

  // ---------------- Weekly Recap ----------------
  function buildWeekPicker() {
    var d = currentData();
    if (!state.week || state.week > d.weeksLogged) state.week = d.weeksLogged;
    var picker = document.getElementById("week-picker");
    picker.innerHTML = "";
    for (var w = 1; w <= d.weeksLogged; w++) {
      (function (w) {
        var btn = el("button", {}, ["Week " + w]);
        if (w === state.week) btn.classList.add("active");
        btn.addEventListener("click", function () {
          state.week = w;
          buildWeekPicker();
          renderWeekly();
        });
        picker.appendChild(btn);
      })(w);
    }
  }

  function renderWeekly() {
    var d = currentData();
    var weekRows = d.log.filter(function (r) { return r.week === state.week; });
    var weekStat = d.weekStats.filter(function (r) { return r.week === state.week; })[0];
    var grid = document.getElementById("matchup-grid");
    grid.innerHTML = "";

    var seen = {};
    weekRows.forEach(function (r) {
      var key = [r.manager, r.oppManager].sort().join("|");
      if (seen[key]) return;
      seen[key] = true;
      var opp = weekRows.filter(function (x) { return x.manager === r.oppManager; })[0];

      var box = el("div", { class: "matchup" });
      [r, opp].forEach(function (side) {
        var other = side === r ? opp : r;
        var row = el("div", { class: "side" });
        var nameCls = side.pf > other.pf ? "name winner" : "name loser";
        row.appendChild(el("span", { class: nameCls }, [side.team]));
        var right = el("span", {});
        right.appendChild(el("span", { class: "score" }, [fmt2(side.pf)]));
        row.appendChild(right);
        box.appendChild(row);
        box.appendChild(luckChip(side.luck));
      });
      var medLine = el("div", { class: "median-line" });
      medLine.appendChild(document.createTextNode("League median this week: " + (weekStat ? fmt2(weekStat.median) : "—")));
      box.appendChild(medLine);
      grid.appendChild(box);
    });
  }

  // ---------------- wire it up ----------------
  function renderAll() {
    buildSeasonToggle();
    renderStandings();
    buildTeamSelect();
    renderTeamDetail();
    buildWeekPicker();
    renderWeekly();
  }

  buildTabs();
  renderAll();
})();
