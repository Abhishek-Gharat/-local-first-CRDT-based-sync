import { common, createLowlight } from "lowlight";

/**
 * Shared lowlight instance configured with common languages:
 * typescript, javascript, python, html, css, json, bash, c, cpp, csharp,
 * go, java, markdown, php, rust, sql, xml, yaml, etc.
 */
export const lowlight = createLowlight(common);

/** Curated display list of popular languages for the language selector. */
export const POPULAR_LANGUAGES = [
  { label: "Auto", value: "" },
  { label: "TypeScript", value: "typescript" },
  { label: "JavaScript", value: "javascript" },
  { label: "Python", value: "python" },
  { label: "HTML", value: "html" },
  { label: "CSS", value: "css" },
  { label: "JSON", value: "json" },
  { label: "Rust", value: "rust" },
  { label: "Go", value: "go" },
  { label: "SQL", value: "sql" },
  { label: "Bash / Shell", value: "bash" },
  { label: "Markdown", value: "markdown" },
  { label: "C++", value: "cpp" },
  { label: "Java", value: "java" },
  { label: "YAML", value: "yaml" },
] as const;
