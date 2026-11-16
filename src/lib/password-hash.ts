/**
 * @file 비밀번호 해시 만들기·확인하기 (password-hash.ts)
 * 읽는 순서: 29/84번째 · 5단계(글쓴이 로그인과 잠금)
 *   앞: src/proxy.ts → 다음: src/lib/session.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓴이 비밀번호를 그대로 저장하지 않고 "해시"로 바꿔 저장하고, 로그인할 때 입력한 비밀번호가 맞는지 확인해요.
 *
 * 해시가 뭔가요?
 *   비밀번호를 되돌릴 수 없는 긴 글자로 바꾸는 계산이에요. "1234" → "scrypt.Xk3...".
 *   서버 설정(환경 변수)에는 해시만 넣어 두기 때문에, 설정이 새어 나가도 비밀번호 자체는 알 수 없어요.
 *   확인할 때는 입력한 비밀번호를 같은 방법으로 다시 계산해서, 저장해 둔 해시와 같은지 비교해요.
 *
 * scrypt를 쓰는 이유
 *   일부러 "느리고 메모리를 많이 쓰는" 계산이라, 해시를 훔친 사람이 비밀번호를 하나씩 대입해 보는 데 아주 오래 걸려요.
 *   Node.js에 들어 있는 기능이라 따로 설치할 것이 없어요.
 *   소금(salt): 비밀번호마다 다른 무작위 바이트를 섞어서, 같은 비밀번호라도 해시가 달라지게 해요.
 *   (미리 계산해 둔 "비밀번호 → 해시" 표로 한꺼번에 알아내는 공격을 막아요.)
 *
 * 해시 모양: "scrypt.소금.결과" (소금과 결과는 base64url 글자)
 *   구분 글자로 $ 대신 점(.)을 써요. .env 파일의 $는 "다른 변수 넣기"로 해석될 수 있어서예요.
 *
 * 누가 쓰나요?
 *   - scripts/admin-secrets.mjs: 글쓴이가 비밀번호를 정할 때 해시를 만들어요(그래서 서버 전용 표시 'server-only'를 붙이지 않았어요).
 *   - lib/admin-auth.ts: 로그인할 때 비밀번호를 확인해요.
 *   node:crypto를 쓰기 때문에 브라우저 코드에서는 가져올 수 없어요(가져오면 빌드가 실패해요).
 */

// randomBytes: 무작위 바이트 만들기, scrypt: 비밀번호 해시 계산, timingSafeEqual: 시간이 늘 같은 비교
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * scrypt 계산의 세기. N은 클수록 느려요(16384는 서버에서 수십 밀리초 정도). r, p는 흔히 쓰는 기본값이에요.
 * `as const`: 값이 바뀌지 않는 설정이라고 고정해요.
 */
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 } as const;
/** 결과 길이(바이트) */
const KEY_LENGTH = 32;
/** 해시 글자 맨 앞에 붙는 이름표. 나중에 계산 방법이 달라져도 어느 방법으로 만든 해시인지 알 수 있어요. */
const PREFIX = "scrypt";

/**
 * 비밀번호와 소금으로 scrypt 결과를 계산해요. 콜백 방식 함수를 await로 기다릴 수 있게 Promise로 감쌌어요.
 *
 * 콜백 방식: 일이 끝나면 마지막 값으로 넘긴 함수((error, key) => …)를 불러 결과를 알려 주는 옛 Node.js 방식이에요.
 * new Promise((resolve, reject) => …): resolve(값)를 부르면 성공, reject(오류)를 부르면 실패로 끝나는 Promise를 만들어요.
 *
 * @param password 비밀번호
 * @param salt 소금(Buffer: Node.js의 바이트 묶음)
 * @returns 32바이트 결과
 */
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFC"), salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

/**
 * 비밀번호를 해시로 바꿔요. 부를 때마다 소금이 달라서 결과도 매번 달라요(그래도 확인은 잘 돼요).
 *
 * normalize("NFC"): 한글 비밀번호는 입력기에 따라 저장 방식이 다를 수 있어서 하나로 맞춘 뒤 계산해요.
 *
 * @param password 해시로 바꿀 비밀번호
 * @returns "scrypt.소금.결과" 모양의 글자
 * @example
 * await hashPassword("내 비밀번호"); // "scrypt.q8W...Zg.Kx1...9Q"
 */
export async function hashPassword(password: string): Promise<string> {
  // 16바이트짜리 무작위 소금
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  // [이름표, 소금, 결과]를 점으로 이어요. toString("base64url"): 바이트를 base64url 글자로 바꿔요.
  return [PREFIX, salt.toString("base64url"), key.toString("base64url")].join(".");
}

/**
 * 입력한 비밀번호가 저장해 둔 해시와 맞는지 확인해요.
 *
 * timingSafeEqual: 두 값을 비교하는 시간이 늘 같아서, 비교 시간으로 정답을 짐작하는 공격을 막아요.
 *
 * @param password 로그인 화면에서 입력한 비밀번호
 * @param stored 환경 변수 ADMIN_PASSWORD_HASH의 값
 * @returns 맞으면 true. 해시 모양이 틀렸으면 false
 * @example
 * await verifyPassword("내 비밀번호", process.env.ADMIN_PASSWORD_HASH ?? ""); // true 또는 false
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  // "scrypt.소금.결과" 세 부분인지 확인해요. 넷째 조각(extra)이 있으면 모양이 틀린 거예요.
  const [prefix, saltText, keyText, extra] = stored.split(".");
  if (prefix !== PREFIX || !saltText || !keyText || extra !== undefined) return false;

  // base64url 글자를 바이트로 되돌려요.
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(keyText, "base64url");
  // 길이가 다르면 timingSafeEqual이 오류를 내요. 저장된 해시가 망가진 경우라 false로 답해요.
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;

  // 입력한 비밀번호를 같은 소금으로 다시 계산해, 저장해 둔 결과와 비교해요.
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected);
}
