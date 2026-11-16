/**
 * @file 리뷰 이미지 (review-image.tsx)
 * 읽는 순서: 22/84번째 · 4단계(처음 화면: 작품 목록)
 *   앞: src/components/review-list-item.tsx → 다음: src/components/loading-image.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   리뷰의 이미지(영화 포스터·도서 표지 같은 작품 그림)를 "형광 초록 CRT 화면"에 맞게 바꿔 보여 줍니다.
 *   이미지를 올리지 않은 리뷰는 기본 이미지(그림 액자 픽셀 아이콘 + NO IMAGE)를 대신 보여 줘요.
 *   이미지 파일은 public/images 폴더에 있고, 원고(content/reviews/<파일 이름>.json)의 image 항목에 그 파일을 적어요.
 *
 * 배경 개념: CRT
 *   CRT(Cathode Ray Tube, 브라운관)는 옛날 텔레비전·모니터 화면이에요. 검은 바탕에 형광 초록 글자가 빛나던 화면을 흉내 내요.
 *
 * 어떻게 초록으로 바뀌나요?
 *   원본 이미지 파일은 그대로 두고, 화면에 그릴 때만 CSS 필터(filter: url(#crt-phosphor))를 씌워요.
 *   필터는 app/layout.tsx에 넣어 둔 SVG 필터예요. 이런 순서로 색을 바꿉니다.
 *     1. 흑백으로 바꾸기(밝기만 남기기)
 *     2. 밝기를 4단계로 줄이기(옛 화면처럼 계단진 명암)
 *     3. 밝기를 형광 초록으로 칠하기
 *   그 위에 촘촘한 주사선 무늬를 덮어 브라운관 느낌을 더해요(globals.css의 .image-frame).
 *
 * 비율은 늘 가로 2 : 세로 3이에요
 *   상자를 2:3으로 고정하고(aspect-[2/3]) 그림을 꽉 채워요(object-cover). 비율이 다른 그림은 가운데를 기준으로 잘려요.
 *
 * 크기 두 가지
 *   - thumb: 목록의 썸네일
 *   - large: 글쓰기 화면의 미리보기에 쓰는 큰 기본 이미지(components/review-writer.tsx)
 *
 * 늘 꾸밈 그림이에요(접근성)
 *   이미지는 바로 옆에 작품 제목이 있어서, 화면 낭독기가 같은 말을 두 번 읽지 않게 대체 텍스트를 비워요(alt="").
 *   기본 이미지(픽셀 아이콘)도 화면 낭독기에서 통째로 숨겨요(aria-hidden).
 *
 * 누가 쓰나요?
 *   components/review-list-item.tsx(목록 썸네일: ReviewImage)
 *   components/review-writer.tsx(이미지를 고르기 전 미리보기 자리: DefaultImage)
 */

// 이 파일에는 "use client"가 없어서 서버 컴포넌트예요. 빌드할 때 HTML로 그려지고, 브라우저로 코드가 가지 않아요.
// (단, 클라이언트 컴포넌트가 이 파일을 import하면 그쪽과 함께 브라우저로 가요. review-writer.tsx가 DefaultImage를 그렇게 써요.)

// LoadingImage: 그림이 오기 전까지 스켈레톤(옅은 초록 칸)을 깔아 두는 그림 요소(같은 폴더의 loading-image.tsx)
import { LoadingImage } from "./loading-image";
// PixelArt: "#"과 "."로 적은 글자 그림을 SVG로 바꿔 그리는 컴포넌트(pixel-art.tsx)
import { PixelArt } from "./pixel-art";

/**
 * 기본 이미지 가운데에 그리는 픽셀 그림: 해와 산이 그려진 그림 액자(가로 12칸 × 세로 8칸).
 * 줄마다 "#"은 칠한 칸, "."은 빈칸이에요(components/pixel-art.tsx가 이 모양대로 그려요).
 * `as const`: 이 글자 배열이 바뀌지 않는다고 알려요(실수로 고치면 타입 오류가 나요).
 */
const EMPTY_PICTURE = [
  "############",
  "#..........#",
  "#.......##.#",
  "#.......##.#",
  "#...#......#",
  "#..###..#..#",
  "#.########.#",
  "############",
] as const;

/**
 * ReviewImage가 받는 값(props)의 모양
 *
 * `type 이름 = { ... }`: TypeScript로 "이런 항목을 가진 객체"라는 타입에 이름을 붙여요.
 * `src?:`처럼 이름 뒤의 `?`는 "없어도 되는 항목"이라는 뜻이에요.
 * `"thumb" | "large"`: 두 글자 가운데 하나만 받는다는 뜻이에요(| = 또는).
 */
type Props = {
  /** 이미지 주소(예: "/images/winter-stop.jpg"). 없으면 기본 이미지를 보여 줘요. */
  src?: string;
  /** thumb(목록 썸네일) 또는 large(큰 이미지) */
  size: "thumb" | "large";
  /** 바깥에서 더할 CSS 클래스 */
  className?: string;
};

/**
 * 형광 초록으로 바꿔 보이는 리뷰 이미지
 *
 * `{ src, size, className = "" }`: 받은 값을 이름으로 꺼내요(구조 분해). `= ""`는 값이 오지 않았을 때 쓸 기본값이에요.
 *
 * @param props.src 이미지 주소. 없으면 기본 이미지를 그려요.
 * @param props.size "thumb"(목록 썸네일) 또는 "large"(큰 이미지)
 * @param props.className 바깥 상자에 더할 CSS 클래스
 * @returns 2:3 비율 액자(span) 안에 그림 또는 기본 이미지를 넣은 요소
 *
 * @example
 * <ReviewImage src="/images/winter-stop.jpg" size="thumb" /> // 목록 썸네일
 */
export function ReviewImage({ src, size, className = "" }: Props) {
  // 크기별 너비. 높이는 비율(가로 2 : 세로 3)로 정해져요(aspect-[2/3]).
  //  - thumb: 휴대폰 3.5rem(56px), 넓은 화면(sm, 640px~) 4.375rem(70px). 픽셀이 흐려지지 않게 정수 px로 맞췄어요(높이도 84·105px).
  //  - large: 휴대폰 12rem(192px), 넓은 화면 14rem(224px)
  // (Tailwind CSS의 w-14는 width: 3.5rem, sm:는 "640px 이상일 때만", w-[4.375rem]처럼 대괄호에는 원하는 값을 바로 적어요.)
  // `조건 ? 참일 때 : 거짓일 때`: 삼항 연산자. 조건에 따라 두 값 가운데 하나를 골라요.
  const width = size === "thumb" ? "w-14 sm:w-[4.375rem]" : "w-48 sm:w-56";

  return (
    // relative: 안의 그림을 상자 크기에 꽉 채우기(fill) 위한 기준이에요.
    // image-frame: 어두운 바탕 + 테두리 + 주사선 무늬(globals.css)
    // block: span이지만 상자처럼 너비·높이를 가지게 해요. aspect-[2/3]: 가로 2 : 세로 3 비율로 높이를 정해요.
    // shrink-0: 옆 글이 길어도 이 상자는 줄어들지 않아요(flex 안에서).
    // className={`...${width}...`}: 백틱(`) 글자 안의 ${값}에 변수를 끼워 넣는 "템플릿 리터럴"이에요.
    // span을 쓰는 까닭: 글줄 요소(span)라서 문단·단추 같은 글줄만 받는 자리에 넣어도 HTML 규칙(콘텐츠 모델)에 어긋나지 않아요.
    <span className={`image-frame relative block aspect-[2/3] shrink-0 ${width} ${className}`}>
      {/* src가 있으면 실제 그림, 없으면 기본 이미지를 그려요. JSX 안에서는 {조건 ? A : B}로 둘 중 하나를 골라요. */}
      {src ? (
        <LoadingImage
          // key: 그림 주소가 바뀌면 새 조각으로 다시 시작해요. 앞 그림의 "받지 못함"·"다 옴" 상태가 남지 않게요.
          key={src}
          src={src}
          // 꾸밈 그림이라 대체 텍스트를 비워요(옆의 제목이 같은 뜻을 알려 줘요).
          alt=""
          // fill: 부모 상자(relative) 크기에 맞춰 꽉 채워요. 그림의 너비·높이를 따로 몰라도 돼요.
          // (값 없이 이름만 쓰면 fill={true}와 같아요.)
          fill
          // sizes: 화면에 그려질 실제 크기 힌트예요. Next.js가 이 크기에 맞게 줄인 파일을 골라 줘서 썸네일이 가벼워요.
          sizes={size === "thumb" ? "(min-width: 640px) 70px, 56px" : "(min-width: 640px) 224px, 192px"}
          // object-cover: 비율이 조금 달라도 상자를 꽉 채우고 넘치는 부분을 잘라요.
          // image-tint: 형광 초록 필터(globals.css)
          className="image-tint object-cover"
          // 그림을 받지 못하면(파일이 없거나 연결이 끊김) 기본 이미지를 대신 보여 줘요.
          fallback={<DefaultImage size={size} />}
        />
      ) : (
        <DefaultImage size={size} />
      )}
    </span>
  );
}

/**
 * 기본 이미지: 이미지를 올리지 않은 리뷰에 보여 줘요.
 * 가운데에 그림 액자 픽셀 아이콘과 "NO IMAGE" 글자를 둔, 2:3 비율의 상자예요.
 *
 * 꾸밈 그림이라 화면 낭독기에서 통째로 숨겨요(aria-hidden="true"). 안에 초점 받는 요소가 없어서 숨겨도 안전해요.
 *
 * `size: Props["size"]`: 위 Props 타입의 size 항목과 같은 타입("thumb" | "large")이라는 뜻이에요.
 *
 * @param props.size "thumb"이면 작은 그림만, "large"면 그림 + "NO IMAGE" 글자
 * @returns 가운데에 픽셀 그림을 둔 span 요소
 *
 * @example
 * <DefaultImage size="large" /> // 글쓰기 화면에서 이미지를 고르기 전 자리
 */
export function DefaultImage({ size }: { size: Props["size"] }) {
  return (
    // grid h-full place-content-center: 상자 가운데에 그림과 글자를 세로로 쌓아요.
    // justify-items-center: 그림과 글자를 가로로도 가운데 맞춰요. gap-2: 둘 사이를 0.5rem(8px) 띄워요.
    // text-crt-line: 어두운 초록. 기본 이미지라는 것이 실제 이미지보다 덜 눈에 띄게 해요.
    <span aria-hidden="true" className="grid h-full place-content-center justify-items-center gap-2 text-crt-line">
      {/* 썸네일은 작아서 칸 하나를 2px, 큰 이미지는 5px로 그려요. */}
      <PixelArt rows={EMPTY_PICTURE} cell={size === "thumb" ? 2 : 5} />
      {/* 큰 이미지에만 글자를 넣어요(썸네일에는 자리가 좁아요). 바깥 상자가 통째로 숨겨져 있어 화면 낭독기는 읽지 않아요.
          `조건 && 요소`: 조건이 참일 때만 요소를 그려요. text-crt-dim: 조금 더 흐린 초록 글자색이에요(globals.css). */}
      {size === "large" && (
        <span className="text-crt-dim">
          NO IMAGE
        </span>
      )}
    </span>
  );
}
