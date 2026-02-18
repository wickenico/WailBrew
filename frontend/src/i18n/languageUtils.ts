const supportedLanguages = [
  "en",
  "de",
  "fr",
  "tr",
  "zhCN",
  "zhTW",
  "pt_BR",
  "ru",
  "ko",
  "he",
  "es",
] as const;

type SupportedLanguage = (typeof supportedLanguages)[number];

const explicitMappings: Record<string, SupportedLanguage> = {
  en: "en",
  "en-US": "en",
  "en-GB": "en",
  de: "de",
  "de-DE": "de",
  fr: "fr",
  "fr-FR": "fr",
  tr: "tr",
  "tr-TR": "tr",
  "zh": "zhCN",
  "zh-CN": "zhCN",
  "zh_CN": "zhCN",
  zhCN: "zhCN",
  "zh-TW": "zhTW",
  "zh_TW": "zhTW",
  zhTW: "zhTW",
  "pt": "pt_BR",
  "pt-BR": "pt_BR",
  "pt_BR": "pt_BR",
  ru: "ru",
  "ru-RU": "ru",
  ko: "ko",
  "ko-KR": "ko",
  he: "he",
  "he-IL": "he",
  iw: "he",
  "iw-IL": "he",
  "iw_IL": "he",
  es: "es",
  "es-ES": "es", 
  "es-CO": "es",
};

export function mapToSupportedLanguage(
  lng?: string | null,
): SupportedLanguage {
  if (!lng) {
    return "en";
  }

  const direct = explicitMappings[lng];
  if (direct) {
    return direct;
  }

  const normalized = lng.replace("-", "_");
  const normalizedMapping = explicitMappings[normalized];
  if (normalizedMapping) {
    return normalizedMapping;
  }

  const condensed = normalized.replace("_", "");
  const condensedMapping = explicitMappings[condensed];
  if (condensedMapping) {
    return condensedMapping;
  }

  const lowerNormalized = normalized.toLowerCase();

  const exactMatch = supportedLanguages.find(
    (lang) => lang.toLowerCase() === lowerNormalized,
  );
  if (exactMatch) {
    return exactMatch;
  }

  const base = lowerNormalized.split("_")[0];
  const baseMatch = supportedLanguages.find((lang) =>
    lang.toLowerCase().startsWith(base),
  );

  return baseMatch ?? "en";
}
