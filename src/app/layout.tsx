import type { Metadata } from 'next'
import Script from 'next/script'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'IMS - Incident Management System',
  description: 'Professioneel incidentenbeheer voor evenement controlerooms',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IMS',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning className={`h-full ${inter.variable}`}>
      <body className="h-full antialiased">
        <Script id="theme-init" strategy="beforeInteractive">{`
          (function() {
            try {
              if (localStorage.getItem('ims-theme') === 'dark') {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {}
          })();
        `}</Script>
        {children}
      </body>
    </html>
  )
}
