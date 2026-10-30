# 中心实验室临时采购申请

丽水市第二人民医院 · 中心实验室用的微信小程序。学生（申请人）填《临时采购医用耗材购置申请表》，导师在手机上按明细通过或驳回。界面是中文，数据先存在本机，后面可以换成微信云开发。

供货单位 / 经销商是一级字段：新建时每行都要填，列表打标签，详情按经销商分组并逐行列出。

## 用微信开发者工具打开

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)。
2. 选择「导入项目」，目录选本仓库根目录（能看到 `app.json` 的那一层）。
3. AppID 使用下面的占位，或在导入框里直接选「测试号」。
4. 基础库使用 3.5.5 或更高。`project.config.json` 里已经写了 `libVersion: 3.5.5`。
5. 编译后进入首页。不需要安装 npm 依赖，小程序本身没有第三方包。

`scripts/` 和 `docs/` 已从上传包里排除，只给本地阅读和校验用。

## AppID

`project.config.json` 里的 AppID 是：

```text
touristappid
```

这是微信开发者工具的游客 / 测试号占位，不是本院小程序的正式 AppID，也不能拿去上传发布。仓库里没有、也不应该写入一个看起来像正式号的假 AppID。

真机预览和上传之前，到 [微信公众平台](https://mp.weixin.qq.com/) 注册小程序，把 `project.config.json` 的 `appid` 换成自己的 AppID。不要把 AppSecret 放进仓库。

## 演示身份

没有接医院账号。首页可以在两个演示身份之间切换。

| 身份 | 显示名 | 说明 |
| --- | --- | --- |
| 学生/申请人 | 俞坤强 | 两张样表上的申请人，中心实验室 |
| 导师 | 导师（演示） | 样表没有印导师姓名，这里只用职务，不编造人名 |

「微信登录」会调用 `wx.login`，但不会把 `code` 交给服务器，也不会绑定身份。接入方式见下文。

建议走一遍：

1. 以俞坤强进入「我的申请」，打开 10 月待审批单，看经销商汇总和每一行的供货单位。
2. 切到导师，在「待我审批」里通过或驳回。驳回必须写意见。
3. 切回学生。通过后的单据（含预置的 9 月单）可以补发票号码；演示环境只记文件名。
4. 「新建采购申请」加多行，每行点选经销商或手写全称，也可从采购目录带出两张表里的品名。
5. 首页「恢复演示数据」会清掉本机新增内容，身份保持不变。

## 页面

| 路径 | 作用 |
| --- | --- |
| `pages/home/index` | 首页、身份切换、入口 |
| `pages/apply/list` | 我的申请；导师打开时改为查阅全部 |
| `pages/apply/edit` | 新建 / 编辑。草稿和已驳回可改 |
| `pages/apply/detail` | 申请详情、撤回、发票备注 |
| `pages/approve/list` | 导师待审批，可按申请单或按经销商看 |
| `pages/approve/detail` | 通过 / 驳回 |

学生提交后可以撤回成草稿。已通过的单据不能再改明细。

## 样例数据

`data/seed.js` 由 `scripts/build_seed.py` 从两张审批表生成，小程序不读取 xls。

| 单号 | 申请时间 | 状态 | 行数 | 明细合计 | 经费 |
| --- | --- | --- | --- | --- | --- |
| CG-20260911-001 | 2026年9月11日 | 已通过（演示预置） | 17 | 37,723.00 元 | 浙江省医坛新秀培养经费 |
| CG-20261009-001 | 2026年10月9日 | 待审批 | 41 | 31,674.76 元 | 2026年全国重点实验室项目 |

9 月表头写「约 3.8 万元」，10 月写「约 3.2 万元」。程序用明细合计做预估总金额，详情里同时保留表头这句话。9 月单的导师意见是演示预置，纸质表签名栏原来是空的。

封面列和程序字段：

| 审批表 | 字段 |
| --- | --- |
| 申请科室 | `department` |
| 申请人 | `applicantName` |
| 申请时间 | `applyDate` |
| 用途 | `usage`（表头，明细行也有） |
| 申请理由 | `reason` |
| 经费来源备注 | `fundNote`（从申请理由里摘出的项目名） |
| 预估总金额 | `estimatedTotal`（各行总价之和） |

明细列：

| 审批表 | 字段 |
| --- | --- |
| 产品名称 | `items[].productName` |
| 规格型号 | `items[].spec` |
| 用途 | `items[].usage` |
| 采购量 | `items[].quantity` |
| 科室建议购入价 | `items[].unitPrice` |
| 总价（元） | `items[].totalPrice`（采购量 × 单价） |
| 生产单位 | `items[].manufacturer` |
| 供货单位 | `items[].dealerName`，并关联 `dealerId` |
| 联系电话 | `items[].phone` |

9 月明细有「联系电话」列，单元格是空的，所以电话选填。10 月明细没有这一列。封面的「销售员姓名及电话」写的是「详见采购明细」，程序放在每一行的联系电话上。

经销商目录（明细里的原文字保留，不强行改成同一种写法）：

| 简称 | 目录名称 | 表里出现过的写法 |
| --- | --- | --- |
| 美谷 | 浙江美谷生物科技有限公司 | 另有「美谷生物科技有限公司」 |
| 晋山 | 温州晋山生物科技公司 | 另有「晋山生物科技有限公司」 |
| 维通利华 | 浙江维通利华实验动物技术有限公司 | |
| 和元 | 上海和元生物技术有限公司 | |
| 森贝伽 | 南京森贝伽生物科技有限公司 | 搜索「生航」也归到这里；生产单位常见 Bio-Channel |
| 德思特 | 成都德思特生物技术有限公司 | 乐美天是生产单位，不是供货单位 |

重新生成（本机已装 Python 和 xlrd，且手里有那两份 xls 时）：

```bash
python3 scripts/build_seed.py batch1.xls batch2.xls
```

校验种子数据和申请流转：

```bash
npm test
```

## 代码怎么分层

页面只调用 `services/api.js`。业务规则在 `domain/applications.js`（不依赖 `wx`）。存储在驱动里：

- `services/driver.local.js`：`wx.setStorageSync`，键名 `lab_procure_db_v1`
- `services/driver.cloud.js`：云数据库集合 `users`、`dealers`、`catalog`、`applications`

`config.js` 的 `driver` 现在是 `local`。身份存在另一条本机键 `lab_procure_session_v1`，和单据分开，恢复演示数据不会把身份切回去。

单据状态：`draft` 草稿，`pending` 待审批，`approved` 已通过，`rejected` 已驳回。

纸质表上还有医务处/护理部/科教处、院感科、医保办和价格管理科、采购中心、分管院长、院长。详情里只作对照，这一版不在小程序里签。

## 接入微信云开发

1. 用正式 AppID 打开项目，在开发者工具里开通云开发，记下环境 ID。
2. 编辑 `config.js`：`driver` 改为 `'cloud'`，`cloudEnv` 填环境 ID。
3. `app.js` 会在这时调用 `wx.cloud.init`。不要把环境密钥写进小程序。
4. 重新编译。`driver.cloud.js` 发现 `applications` 为空时，会写入现在的演示用户、经销商、目录和两张申请。
5. 云数据库建四个集合即可，字段与 `data/seed.js` 里的对象一致。客户端按业务字段 `id` 查询，不依赖 `_id`。
6. 开发阶段可以把集合权限设成「所有用户可读、所有用户可写」。上线前收紧：申请人只能读写自己的 `applicantId`，审批更新放到云函数里，不要让普通用户直接改 `status`。
7. 单次读取上限按 100 条写的。单据变多以后再加分页和索引（建议给 `status`、`applicantId`、`applyDate`）。
8. 发票文件现在只留文件名。正式上传用 `wx.cloud.uploadFile`，把 `fileID` 存进 `invoice.files`，不要把发票二进制提交到 git。

云开发模式下，首页的「恢复演示数据」会拒绝执行，避免手机端清空集合。

## 接入 wx.login

`services/auth.js` 里已经调用 `wx.login`。下一步：

1. 把 `docs/cloudfunctions/login/` 拷到项目里的 `cloudfunctions/login/`（现在放在 `docs/` 下，是为了避免没开通云开发时工具去上传它）。
2. 在 `project.config.json` 增加 `"cloudfunctionRoot": "cloudfunctions/"`，安装依赖并上传云函数。云函数只返回 `openid`。
3. 在 `users` 里给俞坤强、导师账号填上真实 `openid`。
4. 登录成功后用 openid 查用户，调用与 `setRole` 相同的会话写入。查不到就停在未绑定，不要默认当成导师。

在此之前继续用首页的身份切换。

## 目录

```text
app.js / app.json / app.wxss
config.js
project.config.json
sitemap.json
data/seed.js            两张审批表的演示数据
data/database.js        恢复初始库
domain/                 金额、校验、分组、展示
services/api.js         页面用的接口
services/driver.local.js
services/driver.cloud.js
services/auth.js
pages/home              首页
pages/apply             申请列表、新建、详情
pages/approve           待审批、审批详情
templates/              列表卡片和详情
docs/cloudfunctions/    登录云函数示例
scripts/validate.js     本地校验
scripts/build_seed.py   从 xls 重造 seed.js
```
