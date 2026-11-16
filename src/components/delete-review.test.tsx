/**
 * @file delete-review.tsx 테스트
 *
 * 휴지통 아이콘 단추를 누르면 확인 창(<dialog role="alertdialog">)이 열리고, 창의 [삭제]를 눌러야 한 번만 요청하는지,
 * 삭제하는 동안 창 안에 로딩 UI를 보이는지, 실패하면 이유를 알리는지 확인해요.
 * 삭제한 뒤의 안내와 초점 옮기기는 목록 한 편(review-list-item.test.tsx)에서 확인해요.
 * jsdom에는 <dialog>의 showModal()이 없어서 vitest.setup.ts가 간단한 흉내를 넣어 둬요.
 *
 * 왜 확인하나요?
 *   삭제는 되돌릴 수 없는 일이라, "한 번 더 묻기"와 "두 번 누름 막기"가 깨지면 안 돼요.
 *   진짜 서버 대신 가짜 fetch를 끼워, 요청이 몇 번 갔는지 셀 수 있게 해요.
 *
 * 테스트 도구 문법
 *   - render(JSX): 가짜 브라우저(jsdom)에 컴포넌트를 그려요.
 *   - screen.getByRole(역할, { name }): 역할과 접근 이름으로 요소를 찾아요. 없으면 바로 실패해요.
 *     { hidden: true }를 주면 화면 낭독기에게 숨겨진 요소까지 찾아요(닫힌 <dialog>처럼).
 *   - screen.findByText(...): 글자가 나타날 때까지 잠시 기다렸다가 찾아요(await와 함께 써요).
 *   - within(요소).getByRole(...): 그 요소 안에서만 찾아요(창 안의 [삭제]처럼 같은 이름이 여러 곳에 있을 때).
 *   - userEvent: 실제 사용자처럼 클릭(click)·더블 클릭(dblClick)을 흉내 내요. setup()으로 준비하고 await로 기다려요.
 *   - fireEvent(요소, 이벤트): 이벤트 하나를 직접 보내요. 누군가 preventDefault()로 막았으면 false를 돌려줘요.
 *   - vi.fn(): 불린 횟수와 받은 값을 기록하는 가짜 함수. vi.stubGlobal: 전역 값(fetch 등)을 가짜로 바꿔 끼워요.
 *   - vi.waitFor(함수): 안의 확인이 통과할 때까지 잠시 되풀이해요(비동기 결과를 기다릴 때).
 *   - afterEach(함수): 테스트 하나가 끝날 때마다 실행해요. 여기서는 바꿔 끼운 fetch를 되돌려요.
 *   - expect.objectContaining({ ... }) / expect.stringContaining("..."): "적어도 이것을 담고 있으면 통과"라는 느슨한 비교예요.
 */

import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeleteReview } from "./delete-review";

/**
 * 가짜 서버의 답을 정해요. vi.stubGlobal: 전역 fetch를 가짜로 바꿔 끼워요.
 *
 * @param status - 돌려줄 HTTP 상태 번호(200 성공, 502 서버 쪽 오류 등)
 * @param body - 돌려줄 본문. JSON 글자로 바꿔 Response에 담아요. `unknown`은 "아무 값이나 받되, 꺼내 쓰기 전에 확인해야 하는 값" 타입이에요.
 */
function answer(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

/** 목록의 휴지통 아이콘 단추(이름에 어느 리뷰인지 들어 있어요) */
const trash = () => screen.getByRole("button", { name: "겨울 정류장 리뷰 삭제" });
/**
 * 확인 창 안의 [삭제] 단추
 * 창이 닫혀 있을 때도 찾을 수 있게 { hidden: true }를 줘요. 창 안으로 범위를 좁혀(within) 휴지통 단추와 헷갈리지 않게 해요.
 */
const confirmButton = () => within(screen.getByRole("alertdialog", { hidden: true })).getByRole("button", { name: "삭제" });

describe("DeleteReview", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("휴지통 단추는 44px 아이콘 단추이고, 그림은 꾸밈이라 읽지 않으며 이름에 리뷰 제목을 넣는다", () => {
    render(<DeleteReview slug="winter-stop" title="겨울 정류장" onDeleted={vi.fn()} />);
    // btn-icon 클래스가 44 × 44px 크기를 정해요(globals.css). 클래스가 붙었는지 확인해요.
    expect(trash()).toHaveClass("btn-icon");
    // querySelector("svg"): 단추 안의 그림(<svg>)을 CSS 선택자로 찾아요. 꾸밈이라 aria-hidden이어야 해요.
    expect(trash().querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(trash().querySelector("svg")).toHaveAttribute("width", "24");
  });

  it("단추를 누르면 확인 창이 열리고, [취소]로 닫으면 삭제하지 않는다", async () => {
    answer(200, { title: "겨울 정류장", commitSha: "c" });
    const user = userEvent.setup();
    render(<DeleteReview slug="winter-stop" title="겨울 정류장" onDeleted={vi.fn()} />);

    await user.click(trash());
    // 창의 이름은 aria-labelledby로 이은 제목이에요. 열린 <dialog>에는 open 속성이 붙어요.
    const dialog = screen.getByRole("alertdialog", { name: "리뷰를 삭제할까요?" });
    expect(dialog).toHaveAttribute("open");
    // 창의 설명(aria-describedby)이 무엇을 삭제하는지 알려 줘요.
    expect(dialog).toHaveAccessibleDescription(expect.stringContaining("‘겨울 정류장’ 리뷰와 이 리뷰의 이미지"));

    // [취소]로 닫으면 창이 닫히고(.not: "그렇지 않아야 한다"), 서버에는 아무 요청도 가지 않아야 해요.
    await user.click(within(dialog).getByRole("button", { name: "취소" }));
    expect(dialog).not.toHaveAttribute("open");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("확인 창에서 [삭제]를 두 번 빠르게 눌러도 한 번만 삭제한다. 삭제하는 동안 창 안에 로딩 UI를 보이고, 끝나면 창을 닫고 알린다", async () => {
    // 서버 답을 우리가 정한 때에 보내려고, 답을 미뤄 두는 가짜 fetch를 써요(진짜 서버처럼 시간이 걸리는 상황).
    // new Promise((resolve) => ...)의 resolve를 respond에 담아 두면, 나중에 respond(답)를 부를 때 fetch가 끝나요.
    let respond: (response: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => (respond = resolve))));
    const onDeleted = vi.fn();
    const user = userEvent.setup();
    render(<DeleteReview slug="winter-stop" title="겨울 정류장" onDeleted={onDeleted} />);

    await user.click(trash());
    const dialog = screen.getByRole("alertdialog");
    // 창 안의 안내 칸(role="status")은 처음부터 있고 비어 있어요.
    const status = within(dialog).getByRole("status");
    expect(status).toBeEmptyDOMElement();

    // 창 안의 [삭제]를 답이 오기 전에 두 번 눌러요.
    const confirm = confirmButton();
    await user.dblClick(confirm);
    // 두 번 눌렀어도 요청은 한 번, 주소와 방식(DELETE)도 맞아야 해요.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/reviews/winter-stop", expect.objectContaining({ method: "DELETE" }));

    // 답을 기다리는 동안: 안내 칸에 로딩 UI가 보이고, 두 단추는 막혀요(aria-disabled: 초점은 누른 [삭제]에 그대로 있어요).
    expect(status).toHaveTextContent("리뷰를 삭제하는 중");
    const cancel = within(dialog).getByRole("button", { name: "취소" });
    expect(confirm).toHaveAttribute("aria-disabled", "true");
    expect(cancel).toHaveAttribute("aria-disabled", "true");
    expect(confirm).toHaveFocus();
    // 막힌 [취소]를 눌러도 창은 닫히지 않아요.
    await user.click(cancel);
    expect(dialog).toHaveAttribute("open");
    // Esc(취소 이벤트)로도 창을 닫지 못해요. fireEvent는 막혔으면(preventDefault) false를 돌려줘요.
    expect(fireEvent(dialog, new Event("cancel", { cancelable: true }))).toBe(false);

    // 이제 서버가 "삭제했어요"라고 답해요.
    respond(new Response(JSON.stringify({ title: "겨울 정류장", commitSha: "c" }), { status: 200 }));

    // 답을 처리하는 데 잠깐 걸리므로, onDeleted가 불릴 때까지 기다려요. 그다음 안내 문구·창 닫힘·로딩 UI 사라짐을 확인해요.
    await vi.waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(onDeleted).toHaveBeenCalledWith("‘겨울 정류장’ 리뷰를 삭제했습니다. 블로그를 다시 배포하면(몇 분 뒤) 목록에서도 사라집니다.");
    expect(dialog).not.toHaveAttribute("open");
    expect(status).toBeEmptyDOMElement();
  });

  it("삭제에 실패하면 창 안에 이유를 알리고, 다시 누를 수 있다", async () => {
    // 502: 서버가 GitHub에서 답을 받지 못했다는 뜻의 상태 번호예요. 서버가 보낸 message를 그대로 보여 줘야 해요.
    answer(502, { message: "GitHub가 잠시 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요." });
    const user = userEvent.setup();
    render(<DeleteReview slug="winter-stop" title="겨울 정류장" onDeleted={vi.fn()} />);

    await user.click(trash());
    const confirm = confirmButton();
    await user.click(confirm);

    expect(await screen.findByText("GitHub가 잠시 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요.")).toHaveAttribute("role", "alert");
    // 다시 누를 수 있어요(막힘 표시가 없어지고, 초점도 [삭제]에 그대로예요).
    expect(confirm).not.toHaveAttribute("aria-disabled");
    expect(confirm).toHaveFocus();
    // 로딩 UI는 사라지고, 창은 열린 채라 다시 누르거나 [취소]·Esc로 닫을 수 있어요.
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("status")).toBeEmptyDOMElement();
    expect(dialog).toHaveAttribute("open");
    // 이번에는 막지 않으므로 fireEvent가 true를 돌려줘요(Esc로 닫을 수 있다는 뜻).
    expect(fireEvent(dialog, new Event("cancel", { cancelable: true }))).toBe(true);
  });
});
