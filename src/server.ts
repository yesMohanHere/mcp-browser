#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import { BrowserManager } from "./browser.js";
import { TOOLS, TOOL_NAMES } from "./tools.js";
import { logger } from "./logger.js";

// Read log level from environment
const logLevel = (process.env.MCP_BROWSER_LOG_LEVEL ?? "info") as "debug" | "info" | "warn" | "error";
logger.info("MCP Browser server starting", { version: "0.1.0", logLevel });

const browserManager = new BrowserManager();

const server = new Server(
  { name: "mcp-browser", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!TOOL_NAMES.includes(name)) {
    const result: TextContent = { type: "text", text: `Unknown tool: ${name}` };
    return { content: [result] };
  }

  logger.info(`Tool call: ${name}`, { args });
  const startTime = Date.now();

  let resultText: string;

  try {
    switch (name) {
      case "browser_navigate":
        resultText = await browserManager.navigate(args as any);
        break;
      case "browser_screenshot":
        resultText = await browserManager.screenshot(args as any);
        break;
      case "browser_click":
        resultText = await browserManager.click(args as any);
        break;
      case "browser_type":
        resultText = await browserManager.type(args as any);
        break;
      case "browser_scroll":
        resultText = await browserManager.scroll(args as any);
        break;
      case "browser_evaluate":
        resultText = await browserManager.evaluate(args as any);
        break;
      case "browser_form_submit":
        resultText = await browserManager.formSubmit(args as any);
        break;
      case "browser_file_download":
        resultText = await browserManager.fileDownload(args as any);
        break;
      case "browser_cookie_get":
        resultText = await browserManager.cookieGet(args as any);
        break;
      case "browser_cookie_set":
        resultText = await browserManager.cookieSet(args as any);
        break;
      case "browser_storage_get":
        resultText = await browserManager.storageGet(args as any);
        break;
      case "browser_storage_set":
        resultText = await browserManager.storageSet(args as any);
        break;
      case "browser_wait_for_selector":
        resultText = await browserManager.waitForSelector(args as any);
        break;
      case "browser_get_text":
        resultText = await browserManager.getText(args as any);
        break;
      case "browser_get_html":
        resultText = await browserManager.getHtml(args as any);
        break;
      case "browser_go_back":
        resultText = await browserManager.goBack(args as any);
        break;
      case "browser_go_forward":
        resultText = await browserManager.goForward(args as any);
        break;
      case "browser_get_url":
        resultText = await browserManager.getUrl();
        break;
      case "browser_close":
        resultText = await browserManager.close();
        break;
      default:
        resultText = `Unknown tool: ${name}`;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Tool ${name} failed`, { error: message });
    resultText = `Error: ${message}`;
  }

  const duration = Date.now() - startTime;
  logger.info(`Tool ${name} completed in ${duration}ms`);

  const result: TextContent = { type: "text", text: resultText };
  return { content: [result] };
});

// Graceful shutdown handlers
process.on("SIGINT", async () => {
  logger.info("Received SIGINT, shutting down");
  await browserManager.close();
  await server.close();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM, shutting down");
  await browserManager.close();
  await server.close();
  process.exit(0);
});

// Handle uncaught errors
process.on("uncaughtException", async (err) => {
  logger.error("Uncaught exception", { error: err.message, stack: err.stack });
  await browserManager.close();
  await server.close();
  process.exit(1);
});

process.on("unhandledRejection", async (reason) => {
  logger.error("Unhandled rejection", { reason: String(reason) });
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("MCP Browser server connected and ready");

  // Keep alive
  await new Promise(() => {});
}

main().catch((err) => {
  logger.error("Fatal error during startup", { error: err.message, stack: err.stack });
  process.exit(1);
});
