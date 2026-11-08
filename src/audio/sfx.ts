/**
 * Firework sounds, synthesised with Web Audio (no recordings, nothing to
 * download): the thump and hiss of a launch, and the crack, boom, echo and
 * crackle of a burst. There is no background music.
 */

export type SoundKind = 'launch' | 'burst';

export interface SoundOptions {
  /** Stereo position, -1 (left) to 1 (right). */
  pan: number;
  /** Shell size, about 0.8 to 1.4: bigger shells boom louder and deeper. */
  size: number;
  /** Launch only: how long the climb lasts, seconds. */
  launchSeconds?: number;
  /** Burst only: add the crackle of glittering stars. */
  crackle?: boolean;
  /** Overall loudness multiplier (default 1). */
  level?: number;
}

export interface SfxGraph {
  play(kind: SoundKind, options: SoundOptions): void;
  dispose(): void;
}

const rand = (min: number, max: number): number => min + Math.random() * (max - min);

function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Sparse, uneven pops: the sound of glitter stars crackling. */
function crackleBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    const pops = 150;
    for (let p = 0; p < pops; p++) {
      // Two random numbers averaged: denser in the middle, thinner at the edges.
      const t = ((Math.random() + Math.random()) / 2) * 0.96;
      const start = Math.floor(t * length);
      const popLength = Math.floor(rate * rand(0.002, 0.007));
      const amp = rand(0.25, 1) * (1 - t * 0.6);
      for (let i = 0; i < popLength && start + i < length; i++) {
        data[start + i] = (data[start + i] ?? 0) + (Math.random() * 2 - 1) * amp * (1 - i / popLength) ** 2;
      }
    }
  }
  return buffer;
}

/** A short outdoor echo: a dark, decaying tail. */
function echoBuffer(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const buffer = ctx.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let smooth = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      smooth += (0.35 - 0.25 * t) * ((Math.random() * 2 - 1) - smooth);
      data[i] = smooth * (1 - t) ** decay;
    }
  }
  return buffer;
}

export function createSfxGraph(ctx: AudioContext): SfxGraph {
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.knee.value = 10;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  master.connect(limiter).connect(ctx.destination);

  const echo = ctx.createConvolver();
  echo.buffer = echoBuffer(ctx, 2.8, 2.4);
  const echoReturn = ctx.createGain();
  echoReturn.gain.value = 0.5;
  echo.connect(echoReturn).connect(master);

  const noise = noiseBuffer(ctx, 2);
  const crackle = crackleBuffer(ctx, 1.6);

  /** One input per sound, panned, with a send to the echo. */
  const voice = (pan: number, echoAmount: number, level: number): { input: GainNode; nodes: AudioNode[] } => {
    const input = ctx.createGain();
    input.gain.value = Math.max(0, level);
    const nodes: AudioNode[] = [input];
    let out: AudioNode = input;
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      input.connect(panner);
      nodes.push(panner);
      out = panner;
    }
    out.connect(master);
    const send = ctx.createGain();
    send.gain.value = echoAmount;
    out.connect(send).connect(echo);
    nodes.push(send);
    return { input, nodes };
  };

  const release = (nodes: AudioNode[], afterSeconds: number) => {
    setTimeout(() => {
      for (const node of nodes) node.disconnect();
    }, afterSeconds * 1000);
  };

  function noiseHit(
    at: number,
    destination: AudioNode,
    filter: BiquadFilterType,
    from: number,
    to: number,
    level: number,
    attack: number,
    decay: number,
    q = 0.7,
  ): void {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, at);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + attack + decay * 0.6);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    src.connect(f).connect(env).connect(destination);
    src.start(at, Math.random() * 1.2);
    src.stop(at + attack + decay + 0.05);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      env.disconnect();
    };
  }

  function thump(at: number, destination: AudioNode, from: number, to: number, level: number, decay: number): void {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + decay * 0.6);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, at + decay);
    osc.connect(env).connect(destination);
    osc.start(at);
    osc.stop(at + decay + 0.05);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }

  function launch(options: SoundOptions): void {
    const at = ctx.currentTime + 0.01;
    const climb = Math.max(0.6, options.launchSeconds ?? 1.3);
    const { input, nodes } = voice(options.pan * 0.6, 0.15, options.level ?? 1);
    // The lift charge: a short, soft thump from the tube.
    thump(at, input, 150, 55, 0.32, 0.22);
    noiseHit(at, input, 'lowpass', 1200, 300, 0.16, 0.004, 0.14);
    // The shell's hiss as it climbs, rising in pitch and thinning out.
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.3;
    band.frequency.setValueAtTime(520, at);
    band.frequency.exponentialRampToValueAtTime(2600, at + climb);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.055, at + 0.08);
    env.gain.linearRampToValueAtTime(0.03, at + climb * 0.8);
    env.gain.linearRampToValueAtTime(0, at + climb);
    src.connect(band).connect(env).connect(input);
    src.start(at, Math.random());
    src.stop(at + climb + 0.05);
    release([src, band, env, ...nodes], climb + 3);
  }

  function burst(options: SoundOptions): void {
    const size = Math.max(0.6, Math.min(1.5, options.size));
    // Light arrives first; the boom follows a moment later, as it does outdoors.
    const at = ctx.currentTime + rand(0.12, 0.28);
    const { input, nodes } = voice(options.pan, 0.45, options.level ?? 1);
    noiseHit(at, input, 'highpass', 2400, 1800, 0.32, 0.002, 0.05);
    noiseHit(at, input, 'lowpass', 1600, 140, 0.85 * size, 0.004, 1.8);
    thump(at, input, 80, 32, 0.7 * size, 1.2);
    if (options.crackle) {
      const src = ctx.createBufferSource();
      src.buffer = crackle;
      src.playbackRate.value = rand(0.9, 1.15);
      const high = ctx.createBiquadFilter();
      high.type = 'highpass';
      high.frequency.value = 1100;
      const level = ctx.createGain();
      level.gain.value = 0.28 * size;
      src.connect(high).connect(level).connect(input);
      src.start(at + rand(0.45, 0.7));
      nodes.push(src, high, level);
    }
    release(nodes, 6);
  }

  return {
    play(kind, options) {
      if (ctx.state !== 'running') return;
      if (kind === 'launch') launch(options);
      else burst(options);
    },
    dispose() {
      master.disconnect();
    },
  };
}
