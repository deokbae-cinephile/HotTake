/**
 * @file 글쓰기 칸 값 (review-values.ts)
 * 읽는 순서: 41/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: scripts/admin-secrets.mjs → 다음: src/lib/review-form.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면의 칸 값 모양(ReviewFormValues)과, 아무것도 적지 않은 처음 값(EMPTY_VALUES)을 정해요.
 *
 * 왜 따로 둘까요?
 *   글쓰기 화면(브라우저)과 서버(검사·저장)가 함께 쓰는 값이에요.
 *   서버에서만 쓰는 파일(lib/review-store.ts 등)에 두면, 화면이 이 타입 하나만 가져가려 해도
 *   서버 코드까지 브라우저로 따라올 수 있어요. 그래서 다른 파일을 거의 부르지 않는 가벼운 파일로 나눴어요.
 *   (lib/categories.ts에서는 타입만 가져와요. `import type`은 실행할 때 지워져서 아무 코드도 따라오지 않아요.)
 *
 * 누가 쓰나요?
 *   components/review-writer.tsx(글쓰기 화면), lib/review-form.ts(칸 검사), lib/review-file.ts(원고 ↔ 칸 값),
 *   lib/review-store.ts(저장), lib/admin-api.ts(저장 API 부르기), app/api/reviews/route.test.ts(저장 API 테스트)
 */

import type { Category } from "./categories";

/**
 * 글쓰기 화면의 칸 값이에요.
 * 입력 칸(<input>)은 언제나 글자를 다뤄서, 숫자(연도·평점)도 여기서는 글자로 들고 있어요.
 * 검사(lib/review-form.ts)를 통과하면 숫자로 바뀌어 원고에 들어가요.
 *
 * 선택 항목도 `?`(없어도 됨)를 붙이지 않고 빈 글자("")로 둬요.
 * React의 입력 칸은 처음부터 끝까지 글자 값을 받아야 해서(undefined가 되면 경고가 나요), 모든 칸을 글자로 맞췄어요.
 */
export type ReviewFormValues = {
  /** 파일 이름(영문). 원고 파일 이름과 수정 화면 주소가 돼요. 예: winter-stop → content/reviews/winter-stop.json */
  slug: string;
  /** 제목 */
  title: string;
  /** 연도. 예: "2024" */
  year: string;
  /** 감독 또는 작가. 여러 명이면 쉼표로 나눠 적어요. */
  creator: string;
  /** 분류(영화, 도서). 아직 고르지 않았으면 "". `Category | ""`는 "분류 이름이거나 빈 글자"라는 뜻이에요. */
  category: Category | "";
  /** "0.5" ~ "5.0". 아직 고르지 않았으면 "" */
  rating: string;
  /** 한 줄 평 */
  oneLiner: string;
  /** 이미지 파일 이름(public/images 안). 없으면 "" */
  image: string;
  /** 글 쓴 날. 새 글이면 ""이고, 저장할 때 서버가 지금 날짜·시각을 넣어요(lib/review-form.ts의 nowInSeoul). */
  publishedAt: string;
};

/**
 * 아무것도 적지 않은 처음 칸 값. 리뷰 추가 화면이 이 값으로 시작해요.
 * `: ReviewFormValues`로 타입을 붙여 두면, 칸 하나를 빠뜨리거나 이름을 틀렸을 때 TypeScript가 바로 알려 줘요.
 */
export const EMPTY_VALUES: ReviewFormValues = {
  slug: "",
  title: "",
  year: "",
  creator: "",
  category: "",
  rating: "",
  oneLiner: "",
  image: "",
  publishedAt: "",
};
