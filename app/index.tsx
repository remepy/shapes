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

const { width: RAW_SCREEN_WIDTH, height: RAW_SCREEN_HEIGHT } = Dimensions.get('window');

const PHONE_WIDTH = 360;
const PHONE_HEIGHT = 780;
const IS_DESKTOP_WEB = Platform.OS === 'web' && RAW_SCREEN_WIDTH > 500;

const SCREEN_WIDTH = IS_DESKTOP_WEB ? PHONE_WIDTH : RAW_SCREEN_WIDTH;
const SCREEN_HEIGHT = IS_DESKTOP_WEB ? PHONE_HEIGHT : RAW_SCREEN_HEIGHT;

const WEB_TOP_INSET = Platform.OS === 'web' ? (IS_DESKTOP_WEB ? 16 : 34) : 0;
const WEB_BOTTOM_INSET = Platform.OS === 'web' ? (IS_DESKTOP_WEB ? 16 : 34) : 0;

const CANVAS_PADDING = 16;
const BASE_CANVAS_WIDTH = SCREEN_WIDTH - CANVAS_PADDING * 2;
const CANVAS_ASPECT = 6 / 4;
const BASE_CANVAS_HEIGHT = BASE_CANVAS_WIDTH * CANVAS_ASPECT;

const HEADER_HEIGHT = 50;
const GOAL_AREA_HEIGHT = 180;
const AVAILABLE_FOR_CANVAS = SCREEN_HEIGHT - WEB_TOP_INSET - WEB_BOTTOM_INSET - HEADER_HEIGHT - GOAL_AREA_HEIGHT;
const SCALE_FACTOR = AVAILABLE_FOR_CANVAS < BASE_CANVAS_HEIGHT
  ? AVAILABLE_FOR_CANVAS / BASE_CANVAS_HEIGHT
  : 1;

const CANVAS_WIDTH = BASE_CANVAS_WIDTH * SCALE_FACTOR;
const CANVAS_HEIGHT = BASE_CANVAS_HEIGHT * SCALE_FACTOR;

const TILE_SIZE = Math.max(Math.min(CANVAS_WIDTH / GRID_DIMENSIONS.cols, 90 * SCALE_FACTOR), 96);

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

  const phoneFrame = IS_DESKTOP_WEB ? {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    alignSelf: 'center' as const,
    borderRadius: 24,
    overflow: 'hidden' as const,
    borderWidth: 2,
    borderColor: '#333',
  } : undefined;

  return (
    <View style={IS_DESKTOP_WEB ? styles.desktopWrapper : undefined}>
      <View style={[styles.container, { paddingTop: topInset }, phoneFrame]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={() => {
              if (Platform.OS === 'web') {
                if ((window as any).history.length > 1) {
                  (window as any).history.back();
                } else {
                  (window as any).close();
                }
              }
            }}
            style={({ pressed }) => [styles.exitButton, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
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
        <View style={styles.headerCenter}>
          <Text style={styles.title}>צורות בצרורות</Text>
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
          {attempts > 0 && !solved && (
            <View style={styles.attemptsPill}>
              <Text style={styles.attemptsPillText}>ניסיונות: {attempts}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.bottomArea, { paddingBottom: bottomInset + 8 }]}>
        {!solved ? (
          <View style={styles.goalArea}>
            <Text style={styles.goalCaption}>לחצו על התא שמכיל את הצורה הבאה:</Text>
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
                <MaterialCommunityIcons name="lightbulb-outline" size={40} color={hintLevel > 0 ? Colors.accentGreen : Colors.textSecondary} />
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
                <MaterialCommunityIcons name="rotate-right" size={40} color={Colors.text} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
      {solved && (
        <Animated.View style={[styles.victoryOverlay, victoryStyle]}>
          <View style={styles.victoryContent}>
            <View style={styles.victoryIconRow}>
              <Ionicons name="checkmark-circle" size={36} color={Colors.accentGreen} />
            </View>
            <Text style={styles.victoryText}>מצוין!</Text>
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
            <Pressable
              onPress={() => {
                if (Platform.OS === 'web') {
                  if ((window as any).history.length > 1) {
                    (window as any).history.back();
                  } else {
                    (window as any).close();
                  }
                }
              }}
              style={({ pressed }) => [pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.exitLink}>יציאה מהפעילות</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktopWrapper: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  exitButton: {
    padding: 4,
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
  goalCaption: {
    fontSize: 14,
    fontFamily: 'Rubik_500Medium',
    color: '#00FFFF',
    writingDirection: 'rtl',
    textAlign: 'center',
    alignSelf: 'center',
  },
  goalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hintButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintButtonActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  rotateButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attemptsPill: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  attemptsPillText: {
    fontSize: 11,
    fontFamily: 'Rubik_400Regular',
    color: '#fff',
    writingDirection: 'rtl',
  },
  musicToggle: {
    padding: 4,
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
  exitLink: {
    fontSize: 14,
    fontFamily: 'Rubik_400Regular',
    color: Colors.textSecondary,
    writingDirection: 'rtl',
    textDecorationLine: 'underline',
    marginTop: 4,
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
