export function mountLikes() {
  const button = document.querySelector('#like-button');
  const count = document.querySelector('#like-count');
  const status = document.querySelector('#like-status');
  const controller = new AbortController();
  let total = 0, pending = 0, busy = false, disposed = false, stream;
  let connecting = false, retryTimer, retryDelay = 2000;
  function render(state) {
    total = state.count;
    button.setAttribute('aria-label', `为主页点赞，共 ${total + pending} 个赞`);
    count.textContent = new Intl.NumberFormat('en').format(total + pending);
  }
  async function request(options) {
    const response = await fetch('/api/likes', { ...options, signal: controller.signal });
    if (!response.ok) throw new Error('Likes unavailable');
    return response.json();
  }
  async function click() {
    pending += 1;
    render({ count: total });
    button.classList.remove('is-celebrating');
    void button.offsetWidth;
    button.classList.add('is-celebrating');
    if (busy) return;
    busy = true;
    // Queue rapid clicks so each click contributes one increment.
    while (pending > 0 && !disposed) {
      try {
        const state = await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        pending -= 1;
        if (!disposed) {
          render(state);
          button.classList.add('has-liked');
          status.textContent = '谢谢你的喜欢';
        }
      } catch {
        pending -= 1;
        if (!disposed) { render({ count: total }); status.textContent = '暂时无法同步，请重试'; }
      }
    }
    busy = false;
  }
  function move(event) {
    if (event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = button.getBoundingClientRect();
    button.style.setProperty('--magnet-x', `${(event.clientX - rect.left - rect.width / 2) * .12}px`);
    button.style.setProperty('--magnet-y', `${(event.clientY - rect.top - rect.height / 2) * .16}px`);
  }
  function reset() { button.style.setProperty('--magnet-x', '0px'); button.style.setProperty('--magnet-y', '0px'); }
  async function connect() {
    if (disposed || connecting) return;
    connecting = true;
    window.clearTimeout(retryTimer);
    try {
      const state = await request();
      if (disposed) return;
      render(state); button.disabled = false;
      retryDelay = 2000;
      stream?.close();
      stream = new EventSource('/api/likes/events');
      stream.onmessage = event => { if (!busy) render(JSON.parse(event.data)); status.textContent = '实时同步'; };
      stream.onerror = () => { status.textContent = '正在重新连接'; };
    } catch {
      if (!disposed) {
        status.textContent = '暂时无法连接，正在重试';
        button.disabled = false;
        retryTimer = window.setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      }
    } finally { connecting = false; }
  }
  function retry(event) {
    if (count.textContent === '—') { event.stopImmediatePropagation(); button.disabled = true; connect(); }
  }
  button.addEventListener('click', retry, true);
  button.addEventListener('click', click);
  button.addEventListener('pointermove', move);
  button.addEventListener('pointerleave', reset);
  connect();
  return () => {
    disposed = true; controller.abort(); stream?.close();
    window.clearTimeout(retryTimer);
    button.removeEventListener('click', click);
    button.removeEventListener('click', retry, true);
    button.removeEventListener('pointermove', move);
    button.removeEventListener('pointerleave', reset);
  };
}
