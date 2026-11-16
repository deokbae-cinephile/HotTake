/**
 * @file E2E 시험용 글쓴이 계정 (e2e/admin-account.ts)
 * 읽는 순서: 77/84번째 · 8단계(설정·테스트·배포)
 *   앞: e2e/helpers.ts → 다음: e2e/mock-github.mjs (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * E2E 테스트에서만 쓰는 아이디·비밀번호예요. 진짜 비밀 값이 아니에요.
 *   - playwright.config.ts: 이 비밀번호로 해시를 만들어 블로그 서버의 환경 변수(ADMIN_ID, ADMIN_PASSWORD_HASH)로 넘겨요.
 *   - e2e/admin.spec.ts: 이 아이디·비밀번호로 로그인해 리뷰 추가·수정·삭제를 시험해요.
 *   - e2e/helpers.ts: loginAsAuthor가 이 계정으로 로그인 API를 불러요.
 * 이름이 .spec.ts로 끝나지 않아서 Playwright가 테스트 파일로 실행하지는 않아요.
 *
 * 왜 따로 파일로 뺐나요?
 *   서버에 넘기는 값(playwright.config.ts)과 로그인할 때 쓰는 값(테스트)이 늘 같아야 해요. 한곳에 두면 어긋날 일이 없어요.
 */

/**
 * 시험용 글쓴이 아이디와 비밀번호
 * as const: 값을 "읽기 전용 + 정확한 글자 타입"으로 굳혀요. 실수로 바꾸지 못하게 해요.
 */
export const E2E_ADMIN = { id: "e2e-admin", password: "e2e-password-1234" } as const;
