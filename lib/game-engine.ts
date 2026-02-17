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
  const rand = seededRandom(level * 7919 + 42);
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

  const baseShapeCount = 60 + level * 8;
  const shapeCount = Math.min(baseShapeCount, 120);

  for (let i = 0; i < shapeCount; i++) {
    const type = pickRandom<ShapeType>(['rect', 'circle', 'triangle', 'right-triangle', 'rect', 'circle', 'stripe'], rand);
    const color = pickRandom(colors, rand);

    let x: number, y: number, w: number, h: number;

    if (rand() < 0.3) {
      const col = Math.floor(rand() * GRID_COLS);
      const row = Math.floor(rand() * GRID_ROWS);
      x = col * cellW + rand() * cellW * 0.3;
      y = row * cellH + rand() * cellH * 0.3;
      w = cellW * (0.4 + rand() * 1.2);
      h = cellH * (0.4 + rand() * 1.2);
    } else {
      const col = Math.floor(rand() * GRID_COLS);
      const row = Math.floor(rand() * GRID_ROWS);
      x = col * cellW + rand() * cellW * 0.2;
      y = row * cellH + rand() * cellH * 0.2;
      w = cellW * (0.3 + rand() * 0.7);
      h = cellH * (0.3 + rand() * 0.7);
    }

    const shape: GameShape = {
      id: generateId() + '_' + i,
      type,
      x,
      y,
      width: w,
      height: h,
      color,
      rotation: type === 'triangle' ? rand() * 360 : (rand() < 0.3 ? rand() * 90 : 0),
    };

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
  }

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c].shapes.length < 3) {
        const extraCount = 3 + Math.floor(rand() * 3);
        for (let e = 0; e < extraCount; e++) {
          const type = pickRandom<ShapeType>(['rect', 'circle', 'triangle', 'right-triangle'], rand);
          const color = pickRandom(colors, rand);
          const cellX = c * cellW;
          const cellY = r * cellH;
          const shape: GameShape = {
            id: generateId() + '_fill_' + r + '_' + c + '_' + e,
            type,
            x: cellX + rand() * cellW * 0.6,
            y: cellY + rand() * cellH * 0.6,
            width: cellW * (0.2 + rand() * 0.5),
            height: cellH * (0.2 + rand() * 0.5),
            color,
            rotation: rand() * 360,
          };
          shapes.push(shape);
          grid[r][c].shapes.push(shape);
        }
      }
    }
  }

  let targetRow: number, targetCol: number;
  let bestCount = 0;
  targetRow = Math.floor(rand() * GRID_ROWS);
  targetCol = Math.floor(rand() * GRID_COLS);

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c].shapes.length > bestCount) {
        if (rand() < 0.5) {
          bestCount = grid[r][c].shapes.length;
          targetRow = r;
          targetCol = c;
        }
      }
    }
  }

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
