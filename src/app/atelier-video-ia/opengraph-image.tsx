import { ImageResponse } from "next/og";

export const alt = "Kinetix AI Video Masterclass, atelier pratique à Lomé";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The link preview on WhatsApp and Facebook, where most visitors come from.
// Drawn from text: no photo of the workshop exists yet.
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 80,
        color: "#ffffff",
        background: "linear-gradient(135deg, #0b1d4d 0%, #123a9c 100%)",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 700, color: "#f7a823" }}>
        KINETIX AI VIDEO MASTERCLASS
      </div>
      <div
        style={{
          marginTop: 28,
          fontSize: 68,
          fontWeight: 700,
          lineHeight: 1.1,
        }}
      >
        En une matinée, crée une vraie pub vidéo avec l&apos;IA
      </div>
      <div style={{ marginTop: 36, fontSize: 34, color: "#d7e0f5" }}>
        Atelier pratique à Lomé · Samedi 7 novembre · 8 h – 13 h
      </div>
    </div>,
    size,
  );
}
