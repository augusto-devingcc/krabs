import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

// Clerk is the auth provider for the *hosted* SaaS surface. In self-host mode
// (no `CLERK_SECRET_KEY` in env), we serve API + CLI only — the web dashboard
// at `/dashboard/*` is replaced with a static `/self-host` page.
const CLERK_ENABLED = !!process.env.CLERK_SECRET_KEY;

const isHostedOnlyRoute = createRouteMatcher(["/dashboard(.*)", "/device(.*)"]);

const clerkBackedMiddleware = clerkMiddleware(async (auth, req) => {
  if (isHostedOnlyRoute(req)) {
    const { userId } = await auth();
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }
  }
});

function selfHostMiddleware(req: NextRequest) {
  if (isHostedOnlyRoute(req)) {
    return NextResponse.redirect(new URL("/self-host", req.url));
  }
  return NextResponse.next();
}

export default CLERK_ENABLED ? clerkBackedMiddleware : selfHostMiddleware;

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next|api/v1|v1|.*\\..*).*)"],
};
