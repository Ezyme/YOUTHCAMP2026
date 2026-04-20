import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CAMP_AUTH_COOKIE, safeCampLoginNext } from "@/lib/camp/auth";
import { CampLoginForm } from "./camp-login-form";

type Props = {
  searchParams: Promise<{ next?: string }>;
};

export default async function CampLoginPage({ searchParams }: Props) {
  const jar = await cookies();
  if (jar.get(CAMP_AUTH_COOKIE)?.value === "1") {
    const q = await searchParams;
    redirect(safeCampLoginNext(q.next));
  }

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
