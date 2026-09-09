import type { Metadata, Viewport } from "next";
import { Newsreader, Figtree } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

// Design-system typefaces, self-hosted at build by next/font (no runtime
// request to Google, no FOUT, works offline in the PWA). The CSS variables are
// consumed by src/styles/zh/fonts.css → --font-display / --font-ui.
const newsreader = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], axes: ["opsz"], variable: "--font-newsreader", display: "swap" });
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  title: "Zitting HQ",
  description: "The Zitting family's home base.",
};

// Mobile-critical: render at device width (not a zoomed-out desktop canvas),
// allow zoom for accessibility, and tint the notch/status bar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FBFAF7",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The profile's theme choice is mirrored into a cookie (see /me actions) so
  // the server renders the right theme on first paint; the inline script below
  // covers devices that only have the localStorage choice.
  const themeCookie = (await cookies()).get("zhq-theme")?.value;
  const dark = themeCookie === "dark";
  return (
    <html lang="en" className={`${newsreader.variable} ${figtree.variable} h-full`} data-zh-theme={dark ? "dark" : undefined}>
      <head>
        {/* Browser-tab favicon (PNG — modern browsers prefer the highest match). */}
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16.png" />
        <link rel="shortcut icon" href="/icons/icon-32.png" />
        {/* Installable PWA — required for push on iOS (Add to Home Screen). */}
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Zitting HQ" />
        <meta name="theme-color" content={dark ? "#15141A" : "#FBFAF7"} />
        {/* Theme + hidden-document bootstrap: light is the default (design system, 2026-09); a
            saved "dark" choice is applied BEFORE first paint on every page via
            data-zh-theme (the guide's dedicated attribute — see tokens/dark.css).
            Last in <head> so the theme-color meta above exists when it runs. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("zhq-theme")==="dark"){document.documentElement.setAttribute("data-zh-theme","dark");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#15141A")}}catch(e){};try{if(document.visibilityState==="hidden"){document.documentElement.classList.add("zh-no-anim");document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")document.documentElement.classList.remove("zh-no-anim")})}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
