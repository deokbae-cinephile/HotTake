/**
 * @file 형광 초록 색 값 (palette.ts)
 * 읽는 순서: 8/84번째 · 3단계(화면의 뼈대와 공통 모양)
 *   앞: src/app/globals.css → 다음: src/lib/pixel-path.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   블로그의 기본 인광 색(형광 초록)을 자바스크립트 값으로 모아 둬요.
 *
 * 왜 CSS 변수가 있는데 또 적나요?
 *   화면 색은 globals.css의 CSS 변수(--phosphor 등)로 정해요. 그런데 CSS를 읽을 수 없는 곳이 있어요.
 *     - 앱 아이콘 만들기(scripts/make-icons.mjs): 빌드 밖에서 도는 스크립트
 *   그런 곳은 이 값을 써요. globals.css의 :root 기본 색과 같아야 해서 palette.test.ts가 둘을 비교해요.
 *
 * 색 값 읽는 법
 *   "#39ff14"처럼 # 뒤의 여섯 글자는 16진수로 적은 빨강·초록·파랑 세기예요(두 글자씩, 00~ff).
 *   "39 ff 14"는 초록(ff)이 가장 센 밝은 형광 초록이에요.
 *
 * 누가 쓰나요?
 *   scripts/make-icons.mjs(아이콘·공유 미리 보기 그림 만들기), lib/palette.test.ts(globals.css와 비교)
 */

/**
 * 형광 초록 인광 색(globals.css :root의 기본 색 묶음과 같아요)
 * 인광(phosphor): 옛 CRT 모니터 화면에 바른, 빛을 받으면 빛나는 물질이에요. 그 초록빛을 흉내 내요.
 * `as const`: 값이 바뀌지 않는 읽기 전용 객체로 고정해요.
 */
export const GREEN_PHOSPHOR = {
  /** 글자(--phosphor) */
  phosphor: "#39ff14",
  /** 보조 글자(--phosphor-dim) */
  dim: "#2ad40e",
  /** 선(--phosphor-line) */
  line: "#178a0a",
  /** 화면 바탕(--screen) */
  screen: "#020802",
  /** 반전 영역의 글자(--ink) */
  ink: "#021002",
} as const;
