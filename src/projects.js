// Add real entries as { cover, title, link }. Empty slots are never projects.
export const projects = [];
export const gallerySlots = count => projects.length ? projects.map(p => ({ ...p, placeholder: false })) : Array.from({ length: count }, () => ({ placeholder: true }));
