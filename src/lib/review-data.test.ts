// @vitest-environment node
// ↑ 파일을 다루는 테스트라 브라우저 흉내(jsdom) 대신 Node.js 환경에서 돌려요.

/**
 * @file review-data.ts 테스트
 *
 * 원고 읽기가
 *   - JSON 원고를 읽어 최신순으로 돌려주는지(_로 시작하는 파일과 .json이 아닌 파일은 건너뛰는지)
 *   - 고칠 곳(JSON 문법, 값 검사, 파일 이름, 없는 이미지)을 모두 모아 "파일 이름: 고치는 방법"으로 알려 주는지
 *   - 원고 폴더가 없으면 빈 목록인지
 *   - 운영 빌드에서는 한 번 읽은 결과를 다시 쓰는지
 * 확인해요.
 *
 * 임시 폴더를 프로젝트 폴더처럼 쓰려고 process.cwd()(지금 작업 폴더)를 바꿔 넣어요(vi.spyOn).
 * 모듈 안의 캐시를 비우려고 시험마다 모듈을 새로 불러요(vi.resetModules + await import).
 *
 * 테스트 도구 문법
 *   - vi.spyOn(객체, "함수 이름").mockReturnValue(값) : 그 함수를 엿보며, 부르면 정한 값을 돌려주게 바꿔요.
 *   - vi.restoreAllMocks()                             : spyOn으로 바꾼 함수를 모두 원래대로 돌려놔요.
 *   - vi.stubEnv("이름", 값) / vi.unstubAllEnvs()      : 환경 변수(process.env)를 잠깐 바꾸고, 원래대로 돌려놔요.
 *   - vi.resetModules()                                : 불러 둔 모듈을 잊게 해서, 다음 import가 파일을 새로 읽게 해요.
 *   - await import("./파일")                           : 시험 안에서 모듈을 그때 불러요(동적 import). 맨 위 import는 한 번만 읽혀요.
 *   - toMatchObject / toBeInstanceOf(Error)            : 적은 항목만 같은지 / 그 종류(클래스)의 값인지 확인해요.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * 올바른 원고 하나를 JSON 글자로 만들어요. 바꾸고 싶은 항목만 넘기면 나머지는 기본값이에요.
 * `fields = {}`: 인자를 넘기지 않으면 빈 객체를 써요(기본 매개변수). `...fields`가 맨 뒤라 기본값을 덮어써요.
 * JSON.stringify는 객체를 JSON 글자로 바꿔요(파일에 쓰려면 글자여야 해요).
 */
const manuscript = (fields: Record<string, unknown> = {}) =>
  JSON.stringify({
    title: "겨울 정류장",
    year: 2024,
    creator: "한서윤",
    category: "영화",
    rating: 4,
    oneLiner: "기다림은 끝내 도착한다",
    publishedAt: "2026-11-13",
    ...fields,
  });

/** 시험마다 새로 만드는 임시 "프로젝트 폴더" */
let dir: string;
/** 그 안의 원고 폴더(content/reviews) */
let reviews: string;

// beforeEach: 각 시험(it) 앞에 돌아요. afterEach: 각 시험 뒤에 돌아요(정리).
beforeEach(async () => {
  // mkdtemp: 운영체제의 임시 폴더(tmpdir) 안에 겹치지 않는 이름의 새 폴더를 만들어요. 예: /tmp/review-data-a1B2c3
  dir = await mkdtemp(path.join(tmpdir(), "review-data-"));
  reviews = path.join(dir, "content/reviews");
  // recursive: 중간 폴더(content)가 없어도 함께 만들어요.
  await mkdir(reviews, { recursive: true });
  await mkdir(path.join(dir, "public/images"), { recursive: true });
  // reviewsDir()가 process.cwd()를 기준으로 폴더를 찾으므로, 임시 폴더를 돌려주게 바꿔요.
  vi.spyOn(process, "cwd").mockReturnValue(dir);
  // review-data.ts 안의 캐시(cached)가 시험끼리 섞이지 않게 모듈을 잊게 해요.
  vi.resetModules();
});

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  // 만든 임시 폴더를 안의 파일까지 지워요(force: 없어도 오류를 내지 않아요).
  await rm(dir, { recursive: true, force: true });
});

describe("getReviews", () => {
  it("JSON 원고를 읽어 최신순으로 돌려주고, 파일 이름이 slug가 된다", async () => {
    // 이름 순서(newer → older)와 최신순이 같으면 정렬을 확인할 수 없어서, 글 쓴 날로 순서를 정해요.
    await writeFile(path.join(reviews, "older.json"), manuscript({ title: "지난 글", publishedAt: "2026-11-13" }));
    await writeFile(path.join(reviews, "newer.json"), manuscript({ title: "최근 글", publishedAt: "2026-11-14T09:00:00+09:00" }));
    const { getReviews } = await import("./review-data");

    const result = await getReviews();
    expect(result.map((review) => review.slug)).toEqual(["newer", "older"]);
    expect(result[0]).toMatchObject({ slug: "newer", title: "최근 글", creator: "한서윤" });
  });

  it("_로 시작하는 파일(쓰다 만 원고)과 .json이 아닌 파일은 건너뛴다", async () => {
    await writeFile(path.join(reviews, "_draft.json"), "{ 쓰다 만");
    await writeFile(path.join(reviews, "memo.md"), "메모");
    await writeFile(path.join(reviews, "winter-stop.json"), manuscript());
    const { getReviews } = await import("./review-data");

    expect((await getReviews()).map((review) => review.slug)).toEqual(["winter-stop"]);
  });

  // 리뷰를 하나도 쓰지 않은 저장소에는 content/reviews 폴더가 없을 수 있어요. 그래도 빌드가 멈추면 안 돼요.
  it("원고 폴더가 없으면 빈 목록이다", async () => {
    await rm(reviews, { recursive: true });
    const { getReviews } = await import("./review-data");

    // resolves: Promise가 성공으로 끝난 값을 꺼내 이어서 비교해요. await expect(...)로 기다려야 해요.
    await expect(getReviews()).resolves.toEqual([]);
  });

  it("고칠 곳을 파일마다 모두 모아 한 번에 알려 준다", async () => {
    // 네 가지 서로 다른 문제: JSON 문법(마지막 쉼표), 값 검사(평점), 파일 이름(대문자·빈칸), 없는 이미지
    await writeFile(path.join(reviews, "broken.json"), '{ "title": "겨울", }');
    await writeFile(path.join(reviews, "bad-rating.json"), manuscript({ rating: 4.3 }));
    await writeFile(path.join(reviews, "Bad Name.json"), manuscript());
    await writeFile(path.join(reviews, "no-image.json"), manuscript({ image: "missing.jpg" }));
    const { getReviews } = await import("./review-data");

    // 실패로 끝나는 Promise에 .catch를 붙여, 던진 오류를 값으로 받아 내용을 하나하나 확인해요.
    const error = await getReviews().catch((caught: Error) => caught);
    expect(error).toBeInstanceOf(Error);
    // `as Error`: TypeScript에 "이 값은 Error"라고 알려 줘요(바로 위에서 확인했어요).
    const { message } = error as Error;
    expect(message).toContain("리뷰 원고에 고칠 곳이 4개 있습니다.");
    expect(message).toContain("broken.json: JSON 모양이 아닙니다.");
    expect(message).toContain('bad-rating.json: "rating"(평점)');
    expect(message).toContain("Bad Name.json: 파일 이름은 영어 소문자");
    expect(message).toContain("no-image.json: 이미지 파일 public/images/missing.jpg이(가) 없습니다.");
  });

  it("이미지 파일이 public/images에 있으면 통과한다", async () => {
    await writeFile(path.join(dir, "public/images/winter-stop.jpg"), "그림");
    await writeFile(path.join(reviews, "winter-stop.json"), manuscript({ image: "winter-stop.jpg" }));
    const { getReviews } = await import("./review-data");

    // `?.`(옵셔널 체이닝): 앞의 값이 없으면(undefined) 오류 대신 undefined를 돌려줘요.
    expect((await getReviews())[0]?.image).toBe("winter-stop.jpg");
  });

  it("REVIEWS_DIR로 다른 원고 폴더(E2E 시험 원고)를 읽을 수 있다", async () => {
    await mkdir(path.join(dir, "fixtures"));
    await writeFile(path.join(dir, "fixtures", "fixture.json"), manuscript());
    vi.stubEnv("REVIEWS_DIR", "fixtures");
    const { getReviews } = await import("./review-data");

    expect((await getReviews()).map((review) => review.slug)).toEqual(["fixture"]);
  });

  it("운영 빌드에서는 처음 읽은 결과를 다시 쓴다(빌드 중에 여러 번 불려도 파일은 한 번만 읽어요)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await writeFile(path.join(reviews, "first.json"), manuscript());
    const { getReviews } = await import("./review-data");

    const first = await getReviews();
    // 첫 읽기 뒤에 원고를 하나 더 써도, 다시 읽지 않으니 결과에 나오지 않아야 해요.
    await writeFile(path.join(reviews, "second.json"), manuscript());
    // toBe: 같은 배열(같은 물건)인지 확인해요. 다시 읽었다면 새 배열이라 실패해요.
    expect(await getReviews()).toBe(first);
  });
});
