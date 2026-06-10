// src/app/layout.tsx
// Root layout — wraps every page in the app.
//
// Responsibilities:
//   • Declares the <html> and <body> elements (required by Next.js App Router).
//   • Loads Instrument Serif + Plus Jakarta Sans from Google Fonts (matches
//     --font-display and --font-body CSS variables in globals.css).
//   • Sets the default <title> and <meta description> for the whole site.
//   • Applies globals.css which contains all CSS custom properties (design
//     tokens), component classes (.card, .btn, .badge, etc.), and animations.
//
// What does NOT belong here:
//   • Sidebar / navigation — those live in (protected)/layout.tsx.
//   • Auth wrappers — middleware handles route protection; no redirect() here.
//   • Per-page metadata — individual pages export their own `metadata` object
//     which Next.js merges with the template defined below.

import type { Metadata } from "next";
import "./globals.css";

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: {
    default:  "MediTrack",
    template: "%s · MediTrack",
  },
  description:
    "Premium healthcare management — medications, metrics, and appointments in one place.",
};

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}