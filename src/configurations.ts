import { CommentTagKey } from "./types";

export interface DefaultEntry {
  color: string;
  gutterIcon: string;
  enabled: boolean;
}

export const DEFAULTS: Record<CommentTagKey, DefaultEntry> = {
  todo: { color: "#FF8C00", gutterIcon: "images/todo.svg", enabled: true },
  fixme: { color: "#FFB6C1", gutterIcon: "images/error.svg", enabled: true },
  important: { color: "#FF2D00", gutterIcon: "images/important.svg", enabled: true },
  question: { color: "#3498DB", gutterIcon: "images/question.svg", enabled: true },
  highlight: { color: "#98C379", gutterIcon: "images/highlight.svg", enabled: true },
};
