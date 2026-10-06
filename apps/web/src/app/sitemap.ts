import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { SHORT_DOMAIN } from "@/lib/constants";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  let domain = headersList.get("host") as string;

  if (domain.endsWith(".vercel.app")) {
    // for preview URLs
    domain = SHORT_DOMAIN;
  }

  return [
    {
      url: `https://${domain}`,
      lastModified: new Date(),
    },
  ];
}
