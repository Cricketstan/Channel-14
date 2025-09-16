document.addEventListener('DOMContentLoaded', async () => {
  shaka.polyfill.installAll();
  if (!shaka.Player.isBrowserSupported()) return;

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
      base: 'rgba(128,128,128,0.6)',
      level: 'rgba(169,169,169,1)'
    },
    seekBarColors: {
      base: 'rgba(169,169,169,0.3)',
      buffered: 'rgba(255, 255, 0, 0.4)',
      played: 'yellow'
    }
  });

  const drmConfig = {
    clearKeys: {
      "965dc2ddb1d85138ad787999a7f30ca5": "859695076e67fe961836b564db6d689c"
    }
  };

  const data = [
    {
      "channel_name": "Asia Cup English",
      "channel_url": "https://jiotvmblive.cdn.jio.com/bpk-tv/Asia_Cup_English_MOB/WDVLive/index.mpd",
      "cookie": "__hdnea__=st=1758004202~exp=1758090602~acl=/*~hmac=79233308f5f09e55bba254ecbddae305178cdd5b847ff61f51a0f141c68979a6"
    }
  ];

  const channel = data[0];
  const streamUrl = channel.channel_url;
  const cookieHeader = channel.cookie;

  player.configure({
    drm: drmConfig,
    streaming: {
      lowLatencyMode: true,
      bufferingGoal: 15,
      rebufferingGoal: 2,
      bufferBehind: 15,
      retryParameters: { timeout: 10000, maxAttempts: 5, baseDelay: 300, backoffFactor: 1.2 },
      segmentRequestTimeout: 8000,
      segmentPrefetchLimit: 2,
      useNativeHlsOnSafari: true
    },
    manifest: { retryParameters: { timeout: 8000, maxAttempts: 3 } }
  });

  player.getNetworkingEngine().registerRequestFilter((type, request) => {
    request.headers['Referer'] = 'https://www.jiotv.com/';
    request.headers['User-Agent'] = "plaYtv/7.1.7 (Linux;Android 13) ExoPlayerLib/2.11.7";
    request.headers['Cookie'] = cookieHeader;

    if ((type === shaka.net.NetworkingEngine.RequestType.MANIFEST ||
         type === shaka.net.NetworkingEngine.RequestType.SEGMENT) &&
         request.uris[0] && !request.uris[0].includes('__hdnea=')) {
      const separator = request.uris[0].includes('?') ? '&' : '?';
      request.uris[0] += separator + cookieHeader;
    }
  });

  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', '');
  video.volume = 0.8;

  const attemptAutoplay = async () => {
    try { 
      video.muted = false; 
      await video.play(); 
    } catch { 
      video.muted = true; 
      await video.play().catch(() => {}); 
    }
  };

  try { 
    await player.load(streamUrl); 
    await attemptAutoplay(); 
  } catch (error) { 
    console.error('Load error:', error); 
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && video.paused) attemptAutoplay();
  });
});
