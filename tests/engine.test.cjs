const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine, STATES, CONFIG, createLevel } = require('../scripts/engine.js');

function advance(engine, seconds, input = {}) {
  for (let frame = 0; frame < Math.round(seconds * 120); frame++) engine.update(1 / 120, input);
}

test('initial state and restart restore all per-run state', () => {
  const e = new Engine();
  assert.equal(e.state, STATES.MENU);
  e.start();
  advance(e, 1, { right: true });
  assert.ok(e.player.x > 300);
  e.level.toilets[0].used = true;
  e.surveyCompleted = true;
  e.stats.collisions = 4;
  e.start();
  assert.equal(e.gauge, 25);
  assert.equal(e.player.x, 200);
  assert.equal(e.elapsed, 0);
  assert.equal(e.surveyCompleted, false);
  assert.equal(e.level.toilets[0].used, false);
  assert.equal(e.stats.collisions, 0);
});

test('acceleration, gravity, jump cost and one-frame jump pulse', () => {
  const e = new Engine().start();
  e.update(1 / 60, { right: true, jump: true });
  assert.equal(e.stats.jumps, 1);
  assert.ok(e.player.vx > 0 && e.player.vx < CONFIG.walkSpeed);
  assert.ok(e.player.y < CONFIG.groundY);
  advance(e, 1, { right: true });
  assert.equal(e.stats.jumps, 1);
  assert.equal(e.player.y, CONFIG.groundY);
  assert.equal(e.player.grounded, true);
  assert.ok(Math.abs(e.gauge - (25 + 1.5 + e.elapsed * .2)) < 1e-6);
});

test('jump buffer fires after landing and coyote jump works after leaving a ledge', () => {
  const e = new Engine().start();
  e.update(1 / 120, { jump: true });
  advance(e, .7);
  e.update(1 / 120, { jump: true });
  advance(e, .15);
  assert.equal(e.stats.jumps, 2);
  assert.equal(e.player.grounded, false);
  const ledge = new Engine().start();
  ledge.player.x = 3399;
  ledge.player.vx = 180;
  advance(ledge, .08, { right: true });
  assert.equal(ledge.player.grounded, false);
  ledge.update(1 / 120, { right: true, jump: true });
  assert.equal(ledge.stats.jumps, 1);
  assert.ok(ledge.player.vy < 0);
});

test('pause freezes every gameplay timer and resumes the exact survey', () => {
  const e = new Engine().start();
  e.player.x = e.level.surveyX;
  e.update(1 / 120);
  assert.equal(e.state, STATES.SURVEY);
  e.answerSurvey(2);
  const before = { elapsed: e.elapsed, gauge: e.gauge, x: e.player.x, stateTime: e.stateTime };
  e.pause();
  advance(e, 5, { right: true, jump: true, interact: true });
  assert.equal(e.elapsed, before.elapsed);
  assert.equal(e.gauge, before.gauge);
  assert.equal(e.player.x, before.x);
  assert.equal(e.answerSurvey(0), false);
  e.resume();
  assert.equal(e.state, STATES.SURVEY);
  assert.equal(e.surveyIndex, 1);
  assert.equal(e.stateTime, before.stateTime);
  advance(e, 2);
  assert.ok(Math.abs(e.gauge - before.gauge - .4) < 1e-6);
  e.answerSurvey(0);
  e.answerSurvey(1);
  assert.equal(e.state, STATES.PLAYING);
  assert.equal(e.surveyCompleted, true);
  advance(e, .1, { left: true });
  advance(e, 1, { right: true });
  assert.equal(e.state, STATES.PLAYING);
});

test('toilets recover exactly once, clamp at zero, freeze gauge and preserve paused event timing', () => {
  const e = new Engine().start();
  e.player.x = e.level.toilets[0].x;
  e.gauge = 95;
  assert.equal(e.useToilet(), true);
  advance(e, .5);
  assert.equal(e.gauge, 95);
  const eventTime = e.stateTime;
  e.pause();
  advance(e, 2);
  e.resume();
  assert.equal(e.state, STATES.TOILET_EVENT);
  assert.equal(e.stateTime, eventTime);
  advance(e, .6);
  assert.equal(e.gauge, 60);
  assert.equal(e.emotion, 'worried');
  advance(e, 1.2);
  assert.equal(e.state, STATES.PLAYING);
  assert.equal(e.stats.toilets, 1);
  assert.equal(e.useToilet(), false);
  e.player.x = e.level.toilets[1].x;
  e.gauge = 10;
  assert.equal(e.useToilet(), true);
  advance(e, 1.1);
  assert.equal(e.gauge, 0);
});

test('collision grants invincibility; falling returns to safe ground', () => {
  const e = new Engine().start();
  e.player.x = 1255;
  e.update(1 / 120);
  assert.equal(e.stats.collisions, 1);
  const gauge = e.gauge;
  advance(e, .5);
  assert.equal(e.stats.collisions, 1);
  assert.ok(e.gauge < gauge + .2);
  const pit = new Engine().start();
  pit.player.x = 3440;
  advance(pit, .6);
  assert.equal(pit.stats.falls, 1);
  assert.equal(pit.player.y, CONFIG.groundY);
  assert.ok(pit.player.x < 3400);
  assert.ok(pit.gauge >= 43);
});

test('sprint trades time for gauge and puddles reduce braking', () => {
  const walk = new Engine().start();
  const sprint = new Engine().start();
  advance(walk, 2, { right: true });
  advance(sprint, 2, { right: true, sprint: true });
  assert.ok(sprint.player.x > walk.player.x + 200);
  assert.ok(sprint.gauge > walk.gauge + .9);
  walk.player.x = 2300;
  walk.player.vx = 180;
  walk.update(.05);
  assert.ok(walk.player.vx > 150);
  assert.equal(walk.slippery, true);
});

test('100% during survey fails immediately, freezes gameplay and reaches restartable game over', () => {
  const e = new Engine().start();
  e.player.x = e.level.surveyX;
  e.update(1 / 120);
  e.gauge = 99.99;
  advance(e, .1);
  assert.equal(e.state, STATES.GAME_OVER_CUTSCENE);
  const elapsed = e.elapsed;
  const x = e.player.x;
  advance(e, 4, { right: true, jump: true });
  assert.equal(e.state, STATES.GAME_OVER);
  assert.equal(e.elapsed, elapsed);
  assert.equal(e.gauge, 100);
  assert.equal(e.player.x, x);
  assert.equal(e.player.vx, 0);
  e.start();
  assert.equal(e.state, STATES.PLAYING);
  assert.equal(e.gauge, 25);
});

test('fatal jump and fatal collision stop movement before survey or victory can trigger', () => {
  const jumpEvents = [];
  const jump = new Engine({ onEvent: (name) => jumpEvents.push(name) }).start();
  jump.player.x = jump.level.homeX - 1;
  jump.player.vx = 300;
  jump.surveyCompleted = true;
  jump.gauge = 98.5;
  jump.update(.1, { right: true, sprint: true, jump: true });
  assert.equal(jump.state, STATES.GAME_OVER_CUTSCENE);
  assert.equal(jump.player.x, jump.level.homeX - 1);
  assert.equal(jump.player.vx, 0);
  assert.equal(jump.player.vy, 0);
  assert.equal(jump.result, null);
  assert.equal(jumpEvents.includes('victory'), false);

  const hitEvents = [];
  const hit = new Engine({ onEvent: (name) => hitEvents.push(name) }).start();
  hit.player.x = hit.level.surveyX;
  // A focused regression fixture puts a fatal collision on the event boundary.
  hit.level.obstacles.push({ id: 'test-boundary', type: 'barrier', x: hit.level.surveyX - 10, w: 54, h: 50 });
  hit.gauge = 90;
  hit.update(.1, { right: true, sprint: true });
  assert.equal(hit.state, STATES.GAME_OVER_CUTSCENE);
  assert.equal(hit.gauge, 100);
  assert.equal(hitEvents.filter((name) => name === 'gameover').length, 1);
  assert.equal(hitEvents.includes('survey'), false);
  assert.equal(hit.surveyCompleted, false);
});

test('sprint boundary triggers survey exactly once even with a 100 ms frame', () => {
  let surveyCount = 0;
  const e = new Engine({ onEvent: (name) => { if (name === 'survey') surveyCount++; } }).start();
  e.player.x = e.level.surveyX - 2;
  e.player.vx = 300;
  e.update(.1, { right: true, sprint: true });
  assert.equal(e.state, STATES.SURVEY);
  assert.equal(e.player.x, e.level.surveyX);
  advance(e, .5, { right: true, jump: true, interact: true });
  assert.equal(e.player.x, e.level.surveyX);
  e.answerSurvey(2); e.answerSurvey(2); e.answerSurvey(2);
  advance(e, 1, { left: true });
  advance(e, 2, { right: true, sprint: true });
  assert.equal(e.state, STATES.PLAYING);
  assert.equal(surveyCount, 1);
});

test('100 ms frames match 120 Hz physics and do not repeat a jump input', () => {
  const high = new Engine().start();
  const low = new Engine().start();
  high.update(1 / 120, { right: true, jump: true });
  low.update(.1, { right: true, jump: true });
  for (let i = 1; i < 240; i++) high.update(1 / 120, { right: true });
  for (let i = 1; i < 20; i++) low.update(.1, { right: true });
  for (const key of ['x', 'y', 'vx', 'vy']) assert.ok(Math.abs(high.player[key] - low.player[key]) < 1e-6, key);
  assert.ok(Math.abs(high.gauge - low.gauge) < 1e-6);
  assert.ok(Math.abs(high.elapsed - low.elapsed) < 1e-6);
  assert.equal(low.stats.jumps, 1);
});

test('pause after toilet recovery cannot award the recovery twice', () => {
  let recoveries = 0;
  const e = new Engine({ onEvent: (name) => { if (name === 'relief') recoveries++; } }).start();
  e.player.x = e.level.toilets[0].x;
  e.gauge = 95;
  e.useToilet();
  advance(e, 1.2);
  assert.equal(e.gauge, 60);
  e.pause();
  advance(e, 5);
  e.resume();
  advance(e, 1);
  assert.equal(e.stats.toilets, 1);
  assert.equal(recoveries, 1);
  assert.ok(e.gauge >= 60);
});

test('all movement, jump, interaction, survey and pause inputs stay frozen after defeat', () => {
  const e = new Engine().start();
  e.gauge = 99.999;
  e.update(.1);
  const frozen = { x: e.player.x, y: e.player.y, elapsed: e.elapsed, gauge: e.gauge, stats: { ...e.stats } };
  for (const terminal of [STATES.GAME_OVER_CUTSCENE, STATES.GAME_OVER]) {
    assert.equal(e.state, terminal);
    e.update(.1, { left: true, right: true, jump: true, sprint: true, interact: true });
    assert.equal(e.pause(), false);
    assert.equal(e.resume(), false);
    assert.equal(e.useToilet(), false);
    assert.equal(e.answerSurvey(1), false);
    assert.equal(e.player.x, frozen.x);
    assert.equal(e.player.y, frozen.y);
    assert.equal(e.elapsed, frozen.elapsed);
    assert.equal(e.gauge, frozen.gauge);
    assert.deepEqual(e.stats, frozen.stats);
    if (terminal === STATES.GAME_OVER_CUTSCENE) e.skipCutscene();
  }
});

test('level contains every obstacle kind, two toilets, safe event areas and jumpable pits', () => {
  const level = createLevel();
  assert.deepEqual(new Set(level.obstacles.map((o) => o.type)), new Set(['barrier', 'pit', 'pedestrian', 'puddle']));
  assert.equal(level.toilets.length, 2);
  for (const pit of level.obstacles.filter((o) => o.type === 'pit')) assert.ok(pit.w <= 110);
  for (const location of [...level.toilets.map((t) => t.x), level.surveyX]) {
    assert.ok(level.obstacles.every((o) => Math.abs(o.x - location) > 500));
  }
});

// This bot uses only ordinary input: no position, gauge, velocity, or level mutation.
// It sees nearby hazards, jumps, answers the survey, and presses E at both toilets.
function playRoute({ sprint = false, deliberateHits = 0, fps = 120 } = {}) {
  const events = [];
  const e = new Engine({ onEvent: (name) => events.push(name) }).start();
  let frames = 0;
  while ([STATES.PLAYING, STATES.SURVEY, STATES.TOILET_EVENT].includes(e.state) && frames < fps * 360) {
    if (e.state === STATES.SURVEY) e.answerSurvey(2);
    const p = e.player;
    const speed = sprint ? 300 : 180;
    const next = e.level.obstacles.find((o) => o.type !== 'puddle' && o.x + o.w > p.x - 10 && o.x - p.x < 200);
    let jump = false;
    if (next && p.grounded) {
      const isPit = next.type === 'pit';
      const threshold = isPit ? (sprint ? 66 : 30) : (sprint ? 72 : 36);
      jump = next.x - p.x <= threshold && next.x + next.w > p.x;
      if (e.stats.collisions < deliberateHits && next.type === 'barrier') jump = false;
    }
    e.update(1 / fps, { right: true, sprint, jump, interact: !!e.nearToilet });
    frames++;
  }
  return { e, events, frames };
}

test('complete normal route reaches victory in 3–5 minutes with survey and both toilets', () => {
  const { e, events } = playRoute();
  assert.equal(e.state, STATES.VICTORY_CUTSCENE, `ended ${e.state}, x=${e.player.x}, gauge=${e.gauge}, collisions=${e.stats.collisions}`);
  assert.ok(e.elapsed >= 180 && e.elapsed <= 300, e.elapsed);
  assert.equal(e.surveyCompleted, true);
  assert.equal(events.filter((name) => name === 'survey').length, 1);
  assert.equal(e.stats.toilets, 2);
  assert.equal(e.stats.falls, 0);
  assert.ok(e.gauge < 100);
  assert.ok(e.result.jumps > 15);
  const before = e.elapsed;
  advance(e, 4);
  assert.equal(e.state, STATES.VICTORY);
  assert.equal(e.elapsed, before);
  console.log('Normal route:', JSON.stringify(e.result));
});

test('two deliberate mistakes remain recoverable on the normal route', () => {
  const { e } = playRoute({ deliberateHits: 2 });
  assert.equal(e.state, STATES.VICTORY_CUTSCENE, `ended ${e.state}, x=${e.player.x}, gauge=${e.gauge}`);
  assert.ok(e.stats.collisions >= 2);
  assert.ok(e.gauge < 100);
});

test('sprint route is faster and full route stays consistent at 30 FPS', () => {
  const { e: fast } = playRoute({ sprint: true });
  assert.equal(fast.state, STATES.VICTORY_CUTSCENE, `sprint ended ${fast.state} x=${fast.player.x}, gauge=${fast.gauge}, hits=${fast.stats.collisions}`);
  assert.ok(fast.elapsed < 180);
  const { e: lowFps } = playRoute({ fps: 30 });
  assert.equal(lowFps.state, STATES.VICTORY_CUTSCENE, `30fps ended ${lowFps.state}, x=${lowFps.player.x}, gauge=${lowFps.gauge}`);
  assert.equal(lowFps.stats.falls, 0);
  console.log('Sprint route:', JSON.stringify(fast.result));
  console.log('30 FPS route:', JSON.stringify(lowFps.result));
});
