/**
 * Announced on `window` by the frame of a full-screen scene (SceneRoute) each time the address it shows changes and
 * once more when it leaves the page. The app's own navigation moves history without any event of the browser's, so
 * this is how a renderer that outlives its route learns that the page is no longer its own.
 */
export const SCENE_ADDRESS_EVENT = "sceneAddressChanged";
