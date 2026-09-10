import { useTooltipStore } from "@/hooks/store/use-tooltip-store";
import { SceneManager } from "@/three/scene-manager";
import {
  TOUCH_POINTER_EVENT_TYPES,
  TouchGestureRecognizer,
  toTouchPointerSample,
  type TouchGesture,
} from "@/three/utils/touch-gesture-recognizer";
import * as THREE from "three";
import { SceneName } from "../types";

type ListenerTypes = "click" | "mousemove" | "contextmenu" | "dblclick" | "mousedown";
type InputCallback = (event: MouseEvent, raycaster: THREE.Raycaster) => void;

interface InputListener {
  callback: InputCallback;
  event: ListenerTypes;
  handler: (event: MouseEvent) => void;
}

export class InputManager {
  private listeners: InputListener[] = [];
  private isDragged = false;
  private currentDragListener: ((e: MouseEvent) => void) | null = null;
  private currentMouseUpListener: ((e: MouseEvent) => void) | null = null;
  private mouseDownHandler: (e: MouseEvent) => void;
  private surface: HTMLElement | null = null;
  private isActive = false;
  private isDestroyed = false;
  private latestMouseMoveEvent: MouseEvent | null = null;
  private mouseMoveFrameId: number | null = null;
  private mouseMoveFrameToken = 0;
  private readonly touchGestures: TouchGestureRecognizer;
  private readonly touchPointerHandler = (event: PointerEvent) => this.handleTouchPointerEvent(event);
  private latestTouchEvent: PointerEvent | null = null;
  private lastPointerWasTouch = false;
  private readonly cancelTouchGesture = () => this.resetTouchTracking();
  private readonly handleVisibilityChange = () => {
    if (document.hidden) this.resetTouchTracking();
  };

  constructor(
    private sceneName: SceneName,
    private sceneManager: SceneManager,
    private raycaster: THREE.Raycaster,
    private mouse: THREE.Vector2,
    private camera: THREE.Camera,
  ) {
    this.mouseDownHandler = this.handleMouseDown.bind(this);
    this.touchGestures = new TouchGestureRecognizer((gesture) => this.dispatchTouchGesture(gesture));
  }

  setSurface(surface: HTMLElement): void {
    if (this.surface === surface) {
      return;
    }

    if (this.isActive) {
      this.pauseListeners();
    }

    this.surface = surface;

    if (this.isActive) {
      this.restartListeners();
    }
  }

  activate(): void {
    if (this.isDestroyed || this.isActive) {
      return;
    }

    this.isActive = true;
    this.restartListeners();
  }

  deactivate(): void {
    if (!this.isActive) {
      return;
    }

    this.pauseListeners();
    this.cleanupDragListeners();
    this.isActive = false;
  }

  addListener(event: ListenerTypes, callback: InputCallback): void {
    const handler = (e: MouseEvent) => {
      if (this.sceneManager.getCurrentScene() !== this.sceneName) {
        return;
      }

      if (this.lastPointerWasTouch) {
        this.suppressNativeMouseEventAfterTouch(event, e);
        return;
      }

      if (event === "mousemove") {
        this.queueMouseMove(e);
        return;
      }

      this.processImmediateEvent(event, e, callback);
    };
    this.listeners.push({ callback, event, handler });
    if (this.isActive && this.surface) {
      this.surface.addEventListener(event, handler);
    }
  }

  private processImmediateEvent(event: ListenerTypes, mouseEvent: MouseEvent, callback: InputCallback): void {
    if (event === "contextmenu") {
      mouseEvent.preventDefault();
    }

    this.updatePointerRaycaster(mouseEvent);

    if (event === "click" && this.isDragged) {
      this.isDragged = false;
      return;
    }

    callback(mouseEvent, this.raycaster);
  }

  private queueMouseMove(mouseEvent: MouseEvent): void {
    this.latestMouseMoveEvent = mouseEvent;
    if (this.mouseMoveFrameId !== null) {
      return;
    }

    const frameToken = ++this.mouseMoveFrameToken;
    this.mouseMoveFrameId = window.requestAnimationFrame(() => {
      if (frameToken !== this.mouseMoveFrameToken) {
        return;
      }
      this.mouseMoveFrameId = null;
      this.processPendingMouseMove();
    });
  }

  private processPendingMouseMove(): void {
    const mouseEvent = this.latestMouseMoveEvent;
    this.latestMouseMoveEvent = null;

    if (!mouseEvent || !this.isActive || this.isDestroyed) {
      return;
    }
    if (this.sceneManager.getCurrentScene() !== this.sceneName) {
      return;
    }

    this.updatePointerRaycaster(mouseEvent);
    this.listeners.forEach((listener) => {
      if (listener.event === "mousemove") {
        listener.callback(mouseEvent, this.raycaster);
      }
    });
  }

  private updatePointerRaycaster(mouseEvent: MouseEvent): void {
    const bounds = this.surface?.getBoundingClientRect();
    const width = bounds?.width || window.innerWidth;
    const height = bounds?.height || window.innerHeight;
    const left = bounds?.left || 0;
    const top = bounds?.top || 0;

    this.mouse.x = ((mouseEvent.clientX - left) / width) * 2 - 1;
    this.mouse.y = -((mouseEvent.clientY - top) / height) * 2 + 1;
    this.raycaster.setFromCamera(this.mouse, this.camera);
  }

  private cancelPendingMouseMove(): void {
    this.mouseMoveFrameToken += 1;
    if (this.mouseMoveFrameId !== null) {
      window.cancelAnimationFrame(this.mouseMoveFrameId);
      this.mouseMoveFrameId = null;
    }
    this.latestMouseMoveEvent = null;
  }

  restartListeners(): void {
    if (!this.surface) {
      return;
    }

    window.addEventListener("blur", this.cancelTouchGesture);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    this.surface.addEventListener("mousedown", this.mouseDownHandler);
    for (const listener of this.listeners) {
      this.surface.addEventListener(listener.event, listener.handler);
    }
    for (const pointerEventType of TOUCH_POINTER_EVENT_TYPES) {
      this.surface.addEventListener(pointerEventType, this.touchPointerHandler);
    }
  }

  pauseListeners(): void {
    this.cancelPendingMouseMove();
    this.resetTouchTracking();
    window.removeEventListener("blur", this.cancelTouchGesture);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    if (this.surface) {
      this.surface.removeEventListener("mousedown", this.mouseDownHandler);
    }

    for (const listener of this.listeners) {
      this.surface?.removeEventListener(listener.event, listener.handler);
    }
    for (const pointerEventType of TOUCH_POINTER_EVENT_TYPES) {
      this.surface?.removeEventListener(pointerEventType, this.touchPointerHandler);
    }
  }

  private handleTouchPointerEvent(event: PointerEvent): void {
    const sample = toTouchPointerSample(event);
    if (!sample) {
      if (event.type === "pointerdown") this.resetTouchTracking();
      this.lastPointerWasTouch = false;
      return;
    }

    if (sample.kind === "down") {
      // No compatibility mousedown/mousemove/mouseup for touch: the recognizer owns touch input.
      event.preventDefault();
      this.lastPointerWasTouch = true;
      this.isDragged = false;
    }

    this.latestTouchEvent = event;
    this.touchGestures.feed(sample);
  }

  /** Browsers still fire click (and, on Android, contextmenu) after a touch; the recognizer already handled it. */
  private suppressNativeMouseEventAfterTouch(event: ListenerTypes, mouseEvent: MouseEvent): void {
    if (event === "contextmenu") {
      mouseEvent.preventDefault();
    }
  }

  private dispatchTouchGesture(gesture: TouchGesture): void {
    if (gesture.kind === "pinch") return;
    const listenerType = gesture.kind === "tap" ? "click" : "contextmenu";
    const touchEvent = this.latestTouchEvent;
    if (!touchEvent || !this.isActive || this.isDestroyed) {
      return;
    }
    if (this.sceneManager.getCurrentScene() !== this.sceneName) {
      return;
    }

    // Use the recognized location: small finger drift must not retarget a held order across a hex boundary.
    const gestureEvent = new PointerEvent(listenerType, {
      clientX: gesture.x,
      clientY: gesture.y,
      pointerId: touchEvent.pointerId,
      pointerType: "touch",
      altKey: touchEvent.altKey,
      ctrlKey: touchEvent.ctrlKey,
      metaKey: touchEvent.metaKey,
      shiftKey: touchEvent.shiftKey,
      cancelable: true,
    });
    for (const listener of this.listeners) {
      if (listener.event === listenerType) {
        this.processImmediateEvent(listenerType, gestureEvent, listener.callback);
      }
    }
  }

  private resetTouchTracking(): void {
    this.touchGestures.reset();
    this.latestTouchEvent = null;
  }

  private handleMouseDown(e: MouseEvent): void {
    // Clean up any existing drag listeners to prevent race conditions
    this.cleanupDragListeners();

    const mouseX = e.clientX;
    const mouseY = e.clientY;
    this.isDragged = false;

    this.currentDragListener = (e: MouseEvent) => {
      if (Math.abs(mouseX - e.clientX) > 10 || Math.abs(mouseY - e.clientY) > 10) {
        this.isDragged = true;
        // Clear tooltip when dragging starts
        useTooltipStore.getState().setTooltip(null);
        this.cleanupDragListeners();
      }
    };

    this.currentMouseUpListener = () => {
      this.cleanupDragListeners();
    };

    window.addEventListener("mousemove", this.currentDragListener);
    window.addEventListener("mouseup", this.currentMouseUpListener, { once: true });
  }

  private cleanupDragListeners(): void {
    if (this.currentDragListener) {
      window.removeEventListener("mousemove", this.currentDragListener);
      this.currentDragListener = null;
    }
    if (this.currentMouseUpListener) {
      window.removeEventListener("mouseup", this.currentMouseUpListener);
      this.currentMouseUpListener = null;
    }
  }

  public destroy(): void {
    if (this.isDestroyed) {
      console.warn("InputManager already destroyed, skipping cleanup");
      return;
    }
    this.isDestroyed = true;

    this.pauseListeners();
    this.isActive = false;

    // Clean up any active drag listeners
    this.cleanupDragListeners();

    this.listeners = [];
    this.surface = null;
  }
}
