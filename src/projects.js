// Real entries may keep the small { cover, title, link } shape. The gallery
// normalizes every optional composition field before it creates a card.
export const projects = [];

export const CARD_DEFAULTS = Object.freeze({
  aspect: 1.6,
  fit: 'cover',
  focalX: 0.5,
  focalY: 0.5,
  size: 1,
  tiltX: 0,
  tiltY: 0,
  tiltZ: 0,
  radialOffset: 0,
  backgroundColor: '#11110f',
});

// Deliberately fixed: empty portfolios should still have a recognizable,
// repeatable rhythm after every refresh.
export const PLACEHOLDER_CONFIGS = Object.freeze([
  { ...CARD_DEFAULTS },
  { ...CARD_DEFAULTS },
  { ...CARD_DEFAULTS },
  { ...CARD_DEFAULTS },
  { ...CARD_DEFAULTS },
  { ...CARD_DEFAULTS },
]);

const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function safeColor(value) {
  if (typeof value !== 'string' || !value.trim()) return CARD_DEFAULTS.backgroundColor;
  const candidate = value.trim();
  // Keep the data layer independent from Three.js while rejecting values that
  // cannot be used as a CSS/shader color later.
  if (/^#[0-9a-f]{3,8}$/i.test(candidate) || /^(rgb|hsl)a?\(\s*[0-9.%\s,]+\)$/i.test(candidate)) {
    return candidate;
  }
  return CARD_DEFAULTS.backgroundColor;
}

export function normalizeProject(entry = {}, index = 0) {
  const source = entry && typeof entry === 'object' ? entry : {};
  const variant = source.placeholder ? PLACEHOLDER_CONFIGS[index % PLACEHOLDER_CONFIGS.length] : {};
  const composition = { ...CARD_DEFAULTS, ...variant, ...source };
  return {
    ...source,
    id: typeof source.id === 'string' && source.id.trim() ? source.id.trim() : `project-${index + 1}`,
    cover: typeof source.cover === 'string' ? source.cover.trim() : '',
    title: typeof source.title === 'string' && source.title.trim() ? source.title.trim() : `Project ${index + 1}`,
    link: typeof source.link === 'string' ? source.link.trim() : '',
    aspect: clamp(finiteOr(composition.aspect, CARD_DEFAULTS.aspect), 0.75, 1.9),
    fit: composition.fit === 'contain' ? 'contain' : CARD_DEFAULTS.fit,
    focalX: clamp(finiteOr(composition.focalX, CARD_DEFAULTS.focalX), 0, 1),
    focalY: clamp(finiteOr(composition.focalY, CARD_DEFAULTS.focalY), 0, 1),
    size: clamp(finiteOr(composition.size, CARD_DEFAULTS.size), 0.84, 1.1),
    tiltX: clamp(finiteOr(composition.tiltX, CARD_DEFAULTS.tiltX), -0.035, 0.035),
    tiltY: clamp(finiteOr(composition.tiltY, CARD_DEFAULTS.tiltY), -0.05, 0.05),
    tiltZ: clamp(finiteOr(composition.tiltZ, CARD_DEFAULTS.tiltZ), -0.045, 0.045),
    radialOffset: clamp(finiteOr(composition.radialOffset, CARD_DEFAULTS.radialOffset), -0.16, 0.16),
    backgroundColor: safeColor(composition.backgroundColor),
  };
}

export const gallerySlots = count => {
  const safeCount = Math.max(0, Math.floor(finiteOr(count, 0)));
  if (projects.length) {
    const slots = Array.from({ length: Math.max(safeCount, projects.length) }, (_, i) => ({
      ...normalizeProject(projects[i % projects.length], i % projects.length),
      placeholder: false,
    }));
    return applyRhythmGuard(slots);
  }
  return Array.from({ length: safeCount }, (_, i) => ({
    ...normalizeProject({ placeholder: true, study: i % 6 }, i),
    placeholder: true,
    study: i % 6,
  }));
};

// Preserve source order while keeping extreme source data from dominating the
// repeating spiral. This only reduces a problematic card's visual scale; it
// never reorders or invents projects.
function applyRhythmGuard(slots) {
  let portraitRun = 0;
  let largeRun = 0;
  return slots.map(slot => {
    const next = { ...slot };
    const isPortrait = next.aspect < 0.9;
    portraitRun = isPortrait ? portraitRun + 1 : 0;
    largeRun = next.size >= 1.02 ? largeRun + 1 : 0;

    if (isPortrait) next.size = Math.min(next.size, 0.94);
    if (portraitRun >= 3) next.size = Math.min(next.size, 0.86);
    if (largeRun >= 3) next.size = Math.min(next.size, 0.98);
    return next;
  });
}
