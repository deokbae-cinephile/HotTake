/**
 * @file 로그인 세션 표 만들기·확인하기 (session.ts)
 * 읽는 순서: 30/84번째 · 5단계(글쓴이 로그인과 잠금)
 *   앞: src/lib/password-hash.ts → 다음: src/lib/auth-cookies.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓴이가 로그인하면 "이 사람은 글쓴이예요, 언제까지 유효해요"라는 표(토큰)를 만들어 쿠키에 담아 줘요.
 *   다음 요청부터는 서버가 그 표를 보고 진짜인지(위조되지 않았는지), 기한이 남았는지 확인해요.
 *
 * 표의 모양
 *   "내용.서명" 두 부분을 점(.)으로 이은 글자예요.
 *     내용: { sub: 글쓴이 아이디, exp: 만료 시각(초) }를 JSON으로 적고 base64url로 바꾼 글자
 *     서명: 내용을 비밀 열쇠(SESSION_SECRET)로 HMAC-SHA256 계산한 값
 *   비밀 열쇠를 모르는 사람은 올바른 서명을 만들 수 없어서, 내용을 고치면(예: 기한 늘리기) 확인에서 걸려요.
 *   내용은 암호화한 것이 아니라 누구나 풀어 읽을 수 있어요. 그래서 비밀이 아닌 값(아이디, 만료 시각)만 넣어요.
 *
 * HMAC가 뭔가요?
 *   "내용 + 비밀 열쇠"로 계산하는 서명이에요. 같은 내용·같은 열쇠면 늘 같은 서명이 나오고,
 *   내용이 한 글자만 달라도 서명이 완전히 달라져요. 열쇠를 모르면 맞는 서명을 만들 수 없어요.
 *
 * 왜 라이브러리 없이 직접 만들었나요?
 *   브라우저·Node.js·엣지 런타임 어디에나 있는 웹 표준 Web Crypto(crypto.subtle)만 쓰면 20줄 남짓이라
 *   의존성을 더하지 않았어요(가벼움이 우선). 같은 이유로 node:crypto도 쓰지 않아,
 *   proxy.ts가 어느 런타임(Cloudflare Workers, Node.js 서버 등)에서 돌아도 그대로 동작해요.
 *
 * 누가 쓰나요?
 *   src/proxy.ts(쓰기 화면·API 앞에서 확인), lib/admin-auth.ts(API와 글쓰기 화면에서 다시 확인),
 *   app/api/session/route.ts(로그인할 때 표 만들기)
 */

import { SESSION_MAX_AGE } from "./auth-cookies";

/** 표의 내용: 누구(sub, subject의 줄임)의 표인지와 언제(exp, expires의 줄임. 1970년부터 센 초)까지 유효한지 */
type SessionPayload = { sub: string; exp: number };

/**
 * 글자 ↔ 바이트 변환 도구. 암호 계산은 바이트(Uint8Array: 0~255 숫자의 배열)로 해요.
 * TextEncoder는 글자 → UTF-8 바이트, TextDecoder는 바이트 → 글자로 바꿔요. 한 번 만들어 두고 계속 써요.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * 바이트를 base64url 글자로 바꿔요.
 * base64url은 base64에서 주소·쿠키에 곤란한 글자(+, /, =)를 -, _로 바꾸고 끝의 =를 지운 모양이에요.
 *
 * @param bytes 바꿀 바이트
 * @returns base64url 글자. 예: "eyJzdWIiOiJkZW9rYmFlIn0"
 */
function toBase64Url(bytes: Uint8Array): string {
  // btoa는 "한 글자 = 한 바이트" 글자를 base64로 바꿔요. 그래서 바이트를 먼저 그런 글자로 이어 붙여요.
  // String.fromCharCode(숫자): 그 번호의 글자 하나를 만들어요.
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  // 정규식 /\+/g: 글자 안의 모든(g) "+"를 찾아요. /=+$/: 끝($)에 붙은 "="들을 찾아요.
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * base64url 글자를 바이트로 되돌려요. 모양이 틀렸으면 null이에요.
 *
 * `Uint8Array<ArrayBuffer>`: 바이트 배열 타입이에요. <ArrayBuffer>는 "보통 메모리에 담긴 배열"이라는 뜻이라,
 * crypto.subtle.verify에 그대로 넘길 수 있어요.
 *
 * @param text base64url 글자
 * @returns 바이트 또는 null
 */
function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  // base64url에 쓰는 글자만 들어 있는지 먼저 확인해요. ^…$: 처음부터 끝까지, *: 0번 이상 되풀이
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    // -, _를 원래의 +, /로 돌려놓고 atob로 풀어요(atob는 끝의 = 없이도 풀어 줘요).
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    // 풀린 글자를 한 글자씩 바이트 번호로 바꿔 배열에 담아요. charCodeAt(i): i번째 글자의 번호
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    // 길이가 맞지 않는 등 풀 수 없는 글자면 atob가 오류를 던져요.
    return null;
  }
}

/**
 * 비밀 열쇠 글자로 HMAC-SHA256 열쇠를 만들어요. extractable: false — 만든 열쇠를 다시 꺼낼 수 없게 해요.
 *
 * importKey의 값: ("raw" = 바이트 그대로, 열쇠 바이트, 계산 방법, 꺼낼 수 있는지, 쓸 곳(서명·확인))
 *
 * @param secret 비밀 열쇠 글자(SESSION_SECRET)
 * @returns Web Crypto가 쓰는 열쇠(CryptoKey)를 돌려주는 Promise
 */
function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/**
 * 로그인 표를 만들어요.
 *
 * @param sub 글쓴이 아이디(ADMIN_ID)
 * @param secret 비밀 열쇠(SESSION_SECRET)
 * @param now 지금 시각(밀리초). 테스트에서 시각을 정해 넣으려고 받아요. 기본은 지금(`= Date.now()`: 값을 안 넘기면 쓰는 기본값)
 * @returns "내용.서명" 모양의 글자
 * @example
 * const token = await createSessionToken("deokbae", process.env.SESSION_SECRET!);
 */
export async function createSessionToken(sub: string, secret: string, now = Date.now()): Promise<string> {
  // 만료 시각 = 지금(초) + 유지 시간(7일). Date.now()는 밀리초라 1000으로 나누고, Math.floor로 소수점을 버려요.
  const payload: SessionPayload = { sub, exp: Math.floor(now / 1000) + SESSION_MAX_AGE };
  // 내용: 객체 → JSON 글자 → 바이트 → base64url 글자
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  // 내용 글자(body)에 서명해요. 확인할 때도 똑같이 body 글자로 확인해요.
  // crypto.subtle.sign은 ArrayBuffer를 돌려줘서, 바이트 배열(Uint8Array)로 감싸 다뤄요.
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await importKey(secret), encoder.encode(body)));
  return `${body}.${toBase64Url(signature)}`;
}

/**
 * 로그인 표가 진짜이고, 기한이 남았고, 지금 글쓴이의 표인지 확인해요.
 *
 * crypto.subtle.verify는 서명을 비교할 때 걸리는 시간이 늘 같아서(상수 시간),
 * "어디까지 맞았는지"를 시간 차이로 알아내는 공격(타이밍 공격)을 막아 줘요.
 *
 * @param token 쿠키에서 꺼낸 표
 * @param secret 비밀 열쇠(SESSION_SECRET)
 * @param expectedSub 지금 글쓴이 아이디(ADMIN_ID). 아이디를 바꾸면 그 전에 만든 표는 모두 무효가 돼요.
 * @param now 지금 시각(밀리초). 기본은 지금
 * @returns 모두 맞으면 true
 */
export async function verifySessionToken(token: string, secret: string, expectedSub: string, now = Date.now()): Promise<boolean> {
  // "내용.서명" 두 부분으로 나눠요. 점이 더 있거나 비어 있으면 가짜예요.
  // `const [a, b, c] = 배열`(배열 구조 분해): 배열의 0·1·2번째 값을 각각 a·b·c에 담아요.
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return false;

  const signatureBytes = fromBase64Url(signature);
  const bodyBytes = fromBase64Url(body);
  if (!signatureBytes || !bodyBytes) return false;

  // 1) 서명 확인: 내용 글자로 다시 계산한 서명과 같은지
  const valid = await crypto.subtle.verify("HMAC", await importKey(secret), signatureBytes, encoder.encode(body));
  if (!valid) return false;

  // 2) 내용 확인: 같은 글쓴이인지, 기한이 남았는지
  try {
    // Partial<타입>: 모든 항목을 "없어도 됨(?)"으로 바꾼 타입이에요. 내용이 이상해도 하나씩 확인하려고 써요.
    const payload = JSON.parse(decoder.decode(bodyBytes)) as Partial<SessionPayload>;
    // exp는 초 단위라 1000을 곱해 밀리초(now)와 비교해요.
    return payload.sub === expectedSub && typeof payload.exp === "number" && payload.exp * 1000 > now;
  } catch {
    // JSON.parse는 JSON 모양이 아니면 오류를 던져요.
    return false;
  }
}

/**
 * 세션 확인에 필요한 서버 설정(환경 변수)을 읽어요. 설정이 없거나 모자라면 null이에요.
 *
 * - SESSION_SECRET: 서명용 비밀 열쇠. 짧으면 알아맞히기 쉬워서 32글자 이상만 받아요(`pnpm admin-secrets`가 만들어 줘요).
 * - ADMIN_ID: 글쓴이 아이디. 이 블로그는 이 아이디 한 사람만 로그인할 수 있어요.
 *
 * @returns { secret, adminId } 또는 null
 */
export function readSessionConfig(): { secret: string; adminId: string } | null {
  // 환경 변수가 없으면(undefined) 빈 글자로 봐요.
  const secret = process.env.SESSION_SECRET ?? "";
  const adminId = process.env.ADMIN_ID ?? "";
  if (secret.length < 32 || adminId === "") return null;
  return { secret, adminId };
}

/**
 * 쿠키의 표가 지금 유효한 글쓴이 로그인인지 알려 줘요. 서버 설정이 없으면 늘 false(아무도 로그인할 수 없음)예요.
 *
 * @param token 세션 쿠키 값. 쿠키가 없으면 undefined
 * @returns 유효한 로그인이면 true
 */
export async function isValidSession(token: string | undefined): Promise<boolean> {
  const config = readSessionConfig();
  if (!config || !token) return false;
  return verifySessionToken(token, config.secret, config.adminId);
}
