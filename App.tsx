import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Rubik_400Regular } from '@expo-google-fonts/rubik/400Regular';
import { Rubik_500Medium } from '@expo-google-fonts/rubik/500Medium';
import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GameScreen, GameSession } from '@/components/GameScreen';
import { I18nProvider, loadTranslations, Translations } from '@/lib/i18n';
import { ReducedMotionContext } from '@/lib/motion';
import {
  AppMessage,
  SESSION_START_TIMEOUT_MS,
  closeBridge,
  hasBridge,
  send,
  subscribe,
  validateSessionStart,
} from '@/lib/bridge';
import { GAME_ID, parseLevelId, standaloneLevelIds } from '@/lib/levels';
import Colors from '@/constants/colors';

type Phase = 'loading' | 'waiting' | 'playing' | 'ended';

function prefersReducedMotion(): boolean {
  if (Platform.OS !== 'web' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function standaloneSession(): GameSession {
  const levelIds = standaloneLevelIds();
  return {
    levelIds,
    levelNumbers: levelIds.map((id) => parseLevelId(id)!),
    reducedMotion: prefersReducedMotion(),
    tutorialSeen: null, // fall back to the locally stored flag
    standalone: true,
  };
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Rubik_400Regular, Rubik_500Medium, Rubik_700Bold });
  const fontsReady = fontsLoaded || !!fontError;
  const [translations, setTranslations] = useState<Translations | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [session, setSession] = useState<GameSession | null>(null);
  const [paused, setPaused] = useState(false);
  const started = useRef(false);

  const end = useCallback(() => setPhase('ended'), []);

  // 1. Load copy from ./translations.json (BR-12, BR-13, BR-15).
  useEffect(() => {
    loadTranslations()
      .then((tr) => {
        if (Platform.OS === 'web') {
          // Only `lang` goes on <html>: setting dir there would make
          // react-native-web mirror every row, including the tap grid over the
          // board. Direction is applied to text from tr.dir instead (BR-15).
          document.documentElement.lang = tr.locale;
          document.title = tr.keys.title;
        }
        setTranslations(tr);
      })
      .catch((e: unknown) => {
        send.error('translations_unavailable', e instanceof Error ? e.message : String(e));
        setPhase('ended');
      });
  }, []);

  // 2. Once copy and fonts are ready: announce, then wait for session_start.
  useEffect(() => {
    if (!translations || !fontsReady) return;

    const onMessage = (msg: AppMessage) => {
      switch (msg.type) {
        case 'session_start': {
          if (started.current) return;
          started.current = true;
          const invalid = validateSessionStart(msg.data);
          if (invalid) {
            send.error(invalid, 'session_start rejected');
            setPhase('ended');
            return;
          }
          const data = msg.data;
          if (data.expectedLocale !== translations.locale) {
            // BR-14: a mis-authored URL template loaded the wrong language build.
            send.error('locale_mismatch', `expected ${data.expectedLocale}, loaded ${translations.locale}`);
            setPhase('ended');
            return;
          }
          const levelNumbers = data.levelIds.map(parseLevelId);
          const bad = data.levelIds.filter((_, i) => levelNumbers[i] === null);
          if (bad.length > 0) {
            send.error('unknown_level', `unknown levelIds: ${bad.join(', ')}`);
            setPhase('ended');
            return;
          }
          setSession({
            levelIds: data.levelIds,
            levelNumbers: levelNumbers as number[],
            reducedMotion: !!data.reducedMotion,
            tutorialSeen: !!data.tutorialSeen,
            standalone: false,
          });
          setPhase('playing');
          return;
        }
        case 'pause':
          setPaused(true);
          return;
        case 'resume':
          setPaused(false);
          return;
        case 'abort':
          closeBridge(); // post nothing further
          setPhase('ended');
          return;
      }
    };

    const unsubscribe = subscribe(onMessage);
    send.gameReady(GAME_ID, translations.locale);

    if (!hasBridge()) {
      // BR-09: standalone QA mode with defaults.
      started.current = true;
      setSession(standaloneSession());
      setPhase('playing');
      return unsubscribe;
    }

    setPhase('waiting');
    const timer = setTimeout(() => {
      if (started.current) return;
      started.current = true;
      send.error('session_start_timeout', `no session_start within ${SESSION_START_TIMEOUT_MS} ms`);
      setPhase('ended');
    }, SESSION_START_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [translations, fontsReady]);

  const content =
    phase === 'playing' && translations && session ? (
      <I18nProvider translations={translations}>
        <ReducedMotionContext.Provider value={session.reducedMotion}>
          <GameScreen session={session} paused={paused} onEnded={end} />
        </ReducedMotionContext.Provider>
      </I18nProvider>
    ) : (
      // Loading, waiting for the app, or ended: an empty screen, never raw text.
      <View style={styles.blank} />
    );

  return (
    <SafeAreaProvider>
      <ErrorBoundary>{content}</ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  blank: { flex: 1, backgroundColor: Colors.background },
});
