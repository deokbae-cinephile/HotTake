// "use client": 브라우저에서 돌아가는 클라이언트 컴포넌트라는 표시예요. 까닭은 아래 설명의 "use client인 까닭"을 보세요.
"use client";

/**
 * @file 목록의 리뷰 한 편 (review-list-item.tsx)
 * 읽는 순서: 21/84번째 · 4단계(처음 화면: 작품 목록)
 *   앞: src/components/choice-chips.tsx → 다음: src/components/review-image.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   처음 화면 목록에서 리뷰 한 편을 한 덩어리로 보여 줍니다.
 *
 *     넓은 화면(640px~)
 *     ┌────┐ 겨울 정류장 ······································ 4.5   ← 첫째 줄: 제목 · 점선 · 평점
 *     │이미│ 2024 · 한서윤                                        ← 둘째 줄: 연도 · 감독 또는 작가(이름만, 2줄까지 …)
 *     │ 지 │
 *     │2:3 │ “버스는 오지 않아도, 기다림은 끝내 도착한다.”  [수정][삭제]   ← 한 줄 평: 둘째 줄 아래 8px
 *     └────┘                                    ↑ 수정·삭제 아이콘 단추: 글쓴이로 로그인했을 때만
 *
 *     휴대폰(~639px): 평점은 이미지 아래에 놓이고, 한 줄 평은 둘째 줄 아래 8px에 와요(넓은 화면과 같아요).
 *     ┌────┐ 겨울 정류장                    [수정]   ← 글쓴이일 때만: 오른쪽에 단추 칸(44px)을 따로 두고 위아래로
 *     │이미│ 2024 · 한서윤                   [삭제]
 *     │ 지 │ “버스는 오지 않아도, 기다림은
 *     └────┘ 끝내 도착한다.”
 *      4.5
 *
 *   글 쓴 날과 분류는 화면에 보이지 않아요. 글 쓴 날은 "최신순" 정렬에, 분류는 분류 필터와 검색에만 써요.
 *   감독 또는 작가는 이름표 없이 이름만 둬요.
 *
 * 맡은 기능
 *   - 이미지 썸네일(2:3)을 맨 앞에 보여 줘요. 없으면 기본 이미지예요. 형광 초록으로 바뀌어 보여요(components/review-image.tsx).
 *   - 평점은 넓은 화면에서 첫째 줄 오른쪽 끝, 휴대폰에서는 이미지 아래에 보여요.
 *     (두 자리에 하나씩 그려 두고 화면 너비에 맞는 하나만 보여요. 숨긴 쪽은 display: none이라 화면 낭독기도 한 번만 읽어요.)
 *   - 한 줄 평은 둘째 줄 아래 8px에 바로 이어 놓여요(첫째·둘째 줄 사이 4px보다 조금 띄워 무엇이 한 줄 평인지 보여요).
 *   - 글자 크기는 목록 구역의 16px(text-mid, review-browser.tsx)을 따라요.
 *   - 글쓴이로 로그인했으면 한 편마다 수정·삭제 아이콘 단추가 보여요(review-list-admin.tsx).
 *     넓은 화면은 한 줄 평 줄의 오른쪽 끝, 휴대폰은 오른쪽 단추 칸이에요(두 자리에 하나씩 그려 두고 너비에 맞는 하나만 보여요).
 *
 * "use client"인 까닭
 *   글쓴이인지(쿠키 표시)와 삭제했는지를 브라우저에서 알아내 단추를 바꿔 그려야 해서 클라이언트 컴포넌트예요.
 *
 * 누가 쓰나요?
 *   components/review-browser.tsx가 목록을 그릴 때 리뷰마다 하나씩 씁니다.
 */

// joinFacts: 여러 값을 " · "로 이어 한 줄 글자로 만들어요(빈 값은 빼요).
import { joinFacts } from "@/lib/format";
// imageSrc: 원고의 이미지 파일 이름을 화면 주소로 바꿔요. `type Review`: 리뷰 한 편의 모양(타입)만 가져와요.
import { imageSrc, type Review } from "@/lib/review";

import { Rating } from "./rating";
import { ReviewImage } from "./review-image";
import { ReviewListActions, ReviewListDeleted, useReviewListAdmin } from "./review-list-admin";

/** ReviewListItem이 받는 값(props) */
type Props = {
  /** 보여 줄 리뷰 */
  review: Review;
};

/**
 * 목록의 리뷰 한 편
 *
 * @param props - {@link Props}
 * @returns <li> 안에 리뷰 한 편(<article>)을 담은 요소. 부모 <ul>(review-browser.tsx) 안에 놓여요.
 *
 * @example
 * <ul>{reviews.map((review) => <ReviewListItem key={review.slug} review={review} />)}</ul>
 */
export function ReviewListItem({ review }: Props) {
  // 구조 분해 할당: review.title 대신 title처럼 짧게 쓰려고 필요한 항목을 꺼내 둬요.
  const { slug, title, year, creator, rating, oneLiner, image } = review;
  // 제목 요소의 id. 아래 <article>의 이름(aria-labelledby)으로 연결해요. slug는 겹치지 않으니 id로 쓰기 좋아요.
  const titleId = `review-${slug}`;
  // 글쓴이의 수정·삭제. 단추를 보일지, 지웠는지를 여기서 한 번만 기억해요.
  // 넓은 화면용과 휴대폰용 두 자리가 이 한 묶음(admin)을 함께 써서, 한쪽에서 지우면 두 자리가 함께 바뀌어요.
  const admin = useReviewListAdmin();

  return (
    // <li>: 목록(<ul>)의 항목 하나. <ul>의 자식은 <li>만 올 수 있어요(HTML 약속).
    <li>
      {/* <article>: 혼자 떼어 놓아도 뜻이 통하는 독립된 내용(리뷰 한 편)이라는 뜻의 태그예요. */}
      <article
        aria-labelledby={titleId}
        // tabIndex -1: Tab 순서에는 넣지 않고, [더 보기]로 불러온 뒤 코드로 초점을 옮길 수만 있게 해요(review-browser.tsx).
        tabIndex={-1}
        // focus-visible:outline-*: 코드로 이 항목에 초점을 옮기면 점선 테두리로 보여 줘요.
        // grid-cols-[3.5rem_minmax(0,1fr)] — 휴대폰: 왼쪽 3.5rem 칸에 썸네일, 오른쪽에 글자
        //   (글쓴이의 수정·삭제 단추가 있으면 맨 오른쪽에 2.75rem(44px) 단추 칸을 하나 더 둬요: …_2.75rem)
        // sm:grid-cols-[4.375rem_minmax(0,1fr)] — 넓은 화면: 썸네일 4.375rem(70px). 단추는 한 줄 평 줄 끝에 있어 칸을 더하지 않아요.
        // items-stretch: 칸들이 그 줄의 높이만큼 세로로 늘어나요(그리드 기본값을 분명히 적어 뒀어요).
        // minmax(0,1fr): 남는 너비를 모두 쓰되, 긴 글자 때문에 칸이 넘치지 않게 최소 0까지 줄어들 수 있게 해요.
        // `${조건 ? A : B}`: 템플릿 문자열 안에서 조건에 따라 다른 클래스를 넣어요.
        // 나머지: gap-x-4(칸 사이 1rem), px-3 py-3(안쪽 여백 0.75rem), outline-none(기본 초점 테두리는 지우고 아래 점선으로 대신해요)
        // Tailwind는 클래스 이름을 글자 그대로 찾아 만들어서, 두 경우의 클래스를 통째로 적어 둬요(일부만 이어 붙이면 만들어지지 않아요).
        className={`grid ${admin.showActions ? "grid-cols-[3.5rem_minmax(0,1fr)_2.75rem]" : "grid-cols-[3.5rem_minmax(0,1fr)]"} items-stretch gap-x-4 px-3 py-3 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crt-fg focus-visible:outline-dashed sm:grid-cols-[4.375rem_minmax(0,1fr)]`}
      >
        {/* 왼쪽 칸: 이미지 썸네일, 휴대폰에서는 그 아래에 평점.
            이미지는 바로 옆에 제목이 있어 같은 말을 두 번 읽지 않도록 꾸밈(alt="")으로 둬요.
            self-start: 글이 썸네일보다 길어도(좁은 화면) 왼쪽 칸은 늘어나지 않고 이미지는 2:3 비율을 지켜요.
            justify-items-center: 평점 숫자를 이미지 가운데 아래에 놓아요. gap-2: 이미지와 평점 사이 8px. */}
        <div className="grid content-start justify-items-center gap-2 self-start">
          {/* imageSrc: 원고의 파일 이름("a.jpg")을 주소("/images/a.jpg")로 바꿔요(lib/review.ts). */}
          <ReviewImage src={imageSrc(image)} size="thumb" />
          {/* sm:hidden: 640px 이상에서는 숨겨요(그때는 첫째 줄 오른쪽 끝의 평점이 보여요). */}
          <Rating value={rating} className="sm:hidden" />
        </div>

        {/* 글자 칸. flex flex-col: 줄을 위에서 아래로 쌓아요(제목 줄 → 연도 줄 → 한 줄 평 줄 → 삭제 안내).
            min-w-0: 긴 제목이 칸을 밀어내지 않고 줄바꿈되게 하는 그리드·플렉스 요령이에요. */}
        <div className="flex min-w-0 flex-col">
          {/* 첫째 줄: 제목 · 점선 · 평점(평점은 640px 이상에서만. 휴대폰은 이미지 아래)
              flex-wrap: 제목이 길면 다음 줄로 넘겨요. gap-x-3: 가로 사이 12px. */}
          <div className="flex flex-wrap items-center gap-x-3">
            {/* <h3>: 목록 구역 제목(<h2> "작품 목록") 아래의 제목이라 한 단계 아래인 h3예요. 제목 단계를 건너뛰지 않아요.
                id={titleId}: 위 <article>의 aria-labelledby가 이 id를 가리켜, 제목이 리뷰 한 편의 이름이 돼요.
                glow: 글자 둘레가 은은하게 빛나는 효과(globals.css). */}
            <h3 id={titleId} className="glow">
              {title}
            </h3>
            {/* 제목과 평점 사이를 잇는 점선(꾸밈이라 읽지 않아요). hidden sm:block: 휴대폰에서는 숨겨요.
                leader: 남는 너비를 채우는 점선을 그리는 우리만의 클래스(globals.css). 책 목차의 "제목 ······ 쪽수"와 같은 모양이에요. */}
            <span aria-hidden="true" className="leader hidden sm:block" />
            {/* max-sm:hidden: 640px보다 좁으면 숨겨요(휴대폰은 이미지 아래의 평점이 보여요). ml-auto: 오른쪽 끝에 붙어요. */}
            <Rating value={rating} className="ml-auto max-sm:hidden" />
          </div>

          {/* 둘째 줄: 연도 · 감독 또는 작가 이름. " · "로 이어요(lib/format.ts의 joinFacts).
              가운뎃점은 앞 항목에 붙어서, 휴대폰에서 줄이 넘쳐도 가운뎃점으로 시작하는 줄이 생기지 않아요.
              line-clamp-2: 길면 두 줄까지만 보이고 끝을 "…"로 줄여요(화면 낭독기는 다 읽어요). 너무 긴 낱말도 끊어 줄을 바꿔요(globals.css). */}
          {/* mt-1: 첫째 줄과 4px 띄워요. text-body: 이 프로젝트의 본문 글자 크기, text-crt-dim: 조금 어두운 글자색(globals.css의 색 변수) */}
          <p className="mt-1 line-clamp-2 text-body text-crt-dim">{joinFacts([year, creator])}</p>

          {/* 한 줄 평 줄: 한 줄 평과, 넓은 화면에서 글쓴이일 때 오른쪽 끝의 수정·삭제 아이콘 단추.
              mt-2: 둘째 줄 아래 8px(첫째·둘째 줄 사이 4px보다 조금 띄워요). 휴대폰과 넓은 화면이 같아요.
              items-center: 한 줄 평 첫 줄과 단추의 가운데를 맞춰요(단추는 -my-2로 위아래 8px씩 겹쳐 놓여 줄 높이를 늘리지 않아요).
              gap-3: 한 줄 평 ↔ 단추 12px. */}
          <div className="mt-2 flex items-center gap-3">
            {/* 한 줄 평. 화면 낭독기에는 앞에 "한 줄 평:"을 붙여 무슨 글인지 알려 줘요.
                grow: 단추를 뺀 남은 너비를 모두 써요. min-w-0: 긴 글도 줄을 바꿔 칸을 넘지 않아요. */}
            <p className="min-w-0 grow">
              {/* sr-only: 눈에는 안 보이고 화면 낭독기만 읽는 글자. 따옴표(“ ”)는 화면에 보이는 꾸밈 글자예요. */}
              <span className="sr-only">한 줄 평: </span>“{oneLiner}”
            </p>
            {/* 넓은 화면용 수정·삭제(가로). 640px보다 좁으면 숨기고, 오른쪽 단추 칸의 것이 대신 보여요.
                `조건 && <요소>`: 조건이 참일 때만 요소를 그려요. 방문자이거나 이미 지웠으면 아무것도 그리지 않아요. */}
            {admin.showActions && <ReviewListActions slug={slug} title={title} onDeleted={admin.onDeleted} />}
          </div>
          {/* 삭제 안내(지운 뒤에만 글자가 들어가요). 한 줄 평 아래에 글자 칸 너비로 보여요.
              글쓴이일 때는 처음부터 빈 칸으로 두어요. 안내 영역(role="status")이 미리 있어야 글자가 바뀔 때 화면 낭독기가 읽어 줘요. */}
          {admin.showStatus && <ReviewListDeleted message={admin.deletedMessage} statusRef={admin.statusRef} />}
        </div>

        {/* 휴대폰용 수정·삭제(세로): 맨 오른쪽 단추 칸에 [수정] 위, [삭제] 아래. 640px 이상에서는 숨겨요. */}
        {admin.showActions && <ReviewListActions slug={slug} title={title} onDeleted={admin.onDeleted} vertical />}
      </article>
    </li>
  );
}
