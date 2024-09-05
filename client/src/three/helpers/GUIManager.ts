import GUI from "lil-gui";

export const GUIManager = new GUI({
  autoPlace: import.meta.env.DEV,
});

GUIManager.close();
