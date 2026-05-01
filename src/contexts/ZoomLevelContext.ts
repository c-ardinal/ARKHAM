import { createContext } from 'react';

/**
 * Coarse rendering tier for nodes. The DOM/layout/text/icons stay identical
 * across all tiers — only CSS-level styling is gated, so the user never sees
 * elements appear or disappear as they zoom. The tiers reduce GPU/CPU work
 * progressively: 'low' drops shadow / transition / backdrop-filter; 'ultra-low'
 * additionally collapses text to ~1px so glyph rasterization is negligible
 * (the line-height is preserved so layout doesn't shift).
 */
export type ZoomLevel = 'ultra-low' | 'low' | 'high';

export const ZoomLevelContext = createContext<ZoomLevel>('high');

/** Below this zoom factor, nodes render in 'low' detail mode. */
export const LOW_ZOOM_THRESHOLD = 0.5;
/** Below this zoom factor, nodes additionally collapse text glyphs. */
export const ULTRA_LOW_ZOOM_THRESHOLD = 0.2;

export const resolveZoomLevel = (zoom: number): ZoomLevel => {
    if (zoom < ULTRA_LOW_ZOOM_THRESHOLD) return 'ultra-low';
    if (zoom < LOW_ZOOM_THRESHOLD) return 'low';
    return 'high';
};
