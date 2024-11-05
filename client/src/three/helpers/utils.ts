import { DRACOLoader, GLTFLoader } from "three-stdlib";

export function createPausedLabel() {
  const div = document.createElement("div");
  div.classList.add("rounded-md", "bg-brown/50", "text-gold", "p-1", "-translate-x-1/2", "text-xs");
  div.textContent = `⚠️ Production paused`;
  return div;
}

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.5/");
dracoLoader.preload();

export const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);
