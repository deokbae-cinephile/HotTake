/**
 * @file review-list-item.tsx 테스트
 *
 * 무엇을 확인하나요?
 *   - 리뷰 한 편이 제목 이름의 <article>이고, 제목은 링크 없는 <h3>인지
 *   - 둘째 줄(연도·감독 또는 작가), 평점 두 자리, 한 줄 평이 약속한 자리와 모양으로 놓이는지
 *   - 이미지가 꾸밈(alt="")이고, 없으면 기본 이미지를 그리는지
 *   - 글쓴이에게만 수정·삭제 단추가 두 자리에 보이고, 지우면 단추를 치우고 안내로 초점을 옮기는지
 *
 * <li>는 목록(<ul>, <ol>) 안에서만 쓸 수 있는 태그라, 테스트에서도 <ul>로 감싸 그려요(HTML 규칙 지키기).
 * 글쓴이 로그인은 쿠키(blog_admin=1)로 흉내 내요(components/use-is-admin.ts가 이 쿠키를 봐요).
 * jsdom(가짜 브라우저)은 CSS를 읽지 않아서, 화면 너비에 따라 숨기는 것은 클래스 이름으로 확인해요.
 *
 * 테스트 도구 문법
 *   - getBy…: 요소가 꼭 하나 있어야 해요(없거나 여러 개면 실패). getAllBy…: 하나 이상을 배열로 돌려줘요.
 *   - queryBy…: 없으면 실패하지 않고 null을 돌려줘요. "없어야 한다"를 확인할 때 써요(.not.toBeInTheDocument()).
 *   - within(요소): 그 요소 안에서만 찾아요.
 *   - container.querySelector("css 선택자"): 역할로 찾기 어려운 요소를 CSS 선택자로 직접 찾아요.
 *   - userEvent.setup() → user.click(요소): 실제 사용자처럼 눌러요(await로 기다려요).
 *   - vi.stubGlobal("fetch", 가짜): 서버 요청을 가짜 답으로 바꿔요. vi.unstubAllGlobals()로 되돌려요.
 *   - vi.waitFor(함수): 안의 확인이 통과할 때까지 잠시 되풀이해요.
 *   - `값!`(느낌표): "이 값은 null·undefined가 아니다"라고 TypeScript에 알려 주는 표시(non-null 단언)예요.
 *   - `?.`: 앞의 값이 없으면 멈추고 undefined를 돌려줘요(옵셔널 체이닝).
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { reviewMocks } from "@/test/review-mocks";

import { ReviewListItem } from "./review-list-item";

// reviewMocks: 테스트용 가짜 리뷰 목록(src/test/review-mocks.ts).
// 가짜 리뷰 중 첫 번째(겨울 정류장)와 네 번째(8비트 영웅전)를 써요. 빈칸(, ,)은 건너뛴다는 뜻이에요.
const [winter, , , legend] = reviewMocks;

/** <ul>로 감싸 리뷰 항목 하나를 그리는 도우미. `review = winter!`: 넘기지 않으면 겨울 정류장을 써요(기본값). */
const renderItem = (review = winter!) =>
  render(
    <ul>
      <ReviewListItem review={review} />
    </ul>,
  );

describe("ReviewListItem", () => {
  // 테스트마다 로그인 쿠키를 지워요(max-age=0: 바로 만료). 다음 테스트가 방문자로 시작하게요.
  afterEach(() => {
    document.cookie = "blog_admin=; max-age=0; path=/";
  });

  it("제목은 링크가 아닌 글자(h3)이고, 리뷰 한 편은 제목 이름의 article이다", () => {
    renderItem();
    // 방문자에게는 링크가 하나도 없어요(누를 곳이 없는 "한 줄 평" 목록이에요).
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "겨울 정류장" })).toBeInTheDocument();
    const article = screen.getByRole("article", { name: "겨울 정류장" });
    // [더 보기]로 불러온 뒤 코드로 초점을 옮길 수 있게 tabIndex -1이에요(Tab 순서에는 없어요).
    expect(article).toHaveAttribute("tabindex", "-1");
  });

  it("둘째 줄에는 연도·감독 또는 작가 이름만(이름표 없이) 두 줄까지 보이고, 분류·쓴 날은 보이지 않는다. 숫자 평점과 맨 아래 한 줄 평을 보인다", () => {
    renderItem();
    // 감독 또는 작가는 이름표 없이 이름만 둬요. 분류 태그는 두지 않아요.
    const facts = screen.getByText("2024 · 한서윤");
    expect(screen.queryByText(/감독/)).not.toBeInTheDocument();
    // 길면 두 줄까지만 보이고 끝을 "…"로 줄여요(line-clamp-2).
    expect(facts).toHaveClass("line-clamp-2");
    expect(screen.queryByText("[")).not.toBeInTheDocument();
    // 쓴 날(2026-11-08)은 최신순 정렬에만 쓰고 화면에는 보이지 않아요.
    expect(screen.queryByText(/2026/)).not.toBeInTheDocument();
    // 평점은 별 그림 없이 숫자만 보이고, 화면 낭독기에는 무엇의 숫자인지 알려 줘요.
    // 눈에 보이는 "4.5"는 aria-hidden으로 숨기고, 화면 낭독기는 대신 sr-only 문장을 읽어요(components/rating.tsx).
    // 평점은 두 자리에 그려져서 getAllByText로 여러 개를 받아요.
    expect(screen.getAllByText("4.5")[0]).toHaveAttribute("aria-hidden", "true");
    expect(screen.getAllByText("평점 5점 만점에 4.5점").length).toBeGreaterThan(0);
    expect(screen.getByText(/버스는 오지 않아도/)).toHaveTextContent("한 줄 평: “버스는 오지 않아도, 기다림은 끝내 도착한다.”");
  });

  it("평점은 넓은 화면에서 첫째 줄 오른쪽 끝, 휴대폰에서는 이미지 아래에 하나씩 둔다(화면 너비에 맞는 하나만 보인다)", () => {
    const { container } = renderItem();
    // 화면 낭독기용 문장(sr-only)의 부모가 평점 요소 하나예요. map으로 두 자리의 평점 요소를 모아요.
    const ratings = screen.getAllByText("평점 5점 만점에 4.5점").map((sr) => sr.parentElement!);
    expect(ratings).toHaveLength(2);
    const [underImage, firstLine] = ratings as [HTMLElement, HTMLElement];
    // 휴대폰용: 이미지 바로 아래(같은 왼쪽 칸), 640px 이상에서는 숨겨요.
    expect(underImage).toHaveClass("sm:hidden");
    expect(underImage.previousElementSibling).toHaveClass("image-frame");
    // 넓은 화면용: 제목과 같은 첫째 줄 오른쪽 끝, 640px보다 좁으면 숨겨요.
    expect(firstLine).toHaveClass("max-sm:hidden", "ml-auto");
    expect(firstLine.parentElement).toContainElement(screen.getByRole("heading", { level: 3 }));
    // 휴대폰용 평점은 article의 첫 칸(왼쪽 칸) 안에 있어요.
    expect(container.querySelector("article")?.firstElementChild).toContainElement(underImage);
  });


  it("이미지 썸네일은 제목과 같은 말이라 꾸밈(alt=\"\")으로 그린다(원고의 파일 이름을 /images/ 주소로 바꿔요)", () => {
    const { container } = renderItem();
    // 그림 주소는 Next.js 이미지 최적화 주소 안에 인코딩되어 들어가서, encodeURIComponent로 같은 모양을 만들어 비교해요.
    expect(container.querySelector("img")?.getAttribute("src")).toContain(encodeURIComponent("/images/winter-stop.jpg"));
    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("이미지가 없으면 기본 이미지(픽셀 그림)를 그린다", () => {
    // legend(8비트 영웅전)는 원고에 이미지가 없는 가짜 리뷰예요. <img> 대신 액자 안의 픽셀 그림(<svg>)이 그려져야 해요.
    const { container } = renderItem(legend!);
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector(".image-frame svg")).toBeInTheDocument();
  });

  it("앞에 '-'나 번호 없이 썸네일부터 시작하고, 한 줄 평은 넓은 화면·휴대폰 모두 둘째 줄 아래 8px에 이어 놓인다", () => {
    const { container } = renderItem();
    expect(screen.queryByText("-")).not.toBeInTheDocument();
    expect(screen.queryByText("01")).not.toBeInTheDocument();
    // article의 첫 칸(왼쪽 칸)이 썸네일(이미지 상자)부터 시작해요.
    expect(container.querySelector("article")?.firstElementChild?.firstElementChild).toHaveClass("image-frame");
    // 한 줄 평은 "한 줄 평 줄"(한 줄 평 + 글쓴이의 아이콘 단추) 안에 있어요.
    // closest("p"): 위로 올라가며 가장 가까운 <p>를 찾아요. 그 부모가 한 줄 평 줄이에요.
    const row = screen.getByText(/버스는 오지 않아도/).closest("p")!.parentElement!;
    // 둘째 줄 아래 8px(mt-2)에 이어 놓여요. 글 칸 맨 아래(썸네일 아래 끝)로 밀어 내리지 않아요(mt-auto 없음).
    expect(row).toHaveClass("mt-2");
    // (not.toHaveClass에 여러 개를 함께 넣으면 모두 있을 때만 실패해서, 하나씩 따로 확인해요.)
    for (const name of ["mt-auto", "sm:mt-auto", "mt-1"]) expect(row).not.toHaveClass(name);
  });

  it("리뷰 한 편(article)에는 안쪽 여백(padding)이 없다(리뷰 사이는 목록의 간격으로만 띄운다)", () => {
    const { container } = renderItem();
    const article = container.querySelector("article")!;
    // p-, px-, py-, pt-, pr-, pb-, pl-(sm:px-3 같은 화면 너비별 클래스 포함)로 시작하는 클래스가 하나도 없어야 해요.
    // classList: 요소의 클래스 목록. [...]로 펼쳐 배열로 만든 뒤 filter로 안쪽 여백 클래스만 골라요.
    const paddings = [...article.classList].filter((name) => /^([a-z]+:)*p[xytrbl]?-/.test(name));
    expect(paddings).toEqual([]);
  });

  it("글쓴이로 로그인하면 수정·삭제 아이콘 단추를 넓은 화면은 한 줄 평 줄 끝에, 휴대폰은 오른쪽 단추 칸에 둔다(방문자에게는 없다)", () => {
    // `container: guest`: 구조 분해하면서 이름을 guest로 바꿔 꺼내요(아래에서 다시 그릴 container와 헷갈리지 않게요).
    const { container: guest, unmount } = renderItem();
    expect(screen.queryByRole("link", { name: /수정$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /삭제$/ })).not.toBeInTheDocument();
    // 방문자의 휴대폰 목록은 [이미지 | 글자] 두 칸이에요.
    expect(guest.querySelector("article")).toHaveClass("grid-cols-[3.5rem_minmax(0,1fr)]");
    unmount();

    document.cookie = "blog_admin=1; path=/";
    const { container } = renderItem();
    const article = container.querySelector("article")!;
    // 휴대폰은 맨 오른쪽에 단추 칸(2.75rem = 44px)을 하나 더 둬요. 넓은 화면은 두 칸 그대로예요.
    expect(article).toHaveClass("grid-cols-[3.5rem_minmax(0,1fr)_2.75rem]", "sm:grid-cols-[4.375rem_minmax(0,1fr)]");
    // jsdom은 CSS를 읽지 않아 두 자리가 모두 그려져요(실제 화면에서는 너비에 맞는 하나만 보여요).
    const edits = within(article).getAllByRole("link", { name: "겨울 정류장 리뷰 수정" });
    expect(edits).toHaveLength(2);
    for (const edit of edits) expect(edit).toHaveAttribute("href", "/write/winter-stop");
    expect(within(article).getAllByRole("button", { name: "겨울 정류장 리뷰 삭제" })).toHaveLength(2);
    // 넓은 화면용: 한 줄 평 바로 다음(같은 줄의 끝, 아래 끝 맞춤)
    const oneLiner = screen.getByText(/버스는 오지 않아도/).closest("p")!;
    expect(oneLiner.nextElementSibling).toHaveClass("max-sm:hidden");
    expect(oneLiner.nextElementSibling).toContainElement(edits[0]!);
    expect(oneLiner.parentElement).toHaveClass("flex", "items-center");
    // 휴대폰용: article의 맨 끝 칸(오른쪽 단추 칸), [수정] 위·[삭제] 아래
    const phone = article.lastElementChild!;
    expect(phone).toHaveClass("flex-col", "sm:hidden");
    expect(phone).toContainElement(edits[1]!);
    // (삭제 확인 창 <dialog>도 같은 묶음 안에 있지만 닫혀 있어 보이지 않아요. 단추만 순서대로 봐요.)
    // ":scope > a": 이 요소의 바로 아래 자식 <a>만 골라요. 글자만 뽑아 순서까지 같은지(toEqual) 확인해요.
    expect([...phone.querySelectorAll(":scope > a, :scope > button")].map((control) => control.textContent)).toEqual([
      "겨울 정류장 리뷰 수정",
      "겨울 정류장 리뷰 삭제",
    ]);
  });

  it("목록 한 편에서 지우면 두 자리의 단추를 모두 치우고(오른쪽 단추 칸도 없앰), 한 줄 평 아래 안내로 초점을 옮긴다", async () => {
    document.cookie = "blog_admin=1; path=/";
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ title: "겨울 정류장", commitSha: "c" }), { status: 200 })));
    const user = userEvent.setup();
    const { container } = renderItem();
    const article = container.querySelector("article")!;
    // 안내 칸은 처음부터 있고 비어 있어요(글자만 바꿔야 화면 낭독기가 읽어요).
    // at(-1): 배열의 맨 끝 항목. article 안의 안내 칸 중 맨 마지막이 한 줄 평 아래의 삭제 안내예요.
    const status = within(article).getAllByRole("status").at(-1)!;
    expect(status).toBeEmptyDOMElement();

    // 넓은 화면용 휴지통 → 확인 창의 [삭제](열린 창 하나만 읽혀요)
    await user.click(within(article).getAllByRole("button", { name: "겨울 정류장 리뷰 삭제" })[0]!);
    await user.click(screen.getByRole("button", { name: "삭제" }));

    // 삭제를 마치면 누른 단추가 사라지므로, 초점이 안내 칸으로 옮겨질 때까지 기다려요.
    await vi.waitFor(() => expect(status).toHaveFocus());
    expect(status).toHaveTextContent("‘겨울 정류장’ 리뷰를 삭제했습니다. 블로그를 다시 배포하면(몇 분 뒤) 목록에서도 사라집니다.");
    // 안내는 한 줄 평 아래(글자 칸 안)에 있어요.
    const oneLiner = screen.getByText(/버스는 오지 않아도/).closest("p")!;
    expect(oneLiner.parentElement!.nextElementSibling).toBe(status);
    // 두 자리의 단추를 모두 치우고, 휴대폰의 오른쪽 단추 칸도 없애요.
    expect(within(article).queryByRole("link", { name: /수정$/ })).not.toBeInTheDocument();
    expect(within(article).queryByRole("button", { name: /삭제$/ })).not.toBeInTheDocument();
    expect(article).toHaveClass("grid-cols-[3.5rem_minmax(0,1fr)]");
    // 바꿔 끼운 fetch를 되돌려요(다음 테스트에 새지 않게요).
    vi.unstubAllGlobals();
  });
});
