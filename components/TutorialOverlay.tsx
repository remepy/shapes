import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  cancelAnimation,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import Colors from '@/constants/colors';
import type { TutorialStep } from '@/hooks/useTutorial';
import { useI18n, TranslationKey } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/motion';

interface TutorialOverlayProps {
  step: TutorialStep;
  stepIndex: number;
  totalSteps: number;
  /** Where to place the card so it does not cover the focused element. */
  placement: 'top' | 'bottom';
  topOffset: number;
  bottomOffset: number;
  onNext: () => void;
  onSkip: () => void;
}

export function TutorialOverlay({
  step,
  stepIndex,
  totalSteps,
  placement,
  topOffset,
  bottomOffset,
  onNext,
  onSkip,
}: TutorialOverlayProps) {
  const { t, isRTL } = useI18n();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(reducedMotion ? 0 : placement === 'top' ? -12 : 12);

  useEffect(() => {
    if (reducedMotion) {
      opacity.value = 1;
      translateY.value = 0;
      return;
    }
    opacity.value = 0;
    translateY.value = placement === 'top' ? -12 : 12;
    opacity.value = withTiming(1, { duration: 220 });
    translateY.value = withTiming(0, { duration: 220 });
  }, [stepIndex, placement, opacity, translateY, reducedMotion]);

  const row = { flexDirection: isRTL ? 'row-reverse' : 'row' } as const;
  const text = { writingDirection: isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left' } as const;

  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const waitingForAction = step.action !== 'next';

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        placement === 'top' ? { top: topOffset } : { bottom: bottomOffset },
        cardStyle,
      ]}
    >
      <View style={styles.card}>
        <View style={[styles.headerRow, row]}>
          <Text style={[styles.title, text]}>{t(step.titleKey)}</Text>
          <View style={[styles.dots, row]}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <View
                key={i}
                style={[styles.dot, i === stepIndex && styles.dotActive, i < stepIndex && styles.dotDone]}
              />
            ))}
          </View>
        </View>
        <Text style={[styles.body, text]}>{t(step.bodyKey)}</Text>
        <View style={[styles.actions, row]}>
          <Pressable onPress={onSkip} style={({ pressed }) => [styles.skipButton, pressed && { opacity: 0.6 }]}>
            <Text style={[styles.skipText, text]}>{t('tutorial_skip')}</Text>
          </Pressable>
          {waitingForAction ? (
            <View style={[styles.waitPill, row]}>
              <Ionicons name="hand-left-outline" size={20} color={Colors.accentYellow} />
              <Text style={[styles.waitText, text]}>{step.action !== 'next' && t(ACTION_LABEL[step.action])}</Text>
            </View>
          ) : (
            <Pressable onPress={onNext} style={({ pressed }) => [styles.nextButton, row, pressed && { opacity: 0.8 }]}>
              <Text style={[styles.nextText, text]}>{t('tutorial_next')}</Text>
              <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={22} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const ACTION_LABEL: Record<Exclude<TutorialStep['action'], 'next'>, TranslationKey> = {
  rotate: 'tutorial_action_rotate',
  hint: 'tutorial_action_hint',
  tap: 'tutorial_action_tap',
};

/** Pulsing ring drawn around a focused element. Parent must be position: relative. */
export function TutorialSpotlight({ radius = 16 }: { radius?: number }) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) return;
    scale.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 600 }),
        withTiming(1, { duration: 600 }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(scale);
      scale.value = 1;
    };
  }, [scale, reducedMotion]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.spotlight, { borderRadius: radius }, style]}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 20,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.5)',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  headerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontFamily: 'Rubik_700Bold',
    color: Colors.accentYellow,
  },
  dots: {
    gap: 5,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.surfaceLight,
  },
  dotActive: {
    backgroundColor: Colors.accentYellow,
    width: 22,
  },
  dotDone: {
    backgroundColor: Colors.accentGreen,
  },
  body: {
    fontSize: 20,
    lineHeight: 30,
    fontFamily: 'Rubik_400Regular',
    color: Colors.text,
  },
  actions: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  nextButton: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.accentBlue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    minHeight: 56,
  },
  nextText: {
    fontSize: 20,
    fontFamily: 'Rubik_700Bold',
    color: '#FFFFFF',
  },
  waitPill: {
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 214, 10, 0.12)',
    minHeight: 56,
  },
  waitText: {
    fontSize: 17,
    fontFamily: 'Rubik_500Medium',
    color: Colors.accentYellow,
  },
  skipButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 18,
    fontFamily: 'Rubik_400Regular',
    color: Colors.textSecondary,
  },
  spotlight: {
    position: 'absolute',
    top: -6,
    left: -6,
    right: -6,
    bottom: -6,
    borderWidth: 3,
    borderColor: Colors.accentGreen,
    shadowColor: Colors.accentGreen,
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
    zIndex: 15,
  },
});
