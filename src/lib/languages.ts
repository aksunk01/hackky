export type Language =
  | "python"
  | "javascript"
  | "cpp"
  | "c"
  | "java"
  | "csharp";

/** The id doubles as the Monaco language id and the markdown fence label. */
export const LANGUAGES: { id: Language; label: string }[] = [
  { id: "python", label: "Python 3" },
  { id: "javascript", label: "JavaScript" },
  { id: "cpp", label: "C++" },
  { id: "c", label: "C" },
  { id: "java", label: "Java" },
  { id: "csharp", label: "C#" },
];

export const DEFAULT_LANGUAGE: Language = "python";

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((lang) => lang.id === value);
}

export function languageLabel(id: Language): string {
  return LANGUAGES.find((lang) => lang.id === id)?.label ?? id;
}
