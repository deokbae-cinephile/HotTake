/**
 * @file 이미지 올리기 API (app/api/images/route.ts → 주소 "/api/images")
 * 읽는 순서: 56/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/lib/api-response.ts → 다음: src/app/api/reviews/route.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   POST /api/images : 리뷰 이미지(영화나 도서의 그림) 파일 하나를 받아 GitHub 저장소에 blob(파일 덩어리)으로 올리고,
 *                      그 내용 번호(sha)를 돌려줘요. 아직 커밋 전이라 블로그에는 보이지 않아요.
 *   리뷰를 저장할 때(app/api/reviews) 이 번호를 함께 보내면, 원고와 이미지가 커밋 하나로 올라가요.
 *
 * 왜 이미지를 따로 먼저 올리나요?
 *   Cloudflare Workers는 요청 하나가 쓸 수 있는 CPU 시간과 메모리(128MB)에 한도가 있어요.
 *   원고와 이미지를 한 요청에 담으면 일이 커져 한도를 넘기 쉬워서, 이미지는 따로(최대 4MB) 먼저 보내요.
 *
 * 받는 것(multipart/form-data: 파일을 담아 보내는 요청 모양)
 *   - file: 그림 파일
 *   - path: 저장소 안 경로. 예: public/images/winter-stop.jpg
 *
 * 답(JSON)
 *   - 성공(200): { path, sha }
 *   - 실패: { message } — 400(모양·경로가 틀림), 401(로그인 필요), 403(다른 사이트), 413(너무 큼), 415(그림이 아님) 등
 *
 * 원본 파일은 고치지 않아요. 화면에서만 형광 초록으로 바꿔 보여 줘요(SVG 필터, app/layout.tsx).
 * 로그인했는지는 proxy.ts가 먼저, 여기서 한 번 더 확인해요(이중 잠금).
 *
 * Next.js 약속: route.ts (Route Handler)
 *   app 폴더 안의 route.ts에서 GET, POST 같은 이름의 함수를 내보내면 그 주소의 API가 돼요. 요청이 올 때마다 서버에서 실행돼요.
 *
 * 누가 쓰나요?
 *   lib/admin-api.ts의 uploadImage(글쓰기 화면 components/review-writer.tsx가 불러요)
 */

import type { NextRequest } from "next/server";

import { guardAdminRequest } from "@/lib/admin-auth";
import { errorResponse } from "@/lib/api-response";
import { createBlob } from "@/lib/github";
// 최대 크기와 저장 경로 모양은 글쓰기 화면과 함께 쓰는 규칙이에요(lib/upload-rules.ts).
// (route.ts에서는 GET·POST 같은 정해진 이름만 내보낼 수 있어서, 함께 쓰는 값은 lib에 둬요.)
import { checkImage, extensionOf, MAX_IMAGE_BYTES, UPLOAD_PATH } from "@/lib/upload-rules";

/**
 * 경로의 확장자가 실제 그림 형식(checkImage가 알려 준 이름)과 맞는지. jpeg는 jpg로 봐요.
 *
 * @param path 저장소 안 경로. 예: "public/images/winter-stop.jpeg"
 * @param type 실제 형식. 예: "jpg"
 * @returns 맞으면 true
 * @example
 * extensionMatches("public/images/winter-stop.jpeg", "jpg"); // true
 */
function extensionMatches(path: string, type: string): boolean {
  return extensionOf(path).replace("jpeg", "jpg") === type;
}

/**
 * 이미지 올리기. Next.js는 route.ts에서 이름이 POST인 함수를 "POST 요청이 오면 부를 함수"로 써요.
 *
 * @param request 들어온 요청(파일이 든 FormData 본문)
 * @returns 성공하면 { path, sha }, 실패하면 { message }와 오류 상태 번호
 */
export async function POST(request: NextRequest) {
  // 1) 로그인했고 우리 화면에서 보낸 요청인지
  const denied = await guardAdminRequest(request);
  if (denied) return denied;

  // 2) 보낸 내용 꺼내기. formData()는 파일이 든 요청(multipart)을 읽어요. 모양이 틀리면 null로 봐요.
  const form = await request.formData().catch(() => null);
  // form?.get(이름): form이 null이면 undefined, 아니면 그 이름의 칸 값(파일 또는 글자)
  const file = form?.get("file");
  const path = form?.get("path");
  // instanceof File: 파일인지, typeof … === "string": 글자인지 확인해요. 둘 중 하나라도 아니면 잘못 보낸 요청이에요.
  if (!(file instanceof File) || typeof path !== "string") {
    return Response.json({ message: "이미지 파일과 저장할 경로를 함께 보내 주세요." }, { status: 400 });
  }
  // 경로가 public/images/<영문 소문자·숫자·->.<확장자> 모양인지(다른 폴더에 쓰거나 "../"로 빠져나가지 못하게)
  if (!UPLOAD_PATH.test(path)) {
    return Response.json({ message: "이미지를 저장할 경로가 올바르지 않습니다. 화면을 새로 고친 뒤 다시 넣어 주세요." }, { status: 400 });
  }
  // file.size: 파일 크기(바이트). 413 Content Too Large: "보낸 내용이 너무 커요"
  if (file.size > MAX_IMAGE_BYTES) {
    return Response.json({ message: "이미지가 4MB보다 큽니다. 크기를 줄여 다시 넣어 주세요." }, { status: 413 });
  }

  // 3) 진짜 그림인지 확인해요. 확장자는 바꿔 붙일 수 있어서, 파일 앞부분을 읽어 실제 형식을 알아내요.
  //    checkImage는 JPG·PNG·WebP·AVIF의 서명과 머리(가로·세로 등)를 봐요. 아니면 undefined예요. lib/upload-rules.ts
  //    file.arrayBuffer(): 파일 내용을 통째로 읽어요. Uint8Array로 감싸 한 바이트씩 볼 수 있게 해요.
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = checkImage(bytes);
  // 415 Unsupported Media Type: "받을 수 없는 파일 형식이에요"
  if (!type || !extensionMatches(path, type)) {
    return Response.json(
      { message: "JPG·PNG·WebP·AVIF 그림만 넣을 수 있습니다. 아이폰 사진(HEIC)은 JPG로 바꿔 넣어 주세요." },
      { status: 415 },
    );
  }

  // 4) 저장소에 blob으로 올리고 번호를 돌려줘요.
  try {
    const sha = await createBlob(bytes);
    // 상태 번호를 적지 않으면 200(성공)이에요.
    return Response.json({ path, sha });
  } catch (error) {
    // GitHub 문제 등은 lib/api-response.ts가 화면용 문구와 상태 번호로 바꿔요.
    return errorResponse(error);
  }
}
