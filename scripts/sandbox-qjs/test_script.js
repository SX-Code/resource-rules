import * as std from "std";
globalThis.std = std;

// 加载 esbuild 打包的 IIFE 文件
std.loadScript("modules/base.js");

// 加载测试脚本
std.loadScript("scripts/gulu.js");

async function test(method, args) {
    // 加载脚本
    const name = __LAST_LOADED__;
    const requires = __SOURCES__[name].requires || [];
    for (const lib of requires) {
        const path = "modules/" + lib + ".bundle.js";
        console.log("loading lib:", path);
        std.loadScript(path);
    }
    // 执行方法
    const result = await __CALL__(name, method, args);
    return result;
}


// 测试搜索
const result = await test('search', ['尼古喵喵'])
console.log(result);

// 测试详情
// const detail = await __CALL__('gulu', 'detail', ['813841']);
// console.log(JSON.stringify(detail, null, 2));

// const play = await __CALL__('gulu', 'play', ['菲乐2K', 'covip_uan2zzd6xi4ageylnfsgioi@42@尼古喵喵@1']);
// console.log(JSON.stringify(play, null, 2));