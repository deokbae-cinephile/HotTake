/**
 * @file 칩 모양 고르기 단추 (choice-chips.tsx)
 * 읽는 순서: 20/84번째 · 4단계(처음 화면: 작품 목록)
 *   앞: src/components/review-browser.tsx → 다음: src/components/review-list-item.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   여러 개 중에서 고르는 "단추 묶음"을 단말기 칩 모양으로 그려요.
 *   칩(chip)은 작고 둥근(여기서는 네모난) 이름표 모양 단추를 부르는 말이에요.
 *
 *     분류   [▶전체 15편] [영화 9편] [도서 6편]
 *     정렬   [▶최신순] [평점순]
 *
 * 맡은 기능
 *   - ChoiceGroup: 묶음 이름(legend)과 칩들을 놓아요(<fieldset>).
 *   - Choice: 칩 하나. 진짜 단추(라디오 또는 체크박스)를 투명하게 덮어 두어,
 *     키보드로 고르기·화면 낭독기 읽기를 브라우저가 그대로 해 줘요.
 *       radio   : 하나만 고르기(분류 필터, 정렬, 글쓰기 화면의 분류)
 *       checkbox: 여러 개 고르기(지금 쓰는 곳은 없지만, 필요할 때 바로 쓸 수 있게 열어 둬요)
 *
 * 누가 쓰나요?
 *   components/review-browser.tsx(분류·정렬), components/review-writer.tsx(리뷰 분류)
 *
 * 배경 지식
 *   - 이 파일에는 "use client"가 없어요. 상태(useState)나 브라우저 기능을 직접 쓰지 않아서,
 *     불러 쓰는 쪽(review-browser.tsx, review-writer.tsx는 클라이언트 컴포넌트)을 따라 브라우저에서 함께 돌아요.
 *   - 겉모습(칩 모양, 고른 칩 반전, 초점 테두리)은 src/app/globals.css의 .chip 규칙이 맡아요.
 *     이 파일은 HTML 뼈대만 만들어요.
 */

// `import type`: 타입만 가져오는 문법이에요. 빌드하면 이 줄은 통째로 사라져서 실제 코드 크기에 영향이 없어요.
// ReactNode: 화면에 그릴 수 있는 모든 것(글자, 숫자, JSX 요소, 배열, null 등)을 뜻하는 React 타입이에요.
import type { ReactNode } from "react";

/** ChoiceGroup이 받는 값(props) */
type GroupProps = {
  /** 묶음 이름. 화면 낭독기는 칩에 초점이 오면 "분류, 그룹"처럼 이 이름을 먼저 알려 줘요. */
  legend: ReactNode;
  /**
   * true면 묶음 안의 단추를 모두 사용할 수 없게 해요(미리 만든 HTML에서 써요). 기본 false
   * 이름 뒤의 `?`는 "넘기지 않아도 되는 값(선택 속성)"이라는 TypeScript 표시예요.
   */
  disabled?: boolean;
  /**
   * 이름과 칩의 놓는 방법
   *   - "side"(기본): 640px 이상 화면에서 왼쪽 칸(4rem)에 이름, 오른쪽에 칩
   *   - "aside": 위와 같지만, 1024px 이상에서는 목록 옆의 좁은 검색 칸에 놓이므로 이름을 칩 위로 올려요
   *   - "stack": 화면 너비와 상관없이 늘 이름 아래에 칩을 놓아요(글쓰기 화면의 다른 칸처럼 이름이 위에 있어요)
   * `"side" | "aside" | "stack"`처럼 글자를 `|`로 이은 타입은 "이 가운데 하나만 된다"는 뜻이에요(유니언 타입).
   */
  layout?: "side" | "aside" | "stack";
  /** 묶음 설명(오류 문구 등)의 id. 화면 낭독기가 묶음에 들어갈 때 함께 읽어 줘요. */
  describedBy?: string;
  /** 칩들(Choice). JSX에서 여는 태그와 닫는 태그 사이에 넣은 내용이 children으로 들어와요. */
  children: ReactNode;
};

/**
 * 고르기 단추 묶음
 *
 * <fieldset>은 관련된 입력들을 한 묶음으로, <legend>는 그 묶음의 이름이에요.
 * 화면 낭독기는 이 둘을 이름 있는 "그룹(group)"으로 읽어 줘요. ARIA 없이 HTML만으로 되는 방법이에요.
 *
 * 매개변수 자리의 `{ legend, disabled = false, ... }`는 구조 분해(destructuring)예요.
 * props 객체에서 필요한 값을 이름으로 바로 꺼내고, `= false`처럼 값이 없을 때 쓸 기본값도 정해요.
 *
 * @param props - {@link GroupProps}
 * @returns 이름(legend)과 칩 자리가 있는 <fieldset>
 *
 * @example
 * <ChoiceGroup legend="정렬">
 *   <Choice name="sort" checked={sort === "new"} onChange={() => setSort("new")}>최신순</Choice>
 *   <Choice name="sort" checked={sort === "rating"} onChange={() => setSort("rating")}>평점순</Choice>
 * </ChoiceGroup>
 */
export function ChoiceGroup({ legend, disabled = false, layout = "side", describedBy, children }: GroupProps) {
  // Tailwind는 클래스 이름을 코드에서 글자 그대로 찾아 만들기 때문에, 두 경우를 통째로 적어 둬요.
  // (`sm:grid-cols-${...}`처럼 글자를 이어 붙이면 Tailwind가 찾지 못해 스타일이 만들어지지 않아요.)
  //   sm:  → 화면 너비 640px 이상에서만 적용
  //   lg:  → 화면 너비 1024px 이상에서만 적용
  //   grid-cols-[4rem_minmax(0,1fr)] → 두 칸: 왼쪽 4rem 고정, 오른쪽은 남은 너비 전부
  //     ([ ] 안은 Tailwind의 "임의 값" 문법이고, 밑줄 _은 띄어쓰기를 뜻해요.)
  //   lg:grid-cols-1 → 한 칸(이름이 칩 위로 올라가요)
  // `조건 ? A : B`는 삼항 연산자예요. 조건이 참이면 A, 거짓이면 B를 돌려줘요.
  //   stack은 칸을 나누지 않아요(늘 한 칸이라 이름이 칩 위에 와요).
  const columns =
    layout === "stack" ? "" : layout === "aside" ? "sm:grid-cols-[4rem_minmax(0,1fr)] lg:grid-cols-1" : "sm:grid-cols-[4rem_minmax(0,1fr)]";

  return (
    // disabled를 <fieldset>에 주면 그 안의 단추가 모두 사용할 수 없게 돼요(HTML 기본 기능).
    // aria-describedby: 여기 적은 id의 글(오류 문구 등)을 이 묶음의 "설명"으로 이어 줘요. undefined면 속성이 붙지 않아요.
    // 클래스: grid(격자 배치), gap-x-4(가로 간격 1rem), gap-y-2(세로 간격 0.5rem), 그리고 위에서 고른 칸 나누기.
    // `${columns}`처럼 백틱(`) 문자열 안의 ${ }는 값을 끼워 넣는 템플릿 리터럴 문법이에요.
    // gap-x-4: 이름 칸과 칩 사이 간격. 검색 칸(review-browser.tsx)도 같은 간격을 써서 세 줄이 가지런해요.
    <fieldset disabled={disabled} aria-describedby={describedBy} className={`grid gap-x-4 gap-y-2 ${columns}`}>
      {/* float-left: legend는 원래 fieldset 테두리 위에 특별하게 그려지는데, float를 주면 보통 칸처럼 배치할 수 있어요.
          glow: globals.css에서 만든 클래스로, 단말기 화면처럼 글자가 은은하게 빛나 보이게 해요.
          sm:mt-2: 640px 이상에서 위쪽 바깥 여백 0.5rem. 옆의 칩 글자와 높이를 맞춰요(이름이 칩 위에 오는 stack에는 필요 없어요). */}
      <legend className={layout === "stack" ? "glow float-left" : "glow float-left sm:mt-2"}>{legend}</legend>
      {/* flex: 칩을 가로로 늘어놓기, flex-wrap: 자리가 모자라면 다음 줄로 넘기기, gap-2: 칩 사이 0.5rem.
          items-start: 칩이 줄 높이만큼 세로로 늘어나지 않고 제 키를 지켜요. */}
      <div className="flex flex-wrap items-start gap-2">{children}</div>
    </fieldset>
  );
}

/** Choice가 받는 값(props) */
type ChoiceProps = {
  /** 같은 묶음끼리 같은 이름을 써요. 라디오 단추는 이름이 같은 것 중 하나만 고를 수 있어요. */
  name: string;
  /** 단추 종류. radio(하나만) 또는 checkbox(여러 개). 기본 radio */
  type?: "radio" | "checkbox";
  /** 골라져 있는지. 부모가 상태로 들고 있다가 넘겨줘요(제어 컴포넌트). */
  checked: boolean;
  /** 고르거나 풀었을 때 실행할 함수. `() => void`는 "값을 받지 않고 아무것도 돌려주지 않는 함수" 타입이에요. */
  onChange: () => void;
  /** 진짜 단추의 id. 오류가 났을 때 첫 칩으로 초점을 옮기려고 붙여요(없어도 돼요). */
  id?: string;
  /** 단추에 보일 내용. 이 글자가 그대로 단추의 접근 이름(화면 낭독기가 읽는 이름)이 돼요. */
  children: ReactNode;
};

/**
 * 칩 모양 고르기 단추 하나
 *
 * 진짜 단추(<input type="radio|checkbox">)를 투명하게 칩 위에 덮어 두었어요(globals.css의 .chip).
 * 겉모습은 칩이지만 키보드로 고르기, 화면 낭독기 읽기 같은 단추 기능은 그대로 써요.
 * 직접 만든 가짜 단추(<div onClick>)보다 진짜 단추를 꾸미는 쪽이 훨씬 안전합니다.
 * 예: 라디오 묶음에서는 화살표 키로 칩 사이를 옮겨 다니는 기능을 브라우저가 공짜로 해 줘요.
 *
 * "제어 컴포넌트(controlled component)": checked를 부모가 정해 주고, 바뀔 때 onChange로 알려 주는 방식이에요.
 * 단추가 스스로 상태를 들지 않아서, 화면에 보이는 것과 부모의 상태가 언제나 같아요.
 *
 * @param props - {@link ChoiceProps}
 * @returns <label class="chip"> 안에 진짜 단추와 칩 모양을 담은 요소
 */
export function Choice({ name, type = "radio", checked, onChange, id, children }: ChoiceProps) {
  return (
    // <label>로 감싸면 칩 어디를 눌러도 안의 단추가 골라져요. 칩의 글자가 단추 이름이 돼요.
    // React에서는 HTML의 class 대신 className이라고 써요(class는 JavaScript 예약어라서요).
    <label className="chip">
      {/* 진짜 단추. CSS로 투명하게 만들어 칩 위에 덮어 뒀어요(눈에 안 보일 뿐 누르고 초점을 받을 수 있어요). */}
      <input id={id} type={type} name={name} checked={checked} onChange={onChange} />
      {/* 눈에 보이는 칩 모양. CSS가 "골라진 단추 바로 뒤의 .chip-face"를 반전시켜 고른 칩을 표시해요. */}
      <span className="chip-face">
        {/* 고른 칩에만 보이는 ▶ 표시. 색만으로 구분하지 않게 모양으로도 알려 줘요. 꾸밈이라 읽지 않아요.
            고르지 않은 칩에서는 자리도 차지하지 않아서(globals.css), 글자 왼쪽이 비지 않아요.
            aria-hidden="true": 화면 낭독기가 이 요소를 건너뛰게 해요(초점을 받는 요소가 아니라서 써도 안전해요). */}
        <span aria-hidden="true" className="chip-mark">
          ▶
        </span>
        {children}
      </span>
    </label>
  );
}
