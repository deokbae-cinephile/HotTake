/**
 * @file 화면 아래쪽에 떠 있는 단추들 (floating-buttons.tsx)
 * 읽는 순서: 26/84번째 · 4단계(처음 화면: 작품 목록)
 *   앞: src/components/back-to-top.tsx → 다음: src/lib/structured-data.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   화면 아래쪽에 단추를 띄워요(스크롤해도 그 자리에 있어요).
 *
 *     ┌──────────────────────────────────────────────┐
 *     │                                              │
 *     │                              ┌────────┐ ┌──┐ │
 *     │                              │ 맨 위로 │ │+ │ │
 *     │                              └────────┘ └──┘ │
 *     └──────────────────────────────────────────────┘
 *              오른쪽 아래: 맨 위로(back-to-top.tsx), 그 오른쪽에 리뷰 추가(44 × 44px)
 *
 *   - "+"는 맨 오른쪽 아래 구석에 늘 같은 자리로 있고, "맨 위로"는 나타나면 그 왼쪽에 붙어요(누르려던 "+"가 움직이지 않게요).
 *   - "+"는 글쓴이로 로그인했을 때만 보이고, 누르면 리뷰 추가 화면(/write)으로 가요.
 *   - 글쓰기 화면(/write…)에서는 "+"를 숨겨요. 이미 쓰고 있으니까요.
 *   - "맨 위로"는 조금 내려 읽었을 때만 보여요.
 *   (왼쪽 아래의 [로그아웃] 단추는 session-controls.tsx가 그려요.)
 *
 * 크기
 *   "+"는 가로·세로 44px이에요. 손가락으로 누르기 충분한 최소 크기예요(KWCAG 6.1.3 조작 가능).
 *
 * 접근성
 *   "+"는 그림 글자라 화면 낭독기에서는 숨기고, 대신 화면에 보이지 않는 "리뷰 추가"를 링크 이름으로 읽어 줘요.
 *
 * 누가 쓰나요?
 *   components/site-footer.tsx(바닥글)가 모든 화면에 놓아요.
 */

// "use client": 지금 주소(usePathname)와 로그인 상태(useIsAdmin)를 브라우저에서 읽어야 해서 클라이언트 컴포넌트예요.
"use client";

// Link: Next.js의 링크. 화면 전체를 새로 받지 않고 필요한 부분만 바꿔 빠르게 이동해요(a 요소로 그려져요).
import Link from "next/link";
// usePathname: 지금 주소의 경로 부분(예: "/", "/write")을 알려 주는 Next.js 훅이에요.
import { usePathname } from "next/navigation";

// BackToTop: "맨 위로" 단추 / PixelArt: 글자 그림을 SVG로 그리는 컴포넌트 / useIsAdmin: 글쓴이로 로그인했는지 알려 주는 훅
import { BackToTop } from "./back-to-top";
import { PixelArt } from "./pixel-art";
import { useIsAdmin } from "./use-is-admin";

/**
 * "+" 그림(8×8 칸). GitHub 아이콘처럼 픽셀로 그려 사이트 모양에 맞춰요. 칸 하나 3px → 24px
 * "#"은 칠한 칸, "."은 빈칸이에요. `as const`: 바뀌지 않는 값이라고 TypeScript에 알려요.
 */
const PLUS_ROWS = ["...##...", "...##...", "...##...", "########", "########", "...##...", "...##...", "...##..."] as const;

/**
 * 화면 아래쪽에 떠 있는 단추들
 *
 * @returns 화면 오른쪽 아래에 고정된 div("맨 위로" + 로그인했을 때 "+")
 */
export function FloatingButtons() {
  // 글쓴이로 로그인했는지(쿠키 표시). 미리 만든 HTML에서는 늘 false예요.
  const isAdmin = useIsAdmin();
  // 글쓰기 화면(/write, /write/<파일 이름>)에서는 "+"를 숨겨요.
  // startsWith("/write"): 글자가 "/write"로 시작하면 true예요.
  const onWritePage = usePathname().startsWith("/write");
  // &&: 둘 다 참일 때만 참. "로그인했고, 글쓰기 화면이 아닐 때" "+"를 보여요.
  const showAdd = isAdmin && !onWritePage;

  return (
    // fixed right-4 bottom-4: 화면 오른쪽 아래에 떠 있어요. flex items-end gap-2: 단추를 옆으로 나란히(아래 끝 맞춤) 놓아요.
    // z-[52]: CRT 화면 효과 막(z-index 50, 51)보다 위라서 또렷해요. print:hidden: 인쇄할 때는 빼요.
    <div className="fixed right-4 bottom-4 z-[52] flex items-end gap-2 print:hidden">
      {/* 코드 순서 = 화면 순서(왼쪽 → 오른쪽) = Tab 순서예요. "맨 위로"가 먼저, "+"가 맨 오른쪽이에요. */}
      <BackToTop />
      {/* `조건 && (요소)`: showAdd가 참일 때만 "+" 링크를 그려요. */}
      {showAdd && (
        // h-11 w-11: 가로·세로 44px 정사각형. p-0: 단추 기본 안쪽 여백을 없애 그림이 가운데에 오게 해요.
        // no-underline: 링크 밑줄을 없애요. justify-center: 그림을 가로 가운데에 놓아요.
        <Link href="/write" className="btn-float h-11 w-11 justify-center p-0 no-underline">
          {/* 픽셀 "+" 그림(24px)은 꾸밈이라 읽지 않고(label 없음), 대신 화면에 보이지 않는 "리뷰 추가"를 이름으로 읽어요. */}
          <PixelArt rows={PLUS_ROWS} cell={3} />
          {/* sr-only: 화면에는 보이지 않고 화면 낭독기만 읽는 글이에요. 이 글자가 링크 이름("리뷰 추가")이 돼요. */}
          <span className="sr-only">리뷰 추가</span>
        </Link>
      )}
    </div>
  );
}
