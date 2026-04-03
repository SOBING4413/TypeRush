// Leaderboard management with Firebase Firestore (Global Online Database)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

// ===== Firebase Initialization =====
let db = null;
let firebaseReady = false;
let initPromise = null;
let lastMode = "initializing";

function getEnvVar(name) {
  // Check multiple sources for the env var
  if (window.__ENV__ && window.__ENV__[name]) return window.__ENV__[name];
  const prefixedName = `__ENV__${name}`;
  if (window[prefixedName]) return window[prefixedName];
  if (window[name]) return window[name];
  const metaTag = document.querySelector(`meta[name="${name}"]`);
  if (metaTag?.content) return metaTag.content;
  return null;
}

function initFirebase() {
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve) => {
    try {
      const apiKey = getEnvVar("FIREBASE_API_KEY");
      const projectId = getEnvVar("FIREBASE_PROJECT_ID");

      if (!apiKey || !projectId || apiKey === "FIREBASE_API_KEY_NOT_SET" || projectId === "FIREBASE_PROJECT_ID_NOT_SET") {
        console.warn("Firebase credentials not configured. Using localStorage fallback.");
        lastMode = "local";
        resolve(false);
        return;
      }

      const firebaseConfig = {
        apiKey: apiKey,
        authDomain: projectId + ".firebaseapp.com",
        projectId: projectId,
      };

      const app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      firebaseReady = true;
      lastMode = "firebase";
      console.log("Firebase Firestore connected successfully!");
      resolve(true);
    } catch (e) {
      console.warn("Firebase init failed, using localStorage fallback:", e);
      lastMode = "local";
      resolve(false);
    }
  });

  return initPromise;
}

// Initialize on module load
initFirebase();

// ===== localStorage Fallback =====
const LEADERBOARD_KEY = "typingtest_leaderboard";
const MAX_ENTRIES = 50;
const TOP_LIMIT = 10;

function getLocalLeaderboard() {
  try {
    const data = localStorage.getItem(LEADERBOARD_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveLocalScore(entry) {
  const scores = getLocalLeaderboard();
  scores.push(entry);
  scores.sort((a, b) => b.wpm - a.wpm);
  const trimmed = scores.slice(0, MAX_ENTRIES);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(trimmed));
}

function getLocalTop10(filter = {}) {
  let scores = getLocalLeaderboard();
  if (filter.language && filter.language !== "all") {
    scores = scores.filter((s) => s.language === filter.language);
  }
  if (filter.difficulty && filter.difficulty !== "all") {
    scores = scores.filter((s) => s.difficulty === filter.difficulty);
  }
  return scores.sort((a, b) => b.wpm - a.wpm).slice(0, TOP_LIMIT);
}

// ===== Public API (works with Firebase or localStorage fallback) =====

/**
 * Add a new score to the leaderboard
 * @param {Object} entry - Score entry
 * @returns {Object} The saved entry
 */
export async function addScore(entry) {
  const newEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    username: entry.username || "Unknown",
    wpm: Math.round(entry.wpm),
    accuracy: Math.round(entry.accuracy * 10) / 10,
    errors: entry.errors || 0,
    language: entry.language || "en",
    difficulty: entry.difficulty || "medium",
    duration: entry.duration || 30,
    timestamp: Date.now(),
  };

  await initFirebase();

  if (firebaseReady && db) {
    try {
      await addDoc(collection(db, "leaderboard"), newEntry);
      lastMode = "firebase";
      console.log("Score saved to Firebase!");
    } catch (e) {
      console.warn("Firebase save failed, saving locally:", e);
      lastMode = "local";
      saveLocalScore(newEntry);
    }
  } else {
    lastMode = "local";
    saveLocalScore(newEntry);
  }

  return newEntry;
}

/**
 * Get top 10 scores, optionally filtered
 * @param {Object} filter - Optional filter
 * @returns {Promise<Array>} Top 10 scores
 */
export async function getTop10(filter = {}) {
  await initFirebase();

  if (firebaseReady && db) {
    try {
      // Build Firestore query
      let constraints = [orderBy("wpm", "desc"), limit(50)];
      let q = query(collection(db, "leaderboard"), ...constraints);

      const snapshot = await getDocs(q);
      let scores = [];
      snapshot.forEach((doc) => {
        scores.push(doc.data());
      });

      // Apply client-side filters (Firestore has limitations on compound queries)
      if (filter.language && filter.language !== "all") {
        scores = scores.filter((s) => s.language === filter.language);
      }
      if (filter.difficulty && filter.difficulty !== "all") {
        scores = scores.filter((s) => s.difficulty === filter.difficulty);
      }

      lastMode = "firebase";
      return scores.sort((a, b) => b.wpm - a.wpm).slice(0, TOP_LIMIT);
    } catch (e) {
      console.warn("Firebase read failed, using localStorage:", e);
      lastMode = "local";
      return getLocalTop10(filter);
    }
  }

  lastMode = "local";
  return getLocalTop10(filter);
}

/**
 * Get user's best score
 * @param {string} username - Username
 * @returns {Promise<Object|null>} Best score entry or null
 */
export async function getUserBest(username) {
  await initFirebase();

  if (firebaseReady && db) {
    try {
      const q = query(
        collection(db, "leaderboard"),
        where("username", "==", username),
        orderBy("wpm", "desc"),
        limit(1)
      );
      const snapshot = await getDocs(q);
      let best = null;
      snapshot.forEach((doc) => {
        best = doc.data();
      });
      return best;
    } catch (e) {
      console.warn("Firebase getUserBest failed:", e);
    }
  }

  // Fallback
  const scores = getLocalLeaderboard().filter((s) => s.username === username);
  if (scores.length === 0) return null;
  return scores.sort((a, b) => b.wpm - a.wpm)[0];
}

/**
 * Format timestamp to readable date
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date
 */
export function formatDate(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getLeaderboardMode() {
  return lastMode;
}
