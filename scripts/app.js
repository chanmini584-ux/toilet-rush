/* Browser integration. The simulation and artwork remain independent of the DOM. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const canvas = $('game-canvas');
  const frame = $('game-frame');
  const audio = new RushAudio();
  const renderer = new RushRenderer(canvas);
  const eventQueue = [];
  const engine = new ToiletRush.Engine({ onEvent: (type, payload) => eventQueue.push({ type, payload }) });
  const keys = { left: false, right: false, sprint: false, jump: false, interact: false };
  const held = new Set();
  const activeScreens = ['menu-screen', 'survey-screen', 'pause-screen', 'result-screen'];
  const questions = [
    { title: '오늘 기분은 어떠신가요?', options: ['매우 좋습니다.', '급합니다.', '제발 보내주세요.'] },
    { title: '하루에 화장실을 몇 번 이용하시나요?', options: ['1~2회', '3회 이상', '지금 당장 한 번이 필요합니다.'] },
    { title: '다음 설문조사에도 참여하시겠습니까?', options: ['네.', '아니요.', '제발 그만 물어보세요.'] }
  ];
  let previousState = '';
  let previousQuestion = -1;
  let toastRemaining = 0;
  let helpOpen = false;
  let lastFocus = null;
  let best = readBest();
  let newRecord = false;
  let lastTime = 0;
  let testMode = false;
  let manualMode = false;
  let displayedMeters = -1;

  function storageRead(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function storageWrite(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } }
  function readBest() {
    try {
      const record = JSON.parse(storageRead('toilet-rush-best-v1') || 'null');
      const minimumTime = (ToiletRush.createLevel().homeX - 200) / ToiletRush.CONFIG.sprintSpeed;
      return record && Number.isFinite(record.time) && record.time >= minimumTime && Number.isFinite(record.gauge) && record.gauge >= 0 && record.gauge < 100 && ['S', 'A', 'B', 'C'].includes(record.rank) ? record : null;
    } catch { return null; }
  }
  function formatTime(seconds, precise) {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
    return min + ':' + sec + (precise ? '.' + Math.floor((seconds % 1) * 100).toString().padStart(2, '0') : '');
  }
  function setSound(enabled) {
    audio.setEnabled(enabled);
    storageWrite('toilet-rush-sound', enabled ? 'on' : 'off');
    $('sound-toggle').classList.toggle('is-muted', !enabled);
    $('sound-toggle').setAttribute('aria-label', enabled ? '사운드 끄기' : '사운드 켜기');
    $('sound-toggle').setAttribute('aria-pressed', String(enabled));
    $('pause-sound').textContent = enabled ? '사운드 끄기' : '사운드 켜기';
  }
  function unlockAudio() { audio.unlock().catch(() => {}); }
  function clearInput() {
    held.clear();
    Object.keys(keys).forEach((key) => { keys[key] = false; });
    document.querySelectorAll('.touch-controls button').forEach((button) => button.classList.remove('pressed'));
  }
  function showToast(message, seconds) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastRemaining = seconds || 2.6;
  }
  function startGame() {
    closeHelp();
    clearInput();
    unlockAudio();
    newRecord = false;
    engine.start();
    engine.visualFixture = false;
    canvas.focus({ preventScroll: true });
    updateUI();
  }
  function mainMenu() {
    closeHelp();
    clearInput();
    best = readBest();
    engine.menu();
    updateUI();
  }
  function togglePause() {
    if (helpOpen) { closeHelp(); return; }
    clearInput();
    if (engine.state === 'PAUSED') engine.resume();
    else engine.pause();
    updateUI();
  }
  function openHelp() {
    helpOpen = true;
    lastFocus = document.activeElement;
    $('help-screen').hidden = false;
    $('help-close').focus({ preventScroll: true });
  }
  function closeHelp() {
    if (!helpOpen) return;
    helpOpen = false;
    $('help-screen').hidden = true;
    if (lastFocus && !lastFocus.closest('[hidden]')) lastFocus.focus({ preventScroll: true });
  }
  function renderSurvey() {
    if (previousQuestion === engine.surveyIndex) return;
    previousQuestion = engine.surveyIndex;
    const question = questions[Math.min(2, engine.surveyIndex)];
    $('survey-title').textContent = question.title;
    $('survey-count').textContent = '0' + (engine.surveyIndex + 1) + ' / 03';
    $('survey-options').replaceChildren(...question.options.map((label, index) => {
      const button = document.createElement('button');
      const number = document.createElement('b');
      const text = document.createElement('span');
      number.textContent = index + 1;
      text.textContent = label;
      button.append(number, text);
      button.addEventListener('click', () => {
        unlockAudio();
        engine.answerSurvey(index);
        if (engine.state === 'SURVEY') renderSurvey();
        updateUI();
      });
      return button;
    }));
    if (engine.state === 'SURVEY') $('survey-options').firstElementChild.focus({ preventScroll: true });
  }
  function saveRecord() {
    if (testMode && engine.visualFixture) return;
    const result = engine.result;
    if (!result) return;
    newRecord = !best || result.time < best.time;
    if (newRecord) {
      best = { time: result.time, gauge: result.gauge, rank: result.rank, date: new Date().toISOString() };
      if (!storageWrite('toilet-rush-best-v1', JSON.stringify(best))) showToast('브라우저 저장소가 꺼져 있어 이번 기록은 현재 창에서만 보관해요.', 4);
    }
  }
  function renderResult(victory) {
    $('result-screen').classList.toggle('failure', !victory);
    $('result-eyebrow').textContent = victory ? 'THERE IS NO PLACE LIKE HOME' : 'SO CLOSE. YET SO FAR.';
    $('result-title').textContent = victory ? 'CLEAR!' : 'GAME OVER';
    $('result-message').textContent = victory ? '드디어 도착했다!' : '결국 참지 못했습니다...';
    const result = engine.result || { time: engine.elapsed, gauge: engine.gauge, ...engine.stats };
    const entries = [
      [victory ? '클리어 시간' : '버틴 시간', formatTime(result.time, true)],
      ['최종 게이지', result.gauge.toFixed(1) + '%'],
      ['장애물 충돌', result.collisions + '회'],
      ['점프', result.jumps + '회'],
      ['공중화장실', result.toilets + '회']
    ];
    const panel = $('result-stats');
    panel.replaceChildren();
    if (victory) {
      const rank = document.createElement('div');
      rank.className = 'rank';
      rank.append(document.createTextNode(result.rank));
      const caption = document.createElement('small');
      caption.textContent = '오늘의 등급';
      rank.append(caption);
      panel.append(rank);
    }
    const dl = document.createElement('dl');
    entries.forEach(([name, value]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = name;
      dd.textContent = value;
      row.append(dt, dd);
      dl.append(row);
    });
    panel.append(dl);
    if (victory && newRecord) {
      const badge = document.createElement('div');
      badge.className = 'record-badge';
      badge.textContent = '✳ 새로운 최고 기록!';
      panel.append(badge);
    }
  }
  function updateUI() {
    const state = engine.state;
    const changed = state !== previousState;
    const gameplay = ['PLAYING', 'SURVEY', 'TOILET_EVENT', 'PAUSED'].includes(state);
    if (changed) {
      activeScreens.forEach((id) => { $(id).hidden = true; });
      $('hud').hidden = !gameplay;
      $('play-hint').hidden = state !== 'PLAYING';
      $('toilet-caption').hidden = state !== 'TOILET_EVENT';
      $('cutscene-caption').hidden = !state.endsWith('_CUTSCENE');
      $('toast').hidden = true;
      toastRemaining = 0;
      if (state === 'MENU') {
        $('menu-screen').hidden = false;
        previousQuestion = -1;
        $('best-menu').textContent = best ? '✳ BEST ' + formatTime(best.time, true) + ' · RANK ' + best.rank : '첫 번째 무사 귀가의 주인공이 되어보세요.';
        $('start-button').focus({ preventScroll: true });
      }
      if (state === 'SURVEY') {
        $('survey-screen').hidden = false;
        previousQuestion = -1;
        renderSurvey();
      }
      if (state === 'PAUSED') { $('pause-screen').hidden = false; $('resume-button').focus({ preventScroll: true }); }
      if (state.endsWith('_CUTSCENE')) { clearInput(); $('cutscene-text').textContent = state === 'GAME_OVER_CUTSCENE' ? '아… 안 돼…!' : '드디어, 우리 집!'; }
      if (state === 'VICTORY' || state === 'GAME_OVER') {
        if (state === 'VICTORY') saveRecord();
        renderResult(state === 'VICTORY');
        $('result-screen').hidden = false;
        $('result-screen').querySelector('button').focus({ preventScroll: true });
      }
      if (state === 'PLAYING' && previousState && previousState !== 'PLAYING') canvas.focus({ preventScroll: true });
      previousState = state;
    }
    if (state === 'SURVEY') renderSurvey();
    if (gameplay) {
      const gauge = engine.displayGauge;
      $('gauge-number').textContent = gauge >= 90 ? Math.min(99.9, gauge).toFixed(1) : Math.floor(gauge);
      $('gauge-fill').style.width = gauge + '%';
      $('gauge-track').setAttribute('aria-valuenow', String(Math.round(engine.gauge)));
      $('gauge-fill').style.background = gauge >= 90 ? '#df674f' : gauge >= 70 ? '#e9a250' : gauge >= 40 ? '#ccae68' : '#83ae86';
      frame.classList.toggle('danger', engine.gauge >= 90);
      $('emotion-label').textContent = engine.gauge >= 90 ? '이제 정말 못 참겠어!' : engine.gauge >= 70 ? '눈물이 날 것 같아…' : engine.gauge >= 40 ? '조금씩 불안해지는데…' : '아직은 괜찮아';
      $('time-value').textContent = formatTime(engine.elapsed);
      const meters = Math.ceil(engine.remainingDistance / 100);
      if (meters !== displayedMeters) {
        $('distance-value').replaceChildren(document.createTextNode(meters), Object.assign(document.createElement('small'), { textContent: 'm' }));
        displayedMeters = meters;
      }
      $('stage-label').textContent = ['01 골목길', '02 번화가', '03 집 앞 마지막 질주'][engine.stage - 1];
      $('route-fill').style.width = (engine.progress * 100) + '%';
    } else frame.classList.remove('danger');
    if (state === 'PLAYING') {
      const near = engine.nearToilet;
      const hint = $('play-hint');
      hint.classList.toggle('interact', !!near);
      if (near) hint.textContent = 'E — 공중화장실 이용 · −35% (한 번만!)';
      else if (engine.slippery) hint.textContent = '미끄러워요! 속도를 줄이면 안전해요.';
      else if (engine.player.x < 900) hint.textContent = '← → 이동 · SPACE 점프 · SHIFT 전력 질주';
      else if (engine.player.x < 1800) hint.textContent = '차단봉은 점프로! 점프할 때마다 +1.5%';
      else if (engine.player.x < 3000) hint.textContent = '질주는 빠르지만, 게이지도 더 빨리 올라요.';
      else if (engine.gauge >= 90) hint.textContent = '조금만 더! 화장실을 놓치지 마세요.';
      else if (engine.player.x > 41000) hint.textContent = '저기 우리 집이 보여! 마지막까지!';
      else hint.textContent = ['천천히 가도 괜찮아. 집까지 무사히!', '설문도, 공사장도… 오늘따라 왜 이래!', '이제 우리 동네다. 조금만 더!'][engine.stage - 1];
      $('touch-interact').classList.toggle('touch-ready', !!near);
    }
    if (state === 'TOILET_EVENT') $('toilet-text').textContent = engine.toiletRecovered ? '휴우… 살았다! 급똥 게이지 −35%' : '문이 닫히면, 드디어 안도의 시간.';
    const touch = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 760;
    $('touch-controls').hidden = !(touch && state === 'PLAYING');
  }
  function processEvents() {
    while (eventQueue.length) {
      const { type, payload } = eventQueue.shift();
      if (type !== 'state') audio.play(type, payload);
      if (type === 'hit') showToast('앗! 조심해야겠어. +10%');
      if (type === 'fall') showToast('으악, 구멍! 안전한 곳에서 다시 출발. +18%');
      if (type === 'relief') showToast('휴우… 잠깐 살았다! −35%');
      if (type === 'surveyComplete') showToast('“참여해 주셔서 감사합니다!” …이제 좀 갈게요!');
      if (type === 'stage') showToast('STAGE ' + engine.stage + ' · ' + engine.level.stages[engine.stage - 1].name);
    }
  }
  function tick(dt, input) {
    engine.update(dt, input || keys);
    keys.jump = false;
    keys.interact = false;
    updateUI();
    processEvents();
    audio.update(engine.state, engine.gauge, dt);
    if (engine.state !== 'PAUSED' && toastRemaining > 0) {
      toastRemaining -= dt;
      if (toastRemaining <= 0) $('toast').hidden = true;
    }
    renderer.render(engine, dt);
  }
  function loop(time) {
    const dt = lastTime ? Math.min(.1, Math.max(0, (time - lastTime) / 1000)) : 0;
    lastTime = time;
    if (!manualMode) tick(dt);
    requestAnimationFrame(loop);
  }

  canvas.tabIndex = 0;
  canvas.style.outline = 'none';
  setSound(storageRead('toilet-rush-sound') !== 'off');
  $('start-button').addEventListener('click', startGame);
  $('help-button').addEventListener('click', openHelp);
  $('help-close').addEventListener('click', closeHelp);
  $('help-play').addEventListener('click', startGame);
  $('sound-toggle').addEventListener('click', () => { unlockAudio(); setSound(!audio.enabled); });
  $('pause-sound').addEventListener('click', () => { unlockAudio(); setSound(!audio.enabled); });
  $('pause-button').addEventListener('click', togglePause);
  $('survey-pause').addEventListener('click', togglePause);
  $('resume-button').addEventListener('click', togglePause);
  $('skip-button').addEventListener('click', () => { engine.skipCutscene(); updateUI(); });
  document.querySelectorAll('[data-action="restart"]').forEach((button) => button.addEventListener('click', startGame));
  document.querySelectorAll('[data-action="menu"]').forEach((button) => button.addEventListener('click', mainMenu));
  document.querySelector('.brand').addEventListener('click', (event) => { event.preventDefault(); mainMenu(); });

  $('fullscreen-toggle').addEventListener('click', async () => {
    unlockAudio();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (frame.requestFullscreen) await frame.requestFullscreen();
      else showToast('이 브라우저는 전체 화면 버튼을 지원하지 않아요. 가로 화면으로 즐겨주세요.');
    } catch { showToast('전체 화면을 열 수 없어요. 현재 화면에서 계속 플레이할 수 있어요.'); }
  });
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === frame) frame.append($('touch-controls'));
    else frame.after($('touch-controls'));
    $('fullscreen-toggle').setAttribute('aria-label', document.fullscreenElement ? '전체 화면 나가기' : '전체 화면');
  });

  const bindings = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ShiftLeft: 'sprint', ShiftRight: 'sprint', Space: 'jump', KeyE: 'interact' };
  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    unlockAudio();
    if ((event.code === 'Escape' || event.code === 'KeyP') && !event.repeat) { event.preventDefault(); togglePause(); return; }
    if (helpOpen) return;
    if (engine.state === 'SURVEY' && /^Digit[123]$/.test(event.code) && !event.repeat) {
      event.preventDefault(); engine.answerSurvey(Number(event.code.slice(-1)) - 1); updateUI(); return;
    }
    if (engine.state !== 'PLAYING') return;
    const binding = bindings[event.code];
    if (!binding) return;
    event.preventDefault();
    if (binding === 'jump' || binding === 'interact') { if (!held.has(event.code)) keys[binding] = true; }
    else keys[binding] = true;
    held.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
    const binding = bindings[event.code];
    if (binding && binding !== 'jump' && binding !== 'interact') keys[binding] = Object.keys(bindings).some((code) => bindings[code] === binding && held.has(code));
  });
  document.querySelectorAll('[data-input]').forEach((button) => {
    const input = button.dataset.input;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      unlockAudio();
      if (engine.state !== 'PLAYING') return;
      try { button.setPointerCapture(event.pointerId); } catch { /* Synthetic QA input has no active native pointer. */ }
      keys[input] = true;
      button.classList.add('pressed');
    });
    const release = (event) => { event.preventDefault(); if (!['jump', 'interact'].includes(input)) keys[input] = false; button.classList.remove('pressed'); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', () => { if (!['jump', 'interact'].includes(input)) keys[input] = false; button.classList.remove('pressed'); });
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });
  function autoPause() {
    clearInput();
    if (['PLAYING', 'SURVEY', 'TOILET_EVENT'].includes(engine.state)) { engine.pause(); updateUI(); }
  }
  window.addEventListener('blur', autoPause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) autoPause(); });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const dialog = helpOpen ? $('help-screen') : engine.state === 'PAUSED' ? $('pause-screen') : engine.state === 'SURVEY' ? $('survey-screen') : null;
    if (!dialog) return;
    const buttons = [...dialog.querySelectorAll('button:not([disabled])')];
    if (!buttons.length) return;
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.addEventListener('resize', updateUI);
  window.addEventListener('pagehide', (event) => { if (!event.persisted) audio.destroy(); });

  // Explicit QA URL only: deterministic browser tests use the same simulation/render path.
  try { testMode = new URLSearchParams(location.search).get('test') === '1'; } catch {}
  if (testMode) {
    window.__rush = { engine, renderer, audio, tick, start: startGame, menu: mainMenu, sync: updateUI, refreshBest() { best = readBest(); }, setManual(value) { manualMode = !!value; }, clearInput, formatTime };
    const qaScript = document.createElement('script');
    qaScript.src = 'tests/browser.js';
    document.head.append(qaScript);
  }
  updateUI();
  renderer.render(engine, 0);
  requestAnimationFrame(loop);
})();
