function saveState() {
  if (!state) return Promise.resolve();
  var clean = JSON.parse(JSON.stringify(state));
  if (db.mode === 'firebase' && db.set && db.ref && db.database) {
    return db.set(db.ref(db.database, 'state'), clean).catch(function(e) {
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

async function initDB() {
  if (!isFirebaseConfigured()) { fallbackLocal(); return; }
  try {
    var appMod  = await import(FB_CDN + '/firebase-app.js');
    var dbMod   = await import(FB_CDN + '/firebase-database.js');
    var authMod = await import(FB_CDN + '/firebase-auth.js');

    var app      = appMod.initializeApp(FIREBASE_CONFIG);
    var database = dbMod.getDatabase(app);
    var auth     = authMod.getAuth(app);

    try { await authMod.signInAnonymously(auth); }
    catch (e) { console.warn('Anonymous auth failed:', e.message); }

    db.database = database;
    db.ref = dbMod.ref;
    db.set = dbMod.set;
    db.mode = 'firebase';

    var stateRef = dbMod.ref(database, 'state');
    dbMod.onValue(
      stateRef,
      function(snap) {
        var val = snap.val();
        if (val && typeof val === 'object') {
          state = migrate(val);
          render();
        } else {
          var def = JSON.parse(JSON.stringify(DEFAULT_STATE));
          dbMod.set(stateRef, def).catch(function(e) { console.error('init set failed', e); });
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