import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { GameBoard, GoalTile } from '@/components/GameBoard';
import { generateLevel, GRID_DIMENSIONS, GameLevel } from '@/lib/game-engine';
import { seedForLevel, startRotationForLevel } from '@/lib/levels';
import { send, RoundStats } from '@/lib/bridge';
import { useI18n } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/motion';
import Colors from '@/constants/colors';
import { useTutorial } from '@/hooks/useTutorial';
import { TutorialOverlay, TutorialSpotlight } from '@/components/TutorialOverlay';

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

export interface GameSession {
  /** Ordered, one per round (session_start.levelIds). */
  levelIds: string[];
  /** Catalogue numbers matching levelIds. */
  levelNumbers: number[];
  reducedMotion: boolean;
  /** Authoritative flag from the app, or null when standalone. */
  tutorialSeen: boolean | null;
  standalone: boolean;
}

interface GameScreenProps {
  session: GameSession;
  /** App-side interruption (pause/resume messages). */
  paused: boolean;
  /** The activity is over from the game's side: show an empty screen. */
  onEnded: () => void;
}

const ZERO_STATS: RoundStats = { wrongTaps: 0, hintsUsed: 0, rotations: 0 };
const FINISH_DELAY_MS = 1500;

function buildLevel(levelNumber: number): GameLevel {
  return generateLevel(seedForLevel(levelNumber), CANVAS_WIDTH, CANVAS_HEIGHT);
}

function legacyWebExit() {
  if (Platform.OS !== 'web') return;
  if ((window as any).history.length > 1) (window as any).history.back();
  else (window as any).close();
}

export function GameScreen({ session, paused, onEnded }: GameScreenProps) {
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useI18n();
  const reducedMotion = useReducedMotion();
  const topInset = Platform.OS === 'web' ? WEB_TOP_INSET : insets.top;
  const bottomInset = Platform.OS === 'web' ? WEB_BOTTOM_INSET : insets.bottom;
  const textDir = { writingDirection: isRTL ? 'rtl' : 'ltr' } as const;
  const forwardIcon = isRTL ? 'arrow-back' : 'arrow-forward';

  const { levelIds, levelNumbers, standalone } = session;
  const totalRounds = levelIds.length;

  const [roundIndex, setRoundIndex] = useState(0);
  const isLastRound = roundIndex === totalRounds - 1;
  const [gameLevel, setGameLevel] = useState<GameLevel>(() => buildLevel(levelNumbers[0]));
  const [highlightCell, setHighlightCell] = useState<{ row: number; col: number } | null>(null);
  const [solved, setSolved] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);
  const [attempts, setAttempts] = useState(0); // wrong taps this round
  const [hintLevel, setHintLevel] = useState(0); // hints used this round (0-2)
  const [rotations, setRotations] = useState(0);
  const [userRotation, setUserRotation] = useState(() => startRotationForLevel(levelNumbers[0]));
  const totals = useRef<RoundStats>({ ...ZERO_STATS });

  const [musicPlaying, setMusicPlaying] = useState(true);
  // Browsers and WebViews block audio until the first tap, so wait for it on web.
  const [userInteracted, setUserInteracted] = useState(Platform.OS !== 'web');
  const musicPlayer = useAudioPlayer(require('@/assets/background-music.mp3'));

  const tutorial = useTutorial(session.tutorialSeen);
  const tutorialStep = tutorial.step;
  const tutorialFocus = tutorialStep?.focus ?? null;
  const tutorialAction = tutorialStep?.action ?? null;
  const inputBlocked = paused || sessionDone;
  // Which buttons the player may use during the tutorial
  const boardEnabled = !inputBlocked && (!tutorialStep || tutorialAction === 'tap');
  const rotateEnabled = !inputBlocked && (!tutorialStep || tutorialAction === 'rotate' || tutorialAction === 'tap');
  const hintEnabled = !inputBlocked && (!tutorialStep || tutorialAction === 'hint' || tutorialAction === 'tap');

  useEffect(() => {
    if (userInteracted) return;
    const onFirstTap = () => setUserInteracted(true);
    document.addEventListener('pointerdown', onFirstTap, { once: true });
    return () => document.removeEventListener('pointerdown', onFirstTap);
  }, [userInteracted]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    musicPlayer.loop = true;
    musicPlayer.volume = 0.4;
  }, [musicPlayer]);

  const shouldPlay = musicPlaying && userInteracted && !paused && !sessionDone;
  useEffect(() => {
    if (shouldPlay) musicPlayer.play();
    else musicPlayer.pause();
  }, [shouldPlay, musicPlayer]);

  const victoryOpacity = useSharedValue(0);
  const shakeX = useSharedValue(0);

  const startRound = useCallback((index: number) => {
    setRoundIndex(index);
    setGameLevel(buildLevel(levelNumbers[index]));
    setSolved(false);
    setHighlightCell(null);
    setAttempts(0);
    setHintLevel(0);
    setRotations(0);
    setUserRotation(startRotationForLevel(levelNumbers[index]));
    victoryOpacity.value = 0;
    shakeX.value = 0;
  }, [levelNumbers, victoryOpacity, shakeX]);

  const restartSession = useCallback(() => {
    totals.current = { ...ZERO_STATS };
    setSessionDone(false);
    startRound(0);
  }, [startRound]);

  // Final round: the app shows its own summary, so the game only reports.
  useEffect(() => {
    if (!solved || !isLastRound || standalone) return;
    const timer = setTimeout(() => {
      send.gameFinished(levelIds[roundIndex], { ...totals.current });
      setSessionDone(true);
    }, FINISH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [solved, isLastRound, standalone, levelIds, roundIndex]);

  const handleCellTap = useCallback((row: number, col: number) => {
    if (solved || !boardEnabled) return;
    if (row === gameLevel.targetRow && col === gameLevel.targetCol) {
      const stats: RoundStats = { wrongTaps: attempts, hintsUsed: hintLevel, rotations };
      totals.current = {
        wrongTaps: totals.current.wrongTaps + stats.wrongTaps,
        hintsUsed: totals.current.hintsUsed + stats.hintsUsed,
        rotations: totals.current.rotations + stats.rotations,
      };
      send.levelCompleted(levelIds[roundIndex], stats);
      setSolved(true);
      setHighlightCell({ row, col });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      victoryOpacity.value = reducedMotion ? 1 : withSpring(1);
      tutorial.notify('tap');
    } else {
      setAttempts(prev => prev + 1);
      setHighlightCell({ row, col });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (!reducedMotion) {
        shakeX.value = withSequence(
          withTiming(3, { duration: 60 }),
          withTiming(-2, { duration: 60 }),
          withTiming(0, { duration: 80 }),
        );
      }
      setTimeout(() => setHighlightCell(null), 400);
    }
  }, [solved, gameLevel, boardEnabled, attempts, hintLevel, rotations, levelIds, roundIndex, reducedMotion, victoryOpacity, shakeX, tutorial]);

  const handleHintPress = useCallback(() => {
    if (!hintEnabled) return;
    setHintLevel(prev => Math.min(prev + 1, 2));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    tutorial.notify('hint');
  }, [hintEnabled, tutorial]);

  const handleRotatePress = useCallback(() => {
    if (!rotateEnabled) return;
    setUserRotation(prev => (prev + 90) % 360);
    setRotations(prev => prev + 1);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    tutorial.notify('rotate');
  }, [rotateEnabled, tutorial]);

  const openTutorial = useCallback(() => {
    if (inputBlocked) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    startRound(roundIndex);
    tutorial.start();
  }, [inputBlocked, startRound, roundIndex, tutorial]);

  const handleExit = useCallback(() => {
    if (paused) return;
    if (standalone) {
      legacyWebExit();
      return;
    }
    // BR-07 quit button: ends the activity without completion.
    send.exitRequested();
    musicPlayer.pause();
    onEnded();
  }, [paused, standalone, musicPlayer, onEnded]);

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
        showTarget={hintLevel >= 2 || tutorialAction === 'tap'}
      />
    );
  }, [gameLevel, highlightCell, solved, hintLevel, tutorialAction]);

  const phoneFrame = IS_DESKTOP_WEB ? {
    width: PHONE_WIDTH,
    height: PHONE_HEIGHT,
    alignSelf: 'center' as const,
    borderRadius: 24,
    overflow: 'hidden' as const,
    borderWidth: 2,
    borderColor: '#333',
  } : undefined;

  // After the last round in app mode there is nothing more to press.
  const showNextButton = !isLastRound;
  const showPlayAgain = isLastRound && standalone;
  const showExitLink = !(isLastRound && !standalone);

  return (
    <View style={IS_DESKTOP_WEB ? styles.desktopWrapper : styles.mobileWrapper}>
      <View style={[styles.container, { paddingTop: topInset }, phoneFrame]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Pressable
            onPress={handleExit}
            accessibilityRole="button"
            accessibilityLabel={t('a11y_exit')}
            style={({ pressed }) => [styles.exitButton, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => setMusicPlaying(prev => !prev)}
            accessibilityRole="button"
            accessibilityLabel={t('a11y_music')}
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
          <Pressable
            onPress={openTutorial}
            accessibilityRole="button"
            accessibilityLabel={t('a11y_tutorial')}
            style={({ pressed }) => [styles.musicToggle, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="help-circle-outline" size={22} color={Colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.headerCenter}>
          <Text style={[styles.title, textDir]}>{t('title')}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.levelBadge}>
            <Text style={[styles.levelLabel, textDir]}>
              {t('round_label', { current: roundIndex + 1, total: totalRounds })}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.boardContainer, tutorialStep && tutorialFocus !== 'board' && styles.dimmed]}>
        <View style={{ position: 'relative' }}>
          {highlightedBoard}
          {tutorialFocus === 'board' && <TutorialSpotlight radius={6} />}
          {!solved && boardEnabled && (
            <View style={[StyleSheet.absoluteFill, { direction: 'ltr' }]}>
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
              <Text style={[styles.attemptsPillText, textDir]}>{t('attempts', { count: attempts })}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.bottomArea, { paddingBottom: bottomInset + 8 }]}>
        {!solved ? (
          <View style={styles.goalArea}>
            <Text style={[styles.goalCaption, textDir, tutorialStep && tutorialFocus !== 'goal' && styles.dimmed]}>{t('goal_caption')}</Text>
            <Animated.View style={[tileShakeStyle, tutorialStep && tutorialFocus !== 'goal' && styles.dimmed]}>
              {tutorialFocus === 'goal' && <TutorialSpotlight radius={12} />}
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
                onPress={handleHintPress}
                disabled={!hintEnabled}
                accessibilityRole="button"
                accessibilityLabel={t('a11y_hint')}
                style={({ pressed }) => [
                  styles.hintButton,
                  pressed && { opacity: 0.6 },
                  hintLevel > 0 && styles.hintButtonActive,
                  // Keep the bulb bright whenever the step is waiting for a hint tap,
                  // even when the spotlight is on the goal tile.
                  tutorialStep && tutorialFocus !== 'hint' && tutorialAction !== 'hint' && styles.dimmed,
                ]}
              >
                {tutorialFocus === 'hint' && <TutorialSpotlight radius={42} />}
                <MaterialCommunityIcons name="lightbulb-outline" size={40} color={hintLevel > 0 ? Colors.accentGreen : Colors.textSecondary} />
              </Pressable>
              <Pressable
                onPress={handleRotatePress}
                disabled={!rotateEnabled}
                accessibilityRole="button"
                accessibilityLabel={t('a11y_rotate')}
                style={({ pressed }) => [
                  styles.rotateButton,
                  pressed && { opacity: 0.6 },
                  tutorialStep && tutorialFocus !== 'rotate' && styles.dimmed,
                ]}
              >
                {tutorialFocus === 'rotate' && <TutorialSpotlight radius={42} />}
                <MaterialCommunityIcons name="rotate-right" size={40} color={Colors.text} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
      {tutorialStep && !solved && (
        <TutorialOverlay
          step={tutorialStep}
          stepIndex={tutorial.stepIndex}
          totalSteps={tutorial.totalSteps}
          placement={
            // The card sits over the board's lower rows when anchored at the
            // bottom, so if the target cell is in the lower half of the grid
            // move it to the top instead so the frame stays fully visible.
            tutorialFocus === 'board' && gameLevel.targetRow < GRID_DIMENSIONS.rows / 2
              ? 'bottom'
              : 'top'
          }
          topOffset={topInset + HEADER_HEIGHT + 8}
          bottomOffset={bottomInset + 8}
          onNext={tutorial.next}
          onSkip={tutorial.skip}
        />
      )}
      {solved && (
        <Animated.View style={[styles.victoryOverlay, victoryStyle]}>
          <View style={styles.victoryContent}>
            <View style={styles.victoryIconRow}>
              <Ionicons name="checkmark-circle" size={36} color={Colors.accentGreen} />
            </View>
            <Text style={[styles.victoryText, textDir]}>{t('victory_title')}</Text>
            {showNextButton && (
              <Pressable
                onPress={() => {
                  if (paused) return;
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  startRound(roundIndex + 1);
                }}
                style={({ pressed }) => [
                  styles.nextButton,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
              >
                <Ionicons name={forwardIcon} size={22} color="#FFFFFF" />
                <Text style={[styles.nextButtonText, textDir]}>{t('next_round')}</Text>
              </Pressable>
            )}
            {showPlayAgain && (
              <Pressable
                onPress={restartSession}
                style={({ pressed }) => [
                  styles.nextButton,
                  pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                ]}
              >
                <Ionicons name="refresh" size={22} color="#FFFFFF" />
                <Text style={[styles.nextButtonText, textDir]}>{t('play_again')}</Text>
              </Pressable>
            )}
            {showExitLink && (
              <Pressable
                onPress={handleExit}
                style={({ pressed }) => [styles.exitLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={[styles.exitLinkText, textDir]}>{t('exit_activity')}</Text>
              </Pressable>
            )}
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
  mobileWrapper: {
    flex: 1,
    backgroundColor: Colors.background,
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
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  headerRight: {
    flexShrink: 0,
    alignItems: 'flex-end',
    zIndex: 2,
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
  },
  musicToggle: {
    padding: 4,
  },
  dimmed: {
    opacity: 0.35,
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
    alignItems: 'stretch',
    backgroundColor: Colors.surface,
    paddingHorizontal: 28,
    paddingVertical: 32,
    borderRadius: 24,
    gap: 16,
    width: 300,
  },
  victoryIconRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  victoryText: {
    fontSize: 28,
    fontFamily: 'Rubik_700Bold',
    color: Colors.text,
    textAlign: 'center',
  },
  exitLink: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.textSecondary,
    minHeight: 60,
  },
  exitLinkText: {
    fontSize: 17,
    fontFamily: 'Rubik_500Medium',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accentBlue,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 20,
    gap: 10,
    minHeight: 60,
  },
  nextButtonText: {
    fontSize: 18,
    fontFamily: 'Rubik_700Bold',
    color: '#FFFFFF',
  },
});
