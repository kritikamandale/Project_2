import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const publicRoutes = ["", "/login", "/register", "/privacy", "/terms"];

  return publicRoutes.map((route) => ({
    url: `${APP_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.5,
  }));
}
