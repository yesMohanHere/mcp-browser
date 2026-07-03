import type { Browser, BrowserContext, Page } from "playwright";

export interface BrowserState {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  navigatedUrl?: string;
}

export interface NavigateArgs {
  url: string;
  viewport_width?: number;
  viewport_height?: number;
  timeout?: number;
  wait_until?: "load" | "domcontentloaded" | "networkidle" | "commit";
}

export interface ScreenshotArgs {
  selector?: string;
  full_page?: boolean;
  type?: "png" | "jpeg";
}

export interface ClickArgs {
  selector?: string;
  x?: number;
  y?: number;
  button?: "left" | "right" | "middle";
  delay?: number;
}

export interface TypeArgs {
  selector: string;
  text: string;
  clear_first?: boolean;
  press_enter?: boolean;
  delay?: number;
}

export interface ScrollArgs {
  selector?: string;
  direction?: "up" | "down" | "left" | "right" | "to_element";
  amount?: number;
}

export interface EvaluateArgs {
  script: string;
}

export interface FormSubmitArgs {
  selector: string;
  fields: Record<string, string>;
  submit?: boolean;
}

export interface FileDownloadArgs {
  url: string;
  selector?: string;
  timeout?: number;
}

export interface CookieGetArgs {
  name?: string;
  url?: string;
}

export interface CookieSetArgs {
  name: string;
  value: string;
  url?: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

export interface StorageGetArgs {
  key?: string;
  storage?: "local" | "session";
}

export interface StorageSetArgs {
  key: string;
  value: string;
  storage?: "local" | "session";
}

export interface WaitForSelectorArgs {
  selector: string;
  timeout?: number;
  state?: "attached" | "detached" | "visible" | "hidden";
}

export interface GetTextArgs {
  selector?: string;
}

export interface GetHtmlArgs {
  selector?: string;
}

export interface GoBackArgs {
  timeout?: number;
}

export interface GoForwardArgs {
  timeout?: number;
}

export interface GetUrlArgs {
  // No args needed
}
