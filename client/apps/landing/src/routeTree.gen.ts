/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

import { createFileRoute } from '@tanstack/react-router'

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as TradeRouteImport } from './routes/trade/route'

// Create Virtual Routes

const SeasonPassesLazyImport = createFileRoute('/season-passes')()
const MintLazyImport = createFileRoute('/mint')()
const DataLazyImport = createFileRoute('/data')()
const ClaimLazyImport = createFileRoute('/claim')()
const IndexLazyImport = createFileRoute('/')()
const TradeIndexLazyImport = createFileRoute('/trade/')()
const TradeActivityLazyImport = createFileRoute('/trade/activity')()

// Create/Update Routes

const SeasonPassesLazyRoute = SeasonPassesLazyImport.update({
  id: '/season-passes',
  path: '/season-passes',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/season-passes.lazy').then((d) => d.Route))

const MintLazyRoute = MintLazyImport.update({
  id: '/mint',
  path: '/mint',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/mint.lazy').then((d) => d.Route))

const DataLazyRoute = DataLazyImport.update({
  id: '/data',
  path: '/data',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/data.lazy').then((d) => d.Route))

const ClaimLazyRoute = ClaimLazyImport.update({
  id: '/claim',
  path: '/claim',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/claim.lazy').then((d) => d.Route))

const TradeRouteRoute = TradeRouteImport.update({
  id: '/trade',
  path: '/trade',
  getParentRoute: () => rootRoute,
} as any)

const IndexLazyRoute = IndexLazyImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/index.lazy').then((d) => d.Route))

const TradeIndexLazyRoute = TradeIndexLazyImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => TradeRouteRoute,
} as any).lazy(() => import('./routes/trade/index.lazy').then((d) => d.Route))

const TradeActivityLazyRoute = TradeActivityLazyImport.update({
  id: '/activity',
  path: '/activity',
  getParentRoute: () => TradeRouteRoute,
} as any).lazy(() =>
  import('./routes/trade/activity.lazy').then((d) => d.Route),
)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexLazyImport
      parentRoute: typeof rootRoute
    }
    '/trade': {
      id: '/trade'
      path: '/trade'
      fullPath: '/trade'
      preLoaderRoute: typeof TradeRouteImport
      parentRoute: typeof rootRoute
    }
    '/claim': {
      id: '/claim'
      path: '/claim'
      fullPath: '/claim'
      preLoaderRoute: typeof ClaimLazyImport
      parentRoute: typeof rootRoute
    }
    '/data': {
      id: '/data'
      path: '/data'
      fullPath: '/data'
      preLoaderRoute: typeof DataLazyImport
      parentRoute: typeof rootRoute
    }
    '/mint': {
      id: '/mint'
      path: '/mint'
      fullPath: '/mint'
      preLoaderRoute: typeof MintLazyImport
      parentRoute: typeof rootRoute
    }
    '/season-passes': {
      id: '/season-passes'
      path: '/season-passes'
      fullPath: '/season-passes'
      preLoaderRoute: typeof SeasonPassesLazyImport
      parentRoute: typeof rootRoute
    }
    '/trade/activity': {
      id: '/trade/activity'
      path: '/activity'
      fullPath: '/trade/activity'
      preLoaderRoute: typeof TradeActivityLazyImport
      parentRoute: typeof TradeRouteImport
    }
    '/trade/': {
      id: '/trade/'
      path: '/'
      fullPath: '/trade/'
      preLoaderRoute: typeof TradeIndexLazyImport
      parentRoute: typeof TradeRouteImport
    }
  }
}

// Create and export the route tree

interface TradeRouteRouteChildren {
  TradeActivityLazyRoute: typeof TradeActivityLazyRoute
  TradeIndexLazyRoute: typeof TradeIndexLazyRoute
}

const TradeRouteRouteChildren: TradeRouteRouteChildren = {
  TradeActivityLazyRoute: TradeActivityLazyRoute,
  TradeIndexLazyRoute: TradeIndexLazyRoute,
}

const TradeRouteRouteWithChildren = TradeRouteRoute._addFileChildren(
  TradeRouteRouteChildren,
)

export interface FileRoutesByFullPath {
  '/': typeof IndexLazyRoute
  '/trade': typeof TradeRouteRouteWithChildren
  '/claim': typeof ClaimLazyRoute
  '/data': typeof DataLazyRoute
  '/mint': typeof MintLazyRoute
  '/season-passes': typeof SeasonPassesLazyRoute
  '/trade/activity': typeof TradeActivityLazyRoute
  '/trade/': typeof TradeIndexLazyRoute
}

export interface FileRoutesByTo {
  '/': typeof IndexLazyRoute
  '/claim': typeof ClaimLazyRoute
  '/data': typeof DataLazyRoute
  '/mint': typeof MintLazyRoute
  '/season-passes': typeof SeasonPassesLazyRoute
  '/trade/activity': typeof TradeActivityLazyRoute
  '/trade': typeof TradeIndexLazyRoute
}

export interface FileRoutesById {
  __root__: typeof rootRoute
  '/': typeof IndexLazyRoute
  '/trade': typeof TradeRouteRouteWithChildren
  '/claim': typeof ClaimLazyRoute
  '/data': typeof DataLazyRoute
  '/mint': typeof MintLazyRoute
  '/season-passes': typeof SeasonPassesLazyRoute
  '/trade/activity': typeof TradeActivityLazyRoute
  '/trade/': typeof TradeIndexLazyRoute
}

export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/trade'
    | '/claim'
    | '/data'
    | '/mint'
    | '/season-passes'
    | '/trade/activity'
    | '/trade/'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/claim'
    | '/data'
    | '/mint'
    | '/season-passes'
    | '/trade/activity'
    | '/trade'
  id:
    | '__root__'
    | '/'
    | '/trade'
    | '/claim'
    | '/data'
    | '/mint'
    | '/season-passes'
    | '/trade/activity'
    | '/trade/'
  fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
  IndexLazyRoute: typeof IndexLazyRoute
  TradeRouteRoute: typeof TradeRouteRouteWithChildren
  ClaimLazyRoute: typeof ClaimLazyRoute
  DataLazyRoute: typeof DataLazyRoute
  MintLazyRoute: typeof MintLazyRoute
  SeasonPassesLazyRoute: typeof SeasonPassesLazyRoute
}

const rootRouteChildren: RootRouteChildren = {
  IndexLazyRoute: IndexLazyRoute,
  TradeRouteRoute: TradeRouteRouteWithChildren,
  ClaimLazyRoute: ClaimLazyRoute,
  DataLazyRoute: DataLazyRoute,
  MintLazyRoute: MintLazyRoute,
  SeasonPassesLazyRoute: SeasonPassesLazyRoute,
}

export const routeTree = rootRoute
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/trade",
        "/claim",
        "/data",
        "/mint",
        "/season-passes"
      ]
    },
    "/": {
      "filePath": "index.lazy.tsx"
    },
    "/trade": {
      "filePath": "trade/route.tsx",
      "children": [
        "/trade/activity",
        "/trade/"
      ]
    },
    "/claim": {
      "filePath": "claim.lazy.tsx"
    },
    "/data": {
      "filePath": "data.lazy.tsx"
    },
    "/mint": {
      "filePath": "mint.lazy.tsx"
    },
    "/season-passes": {
      "filePath": "season-passes.lazy.tsx"
    },
    "/trade/activity": {
      "filePath": "trade/activity.lazy.tsx",
      "parent": "/trade"
    },
    "/trade/": {
      "filePath": "trade/index.lazy.tsx",
      "parent": "/trade"
    }
  }
}
ROUTE_MANIFEST_END */
