import { useEffect, useState } from 'react';

const BREAKPOINT = 768;

function getIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < BREAKPOINT;
}

// The web dashboard's Sidebar+TopBar layout was built desktop-only. Now that
// the same build is a public website, narrow (phone) viewports need a
// completely different chrome — a bottom tab bar like the native app,
// instead of squeezing a 240px fixed sidebar into a 380px screen.
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    function handleResize() {
      setIsMobile(getIsMobile());
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}
