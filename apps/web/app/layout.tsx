import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '365 — 365 Days. 365 Features.',
  description: '365 days. 365 features. Built autonomously by AI.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  )
}
