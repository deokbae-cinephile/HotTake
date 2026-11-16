/**
 * @file upload-rules.ts 테스트
 *
 * 이미지를 고르자마자 받을 수 있는지 알려 주는 규칙(형식·크기)과, 저장 경로 모양을 확인해요.
 * 또 파일 앞부분의 바이트만 보고 진짜 그림인지 알아내는지(sniffImageType, checkImage) 확인해요.
 * 진짜 그림 파일 대신, 형식 문서에 적힌 머리 모양대로 바이트를 직접 만들어 넣어요(작고 빠르게 시험하려고요).
 *
 * 테스트 도구 문법
 *   - it.each([[이름, 값], ...])("%s ...", (이름, 값) => ...) : 짝마다 테스트를 한 번씩 돌려요.
 *   - toBeNull / toBeUndefined / toContain                      : null인지 / undefined인지 / 글자가 들어 있는지
 *
 * 숫자 표기: 0xff처럼 0x로 시작하면 16진수예요(0xff = 255). 바이트 하나는 0~255예요.
 */

import { describe, expect, it } from "vitest";

import { checkImage, extensionOf, MAX_IMAGE_BYTES, sniffImageType, UPLOAD_PATH, uploadProblem } from "./upload-rules";

describe("extensionOf", () => {
  it("확장자를 소문자로 꺼내고, 없으면 빈 글자다", () => {
    expect(extensionOf("Cover.JPG")).toBe("jpg");
    // 점이 여럿이면 마지막 점 뒤가 확장자예요.
    expect(extensionOf("a.b.webp")).toBe("webp");
    expect(extensionOf("noext")).toBe("");
  });
});

describe("uploadProblem", () => {
  it("받을 수 있는 그림이면 문제가 없다", () => {
    expect(uploadProblem({ name: "a.jpeg", size: 1000 })).toBeNull();
    expect(uploadProblem({ name: "b.WEBP", size: 1000 })).toBeNull();
  });

  it("GIF는 받지 않고, 아이폰 사진(HEIC)은 JPG로 바꾸라고 알려 준다", () => {
    expect(uploadProblem({ name: "a.gif", size: 1000 })).toContain("이미지는 JPG·PNG·WebP·AVIF");
    expect(uploadProblem({ name: "IMG_0001.HEIC", size: 1000 })).toContain("JPG로 바꿔");
  });

  it("4MB보다 크면 줄여 달라고 알려 준다", () => {
    // 한도보다 딱 1바이트 큰 파일. 경계 값으로 확인해요.
    expect(uploadProblem({ name: "big.jpg", size: MAX_IMAGE_BYTES + 1 })).toContain("4MB보다 큽니다");
  });
});

describe("UPLOAD_PATH", () => {
  it.each(["public/images/winter-stop.jpg", "public/images/a-1.avif"])("%s는 받는다", (path) => {
    expect(UPLOAD_PATH.test(path)).toBe(true);
  });

  // 받지 않는 확장자, 폴더 거슬러 오르기(../), 다른 폴더, 하위 폴더, 다른 폴더 이름
  it.each(["public/images/winter-stop.gif", "public/images/../secret.jpg", "content/reviews/a.json", "public/images/a/b.jpg", "public/covers/a.jpg"])(
    "%s는 받지 않는다",
    (path) => {
      expect(UPLOAD_PATH.test(path)).toBe(false);
    },
  );
});

describe("sniffImageType(파일 앞부분으로 그림 형식 알아내기)", () => {
  /**
   * 글자와 숫자를 섞어 파일 앞부분을 만들어요. 글자는 한 글자에 한 바이트예요.
   * `...parts`(나머지 매개변수): 넘긴 인자를 모두 배열 하나로 받아요. head("RIFF", [1, 2]) → parts = ["RIFF", [1, 2]]
   * flatMap: 항목마다 배열을 만든 뒤 한 줄로 이어 붙여요. 글자는 글자 번호들로, 숫자 배열은 그대로 들어가요.
   */
  const head = (...parts: (string | number[])[]) =>
    new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? part.split("").map((char) => char.charCodeAt(0)) : part)));
  /** AVIF·HEIC 모양: 상자 크기(4바이트) + "ftyp" + 주 상표 + 판 번호(4바이트) + 함께 쓰는 상표들 */
  const ftyp = (major: string, ...compatible: string[]) => head([0, 0, 0, 16 + compatible.length * 4], "ftyp", major, [0, 0, 0, 0], ...compatible);

  it.each([
    ["jpg", head([0xff, 0xd8, 0xff, 0xe0])],
    ["png", head([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a])],
    ["webp", head("RIFF", [1, 2, 3, 4], "WEBP")],
    ["avif", ftyp("avif", "mif1")],
    ["avif", ftyp("mif1", "miaf", "avif")],
  ])("%s 서명을 알아본다", (type, bytes) => {
    expect(sniffImageType(bytes)).toBe(type);
  });

  it.each([
    ["글자 파일", head("hello")],
    ["아이폰 사진(HEIC)", ftyp("heic", "mif1", "heix")],
    ["빈 파일", head()],
    ["RIFF지만 WebP가 아닌 파일(WAV)", head("RIFF", [1, 2, 3, 4], "WAVE")],
  ])("%s는 모르는 형식(undefined)", (_name, bytes) => {
    expect(sniffImageType(bytes)).toBeUndefined();
  });
});

describe("checkImage(서명과 머리까지 보고 진짜 그림인지 확인)", () => {
  // 위 묶음의 head와 같은 도우미예요(describe마다 따로 둬서 묶음끼리 섞이지 않게 했어요).
  const head = (...parts: (string | number[])[]) =>
    new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? part.split("").map((char) => char.charCodeAt(0)) : part)));
  /** 수 하나를 4바이트로, 큰 자리부터 적어요. `>>> 24`로 자리를 내리고 `& 255`로 한 바이트만 남겨요. */
  const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  /** PNG 머리: 서명 + IHDR 덩어리(길이 13, 가로, 세로, 비트 깊이 등) + CRC */
  const png = (width: number, height: number) => head(PNG_SIGNATURE, be32(13), "IHDR", be32(width), be32(height), [8, 2, 0, 0, 0], [0, 0, 0, 0]);
  /** 4바이트 큰 자리부터 크기를 적은 상자: [크기][이름][내용]. 크기는 머리 8바이트 + 내용 길이예요. */
  const box = (type: string, ...body: (string | number[])[]) => {
    const content = head(...body);
    return head(be32(8 + content.length), type, [...content]);
  };
  /** AVIF 머리: ftyp + meta(판 번호·표시) → iprp → ipco → ispe(판 번호·표시, 가로, 세로) */
  const avif = (width: number, height: number) =>
    head(
      [...box("ftyp", "avif", [0, 0, 0, 0], "mif1", "miaf")],
      [...box("meta", [0, 0, 0, 0], [...box("iprp", [...box("ipco", [...box("ispe", [0, 0, 0, 0], be32(width), be32(height))])])])],
    );
  /** WebP(VP8, 손실 압축) 머리. 가로·세로는 작은 자리부터(& 255가 아래 바이트, >> 8이 위 바이트) 적어요: RIFF + WEBP + VP8 덩어리(크기, 프레임 표시 3바이트, 시작 표시 9D 01 2A, 가로·세로 2바이트씩) */
  const webp = (width: number, height: number) =>
    head("RIFF", [22, 0, 0, 0], "WEBP", "VP8 ", [10, 0, 0, 0], [0, 0, 0], [0x9d, 0x01, 0x2a], [width & 255, width >> 8, height & 255, height >> 8]);
  /** JPEG 머리: 시작(FFD8) + APP0(JFIF, 길이 16) + SOF0(길이 17, 정밀도, 세로, 가로) */
  const jpeg = (width: number, height: number) =>
    head([0xff, 0xd8], [0xff, 0xe0, 0, 16], "JFIF", [0, 1, 1, 0, 0, 1, 0, 1, 0, 0], [0xff, 0xc0, 0, 17, 8], [height >> 8, height & 255, width >> 8, width & 255], [3]);

  it.each([
    ["png", png(200, 300)],
    ["jpg", jpeg(1600, 1200)],
    ["webp", webp(1600, 1200)],
    // VP8L(무손실)은 서명 바이트 2F, VP8X(확장)는 머리 길이만 갖추면 돼요. Array(n).fill(0): 0을 n개 채운 배열
    ["webp", head("RIFF", [22, 0, 0, 0], "WEBP", "VP8L", [10, 0, 0, 0], [0x2f], Array(8).fill(0))],
    ["webp", head("RIFF", [22, 0, 0, 0], "WEBP", "VP8X", [10, 0, 0, 0], Array(10).fill(0))],
    ["avif", avif(1600, 1200)],
  ])("머리까지 갖춘 %s는 받는다", (type, bytes) => {
    expect(checkImage(bytes)).toBe(type);
  });

  it.each([
    ["서명 8바이트뿐인 PNG", head(PNG_SIGNATURE)],
    ["가로가 0인 PNG", png(0, 300)],
    ["그림 틀(SOF) 없이 끝나는 JPEG", head([0xff, 0xd8], [0xff, 0xe0, 0, 4, 0, 0], [0xff, 0xd9])],
    ["GIF(받지 않는 형식)", head("GIF89a", [200, 0, 44, 1], [0, 0, 0])],
    ["VP8 덩어리가 없는 WebP", head("RIFF", [22, 0, 0, 0], "WEBP", "JUNK", Array(14).fill(0))],
    ["가로·세로가 0인 WebP(VP8)", webp(0, 0)],
    ["시작 표시가 없는 WebP(VP8)", head("RIFF", [22, 0, 0, 0], "WEBP", "VP8 ", Array(18).fill(0))],
    ["서명 바이트가 없는 WebP(VP8L)", head("RIFF", [22, 0, 0, 0], "WEBP", "VP8L", [10, 0, 0, 0], [0], Array(8).fill(0))],
    ["크기 상자(ispe)가 없는 AVIF", head([0, 0, 0, 16], "ftyp", "avif", [0, 0, 0, 0])],
    // 글자만 찾는 방식이면 속을 파일이에요. 상자 구조를 따라가서 막아야 해요.
    ["상표 목록에만 'ispe' 글자가 있는 AVIF", box("ftyp", "avif", [0, 0, 0, 0], "ispe", "ispe")],
    ["가로·세로가 0인 AVIF", avif(0, 0)],
  ])("%s는 받지 않는다", (_name, bytes) => {
    expect(checkImage(bytes)).toBeUndefined();
  });
});
