/**
 * Root route (/) — redirect to /dashboard.
 * Server Component — no flash, no client JS needed.
 */

import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/dashboard');
}
