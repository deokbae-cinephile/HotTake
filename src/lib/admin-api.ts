/**
 * @file 글쓴이 API 부르기 (admin-api.ts)
 * 읽는 순서: 45/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/lib/shrink-image.ts → 다음: src/app/write/page.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   브라우저 화면이 서버 API(로그인, 로그아웃, 이미지 올리기, 리뷰 추가·수정·삭제)를 부르는 함수를 모아 둬요.
 *   모든 함수가 같은 모양의 결과를 돌려줘서 화면 코드가 단순해져요.
 *     성공: { ok: true, data }
 *     실패: { ok: false, status, message, errors? } — message는 알림 문구, errors는 칸마다 오류 문구
 *   화면은 `if (result.ok) { ... } else { ... }`처럼 ok 하나만 보고 갈래를 나누면 돼요.
 *
 * 인터넷이 끊겨 서버에 닿지도 못하면 status 0과 "연결 확인" 문구를 돌려줘요.
 * (HTTP 상태 번호는 100~599라서 0은 "서버의 답이 아예 없었다"는 우리끼리의 약속이에요.)
 *
 * 배경 개념
 *   - API: 화면 대신 데이터(JSON)를 주고받는 서버 주소예요. 이 블로그의 API는 src/app/api/** 의 route.ts예요.
 *   - fetch: 브라우저에 들어 있는 "서버에 요청 보내기" 함수예요. 답(Response)을 Promise로 돌려줘요.
 *   - async/await: Promise(나중에 끝나는 일)를 기다렸다가 결과를 받는 문법이에요.
 *     async 함수 안에서 `await 일`이라고 쓰면, 그 일이 끝날 때까지 기다린 뒤 다음 줄로 넘어가요.
 *
 * 누가 쓰나요?
 *   components/login-form.tsx(로그인), components/session-controls.tsx(로그아웃),
 *   components/review-writer.tsx(이미지 올리기·리뷰 저장), components/delete-review.tsx(리뷰 삭제)
 */

// `import type`: 타입만 가져와요. 타입은 실행할 때 사라지므로, 실제 코드(서버 전용 코드 등)가 화면 묶음에 섞이지 않아요.
import type { ReviewFormValues } from "./review-values";
import type { FieldErrors } from "./review-form";

/**
 * API 결과의 모양이에요.
 *
 * `<T>`(제네릭): "성공했을 때 data에 무엇이 들었는지"를 부르는 쪽에서 정해 넣는 자리예요.
 *   예: ApiResult<{ ok: true }>는 data가 { ok: true }인 결과예요.
 * `A | B`(유니언): A 모양이거나 B 모양이에요. ok가 true인지 false인지 보면 TypeScript가 어느 쪽인지 알아채요.
 * `errors?`: 물음표는 "없어도 되는 항목"이라는 뜻이에요.
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; message: string; errors?: FieldErrors };

/**
 * 서버에 닿지 못했을 때의 결과예요.
 * `as const`: 값을 고정된 글자·숫자 그대로의 타입으로 만들어요(ok가 boolean이 아니라 false로 정해져요).
 * 그래서 ApiResult의 실패 모양에 그대로 들어맞아요.
 */
const OFFLINE = { ok: false, status: 0, message: "서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요." } as const;

/**
 * 요청을 보내고 결과를 ApiResult 모양으로 바꿔요. 이 파일의 모든 함수가 이 함수를 거쳐요.
 * 실패 응답이면 서버가 보낸 { message, errors }를 꺼내고, 그마저 없으면 기본 문구를 써요.
 *
 * @param url 부를 API 주소. 예: "/api/session"
 * @param init fetch에 넘길 요청 설정(방법 method, 머리글 headers, 본문 body)
 * @returns 성공이면 { ok: true, data }, 실패면 { ok: false, status, message, errors? }
 */
async function send<T>(url: string, init: RequestInit): Promise<ApiResult<T>> {
  // let: 나중에 값을 넣을 변수예요. try 안에서 넣고 try 밖에서 써야 해서 먼저 만들어 둬요.
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    // fetch는 서버에 닿지 못했을 때(인터넷 끊김 등)만 오류를 던져요. 404·500 같은 답은 오류가 아니라 정상 답이에요.
    return OFFLINE;
  }
  // 답이 JSON이 아닐 수도 있어서(호스팅의 오류 화면, 중간에 끊긴 답 등) 읽기에 실패하면 undefined로 봐요.
  // `.catch(() => undefined)`: Promise가 실패하면 오류 대신 undefined를 결과로 삼아요.
  // `unknown`: "무엇이 들었는지 아직 모름" 타입이에요. 확인하기 전에는 함부로 쓸 수 없어서 안전해요.
  const read: unknown = await response.json().catch(() => undefined);
  // response.ok: 상태 번호가 200~299(성공)이면 true예요.
  if (response.ok) {
    // 성공 답은 늘 JSON이에요. 읽지 못했다면 답이 중간에 끊긴 거라, 성공으로 넘기지 않아요.
    // 서버에서는 저장이 끝났을 수도 있어서, 다시 하기 전에 먼저 확인하라고 알려요.
    // (typeof null도 "object"라서 null인지 따로 확인해요.)
    if (read === null || typeof read !== "object") {
      return {
        ok: false,
        status: response.status,
        message: "서버의 답을 끝까지 받지 못했습니다. 이미 저장됐을 수 있으니 목록에서 먼저 확인한 뒤 다시 시도해 주세요.",
      };
    }
    // `as T`: "이 값은 T 모양이에요"라고 TypeScript에 알려 줘요(서버와 약속한 모양을 믿어요).
    return { ok: true, data: read as T };
  }
  // 실패 답: 서버가 보낸 { message, errors }를 꺼내요.
  // `??`: 왼쪽이 null이나 undefined일 때만 오른쪽을 써요. 읽지 못했으면 빈 객체({})로 봐요.
  const body = (read ?? {}) as { message?: string; errors?: FieldErrors };
  return {
    ok: false,
    status: response.status,
    // 서버 문구가 없으면 상태 번호를 넣은 기본 문구를 써요. `${...}`: 백틱(`) 글자 안에 값을 끼워 넣는 문법이에요.
    message: body.message ?? `요청을 처리하지 못했습니다(응답 ${response.status}). 잠시 뒤 다시 시도해 주세요.`,
    errors: body.errors,
  };
}

/**
 * JSON을 보내는 요청 설정을 만들어요.
 *
 * @param method HTTP 방법. "POST"(만들기), "PUT"(고치기), "DELETE"(지우기)
 * @param body 보낼 값. 없으면 본문 없이 보내요(로그아웃·삭제처럼).
 * @returns fetch의 두 번째 값으로 넣을 설정
 */
function json(method: string, body?: unknown): RequestInit {
  return {
    method,
    // Content-Type: "본문이 JSON이에요"라고 서버에 알려 주는 머리글이에요. 본문이 없으면 붙이지 않아요.
    // `조건 ? A : B`(삼항 연산자): 조건이 참이면 A, 거짓이면 B예요.
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    // JSON.stringify: 자바스크립트 값을 JSON 글자로 바꿔요. 요청 본문은 글자로 보내야 해서예요.
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

/**
 * 로그인. 서버가 아이디·비밀번호를 확인하고, 맞으면 로그인 쿠키를 구워 줘요(app/api/session/route.ts).
 *
 * @param id 글쓴이 아이디
 * @param password 비밀번호
 * @example
 * const result = await login("deokbae", "비밀번호");
 * if (!result.ok) alert(result.message);
 */
export function login(id: string, password: string) {
  // { id, password }: { id: id, password: password }의 줄임 문법이에요.
  return send<{ ok: true }>("/api/session", json("POST", { id, password }));
}

/** 로그아웃. 서버가 로그인 쿠키 두 개를 지워요. */
export function logout() {
  return send<{ ok: true }>("/api/session", json("DELETE"));
}

/**
 * 이미지 한 장 올리기. 파일은 JSON이 아니라 FormData(파일을 담는 상자)로 보내요.
 * FormData를 body에 넣으면 브라우저가 Content-Type(multipart/form-data)을 알아서 붙여 줘서, 머리글을 직접 쓰지 않아요.
 *
 * @param file 고른 그림 파일(Blob: 파일 내용 덩어리. File도 Blob의 한 종류예요)
 * @param path 저장소 안 경로. 예: public/images/winter-stop.jpg
 * @returns 성공하면 { path, sha } — sha는 GitHub가 매긴 파일 내용 번호예요. 리뷰를 저장할 때 함께 보내요.
 */
export function uploadImage(file: Blob, path: string) {
  const form = new FormData();
  // append(이름, 값): 상자에 칸을 하나 더해요. 서버(app/api/images/route.ts)는 같은 이름으로 꺼내요.
  form.append("file", file);
  form.append("path", path);
  return send<{ path: string; sha: string }>("/api/images", { method: "POST", body: form });
}

/** 리뷰 저장에 보내는 내용(서버의 lib/review-store.ts SavePayload와 같은 모양) */
export type SaveRequest = {
  /** 글쓰기 칸 값 */
  values: ReviewFormValues;
  /** 이번에 새로 올린 이미지(uploadImage의 결과). 이미지를 새로 고르지 않았으면 빼요. */
  upload?: { path: string; sha: string };
  /** 수정 화면이 처음 불러온 원고의 내용 번호(sha). 그사이 다른 곳에서 고쳤는지 서버가 확인해요. 새 리뷰면 빼요. */
  baseSha?: string;
};

/**
 * 리뷰 추가. 성공하면 { slug(파일 이름), commitSha(GitHub 커밋 번호) }를 받아요.
 *
 * @param request 칸 값과, 새로 올린 이미지
 */
export function createReview(request: SaveRequest) {
  return send<{ slug: string; commitSha: string }>("/api/reviews", json("POST", request));
}

/**
 * 리뷰 수정.
 *
 * encodeURIComponent: 주소에 넣으면 곤란한 글자(/, ?, # 등)를 %XX 모양으로 바꿔, 주소의 한 조각으로 안전하게 넣어요.
 *
 * @param slug 고칠 리뷰의 파일 이름(확장자 .json을 뺀 것). 예: "winter-stop"
 * @param request 칸 값, 새로 올린 이미지, 처음 불러온 원고의 번호(baseSha)
 */
export function updateReview(slug: string, request: SaveRequest) {
  return send<{ slug: string; commitSha: string }>(`/api/reviews/${encodeURIComponent(slug)}`, json("PUT", request));
}

/**
 * 리뷰 삭제. 성공하면 지운 리뷰의 제목(title)과 커밋 번호(commitSha)를 받아요.
 *
 * @param slug 지울 리뷰의 파일 이름. 예: "winter-stop"
 */
export function deleteReview(slug: string) {
  return send<{ title: string; commitSha: string }>(`/api/reviews/${encodeURIComponent(slug)}`, json("DELETE"));
}
