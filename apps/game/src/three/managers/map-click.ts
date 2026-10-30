/**
 * A mouse press is a click while its pointer stays this close to where it went down, as a hand's press travels a few
 * pixels, and the map does not move under it. Past it the press is a pan: the map follows from the press point and no
 * click is sent. The press decides alone, whatever else moves the camera (damping, the zoom, keys, flights). The map's
 * input and anything that answers the map's clicks (the HUD's chat) read it here.
 */
export const CLICK_SLOP_PX = 8;
