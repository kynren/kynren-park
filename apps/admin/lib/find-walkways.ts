'use client';

import { detectPaths, unpackGrid, type WalkGrid } from '@kynren/shared';

/** About how wide the picture is made before the walkways are looked for: enough to follow a footpath, quick enough to run in the browser. */
const WORKING_WIDTH = 1024;

export interface WalkwayFinding {
  grid: WalkGrid;
  /** How many cells of the grid came out walkable; none means nothing path-like was found. */
  cells: number;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    if (/^https?:/i.test(url)) img.crossOrigin = 'anonymous'; // a hosted map must allow reading its pixels
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The map image could not be loaded.'));
    img.src = url;
  });
}

/**
 * Finds the walkways on a map picture. [places] are where the park's places sit on the picture (fractions across and
 * down): the colours under them are what the paths look like. [tolerance] is how far from those colours still counts.
 */
export async function findWalkways(imageUrl: string, places: [number, number][], tolerance = 20): Promise<WalkwayFinding> {
  const img = await loadImage(imageUrl);
  const w = Math.min(WORKING_WIDTH, img.naturalWidth);
  const h = Math.round((w * img.naturalHeight) / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('This browser cannot read the map picture.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    throw new Error('The map image does not allow its pixels to be read. Upload the picture instead of linking to it.');
  }
  // yield once so the "finding walkways" message is on screen before the heavy work starts
  await new Promise((r) => setTimeout(r, 30));
  const { grid } = detectPaths({ width: w, height: h, data: data.data }, { points: places, tolerance });
  const cells = unpackGrid(grid).reduce((n, v) => n + v, 0);
  return { grid, cells };
}

/** A see-through picture of the walkable cells, to lay over the map in the editor. */
export function walkGridPreview(grid: WalkGrid): string | null {
  const cells = unpackGrid(grid);
  const canvas = document.createElement('canvas');
  canvas.width = grid.w;
  canvas.height = grid.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const px = ctx.createImageData(grid.w, grid.h);
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) continue;
    px.data[i * 4] = 255;
    px.data[i * 4 + 1] = 45;
    px.data[i * 4 + 2] = 85;
    px.data[i * 4 + 3] = 140;
  }
  ctx.putImageData(px, 0, 0);
  return canvas.toDataURL('image/png');
}
