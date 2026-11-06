# 采集源社区仓库

网页资源解析规则集合，按分类维护动漫、影视等站点的 JSON 配置，支持 API 接口解析和网页嗅探两种方式。仓库提供统一的资源索引、索引生成脚本，以及用于本地调试解析脚本的 QuickJS 沙箱工具。

## 目录结构

```text
resource-rules/
├── index.json                  # 自动生成的资源索引
├── rules/
│   ├── anime/                  # 动漫规则
│   └── movie/                  # 影视规则
├── scripts/
│   ├── build-index.js          # 规则校验与索引生成
│   └── sandbox-qjs/            # QuickJS 本地调试工具
│       ├── engines/            # QuickJS 运行引擎
│       ├── modules/            # 运行环境与扩展库
│       ├── scripts/            # 待调试的解析脚本
│       ├── tools/minify.js     # JavaScript 压缩工具
│       ├── test_script.js      # 解析脚本调用示例
│       ├── test_sniff.js       # 网页嗅探调试示例
│       ├── run.bat             # Windows 启动入口
│       └── run.sh              # Linux 启动入口
├── docs/CONTRIBUTING.md         # 贡献指南
└── .github/workflows/ci.yml     # GitHub Actions 工作流
```

## 使用资源索引

客户端先读取根目录的 [index.json](index.json)，再根据 `sources` 中的 `path` 加载对应规则文件。`path` 相对于仓库根目录；通过 HTTP 加载时，需要将其拼接到托管仓库文件的基础地址后。

索引包含以下字段：

| 字段 | 说明 |
| --- | --- |
| `version` | 索引格式版本 |
| `updatedAt` | 索引生成时间，Unix 时间戳，单位为秒 |
| `categories` | 已收录规则的分类及中文标签 |
| `types` | 已收录规则的解析类型及中文标签 |
| `sources` | 规则摘要，包含 ID、名称、分类、类型、路径、备注和版本 |

索引只保存规则摘要，完整的请求配置、字段映射和解析脚本位于对应的 JSON 文件中。执行规则需要由接入端提供相应的解析能力。

## 规则配置

规则文件统一存放在 `rules/{category}/{id}.json`，例如 [rules/anime/1.json](rules/anime/1.json)。当前规则目录包含 `anime`（动漫）和 `movie`（影视）；索引脚本还预设了 `drama`（短剧）和 `misc`（其他）的中文标签。

### 基础字段

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | 整数 | 与文件名一致，同一分类内唯一 |
| `name` | 字符串 | 资源源的显示名称 |
| `category` | 字符串 | 与所在分类目录名一致 |
| `version` | 字符串 | `x.y.z` 格式的版本号，修改规则时递增 |
| `enabled` | 布尔值 | 建议显式填写；为 `false` 时不收录到索引 |
| `type` | 字符串 | `m3u8` 或 `sniff` |
| `remark` | 字符串 | 可选的规则说明 |

当前索引脚本要求启用规则包含 `id`、`name`、`category`、`version`、`type`。唯一标识为 `category + id`，不同分类可以使用相同的数字 ID。

### 切片源：`m3u8`

通过接口获取资源数据，并使用 `fieldMapping` 将接口字段映射为接入端所需字段。可参考 [动漫 API 规则示例](rules/anime/1.json)。

- `apiUrl`：接口地址，可包含 `{ac}`、`{pg}`、`{wd}` 等占位符，具体替换由接入端完成。
- `apiMethod`、`requestHeaders`、`apiContentType`：请求方式、请求头和内容类型。
- `responseField`：接口响应中资源列表所在的字段。
- `fieldMapping`：字段映射，必须为非空对象。
- `typeMapping`：站点分类与目标分类之间的映射。
- `timeout`、`maxRetry`、`proxyRequired`：请求超时、重试和代理相关配置，实际行为由接入端实现。

### 网页嗅探源：`sniff`

通过 `script` 中的 JavaScript 解析网页内容。可参考 [动漫嗅探规则示例](rules/anime/29.json)。

- `script` 必须为非空字符串。
- `fieldMapping` 应留空为 `{}`。
- 解析脚本依赖接入端提供的运行环境；本地可使用 QuickJS 沙箱辅助调试。
- 将脚本写入 JSON 时，建议使用 JSON 序列化工具处理引号、换行和反斜杠，避免手工转义错误。


### 脚本源

### 磁力源

## 本地校验与生成索引

建议使用与 CI 一致的 Node.js 20。索引脚本仅依赖 Node.js 内置模块，无需安装 npm 依赖。在仓库根目录执行：

```bash
node scripts/build-index.js
```

脚本递归读取 `rules/` 下的 JSON 文件，检查路径、数字文件名、必填字段、版本格式、分类一致性及解析类型配置，然后按分类和 ID 排序生成根目录的 `index.json`。

使用时请注意当前实现的以下行为：

- `index.json` 是生成文件，不要手动编辑；每次生成都会更新 `updatedAt`。
- `enabled: false` 的规则在 JSON 解析后跳过后续字段校验和收录。
- `id` 类型错误或与文件名不一致时，脚本会输出警告，并以文件名中的数字生成索引；不会修改源规则文件。
- 多数校验错误会记录到日志并跳过对应规则，但部分必填字段缺失只记录错误，未必阻止该规则收录。
- 规则校验错误不会统一触发非零退出码，因此需要检查终端错误日志及生成结果，不能仅凭命令退出状态判断所有规则均通过。

## QuickJS 本地调试

沙箱目录提供基础运行环境、HTML 解析和加密扩展库，并通过 `curl` 发起网络请求。运行前需要准备对应平台的 QuickJS 引擎，并确保 `curl` 可用。

测试脚本按当前工作目录读取 `modules/` 和 `scripts/`，因此请先进入沙箱目录。

Windows 命令提示符：

```bat
cd scripts\sandbox-qjs
run.bat test_sniff.js
```

Linux：

```bash
cd scripts/sandbox-qjs
bash run.sh test_sniff.js
```

`run.bat` 使用 `engines/quickjs-win-x86_64/qjs.exe`；`run.sh` 使用 `engines/quickjs-linux/qjs`。当前目录提供了 Windows 引擎文件，Linux 引擎需要自行准备，并赋予可执行权限。

调试前修改测试入口中加载的脚本、搜索关键词和页面地址。`test_sniff.js` 演示获取网页、构造文档对象并调用解析方法；`test_script.js` 演示直接调用解析脚本。运行后者前，需要确认其引用的 `scripts/gulu.js` 存在，或改为自己的脚本路径。

压缩解析脚本的示例命令如下，在沙箱目录执行：

```bat
run.bat tools/minify.js scripts/bmddm.js
```

Linux 对应命令为 `bash run.sh tools/minify.js scripts/bmddm.js`。压缩结果写入同目录下的 `bmddm.min.js`。

沙箱用于辅助检查脚本行为；实际解析结果仍需在接入端验证。

## 新增或更新规则

1. 在对应分类目录中新建数字 ID 命名的 JSON 文件，或修改已有规则。新增时建议使用该分类当前最大 ID 加一，并避免复用已分配 ID。
2. 保持文件名、`id` 和 `category` 一致，按解析类型填写字段映射或脚本。
3. 修改已有规则时递增 `version`；临时停用可设置 `enabled: false`。
4. 执行索引生成脚本，检查错误、警告及生成的索引内容。
5. 验证规则的实际解析效果后提交 Pull Request。

更多说明见 [贡献指南](docs/CONTRIBUTING.md)。该指南中的 `sourceType` 和“ID 全局唯一”等描述与当前实现存在差异；当前实际字段为 `type`，ID 按分类校验唯一，具体校验行为以 [build-index.js](scripts/build-index.js) 为准。

## 自动化流程

[GitHub Actions 工作流](.github/workflows/ci.yml) 在面向 `main` 的 Pull Request 或推送到 `main` 时，针对 `rules/**` 的变更执行索引生成，并在索引变化后尝试自动提交和推送。自动写回是否成功取决于工作流对目标分支的写入权限。

工作流使用 Node.js 20。由于生成脚本对规则错误采用日志记录方式，CI 显示成功也需要结合日志确认规则是否完整收录。
