# Pep/8 Lab

설치 없이 브라우저에서 쓰는 Pep/8 어셈블러 · 시뮬레이터 · 디버거입니다.

**사이트:** https://pep8-lab.pages.dev/

- 소스를 Assemble해서 Object Code와 Listing, 심볼 테이블을 만듭니다.
- 공식 Pep/8 운영체제를 브라우저에서 어셈블해 ROM에 올리고, DECI · DECO · STRO 같은 입출력도 실제 OS 코드로 실행합니다.
- Single Step, 중단점, Trace Traps, 메모리 덤프, 실행 기록으로 한 단계씩 따라갈 수 있습니다.
- 어셈블러와 CPU는 공식 Pep/8 C++ 소스(`asm.cpp`, `sim.cpp` 등)를 자바스크립트로 옮겨, 오류 메시지 · Listing 형식 · 플래그 계산까지 공식 프로그램과 같게 동작합니다.

## 구조

빌드 단계가 없는 정적 사이트입니다. 폴더를 그대로 웹 서버에 올리면 됩니다.

| 파일 | 역할 |
|---|---|
| `engine.js` | 어셈블러, Object Code 형식, Listing, CPU 시뮬레이터 |
| `session.js` | 실행 · 디버깅 제어 (Run, Single Step, Resume, 중단점, 로더) |
| `app.js`, `index.html`, `style.css` | 화면 |
| `layout.js`, `layout.css`, `editor.js` | 패널 크기 조절, 글자 크기, 편집기 탭 |
| `examples.js` | 예제 프로그램 |
| `vendor/pep8os.pep` | 공식 Pep/8 운영체제 (원본 그대로) |

로컬에서 실행하려면 ES 모듈 때문에 웹 서버가 필요합니다.

```bash
python3 -m http.server 8000
```

## 공식 동작 검사

공식 Pep/8과 같은 결과가 나오는지 55가지 경우를 확인합니다.

```bash
node tests/official-check.mjs
```

## 웹 전용 한도

무한 루프가 브라우저를 멈추지 않도록 Run · Resume은 100만 명령마다, 트랩 Single Step은 100만 명령에서 일시정지합니다. 다시 누르면 이어집니다. 출력은 20만 자에서 멈춥니다.

## 오류 제보

사이트의 Help → 오류 제보 · 피드백, 또는 이 저장소의 Issues로 알려주세요.

## 라이선스

GNU GPL v3 또는 그 이후 버전(GPL-3.0-or-later). 전문은 [`LICENSE`](LICENSE)에 있습니다.

이 프로젝트는 J. Stanley Warford와 기여자들의 [Pep/8](https://github.com/StanWarford/pep8)(Copyright © 2009 J. Stanley Warford, Pepperdine University)을 바탕으로 한 수정본이며, 수정 내역은 [`vendor/NOTICE.txt`](vendor/NOTICE.txt)에 있습니다. 공식 Pep/8 릴리스가 아닙니다.

Copyright © 2026 최규하 · 숭실대학교 글로벌미디어학부
