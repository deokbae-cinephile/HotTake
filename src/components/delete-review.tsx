/**
 * @file 리뷰 삭제 단추와 확인 창 (delete-review.tsx)
 * 읽는 순서: 61/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/components/review-list-admin.tsx → 다음: src/app/manifest.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   휴지통 아이콘 단추를 누르면 "리뷰를 삭제할까요?" 확인 창을 띄우고, 창의 [삭제]를 한 번 더 눌러야 삭제해요.
 *   지우면 저장소에서 원고(content/reviews/<파일 이름>.json)와 그 리뷰의 이미지를 지우는 커밋이 올라가고,
 *   GitHub Actions가 다시 배포하면(몇 분 뒤) 블로그에서도 사라져요.
 *
 * 확인 창: 네이티브 <dialog> + showModal()
 *   브라우저가 화면 맨 위에 띄우고, 창 밖은 누를 수 없게 막고(inert), 초점을 창 안에 가두고, Esc로 닫아 줘요.
 *   직접 만들면 이 일을 모두 손으로 해야 해서, 브라우저 기능을 먼저 써요.
 *   확인·취소만 받는 창이라 role="alertdialog"로 "중요한 확인 창"이라고 알리고,
 *   제목(aria-labelledby)과 설명(aria-describedby)을 이어 화면 낭독기가 창이 열리자마자 읽게 해요.
 *   처음 초점은 되돌리기 쉬운 [취소]에 둬요(실수로 Enter를 눌러도 지워지지 않게요).
 *
 * 두 번 누름 막기
 *   [삭제]를 아주 빠르게 두 번 눌러도 요청은 한 번만 가요. useState는 다음 그리기에야 바뀌어서
 *   useRef 잠금을 함께 써요. 삭제에 성공하면 잠금을 풀지 않아요(이미 삭제한 리뷰를 또 삭제할 일이 없으니까요).
 *
 * 삭제하는 동안
 *   창 안에 로딩 UI를 보이고, [취소]·[삭제]는 aria-disabled로 막아요(흐리게 보여요). disabled로 막으면 누른 단추에서
 *   초점이 빠져 문서 전체로 가 버려요. aria-disabled는 초점을 그 자리에 두고 "쓸 수 없음"만 알려요(누름은 코드가 무시해요).
 *   Esc로도 창을 닫지 못해요(onCancel). 결과가 나올 때까지 기다려요.
 *
 * 단추 이름
 *   휴지통 그림은 꾸밈이라 읽지 않고, 화면에 보이지 않는 이름 "겨울 정류장 리뷰 삭제"를 읽어요
 *   (목록에는 같은 단추가 여러 개라 어느 리뷰인지 이름에 넣어요).
 *
 * 누가 쓰나요?
 *   components/review-list-admin.tsx(목록 한 편, 로그인했을 때만)
 *
 * 배경 지식
 *   - useState: 값이 바뀌면 화면을 다시 그리는 "상태"를 만들어요. [값, 바꾸는 함수] 두 개를 배열로 돌려줘요.
 *   - useRef: 화면을 다시 그려도 그대로 남는 상자({ current: 값 })를 만들어요. 값을 바꿔도 다시 그리지 않고,
 *     바꾼 즉시 읽을 수 있어요. 그래서 "잠금"이나 DOM 요소 손잡이로 써요.
 *   - useId: 컴포넌트마다 겹치지 않는 id를 만들어 줘요. 목록에 같은 컴포넌트가 여러 개 있어도 id가 부딪치지 않아요.
 */

// "use client": 이 파일은 브라우저에서 돌아가는 클라이언트 컴포넌트라는 표시예요.
// Next.js의 컴포넌트는 기본이 서버 컴포넌트(서버에서 HTML만 만들고 끝)라서,
// 상태(useState)·클릭 처리처럼 브라우저에서 움직여야 하는 컴포넌트는 맨 위에 이 줄을 적어요.
"use client";

import { useId, useRef, useState } from "react";

// `@/`는 src 폴더를 뜻하는 경로 별칭(alias)이에요(tsconfig.json의 paths). ../../처럼 길게 쓰지 않아도 돼요.
// ACTION_ICON_CELL·DELETE_ICON_ROWS: 휴지통 그림의 칸 크기와 점 배치
import { ACTION_ICON_CELL, DELETE_ICON_ROWS } from "@/lib/action-icons";
// deleteReview: 서버의 삭제 API(DELETE /api/reviews/<파일 이름>)를 부르는 함수
import { deleteReview } from "@/lib/admin-api";

import { LoadingStatus } from "./loading-status";
import { PixelArt } from "./pixel-art";

/** DeleteReview가 받는 값(props) */
type Props = {
  /** 지울 리뷰의 파일 이름(확장자 .json을 뺀 이름, 예: "winter-stop") */
  slug: string;
  /** 리뷰 제목(확인 문구와 단추 이름에 써요) */
  title: string;
  /**
   * 삭제에 성공하면 안내 문구와 함께 불러요. 안내를 보여 주는 일은 부르는 쪽이 해요.
   * `(message: string) => void`: 글자 하나를 받고 아무것도 돌려주지 않는 함수 타입이에요.
   */
  onDeleted: (message: string) => void;
};

/**
 * [삭제] 단추와 확인 창
 *
 * @param props - {@link Props}
 * @returns 휴지통 아이콘 단추와, 그 단추가 여는 확인 창(<dialog>)
 *
 * @example
 * <DeleteReview slug="winter-stop" title="겨울 정류장" onDeleted={(message) => setNotice(message)} />
 */
export function DeleteReview({ slug, title, onDeleted }: Props) {
  // 확인 창(<dialog>)의 손잡이. showModal()로 열고 close()로 닫아요.
  // `useRef<HTMLDialogElement>(null)`: <제네릭>으로 "이 상자에는 <dialog> 요소가 들어간다"고 타입을 알려 줘요.
  // 처음에는 null이고, 아래 <dialog ref={dialogRef}>가 그려지면 React가 그 요소를 current에 넣어 줘요.
  const dialogRef = useRef<HTMLDialogElement>(null);
  // 지우는 중인지(단추를 잠시 막고 로딩 UI를 보여요)
  // `const [a, setA] = ...`는 배열 구조 분해예요. 돌려받은 배열의 첫째·둘째 값을 이름 붙여 꺼내요.
  const [deleting, setDeleting] = useState(false);
  // 실패 문구(창 안에 보여요). 빈 글자("")면 아무것도 보이지 않아요.
  const [error, setError] = useState("");
  // 두 번 누름 막기 잠금. true면 이미 요청을 보낸 상태예요.
  const lockRef = useRef(false);
  // 창 제목·설명의 id를 만들 바탕 값. 아래에서 `${id}-title`, `${id}-desc`로 이어 붙여 써요.
  const id = useId();

  /**
   * 확인 창의 [삭제]를 누르면 실행돼요.
   *
   * async 함수: 안에서 await로 서버 답을 기다릴 수 있어요. 기다리는 동안에도 화면은 멈추지 않아요.
   */
  async function handleConfirm() {
    // 이미 요청 중이면 바로 끝내요. lockRef는 바꾼 즉시 읽히므로, 아주 빠른 두 번째 클릭도 여기서 걸러져요.
    // (deleting 상태는 다음 그리기 뒤에야 true로 보여서 이 일을 못 해요.)
    if (lockRef.current) return;
    lockRef.current = true;
    setDeleting(true);
    // 지난번 실패 문구는 지워요.
    setError("");

    // 서버에 삭제를 요청하고 답을 기다려요. result는 { ok: true, data } 또는 { ok: false, message, ... }예요(lib/admin-api.ts).
    const result = await deleteReview(slug);
    setDeleting(false);
    if (result.ok) {
      // 창을 닫고 부르는 쪽에 알려요. 잠금은 풀지 않아요(다시 지울 일이 없어요).
      // `?.`(옵셔널 체이닝): 앞의 값이 null·undefined면 멈추고, 있을 때만 close()를 불러요.
      dialogRef.current?.close();
      // 백틱(`) 문자열 안의 ${title}은 제목을 끼워 넣는 템플릿 리터럴이에요.
      onDeleted(`‘${title}’ 리뷰를 삭제했습니다. 블로그를 다시 배포하면(몇 분 뒤) 목록에서도 사라집니다.`);
      return;
    }
    // 실패: 이유를 보여 주고, 다시 누를 수 있게 잠금을 풀어요.
    // (위에서 result.ok가 아니라고 걸렀으므로, TypeScript는 여기서 result에 message가 있다는 것을 알아요.)
    setError(result.message);
    lockRef.current = false;
  }

  return (
    // <>...</>: 프래그먼트(Fragment). 겉을 감싸는 태그 없이 여러 요소를 한꺼번에 돌려줄 때 써요.
    <>
      {/* btn-icon: 테두리 없는 44 × 44px 정사각형(누르기 쉬운 크기). 휴지통 그림(24px)은 꾸밈이라 읽지 않고, 화면에 보이지 않는 이름을 읽어요.
          showModal(): 확인 창을 "모달"로 열어요(창 밖은 누를 수 없고 초점이 창 안에 갇혀요). `?.`: 손잡이가 있을 때만 불러요.
          onClick={() => ...}: 누를 때 실행할 함수를 화살표 함수로 바로 적었어요.
          type="button": <button>의 기본 type은 "submit"이라 폼 안에서는 폼을 보내 버려요. 그냥 단추라고 분명히 적어요. */}
      <button type="button" onClick={() => dialogRef.current?.showModal()} className="btn-icon">
        {/* label을 주지 않은 PixelArt는 aria-hidden으로 숨겨지는 꾸밈 그림이에요(components/pixel-art.tsx). */}
        <PixelArt rows={DELETE_ICON_ROWS} cell={ACTION_ICON_CELL} />
        {/* sr-only: 눈에는 안 보이지만 화면 낭독기는 읽는 글자(Tailwind 기본 클래스). 이 글자가 단추 이름이 돼요. */}
        <span className="sr-only">{title} 리뷰 삭제</span>
      </button>

      {/* 확인 창. 닫혀 있으면 화면에 보이지 않아요(브라우저 기본). confirm-dialog: 모양(globals.css)
          ref={dialogRef}: 그려진 <dialog> 요소를 dialogRef.current에 넣어 달라는 뜻이에요.
          role="alertdialog": 확인·취소만 받는 중요한 확인 창이라고 알려요.
          aria-labelledby / aria-describedby: 아래 제목(h2)과 설명(p)의 id를 이어, 창의 이름과 설명이 되게 해요.
          onClose: Esc로 닫혀도 실패 문구를 지워, 다음에 열 때 깨끗하게 보여요.
          onCancel: 삭제하는 동안에는 Esc로 창을 닫지 못하게 막아요(끝날 때까지 결과를 기다려요).
            Esc를 누르면 브라우저가 "cancel" 이벤트를 보낸 뒤 창을 닫는데, event.preventDefault()로 그 기본 동작을 취소해요. */}
      <dialog
        ref={dialogRef}
        role="alertdialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        onClose={() => setError("")}
        onCancel={(event) => {
          if (deleting) event.preventDefault();
        }}
        className="confirm-dialog"
      >
        {/* 창 제목. inverse: 글자색과 바탕색을 뒤집은 띠(globals.css), px-4 py-1: 안쪽 여백(가로 1rem, 세로 0.25rem),
            text-mid: 이 프로젝트에서 정한 중간 글자 크기 */}
        <h2 id={`${id}-title`} className="inverse px-4 py-1 text-mid">
          리뷰를 삭제할까요?
        </h2>
        {/* grid gap-4: 안의 칸들을 세로로 쌓고 사이를 1rem 띄워요. px-4 py-4: 사방 안쪽 여백 1rem */}
        <div className="grid gap-4 px-4 py-4">
          {/* 창 설명. 무엇이 지워지고 되돌릴 수 없다는 것을 알려 줘요. */}
          <p id={`${id}-desc`}>
            ‘{title}’ 리뷰와 이 리뷰의 이미지를 저장소에서 삭제합니다. 삭제한 뒤에는 이 화면에서 되돌릴 수 없습니다.
          </p>
          {/* 진행·실패 안내를 한 칸에 묶어요. 둘 다 비어 있어도 그리드 줄(과 사이 간격)은 하나만 생겨서, 평소 창이 쓸데없이 길어지지 않아요. */}
          <div>
            {/* 삭제하는 동안의 로딩 UI(깜빡이는 커서와 16칸 막대). 안내 칸(role="status")은 늘 두고 안쪽만 바꿔요.
                (안내 영역이 처음부터 있어야 화면 낭독기가 바뀐 내용을 읽어 줘요.)
                (몇 초 걸려요: 저장소에서 원고·이미지를 지우는 커밋을 만들어요.)
                `deleting && <...>`: deleting이 true일 때만 뒤의 요소를 그려요. false면 아무것도 그리지 않아요.
                live={false}: 이미 바깥에 role="status"가 있으니 LoadingStatus가 또 status를 만들지 않게 해요. */}
            <div role="status">{deleting && <LoadingStatus label="리뷰를 삭제하는 중" live={false} />}</div>
            {/* role="alert": 실패하면 바로 읽어 줘요. 영역은 늘 두고 글자만 바꿔요. */}
            <p role="alert">{error}</p>
          </div>
          {/* 단추 줄. flex-wrap: 좁으면 줄을 넘김, justify-end: 오른쪽 끝에 붙임, gap-2: 단추 사이 0.5rem */}
          <div className="flex flex-wrap justify-end gap-2">
            {/* autoFocus: 창이 열리면 [취소]에 먼저 초점이 가요(되돌리기 어려운 [삭제]가 아니라). */}
            {/* 삭제하는 동안에는 두 단추를 모두 막아요(로딩 UI가 진행을 알려요). aria-disabled: 초점은 남기고 "쓸 수 없음"만 알려요.
                `deleting || undefined`: 막지 않을 때는 속성을 아예 달지 않아요(React는 값이 undefined인 속성을 그리지 않아요).
                aria-disabled는 누름까지 막아 주지 않으므로, onClick 안에서 deleting을 보고 직접 무시해요. */}
            <button
              type="button"
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- 확인 창의 처음 초점은 덜 위험한 단추에 두는 것이 APG 권장이에요.
              autoFocus
              onClick={() => {
                if (!deleting) dialogRef.current?.close();
              }}
              aria-disabled={deleting || undefined}
              className="btn-line"
            >
              취소
            </button>
            {/* 삭제 중에 다시 눌러도 handleConfirm의 잠금(lockRef)이 막아요. */}
            <button type="button" onClick={handleConfirm} aria-disabled={deleting || undefined} className="btn-inverse">
              삭제
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
