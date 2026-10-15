import { icons } from "../../../../../asset-sources/icon-study-painted/catalog.json";
export const iconArt = (direction: string, id: string, size = 64) =>
  direction === "shipped"
    ? `/${icons.find((icon) => icon.id === id)!.old}`
    : `/lab-icons/new/${direction}/${size}/${id}.png`;
