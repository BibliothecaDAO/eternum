import { Vector2 } from "three";

/**
 * WindSystem - Unified wind simulation that drives multiple atmospheric systems
 *
 * Provides a single source of truth for wind direction and speed that can be
 * consumed by:
 * - Rain particles (drift direction)
 * - Cloud scrolling (future)
 * - Vegetation sway (future)
 * - Audio panning/filtering
 *
 * Wind behavior:
 * - Base wind direction rotates slowly over time
 * - Gusts add temporary speed increases
 * - Storm weather increases base speed and gust frequency
 */

export interface WindState {
  /** Normalized wind direction (x, z plane) */
  direction: Vector2;
  /** Wind speed 0-1, where 0 = calm, 1 = storm-force */
  speed: number;
  /** Current gust multiplier 1-2 */
  gustMultiplier: number;
  /** Combined effective speed (speed * gustMultiplier) */
  effectiveSpeed: number;
}

interface WindParams {
  /** Base wind speed when weather is calm (0-1) */
  baseSpeed: number;
  /** Maximum wind speed during storms (0-1) */
  stormSpeed: number;
  /** How fast the wind direction rotates (radians per second) */
  directionRotationSpeed: number;
  /** How often gusts occur (seconds between gusts) */
  gustIntervalMin: number;
  gustIntervalMax: number;
  /** How long a gust lasts (seconds) */
  gustDuration: number;
  /** Maximum gust strength multiplier */
  gustStrengthMax: number;
  /** How quickly wind responds to weather changes */
  weatherResponseSpeed: number;
}

export class WindSystem {
  private direction: Vector2 = new Vector2(1, 0);
  private targetDirection: Vector2 = new Vector2(1, 0);
  private currentSpeed: number = 0.2;
  private targetSpeed: number = 0.2;
  private gustMultiplier: number = 1.0;
  private gustTimer: number = 0;
  private gustDurationRemaining: number = 0;
  private directionAngle: number = 0;
  private targetDirectionAngle: number = 0;
  private directionChangeTimer: number = 0;

  private params: WindParams = {
    baseSpeed: 0.15,
    stormSpeed: 0.85,
    directionRotationSpeed: 0.02,
    gustIntervalMin: 4,
    gustIntervalMax: 12,
    gustDuration: 1.5,
    gustStrengthMax: 1.8,
    weatherResponseSpeed: 0.5,
  };

  // Reusable state object to avoid allocations
  private stateCache: WindState = {
    direction: new Vector2(1, 0),
    speed: 0.2,
    gustMultiplier: 1.0,
    effectiveSpeed: 0.2,
  };

  constructor() {
    // Initialize with random direction
    this.directionAngle = Math.random() * Math.PI * 2;
    this.targetDirectionAngle = this.directionAngle;
    this.updateDirectionFromAngle();
    this.scheduleNextDirectionChange();
    this.scheduleNextGust();
  }

  /**
   * Update wind simulation
   * @param deltaTime - Time since last frame in seconds
   * @param weatherIntensity - Current weather intensity (0 = clear, 1 = storm)
   */
  update(deltaTime: number, weatherIntensity: number): void {
    // Update target speed based on weather
    this.targetSpeed = this.lerp(this.params.baseSpeed, this.params.stormSpeed, weatherIntensity);

    // Smoothly interpolate current speed toward target
    this.currentSpeed = this.lerp(
      this.currentSpeed,
      this.targetSpeed,
      deltaTime * this.params.weatherResponseSpeed,
    );

    // Update wind direction (slow rotation)
    this.updateDirection(deltaTime);

    // Update gusts
    this.updateGusts(deltaTime, weatherIntensity);
  }

  private updateDirection(deltaTime: number): void {
    // Check if it's time for a new direction target
    this.directionChangeTimer -= deltaTime;
    if (this.directionChangeTimer <= 0) {
      this.scheduleNextDirectionChange();
    }

    // Smoothly rotate toward target direction
    const angleDiff = this.normalizeAngle(this.targetDirectionAngle - this.directionAngle);
    const maxRotation = this.params.directionRotationSpeed * deltaTime;

    if (Math.abs(angleDiff) < maxRotation) {
      this.directionAngle = this.targetDirectionAngle;
    } else {
      this.directionAngle += Math.sign(angleDiff) * maxRotation;
    }

    this.directionAngle = this.normalizeAngle(this.directionAngle);
    this.updateDirectionFromAngle();
  }

  private updateGusts(deltaTime: number, weatherIntensity: number): void {
    // Active gust
    if (this.gustDurationRemaining > 0) {
      this.gustDurationRemaining -= deltaTime;

      // Gust envelope: quick attack, slow release
      const gustProgress = 1 - (this.gustDurationRemaining / this.params.gustDuration);
      const gustEnvelope = gustProgress < 0.2
        ? gustProgress / 0.2 // Attack
        : 1 - ((gustProgress - 0.2) / 0.8); // Release

      const gustStrength = 1 + (this.params.gustStrengthMax - 1) * gustEnvelope * weatherIntensity;
      this.gustMultiplier = this.lerp(this.gustMultiplier, gustStrength, deltaTime * 8);

      if (this.gustDurationRemaining <= 0) {
        this.scheduleNextGust();
      }
    } else {
      // No active gust - decay multiplier back to 1
      this.gustMultiplier = this.lerp(this.gustMultiplier, 1.0, deltaTime * 2);

      // Check for next gust
      this.gustTimer -= deltaTime;
      if (this.gustTimer <= 0) {
        this.triggerGust();
      }
    }
  }

  private scheduleNextDirectionChange(): void {
    // Schedule next direction change in 10-30 seconds
    this.directionChangeTimer = 10 + Math.random() * 20;

    // Pick a new target direction (within 90 degrees of current)
    const angleChange = (Math.random() - 0.5) * Math.PI * 0.5;
    this.targetDirectionAngle = this.normalizeAngle(this.directionAngle + angleChange);
  }

  private scheduleNextGust(): void {
    this.gustTimer = this.params.gustIntervalMin +
      Math.random() * (this.params.gustIntervalMax - this.params.gustIntervalMin);
    this.gustDurationRemaining = 0;
  }

  private triggerGust(): void {
    this.gustDurationRemaining = this.params.gustDuration;
  }

  private updateDirectionFromAngle(): void {
    this.direction.set(Math.cos(this.directionAngle), Math.sin(this.directionAngle));
    this.targetDirection.copy(this.direction);
  }

  private normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * Math.min(1, Math.max(0, t));
  }

  /**
   * Get current wind state (reuses cached object to avoid allocations)
   */
  getState(): WindState {
    this.stateCache.direction.copy(this.direction);
    this.stateCache.speed = this.currentSpeed;
    this.stateCache.gustMultiplier = this.gustMultiplier;
    this.stateCache.effectiveSpeed = this.currentSpeed * this.gustMultiplier;
    return this.stateCache;
  }

  /**
   * Get wind direction as a normalized Vector2
   */
  getDirection(): Vector2 {
    return this.direction;
  }

  /**
   * Get current wind speed (0-1)
   */
  getSpeed(): number {
    return this.currentSpeed;
  }

  /**
   * Get effective wind speed including gusts
   */
  getEffectiveSpeed(): number {
    return this.currentSpeed * this.gustMultiplier;
  }

  /**
   * Get wind as a 3D vector for particle systems (x, 0, z)
   */
  getWindVector3(out?: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const effectiveSpeed = this.getEffectiveSpeed();
    const result = out || { x: 0, y: 0, z: 0 };
    result.x = this.direction.x * effectiveSpeed;
    result.y = 0;
    result.z = this.direction.y * effectiveSpeed;
    return result;
  }

  /**
   * Force a gust (useful for storm intensification)
   */
  forceGust(): void {
    this.triggerGust();
  }

  /**
   * Set parameters
   */
  setParams(params: Partial<WindParams>): void {
    Object.assign(this.params, params);
  }

  /**
   * Add GUI controls for debugging
   */
  addGUIControls(guiFolder: any): void {
    const windFolder = guiFolder.addFolder("Wind System");

    // Display current values
    const displayValues = {
      direction: 0,
      speed: 0,
      gustMultiplier: 1,
      effectiveSpeed: 0,
    };

    windFolder.add(displayValues, "direction").name("Direction (deg)").listen();
    windFolder.add(displayValues, "speed").name("Speed").listen();
    windFolder.add(displayValues, "gustMultiplier").name("Gust Mult").listen();
    windFolder.add(displayValues, "effectiveSpeed").name("Effective Speed").listen();

    // Update display values periodically
    setInterval(() => {
      displayValues.direction = Math.round((this.directionAngle * 180) / Math.PI);
      displayValues.speed = Math.round(this.currentSpeed * 100) / 100;
      displayValues.gustMultiplier = Math.round(this.gustMultiplier * 100) / 100;
      displayValues.effectiveSpeed = Math.round(this.getEffectiveSpeed() * 100) / 100;
    }, 100);

    // Controls
    windFolder.add(this.params, "baseSpeed", 0, 0.5, 0.01).name("Base Speed");
    windFolder.add(this.params, "stormSpeed", 0.5, 1, 0.01).name("Storm Speed");
    windFolder.add(this.params, "gustIntervalMin", 1, 10, 0.5).name("Gust Interval Min");
    windFolder.add(this.params, "gustIntervalMax", 5, 20, 1).name("Gust Interval Max");
    windFolder.add(this.params, "gustStrengthMax", 1, 3, 0.1).name("Gust Strength Max");

    windFolder.add({ forceGust: () => this.forceGust() }, "forceGust").name("Force Gust");

    windFolder.close();
  }

  dispose(): void {
    // Nothing to dispose - no event listeners or resources
  }
}
