import type { MetadataRoute } from "next";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated app surfaces and API routes carry no SEO value and
        // must never be crawled/indexed — health data lives behind these.
        disallow: [
          "/api/",
          "/dashboard",
          "/scan",
          "/onboarding",
          "/questionnaire",
          "/results",
          "/roadmap",
          "/progress",
          "/history",
          "/profile",
          "/admin",
          "/derm-dashboard",
          "/review-queue",
          "/case",
        ],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
