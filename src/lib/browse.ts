/**
 * @file 목록 검색·분류 필터·정렬 규칙 (browse.ts)
 * 읽는 순서: 18/84번째 · 4단계(처음 화면: 작품 목록)
 *   앞: src/app/page.tsx → 다음: src/components/review-browser.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   처음 화면의 "검색", "분류", "정렬"이 실제로 어떻게 동작하는지 정한 순수 함수들을 모아 둡니다.
 *
 * 맡은 기능
 *   1. 주소 ↔ 조건 바꾸기: `?q=겨울&category=movie&sort=rating` ↔ { q, category, sort }
 *   2. 검색: 제목·감독 또는 작가·한 줄 평 등에서 낱말 찾기(대소문자·띄어쓰기 무시)
 *   3. 거르기와 정렬: 분류(영화·도서)로 거르고 최신순·평점순으로 늘어놓기
 *   4. 분류 버튼에 붙일 편수 세기, 결과 안내 문구 만들기
 *
 * "순수 함수"가 뭔가요?
 *   같은 입력을 넣으면 언제나 같은 결과를 돌려주고, 바깥의 아무것도 바꾸지 않는 함수예요.
 *   화면(React)과 떼어 놓았기 때문에 테스트하기 쉽습니다(lib/browse.test.ts).
 *
 * 누가 쓰나요?
 *   components/review-browser.tsx (처음 화면의 검색·목록 영역)
 *
 * 자주 나오는 배열 메서드
 *   - filter(조건): 조건이 참인 항목만 남긴 새 배열
 *   - map(바꾸기): 항목마다 바꾼 값으로 만든 새 배열
 *   - sort(비교 규칙): 배열을 그 자리에서 늘어놓고 그 배열을 돌려줘요
 *   - every(조건): 모든 항목이 조건을 만족하면 true
 */

import { CATEGORIES, type Category, categoryFromParam, categorySlug } from "./categories";
import { compareLatest, compareRating, type Review } from "./review";

/** 정렬 방법: "latest"(최신순) 또는 "rating"(평점순) 둘 중 하나만 쓸 수 있어요(글자 리터럴 유니언 타입). */
export type SortKey = "latest" | "rating";

/**
 * 목록 조건 묶음이에요. 주소의 `?q=&category=&sort=`와 짝을 이룹니다.
 * 조건을 주소에 남기면 링크를 복사해 보내거나 뒤로 가기를 해도 같은 목록이 보여요.
 */
export type BrowseParams = {
  /** 검색어. 없으면 빈 글자("") */
  q: string;
  /** 고른 분류. "전체"면 null */
  category: Category | null;
  /** 정렬 방법 */
  sort: SortKey;
};

/** 아무 조건도 없는 기본 상태: 검색어 없음, 분류 전체, 최신순. 주소에 아무 조건도 없을 때의 모습이에요. */
export const DEFAULT_PARAMS: BrowseParams = { q: "", category: null, sort: "latest" };

/**
 * 주소의 조건을 읽는 데 필요한 모양이에요.
 * URLSearchParams(브라우저의 주소 조건 도구)와 Next.js의 useSearchParams() 결과가 모두 get()을 갖고 있어서,
 * 둘 다 받을 수 있게 "get만 있으면 된다"고 넓게 정했어요.
 * (TypeScript는 이름이 아니라 "모양"이 맞으면 같은 타입으로 받아 줘요. 그래서 get만 있으면 무엇이든 넘길 수 있어요.)
 */
type ParamReader = { get(name: string): string | null };

/**
 * 주소에서 목록 조건을 읽어요. 이상한 값(없는 분류, 모르는 정렬)은 무시하고 기본값을 씁니다.
 *
 * @param search 주소 조건을 읽는 도구(get이 있는 것)
 * @returns 목록 조건 묶음
 * @example
 * parseParams(new URLSearchParams("q=겨울&sort=rating"));
 * // { q: "겨울", category: null, sort: "rating" }
 */
export function parseParams(search: ParamReader): BrowseParams {
  return {
    // `?.`는 "앞이 비어 있으면 뒤를 건너뛴다"는 뜻이에요. q가 없으면 trim()을 부르지 않고 undefined가 되고,
    // 그러면 `?? ""`가 빈 글자를 넣어 줍니다.
    q: search.get("q")?.trim() ?? "",
    // 분류는 주소에 영어 이름(?category=movie)으로 적어요. 목록에 있는 분류일 때만 받아들이고, 없으면 null(전체)이에요.
    // 한글 분류(?category=영화)가 와도 받아요(lib/categories.ts의 categoryFromParam).
    category: categoryFromParam(search.get("category")),
    // "rating"일 때만 평점순, 그 밖에는 모두 최신순이에요.
    sort: search.get("sort") === "rating" ? "rating" : "latest",
  };
}

/**
 * 목록 조건을 주소 뒤에 붙일 글자로 만들어요. 기본값은 주소를 지저분하게 하지 않도록 적지 않아요.
 * 매개변수 자리의 `{ q, category, sort }`는 받은 객체에서 세 항목을 바로 꺼내는 구조 분해예요.
 *
 * @param params 목록 조건 묶음
 * @returns "?q=...&sort=..." 모양의 글자. 조건이 없으면 ""
 * @example
 * toSearch({ q: "겨울", category: null, sort: "latest" }); // "?q=%EA%B2%A8%EC%9A%B8"
 * toSearch(DEFAULT_PARAMS);                              // ""
 */
export function toSearch({ q, category, sort }: BrowseParams): string {
  // URLSearchParams는 한글·공백 같은 글자를 주소에 쓸 수 있는 모양(%EA%B2%A8...)으로 알아서 바꿔 줘요.
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  // 분류는 영어 이름으로 적어요. 한글을 적으면 주소창에서 %EC%98%81…처럼 길게 바뀌어 보여서요.
  if (category) params.set("category", categorySlug(category));
  if (sort !== "latest") params.set("sort", sort);
  const search = params.toString();
  // 조건이 하나라도 있으면 앞에 "?"를 붙이고, 없으면 빈 글자를 돌려줘요.
  return search ? `?${search}` : "";
}

/**
 * 검색어나 분류로 "거르고" 있는지 알려 줘요.
 * 정렬은 순서만 바꿀 뿐 리뷰를 빼지 않으므로 여기에 넣지 않습니다.
 *
 * @param params 목록 조건(q와 category만 봐요)
 * @returns 검색어가 있거나 분류를 골랐으면 true
 */
export function isFiltered({ q, category }: BrowseParams): boolean {
  return q !== "" || category !== null;
}

/**
 * 비교하기 좋게 글자를 다듬어요.
 * - normalize("NFC"): 한글은 같은 글자라도 컴퓨터 안에서 저장 방식이 두 가지일 수 있어요. 하나로 맞춥니다.
 * - toLocaleLowerCase("ko"): 영어를 소문자로 바꿔 대소문자를 가리지 않게 해요("WINTER" = "winter").
 * 검색(matchesQuery)이 대소문자·글자 모양을 맞춰 비교하려고 써요.
 *
 * @param text 다듬을 글자
 * @returns 비교용 글자
 * @example fold("Winter STOP") // "winter stop"
 */
export const fold = (text: string) => text.normalize("NFC").toLocaleLowerCase("ko");

/**
 * 공백을 모두 지워요. 띄어쓰기를 다르게 써도 찾을 수 있게 합니다.
 * /\s+/g는 "모든 공백 덩어리"라는 정규식이에요(\s: 공백 글자, +: 하나 이상, g: 처음 하나만이 아니라 전부).
 * @example squeeze("겨울 정류장") // "겨울정류장"
 */
const squeeze = (text: string) => text.replace(/\s+/g, "");

/**
 * 리뷰 한 편이 검색어에 맞는지 확인해요.
 *
 * 찾는 곳: 제목, 감독 또는 작가, 한 줄 평 (+ 연도, 분류)
 * 규칙:
 *   - 대소문자를 가리지 않아요. ("winter" → "Winter Stop")
 *   - 낱말을 여럿 쓰면 모두 들어 있어야 해요. ("겨울 한서윤" → 둘 다 있는 리뷰만)
 *   - 띄어쓰기가 달라도 찾아요. ("겨울정류장" → "겨울 정류장")
 *
 * @param review 확인할 리뷰
 * @param q 검색어
 * @returns 맞으면 true
 */
export function matchesQuery(review: Review, q: string): boolean {
  // 검색어를 다듬은 뒤 공백으로 잘라 낱말 목록을 만들어요. filter(Boolean)은 빈 낱말("")을 빼 줍니다.
  const terms = fold(q).split(/\s+/).filter(Boolean);
  // 낱말이 없으면(빈 검색어) 모든 리뷰가 맞는 것으로 봐요.
  if (terms.length === 0) return true;

  // 찾을 곳의 글자를 모두 한 줄로 이어 "건초 더미(haystack)"를 만들어요.
  const haystack = fold(
    // String(review.year): 숫자 연도를 글자로 바꿔 함께 이어요. join(" "): 배열을 빈칸 하나로 이어 한 글자로 만들어요.
    [review.title, review.creator, review.oneLiner, String(review.year), review.category]
      .filter(Boolean)
      .join(" "),
  );
  // 띄어쓰기를 무시한 비교용으로 공백을 지운 판도 만들어 둬요.
  const tight = squeeze(haystack);

  // every: 모든 낱말이 조건을 만족해야 true예요.
  // 낱말이 원래 글자(haystack) 또는 공백을 지운 글자(tight)에 들어 있으면 통과입니다.
  return terms.every((term) => haystack.includes(term) || tight.includes(term));
}

/**
 * 조건에 맞는 리뷰만 골라, 정한 순서로 늘어놓아 돌려줘요.
 *
 * filter와 sort를 이어 쓰는 "메서드 체이닝"이에요.
 *   1) filter: 분류가 맞고(전체면 통과) 검색어도 맞는 리뷰만 남겨요.
 *   2) sort: 정렬 규칙(lib/review.ts)대로 늘어놓아요.
 * filter가 새 배열을 만들어 주기 때문에, sort가 원래 배열을 바꾸지 않아 안전합니다.
 * (`readonly Review[]`: 이 함수가 받은 배열을 바꾸지 않겠다는 약속이에요. push·sort를 바로 부르면 타입 오류가 나요.)
 *
 * @param reviews 전체 리뷰
 * @param params 목록 조건
 * @returns 조건에 맞는 리뷰를 정한 순서로 담은 새 배열
 */
export function browse(reviews: readonly Review[], params: BrowseParams): Review[] {
  return reviews
    .filter((review) => (params.category === null || review.category === params.category) && matchesQuery(review, params.q))
    .sort(params.sort === "rating" ? compareRating : compareLatest);
}

/**
 * 분류 버튼에 보일 분류와 편수를 셉니다.
 *
 * - 리뷰가 하나도 없는 분류는 버튼을 만들지 않아요(눌러도 빈 목록이니까요).
 * - 단, 지금 고른 분류는 0편이어도 남겨 둬요. 주소로 그 분류가 들어왔을 때 어떤 버튼이 골라졌는지 보여야 하거든요.
 *
 * @param reviews 전체 리뷰
 * @param selected 지금 고른 분류(없으면 null)
 * @returns [{ category, count }] 목록. 분류 순서는 CATEGORIES 순서(영화, 도서)예요.
 * @example
 * countCategories(reviews); // [{ category: "영화", count: 3 }, { category: "도서", count: 1 }]
 */
export function countCategories(
  reviews: readonly Review[],
  selected: Category | null = null,
): { category: Category; count: number }[] {
  return (
    CATEGORIES
      // 분류마다 그 분류인 리뷰 수를 셉니다.
      .map((category) => ({ category, count: reviews.filter((review) => review.category === category).length }))
      // 1편 이상이거나, 지금 고른 분류면 남겨요.
      .filter(({ category, count }) => count > 0 || category === selected)
  );
}

/**
 * 목록 위에 보이고 화면 낭독기가 읽어 주는 결과 안내 문구예요.
 *
 * @param total 전체 리뷰 수
 * @param found 조건에 맞는 리뷰 수
 * @param params 지금 조건
 * @returns 안내 문구. 거르고 있으면 "전체 중 찾은 편수", 아니면 "전체 편수"
 * @example
 * resultStatus(8, 8, DEFAULT_PARAMS);                    // "전체 8편"
 * resultStatus(8, 1, { ...DEFAULT_PARAMS, q: "겨울" });  // "8편 중 1편"
 */
export function resultStatus(total: number, found: number, params: BrowseParams): string {
  return isFiltered(params) ? `${total}편 중 ${found}편` : `전체 ${total}편`;
}
