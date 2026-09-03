# Supabase 연결

1. Supabase 프로젝트의 SQL Editor에서 `supabase/schema.sql` 전체를 한 번 실행한다.
2. Project Settings → API Keys에서 Project URL과 서버 전용 secret key를 확인한다.
3. 로컬 개발에는 `.env.local`을 만들고 `.env.example`의 두 값을 채운다.
4. Vercel Production 환경에는 `SUPABASE_URL`과 비밀값 `SUPABASE_SERVICE_ROLE_KEY`를 설정한다.

Supabase secret key는 서버 전용이다. 브라우저 코드, Git, 제출문, 캡처에 넣지 않는다. 앱은 Vercel의 서버 코드에서 Supabase HTTPS PostgREST API만 호출한다.

스키마는 모든 테이블에 RLS를 켜고 `anon`, `authenticated` 역할의 직접 접근을 회수한다. secret key로 `service_role` 권한을 얻은 서버만 접근하며, 서버 API는 다시 로그인 사용자의 `user_id`를 모든 읽기·수정·삭제 조건에 포함한다.
