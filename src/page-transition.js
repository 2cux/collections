// Share one transition between card destinations. New navigation supersedes
// an unfinished exit, and nested view cleanup runs within the same update.
export function createPageTransition(main) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let animation, pending;
  let revision = 0;
  let disposed = false;
  let updating = false;

  function cancel() {
    animation?.cancel();
    animation = undefined;
    main.inert = false;
  }

  function apply(update) {
    updating = true;
    try { update(); }
    finally { updating = false; }
  }

  async function run(update, { immediate = false, reverse = false } = {}) {
    if (disposed) return;
    if (updating) { update(); return; }
    const current = ++revision;
    cancel();
    pending = update;
    if (immediate || reduced.matches || !main.animate) {
      pending = undefined;
      apply(update);
      return;
    }

    main.inert = true;
    animation = main.animate([
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: `translateY(${reverse ? 8 : -8}px) scale(.99)` },
    ], { duration: 160, easing: 'ease-in', fill: 'forwards' });
    try {
      await animation.finished;
    } catch { return; }
    if (disposed || current !== revision) return;
    cancel();
    pending = undefined;
    apply(update);
    animation = main.animate([
      { opacity: 0, transform: `translateY(${reverse ? -12 : 16}px) scale(.99)` },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], { duration: 420, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' });
    try {
      await animation.finished;
      if (current === revision) cancel();
    } catch { /* Navigation or disposal can cancel the entrance. */ }
  }

  function onMotionChange() {
    if (!reduced.matches) return;
    ++revision;
    cancel();
    const update = pending;
    pending = undefined;
    if (update) apply(update);
  }
  reduced.addEventListener('change', onMotionChange);
  return {
    run,
    dispose() {
      disposed = true;
      ++revision;
      pending = undefined;
      cancel();
      reduced.removeEventListener('change', onMotionChange);
    },
  };
}
