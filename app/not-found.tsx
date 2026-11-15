import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm font-semibold text-primary">404</p>
      <h1 className="text-xl font-semibold text-ink">Page not found</h1>
      <p className="text-sm text-ink-muted">This admin page does not exist.</p>
      <Link href="/dashboard" className="mt-2 text-sm font-medium text-primary hover:text-primary-hover">
        Back to dashboard
      </Link>
    </main>
  );
}
