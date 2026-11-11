'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { gaugeLook, tint } = require('../scripts/hero.js');

test('gaugeLook: 감정 구간 경계가 스펙(0/40/70/90)과 같다', () => {
  assert.equal(gaugeLook(0).tier, 0);
  assert.equal(gaugeLook(39.9).tier, 0);
  assert.equal(gaugeLook(40).tier, 1);
  assert.equal(gaugeLook(70).tier, 2);
  assert.equal(gaugeLook(90).tier, 3);
});

test('gaugeLook: 게이지가 오를수록 몸이 굽는 각도가 줄지 않는다(폭발 직전 제외)', () => {
  assert.ok(gaugeLook(55).lean > gaugeLook(10).lean);
  assert.ok(gaugeLook(80).lean > gaugeLook(55).lean);
});

test('tint: 70~89%에서 피부가 점점 붉어진다(초록 채널 감소)', () => {
  const g = n => parseInt(tint(n).slice(3, 5), 16);
  for (let p = 70; p < 89; p++) assert.ok(g(p + 1) <= g(p), `gauge ${p}`);
  assert.ok(g(89) < g(70));
});

test('tint: 경계(39→40, 69→70, 89→90)에서 색이 튀지 않는다', () => {
  const ch = (n, i) => parseInt(tint(n).slice(1 + i * 2, 3 + i * 2), 16);
  for (const b of [40, 70, 90]) for (let i = 0; i < 3; i++) assert.ok(Math.abs(ch(b, i) - ch(b - 1, i)) <= 4, `${b}/${i}`);
});
