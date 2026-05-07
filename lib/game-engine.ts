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

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export function generateLevel(level: number, canvasWidth: number, canvasHeight: number): GameLevel {
  const rand = seededRandom(Math.floor(Math.random() * 2147483646) + 1);
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
  const makeId = (tag: string) => generateId() + '_' + tag + '_' + (shapeIdx++);
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

  // Pass 2: two shapes per cell — one large main, one smaller accent
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cx = c * cellW;
      const cy = r * cellH;

      // Main shape: 50–85% of cell size, centered with gentle jitter
      const type1 = pickType();
      const color1 = pickRandom(colors, rand);
      const w1 = cellW * (0.5 + rand() * 0.35);
      const h1 = cellH * (0.5 + rand() * 0.35);
      const jx1 = (rand() - 0.5) * cellW * 0.4;
      const jy1 = (rand() - 0.5) * cellH * 0.4;
      addShape({
        id: makeId('cell'),
        type: type1,
        x: cx + (cellW - w1) / 2 + jx1,
        y: cy + (cellH - h1) / 2 + jy1,
        width: w1,
        height: h1,
        color: color1,
        rotation: type1 === 'triangle' ? rand() * 360 : (type1 === 'right-triangle' ? Math.floor(rand() * 4) * 90 : (rand() < 0.35 ? rand() * 180 : 0)),
      });

      // Accent shape: 25–45% of cell size, placed in a random corner quadrant
      const type2 = pickType();
      const color2 = pickRandom(colors, rand);
      const w2 = cellW * (0.25 + rand() * 0.2);
      const h2 = cellH * (0.25 + rand() * 0.2);
      const quadX = rand() < 0.5 ? 0 : cellW - w2;
      const quadY = rand() < 0.5 ? 0 : cellH - h2;
      addShape({
        id: makeId('accent'),
        type: type2,
        x: cx + quadX + (rand() - 0.5) * cellW * 0.15,
        y: cy + quadY + (rand() - 0.5) * cellH * 0.15,
        width: w2,
        height: h2,
        color: color2,
        rotation: type2 === 'triangle' ? rand() * 360 : (type2 === 'right-triangle' ? Math.floor(rand() * 4) * 90 : (rand() < 0.35 ? rand() * 180 : 0)),
      });
    }
  }

  // Pass 3: cross-cell accent shapes for visual interest
  const crossCount = 22 + Math.floor(rand() * 7);
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
