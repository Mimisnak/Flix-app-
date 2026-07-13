import React from 'react';

// Native stub — WebApp only runs on web (WebApp.web.tsx).
// This file prevents Metro from bundling web-only code on native.
interface Props {
  role: 'owner' | 'shop' | 'driver' | 'developer';
}

export default function WebApp(_props: Props): React.ReactElement | null {
  return null;
}
