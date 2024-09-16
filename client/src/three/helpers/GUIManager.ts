import GUI from "lil-gui";

export const GUIManager = new GUI({
  autoPlace: import.meta.env.VITE_PUBLIC_DEV == "true",
});

GUIManager.close();
