import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Everything under /dashboard requires sign-in.  The /v1/* API surface
// is intentionally NOT gated by Clerk — it uses our own API-key auth.
const isProtectedRoute = createRouteMatcher(["/dashboard(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  // Clerk's middleware needs Node APIs; Edge would refuse to bundle it.
  runtime: "nodejs",
  // Run on every request except Next.js internals and the API surface.
  matcher: ["/((?!_next|api/v1|v1|.*\\..*).*)"],
};
