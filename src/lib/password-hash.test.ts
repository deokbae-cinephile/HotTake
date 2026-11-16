// @vitest-environment node
// ↑ node:crypto를 쓰는 서버 코드라 브라우저 흉내(jsdom) 없이 Node.js 환경에서 돌려요.

/**
 * @file password-hash.ts 테스트
 *
 * 비밀번호를 해시로 바꾸고, 같은 비밀번호만 맞다고 하는지 확인해요.
 * 망가진 해시(모양이 틀린 저장값)로는 어떤 비밀번호도 통과하지 못해야 해요.
 *
 * 테스트 도구 문법
 *   expect(글자).toMatch(정규식): 글자가 정규식 모양과 맞는지 확인해요.
 *   expect(a).not.toBe(b): a와 b가 달라야 통과해요(.not은 뜻을 뒤집어요).
 *   it.each([...])(이름, 함수): 배열의 값마다 같은 테스트를 되풀이해요. 이름의 %s 자리에 값이 들어가요.
 */

import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password-hash";

describe("hashPassword / verifyPassword", () => {
  it("만든 해시는 같은 비밀번호로만 확인된다", async () => {
    const hash = await hashPassword("영화 좋아 2026!");
    // "scrypt.소금.결과" 모양인지. [\w-]+: 영문·숫자·_·- 글자가 1개 이상(base64url 글자)
    expect(hash).toMatch(/^scrypt\.[\w-]+\.[\w-]+$/);
    expect(await verifyPassword("영화 좋아 2026!", hash)).toBe(true);
    // 한 글자만 달라도 통과하지 못해요.
    expect(await verifyPassword("영화 좋아 2025!", hash)).toBe(false);
  });

  it("같은 비밀번호라도 소금이 달라 해시가 매번 다르다", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("한글 조합 방식(NFC·NFD)이 달라도 같은 비밀번호로 본다", async () => {
    // NFC: "비"를 한 글자로 저장, NFD: "ㅂ+ㅣ"처럼 조각으로 저장. 눈에는 같아 보여요.
    const hash = await hashPassword("비밀".normalize("NFC"));
    expect(await verifyPassword("비밀".normalize("NFD"), hash)).toBe(true);
  });

  // 빈 값, 해시가 아닌 글자, 조각이 둘뿐, 다른 이름표, 조각이 넷
  it.each(["", "plain-password", "scrypt.only-two", "bcrypt.a.b", "scrypt.AAAA.BBBB.extra"])(
    "모양이 틀린 저장값 %s로는 확인되지 않는다",
    async (stored) => {
      expect(await verifyPassword("anything", stored)).toBe(false);
    },
  );
});
