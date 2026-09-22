import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TUTORIAL_SEEN_KEY = 'shapes_tutorial_seen_v1';

export type TutorialFocus = 'goal' | 'board' | 'rotate' | 'hint';
export type TutorialAction = 'next' | 'rotate' | 'hint' | 'tap';

export interface TutorialStep {
  title: string;
  body: string;
  focus: TutorialFocus;
  /** What the player must do to advance. */
  action: TutorialAction;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    title: 'המטרה',
    body: 'בתחתית המסך מוצגת צורה. המשימה שלכם: למצוא את התא בלוח שמכיל בדיוק את הצורה הזו.',
    focus: 'goal',
    action: 'next',
  },
  {
    title: 'הלוח',
    body: 'הצורה מסתתרת באחד מ־24 התאים. בתמונה היא מופיעה באפור ואולי מסובבת, אז שימו לב לצורה ולא לצבע.',
    focus: 'board',
    action: 'next',
  },
  {
    title: 'סיבוב',
    body: 'התמונה עשויה להיות מסובבת ביחס ללוח. לחצו על כפתור הסיבוב כדי לסובב אותה.',
    focus: 'rotate',
    action: 'rotate',
  },
  {
    title: 'רמז',
    body: 'נתקעתם? לחיצה על הנורה חושפת את הצבעים, ולחיצה שנייה מסמנת את התא הנכון. לחצו עליה פעם אחת.',
    focus: 'hint',
    action: 'hint',
  },
  {
    title: 'נסו בעצמכם',
    body: 'התא הנכון מסומן במסגרת ירוקה. לחצו עליו! טעויות נספרות כניסיונות, ופגיעה מעבירה לשלב הבא.',
    focus: 'board',
    action: 'tap',
  },
];

export function useTutorial() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
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
  }, []);

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
