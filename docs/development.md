# 개발 가이드

HotTake("한 줄 평"이라는 뜻, 작품 한 줄 평 블로그)의 코드를 처음 보는 프론트엔드 개발자를 위한 안내입니다.
처음이라면 [읽는 순서 안내](reading-order.md)부터 보세요(문서 순서와 코드 파일 순서). 코드 파일마다 맨 위에 "이 파일이 하는 일"과 읽는 순서(앞·다음 파일)를 적어 두었고, 줄마다 쉬운 주석을 달았으니 이 문서로 큰 그림을 잡은 뒤 파일을 열어 보세요.

## 1. 한눈에 보기

- **무엇을 만드나요?** 글쓴이 한 사람이 영화·도서 등 작품의 평점과 한 줄 평을 쓰고 고치고 지우는 가벼운 블로그예요. 리뷰 한 편은 저장소의 JSON 파일 하나예요.
- **어떻게 가볍나요?** 목록 화면은 빌드할 때 HTML로 미리 만들어 둡니다(정적 생성). 방문자에게는 만든 화면을 그대로 주고, 서버 코드는 로그인·글쓰기·저장에만 돌아요.
- **어디서 도나요?** Cloudflare Workers예요. OpenNext 어댑터가 Next.js 앱을 Workers용으로 바꿔요(5장).
- **쓰는 기술:** Next.js 16(App Router, Proxy, Route Handler) · React 19 · TypeScript 7 · Tailwind CSS 4 · Node.js 26 · OpenNext Cloudflare 어댑터 · Wrangler
- **운영 의존성은 네 개뿐이에요:** `next`, `react`, `react-dom`, `server-only`. 원고 검사·JSON 읽기·이미지 형식 확인은 손으로 짠 짧은 함수예요. 새 라이브러리는 꼭 필요할 때만 더해요.
- **검사 도구:** oxlint(접근성·React·Next.js 규칙 포함) · Vitest + Testing Library · Playwright + axe

## 2. 폴더 구조

```
content/reviews/          리뷰 원고(<파일 이름>.json). 파일 이름이 리뷰를 가리키는 이름이 돼요. _로 시작하는 파일은 읽지 않아요
content/templates/        원고 틀(review.json). 저장소에서 원고를 손으로 쓸 때 이 모양을 따라요
public/                   리뷰 이미지(images/), 앱 아이콘(icons/), 서비스 워커(sw.js), 공유 미리 보기 그림(og.png, 1200×630),
                          Cloudflare가 정적 파일에 붙일 헤더(_headers)
src/
├─ proxy.ts               문지기: /write·/api/reviews·/api/images를 로그인 전에 막아요
├─ app/                   폴더 구조가 곧 주소예요
│  ├─ page.tsx            "/"                   작품 목록(정적)
│  ├─ login/              "/login"              글쓴이 로그인
│  ├─ write/              "/write", "/write/<파일 이름>"  리뷰 추가·수정(요청마다 서버에서), loading.tsx(스켈레톤)
│  ├─ api/session/        로그인(POST)·로그아웃(DELETE)
│  ├─ api/images/         이미지 한 장 올리기(POST) → GitHub blob
│  ├─ api/reviews/        리뷰 추가(POST), [slug]/ 수정(PUT)·삭제(DELETE)
│  ├─ offline/, not-found.tsx, manifest.ts, sitemap.ts, robots.ts
│  └─ layout.tsx, globals.css, fonts/   공통 틀(이미지 SVG 필터 포함)·스타일·글꼴
├─ components/            화면 조각. 각 파일 옆에 *.test.tsx
│  ├─ review-browser.tsx  검색·분류·정렬과 목록(10편씩 무한 스크롤)
│  ├─ review-list-item.tsx, review-list-admin.tsx, delete-review.tsx   목록 한 편과 글쓴이의 수정·삭제
│  ├─ review-writer.tsx   리뷰 추가·수정 폼(이미지 고르기)
│  ├─ review-image.tsx, loading-image.tsx, rating.tsx   이미지(초록 필터·기본 이미지·스켈레톤), 평점
│  ├─ site-header.tsx, site-footer.tsx, floating-buttons.tsx, back-to-top.tsx, session-controls.tsx
│  └─ login-form.tsx, install-prompt.tsx, service-worker.tsx, loading-status.tsx, skeleton.tsx, pixel-art.tsx …
├─ lib/                   화면이 아닌 코드(데이터·규칙). 각 파일 옆에 *.test.ts
│  ├─ review.ts, review-schema.ts, review-data.ts   리뷰 모양·정렬, 원고 검사 규칙, 원고 읽기(빌드할 때)
│  ├─ review-values.ts, review-form.ts, review-file.ts   글쓰기 칸 값, 칸 검사, 원고 ↔ 칸 값(JSON)
│  ├─ review-store.ts, github.ts                     원고 읽기·추가·수정·삭제 → GitHub 커밋
│  ├─ upload-rules.ts, shrink-image.ts               이미지 올리기 규칙(파일 앞부분으로 형식 확인), 올리기 전 줄이기
│  ├─ session.ts, password-hash.ts, admin-auth.ts, login-limit.ts   로그인 표(서명), 비밀번호 해시, 로그인 확인, 실패 횟수 제한
│  └─ browse.ts, categories.ts, site.ts, structured-data.ts …  검색·정렬, 분류, 블로그 정보, 검색엔진 정보
e2e/                      E2E 테스트, 시험용 원고(fixtures/reviews, 11편), 가짜 GitHub 서버(mock-github.mjs)
scripts/                  아이콘·공유 그림 만들기(make-icons.mjs), 로그인 비밀 값 만들기(admin-secrets.mjs)
open-next.config.ts       Cloudflare Workers용으로 바꾸는 설정(미리 만든 화면 캐시)
wrangler.jsonc            Cloudflare Workers 설정(시작 파일, 코드 줄이기, 정적 파일, 이미지 최적화, 도메인)
.oxlintrc.json            린트 규칙(oxlint)
```

## 3. 데이터 흐름

**리뷰 원고 한 편(JSON)**

```json
{
  "title": "겨울 정류장",
  "year": 2024,
  "creator": "한서윤, 김도윤",
  "category": "영화",
  "rating": 4.5,
  "oneLiner": "버스는 오지 않아도, 기다림은 끝내 도착한다.",
  "publishedAt": "2026-11-14T19:35:48+09:00",
  "image": "winter-stop.jpg"
}
```

| 항목 | 필수 | 뜻 |
|---|---|---|
| `title` | ○ | 한국어 제목 |
| `year` | ○ | 연도(영화는 개봉한 해, 도서는 펴낸 해). 따옴표 없는 숫자 |
| `creator` | ○ | 감독 또는 작가. 여러 명이면 쉼표로 이어요 |
| `category` | ○ | 분류: `영화`, `도서` 가운데 하나 |
| `rating` | ○ | 평점: 0.5~5, 0.5 단위 숫자 |
| `oneLiner` | ○ | 한 줄 평 |
| `publishedAt` | ○ | 글 쓴 날. `YYYY-MM-DD` 또는 시각과 시간대까지. 화면에는 보이지 않고 최신순 정렬에만 써요 |
| `image` | | `public/images`에 넣은 이미지 파일 이름(jpg·jpeg·png·webp·avif) |

**읽기(누구나)**

```
content/reviews/*.json ──next build──> lib/review-data.ts(읽기·검사) ──> 정적 HTML(처음 화면) ──> 방문자
(개발 서버 pnpm dev는 새로 고칠 때마다 원고를 다시 읽어서, 원고를 고치면 바로 보여요.)
```

원고에 실수가 있으면 빌드가 멈추고, 어느 파일의 어디를 어떻게 고칠지 한국어로 모두 알려 줍니다. 그래서 잘못된 원고는 배포되지 않아요. 단위 테스트(`src/lib/content.test.ts`)도 같은 검사를 해서 CI가 먼저 알려 줘요.

**쓰기(글쓴이만)**

방문자에게는 로그인 링크를 보이지 않아요. 글쓴이는 `/login`으로 직접 가거나, `/write`에 가면 로그인 화면으로 보내져요.

```
/login ─(아이디·비밀번호)─> /api/session ─> 세션 쿠키(httpOnly) + 표시 쿠키
/write ─proxy.ts 확인─> 리뷰 라이터
   이미지 고르기 ─> 브라우저에서 줄이기(긴 변 800px, JPG)
   [리뷰 저장] ─> /api/images(이미지 → blob) ─> /api/reviews(검사 → 커밋 하나) ─> GitHub main
                                                       └─> GitHub Actions가 검사한 뒤 Cloudflare에 배포(몇 분)
```

- 이미지는 고르는 순간 브라우저에서 줄여요(`lib/shrink-image.ts`). 긴 변 800px보다 크거나 256KB보다 크면 JPG로 다시 만들고, 이미 작은 JPG·PNG는 그대로예요. 이미지는 목록 썸네일(최대 70px)과 글쓰기 미리보기(가로 최대 224px)로만 보여서 800px이면 고해상도 화면에서도 넉넉하고, 저장소에 쌓이는 용량도 작아요(포스터 한 장 보통 50~150KB).
- 이미지는 요청 하나가 하는 일(CPU·메모리)을 작게 나누려고 먼저 올리고(최대 4MB), 리뷰를 저장할 때 원고와 함께 커밋 하나로 묶어요. 이미지 올리기 API는 파일 앞부분(서명 바이트)으로 실제 형식을 확인해요(`checkImage`).
- 이미지 파일 이름은 `<파일 이름>.확장자`(예: `winter-stop.jpg`)예요. 파일 이름을 이미지보다 나중에 적어도 저장할 때 맞춰져요.
- 새 리뷰의 "글 쓴 날"은 저장할 때 서버가 한국 시간 날짜와 시각까지 넣어요(`lib/review-form.ts`의 `nowInSeoul`). 같은 날 쓴 리뷰끼리도 최신순이 맞아요.
- 저장하기 전에 서버가 빌드 때와 같은 규칙으로 다시 검사해요(칸, 파일 이름 겹침, 이미지 파일, 그사이 다른 곳에서 고쳤는지).
- 수정·삭제는 더 쓰지 않는 이 리뷰의 이미지도 함께 지워 저장소를 가볍게 둬요. 지우는 이미지는 이름이 `<파일 이름>.확장자`인 "이 리뷰 것"뿐이에요.
- 수정 화면은 서버가 저장소의 원고를 칸 값으로 바꿔 넘겨줘요. 원고 JSON 문법이 망가졌으면 저장소에서 고치라고 알려요.
- 저장 로딩: [리뷰 저장]을 누르면 단추 줄 바로 아래(오른쪽)에 로딩 UI(커서 + 16칸 막대)가 보여요. "이미지를 올리는 중" → "리뷰를 저장하는 중"이에요. 안내 영역(`role="status"`)은 늘 두고 내용만 바꿔요.

## 4. 로그인과 접근 막기

- **한 사람만:** 아이디(`ADMIN_ID`)와 비밀번호 해시(`ADMIN_PASSWORD_HASH`, scrypt)는 서버 환경 변수에만 있어요.
- **로그인 표:** `내용.서명` 모양의 토큰을 `SESSION_SECRET`으로 HMAC 서명해 httpOnly 쿠키에 담아요(7일). 웹 표준 Web Crypto만 써서 어느 호스팅에서나 돌아요.
- **이중 잠금:** `src/proxy.ts`가 쓰기 화면·API 앞에서 먼저 막고, API와 글쓰기 화면이 `lib/admin-auth.ts`로 한 번 더 확인해요. Next.js 문서도 proxy만 믿지 말라고 권해요.
- **CSRF:** 쿠키는 `SameSite=Lax`이고, 쓰기 API는 `Origin`이 우리 주소일 때만 받아요.
- **비밀번호 대입 막기:** 같은 IP에서 10분 동안 10번 틀리면, 비밀번호를 확인(계산)하기 전에 429로 막아요(`lib/login-limit.ts`). 기록은 서버 인스턴스마다 따로라, Cloudflare 속도 제한 규칙도 함께 걸어 두었어요(5장).
- **로그인 뒤 이동:** `?next=` 주소는 우리 사이트 안 주소만 받아요. 탭·줄바꿈을 섞어 다른 사이트로 보내는 주소도 막아요.
- **화면의 단추:** 목록은 정적 HTML이라, 비밀이 없는 표시 쿠키(`blog_admin=1`)로 [+](리뷰 추가)·[수정]·[삭제]를 보일지만 정해요. 실제 권한은 늘 서버가 확인해요.

## 5. 환경 변수와 배포(Cloudflare Workers)

블로그는 **Cloudflare Workers**에서 돌아요. OpenNext 어댑터(`@opennextjs/cloudflare`)가 `next build` 결과를 Workers용 코드(`.open-next/`)로 바꾸고, `wrangler.jsonc` 설정대로 올라가요. main에 커밋이 올라올 때마다(글쓰기 화면의 저장 포함) **GitHub Actions**(`.github/workflows/ci.yml`)가 검사를 돌리고, 통과하면 `deploy` 단계가 Cloudflare에 올려요. 버전을 올린 커밋이면 이어서 `release` 단계가 태그와 릴리스를 만들어요(아래 "버전과 릴리스").

| 이름 | 설명 |
|---|---|
| `ADMIN_ID` | 글쓴이 아이디 |
| `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | `pnpm admin-secrets`가 비밀번호를 두 번 입력받아 만들어 줘요 |
| `GITHUB_CONTENT_TOKEN` | 이 저장소 하나에만 **Contents: Read and write**를 준 fine-grained 토큰(저장할 저장소·브랜치는 `lib/site.ts`의 `repo`) |
| `SITE_URL` | (선택) 대표 주소. 없으면 `https://deokbae.blog` |

로그인·저장 값 4개는 서버가 요청을 처리할 때 읽어요. 운영에서는 Cloudflare 워커의 비밀 값(Secret)으로, 내 컴퓨터에서는 `.env.local`에 넣어요.
`SITE_URL`만은 빌드할 때도 읽어요(미리 만든 화면의 대표 주소와 사이트맵에 들어가요). 다른 주소로 바꾸려면 `.github/workflows/ci.yml`의 배포 단계 `env`에 넣고 다시 배포해야 사이트맵까지 바뀌어요.

**배포 설정**

| 어디에 | 무엇을 |
|---|---|
| GitHub 저장소 → Settings → Secrets and variables → Actions | 비밀 값 `CLOUDFLARE_API_TOKEN`(Workers 배포 권한만 준 Cloudflare API 토큰), 변수 `CLOUDFLARE_ACCOUNT_ID`(Cloudflare 계정 번호). 변수가 없으면 배포 단계를 건너뛰어요 |
| Cloudflare 워커 `blog`의 비밀 값 | 위 표의 `ADMIN_ID`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `GITHUB_CONTENT_TOKEN` |

- 워커 이름(`wrangler.jsonc`의 `name`, `blog`)을 바꾸면 새 워커가 생기고 도메인·비밀 값이 따라오지 않으니 바꾸지 않아요. `migrations`의 기록(v1~v4)도 이 워커에 남은 기록이라 지우면 배포가 실패해요.
- 비밀 값 바꾸기: `pnpm exec wrangler login` 뒤 `pnpm exec wrangler secret put ADMIN_PASSWORD_HASH`처럼 하나씩 넣거나, Cloudflare 대시보드 → Workers & Pages → blog → Settings → Variables and Secrets에서 바꿔요. 비밀번호를 바꿀 때는 `pnpm admin-secrets`로 새 해시를 만들어요.
- `GITHUB_CONTENT_TOKEN`은 기한(1년)이 있어요. 기한이 지나면 저장이 실패하니, 같은 권한으로 새로 만들어 바꿔 넣어요.
- 배포는 GitHub Actions에 맡겨요. 내 컴퓨터에서 `opennextjs-cloudflare deploy`로 직접 올리면, OpenNext가 `.env.local` 같은 `.env` 파일의 값을 워커 코드에 기본값으로 함께 넣어서 시험용 값(가짜 GitHub 주소 등)이 운영 워커에 실릴 수 있어요.

**버전과 릴리스**

- 버전은 [유의적 버전](https://semver.org/lang/ko/)(주.부.수)을 따라요. 화면·동작을 고치거나 다듬으면 수 버전(1.0.0 → 1.0.1), 기능을 더하면 부 버전(1.0.1 → 1.1.0), 원고 형식처럼 이전과 맞지 않게 바꾸면 주 버전(1.1.0 → 2.0.0)을 올려요.
- 코드를 바꾸는 PR에서 `package.json`의 `version`과 `CHANGELOG.md` 맨 위 항목(`## 1.0.1 — 2026-11-16`)을 함께 올려요. 둘이 다르면 단위 테스트(`src/test/changelog.test.ts`)가 실패해요.
- main에 올라와 배포가 끝나면 `release` 단계가 그 버전의 태그(`v1.0.1`)와 GitHub 릴리스를 만들어요. 제목은 변경 기록의 항목 제목(`1.0.1 — 2026-11-16`), 내용은 그 항목이에요. 토큰은 GitHub가 실행마다 빌려주는 것(`github.token`)을 써서 따로 넣을 값이 없어요.
- 이미 태그가 있는 버전이면 건너뛰어요. 그래서 버전을 올리지 않는 커밋(글쓰기 화면에서 저장한 리뷰 등)은 배포만 하고 릴리스는 만들지 않아요.
- 한 번 붙인 태그는 옮기지 않아요. 고칠 것이 생기면 다음 버전으로 올려요.

**도메인(deokbae.blog)** — 도메인은 호스팅케이알(hosting.kr)에 등록돼 있고, DNS는 Cloudflare가 맡아요(네임서버 `damiete.ns.cloudflare.com`, `lovisa.ns.cloudflare.com`).

- `wrangler.jsonc`의 `routes`로 `deokbae.blog`, `www.deokbae.blog`를 Custom Domain으로 연결해요. 배포할 때 DNS 기록과 HTTPS 인증서가 자동으로 만들어져요.
- `workers.dev` 주소와 버전 미리보기 주소는 닫았어요(`"workers_dev": false`, `"preview_urls": false`). 블로그 주소는 `https://deokbae.blog` 하나예요.
- **속도 제한 규칙:** Cloudflare 대시보드 → deokbae.blog → Security → WAF → Rate limiting rules의 `로그인 시도 제한`. URI Path가 `/api/session`인 요청이 IP마다 10초에 5번을 넘으면 10초 동안 막아요(429). 짧게 몰아친 요청 몇 개가 통과해도 서버의 실패 횟수 제한이 함께 막아요.

**무료 플랜 한도** — 요청 하나에 CPU 10ms, 하루 요청 10만 건, 이미지 변환 한 달 5,000개(넘으면 새 변환만 실패하고 요금은 없어요).

- 방문자 화면(미리 만든 화면)은 한도 안이에요. `open-next.config.ts`의 캐시 가로채기 덕분에 첫 요청도 Next.js 서버를 불러오지 않아요.
- 로그인(scrypt)·저장은 가끔 한도를 넘어요. Cloudflare는 가끔 넘는 요청은 봐주지만, 계속 넘으면 그 요청을 오류 1102로 끊어요. 로그인·저장이 1102로 자주 막히면 **Workers Paid(월 5달러)**로 올리세요. 코드는 고치지 않아도 돼요.
- `src/proxy.ts`는 Node.js 런타임에서 돌고, OpenNext는 이를 "실험 기능"으로 지원해요(빌드할 때 경고가 떠요). 혹시 막혀도 API와 글쓰기 화면이 로그인을 한 번 더 확인해서 잠금은 그대로예요.

**내 컴퓨터에서 Workers처럼 띄워 보기** — `pnpm cf:preview`는 Workers용으로 빌드한 뒤 Cloudflare의 Workers 런타임으로 http://localhost:8787 에 띄워요. `.env.local`을 읽고, 아래 8장의 가짜 GitHub 서버와 함께 쓰면 저장까지 시험할 수 있어요.

## 6. 화면 규칙

- **색:** `globals.css`의 변수(`--crt-*`)만 써요. 형광 초록 한 가지라, 오류·고른 것은 빨강 대신 **반전**(초록 바탕)과 모양(점선 테두리, ▶)으로 알려요.
- **글자:** 갈무리11(Galmuri11). 1단계 24px(`text-big`): 각 화면 제목(h1). 머리글의 블로그 이름 20px(`text-logo`). 2단계 16px(`text-mid`): 구역 제목(h2)과 작품 목록의 글. 3단계 12px(기본): 본문·입력 칸 이름·단추·작품 정보·바닥글. 12px 격자로 그린 글꼴이라 12·24px에서 가장 또렷해요. 굵게·기울임 대신 반전과 밑줄을 써요.
  - 여백·칸 크기는 rem(16px 기준) 그대로라, 글자만 작아지고 누르는 크기(44px)는 그대로예요.
  - 손가락으로 쓰는 기기(`pointer: coarse`)에서 글자를 치는 칸만 16px이에요. iOS 사파리는 16px보다 작은 입력 칸을 누르면 화면을 저절로 확대해서요. 칸 안의 안내 글자(placeholder)와 평점 고르기 칸은 다른 글자처럼 12px이에요.
  - 오프라인 화면의 ASCII 그림은 고정폭 갈무리모노11(`font-pixel-mono`, ASCII 95자만 남긴 2.5KB 판)로 그리고, 그 화면을 열 때만 받아요(`preload: false`).
- **글꼴 파일(`src/app/fonts/`):**
  - 출처: 갈무리(Galmuri) — 저작자 이민서(quiple), SIL Open Font License 1.1, https://github.com/quiple/galmuri (npm `galmuri` 2.40.3). 라이선스 전문은 같은 폴더의 `OFL.txt`예요(글꼴과 함께 둬야 해요).
  - `galmuri11-ko.woff2`(190KB): 원본 `Galmuri11.woff2`(493KB)에서 쓰지 않는 일본어 가나·한자를 덜어 낸 판이에요. 한글 11,172자와 라틴·기호는 남겼어요.
  - 다시 만들 때(fonttools의 `pyftsubset`, 원본은 jsDelivr `npm/galmuri@2.40.3/dist/`):
    ```sh
    pyftsubset Galmuri11.woff2 --unicodes="U+0000-303F,U+3100-318F,U+31A0-31EF,U+3200-33FF,U+4DC0-4DFF,U+A000-F8FF,U+FB00-FF60,U+FFA0-10FFFF" \
      --flavor=woff2 --name-IDs='*' --name-languages='*' --layout-features='*' --notdef-outline --output-file=galmuri11-ko.woff2
    pyftsubset GalmuriMono11.woff2 --unicodes="U+0020-007E" \
      --flavor=woff2 --name-IDs='*' --name-languages='*' --layout-features='*' --notdef-outline --output-file=galmuri-mono11-ascii.woff2
    ```
- **리뷰 이미지:** 올린 파일의 색은 그대로 두고, 화면에서만 SVG 필터(`#crt-phosphor`, `app/layout.tsx`)로 흑백 → 4단계 명암 → 형광 초록으로 바꾸고 주사선을 덮어요. 상자는 늘 2:3이고, 없으면 기본 이미지(그림 액자 픽셀 아이콘 + NO IMAGE)를 보여요. 그림이 오기 전에는 움직이지 않는 스켈레톤을 깔아요.
- **로고:** 플로피 디스크 픽셀 그림(`lib/logo.ts`, 한 줄 평을 "기록해 저장한다"는 뜻). 머리글 로고, 파비콘(`app/icon.svg`), 설치 앱 아이콘, 공유 미리 보기 그림이 모두 같은 그림이고, 그림을 고치면 `pnpm icons`로 다시 만들어요.
- **머리글:** 왼쪽 [로고] 작품 한 줄 평 블로그(처음 화면 링크), 오른쪽 GitHub 아이콘(`deokbae-cinephile/HotTake`, 같은 창에서 열려요. 글자 "GitHub"는 화면 낭독기만 읽어요). 탭 제목·설치 앱 이름·검색엔진의 사이트 이름은 "HotTake"예요.
- **목록 한 편:** [썸네일 2:3 | 제목 ····· 평점 / 연도·감독 또는 작가 이름 / 한 줄 평]. 분류와 글 쓴 날은 보이지 않아요.
  - 리뷰 한 편(`article`)에는 안쪽 여백이 없어요. 썸네일과 글이 "작품 목록" 제목 줄의 양 끝에 맞고, 리뷰 사이는 목록 줄(`li`) 간격 32px(`ul`의 `gap-8`)로만 띄워요.
  - 둘째 줄은 길면 두 줄까지만 보이고 끝을 "…"로 줄여요(`line-clamp-2`, 화면 낭독기는 다 읽어요).
  - 썸네일은 넓은 화면(640px~) 70px, 휴대폰 56px이에요. 평점은 넓은 화면에서 첫째 줄 오른쪽 끝, 휴대폰에서는 이미지 아래 가운데예요(두 자리에 하나씩 그리고 너비에 맞는 하나만 보여요).
  - 목록 위 편수 안내는 "전체 11편 / 현재 10편 표시"처럼 써요(다 보이면 "전체 11편", 거르면 "11편 중 3편").
  - 글쓴이에게는 한 편마다 [수정]·[삭제] 아이콘 단추(44 × 44px, 24px 픽셀 그림)가 있어요. 넓은 화면은 한 줄 평 줄의 오른쪽 끝, 휴대폰은 맨 오른쪽 단추 칸이에요. 이름은 화면에 보이지 않는 "알파 정거장 리뷰 수정"처럼 어느 리뷰인지 넣어요.
- **분류:** 영화·도서 두 가지이고 리뷰 한 편에 하나예요(`lib/categories.ts`). 주소에는 영어 이름으로 적어요(`?category=movie`·`?category=book`). 한글 주소(`?category=영화`)도 같은 분류로 열려요.
- **정렬:** 최신순·평점순. 최신순은 글 쓴 날의 시각까지 봐요(`lib/review.ts`의 `compareLatest`). 시각까지 같으면 제목 가나다순이에요.
- **떠 있는 단추:** 오른쪽 아래에 로그인했을 때 [+](리뷰 추가)가 있고, 내려 읽으면 [맨 위로]가 그 왼쪽에 붙어요. 왼쪽 아래에는 로그인했을 때 [로그아웃]이 있어요(실패하면 단추 위에 `role="alert"` 안내). 글쓰기 화면에서는 [+]를 숨겨요.
- **정보 줄의 가운뎃점:** 항목 사이 " · "의 앞 빈칸은 줄바꿈되지 않는 빈칸(NBSP, `lib/format.ts`의 `joinFacts`)이에요. 휴대폰에서 줄이 넘쳐도 가운뎃점으로 시작하는 줄이 생기지 않아요.
- **공유 미리 보기·검색엔진:** 링크를 붙이면 `public/og.png`가 카드에 보여요. 처음 화면에는 사이트 이름 정보(JSON-LD `WebSite`)를 넣어요(`lib/structured-data.ts`). 사이트맵에는 처음 화면만 있어요.
- **로딩·스켈레톤:** 로딩 UI는 옛 DOS 프로그램처럼 "불러오는 중▮"(깜빡이는 커서)과 칸이 하나씩 차오르는 16칸 막대예요(`role="status"`). 글쓰기 화면을 준비하는 동안(`app/write/loading.tsx`) 글쓰기 모양의 스켈레톤을 그려요. 동작 줄이기(`prefers-reduced-motion`)를 켜면 멈춰요.
- **글쓰기 화면:**
  - 넓은 화면(1024px~)은 [이미지 | 콘텐츠 정보 2열 × 3행] 3칸, 좁은 화면은 이미지 → 콘텐츠 정보 → 단추 차례로 한 칸이에요.
  - 콘텐츠 정보 차례: [분류 | 평점] → 제목 → 파일 이름 → 연도 → 감독 또는 작가 → 한 줄 평. 분류와 평점은 휴대폰에서도 한 줄에 나란히 놓여요.
  - 칸 아래 도움말은 두지 않아요. 틀렸을 때 오류 문구가 원인과 고치는 방법을 알려 줘요(예: 파일 이름은 "영어 소문자, 숫자, 하이픈(-)으로만 적어 주세요. 예: winter-stop").
  - 칸 이름에는 "[필수]" 같은 표시를 두지 않아요. 이미지 말고는 모두 꼭 적어야 하는 칸이라 글자 칸에 `required`만 달고(화면 낭독기가 "필수"라고 알려 줘요), 비워 두고 저장하면 오류 문구가 알려 줘요.
  - 이미지를 고르면 미리보기 자리에 바로 보이고, 위쪽 안내 문구는 띄우지 않아요(고르는 동안만 "이미지를 준비하는 중입니다."가 잠깐 보여요).
  - 단추 줄은 [리뷰 저장] [취소]이고 오른쪽에 붙여 놓아요. 리뷰 추가 화면은 분류 "영화", 평점 5.0이 처음부터 골라져 있고, ▼는 왼쪽 글자 여백(12px)과 같은 간격으로 놓여요.
  - 수정 화면의 파일 이름은 바꿀 수 없어요. "파일 이름: winter-stop.json" 다음 줄에 "(수정할 때는 바꿀 수 없습니다.)"를 보여요.

## 7. 키보드와 접근성

- 목록: Tab으로 검색창·분류·정렬·[더 보기]를 오가요. 방향키는 가로채지 않아서 화면이 평소처럼 스크롤돼요. 검색창은 글자를 치고 Enter(또는 [찾기])로 찾아요.
- 무한 스크롤은 [n편 더 보기] 단추와 함께 써요. 단추로 불러오면(또는 단추에 초점이 있을 때 저절로 불러오면) 새로 나온 첫 리뷰 한 편(`article`)으로 초점이 가요(점선 테두리).
- 폼: 칸마다 보이는 이름, 틀린 칸에 `aria-invalid` + 오류 문구(`aria-describedby`·`aria-errormessage`), 저장할 때 틀린 칸이 있으면 가장 위의 틀린 칸으로 스크롤하고 초점을 옮겨요(따로 "고칠 곳" 목록은 두지 않아요). 칸이 없는 값(글 쓴 날)의 오류는 위쪽 알림(`role="alert"`)으로 보여요.
- 삭제 확인은 네이티브 `<dialog>`(`role="alertdialog"`)이고, 처음 초점은 [취소]예요. 삭제하는 동안은 [취소]·[삭제]를 `disabled`가 아니라 `aria-disabled`로 막아요(초점이 문서 전체로 빠지지 않게). 지운 뒤에는 누른 단추가 사라지므로 한 줄 평 아래 안내로 초점을 옮겨요.
- 본문 바로가기 링크, 문서 언어(`lang="ko"`), 44px 누르는 크기, 명도 대비(초록 글자 10:1 이상)를 지켜요. axe 검사를 통과해도 KWCAG를 다 지킨 것은 아니라서 새 화면은 직접 점검해요.

## 8. 테스트

| 명령 | 내용 |
|---|---|
| `pnpm lint` | oxlint(접근성 jsx-a11y·React 훅·Next.js 규칙 포함, `.oxlintrc.json`) |
| `pnpm typecheck` | Next.js 경로 타입 만들기 + TypeScript 7 타입 검사 |
| `pnpm test` | 단위 테스트. 원고 형식(content.test.ts), 버전과 변경 기록(changelog.test.ts), 로그인 표·비밀번호, proxy, API, 저장 로직, 화면 조각 |
| `pnpm e2e:build` → `pnpm e2e` | 시험용 원고로 빌드해 진짜 브라우저로 확인. 가짜 GitHub 서버(`e2e/mock-github.mjs`)를 함께 띄워 로그인 → 추가 → 커밋 → 수정 → 삭제까지 시험해요. 가짜 서버의 `POST /__delay?ms=`로 답을 늦춰 로딩 화면도 시험해요 |

다른 프로그램이 E2E 포트(3100·3101)를 쓰고 있으면 Playwright가 그 서버를 블로그로 잘못 쓸 수 있어요. 그럴 때는 `E2E_PORT=3760 MOCK_GITHUB_PORT=3761 pnpm e2e`처럼 비어 있는 포트로 돌려요.

내 컴퓨터에서 글쓰기 화면을 써 보고 싶으면, 가짜 GitHub 서버를 띄우고(`node e2e/mock-github.mjs`) `.env.local`에 `GITHUB_API_URL=http://127.0.0.1:3101`과 `GITHUB_CONTENT_TOKEN=e2e-token`을 넣으면 진짜 저장소를 건드리지 않고 저장해 볼 수 있어요. `pnpm dev`와 `pnpm cf:preview` 모두 같은 방법으로 돼요.

CI(GitHub Actions)의 검사(`check`)는 Node.js 서버(`pnpm build` → `pnpm start`)로 하고, Workers용 빌드는 검사가 통과한 뒤 배포(`deploy`) 단계에서 해요. 검사나 Workers용 빌드가 실패하면 배포되지 않고 이전 버전이 그대로 남아요.
