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
      'playsinline': 1
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
  
  if (p.status === 'stopped' || (!p.videoId && !p.playlistId)) {
    if (typeof ytPlayer.stopVideo === 'function' && ytPlayer.getPlayerState() !== YT.PlayerState.UNSTARTED) {
       ytPlayer.stopVideo();
       currentTrackLoaded = '';
    }
    return;
  }

  var trackId = p.videoId || p.playlistId;

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

  if (p.status === 'playing') {
    var expectedTime = (Date.now() - p.startedAt) / 1000;
    if (expectedTime < 0) expectedTime = 0;
    
    var currentTime = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0;
    
    if (Math.abs(currentTime - expectedTime) > 2.5) {
      ytPlayer.seekTo(expectedTime, true);
    }
    
    if (ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) {
      ytPlayer.playVideo();
    }
  } else if (p.status === 'paused') {
    if (ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) {
      ytPlayer.pauseVideo();
    }
    var currentTime = ytPlayer.getCurrentTime ? ytPlayer.getCurrentTime() : 0;
    if (Math.abs(currentTime - p.currentTimeAtPause) > 2.5) {
      ytPlayer.seekTo(p.currentTimeAtPause, true);
    }
  }
}

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