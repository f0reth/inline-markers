export type CommentTagKey = "todo" | "fixme" | "important" | "question" | "highlight";

export interface LocalTagConfig {
  pattern: RegExp;
  color: string;
  gutterIcon?: string;
  showLine?: boolean;
  enabled?: boolean;
}

export interface HasValue {
  value: string;
}
