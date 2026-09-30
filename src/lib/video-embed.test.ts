import { describe, expect, it } from "vitest";
import { getGoogleDriveEmbed, getVideoEmbedUrl } from "./video-embed";

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

describe("getGoogleDriveEmbed", () => {
  const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";

  it("previews a shared Drive file (video, PDF…)", () => {
    for (const url of [
      `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
      `https://drive.google.com/file/d/${ID}/view`,
      `https://drive.google.com/file/d/${ID}`,
      `https://drive.google.com/open?id=${ID}`,
    ]) {
      expect(getGoogleDriveEmbed(url)).toEqual({
        src: `https://drive.google.com/file/d/${ID}/preview`,
        kind: "file",
      });
    }
  });

  it("lists a shared Drive folder", () => {
    expect(
      getGoogleDriveEmbed(
        `https://drive.google.com/drive/folders/${ID}?usp=drive_link`,
      ),
    ).toEqual({
      src: `https://drive.google.com/embeddedfolderview?id=${ID}#list`,
      kind: "folder",
    });
    expect(
      getGoogleDriveEmbed(`https://drive.google.com/drive/u/0/folders/${ID}`)
        ?.kind,
    ).toBe("folder");
  });

  it("previews Google Docs, Sheets and Slides", () => {
    expect(
      getGoogleDriveEmbed(`https://docs.google.com/document/d/${ID}/edit`),
    ).toEqual({
      src: `https://docs.google.com/document/d/${ID}/preview`,
      kind: "document",
    });
    expect(
      getGoogleDriveEmbed(
        `https://docs.google.com/presentation/d/${ID}/edit#slide=id.p`,
      )?.src,
    ).toBe(`https://docs.google.com/presentation/d/${ID}/preview`);
  });

  it("is used for OTHER lessons, and nothing else is embedded", () => {
    expect(
      getVideoEmbedUrl("OTHER", `https://drive.google.com/file/d/${ID}/view`),
    ).toBe(`https://drive.google.com/file/d/${ID}/preview`);
    expect(getGoogleDriveEmbed("https://drive.google.com/")).toBeNull();
    expect(getGoogleDriveEmbed("https://example.com/file/d/x")).toBeNull();
  });
});
