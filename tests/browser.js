/* Explicit ?test=1 browser QA. Fixtures are labelled; route tests use ordinary inputs only. */
(function () {
  'use strict';
  const app = window.__rush;
  if (!app) return;
  const e = app.engine;
  const panel = document.createElement('section');
  panel.id = 'qa-panel';
  panel.style.cssText = 'margin:25px auto;padding:18px;max-width:1100px;background:#fffaf0;border:2px dashed #a2b89a;border-radius:12px;font:12px monospace;color:#254839';
  const heading = document.createElement('h2');
  heading.textContent = '개발 검증 전용 — ?test=1';
  const controls = document.createElement('div');
  controls.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
  const results = document.createElement('pre');
  results.id = 'qa-results';
  results.style.cssText = 'white-space:pre-wrap;line-height:1.7';
  const state = document.createElement('p');
  state.id = 'qa-state';
  function sync() {
    app.sync(); app.renderer.render(e, .016);
    state.textContent = JSON.stringify({ state: e.state, x: Math.round(e.player.x), gauge: +e.gauge.toFixed(2), elapsed: +e.elapsed.toFixed(2), jumps: e.stats.jumps, toilets: e.stats.toilets, question: e.surveyIndex });
  }
  function button(label, fn) {
    const b = document.createElement('button'); b.textContent = label;
    b.style.cssText = 'padding:10px 12px;border:1px solid #aac099;border-radius:7px;background:#ecf0e3;font:12px inherit';
    b.addEventListener('click', fn); controls.append(b);
  }
  function advance(seconds, input = {}) { for (let i = 0; i < Math.round(seconds * 120); i++) app.tick(1 / 120, input); }
  function fixture(name) {
    app.setManual(true); app.start();
    e.visualFixture = true;
    if (name.startsWith('face')) {
      e.gauge = e.displayGauge = Number(name.slice(4)); e.player.x = 500; e.player.vx = 180;
      advance(.12, { right: true });
    }
    if (name === 'survey') { e.player.x = e.level.surveyX; app.tick(.016); }
    if (name === 'toilet') { e.player.x = e.level.toilets[0].x; e.gauge = e.displayGauge = 95; e.useToilet(); advance(.4); }
    if (name === 'failure') { e.gauge = 99.9999; app.tick(.1); advance(3.3); }
    if (name === 'victory') { e.player.x = e.level.homeX - 1; e.surveyCompleted = true; app.tick(.02, { right: true }); advance(.2, { right: true }); advance(3.3); }
    sync();
    document.getElementById('game-frame').scrollIntoView({ block: 'center' });
  }
  function playRoute(sprint) {
    app.start(); let frames = 0; const seen = new Set();
    while (['PLAYING', 'SURVEY', 'TOILET_EVENT'].includes(e.state) && frames < 120 * 360) {
      seen.add(e.state);
      if (e.state === 'SURVEY') e.answerSurvey(2);
      const p = e.player;
      const next = e.level.obstacles.find(o => o.type !== 'puddle' && o.x + o.w > p.x - 10 && o.x - p.x < 200);
      const threshold = next && next.type === 'pit' ? (sprint ? 66 : 30) : (sprint ? 72 : 36);
      const input = { right: true, sprint, jump: !!(next && p.grounded && next.x - p.x <= threshold && next.x + next.w > p.x), interact: !!e.nearToilet };
      // Same simulation as rAF; sync the real Canvas and UI once per simulated second.
      if (frames % 120 === 0) app.tick(1 / 120, input);
      else e.update(1 / 120, input);
      frames++;
    }
    if (e.state !== 'VICTORY_CUTSCENE') throw new Error('Route failed: ' + e.state + ' gauge=' + e.gauge);
    advance(3.3);
    sync();
    return { ...e.result, surveyed: e.surveyCompleted, states: [...seen] };
  }
  async function runSuite() {
    const lines = [];
    let count = 0;
    const savedRecord = localStorage.getItem('toilet-rush-best-v1');
    const savedSound = localStorage.getItem('toilet-rush-sound');
    const check = (condition, text) => { if (!condition) throw new Error(text); count++; lines.push('PASS ' + text); results.textContent = lines.join('\n'); };
    app.setManual(true);
    try {
      app.menu(); check(!document.getElementById('menu-screen').hidden, 'main menu renders');
      document.getElementById('help-button').click(); check(!document.getElementById('help-screen').hidden, 'controls dialog opens');
      document.getElementById('help-play').click(); check(e.state === 'PLAYING', 'start from controls dialog');
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }));
      for (let i = 0; i < 60; i++) app.tick(1 / 120);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ArrowRight' }));
      check(e.player.x > 270, 'browser keyboard move handlers reach simulation');
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); app.tick(.016);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
      check(e.stats.jumps === 1 && !e.player.grounded, 'browser jump key and gravity');
      document.getElementById('pause-button').click();
      const paused = [e.elapsed, e.gauge, e.player.x]; advance(2, { right: true, jump: true });
      check(e.state === 'PAUSED' && [e.elapsed, e.gauge, e.player.x].every((v, i) => v === paused[i]), 'pause freezes clock, gauge and movement');
      document.getElementById('resume-button').click(); check(e.state === 'PLAYING', 'continue button restores game');
      fixture('survey'); const gauge = e.gauge; advance(2); check(e.gauge > gauge, 'survey keeps gauge ticking');
      document.getElementById('pause-button').click(); document.getElementById('resume-button').click();
      check(e.state === 'SURVEY' && !document.getElementById('survey-screen').hidden, 'pause cannot bypass mandatory survey');
      for (let q = 0; q < 3; q++) document.querySelector('#survey-options button:last-child').click();
      check(e.state === 'PLAYING' && e.surveyCompleted && e.surveyAnswers.length === 3, 'all three real survey buttons return to game');
      fixture('toilet'); advance(.7); check(e.gauge === 60 && e.toiletRecovered, '95 to 60 toilet recovery and calm expression');
      advance(1.3); check(e.state === 'PLAYING' && e.stats.toilets === 1 && !e.useToilet(), 'toilet finishes and cannot be reused');
      fixture('failure'); check(e.state === 'GAME_OVER' && !document.getElementById('result-screen').hidden, 'failure cutscene reaches real result screen');
      const failedX = e.player.x; advance(1, { right: true, jump: true }); check(e.player.x === failedX, 'game over has no continuing player physics');
      document.querySelector('#result-screen [data-action="restart"]').click();
      check(e.state === 'PLAYING' && e.gauge === 25 && !e.surveyCompleted && e.level.toilets.every(t => !t.used), 'actual restart resets all run state');
      const enabled = app.audio.enabled; document.getElementById('sound-toggle').click();
      check(app.audio.enabled !== enabled, 'sound button toggles sound'); document.getElementById('sound-toggle').click();
      app.start();
      const right = document.querySelector('[data-input="right"]');
      right.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, bubbles: true }));
      for (let i = 0; i < 30; i++) app.tick(1 / 120);
      right.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true }));
      check(e.player.x > 225, 'touch pointer handlers reach simulation');
      const normal = playRoute(false);
      check(e.state === 'VICTORY' && normal.surveyed && normal.toilets === 2 && normal.gauge < 100, 'full normal input-only route reaches CLEAR');
      check(!document.getElementById('result-screen').hidden && document.getElementById('result-title').textContent === 'CLEAR!', 'victory data renders into result UI');
      check(JSON.parse(localStorage.getItem('toilet-rush-best-v1')).time > 0, 'best record persisted in LocalStorage');
      lines.push('NORMAL ' + JSON.stringify(normal));
      const sprint = playRoute(true);
      check(e.state === 'VICTORY' && sprint.time < normal.time && sprint.gauge > normal.gauge, 'full sprint route trades gauge for faster finish');
      lines.push('SPRINT ' + JSON.stringify(sprint));
      document.querySelector('#result-screen [data-action="menu"]').click(); check(e.state === 'MENU', 'result main-menu button');
      panel.dataset.status = 'passed'; panel.dataset.passed = String(count);
      lines.push('ALL ' + count + ' BROWSER CHECKS PASSED');
    } catch (error) {
      panel.dataset.status = 'failed'; lines.push('FAIL ' + error.message); console.error(error);
    } finally {
      if (savedRecord === null) localStorage.removeItem('toilet-rush-best-v1'); else localStorage.setItem('toilet-rush-best-v1', savedRecord);
      if (savedSound === null) localStorage.removeItem('toilet-rush-sound'); else localStorage.setItem('toilet-rush-sound', savedSound);
      app.refreshBest();
      if (e.state === 'MENU') app.menu();
      results.textContent = lines.join('\n'); sync(); panel.scrollIntoView({ block: 'center' });
    }
  }
  button('전체 브라우저 검증 실행', runSuite);
  [25, 55, 75, 95].forEach(g => button('표정 ' + g + '% (fixture)', () => fixture('face' + g)));
  button('설문 화면 (fixture)', () => fixture('survey'));
  button('화장실 (fixture)', () => fixture('toilet'));
  button('실패 화면 (fixture)', () => fixture('failure'));
  button('승리 화면 (fixture)', () => fixture('victory'));
  button('실시간 재생', () => { app.setManual(false); app.clearInput(); });
  button('메인 메뉴', () => { app.menu(); app.setManual(false); sync(); });
  panel.append(heading, controls, state, results); document.body.append(panel);
  setInterval(() => { if (panel.isConnected) state.textContent = JSON.stringify({ state: e.state, x: Math.round(e.player.x), gauge: +e.gauge.toFixed(2), elapsed: +e.elapsed.toFixed(2), jumps: e.stats.jumps, toilets: e.stats.toilets, question: e.surveyIndex }); }, 300);
  sync();
})();
