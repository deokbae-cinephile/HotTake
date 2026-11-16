/**
 * @file 앱 설치 안내 (install-prompt.tsx)
 * 읽는 순서: 65/84번째 · 7단계(설치형 웹 앱과 그 밖의 화면)
 *   앞: src/components/service-worker.tsx → 다음: src/app/offline/page.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   이 블로그를 "앱으로 설치"할 수 있다고 알려 줘요. 브라우저마다 설치 방법이 달라서 세 가지로 나눠요.
 *     1. 크롬·엣지·삼성 인터넷처럼 설치 단추를 띄울 수 있는 브라우저 → [앱으로 설치] 단추
 *     2. 아이폰·아이패드(Safari) → "Safari의 공유 단추 → 홈 화면에 추가" 안내 글(이 블로그가 아니라 Safari에 있는 단추예요)
 *     3. 이미 앱으로 열었거나, 설치를 지원하지 않는 브라우저 → 아무것도 보이지 않음
 *
 * beforeinstallprompt 이벤트가 뭔가요?
 *   크롬 계열 브라우저는 "이 사이트를 설치할 수 있어요"라는 때가 되면 이 이벤트를 보내요.
 *   이벤트를 붙잡아 두었다가(preventDefault) 사용자가 단추를 누를 때 prompt()로 설치 창을 띄워요.
 *   Safari에는 이 이벤트가 없어서(Next.js 공식 문서도 같은 이유로) iOS에는 안내 글을 보여 줘요.
 *
 * 배경 개념: 설치형 웹 앱(PWA, Progressive Web App)
 *   웹사이트를 휴대폰·컴퓨터에 앱처럼 설치해, 주소창 없는 자기 창으로 여는 방식이에요.
 *   설치 정보는 app/manifest.ts, 연결이 끊겨도 열리게 하는 일은 서비스 워커(public/sw.js)가 맡아요.
 *
 * 누가 쓰나요?
 *   components/site-footer.tsx(바닥글)
 */

// 브라우저의 이벤트와 화면 상태를 읽어야 해서 클라이언트 컴포넌트예요.
"use client";

// useEffect: 그린 뒤 이벤트 듣기 등록, useState: 붙잡은 설치 이벤트 기억, useSyncExternalStore: 브라우저 상태 읽기
import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * beforeinstallprompt 이벤트의 모양. TypeScript 기본 타입에 아직 없어서 직접 적어요.
 * `Event & { ... }`: 보통 이벤트(Event)의 항목에 prompt·userChoice를 더한 타입이에요.
 * `Promise<void>`: 나중에 끝나는 일(약속)이고, 끝나도 돌려주는 값은 없다는 뜻이에요.
 */
type InstallPromptEvent = Event & {
  /** 설치 창 띄우기 */
  prompt: () => Promise<void>;
  /** 사용자가 설치했는지(accepted) 닫았는지(dismissed) */
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/** "설치한 앱으로 열었는지"를 알려 주는 미디어 쿼리 */
const STANDALONE = "(display-mode: standalone)";

/**
 * 아이폰·아이패드인지. iPadOS는 맥처럼 보이므로 "맥인데 터치가 된다"도 함께 확인해요.
 * navigator.userAgent: 브라우저가 스스로 밝히는 이름표 글자예요. /iPad|iPhone|iPod/.test(…): 그 가운데 한 낱말이라도 있으면 true
 *
 * @returns 아이폰·아이패드·아이팟이면 true
 */
function getIsIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * 설치한 앱으로 열었는지. iOS Safari는 navigator.standalone으로 따로 알려 줘요.
 * `navigator as Navigator & { standalone?: boolean }`: 기본 타입에 없는 standalone 항목도 있다고 TypeScript에 알려요.
 *
 * @returns 앱 창(standalone)으로 열었으면 true
 */
function getIsStandalone() {
  return window.matchMedia(STANDALONE).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * 앱 창으로 바뀌는 것을 지켜보다가 알려 주는 함수(useSyncExternalStore에 넘겨요)
 *
 * @param onChange 바뀌었을 때 부를 함수(React가 넘겨줘요)
 * @returns 지켜보기를 그만두는 함수
 */
function subscribeStandalone(onChange: () => void) {
  const query = window.matchMedia(STANDALONE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** 바뀌지 않는 값(iOS 여부)을 지켜볼 때 쓰는 "아무것도 하지 않는" 구독 함수 */
function subscribeNothing() {
  return () => {};
}

/** 서버(미리 만든 HTML)에서는 브라우저 정보를 모르니 늘 false로 봐요. */
const onServer = () => false;

/**
 * 앱 설치 안내
 *
 * @returns 설치 단추가 있는 문단, iOS 안내 문단, 또는 null(아무것도 그리지 않음)
 */
export function InstallPrompt() {
  // useSyncExternalStore: React 바깥의 값(브라우저 상태)을 안전하게 읽는 훅이에요.
  //   (지켜보는 함수, 브라우저에서 값을 읽는 함수, 서버에서 쓸 값)을 넘겨요.
  //   미리 만든 HTML과 브라우저의 첫 화면이 어긋나지 않게(하이드레이션 오류 없이) 해 줘요.
  const isIOS = useSyncExternalStore(subscribeNothing, getIsIOS, onServer);
  const isStandalone = useSyncExternalStore(subscribeStandalone, getIsStandalone, onServer);

  // 붙잡아 둔 설치 이벤트. 있으면 [앱으로 설치] 단추를 보여요.
  // useState<InstallPromptEvent | null>: 이벤트이거나 null(아직 없음) 가운데 하나라는 타입이에요.
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  // useEffect(함수, []): 빈 배열이라 화면에 처음 나타날 때 한 번만 실행해요(이벤트 듣기 등록).
  useEffect(() => {
    /** 브라우저가 "설치할 수 있어요"라고 알려 주면 붙잡아 둬요. */
    function handlePrompt(event: Event) {
      // 브라우저가 스스로 띄우는 설치 안내를 막고, 우리 단추로 띄우게 해요.
      event.preventDefault();
      // `as InstallPromptEvent`: 이 이벤트가 위에서 적은 모양이라고 TypeScript에 알려요.
      setInstallEvent(event as InstallPromptEvent);
    }
    /** 설치가 끝나면 단추를 숨겨요. */
    function handleInstalled() {
      setInstallEvent(null);
    }
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    // 컴포넌트가 사라질 때 지켜보기를 그만둬요(정리 함수).
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  /** [앱으로 설치] 단추를 누르면 설치 창을 띄워요. 설치 창은 한 번만 띄울 수 있어서 누른 뒤에는 단추를 숨겨요. */
  async function handleInstall() {
    if (!installEvent) return;
    // await: 설치 창을 띄우고, 사용자가 설치하거나 닫을 때까지 기다려요.
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  // 이미 앱으로 열었으면 안내할 필요가 없어요.
  if (isStandalone) return null;

  // 크롬 계열: 붙잡아 둔 설치 이벤트가 있으면 [앱으로 설치] 단추를 보여요.
  if (installEvent) {
    return (
      // flex flex-wrap: 안내 글과 단추를 가로로 나란히, 좁으면 단추가 아래 줄로 내려가요. btn-line: 테두리만 있는 단추(globals.css)
      <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span>이 블로그를 앱으로 설치할 수 있어요.</span>
        <button type="button" onClick={handleInstall} className="btn-line">
          앱으로 설치
        </button>
      </p>
    );
  }

  // 아이폰·아이패드: 설치 단추를 띄울 수 없어 방법을 글로 알려요.
  if (isIOS) {
    return <p>아이폰·아이패드에서는 Safari의 공유 단추를 누르고 ‘홈 화면에 추가’를 고르면 앱으로 설치할 수 있어요.</p>;
  }

  // 그 밖의 브라우저: 설치를 지원하지 않거나 아직 때가 아니라 아무것도 그리지 않아요.
  return null;
}
