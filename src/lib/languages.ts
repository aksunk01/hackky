export type Language =
  | "python"
  | "javascript"
  | "cpp"
  | "c"
  | "java"
  | "csharp";

/**
 * The id doubles as the Monaco language id and the markdown fence label.
 * `color` is each language's familiar brand color, used as a small identifying
 * dot in the picker rather than a wall of same-weight text.
 */
export const LANGUAGES: { id: Language; label: string; color: string }[] = [
  { id: "python", label: "Python 3", color: "#3776AB" },
  { id: "javascript", label: "JavaScript", color: "#F0DB4F" },
  { id: "cpp", label: "C++", color: "#659AD2" },
  { id: "c", label: "C", color: "#A8B9CC" },
  { id: "java", label: "Java", color: "#EA2D2E" },
  { id: "csharp", label: "C#", color: "#9B4F96" },
];

export const DEFAULT_LANGUAGE: Language = "python";

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((lang) => lang.id === value);
}

export function languageLabel(id: Language): string {
  return LANGUAGES.find((lang) => lang.id === id)?.label ?? id;
}
