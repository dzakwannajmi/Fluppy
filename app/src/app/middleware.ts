import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

    const CSP = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'unsafe-eval' 'wasm-unsafe-eval';
    style-src 'self' 'nonce-${nonce}' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self';
    connect-src
      'self'
      https://soroban-testnet.stellar.org
      https://horizon-testnet.stellar.org
      https://*.stellar.org
      wss://soroban-testnet.stellar.org;
    worker-src 'self' blob:;
    child-src 'self' blob:;
    wasm-src 'self' blob:;
    object-src 'none';
    base-uri 'self';
    frame-ancestors 'none';
  `
        .replace(/\s{2,}/g, " ")
        .trim();

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set("Content-Security-Policy", CSP);

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    });

    response.headers.set("Content-Security-Policy", CSP);
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");

    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};