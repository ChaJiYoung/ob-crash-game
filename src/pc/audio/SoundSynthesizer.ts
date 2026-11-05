import { JudgmentGrade, WeaponKind } from '../../shared/types';

export class SoundSynthesizer {
  private ctx: AudioContext | null = null;

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext(): void {
    if (typeof window === 'undefined') return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    } catch {
      this.ctx = null;
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx || this.ctx.state === 'closed') {
      this.initAudioContext();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlockAudio(): void {
    this.ensureContext();
  }

  public playShoot(isFever = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isFever ? 'sawtooth' : 'triangle';
    const now = ctx.currentTime;

    osc.frequency.setValueAtTime(isFever ? 480 : 360, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain.gain.setValueAtTime(isFever ? 0.35 : 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playWeaponShoot(kind: WeaponKind, isFever = false): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (kind === 'shotgun') {
      // Sawtooth heavy pump + rubber pop
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(isFever ? 180 : 130, now);
      osc1.frequency.exponentialRampToValueAtTime(42, now + 0.12);
      gain1.gain.setValueAtTime(isFever ? 0.38 : 0.28, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.13);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(320, now);
      osc2.frequency.exponentialRampToValueAtTime(620, now + 0.08);
      gain2.gain.setValueAtTime(0.2, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.09);
    } else if (kind === 'revolver') {
      // 🍾 Golden Opener Magnum Revolver: Sharp Metallic Clink + Heavy Blast + Noise Crack
      // 1. High-frequency Metallic Opener Ping (2400Hz -> 1200Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(2400, now);
      osc1.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.06);

      // 2. Heavy Magnum Blast Body (520Hz down to 38Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = isFever ? 'sawtooth' : 'triangle';
      osc2.frequency.setValueAtTime(isFever ? 520 : 380, now);
      osc2.frequency.exponentialRampToValueAtTime(38, now + 0.18);
      gain2.gain.setValueAtTime(isFever ? 0.55 : 0.42, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.19);

      // 3. Gunpowder Noise Transient
      try {
        const bufferSize = Math.floor(ctx.sampleRate * 0.05);
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(1200, now);
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(isFever ? 0.35 : 0.25, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        whiteNoise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        whiteNoise.start(now);
        whiteNoise.stop(now + 0.05);
      } catch {
        // Fallback for headless environments
      }
    } else {
      // gatling: carbonation bubble pop
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(isFever ? 0.28 : 0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  }

  public playSkillActivation(kind: WeaponKind): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    if (kind === 'shotgun') {
      // Plunger Storm: multiple pop sweeps
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(280 + i * 120, now + i * 0.06);
        osc.frequency.exponentialRampToValueAtTime(680 + i * 150, now + i * 0.06 + 0.09);
        gain.gain.setValueAtTime(0.24, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.1);
      }
    } else if (kind === 'revolver') {
      // Opener slash
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.28);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } else {
      // Foam Tsunami: roaring wave sweep
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(380, now);
      osc.frequency.exponentialRampToValueAtTime(95, now + 0.35);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    }
  }

  public playCocking(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1st click (철-)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(240, now);
    osc1.frequency.exponentialRampToValueAtTime(780, now + 0.04);
    gain1.gain.setValueAtTime(0.28, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.05);

    // 2nd click (-컥!)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(920, now + 0.045);
    osc2.frequency.exponentialRampToValueAtTime(320, now + 0.09);
    gain2.gain.setValueAtTime(0.22, now + 0.045);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.045);
    osc2.stop(now + 0.095);
  }

  public playHit(grade: JudgmentGrade): void {
    const ctx = this.ensureContext();
    if (!ctx || grade === 'MISS') return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sine';
    if (grade === 'PERFECT') {
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1320, now + 0.05);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    } else if (grade === 'GREAT') {
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.setValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    } else {
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.22);
  }

  public playAutoReload(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.25);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.28);
  }

  public playFeverStart(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime + idx * 0.07;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.25);
    });
  }

  public playBottlePopSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Resonant bottle pop sweep (850Hz -> 160Hz)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(850, now);
    osc.frequency.exponentialRampToValueAtTime(160, now + 0.065);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.085);

    // Snappy high-frequency cap opening click impulse
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1600, now);

    clickGain.gain.setValueAtTime(0.4, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.025);
  }

  /** 방패에 막혔을 때: 짧고 높은 금속성 "팅". 일반 타격음(playMetallicHitSound)과 구분된다. */
  public playShieldBlockSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2600, now);
    osc.frequency.exponentialRampToValueAtTime(2100, now + 0.12);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playMetallicHitSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.05);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.065);
  }

  public playCanCrushSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. 알루미늄 찌그러지는 둔탁한 금속음 (sawtooth 420Hz -> 120Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(420, now);
    osc1.frequency.exponentialRampToValueAtTime(120, now + 0.12);

    gain1.gain.setValueAtTime(0.45, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.135);

    // 2. 캔 림 파열/바디 찌그러짐 날카로운 고주파 (square 960Hz -> 220Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(960, now + 0.015);
    osc2.frequency.exponentialRampToValueAtTime(220, now + 0.1);

    gain2.gain.setValueAtTime(0.28, now + 0.015);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.015);
    osc2.stop(now + 0.115);
  }

  public playBottleShatterSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    // 1. 탄산 팝 베이스
    this.playBottlePopSound();

    const now = ctx.currentTime;
    // 2. 산산조각 나는 유리 파편 고주파 아르페지오 (2400Hz, 1800Hz, 3200Hz)
    const glassPitches = [2400, 1800, 3200];
    glassPitches.forEach((pitch, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = now + 0.02 + i * 0.025;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(pitch, startTime);
      osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, startTime + 0.09);

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.095);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.1);
    });
  }

  /** 체력이 줄었을 때 나는 둔탁한 짧은 소리. */
  public playPlayerHitSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  /** 보스 등장 경고음: 높낮이가 있는 삐뽀 두 번. */
  public playBossWarningSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [0, 0.24].forEach((offset) => {
      const start = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, start);
      osc.frequency.linearRampToValueAtTime(660, start + 0.18);
      gain.gain.setValueAtTime(0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
  }

  public playBossExplosionSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. 묵직한 서브베이스 폭발음 (140Hz -> 30Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(140, now);
    osc1.frequency.exponentialRampToValueAtTime(30, now + 0.45);

    gain1.gain.setValueAtTime(0.75, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.52);

    // 2. 둔탁한 파열 충격파 (sawtooth 360Hz -> 50Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(360, now);
    osc2.frequency.exponentialRampToValueAtTime(50, now + 0.35);

    gain2.gain.setValueAtTime(0.45, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.4);
  }

  /**
   * 🪙 Golden Can Spawn Alert: Bright double coin chime (E6 -> G#6)
   */
  public playGoldenCanChime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 1318.5, delay: 0 },    // E6
      { freq: 1661.2, delay: 0.08 }, // G#6
      { freq: 2093.0, delay: 0.16 }, // C7
    ];

    notes.forEach(({ freq, delay }) => {
      const startTime = now + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.35, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  }

  /**
   * 🛡️ Projectile Interception Sound: High-tech shield deflection zap
   */
  public playInterceptSound(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(1100, now + 0.14);

    gain.gain.setValueAtTime(0.40, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.16);
  }
}
