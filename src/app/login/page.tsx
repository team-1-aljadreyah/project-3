"use client";

// app/ only routes: the page itself lives in its feature.
// The sign-in page is drawn into the first HTML (it reads nothing from the address while drawing: "?next=" is read
// when the person signs in), so it shows before any script has loaded.
import { LoginPage } from "@/features/auth";

export default function LoginRoute() {
  return <LoginPage />;
}
