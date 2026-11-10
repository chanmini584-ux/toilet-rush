/* TOILET RUSH — deterministic simulation; no DOM, storage, or audio dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ToiletRush = Object.assign(root.ToiletRush || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STATES = Object.freeze(Object.fromEntries([
    'MENU', 'PLAYING', 'SURVEY', 'TOILET_EVENT', 'PAUSED',
    'GAME_OVER_CUTSCENE', 'GAME_OVER', 'VICTORY_CUTSCENE', 'VICTORY'
  ].map((state) => [state, state])));
  const CONFIG = Object.freeze({
    groundY: 576, totalLength: 42000, walkSpeed: 180, sprintSpeed: 300,
    acceleration: 1300, deceleration: 1550, gravity: 1700, jumpVelocity: 650,
    coyoteTime: 0.11, jumpBuffer: 0.14, invincibility: 1.5,
    initialGauge: 25, gaugePerSecond: 0.2, sprintGaugePerSecond: 0.5,
    jumpCost: 1.5, hitCost: 10, fallCost: 18, toiletRecovery: 35,
    toiletDuration: 2.2, toiletRecoveryTime: 1.05, cutsceneDuration: 3.1
  });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const approach = (value, target, amount) => value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);

  function createLevel() {
    let id = 0;
    const obstacles = [];
    const add = (type, x, w, h, extra) => obstacles.push(Object.assign({ id: 'obstacle-' + (++id), type, x, w, h: h || 0, y: CONFIG.groundY }, extra));
    add('barrier', 1250, 54, 42);
    add('puddle', 2250, 240, 5);
    add('pit', 3400, 90);
    add('barrier', 4600, 58, 48);
    add('pedestrian', 5700, 40, 70, { baseX: 5700, range: 75, speed: 0.65, phase: 0.6 });
    add('barrier', 7000, 62, 48);
    add('pit', 8500, 96);
    add('puddle', 9450, 240, 5);
    add('barrier', 10600, 64, 50);
    add('pedestrian', 11600, 40, 70, { baseX: 11600, range: 70, speed: 0.8, phase: 1.2 });
    add('barrier', 14900, 68, 52);
    add('pit', 15800, 100);
    add('pedestrian', 16900, 40, 70, { baseX: 16900, range: 85, speed: 0.75, phase: 2 });
    add('barrier', 19200, 62, 50);
    add('puddle', 19900, 280, 5);
    add('pit', 21200, 104);
    add('barrier', 22600, 68, 54);
    add('pedestrian', 23700, 40, 70, { baseX: 23700, range: 80, speed: 0.9, phase: 1 });
    add('barrier', 24800, 52, 46);
    add('barrier', 25020, 52, 46);
    add('pit', 26600, 108);
    add('barrier', 29800, 66, 54);
    add('pedestrian', 30800, 40, 70, { baseX: 30800, range: 85, speed: 0.8, phase: 2.8 });
    add('pit', 32000, 108);
    add('puddle', 33000, 300, 5);
    add('barrier', 34100, 52, 48);
    add('barrier', 34320, 52, 48);
    add('pedestrian', 35600, 40, 70, { baseX: 35600, range: 90, speed: 0.85, phase: 0.5 });
    add('pit', 36700, 110);
    add('barrier', 38000, 68, 54);
    add('pedestrian', 39300, 40, 70, { baseX: 39300, range: 75, speed: 0.8, phase: 1.6 });
    add('pit', 40300, 110);
    return {
      length: CONFIG.totalLength, groundY: CONFIG.groundY, homeX: 41900,
      surveyX: 18000, obstacles,
      toilets: [{ id: 'toilet-1', x: 13000, used: false }, { id: 'toilet-2', x: 28500, used: false }],
      stages: [{ x: 0, name: '골목길' }, { x: 14000, name: '번화가' }, { x: 28000, name: '집 앞 마지막 질주' }]
    };
  }

  class Engine {
    constructor(options) {
      this.onEvent = (options && options.onEvent) || function () {};
      this._reset();
      this.state = STATES.MENU;
    }

    _reset() {
      this.level = createLevel();
      this.player = { x: 200, y: CONFIG.groundY, vx: 0, vy: 0, w: 40, h: 76,
        grounded: true, facing: 1, invincible: 0, landTimer: 0, animation: 'idle' };
      this.gauge = CONFIG.initialGauge;
      this.displayGauge = this.gauge;
      this.elapsed = 0;
      this.animationTime = 0;
      this.cameraX = 0;
      this.cameraShake = 0;
      this.stateTime = 0;
      this.stats = { jumps: 0, collisions: 0, toilets: 0, falls: 0 };
      this.effects = [];
      this.result = null;
      this.surveyIndex = 0;
      this.surveyCompleted = false;
      this.surveyAnswers = [];
      this.activeToilet = null;
      this.toiletRecovered = false;
      this.checkpoint = 200;
      this.sprinting = false;
      this.slippery = false;
      this._coyote = CONFIG.coyoteTime;
      this._jumpBuffer = 0;
      this._footstep = 0;
      this._dust = 0;
      this._warningBand = 0;
      this._pausedFrom = null;
      this._pausedTime = 0;
      this._previousStage = 1;
    }

    get stage() { return this.player.x >= 28000 ? 3 : this.player.x >= 14000 ? 2 : 1; }
    get progress() { return clamp((this.player.x - 200) / (this.level.homeX - 200), 0, 1); }
    get remainingDistance() { return Math.max(0, this.level.homeX - this.player.x); }
    get nearToilet() {
      return this.level.toilets.find((toilet) => !toilet.used && Math.abs(this.player.x - toilet.x) < 125) || null;
    }
    get emotion() { return this.gauge >= 90 ? 'desperate' : this.gauge >= 70 ? 'crying' : this.gauge >= 40 ? 'worried' : 'normal'; }

    _emit(type, payload) { this.onEvent(type, payload || {}); }
    _setState(state) {
      const previous = this.state;
      this.state = state;
      this.stateTime = 0;
      this._emit('state', { state, previous });
    }
    start() { this._reset(); this._setState(STATES.PLAYING); return this; }
    menu() { this._reset(); this._setState(STATES.MENU); return this; }
    pause() {
      if (![STATES.PLAYING, STATES.SURVEY, STATES.TOILET_EVENT].includes(this.state)) return false;
      this._pausedFrom = this.state;
      this._pausedTime = this.stateTime;
      this._setState(STATES.PAUSED);
      return true;
    }
    resume() {
      if (this.state !== STATES.PAUSED) return false;
      const target = this._pausedFrom || STATES.PLAYING;
      const time = this._pausedTime;
      this._setState(target);
      this.stateTime = time;
      this._pausedFrom = null;
      return true;
    }
    answerSurvey(index) {
      if (this.state !== STATES.SURVEY || !Number.isInteger(index) || index < 0 || index > 2) return false;
      this.surveyAnswers.push(index);
      this.surveyIndex++;
      this._emit('answer', { index, question: this.surveyIndex });
      if (this.surveyIndex >= 3) {
        this.surveyCompleted = true;
        this.player.invincible = 0.65;
        this._setState(STATES.PLAYING);
        this._emit('surveyComplete', { message: '참여해 주셔서 감사합니다!' });
      }
      return true;
    }
    useToilet() {
      if (this.state !== STATES.PLAYING || !this.player.grounded) return false;
      const toilet = this.nearToilet;
      if (!toilet) return false;
      toilet.used = true;
      this.activeToilet = toilet;
      this.toiletRecovered = false;
      this.player.x = toilet.x;
      this.player.vx = this.player.vy = 0;
      this.sprinting = false;
      this._jumpBuffer = 0;
      this._setState(STATES.TOILET_EVENT);
      this._emit('toilet', { toilet });
      return true;
    }
    skipCutscene() {
      if (this.state === STATES.GAME_OVER_CUTSCENE) { this._setState(STATES.GAME_OVER); return true; }
      if (this.state === STATES.VICTORY_CUTSCENE) { this._setState(STATES.VICTORY); return true; }
      return false;
    }
    _effect(type, x, y, duration, extra) {
      this.effects.push(Object.assign({ type, x, y, life: duration, maxLife: duration }, extra));
      if (this.effects.length > 100) this.effects.shift();
    }
    _addGauge(amount) {
      this.gauge = clamp(this.gauge + amount, 0, 100);
      const band = this.gauge >= 90 ? 2 : this.gauge >= 70 ? 1 : 0;
      if (band > this._warningBand) this._emit('warning', { gauge: this.gauge, band });
      this._warningBand = band;
      if (this.gauge >= 100) this._fail();
    }
    _fail() {
      if (![STATES.PLAYING, STATES.SURVEY, STATES.TOILET_EVENT].includes(this.state)) return;
      this.player.vx = this.player.vy = 0;
      this.player.y = CONFIG.groundY;
      this.player.grounded = true;
      this.player.animation = 'collapse';
      this.sprinting = false;
      this._jumpBuffer = 0;
      this._setState(STATES.GAME_OVER_CUTSCENE);
      this._emit('gameover');
      this._emit('cry');
    }
    _win() {
      const rank = this.stats.collisions <= 1 && this.elapsed <= 195 && this.gauge < 95 ? 'S'
        : this.stats.collisions <= 3 && this.elapsed <= 270 ? 'A'
        : this.stats.collisions <= 6 && this.elapsed <= 330 ? 'B' : 'C';
      this.result = { time: this.elapsed, gauge: this.gauge, collisions: this.stats.collisions,
        jumps: this.stats.jumps, toilets: this.stats.toilets, rank };
      this.player.x = this.level.homeX;
      this.player.vx = this.player.vy = 0;
      this.player.y = CONFIG.groundY;
      this.sprinting = false;
      this._setState(STATES.VICTORY_CUTSCENE);
      this._emit('victory', this.result);
    }

    update(dt, input) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      input = input || {};
      // One input pulse may span many simulation substeps, but creates one jump.
      if (this.state === STATES.PLAYING && input.jump) this._jumpBuffer = CONFIG.jumpBuffer;
      if (this.state === STATES.PLAYING && input.interact) this.useToilet();
      let remaining = Math.min(dt, 0.25);
      while (remaining > 1e-8) {
        const step = Math.min(remaining, 1 / 120);
        this._step(step, input);
        remaining -= step;
      }
    }

    _step(dt, input) {
      if (this.state === STATES.PAUSED) return;
      this.animationTime += dt;
      this.stateTime += dt;
      this.displayGauge += (this.gauge - this.displayGauge) * (1 - Math.exp(-8 * dt));
      this.cameraShake = Math.max(0, this.cameraShake - dt * 12);
      for (const effect of this.effects) effect.life -= dt;
      this.effects = this.effects.filter((effect) => effect.life > 0);

      if (this.state === STATES.GAME_OVER_CUTSCENE || this.state === STATES.VICTORY_CUTSCENE) {
        if (this.stateTime >= CONFIG.cutsceneDuration) this.skipCutscene();
        return;
      }
      if (![STATES.PLAYING, STATES.SURVEY, STATES.TOILET_EVENT].includes(this.state)) return;

      this.elapsed += dt;
      if (this.state === STATES.SURVEY) {
        this._addGauge(CONFIG.gaugePerSecond * dt);
        return;
      }
      if (this.state === STATES.TOILET_EVENT) {
        if (!this.toiletRecovered && this.stateTime >= CONFIG.toiletRecoveryTime) {
          this.toiletRecovered = true;
          this.stats.toilets++;
          this._addGauge(-CONFIG.toiletRecovery);
          this._effect('relief', this.player.x, this.player.y - 95, 1.3);
          this._emit('relief', { gauge: this.gauge });
        }
        if (this.stateTime >= CONFIG.toiletDuration) {
          this.player.invincible = 0.8;
          this.activeToilet = null;
          this._setState(STATES.PLAYING);
        }
        return;
      }

      const p = this.player;
      p.invincible = Math.max(0, p.invincible - dt);
      p.landTimer = Math.max(0, p.landTimer - dt);
      this._jumpBuffer = Math.max(0, this._jumpBuffer - dt);
      this._coyote = p.grounded ? CONFIG.coyoteTime : Math.max(0, this._coyote - dt);
      this.slippery = p.grounded && this.level.obstacles.some((o) => o.type === 'puddle' && p.x > o.x && p.x < o.x + o.w);
      const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      this.sprinting = !!(input.sprint && direction && Math.abs(p.vx) > 40);
      const speed = input.sprint ? CONFIG.sprintSpeed : CONFIG.walkSpeed;
      const acceleration = direction ? CONFIG.acceleration : CONFIG.deceleration;
      p.vx = approach(p.vx, direction * speed, acceleration * (this.slippery ? 0.19 : 1) * dt);
      if (direction) p.facing = direction;
      this._addGauge((CONFIG.gaugePerSecond + (this.sprinting ? CONFIG.sprintGaugePerSecond : 0)) * dt);
      if (this.state !== STATES.PLAYING) return;

      if (this._jumpBuffer > 0 && this._coyote > 0) {
        p.vy = -CONFIG.jumpVelocity;
        p.grounded = false;
        this._coyote = this._jumpBuffer = 0;
        this.stats.jumps++;
        this._addGauge(CONFIG.jumpCost);
        this._effect('jump', p.x, p.y, 0.4);
        this._emit('jump');
        if (this.state !== STATES.PLAYING) return;
      }

      const previousY = p.y;
      const wasGrounded = p.grounded;
      p.x = clamp(p.x + p.vx * dt, 26, this.level.homeX + 20);
      p.vy += CONFIG.gravity * dt;
      p.y += p.vy * dt;
      const pit = this.level.obstacles.find((o) => o.type === 'pit' && p.x > o.x + 7 && p.x < o.x + o.w - 7);
      if (!pit && p.vy >= 0 && previousY <= CONFIG.groundY + 5 && p.y >= CONFIG.groundY) {
        p.y = CONFIG.groundY;
        p.vy = 0;
        p.grounded = true;
        if (!wasGrounded) { p.landTimer = 0.13; this._effect('land', p.x, p.y, 0.35); this._emit('land'); }
      } else if (pit || p.y < CONFIG.groundY) {
        p.grounded = false;
      }
      if (p.y > CONFIG.groundY + 190) {
        this.stats.collisions++;
        this.stats.falls++;
        this._addGauge(CONFIG.fallCost);
        if (this.state !== STATES.PLAYING) return;
        p.x = this.checkpoint;
        p.y = CONFIG.groundY;
        p.vx = p.vy = 0;
        p.grounded = true;
        p.invincible = CONFIG.invincibility;
        this._coyote = CONFIG.coyoteTime;
        this.cameraShake = 6;
        this._effect('hit', p.x, p.y - 65, 0.8);
        this._emit('fall');
      }

      for (const obstacle of this.level.obstacles) {
        if (obstacle.type === 'pedestrian') obstacle.x = obstacle.baseX + Math.sin(this.elapsed * obstacle.speed + obstacle.phase) * obstacle.range;
        if (obstacle.type !== 'barrier' && obstacle.type !== 'pedestrian') continue;
        const horizontal = p.x + p.w * 0.36 > obstacle.x + 4 && p.x - p.w * 0.36 < obstacle.x + obstacle.w - 4;
        const vertical = p.y - 7 > CONFIG.groundY - obstacle.h && p.y - p.h + 8 < CONFIG.groundY;
        if (p.invincible <= 0 && horizontal && vertical) {
          this.stats.collisions++;
          p.invincible = CONFIG.invincibility;
          p.vx *= 0.36;
          this.cameraShake = 5;
          p.animation = 'hit';
          this._addGauge(CONFIG.hitCost);
          this._effect('hit', p.x, p.y - 60, 0.7);
          this._emit('hit', { obstacle });
          if (this.state !== STATES.PLAYING) return;
        }
      }

      if (p.grounded) {
        // Store only clear ground, always at least a complete jump before a pit.
        const safe = !this.level.obstacles.some((o) => o.type !== 'puddle' && p.x > o.x - 220 && p.x < o.x + o.w + 140);
        if (safe && p.x > this.checkpoint + 180) this.checkpoint = p.x;
      }
      p.animation = p.invincible > CONFIG.invincibility - 0.3 ? 'hit'
        : !p.grounded ? 'jump' : p.landTimer > 0 ? 'land'
        : Math.abs(p.vx) > 240 ? 'sprint' : Math.abs(p.vx) > 12 ? 'run' : 'idle';
      if (p.grounded && Math.abs(p.vx) > 50) {
        this._footstep += dt;
        this._dust += dt;
        if (this._footstep > (this.sprinting ? 0.19 : 0.27)) { this._footstep = 0; this._emit('footstep'); }
        if (this._dust > 0.14) { this._dust = 0; this._effect('dust', p.x - p.facing * 16, p.y - 2, 0.55, { facing: p.facing }); }
      }
      const targetCamera = clamp(p.x - 330, 0, this.level.length - 1280);
      this.cameraX += (targetCamera - this.cameraX) * (1 - Math.exp(-6 * dt));
      if (this.stage !== this._previousStage) { this._previousStage = this.stage; this._emit('stage', { stage: this.stage }); }

      if (!this.surveyCompleted && p.x >= this.level.surveyX) {
        p.x = this.level.surveyX;
        p.y = CONFIG.groundY;
        p.vx = p.vy = 0;
        p.grounded = true;
        this.sprinting = false;
        this._jumpBuffer = 0;
        this._setState(STATES.SURVEY);
        this._emit('survey');
      } else if (p.x >= this.level.homeX && this.gauge < 100 && this.surveyCompleted) {
        this._win();
      }
    }
  }

  return { Engine, STATES, CONFIG, createLevel };
});
