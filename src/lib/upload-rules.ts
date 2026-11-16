/**
 * @file 이미지 올리기 규칙 (upload-rules.ts)
 * 읽는 순서: 43/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/lib/review-form.ts → 다음: src/lib/shrink-image.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   리뷰 이미지(영화 이미지, 도서 표지 등)를 올릴 때의 규칙(최대 크기, 받는 형식, 저장 경로 모양)을 한곳에 모아 둬요.
 *   글쓰기 화면은 고르자마자 이 규칙으로 먼저 알려 주고, 이미지 올리기 API는 같은 규칙으로 다시 확인해요.
 *   그리고 파일 앞부분을 읽어 "정말 그림 파일인지" 알아내는 함수(checkImage)도 여기 있어요.
 *
 * 누가 쓰나요?
 *   - components/review-writer.tsx(화면): extensionOf, IMAGE_ACCEPT, uploadProblem
 *   - app/api/images/route.ts(서버): checkImage, extensionOf, MAX_IMAGE_BYTES, UPLOAD_PATH
 *
 * 바이트를 읽는 코드를 위한 배경 지식
 *   - 파일은 0~255 숫자(바이트)의 줄이에요. Uint8Array는 그 줄을 담는 배열이고, bytes[0]이 첫 바이트예요.
 *   - 0xff처럼 0x로 시작하는 숫자는 16진수예요(0xff = 255, 0x89 = 137). 파일 형식 문서가 16진수로 적어서 그대로 써요.
 *   - 여러 바이트로 큰 수를 적을 때, 큰 자리부터 적으면 "big-endian(be)", 작은 자리부터면 "little-endian(le)"이에요.
 *   - 비트 연산: `a << 8`은 a를 256배(왼쪽으로 8비트 밀기), `a | b`는 두 수의 비트 합치기, `a & 0x3fff`는 아래 14비트만 남기기,
 *     `x >>> 0`은 결과를 0 이상의 수(부호 없는 32비트)로 맞추기예요.
 *   - `bytes[i] ?? 0`: 파일이 짧아 그 자리가 없으면(undefined) 0으로 봐요.
 */

/**
 * 이미지 한 장의 최대 크기: 4MB(4 × 1024 × 1024바이트).
 * 요청 하나가 하는 일(CPU·메모리)이 Cloudflare Workers 한도 안에 머물게 정했어요.
 * (글쓰기 화면은 올리기 전에 이미지를 줄여서 보통은 이보다 훨씬 작아요. lib/shrink-image.ts)
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** 받는 확장자. 모든 브라우저가 보여 줄 수 있는 형식만 골랐어요. `as const`로 정확한 글자들의 목록이 돼요. */
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif"] as const;

/**
 * 파일 고르기 창에 "이 형식만 보여 줘"라고 알려 줄 값(<input type="file" accept="...">)
 * "image/jpeg" 같은 글자는 MIME 타입(파일 종류의 표준 이름)이에요. 쉼표로 여러 개를 적어요.
 */
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/**
 * 받을 수 있는 저장 경로 모양이에요: public/images/<파일 이름>.<jpg|jpeg|png|webp|avif>
 * 이 리뷰의 경로가 맞는지는 저장할 때 lib/review-store.ts가 파일 이름과 함께 다시 확인해요.
 * 정규식 안의 `\/`는 슬래시(/) 글자 그대로예요. /.../가 정규식의 처음과 끝이라 안의 /는 \를 붙여 적어요.
 */
export const UPLOAD_PATH = /^public\/images\/[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png|webp|avif)$/;

/**
 * 파일 이름에서 확장자를 소문자로 꺼내요. 확장자가 없으면 ""예요.
 * lastIndexOf("."): 마지막 점의 위치(없으면 -1). slice(위치 + 1): 그 뒤의 글자들
 *
 * @param name 파일 이름. 예: "Cover.JPG"
 * @returns 소문자 확장자. 예: "jpg"
 * @example extensionOf("Cover.JPG"); // "jpg"
 */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/**
 * 고른 파일을 받을 수 있는지 확인하고, 안 되면 이유와 고치는 방법을 돌려줘요. 되면 null이에요.
 *
 * @param file 고른 파일(이름과 크기만 봐요. 진짜 그림인지는 서버가 파일 앞부분을 읽어 확인해요)
 *   `{ name: string; size: number }`만 있으면 되어서, 브라우저의 File도 테스트의 보통 객체도 넘길 수 있어요.
 * @returns 받을 수 없으면 이유와 고치는 방법, 받을 수 있으면 null
 * @example uploadProblem({ name: "photo.heic", size: 1000 }); // "photo.heic: 이미지는 JPG·PNG·WebP·AVIF ..."
 */
export function uploadProblem(file: { name: string; size: number }): string | null {
  // (IMAGE_EXTENSIONS as readonly string[]): 정해진 글자들의 배열을 "글자 배열"로 넓혀, 아무 확장자나 includes로 물어볼 수 있게 해요.
  if (!(IMAGE_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
    return `${file.name}: 이미지는 JPG·PNG·WebP·AVIF 그림만 넣을 수 있습니다. 아이폰 사진(HEIC)은 JPG로 바꿔 넣어 주세요.`;
  }
  // size는 바이트 수예요. 4MB(MAX_IMAGE_BYTES)보다 크면 받지 않아요.
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: 이미지가 4MB보다 큽니다. 크기를 줄여 다시 넣어 주세요.`;
  return null;
}

/** 파일 앞부분으로 알아낼 수 있는 그림 형식(모든 브라우저가 보여 줄 수 있는 것만) */
export type ImageType = "jpg" | "png" | "webp" | "avif";

/**
 * 글자 몇 개를 바이트(글자 번호)로 바꿔 파일 앞부분과 견줘요.
 * text.split(""): 글자 하나씩 나눈 배열. charCodeAt(0): 그 글자의 번호(예: "R" → 82).
 *
 * @param bytes 파일 내용
 * @param start 견주기 시작할 자리(0부터)
 * @param text 견줄 영문 글자. 예: "RIFF"
 * @returns start 자리부터 text와 같은 바이트가 이어지면 true
 */
const ascii = (bytes: Uint8Array, start: number, text: string) =>
  text.split("").every((char, index) => bytes[start + index] === char.charCodeAt(0));

/**
 * 파일 앞부분(형식마다 정해진 "서명" 바이트)을 보고 실제 그림 형식을 알아내요. 모르는 형식이면 undefined예요.
 * 확장자는 바꿔 붙일 수 있어서, 이미지 올리기 API가 진짜 그림인지 확인할 때 써요(큰 라이브러리 없이 몇 바이트만 봐요).
 *
 *   JPG  : FF D8 FF
 *   PNG  : 89 50 4E 47 0D 0A 1A 0A ("\x89PNG\r\n\x1a\n")
 *   WebP : "RIFF" + (크기 4바이트) + "WEBP"
 *   AVIF : (상자 크기 4바이트) + "ftyp" + 상표 목록에 "avif" 또는 "avis"
 *          아이폰 사진(HEIC)도 같은 ftyp 모양이지만 상표가 "heic" 등이라 걸러져요.
 *
 * @param bytes 파일 내용(앞부분만 있어도 돼요)
 * @returns "jpg" | "png" | "webp" | "avif", 모르면 undefined
 * @example sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])); // "jpg"
 */
export function sniffImageType(bytes: Uint8Array): ImageType | undefined {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte)) return "png";
  if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return "webp";
  if (ascii(bytes, 4, "ftyp")) {
    // ftyp 상자의 크기(앞 4바이트, 큰 자리부터)만큼 안에서 상표(4글자씩)를 찾아요: 8번째 바이트부터 주 상표, 16번째부터 함께 쓰는 상표들.
    // 바이트 4개를 큰 자리부터 이어 붙여 하나의 수로 만들어요(<< 24, << 16, << 8로 자리를 옮긴 뒤 |로 합치기).
    const boxSize = (((bytes[0] ?? 0) << 24) | ((bytes[1] ?? 0) << 16) | ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0)) >>> 0;
    // 상자 크기와 파일 길이 가운데 작은 쪽까지만 봐요(파일 밖을 읽지 않게).
    const end = Math.min(boxSize, bytes.length);
    // offset: 8(주 상표) → 16(12~15는 판 번호라 건너뜀) → 20 → 24 ... 처럼 4바이트씩 나아가요.
    for (let offset = 8; offset + 4 <= end; offset += offset === 8 ? 8 : 4) {
      if (ascii(bytes, offset, "avif") || ascii(bytes, offset, "avis")) return "avif";
    }
  }
  return undefined;
}

/**
 * 큰 자리부터 읽는 2바이트·4바이트 수(PNG·JPEG 머리)
 * @example u16be(new Uint8Array([0x01, 0x00]), 0) // 256
 */
const u16be = (bytes: Uint8Array, at: number) => ((bytes[at] ?? 0) << 8) | (bytes[at + 1] ?? 0);
const u32be = (bytes: Uint8Array, at: number) => ((u16be(bytes, at) << 16) | u16be(bytes, at + 2)) >>> 0;
/**
 * 작은 자리부터 읽는 2바이트 수(WebP 머리)
 * @example u16le(new Uint8Array([0x00, 0x01]), 0) // 256
 */
const u16le = (bytes: Uint8Array, at: number) => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);

/**
 * JPEG 안에 그림 틀(SOF: 가로·세로를 적는 덩어리)이 있는지 봐요. 덩어리(마커 FF xx + 길이)를 차례로 건너뛰며 찾아요.
 * 그림 데이터(SOS)나 끝(EOI)이 먼저 나오거나, 모양이 틀어지면 false예요.
 *
 * JPEG 덩어리 모양: [FF][종류 1바이트][길이 2바이트(길이 칸 자신 포함)][내용 ...]
 * SOF 덩어리 내용: [정밀도 1바이트][세로 2바이트][가로 2바이트] ... → 그래서 at+5가 세로, at+7이 가로예요.
 *
 * @param bytes 파일 내용 전체
 * @returns 가로·세로가 있는 그림 틀을 찾으면 true
 */
function jpegHasFrame(bytes: Uint8Array): boolean {
  let at = 2; // FF D8(시작) 다음부터
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff) return false;
    // 덩어리 종류(마커). 위의 while 조건으로 이 자리가 있는 것을 확인해서 `!`(없을 리 없음)를 붙여요.
    const marker = bytes[at + 1]!;
    // 채움 바이트(FF FF …)와 길이 없는 표시(RSTn D0~D7, TEM 01)는 2바이트만 건너뛰어요.
    if (marker === 0xff) {
      at += 1;
      continue;
    }
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      at += 2;
      continue;
    }
    // D9(EOI, 끝)이나 DA(SOS, 그림 데이터 시작)가 그림 틀보다 먼저 나오면 틀이 없는 파일이에요.
    if (marker === 0xd9 || marker === 0xda) return false;
    // SOF0~SOF15(C0~CF) 가운데 C4(DHT)·C8(JPG)·CC(DAC)는 그림 틀이 아니에요.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return at + 9 <= bytes.length && u16be(bytes, at + 5) > 0 && u16be(bytes, at + 7) > 0;
    }
    // 그 밖의 덩어리는 길이만큼 건너뛰어 다음 덩어리로 가요. 길이는 길이 칸(2바이트)을 포함해서 2보다 작을 수 없어요.
    const length = u16be(bytes, at + 2);
    if (length < 2) return false;
    at += 2 + length;
  }
  return false;
}

/**
 * WebP의 첫 덩어리(12번째 바이트부터)를 읽어 가로·세로가 있는지 봐요.
 *   VP8 (손실 압축)   : 시작 표시 9D 01 2A 뒤에 가로·세로(14비트씩)가 0보다 커요.
 *   VP8L(무손실 압축) : 서명 바이트 2F가 있어요(뒤의 가로·세로는 "값 - 1"로 적혀 늘 1 이상이에요).
 *   VP8X(확장)        : 캔버스 가로·세로("값 - 1", 3바이트씩)까지 다 들어 있어요.
 *
 * @param bytes 파일 내용 전체(앞 12바이트는 "RIFF" + 크기 + "WEBP")
 * @returns 가로·세로를 읽을 수 있으면 true
 */
function webpHasSize(bytes: Uint8Array): boolean {
  if (ascii(bytes, 12, "VP8 ")) {
    // 23~25번째 바이트가 시작 표시(9D 01 2A), 26·28번째부터 가로·세로(아래 14비트만 크기라 & 0x3fff로 남겨요)
    return bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a && (u16le(bytes, 26) & 0x3fff) > 0 && (u16le(bytes, 28) & 0x3fff) > 0;
  }
  if (ascii(bytes, 12, "VP8L")) return bytes.length >= 25 && bytes[20] === 0x2f;
  // VP8X: 캔버스 가로·세로는 "값 - 1"(3바이트씩, 24·27번째부터)로 적혀 늘 1 이상이라, 머리가 다 들어 있는지만 봐요.
  if (ascii(bytes, 12, "VP8X")) return bytes.length >= 30;
  return false;
}

/**
 * ISO 상자(AVIF 등) 하나: 이름, 내용이 시작하는 자리, 끝 자리
 * AVIF 파일은 "상자 안에 상자"가 든 구조(ISO 기본 미디어 파일 형식)예요.
 */
type Box = { type: string; body: number; end: number };

/**
 * start~end 사이의 상자들을 차례로 읽어요. 상자는 [크기 4바이트][이름 4글자][내용] 모양이에요.
 * 크기 1은 "뒤의 8바이트가 진짜 크기", 0은 "끝까지"라는 뜻이에요. 모양이 틀어지면(잘린 파일 등) 거기서 멈춰요.
 *
 * @param bytes 파일 내용 전체
 * @param start 읽기 시작할 자리
 * @param end 읽기를 멈출 자리(이 자리는 넣지 않아요)
 * @returns 찾은 상자 목록(순서대로)
 */
function readBoxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let at = start;
  while (at + 8 <= end) {
    // 상자 크기와, 크기·이름 칸이 차지하는 머리 길이(보통 8바이트)
    let size = u32be(bytes, at);
    let header = 8;
    if (size === 1) {
      if (at + 16 > end) break;
      // 8바이트 크기: 앞 4바이트 × 2의 32제곱 + 뒤 4바이트. `**`는 거듭제곱이에요.
      size = u32be(bytes, at + 8) * 2 ** 32 + u32be(bytes, at + 12);
      header = 16;
    } else if (size === 0) {
      size = end - at;
    }
    // 크기가 머리보다 작거나 범위를 넘으면 망가진 상자라 멈춰요(break: 반복을 끝내요).
    if (size < header || at + size > end) break;
    // String.fromCharCode(...바이트들): 바이트 4개를 글자 4개(상자 이름)로 바꿔요. subarray는 배열의 일부를 복사 없이 가리켜요.
    boxes.push({ type: String.fromCharCode(...bytes.subarray(at + 4, at + 8)), body: at + header, end: at + size });
    at += size;
  }
  return boxes;
}

/**
 * AVIF 안의 그림 크기 상자(ispe)를 상자 구조를 따라 찾아, 가로·세로가 0보다 큰지 봐요.
 *   meta(앞 4바이트는 판 번호·표시) → iprp → ipco → ispe(앞 4바이트 판 번호·표시, 가로 4바이트, 세로 4바이트)
 * 글자 "ispe"만 찾지 않고 구조를 따라가서, 상표 목록 같은 엉뚱한 곳의 글자에 속지 않아요.
 *
 * @param bytes 파일 내용 전체
 * @returns 가로·세로가 0보다 큰 ispe 상자를 찾으면 true
 */
function avifHasSize(bytes: Uint8Array): boolean {
  // child: 상자 box 안(앞 skip바이트를 건너뛴 뒤)에서 이름이 type인 첫 상자를 찾아요. box가 없으면 undefined예요.
  const child = (box: Box | undefined, type: string, skip = 0) => (box ? readBoxes(bytes, box.body + skip, box.end).find((item) => item.type === type) : undefined);
  const meta = readBoxes(bytes, 0, bytes.length).find((box) => box.type === "meta");
  // meta는 앞 4바이트(판 번호·표시)를 건너뛰고 iprp를 찾고, 그 안에서 ipco를 찾아요.
  const ipco = child(child(meta, "iprp", 4), "ipco");
  if (!ipco) return false;
  // ipco 안의 상자 가운데 ispe가 하나라도(some) 있고, 가로(body+4)·세로(body+8)가 0보다 크면 통과
  return readBoxes(bytes, ipco.body, ipco.end).some(
    (box) => box.type === "ispe" && box.end - box.body >= 12 && u32be(bytes, box.body + 4) > 0 && u32be(bytes, box.body + 8) > 0,
  );
}

/**
 * 진짜 그림인지 확인해요: 서명으로 형식을 알아낸 뒤(sniffImageType), 그 형식의 머리(헤더)가 제대로 있는지도 봐요.
 * 서명만 맞고 내용이 없는 파일(예: PNG 서명 8바이트뿐인 파일)은 화면에 보이지 않으니 받지 않아요.
 *
 *   PNG  : 첫 덩어리가 IHDR이고 가로·세로가 0보다 커요.
 *   WebP : 첫 덩어리(VP8·VP8L·VP8X)의 머리를 읽어 가로·세로가 있어요.
 *   JPEG : 그림 틀(SOF)이 있고 가로·세로가 0보다 커요.
 *   AVIF : 상자 구조(meta → iprp → ipco → ispe)를 따라간 그림 크기 상자의 가로·세로가 0보다 커요.
 *
 * @param bytes 파일 내용 전체
 * @returns 진짜 그림이면 형식, 아니면 undefined
 */
export function checkImage(bytes: Uint8Array): ImageType | undefined {
  const type = sniffImageType(bytes);
  let ok = false;
  // PNG: 8바이트 서명 뒤 12번째부터 "IHDR", 16번째부터 가로, 20번째부터 세로(4바이트씩). 33바이트는 서명 + IHDR 덩어리 전체 길이예요.
  if (type === "png") ok = bytes.length >= 33 && ascii(bytes, 12, "IHDR") && u32be(bytes, 16) > 0 && u32be(bytes, 20) > 0;
  else if (type === "webp") ok = webpHasSize(bytes);
  else if (type === "jpg") ok = jpegHasFrame(bytes);
  else if (type === "avif") ok = avifHasSize(bytes);
  return ok ? type : undefined;
}
