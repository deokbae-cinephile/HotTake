/**
 * @file review-writer.tsx 테스트
 *
 * 리뷰 라이터(추가·수정 폼)를 사용자처럼 써 보며 확인해요.
 *   - 틀린 칸이 있으면 칸마다 오류를 달고 가장 위의 틀린 칸으로 스크롤해 초점을 옮기는지("고칠 곳" 목록은 없어요)
 *   - 화면 모양: [이미지 | 콘텐츠 정보], 분류(영화·도서) 고르기, 단추 오른쪽 정렬
 *   - 저장: 이미지를 먼저 올리고, 그 번호와 함께 리뷰를 저장하는지(두 번 눌러도 한 번만)
 *   - 수정: 처음 원고 sha와 함께 PUT으로 저장하는지(화면에 칸이 없는 글 쓴 날은 그대로)
 *   - 칸 이름에 [필수] 표시가 없고 꼭 적어야 하는 칸에는 required만 다는지
 *
 * 서버 대신 fetch를 가짜로 바꿔 답을 정해요. jsdom에는 사진 미리보기 주소(URL.createObjectURL)가 없어서 흉내 내요.
 *
 * 테스트 도구 문법
 *   - render(JSX): 가짜 브라우저(jsdom)에 그려요. screen.getByRole / getByLabelText / getByText로 요소를 찾아요.
 *       getByLabelText(/^제목$/): 이름표(label) 글자로 입력 칸을 찾아요. /^…$/는 "정확히 …"라는 정규 표현식이에요.
 *       findBy…: 나타날 때까지 잠시 기다렸다 찾아요(await와 함께). queryBy…: 없으면 null(없음을 확인할 때)
 *   - within(요소): 그 요소 안에서만 찾아요.
 *   - userEvent: user.type(칸, 글자) 글자 치기, user.click 누르기, user.dblClick 두 번 누르기,
 *       user.selectOptions(고르기 칸, 값) 고르기, user.upload(파일 칸, File) 파일 고르기, user.clear(칸) 지우기
 *   - vi.fn(): 기록하는 가짜 함수, vi.mocked(fetch).mock.calls: 가짜 fetch가 받은 [주소, 설정] 목록
 *   - vi.stubGlobal / vi.unstubAllGlobals: 전역 fetch를 가짜로 바꾸고 되돌려요.
 *   - vi.waitFor(함수): 안의 확인이 통과할 때까지 잠시 되풀이해요.
 *   - beforeEach / afterEach: 테스트마다 앞에서 준비, 뒤에서 정리
 *   - toHaveAccessibleDescription(글자): aria-describedby로 이어진 설명이 그 글자인지 확인해요.
 *   - toMatchObject({ ... }): 적은 항목만 같으면 통과(다른 항목은 있어도 돼요). toEqual은 전부 같아야 해요.
 */

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseReviewFile } from "@/lib/review-file";

import { type EditSource, ReviewWriter } from "./review-writer";

/**
 * 가짜 서버: 주소마다 답을 정하고, 받은 요청을 기록해요.
 * gate를 주면 리뷰 저장 답을 그 약속(Promise)이 풀릴 때까지 미뤄요(서버가 시간이 걸리는 상황).
 *
 * @param reviewAnswer - 리뷰 저장 API의 답(상태 번호와 본문). 기본은 201(만들었음)
 * @param gate - 이 Promise가 풀려야 리뷰 저장 답을 보내요. 기본은 곧바로 풀린 Promise
 */
function fakeServer(
  reviewAnswer: { status: number; body: unknown } = { status: 201, body: { slug: "winter-stop", commitSha: "c" } },
  gate: Promise<void> = Promise.resolve(),
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit) => {
      // 이미지 올리기 요청이면, 받은 경로(path)와 가짜 내용 번호(f 40개)를 바로 돌려줘요.
      if (url === "/api/images") {
        const form = init.body as FormData;
        return new Response(JSON.stringify({ path: form.get("path"), sha: "f".repeat(40) }), { status: 200 });
      }
      await gate;
      return new Response(JSON.stringify(reviewAnswer.body), { status: reviewAnswer.status });
    }),
  );
}

/**
 * fetch가 받은 요청 중 주소가 맞는 것들
 * vi.mocked(fetch): fetch를 가짜 함수 타입으로 다루게 해 줘요. mock.calls는 불릴 때마다 받은 인자 배열의 목록이에요.
 */
const callsTo = (url: string) => vi.mocked(fetch).mock.calls.filter(([called]) => called === url);

/**
 * 꼭 필요한 칸을 모두 채워요.
 * `ReturnType<typeof userEvent.setup>`: userEvent.setup()이 돌려주는 값의 타입(가상 사용자)이에요.
 */
async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/파일 이름$/), "winter-stop");
  await user.type(screen.getByLabelText(/^제목$/), "겨울 정류장");
  await user.type(screen.getByLabelText(/연도$/), "2024");
  await user.type(screen.getByLabelText(/감독 또는 작가$/), "한서윤");
  await user.click(screen.getByRole("radio", { name: "영화" }));
  await user.selectOptions(screen.getByLabelText(/평점$/), "4.5");
  await user.type(screen.getByLabelText(/한 줄 평$/), "기다림은 끝내 도착한다.");
}

describe("ReviewWriter(리뷰 추가)", () => {
  beforeEach(() => {
    fakeServer();
    // 미리보기 임시 주소를 만들고 지우는 함수를 가짜로 넣어요(jsdom에는 없어요).
    URL.createObjectURL = vi.fn(() => "blob:preview");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("비운 칸이 있으면 저장하지 않고, 칸마다 오류를 달고 가장 위의 비운 칸으로 스크롤해 초점을 옮긴다('고칠 곳' 목록은 없다)", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    // 제목 칸만 채워 두면, 가장 위의 비운 칸은 그다음의 파일 이름이에요(차례: 분류·평점 → 제목 → 파일 이름 → …).
    await user.type(screen.getByLabelText(/^제목$/), "겨울 정류장");
    // scrollIntoView는 vitest.setup.ts가 가짜 함수로 채워 둬서, 불렸는지 확인할 수 있어요.
    const scroll = vi.mocked(Element.prototype.scrollIntoView);
    scroll.mockClear();
    await user.click(screen.getByRole("button", { name: "리뷰 저장" }));

    const slug = screen.getByLabelText(/파일 이름$/);
    await vi.waitFor(() => expect(slug).toHaveFocus());
    // mock.contexts: 가짜 함수가 불릴 때의 this(어느 요소에서 불렸는지) 목록이에요.
    expect(scroll.mock.contexts).toContain(slug);
    expect(slug).toHaveAttribute("aria-invalid", "true");
    // 비운 칸마다 오류 문구가 칸 바로 아래에 달려요. 채운 제목 칸과, 처음부터 골라진 분류·평점에는 없어요.
    for (const label of [/파일 이름$/, /연도$/, /감독 또는 작가$/, /한 줄 평$/]) {
      expect(screen.getByLabelText(label)).toHaveAttribute("aria-invalid", "true");
    }
    expect(screen.getByLabelText(/^제목$/)).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText(/평점$/)).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText(/한 줄 평$/)).toHaveAccessibleDescription(expect.stringContaining("한 줄 평을 입력하세요"));
    // "고칠 곳 n개" 목록은 없어요.
    expect(screen.queryByRole("group", { name: /고칠 곳/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/고칠 곳/)).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("넓은 화면에서는 [이미지 | 콘텐츠 정보(2열)] 3칸이다", () => {
    render(<ReviewWriter mode="create" />);
    const imageGroup = screen.getByRole("group", { name: "이미지" });
    const infoGroup = screen.getByRole("group", { name: "콘텐츠 정보" });
    // 이미지가 콘텐츠 정보보다 앞(왼쪽)에 놓여요. 읽는 순서도 같아요.
    // compareDocumentPosition: 두 요소의 문서 안 위치 관계를 숫자 표시로 돌려줘요. FOLLOWING 표시가 있으면 infoGroup이 뒤에 있어요.
    expect(imageGroup.compareDocumentPosition(infoGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(imageGroup.parentElement).toHaveClass("lg:grid-cols-3");
    expect(infoGroup).toHaveClass("lg:col-span-2", "lg:grid-cols-2");
    // 6칸이 콘텐츠 정보 안에 있어요(2열 × 3행): [분류·평점], 제목, 파일 이름, 연도, 감독 또는 작가, 한 줄 평
    const cells = [...infoGroup.querySelectorAll<HTMLElement>(":scope > div, :scope > p")];
    expect(cells).toHaveLength(6);
    // 칸 순서: 분류·평점이 맨 앞, 파일 이름은 제목 바로 아래예요. 영문 제목 칸은 없어요.
    const order = cells.map((cell) => cell.textContent?.replace(/▶|\s/g, "").slice(0, 4));
    expect(order).toEqual(["분류영화", "제목", "파일이름", "연도", "감독또는", "한줄평"]);
    expect(screen.queryByLabelText(/영문 제목/)).not.toBeInTheDocument();
    // 분류와 평점은 한 칸을 둘로 나눠(grid-cols-2) 휴대폰에서도 같은 줄에 놓여요.
    const pair = cells[0]!;
    expect(pair).toHaveClass("grid", "grid-cols-2");
    expect(pair).toContainElement(screen.getByRole("group", { name: "분류" }));
    expect(pair).toContainElement(screen.getByLabelText(/평점$/));
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("분류는 영화·도서 가운데 하나만 고르고, 처음에는 영화가 골라져 있다", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    const group = screen.getByRole("group", { name: "분류" });
    // 칩은 영화, 도서 두 개이고(lib/categories.ts 순서), 처음에는 영화가 골라져 있어요.
    // (칩의 꾸밈 ▶는 aria-hidden이라 접근 이름에서 빠져요.)
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((radio) => within(group).getByRole("radio", { name: radio === radios[0] ? "영화" : "도서" }))).toEqual(radios);
    expect(within(group).getByRole("radio", { name: "영화" })).toBeChecked();
    expect(within(group).getByRole("radio", { name: "도서" })).not.toBeChecked();
    await user.click(within(group).getByRole("radio", { name: "도서" }));
    expect(within(group).getByRole("radio", { name: "도서" })).toBeChecked();
    await user.click(within(group).getByRole("radio", { name: "영화" }));
    expect(within(group).getByRole("radio", { name: "영화" })).toBeChecked();
    expect(within(group).getByRole("radio", { name: "도서" })).not.toBeChecked();
  });

  it("[리뷰 저장] [취소]는 오른쪽에 붙어 있고, 저장이 취소 앞에 있다", () => {
    render(<ReviewWriter mode="create" />);
    const save = screen.getByRole("button", { name: "리뷰 저장" });
    const cancel = screen.getByRole("link", { name: "취소" });
    expect(save.parentElement).toBe(cancel.parentElement);
    expect(save.parentElement).toHaveClass("justify-end");
    expect(save.compareDocumentPosition(cancel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cancel).toHaveAttribute("href", "/");
  });

  it("이미지를 고르기 전에는 목록과 같은 기본 이미지를 보이고, 고르면 그 사진으로 바뀌며 [이미지 빼기]가 생긴다", async () => {
    const user = userEvent.setup();
    const { container } = render(<ReviewWriter mode="create" />);
    const frame = container.querySelector<HTMLElement>(".image-frame")!;
    // 기본 이미지: 그림 액자 픽셀 아이콘 + NO IMAGE. 그림은 꾸밈이라 숨기고, 화면 낭독기에는 "고른 이미지 없음"이라고 알려요.
    expect(frame.querySelector("svg")).toBeInTheDocument();
    expect(frame).toHaveTextContent("NO IMAGE");
    expect(frame.querySelector("svg")!.closest("[aria-hidden='true']")).toBeInTheDocument();
    expect(within(frame).getByText("고른 이미지 없음")).toHaveClass("sr-only");

    expect(screen.queryByRole("button", { name: "이미지 빼기" })).not.toBeInTheDocument();

    await user.upload(screen.getByLabelText("이미지 고르기"), new File(["jpg"], "cover.jpeg", { type: "image/jpeg" }));
    await vi.waitFor(() => expect(frame.querySelector("img")).toBeInTheDocument());
    expect(frame.querySelector("svg")).not.toBeInTheDocument();
    expect(within(frame).queryByText("고른 이미지 없음")).not.toBeInTheDocument();

    // [이미지 빼기]를 누르면 다시 기본 이미지예요.
    await user.click(screen.getByRole("button", { name: "이미지 빼기" }));
    expect(frame).toHaveTextContent("NO IMAGE");
    expect(screen.getByText("이미지를 뺐습니다. 저장하면 기본 이미지가 보입니다.")).toBeInTheDocument();
  });

  it("칸 이름에는 [필수] 같은 표시가 없고, 꼭 적어야 하는 칸에는 required만 단다(화면 낭독기가 '필수'라고 알려 줘요)", () => {
    render(<ReviewWriter mode="create" />);
    for (const name of ["파일 이름", "제목", "연도", "감독 또는 작가", "평점", "한 줄 평"]) {
      // 평점은 고르기 칸(combobox), 나머지는 글자 칸(textbox)이에요. 접근 이름은 보이는 칸 이름 그대로예요.
      const field = screen.getByRole(name === "평점" ? "combobox" : "textbox", { name });
      expect(field).toBeRequired();
      expect(document.querySelector(`label[for="${field.id}"]`)).toHaveTextContent(new RegExp(`^${name}$`));
    }
    // 분류 묶음 이름도 "분류" 그대로예요.
    expect(screen.getByRole("group", { name: "분류" })).toBeInTheDocument();
    // 어떤 모양의 필수 표시([필수], (필수), *)도 없어요.
    for (const mark of ["[필수]", "(필수)", "*"]) expect(screen.queryByText(mark, { exact: false })).not.toBeInTheDocument();
  });


  it("칸 아래 도움말은 없다(칸 이름만으로 알 수 있고, 틀리면 오류 문구가 고치는 방법을 알려 줘요)", () => {
    const { container } = render(<ReviewWriter mode="create" />);
    for (const label of [/파일 이름$/, /^제목$/, /연도$/, /감독 또는 작가$/, /평점$/, /한 줄 평$/]) {
      expect(screen.getByLabelText(label)).not.toHaveAccessibleDescription();
    }
    expect(screen.getByRole("group", { name: "분류" })).not.toHaveAccessibleDescription();
    expect(container.textContent).not.toContain("shutter-island");
  });

  it("평점은 처음에 5.0이 골라져 있고 '고르세요'가 없으며, ▼ 그림은 읽지 않는 꾸밈이다", () => {
    render(<ReviewWriter mode="create" />);
    const rating = screen.getByLabelText(/평점$/);
    expect(rating).toHaveValue("5.0");
    expect(within(rating).queryByRole("option", { name: "고르세요" })).not.toBeInTheDocument();
    expect(within(rating).getAllByRole("option").map((option) => option.textContent)).toEqual(
      ["0.5", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0"],
    );
    // ▼는 칸 옆에 겹쳐 그린 꾸밈 그림이라 화면 낭독기가 읽지 않아요. (좌우 간격이 같은지는 진짜 브라우저 E2E에서 재요)
    expect(rating.parentElement!.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("저장: 고른 이미지를 먼저 올리고 그 번호와 함께 리뷰를 저장한다. 저장 중에 두 번 눌러도 한 번만 저장한다", async () => {
    // 저장 답을 미뤄 두고, 그사이에 [리뷰 저장]을 두 번 눌러 봐요.
    // Promise의 resolve를 open에 담아 두면, 나중에 open()을 부를 때 저장 답이 나가요.
    // fakeServer(undefined, …): 첫 인자에 undefined를 넘기면 기본 답(201)을 써요.
    let open: () => void = () => {};
    fakeServer(undefined, new Promise<void>((resolve) => (open = resolve)));
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    // 파일 이름을 적기 전에 이미지를 먼저 골라도 돼요. 막거나 파일 이름부터 적으라고 하지 않아요.
    await user.upload(screen.getByLabelText("이미지 고르기"), new File(["jpg"], "cover.jpeg", { type: "image/jpeg" }));
    expect(screen.getByLabelText(/파일 이름$/)).not.toHaveAccessibleDescription(expect.stringContaining("먼저"));
    // 파일 이름을 적으면 이미지 이름이 <파일 이름>.jpg로 맞춰져요(아래 저장 요청에서 확인).
    await fillRequired(user);

    const save = screen.getByRole("button", { name: "리뷰 저장" });
    await user.dblClick(save);
    // 저장하는 동안에는 단추 글자가 바뀌고 누를 수 없어요.
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "저장하는 중…" })).toBeDisabled());
    // 단추 바로 아래에 로딩 UI가 보여요. 늘 있는 안내 영역(role="status") 안에서 글자만 바뀌어 화면 낭독기가 읽어 줘요.
    const loading = screen.getByText("리뷰를 저장하는 중");
    expect(loading.closest("[role='status']")).toBeInTheDocument();
    expect(loading.parentElement!.querySelector(".loading-bar")).toHaveAttribute("aria-hidden", "true");
    // 이제 서버가 답해요.
    open();

    // 저장을 마치면 "저장했습니다" 제목이 나오고 초점이 그리로 가요.
    const saved = await screen.findByRole("heading", { name: "저장했습니다" });
    await vi.waitFor(() => expect(saved).toHaveFocus());
    expect(callsTo("/api/images")).toHaveLength(1);
    expect(callsTo("/api/reviews")).toHaveLength(1);
    // 첫 요청의 [주소, 설정] 가운데 설정([1])의 본문(body)을 JSON으로 읽어 보낸 값을 확인해요.
    const request = JSON.parse(String(callsTo("/api/reviews")[0]![1]!.body));
    expect(request.values).toMatchObject({ slug: "winter-stop", title: "겨울 정류장", image: "winter-stop.jpg", category: "영화" });
    expect(request.upload).toEqual({ path: "public/images/winter-stop.jpg", sha: "f".repeat(40) });
    // 저장한 뒤에는 [목록으로]·[리뷰 추가]만 있어요.
    expect(screen.queryByRole("link", { name: "이 리뷰 보기" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "목록으로" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "리뷰 추가" })).toHaveAttribute("href", "/write");
  });

  it("서버가 칸 오류로 돌려보내면 그 칸에 알리고, 다시 저장할 수 있다", async () => {
    // 409(충돌): 같은 파일 이름이 이미 있다는 답. errors에 칸별 오류를 담아 보내요.
    fakeServer({ status: 409, body: { message: "같은 파일 이름의 리뷰가 이미 있습니다.", errors: { slug: "이미 같은 파일 이름의 리뷰가 있습니다." } } });
    const user = userEvent.setup();
    render(<ReviewWriter mode="create" />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "리뷰 저장" }));

    // 서버가 보낸 칸 오류는 그 칸 아래에 달리고, 그 칸으로 초점이 가요.
    const slug = screen.getByLabelText(/파일 이름$/);
    await vi.waitFor(() => expect(slug).toHaveFocus());
    expect(slug).toHaveAccessibleDescription("이미 같은 파일 이름의 리뷰가 있습니다.");
    expect(screen.getByRole("button", { name: "리뷰 저장" })).toBeEnabled();
  });
});

describe("ReviewWriter(리뷰 수정)", () => {
  beforeEach(() => fakeServer({ status: 200, body: { slug: "winter-stop", commitSha: "c" } }));
  afterEach(() => vi.unstubAllGlobals());

  // 저장소에 있는 원고(JSON 글자)를 흉내 내요. 이미지는 없고, 화면에 칸이 없는 publishedAt이 들어 있어요.
  const SOURCE = JSON.stringify({ title: "겨울 정류장", year: 2024, creator: "한서윤", category: "도서", rating: 4.5, oneLiner: "한줄", publishedAt: "2026-11-08" });
  /** 수정 화면(서버)이 원고를 읽어 넘겨주는 값과 같은 모양으로 만들어요. */
  const parsedOf = (source: string): EditSource => {
    const result = parseReviewFile(source);
    return result.ok ? { ok: true, values: result.values } : { ok: false, message: result.message };
  };

  it("저장소의 원고로 칸을 채우고, 파일 이름은 바꿀 수 없다(괄호 안내는 다음 줄)", () => {
    render(<ReviewWriter mode="edit" slug="winter-stop" parsed={parsedOf(SOURCE)} baseSha="base" />);
    expect(screen.getByLabelText(/^제목$/)).toHaveValue("겨울 정류장");
    expect(screen.getByRole("radio", { name: "도서" })).toBeChecked();
    expect(screen.queryByLabelText(/파일 이름$/)).not.toBeInTheDocument();
    const note = screen.getByText("(수정할 때는 바꿀 수 없습니다.)");
    // 파일 이름 줄 바로 다음에 줄바꿈(<br>)이 있어, 괄호 안내가 다음 줄에 보여요.
    expect(note.previousElementSibling?.tagName).toBe("BR");
    expect(note.parentElement).toHaveTextContent("파일 이름: winter-stop.json(수정할 때는 바꿀 수 없습니다.)");
  });

  it("수정한 내용을 처음 원고 sha와 함께 PUT으로 저장한다(화면에 칸이 없는 글 쓴 날은 그대로)", async () => {
    const user = userEvent.setup();
    render(<ReviewWriter mode="edit" slug="winter-stop" parsed={parsedOf(SOURCE)} baseSha="base" />);
    await user.clear(screen.getByLabelText(/한 줄 평$/));
    await user.type(screen.getByLabelText(/한 줄 평$/), "고친 한 줄 평");
    await user.click(screen.getByRole("button", { name: "수정한 내용 저장" }));

    await screen.findByRole("heading", { name: "저장했습니다" });
    // 수정은 /api/reviews/<파일 이름> 주소로 PUT 방식으로 보내요.
    const [url, init] = callsTo("/api/reviews/winter-stop")[0]!;
    expect(url).toBe("/api/reviews/winter-stop");
    expect(init!.method).toBe("PUT");
    const body = JSON.parse(String(init!.body));
    expect(body.baseSha).toBe("base");
    expect(body.values).toMatchObject({ oneLiner: "고친 한 줄 평", publishedAt: "2026-11-08", category: "도서" });
  });
});
