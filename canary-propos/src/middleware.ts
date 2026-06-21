// src/middleware.ts
// Session refresh + role-based routing for all portals
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/my-home') ||
    pathname.startsWith('/portfolio') ||
    pathname.startsWith('/jobs') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/onboarding') ||  // CR-04: protect onboarding from unauthed access
    pathname.startsWith('/people') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/inquiries')
  )
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: getUser() refreshes the session on every request — do not remove or replace with getSession()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const role = user?.app_metadata?.role as string | undefined

  // Unauthenticated user accessing a protected path → redirect to /login
  if (!user && isProtectedPath(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Role guards per portal (D-04)
  // /dashboard — manager, employee, admin only
  if (
    pathname.startsWith('/dashboard') &&
    !['manager', 'employee', 'admin'].includes(role ?? '')
  ) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // /my-home — tenant only
  if (pathname.startsWith('/my-home') && role !== 'tenant') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // /portfolio — owner only
  if (pathname.startsWith('/portfolio') && role !== 'owner') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // /jobs — vendor only
  if (pathname.startsWith('/jobs') && role !== 'vendor') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // /admin — admin only (first layer; (admin)/layout.tsx adds independent server-side check per Pitfall 6)
  if (pathname.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
