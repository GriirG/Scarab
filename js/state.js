// ═══════════════════════════════════════════════════════════════════
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ═══════════════════════════════════════════════════════════════════

// state — текущее состояние всей игры (ресурсы, комнаты, карта, игроки, заявки).
// Заполняется после initDB() из Firebase или localStorage.
var state = null;

// session — текущий залогиненный пользователь на этом устройстве.
// { userId, username, isAdmin, loggedInAt } или null.
// Хранится в localStorage отдельно от state, чтобы не синхронизировался между устройствами.
var session = null;

// db — состояние подключения к базе данных.
//   mode:     'local'    — localStorage
//             'firebase' — подключено к Firebase Realtime Database
//             'error'    — попытка подключиться не удалась, работаем локально
//   error:    текст ошибки, если mode === 'error'
//   database: объект firebase.database() при успешном подключении
var db = {
  mode: 'local',
  error: null,
  database: null
};

// ui — эфемерное состояние интерфейса (не сохраняется на сервере).
var ui = {
  currentTab: 'base',          // активная вкладка
  currentBrush: null,          // 'marker' | 'location' | null
  currentEmoji: '🔥',          // последний эмодзи для новой метки
  selectedMarkerId: null,      // выбранная метка на карте
  pendingDeleteMarker: null,   // id метки, ожидающей подтверждения удаления
  mapSettingsOpen: false,      // раскрыты ли настройки карты
  confirmState: null           // { message, onYes } для кастомного модала
};

// ═══════════════════════════════════════════════════════════════════
// СЕССИЯ (localStorage, отдельно от основного state)
// ═══════════════════════════════════════════════════════════════════

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
