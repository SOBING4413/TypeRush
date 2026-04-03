// Leaderboard management with localStorage

const LEADERBOARD_KEY = 'typingtest_leaderboard';
const MAX_ENTRIES = 50;

/**
 * Get all leaderboard entries
 * @returns {Array} Array of score entries
 */
export function getLeaderboard() {
  try {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Add a new score to the leaderboard
 * @param {Object} entry - Score entry
 * @param {string} entry.username - Player username
 * @param {number} entry.wpm - Words per minute
 * @param {number} entry.accuracy - Accuracy percentage
 * @param {number} entry.errors - Total errors
 * @param {string} entry.language - Language code
 * @param {string} entry.difficulty - Difficulty level
 * @param {number} entry.duration - Test duration in seconds
 * @returns {Object} The saved entry with id and timestamp
 */
export function addScore(entry) {
  const scores = getLeaderboard();
  const newEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    username: entry.username,
    wpm: Math.round(entry.wpm),
    accuracy: Math.round(entry.accuracy * 10) / 10,
    errors: entry.errors,
    language: entry.language,
    difficulty: entry.difficulty,
    duration: entry.duration,
    timestamp: Date.now()
  };
  
  scores.push(newEntry);
  scores.sort((a, b) => b.wpm - a.wpm);
  
  // Keep only top entries
  const trimmed = scores.slice(0, MAX_ENTRIES);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(trimmed));
  
  return newEntry;
}

/**
 * Get top 10 scores, optionally filtered
 * @param {Object} filter - Optional filter
 * @param {string} filter.language - Filter by language
 * @param {string} filter.difficulty - Filter by difficulty
 * @returns {Array} Top 10 scores
 */
export function getTop10(filter = {}) {
  let scores = getLeaderboard();
  
  if (filter.language && filter.language !== 'all') {
    scores = scores.filter(s => s.language === filter.language);
  }
  if (filter.difficulty && filter.difficulty !== 'all') {
    scores = scores.filter(s => s.difficulty === filter.difficulty);
  }
  
  return scores.sort((a, b) => b.wpm - a.wpm).slice(0, 10);
}

/**
 * Get user's best score
 * @param {string} username - Username
 * @returns {Object|null} Best score entry or null
 */
export function getUserBest(username) {
  const scores = getLeaderboard().filter(s => s.username === username);
  if (scores.length === 0) return null;
  return scores.sort((a, b) => b.wpm - a.wpm)[0];
}

/**
 * Get user's recent scores
 * @param {string} username - Username
 * @param {number} count - Number of recent scores
 * @returns {Array} Recent scores
 */
export function getUserScores(username, count = 5) {
  return getLeaderboard()
    .filter(s => s.username === username)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, count);
}

/**
 * Check if a score is in the top 10
 * @param {number} wpm - WPM to check
 * @returns {boolean}
 */
export function isTopScore(wpm) {
  const top = getTop10();
  return top.length < 10 || wpm > (top[top.length - 1]?.wpm || 0);
}

/**
 * Format timestamp to readable date
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date
 */
export function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
