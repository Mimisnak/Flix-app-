// Greek + Latin letters, spaces and hyphens only — blocks emoji, digits,
// and other symbols in the name field on registration/profile edit.
const NAME_CHARS_RE = /^[A-Za-zΑ-Ωα-ωΆΈΉΊΌΎΏάέήίόύώΪΫϊϋΐΰ\s-]+$/;

// Returns an error message if invalid, or null if the name is OK.
// Drivers must give a first + last name (each ≥2 letters); shop names can
// be a single word as long as it's ≥3 characters.
export function validateName(name: string, role: 'shop' | 'driver'): string | null {
  const trimmed = name.trim().replace(/\s+/g, ' ');

  if (!trimmed) return 'Το όνομα είναι υποχρεωτικό.';
  if (!NAME_CHARS_RE.test(trimmed)) return 'Το όνομα πρέπει να περιέχει μόνο γράμματα.';
  if (trimmed.length < 3) return 'Το όνομα πρέπει να έχει τουλάχιστον 3 χαρακτήρες.';

  if (role === 'driver') {
    const words = trimmed.split(' ').filter(Boolean);
    if (words.length < 2 || words.some(w => w.length < 2)) {
      return 'Γράψε ονοματεπώνυμο (όνομα και επίθετο).';
    }
  }

  return null;
}
