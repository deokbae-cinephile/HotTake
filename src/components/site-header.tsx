/**
 * @file 머리글 (site-header.tsx)
 * 읽는 순서: 14/84번째 · 3단계(화면의 뼈대와 공통 모양)
 *   앞: src/app/layout.tsx → 다음: src/components/site-footer.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   모든 화면 맨 위에 보이는 머리글이에요. 옛 단말기 프로그램의 맨 윗줄처럼
 *   왼쪽에 로고와 블로그 이름, 오른쪽에 링크를 두고 그 사이를 점선(....)으로 잇습니다.
 *
 *     [로고] 작품 한 줄 평 블로그  ·····································  [GitHub 아이콘]
 *
 *   머리글에는 버전을 보이지 않아요. 버전은 package.json과 GitHub 릴리스에서 확인해요.
 *
 *   왼쪽 로고는 24 × 22px(세로로 조금 긴 플로피 디스크), 오른쪽 GitHub 아이콘은 24 × 24px이고, 누르는 높이는 둘 다 44px이에요.
 *   블로그 이름은 20px(text-logo)이고, 로고와 세로 가운데를 맞춰요.
 *   로고와 이름 사이는 12px로 붙이고, 점선 양쪽(이름 끝 ↔ 점선, 점선 끝 ↔ GitHub 아이콘)은 22px로 같게 둬요.
 *   로고는 본문 왼쪽 끝에, GitHub 아이콘은 본문 오른쪽 끝에 딱 맞춰요. 휴대폰에서도 줄을 바꾸지 않고 첫 줄 오른쪽 끝에 있어요.
 *   GitHub 링크는 아이콘만 보이고, 글자 "GitHub"는 화면 낭독기만 읽어요(링크 이름).
 *
 * 맡은 기능
 *   - 블로그 이름을 누르면 처음 화면(목록)으로 가요.
 *   - [GitHub]: 이 블로그의 소스 코드가 있는 저장소로 가요. 아이콘은 사이트에 맞춰 픽셀로 그렸어요(lib/github-mark.ts).
 *     같은 창에서 열어요. 새 창으로 열면 누르기 전에 그 사실을 눈으로도 알려야 해서(KWCAG 7.2.1), 예고 없는 새 창을 만들지 않아요.
 *   (리뷰 추가 단추는 머리글이 아니라 화면 오른쪽 아래, 맨 위로 단추 오른쪽에 떠 있어요. components/floating-buttons.tsx)
 *
 * 브라우저 코드가 없는 "서버 컴포넌트"예요
 *   미리 HTML로 만들어지고 브라우저에서는 다시 돌지 않아서, 방문자가 받는 자바스크립트가 늘지 않아요.
 *
 * 누가 쓰나요?
 *   app/layout.tsx가 모든 화면 위에 이 머리글을 놓습니다.
 */

// Link: Next.js의 링크. 화면을 통째로 다시 받지 않고 바뀐 부분만 바꿔 빠르게 이동해요(a 요소로 그려져요).
import Link from "next/link";

// GitHub 고양이 아이콘을 "#"·"."로 적은 글자 그림(12 × 12칸, lib/github-mark.ts)
import { GITHUB_MARK_ROWS } from "@/lib/github-mark";
// 로고 그림(플로피 디스크)은 lib/logo.ts에 있어요. 머리글과 아이콘이 같은 12 × 11칸 그림을 써요.
import { LOGO_ROWS } from "@/lib/logo";
// site: 블로그 이름(site.headerTitle) 같은 설정 값 묶음(lib/site.ts)
import { site } from "@/lib/site";

import { PixelArt } from "./pixel-art";

/**
 * 모든 화면 맨 위의 머리글
 *
 * @returns 로고·블로그 이름 링크, 점선, GitHub 링크를 담은 header 요소
 */
export function SiteHeader() {
  return (
    // <header>는 "머리글" 영역이라는 뜻을 가진 태그예요. 화면 낭독기는 이를 "배너" 랜드마크로 알려 줍니다.
    // 화면 너비를 다 써요(풀화면). 줄을 바꾸지 않아요(flex-wrap 없음): GitHub 아이콘이 늘 첫 줄 오른쪽 끝에 있어요.
    // sm:gap-x-3: 넓은 화면에서 이름 · 점선 · 아이콘 사이 12px. 휴대폰에서는 점선이 없고, 아이콘 링크의 안쪽 여백(10px)이 사이를 띄워요.
    // id="top" + tabIndex={-1}: "맨 위로" 단추(back-to-top.tsx)가 키보드 초점을 여기로 옮겨요.
    //   tabIndex -1은 Tab 순서에는 들어가지 않고 코드로만 초점을 받을 수 있다는 뜻이에요. outline-none은 그때의 테두리를 지워요.
    <header
      id="top"
      tabIndex={-1}
      className="flex w-full items-center px-4 pt-6 outline-none sm:gap-x-3 sm:px-8 sm:pt-8 lg:px-12"
    >
      {/* 로고와 블로그 이름이 처음 화면으로 가는 링크 하나예요.
          inline-flex items-center: 로고와 이름을 가로로 나란히, 세로 가운데로 맞춰요. no-underline hover:underline: 평소엔 밑줄 없이, 마우스를 올리면 밑줄.
          min-h-11: 누르는 높이 44px(오른쪽 GitHub 링크와 같아요).
          gap-3: 로고와 이름 사이 12px(머리글 항목 사이 간격과 같아요). 로고 그림은 가장자리 칸까지 색칠돼 있어 그림 끝 = 요소 끝이에요.
          min-w-0: 아주 좁은 화면에서도 오른쪽 GitHub 아이콘을 밀어내지 않아요.
          왼쪽 끝은 아래 본문과 줄을 맞추려고 안쪽 여백을 두지 않아요. */}
      <Link href="/" className="inline-flex min-h-11 min-w-0 items-center gap-3 no-underline hover:underline">
        {/* 로고는 옆의 블로그 이름과 같은 뜻이라 꾸밈 그림으로 둬요(label 없음 → 읽지 않음). 12 × 11칸 × 2px = 24 × 22px */}
        <PixelArt rows={LOGO_ROWS} cell={2} />
        {/* glow: 글자 둘레의 은은한 빛, text-logo: 로고 글자 크기(20px, globals.css의 @theme) */}
        <span className="glow text-logo">{site.headerTitle}</span>
      </Link>

      {/* 이름과 링크 사이의 점선. 꾸밈이라 읽지 않아요. 휴대폰에서는 숨겨요(hidden sm:block: 기본은 숨김, 640px 이상에서 보임).
          leader: 남은 너비를 채우는 점선(globals.css).
          ml-2.5: 점선 왼쪽에 10px를 더 띄워, 이름 끝 ↔ 점선(사이 12px + 10px = 22px)이
          점선 끝 ↔ GitHub 아이콘(사이 12px + 링크 안쪽 여백 10px = 22px)과 같아요. */}
      <span aria-hidden="true" className="leader ml-2.5 hidden sm:block" />

      {/* 소스 코드 저장소 링크. 화면에는 GitHub 아이콘만 보이고, 글자 "GitHub"는 화면 낭독기만 읽어요(sr-only).
          다른 사이트로 가는 링크라 next/link 대신 평범한 <a>를 써요.
          menu-link: 누르는 높이 44px, 좌우 안쪽 여백 10px → 아이콘 24px와 합쳐 44 × 44px(globals.css).
          -mr-2.5: 오른쪽 안쪽 여백(10px)만큼 바깥으로 빼서, 아이콘 오른쪽 끝이 본문 오른쪽 끝에 딱 맞아요.
          ml-auto: 남는 왼쪽 공간을 모두 차지해 오른쪽 끝으로 밀려요(휴대폰처럼 점선이 없을 때).
          shrink-0: 좁은 화면에서도 아이콘이 찌그러지지 않아요.
          relative: 안의 숨긴 글자(sr-only, position: absolute)가 화면 다른 곳이 아니라 이 링크 안에 자리를 잡게 해요. */}
      <a href={site.repo.url} className="menu-link relative -mr-2.5 ml-auto shrink-0">
        {/* 아이콘은 꾸밈이라 읽지 않고(PixelArt는 aria-hidden), 링크 이름은 아래 숨긴 글자예요. 12칸 × 2px = 24 × 24px */}
        <PixelArt rows={GITHUB_MARK_ROWS} cell={2} />
        <span className="sr-only">GitHub</span>
      </a>
    </header>
  );
}
