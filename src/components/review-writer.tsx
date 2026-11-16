/**
 * @file 리뷰 라이터 = 리뷰 추가·수정 화면 (review-writer.tsx)
 * 읽는 순서: 51/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/components/not-configured.tsx → 다음: src/lib/review-file.ts (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓴이가 리뷰를 추가하고 수정하는 폼이에요.
 *
 *     넓은 화면(1024px~)은 3칸: [이미지 | 콘텐츠 정보 2열 × 3행]
 *     ┌ 이미지 ───────┐ ┌ 콘텐츠 정보 ─────────────────────────────────────────┐
 *     │ [미리보기]     │ │ 분류(처음 영화)  평점 │ 제목                              │
 *     │ [이미지 고르기]│ │ 파일 이름             │ 연도                              │  ← 단추는 이미지와 같은 너비
 *     │ [이미지 빼기]  │ │ 감독 또는 작가        │ 한 줄 평                          │
 *     └───────────────┘ └────────────────────────────────────────────────────┘
 *                                                   [리뷰 저장] [취소]   ← 오른쪽 정렬
 *   좁은 화면에서는 한 칸으로, 이미지 → 콘텐츠 정보 → 단추 차례로 쌓여요(코드 순서도 같아서 화면 낭독기가 읽는 순서도 같아요).
 *   분류와 평점은 늘 한 줄에 나란히 놓여요(휴대폰도). 둘 다 짧은 고르기 칸이라 반 칸씩이면 충분해요.
 *   칸 아래에 도움말은 두지 않아요. 칸 이름만으로 알 수 있고, 틀리면 오류 문구가 고치는 방법을 알려 줘요.
 *   칸 이름에 "[필수]" 같은 표시는 두지 않아요. 이미지 말고는 모두 꼭 적어야 하는 칸이라, 글자 칸에 required만 달아
 *   화면 낭독기가 "필수"라고 알려 줘요. 비워 두고 저장하면 오류 문구가 무엇을 적어야 하는지 알려 줘요.
 *
 * 저장하는 순서
 *   1. 칸 검사(lib/review-form.ts) — 틀린 칸이 있으면 칸마다 오류 문구를 달고, 가장 위의 틀린 칸으로 스크롤해 초점을 옮겨요.
 *   2. 새로 고른 이미지를 올려요(app/api/images).
 *   3. 칸 값과 올린 이미지를 저장 API(app/api/reviews)로 보내요. 서버가 다시 검사한 뒤 저장소에 커밋해요.
 *   4. "저장했습니다" 안내. GitHub Actions가 검사한 뒤 다시 배포하면(몇 분 뒤) 블로그에 보여요.
 *
 * 이미지는 올리기 전에 줄여요
 *   고르는 순간 브라우저 안에서 긴 변 1600px의 JPG로 줄여요(lib/shrink-image.ts). 이미 작은 JPG·PNG는 그대로예요.
 *   그래서 4MB가 넘는 휴대폰 사진도 고를 수 있어요. 화면에서는 형광 초록 4단계 명암과 주사선으로 바꿔 보여 줘요(SVG 필터).
 *
 * 저장 로딩
 *   [리뷰 저장]을 누르면 단추 줄 바로 아래에 로딩 UI(깜빡이는 커서 + 16칸 막대, loading-status.tsx)를 보여요.
 *     "이미지를 올리는 중" → "리뷰를 저장하는 중"
 *   안내 영역(role="status")은 처음부터 두고 내용만 바꿔서, 화면 낭독기가 단계마다 읽어 줘요.
 *
 * 두 번 누름 막기
 *   [리뷰 저장]을 빠르게 두 번 눌러도 저장은 한 번만 해요. useState는 다음 그리기에야 바뀌어서 useRef 잠금을 함께 써요.
 *   저장에 성공하면 폼을 떠나므로(저장 완료 안내로 바뀌어요) 잠금을 풀지 않고, 실패했을 때만 풀어요.
 *
 * 누가 쓰나요?
 *   app/write/page.tsx(리뷰 추가), app/write/[slug]/page.tsx(리뷰 수정)
 *
 * 파일 안의 구성(위에서 아래로)
 *   1. 화면이 받는 값과 정해 둔 값(EditSource, Props, RATINGS, FIELD_LABELS 등)
 *   2. 글쓰기 폼(ReviewWriter)과 처음 상태 만들기(initialState)
 *   3. 칸 조각들(Field, TextField, FileButton)
 */

// "use client": 브라우저에서 돌아가는 클라이언트 컴포넌트라는 표시예요.
// 칸 값(useState), 파일 고르기, 저장 요청처럼 사용자의 손길에 반응하는 일을 하므로 꼭 필요해요.
"use client";

// next/image: Next.js의 그림 요소(크기 맞추기·늦게 받기 등을 도와줘요). 여기서는 미리보기에 써요.
import Image from "next/image";
// next/link: 페이지를 통째로 다시 받지 않고 옮겨 가는 Next.js의 링크
import Link from "next/link";
// React 도구들. 앞에 type이 붙은 것은 타입만 가져와요(빌드하면 사라져요).
//   ChangeEvent·FormEvent: 입력 바뀜·폼 제출 이벤트의 타입, ReactNode: 화면에 그릴 수 있는 모든 것의 타입
//   useLayoutEffect: useEffect와 같지만, 화면에 칠하기 "직전"에 바로 실행돼요.
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// 서버 API를 부르는 함수들(이미지 올리기, 리뷰 만들기·고치기)과 그 결과 타입
import { type ApiResult, createReview, updateReview, uploadImage } from "@/lib/admin-api";
// 분류 목록: ["영화", "도서"]
import { CATEGORIES } from "@/lib/categories";
// 큰 사진을 브라우저 안에서 줄이는 함수와, 바이트 수를 "1.2MB"처럼 바꾸는 함수
import { shrinkImage } from "@/lib/shrink-image";
// 칸 검사(화면과 서버가 같은 규칙을 써요)와 칸별 오류 문구의 타입
import { type FieldErrors, validateReviewForm } from "@/lib/review-form";
// 파일 이름 규칙(정규 표현식): 영어 소문자·숫자·하이픈만
import { SLUG } from "@/lib/review-schema";
// 폼 칸 값의 모양(ReviewFormValues)과 빈 칸 값(EMPTY_VALUES)
import { EMPTY_VALUES, type ReviewFormValues } from "@/lib/review-values";
// 이미지 파일 규칙: 확장자 꺼내기, 고를 수 있는 형식, 형식·크기 검사
import { extensionOf, IMAGE_ACCEPT, uploadProblem } from "@/lib/upload-rules";

import { Choice, ChoiceGroup } from "./choice-chips";
import { LoadingStatus } from "./loading-status";
import { PixelArt } from "./pixel-art";
import { DefaultImage } from "./review-image";

/* ──────────────────────────────────────────────────────────────
 * 1. 화면이 받는 값과 정해 둔 값
 * ────────────────────────────────────────────────────────────── */

/**
 * 수정 화면이 서버에서 원고를 읽은 결과(app/write/[slug]/page.tsx가 lib/review-file.ts로 읽어 넘겨줘요)
 *
 * `A | B`(유니언 타입): 둘 중 하나의 모양이에요. ok가 true면 values가, false면 message가 있어요.
 * 이렇게 ok 같은 "표시 칸"으로 갈래를 나누면, `if (parsed.ok)`로 확인한 뒤 TypeScript가 어느 모양인지 알아서 좁혀 줘요.
 * export: app/write/[slug]/page.tsx에서도 이 타입을 써요.
 */
export type EditSource =
  | {
      ok: true;
      /** 원고에서 읽은 칸 값(파일 이름 빼고). `Omit<T, "slug">`: T에서 slug 항목만 뺀 타입이에요. */
      values: Omit<ReviewFormValues, "slug">;
    }
  | {
      ok: false;
      /** 읽지 못한 까닭과 고치는 방법 */
      message: string;
    };

/**
 * ReviewWriter가 받는 값(props). 리뷰 추가면 mode만, 수정이면 서버가 읽은 원고와 그 내용 번호까지 받아요.
 * mode가 "create"인지 "edit"인지로 갈래가 나뉘는 유니언 타입이에요.
 */
type Props =
  | { mode: "create" }
  | {
      mode: "edit";
      /** 수정할 리뷰의 파일 이름 */
      slug: string;
      /** 저장소에서 읽은 원고(서버가 칸 값으로 바꿔 둔 것) */
      parsed: EditSource;
      /** 원고의 내용 번호(sha). Git이 파일 내용마다 붙이는 이름표예요. 저장할 때 그사이 다른 곳에서 고쳤는지 비교해요. */
      baseSha: string;
    };

/**
 * 평점 고르기 칸의 값: 0.5, 1.0, ... 5.0 (0점은 없어요)
 *
 * Array.from({ length: 10 }, (_, index) => ...): 10칸짜리 배열을 만들며 칸마다 값을 계산해요.
 *   `_`는 "쓰지 않는 매개변수"라는 관례 이름이에요. index는 0~9라서 (index + 1) / 2는 0.5~5.0이에요.
 * toFixed(1): 소수점 한 자리 글자로 바꿔요(5 → "5.0"). <select>의 값은 글자라서 글자로 맞춰 둬요.
 */
const RATINGS = Array.from({ length: 10 }, (_, index) => ((index + 1) / 2).toFixed(1));

/** 평점 칸의 처음 값. "고르세요" 대신 가장 높은 점수를 골라 둬요. */
const DEFAULT_RATING = "5.0";

/** 분류 칸의 처음 값. 리뷰 추가 화면은 "영화"가 골라진 채로 시작해요. */
const DEFAULT_CATEGORY = "영화";

/** 글쓰기 화면의 빈 칸 값: 원고의 빈 값에 분류(영화)와 평점(5.0)만 처음 값을 넣어요. */
const WRITER_EMPTY_VALUES: ReviewFormValues = { ...EMPTY_VALUES, category: DEFAULT_CATEGORY, rating: DEFAULT_RATING };

/**
 * 평점 고르기 칸 오른쪽의 ▼ 그림(7×4칸, 한 칸 2px → 14×8px). 사이트의 픽셀 그림과 같은 모양이에요.
 * "#"은 칠한 칸, "."은 빈칸이에요(components/pixel-art.tsx).
 * `as const`: 배열을 읽기 전용으로 굳히고, 값도 넓은 string이 아닌 글자 그대로의 타입으로 기억하게 해요.
 */
const SELECT_ARROW_ROWS = ["#######", ".#####.", "..###..", "...#..."] as const;

/**
 * 칸 이름(화면에 보이는 이름). 칸의 <label>과, 칸이 없는 값(글 쓴 날)의 오류 안내에 써요.
 *
 * `Record<K, V>`: 열쇠 K마다 값 V가 있는 객체 타입이에요.
 * `keyof ReviewFormValues`: ReviewFormValues의 항목 이름들("image" | "slug" | ...)이에요.
 * 그래서 칸 하나라도 이름을 빠뜨리면 TypeScript가 오류로 알려 줘요.
 */
const FIELD_LABELS: Record<keyof ReviewFormValues, string> = {
  image: "이미지",
  slug: "파일 이름",
  title: "제목",
  year: "연도",
  creator: "감독 또는 작가",
  category: "분류",
  rating: "평점",
  oneLiner: "한 줄 평",
  publishedAt: "글 쓴 날",
};


/* ──────────────────────────────────────────────────────────────
 * 2. 글쓰기 폼
 * ────────────────────────────────────────────────────────────── */

/**
 * 리뷰 추가·수정 폼
 *
 * props를 구조 분해하지 않고 통째로 받아요. mode에 따라 slug·baseSha가 있기도 없기도 해서,
 * `props.mode === "edit"`로 확인한 뒤에 꺼내 써야 TypeScript가 안전하다고 알아요.
 *
 * @param props - {@link Props}
 * @returns 저장 전에는 글쓰기 폼, 저장한 뒤에는 "저장했습니다" 안내
 *
 * @example
 * <ReviewWriter mode="create" />
 * <ReviewWriter mode="edit" slug="winter-stop" parsed={parsed} baseSha={sha} />
 */
export function ReviewWriter(props: Props) {
  const { mode } = props;
  // 수정 화면이면 원고를 읽어 처음 칸 값을 만들어요(처음 한 번만 계산: useState(() => ...)).
  // `const [initial] = ...`: 배열의 첫 값만 꺼내요. 바꾸는 함수는 쓰지 않아요(처음 값은 그대로 기억만 해요).
  const [initial] = useState(() => initialState(props));
  // 지금 칸 값들. `useState<ReviewFormValues>`: 제네릭으로 상태의 타입을 알려 줘요.
  const [values, setValues] = useState<ReviewFormValues>(initial.values);
  // 칸별 오류 문구({ title: "제목을 입력하세요." } 같은 모양). 처음에는 빈 객체예요.
  const [errors, setErrors] = useState<FieldErrors>({});
  // 틀린 칸으로 옮겨 갈 차례 번호. 오류를 보일 때마다 1씩 올리고, 화면을 고친 뒤 그 칸으로 초점을 옮겨요(아래 showErrors).
  const [focusRequest, setFocusRequest] = useState(0);
  // 결과 안내(이미지 고름, 올리는 중) — role="status"
  const [notice, setNotice] = useState(initial.notice);
  // 칸과 상관없는 실패(연결 끊김, 그사이 바뀜 등) — role="alert"
  const [failure, setFailure] = useState(initial.failure);
  // 새로 고른 이미지: 파일, 미리보기 주소(브라우저 안에서만 쓰는 blob: 주소), 확장자. 고르지 않았으면 null
  // 확장자를 따로 기억하는 까닭: 이미지 파일 이름은 <파일 이름>.<확장자>인데, 파일 이름을 이미지보다 나중에 적어도 이름을 만들 수 있게요.
  const [picked, setPicked] = useState<{ file: File; url: string; extension: string } | null>(null);
  // 새로 고른 이미지 파일(없으면 null). `A?.b ?? C`: A가 있으면 A.b, 없으면 C예요.
  //   `?.`(옵셔널 체이닝): 앞이 null이면 멈추고 undefined, `??`: 왼쪽이 null·undefined면 오른쪽 값
  const pickedFile = picked?.file ?? null;
  // 지금 단계: 쓰는 중 / 저장 중 / 저장함. 세 글자 중 하나만 들어가도록 타입을 좁혀 뒀어요.
  const [phase, setPhase] = useState<"editing" | "saving" | "saved">("editing");
  // 두 번 누름 막기 잠금. useRef는 바꾼 즉시 읽혀서, 아주 빠른 두 번째 제출도 막을 수 있어요.
  const lockRef = useRef(false);
  // 단추 아래 로딩 UI의 글자(저장하는 동안만, 예: "리뷰를 저장하는 중"). 비어 있으면 로딩 UI를 보이지 않아요.
  const [busyLabel, setBusyLabel] = useState("");
  // 이미지를 줄이는 중인 작업 수. 그동안은 [리뷰 저장]을 막아요(줄인 이미지가 빠진 채 저장되지 않게).
  // 잠금은 useRef(바로 바뀜), 단추 막기는 useState(다시 그리기)로 함께 둬요.
  const photoJobsRef = useRef(0);
  const [photoBusy, setPhotoBusy] = useState(false);
  // 이미지 고르기 작업 번호. 줄이는 사이 다른 이미지를 고르거나 [이미지 빼기]를 누르면 번호가 바뀌어, 늦게 끝난 이전 결과를 버려요.
  const pickJobRef = useRef(0);

  // 초점을 옮길 곳들의 손잡이
  // formRef: 폼(<form>). 틀린 칸을 찾아 그리로 옮겨 갈 때 써요. savedRef: 저장 완료 안내의 제목(<h2>)
  const formRef = useRef<HTMLFormElement>(null);
  const savedRef = useRef<HTMLHeadingElement>(null);
  // 늘 최신 칸 값을 담아 두는 손잡이. 기다리는 사이(이미지 줄이기) 바뀐 값을 알아채려고 써요.
  // (async 함수 안의 values는 함수가 시작될 때의 값에 묶여 있어서, 기다린 뒤에는 낡은 값일 수 있어요.
  //  ref는 늘 같은 상자라 .current로 지금 값을 읽을 수 있어요.)
  const latestRef = useRef({ values });
  // 의존성 배열 없이 쓰면 그릴 때마다 실행돼요. 화면에 칠하기 직전에 최신 값으로 바꿔 둬요.
  useLayoutEffect(() => {
    latestRef.current = { values };
  });

  /**
   * 이미지를 줄이는 일을 하는 동안 "이미지 처리 중"으로 표시해요(저장 단추를 막아요). 끝나면(실패해도) 풀어요.
   *
   * `<T>`(제네릭): work가 돌려주는 값의 타입을 그대로 이어받아 돌려준다는 뜻이에요.
   * 예: shrinkImage가 ShrinkResult를 돌려주면 processPhotos도 ShrinkResult를 돌려줘요.
   * try { ... } finally { ... }: try 안에서 성공하든 오류가 나든, 끝나면 finally를 꼭 실행해요.
   *
   * @param work 이미지를 줄이는 일(Promise를 돌려주는 함수)
   * @returns work가 돌려준 값
   */
  async function processPhotos<T>(work: () => Promise<T>): Promise<T> {
    photoJobsRef.current += 1;
    setPhotoBusy(true);
    setNotice("이미지를 준비하는 중입니다.");
    try {
      return await work();
    } finally {
      photoJobsRef.current -= 1;
      if (photoJobsRef.current === 0) setPhotoBusy(false);
    }
  }

  // 칸 id들의 앞부분. useId로 겹치지 않게 만들어요.
  const baseId = useId();
  // 칸 이름으로 id를 만들어요. 예: fieldId("title") → "(자동으로 만든 id)-title". label·오류 문구가 이 id로 칸을 찾아요.
  const fieldId = (field: keyof ReviewFormValues) => `${baseId}-${field}`;

  /* ── 칸 값 바꾸기 ── */

  /**
   * 칸 하나의 값을 바꾸고, 그 칸의 오류 문구는 지워요(고치기 시작했으니까요).
   *
   * `<K extends keyof ReviewFormValues>`: K는 칸 이름 가운데 하나라는 제네릭이에요.
   * `ReviewFormValues[K]`: 그 칸의 값 타입. 그래서 칸 이름과 값의 타입이 어긋나면 TypeScript가 막아 줘요.
   *
   * @param field - 바꿀 칸 이름(예: "title")
   * @param value - 새 값
   */
  function setField<K extends keyof ReviewFormValues>(field: K, value: ReviewFormValues[K]) {
    // `{ ...current, [field]: value }`: 지금 값을 모두 복사(...)한 뒤 field 칸만 새 값으로 덮어써요.
    // [field]처럼 대괄호로 감싸면 변수에 든 글자를 항목 이름으로 써요(계산된 속성 이름).
    // 상태는 직접 고치지 않고 늘 새 객체를 만들어 넘겨야 React가 바뀐 것을 알아채요.
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }

  /**
   * 파일 이름을 바꿔요(리뷰 추가만).
   * 새로 고른 이미지는 <파일 이름>.jpg로 저장돼서, 파일 이름이 바뀌면 이미지 파일 이름도 따라 바뀌어야 해요.
   *
   * @param next - 새 파일 이름
   */
  function changeSlug(next: string) {
    setValues((current) => ({
      ...current,
      slug: next,
      // 새로 고른 이미지가 있으면 이미지 이름도 새 파일 이름으로. 아직 규칙에 맞지 않으면 비워 두고, 맞춰지면 채워요.
      // SLUG.test(next): 정규 표현식 규칙에 맞으면 true. 새로 고른 이미지가 없으면 원래 이미지 이름을 그대로 둬요.
      image: picked ? (SLUG.test(next) ? `${next}.${picked.extension}` : "") : current.image,
    }));
    setErrors((current) => ({ ...current, slug: undefined }));
  }

  /* ── 이미지 ── */

  /**
   * [이미지 고르기]로 그림을 고르면 큰 사진은 줄이고(lib/shrink-image.ts) 미리보기를 보여 주고, 저장할 때 올려요.
   * 파일 이름보다 먼저 골라도 돼요. 이미지 이름(<파일 이름>.jpg 등)은 파일 이름을 적는 대로 맞춰져요(changeSlug).
   *
   * @param event - 파일 칸의 바뀜 이벤트. event.target이 <input type="file">이에요.
   */
  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    // files?.[0]: 고른 파일 목록의 첫 파일(고르지 않고 창을 닫았으면 undefined)
    const chosen = event.target.files?.[0];
    // 같은 파일을 다시 골라도 onChange가 다시 불리도록 칸을 비워 둬요.
    event.target.value = "";
    if (!chosen) return;
    // 형식(확장자)은 줄이기 전에 먼저 봐요. 크기(4MB)는 줄인 뒤에 봐요(큰 휴대폰 사진도 줄이면 들어가요).
    // size: 0을 넘겨 크기 검사는 건너뛰고 형식만 봐요. 문제가 없으면 빈 값이 돌아와요.
    const typeProblem = uploadProblem({ name: chosen.name, size: 0 });
    if (typeProblem) {
      setErrors((current) => ({ ...current, image: typeProblem }));
      return;
    }
    // 이번 고르기의 작업 번호. `++A`: A를 1 늘린 뒤 그 값을 써요.
    const job = ++pickJobRef.current;
    // 줄인 파일(file)을 받아요. 그동안 [리뷰 저장]은 막혀 있어요.
    const { file } = await processPhotos(() => shrinkImage(chosen));
    // 줄이는 사이 다른 이미지를 골랐거나 [이미지 빼기]를 했으면, 이 결과는 버려요(나중 선택이 이겨요).
    if (job !== pickJobRef.current) return;
    const problem = uploadProblem(file);
    if (problem) {
      setErrors((current) => ({ ...current, image: problem }));
      setNotice("");
      return;
    }
    // 확장자는 jpeg도 jpg로 맞춰 이미지 이름을 <파일 이름>.jpg처럼 정해요.
    const extension = extensionOf(file.name).replace("jpeg", "jpg");
    // URL.createObjectURL: 고른 파일을 서버에 올리지 않고도 화면에 보여 줄 수 있는 임시 주소(blob:)를 만들어요.
    setPicked({ file, url: URL.createObjectURL(file), extension });
    // 파일 이름이 이미 있으면 이미지 이름을 바로 정하고, 아직이면 비워 둬요(파일 이름을 적으면 채워져요). 줄이는 사이 바뀐 파일 이름도 반영해요.
    const slug = latestRef.current.values.slug;
    setField("image", SLUG.test(slug) ? `${slug}.${extension}` : "");
    // 고른 이미지는 미리보기 자리에 바로 보여서, 위쪽 안내("이미지를 준비하는 중입니다.")는 지워요.
    setNotice("");
  }

  // 미리보기 임시 주소는 이미지를 바꾸거나 화면을 떠날 때 지워요(브라우저 메모리를 돌려줘요).
  // 정리 함수(return 뒤 함수)는 picked가 바뀌기 직전과 화면이 사라질 때 불려요.
  useEffect(() => {
    if (!picked) return;
    const { url } = picked;
    return () => URL.revokeObjectURL(url);
  }, [picked]);

  /** [이미지 빼기]: 이미지 없이 저장해요(화면에는 기본 이미지가 보여요). 줄이던 이미지가 있으면 그 결과도 버려요. */
  function handleImageRemove() {
    // 작업 번호를 올려, 아직 줄이는 중인 이미지 결과가 나중에 도착해도 버려지게 해요.
    pickJobRef.current += 1;
    setPicked(null);
    setField("image", "");
    setNotice("이미지를 뺐습니다. 저장하면 기본 이미지가 보입니다.");
  }

  /* ── 저장 ── */

  /**
   * 틀린 칸마다 오류 문구를 달고, 화면에서 가장 위에 있는 틀린 칸으로 스크롤해 초점을 옮겨요.
   * (따로 "고칠 곳" 목록을 두지 않아요. 칸 바로 아래의 오류 문구가 무엇을 고칠지 알려 줘요.)
   *
   * 화면에 칸이 없는 글 쓴 날(publishedAt)의 오류는 칸에 달 수 없어서, 위쪽 알림(role="alert")으로 보여 줘요.
   *
   * @param next - 칸별 오류 문구
   */
  function showErrors(next: FieldErrors) {
    setErrors(next);
    if (next.publishedAt) setFailure(`${FIELD_LABELS.publishedAt}: ${next.publishedAt}`);
    // 오류 문구와 aria-invalid가 그려진 다음에 칸을 찾아야 해서, 여기서는 "옮겨 갈 차례"만 하나 올려 두고
    // 실제로 옮기는 일은 React가 화면을 고친 직후에 도는 아래 useLayoutEffect가 해요.
    // (count) => count + 1: 지금 값에 1을 더해요. 같은 오류가 다시 나도 번호가 바뀌어 다시 옮겨 가요.
    setFocusRequest((count) => count + 1);
  }

  // 틀린 칸으로 옮겨 가기: 오류를 화면에 그린 직후(칠하기 전)에 가장 위의 틀린 칸으로 스크롤하고 초점을 옮겨요.
  // [focusRequest]: showErrors가 번호를 올릴 때마다 다시 돌아요. 처음(0)에는 아무것도 하지 않아요.
  // useLayoutEffect는 React가 화면(DOM)을 고친 "뒤"에 늘 돌아서, 방금 그린 aria-invalid를 반드시 찾을 수 있어요.
  //   브라우저의 다음 그림 차례(requestAnimationFrame)는 React가 화면을 고치는 때와 순서가 정해져 있지 않아,
  //   서버 답을 기다린 뒤처럼 그림 차례가 먼저 오면 틀린 칸을 찾지 못해서 쓰지 않아요.
  useLayoutEffect(() => {
    if (focusRequest === 0) return;
    const form = formRef.current;
    if (!form) return;
    // querySelector는 문서 순서로 첫 요소를 찾아요. 칸이 화면 위에서 아래(넓은 화면은 왼쪽에서 오른쪽)로 놓인 순서와 같아서,
    // 첫 번째로 찾은 틀린 칸(aria-invalid="true")이 가장 위에 있는 칸이에요.
    const field = form.querySelector<HTMLElement>('[aria-invalid="true"]');
    // 칸이 없는 오류(이미지 등)만 있으면, 내용이 있는 첫 오류 문구로 옮겨 가요.
    const target = field ?? form.querySelector<HTMLElement>(".field-error:not(:empty)");
    if (!target) return;
    // scrollIntoView({ block: "center" }): 그 요소가 화면 가운데쯤 오게 스크롤해요(칸 이름까지 함께 보여요).
    target.scrollIntoView({ block: "center" });
    // 초점도 그 칸으로 옮겨 바로 고쳐 적을 수 있게 해요. preventScroll: 위에서 스크롤했으니 한 번 더 움직이지 않게 해요.
    field?.focus({ preventScroll: true });
  }, [focusRequest]);

  /**
   * 저장에 실패했을 때: 칸 오류면 칸에, 아니면 알림으로 보여 주고 잠금을 풀어요.
   *
   * `Extract<ApiResult<unknown>, { ok: false }>`: ApiResult의 두 갈래 가운데 ok가 false인 실패 모양만 골라낸 타입이에요.
   *
   * @param result - 서버가 돌려준 실패 결과({ ok: false, status, message, errors? })
   */
  function fail(result: Extract<ApiResult<unknown>, { ok: false }>) {
    lockRef.current = false;
    setPhase("editing");
    setNotice("");
    setBusyLabel("");
    // 서버가 칸별 오류(errors)를 보냈으면 칸마다 보여 주고, 아니면 한 줄 알림(failure)으로 보여 줘요.
    if (result.errors && Object.keys(result.errors).length > 0) {
      showErrors(result.errors);
    } else {
      setFailure(result.message);
    }
  }

  /**
   * [저장]을 누르면 실행돼요(폼 제출).
   *
   * @param event - 폼 제출 이벤트
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // 폼의 기본 동작(페이지를 새로 받으며 제출)을 막고, 우리가 직접 API로 보내요.
    event.preventDefault();
    // 저장 중이거나, 이미지를 줄이는 중이면 누르지 못해요(단추도 막혀 있어요).
    if (lockRef.current || photoJobsRef.current > 0) return;

    // 1) 칸 검사(화면에서 먼저)
    // checkSlug: 리뷰 추가일 때만 파일 이름을 검사해요(수정할 때는 파일 이름을 바꿀 수 없어서요).
    const check = validateReviewForm(values, { checkSlug: mode === "create" });
    if (!check.ok) {
      showErrors(check.errors);
      return;
    }

    // 여기서부터 저장 시작: 잠그고, 단계를 "저장 중"으로 바꾸고, 지난 실패·오류는 지워요.
    lockRef.current = true;
    setPhase("saving");
    setFailure("");
    setErrors({});
    setBusyLabel("리뷰를 저장하는 중");

    // 2) 새로 고른 이미지 올리기. 올린 결과({ path, sha })는 리뷰 저장 요청에 함께 보내요.
    // let: 나중에 값을 다시 넣을 변수. 이미지를 고르지 않았으면 undefined로 남아요.
    let upload: { path: string; sha: string } | undefined;
    if (pickedFile && values.image) {
      setBusyLabel("이미지를 올리는 중");
      const result = await uploadImage(pickedFile, `public/images/${values.image}`);
      // 실패하면 fail()이 안내를 보여 주고 잠금을 풀어요. `return fail(...)`: 안내한 뒤 여기서 멈춰요.
      if (!result.ok) return fail(result);
      upload = result.data;
    }

    // 3) 리뷰 저장. 보낼 값(values, upload)을 요청에 바로 담아 넘겨요(상태가 아직 바뀌기 전이라도 지금 값이 가요).
    setBusyLabel("리뷰를 저장하는 중");
    // `{ values, upload }`는 `{ values: values, upload: upload }`의 줄임 문법이에요.
    // baseSha: 수정일 때만 원고의 내용 번호를 함께 보내, 그사이 다른 곳에서 고쳤는지 서버가 비교해요.
    const request = { values, upload, baseSha: props.mode === "edit" ? props.baseSha : undefined };
    const result = props.mode === "edit" ? await updateReview(props.slug, request) : await createReview(request);
    if (!result.ok) return fail(result);

    // 4) 성공: 저장 완료 안내로 바꿔요. 폼을 떠나니 잠금은 풀지 않아요.
    setNotice("");
    setBusyLabel("");
    setPhase("saved");
  }

  // 저장 완료 안내가 나오면 그 제목으로 초점을 옮겨요(누른 [저장] 단추가 사라지니까요).
  // [phase]: phase가 바뀔 때마다, 화면을 그린 뒤 실행해요.
  useEffect(() => {
    if (phase === "saved") savedRef.current?.focus();
  }, [phase]);

  /* ── 저장하지 않고 떠나려 할 때 묻기 ── */

  // 처음 값과 칸 값이나 고른 이미지가 다르면 "저장하지 않은 내용이 있음"으로 봐요.
  // JSON.stringify: 객체를 글자로 바꿔요. 객체끼리는 ===로 내용을 비교할 수 없어서, 글자로 바꿔 견줘요.
  // (칸이 몇 개 안 되어서 그릴 때마다 견줘도 가벼워요.)
  const dirty = JSON.stringify(values) !== JSON.stringify(initial.values) || pickedFile !== null;
  useEffect(() => {
    if (!dirty || phase === "saved") return;
    // beforeunload: 탭을 닫거나 새로 고칠 때 브라우저가 "떠날까요?"라고 물어 줘요.
    // preventDefault()를 부르면 브라우저가 떠나기 전에 확인 창을 띄워요(문구는 브라우저가 정해요).
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    // 정리 함수: 저장했거나 바뀐 내용이 없어지면 묻기를 그만둬요.
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, phase]);

  /* ── 화면 ── */

  // 저장 완료 안내. 저장했으면 폼 대신 이 안내만 그리고 함수를 끝내요(아래 return까지 가지 않아요).
  // 제목(h2)은 tabIndex -1이라 Tab 순서에는 없고, 위의 useEffect가 코드로 초점을 옮겨요.
  if (phase === "saved") {
    return (
      <section aria-labelledby={`${baseId}-saved`} className="grid gap-4">
        <h2 id={`${baseId}-saved`} ref={savedRef} tabIndex={-1} className="glow text-mid outline-none">
          저장했습니다
        </h2>
        <p>저장소에 올렸습니다. 블로그를 다시 배포하는 동안(몇 분) 기다린 뒤 새로 고치면 보입니다.</p>
        {/* 다음에 할 일 링크 두 개. 여러 링크를 묶는 목록이라 <ul> + <li>예요. */}
        <ul className="flex flex-wrap gap-2">
          <li>
            <Link href="/" className="btn-line">
              목록으로
            </Link>
          </li>
          <li>
            {/* 리뷰 추가 화면을 처음 상태로 다시 열어요(같은 화면이라 페이지를 새로 받아요). */}
            <a href="/write" className="btn-line">
              리뷰 추가
            </a>
          </li>
        </ul>
      </section>
    );
  }

  const saving = phase === "saving";
  // 이미지 미리보기: 새로 고른 그림 > 저장소에 있던 이미지 > 없음(기본 이미지)
  // (저장소에 있던 이미지는 public/images 폴더에 있어서 /images/<이미지 이름> 주소로 보여요.)
  const previewSrc = picked?.url ?? (values.image ? `/images/${values.image}` : null);

  return (
    // 폼과 저장 진행 안내를 한 묶음으로 둬요. 진행 안내는 폼 밖에 있어야 해요:
    // 저장하는 동안 폼은 aria-busy라서, 화면 낭독기가 그 안의 바뀜을 끝날 때까지 미뤄 읽을 수 있거든요(WAI-ARIA 1.2).
    // gap-3: 진행 안내가 맨 아래 단추 줄 바로 밑(12px)에 붙어 보여요.
    <div className="grid gap-3">
    {/* noValidate: 브라우저 기본 오류 말풍선 대신 우리 문구를 보여 줘요. aria-busy: 저장하는 동안 폼이 바뀌는 중이라고 알려요. */}
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="grid gap-10" aria-busy={saving}>
      {/* 결과 안내(이미지 고름·올리는 중). role="status": 끼어들지 않고 차례대로 읽어 줘요.
          영역은 처음부터 두고 글자만 바꿔야 읽어 줘요. 비어 있을 때는 empty:sr-only로 화면에서만 숨겨 빈 간격이 생기지 않게 해요. */}
      <p role="status" className="empty:sr-only">
        {notice}
      </p>
      {/* 칸과 상관없는 실패. role="alert": 바로 읽어 줘요. */}
      <p role="alert" className="alert-text empty:sr-only">
        {failure}
      </p>

      {/* 이미지와 콘텐츠 정보. 넓은 화면(lg, 1024px~)에서는 3칸으로 나눠 [이미지 | 콘텐츠 정보(2칸)]로 놓아요. */}
      <div className="grid gap-10 lg:grid-cols-3 lg:gap-8">
        {/* 이미지: 넓은 화면에서는 왼쪽 한 칸. 파일 이름보다 먼저 골라도 돼요.
            disabled={saving}: 저장하는 동안에는 이 묶음 안의 단추·칸을 모두 잠가요. */}
        <fieldset className="grid content-start gap-4" disabled={saving}>
          <legend className="glow mb-4 text-mid">이미지</legend>
          {/* 미리보기와 단추를 같은 너비의 칸에 넣어, 단추가 이미지 너비만큼 넓어요.
              w-40: 좁은 화면 10rem, lg:w-full: 넓은 화면에서는 왼쪽 칸 너비를 채워요(최대 18rem). */}
          <div className="grid w-40 gap-4 lg:w-full lg:max-w-[18rem]">
            {/* 미리보기: 화면에서처럼 형광 초록으로 보여요(올라가는 파일은 색을 바꾸지 않은 사진이에요). 꾸밈이라 alt를 비워요.
                aspect-[2/3]: 가로:세로 = 2:3 비율의 액자. relative: 안의 그림(fill)이 이 액자를 꽉 채우는 기준이에요. */}
            <span className="image-frame relative block aspect-[2/3] w-full">
              {previewSrc ? (
                // unoptimized: 브라우저 안의 blob: 주소는 이미지 최적화를 거칠 수 없어서 원본 그대로 보여 줘요.
                // fill: 부모 액자를 가득 채워요. sizes: 화면 너비별로 그림이 차지할 너비(넓은 화면 288px, 그 밖 160px).
                // image-tint: 형광 초록으로 바꾸는 필터(globals.css), object-cover: 비율을 지키며 액자를 채우고 넘치는 곳은 잘라요.
                <Image src={previewSrc} alt="" fill unoptimized sizes="(min-width: 1024px) 288px, 160px" className="image-tint object-cover" />
              ) : (
                // 이미지를 아직 고르지 않았으면 목록과 같은 기본 이미지(그림 액자 아이콘 + NO IMAGE)를 보여 줘요.
                // 그림은 꾸밈이라 읽지 않고, 화면 낭독기에는 "고른 이미지 없음"이라고 알려 줘요.
                <>
                  <DefaultImage size="large" />
                  <span className="sr-only">고른 이미지 없음</span>
                </>
              )}
            </span>
            {/* 단추는 이미지와 같은 너비(w-full)로 위아래로 놓아요. 글자는 가운데(justify-center). */}
            <div className="grid gap-2">
              <FileButton
                id={fieldId("image")}
                label="이미지 고르기"
                accept={IMAGE_ACCEPT}
                onChange={handleImageChange}
                disabled={saving}
                describedBy={errors.image ? `${fieldId("image")}-error` : undefined}
                className="w-full justify-center"
              />
              {/* 이미지가 있을 때만(저장소에 있던 것이든 새로 고른 것이든) [이미지 빼기]를 보여요. */}
              {(values.image || pickedFile) && (
                <button type="button" onClick={handleImageRemove} className="btn-line w-full justify-center">
                  이미지 빼기
                </button>
              )}
            </div>
          </div>
          {/* 이미지 오류 문구 자리. 비어 있어도 요소는 둬요(FileButton의 aria-describedby가 가리켜요). */}
          <p id={`${fieldId("image")}-error`} className="field-error">
            {errors.image}
          </p>
        </fieldset>

        {/* 콘텐츠 정보: 넓은 화면에서는 오른쪽 두 칸(lg:col-span-2)을 쓰고, 칸들을 2열로 놓아요(6칸 = 2열 × 3행, 분류·평점은 한 칸을 나눠 써요).
            차례: [분류 | 평점] → 제목 → 파일 이름 → 연도 → 감독 또는 작가 → 한 줄 평
            content-start: 칸들이 위에서부터 놓이게 해요.
            items-start: 같은 행의 옆 칸에 도움말이 길어도 이 칸(입력 상자)이 따라 늘어나지 않고 제 높이를 지켜요. */}
        <fieldset className="grid content-start items-start gap-6 lg:col-span-2 lg:grid-cols-2 lg:gap-x-6" disabled={saving}>
          <legend className="glow mb-4 text-mid">콘텐츠 정보</legend>

          {/* 분류와 평점은 한 줄에 나란히(grid-cols-2) 놓아요. 휴대폰에서도 같은 줄이에요.
              gap-x-4: 둘 사이 16px. items-start: 오류 문구가 한쪽에만 생겨도 다른 쪽 높이는 그대로예요. */}
          <div className="grid grid-cols-2 items-start gap-x-4">
            {/* 분류: 영화·도서 가운데 하나를 고르는 라디오 칩. 오류 문구는 묶음 설명(aria-describedby)으로 이어요. */}
            <div className="grid gap-2">
              <ChoiceGroup
                layout="stack"
                // 분류는 처음부터 영화가 골라져 있어 비워 둘 수 없어요(라디오 단추는 하나를 고르면 고르지 않은 상태로 되돌릴 수 없어요).
                legend={FIELD_LABELS.category}
                describedBy={errors.category ? `${fieldId("category")}-error` : undefined}
              >
                {/* 분류마다 칩 하나. id 끝의 번호(-0, -1)로 칩마다 겹치지 않는 id를 만들어요. */}
                {CATEGORIES.map((category, index) => (
                  <Choice
                    key={category}
                    id={`${fieldId("category")}-${index}`}
                    type="radio"
                    name="category"
                    checked={values.category === category}
                    onChange={() => setField("category", category)}
                  >
                    {category}
                  </Choice>
                ))}
              </ChoiceGroup>
              <p id={`${fieldId("category")}-error`} className="field-error">
                {errors.category}
              </p>
            </div>

            {/* 평점: 0.5 ~ 5.0 중에서 고르기(0점은 없어요). 처음에는 5.0이 골라져 있어요.
                네이티브 <select>라 키보드·화면 낭독기가 그대로 써요. */}
            {/* Field의 children 자리에 "함수"를 넘겨요(render prop). Field가 도움말·오류 문구 id를 계산해 이 함수에 넘겨주면,
                함수가 그 id를 단 입력 요소를 돌려줘요. */}
            <Field id={fieldId("rating")} label={FIELD_LABELS.rating} required error={errors.rating}>
              {(describedBy) => (
                // relative: ▼ 그림을 칸 오른쪽에 겹쳐 놓는 기준이에요. w-full max-w-40: 반 칸을 채우되 160px까지만 넓어져요(좁은 휴대폰에서 넘치지 않게).
                <span className="relative block w-full max-w-40">
                  {/* appearance-none: 브라우저 기본 ▼를 지우고 아래 픽셀 ▼를 그려요.
                      pr-9: 오른쪽에 ▼ 자리(여백 12px + 그림 14px + 사이 10px)를 비워 글자가 겹치지 않게 해요.
                      peer: 칸이 잠기면(disabled) 옆의 ▼도 같이 흐려지게 해요(peer-disabled). */}
                  {/* aria-invalid: 오류가 있을 때만 true(없으면 속성을 달지 않아요).
                      aria-errormessage와 aria-describedby 둘 다 오류 문구를 가리켜요(화면 낭독기마다 지원이 달라서 함께 써요). */}
                  <select
                    id={fieldId("rating")}
                    required
                    value={values.rating}
                    onChange={(event) => setField("rating", event.target.value)}
                    aria-invalid={errors.rating ? true : undefined}
                    aria-describedby={describedBy}
                    aria-errormessage={errors.rating ? `${fieldId("rating")}-error` : undefined}
                    className="peer field w-full cursor-pointer appearance-none pr-9"
                  >
                    {/* 목록에 없는 값(저장소 원고를 손으로 고친 4.3 같은 값)이면 그 값을 그대로 보여 주고, 저장할 때 오류로 알려요. */}
                    {/* includes: 배열에 그 값이 들어 있는지(true/false). 없을 때만 그 값을 담은 고를 수 없는(disabled) 칸을 하나 더 둬요. */}
                    {!RATINGS.includes(values.rating) && (
                      <option value={values.rating} disabled>
                        {values.rating || "고르세요"}
                      </option>
                    )}
                    {RATINGS.map((rating) => (
                      <option key={rating} value={rating}>
                        {rating}
                      </option>
                    ))}
                  </select>
                  {/* ▼: 오른쪽 끝에서 12px(right-3) 안쪽에 놓아요. 왼쪽 글자도 칸 끝에서 12px(테두리 2px + 여백 10px)
                      안쪽에서 시작해서, 좌우 간격이 같아요. 꾸밈 그림이라 읽지 않고, 누르면 아래 칸이 눌려요(pointer-events-none). */}
                  {/* absolute top-1/2 -translate-y-1/2: 칸 높이의 가운데에 세로로 맞춰요. peer-disabled:opacity-60: 칸이 잠기면 흐리게 */}
                  <PixelArt
                    rows={SELECT_ARROW_ROWS}
                    cell={2}
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 peer-disabled:opacity-60"
                  />
                </span>
              )}
            </Field>
          </div>

          {/* 각 TextField: id(라벨·오류 문구 연결), label(칸 이름), required(꼭 적어야 함), error(오류 문구), value·onChange(칸 값) */}
          <TextField id={fieldId("title")} label={FIELD_LABELS.title} required error={errors.title} value={values.title} onChange={(value) => setField("title", value)} />
          {/* 리뷰 추가면 파일 이름 칸을, 수정이면 바꿀 수 없는 파일 이름 글자를 보여요. */}
          {mode === "create" ? (
            <TextField
              id={fieldId("slug")}
              label={FIELD_LABELS.slug}
              required
              error={errors.slug}
              value={values.slug}
              onChange={changeSlug}
              // 파일 이름은 영어 소문자라서, 맞춤법 빨간 줄과 휴대폰의 첫 글자 대문자 바꾸기를 꺼요.
              spellCheck={false}
              autoCapitalize="none"
            />
          ) : (
            // 파일 이름은 수정할 때 바꿀 수 없어요. 괄호 안내는 다음 줄에 보여요(<br>, 화면 낭독기는 이어서 읽어요).
            <p>
              <span className="text-crt-dim">파일 이름: </span>{values.slug}.json
              <br />
              <span className="text-crt-dim">(수정할 때는 바꿀 수 없습니다.)</span>
            </p>
          )}

          {/* 숫자 칸: inputMode="numeric"이면 휴대폰에서 숫자 자판이 떠요(type="number"의 화살표·스크롤 문제는 피해요).
              연도: 영화는 개봉한 해, 도서는 펴낸 해예요. */}
          <TextField
            id={fieldId("year")}
            label={FIELD_LABELS.year}
            required
            error={errors.year}
            value={values.year}
            onChange={(value) => setField("year", value)}
            inputMode="numeric"
          />
          <TextField
            id={fieldId("creator")}
            label={FIELD_LABELS.creator}
            required
            error={errors.creator}
            value={values.creator}
            onChange={(value) => setField("creator", value)}
          />

          <TextField
            id={fieldId("oneLiner")}
            label={FIELD_LABELS.oneLiner}
            required
            error={errors.oneLiner}
            value={values.oneLiner}
            onChange={(value) => setField("oneLiner", value)}
          />
        </fieldset>
      </div>

      {/* 저장·취소. 오른쪽에 붙여 놓아요(justify-end). 저장이 앞(왼쪽), 취소가 뒤(오른쪽)예요.
          단추 글자는 상황에 따라 바뀌어요: 저장 중 → "저장하는 중…", 수정 화면 → "수정한 내용 저장", 추가 화면 → "리뷰 저장".
          [취소]는 다른 화면(처음 화면)으로 가는 일이라 단추가 아니라 링크예요. */}
      <div className="flex flex-wrap items-center justify-end gap-3">
          {/* 이미지를 줄이는 중이면 막아요(줄인 이미지가 빠진 채 저장되지 않게). */}
          <button type="submit" disabled={saving || photoBusy} className="btn-inverse">
            {saving ? "저장하는 중…" : mode === "edit" ? "수정한 내용 저장" : "리뷰 저장"}
          </button>
          <Link href="/" className="btn-line">
            취소
          </Link>
      </div>
    </form>
    {/* 저장 로딩(단추 줄 바로 아래, 폼 밖). 이 안내 영역은 늘 두고 안의 내용만 바꿔요(화면 낭독기가 바뀔 때마다 읽어 줘요).
        저장하는 동안은 로딩 UI(커서 + 막대, live={false}: 안내 영역은 바깥이 맡아요)예요. 단추 줄처럼 오른쪽에 붙여요. */}
    <div role="status" className="flex justify-end empty:sr-only">
      {busyLabel ? <LoadingStatus label={busyLabel} live={false} /> : null}
    </div>
    </div>
  );
}

/**
 * 처음 상태(칸 값과 안내)를 만들어요. 수정이면 서버가 읽어 둔 원고로 채워요.
 * 컴포넌트 밖에 둔 보통 함수라, ReviewWriter가 useState(() => initialState(props))로 처음 한 번만 불러요.
 *
 * @param props - ReviewWriter가 받은 값
 * @returns 처음 칸 값(values), 처음 안내(notice), 처음 실패 알림(failure)
 */
function initialState(props: Props): { values: ReviewFormValues; notice: string; failure: string } {
  if (props.mode === "create") return { values: WRITER_EMPTY_VALUES, notice: "", failure: "" };
  // 여기부터는 mode가 "edit"인 갈래라서 parsed·slug를 꺼낼 수 있어요(TypeScript가 타입을 좁혀 줘요).
  const { parsed } = props;
  if (!parsed.ok) {
    // 저장소의 원고를 읽지 못했어요(손으로 고친 원고의 JSON 모양이 망가진 경우). 저장소에서 직접 고치도록 알려요.
    // 칸은 비워 두고 파일 이름만 채워요(이대로 저장하면 칸 검사가 먼저 막아요).
    return {
      values: { ...WRITER_EMPTY_VALUES, slug: props.slug },
      notice: "",
      failure: `원고를 읽지 못했습니다: ${parsed.message} 저장소의 원고 파일(content/reviews/${props.slug}.json)을 고친 뒤 다시 열어 주세요.`,
    };
  }
  // 원고에서 읽은 칸 값에 파일 이름(slug)을 더해 처음 값으로 써요.
  return { values: { ...parsed.values, slug: props.slug }, notice: "", failure: "" };
}

/* ──────────────────────────────────────────────────────────────
 * 3. 칸 조각들
 * ────────────────────────────────────────────────────────────── */

/** Field가 받는 값(props) */
type FieldProps = {
  /** 입력 요소의 id(label이 가리켜요) */
  id: string;
  /** 칸 이름 */
  label: string;
  /** 꼭 채워야 하는 칸이면 true. 입력 요소에 required를 달아 화면 낭독기가 "필수"라고 알려요(TextField가 써요). */
  required?: boolean;
  /** 오류 문구(있을 때만 보여요) */
  error?: string;
  /**
   * 입력 요소를 그리는 함수. 오류 문구의 id(aria-describedby에 넣을 값)를 넘겨줘요.
   * `(describedBy: string | undefined) => ReactNode`: 글자(또는 undefined)를 받아 그릴 것을 돌려주는 함수 타입이에요.
   */
  children: (describedBy: string | undefined) => ReactNode;
};

/**
 * 칸 하나의 틀: 이름(label) + 입력 요소 + 오류 문구
 * 오류 문구는 aria-describedby로 입력 요소에 이어져, 화면 낭독기가 칸 이름 다음에 읽어 줘요.
 *
 * @param props - {@link FieldProps}
 * @returns 이름·입력 요소·오류 문구를 세로로 쌓은 <div>
 *
 * @example
 * <Field id="year" label="연도" required error={errors.year}>
 *   {(describedBy) => <input id="year" aria-describedby={describedBy} />}
 * </Field>
 */
function Field({ id, label, error, children }: FieldProps) {
  const errorId = `${id}-error`;
  // 오류가 있을 때만 오류 문구 id를 이어요. 없는 오류를 읽지 않게요(없으면 undefined라 속성을 아예 달지 않아요).
  const describedBy = error ? errorId : undefined;

  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="glow">
        {label}
      </label>
      {/* 넘겨받은 함수를 불러 입력 요소를 그려요. */}
      {children(describedBy)}
      {/* 오류 문구 자리. 비어 있어도 요소는 둬서 aria-errormessage가 늘 가리킬 수 있어요. */}
      <p id={errorId} className="field-error">
        {error}
      </p>
    </div>
  );
}

/**
 * TextField가 받는 값: Field의 값 + 글자 칸에 필요한 값
 * `Omit<FieldProps, "children"> & { ... }`: FieldProps에서 children만 빼고, 뒤의 항목을 더한(&) 타입이에요.
 */
type TextFieldProps = Omit<FieldProps, "children"> & {
  /** 칸에 든 글자 */
  value: string;
  /** 글자가 바뀌면 새 글자를 넘겨 불러요 */
  onChange: (value: string) => void;
  /** 휴대폰 자판 종류. "numeric"이면 숫자 자판 */
  inputMode?: "numeric" | "text";
  /** 맞춤법 검사 빨간 줄을 보일지 */
  spellCheck?: boolean;
  /** 휴대폰에서 첫 글자를 저절로 대문자로 바꿀지. "none"이면 바꾸지 않아요 */
  autoCapitalize?: "none" | "sentences";
};

/**
 * 한 줄 글자 칸
 *
 * `...field`(나머지 매개변수): 앞에서 꺼낸 값을 뺀 나머지(id, label, required, error)를 field 객체에 모아요.
 * `<Field {...field}>`(펼침): 그 객체의 항목을 Field의 속성으로 한꺼번에 넘겨요.
 *
 * @param props - {@link TextFieldProps}
 * @returns 이름과 오류 문구가 이어진 <input type="text">
 */
function TextField({ value, onChange, inputMode, spellCheck, autoCapitalize, ...field }: TextFieldProps) {
  return (
    <Field {...field}>
      {(describedBy) => (
        <input
          id={field.id}
          type="text"
          required={field.required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          spellCheck={spellCheck}
          autoCapitalize={autoCapitalize}
          aria-invalid={field.error ? true : undefined}
          aria-describedby={describedBy}
          aria-errormessage={field.error ? `${field.id}-error` : undefined}
          className="field w-full"
        />
      )}
    </Field>
  );
}

/** FileButton이 받는 값(props) */
type FileButtonProps = {
  /** 단추 글자(= 파일 고르기 칸의 이름) */
  label: string;
  /** 고를 수 있는 파일 종류 */
  accept: string;
  /** 여러 개를 한 번에 고를 수 있는지 */
  multiple?: boolean;
  /** 파일을 고르면 불러요 */
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** true면 고를 수 없어요 */
  disabled?: boolean;
  /** 파일 고르기 칸의 id(오류가 나면 이리로 초점을 옮겨요) */
  id?: string;
  /** 오류 문구 id */
  describedBy?: string;
  /** 단추 너비 등 모양(기본: 글자만큼 w-fit). 예: 이미지와 같은 너비로 "w-full justify-center" */
  className?: string;
};

/**
 * 단추 모양의 파일 고르기 칸
 *
 * 진짜 <input type="file">을 화면에서만 숨기고(sr-only, 키보드·화면 낭독기는 그대로 써요) <label>을 단추처럼 꾸며요.
 * 단추 글자가 곧 파일 칸의 이름이라, 화면 낭독기는 "이미지 고르기, 파일 선택"처럼 읽어요.
 * 초점이 오면 단추 둘레에 점선 테두리가 그려져요(globals.css의 .file-button).
 * <label> 안에 <input>을 넣으면 label 어디를 눌러도 파일 고르기 창이 열려요.
 *
 * @param props - {@link FileButtonProps}
 * @returns 단추 모양 <label> 안에 숨긴 <input type="file">을 담은 요소
 */
function FileButton({ label, accept, multiple = false, onChange, disabled = false, id, describedBy, className = "w-fit" }: FileButtonProps) {
  return (
    <label className={`btn-line file-button ${className}`}>
      {label}
      <input id={id} type="file" accept={accept} multiple={multiple} onChange={onChange} disabled={disabled} aria-describedby={describedBy} className="sr-only" />
    </label>
  );
}
