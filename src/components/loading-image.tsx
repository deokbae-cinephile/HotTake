/**
 * @file 그림과, 그림이 오기 전의 스켈레톤 (loading-image.tsx)
 * 읽는 순서: 23/84번째 · 4단계(처음 화면: 작품 목록)
 *   앞: src/components/review-image.tsx → 다음: src/components/rating.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   그림(next/image)을 그리고, 그림이 도착하기 전까지는 액자 안에 스켈레톤(움직이지 않는 옅은 초록 칸)을 보여 줘요.
 *     - 그림이 다 오면(onLoad) 스켈레톤을 치워요.
 *     - 그림을 받지 못하면(onError: 파일이 없거나 연결이 끊김) 스켈레톤을 치우고, 대신 보일 것(fallback, 기본 이미지)을 보여 줘요.
 *
 *     ┌──────┐            ┌──────┐
 *     │░░░░░░│  그림 도착  │ 그림  │
 *     │░░░░░░│  ───────>  │      │
 *     └──────┘            └──────┘
 *
 *   이미 받아 둔 그림이라 화면이 준비되기 전에 다 와 있어도, next/image가 준비되자마자 onLoad를 알려 줘서 스켈레톤이 남지 않아요.
 *   실패도 마찬가지로 다시 알려 줘요(onError).
 *
 * 왜 따로 떼었나요?
 *   "그림이 왔는지"를 기억하려면(useState) 브라우저에서 도는 코드("use client")가 필요해요.
 *   액자(components/review-image.tsx)는 서버 컴포넌트로 두고, 이 작은 조각만 브라우저 코드로 만들어 브라우저에 보내는 코드를 줄였어요.
 *
 * 누가 쓰나요?
 *   components/review-image.tsx(ReviewImage가 실제 그림을 그릴 때. 목록 썸네일에 쓰여요)
 */

// "use client": 이 파일은 브라우저에서도 도는 "클라이언트 컴포넌트"라는 표시예요. 파일 맨 위(import보다 앞)에 둬요.
//   useState처럼 화면이 바뀌는 상태를 쓰려면 꼭 필요해요. 이 표시가 없으면 서버에서만 도는 "서버 컴포넌트"예요.
"use client";

// next/image: Next.js의 그림 요소. 화면 크기에 맞게 줄인 파일을 골라 받고, 화면에 가까워질 때 받아(lazy) 가벼워요.
// ImageProps: next/image가 받는 값들의 타입이에요.
import Image, { type ImageProps } from "next/image";
// ReactNode: 화면에 그릴 수 있는 것(요소, 글자, null 등) 모두를 뜻하는 타입이에요.
import { type ReactNode, useState } from "react";

/**
 * LoadingImage가 받는 값: next/image의 값 모두 + 그림을 받지 못했을 때 대신 보일 것
 *
 * `A & B`: 두 타입을 합쳐 "A의 항목도, B의 항목도 모두 가진" 타입을 만들어요(교차 타입).
 */
type Props = ImageProps & {
  /** 그림을 받지 못했을 때 대신 보일 것(예: 기본 이미지). 없으면 깨진 그림 그대로 둬요. */
  fallback?: ReactNode;
};

/**
 * 스켈레톤이 있는 그림
 *
 * 매개변수의 `{ alt, onLoad, onError, fallback, ...props }`는 "구조 분해"예요.
 * 받은 값 가운데 alt·onLoad·onError·fallback은 이름으로 꺼내고, 나머지는 모두 props에 모아요(...props).
 *
 * @param props next/image가 받는 값 모두(src, fill, sizes, className 등) + fallback
 * @returns 오는 중이면 스켈레톤 + 그림, 다 오면 그림만, 받지 못했으면 fallback
 *
 * @example
 * <LoadingImage src="/images/a.jpg" alt="" fill sizes="56px" fallback={<DefaultImage alt="" size="thumb" />} />
 */
export function LoadingImage({ alt, onLoad, onError, fallback, ...props }: Props) {
  // 그림 상태: loading(오는 중) → loaded(다 옴) 또는 failed(받지 못함)
  // useState("loading"): 처음 값이 "loading"인 상태를 만들어요. setState로 바꾸면 화면을 다시 그려요.
  // useState<…>: 꺾쇠 안은 "제네릭"이에요. 이 상태에 들어갈 수 있는 값의 타입(세 글자 가운데 하나)을 정해 줘요.
  // const [state, setState] = …: 돌려받은 [현재 값, 바꾸는 함수] 배열을 두 이름으로 나눠 받아요(배열 구조 분해).
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");

  // 받지 못했으면 대신 보일 것을 그려요. <>...</>는 "Fragment": 감싸는 요소 없이 묶기만 하는 빈 틀이에요.
  // fallback이 없으면 이 줄을 지나쳐 아래의 그림을 그대로 그려요(브라우저의 깨진 그림 표시).
  if (state === "failed" && fallback) return <>{fallback}</>;

  return (
    <>
      {/* 스켈레톤: 액자를 꽉 채워(absolute inset-0) 그림이 올 자리에 깔아요. 꾸밈이라 화면 낭독기가 읽지 않아요(aria-hidden).
          `조건 && 요소`: 조건이 참일 때만 요소를 그려요. */}
      {state === "loading" && <span aria-hidden="true" className="skeleton absolute inset-0" />}
      <Image
        // {...props}: 모아 둔 나머지 값(src, fill, sizes 등)을 그대로 넘겨요.
        {...props}
        // 대체 텍스트는 받은 그대로 넘겨요(꾸밈 그림이면 빈 글자).
        alt={alt}
        // 그림이 다 오면 스켈레톤을 치워요. 넘겨받은 onLoad가 있으면 그것도 불러요.
        // `onLoad?.(event)`: onLoad가 있을 때만 불러요(?. 는 "있으면"이라는 뜻).
        onLoad={(event) => {
          setState("loaded");
          onLoad?.(event);
        }}
        // 받지 못해도 스켈레톤을 치우고 대신 보일 것으로 바꿔요. 넘겨받은 onError가 있으면 그것도 불러요.
        onError={(event) => {
          setState("failed");
          onError?.(event);
        }}
      />
    </>
  );
}
