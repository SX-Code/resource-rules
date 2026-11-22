const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// encrypt/encrypt.js  →  仓库根 = 上一级
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
    api: rule.api,
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

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    // 只处理 .ori.json，跳过备份
    if (!entry.name.endsWith('.json') || !entry.name.endsWith('.ori.json')) continue;

    const rule = JSON.parse(fs.readFileSync(full, 'utf8'));

    // 已加密，跳过
    if (rule.payload) {
      console.log('跳过(已加密) ' + full);
      continue;
    }

    // 备份明文 → 写回密文
    fs.writeFileSync(full.replace('.ori.json', '.json'), JSON.stringify(makeEnvelope(rule), null, 2) + '\n');
    console.log('加密 ' + full);
  }
}

walk(RULES);
