import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-3xl space-y-2">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="text-3xl leading-tight font-bold tracking-[-0.02em] sm:text-4xl">{title}</h1>
        {description && <div className="text-base leading-relaxed text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl px-4 sm:px-8", className)}>{children}</div>;
}
