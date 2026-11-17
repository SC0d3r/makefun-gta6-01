// WebAudio synthesis only: a filtered engine drone, a two-tone siren, gunshots from noise,
// footsteps, UI clicks and a slow original three-chord pad. Nothing loads from the network and
// nothing sounds until the player's first click or key press unlocks the context.
// Every sound is built from oscillators, so the game ships no audio files.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engine = null;
  let engineGain = null;
  let siren = null;
  let sirenGain = null;
  let musicTimer = 0;
  let chord = 0;
  let enabled = true;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { enabled = false; return null; }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    } catch {
      enabled = false;
      return null;
    }
    return ctx;
  }

  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }

  function tone(freq, duration, type = 'sine', volume = 0.08, slide = 0) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), c.currentTime + duration);
    gain.gain.setValueAtTime(volume, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(c.currentTime + duration + 0.02);
  }

  function setEngine(on, speed = 0) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    if (on && !engine) {
      engine = c.createOscillator();
      engine.type = 'sawtooth';
      const filter = c.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = c.createGain();
      engineGain.gain.value = 0.0001;
      engine.frequency.value = 70;
      engine.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(master);
      engine.start();
    }
    if (!engine) return;
    const t = c.currentTime;
    engine.frequency.setTargetAtTime(58 + Math.min(28, Math.abs(speed)) * 5.2, t, 0.08);
    engineGain.gain.setTargetAtTime(on ? 0.035 : 0.0001, t, 0.12);
  }

  function setSiren(on) {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    if (on && !siren) {
      siren = c.createOscillator();
      siren.type = 'square';
      const lfo = c.createOscillator();
      const lfoGain = c.createGain();
      lfo.frequency.value = 1.7;
      lfoGain.gain.value = 330;
      lfo.connect(lfoGain);
      lfoGain.connect(siren.frequency);
      siren.frequency.value = 780;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 900;
      filter.Q.value = 2;
      sirenGain = c.createGain();
      sirenGain.gain.value = 0.0001;
      siren.connect(filter);
      filter.connect(sirenGain);
      sirenGain.connect(master);
      siren.start();
      lfo.start();
    }
    if (sirenGain) sirenGain.gain.setTargetAtTime(on ? 0.022 : 0.0001, c.currentTime, 0.2);
  }

  function shot() {
    if (!enabled) return;
    const c = ensure();
    if (!c) return;
    const len = Math.floor(c.sampleRate * 0.11);
    const buffer = c.createBuffer(1, len, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const source = c.createBufferSource();
    source.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2600, c.currentTime);
    filter.frequency.exponentialRampToValueAtTime(300, c.currentTime + 0.12);
    const gain = c.createGain();
    gain.gain.value = 0.20;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function step() { tone(90, 0.06, 'triangle', 0.018, -20); }
  function click() { tone(520, 0.07, 'sine', 0.035); }
  function crash() { tone(70, 0.24, 'sawtooth', 0.06, -30); }
  function complete() {
    tone(523, 0.18, 'triangle', 0.05);
    setTimeout(() => tone(659, 0.18, 'triangle', 0.05), 130);
    setTimeout(() => tone(784, 0.32, 'triangle', 0.05), 260);
  }

  const CHORDS = [
    [220.0, 277.18, 329.63],
    [196.0, 246.94, 293.66],
    [174.61, 220.0, 261.63],
  ];

  function update(dt, active) {
    if (!enabled || !ctx) return;
    if (!active) return;
    musicTimer -= dt;
    if (musicTimer <= 0) {
      musicTimer = 7.2;
      const notes = CHORDS[chord % CHORDS.length];
      chord += 1;
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = n / 2;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.012, ctx.currentTime + 1.6);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 7);
        osc.connect(gain);
        gain.connect(master);
        osc.start();
        osc.stop(ctx.currentTime + 7.2);
      }
    }
  }

  return { unlock, setEngine, setSiren, shot, step, click, crash, complete, update };
}
