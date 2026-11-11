/* TOILET RUSH — 주인공(늘어진 팔다리 카툰) Canvas 렌더링. DOM 없이 ctx만 받는다. */
(function (root) {
  'use strict';

  const INK = '#2b2233';
  const SHIRT = '#F28C28', SHORTS = '#6B4A2E', SHOE = '#D9342B', TEAR = '#9BD9F0';
  const K = 0.5; // 시트 좌표(키 약 250) -> 게임 크기(키 약 125)

  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const lerpColor = (a, b, t) => {
    const x = rgb(a), y = rgb(b);
    return '#' + x.map((v, i) => Math.round(mix(v, y[i], t)).toString(16).padStart(2, '0')).join('').toUpperCase();
  };

  // 게이지(%) -> 피부색. 구간 사이를 연속으로 이어 90%에서 색이 갑자기 튀지 않게 한다.
  function tint(gauge) {
    const g = clamp(gauge, 0, 100);
    if (g < 40) return lerpColor('#F4BE92', '#F2B48A', g / 40);
    if (g < 70) return lerpColor('#F2B48A', '#F09E82', (g - 40) / 30);
    if (g < 90) return lerpColor('#F09E82', '#EE6F5E', (g - 70) / 20);
    return '#EE6F5E';
  }

  // 게이지 -> 모습의 핵심 규칙. tier 0 정상 / 1 불안 / 2 울먹 / 3 폭발 직전.
  // lean(몸이 앞으로 굽는 각도)은 구간마다 끊기지 않고, 게이지가 오를수록 부드럽게 늘어난다.
  function gaugeLook(gauge) {
    const g = clamp(gauge, 0, 100);
    const tier = g >= 90 ? 3 : g >= 70 ? 2 : g >= 40 ? 1 : 0;
    const lean = g < 40 ? mix(4, 8, g / 40)          // 정상: 거의 곧게
      : g < 90 ? mix(8, 26, (g - 40) / 50)            // 불안~울먹: 점점 굽는다
        : mix(26, 14, (g - 90) / 10);                 // 폭발 직전: 몸이 뒤틀리며 오히려 펴진다
    return { tier, lean, skin: tint(g) };
  }

  const shape = (ctx, d, fill, lw = 4) => {
    const p = new Path2D(d);
    if (fill) { ctx.fillStyle = fill; ctx.fill(p); }
    ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(p);
  };
  const line = (ctx, d, lw = 4, color = INK) => {
    ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke(new Path2D(d));
  };
  const limb = (ctx, d, color, w = 8) => {
    const p = new Path2D(d);
    ctx.lineWidth = w + 5; ctx.strokeStyle = INK; ctx.stroke(p);
    ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke(p);
  };
  const dot = (ctx, x, y, r, fill, lw = 3.5) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  };
  const drop = (ctx, x, y, s = 1, rot = 0) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180); ctx.scale(s, s);
    shape(ctx, 'M0,-12 C8,-2 9,6 0,9 C-9,6 -8,-2 0,-12Z', TEAR, 2.5);
    ctx.restore();
  };
  const shoe = (ctx, x, y, r) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(r * Math.PI / 180);
    shape(ctx, 'M-14,-14 q6,-6 14,-2 q26,-6 30,10 q0,6 -6,6 h-38 q-6,-8 0,-20Z', SHOE, 4);
    line(ctx, 'M-12,-2 h40', 3, '#FFFFFF');
    ctx.restore();
  };
  const eye = (ctx, cx, cy, r, pr, px, py, shiny) => {
    dot(ctx, cx, cy, r, '#FFFFFF', 4);
    dot(ctx, cx + px, cy + py, pr, shiny ? '#3B2A1E' : INK, 0);
    if (shiny) {
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(cx + px - pr * .35, cy + py - pr * .4, pr * .38, 0, Math.PI * 2); ctx.fill();
    }
  };

  function drawFace(ctx, tier, skin, time) {
    const nose = () => shape(ctx, 'M24,-186 q26,-4 28,10 q0,12 -22,8', skin, 4);
    if (tier === 0) {
      eye(ctx, -14, -204, 19, 5, 7, 2); eye(ctx, 22, -206, 21, 5, 8, 2);
      shape(ctx, 'M-33,-204 a19,19 0 0 1 38,0Z', skin, 4); shape(ctx, 'M1,-206 a21,21 0 0 1 42,0Z', skin, 4);
      nose();
      line(ctx, 'M-26,-164 Q8,-128 40,-168'); line(ctx, 'M-30,-168 l6,6 M44,-172 l-6,6');
      shape(ctx, 'M-2,-149 v12 h10 v-13 M8,-150 v13 h10 v-15', '#FFFFFF', 3.5);
    } else if (tier === 1) {
      eye(ctx, -16, -204, 20, 3, 6, 4); eye(ctx, 24, -208, 25, 3.5, 8, 4); nose();
      line(ctx, 'M-40,-236 l22,-10 M10,-250 l28,6');
      shape(ctx, 'M-24,-160 q8,-8 16,0 q8,8 16,0 q8,-8 16,0 q6,6 12,2 v14 q-6,4 -12,-2 q-8,-8 -16,0 q-8,8 -16,0 q-8,-8 -16,0Z', '#FFFFFF', 3.5);
      const b = Math.sin(time * 5) * 3;
      drop(ctx, 58, -232 + b, .9, -20); drop(ctx, -58, -226 - b, .8, 20); drop(ctx, 66, -200 + b, .7, -10);
    } else if (tier === 2) {
      eye(ctx, -17, -204, 25, 13, 3, 2, true); eye(ctx, 27, -207, 28, 15, 3, 2, true); nose();
      line(ctx, 'M-44,-232 l24,-14 M12,-252 l32,8');
      ctx.fillStyle = 'rgba(224,88,78,.6)';
      ctx.beginPath(); ctx.ellipse(-30, -170, 9, 5, 0, 0, Math.PI * 2); ctx.ellipse(34, -168, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      line(ctx, 'M-18,-150 q6,-10 12,-2 q6,8 12,0 q6,-8 12,0 q6,8 12,-2'); line(ctx, 'M-4,-140 q8,6 16,0');
      const b = (Math.sin(time * 6) + 1) * 4;
      drop(ctx, -34, -170 + b, 1); drop(ctx, 46, -166 + b, 1.1); drop(ctx, 60, -236, .9, -20);
    } else {
      nose();
      for (const d of ['M-30,-222 l-10,-22', 'M34,-226 l12,-26']) {
        line(ctx, d, 12); line(ctx, d, 8, skin);
      }
      eye(ctx, -44, -256, 24, 3, 4, 3); eye(ctx, 50, -264, 29, 3.5, 5, 3);
      for (const d of ['M-52,-240 Q-100,-300 -120,-190', 'M60,-240 Q112,-300 130,-190']) {
        line(ctx, d, 12); line(ctx, d, 8, TEAR);
      }
      shape(ctx, 'M-30,-176 Q8,-190 42,-178 Q52,-110 8,-100 Q-36,-108 -30,-176Z', '#6E1E2A', 4);
      shape(ctx, 'M-28,-172 Q8,-186 40,-174 l-2,12 Q8,-172 -26,-160Z', '#FFFFFF', 3);
      shape(ctx, 'M-16,-116 q8,-22 26,-16 q18,-4 22,14 q6,16 -4,30 q-10,10 -22,0 q-10,6 -20,-6 q-6,-10 -2,-22Z', '#F07A8A', 3.5);
    }
  }

  const POSES = new Set(['idle', 'run', 'sprint', 'walk', 'jump', 'land', 'hit']);

  function draw(ctx, x, y, scale, gauge, pose, time, options = {}) {
    const look = gaugeLook(gauge);
    const skin = look.skin;
    const running = pose === 'run' || pose === 'sprint' || pose === 'walk';
    const tier = pose === 'hit' ? Math.max(1, look.tier) : look.tier;
    const speed = pose === 'sprint' ? 17 : pose === 'walk' ? 7 : 12;
    const amp = pose === 'sprint' ? 38 : 30;
    const ph = time * speed;
    const bob = running ? Math.abs(Math.sin(ph)) * 5 : Math.sin(time * 2.8) * 2;
    const squash = pose === 'land' ? .88 : 1;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * K * (options.facing || 1), scale * K * squash);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.fillStyle = 'rgba(43,34,51,.22)'; ctx.beginPath(); ctx.ellipse(0, 3, 52, 8, 0, 0, Math.PI * 2); ctx.fill();

    // 다리: 달릴 때 발이 앞뒤로 흔들리고, 점프 땐 접힌다
    const legs = [[-6, 0], [8, Math.PI]].map(([hx, off]) => {
      let fx, fy;
      if (pose === 'jump') { fx = hx < 0 ? -22 : 22; fy = hx < 0 ? -16 : -34; }
      else if (running) { fx = hx + Math.sin(ph + off) * amp; fy = -Math.max(0, Math.cos(ph + off)) * 18; }
      else { fx = hx < 0 ? -14 : 12; fy = 0; }
      const knee = tier >= 2 && !running ? 0 : 14;
      return { hx, fx, fy, d: `M${hx},-56 C${hx + (fx - hx) * .2 + knee},${-56 + (fy + 56) * .35} ${fx - 8},${fy - 22} ${fx},${fy - 8}` };
    });
    ctx.save(); ctx.translate(0, -bob * .4);
    for (const l of legs) limb(ctx, l.d, skin, 8);
    for (const l of legs) shoe(ctx, l.fx - 4, l.fy, running ? -Math.sin(ph + (l.hx < 0 ? 0 : Math.PI)) * 22 : 0);
    ctx.restore();

    // 허리춤 휴지 롤 + 뒤로 날리는 휴지 꼬리(주인공의 상징)
    const w1 = Math.sin(time * 8) * (running ? 9 : 3), w2 = Math.sin(time * 8 + 1) * (running ? 9 : 3);
    const tail = `M-28,${-62 - bob * .4} Q-70,${-70 + w1} -84,${-50 + w2} Q-98,${-36 - w1} -122,${-46 + w2}`;
    line(ctx, tail, 17); line(ctx, tail, 12, '#FFFFFF');

    ctx.save();
    ctx.translate(0, -bob);
    ctx.translate(0, -56); ctx.rotate((pose === 'hit' ? -12 : look.lean) * Math.PI / 180); ctx.translate(0, 56);
    // 몸통
    shape(ctx, 'M-24,-72 l4,22 h40 l4,-22Z', SHORTS, 4);
    shape(ctx, 'M-16,-122 C-30,-100 -30,-80 -24,-70 H24 C30,-80 30,-100 16,-122Z', SHIRT, 4);
    line(ctx, 'M-27,-92 H27 M-26,-82 H26', 4, '#FFF2C9');
    dot(ctx, -26, -58, 13, '#FFFFFF', 3.5); dot(ctx, -26, -58, 5, '#C9A27A', 2.5);
    // 팔
    if (tier === 0 && pose !== 'jump') {
      const sw = running ? Math.sin(ph) * 10 : 0;
      limb(ctx, `M-16,-112 Q-44,${-104 + sw} -40,${-84 + sw} Q-38,-74 -48,${-70 + sw}`, skin, 7);
      limb(ctx, `M16,-112 Q44,${-112 - sw} 48,${-128 - sw} Q50,-138 60,${-138 - sw}`, skin, 7);
      dot(ctx, -50, -68 + sw, 7, skin); dot(ctx, 62, -139 - sw, 7, skin);
    } else if (pose === 'jump') {
      limb(ctx, 'M-16,-112 Q-44,-140 -34,-170', skin, 7); limb(ctx, 'M16,-112 Q46,-140 38,-170', skin, 7);
      dot(ctx, -34, -172, 7, skin); dot(ctx, 38, -172, 7, skin);
    } else {
      limb(ctx, 'M-16,-112 Q-42,-96 -30,-84 Q-20,-78 -4,-82', skin, 7);
      limb(ctx, 'M16,-112 Q42,-96 30,-84 Q20,-78 6,-82', skin, 7);
      dot(ctx, -3, -82, 7, skin); dot(ctx, 7, -82, 7, skin);
    }
    // 목 + 머리 + 머리카락
    shape(ctx, 'M-5,-124 v-14 h10 v14Z', skin, 3.5);
    shape(ctx, 'M-46,-190 q-14,-4 -12,10 q2,10 14,8Z', skin, 4);
    shape(ctx, 'M-40,-150 C-52,-200 -42,-246 2,-248 C44,-248 54,-204 44,-152 C40,-128 -34,-126 -40,-150Z', skin, 4);
    line(ctx, 'M-6,-247 q-10,-22 -22,-20 M2,-248 q2,-26 -6,-34 M10,-247 q14,-18 24,-12');
    drawFace(ctx, tier, skin, time);
    ctx.restore();
    ctx.restore();
  }

  const api = { draw, gaugeLook, tint, POSES };
  root.RushHero = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
