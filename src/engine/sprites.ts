import { hexToRgb, SKY_COLORS } from './palettes';
import { between, lerp, type Rng } from './random';

/**
 * Pre-rendered images. Drawing a cached glow with drawImage is far cheaper
 * than building a gradient per particle, which keeps mobile frame rates smooth.
 */

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

const towardsWhite = (hex: string, amount: number): string => {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c: number) => Math.round(lerp(c, 255, amount));
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
};

/** A star: small white-hot centre, saturated body, soft halo. */
export function sparkSprite(color: string, size = 64): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const h = size / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.05, towardsWhite(color, 0.4));
  g.addColorStop(0.14, rgba(color, 1));
  g.addColorStop(0.32, rgba(color, 0.3));
  g.addColorStop(0.62, rgba(color, 0.05));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** A soft glow with no hard centre, for blooms, sky light and floating lights. */
export function softSprite(color: string, size = 64): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const h = size / 2;
  const g = ctx.createRadialGradient(h, h, 0, h, h, h);
  g.addColorStop(0, rgba(color, 0.85));
  g.addColorStop(0.22, rgba(color, 0.45));
  g.addColorStop(0.55, rgba(color, 0.12));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

/** A soft, uneven cloud of smoke. */
export function smokeSprite(rng: Rng, size = 128): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const h = size / 2;
  for (let i = 0; i < 9; i++) {
    const x = h + between(rng, -0.22, 0.22) * size;
    const y = h + between(rng, -0.18, 0.18) * size;
    const r = size * between(rng, 0.2, 0.34);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(SKY_COLORS.smoke, 0.32));
    g.addColorStop(0.6, rgba(SKY_COLORS.smoke, 0.12));
    g.addColorStop(1, rgba(SKY_COLORS.smoke, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return canvas;
}

/** A fine four-point glint for the brightest stars. */
export function glintSprite(size = 96): HTMLCanvasElement {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const h = size / 2;
  const color = SKY_COLORS.starCool;
  const horizontal = ctx.createLinearGradient(0, h, size, h);
  horizontal.addColorStop(0, rgba(color, 0));
  horizontal.addColorStop(0.5, rgba(color, 0.9));
  horizontal.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = horizontal;
  ctx.fillRect(0, h - 0.6, size, 1.2);
  const vertical = ctx.createLinearGradient(h, 0, h, size);
  vertical.addColorStop(0, rgba(color, 0));
  vertical.addColorStop(0.5, rgba(color, 0.9));
  vertical.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = vertical;
  ctx.fillRect(h - 0.6, 0, 1.2, size);
  return canvas;
}

const gaussian = (rng: Rng): number => (rng() + rng() + rng() - 1.5) / 1.5;

export interface StarLayerOptions {
  count: number;
  minRadius: number;
  maxRadius: number;
  minAlpha: number;
  maxAlpha: number;
  /** Adds a faint diagonal band of denser stars and nebula haze. */
  milkyWay: boolean;
}

/**
 * Paints one layer of still stars. It tiles horizontally, so the renderer can
 * drift it slowly sideways forever.
 */
export function starLayer(
  width: number,
  height: number,
  scale: number,
  options: StarLayerOptions,
  rng: Rng,
): HTMLCanvasElement {
  const canvas = createCanvas(width * scale, height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(scale, scale);

  const bandAt = (t: number): [number, number] => [lerp(-0.05 * width, 1.05 * width, t), lerp(0.78 * height, 0.06 * height, t)];

  if (options.milkyWay) {
    const hazes = ['#6a4fc4', '#3f7fb8', '#8a4fa8'];
    for (let i = 0; i < 9; i++) {
      const [x, y] = bandAt(i / 8 + between(rng, -0.04, 0.04));
      const r = Math.max(width, height) * between(rng, 0.12, 0.22);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const color = hazes[i % hazes.length] ?? '#6a4fc4';
      g.addColorStop(0, rgba(color, 0.07));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  const colors = [SKY_COLORS.starCool, SKY_COLORS.starCool, SKY_COLORS.starCool, SKY_COLORS.starWarm, SKY_COLORS.starLilac];
  for (let i = 0; i < options.count; i++) {
    let x: number;
    let y: number;
    if (options.milkyWay && rng() < 0.38) {
      const [bx, by] = bandAt(rng());
      const spread = gaussian(rng) * height * 0.09;
      x = bx + spread * 0.6;
      y = by + spread;
    } else {
      x = rng() * width;
      y = rng() ** 1.15 * height;
    }
    const r = between(rng, options.minRadius, options.maxRadius);
    const nearHorizon = y > height * 0.82 ? 0.55 : 1;
    ctx.globalAlpha = between(rng, options.minAlpha, options.maxAlpha) * nearHorizon;
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)] ?? SKY_COLORS.starCool;
    const draw = (px: number) => {
      if (r < 0.7) {
        ctx.fillRect(px - r, y - r, r * 2, r * 2);
      } else {
        ctx.beginPath();
        ctx.arc(px, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    draw(x);
    // Wrap stars that straddle an edge so the tile seams are invisible.
    if (x < 3) draw(x + width);
    else if (x > width - 3) draw(x - width);
  }
  ctx.globalAlpha = 1;
  return canvas;
}
