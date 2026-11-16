/**
 * @file 읽는 순서 안내 검사 (reading-order.test.ts)
 *
 * docs/reading-order.md의 "코드 읽는 순서" 표와, 코드 파일 맨 위의 "읽는 순서:" 표시가 서로 맞는지 확인해요.
 *   - 표의 번호가 1부터 빠짐없이 이어지는지
 *   - 파일마다 맨 위에 같은 번호와 앞·다음 파일이 적혀 있는지
 * 파일을 더하거나 옮기면 이 테스트가 알려 줘요. 그때는 문서 표와 파일 맨 위 표시를 함께 고쳐요.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");
const doc = readFileSync(path.join(root, "docs/reading-order.md"), "utf8");

/** 표의 줄 "| 7 | [`src/lib/review-data.ts`](../src/lib/review-data.ts) | 설명 |"에서 번호와 파일을 꺼내요. */
const rows = [...doc.matchAll(/^\| (\d+) \| \[`([^`]+)`\]/gm)].map((match) => ({ order: Number(match[1]), file: match[2]! }));

describe("읽는 순서 안내", () => {
  it("코드 읽는 순서 표의 번호가 1부터 빠짐없이 이어진다", () => {
    expect(rows.length).toBeGreaterThan(80);
    expect(rows.map((row) => row.order)).toEqual(rows.map((_, index) => index + 1));
    expect(new Set(rows.map((row) => row.file)).size).toBe(rows.length);
  });

  it("파일마다 맨 위에 같은 번호와 앞·다음 파일이 적혀 있다", () => {
    for (const [index, { order, file }] of rows.entries()) {
      const text = readFileSync(path.join(root, file), "utf8");
      expect(text, file).toContain(`읽는 순서: ${order}/${rows.length}번째`);
      const previous = rows[index - 1]?.file ?? "없음(여기서 시작해요)";
      const next = rows[index + 1]?.file ?? "없음(마지막 파일이에요)";
      expect(text, file).toContain(`앞: ${previous} → 다음: ${next}`);
    }
  });
});
