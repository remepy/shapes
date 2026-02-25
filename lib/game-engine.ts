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

      const cellShapes = 2 + Math.floor(rand() * 2);
      for (let s = 0; s < cellShapes; s++) {
        const type = pickType();
        const color = pickRandom(colors, rand);
        const overflow = 0.3;
        const x = cx - cellW * overflow * rand() + rand() * cellW * 0.4;
        const y = cy - cellH * overflow * rand() + rand() * cellH * 0.4;
        const w = cellW * (0.35 + rand() * 0.8);
        const h = cellH * (0.35 + rand() * 0.8);
        addShape({
          id: makeId('cell'),
          type,
          x,
          y,
          width: w,
          height: h,
          color,
          rotation: type === 'triangle' ? rand() * 360 : (type === 'right-triangle' ? Math.floor(rand() * 4) : (rand() < 0.3 ? rand() * 90 : 0)),
        });
      }
    }
  }

  const crossCount = 12 + Math.min(level * 2, 18);
  for (let i = 0; i < crossCount; i++) {
    const type = pickType();
    const color = pickRandom(colors, rand);
    const x = rand() * canvasWidth * 0.85;
    const y = rand() * canvasHeight * 0.85;
    const w = cellW * (0.5 + rand() * 1.5);
    const h = cellH * (0.5 + rand() * 1.2);
    addShape({
      id: makeId('cross'),
      type,
      x,
      y,
      width: w,
      height: h,
      color,
      rotation: type === 'triangle' ? rand() * 360 : (type === 'right-triangle' ? Math.floor(rand() * 4) : (rand() < 0.3 ? rand() * 90 : 0)),
    });
  }

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c].shapes.length < 3) {
        const extraCount = 3 - grid[r][c].shapes.length + Math.floor(rand() * 2);
        for (let e = 0; e < extraCount; e++) {
          const type = pickType();
          const color = pickRandom(colors, rand);
          const cx = c * cellW;
          const cy = r * cellH;
          addShape({
            id: makeId('fill'),
            type,
            x: cx + rand() * cellW * 0.5,
            y: cy + rand() * cellH * 0.5,
            width: cellW * (0.3 + rand() * 0.7),
            height: cellH * (0.3 + rand() * 0.7),
            color,
            rotation: type === 'right-triangle' ? Math.floor(rand() * 4) : rand() * 360,
          });
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
