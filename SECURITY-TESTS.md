# 인증·권한 확인 기록

- 확인 시각: 2026-09-04 11:04 (Asia/Seoul)
- 확인 대상: Vercel Production (`https://one-line-active-log-next.vercel.app`)
- 실행 도구: `node scripts/verify-deployment.mjs https://one-line-active-log-next.vercel.app`
- 계정 A/B 이메일, 같은 비밀번호 원문, 세션 쿠키: `[가림]`
- 계정 A와 B에 각각 다이어리 1건과 5일 실험 기록 1건을 만든 뒤 양방향으로 검사했다. 검사 계정과 자료는 완료 직후 삭제했다.

## 성공 요청과 거절 요청

| 확인 | 성공 요청 | 거절 요청 | 실제 응답과 판정 |
| --- | --- | --- | --- |
| 가입·로그인 | `POST /api/auth/signup` A/B → `201/201`; `POST /api/auth/login` 올바른 계정 → `200` | 같은 이메일 재가입 → `409`; 틀린 비밀번호와 없는 계정 로그인 → `401/401` | 두 로그인 실패 모두 `이메일 또는 비밀번호가 맞지 않습니다.`로 같음 |
| 로그인 자료 조회 | A 세션으로 `GET /api/experiment` → `200` | 쿠키 없이 같은 `GET /api/experiment` → `401` | 비로그인 응답은 `로그인이 필요합니다.`이며 자료 본문 없음 |
| 양방향 읽기·목록 | A/B가 각자 목록 조회 → `200/200` | A 목록에서 B의 ID, B 목록에서 A의 ID 검색 | 상대 ID가 양쪽 응답에 `0건`; `bidirectionalReadIsolation: true` |
| 양방향 수정 | A가 자기 기록 `PUT /api/records/{A id}` → `200` | B→A 및 A→B의 같은 `PUT` → `404/404` | 존재 자체를 감춘 `내 기록에서 찾을 수 없습니다.` |
| 양방향 삭제 | A/B가 자기 다이어리 삭제 → `200/200` | B→A 및 A→B의 `DELETE /api/records/{id}` → `404/404`; 다이어리도 `404/404` | 거절 뒤 A/B 자료 건수 각각 `1/1`로 변하지 않음 |
| 신원 위조 | A 쿠키로 정상 목록 → `200` | URL query와 `X-User-Id` 헤더에 B를 넣고 A 쿠키로 요청 → `200` | 응답은 계속 A의 ID만 포함, `spoofedQueryAndHeaderIgnored: true` |
| 로그아웃 만료 | 로그아웃 전 A 쿠키로 `GET /api/experiment` → `200` | `POST /api/auth/logout` 뒤 같은 주소·같은 방식·같은 쿠키로 재요청 → `401` | 달라진 것은 로그아웃 여부뿐이며 서버 세션 삭제 확인 |

## 가린 요청·응답 예시

```http
GET /api/experiment
Cookie: active_log_session=[가림]

HTTP/1.1 200 OK
{ "experiment": { "user_id": "[가림]" }, "records": ["계정 A 자료만"] }
```

```http
PUT /api/records/[계정 A 기록 id]
Cookie: active_log_session=[계정 B 세션, 가림]
Content-Type: application/json

{ "date": "2026-09-03", "value": 999, "note": "denied" }

HTTP/1.1 404 Not Found
{ "error": "내 기록에서 찾을 수 없습니다." }
```

```http
GET /api/experiment
Cookie: active_log_session=[로그아웃 전과 같은 세션, 가림]

HTTP/1.1 401 Unauthorized
{ "error": "로그인이 필요합니다." }
```

## 나머지 흐름

- 1·2일차 저장 `201/201` → 규칙 변경 전 3일차 `409` → 규칙 변경 `200` → 3·4·5일차 `201/201/201` → 6번째 기록 `409`.
- 검증용 5일 값 합계·평균은 `355/71`이었고 API 계산과 손계산이 일치했다.
- JSON 내보내기 `200`, JSON 형식 확인, 계정 삭제 뒤 같은 세션 조회 `401`.
- T06 다이어리 생성·조회·수정·삭제 `201/200/200/200`; 상대 계정 수정·삭제는 양방향 `404/404`.
- 거절은 `app/api/diary/[id]/route.ts`, `app/api/records/[id]/route.ts`의 `id + user_id` 조건과 `lib/auth.ts`의 서버 세션 검사에서 만들어진다.

요청·응답 및 이 문서에는 비밀번호 원문, 세션 토큰 원문, Supabase 키가 없다. 자동 검증 출력에도 세 비밀값을 출력하지 않았으며 모두 `[가림]`으로만 표시했다.
