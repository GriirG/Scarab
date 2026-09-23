function uid() { return Math.random().toString(36).slice(2, 10); }
function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
function round2(n) { return Math.round(n * 100) / 100; }
function isAdmin() { return session && session.isAdmin; }

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function getEmoji(mk) {
  if (mk.emoji) return mk.emoji;
  return LEGACY_MARKER_TYPES[mk.type] || '❓';
}

function toast(msg) {
  var c = document.getElementById('toast-container');
  if (!c) return;
  var t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(function() { t.style.opacity = '0'; t.style.transition = 'opacity 0.3s'; }, 2600);
  setTimeout(function() { t.remove(); }, 3000);
}

function formatCost(cost, resources) {
  if (!cost || !Object.keys(cost).length) return '<span class="muted">бесплатно</span>';
  return Object.keys(cost).map(function(rid) {
    var amt = cost[rid];
    var r = resources.filter(function(x) { return x.id === rid; })[0];
    var isFree = r && r.noDeduct;
    var label = escapeHtml(r ? r.name : '(удалён)') + ': ' + amt + (isFree ? ' (не списывается)' : '');
    return '<span class="cost-tag' + (isFree ? ' free' : '') + '">' + label + '</span>';
  }).join('');
}

function formatTime(hours) {
  if (!isFinite(hours)) return '∞';
  if (hours < 1/60) return '<1 мин';
  var totalMin = Math.round(hours * 60);
  if (totalMin < 60) return totalMin + ' мин';
  var h = Math.floor(totalMin / 60);
  var m = totalMin % 60;
  return h + ' ч' + (m ? ' ' + m + ' мин' : '');
}

function formatScale(n) {
  var s = String(Math.round(n));
  var parts = [];
  while (s.length > 3) {
    parts.unshift(s.slice(-3));
    s = s.slice(0, -3);
  }
  parts.unshift(s);
  return parts.join(' ');
}

function findUsername(userId) {
  if (userId === 'admin') return 'Администратор';
  for (var i = 0; i < state.users.length; i++) if (state.users[i].id === userId) return state.users[i].username;
  return '???';
}

function getMarker(id) {
  for (var i = 0; i < state.map.markers.length; i++) if (state.map.markers[i].id === id) return state.map.markers[i];
  return null;
}