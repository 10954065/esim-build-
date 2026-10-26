import { Globe2, Map } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: { w: 20, h: 15, icon: "size-4" },
  md: { w: 28, h: 21, icon: "size-5" },
  lg: { w: 40, h: 30, icon: "size-6" },
} as const;

type FlagProps = {
  /** ISO 3166-1 alpha-2 code (e.g. "ES"). Anything else renders a neutral globe. */
  code: string | null | undefined;
  size?: keyof typeof SIZES;
  /** Regional and global eSIM destinations have no single flag. */
  kind?: "COUNTRY" | "REGION" | "GLOBAL";
  className?: string;
};

/** SVG country flag (decorative: the country name is always shown next to it). */
export function Flag({ code, size = "sm", kind = "COUNTRY", className }: FlagProps) {
  const s = SIZES[size];
  if (kind !== "COUNTRY" || !code || !/^[A-Za-z]{2}$/.test(code)) {
    const Icon = kind === "REGION" ? Map : Globe2;
    return (
      <span
        aria-hidden
        style={{ width: s.w, height: s.h }}
        className={cn("inline-grid shrink-0 place-items-center rounded-[3px] bg-accent text-primary", className)}
      >
        <Icon className={s.icon} />
      </span>
    );
  }
  return (
    // Tiny static SVG from /flags; next/image would need dangerouslyAllowSVG.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/${code.toLowerCase()}.svg`}
      alt=""
      aria-hidden
      width={s.w}
      height={s.h}
      loading="lazy"
      decoding="async"
      className={cn("inline-block shrink-0 rounded-[3px] object-cover shadow-[0_0_0_1px_rgb(16_24_40/0.08)]", className)}
    />
  );
}
