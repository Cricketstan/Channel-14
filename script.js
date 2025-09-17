document.addEventListener('DOMContentLoaded', async () => {
  shaka.polyfill.installAll();

  if (!shaka.Player.isBrowserSupported()) {
    console.error('Browser not supported');
    return;
  }

  const video = document.querySelector('video');
  const player = new shaka.Player();
  await player.attach(video);

  const container = document.querySelector('.shaka-video-container');
  const ui = new shaka.ui.Overlay(player, container, video);

  ui.configure({
    controlPanelElements: [
      'play_pause', 'time_and_duration', 'mute', 'volume',
      'spacer', 'language', 'captions', 'picture_in_picture',
      'quality', 'fullscreen'
    ],
    volumeBarColors: {
      base: 'rgba(255, 192, 203, 0.3)',  // light pink
      level: 'rgb(255, 105, 180)'        // hot pink
    },
    seekBarColors: {
      base: 'rgba(255, 255, 0, 0.3)',    // yellow background
      buffered: 'rgba(255, 255, 0, 0.6)',// buffered yellow
      played: 'rgb(255, 255, 0)'         // bright yellow
    }
  });

  // DRM keys
  let drmConfig = {
    clearKeys: {
      "978bf56658595ff5a65b960a753beaab": "59af29130ecb16505dec2b00b84c817b"
    }
  };

  let cookieHeader =
    "__hdnea=st=1757961004~exp=1758047404~acl=/*~hmac=e7a81bb5134ab19d702f0b54aed8187615aba5d82b18788b1cac9e9048f3fddd";
  let streamUrl =
    "https://jiotvpllive.cdn.jio.com/bpk-tv/Asia_Cup_English_MOB/WDVLive/index.mpd";

  // Try fetching cookie from M3U
  try {
    const response = await fetch('https://raw.githubusercontent.com/alex8875/m3u/refs/heads/main/jstar.m3u');
    const m3uText = await response.text();
    const lines = m3uText.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Star_Sports_HD1')) {
        for (let j = i - 1; j >= 0; j--) {
          if (lines[j].startsWith('#EXTHTTP:')) {
            const cookieMatch = lines[j].match(/"cookie":"([^"]+)"/);
            if (cookieMatch) {
              cookieHeader = cookieMatch[1];
            }
            break;
          }
        }
        break;
      }
    }
  } catch (error) {
    console.error('Failed to fetch M3U:', error);
  }

  player.configure({
    drm: drmConfig,
    streaming: {
      lowLatencyMode: true,
      bufferingGoal: 15,
      rebufferingGoal: 2,
      bufferBehind: 15,
      retryParameters: {
        timeout: 10000,
        maxAttempts: 5,
        baseDelay: 300,
        backoffFactor: 1.2
      },
      segmentRequestTimeout: 8000,
      segmentPrefetchLimit: 2,
      useNativeHlsOnSafari: true
    },
    manifest: {
      retryParameters: {
        timeout: 8000,
        maxAttempts: 3
      }
    }
  });

  // Networking filters
  player.getNetworkingEngine().registerRequestFilter((type, request) => {
    request.headers['Referer'] = 'https://www.jiotv.com/';
    request.headers['User-Agent'] = "plaYtv/7.1.5 (Linux;Android 13) ExoPlayerLib/2.11.6";
    request.headers['Cookie'] = cookieHeader;

    if (
      (type === shaka.net.NetworkingEngine.RequestType.MANIFEST ||
       type === shaka.net.NetworkingEngine.RequestType.SEGMENT) &&
      request.uris[0] && !request.uris[0].includes('__hdnea=')
    ) {
      const separator = request.uris[0].includes('?') ? '&' : '?';
      request.uris[0] += separator + cookieHeader;
    }
  });

  // Autoplay helpers
  const enableAutoplay = () => {
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.autoplay = true;
  };

  const attemptAutoplay = async () => {
    try {
      video.muted = false;
      await video.play();
      console.log('Unmuted autoplay successful');
      return true;
    } catch (error) {
      console.log('Unmuted autoplay failed:', error.message);
      try {
        video.muted = true;
        await video.play();
        console.log('Muted autoplay successful');
        return true;
      } catch (mutedError) {
        console.log('Muted autoplay failed:', mutedError.message);
        return false;
      }
    }
  };

  player.addEventListener('error', (event) => {
    console.error('Shaka Player Error:', event.detail);
  });

  // Auto fullscreen on mobile
  video.addEventListener('play', () => {
    if (window.self === window.top && !document.fullscreenElement && window.innerWidth <= 768) {
      container.requestFullscreen().catch(() => {
        console.log('Fullscreen request failed');
      });
    }
  }, { once: true });

  // Default volume
  video.addEventListener('loadedmetadata', () => {
    video.volume = 0.8;
  });

  // Enable sound after user interaction
  let hasUserInteracted = false;
  const enableSoundOnInteraction = () => {
    if (!hasUserInteracted && video.muted) {
      video.muted = false;
      hasUserInteracted = true;
      console.log('Sound enabled after user interaction');
    }
  };
  ['click', 'touchstart', 'keydown'].forEach(event => {
    document.addEventListener(event, enableSoundOnInteraction, { once: true });
  });

  // Load player
  try {
    enableAutoplay();
    await player.load(streamUrl);
    if (video.readyState >= 3) {
      await attemptAutoplay();
    } else {
      video.addEventListener('canplay', attemptAutoplay, { once: true });
      setTimeout(async () => {
        if (video.paused) {
          await attemptAutoplay();
        }
      }, 2000);
    }
  } catch (error) {
    console.error('Load error:', error);
  }

  // Resume playback when tab is visible again
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && video.paused) {
      attemptAutoplay();
    }
  });
});
