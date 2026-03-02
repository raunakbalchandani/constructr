import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:8000'

async function handler(req: NextRequest): Promise<NextResponse> {
  const path = req.nextUrl.pathname.replace(/^\/api/, '')
  const url = `${BACKEND_URL}${path}${req.nextUrl.search}`

  const headers = new Headers(req.headers)
  // Strip hop-by-hop headers that can't be forwarded
  for (const h of ['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authorization', 'te', 'trailers']) {
    headers.delete(h)
  }

  const init: RequestInit = { method: req.method, headers }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = req.body
    ;(init as RequestInit & { duplex: string }).duplex = 'half'
  }

  const upstream = await fetch(url, init)

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers,
  })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
