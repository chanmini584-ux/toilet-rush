(function (root) {
  'use strict';

  const C = {
    ink: '#283c41', cream: '#fff7e6', paper: '#f6eedc', mint: '#c8e5d5',
    green: '#597b59', sage: '#91b79a', coral: '#e97e60', rust: '#b85e48',
    navy: '#3c5365', yellow: '#edc777', skin: '#ffd3ae', hair: '#344249',
    road: '#c6d0c8', blue: '#74bfd0', white: '#fffdf6'
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const hash = n => {
    if (typeof n !== 'number') n = Array.from(String(n)).reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 104729, 7);
    const t = Math.sin(n * 127.1 + 311.7) * 43758.5453; return t - Math.floor(t);
  };
  const faceColor = amount => {
    const t = clamp((amount - 64) / 36, 0, 1);
    return `rgb(${Math.round(mix(255, 244, t))},${Math.round(mix(211, 132, t))},${Math.round(mix(174, 118, t))})`;
  };
  function rounded(ctx, x, y, w, h, r = 8) {
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  }
  function box(ctx, x, y, w, h, fill, r = 6, line = C.ink, lw = 2) {
    rounded(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
    if (line && lw) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function ellipse(ctx, x, y, rx, ry, fill, line, lw = 2) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(.01, rx), Math.max(.01, ry), 0, 0, Math.PI * 2);
    ctx.fillStyle = fill; ctx.fill();
    if (line) { ctx.strokeStyle = line; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function path(ctx, points, color, lw = 2, fill) {
    ctx.beginPath(); ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    if (fill) { ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    if (color) { ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); }
  }
  function text(ctx, value, x, y, size = 15, color = C.ink, align = 'center', weight = 700) {
    ctx.fillStyle = color; ctx.font = `${weight} ${size}px "Trebuchet MS", "Malgun Gothic", sans-serif`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y);
  }

  class RushRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.time = 0;
      this.previousGauge = 25;
      this.width = 1280; this.height = 720;
      canvas.width = this.width; canvas.height = this.height;
    }

    render(engine, dt = 1 / 60) {
      const ctx = this.ctx;
      const state = engine.state || 'MENU';
      if (state !== 'PAUSED') this.time += Math.min(dt || 0, .1);
      const gauge = Number.isFinite(engine.displayGauge) ? engine.displayGauge : (engine.gauge || 25);
      this.previousGauge += (gauge - this.previousGauge) * Math.min(1, Math.max(dt, 1 / 60) * 12);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.width, this.height);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (state === 'MENU') { this.drawMenu(engine); return; }
      this.drawWorld(engine);
      if (state === 'SURVEY' || (state === 'PAUSED' && (engine.previousState === 'SURVEY' || engine.resumeState === 'SURVEY'))) this.drawSurvey();
      if (state === 'TOILET_EVENT') this.drawToiletScene(engine);
      if (state === 'GAME_OVER_CUTSCENE') this.drawFailureCutscene(engine);
      if (state === 'GAME_OVER') this.drawFailure();
      if (state === 'VICTORY_CUTSCENE') this.drawVictoryCutscene(engine);
      if (state === 'VICTORY') this.drawVictory();
      if (state === 'PLAYING' && engine.gauge >= 90) {
        const glow = ctx.createRadialGradient(640, 360, 230, 640, 360, 760);
        glow.addColorStop(0, '#e97e6000'); glow.addColorStop(1, `rgba(209,80,58,${.14 + Math.sin(this.time * 7) * .04})`);
        ctx.fillStyle = glow; ctx.fillRect(0, 0, 1280, 720);
      }
      this.grain();
    }

    sky(camera, stage) {
      const ctx = this.ctx;
      const colors = stage === 3 ? ['#e8e2ce', '#f9ecd5'] : stage === 2 ? ['#cee4d9', '#f5f0d9'] : ['#d4e9de', '#f5f0de'];
      const gradient = ctx.createLinearGradient(0, 0, 0, 600);
      gradient.addColorStop(0, colors[0]); gradient.addColorStop(1, colors[1]);
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1280, 720);
      ellipse(ctx, 1090 - camera * .012 % 200, 147, 46, 46, '#fff7d3');
      ellipse(ctx, 1090 - camera * .012 % 200, 147, 58, 58, '#fff7d333');
      for (let i = -1; i < 6; i++) {
        const x = i * 325 - (camera * .05 % 325), y = 100 + hash(i + 20) * 160;
        this.cloud(x, y, .7 + hash(i + 8) * .5);
      }
      ctx.fillStyle = '#b5cebd'; ctx.beginPath(); ctx.moveTo(0, 470);
      for (let x = 0; x <= 1300; x += 25) ctx.lineTo(x, 418 + Math.sin((x + camera * .1) / 155) * 19 + Math.sin(x / 87) * 7);
      ctx.lineTo(1280, 580); ctx.lineTo(0, 580); ctx.fill();
      this.distantBuildings(camera, stage);
    }

    cloud(x, y, scale) {
      const ctx = this.ctx; ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      ctx.fillStyle = '#fffdf4bb'; ctx.beginPath();
      ctx.moveTo(-51, 13); ctx.bezierCurveTo(-69, 7, -61, -15, -40, -12);
      ctx.bezierCurveTo(-37, -42, 3, -47, 14, -20); ctx.bezierCurveTo(40, -31, 60, -6, 48, 9);
      ctx.bezierCurveTo(44, 22, -28, 22, -51, 13); ctx.fill(); ctx.restore();
    }

    distantBuildings(camera, stage) {
      const ctx = this.ctx, offset = camera * .24, start = Math.floor(offset / 160) - 1;
      for (let i = start; i < start + 12; i++) {
        const x = i * 160 - offset, h = 85 + hash(i + 38) * 145, y = 504 - h;
        box(ctx, x, y, 140, h, ['#a5c2b1', '#b7cbb7', '#c6d0b9'][Math.abs(i) % 3], 3, null);
        box(ctx, x + 9, y - 9, 122, 10, '#b0c1ac', 1, null);
        for (let row = 0; row < h / 36 - 1; row++) for (let col = 0; col < 4; col++) {
          box(ctx, x + 15 + col * 30, y + 18 + row * 35, 14, 19, '#e4e6cf88', 2, null);
        }
        if (stage === 2 && i % 3 === 0) {
          path(ctx, [[x + 70, y], [x + 70, y - 55], [x + 115, y - 55]], '#9ab39e', 4);
          path(ctx, [[x + 69, y - 53], [x + 105, y]], '#9ab39e', 2);
        }
      }
    }

    building(x, y, variant, stage) {
      const ctx = this.ctx, seed = hash(variant * 3), w = 255 + seed * 60, h = 175 + hash(variant + 5) * 88;
      const wall = stage === 3 ? ['#ecd6bc', '#e8c8b5', '#d6d9ba'][Math.abs(variant) % 3] : ['#ead9bd', '#d7deca', '#e8cbb6', '#d0d8c8'][Math.abs(variant) % 4];
      ctx.save(); ctx.translate(x, y); ctx.globalAlpha = .96;
      ellipse(ctx, w / 2, 0, w * .62, 9, '#61746318');
      box(ctx, 0, -h, w, h, wall, 5, '#7d8b77', 2);
      if (stage === 3) {
        path(ctx, [[-18, -h], [w / 2, -h - 80], [w + 18, -h], [-18, -h]], '#7d806d', 3, variant % 2 ? '#b9846d' : '#8c9e87');
        path(ctx, [[w / 2, -h - 67], [w - 5, -h + 1]], '#f9e8cd66', 3);
        box(ctx, w - 56, -h - 66, 24, 44, '#c6a68a', 2, '#7d806d', 2);
      } else {
        box(ctx, -9, -h - 12, w + 18, 16, '#b3b99f', 3, '#7d8b77', 2);
        path(ctx, [[12, -h - 12], [12, -h - 39], [85, -h - 39], [85, -h - 12]], '#84907d', 2, '#c0c8b3');
      }
      for (let i = 0; i < 3; i++) {
        const wx = 24 + i * (w - 58) / 3;
        box(ctx, wx, -h + 30, 46, 52, '#9fbeb4', 5, '#7b8a7b', 2);
        box(ctx, wx + 5, -h + 35, 36, 41, '#c8ded1', 2, null);
        path(ctx, [[wx + 23, -h + 34], [wx + 23, -h + 77]], '#8ca696', 2);
        path(ctx, [[wx + 4, -h + 57], [wx + 41, -h + 57]], '#8ca696', 2);
        path(ctx, [[wx + 8, -h + 45], [wx + 16, -h + 38]], '#fff7e077', 4);
      }
      if (stage === 3) {
        box(ctx, w * .56, -84, 48, 84, '#b08b70', 5, '#7b806a', 2);
        box(ctx, w * .56 + 9, -76, 30, 30, '#c4d1b7', 3, '#8e977d', 1.5);
        ellipse(ctx, w * .56 + 38, -39, 3, 3, '#f0d39b');
        this.flowerpot(31, -3, .9); this.flowerpot(w - 28, -3, .7);
        box(ctx, 14, -104, 79, 63, '#b3cdbb', 5, '#7b806a', 2);
        path(ctx, [[53, -104], [53, -41]], '#899b83', 3);
        path(ctx, [[14, -72], [93, -72]], '#899b83', 3);
      } else {
        const shop = ['동네 빵집', '초록 상점', 'COFFEE', '좋은 하루'][Math.abs(variant) % 4];
        box(ctx, 14, -125, w - 28, 35, variant % 2 ? '#7d9b80' : '#ce9173', 5, '#7b8a77', 2);
        text(ctx, shop, w / 2, -107, 16, C.cream);
        box(ctx, 25, -86, w - 50, 83, '#a5c7bb', 4, '#7b8a77', 2);
        const doorX = w * .61;
        box(ctx, doorX, -86, 48, 83, '#8caaa1', 3, '#7b8a77', 2);
        path(ctx, [[doorX + 6, -78], [doorX + 6, -18]], '#d9e7d9', 2);
        ellipse(ctx, doorX + 38, -42, 2.5, 2.5, '#f5ddae');
        for (let awning = 0; awning < 9; awning++) {
          const aw = (w - 20) / 9;
          box(ctx, 10 + awning * aw, -91, aw, 15, awning % 2 ? '#f7e8c9' : '#bd846a', 3, '#7b8a7766', .7);
        }
        path(ctx, [[36, -60], [62, -80]], '#ffffff55', 5);
        this.flowerpot(13, 0, .7);
      }
      for (let i = 0; i < 8; i++) {
        const bx = hash(i + variant * 10) * w, by = -h + 110 + hash(i * 4 + variant) * (h - 120);
        path(ctx, [[bx, by], [bx + 13, by]], '#6d826012', 2);
      }
      ctx.restore();
    }

    tree(x, y, scale = 1, variant = 0) {
      const ctx = this.ctx; ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      ellipse(ctx, 4, 1, 44, 7, '#5c745b18');
      box(ctx, -7, -118, 14, 118, '#a69170', 3, '#718268', 2);
      path(ctx, [[0, -61], [-18, -93]], '#9a8568', 6);
      path(ctx, [[2, -83], [21, -111]], '#9a8568', 5);
      const leaves = variant % 2 ? '#91b08c' : '#abc198';
      ellipse(ctx, -26, -119, 34, 42, leaves, '#7d9c7c', 1.5);
      ellipse(ctx, 24, -122, 39, 43, leaves, '#7d9c7c', 1.5);
      ellipse(ctx, -2, -151, 39, 43, leaves, '#7d9c7c', 1.5);
      ellipse(ctx, -17, -164, 17, 12, '#c5d8ad66');
      path(ctx, [[-34, -117], [-25, -120]], '#d5e2bd', 3);
      path(ctx, [[22, -146], [31, -139]], '#d5e2bd', 3);
      ctx.restore();
    }

    flowerpot(x, y, scale) {
      const ctx = this.ctx; ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      path(ctx, [[-15, -24], [15, -24], [10, 0], [-10, 0]], '#967a61', 1.5, '#ca9c79');
      box(ctx, -18, -28, 36, 7, '#dab18e', 2, '#967a61', 1.5);
      path(ctx, [[0, -26], [-6, -54], [5, -63]], '#6d946a', 3);
      ellipse(ctx, -10, -46, 9, 5, '#88aa75'); ellipse(ctx, 7, -39, 9, 5, '#769c6e');
      for (let i = 0; i < 5; i++) ellipse(ctx, 3 + Math.cos(i * 1.26) * 7, -61 + Math.sin(i * 1.26) * 7, 4.5, 4.5, '#e6a284');
      ellipse(ctx, 3, -61, 3, 3, '#f3d491'); ctx.restore();
    }

    lamp(x, ground) {
      const ctx = this.ctx;
      path(ctx, [[x, ground], [x, ground - 194], [x + 8, ground - 205], [x + 31, ground - 205]], '#7c8b79', 5);
      box(ctx, x - 9, ground - 12, 18, 12, '#8e9a86', 3, '#7c8b79', 1.5);
      path(ctx, [[x + 18, ground - 205], [x + 44, ground - 205], [x + 40, ground - 184], [x + 23, ground - 184]], '#7c8b79', 2, '#f3dfaa');
      ellipse(ctx, x + 32, ground - 195, 24, 27, '#ffe7aa12');
    }

    ground(camera) {
      const ctx = this.ctx;
      ctx.fillStyle = '#dce0c7'; ctx.fillRect(0, 550, 1280, 26);
      ctx.fillStyle = '#f1e6cb'; ctx.fillRect(0, 576, 1280, 42);
      path(ctx, [[0, 576], [1280, 576]], '#7f8b77', 3);
      path(ctx, [[0, 612], [1280, 612]], '#a8ad96', 2);
      ctx.fillStyle = '#bbc8bf'; ctx.fillRect(0, 619, 1280, 101);
      path(ctx, [[0, 627], [1280, 627]], '#d3d9cb', 6);
      const offset = camera % 62;
      for (let x = -62; x < 1342; x += 62) {
        path(ctx, [[x - offset, 578], [x - offset + 7, 610]], '#c5bda6', 1);
        if ((Math.round(x / 62) & 1) === 0) path(ctx, [[x - offset, 596], [x - offset + 62, 596]], '#d4c9ae', 1);
      }
      const roadOffset = camera % 230;
      for (let x = -230; x < 1510; x += 230) box(ctx, x - roadOffset, 679, 100, 5, '#e6e8d4', 2, null);
      for (let i = 0; i < 40; i++) {
        const x = (hash(i + 41) * 1650 - camera * .13) % 1350, y = 635 + hash(i + 83) * 83;
        ellipse(ctx, x, y, 1, .7, '#687f7320');
      }
    }

    drawWorld(engine) {
      const ctx = this.ctx, cam = engine.cameraX || 0, p = engine.player || {x: 200, y: 576};
      const stage = engine.stage || (p.x > 28000 ? 3 : p.x > 14000 ? 2 : 1);
      this.sky(cam, stage);
      const near = cam * .75, first = Math.floor(near / 430) - 1;
      for (let i = first; i < first + 6; i++) {
        const x = i * 430 - near;
        this.building(x + 13, 549, i, stage);
        this.tree(x + 355, 559, .75 + hash(i + 7) * .2, i);
      }
      const lampStart = Math.floor(cam / 710) - 1;
      for (let i = lampStart; i < lampStart + 4; i++) this.lamp(i * 710 + 430 - cam, 570);
      this.ground(cam);
      const level = engine.level || {};
      for (const toilet of level.toilets || []) {
        const x = toilet.x - cam;
        if (x > -260 && x < 1500) this.toilet(x, 576, .85, toilet.used, 0);
      }
      const surveyX = (level.surveyX || 18000) - cam;
      if (surveyX > -100 && surveyX < 1380) {
        this.drawCharacter(ctx, surveyX + 20, 576, 1.15, 0, 'survey-npc', this.time, {npc: true, hair: '#765f4d', shirt: '#7d9f83'});
        if (!engine.surveyCompleted && engine.state === 'PLAYING') this.bubble(surveyX + 20, 463, '잠깐만요! 설문조사요!', 13);
      }
      const homeX = (level.homeX || level.length || 42000) - cam;
      if (homeX > -400 && homeX < 1650) this.home(homeX + 65, 576, .95, false);
      const objects = level.obstacles || [];
      for (const ob of objects) {
        const x = ob.x - cam;
        if (x + (ob.w || 80) < -100 || x > 1420) continue;
        this.obstacle(ob, x, level.groundY || 576);
      }
      if (!['TOILET_EVENT', 'VICTORY_CUTSCENE', 'VICTORY', 'GAME_OVER'].includes(engine.state)) {
        let pose = !p.grounded ? 'jump' : Math.abs(p.vx || 0) > 15 ? ((Math.abs(p.vx) > 240) ? 'sprint' : 'run') : 'idle';
        if (p.landTimer > 0) pose = 'land';
        if ((p.invincible || 0) > 1.15) pose = 'hit';
        if (engine.state === 'GAME_OVER_CUTSCENE') pose = engine.stateTime > .55 ? 'kneel' : 'panic';
        ctx.save();
        if (p.invincible > 0 && Math.floor(this.time * 15) % 2) ctx.globalAlpha = .57;
        this.drawCharacter(ctx, p.x - cam, p.y, 1.12, this.previousGauge, pose, this.time, {facing: p.facing || 1, speed: Math.abs(p.vx || 0), failTime: engine.stateTime || 0});
        ctx.restore();
        if (p.grounded && Math.abs(p.vx || 0) > 50) this.dust(p.x - cam, p.y, p.facing || 1, Math.abs(p.vx || 0) > 240);
        if (p.invincible > 1.2) this.stars(p.x - cam, p.y - 93);
      }
      for (const effect of engine.effects || []) {
        if (effect.type === 'hit') this.stars((effect.x || p.x) - cam, (effect.y || p.y) - 70);
      }
      if (engine.state === 'PLAYING') {
        const nearToilet = (level.toilets || []).find(t => !t.used && Math.abs(t.x - p.x) < 125);
        if (nearToilet) this.bubble(nearToilet.x - cam, 360, 'E · 잠깐 쉬어가기  −35%', 15);
        if (p.x < 1050) {
          this.roadSign(610 - cam, 550, '집까지 420m', '→');
          if (p.x < 650) this.bubble(Math.max(330, 400 - cam), 410, '방향키로 이동 · SPACE로 점프!', 15);
        }
      }
    }

    obstacle(ob, x, y) {
      const ctx = this.ctx, w = ob.w || 60, h = ob.h || 48;
      if (ob.type === 'pit') {
        ctx.fillStyle = '#3d524d'; ctx.fillRect(x, y - 1, w, 41);
        ctx.fillStyle = '#273c38'; ctx.fillRect(x + 7, y + 8, Math.max(1, w - 14), 29);
        path(ctx, [[x, y], [x + 11, y + 10], [x + 6, y + 25], [x + 20, y + 40]], '#859282', 4);
        path(ctx, [[x + w, y], [x + w - 11, y + 10], [x + w - 8, y + 25], [x + w - 18, y + 40]], '#859282', 4);
        box(ctx, x - 10, y - 8, 17, 10, C.coral, 2, C.ink, 1.5);
        box(ctx, x + w - 7, y - 8, 17, 10, C.coral, 2, C.ink, 1.5);
        for (let i = 0; i < 3; i++) ellipse(ctx, x + w * (.3 + i * .2), y + 20 + i * 2, 3, 1.5, '#9baf8b40');
      } else if (ob.type === 'puddle') {
        ellipse(ctx, x + w / 2, y - 2, w / 2, 8, '#8bc2bd', '#609e9a', 1.5);
        path(ctx, [[x + w * .22, y - 4], [x + w * .49, y - 4]], '#d9f2df', 2);
        ellipse(ctx, x + w * .72, y - 1, 9 + Math.sin(this.time * 2) * 2, 2, '#b7e4ce', null);
        if (w > 160) { this.cone(x - 25, y, .55); this.cone(x + w + 25, y, .55); }
      } else if (ob.type === 'pedestrian') {
        const palette = ['#8e9bb5', '#bba16d', '#83a599', '#bd8d91'];
        this.drawCharacter(ctx, x + w / 2, y, .98, 0, 'walk', this.time + hash(ob.id || x) * 5, {npc: true, shirt: palette[Math.floor(hash(ob.id || x) * 4)], facing: (ob.vx || Math.sin(this.time)) < 0 ? -1 : 1, hair: '#7c6551'});
        path(ctx, [[x - 15, y + 12], [x + w + 15, y + 12]], '#8d9c79', 1.5);
        path(ctx, [[x - 10, y + 8], [x - 15, y + 12], [x - 10, y + 16]], '#8d9c79', 1.5);
        path(ctx, [[x + w + 10, y + 8], [x + w + 15, y + 12], [x + w + 10, y + 16]], '#8d9c79', 1.5);
      } else {
        ellipse(ctx, x + w / 2, y + 2, w * .64, 5, '#52695224');
        if ((Number(ob.id) || Math.floor(x)) % 3 === 0) {
          box(ctx, x, y - h, w, h, '#c7a073', 4, '#796b54', 2.2);
          box(ctx, x + 5, y - h + 5, Math.max(4, w - 10), h - 10, '#d7b388', 1, '#a38663', 1);
          path(ctx, [[x + 7, y - h + 7], [x + w - 7, y - 7]], '#9e805c', 3);
          path(ctx, [[x + w - 7, y - h + 7], [x + 7, y - 7]], '#9e805c', 3);
        } else {
          box(ctx, x + 5, y - h + 10, 7, h - 10, '#718579', 2, C.ink, 1.5);
          box(ctx, x + w - 12, y - h + 10, 7, h - 10, '#718579', 2, C.ink, 1.5);
          box(ctx, x, y - h, w, Math.min(h - 4, 27), '#f0c16c', 4, C.ink, 2);
          ctx.save(); rounded(ctx, x + 1, y - h + 1, w - 2, Math.min(h - 6, 25), 3); ctx.clip();
          for (let stripe = -20; stripe < w + 30; stripe += 24) path(ctx, [[x + stripe, y - h - 5], [x + stripe + 14, y - h - 5], [x + stripe - 3, y - h + 31], [x + stripe - 17, y - h + 31]], null, 0, '#3f5150');
          ctx.restore();
          ellipse(ctx, x + w / 2, y - h - 5, 4, 4, '#e68b5d', C.ink, 1.5);
        }
      }
    }

    cone(x, y, scale = 1) {
      const ctx = this.ctx; ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      box(ctx, -20, -6, 40, 8, '#7d7864', 3, C.ink, 2);
      path(ctx, [[-13, -7], [-4, -47], [4, -47], [13, -7]], C.ink, 2, '#e59a6b');
      path(ctx, [[-9, -24], [9, -24]], '#fff3d5', 8); ctx.restore();
    }

    toilet(x, y, scale, used = false, doorOpen = 0) {
      const ctx = this.ctx; ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      ellipse(ctx, 0, 2, 91, 9, '#59795f22');
      box(ctx, -77, -182, 154, 182, used ? '#b6c2ad' : '#b8d8c1', 10, '#536f61', 3);
      box(ctx, -86, -193, 172, 19, '#678c77', 5, '#536f61', 2.5);
      box(ctx, -60, -164, 120, 33, '#f7f0d6', 5, '#74907c', 2);
      text(ctx, 'WC', 0, -147, 23, '#537661');
      box(ctx, -36, -113, 72, 113, '#3f6158', 5, '#536f61', 2);
      if (doorOpen < .95) {
        const dw = Math.max(5, 68 * (1 - doorOpen));
        box(ctx, -34, -111, dw, 110, used ? '#a0b59d' : '#83b89e', 3, '#536f61', 2);
        if (dw > 28) { ellipse(ctx, -34 + dw - 12, -52, 3, 3, '#efe6bd'); text(ctx, used ? '✓' : '•', -34 + dw / 2, -88, 18, used ? '#e9efd9' : '#e8cd89'); }
      }
      for (let i = 0; i < 3; i++) box(ctx, 46, -116 + i * 13, 16, 4, '#82a48b', 1, null);
      this.flowerpot(-62, -2, .55); this.flowerpot(63, -2, .55);
      box(ctx, -54, -211, 108, 21, used ? '#9baf91' : '#e6c47e', 5, '#536f61', 1.5);
      text(ctx, used ? '이용 완료' : '잠깐의 행복', 0, -200, 10, '#405f50');
      ctx.restore();
    }

    home(x, y, scale = 1, open = false) {
      const ctx = this.ctx; ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      ellipse(ctx, 0, 4, 190, 15, '#65755b20');
      box(ctx, -143, -220, 286, 220, '#f4dfbf', 8, '#697c66', 3);
      path(ctx, [[-165, -220], [0, -326], [165, -220]], '#697c66', 3, '#d28e72');
      path(ctx, [[-145, -222], [0, -310], [145, -222]], '#e9b090', 3);
      box(ctx, 85, -302, 32, 69, '#d5b392', 4, '#7e8267', 2);
      ellipse(ctx, 0, -248, 22, 22, '#a8c7b5', '#697c66', 3);
      path(ctx, [[-20, -248], [20, -248]], '#697c66', 2);
      path(ctx, [[0, -268], [0, -228]], '#697c66', 2);
      box(ctx, -36, -118, 72, 118, open ? '#495f51' : '#b49074', 5, '#697c66', 3);
      if (!open) { box(ctx, -25, -105, 50, 38, '#c7dbc3', 3, '#8b997d', 2); ellipse(ctx, 21, -51, 4, 4, '#efce88'); }
      for (const xx of [-96, 54]) {
        box(ctx, xx, -150, 45, 57, '#c2d9c5', 4, '#7a8f76', 2);
        path(ctx, [[xx + 22, -148], [xx + 22, -95]], '#7a8f76', 2);
        path(ctx, [[xx + 2, -122], [xx + 43, -122]], '#7a8f76', 2);
        box(ctx, xx - 4, -90, 53, 11, '#c29372', 2, '#7a8f76', 1.5);
        for (let i = 0; i < 4; i++) ellipse(ctx, xx + 6 + i * 10, -96, 7, 10, '#8ead7c');
      }
      box(ctx, -64, -191, 128, 32, '#fdf3d8', 8, '#9b9f7a', 2);
      text(ctx, 'HOME SWEET HOME', 0, -175, 10, '#6c8060');
      this.tree(-211, 0, .9, 1); this.tree(212, 0, 1.1, 0);
      box(ctx, -47, -5, 94, 9, '#d1c9ae', 2, '#8e9b7c', 1.5);
      this.flowerpot(-128, -1, 1); this.flowerpot(128, -1, 1);
      ctx.restore();
    }

    roadSign(x, y, label, arrow) {
      const ctx = this.ctx;
      path(ctx, [[x, y], [x, y - 124]], '#859479', 5);
      box(ctx, x - 63, y - 139, 126, 42, '#f1e4bf', 7, '#7a8b72', 2.5);
      text(ctx, label, x - 8, y - 120, 13, '#5e745b');
      text(ctx, arrow || '→', x + 45, y - 120, 18, '#5e745b');
      this.flowerpot(x, y, .45);
    }

    bubble(x, y, message, size) {
      const ctx = this.ctx; ctx.save();
      ctx.font = `700 ${size}px "Malgun Gothic",sans-serif`;
      const w = Math.min(420, ctx.measureText(message).width + 36), bx = clamp(x - w / 2, 13, 1267 - w);
      ctx.shadowColor = '#4c62441a'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
      box(ctx, bx, y - 18, w, 37, '#fff9e9', 12, '#81937b', 1.5);
      ctx.shadowColor = 'transparent';
      path(ctx, [[clamp(x, bx + 18, bx + w - 18) - 6, y + 18], [clamp(x, bx + 18, bx + w - 18), y + 25], [clamp(x, bx + 18, bx + w - 18) + 6, y + 18]], '#81937b', 1.5, '#fff9e9');
      text(ctx, message, bx + w / 2, y + 1, size, '#526b52'); ctx.restore();
    }

    drawCharacter(ctx, x, y, scale = 1, gauge = 25, pose = 'idle', time = 0, options = {}) {
      if (!options.npc && root.RushHero && root.RushHero.POSES.has(pose)) return root.RushHero.draw(ctx, x, y, scale, gauge, pose, time, options);
      ctx.save(); ctx.translate(x, y); ctx.scale(scale * (options.facing || 1), scale);
      const inheritedAlpha = ctx.globalAlpha;
      const running = ['run', 'sprint', 'walk'].includes(pose);
      const kneeling = pose === 'kneel' || pose === 'cry';
      const desperate = gauge >= 90 || kneeling;
      const anxious = gauge >= 40;
      const crying = gauge >= 70 || kneeling;
      const speed = pose === 'sprint' ? 17 : pose === 'walk' ? 7 : 12;
      const stride = running ? Math.sin(time * speed) : 0;
      const bob = running ? Math.abs(Math.sin(time * speed)) * 2.2 : Math.sin(time * 2.8) * .8;
      const land = pose === 'land';
      const headY = kneeling ? -43 + Math.sin(time * 15) * .65 : -62 + bob + (land ? 4 : 0);
      const bodyY = kneeling ? -20 : -35 + bob;
      const shirt = options.shirt || C.coral, hair = options.hair || C.hair;
      ctx.lineWidth = 2.2;
      ellipse(ctx, 0, 1, kneeling ? 28 : 23, 4, '#42584422');
      if (pose === 'jump') {
        this.limb(ctx, [[-7, -21], [-15, -12], [-8, -6]], C.navy, 10);
        this.limb(ctx, [[8, -22], [18, -24], [20, -14]], C.navy, 10);
        this.shoe(ctx, -6, -5, -.25); this.shoe(ctx, 20, -12, .2);
      } else if (kneeling) {
        ellipse(ctx, -13, -7, 15, 8, C.navy, C.ink, 2);
        ellipse(ctx, 13, -7, 15, 8, C.navy, C.ink, 2);
        if ((options.failTime || 2) > 1.35) ellipse(ctx, -20, -18, 12, 15, '#4c6071', C.ink, 2);
        this.shoe(ctx, -19, -1, 0); this.shoe(ctx, 18, -1, 0);
      } else {
        const liftA = running ? Math.max(0, stride) * 9 : 0;
        const liftB = running ? Math.max(0, -stride) * 9 : 0;
        const stepA = running ? stride * (pose === 'sprint' ? 12 : 10) : -2;
        const stepB = running ? -stride * (pose === 'sprint' ? 12 : 10) : 2;
        this.limb(ctx, [[-8, -24 + bob], [-9 + stepA * .6, -11 - liftA], [-8 + stepA, -3 - liftA]], C.navy, 9);
        this.shoe(ctx, -6 + stepA, -2 - liftA, stride * .2);
        this.limb(ctx, [[8, -24 + bob], [8 + stepB * .6, -11 - liftB], [8 + stepB, -3 - liftB]], C.navy, 9);
        this.shoe(ctx, 10 + stepB, -2 - liftB, -stride * .2);
      }
      const armSwing = running ? stride * 9 : Math.sin(time * 2) * 2;
      if (!anxious && !kneeling) this.limb(ctx, [[-14, bodyY - 10], [-21 - armSwing * .35, bodyY + 1], [-15 - armSwing * .5, bodyY + 6]], '#e7b598', 8);
      box(ctx, -17, bodyY - 16, 34, 32, shirt, 11, C.ink, 2.2);
      path(ctx, [[-9, bodyY - 15], [-4, bodyY - 11], [5, bodyY - 11], [10, bodyY - 15]], '#9e514044', 1.5);
      box(ctx, -14, bodyY + 11, 28, kneeling ? 10 : 9, C.navy, 4, C.ink, 1.5);
      if (anxious || kneeling || pose === 'panic') {
        this.limb(ctx, [[-14, bodyY - 8], [-20, bodyY + 3], [-4, bodyY + 5]], C.skin, 7);
        this.limb(ctx, [[14, bodyY - 8], [19, bodyY + 1], [4, bodyY + 5]], C.skin, 7);
        ellipse(ctx, -2, bodyY + 4, 5, 3.5, C.skin, C.ink, 1.3);
        ellipse(ctx, 5, bodyY + 3, 5, 3.5, C.skin, C.ink, 1.3);
      } else if (pose === 'relief') {
        this.limb(ctx, [[-14, bodyY - 10], [-24, bodyY - 20], [-25, bodyY - 32]], C.skin, 7);
        this.limb(ctx, [[14, bodyY - 10], [24, bodyY - 20], [25, bodyY - 32]], C.skin, 7);
      } else if (options.npc) {
        this.limb(ctx, [[14, bodyY - 9], [24, bodyY], [9, bodyY + 3]], C.skin, 7);
      } else {
        this.limb(ctx, [[14, bodyY - 10], [21 + armSwing * .35, bodyY - 1], [15 + armSwing * .5, bodyY + 5]], C.skin, 7);
      }
      if (pose === 'survey-npc') {
        box(ctx, 10, bodyY - 12, 19, 26, '#e8d9b7', 2, C.ink, 1.5);
        box(ctx, 15, bodyY - 15, 9, 4, '#778d79', 1, C.ink, 1);
        for (let l = 0; l < 3; l++) path(ctx, [[14, bodyY - 5 + l * 5], [24, bodyY - 5 + l * 5]], '#9caa8d', 1);
      }
      // A rounded head, ears and distinct side-swept hair are shared by every pose.
      ellipse(ctx, -22, headY + 2, 5, 7, faceColor(gauge), C.ink, 1.8);
      ellipse(ctx, 22, headY + 2, 5, 7, faceColor(gauge), C.ink, 1.8);
      box(ctx, -22, headY - 24, 44, 47, faceColor(gauge), 18, C.ink, 2.2);
      ctx.beginPath(); ctx.moveTo(-23, headY - 1); ctx.bezierCurveTo(-28, headY - 26, -12, headY - 34, 0, headY - 31);
      ctx.bezierCurveTo(13, headY - 35, 26, headY - 24, 23, headY - 6);
      ctx.lineTo(18, headY - 10); ctx.lineTo(16, headY - 20); ctx.quadraticCurveTo(6, headY - 15, -8, headY - 18);
      ctx.lineTo(-16, headY - 11); ctx.lineTo(-18, headY); ctx.closePath();
      ctx.fillStyle = hair; ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 1.8; ctx.stroke();
      path(ctx, [[-17, headY - 23], [-6, headY - 27], [3, headY - 25]], '#ffffff18', 2);
      const cheekAlpha = .16 + clamp((gauge - 40) / 65, 0, .5);
      ctx.globalAlpha *= cheekAlpha;
      ellipse(ctx, -14, headY + 8, 6, 3.5, '#e76e60'); ellipse(ctx, 14, headY + 8, 6, 3.5, '#e76e60');
      ctx.globalAlpha = inheritedAlpha;
      if (pose === 'hit' || pose === 'panic') {
        ellipse(ctx, -9, headY, 3.5, 5, '#fff9e7', C.ink, 1.5); ellipse(ctx, 9, headY, 3.5, 5, '#fff9e7', C.ink, 1.5);
        ellipse(ctx, -8, headY + 1, 1.6, 2.6, C.ink); ellipse(ctx, 10, headY + 1, 1.6, 2.6, C.ink);
        ellipse(ctx, 1, headY + 12, 4, 5, '#9b574b', C.ink, 1.5);
      } else if (pose === 'relief') {
        this.arcFace(ctx, -9, headY + 1, 4, true); this.arcFace(ctx, 9, headY + 1, 4, true);
        this.arcFace(ctx, 0, headY + 8, 6, false);
      } else if (desperate) {
        path(ctx, [[-15, headY], [-10, headY + 3], [-5, headY]], C.ink, 2.1);
        path(ctx, [[5, headY], [10, headY + 3], [15, headY]], C.ink, 2.1);
        path(ctx, [[-16, headY - 7], [-7, headY - 10]], C.ink, 2);
        path(ctx, [[7, headY - 10], [16, headY - 7]], C.ink, 2);
        ellipse(ctx, 0, headY + 14, 6, 7 + Math.sin(time * 9), '#9c514a', C.ink, 1.5);
        ellipse(ctx, 0, headY + 18, 3.5, 2, '#e29588');
      } else {
        const blink = Math.sin(time * .8) > .995 && !crying;
        if (blink) { path(ctx, [[-13, headY + 1], [-6, headY + 1]], C.ink, 2); path(ctx, [[6, headY + 1], [13, headY + 1]], C.ink, 2); }
        else {
          ellipse(ctx, -9, headY + 1, crying ? 3.5 : 2.5, crying ? 4.5 : 3.2, C.ink);
          ellipse(ctx, 9, headY + 1, crying ? 3.5 : 2.5, crying ? 4.5 : 3.2, C.ink);
          if (crying) { ellipse(ctx, -9.8, headY - .2, 1.1, 1.5, C.cream); ellipse(ctx, 8.2, headY - .2, 1.1, 1.5, C.cream); }
        }
        if (anxious) {
          path(ctx, [[-15, headY - 7], [-7, headY - 10]], C.ink, 1.7);
          path(ctx, [[7, headY - 10], [15, headY - 7]], C.ink, 1.7);
          this.arcFace(ctx, 0, headY + 14, crying ? 5 : 4, true);
        } else {
          path(ctx, [[-14, headY - 7], [-7, headY - 8]], C.ink, 1.5);
          path(ctx, [[7, headY - 8], [14, headY - 7]], C.ink, 1.5);
          this.arcFace(ctx, 0, headY + 9, 4, false);
        }
      }
      if (crying) {
        for (const side of [-1, 1]) {
          const xx = side * 12;
          ellipse(ctx, xx, headY + 5, 5, 2, '#76c7d9');
          if (desperate) {
            const length = 18 + Math.sin(time * 11 + side) * 3;
            ctx.beginPath(); ctx.moveTo(xx - 3.5, headY + 4);
            ctx.bezierCurveTo(xx - 5, headY + 12, xx - 1, headY + 14, xx - 3, headY + length);
            ctx.quadraticCurveTo(xx + 1, headY + length + 4, xx + 3, headY + length - 1);
            ctx.bezierCurveTo(xx + 5, headY + 14, xx + 2, headY + 9, xx + 3.5, headY + 4);
            ctx.closePath(); ctx.fillStyle = '#79c9de'; ctx.fill();
            path(ctx, [[xx - .5, headY + 7], [xx - .5, headY + 17]], '#d2f4ee', 1.1);
          }
          const cycle = (time * (desperate ? 2.8 : .95) + (side + 1) * .23) % 1;
          if (desperate || cycle < .65) {
            const dropY = headY + 14 + cycle * 48, dropX = xx - (running ? cycle * 11 : 0);
            this.tear(ctx, dropX, dropY, desperate ? 2.8 : 2, '#6dbfd7');
            if (desperate) this.tear(ctx, xx - cycle * 19, headY + 40 + cycle * 40, 2, '#93d8e5');
          }
        }
      } else if (anxious) this.tear(ctx, 24, headY - 7 + Math.sin(time * 3) * 2, 3, '#94c8cf');
      if (pose === 'panic') {
        path(ctx, [[-30, headY - 24], [-37, headY - 32]], '#e2a15e', 2);
        path(ctx, [[-34, headY - 15], [-44, headY - 17]], '#e2a15e', 2);
      }
      ctx.restore();
    }

    limb(ctx, points, color, width) {
      path(ctx, points, C.ink, width + 3); path(ctx, points, color, width);
    }
    shoe(ctx, x, y, angle) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
      box(ctx, -8, -5, 17, 8, '#a6ccb7', 4, C.ink, 1.8);
      path(ctx, [[-6, 1], [8, 1]], '#f7eed6', 2.3); ctx.restore();
    }
    arcFace(ctx, x, y, r, upside) {
      ctx.beginPath(); ctx.moveTo(x - r, y + (upside ? 2 : 0));
      ctx.quadraticCurveTo(x, y + (upside ? -4 : 6), x + r, y + (upside ? 2 : 0));
      ctx.strokeStyle = C.ink; ctx.lineWidth = 1.7; ctx.stroke();
    }
    tear(ctx, x, y, size, color) {
      ctx.beginPath(); ctx.moveTo(x, y - size * 1.7);
      ctx.bezierCurveTo(x - size * 1.8, y, x - size, y + size, x, y + size);
      ctx.bezierCurveTo(x + size, y + size, x + size * 1.8, y, x, y - size * 1.7);
      ctx.fillStyle = color; ctx.fill();
      path(ctx, [[x - size * .3, y - size * .1], [x - size * .2, y + size * .4]], '#e3f9ef', .7);
    }

    dust(x, y, facing, sprint) {
      const ctx = this.ctx;
      for (let i = 0; i < (sprint ? 5 : 3); i++) {
        const t = (this.time * 3 + i * .27) % 1;
        ctx.globalAlpha = (1 - t) * .55;
        ellipse(ctx, x - facing * (14 + t * 35), y - 3 - t * 9, 2 + t * 5, 1.5 + t * 3, '#e6d3ad');
      }
      ctx.globalAlpha = 1;
    }
    stars(x, y) {
      const ctx = this.ctx;
      for (let i = 0; i < 4; i++) {
        const angle = this.time * 3 + i * Math.PI / 2;
        this.star(ctx, x + Math.cos(angle) * 30, y + Math.sin(angle) * 12, 5, '#edc66d');
      }
    }
    star(ctx, x, y, size, color) {
      const points = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? size * .45 : size, a = -Math.PI / 2 + i * Math.PI / 5;
        points.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
      }
      path(ctx, points, '#ad914b', .7, color);
    }

    drawMenu() {
      const ctx = this.ctx, cam = this.time * 6;
      this.sky(cam, 1);
      this.building(66 - cam % 20, 548, 0, 1); this.building(410 - cam % 20, 548, 1, 1);
      this.home(1115, 568, .7); this.tree(737, 567, 1.25, 1);
      this.ground(cam);
      const fade = ctx.createLinearGradient(0, 0, 930, 0);
      fade.addColorStop(0, '#faf3df'); fade.addColorStop(.5, '#faf3dfec'); fade.addColorStop(1, '#faf3df00');
      ctx.fillStyle = fade; ctx.fillRect(0, 0, 1020, 720);
      ctx.save(); ctx.translate(990, 454); ctx.rotate(-.12);
      ellipse(ctx, 0, 0, 195, 174, '#f9eacb99');
      ctx.restore();
      this.drawCharacter(ctx, 969, 573, 3.05, 58, 'idle', this.time, {});
      this.bubble(963, 228, '오늘은… 집이 조금 멀다.', 17);
      this.roadSign(784, 577, '우리 집', '→');
      this.cone(1169, 590, .7); this.flowerpot(1231, 598, 1.1);
      for (let i = 0; i < 3; i++) {
        const xx = 806 + i * 170, yy = 310 + Math.sin(this.time * 1.5 + i * 2) * 10;
        this.star(ctx, xx, yy, 6, '#e8cc8b');
      }
      this.grain();
    }

    drawSurvey() {
      const ctx = this.ctx;
      ctx.fillStyle = '#f7f0ddec'; ctx.fillRect(0, 0, 1280, 720);
      const g = ctx.createLinearGradient(0, 100, 0, 700); g.addColorStop(0, '#d7e6cf66'); g.addColorStop(1, '#f7edd600');
      ctx.fillStyle = g; ctx.fillRect(0, 90, 1280, 630);
      path(ctx, [[0, 578], [1280, 578]], '#d1d8be', 2);
      for (let i = 0; i < 12; i++) {
        const x = i * 117;
        path(ctx, [[x, 142], [x + 58, 148], [x + 117, 142]], '#9cba9c55', 1);
        path(ctx, [[x + 9, 144], [x + 29, 145], [x + 20, 168]], null, 0, i % 2 ? '#d9ba8e66' : '#8dae9566');
      }
      this.drawCharacter(ctx, 176, 580, 2.6, 0, 'survey-npc', this.time, {npc: true, hair: '#765f4d', shirt: '#7d9f83'});
      this.drawCharacter(ctx, 1110, 580, 2.7, Math.max(46, this.previousGauge), 'idle', this.time, {facing: -1});
      this.bubble(174, 299, '정말 1분이면 돼요!', 15);
      this.bubble(1105, 293, '저… 지금 급한데요…', 14);
      this.flowerpot(68, 585, 1.2); this.flowerpot(1219, 585, 1.2);
    }

    drawToiletScene(engine) {
      const ctx = this.ctx, t = engine.stateTime || 0;
      ctx.fillStyle = '#eef0d8df'; ctx.fillRect(0, 105, 1280, 615);
      this.tree(380, 582, 1.2, 1); this.tree(915, 582, 1.35, 0);
      const door = t < .6 ? Math.sin(t / .6 * Math.PI) : t > 1.55 ? Math.sin(clamp((t - 1.55) / .65, 0, 1) * Math.PI) : 0;
      this.toilet(640, 583, 1.8, t > 1.05, door);
      if (t < .65) {
        this.drawCharacter(ctx, 465 + clamp(t / .65, 0, 1) * 165, 583, 1.6 - clamp(t / .65, 0, 1) * .35, this.previousGauge, 'run', this.time, {});
      } else if (t > 1.65) this.drawCharacter(ctx, 650 + (t - 1.65) * 120, 583, 1.4, this.previousGauge, 'relief', this.time, {});
      if (t > .75 && t < 1.8) {
        for (let i = 0; i < 4; i++) {
          const yy = 300 - ((this.time * 30 + i * 31) % 100);
          ctx.globalAlpha = .5;
          this.star(ctx, 620 + Math.sin(i * 2 + this.time) * 70, yy, 7, '#d4ba69');
        }
        ctx.globalAlpha = 1;
        this.bubble(640, 146, '하아… 살았다!  −35%', 20);
      }
    }

    drawFailureCutscene(engine) {
      const ctx = this.ctx, t = engine.stateTime || 0;
      if (t < 1.3) return;
      ctx.fillStyle = `rgba(246,237,217,${clamp((t - 1.3) / .6, 0, .94)})`; ctx.fillRect(0, 105, 1280, 615);
      this.drawCharacter(ctx, 640, 553, 2.7, 100, 'kneel', this.time, {failTime: t});
      if (t > 2.1) this.poop(882, 530, 1.2, true);
      if (t > 1.9) {
        const alpha = clamp((t - 1.9) / .5, 0, 1); ctx.globalAlpha = alpha;
        text(ctx, '아… 안 돼…!', 640, 254, 24, '#a36e59'); ctx.globalAlpha = 1;
      }
    }

    drawFailure() {
      const ctx = this.ctx;
      ctx.fillStyle = '#f8eedceF'; ctx.fillRect(0, 0, 1280, 720);
      ellipse(ctx, 640, 493, 240, 107, '#ead9bf55');
      path(ctx, [[460, 552], [821, 552]], '#c8c8ad', 2);
      this.drawCharacter(ctx, 640, 553, 2.7, 100, 'kneel', this.time, {failTime: 3});
      this.poop(892, 531, 1.18, true);
      this.flowerpot(373, 556, .8);
      for (let i = 0; i < 3; i++) this.tear(ctx, 500 + i * 140, 366 + Math.sin(this.time * 2 + i) * 10, 6, '#abd2cc66');
    }

    poop(x, y, scale = 1, flies = true) {
      const ctx = this.ctx; ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
      ellipse(ctx, 0, 2, 44, 7, '#96846920');
      ctx.beginPath(); ctx.moveTo(-29, -5);
      ctx.bezierCurveTo(-45, -15, -34, -34, -20, -35);
      ctx.bezierCurveTo(-30, -46, -14, -60, -5, -60);
      ctx.bezierCurveTo(-14, -74, 8, -72, 2, -89);
      ctx.bezierCurveTo(24, -76, 19, -67, 14, -60);
      ctx.bezierCurveTo(32, -56, 29, -40, 23, -35);
      ctx.bezierCurveTo(43, -30, 46, -13, 30, -5);
      ctx.bezierCurveTo(20, 1, -20, 1, -29, -5); ctx.closePath();
      ctx.fillStyle = '#b98f6d'; ctx.fill(); ctx.strokeStyle = '#755f4d'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-20, -35); ctx.quadraticCurveTo(3, -28, 23, -35); ctx.strokeStyle = '#9d765b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-5, -60); ctx.quadraticCurveTo(6, -54, 14, -60); ctx.stroke();
      ellipse(ctx, -12, -20, 3, 4, '#493e35'); ellipse(ctx, 12, -20, 3, 4, '#493e35');
      ellipse(ctx, -19, -13, 5, 3, '#dca28a'); ellipse(ctx, 19, -13, 5, 3, '#dca28a');
      this.arcFace(ctx, 0, -14, 5, false);
      if (flies) for (let i = 0; i < 3; i++) {
        const angle = this.time * (1.5 + i * .1) + i * 2.1;
        const fx = Math.cos(angle) * (47 + i * 6), fy = -57 + Math.sin(angle * 1.6) * 27;
        path(ctx, [[fx - 8, fy + 1], [fx - 14, fy + 3]], '#8c92764d', 1);
        ellipse(ctx, fx - 2.5, fy - 3.5 - Math.sin(this.time * 35) * 1.2, 4, 2.6, '#ffffffc0', '#80918c', .6);
        ellipse(ctx, fx + 2.5, fy - 3.5 + Math.sin(this.time * 35) * 1.2, 4, 2.6, '#ffffffc0', '#80918c', .6);
        ellipse(ctx, fx, fy, 3.3, 2.5, '#59665c');
        ellipse(ctx, fx + 3, fy - .5, 1.5, 1.5, '#394c43');
      }
      ctx.restore();
    }

    drawVictoryCutscene(engine) {
      const ctx = this.ctx, t = engine.stateTime || 0;
      ctx.fillStyle = '#f6eddaed'; ctx.fillRect(0, 105, 1280, 615);
      if (t < 1.25) {
        this.home(710, 590, 1.25, t > .35);
        if (t < 1.05) this.drawCharacter(ctx, mix(410, 705, clamp(t / 1.1, 0, 1)), 590, mix(1.7, 1.1, t / 1.25), this.previousGauge, 'sprint', this.time, {});
      } else {
        box(ctx, 359, 182, 562, 412, '#e4e4c9', 14, '#9cae8d', 3);
        for (let row = 0; row < 7; row++) path(ctx, [[367, 212 + row * 54], [913, 212 + row * 54]], '#c3d1b7', 1.3);
        for (let col = 0; col < 8; col++) path(ctx, [[383 + col * 72, 190], [383 + col * 72, 586]], '#c3d1b7', 1.3);
        box(ctx, 554, 248, 172, 342, '#789a80', 6, '#5d7760', 3);
        const doorOpen = t < 1.85;
        box(ctx, 564, 260, doorOpen ? 25 : 152, 328, doorOpen ? '#a7c4a2' : '#a0b99a', 3, '#5d7760', 2);
        if (!doorOpen) { ellipse(ctx, 695, 427, 6, 6, '#ecce86'); box(ctx, 602, 292, 75, 50, '#f7eed4', 8, '#7f9275', 2); text(ctx, 'WC', 640, 316, 23, '#708567'); }
        if (t < 1.85) this.drawCharacter(ctx, 458 + (t - 1.25) * 310, 588, 1.8, this.previousGauge, 'sprint', this.time, {});
        if (t > 2.05) { this.bubble(640, 196, '세상에서 가장 행복한 순간…', 19); this.confetti(.55); }
      }
    }

    drawVictory() {
      const ctx = this.ctx;
      ctx.fillStyle = '#f5efdceF'; ctx.fillRect(0, 0, 1280, 720);
      ellipse(ctx, 640, 480, 258, 112, '#dce5c777');
      this.tree(353, 546, .85, 1); this.tree(945, 546, .85, 0);
      this.drawCharacter(ctx, 640, 542, 2.35, 10, 'relief', this.time, {});
      this.star(ctx, 797, 380 + Math.sin(this.time * 2) * 4, 17, '#e9c974');
      this.star(ctx, 478, 352 + Math.sin(this.time * 2 + 1) * 4, 10, '#e9c974');
      this.confetti(.8);
    }

    confetti(alpha = 1) {
      const ctx = this.ctx;
      for (let i = 0; i < 35; i++) {
        const t = (this.time * .16 + hash(i + 52)) % 1;
        const xx = 260 + hash(i + 8) * 760 + Math.sin(t * 6 + i) * 25, yy = 130 + t * 440;
        ctx.save(); ctx.globalAlpha = alpha * Math.min(1, (1 - t) * 3); ctx.translate(xx, yy); ctx.rotate(t * 9 + i);
        box(ctx, -3, -5, 6, 10, ['#e7a27a', '#92b89a', '#dfc474', '#a5c6c3'][i % 4], 1, null); ctx.restore();
      }
    }

    grain() {
      const ctx = this.ctx;
      // Fixed, faint flecks keep the canvas warm without a costly per-pixel filter.
      ctx.fillStyle = '#6c70550a';
      for (let i = 0; i < 185; i++) ctx.fillRect(hash(i * 3 + 1) * 1280, hash(i * 3 + 2) * 720, 1.2, 1.2);
    }
  }

  root.RushRenderer = RushRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = {RushRenderer};
})(typeof globalThis !== 'undefined' ? globalThis : window);
