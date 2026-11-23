import { ImageResponse } from "next/og";
import { db } from "@/db/client";
import { getPublicCourse } from "@/repositories/courses";
import {
  OG_NIGHT,
  OG_NIGHT_LIGHT,
  OG_ORANGE,
  ogLogoDataUrl,
} from "@/lib/og-logo";

export const alt = "Une formation Kinetix Africa";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The course's thumbnail, when it's a picture next/og can draw (PNG or
// JPEG) and can be fetched; otherwise the preview goes without it.
async function thumbnailDataUrl(url: string | null) {
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(png|jpe?g)/.test(type)) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

// Each course's link preview: its title and thumbnail, on the site colors.
export default async function CourseOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const content = await getPublicCourse(db, slug);
  const [logo, thumbnail] = await Promise.all([
    ogLogoDataUrl(),
    thumbnailDataUrl(content?.course.thumbnailUrl ?? null),
  ]);
  const title = content?.course.title ?? "Les formations Kinetix Africa";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        gap: 48,
        padding: 64,
        color: "#ffffff",
        background: `linear-gradient(135deg, ${OG_NIGHT} 0%, ${OG_NIGHT_LIGHT} 100%)`,
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          height: "100%",
          flex: 1,
        }}
      >
        <div style={{ display: "flex" }}>
          <div
            style={{
              display: "flex",
              background: "#ffffff",
              borderRadius: 20,
              padding: "10px 20px",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- next/og draws plain img */}
            <img src={logo} width={180} height={90} alt="" />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: OG_ORANGE }}>
            FORMATION
          </div>
          <div
            style={{
              marginTop: 12,
              fontSize: thumbnail ? 52 : 64,
              fontWeight: 700,
              lineHeight: 1.12,
            }}
          >
            {title}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 26, color: "#d7e0f5" }}>
          Formations · Mentorat · Communauté
        </div>
      </div>
      {thumbnail && (
        // eslint-disable-next-line @next/next/no-img-element -- next/og draws plain img
        <img
          src={thumbnail}
          width={460}
          height={460}
          alt=""
          style={{ objectFit: "cover", borderRadius: 32 }}
        />
      )}
    </div>,
    size,
  );
}
