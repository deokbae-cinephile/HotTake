/**
 * @file 로딩 UI (loading-status.tsx)
 * 읽는 순서: 16/84번째 · 3단계(화면의 뼈대와 공통 모양)
 *   앞: src/components/site-footer.tsx → 다음: src/app/page.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   화면을 불러오거나 저장하는 동안 옛 DOS 프로그램처럼 "일하는 중"을 보여 줘요.
 *   (DOS: 1980~90년대 개인용 컴퓨터의 글자 화면 운영체제예요. 검은 화면에 글자와 네모 커서만 있었어요.)
 *
 *     불러오는 중▮  [■■■■■■□□□□□□□□□□]
 *                    └ 16칸 막대가 한 칸씩 차오르고, 다 차면 처음부터 다시 차요.
 *
 *   막대는 얼마나 남았는지가 아니라 "멈추지 않고 일하고 있다"는 표시예요(남은 양을 알 수 없을 때 쓰는 모양).
 *   움직임은 globals.css의 .loading-cursor, .loading-bar가 맡아요. 동작 줄이기를 켜면 멈춰 보여요.
 *
 * 접근성
 *   - role="status": 화면 낭독기가 하던 말을 끊지 않고 차례에 "불러오는 중"을 읽어 줘요.
 *     이미 있는 안내 영역(role="status") 안에 넣을 때는 live={false}로 겹치지 않게 해요(글쓰기 화면의 저장 로딩, 삭제 로딩).
 *   - 커서와 막대는 꾸밈이라 화면 낭독기에서 숨겨요(aria-hidden). 뜻은 글자가 전해요.
 *
 * 브라우저 코드가 없는 "서버 컴포넌트"예요. 움직임은 모두 CSS라 자바스크립트를 받기 전에도 보여요.
 *
 * 누가 쓰나요?
 *   app/write/loading.tsx(리뷰 추가·수정 화면을 불러오는 동안), components/review-writer.tsx(저장하는 동안),
 *   components/delete-review.tsx(삭제하는 동안)
 */

/** LoadingStatus가 받는 값(props). 모두 `?`가 붙어 있어 주지 않아도 돼요(아래 기본값을 써요). */
type Props = {
  /** 보일 글자. 무엇을 불러오는지 알려 주면 좋아요. 예: "리뷰를 불러오는 중" */
  label?: string;
  /** 바깥 여백 등 모양 */
  className?: string;
  /**
   * 스스로 안내 영역(role="status")이 될지. 기본 true.
   * 처음부터 화면에 있는 안내 영역 안에 넣을 때는 false로 해요. 새로 생긴 안내 영역은 화면 낭독기가 놓칠 수 있어서,
   * 늘 있는 바깥 영역이 글자 바뀜을 알려 주게 해요.
   */
  live?: boolean;
};

/**
 * 불러오는 중 표시(글자 + 깜빡이는 커서 + 16칸 진행 막대)
 *
 * `{ label = "불러오는 중", ... }`: 받은 값을 이름으로 꺼내고(구조 분해), 오지 않은 값에는 `=` 뒤의 기본값을 써요.
 *
 * @param props.label 보일 글자(기본 "불러오는 중")
 * @param props.className 바깥 div에 더할 CSS 클래스
 * @param props.live true면 스스로 role="status"가 돼요(기본 true).
 * @returns 글자·커서·막대를 담은 div
 *
 * @example
 * <LoadingStatus label="리뷰를 저장하는 중" live={false} /> // 이미 있는 role="status" 안에 넣을 때
 */
export function LoadingStatus({ label = "불러오는 중", className = "", live = true }: Props) {
  return (
    // flex-wrap: 좁은 화면에서는 막대가 글자 아래 줄로 내려가요.
    // items-center: 글자와 막대를 세로 가운데로 맞춰요. gap-x-4 gap-y-2: 가로 16px, 줄 사이 8px 띄워요.
    // role={live ? "status" : undefined}: live가 false면 undefined가 되어 role 속성 자체를 붙이지 않아요.
    <div role={live ? "status" : undefined} className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      {/* glow: 글자 둘레에 은은한 초록 빛을 더하는 클래스(globals.css) */}
      <p className="glow">
        {label}
        {/* 깜빡이는 네모 커서(▮). 꾸밈이라 읽지 않아요. */}
        <span aria-hidden="true" className="loading-cursor" />
      </p>
      {/* 16칸 진행 막대. 안쪽 span이 칸을 그리며 한 칸씩 드러나요(움직임은 globals.css의 .loading-bar). 꾸밈이라 읽지 않아요. */}
      <span aria-hidden="true" className="loading-bar">
        <span />
      </span>
    </div>
  );
}
