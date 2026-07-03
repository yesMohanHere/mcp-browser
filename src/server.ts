#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type TextContent,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

// ── Types ──────────────────────────────────────────────────────────────

interface BrowserState {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  navigatedUrl?: string;
}

// ── Constants ──────────────────────────────────────────────────────────

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

// ── Tool Definitions ───────────────────────────────────────────────────

const TOOLS = [
  {
    name: "browser_navigate",
    description:
      "Navigate to a URL in a headless browser. Creates a new browser context if one does not exist. " +
      "Supports optional viewport dimensions, timeout, and wait-until strategy.",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "The URL to navigate to. Must include protocol (http:// or https://).",
        },
        viewport_width: {
          type: "number",
          description: "Viewport width in pixels. Default: 1280.",
          default: 1280,
        },
        viewport_height: {
          type: "number",
          description: "Viewport height in pixels. Default: 720.",
          default: 720,
        },
        timeout: {
          type: "number",
          description: "Navigation timeout in milliseconds. Default: 30000.",
          default: 30000,
        },
        wait_until: {
          type: "string",
          enum: ["load", "domcontentloaded", "networkidle", "commit"],
          description:
            "When to consider navigation complete. Default: 'load'.",
          default: "load",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_screenshot",
    description:
      "Capture a screenshot of the current page or a specific element. " +
      "Returns the image as a base64-encoded data URL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description:
            "CSS selector of the element to screenshot. If omitted, captures the full viewport.",
        },
        full_page: {
          type: "boolean",
          description: "Capture the full scrollable page. Default: false.",
          default: false,
        },
        type: {
          type: "string",
          enum: ["png", "jpeg"],
          description: "Screenshot image format. Default: 'png'.",
          default: "png",
        },
      },
      required: [],
    },
  },
  {
    name: "browser_click",
    description:
      "Click an element on the current page by CSS selector or by x/y coordinates.",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to click.",
        },
        x: {
          type: "number",
          description: "X coordinate to click (relative to viewport).",
        },
        y: {
          type: "number",
          description: "Y coordinate to click (relative to viewport).",
        },
        button: {
          type: "string",
          enum: ["left", "right", "middle"],
          description: "Mouse button to click. Default: 'left'.",
          default: "left",
        },
        delay: {
          type: "number",
          description: "Delay in milliseconds between mousedown and mouseup. Default: 0.",
          default: 0,
        },
      },
      required: [],
    },
  },
  {
    name: "browser_type",
    description:
      "Type text into an input field identified by a CSS selector. " +
      "Supports optional clearing of the field before typing and pressing Enter after.",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the input field.",
        },
        text: {
          type: "string",
          description: "Text to type into the input field.",
        },
        clear_first: {
          type: "boolean",
          description: "Clear the field before typing. Default: true.",
          default: true,
        },
        press_enter: {
          type: "boolean",
          description: "Press Enter after typing. Default: false.",
          default: false,
        },
        delay: {
          type: "number",
          description: "Delay between keystrokes in milliseconds. Default: 0.",
          default: 0,
        },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "browser_scroll",
    description:
      "Scroll the page or a specific element. Supports scrolling by pixel amount, " +
      "to the bottom/top, or to a specific element.",
    inputSchema: {
      type: "object" as const,
      properties: {
        selector: {
          type: "string",
          description:
            "CSS selector of the element to scroll. If omitted, scrolls the page.",
        },
        direction: {
          type: "string",
          enum: ["up", "down", "left", "right", "to_element"],
          description: "Scroll direction. Default: 'down'.",
          default: "down",
        },
        amount: {
          type: "number",
          description: "Pixels to scroll. Default: 500.",
          default: 500,
        },
      },
      required: [],
    },
  },
  {
    name: "browser_evaluate",
    description:
      "Execute JavaScript in the context of the current page. " +
      "Returns the result as JSON (if serializable) or a string representation.",
    inputSchema: {
      type: "object" as const,
      properties: {
        script: {
          type: "string",
          description: "JavaScript code to execute in the page context.",
        },
      },
      required: ["script"],
    },
  },
  {
    name: "browser_close",
    description:
      "Close the browser context and release all resources. " +
      "Call this when done to free up memory and close the browser.",
    inputSchema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
] as const;

// ── Browser Manager ────────────────────────────────────────────────────

class BrowserManager {
  private state: BrowserState | null = null;

  async navigate(args: {
    url: string;
    viewport_width?: number;
    viewport_height?: number;
    timeout?: number;
    wait_until?: string;
  }): Promise<TextContent> {
    const width = args.viewport_width ?? DEFAULT_VIEWPORT.width;
    const height = args.viewport_height ?? DEFAULT_VIEWPORT.height;
    const timeout = args.timeout ?? 30000;
    const waitUntil = (args.wait_until ?? "load") as "load" | "domcontentloaded" | "networkidle" | "commit";

    await this.ensureBrowser({ width, height });
    const page = this.state!.page;

    try {
      const response = await page.goto(args.url, {
        timeout,
        waitUntil,
      });

      const status = response?.status() ?? "unknown";
      const title = await page.title().catch(() => "unknown");
      this.state!.navigatedUrl = args.url;

      return {
        type: "text",
        text: `Navigated to ${args.url}\nStatus: ${status}\nTitle: ${title}\nViewport: ${width}x${height}`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        type: "text",
        text: `Navigation failed: ${message}`,
      };
    }
  }

  async screenshot(args: {
    selector?: string;
    full_page?: boolean;
    type?: string;
  }): Promise<TextContent> {
    if (!this.state) {
      return { type: "text", text: "No active browser session. Use browser_navigate first." };
    }

    try {
      const { page } = this.state;
      const screenshotType = (args.type ?? "png") as "png" | "jpeg";
      const options = {
        type: screenshotType,
        fullPage: args.full_page ?? false,
      };

      let buffer: Buffer;
      if (args.selector) {
        const element = await page.locator(args.selector).first();
        buffer = await element.screenshot(options);
      } else {
        buffer = await page.screenshot(options);
      }

      const base64 = buffer.toString("base64");
      const mime = screenshotType === "png" ? "image/png" : "image/jpeg";
      const dataUrl = `data:${mime};base64,${base64}`;

      return {
        type: "text",
        text: `Screenshot captured (${args.selector ? `element: ${args.selector}` : args.full_page ? "full page" : "viewport"}).\n\n${dataUrl}`,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { type: "text", text: `Screenshot failed: ${message}` };
    }
  }

  async click(args: {
    selector?: string;
    x?: number;
    y?: number;
    button?: string;
    delay?: number;
  }): Promise<TextContent> {
    if (!this.state) {
      return { type: "text", text: "No active browser session. Use browser_navigate first." };
    }

    try {
      const { page } = this.state;
      const button = (args.button ?? "left") as "left" | "right" | "middle";
      const delay = args.delay ?? 0;

      if (args.selector) {
        await page.locator(args.selector).first().click({ button, delay });
        return { type: "text", text: `Clicked element: ${args.selector} (button: ${button})` };
      }

      if (args.x !== undefined && args.y !== undefined) {
        await page.mouse.click(args.x, args.y, { button, delay });
        return { type: "text", text: `Clicked at coordinates (${args.x}, ${args.y}) (button: ${button})` };
      }

      return { type: "text", text: "Error: Provide either a selector or x/y coordinates." };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { type: "text", text: `Click failed: ${message}` };
    }
  }

  async type(args: {
    selector: string;
    text: string;
    clear_first?: boolean;
    press_enter?: boolean;
    delay?: number;
  }): Promise<TextContent> {
    if (!this.state) {
      return { type: "text", text: "No active browser session. Use browser_navigate first." };
    }

    try {
      const { page } = this.state;
      const locator = page.locator(args.selector).first();

      if (args.clear_first !== false) {
        await locator.fill("");
      }

      await locator.type(args.text, { delay: args.delay ?? 0 });

      if (args.press_enter) {
        await locator.press("Enter");
      }

      return { type: "text", text: `Typed "${args.text}" into ${args.selector}${args.press_enter ? " and pressed Enter" : ""}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { type: "text", text: `Type failed: ${message}` };
    }
  }

  async scroll(args: {
    selector?: string;
    direction?: string;
    amount?: number;
  }): Promise<TextContent> {
    if (!this.state) {
      return { type: "text", text: "No active browser session. Use browser_navigate first." };
    }

    try {
      const { page } = this.state;
      const direction = args.direction ?? "down";
      const amount = args.amount ?? 500;

      if (direction === "to_element" && args.selector) {
        await page.locator(args.selector).first().scrollIntoViewIfNeeded();
        return { type: "text", text: `Scrolled to element: ${args.selector}` };
      }

      const scrollFn = (dir: string, amt: number) => {
        const el = document.scrollingElement || document.documentElement;
        if (dir === "up") el.scrollBy({ top: -amt });
        else if (dir === "down") el.scrollBy({ top: amt });
        else if (dir === "left") el.scrollBy({ left: -amt });
        else if (dir === "right") el.scrollBy({ left: amt });
      };

      if (args.selector) {
        const element = page.locator(args.selector).first();
        await element.evaluate(scrollFn, direction, amount);
        return { type: "text", text: `Scrolled ${direction} by ${amount}px on element: ${args.selector}` };
      }

      await page.evaluate(scrollFn, direction, amount);
      return { type: "text", text: `Scrolled page ${direction} by ${amount}px` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { type: "text", text: `Scroll failed: ${message}` };
    }
  }

  async evaluate(args: { script: string }): Promise<TextContent> {
    if (!this.state) {
      return { type: "text", text: "No active browser session. Use browser_navigate first." };
    }

    try {
      const result = await this.state.page.evaluate((script) => {
        // eslint-disable-next-line no-eval
        return eval(script);
      }, args.script);

      let text: string;
      if (result === undefined) {
        text = "undefined";
      } else if (result === null) {
        text = "null";
      } else if (typeof result === "object") {
        try {
          text = JSON.stringify(result, null, 2);
        } catch {
          text = String(result);
        }
      } else {
        text = String(result);
      }

      return { type: "text", text: `Result:\n${text}` };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { type: "text", text: `Evaluation failed: ${message}` };
    }
  }

  async close(): Promise<TextContent> {
    if (!this.state) {
      return { type: "text", text: "No active browser session to close." };
    }

    try {
      await this.state.context.close();
      await this.state.browser.close();
      this.state = null;
      return { type: "text", text: "Browser closed successfully." };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.state = null;
      return { type: "text", text: `Browser close completed with error: ${message}` };
    }
  }

  private async ensureBrowser(viewport: { width: number; height: number }): Promise<void> {
    if (this.state) {
      await this.state.page.setViewportSize(viewport);
      return;
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport,
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
        "AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/135.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    this.state = { browser, context, page };
  }
}

// ── MCP Server Setup ───────────────────────────────────────────────────

async function main() {
  const browserManager = new BrowserManager();

  const server = new Server(
    { name: "mcp-browser", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [...TOOLS],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    let result: TextContent;

    switch (name) {
      case "browser_navigate":
        result = await browserManager.navigate(args as any);
        break;
      case "browser_screenshot":
        result = await browserManager.screenshot(args as any);
        break;
      case "browser_click":
        result = await browserManager.click(args as any);
        break;
      case "browser_type":
        result = await browserManager.type(args as any);
        break;
      case "browser_scroll":
        result = await browserManager.scroll(args as any);
        break;
      case "browser_evaluate":
        result = await browserManager.evaluate(args as any);
        break;
      case "browser_close":
        result = await browserManager.close();
        break;
      default:
        result = { type: "text", text: `Unknown tool: ${name}` };
    }

    return { content: [result] };
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await browserManager.close();
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await browserManager.close();
    await server.close();
    process.exit(0);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Keep alive — the MCP SDK handles stdio lifecycle
  await new Promise(() => {});
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
