import * as std from "std";
globalThis.std = std;

// 加载 esbuild 打包的 IIFE 文件
std.loadScript("modules/base.js");

// 加载测试脚本
std.loadScript("scripts/bmddm.js");

const headers = {
    "accept": "*/*",
    "origin": "https://www.bmddm.com",
    "pragma": "no-cache",
    "referer": "https://www.bmddm.com",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Chromium\";v=\"146\", \"Not-A.Brand\";v=\"24\", \"Microsoft Edge\";v=\"146\"",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0",
    "cache-control": "no-cache",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "cross-site",
    "sec-ch-ua-mobile": "?0"
};


async function test(url, method, args) {
    // 加载脚本
    const name = __LAST_LOADED__;
    const requires = __SOURCES__[name].requires || [];
    for (const lib of requires) {
        const path = "modules/" + lib + ".bundle.js";
        console.log("loading lib:", path);
        std.loadScript(path);
    }

    // 加载网页
    const res = await fetch(url, { method: "GET", headers: headers });
    const html = await res.text();
    globalThis.document = ultrahtml.createDocument(html);
    globalThis.window = globalThis.window || {};
    globalThis.window.location = new URL(url);

    const result = await __CALL__(name, method, args);
    return result;
}

// 测试搜索
const keywords = '尼古喵喵'
const searchUrl = 'https://www.bmddm.com/s_all?ex=1&kw=' + encodeURIComponent(keywords);
const searchRes = await test(searchUrl, 'search', [keywords]);
console.log(searchRes);


// 测试详情
// const detailUrl = 'https://www.bmddm.com/show/622206.html';
// const detailRes = await test(detailUrl, 'detail', [detailUrl]);
// console.log(JSON.stringify(detailRes));