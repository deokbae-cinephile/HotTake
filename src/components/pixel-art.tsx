/**
 * @file 픽셀 그림 컴포넌트 (pixel-art.tsx)
 * 읽는 순서: 10/84번째 · 3단계(화면의 뼈대와 공통 모양)
 *   앞: src/lib/pixel-path.ts → 다음: src/lib/logo.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글자로 그린 격자 그림을 SVG(벡터 그림)로 바꿔 화면에 그립니다.
 *
 *   예를 들어 아래 글자 그림을 넣으면
 *       "..#.."
 *       ".###."
 *       "#####"
 *   '#' 칸만 색칠한 작은 픽셀 그림(삼각형)이 나와요.
 *
 * 왜 이미지 파일 대신 이렇게 그릴까요?
 *   1. 픽셀 글꼴(갈무리11)의 기호만으로는 로고와 아이콘을 그릴 수 없어서 직접 그려요.
 *   2. 색을 CSS로 정할 수 있어요(currentColor). 초록 화면에서는 초록, 반전 영역에서는 검게 바뀝니다.
 *   3. 아무리 키워도 칸이 흐려지지 않아요(shape-rendering="crispEdges").
 *
 * 누가 쓰나요?
 *   components/site-header.tsx(로고와 GitHub 아이콘),
 *   components/review-image.tsx(기본 이미지의 그림 액자), components/floating-buttons.tsx(떠 있는 단추 아이콘),
 *   components/review-list-admin.tsx·delete-review.tsx(고치기·지우기 아이콘), components/review-writer.tsx(글쓰기 화면 아이콘)
 *
 * 이 파일은 서버 컴포넌트예요("use client"가 없어요). 다만 클라이언트 컴포넌트가 import하면 그쪽과 함께 브라우저에서도 돌아요.
 */

// `import type`: 타입만 가져와요. 실행 코드에는 남지 않고 TypeScript 검사에만 쓰여요.
// SVGProps: <svg> 요소가 받을 수 있는 속성 전체의 타입이에요.
import type { SVGProps } from "react";

// 글자 그림을 SVG 경로 명령으로 바꾸는 함수예요. 아이콘 스크립트도 함께 쓰려고 lib에 두었어요.
import { pixelPath } from "@/lib/pixel-path";

/**
 * PixelArt 컴포넌트가 받는 값(props)의 모양이에요.
 *
 * `Omit<SVGProps<SVGSVGElement>, ...>`: SVG가 원래 받을 수 있는 속성(className, data-* 등)을 모두 받되,
 * 우리가 직접 계산하는 width, height, viewBox와 children은 빼요(Omit = 빼기).
 * 그리고 `& { ... }`로 우리만의 값(rows, cell, label)을 더합니다.
 * `SVGProps<SVGSVGElement>`의 꺾쇠(<>)는 "제네릭": 어떤 요소의 속성인지(여기서는 svg 요소) 타입을 넘겨줘요.
 */
type Props = Omit<SVGProps<SVGSVGElement>, "children" | "width" | "height" | "viewBox"> & {
  /**
   * 글자 그림. '#'은 글자색(currentColor), '+'는 보조색(--pixel-secondary), 나머지 글자는 빈칸이에요.
   * `readonly string[]`: 읽기만 하는 글자 배열. `as const`로 만든 배열도 받을 수 있게 readonly로 둬요.
   */
  rows: readonly string[];
  /** 한 칸의 크기(px). 픽셀이 흐려지지 않도록 정수로 줍니다. 기본 2px */
  cell?: number;
  /** 뜻이 있는 그림이면 이름을 줘요. 없으면 꾸밈 그림으로 보고 화면 낭독기가 읽지 않게 숨깁니다. */
  label?: string;
};

/**
 * 글자 격자로 그린 픽셀 그림을 SVG로 보여 줍니다.
 *
 * @param props.rows 글자 그림(줄마다 글자 하나가 한 칸)
 * @param props.cell 한 칸의 화면 크기(px, 기본 2)
 * @param props.label 그림 이름. 없으면 꾸밈 그림으로 숨겨요.
 * @param props.rest 그 밖의 svg 속성(className 등). 그대로 svg에 붙어요.
 * @returns 칸 수 × cell 크기의 svg 요소
 *
 * @example
 * <PixelArt rows={["#.#", ".#.", "#.#"]} cell={4} />          // 꾸밈 그림(읽지 않음)
 * <PixelArt rows={LOGO_ROWS} label="HotTake 로고" /> // 뜻이 있는 그림(이름을 읽음)
 */
export function PixelArt({ rows, cell = 2, label, ...rest }: Props) {
  // `cell = 2`: cell을 주지 않으면 2를 써요(기본값). `...rest`: 이름으로 꺼내지 않은 나머지 값을 모두 rest에 모아요.
  // 그림의 가로 칸 수 = 가장 긴 줄의 글자 수, 세로 칸 수 = 줄 수
  // `...배열`은 배열을 펼쳐 Math.max(값1, 값2, ...)처럼 넘겨주는 문법이에요.
  // rows.map((row) => row.length): 줄마다 글자 수를 세어 새 배열을 만들어요. 예: ["##.", "#"] → [3, 1]
  const width = Math.max(...rows.map((row) => row.length));
  const height = rows.length;

  // 접근성(a11y) 속성 정하기
  //  - label이 있으면 role="img"와 aria-label로 "이 그림의 이름은 ~"라고 알려 줘요.
  //  - 없으면 aria-hidden으로 숨겨, 화면 낭독기가 의미 없는 그림을 읽지 않게 해요.
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };

  return (
    <svg
      // viewBox: 그림 안에서 쓰는 좌표 범위예요. 한 칸을 1로 두고 그립니다.
      viewBox={`0 0 ${width} ${height}`}
      // 실제 화면 크기 = 칸 수 × 한 칸 크기. viewBox보다 크면 그림이 그만큼 확대돼요.
      width={width * cell}
      height={height * cell}
      // 확대할 때 가장자리를 부드럽게 다듬지 말고 또렷하게 그리라는 설정이에요. 픽셀 그림에 꼭 필요합니다.
      shapeRendering="crispEdges"
      {...a11y}
      // 밖에서 넘겨준 나머지 속성(className, data-fill 등)을 그대로 붙여요.
      {...rest}
    >
      {/* '+' 칸: 보조색. CSS 변수 --pixel-secondary가 없으면 글자색(currentColor)을 씁니다.
          pixelPath(rows, "+"): 그 글자가 있는 칸들을 모아 SVG 경로 명령(d)으로 만들어요. 칸마다 사각형을 따로 그리지 않아 가벼워요. */}
      <path d={pixelPath(rows, "+")} fill="var(--pixel-secondary, currentColor)" />
      {/* '#' 칸: 글자색. 주변 글자 색(color)을 그대로 따라가요. */}
      <path d={pixelPath(rows, "#")} fill="currentColor" />
    </svg>
  );
}
