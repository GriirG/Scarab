# База «Скараб»

Веб-приложение для D&D: механика прокачки базы, заявки игроков, карта с метками,
голосование за перемещение.

## Файлы

- `index.html` — точка входа
- `css/styles.css` — все стили
- `js/config.js` — **сюда вставляются ключи Firebase** (см. ниже)
- `js/data.js` — дефолтное состояние + миграция
- `js/utils.js` — утилиты
- `js/state.js` — глобальное состояние
- `js/db.js` — Firebase + localStorage
- `js/logic.js` — вся игровая логика
- `js/render.js` — рендер
- `js/app.js` — старт

## Локальный запуск

Просто открой `index.html` двойным кликом в браузере. Работает без сервера.
Данные хранятся в localStorage этого браузера.

## Firebase (опционально, для синхронизации между устройствами)

1. https://console.firebase.google.com/ → создай проект.
2. **Build → Realtime Database → Create Database** → Start in test mode.
3. **Build → Authentication → Sign-in method → Anonymous → Enable**.
4. **Project settings → Your apps → Web** → добавь приложение, скопируй `firebaseConfig`.
5. Вставь значения в `js/config.js`.
6. **Realtime Database → Rules**:

   ```json
   {
     "rules": {
       "state": { ".read": true, ".write": true }
     }
   }