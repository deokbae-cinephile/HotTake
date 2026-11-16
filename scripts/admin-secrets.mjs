/**
 * @file 글쓴이 로그인 비밀 값 만들기 (scripts/admin-secrets.mjs)
 * 읽는 순서: 40/84번째 · 5단계(글쓴이 로그인과 잠금)
 *   앞: src/components/session-controls.tsx → 다음: src/lib/review-values.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓴이 비밀번호를 두 번 입력받아(화면에 보이지 않게), 서버 환경 변수에 넣을 두 값을 만들어 보여 줘요.
 *     ADMIN_PASSWORD_HASH : 비밀번호의 해시(되돌릴 수 없는 글자). 비밀번호 자체는 어디에도 저장하지 않아요.
 *     SESSION_SECRET      : 로그인 표(세션 쿠키)에 서명할 무작위 비밀 열쇠(48바이트)
 *   두 값을 .env.local이나 Cloudflare의 Secret 설정에 넣으면 돼요(.env.example 참고).
 *   비밀번호를 바꾸고 싶으면 다시 실행해 새 해시로 바꿔 넣어요. SESSION_SECRET을 바꾸면 모든 로그인이 풀려요.
 *
 * 누가 쓰나요?
 *   사람이 터미널에서 직접 실행해요: pnpm admin-secrets (package.json의 "admin-secrets" 명령)
 *   다른 코드가 import하지는 않아요.
 *
 * 해시는 블로그 서버와 똑같은 방법(src/lib/password-hash.ts)으로 만들어요. 그래야 서버가 로그인할 때 같은 해시로 맞춰 볼 수 있어요.
 * Node.js 26은 TypeScript 파일을 바로 불러올 수 있어서(타입 부분만 지우고 실행) .ts 파일을 그대로 가져와요(scripts/make-icons.mjs와 같아요).
 * 확장자 .mjs는 "import/export를 쓰는 ES 모듈 파일"이라는 표시예요. 그래서 맨 바깥에서 await를 바로 쓸 수 있어요.
 */

// node:crypto: Node.js에 들어 있는 암호 모듈. randomBytes는 알아맞힐 수 없는 무작위 바이트를 만들어요.
import { randomBytes } from "node:crypto";
// node:readline: 터미널에서 한 줄씩 입력받는 Node.js 모듈
import { createInterface } from "node:readline";

import { hashPassword } from "../src/lib/password-hash.ts";

/**
 * 입력 창구(readline)를 하나 만들어 두 물음에 함께 써요.
 * - 친 글자를 화면에 다시 찍어 주는 동작(_writeToOutput)을 빈 함수로 바꿔, 비밀번호가 화면에 보이지 않게 해요.
 * - 줄을 "차례로 꺼내 쓰는" 방식(async iterator)이라, 입력을 파이프로 한꺼번에 넘겨도 두 줄을 순서대로 읽어요.
 *   (terminal: 키보드로 직접 칠 때(isTTY)만 터미널 기능을 켜요. 파이프로 넘기면 꺼요.)
 */
const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY === true });
rl._writeToOutput = () => {};
// Symbol.asyncIterator: "for await로 하나씩 꺼낼 수 있는 것"의 약속된 이름이에요. lines.next()를 부를 때마다 다음 줄이 나와요.
const lines = rl[Symbol.asyncIterator]();

/**
 * 물음을 보이고, 화면에 글자를 보이지 않고 한 줄을 입력받아요.
 * @param {string} question 물음 글자
 * @returns {Promise<string>} 입력한 한 줄(입력이 끝났으면 빈 글자)
 */
async function askHidden(question) {
  process.stdout.write(question);
  // 구조 분해: next()가 돌려준 { value, done }에서 value만 꺼내요.
  const { value } = await lines.next();
  // 입력한 글자가 보이지 않아 줄바꿈도 찍히지 않으니, 직접 줄을 바꿔 다음 물음이 새 줄에 나오게 해요.
  process.stdout.write("\n");
  // ??(널 병합): value가 null·undefined(입력이 끝남)면 빈 글자 ""를 써요.
  return value ?? "";
}

// 파일 맨 바깥의 await(top-level await): ES 모듈(.mjs)이라 함수 밖에서도 기다릴 수 있어요.
const password = await askHidden("새 비밀번호: ");
const again = await askHidden("한 번 더: ");
// 입력 창구를 닫아야 프로그램이 입력을 더 기다리지 않고 끝나요.
rl.close();

// 짧은 비밀번호는 알아맞히기 쉬워서 받지 않아요. process.exit(1): 1(실패)로 프로그램을 끝내요.
if (password.length < 12) {
  console.error("비밀번호는 12글자 이상으로 정해 주세요. 길수록 알아맞히기 어려워요.");
  process.exit(1);
}
// 잘못 친 비밀번호로 해시를 만들지 않게, 두 번 친 것이 같은지 확인해요.
if (password !== again) {
  console.error("두 번 입력한 비밀번호가 다릅니다. 다시 실행해 주세요.");
  process.exit(1);
}

// \n은 줄바꿈 글자예요. 안내 앞뒤에 빈 줄을 둬서 읽기 쉽게 해요.
console.log("\n아래 두 줄을 .env.local(또는 호스팅의 환경 변수)에 넣으세요.\n");
console.log(`ADMIN_PASSWORD_HASH=${await hashPassword(password)}`);
// base64url: 주소·환경 변수에 곤란한 글자(+, /, =)가 없는 모양
console.log(`SESSION_SECRET=${randomBytes(48).toString("base64url")}`);
