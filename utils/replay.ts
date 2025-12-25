
import { Board } from '../types';

export interface ReplayMove {
  row: number;
  col: number;
  value: number;
  t?: number;
}

// Audio Synthesis Helper
function createReplayAudio(ctx: AudioContext, dest: MediaStreamAudioDestinationNode) {
    // 1. Standard Move Pop (Crescendo feel)
    const playPop = (progress: number, t: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(dest);

        // Pitch scale: Exponential from G4 (~392Hz) to ~E6 (~1372Hz) based on progress
        // Adjusted to be less deep than C4 but not as high-pitched at the end as C5->C7
        const freq = 392.00 * Math.pow(3.5, progress);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        
        // Crisp, audible pop
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        
        osc.start(t);
        osc.stop(t + 0.1);
    };

    // 2. Subtle Premium Victory (Soft Chord Swell)
    const playVictory = (t: number) => {
        const notes = [523.25, 659.25, 783.99, 987.77];
        
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(dest);
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            
            const start = t + (i * 0.05); 
            
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.15, start + 0.1); 
            gain.gain.exponentialRampToValueAtTime(0.001, start + 2.0); 
            
            osc.start(start);
            osc.stop(start + 2.5);
        });
    };

    return { playPop, playVictory };
}

export async function generateReplayVideo(
  initialBoard: Board,
  moves: ReplayMove[],
  difficulty: string,
  levelId: number,
  isDark: boolean,
  totalTime: number
): Promise<string | null> {
  if (typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  const size = 1080;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Initialize Audio Context
  // IMPORTANT: This relies on the user gesture chain not being broken by setTimeout upstream
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();
  
  // Try to resume if suspended (iOS requirement).
  if (audioCtx.state === 'suspended') {
      try {
        await Promise.race([
            audioCtx.resume(),
            new Promise((_, reject) => setTimeout(() => reject('timeout'), 200))
        ]);
      } catch (e) {
        // Proceeding without audio if resume fails
        console.warn('Audio resume failed', e);
      }
  }

  // Only add audio track if context is actually running.
  const useAudio = audioCtx.state === 'running';

  const dest = audioCtx.createMediaStreamDestination();
  const { playPop, playVictory } = createReplayAudio(audioCtx, dest);

  // --- CONFIGURATION ---
  const FPS = 30;
  const MIN_FILL_MS = 2000;
  const INTRO_MS = 500; 
  const OUTRO_MS = 2000; 
  
  // Target max total duration ~8 seconds
  const TARGET_TOTAL_MS = 8000;
  const MAX_FILL_MS = TARGET_TOTAL_MS - INTRO_MS - OUTRO_MS; // 5500ms

  // Dynamic fill time: 
  // Base rate 100ms per move (faster than before), but clamped to ensure we don't exceed ~8s total video
  const FILL_MS = Math.min(MAX_FILL_MS, Math.max(MIN_FILL_MS, moves.length * 100));
  
  const INTRO_FRAMES = Math.floor((INTRO_MS / 1000) * FPS);
  const FILL_FRAMES = Math.floor((FILL_MS / 1000) * FPS);
  const OUTRO_FRAMES = Math.floor((OUTRO_MS / 1000) * FPS);
  const TOTAL_FRAMES = INTRO_FRAMES + FILL_FRAMES + OUTRO_FRAMES;
  const TOTAL_DURATION_MS = INTRO_MS + FILL_MS + OUTRO_MS;
  
  // Theme Colors
  const c = {
    bg: isDark ? '#1c1917' : '#fafaf9',
    boardBg: isDark ? '#292524' : '#ffffff',
    gridLineThin: isDark ? '#57534e' : '#e7e5e4',
    gridLineThick: isDark ? '#a8a29e' : '#78716c',
    textFixed: isDark ? '#f5f5f4' : '#292524',
    textInput: '#3b82f6',
    successBorder: '#10b981',
    watermark: isDark ? '#57534e' : '#a8a29e',
  };

  const padding = 120;
  const boardSize = size - (padding * 2);
  const cellSize = boardSize / 9;
  const startX = padding;
  const startY = padding;

  const moveCount = moves.length;
  const moveFrames = new Int32Array(moveCount);
  const availableFrames = Math.max(1, FILL_FRAMES - 5);
  
  for (let i = 0; i < moveCount; i++) {
      const progress = i / Math.max(1, moveCount - 1);
      moveFrames[i] = INTRO_FRAMES + Math.floor(progress * availableFrames);
  }

  const lastMoveFrame = moveCount > 0 ? moveFrames[moveCount - 1] : (INTRO_FRAMES + FILL_FRAMES);

  const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const drawLogo = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
    // scale factor k = s / 100
    const k = s / 100;
    
    const drawRect = (lx: number, ly: number, color1: string, color2: string) => {
        const rx = x + lx * k;
        const ry = y + ly * k;
        const rw = 42 * k;
        const rh = 42 * k;
        const rr = 12 * k;
        
        const grad = ctx.createLinearGradient(rx, ry, rx + rw, ry + rh);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        // Fallback for browsers/environments that might not support roundRect (though most do)
        if (ctx.roundRect) {
            ctx.roundRect(rx, ry, rw, rh, rr);
        } else {
            ctx.rect(rx, ry, rw, rh); // Fallback to square if needed
        }
        ctx.fill();
    };
    
    // TL - Gold
    drawRect(5, 5, '#E8BA6E', '#B78B4D');
    // TR - Silver
    drawRect(53, 5, '#F0F0F0', '#C0C0C0');
    // BL - Blue
    drawRect(5, 53, '#B8D3F5', '#79A6E3');
    // BR - Green
    drawRect(53, 53, '#B8DBBE', '#8CB794');
  };

  // --- VISUAL RENDERER ---
  const drawBoard = (frame: number) => {
      // Background
      ctx.fillStyle = c.bg;
      ctx.fillRect(0, 0, size, size);

      // Intro
      let globalOpacity = 1;
      if (frame < INTRO_FRAMES) {
          const t = frame / INTRO_FRAMES;
          globalOpacity = t * t * (3 - 2 * t);
      }

      ctx.save();
      ctx.globalAlpha = globalOpacity;

      // Header
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = c.textFixed;
      ctx.font = 'bold 40px "Outfit", sans-serif';
      const titleY = padding / 2;
      ctx.fillText(`${difficulty.toUpperCase()} • LEVEL ${levelId}`, size/2, titleY - 14);

      // Timer
      let currentSeconds = 0;
      if (frame < INTRO_FRAMES) {
          currentSeconds = 0;
      } else if (frame <= lastMoveFrame) {
          const duration = Math.max(1, lastMoveFrame - INTRO_FRAMES);
          const progress = (frame - INTRO_FRAMES) / duration;
          currentSeconds = totalTime * progress;
      } else {
          currentSeconds = totalTime;
      }
      
      ctx.font = 'bold 40px "Outfit", sans-serif';
      ctx.fillText(formatTime(currentSeconds), size/2, titleY + 31);

      // Watermark with Logo
      const watermarkText = "OKU: SUDOKU";
      const logoSize = 44;
      const logoSpacing = 16;
      
      ctx.font = '500 30px "Outfit", sans-serif';
      const textMetrics = ctx.measureText(watermarkText);
      const totalContentWidth = logoSize + logoSpacing + textMetrics.width;
      
      const contentStartX = (size - totalContentWidth) / 2;
      const contentCenterY = size - (padding / 2);
      
      // Draw Logo
      drawLogo(ctx, contentStartX, contentCenterY - (logoSize / 2), logoSize);
      
      // Draw Text
      ctx.textAlign = 'left';
      ctx.fillStyle = c.watermark;
      ctx.fillText(watermarkText, contentStartX + logoSize + logoSpacing, contentCenterY + 2);

      // Board Base
      ctx.shadowColor = "rgba(0,0,0,0.1)";
      ctx.shadowBlur = 30;
      ctx.shadowOffsetY = 10;
      ctx.fillStyle = c.boardBg;
      const r = 32;
      ctx.beginPath();
      // Use roundRect if available, polyfill/rect if not
      if (ctx.roundRect) {
         ctx.roundRect(startX, startY, boardSize, boardSize, r);
      } else {
         ctx.rect(startX, startY, boardSize, boardSize);
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;

      // Grid
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) {
         ctx.roundRect(startX, startY, boardSize, boardSize, r);
      } else {
         ctx.rect(startX, startY, boardSize, boardSize);
      }
      ctx.clip();

      ctx.lineCap = 'butt';
      for (let i = 1; i < 9; i++) {
          const pos = i * cellSize;
          const isThick = i % 3 === 0;
          ctx.lineWidth = isThick ? 6 : 2;
          ctx.strokeStyle = isThick ? c.gridLineThick : c.gridLineThin;
          
          ctx.beginPath();
          ctx.moveTo(startX + pos, startY);
          ctx.lineTo(startX + pos, startY + boardSize);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(startX, startY + pos);
          ctx.lineTo(startX + boardSize, startY + pos);
          ctx.stroke();
      }
      ctx.restore();

      // Numbers
      ctx.textAlign = 'center'; // Reset alignment for numbers
      ctx.font = `600 ${cellSize * 0.6}px "Outfit", sans-serif`;
      ctx.fillStyle = c.textFixed;
      
      initialBoard.forEach(row => {
          row.forEach(cell => {
              if (cell.isFixed && cell.value) {
                  const cx = startX + (cell.col * cellSize) + (cellSize / 2);
                  const cy = startY + (cell.row * cellSize) + (cellSize / 2);
                  ctx.fillText(cell.value.toString(), cx, cy + (cellSize * 0.05));
              }
          });
      });

      if (frame >= INTRO_FRAMES) {
          ctx.font = `500 ${cellSize * 0.6}px "Outfit", sans-serif`;
          ctx.fillStyle = c.textInput;
          
          for (let i = 0; i < moveCount; i++) {
              const startFrame = moveFrames[i];
              if (frame >= startFrame) {
                  const move = moves[i];
                  const cx = startX + (move.col * cellSize) + (cellSize / 2);
                  const cy = startY + (move.row * cellSize) + (cellSize / 2);
                  
                  const age = frame - startFrame;
                  let numScale = 1;
                  if (age < 5) numScale = 1.0 + (0.5 * (1 - (age / 5)));
                  
                  ctx.save();
                  ctx.translate(cx, cy);
                  ctx.scale(numScale, numScale);
                  ctx.fillText(move.value.toString(), 0, (cellSize * 0.05));
                  ctx.restore();
              }
          }
      }

      if (frame >= INTRO_FRAMES + FILL_FRAMES) {
          const outroAge = frame - (INTRO_FRAMES + FILL_FRAMES);
          const alpha = Math.min(1, outroAge / 10);
          ctx.lineWidth = 12;
          ctx.strokeStyle = c.successBorder;
          ctx.globalAlpha = alpha * globalOpacity;
          ctx.beginPath();
          if (ctx.roundRect) {
             ctx.roundRect(startX - 2, startY - 2, boardSize + 4, boardSize + 4, r + 2);
          } else {
             ctx.rect(startX - 2, startY - 2, boardSize + 4, boardSize + 4);
          }
          ctx.stroke();
      }

      ctx.restore();
  };

  // --- RECORDING SETUP ---
  drawBoard(0);

  const stream = canvas.captureStream(FPS);
  if (useAudio) {
      // Correct way to get track from stream destination
      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
          stream.addTrack(audioTrack);
      }
  }

  // Prioritize video/mp4 for iOS Safari
  let mimeType = 'video/webm';
  const possibleTypes = [
    'video/mp4; codecs=avc1', 
    'video/mp4',
    'video/webm; codecs=vp9', 
    'video/webm'
  ];
  for (const t of possibleTypes) {
      if (MediaRecorder.isTypeSupported(t)) {
          mimeType = t;
          break;
      }
  }

  let mediaRecorder: MediaRecorder;
  try {
      mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2500000 });
  } catch (e) {
      console.error("MediaRecorder creation failed", e);
      try { audioCtx.close(); } catch {}
      return null;
  }

  const chunks: Blob[] = [];
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const handleVisibilityChange = () => {
      if (document.hidden && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
      }
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);

  // Safety Timer
  const safetyTimeout = setTimeout(() => {
      if (mediaRecorder.state === 'recording') mediaRecorder.stop();
  }, TOTAL_DURATION_MS + 4000);

  const recordingPromise = new Promise<string | null>((resolve) => {
    mediaRecorder.onstop = () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearTimeout(safetyTimeout);
      try { audioCtx.close(); } catch(e) {}
      
      if (chunks.length === 0) {
           resolve(null);
           return;
      }
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      resolve(url);
    };
    mediaRecorder.onerror = (e) => {
        console.error("MediaRecorder error", e);
        try { audioCtx.close(); } catch(e2) {}
        resolve(null);
    };
  });

  // Start Recording
  try {
      mediaRecorder.start();
  } catch (e) {
      console.error("MediaRecorder start failed", e);
      try { audioCtx.close(); } catch {}
      return null;
  }

  // Schedule Audio (only if enabled)
  const startTime = audioCtx.currentTime;
  if (useAudio) {
      for (let i = 0; i < moveCount; i++) {
          const timeOffset = moveFrames[i] / FPS; 
          playPop(i / Math.max(1, moveCount), startTime + timeOffset + 0.05);
      }
      const victoryTime = (INTRO_FRAMES + FILL_FRAMES) / FPS;
      playVictory(startTime + victoryTime + 0.05);
  }

  // Visual Loop (Decoupled)
  const startWallTime = performance.now();
  const render = () => {
      try {
          const now = performance.now();
          const elapsed = (now - startWallTime) / 1000;
          const currentFrame = Math.floor(elapsed * FPS);
          
          if (currentFrame > TOTAL_FRAMES + 3) { 
              if (mediaRecorder.state === 'recording') mediaRecorder.stop();
              return;
          }
          
          drawBoard(currentFrame);
          requestAnimationFrame(render);
      } catch (e) {
          console.error("Render loop error", e);
          if (mediaRecorder.state === 'recording') mediaRecorder.stop();
      }
  };
  requestAnimationFrame(render);

  return recordingPromise;
}
