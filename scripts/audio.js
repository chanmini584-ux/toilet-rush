/* TOILET RUSH — original, dependency-free miniature synthesizer. */
(function (root) {
  'use strict';

  const midi = (note) => 440 * Math.pow(2, (note - 69) / 12);
  const melodies = {
    menu: [72, 76, 79, 76, 74, 77, 81, 77, 76, 79, 83, 79, 74, 77, 79, null],
    play: [72, null, 76, 79, 81, 79, 76, null, 74, null, 77, 81, 79, 77, 74, null,
      71, null, 74, 77, 79, 77, 74, null, 72, 76, 79, 84, 83, 79, 76, null],
    survey: [76, null, 79, null, 77, null, 74, null, 76, null, 72, null, 74, null, 71, null],
    danger: [72, 75, 79, 84, 83, 79, 75, 71, 72, 75, 79, 86, 84, 79, 75, 71],
    victory: [72, 76, 79, 84, null, 83, 81, 79, 77, 81, 84, 89, 88, 84, 79, null],
    relief: [72, null, 76, null, 79, null, 76, null]
  };

  class RushAudio {
    constructor() {
      this._enabled = true;
      this.context = null;
      this.master = null;
      this.music = null;
      this.effects = null;
      this.voices = new Set();
      this.mode = '';
      this.state = 'MENU';
      this.beat = 0;
      this.nextBeat = 0;
      this.nextFly = 0;
      this._noiseBuffer = null;
      this._unsupported = false;
      this._destroyed = false;
      this._unlocking = null;
    }

    get enabled() { return this._enabled; }
    get unlocked() { return Boolean(this.context && this.context.state === 'running'); }

    async unlock() {
      if (this._destroyed || this._unsupported) return false;
      if (this._unlocking) return this._unlocking;
      this._unlocking = this._unlock();
      try { return await this._unlocking; }
      finally { this._unlocking = null; }
    }

    async _unlock() {
      try {
        if (!this.context) {
          const AudioContext = root.AudioContext || root.webkitAudioContext;
          if (!AudioContext) { this._unsupported = true; return false; }
          const context = new AudioContext();
          this.context = context;
          this.master = context.createGain();
          this.master.gain.value = this._enabled && this.state !== 'PAUSED' ? 0.3 : 0;
          this.music = context.createGain();
          this.effects = context.createGain();
          this.music.gain.value = 0.3;
          this.effects.gain.value = 0.58;
          // A compressor keeps little chords and overlapping effects comfortable.
          const compressor = context.createDynamicsCompressor();
          compressor.threshold.value = -17;
          compressor.knee.value = 18;
          compressor.ratio.value = 5;
          this.compressor = compressor;
          this.music.connect(this.master);
          this.effects.connect(this.master);
          this.master.connect(compressor);
          compressor.connect(context.destination);
          this.nextBeat = context.currentTime + 0.05;
        }
        // Mobile audio interruptions can use an additional non-running state.
        if (this.context.state !== 'running' && this.context.state !== 'closed') await this.context.resume();
        return this.context.state === 'running';
      } catch (_) {
        // Audio must never prevent gameplay (including restricted browser modes).
        return false;
      }
    }

    setEnabled(enabled) {
      this._enabled = Boolean(enabled);
      this._volume();
      if (!this._enabled) this._stopVoices();
      if (this.context) this.nextBeat = this.context.currentTime + 0.04;
    }

    _volume() {
      if (!this.context || !this.master) return;
      const now = this.context.currentTime;
      const value = this._enabled && this.state !== 'PAUSED' ? 0.3 : 0;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(value, now, 0.025);
    }

    _stopVoices(tag) {
      for (const voice of this.voices) {
        if (tag && voice.tag !== tag) continue;
        try { voice.source.stop(); } catch (_) { /* Already ended. */ }
      }
    }

    _track(source, gain, tag, extra = []) {
      const voice = { source, gain, tag, extra };
      this.voices.add(voice);
      source.onended = () => {
        this.voices.delete(voice);
        for (const node of [source, gain, ...extra]) {
          try { node.disconnect(); } catch (_) { /* Disconnected on teardown. */ }
        }
      };
      return voice;
    }

    _tone(frequency, duration = 0.12, volume = 0.2, type = 'sine', delay = 0, tag = 'effect', endFrequency) {
      if (!this.context || this.voices.size >= 64) return;
      const context = this.context;
      const start = context.currentTime + Math.max(0, delay);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(0.025, duration));
      oscillator.connect(gain);
      gain.connect(tag === 'music' ? this.music : this.effects);
      this._track(oscillator, gain, tag);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.035);
    }

    _noise(duration, volume, cutoff = 800, delay = 0, tag = 'effect') {
      if (!this.context || this.voices.size >= 64) return;
      const context = this.context;
      if (!this._noiseBuffer) {
        this._noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.6), context.sampleRate);
        const samples = this._noiseBuffer.getChannelData(0);
        // Fixed sequence: every sound belongs to this game, with no downloaded audio.
        let seed = 9731;
        for (let i = 0; i < samples.length; i++) {
          seed = (seed * 16807) % 2147483647;
          samples[i] = seed / 1073741823.5 - 1;
        }
      }
      const source = context.createBufferSource();
      source.buffer = this._noiseBuffer;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      const gain = context.createGain();
      const start = context.currentTime + delay;
      gain.gain.setValueAtTime(Math.max(0.0002, volume), start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(tag === 'music' ? this.music : this.effects);
      this._track(source, gain, tag, [filter]);
      source.start(start);
      source.stop(start + duration + 0.02);
    }

    _fly() {
      const context = this.context;
      if (!context || this.voices.size >= 60) return;
      const source = context.createOscillator();
      const wobble = context.createOscillator();
      const depth = context.createGain();
      const gain = context.createGain();
      const start = context.currentTime;
      source.type = 'triangle';
      source.frequency.setValueAtTime(172, start);
      source.frequency.linearRampToValueAtTime(207, start + 0.3);
      source.frequency.linearRampToValueAtTime(160, start + 0.65);
      wobble.frequency.value = 35;
      depth.gain.value = 11;
      wobble.connect(depth);
      depth.connect(source.frequency);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.065, start + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.7);
      source.connect(gain);
      gain.connect(this.effects);
      this._track(source, gain, 'effect', [wobble, depth]);
      source.start(start);
      wobble.start(start);
      source.stop(start + 0.72);
      wobble.stop(start + 0.72);
    }

    play(type) {
      if (!this._enabled || !this.unlocked || this.state === 'PAUSED') return;
      const note = (frequency, duration, volume, wave, delay, end) => this._tone(frequency, duration, volume, wave, delay, 'effect', end);
      switch (type) {
        case 'jump':
          note(280, 0.14, 0.2, 'sine', 0, 720);
          note(560, 0.08, 0.055, 'triangle', 0.04, 1100);
          break;
        case 'hit':
          this._noise(0.13, 0.32, 1300);
          note(175, 0.22, 0.28, 'triangle', 0, 65);
          note(420, 0.08, 0.07, 'sine', 0.02, 180);
          break;
        case 'fall':
          note(440, 0.43, 0.22, 'triangle', 0, 75);
          this._noise(0.16, 0.2, 550, 0.32);
          break;
        case 'footstep':
          this._noise(0.045, 0.11, 750);
          note(105, 0.035, 0.12, 'sine', 0, 65);
          break;
        case 'survey':
          [79, 83, 86].forEach((n, i) => note(midi(n), 0.18, 0.16, 'sine', i * 0.09));
          break;
        case 'answer':
          note(660, 0.075, 0.1, 'sine');
          note(880, 0.08, 0.06, 'sine', 0.04);
          break;
        case 'toilet':
          note(140, 0.12, 0.16, 'triangle', 0, 80);
          this._noise(0.22, 0.1, 1000, 0.1);
          note(180, 0.08, 0.15, 'sine', 0.35, 100);
          break;
        case 'relief':
          [72, 76, 79, 84].forEach((n, i) => note(midi(n), 0.32, 0.12, 'sine', i * 0.08));
          this._noise(0.45, 0.08, 1400, 0.08);
          note(380, 0.42, 0.11, 'sine', 0.12, 260);
          break;
        case 'cry':
          [0, 0.32].forEach((delay) => {
            note(610, 0.18, 0.095, 'sine', delay, 460);
            note(480, 0.14, 0.075, 'sine', delay + 0.17, 600);
          });
          break;
        case 'victory':
          [72, 76, 79, 84, 79, 84, 88, 91].forEach((n, i) => note(midi(n), i > 5 ? 0.6 : 0.23, 0.14, 'triangle', i * 0.11));
          this._noise(0.23, 0.1, 4000, 0.79);
          break;
        case 'gameover':
          [76, 75, 74, 68].forEach((n, i) => note(midi(n), i === 3 ? 0.6 : 0.22, 0.15, 'triangle', i * 0.2));
          note(98, 0.45, 0.17, 'sine', 0.6, 65);
          break;
        case 'warning':
          note(880, 0.08, 0.075, 'sine');
          note(660, 0.1, 0.055, 'sine', 0.12);
          break;
        case 'fly': this._fly(); break;
        case 'click': note(560, 0.05, 0.08, 'sine', 0, 720); break;
        default: break;
      }
    }

    update(state = 'MENU', gauge = 25) {
      this.state = state;
      const mode = state === 'PAUSED' ? 'paused'
        : state === 'MENU' ? 'menu'
        : state === 'SURVEY' ? 'survey'
        : state === 'TOILET_EVENT' ? 'relief'
        : state === 'GAME_OVER' || state === 'GAME_OVER_CUTSCENE' ? 'failure'
        : state === 'VICTORY' || state === 'VICTORY_CUTSCENE' ? 'victory'
        : gauge >= 90 ? 'danger' : 'play';
      if (mode !== this.mode) {
        this.mode = mode;
        this.beat = 0;
        this._stopVoices('music');
        this._volume();
        if (this.context) {
          this.nextBeat = this.context.currentTime + 0.04;
          this.nextFly = this.context.currentTime + 1.1;
        }
      }
      if (!this._enabled || !this.unlocked || mode === 'paused') return;
      const now = this.context.currentTime;
      if (mode === 'failure') {
        if (state === 'GAME_OVER' && now >= this.nextFly) {
          this._fly();
          this.nextFly = now + 2.6;
        }
        return;
      }
      // Avoid replaying missed notes after an inactive browser tab resumes.
      if (this.nextBeat < now - 0.15) this.nextBeat = now + 0.03;
      const duration = mode === 'danger' ? 0.16 : mode === 'menu' ? 0.245 : mode === 'survey' ? 0.31 : mode === 'victory' ? 0.25 : 0.235;
      const melody = melodies[mode] || melodies.play;
      while (this.nextBeat < now + 0.13) {
        const step = this.beat % melody.length;
        const delay = Math.max(0, this.nextBeat - now);
        const note = melody[step];
        if (note !== null) {
          this._tone(midi(note), duration * 0.7, mode === 'danger' ? 0.17 : 0.16, 'triangle', delay, 'music');
          // A soft bell overtone brings a toy-piano color to the melody.
          this._tone(midi(note + 12), duration * 0.42, 0.018, 'sine', delay, 'music');
        }
        if (this.beat % 4 === 0) {
          const roots = mode === 'danger' ? [48, 44, 41, 43] : [48, 45, 50, 43];
          const bass = roots[Math.floor(this.beat / 8) % roots.length];
          this._tone(midi(bass), duration * 2.4, 0.26, 'sine', delay, 'music');
          if (mode !== 'survey' && mode !== 'relief') {
            [0, 4, 7].forEach((interval) => this._tone(midi(bass + 12 + interval), duration * 0.7, 0.045, 'triangle', delay + 0.015, 'music'));
          }
        }
        if ((mode === 'play' || mode === 'danger') && this.beat % 2 === 1) {
          this._noise(0.045, 0.035, 3300, delay, 'music');
        }
        this.beat++;
        this.nextBeat += duration;
      }
    }

    async destroy() {
      this._destroyed = true;
      this._stopVoices();
      if (this.context && this.context.state !== 'closed') {
        try { await this.context.close(); } catch (_) { /* Safe teardown. */ }
      }
      this.voices.clear();
      this.context = null;
    }
  }

  root.RushAudio = RushAudio;
  if (typeof module !== 'undefined' && module.exports) module.exports = RushAudio;
})(typeof globalThis !== 'undefined' ? globalThis : window);
