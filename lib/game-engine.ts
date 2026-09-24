import Colors from '@/constants/colors';

export type ShapeType = 'rect' | 'circle' | 'triangle' | 'right-triangle' | 'stripe';

export interface GameShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  rotation?: number;
  clipPath?: string;
}

export interface GridCell {
  row: number;
  col: number;
  shapes: GameShape[];
}

export interface GameLevel {
  shapes: GameShape[];
  grid: GridCell[][];
  targetRow: number;
  targetCol: number;
  goalRotation: number;
  level: number;
}

const GRID_ROWS = 6;
const GRID_COLS = 4;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

/**
 * Builds the board for one catalogue level. The same seed always produces the
 * same board (positions scale with the canvas size), so a levelId from the app
 * maps to exactly one puzzle.
 */
export function generateLevel(seed: number, canvasWidth: number, canvasHeight: number): GameLevel {
  const rand = seededRandom(seed);
  const level = seed;
  const cellW = canvasWidth / GRID_COLS;
  const cellH = canvasHeight / GRID_ROWS;
  const shapes: GameShape[] = [];
  const grid: GridCell[][] = [];
  const colors = Colors.gameColors;

  for (let r = 0; r < GRID_ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID_COLS; c++) {
      grid[r][c] = { row: r, col: c, shapes: [] };
    }
  }

  const addShape = (shape: GameShape) => {
    shapes.push(shape);
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cellX = c * cellW;
        const cellY = r * cellH;
        if (
          shape.x < cellX + cellW &&
          shape.x + shape.width > cellX &&
          shape.y < cellY + cellH &&
          shape.y + shape.height > cellY
        ) {
          grid[r][c].shapes.push(shape);
        }
      }
    }
  };

  let shapeIdx = 0;
  const makeId = (tag: string) => 's' + seed + '_' + tag + '_' + (shapeIdx++);
  const nonStripeTypes: ShapeType[] = ['rect', 'circle', 'triangle', 'right-triangle'];
  const pickType = (): ShapeType => {
    if (rand() < 0.2) return 'stripe';
    return pickRandom(nonStripeTypes, rand);
  };

  // Pass 1: one background rect per cell
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cx = c * cellW;
      const cy = r * cellH;
      addShape({
        id: makeId('bg'),
        type: 'rect',
        x: cx,
        y: cy,
        width: cellW,
        height: cellH,
        color: pickRandom(colors, rand),
      });
    }
  }

  // Pass 2: one main shape per cell, jittered within the cell for variety
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cx = c * cellW;
      const cy = r * cellH;
      const type = pickType();
      const color = pickRandom(colors, rand);
      const w = cellW * (0.5 + rand() * 0.35);
      const h = cellH * (0.5 + rand() * 0.35);
      const jitterX = (rand() - 0.5) * cellW * 0.4;
      const jitterY = (rand() - 0.5) * cellH * 0.4;
      const rawX = cx + (cellW - w) / 2 + jitterX;
      const rawY = cy + (cellH - h) / 2 + jitterY;
      addShape({
        id: makeId('cell'),
        type,
        x: Math.max(cx, Math.min(cx + cellW - w, rawX)),
        y: Math.max(cy, Math.min(cy + cellH - h, rawY)),
        width: w,
        height: h,
        color,
        rotation: type === 'triangle' ? rand() * 360 : (type === 'right-triangle' ? Math.floor(rand() * 4) * 90 : (rand() < 0.35 ? rand() * 180 : 0)),
      });
    }
  }

  // Pass 3: 12 cross-cell shapes for visual interest (24 bg + 24 cell + 12 cross = 60 total)
  const crossCount = 10 + Math.floor(rand() * 5);
  for (let i = 0; i < crossCount; i++) {
    const type = pickType();
    const color = pickRandom(colors, rand);
    const x = rand() * canvasWidth * 0.8;
    const y = rand() * canvasHeight * 0.8;
    const w = cellW * (0.8 + rand() * 1.2);
    const h = cellH * (0.8 + rand() * 1.0);
    addShape({
      id: makeId('cross'),
      type,
      x,
      y,
      width: w,
      height: h,
      color,
      rotation: type === 'triangle' ? rand() * 360 : (type === 'right-triangle' ? Math.floor(rand() * 4) * 90 : (rand() < 0.35 ? rand() * 180 : 0)),
    });
  }

  const targetRow = Math.floor(rand() * GRID_ROWS);
  const targetCol = Math.floor(rand() * GRID_COLS);

  const rotations = [0, 90, 180, 270];
  const goalRotation = pickRandom(rotations, rand);

  return {
    shapes,
    grid,
    targetRow,
    targetCol,
    goalRotation,
    level,
  };
}

export function getQuadrantBounds(
  row: number,
  col: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const cellW = canvasWidth / GRID_COLS;
  const cellH = canvasHeight / GRID_ROWS;
  return {
    x: col * cellW,
    y: row * cellH,
    width: cellW,
    height: cellH,
  };
}

export function getGridPosition(
  px: number,
  py: number,
  canvasWidth: number,
  canvasHeight: number
): { row: number; col: number } | null {
  const cellW = canvasWidth / GRID_COLS;
  const cellH = canvasHeight / GRID_ROWS;
  const col = Math.floor(px / cellW);
  const row = Math.floor(py / cellH);
  if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
    return { row, col };
  }
  return null;
}

export const GRID_DIMENSIONS = { rows: GRID_ROWS, cols: GRID_COLS };
