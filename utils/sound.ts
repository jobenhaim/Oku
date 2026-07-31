
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { App as CapacitorApp } from '@capacitor/app';

interface SoundProfile {
    id: string;
    type: 'sine' | 'square' | 'triangle' | 'sawtooth' | 'noise';
    uiClickFreq: number;
    uiTapFreq: number;
    numberFreqs: number[];
    popFreq: number;
    duration: number; // Base duration in seconds
    volumeScale: number;
    pitchDrop?: boolean;
    noiseFilterFreq?: number; // Center freq for noise bands
    tapFreqs?: number[]; // Frequencies for random variation on tap
}

const PROFILES: Record<string, SoundProfile> = {
    'snd-zen': {
        id: 'snd-zen',
        type: 'sine',
        uiClickFreq: 800, 
        uiTapFreq: 800,
        numberFreqs: Array(9).fill(600),
        popFreq: 400,
        duration: 0.035, 
        volumeScale: 0.55,
        pitchDrop: true
    },
    'snd-paper': {
        id: 'snd-paper',
        type: 'noise', 
        uiClickFreq: 1200, 
        uiTapFreq: 1000,
        numberFreqs: Array(9).fill(1000), 
        popFreq: 800,
        duration: 0.05,
        volumeScale: 0.6,
        noiseFilterFreq: 800
    },
    'snd-wood': {
        id: 'snd-wood',
        type: 'sine', // Carrier is Sine, but we use FM synthesis
        uiClickFreq: 330, // E4 - Solid knock
        uiTapFreq: 392,   // G4
        tapFreqs: [330, 349, 392, 440], // Random log hits
        // E Minor Pentatonic (Forest/Mystic): E4, G4, A4, B4, D5, E5, G5, A5, B5
        numberFreqs: [329.63, 392.00, 440.00, 493.88, 587.33, 659.25, 783.99, 880.00, 987.77],
        popFreq: 164.8, // E3 (Deep Thud)
        duration: 0.15, 
        volumeScale: 0.72, // FM carries more perceived energy than a plain sine
        pitchDrop: false 
    },
    'snd-water': {
        id: 'snd-water',
        type: 'sine',
        uiClickFreq: 600,
        uiTapFreq: 700,
        // Whole Tone Scale (Dreamy/Fluid): C5, D5, E5, F#5, G#5, A#5, C6, D6, E6
        numberFreqs: [523.25, 587.33, 659.25, 739.99, 830.61, 932.33, 1046.50, 1174.66, 1318.51],
        popFreq: 400,
        duration: 0.1, 
        volumeScale: 0.72,
        pitchDrop: false // We use upward ramp
    },
    'snd-piano': {
        id: 'snd-piano',
        type: 'triangle', 
        uiClickFreq: 1046, // Fallback freq
        uiTapFreq: 523, // C5
        tapFreqs: [523.25, 587.33, 659.25, 783.99, 880.00], // C Major Pentatonic
        // Pentatonic Major Scale: C4, D4, E4, G4, A4, C5, D5, E5, G5
        numberFreqs: [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99],
        popFreq: 196, // G3
        duration: 0.9,
        volumeScale: 0.5,
        pitchDrop: false
    },
    'snd-stone': {
        id: 'snd-stone',
        type: 'sine',
        uiClickFreq: 220,
        uiTapFreq: 261.63,
        // Low enough to feel grounded, but high enough to survive phone speakers.
        numberFreqs: [196.00, 220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00],
        popFreq: 164.81,
        duration: 0.12,
        volumeScale: 0.9,
        pitchDrop: false
    },
    'snd-mech': {
        id: 'snd-mech',
        type: 'square', // Clicky
        uiClickFreq: 2000,
        uiTapFreq: 2200,
        numberFreqs: Array(9).fill(2500), // Mechs usually sound same, maybe slight var?
        popFreq: 1500,
        duration: 0.05,
        volumeScale: 0.12,
        pitchDrop: false
    },
    'snd-retro': {
        id: 'snd-retro',
        type: 'square',
        uiClickFreq: 440,
        uiTapFreq: 659.25,
        // A warmer C-major handheld register that remains clear on phones.
        numberFreqs: [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, 587.33],
        popFreq: 220,
        duration: 0.09,
        volumeScale: 0.207,
        pitchDrop: false
    },
    'snd-crystal': {
        id: 'snd-crystal',
        type: 'sine',
        uiClickFreq: 1200,
        uiTapFreq: 1400,
        // Pentatonic C Major High (Crystal Clear)
        numberFreqs: [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50, 1174.66, 1318.51, 1567.98],
        popFreq: 800,
        duration: 0.8, // Ring out
        volumeScale: 0.32,
        pitchDrop: false
    },
    'snd-koto': {
        id: 'snd-koto',
        type: 'sawtooth',
        uiClickFreq: 440,
        uiTapFreq: 523,
        tapFreqs: [440.00, 493.88, 523.25, 659.25, 698.46], // Hirajoshi: A, B, C, E, F
        // Japanese Pentatonic (Hirajoshi): A, B, C, E, F
        numberFreqs: [440.00, 493.88, 523.25, 659.25, 698.46, 880.00, 987.77, 1046.50, 1318.51],
        popFreq: 220,
        duration: 0.65,
        volumeScale: 0.3,
        pitchDrop: false
    }
};

class SoundController {
    private ctx: AudioContext | null = null;
    private profileOutputContext: AudioContext | null = null;
    private profileOutput: GainNode | null = null;
    private soundEnabled: boolean = true;
    private vibrationEnabled: boolean = true;
    private activeProfile: SoundProfile = PROFILES['snd-zen'];
    private lastTickTime: number = 0;
    private recoveryPromise: Promise<void> | null = null;
    private lastObservedContextTime: number = 0;
    private lastObservedWallTime: number = 0;

    constructor() {
        if (typeof window !== 'undefined') {
            const handleResume = () => void this.recoverAudio();
            window.addEventListener('focus', handleResume);
            window.addEventListener('pageshow', handleResume);
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    handleResume();
                }
            });

            void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
                if (isActive) handleResume();
            }).catch(() => {
                // The web preview does not need the native lifecycle bridge.
            });

            const unlock = () => {
                const context = this.ctx;
                if (!context) return;

                const state = context.state as string;
                if (state === 'interrupted' || state === 'suspended') {
                    void this.recoverAudio();
                } else if (state === 'running' && this.isContextLikelyFrozen(context)) {
                    const recoveredContext = this.getCtx();
                    void recoveredContext.resume().catch(() => {});
                }
            };
            window.addEventListener('click', unlock, { capture: true, passive: true });
            window.addEventListener('touchstart', unlock, { capture: true, passive: true });
        }
    }

    private wait(ms: number): Promise<void> {
        return new Promise(resolve => window.setTimeout(resolve, ms));
    }

    private async settleAudioOperation(operation: Promise<void>, timeoutMs: number = 350): Promise<void> {
        await Promise.race([
            operation.catch(() => {}),
            this.wait(timeoutMs)
        ]);
    }

    private observeContext(context: AudioContext) {
        this.lastObservedContextTime = context.currentTime;
        this.lastObservedWallTime = performance.now();
    }

    private isContextLikelyFrozen(context: AudioContext): boolean {
        if ((context.state as string) !== 'running' || this.lastObservedWallTime === 0) return false;

        const wallElapsed = performance.now() - this.lastObservedWallTime;
        const audioElapsed = context.currentTime - this.lastObservedContextTime;
        return wallElapsed > 500 && audioElapsed < 0.002;
    }

    private async isContextClockAdvancing(context: AudioContext): Promise<boolean> {
        if (this.ctx !== context || (context.state as string) !== 'running') return false;

        const startTime = context.currentTime;
        await this.wait(120);
        return this.ctx === context
            && (context.state as string) === 'running'
            && context.currentTime - startTime > 0.002;
    }

    private discardContext(context: AudioContext | null = this.ctx) {
        if (!context || (this.ctx && this.ctx !== context)) return;

        this.ctx = null;
        this.profileOutput = null;
        this.profileOutputContext = null;
        this.lastObservedContextTime = 0;
        this.lastObservedWallTime = 0;

        if ((context.state as string) !== 'closed') {
            void context.close().catch(() => {});
        }
    }

    private createContext(): AudioContext {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const context: AudioContext = new AudioContextClass();
        this.ctx = context;
        this.observeContext(context);

        context.addEventListener('statechange', () => {
            if (this.ctx !== context) return;

            if ((context.state as string) === 'interrupted') {
                // A notification sound can briefly retain the audio session, so
                // try once promptly and once more after the interruption settles.
                window.setTimeout(() => void this.recoverAudio(), 180);
                window.setTimeout(() => void this.recoverAudio(), 900);
            }
        });

        return context;
    }

    private async repairContext(): Promise<void> {
        const context = this.ctx;
        if (!context || !this.soundEnabled) return;

        if ((context.state as string) === 'closed') {
            this.discardContext(context);
            return;
        }

        if ((context.state as string) === 'interrupted' || context.state === 'suspended') {
            await this.settleAudioOperation(context.resume());
        }

        if (await this.isContextClockAdvancing(context)) {
            this.observeContext(context);
            return;
        }

        // WebKit can report `running` while currentTime is frozen. A controlled
        // suspend/resume repairs that state on many iOS versions.
        if (this.ctx === context) {
            try {
                if ((context.state as string) === 'running') {
                    await this.settleAudioOperation(context.suspend());
                }
                await this.wait(40);
                await this.settleAudioOperation(context.resume());
            } catch (_) {}
        }

        if (await this.isContextClockAdvancing(context)) {
            this.observeContext(context);
            return;
        }

        // Final fallback: rebuild only the audio engine. Gameplay state and the
        // selected sound profile live outside the AudioContext and are preserved.
        if (this.ctx === context) {
            this.discardContext(context);
            const replacement = this.createContext();
            await this.settleAudioOperation(replacement.resume());
            this.observeContext(replacement);
        }
    }

    recoverAudio(): Promise<void> {
        if (!this.ctx || !this.soundEnabled) return Promise.resolve();
        if (this.recoveryPromise) return this.recoveryPromise;

        this.recoveryPromise = this.repairContext().finally(() => {
            this.recoveryPromise = null;
        });
        return this.recoveryPromise;
    }

    setEnabled(enabled: boolean) {
        this.soundEnabled = enabled;
    }

    setVibrationEnabled(enabled: boolean) {
        this.vibrationEnabled = enabled;
    }

    setProfile(profileId: string) {
        // Migrations
        if (profileId === 'snd-glass') profileId = 'snd-water';
        if (profileId === 'snd-celeste') profileId = 'snd-piano';
        if (profileId === 'snd-drum') profileId = 'snd-crystal';
        if (profileId === 'snd-pop') profileId = 'snd-crystal'; // Migrate Pop to Crystal
        if (profileId === 'snd-harp') profileId = 'snd-koto';
        
        if (PROFILES[profileId]) {
            this.activeProfile = PROFILES[profileId];
        } else {
            this.activeProfile = PROFILES['snd-zen'];
        }
    }

    private getCtx(): AudioContext {
        let context = this.ctx;

        if (context && (
            (context.state as string) === 'interrupted'
            || (context.state as string) === 'closed'
            || this.isContextLikelyFrozen(context)
        )) {
            this.discardContext(context);
            context = null;
        }

        if (!context) {
            context = this.createContext();
        }

        if (context.state === 'suspended') {
            void context.resume().catch(() => {});
        }
        this.observeContext(context);
        return context;
    }

    /**
     * Shared mastering bus for selectable sound packs. The compressor catches
     * sharp square-wave and multi-note peaks while preserving the quieter sine
     * and noise profiles, so per-pack calibration can target perceived volume.
     */
    private getProfileOutput(ctx: AudioContext): GainNode {
        if (!this.profileOutput || this.profileOutputContext !== ctx) {
            const input = ctx.createGain();
            const compressor = ctx.createDynamicsCompressor();
            const output = ctx.createGain();

            input.gain.value = 1;
            compressor.threshold.value = -12;
            compressor.knee.value = 12;
            compressor.ratio.value = 4;
            compressor.attack.value = 0.003;
            compressor.release.value = 0.12;
            output.gain.value = 0.88;

            input.connect(compressor);
            compressor.connect(output);
            output.connect(ctx.destination);

            this.profileOutputContext = ctx;
            this.profileOutput = input;
        }

        return this.profileOutput;
    }

    /**
     * Plays a short profile-aware sequence through the same synthesis and
     * mastering path as taps and number presses. Keeping celebratory sounds on
     * this path prevents a sound pack from becoming louder only because a
     * different part of the UI triggered it.
     */
    private playProfileSequence(
        notes: number[],
        duration: number,
        volume: number,
        spacingMs: number,
        profile: SoundProfile = this.activeProfile
    ) {
        notes.forEach((freq, index) => {
            window.setTimeout(() => {
                this.playTone(freq, duration, volume, undefined, undefined, true, profile);
            }, index * spacingMs);
        });
    }

    private playNoiseBurst(centerFreq: number, duration: number, volume: number) {
        if (!this.soundEnabled) return;
        const ctx = this.getCtx();
        
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = 0.7; 
        filter.frequency.setValueAtTime(centerFreq, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(centerFreq * 0.6, ctx.currentTime + duration);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.getProfileOutput(ctx));

        noise.start();
        noise.stop(ctx.currentTime + duration + 0.1);
    }

    /**
     * Builds a compact pulse wave like the duty-cycle channels used by classic
     * handheld consoles. Different duty cycles give the notes distinct colors
     * without relying on harsh full-volume square waves.
     */
    private createHandheldPulseWave(ctx: AudioContext, dutyCycle: number): PeriodicWave {
        const harmonicCount = 24;
        const real = new Float32Array(harmonicCount + 1);
        const imag = new Float32Array(harmonicCount + 1);

        for (let harmonic = 1; harmonic <= harmonicCount; harmonic++) {
            imag[harmonic] = (
                2 * Math.sin(Math.PI * harmonic * dutyCycle)
            ) / (Math.PI * harmonic);
        }

        return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
    }

    private playTone(
        freq: number, 
        duration: number, 
        volume: number, 
        type?: 'sine' | 'square' | 'triangle' | 'sawtooth',
        volumeScaleOverride?: number,
        disablePitchDrop: boolean = false,
        profileOverride?: SoundProfile
    ) {
        if (!this.soundEnabled) return;

        const profile = profileOverride || this.activeProfile;
        const scale = volumeScaleOverride !== undefined ? volumeScaleOverride : profile.volumeScale;
        const vol = volume * scale;

        // Paper handling
        if (profile.id === 'snd-paper') {
            this.playNoiseBurst(profile.noiseFilterFreq || 800, duration, vol);
            return;
        }

        const ctx = this.getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        // --- SYNTHESIS LOGIC ---

        if (profile.id === 'snd-wood') {
             // Forest/Log Synthesis (FM)
             osc.type = 'sine';
             const mod = ctx.createOscillator();
             const modGain = ctx.createGain();
             mod.type = 'sine';
             mod.frequency.setValueAtTime(freq * 2.0, ctx.currentTime);
             const modDepth = freq * 0.8; 
             modGain.gain.setValueAtTime(modDepth, ctx.currentTime);
             modGain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.05);
             mod.connect(modGain);
             modGain.connect(osc.frequency);
             mod.start();
             mod.stop(ctx.currentTime + duration + 0.1);
             osc.connect(gain);

        } else if (profile.id === 'snd-piano') {
            // Cozy upright piano: a warm fundamental, gently inharmonic
            // overtones, and a very short felt-hammer transient. The compact
            // tail keeps fast number entry clear instead of becoming muddy.
            const now = ctx.currentTime;
            const output = this.getProfileOutput(ctx);
            const brightnessVariation = 0.94 + Math.random() * 0.12;

            osc.type = 'triangle';
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.Q.value = 0.65;
            filter.frequency.setValueAtTime(
                Math.min(7600, Math.max(2200, freq * 7 * brightnessVariation)),
                now
            );
            filter.frequency.exponentialRampToValueAtTime(
                Math.max(700, freq * 2),
                now + Math.min(0.2, duration * 0.25)
            );
            osc.connect(filter);
            filter.connect(gain);

            const addPianoPartial = (
                ratio: number,
                level: number,
                partialDuration: number
            ) => {
                const partial = ctx.createOscillator();
                const partialGain = ctx.createGain();
                partial.type = 'sine';
                partial.frequency.setValueAtTime(freq * ratio, now);
                partialGain.gain.setValueAtTime(0, now);
                partialGain.gain.linearRampToValueAtTime(vol * level, now + 0.003);
                partialGain.gain.exponentialRampToValueAtTime(
                    0.001,
                    now + Math.min(partialDuration, duration)
                );
                partial.connect(partialGain);
                partialGain.connect(output);
                partial.start(now);
                partial.stop(now + Math.min(partialDuration, duration) + 0.03);
            };

            // Piano strings are slightly inharmonic; these tiny offsets make
            // the voice feel struck rather than like a perfect synthesizer.
            addPianoPartial(2.003, 0.18, 0.38);
            addPianoPartial(3.008, 0.07, 0.2);

            const hammerDuration = 0.016;
            const hammerBuffer = ctx.createBuffer(
                1,
                Math.max(1, Math.floor(ctx.sampleRate * hammerDuration)),
                ctx.sampleRate
            );
            const hammerData = hammerBuffer.getChannelData(0);
            for (let i = 0; i < hammerData.length; i++) {
                hammerData[i] = Math.random() * 2 - 1;
            }
            const hammer = ctx.createBufferSource();
            const hammerFilter = ctx.createBiquadFilter();
            const hammerGain = ctx.createGain();
            hammer.buffer = hammerBuffer;
            hammerFilter.type = 'bandpass';
            hammerFilter.Q.value = 0.7;
            hammerFilter.frequency.setValueAtTime(
                Math.min(3400, Math.max(1700, freq * 4.5)),
                now
            );
            hammerGain.gain.setValueAtTime(vol * 0.075, now);
            hammerGain.gain.exponentialRampToValueAtTime(0.001, now + hammerDuration);
            hammer.connect(hammerFilter);
            hammerFilter.connect(hammerGain);
            hammerGain.connect(output);
            hammer.start(now);
            hammer.stop(now + hammerDuration);

        } else if (profile.id === 'snd-stone') {
            // Stone synthesis: a grounded body plus a brief, phone-audible impact.
            osc.type = 'sine';

            const impactOsc = ctx.createOscillator();
            const impactGain = ctx.createGain();
            impactOsc.type = 'triangle';
            impactOsc.frequency.setValueAtTime(Math.max(420, freq * 2.4), ctx.currentTime);
            impactGain.gain.setValueAtTime(vol * 0.22, ctx.currentTime);
            impactGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
            impactOsc.connect(impactGain);
            impactGain.connect(this.getProfileOutput(ctx));
            impactOsc.start();
            impactOsc.stop(ctx.currentTime + 0.06);

            // A tiny band-passed texture makes the strike legible without hiss.
            const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for(let i=0; i<data.length; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            const noiseGain = ctx.createGain();
            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'bandpass';
            noiseFilter.frequency.value = 850;
            noiseFilter.Q.value = 0.8;
            noiseGain.gain.setValueAtTime(vol * 0.16, ctx.currentTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.getProfileOutput(ctx));
            noise.start();

            osc.connect(gain);

        } else if (profile.id === 'snd-mech') {
            // Mechanical (Click + Thud)
            osc.type = 'square';
            
            // Secondary oscillator for the low thud
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(200, ctx.currentTime);
            gain2.gain.setValueAtTime(vol * 0.22, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
            osc2.connect(gain2);
            gain2.connect(this.getProfileOutput(ctx));
            osc2.start();
            osc2.stop(ctx.currentTime + 0.1);

            osc.connect(gain);

        } else if (profile.id === 'snd-retro') {
            // Cozy handheld voice: a warm duty-cycle pulse, a tiny octave
            // sparkle, and a nearly inaudible noise-channel button edge.
            const now = ctx.currentTime;
            const output = this.getProfileOutput(ctx);
            const dutyCycle = freq < 360 ? 0.5 : freq < 520 ? 0.375 : 0.25;

            osc.setPeriodicWave(this.createHandheldPulseWave(ctx, dutyCycle));
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.Q.value = 0.35;
            filter.frequency.setValueAtTime(Math.min(5200, Math.max(2400, freq * 7)), now);
            osc.connect(filter);
            filter.connect(gain);

            // A very brief octave grace note creates a playful console chirp
            // without turning every input into a long melody.
            const sparkleOsc = ctx.createOscillator();
            const sparkleGain = ctx.createGain();
            sparkleOsc.setPeriodicWave(this.createHandheldPulseWave(ctx, 0.25));
            sparkleOsc.frequency.setValueAtTime(freq * 2, now + 0.012);
            sparkleGain.gain.setValueAtTime(0, now);
            sparkleGain.gain.setValueAtTime(vol * 0.2, now + 0.012);
            sparkleGain.gain.setValueAtTime(vol * 0.1, now + 0.026);
            sparkleGain.gain.setValueAtTime(0.001, now + 0.04);
            sparkleOsc.connect(sparkleGain);
            sparkleGain.connect(output);
            sparkleOsc.start(now + 0.012);
            sparkleOsc.stop(now + 0.045);

            const clickDuration = 0.008;
            const clickBuffer = ctx.createBuffer(
                1,
                Math.max(1, Math.floor(ctx.sampleRate * clickDuration)),
                ctx.sampleRate
            );
            const clickData = clickBuffer.getChannelData(0);
            for (let i = 0; i < clickData.length; i++) {
                clickData[i] = Math.random() * 2 - 1;
            }
            const clickNoise = ctx.createBufferSource();
            const clickFilter = ctx.createBiquadFilter();
            const clickGain = ctx.createGain();
            clickNoise.buffer = clickBuffer;
            clickFilter.type = 'bandpass';
            clickFilter.frequency.setValueAtTime(2800, now);
            clickFilter.Q.value = 0.8;
            clickGain.gain.setValueAtTime(vol * 0.1, now);
            clickGain.gain.setValueAtTime(0.001, now + clickDuration);
            clickNoise.connect(clickFilter);
            clickFilter.connect(clickGain);
            clickGain.connect(output);
            clickNoise.start(now);
            clickNoise.stop(now + clickDuration);

        } else if (profile.id === 'snd-koto') {
            // Koto: a crisp plectrum strike, softened string harmonics, and a
            // quiet wooden-body resonance. Each strike varies very slightly so
            // repeated notes feel played rather than mechanically duplicated.
            const now = ctx.currentTime;
            const output = this.getProfileOutput(ctx);
            const velocityVariation = 0.94 + Math.random() * 0.08;
            const brightnessVariation = 0.94 + Math.random() * 0.12;

            osc.type = 'triangle';
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.Q.value = 1.8;
            filter.frequency.setValueAtTime(
                Math.min(6800, freq * 4.2 * brightnessVariation),
                now
            );
            filter.frequency.exponentialRampToValueAtTime(
                Math.max(600, freq * 1.18),
                now + Math.min(0.16, duration * 0.3)
            );
            osc.connect(filter);
            filter.connect(gain);

            // A brief saw layer provides the bright string edge without
            // leaving the full note sounding like a buzzy synthesizer.
            const harmonicOsc = ctx.createOscillator();
            const harmonicFilter = ctx.createBiquadFilter();
            const harmonicGain = ctx.createGain();
            harmonicOsc.type = 'sawtooth';
            harmonicOsc.frequency.setValueAtTime(freq * 1.007, now);
            harmonicOsc.frequency.exponentialRampToValueAtTime(freq, now + 0.055);
            harmonicFilter.type = 'lowpass';
            harmonicFilter.Q.value = 0.8;
            harmonicFilter.frequency.setValueAtTime(Math.min(7200, freq * 5), now);
            harmonicFilter.frequency.exponentialRampToValueAtTime(
                Math.max(900, freq * 1.8),
                now + 0.1
            );
            harmonicGain.gain.setValueAtTime(0, now);
            harmonicGain.gain.linearRampToValueAtTime(vol * 0.2 * velocityVariation, now + 0.002);
            harmonicGain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(0.16, duration * 0.28));
            harmonicOsc.connect(harmonicFilter);
            harmonicFilter.connect(harmonicGain);
            harmonicGain.connect(output);
            harmonicOsc.start(now);
            harmonicOsc.stop(now + Math.min(0.22, duration * 0.4));

            // The plectrum itself: a tiny band-passed noise impulse.
            const pickDuration = 0.018;
            const pickBuffer = ctx.createBuffer(
                1,
                Math.max(1, Math.floor(ctx.sampleRate * pickDuration)),
                ctx.sampleRate
            );
            const pickData = pickBuffer.getChannelData(0);
            for (let i = 0; i < pickData.length; i++) {
                pickData[i] = Math.random() * 2 - 1;
            }
            const pickNoise = ctx.createBufferSource();
            const pickFilter = ctx.createBiquadFilter();
            const pickGain = ctx.createGain();
            pickNoise.buffer = pickBuffer;
            pickFilter.type = 'bandpass';
            pickFilter.Q.value = 1.25;
            pickFilter.frequency.setValueAtTime(
                Math.min(4200, Math.max(1900, freq * 3.5)),
                now
            );
            pickGain.gain.setValueAtTime(vol * 0.16 * velocityVariation, now);
            pickGain.gain.exponentialRampToValueAtTime(0.001, now + pickDuration);
            pickNoise.connect(pickFilter);
            pickFilter.connect(pickGain);
            pickGain.connect(output);
            pickNoise.start(now);
            pickNoise.stop(now + pickDuration);

            // A subtle lower resonance gives the note a wooden instrument body
            // while remaining audible on small phone speakers.
            const bodyOsc = ctx.createOscillator();
            const bodyFilter = ctx.createBiquadFilter();
            const bodyGain = ctx.createGain();
            bodyOsc.type = 'sine';
            bodyOsc.frequency.setValueAtTime(Math.max(110, freq * 0.5), now);
            bodyFilter.type = 'bandpass';
            bodyFilter.Q.value = 1.1;
            bodyFilter.frequency.setValueAtTime(Math.max(240, freq * 0.72), now);
            bodyGain.gain.setValueAtTime(0, now);
            bodyGain.gain.linearRampToValueAtTime(vol * 0.075 * velocityVariation, now + 0.003);
            bodyGain.gain.exponentialRampToValueAtTime(0.001, now + Math.min(0.28, duration * 0.48));
            bodyOsc.connect(bodyFilter);
            bodyFilter.connect(bodyGain);
            bodyGain.connect(output);
            bodyOsc.start(now);
            bodyOsc.stop(now + Math.min(0.32, duration * 0.55));

        } else if (profile.id === 'snd-crystal') {
            // Crystal (Glassy Sine + Slight FM)
            osc.type = 'sine';
            
            // FM modulation for "shine"
            const mod = ctx.createOscillator();
            const modGain = ctx.createGain();
            mod.type = 'sine';
            mod.frequency.setValueAtTime(freq * 2.6, ctx.currentTime); // Inharmonic ratio
            modGain.gain.setValueAtTime(freq * 0.3, ctx.currentTime);
            modGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            
            mod.connect(modGain);
            modGain.connect(osc.frequency);
            mod.start();
            mod.stop(ctx.currentTime + duration);
            
            osc.connect(gain);

        } else {
            // Standard (Zen, Water, Retro)
            osc.type = type || (profile.type as any);
            osc.connect(gain);
        }
        
        // --- PITCH ENVELOPES ---
        
        if (profile.id === 'snd-water') {
            osc.frequency.setValueAtTime(freq * 0.5, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(freq, ctx.currentTime + 0.04);
            osc.frequency.linearRampToValueAtTime(freq * 1.1, ctx.currentTime + duration);

        } else if (profile.id === 'snd-koto') {
            // A restrained string-settling bend (about 9 cents) avoids the
            // conspicuously sharp attack of the previous 2% pitch change.
            osc.frequency.setValueAtTime(freq * 1.007, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + 0.055);

        } else if (profile.id === 'snd-wood' || profile.id === 'snd-stone' || profile.id === 'snd-mech' || profile.id === 'snd-retro' || profile.id === 'snd-crystal') {
             // Fixed pitch for these
             osc.frequency.setValueAtTime(freq, ctx.currentTime);
        } else if (profile.pitchDrop && !disablePitchDrop) {
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            const dropTarget = Math.max(20, freq * 0.1); 
            osc.frequency.exponentialRampToValueAtTime(dropTarget, ctx.currentTime + duration);
        } else {
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
        }

        // --- AMPLITUDE ENVELOPES ---
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        
        if (profile.id === 'snd-koto') {
             // Fast plectrum attack with a compact, uncluttered string tail.
             gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.002);
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        } else if (profile.id === 'snd-piano') {
             // Immediate hammer attack followed by a compact upright tail.
             gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.004);
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        } else if (profile.id === 'snd-wood' || profile.id === 'snd-mech') {
             gain.gain.setValueAtTime(vol, ctx.currentTime);
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        } else if (profile.id === 'snd-stone') {
             // Thuddy envelope
             gain.gain.setValueAtTime(0, ctx.currentTime);
             gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        } else if (profile.id === 'snd-water') {
             gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        } else if (profile.id === 'snd-retro') {
             // Deliberately stepped volume levels mimic a tiny digital channel.
             const end = ctx.currentTime + duration;
             gain.gain.setValueAtTime(vol, ctx.currentTime + 0.001);
             gain.gain.setValueAtTime(vol * 0.72, ctx.currentTime + Math.min(0.032, duration * 0.38));
             gain.gain.setValueAtTime(vol * 0.42, ctx.currentTime + Math.min(0.058, duration * 0.68));
             gain.gain.setValueAtTime(0.001, end);
        } else if (profile.id === 'snd-crystal') {
             // Crystal Envelope: Fast attack, very long tail
             gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        } else {
             // Zen / Default
             gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.002);
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        }

        gain.connect(this.getProfileOutput(ctx));

        osc.start();
        osc.stop(ctx.currentTime + duration + 0.2); 
    }

    playClick() {
        if (this.soundEnabled) {
            if (this.activeProfile.id === 'snd-piano') {
                const chord = [523.25, 783.99];
                chord.forEach((f, i) => {
                    setTimeout(() => {
                        this.playTone(f, 0.38, 0.2, undefined, undefined, true);
                    }, i * 24);
                });
            } else if (this.activeProfile.id === 'snd-koto') {
                // Compact two-string Koto strum.
                const chord = [329.63, 440.00];
                chord.forEach((f, i) => {
                    setTimeout(() => {
                        this.playTone(f, 0.52, 0.2, undefined, undefined, true);
                    }, i * 24);
                });
            } else if (this.activeProfile.id === 'snd-wood') {
                this.playTone(330, 0.1, 0.4, 'sine', undefined, true);
            } else if (this.activeProfile.id === 'snd-stone') {
                this.playTone(this.activeProfile.uiClickFreq, this.activeProfile.duration, 0.55, 'sine', undefined, true);
            } else if (this.activeProfile.id === 'snd-water') {
                this.playTone(800, 0.08, 0.3, 'sine', undefined, true);
            } else {
                this.playTone(this.activeProfile.uiClickFreq, this.activeProfile.duration, 0.4);
            }
        }
        
        if (this.vibrationEnabled) {
            Haptics.impact({ style: ImpactStyle.Light });
        }
    }

    playTap() {
        if (this.soundEnabled) {
            let freq = this.activeProfile.uiTapFreq;
            if (this.activeProfile.tapFreqs && this.activeProfile.tapFreqs.length > 0) {
                freq = this.activeProfile.tapFreqs[Math.floor(Math.random() * this.activeProfile.tapFreqs.length)];
            }
            this.playTone(freq, this.activeProfile.duration, 0.4);
        }
        if (this.vibrationEnabled) {
            Haptics.selectionStart();
        }
    }

    playNumber(num: number) {
        if (this.soundEnabled) {
            const freq = this.activeProfile.numberFreqs[num - 1] || 600;
            const vol = 0.6;
            this.playTone(freq, this.activeProfile.duration, vol);
        }
        if (this.vibrationEnabled) {
            Haptics.impact({ style: ImpactStyle.Medium });
        }
    }

    playBookRowReveal(_rowIndex: number) {
        if (!this.soundEnabled) return;

        // Every row gets the same short tap from the selected sound pack.
        // Keeping the pitch fixed prevents the cascade from sounding like a
        // scale or crescendo while retaining the pack's instrument character.
        const duration = Math.min(this.activeProfile.duration, 0.075);
        this.playTone(
            this.activeProfile.uiTapFreq,
            duration,
            0.28,
            undefined,
            undefined,
            true,
        );
    }

    playPop() {
        this.playClick();
    }

    playBubblePop() {
        this.playClick();
    }

    playPepinoTap() {
        if (this.soundEnabled) {
            const ctx = this.getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            // "Tiny Blip" - Cute and tactile
            // A5 (880Hz) to A6 (1760Hz) fast chirp
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); 
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.05); 
            
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01); 
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1); 
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        }
        // Light impact for tactility
        if (this.vibrationEnabled) {
            Haptics.impact({ style: ImpactStyle.Light });
        }
    }

    playCounterTick() {
        if (!this.soundEnabled) return;
        
        // Throttling to avoid buzzing on large number jumps
        const now = Date.now();
        if (now - this.lastTickTime < 50) return; 
        this.lastTickTime = now;

        const pid = this.activeProfile.id;
        
        if (pid === 'snd-paper') {
            this.playTone(1500, 0.01, 0.15, undefined, undefined, true); // Very short scratch
        } else if (pid === 'snd-wood') {
            this.playTone(800, 0.02, 0.15, 'sine', undefined, true);
        } else if (pid === 'snd-stone') {
            this.playTone(300, 0.02, 0.2, 'sine', undefined, true);
        } else if (pid === 'snd-water') {
            this.playTone(1000 + Math.random() * 200, 0.03, 0.15, 'sine', undefined, true);
        } else if (pid === 'snd-piano' || pid === 'snd-koto') {
            // High C7 is ~2093
            this.playTone(2093, 0.05, 0.1, 'triangle', undefined, true);
        } else if (pid === 'snd-retro') {
            this.playTone(1500, 0.02, 0.1, 'square', undefined, true);
        } else if (pid === 'snd-crystal') {
            this.playTone(2093, 0.05, 0.1, 'sine', undefined, true);
        } else {
            // Zen / Default
            this.playTone(1000, 0.02, 0.1, 'sine', undefined, true);
        }
    }

    playProgressFill(duration: number): () => void {
        if (!this.soundEnabled) return () => {};
        const ctx = this.getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        // Subtle rising tone ("charging" effect)
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        // Ramp pitch slightly
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + duration);

        // Lowpass filter opening up
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, ctx.currentTime);
        filter.frequency.linearRampToValueAtTime(800, ctx.currentTime + duration);

        gain.gain.setValueAtTime(0, ctx.currentTime);
        // Soft fade in
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 0.2);
        // Hold
        gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + duration - 0.2);
        // Soft fade out
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + duration);
        
        return () => {
            try {
                // Ramp down quickly to avoid click on stop
                gain.gain.cancelScheduledValues(ctx.currentTime);
                gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
                osc.stop(ctx.currentTime + 0.15);
            } catch(e) {}
        };
    }

    playDifficultyProgressHaptics(targetCount: number, duration: number = 1.5): () => void {
        const stepCount = Math.max(0, Math.min(100, Math.floor(targetCount)));
        if (stepCount === 0) return () => {};

        const hapticTimers: number[] = [];

        if (this.vibrationEnabled) {
            const pulseCount = Math.min(8, stepCount);
            for (let pulse = 1; pulse <= pulseCount; pulse++) {
                const timer = window.setTimeout(() => {
                    if (pulse === pulseCount) {
                        Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                    } else {
                        Haptics.selectionChanged().catch(() => {});
                    }
                }, Math.round((pulse / pulseCount) * duration * 1000));
                hapticTimers.push(timer);
            }
        }

        return () => {
            hapticTimers.forEach(timer => window.clearTimeout(timer));
        };
    }

    playUnlockReady() {
        // Opening the completed lock uses the exact victory sound belonging
        // to the currently selected sound pack.
        this.playWin();
    }

    playWin() {
        if (this.soundEnabled) {
            if (this.activeProfile.id === 'snd-koto') {
                // A celebratory Hirajoshi flourish using the same refined
                // instrument voice as normal gameplay.
                this.playProfileSequence(
                    [440.00, 523.25, 659.25, 880.00],
                    0.65,
                    0.42,
                    85,
                    this.activeProfile
                );
            } else if (this.activeProfile.id === 'snd-piano') {
                // Warm upright cadence with enough space for every hammer
                // attack to remain audible on a phone.
                this.playProfileSequence(
                    [523.25, 659.25, 783.99, 1046.50],
                    0.78,
                    0.34,
                    95,
                    this.activeProfile
                );
            } else if (this.activeProfile.id === 'snd-retro') {
                // A compact handheld victory jingle: recognizable and cheerful
                // without becoming an aggressive arcade fanfare.
                this.playProfileSequence(
                    [523.25, 659.25, 783.99, 1046.50],
                    0.1,
                    0.44,
                    72,
                    this.activeProfile
                );
            } else {
                // Minimalistic success chime (e.g., C6 -> G6)
                const ctx = this.getCtx();
                const time = ctx.currentTime;

                // First note
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(1046.50, time); // C6
                gain1.gain.setValueAtTime(0, time);
                gain1.gain.linearRampToValueAtTime(0.05, time + 0.05);
                gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
                osc1.connect(gain1);
                gain1.connect(ctx.destination);
                osc1.start(time);
                osc1.stop(time + 0.5);

                // Second note
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(1567.98, time + 0.15); // G6
                gain2.gain.setValueAtTime(0, time + 0.15);
                gain2.gain.linearRampToValueAtTime(0.08, time + 0.2);
                gain2.gain.exponentialRampToValueAtTime(0.001, time + 1.2);
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.start(time + 0.15);
                osc2.stop(time + 1.2);
            }
        }
        
        if (this.vibrationEnabled) {
            // Sync the phone haptic vibration perfectly with the melodic beats!
            // Patterns of vibrations & pauses (in ms): Vibrate 35ms, Rest 95ms, Vibrate 35ms, Rest 95ms...
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try {
                    navigator.vibrate([35, 95, 35, 95, 35, 95, 35, 95, 150]);
                } catch (e) {
                    // Ignore browser security restrictions for iframe haptics
                }
            }
            try {
                Haptics.notification({ type: NotificationType.Success });
            } catch (e) {
                // Fail-safe
            }
        }
    }

    playGiftClaim() {
        if (this.soundEnabled) {
            // A short, crisp, bright 3-note chime/arpeggio for receiving gifts or rewards
            const notes = [1046.50, 1318.51, 1567.98];
            const ctx = this.getCtx();
            const now = ctx.currentTime;

            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.04);
                
                const startTime = now + (i * 0.04);
                gain.gain.setValueAtTime(0, startTime);
                // Very fast attack
                gain.gain.linearRampToValueAtTime(0.08, startTime + 0.01);
                // Sharp decay for punchiness
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.22);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(startTime);
                osc.stop(startTime + 0.25);
            });
        }
        
        if (this.vibrationEnabled) {
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
                try {
                    // Crisp double-tap vibration
                    navigator.vibrate([30, 50, 30]);
                } catch (e) {}
            }
            try {
                Haptics.impact({ style: ImpactStyle.Medium });
            } catch (e) {}
        }
    }

    playLevelEnter() {
        if (this.vibrationEnabled) {
            // A compact two-step signature distinguishes entering a puzzle
            // from an ordinary UI tap without feeling heavy.
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
            window.setTimeout(() => {
                if (this.vibrationEnabled) {
                    Haptics.selectionChanged().catch(() => {});
                }
            }, 90);
        }

        if (!this.soundEnabled) return;

        const pid = this.activeProfile.id;

        if (pid === 'snd-paper') {
            this.playTone(600, 0.15, 0.5, undefined, undefined, true);
            setTimeout(() => this.playTone(1000, 0.1, 0.3, undefined, undefined, true), 100);
            
        } else if (pid === 'snd-wood') {
            const notes = [440, 587, 659, 783]; 
            notes.forEach((f, i) => {
                const delay = i * 40 + (Math.random() * 30);
                setTimeout(() => {
                    this.playTone(f, 0.1, 0.3, 'sine', undefined, true);
                }, delay);
            });

        } else if (pid === 'snd-water') {
             const notes = [800, 700, 600, 500];
             notes.forEach((f, i) => {
                 setTimeout(() => this.playTone(f, 0.08, 0.3), i * 60);
             });

        } else if (pid === 'snd-piano') {
            const notes = [261.63, 329.63, 392.00, 493.88];
            notes.forEach((f, i) => {
                setTimeout(() => this.playTone(f, 0.72, 0.36, undefined, undefined, true), i * 75);
            });
        } else if (pid === 'snd-koto') {
            // A restrained Hirajoshi welcome phrase that stays clear rather
            // than sustaining four overlapping one-second saw waves.
            const notes = [440.00, 493.88, 659.25, 880.00];
            notes.forEach((f, i) => {
                setTimeout(() => this.playTone(f, 0.58, 0.34, undefined, undefined, true), i * 70);
            });
        } else if (pid === 'snd-crystal') {
            [523, 659, 783].forEach((f, i) => {
                setTimeout(() => this.playTone(f, 0.2, 0.6, 'sine', undefined, true), i * 50);
            });
        } else if (pid === 'snd-stone') {
            // Keep the entrance grounded without dropping below phone speakers.
            this.playTone(220, 0.2, 0.65, 'sine', undefined, true);
        } else if (pid === 'snd-mech') {
            // Compact mechanical double action for the Type pack.
            this.playProfileSequence([1700, 2200], 0.065, 0.42, 65);
        } else if (pid === 'snd-retro') {
            // Retro Power Up: C4, E4, G4, C5 rapid
            const retroNotes = [261.63, 329.63, 392.00, 523.25];
            retroNotes.forEach((f, i) => {
                setTimeout(() => this.playTone(f, 0.1, 0.4, 'square', undefined, true), i * 60);
            });
        } else {
            const d = 0.035; 
            this.playTone(1200, d, 0.35, 'sine', undefined, true); 
            setTimeout(() => {
                this.playTone(1600, d, 0.35, 'sine', undefined, true);
            }, 60); 
        }
    }

    playScan() {
        this.playClick();
        if (this.soundEnabled) {
            const ctx = this.getCtx();
            const now = ctx.currentTime;
            const duration = 1.2;
            const scanOutput = ctx.createGain();
            scanOutput.gain.setValueAtTime(0.6, now);
            scanOutput.connect(ctx.destination);

            const tikOsc = ctx.createOscillator();
            const tikGain = ctx.createGain();
            tikOsc.type = 'square';
            tikOsc.frequency.setValueAtTime(2500, now);
            tikGain.gain.setValueAtTime(0, now);
            for(let i = 0; i < 12; i++) {
                const t = now + (i * (duration / 12));
                tikGain.gain.setTargetAtTime(0.06, t, 0.005);
                tikGain.gain.setTargetAtTime(0, t + 0.02, 0.005);
            }
            tikOsc.connect(tikGain);
            tikGain.connect(scanOutput);
            tikOsc.start(now);
            tikOsc.stop(now + duration);

            const bzzOsc = ctx.createOscillator();
            const bzzGain = ctx.createGain();
            bzzOsc.type = 'sawtooth';
            bzzOsc.frequency.setValueAtTime(120, now);
            bzzOsc.frequency.exponentialRampToValueAtTime(400, now + duration);
            bzzGain.gain.setValueAtTime(0, now);
            bzzGain.gain.linearRampToValueAtTime(0.045, now + 0.2); 
            bzzGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            bzzOsc.connect(bzzGain);
            bzzGain.connect(scanOutput);
            bzzOsc.start(now);
            bzzOsc.stop(now + duration);

            const chimeOsc = ctx.createOscillator();
            const chimeGain = ctx.createGain();
            chimeOsc.type = 'sine';
            chimeOsc.frequency.setValueAtTime(783.99, now + 0.3); 
            chimeOsc.frequency.exponentialRampToValueAtTime(1046.50, now + duration); 
            chimeGain.gain.setValueAtTime(0, now);
            chimeGain.gain.setTargetAtTime(0.0675, now + 0.4, 0.2); 
            chimeGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            chimeOsc.connect(chimeGain);
            chimeGain.connect(scanOutput);
            chimeOsc.start(now + 0.3);
            chimeOsc.stop(now + duration);

            const bufferSize = ctx.sampleRate * 0.5;
            const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = noiseBuffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }
            const whiteNoise = ctx.createBufferSource();
            whiteNoise.buffer = noiseBuffer;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0, now + duration - 0.4);
            noiseGain.gain.linearRampToValueAtTime(0.016875, now + duration - 0.2);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
            whiteNoise.connect(noiseGain);
            noiseGain.connect(scanOutput);
            whiteNoise.start(now + duration - 0.4);
        }

        if (this.vibrationEnabled) {
            Haptics.impact({ style: ImpactStyle.Medium });
            setTimeout(() => { if (this.vibrationEnabled) Haptics.impact({ style: ImpactStyle.Light }); }, 600);
        }
    }

    /**
     * A shared, deliberately tiny rejection cue for Guard. It bypasses the
     * active sound profile so the feedback stays identical in every pack.
     */
    playGuardBlocked() {
        if (!this.soundEnabled) return;

        const ctx = this.getCtx();
        const now = ctx.currentTime;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(560, now);
        filter.Q.setValueAtTime(0.7, now);
        filter.connect(ctx.destination);

        const playSoftErrorTone = (frequency: number, startOffset: number, duration: number, volume: number) => {
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = now + startOffset;

            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(frequency, start);
            oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.88, start + duration);

            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.linearRampToValueAtTime(volume, start + 0.006);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

            oscillator.connect(gain);
            gain.connect(filter);
            oscillator.start(start);
            oscillator.stop(start + duration + 0.01);
        };

        playSoftErrorTone(360, 0, 0.065, 0.05);
        playSoftErrorTone(245, 0.055, 0.09, 0.055);
    }

    playCheck() {
        if (!this.soundEnabled) return;
        const profile = this.activeProfile;
        const sequences: Record<string, { notes: number[]; duration: number; volume: number; spacing: number }> = {
            'snd-paper': { notes: [1800, 2400], duration: 0.04, volume: 0.42, spacing: 50 },
            'snd-retro': { notes: [783.99, 1046.50], duration: 0.09, volume: 0.44, spacing: 48 },
            'snd-wood': { notes: [659.25, 880], duration: 0.1, volume: 0.42, spacing: 40 },
            'snd-water': { notes: [1174.66, 1567.98], duration: 0.13, volume: 0.42, spacing: 45 },
            'snd-piano': { notes: [659.25, 987.77], duration: 0.46, volume: 0.34, spacing: 55 },
            'snd-stone': { notes: [329.63, 440], duration: 0.13, volume: 0.42, spacing: 50 },
            'snd-mech': { notes: [1800, 2400], duration: 0.06, volume: 0.44, spacing: 40 },
            'snd-koto': { notes: [523.25, 659.25], duration: 0.42, volume: 0.36, spacing: 55 },
            'snd-crystal': { notes: [1567.98, 2093], duration: 0.32, volume: 0.34, spacing: 40 },
            'snd-zen': { notes: [1318.51, 1975.53], duration: 0.16, volume: 0.36, spacing: 45 }
        };
        const sequence = sequences[profile.id] || sequences['snd-zen'];
        this.playProfileSequence(sequence.notes, sequence.duration, sequence.volume, sequence.spacing, profile);

        if (this.vibrationEnabled) {
            try {
                Haptics.impact({ style: ImpactStyle.Light });
                setTimeout(() => {
                    if (this.vibrationEnabled) {
                        Haptics.impact({ style: ImpactStyle.Light });
                    }
                }, 60);
            } catch (e) {}
        }
    }

    playSectionComplete() {
        if (!this.soundEnabled) return;
        const ctx = this.getCtx();
        const now = ctx.currentTime;
        const pid = this.activeProfile.id;
        const master = this.getProfileOutput(ctx);
        const completionOutput = ctx.createGain();
        completionOutput.gain.setValueAtTime(0.8, now);
        completionOutput.connect(master);

        if (pid === 'snd-paper') {
            // Satisfying 3-step crisp paper rustling ripple
            const centerFreqs = [1200, 1600, 2200];
            centerFreqs.forEach((freq, i) => {
                setTimeout(() => {
                    this.playTone(freq, 0.045, 0.28, undefined, undefined, true);
                }, i * 45);
            });
        } else if (pid === 'snd-mech') {
            this.playProfileSequence([1600, 2000, 2400], 0.065, 0.352, 45);
        } else if (pid === 'snd-retro') {
            // Warm three-note handheld completion phrase.
            this.playProfileSequence([523.25, 659.25, 783.99], 0.1, 0.4, 55);
        } else if (pid === 'snd-wood') {
            // Triple snappy wood-block percussion knocks
            const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                
                const mod = ctx.createOscillator();
                const modGain = ctx.createGain();
                mod.type = 'sine';
                mod.frequency.setValueAtTime(freq * 1.5, now + i * 0.045);
                modGain.gain.setValueAtTime(freq * 0.3, now + i * 0.045);
                mod.connect(modGain);
                modGain.connect(osc.frequency);
                
                osc.frequency.setValueAtTime(freq, now + i * 0.045);
                const start = now + i * 0.045;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.18, start + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
                
                osc.connect(gain);
                gain.connect(completionOutput);
                mod.start(start);
                osc.start(start);
                mod.stop(start + 0.12);
                osc.stop(start + 0.12);
            });
        } else if (pid === 'snd-water') {
            // Triple bubbly drops
            const notes = [1046.50, 1318.51, 1567.98]; // C6, E6, G6
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                const start = now + i * 0.055;
                osc.frequency.setValueAtTime(freq * 0.8, start);
                osc.frequency.exponentialRampToValueAtTime(freq * 1.15, start + 0.05);
                
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.12, start + 0.012);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
                
                osc.connect(gain);
                gain.connect(completionOutput);
                osc.start(start);
                osc.stop(start + 0.2);
            });
        } else if (pid === 'snd-piano') {
            // Compact upright arpeggio using the exact gameplay voice.
            this.playProfileSequence(
                [523.25, 659.25, 783.99, 987.77],
                0.62,
                0.2,
                60,
                this.activeProfile
            );
        } else if (pid === 'snd-stone') {
            // Resonant stone chime-thud
            const notes = [196.00, 261.63, 329.63]; // G3, C4, E4
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                
                const start = now + i * 0.06;
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.25, start + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
                
                osc.connect(gain);
                gain.connect(completionOutput);
                osc.start(start);
                osc.stop(start + 0.22);
            });
        } else if (pid === 'snd-koto') {
            // A brighter three-string cascade through the same refined Koto
            // voice used for number placement.
            this.playProfileSequence([440.00, 523.25, 659.25], 0.5, 0.34, 58);
        } else if (pid === 'snd-crystal') {
            // Glassy high shimmering crystals
            const notes = [1567.98, 2093.00, 2637.02]; // G6, C7, E7
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                
                const start = now + i * 0.05;
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.05, start + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
                
                osc.connect(gain);
                gain.connect(completionOutput);
                osc.start(start);
                osc.stop(start + 0.45);
            });
        } else {
            // Default Zen: Pure, beautiful, extremely satisfying 3-note ascending sine arpeggio
            const notes = [1318.51, 1567.98, 2093.00]; // E6, G6, C7
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                
                const start = now + (i * 0.055); // 55ms delay per note
                osc.frequency.setValueAtTime(freq, start);
                
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.08, start + 0.01); // Soft click-less attack
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18); // Snappy, clean ring-out
                
                osc.connect(gain);
                gain.connect(completionOutput);
                osc.start(start);
                osc.stop(start + 0.22);
            });
        }

        if (this.vibrationEnabled) {
            try {
                Haptics.impact({ style: ImpactStyle.Light });
                setTimeout(() => {
                    if (this.vibrationEnabled) {
                        Haptics.impact({ style: ImpactStyle.Light });
                    }
                }, 75);
            } catch (e) {}
        }
    }

    playPreview(profileId: string) {
        if (!this.soundEnabled) return;

        if (profileId === 'snd-glass') profileId = 'snd-water';
        if (profileId === 'snd-celeste') profileId = 'snd-piano';
        if (profileId === 'snd-drum') profileId = 'snd-crystal';
        if (profileId === 'snd-pop') profileId = 'snd-crystal';
        if (profileId === 'snd-harp') profileId = 'snd-koto';

        const profile = PROFILES[profileId];
        if (!profile) return;
        
        // Play the 5th number frequency as a sample
        const freq = profile.numberFreqs[4]; 
        
        // The preview uses exactly the same synthesis, pack calibration, and
        // master bus as gameplay—even for Paper's filtered noise profile.
        this.playTone(freq, profile.duration, 0.5, undefined, undefined, true, profile);
    }

    playSelectionHaptic() {
        if (!this.vibrationEnabled) return;
        Haptics.selectionChanged().catch(() => {});
    }
}

export const sounds = new SoundController();
