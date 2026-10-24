import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Server-rendered GET search form: works without JavaScript and keeps the query in the URL
 * so results are shareable and indexable.
 */
export function SearchBox({
  action,
  defaultValue,
  placeholder,
  label,
  hidden,
  className,
}: {
  action: string;
  defaultValue?: string;
  placeholder: string;
  label: string;
  hidden?: Record<string, string | undefined>;
  className?: string;
}) {
  return (
    <form action={action} method="get" role="search" className={cn("flex w-full max-w-xl gap-2", className)}>
      {Object.entries(hidden ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label htmlFor={`search-${action}`} className="sr-only">
        {label}
      </label>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          id={`search-${action}`}
          name="q"
          type="search"
          defaultValue={defaultValue}
          placeholder={placeholder}
          className="h-11 pl-9 text-base sm:text-sm"
          autoComplete="off"
          maxLength={80}
        />
      </div>
      <Button type="submit" className="h-11 px-5">
        Search
      </Button>
    </form>
  );
}
