import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CODEHER",
    short_name: "CODEHER",
    description: "Aprende a programar en español con Python y pseudocódigo.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f7f7f7",
    theme_color: "#9b5de5",
    lang: "es-MX",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
