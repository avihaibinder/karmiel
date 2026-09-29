// Audio: tiny WebAudio synth — sfx + looping background music per mood.
let AC = null, master = null, musicGain = null;
export const audio = { muted: false };
export function ac() {
  if (!AC) { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = 0.8; master.connect(AC.destination); musicGain = AC.createGain(); musicGain.gain.value = 0.5; musicGain.connect(master); }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}
export function setMuted(m) { audio.muted = m; if (master) master.gain.value = m ? 0 : 0.8; }
export function tone(f, t, d, type = 'square', v = 0.08, f2, dest) {
  const a = ac(), o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(dest || master); o.start(t); o.stop(t + d + 0.03);
}
let nb;
export function noise(t, d, v, freq = 1000, type = 'highpass', dest) {
  const a = ac();
  if (!nb) { nb = a.createBuffer(1, a.sampleRate, a.sampleRate); const c = nb.getChannelData(0); for (let i = 0; i < c.length; i++) c[i] = Math.random() * 2 - 1; }
  const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  s.buffer = nb; f.type = type; f.frequency.value = freq;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f).connect(g).connect(dest || master); s.start(t); s.stop(t + d + 0.02);
}
export function sfx(n, p = 1) {
  if (!AC || audio.muted) return; const t = AC.currentTime;
  switch (n) {
    case 'blip': tone(560 + Math.random() * 90, t, 0.035, 'square', 0.022); break;
    case 'coin': tone(880, t, 0.08, 'square', 0.05); tone(1320, t + 0.08, 0.16, 'square', 0.05); break;
    case 'ach': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.07, 0.25, 'triangle', 0.07)); break;
    case 'win': [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.09, 0.22, 'triangle', 0.08)); break;
    case 'fail': tone(330, t, 0.25, 'sawtooth', 0.05, 220); tone(220, t + 0.25, 0.45, 'sawtooth', 0.05, 110); break;
    case 'wa': tone(1180, t, 0.07, 'sine', 0.08); tone(1580, t + 0.08, 0.1, 'sine', 0.07); break;
    case 'honk': tone(330, t, 0.4, 'sawtooth', 0.07); tone(415, t, 0.4, 'sawtooth', 0.05); break;
    case 'crash': noise(t, 0.35, 0.5, 300, 'lowpass'); tone(90, t, 0.3, 'sine', 0.3, 40); break;
    case 'jump': tone(300, t, 0.14, 'square', 0.03, 600); break;
    case 'meow': tone(760, t, 0.32, 'triangle', 0.07, 430); break;
    case 'stamp': noise(t, 0.15, 0.5, 150, 'lowpass'); tone(90, t, 0.18, 'sine', 0.35); break;
    case 'beep': tone(1800 * p, t, 0.08, 'square', 0.03 + 0.08 * p); break;
    case 'pickup': tone(660, t, 0.06, 'square', 0.05); tone(990, t + 0.06, 0.06, 'square', 0.05); tone(1320, t + 0.12, 0.12, 'square', 0.05); break;
    case 'pa': noise(t, 0.4, 0.15, 2500, 'bandpass'); tone(160, t + 0.1, 1.2, 'sawtooth', 0.03, 90); break;
    case 'jingle': [659, 784, 988, 1319].forEach((f, i) => tone(f, t + i * 0.12, 0.2, 'triangle', 0.08)); break;
    case 'sting': [110, 116.5, 155.6].forEach(f => tone(f, t, 1.6, 'sawtooth', 0.07)); noise(t, 0.8, 0.2, 800); break;
    case 'whisper': noise(t, 0.9, 0.07, 3000, 'bandpass'); break;
    case 'scrape': noise(t, 0.25, 0.12, 600, 'bandpass'); break;
    case 'flap': for (let i = 0; i < 8; i++) noise(t + i * 0.05, 0.05, 0.12, 1200, 'bandpass'); break;
    case 'cart': for (let i = 0; i < 6; i++) tone(180 + Math.random() * 40, t + i * 0.09, 0.07, 'square', 0.02); break;
    case 'heart': tone(60, t, 0.12, 'sine', 0.4); tone(55, t + 0.2, 0.12, 'sine', 0.3); break;
    case 'pin': noise(t, 0.12, 0.3, 1500, 'bandpass'); tone(900, t, 0.08, 'triangle', 0.05); break;
    case 'ribbon': noise(t, 0.2, 0.2, 4000); tone(1200, t, 0.1, 'triangle', 0.05); break;
    case 'whoosh': noise(t, 0.4, 0.2, 700, 'bandpass'); break;
  }
}

// ---------------------------------------------------------------- music loops
const SCALES = { hijaz: [293.66, 311.13, 369.99, 392, 440, 466.16, 523.25, 587.33], major: [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25], minor: [220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440] };
const SONGS = {
  roam: { bpm: 104, scale: 'major', mel: [0, 2, 4, 2, 5, 4, 2, -1, 0, 2, 4, 5, 7, 5, 4, 2], bass: [0, 0, 5, 5, 3, 3, 4, 4], drums: 'soft', vol: 0.5 },
  tense: { bpm: 128, scale: 'hijaz', mel: [0, 1, 2, 1, 3, 2, 1, 0, 4, 3, 2, 1, 2, 1, 0, -1], bass: [0, 0, 0, 3, 0, 0, 4, 3], drums: 'drive', vol: 0.55 },
  horror: { bpm: 60, scale: 'minor', mel: [0, -1, -1, 1, -1, -1, -1, 0, -1, -1, 6, -1, -1, 5, -1, -1], bass: [0, 0, 0, 0, 1, 1, 1, 1], drums: 'heart', vol: 0.5, pad: true },
  chase: { bpm: 150, scale: 'minor', mel: [0, 0, 3, 0, 5, 0, 3, 2, 0, 0, 3, 0, 6, 5, 3, 2], bass: [0, 0, 0, 0, 5, 5, 3, 3], drums: 'drive', vol: 0.6 },
  mall92: { bpm: 96, scale: 'major', mel: [4, 2, 0, 2, 4, 4, 4, -1, 2, 2, 2, -1, 4, 7, 7, -1], bass: [0, 0, 3, 3, 4, 4, 0, 0], drums: 'soft', vol: 0.45, detune: true },
  sad: { bpm: 72, scale: 'minor', mel: [4, 3, 2, 0, 2, 3, 4, -1, 5, 4, 3, 2, 3, 2, 0, -1], bass: [0, 0, 5, 5, 3, 3, 4, 4], drums: 'none', vol: 0.45 },
};
let cur = null, nextT = 0, step = 0, loopTimer = 0;
export function music(name) {
  if (!AC) return;
  if (cur === name) return; cur = name; step = 0; nextT = AC.currentTime + 0.1;
  clearInterval(loopTimer); if (!name) return;
  loopTimer = setInterval(schedule, 50);
}
function schedule() {
  const s = SONGS[cur]; if (!s || audio.muted) { if (AC) nextT = AC.currentTime + 0.1; return; }
  const sc = SCALES[s.scale], b = 60 / s.bpm / 2;
  while (nextT < AC.currentTime + 0.25) {
    const i = step % 16, t = nextT, m = s.mel[i];
    const det = s.detune ? 1 + Math.sin(step * 0.7) * 0.012 : 1;
    if (m >= 0) tone(sc[m] * det, t, b * 0.9, s.pad ? 'sine' : 'triangle', 0.05 * s.vol, undefined, musicGain);
    if (i % 2 === 0) tone(sc[s.bass[(i / 2) | 0]] / 2 * det, t, b * 1.8, 'sine', 0.09 * s.vol, undefined, musicGain);
    if (s.drums === 'soft') { if (i % 4 === 0) tone(120, t, 0.1, 'sine', 0.2 * s.vol, 50, musicGain); if (i % 4 === 2) noise(t, 0.04, 0.05 * s.vol, 6000, 'highpass', musicGain); }
    if (s.drums === 'drive') { if (i % 2 === 0) tone(140, t, 0.12, 'sine', 0.3 * s.vol, 45, musicGain); if (i % 4 === 2) noise(t, 0.1, 0.15 * s.vol, 1500, 'highpass', musicGain); noise(t, 0.03, 0.05 * s.vol, 7000, 'highpass', musicGain); }
    if (s.drums === 'heart' && i % 8 === 0) { tone(55, t, 0.15, 'sine', 0.4 * s.vol, undefined, musicGain); tone(50, t + 0.22, 0.15, 'sine', 0.3 * s.vol, undefined, musicGain); }
    if (s.pad && i === 0) tone(sc[0] / 4, t, b * 16, 'sawtooth', 0.02 * s.vol, undefined, musicGain);
    nextT += b; step++;
  }
}

// ---------------------------------------------------------------- rhythm-game track (returns beat times)
const HJ = SCALES.hijaz;
export function danceTrack(T0, bpm, beats, flavour = 0) {
  const B = 60 / bpm, MEL = [[0, 1, 2, 3, 4, 3, 2, 1, 2, 3, 4, 5, 4, 3, 2, 1], [4, 4, 5, 4, 3, 2, 3, 4, 2, 2, 3, 2, 1, 0, 1, 2], [0, 2, 4, 7, 6, 4, 2, 0, 1, 3, 5, 7, 6, 5, 3, 1]][flavour % 3];
  for (let b = 0; b < beats + 2; b++) {
    const t = T0 + b * B;
    tone(150, t, 0.15, 'sine', 0.45, 45); if (b % 2) noise(t, 0.12, 0.25, 1500); noise(t + B / 2, 0.04, 0.1, 6000);
    const m = MEL[b % 16]; tone(HJ[m] * (flavour === 2 && b > 16 ? 2 : 1), t, B * 0.45, 'square', 0.04); tone(HJ[(m + 2) % 8], t + B / 2, B * 0.3, 'triangle', 0.035);
    if (b % 4 === 0) tone(HJ[0] / 2, t, B * 1.8, 'triangle', 0.08);
    if (flavour === 2 && b % 8 === 7) noise(t, B, 0.2, 400, 'lowpass');   // "the drop nobody asked for"
  }
  return B;
}
