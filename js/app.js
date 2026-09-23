window.addEventListener('error', function (e) {
  console.error('Global error:', e.error || e.message);
  try { toast('⚠️ Ошибка: ' + (e.message || 'unknown')); } catch(_) {}
});
window.addEventListener('unhandledrejection', function (e) {
  console.error('Unhandled rejection:', e.reason);
});

// Делегированные обработчики кнопок «выкинуть / удалить игрока»
document.addEventListener('click', function(e) {
  var t = e.target;
  if (!t || !t.closest) return;
  var kickBtn = t.closest('[data-action="kick-player"]');
  if (kickBtn) {
    e.preventDefault(); e.stopPropagation();
    kickPlayer(kickBtn.getAttribute('data-player-id'), false);
    return;
  }
  var delPlayerBtn = t.closest('[data-action="delete-player"]');
  if (delPlayerBtn) {
    e.preventDefault(); e.stopPropagation();
    kickPlayer(delPlayerBtn.getAttribute('data-player-id'), true);
    return;
  }
}, true);

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && ui.confirmState) confirmNo();
});

// Старт
session = loadSession();
initDB();
setInterval(tickMovement, 200);