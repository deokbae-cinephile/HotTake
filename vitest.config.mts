/**
 * @file 단위 테스트 설정 (vitest.config.mts)
 * 읽는 순서: 72/84번째 · 8단계(설정·테스트·배포)
 *   앞: next.config.ts → 다음: vitest.setup.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * Vitest가 뭔가요?
 *   함수와 컴포넌트를 하나씩 떼어 시험하는 "단위 테스트" 도구예요.
 *   src 안의 *.test.ts, *.test.tsx 파일을 찾아 실행합니다.
 *   (E2E 테스트는 e2e 폴더에 따로 있고 Playwright가 돌려요. playwright.config.ts)
 *
 * 누가 쓰나요?
 *   pnpm test(vitest run)와 pnpm test:watch가 이 파일을 읽어요. CI의 "단위 테스트" 단계도 pnpm test를 써요.
 *
 * 확장자 .mts는 "ES 모듈로 읽는 TypeScript 파일"이라는 표시예요(import.meta.url을 쓸 수 있어요).
 *
 * 실행: pnpm test (한 번) / pnpm test:watch (파일을 고칠 때마다 다시)
 */

// fileURLToPath: "file:///..." 모양의 주소를 이 컴퓨터의 파일 경로로 바꿔요.
import { fileURLToPath } from "node:url";

// @vitejs/plugin-react: Vite(Vitest가 안에서 쓰는 빌드 도구)가 React의 JSX 문법을 알아듣게 하는 플러그인
import react from "@vitejs/plugin-react";
// defineConfig: 설정 모양을 검사하고 편집기 자동 완성을 도와주는 함수예요.
import { defineConfig } from "vitest/config";

export default defineConfig({
  // React 컴포넌트(JSX)를 테스트에서 읽을 수 있게 하는 플러그인
  plugins: [react()],
  resolve: {
    // tsconfig.json의 "@/" 줄임 경로를 테스트에서도 쓸 수 있게 해요.
    tsconfigPaths: true,
    // 'server-only'는 "브라우저 코드에서 가져오면 오류"를 내는 표시 모듈이에요.
    // 테스트는 서버도 브라우저도 아니라서 의미가 없으니, 그 패키지에 함께 들어 있는 빈 파일(empty.js)로 바꿔 끼워요.
    // new URL(...).pathname을 쓰면 폴더 이름의 한글·공백이 %EA%B2... 같은 글자로 남아 경로가 틀어져요.
    // fileURLToPath로 바꾸면 한글·공백 폴더와 Windows에서도 올바른 파일 경로가 돼요.
    // import.meta.url: 지금 이 설정 파일의 주소("file:///.../vitest.config.mts")예요. 여기를 기준으로 상대 경로를 풀어요.
    alias: { "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)) },
  },
  test: {
    // jsdom: 브라우저를 흉내 낸 가상 화면. 컴포넌트를 그려 볼 수 있어요.
    // (서버 코드 테스트는 파일 맨 위에 `// @vitest-environment node`를 적어 Node.js 환경으로 바꿔요.)
    environment: "jsdom",
    // 테스트를 시작하기 전에 한 번 실행할 준비 파일
    setupFiles: ["./vitest.setup.ts"],
    // 테스트 파일 위치와 이름 규칙. **는 "아래 모든 폴더", {ts,tsx}는 "ts 또는 tsx"라는 뜻이에요.
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
