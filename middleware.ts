import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

// Clerk is the auth provider for the *hosted* SaaS surface. In self-host mode
// (no `CLERK_SECRET_KEY` in env) we still serve the dashboard at /dashboard/*
// — it just runs against the single local-operator account that `pnpm setup`
// created. The threat model is "my own machine", not multi-tenant SaaS.
const CLERK_ENABLED = !!process.env.CLERK_SECRET_KEY;

const isHostedOnlyAuthRoute = createRouteMatcher(["/dashboard(.*)", "/device(.*)"]);
// In self-host mode there's no sign-in / sign-up (one local operator) and no
// device flow (agents share the local API key directly). Bounce those routes
// to /dashboard so the dashboard is the single entry point.
const isSelfHostBouncedRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/device(.*)",
]);

const clerkBackedMiddleware = clerkMiddleware(async (auth, req) => {
  if (isHostedOnlyAuthRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }
});

function selfHostMiddleware(req: NextRequest) {
  if (isSelfHostBouncedRoute(req)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  return NextResponse.next();
}

export default CLERK_ENABLED ? clerkBackedMiddleware : selfHostMiddleware;

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next|api/v1|v1|.*\\..*).*)"],
};
