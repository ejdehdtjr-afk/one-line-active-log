import { clearSessionCookie, deleteCurrentSession } from '@/lib/auth';

export async function POST() {
  await deleteCurrentSession();
  return Response.json(
    { ok: true },
    { headers: { 'Set-Cookie': clearSessionCookie() } },
  );
}
