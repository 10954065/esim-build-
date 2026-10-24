import Link from "next/link";
import { Logo } from "@/components/site/logo";

export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Logo />
        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <p className="text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline">terms</Link>,{" "}
          <Link href="/privacy" className="underline">privacy policy</Link> and{" "}
          <Link href="/acceptable-use" className="underline">acceptable use policy</Link>.
        </p>
      </div>
      <aside aria-hidden className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:block">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative flex h-full flex-col justify-end p-14">
          <p className="max-w-md text-3xl font-semibold leading-tight">Your eSIMs, numbers and messages — in one private dashboard.</p>
          <p className="mt-4 max-w-md text-sm opacity-75">
            Activation details and SMS are encrypted at rest and shown only to you after you sign in.
          </p>
        </div>
      </aside>
    </div>
  );
}
