// "use client": 브라우저에서 돌아가는 클라이언트 컴포넌트라는 표시예요(파일 맨 위에 둬야 해요).
// 로그인 여부를 쿠키로 읽고, 상태(useState)와 초점 옮기기(useEffect)를 쓰기 때문에 서버 컴포넌트로는 만들 수 없어요.
"use client";

/**
 * @file 목록 한 편의 수정·삭제 아이콘 단추 (review-list-admin.tsx)
 * 읽는 순서: 60/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/lib/action-icons.ts → 다음: src/components/delete-review.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓴이로 로그인했을 때만 목록 한 편에 [수정]·[삭제] 아이콘 단추를 보여 줘요.
 *
 *     넓은 화면(640px~): 한 줄 평과 같은 줄의 오른쪽 끝에 가로로
 *     ┌────┐ 겨울 정류장 ································ 4.5
 *     │이미│ 2024 · 한서윤
 *     │ 지 │ “버스는 오지 않아도, 기다림은 끝내 도착한다.”    [수정][삭제]
 *     └────┘
 *
 *     휴대폰(~639px): 오른쪽에 단추 칸(44px)을 따로 두고 위아래로
 *     ┌────┐ 겨울 정류장                    [수정]
 *     │이미│ 2024 · 한서윤                   [삭제]
 *     │ 지 │ “버스는 오지 않아도, 기다림은
 *     └────┘ 끝내 도착한다.”
 *
 *   두 자리에 하나씩 그려 두고 화면 너비에 맞는 하나만 보여요(평점과 같은 방법. 숨긴 쪽은 display: none이라
 *   누를 수도 없고 화면 낭독기도 읽지 않아요). 지웠는지는 한 곳(useReviewListAdmin)에서 기억해서 두 자리가 함께 바뀌어요.
 *
 *   - 수정: 연필 아이콘. 글쓰기 화면(/write/<파일 이름>)으로 가요.
 *   - 삭제: 휴지통 아이콘. 확인 창을 띄우고, 확인하면 리뷰를 삭제해요(delete-review.tsx). 삭제하는 동안 창 안에 로딩 UI가 보여요.
 *     지운 뒤에는 단추 대신 한 줄 평 아래에 안내를 보이고, 초점을 그 안내로 옮겨요(누른 단추가 사라져서 초점이 길을 잃지 않게요).
 *   아이콘(24px 픽셀 그림, lib/action-icons.ts)은 꾸밈이라 읽지 않고, 화면에 보이지 않는 이름("겨울 정류장 리뷰 수정")을 읽어요.
 *   방문자에게는 아무것도 그리지 않아요.
 *
 * 화면은 빌드할 때 미리 만든 HTML이라, 로그인 여부는 브라우저에서 쿠키 표시로 알아내요(use-is-admin.ts).
 * 표시를 몰래 만들어 단추를 보이게 해도, 실제 수정·삭제는 서버가 로그인을 다시 확인해서 막혀요.
 *
 * 누가 쓰나요?
 *   components/review-list-item.tsx(목록 한 편)
 *
 * 이 파일이 내보내는 것
 *   - useReviewListAdmin(): 목록 한 편의 수정·삭제 상태를 한곳에 모은 훅
 *   - ReviewListActions: [수정]·[삭제] 아이콘 단추 묶음(넓은 화면용 또는 휴대폰용)
 *   - ReviewListDeleted: 지운 뒤의 안내 칸
 */

// `type RefObject`: 이름 앞의 type은 "이건 타입이라 실행 코드에는 남지 않는다"는 표시예요.
// useEffect: 화면을 그린 "뒤에" 할 일(초점 옮기기처럼 DOM을 직접 만지는 일)을 적는 훅이에요.
import { type RefObject, useEffect, useRef, useState } from "react";

// next/link: 화면을 통째로 다시 받지 않고 바뀐 부분만 받아 옮겨 가는 Next.js의 링크예요.
import Link from "next/link";

// 연필 그림의 점 배치(EDIT_ICON_ROWS)와 칸 크기(ACTION_ICON_CELL). `@/`는 src 폴더를 뜻해요.
import { ACTION_ICON_CELL, EDIT_ICON_ROWS } from "@/lib/action-icons";

import { DeleteReview } from "./delete-review";
import { PixelArt } from "./pixel-art";
import { useIsAdmin } from "./use-is-admin";

/**
 * 목록 한 편의 수정·삭제 상태(글쓴이인지, 지웠는지, 안내 칸의 손잡이)
 *
 * 이름이 use로 시작하는 함수는 "훅(hook)"이에요. 컴포넌트처럼 useState·useEffect를 쓸 수 있고,
 * 여러 컴포넌트가 같은 상태 묶음을 쓰고 싶을 때 이렇게 떼어 둬요.
 * 목록 한 편(review-list-item.tsx)이 이 훅을 한 번 부르고, 받은 값을 두 자리의 단추와 안내 칸에 나눠 줘요.
 *
 * @returns 단추·안내 칸을 그릴지, 안내 글, 삭제를 마쳤을 때 부를 함수, 안내 칸의 손잡이를 담은 객체
 *
 * @example
 * const admin = useReviewListAdmin();
 * {admin.showActions && <ReviewListActions slug={slug} title={title} onDeleted={admin.onDeleted} />}
 * {admin.showStatus && <ReviewListDeleted message={admin.deletedMessage} statusRef={admin.statusRef} />}
 */
export function useReviewListAdmin() {
  // 지금 글쓴이로 로그인해 있는지(true/false). 로그인·로그아웃하면 저절로 다시 그려져요.
  const isAdmin = useIsAdmin();
  // 삭제를 마친 뒤의 안내 글. 비어 있으면 아직 지우지 않은 상태예요.
  const [deletedMessage, setDeletedMessage] = useState("");
  // 안내 칸의 손잡이. 지운 뒤 누른 [삭제]가 사라지니, 키보드 초점을 여기로 옮겨요.
  // `<HTMLParagraphElement>`: 제네릭으로 "이 상자에는 <p> 요소가 들어간다"고 알려 줘요. 처음 값은 null이에요.
  const statusRef = useRef<HTMLParagraphElement>(null);

  // 안내 글이 생기면(삭제를 마치면) 그 안내 칸으로 초점을 옮겨요.
  // useEffect(함수, [deletedMessage]): 뒤의 배열(의존성 배열)에 적은 값이 바뀔 때마다, 화면을 그린 뒤 함수를 실행해요.
  // 화면을 그린 뒤라야 안내 칸에 글자가 들어가 있어서, 초점을 옮기면 화면 낭독기가 바로 그 글을 읽어요.
  useEffect(() => {
    if (deletedMessage) statusRef.current?.focus();
  }, [deletedMessage]);

  return {
    /** 단추를 보일지(글쓴이이고 아직 지우지 않았을 때) */
    showActions: isAdmin && deletedMessage === "",
    /** 삭제 안내 칸을 둘지(글쓴이일 때 처음부터 둬요. 글자만 바꿔야 화면 낭독기가 읽어요) */
    showStatus: isAdmin,
    /** 삭제를 마친 뒤의 안내 글 */
    deletedMessage,
    /** 삭제를 마치면 부를 함수. 안내 글을 받아 상태에 넣어요(setDeletedMessage를 그대로 넘겨요). */
    onDeleted: setDeletedMessage,
    /** 안내 칸의 손잡이(초점을 옮길 때 써요) */
    statusRef,
  };
}

/** ReviewListActions가 받는 값(props) */
type ActionsProps = {
  /** 리뷰 파일 이름 */
  slug: string;
  /** 리뷰 제목(삭제 확인 문구와 단추 이름에 써요) */
  title: string;
  /** 삭제를 마치면 불러요(안내 문구를 넘겨줘요) */
  onDeleted: (message: string) => void;
  /** true면 휴대폰용(오른쪽 단추 칸에 위아래로), false면 넓은 화면용(한 줄 평 줄 끝에 가로로) */
  vertical?: boolean;
};

/**
 * 수정·삭제 아이콘 단추 묶음. 휴대폰용과 넓은 화면용 중 화면 너비에 맞는 하나만 보여요.
 *
 * @param props - {@link ActionsProps}
 * @returns [수정] 링크와 [삭제] 단추(확인 창 포함)를 담은 <div>
 */
export function ReviewListActions({ slug, title, onDeleted, vertical = false }: ActionsProps) {
  return (
    // 휴대폰용: flex-col — [수정] 위, [삭제] 아래. self-start: 칸 맨 위(이미지 위 끝과 같은 높이)에 붙어요. sm:hidden: 640px 이상에서는 숨겨요.
    // 넓은 화면용: shrink-0 — 단추 너비를 줄이지 않아요(한 줄 평이 대신 줄어요). max-sm:hidden: 640px보다 좁으면 숨겨요.
    //   -my-2: 44px 단추를 위아래로 8px씩 겹쳐 놓아, 한 줄 평 줄(28px) 높이를 늘리지 않고 가운데가 맞아요(누르는 자리는 44px 그대로).
    // gap-2: 두 단추 사이 8px.
    //   sm: → 640px 이상에서만, max-sm: → 640px보다 좁을 때만 적용되는 Tailwind 접두사예요. hidden은 display: none이에요.
    <div className={vertical ? "flex flex-col gap-2 self-start sm:hidden" : "-my-2 flex shrink-0 gap-2 max-sm:hidden"}>
      {/* btn-icon: 테두리 없는 44 × 44px 정사각형의 가운데에 그림을 놓아요(globals.css). 연필 그림은 꾸밈이라 읽지 않아요. */}
      {/* 수정은 다른 화면으로 "가는" 일이라 단추가 아니라 링크예요. href의 `${slug}`에 파일 이름을 끼워 넣어요(예: /write/winter-stop). */}
      <Link href={`/write/${slug}`} className="btn-icon">
        <PixelArt rows={EDIT_ICON_ROWS} cell={ACTION_ICON_CELL} />
        {/* sr-only: 눈에는 안 보이고 화면 낭독기만 읽는 글자. 이 글자가 링크 이름이 돼요. */}
        <span className="sr-only">{title} 리뷰 수정</span>
      </Link>
      {/* 휴지통 단추와 확인 창은 delete-review.tsx가 맡아요. 지우면 onDeleted로 안내 글을 돌려줘요. */}
      <DeleteReview slug={slug} title={title} onDeleted={onDeleted} />
    </div>
  );
}

/** ReviewListDeleted가 받는 값(props) */
type DeletedProps = {
  /** 안내 글(비어 있으면 아직 지우지 않았어요) */
  message: string;
  /** 지운 뒤 초점을 옮길 손잡이. `| null`: 아직 그려지기 전에는 null일 수 있다는 뜻이에요. */
  statusRef: RefObject<HTMLParagraphElement | null>;
};

/**
 * 삭제 안내 칸(한 줄 평 아래). 비어 있으면 상자 모양도 여백도 없어서 자리를 차지하지 않아요.
 *
 * @param props - {@link DeletedProps}
 * @returns 안내 글을 담는 <p role="status">
 */
export function ReviewListDeleted({ message, statusRef }: DeletedProps) {
  return (
    // role="status": 처음부터 두고 글자만 바꿔요. tabIndex -1: 코드로만 초점을 옮겨요(Tab 순서에는 없어요).
    // ref={statusRef}: 그려진 <p>를 statusRef.current에 넣어, 훅의 useEffect가 focus()를 부를 수 있게 해요.
    // 클래스(글자가 있을 때만): mt-3(위 여백 0.75rem), border-2 border-crt-fg(2px 테두리, 화면 글자색),
    //   px-3 py-2(안쪽 여백), outline-none(기본 초점 테두리는 지우고), focus-visible:…(키보드 초점일 때 점선 테두리를 대신 그려요).
    <p ref={statusRef} tabIndex={-1} role="status" className={message ? "mt-3 border-2 border-crt-fg px-3 py-2 outline-none focus-visible:outline-2 focus-visible:outline-dashed focus-visible:outline-crt-fg" : ""}>
      {message}
    </p>
  );
}
