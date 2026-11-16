/**
 * @file 로그인 상태 훅 (use-is-admin.ts)
 * 읽는 순서: 38/84번째 · 5단계(글쓴이 로그인과 잠금)
 *   앞: src/lib/admin-hint.ts → 다음: src/components/session-controls.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   화면 조각에서 "지금 글쓴이로 로그인해 있나?"를 true/false로 알려 주는 훅이에요.
 *   로그인·로그아웃하면 저절로 다시 그려져요(lib/admin-hint.ts가 알려 줘요).
 *
 * 서버에서 미리 만든 HTML에는 늘 false(로그인 전 모습)로 그려 두고,
 * 브라우저에서 화면이 준비되면 쿠키를 보고 맞춰요. 그래서 처음 HTML은 누구에게나 같아요.
 *
 * 누가 쓰나요?
 *   components/floating-buttons.tsx([+] 리뷰 추가), components/session-controls.tsx([로그아웃]),
 *   components/review-list-admin.tsx(목록 항목의 [수정]·[삭제])
 *
 * 훅(hook)이 뭔가요?
 *   이름이 use로 시작하는 함수로, React 컴포넌트 안에서만 불러 상태·효과 같은 React 기능을 쓰게 해 줘요.
 *   여러 컴포넌트가 같은 일을 하면 이렇게 "직접 만든 훅"으로 묶어 함께 써요.
 *   훅을 쓰는 컴포넌트는 브라우저에서 돌아야 해서, 이 훅을 부르는 파일에는 "use client"가 있어요.
 */

// useSyncExternalStore: React 바깥의 값(여기서는 쿠키)을 읽고, 바뀌었다는 알림을 받으면 다시 그려 주는 훅이에요.
import { useSyncExternalStore } from "react";

// adminHintStore: 쿠키를 읽는 get, 알림을 등록하는 subscribe를 가진 작은 저장소(lib/admin-hint.ts)
import { adminHintStore } from "@/lib/admin-hint";

/** 서버(미리 만든 HTML)에서는 쿠키를 모르니 로그인 전으로 그려요. */
const loggedOutOnServer = () => false;

/**
 * 지금 글쓴이로 로그인해 있으면 true
 *
 * @returns 로그인 표시 쿠키(blog_admin=1)가 있으면 true. 서버에서 그릴 때는 늘 false
 *
 * @example
 * const isAdmin = useIsAdmin();
 * if (!isAdmin) return null; // 로그인 전에는 아무것도 그리지 않기
 */
export function useIsAdmin(): boolean {
  // 세 함수를 넘겨요: subscribe(바뀜 알림 등록), get(지금 값 읽기), loggedOutOnServer(서버에서 쓸 값)
  return useSyncExternalStore(adminHintStore.subscribe, adminHintStore.get, loggedOutOnServer);
}
