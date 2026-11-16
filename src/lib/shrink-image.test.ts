/**
 * @file shrink-image.ts 테스트
 *
 * 이미지 줄이기의 계산(긴 변 1600px에 맞추기, 확장자 바꾸기, 크기 글자)과
 * 줄이지 않는 때(GIF, 브라우저가 읽지 못하는 이미지)를 확인해요.
 * 실제로 그림판(canvas)에 그려 JPG로 줄이는 일은 jsdom(가짜 브라우저)이 하지 못해서, 진짜 브라우저 E2E에서 확인해요
 * (e2e/admin.spec.ts의 "큰 사진은 줄여서 올린다").
 *
 * 테스트 도구 문법
 *   - expect(값).toEqual({ ... }) : 객체의 내용이 같은지 확인해요.
 *   - async () => { await ... }   : Promise를 돌려주는 함수(shrinkImage)는 await로 결과를 기다린 뒤 확인해요.
 *   - new File([내용], 이름, { type }) : 테스트용 파일을 만들어요(브라우저의 File과 같은 모양).
 */

import { describe, expect, it } from "vitest";

import { fitWithin, MAX_IMAGE_SIDE, shrinkImage, withExtension } from "./shrink-image";

describe("fitWithin", () => {
  it("긴 변이 1600px를 넘으면 같은 비율로 줄인다(가로·세로 어느 쪽이 길어도)", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    // 세로가 긴 경우: 1000 × (1600 / 3000) = 533.3… → 반올림해서 533
    expect(fitWithin(1000, 3000)).toEqual({ width: 533, height: MAX_IMAGE_SIDE });
  });

  it("이미 작으면 그대로 둔다", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    // 딱 1600px이면 줄이지 않아요(경계 값).
    expect(fitWithin(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("아주 가는 사진도 1px보다 작아지지 않는다", () => {
    expect(fitWithin(10000, 1)).toEqual({ width: 1600, height: 1 });
  });
});

describe("withExtension", () => {
  it("확장자를 바꾸거나 붙인다", () => {
    expect(withExtension("Cover.PNG", "webp")).toBe("Cover.webp");
    expect(withExtension("a.b.jpeg", "jpg")).toBe("a.b.jpg");
    expect(withExtension("cover", "webp")).toBe("cover.webp");
  });

});

describe("shrinkImage", () => {
  it("GIF는 움직이는 그림일 수 있어 그대로 둔다", async () => {
    // jsdom은 이미지를 읽지(decode) 못해서 catch로 가 원래 파일을 돌려줘요. (글쓰기 화면은 GIF를 고르면 uploadProblem으로 먼저 막아요.)
    const gif = new File(["GIF89a"], "loop.gif", { type: "image/gif" });
    expect(await shrinkImage(gif)).toEqual({ file: gif, shrunk: false });
  });

  it("브라우저가 읽지 못하는 이미지는 그대로 둔다(이미지 올리기 API가 다시 확인해요)", async () => {
    const broken = new File(["not an image"], "broken.jpg", { type: "image/jpeg" });
    expect(await shrinkImage(broken)).toEqual({ file: broken, shrunk: false });
  });
});
