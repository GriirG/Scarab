// ═══════════════════════════════════════════════════════════════════
// ВСТАВЬ СВОИ КЛЮЧИ FIREBASE ЗДЕСЬ (см. README.md).
// Если оставить пустым — работает на localStorage (одно устройство).
// ═══════════════════════════════════════════════════════════════════
var FIREBASE_CONFIG = {
  apiKey: "AIzaSyCEevZt1APyFRuj-FxrosXJ9roAVXSCiio",
  authDomain: "database-scarab.firebaseapp.com",
  databaseURL: "https://database-scarab-default-rtdb.firebaseio.com",
  projectId: "database-scarab",
  storageBucket: "database-scarab.firebasestorage.app",
  messagingSenderId: "374030108777",
  appId: "1:374030108777:web:0284c35d8d90a282043af8"
};

// Используется только для миграции старых меток (type → emoji)
var LEGACY_MARKER_TYPES = {
  campfire: '🔥', house: '🏠', broken: '🏚️', question: '❓'
};

var LS_KEY_DB = 'scarab_db';
var LS_KEY_SESSION = 'scarab_session';
var FB_VERSION = '10.12.2';
var FB_CDN = 'https://www.gstatic.com/firebasejs/' + FB_VERSION;

function isFirebaseConfigured() {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL && FIREBASE_CONFIG.projectId);
}