/**
 * @file 로그인 실패 횟수 제한 (login-limit.ts)
 * 읽는 순서: 33/84번째 · 5단계(글쓴이 로그인과 잠금)
 *   앞: src/lib/admin-auth.ts → 다음: src/app/api/session/route.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   같은 곳(IP)에서 로그인에 짧은 시간 여러 번 실패하면, 잠시 비밀번호를 확인하지 않고 바로 막아요(429).
 *     - 10분 동안 10번 틀리면, 가장 오래된 시도가 10분을 넘길 때까지 막아요.
 *     - 로그인에 성공하면 그곳의 기록을 지워요.
 *   (IP 주소: 인터넷에서 요청을 보낸 곳의 번호예요. 예: 203.0.113.9)
 *   (429 Too Many Requests: "너무 많이 요청했어요"라는 HTTP 상태 번호예요.)
 *
 * 왜 비밀번호를 확인하기 "전에" 세나요?
 *   1. 비밀번호 확인(scrypt)은 일부러 CPU를 많이 쓰게 만든 계산이에요. 막힌 곳의 요청은 계산하지 않아야
 *      비밀번호 대입 공격도 느려지고, 서버(Cloudflare Workers의 CPU 한도)도 지킬 수 있어요.
 *   2. 확인이 끝난 뒤에 세면, 계산하는 동안 같은 곳에서 동시에 보낸 요청이 모두 검사를 통과해 버려요.
 *      그래서 시도를 먼저 "실패 한 번"으로 세어 두고(reserveLoginAttempt), 맞았을 때만 지워요(clearLoginFailures).
 *
 * "미끄러지는 시간 창(sliding window)"으로 세요
 *   곳마다 시도한 시각을 모두 적어 두고, 셀 때마다 "지금부터 10분 안"의 시각만 남겨 개수를 세요.
 *   그래서 10분이 지난 시도는 하나씩 저절로 빠져요.
 *
 * 한계
 *   기록은 서버 메모리에 있어서 서버 인스턴스(Workers의 isolate)마다 따로 세고, 인스턴스가 바뀌면 사라져요.
 *   그래서 Cloudflare의 속도 제한 규칙(Rate limiting rules, 무료 1개)으로 /api/session을 함께 막고 있어요
 *   (IP마다 10초에 5번, docs/development.md 5장).
 *
 * 누가 쓰나요?
 *   app/api/session/route.ts(로그인 API)
 */

/** 시도를 세는 시간 창: 10분(밀리초). 10분 × 60초 × 1000밀리초 */
export const WINDOW_MS = 10 * 60 * 1000;
/** 시간 창 안에서 허용하는 (성공하지 못한) 시도 횟수 */
export const MAX_FAILURES = 10;
/** 기록을 들고 있는 곳의 수가 이보다 많아지면 오래된 기록을 치워요(메모리가 끝없이 늘지 않게). */
const SWEEP_AT = 1000;

/**
 * 곳(IP) → 시도한 시각들(오래된 것부터)
 * Map<열쇠, 값>: 열쇠로 값을 찾는 표예요. 여기서는 IP 글자로 시각 배열(number[])을 찾아요.
 * 파일 맨 위에 만든 값이라, 서버가 켜져 있는 동안 요청 사이에도 남아 있어요.
 */
const attempts = new Map<string, number[]>();

/**
 * 시간 창 안의 시도만 남겨요.
 *
 * @param key 요청한 곳(IP)
 * @param now 지금 시각(밀리초)
 * @returns 최근 10분 안의 시도 시각들(새 배열)
 */
function recent(key: string, now: number): number[] {
  // filter: 조건이 참인 값만 남긴 새 배열을 만들어요. 기록이 없으면(undefined) 빈 배열([])로 봐요.
  return (attempts.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
}

/**
 * 로그인 시도를 하나 예약해요. 허용되면 이 시도를 바로 "실패 한 번"으로 세어 두고 { ok: true }를 돌려줘요.
 * 막혔으면 몇 초 뒤에 다시 시도할 수 있는지 알려 줘요.
 * 비밀번호가 맞으면 clearLoginFailures로 기록을 지워요.
 *
 * @param key 요청한 곳(IP)
 * @param now 지금 시각(밀리초). 테스트에서 시각을 정해 주려고 받아요.
 * @returns 허용이면 { ok: true }, 막혔으면 { ok: false, retryAfter: 기다릴 초 }
 * @example
 * const allowed = reserveLoginAttempt(clientKey(request.headers));
 * if (!allowed.ok) return 429 응답(Retry-After: allowed.retryAfter);
 */
export function reserveLoginAttempt(key: string, now = Date.now()): { ok: true } | { ok: false; retryAfter: number } {
  const times = recent(key, now);
  if (times.length >= MAX_FAILURES) {
    // 오래된 시각을 걸러 낸 배열로 바꿔 둬요(막혔을 때는 시도를 더 세지 않아요).
    attempts.set(key, times);
    // 가장 오래된 시도가 시간 창을 벗어나는 때까지 막아요. 최소 1초.
    // times[0]!: 맨 앞(가장 오래된) 시각. `!`는 "여기는 값이 꼭 있어요"라고 TypeScript에 알려 줘요(길이가 10 이상이니까요).
    // Math.ceil: 소수점을 올려 정수 초로 만들어요.
    return { ok: false, retryAfter: Math.max(1, Math.ceil((times[0]! + WINDOW_MS - now) / 1000)) };
  }
  // 허용: 이번 시도를 먼저 세어 둬요.
  times.push(now);
  attempts.set(key, times);
  // 기록이 많아지면 시간 창을 벗어난 곳들을 지워요.
  if (attempts.size > SWEEP_AT) {
    // `for (const [other] of attempts)`: Map을 돌며 [열쇠, 값] 짝에서 열쇠만 꺼내요.
    for (const [other] of attempts) if (recent(other, now).length === 0) attempts.delete(other);
  }
  return { ok: true };
}

/**
 * 로그인에 성공하면 그곳의 기록을 지워요.
 *
 * @param key 요청한 곳(IP)
 */
export function clearLoginFailures(key: string): void {
  attempts.delete(key);
}

/**
 * 요청한 곳(IP)을 알아내요.
 * Cloudflare는 진짜 접속 주소를 cf-connecting-ip 머리글에 넣어 줘요(방문자가 바꿀 수 없어요).
 * 다른 환경(내 컴퓨터의 Node.js 서버 등)에서는 x-forwarded-for의 첫 주소를 쓰고, 그마저 없으면 "unknown"으로 함께 세요.
 *
 * x-forwarded-for는 "처음 보낸 곳, 거쳐 온 중간 서버, …" 순서로 주소를 쉼표로 이어 적어요. 그래서 첫 주소를 써요.
 *
 * @param headers 요청 머리글
 * @returns IP 글자 또는 "unknown"
 * @example
 * clientKey(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })); // "203.0.113.7"
 */
export function clientKey(headers: Headers): string {
  // split(",")[0]?.trim(): 쉼표로 나눈 첫 조각의 앞뒤 빈칸을 지워요. `?.`는 값이 없을 때 오류 없이 undefined를 돌려줘요.
  return headers.get("cf-connecting-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
