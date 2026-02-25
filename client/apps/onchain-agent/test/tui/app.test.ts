import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tuiMocks = vi.hoisted(() => {
  const state = {
    onData: undefined as ((data: string) => void) | undefined,
    onResize: undefined as (() => void) | undefined,
    inputListener: undefined as ((data: string) => { consume: boolean } | void) | undefined,
    subscribeCallback: undefined as ((event: any) => void) | undefined,
    unsubscribe: vi.fn(),
    lastTui: undefined as any,
  };

  class MockProcessTerminal {
    start = vi.fn((onData: (data: string) => void, onResize: () => void) => {
      state.onData = onData;
      state.onResize = onResize;
    });
    hideCursor = vi.fn();
  }

  class MockContainer {
    children: any[] = [];
    addChild(child: any) {
      this.children.push(child);
    }
  }

  class MockText {
    text = "";
    constructor(text = "") {
      this.text = text;
    }
    setText(next: string) {
      this.text = next;
    }
  }

  class MockMarkdown {
    markdown = "";
    constructor(markdown = "") {
      this.markdown = markdown;
    }
  }

  class MockTUI {
    children: any[] = [];
    handleInput = vi.fn();
    requestRender = vi.fn();
    start = vi.fn();
    stop = vi.fn();
    constructor(_terminal: any) {
      state.lastTui = this;
    }
    addChild(child: any) {
      this.children.push(child);
    }
    addInputListener(cb: (data: string) => { consume: boolean } | void) {
      state.inputListener = cb;
      state.onData = (data: string) => {
        cb(data);
      };
    }
  }

  return {
    state,
    MockProcessTerminal,
    MockContainer,
    MockText,
    MockMarkdown,
    MockTUI,
  };
});

vi.mock("@mariozechner/pi-tui", () => ({
  TUI: tuiMocks.MockTUI,
  ProcessTerminal: tuiMocks.MockProcessTerminal,
  Container: tuiMocks.MockContainer,
  Text: tuiMocks.MockText,
  Markdown: tuiMocks.MockMarkdown,
}));

const { createApp } = await import("../../src/tui/app");

function createAgent(opts?: { isStreaming?: boolean; promptReject?: string }) {
  const prompt = opts?.promptReject
    ? vi.fn().mockRejectedValue(new Error(opts.promptReject))
    : vi.fn().mockResolvedValue(undefined);
  const steer = vi.fn();

  const agent = {
    state: { isStreaming: Boolean(opts?.isStreaming) },
    prompt,
    steer,
    subscribe: vi.fn((cb: (event: any) => void) => {
      tuiMocks.state.subscribeCallback = cb;
      return tuiMocks.state.unsubscribe;
    }),
  } as any;

  return { agent, prompt, steer };
}

describe("createApp", () => {
  let processKillSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    processKillSpy = vi.spyOn(process, "kill").mockImplementation(() => true as any);
    tuiMocks.state.onData = undefined;
    tuiMocks.state.onResize = undefined;
    tuiMocks.state.inputListener = undefined;
    tuiMocks.state.subscribeCallback = undefined;
    tuiMocks.state.unsubscribe.mockClear();
  });

  afterEach(() => {
    processKillSpy.mockRestore();
    vi.clearAllMocks();
  });

  it("prompts the agent when Enter is pressed in non-streaming mode", async () => {
    const { agent, prompt } = createAgent({ isStreaming: false });
    const ticker = { tickCount: 3 } as any;

    const app = createApp({ agent, ticker });

    tuiMocks.state.onData!("h");
    tuiMocks.state.onData!("i");
    tuiMocks.state.onData!("\n");

    expect(prompt).toHaveBeenCalledWith("hi");

    const chat = tuiMocks.state.lastTui.children[1];
    expect(chat.children.some((c: any) => c.text === "[You] hi")).toBe(true);

    app.dispose();
  });

  it("steers the agent when streaming", () => {
    const { agent, prompt, steer } = createAgent({ isStreaming: true });
    const ticker = { tickCount: 7 } as any;

    createApp({ agent, ticker });

    tuiMocks.state.onData!("g");
    tuiMocks.state.onData!("o");
    tuiMocks.state.onData!("\r");

    expect(prompt).not.toHaveBeenCalled();
    expect(steer).toHaveBeenCalledOnce();
    expect(steer.mock.calls[0][0].content[0].text).toBe("go");
  });

  it("renders prompt errors in chat", async () => {
    const { agent } = createAgent({ isStreaming: false, promptReject: "boom" });
    const ticker = { tickCount: 1 } as any;

    createApp({ agent, ticker });

    tuiMocks.state.onData!("x");
    tuiMocks.state.onData!("\n");
    await Promise.resolve();

    const chat = tuiMocks.state.lastTui.children[1];
    expect(chat.children.some((c: any) => c.text === "[Error] boom")).toBe(true);
  });

  it("ignores Ctrl+C input in terminal handler", () => {
    const { agent, prompt, steer } = createAgent({ isStreaming: false });
    const ticker = { tickCount: 1 } as any;

    createApp({ agent, ticker });

    tuiMocks.state.onData!("\x03");

    expect(prompt).not.toHaveBeenCalled();
    expect(steer).not.toHaveBeenCalled();
    expect(processKillSpy).toHaveBeenCalledWith(process.pid, "SIGINT");
  });

  it("handles backspace by editing the current input buffer", () => {
    const { agent } = createAgent({ isStreaming: false });
    const ticker = { tickCount: 1 } as any;

    createApp({ agent, ticker });

    tuiMocks.state.onData!("a");
    tuiMocks.state.onData!("b");
    tuiMocks.state.onData!("\x7f");
    tuiMocks.state.onData!("\n");

    expect(agent.prompt).toHaveBeenCalledWith("a");
  });

  it("renders agent events and disposes cleanly", () => {
    const { agent } = createAgent({ isStreaming: false });
    const ticker = { tickCount: 10 } as any;

    const app = createApp({ agent, ticker });

    tuiMocks.state.subscribeCallback!({ type: "agent_start" });
    tuiMocks.state.subscribeCallback!({
      type: "message_end",
      message: { role: "assistant", content: [{ type: "text", text: "Hello" }] },
    });
    tuiMocks.state.subscribeCallback!({
      type: "tool_execution_start",
      toolName: "observe_game",
      args: { x: 1 },
    });
    tuiMocks.state.subscribeCallback!({
      type: "tool_execution_end",
      toolName: "observe_game",
      isError: false,
    });
    tuiMocks.state.subscribeCallback!({
      type: "tool_execution_end",
      toolName: "execute_action",
      isError: true,
    });
    tuiMocks.state.subscribeCallback!({ type: "agent_end" });

    const chat = tuiMocks.state.lastTui.children[1];
    expect(chat.children.some((c: any) => c.text === "[Agent] Starting...")).toBe(true);
    expect(chat.children.some((c: any) => c.markdown === "Hello")).toBe(true);
    expect(chat.children.some((c: any) => c.text?.includes("-> observe_game"))).toBe(true);
    expect(chat.children.some((c: any) => c.text === "  v observe_game done")).toBe(true);
    expect(chat.children.some((c: any) => c.text === "  x execute_action done")).toBe(true);
    expect(chat.children.some((c: any) => c.text === "[Agent] Done.\n")).toBe(true);

    app.dispose();

    expect(tuiMocks.state.unsubscribe).toHaveBeenCalledOnce();
    expect(tuiMocks.state.lastTui.stop).toHaveBeenCalledOnce();
  });
});
