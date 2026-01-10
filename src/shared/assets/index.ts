// =============================================================================
// Assets Export Index
// =============================================================================
// This file provides a centralized way to import all static assets.
// SVG icons can be imported as React components using vite-plugin-svgr,
// or as URLs for use in img tags.
// =============================================================================

// Icon paths for use with img tags
export const iconPaths = {
  upload: new URL("./icons/upload.svg", import.meta.url).href,
  download: new URL("./icons/download.svg", import.meta.url).href,
  plus: new URL("./icons/plus.svg", import.meta.url).href,
  minus: new URL("./icons/minus.svg", import.meta.url).href,
  settings: new URL("./icons/settings.svg", import.meta.url).href,
  close: new URL("./icons/close.svg", import.meta.url).href,
} as const;

// For SVG React components (requires vite-plugin-svgr):
// import { ReactComponent as UploadIcon } from './icons/upload.svg?react';
// export { UploadIcon };
