import type { MetadataRoute } from "next";

/**
 * Lets visitors add AI MoMA to their home screen. Opened from there it runs
 * without the browser's bars, which on iPhone is the only way to see a
 * painting world full screen: Safari won't let a page go full screen itself.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI MoMA",
    short_name: "AI MoMA",
    description:
      "An open-source virtual museum of modern art: walk the floors, step into paintings, make your own work.",
    start_url: "/",
    display: "standalone",
    background_color: "#111111",
    theme_color: "#111111",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
