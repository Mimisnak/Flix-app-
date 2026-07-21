import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { storage } from './storage';

export const FONT_SCALE_PRESETS = {
  small: 0.9,
  normal: 1,
  large: 1.15,
  xlarge: 1.3,
} as const;

export type FontScaleKey = keyof typeof FONT_SCALE_PRESETS;

export const FONT_SCALE_LABELS: Record<FontScaleKey, string> = {
  small: 'Μικρά',
  normal: 'Κανονικά',
  large: 'Μεγάλα',
  xlarge: 'Πολύ Μεγάλα',
};

const STORAGE_KEY = 'flixfix_font_scale';

const FontScaleContext = createContext<{
  scaleKey: FontScaleKey;
  scale: number;
  setScaleKey: (key: FontScaleKey) => void;
}>({ scaleKey: 'normal', scale: 1, setScaleKey: () => {} });

// Global text-size preference — read by AppText (native, src/components/AppText.tsx)
// and by the web dashboard's own useFontScale() call sites. Persisted per-device
// so it survives app restarts; each app variant (dev/prod) has its own storage,
// so this never mixes across them.
export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [scaleKey, setScaleKeyState] = useState<FontScaleKey>('normal');

  useEffect(() => {
    storage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && saved in FONT_SCALE_PRESETS) setScaleKeyState(saved as FontScaleKey);
    });
  }, []);

  function setScaleKey(key: FontScaleKey) {
    setScaleKeyState(key);
    storage.setItem(STORAGE_KEY, key);
  }

  return (
    <FontScaleContext.Provider value={{ scaleKey, scale: FONT_SCALE_PRESETS[scaleKey], setScaleKey }}>
      {children}
    </FontScaleContext.Provider>
  );
}

export function useFontScale() {
  return useContext(FontScaleContext);
}
