# PC 실행 파일 — 2026-11-11 · v1.1.0

## 사용자 실행

`releases/ToiletRush.exe`를 더블클릭하면 기본 브라우저에서 게임이 열립니다. 게임과 모든 필수 리소스가 EXE 안에 포함되어 있어 이 파일 하나만 복사해 사용할 수 있습니다. 인터넷 연결, Node.js 설치, 관리자 권한이 필요하지 않습니다. Windows의 .NET Framework 4.x와 최신 PC 브라우저를 사용합니다.

이는 오프라인 웹게임 실행기입니다. 브라우저 엔진 자체를 EXE에 포함하는 대용량 네이티브 패키지는 아닙니다. 실행 주소는 이 PC에서만 접근하는 `http://127.0.0.1:41731/`이며, 고정된 주소를 사용해 같은 브라우저에서 최고 기록과 사운드 설정을 유지합니다.

- 게임 다시 열기: EXE를 다시 실행하거나 알림 영역의 게임 아이콘을 더블클릭합니다.
- 완전히 종료: 알림 영역의 게임 아이콘 우클릭 → **게임 완전히 종료**.
- 이미 다른 프로그램이 같은 포트를 쓰는 경우 해당 프로그램을 닫거나 실행기에 `--port=41732`처럼 다른 포트를 지정할 수 있습니다. 포트를 바꾸면 브라우저 기록 저장 공간도 달라집니다.
- `ToiletRush.html`은 CSS·JavaScript·아이콘을 모두 포함한 단일 HTML 대안입니다.
- EXE에는 유료 코드 서명을 포함하지 않았습니다.

## 빌드

Windows에서 Node.js 18 이상으로 다음 명령을 실행합니다. 별도 npm 패키지는 설치하지 않습니다.

```sh
npm run build:pc
```

Windows에 포함된 .NET Framework C# 컴파일러로 GUI 실행 파일을 만듭니다. ZIP은 Node.js 내장 DEFLATE로 작성합니다. 결과는 `releases/`에 생성됩니다.

| 파일 | 내용 |
| --- | --- |
| `ToiletRush.exe` | 게임이 내장된 Windows 실행 파일 |
| `ToiletRush.html` | 독립 실행용 단일 HTML |
| `ToiletRush-v1.1.0-win.zip` | EXE·HTML·한국어 사용방법 묶음 |

## 실제 검증

- EXE의 `--self-test` 실행 종료 코드 0: 내장 게임 리소스 확인.
- EXE를 `--headless`로 실제 실행하고 `/_rush/health`에서 HTTP 200과 버전 `1.1.0` 확인.
- 이 EXE가 제공하는 단일 HTML에서 Chromium 브라우저 통합 검사 **22/22 통과**, 콘솔 error/warn 없음. 일반 경로와 질주 경로 모두 클리어했습니다.
- `npm test` 코어 회귀 **17/17 통과**, `npm run check` 통과.
- Python 표준 `zipfile`로 ZIP CRC·파일 목록·원본과 바이트 일치를 검증했습니다.
- EXE의 Windows GUI PE 형식을 확인했습니다.
- EXE가 HTTP로 제공하는 바이트가 배포용 단일 HTML과 완전히 일치함을 검증했습니다. HEAD 응답은 본문 없이 올바른 Content-Length를 반환했습니다.
- 브라우저 실행 결과: [pc-browser-checks.txt](pc-browser-checks.txt).

검증용 EXE 프로세스와 브라우저 탭은 종료했습니다. 기본 브라우저 자동 열기와 알림 영역 메뉴의 실제 클릭은 이 검증에서 실행하지 않았으며, EXE의 로컬 서버와 실제 게임 화면·전체 게임 루프를 검증했습니다. HTML의 `file://` 직접 열기와 실기기 음질 평가는 별도 실행하지 않았습니다.
