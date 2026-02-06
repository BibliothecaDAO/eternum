import type { Agent, AgentEvent } from "@mariozechner/pi-agent-core";
import {
  TUI,
  ProcessTerminal,
  Container,
  Text,
  Markdown,
} from "@mariozechner/pi-tui";
import type { TickLoop } from "@mariozechner/pi-onchain-agent";

export interface AppState {
  agent: Agent;
  ticker: TickLoop;
}

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
  const header = new Text();
  header.text = formatHeader(state.ticker.tickCount, false);

  // -- Chat container (event log) --
  const chat = new Container();
  const welcomeMsg = new Text();
  welcomeMsg.text = "Eternum Agent started. Waiting for first tick...\nType a message and press Enter to steer the agent.\nPress Ctrl+C to exit.\n";
  chat.addChild(welcomeMsg);

  // -- Input area --
  const inputLabel = new Text();
  inputLabel.text = "> ";
  let inputBuffer = "";

  // -- Assemble layout --
  tui.addChild(header);
  tui.addChild(chat);
  tui.addChild(inputLabel);

  // -- Subscribe to agent events --
  const unsubscribe = state.agent.subscribe((event: AgentEvent) => {
    handleAgentEvent(event, chat, tui);
    header.text = formatHeader(state.ticker.tickCount, state.agent.state.isStreaming);
    tui.requestRender();
  });

  // -- Handle keyboard input --
  const originalHandleInput = tui.handleInput?.bind(tui);

  // Override to capture user text input
  terminal.start(
    (data: string) => {
      // Ctrl+C
      if (data === "\x03") {
        return; // Let the process SIGINT handler deal with it
      }

      // Enter key
      if (data === "\r" || data === "\n") {
        if (inputBuffer.trim()) {
          const userMsg = inputBuffer.trim();
          inputBuffer = "";
          inputLabel.text = "> ";

          // Add user message to chat
          const userText = new Text();
          userText.text = `[You] ${userMsg}`;
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
              const errText = new Text();
              errText.text = `[Error] ${err.message}`;
              chat.addChild(errText);
              tui.requestRender();
            });
          }

          tui.requestRender();
        }
        return;
      }

      // Backspace
      if (data === "\x7f" || data === "\b") {
        if (inputBuffer.length > 0) {
          inputBuffer = inputBuffer.slice(0, -1);
          inputLabel.text = `> ${inputBuffer}`;
          tui.requestRender();
        }
        return;
      }

      // Regular character input
      if (data.length === 1 && data.charCodeAt(0) >= 32) {
        inputBuffer += data;
        inputLabel.text = `> ${inputBuffer}`;
        tui.requestRender();
      }
    },
    () => tui.requestRender(),
  );

  terminal.hideCursor();
  tui.requestRender();

  return {
    tui,
    terminal,
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
      const text = new Text();
      text.text = "[Agent] Starting...";
      chat.addChild(text);
      break;
    }
    case "agent_end": {
      const text = new Text();
      text.text = "[Agent] Done.\n";
      chat.addChild(text);
      break;
    }
    case "message_end": {
      if (event.message.role === "assistant") {
        const content = event.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text.trim()) {
              const md = new Markdown();
              md.markdown = block.text;
              chat.addChild(md);
            }
          }
        }
      }
      break;
    }
    case "tool_execution_start": {
      const text = new Text();
      text.text = `  -> ${event.toolName}(${JSON.stringify(event.args).slice(0, 100)})`;
      chat.addChild(text);
      break;
    }
    case "tool_execution_end": {
      const icon = event.isError ? "x" : "v";
      const text = new Text();
      text.text = `  ${icon} ${event.toolName} done`;
      chat.addChild(text);
      break;
    }
  }
}
