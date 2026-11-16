/**
 * @file 글쓰기 화면을 불러오는 동안 보이는 화면 (app/write/loading.tsx)
 * 읽는 순서: 48/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/app/write/[slug]/page.tsx → 다음: src/components/skeleton.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   리뷰 추가(/write)·수정(/write/<파일 이름>) 화면을 준비하는 동안, 글쓰기 화면의 모양을 본뜬 스켈레톤을 먼저 보여 줘요.
 *   제목 자리에 "글쓰기 화면을 불러오는 중▮ [■■■□□□]"를 그려요.
 *   수정 화면은 저장소(GitHub)에서 원고를 읽어 오느라 조금 걸려서, 이 화면이 자주 보여요.
 *   (목록 화면은 미리 만든 화면이라 loading.tsx를 두지 않아요. 두면 화면을 열 때마다 스켈레톤이 번쩍여요. components/skeleton.tsx 참고)
 *
 * 누가 쓰나요?
 *   Next.js가 정한 이름(loading.tsx)이라 /write와 그 아래(/write/<파일 이름>)로 갈 때 저절로 쓰여요.
 *   Next.js는 page.tsx를 React의 Suspense로 감싸고, 준비되기 전까지 이 화면을 대신 보여 줘요.
 */

// LoadingStatus: "불러오는 중▮ [■■□□]" 로딩 UI, WriterSkeleton: 글쓰기 화면 모양의 스켈레톤
import { LoadingStatus } from "@/components/loading-status";
import { WriterSkeleton } from "@/components/skeleton";

/**
 * 글쓰기 화면을 불러오는 동안의 화면
 *
 * @returns 첫 줄에 로딩 UI를 넣은 글쓰기 스켈레톤
 */
export default function WriteLoading() {
  // min-h-7.5: 실제 제목(24px 글자, 30px 줄)과 같은 높이라, 내용이 들어와도 아래가 밀리지 않아요.
  // (Tailwind v4는 7.5처럼 소수 단계도 써요. 7.5 × 0.25rem = 1.875rem = 30px)
  // status={<… />}: JSX 요소를 값으로 넘길 수 있어요. 받은 쪽(WriterSkeleton)이 그 자리에 그려요.
  return <WriterSkeleton status={<LoadingStatus label="글쓰기 화면을 불러오는 중" className="min-h-7.5" />} />;
}
