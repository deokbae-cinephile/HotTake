/**
 * @file 리뷰 추가 API (app/api/reviews/route.ts → 주소 "/api/reviews")
 * 읽는 순서: 57/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/app/api/images/route.ts → 다음: src/app/api/reviews/[slug]/route.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   POST /api/reviews : 글쓰기 화면이 보낸 새 리뷰(칸 값 + 새로 올린 이미지)를 검사하고 저장소에 커밋해요.
 *   저장소 main 브랜치에 커밋이 올라가면 GitHub Actions(.github/workflows/ci.yml)가 검사·빌드한 뒤
 *   Cloudflare Workers에 배포해서, 몇 분 뒤 목록에 새 리뷰가 보여요.
 *
 * 받는 것(JSON): { values: 칸 값, upload?: 새로 올린 이미지 { path, sha } } — lib/admin-api.ts의 SaveRequest
 *
 * 답(JSON)
 *   - 성공(201 Created: "새로 만들었어요"): { slug(파일 이름), commitSha(커밋 번호) }
 *   - 실패: { message, errors? } — errors는 칸마다 오류 문구(예: { title: "제목을 입력하세요." })
 *
 * 로그인했는지는 proxy.ts가 먼저, 여기서 한 번 더 확인해요. 실제 저장 일은 lib/review-store.ts가 해요.
 *
 * 누가 쓰나요?
 *   lib/admin-api.ts의 createReview(글쓰기 화면 components/review-writer.tsx가 불러요)
 */

import type { NextRequest } from "next/server";

import { guardAdminRequest } from "@/lib/admin-auth";
import { errorResponse, readJson } from "@/lib/api-response";
import { readSavePayload, saveReview } from "@/lib/review-store";

/**
 * 리뷰 추가. Next.js는 route.ts에서 이름이 POST인 함수를 "POST 요청이 오면 부를 함수"로 써요.
 *
 * @param request 들어온 요청(JSON 본문)
 * @returns 성공하면 201과 { slug, commitSha }, 실패하면 { message, errors? }와 오류 상태 번호
 */
export async function POST(request: NextRequest) {
  // 1) 로그인했고 우리 화면에서 보낸 요청인지. 문제가 있으면 오류 응답을 그대로 돌려줘요.
  const denied = await guardAdminRequest(request);
  if (denied) return denied;

  // 2) 보낸 JSON이 약속한 모양인지 검사해요. 틀리면 오류를 던지지 않고 null을 돌려줘요.
  const payload = readSavePayload(await readJson(request));
  if (!payload) {
    return Response.json({ message: "보낸 내용의 모양이 올바르지 않습니다. 화면을 새로 고친 뒤 다시 저장해 주세요." }, { status: 400 });
  }

  // 3) 저장(칸 검사, 파일 이름 겹침 확인, 커밋)은 lib/review-store.ts에 맡겨요.
  try {
    // 새 리뷰의 파일 이름은 칸에 적은 파일 이름(values.slug)이에요.
    const result = await saveReview("create", payload.values.slug, payload);
    return Response.json(result, { status: 201 });
  } catch (error) {
    // 칸 오류(422)·파일 이름 겹침(409)·GitHub 문제 등을 화면이 알아듣는 응답으로 바꿔요.
    return errorResponse(error);
  }
}
