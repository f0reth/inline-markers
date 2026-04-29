import { CommentTagKey } from "./types";

export interface DefaultEntry {
  color: string;
  gutterIcon: string;
  showLine: boolean;
  enabled: boolean;
}

export const DEFAULTS: Record<CommentTagKey, DefaultEntry> = {
  todo: { color: "#FF8C00", gutterIcon: "images/todo.svg", showLine: true, enabled: true },
  fixme: { color: "#FFB6C1", gutterIcon: "images/error.svg", showLine: true, enabled: true },
  important: {
    color: "#FF2D00",
    gutterIcon: "images/important.svg",
    showLine: true,
    enabled: true,
  },
  question: { color: "#3498DB", gutterIcon: "images/question.svg", showLine: true, enabled: true },
  highlight: {
    color: "#98C379",
    gutterIcon: "images/highlight.svg",
    showLine: true,
    enabled: true,
  },
};
