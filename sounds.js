// Sound effect management using Web Audio API

let audioContext = null;
let soundEnabled = true;

/**
 * Initialize audio context (must be called after user interaction)
 */
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

/**
 * Play a typing key sound
 */
export function playKeySound() {
  if (!soundEnabled) return;
  try {
    const ctx = initAudio();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800 + Math.random() * 200, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(0.03, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.08);
  } catch (e) {
    // Silently fail
  }
}

/**
 * Play an error sound
 */
export function playErrorSound() {
  if (!soundEnabled) return;
  try {
    const ctx = initAudio();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(200, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(0.04, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  } catch (e) {
    // Silently fail
  }
}

/**
 * Play a completion/success sound
 */
export function playSuccessSound() {
  if (!soundEnabled) return;
  try {
    const ctx = initAudio();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    
    notes.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12);
      
      gainNode.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
      gainNode.gain.linearRampToValueAtTime(0.06, ctx.currentTime + i * 0.12 + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3);
      
      oscillator.start(ctx.currentTime + i * 0.12);
      oscillator.stop(ctx.currentTime + i * 0.12 + 0.3);
    });
  } catch (e) {
    // Silently fail
  }
}

/**
 * Toggle sound on/off
 * @returns {boolean} New sound state
 */
export function toggleSound() {
  soundEnabled = !soundEnabled;
  localStorage.setItem('typingtest_sound', soundEnabled ? '1' : '0');
  return soundEnabled;
}

/**
 * Get current sound state
 * @returns {boolean}
 */
export function isSoundEnabled() {
  const stored = localStorage.getItem('typingtest_sound');
  if (stored !== null) {
    soundEnabled = stored === '1';
  }
  return soundEnabled;
}
