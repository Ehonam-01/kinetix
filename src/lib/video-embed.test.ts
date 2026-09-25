import { describe, expect, it } from "vitest";
import { getVideoEmbedUrl } from "./video-embed";

describe("getVideoEmbedUrl", () => {
  it("builds an embed URL from a YouTube watch link", () => {
    expect(
      getVideoEmbedUrl("YOUTUBE", "https://www.youtube.com/watch?v=abc123XYZ9"),
    ).toBe("https://www.youtube.com/embed/abc123XYZ9?rel=0");
  });

  it("builds an embed URL from a youtu.be short link", () => {
    expect(getVideoEmbedUrl("YOUTUBE", "https://youtu.be/abc123XYZ9")).toBe(
      "https://www.youtube.com/embed/abc123XYZ9?rel=0",
    );
  });

  it("passes through an already-embeddable YouTube URL", () => {
    expect(
      getVideoEmbedUrl("YOUTUBE", "https://www.youtube.com/embed/abc123XYZ9"),
    ).toBe("https://www.youtube.com/embed/abc123XYZ9?rel=0");
  });

  it("builds an embed URL from a public Vimeo link", () => {
    expect(getVideoEmbedUrl("VIMEO", "https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
  });

  it("forwards the hash from a private Vimeo link", () => {
    expect(
      getVideoEmbedUrl("VIMEO", "https://vimeo.com/123456789/abcdef0123"),
    ).toBe("https://player.vimeo.com/video/123456789?h=abcdef0123");
  });

  it("returns null for OTHER", () => {
    expect(
      getVideoEmbedUrl("OTHER", "https://example.com/video.mp4"),
    ).toBeNull();
  });

  it("returns null for a YouTube URL with no extractable id", () => {
    expect(getVideoEmbedUrl("YOUTUBE", "https://www.youtube.com/")).toBeNull();
  });

  it("returns null for an unparseable URL", () => {
    expect(getVideoEmbedUrl("YOUTUBE", "not a url")).toBeNull();
  });
});
