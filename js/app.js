window.addEventListener('error', function (e) {
  console.error('Global error:', e.error || e.message);
  try { toast('⚠️ Ошибка: ' + (e.message || 'unknown')); } catch(_) {}
});
window.addEventListener('unhandledrejection', function (e) {
  console.error('Unhandled rejection:', e.reason);
});

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

// ═══════════════════════════════════════════════════════════════════
// ЛОГИКА YOUTUBE ПЛЕЕРА
// ═══════════════════════════════════════════════════════════════════

window.onYouTubeIframeAPIReady = function() {
  ytApiReady = true;
  initYoutubePlayer();
};

function initYoutubePlayer() {
  if (!ytApiReady || ytPlayer) return;
  
  ytPlayer = new YT.Player('youtube-player-container', {
    height: '1',
    width: '1',
    videoId: '',
    playerVars: {
      'autoplay': 0,
      'controls': 0,
      'disablekb': 1,
      'fs': 0,
      'modestbranding': 1,
      'playsinline': 1,
      'origin': window.location.origin
    },
    events: {
      'onReady': function(event) {
        event.target.setVolume(ui.playerVolume);
        syncYoutubePlayer();
      },
      'onStateChange': function(event) {
        if (event.data === YT.PlayerState.ENDED) {
          if (!state.player.playlistId && isAdmin()) {
            mutate(function(s) { s.player.status = 'stopped'; });
          }
        }
      }
    }
  });
}

function syncYoutubePlayer() {
  if (!ytPlayer || !ytApiReady || !state || !state.player) return;
  
  var p = state.player;
  
  // Если музыка не задана или остановлена
  if (p.status === 'stopped' || (!p.videoId && !p.playlistId)) {
    if (typeof ytPlayer.stopVideo === 'function' && ytPlayer.getPlayerState() !== YT.PlayerState.UNSTARTED) {
       ytPlayer.stopVideo();
       currentTrackLoaded = '';
    }
    var oldPrompt = document.getElementById('unmute-prompt');
    if (oldPrompt) oldPrompt.remove();
    return;
  }

  var trackId = p.videoId || p.playlistId;

  // Загрузка трека
  if (currentTrackLoaded !== trackId) {
    currentTrackLoaded = trackId;
    if (p.playlistId) {
      ytPlayer.loadPlaylist({
        list: p.playlistId,
        listType: 'playlist',
        index: 0,
        startSeconds: 0
      });
    } else {
      ytPlayer.loadVideoById({
        videoId: p.videoId,
        startSeconds: 0
      });
    }
  }

  // Синхронизация
  if (p.status === 'playing') {
    var expectedTime = (Date.now() - p.startedAt) / 1000;
    if (expectedTime < 0) expectedTime = 0;
    
    var currentTime = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0;
    
    if (Math.abs(currentTime - expectedTime) > 2.5) {
      ytPlayer.seekTo(expectedTime, true);
    }
    
    if (ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
      ytPlayer.playVideo();
      
      // Проверка на автоплей (браузер может блокировать)
      setTimeout(function() {
        if (ytPlayer && ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
          if (!document.getElementById('unmute-prompt')) {
            var prompt = document.createElement('div');
            prompt.id = 'unmute-prompt';
            prompt.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:var(--accent);color:#1a1410;padding:15px 25px;border-radius:30px;font-weight:bold;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.6);font-family:Georgia, serif;animation:pulse 2s infinite;';
            prompt.innerHTML = '🔊 Нажмите, чтобы включить музыку';
            prompt.onclick = function() {
              ytPlayer.unMute();
              ytPlayer.setVolume(ui.playerVolume);
              ytPlayer.playVideo();
              prompt.remove();
            };
            document.body.appendChild(prompt);
          }
        } else {
          var p = document.getElementById('unmute-prompt');
          if (p) p.remove();
        }
      }, 1000);
    } else {
      var p = document.getElementById('unmute-prompt');
      if (p) p.remove();
    }
  } else if (p.status === 'paused') {
    if (ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
      ytPlayer.pauseVideo();
    }
    var currentTime = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0;
    if (Math.abs(currentTime - p.currentTimeAtPause) > 2.5) {
      ytPlayer.seekTo(p.currentTimeAtPause, true);
    }
    var p = document.getElementById('unmute-prompt');
    if (p) p.remove();
  }
}

// Раз в 5 секунд принудительно проверяем синхронизацию
setInterval(syncYoutubePlayer, 5000);


// Старт
session = loadSession();
initDB();
setInterval(tickMovement, 200);

setInterval(function() {
  if (!session) return;
  if (!state || !state.generation || !state.generation.enabled) return;
  tickGeneration(false);
}, 30000);