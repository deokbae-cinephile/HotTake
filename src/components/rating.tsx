/**
 * @file 평점 표시 (rating.tsx)
 * 읽는 순서: 24/84번째 · 4단계(처음 화면: 작품 목록)
 *   앞: src/components/loading-image.tsx → 다음: src/components/back-to-top.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   평점(0.5 ~ 5점)을 숫자로만 보여 줘요. 예: 4.5
 *   별 그림 없이 숫자만 두어 가볍고, 좁은 화면에서도 읽기 쉬워요.
 *
 * 접근성 포인트
 *   화면에는 "4.5"만 보이지만, 숫자만 들으면 무엇인지 모를 수 있어요.
 *   그래서 화면 낭독기에는 숨겨 둔 글(sr-only) "평점 5점 만점에 4.5점"을 읽어 주고,
 *   눈에 보이는 숫자는 aria-hidden으로 숨겨 같은 정보를 두 번 읽지 않게 했어요.
 *
 * 누가 쓰나요?
 *   components/review-list-item.tsx(목록의 리뷰 한 줄. 휴대폰에서는 이미지 아래, 넓은 화면에서는 제목 줄 오른쪽 끝)
 *
 * 이 파일은 서버 컴포넌트예요("use client"가 없어요). 상태가 없어 HTML로만 그려지면 충분해요.
 */

// "@/lib/format": "@/"는 src 폴더를 뜻하는 줄임 경로예요(tsconfig.json의 paths에 정해 둬요).
// formatRating: 숫자를 소수 한 자리 글자로 바꾸는 함수(4 → "4.0")
import { formatRating } from "@/lib/format";

/** Rating이 받는 값(props). `className?`의 `?`는 "없어도 된다"는 뜻이에요. */
type Props = {
  /** 평점. 0.5부터 5까지, 0.5 단위 */
  value: number;
  /** 바깥에서 더할 CSS 클래스 */
  className?: string;
};

/**
 * 평점을 숫자로 보여 줘요.
 *
 * @param props.value 평점(0.5 ~ 5, 0.5 단위)
 * @param props.className 바깥 span에 더할 CSS 클래스(예: "sm:hidden"으로 화면 크기별 숨기기)
 * @returns 보이는 숫자 + 화면 낭독기용 숨긴 글을 담은 span
 *
 * @example
 * <Rating value={4.5} /> // 화면: 4.5 / 화면 낭독기: 평점 5점 만점에 4.5점
 */
export function Rating({ value, className = "" }: Props) {
  // 4 → "4.0"처럼 소수 한 자리 글자로 바꿔 둬요(lib/format.ts).
  const text = formatRating(value);

  return (
    // whitespace-nowrap: 숫자가 줄바꿈으로 갈라지지 않게 해요.
    <span className={`whitespace-nowrap ${className}`}>
      {/* sr-only: 화면에는 보이지 않고 화면 낭독기만 읽는 글이에요(Tailwind 기본 클래스). */}
      <span className="sr-only">{`평점 5점 만점에 ${text}점`}</span>
      {/* aria-hidden="true": 눈에 보이는 숫자는 화면 낭독기에서 숨겨, 위의 문장과 겹쳐 읽히지 않게 해요. */}
      <span aria-hidden="true">{text}</span>
    </span>
  );
}
