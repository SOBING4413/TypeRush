// Firebase configuration - uses environment variables injected at build/runtime
// The user provides FIREBASE_API_KEY and FIREBASE_PROJECT_ID via SecretManager

const firebaseConfig = {
  apiKey: window.__ENV__FIREBASE_API_KEY || "FIREBASE_API_KEY_NOT_SET",
  authDomain: (window.__ENV__FIREBASE_PROJECT_ID || "project") + ".firebaseapp.com",
  projectId: window.__ENV__FIREBASE_PROJECT_ID || "FIREBASE_PROJECT_ID_NOT_SET",
};

export default firebaseConfig;