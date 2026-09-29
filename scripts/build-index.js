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
    m3u8: '切片源'
};

const errors = [];
const warnings = [];
const idSet = new Set(); // key: `${category}:${id}`
const allSources = [];

function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) walkDir(fullPath);
        else if (entry.isFile() && entry.name.endsWith('.json')) processRuleFile(fullPath);
    }
}

function processRuleFile(filePath) {
    const relativePath = path.relative(ROOT, filePath).replace(/\\/g, '/');
    const pathParts = relativePath.split('/');

    // 路径格式校验：rules/{category}/{id}.json
    if (pathParts.length !== 3) {
        errors.push(`文件路径错误: ${relativePath}，必须为 rules/{分类}/{id}.json`);
        return;
    }

    const [, category, fileName] = pathParts;
    const fileIdRaw = fileName.replace(/\.json$/, '');

    // 文件名校验：必须是纯数字
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

    // 源被禁用则跳过（不校验、不收录）
    if (rule.enabled === false) {
        return;
    }

    // 必填字段校验
    const requiredFields = ['id', 'name', 'category', 'version', 'type'];
    for (const field of requiredFields) {
        if (!(field in rule)) {
            errors.push(`缺少必填字段 ${field}: ${relativePath}`);
        }
    }

    // id 自动纠错：以文件名为准
    if (typeof rule.id !== 'number') {
        warnings.push(`id 非数字，已自动修正为文件名 ${fileId}: ${relativePath} (原值: ${JSON.stringify(rule.id)})`);
    } else if (rule.id !== fileId) {
        warnings.push(`id 与文件名不一致，已自动修正为 ${fileId}: ${relativePath} (原值: ${rule.id})`);
    }
    rule.id = fileId;

    // 唯一性校验：id + category
    const uniqueKey = `${category}:${fileId}`;
    if (idSet.has(uniqueKey)) {
        errors.push(`id 重复: category=${category}, id=${fileId}，在多个文件中出现`);
        return;
    }
    idSet.add(uniqueKey);

    // 校验语义化版本号格式 x.y.z
    const semverReg = /^\d+\.\d+\.\d+$/;
    if (!semverReg.test(rule.version)) {
        errors.push(`版本号格式错误，必须为 x.y.z 格式: ${relativePath}，当前：${rule.version}`);
        return;
    }

    // category 一致性校验
    if (rule.category !== category) {
        errors.push(`category 不一致: 文件夹为 ${category}，配置内 category 为 ${rule.category} (${relativePath})`);
        return;
    }

    // type 专项校验
    if (rule.type === 'sniff') {
        if (typeof rule.script !== 'string' || rule.script.length === 0) {
            errors.push(`嗅探源必须填写 script 字段: ${relativePath}`);
            return;
        }
        if (rule.fieldMapping && Object.keys(rule.fieldMapping).length > 0) {
            errors.push(`嗅探源不需要填写 fieldMapping，请留空对象 {}: ${relativePath}`);
            return;
        }
    } else if (rule.type === 'm3u8') {
        if (!rule.fieldMapping || Object.keys(rule.fieldMapping).length === 0) {
            errors.push(`API接口源必须填写 fieldMapping 字段: ${relativePath}`);
            return;
        }
    } else {
        errors.push(`未知 type: ${rule.type} (${relativePath})，仅支持 sniff/m3u8`);
        return;
    }

    allSources.push({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        type: rule.type,
        path: relativePath,
        remark: rule.remark,
        version: rule.version
    });
}

// 执行主流程
if (!fs.existsSync(RULES_DIR)) {
    console.error('❌ 找不到 rules 目录，请确认目录结构正确');
    process.exit(1);
} else {
    walkDir(RULES_DIR);
}

// 输出警告（自动纠错信息，不阻断流程）
if (warnings.length > 0) {
    console.warn('⚠️  已自动修正以下问题：');
    warnings.forEach(w => console.warn(' - ' + w));
}

// 输出错误（仅记录，不终止）
if (errors.length > 0) {
    console.error('❌ 以下文件校验失败，已被忽略：');
    errors.forEach(err => console.error(' - ' + err));
}

// 生成分类元数据
const usedCategories = [...new Set(allSources.map(s => s.category))];
const categories = usedCategories.map(cat => ({
    id: cat,
    label: CATEGORY_LABELS[cat] || cat
}));

// 生成类型元数据（只包含实际用到的类型，按固定顺序）
const TYPE_ORDER = ['sniff', 'm3u8'];
const usedTypes = new Set(allSources.map(s => s.type));
const types = TYPE_ORDER
    .filter(t => usedTypes.has(t))
    .map(t => ({
        id: t,
        label: TYPE_LABELS[t] || t
    }));

// 按 category 再按 id 升序排序
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