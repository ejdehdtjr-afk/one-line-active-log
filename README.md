# FIVE / FIVE

T06의 능동 작업시간 기록을 이어 받아, 계정별 인증과 5일 계획 규칙 실험을 구현한 T07 결과물입니다.

- 결과물: https://one-line-active-log.ejdehdtjr.chatgpt.site/
- [T07 제출문](./SUBMISSION.md)
- [인증·권한 확인 기록](./SECURITY-TESTS.md)
- 최종 T06 기준 commit: [`e1352d1`](https://github.com/ejdehdtjr-afk/one-line-active-log/commit/e1352d1a3c32824a074072b8d52cca0dcddbf2d7)

주요 기능은 가입·로그인·로그아웃, PBKDF2 비밀번호 해시, 서버 세션, 계정별 Supabase Postgres 소유권 검사, T06 실제 입력 기록 이전, 정확히 5일 기록, 2일차 뒤 규칙 변경, 같은 지표의 전후 비교, 손계산 대조, JSON 내보내기와 전체 계정 삭제입니다.

실제 5일 사용 기록은 합성하지 않습니다. 사용자가 서로 다른 실제 날짜에 직접 입력해야 합니다.
