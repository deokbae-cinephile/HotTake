/**
 * @file login-form.tsx 테스트
 *
 * 로그인 폼이 빈 칸·틀린 비밀번호를 칸 옆에 알리고, 맞으면 원래 가려던 곳으로 보내는지 확인해요.
 * 서버(API) 대신 fetch를 가짜로 바꿔 답을 정해 줘요. 라우터와 주소 조건도 가짜예요.
 * 아래쪽 safeNext 묶음은 "로그인 뒤 갈 주소"가 다른 사이트로 새지 않는지 여러 위험한 주소로 확인해요.
 *
 * 테스트 도구 문법
 *   - vi.stubGlobal("fetch", vi.fn()): 전역 fetch를 가짜 함수로 바꿔요. vi.unstubAllGlobals()로 원래대로 돌려요.
 *   - vi.mocked(fetch).mockResolvedValue(답): 가짜 fetch가 부를 때마다 이 답(Promise로 감싼 값)을 돌려주게 해요.
 *     vi.mocked는 "이건 가짜 함수예요"라고 TypeScript에 알려 mockResolvedValue를 쓸 수 있게 해요.
 *   - mockClear(): 가짜 함수에 쌓인 불림 기록을 지워요(테스트끼리 섞이지 않게).
 *   - screen.getByLabelText(/아이디/): 이름표(label) 글자로 입력 칸을 찾아요. { selector: "input" }은 그중 input만 고르라는 뜻이에요
 *     ("비밀번호 보기" 단추도 "비밀번호"를 포함해서요).
 *   - user.type(칸, "글자"): 한 글자씩 치는 것을 흉내 내요. user.dblClick: 빠른 두 번 누르기.
 *   - expect.objectContaining({ method: "POST" }): 객체에 이 항목이 들어 있기만 하면 맞다고 봐요(나머지 항목은 상관없음).
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm, safeNext } from "./login-form";

/**
 * 가짜 라우터와 주소 조건
 * vi.hoisted: vi.mock이 파일 맨 위로 끌어올려져 먼저 실행되므로, mock 안에서 쓸 값도 먼저 만들어지게 해요.
 * search "next=%2Fwrite": 주소 ?next=/write 를 뜻해요(%2F는 "/"를 주소용으로 바꿔 쓴 글자).
 */
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), search: "next=%2Fwrite" }));

vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(router.search),
}));

/**
 * 가짜 fetch가 돌려줄 답을 정해요.
 *
 * @param status HTTP 상태 번호(200 성공, 401 인증 실패 등)
 * @param body 답 본문(JSON으로 바꿔 넣어요)
 */
function answer(status: number, body: unknown) {
  vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    router.replace.mockClear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("빈 칸으로 보내면 서버에 묻지 않고 칸마다 오류를 알리고 첫 빈 칸으로 초점을 옮긴다", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.click(screen.getByRole("button", { name: "로그인" }));

    const id = screen.getByLabelText(/아이디/);
    expect(id).toHaveAttribute("aria-invalid", "true");
    // 오류 문구가 칸의 설명으로 이어져 화면 낭독기가 칸 이름 다음에 읽어요.
    expect(id).toHaveAccessibleDescription("아이디를 입력하세요.");
    expect(id).toHaveFocus();
    // 빈 칸이면 서버에 묻지도 않아야 해요.
    expect(fetch).not.toHaveBeenCalled();
  });

  it("비밀번호가 틀리면 서버의 문구를 비밀번호 칸에 알리고 그 칸으로 초점을 옮긴다", async () => {
    const user = userEvent.setup();
    answer(401, { message: "아이디나 비밀번호가 맞지 않습니다. 다시 확인해 입력하세요." });
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/아이디/), "deokbae");
    await user.type(screen.getByLabelText(/비밀번호/, { selector: "input" }), "wrong");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    const password = screen.getByLabelText(/비밀번호/, { selector: "input" });
    expect(await screen.findByText("아이디나 비밀번호가 맞지 않습니다. 다시 확인해 입력하세요.")).toBeInTheDocument();
    expect(password).toHaveAttribute("aria-invalid", "true");
    expect(password).toHaveFocus();
    // 실패했으니 다른 화면으로 가지 않아야 해요.
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("맞으면 원래 가려던 주소(next)로 간다. 두 번 빠르게 눌러도 요청은 한 번만 간다", async () => {
    const user = userEvent.setup();
    answer(200, { ok: true });
    render(<LoginForm />);
    await user.type(screen.getByLabelText(/아이디/), "deokbae");
    await user.type(screen.getByLabelText(/비밀번호/, { selector: "input" }), "correct");
    await user.dblClick(screen.getByRole("button", { name: "로그인" }));

    await vi.waitFor(() => expect(router.replace).toHaveBeenCalledWith("/write"));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith("/api/session", expect.objectContaining({ method: "POST" }));
  });

  it("[비밀번호 보기]는 눌림 상태(aria-pressed)로 켜짐·꺼짐을 알리고, 친 글자를 보인다", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const toggle = screen.getByRole("button", { name: "비밀번호 보기" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/비밀번호/, { selector: "input" })).toHaveAttribute("type", "text");
  });

  it("비밀번호 관리자가 채울 수 있게 autocomplete를 단다", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText(/아이디/)).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText(/비밀번호/, { selector: "input" })).toHaveAttribute("autocomplete", "current-password");
  });
});

describe("safeNext", () => {
  it("우리 사이트 안의 주소만 받고, 다른 사이트로 가는 주소는 처음 화면으로 바꾼다", () => {
    expect(safeNext("/write/winter-stop")).toBe("/write/winter-stop");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
  });

  it("탭·줄바꿈이 섞여 다른 사이트 주소로 바뀔 수 있는 주소는 처음 화면으로 바꾼다", () => {
    // 주소 해석기는 탭·줄바꿈을 지워서 "/\t/evil.example"이 "//evil.example"(다른 사이트)이 돼요.
    expect(safeNext("/\t/evil.example")).toBe("/");
    expect(safeNext("/\n/evil.example")).toBe("/");
    expect(safeNext("/\r\n/evil.example")).toBe("/");
    // %2F는 글자 그대로의 경로 조각이라 사이트 안 주소예요. 그대로 둬요.
    expect(safeNext("/%2F/evil.example")).toBe("/%2F/evil.example");
  });

  it("../ 정리 뒤 //로 시작하게 되는 주소(다른 사이트)도 처음 화면으로 바꾼다", () => {
    // "/a/..//evil.example"은 정리하면 "//evil.example"이 돼요.
    expect(safeNext("/a/..//evil.example")).toBe("/");
    // 안전한 정리("/./x" → "/x")는 그대로 받아요.
    expect(safeNext("/./x")).toBe("/x");
  });

  it("사이트 안 주소의 검색 조건과 # 부분은 그대로 둔다", () => {
    expect(safeNext("/write?draft=1#body")).toBe("/write?draft=1#body");
  });
});
