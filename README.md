# MCP Browser

Browser automation MCP server — navigate, screenshot, click, type, scroll, and evaluate JavaScript in headless browsers via natural language.

## Features

- **Headless Chromium** via Playwright — fast, isolated, no GUI dependencies
- **7 browser tools**: navigate, screenshot, click, type, scroll, evaluate, close
- **Element + coordinate interaction** — click by CSS selector or x/y coordinates
- **Full-page & element screenshots** — PNG or JPEG, base64-encoded
- **JavaScript evaluation** — run arbitrary JS in page context, get JSON results
- **Session isolation** — clean browser context per session, no persistent cookies
- **Cross-platform** — works on macOS, Linux, Windows without screen-recording permissions

## Install

```bash
npm install
npm run build
```

Requires Node.js >= 20 and Playwright browsers:

```bash
npx playwright install chromium
```

## Usage

### As an MCP Server

Add to your MCP client configuration (e.g., `mcp.json`):

```json
{
  "mcpServers": {
    "browser": {
      "command": "node",
      "args": ["/path/to/mcp-browser/dist/server.js"],
      "enabled": true
    }
  }
}
```

### Tools Reference

| Tool | Description |
|------|-------------|
| `browser_navigate` | Navigate to a URL with optional viewport, timeout, wait strategy |
| `browser_screenshot` | Screenshot viewport, full page, or specific element |
| `browser_click` | Click by CSS selector or x/y coordinates |
| `browser_type` | Type into input fields with optional clear and Enter key |
| `browser_scroll` | Scroll page or element (direction + pixel amount) |
| `browser_evaluate` | Execute JavaScript in page context, return JSON result |
| `browser_close` | Close browser and release resources |

### Example Prompts

> "Navigate to example.com, take a screenshot of the hero section, and tell me what the headline says."

> "Go to the login page, fill in the username field with 'admin', type the password, and click the submit button."

> "Scroll down the product listing page, find the price element with class '.price', and extract the text content."

## Security

- All browser sessions run in **isolated incognito contexts** — no shared cookies, localStorage, or session state
- **Headless by default** — no desktop accessibility or screen-recording permissions required
- Network access respects system proxy and firewall settings
- Each `browser_close` fully terminates the browser process

## License

MIT
