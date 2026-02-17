import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect, Circle, Polygon, G, Defs, ClipPath } from 'react-native-svg';
import { GameShape, GameLevel, GRID_DIMENSIONS, getQuadrantBounds } from '@/lib/game-engine';
import Colors from '@/constants/colors';

interface GameBoardProps {
  level: GameLevel;
  canvasWidth: number;
  canvasHeight: number;
  highlightCell?: { row: number; col: number } | null;
  showTarget?: boolean;
}

function RenderShape({ shape, clipX, clipY, clipW, clipH }: {
  shape: GameShape;
  clipX?: number;
  clipY?: number;
  clipW?: number;
  clipH?: number;
}) {
  const offsetX = clipX ?? 0;
  const offsetY = clipY ?? 0;

  switch (shape.type) {
    case 'rect':
    case 'stripe': {
      if (shape.type === 'stripe') {
        const stripeCount = 3 + Math.floor(shape.width / 20);
        const stripeW = shape.width / (stripeCount * 2);
        const stripes = [];
        for (let i = 0; i < stripeCount; i++) {
          stripes.push(
            <Rect
              key={`${shape.id}_stripe_${i}`}
              x={shape.x - offsetX + i * stripeW * 2}
              y={shape.y - offsetY}
              width={stripeW}
              height={shape.height}
              fill={shape.color}
            />
          );
        }
        const bgColor = shape.color === '#FFFFFF' ? '#000000' : '#FFFFFF';
        return (
          <G>
            <Rect
              x={shape.x - offsetX}
              y={shape.y - offsetY}
              width={shape.width}
              height={shape.height}
              fill={bgColor}
            />
            {stripes}
          </G>
        );
      }
      return (
        <Rect
          x={shape.x - offsetX}
          y={shape.y - offsetY}
          width={shape.width}
          height={shape.height}
          fill={shape.color}
        />
      );
    }
    case 'circle': {
      const cx = shape.x - offsetX + shape.width / 2;
      const cy = shape.y - offsetY + shape.height / 2;
      const r = Math.min(shape.width, shape.height) / 2;
      return (
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          fill={shape.color}
        />
      );
    }
    case 'triangle': {
      const x1 = shape.x - offsetX + shape.width / 2;
      const y1 = shape.y - offsetY;
      const x2 = shape.x - offsetX;
      const y2 = shape.y - offsetY + shape.height;
      const x3 = shape.x - offsetX + shape.width;
      const y3 = shape.y - offsetY + shape.height;
      return (
        <Polygon
          points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`}
          fill={shape.color}
        />
      );
    }
    case 'right-triangle': {
      const corner = (shape.rotation ?? 0) % 4;
      const sx = shape.x - offsetX;
      const sy = shape.y - offsetY;
      const sw = shape.width;
      const sh = shape.height;
      let pts: string;
      switch (corner) {
        case 1:
          pts = `${sx + sw},${sy} ${sx + sw},${sy + sh} ${sx},${sy + sh}`;
          break;
        case 2:
          pts = `${sx + sw},${sy + sh} ${sx},${sy + sh} ${sx},${sy}`;
          break;
        case 3:
          pts = `${sx},${sy + sh} ${sx},${sy} ${sx + sw},${sy}`;
          break;
        default:
          pts = `${sx},${sy} ${sx + sw},${sy} ${sx},${sy + sh}`;
          break;
      }
      return (
        <Polygon
          points={pts}
          fill={shape.color}
        />
      );
    }
    default:
      return null;
  }
}

export function GameBoard({ level, canvasWidth, canvasHeight, highlightCell, showTarget }: GameBoardProps) {
  const cellW = canvasWidth / GRID_DIMENSIONS.cols;
  const cellH = canvasHeight / GRID_DIMENSIONS.rows;

  const gridLines = useMemo(() => {
    const lines = [];
    for (let r = 0; r <= GRID_DIMENSIONS.rows; r++) {
      lines.push(
        <Rect
          key={`hline_${r}`}
          x={0}
          y={r * cellH - 0.5}
          width={canvasWidth}
          height={1}
          fill="rgba(255,255,255,0.05)"
        />
      );
    }
    for (let c = 0; c <= GRID_DIMENSIONS.cols; c++) {
      lines.push(
        <Rect
          key={`vline_${c}`}
          x={c * cellW - 0.5}
          y={0}
          width={1}
          height={canvasHeight}
          fill="rgba(255,255,255,0.05)"
        />
      );
    }
    return lines;
  }, [cellW, cellH, canvasWidth, canvasHeight]);

  return (
    <View style={[styles.container, { width: canvasWidth, height: canvasHeight }]}>
      <Svg width={canvasWidth} height={canvasHeight} viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}>
        <Rect x={0} y={0} width={canvasWidth} height={canvasHeight} fill="#000000" />

        {level.shapes.map((shape) => (
          <RenderShape key={shape.id} shape={shape} />
        ))}

        {gridLines}

        {highlightCell && (
          <Rect
            x={highlightCell.col * cellW}
            y={highlightCell.row * cellH}
            width={cellW}
            height={cellH}
            fill="rgba(255,255,255,0.15)"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth={2}
          />
        )}

        {showTarget && (
          <Rect
            x={level.targetCol * cellW}
            y={level.targetRow * cellH}
            width={cellW}
            height={cellH}
            fill="none"
            stroke={Colors.accentGreen}
            strokeWidth={3}
            strokeDasharray="8,4"
          />
        )}
      </Svg>
    </View>
  );
}

export function GoalTile({ level, canvasWidth, canvasHeight, tileSize, rotationOverride, showColor }: {
  level: GameLevel;
  canvasWidth: number;
  canvasHeight: number;
  tileSize: number;
  rotationOverride?: number;
  showColor?: boolean;
}) {
  const bounds = getQuadrantBounds(level.targetRow, level.targetCol, canvasWidth, canvasHeight);
  const scale = tileSize / Math.max(bounds.width, bounds.height);

  const relevantShapes = level.shapes.filter(s => {
    return (
      s.x < bounds.x + bounds.width &&
      s.x + s.width > bounds.x &&
      s.y < bounds.y + bounds.height &&
      s.y + s.height > bounds.y
    );
  });

  const svgSize = tileSize;
  const rotation = rotationOverride ?? level.goalRotation;

  return (
    <View style={[styles.goalTile, { width: svgSize, height: svgSize }]}>
      <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <Defs>
          <ClipPath id="goalClip">
            <Rect x={0} y={0} width={svgSize} height={svgSize} />
          </ClipPath>
        </Defs>
        <Rect x={0} y={0} width={svgSize} height={svgSize} fill="#2A2A2A" />
        <G
          clipPath="url(#goalClip)"
          transform={`rotate(${rotation}, ${svgSize / 2}, ${svgSize / 2})`}
          opacity={0.85}
        >
          <Rect x={0} y={0} width={svgSize} height={svgSize} fill="#1A1A1A" />
          <G transform={`scale(${scale})`}>
            {relevantShapes.map((shape) => {
              const displayShape = showColor ? shape : { ...shape, color: colorToGrey(shape.color) };
              return (
                <RenderShape
                  key={shape.id + '_goal'}
                  shape={displayShape}
                  clipX={bounds.x}
                  clipY={bounds.y}
                />
              );
            })}
          </G>
        </G>
      </Svg>
    </View>
  );
}

function colorToGrey(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16) || 0;
  const g = parseInt(hex.substr(2, 2), 16) || 0;
  const b = parseInt(hex.substr(4, 2), 16) || 0;
  const grey = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const greyHex = grey.toString(16).padStart(2, '0');
  return `#${greyHex}${greyHex}${greyHex}`;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  goalTile: {
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
