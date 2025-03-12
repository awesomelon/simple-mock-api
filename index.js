const express = require("express");
const yaml = require("js-yaml");
const fs = require("fs");
const { program } = require("commander");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const handlebars = require("handlebars");

// 상수 정의
const PORT = process.env.PORT || 3000;
const CONFIG_FILE = process.env.CONFIG_FILE || "mock-api.yml";

// Express 앱 초기화
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 미들웨어 설정
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// 등록된 엔드포인트를 저장할 변수
let registeredEndpoints = [];

/**
 * 설정 파일을 로드하는 함수
 * @returns {Array} 엔드포인트 배열
 */
const loadConfig = () => {
  try {
    // 환경 변수에서 설정 파일 경로 가져오기
    const configFilePath = process.env.CONFIG_FILE || CONFIG_FILE;
    const configPath = path.resolve(configFilePath);

    console.log(`Loading config from: ${configPath}`);

    if (!fs.existsSync(configPath)) {
      console.error(`Config file not found: ${configPath}`);
      return [];
    }

    const config = yaml.load(fs.readFileSync(configPath, "utf8"));
    return config.endpoints || [];
  } catch (e) {
    console.error("Error loading config file:", e.message);
    return [];
  }
};

/**
 * 로그를 기록하고 소켓으로 전송하는 함수
 * @param {string} message - 로그 메시지
 * @param {string} level - 로그 레벨 ('info', 'warn', 'error')
 */
const logAndEmit = (message, level = "info") => {
  const timestamp = new Date().toISOString();
  const logPrefix = `[${timestamp}] [${level.toUpperCase()}]`;

  // 콘솔에 로그 출력
  switch (level) {
    case "error":
      console.error(`${logPrefix} ${message}`);
      break;
    case "warn":
      console.warn(`${logPrefix} ${message}`);
      break;
    default:
      console.log(`${logPrefix} ${message}`);
  }

  // 클라이언트에 로그 전송
  io.emit("log", `${logPrefix} ${message}`);
};

/**
 * 응답 데이터를 처리하는 함수
 * @param {Object} endpoint - 엔드포인트 정의
 * @param {Object} req - 요청 객체
 * @param {Object} responseConfig - 사용할 응답 설정 (확률 기반 처리용)
 * @returns {Object} 처리된 응답 데이터
 */
const processResponse = (endpoint, req, responseConfig = null) => {
  try {
    // 공통으로 사용할 컨텍스트 생성
    const context = {
      params: req.params,
      query: req.query,
      body: req.body,
      // 현재 시간, 날짜 등 추가 컨텍스트 제공
      now: new Date().toISOString(),
      randomId: Math.floor(Math.random() * 10000),
    };

    // 로깅 함수 - 디버깅 목적
    const logTemplateInfo = (source, templateStr) => {
      logAndEmit(`Template processing: ${source}`, "info");
      logAndEmit(
        `Context keys: ${JSON.stringify(Object.keys(context))}`,
        "info"
      );
      logAndEmit(
        `Template string preview: ${templateStr.substring(0, 100)}...`,
        "info"
      );
    };

    // 확률 기반 응답 처리
    if (responseConfig) {
      // 응답 설정에서 지정된 응답 객체 사용
      if (responseConfig.response && responseConfig.response.template) {
        // template 속성이 있는 경우의 처리 (일반 방식)
        const templateStr = JSON.stringify(responseConfig.response.template);
        logTemplateInfo("probability-template", templateStr);

        const template = handlebars.compile(templateStr);
        return JSON.parse(template(context));
      } else if (responseConfig.response) {
        // template 속성이 없지만 response 자체에 템플릿 문자열이 있는 경우
        const templateStr = JSON.stringify(responseConfig.response);
        logTemplateInfo("probability-direct", templateStr);

        const template = handlebars.compile(templateStr);
        const rendered = template(context);

        try {
          return JSON.parse(rendered);
        } catch (jsonError) {
          logAndEmit(
            `JSON parse error after template rendering: ${jsonError.message}`,
            "error"
          );
          logAndEmit(`Rendered template: ${rendered}`, "error");
          throw jsonError;
        }
      } else {
        logAndEmit(`No response defined in responseConfig`, "warn");
        return {}; // 응답이 없는 경우 빈 객체 반환
      }
    }

    // 기존 응답 처리 로직
    if (endpoint.response && endpoint.response.template) {
      // Handlebars 템플릿 처리
      const templateStr = JSON.stringify(endpoint.response.template);
      logTemplateInfo("standard-template", templateStr);

      const template = handlebars.compile(templateStr);
      return JSON.parse(template(context));
    } else if (endpoint.response) {
      // template 속성이 없지만 응답 자체에 템플릿 변수가 있을 수 있음
      const templateStr = JSON.stringify(endpoint.response);
      logTemplateInfo("standard-direct", templateStr);

      const template = handlebars.compile(templateStr);
      const rendered = template(context);

      try {
        return JSON.parse(rendered);
      } catch (jsonError) {
        logAndEmit(
          `JSON parse error after template rendering: ${jsonError.message}`,
          "error"
        );
        logAndEmit(`Rendered template: ${rendered}`, "error");
        throw jsonError;
      }
    } else {
      logAndEmit(`No response defined in endpoint`, "warn");
      return {}; // 응답이 없는 경우 빈 객체 반환
    }
  } catch (error) {
    logAndEmit(`Error processing response template: ${error.message}`, "error");
    logAndEmit(`Error stack: ${error.stack}`, "error");
    return {
      error: "Internal server error in template processing",
      message: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

/**
 * 확률 기반으로 응답 결정
 * @param {number} probability - 성공 확률 (0-100)
 * @returns {boolean} 성공 여부
 */
const determineSuccess = (probability) => {
  const randomNum = Math.random() * 100;
  return randomNum <= probability;
};

/**
 * 요청에 맞는 엔드포인트를 찾는 함수
 * @param {Object} req - 요청 객체
 * @returns {Object|null} 일치하는 엔드포인트 또는 null
 */
const findMatchingEndpoint = (req) => {
  const method = req.method.toLowerCase();
  const path = req.path;

  // 정확한 경로와 메소드 일치
  const exactMatch = registeredEndpoints.find(
    (endpoint) =>
      endpoint.path === path && endpoint.method.toLowerCase() === method
  );

  if (exactMatch) {
    return exactMatch;
  }

  // 경로 패턴 일치 (파라미터가 있는 경로)
  for (const endpoint of registeredEndpoints) {
    if (endpoint.method.toLowerCase() !== method) continue;

    // 정규표현식으로 경로 패턴 변환 (:param 형태를 정규식으로)
    const pattern = endpoint.path
      .replace(/:[^/]+/g, "([^/]+)")
      .replace(/\//g, "\\/");
    const regex = new RegExp(`^${pattern}$`);

    if (regex.test(path)) {
      // 파라미터 추출
      const paramNames = (endpoint.path.match(/:[^/]+/g) || []).map((param) =>
        param.substring(1)
      );
      const matches = path.match(regex);

      if (matches && matches.length > 1) {
        req.params = req.params || {};
        paramNames.forEach((name, i) => {
          req.params[name] = matches[i + 1];
        });
      }

      return endpoint;
    }
  }

  return null;
};

/**
 * 엔드포인트를 등록하는 함수
 * @param {Array} endpoints - 엔드포인트 배열
 */
const registerEndpoints = (endpoints) => {
  if (!Array.isArray(endpoints) || endpoints.length === 0) {
    logAndEmit("No endpoints to register", "warn");
    return;
  }

  // 이전 등록된 엔드포인트 초기화
  registeredEndpoints = [];

  // 엔드포인트 등록
  endpoints.forEach((endpoint) => {
    const method = endpoint.method?.toLowerCase();
    const path = endpoint.path;

    if (!method || !path) {
      logAndEmit(
        `Skipping invalid endpoint: ${JSON.stringify(endpoint)}`,
        "warn"
      );
      return;
    }

    // 엔드포인트 저장
    registeredEndpoints.push(endpoint);
    logAndEmit(`Registered: ${method.toUpperCase()} ${path}`, "info");
  });

  logAndEmit(
    `Total ${registeredEndpoints.length} endpoints registered`,
    "info"
  );
  io.emit("endpointUpdate", endpoints);
};

// Socket.io 연결 처리
io.on("connection", (socket) => {
  logAndEmit("Dashboard connected");

  // 새 클라이언트에게 현재 엔드포인트 목록 전송
  const endpoints = loadConfig();
  socket.emit("endpointUpdate", endpoints);

  // 클라이언트에서 설정 새로고침 요청 처리
  socket.on("reload", () => {
    logAndEmit("Manual reload requested");
    const endpoints = loadConfig();
    registerEndpoints(endpoints);
    logAndEmit("Configuration reloaded");
  });

  socket.on("disconnect", () => {
    logAndEmit("Dashboard disconnected");
  });
});

// CLI 명령어 정의
program
  .command("start")
  .description("Start the mock API server")
  .option("-p, --port <port>", "Port to listen on", PORT)
  .option("-c, --config <file>", "Config file path", CONFIG_FILE)
  .action((options) => {
    // 옵션에서 직접 값 가져오기
    const port = options.port || PORT;
    const configFile = options.config || CONFIG_FILE;

    // 환경 변수 업데이트 (다른 곳에서 사용할 수 있도록)
    process.env.PORT = port;
    process.env.CONFIG_FILE = configFile;

    console.log(`서버를 포트 ${port}에서 시작합니다.`);
    console.log(`설정 파일: ${configFile}`);

    const endpoints = loadConfig();
    registerEndpoints(endpoints);

    server.listen(port, () => {
      logAndEmit(`Mock API server running on http://localhost:${port}`);
    });
  });

program
  .command("reload")
  .description("Reload endpoints from config file")
  .option("-c, --config <file>", "Config file path to reload", null)
  .action((options) => {
    // 옵션에 config가 지정됐으면 환경 변수 업데이트
    if (options.config) {
      process.env.CONFIG_FILE = options.config;
      logAndEmit(`설정 파일을 ${options.config}로 변경합니다.`);
    }

    logAndEmit("Reloading configuration...");
    const endpoints = loadConfig();
    registerEndpoints(endpoints);
    logAndEmit("Configuration reloaded");
  });

// 파일 변경 감지
if (process.env.WATCH !== "false") {
  // 현재 설정 파일 감시
  const watchConfigFile = () => {
    const configFilePath = process.env.CONFIG_FILE || CONFIG_FILE;
    const configPath = path.resolve(configFilePath);

    logAndEmit(`Watching config file: ${configPath}`);

    // 이전 감시 제거 (있다면)
    fs.unwatchFile(configPath);

    // 새 감시 설정
    fs.watchFile(configPath, () => {
      logAndEmit(`Config file changed, reloading...`);
      const endpoints = loadConfig();
      registerEndpoints(endpoints);
    });
  };

  // 초기 감시 설정
  watchConfigFile();

  // PORT나 CONFIG_FILE이 변경될 때마다 감시 재설정
  const originalWatch = { PORT, CONFIG_FILE };
  setInterval(() => {
    if (originalWatch.CONFIG_FILE !== process.env.CONFIG_FILE) {
      originalWatch.CONFIG_FILE = process.env.CONFIG_FILE;
      watchConfigFile();
    }
  }, 5000);
}

program.parse(process.argv);

// 명령어 없이 실행된 경우 도움말 표시
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

// 엔드포인트 처리
app.use((req, res) => {
  try {
    const endpoint = findMatchingEndpoint(req);
    if (!endpoint) {
      logAndEmit(`404 Not Found: ${req.method} ${req.path}`, "warn");
      return res.status(404).json({
        error: "Not Found",
        message: `No endpoint defined for ${req.method} ${req.path}`,
        timestamp: new Date().toISOString(),
      });
    }

    // 확률 기반 응답 결정
    if (endpoint.probability !== undefined && endpoint.responses) {
      try {
        const success = Math.random() * 100 < endpoint.probability;
        const responseType = success ? "success" : "failure";
        const responseConfig = endpoint.responses[responseType];

        if (!responseConfig) {
          logAndEmit(
            `Missing ${responseType} response configuration for endpoint ${req.path}`,
            "error"
          );
          return res.status(500).json({
            error: "Server Error",
            message: `Missing ${responseType} response configuration`,
            timestamp: new Date().toISOString(),
          });
        }

        const delay = responseConfig.delay || 0;
        const statusCode = responseConfig.statusCode || 200;

        logAndEmit(
          `Processing ${responseType} response for ${req.method} ${req.path} with probability ${endpoint.probability}% (Delay: ${delay}ms, Status: ${statusCode})`,
          "info"
        );

        setTimeout(() => {
          try {
            const responseData = processResponse(endpoint, req, responseConfig);
            res.status(statusCode).json(responseData);
          } catch (error) {
            logAndEmit(
              `Error processing ${req.method} ${req.path}: ${error.message}`,
              "error"
            );
            logAndEmit(`Error stack: ${error.stack}`, "error");
            res.status(500).json({
              error: "Internal Server Error",
              message: error.message,
              path: req.path,
              timestamp: new Date().toISOString(),
            });
          }
        }, delay);

        return;
      } catch (error) {
        logAndEmit(
          `Error handling probability-based endpoint ${req.method} ${req.path}: ${error.message}`,
          "error"
        );
        logAndEmit(`Error stack: ${error.stack}`, "error");
        return res.status(500).json({
          error: "Internal Server Error",
          message: error.message,
          path: req.path,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // 일반 엔드포인트 처리
    const delay = endpoint.delay || 0;
    const statusCode = endpoint.statusCode || 200;

    logAndEmit(
      `Processing standard response for ${req.method} ${req.path} (Delay: ${delay}ms, Status: ${statusCode})`,
      "info"
    );

    setTimeout(() => {
      try {
        const responseData = processResponse(endpoint, req);
        res.status(statusCode).json(responseData);
      } catch (error) {
        logAndEmit(
          `Error processing ${req.method} ${req.path}: ${error.message}`,
          "error"
        );
        logAndEmit(`Error stack: ${error.stack}`, "error");
        res.status(500).json({
          error: "Internal Server Error",
          message: error.message,
          path: req.path,
          timestamp: new Date().toISOString(),
        });
      }
    }, delay);
  } catch (error) {
    logAndEmit(
      `Unexpected error handling request ${req.method} ${req.path}: ${error.message}`,
      "error"
    );
    logAndEmit(`Error stack: ${error.stack}`, "error");
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = app;
