export type CommentTagKey = "todo" | "fixme" | "important" | "question" | "highlight";

export interface Bookmark {
  uri: string;
  line: number;
  label?: string;
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
