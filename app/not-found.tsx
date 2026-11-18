import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="num text-5xl font-bold text-accent">404</p>
      <h1 className="text-xl font-semibold">الصفحة غير موجودة</h1>
      <p className="text-muted" lang="en" dir="ltr">
        Page not found
      </p>
      <Link href="/" className="mt-2 font-medium text-accent underline underline-offset-4">
        العودة إلى الرئيسية · Home
      </Link>
    </main>
  );
}
