import { ROUTES } from "@/shared/consts/routes";

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];
