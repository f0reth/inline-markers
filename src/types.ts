export type CommentTagKey = "todo" | "fixme" | "important" | "question" | "highlight";

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
