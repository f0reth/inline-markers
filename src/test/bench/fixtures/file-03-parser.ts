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

export class Lexer {
  private pos = 0;
  private line = 1;
  private column = 1;

  constructor(private readonly source: string) {}

  tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.source.length) {
      const token = this.nextToken();
      if (token.type !== "whitespace") {
        tokens.push(token);
      }
    }
    tokens.push({
      type: "eof",
      value: "",
      start: this.pos,
      end: this.pos,
      line: this.line,
      column: this.column,
    });
    return tokens;
  }

  private nextToken(): Token {
    const start = this.pos;
    const startLine = this.line;
    const startCol = this.column;
    const ch = this.source[this.pos];

    if (/\s/.test(ch)) return this.scanWhitespace(start, startLine, startCol);
    if (/[0-9]/.test(ch)) return this.scanNumber(start, startLine, startCol);
    if (ch === '"' || ch === "'") return this.scanString(start, startLine, startCol);
    if (/[a-zA-Z_$]/.test(ch)) return this.scanIdentifier(start, startLine, startCol);
    if (ch === "/" && this.source[this.pos + 1] === "/")
      return this.scanLineComment(start, startLine, startCol);
    return this.scanOperator(start, startLine, startCol);
  }

  private scanWhitespace(start: number, line: number, column: number): Token {
    while (this.pos < this.source.length && /\s/.test(this.source[this.pos])) {
      if (this.source[this.pos] === "\n") {
        this.line++;
        this.column = 1;
      } else {
        this.column++;
      }
      this.pos++;
    }
    return {
      type: "whitespace",
      value: this.source.slice(start, this.pos),
      start,
      end: this.pos,
      line,
      column,
    };
  }

  private scanNumber(start: number, line: number, column: number): Token {
    // FIXME: does not handle hex literals (0x...) or scientific notation (1e10)
    while (this.pos < this.source.length && /[0-9.]/.test(this.source[this.pos])) {
      this.pos++;
      this.column++;
    }
    return {
      type: "number",
      value: this.source.slice(start, this.pos),
      start,
      end: this.pos,
      line,
      column,
    };
  }

  private scanString(start: number, line: number, column: number): Token {
    const quote = this.source[this.pos];
    this.pos++;
    this.column++;
    // HACK: naive implementation, does not handle escaped quotes
    while (this.pos < this.source.length && this.source[this.pos] !== quote) {
      this.pos++;
      this.column++;
    }
    if (this.pos < this.source.length) {
      this.pos++;
      this.column++;
    }
    return {
      type: "string",
      value: this.source.slice(start, this.pos),
      start,
      end: this.pos,
      line,
      column,
    };
  }

  private scanIdentifier(start: number, line: number, column: number): Token {
    while (this.pos < this.source.length && /[a-zA-Z0-9_$]/.test(this.source[this.pos])) {
      this.pos++;
      this.column++;
    }
    const value = this.source.slice(start, this.pos);
    const type: TokenType = KEYWORDS.has(value) ? "keyword" : "identifier";
    return { type, value, start, end: this.pos, line, column };
  }

  private scanLineComment(start: number, line: number, column: number): Token {
    while (this.pos < this.source.length && this.source[this.pos] !== "\n") {
      this.pos++;
      this.column++;
    }
    return {
      type: "comment",
      value: this.source.slice(start, this.pos),
      start,
      end: this.pos,
      line,
      column,
    };
  }

  private scanOperator(start: number, line: number, column: number): Token {
    this.pos++;
    this.column++;
    return {
      type: "operator",
      value: this.source.slice(start, this.pos),
      start,
      end: this.pos,
      line,
      column,
    };
  }
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

export class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  // TODO: implement full expression parsing
  parseExpression(): Expression | null {
    const token = this.tokens[this.pos];
    if (!token || token.type === "eof") return null;

    if (token.type === "number") {
      this.pos++;
      return {
        type: "NumberLiteral",
        value: parseFloat(token.value),
        start: token.start,
        end: token.end,
      };
    }

    if (token.type === "string") {
      this.pos++;
      return {
        type: "StringLiteral",
        value: token.value.slice(1, -1),
        start: token.start,
        end: token.end,
      };
    }

    return null;
  }
}
