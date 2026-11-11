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

test('gaugeLook: 0~89%에서 lean이 끊김 없이 단조 증가한다', () => {
  for (let g = 0; g < 89; g++) assert.ok(gaugeLook(g + 1).lean >= gaugeLook(g).lean, `gauge ${g}`);
  for (const b of [40, 70, 90]) assert.ok(Math.abs(gaugeLook(b).lean - gaugeLook(b - 0.01).lean) < 0.5, `경계 ${b}`);
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
