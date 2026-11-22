const fs = require('fs');
const path = require('path');

// encrypt/encrypt.js  →  仓库根 = 上一级
const RULES = path.resolve(__dirname, '../rules');

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    // 只处理 .ori.json
    if (!entry.name.endsWith('.ori.json')) continue;

    const rule = JSON.parse(fs.readFileSync(full, 'utf8'));

    // 在 id 属性下面插入 api: 2，保持属性顺序
    const newRule = {};
    for (const key in rule) {
      newRule[key] = rule[key];
      if (key === 'id') {
        newRule.api = 2;
      }
    }

    // 直接写回原 .ori.json 文件
    fs.writeFileSync(full, JSON.stringify(newRule, null, 2) + '\n');
    console.log('已处理并写回原文件：' + full);
  }
}

walk(RULES);
