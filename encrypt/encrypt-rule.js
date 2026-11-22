const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 单文件加密：node encrypt/one.js anime 5
 *   rules/anime/5.ori.json  →  rules/anime/5.json（加密信封，已存在则覆盖）
 *
 * encrypt.js 用于一次性全量迁移，本脚本只处理单个源。
 */

const RULES = path.resolve(__dirname, '../rules');
const PUBLIC_KEY = fs.readFileSync(path.join(__dirname, 'public.pem'), 'utf8');

function makeEnvelope(rule) {
    const aesKey = crypto.randomBytes(32);
    const nonce = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, nonce);
    const payload = Buffer.concat([cipher.update(JSON.stringify(rule)), cipher.final()]);

    const rsaKey = crypto.publicEncrypt(
        { key: PUBLIC_KEY, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
        aesKey
    );

    const env = {
        id: rule.id,
        name: rule.name,
        category: rule.category,
        type: rule.type,
        version: rule.version,
    };
    if (rule.remark) env.remark = rule.remark;

    env.rsaKey = rsaKey.toString('base64');
    env.nonce = nonce.toString('base64');
    env.tag = cipher.getAuthTag().toString('base64');
    env.payload = payload.toString('base64');
    return env;
}

function fail(msg) {
    console.error('❌ ' + msg);
    process.exit(1);
}

const [category, id] = process.argv.slice(2);

if (!category || !id) {
    console.error('用法：node encrypt/one.js <分类> <id>');
    console.error('示例：node encrypt/one.js anime 5');
    process.exit(1);
}

if (!/^\d+$/.test(id)) fail(`id 必须是纯数字，当前：${id}`);
if (!/^\w+$/.test(category)) fail(`分类名不合法，当前：${category}`);

const oriPath = path.join(RULES, category, id + '.ori.json');
const outPath = path.join(RULES, category, id + '.json');

if (!fs.existsSync(oriPath)) fail(`找不到明文文件：rules/${category}/${id}.ori.json`);

let rule;
try {
    rule = JSON.parse(fs.readFileSync(oriPath, 'utf8'));
} catch (e) {
    fail(`${id}.ori.json 不是合法 JSON：${e.message}`);
}

// ---- 基础校验（build-index 会依赖这些）----
for (const f of ['id', 'name', 'category', 'version', 'type']) {
    if (!(f in rule)) fail(`缺少必填字段 ${f}`);
}
if (typeof rule.id !== 'number' || rule.id !== Number(id)) {
    fail(`id 必须为数字且等于文件名：文件名 ${id}，配置 ${JSON.stringify(rule.id)}`);
}
if (rule.category !== category) {
    fail(`category 不一致：目录 ${category}，配置 ${rule.category}`);
}
if (!/^\d+\.\d+\.\d+$/.test(rule.version)) {
    fail(`version 必须为 x.y.z，当前 ${rule.version}`);
}
if (!['sniff', 'm3u8', 'script', 'bt'].includes(rule.type)) {
    fail(`type 非法，仅支持 sniff / m3u8 / script / bt，当前 ${rule.type}`);
}

// ---- 写入 ----
fs.writeFileSync(outPath, JSON.stringify(makeEnvelope(rule), null, 2) + '\n');
console.log('✅ 已生成 rules/' + category + '/' + id + '.json');
