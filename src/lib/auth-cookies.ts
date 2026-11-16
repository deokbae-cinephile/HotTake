/**
 * @file 로그인 쿠키 이름과 유지 시간 (auth-cookies.ts)
 * 읽는 순서: 31/84번째 · 5단계(글쓴이 로그인과 잠금)
 *   앞: src/lib/session.ts → 다음: src/lib/admin-auth.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   로그인에 쓰는 쿠키 두 개의 이름과, 로그인이 유지되는 시간을 정해 둬요.
 *   서버(proxy.ts, 로그인 API)와 화면(로그인했을 때만 보이는 단추)이 같은 이름을 써야 해서 한곳에 모았어요.
 *
 * 쿠키가 뭔가요?
 *   서버가 브라우저에 맡겨 두는 작은 "이름=값" 글자예요. 브라우저는 같은 사이트에 요청할 때마다 저절로 함께 보내요.
 *
 * 쿠키가 왜 두 개일까요?
 *   1. 세션 쿠키(SESSION_COOKIE): "이 사람은 글쓴이예요"라는 서명이 든 표예요.
 *      httpOnly로 만들어서 브라우저의 자바스크립트가 읽을 수 없어요. 그래서 나쁜 스크립트가 훔쳐 가지 못해요.
 *      서버(proxy.ts, API)만 이 표를 읽고 서명을 확인해요.
 *   2. 표시 쿠키(ADMIN_HINT_COOKIE): 값이 "1"뿐인, 비밀이 없는 쿠키예요.
 *      목록 화면은 빌드할 때 미리 만든 파일이라 서버가 사람마다 다르게 그려 줄 수 없어요.
 *      그래서 브라우저가 이 표시를 보고 [+](리뷰 추가)·[수정]·[삭제] 단추를 보일지만 정해요(lib/admin-hint.ts).
 *      누가 이 표시를 몰래 만들어도 단추만 보일 뿐, 실제 저장은 서버가 세션 쿠키로 다시 확인해서 막혀요.
 *
 * 이 파일에는 비밀 값도, 서버 전용 코드도 없어서 화면 코드에서도 가져다 쓸 수 있어요.
 *
 * 누가 쓰나요?
 *   src/proxy.ts, app/api/session/route.ts, lib/session.ts, lib/admin-auth.ts, lib/admin-hint.ts
 */

/** 세션 쿠키 이름(서명이 든 표, httpOnly) */
export const SESSION_COOKIE = "blog_session";

/** 로그인 표시 쿠키 이름(값 "1", 화면이 단추를 보일지 정할 때만 써요) */
export const ADMIN_HINT_COOKIE = "blog_admin";

/**
 * 로그인 유지 시간: 7일(초 단위). 60초 × 60분 × 24시간 × 7일 = 604800초
 * 쿠키의 maxAge(lib/admin-auth.ts)와 로그인 표의 만료 시각(lib/session.ts)에 함께 써서, 둘이 같은 때 끝나요.
 */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7;
