/**
 * @file 맨 위로 단추 (back-to-top.tsx)
 * 읽는 순서: 25/84번째 · 4단계(처음 화면: 작품 목록)
 *   앞: src/components/rating.tsx → 다음: src/components/floating-buttons.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   화면 오른쪽 아래에 떠 있는 "맨 위로" 단추예요. 누르면 화면 맨 위로 올라가요.
 *   떠 있는 자리(오른쪽 아래, 리뷰 추가 "+" 단추의 왼쪽)는 floating-buttons.tsx가 정해요.
 *
 * 맡은 기능
 *   - 조금(400px 넘게) 내려 읽었을 때만 보여요. 맨 위에서는 필요 없으니까요.
 *   - 누르면 부드럽게 올라가요. 단, "동작 줄이기"를 켠 사용자에게는 움직임 없이 바로 올라가요.
 *   - 키보드 초점도 맨 위(머리글)로 옮겨요. 화면만 올라가고 초점이 아래에 남으면,
 *     Tab을 누르는 순간 다시 아래로 끌려 내려가거든요.
 *
 * 숨길 때 hidden 속성을 쓰는 이유
 *   hidden은 화면에서도, 화면 낭독기에서도, Tab 순서에서도 함께 빼 줘요.
 *   (투명하게만 만들면 보이지 않는 단추에 Tab 초점이 들어가 사용자가 길을 잃어요.)
 *
 * 누가 쓰나요?
 *   components/floating-buttons.tsx가 "+"(리뷰 추가) 단추와 함께 바닥글에 놓아요.
 */

// "use client": 브라우저에서 도는 클라이언트 컴포넌트예요. 스크롤 위치를 읽고 누름을 받으려면 필요해요.
"use client";

// useSyncExternalStore: React 바깥의 값(여기서는 스크롤 위치)을 읽고, 바뀌면 다시 그려 주는 React 훅이에요.
import { useSyncExternalStore } from "react";

/** 이만큼(px) 넘게 내려가면 단추를 보여요. 이름을 대문자로 쓴 것은 "바뀌지 않는 설정 값"이라는 관례예요. */
const SHOW_AFTER = 400;

/**
 * 스크롤할 때마다 알려 달라고 등록해요(useSyncExternalStore가 불러요).
 * passive: true — "스크롤을 막지 않겠다"는 약속이라 브라우저가 스크롤을 더 부드럽게 처리해요.
 *
 * @param onScroll 스크롤할 때 부를 함수(React가 넘겨줘요)
 * @returns 등록을 푸는 함수. 화면에서 단추가 사라질 때 React가 불러 뒷정리해요.
 */
function subscribe(onScroll: () => void) {
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => window.removeEventListener("scroll", onScroll);
}

/** 지금 단추를 보여야 하는지. window.scrollY는 문서가 위로 얼마나 스크롤됐는지(px)예요. */
const isScrolledDown = () => window.scrollY > SHOW_AFTER;

/** 서버에서 HTML을 미리 만들 때는 스크롤이 없으니 숨긴 채로 그려요. */
const hiddenOnServer = () => false;

/**
 * 화면 오른쪽 아래의 "맨 위로" 단추
 *
 * @returns 400px 넘게 내려갔을 때만 보이는 button 요소(그 밖에는 hidden)
 */
export function BackToTop() {
  // useSyncExternalStore: 스크롤 위치처럼 React 바깥에서 바뀌는 값을 읽어요.
  // 돌려주는 값이 true/false라서, 스크롤할 때마다가 아니라 "보임 ↔ 숨김"이 바뀔 때만 다시 그려요.
  // 넘기는 세 함수: subscribe(바뀜 알림 등록), isScrolledDown(지금 값 읽기), hiddenOnServer(서버에서 쓸 값)
  const visible = useSyncExternalStore(subscribe, isScrolledDown, hiddenOnServer);

  /** 단추를 눌렀을 때: 맨 위로 스크롤하고 초점을 머리글로 옮겨요. */
  function handleClick() {
    // 사용자가 운영체제에서 "동작 줄이기"를 켰는지 확인해요. 어지럼증이 있는 사람에게 큰 움직임은 힘들 수 있어요.
    // matchMedia(미디어 쿼리).matches: CSS의 @media 조건이 지금 맞는지 true/false로 알려 줘요.
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // behavior: "smooth"는 부드럽게, "auto"는 바로 이동해요.
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    // 머리글(id="top", site-header.tsx)로 초점을 옮겨요. preventScroll: 스크롤은 위의 scrollTo에 맡겨요.
    // `?.focus(...)`: getElementById가 null(그런 요소 없음)을 돌려주면 focus를 부르지 않고 넘어가요(옵셔널 체이닝).
    document.getElementById("top")?.focus({ preventScroll: true });
  }

  return (
    // 떠 있는 자리는 감싸는 묶음(floating-buttons.tsx)이 정해요.
    // type="button": form 안에 있어도 제출 단추가 되지 않게 늘 적어 둬요.
    // hidden={!visible}: visible이 false면 hidden 속성이 붙어 숨어요(! 는 참·거짓 뒤집기).
    // btn-float: 떠 있는 단추 모양(화면 바탕색 + 초록 테두리 + 높이 44px 이상, globals.css)
    <button type="button" hidden={!visible} onClick={handleClick} className="btn-float">
      맨 위로
    </button>
  );
}
