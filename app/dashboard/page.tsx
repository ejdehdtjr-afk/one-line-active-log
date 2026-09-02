import { redirect } from 'next/navigation';
import { Dashboard } from '@/components/dashboard';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  if (!(await getCurrentUser())) redirect('/');
  return <Dashboard />;
}
