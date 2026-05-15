import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <SignUp signInUrl="/sign-in" forceRedirectUrl="/dashboard" />
    </main>
  );
}
