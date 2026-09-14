// Chiptune audio: everything is synthesised with WebAudio, so the game
// ships zero audio assets and still has real music. Three voices, roughly
// a DS sound-chip's worth: two pulse leads, one triangle bass, one noise
// percussion channel.
//
// Songs are plain data (see data/music.js) so new tracks are content, not
// code. A song is { bpm, loop, channels: { lead, harmony, bass, drums } }
// where each channel is a string of space-separated tokens:
//   "C4:2"  note C octave 4, 2 sixteenths      "-:4" rest for 4
//   "|"     bar separator (ignored, readability only)

const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function noteToFreq(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) return 0;
  const semitone = NOTE_INDEX[m[1]] + (parseInt(m[2], 10) + 1) * 12;
  return 440 * Math.pow(2, (semitone - 69) / 12);
}

function parseChannel(str) {
  const out = [];
  let at = 0;
  for (const tok of str.split(/\s+/)) {
    if (!tok || tok === '|') continue;
    const [note, lenStr] = tok.split(':');
    const len = parseInt(lenStr || '1', 10);
    if (note !== '-') out.push({ at, len, freq: noteToFreq(note) });
    at += len;
  }
  return { events: out, length: at };
}

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.unlocked = false;
    this.musicVolume = 0.35;
    this.sfxVolume = 0.5;
    this.enabled = true;
    this.current = null;      // { song, name }
    this.timer = null;
    this._parsed = new Map();
    this._pulseWaves = null;
  }

  // Mobile browsers only allow audio after a real gesture. main.js calls
  // this from the first touch/keypress.
  unlock() {
    if (this.unlocked) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.enabled ? this.musicVolume : 0;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.enabled ? this.sfxVolume : 0;
      this.sfxGain.connect(this.master);

      // A room for the sound to happen in.
      //
      // Every effect was going straight to the speaker completely dry, which
      // is what makes small synthesised sounds feel like a webpage rather than
      // a game. This is a short feedback delay — two taps of about a tenth of
      // a second, rolled off at the top — mixed in well under the dry signal.
      // It is not a reverb and is not trying to be: it is the difference
      // between a beep and a beep in a place.
      this.echo = this.ctx.createDelay(0.5);
      this.echo.delayTime.value = 0.105;
      const echoBack = this.ctx.createGain();
      echoBack.gain.value = 0.28;
      const echoTone = this.ctx.createBiquadFilter();
      echoTone.type = 'lowpass';
      echoTone.frequency.value = 2600;
      this.echoSend = this.ctx.createGain();
      this.echoSend.gain.value = 0.16;
      this.echoSend.connect(this.echo);
      this.echo.connect(echoTone);
      echoTone.connect(echoBack);
      echoBack.connect(this.echo);
      echoTone.connect(this.master);
      this._buildWaves();
      this.unlocked = true;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.current) this._schedule();
    } catch (err) {
      console.warn('[audio] unavailable', err);
    }
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // Pulse waves at two duty cycles give the classic "lead + counter-lead" pair.
  _buildWaves() {
    const make = (duty) => {
      const n = 32;
      const real = new Float32Array(n);
      const imag = new Float32Array(n);
      for (let i = 1; i < n; i++) {
        imag[i] = (2 / (i * Math.PI)) * Math.sin(Math.PI * i * duty);
      }
      return this.ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    };
    this._pulseWaves = { half: make(0.5), quarter: make(0.25), eighth: make(0.125) };
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.unlocked) return;
    this.musicGain.gain.value = on ? this.musicVolume : 0;
    this.sfxGain.gain.value = on ? this.sfxVolume : 0;
  }

  setMusicVolume(v) {
    this.musicVolume = v;
    if (this.unlocked && this.enabled) this.musicGain.gain.value = v;
  }

  _parse(song) {
    if (this._parsed.has(song)) return this._parsed.get(song);
    const p = {};
    let bars = 0;
    for (const [ch, str] of Object.entries(song.channels)) {
      p[ch] = parseChannel(str);
      bars = Math.max(bars, p[ch].length);
    }
    const out = { channels: p, length: bars };
    this._parsed.set(song, out);
    return out;
  }

  playMusic(song, name) {
    if (this.current && this.current.name === name) return;
    this.stopMusic();
    this.current = song ? { song, name } : null;
    if (song && this.unlocked) this._schedule();
  }

  stopMusic() {
    this.current = null;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
  }

  // Re-schedules one loop of the song at a time. Simple, and drift-free
  // because every note is placed on the AudioContext clock.
  _schedule() {
    if (!this.current || !this.unlocked) return;
    const { song } = this.current;
    const parsed = this._parse(song);
    const sixteenth = 60 / song.bpm / 4;
    const start = this.ctx.currentTime + 0.06;

    const voices = {
      lead: { wave: 'half', gain: 0.22, glide: 0 },
      harmony: { wave: 'quarter', gain: 0.13, glide: 0 },
      bass: { wave: 'tri', gain: 0.28, glide: 0 },
      drums: { wave: 'noise', gain: 0.20, glide: 0 },
    };

    for (const [ch, data] of Object.entries(parsed.channels)) {
      const v = voices[ch] || voices.lead;
      for (const ev of data.events) {
        const t = start + ev.at * sixteenth;
        const dur = Math.max(0.05, ev.len * sixteenth * 0.9);
        if (v.wave === 'noise') this._noise(t, dur, ev.freq, v.gain, this.musicGain);
        else this._tone(t, dur, ev.freq, v.wave, v.gain, this.musicGain);
      }
    }

    const loopSeconds = parsed.length * sixteenth;
    this.timer = setTimeout(() => this._schedule(), Math.max(50, loopSeconds * 1000 - 90));
  }

  _tone(t, dur, freq, wave, gain, dest) {
    if (!freq) return;
    const osc = this.ctx.createOscillator();
    if (wave === 'tri') osc.type = 'triangle';
    else if (wave === 'saw') osc.type = 'sawtooth';
    else osc.setPeriodicWave(this._pulseWaves[wave] || this._pulseWaves.half);
    osc.frequency.setValueAtTime(freq, t);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.008);
    g.gain.setTargetAtTime(gain * 0.65, t + 0.02, 0.08);
    g.gain.setTargetAtTime(0, t + dur * 0.8, 0.03);
    osc.connect(g); g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.12);
  }

  _noise(t, dur, freq, gain, dest) {
    const len = Math.ceil(this.ctx.sampleRate * Math.min(dur, 0.3));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    // Low note = kick-ish, high note = hat-ish.
    filt.type = freq < 200 ? 'lowpass' : 'highpass';
    filt.frequency.value = freq < 200 ? 220 : 4000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(dur, 0.18));
    src.connect(filt); filt.connect(g); g.connect(dest);
    src.start(t);
    src.stop(t + Math.min(dur, 0.3));
  }

  // ---- sound effects -------------------------------------------------
  sfx(name, arg = 0) {
    if (!this.unlocked || !this.enabled) return;
    const t = this.ctx.currentTime;
    const G = this.sfxGain;
    const beep = (f, d, wave = 'half', g = 0.3) => this._tone(t, d, f, wave, g, G);
    const slide = (f0, f1, d, wave = 'half', g = 0.3) => {
      const osc = this.ctx.createOscillator();
      osc.setPeriodicWave(this._pulseWaves[wave] || this._pulseWaves.half);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d);
      const gn = this.ctx.createGain();
      // A few milliseconds of attack. Starting a gain at full value is a step
      // discontinuity, which is a click, and every slide in the game had one
      // on the front of it.
      gn.gain.setValueAtTime(0.0001, t);
      gn.gain.linearRampToValueAtTime(g, t + 0.006);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
      osc.connect(gn);
      gn.connect(G);
      if (this.echoSend) gn.connect(this.echoSend);
      osc.start(t); osc.stop(t + d + 0.02);
    };
    // A fanfare with something underneath it. A run of bare pulse tones is
    // thin; a fifth below and a shimmer above turns the same notes into a
    // chord that sounds like it means something.
    const fanfare = (notes, step = 0.11, dur = 0.2, g = 0.24) => {
      notes.forEach((f, i) => {
        const at = t + i * step;
        this._tone(at, dur, f, 'half', g, G);
        this._tone(at, dur * 1.4, f / 2, 'tri', g * 0.5, G);
        if (i === notes.length - 1) {
          this._tone(at + 0.05, dur * 1.8, f * 2, 'eighth', g * 0.3, G);
        }
      });
    };

    switch (name) {
      // Picking one up climbs a scale while you keep picking them up, and
      // drops back when you stop. A fixed pickup tone is the difference
      // between collecting things and pressing a button sixty times.
      case 'glimmer': {
        const STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
        const k = STEPS[Math.min(arg, STEPS.length - 1)];
        const f = 587 * Math.pow(2, k / 12);
        beep(f, 0.075, 'quarter', 0.17);
        this._tone(t + 0.015, 0.13, f * 2, 'eighth', 0.055, G);
        break;
      }
      case 'allglimmers': fanfare([784, 988, 1175, 1568], 0.11, 0.24, 0.26); break;
      case 'cursor':   beep(880, 0.05, 'quarter', 0.18); break;
      case 'select':   beep(1180, 0.07, 'quarter', 0.22); break;
      case 'back':     beep(420, 0.07, 'quarter', 0.18); break;
      case 'deny':     beep(200, 0.13, 'half', 0.22); break;
      case 'text':     beep(1420 + ((this._textTick = (this._textTick | 0) + 1) % 5) * 34, 0.014, 'eighth', 0.07); break;
      case 'bump':     beep(150, 0.06, 'half', 0.16); break;
      case 'step':     this._noise(t, 0.04, 300, 0.05, G); break;
      case 'encounter': slide(300, 1400, 0.28, 'half', 0.3); break;
      case 'hit':      this._noise(t, 0.12, 500, 0.35, G); slide(500, 120, 0.14, 'half', 0.22);
        this._tone(t, 0.09, 90, 'tri', 0.3, G); break;
      case 'supereffective': this._noise(t, 0.22, 900, 0.42, G); slide(900, 200, 0.26, 'half', 0.3);
        this._tone(t, 0.16, 70, 'tri', 0.34, G); this._tone(t + 0.05, 0.2, 1760, 'eighth', 0.14, G); break;
      case 'weak':     this._noise(t, 0.09, 240, 0.16, G); break;
      case 'faint':    slide(700, 90, 0.55, 'half', 0.3); break;
      case 'heal':     fanfare([660, 880, 1100], 0.09, 0.13, 0.2); break;
      case 'levelup':  fanfare([523, 659, 784, 1047], 0.085, 0.16, 0.22); break;
      case 'ball':     slide(900, 300, 0.16, 'quarter', 0.25); break;
      case 'wobble':   beep(300, 0.08, 'half', 0.2); break;
      case 'caught':   fanfare([784, 988, 1175, 1568], 0.11, 0.2, 0.24); break;
      case 'escape':   slide(600, 1200, 0.18, 'quarter', 0.22); break;
      case 'evolve':   fanfare([440, 554, 659, 880, 1109], 0.14, 0.24, 0.21); break;
      case 'badge':    fanfare([659, 784, 988, 1319, 1568], 0.12, 0.26, 0.26); break;
      case 'save':     [880, 1320].forEach((f, i) => this._tone(t + i * 0.1, 0.12, f, 'quarter', 0.2, G)); break;
      case 'buy':      [1047, 1319].forEach((f, i) => this._tone(t + i * 0.07, 0.09, f, 'quarter', 0.22, G)); break;
      case 'door':     this._noise(t, 0.16, 260, 0.18, G); break;
      case 'warp':     slide(200, 1600, 0.4, 'eighth', 0.24); break;
      case 'join':     fanfare([784, 1047, 1319], 0.09, 0.14, 0.22); break;
      case 'leave':    [1047, 784, 523].forEach((f, i) => this._tone(t + i * 0.09, 0.12, f, 'quarter', 0.2, G)); break;
      default: break;
    }
  }

  // Monster "cry": a short pitched noise-and-pulse burst derived from the
  // species id, so every species has a distinct, stable sound.
  cry(speciesId, pitchScale = 1) {
    if (!this.unlocked || !this.enabled) return;
    const t = this.ctx.currentTime;
    const seed = speciesId * 2654435761 % 2147483647;
    const base = (140 + (seed % 380)) * pitchScale;
    const steps = 3 + (seed % 3);
    const waves = ['half', 'quarter', 'eighth'];
    for (let i = 0; i < steps; i++) {
      const s = (seed >> (i * 3)) % 12;
      const f = base * Math.pow(2, (s - 6) / 12) * (1 + i * 0.12);
      const osc = this.ctx.createOscillator();
      osc.setPeriodicWave(this._pulseWaves[waves[(seed >> i) % 3]]);
      const t0 = t + i * 0.075;
      osc.frequency.setValueAtTime(f, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, f * (0.7 + (s % 5) * 0.15)), t0 + 0.09);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.22, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(t0); osc.stop(t0 + 0.13);
    }
  }
}

export const audio = new AudioEngine();
