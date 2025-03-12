# Simple Mock API

## 소개

Simple Mock API는 개발 및 테스트 환경에서 사용할 수 있는 가벼운 모의 API 서버입니다. YAML 구성 파일을 통해 다양한 엔드포인트와 응답을 정의하고, 실제 API를 시뮬레이션할 수 있습니다.

주요 기능:

- 확률 기반 응답 처리 (성공/실패 시나리오 테스트)
- 지연 시간 시뮬레이션
- Handlebars 템플릿 지원 (동적 응답 생성)
- 실시간 대시보드로 요청 및 응답 모니터링
- 구성 파일 변경 감지 및 자동 다시 로드

## 설치 방법

### 필수 조건

- Node.js 20.x 이상
- npm 또는 yarn

### 설치 단계

1. 저장소 복제:

```bash
git clone https://github.com/yourusername/simple-mock-api.git
cd simple-mock-api
```

2. 의존성 설치:

```bash
npm install
```

## 사용 방법

### 서버 시작

기본 설정으로 서버 시작:

```bash
node index.js start
```

사용자 지정 포트 및 구성 파일로 시작:

```bash
node index.js start -p 8080 -c custom-config.yml
```

### 엔드포인트 구성

모든 API 엔드포인트는 `mock-api.yml` 파일에 정의됩니다. 변경 사항은 자동으로 감지되어 서버를 다시 시작할 필요 없이 즉시 적용됩니다.

### 대시보드 액세스

서버가 실행되면 브라우저에서 다음 URL로 대시보드에 액세스할 수 있습니다:

```
http://localhost:3000
```

대시보드에서는 다음 기능을 사용할 수 있습니다:

- 등록된 모든 엔드포인트 목록 확인
- API 요청과 응답 테스트
- 실시간 로그 확인
- 구성 수동 다시 로드

## 기능 설명

### 표준 엔드포인트

기본적인 엔드포인트 구성 예시:

```yaml
endpoints:
  - path: /api/users
    method: GET
    statusCode: 200
    delay: 50 # 밀리초 단위 지연
    response:
      users:
        - id: 1
          name: "홍길동"
        - id: 2
          name: "김철수"
```

### 확률 기반 응답

특정 확률로 성공 또는 실패 응답을 반환하는 엔드포인트 구성:

```yaml
endpoints:
  - path: /api/random/success
    method: GET
    probability: 70 # 70% 성공률
    responses:
      success:
        statusCode: 200
        delay: 100
        response:
          status: "success"
          message: "요청이 성공적으로 처리되었습니다"
          timestamp: "{{now}}"
      failure:
        statusCode: 500
        delay: 100
        response:
          status: "error"
          message: "서버 오류가 발생했습니다"
          timestamp: "{{now}}"
```

### 템플릿 사용

Handlebars 템플릿을 사용한 동적 응답 생성:

```yaml
endpoints:
  - path: /api/users/:id
    method: GET
    statusCode: 200
    response:
      id: "{{params.id}}"
      name: "사용자 {{params.id}}"
      queryParam: "{{query.filter}}"
      timestamp: "{{now}}"
      random: "{{randomId}}"
```

사용 가능한 템플릿 변수:

- `{{params}}`: URL 매개변수 (예: /users/:id의 id)
- `{{query}}`: 쿼리 매개변수 (예: ?filter=active의 filter)
- `{{body}}`: POST/PUT 요청의 본문 데이터
- `{{now}}`: 현재 시간 (ISO 형식)
- `{{randomId}}`: 임의 숫자 ID

## 구성 파일 형식

`mock-api.yml` 파일은 다음과 같은 구조를 가집니다:

```yaml
endpoints:
  - path: /api/endpoint1 # 엔드포인트 경로 (필수)
    method: GET # HTTP 메소드 (필수, 소문자로 변환됨)
    statusCode: 200 # 응답 상태 코드 (선택, 기본값: 200)
    delay: 0 # 지연 시간 (밀리초, 선택, 기본값: 0)
    response: { ... } # 응답 본문 (선택)

  - path: /api/endpoint2
    method: POST
    probability: 80 # 성공 확률 (0-100)
    responses: # 확률 기반 응답 (probability가 있을 때 필요)
      success: # 성공 응답 구성
        statusCode: 200
        delay: 100
        response: { ... }
      failure: # 실패 응답 구성
        statusCode: 400
        delay: 50
        response: { ... }
```

## 예제 시나리오

### 결제 처리 시뮬레이션

80% 성공률로 결제 처리를 시뮬레이션하는 엔드포인트:

```yaml
- path: /api/payment/process
  method: POST
  probability: 80
  responses:
    success:
      statusCode: 200
      delay: 500
      response:
        status: "success"
        transactionId: "tx-{{randomId}}"
        message: "결제가 성공적으로 처리되었습니다"
        timestamp: "{{now}}"
    failure:
      statusCode: 400
      delay: 300
      response:
        status: "failed"
        error: "payment_failed"
        message: "결제 처리 중 오류가 발생했습니다"
        timestamp: "{{now}}"
```

### 네트워크 지연 시뮬레이션

50% 확률로 빠르거나 느린 응답을 제공하는 엔드포인트:

```yaml
- path: /api/network/test
  method: GET
  probability: 50
  responses:
    success:
      statusCode: 200
      delay: 10
      response:
        status: "success"
        message: "빠른 응답"
        responseTime: "10ms"
    failure:
      statusCode: 200
      delay: 3000
      response:
        status: "success"
        message: "느린 응답"
        responseTime: "3000ms"
```

## 문제 해결

### 로그 확인

서버 실행 중에 발생하는 문제를 진단하려면 콘솔 로그와 대시보드의 로그 패널을 확인하세요.

### 일반적인 문제

1. **구성 파일 오류**: YAML 구문이 올바른지 확인하세요.
2. **템플릿 오류**: Handlebars 템플릿 구문이 올바른지, 쌍따옴표로 이스케이프가 필요한지 확인하세요.
3. **포트 충돌**: 다른 서비스가 3000 포트를 사용 중이면 `-p` 옵션으로 다른 포트를 지정하세요.

### 템플릿 디버깅

템플릿 변수가 올바르게 처리되지 않을 경우:

1. 변수 이름이 정확한지 확인하세요 (params, query, body 등)
2. 콘솔 로그에서 전체 컨텍스트 정보를 확인하세요
3. 중첩된 객체의 경우 점 표기법을 사용하세요 (예: `{{body.user.name}}`)

## 기여 방법

문제점이나 개선 제안은 GitHub 이슈 트래커에 등록해주세요. 풀 리퀘스트도 환영합니다!

## 라이선스

MIT 라이선스에 따라 배포됩니다. 자세한 내용은 LICENSE 파일을 참조하세요.
