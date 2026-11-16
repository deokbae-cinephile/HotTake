# 읽는 순서 안내

프론트엔드를 처음 배우는 사람이 이 저장소를 어디서부터 읽으면 좋은지 한 장에 모았어요.
**문서 → 코드** 순서로 보고, 코드는 아래 번호 순서대로 열면 돼요.

모든 코드 파일 맨 위 설명(`@file`) 바로 아래에도 같은 번호와 앞·다음 파일이 적혀 있어요.

```
 * 읽는 순서: 3/84번째 · 1단계(블로그의 기본 값과 데이터 모양)
 *   앞: src/lib/categories.ts → 다음: src/lib/review.ts (전체 순서와 문서 순서: docs/reading-order.md)
```

그래서 한 파일을 다 읽으면 "다음:"에 적힌 파일을 열면 돼요. 파일 순서를 바꾸면 이 문서와 파일 맨 위 표시를 함께 고쳐요(단위 테스트 `src/test/reading-order.test.ts`가 둘이 맞는지 확인해요).

## 1. 문서 읽는 순서

| 순서 | 문서 | 무엇을 알 수 있나요 | 언제 보나요 |
|---|---|---|---|
| 1 | 이 문서(docs/reading-order.md) | 문서와 코드를 읽는 순서 | 맨 처음 |
| 2 | [변경 기록](../CHANGELOG.md) 1.0.0 | 어떤 블로그인지, 무엇을 할 수 있는지 | 이 문서 다음 |
| 3 | [개발 가이드](development.md) 1~3장 | 한눈에 보기, 폴더 구조, 데이터 흐름(원고 → 화면, 글쓰기 → 커밋) | 코드를 열기 전에 |
| 4 | [원고 틀](../content/templates/review.json) | 리뷰 원고 한 편의 모양(항목 이름과 뜻은 개발 가이드 3장의 표) | 1단계 코드를 읽기 전에 |
| 5 | 아래 "2. 코드 읽는 순서" 1~4단계 | 방문자가 보는 화면 | 개발 가이드 1~3장 다음 |
| 6 | [개발 가이드](development.md) 4장 | 로그인과 접근 막기 | 코드 5단계 전에 |
| 7 | 아래 코드 5~6단계 | 로그인, 글쓰기·저장 | |
| 8 | [개발 가이드](development.md) 6~7장 | 화면 규칙, 키보드와 접근성 | 화면 코드를 고치기 전에 |
| 9 | 아래 코드 7~8단계 | 설치형 웹 앱, 설정·테스트·배포 | |
| 10 | [개발 가이드](development.md) 5장, 8장 | 환경 변수와 배포(Cloudflare), 테스트 | 배포·테스트를 만질 때 |

## 2. 코드 읽는 순서

모두  파일이에요. 각 파일의 테스트(`*.test.ts`, `*.test.tsx`)는 같은 폴더 옆에 있어요. 파일을 읽은 뒤 테스트를 이어서 보면, 그 파일이 무엇을 약속하는지 예시로 알 수 있어요.

### 1단계. 블로그의 기본 값과 데이터 모양

블로그 이름·분류·리뷰 한 편의 모양처럼, 다른 모든 파일이 가져다 쓰는 값부터 봐요.

| 번호 | 파일 | 내용 |
|---|---|---|
| 1 | [`src/lib/site.ts`](../src/lib/site.ts) | 블로그 이름·저장소·주소 같은 기본 설정 |
| 2 | [`src/lib/categories.ts`](../src/lib/categories.ts) | 분류(영화·도서) 목록과 주소용 영어 이름 |
| 3 | [`src/lib/review-schema.ts`](../src/lib/review-schema.ts) | 원고(JSON) 검사 규칙과 오류 문구 |
| 4 | [`src/lib/review.ts`](../src/lib/review.ts) | 리뷰 한 편의 타입, 최신순·평점순 정렬, 이미지 주소 |
| 5 | [`src/lib/format.ts`](../src/lib/format.ts) | 평점·정보 줄(가운뎃점) 글자 만들기 |

### 2단계. 원고가 리뷰 데이터가 되기까지

content/reviews/*.json 원고를 빌드할 때 읽고 검사해 화면이 쓰는 목록으로 바꾸는 흐름이에요.

| 번호 | 파일 | 내용 |
|---|---|---|
| 6 | [`src/lib/review-data.ts`](../src/lib/review-data.ts) | 원고 폴더를 읽어 검사하고 최신순 목록으로 만들기 |

### 3단계. 화면의 뼈대와 공통 모양

모든 화면을 감싸는 레이아웃, 색·글꼴, 머리글·바닥글, 픽셀 그림 도구예요.

| 번호 | 파일 | 내용 |
|---|---|---|
| 7 | [`src/app/globals.css`](../src/app/globals.css) | 색·글꼴·단추·칩 등 전역 스타일(CRT 화면) |
| 8 | [`src/lib/palette.ts`](../src/lib/palette.ts) | 기본 인광 색 값 |
| 9 | [`src/lib/pixel-path.ts`](../src/lib/pixel-path.ts) | 글자 격자 그림 → SVG 경로 |
| 10 | [`src/components/pixel-art.tsx`](../src/components/pixel-art.tsx) | 격자 그림을 화면에 그리는 컴포넌트 |
| 11 | [`src/lib/logo.ts`](../src/lib/logo.ts) | 로고(플로피 디스크) 그림 |
| 12 | [`src/lib/github-mark.ts`](../src/lib/github-mark.ts) | GitHub 아이콘 그림 |
| 13 | [`src/app/layout.tsx`](../src/app/layout.tsx) | 모든 화면을 감싸는 틀(<html>, 머리글·바닥글, SVG 필터) |
| 14 | [`src/components/site-header.tsx`](../src/components/site-header.tsx) | 머리글(로고·블로그 이름·GitHub 링크) |
| 15 | [`src/components/site-footer.tsx`](../src/components/site-footer.tsx) | 바닥글 |
| 16 | [`src/components/loading-status.tsx`](../src/components/loading-status.tsx) | 로딩 UI(깜빡이는 커서 + 막대) |

### 4단계. 처음 화면: 작품 목록

검색·분류·정렬과 목록 한 편이 어떻게 그려지는지 봐요.

| 번호 | 파일 | 내용 |
|---|---|---|
| 17 | [`src/app/page.tsx`](../src/app/page.tsx) | 처음 화면(주소 /) |
| 18 | [`src/lib/browse.ts`](../src/lib/browse.ts) | 검색·분류 필터·정렬 규칙(순수 함수) |
| 19 | [`src/components/review-browser.tsx`](../src/components/review-browser.tsx) | 검색 칸과 목록, 무한 스크롤 |
| 20 | [`src/components/choice-chips.tsx`](../src/components/choice-chips.tsx) | 분류·정렬 칩(라디오 단추) |
| 21 | [`src/components/review-list-item.tsx`](../src/components/review-list-item.tsx) | 목록의 리뷰 한 편 |
| 22 | [`src/components/review-image.tsx`](../src/components/review-image.tsx) | 리뷰 이미지 액자와 기본 이미지 |
| 23 | [`src/components/loading-image.tsx`](../src/components/loading-image.tsx) | 이미지가 오기 전 스켈레톤 |
| 24 | [`src/components/rating.tsx`](../src/components/rating.tsx) | 평점 숫자 |
| 25 | [`src/components/back-to-top.tsx`](../src/components/back-to-top.tsx) | [맨 위로] 단추 |
| 26 | [`src/components/floating-buttons.tsx`](../src/components/floating-buttons.tsx) | 오른쪽 아래 떠 있는 단추들 |
| 27 | [`src/lib/structured-data.ts`](../src/lib/structured-data.ts) | 검색엔진용 사이트 정보(JSON-LD) |

### 5단계. 글쓴이 로그인과 잠금

한 사람만 글을 쓰도록 막는 방법이에요. 보안 코드라 천천히 읽어요.

| 번호 | 파일 | 내용 |
|---|---|---|
| 28 | [`src/proxy.ts`](../src/proxy.ts) | 글쓰기 화면·API 앞의 문지기 |
| 29 | [`src/lib/password-hash.ts`](../src/lib/password-hash.ts) | 비밀번호 해시(scrypt) |
| 30 | [`src/lib/session.ts`](../src/lib/session.ts) | 로그인 표(서명한 토큰) |
| 31 | [`src/lib/auth-cookies.ts`](../src/lib/auth-cookies.ts) | 로그인 쿠키 이름·옵션 |
| 32 | [`src/lib/admin-auth.ts`](../src/lib/admin-auth.ts) | 서버에서 로그인 확인 |
| 33 | [`src/lib/login-limit.ts`](../src/lib/login-limit.ts) | 비밀번호 대입 막기(틀린 횟수) |
| 34 | [`src/app/api/session/route.ts`](../src/app/api/session/route.ts) | 로그인·로그아웃 API |
| 35 | [`src/app/login/page.tsx`](../src/app/login/page.tsx) | 로그인 화면 |
| 36 | [`src/components/login-form.tsx`](../src/components/login-form.tsx) | 로그인 폼 |
| 37 | [`src/lib/admin-hint.ts`](../src/lib/admin-hint.ts) | 브라우저의 로그인 표시 |
| 38 | [`src/components/use-is-admin.ts`](../src/components/use-is-admin.ts) | 로그인 표시를 읽는 훅 |
| 39 | [`src/components/session-controls.tsx`](../src/components/session-controls.tsx) | [로그아웃] 단추 |
| 40 | [`scripts/admin-secrets.mjs`](../scripts/admin-secrets.mjs) | 로그인 비밀 값 만들기(pnpm admin-secrets) |

### 6단계. 리뷰 쓰기·고치기·지우기

글쓰기 화면에서 저장 단추를 누르면 GitHub 커밋이 되기까지의 흐름이에요.

| 번호 | 파일 | 내용 |
|---|---|---|
| 41 | [`src/lib/review-values.ts`](../src/lib/review-values.ts) | 글쓰기 칸 값의 모양 |
| 42 | [`src/lib/review-form.ts`](../src/lib/review-form.ts) | 글쓰기 칸 검사(화면·서버 공용) |
| 43 | [`src/lib/upload-rules.ts`](../src/lib/upload-rules.ts) | 이미지 올리기 규칙(형식·크기·파일 앞부분 확인) |
| 44 | [`src/lib/shrink-image.ts`](../src/lib/shrink-image.ts) | 올리기 전에 브라우저에서 이미지 줄이기 |
| 45 | [`src/lib/admin-api.ts`](../src/lib/admin-api.ts) | 화면에서 저장 API 부르기 |
| 46 | [`src/app/write/page.tsx`](../src/app/write/page.tsx) | 리뷰 추가 화면(주소 /write) |
| 47 | [`src/app/write/[slug]/page.tsx`](../src/app/write/[slug]/page.tsx) | 리뷰 수정 화면(주소 /write/<파일 이름>) |
| 48 | [`src/app/write/loading.tsx`](../src/app/write/loading.tsx) | 글쓰기 화면을 준비하는 동안 |
| 49 | [`src/components/skeleton.tsx`](../src/components/skeleton.tsx) | 글쓰기 스켈레톤 |
| 50 | [`src/components/not-configured.tsx`](../src/components/not-configured.tsx) | 저장 설정이 없을 때의 안내 |
| 51 | [`src/components/review-writer.tsx`](../src/components/review-writer.tsx) | 리뷰 라이터(추가·수정 폼) — 가장 큰 화면 파일 |
| 52 | [`src/lib/review-file.ts`](../src/lib/review-file.ts) | 원고 글자(JSON) ↔ 칸 값 |
| 53 | [`src/lib/github.ts`](../src/lib/github.ts) | GitHub API로 읽고 커밋하기 |
| 54 | [`src/lib/review-store.ts`](../src/lib/review-store.ts) | 원고 읽기와 추가·수정·삭제 → 커밋 하나 |
| 55 | [`src/lib/api-response.ts`](../src/lib/api-response.ts) | API 오류를 JSON 응답으로 |
| 56 | [`src/app/api/images/route.ts`](../src/app/api/images/route.ts) | 이미지 한 장 올리기 API |
| 57 | [`src/app/api/reviews/route.ts`](../src/app/api/reviews/route.ts) | 리뷰 추가 API |
| 58 | [`src/app/api/reviews/[slug]/route.ts`](../src/app/api/reviews/[slug]/route.ts) | 리뷰 수정·삭제 API |
| 59 | [`src/lib/action-icons.ts`](../src/lib/action-icons.ts) | 목록의 수정·삭제 아이콘 그림 |
| 60 | [`src/components/review-list-admin.tsx`](../src/components/review-list-admin.tsx) | 목록 한 편의 [수정]·[삭제] |
| 61 | [`src/components/delete-review.tsx`](../src/components/delete-review.tsx) | 삭제 확인 창(<dialog>) |

### 7단계. 설치형 웹 앱과 그 밖의 화면

앱 설치, 오프라인, 사이트맵처럼 화면 둘레의 기능이에요.

| 번호 | 파일 | 내용 |
|---|---|---|
| 62 | [`src/app/manifest.ts`](../src/app/manifest.ts) | 설치 앱 정보 |
| 63 | [`public/sw.js`](../public/sw.js) | 서비스 워커(오프라인 저장) |
| 64 | [`src/components/service-worker.tsx`](../src/components/service-worker.tsx) | 서비스 워커 등록 |
| 65 | [`src/components/install-prompt.tsx`](../src/components/install-prompt.tsx) | 앱으로 설치 안내 |
| 66 | [`src/app/offline/page.tsx`](../src/app/offline/page.tsx) | 오프라인 화면 |
| 67 | [`src/app/not-found.tsx`](../src/app/not-found.tsx) | 없는 주소 화면 |
| 68 | [`src/app/sitemap.ts`](../src/app/sitemap.ts) | 사이트맵 |
| 69 | [`src/app/robots.ts`](../src/app/robots.ts) | 검색엔진 로봇 안내 |
| 70 | [`scripts/make-icons.mjs`](../scripts/make-icons.mjs) | 아이콘·공유 그림 만들기(pnpm icons) |

### 8단계. 설정·테스트·배포

마지막으로 도구 설정과 테스트, 자동 배포를 봐요.

| 번호 | 파일 | 내용 |
|---|---|---|
| 71 | [`next.config.ts`](../next.config.ts) | Next.js 설정 |
| 72 | [`vitest.config.mts`](../vitest.config.mts) | 단위 테스트 설정 |
| 73 | [`vitest.setup.ts`](../vitest.setup.ts) | 단위 테스트 준비 |
| 74 | [`src/test/review-mocks.ts`](../src/test/review-mocks.ts) | 테스트용 가짜 리뷰 |
| 75 | [`playwright.config.ts`](../playwright.config.ts) | E2E 설정(서버 두 개 띄우기) |
| 76 | [`e2e/helpers.ts`](../e2e/helpers.ts) | E2E 도우미(axe 검사 등) |
| 77 | [`e2e/admin-account.ts`](../e2e/admin-account.ts) | E2E 시험용 글쓴이 계정 |
| 78 | [`e2e/mock-github.mjs`](../e2e/mock-github.mjs) | 가짜 GitHub 서버 |
| 79 | [`e2e/blog.spec.ts`](../e2e/blog.spec.ts) | 방문자 화면 E2E |
| 80 | [`e2e/admin.spec.ts`](../e2e/admin.spec.ts) | 글쓴이 기능 E2E |
| 81 | [`e2e/pwa.spec.ts`](../e2e/pwa.spec.ts) | 설치형 웹 앱 E2E |
| 82 | [`open-next.config.ts`](../open-next.config.ts) | Cloudflare Workers용 변환 설정 |
| 83 | [`wrangler.jsonc`](../wrangler.jsonc) | Cloudflare Workers 설정(워커 blog, 도메인) |
| 84 | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | 자동 검사·배포·릴리스(GitHub Actions) |

## 3. 읽을 때 도움이 되는 요령

- **한 파일 안에서는 위에서 아래로** 읽어요. 맨 위 설명(이 파일이 하는 일, 누가 쓰나요)을 먼저 읽고, 그 다음 함수·컴포넌트를 봐요.
- **모르는 이름이 나오면** 그 파일의 `import` 줄에서 어느 파일에서 왔는지 보고, 그 파일 맨 위 설명만 먼저 읽어요. 끝까지 따라가지 않아도 돼요.
- **실제로 돌려 보며** 읽으면 빨라요. `pnpm dev`로 띄우고 화면을 보면서 3~4단계를 읽어요. 글쓰기(5~6단계)는 개발 가이드 8장의 가짜 GitHub 서버로 저장소를 건드리지 않고 써 볼 수 있어요.
- **테스트로 확인**해요. 파일을 고쳤다면 `pnpm test`(단위)와 `pnpm e2e`(진짜 브라우저)를 돌려요.
