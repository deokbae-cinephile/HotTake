/**
 * @file 글쓴이 로그인 폼 (login-form.tsx)
 * 읽는 순서: 36/84번째 · 5단계(글쓴이 로그인과 잠금)
 *   앞: src/app/login/page.tsx → 다음: src/lib/admin-hint.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   아이디와 비밀번호를 받아 로그인해요. 이 블로그는 글쓴이 한 사람만 로그인할 수 있어요.
 *   로그인하면 원래 가려던 화면(주소의 ?next=, 없으면 처음 화면)으로 돌아가요.
 *
 * 접근성 포인트 (KWCAG 7.3.2 레이블, 7.3.3 접근 가능한 인증)
 *   - 칸마다 눈에 보이는 이름(<label>)이 있어요. "(필수)"도 글자로 적어요.
 *   - autoComplete="username" / "current-password": 비밀번호 관리자가 채워 줄 수 있어요.
 *     비밀번호 붙여 넣기도 막지 않아요. 외워서 쳐야만 하는 로그인은 누군가에게는 어려운 일이에요.
 *   - [비밀번호 보기] 단추로 친 글자를 확인할 수 있어요(aria-pressed로 켜짐·꺼짐을 알려 줘요).
 *   - 틀리면: 틀린 칸에 aria-invalid와 오류 문구(aria-describedby·aria-errormessage)를 이어 주고,
 *     그 칸으로 초점을 옮겨요. 화면 낭독기는 칸 이름과 함께 오류 문구를 읽어요.
 *
 * 두 번 누름 막기
 *   [로그인]을 빠르게 두 번 눌러도 요청은 한 번만 가요(useRef 잠금).
 *   로그인에 성공하면 화면을 떠나므로 잠금을 풀지 않고, 실패했을 때만 풀어요.
 *
 * 누가 쓰나요?
 *   app/login/page.tsx(로그인 화면)
 */

// "use client": 친 글자·오류·보기 켜짐 같은 상태를 다루고 누름을 받는 클라이언트 컴포넌트예요.
"use client";

// useRouter: 코드로 화면을 옮기는 훅, useSearchParams: 주소의 ? 뒤 검색 조건(예: ?next=/write)을 읽는 훅
import { useRouter, useSearchParams } from "next/navigation";
// FormEvent: 폼 제출 사건의 타입, useId: 화면마다 겹치지 않는 id를 만들어 주는 훅
import { type FormEvent, useId, useRef, useState } from "react";

// login: 서버(/api/session)에 아이디·비밀번호를 POST로 보내 확인을 맡기는 함수
import { login } from "@/lib/admin-api";
// adminHintStore: 로그인 표시 쿠키가 바뀌었다고 화면 조각들(+ 단추, 로그아웃 등)에 알리는 저장소
import { adminHintStore } from "@/lib/admin-hint";

/**
 * 칸별 오류 문구(없으면 빈 칸)
 * id: 아이디 칸, password: 비밀번호 칸, form: 칸과 상관없는 오류(연결 끊김 등). `?`가 붙어 모두 없어도 돼요.
 */
type Errors = { id?: string; password?: string; form?: string };

/**
 * 로그인 뒤에 갈 주소를 안전하게 골라요.
 * "/write"처럼 우리 사이트 안의 주소만 받아요. "//nasty.example"이나 "https://..."처럼
 * 다른 사이트로 보내는 주소가 들어오면 처음 화면("/")으로 가요(로그인 화면을 이용한 피싱 막기).
 * (이런 공격을 "열린 리디렉션(open redirect)"이라고 해요. 믿을 만한 사이트 주소로 사람을 속여 다른 사이트로 보내는 수법이에요.)
 *
 * @param next 주소의 ?next= 값. 없으면 null
 * @returns 안전한 사이트 안 주소(경로 + 검색 조건 + # 부분). 믿을 수 없으면 "/"
 *
 * @example
 * safeNext("/write");            // "/write"
 * safeNext("//evil.example");    // "/"
 * safeNext(null);                // "/"
 */
export function safeNext(next: string | null): string {
  // 1) "/"로 시작하는 주소만 받아요.
  // 2) 제어 문자(탭·줄바꿈 등)와 역슬래시가 섞인 주소는 받지 않아요.
  //    브라우저의 주소 해석기는 탭·줄바꿈을 지우고 역슬래시를 "/"로 바꿔서,
  //    "/\t/evil.example" 같은 주소가 다른 사이트 주소("//evil.example")로 바뀔 수 있어요.
  // 3) 끝으로 진짜 주소 해석기로 풀어 본 뒤, 출처(origin)가 우리 사이트 그대로인지 확인해요.
  // 4) 풀어 낸 경로가 "//"로 시작하면 받지 않아요. "/a/..//evil.example"은 "..//"가 정리되면서
  //    "//evil.example"(다른 사이트)이 되거든요. 돌려줄 값을 다시 주소로 읽어도 안전해야 해요.
  // (제어 문자를 일부러 찾는 정규식이라, "정규식에 제어 문자 금지" 규칙을 이 줄에서만 꺼요.)
  // 정규식 /[\u0000-\u001f\u007f\\]/: 대괄호 안 글자 가운데 하나라도 있으면 맞아요. \u0000-\u001f·\u007f는 제어 문자, \\는 역슬래시예요.
  // oxlint-disable-next-line no-control-regex
  if (!next || !next.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(next)) return "/";
  try {
    // 기준 주소는 아무 값이나 괜찮아요. 풀어 낸 주소의 출처가 기준과 같으면 사이트 안 주소예요.
    const base = "http://same.origin";
    // new URL(상대 주소, 기준 주소): 기준에 이어 붙여 완전한 주소로 풀어요. 풀 수 없는 주소면 오류를 던져 catch로 가요.
    const url = new URL(next, base);
    if (url.origin !== base || url.pathname.startsWith("//")) return "/";
    // 경로(/write) + 검색 조건(?a=1) + # 부분(#x)만 이어 돌려줘요. 기준 주소(출처)는 빼요.
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

/**
 * 로그인 폼
 *
 * @returns 아이디·비밀번호 칸, [비밀번호 보기], 오류 안내, [로그인] 단추를 담은 form 요소
 */
export function LoginForm() {
  const router = useRouter();
  // 주소의 ?next= 값. proxy.ts가 로그인 화면으로 보낼 때 원래 주소를 적어 줘요.
  const next = safeNext(useSearchParams().get("next"));

  // 칸에 친 글자. 칸의 value와 묶어 두는 "제어 컴포넌트" 방식이라, 글자를 칠 때마다 상태가 바뀌고 다시 그려져요.
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  // 비밀번호를 글자로 보일지(켜짐 true / 꺼짐 false)
  const [showPassword, setShowPassword] = useState(false);
  // 칸별 오류 문구. useState<Errors>: 제네릭(<>)으로 상태의 타입을 Errors로 정해요.
  const [errors, setErrors] = useState<Errors>({});
  // 서버 답을 기다리는 중인지. [로그인] 단추를 막고 "확인하는 중…"을 보여요.
  const [pending, setPending] = useState(false);
  // 두 번 누름 막기 잠금
  const lockRef = useRef(false);
  // 오류가 난 칸으로 초점을 옮길 때 쓰는 손잡이
  // useRef<HTMLInputElement>(null): 처음엔 비어 있다가, 아래 input의 ref={idRef}로 그 칸 요소가 들어와요.
  const idRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  // label·오류 문구를 이을 id. useId는 서버와 브라우저에서 같은 값을 만들어, 화면에 같은 폼이 둘 있어도 겹치지 않아요.
  const fieldId = useId();

  /**
   * [로그인]을 누르거나 Enter를 치면 실행돼요.
   *
   * @param event 폼 제출 사건. FormEvent<HTMLFormElement>: form 요소에서 일어난 제출 사건이라는 타입이에요.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // 페이지를 새로 고치는 폼의 기본 동작을 막아요. 우리가 직접 요청을 보내요.
    event.preventDefault();
    // 이미 보내는 중이면 두 번째 제출은 무시해요.
    if (lockRef.current) return;

    // 1) 빈 칸 확인. 비어 있으면 서버에 보내지 않고 바로 알려요.
    const empty: Errors = {};
    // trim(): 앞뒤 빈칸을 지워요. 빈칸만 친 아이디도 빈 칸으로 봐요(비밀번호는 빈칸도 글자일 수 있어 그대로 봐요).
    if (id.trim() === "") empty.id = "아이디를 입력하세요.";
    if (password === "") empty.password = "비밀번호를 입력하세요.";
    if (empty.id || empty.password) {
      setErrors(empty);
      // 첫 번째 빈 칸으로 초점을 옮겨요. 아이디가 비었으면 idRef, 아니면 passwordRef를 골라 그 칸에 focus()를 불러요.
      (empty.id ? idRef : passwordRef).current?.focus();
      return;
    }

    // 2) 서버에 확인을 맡겨요.
    lockRef.current = true;
    setPending(true);
    setErrors({});
    const result = await login(id.trim(), password);

    if (result.ok) {
      // 성공: 쿠키가 바뀌었다고 화면에 알리고, 원래 가려던 곳으로 가요. 화면을 떠나니 잠금은 그대로 둬요.
      adminHintStore.notify();
      // replace: 지금 기록을 바꿔치기해서, 뒤로 가기를 눌러도 로그인 화면으로 돌아오지 않아요.
      // refresh: 서버에서 그린 부분을 새로 받아 로그인한 모습으로 바꿔요.
      router.replace(next);
      router.refresh();
      return;
    }

    // 3) 실패: 이유를 보여 주고 다시 시도할 수 있게 잠금을 풀어요.
    lockRef.current = false;
    setPending(false);
    // 401: "인증 실패"(아이디·비밀번호가 틀림)를 뜻하는 HTTP 상태 번호예요.
    if (result.status === 401) {
      // 아이디·비밀번호 중 무엇이 틀렸는지는 일부러 알려 주지 않아요(아이디를 알아내는 데 쓰일 수 있어서요).
      setErrors({ password: result.message });
      passwordRef.current?.focus();
    } else {
      // 그 밖의 실패(서버 설정 없음, 너무 여러 번 시도해 잠김, 연결 끊김 등)는 폼 전체 오류로 알려요.
      setErrors({ form: result.message });
    }
  }

  // 칸마다 오류 문구의 id. 오류가 있을 때만 aria-describedby·aria-errormessage로 이어요.
  // aria-errormessage는 화면 낭독기마다 지원이 고르지 않아서 aria-describedby로도 함께 이어요.
  const idErrorId = `${fieldId}-id-error`;
  const passwordErrorId = `${fieldId}-password-error`;

  return (
    // noValidate: 브라우저가 띄우는 기본 오류 말풍선 대신 우리 문구를 보여 줘요(언어와 모양을 맞추려고요).
    <form onSubmit={handleSubmit} noValidate className="grid gap-6">
      {/* 아이디 칸 묶음: 이름표 + 입력 칸 + 오류 문구. grid gap-2: 세로로 8px씩 띄워 쌓아요. */}
      <div className="grid gap-2">
        {/* htmlFor: HTML의 for 속성이에요(JSX에서는 for가 JavaScript 낱말이라 htmlFor로 써요). 같은 id의 칸과 이어져, 이름표를 눌러도 칸에 초점이 가요. */}
        <label htmlFor={`${fieldId}-id`} className="glow">
          아이디 <span className="text-crt-dim">(필수)</span>
        </label>
        <input
          ref={idRef}
          id={`${fieldId}-id`}
          name="username"
          type="text"
          required
          autoComplete="username"
          // autoCapitalize="none": 휴대폰 자판이 첫 글자를 대문자로 바꾸지 않게, spellCheck={false}: 맞춤법 밑줄을 끄게 해요.
          autoCapitalize="none"
          spellCheck={false}
          value={id}
          // onChange: 글자를 칠 때마다 불려요. event.target.value가 칸에 지금 들어 있는 글자예요.
          onChange={(event) => setId(event.target.value)}
          // 오류가 있을 때만 aria-invalid="true". undefined면 속성을 아예 붙이지 않아요(처음 빈 칸에는 붙이지 않아요).
          aria-invalid={errors.id ? true : undefined}
          aria-describedby={errors.id ? idErrorId : undefined}
          aria-errormessage={errors.id ? idErrorId : undefined}
          className="field"
        />
        {/* 오류 문구 자리. 늘 두고 글자만 바꿔요. field-error: 오류 글자 모양(globals.css) */}
        <p id={idErrorId} className="field-error">
          {errors.id}
        </p>
      </div>

      <div className="grid gap-2">
        <label htmlFor={`${fieldId}-password`} className="glow">
          비밀번호 <span className="text-crt-dim">(필수)</span>
        </label>
        {/* 칸과 [비밀번호 보기]를 가로로 나란히. 좁으면(flex-wrap) 단추가 아래 줄로 내려가요.
            칸의 flex-1 basis-56: 남는 너비를 차지하되 기본 너비는 14rem(224px)이에요. min-w-0: 칸이 너무 좁은 화면을 밀어내지 않게 해요. */}
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={passwordRef}
            id={`${fieldId}-password`}
            name="password"
            // 보기를 켜면 글자로(type="text"), 끄면 가린 글자로(type="password") 보여요.
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={errors.password ? true : undefined}
            aria-describedby={errors.password ? passwordErrorId : undefined}
            aria-errormessage={errors.password ? passwordErrorId : undefined}
            className="field min-w-0 flex-1 basis-56"
          />
          {/* 토글 단추: 글자는 그대로 두고 눌림 상태(aria-pressed)로 켜짐·꺼짐을 알려요. */}
          {/* setShowPassword((value) => !value): 앞의 값을 받아 뒤집은 값으로 바꿔요(함수로 넘기면 늘 최신 값에서 바꿔요). */}
          <button type="button" aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)} className="btn-line">
            비밀번호 보기
          </button>
        </div>
        <p id={passwordErrorId} className="field-error">
          {errors.password}
        </p>
      </div>

      {/* 칸과 상관없는 오류(서버 설정 없음, 연결 끊김 등). role="alert": 나타나면 바로 읽어 줘요.
          영역은 처음부터 두고 글자만 바꿔요. 비어 있을 때는 화면에서만 숨겨(empty:sr-only) 빈 간격이 생기지 않게 해요. */}
      <p role="alert" className="alert-text empty:sr-only">
        {errors.form}
      </p>

      <div>
        {/* type="submit": 누르면 폼을 제출해 handleSubmit이 불려요. disabled={pending}: 기다리는 동안 다시 누를 수 없어요.
            btn-inverse: 초록 바탕에 어두운 글자의 반전 단추(globals.css) */}
        <button type="submit" disabled={pending} className="btn-inverse">
          {pending ? "확인하는 중…" : "로그인"}
        </button>
      </div>
    </form>
  );
}
