import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "YouthCamp Games",
    short_name: "YouthCamp",
    description: "Camp games, scoring, and play",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#18181b",
  };
}
