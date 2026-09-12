// Language mapping for UI and voice locales
export const LANGUAGES: Record<string, { label: string; voiceLocale: string }> = {
  en: { label: "English", voiceLocale: "en-IN" },
  hi: { label: "हिंदी", voiceLocale: "hi-IN" },
  es: { label: "Español", voiceLocale: "es-ES" },
  fr: { label: "Français", voiceLocale: "fr-FR" },
};

/**
 * Returns the voice locale for the given language code. Defaults to English locale.
 */
export function getVoiceLocale(lang: string): string {
  const entry = LANGUAGES[lang];
  return entry?.voiceLocale ?? LANGUAGES.en.voiceLocale;
}
