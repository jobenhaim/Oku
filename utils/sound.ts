
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
        volumeScale: 0.5, 
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
        volumeScale: 0.5,
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
        volumeScale: 1.0, // FM sounds can be quieter
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
        volumeScale: 0.6,
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
        volumeScale: 0.4,
        pitchDrop: false
    },
    'snd-stone': {
        id: 'snd-stone',
        type: 'sine',
        uiClickFreq: 150,
        uiTapFreq: 200,
        // Deep pentatonic or chromatic low
        numberFreqs: [130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63, 293.66],
        popFreq: 100,
        duration: 0.1,
        volumeScale: 1.5,
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
        volumeScale: 0.1,
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
        volumeScale: 0.1,
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
        volumeScale: 0.25,
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
        volumeScale: 0.25,
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
        if (profileId === 'snd-drum') profileId = 'snd-crystal';
        if (profileId === 'snd-pop') profileId = 'snd-crystal'; // Migrate Pop to Crystal
        if (profileId === 'snd-harp') profileId = 'snd-koto';
        
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
            // Stone Synthesis (Deep Sine + Noise)
            osc.type = 'sine';
            
            // Add subtle noise impulse for the "thud" impact
            const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for(let i=0; i<data.length; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource();
            noise.buffer = noiseBuffer;
            const noiseGain = ctx.createGain();
            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'lowpass';
            noiseFilter.frequency.value = 400;
            noiseGain.gain.setValueAtTime(volume * 0.5, ctx.currentTime);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.02);
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
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
            gain2.gain.setValueAtTime(volume * 0.5, ctx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
            osc2.connect(gain2);
            gain2.connect(ctx.destination);
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

        const scale = volumeScaleOverride !== undefined ? volumeScaleOverride : profile.volumeScale;
        const vol = volume * scale;
        
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
                this.playTone(150, 0.1, 0.6, 'sine', undefined, true);
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
            this.playNoiseBurst(1500, 0.01, 0.15); // Very short scratch
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
        if (!this.soundEnabled) return;

        const pid = this.activeProfile.id;

        if (pid === 'snd-paper') {
            this.playNoiseBurst(600, 0.15, 0.5);
            setTimeout(() => this.playNoiseBurst(1000, 0.1, 0.3), 100);
            
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
            this.playTone(100, 0.2, 0.8, 'sine', undefined, true);
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

    playZap() {
        // "Auto" Skill Sound - Removed to prevent overlapping with row/column/box completion sounds
        if (this.vibrationEnabled) {
            Haptics.impact({ style: ImpactStyle.Medium });
        }
    }

    playScan() {
        this.playClick();
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
        this.playClick();
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

    playSectionComplete() {
        if (!this.soundEnabled) return;
        const ctx = this.getCtx();
        const now = ctx.currentTime;
        const pid = this.activeProfile.id;

        if (pid === 'snd-paper') {
            // Satisfying 3-step crisp paper rustling ripple
            const centerFreqs = [1200, 1600, 2200];
            centerFreqs.forEach((freq, i) => {
                setTimeout(() => {
                    this.playNoiseBurst(freq, 0.045, 0.35);
                }, i * 45);
            });
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
                gain.connect(ctx.destination);
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
                gain.connect(ctx.destination);
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
                gain.connect(ctx.destination);
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
                gain.connect(ctx.destination);
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
                gain.connect(ctx.destination);
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
                gain.connect(ctx.destination);
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
                gain.connect(ctx.destination);
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
                gain.connect(ctx.destination);
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
