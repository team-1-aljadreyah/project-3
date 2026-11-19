"use client";

// app/ only routes: the page itself lives in its feature.
// The login page reads "?next=" from the address (useSearchParams), which Next.js wants inside <Suspense>.
import { Suspense } from "react";
import { LoginPage } from "@/features/auth";

export default function LoginRoute() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
