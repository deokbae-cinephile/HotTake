/**
 * @file 리뷰 추가 화면 (app/write/page.tsx → 주소 "/write")
 * 읽는 순서: 46/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/lib/admin-api.ts → 다음: src/app/write/[slug]/page.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓴이가 새 리뷰를 쓰는 화면이에요. 폼은 components/review-writer.tsx가 그려요.
 *
 * 로그인 확인 두 번
 *   1. proxy.ts: 로그인하지 않았으면 이 화면에 오기 전에 로그인 화면으로 보내요.
 *   2. 여기(isAdmin): 혹시 proxy가 빠져도 화면을 그리기 전에 한 번 더 확인해요.
 *   cookies()를 쓰는 화면이라 미리 만들어 두지 않고, 요청이 올 때마다 서버에서 그려요.
 *
 * 저장 기능이 설정되지 않은 서버(GitHub 토큰 없음)라면, 폼 대신 무엇을 설정할지 알려 줘요.
 *
 * 누가 쓰나요?
 *   import하는 파일은 없어요. 폴더 이름(app/write)이 곧 주소(/write)라 Next.js가 저절로 그려요.
 *   오른쪽 아래의 [+] 단추(components/floating-buttons.tsx)가 이 주소로 링크해요.
 */

import type { Metadata } from "next";
// redirect: 다른 주소로 보내는 Next.js 함수예요. 부르면 그 자리에서 그리기를 멈추고 바로 옮겨요.
import { redirect } from "next/navigation";

// NotConfigured: 저장 설정이 없을 때의 안내, ReviewWriter: 리뷰 쓰기 폼(클라이언트 컴포넌트)
import { NotConfigured } from "@/components/not-configured";
import { ReviewWriter } from "@/components/review-writer";
// isAdmin: 요청의 세션 쿠키로 글쓴이인지 서버에서 확인하는 함수
import { isAdmin } from "@/lib/admin-auth";
// isGitHubConfigured: 서버에 GitHub 토큰(GITHUB_CONTENT_TOKEN)이 있는지 알려 주는 함수
import { isGitHubConfigured } from "@/lib/github";

/** 탭 제목, 그리고 검색엔진에 올리지 않기(글쓴이만 쓰는 화면이에요) */
export const metadata: Metadata = {
  title: "리뷰 추가",
  robots: { index: false },
};

/**
 * 리뷰 추가 화면
 *
 * `async`: isAdmin()을 기다려야(await) 해서 비동기 서버 컴포넌트예요.
 *
 * @returns 제목(h1)과 쓰기 폼(또는 설정 안내)을 담은 section
 */
export default async function WritePage() {
  // 로그인하지 않았으면 로그인 화면으로. 로그인한 뒤 이 화면으로 돌아오게 next를 적어요.
  // `!(await isAdmin())`: 확인 결과(true/false)를 기다린 뒤 뒤집어요(!). 글쓴이가 아니면 true가 돼요.
  if (!(await isAdmin())) redirect("/login?next=/write");

  return (
    <section aria-labelledby="write-title" className="grid gap-8">
      <h1 id="write-title" className="glow text-big">
        리뷰 추가
      </h1>
      {/* 저장 설정이 있으면 새로 쓰기 폼(mode="create"), 없으면 설정 안내 */}
      {isGitHubConfigured() ? <ReviewWriter mode="create" /> : <NotConfigured />}
    </section>
  );
}
