# 源贡献指南
本仓库为网页资源解析配置集合，所有源规则由社区共同维护。

## 基本规则
1. **禁止手动修改根目录index.json**，该文件由CI脚本自动生成
2. 所有源文件存放位置：`rules/{分类}/{id}.json`
3. 文件名规则：文件名为全局唯一数字id，例如 `rules/anime/29.json`
4. id一旦分配不可复用，新增源请取当前仓库最大id+1作为新id

## 分类说明
| 文件夹名 | 说明 |
| ---- | ---- |
| anime | 动漫类站点 |
| movie | 影视类站点 |
| misc | 其他杂类站点 |

## 必填字段说明
每个源配置必须包含以下字段：
- `id`: 全局唯一整数，和文件名一致
- `name`: 站点显示名称
- `category`: 所属分类，和文件夹名一致
- `version`: 语义化版本号，修改源配置时递增版本号
- `enabled`: 布尔值，true为启用，false为临时下线
- `sourceType`: 源类型，仅支持 `sniff`（网页嗅探）/ `m3u8`（API接口）

## 源类型编写要求
1. **API接口源 (sourceType: m3u8)**
   - 必须填写 `fieldMapping` 字段映射规则
   - `script` 字段留空字符串即可
2. **网页嗅探源 (sourceType: sniff)**
   - `fieldMapping`/`typeMapping` 留空对象 `{}`
   - 必须填写 `script` 嗅探脚本
   - 脚本内所有字符串统一使用单引号 `'`，避免JSON转义错误

## PR检查流程
提交PR后GitHub Actions会自动运行校验：
- 校验JSON语法合法性
- 校验id全局唯一、路径与配置字段一致
- 校验必填字段完整性
- 校验通过后自动生成最新index.json
校验失败的PR会被自动标记，请按照报错提示修改后重新提交。
