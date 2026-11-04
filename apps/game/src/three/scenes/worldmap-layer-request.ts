/**
 * The HUD asks the world map to look into another layer at a tile (the layer chooser: the World tab's list, a phone's
 * view switch). The map dives through the region's spire to it, as an army's crossing does (viewThroughSpire). The list
 * stands only on the map, so the map is shown when it is asked.
 */
export const LAYER_VIEW_REQUEST_EVENT = "layerViewRequest";

export type LayerViewRequest = { col: number; row: number };

export const requestLayerView = (to: LayerViewRequest): void => {
  window.dispatchEvent(new CustomEvent<LayerViewRequest>(LAYER_VIEW_REQUEST_EVENT, { detail: to }));
};
