# Claude Code — limits & usage dashboard

[Русский](README.md) · **English**

A local web dashboard for your Claude Code subscription: live rate limits plus
historical usage broken down by model and project, with cost estimates and 3D/2D charts.

![Claude Code dashboard](docs/screenshot.png)

Everything is read **locally** and nothing is sent anywhere:

- **Limits** — the `https://api.anthropic.com/api/oauth/usage` endpoint (OAuth token from
  `~/.claude/.credentials.json`), with a fallback to the statusline cache.
- **Usage** — the transcripts under `~/.claude/projects/**/*.jsonl` (tokens per model,
  project and day; deduplicated by `message.id + requestId`).

## Features

- Live limits (5-hour session, weekly, per-model scoped) with progress bars and reset times.
- Usage over a period: presets + custom date range.
- Totals (tokens / messages / estimated cost) and breakdown by model and project.
- "By day" chart with switchable views: **3D** (WebGL/three.js, static), **Bars**, **Lines**.
- Picking a single day (e.g. "Today") switches the chart to a per-hour breakdown.
- Auto-refresh every 10 minutes with a countdown and a manual refresh button.
- UI in 5 languages: Russian (default), English, German, French, Chinese.
- Futuristic look: volumetric glass, neon glow.

## Run

```bash
npm install
npm run dev      # http://localhost:5174 (Vite runs as middleware inside Express, with HMR)
```

Production (single port):

```bash
npm run build && npm start   # http://localhost:5174
```

## Stack

Node.js + Express (API and static serving on one port) · Vite + React · three.js.

The `$` figures are an **estimated equivalent cost at API pricing** (on a subscription the
real limits are measured in percentages, not money). Hours are bucketed in UTC, matching the
UTC day boundaries used throughout the app.

## License

[MIT](LICENSE) © 2026 Boris Kupryakov
