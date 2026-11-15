import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { themeInitScript, ThemeProvider } from '@/providers/theme-provider';
import { ToastProvider } from '@/providers/toast-provider';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: { default: 'SkillBee Admin', template: '%s · SkillBee Admin' },
  description: 'SkillBee LMS super admin and admin console',
  robots: { index: false, follow: false },
  icons: { icon: { url: '/brand/skillbee-mark.webp', type: 'image/webp' } },
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    // The theme script sets `class="dark"` before hydration
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full bg-canvas font-sans text-ink">
        <ThemeProvider>
          <QueryProvider>
            <ToastProvider>
              <AuthProvider>{children}</AuthProvider>
            </ToastProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
