/* ============================================================
   제어·PID, 눈으로 보기 — 공통 헬퍼 (전역 VZ).
   코어 + linePlot + VZ.LA(arrow/tween) + VZ.SIM(실시간 물리 시뮬·PID·플랜트).
   모든 제어·동역학은 페이지에서 실시간 계산. 외부 출처 인용 없음.
   ============================================================ */
(function (global) {
  'use strict';
  const fmt = (n, d = 2) => {
    if (!isFinite(n)) return n > 0 ? '∞' : '−∞';
    const r = Number(n).toFixed(d);
    return Object.is(parseFloat(r), -0) ? (0).toFixed(d) : r;
  };
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const PALETTE = ['#60a5fa', '#fbbf24', '#94a3b8', '#34d399', '#f472b6', '#c084fc', '#fb7185', '#37bdf8'];

  function setupStepper(stepperSel = '#stepper', panelSel = '[data-panel]') {
    const stepper = document.querySelector(stepperSel);
    if (!stepper) return;
    const panels = [...document.querySelectorAll(panelSel)];
    stepper.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      const s = b.dataset.s;
      stepper.querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
      panels.forEach(p => p.classList.toggle('show', p.dataset.panel === s));
      const top = stepper.getBoundingClientRect().top + window.scrollY - 10;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  }
  function mountTopnav(sel, badge) {
    const el = document.querySelector(sel);
    if (!el) return;
    el.innerHTML = `<a class="home" href="index.html">← 목차로</a><span class="chapbadge">${badge}</span>`;
  }
  function barRow(label, frac, { win = false, color = null, pctText = null } = {}) {
    const c = color || (win ? 'var(--hot)' : 'var(--q)');
    return `<div class="barrow ${win ? 'win' : ''}">
      <div class="bw">${label}${win ? ' 🏆' : ''}</div>
      <div class="track"><div class="fill" style="width:${(clamp(frac, 0, 1) * 100).toFixed(1)}%;background:${c}"></div></div>
      <div class="pct">${pctText != null ? pctText : (frac * 100).toFixed(1) + '%'}</div>
    </div>`;
  }
  global.VZ = { fmt, clamp, PALETTE, setupStepper, mountTopnav, barRow };
})(window);

/* ============================================================ 꺾은선 차트 (VZ.linePlot) ============================================================ */
(function (global) {
  'use strict';
  const VZ = global.VZ;
  function linePlot(series, opts = {}) {
    const W = opts.W || 460, H = opts.H || 230, padL = 44, padR = 14, padT = opts.legend === false ? 14 : 30, padB = 34;
    const all = series.filter(s => s.pts && s.pts.length);
    let xmin = opts.xmin, xmax = opts.xmax, ymin = opts.ymin, ymax = opts.ymax;
    if (xmin == null) xmin = Math.min(...all.flatMap(s => s.pts.map(p => p[0])), 0);
    if (xmax == null) xmax = Math.max(...all.flatMap(s => s.pts.map(p => p[0])), 1);
    if (ymin == null) ymin = Math.min(...all.flatMap(s => s.pts.map(p => p[1])), 0);
    if (ymax == null) ymax = Math.max(...all.flatMap(s => s.pts.map(p => p[1])), 1);
    if (ymax === ymin) ymax = ymin + 1; if (xmax === xmin) xmax = xmin + 1;
    const px = x => padL + (x - xmin) / (xmax - xmin) * (W - padL - padR);
    const py = y => H - padB - (y - ymin) / (ymax - ymin) * (H - padT - padB);
    let g = '';
    for (let i = 0; i <= 4; i++) { const yv = ymin + (ymax - ymin) * i / 4, y = py(yv);
      g += `<line class="gridline" x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}"/>`;
      g += `<text class="axislabel" x="${padL - 6}" y="${y + 3}" text-anchor="end">${VZ.fmt(yv, Math.abs(ymax - ymin) >= 10 ? 0 : 1)}</text>`; }
    g += `<line class="axis" x1="${padL}" y1="${py(ymin)}" x2="${W - padR}" y2="${py(ymin)}"/>`;
    g += `<line class="axis" x1="${padL}" y1="${padT}" x2="${padL}" y2="${H - padB}"/>`;
    if (opts.xlab) g += `<text class="axislabel" x="${(padL + W - padR) / 2}" y="${H - padB + 16}" text-anchor="middle">${opts.xlab}</text>`;
    if (opts.hline != null) { const y = py(opts.hline); g += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--good)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
      if (opts.hlabel) g += `<text class="axislabel" x="${W - padR}" y="${y - 4}" text-anchor="end" fill="var(--good)">${opts.hlabel}</text>`; }
    all.forEach(s => {
      if (s.pts.length === 1) { // 단일 점은 path로 안 그려지므로 원으로
        g += `<circle cx="${px(s.pts[0][0]).toFixed(1)}" cy="${py(s.pts[0][1]).toFixed(1)}" r="${(s.width || 4)}" fill="${s.color}" ${s.opacity != null ? `opacity="${s.opacity}"` : ''}/>`; return;
      }
      const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ');
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.width || 2.5}" ${s.opacity != null ? `opacity="${s.opacity}"` : ''} ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round"/>`; });
    if (opts.legend !== false) { let lx = padL;
      all.forEach(s => { if (!s.label) return;
        g += `<line x1="${lx}" y1="10" x2="${lx + 16}" y2="10" stroke="${s.color}" stroke-width="3" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''}/>`;
        g += `<text x="${lx + 20}" y="13" font-size="11" font-family="JetBrains Mono" fill="var(--muted)">${s.label}</text>`;
        lx += 26 + (s.label.length * 7.2); }); }
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.aria || '꺾은선 차트'}" style="max-width:100%;display:block">${g}</svg>`;
  }
  VZ.linePlot = linePlot;
})(window);

/* ============================================================ 2D 화살표/애니메이션 (VZ.LA) ============================================================ */
(function (global) {
  'use strict';
  const VZ = global.VZ;
  let _ah = 0;
  function arrowPx(x1, y1, x2, y2, color, { lw = 2.5 } = {}) {
    const id = 'ah' + (_ah++);
    let s = `<defs><marker id="${id}" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0,0 L9,4.5 L0,9 Z" fill="${color}"/></marker></defs>`;
    s += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${lw}" marker-end="url(#${id})"/>`;
    return s;
  }
  VZ.LA = { arrowPx };
})(window);

/* ============================================================
   제어 시뮬 엔진 (VZ.SIM) — 실시간 물리 루프 + PID + 플랜트
   loop: requestAnimationFrame 루프, onStep(dt) 호출(탭 비활성 dt 점프 방지).
   makePID: 상태 있는 PID, P/I/D 성분을 분리해 반환(시각화용).
   플랜트: firstOrder·secondOrder·pendulum(도립)·cartpole·droneHeight·attitude.
   ============================================================ */
(function (global) {
  'use strict';
  const VZ = global.VZ, clamp = VZ.clamp;

  function loop(onStep, opts = {}) {
    let raf = 0, running = false, last = 0, sp = opts.speed || 1;
    function frame(now) {
      if (!running) return;
      let dt = (now - last) / 1000; last = now;
      if (dt > 0.05) dt = 0.05;       // 탭 복귀 등 큰 점프 차단
      onStep(dt * sp); raf = requestAnimationFrame(frame);
    }
    return {
      start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
      toggle() { running ? this.stop() : this.start(); },
      setSpeed(s) { sp = s; },
      get running() { return running; },
    };
  }

  // PID: g={kp,ki,kd, iMax, outMin, outMax, dMeas(측정값 미분=노이즈 완화)}
  function makePID(g) {
    let I = 0, prevE = null, prevMeas = null;
    return {
      reset() { I = 0; prevE = null; prevMeas = null; },
      get integ() { return I; },
      step(target, meas, dt) {
        const e = target - meas;
        I += e * dt; if (g.iMax != null) I = clamp(I, -g.iMax, g.iMax);
        let d = 0;
        if (g.dMeas) { if (prevMeas != null) d = -(meas - prevMeas) / dt; }
        else { if (prevE != null) d = (e - prevE) / dt; }
        prevE = e; prevMeas = meas;
        const P = g.kp * e, Iout = g.ki * I, D = g.kd * d;
        let u = P + Iout + D;
        let sat = false;
        if (g.outMin != null) { const c = clamp(u, g.outMin, g.outMax); if (c !== u) sat = true; u = c; }
        return { u, P, I: Iout, D, e, integ: I, sat };
      },
    };
  }

  // ---- 플랜트들 (각자 state, reset(), step(u, dt)) ----
  function subStep(dt, n, f) { const h = dt / n; for (let i = 0; i < n; i++) f(h); }

  // 1차계: x' = (K·u − x)/τ  (+외란 d). "값이 명령을 따라감" (크루즈·온도)
  function firstOrder({ tau = 1, K = 1, x0 = 0 } = {}) {
    const s = { x: x0 };
    return { s, reset() { s.x = x0; }, step(u, dt, d = 0) { subStep(dt, 4, h => { s.x += ((K * u - s.x) / tau + d) * h; }); return s.x; } };
  }
  // 2차계(질량-스프링-댐퍼): m x'' = u − c x' − k x (+외란). k=0이면 점질량+감쇠
  function secondOrder({ m = 1, c = 0.5, k = 0, x0 = 0, v0 = 0 } = {}) {
    const s = { x: x0, v: v0 };
    return { s, reset() { s.x = x0; s.v = v0; }, step(u, dt, d = 0) {
      subStep(dt, 4, h => { const a = (u - c * s.v - k * s.x) / m + d; s.v += a * h; s.x += s.v * h; }); return s.x; } };
  }
  // 도립진자: θ(위 기준)'' = (g/L)sinθ − b·θ' + u/(mL²). θ=0 불안정 평형. u=토크
  function pendulum({ g = 9.8, L = 1, m = 1, b = 0.2, th0 = 0.25 } = {}) {
    const s = { th: th0, w: 0 };
    return { s, reset() { s.th = th0; s.w = 0; }, step(u, dt, d = 0) {
      subStep(dt, 6, h => { const a = (g / L) * Math.sin(s.th) - b * s.w + u / (m * L * L) + d; s.w += a * h; s.th += s.w * h; }); return s.th; } };
  }
  // 카트폴: 카트 x, 막대 θ(위 기준). u=카트에 가하는 힘. (Barto 표준형)
  function cartpole({ mc = 1, mp = 0.2, L = 0.7, g = 9.8, x0 = 0, th0 = 0.18 } = {}) {
    const s = { x: x0, v: 0, th: th0, w: 0 };
    return { s, reset() { s.x = x0; s.v = 0; s.th = th0; s.w = 0; }, step(F, dt) {
      subStep(dt, 6, h => {
        const st = Math.sin(s.th), ct = Math.cos(s.th), tot = mc + mp;
        const temp = (F + mp * L * s.w * s.w * st) / tot;
        const thAcc = (g * st - ct * temp) / (L * (4 / 3 - mp * ct * ct / tot));
        const xAcc = temp - mp * L * thAcc * ct / tot;
        s.w += thAcc * h; s.th += s.w * h; s.v += xAcc * h; s.x += s.v * h;
      }); return s; } };
  }
  // 드론 1D 고도: y'' = u/m − g. u=추력. 호버 추력 = m·g
  function droneHeight({ m = 1, g = 9.8, y0 = 0 } = {}) {
    const s = { y: y0, v: 0 };
    return { s, reset() { s.y = y0; s.v = 0; }, step(u, dt, d = 0) {
      subStep(dt, 4, h => { const a = u / m - g + d; s.v += a * h; s.y += s.v * h; }); return s.y; }, hover: m * g };
  }
  // 자세(1축): θ'' = u/I − b·θ'. u=토크
  function attitude({ I = 0.3, b = 0.3, th0 = 0 } = {}) {
    const s = { th: th0, w: 0 };
    return { s, reset() { s.th = th0; s.w = 0; }, step(u, dt, d = 0) {
      subStep(dt, 4, h => { const a = u / I - b * s.w + d; s.w += a * h; s.th += s.w * h; }); return s.th; } };
  }

  // ---- 2D 사이드뷰 보드 + 그리기 ----
  function board(opts = {}) {
    const W = opts.W || 520, H = opts.H || 300, s = opts.s || 60;
    const ox = opts.ox == null ? W / 2 : opts.ox, oy = opts.oy == null ? H * 0.7 : opts.oy;
    return { W, H, s, X: x => ox + x * s, Y: y => oy - y * s, ox, oy };
  }
  function svg(b, inner, aria) { return `<svg width="${b.W}" height="${b.H}" viewBox="0 0 ${b.W} ${b.H}" role="img" aria-label="${aria || '제어 시뮬'}" style="max-width:100%;display:block">${inner}</svg>`; }
  function setLine(b, y, { color = 'var(--good)', label = null, horiz = true } = {}) {
    if (horiz) { let s = `<line x1="0" y1="${b.Y(y).toFixed(1)}" x2="${b.W}" y2="${b.Y(y).toFixed(1)}" stroke="${color}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
      if (label) s += `<text x="6" y="${(b.Y(y) - 5).toFixed(1)}" fill="${color}" font-size="11" font-family="JetBrains Mono">${label}</text>`; return s; }
    let s = `<line x1="${b.X(y).toFixed(1)}" y1="0" x2="${b.X(y).toFixed(1)}" y2="${b.H}" stroke="${color}" stroke-width="1.5" stroke-dasharray="5 4"/>`;
    if (label) s += `<text x="${(b.X(y) + 5).toFixed(1)}" y="14" fill="${color}" font-size="11" font-family="JetBrains Mono">${label}</text>`; return s;
  }
  // 도립진자/막대: pivot(월드[x,y])에서 각 th(위 기준, 시계 반대 +)로 길이 L
  function pole(b, pivot, th, L, { color = 'var(--hot)', bob = true } = {}) {
    const tip = [pivot[0] + L * Math.sin(th), pivot[1] + L * Math.cos(th)];
    let s = `<line x1="${b.X(pivot[0]).toFixed(1)}" y1="${b.Y(pivot[1]).toFixed(1)}" x2="${b.X(tip[0]).toFixed(1)}" y2="${b.Y(tip[1]).toFixed(1)}" stroke="${color}" stroke-width="5" stroke-linecap="round"/>`;
    if (bob) s += `<circle cx="${b.X(tip[0]).toFixed(1)}" cy="${b.Y(tip[1]).toFixed(1)}" r="8" fill="${color}"/>`;
    s += `<circle cx="${b.X(pivot[0]).toFixed(1)}" cy="${b.Y(pivot[1]).toFixed(1)}" r="3.5" fill="var(--ink)"/>`;
    return s;
  }
  function cart(b, x, { w = 0.7, h = 0.32, color = 'var(--slate)' } = {}) {
    const px = b.X(x - w / 2), py = b.Y(0), pw = w * b.s, ph = h * b.s;
    let s = `<rect x="${px.toFixed(1)}" y="${(py - ph).toFixed(1)}" width="${pw.toFixed(1)}" height="${ph.toFixed(1)}" rx="5" fill="var(--panel-2)" stroke="${color}" stroke-width="1.5"/>`;
    s += `<circle cx="${b.X(x - w / 4).toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="none" stroke="${color}" stroke-width="2"/><circle cx="${b.X(x + w / 4).toFixed(1)}" cy="${py.toFixed(1)}" r="6" fill="none" stroke="${color}" stroke-width="2"/>`;
    return s;
  }
  function ground(b, y = 0) { return `<line x1="0" y1="${b.Y(y).toFixed(1)}" x2="${b.W}" y2="${b.Y(y).toFixed(1)}" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/>`; }

  VZ.SIM = { loop, makePID, firstOrder, secondOrder, pendulum, cartpole, droneHeight, attitude, board, svg, setLine, pole, cart, ground };
})(window);

/* ============================================================ 상태추정 엔진 (VZ.EST) ============================================================ */
(function (global) {
  'use strict';
  const VZ = global.VZ;
  // ---- 1D 가우스 ----
  function pdf1(mu, v, x) { return Math.exp(-(x - mu) * (x - mu) / (2 * v)) / Math.sqrt(2 * Math.PI * v); }
  // 역분산 융합: 두 (평균,분산)을 합쳐 더 좁은 가우스 (칼만 보정·두 추정 섞기의 핵심)
  function fuse(ma, va, mb, vb) { const v = 1 / (1 / va + 1 / vb); return { mu: v * (ma / va + mb / vb), v }; }
  // 칼만 1D 예측: 이동(du)만큼 평균 이동 + 프로세스 노이즈(q)만큼 불확실성 증가
  function kPredict(mu, v, du, q) { return { mu: mu + du, v: v + q }; }
  // 칼만 1D 보정: 이노베이션(z-mu)을 이득 K만큼 반영. K=v/(v+r)
  function kUpdate(mu, v, z, r) { const K = v / (v + r); return { mu: mu + K * (z - mu), v: (1 - K) * v, K, innov: z - mu }; }
  // 가우스 곡선 점들 [x,pdf] (xs..xe)
  function bell(mu, v, xs, xe, n) { n = n || 80; const pts = []; for (let i = 0; i <= n; i++) { const x = xs + (xe - xs) * i / n; pts.push([x, pdf1(mu, v, x)]); } return pts; }
  // 신뢰도% : 기준분산 대비 좁을수록 100에 가까움
  function confidence(v, vRef) { return Math.max(0, Math.min(100, Math.round(100 * (1 - Math.sqrt(v) / Math.sqrt(vRef))))); }
  // 2x2 대칭 공분산 cov=[[a,b],[b,c]] → 타원 (k=시그마 배수)
  function ellipse(mx, my, a, b, c, k) {
    k = k == null ? 1 : k;
    const tr = (a + c) / 2, d = Math.sqrt(((a - c) / 2) * ((a - c) / 2) + b * b);
    const l1 = Math.max(1e-9, tr + d), l2 = Math.max(1e-9, tr - d);
    const ang = 0.5 * Math.atan2(2 * b, a - c);
    return { cx: mx, cy: my, rx: k * Math.sqrt(l1), ry: k * Math.sqrt(l2), ang, angDeg: ang * 180 / Math.PI };
  }
  // 보드 좌표에 공분산 타원 그리기 (board의 Y가 뒤집히므로 화면 회전각 = -angDeg)
  function ellipseSVG(bd, mx, my, a, b, c, { k = 1, color = 'var(--q)', fill = 'none', lw = 2 } = {}) {
    const e = ellipse(mx, my, a, b, c, k); const cx = bd.X(mx), cy = bd.Y(my), rx = e.rx * bd.s, ry = e.ry * bd.s;
    return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" transform="rotate(${(-e.angDeg).toFixed(2)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="${fill}" stroke="${color}" stroke-width="${lw}"/>`;
  }
  // 점 구름 그리기 (parts: [{x,y,w}], r 반지름은 가중치 비례 옵션)
  function dots(bd, parts, { color = 'var(--hot)', r = 2.5, wScale = false } = {}) {
    let s = ''; let wmax = 1e-9; if (wScale) for (const p of parts) if (p.w > wmax) wmax = p.w;
    for (const p of parts) { const rr = wScale ? (1 + 3 * (p.w / wmax)) : r; s += `<circle cx="${bd.X(p.x).toFixed(1)}" cy="${bd.Y(p.y).toFixed(1)}" r="${rr.toFixed(1)}" fill="${color}" opacity="${wScale ? (0.3 + 0.6 * (p.w / wmax)).toFixed(2) : 0.8}"/>`; }
    return s;
  }
  // 파티클 가중치 정규화
  function normalize(parts) { let s = 0; for (const p of parts) s += p.w; if (s <= 0) { for (const p of parts) p.w = 1 / parts.length; return; } for (const p of parts) p.w /= s; }
  // 유효 표본수(다양성) — 작으면 재샘플 필요
  function nEff(parts) { let s = 0; for (const p of parts) s += p.w * p.w; return s > 0 ? 1 / s : parts.length; }
  // 저분산(systematic) 재샘플링 — rnd: 0..1 난수 (가중 높은 입자가 복제됨)
  function resample(parts, rnd) {
    const n = parts.length; let sum = 0; for (const p of parts) sum += p.w; const step = sum / n;
    let r = step * (rnd == null ? 0.5 : rnd), c = parts[0].w, i = 0; const out = [];
    for (let m = 0; m < n; m++) { const U = r + m * step; while (U > c && i < n - 1) { i++; c += parts[i].w; } out.push({ x: parts[i].x, y: parts[i].y, th: parts[i].th, w: 1 / n }); }
    return out;
  }
  VZ.EST = { pdf1, fuse, kPredict, kUpdate, bell, confidence, ellipse, ellipseSVG, dots, normalize, nEff, resample };
})(window);

/* ============================================================ 모션 플래닝 엔진 (VZ.PLAN) ============================================================ */
(function (global) {
  'use strict';
  const VZ = global.VZ;
  const key = (x, y) => x + ',' + y;
  // 격자 g={cols,rows,walls:Set("x,y"),cost:Map("x,y"->c)|null,diag:bool}
  function makeGrid(cols, rows, diag) { return { cols, rows, walls: new Set(), cost: new Map(), diag: !!diag }; }
  function blocked(g, x, y) { return x < 0 || y < 0 || x >= g.cols || y >= g.rows || g.walls.has(key(x, y)); }
  function cellCost(g, x, y) { const c = g.cost.get(key(x, y)); return c == null ? 1 : c; }
  function neighbors(g, x, y) {
    const out = []; const d4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const dirs = g.diag ? d4.concat([[1, 1], [1, -1], [-1, 1], [-1, -1]]) : d4;
    for (const [dx, dy] of dirs) { const nx = x + dx, ny = y + dy; if (blocked(g, nx, ny)) continue;
      if (dx && dy && (blocked(g, x + dx, y) || blocked(g, x, y + dy))) continue; // 코너 컷 방지
      out.push([nx, ny, dx && dy ? Math.SQRT2 : 1]); } return out;
  }
  // 통합 격자 탐색: mode 'bfs'|'dijkstra'|'astar'|'greedy', w=weighted A* 가중치
  function search(g, s, t, opts = {}) {
    const mode = opts.mode || 'astar', w = opts.w == null ? 1 : opts.w;
    const hf = (x, y) => g.diag ? Math.hypot(x - t[0], y - t[1]) : Math.abs(x - t[0]) + Math.abs(y - t[1]);
    const gScore = new Map([[key(s[0], s[1]), 0]]); const came = new Map(); const order = [];
    const open = [{ x: s[0], y: s[1] }]; const inClosed = new Set(); let found = false, seq = 0; const fifo = (mode === 'bfs');
    while (open.length) {
      let idx = 0;
      if (fifo) idx = 0; else { // min priority
        let best = Infinity; for (let i = 0; i < open.length; i++) { const o = open[i]; const gc = gScore.get(key(o.x, o.y));
          const p = mode === 'dijkstra' ? gc : mode === 'greedy' ? hf(o.x, o.y) : gc + w * hf(o.x, o.y);
          if (p < best) { best = p; idx = i; } } }
      const cur = open.splice(idx, 1)[0]; const ck = key(cur.x, cur.y);
      if (inClosed.has(ck)) continue; inClosed.add(ck); order.push([cur.x, cur.y]);
      if (cur.x === t[0] && cur.y === t[1]) { found = true; break; }
      for (const [nx, ny, step] of neighbors(g, cur.x, cur.y)) { const nk = key(nx, ny); if (inClosed.has(nk)) continue;
        const ng = gScore.get(ck) + step * cellCost(g, nx, ny);
        if (!gScore.has(nk) || ng < gScore.get(nk)) { gScore.set(nk, ng); came.set(nk, ck); open.push({ x: nx, y: ny }); } }
    }
    // 경로 복원
    let path = []; if (found) { let c = key(t[0], t[1]); while (c) { const [px, py] = c.split(',').map(Number); path.unshift([px, py]); c = came.get(c); } }
    return { path, order, found, cost: found ? gScore.get(key(t[0], t[1])) : Infinity, explored: order.length };
  }
  // C-space 팽창: 벽 둘레 radius(셀) 안을 막음 → 새 walls Set 반환(원본 보존)
  function inflate(g, radius) { const w = new Set(g.walls); const r = Math.ceil(radius);
    for (const cell of g.walls) { const [x, y] = cell.split(',').map(Number);
      for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) if (Math.hypot(dx, dy) <= radius) {
        const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < g.cols && ny < g.rows) w.add(key(nx, ny)); } }
    return w; }
  // 선분-장애물(원) 충돌: obs=[{x,y,r}]. true=충돌
  function segHit(p1, p2, obs) { for (const o of obs) { if (distSeg(o.x, o.y, p1, p2) <= o.r) return true; } return false; }
  function ptHit(p, obs) { for (const o of obs) if (Math.hypot(p[0] - o.x, p[1] - o.y) <= o.r) return true; return false; }
  function distSeg(px, py, a, b) { const vx = b[0] - a[0], vy = b[1] - a[1]; const wx = px - a[0], wy = py - a[1];
    const L2 = vx * vx + vy * vy; let tt = L2 ? (wx * vx + wy * vy) / L2 : 0; tt = Math.max(0, Math.min(1, tt));
    return Math.hypot(px - (a[0] + tt * vx), py - (a[1] + tt * vy)); }
  // 포텐셜 필드: 끌림(목표)+밀어냄(장애물) 합력 (연속 좌표)
  function potential(p, goal, obs, { ka = 1, kr = 80, rng = 2.5 } = {}) {
    let fx = ka * (goal[0] - p[0]), fy = ka * (goal[1] - p[1]); // 끌림(선형)
    for (const o of obs) { const dx = p[0] - o.x, dy = p[1] - o.y; const d = Math.hypot(dx, dy) - o.r; if (d < rng && d > 1e-3) {
      const m = kr * (1 / d - 1 / rng) / (d * d); fx += m * dx / (d + o.r); fy += m * dy / (d + o.r); } }
    return [fx, fy]; }
  // 샘플링 헬퍼 (연속)
  function nearest(nodes, p) { let bi = 0, bd = Infinity; for (let i = 0; i < nodes.length; i++) { const d = Math.hypot(nodes[i].x - p[0], nodes[i].y - p[1]); if (d < bd) { bd = d; bi = i; } } return bi; }
  function steer(from, to, step) { const dx = to[0] - from[0], dy = to[1] - from[1]; const d = Math.hypot(dx, dy); if (d <= step) return [to[0], to[1]]; return [from[0] + dx / d * step, from[1] + dy / d * step]; }
  // shortcut 다듬기: 충돌 없는 두 점은 직선으로 (path: [[x,y]...] 연속좌표, isFree(a,b))
  function shortcut(path, isFree, iters) { let p = path.slice(); iters = iters || 60;
    for (let k = 0; k < iters && p.length > 2; k++) { const i = 1 + Math.floor((p.length - 2) * ((k * 0.6180339887) % 1)); // 결정적 분포
      if (i <= 0 || i >= p.length - 1) continue; if (isFree(p[i - 1], p[i + 1])) p.splice(i, 1); } return p; }
  function pathLen(p) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; }
  // 비용/높이 → 색 (낮음 파랑 → 높음 빨강)
  function heatColor(t) { t = Math.max(0, Math.min(1, t)); const r = Math.round(40 + 215 * t), g = Math.round(90 + 60 * (1 - Math.abs(t - 0.5) * 2)), b = Math.round(230 * (1 - t)); return `rgb(${r},${g},${b})`; }
  VZ.PLAN = { makeGrid, blocked, cellCost, neighbors, search, inflate, segHit, ptHit, distSeg, potential, nearest, steer, shortcut, pathLen, heatColor, key };
})(window);
