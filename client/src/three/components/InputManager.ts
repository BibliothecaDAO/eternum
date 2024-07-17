export class InputManager {
  private resizeHandler: ((event: UIEvent) => void) | null = null;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;
  private mousemoveHandler: ((event: MouseEvent) => void) | null = null;
  private dblclickHandler: ((event: MouseEvent) => void) | null = null;
  private onTransitionToMainScene!: () => void;

  initListeners(
    onResize: (event: UIEvent) => void,
    onMouseMove: (event: MouseEvent) => void,
    onDoubleClick: (event: MouseEvent) => void,
    onTransitionToMainScene: () => void,
    onClick: (event: MouseEvent) => void,
    onRightClick: (event: MouseEvent) => void,
    onKeyDown: (event: KeyboardEvent) => void,
  ): void {
    this.resizeHandler = onResize;
    this.mousemoveHandler = (event: MouseEvent) => {
      onMouseMove(event);
    };
    this.dblclickHandler = onDoubleClick;
    this.onTransitionToMainScene = onTransitionToMainScene;

    window.addEventListener("resize", this.resizeHandler);
    window.addEventListener("mousemove", this.mousemoveHandler);
    window.addEventListener("dblclick", this.dblclickHandler);
    window.addEventListener("click", onClick);
    window.addEventListener("contextmenu", onRightClick);
    window.addEventListener("keydown", onKeyDown);
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
