export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

export type TokenType =
  | "identifier"
  | "number"
  | "string"
  | "operator"
  | "punctuation"
  | "keyword"
  | "comment"
  | "whitespace"
  | "eof";

const KEYWORDS = new Set([
  "if",
  "else",
  "for",
  "while",
  "return",
  "const",
  "let",
  "var",
  "function",
  "class",
  "import",
  "export",
]);

export type Lexer = {
  tokenize(): Token[];
};

export function createLexer(source: string): Lexer {
  let pos = 0;
  let line = 1;
  let column = 1;

  function scanWhitespace(start: number, startLine: number, startCol: number): Token {
    while (pos < source.length && /\s/.test(source[pos])) {
      if (source[pos] === "\n") {
        line++;
        column = 1;
      } else {
        column++;
      }
      pos++;
    }
    return {
      type: "whitespace",
      value: source.slice(start, pos),
      start,
      end: pos,
      line: startLine,
      column: startCol,
    };
  }

  function scanNumber(start: number, startLine: number, startCol: number): Token {
    // FIXME: does not handle hex literals (0x...) or scientific notation (1e10)
    while (pos < source.length && /[0-9.]/.test(source[pos])) {
      pos++;
      column++;
    }
    return {
      type: "number",
      value: source.slice(start, pos),
      start,
      end: pos,
      line: startLine,
      column: startCol,
    };
  }

  function scanString(start: number, startLine: number, startCol: number): Token {
    const quote = source[pos];
    pos++;
    column++;
    // HACK: naive implementation, does not handle escaped quotes
    while (pos < source.length && source[pos] !== quote) {
      pos++;
      column++;
    }
    if (pos < source.length) {
      pos++;
      column++;
    }
    return {
      type: "string",
      value: source.slice(start, pos),
      start,
      end: pos,
      line: startLine,
      column: startCol,
    };
  }

  function scanIdentifier(start: number, startLine: number, startCol: number): Token {
    while (pos < source.length && /[a-zA-Z0-9_$]/.test(source[pos])) {
      pos++;
      column++;
    }
    const value = source.slice(start, pos);
    const type: TokenType = KEYWORDS.has(value) ? "keyword" : "identifier";
    return { type, value, start, end: pos, line: startLine, column: startCol };
  }

  function scanLineComment(start: number, startLine: number, startCol: number): Token {
    while (pos < source.length && source[pos] !== "\n") {
      pos++;
      column++;
    }
    return {
      type: "comment",
      value: source.slice(start, pos),
      start,
      end: pos,
      line: startLine,
      column: startCol,
    };
  }

  function scanOperator(start: number, startLine: number, startCol: number): Token {
    pos++;
    column++;
    return {
      type: "operator",
      value: source.slice(start, pos),
      start,
      end: pos,
      line: startLine,
      column: startCol,
    };
  }

  function nextToken(): Token {
    const start = pos;
    const startLine = line;
    const startCol = column;
    const ch = source[pos];

    if (/\s/.test(ch)) return scanWhitespace(start, startLine, startCol);
    if (/[0-9]/.test(ch)) return scanNumber(start, startLine, startCol);
    if (ch === '"' || ch === "'") return scanString(start, startLine, startCol);
    if (/[a-zA-Z_$]/.test(ch)) return scanIdentifier(start, startLine, startCol);
    if (ch === "/" && source[pos + 1] === "/") return scanLineComment(start, startLine, startCol);
    return scanOperator(start, startLine, startCol);
  }

  function tokenize(): Token[] {
    const tokens: Token[] = [];
    while (pos < source.length) {
      const token = nextToken();
      if (token.type !== "whitespace") {
        tokens.push(token);
      }
    }
    tokens.push({ type: "eof", value: "", start: pos, end: pos, line, column });
    return tokens;
  }

  return { tokenize };
}

export interface AstNode {
  type: string;
  start: number;
  end: number;
}

export interface NumberLiteral extends AstNode {
  type: "NumberLiteral";
  value: number;
}

export interface StringLiteral extends AstNode {
  type: "StringLiteral";
  value: string;
}

// FIXME: AstNode union is not exhaustive — add all node types before using in a type-guard
export type Expression = NumberLiteral | StringLiteral;

export type Parser = {
  // TODO: implement full expression parsing
  parseExpression(): Expression | null;
};

export function createParser(tokens: Token[]): Parser {
  let pos = 0;

  function parseExpression(): Expression | null {
    const token = tokens[pos];
    if (!token || token.type === "eof") return null;

    if (token.type === "number") {
      pos++;
      return {
        type: "NumberLiteral",
        value: parseFloat(token.value),
        start: token.start,
        end: token.end,
      };
    }

    if (token.type === "string") {
      pos++;
      return {
        type: "StringLiteral",
        value: token.value.slice(1, -1),
        start: token.start,
        end: token.end,
      };
    }

    return null;
  }

  return { parseExpression };
}
