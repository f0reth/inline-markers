# Change Log

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
