// Main application logic
import { getRandomSentences, getLanguages, getDifficulties } from './sentences.js';
import { addScore, getTop10, formatDate, getLeaderboardMode } from './leaderboard.js';
import { playKeySound, playErrorSound, playSuccessSound, toggleSound, isSoundEnabled } from './sounds.js';
import { launchConfetti } from './confetti.js';
import { renderErrorTable, renderPerformanceGraph, renderHighlights } from './analytics.js';

const TEST_CONFIG = {
  sentenceCountByDifficulty: { easy: 2, medium: 3, hard: 4 },
  highScoreWpmThreshold: 60,
  highAccuracyThreshold: 95,
  loadingDelayMs: 100,
  confettiDelayMs: 300,
  confettiDurationMs: 3000,
  inputErrorFlashMs: 1500
};

const RESULT_TIERS = [
  { minWpm: 80, title: '🔥 Incredible Speed!', subtitle: 'You are a typing master!' },
  { minWpm: 60, title: '⚡ Great Job!', subtitle: 'Above average typing speed!' },
  { minWpm: 40, title: '👍 Nice Work!', subtitle: 'Keep practicing to improve!' },
  { minWpm: 0, title: '✨ Test Complete!', subtitle: 'Practice makes perfect!' }
];

// ===== State =====
const state = {
  username: '',
  language: 'id',
  difficulty: 'medium',
  duration: 30,
  timeLeft: 30,
  isRunning: false,
  isFinished: false,
  timer: null,
  text: '',
  typedChars: 0,
  correctChars: 0,
  errorCount: 0,
  startTime: null,
  // Analytics tracking
  errorLog: [],        // {typed, expected, position, time}
  wpmSnapshots: [],    // {time, wpm, errors} per second
  lastSnapshotTime: 0,
  prevErrorCount: 0
};

// ===== DOM Elements =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  loginScreen: $('#login-screen'),
  appScreen: $('#app-screen'),
  usernameInput: $('#username-input'),
  loginBtn: $('#login-btn'),
  displayUsername: $('#display-username'),
  logoutBtn: $('#logout-btn'),
  themeToggle: $('#theme-toggle'),
  soundToggle: $('#sound-toggle'),
  langSelector: $('#lang-selector'),
  diffSelector: $('#diff-selector'),
  timeSelector: $('#time-selector'),
  timerDisplay: $('#timer-display'),
  liveWpm: $('#live-wpm'),
  liveAccuracy: $('#live-accuracy'),
  liveErrors: $('#live-errors'),
  progressBar: $('#progress-bar'),
  textDisplay: $('#text-display'),
  typingInput: $('#typing-input'),
  restartBtn: $('#restart-btn'),
  newTextBtn: $('#new-text-btn'),
  resultsModal: $('#results-modal'),
  resultWpm: $('#result-wpm'),
  resultAccuracy: $('#result-accuracy'),
  resultErrors: $('#result-errors'),
  resultChars: $('#result-chars'),
  resultsTitle: $('#results-title'),
  resultsSubtitle: $('#results-subtitle'),
  resultRestart: $('#result-restart'),
  resultLeaderboard: $('#result-leaderboard'),
  resultClose: $('#result-close'),
  leaderboardBody: $('#leaderboard-body'),
  leaderboardEmpty: $('#leaderboard-empty'),
  leaderboardStatus: $('#lb-status'),
  lbLangFilter: $('#lb-lang-filter'),
  lbDiffFilter: $('#lb-diff-filter'),
  // Analytics elements
  wpmGraph: $('#wpm-graph'),
  errorTableContainer: $('#error-table-container'),
  highlightsContainer: $('#highlights-container')
};

// ===== Initialization =====
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSound();
  checkAutoLogin();
  setupEventListeners();
});

// ===== Theme =====
function initTheme() {
  const saved = localStorage.getItem('typingtest_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('typingtest_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icon = els.themeToggle.querySelector('i');
  icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
}

// ===== Sound =====
function initSound() {
  const enabled = isSoundEnabled();
  updateSoundIcon(enabled);
}

function updateSoundIcon(enabled) {
  const icon = els.soundToggle.querySelector('i');
  icon.className = enabled ? 'fas fa-volume-high' : 'fas fa-volume-xmark';
}

// ===== Auth =====
function checkAutoLogin() {
  const saved = localStorage.getItem('typingtest_username');
  if (saved) {
    state.username = saved;
    showApp();
  }
}

function login() {
  const name = els.usernameInput.value.trim();
  if (!name) {
    els.usernameInput.focus();
    els.usernameInput.style.borderColor = 'var(--error)';
    setTimeout(() => { els.usernameInput.style.borderColor = ''; }, TEST_CONFIG.inputErrorFlashMs);
    return;
  }
  state.username = name;
  localStorage.setItem('typingtest_username', name);
  showApp();
}

function logout() {
  localStorage.removeItem('typingtest_username');
  state.username = '';
  els.loginScreen.classList.add('active');
  els.appScreen.classList.remove('active');
  els.usernameInput.value = '';
}

function showApp() {
  els.loginScreen.classList.remove('active');
  els.appScreen.classList.add('active');
  els.displayUsername.textContent = state.username;
  loadNewText();
}

// ===== Navigation =====
function switchTab(tabName) {
  $$('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
  $$('.tab-content').forEach(tab => tab.classList.toggle('active', tab.id === `tab-${tabName}`));
  
  if (tabName === 'leaderboard') {
    renderLeaderboard();
  }
}

// ===== Text Management =====
function loadNewText() {
  const sentenceCount = TEST_CONFIG.sentenceCountByDifficulty[state.difficulty] ?? TEST_CONFIG.sentenceCountByDifficulty.medium;
  state.text = getRandomSentences(state.language, state.difficulty, sentenceCount);
  resetTest();
  renderText();
}

function renderText() {
  const chars = state.text.split('');
  els.textDisplay.innerHTML = chars.map((char, i) => {
    const cls = i === 0 ? 'char current' : 'char pending';
    const display = char === ' ' ? '&nbsp;' : escapeHtml(char);
    return `<span class="${cls}" data-index="${i}">${display}</span>`;
  }).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== Test Logic =====
function resetTest() {
  clearInterval(state.timer);
  state.isRunning = false;
  state.isFinished = false;
  state.timeLeft = state.duration;
  state.typedChars = 0;
  state.correctChars = 0;
  state.errorCount = 0;
  state.startTime = null;
  // Reset analytics
  state.errorLog = [];
  state.wpmSnapshots = [];
  state.lastSnapshotTime = 0;
  state.prevErrorCount = 0;

  els.typingInput.value = '';
  els.typingInput.disabled = false;
  els.timerDisplay.textContent = state.duration;
  els.liveWpm.textContent = '0';
  els.liveAccuracy.textContent = '100%';
  els.liveErrors.textContent = '0';
  els.progressBar.style.width = '100%';
}

function startTest() {
  if (state.isRunning || state.isFinished) return;
  state.isRunning = true;
  state.startTime = Date.now();
  
  state.timer = setInterval(() => {
    state.timeLeft--;
    els.timerDisplay.textContent = Math.max(0, state.timeLeft);
    
    const progress = (state.timeLeft / state.duration) * 100;
    els.progressBar.style.width = `${Math.max(0, progress)}%`;
    
    updateLiveStats();
    recordWpmSnapshot();
    
    if (state.timeLeft <= 0) {
      finishTest();
    }
  }, 1000);
}

/**
 * Record a WPM snapshot for the performance graph
 */
function recordWpmSnapshot() {
  if (!state.startTime) return;
  const elapsedSec = Math.round((Date.now() - state.startTime) / 1000);
  if (elapsedSec <= state.lastSnapshotTime && state.wpmSnapshots.length > 0) return;

  const elapsedMin = Math.max(elapsedSec / 60, 0.01);
  const wordsTyped = state.correctChars / 5;
  const wpm = Math.round(wordsTyped / elapsedMin);
  const newErrors = state.errorCount - state.prevErrorCount;

  state.wpmSnapshots.push({
    time: elapsedSec,
    wpm: Math.max(0, wpm),
    errors: Math.max(0, newErrors)
  });

  state.prevErrorCount = state.errorCount;
  state.lastSnapshotTime = elapsedSec;
}

function finishTest() {
  clearInterval(state.timer);
  state.isRunning = false;
  state.isFinished = true;
  els.typingInput.disabled = true;
  
  // Record final snapshot
  recordWpmSnapshot();

  const stats = calculateStats();
  showResults(stats);
  
  // Save score async (Firebase if configured, local fallback otherwise)
  addScore({
    username: state.username,
    wpm: stats.wpm,
    accuracy: stats.accuracy,
    errors: stats.errors,
    language: state.language,
    difficulty: state.difficulty,
    duration: state.duration
  }).catch(e => {
    console.warn('Failed to save score:', e);
  });
  
  playSuccessSound();
  
  // Confetti for high scores
  if (stats.wpm >= TEST_CONFIG.highScoreWpmThreshold || stats.accuracy >= TEST_CONFIG.highAccuracyThreshold) {
    setTimeout(() => {
      launchConfetti(TEST_CONFIG.confettiDurationMs);
    }, TEST_CONFIG.confettiDelayMs);
  }
}

function calculateStats() {
  const elapsedMs = state.startTime ? Date.now() - state.startTime : 0;
  const elapsedMin = Math.max(elapsedMs / 60000, 0.01);
  
  const wordsTyped = state.correctChars / 5;
  const wpm = Math.round(wordsTyped / elapsedMin);
  
  const totalTyped = state.typedChars || 1;
  const accuracy = Math.round((state.correctChars / totalTyped) * 1000) / 10;
  
  return {
    wpm: Math.max(0, isFinite(wpm) ? wpm : 0),
    accuracy: Math.min(100, Math.max(0, isFinite(accuracy) ? accuracy : 0)),
    errors: state.errorCount,
    chars: state.typedChars
  };
}

function updateLiveStats() {
  const stats = calculateStats();
  els.liveWpm.textContent = stats.wpm;
  els.liveAccuracy.textContent = `${stats.accuracy}%`;
  els.liveErrors.textContent = stats.errors;
}

function handleTyping() {
  if (state.isFinished) return;
  if (!state.isRunning) startTest();
  
  const typed = els.typingInput.value;
  const chars = state.text.split('');
  const charSpans = els.textDisplay.querySelectorAll('.char');
  
  // Track previous error positions for error logging
  const prevTypedLen = state.typedChars;
  
  state.typedChars = typed.length;
  state.correctChars = 0;
  state.errorCount = 0;
  
  chars.forEach((char, i) => {
    const span = charSpans[i];
    if (!span) return;
    
    span.className = 'char';
    
    if (i < typed.length) {
      if (typed[i] === char) {
        span.classList.add('correct');
        state.correctChars++;
      } else {
        span.classList.add('wrong');
        state.errorCount++;
      }
    } else if (i === typed.length) {
      span.classList.add('current');
    } else {
      span.classList.add('pending');
    }
  });
  
  // Log new errors for analytics (only for newly typed characters)
  if (typed.length > prevTypedLen && state.startTime) {
    const newIdx = typed.length - 1;
    if (newIdx < chars.length && typed[newIdx] !== chars[newIdx]) {
      const elapsedSec = (Date.now() - state.startTime) / 1000;
      state.errorLog.push({
        typed: typed[newIdx],
        expected: chars[newIdx],
        position: newIdx + 1,
        time: elapsedSec
      });
    }
  }
  
  // Play sound for last character
  if (typed.length > 0) {
    const lastIdx = typed.length - 1;
    if (lastIdx < chars.length) {
      if (typed[lastIdx] === chars[lastIdx]) {
        playKeySound();
      } else {
        playErrorSound();
      }
    }
  }
  
  updateLiveStats();
  
  // Auto-scroll text display
  const currentSpan = els.textDisplay.querySelector('.char.current');
  if (currentSpan) {
    currentSpan.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  
  // Check if all text typed
  if (typed.length >= chars.length) {
    finishTest();
  }
}

// ===== Results =====
function showResults(stats) {
  els.resultWpm.textContent = stats.wpm;
  els.resultAccuracy.textContent = `${stats.accuracy}%`;
  els.resultErrors.textContent = stats.errors;
  els.resultChars.textContent = stats.chars;
  
  // Dynamic title based on performance
  const resultTier = RESULT_TIERS.find((tier) => stats.wpm >= tier.minWpm) || RESULT_TIERS[RESULT_TIERS.length - 1];
  els.resultsTitle.textContent = resultTier.title;
  els.resultsSubtitle.textContent = resultTier.subtitle;
  
  els.resultsModal.classList.add('active');
  
  // Render analytics after modal is visible
  setTimeout(() => {
    try {
      renderHighlights(state.wpmSnapshots, state.errorLog, els.highlightsContainer);
    } catch (e) {
      console.warn('Failed to render highlights:', e);
    }
    try {
      renderPerformanceGraph(state.wpmSnapshots, els.wpmGraph);
    } catch (e) {
      console.warn('Failed to render graph:', e);
    }
    try {
      renderErrorTable(state.errorLog, els.errorTableContainer);
    } catch (e) {
      console.warn('Failed to render error table:', e);
    }
  }, TEST_CONFIG.loadingDelayMs);
}

function hideResults() {
  els.resultsModal.classList.remove('active');
}

// ===== Leaderboard =====
async function renderLeaderboard() {
  const langFilter = els.lbLangFilter.value;
  const diffFilter = els.lbDiffFilter.value;
  
  // Show loading state
  els.leaderboardBody.innerHTML = `
    <tr>
      <td colspan="7" style="text-align:center; padding: 2rem;">
        <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--accent);"></i>
        <p style="margin-top: 0.5rem; color: var(--text-secondary);">Loading leaderboard...</p>
      </td>
    </tr>
  `;
  els.leaderboardEmpty.classList.remove('show');

  let scores;
  try {
    scores = await getTop10({ language: langFilter, difficulty: diffFilter });
  } catch (e) {
    console.warn('Failed to get leaderboard:', e);
    scores = [];
  }
  updateLeaderboardStatus();

  if (!scores || scores.length === 0) {
    els.leaderboardBody.innerHTML = '';
    els.leaderboardEmpty.classList.add('show');
    return;
  }

  els.leaderboardEmpty.classList.remove('show');

  const langMap = {
    en: '🇬🇧 EN',
    id: '🇮🇩 ID',
    su: '🏔️ SU',
    jv: '🏛️ JV'
  };

  const diffMap = {
    easy: '<span class="diff-badge diff-easy">Easy</span>',
    medium: '<span class="diff-badge diff-medium">Medium</span>',
    hard: '<span class="diff-badge diff-hard">Hard</span>'
  };

  els.leaderboardBody.innerHTML = scores.map((score, i) => {
    const rank = i + 1;
    const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';
    const isUser = score.username === state.username;
    const rowClass = isUser ? 'highlight' : '';

    return `
      <tr class="${rowClass}">
        <td><span class="rank-badge ${rankClass}">${rank}</span></td>
        <td>${escapeHtml(score.username || 'Unknown')} ${isUser ? '⭐' : ''}</td>
        <td><span class="wpm-value">${score.wpm ?? 0}</span></td>
        <td>${score.accuracy ?? 0}%</td>
        <td><span class="lang-badge">${langMap[score.language] || score.language || '-'}</span></td>
        <td>${diffMap[score.difficulty] || score.difficulty || '-'}</td>
        <td>${formatDate(score.timestamp)}</td>
      </tr>
    `;
  }).join('');
}

function updateLeaderboardStatus() {
  if (!els.leaderboardStatus) return;

  const mode = getLeaderboardMode();
  const isOnline = mode === 'firebase';
  els.leaderboardStatus.classList.toggle('offline', !isOnline);
  els.leaderboardStatus.innerHTML = isOnline
    ? '<i class="fas fa-globe"></i> Online Global'
    : '<i class="fas fa-hard-drive"></i> Local Device';
}

// ===== Event Listeners =====
function setupEventListeners() {
  // Login
  els.loginBtn.addEventListener('click', login);
  els.usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') login();
  });
  
  // Logout
  els.logoutBtn.addEventListener('click', logout);
  
  // Theme
  els.themeToggle.addEventListener('click', toggleTheme);
  
  // Sound
  els.soundToggle.addEventListener('click', () => {
    const enabled = toggleSound();
    updateSoundIcon(enabled);
  });
  
  // Navigation
  $$('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  
  // Language selector
  els.langSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-lang]');
    if (!btn) return;
    els.langSelector.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.language = btn.dataset.lang;
    loadNewText();
  });
  
  // Difficulty selector
  els.diffSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-diff]');
    if (!btn) return;
    els.diffSelector.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.difficulty = btn.dataset.diff;
    loadNewText();
  });
  
  // Time selector
  els.timeSelector.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-time]');
    if (!btn) return;
    els.timeSelector.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.duration = parseInt(btn.dataset.time);
    state.timeLeft = state.duration;
    resetTest();
    renderText();
  });
  
  // Typing
  els.typingInput.addEventListener('input', handleTyping);
  
  // Restart
  els.restartBtn.addEventListener('click', () => {
    resetTest();
    renderText();
    els.typingInput.focus();
  });
  
  // New text
  els.newTextBtn.addEventListener('click', () => {
    loadNewText();
    els.typingInput.focus();
  });
  
  // Results modal
  els.resultRestart.addEventListener('click', () => {
    hideResults();
    loadNewText();
    els.typingInput.focus();
  });
  
  els.resultLeaderboard.addEventListener('click', () => {
    hideResults();
    switchTab('leaderboard');
  });
  
  els.resultClose.addEventListener('click', hideResults);
  
  $('.modal-backdrop')?.addEventListener('click', hideResults);
  
  // Leaderboard filters
  els.lbLangFilter.addEventListener('change', renderLeaderboard);
  els.lbDiffFilter.addEventListener('change', renderLeaderboard);
  
  // Keyboard shortcut: Tab to restart
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab' && !els.loginScreen.classList.contains('active')) {
      e.preventDefault();
      resetTest();
      renderText();
      els.typingInput.focus();
    }
    // Escape to close modal
    if (e.key === 'Escape') {
      hideResults();
    }
  });
}
