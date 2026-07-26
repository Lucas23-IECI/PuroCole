const cleanValue = (value, fallback = '') => String(value || '').trim() || fallback;

const normalizeHexColor = (value, fallback) => {
  const candidate = cleanValue(value).replace(/^#/, '');
  return /^[0-9a-f]{6}$/i.test(candidate) ? `#${candidate}` : fallback;
};

// En desarrollo: http://localhost:5000/api
// En producción (Docker): /api → nginx lo proxea al backend.
export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

export const PRODUCT_CONFIG = Object.freeze({
  name: 'PuroCole',
  descriptor: 'Operaciones escolares',
  tagline: 'Una credencial, una historia operacional.',
});

export const INSTITUTION_CONFIG = Object.freeze({
  name: cleanValue(import.meta.env.VITE_INSTITUTION_NAME, 'Establecimiento educativo'),
  shortName: cleanValue(import.meta.env.VITE_INSTITUTION_SHORT_NAME),
  rbd: cleanValue(import.meta.env.VITE_INSTITUTION_RBD),
  location: cleanValue(import.meta.env.VITE_INSTITUTION_LOCATION),
  logoUrl: cleanValue(import.meta.env.VITE_INSTITUTION_LOGO_URL, '/brand/purocole-mark.svg'),
});

export const getInstitutionMeta = () => [
  INSTITUTION_CONFIG.location,
  INSTITUTION_CONFIG.rbd ? `RBD ${INSTITUTION_CONFIG.rbd}` : '',
].filter(Boolean).join(' · ');

export const applyBrandTheme = () => {
  const root = document.documentElement;
  root.style.setProperty(
    '--brand-primary',
    normalizeHexColor(import.meta.env.VITE_BRAND_PRIMARY, '#28618c')
  );
  root.style.setProperty(
    '--brand-accent',
    normalizeHexColor(import.meta.env.VITE_BRAND_ACCENT, '#d8a447')
  );
};
