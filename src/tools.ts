/**
 * MCP tool schema definitions.
 * Each tool describes its name, description, and JSON Schema input.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "browser_navigate",
    description:
      "Navigate to a URL in a headless browser. Creates a new browser context if one does not exist. " +
      "Supports optional viewport dimensions, navigation timeout, and wait-until strategy. " +
      "Example: {\"url\": \"https://example.com\", \"viewport_width\": 1280, \"viewport_height\": 720}",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The URL to navigate to. Must include protocol (http:// or https://).",
        },
        viewport_width: {
          type: "number",
          description: "Viewport width in pixels. Default: 1280.",
        },
        viewport_height: {
          type: "number",
          description: "Viewport height in pixels. Default: 720.",
        },
        timeout: {
          type: "number",
          description: "Navigation timeout in milliseconds. Default: 30000.",
        },
        wait_until: {
          type: "string",
          enum: ["load", "domcontentloaded", "networkidle", "commit"],
          description: "When to consider navigation complete. Default: 'load'.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_screenshot",
    description:
      "Capture a screenshot of the current page or a specific element. " +
      "Returns the image as a base64-encoded data URL that can be displayed inline. " +
      "Use full_page: true to capture the entire scrollable page. " +
      "Use selector to capture a specific element only.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to screenshot. If omitted, captures the full viewport.",
        },
        full_page: {
          type: "boolean",
          description: "Capture the full scrollable page. Default: false.",
        },
        type: {
          type: "string",
          enum: ["png", "jpeg"],
          description: "Screenshot image format. Default: 'png'.",
        },
      },
    },
  },
  {
    name: "browser_click",
    description:
      "Click an element on the current page by CSS selector or by x/y coordinates. " +
      "Use selector for clicking specific elements. Use x/y for coordinate-based clicking.",
    inputSchema: {
      type: "object",
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
        },
        delay: {
          type: "number",
          description: "Delay in milliseconds between mousedown and mouseup. Default: 0.",
        },
      },
    },
  },
  {
    name: "browser_type",
    description:
      "Type text into an input field identified by a CSS selector. " +
      "Automatically clears the field before typing (set clear_first: false to append). " +
      "Optionally press Enter after typing.",
    inputSchema: {
      type: "object",
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
        },
        press_enter: {
          type: "boolean",
          description: "Press Enter after typing. Default: false.",
        },
        delay: {
          type: "number",
          description: "Delay between keystrokes in milliseconds. Default: 0.",
        },
      },
      required: ["selector", "text"],
    },
  },
  {
    name: "browser_scroll",
    description:
      "Scroll the page or a specific element. Supports scrolling by direction and pixel amount, " +
      "or scrolling until a specific element is in view. Use direction: 'to_element' with a selector.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to scroll. If omitted, scrolls the page.",
        },
        direction: {
          type: "string",
          enum: ["up", "down", "left", "right", "to_element"],
          description: "Scroll direction. Default: 'down'.",
        },
        amount: {
          type: "number",
          description: "Pixels to scroll. Default: 500. Ignored when direction is 'to_element'.",
        },
      },
    },
  },
  {
    name: "browser_evaluate",
    description:
      "Execute JavaScript in the context of the current page. " +
      "Returns the result as JSON (if serializable) or a string representation. " +
      "Use this to extract data, manipulate the DOM, or run custom scripts. " +
      "Example scripts: 'document.title', 'document.querySelector(\"h1\").innerText', " +
      "'Array.from(document.querySelectorAll(\"a\")).map(a => a.href)'",
    inputSchema: {
      type: "object",
      properties: {
        script: {
          type: "string",
          description: "JavaScript code to execute in the page context. The code runs with the page as 'this' context.",
        },
      },
      required: ["script"],
    },
  },
  {
    name: "browser_form_submit",
    description:
      "Fill and submit a form on the current page. Provide a selector for the form element " +
      "and a mapping of field selectors to their values. Automatically submits the form after filling.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the form element.",
        },
        fields: {
          type: "object",
          description: "Mapping of CSS selectors (relative to the form) to the values to fill in.",
          additionalProperties: { type: "string" },
        },
        submit: {
          type: "boolean",
          description: "Whether to submit the form after filling. Default: true.",
        },
      },
      required: ["selector", "fields"],
    },
  },
  {
    name: "browser_file_download",
    description:
      "Download a file by navigating to a URL or clicking a download link. " +
      "Waits for the download to start and returns the filename and save location.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL to navigate to for triggering the download.",
        },
        selector: {
          type: "string",
          description: "CSS selector of the element to click to trigger the download. If provided, url is used as the base page.",
        },
        timeout: {
          type: "number",
          description: "Timeout for the download to start in milliseconds. Default: 30000.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "browser_cookie_get",
    description:
      "Get cookies from the current browser context. Optionally filter by cookie name or URL. " +
      "Returns all cookies if no name is specified.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the cookie to retrieve. If omitted, returns all cookies.",
        },
        url: {
          type: "string",
          description: "Filter cookies by URL. If omitted, returns cookies for all URLs in the context.",
        },
      },
    },
  },
  {
    name: "browser_cookie_set",
    description:
      "Set a cookie in the current browser context. " +
      "Useful for authentication tokens, session cookies, or testing cookie-based features.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Name of the cookie.",
        },
        value: {
          type: "string",
          description: "Value of the cookie.",
        },
        url: {
          type: "string",
          description: "URL associated with the cookie. Either url or domain must be provided.",
        },
        domain: {
          type: "string",
          description: "Domain for the cookie. Either url or domain must be provided.",
        },
        path: {
          type: "string",
          description: "Path for the cookie. Default: '/'.",
        },
        expires: {
          type: "number",
          description: "Unix timestamp for cookie expiration.",
        },
        httpOnly: {
          type: "boolean",
          description: "Whether the cookie is HTTP-only. Default: false.",
        },
        secure: {
          type: "boolean",
          description: "Whether the cookie requires HTTPS. Default: false.",
        },
        sameSite: {
          type: "string",
          enum: ["Strict", "Lax", "None"],
          description: "SameSite attribute. Default: 'Lax'.",
        },
      },
      required: ["name", "value"],
    },
  },
  {
    name: "browser_storage_get",
    description:
      "Get data from the browser's localStorage or sessionStorage. " +
      "Retrieve a specific key or all key-value pairs.",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Key to retrieve. If omitted, returns all key-value pairs.",
        },
        storage: {
          type: "string",
          enum: ["local", "session"],
          description: "Which storage to read from. Default: 'local'.",
        },
      },
    },
  },
  {
    name: "browser_storage_set",
    description:
      "Set data in the browser's localStorage or sessionStorage. " +
      "Useful for persisting state, tokens, or testing storage-based features.",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Key to set.",
        },
        value: {
          type: "string",
          description: "Value to store.",
        },
        storage: {
          type: "string",
          enum: ["local", "session"],
          description: "Which storage to write to. Default: 'local'.",
        },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "browser_wait_for_selector",
    description:
      "Wait for an element matching a CSS selector to reach a specific state. " +
      "Useful for waiting until content loads, an element appears, or an element disappears. " +
      "States: 'visible' (default), 'hidden', 'attached' (in DOM), 'detached' (removed from DOM).",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to wait for.",
        },
        timeout: {
          type: "number",
          description: "Maximum wait time in milliseconds. Default: 30000.",
        },
        state: {
          type: "string",
          enum: ["attached", "detached", "visible", "hidden"],
          description: "Expected state of the element. Default: 'visible'.",
        },
      },
      required: ["selector"],
    },
  },
  {
    name: "browser_get_text",
    description:
      "Extract text content from the current page or a specific element. " +
      "If no selector is provided, returns the text content of the entire page body.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to extract text from. If omitted, gets page body text.",
        },
      },
    },
  },
  {
    name: "browser_get_html",
    description:
      "Get the HTML content of the current page or a specific element. " +
      "Useful for debugging, scraping, or inspecting page structure.",
    inputSchema: {
      type: "object",
      properties: {
        selector: {
          type: "string",
          description: "CSS selector of the element to get HTML from. If omitted, gets full page HTML.",
        },
      },
    },
  },
  {
    name: "browser_go_back",
    description:
      "Navigate to the previous page in the browser history. " +
      "Equivalent to clicking the browser's back button.",
    inputSchema: {
      type: "object",
      properties: {
        timeout: {
          type: "number",
          description: "Navigation timeout in milliseconds. Default: 30000.",
        },
      },
    },
  },
  {
    name: "browser_go_forward",
    description:
      "Navigate to the next page in the browser history. " +
      "Equivalent to clicking the browser's forward button.",
    inputSchema: {
      type: "object",
      properties: {
        timeout: {
          type: "number",
          description: "Navigation timeout in milliseconds. Default: 30000.",
        },
      },
    },
  },
  {
    name: "browser_get_url",
    description:
      "Get the current page URL. Useful for verifying redirects or tracking navigation state.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "browser_close",
    description:
      "Close the browser context and release all resources. " +
      "Always call this when done to free up memory and close the browser process. " +
      "The browser will be automatically recreated on the next navigate call.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
];

export const TOOL_NAMES = TOOLS.map((t) => t.name);
