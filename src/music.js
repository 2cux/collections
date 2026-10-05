export function mountMusic() {
  const audio = document.querySelector('#background-music');
  const toggle = document.querySelector('#music-toggle');
  const label = document.querySelector('#music-label');
  const enterButton = document.querySelector('#enter-site');
  if (!audio || !toggle || !label || !enterButton) return () => {};

  let disposed = false;
  let wantsPlayback = false;
  audio.volume = 0.25;

  function sync() {
    const playing = !audio.paused;
    toggle.setAttribute('aria-pressed', String(playing));
    toggle.setAttribute('aria-label', playing ? '暂停背景音乐' : '播放背景音乐');
    label.textContent = playing ? '暂停音乐' : '播放音乐';
  }
  async function play() {
    wantsPlayback = true;
    try {
      await audio.play();
      if (disposed || !wantsPlayback || document.hidden) audio.pause();
    } catch {
      // Keep the control available if playback requires another user gesture.
      sync();
    }
  }
  function onToggle() {
    if (wantsPlayback) {
      wantsPlayback = false;
      audio.pause();
      sync();
    } else {
      void play();
    }
  }
  function onEnter() {
    if (!enterButton.disabled) void play();
  }
  function visibility() {
    if (document.hidden) audio.pause();
    else if (wantsPlayback) void play();
  }
  function onError() {
    wantsPlayback = false;
    audio.pause();
    sync();
    label.textContent = '重试音乐';
  }
  toggle.addEventListener('click', onToggle);
  enterButton.addEventListener('click', onEnter);
  audio.addEventListener('play', sync);
  audio.addEventListener('pause', sync);
  audio.addEventListener('error', onError);
  document.addEventListener('visibilitychange', visibility);
  sync();

  return () => {
    disposed = true;
    wantsPlayback = false;
    audio.pause();
    toggle.removeEventListener('click', onToggle);
    enterButton.removeEventListener('click', onEnter);
    audio.removeEventListener('play', sync);
    audio.removeEventListener('pause', sync);
    audio.removeEventListener('error', onError);
    document.removeEventListener('visibilitychange', visibility);
  };
}
