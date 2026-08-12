# Dashboard

A standalone evidence dashboard for the AI-enabled spec SDLC demo.

## Development

```bash
npm install
npm run dev
```

## Build

To build the standard distributable dashboard:

```bash
npm run build
```

To build a single self-contained HTML file (with all CSS/JS assets inlined):

```bash
npm run build:singlefile
```

## Testing

```bash
npm run test
```

## Theme

The dashboard uses the Clawpilot theme system. It checks the `clawpilotTheme` query string parameter or falls back to `prefers-color-scheme`. Colors are implemented using CSS variables (e.g., `--cp-bg-light`, `--cp-accent`).
