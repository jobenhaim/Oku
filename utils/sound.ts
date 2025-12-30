
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

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
        volumeScale: 1.0, 
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
        volumeScale: 0.9,
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
        volumeScale: 1.4, // FM sounds can be quieter
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
        volumeScale: 0.9,
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
        volumeScale: 0.6,
        pitchDrop: false
    }
};

class SoundController {
    private ctx: AudioContext | null = null;
    private soundEnabled: boolean = true;
    private vibrationEnabled: boolean = true;
    private activeProfile: SoundProfile = PROFILES['snd-zen'];
    private lastTickTime: number = 0;

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
        
        if (PROFILES[profileId]) {
            this.activeProfile = PROFILES[profileId];
        } else {
            this.activeProfile = PROFILES['snd-zen'];
        }
    }

    private getCtx() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
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
        gain.connect(ctx.destination);

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

        // Paper handling
        if (profile.id === 'snd-paper') {
            this.playNoiseBurst(profile.noiseFilterFreq || 800, duration, volume * profile.volumeScale);
            return;
        }

        const ctx = this.getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        // --- SYNTHESIS LOGIC ---

        if (profile.id === 'snd-wood') {
             // Forest/Log Synthesis (FM)
             // Carrier: Sine
             // Modulator: Sine (Ratio 2:1 for hollow, woody sound)
             osc.type = 'sine';
             
             const mod = ctx.createOscillator();
             const modGain = ctx.createGain();
             
             mod.type = 'sine';
             mod.frequency.setValueAtTime(freq * 2.0, ctx.currentTime);
             
             // Mod Index Envelope (The "Thwack")
             // High modulation at start (complex tone), fast decay to pure sine (resonance)
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
            
        } else {
            // Standard (Zen, Water)
            osc.type = type || (profile.type as any);
            osc.connect(gain);
        }
        
        // --- PITCH ENVELOPES ---
        
        if (profile.id === 'snd-water') {
            // Water Bubble Physics: Pitch Ramps UP ("Bloop")
            // Start lower, slide up quickly to target freq
            osc.frequency.setValueAtTime(freq * 0.5, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(freq, ctx.currentTime + 0.04);
            // Slight overshoot for bubble pop effect?
            osc.frequency.linearRampToValueAtTime(freq * 1.1, ctx.currentTime + duration);

        } else if (profile.id === 'snd-wood') {
             // Wood stays relatively constant pitch (FM handles the transient)
             osc.frequency.setValueAtTime(freq, ctx.currentTime);
        } else if (profile.pitchDrop && !disablePitchDrop) {
            // Zen/Standard Drop
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            const dropTarget = Math.max(20, freq * 0.1); 
            osc.frequency.exponentialRampToValueAtTime(dropTarget, ctx.currentTime + duration);
        } else {
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
        }

        const scale = volumeScaleOverride !== undefined ? volumeScaleOverride : profile.volumeScale;
        const vol = volume * scale;
        
        // --- AMPLITUDE ENVELOPES ---
        
        gain.gain.setValueAtTime(0, ctx.currentTime);
        
        if (profile.id === 'snd-piano') {
             gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.015);
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        } else if (profile.id === 'snd-wood') {
             // Perussive: Instant attack, fast exponential decay
             gain.gain.setValueAtTime(vol, ctx.currentTime);
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        } else if (profile.id === 'snd-water') {
             // Bubble: Softer attack, quick decay
             gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.02);
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        } else {
             // Zen
             gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.002);
             gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        }

        gain.connect(ctx.destination);

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
            } else if (this.activeProfile.id === 'snd-wood') {
                // Dry hollow click
                this.playTone(330, 0.1, 0.4, 'sine', undefined, true);
            } else if (this.activeProfile.id === 'snd-water') {
                // High bubble click
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
        if (this.soundEnabled) {
            // New Fun Pop: Quick upward sweep
            const ctx = this.getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            // Start low, go high quickly
            osc.frequency.setValueAtTime(400, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
            
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        }
        if (this.vibrationEnabled) {
            Haptics.impact({ style: ImpactStyle.Light });
        }
    }

    playBubblePop() {
        if (this.soundEnabled) {
            const ctx = this.getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            // "Bloop" - start lower, rise fast, short decay
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
            
            gain.gain.setValueAtTime(0, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.8, ctx.currentTime + 0.01); // Fast attack
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1); // Short decay
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        }
        if (this.vibrationEnabled) {
            Haptics.impact({ style: ImpactStyle.Light });
        }
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
            this.playNoiseBurst(1500, 0.01, 0.15); // Very short scratch
        } else if (pid === 'snd-wood') {
            this.playTone(800, 0.02, 0.15, 'sine', undefined, true);
        } else if (pid === 'snd-water') {
            this.playTone(1000 + Math.random() * 200, 0.03, 0.15, 'sine', undefined, true);
        } else if (pid === 'snd-piano') {
            // High C7 is ~2093
            this.playTone(2093, 0.05, 0.1, 'triangle', undefined, true);
        } else {
            // Zen / Default
            this.playTone(1000, 0.02, 0.1, 'sine', undefined, true);
        }
    }

    playWin() {
        if (this.soundEnabled) {
            const sequence = [1046.50, 1318.51, 1567.98, 2093.00]; 
            const timings = [0, 60, 120, 180]; 
            
            sequence.forEach((freq, i) => {
                setTimeout(() => {
                    const ctx = this.getCtx();
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(freq, ctx.currentTime);
                    gain.gain.setValueAtTime(0, ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.01);
                    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 0.25);
                }, timings[i]);
            });
        }
        if (this.vibrationEnabled) {
            Haptics.notification({ type: NotificationType.Success });
        }
    }

    playLevelEnter() {
        if (!this.soundEnabled) return;

        const pid = this.activeProfile.id;

        if (pid === 'snd-paper') {
            this.playNoiseBurst(600, 0.15, 0.5);
            setTimeout(() => this.playNoiseBurst(1000, 0.1, 0.3), 100);
            
        } else if (pid === 'snd-wood') {
            // Forest Rattle: Random pentatonic notes
            const notes = [440, 587, 659, 783]; 
            notes.forEach((f, i) => {
                const delay = i * 40 + (Math.random() * 30);
                setTimeout(() => {
                    this.playTone(f, 0.1, 0.3, 'sine', undefined, true);
                }, delay);
            });

        } else if (pid === 'snd-water') {
             // River Stream: Rapid bubbling cascade
             const notes = [800, 700, 600, 500];
             notes.forEach((f, i) => {
                 setTimeout(() => this.playTone(f, 0.08, 0.3), i * 60);
             });

        } else if (pid === 'snd-piano') {
            const notes = [261.63, 329.63, 392.00, 493.88];
            notes.forEach((f, i) => {
                setTimeout(() => this.playTone(f, 1.0, 0.4, 'triangle', undefined, false), i * 60);
            });
        } else {
            const d = 0.035; 
            this.playTone(1200, d, 0.5, 'sine', undefined, true); 
            setTimeout(() => {
                this.playTone(1600, d, 0.5, 'sine', undefined, true);
            }, 60); 
        }
    }

    playZap() {
        // "Auto" Skill Sound - Satisfying "Snap + Ding"
        if (this.soundEnabled) {
            const ctx = this.getCtx();
            const now = ctx.currentTime;
            
            // 1. The Snap (Percussive, Mechanical)
            const snapOsc = ctx.createOscillator();
            const snapGain = ctx.createGain();
            
            snapOsc.type = 'triangle'; // Sharper than sine
            snapOsc.frequency.setValueAtTime(300, now);
            snapOsc.frequency.exponentialRampToValueAtTime(50, now + 0.1); // Quick drop
            
            snapGain.gain.setValueAtTime(0, now);
            snapGain.gain.linearRampToValueAtTime(0.4, now + 0.01);
            snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            
            snapOsc.connect(snapGain);
            snapGain.connect(ctx.destination);
            snapOsc.start(now);
            snapOsc.stop(now + 0.15);

            // 2. The Ding (Confirmation, High Pitch)
            const dingOsc = ctx.createOscillator();
            const dingGain = ctx.createGain();
            
            dingOsc.type = 'sine';
            dingOsc.frequency.setValueAtTime(1046.50, now); // C6
            
            dingGain.gain.setValueAtTime(0, now);
            dingGain.gain.linearRampToValueAtTime(0.2, now + 0.02);
            dingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
            
            dingOsc.connect(dingGain);
            dingGain.connect(ctx.destination);
            dingOsc.start(now);
            dingOsc.stop(now + 0.45);
        }

        if (this.vibrationEnabled) {
            Haptics.impact({ style: ImpactStyle.Medium });
        }
    }

    playScan() {
        if (this.soundEnabled) {
            const ctx = this.getCtx();
            const now = ctx.currentTime;
            const duration = 1.2;

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
            tikGain.connect(ctx.destination);
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
            bzzGain.connect(ctx.destination);
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
            chimeGain.connect(ctx.destination);
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
            noiseGain.connect(ctx.destination);
            whiteNoise.start(now + duration - 0.4);
        }

        if (this.vibrationEnabled) {
            Haptics.impact({ style: ImpactStyle.Medium });
            setTimeout(() => { if (this.vibrationEnabled) Haptics.impact({ style: ImpactStyle.Light }); }, 600);
        }
    }

    playReveal() {
        if (!this.soundEnabled) return;
        const ctx = this.getCtx();
        const now = ctx.currentTime;

        // Consistent "Magical" Chord: C Major Add9 (C, E, G, D)
        // This plays regardless of the selected sound pack
        const frequencies = [523.25, 659.25, 783.99, 1174.66]; 
        
        frequencies.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            // Use Sine for pure magic sound
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            
            // Staggered entry for "shimmer" effect
            const startTime = now + (i * 0.06);
            
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.05); // Soft attack
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.2); // Long decay
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(startTime);
            osc.stop(startTime + 1.3);
        });
    }

    playPreview(profileId: string) {
        if (!this.soundEnabled) return;

        if (profileId === 'snd-glass') profileId = 'snd-water';
        if (profileId === 'snd-celeste') profileId = 'snd-piano';

        const profile = PROFILES[profileId];
        if (!profile) return;
        
        // Play the 5th number frequency as a sample
        const freq = profile.numberFreqs[4]; 
        
        if (profile.type === 'noise') {
             this.playNoiseBurst(profile.noiseFilterFreq || 800, profile.duration, 0.6);
        } else {
             // Preview uses playTone logic directly to match synthesis
             // Pass the profile explicitly to playTone so it uses the correct synthesis logic
             this.playTone(freq, profile.duration, 0.5, undefined, undefined, undefined, profile);
        }
    }
}

export const sounds = new SoundController();
