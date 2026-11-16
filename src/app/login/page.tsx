/**
 * @file 글쓴이 로그인 화면 (app/login/page.tsx → 주소 "/login")
 * 읽는 순서: 35/84번째 · 5단계(글쓴이 로그인과 잠금)
 *   앞: src/app/api/session/route.ts → 다음: src/components/login-form.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓴이가 아이디·비밀번호로 로그인하는 화면이에요. 로그인해야 리뷰를 쓰고(C) 고치고(U) 지울(D) 수 있어요.
 *   로그인하지 않고 글쓰기 화면(/write)에 가면 proxy.ts가 이 화면으로 보내 줘요(?next=에 원래 주소를 적어서).
 *
 * 화면 자체는 빌드할 때 미리 만들어 두고, 로그인은 폼(components/login-form.tsx)이 API(/api/session)로 해요.
 * 검색엔진에는 보이지 않게 해요(robots: noindex). 방문자가 찾을 화면이 아니니까요.
 *
 * 누가 쓰나요?
 *   import하는 파일은 없어요. 폴더 이름(app/login)이 곧 주소(/login)라 Next.js가 저절로 그려요.
 */

import type { Metadata } from "next";
// Suspense: 안의 조각이 준비될 때까지 기다리는 자리를 만드는 React 요소예요(준비되기 전에는 fallback, 여기서는 빈 자리).
import { Suspense } from "react";

// LoginForm: 아이디·비밀번호 칸과 [로그인] 단추를 그리는 클라이언트 컴포넌트
import { LoginForm } from "@/components/login-form";

/** 탭 제목 "글쓴이 로그인 — HotTake", 그리고 검색엔진에 올리지 않기 */
export const metadata: Metadata = {
  title: "글쓴이 로그인",
  robots: { index: false },
};

/**
 * 로그인 화면
 *
 * @returns 제목(h1)·안내 문단·로그인 폼을 담은 section
 */
export default function LoginPage() {
  return (
    // max-w-[32rem]: 입력 칸이 너무 길어지지 않게 폭을 정해요. 왼쪽에 붙여 다른 화면과 시작선을 맞춰요.
    <section aria-labelledby="login-title" className="grid max-w-[32rem] gap-6">
      {/* aria-labelledby="login-title"(위 section) ↔ id="login-title"(이 h1): 구역 이름을 제목 글자로 정해요. */}
      <h1 id="login-title" className="glow text-big">
        글쓴이 로그인
      </h1>
      <p className="text-crt-dim">리뷰를 추가·수정·삭제하려면 로그인하세요. 이 블로그는 글쓴이 한 사람만 로그인할 수 있습니다.</p>
      {/* LoginForm은 주소의 ?next=를 읽어서(useSearchParams) Suspense로 감싸요. 미리 만든 HTML에는 빈 자리로 들어가요. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </section>
  );
}
