# DuoSync Translate (듀오싱크 번역기)

실시간 양방향 음성 번역 애플리케이션입니다. 한국어와 영어를 포함한 다국어 대화를 실시간으로 번역하여 소통할 수 있습니다.

## 주요 기능

- **실시간 음성 인식 및 번역**: 말하는 즉시 텍스트로 변환되고 상대방 언어로 번역됩니다.
- **무전기 모드 (Walkie-Talkie)**: 마이크 버튼을 눌러 대화하며, 상대방과 겹치지 않게 명확한 소통이 가능합니다.
- **오디오 비주얼라이저**: 음성 입력 시 화면 중앙에 역동적인 이퀄라이저 효과를 제공합니다.
- **자동 언어 감지**: 한국어, 영어, 일본어, 중국어를 지원하며 자동으로 언어를 감지합니다.
- **반응형 디자인**: 모바일과 데스크탑 모두에서 최적화된 UI를 제공합니다.

## 기술 스택

- React
- TypeScript
- Vite
- Tailwind CSS
- Web Speech API (음성 인식)
- MyMemory Translation API (번역)

## 설치 및 실행 방법

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build
```

## DeepL API 설정

- 개발 중에는 앱 우측 상단 `Settings`에서 DeepL API 키를 입력하면 로컬 저장소에 저장되며, Vite 개발 서버(`/deepl-free|pro`) 프록시를 통해 바로 호출됩니다.
- 운영 환경(Vercel 등)에서는 `/api/deepl` 서버리스 함수가 DeepL 요청을 중계합니다. 사용자 입력 키가 없다면 `DEEPL_API_KEY` 환경 변수를 설정해 기본 키를 사용할 수 있습니다.
- 무료 키(`:fx`로 끝남)와 Pro 키 모두 지원하며, 호출 실패 시 자동으로 MyMemory 번역으로 폴백됩니다.

---

## Vercel 배포 가이드 (Deployment Guide)

이 프로젝트를 Vercel에 배포하는 방법입니다.

### 1. GitHub 저장소 생성 및 코드 푸시

먼저 코드를 GitHub에 올려야 합니다.

1.  [GitHub](https://github.com)에 로그인하고 **New Repository**를 클릭하여 새 저장소를 만듭니다.
2.  터미널에서 다음 명령어를 입력하여 코드를 푸시합니다:

```bash
# git 초기화 (이미 되어있다면 생략 가능)
git init

# 파일 추가 및 커밋
git add .
git commit -m "Initial commit"

# 원격 저장소 연결 (URL은 본인의 저장소 주소로 변경)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 푸시
git push -u origin main
```

### 2. Vercel 프로젝트 생성

1.  [Vercel](https://vercel.com)에 로그인합니다 (GitHub 계정으로 로그인 추천).
2.  대시보드에서 **Add New...** > **Project**를 클릭합니다.
3.  **Import Git Repository**에서 방금 올린 GitHub 저장소를 찾아 **Import**를 클릭합니다.

### 3. 배포 설정 (Configure Project)

Vite 프로젝트는 Vercel이 자동으로 설정을 감지하므로 별도의 설정 변경이 거의 필요 없습니다.

-   **Framework Preset**: `Vite` (자동 감지됨)
-   **Root Directory**: `./` (기본값)
-   **Build Command**: `npm run build` (자동 감지됨)
-   **Output Directory**: `dist` (자동 감지됨)
-   **Environment Variables**: (필요한 경우 설정, 현재 프로젝트는 API Key가 필요 없는 무료 API를 사용하므로 설정 불필요)

### 4. 배포 (Deploy)

1.  **Deploy** 버튼을 클릭합니다.
2.  배포가 완료될 때까지 잠시 기다립니다 (약 1분 소요).
3.  배포가 완료되면 축하 메시지와 함께 **Visit** 버튼이 나타납니다.
4.  생성된 URL을 통해 전 세계 어디서든 앱에 접속할 수 있습니다!

### ⚠️ 주의사항

-   **마이크 권한**: 배포된 사이트(`https://...`)는 HTTPS가 적용되므로 마이크 권한 요청이 정상적으로 작동합니다. (HTTP에서는 작동하지 않음)
-   **브라우저 호환성**: Web Speech API는 Chrome, Edge, Safari 등 최신 브라우저에서 가장 잘 작동합니다.

## 디버그 모드

### 상태 표시 (DEBUG OVERLAY)

메인페이지 상단 왼쪽에 있는 상태 표시(DEBUG OVERLAY)는 현재 주석 처리되어 화면에 표시되지 않습니다.

**위치**: `src/App.tsx` 파일 내부

**표시 내용** (주석 처리됨):
- Status: 현재 음성 인식 상태 (Listening/Idle)
- Vol: 현재 음성 볼륨 레벨
- DeepL: 번역 엔진 상태 (Serverless)

**활성화 방법**:
`src/App.tsx` 파일에서 해당 부분의 주석을 제거하면 다시 표시됩니다.

```tsx
{/* DEBUG OVERLAY - 주석 처리됨 (화면에 표시되지 않음) */}
{/* 
<div className="absolute top-0 left-0 z-50 p-2 bg-black/50 text-[10px] pointer-events-none">
  <p>Status: {activeMic ? `Listening (${activeMic} - ${currentLanguage})` : 'Idle'}</p>
  <p>Vol: {volume.toFixed(1)}</p>
  <p>DeepL: Serverless</p>
</div>
*/}
```
