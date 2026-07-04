export const AVAILABLE_LANGUAGES = [
  { code: "af", name: "Afrikaans" },
  { code: "sq", name: "Albanian" },
  { code: "am", name: "Amharic" },
  { code: "ar", name: "Arabic" },
  { code: "hy", name: "Armenian" },
  { code: "az", name: "Azerbaijani" },
  { code: "eu", name: "Basque" },
  { code: "be", name: "Belarusian" },
  { code: "bn", name: "Bengali" },
  { code: "bs", name: "Bosnian" },
  { code: "bg", name: "Bulgarian" },
  { code: "my", name: "Burmese" },
  { code: "ca", name: "Catalan" },
  { code: "zh", name: "Chinese" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
  { code: "hr", name: "Croatian" },
  { code: "cs", name: "Czech" },
  { code: "da", name: "Danish" },
  { code: "nl", name: "Dutch" },
  { code: "en", name: "English" },
  { code: "et", name: "Estonian" },
  { code: "tl", name: "Filipino" },
  { code: "fi", name: "Finnish" },
  { code: "fr", name: "French" },
  { code: "gl", name: "Galician" },
  { code: "ka", name: "Georgian" },
  { code: "de", name: "German" },
  { code: "el", name: "Greek" },
  { code: "gu", name: "Gujarati" },
  { code: "he", name: "Hebrew" },
  { code: "hi", name: "Hindi" },
  { code: "hu", name: "Hungarian" },
  { code: "is", name: "Icelandic" },
  { code: "id", name: "Indonesian" },
  { code: "ga", name: "Irish" },
  { code: "it", name: "Italian" },
  { code: "ja", name: "Japanese" },
  { code: "kn", name: "Kannada" },
  { code: "kk", name: "Kazakh" },
  { code: "km", name: "Khmer" },
  { code: "ko", name: "Korean" },
  { code: "lo", name: "Lao" },
  { code: "lv", name: "Latvian" },
  { code: "lt", name: "Lithuanian" },
  { code: "mk", name: "Macedonian" },
  { code: "ms", name: "Malay" },
  { code: "ml", name: "Malayalam" },
  { code: "mt", name: "Maltese" },
  { code: "mr", name: "Marathi" },
  { code: "mn", name: "Mongolian" },
  { code: "ne", name: "Nepali" },
  { code: "no", name: "Norwegian" },
  { code: "pa", name: "Punjabi" },
  { code: "fa", name: "Persian" },
  { code: "pl", name: "Polish" },
  { code: "pt", name: "Portuguese (Portugal)" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "ro", name: "Romanian" },
  { code: "ru", name: "Russian" },
  { code: "sr", name: "Serbian" },
  { code: "si", name: "Sinhala" },
  { code: "sk", name: "Slovak" },
  { code: "sl", name: "Slovenian" },
  { code: "es", name: "Spanish" },
  { code: "es-419", name: "Spanish (Latin America)" },
  { code: "sw", name: "Swahili" },
  { code: "sv", name: "Swedish" },
  { code: "ta", name: "Tamil" },
  { code: "te", name: "Telugu" },
  { code: "th", name: "Thai" },
  { code: "tr", name: "Turkish" },
  { code: "uk", name: "Ukrainian" },
  { code: "ur", name: "Urdu" },
  { code: "uz", name: "Uzbek" },
  { code: "vi", name: "Vietnamese" },
  { code: "cy", name: "Welsh" },
  { code: "zu", name: "Zulu" },
];

const LanguageCodeAliases: Record<string, string> = {
  "pt-pt": "pt",
  "pt_br": "pt-BR",
  "pt-br": "pt-BR",
  "br": "pt-BR",
  "pob": "pt-BR",
  "eng": "en",
  "spa": "es",
  "es-419": "es-419",
  "es_419": "es-419",
  "es-la": "es-419",
  "es-lat": "es-419",
  "fra": "fr",
  "fre": "fr",
  "deu": "de",
  "ger": "de",
  "ita": "it",
  "por": "pt",
  "rus": "ru",
  "jpn": "ja",
  "kor": "ko",
  "zho": "zh",
  "chi": "zh",
  "zht": "zh-TW",
  "zhs": "zh-CN",
  "chi-tw": "zh-TW",
  "chi-cn": "zh-CN",
  "zh-tw": "zh-TW",
  "zh_tw": "zh-TW",
  "zh-cn": "zh-CN",
  "zh_cn": "zh-CN",
  "ara": "ar",
  "hin": "hi",
  "nld": "nl",
  "dut": "nl",
  "pol": "pl",
  "swe": "sv",
  "nor": "no",
  "dan": "da",
  "fin": "fi",
  "tur": "tr",
  "ell": "el",
  "gre": "el",
  "heb": "he",
  "tha": "th",
  "vie": "vi",
  "ind": "id",
  "msa": "ms",
  "may": "ms",
  "ces": "cs",
  "cze": "cs",
  "hun": "hu",
  "ron": "ro",
  "rum": "ro",
  "ukr": "uk",
  "bul": "bg",
  "hrv": "hr",
  "srp": "sr",
  "slk": "sk",
  "slo": "sk",
  "slv": "sl",
  "cat": "ca",
  "alb": "sq",
  "sqi": "sq",
  "bos": "bs",
  "mac": "mk",
  "mkd": "mk",
  "lav": "lv",
  "lit": "lt",
  "est": "et",
  "isl": "is",
  "ice": "is",
  "glg": "gl",
  "baq": "eu",
  "eus": "eu",
  "wel": "cy",
  "cym": "cy",
  "gle": "ga",
  "ben": "bn",
  "tam": "ta",
  "tel": "te",
  "mal": "ml",
  "kan": "kn",
  "mar": "mr",
  "pan": "pa",
  "guj": "gu",
  "urd": "ur",
  "fas": "fa",
  "per": "fa",
  "amh": "am",
  "swa": "sw",
  "zul": "zu",
  "afr": "af",
  "mlt": "mt",
  "bel": "be",
  "geo": "ka",
  "kat": "ka",
  "arm": "hy",
  "hye": "hy",
  "aze": "az",
  "kaz": "kk",
  "uzb": "uz",
  "mon": "mn",
  "khm": "km",
  "lao": "lo",
  "mya": "my",
  "bur": "my",
  "sin": "si",
  "nep": "ne",
  "tgl": "tl",
  "fil": "tl",
};

const LanguageNameAliases: Record<string, string> = {
  "afrikaans": "af",
  "albanian": "sq",
  "amharic": "am",
  "arabic": "ar",
  "armenian": "hy",
  "azerbaijani": "az",
  "basque": "eu",
  "belarusian": "be",
  "bengali": "bn",
  "bosnian": "bs",
  "bulgarian": "bg",
  "burmese": "my",
  "catalan": "ca",
  "chinese": "zh",
  "mandarin": "zh",
  "croatian": "hr",
  "czech": "cs",
  "danish": "da",
  "dutch": "nl",
  "english": "en",
  "estonian": "et",
  "filipino": "tl",
  "finnish": "fi",
  "french": "fr",
  "galician": "gl",
  "georgian": "ka",
  "german": "de",
  "greek": "el",
  "gujarati": "gu",
  "hebrew": "he",
  "hindi": "hi",
  "hungarian": "hu",
  "icelandic": "is",
  "indonesian": "id",
  "irish": "ga",
  "italian": "it",
  "japanese": "ja",
  "kannada": "kn",
  "kazakh": "kk",
  "khmer": "km",
  "korean": "ko",
  "lao": "lo",
  "latvian": "lv",
  "lithuanian": "lt",
  "macedonian": "mk",
  "malay": "ms",
  "malayalam": "ml",
  "maltese": "mt",
  "marathi": "mr",
  "mongolian": "mn",
  "nepali": "ne",
  "norwegian": "no",
  "persian": "fa",
  "polish": "pl",
  "punjabi": "pa",
  "romanian": "ro",
  "russian": "ru",
  "serbian": "sr",
  "sinhala": "si",
  "slovak": "sk",
  "slovenian": "sl",
  "swahili": "sw",
  "swedish": "sv",
  "tamil": "ta",
  "telugu": "te",
  "thai": "th",
  "turkish": "tr",
  "ukrainian": "uk",
  "urdu": "ur",
  "uzbek": "uz",
  "vietnamese": "vi",
  "welsh": "cy",
  "zulu": "zu",
};

export function normalizeLanguageCode(language: string | null | undefined): string | null {
  if (!language) return null;
  const raw = language.trim().replace(/_/g, '-').toLowerCase();
  if (!raw) return null;

  const tokenized = raw
    .replace(/-/g, ' ')
    .replace(/\./g, ' ')
    .replace(/\//g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const containsAny = (...values: string[]) => values.some(value => tokenized.includes(value));

  if (containsAny("portuguese", "portugues")) {
    if (containsAny("brazil", "brasil", "brazilian", "brasileiro", "pt br", "ptbr", "pob", "(br)")) {
      return "pt-br";
    }
    if (containsAny("portugal", "european", "europeu", "iberian", "pt pt", "ptpt")) {
      return "pt";
    }
    return "pt";
  }

  if (containsAny("spanish", "espanol", "castellano")) {
    if (containsAny("latin", "latino", "latinoamerica", "latinoamericano", "lat am", "latam", "es 419", "es419", "(419)")) {
      return "es-419";
    }
    return "es";
  }

  if (LanguageCodeAliases[raw]) {
    return LanguageCodeAliases[raw].replace(/_/g, '-').toLowerCase();
  }

  if (LanguageNameAliases[tokenized]) {
    return LanguageNameAliases[tokenized];
  }

  const aliasEntries = Object.entries(LanguageNameAliases).sort((a, b) => b[0].length - a[0].length);
  for (const [name, code] of aliasEntries) {
    if (
      tokenized === name ||
      tokenized.startsWith(name + ' ') ||
      tokenized.endsWith(' ' + name) ||
      tokenized.includes(' ' + name + ' ')
    ) {
      return code;
    }
  }

  const parts = raw.split('-');
  const primary = parts[0];
  const primaryAlias = LanguageCodeAliases[primary]?.replace(/_/g, '-')?.toLowerCase();
  const suffix = parts.slice(1).join('-');

  if (!suffix) {
    return primaryAlias || primary;
  } else if (primaryAlias && !primaryAlias.includes('-')) {
    return `${primaryAlias}-${suffix}`;
  } else {
    return primaryAlias || `${primary}-${suffix}`;
  }
}

export function languageMatchesPreference(trackLanguage: string | null | undefined, targetLanguage: string | null | undefined): boolean {
  const normalizedTrack = normalizeLanguageCode(trackLanguage);
  const normalizedTarget = normalizeLanguageCode(targetLanguage);
  
  if (!normalizedTrack || !normalizedTarget) return false;
  if (normalizedTrack === normalizedTarget) return true;

  const trackPrimary = normalizedTrack.split('-')[0];
  const targetPrimary = normalizedTarget.split('-')[0];
  return trackPrimary === targetPrimary;
}

export function getLanguageName(code: string): string {
  const normalized = normalizeLanguageCode(code);
  const found = AVAILABLE_LANGUAGES.find(l => normalizeLanguageCode(l.code) === normalized);
  return found?.name || code;
}
