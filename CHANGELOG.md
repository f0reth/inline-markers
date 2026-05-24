# Change Log

## [0.0.5] - 2026-05-24

### Added

- **Performance benchmark suite**: Benchmarks for comments `analyzeDocument`, gutter `setDecorations`, diagnostic-line, all-features integration, and extension activation time.

### Performance

- **Comments module**: Cache `activeKeys` and use regex index for `tagRange` to reduce redundant lookups.

### Fixed

- **Diagnostic-line**: Remove double disposal and simplify `categorizedOpts` initialization.
- **Type safety**: Replace unsafe type assertion with explicit object literal.

### Internal

- Simplify `updateSettingsAndRecreate` with loop and consolidate gutter update logic.
- Remove unused `HasValue` interface and `showLine` field.
- Unify gutter `setDecorations` with severity pair loop.

## [0.0.4] - 2026-05-24

### Fixed

- **Single-char tag false positives**: Added lookahead `(?=\s|$)` to `!`, `?`, and `*` comment patterns so they no longer match when immediately followed by non-whitespace (e.g., glob patterns like `*.ts` or `!important`).

## [0.0.3] - 2026-05-24

### Fixed

- **Diagnostic inline message position**: Diagnostic decorations are now always placed at the end of the line (`lineAt().range.end`) instead of at the start of the diagnostic range.

## [0.0.2] - 2026-05-24

### Added

- **excludeLanguages config**: New `inline-markers.comments.excludeLanguages` setting to disable comment tag highlighting per language. Defaults to `["markdown", "mdx"]`.

### Fixed

- **Comment pattern anchoring**: Added line-start anchor to comment regex patterns to prevent false matches inside string literals. Note: inline HTML comments (e.g., `<!-- TODO: ... -->` mid-line) are no longer matched, which aligns with the intended behavior.

## [0.0.1] - 2026-04-29

### Added

- Initial release of **Inline Markers**.
- **Custom Comment Highlights**: Support for single-line and multi-line comment tags including `TODO`, `FIXME`, `!`, `?`, and `*`.
- **Diagnostic Gutter Icons**: Real-time visual indicators for errors, warnings, info, and hints in the editor gutter.
- **Inline Diagnostic Messages**: Display of diagnostic messages directly at the end of the code lines for better visibility.
- **Configurable Settings**: Extensive customization options for colors, visibility, and behavior via VS Code settings.
