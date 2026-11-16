/**
 * @file 리뷰 읽기·추가·수정·삭제 (review-store.ts)
 * 읽는 순서: 54/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/lib/github.ts → 다음: src/lib/api-response.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓴이가 글쓰기 화면에서 저장·삭제하면, 그 내용을 GitHub 저장소에 "커밋"으로 올려요.
 *   저장소에 커밋이 올라오면 GitHub Actions가 블로그를 다시 빌드해 배포해요(몇 분 걸려요).
 *
 *     읽기(loadReviewSource) : 수정 화면에 보여 줄 원고를 저장소에서 읽어요.
 *     추가(create)           : content/reviews/<파일 이름>.json + 이미지를 커밋 하나로 더해요.
 *     수정(update)           : 원고를 바꾸고, 더 쓰지 않는 이 리뷰의 원래 이미지는 지워요(저장소를 가볍게).
 *     삭제(deleteReview)     : 원고와 이 리뷰의 이미지를 지워요.
 *     (지우는 이미지는 이름이 <파일 이름>.확장자인 "이 리뷰 것"뿐이에요. isOwnImage 참고)
 *
 * 저장 전에 하는 검사
 *   1. 칸 검사: 글쓰기 화면과 같은 규칙(lib/review-form.ts)
 *   2. 파일 이름 겹침: 새 리뷰의 파일 이름이 이미 있으면 막아요.
 *   3. 고치는 사이 바뀜: 수정 화면을 연 뒤 다른 곳(다른 탭 등)에서 먼저 고쳤으면 덮어쓰지 않고 알려요.
 *      수정 요청에는 처음 불러온 원고의 번호(baseSha)가 꼭 있어야 해요.
 *   4. 이미지 확인: 원고에 적은 이미지가 저장소에 있거나 이번에 올린 파일인지(빌드할 때 원고 검사와 같은 확인)
 *   이 검사를 모두 통과해야 커밋해요. 그래서 저장한 리뷰 때문에 빌드가 실패하는 일이 없어요.
 *
 * 누가 쓰나요?
 *   app/api/reviews/route.ts(추가), app/api/reviews/[slug]/route.ts(수정·삭제), app/write/[slug]/page.tsx(고칠 원고 읽기),
 *   lib/api-response.ts(ReviewStoreError를 HTTP 응답으로 바꾸기)
 *
 * 알아 두면 좋은 Git 낱말
 *   - 커밋(commit): 저장소에 남기는 "바뀐 내용 한 묶음"이에요. 파일 여러 개를 한 커밋으로 함께 바꿀 수 있어요.
 *   - blob: 저장소에 올린 파일 내용 하나. 내용마다 sha라는 40글자 번호가 붙어요(내용이 같으면 번호도 같아요).
 *   - sha: 내용이나 커밋을 가리키는 번호. 원고의 sha가 달라졌다면 내용이 바뀌었다는 뜻이에요.
 */

// 이 파일은 비밀 값(GitHub 토큰)을 쓰는 서버 전용 코드예요. 브라우저 코드에서 가져오면 빌드가 오류를 내요.
import "server-only";

import { commitChanges, createBlob, type FileChange, getSnapshot, readTextBlob } from "./github";
import { parseReviewFile, serializeReviewFile } from "./review-file";
import { type FieldErrors, validateReviewForm } from "./review-form";
import { SLUG } from "./review-schema";
import { EMPTY_VALUES, type ReviewFormValues } from "./review-values";

/**
 * 저장하지 못한 이유를 담는 오류예요.
 *
 * `class A extends Error`: 자바스크립트의 기본 오류(Error)를 바탕으로 항목을 더한 새 오류 종류를 만들어요.
 * API(lib/api-response.ts)가 이 오류를 받으면 status를 HTTP 상태 번호로, errors를 칸별 오류로 화면에 돌려줘요.
 *   - status: 400(요청 모양이 틀림), 404(없음), 409(겹침·충돌), 422(칸 값이 틀림) 등
 *   - errors: 칸 이름 → 오류 문구(있을 때만)
 */
export class ReviewStoreError extends Error {
  // constructor 매개변수 앞의 `readonly`: 받은 값을 같은 이름의 읽기 전용 항목으로 바로 저장하는 줄임 문법이에요.
  constructor(
    readonly status: number,
    message: string,
    readonly errors?: FieldErrors,
  ) {
    // super(message): 바탕이 되는 Error에 문구를 넘겨요(error.message로 읽을 수 있어요).
    super(message);
    // 오류를 콘솔에 찍을 때 보이는 이름이에요.
    this.name = "ReviewStoreError";
  }
}

/**
 * 이미지 올리기 API(app/api/images)가 돌려준 "올린 파일": 저장소 안 경로와 내용 번호(sha)
 * @example { path: "public/images/winter-stop.jpg", sha: "3b18e512dba79e4c8300dd08aeb37f8e728b8dad" }
 */
export type Upload = { path: string; sha: string };

/**
 * 저장 API가 받는 내용(화면이 보낸 JSON)이에요.
 * 칸 값은 모두 글자이고, 분류도 아무 글자로 받아요. 알맞은 값인지는 validateReviewForm이 따로 검사해요.
 * (`Omit<A, "category"> & { category: string }`: A에서 category만 빼고 글자 타입으로 다시 넣은 모양이에요.)
 */
export type SavePayload = {
  values: Omit<ReviewFormValues, "category"> & { category: string };
  /** 이번에 새로 올린 이미지(없으면 빠져요) */
  upload?: Upload;
  /** 수정 화면이 처음 불러온 원고의 sha. 그사이 바뀌었는지 확인하는 데 써요(새 리뷰면 없어요). */
  baseSha?: string;
};

/**
 * 저장 API가 받는 칸 이름들. 모두 글자여야 해요.
 *   - `as const`: 배열을 바뀌지 않는 정확한 글자들("slug" | "title" | ...)로 잡아요.
 *   - `satisfies 타입`: 값이 그 타입에 맞는지 TypeScript가 확인만 하고, 값의 타입은 그대로 둬요.
 *     여기서는 "모든 글자가 정말 칸 이름인지"를 확인해요(오타를 적으면 빨간 줄이 생겨요).
 */
const TEXT_FIELDS = [
  "slug",
  "title",
  "year",
  "creator",
  "category",
  "rating",
  "oneLiner",
  "image",
  "publishedAt",
] as const satisfies readonly (keyof ReviewFormValues)[];

/**
 * 값이 { 이름: 값 } 모양의 객체인지 확인해요(null과 배열은 빼요).
 * `value is Record<string, unknown>`(타입 가드): true가 나오면 TypeScript가 value를 객체로 보고 항목을 꺼내게 해 줘요.
 */
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * 저장 API가 받은 JSON이 약속한 모양(SavePayload)인지 확인하고, 맞으면 그 값을 돌려줘요. 아니면 null.
 * 화면을 거치지 않은 요청(직접 만든 요청 등)이 들어와도 서버가 엉뚱한 값으로 일하지 않게 하는 첫 관문이에요.
 *
 * @param input request.json()으로 읽은 값(무엇이든 올 수 있어요)
 * @returns 모양이 맞으면 SavePayload, 아니면 null(API가 400으로 돌려보내요)
 */
export function readSavePayload(input: unknown): SavePayload | null {
  if (!isRecord(input) || !isRecord(input.values)) return null;
  const raw = input.values;

  // 칸 이름마다 글자인지 확인하며 옮겨 담아요. 하나라도 글자가 아니면 모양이 틀린 요청이에요.
  // `Partial<T>`: T의 모든 항목을 "없어도 됨"으로 바꾼 타입. 하나씩 채우는 동안 쓰기 좋아요.
  // `SavePayload["values"]`: SavePayload 타입의 values 항목 타입만 꺼내 써요(인덱스 접근 타입).
  const values: Partial<SavePayload["values"]> = {};
  for (const field of TEXT_FIELDS) {
    const value = raw[field];
    if (typeof value !== "string") return null;
    values[field] = value;
  }

  // 이미지를 새로 올렸다면 { path, sha } 모양이어야 해요.
  let upload: Upload | undefined;
  if (input.upload !== undefined) {
    if (!isRecord(input.upload) || typeof input.upload.path !== "string" || typeof input.upload.sha !== "string") return null;
    upload = { path: input.upload.path, sha: input.upload.sha };
  }

  // baseSha는 없어도 되지만(새 리뷰), 있다면 글자여야 해요.
  if (input.baseSha !== undefined && typeof input.baseSha !== "string") return null;
  // 선택 항목(upload, baseSha)은 있을 때만 펼쳐 넣어요. `...(조건 ? { 항목 } : {})`는 조건부로 항목을 더하는 관용 표현이에요.
  return {
    // 위 반복문이 모든 칸을 채웠으니 "다 채워진 값"이라고 알려 줘요(as).
    values: values as SavePayload["values"],
    ...(upload ? { upload } : {}),
    ...(typeof input.baseSha === "string" ? { baseSha: input.baseSha } : {}),
  };
}

/** Git이 파일 내용마다 붙이는 번호(sha)의 모양: 0~9, a~f로 된 40글자. `{40}`은 "앞의 글자가 정확히 40번"이에요. */
const SHA = /^[0-9a-f]{40}$/;

/**
 * 원고 파일의 저장소 경로를 만들어요.
 * @param slug 리뷰 파일 이름(확장자 제외)
 * @returns 저장소 안 경로
 * @example reviewPath("winter-stop") // "content/reviews/winter-stop.json"
 */
export const reviewPath = (slug: string) => `content/reviews/${slug}.json`;

/**
 * 이미지 파일의 저장소 경로를 만들어요.
 * @param file 원고의 image 값(파일 이름)
 * @returns 저장소 안 경로
 * @example imagePath("winter-stop.jpg") // "public/images/winter-stop.jpg"
 */
const imagePath = (file: string) => `public/images/${file}`;

/**
 * 이미지가 "이 리뷰 것"인지 확인해요. 글쓰기 화면은 이미지 이름을 <파일 이름>.확장자로 지어요(예: winter-stop.jpg).
 * 원고를 손으로 고쳐 다른 리뷰의 이미지를 가리킬 수도 있어서, 지울 때는 이 리뷰 것만 지워요.
 *
 * new RegExp(글자): 글자로 정규식을 만들어요. slug 값을 끼워 넣어야 해서 /.../ 대신 이렇게 써요.
 * 글자 안에서는 \가 특별한 뜻이라, 정규식의 \.(점 글자 그대로)을 쓰려고 \\.로 두 번 적어요.
 * (slug는 SLUG 규칙상 영어 소문자·숫자·하이픈뿐이라 정규식 특수 글자가 끼어들 걱정이 없어요.)
 *
 * @param file 이미지 파일 이름. 예: "winter-stop.jpg"
 * @param slug 리뷰 파일 이름. 예: "winter-stop"
 * @returns 이 리뷰의 이미지 이름이면 true
 * @example isOwnImage("winter-stop.jpg", "winter-stop") // true
 * @example isOwnImage("phone-booth.jpg", "winter-stop") // false
 */
function isOwnImage(file: string, slug: string): boolean {
  return new RegExp(`^${slug}\\.(?:jpe?g|png|webp|avif)$`).test(file);
}

/**
 * 이미지 업로드 경로가 이 리뷰 것인지 확인해요. 다른 리뷰의 이미지를 덮어쓰지 못하게 막아요.
 * 저장(saveReview)이 "이번에 올린 이미지"의 경로를 확인할 때 써요.
 *
 * @param path 저장소 안 경로. 예: "public/images/winter-stop.jpg"
 * @param slug 리뷰 파일 이름
 * @returns 이 리뷰의 이미지 경로면 true
 * @example isUploadPathFor("public/images/winter-stop.jpg", "winter-stop") // true
 */
export function isUploadPathFor(path: string, slug: string): boolean {
  return SLUG.test(slug) && path.startsWith("public/images/") && isOwnImage(path.slice("public/images/".length), slug);
}

/**
 * 수정 화면에 보여 줄 원고를 저장소에서 읽어요.
 *
 * @param slug 리뷰 파일 이름
 * @returns 원고 글자(source)와 그 내용 번호(sha, 저장할 때 그사이 바뀌었는지 비교해요). 없는 리뷰면 null
 */
export async function loadReviewSource(slug: string): Promise<{ source: string; sha: string } | null> {
  // 파일 이름 모양이 틀리면 저장소에 물어볼 것도 없이 "없음"이에요(../ 같은 이상한 경로도 여기서 걸러져요).
  if (!SLUG.test(slug)) return null;
  // 저장소의 최신 파일 목록(경로 → sha)을 받아 원고가 있는지 봐요.
  const snapshot = await getSnapshot();
  const sha = snapshot.files.get(reviewPath(slug));
  if (!sha) return null;
  // sha로 파일 내용을 글자로 읽어 함께 돌려줘요. `{ ..., sha }`는 `sha: sha`를 줄인 모양이에요.
  return { source: await readTextBlob(sha), sha };
}

/**
 * 리뷰를 추가하거나 수정해요.
 *
 * 처리 순서: 칸 검사 → 올린 이미지 확인 → 원고 내용 올리기 → (커밋 안에서) 겹침·바뀜·이미지 확인 → 커밋
 *
 * @param mode "create"(추가) 또는 "update"(수정). `"create" | "update"`는 이 두 글자만 받는 타입이에요.
 * @param slug 리뷰 파일 이름
 * @param payload 화면이 보낸 칸 값과 올린 이미지
 * @returns 만든 커밋의 번호와 파일 이름
 * @throws ReviewStoreError 검사에 걸리거나 그사이 바뀌었으면
 */
export async function saveReview(mode: "create" | "update", slug: string, payload: SavePayload): Promise<{ commitSha: string; slug: string }> {
  // 화면이 보낸 칸 값을 칸 값 타입에 맞춰요. 분류는 아래 검사에서 걸러지니 여기서는 글자 그대로 넘겨요.
  // 객체 펼치기는 뒤에 쓴 것이 이겨요: 빈 칸 값 → 보낸 값 → 주소의 slug 순서로 덮어써요.
  // (slug는 요청 주소에서 온 값을 믿어요. 본문에 다른 slug를 적어 다른 리뷰를 바꾸지 못하게요.)
  const values: ReviewFormValues = { ...EMPTY_VALUES, ...payload.values, slug, category: payload.values.category as ReviewFormValues["category"] };

  // 1) 칸 검사(새 리뷰면 파일 이름도). 틀린 칸이 있으면 칸별 문구와 함께 돌려보내요(422).
  const check = validateReviewForm(values, { checkSlug: true });
  if (!check.ok) throw new ReviewStoreError(422, "고칠 곳이 있습니다. 표시한 칸을 확인해 주세요.", check.errors);
  // 검사를 통과해 정리된 원고 값. check.ok가 true인 것을 위에서 확인해서 fields를 꺼낼 수 있어요.
  const { fields } = check;

  // 2) 올린 이미지 확인: 이 리뷰의 경로이고, sha 모양이 맞아야 해요.
  const { upload } = payload;
  if (upload && (!isUploadPathFor(upload.path, slug) || !SHA.test(upload.sha))) {
    throw new ReviewStoreError(400, "올린 이미지의 저장 위치가 올바르지 않습니다. 화면을 새로 고친 뒤 이미지를 다시 골라 주세요.");
  }

  // 3) 원고 글자를 만들어 저장소에 미리 올려 둬요(blob). 커밋을 다시 시도할 때도 같은 내용이라 한 번만 올려요.
  // TextEncoder: 글자를 UTF-8 바이트(Uint8Array)로 바꿔요. 저장소에는 바이트로 올려요.
  const manuscriptSha = await createBlob(new TextEncoder().encode(serializeReviewFile(fields)));
  // 이 원고가 쓰는 이미지의 저장소 경로(없으면 undefined)
  const usedImage = fields.image ? imagePath(fields.image) : undefined;

  // 커밋 메시지. 저장소의 기록(GitHub의 커밋 목록)에 이 글자로 남아요.
  const message = mode === "create" ? `리뷰 추가: ${fields.title}` : `리뷰 수정: ${fields.title}`;
  // commitChanges는 저장소의 최신 상태(snapshot)를 받아 "바꿀 파일 목록"을 만드는 함수를 불러 커밋해요(lib/github.ts).
  // 그사이 다른 커밋이 끼어들면 최신 상태로 이 함수를 다시 불러요. 그래서 검사도 이 안에서 해요.
  const commitSha = await commitChanges(message, async (snapshot) => {
    // 저장소에 지금 있는 이 원고의 sha. 없으면 undefined예요(새 리뷰).
    const currentSha = snapshot.files.get(reviewPath(slug));

    // 4) 파일 이름 겹침과 그사이 바뀜 확인
    if (mode === "create" && currentSha) {
      throw new ReviewStoreError(409, "같은 파일 이름의 리뷰가 이미 있습니다.", { slug: "이미 같은 파일 이름의 리뷰가 있습니다. 다른 이름을 적어 주세요. 예: winter-stop-2" });
    }
    if (mode === "update" && !currentSha) {
      throw new ReviewStoreError(404, "수정하려는 리뷰가 저장소에 없습니다. 다른 곳에서 삭제했을 수 있습니다. 목록에서 다시 확인해 주세요.");
    }
    if (mode === "update" && !payload.baseSha) {
      throw new ReviewStoreError(400, "처음 불러온 원고 정보가 없어 저장하지 않았습니다. 화면을 새로 고친 뒤 다시 수정해 주세요.");
    }
    if (mode === "update" && currentSha !== payload.baseSha) {
      throw new ReviewStoreError(409, "이 리뷰를 다른 곳에서 먼저 수정했습니다. 내용을 따로 복사해 둔 뒤 화면을 새로 고쳐 최신 원고에서 다시 수정해 주세요.");
    }

    // 5) 이미지 확인: 저장소에 이미 있거나 이번에 올린 파일이어야 해요.
    //    `upload?.path`: upload가 없으면 오류 없이 undefined가 돼요(옵셔널 체이닝).
    if (usedImage && !snapshot.files.has(usedImage) && upload?.path !== usedImage) {
      throw new ReviewStoreError(422, "고칠 곳이 있습니다. 표시한 칸을 확인해 주세요.", {
        image: `이미지 파일(${usedImage})이 저장소에 없습니다. 이미지를 다시 골라 주세요.`,
      });
    }

    // 6) 바꿀 파일 목록: 원고 + (이번에 올린 이미지를 원고가 실제로 쓰면) 그 이미지
    //    FileChange: { path, sha } — sha가 있으면 그 내용으로 쓰고, null이면 지워요.
    const changes: FileChange[] = [{ path: reviewPath(slug), sha: manuscriptSha }];
    if (upload && upload.path === usedImage) changes.push(upload);

    // 7) 수정일 때: 원래 원고의 이미지가 이 리뷰 것이고, 새 원고가 더 쓰지 않고, 저장소에 있으면 지울 후보예요.
    if (mode === "update" && currentSha) {
      // 저장소에 있는 원래 원고를 읽어 원래 이미지 이름을 알아내요.
      const old = parseReviewFile(await readTextBlob(currentSha));
      const oldImage = old.ok ? old.values.image : "";
      if (oldImage && isOwnImage(oldImage, slug) && imagePath(oldImage) !== usedImage && snapshot.files.has(imagePath(oldImage))) {
        // sha: null은 "이 파일을 지운다"는 뜻이에요.
        changes.push({ path: imagePath(oldImage), sha: null });
      }
    }
    // 이 목록이 커밋 하나로 저장소에 올라가요.
    return changes;
  });

  return { commitSha, slug };
}

/**
 * 리뷰를 지워요. 원고와 함께 이 리뷰의 이미지도 지워요.
 *
 * @param slug 지울 리뷰의 파일 이름
 * @returns 만든 커밋의 번호와 지운 리뷰의 제목(화면 안내에 써요)
 * @throws ReviewStoreError(404) 저장소에 그 리뷰가 없으면
 */
export async function deleteReview(slug: string): Promise<{ commitSha: string; title: string }> {
  // 커밋 메시지에 제목을 넣으려고 먼저 원고를 읽어요.
  const current = await loadReviewSource(slug);
  if (!current) throw new ReviewStoreError(404, "삭제하려는 리뷰가 저장소에 없습니다. 이미 삭제했을 수 있습니다.");
  const parsed = parseReviewFile(current.source);
  // 원고를 읽지 못했거나 제목이 비어 있으면 파일 이름으로 대신해요.
  const title = parsed.ok && parsed.values.title ? parsed.values.title : slug;
  const image = parsed.ok ? parsed.values.image : "";

  const commitSha = await commitChanges(`리뷰 삭제: ${title}`, async (snapshot) => {
    // 읽은 뒤 커밋하기 전에 다른 곳에서 먼저 지웠을 수도 있어서, 최신 상태로 한 번 더 확인해요.
    if (!snapshot.files.has(reviewPath(slug))) throw new ReviewStoreError(404, "삭제하려는 리뷰가 저장소에 없습니다. 이미 삭제했을 수 있습니다.");
    const changes: FileChange[] = [{ path: reviewPath(slug), sha: null }];
    // 이미지는 "이 리뷰 것"(<파일 이름>.확장자)이고 저장소에 있을 때만 함께 지워요.
    if (image && isOwnImage(image, slug) && snapshot.files.has(imagePath(image))) changes.push({ path: imagePath(image), sha: null });
    return changes;
  });

  return { commitSha, title };
}
