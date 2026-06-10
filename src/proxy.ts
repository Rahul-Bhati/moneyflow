import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

// API routes do their own auth in the handler — we want JSON 401 responses,
// not a redirect to /sign-in. So we don't call auth.protect() for them; the
// Clerk auth() helper still works inside the route to read the session.
const isApiRoute = createRouteMatcher(["/api/(.*)"]);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req) || isApiRoute(req)) return;
  await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
