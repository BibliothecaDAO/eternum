import type { Agent, AgentEvent } from "@mariozechner/pi-agent-core";
import { TUI, ProcessTerminal, Container, Text, Markdown, type MarkdownTheme } from "@mariozechner/pi-tui";
import type { TickLoop } from "@bibliothecadao/game-agent";

interface AppState {
  agent: Agent;
  ticker: TickLoop;
}

const defaultMarkdownTheme: MarkdownTheme = {
  heading: (t: string) => t,
  link: (t: string) => t,
  linkUrl: (t: string) => t,
  code: (t: string) => t,
  codeBlock: (t: string) => t,
  codeBlockBorder: (t: string) => t,
  quote: (t: string) => t,
  quoteBorder: (t: string) => t,
  hr: (t: string) => t,
  listBullet: (t: string) => t,
  bold: (t: string) => t,
  italic: (t: string) => t,
  strikethrough: (t: string) => t,
  underline: (t: string) => t,
};

/**
 * Create and start the TUI for the Eternum agent.
 *
 * Layout:
 * - Header: status bar with tick count and agent state
 * - Chat: scrolling log of agent events, tool calls, decisions
 * - Editor area: user input for steering/prompting
 */
export function createApp(state: AppState) {
  const terminal = new ProcessTerminal();
  const tui = new TUI(terminal);

  // -- Header --
  const header = new Text(formatHeader(state.ticker.tickCount, false));

  // -- Chat container (event log) --
  const chat = new Container();
  const welcomeMsg = new Text(
    "Eternum Agent started. Waiting for first tick...\nType a message and press Enter to steer the agent.\nPress Ctrl+C to exit.\n",
  );
  chat.addChild(welcomeMsg);

  // -- Input area --
  const inputLabel = new Text("> ");
  let inputBuffer = "";

  // -- Assemble layout --
  tui.addChild(header);
  tui.addChild(chat);
  tui.addChild(inputLabel);

  // -- Subscribe to agent events --
  const unsubscribe = state.agent.subscribe((event: AgentEvent) => {
    handleAgentEvent(event, chat, tui);
    header.setText(formatHeader(state.ticker.tickCount, state.agent.state.isStreaming));
    tui.requestRender();
  });

  // -- Handle keyboard input via public API --
  tui.addInputListener((data: string) => {
    // Ctrl+C
    if (data === "\x03") {
      return; // Let the process SIGINT handler deal with it
    }

    // Enter key
    if (data === "\r" || data === "\n") {
      if (inputBuffer.trim()) {
        const userMsg = inputBuffer.trim();
        inputBuffer = "";
        inputLabel.setText("> ");

        // Add user message to chat
        const userText = new Text(`[You] ${userMsg}`);
        chat.addChild(userText);

        // Send to agent
        if (state.agent.state.isStreaming) {
          state.agent.steer({
            role: "user",
            content: [{ type: "text", text: userMsg }],
            timestamp: Date.now(),
          });
        } else {
          state.agent.prompt(userMsg).catch((err: Error) => {
            const errText = new Text(`[Error] ${err.message}`);
            chat.addChild(errText);
            tui.requestRender();
          });
        }

        tui.requestRender();
      }
      return { consume: true };
    }

    // Backspace
    if (data === "\x7f" || data === "\b") {
      if (inputBuffer.length > 0) {
        inputBuffer = inputBuffer.slice(0, -1);
        inputLabel.setText(`> ${inputBuffer}`);
        tui.requestRender();
      }
      return { consume: true };
    }

    // Regular character input
    if (data.length === 1 && data.charCodeAt(0) >= 32) {
      inputBuffer += data;
      inputLabel.setText(`> ${inputBuffer}`);
      tui.requestRender();
      return { consume: true };
    }
  });

  terminal.start(
    () => {},
    () => tui.requestRender(),
  );

  terminal.hideCursor();
  tui.requestRender();

  return {
    tui,
    terminal,
    addSystemMessage(msg: string) {
      const text = new Text(`[System] ${msg}`);
      chat.addChild(text);
      tui.requestRender();
    },
    dispose() {
      unsubscribe();
      tui.stop();
    },
  };
}

function formatHeader(tickCount: number, isStreaming: boolean): string {
  const status = isStreaming ? "Thinking..." : "Idle";
  return `--- Eternum Agent | Tick ${tickCount} | ${status} ---\n`;
}

function handleAgentEvent(event: AgentEvent, chat: Container, tui: TUI) {
  switch (event.type) {
    case "agent_start": {
      const text = new Text("[Agent] Starting...");
      chat.addChild(text);
      break;
    }
    case "agent_end": {
      const text = new Text("[Agent] Done.\n");
      chat.addChild(text);
      break;
    }
    case "message_end": {
      if (event.message.role === "assistant") {
        const content = event.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text.trim()) {
              const md = new Markdown(block.text, 0, 0, defaultMarkdownTheme);
              chat.addChild(md);
            }
          }
        }
      }
      break;
    }
    case "tool_execution_start": {
      const text = new Text(`  -> ${event.toolName}(${JSON.stringify(event.args).slice(0, 100)})`);
      chat.addChild(text);
      break;
    }
    case "tool_execution_end": {
      const icon = event.isError ? "x" : "v";
      const text = new Text(`  ${icon} ${event.toolName} done`);
      chat.addChild(text);
      break;
    }
  }
}
