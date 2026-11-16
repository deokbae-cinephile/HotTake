/**
 * @file 처음 화면의 검색·분류·정렬과 작품 목록 (review-browser.tsx)
 * 읽는 순서: 19/84번째 · 4단계(처음 화면: 작품 목록)
 *   앞: src/lib/browse.ts → 다음: src/components/choice-chips.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   처음 화면에서 리뷰를 찾고 고르는 영역 전체를 맡습니다.
 *   넓은 화면(1024px~)에서는 왼쪽에 검색 칸, 오른쪽에 작품 목록을 나란히 놓고,
 *   스크롤하면 검색 칸은 왼쪽 위에 붙어 있고 오른쪽 목록만 움직여요(globals.css의 .browse-aside).
 *
 *     ┌ 검색 칸(16~18rem) ──────────────┐   작품 목록 ······ 전체 15편 / 현재 10편 표시
 *     │ 검색  [__________] [찾기]       │   [이미지] 겨울 정류장 ·········· 4.5
 *     │ 분류  [▶전체 15편] [영화 9편]   │   [이미지] ...
 *     │ 정렬  [▶최신순] [평점순]          │   (처음 10편, 내려가면 10편씩 더)
 *     └─────────────────────────────────┘
 *
 * 맡은 기능
 *   1. 검색: 검색창에 글자를 치고 Enter(또는 [찾기] 단추)를 누르면 적용해요.
 *   2. 분류 필터(영화·도서), 정렬(최신순·평점순): 고르는 즉시 적용해요.
 *   3. 결과 편수 안내: "15편 중 3편"을 화면 낭독기도 읽어 줘요(role="status").
 *   4. 조건을 주소(?q=&category=&sort=)에 남겨요. 링크를 공유하거나 뒤로 가기를 해도 같은 목록이 보입니다.
 *   5. 결과가 없으면 안내하고, "검색 조건 지우기" 단추로 처음 상태로 돌아가요.
 *      리뷰가 아직 한 편도 없으면 "아직 올린 리뷰가 없습니다"만 보여요.
 *   6. 무한 스크롤: 처음에는 10편만 보여 주고, 목록 끝에 가까워지면 10편씩 더 보여 줘요.
 *      키보드·화면 낭독기 사용자를 위해 목록 끝에 [n편 더 보기] 단추도 둬요(누르면 새로 나온 첫 리뷰로 초점이 가요).
 *
 * 파일 안의 구성(위에서 아래로)
 *   - ReviewBrowser      : 밖에서 쓰는 컴포넌트. 주소와 화면을 이어 줘요.
 *   - UrlBoundBrowser    : 주소의 조건을 읽고, 조건이 바뀌면 주소를 바꿔요.
 *   - ReviewBrowserView  : 실제 화면(검색창·버튼·목록). 주소를 모르고 받은 조건대로만 그려서 테스트하기 쉬워요.
 *   - Count              : 칩에 붙는 편수(칩 모양 라디오 단추는 choice-chips.tsx)
 *
 * 왜 이렇게 나눴을까요? ("관심사 분리")
 *   "주소 다루기"와 "화면 그리기"를 섞으면 테스트할 때마다 주소를 흉내 내야 해요.
 *   둘을 나누면 화면(ReviewBrowserView)은 조건만 넣어 바로 테스트할 수 있습니다.
 *
 * 누가 쓰나요?
 *   app/page.tsx(처음 화면)
 *
 * 함께 보면 좋은 파일
 *   - lib/browse.ts: 거르기·정렬(browse), 분류별 편수(countCategories), 주소 읽기·쓰기(parseParams·toSearch) 같은 계산
 *   - components/choice-chips.tsx: 칩 모양 고르기 단추
 *   - components/review-list-item.tsx: 목록의 리뷰 한 편
 */

// 이 파일의 컴포넌트는 상태(useState)와 클릭 처리처럼 브라우저에서 돌아야 하는 일을 해서 클라이언트 컴포넌트로 만들어요.
"use client";

// useSearchParams: 주소의 ? 뒤 조건(예: q=겨울&category=movie)을 읽는 Next.js 훅
import { useSearchParams } from "next/navigation";
// React에서 쓰는 도구들. 각각 아래에서 쓰일 때 설명할게요.
// (`type FormEvent`처럼 앞에 type이 붙은 것은 타입만 가져와요. 빌드하면 사라져요.)
import { type FormEvent, Suspense, useEffect, useId, useMemo, useRef, useState } from "react";

// 목록 계산 도구들(lib/browse.ts). 화면 그리기와 떼어 두어 따로 테스트해요.
import {
  browse,
  type BrowseParams,
  countCategories,
  DEFAULT_PARAMS,
  isFiltered,
  parseParams,
  resultStatus,
  type SortKey,
  toSearch,
} from "@/lib/browse";
import type { Review } from "@/lib/review";

import { Choice, ChoiceGroup } from "./choice-chips";
import { ReviewListItem } from "./review-list-item";

/**
 * 한 번에 보여 줄 리뷰 수. 처음에 10편, 목록 끝에 가까워지면 10편씩 더 보여 줘요.
 * export: 테스트에서도 같은 값을 쓰려고 내보내요.
 */
export const PAGE_SIZE = 10;

/* ──────────────────────────────────────────────────────────────
 * 1. 밖에서 쓰는 컴포넌트: 주소와 화면을 이어 준다
 * ────────────────────────────────────────────────────────────── */

/** ReviewBrowser가 받는 값(props) */
type Props = {
  /** 전체 리뷰(목록 정보). app/page.tsx가 빌드할 때 원고(content/reviews 폴더의 JSON 파일)를 읽어 넘겨줘요. */
  reviews: Review[];
};

/**
 * 처음 화면의 검색·분류·정렬과 작품 목록
 *
 * Suspense를 쓰는 이유 (조금 어려운 이야기예요)
 *   처음 화면은 빌드할 때 미리 HTML로 만들어 둬요(정적 생성).
 *   그런데 빌드할 때는 방문자가 어떤 주소(?q=...)로 들어올지 알 수 없죠.
 *   그래서 주소를 읽는 useSearchParams()를 쓰는 부분은 미리 만들 수 없고, 브라우저에서 그려야 해요.
 *
 *   <Suspense fallback={A}>B</Suspense>는 "B를 그릴 수 없을 때는 A를 대신 보여 줘"라는 뜻이에요.
 *   - 빌드할 때: B(주소 읽기)를 못 그리니 A(조건 없는 목록)가 HTML에 들어가요.
 *     → 검색엔진과 자바스크립트가 꺼진 브라우저도 목록을 볼 수 있어요.
 *   - 브라우저에서: 주소의 조건을 읽은 B로 바뀌어 거른 목록을 보여 줘요.
 *
 * @param props - {@link Props}
 * @returns 검색 칸과 작품 목록. 미리 만든 HTML에서는 조건 없는 목록, 브라우저에서는 주소 조건대로 거른 목록이에요.
 *
 * @example
 * // app/page.tsx
 * <ReviewBrowser reviews={reviews} />
 */
export function ReviewBrowser({ reviews }: Props) {
  return (
    // fallback의 interactive={false}: 미리 만든 HTML에서는 검색창·버튼을 "사용할 수 없음(disabled)"으로 둬요.
    // 화면이 준비되기 전에 누른 것은 진짜 화면으로 바뀌면서 사라져 버리기 때문에, 아예 누를 수 없게 하는 편이 정직해요.
    // 준비가 끝나면(UrlBoundBrowser가 그려지면) 모두 켜져요. 보통 눈 깜짝할 사이예요.
    <Suspense
      fallback={<ReviewBrowserView reviews={reviews} params={DEFAULT_PARAMS} onParamsChange={ignore} interactive={false} />}
    >
      <UrlBoundBrowser reviews={reviews} />
    </Suspense>
  );
}

/**
 * 아무것도 하지 않는 함수. 미리 만든 HTML(fallback)에서는 조건을 바꿀 일이 없어서 빈 함수를 넘겨요.
 * (컴포넌트 밖에 두어서, 다시 그릴 때마다 새 함수가 만들어지지 않아요.)
 */
function ignore() {}

/**
 * 주소의 조건을 읽어 화면에 넘기고, 화면에서 조건이 바뀌면 주소도 바꿔요.
 *
 * 왜 조건을 상태(useState)로 따로 들고 있을까요?
 *   주소만 바꾸고 그 주소를 다시 읽어 그리면, 주소가 바뀌어 화면에 닿기까지 아주 잠깐의 틈이 생겨요.
 *   그 틈에 방금 누른 라디오 단추가 이전 값으로 돌아가 보일 수 있어요.
 *   그래서 화면은 상태로 "바로" 바꾸고, 주소는 그 뒤에 맞춰 바꿔요.
 *
 * @param props - {@link Props}
 * @returns 지금 조건을 넣은 ReviewBrowserView
 */
function UrlBoundBrowser({ reviews }: Props) {
  // 주소의 ? 뒤 조건(예: q=겨울&category=movie)
  const searchParams = useSearchParams();
  // 비교하기 쉽게 글자로 바꿔 둬요. 예: "category=book&sort=rating"
  const urlKey = searchParams.toString();

  // 화면에 보일 조건. 처음에는 주소에서 읽어요. (useState(() => ...)는 처음 한 번만 계산해요.)
  const [params, setParams] = useState(() => parseParams(searchParams));
  // 지난번에 본 주소 조건. 주소가 "바뀌었는지" 알아내려고 기억해 둬요.
  const [prevUrlKey, setPrevUrlKey] = useState(urlKey);

  // 주소가 지난번과 달라졌으면, 그리고 그 주소가 지금 화면 조건과 다르면 화면을 주소에 맞춰요.
  //  - 바깥에서 주소가 바뀐 경우(예: 머리글의 블로그 이름을 눌러 "/"로 이동) → 화면을 맞춰요.
  //  - 우리가 방금 바꾼 주소가 뒤늦게 도착한 경우 → 이미 화면과 같으니 그대로 둬요.
  // 그리는 도중에 바로 맞추는 방법이에요(ReviewBrowserView의 검색창 맞추기와 같은 방법).
  // 그리는 도중에 setState를 부르면 React는 지금 그림을 버리고 새 값으로 곧바로 다시 그려요.
  // useEffect로 맞추면 "틀린 화면을 한 번 그린 뒤" 고치게 되는데, 이 방법은 그 한 번을 건너뛰어요.
  if (urlKey !== prevUrlKey) {
    setPrevUrlKey(urlKey);
    // toSearch(params)는 "?q=..." 모양이라 앞의 "?"를 떼고 주소 조건 글자와 비교해요.
    if (urlKey !== toSearch(params).slice(1)) setParams(parseParams(searchParams));
  }

  /**
   * 화면에서 조건이 바뀌면 실행돼요.
   *
   * window.history.replaceState(상태, "", 새 주소)
   *   브라우저의 주소만 바꾸고 페이지는 다시 받지 않아요. 방문 기록도 새로 쌓지 않아요(replace).
   *   (기록을 쌓으면 분류를 바꿀 때마다 뒤로 가기를 한 번씩 더 눌러야 이전 페이지로 돌아가요.)
   *   Next.js는 이렇게 바꾼 주소도 useSearchParams에 알려 줘요(공식 문서가 권하는 방법이에요).
   *
   * @param next - 새 조건(검색어·분류·정렬)
   */
  function handleChange(next: BrowseParams) {
    // 1) 화면부터 바로 바꿔요.
    setParams(next);
    // 2) 주소를 바꿔요. 주소가 화면에 닿는 것은 조금 뒤지만, 화면과 같은 조건이라 위의 "주소에 맞추기"는 일어나지 않아요.
    // window.location.pathname: 지금 주소의 경로 부분(예: "/"). 그 뒤에 "?q=…" 조건을 붙여요.
    window.history.replaceState(null, "", `${window.location.pathname}${toSearch(next)}`);
  }

  return <ReviewBrowserView reviews={reviews} params={params} onParamsChange={handleChange} />;
}

/* ──────────────────────────────────────────────────────────────
 * 2. 실제 화면: 받은 조건대로 검색창·버튼·목록을 그린다
 * ────────────────────────────────────────────────────────────── */

/** ReviewBrowserView가 받는 값(props) */
type ViewProps = {
  /** 전체 리뷰 */
  reviews: Review[];
  /** 지금 조건({ q: 검색어, category: 분류 또는 null, sort: 정렬 }) */
  params: BrowseParams;
  /** 조건이 바뀌면 부르는 함수. 주소를 바꾸는 일은 부르는 쪽이 해요. */
  onParamsChange: (next: BrowseParams) => void;
  /** false면 검색창·버튼을 사용할 수 없게(disabled) 그려요. 미리 만든 HTML(fallback)에서 써요. 기본 true */
  interactive?: boolean;
};

/**
 * 정렬 버튼 목록. value는 주소에 쓰는 값, label은 화면에 보이는 이름이에요.
 * `{ value: SortKey; label: string }[]`: 이런 모양의 객체가 여러 개 든 배열이라는 타입이에요.
 */
const SORTS: { value: SortKey; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "rating", label: "평점순" },
];

/**
 * 검색·분류·정렬과 작품 목록의 실제 화면
 *
 * 검색어는 Enter를 눌러야 적용하고, 분류와 정렬은 고르는 즉시 적용해요.
 * 검색어까지 글자를 칠 때마다 적용하면, 화면 낭독기가 결과 편수를 계속 읽어 시끄러워지거든요.
 *
 * 주소를 모르고 받은 조건(params)대로만 그리기 때문에, 테스트에서는 조건을 직접 넣어 바로 확인할 수 있어요.
 *
 * @param props - {@link ViewProps}
 * @returns 검색 칸(<search>)과 작품 목록 구역(<section>)을 담은 두 칸 격자
 *
 * @example
 * <ReviewBrowserView reviews={reviews} params={DEFAULT_PARAMS} onParamsChange={setParams} />
 */
export function ReviewBrowserView({ reviews, params, onParamsChange, interactive = true }: ViewProps) {
  // 조건을 하나씩 꺼내 둬요(구조 분해).
  const { q, category, sort } = params;
  // 사용할 수 없게 둘지(disabled). 입력란·단추·라디오 단추에 똑같이 넘겨요.
  const disabled = !interactive;

  // useState: 컴포넌트가 기억하는 값(상태)을 만들어요. [지금 값, 바꾸는 함수]를 돌려줍니다.
  // draft는 "검색창에 지금 쳐 둔 글자"예요. Enter를 누르기 전까지는 조건(q)과 다를 수 있어요.
  const [draft, setDraft] = useState(q);

  // 뒤로 가기 등으로 주소의 검색어(q)가 바뀌면 검색창 글자(draft)도 맞춰야 해요.
  // React 공식 문서가 권하는 방법: "지난번 q"를 기억해 두고, 그리는 도중에 달라졌으면 바로 맞춥니다.
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
    setSyncedQ(q);
    setDraft(q);
  }

  // useRef: 화면의 실제 요소(여기서는 검색창 <input>)를 가리키는 손잡이예요. 나중에 초점을 옮길 때 씁니다.
  const inputRef = useRef<HTMLInputElement>(null);

  // 작품 목록(<ul>)의 손잡이. [더 보기]로 불러온 뒤 새로 나온 첫 리뷰로 초점을 옮길 때 써요.
  const listRef = useRef<HTMLUListElement>(null);

  // useId: 이 컴포넌트만의 겹치지 않는 id를 만들어요. label과 input, 제목과 구역을 서로 연결할 때 씁니다.
  const id = useId();

  // useMemo: 계산 결과를 기억해 두고, [ ] 안의 값이 바뀔 때만 다시 계산해요.
  // 리뷰가 많아져도 상관없는 일(예: 검색창에 글자 치기)로 다시 그릴 때 목록 계산을 건너뛸 수 있어요.
  // results: 조건에 맞게 거르고 정렬한 리뷰 전체(아직 10편으로 자르기 전)
  const results = useMemo(() => browse(reviews, { q, category, sort }), [reviews, q, category, sort]);
  // categories: 분류 칩에 쓸 [{ category: "영화", count: 9 }, ...]. 리뷰가 있는 분류(와 지금 고른 분류)만 나와요.
  const categories = useMemo(() => countCategories(reviews, category), [reviews, category]);

  // 검색어나 분류로 거르고 있는지(= "검색 조건 지우기" 단추를 보일지)
  const filtered = isFiltered(params);

  /* ── 무한 스크롤: 지금 몇 편까지 보여 줄지 ── */

  // 보여 줄 편수. 처음에는 10편(PAGE_SIZE)이에요.
  const [shown, setShown] = useState(PAGE_SIZE);
  // 조건(검색어·분류·정렬)이 바뀌면 다시 처음 10편부터 보여 줘요. 위의 검색창 맞추기와 같은 방법이에요.
  // resultKey: 세 조건을 한 글자로 이어 "조건이 바뀌었는지" 비교하기 쉽게 해요.
  //   \u0000은 글자에 쓰일 일이 없는 보이지 않는 문자라, 두 조건이 우연히 같은 글자로 이어지는 일을 막는 칸막이로 써요.
  //   `category ?? ""`: category가 null이면 빈 글자를 써요(`??`는 왼쪽이 null·undefined일 때만 오른쪽을 써요).
  const resultKey = `${q}\u0000${category ?? ""}\u0000${sort}`;
  const [shownKey, setShownKey] = useState(resultKey);
  if (resultKey !== shownKey) {
    setShownKey(resultKey);
    setShown(PAGE_SIZE);
  }
  // 지금 보여 줄 리뷰와, 아직 남은 리뷰가 있는지
  // 미리 만든 HTML(interactive가 false)에는 모든 리뷰를 담아요. 자바스크립트가 꺼져 있으면
  // [더 보기]도 저절로 불러오기도 동작하지 않아서, 처음 10편 뒤의 리뷰에 닿을 길이 없어지거든요.
  // (자바스크립트가 켜지면 처음 10편 + [더 보기]로 바뀌어요. 바뀌는 곳은 첫 화면 아래라 눈에 띄지 않아요.)
  // slice(0, shown): 배열의 앞에서부터 shown개만 잘라 새 배열로 돌려줘요(원래 배열은 그대로예요).
  const visible = interactive ? results.slice(0, shown) : results;
  const hasMore = interactive && shown < results.length;

  // [더 보기]로 불러왔을 때(단추를 누르거나, 단추에 초점이 있는 채로 저절로 불러왔을 때),
  // 새로 나온 첫 리뷰로 초점을 옮기려고 그 번호를 기억해 둬요.
  // `useRef<number | null>`: 숫자 또는 null이 들어가는 상자. 상태가 아니라서 바꿔도 다시 그리지 않아요.
  const focusIndexRef = useRef<number | null>(null);
  // useEffect: 화면을 그린 "뒤에" 실행해요. 새 리뷰가 실제로 그려진 뒤라야 그 리뷰에 초점을 옮길 수 있어요.
  useEffect(() => {
    const index = focusIndexRef.current;
    if (index === null) return;
    focusIndexRef.current = null;
    // 목록의 index번째 리뷰(새로 나온 첫 리뷰) 한 편(<article>, tabIndex -1)으로 초점을 옮겨요.
    // querySelectorAll(":scope > li"): 목록 바로 아래의 <li>들. [index]로 그 가운데 하나를 골라요.
    const item = listRef.current?.querySelectorAll(":scope > li")[index];
    // querySelector<HTMLElement>: 찾은 요소를 HTMLElement로 다뤄 focus()를 부를 수 있게 해요(제네릭).
    item?.querySelector<HTMLElement>("article")?.focus();
    // shown은 효과 안에서 읽지 않지만, "더 보여 준 뒤(다시 그린 뒤)에 돌려라"는 신호로 일부러 넣었어요.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [shown]);

  // 목록 끝의 "더 보기" 자리. 이 자리가 화면에 가까워지면 10편을 더 보여 줘요.
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = moreRef.current;
    // 미리 만든 HTML이거나, 남은 리뷰가 없거나, 브라우저가 IntersectionObserver를 모르면(아주 옛 브라우저) 단추만 써요.
    if (!interactive || !hasMore || !target || !("IntersectionObserver" in window)) return;
    // IntersectionObserver: 요소가 화면(뷰포트)에 들어오는지 지켜보는 브라우저 도구예요.
    // rootMargin "300px": 화면 아래 300px 앞에서 미리 알려 줘서, 끝에 닿기 전에 다음 리뷰가 준비돼요.
    const observer = new IntersectionObserver(
      // entries: 지켜보는 요소들의 상태 목록. some: 하나라도 화면 안(isIntersecting)이면 true예요.
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        // 키보드 사용자가 Tab으로 [더 보기]에 오면 화면이 단추까지 스크롤되면서 여기서 저절로 불러와요.
        // 그러면 초점이 있던 단추가 사라져 초점을 잃으니, 단추를 누른 것처럼 새로 나온 첫 리뷰로 초점을 옮겨요.
        if (target.contains(document.activeElement)) focusIndexRef.current = shown;
        // 함수형 업데이트: 지난 값(count)에 10을 더해요. 늘 최신 값을 바탕으로 계산해요.
        setShown((count) => count + PAGE_SIZE);
      },
      // rootMargin: 위·오른쪽·아래·왼쪽 순서. 아래쪽만 300px 넓혀 미리 알아채요.
      { rootMargin: "0px 0px 300px 0px" },
    );
    observer.observe(target);
    // 정리 함수: 편수가 바뀌면 지켜보기를 새로 시작해요. 새로 시작할 때 그 자리가 아직 화면 안이면 바로 한 번 더 알려 줘서,
    // 화면이 아주 길어도 빈자리 없이 채워져요.
    return () => observer.disconnect();
  }, [interactive, hasMore, shown]);

  /** [더 보기] 단추를 누르면 실행돼요. 지금 편수(shown)가 곧 새로 나올 첫 리뷰의 번호라서 그 번호를 기억해 둬요. */
  function handleMore() {
    focusIndexRef.current = shown;
    setShown(shown + PAGE_SIZE);
  }

  /**
   * 조건 일부만 바꿔 알리는 도우미예요.
   * `{ q, category, sort, ...patch }`: 지금 조건에 바꿀 부분(patch)을 덮어써서 새 조건을 만들어요.
   * Partial<BrowseParams>는 "BrowseParams의 항목 중 일부만 있어도 된다"는 타입이에요.
   */
  const update = (patch: Partial<BrowseParams>) => onParamsChange({ q, category, sort, ...patch });

  /**
   * 검색창에서 Enter를 누르거나 "찾기" 단추를 누르면 실행돼요.
   *
   * @param event - 폼 제출 이벤트. `FormEvent<HTMLFormElement>`: <form>에서 일어난 이벤트라는 타입이에요.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // 폼의 기본 동작(페이지 새로 고침)을 막아요. 우리는 주소만 바꿀 거예요.
    event.preventDefault();
    // 앞뒤 공백을 지운 검색어로 조건을 바꿔요.
    update({ q: draft.trim() });
  }

  /** "검색 조건 지우기" 단추를 누르면 실행돼요. */
  function handleReset() {
    setDraft(""); // 검색창을 비우고
    onParamsChange({ ...DEFAULT_PARAMS, sort }); // 검색어·분류를 처음으로. 정렬은 보기 취향이라 그대로 둬요.
    // 누른 단추가 사라지므로, 키보드 사용자가 길을 잃지 않게 초점을 검색창으로 옮겨요.
    // `?.`는 inputRef.current가 비어 있으면 focus()를 부르지 않는다는 뜻이에요.
    inputRef.current?.focus();
  }

  // 목록 위 안내 문구. resultStatus는 "전체 15편" 또는 "15편 중 3편"을 돌려줘요(lib/browse.ts).
  // 아직 다 보여 주지 않았으면 " / 현재 10편 표시"를 붙여 지금 몇 편이 보이는지 알려 줘요(예: "전체 11편 / 현재 10편 표시").
  const status = `${resultStatus(reviews.length, results.length, params)}${hasMore ? ` / 현재 ${visible.length}편 표시` : ""}`;

  return (
    // 넓은 화면(lg, 1024px~)에서는 [검색 칸 | 작품 목록] 두 칸이에요. 검색 칸 너비는 16~18rem이에요.
    // 좁은 화면에서는 검색 칸 아래에 목록이 와요.
    // gap-10: 두 칸 사이 2.5rem, lg:gap-12: 넓은 화면에서는 3rem.
    <div className="grid gap-10 lg:grid-cols-[minmax(16rem,18rem)_minmax(0,1fr)] lg:gap-12">
      {/* <search>: "검색 영역"이라는 뜻의 HTML 태그예요. 화면 낭독기가 검색 랜드마크로 알려 줘요.
          browse-aside: 넓고 키가 충분한 화면에서 스크롤해도 왼쪽 위에 붙어 있게 해요(globals.css).
          aria-label: 눈에 보이는 제목이 없어서 짧은 이름을 붙여요.
          border-2 border-crt-line: 2px 테두리(선 색), px-4 py-5: 안쪽 여백, sm:px-6 lg:px-4: 화면 너비에 따라 가로 여백을 바꿔요. */}
      <search aria-label="리뷰 찾기" className="browse-aside border-2 border-crt-line px-4 py-5 sm:px-6 lg:px-4">
        {/* onSubmit: 폼 안에서 Enter를 누르거나 submit 단추를 누르면 handleSubmit이 실행돼요. */}
        <form onSubmit={handleSubmit} className="grid gap-5">
          {/* 검색 줄: 아래 분류·정렬 줄과 똑같이 "이름 칸(4rem) + 간격(gap-x-4) + 내용" 모양이라 세 줄이 가지런해요.
              넓은 화면의 좁은 검색 칸에서는 이름을 위로 올려요(lg:grid-cols-1). */}
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-[4rem_minmax(0,1fr)] lg:grid-cols-1">
            {/* <label htmlFor="...">: 이 글자가 어느 입력란의 이름인지 연결해요. 글자를 눌러도 입력란에 초점이 가요. */}
            <label htmlFor={`${id}-q`} className="glow sm:mt-2 lg:mt-0">
              검색
            </label>
            {/* 검색창과 [찾기] 단추를 한 줄에. 좁으면 [찾기]가 다음 줄로 내려가요(flex-wrap). */}
            <div className="flex flex-wrap items-start gap-2">
              {/* 검색창. 글자를 치는 동안에는 목록을 거르지 않고, Enter나 [찾기]를 누르면(폼 제출) 찾아요.
                  type="search": 휴대폰 자판에 "검색" 단추가 나오고, 검색 입력란이라는 뜻을 브라우저가 알아요.
                  ref={inputRef}: [검색 조건 지우기] 뒤에 이 칸으로 초점을 옮길 때 써요.
                  value + onChange: 입력란의 글자를 상태(draft)와 맞춰 두는 "제어 컴포넌트" 방식이에요.
                  field: 글쓰기 화면의 입력 칸과 같은 모양(globals.css).
                  flex-1 basis-40: 남는 너비를 쓰고, 좁으면 [찾기] 단추가 다음 줄로 내려가요(basis-40 = 기본 너비 10rem).
                  min-w-0 w-full: 입력 칸은 글꼴에 따라 정해지는 기본 너비가 있어서, 그대로 두면 좁은 화면에서 검색 영역 전체를 밀어 넓혀요.
                    퍼센트 너비(w-full)와 min-w-0을 주면 기본 너비를 요구하지 않고 남는 자리에 맞춰 줄어들어요. */}
              <input
                ref={inputRef}
                id={`${id}-q`}
                type="search"
                name="q"
                placeholder="검색어를 입력하세요"
                disabled={disabled}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="field w-full min-w-0 flex-1 basis-40 caret-crt-fg placeholder:text-crt-dim"
              />
              {/* type="submit": 폼을 제출하는 단추. 단추 이름은 "찾기"예요. */}
              {/* btn-inverse: 글자·바탕색을 뒤집은 단추(globals.css). shrink-0: 좁아져도 단추 너비를 줄이지 않아요. */}
              <button type="submit" disabled={disabled} className="btn-inverse shrink-0">
                찾기
              </button>
            </div>
          </div>

          {/* 분류 고르기: 라디오 단추 묶음. "전체" + 리뷰가 있는 분류들(영화, 도서) */}
          {/* disabled를 <fieldset>에 주면 그 안의 라디오 단추가 모두 사용할 수 없게 돼요(HTML 기본 기능). */}
          <ChoiceGroup legend="분류" layout="aside" disabled={disabled}>
            <Choice name="category" checked={category === null} onChange={() => update({ category: null })}>
              전체 <Count n={reviews.length} />
            </Choice>
            {/* map 안의 `{ category: value, count }`: 객체를 구조 분해하면서 category를 value라는 새 이름으로 꺼내요
                (바깥의 category 변수, 곧 지금 고른 분류와 이름이 부딪치지 않게요).
                key: React가 목록 항목을 구분하는 이름표예요. */}
            {categories.map(({ category: value, count }) => (
              <Choice key={value} name="category" checked={category === value} onChange={() => update({ category: value })}>
                {value} <Count n={count} />
              </Choice>
            ))}
          </ChoiceGroup>

          {/* 정렬 고르기 */}
          <ChoiceGroup legend="정렬" layout="aside" disabled={disabled}>
            {SORTS.map(({ value, label }) => (
              <Choice key={value} name="sort" checked={sort === value} onChange={() => update({ sort: value })}>
                {label}
              </Choice>
            ))}
          </ChoiceGroup>
        </form>
      </search>

      {/* 목록 구역. 이름은 아래 h2("작품 목록")로 정해요. min-w-0: 긴 제목이 칸을 밀어내지 않게 해요.
          text-mid: 목록 구역(제목 줄·리뷰·[더 보기])은 글자를 16px로 조금 키워 읽기 편하게 해요(globals.css). */}
      <section aria-labelledby={`${id}-list`} className="min-w-0 text-mid">
        {/* 제목 줄: "작품 목록 ······ 전체 15편". leader는 둘 사이를 잇는 점선(꾸밈이라 aria-hidden)이에요. */}
        <div className="flex items-center gap-3">
          <h2 id={`${id}-list`} className="glow shrink-0">
            작품 목록
          </h2>
          <span aria-hidden="true" className="leader" />
          {/* role="status": 안의 글자가 바뀌면 화면 낭독기가 하던 말을 끊지 않고 이어서 읽어 줘요.
              이 영역은 처음부터 화면에 두고 글자만 바꿔야 제대로 읽어 줘요.
              min-w-0 text-right: 안내가 길어지면 좁은 화면에서 넘치지 않고 줄을 바꿔요. */}
          <p role="status" className="min-w-0 text-right text-body">
            {status}
          </p>
        </div>

        {/* 결과가 있으면 목록(<ul>), 없으면 안내 상자를 보여 줘요. ref={listRef}: 위의 손잡이를 이 목록에 연결해요.
            순서가 뜻을 갖는 번호 목록이 아니라서 <ol> 대신 <ul>을 써요. 항목은 썸네일부터 시작해요. */}
        {/* `A ? B : C ? D : E`: 삼항 연산자를 이어 쓴 것. 결과가 있으면 B, 아니고 리뷰가 0편이면 D, 그 밖에는 E예요.
            mt-4: 위 여백 1rem, grid gap-8: 리뷰 사이 2rem(32px).
            리뷰 한 편(<article>)에는 안쪽 여백이 없어서, 리뷰 사이는 이 간격(<li> 사이) 하나로만 정해요(review-list-item.tsx). */}
        {results.length > 0 ? (
          <ul ref={listRef} className="mt-4 grid gap-8">
            {/* key={review.slug}: 파일 이름은 리뷰마다 달라서 이름표로 쓰기 좋아요. */}
            {visible.map((review) => (
              <ReviewListItem key={review.slug} review={review} />
            ))}
          </ul>
        ) : reviews.length === 0 ? (
          // 리뷰가 아직 한 편도 없을 때: 거른 결과가 아니라서 검색을 바꾸라는 안내는 하지 않아요.
          <div className="mt-4 border-2 border-dashed border-crt-line px-4 py-8 text-center">
            <p className="glow">아직 올린 리뷰가 없습니다.</p>
          </div>
        ) : (
          <div className="mt-4 border-2 border-dashed border-crt-line px-4 py-8 text-center">
            <p className="glow">찾는 리뷰가 없습니다.</p>
            {/* 오류 안내에는 "어떻게 하면 되는지"를 함께 적어요. */}
            <p className="mt-2 text-crt-dim">낱말을 줄이거나 분류를 ‘전체’로 바꿔 보세요.</p>
          </div>
        )}

        {/* 남은 리뷰가 있으면 "더 보기" 자리. 화면에 가까워지면 저절로 10편을 더 보여 주고(위의 IntersectionObserver),
            키보드·화면 낭독기 사용자는 단추로 직접 불러올 수 있어요. */}
        {hasMore && (
          <div ref={moreRef} className="mt-6">
            {/* Math.min(a, b): 둘 중 작은 수. 남은 리뷰가 10편보다 적으면 남은 수만큼만 "n편 더 보기"라고 적어요. */}
            <button type="button" onClick={handleMore} disabled={disabled} className="btn-line">
              {Math.min(PAGE_SIZE, results.length - shown)}편 더 보기
            </button>
          </div>
        )}

        {/* 거르고 있을 때만 "검색 조건 지우기" 단추를 보여요. type="button": 폼 제출 단추가 아니라는 뜻이에요. */}
        {filtered && (
          <button type="button" onClick={handleReset} className="btn-line mt-6">
            검색 조건 지우기
          </button>
        )}
      </section>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────
 * 3. 작은 조각
 * ────────────────────────────────────────────────────────────── */

/**
 * 칩에 붙는 편수(예: "영화 9편"의 "9편"). 보조 글자색으로 조금 흐리게 보여요.
 *
 * "편"까지 화면에 그대로 보여요. "편"만 화면 낭독기 전용 글자(sr-only)로 숨기면
 * 브라우저에 따라 숨긴 글자 앞뒤에 띄어쓰기를 넣어 "9 편"처럼 읽기도 하거든요.
 * 보이는 글자와 읽는 글자가 같으면 누구에게나 분명해요.
 * export가 없어 이 파일 안에서만 쓰는 작은 조각이에요.
 *
 * @param props.n - 편수
 * @returns "9편"처럼 숫자와 "편"을 담은 <span>
 *
 * @example
 * <Count n={9} /> // <span class="text-crt-dim">9편</span>
 */
function Count({ n }: { n: number }) {
  return <span className="text-crt-dim">{n}편</span>;
}
