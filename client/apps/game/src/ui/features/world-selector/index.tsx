class LandingWorldSelectionRedirectError extends Error {
  constructor() {
    super("Redirecting to the landing page for world selection.");
    this.name = "LandingWorldSelectionRedirectError";
  }
}

export const redirectToLandingWorldSelection = (): never => {
  if (typeof window !== "undefined") {
    window.location.assign("/");
  }

  throw new LandingWorldSelectionRedirectError();
};
