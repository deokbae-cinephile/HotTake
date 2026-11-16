/**
 * @file 글쓴이 확인 (admin-auth.ts)
 * 읽는 순서: 32/84번째 · 5단계(글쓴이 로그인과 잠금)
 *   앞: src/lib/auth-cookies.ts → 다음: src/lib/login-limit.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   "지금 요청을 보낸 사람이 로그인한 글쓴이인가?"를 서버에서 확인하는 함수들을 모아 둬요.
 *     - checkCredentials : 로그인할 때 아이디·비밀번호가 맞는지
 *     - isAdmin          : 글쓰기 화면(서버 컴포넌트)을 그리기 전에 로그인했는지
 *     - isSameOrigin     : 요청이 우리 사이트의 화면에서 보낸 것인지(CSRF 막기)
 *     - guardAdminRequest: 저장·삭제 API가 일을 하기 전에 로그인했고, 우리 사이트에서 보낸 요청인지
 *     - cookieOptions    : 로그인 쿠키를 굽는 설정
 *
 * proxy.ts가 이미 막는데 왜 또 확인하나요?
 *   Next.js 문서도 "proxy는 빠른 1차 확인일 뿐, 인증은 데이터를 다루는 곳에서 다시 확인하라"고 권해요.
 *   proxy의 주소 규칙(matcher)을 실수로 바꾸거나 파일을 옮기면 검사가 조용히 빠질 수 있거든요.
 *   그래서 API와 글쓰기 화면이 스스로 한 번 더 확인해요(이중 잠금).
 *
 * 배경 개념
 *   - 인증(authentication): "누구인지" 확인하는 일이에요. 이 블로그에서는 글쓴이 한 사람만 로그인할 수 있어요.
 *   - 세션 쿠키: 로그인에 성공하면 서버가 브라우저에 맡겨 두는 "로그인 표"예요(lib/session.ts가 만들고 확인해요).
 *     브라우저는 다음 요청부터 이 쿠키를 저절로 함께 보내서, 서버가 매번 비밀번호를 묻지 않아도 돼요.
 *   - 환경 변수(process.env.이름): 코드 밖(서버 설정, .env 파일)에 둔 값이에요. 비밀 값을 코드에 적지 않으려고 써요.
 *
 * 누가 쓰나요?
 *   app/api/session/route.ts(로그인·로그아웃), app/api/images/route.ts, app/api/reviews/**(저장·삭제),
 *   app/write/page.tsx·app/write/[slug]/page.tsx(글쓰기 화면)
 */

// 이 파일은 서버에서만 돌아야 해요(비밀번호 확인, 비밀 설정 읽기). 브라우저 코드에서 가져오면 빌드가 오류를 내요.
// "server-only"는 그 약속을 지켜 주는 작은 패키지예요. 가져오기만 해도 효과가 있어서 이름 없이 import해요.
import "server-only";

// node:crypto: Node.js에 들어 있는 암호 계산 도구예요("node:"는 Node.js 기본 모듈이라는 표시).
//   createHash: 해시(되돌릴 수 없는 요약값) 계산, timingSafeEqual: 걸리는 시간이 늘 같은 비교
import { createHash, timingSafeEqual } from "node:crypto";

// cookies: 서버 컴포넌트에서 지금 요청의 쿠키를 읽는 Next.js 함수
import { cookies } from "next/headers";
// NextRequest: Next.js가 주는 요청 객체의 타입. 쿠키(request.cookies)와 주소(request.nextUrl)를 쉽게 읽을 수 있어요.
import type { NextRequest } from "next/server";

import { SESSION_COOKIE, SESSION_MAX_AGE } from "./auth-cookies";
import { verifyPassword } from "./password-hash";
import { isValidSession, readSessionConfig } from "./session";

/** 로그인 확인 결과: 맞음 / 틀림 / 서버에 설정이 없음. 정해진 글자 셋 중 하나만 올 수 있는 타입이에요. */
export type CredentialResult = "ok" | "wrong" | "not-configured";

/**
 * 글자를 SHA-256 바이트로 바꿔요. 길이가 다른 두 글자도 같은 길이(32바이트)로 맞춰 비교할 수 있어요.
 * (timingSafeEqual은 길이가 같은 두 값만 비교할 수 있어서 이렇게 맞춰요.)
 *
 * normalize("NFC"): 한글은 "가"를 한 글자로도, "ㄱ+ㅏ" 두 조각으로도 저장할 수 있어요. 한 방식(NFC)으로 맞춘 뒤 계산해요.
 *
 * @param text 바꿀 글자
 * @returns 32바이트 Buffer(Node.js의 바이트 묶음)
 */
const digest = (text: string) => createHash("sha256").update(text.normalize("NFC")).digest();

/**
 * 로그인 화면에서 보낸 아이디·비밀번호가 글쓴이 정보(환경 변수)와 맞는지 확인해요.
 *
 * - ADMIN_ID: 글쓴이 아이디
 * - ADMIN_PASSWORD_HASH: 글쓴이 비밀번호의 해시(`pnpm admin-secrets`로 만들어요)
 * - SESSION_SECRET: 로그인 표 서명 열쇠(없으면 로그인해도 표를 만들 수 없어서 "설정 없음"으로 봐요)
 *
 * 아이디가 틀려도 비밀번호 계산을 똑같이 해요. 그래야 응답 시간으로 "아이디는 맞았구나"를 알아챌 수 없어요.
 *
 * @param id 입력한 아이디
 * @param password 입력한 비밀번호
 * @returns "ok"(맞음), "wrong"(틀림), "not-configured"(서버 설정 없음)
 */
export async function checkCredentials(id: string, password: string): Promise<CredentialResult> {
  // 세션 설정(SESSION_SECRET, ADMIN_ID)과 비밀번호 해시를 읽어요. 하나라도 없으면 로그인할 수 없어요.
  const config = readSessionConfig();
  const hash = process.env.ADMIN_PASSWORD_HASH ?? "";
  if (!config || hash === "") return "not-configured";

  // 아이디 비교: 같은 길이로 맞춘 뒤 시간이 늘 같은 방법으로 비교해요.
  // (보통의 === 비교는 앞 글자부터 다른 곳을 찾자마자 멈춰서, 걸린 시간으로 몇 글자까지 맞았는지 짐작할 수 있어요.)
  const idMatches = timingSafeEqual(digest(id), digest(config.adminId));
  // 비밀번호 확인(아이디가 틀려도 계산해요)
  const passwordMatches = await verifyPassword(password, hash);
  // 둘 다 맞아야(&&) "ok"예요. 무엇이 틀렸는지는 알려 주지 않아요(아이디만 맞혀 보는 공격을 막아요).
  return idMatches && passwordMatches ? "ok" : "wrong";
}

/**
 * 서버 컴포넌트(글쓰기 화면)에서 지금 요청이 로그인한 글쓴이의 것인지 알려 줘요.
 *
 * cookies(): Next.js가 주는 "지금 요청의 쿠키" 도구예요. 이 함수를 부른 화면은 요청마다 서버에서 그려져요.
 * Next.js 15부터 cookies()는 Promise를 돌려줘서 await로 꺼내요.
 * `?.`(옵셔널 체이닝): 쿠키가 없으면(undefined) 오류 없이 undefined를 돌려주고, 있으면 .value를 읽어요.
 *
 * @returns 로그인한 글쓴이면 true
 * @example
 * if (!(await isAdmin())) redirect("/login?next=/write");
 */
export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return isValidSession(token);
}

/**
 * 요청이 우리 사이트의 화면에서 보낸 것인지 확인해요(CSRF 막기).
 *
 * CSRF가 뭔가요?
 *   나쁜 사이트가 글쓴이 브라우저를 시켜 몰래 우리 API로 "리뷰 삭제"를 보내는 공격이에요.
 *   (Cross-Site Request Forgery: 다른 사이트에서 요청을 위조한다는 뜻이에요.)
 *   브라우저는 POST·PUT·DELETE 요청에 "어느 사이트에서 보냈는지(Origin)"를 반드시 붙여요.
 *   Origin의 주소(호스트)가 요청을 받은 우리 주소와 다르면 받지 않아요. (쿠키의 SameSite=Lax 설정도 함께 막아 줘요.)
 *
 * 우리 주소는 Host 헤더로 알아요. 호스팅의 중간 서버(프록시)를 거치면 원래 주소가 x-forwarded-host에 담겨 오기도 해서
 * 그쪽을 먼저 봐요(Next.js의 Server Actions도 같은 방법으로 확인해요).
 *
 * @param request 들어온 요청
 * @returns 우리 사이트에서 보낸 요청이면 true. Origin이 없거나 모양이 틀려도 false예요.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  // Origin은 "https://deokbae.blog" 모양이에요. URL로 풀어 호스트("deokbae.blog")만 꺼내 비교해요.
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    // new URL()은 주소 모양이 아니면 오류를 던져요. 그런 Origin은 믿을 수 없어서 false예요.
    return false;
  }
  // `A ?? B ?? C`: 앞에서부터 처음으로 null·undefined가 아닌 값을 써요.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  return originHost === host;
}

/**
 * 저장·삭제 API가 일을 시작하기 전에 불러요. 문제가 있으면 그대로 돌려줄 오류 응답을, 괜찮으면 null을 돌려줘요.
 *   - 다른 사이트에서 보낸 요청: 403(금지)
 *   - 로그인하지 않았거나 로그인 표가 틀림·만료: 401(로그인 필요)
 *
 * Response.json(값, { status }): 값을 JSON 본문으로 담은 응답을 만드는 웹 표준 함수예요.
 *
 * @param request 들어온 요청
 * @returns 막아야 하면 오류 응답, 통과면 null
 * @example
 * const denied = await guardAdminRequest(request);
 * if (denied) return denied;
 */
export async function guardAdminRequest(request: NextRequest): Promise<Response | null> {
  if (!isSameOrigin(request)) {
    return Response.json({ message: "이 블로그 화면에서 보낸 요청만 받습니다. 블로그를 새로 고친 뒤 다시 시도하세요." }, { status: 403 });
  }
  // request.cookies.get(이름)?.value: 요청에 붙어 온 세션 쿠키 값(없으면 undefined)
  if (!(await isValidSession(request.cookies.get(SESSION_COOKIE)?.value))) {
    return Response.json({ message: "로그인이 필요합니다. 다시 로그인한 뒤 시도하세요." }, { status: 401 });
  }
  return null;
}

/**
 * 로그인 쿠키를 구울 때 쓰는 설정이에요.
 *
 * - httpOnly: 자바스크립트가 읽지 못하게(세션 쿠키만 true, 표시 쿠키는 화면이 읽어야 해서 false)
 * - secure: HTTPS로만 보내요. 내 컴퓨터의 개발 서버(http)에서도 로그인할 수 있게 운영 빌드에서만 켜요.
 *   (process.env.NODE_ENV는 `next build`·`next start`에서 "production", `next dev`에서 "development"예요.)
 * - sameSite "lax": 다른 사이트에서 보낸 POST 요청에는 쿠키를 붙이지 않아요(CSRF 막기).
 * - path "/": 사이트 전체에서 써요. maxAge: 7일(초 단위) 뒤 저절로 지워져요.
 *
 * @param httpOnly 세션 쿠키면 true, 표시 쿠키면 false
 * @returns response.cookies.set(이름, 값, 설정)의 세 번째 값으로 넣을 설정
 */
export function cookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    secure: process.env.NODE_ENV === "production",
    // `as const`: 타입을 그냥 string이 아니라 "lax"로 고정해요. 쿠키 설정 타입이 "lax" | "strict" | "none"만 받아서예요.
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}
