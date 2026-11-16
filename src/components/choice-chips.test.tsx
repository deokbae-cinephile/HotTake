/**
 * @file choice-chips.tsx 테스트
 *
 * 무엇을 확인하나요?
 *   칩 모양이어도 진짜 라디오 단추처럼 동작하는지 확인해요.
 *   - 묶음 이름(legend)이 그룹의 이름이 된다
 *   - 고른 칩은 checked, 누르면 onChange가 불린다
 *   - disabled 묶음은 누를 수 없다
 *
 * 왜 확인하나요?
 *   칩은 CSS로 진짜 단추를 투명하게 덮어 만든 모양이라, 겉모습만 보고는 단추 기능이 살아 있는지 알 수 없어요.
 *   그래서 사용자가 실제로 만나는 "역할(role)과 이름"으로 찾아서 눌러 봐요.
 *
 * 테스트 도구 문법
 *   - render(JSX): 가짜 브라우저(jsdom) 안에 컴포넌트를 그려요.
 *   - screen.getByRole(역할, { name }): 화면 낭독기가 보는 것과 같은 기준(역할 + 접근 이름)으로 요소를 찾아요.
 *     없으면 테스트가 바로 실패해요.
 *   - userEvent: 실제 사용자처럼 누르고 입력하는 흉내를 내는 도구예요. setup()으로 준비하고, 동작은 await로 기다려요.
 *   - describe(이름, 함수): 관련 테스트를 한 묶음으로 모아요. it(이름, 함수): 테스트 하나.
 *   - expect(값).toXxx(): "값이 이래야 한다"고 확인해요. 틀리면 테스트가 실패해요.
 *   - vi.fn(): 불렸는지·몇 번 불렸는지 기록하는 가짜 함수(목 함수)를 만들어요.
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Choice, ChoiceGroup } from "./choice-chips";

describe("ChoiceGroup / Choice", () => {
  // async: 안에서 await(기다리기)를 쓰려면 함수 앞에 붙여요. 클릭 흉내는 비동기로 동작해요.
  it("묶음 이름이 붙은 라디오 그룹이고, 고른 칩은 checked이며 누르면 알린다", async () => {
    const user = userEvent.setup();
    // 두 번째 칩을 눌렀을 때 불렸는지 확인할 가짜 함수
    const onChange = vi.fn();
    render(
      <ChoiceGroup legend="인광 색">
        {/* checked만 쓰면 checked={true}와 같아요(JSX 줄임 문법). onChange={() => {}}는 아무 일도 하지 않는 함수예요. */}
        <Choice name="color" checked onChange={() => {}}>
          초록
        </Choice>
        <Choice name="color" checked={false} onChange={onChange}>
          앰버
        </Choice>
      </ChoiceGroup>,
    );

    // <fieldset> + <legend>는 이름 있는 "group"이에요.
    // toBeInTheDocument(): 요소가 화면(문서)에 있는지 확인해요.
    expect(screen.getByRole("group", { name: "인광 색" })).toBeInTheDocument();
    // 칩 글자가 라디오 단추의 이름이 되었는지, 그리고 골라져 있는지(toBeChecked) 함께 확인해요.
    expect(screen.getByRole("radio", { name: "초록" })).toBeChecked();

    // 고르지 않은 칩을 누르면 onChange가 정확히 한 번 불려야 해요.
    await user.click(screen.getByRole("radio", { name: "앰버" }));
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("disabled 묶음의 칩은 누를 수 없다", () => {
    render(
      <ChoiceGroup legend="정렬" disabled>
        <Choice name="sort" checked onChange={() => {}}>
          최신순
        </Choice>
      </ChoiceGroup>,
    );
    // <fieldset disabled>이면 안의 라디오 단추도 저절로 disabled가 되는지 확인해요(HTML 기본 기능).
    expect(screen.getByRole("radio", { name: "최신순" })).toBeDisabled();
  });
});
