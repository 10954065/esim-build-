import * as FLAGS from "country-flag-icons/string/3x2";

/**
 * Country flags as static SVG files (/flags/es.svg), prebuilt at build time and cached forever.
 * Serving them as files keeps the 265-flag set out of every page bundle.
 */

export const dynamic = "force-static";
export const dynamicParams = false;

const SVG_BY_CODE = FLAGS as Record<string, string>;

export function generateStaticParams() {
  return Object.keys(SVG_BY_CODE).map((code) => ({ code: `${code.toLowerCase()}.svg` }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const match = /^([a-z]{2})\.svg$/.exec(code);
  const svg = match ? SVG_BY_CODE[match[1]!.toUpperCase()] : undefined;
  if (!svg) return new Response("Not found", { status: 404 });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
