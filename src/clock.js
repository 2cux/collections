export function mountClock() {
  const time = document.querySelector('#clock-time');
  const hours = document.querySelector('#clock-hours');
  const minutes = document.querySelector('#clock-minutes');
  const seconds = document.querySelector('#clock-seconds');
  const date = document.querySelector('#clock-date');
  const zone = document.querySelector('#clock-zone');
  const dateFormat = new Intl.DateTimeFormat('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long',
  });
  let timer;
  let disposed = false;
  const pad = value => String(value).padStart(2, '0');

  function update() {
    const now = new Date();
    hours.textContent = pad(now.getHours());
    minutes.textContent = pad(now.getMinutes());
    seconds.textContent = pad(now.getSeconds());
    time.dateTime = now.toISOString();
    time.setAttribute('aria-label', `本地时间 ${hours.textContent}:${minutes.textContent}:${seconds.textContent}`);
    date.textContent = dateFormat.formatToParts(now).map(part =>
      part.type === 'weekday' ? ` · ${part.value}` : part.value
    ).join('');
    const offset = -now.getTimezoneOffset();
    zone.textContent = `UTC${offset >= 0 ? '+' : '−'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
    // Re-read the device clock each tick, including after sleep or a time change.
    if (!disposed && !document.hidden) timer = window.setTimeout(update, 1000 - Date.now() % 1000);
  }
  function resume() {
    window.clearTimeout(timer);
    if (!document.hidden) update();
  }
  update();
  document.addEventListener('visibilitychange', resume);
  return () => {
    disposed = true;
    window.clearTimeout(timer);
    document.removeEventListener('visibilitychange', resume);
  };
}
