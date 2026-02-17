import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  Platform,
  Pressable,
  I18nManager,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GameBoard, GoalTile } from '@/components/GameBoard';
import { generateLevel, getGridPosition, GRID_DIMENSIONS, GameLevel } from '@/lib/game-engine';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const WEB_TOP_INSET = Platform.OS === 'web' ? 67 : 0;
const WEB_BOTTOM_INSET = Platform.OS === 'web' ? 34 : 0;

const CANVAS_PADDING = 16;
const CANVAS_WIDTH = SCREEN_WIDTH - CANVAS_PADDING * 2;
const CANVAS_ASPECT = 6 / 4;
const CANVAS_HEIGHT = CANVAS_WIDTH * CANVAS_ASPECT;

const TILE_SIZE = Math.min(CANVAS_WIDTH / GRID_DIMENSIONS.cols, 90);

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? WEB_TOP_INSET : insets.top;
  const bottomInset = Platform.OS === 'web' ? WEB_BOTTOM_INSET : insets.bottom;

  const [currentLevel, setCurrentLevel] = useState(1);
  const [gameLevel, setGameLevel] = useState<GameLevel>(() =>
    generateLevel(1, CANVAS_WIDTH, CANVAS_HEIGHT)
  );
  const [highlightCell, setHighlightCell] = useState<{ row: number; col: number } | null>(null);
  const [solved, setSolved] = useState(false);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [userRotation, setUserRotation] = useState(0);
  

  const boardRef = useRef<View>(null);
  const tileContainerRef = useRef<View>(null);
  const boardLayoutRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const userRotationRef = useRef(0);
  const gameLevelRef = useRef(gameLevel);
  gameLevelRef.current = gameLevel;
  const solvedRef = useRef(false);
  solvedRef.current = solved;

  const tileX = useSharedValue(0);
  const tileY = useSharedValue(0);
  const tileScale = useSharedValue(1);
  const tileDragging = useSharedValue(0);
  const boardScale = useSharedValue(1);
  const victoryOpacity = useSharedValue(0);
  const highlightScale = useSharedValue(1);
  const shakeX = useSharedValue(0);

  const tileOriginalPos = useRef({ x: 0, y: 0 });

  const measureView = useCallback((ref: React.RefObject<View | null>, callback: (x: number, y: number, w: number, h: number) => void) => {
    if (!ref.current) return;
    if (Platform.OS === 'web') {
      try {
        const node = ref.current as unknown as HTMLElement;
        const rect = node.getBoundingClientRect();
        callback(rect.x, rect.y, rect.width, rect.height);
      } catch {}
    } else {
      ref.current.measureInWindow((x, y, w, h) => callback(x, y, w, h));
    }
  }, []);

  const measureBoard = useCallback(() => {
    measureView(boardRef, (x, y, width, height) => {
      boardLayoutRef.current = { x, y, width, height };
    });
  }, [measureView]);

  useEffect(() => {
    const timer = setTimeout(measureBoard, 500);
    return () => clearTimeout(timer);
  }, [measureBoard, currentLevel]);

  const startNewLevel = useCallback((lvl: number) => {
    const newLevel = generateLevel(lvl, CANVAS_WIDTH, CANVAS_HEIGHT);
    setGameLevel(newLevel);
    setCurrentLevel(lvl);
    setSolved(false);
    setHighlightCell(null);
    setShowHint(false);
    setUserRotation(0);
    userRotationRef.current = 0;
    tileX.value = 0;
    tileY.value = 0;
    tileScale.value = 1;
    tileDragging.value = 0;
    victoryOpacity.value = 0;
    boardScale.value = 1;
    highlightScale.value = 1;
    shakeX.value = 0;
  }, []);

  const handleCorrectDrop = useCallback(() => {
    const board = boardLayoutRef.current;
    const lvl = gameLevelRef.current;
    const cellW = CANVAS_WIDTH / GRID_DIMENSIONS.cols;
    const cellH = CANVAS_HEIGHT / GRID_DIMENSIONS.rows;
    const targetScreenX = board.x + lvl.targetCol * cellW;
    const targetScreenY = board.y + lvl.targetRow * cellH;
    const snapDx = targetScreenX - tileOriginalPos.current.x;
    const snapDy = targetScreenY - tileOriginalPos.current.y;
    tileX.value = withSpring(snapDx, { damping: 15, stiffness: 300 });
    tileY.value = withSpring(snapDy, { damping: 15, stiffness: 300 });
    tileScale.value = withSpring(cellW / TILE_SIZE);
    tileDragging.value = withTiming(0, { duration: 200 });
    setSolved(true);
    setScore(prev => prev + Math.max(100 - attempts * 20, 20));
    setAttempts(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    victoryOpacity.value = withSpring(1);
  }, [attempts]);

  const handleWrongDrop = useCallback(() => {
    setAttempts(prev => prev + 1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    shakeX.value = withSequence(
      withTiming(3, { duration: 60 }),
      withTiming(-2, { duration: 60 }),
      withTiming(0, { duration: 80 }),
    );
    tileX.value = withSpring(0, { damping: 20, stiffness: 300 });
    tileY.value = withSpring(0, { damping: 20, stiffness: 300 });
    tileScale.value = withSpring(1);
    tileDragging.value = withTiming(0, { duration: 200 });
  }, []);

  const handleCorrectDropRef = useRef(handleCorrectDrop);
  handleCorrectDropRef.current = handleCorrectDrop;
  const handleWrongDropRef = useRef(handleWrongDrop);
  handleWrongDropRef.current = handleWrongDrop;

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !solvedRef.current,
    onMoveShouldSetPanResponder: () => !solvedRef.current,
    onPanResponderGrant: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      tileScale.value = withSpring(1.1);
      tileDragging.value = withTiming(1, { duration: 150 });
      measureBoard();
    },
    onPanResponderMove: (_, gesture) => {
      tileX.value = gesture.dx;
      tileY.value = gesture.dy;

      const board = boardLayoutRef.current;
      const tileCenterX = tileOriginalPos.current.x + gesture.dx + TILE_SIZE / 2;
      const tileCenterY = tileOriginalPos.current.y + gesture.dy + TILE_SIZE / 2;

      const relX = tileCenterX - board.x;
      const relY = tileCenterY - board.y;

      const pos = getGridPosition(relX, relY, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (pos) {
        setHighlightCell(pos);
      } else {
        setHighlightCell(null);
      }
    },
    onPanResponderRelease: (_, gesture) => {
      const board = boardLayoutRef.current;
      const tileCenterX = tileOriginalPos.current.x + gesture.dx + TILE_SIZE / 2;
      const tileCenterY = tileOriginalPos.current.y + gesture.dy + TILE_SIZE / 2;

      const relX = tileCenterX - board.x;
      const relY = tileCenterY - board.y;

      const pos = getGridPosition(relX, relY, CANVAS_WIDTH, CANVAS_HEIGHT);
      const lvl = gameLevelRef.current;

      setHighlightCell(null);

      if (pos && pos.row === lvl.targetRow && pos.col === lvl.targetCol) {
        handleCorrectDropRef.current();
      } else {
        handleWrongDropRef.current();
      }
    },
  })).current;

  const tileAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tileX.value + shakeX.value },
      { translateY: tileY.value },
      { scale: tileScale.value },
    ],
    zIndex: tileDragging.value > 0.5 ? 100 : 1,
    shadowOpacity: interpolate(tileDragging.value, [0, 1], [0.2, 0.6]),
    shadowRadius: interpolate(tileDragging.value, [0, 1], [4, 16]),
    elevation: interpolate(tileDragging.value, [0, 1], [2, 12], Extrapolation.CLAMP),
  }));

  const victoryStyle = useAnimatedStyle(() => ({
    opacity: victoryOpacity.value,
    transform: [{ scale: interpolate(victoryOpacity.value, [0, 1], [0.8, 1]) }],
  }));

  const highlightedBoard = useMemo(() => {
    let highlight = highlightCell;
    if (solved) {
      highlight = { row: gameLevel.targetRow, col: gameLevel.targetCol };
    }
    return (
      <GameBoard
        level={gameLevel}
        canvasWidth={CANVAS_WIDTH}
        canvasHeight={CANVAS_HEIGHT}
        highlightCell={highlight}
        showTarget={showHint}
      />
    );
  }, [gameLevel, highlightCell, solved, showHint]);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelLabel}>שלב</Text>
            <Text style={styles.levelNumber}>{currentLevel}</Text>
          </View>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Shape Quest</Text>
          <Text style={styles.subtitle}>מצא את הצורה</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.scoreBadge}>
            <Ionicons name="star" size={14} color={Colors.accentYellow} />
            <Text style={styles.scoreText}>{score}</Text>
          </View>
        </View>
      </View>

      <View style={styles.boardContainer}>
        <View
          ref={boardRef}
          onLayout={measureBoard}
          collapsable={false}
        >
          {highlightedBoard}
        </View>
      </View>

      <View style={[styles.bottomArea, { paddingBottom: bottomInset + 8 }]}>
        {!solved ? (
          <View style={styles.goalArea}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalLabel}>גרור לתא הנכון</Text>
              <View style={styles.goalActions}>
                <Pressable
                  onPress={() => {
                    setShowHint(prev => !prev);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.hintButton,
                    pressed && { opacity: 0.6 },
                    showHint && styles.hintButtonActive,
                  ]}
                >
                  <Feather name="eye" size={18} color={showHint ? Colors.accentGreen : Colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    const next = (userRotation + 90) % 360;
                    setUserRotation(next);
                    userRotationRef.current = next;
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.rotateButton,
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <MaterialCommunityIcons name="rotate-right" size={20} color={Colors.text} />
                </Pressable>
              </View>
            </View>
            <View
              style={styles.tileContainer}
              ref={tileContainerRef}
              onLayout={() => {
                setTimeout(() => {
                  measureView(tileContainerRef, (x, y) => {
                    tileOriginalPos.current = { x, y };
                  });
                }, 100);
              }}
            >
              <Animated.View
                style={[styles.draggableTile, tileAnimStyle]}
                {...panResponder.panHandlers}
              >
                <GoalTile
                  level={gameLevel}
                  canvasWidth={CANVAS_WIDTH}
                  canvasHeight={CANVAS_HEIGHT}
                  tileSize={TILE_SIZE}
                  rotationOverride={userRotation}
                />
              </Animated.View>
            </View>
            {attempts > 0 && (
              <Text style={styles.attemptsText}>ניסיונות: {attempts}</Text>
            )}
          </View>
        ) : (
          <Animated.View style={[styles.victoryContainer, victoryStyle]}>
            <View style={styles.victoryContent}>
              <View style={styles.victoryIconRow}>
                <Ionicons name="checkmark-circle" size={36} color={Colors.accentGreen} />
              </View>
              <Text style={styles.victoryText}>מצוין!</Text>
              <Text style={styles.victoryScore}>+{Math.max(100 - (attempts) * 20, 20)} נקודות</Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  startNewLevel(currentLevel + 1);
                }}
                style={({ pressed }) => [
                  styles.nextButton,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
              >
                <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
                <Text style={styles.nextButtonText}>שלב הבא</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerLeft: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 2,
    alignItems: 'center',
  },
  headerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Rubik_700Bold',
    color: Colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Rubik_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
    writingDirection: 'rtl',
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  levelLabel: {
    fontSize: 12,
    fontFamily: 'Rubik_400Regular',
    color: Colors.textSecondary,
    writingDirection: 'rtl',
  },
  levelNumber: {
    fontSize: 16,
    fontFamily: 'Rubik_700Bold',
    color: Colors.accentBlue,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  scoreText: {
    fontSize: 14,
    fontFamily: 'Rubik_700Bold',
    color: Colors.accentYellow,
  },
  boardContainer: {
    alignItems: 'center',
    paddingHorizontal: CANVAS_PADDING,
  },
  bottomArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  goalArea: {
    alignItems: 'center',
    gap: 10,
  },
  goalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
  },
  goalLabel: {
    fontSize: 14,
    fontFamily: 'Rubik_500Medium',
    color: Colors.textSecondary,
    writingDirection: 'rtl',
  },
  goalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hintButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintButtonActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  rotateButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: TILE_SIZE + 20,
  },
  draggableTile: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
  },
  attemptsText: {
    fontSize: 12,
    fontFamily: 'Rubik_400Regular',
    color: Colors.accent,
    writingDirection: 'rtl',
  },
  victoryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  victoryContent: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 32,
    paddingVertical: 24,
    borderRadius: 20,
    gap: 8,
  },
  victoryIconRow: {
    marginBottom: 4,
  },
  victoryText: {
    fontSize: 24,
    fontFamily: 'Rubik_700Bold',
    color: Colors.text,
    writingDirection: 'rtl',
  },
  victoryScore: {
    fontSize: 16,
    fontFamily: 'Rubik_500Medium',
    color: Colors.accentGreen,
    writingDirection: 'rtl',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accentBlue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    marginTop: 8,
  },
  nextButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik_700Bold',
    color: '#FFFFFF',
    writingDirection: 'rtl',
  },
});
