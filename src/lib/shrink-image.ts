/**
 * @file 이미지 줄이기 (shrink-image.ts)
 * 읽는 순서: 44/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/lib/upload-rules.ts → 다음: src/lib/admin-api.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면에서 이미지를 고르면, 올리기 전에 브라우저 안에서 알맞은 크기의 JPG로 줄여요.
 *
 *     휴대폰 사진(4000 × 3000px, 3~8MB) ──줄이기──> 긴 변 800px JPG(보통 50~150KB)
 *
 *   - 블로그에서 이미지는 목록 썸네일(최대 70px)과 글쓰기 화면의 미리보기(가로 최대 224px)로만 보여요.
 *     긴 변 800px이면 고해상도 화면(2~3배 촘촘한 화면)에서도 넉넉해요. 더 크면 저장소에 무겁게 쌓이기만 해요.
 *   - 저장소(GitHub)와 이미지 올리기 요청(4MB 한도)이 가벼워지고, 4MB가 넘는 휴대폰 사진도 그대로 고를 수 있어요.
 *   - JPG는 어디서나 보이는 형식이에요. (블로그 화면에서는 이미지 최적화를 거쳐 브라우저에 맞는 가벼운 형식으로 바뀌어 보여요.)
 *
 * 줄이지 않는 때
 *   - 이미 작은 JPG·PNG: 긴 변이 800px 이하이고 256KB 이하면 화질을 지키려고 그대로 둬요. (WebP·AVIF는 작아도 JPG로 바꿔요.)
 *   - 브라우저가 읽지 못하는 형식이면 그대로 둬요(이미지 올리기 API가 다시 확인해요).
 *   - 다시 만든 파일이 더 크면 원래 파일을 써요.
 *
 * 어떻게 줄이나요?
 *   이미지를 <img>로 읽고(휴대폰 사진의 회전 정보도 브라우저가 맞춰 줘요), 줄인 크기의 그림판(canvas)에 그린 뒤 JPG로 저장해요.
 *   JPG는 투명을 담지 못해서 투명한 곳은 흰색으로 채워요.
 *
 * 누가 쓰나요?
 *   components/review-writer.tsx(이미지 고르기): 고른 이미지를 shrinkImage로 줄여 미리보기와 올리기에 써요.
 *
 * 이 파일은 브라우저에서만 돌아요
 *   Image, document, canvas, URL.createObjectURL은 브라우저가 주는 도구라 서버(Node.js)에는 없어요.
 *   글쓰기 화면("use client" 컴포넌트)에서 파일을 고른 뒤에만 불러요.
 */

/** 줄인 이미지의 긴 변 최대 길이(px) */
export const MAX_IMAGE_SIDE = 800;

/**
 * 이 크기(256KB) 이하의 파일은(긴 변도 맞으면) 다시 만들지 않아요. 화질을 지키려고요.
 * 긴 변 800px의 사진 JPG는 보통 이보다 가벼워서, 이보다 무거우면(예: 사진을 담은 PNG) JPG로 다시 만들어 가볍게 해요.
 */
const KEEP_BYTES = 256 * 1024;

/** 다시 만들 때의 화질(0~1). 사진은 0.85면 눈으로 차이를 거의 느끼지 못해요. */
const QUALITY = 0.85;

/**
 * 긴 변이 max를 넘지 않게 가로·세로를 같은 비율로 줄인 크기(정수 px)예요. 이미 작으면 그대로예요.
 *
 * @param width 원래 가로(px)
 * @param height 원래 세로(px)
 * @param max 긴 변의 최대 길이. 넘기지 않으면 MAX_IMAGE_SIDE(800)
 * @returns 줄인 { width, height }
 * @example
 * fitWithin(4000, 3000); // { width: 800, height: 600 }
 * fitWithin(600, 400);   // { width: 600, height: 400 }
 */
export function fitWithin(width: number, height: number, max = MAX_IMAGE_SIDE): { width: number; height: number } {
  // 줄일 비율: 긴 변을 max로 맞추는 비율. 이미 작으면 1보다 커지므로 Math.min(1, ...)으로 키우지 않게 막아요.
  // 예: 4000 × 3000 → 800 / 4000 = 0.2
  const scale = Math.min(1, max / Math.max(width, height));
  // Math.round로 정수 px로 맞추고, 줄여도 1px보다 작아지지 않게 Math.max(1, ...)로 막아요.
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * 파일 이름의 확장자를 바꿔요. 확장자가 없으면 붙여요.
 * lastIndexOf("."): 마지막 점의 위치(없으면 -1). slice(0, 위치): 그 앞까지의 글자
 *
 * @param name 원래 파일 이름
 * @param extension 새 확장자(점 없이). 예: "jpg"
 * @returns 확장자를 바꾼 파일 이름
 * @example withExtension("Cover.PNG", "jpg"); // "Cover.jpg"
 */
export function withExtension(name: string, extension: string): string {
  const dot = name.lastIndexOf(".");
  return `${dot === -1 ? name : name.slice(0, dot)}.${extension}`;
}

/**
 * 줄이기 결과: 쓸 파일과, 줄였는지(다시 만들었는지)
 * File은 브라우저가 주는 "파일" 타입이에요(이름, 크기, 형식, 내용).
 */
export type ShrinkResult = { file: File; shrunk: boolean };

/** 다시 만들지 않고 그대로 둬도 되는 형식(어디서나 보이는 형식). Set은 has로 빠르게 찾는 "모음"이에요. */
const KEEPABLE_TYPES = new Set(["image/jpeg", "image/png"]);

/**
 * 그림판(canvas)의 그림을 파일 덩어리(Blob)로 만들어요. 만들지 못하면 null
 *
 * canvas.toBlob은 결과를 "다 되면 부를 함수(콜백)"로 넘겨줘요. await로 기다릴 수 있게 Promise로 감쌌어요.
 * new Promise((resolve) => ...): resolve를 부르는 순간 Promise가 그 값으로 끝나요. 여기서는 resolve를 콜백으로 바로 넘겨요.
 *
 * @param canvas 그림을 그린 그림판
 * @param type 만들 형식. 예: "image/jpeg"
 * @returns Blob 또는 null을 담은 Promise
 */
function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
}

/**
 * 이미지를 알맞은 크기의 JPG로 줄여요(위의 "줄이지 않는 때"에는 원래 파일 그대로).
 *
 * `async` 함수는 기다리는 일(await)을 할 수 있고, 결과를 Promise(나중에 오는 값)로 돌려줘요.
 *
 * @param file 고른 이미지 파일
 * @returns 쓸 파일과 줄였는지. 줄였으면 이름의 확장자도 jpg로 바뀌어요.
 */
export async function shrinkImage(file: File): Promise<ShrinkResult> {
  // 줄이지 않을 때 돌려줄 값. 여러 곳에서 "원래 파일 그대로"를 돌려줘서 미리 만들어 둬요.
  const original = { file, shrunk: false };

  // 이미지를 <img>로 읽어요. 임시 주소(blob:)는 다 쓰면 지워요(finally: 성공하든 실패하든 마지막에 꼭 돌아요).
  let url = "";
  try {
    // createObjectURL: 내 컴퓨터의 파일을 잠깐 가리키는 주소(blob:...)를 만들어요. 서버에 올리지 않고도 <img>로 읽을 수 있어요.
    url = URL.createObjectURL(file);
    // new Image(): 화면에 붙이지 않은 <img> 요소를 만들어요.
    const image = new Image();
    image.src = url;
    // decode(): 이미지를 다 읽을 때까지 기다려요. 읽지 못하는 형식이면 오류가 나서 원래 파일을 써요(catch).
    await image.decode();

    // naturalWidth·naturalHeight: 이미지의 실제 크기(휴대폰 사진의 회전도 맞춘 크기)
    // `{ naturalWidth: width }`: naturalWidth를 꺼내 width라는 이름으로 써요(구조 분해 + 이름 바꾸기).
    const { naturalWidth: width, naturalHeight: height } = image;
    // 크기를 알 수 없으면(읽기에 실패한 것과 같아요) 원래 파일을 써요.
    if (width === 0 || height === 0) return original;
    const target = fitWithin(width, height);
    // 줄일 필요가 없는 크기인지, 그대로 둬도 되는 형식(file.type: "image/jpeg" 같은 MIME 타입)인지
    const sameSize = target.width === width && target.height === height;
    const keepableType = KEEPABLE_TYPES.has(file.type);
    // 셋 다 맞으면(작고, 가볍고, JPG·PNG) 다시 만들지 않아요.
    if (sameSize && file.size <= KEEP_BYTES && keepableType) return original;

    // 줄인 크기의 그림판(canvas)을 만들어요. 화면에는 붙이지 않고 그리기용으로만 써요.
    const canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    // getContext("2d"): 그림판에 그리는 붓(2D 그리기 도구)을 받아요. 받지 못하면 null이에요.
    const context = canvas.getContext("2d");
    if (!context) return original;
    // JPG는 투명을 담지 못해서, 투명한 곳이 검게 되지 않게 먼저 흰색으로 칠해요.
    context.fillStyle = "#fff";
    // fillRect(x, y, 가로, 세로): 왼쪽 위(0, 0)부터 그림판 전체를 칠해요.
    context.fillRect(0, 0, target.width, target.height);
    // 줄일 때 계단 현상이 덜하게 가장 고운 방식으로 그려요.
    context.imageSmoothingQuality = "high";
    // drawImage(이미지, x, y, 가로, 세로): 이미지를 정한 크기로 늘이거나 줄여 그려요.
    context.drawImage(image, 0, 0, target.width, target.height);

    const blob = await toBlob(canvas, "image/jpeg");
    if (!blob) return original;
    // 크기도 형식도 그대로 둬도 되는데 다시 만든 파일이 더 크면, 원래 파일이 나아요.
    if (sameSize && keepableType && blob.size >= file.size) return original;

    // new File([내용], 이름, { 형식 }): 줄인 내용으로 새 파일을 만들어요. 이름의 확장자도 jpg로 바꿔요.
    return { file: new File([blob], withExtension(file.name, "jpg"), { type: blob.type, lastModified: file.lastModified }), shrunk: true };
  } catch {
    // 읽기·그리기 가운데 어디서든 실패하면 원래 파일을 써요. 이미지 올리기 API가 다시 확인해요.
    return original;
  } finally {
    // 만든 임시 주소를 지워 메모리를 돌려줘요.
    if (url) URL.revokeObjectURL(url);
  }
}
