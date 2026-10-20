import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Send the bare domain to the marketing home and normalise trailing slashes.
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/home", request.url));
  }
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return NextResponse.redirect(new URL(pathname.slice(0, -1), request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|api|.*\\..*).*)"] };
