import { chromium } from "playwright";
import type {
  BrowserState,
  NavigateArgs,
  ScreenshotArgs,
  ClickArgs,
  TypeArgs,
  ScrollArgs,
  EvaluateArgs,
  FormSubmitArgs,
  FileDownloadArgs,
  CookieGetArgs,
  CookieSetArgs,
  StorageGetArgs,
  StorageSetArgs,
  WaitForSelectorArgs,
  GetTextArgs,
  GetHtmlArgs,
  GoBackArgs,
  GoForwardArgs,
} from "./types.js";
import { logger } from "./logger.js";

const DEFAULT_VIEWPORT = { width: 1280, height: 720 };

export class BrowserManager {
  private state: BrowserState | null = null;
  private downloadDir: string = "/tmp/mcp-browser-downloads";

  isActive(): boolean {
    return this.state !== null;
  }

  async navigate(args: NavigateArgs) {
    const width = args.viewport_width ?? DEFAULT_VIEWPORT.width;
    const height = args.viewport_height ?? DEFAULT_VIEWPORT.height;
    const timeout = args.timeout ?? 30000;
    const waitUntil = args.wait_until ?? "load";

    await this.ensureBrowser({ width, height });
    const page = this.state!.page;

    try {
      const response = await page.goto(args.url, { timeout, waitUntil });
      const status = response?.status() ?? "unknown";
      const title = await page.title().catch(() => "unknown");
      this.state!.navigatedUrl = args.url;

      logger.info("Navigation complete", { url: args.url, status, title });
      return `Navigated to ${args.url}\nStatus: ${status}\nTitle: ${title}\nViewport: ${width}x${height}`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Navigation failed", { url: args.url, error: message });
      return `Navigation failed: ${message}`;
    }
  }

  async screenshot(args: ScreenshotArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { page } = this.state;
      const screenshotType = args.type ?? "png";
      const options = { type: screenshotType as "png" | "jpeg", fullPage: args.full_page ?? false };

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

      const scope = args.selector ? `element: ${args.selector}` : args.full_page ? "full page" : "viewport";
      logger.info("Screenshot captured", { scope, size: buffer.length });
      return `Screenshot captured (${scope}).\n\n${dataUrl}`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("Screenshot failed", { error: message });
      return `Screenshot failed: ${message}`;
    }
  }

  async click(args: ClickArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { page } = this.state;
      const button = args.button ?? "left";
      const delay = args.delay ?? 0;

      if (args.selector) {
        await page.locator(args.selector).first().click({ button: button as "left" | "right" | "middle", delay });
        return `Clicked element: ${args.selector} (button: ${button})`;
      }

      if (args.x !== undefined && args.y !== undefined) {
        await page.mouse.click(args.x, args.y, { button: button as "left" | "right" | "middle", delay });
        return `Clicked at coordinates (${args.x}, ${args.y}) (button: ${button})`;
      }

      return "Error: Provide either a selector or x/y coordinates.";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Click failed: ${message}`;
    }
  }

  async type(args: TypeArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

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

      return `Typed "${args.text}" into ${args.selector}${args.press_enter ? " and pressed Enter" : ""}`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Type failed: ${message}`;
    }
  }

  async scroll(args: ScrollArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { page } = this.state;
      const direction = args.direction ?? "down";
      const amount = args.amount ?? 500;

      if (direction === "to_element" && args.selector) {
        await page.locator(args.selector).first().scrollIntoViewIfNeeded();
        return `Scrolled to element: ${args.selector}`;
      }

      // Build scroll script as a string to avoid DOM type issues in Node context
      const scrollProp = direction === "up" || direction === "down" ? "top" : "left";
      const scrollVal = direction === "up" || direction === "left" ? -amount : amount;
      const script = `(function() {
        var el = document.querySelector(${JSON.stringify(args.selector || "html")});
        if (!el) el = document.scrollingElement || document.documentElement;
        el.scrollBy({ ${scrollProp}: ${scrollVal} });
      })()`;

      await page.evaluate((s: string) => eval(s), script);

      const target = args.selector || "page";
      return `Scrolled ${target} ${direction} by ${amount}px`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Scroll failed: ${message}`;
    }
  }

  async evaluate(args: EvaluateArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const result = await this.state.page.evaluate((script) => {
        return eval(script);
      }, args.script);

      let text: string;
      if (result === undefined) text = "undefined";
      else if (result === null) text = "null";
      else if (typeof result === "object") {
        try {
          text = JSON.stringify(result, null, 2);
        } catch {
          text = String(result);
        }
      } else {
        text = String(result);
      }

      return `Result:\n${text}`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Evaluation failed: ${message}`;
    }
  }

  async formSubmit(args: FormSubmitArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { page } = this.state;
      const form = page.locator(args.selector).first();

      for (const [fieldSelector, value] of Object.entries(args.fields)) {
        const field = form.locator(fieldSelector).first();
        await field.fill("");
        await field.type(value);
      }

      if (args.submit !== false) {
        const submitScript = `(function() {
          var f = document.querySelector(${JSON.stringify(args.selector)});
          if (f && f.submit) f.submit();
        })()`;
        await this.state.page.evaluate((s: string) => eval(s), submitScript);
      }

      return `Form ${args.selector} filled with ${Object.keys(args.fields).length} fields${args.submit !== false ? " and submitted" : ""}`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Form submission failed: ${message}`;
    }
  }

  async fileDownload(args: FileDownloadArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { page } = this.state;
      const timeout = args.timeout ?? 30000;

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout }),
        args.selector ? page.locator(args.selector).first().click() : page.goto(args.url),
      ]);

      const suggestedFilename = download.suggestedFilename();
      const path = await download.path();

      return `Download started: ${suggestedFilename}\nSaved to: ${path ?? "temporary location"}`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Download failed: ${message}`;
    }
  }

  async cookieGet(args: CookieGetArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { context } = this.state;
      const cookies = await context.cookies(args.url ? [args.url] : undefined);

      if (args.name) {
        const cookie = cookies.find((c) => c.name === args.name);
        if (!cookie) return `Cookie "${args.name}" not found.`;
        return `Cookie "${args.name}":\n${JSON.stringify(cookie, null, 2)}`;
      }

      return `Cookies (${cookies.length}):\n${JSON.stringify(cookies, null, 2)}`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Cookie get failed: ${message}`;
    }
  }

  async cookieSet(args: CookieSetArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { context } = this.state;
      await context.addCookies([
        {
          name: args.name,
          value: args.value,
          url: args.url,
          domain: args.domain,
          path: args.path ?? "/",
          expires: args.expires,
          httpOnly: args.httpOnly ?? false,
          secure: args.secure ?? false,
          sameSite: args.sameSite ?? "Lax",
        },
      ]);

      return `Cookie "${args.name}" set successfully.`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Cookie set failed: ${message}`;
    }
  }

  async storageGet(args: StorageGetArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { page } = this.state;
      const storage = args.storage ?? "local";

      if (args.key) {
        const value = await page.evaluate(
          ({ key, storageType }) => {
            const store = storageType === "session" ? sessionStorage : localStorage;
            return store.getItem(key);
          },
          { key: args.key, storageType: storage }
        );
        return value === null
          ? `Key "${args.key}" not found in ${storage}Storage.`
          : `${storage}Storage["${args.key}"]:\n${value}`;
      }

      const all = await page.evaluate(({ storageType }) => {
        const store = storageType === "session" ? sessionStorage : localStorage;
        const result: Record<string, string> = {};
        for (let i = 0; i < store.length; i++) {
          const key = store.key(i);
          if (key) result[key] = store.getItem(key) ?? "";
        }
        return result;
      }, { storageType: storage });

      return `${storage}Storage (${Object.keys(all).length} keys):\n${JSON.stringify(all, null, 2)}`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Storage get failed: ${message}`;
    }
  }

  async storageSet(args: StorageSetArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { page } = this.state;
      const storage = args.storage ?? "local";

      await page.evaluate(
        ({ key, value, storageType }) => {
          const store = storageType === "session" ? sessionStorage : localStorage;
          store.setItem(key, value);
        },
        { key: args.key, value: args.value, storageType: storage }
      );

      return `Set ${storage}Storage["${args.key}"] = "${args.value}"`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Storage set failed: ${message}`;
    }
  }

  async waitForSelector(args: WaitForSelectorArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { page } = this.state;
      const timeout = args.timeout ?? 30000;
      const state = args.state ?? "visible";

      await page.locator(args.selector).first().waitFor({ timeout, state });
      return `Element "${args.selector}" is ${state} (within ${timeout}ms).`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Wait for selector failed: ${message}`;
    }
  }

  async getText(args: GetTextArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { page } = this.state;

      if (args.selector) {
        const text = await page.locator(args.selector).first().textContent();
        return text ?? "(no text content)";
      }

      const text = await page.textContent("body");
      return text ?? "(no text content)";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Get text failed: ${message}`;
    }
  }

  async getHtml(args: GetHtmlArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { page } = this.state;

      if (args.selector) {
        const html = await page.locator(args.selector).first().innerHTML();
        return html;
      }

      const html = await page.content();
      return html;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Get HTML failed: ${message}`;
    }
  }

  async goBack(args: GoBackArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { page } = this.state;
      await page.goBack({ timeout: args.timeout ?? 30000 });
      const url = page.url();
      return `Navigated back to: ${url}`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Go back failed: ${message}`;
    }
  }

  async goForward(args: GoForwardArgs) {
    if (!this.state) return "No active browser session. Use browser_navigate first.";

    try {
      const { page } = this.state;
      await page.goForward({ timeout: args.timeout ?? 30000 });
      const url = page.url();
      return `Navigated forward to: ${url}`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `Go forward failed: ${message}`;
    }
  }

  async getUrl() {
    if (!this.state) return "No active browser session. Use browser_navigate first.";
    return this.state.page.url();
  }

  async close() {
    if (!this.state) return "No active browser session to close.";

    try {
      await this.state.context.close();
      await this.state.browser.close();
      this.state = null;
      logger.info("Browser closed");
      return "Browser closed successfully.";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.state = null;
      return `Browser close completed with error: ${message}`;
    }
  }

  private async ensureBrowser(viewport: { width: number; height: number }): Promise<void> {
    if (this.state) {
      await this.state.page.setViewportSize(viewport);
      return;
    }

    logger.info("Launching headless browser", { viewport });

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
    logger.info("Browser launched successfully");
  }
}
