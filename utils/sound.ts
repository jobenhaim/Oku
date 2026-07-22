
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
        duration: 1.5, // Long sustained tail
        volumeScale: 0.48,
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
        uiTapFreq: 880,
        // C Major Scale High
        numberFreqs: [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50, 1174.66],
        popFreq: 220,
        duration: 0.1,
        volumeScale: 0.06,
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
        duration: 1.0, 
        volumeScale: 0.32,
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
            // Piano Synthesis (Filtered Triangle)
            osc.type = 'triangle';
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.Q.value = 0.5; 
            filter.frequency.setValueAtTime(Math.min(freq * 6, 8000), ctx.currentTime); 
            filter.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.3);
            osc.connect(filter);
            filter.connect(gain);
            
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

        } else if (profile.id === 'snd-koto') {
            // Koto (Twangy Pluck)
            osc.type = 'sawtooth';
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.Q.value = 2; // Resonance for the twang
            
            filter.frequency.setValueAtTime(freq * 4, ctx.currentTime);
            filter.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + 0.2);
            
            osc.connect(filter);
            filter.connect(gain);

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
            // Koto: Slight pitch bend down (string settling)
            osc.frequency.setValueAtTime(freq * 1.02, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(freq, ctx.currentTime + 0.1);

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
        
        if (profile.id === 'snd-piano' || profile.id === 'snd-koto') {
             // Plucked/Struck String Envelope
             gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.01);
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
             // Square wave gate-like envelope
             gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
             gain.gain.setValueAtTime(vol, ctx.currentTime + duration - 0.02);
             gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
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
                const chord = [261.63, 329.63, 392.00]; 
                chord.forEach((f, i) => {
                    setTimeout(() => {
                        this.playTone(f, 0.6, 0.2, 'triangle', undefined, true); 
                    }, i * 12); 
                });
            } else if (this.activeProfile.id === 'snd-koto') {
                // Quick strum for Koto
                const chord = [329.63, 440.00]; 
                chord.forEach((f, i) => {
                    setTimeout(() => {
                        this.playTone(f, 0.8, 0.2, 'sawtooth', undefined, true);
                    }, i * 20); 
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
        if (!this.soundEnabled) return;
        const ctx = this.getCtx();
        
        // "Unlock Ready" Chime: Bright, Magical
        // C6, E6, G6, C7
        const notes = [1046.50, 1318.51, 1567.98, 2093.00];
        
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            
            const start = ctx.currentTime + (i * 0.08); // Slight stagger
            
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.1, start + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 1.5);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(start);
            osc.stop(start + 1.6);
        });

        if (this.vibrationEnabled) {
             Haptics.notification({ type: NotificationType.Success });
        }
    }

    playWin() {
        if (this.soundEnabled) {
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

        } else if (pid === 'snd-piano' || pid === 'snd-koto') {
            const notes = [261.63, 329.63, 392.00, 493.88];
            const type = pid === 'snd-koto' ? 'sawtooth' : 'triangle';
            notes.forEach((f, i) => {
                setTimeout(() => this.playTone(f, 1.0, 0.4, type as any, undefined, false), i * 60);
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

    playCheck() {
        if (!this.soundEnabled) return;
        const profile = this.activeProfile;
        const sequences: Record<string, { notes: number[]; duration: number; volume: number; spacing: number }> = {
            'snd-paper': { notes: [1800, 2400], duration: 0.04, volume: 0.42, spacing: 50 },
            'snd-retro': { notes: [1318.51, 1975.53], duration: 0.09, volume: 0.46, spacing: 40 },
            'snd-wood': { notes: [659.25, 880], duration: 0.1, volume: 0.42, spacing: 40 },
            'snd-water': { notes: [1174.66, 1567.98], duration: 0.13, volume: 0.42, spacing: 45 },
            'snd-piano': { notes: [659.25, 987.77], duration: 0.35, volume: 0.36, spacing: 40 },
            'snd-stone': { notes: [329.63, 440], duration: 0.13, volume: 0.42, spacing: 50 },
            'snd-mech': { notes: [1800, 2400], duration: 0.06, volume: 0.44, spacing: 40 },
            'snd-koto': { notes: [523.25, 659.25], duration: 0.3, volume: 0.36, spacing: 40 },
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

        if (pid === 'snd-paper') {
            // Satisfying 3-step crisp paper rustling ripple
            const centerFreqs = [1200, 1600, 2200];
            centerFreqs.forEach((freq, i) => {
                setTimeout(() => {
                    this.playTone(freq, 0.045, 0.35, undefined, undefined, true);
                }, i * 45);
            });
        } else if (pid === 'snd-mech') {
            this.playProfileSequence([1600, 2000, 2400], 0.065, 0.44, 45);
        } else if (pid === 'snd-retro') {
            // Rapid ascending arcade blips
            const notes = [1046.50, 1318.51, 1567.98]; // C6, E6, G6
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'square';
                osc.frequency.setValueAtTime(freq, now + i * 0.05);
                const start = now + i * 0.05;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.04, start + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
                osc.connect(gain);
                gain.connect(master);
                osc.start(start);
                osc.stop(start + 0.15);
            });
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
                gain.connect(master);
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
                gain.connect(master);
                osc.start(start);
                osc.stop(start + 0.2);
            });
        } else if (pid === 'snd-piano') {
            // Beautiful piano chord-arpeggio
            const notes = [523.25, 659.25, 783.99, 987.77]; // C5, E5, G5, B5
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const filter = ctx.createBiquadFilter();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                filter.type = 'lowpass';
                filter.Q.value = 1;
                filter.frequency.setValueAtTime(freq * 3, now + i * 0.04);
                filter.frequency.exponentialRampToValueAtTime(freq * 1.2, now + i * 0.04 + 0.2);
                
                osc.frequency.setValueAtTime(freq, now + i * 0.04);
                const start = now + i * 0.04;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.12, start + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(master);
                osc.start(start);
                osc.stop(start + 0.5);
            });
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
                gain.connect(master);
                osc.start(start);
                osc.stop(start + 0.22);
            });
        } else if (pid === 'snd-koto') {
            // Traditional Japanese pluck cascade
            const notes = [440.00, 523.25, 659.25]; // A4, C5, E5
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const filter = ctx.createBiquadFilter();
                const gain = ctx.createGain();
                osc.type = 'sawtooth';
                filter.type = 'lowpass';
                filter.Q.value = 2;
                filter.frequency.setValueAtTime(freq * 3, now + i * 0.05);
                filter.frequency.exponentialRampToValueAtTime(freq * 1.1, now + i * 0.05 + 0.15);
                
                const start = now + i * 0.05;
                osc.frequency.setValueAtTime(freq, start);
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.1, start + 0.005);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
                
                osc.connect(filter);
                filter.connect(gain);
                gain.connect(master);
                osc.start(start);
                osc.stop(start + 0.4);
            });
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
                gain.connect(master);
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
                gain.connect(master);
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
