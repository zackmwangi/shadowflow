import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Middleware disabled - authentication handled on client side
  return NextResponse.next()
}

export const config = {
  matcher: ['/settings/:path*'],
}
