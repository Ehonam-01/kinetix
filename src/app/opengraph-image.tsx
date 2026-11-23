import { ImageResponse } from "next/og";
import {
  OG_NIGHT,
  OG_NIGHT_LIGHT,
  OG_ORANGE,
  ogLogoDataUrl,
} from "@/lib/og-logo";

export const alt =
  "Kinetix Africa — Les bonnes compétences. Les bonnes personnes. Les bonnes opportunités.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The link preview of every page without one of its own (WhatsApp,
// Facebook, X): the logo, the promise, what the platform offers.
export default async function OpengraphImage() {
  const logo = await ogLogoDataUrl();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        color: "#ffffff",
        background: `linear-gradient(135deg, ${OG_NIGHT} 0%, ${OG_NIGHT_LIGHT} 100%)`,
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex" }}>
        <div
          style={{
            display: "flex",
            background: "#ffffff",
            borderRadius: 24,
            padding: "14px 28px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain img */}
          <img src={logo} width={260} height={130} alt="" />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>
          Les bonnes compétences.
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15 }}>
          Les bonnes personnes.
        </div>
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.15,
            color: OG_ORANGE,
          }}
        >
          Les bonnes opportunités.
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 32, color: "#d7e0f5" }}>
        Formations · Mentorat · Communauté
      </div>
    </div>,
    size,
  );
}
