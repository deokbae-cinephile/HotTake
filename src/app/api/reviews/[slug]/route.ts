/**
 * @file 리뷰 수정·삭제 API (app/api/reviews/[slug]/route.ts → 주소 "/api/reviews/<파일 이름>")
 * 읽는 순서: 58/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/app/api/reviews/route.ts → 다음: src/lib/action-icons.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   - PUT    /api/reviews/winter-stop : 고친 내용(칸 값 + 새로 올린 이미지 + 처음 원고 sha)을 검사하고 커밋해요.
 *   - DELETE /api/reviews/winter-stop : 원고(content/reviews/winter-stop.json)와 그 리뷰의 이미지를 지우는 커밋을 올려요.
 *     (다른 리뷰 원고도 쓰는 이미지는 지우지 않아요. lib/review-store.ts 참고)
 *
 * 답(JSON)
 *   - 수정 성공(200): { slug, commitSha } / 삭제 성공(200): { title, commitSha }
 *   - 실패: { message, errors? }
 *
 * 폴더 이름의 [slug]는 "이 자리에 아무 파일 이름이나 올 수 있다"는 뜻이에요(동적 라우트).
 *   slug: 주소에 쓰는 짧은 영문 이름이에요. 이 블로그에서는 원고 파일 이름(.json을 뺀 것)과 같아요. 예: winter-stop
 * 두 번째 매개변수(ctx)의 params에서 실제 파일 이름을 꺼내요. Next.js 15부터 params는 Promise라서 await로 꺼내요.
 * RouteContext<"/api/reviews/[slug]">: Next.js가 이 주소 모양을 보고 params의 타입을 만들어 주는 도우미 타입이에요.
 *   (따로 import하지 않아도 Next.js가 만들어 둔 전역 타입이라 바로 쓸 수 있어요.)
 *
 * 로그인했는지는 proxy.ts가 먼저, 여기서 한 번 더 확인해요. 실제 일은 lib/review-store.ts가 해요.
 *
 * 누가 쓰나요?
 *   lib/admin-api.ts의 updateReview(components/review-writer.tsx), deleteReview(components/delete-review.tsx)
 */

import type { NextRequest } from "next/server";

import { guardAdminRequest } from "@/lib/admin-auth";
import { errorResponse, readJson } from "@/lib/api-response";
import { deleteReview, readSavePayload, saveReview } from "@/lib/review-store";

/**
 * 리뷰 수정. 이름이 PUT인 함수는 "PUT 요청이 오면 부를 함수"예요.
 *
 * @param request 들어온 요청(JSON 본문)
 * @param ctx 주소에서 꺼낸 값. ctx.params는 { slug }를 돌려주는 Promise예요.
 * @returns 성공하면 { slug, commitSha }, 실패하면 { message, errors? }와 오류 상태 번호
 */
export async function PUT(request: NextRequest, ctx: RouteContext<"/api/reviews/[slug]">) {
  // 1) 로그인했고 우리 화면에서 보낸 요청인지
  const denied = await guardAdminRequest(request);
  if (denied) return denied;

  // 2) 보낸 JSON이 약속한 모양인지(틀리면 null)
  const payload = readSavePayload(await readJson(request));
  if (!payload) {
    return Response.json({ message: "보낸 내용의 모양이 올바르지 않습니다. 화면을 새로 고친 뒤 다시 저장해 주세요." }, { status: 400 });
  }

  // 3) 저장은 lib/review-store.ts에 맡겨요.
  try {
    // 수정할 때는 파일 이름을 바꾸지 않아요. 칸 값의 slug 대신 요청 주소의 slug를 써요.
    // `const { slug } = await ctx.params`: Promise를 기다린 뒤 그 안의 slug 항목만 꺼내요(구조 분해).
    const { slug } = await ctx.params;
    return Response.json(await saveReview("update", slug, payload));
  } catch (error) {
    // 그사이 다른 곳에서 고침(409)·칸 오류(422)·GitHub 문제 등을 화면이 알아듣는 응답으로 바꿔요.
    return errorResponse(error);
  }
}

/**
 * 리뷰 삭제. 이름이 DELETE인 함수는 "DELETE 요청이 오면 부를 함수"예요. 본문 없이 주소의 파일 이름만 써요.
 *
 * @param request 들어온 요청
 * @param ctx 주소에서 꺼낸 값(params의 slug)
 * @returns 성공하면 { title, commitSha }, 실패하면 { message }와 오류 상태 번호
 */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/reviews/[slug]">) {
  const denied = await guardAdminRequest(request);
  if (denied) return denied;

  try {
    const { slug } = await ctx.params;
    return Response.json(await deleteReview(slug));
  } catch (error) {
    // 이미 지워져 없음(404)·GitHub 문제 등
    return errorResponse(error);
  }
}
