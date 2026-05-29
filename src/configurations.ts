import { CommentTagKey } from "./types";

export interface DefaultEntry {
  color: string;
  gutterIcon: string;
  enabled: boolean;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
  underline: boolean;
}

export const DEFAULTS: Record<CommentTagKey, DefaultEntry> = {
  todo: {
    color: "#FF8C00",
    gutterIcon: "images/todo.svg",
    enabled: true,
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
  },
  fixme: {
    color: "#FFB6C1",
    gutterIcon: "images/error.svg",
    enabled: true,
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
  },
  important: {
    color: "#FF2D00",
    gutterIcon: "images/important.svg",
    enabled: true,
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
  },
  question: {
    color: "#3498DB",
    gutterIcon: "images/question.svg",
    enabled: true,
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
  },
  highlight: {
    color: "#98C379",
    gutterIcon: "images/highlight.svg",
    enabled: true,
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
  },
};
