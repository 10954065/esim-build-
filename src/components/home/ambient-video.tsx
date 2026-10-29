"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  poster: string;
  className?: string;
};

/**
 * Decorative background footage. The poster is the first frame of a pre-rendered seamless loop,
 * so it shows instantly and the hand-over to video is invisible. Plays only while on screen and
 * never for visitors who prefer reduced motion (they keep the still poster).
 */
export function AmbientVideo({ src, poster, className }: Props) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.1 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
      tabIndex={-1}
      className={cn("pointer-events-none absolute inset-0 size-full object-cover", className)}
    />
  );
}
