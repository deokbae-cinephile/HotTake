/**
 * @file 변경 기록 검사 (changelog.test.ts)
 *
 * package.json의 버전과 CHANGELOG.md의 항목이 서로 맞는지 확인해요.
 *   - 버전이 유의적 버전 모양(주.부.수, 예: 1.0.1)인지
 *   - 변경 기록의 맨 위 항목("## 1.0.1 — 2026-11-16")이 지금 버전인지
 *   - 항목이 새 버전부터 차례로(겹치지 않고) 적혀 있고, 항목마다 내용이 있는지
 *
 * 왜 검사하나요?
 *   main에 배포가 끝나면 CI(.github/workflows/ci.yml의 release)가 이 버전의 태그와 GitHub 릴리스를 만들고,
 *   릴리스 내용으로 변경 기록의 그 항목을 그대로 써요. 버전만 올리고 변경 기록을 빠뜨리면 릴리스를 만들 수 없어서,
 *   PR 검사(단위 테스트)에서 먼저 알려 줘요. 버전 규칙은 docs/development.md 5장 "버전과 릴리스"에 있어요.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 저장소 맨 위 폴더. __dirname은 이 파일이 있는 폴더(src/test)라서 두 단계 위로 올라가요.
const root = path.resolve(__dirname, "../..");
// package.json의 버전 글자(예: "1.0.1"). JSON.parse로 글자를 객체로 바꿔 version 항목만 꺼내요.
const { version } = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };
const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");

/**
 * 유의적 버전 모양: 주.부.수 세 숫자. 0이 아닌 수는 0으로 시작하지 않아요(01은 안 돼요).
 * (\d+는 숫자 하나 이상, 0|[1-9]\d*는 "0 하나, 또는 1~9로 시작하는 숫자"라는 뜻이에요.)
 */
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * 변경 기록의 버전 제목 줄 "## 1.0.1 — 2026-11-16"에서 버전과 날짜를 꺼내요.
 * matchAll + 플래그 gm: 글 전체에서(g) 줄마다(m, ^·$가 줄의 처음·끝) 맞는 것을 모두 찾아요.
 */
const entries = [...changelog.matchAll(/^## (\S+) — (\d{4}-\d{2}-\d{2})$/gm)].map((match) => ({ version: match[1]!, date: match[2]! }));

/** "1.0.1" → [1, 0, 1]. 버전끼리 크기를 견줄 때 써요. */
const parts = (value: string) => value.split(".").map(Number);

/** a가 b보다 새 버전(큰 버전)이면 true. 주 → 부 → 수 차례로 견줘요. */
function isNewer(a: string, b: string) {
  const [x, y] = [parts(a), parts(b)];
  for (let index = 0; index < 3; index += 1) {
    if (x[index] !== y[index]) return x[index]! > y[index]!;
  }
  return false;
}

describe("변경 기록과 버전", () => {
  it("package.json의 버전은 유의적 버전 모양(주.부.수)이다", () => {
    expect(version).toMatch(SEMVER);
  });

  it("변경 기록의 맨 위 항목이 지금 버전이다(버전을 올리면 변경 기록도 함께 적는다)", () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]!.version, "CHANGELOG.md 맨 위에 '## 버전 — 날짜' 항목을 적어 주세요").toBe(version);
  });

  it("항목은 모두 유의적 버전이고, 새 버전부터 겹치지 않게 차례로 적혀 있다", () => {
    for (const entry of entries) expect(entry.version).toMatch(SEMVER);
    // 바로 앞(위) 항목이 늘 더 새 버전이어야 해요.
    for (let index = 1; index < entries.length; index += 1) {
      expect(isNewer(entries[index - 1]!.version, entries[index]!.version), `${entries[index - 1]!.version} → ${entries[index]!.version}`).toBe(true);
    }
  });

  it("항목마다 릴리스에 쓸 내용이 있다", () => {
    // split: 버전 제목 줄을 기준으로 글을 나눠요. [0]은 맨 위 소개 글이라 빼고(slice(1)), 나머지가 항목 내용이에요.
    const bodies = changelog.split(/^## .+$/m).slice(1);
    expect(bodies).toHaveLength(entries.length);
    for (const [index, body] of bodies.entries()) expect(body.trim(), entries[index]!.version).not.toBe("");
  });
});
