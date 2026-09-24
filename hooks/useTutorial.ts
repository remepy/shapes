import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TranslationKey } from '@/lib/i18n';

const TUTORIAL_SEEN_KEY = 'shapes_tutorial_seen_v1';

export type TutorialFocus = 'goal' | 'board' | 'rotate' | 'hint';
export type TutorialAction = 'next' | 'rotate' | 'hint' | 'tap';

export interface TutorialStep {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
  focus: TutorialFocus;
  /** What the player must do to advance. */
  action: TutorialAction;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { titleKey: 'tutorial_goal_title', bodyKey: 'tutorial_goal_body', focus: 'goal', action: 'next' },
  { titleKey: 'tutorial_board_title', bodyKey: 'tutorial_board_body', focus: 'board', action: 'next' },
  { titleKey: 'tutorial_rotate_title', bodyKey: 'tutorial_rotate_body', focus: 'rotate', action: 'rotate' },
  { titleKey: 'tutorial_hint_title', bodyKey: 'tutorial_hint_body', focus: 'hint', action: 'hint' },
  { titleKey: 'tutorial_colors_title', bodyKey: 'tutorial_colors_body', focus: 'goal', action: 'hint' },
  { titleKey: 'tutorial_try_title', bodyKey: 'tutorial_try_body', focus: 'board', action: 'tap' },
];

/**
 * @param seenFromApp session_start.tutorialSeen. When provided it is
 *   authoritative (BR-06); null means standalone, so use the stored flag.
 */
export function useTutorial(seenFromApp: boolean | null) {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (seenFromApp !== null) {
      if (!seenFromApp) {
        setStepIndex(0);
        setActive(true);
      }
      setLoaded(true);
      return;
    }
    let mounted = true;
    AsyncStorage.getItem(TUTORIAL_SEEN_KEY)
      .then((value) => {
        if (!mounted) return;
        if (value !== '1') {
          setStepIndex(0);
          setActive(true);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [seenFromApp]);

  const markSeen = useCallback(() => {
    AsyncStorage.setItem(TUTORIAL_SEEN_KEY, '1').catch(() => {});
  }, []);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    markSeen();
  }, [markSeen]);

  const skip = finish;

  const next = useCallback(() => {
    setStepIndex((i) => {
      if (i + 1 >= TUTORIAL_STEPS.length) {
        return i;
      }
      return i + 1;
    });
  }, []);

  /** Advance only if the current step is waiting for this action. */
  const notify = useCallback(
    (action: TutorialAction) => {
      if (!active) return;
      const step = TUTORIAL_STEPS[stepIndex];
      if (step.action !== action) return;
      if (stepIndex + 1 >= TUTORIAL_STEPS.length) {
        finish();
      } else {
        setStepIndex(stepIndex + 1);
      }
    },
    [active, stepIndex, finish],
  );

  const step = active ? TUTORIAL_STEPS[stepIndex] : null;

  return {
    loaded,
    active,
    stepIndex,
    step,
    totalSteps: TUTORIAL_STEPS.length,
    start,
    skip,
    next,
    notify,
  };
}
