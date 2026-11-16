// @vitest-environment node
// ↑ 서버 코드(server-only, GitHub 요청)를 시험해서 브라우저 흉내(jsdom) 대신 Node.js 환경에서 돌려요.

/**
 * @file review-store.ts 테스트
 *
 * 읽기·추가·수정·삭제가 "어떤 파일을 더하고 지우는 커밋"을 만드는지 확인해요.
 * GitHub와 이야기하는 부분(lib/github.ts)은 가짜로 바꿔, 저장소 모습(파일 목록)을 우리가 정해 줘요.
 *
 * vi.mock("모듈", 만드는 함수): 그 모듈을 불러오는 모든 곳에 진짜 대신 가짜를 넣어 줘요.
 * vi.hoisted(...): vi.mock은 파일 맨 위로 끌어올려져 먼저 돌아서, 가짜가 쓸 값도 함께 끌어올려 만들어 둬요.
 *
 * 그 밖의 테스트 도구 문법
 *   - vi.fn(함수)                         : 불렸는지 기록하는 가짜 함수. 괄호 안 함수가 실제로 할 일이에요.
 *   - await expect(약속).rejects.toMatchObject({...}) : Promise가 오류로 끝나고, 그 오류에 적은 항목이 있는지 봐요.
 *   - await expect(약속).resolves.toEqual(값)        : Promise가 성공으로 끝나고, 그 값이 같은지 봐요.
 *   - expect.stringMatching(/정규식/)     : toEqual 안에서 "정규식에 맞는 아무 글자"와 맞아요.
 *   - toBeNull / toBeUndefined            : 값이 null인지 / undefined인지
 *
 * 바뀐 파일 목록(lastChanges)을 읽는 법
 *   { path, sha: "번호" }는 그 내용으로 더하거나 바꾼 파일, { path, sha: null }은 지운 파일이에요.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteReview, isUploadPathFor, loadReviewSource, readSavePayload, ReviewStoreError, saveReview, type SavePayload } from "./review-store";
import { EMPTY_VALUES } from "./review-values";

/**
 * 가짜 저장소: 파일 경로 → 내용 번호(files), 내용 번호 → 글자(texts).
 * vi.hoisted 안에서 만들어야 아래 vi.mock(파일 맨 위로 끌어올려져요) 안에서 쓸 수 있어요.
 */
const repo = vi.hoisted(() => ({ files: new Map<string, string>(), texts: new Map<string, string>() }));

vi.mock("./github", async (importOriginal) => {
  // `typeof import("./github")`: 진짜 github 모듈의 모양(타입)이에요. 받은 모듈의 타입을 알려 주려고 <> 안에 넣어요(제네릭).
  // 진짜 모듈을 먼저 받아, 바꿀 함수만 가짜로 덮어써요(나머지는 그대로 써요).
  const original = await importOriginal<typeof import("./github")>();
  return {
    ...original,
    // 새 blob은 "blob-1", "blob-2"처럼 번호를 붙여 돌려줘요. 올린 글자는 기억해 둬요.
    createBlob: vi.fn(async (content: Uint8Array) => {
      const sha = `blob-${repo.texts.size + 1}`;
      // TextDecoder: 바이트(Uint8Array)를 다시 글자로 바꿔요. 저장한 원고 글자를 나중에 확인하려고요.
      repo.texts.set(sha, new TextDecoder().decode(content));
      return sha;
    }),
    // `A ?? B`: A가 null·undefined면 B를 써요. 없는 번호면 빈 글자예요.
    readTextBlob: vi.fn(async (sha: string) => repo.texts.get(sha) ?? ""),
    // 저장소의 최신 상태: 커밋 번호(c1), 파일 나무 번호(t1), 파일 목록
    getSnapshot: vi.fn(async () => ({ commitSha: "c1", treeSha: "t1", files: repo.files })),
    // 바꿀 파일 목록을 만든 뒤 그대로 돌려받으려고, 결과를 lastChanges에 담아 둬요.
    // 진짜는 GitHub에 커밋하지만, 가짜는 build 함수만 불러 결과를 담아 둬요. 이름 앞의 _는 "쓰지 않는 인자"라는 표시예요.
    commitChanges: vi.fn(async (_message: string, build: (snapshot: unknown) => unknown) => {
      lastChanges = await build({ commitSha: "c1", treeSha: "t1", files: repo.files });
      return "new-commit";
    }),
  };
});

/** 마지막 커밋에 담긴 바뀐 파일 목록. 커밋하지 않았으면 undefined예요. */
let lastChanges: unknown;

/**
 * 저장소에 원고를 하나 넣어 두고, 그 내용 번호를 돌려줘요.
 * @param slug 원고 파일 이름
 * @param fields 원고에 적을 항목들
 * @returns 가짜 내용 번호. 예: "seed-winter-stop"
 */
function seedReview(slug: string, fields: Record<string, unknown>) {
  const sha = `seed-${slug}`;
  repo.files.set(`content/reviews/${slug}.json`, sha);
  repo.texts.set(sha, JSON.stringify(fields));
  return sha;
}

/**
 * 꼭 필요한 칸을 채운 저장 요청을 만들어요.
 * @param values 바꿀 칸만 넘겨요(나머지는 기본값). `Partial`이라 일부 칸만 넘겨도 돼요.
 * @param upload 이번에 올린 이미지(있을 때만 요청에 넣어요)
 */
const payload = (values: Partial<SavePayload["values"]> = {}, upload?: SavePayload["upload"]): SavePayload => ({
  values: {
    ...EMPTY_VALUES,
    slug: "winter-stop",
    title: "겨울 정류장",
    year: "2024",
    creator: "한서윤",
    category: "영화",
    rating: "4.5",
    oneLiner: "기다림은 끝내 도착한다.",
    ...values,
  },
  ...(upload ? { upload } : {}),
});

/** sha 모양(40글자)의 가짜 번호 */
const SHA = "a".repeat(40);

// 시험마다 저장소를 비우고 시작해요. 앞 시험의 파일이 남아 결과를 흐리지 않게요.
beforeEach(() => {
  repo.files = new Map();
  repo.texts = new Map();
  lastChanges = undefined;
});

describe("readSavePayload(저장 요청 모양 확인)", () => {
  it("약속한 모양이면 그대로 받고, 모르는 항목은 뺀다", () => {
    // 요청 여기저기에 모르는 항목(extra)을 섞어 보내요. `as never`는 타입 검사를 피해 일부러 틀린 값을 넣는 표시예요.
    const sent = { ...payload({}, { path: "public/images/winter-stop.jpg", sha: SHA, extra: 1 } as never), baseSha: SHA, extra: "x" };
    const read = readSavePayload({ ...sent, values: { ...sent.values, extra: "x" } });
    expect(read).toEqual({ ...payload({}, { path: "public/images/winter-stop.jpg", sha: SHA }), baseSha: SHA });
    // 새 리뷰처럼 baseSha·upload가 없어도 돼요.
    expect(readSavePayload(payload())).toEqual(payload());
  });

  // [설명, 요청 값] 짝들이에요. 설명은 테스트 이름의 %s에 들어가고, 이름 앞에 _를 붙여 테스트 안에서는 쓰지 않아요.
  it.each([
    ["JSON이 객체가 아님", null],
    ["칸 값이 없음", {}],
    ["글자 칸에 숫자", { ...payload(), values: { ...payload().values, year: 2024 } }],
    ["칸이 빠짐", { ...payload(), values: { ...payload().values, title: undefined } }],
    ["분류가 글자가 아님", { ...payload(), values: { ...payload().values, category: ["영화"] } }],
    ["올린 이미지가 객체가 아님", { ...payload(), upload: "x" }],
    ["올린 이미지의 sha가 글자가 아님", { ...payload(), upload: { path: "p", sha: 1 } }],
    ["baseSha가 글자가 아님", { ...payload(), baseSha: 1 }],
  ])("%s이면 null", (_name, input) => {
    expect(readSavePayload(input)).toBeNull();
  });
});

describe("isUploadPathFor", () => {
  it("이 리뷰의 이미지 경로(<파일 이름>.확장자)만 받는다", () => {
    expect(isUploadPathFor("public/images/winter-stop.jpg", "winter-stop")).toBe(true);
    expect(isUploadPathFor("public/images/winter-stop.webp", "winter-stop")).toBe(true);
    // 다른 리뷰의 파일, 다른 폴더, 받지 않는 확장자는 안 돼요.
    expect(isUploadPathFor("public/images/other.jpg", "winter-stop")).toBe(false);
    expect(isUploadPathFor("public/other/winter-stop.jpg", "winter-stop")).toBe(false);
    expect(isUploadPathFor("public/images/winter-stop.gif", "winter-stop")).toBe(false);
  });
});

describe("loadReviewSource", () => {
  it("저장소의 원고 글자와 내용 번호를 돌려주고, 없거나 이름이 틀리면 null이다", async () => {
    const sha = seedReview("winter-stop", { title: "겨울 정류장" });
    await expect(loadReviewSource("winter-stop")).resolves.toEqual({ source: '{"title":"겨울 정류장"}', sha });
    await expect(loadReviewSource("nothing")).resolves.toBeNull();
    // 폴더를 거슬러 올라가는 이름(../)은 저장소에 묻기 전에 막아요.
    await expect(loadReviewSource("../secret")).resolves.toBeNull();
  });
});

describe("saveReview(추가)", () => {
  it("원고(JSON)와 올린 이미지를 커밋 하나로 더한다", async () => {
    const result = await saveReview("create", "winter-stop", payload({ image: "winter-stop.jpg" }, { path: "public/images/winter-stop.jpg", sha: SHA }));
    expect(result).toEqual({ commitSha: "new-commit", slug: "winter-stop" });
    expect(lastChanges).toEqual([
      { path: "content/reviews/winter-stop.json", sha: "blob-1" },
      { path: "public/images/winter-stop.jpg", sha: SHA },
    ]);
    // 원고에는 지금 날짜와 시각(한국 시간)이 글 쓴 날로 들어가요(같은 날 쓴 글끼리도 최신순이 맞게).
    // `!`: "이 값은 없을 리 없다"고 TypeScript에 알려 줘요(get은 없을 때 undefined를 돌려줄 수 있어서요).
    const saved = JSON.parse(repo.texts.get("blob-1")!);
    expect(saved).toMatchObject({ title: "겨울 정류장", year: 2024, rating: 4.5, image: "winter-stop.jpg" });
    expect(saved.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/);
  });

  it("칸이 틀리면 커밋하지 않고 칸별 문구와 함께 422로 알린다", async () => {
    await expect(saveReview("create", "winter-stop", payload({ title: "" }))).rejects.toMatchObject({
      status: 422,
      errors: { title: "제목을 입력하세요. 예: 겨울 정류장" },
    });
    // 검사에 걸렸으니 커밋은 한 번도 불리지 않아야 해요.
    expect(lastChanges).toBeUndefined();
  });

  it("같은 파일 이름의 리뷰가 이미 있으면 409와 파일 이름 칸 문구로 알린다", async () => {
    seedReview("winter-stop", { title: "먼저 있던 리뷰" });
    // 오류 객체를 값으로 받아(catch) 종류(toBeInstanceOf)와 항목(toMatchObject)을 함께 확인해요.
    const error = await saveReview("create", "winter-stop", payload()).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ReviewStoreError);
    expect(error).toMatchObject({ status: 409, errors: { slug: expect.stringContaining("이미 같은 파일 이름") } });
  });

  it("원고에 적은 이미지가 저장소에도 이번 업로드에도 없으면 이미지 칸에 알린다", async () => {
    const error = await saveReview("create", "winter-stop", payload({ image: "winter-stop.jpg" })).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 422, errors: { image: expect.stringContaining("public/images/winter-stop.jpg") } });
  });

  it("다른 리뷰의 경로로 올린 이미지나 sha 모양이 틀린 이미지는 받지 않는다", async () => {
    await expect(saveReview("create", "winter-stop", payload({}, { path: "public/images/other.jpg", sha: SHA }))).rejects.toMatchObject({ status: 400 });
    await expect(saveReview("create", "winter-stop", payload({}, { path: "public/images/winter-stop.jpg", sha: "x" }))).rejects.toMatchObject({ status: 400 });
  });

  it("올렸지만 원고가 쓰지 않는 이미지(고른 뒤 뺌)는 커밋에 넣지 않는다", async () => {
    await saveReview("create", "winter-stop", payload({ image: "" }, { path: "public/images/winter-stop.jpg", sha: SHA }));
    expect(lastChanges).toEqual([{ path: "content/reviews/winter-stop.json", sha: "blob-1" }]);
  });
});

describe("saveReview(수정)", () => {
  /** 저장소에 있던 원래 원고: 이 리뷰의 이미지(winter-stop.jpg)를 써요. */
  const OLD = { title: "겨울", image: "winter-stop.jpg" };

  it("그사이 다른 곳에서 고쳤으면(처음 sha와 다르면) 덮어쓰지 않는다", async () => {
    seedReview("winter-stop", OLD);
    await expect(saveReview("update", "winter-stop", { ...payload(), baseSha: "different" })).rejects.toMatchObject({ status: 409 });
  });

  it("없는 리뷰를 고치려 하면 404로 알린다", async () => {
    await expect(saveReview("update", "winter-stop", payload())).rejects.toMatchObject({ status: 404 });
  });

  it("처음 불러온 원고 번호(baseSha) 없이 고치려 하면 덮어쓰지 않고 400으로 알린다", async () => {
    seedReview("winter-stop", OLD);
    await expect(saveReview("update", "winter-stop", payload())).rejects.toMatchObject({ status: 400 });
    expect(lastChanges).toBeUndefined();
  });

  it("이미지를 빼면 더 쓰지 않는 이 리뷰의 원래 이미지를 지운다", async () => {
    const sha = seedReview("winter-stop", OLD);
    // 저장소에 원래 이미지 파일도 있다고 정해 둬요(없으면 지울 것도 없어요).
    repo.files.set("public/images/winter-stop.jpg", "p1");

    await saveReview("update", "winter-stop", { ...payload({ image: "" }), baseSha: sha });
    expect(lastChanges).toEqual([
      // 새 원고 blob(가짜 저장소가 붙인 번호라 모양만 확인해요)
      { path: "content/reviews/winter-stop.json", sha: expect.stringMatching(/^blob-/) },
      { path: "public/images/winter-stop.jpg", sha: null },
    ]);
  });

  it("이미지를 다른 형식으로 바꾸면 새 이미지를 더하고 원래 이미지를 지운다", async () => {
    const sha = seedReview("winter-stop", OLD);
    repo.files.set("public/images/winter-stop.jpg", "p1");

    await saveReview("update", "winter-stop", { ...payload({ image: "winter-stop.png" }, { path: "public/images/winter-stop.png", sha: SHA }), baseSha: sha });
    expect(lastChanges).toEqual([
      { path: "content/reviews/winter-stop.json", sha: expect.stringMatching(/^blob-/) },
      { path: "public/images/winter-stop.png", sha: SHA },
      { path: "public/images/winter-stop.jpg", sha: null },
    ]);
  });

});

describe("deleteReview", () => {
  it("원고와 이 리뷰의 이미지를 지운다", async () => {
    seedReview("winter-stop", { title: "겨울 정류장", image: "winter-stop.jpg" });
    repo.files.set("public/images/winter-stop.jpg", "p1");

    expect(await deleteReview("winter-stop")).toEqual({ commitSha: "new-commit", title: "겨울 정류장" });
    expect(lastChanges).toEqual([
      { path: "content/reviews/winter-stop.json", sha: null },
      { path: "public/images/winter-stop.jpg", sha: null },
    ]);
  });

  it("이 리뷰 것이 아닌 이미지(이름이 <파일 이름>.확장자가 아님)는 남긴다", async () => {
    // alpha 리뷰가 이름이 다른 이미지(test-pattern.png)를 쓰면, 원고만 지워요.
    seedReview("alpha", { title: "알파", image: "test-pattern.png" });
    repo.files.set("public/images/test-pattern.png", "p2");
    await deleteReview("alpha");
    expect(lastChanges).toEqual([{ path: "content/reviews/alpha.json", sha: null }]);
  });

  it("원고를 읽지 못해도(망가진 JSON) 파일 이름을 제목 삼아 원고를 지운다", async () => {
    repo.files.set("content/reviews/broken.json", "seed-broken");
    repo.texts.set("seed-broken", "{ 망가진");
    expect(await deleteReview("broken")).toEqual({ commitSha: "new-commit", title: "broken" });
    expect(lastChanges).toEqual([{ path: "content/reviews/broken.json", sha: null }]);
  });

  it("없는 리뷰를 지우려 하면 404로 알린다", async () => {
    await expect(deleteReview("nothing")).rejects.toMatchObject({ status: 404 });
  });
});
