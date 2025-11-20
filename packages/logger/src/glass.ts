import { globalLogManager, LogLevel } from "./index";

export class BrowserLoggerGlass {
  private container: HTMLDivElement;
  private logList: HTMLDivElement;
  private isVisible: boolean = false;

  constructor() {
    if (typeof document === "undefined") {
      throw new Error("BrowserLoggerGlass can only be used in a browser environment");
    }

    this.container = document.createElement("div");
    this.setupStyles();

    this.logList = document.createElement("div");
    this.container.appendChild(this.logList);

    document.body.appendChild(this.container);

    // Initial hidden state
    this.container.style.display = "none";

    // Add toggle key listener (Ctrl + `)
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "`") {
        this.toggle();
      }
    });

    globalLogManager.addHandler(this.handleLog.bind(this));
  }

  private setupStyles() {
    this.container.style.position = "fixed";
    this.container.style.top = "0";
    this.container.style.left = "0";
    this.container.style.width = "100%";
    this.container.style.height = "300px";
    this.container.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    this.container.style.color = "#fff";
    this.container.style.zIndex = "99999";
    this.container.style.overflowY = "auto";
    this.container.style.fontFamily = "monospace";
    this.container.style.fontSize = "12px";
    this.container.style.padding = "10px";
    this.container.style.pointerEvents = "auto";
    this.container.style.backdropFilter = "blur(4px)";
    this.container.style.borderBottom = "1px solid rgba(255, 255, 255, 0.2)";
  }

  private handleLog(level: LogLevel, moduleName: string, message: string, ...args: any[]) {
    const entry = document.createElement("div");
    entry.style.marginBottom = "2px";
    entry.style.borderBottom = "1px solid rgba(255, 255, 255, 0.1)";
    entry.style.display = "flex";

    const color = this.getColorForLevel(level);
    entry.style.color = color;

    const timestamp = new Date().toISOString().split("T")[1].slice(0, -1);

    // Safely stringify args
    let argsStr = "";
    if (args.length > 0) {
      try {
        argsStr = args
          .map((arg) => {
            if (typeof arg === "object") {
              try {
                return JSON.stringify(arg);
              } catch {
                return "[Circular/Object]";
              }
            }
            return String(arg);
          })
          .join(" ");
      } catch (e) {
        argsStr = "[Error stringifying args]";
      }
    }

    entry.innerHTML = `
            <span style="color: #666; margin-right: 8px;">[${timestamp}]</span>
            <span style="color: #aaa; margin-right: 8px; font-weight: bold;">[${moduleName}]</span>
            <span style="margin-right: 8px;">${message}</span>
            <span style="color: #888; overflow-wrap: break-word; word-break: break-all;">${argsStr}</span>
        `;

    this.logList.appendChild(entry);

    // Limit number of logs to prevent memory issues
    if (this.logList.children.length > 1000) {
      this.logList.removeChild(this.logList.children[0]);
    }

    // Auto scroll if close to bottom
    if (this.container.scrollTop + this.container.clientHeight >= this.container.scrollHeight - 50) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  private getColorForLevel(level: LogLevel): string {
    switch (level) {
      case "debug":
        return "#888";
      case "info":
        return "#fff";
      case "warn":
        return "#fa0";
      case "error":
        return "#f44";
    }
  }

  public toggle() {
    this.isVisible = !this.isVisible;
    this.container.style.display = this.isVisible ? "block" : "none";
  }
}
