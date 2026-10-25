// ═══════════════════════════════════════════════════════════════════
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ═══════════════════════════════════════════════════════════════════
var state = null;
var session = null;
var db = { mode: 'local', error: null, database: null };

// Переменные YouTube-плеера
var ytPlayer = null;
var ytApiReady = false;
var currentTrackLoaded = ''; // Чтобы не перезагружать видео, если оно не менялось

var ui = {
  currentTab: 'base',
  currentBrush: null,
  currentEmoji: '🔥',
  selectedMarkerId: null,
  pendingDeleteMarker: null,
  pendingCancelMovement: false,
  mapSettingsOpen: false,
  confirmState: null,
  playerVolume: parseInt(localStorage.getItem('scarab_volume') || '50', 10)
};

function loadSession() {
  try {
    var raw = localStorage.getItem(LS_KEY_SESSION);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveSession(s) {
  session = s;
  try {
    if (s) localStorage.setItem(LS_KEY_SESSION, JSON.stringify(s));
    else localStorage.removeItem(LS_KEY_SESSION);
  } catch (e) {}
}