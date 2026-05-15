import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
      <SignIn signUpUrl="/sign-up" forceRedirectUrl="/dashboard" />
    </main>
  );
}
