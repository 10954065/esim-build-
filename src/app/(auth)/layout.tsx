import { BadgeCheck, LockKeyhole, RotateCcw } from "lucide-react";
import Link from "next/link";
import { Flag } from "@/components/common/flag";
import { HomeLink } from "@/components/site/home-link";
import { Logo } from "@/components/site/logo";

export const dynamic = "force-dynamic";

const FLAG_ROW = ["ES", "JP", "US", "GB", "FR", "TH", "AE", "BR", "DE", "IT", "MX", "TR"];

const POINTS = [
  { icon: LockKeyhole, title: "Private by default", body: "Activation details and SMS are encrypted at rest and shown only to you after you sign in." },
  { icon: BadgeCheck, title: "Verified payments", body: "Orders are delivered only after the payment is confirmed on our server, never from a browser redirect." },
  { icon: RotateCcw, title: "Automatic refunds", body: "When an order definitely fails, or a supplier refunds an unused number, we refund you without a ticket." },
];

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[1fr_1fr]">
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <HomeLink />
        </div>
        <main id="main" className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <div className="surface p-6 shadow-raised sm:p-8">{children}</div>
        </main>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline hover:text-primary">
            terms
          </Link>
          ,{" "}
          <Link href="/privacy" className="underline hover:text-primary">
            privacy policy
          </Link>{" "}
          and{" "}
          <Link href="/acceptable-use" className="underline hover:text-primary">
            acceptable use policy
          </Link>
          .
        </p>
      </div>
      <aside aria-hidden className="relative hidden overflow-hidden bg-ink text-ink-foreground lg:block">
        <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:22px_22px]" />
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative flex h-full flex-col justify-between p-14">
          <div className="flex flex-wrap gap-2.5">
            {FLAG_ROW.map((code) => (
              <span key={code} className="rounded-md bg-white/5 p-1.5 ring-1 ring-white/10">
                <Flag code={code} size="md" />
              </span>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold tracking-[0.08em] text-mint uppercase">Your account</p>
            <p className="mt-3 max-w-md text-3xl leading-tight font-bold tracking-tight">Your eSIMs, numbers and messages, in one private dashboard.</p>
            <ul className="mt-10 max-w-md space-y-5">
              {POINTS.map((p) => (
                <li key={p.title} className="flex gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/10 text-mint">
                    <p.icon className="size-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{p.title}</span>
                    <span className="text-sm text-white/65">{p.body}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}
