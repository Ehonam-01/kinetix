import { describe, expect, it } from "vitest";
import {
  cleanVideoUrl,
  getGoogleDriveEmbed,
  getVideoEmbedUrl,
} from "./video-embed";

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

describe("Bunny Stream", () => {
  const video = "0b7b7d4e-1c2a-4f3e-9a8b-123456789abc";

  it("embeds a Bunny embed link, keeping its options and token", () => {
    expect(
      getVideoEmbedUrl(
        "BUNNY",
        `https://iframe.mediadelivery.net/embed/123456/${video}?autoplay=false&token=abc&expires=99`,
      ),
    ).toBe(
      `https://iframe.mediadelivery.net/embed/123456/${video}?autoplay=false&token=abc&expires=99`,
    );
  });

  it("turns a play page link, on either host, into the embed link", () => {
    for (const host of [
      "iframe.mediadelivery.net",
      "player.mediadelivery.net",
    ]) {
      expect(
        getVideoEmbedUrl("BUNNY", `https://${host}/play/123456/${video}`),
      ).toBe(`https://iframe.mediadelivery.net/embed/123456/${video}`);
    }
  });

  it("refuses any other host or a malformed link", () => {
    expect(
      getVideoEmbedUrl("BUNNY", `https://evil.example/embed/123456/${video}`),
    ).toBeNull();
    expect(
      getVideoEmbedUrl(
        "BUNNY",
        "https://iframe.mediadelivery.net/embed/123456/not-a-video",
      ),
    ).toBeNull();
  });

  it("keeps only the src of a pasted <iframe> embed code", () => {
    const code = `<div style="position:relative;padding-top:56.25%;"><iframe src="https://iframe.mediadelivery.net/embed/123456/${video}?autoplay=true&amp;loop=false" loading="lazy" style="border:0;" allowfullscreen="true"></iframe></div>`;
    const url = cleanVideoUrl(code);
    expect(url).toBe(
      `https://iframe.mediadelivery.net/embed/123456/${video}?autoplay=true&loop=false`,
    );
    expect(getVideoEmbedUrl("BUNNY", url)).toBe(url);
  });

  it("leaves a plain link as it is, trimmed", () => {
    expect(cleanVideoUrl("  https://youtu.be/abc  ")).toBe(
      "https://youtu.be/abc",
    );
  });
});
