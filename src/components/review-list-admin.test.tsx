/**
 * @file review-list-admin.tsx 테스트
 *
 * 목록 한 편의 수정·삭제 아이콘 단추가
 *   - 넓은 화면용(한 줄 평 줄 끝에 가로로)과 휴대폰용(오른쪽 단추 칸에 위아래로) 모양으로 그려지는지
 *   - 글쓴이로 로그인했을 때만 보이는지(useReviewListAdmin)
 *   - 삭제 안내 칸이 처음부터 비어 있는 채로 있는지
 * 확인해요. 실제 목록 한 편에서 지우는 흐름은 review-list-item.test.tsx, 확인 창은 delete-review.test.tsx에서 확인해요.
 * 글쓴이 로그인은 쿠키(blog_admin=1)로 흉내 내요. jsdom은 CSS를 읽지 않아서 화면 너비에 따라 숨기는 것은 클래스로 확인해요.
 *
 * 테스트 도구 문법
 *   - render(JSX): 가짜 브라우저(jsdom)에 그려요. 돌려받는 값에서 필요한 것을 구조 분해로 꺼내 써요.
 *       unmount(): 그린 것을 치워요. rerender(JSX): 같은 자리에 새 props로 다시 그려요. container: 그린 것을 담은 바깥 <div>
 *   - screen.getByText / getByRole: 글자나 역할로 요소를 찾아요. 없으면 바로 실패해요.
 *   - expect(요소).toHaveClass(...): 클래스가 모두 붙어 있는지, toHaveAccessibleName(...): 화면 낭독기가 읽는 이름이 맞는지 확인해요.
 *   - describe / it: 테스트 묶음과 테스트 하나. afterEach: 테스트마다 끝나고 실행해요.
 *   - vi.fn(): 아무 일도 하지 않지만 불렸는지 기록하는 가짜 함수예요. 여기서는 onDeleted 자리를 채우는 데 써요.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReviewListActions, ReviewListDeleted, useReviewListAdmin } from "./review-list-admin";

/**
 * 훅의 값을 글자로 보여 주는 시험용 부품
 * 훅은 컴포넌트 안에서만 부를 수 있어서, 이렇게 작은 컴포넌트를 만들어 그 결과를 화면 글자로 꺼내 봐요.
 */
function Probe() {
  const { showActions, showStatus } = useReviewListAdmin();
  return <p>{`actions:${showActions} status:${showStatus}`}</p>;
}

describe("ReviewListActions·useReviewListAdmin", () => {
  // 테스트마다 로그인 쿠키를 지워요(max-age=0: 바로 만료). 앞 테스트의 로그인이 다음 테스트로 새지 않게요.
  afterEach(() => {
    document.cookie = "blog_admin=; max-age=0; path=/";
  });

  it("방문자에게는 단추도 안내 칸도 없고, 글쓴이에게만 있다", () => {
    // 쿠키가 없으면 방문자예요.
    const { unmount } = render(<Probe />);
    expect(screen.getByText("actions:false status:false")).toBeInTheDocument();
    unmount();

    // 로그인 표시 쿠키를 넣고 다시 그리면 글쓴이로 보여요.
    document.cookie = "blog_admin=1; path=/";
    render(<Probe />);
    expect(screen.getByText("actions:true status:true")).toBeInTheDocument();
  });

  it("넓은 화면용은 가로(640px보다 좁으면 숨김), 휴대폰용은 세로(640px 이상이면 숨김)로 44px 아이콘 단추 두 개를 둔다", () => {
    document.cookie = "blog_admin=1; path=/";
    const { container } = render(
      <>
        <ReviewListActions slug="winter-stop" title="겨울 정류장" onDeleted={vi.fn()} />
        <ReviewListActions slug="winter-stop" title="겨울 정류장" onDeleted={vi.fn()} vertical />
      </>,
    );
    // container.children: 그린 두 묶음. `[...]`(펼침 문법)으로 진짜 배열로 바꾼 뒤 구조 분해로 꺼내요.
    // `as [HTMLElement, HTMLElement]`: "두 요소짜리 배열"이라고 TypeScript에 알려 주는 타입 단언이에요.
    const [wide, phone] = [...container.children] as [HTMLElement, HTMLElement];
    // -my-2: 위아래로 8px씩 겹쳐 놓아 한 줄 평 줄 높이를 늘리지 않아요.
    expect(wide).toHaveClass("-my-2", "flex", "shrink-0", "gap-2", "max-sm:hidden");
    expect(wide).not.toHaveClass("flex-col");
    // 휴대폰용: [수정] 위, [삭제] 아래(flex-col), 칸 맨 위에 붙어요.
    expect(phone).toHaveClass("flex", "flex-col", "gap-2", "self-start", "sm:hidden");
    // 두 묶음 모두 [수정] 링크와 [삭제] 단추가 이름·주소·크기(44px 단추, 24px 그림)를 갖췄는지 같은 방법으로 확인해요.
    for (const group of [wide, phone]) {
      const [edit, remove] = [...group.children] as [HTMLElement, HTMLElement];
      expect(edit).toHaveAccessibleName("겨울 정류장 리뷰 수정");
      expect(edit).toHaveAttribute("href", "/write/winter-stop");
      expect(remove).toHaveAccessibleName("겨울 정류장 리뷰 삭제");
      for (const control of [edit, remove]) {
        expect(control).toHaveClass("btn-icon");
        expect(control.querySelector("svg")).toHaveAttribute("width", "24");
      }
    }
  });

  it("삭제 안내 칸(role=\"status\")은 비어 있으면 상자 모양도 여백도 없고, 글자가 들어가면 테두리 상자로 보인다", () => {
    // useRef 대신 { current: null } 모양의 보통 객체를 넘겨도 React가 그려진 요소를 current에 넣어 줘요.
    const ref = { current: null };
    const { rerender } = render(<ReviewListDeleted message="" statusRef={ref} />);
    const status = screen.getByRole("status");
    expect(status).toBeEmptyDOMElement();
    // 비어 있을 때는 class가 빈 글자라 테두리·여백이 없어요.
    expect(status).toHaveAttribute("class", "");
    // Tab 순서에는 없고, 코드로만 초점을 옮겨요.
    expect(status).toHaveAttribute("tabindex", "-1");

    // 안내 글을 넣어 다시 그려요. 같은 <p>(status)가 그대로 남아 글자와 모양만 바뀌어야 해요.
    rerender(<ReviewListDeleted message="‘겨울 정류장’ 리뷰를 삭제했습니다." statusRef={ref} />);
    expect(status).toHaveTextContent("‘겨울 정류장’ 리뷰를 삭제했습니다.");
    expect(status).toHaveClass("mt-3", "border-2");
    // 손잡이(ref)가 바로 그 안내 칸을 가리켜야 초점을 옮길 수 있어요. toBe: 같은 대상인지 확인해요.
    expect(ref.current).toBe(status);
  });
});
