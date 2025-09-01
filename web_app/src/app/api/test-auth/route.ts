import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const cookies = request.cookies
  const headers = request.headers
  
  const cookieList = Array.from(cookies.getAll())
  const headerList = Array.from(headers.entries())
  
  console.log('Test Auth - Cookies received:', cookieList)
  console.log('Test Auth - Headers received:', headerList)
  
  return NextResponse.json({
    cookies: cookieList,
    headers: headerList,
    message: 'Auth test endpoint'
  })
}
