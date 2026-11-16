/**
 * @file review-browser.tsx 테스트
 *
 * 나눠서 확인해요.
 *   1. ReviewBrowserView(화면): 조건을 직접 넣어, 검색·분류·정렬·빈 결과·조건 지우기가 잘 되는지
 *   2. 무한 스크롤(10편씩 보여 주기)과 [더 보기] 단추
 *   3. ReviewBrowser(주소 연결): 주소의 조건을 읽고, 조건이 바뀌면 주소를 바꾸는지
 *
 * 사용자 동작 흉내 내기(user-event)
 *   - const user = userEvent.setup() : 가상의 사용자를 만들어요.
 *   - await user.type(입력란, "글자")  : 글자를 한 자씩 쳐요.
 *   - await user.keyboard("{Enter}")  : Enter 키를 눌러요.
 *   - await user.click(요소)           : 요소를 눌러요.
 *   진짜 사람처럼 이벤트(키 누름, 포커스 등)를 차례로 일으켜서, fireEvent보다 실제 사용에 가까워요.
 *
 * 그 밖의 테스트 도구 문법
 *   - describe(이름, 함수): 관련 테스트 묶음, it(이름, 함수): 테스트 하나, expect(값).toXxx(): 확인
 *   - screen.getByRole(역할, { name }): 화면 낭독기와 같은 기준(역할 + 이름)으로 찾아요. queryBy…는 없으면 null, getAllBy…/queryAllBy…는 배열
 *   - within(요소): 그 요소 안에서만 찾아요.
 *   - vi.fn(): 불린 기록을 남기는 가짜 함수, vi.spyOn(객체, "이름"): 진짜 함수를 감싸 불린 기록만 엿봐요.
 *   - vi.mock("모듈", 공장 함수): 그 모듈을 가짜로 바꿔요. vi.hoisted(): vi.mock보다 먼저 준비해야 하는 값을 만들어요.
 *   - vi.stubGlobal("이름", 가짜): 전역 값(IntersectionObserver 등)을 바꿔 끼워요. vi.unstubAllGlobals()로 되돌려요.
 *   - act(함수): 화면을 바꾸는 일을 감싸, React가 다 그린 뒤에 확인하게 해요(userEvent는 알아서 감싸 줘요).
 *   - beforeEach / afterEach: 테스트마다 앞·뒤에 실행할 준비·정리
 *
 * 글쓴이 로그인은 쿠키(blog_admin=1)로 흉내 내요(components/use-is-admin.ts가 이 쿠키를 봐요).
 */

import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type BrowseParams, DEFAULT_PARAMS } from "@/lib/browse";
import type { Review } from "@/lib/review";
import { manyReviews, reviewMocks } from "@/test/review-mocks";

import { ReviewBrowser, ReviewBrowserView } from "./review-browser";

/* ── 가짜 next/navigation: 주소 조건을 우리가 정한 값으로 흉내 내요 ── */
// vi.mock은 파일 맨 위로 끌어올려져(hoisting) import보다 먼저 실행돼요. 그 안에서 쓸 값도 먼저 있어야 해서 vi.hoisted로 만들어요.
// navigation.search에 "category=book"처럼 넣으면, 아래 가짜 useSearchParams가 그 조건을 돌려줘요.
const navigation = vi.hoisted(() => ({ search: "" }));

/** 로그인 표시 쿠키를 지워요(로그아웃 상태). */
const logOut = () => {
  document.cookie = "blog_admin=; max-age=0; path=/";
};

// next/navigation의 진짜 내용을 모두 펼쳐 두고(...), useSearchParams만 가짜로 바꿔요.
// importOriginal<typeof import("next/navigation")>(): 진짜 모듈을 불러오되, 타입도 진짜와 같다고 알려 줘요.
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

/**
 * 주소 대신 useState로 조건을 들고 있는 시험용 부모 컴포넌트예요.
 * 화면(ReviewBrowserView)이 조건을 바꾸면 이 부모가 받아 다시 그려 줘요. 실제 앱에서 주소가 하는 일을 대신해요.
 */
function Harness({
  initial = DEFAULT_PARAMS,
  onChange,
  reviews = reviewMocks,
}: {
  initial?: BrowseParams;
  onChange?: (p: BrowseParams) => void;
  reviews?: Review[];
}) {
  // 조건을 상태로 들고 있다가, 화면이 바꾸면 onChange로 알리고(있을 때만, `?.()`), 상태를 바꿔 다시 그려요.
  const [params, setParams] = useState(initial);
  return (
    <ReviewBrowserView
      reviews={reviews}
      params={params}
      onParamsChange={(next) => {
        onChange?.(next);
        setParams(next);
      }}
    />
  );
}

/** 지금 목록에 보이는 리뷰 제목(h3)들. map으로 요소 배열을 글자 배열로 바꿔요. */
const listTitles = () => screen.queryAllByRole("heading", { level: 3 }).map((heading) => heading.textContent);
/** 검색창. <input type="search">의 역할은 searchbox이고, 이름은 label의 "검색"이에요. */
const searchBox = () => screen.getByRole("searchbox", { name: "검색" });
/** 결과 안내(role="status"). 목록 위의 편수 안내예요. selector로 role="status"인 요소 가운데 "편"이 든 것만 골라요. */
const status = () => screen.getByText(/편/, { selector: "[role='status']" });

describe("ReviewBrowserView (화면)", () => {
  it("정렬은 최신순·평점순 두 가지이고, 목록을 그리는 데 서버 요청을 하지 않는다", () => {
    // vi.spyOn(대상, "이름"): 진짜 함수는 그대로 두고, 불렸는지 엿볼 수 있게 감싸요.
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<Harness />);
    const sorts = screen.getByRole("group", { name: "정렬" });
    // 정렬 묶음 안의 라디오 단추들 → 감싼 <label>의 글자 → 꾸밈 ▶를 빼고 앞뒤 공백 정리 → 순서까지 같은지(toEqual) 확인해요.
    expect(within(sorts).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent?.replace("▶", "").trim())).toEqual([
      "최신순",
      "평점순",
    ]);
    // 처음 순서는 최신순이에요.
    expect(listTitles()).toEqual(["겨울 정류장", "화성 세탁소", "필름이 끊기기 전에", "8비트 영웅전"]);
    // 목록은 빌드할 때 받은 데이터만으로 그려서 서버에 묻지 않아요.
    expect(fetchSpy).not.toHaveBeenCalled();
    // 감쌌던 fetch를 원래대로 되돌려요.
    fetchSpy.mockRestore();
  });


  it("처음에는 모든 리뷰를 최근에 쓴 글부터 보이고, 전체 편수를 알린다", () => {
    render(<Harness />);
    expect(listTitles()).toEqual(["겨울 정류장", "화성 세탁소", "필름이 끊기기 전에", "8비트 영웅전"]);
    expect(status()).toHaveTextContent("전체 4편");
  });

  it("검색어는 Enter를 눌러야 적용한다", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await user.type(searchBox(), "겨울");
    // 아직 Enter를 누르지 않았으니 목록은 그대로 4편
    expect(listTitles()).toHaveLength(4);

    // Enter를 누르면(폼 제출) 친 글자로 찾아요.
    await user.keyboard("{Enter}");
    // toHaveBeenLastCalledWith: 가짜 함수가 마지막으로 이 값으로 불렸는지 확인해요.
    expect(onChange).toHaveBeenLastCalledWith({ q: "겨울", category: null, sort: "latest" });
    expect(listTitles()).toEqual(["겨울 정류장"]);
    expect(status()).toHaveTextContent("4편 중 1편");
  });

  it("찾기 단추로도 검색하고, 앞뒤 공백은 지운다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(searchBox(), "  한서윤  ");
    await user.click(screen.getByRole("button", { name: "찾기" }));
    expect(listTitles()).toEqual(["겨울 정류장"]);
  });

  it("검색 안내는 입력란 안의 placeholder로 보이고, 찾기 단추에는 아이콘이 없다", () => {
    render(<Harness />);
    expect(searchBox()).toHaveAttribute("placeholder", "검색어를 입력하세요");
    expect(screen.getByRole("button", { name: "찾기" }).querySelector("svg")).not.toBeInTheDocument();
    // 검색 이름 옆의 꺾쇠(>) 꾸밈도 없어요.
    expect(screen.getByText("검색", { selector: "label" })).toHaveTextContent(/^검색$/);
  });

  it("분류는 고르는 즉시 거른다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    // within(묶음): 그 묶음 안에서만 찾아요. fieldset의 역할은 "group", 이름은 legend의 "분류"예요.
    const category = screen.getByRole("group", { name: "분류" });
    // 라디오 단추 이름은 칩에 보이는 글자 그대로 "영화 2편"이에요(꾸밈 ▶는 빠져요).
    await user.click(within(category).getByRole("radio", { name: "영화 2편" }));
    expect(listTitles()).toEqual(["겨울 정류장", "필름이 끊기기 전에"]);
    expect(within(category).getByRole("radio", { name: "영화 2편" })).toBeChecked();
    // 도서를 고르면 도서만 남아요.
    await user.click(within(category).getByRole("radio", { name: "도서 2편" }));
    expect(listTitles()).toEqual(["화성 세탁소", "8비트 영웅전"]);
  });

  it("평점순으로 정렬한다", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "평점순" }));
    expect(listTitles()).toEqual(["필름이 끊기기 전에", "겨울 정류장", "화성 세탁소", "8비트 영웅전"]);
  });

  it("찾는 리뷰가 없으면 알리고, 조건을 지우면 검색란으로 초점을 옮긴다", async () => {
    const user = userEvent.setup();
    render(<Harness initial={{ q: "없는 영화", category: null, sort: "rating" }} />);

    expect(screen.getByText("찾는 리뷰가 없습니다.")).toBeInTheDocument();
    expect(status()).toHaveTextContent("4편 중 0편");

    await user.click(screen.getByRole("button", { name: "검색 조건 지우기" }));

    expect(listTitles()).toHaveLength(4);
    expect(searchBox()).toHaveValue("");
    // toHaveFocus: 지금 키보드 초점이 이 요소에 있는지 확인해요.
    expect(searchBox()).toHaveFocus();
    // 정렬은 보기 취향이라 그대로 남아요.
    expect(screen.getByRole("radio", { name: "평점순" })).toBeChecked();
    // 거르는 조건이 없으니 지우기 단추도 사라져요.
    expect(screen.queryByRole("button", { name: "검색 조건 지우기" })).not.toBeInTheDocument();
  });

  it("주소의 검색어가 바뀌면(뒤로 가기) 입력란도 맞춘다", () => {
    // rerender: 같은 컴포넌트를 새 값으로 다시 그려요. 부모가 새 조건을 넘긴 상황을 흉내 내요.
    const { rerender } = render(<ReviewBrowserView reviews={reviewMocks} params={DEFAULT_PARAMS} onParamsChange={() => {}} />);
    rerender(<ReviewBrowserView reviews={reviewMocks} params={{ ...DEFAULT_PARAMS, q: "화성" }} onParamsChange={() => {}} />);
    expect(searchBox()).toHaveValue("화성");
  });

  it("검색 영역과 '작품 목록' 구역에 이름이 있고, 목록은 번호 없는 목록(ul)이다", () => {
    const { container } = render(<Harness />);
    // <search> 태그는 브라우저에서 "검색" 역할을 갖지만, 테스트 도구(jsdom)는 아직 이 태그의 역할을 몰라요.
    // 그래서 여기서는 태그로 찾아 이름만 확인하고, 역할은 실제 브라우저로 도는 E2E(e2e/blog.spec.ts)에서 확인해요.
    expect(container.querySelector("search")).toHaveAttribute("aria-label", "리뷰 찾기");
    // aria-labelledby로 이름을 붙인 <section>은 "region" 역할이 돼요.
    const region = screen.getByRole("region", { name: "작품 목록" });
    expect(region.querySelector("ul")).toBeInTheDocument();
    expect(region.querySelector("ol")).not.toBeInTheDocument();
  });

  it("리뷰 사이는 목록(ul)의 간격 32px(gap-8) 하나로만 띄운다(<li>에는 여백을 따로 두지 않는다)", () => {
    render(<Harness />);
    const list = screen.getByRole("region", { name: "작품 목록" }).querySelector("ul")!;
    expect(list).toHaveClass("grid", "gap-8");
    // 실제 간격(px)은 CSS를 읽는 진짜 브라우저 E2E(e2e/blog.spec.ts)에서 재요. 여기서는 <li>에 클래스가 없는지만 봐요.
    for (const item of list.querySelectorAll(":scope > li")) expect(item).not.toHaveAttribute("class");
  });
});

describe("ReviewBrowserView (무한 스크롤)", () => {
  /** 23편: 처음 10편 → 20편 → 23편으로 늘어나요. */
  const reviews = manyReviews(23);

  afterEach(() => {
    logOut();
  });

  it("처음에는 10편만 보이고, 몇 편이 보이는지 알린다", () => {
    render(<Harness reviews={reviews} />);
    expect(listTitles()).toHaveLength(10);
    expect(status()).toHaveTextContent("전체 23편 / 현재 10편 표시");
  });

  it("[더 보기]를 누르면 10편씩 더 보이고, 새로 나온 첫 리뷰로 초점을 옮긴다", async () => {
    const user = userEvent.setup();
    render(<Harness reviews={reviews} />);

    await user.click(screen.getByRole("button", { name: "10편 더 보기" }));
    expect(listTitles()).toHaveLength(20);
    // 11번째 리뷰(새로 나온 첫 리뷰)에 초점이 가요. 키보드 사용자가 이어서 읽을 수 있어요.
    // 제목은 링크가 아니라서, 리뷰 한 편(article, tabIndex -1)으로 초점을 옮겨요.
    expect(document.activeElement).toHaveTextContent("시험 영화 11");
    expect(document.activeElement?.tagName).toBe("ARTICLE");

    // 남은 것은 3편이라 단추 글자도 3편이에요.
    await user.click(screen.getByRole("button", { name: "3편 더 보기" }));
    expect(listTitles()).toHaveLength(23);
    // 다 보였으면 단추가 사라지고, 안내도 "전체 23편"만 남아요.
    expect(screen.queryByRole("button", { name: /더 보기/ })).not.toBeInTheDocument();
    expect(status()).toHaveTextContent(/^전체 23편$/);
  });

  it("글쓴이의 목록([수정] 링크가 있어요)에서도 [더 보기]를 누르면 [수정]이 아니라 새로 나온 첫 리뷰(article)로 초점을 옮긴다", async () => {
    document.cookie = "blog_admin=1; path=/";
    const user = userEvent.setup();
    render(<Harness reviews={reviews} />);
    await user.click(screen.getByRole("button", { name: "10편 더 보기" }));
    expect(document.activeElement).toBe(screen.getByRole("article", { name: "시험 영화 11" }));
  });

  it("목록 끝의 '더 보기' 자리가 화면에 가까워지면 저절로 10편을 더 보인다", () => {
    // jsdom에는 IntersectionObserver가 없어서, 우리가 부를 때 "보여요"라고 알려 주는 가짜를 넣어요.
    // 가짜 클래스는 만들어질 때 받은 callback을 notify에 담아 두고, 테스트가 notify(...)를 불러 "화면에 들어왔다"고 알려요.
    let notify: (entries: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof notify) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      },
    );

    render(<Harness reviews={reviews} />);
    expect(listTitles()).toHaveLength(10);
    // act: 화면을 바꾸는 일을 감싸서, React가 다 그린 뒤에 확인하게 해요.
    act(() => notify([{ isIntersecting: true }]));
    expect(listTitles()).toHaveLength(20);

    vi.unstubAllGlobals();
  });

  it("[더 보기]에 키보드 초점이 있는 채로 저절로 불러오면, 초점을 잃지 않고 새로 나온 첫 리뷰로 옮긴다", () => {
    let notify: (entries: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(callback: typeof notify) {
          notify = callback;
        }
        observe() {}
        disconnect() {}
      },
    );

    render(<Harness reviews={reviews} />);
    // Tab으로 단추에 온 상황: 단추에 초점이 있고, 화면이 단추까지 스크롤되어 "보여요" 알림이 와요.
    screen.getByRole("button", { name: "10편 더 보기" }).focus();
    act(() => notify([{ isIntersecting: true }]));
    expect(listTitles()).toHaveLength(20);
    expect(document.activeElement).toHaveTextContent("시험 영화 11");

    vi.unstubAllGlobals();
  });

  it("조건(정렬 등)을 바꾸면 다시 처음 10편부터 보인다", async () => {
    const user = userEvent.setup();
    render(<Harness reviews={reviews} />);
    await user.click(screen.getByRole("button", { name: "10편 더 보기" }));
    expect(listTitles()).toHaveLength(20);

    await user.click(screen.getByRole("radio", { name: "평점순" }));
    expect(listTitles()).toHaveLength(10);
  });
});

describe("ReviewBrowserView (미리 만든 HTML)", () => {
  it("interactive={false}면 검색창·단추·라디오 단추를 누를 수 없게 그린다", () => {
    render(<ReviewBrowserView reviews={reviewMocks} params={DEFAULT_PARAMS} onParamsChange={() => {}} interactive={false} />);
    expect(searchBox()).toBeDisabled();
    expect(screen.getByRole("button", { name: "찾기" })).toBeDisabled();
    expect(screen.getByRole("radio", { name: "최신순" })).toBeDisabled();
    // 목록은 그대로 보여요(검색엔진과 스크립트 없는 환경을 위해).
    expect(listTitles()).toHaveLength(4);
  });

  it("10편이 넘어도 모두 담고 [더 보기]는 두지 않는다(스크립트가 없으면 더 불러올 수 없어서)", () => {
    const reviews = manyReviews(15);
    render(<ReviewBrowserView reviews={reviews} params={DEFAULT_PARAMS} onParamsChange={() => {}} interactive={false} />);
    expect(listTitles()).toHaveLength(15);
    // toBeNull(): 값이 null인지 확인해요. queryBy…는 못 찾으면 null을 돌려줘요.
    expect(screen.queryByRole("button", { name: /더 보기/ })).toBeNull();
  });
});

describe("ReviewBrowser (주소 연결)", () => {
  beforeEach(() => {
    navigation.search = "";
    // vi.spyOn(객체, "함수 이름"): 진짜 함수를 그대로 쓰면서, 불렸는지·무엇으로 불렸는지 기록해요.
    vi.spyOn(window.history, "replaceState");
  });

  // 테스트마다 spyOn을 원래대로 되돌려요.
  afterEach(() => vi.restoreAllMocks());

  it("주소의 조건으로 목록을 거른다(분류는 영어 이름, 한글 주소도 받는다)", () => {
    navigation.search = "category=book";
    render(<ReviewBrowser reviews={reviewMocks} />);
    expect(listTitles()).toEqual(["화성 세탁소", "8비트 영웅전"]);
    expect(screen.getByRole("radio", { name: "도서 2편" })).toBeChecked();
  });

  it("조건을 바꾸면 화면을 바로 바꾸고, 방문 기록을 쌓지 않고(replaceState) 주소를 바꾼다", async () => {
    const user = userEvent.setup();
    render(<ReviewBrowser reviews={reviewMocks} />);
    await user.click(screen.getByRole("radio", { name: "평점순" }));
    // 화면은 기다리지 않고 바로 바뀌어요.
    expect(screen.getByRole("radio", { name: "평점순" })).toBeChecked();
    // 주소: 지금 경로(/) 뒤에 조건을 붙여요.
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, "", "/?sort=rating");
  });

  it("조건을 모두 지우면 조건 없는 주소로 돌아간다", async () => {
    const user = userEvent.setup();
    navigation.search = "q=%ED%99%94%EC%84%B1"; // q=화성
    render(<ReviewBrowser reviews={reviewMocks} />);
    await user.click(screen.getByRole("button", { name: "검색 조건 지우기" }));
    expect(window.history.replaceState).toHaveBeenLastCalledWith(null, "", "/");
    expect(listTitles()).toHaveLength(4);
  });

  it("주소가 바깥에서 바뀌면(링크로 이동) 화면 조건도 주소에 맞춘다", () => {
    // encodeURIComponent: 한글을 주소에 쓸 수 있는 모양(%EB%8F%84…)으로 바꿔요. 한글 분류 주소도 받는지 함께 봐요.
    navigation.search = `category=${encodeURIComponent("도서")}`;
    const { rerender } = render(<ReviewBrowser reviews={reviewMocks} />);
    // 머리글의 블로그 이름을 눌러 "/"로 간 상황: 주소 조건이 비었어요.
    navigation.search = "";
    rerender(<ReviewBrowser reviews={reviewMocks} />);
    expect(listTitles()).toHaveLength(4);
    expect(screen.getByRole("radio", { name: "전체 4편" })).toBeChecked();
  });
});
