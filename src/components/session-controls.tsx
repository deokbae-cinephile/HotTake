/**
 * @file 글쓴이 로그아웃 (session-controls.tsx)
 * 읽는 순서: 39/84번째 · 5단계(글쓴이 로그인과 잠금)
 *   앞: src/components/use-is-admin.ts → 다음: scripts/admin-secrets.mjs (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓴이로 로그인했을 때만 화면 왼쪽 아래에 떠 있는 [로그아웃] 단추를 보여 줘요(오른쪽 아래의 [맨 위로]와 같은 모양).
 *   어느 화면에서든 같은 자리에 있어서, 길게 내려 읽다가도 바로 로그아웃할 수 있어요.
 *     - 로그인 전: 아무것도 보이지 않아요. 방문자에게 로그인 링크를 보이지 않으려고요.
 *       글쓴이는 로그인 화면 주소(/login)로 직접 가거나, 글쓰기 화면(/write)에 가면 로그인 화면으로 보내져요(proxy.ts).
 *     - 로그인 뒤: [로그아웃] 단추 → 로그인 쿠키를 지우고 처음 화면으로
 *
 * 로그아웃을 두 번 빠르게 눌러도 요청은 한 번만 가요(useRef 잠금).
 *   useRef: 값을 기억하지만 바꿔도 화면을 다시 그리지 않는 상자예요(.current로 읽고 써요). 바꾸는 즉시 다음 클릭에서 보여요.
 *
 * 누가 쓰나요?
 *   components/site-footer.tsx(바닥글의 왼쪽 아래 고정 줄)
 */

// "use client": 누름을 받고 상태(useState·useRef)를 쓰는 클라이언트 컴포넌트예요.
"use client";

// useRouter: 코드로 다른 화면으로 옮기는(push) Next.js 훅이에요.
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

// logout: 서버(/api/session)에 DELETE 요청을 보내 로그인 쿠키를 지우게 하는 함수
import { logout } from "@/lib/admin-api";
// adminHintStore: 로그인 표시 쿠키를 읽고, 바뀌었다고 화면들에 알리는 작은 저장소
import { adminHintStore } from "@/lib/admin-hint";

import { useIsAdmin } from "./use-is-admin";

/**
 * 바닥글의 로그아웃(로그인했을 때만)
 *
 * @returns 로그인했으면 [로그아웃] 단추 + 실패 안내 영역, 아니면 null(아무것도 그리지 않음)
 */
export function SessionControls() {
  const isAdmin = useIsAdmin();
  const router = useRouter();
  // 로그아웃 실패 문구. 실패했을 때만 보여요.
  const [error, setError] = useState("");
  // 요청을 보내는 중인지. useState는 다음 그리기에야 바뀌어서, 아주 빠른 두 번 클릭을 막으려고 useRef로도 잠가요.
  const lockRef = useRef(false);

  /**
   * [로그아웃]을 누르면 실행돼요.
   * async 함수: 안에서 await로 서버 답을 기다릴 수 있어요. 기다리는 동안에도 화면은 멈추지 않아요.
   */
  async function handleLogout() {
    // 이미 요청을 보내는 중이면 그냥 돌아가요(두 번째 클릭 무시).
    if (lockRef.current) return;
    lockRef.current = true;
    // result: 성공이면 { ok: true, data }, 실패면 { ok: false, status, message } 모양이에요(lib/admin-api.ts).
    const result = await logout();
    if (result.ok) {
      // 쿠키가 지워졌다고 화면에 알리고, 처음 화면으로 가요. refresh(): 서버에서 그린 부분(글쓰기 화면 등)도 새로 받아요.
      adminHintStore.notify();
      router.push("/");
      router.refresh();
    } else {
      setError(result.message);
    }
    // 실패했을 때 다시 누를 수 있게, 성공했을 때도 다음 로그인 뒤를 위해 잠금을 풀어요(이 단추는 화면을 떠나지 않아요).
    lockRef.current = false;
  }

  // 로그인 전에는 아무것도 그리지 않아요(로그인 링크도 없어요).
  if (!isAdmin) return null;

  return (
    // 실패 안내(absolute)는 이 단추가 아니라 바깥의 왼쪽 아래 고정 줄(site-footer.tsx, position: fixed, 화면 왼쪽 16px)을 기준으로 떠요.
    // 그래서 안내 상자가 화면 왼쪽 16px부터 시작해, 최대 너비(100vw − 2rem) 안에서 오른쪽 밖으로 넘치지 않아요.
    // (그래서 이 묶음에는 relative를 주지 않아요.) 안내가 떠도 단추 줄은 움직이지 않아요.
    <div>
      {/* btn-float: [맨 위로]와 같은 떠 있는 단추 모양(누르는 높이 44px, globals.css) */}
      <button type="button" onClick={handleLogout} className="btn-float">
        로그아웃
      </button>
      {/* role="alert": 로그아웃에 실패하면 바로 읽어 줘요. 영역은 단추와 함께 늘 두고 글자만 바꿔요.
          글이 있을 때만 단추 위에 상자로 보여요(비어 있으면 상자 모양도 없어서 보이지 않아요).
          bottom-full: 기준 상자의 바로 위에 붙어요. w-max: 글 길이만큼 넓어지되 max-w-[calc(100vw-2rem)]를 넘지 않아요. */}
      <p
        role="alert"
        className={
          error
            ? "absolute bottom-full left-0 mb-2 w-max max-w-[calc(100vw-2rem)] border-2 border-crt-fg bg-crt-bg px-3 py-2 shadow-[0_0_1rem_rgb(var(--glow-rgb)/0.3)]"
            : "absolute bottom-full left-0"
        }
      >
        {error}
      </p>
    </div>
  );
}
