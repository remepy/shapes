import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { GameBoard, GoalTile } from '@/components/GameBoard';
import { generateLevel, GRID_DIMENSIONS, GameLevel } from '@/lib/game-engine';
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
  const [hintLevel, setHintLevel] = useState(0);
  const [userRotation, setUserRotation] = useState(() => [0, 90, 180, 270][Math.floor(Math.random() * 4)]);
  const [musicPlaying, setMusicPlaying] = useState(true);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync(
          require('@/assets/background-music.mp3'),
          { isLooping: true, shouldPlay: true, volume: 0.4 }
        );
        if (mounted) soundRef.current = sound;
      } catch {}
    })();
    return () => {
      mounted = false;
      soundRef.current?.unloadAsync();
    };
  }, []);

  useEffect(() => {
    if (!soundRef.current) return;
    if (musicPlaying) {
      soundRef.current.playAsync();
    } else {
      soundRef.current.pauseAsync();
    }
  }, [musicPlaying]);

  const victoryOpacity = useSharedValue(0);
  const shakeX = useSharedValue(0);

  const startNewLevel = useCallback((lvl: number) => {
    const newLevel = generateLevel(lvl, CANVAS_WIDTH, CANVAS_HEIGHT);
    setGameLevel(newLevel);
    setCurrentLevel(lvl);
    setSolved(false);
    setHighlightCell(null);
    setHintLevel(0);
    setUserRotation([0, 90, 180, 270][Math.floor(Math.random() * 4)]);
    victoryOpacity.value = 0;
    shakeX.value = 0;
  }, []);

  const handleCellTap = useCallback((row: number, col: number) => {
    if (solved) return;
    if (row === gameLevel.targetRow && col === gameLevel.targetCol) {
      setSolved(true);
      setHighlightCell({ row, col });
      setScore(prev => prev + Math.max(100 - attempts * 20, 20));
      setAttempts(0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      victoryOpacity.value = withSpring(1);
    } else {
      setAttempts(prev => prev + 1);
      setHighlightCell({ row, col });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shakeX.value = withSequence(
        withTiming(3, { duration: 60 }),
        withTiming(-2, { duration: 60 }),
        withTiming(0, { duration: 80 }),
      );
      setTimeout(() => setHighlightCell(null), 400);
    }
  }, [solved, gameLevel, attempts]);

  const tileShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
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
        showTarget={hintLevel >= 2}
      />
    );
  }, [gameLevel, highlightCell, solved, hintLevel]);

  return (
    <View style={[styles.container, { paddingTop: topInset }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.scoreBadge}>
            <Ionicons name="star" size={14} color={Colors.accentYellow} />
            <Text style={styles.scoreText}>{score}</Text>
          </View>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>צורות בצרורות</Text>
          <Text style={styles.subtitle}>מצאו את הצורה</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelLabel}>שלב {currentLevel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.boardContainer}>
        <View style={{ position: 'relative' }}>
          {highlightedBoard}
          {!solved && (
            <View style={StyleSheet.absoluteFill}>
              {Array.from({ length: GRID_DIMENSIONS.rows }, (_, row) => (
                <View key={row} style={{ flex: 1, flexDirection: 'row' }}>
                  {Array.from({ length: GRID_DIMENSIONS.cols }, (_, col) => (
                    <Pressable
                      key={col}
                      style={{ flex: 1 }}
                      onPress={() => handleCellTap(row, col)}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={[styles.bottomArea, { paddingBottom: bottomInset + 8 }]}>
        {!solved ? (
          <View style={styles.goalArea}>
            <View style={styles.goalHeader}>
              <View style={styles.goalActions}>
                <Pressable
                  onPress={() => {
                    setHintLevel(prev => Math.min(prev + 1, 2));
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={({ pressed }) => [
                    styles.hintButton,
                    pressed && { opacity: 0.6 },
                    hintLevel > 0 && styles.hintButtonActive,
                  ]}
                >
                  <MaterialCommunityIcons name="lightbulb-outline" size={20} color={hintLevel > 0 ? Colors.accentGreen : Colors.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    const next = (userRotation + 90) % 360;
                    setUserRotation(next);
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
              <Text style={styles.goalLabel}>הקישו על התא המתאים</Text>
            </View>
            <Animated.View style={tileShakeStyle}>
              <GoalTile
                level={gameLevel}
                canvasWidth={CANVAS_WIDTH}
                canvasHeight={CANVAS_HEIGHT}
                tileSize={TILE_SIZE}
                rotationOverride={userRotation}
                showColor={hintLevel >= 1}
              />
            </Animated.View>
            {attempts > 0 && (
              <Text style={styles.attemptsText}>ניסיונות: {attempts}</Text>
            )}
          </View>
        ) : null}
        <Pressable
          onPress={() => setMusicPlaying(prev => !prev)}
          style={({ pressed }) => [
            styles.musicToggle,
            pressed && { opacity: 0.6 },
          ]}
        >
          <Ionicons
            name={musicPlaying ? 'musical-notes' : 'musical-notes-outline'}
            size={20}
            color={musicPlaying ? Colors.accentYellow : Colors.textSecondary}
          />
        </Pressable>
      </View>
      {solved && (
        <Animated.View style={[styles.victoryOverlay, victoryStyle]}>
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
    paddingVertical: 4,
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
  attemptsText: {
    fontSize: 12,
    fontFamily: 'Rubik_400Regular',
    color: Colors.accent,
    writingDirection: 'rtl',
  },
  musicToggle: {
    alignSelf: 'center',
    padding: 8,
    marginTop: 4,
  },
  victoryOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
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
