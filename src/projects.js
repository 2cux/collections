// Add real entries as { cover, title, link }. Empty slots are never projects.
export const projects = [];
export const gallerySlots = count => projects.length ? Array.from({ length: Math.max(count, projects.length) }, (_, i) => ({ ...projects[i % projects.length], placeholder: false })) : Array.from({ length: count }, (_, i) => ({ placeholder: true, study: i % 6 }));
