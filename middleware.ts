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
  // Run on every request except Next.js static files and the API surface.
  matcher: ["/((?!_next|api/v1|v1|.*\\..*).*)"],
};
