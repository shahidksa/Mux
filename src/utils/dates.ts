/** Returns today's date as a local-time YYYY-MM-DD string (avoids UTC offset bugs). */
export const toLocalDateString = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Parses a YYYY-MM-DD or MM/DD/YYYY string into a local-time Date (not UTC). */
export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr || typeof dateStr !== 'string') return new Date(NaN);
  
  const trimmed = dateStr.trim();
  
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/').map(Number);
    if (parts.length >= 3 && !parts.some(isNaN)) {
      const [m, d, y] = parts;
      return new Date(y, m - 1, d);
    }
  }
  
  const parts = trimmed.split('-').map(Number);
  if (parts.length >= 3 && !parts.some(isNaN)) {
    const [y, m, d] = parts;
    return new Date(y, m - 1, d);
  }
  
  return new Date(NaN);
};
