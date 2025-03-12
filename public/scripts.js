const socket = io();
let endpoints = []; // 엔드포인트 저장
const baseUrl = window.location.origin;

// DOM 요소
const statusIndicator = document.getElementById("status-indicator");
const statusText = document.getElementById("status-text");
const endpointTable = document.getElementById("endpoint-table");
const logOutput = document.getElementById("log-output");
const endpointDetail = document.getElementById("endpoint-detail");
const detailTitle = document.getElementById("detail-title");
const responsePreview = document.getElementById("response-preview");
const testUrl = document.getElementById("test-url");
const paramFields = document.getElementById("param-fields");
const testBody = document.getElementById("test-body");
const testResult = document.getElementById("test-result");
const testResponse = document.getElementById("test-response");
const testStatus = document.getElementById("test-status");
const testTime = document.getElementById("test-time");
const reloadConfigBtn = document.getElementById("reload-config");
const clearLogsBtn = document.getElementById("clear-logs");
const endpointNavList = document.getElementById("endpoint-nav-list");
const serverUrl = document.getElementById("server-url");

// 서버 URL 표시
serverUrl.textContent = baseUrl;

// 소켓 연결 관리
socket.on("connect", () => {
  updateConnectionStatus(true);
});

socket.on("disconnect", () => {
  updateConnectionStatus(false);
});

// 연결 상태 업데이트
function updateConnectionStatus(isConnected) {
  statusIndicator.className = isConnected ? "connected" : "disconnected";
  statusText.textContent = isConnected ? "연결됨" : "연결 끊김";
}

// 엔드포인트 데이터 수신 및 화면 업데이트
socket.on("endpointUpdate", (data) => {
  endpoints = data;
  renderEndpointTable();
  renderEndpointNav();
});

// 로그 수신
socket.on("log", (log) => {
  const timestamp = new Date().toLocaleTimeString();
  logOutput.textContent += `${timestamp} - ${log}\n`;
  logOutput.scrollTop = logOutput.scrollHeight;
});

// 엔드포인트 테이블 렌더링
function renderEndpointTable() {
  const tbody = endpointTable.querySelector("tbody");
  tbody.innerHTML = "";

  endpoints.forEach((endpoint, index) => {
    const row = document.createElement("tr");

    // 메서드 셀
    const methodCell = document.createElement("td");
    const methodSpan = document.createElement("span");
    methodSpan.className = `method method-${endpoint.method.toLowerCase()}`;
    methodSpan.textContent = endpoint.method;
    methodCell.appendChild(methodSpan);

    // 경로 셀
    const pathCell = document.createElement("td");
    pathCell.textContent = endpoint.path;

    // 상태 코드 셀
    const statusCell = document.createElement("td");
    if (endpoint.probability !== undefined && endpoint.responses) {
      statusCell.textContent = `${endpoint.responses.success.status}/${endpoint.responses.failure.status}`;
      // 확률 표시 추가
      const probabilitySpan = document.createElement("span");
      probabilitySpan.className = "probability-badge";
      probabilitySpan.textContent = `${endpoint.probability}%`;
      probabilitySpan.title = `성공 확률: ${endpoint.probability}%`;
      statusCell.appendChild(document.createElement("br"));
      statusCell.appendChild(probabilitySpan);
    } else {
      statusCell.textContent = endpoint.status;
    }

    // 지연 셀
    const delayCell = document.createElement("td");
    if (endpoint.probability !== undefined && endpoint.responses) {
      delayCell.textContent = `${endpoint.responses.success.delay || 0}/${
        endpoint.responses.failure.delay || 0
      }`;
    } else {
      delayCell.textContent = endpoint.delay || "0";
    }

    // 작업 셀
    const actionCell = document.createElement("td");
    const viewBtn = document.createElement("button");
    viewBtn.className = "btn small";
    viewBtn.textContent = "상세보기";
    viewBtn.addEventListener("click", () => showEndpointDetail(index));
    actionCell.appendChild(viewBtn);

    // 행에 셀 추가
    row.appendChild(methodCell);
    row.appendChild(pathCell);
    row.appendChild(statusCell);
    row.appendChild(delayCell);
    row.appendChild(actionCell);

    tbody.appendChild(row);
  });
}

// 엔드포인트 탐색 렌더링
function renderEndpointNav() {
  endpointNavList.innerHTML = "";

  // 중복 제거를 위한 경로 집합
  const uniquePaths = new Set();
  endpoints.forEach((ep) => {
    const basePath = ep.path.split("/")[1]; // e.g. /api/users -> api
    uniquePaths.add(basePath);
  });

  // 각 그룹에 대한 항목 생성
  uniquePaths.forEach((path) => {
    const li = document.createElement("li");
    li.textContent = path || "root";
    li.addEventListener("click", () => filterEndpointsByPath(path));
    endpointNavList.appendChild(li);
  });
}

// 경로별 엔드포인트 필터링
function filterEndpointsByPath(path) {
  const tbody = endpointTable.querySelector("tbody");
  const rows = tbody.querySelectorAll("tr");

  rows.forEach((row, index) => {
    const endpointPath = endpoints[index].path;
    const basePath = endpointPath.split("/")[1];

    if (path === basePath || path === "all") {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });

  // 활성 탐색 항목 업데이트
  const navItems = endpointNavList.querySelectorAll("li");
  navItems.forEach((item) => {
    if (item.textContent === path) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

// 엔드포인트 세부 정보 표시
function showEndpointDetail(index) {
  const endpoint = endpoints[index];

  // 제목 업데이트
  detailTitle.textContent = `${endpoint.method} ${endpoint.path}`;

  // 응답 미리보기 업데이트
  if (endpoint.probability !== undefined && endpoint.responses) {
    // 확률 기반 응답인 경우
    const responseData = {
      probability: `${endpoint.probability}% 확률로 성공`,
      success: {
        status: endpoint.responses.success.status,
        delay: endpoint.responses.success.delay || 0,
        response: endpoint.responses.success.response,
      },
      failure: {
        status: endpoint.responses.failure.status,
        delay: endpoint.responses.failure.delay || 0,
        response: endpoint.responses.failure.response,
      },
    };

    // HTML 형식으로 표시
    const probabilityContainer = document.createElement("div");
    probabilityContainer.className = "probability-container";

    const probabilityHeader = document.createElement("div");
    probabilityHeader.innerHTML = `<strong>확률 기반 응답:</strong> ${endpoint.probability}% 확률로 성공`;

    const probabilityBar = document.createElement("div");
    probabilityBar.className = "probability-bar";

    const probabilityFill = document.createElement("div");
    probabilityFill.className = "probability-fill";
    probabilityFill.style.width = `${endpoint.probability}%`;

    probabilityBar.appendChild(probabilityFill);

    probabilityContainer.appendChild(probabilityHeader);
    probabilityContainer.appendChild(probabilityBar);

    responsePreview.innerHTML = "";
    responsePreview.appendChild(probabilityContainer);

    // 응답 탭
    const responseTabs = document.createElement("div");
    responseTabs.className = "response-tabs";

    const successTab = document.createElement("div");
    successTab.className = "response-tab success active";
    successTab.textContent = "성공 응답";
    successTab.dataset.type = "success";

    const failureTab = document.createElement("div");
    failureTab.className = "response-tab failure";
    failureTab.textContent = "실패 응답";
    failureTab.dataset.type = "failure";

    responseTabs.appendChild(successTab);
    responseTabs.appendChild(failureTab);

    responsePreview.appendChild(responseTabs);

    // 응답 내용
    const responseContent = document.createElement("pre");
    responseContent.className = "response-content";
    responseContent.textContent = JSON.stringify(
      endpoint.responses.success.response,
      null,
      2
    );

    responsePreview.appendChild(responseContent);

    // 탭 클릭 이벤트
    responseTabs.addEventListener("click", (e) => {
      if (e.target.classList.contains("response-tab")) {
        const type = e.target.dataset.type;

        // 활성 탭 변경
        responseTabs.querySelectorAll(".response-tab").forEach((tab) => {
          tab.classList.remove("active");
        });
        e.target.classList.add("active");

        // 응답 내용 변경
        responseContent.textContent = JSON.stringify(
          type === "success"
            ? endpoint.responses.success.response
            : endpoint.responses.failure.response,
          null,
          2
        );
      }
    });
  } else {
    // 일반 응답인 경우
    responsePreview.innerHTML = "";
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(endpoint.response, null, 2);
    responsePreview.appendChild(pre);
  }

  // 테스트 URL 업데이트
  testUrl.value = `${baseUrl}${endpoint.path}`;

  // 파라미터 폼 업데이트
  updateParamFields(endpoint.path);

  // 본문 폼 가시성 설정
  const bodyForm = document.getElementById("body-form");
  bodyForm.style.display = ["POST", "PUT", "PATCH"].includes(endpoint.method)
    ? "block"
    : "none";

  // 테스트 결과 초기화
  testResult.classList.add("hidden");

  // 세부 정보 보이기
  endpointDetail.classList.remove("hidden");
}

// 경로에서 파라미터 추출 및 필드 업데이트
function updateParamFields(path) {
  paramFields.innerHTML = "";

  // 경로 파라미터 검색 (예: /api/users/:id)
  const pathParams = path.match(/:[a-zA-Z0-9_]+/g) || [];

  if (pathParams.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.textContent = "파라미터 없음";
    paramFields.appendChild(emptyMsg);
    return;
  }

  // 각 파라미터에 대한 입력 필드 추가
  pathParams.forEach((param) => {
    const paramName = param.substring(1); // ':id' -> 'id'

    const fieldDiv = document.createElement("div");
    fieldDiv.className = "param-field";

    const label = document.createElement("label");
    label.textContent = paramName;

    const input = document.createElement("input");
    input.type = "text";
    input.dataset.param = paramName;
    input.placeholder = paramName;

    fieldDiv.appendChild(label);
    fieldDiv.appendChild(input);
    paramFields.appendChild(fieldDiv);
  });
}

// 탭 변경 처리
document.querySelectorAll(".tab-btn").forEach((button) => {
  button.addEventListener("click", () => {
    // 활성 탭 버튼 설정
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    button.classList.add("active");

    // 활성 탭 콘텐츠 전환
    const tabId = button.dataset.tab;
    document.querySelectorAll(".tab-content").forEach((content) => {
      content.classList.remove("active");
    });
    document.getElementById(`${tabId}-tab`).classList.add("active");
  });
});

// API 테스트 실행
document.getElementById("test-btn").addEventListener("click", async () => {
  // 기본 URL 가져오기
  let url = testUrl.value;

  // 파라미터 교체
  const paramInputs = paramFields.querySelectorAll("input");
  paramInputs.forEach((input) => {
    const paramName = input.dataset.param;
    const paramValue = input.value;
    url = url.replace(`:${paramName}`, paramValue);
  });

  // 메서드 결정 (URL에서 경로 추출)
  const path = url.replace(baseUrl, "");
  const endpoint = endpoints.find((ep) => ep.path === path.split("?")[0]);

  if (!endpoint) {
    alert("엔드포인트를 찾을 수 없습니다.");
    return;
  }

  const method = endpoint.method;

  // 테스트 시작 안내
  testStatus.textContent = "요청 중...";
  testResult.classList.remove("hidden");

  // 확률 기반 엔드포인트인 경우 안내
  if (endpoint.probability !== undefined) {
    testResponse.textContent = `확률 기반 응답(${endpoint.probability}%)을 테스트합니다. 요청 중...`;
  }

  // fetch 옵션
  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  // POST/PUT/PATCH 메서드인 경우 본문 추가
  if (["POST", "PUT", "PATCH"].includes(method)) {
    try {
      // JSON 검증
      const bodyContent = testBody.value.trim();
      if (bodyContent) {
        options.body = bodyContent;
      }
    } catch (error) {
      alert("유효하지 않은 JSON입니다: " + error.message);
      return;
    }
  }

  try {
    const startTime = Date.now();
    const response = await fetch(url, options);
    const endTime = Date.now();

    // 응답 본문 텍스트
    let responseText = "";
    try {
      const responseData = await response.json();
      responseText = JSON.stringify(responseData, null, 2);
    } catch {
      responseText = "(응답 없음)";
    }

    // 응답 시간
    const duration = endTime - startTime;

    // 결과 표시
    testStatus.textContent = `${response.status} ${response.statusText}`;
    testStatus.className = response.ok ? "success" : "error";
    testTime.textContent = `${duration}ms`;
    testResponse.textContent = responseText;

    // 확률 기반 엔드포인트인 경우 추가 정보
    if (endpoint.probability !== undefined) {
      const isSuccess = response.status === endpoint.responses.success.status;
      const resultText = isSuccess ? "성공" : "실패";
      testStatus.textContent += ` (${resultText} 응답)`;
    }
  } catch (error) {
    testStatus.textContent = "오류";
    testStatus.className = "error";
    testTime.textContent = "";
    testResponse.textContent = `요청 오류: ${error.message}`;
  }
});

// 설정 새로고침 버튼
reloadConfigBtn.addEventListener("click", () => {
  socket.emit("reload");
});

// 로그 지우기 버튼
clearLogsBtn.addEventListener("click", () => {
  logOutput.textContent = "";
});
