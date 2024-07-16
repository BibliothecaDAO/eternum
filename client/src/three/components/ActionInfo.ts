export class ActionInfo {
  private hoverMessage: HTMLDivElement;

  constructor() {
    this.hoverMessage = document.createElement("div");
    this.hoverMessage.style.position = "absolute";
    this.hoverMessage.style.padding = "5px";
    this.hoverMessage.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    this.hoverMessage.style.color = "white";
    this.hoverMessage.style.borderRadius = "5px";
    this.hoverMessage.style.pointerEvents = "none";
    this.hoverMessage.style.display = "none";
    document.body.appendChild(this.hoverMessage);
  }

  showHoverMessage(message: string, x: number, y: number) {
    this.hoverMessage.textContent = message;
    this.hoverMessage.style.left = `${x + 10}px`;
    this.hoverMessage.style.top = `${y + 10}px`;
    this.hoverMessage.style.display = "block";
  }

  hideHoverMessage() {
    this.hoverMessage.style.display = "none";
  }
}
