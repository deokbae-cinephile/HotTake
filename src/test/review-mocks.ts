/**
 * @file 테스트용 가짜 리뷰 데이터 (review-mocks.ts)
 * 읽는 순서: 74/84번째 · 8단계(설정·테스트·배포)
 *   앞: vitest.setup.ts → 다음: playwright.config.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   단위 테스트(*.test.ts, *.test.tsx)에서 쓰는 가상의 리뷰 데이터를 모아 둡니다.
 *
 * 왜 실제 원고(content/reviews)를 쓰지 않을까요?
 *   글쓴이가 원고를 고치거나 지우면 테스트 결과도 바뀌어 버려요.
 *   테스트용 데이터를 따로 두면 원고가 어떻게 바뀌든 테스트는 늘 같은 결과를 기대할 수 있습니다.
 *
 * "mock(목)"은 "진짜를 흉내 낸 가짜"라는 뜻이에요.
 *
 * 누가 쓰나요?
 *   lib/browse.test.ts(검색·정렬 규칙), components/review-browser.test.tsx(목록 화면·무한 스크롤),
 *   components/review-list-item.test.tsx(목록 한 줄)
 *
 * 등장하는 작품·사람은 모두 지어낸 가상 데이터예요.
 */

// 가짜 데이터의 모양을 실제 리뷰와 똑같이 맞추려고 Review 타입만 가져와요(import type: 실행할 때는 지워져요).
// "@/"는 src 폴더를 가리키는 줄임 경로예요(tsconfig.json의 paths).
import type { Review } from "@/lib/review";

/**
 * 목록 화면 테스트용 리뷰 4편(최신순으로 적어 두었어요).
 *
 * 테스트가 기대하는 사실들:
 *   - 최신순: 겨울 정류장 → 화성 세탁소 → 필름이 끊기기 전에 → 8비트 영웅전
 *   - 평점순: 필름이 끊기기 전에(5) → 겨울 정류장(4.5) → 화성 세탁소(3.5) → 8비트 영웅전(2.5)
 *   - 영화 분류는 2편(겨울 정류장, 필름이 끊기기 전에), 도서 분류도 2편(화성 세탁소, 8비트 영웅전)
 *   - 이미지는 겨울 정류장에만 있어요(이미지가 있을 때와 없을 때를 함께 시험하려고요).
 *
 * `: Review[]`로 타입을 붙여 두면, 항목 이름을 틀리거나 꼭 필요한 항목을 빠뜨렸을 때 TypeScript가 바로 알려 줘요.
 */
export const reviewMocks: Review[] = [
  {
    slug: "winter-stop",
    title: "겨울 정류장",
    year: 2024,
    creator: "한서윤",
    category: "영화",
    rating: 4.5,
    oneLiner: "버스는 오지 않아도, 기다림은 끝내 도착한다.",
    publishedAt: "2026-11-08",
    image: "winter-stop.jpg",
  },
  {
    slug: "laundromat-on-mars",
    title: "화성 세탁소",
    year: 2025,
    creator: "데이나 휫필드",
    category: "도서",
    rating: 3.5,
    oneLiner: "우주에서도 양말 한 짝은 사라진다.",
    publishedAt: "2026-10-30",
  },
  {
    slug: "before-the-last-reel",
    title: "필름이 끊기기 전에",
    year: 2023,
    creator: "카미유 루셀",
    category: "영화",
    rating: 5,
    oneLiner: "영사기가 멈춘 자리에서 영화는 관객의 기억으로 상영된다.",
    publishedAt: "2026-10-18",
  },
  {
    slug: "eight-bit-legend",
    title: "8비트 영웅전",
    year: 2024,
    creator: "브렌트 콜",
    category: "도서",
    rating: 2.5,
    oneLiner: "향수는 입장권일 뿐, 상영 시간을 책임지지 않는다.",
    publishedAt: "2026-09-10",
  },
];

/**
 * 무한 스크롤(10편씩 보여 주기) 테스트용으로, 리뷰를 원하는 만큼 만들어 줘요.
 * 제목은 "시험 영화 01", "시험 영화 02"...이고, 번호가 작을수록 최근에 쓴 글이에요(최신순 = 번호순).
 *
 * @param count 만들 리뷰 수
 * @returns 리뷰 count편(최신순)
 * @example manyReviews(2) // [{ slug: "movie-01", title: "시험 영화 01", ... }, { slug: "movie-02", ... }]
 */
export function manyReviews(count: number): Review[] {
  // Array.from({ length: n }, 만들기): 길이 n인 배열을 만들며 칸마다 함수를 불러 값을 채워요.
  // 함수의 첫 인자(_)는 빈 값이라 쓰지 않고(이름 _는 "안 씀" 표시), 둘째 인자 index는 0부터 세는 칸 번호예요.
  return Array.from({ length: count }, (_, index) => {
    // padStart(2, "0"): 한 자리 수 앞에 0을 채워요(1 → "01"). 제목 가나다순과 번호순이 같아지게요.
    const number = String(index + 1).padStart(2, "0");
    return {
      slug: `movie-${number}`,
      title: `시험 영화 ${number}`,
      year: 2020,
      creator: `감독${number}`,
      category: "영화",
      rating: 3,
      oneLiner: `한 줄 평 ${number}`,
      // 번호가 커질수록 하루씩 앞선 날짜(2026-01-31, 2026-01-30, ...). 그래서 최신순이 번호순이 돼요.
      // 31 - index라 31편까지 만들 수 있어요.
      publishedAt: `2026-01-${String(31 - index).padStart(2, "0")}`,
    };
  });
}
