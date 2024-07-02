export class InputManager {
  private resizeHandler: ((event: UIEvent) => void) | null = null;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private mousemoveHandler: ((event: MouseEvent) => void) | null = null;
  private dblclickHandler: ((event: MouseEvent) => void) | null = null;
  private onTransitionToMainScene!: () => void;

  private currentScene: string;

  constructor(initialScene: string) {
    this.currentScene = initialScene;
    console.log("Input manager");
  }

  updateCurrentScene(newScene: string): void {
    this.currentScene = newScene;
  }

  initListeners(
    onResize: (event: UIEvent) => void,
    onKeyDown: (key: string) => void,
    onMouseMove: (event: MouseEvent) => void,
    onDoubleClick: (event: MouseEvent) => void,
    onTransitionToMainScene: () => void,
  ): void {
    this.resizeHandler = onResize;
    this.keydownHandler = (event: KeyboardEvent) => onKeyDown(event.key);
    this.mousemoveHandler = (event: MouseEvent) => {
      onMouseMove(event);
    };
    this.dblclickHandler = onDoubleClick;
    this.onTransitionToMainScene = onTransitionToMainScene;

    window.addEventListener("resize", this.resizeHandler);
    window.addEventListener("keydown", this.keydownHandler);
    window.addEventListener("mousemove", this.mousemoveHandler);
    window.addEventListener("dblclick", this.dblclickHandler);

    window.addEventListener("keydown", (event) => {
      const { key } = event;

      switch (key) {
        case "e":
          break;
        case "Escape":
          if (this.currentScene === "detailed") {
            this.onTransitionToMainScene();
          }
          break;
        default:
          break;
      }
    });
  }

  removeListeners(): void {
    if (this.resizeHandler) {
      window.removeEventListener("resize", this.resizeHandler);
    }
    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler);
    }
    if (this.mousemoveHandler) {
      window.removeEventListener("mousemove", this.mousemoveHandler);
    }
    if (this.dblclickHandler) {
      window.removeEventListener("dblclick", this.dblclickHandler);
    }
  }
}
