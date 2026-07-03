# Contributing

Thanks for your interest in contributing to MCP Browser!

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Install Playwright browsers: `npx playwright install chromium`
4. Build: `npm run build`
5. Run tests: `npm test`

## Project Structure

```
.
├── src/
│   ├── types.ts      # TypeScript interfaces
│   ├── logger.ts     # Structured logging utility
│   ├── browser.ts    # BrowserManager class (all automation logic)
│   ├── tools.ts      # MCP tool schema definitions
│   └── server.ts     # MCP server entry point
├── test/
│   └── browser.test.ts  # Test suite
├── .github/workflows/
│   ├── ci.yml           # CI pipeline
│   └── npm-publish.yml  # npm publish on release
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── plugin.json
```

## Adding a New Tool

1. Add the TypeScript interface to `src/types.ts`
2. Implement the method in `src/browser.ts`
3. Add the tool definition to `src/tools.ts`
4. Wire it up in `src/server.ts`
5. Add tests in `test/browser.test.ts`

## Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes with tests
4. Ensure all tests pass: `npm test`
5. Submit a pull request

## Code Style

- TypeScript strict mode enabled
- Prefer explicit types over `any`
- All tool methods return strings (text content for MCP)
- Log to stderr via `logger.ts` (stdout is reserved for MCP JSON-RPC)
