/**
 * @file 리뷰 수정 화면 (app/write/[slug]/page.tsx → 주소 "/write/<파일 이름>")
 * 읽는 순서: 47/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/app/write/page.tsx → 다음: src/app/write/loading.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓴이가 이미 쓴 리뷰를 고치는 화면이에요. 예: /write/winter-stop
 *   원고는 블로그에 배포된 파일이 아니라 저장소의 최신 원고를 읽어 와요(lib/review-store.ts).
 *   방금 저장해서 아직 배포되지 않은 내용도 이어서 고칠 수 있어요.
 *
 * 로그인 확인 두 번: proxy.ts가 먼저, 여기서 한 번 더(app/write/page.tsx 설명 참고).
 * 없는 리뷰면 404 화면, 저장 설정이 없거나 GitHub에 닿지 못하면 안내를 보여 줘요.
 *
 * [slug] 폴더 이름의 뜻
 *   대괄호로 감싼 폴더는 "동적 경로"예요. /write/winter-stop으로 오면 slug 값이 "winter-stop"이 돼요.
 *   slug는 리뷰의 파일 이름(content/reviews/<파일 이름>.json의 <파일 이름>)이에요.
 *
 * 누가 쓰나요?
 *   import하는 파일은 없어요. Next.js가 주소 /write/<파일 이름>을 열 때 저절로 그려요.
 *   목록의 [수정] 단추(components/review-list-admin.tsx)가 이 주소로 링크해요.
 */

import type { Metadata } from "next";
// notFound: 404 화면(app/not-found.tsx)을 보여 주는 함수, redirect: 다른 주소로 보내는 함수. 둘 다 부르면 그 자리에서 그리기를 멈춰요.
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { NotConfigured } from "@/components/not-configured";
// EditSource: 원고를 읽은 결과의 타입(type만 가져와요), ReviewWriter: 리뷰 쓰기·고치기 폼
import { type EditSource, ReviewWriter } from "@/components/review-writer";
import { isAdmin } from "@/lib/admin-auth";
// GitHubError: GitHub 요청이 실패했을 때 던지는 오류 종류, isGitHubConfigured: 토큰이 있는지
import { GitHubError, isGitHubConfigured } from "@/lib/github";
// parseReviewFile: 원고 JSON 글자를 폼 칸 값으로 바꾸는 함수
import { parseReviewFile } from "@/lib/review-file";
// loadReviewSource: 저장소에서 원고 글자와 내용 번호(sha)를 읽어 오는 함수
import { loadReviewSource } from "@/lib/review-store";

/** 탭 제목, 그리고 검색엔진에 올리지 않기 */
export const metadata: Metadata = {
  title: "리뷰 수정",
  robots: { index: false },
};

/**
 * 리뷰 수정 화면
 *
 * `PageProps<"/write/[slug]">`: Next.js가 만들어 주는 전역 타입이에요. 이 경로의 params 모양({ slug: string })을 알려 줘요.
 *
 * @param params 주소에서 읽은 { slug }를 담은 Promise. 기다려서(await) 꺼내요.
 * @returns 제목과 수정 폼(또는 설정 안내·오류 안내)을 담은 화면
 */
export default async function EditPage({ params }: PageProps<"/write/[slug]">) {
  // `const { slug } = await params`: 기다려 받은 객체에서 slug 항목만 꺼내요(구조 분해).
  const { slug } = await params;
  // 로그인하지 않았으면 로그인 화면으로. 로그인한 뒤 이 화면으로 돌아오게 next를 적어요.
  // encodeURIComponent: "/" 같은 글자를 %2F처럼 주소에 안전한 글자로 바꿔, next 값 안에 넣어도 주소가 깨지지 않게 해요.
  if (!(await isAdmin())) redirect(`/login?next=${encodeURIComponent(`/write/${slug}`)}`);

  if (!isGitHubConfigured()) {
    return (
      <EditLayout title="리뷰 수정">
        <NotConfigured />
      </EditLayout>
    );
  }

  // 저장소에서 최신 원고를 읽어요. GitHub에 닿지 못하면 이유를 보여 줘요.
  // `Awaited<ReturnType<typeof loadReviewSource>>`: "loadReviewSource가 돌려주는 Promise를 기다린 값"의 타입이에요
  //   ({ source, sha } 또는 null). let으로 먼저 만들고 try 안에서 값을 넣어요.
  let review: Awaited<ReturnType<typeof loadReviewSource>>;
  try {
    review = await loadReviewSource(slug);
  } catch (error) {
    // instanceof: 오류가 GitHubError 종류인지 확인해요. 맞으면 그 안내 문구를, 아니면 일반 문구를 써요.
    const message = error instanceof GitHubError ? error.message : "원고를 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.";
    return (
      <EditLayout title="리뷰 수정">
        {/* role="alert": 화면 낭독기가 바로 읽어 줘요. alert-text: 경고 글자 모양(globals.css) */}
        <p role="alert" className="alert-text">
          {message}
        </p>
      </EditLayout>
    );
  }
  // 저장소에 없는 리뷰면 404 화면으로
  if (!review) notFound();

  // 원고(JSON 글자)를 여기(서버)에서 칸 값으로 바꿔 넘겨요(lib/review-file.ts).
  const result = parseReviewFile(review.source);
  // 읽기에 성공하면 칸 값을, 실패하면(원고 모양이 틀림) 그 이유를 담아 폼에 넘겨요.
  const parsed: EditSource = result.ok ? { ok: true, values: result.values } : { ok: false, message: result.message };

  return (
    <EditLayout title={`리뷰 수정: ${slug}`}>
      {/* baseSha: 읽어 온 원고의 내용 번호. 저장할 때 함께 보내, 그사이 저장소의 원고가 바뀌었으면 덮어쓰지 않게 해요. */}
      <ReviewWriter mode="edit" slug={slug} parsed={parsed} baseSha={review.sha} />
    </EditLayout>
  );
}

/**
 * 수정 화면의 틀: 제목(h1)과 내용
 * 세 갈래(설정 없음, 읽기 실패, 정상)가 같은 틀을 쓰도록 이 파일 안에서만 쓰는 작은 컴포넌트로 뺐어요.
 *
 * @param title 제목 글자
 * @param children 제목 아래에 넣을 내용
 * @returns section 요소
 */
function EditLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-labelledby="write-title" className="grid gap-8">
      <h1 id="write-title" className="glow text-big">
        {title}
      </h1>
      {children}
    </section>
  );
}
