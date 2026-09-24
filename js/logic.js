function mutate(fn) {
  if (!state) return;
  fn(state);
  render();
  saveState();
}

// ===== РАСЧЁТ ПУТИ =====
function calcTravel(marker) {
  var m = state.map;
  if (!m || !m.naturalWidth || !m.naturalHeight) return null;
  if (!m.scaleRatio || !m.physicalWidthCm) return null;

  var dxPct = marker.x - m.currentLocation.x;
  var dyPct = marker.y - m.currentLocation.y;
  var dxPx = dxPct / 100 * m.naturalWidth;
  var dyPx = dyPct / 100 * m.naturalHeight;
  var distPx = Math.sqrt(dxPx * dxPx + dyPx * dyPx);

  var cmPerPx = m.physicalWidthCm / m.naturalWidth;
  var realCmPerPx = cmPerPx * m.scaleRatio;
  var kmPerPx = realCmPerPx / 100000;

  var distKm = distPx * kmPerPx;

  var genRoom = null;
  for (var i = 0; i < state.rooms.length; i++) if (state.rooms[i].id === m.generatorRoomId) genRoom = state.rooms[i];
  var genLevel = genRoom ? genRoom.level : 1;
  var speed = m.baseSpeed * (1 + m.generatorBonus * (genLevel - 1)) * (m.speedMultiplier || 1);
  if (speed <= 0) speed = 0.001;

  var travelHours = distKm / speed;

  return {
    distKm: distKm,
    hours: travelHours,
    speed: speed,
    genLevel: genLevel,
    kmPerPx: kmPerPx
  };
}

// 1 час рпшного времени = 30 сек реального
function hoursToBarMs(hours) {
  if (!isFinite(hours) || hours <= 0) return 2000;
  return Math.max(2000, Math.round(hours * 30 * 1000));
}

function calcNeeded() {
  var players = state.users.length;
  var needed = Math.floor(players / 2) + 1;
  return needed < 1 ? 1 : needed;
}

// ===== СЕССИЯ =====
function checkSessionValidity() {
  if (!session || session.isAdmin) return;
  var user = null;
  for (var i = 0; i < state.users.length; i++) if (state.users[i].id === session.userId) user = state.users[i];
  if (!user) {
    saveSession(null);
    ui.currentTab = 'base';
    setTimeout(function() { toast('⚠️ Ваша учётка была удалена администратором'); }, 50);
    return;
  }
  if (user.kickedAt && (!session.loggedInAt || user.kickedAt > session.loggedInAt)) {
    saveSession(null);
    ui.currentTab = 'base';
    setTimeout(function() { toast('⚠️ Администратор выкинул вас из аккаунта'); }, 50);
  }
}

// ===== КАСТОМНЫЙ CONFIRM =====
function showConfirm(message, onYes) {
  ui.confirmState = { message: message, onYes: onYes };
  render();
}
function confirmYes() {
  var fn = ui.confirmState ? ui.confirmState.onYes : null;
  ui.confirmState = null;
  render();
  if (typeof fn === 'function') fn();
}
function confirmNo() {
  ui.confirmState = null;
  render();
}

// ===== ДВИЖЕНИЕ =====
function proposeMovement(markerId) {
  if (!session) return toast('Нужно войти');
  if (state.map.movement) return toast('Уже есть активное предложение или перемещение');
  var mk = getMarker(markerId);
  if (!mk) return toast('Метка не найдена');
  var travel = calcTravel(mk);
  if (!travel) return toast('Не могу рассчитать маршрут');

  var needed = calcNeeded();
  var autoStart = (1 >= needed);

  var movement = {
    status: 'proposing',
    markerId: markerId,
    markerName: mk.name || getEmoji(mk),
    targetX: mk.x,
    targetY: mk.y,
    travelHours: travel.hours,
    travelKm: travel.distKm,
    proposedBy: session.userId,
    proposedByName: session.username,
    createdAt: Date.now(),
    yesVotes: [session.userId],
    noVotes: [],
    needed: needed
  };

  if (autoStart) {
    movement.status = 'moving';
    movement.startedAt = Date.now();
    movement.durationMs = hoursToBarMs(travel.hours);
  }

  mutate(function(s) { s.map.movement = movement; });
  toast(autoStart ? '🚶 В путь' : '📜 Предложение создано — нужно ' + needed + ' голосов');
}

function voteMovement(agree) {
  if (!session) return toast('Войдите, чтобы голосовать');
  if (!state.map.movement || state.map.movement.status !== 'proposing') return;
  // Firebase мог потерять пустые массивы — восстанавливаем перед использованием
  if (!Array.isArray(state.map.movement.yesVotes)) state.map.movement.yesVotes = [];
  if (!Array.isArray(state.map.movement.noVotes)) state.map.movement.noVotes = [];
  var userId = session.userId;
  var m = state.map.movement;
  if (m.yesVotes.indexOf(userId) !== -1 || m.noVotes.indexOf(userId) !== -1) {
    return toast('Ты уже голосовал');
  }
  mutate(function(s) {
    if (!Array.isArray(s.map.movement.yesVotes)) s.map.movement.yesVotes = [];
    if (!Array.isArray(s.map.movement.noVotes)) s.map.movement.noVotes = [];
    if (agree) s.map.movement.yesVotes.push(userId);
    else s.map.movement.noVotes.push(userId);
    if (s.map.movement.yesVotes.length >= s.map.movement.needed) {
      s.map.movement.status = 'moving';
      s.map.movement.startedAt = Date.now();
      s.map.movement.durationMs = hoursToBarMs(s.map.movement.travelHours);
    }
  });
  var m2 = state.map.movement;
  if (m2 && m2.status === 'moving') toast('✅ Большинство за — выдвигаемся!');
  else toast(agree ? '✅ Голос за' : '❌ Голос против');
}

function adminForceStartMovement() {
  if (!isAdmin()) return;
  if (!state.map.movement || state.map.movement.status !== 'proposing') return;
  mutate(function(s) {
    s.map.movement.status = 'moving';
    s.map.movement.startedAt = Date.now();
    s.map.movement.durationMs = hoursToBarMs(s.map.movement.travelHours);
  });
  toast('▶️ Выдвигаемся');
}

function adminSkipMovement() {
  if (!isAdmin()) return;
  if (!state.map.movement || state.map.movement.status !== 'moving') return;
  showConfirm('Пропустить перемещение и сразу переместить отряд?', function() {
    completeMovement();
  });
}

function cancelMovement() {
  if (!state.map.movement) return;
  var m = state.map.movement;
  var allowed = isAdmin() || (session && m.status === 'proposing' && session.userId === m.proposedBy);
  if (!allowed) return toast('Недостаточно прав');
  showConfirm('Отменить ' + (m.status === 'moving' ? 'перемещение' : 'предложение') + '?', function() {
    mutate(function(s) { s.map.movement = null; });
    toast('Отменено');
  });
}

function completeMovement() {
  if (!state || !state.map || !state.map.movement) return;
  var m = state.map.movement;
  if (m.status !== 'moving') return;
  var targetX = m.targetX, targetY = m.targetY, markerId = m.markerId;
  var markerName = m.markerName;

  mutate(function(s) {
    s.map.currentLocation = { x: targetX, y: targetY };
    var mk = null;
    for (var i = 0; i < s.map.markers.length; i++) if (s.map.markers[i].id === markerId) mk = s.map.markers[i];
    if (mk && !mk.permanent) {
      s.map.markers = s.map.markers.filter(function(x) { return x.id !== markerId; });
    }
    s.map.movement = null;
  });

  if (ui.selectedMarkerId === markerId) ui.selectedMarkerId = null;
  toast('🏁 Прибыли: ' + markerName);
}

function tickMovement() {
  if (!state || !state.map || !state.map.movement) return;
  var m = state.map.movement;
  if (m.status !== 'moving') return;
  var elapsed = Date.now() - m.startedAt;
  if (elapsed >= m.durationMs) { completeMovement(); return; }

  var progress = Math.min(1, elapsed / m.durationMs);

  var fills = document.querySelectorAll('.movement-bar-fill');
  for (var i = 0; i < fills.length; i++) fills[i].style.width = (progress * 100) + '%';

  var remainingRP = m.travelHours * (1 - progress);
  var labels = document.querySelectorAll('.movement-bar-label');
  for (var j = 0; j < labels.length; j++) labels[j].textContent = formatTime(remainingRP);
}

// ===== КАРТА =====
function onMapClick(e) {
  var target = e.target.closest ? e.target.closest('.map-marker') : null;
  if (target && !ui.currentBrush) {
    var id = target.getAttribute('data-marker-id');
    if (id) {
      ui.selectedMarkerId = id;
      ui.pendingDeleteMarker = null;
      render();
      return;
    }
  }

  var container = document.getElementById('map-container');
  if (!container) return;
  var rect = container.getBoundingClientRect();
  var x = round2(((e.clientX - rect.left) / rect.width) * 100);
  var y = round2(((e.clientY - rect.top) / rect.height) * 100);
  if (x < 0 || x > 100 || y < 0 || y > 100) return;

  if (isAdmin() && ui.currentBrush === 'location') {
    mutate(function(s) { s.map.currentLocation = { x: x, y: y }; });
    toast('📍 Локация отряда обновлена');
    return;
  }
  if (isAdmin() && ui.currentBrush === 'marker') {
    var emojiInput = document.getElementById('marker-emoji-input');
    var emoji = emojiInput ? (emojiInput.value.trim() || '❓') : (ui.currentEmoji || '❓');
    ui.currentEmoji = emoji;
    var newId = uid();
    mutate(function(s) {
      s.map.markers.push({ id: newId, x: x, y: y, emoji: emoji, name: '', permanent: false });
    });
    ui.selectedMarkerId = newId;
    toast('Метка добавлена — впиши название в панели');
    return;
  }

  ui.selectedMarkerId = null;
  ui.pendingDeleteMarker = null;
  render();
}

function setBrush(key) {
  ui.currentBrush = (key === null || key === ui.currentBrush) ? null : key;
  ui.selectedMarkerId = null;
  ui.pendingDeleteMarker = null;
  render();
}

function toggleMapSettings() {
  ui.mapSettingsOpen = !ui.mapSettingsOpen;
  render();
}

function setMapSetting(field, value) {
  var numeric = ['scaleRatio', 'physicalWidthCm', 'baseSpeed', 'generatorBonus', 'speedMultiplier'];
  if (numeric.indexOf(field) !== -1) value = Number(value);
  if (typeof value === 'number' && (!isFinite(value) || value < 0)) value = 0;
  if (field === 'scaleRatio' && value < 1) value = 1;
  if (field === 'physicalWidthCm' && value <= 0) value = 0.1;
  if (field === 'baseSpeed' && value <= 0) value = 0.1;
  if (field === 'speedMultiplier' && value <= 0) value = 0.05;
  mutate(function(s) { s.map[field] = value; });
  toast('Сохранено');
}

function uploadMap(ev) {
  var f = ev.target.files[0];
  if (!f) return;
  if (f.size > 12 * 1024 * 1024) return toast('Файл слишком большой (макс ~12 МБ)');
  var reader = new FileReader();
  reader.onload = function() {
    var dataUrl = reader.result;
    var img = new Image();
    img.onload = function() {
      var maxDim = 1600;
      var w = img.naturalWidth, h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        var sc = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * sc);
        h = Math.round(h * sc);
      }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      var isJpeg = /jpe?g/i.test(f.type);
      var out = isJpeg ? canvas.toDataURL('image/jpeg', 0.85) : canvas.toDataURL('image/png');
      mutate(function(s) {
        s.map.image = out;
        s.map.naturalWidth = w;
        s.map.naturalHeight = h;
      });
      toast('Карта загружена');
    };
    img.onerror = function() { toast('Не удалось прочитать изображение'); };
    img.src = dataUrl;
  };
  reader.readAsDataURL(f);
}

function removeMap() {
  showConfirm('Удалить карту? Метки останутся, но без подложки.', function() {
    mutate(function(s) {
      s.map.image = null;
      s.map.naturalWidth = 0;
      s.map.naturalHeight = 0;
    });
    toast('Карта удалена');
  });
}

function updateMarker(id, field, value) {
  mutate(function(s) {
    for (var i = 0; i < s.map.markers.length; i++) {
      if (s.map.markers[i].id === id) {
        s.map.markers[i][field] = value;
        break;
      }
    }
  });
  if (field !== 'name') toast('Метка обновлена');
}

function deleteMarker(id) {
  if (!id) return;
  if (ui.pendingDeleteMarker !== id) {
    ui.pendingDeleteMarker = id;
    render();
    toast('⚠️ Нажми «Удалить» ещё раз, чтобы подтвердить (4 сек)');
    setTimeout(function() {
      if (ui.pendingDeleteMarker === id) {
        ui.pendingDeleteMarker = null;
        render();
      }
    }, 4000);
    return;
  }
  ui.pendingDeleteMarker = null;
  if (ui.selectedMarkerId === id) ui.selectedMarkerId = null;
  mutate(function(s) {
    s.map.markers = s.map.markers.filter(function(m) { return m.id !== id; });
  });
  toast('🗑️ Метка удалена');
}

function closeMarkerInfo() {
  ui.selectedMarkerId = null;
  ui.pendingDeleteMarker = null;
  render();
}

// ===== АВТОРИЗАЦИЯ =====
function switchTab(id) {
  ui.currentTab = id;
  ui.pendingDeleteMarker = null;
  ui.confirmState = null;
  render();
}

function logout() {
  saveSession(null);
  ui.currentTab = 'base';
  ui.pendingDeleteMarker = null;
  ui.confirmState = null;
  render();
  toast('Вы вышли');
}

function doRegister() {
  var u = document.getElementById('login-username').value.trim();
  var p = document.getElementById('login-password').value;
  if (!u || !p) return toast('Введите имя и пароль');
  if (state.users.some(function(x) { return x.username.toLowerCase() === u.toLowerCase(); }))
    return toast('Такое имя уже занято');
  var user = { id: uid(), username: u, password: p, kickedAt: 0 };
  mutate(function(s) { s.users.push(user); });
  saveSession({ userId: user.id, username: user.username, isAdmin: false, loggedInAt: Date.now() });
  toast('Добро пожаловать, ' + u + '!');
  ui.currentTab = 'base';
  render();
}

function doLogin() {
  var u = document.getElementById('login-username').value.trim();
  var p = document.getElementById('login-password').value;
  var user = null;
  for (var i = 0; i < state.users.length; i++) {
    if (state.users[i].username.toLowerCase() === u.toLowerCase()) { user = state.users[i]; break; }
  }
  if (!user || user.password !== p) return toast('Неверное имя или пароль');
  if (user.kickedAt) user.kickedAt = 0;
  saveSession({ userId: user.id, username: user.username, isAdmin: false, loggedInAt: Date.now() });
  toast('С возвращением, ' + user.username + '!');
  ui.currentTab = 'base';
  render();
  saveState();
}

function doAdminLogin() {
  var p = document.getElementById('admin-password').value;
  if (p !== state.adminPassword) return toast('Неверный пароль');
  saveSession({ userId: 'admin', username: 'Администратор', isAdmin: true, loggedInAt: Date.now() });
  toast('Режим администратора');
  ui.currentTab = 'admin-requests';
  render();
}

// ===== ЗАЯВКИ =====
function submitRequest() {
  if (!session || session.isAdmin) return;
  var roomId = document.getElementById('req-room').value;
  var comment = document.getElementById('req-comment').value.trim();
  var room = null;
  for (var i = 0; i < state.rooms.length; i++) if (state.rooms[i].id === roomId) room = state.rooms[i];
  if (!room) return toast('Комната не найдена');
  var s = session;
  mutate(function(st) {
    st.requests.unshift({
      id: uid(), userId: s.userId, username: s.username,
      roomId: roomId, roomName: room.name, comment: comment,
      status: 'pending', createdAt: Date.now()
    });
  });
  toast('Заявка отправлена!');
  ui.currentTab = 'myreq';
  render();
}

function approveRequest(id) {
  var r = null;
  for (var i = 0; i < state.requests.length; i++) if (state.requests[i].id === id) r = state.requests[i];
  if (!r) return;
  var room = null;
  for (var j = 0; j < state.rooms.length; j++) if (state.rooms[j].id === r.roomId) room = state.rooms[j];
  if (!room) { mutate(function(s) { r.status = 'approved'; }); toast('Комната удалена, заявка закрыта'); return; }
  if (room.level >= room.levels.length) { mutate(function(s) { r.status = 'approved'; }); toast('Уже максимум'); return; }

  var next = room.levels[room.level];
  var cost = next.cost || {};

  var deductible = [];
  var missing = [];
  Object.keys(cost).forEach(function(rid) {
    var res = null;
    for (var k = 0; k < state.resources.length; k++) if (state.resources[k].id === rid) res = state.resources[k];
    if (!res || res.noDeduct) return;
    deductible.push({ id: rid, amt: cost[rid] });
    if (res.current < cost[rid]) missing.push(res.name + ': нужно ' + cost[rid] + ', есть ' + res.current);
  });

  function doApprove(force) {
    mutate(function(s) {
      for (var i = 0; i < deductible.length; i++) {
        var d = deductible[i];
        var res = null;
        for (var k = 0; k < s.resources.length; k++) if (s.resources[k].id === d.id) res = s.resources[k];
        if (res) res.current = Math.max(0, res.current - d.amt);
      }
      room.level = clamp(room.level + 1, 1, room.levels.length);
      r.status = 'approved';
    });
    toast('Одобрено: ' + r.roomName + ' → ур. ' + room.level + (force ? ' (принудительно)' : ''));
  }

  if (missing.length) {
    showConfirm('Не хватает ресурсов:\n' + missing.join('\n') + '\n\nСписать доступное и одобрить всё равно?', function() {
      doApprove(true);
    });
    return;
  }
  doApprove(false);
}

function rejectRequest(id) {
  var r = null;
  for (var i = 0; i < state.requests.length; i++) if (state.requests[i].id === id) r = state.requests[i];
  if (!r) return;
  mutate(function(s) { r.status = 'rejected'; });
  toast('Отклонено: ' + r.roomName);
}

// ===== РЕСУРСЫ =====
function updRes(id, field, value) {
  var r = null;
  for (var i = 0; i < state.resources.length; i++) if (state.resources[i].id === id) r = state.resources[i];
  if (!r) return;
  if (field === 'current' || field === 'max') value = Number(value) || 0;
  mutate(function() { r[field] = value; });
  if (field === 'noDeduct') toast(value ? '🔓 Не списывается' : '🔒 Списывается');
  else toast('Сохранено');
}

function delRes(id) {
  showConfirm('Удалить ресурс? Он пропадёт из стоимостей уровней.', function() {
    mutate(function(s) {
      s.resources = s.resources.filter(function(x) { return x.id !== id; });
      for (var i = 0; i < s.rooms.length; i++) {
        for (var j = 0; j < s.rooms[i].levels.length; j++) {
          var lvl = s.rooms[i].levels[j];
          if (lvl.cost && lvl.cost[id]) delete lvl.cost[id];
          if (lvl.generation && lvl.generation[id]) delete lvl.generation[id];
        }
      }
    });
  });
}

function addRes() {
  mutate(function(s) { s.resources.push({ id: uid(), name: 'Новый ресурс', current: 0, max: 100, noDeduct: false }); });
}

// ===== ГЕНЕРАЦИЯ =====
function computeGenerationGains() {
  var gains = {};
  for (var i = 0; i < state.rooms.length; i++) {
    var room = state.rooms[i];
    var lvl = room.levels[room.level - 1];
    if (!lvl || !lvl.generation) continue;
    for (var rid in lvl.generation) {
      var amt = lvl.generation[rid];
      if (amt > 0) gains[rid] = (gains[rid] || 0) + amt;
    }
  }
  return gains;
}

function tickGeneration(force) {
  if (!state || !state.generation) return;
  if (!force && !state.generation.enabled) return;

  var now = Date.now();
  var intervalMs = (state.generation.intervalMin || 5) * 60 * 1000;
  if (!force && now - state.generation.lastTick < intervalMs) return;

  var gains = computeGenerationGains();
  var hasGains = false;
  for (var k in gains) { hasGains = true; break; }

  mutate(function(s) {
    s.generation.lastTick = now;
    if (!hasGains) return;
    for (var rid in gains) {
      var res = null;
      for (var i = 0; i < s.resources.length; i++) if (s.resources[i].id === rid) res = s.resources[i];
      if (!res) continue;
      var newVal = res.current + gains[rid];
      if (res.max > 0 && newVal > res.max) newVal = res.max;
      res.current = newVal;
    }
  });

  if (hasGains) {
    var parts = [];
    for (var rid2 in gains) {
      var r2 = null;
      for (var j = 0; j < state.resources.length; j++) if (state.resources[j].id === rid2) r2 = state.resources[j];
      if (r2) parts.push(r2.name + ' +' + gains[rid2]);
    }
    if (parts.length) toast('⚡ Генерация: ' + parts.join(', '));
  }
}

function forceTickGeneration() {
  if (!isAdmin()) return;
  if (!state || !state.generation) return;
  tickGeneration(true);
  toast('⚡ Тик генерации выполнен');
}

function setLevelGeneration(roomId, i, resId, v) {
  var r = null;
  for (var k = 0; k < state.rooms.length; k++) if (state.rooms[k].id === roomId) r = state.rooms[k];
  if (!r) return;
  var n = Number(v) || 0;
  mutate(function() {
    var lvl = r.levels[i];
    lvl.generation = lvl.generation || {};
    if (n <= 0) delete lvl.generation[resId];
    else lvl.generation[resId] = n;
  });
  toast('Генерация обновлена');
}

function setGenerationSetting(field, value) {
  if (!isAdmin()) return;
  if (field === 'enabled') {
    mutate(function(s) { s.generation.enabled = !!value; });
    toast(value ? '⚡ Генерация включена' : '⏸ Генерация выключена');
    return;
  }
  if (field === 'intervalMin') {
    value = Number(value) || 5;
    if (value < 1) value = 1;
    mutate(function(s) { s.generation.intervalMin = value; });
    toast('Интервал: ' + value + ' мин');
  }
}

function formatGenSummary(level) {
  if (!level || !level.generation) return '';
  var parts = [];
  for (var rid in level.generation) {
    var amt = level.generation[rid];
    if (amt <= 0) continue;
    var r = null;
    for (var i = 0; i < state.resources.length; i++) if (state.resources[i].id === rid) r = state.resources[i];
    if (r) parts.push(r.name + ' +' + amt);
  }
  return parts.join(', ');
}

// ===== КОМНАТЫ =====
function updRoom(id, field, value) {
  var r = null;
  for (var i = 0; i < state.rooms.length; i++) if (state.rooms[i].id === id) r = state.rooms[i];
  if (!r) return;
  mutate(function() { r[field] = value; });
  toast('Сохранено');
}

function updRoomLevel(id, value) {
  var r = null;
  for (var i = 0; i < state.rooms.length; i++) if (state.rooms[i].id === id) r = state.rooms[i];
  if (!r) return;
  var n = clamp(Number(value) || 1, 1, r.levels.length);
  mutate(function() { r.level = n; });
  toast('Уровень: ' + n);
}

function setLevelDesc(roomId, i, v) {
  var r = null;
  for (var k = 0; k < state.rooms.length; k++) if (state.rooms[k].id === roomId) r = state.rooms[k];
  if (!r) return;
  mutate(function() { r.levels[i].desc = v; });
  toast('Описание сохранено');
}

function setLevelCost(roomId, i, resId, v) {
  var r = null;
  for (var k = 0; k < state.rooms.length; k++) if (state.rooms[k].id === roomId) r = state.rooms[k];
  if (!r) return;
  var n = Number(v) || 0;
  mutate(function() {
    var lvl = r.levels[i];
    lvl.cost = lvl.cost || {};
    if (n <= 0) delete lvl.cost[resId];
    else lvl.cost[resId] = n;
  });
  toast('Стоимость обновлена');
}

function addLevel(roomId) {
  var r = null;
  for (var k = 0; k < state.rooms.length; k++) if (state.rooms[k].id === roomId) r = state.rooms[k];
  if (!r) return;
  mutate(function() { r.levels.push({ desc: 'Новый уровень', cost: {}, generation: {} }); });
}

function delLevel(roomId, i) {
  if (i === 0) return;
  showConfirm('Удалить уровень ' + (i + 1) + '?', function() {
    var r = null;
    for (var k = 0; k < state.rooms.length; k++) if (state.rooms[k].id === roomId) r = state.rooms[k];
    if (!r) return;
    mutate(function() {
      r.levels.splice(i, 1);
      if (r.level > r.levels.length) r.level = r.levels.length;
    });
  });
}

function delRoom(id) {
  showConfirm('Удалить комнату?', function() {
    mutate(function(s) { s.rooms = s.rooms.filter(function(x) { return x.id !== id; }); });
  });
}

function addRoom() {
  mutate(function(s) {
    s.rooms.push({
      id: uid(), name: 'Новая комната', level: 1,
      levels: [
        { desc: 'Стартовое состояние', cost: {}, generation: {} },
        { desc: 'Улучшенный уровень', cost: {}, generation: {} }
      ]
    });
  });
}

// ===== ИГРОКИ =====
function kickPlayer(id, deleteAccount) {
  var u = null;
  for (var i = 0; i < state.users.length; i++) if (state.users[i].id === id) u = state.users[i];
  if (!u) return toast('Игрок не найден');
  var msg = deleteAccount
    ? 'Удалить учётку игрока «' + u.username + '» насовсем? Заявки останутся, но автор будет "???".'
    : 'Выкинуть игрока «' + u.username + '» из аккаунта? Учётка сохранится, сможет войти снова.';
  showConfirm(msg, function() {
    var kickedSelf = (session && session.userId === id);
    mutate(function(s) {
      if (deleteAccount) {
        s.users = s.users.filter(function(x) { return x.id !== id; });
        if (s.map.movement) {
          if (Array.isArray(s.map.movement.yesVotes))
            s.map.movement.yesVotes = s.map.movement.yesVotes.filter(function(v) { return v !== id; });
          if (Array.isArray(s.map.movement.noVotes))
            s.map.movement.noVotes = s.map.movement.noVotes.filter(function(v) { return v !== id; });
        }
      } else {
        for (var k = 0; k < s.users.length; k++) {
          if (s.users[k].id === id) s.users[k].kickedAt = Date.now();
        }
      }
    });
    if (kickedSelf) {
      saveSession(null);
      ui.currentTab = 'base';
      render();
      toast(deleteAccount ? '🗑️ Вы удалили свою учётку' : '🚪 Вы выкинули себя');
      return;
    }
    toast(deleteAccount ? '🗑️ Учётка удалена' : '🚪 Игрок выкинут');
  });
}

// ===== НАСТРОЙКИ =====
function setBaseName(v) {
  mutate(function(s) { s.baseName = (v || '').trim() || 'База'; });
  toast('Название обновлено');
}

function setAdminPassword(v) {
  if (!v) return;
  mutate(function(s) { s.adminPassword = v; });
  toast('Пароль обновлён');
}

function resetAll() {
  showConfirm('Сбросить ВСЁ? Это удалит игроков, заявки, карту и настройки.', function() {
    try {
      localStorage.removeItem(LS_KEY_DB);
      localStorage.removeItem(LS_KEY_SESSION);
    } catch (e) {}
    location.reload();
  });
}

function exportData() {
  var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = 'scarab-backup.json'; a.click();
  URL.revokeObjectURL(url);
}

function importData(ev) {
  var f = ev.target.files[0];
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function() {
    try {
      var data = JSON.parse(reader.result);
      if (!data.baseName || !Array.isArray(data.rooms)) throw new Error('bad');
      state = migrate(data);
      render();
      saveState();
      toast('Импортировано');
    } catch (e) { toast('Ошибка импорта'); }
  };
  reader.readAsText(f);
}