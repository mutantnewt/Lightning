import { publicApiRoutes } from "../../../contracts/api";

export const publicRouteManifest = [
  {
    method: "GET",
    path: publicApiRoutes.health,
    description: "Surface health check",
  },
  {
    method: "GET",
    path: publicApiRoutes.books,
    description: "Public catalog browse/search endpoint",
  },
] as const;
