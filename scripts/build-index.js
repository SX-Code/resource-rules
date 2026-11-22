const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RULES_DIR = path.join(ROOT, 'rules');
const OUTPUT_INDEX = path.join(ROOT, 'index.json');

// 分类中文标签映射
const CATEGORY_LABELS = {
    anime: '动漫',
    movie: '影视',
    drama: '短剧',
    misc: '其他'
};

// 源类型中文标签映射
const TYPE_LABELS = {
    sniff: '嗅探源',
    m3u8: '切片源',
    script: '脚本源',
    bt: 'BT源'
};

// 各 type 允许的 runtime 集合
// sniff: 只允许 webview（可不填，填了必须是 webview）
// script: 只允许 js（可不填，填了必须是 js）
// bt: 必须指定，且只能是 webview 或 js
// m3u8: 不允许出现 runtime
const RUNTIME_RULES = {
    sniff: { allowed: ['webview'], required: false },
    script: { allowed: ['js'], required: false },
    bt: { allowed: ['webview', 'js'], required: true },
    m3u8: { allowed: [], required: false }
};

const errors = [];
const warnings = [];
const idSet = new Set();
const allSources = [];

function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) walkDir(fullPath);
        else if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.endsWith('.ori.json')) processRuleFile(fullPath);
    }
}

function processRuleFile(filePath) {
    const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    const pathParts = relativePath.split('/');

    if (pathParts.length !== 3) {
        errors.push(`文件路径错误: ${relativePath}，必须为 rules/{分类}/{id}.json`);
        return;
    }

    const [, category, fileName] = pathParts;
    const fileIdRaw = fileName.replace(/\.json$/, '');

    if (!/^\d+$/.test(fileIdRaw)) {
        errors.push(`文件名必须为纯数字: ${relativePath}`);
        return;
    }
    const fileId = Number(fileIdRaw);

    let rule;
    try {
        rule = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        errors.push(`JSON语法错误: ${relativePath}，${e.message}`);
        return;
    }

    if (rule.enabled === false) {
        return;
    }

    const requiredFields = ['id', 'name', 'category', 'version', 'type'];
    for (const field of requiredFields) {
        if (!(field in rule)) {
            errors.push(`缺少必填字段 ${field}: ${relativePath}`);
        }
    }

    if (typeof rule.id !== 'number') {
        warnings.push(`id 非数字，已自动修正为文件名 ${fileId}: ${relativePath} (原值: ${JSON.stringify(rule.id)})`);
    } else if (rule.id !== fileId) {
        warnings.push(`id 与文件名不一致，已自动修正为 ${fileId}: ${relativePath} (原值: ${rule.id})`);
    }
    rule.id = fileId;

    const uniqueKey = `${category}:${fileId}`;
    if (idSet.has(uniqueKey)) {
        errors.push(`id 重复: category=${category}, id=${fileId}，在多个文件中出现`);
        return;
    }
    idSet.add(uniqueKey);

    const semverReg = /^\d+\.\d+\.\d+$/;
    if (!semverReg.test(rule.version)) {
        errors.push(`版本号格式错误，必须为 x.y.z 格式: ${relativePath}，当前：${rule.version}`);
        return;
    }

    if (rule.category !== category) {
        errors.push(`category 不一致: 文件夹为 ${category}，配置内 category 为 ${rule.category} (${relativePath})`);
        return;
    }

    // type 专项校验
    const runtimeRule = RUNTIME_RULES[rule.type];
    if (!runtimeRule) {
        errors.push(`未知 type: ${rule.type} (${relativePath})，仅支持 sniff/m3u8/script/bt`);
        return;
    }
    allSources.push({
        id: rule.id,
        api: rule.api,
        name: rule.name,
        category: rule.category,
        type: rule.type,
        path: relativePath,
        remark: rule.remark,
        version: rule.version
    });
}

if (!fs.existsSync(RULES_DIR)) {
    console.error('❌ 找不到 rules 目录，请确认目录结构正确');
    process.exit(1);
} else {
    walkDir(RULES_DIR);
}

if (warnings.length > 0) {
    console.warn('⚠️  已自动修正以下问题：');
    warnings.forEach(w => console.warn(' - ' + w));
}

if (errors.length > 0) {
    console.error('❌ 以下文件校验失败，已被忽略：');
    errors.forEach(err => console.error(' - ' + err));
}

const usedCategories = [...new Set(allSources.map(s => s.category))];
const categories = usedCategories.map(cat => ({
    id: cat,
    label: CATEGORY_LABELS[cat] || cat
}));

// 类型顺序加入 bt，放在 script 之后
const TYPE_ORDER = ['sniff', 'm3u8', 'script', 'bt'];
const usedTypes = new Set(allSources.map(s => s.type));
const types = TYPE_ORDER
    .filter(t => usedTypes.has(t))
    .map(t => ({
        id: t,
        label: TYPE_LABELS[t] || t
    }));

allSources.sort((a, b) => {
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.id - b.id;
});

const indexContent = {
    version: '1.0.0',
    updatedAt: Math.floor(Date.now() / 1000),
    categories: categories,
    types: types,
    sources: allSources
};

fs.writeFileSync(OUTPUT_INDEX, JSON.stringify(indexContent, null) + '\n', 'utf8');

const failCount = errors.length;
const okCount = allSources.length;
console.log(`✅ 已生成 index.json，收录 ${okCount} 个源，${categories.length} 个分类，${types.length} 个类型${failCount ? `，忽略 ${failCount} 个错误文件` : ''}`);