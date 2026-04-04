#!/usr/bin/env node
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ccud/node_modules/jsonrpc-lite/jsonrpc.js
var require_jsonrpc = __commonJS({
  "ccud/node_modules/jsonrpc-lite/jsonrpc.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.jsonrpc = exports.parseObject = exports.parseJsonRpcString = exports.parseJsonRpcObject = exports.parse = exports.error = exports.success = exports.notification = exports.request = exports.JsonRpcError = exports.JsonRpcParsed = exports.ErrorObject = exports.SuccessObject = exports.NotificationObject = exports.RequestObject = exports.JsonRpc = void 0;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var isInteger = typeof Number.isSafeInteger === "function" ? Number.isSafeInteger : function(num) {
      return typeof num === "number" && isFinite(num) && num === Math.floor(num) && Math.abs(num) <= 9007199254740991;
    };
    var JsonRpc = class {
      constructor() {
        this.jsonrpc = "2.0";
      }
      serialize() {
        return JSON.stringify(this);
      }
    };
    exports.JsonRpc = JsonRpc;
    JsonRpc.VERSION = "2.0";
    var RequestObject = class extends JsonRpc {
      constructor(id, method, params) {
        super();
        this.id = id;
        this.method = method;
        if (params !== void 0) {
          this.params = params;
        }
      }
    };
    exports.RequestObject = RequestObject;
    var NotificationObject = class extends JsonRpc {
      constructor(method, params) {
        super();
        this.method = method;
        if (params !== void 0) {
          this.params = params;
        }
      }
    };
    exports.NotificationObject = NotificationObject;
    var SuccessObject = class extends JsonRpc {
      constructor(id, result) {
        super();
        this.id = id;
        this.result = result;
      }
    };
    exports.SuccessObject = SuccessObject;
    var ErrorObject = class extends JsonRpc {
      // tslint:disable-next-line:no-shadowed-variable
      constructor(id, error3) {
        super();
        this.id = id;
        this.error = error3;
        this.id = id;
        this.error = error3;
      }
    };
    exports.ErrorObject = ErrorObject;
    var JsonRpcParsed = class {
      constructor(payload, type) {
        this.payload = payload;
        this.type = type;
        this.payload = payload;
        this.type = type;
      }
    };
    exports.JsonRpcParsed = JsonRpcParsed;
    var JsonRpcError = class {
      constructor(message, code, data) {
        this.message = message;
        this.code = isInteger(code) ? code : 0;
        if (data != null) {
          this.data = data;
        }
      }
    };
    exports.JsonRpcError = JsonRpcError;
    JsonRpcError.invalidRequest = function(data) {
      return new JsonRpcError("Invalid request", -32600, data);
    };
    JsonRpcError.methodNotFound = function(data) {
      return new JsonRpcError("Method not found", -32601, data);
    };
    JsonRpcError.invalidParams = function(data) {
      return new JsonRpcError("Invalid params", -32602, data);
    };
    JsonRpcError.internalError = function(data) {
      return new JsonRpcError("Internal error", -32603, data);
    };
    JsonRpcError.parseError = function(data) {
      return new JsonRpcError("Parse error", -32700, data);
    };
    function request(id, method, params) {
      const object = new RequestObject(id, method, params);
      validateMessage(object, true);
      return object;
    }
    exports.request = request;
    function notification(method, params) {
      const object = new NotificationObject(method, params);
      validateMessage(object, true);
      return object;
    }
    exports.notification = notification;
    function success(id, result) {
      const object = new SuccessObject(id, result);
      validateMessage(object, true);
      return object;
    }
    exports.success = success;
    function error2(id, err) {
      const object = new ErrorObject(id, err);
      validateMessage(object, true);
      return object;
    }
    exports.error = error2;
    function parse(message) {
      if (!isString(message)) {
        return new JsonRpcParsed(
          JsonRpcError.invalidRequest(message),
          "invalid"
          /* invalid */
        );
      }
      let jsonrpcObj;
      try {
        jsonrpcObj = JSON.parse(message);
      } catch (err) {
        return new JsonRpcParsed(
          JsonRpcError.parseError(message),
          "invalid"
          /* invalid */
        );
      }
      return parseJsonRpcObject(jsonrpcObj);
    }
    exports.parse = parse;
    function parseJsonRpcObject(jsonrpcObj) {
      if (!Array.isArray(jsonrpcObj)) {
        return parseObject(jsonrpcObj);
      }
      if (jsonrpcObj.length === 0) {
        return new JsonRpcParsed(
          JsonRpcError.invalidRequest(jsonrpcObj),
          "invalid"
          /* invalid */
        );
      }
      const parsedObjectArray = [];
      for (let i = 0, len = jsonrpcObj.length; i < len; i++) {
        parsedObjectArray[i] = parseObject(jsonrpcObj[i]);
      }
      return parsedObjectArray;
    }
    exports.parseJsonRpcObject = parseJsonRpcObject;
    exports.parseJsonRpcString = parse;
    function parseObject(obj) {
      let err = null;
      let payload = null;
      let payloadType = "invalid";
      if (obj == null || obj.jsonrpc !== JsonRpc.VERSION) {
        err = JsonRpcError.invalidRequest(obj);
        payloadType = "invalid";
      } else if (!hasOwnProperty.call(obj, "id")) {
        const tmp = obj;
        payload = new NotificationObject(tmp.method, tmp.params);
        err = validateMessage(payload);
        payloadType = "notification";
      } else if (hasOwnProperty.call(obj, "method")) {
        const tmp = obj;
        payload = new RequestObject(tmp.id, tmp.method, tmp.params);
        err = validateMessage(payload);
        payloadType = "request";
      } else if (hasOwnProperty.call(obj, "result")) {
        const tmp = obj;
        payload = new SuccessObject(tmp.id, tmp.result);
        err = validateMessage(payload);
        payloadType = "success";
      } else if (hasOwnProperty.call(obj, "error")) {
        const tmp = obj;
        payloadType = "error";
        if (tmp.error == null) {
          err = JsonRpcError.internalError(tmp);
        } else {
          const errorObj = new JsonRpcError(tmp.error.message, tmp.error.code, tmp.error.data);
          if (errorObj.message !== tmp.error.message || errorObj.code !== tmp.error.code) {
            err = JsonRpcError.internalError(tmp);
          } else {
            payload = new ErrorObject(tmp.id, errorObj);
            err = validateMessage(payload);
          }
        }
      }
      if (err == null && payload != null) {
        return new JsonRpcParsed(payload, payloadType);
      }
      return new JsonRpcParsed(
        err != null ? err : JsonRpcError.invalidRequest(obj),
        "invalid"
        /* invalid */
      );
    }
    exports.parseObject = parseObject;
    function validateMessage(obj, throwIt) {
      let err = null;
      if (obj instanceof RequestObject) {
        err = checkId(obj.id);
        if (err == null) {
          err = checkMethod(obj.method);
        }
        if (err == null) {
          err = checkParams(obj.params);
        }
      } else if (obj instanceof NotificationObject) {
        err = checkMethod(obj.method);
        if (err == null) {
          err = checkParams(obj.params);
        }
      } else if (obj instanceof SuccessObject) {
        err = checkId(obj.id);
        if (err == null) {
          err = checkResult(obj.result);
        }
      } else if (obj instanceof ErrorObject) {
        err = checkId(obj.id, true);
        if (err == null) {
          err = checkError(obj.error);
        }
      }
      if (throwIt && err != null) {
        throw err;
      }
      return err;
    }
    function checkId(id, maybeNull) {
      if (maybeNull && id === null) {
        return null;
      }
      return isString(id) || isInteger(id) ? null : JsonRpcError.internalError('"id" must be provided, a string or an integer.');
    }
    function checkMethod(method) {
      return isString(method) ? null : JsonRpcError.invalidRequest(method);
    }
    function checkResult(result) {
      return result === void 0 ? JsonRpcError.internalError("Result must exist for success Response objects") : null;
    }
    function checkParams(params) {
      if (params === void 0) {
        return null;
      }
      if (Array.isArray(params) || isObject(params)) {
        try {
          JSON.stringify(params);
          return null;
        } catch (err) {
          return JsonRpcError.parseError(params);
        }
      }
      return JsonRpcError.invalidParams(params);
    }
    function checkError(err) {
      if (!(err instanceof JsonRpcError)) {
        return JsonRpcError.internalError("Error must be an instance of JsonRpcError");
      }
      if (!isInteger(err.code)) {
        return JsonRpcError.internalError("Invalid error code. It must be an integer.");
      }
      if (!isString(err.message)) {
        return JsonRpcError.internalError("Message must exist or must be a string.");
      }
      return null;
    }
    function isString(obj) {
      return obj !== "" && typeof obj === "string";
    }
    function isObject(obj) {
      return obj != null && typeof obj === "object" && !Array.isArray(obj);
    }
    var jsonrpc3 = {
      JsonRpc,
      JsonRpcError,
      request,
      notification,
      success,
      error: error2,
      parse,
      parseObject,
      parseJsonRpcObject,
      parseJsonRpcString: exports.parseJsonRpcString
    };
    exports.jsonrpc = jsonrpc3;
    exports.default = jsonrpc3;
  }
});

// ccud/src/index.js
var import_jsonrpc_lite2 = __toESM(require_jsonrpc(), 1);

// ccud/src/logger.js
function log(...args) {
  process.stderr.write(`[ccud] ${args.join(" ")}
`);
}
function error(...args) {
  process.stderr.write(`[ccud:error] ${args.join(" ")}
`);
}

// ccud/src/pid.js
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
var PID_DIR = join(homedir(), ".ccud");
var PID_FILE = join(PID_DIR, "ccud.pid");
function writePidFile() {
  try {
    mkdirSync(PID_DIR, { recursive: true });
    writeFileSync(PID_FILE, String(process.pid), "utf8");
    process.title = "ccud";
    log(`PID ${process.pid} written to ${PID_FILE}`);
  } catch (e) {
    error(`Failed to write PID file: ${e.message}`);
  }
}
function removePidFile() {
  try {
    unlinkSync(PID_FILE);
    log("PID file removed");
  } catch (e) {
  }
}

// ccud/src/transport.js
var import_jsonrpc_lite = __toESM(require_jsonrpc(), 1);
import { createInterface } from "readline";
function createStdioTransport(onMessage) {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on("line", (line) => {
    if (!line.trim()) return;
    try {
      const parsed = JSON.parse(line);
      if (Array.isArray(parsed)) {
        onMessage(parsed);
      } else {
        const rpcObj = import_jsonrpc_lite.default.parseObject(parsed);
        onMessage(parsed, rpcObj);
      }
    } catch (e) {
      error(`Invalid JSON-RPC: ${e.message}`);
    }
  });
  rl.on("close", () => {
    log("stdin closed, shutting down");
    setTimeout(() => process.exit(0), 5e3);
  });
  return {
    send(msg) {
      process.stdout.write(JSON.stringify(msg) + "\n");
    }
  };
}

// ccud/src/handlers/initialize.js
var DAEMON_VERSION = "1.0.0";
var PROTOCOL_VERSION = 1;
function handleInitialize(params) {
  log(`Initialize request from client v${params?.clientVersion || "unknown"}, protocol v${params?.protocolVersion || "unknown"}`);
  return {
    protocolVersion: PROTOCOL_VERSION,
    daemonVersion: DAEMON_VERSION,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  };
}

// ccud/src/handlers/fs.js
import { readFile, writeFile, mkdir, rename, unlink, rm, stat, readdir, access } from "fs/promises";
import { join as join2, dirname } from "path";
import { constants } from "fs";
var FS_ERROR_CODES = {
  ENOENT: { code: -32001, message: "File or directory not found" },
  EACCES: { code: -32002, message: "Permission denied" },
  EPERM: { code: -32002, message: "Permission denied" },
  EEXIST: { code: -32003, message: "Already exists" },
  ENOTEMPTY: { code: -32004, message: "Directory not empty" },
  ENOSPC: { code: -32005, message: "No space left on device" }
};
function mapFsError(err) {
  const mapped = FS_ERROR_CODES[err.code];
  if (mapped) {
    return { error: { code: mapped.code, message: mapped.message } };
  }
  return { error: { code: -32e3, message: err.message } };
}
function permToRwx(perm) {
  const r = perm & 4 ? "r" : "-";
  const w = perm & 2 ? "w" : "-";
  const x = perm & 1 ? "x" : "-";
  return r + w + x;
}
async function getFileTree(dirPath, maxDepth, currentDepth, showHidden) {
  const items = [];
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name === "build" || entry.name === ".git" || entry.name === ".svn" || entry.name === ".hg") continue;
      const itemPath = join2(dirPath, entry.name);
      const item = {
        name: entry.name,
        path: itemPath,
        type: entry.isDirectory() ? "directory" : "file"
      };
      try {
        const stats = await stat(itemPath);
        item.size = stats.size;
        item.modified = stats.mtime.toISOString();
        const mode = stats.mode;
        const ownerPerm = mode >> 6 & 7;
        const groupPerm = mode >> 3 & 7;
        const otherPerm = mode & 7;
        item.permissions = ownerPerm.toString() + groupPerm.toString() + otherPerm.toString();
        item.permissionsRwx = permToRwx(ownerPerm) + permToRwx(groupPerm) + permToRwx(otherPerm);
      } catch (statError) {
        item.size = 0;
        item.modified = null;
        item.permissions = "000";
        item.permissionsRwx = "---------";
      }
      if (entry.isDirectory() && currentDepth < maxDepth) {
        try {
          await access(itemPath, constants.R_OK);
          item.children = await getFileTree(itemPath, maxDepth, currentDepth + 1, showHidden);
        } catch (e) {
          item.children = [];
        }
      }
      items.push(item);
    }
  } catch (error2) {
    if (error2.code !== "EACCES" && error2.code !== "EPERM") {
    }
  }
  return items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "directory" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}
async function handleFs(method, params) {
  try {
    switch (method) {
      case "fs/readdir": {
        return await getFileTree(
          params.path,
          params.maxDepth ?? 10,
          0,
          params.showHidden ?? true
        );
      }
      case "fs/readFile": {
        const content = await readFile(params.path, "utf8");
        return { content };
      }
      case "fs/writeFile": {
        await writeFile(params.path, params.content, "utf8");
        return { success: true };
      }
      case "fs/stat": {
        const stats = await stat(params.path);
        const mode = stats.mode;
        const ownerPerm = mode >> 6 & 7;
        const groupPerm = mode >> 3 & 7;
        const otherPerm = mode & 7;
        return {
          size: stats.size,
          modified: stats.mtime.toISOString(),
          type: stats.isDirectory() ? "directory" : "file",
          permissions: ownerPerm.toString() + groupPerm.toString() + otherPerm.toString(),
          permissionsRwx: permToRwx(ownerPerm) + permToRwx(groupPerm) + permToRwx(otherPerm)
        };
      }
      case "fs/create": {
        const fullPath = join2(params.path, params.name);
        if (params.type === "directory") {
          await mkdir(fullPath, { recursive: false });
        } else {
          const parentDir = dirname(fullPath);
          try {
            await access(parentDir);
          } catch {
            await mkdir(parentDir, { recursive: true });
          }
          await writeFile(fullPath, "", "utf8");
        }
        return { path: fullPath, name: params.name, type: params.type };
      }
      case "fs/rename": {
        const newPath = join2(dirname(params.oldPath), params.newName);
        await rename(params.oldPath, newPath);
        return { oldPath: params.oldPath, newPath, newName: params.newName };
      }
      case "fs/delete": {
        const s = await stat(params.path);
        if (s.isDirectory()) {
          await rm(params.path, { recursive: true, force: true });
        } else {
          await unlink(params.path);
        }
        return { success: true };
      }
      case "fs/exists": {
        try {
          await access(params.path);
          return { exists: true };
        } catch {
          return { exists: false };
        }
      }
      default:
        return { error: { code: -32601, message: "Method not implemented: " + method } };
    }
  } catch (err) {
    return mapFsError(err);
  }
}

// ccud/src/handlers/git.js
import { execFile } from "child_process";
import { promisify } from "util";
var execFileAsync = promisify(execFile);
async function handleGit(method, params) {
  try {
    switch (method) {
      case "git/exec": {
        if (!Array.isArray(params?.args) || typeof params?.cwd !== "string" || !params.cwd) {
          return { error: { code: -32602, message: "Missing args or cwd" } };
        }
        try {
          const { stdout, stderr } = await execFileAsync("git", params.args, {
            cwd: params.cwd,
            maxBuffer: 10 * 1024 * 1024,
            timeout: 3e4
          });
          return { stdout, stderr, exitCode: 0 };
        } catch (err) {
          return {
            stdout: err.stdout || "",
            stderr: err.stderr || "",
            exitCode: err.code || 1,
            message: err.message
          };
        }
      }
      default:
        return { error: { code: -32601, message: "Method not found: " + method } };
    }
  } catch (err) {
    return { error: { code: -32e3, message: err.message } };
  }
}

// node_modules/chokidar/esm/index.js
import { stat as statcb } from "fs";
import { stat as stat4, readdir as readdir3 } from "fs/promises";
import { EventEmitter } from "events";
import * as sysPath2 from "path";

// node_modules/readdirp/esm/index.js
import { stat as stat2, lstat, readdir as readdir2, realpath } from "node:fs/promises";
import { Readable } from "node:stream";
import { resolve as presolve, relative as prelative, join as pjoin, sep as psep } from "node:path";
var EntryTypes = {
  FILE_TYPE: "files",
  DIR_TYPE: "directories",
  FILE_DIR_TYPE: "files_directories",
  EVERYTHING_TYPE: "all"
};
var defaultOptions = {
  root: ".",
  fileFilter: (_entryInfo) => true,
  directoryFilter: (_entryInfo) => true,
  type: EntryTypes.FILE_TYPE,
  lstat: false,
  depth: 2147483648,
  alwaysStat: false,
  highWaterMark: 4096
};
Object.freeze(defaultOptions);
var RECURSIVE_ERROR_CODE = "READDIRP_RECURSIVE_ERROR";
var NORMAL_FLOW_ERRORS = /* @__PURE__ */ new Set(["ENOENT", "EPERM", "EACCES", "ELOOP", RECURSIVE_ERROR_CODE]);
var ALL_TYPES = [
  EntryTypes.DIR_TYPE,
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE,
  EntryTypes.FILE_TYPE
];
var DIR_TYPES = /* @__PURE__ */ new Set([
  EntryTypes.DIR_TYPE,
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE
]);
var FILE_TYPES = /* @__PURE__ */ new Set([
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE,
  EntryTypes.FILE_TYPE
]);
var isNormalFlowError = (error2) => NORMAL_FLOW_ERRORS.has(error2.code);
var wantBigintFsStats = process.platform === "win32";
var emptyFn = (_entryInfo) => true;
var normalizeFilter = (filter) => {
  if (filter === void 0)
    return emptyFn;
  if (typeof filter === "function")
    return filter;
  if (typeof filter === "string") {
    const fl = filter.trim();
    return (entry) => entry.basename === fl;
  }
  if (Array.isArray(filter)) {
    const trItems = filter.map((item) => item.trim());
    return (entry) => trItems.some((f) => entry.basename === f);
  }
  return emptyFn;
};
var ReaddirpStream = class extends Readable {
  constructor(options = {}) {
    super({
      objectMode: true,
      autoDestroy: true,
      highWaterMark: options.highWaterMark
    });
    const opts = { ...defaultOptions, ...options };
    const { root, type } = opts;
    this._fileFilter = normalizeFilter(opts.fileFilter);
    this._directoryFilter = normalizeFilter(opts.directoryFilter);
    const statMethod = opts.lstat ? lstat : stat2;
    if (wantBigintFsStats) {
      this._stat = (path) => statMethod(path, { bigint: true });
    } else {
      this._stat = statMethod;
    }
    this._maxDepth = opts.depth ?? defaultOptions.depth;
    this._wantsDir = type ? DIR_TYPES.has(type) : false;
    this._wantsFile = type ? FILE_TYPES.has(type) : false;
    this._wantsEverything = type === EntryTypes.EVERYTHING_TYPE;
    this._root = presolve(root);
    this._isDirent = !opts.alwaysStat;
    this._statsProp = this._isDirent ? "dirent" : "stats";
    this._rdOptions = { encoding: "utf8", withFileTypes: this._isDirent };
    this.parents = [this._exploreDir(root, 1)];
    this.reading = false;
    this.parent = void 0;
  }
  async _read(batch) {
    if (this.reading)
      return;
    this.reading = true;
    try {
      while (!this.destroyed && batch > 0) {
        const par = this.parent;
        const fil = par && par.files;
        if (fil && fil.length > 0) {
          const { path, depth } = par;
          const slice = fil.splice(0, batch).map((dirent) => this._formatEntry(dirent, path));
          const awaited = await Promise.all(slice);
          for (const entry of awaited) {
            if (!entry)
              continue;
            if (this.destroyed)
              return;
            const entryType = await this._getEntryType(entry);
            if (entryType === "directory" && this._directoryFilter(entry)) {
              if (depth <= this._maxDepth) {
                this.parents.push(this._exploreDir(entry.fullPath, depth + 1));
              }
              if (this._wantsDir) {
                this.push(entry);
                batch--;
              }
            } else if ((entryType === "file" || this._includeAsFile(entry)) && this._fileFilter(entry)) {
              if (this._wantsFile) {
                this.push(entry);
                batch--;
              }
            }
          }
        } else {
          const parent = this.parents.pop();
          if (!parent) {
            this.push(null);
            break;
          }
          this.parent = await parent;
          if (this.destroyed)
            return;
        }
      }
    } catch (error2) {
      this.destroy(error2);
    } finally {
      this.reading = false;
    }
  }
  async _exploreDir(path, depth) {
    let files;
    try {
      files = await readdir2(path, this._rdOptions);
    } catch (error2) {
      this._onError(error2);
    }
    return { files, depth, path };
  }
  async _formatEntry(dirent, path) {
    let entry;
    const basename3 = this._isDirent ? dirent.name : dirent;
    try {
      const fullPath = presolve(pjoin(path, basename3));
      entry = { path: prelative(this._root, fullPath), fullPath, basename: basename3 };
      entry[this._statsProp] = this._isDirent ? dirent : await this._stat(fullPath);
    } catch (err) {
      this._onError(err);
      return;
    }
    return entry;
  }
  _onError(err) {
    if (isNormalFlowError(err) && !this.destroyed) {
      this.emit("warn", err);
    } else {
      this.destroy(err);
    }
  }
  async _getEntryType(entry) {
    if (!entry && this._statsProp in entry) {
      return "";
    }
    const stats = entry[this._statsProp];
    if (stats.isFile())
      return "file";
    if (stats.isDirectory())
      return "directory";
    if (stats && stats.isSymbolicLink()) {
      const full = entry.fullPath;
      try {
        const entryRealPath = await realpath(full);
        const entryRealPathStats = await lstat(entryRealPath);
        if (entryRealPathStats.isFile()) {
          return "file";
        }
        if (entryRealPathStats.isDirectory()) {
          const len = entryRealPath.length;
          if (full.startsWith(entryRealPath) && full.substr(len, 1) === psep) {
            const recursiveError = new Error(`Circular symlink detected: "${full}" points to "${entryRealPath}"`);
            recursiveError.code = RECURSIVE_ERROR_CODE;
            return this._onError(recursiveError);
          }
          return "directory";
        }
      } catch (error2) {
        this._onError(error2);
        return "";
      }
    }
  }
  _includeAsFile(entry) {
    const stats = entry && entry[this._statsProp];
    return stats && this._wantsEverything && !stats.isDirectory();
  }
};
function readdirp(root, options = {}) {
  let type = options.entryType || options.type;
  if (type === "both")
    type = EntryTypes.FILE_DIR_TYPE;
  if (type)
    options.type = type;
  if (!root) {
    throw new Error("readdirp: root argument is required. Usage: readdirp(root, options)");
  } else if (typeof root !== "string") {
    throw new TypeError("readdirp: root argument must be a string. Usage: readdirp(root, options)");
  } else if (type && !ALL_TYPES.includes(type)) {
    throw new Error(`readdirp: Invalid type passed. Use one of ${ALL_TYPES.join(", ")}`);
  }
  options.root = root;
  return new ReaddirpStream(options);
}

// node_modules/chokidar/esm/handler.js
import { watchFile, unwatchFile, watch as fs_watch } from "fs";
import { open, stat as stat3, lstat as lstat2, realpath as fsrealpath } from "fs/promises";
import * as sysPath from "path";
import { type as osType } from "os";
var STR_DATA = "data";
var STR_END = "end";
var STR_CLOSE = "close";
var EMPTY_FN = () => {
};
var pl = process.platform;
var isWindows = pl === "win32";
var isMacos = pl === "darwin";
var isLinux = pl === "linux";
var isFreeBSD = pl === "freebsd";
var isIBMi = osType() === "OS400";
var EVENTS = {
  ALL: "all",
  READY: "ready",
  ADD: "add",
  CHANGE: "change",
  ADD_DIR: "addDir",
  UNLINK: "unlink",
  UNLINK_DIR: "unlinkDir",
  RAW: "raw",
  ERROR: "error"
};
var EV = EVENTS;
var THROTTLE_MODE_WATCH = "watch";
var statMethods = { lstat: lstat2, stat: stat3 };
var KEY_LISTENERS = "listeners";
var KEY_ERR = "errHandlers";
var KEY_RAW = "rawEmitters";
var HANDLER_KEYS = [KEY_LISTENERS, KEY_ERR, KEY_RAW];
var binaryExtensions = /* @__PURE__ */ new Set([
  "3dm",
  "3ds",
  "3g2",
  "3gp",
  "7z",
  "a",
  "aac",
  "adp",
  "afdesign",
  "afphoto",
  "afpub",
  "ai",
  "aif",
  "aiff",
  "alz",
  "ape",
  "apk",
  "appimage",
  "ar",
  "arj",
  "asf",
  "au",
  "avi",
  "bak",
  "baml",
  "bh",
  "bin",
  "bk",
  "bmp",
  "btif",
  "bz2",
  "bzip2",
  "cab",
  "caf",
  "cgm",
  "class",
  "cmx",
  "cpio",
  "cr2",
  "cur",
  "dat",
  "dcm",
  "deb",
  "dex",
  "djvu",
  "dll",
  "dmg",
  "dng",
  "doc",
  "docm",
  "docx",
  "dot",
  "dotm",
  "dra",
  "DS_Store",
  "dsk",
  "dts",
  "dtshd",
  "dvb",
  "dwg",
  "dxf",
  "ecelp4800",
  "ecelp7470",
  "ecelp9600",
  "egg",
  "eol",
  "eot",
  "epub",
  "exe",
  "f4v",
  "fbs",
  "fh",
  "fla",
  "flac",
  "flatpak",
  "fli",
  "flv",
  "fpx",
  "fst",
  "fvt",
  "g3",
  "gh",
  "gif",
  "graffle",
  "gz",
  "gzip",
  "h261",
  "h263",
  "h264",
  "icns",
  "ico",
  "ief",
  "img",
  "ipa",
  "iso",
  "jar",
  "jpeg",
  "jpg",
  "jpgv",
  "jpm",
  "jxr",
  "key",
  "ktx",
  "lha",
  "lib",
  "lvp",
  "lz",
  "lzh",
  "lzma",
  "lzo",
  "m3u",
  "m4a",
  "m4v",
  "mar",
  "mdi",
  "mht",
  "mid",
  "midi",
  "mj2",
  "mka",
  "mkv",
  "mmr",
  "mng",
  "mobi",
  "mov",
  "movie",
  "mp3",
  "mp4",
  "mp4a",
  "mpeg",
  "mpg",
  "mpga",
  "mxu",
  "nef",
  "npx",
  "numbers",
  "nupkg",
  "o",
  "odp",
  "ods",
  "odt",
  "oga",
  "ogg",
  "ogv",
  "otf",
  "ott",
  "pages",
  "pbm",
  "pcx",
  "pdb",
  "pdf",
  "pea",
  "pgm",
  "pic",
  "png",
  "pnm",
  "pot",
  "potm",
  "potx",
  "ppa",
  "ppam",
  "ppm",
  "pps",
  "ppsm",
  "ppsx",
  "ppt",
  "pptm",
  "pptx",
  "psd",
  "pya",
  "pyc",
  "pyo",
  "pyv",
  "qt",
  "rar",
  "ras",
  "raw",
  "resources",
  "rgb",
  "rip",
  "rlc",
  "rmf",
  "rmvb",
  "rpm",
  "rtf",
  "rz",
  "s3m",
  "s7z",
  "scpt",
  "sgi",
  "shar",
  "snap",
  "sil",
  "sketch",
  "slk",
  "smv",
  "snk",
  "so",
  "stl",
  "suo",
  "sub",
  "swf",
  "tar",
  "tbz",
  "tbz2",
  "tga",
  "tgz",
  "thmx",
  "tif",
  "tiff",
  "tlz",
  "ttc",
  "ttf",
  "txz",
  "udf",
  "uvh",
  "uvi",
  "uvm",
  "uvp",
  "uvs",
  "uvu",
  "viv",
  "vob",
  "war",
  "wav",
  "wax",
  "wbmp",
  "wdp",
  "weba",
  "webm",
  "webp",
  "whl",
  "wim",
  "wm",
  "wma",
  "wmv",
  "wmx",
  "woff",
  "woff2",
  "wrm",
  "wvx",
  "xbm",
  "xif",
  "xla",
  "xlam",
  "xls",
  "xlsb",
  "xlsm",
  "xlsx",
  "xlt",
  "xltm",
  "xltx",
  "xm",
  "xmind",
  "xpi",
  "xpm",
  "xwd",
  "xz",
  "z",
  "zip",
  "zipx"
]);
var isBinaryPath = (filePath) => binaryExtensions.has(sysPath.extname(filePath).slice(1).toLowerCase());
var foreach = (val, fn) => {
  if (val instanceof Set) {
    val.forEach(fn);
  } else {
    fn(val);
  }
};
var addAndConvert = (main, prop, item) => {
  let container = main[prop];
  if (!(container instanceof Set)) {
    main[prop] = container = /* @__PURE__ */ new Set([container]);
  }
  container.add(item);
};
var clearItem = (cont) => (key) => {
  const set = cont[key];
  if (set instanceof Set) {
    set.clear();
  } else {
    delete cont[key];
  }
};
var delFromSet = (main, prop, item) => {
  const container = main[prop];
  if (container instanceof Set) {
    container.delete(item);
  } else if (container === item) {
    delete main[prop];
  }
};
var isEmptySet = (val) => val instanceof Set ? val.size === 0 : !val;
var FsWatchInstances = /* @__PURE__ */ new Map();
function createFsWatchInstance(path, options, listener, errHandler, emitRaw) {
  const handleEvent = (rawEvent, evPath) => {
    listener(path);
    emitRaw(rawEvent, evPath, { watchedPath: path });
    if (evPath && path !== evPath) {
      fsWatchBroadcast(sysPath.resolve(path, evPath), KEY_LISTENERS, sysPath.join(path, evPath));
    }
  };
  try {
    return fs_watch(path, {
      persistent: options.persistent
    }, handleEvent);
  } catch (error2) {
    errHandler(error2);
    return void 0;
  }
}
var fsWatchBroadcast = (fullPath, listenerType, val1, val2, val3) => {
  const cont = FsWatchInstances.get(fullPath);
  if (!cont)
    return;
  foreach(cont[listenerType], (listener) => {
    listener(val1, val2, val3);
  });
};
var setFsWatchListener = (path, fullPath, options, handlers) => {
  const { listener, errHandler, rawEmitter } = handlers;
  let cont = FsWatchInstances.get(fullPath);
  let watcher;
  if (!options.persistent) {
    watcher = createFsWatchInstance(path, options, listener, errHandler, rawEmitter);
    if (!watcher)
      return;
    return watcher.close.bind(watcher);
  }
  if (cont) {
    addAndConvert(cont, KEY_LISTENERS, listener);
    addAndConvert(cont, KEY_ERR, errHandler);
    addAndConvert(cont, KEY_RAW, rawEmitter);
  } else {
    watcher = createFsWatchInstance(
      path,
      options,
      fsWatchBroadcast.bind(null, fullPath, KEY_LISTENERS),
      errHandler,
      // no need to use broadcast here
      fsWatchBroadcast.bind(null, fullPath, KEY_RAW)
    );
    if (!watcher)
      return;
    watcher.on(EV.ERROR, async (error2) => {
      const broadcastErr = fsWatchBroadcast.bind(null, fullPath, KEY_ERR);
      if (cont)
        cont.watcherUnusable = true;
      if (isWindows && error2.code === "EPERM") {
        try {
          const fd = await open(path, "r");
          await fd.close();
          broadcastErr(error2);
        } catch (err) {
        }
      } else {
        broadcastErr(error2);
      }
    });
    cont = {
      listeners: listener,
      errHandlers: errHandler,
      rawEmitters: rawEmitter,
      watcher
    };
    FsWatchInstances.set(fullPath, cont);
  }
  return () => {
    delFromSet(cont, KEY_LISTENERS, listener);
    delFromSet(cont, KEY_ERR, errHandler);
    delFromSet(cont, KEY_RAW, rawEmitter);
    if (isEmptySet(cont.listeners)) {
      cont.watcher.close();
      FsWatchInstances.delete(fullPath);
      HANDLER_KEYS.forEach(clearItem(cont));
      cont.watcher = void 0;
      Object.freeze(cont);
    }
  };
};
var FsWatchFileInstances = /* @__PURE__ */ new Map();
var setFsWatchFileListener = (path, fullPath, options, handlers) => {
  const { listener, rawEmitter } = handlers;
  let cont = FsWatchFileInstances.get(fullPath);
  const copts = cont && cont.options;
  if (copts && (copts.persistent < options.persistent || copts.interval > options.interval)) {
    unwatchFile(fullPath);
    cont = void 0;
  }
  if (cont) {
    addAndConvert(cont, KEY_LISTENERS, listener);
    addAndConvert(cont, KEY_RAW, rawEmitter);
  } else {
    cont = {
      listeners: listener,
      rawEmitters: rawEmitter,
      options,
      watcher: watchFile(fullPath, options, (curr, prev) => {
        foreach(cont.rawEmitters, (rawEmitter2) => {
          rawEmitter2(EV.CHANGE, fullPath, { curr, prev });
        });
        const currmtime = curr.mtimeMs;
        if (curr.size !== prev.size || currmtime > prev.mtimeMs || currmtime === 0) {
          foreach(cont.listeners, (listener2) => listener2(path, curr));
        }
      })
    };
    FsWatchFileInstances.set(fullPath, cont);
  }
  return () => {
    delFromSet(cont, KEY_LISTENERS, listener);
    delFromSet(cont, KEY_RAW, rawEmitter);
    if (isEmptySet(cont.listeners)) {
      FsWatchFileInstances.delete(fullPath);
      unwatchFile(fullPath);
      cont.options = cont.watcher = void 0;
      Object.freeze(cont);
    }
  };
};
var NodeFsHandler = class {
  constructor(fsW) {
    this.fsw = fsW;
    this._boundHandleError = (error2) => fsW._handleError(error2);
  }
  /**
   * Watch file for changes with fs_watchFile or fs_watch.
   * @param path to file or dir
   * @param listener on fs change
   * @returns closer for the watcher instance
   */
  _watchWithNodeFs(path, listener) {
    const opts = this.fsw.options;
    const directory = sysPath.dirname(path);
    const basename3 = sysPath.basename(path);
    const parent = this.fsw._getWatchedDir(directory);
    parent.add(basename3);
    const absolutePath = sysPath.resolve(path);
    const options = {
      persistent: opts.persistent
    };
    if (!listener)
      listener = EMPTY_FN;
    let closer;
    if (opts.usePolling) {
      const enableBin = opts.interval !== opts.binaryInterval;
      options.interval = enableBin && isBinaryPath(basename3) ? opts.binaryInterval : opts.interval;
      closer = setFsWatchFileListener(path, absolutePath, options, {
        listener,
        rawEmitter: this.fsw._emitRaw
      });
    } else {
      closer = setFsWatchListener(path, absolutePath, options, {
        listener,
        errHandler: this._boundHandleError,
        rawEmitter: this.fsw._emitRaw
      });
    }
    return closer;
  }
  /**
   * Watch a file and emit add event if warranted.
   * @returns closer for the watcher instance
   */
  _handleFile(file, stats, initialAdd) {
    if (this.fsw.closed) {
      return;
    }
    const dirname4 = sysPath.dirname(file);
    const basename3 = sysPath.basename(file);
    const parent = this.fsw._getWatchedDir(dirname4);
    let prevStats = stats;
    if (parent.has(basename3))
      return;
    const listener = async (path, newStats) => {
      if (!this.fsw._throttle(THROTTLE_MODE_WATCH, file, 5))
        return;
      if (!newStats || newStats.mtimeMs === 0) {
        try {
          const newStats2 = await stat3(file);
          if (this.fsw.closed)
            return;
          const at = newStats2.atimeMs;
          const mt = newStats2.mtimeMs;
          if (!at || at <= mt || mt !== prevStats.mtimeMs) {
            this.fsw._emit(EV.CHANGE, file, newStats2);
          }
          if ((isMacos || isLinux || isFreeBSD) && prevStats.ino !== newStats2.ino) {
            this.fsw._closeFile(path);
            prevStats = newStats2;
            const closer2 = this._watchWithNodeFs(file, listener);
            if (closer2)
              this.fsw._addPathCloser(path, closer2);
          } else {
            prevStats = newStats2;
          }
        } catch (error2) {
          this.fsw._remove(dirname4, basename3);
        }
      } else if (parent.has(basename3)) {
        const at = newStats.atimeMs;
        const mt = newStats.mtimeMs;
        if (!at || at <= mt || mt !== prevStats.mtimeMs) {
          this.fsw._emit(EV.CHANGE, file, newStats);
        }
        prevStats = newStats;
      }
    };
    const closer = this._watchWithNodeFs(file, listener);
    if (!(initialAdd && this.fsw.options.ignoreInitial) && this.fsw._isntIgnored(file)) {
      if (!this.fsw._throttle(EV.ADD, file, 0))
        return;
      this.fsw._emit(EV.ADD, file, stats);
    }
    return closer;
  }
  /**
   * Handle symlinks encountered while reading a dir.
   * @param entry returned by readdirp
   * @param directory path of dir being read
   * @param path of this item
   * @param item basename of this item
   * @returns true if no more processing is needed for this entry.
   */
  async _handleSymlink(entry, directory, path, item) {
    if (this.fsw.closed) {
      return;
    }
    const full = entry.fullPath;
    const dir = this.fsw._getWatchedDir(directory);
    if (!this.fsw.options.followSymlinks) {
      this.fsw._incrReadyCount();
      let linkPath;
      try {
        linkPath = await fsrealpath(path);
      } catch (e) {
        this.fsw._emitReady();
        return true;
      }
      if (this.fsw.closed)
        return;
      if (dir.has(item)) {
        if (this.fsw._symlinkPaths.get(full) !== linkPath) {
          this.fsw._symlinkPaths.set(full, linkPath);
          this.fsw._emit(EV.CHANGE, path, entry.stats);
        }
      } else {
        dir.add(item);
        this.fsw._symlinkPaths.set(full, linkPath);
        this.fsw._emit(EV.ADD, path, entry.stats);
      }
      this.fsw._emitReady();
      return true;
    }
    if (this.fsw._symlinkPaths.has(full)) {
      return true;
    }
    this.fsw._symlinkPaths.set(full, true);
  }
  _handleRead(directory, initialAdd, wh, target, dir, depth, throttler) {
    directory = sysPath.join(directory, "");
    throttler = this.fsw._throttle("readdir", directory, 1e3);
    if (!throttler)
      return;
    const previous = this.fsw._getWatchedDir(wh.path);
    const current = /* @__PURE__ */ new Set();
    let stream = this.fsw._readdirp(directory, {
      fileFilter: (entry) => wh.filterPath(entry),
      directoryFilter: (entry) => wh.filterDir(entry)
    });
    if (!stream)
      return;
    stream.on(STR_DATA, async (entry) => {
      if (this.fsw.closed) {
        stream = void 0;
        return;
      }
      const item = entry.path;
      let path = sysPath.join(directory, item);
      current.add(item);
      if (entry.stats.isSymbolicLink() && await this._handleSymlink(entry, directory, path, item)) {
        return;
      }
      if (this.fsw.closed) {
        stream = void 0;
        return;
      }
      if (item === target || !target && !previous.has(item)) {
        this.fsw._incrReadyCount();
        path = sysPath.join(dir, sysPath.relative(dir, path));
        this._addToNodeFs(path, initialAdd, wh, depth + 1);
      }
    }).on(EV.ERROR, this._boundHandleError);
    return new Promise((resolve3, reject) => {
      if (!stream)
        return reject();
      stream.once(STR_END, () => {
        if (this.fsw.closed) {
          stream = void 0;
          return;
        }
        const wasThrottled = throttler ? throttler.clear() : false;
        resolve3(void 0);
        previous.getChildren().filter((item) => {
          return item !== directory && !current.has(item);
        }).forEach((item) => {
          this.fsw._remove(directory, item);
        });
        stream = void 0;
        if (wasThrottled)
          this._handleRead(directory, false, wh, target, dir, depth, throttler);
      });
    });
  }
  /**
   * Read directory to add / remove files from `@watched` list and re-read it on change.
   * @param dir fs path
   * @param stats
   * @param initialAdd
   * @param depth relative to user-supplied path
   * @param target child path targeted for watch
   * @param wh Common watch helpers for this path
   * @param realpath
   * @returns closer for the watcher instance.
   */
  async _handleDir(dir, stats, initialAdd, depth, target, wh, realpath2) {
    const parentDir = this.fsw._getWatchedDir(sysPath.dirname(dir));
    const tracked = parentDir.has(sysPath.basename(dir));
    if (!(initialAdd && this.fsw.options.ignoreInitial) && !target && !tracked) {
      this.fsw._emit(EV.ADD_DIR, dir, stats);
    }
    parentDir.add(sysPath.basename(dir));
    this.fsw._getWatchedDir(dir);
    let throttler;
    let closer;
    const oDepth = this.fsw.options.depth;
    if ((oDepth == null || depth <= oDepth) && !this.fsw._symlinkPaths.has(realpath2)) {
      if (!target) {
        await this._handleRead(dir, initialAdd, wh, target, dir, depth, throttler);
        if (this.fsw.closed)
          return;
      }
      closer = this._watchWithNodeFs(dir, (dirPath, stats2) => {
        if (stats2 && stats2.mtimeMs === 0)
          return;
        this._handleRead(dirPath, false, wh, target, dir, depth, throttler);
      });
    }
    return closer;
  }
  /**
   * Handle added file, directory, or glob pattern.
   * Delegates call to _handleFile / _handleDir after checks.
   * @param path to file or ir
   * @param initialAdd was the file added at watch instantiation?
   * @param priorWh depth relative to user-supplied path
   * @param depth Child path actually targeted for watch
   * @param target Child path actually targeted for watch
   */
  async _addToNodeFs(path, initialAdd, priorWh, depth, target) {
    const ready = this.fsw._emitReady;
    if (this.fsw._isIgnored(path) || this.fsw.closed) {
      ready();
      return false;
    }
    const wh = this.fsw._getWatchHelpers(path);
    if (priorWh) {
      wh.filterPath = (entry) => priorWh.filterPath(entry);
      wh.filterDir = (entry) => priorWh.filterDir(entry);
    }
    try {
      const stats = await statMethods[wh.statMethod](wh.watchPath);
      if (this.fsw.closed)
        return;
      if (this.fsw._isIgnored(wh.watchPath, stats)) {
        ready();
        return false;
      }
      const follow = this.fsw.options.followSymlinks;
      let closer;
      if (stats.isDirectory()) {
        const absPath = sysPath.resolve(path);
        const targetPath = follow ? await fsrealpath(path) : path;
        if (this.fsw.closed)
          return;
        closer = await this._handleDir(wh.watchPath, stats, initialAdd, depth, target, wh, targetPath);
        if (this.fsw.closed)
          return;
        if (absPath !== targetPath && targetPath !== void 0) {
          this.fsw._symlinkPaths.set(absPath, targetPath);
        }
      } else if (stats.isSymbolicLink()) {
        const targetPath = follow ? await fsrealpath(path) : path;
        if (this.fsw.closed)
          return;
        const parent = sysPath.dirname(wh.watchPath);
        this.fsw._getWatchedDir(parent).add(wh.watchPath);
        this.fsw._emit(EV.ADD, wh.watchPath, stats);
        closer = await this._handleDir(parent, stats, initialAdd, depth, path, wh, targetPath);
        if (this.fsw.closed)
          return;
        if (targetPath !== void 0) {
          this.fsw._symlinkPaths.set(sysPath.resolve(path), targetPath);
        }
      } else {
        closer = this._handleFile(wh.watchPath, stats, initialAdd);
      }
      ready();
      if (closer)
        this.fsw._addPathCloser(path, closer);
      return false;
    } catch (error2) {
      if (this.fsw._handleError(error2)) {
        ready();
        return path;
      }
    }
  }
};

// node_modules/chokidar/esm/index.js
var SLASH = "/";
var SLASH_SLASH = "//";
var ONE_DOT = ".";
var TWO_DOTS = "..";
var STRING_TYPE = "string";
var BACK_SLASH_RE = /\\/g;
var DOUBLE_SLASH_RE = /\/\//;
var DOT_RE = /\..*\.(sw[px])$|~$|\.subl.*\.tmp/;
var REPLACER_RE = /^\.[/\\]/;
function arrify(item) {
  return Array.isArray(item) ? item : [item];
}
var isMatcherObject = (matcher) => typeof matcher === "object" && matcher !== null && !(matcher instanceof RegExp);
function createPattern(matcher) {
  if (typeof matcher === "function")
    return matcher;
  if (typeof matcher === "string")
    return (string) => matcher === string;
  if (matcher instanceof RegExp)
    return (string) => matcher.test(string);
  if (typeof matcher === "object" && matcher !== null) {
    return (string) => {
      if (matcher.path === string)
        return true;
      if (matcher.recursive) {
        const relative3 = sysPath2.relative(matcher.path, string);
        if (!relative3) {
          return false;
        }
        return !relative3.startsWith("..") && !sysPath2.isAbsolute(relative3);
      }
      return false;
    };
  }
  return () => false;
}
function normalizePath(path) {
  if (typeof path !== "string")
    throw new Error("string expected");
  path = sysPath2.normalize(path);
  path = path.replace(/\\/g, "/");
  let prepend = false;
  if (path.startsWith("//"))
    prepend = true;
  const DOUBLE_SLASH_RE2 = /\/\//;
  while (path.match(DOUBLE_SLASH_RE2))
    path = path.replace(DOUBLE_SLASH_RE2, "/");
  if (prepend)
    path = "/" + path;
  return path;
}
function matchPatterns(patterns, testString, stats) {
  const path = normalizePath(testString);
  for (let index = 0; index < patterns.length; index++) {
    const pattern = patterns[index];
    if (pattern(path, stats)) {
      return true;
    }
  }
  return false;
}
function anymatch(matchers, testString) {
  if (matchers == null) {
    throw new TypeError("anymatch: specify first argument");
  }
  const matchersArray = arrify(matchers);
  const patterns = matchersArray.map((matcher) => createPattern(matcher));
  if (testString == null) {
    return (testString2, stats) => {
      return matchPatterns(patterns, testString2, stats);
    };
  }
  return matchPatterns(patterns, testString);
}
var unifyPaths = (paths_) => {
  const paths = arrify(paths_).flat();
  if (!paths.every((p) => typeof p === STRING_TYPE)) {
    throw new TypeError(`Non-string provided as watch path: ${paths}`);
  }
  return paths.map(normalizePathToUnix);
};
var toUnix = (string) => {
  let str = string.replace(BACK_SLASH_RE, SLASH);
  let prepend = false;
  if (str.startsWith(SLASH_SLASH)) {
    prepend = true;
  }
  while (str.match(DOUBLE_SLASH_RE)) {
    str = str.replace(DOUBLE_SLASH_RE, SLASH);
  }
  if (prepend) {
    str = SLASH + str;
  }
  return str;
};
var normalizePathToUnix = (path) => toUnix(sysPath2.normalize(toUnix(path)));
var normalizeIgnored = (cwd = "") => (path) => {
  if (typeof path === "string") {
    return normalizePathToUnix(sysPath2.isAbsolute(path) ? path : sysPath2.join(cwd, path));
  } else {
    return path;
  }
};
var getAbsolutePath = (path, cwd) => {
  if (sysPath2.isAbsolute(path)) {
    return path;
  }
  return sysPath2.join(cwd, path);
};
var EMPTY_SET = Object.freeze(/* @__PURE__ */ new Set());
var DirEntry = class {
  constructor(dir, removeWatcher) {
    this.path = dir;
    this._removeWatcher = removeWatcher;
    this.items = /* @__PURE__ */ new Set();
  }
  add(item) {
    const { items } = this;
    if (!items)
      return;
    if (item !== ONE_DOT && item !== TWO_DOTS)
      items.add(item);
  }
  async remove(item) {
    const { items } = this;
    if (!items)
      return;
    items.delete(item);
    if (items.size > 0)
      return;
    const dir = this.path;
    try {
      await readdir3(dir);
    } catch (err) {
      if (this._removeWatcher) {
        this._removeWatcher(sysPath2.dirname(dir), sysPath2.basename(dir));
      }
    }
  }
  has(item) {
    const { items } = this;
    if (!items)
      return;
    return items.has(item);
  }
  getChildren() {
    const { items } = this;
    if (!items)
      return [];
    return [...items.values()];
  }
  dispose() {
    this.items.clear();
    this.path = "";
    this._removeWatcher = EMPTY_FN;
    this.items = EMPTY_SET;
    Object.freeze(this);
  }
};
var STAT_METHOD_F = "stat";
var STAT_METHOD_L = "lstat";
var WatchHelper = class {
  constructor(path, follow, fsw) {
    this.fsw = fsw;
    const watchPath = path;
    this.path = path = path.replace(REPLACER_RE, "");
    this.watchPath = watchPath;
    this.fullWatchPath = sysPath2.resolve(watchPath);
    this.dirParts = [];
    this.dirParts.forEach((parts) => {
      if (parts.length > 1)
        parts.pop();
    });
    this.followSymlinks = follow;
    this.statMethod = follow ? STAT_METHOD_F : STAT_METHOD_L;
  }
  entryPath(entry) {
    return sysPath2.join(this.watchPath, sysPath2.relative(this.watchPath, entry.fullPath));
  }
  filterPath(entry) {
    const { stats } = entry;
    if (stats && stats.isSymbolicLink())
      return this.filterDir(entry);
    const resolvedPath = this.entryPath(entry);
    return this.fsw._isntIgnored(resolvedPath, stats) && this.fsw._hasReadPermissions(stats);
  }
  filterDir(entry) {
    return this.fsw._isntIgnored(this.entryPath(entry), entry.stats);
  }
};
var FSWatcher = class extends EventEmitter {
  // Not indenting methods for history sake; for now.
  constructor(_opts = {}) {
    super();
    this.closed = false;
    this._closers = /* @__PURE__ */ new Map();
    this._ignoredPaths = /* @__PURE__ */ new Set();
    this._throttled = /* @__PURE__ */ new Map();
    this._streams = /* @__PURE__ */ new Set();
    this._symlinkPaths = /* @__PURE__ */ new Map();
    this._watched = /* @__PURE__ */ new Map();
    this._pendingWrites = /* @__PURE__ */ new Map();
    this._pendingUnlinks = /* @__PURE__ */ new Map();
    this._readyCount = 0;
    this._readyEmitted = false;
    const awf = _opts.awaitWriteFinish;
    const DEF_AWF = { stabilityThreshold: 2e3, pollInterval: 100 };
    const opts = {
      // Defaults
      persistent: true,
      ignoreInitial: false,
      ignorePermissionErrors: false,
      interval: 100,
      binaryInterval: 300,
      followSymlinks: true,
      usePolling: false,
      // useAsync: false,
      atomic: true,
      // NOTE: overwritten later (depends on usePolling)
      ..._opts,
      // Change format
      ignored: _opts.ignored ? arrify(_opts.ignored) : arrify([]),
      awaitWriteFinish: awf === true ? DEF_AWF : typeof awf === "object" ? { ...DEF_AWF, ...awf } : false
    };
    if (isIBMi)
      opts.usePolling = true;
    if (opts.atomic === void 0)
      opts.atomic = !opts.usePolling;
    const envPoll = process.env.CHOKIDAR_USEPOLLING;
    if (envPoll !== void 0) {
      const envLower = envPoll.toLowerCase();
      if (envLower === "false" || envLower === "0")
        opts.usePolling = false;
      else if (envLower === "true" || envLower === "1")
        opts.usePolling = true;
      else
        opts.usePolling = !!envLower;
    }
    const envInterval = process.env.CHOKIDAR_INTERVAL;
    if (envInterval)
      opts.interval = Number.parseInt(envInterval, 10);
    let readyCalls = 0;
    this._emitReady = () => {
      readyCalls++;
      if (readyCalls >= this._readyCount) {
        this._emitReady = EMPTY_FN;
        this._readyEmitted = true;
        process.nextTick(() => this.emit(EVENTS.READY));
      }
    };
    this._emitRaw = (...args) => this.emit(EVENTS.RAW, ...args);
    this._boundRemove = this._remove.bind(this);
    this.options = opts;
    this._nodeFsHandler = new NodeFsHandler(this);
    Object.freeze(opts);
  }
  _addIgnoredPath(matcher) {
    if (isMatcherObject(matcher)) {
      for (const ignored of this._ignoredPaths) {
        if (isMatcherObject(ignored) && ignored.path === matcher.path && ignored.recursive === matcher.recursive) {
          return;
        }
      }
    }
    this._ignoredPaths.add(matcher);
  }
  _removeIgnoredPath(matcher) {
    this._ignoredPaths.delete(matcher);
    if (typeof matcher === "string") {
      for (const ignored of this._ignoredPaths) {
        if (isMatcherObject(ignored) && ignored.path === matcher) {
          this._ignoredPaths.delete(ignored);
        }
      }
    }
  }
  // Public methods
  /**
   * Adds paths to be watched on an existing FSWatcher instance.
   * @param paths_ file or file list. Other arguments are unused
   */
  add(paths_, _origAdd, _internal) {
    const { cwd } = this.options;
    this.closed = false;
    this._closePromise = void 0;
    let paths = unifyPaths(paths_);
    if (cwd) {
      paths = paths.map((path) => {
        const absPath = getAbsolutePath(path, cwd);
        return absPath;
      });
    }
    paths.forEach((path) => {
      this._removeIgnoredPath(path);
    });
    this._userIgnored = void 0;
    if (!this._readyCount)
      this._readyCount = 0;
    this._readyCount += paths.length;
    Promise.all(paths.map(async (path) => {
      const res = await this._nodeFsHandler._addToNodeFs(path, !_internal, void 0, 0, _origAdd);
      if (res)
        this._emitReady();
      return res;
    })).then((results) => {
      if (this.closed)
        return;
      results.forEach((item) => {
        if (item)
          this.add(sysPath2.dirname(item), sysPath2.basename(_origAdd || item));
      });
    });
    return this;
  }
  /**
   * Close watchers or start ignoring events from specified paths.
   */
  unwatch(paths_) {
    if (this.closed)
      return this;
    const paths = unifyPaths(paths_);
    const { cwd } = this.options;
    paths.forEach((path) => {
      if (!sysPath2.isAbsolute(path) && !this._closers.has(path)) {
        if (cwd)
          path = sysPath2.join(cwd, path);
        path = sysPath2.resolve(path);
      }
      this._closePath(path);
      this._addIgnoredPath(path);
      if (this._watched.has(path)) {
        this._addIgnoredPath({
          path,
          recursive: true
        });
      }
      this._userIgnored = void 0;
    });
    return this;
  }
  /**
   * Close watchers and remove all listeners from watched paths.
   */
  close() {
    if (this._closePromise) {
      return this._closePromise;
    }
    this.closed = true;
    this.removeAllListeners();
    const closers = [];
    this._closers.forEach((closerList) => closerList.forEach((closer) => {
      const promise = closer();
      if (promise instanceof Promise)
        closers.push(promise);
    }));
    this._streams.forEach((stream) => stream.destroy());
    this._userIgnored = void 0;
    this._readyCount = 0;
    this._readyEmitted = false;
    this._watched.forEach((dirent) => dirent.dispose());
    this._closers.clear();
    this._watched.clear();
    this._streams.clear();
    this._symlinkPaths.clear();
    this._throttled.clear();
    this._closePromise = closers.length ? Promise.all(closers).then(() => void 0) : Promise.resolve();
    return this._closePromise;
  }
  /**
   * Expose list of watched paths
   * @returns for chaining
   */
  getWatched() {
    const watchList = {};
    this._watched.forEach((entry, dir) => {
      const key = this.options.cwd ? sysPath2.relative(this.options.cwd, dir) : dir;
      const index = key || ONE_DOT;
      watchList[index] = entry.getChildren().sort();
    });
    return watchList;
  }
  emitWithAll(event, args) {
    this.emit(event, ...args);
    if (event !== EVENTS.ERROR)
      this.emit(EVENTS.ALL, event, ...args);
  }
  // Common helpers
  // --------------
  /**
   * Normalize and emit events.
   * Calling _emit DOES NOT MEAN emit() would be called!
   * @param event Type of event
   * @param path File or directory path
   * @param stats arguments to be passed with event
   * @returns the error if defined, otherwise the value of the FSWatcher instance's `closed` flag
   */
  async _emit(event, path, stats) {
    if (this.closed)
      return;
    const opts = this.options;
    if (isWindows)
      path = sysPath2.normalize(path);
    if (opts.cwd)
      path = sysPath2.relative(opts.cwd, path);
    const args = [path];
    if (stats != null)
      args.push(stats);
    const awf = opts.awaitWriteFinish;
    let pw;
    if (awf && (pw = this._pendingWrites.get(path))) {
      pw.lastChange = /* @__PURE__ */ new Date();
      return this;
    }
    if (opts.atomic) {
      if (event === EVENTS.UNLINK) {
        this._pendingUnlinks.set(path, [event, ...args]);
        setTimeout(() => {
          this._pendingUnlinks.forEach((entry, path2) => {
            this.emit(...entry);
            this.emit(EVENTS.ALL, ...entry);
            this._pendingUnlinks.delete(path2);
          });
        }, typeof opts.atomic === "number" ? opts.atomic : 100);
        return this;
      }
      if (event === EVENTS.ADD && this._pendingUnlinks.has(path)) {
        event = EVENTS.CHANGE;
        this._pendingUnlinks.delete(path);
      }
    }
    if (awf && (event === EVENTS.ADD || event === EVENTS.CHANGE) && this._readyEmitted) {
      const awfEmit = (err, stats2) => {
        if (err) {
          event = EVENTS.ERROR;
          args[0] = err;
          this.emitWithAll(event, args);
        } else if (stats2) {
          if (args.length > 1) {
            args[1] = stats2;
          } else {
            args.push(stats2);
          }
          this.emitWithAll(event, args);
        }
      };
      this._awaitWriteFinish(path, awf.stabilityThreshold, event, awfEmit);
      return this;
    }
    if (event === EVENTS.CHANGE) {
      const isThrottled = !this._throttle(EVENTS.CHANGE, path, 50);
      if (isThrottled)
        return this;
    }
    if (opts.alwaysStat && stats === void 0 && (event === EVENTS.ADD || event === EVENTS.ADD_DIR || event === EVENTS.CHANGE)) {
      const fullPath = opts.cwd ? sysPath2.join(opts.cwd, path) : path;
      let stats2;
      try {
        stats2 = await stat4(fullPath);
      } catch (err) {
      }
      if (!stats2 || this.closed)
        return;
      args.push(stats2);
    }
    this.emitWithAll(event, args);
    return this;
  }
  /**
   * Common handler for errors
   * @returns The error if defined, otherwise the value of the FSWatcher instance's `closed` flag
   */
  _handleError(error2) {
    const code = error2 && error2.code;
    if (error2 && code !== "ENOENT" && code !== "ENOTDIR" && (!this.options.ignorePermissionErrors || code !== "EPERM" && code !== "EACCES")) {
      this.emit(EVENTS.ERROR, error2);
    }
    return error2 || this.closed;
  }
  /**
   * Helper utility for throttling
   * @param actionType type being throttled
   * @param path being acted upon
   * @param timeout duration of time to suppress duplicate actions
   * @returns tracking object or false if action should be suppressed
   */
  _throttle(actionType, path, timeout) {
    if (!this._throttled.has(actionType)) {
      this._throttled.set(actionType, /* @__PURE__ */ new Map());
    }
    const action = this._throttled.get(actionType);
    if (!action)
      throw new Error("invalid throttle");
    const actionPath = action.get(path);
    if (actionPath) {
      actionPath.count++;
      return false;
    }
    let timeoutObject;
    const clear = () => {
      const item = action.get(path);
      const count = item ? item.count : 0;
      action.delete(path);
      clearTimeout(timeoutObject);
      if (item)
        clearTimeout(item.timeoutObject);
      return count;
    };
    timeoutObject = setTimeout(clear, timeout);
    const thr = { timeoutObject, clear, count: 0 };
    action.set(path, thr);
    return thr;
  }
  _incrReadyCount() {
    return this._readyCount++;
  }
  /**
   * Awaits write operation to finish.
   * Polls a newly created file for size variations. When files size does not change for 'threshold' milliseconds calls callback.
   * @param path being acted upon
   * @param threshold Time in milliseconds a file size must be fixed before acknowledging write OP is finished
   * @param event
   * @param awfEmit Callback to be called when ready for event to be emitted.
   */
  _awaitWriteFinish(path, threshold, event, awfEmit) {
    const awf = this.options.awaitWriteFinish;
    if (typeof awf !== "object")
      return;
    const pollInterval = awf.pollInterval;
    let timeoutHandler;
    let fullPath = path;
    if (this.options.cwd && !sysPath2.isAbsolute(path)) {
      fullPath = sysPath2.join(this.options.cwd, path);
    }
    const now = /* @__PURE__ */ new Date();
    const writes = this._pendingWrites;
    function awaitWriteFinishFn(prevStat) {
      statcb(fullPath, (err, curStat) => {
        if (err || !writes.has(path)) {
          if (err && err.code !== "ENOENT")
            awfEmit(err);
          return;
        }
        const now2 = Number(/* @__PURE__ */ new Date());
        if (prevStat && curStat.size !== prevStat.size) {
          writes.get(path).lastChange = now2;
        }
        const pw = writes.get(path);
        const df = now2 - pw.lastChange;
        if (df >= threshold) {
          writes.delete(path);
          awfEmit(void 0, curStat);
        } else {
          timeoutHandler = setTimeout(awaitWriteFinishFn, pollInterval, curStat);
        }
      });
    }
    if (!writes.has(path)) {
      writes.set(path, {
        lastChange: now,
        cancelWait: () => {
          writes.delete(path);
          clearTimeout(timeoutHandler);
          return event;
        }
      });
      timeoutHandler = setTimeout(awaitWriteFinishFn, pollInterval);
    }
  }
  /**
   * Determines whether user has asked to ignore this path.
   */
  _isIgnored(path, stats) {
    if (this.options.atomic && DOT_RE.test(path))
      return true;
    if (!this._userIgnored) {
      const { cwd } = this.options;
      const ign = this.options.ignored;
      const ignored = (ign || []).map(normalizeIgnored(cwd));
      const ignoredPaths = [...this._ignoredPaths];
      const list = [...ignoredPaths.map(normalizeIgnored(cwd)), ...ignored];
      this._userIgnored = anymatch(list, void 0);
    }
    return this._userIgnored(path, stats);
  }
  _isntIgnored(path, stat5) {
    return !this._isIgnored(path, stat5);
  }
  /**
   * Provides a set of common helpers and properties relating to symlink handling.
   * @param path file or directory pattern being watched
   */
  _getWatchHelpers(path) {
    return new WatchHelper(path, this.options.followSymlinks, this);
  }
  // Directory helpers
  // -----------------
  /**
   * Provides directory tracking objects
   * @param directory path of the directory
   */
  _getWatchedDir(directory) {
    const dir = sysPath2.resolve(directory);
    if (!this._watched.has(dir))
      this._watched.set(dir, new DirEntry(dir, this._boundRemove));
    return this._watched.get(dir);
  }
  // File helpers
  // ------------
  /**
   * Check for read permissions: https://stackoverflow.com/a/11781404/1358405
   */
  _hasReadPermissions(stats) {
    if (this.options.ignorePermissionErrors)
      return true;
    return Boolean(Number(stats.mode) & 256);
  }
  /**
   * Handles emitting unlink events for
   * files and directories, and via recursion, for
   * files and directories within directories that are unlinked
   * @param directory within which the following item is located
   * @param item      base path of item/directory
   */
  _remove(directory, item, isDirectory) {
    const path = sysPath2.join(directory, item);
    const fullPath = sysPath2.resolve(path);
    isDirectory = isDirectory != null ? isDirectory : this._watched.has(path) || this._watched.has(fullPath);
    if (!this._throttle("remove", path, 100))
      return;
    if (!isDirectory && this._watched.size === 1) {
      this.add(directory, item, true);
    }
    const wp = this._getWatchedDir(path);
    const nestedDirectoryChildren = wp.getChildren();
    nestedDirectoryChildren.forEach((nested) => this._remove(path, nested));
    const parent = this._getWatchedDir(directory);
    const wasTracked = parent.has(item);
    parent.remove(item);
    if (this._symlinkPaths.has(fullPath)) {
      this._symlinkPaths.delete(fullPath);
    }
    let relPath = path;
    if (this.options.cwd)
      relPath = sysPath2.relative(this.options.cwd, path);
    if (this.options.awaitWriteFinish && this._pendingWrites.has(relPath)) {
      const event = this._pendingWrites.get(relPath).cancelWait();
      if (event === EVENTS.ADD)
        return;
    }
    this._watched.delete(path);
    this._watched.delete(fullPath);
    const eventName = isDirectory ? EVENTS.UNLINK_DIR : EVENTS.UNLINK;
    if (wasTracked && !this._isIgnored(path))
      this._emit(eventName, path);
    this._closePath(path);
  }
  /**
   * Closes all watchers for a path
   */
  _closePath(path) {
    this._closeFile(path);
    const dir = sysPath2.dirname(path);
    this._getWatchedDir(dir).remove(sysPath2.basename(path));
  }
  /**
   * Closes only file-specific watchers
   */
  _closeFile(path) {
    const closers = this._closers.get(path);
    if (!closers)
      return;
    closers.forEach((closer) => closer());
    this._closers.delete(path);
  }
  _addPathCloser(path, closer) {
    if (!closer)
      return;
    let list = this._closers.get(path);
    if (!list) {
      list = [];
      this._closers.set(path, list);
    }
    list.push(closer);
  }
  _readdirp(root, opts) {
    if (this.closed)
      return;
    const options = { type: EVENTS.ALL, alwaysStat: true, lstat: true, ...opts, depth: 0 };
    let stream = readdirp(root, options);
    this._streams.add(stream);
    stream.once(STR_CLOSE, () => {
      stream = void 0;
    });
    stream.once(STR_END, () => {
      if (stream) {
        this._streams.delete(stream);
        stream = void 0;
      }
    });
    return stream;
  }
};
function watch(paths, options = {}) {
  const watcher = new FSWatcher(options);
  watcher.add(paths);
  return watcher;
}
var esm_default = { watch, FSWatcher };

// ccud/src/handlers/watch.js
var activeWatchers = /* @__PURE__ */ new Map();
function flushEvents(state, watchPath) {
  if (state.pendingEvents.length === 0) return;
  const events = state.pendingEvents.splice(0);
  state.transport.send({
    jsonrpc: "2.0",
    method: "watch/change",
    params: { watchPath, events }
  });
}
function queueEvent(state, watchPath, event, filePath) {
  state.pendingEvents.push({ event, filePath });
  clearTimeout(state.debounceTimer);
  state.debounceTimer = setTimeout(() => flushEvents(state, watchPath), 300);
}
async function handleWatch(method, params, transport2) {
  switch (method) {
    case "watch/start": {
      if (activeWatchers.has(params.path)) {
        return { already: true };
      }
      const watcher = esm_default.watch(params.path, {
        ignored: [
          "**/node_modules/**",
          "**/.git/**",
          "**/dist/**",
          "**/build/**",
          ...params.options?.ignored || []
        ],
        persistent: true,
        ignoreInitial: true,
        depth: params.options?.depth ?? 10
      });
      const state = {
        watcher,
        transport: transport2,
        debounceTimer: null,
        pendingEvents: []
      };
      watcher.on("add", (filePath) => queueEvent(state, params.path, "add", filePath));
      watcher.on("change", (filePath) => queueEvent(state, params.path, "change", filePath));
      watcher.on("unlink", (filePath) => queueEvent(state, params.path, "unlink", filePath));
      watcher.on("addDir", (filePath) => queueEvent(state, params.path, "addDir", filePath));
      watcher.on("unlinkDir", (filePath) => queueEvent(state, params.path, "unlinkDir", filePath));
      watcher.on("error", (err) => console.error("[watch] Error:", err.message));
      activeWatchers.set(params.path, state);
      return { started: true };
    }
    case "watch/stop": {
      const state = activeWatchers.get(params.path);
      if (!state) {
        return { stopped: false };
      }
      await state.watcher.close();
      clearTimeout(state.debounceTimer);
      activeWatchers.delete(params.path);
      return { stopped: true };
    }
    default:
      return { error: { code: -32601, message: "Method not found: " + method } };
  }
}
function cleanupAllWatchers() {
  for (const [path, state] of activeWatchers) {
    clearTimeout(state.debounceTimer);
    state.watcher.close().catch(() => {
    });
    activeWatchers.delete(path);
  }
}

// ccud/src/handlers/claude.js
import { spawn, execFile as execFile2 } from "child_process";
import { promisify as promisify2 } from "util";
import crypto from "crypto";
var execFileAsync2 = promisify2(execFile2);
var activeSessions = /* @__PURE__ */ new Map();
async function isClaudeAvailable() {
  try {
    await execFileAsync2("command", ["-v", "claude"], { shell: true, timeout: 5e3 });
    return true;
  } catch {
    return false;
  }
}
async function handleClaude(method, params, transport2) {
  switch (method) {
    case "claude/start": {
      const available = await isClaudeAvailable();
      if (!available) {
        return {
          error: {
            code: -32e3,
            message: "Claude Code CLI not found on remote host. Install it with: npm install -g @anthropic-ai/claude-code"
          }
        };
      }
      const sessionId = params.sessionId || crypto.randomUUID();
      const args = ["--output-format", "stream-json", "--verbose"];
      if (params.resume && params.sessionId) {
        args.push("--resume", params.sessionId);
      }
      if (params.options?.model) {
        args.push("--model", params.options.model);
      }
      if (params.options?.permissionMode) {
        args.push("--permission-mode", params.options.permissionMode);
      }
      if (params.command) {
        args.push("-p", params.command);
      }
      let proc;
      try {
        proc = spawn("claude", args, {
          cwd: params.cwd,
          env: { ...process.env, TERM: "dumb" },
          stdio: ["pipe", "pipe", "pipe"]
        });
      } catch (err) {
        return {
          error: {
            code: -32e3,
            message: "Failed to spawn Claude CLI: " + err.message
          }
        };
      }
      activeSessions.set(sessionId, { process: proc, cwd: params.cwd });
      let accumulatedText = "";
      let buffer = "";
      proc.stdout.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            if ((event.type === "assistant" || event.type === "message") && event.message?.content) {
              for (const block of event.message.content) {
                if (block.type === "text" && block.text) {
                  accumulatedText += block.text;
                }
              }
            }
            if (event.type === "result" && typeof event.result === "string") {
              if (!accumulatedText) accumulatedText = event.result;
            }
            transport2.send({
              jsonrpc: "2.0",
              method: "claude/output",
              params: { sessionId, event }
            });
          } catch {
            transport2.send({
              jsonrpc: "2.0",
              method: "claude/output",
              params: { sessionId, event: { type: "raw", text: line } }
            });
          }
        }
      });
      proc.stderr.on("data", (chunk) => {
        const text = chunk.toString().trim();
        if (text) {
          transport2.send({
            jsonrpc: "2.0",
            method: "claude/output",
            params: { sessionId, event: { type: "stderr", text } }
          });
        }
      });
      proc.on("exit", (code, signal) => {
        activeSessions.delete(sessionId);
        transport2.send({
          jsonrpc: "2.0",
          method: "claude/output",
          params: { sessionId, event: { type: "exit", code, signal, accumulatedText: accumulatedText || null } }
        });
      });
      proc.on("error", (err) => {
        activeSessions.delete(sessionId);
        transport2.send({
          jsonrpc: "2.0",
          method: "claude/output",
          params: { sessionId, event: { type: "exit", code: 1, signal: null, error: err.message } }
        });
      });
      return { sessionId, started: true };
    }
    case "claude/input": {
      const session = activeSessions.get(params.sessionId);
      if (!session) {
        return { error: { code: -32e3, message: "Session not found" } };
      }
      try {
        session.process.stdin.write(params.text + "\n");
      } catch (err) {
        return { error: { code: -32e3, message: "Failed to write to stdin: " + err.message } };
      }
      return { sent: true };
    }
    case "claude/abort": {
      const session = activeSessions.get(params.sessionId);
      if (session) {
        session.process.kill("SIGTERM");
        const killTimer = setTimeout(() => {
          try {
            session.process.kill("SIGKILL");
          } catch {
          }
        }, 5e3);
        session.process.on("exit", () => clearTimeout(killTimer));
        activeSessions.delete(params.sessionId);
      }
      return { aborted: true };
    }
    case "claude/list-sessions": {
      try {
        const { stdout } = await execFileAsync2(
          "claude",
          ["--output-format", "json", "sessions", "list"],
          { cwd: params.cwd, timeout: 15e3 }
        );
        const sessions = JSON.parse(stdout);
        return { sessions: Array.isArray(sessions) ? sessions : [] };
      } catch {
        return { sessions: [], error: "Failed to list sessions" };
      }
    }
    default:
      return { error: { code: -32601, message: "Method not found: " + method } };
  }
}
function cleanupAllClaudeSessions() {
  for (const [sessionId, session] of activeSessions) {
    try {
      session.process.kill("SIGTERM");
    } catch {
    }
    activeSessions.delete(sessionId);
  }
}

// ccud/src/index.js
writePidFile();
async function processSingleMessage(msg) {
  if (!msg.method) return null;
  const isNotification = msg.id === void 0 || msg.id === null;
  let result;
  let errorResult;
  if (msg.method === "initialize") {
    result = handleInitialize(msg.params);
  } else if (msg.method.startsWith("fs/")) {
    const fsResult = await handleFs(msg.method, msg.params);
    if (fsResult.error) {
      errorResult = fsResult.error;
    } else {
      result = fsResult;
    }
  } else if (msg.method.startsWith("git/")) {
    const gitResult = await handleGit(msg.method, msg.params);
    if (gitResult.error) {
      errorResult = gitResult.error;
    } else {
      result = gitResult;
    }
  } else if (msg.method.startsWith("watch/")) {
    const watchResult = await handleWatch(msg.method, msg.params, transport);
    if (watchResult.error) {
      errorResult = watchResult.error;
    } else {
      result = watchResult;
    }
  } else if (msg.method.startsWith("claude/")) {
    const claudeResult = await handleClaude(msg.method, msg.params, transport);
    if (claudeResult.error) {
      errorResult = claudeResult.error;
    } else {
      result = claudeResult;
    }
  } else {
    errorResult = { code: -32601, message: "Method not found" };
  }
  if (isNotification) return null;
  if (errorResult) {
    return import_jsonrpc_lite2.default.error(msg.id, new import_jsonrpc_lite2.default.JsonRpcError(errorResult.message, errorResult.code));
  }
  return import_jsonrpc_lite2.default.success(msg.id, result);
}
async function handleIncoming(msg) {
  if (Array.isArray(msg)) {
    const results = await Promise.all(msg.map((m) => processSingleMessage(m)));
    const responses = results.filter(Boolean);
    if (responses.length) transport.send(responses);
    return;
  }
  const response = await processSingleMessage(msg);
  if (response) transport.send(response);
}
var transport = createStdioTransport(handleIncoming);
var cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  cleanupAllWatchers();
  cleanupAllClaudeSessions();
  removePidFile();
  try {
    process.kill(-process.pid, "SIGTERM");
  } catch (e) {
  }
}
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
process.on("exit", cleanup);
log("Daemon started, PID " + process.pid);
/*! Bundled license information:

chokidar/esm/index.js:
  (*! chokidar - MIT License (c) 2012 Paul Miller (paulmillr.com) *)
*/
