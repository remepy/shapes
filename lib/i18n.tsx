import React, { createContext, useContext } from 'react';

/**
 * Copy is loaded at runtime from ./translations.json next to the page
 * (bridge spec §4, BR-12/13/15). There are no hard-coded fallback strings:
 * if the file is missing, unparseable or incomplete, loading fails and the
 * game reports `translations_unavailable` instead of rendering anything.
 */

export const REQUIRED_KEYS = [
  'title',
  'round_label',
  'goal_caption',
  'attempts',
  'victory_title',
  'next_round',
  'exit_activity',
  'play_again',
  'a11y_exit',
  'a11y_music',
  'a11y_tutorial',
  'a11y_hint',
  'a11y_rotate',
  'tutorial_skip',
  'tutorial_next',
  'tutorial_action_rotate',
  'tutorial_action_hint',
  'tutorial_action_tap',
  'tutorial_goal_title',
  'tutorial_goal_body',
  'tutorial_board_title',
  'tutorial_board_body',
  'tutorial_rotate_title',
  'tutorial_rotate_body',
  'tutorial_hint_title',
  'tutorial_hint_body',
  'tutorial_colors_title',
  'tutorial_colors_body',
  'tutorial_try_title',
  'tutorial_try_body',
] as const;

export type TranslationKey = (typeof REQUIRED_KEYS)[number];
export type TextDirection = 'rtl' | 'ltr';

export interface Translations {
  locale: string;
  dir: TextDirection;
  keys: Record<TranslationKey, string>;
}

export class TranslationsError extends Error {}

/** URL of translations.json relative to the current page. */
export function translationsUrl(href: string): string {
  const url = new URL(href);
  // Treat ".../he" like ".../he/" so the file still resolves next to the page.
  const last = url.pathname.split('/').pop() ?? '';
  if (last !== '' && !last.includes('.')) url.pathname += '/';
  return new URL('translations.json', url).toString();
}

export function parseTranslations(raw: unknown): Translations {
  if (!raw || typeof raw !== 'object') throw new TranslationsError('not an object');
  const { locale, dir, keys } = raw as Record<string, unknown>;
  if (typeof locale !== 'string' || locale.length === 0) throw new TranslationsError('bad locale');
  if (dir !== 'rtl' && dir !== 'ltr') throw new TranslationsError('bad dir');
  if (!keys || typeof keys !== 'object') throw new TranslationsError('bad keys');
  const missing = REQUIRED_KEYS.filter(
    (k) => typeof (keys as Record<string, unknown>)[k] !== 'string',
  );
  if (missing.length > 0) throw new TranslationsError(`missing keys: ${missing.join(', ')}`);
  return { locale, dir, keys: keys as Record<TranslationKey, string> };
}

export async function loadTranslations(): Promise<Translations> {
  const res = await fetch(translationsUrl(window.location.href), { cache: 'no-cache' });
  if (!res.ok) throw new TranslationsError(`http ${res.status}`);
  return parseTranslations(await res.json());
}

interface I18n {
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  dir: TextDirection;
  isRTL: boolean;
  locale: string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({
  translations,
  children,
}: {
  translations: Translations;
  children: React.ReactNode;
}) {
  const value: I18n = {
    t: (key, vars) =>
      translations.keys[key].replace(/\{(\w+)\}/g, (m, name) =>
        vars && name in vars ? String(vars[name]) : m,
      ),
    dir: translations.dir,
    isRTL: translations.dir === 'rtl',
    locale: translations.locale,
  };
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n outside I18nProvider');
  return ctx;
}
