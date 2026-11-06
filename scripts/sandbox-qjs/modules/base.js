const STORAGE_FILE = "storage/storage.json";

/**
 * 从文件加载缓存
 * @returns {}
 */
function loadStorage() {
  try {
    const text = std.loadFile(STORAGE_FILE);
    if (text === null) return {};
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

/**
 * 持久化缓存到文件
 * @param {{}} obj 缓存数据
 */
function saveStorage(obj) {
  const f = std.open(STORAGE_FILE, "w");
  if (!f) throw new Error("cannot open storage file for write");
  f.puts(JSON.stringify(obj));
  f.close();
}

/**
 * 挂账到 _storage 上
 * @param {string} action 行为
 * @param {string} key 键
 * @param {{}} value 缓存数据
 * @returns 行为结果
 */
globalThis._storage = function (action, key, value) {
  const store = loadStorage();
  switch (action) {
    case "get":
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    case "set":
      store[key] = String(value);
      saveStorage(store);
      return true;
    case "remove":
      delete store[key];
      saveStorage(store);
      return true;
  }
  return null;
};

globalThis.__COMMON__ = {
  async getCache(key) {
    if (typeof globalThis._storage !== 'function') return null;
    try {
      const v = await globalThis._storage('get', key);
      return v == null ? null : String(v);
    } catch (e) {
      return null;
    }
  },

  async setCache(key, value) {
    if (typeof globalThis._storage !== 'function') return false;
    try {
      await globalThis._storage('set', key, String(value));
      return true;
    } catch (e) {
      return false;
    }
  },

  async removeCache(key) {
    if (typeof globalThis._storage !== 'function') return false;
    try {
      await globalThis._storage('remove', key);
      return true;
    } catch (e) {
      return false;
    }
  },
};


/**
 * 模拟 Flutter 打印
 * @param {string} text 打印文本
 */
globalThis.sniffLog = function (text) {
  console.log('[sniffLog]', String(text));
};

/**
 * 模拟 Flutter 和 JS 通信
 * @param {{}} payload 发送内容
 */
globalThis.sendToFlutter = function (payload) {
  console.log('[sendToFlutter]', JSON.stringify(payload));
};

globalThis.__SOURCES__ = globalThis.__SOURCES__ || {};
globalThis.__CALL__ = async function (sourceName, method, args) {
  const src = globalThis.__SOURCES__[sourceName];
  if (!src) throw new Error('source not loaded: ' + sourceName);
  const fn = src.methods && src.methods[method];
  if (typeof fn !== 'function') {
    throw new Error('method not found: ' + sourceName + '.' + method);
  }
  const callArgs = Array.isArray(args) ? args : (args === undefined ? [] : [args]);
  return await fn(...callArgs);
};

globalThis.__FETCH_LOG_INITED__ = false;
globalThis.fetch = async function (url, options) {
  const opts = options || {};
  const method = (opts.method || "GET").toUpperCase();
  const headers = opts.headers || {};
  const body = opts.body;

  const OUT_DIR = "logs";
  const LOG_FILE = OUT_DIR + "/fetch_log.txt";
  const BODY_TMP = OUT_DIR + "/tmp_fetch_body.bin";
  const HDR_TMP = OUT_DIR + "/tmp_fetch_headers.txt";
  const RESP_TMP = OUT_DIR + "/tmp_fetch_resp.bin";

  function appendLog(text) {
    const mode = globalThis.__FETCH_LOG_INITED__ ? "a" : "w";
    const f = std.open(LOG_FILE, mode);
    if (f) {
      f.puts(text);
      f.close();
    }
    globalThis.__FETCH_LOG_INITED__ = true;
  }

  const args = ["curl", "-s", "-S", "-X", method, url];
  for (const k in headers) {
    args.push("-H", k + ": " + headers[k]);
  }

  let bodyFile = null;
  if (body != null) {
    let bytes;
    if (typeof body === "string") {
      bytes = Array.from(body).map(c => c.charCodeAt(0) & 0xff);
    } else if (body instanceof Uint8Array) {
      bytes = Array.from(body);
    } else if (Array.isArray(body)) {
      bytes = body;
    } else {
      bytes = Array.from(String(body)).map(c => c.charCodeAt(0) & 0xff);
    }
    bodyFile = BODY_TMP;
    const f = std.open(bodyFile, "wb");
    for (const b of bytes) f.putByte(b);
    f.close();

    // === 写后读回，逐字节对比 ===
    const written = [];
    const rf = std.open(bodyFile, "rb");
    if (rf) {
      let wb;
      while ((wb = rf.getByte()) !== -1) written.push(wb);
      rf.close();
    }
    if (written.length !== bytes.length) {
      appendLog("WRITE LEN MISMATCH: wrote " + written.length + " expected " + bytes.length + "\n");
    } else {
      let mismatch = -1;
      for (let i = 0; i < bytes.length; i++) {
        if (written[i] !== (Number(bytes[i]) & 0xff)) { mismatch = i; break; }
      }
      appendLog(mismatch >= 0
        ? "WRITE DIFF at " + mismatch + ": wrote " + written[mismatch] + " expected " + (Number(bytes[mismatch]) & 0xff) + "\n"
        : "WRITE OK len=" + bytes.length + "\n");
    }
    // === 对比结束 ===

    args.push("--data-binary", "@" + bodyFile);
  }

  args.push("-D", HDR_TMP, "-o", RESP_TMP);

  function quoteArg(a) {
    const s = String(a);
    if (/[\s&|<>^"]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }
  const cmd = args.map(quoteArg).join(" ");

  appendLog("\n===== REQUEST =====\n");
  appendLog("time: " + new Date().toISOString() + "\n");
  appendLog("cmd: " + cmd + "\n");
  if (bodyFile) appendLog("body-bytes: written\n");

  const p = std.popen(cmd, "r");
  const exitCode = p.close();
  appendLog("curl exit: " + exitCode + "\n");

  const hdrText = std.loadFile(HDR_TMP) || "";
  const statusLine = hdrText.split(/\r?\n/)[0] || "";
  const m = statusLine.match(/HTTP\/[\d.]+\s+(\d+)/);
  const status = m ? parseInt(m[1], 10) : 0;

  const respHeaders = {};
  for (const line of hdrText.split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0 && !line.startsWith("HTTP/")) {
      const name = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (!respHeaders[name]) respHeaders[name] = [];
      respHeaders[name].push(value);
    }
  }

  const respBytes = [];
  const bf = std.open(RESP_TMP, "rb");
  if (bf) {
    let b;
    while ((b = bf.getByte()) !== -1) respBytes.push(b);
    bf.close();
  }

  appendLog("===== RESPONSE =====\n");
  appendLog("status: " + status + "\n");
  appendLog("headers:\n" + JSON.stringify(respHeaders, null, 2) + "\n");
  appendLog("body-len: " + respBytes.length + "\n");
  appendLog("body-hex: " + respBytes.map(b => b.toString(16).padStart(2, "0")).join("") + "\n");
  let bodyTextPreview = "";
  try {
    bodyTextPreview = bytesToUtf8(respBytes).slice(0, 2000);
  } catch (e) {
    bodyTextPreview = "<binary, len=" + respBytes.length + ">";
  }
  appendLog("body-text: " + bodyTextPreview + "\n");

  try { std.remove(HDR_TMP); } catch (e) { }
  try { std.remove(RESP_TMP); } catch (e) { }
  if (bodyFile) { try { std.remove(bodyFile); } catch (e) { } }

  return {
    status: status,
    ok: status >= 200 && status < 300,
    url: url,
    headers: {
      get: (name) => {
        const v = respHeaders[String(name).toLowerCase()];
        return v ? v.join(", ") : null;
      },
      raw: respHeaders,
    },
    text: () => Promise.resolve(bytesToUtf8(respBytes)),
    json: () => Promise.resolve(JSON.parse(bytesToUtf8(respBytes))),
    arrayBuffer: () => Promise.resolve(new Uint8Array(respBytes).buffer),
  };
};

function bytesToUtf8(bytes) {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i++;
    } else if ((b & 0xe0) === 0xc0) {
      out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f));
      i += 2;
    } else if ((b & 0xf0) === 0xe0) {
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f));
      i += 3;
    } else if ((b & 0xf8) === 0xf0) {
      const cp = ((b & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      if (cp > 0x10FFFF) { out += "\uFFFD"; i += 4; continue; }
      out += String.fromCodePoint(cp);
      i += 4;
    } else {
      i++;
    }
  }
  return out;
}


function ensureTerser() {
  if (globalThis.Terser) return;
  if (!globalThis.window) globalThis.window = globalThis;
  std.loadScript("modules/terser.min.js");
  if (!globalThis.Terser && globalThis.window.Terser) {
    globalThis.Terser = globalThis.window.Terser;
  }
}

function minifyJs(code) {
  try {
    ensureTerser();
    const res = Terser.minify_sync(code, {
      mangle: false,
      compress: false,
      format: { comments: false },
    });
    if (res.error) {
      return JSON.stringify({ ok: false, error: String(res.error.message || res.error) });
    }
    return JSON.stringify({ ok: true, data: res.code });
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e) });
  }
}