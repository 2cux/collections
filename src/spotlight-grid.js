const OFFSCREEN_POSITION = -1000;

/** Adds a softly interpolated cursor spotlight to the gallery's passive grid. */
export function mountSpotlightGrid({ host, layer }) {
  if (!host || !layer) return () => {};

  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let currentX = OFFSCREEN_POSITION;
  let currentY = OFFSCREEN_POSITION;
  let targetX = OFFSCREEN_POSITION;
  let targetY = OFFSCREEN_POSITION;
  let frame = 0;
  let disposed = false;
  let hostRect = host.getBoundingClientRect();

  const render = () => {
    frame = 0;
    if (disposed) return;
    const easing = reducedMotion.matches ? 1 : 0.14;
    currentX += (targetX - currentX) * easing;
    currentY += (targetY - currentY) * easing;
    layer.style.setProperty('--spotlight-x', `${currentX}px`);
    layer.style.setProperty('--spotlight-y', `${currentY}px`);
    if (Math.abs(targetX - currentX) > 0.25 || Math.abs(targetY - currentY) > 0.25) {
      frame = requestAnimationFrame(render);
    }
  };
  const schedule = () => { if (!frame && !disposed) frame = requestAnimationFrame(render); };
  const move = event => {
    if (!finePointer.matches) return;
    targetX = event.clientX - hostRect.left;
    targetY = event.clientY - hostRect.top;
    layer.classList.add('is-spotlight-active');
    schedule();
  };
  const enter = event => {
    // A pointer move can fire dozens of times per frame. The host rect only
    // needs refreshing when the pointer enters or the observed box changes.
    hostRect = host.getBoundingClientRect();
    move(event);
  };
  const leave = () => {
    targetX = OFFSCREEN_POSITION;
    targetY = OFFSCREEN_POSITION;
    layer.classList.remove('is-spotlight-active');
    schedule();
  };
  const pointerChanged = () => { if (!finePointer.matches) leave(); };
  const resizeObserver = new ResizeObserver(() => { hostRect = host.getBoundingClientRect(); });

  host.addEventListener('pointerenter', enter, { passive: true });
  host.addEventListener('pointermove', move, { passive: true });
  host.addEventListener('pointerleave', leave);
  finePointer.addEventListener?.('change', pointerChanged);
  reducedMotion.addEventListener?.('change', schedule);
  resizeObserver.observe(host);
  render();

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    host.removeEventListener('pointerenter', enter);
    host.removeEventListener('pointermove', move);
    host.removeEventListener('pointerleave', leave);
    finePointer.removeEventListener?.('change', pointerChanged);
    reducedMotion.removeEventListener?.('change', schedule);
  };
}
