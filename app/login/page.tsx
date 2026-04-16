import { Suspense } from "react";
import { CampLoginForm } from "./camp-login-form";

export default function CampLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[40vh] w-full max-w-md flex-1 items-center justify-center px-4">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </main>
      }
    >
      <CampLoginForm />
    </Suspense>
  );
}
