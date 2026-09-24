function getTabs() {
  var tabs = [['base', '🏰 Главная'], ['map', '🗺️ Карта']];
  if (!session) tabs.push(['login', '🔑 Вход']);
  else if (session.isAdmin) {
    tabs.push(['admin-requests', '📜 Заявки']);
    tabs.push(['admin-resources', '📦 Ресурсы']);
    tabs.push(['admin-rooms', '🏗️ Комнаты']);
    tabs.push(['admin-players', '👥 Игроки']);
    tabs.push(['admin-settings', '⚙️ Настройки']);
  } else {
    tabs.push(['newreq', '⚒️ Запросить улучшение']);
    tabs.push(['myreq', '📜 Мои заявки']);
  }
  return tabs;
}

function render() {
  if (!state) return;
  checkSessionValidity();

  if (state.map && state.map.movement && state.map.movement.status === 'moving') {
    if (Date.now() - state.map.movement.startedAt >= state.map.movement.durationMs) {
      setTimeout(completeMovement, 0);
    }
  }

  var tabs = getTabs();
  var found = false;
  for (var i = 0; i < tabs.length; i++) if (tabs[i][0] === ui.currentTab) found = true;
  if (!found) ui.currentTab = tabs[0][0];

  var movementHtml = (state.map.movement && ui.currentTab !== 'map')
    ? '<div class="container" style="padding-bottom:0">' + renderMovementBanner() + '</div>'
    : '';

  document.getElementById('app').innerHTML =
    renderBanner() + renderHeader() + renderNav(tabs) + movementHtml +
    '<main class="container">' + renderContent(ui.currentTab) + '</main>' +
    renderConfirmModal();

  if (ui.currentTab === 'newreq') {
    var sel = document.getElementById('req-room');
    if (sel) updateReqPreview(sel.value);
  }
}

function renderBanner() {
  if (db.mode === 'firebase')
    return '<div class="db-banner firebase">🌐 Firebase Realtime Database — синхронизация между устройствами</div>';
  if (db.mode === 'error')
    return '<div class="db-banner error">⚠️ Не удалось подключиться к Firebase: ' + escapeHtml(db.error || 'неизвестная ошибка') + '. Работаем локально.</div>';
  return '<div class="db-banner local">💾 Локальный режим (localStorage). Firebase не настроен — данные видны только в этом браузере.</div>';
}

function renderHeader() {
  var right = '';
  if (session) {
    right = '<span class="user-badge">' + (session.isAdmin ? '👑' : '🧙') + ' ' + escapeHtml(session.username) + '</span>' +
            '<button class="btn btn-ghost btn-sm" onclick="logout()">Выйти</button>';
  }
  return '<header class="header">' +
    '<h1>🏰 ' + escapeHtml(state.baseName) + '</h1>' +
    '<div class="header-right">' + right + '</div>' +
    '</header>';
}

function renderNav(tabs) {
  var html = '<nav class="nav">';
  for (var i = 0; i < tabs.length; i++) {
    var id = tabs[i][0], label = tabs[i][1];
    html += '<button class="' + (id === ui.currentTab ? 'active' : '') + '" onclick="switchTab(\'' + id + '\')">' + label + '</button>';
  }
  html += '</nav>';
  return html;
}

function renderContent(tab) {
  switch (tab) {
    case 'base': return renderBase();
    case 'map': return renderMap();
    case 'login': return renderLogin();
    case 'newreq': return renderNewRequest();
    case 'myreq': return renderMyRequests();
    case 'admin-requests': return renderAdminRequests();
    case 'admin-resources': return renderAdminResources();
    case 'admin-rooms': return renderAdminRooms();
    case 'admin-players': return renderAdminPlayers();
    case 'admin-settings': return renderAdminSettings();
    default: return '';
  }
}

function renderConfirmModal() {
  if (!ui.confirmState) return '';
  return '<div class="modal-backdrop" onclick="confirmNo()">' +
    '<div class="modal-box" onclick="event.stopPropagation()">' +
      '<div class="modal-message">' + escapeHtml(ui.confirmState.message) + '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" onclick="confirmNo()">Отмена</button>' +
        '<button class="btn" onclick="confirmYes()">ОК</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function renderBase() {
  var resHtml = state.resources.length ? state.resources.map(function(r) {
    var pct = r.max > 0 ? clamp((r.current / r.max) * 100, 0, 100) : 100;
    var maxLabel = r.max > 0 ? r.max : '∞';
    return '<div class="res-item">' +
      '<div class="name">' + escapeHtml(r.name) + '</div>' +
      '<div class="val">' + r.current + ' / ' + maxLabel + '</div>' +
      '<div class="bar"><div style="width:' + pct + '%"></div></div>' +
      '</div>';
  }).join('') : '<div class="empty">Ресурсы не настроены</div>';

  var roomsHtml = state.rooms.length
    ? state.rooms.map(roomCard).join('')
    : '<div class="empty">Комнаты не настроены</div>';

  return '<div class="card"><h2>📦 Ресурсы базы</h2><div class="grid">' + resHtml + '</div></div>' +
         '<div class="card"><h2>🏗️ Комнаты и сооружения</h2><div class="grid">' + roomsHtml + '</div></div>';
}

function roomCard(room) {
  var max = room.levels.length;
  var pct = max > 0 ? (room.level / max) * 100 : 0;
  var cur = room.levels[room.level - 1];
  var next = room.level < max ? room.levels[room.level] : null;
  var genStr = formatGenSummary(cur);

  var html = '<div class="room-item">' +
    '<div class="name">' + escapeHtml(room.name) + '</div>' +
    '<div class="val">Уровень ' + room.level + ' / ' + max + '</div>' +
    '<div class="bar"><div style="width:' + pct + '%"></div></div>';
  if (cur && cur.desc) html += '<div class="muted" style="margin-top:8px;font-size:0.88em">' + escapeHtml(cur.desc) + '</div>';
  if (genStr) html += '<div style="margin-top:8px;font-size:0.88em;color:#a8c8e0">⚡ Генерирует: ' + escapeHtml(genStr) + ' / ' + (state.generation.intervalMin || 5) + ' мин</div>';
  if (next) {
    html += '<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">' +
      '<div class="muted" style="font-size:0.85em">Следующий уровень:</div>' +
      '<div style="font-size:0.88em">' + escapeHtml(next.desc || '') + '</div>' +
      '<div style="margin-top:6px">' + formatCost(next.cost, state.resources) + '</div>' +
      '</div>';
  } else {
    html += '<div class="muted" style="margin-top:10px">⭐ Максимальный уровень</div>';
  }
  html += '</div>';
  return html;
}

function renderMap() {
  var m = state.map;
  var html = '<div class="card"><h2>🗺️ Карта</h2>';

  if (isAdmin()) {
    html += renderMapSettings();
    if (m.image) html += renderMapToolbar();
  }

  if (!m.image) {
    html += '<div class="map-placeholder">' +
      '<div style="font-size:2em;margin-bottom:12px">🗺️</div>' +
      '<div>Карта ещё не загружена.</div>' +
      (isAdmin()
        ? '<div style="margin-top:16px"><input type="file" accept="image/*" onchange="uploadMap(event)" style="max-width:400px;display:inline-block"></div>'
        : '<div class="muted" style="margin-top:8px">Обратитесь к администратору.</div>') +
      '</div>';
  } else {
    var editing = isAdmin() && ui.currentBrush;
    html += '<div class="map-wrap"><div class="map-container' + (editing ? ' editing' : '') + '" id="map-container" onclick="onMapClick(event)">' +
      '<img src="' + m.image + '" alt="Карта">';

    for (var i = 0; i < m.markers.length; i++) {
      var mk = m.markers[i];
      var selected = (mk.id === ui.selectedMarkerId);
      var title = (mk.name || '') + (mk.permanent ? ' (постоянная)' : ' (одноразовая)');
      html += '<div class="map-marker' + (selected ? ' selected' : '') + '" data-marker-id="' + mk.id + '"' +
        ' style="left:' + mk.x + '%;top:' + mk.y + '%"' +
        ' title="' + escapeHtml(title.trim()) + '">' + getEmoji(mk) + '</div>';
    }

    html += '<div class="map-marker current" style="left:' + m.currentLocation.x + '%;top:' + m.currentLocation.y + '%" title="Отряд здесь">📍</div>';

    if (m.movement) {
      html += '<div class="map-movement-overlay" onclick="event.stopPropagation()">' +
        renderMovementBanner() + '</div>';
    }

    html += '</div></div>';
  }

  html += '</div>';

  if (ui.selectedMarkerId) {
    var sel = getMarker(ui.selectedMarkerId);
    if (sel) html += renderMarkerInfo(sel);
  }

  return html;
}

function renderMovementBanner() {
  var m = state.map.movement;
  if (!m) return '';

  var baseName = state.baseName || 'Отряд';

  if (m.status === 'proposing') {
    var needed = m.needed || 1;
    // Firebase мог потерять пустые массивы — защита
    var yesVotes = Array.isArray(m.yesVotes) ? m.yesVotes : [];
    var noVotes = Array.isArray(m.noVotes) ? m.noVotes : [];
    var yes = yesVotes.length;
    var pct = Math.min(100, yes / needed * 100);
    var yesNames = yesVotes.map(findUsername).join(', ');
    var noNames = noVotes.map(findUsername).join(', ');
    var alreadyVoted = session && (yesVotes.indexOf(session.userId) !== -1 || noVotes.indexOf(session.userId) !== -1);
    var voteButtons = '';
    if (!session) voteButtons = '<span class="muted" style="align-self:center">Войдите, чтобы голосовать</span>';
    else if (alreadyVoted) voteButtons = '<span class="muted" style="align-self:center">Ты уже голосовал</span>';
    else voteButtons = '<button class="btn btn-success btn-sm" onclick="voteMovement(true)">✅ Согласен</button>' +
                       '<button class="btn btn-danger btn-sm" onclick="voteMovement(false)">❌ Против</button>';
    var adminBtn = isAdmin() ? '<button class="btn btn-sm" onclick="adminForceStartMovement()">▶️ Начать сейчас</button>' : '';
    var cancelBtn = (isAdmin() || (session && session.userId === m.proposedBy))
      ? '<button class="btn btn-ghost btn-sm" onclick="cancelMovement()">✕ Отменить</button>' : '';

    return '<div class="card movement-banner">' +
      '<h3>📜 Предложение о перемещении</h3>' +
      '<div style="margin-bottom:8px">→ <strong>' + escapeHtml(m.markerName) + '</strong></div>' +
      '<div class="muted" style="font-size:0.9em">Предлагает <strong>' + escapeHtml(m.proposedByName) + '</strong> · ' +
        m.travelKm.toFixed(2) + ' км · ' + formatTime(m.travelHours) + '</div>' +
      '<div style="margin-top:12px">' +
        '<div class="muted" style="font-size:0.85em">Голоса за: ' + yes + ' / ' + needed +
          ' (игроков зарегистрировано: ' + state.users.length + ')</div>' +
        '<div class="bar" style="height:12px;margin-top:4px"><div style="width:' + pct + '%"></div></div>' +
      '</div>' +
      (yesNames ? '<div class="vote-chips"><span class="vote-chip yes">✅ ' + escapeHtml(yesNames) + '</span></div>' : '') +
      (noNames ? '<div class="vote-chips"><span class="vote-chip no">❌ ' + escapeHtml(noNames) + '</span></div>' : '') +
      '<div class="row" style="margin-top:12px">' + voteButtons + adminBtn + cancelBtn + '</div>' +
      '</div>';
  }

  if (m.status === 'moving') {
    var elapsedNow = Date.now() - m.startedAt;
    var progress = Math.min(1, Math.max(0, elapsedNow / m.durationMs));
    var remainingRP = m.travelHours * (1 - progress);
    return '<div class="card movement-banner">' +
      '<h3>🚶 ' + escapeHtml(baseName) + ' в пути</h3>' +
      '<div style="margin-bottom:8px">→ <strong>' + escapeHtml(m.markerName) + '</strong> · ' +
        m.travelKm.toFixed(2) + ' км · ' + formatTime(m.travelHours) + '</div>' +
      '<div class="progress-bar"><div class="movement-bar-fill" style="width:' + (progress * 100) + '%"></div></div>' +
      '<div class="muted" style="font-size:0.9em;margin-top:8px">Осталось: <span class="movement-bar-label">' +
        formatTime(remainingRP) + '</span></div>' +
      (isAdmin() ? '<div class="row" style="margin-top:12px">' +
        '<button class="btn btn-success btn-sm" onclick="adminSkipMovement()">⏭️ Пропустить</button>' +
        '<button class="btn btn-danger btn-sm" onclick="cancelMovement()">✕ Прервать</button>' +
      '</div>' : '') +
      '</div>';
  }
  return '';
}

function renderMapSettings() {
  var m = state.map;
  var openAttr = ui.mapSettingsOpen ? '' : ' style="display:none"';
  var roomOpts = state.rooms.map(function(r) {
    return '<option value="' + r.id + '"' + (m.generatorRoomId === r.id ? ' selected' : '') + '>' +
      escapeHtml(r.name) + ' (ур. ' + r.level + ')</option>';
  }).join('');

  var preview = '';
  if (m.naturalWidth > 0 && m.scaleRatio > 0 && m.physicalWidthCm > 0) {
    var kmPerPx = (m.physicalWidthCm / m.naturalWidth) * m.scaleRatio / 100000;
    var totalKm = kmPerPx * m.naturalWidth;
    preview = '<div class="scale-preview">' +
      'При ширине карты <strong>' + m.physicalWidthCm + ' см</strong> ' +
      'и масштабе <strong>1 : ' + formatScale(m.scaleRatio) + '</strong>: ' +
      'вся карта ≈ <strong>' + totalKm.toFixed(0) + ' км</strong>, ' +
      '1 px ≈ <strong>' + kmPerPx.toFixed(3) + ' км</strong>' +
      '</div>';
  }

  var html = '<div style="margin-bottom:12px">' +
    '<button class="btn btn-ghost btn-sm" onclick="toggleMapSettings()">⚙️ Настройки карты</button>' +
    (m.image ? '<input type="file" accept="image/*" onchange="uploadMap(event)" style="display:none" id="map-reupload">' +
               '<button class="btn btn-ghost btn-sm" style="margin-left:6px" onclick="document.getElementById(\'map-reupload\').click()">🖼️ Заменить карту</button>' +
               '<button class="btn btn-danger btn-sm" style="margin-left:6px" onclick="removeMap()">✕ Удалить карту</button>' : '') +
    '</div>';

  html += '<div class="card" style="background:#0d0a07"' + openAttr + '>' +
    '<div class="row">' +
      '<div><label>Масштаб (1 : N) — знаменатель N</label>' +
        '<input type="number" min="1" step="1" value="' + m.scaleRatio + '" onchange="setMapSetting(\'scaleRatio\',this.value)"></div>' +
      '<div><label>Физическая ширина карты (см)</label>' +
        '<input type="number" min="0.1" step="0.1" value="' + m.physicalWidthCm + '" onchange="setMapSetting(\'physicalWidthCm\',this.value)"></div>' +
    '</div>' +
    '<div class="row" style="margin-top:10px">' +
      '<div><label>Базовая скорость (км/ч)</label>' +
        '<input type="number" step="0.1" min="0.1" value="' + m.baseSpeed + '" onchange="setMapSetting(\'baseSpeed\',this.value)"></div>' +
      '<div><label>Бонус генераторной (× уровень-1)</label>' +
        '<input type="number" step="0.05" min="0" value="' + m.generatorBonus + '" onchange="setMapSetting(\'generatorBonus\',this.value)"></div>' +
      '<div><label>Множитель скорости</label>' +
        '<input type="number" step="0.05" min="0.05" value="' + m.speedMultiplier + '" onchange="setMapSetting(\'speedMultiplier\',this.value)"></div>' +
    '</div>' +
    '<div class="field" style="margin-top:10px"><label>Комната-генераторная</label>' +
      '<select onchange="setMapSetting(\'generatorRoomId\',this.value)">' + roomOpts + '</select></div>' +
    preview +
    '</div>';

  return html;
}

function renderMapToolbar() {
  var html = '<div class="map-toolbar">';
  html += '<span class="muted">Метка:</span>';
  html += '<input id="marker-emoji-input" type="text" maxlength="6" class="emoji-input" ' +
    'value="' + escapeHtml(ui.currentEmoji) + '" placeholder="🔥" ' +
    'oninput="ui.currentEmoji = this.value" ' +
    'title="Вставь или напечатай любой эмодзи (Win + . или Cmd + Ctrl + Space)">';
  html += '<button class="btn brush-btn' + (ui.currentBrush === 'marker' ? ' active' : '') +
    '" onclick="setBrush(\'marker\')">' +
    (ui.currentBrush === 'marker' ? '🎯 Кликни по карте' : 'Поставить метку') + '</button>';
  html += '<button class="btn brush-btn' + (ui.currentBrush === 'location' ? ' active' : '') +
    '" onclick="setBrush(\'location\')">' +
    (ui.currentBrush === 'location' ? '🎯 Кликни по карте' : '📍 Задать локацию') + '</button>';
  if (ui.currentBrush) {
    html += '<button class="btn btn-ghost brush-btn" onclick="setBrush(null)">🚫 Выкл</button>';
  }
  html += '</div>';
  return html;
}

function renderMarkerInfo(mk) {
  var travel = calcTravel(mk);
  var editing = isAdmin();
  var emoji = getEmoji(mk);
  var isPendingDelete = (ui.pendingDeleteMarker === mk.id);

  var html = '<div class="marker-info">';
  html += '<h3>' +
    '<span class="marker-emoji-big">' + emoji + '</span>' +
    '<span>' + (mk.name ? escapeHtml(mk.name) : '<span class="muted" style="font-style:italic">без названия</span>') + '</span>' +
    (mk.permanent
      ? ' <span class="badge badge-approved">постоянная</span>'
      : ' <span class="badge badge-pending">одноразовая</span>') +
    '</h3>';

  if (editing) {
    html += '<div class="row" style="margin-bottom:12px">' +
      '<div class="fixed" style="width:90px"><label>Эмодзи</label>' +
        '<input type="text" maxlength="6" class="emoji-input"' +
        ' value="' + escapeHtml(emoji) + '" ' +
        'onchange="updateMarker(\'' + mk.id + '\',\'emoji\',this.value.trim()||\'❓\')"></div>' +
      '<div style="flex:2"><label>Название</label>' +
        '<input type="text" value="' + escapeHtml(mk.name || '') + '" placeholder="Название метки" ' +
        'onchange="updateMarker(\'' + mk.id + '\',\'name\',this.value.trim())"></div>' +
      '</div>';

    html += '<div style="margin-bottom:12px">' +
      '<label class="toggle-switch">' +
        '<input type="checkbox"' + (mk.permanent ? ' checked' : '') +
        ' onchange="updateMarker(\'' + mk.id + '\',\'permanent\',this.checked)">' +
        '<span class="toggle-slider"></span>' +
        '<span class="toggle-text">' + (mk.permanent ? '🔒 Постоянная — не исчезнет после прибытия' : '🕐 Одноразовая — исчезнет после прибытия') + '</span>' +
      '</label>' +
    '</div>';
  }

  if (travel) {
    html += '<div class="stat-row">' +
      '<div class="stat"><div class="label">Расстояние</div><div class="value">' + travel.distKm.toFixed(2) + ' км</div></div>' +
      '<div class="stat"><div class="label">Время в пути</div><div class="value">' + formatTime(travel.hours) + '</div></div>' +
      '<div class="stat"><div class="label">Скорость</div><div class="value">' + travel.speed.toFixed(2) + ' км/ч</div></div>' +
      '<div class="stat"><div class="label">Генераторная</div><div class="value">ур. ' + travel.genLevel + '</div></div>' +
      '</div>';
  }

  html += '<div class="row" style="margin-top:10px">';
  if (editing) {
    html += '<button type="button" class="btn btn-danger btn-sm' + (isPendingDelete ? ' btn-confirm-delete' : '') +
      '" onclick="deleteMarker(\'' + mk.id + '\')">' +
      (isPendingDelete ? '⚠️ Нажми ещё раз — точно удалить' : '🗑️ Удалить метку') +
      '</button>';
  }
  if (!session) {
    html += '<span class="muted" style="align-self:center">Войдите, чтобы предложить перемещение</span>';
  } else if (state.map.movement) {
    html += '<span class="muted" style="align-self:center">Уже есть активное предложение или перемещение</span>';
  } else if (travel) {
    html += '<button class="btn btn-success" type="button" onclick="proposeMovement(\'' + mk.id + '\')">📍 Предложить перемещение</button>';
  }
  html += '<button class="btn btn-ghost" type="button" onclick="closeMarkerInfo()">Закрыть</button>';
  html += '</div>';

  html += '</div>';
  return html;
}

function renderLogin() {
  return '<div class="card">' +
      '<h2>🔑 Вход для игроков</h2>' +
      '<div class="field"><label>Имя героя</label>' +
        '<input id="login-username" type="text" autocomplete="off"></div>' +
      '<div class="field"><label>Пароль</label>' +
        '<input id="login-password" type="password"></div>' +
      '<div class="row">' +
        '<button class="btn" onclick="doLogin()">Войти</button>' +
        '<button class="btn btn-ghost" onclick="doRegister()">Зарегистрироваться</button>' +
      '</div>' +
    '</div>' +
    '<div class="card">' +
      '<h2>👑 Вход для администратора</h2>' +
      '<div class="field"><label>Пароль администратора</label>' +
        '<input id="admin-password" type="password"></div>' +
      '<button class="btn" onclick="doAdminLogin()">Войти как админ</button>' +
      '<p class="muted" style="margin-top:14px">Пароль по умолчанию: <code>admin</code>.</p>' +
    '</div>';
}

function renderNewRequest() {
  var upgradable = state.rooms.filter(function(r) { return r.level < r.levels.length; });
  if (!upgradable.length) {
    return '<div class="card"><h2>⚒️ Запросить улучшение</h2><div class="empty">Все комнаты прокачаны до максимума</div></div>';
  }
  var opts = upgradable.map(function(r) {
    return '<option value="' + r.id + '">' + escapeHtml(r.name) + ' (ур. ' + r.level + '/' + r.levels.length + ')</option>';
  }).join('');
  return '<div class="card">' +
      '<h2>⚒️ Запросить улучшение</h2>' +
      '<div class="field"><label>Что улучшить?</label>' +
        '<select id="req-room" onchange="updateReqPreview(this.value)">' + opts + '</select></div>' +
      '<div id="req-preview"></div>' +
      '<div class="field"><label>Комментарий <span class="muted">(необязательно)</span></label>' +
        '<textarea id="req-comment" rows="3" placeholder="Что выделишь на улучшение, кто будет работать — можно оставить пустым"></textarea></div>' +
      '<button class="btn" onclick="submitRequest()">Отправить заявку</button>' +
    '</div>';
}

function updateReqPreview(roomId) {
  var box = document.getElementById('req-preview');
  if (!box) return;
  var room = null;
  for (var i = 0; i < state.rooms.length; i++) if (state.rooms[i].id === roomId) room = state.rooms[i];
  if (!room) { box.innerHTML = ''; return; }
  var next = room.levels[room.level];
  if (!next) { box.innerHTML = '<div class="muted">Максимум достигнут</div>'; return; }
  box.innerHTML = '<div class="card" style="background:#0d0a07;margin-bottom:14px">' +
      '<div class="muted" style="font-size:0.85em">Становится:</div>' +
      '<div>' + escapeHtml(next.desc || '') + '</div>' +
      '<div class="muted" style="font-size:0.85em;margin-top:8px">Стоимость:</div>' +
      '<div>' + formatCost(next.cost, state.resources) + '</div>' +
    '</div>';
}

function renderMyRequests() {
  var mine = state.requests.filter(function(r) { return r.userId === session.userId; });
  if (!mine.length) return '<div class="card"><h2>📜 Мои заявки</h2><div class="empty">Заявок пока нет</div></div>';
  return '<div class="card"><h2>📜 Мои заявки</h2>' + mine.map(function(r) { return requestCard(r, false); }).join('') + '</div>';
}

function requestCard(r, adminView) {
  var statusLabel = { pending: '⏳ На рассмотрении', approved: '✅ Одобрено', rejected: '❌ Отклонено' }[r.status] || r.status;
  var room = null;
  for (var i = 0; i < state.rooms.length; i++) if (state.rooms[i].id === r.roomId) room = state.rooms[i];
  var curLevel = room ? room.level : '?';
  var maxLevel = room ? room.levels.length : '?';
  var nextInfo = '';
  if (room && room.level < room.levels.length) {
    nextInfo = '<div class="muted" style="font-size:0.85em;margin-top:6px">→ уровень ' + (room.level + 1) + ': ' + escapeHtml(room.levels[room.level].desc || '') + '</div>' +
               '<div style="margin-top:4px">' + formatCost(room.levels[room.level].cost, state.resources) + '</div>';
  }
  var actions = (adminView && r.status === 'pending')
    ? '<div class="row" style="margin-top:10px">' +
        '<button class="btn btn-success btn-sm" onclick="approveRequest(\'' + r.id + '\')">Одобрить и списать</button>' +
        '<button class="btn btn-danger btn-sm" onclick="rejectRequest(\'' + r.id + '\')">Отклонить</button>' +
      '</div>'
    : '';
  var comment = (r.comment && r.comment.trim())
    ? escapeHtml(r.comment)
    : '<span class="muted" style="font-style:italic">— без комментария —</span>';
  return '<div class="card" style="background:#181310">' +
      '<div class="row" style="align-items:flex-start">' +
        '<div><strong>' + escapeHtml(r.roomName) + '</strong> <span class="muted">(ур. ' + curLevel + '/' + maxLevel + ') — от ' + escapeHtml(r.username) + '</span></div>' +
        '<div class="fixed"><span class="badge badge-' + r.status + '">' + statusLabel + '</span></div>' +
      '</div>' +
      '<div class="muted" style="margin-top:6px;font-size:0.85em">' + new Date(r.createdAt).toLocaleString('ru-RU') + '</div>' +
      '<div style="margin-top:10px">' + comment + '</div>' +
      nextInfo + actions +
    '</div>';
}

function renderAdminRequests() {
  var sorted = state.requests.slice().sort(function(a, b) {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return b.createdAt - a.createdAt;
  });
  if (!sorted.length) return '<div class="card"><h2>📜 Заявки игроков</h2><div class="empty">Пока заявок нет</div></div>';
  return '<div class="card"><h2>📜 Заявки игроков (' + sorted.length + ')</h2>' +
    sorted.map(function(r) { return requestCard(r, true); }).join('') + '</div>';
}

function renderAdminResources() {
  var rows = state.resources.map(function(r) {
    var isFree = !!r.noDeduct;
    return '<tr>' +
      '<td><input type="text" value="' + escapeHtml(r.name) + '" onchange="updRes(\'' + r.id + '\',\'name\',this.value)"></td>' +
      '<td><input type="number" value="' + r.current + '" onchange="updRes(\'' + r.id + '\',\'current\',this.value)" style="max-width:100px"></td>' +
      '<td><input type="number" min="0" value="' + r.max + '" onchange="updRes(\'' + r.id + '\',\'max\',this.value)" style="max-width:100px" title="0 = без ограничения"></td>' +
      '<td style="text-align:center;white-space:nowrap">' +
        '<label class="toggle-switch" style="padding:4px 10px;gap:8px">' +
          '<input type="checkbox"' + (isFree ? ' checked' : '') +
            ' onchange="updRes(\'' + r.id + '\',\'noDeduct\',this.checked)">' +
          '<span class="toggle-slider"></span>' +
          '<span class="toggle-text" style="font-size:0.8em">' + (isFree ? '🔓 не списывать' : '🔒 списывать') + '</span>' +
        '</label>' +
      '</td>' +
      '<td style="text-align:right"><button class="btn btn-danger btn-sm" onclick="delRes(\'' + r.id + '\')">✕</button></td>' +
      '</tr>';
  }).join('');
  return '<div class="card"><h2>📦 Ресурсы</h2>' +
    '<p class="muted" style="margin-top:0">' +
      '<strong>Списание</strong>: «не списывать» — ресурс указывается в цене, но не отнимается при строительстве. ' +
      '<strong>Максимум</strong>: <code>0</code> — без ограничения (генерация копится бесконечно).' +
    '</p>' +
    '<table><thead><tr><th>Название</th><th>Текущее</th><th>Максимум</th><th style="text-align:center">Списание</th><th></th></tr></thead>' +
    '<tbody>' + (rows || '<tr><td colspan="5" class="empty">Пусто</td></tr>') + '</tbody></table>' +
    '<div style="margin-top:14px"><button class="btn" onclick="addRes()">+ Добавить ресурс</button></div>' +
    '<p class="muted" style="margin-top:12px">Удаление ресурса уберёт его из стоимости и генерации всех комнат.</p>' +
    '</div>';
}

function renderAdminRooms() {
  var roomsHtml = state.rooms.map(roomAdminCard).join('');
  return '<div class="card"><h2>🏗️ Комнаты и сооружения</h2>' +
    '<p class="muted" style="margin-top:0">Уровень 1 — стартовый (без стоимости). Для каждого следующего уровня — описание и цена.</p>' +
    (roomsHtml || '<div class="empty">Пусто</div>') +
    '<div style="margin-top:14px"><button class="btn" onclick="addRoom()">+ Добавить комнату</button></div>' +
    '</div>';
}

function roomAdminCard(room) {
  var levelOptions = room.levels.map(function(_, i) {
    return '<option value="' + (i + 1) + '"' + (room.level === i + 1 ? ' selected' : '') + '>' + (i + 1) + '</option>';
  }).join('');
  var levelsHtml = room.levels.map(function(lvl, i) { return levelEditor(room, lvl, i); }).join('');
  return '<div class="card" style="background:#181310">' +
    '<div class="row">' +
      '<div style="flex:2"><label>Название</label>' +
        '<input type="text" value="' + escapeHtml(room.name) + '" onchange="updRoom(\'' + room.id + '\',\'name\',this.value)"></div>' +
      '<div class="fixed" style="min-width:160px"><label>Текущий уровень</label>' +
        '<select onchange="updRoomLevel(\'' + room.id + '\',this.value)">' + levelOptions + '</select></div>' +
      '<div class="fixed"><button class="btn btn-danger btn-sm" onclick="delRoom(\'' + room.id + '\')">Удалить</button></div>' +
    '</div>' +
    '<div style="margin-top:12px">' +
      levelsHtml +
      '<button class="btn btn-ghost btn-sm" onclick="addLevel(\'' + room.id + '\')">+ Добавить уровень</button>' +
    '</div>' +
    '</div>';
}

function levelEditor(room, lvl, i) {
  var isStart = i === 0;

  var costItems = state.resources.map(function(r) {
    var amt = (lvl.cost && lvl.cost[r.id]) || 0;
    var free = r.noDeduct;
    return '<div class="cost-item"' + (free ? ' style="border-color:#3a5a2a"' : '') + '>' +
      '<span class="muted"' + (free ? ' style="color:#a8d0a8"' : '') + '>' +
        escapeHtml(r.name) + (free ? ' 🔓' : '') + '</span>' +
      '<input type="number" min="0" value="' + amt + '"' + (isStart ? ' disabled' : '') +
        ' onchange="setLevelCost(\'' + room.id + '\',' + i + ',\'' + r.id + '\',this.value)">' +
      '</div>';
  }).join('');

  var genItems = state.resources.map(function(r) {
    var amt = (lvl.generation && lvl.generation[r.id]) || 0;
    return '<div class="cost-item" style="border-color:#3a5a6a">' +
      '<span class="muted" style="color:#a8c8e0">⚡ ' + escapeHtml(r.name) + '</span>' +
      '<input type="number" min="0" value="' + amt + '"' +
        ' onchange="setLevelGeneration(\'' + room.id + '\',' + i + ',\'' + r.id + '\',this.value)">' +
      '</div>';
  }).join('');

  var delBtn = !isStart
    ? '<div class="fixed"><button class="btn btn-danger btn-sm" onclick="delLevel(\'' + room.id + '\',' + i + ')">✕ удалить уровень</button></div>'
    : '';

  var costBlock = !isStart
    ? '<div class="muted" style="font-size:0.85em;margin-top:6px">Стоимость перехода на этот уровень:</div>' +
      '<div class="cost-grid">' + (costItems || '<span class="muted">нет ресурсов</span>') + '</div>'
    : '';

  var genBlock = '<div class="muted" style="font-size:0.85em;margin-top:8px">' +
      '⚡ Генерация за интервал (пока комната на этом уровне):</div>' +
      '<div class="cost-grid">' + (genItems || '<span class="muted">нет ресурсов</span>') + '</div>';

  return '<div class="level-block">' +
    '<div class="row" style="align-items:center">' +
      '<div class="fixed"><strong>Уровень ' + (i + 1) + '</strong>' + (isStart ? ' <span class="muted">(стартовый)</span>' : '') + '</div>' +
      delBtn +
    '</div>' +
    '<textarea rows="2" style="margin-top:6px" placeholder="Описание уровня" onchange="setLevelDesc(\'' + room.id + '\',' + i + ',this.value)">' + escapeHtml(lvl.desc || '') + '</textarea>' +
    costBlock +
    genBlock +
    '</div>';
}

function renderAdminPlayers() {
  if (!state.users.length) return '<div class="card"><h2>👥 Игроки</h2><div class="empty">Пока никто не зарегистрировался</div></div>';
  var m = state.map.movement;
  var yesVotes = (m && m.status === 'proposing' && Array.isArray(m.yesVotes)) ? m.yesVotes : [];
  var noVotes = (m && m.status === 'proposing' && Array.isArray(m.noVotes)) ? m.noVotes : [];
  var rows = state.users.map(function(u) {
    var badges = '';
    if (session && session.userId === u.id) badges += ' <span class="muted">(вы)</span>';
    if (u.kickedAt) badges += ' <span class="badge badge-rejected">кикнут</span>';
    if (yesVotes.indexOf(u.id) !== -1) badges += ' <span class="badge badge-approved">за</span>';
    else if (noVotes.indexOf(u.id) !== -1) badges += ' <span class="badge badge-rejected">против</span>';
    var propCount = state.requests.filter(function(r) { return r.userId === u.id; }).length;
    return '<tr>' +
      '<td>' + escapeHtml(u.username) + badges + '</td>' +
      '<td class="muted">' + propCount + '</td>' +
      '<td style="text-align:right;white-space:nowrap">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-action="kick-player" data-player-id="' + u.id + '">🚪 Выкинуть</button> ' +
        '<button type="button" class="btn btn-danger btn-sm" data-action="delete-player" data-player-id="' + u.id + '">🗑️ Удалить</button>' +
      '</td>' +
      '</tr>';
  }).join('');
  return '<div class="card"><h2>👥 Игроки (' + state.users.length + ')</h2>' +
    '<p class="muted" style="margin-top:0">' +
      '<strong>Выкинуть</strong> — игрока выкинет из аккаунта при следующем действии, но учётка сохранится. ' +
      '<strong>Удалить</strong> — учётка стирается вместе с его голосами.' +
    '</p>' +
    '<table><thead><tr><th>Имя</th><th>Заявок</th><th></th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>' +
    '</div>';
}

function renderAdminSettings() {
  var g = state.generation || { enabled: false, intervalMin: 5, lastTick: 0 };
  var lastTickStr = g.lastTick > 0 ? new Date(g.lastTick).toLocaleString('ru-RU') : 'никогда';
  var nextTickIn = '';
  if (g.enabled && g.lastTick > 0) {
    var msLeft = g.lastTick + g.intervalMin * 60 * 1000 - Date.now();
    if (msLeft > 0) nextTickIn = ' (следующий через ' + Math.ceil(msLeft / 60000) + ' мин)';
    else nextTickIn = ' (скоро)';
  }

  return '<div class="card">' +
      '<h2>⚙️ Настройки базы</h2>' +
      '<div class="field"><label>Название базы</label>' +
        '<input type="text" value="' + escapeHtml(state.baseName) + '" onchange="setBaseName(this.value)"></div>' +
      '<div class="field"><label>Пароль администратора</label>' +
        '<input type="text" value="' + escapeHtml(state.adminPassword) + '" onchange="setAdminPassword(this.value)"></div>' +
    '</div>' +

    '<div class="card">' +
      '<h2>⚡ Генерация ресурсов</h2>' +
      '<p class="muted" style="margin-top:0">Настройка по каждой комнате задаётся в разделе «🏗️ Комнаты» — у каждого уровня есть блок «Генерация за интервал». ' +
        'Здесь задаются общие параметры: включена ли генерация, как часто срабатывает тик.</p>' +
      '<div style="margin-bottom:12px">' +
        '<label class="toggle-switch">' +
          '<input type="checkbox"' + (g.enabled ? ' checked' : '') +
            ' onchange="setGenerationSetting(\'enabled\', this.checked)">' +
          '<span class="toggle-slider"></span>' +
          '<span class="toggle-text">' + (g.enabled ? '⚡ Генерация включена' : '⏸ Генерация выключена') + '</span>' +
        '</label>' +
      '</div>' +
      '<div class="field"><label>Интервал генерации (минут)</label>' +
        '<input type="number" min="1" step="1" value="' + g.intervalMin + '" ' +
        'onchange="setGenerationSetting(\'intervalMin\', this.value)"></div>' +
      '<div class="muted" style="font-size:0.9em">Последний тик: <strong>' + lastTickStr + '</strong>' + nextTickIn + '</div>' +
      '<p class="muted" style="font-size:0.85em;margin-top:8px">Тик срабатывает, пока у кого-то из игроков (включая админа) открыт сайт. ' +
        'Если никто не открыл сайт за интервал — генерация не сработает. Можно ускорить вручную:</p>' +
      '<div class="row" style="margin-top:8px">' +
        '<button class="btn" onclick="forceTickGeneration()">⚡ Тикнуть сейчас</button>' +
        '<button class="btn btn-ghost" onclick="resetGenerationTimer()">🕐 Сбросить таймер</button>' +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<h2>💾 Данные</h2>' +
      '<div class="row">' +
        '<button class="btn btn-ghost" onclick="exportData()">Экспорт JSON</button>' +
        '<button class="btn btn-ghost" onclick="document.getElementById(\'import-file\').click()">Импорт JSON</button>' +
        '<button class="btn btn-danger" onclick="resetAll()">Сбросить всё</button>' +
      '</div>' +
      '<input type="file" id="import-file" accept="application/json" style="display:none" onchange="importData(event)">' +
      '<p class="muted" style="margin-top:12px">Экспорт/импорт работает в любом режиме БД.</p>' +
    '</div>';
}

function resetGenerationTimer() {
  if (!isAdmin()) return;
  mutate(function(s) { s.generation.lastTick = Date.now(); });
  toast('🕐 Таймер генерации сброшен');
}