/**
 * @file 오프라인 안내 화면 (app/offline/page.tsx → 주소 "/offline/")
 * 읽는 순서: 66/84번째 · 7단계(설치형 웹 앱과 그 밖의 화면)
 *   앞: src/components/install-prompt.tsx → 다음: src/app/not-found.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   인터넷이 끊겼는데 아직 저장해 두지 않은 화면을 열려고 할 때, 서비스 워커(public/sw.js)가 대신 보여 주는 화면이에요.
 *   서비스 워커가 설치될 때 이 화면을 미리 저장해 둬요.
 *
 * 화면 구성
 *   옛날 모뎀이 연결이 끊기면 띄우던 "NO CARRIER"를 ASCII 그림으로 보여 주고,
 *   (1) 무슨 일인지 (2) 지금 할 수 있는 것 (3) 갈 곳(목록)을 알려 줘요.
 *
 * 검색엔진에는 보이지 않게 해요(robots: noindex). 블로그 글이 아니라 안내 화면이니까요.
 *
 * 누가 쓰나요?
 *   import하는 파일은 없어요. 폴더 이름(app/offline)이 곧 주소라 Next.js가 그려 주고,
 *   서비스 워커(public/sw.js)가 이 주소를 저장해 뒀다가 연결이 끊겼을 때 꺼내 보여 줘요.
 */

import type { Metadata } from "next";
// Link: Next.js의 링크(a 요소로 그려져요)
import Link from "next/link";

/** 탭 제목 "오프라인 — HotTake", 그리고 검색엔진에 올리지 않기(robots: { index: false } → <meta name="robots" content="noindex">) */
export const metadata: Metadata = {
  title: "오프라인",
  robots: { index: false },
};

/**
 * 모뎀 연결이 끊긴 단말기 화면 ASCII 그림. 꾸밈이라 화면 낭독기에서는 숨겨요.
 * 글자 폭이 모두 같은 갈무리모노11(font-pixel-mono)로 그려 칸이 어긋나지 않아요(본문 글꼴 갈무리11은 글자마다 폭이 달라요).
 * String.raw`…`: 백틱 글자 안의 역슬래시(\) 같은 글자를 특수 문자로 풀지 않고 적은 그대로 둬요. 여러 줄도 그대로 담겨요.
 * ATDT: 옛 모뎀에 전화를 걸라고 시키는 명령이에요. NO CARRIER: "상대 신호(연결)가 없음"이라는 모뎀의 답이에요.
 */
const NO_CARRIER = String.raw` .---------------------------.
 | ATDT 0000-0000            |
 | DIALING...                |
 |                           |
 | NO CARRIER                |
 | _                         |
 '---------------------------'`;

/**
 * 오프라인 안내 화면
 *
 * @returns ASCII 그림·제목·안내·목록 링크를 담은 section
 */
export default function OfflinePage() {
  return (
    // 구성과 가운데 정렬은 404 화면(app/not-found.tsx)과 같아요. aria-labelledby로 구역 이름을 아래 h1에서 가져와요.
    <section aria-labelledby="offline-title" className="mx-auto grid max-w-[42rem] justify-items-center gap-6 py-10 text-center">
      {/* <pre>: 빈칸과 줄바꿈을 적은 그대로 보여 주는 요소예요(ASCII 그림에 꼭 필요해요). 꾸밈이라 aria-hidden으로 숨겨요.
          text-left: 바깥은 가운데 정렬이지만 그림 안의 줄은 왼쪽에 맞춰야 칸이 맞아요. leading-tight: 줄 사이를 좁혀요. */}
      <pre aria-hidden="true" className="glow font-pixel-mono text-left leading-tight">
        {NO_CARRIER}
      </pre>
      {/* (1) 무슨 일인지 */}
      <h1 id="offline-title" className="glow text-big">
        인터넷에 연결되어 있지 않습니다
      </h1>
      {/* (2) 지금 할 수 있는 것 */}
      <p className="text-crt-dim">
        한 번 열어 본 리뷰는 지금도 읽을 수 있습니다.
        <br />
        연결되면 이 화면을 새로 고쳐 주세요.
      </p>
      {/* (3) 갈 곳 */}
      <Link href="/" className="btn-inverse">
        목록으로 가기
      </Link>
    </section>
  );
}
