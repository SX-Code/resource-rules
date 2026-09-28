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

const errors = [];
const idSet = new Set();
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
    const fileId = fileName.replace('.json', '');

    let rule;
    try {
        rule = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        errors.push(`JSON语法错误: ${relativePath}，${e.message}`);
        return;
    }

    // 必填字段校验
    const requiredFields = ['id', 'name', 'category', 'version', 'enabled', 'sourceType'];
    for (const field of requiredFields) {
        if (!(field in rule)) {
            errors.push(`缺少必填字段 ${field}: ${relativePath}`);
        }
    }

    // id一致性校验
    if (typeof rule.id !== 'number') {
        errors.push(`id必须为数字: ${relativePath}，当前为 ${typeof rule.id}`);
    } else if (rule.id !== Number(fileId)) {
        errors.push(`id不一致: 文件名为 ${fileId}，但配置内id为 ${rule.id} (${relativePath})`);
    } else if (idSet.has(rule.id)) {
        errors.push(`id重复: ${rule.id} 在多个文件中出现`);
    } else {
        idSet.add(rule.id);
    }

    // 校验语义化版本号格式 x.y.z
    const semverReg = /^\d+\.\d+\.\d+$/;
    if (!semverReg.test(rule.version)) {
        errors.push(`版本号格式错误，必须为 x.y.z 格式: ${relativePath}，当前：${rule.version}`);
    }

    // category一致性校验
    if (rule.category !== category) {
        errors.push(`category不一致: 文件夹为 ${category}，配置内category为 ${rule.category} (${relativePath})`);
    }

    // sourceType专项校验
    if (rule.sourceType === 'sniff') {
        if (typeof rule.script !== 'string' || rule.script.length === 0) {
            errors.push(`嗅探源必须填写script字段: ${relativePath}`);
        }
        if (rule.fieldMapping && Object.keys(rule.fieldMapping).length > 0) {
            errors.push(`嗅探源不需要填写fieldMapping，请留空对象 {}: ${relativePath}`);
        }
    } else if (rule.sourceType === 'm3u8') {
        if (!rule.fieldMapping || Object.keys(rule.fieldMapping).length === 0) {
            errors.push(`API接口源必须填写fieldMapping字段: ${relativePath}`);
        }
    } else {
        errors.push(`未知sourceType: ${rule.sourceType} (${relativePath})，仅支持 sniff/m3u8`);
    }

    allSources.push({
        id: rule.id,
        name: rule.name,
        category: rule.category,
        path: relativePath,
        version: rule.version,
        enabled: rule.enabled
    });
}

// 执行主流程
if (!fs.existsSync(RULES_DIR)) {
    errors.push('找不到rules目录，请确认目录结构正确');
} else {
    walkDir(RULES_DIR);
}

// 输出错误并终止
if (errors.length > 0) {
    console.error('❌ 校验失败，错误列表：');
    errors.forEach(err => console.error(' - ' + err));
    process.exit(1);
}

// 生成分类元数据
const usedCategories = [...new Set(allSources.map(s => s.category))];
const categories = usedCategories.map(cat => ({
    id: cat,
    label: CATEGORY_LABELS[cat] || cat
}));

// 按id升序排序源列表
allSources.sort((a, b) => a.id - b.id);

const indexContent = {
    version: '1.0.0',
    updatedAt: Math.floor(Date.now() / 1000),
    categories: categories,
    sources: allSources
};

fs.writeFileSync(OUTPUT_INDEX, JSON.stringify(indexContent, null) + '\n', 'utf8');
console.log(`✅ 校验通过，已生成index.json，共收录 ${allSources.length} 个源，${categories.length} 个分类`);
