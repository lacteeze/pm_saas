// src/app/(public)/layout.tsx
// Layout for the public (unauthenticated) listing pages.
// No session required — middleware skips auth check for /listings routes.
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Available Rentals',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-50">
      {/* Minimal public header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4">
          <span className="text-base font-semibold text-stone-900">Canary PropOS</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
