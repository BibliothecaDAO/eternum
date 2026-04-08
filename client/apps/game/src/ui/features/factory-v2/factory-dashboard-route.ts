export type FactoryDashboardVersion = "v1" | "v2";

const FACTORY_DASHBOARD_TAB = "factory";
const FACTORY_VERSION_SEARCH_PARAM = "factoryVersion";
const LEGACY_FACTORY_DASHBOARD_VERSION: FactoryDashboardVersion = "v1";
const FACTORY_V2_DASHBOARD_VERSION: FactoryDashboardVersion = "v2";

export const LEGACY_FACTORY_DASHBOARD_ROUTE = `/?tab=${FACTORY_DASHBOARD_TAB}&${FACTORY_VERSION_SEARCH_PARAM}=${LEGACY_FACTORY_DASHBOARD_VERSION}`;
export const FACTORY_V2_DASHBOARD_ROUTE = `/?tab=${FACTORY_DASHBOARD_TAB}&${FACTORY_VERSION_SEARCH_PARAM}=${FACTORY_V2_DASHBOARD_VERSION}`;

export const resolveFactoryDashboardVersion = (searchParams: URLSearchParams): FactoryDashboardVersion =>
  searchParams.get(FACTORY_VERSION_SEARCH_PARAM) === LEGACY_FACTORY_DASHBOARD_VERSION
    ? LEGACY_FACTORY_DASHBOARD_VERSION
    : FACTORY_V2_DASHBOARD_VERSION;

export const updateFactoryDashboardVersion = (
  searchParams: URLSearchParams,
  version: FactoryDashboardVersion,
): URLSearchParams => {
  const nextSearchParams = new URLSearchParams(searchParams);
  nextSearchParams.set("tab", FACTORY_DASHBOARD_TAB);
  nextSearchParams.set(FACTORY_VERSION_SEARCH_PARAM, version);
  return nextSearchParams;
};
