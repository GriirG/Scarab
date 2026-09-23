var state = null;
var session = null;
var db = { mode: 'local', error: null, ref: null, set: null, database: null };
var ui = {
  currentTab: 'base',
  currentBrush: null,
  currentEmoji: '🔥',
  selectedMarkerId: null,
  pendingDeleteMarker: null,
  mapSettingsOpen: false,
  confirmState: null
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