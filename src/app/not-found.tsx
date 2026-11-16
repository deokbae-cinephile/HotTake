/**
 * @file 없는 주소 화면 = 404 (app/not-found.tsx)
 * 읽는 순서: 67/84번째 · 7단계(설치형 웹 앱과 그 밖의 화면)
 *   앞: src/app/offline/page.tsx → 다음: src/app/sitemap.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   없는 주소로 들어왔을 때 보이는 화면이에요. 왜 이 화면이 나왔는지, 어떻게 하면 되는지 알려 주고
 *   목록으로 돌아가는 단추를 둬요. 그림 없이 글자와 단추만 둬서 가벼워요.
 *
 * 언제 보이나요?
 *   - 사이트에 없는 주소로 들어왔을 때(서버가 404 상태와 함께 이 화면을 보여 줘요)
 *   - 리뷰 수정 화면(app/write/[slug]/page.tsx)에서 저장소에 없는 리뷰라 notFound()를 불렀을 때
 *
 * 누가 쓰나요?
 *   import하는 파일은 없어요. Next.js가 이름(app/not-found.tsx)을 보고 저절로 써요.
 *
 * 좋은 오류 화면의 조건
 *   "에러!"만 말하지 않고 (1) 무슨 일인지 (2) 왜 그런지 (3) 이제 어떻게 하면 되는지 알려 줘요.
 */

import type { Metadata } from "next";
// Link: Next.js의 링크(a 요소로 그려져요). 처음 화면으로 빠르게 옮겨요.
import Link from "next/link";

/** 탭 제목: "찾는 화면이 없습니다 — HotTake"(layout.tsx의 제목 규칙 "%s — HotTake"에 들어가요) */
export const metadata: Metadata = {
  title: "찾는 화면이 없습니다",
};

/**
 * 404 화면
 *
 * @returns 제목(h1)·안내 문단·목록 링크를 담은 section
 */
export default function NotFoundPage() {
  return (
    // justify-items-center + text-center: 모든 것을 가운데 정렬해요.
    // aria-labelledby="not-found-title": 이 구역의 이름을 아래 h1 글자로 정해요(화면 낭독기가 구역 이름으로 읽어요).
    // mx-auto max-w-[42rem]: 너비를 42rem(672px)까지로 두고 가운데에 놓아요. gap-6: 사이 24px, py-10: 위아래 40px
    <section aria-labelledby="not-found-title" className="mx-auto grid max-w-[42rem] justify-items-center gap-6 py-10 text-center">
      {/* (1) 무슨 일인지 */}
      {/* text-big: 화면 제목용 큰 글자(24px, globals.css) */}
      <h1 id="not-found-title" className="glow text-big">
        찾는 화면이 없습니다
      </h1>
      {/* (2) 왜 그런지, (3) 어떻게 하면 되는지 */}
      <p className="text-crt-dim">
        주소가 바뀌었거나 삭제된 리뷰일 수 있습니다.
        <br />
        주소를 다시 확인하거나 목록에서 찾아 주세요.
      </p>
      {/* (3) 갈 곳. btn-inverse: 링크지만 반전(초록 바탕) 단추 모양으로 보여요(globals.css). */}
      <Link href="/" className="btn-inverse">
        목록으로 가기
      </Link>
    </section>
  );
}
