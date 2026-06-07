import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MoneyFlow — money tracker",
    short_name: "MoneyFlow",
    description: "Track what you spend and earn, by day, week, month and year.",
    start_url: "/",
    display: "standalone",
    background_color: "#100f0c",
    theme_color: "#100f0c",
    orientation: "portrait",
  };
}
