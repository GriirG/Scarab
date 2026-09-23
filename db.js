// ═══════════════════════════════════════════════════════════════════
// БД: Firebase compat + localStorage
// Compat-версия подключается через <script> в index.html,
// поэтому CORS-проблем с GitHub Pages не возникает.
// ═══════════════════════════════════════════════════════════════════
function saveState() {
  if (!state) return Promise.resolve();
  var clean = JSON.parse(JSON.stringify(state));
  if (db.mode === 'firebase' && db.database) {
    return db.database.ref('state').set(clean).catch(function(e) {
      console.error('save failed', e);
      try { localStorage.setItem(LS_KEY_DB, JSON.stringify(clean)); } catch(_) {}
    });
  }
  try { localStorage.setItem(LS_KEY_DB, JSON.stringify(clean)); } catch(_) {}
  return Promise.resolve();
}

function fallbackLocal() {
  if (db.mode !== 'error') db.mode = 'local';
  var st = null;
  try {
    var raw = localStorage.getItem(LS_KEY_DB);
    st = raw ? JSON.parse(raw) : null;
  } catch (e) {}
  if (!st) st = JSON.parse(JSON.stringify(DEFAULT_STATE));
  state = migrate(st);
  render();
}

function initDB() {
  if (!isFirebaseConfigured()) { fallbackLocal(); return; }

  if (typeof firebase === 'undefined' || !firebase.initializeApp) {
    console.error('Firebase compat SDK не загрузился. Проверь теги <script> в index.html.');
    db.error = 'Firebase SDK не загрузился';
    db.mode = 'error';
    fallbackLocal();
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    var database = firebase.database();

    // Пробуем анонимный вход (не критично, если уже включён)
    try {
      firebase.auth().signInAnonymously().catch(function(e) {
        console.warn('Anonymous auth failed:', e.message);
      });
    } catch (e) { console.warn('Auth init failed:', e.message); }

    db.database = database;
    db.mode = 'firebase';

    database.ref('state').on('value',
      function(snap) {
        var val = snap.val();
        if (val && typeof val === 'object') {
          state = migrate(val);
          render();
        } else {
          var def = JSON.parse(JSON.stringify(DEFAULT_STATE));
          database.ref('state').set(def).catch(function(e) { console.error('init set failed', e); });
          state = def;
          render();
        }
      },
      function(err) {
        console.error('DB listen error:', err);
        db.error = err.message;
        db.mode = 'error';
        fallbackLocal();
      }
    );
  } catch (e) {
    console.error('Firebase init failed:', e);
    db.error = e.message;
    db.mode = 'error';
    fallbackLocal();
  }
}