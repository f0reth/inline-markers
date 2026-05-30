export type CommentTagKey = "todo" | "fixme" | "important" | "question" | "highlight";

export interface Bookmark {
  uri: string;
  line: number;
  label?: string;
}

// A user-configurable comment tag. `tag` is the literal token to match (e.g. "TODO",
// "FIXME", "!", "?", "*"); the remaining fields control its decoration styling.
export interface TagConfig {
  tag: string;
  color: string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}

export interface LocalTagConfig {
  pattern?: RegExp;
  color: string;
  gutterIcon?: string;
  enabled?: boolean;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}
