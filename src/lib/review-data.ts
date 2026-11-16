/**
 * @file 리뷰 원고 읽기 (review-data.ts)
 * 읽는 순서: 6/84번째 · 2단계(원고가 리뷰 데이터가 되기까지)
 *   앞: src/lib/format.ts → 다음: src/app/globals.css (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   content/reviews 폴더의 리뷰 원고(<파일 이름>.json)를 모두 읽고, 검사해서, 화면이 쓰는 리뷰 목록(최신순)으로 돌려줘요.
 *
 *     content/reviews/winter-stop.json ─┐
 *     content/reviews/phone-booth.json ─┼─ getReviews() ─> [검사] ─> Review[](최신순) ─> 처음 화면(app/page.tsx)
 *     content/reviews/...              ─┘
 *
 * 언제 돌아가나요?
 *   - 빌드할 때(pnpm build): 처음 화면은 빌드할 때 HTML로 미리 만들어 두는 "정적 페이지"라, 이 함수도 그때 한 번 돌아요.
 *     원고에 고칠 곳이 있으면 오류를 던져 빌드를 멈춰요. 그래서 잘못된 원고는 배포되지 않아요.
 *   - 개발 서버(pnpm dev): 새로 고칠 때마다 다시 읽어서, 원고를 고치면 바로 보여요.
 *   실제 방문자가 들어올 때(Cloudflare 워커)는 미리 만든 HTML만 주므로 이 파일은 돌지 않아요.
 *
 * 왜 서버에서만 쓰나요?
 *   파일을 읽는 node:fs는 Node.js에만 있고 브라우저에는 없어요. 맨 위의 `import "server-only"`가
 *   이 파일을 브라우저용 코드("use client" 쪽)에서 가져오는 실수를 빌드 오류로 막아 줘요.
 *
 * 누가 쓰나요?
 *   - app/page.tsx(처음 화면): getReviews()로 모든 리뷰를 읽어 목록에 넘겨요.
 *   - app/sitemap.ts(검색엔진용 사이트 지도): getReviews()로 마지막으로 글 쓴 날을 알아내요.
 *   - lib/content.test.ts: loadReviews()로 실제 원고와 시험 원고가 형식에 맞는지 확인해요.
 *
 * 알아 두면 좋은 말
 *   - Promise: "나중에 끝나는 일"의 결과를 담는 상자예요. 파일 읽기처럼 시간이 걸리는 일이 돌려줘요.
 *   - async/await: async 함수 안에서 `await 약속`이라고 쓰면 그 일이 끝날 때까지 기다렸다가 결과를 꺼내요.
 */

// 값을 하나도 가져오지 않는 import예요. 이 줄만으로 "서버 전용 파일"이라는 표시가 돼요.
import "server-only";

// node:fs/promises: Node.js가 주는 "파일 다루기" 도구예요. promises 판이라 await로 기다릴 수 있어요.
import { access, readdir, readFile } from "node:fs/promises";
// node:path: 폴더·파일 경로를 운영체제에 맞게 이어 붙여 주는 도구예요(윈도우는 \, 맥·리눅스는 /).
import path from "node:path";

import { compareLatest, type Review } from "./review";
import { checkReview, SLUG } from "./review-schema";

/**
 * 원고 폴더(프로젝트 맨 위 기준)예요.
 * E2E 테스트는 진짜 원고 대신 시험용 원고를 쓰려고 환경 변수 REVIEWS_DIR로 다른 폴더를 알려 줘요(package.json의 e2e:build).
 * `A || B`: A가 비어 있으면(undefined나 빈 글자) B를 써요.
 *
 * @returns 원고 폴더의 전체 경로. 예: /Users/.../HotTake/content/reviews
 */
export function reviewsDir(): string {
  // process.cwd(): 지금 작업 폴더(pnpm build를 돌린 프로젝트 맨 위). path.resolve가 뒤 경로와 이어 전체 경로를 만들어요.
  // turbopackIgnore: 빌드 도구가 이 경로를 따라가 폴더 전체를 서버 묶음에 넣지 않게 하는 표시예요(빌드할 때만 읽으니까요).
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.REVIEWS_DIR || "content/reviews");
}

/** 이미지 파일이 있는 폴더(public/images). 원고의 "image"에 적은 파일이 정말 있는지 여기서 확인해요. */
function imagesDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), "public/images");
}

/**
 * 한 번 읽은 결과를 담아 두는 곳(캐시). 운영 빌드에서 여러 번 불려도 파일은 한 번만 읽어요.
 * 결과(Review[])가 아니라 Promise를 담아서, 처음 읽기가 끝나기 전에 또 불려도 같은 읽기를 함께 기다려요.
 * `let`은 나중에 값을 바꿀 수 있는 변수예요(const는 바꿀 수 없어요). 처음에는 undefined예요.
 */
let cached: Promise<Review[]> | undefined;

/**
 * 모든 리뷰를 최신순으로 돌려줘요.
 *
 * 운영 빌드(production)에서는 처음 읽은 결과를 담아 두고 다시 써요.
 * 개발 서버에서는 원고를 고치면 바로 보이게 부를 때마다 새로 읽어요.
 * (process.env.NODE_ENV는 Next.js가 빌드할 때 "production" 또는 "development"를 넣어 줘요.)
 *
 * @returns 검사를 통과한 리뷰 목록(최신순)을 담은 Promise. 원고에 고칠 곳이 있으면 오류로 끝나요.
 * @example const reviews = await getReviews(); // [{ slug: "phone-booth", title: "폰 부스", ... }, ...]
 */
export function getReviews(): Promise<Review[]> {
  if (process.env.NODE_ENV !== "production") return loadReviews(reviewsDir());
  // `A ??= B`: A가 비어 있을(undefined·null) 때만 B를 넣어요. 두 번째부터는 담아 둔 결과를 그대로 돌려줘요.
  cached ??= loadReviews(reviewsDir());
  return cached;
}

/**
 * 폴더의 원고를 모두 읽고 검사해요. 고칠 곳이 하나라도 있으면 모두 모아 오류 하나로 던져요.
 *
 * @param dir 원고 폴더의 전체 경로
 * @returns 검사를 통과한 리뷰 목록(최신순)
 * @throws 고칠 곳이 있으면 "파일 이름: 고치는 방법"을 줄마다 적은 Error
 */
export async function loadReviews(dir: string): Promise<Review[]> {
  // 폴더 안의 이름 목록. 폴더가 없으면(리뷰를 하나도 쓰지 않은 저장소) 빈 목록으로 봐요.
  // `.catch(() => [])`: 오류가 나면 대신 빈 배열을 돌려줘요.
  // `[] as string[]`: 빈 배열의 타입을 "글자 배열"이라고 알려 줘요(그냥 []는 타입을 알 수 없어서요).
  const names = await readdir(dir).catch(() => [] as string[]);
  // .json으로 끝나고 _로 시작하지 않는 파일만 원고예요(_draft.json처럼 쓰다 만 원고는 건너뛰어요).
  // 끝의 .sort(): 이름 순서로 늘어놓아요. 오류 문구가 언제나 같은 순서로 나와서 읽기 쉬워요.
  const files = names.filter((name) => name.endsWith(".json") && !name.startsWith("_")).sort();

  const reviews: Review[] = [];
  // 고칠 곳 목록. 첫 문제에서 멈추지 않고 모두 모아서 한 번에 보여 줘요.
  const problems: string[] = [];

  // for...of: 배열의 항목을 하나씩 꺼내 되풀이해요.
  for (const file of files) {
    // 파일 이름에서 .json을 뗀 부분이 리뷰의 파일 이름(slug)이에요. "winter-stop.json".slice(0, -5) → "winter-stop"
    const slug = file.slice(0, -".json".length);
    if (!SLUG.test(slug)) {
      problems.push(`${file}: 파일 이름은 영어 소문자, 숫자, 하이픈(-)만 씁니다. 예: winter-stop.json`);
      continue; // 이 파일은 더 보지 않고 다음 파일로 넘어가요.
    }

    // 파일 글자를 읽어 JSON으로 풀어요. JSON 문법이 틀리면 JSON.parse가 오류를 던져서 try...catch로 잡아요.
    // try 안에서 값을 넣고 밖에서 쓰려고, 변수를 try 앞에 미리 만들어 둬요.
    let data: unknown;
    try {
      // readFile(경로, "utf8"): 파일을 글자로 읽어요("utf8"을 빼면 바이트 묶음이 와요).
      data = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    } catch {
      // `catch {`처럼 괄호를 빼면 오류 값은 쓰지 않겠다는 뜻이에요. 어떤 오류든 같은 안내를 보여 줘요.
      problems.push(`${file}: JSON 모양이 아닙니다. 항목 이름과 글자 값을 큰따옴표(")로 감쌌는지, 항목 사이에 쉼표가 있는지, 마지막 항목 뒤에 쉼표가 없는지 확인하세요.`);
      continue;
    }

    // 값 검사(lib/review-schema.ts). 실패하면 문제마다 "파일 이름: 문구" 한 줄씩 더해요.
    const checked = checkReview(data);
    if (!checked.ok) {
      // `push(...배열)`: 배열의 값들을 펼쳐 한꺼번에 넣어요(전개 문법).
      problems.push(...checked.issues.map((issue) => `${file}: ${issue.message}`));
      continue;
    }

    // 이미지를 적었다면 public/images에 그 파일이 정말 있는지 확인해요(access는 없으면 오류를 던져요).
    // `const { image } = 객체`: 객체에서 image 항목만 꺼내 같은 이름의 변수에 담아요(객체 구조 분해).
    const { image } = checked.value;
    if (image && !(await exists(path.join(imagesDir(), image)))) {
      problems.push(`${file}: 이미지 파일 public/images/${image}이(가) 없습니다. 파일을 넣거나 "image" 줄을 지우세요.`);
      continue;
    }

    // 검사를 통과한 값에 파일 이름(slug)을 더해 목록에 넣어요. `{ slug, ...값 }`: slug와 값의 모든 항목을 합친 새 객체예요.
    reviews.push({ slug, ...checked.value });
  }

  if (problems.length > 0) {
    // join("\n- "): 문제들을 "줄바꿈 + - "로 이어 목록처럼 보여 줘요.
    throw new Error(`리뷰 원고에 고칠 곳이 ${problems.length}개 있습니다.\n- ${problems.join("\n- ")}`);
  }

  // 최신순으로 늘어놓아요(lib/review.ts의 compareLatest). sort는 배열 자체를 바꾸고, 그 배열을 돌려줘요.
  return reviews.sort(compareLatest);
}

/**
 * 파일이 있으면 true. access는 파일이 없으면 오류를 던지므로, 오류가 나면 false로 바꿔요.
 * `.then(성공할 때, 실패할 때)`: Promise가 끝난 결과에 따라 두 함수 가운데 하나를 불러요.
 *
 * @param file 확인할 파일의 전체 경로
 * @returns 있으면 true, 없으면 false를 담은 Promise
 */
async function exists(file: string): Promise<boolean> {
  return access(file).then(
    () => true,
    () => false,
  );
}
