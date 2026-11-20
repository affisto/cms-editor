# npm 릴리스 가이드

`cms-editor-core`, `cms-editor-react`, `cms-editor-form`은 Changesets의 `fixed` 그룹으로 관리합니다. 하나의 패키지에 배포가 필요하면 세 패키지에 같은 버전을 적용합니다. 각 패키지의 `package.json`이 현재 버전을 기록하고, `.changeset/`의 Markdown 파일이 다음 릴리스의 변경 내용을 기록합니다. 세 패키지의 `0.1.0`은 npm에 배포되어 있습니다. [Changesets 고정 버전 그룹](https://github.com/changesets/changesets/blob/main/docs/guide/fixed-packages.md)

## 버전 선택

| 변경                                             | Changeset | 다음 버전 예                             |
| ------------------------------------------------ | --------- | ---------------------------------------- |
| 호환되는 버그 수정, 배포 메타데이터 수정         | `patch`   | `0.1.0` → `0.1.1`                        |
| 호환되는 기능 추가                               | `minor`   | `0.1.0` → `0.2.0`                        |
| `1.0.0` 전 공개 API의 호환성 중단                | `minor`   | `0.1.0` → `0.2.0`                        |
| 첫 안정 API 릴리스 또는 `1.0.0` 이후 호환성 중단 | `major`   | `0.9.0` → `1.0.0` 또는 `1.2.3` → `2.0.0` |

호환성이 깨지는 경우 Changeset 본문에 영향받는 API와 마이그레이션 방법을 적습니다. 같은 릴리스에 여러 변경이 포함되면 가장 큰 버전 증가를 그룹 전체에 적용합니다.

## 변경을 npm에 배포하기

1. 공개 패키지를 바꾸는 PR에서 `npm run changeset`을 실행합니다. 변경된 패키지를 고르고 버전 증가 종류와 사용자에게 보일 변경 내용을 적습니다. 배포할 필요가 없는 패키지 내부 작업은 `npm run changeset -- --empty`로 의도를 기록합니다.
2. 생성된 `.changeset/*.md`와 코드 변경을 같은 PR에 넣습니다. CI가 release intent, 패키지 빌드, lint, 타입 검사, 단위 테스트, 격리된 tarball 설치, Chromium E2E를 실행합니다.
3. PR을 `main`에 병합합니다. `Release`가 동일한 커밋에서 CI를 실행합니다. 배포가 활성화되어 있고 릴리스할 Changeset이 남아 있으면 `changeset-release/main`의 버전 PR을 생성하거나 갱신합니다. `npm run version:packages`가 패키지 버전, 내부 의존성 범위, changelog, `package-lock.json`을 함께 갱신합니다.
4. GitHub가 버전 PR에 워크플로 승인 배너를 표시하면 저장소 쓰기 권한이 있는 사람이 **Approve workflows to run**을 선택합니다. `CI`의 `Verify`가 통과하면 버전, 내부 의존성 범위와 changelog를 검토하고 PR을 병합합니다. `Release`가 병합 커밋을 다시 검증하고 npm에 배포합니다. 성공한 패키지의 Git 태그와 GitHub Release도 생성합니다. [Changesets Action v1](https://github.com/changesets/action/tree/maintenance/v1)

## 배포 활성화하기

1. GitHub 저장소의 **Settings → Actions → General → Workflow permissions**에서 **Allow GitHub Actions to create and approve pull requests**를 켭니다. 버전 PR 생성에 필요한 설정입니다.
2. `main`의 브랜치 보호 규칙에서 PR을 통한 병합과 GitHub Actions의 `Verify` 상태 검사를 필수로 설정합니다. 버전 PR을 기본 `GITHUB_TOKEN`으로 열거나 갱신하면 GitHub는 `pull_request` CI에 실행 승인을 요청합니다. `CI`의 수동 실행은 PR의 필수 상태 검사와 별도로 확인할 때 사용합니다. [GitHub Actions의 `GITHUB_TOKEN` 동작](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow), [필수 상태 검사](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)
3. npm에서 세 패키지 각각의 **Settings → Trusted publishing → GitHub Actions**를 열고 다음 값을 저장합니다. 허용 작업에 `npm publish`를 선택합니다. 새 설정이 만료되기 전에 2일 이내에 첫 배포를 완료합니다. [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/)

   | npm 설정             | 값            |
   | -------------------- | ------------- |
   | Organization or user | `affisto`     |
   | Repository           | `cms-editor`  |
   | Workflow filename    | `release.yml` |
   | Environment          | 비워 둠       |
   | Allowed actions      | `npm publish` |

4. GitHub의 **Settings → Secrets and variables → Actions → Variables**에 `NPM_RELEASE_ENABLED=true`를 추가합니다. **Actions → Release → Run workflow**에서 `main`을 선택하면 다음 push를 기다리지 않고 버전 PR을 열 수 있습니다. `release.yml`은 GitHub-hosted runner에서 npm 11.5.1과 OIDC를 사용합니다.

버전 PR의 CI를 승인 없이 시작하려면 `affisto/cms-editor`의 **Contents**와 **Pull requests**에 읽기 및 쓰기 권한이 있는 GitHub fine-grained PAT를 `RELEASE_PR_TOKEN` Actions secret에 추가합니다. 이 선택 설정은 GitHub 인증에만 사용합니다. npm 배포는 계속 OIDC로 인증합니다. [GitHub fine-grained PAT](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)

## 검증 및 재시도하기

로컬에서 `npm ci`와 `npm run test:packages`로 배포 파일을 확인합니다. tarball을 임시 프로젝트에 설치해 패키지 엔트리와 문서를 검사합니다. 버전 변경 결과는 깨끗한 임시 체크아웃에서 `npm run version:packages`를 실행해 볼 수 있습니다. 두 확인의 범위는 로컬 파일과 버전 변경이며, OIDC 인증과 실제 npm 배포는 GitHub의 성공한 `Release` 실행에서 확인합니다.

일부 패키지만 배포된 경우 실패한 `Release` 실행의 로그에서 원인을 해결하고 같은 실행을 재시도합니다. Changesets는 npm에 이미 있는 버전을 건너뛰고 해당 커밋에 남은 버전을 배포합니다. `npm view <패키지>@<버전> version`으로 세 패키지의 버전을 확인합니다. npm에는 버전이 있고 Git 태그 또는 GitHub Release가 누락됐다면, 배포한 커밋과 일치하는지 확인하고 누락된 태그나 릴리스만 복구합니다.
