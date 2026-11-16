/**
 * @file 스켈레톤 UI (skeleton.tsx)
 * 읽는 순서: 49/84번째 · 6단계(리뷰 쓰기·고치기·지우기)
 *   앞: src/app/write/loading.tsx → 다음: src/components/not-configured.tsx (전체 순서와 문서 순서: docs/reading-order.md)
 *
 * 이 파일이 하는 일
 *   글쓰기 화면을 불러오는 동안, 곧 나올 화면과 같은 자리에 옅은 초록 막대·상자를 미리 그려 둬요.
 *   내용이 도착하면 그 자리에 그대로 들어와서 화면이 덜 흔들리고, 무엇이 나올지 미리 알 수 있어요.
 *
 *     WriterSkeleton  글쓰기: [(로딩 UI)] [이미지 | 콘텐츠 정보 2열 × 4행] [리뷰 저장][취소](오른쪽)
 *
 *   로딩 UI(status 자리)는 실제 화면의 첫 줄(글쓰기 제목) 자리에 놓아요. 그래서 내용이 들어올 때 화면이 밀리지 않아요.
 *
 * 왜 글쓰기 화면에만 있나요?
 *   목록 화면은 빌드할 때 미리 만든 화면이라 기다릴 일이 거의 없어요. 그런데 loading.tsx를 두면 Next.js가 미리 만든
 *   HTML 맨 앞에도 로딩 화면을 넣고 내용을 잠시 뒤 바꿔 넣어서, 화면을 열 때마다 스켈레톤이 번쩍여요.
 *   그래서 저장소(GitHub)에서 원고를 읽느라 실제로 기다리는 글쓰기 화면에만 둬요.
 *   막대·상자는 움직이지 않는 옅은 초록 칸이에요(globals.css의 .skeleton). 눈이 편하도록 테두리도, 지나가는 빛도 두지 않았어요.
 *   화면에서 움직이는 것은 로딩 UI(깜빡이는 커서와 차오르는 막대) 하나뿐이에요.
 *   칸 나누기(grid)는 실제 화면과 같은 값을 써서, 내용이 들어와도 자리가 바뀌지 않아요.
 *
 * 접근성
 *   막대·상자는 모양뿐이라 화면 낭독기에서 숨겨요(aria-hidden). "불러오는 중"은 status 자리의
 *   로딩 UI(components/loading-status.tsx, role="status")가 글자로 알려 줘요. 그래서 status는 숨긴 영역 밖에 둬요.
 *
 * 누가 쓰나요?
 *   app/write/loading.tsx(리뷰 추가·수정 화면을 불러오는 동안)
 */

// ReactNode: 화면에 그릴 수 있는 것(요소, 글자, null 등) 모두를 뜻하는 타입이에요. `import type`은 타입만 가져와요.
import type { ReactNode } from "react";

/** 스켈레톤이 받는 값(props) */
type Props = {
  /** 첫 줄 자리에 놓을 로딩 UI(<LoadingStatus />) */
  status: ReactNode;
};

/**
 * 막대 하나. 기본은 글자 높이(12px)예요. className으로 너비·높이를 정해요.
 * `export`가 없어 이 파일 안에서만 쓰는 작은 조각이에요.
 *
 * @param props.className 너비·높이 등 더할 클래스(예: "w-24", "h-6")
 * @returns 화면 낭독기에서 숨긴 옅은 초록 막대(span)
 */
function Bar({ className = "" }: { className?: string }) {
  // skeleton: 옅은 초록 바탕(globals.css). block: span을 상자처럼 너비·높이를 가지게. h-3: 높이 0.75rem(12px)
  return <span aria-hidden="true" className={`skeleton block h-3 ${className}`} />;
}

/**
 * 상자 하나(입력 칸·단추·이미지 자리). 막대처럼 옅게 칠하고, 테두리는 두지 않아요.
 *
 * @param props.className 너비·높이 등 크기를 정할 클래스(예: "h-11 w-full")
 * @returns 화면 낭독기에서 숨긴 옅은 초록 상자(span)
 */
function Box({ className = "" }: { className?: string }) {
  return <span aria-hidden="true" className={`skeleton block ${className}`} />;
}

/**
 * 글쓰기 화면의 스켈레톤: components/review-writer.tsx와 같은 칸 나누기예요.
 *
 * @param props.status 첫 줄 자리에 놓을 로딩 UI
 * @returns 로딩 UI + 숨긴 막대·상자들로 된 글쓰기 화면 모양
 *
 * @example
 * <WriterSkeleton status={<LoadingStatus label="리뷰를 불러오는 중" />} />
 */
export function WriterSkeleton({ status }: Props) {
  return (
    // grid gap-10: 아이들을 세로로 쌓고 사이를 2.5rem(40px) 띄워요.
    <div className="grid gap-10">
      {/* 제목(리뷰 추가·리뷰 수정) 자리에 로딩 UI */}
      {status}

      {/* [이미지 | 콘텐츠 정보 2열 × 4행]
          lg:grid-cols-3: 넓은 화면(lg, 1024px 이상)에서는 3칸으로 나눠 이미지 1칸, 콘텐츠 정보 2칸(lg:col-span-2)을 써요.
          좁은 화면에서는 위아래로 쌓여요. 묶음 전체를 aria-hidden으로 숨겨요. */}
      <div aria-hidden="true" className="grid gap-10 lg:grid-cols-3 lg:gap-8">
        <div className="grid content-start gap-4">
          <Bar className="mb-4 h-6 w-24" />
          <div className="grid w-40 gap-4 lg:w-full lg:max-w-[18rem]">
            <Box className="aspect-[2/3] w-full" />
            <Box className="h-11 w-full" />
          </div>
        </div>
        <div className="grid content-start items-start gap-6 lg:col-span-2 lg:grid-cols-2 lg:gap-x-6">
          <Bar className="mb-4 h-6 w-32 lg:col-span-2" />
          {/* Array.from({ length: 8 }, 함수): 길이 8인 배열을 만들며 칸마다 함수를 불러요(이름표 + 입력 칸 8쌍 = 2열 × 4행).
              첫째 값(_)은 쓰지 않아 밑줄로 두고, 둘째 값 index(0~7)를 key로 써요. key: React가 목록의 각 항목을 구별하는 표시예요. */}
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="grid gap-2">
              <Bar className="w-24" />
              <Box className="h-11 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* [리뷰 저장] [취소]: 실제 화면처럼 오른쪽에 붙여요(justify-end). gap-3: 단추 사이 12px. */}
      <div aria-hidden="true" className="flex justify-end gap-3">
        <Box className="h-11 w-28" />
        <Box className="h-11 w-16" />
      </div>
    </div>
  );
}
