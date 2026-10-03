Arc Activity Heatmap
Source: https://uiarc.dev/r/activity-heatmap.json
Reference: https://uiarc.dev/components/activity-heatmap
Retrieved: 2026-09-30

The TSX component and CSS module are from the official registry. Integration changes:
- Add the React import for Vite's classic JSX transform.
- Resolve motion-tokens locally; the tokens are from arc-foundation.json.
The portfolio scopes its theme tokens in src/styles.css without importing Arc's global reset.
- Calculate responsive cell size with the actual week count so current-year ranges fill the available width.
