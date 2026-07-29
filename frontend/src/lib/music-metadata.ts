"use client";

export interface ParsedAudioMetadata {
  title?: string;
  artist?: string;
  artwork?: File;
}

function cleanText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Parse tags in the browser; the dynamic import keeps the parser out of the initial bundle. */
export async function parseAudioMetadata(file: File): Promise<ParsedAudioMetadata> {
  const fallback = file.name.replace(/\.[^.]+$/, "").trim();
  try {
    const parser = await import("music-metadata");
    const metadata = await parser.parseBlob(file);
    const common = metadata.common as {
      title?: string;
      artist?: string;
      artists?: string[];
      picture?: Array<{ format?: string; data: Uint8Array }>;
    };
    const picture = common.picture?.[0];
    let artwork: File | undefined;
    if (picture?.data?.length) {
      const mime = picture.format?.startsWith("image/") ? picture.format : "image/jpeg";
      const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
      artwork = new File([picture.data as BlobPart], `embedded-cover.${ext}`, { type: mime });
    }
    return {
      title: cleanText(common.title) || fallback || undefined,
      artist: cleanText(common.artist) || common.artists?.map(cleanText).filter(Boolean).join(", ") || undefined,
      artwork,
    };
  } catch {
    return { title: fallback || undefined };
  }
}
