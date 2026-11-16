/**
 * @file API 오류 응답 만들기 (api-response.ts)
 * 읽는 순서: 55/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/lib/review-store.ts → 다음: src/app/api/images/route.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   저장 API에서 생긴 오류를 화면이 알아듣는 JSON 응답 { message, errors? }으로 바꿔요.
 *   화면(lib/admin-api.ts)은 message를 알림으로, errors를 칸마다 오류 문구로 보여 줘요.
 *   요청 본문(JSON)을 안전하게 읽는 readJson도 여기 있어요.
 *
 * 여러 API가 같은 방법으로 오류를 돌려주게 하려고 한곳에 모았어요.
 *
 * 누가 쓰나요?
 *   app/api/images/route.ts, app/api/reviews/route.ts, app/api/reviews/[slug]/route.ts(errorResponse·readJson),
 *   app/api/session/route.ts(readJson)
 */

// 서버에서만 쓰는 파일이에요. 브라우저 코드에서 가져오면 빌드가 오류를 내요.
import "server-only";

import { GitHubError } from "./github";
import { ReviewStoreError } from "./review-store";

/**
 * 오류를 HTTP 응답으로 바꿔요.
 *
 * - ReviewStoreError: 우리가 일부러 멈춘 경우(칸 오류, 파일 이름 겹침 등). 상태 번호와 문구를 그대로 돌려줘요.
 * - GitHubError: GitHub와 이야기하다 생긴 문제. 4xx는 서버 설정 문제라 502(중간 서버 문제)로 바꿔 알려요.
 * - 그 밖의 오류: 예상하지 못한 문제. 자세한 내용은 서버 기록(console.error)에만 남기고, 화면에는 다시 시도하라고 알려요.
 *
 * `instanceof`: 값이 어떤 class로 만든 것인지 확인해요. 오류 종류에 따라 다르게 답하려고 써요.
 *
 * @param error try…catch로 잡은 오류. 무엇이 던져졌는지 모르니 unknown 타입이에요.
 * @returns 화면에 돌려줄 응답
 * @example
 * try {
 *   return Response.json(await saveReview(...));
 * } catch (error) {
 *   return errorResponse(error);
 * }
 */
export function errorResponse(error: unknown): Response {
  if (error instanceof ReviewStoreError) {
    return Response.json({ message: error.message, errors: error.errors }, { status: error.status });
  }
  if (error instanceof GitHubError) {
    // 503(설정 없음)은 그대로, 그 밖에는 502로 바꿔요. 브라우저 입장에서는 "서버 뒤쪽(GitHub)에서 생긴 문제"예요.
    return Response.json({ message: error.message }, { status: error.status === 503 ? 503 : 502 });
  }
  // 예상하지 못한 오류는 서버 기록에 남겨 나중에 원인을 찾을 수 있게 해요. 화면에는 자세한 내용을 보이지 않아요.
  console.error(error);
  return Response.json({ message: "저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요." }, { status: 500 });
}

/**
 * 요청 본문(JSON)을 읽어요. JSON이 아니면 null이에요.
 * request.json()은 모양이 틀리면 오류를 던져서, catch로 받아 null로 바꿔요.
 * 그래서 부르는 쪽은 try…catch 없이 "null이면 잘못 보낸 요청"으로만 보면 돼요.
 *
 * @param request 들어온 요청
 * @returns 읽은 값(아직 모양을 확인하지 않아 unknown) 또는 null
 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    // `return await`: try 안에서 기다려야, 읽다가 실패했을 때 아래 catch가 잡을 수 있어요.
    return await request.json();
  } catch {
    return null;
  }
}
