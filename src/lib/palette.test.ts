// @vitest-environment node
// ↑ 파일을 읽으려고(node:fs) 브라우저 흉내(jsdom) 없이 Node.js 환경에서 돌려요.

/**
 * @file palette.ts 테스트
 *
 * lib/palette.ts의 색 값이 globals.css의 기본 인광 색(:root)과 같은지 확인해요.
 * 한쪽만 고치면 공유 미리 보기 그림·앱 아이콘과 화면의 색이 어긋나니, 둘을 함께 고치라고 알려 줘요.
 *
 * 테스트 도구 문법
 *   describe/it: 테스트 묶음과 테스트 하나. expect(값).toBe(기대): 값이 기대와 같은지 확인해요.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { GREEN_PHOSPHOR } from "./palette";

describe("GREEN_PHOSPHOR", () => {
  it("globals.css :root의 기본 색과 같다", async () => {
    // path.resolve: 테스트를 실행한 폴더(저장소 맨 위) 기준의 전체 경로를 만들어요. "utf8": 글자로 읽어요.
    const css = await readFile(path.resolve("src/app/globals.css"), "utf8");
    // 첫 번째 ":root {" 덩어리(기본 색 묶음)만 잘라 봐요.
    const root = css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")));
    // "--이름: #xxxxxx;" 모양을 찾아 괄호 안(색 값)을 꺼내요. exec 결과의 [1]이 첫 번째 괄호에 걸린 글자예요.
    // 찾지 못하면 exec가 null이라, `?.[1]`로 오류 없이 undefined를 돌려줘요.
    const value = (name: string) => new RegExp(`--${name}: (#[0-9a-f]{6});`).exec(root)?.[1];

    expect(value("phosphor")).toBe(GREEN_PHOSPHOR.phosphor);
    expect(value("phosphor-dim")).toBe(GREEN_PHOSPHOR.dim);
    expect(value("phosphor-line")).toBe(GREEN_PHOSPHOR.line);
    expect(value("screen")).toBe(GREEN_PHOSPHOR.screen);
    expect(value("ink")).toBe(GREEN_PHOSPHOR.ink);
  });
});
