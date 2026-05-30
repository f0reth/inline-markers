import { TagConfig } from "./types";

// Fallback defaults for `inline-markers.comments.tags` — mirrors the package.json default.
// Order defines match priority (earlier wins). Word tags (TODO, FIXME) also appear in the
// sidebar tree; symbol tags (!, ?, *) are decoration-only.
export const DEFAULT_TAGS: TagConfig[] = [
  { tag: "TODO", color: "#FF8C00" },
  { tag: "FIXME", color: "#FFB6C1" },
  { tag: "!", color: "#FF2D00" },
  { tag: "?", color: "#3498DB" },
  { tag: "*", color: "#98C379" },
];

// Fallback for `inline-markers.comments.exclude` — glob patterns where highlighting and
// scanning are disabled.
export const DEFAULT_EXCLUDE: string[] = ["**/*.md", "**/*.mdx"];
