# 剑与丹 · 修仙人生重开模拟器

一款纯前端的文字 / 剧情向修仙人生模拟游戏。无后端、无构建步骤，双击 `index.html` 即可游玩。

## 在线游玩

**固定链接（始终指向最新版，不写版本号）**

```
https://bt070512.github.io/jian-yu-dan/
```

## 下载最新版离线包

**固定直链（永远指向最新 Release，不写版本号）**

```
https://github.com/bt070512/jian-yu-dan/releases/latest/download/jian-yu-dan.zip
```

## 本地运行

```bash
# 方式一：直接双击 index.html（纯静态，支持 file:// 协议）

# 方式二：起一个本地静态服务（推荐，行为与线上一致）
python -m http.server 8080
# 然后访问 http://localhost:8080/
```

## 项目结构

| 文件 | 说明 |
|---|---|
| `index.html` | 入口页面（含 8 个界面区块） |
| `style.css` | 水墨仙侠浅色主题样式 |
| `data.js` | 静态字典（境界、地点、姓名库、天赋等） |
| `config.js` | 配置读取层（本地存档 + 默认值合并） |
| `config-data.js` | 全部游戏配置与事件库（数值、事件文案） |
| `config/` | 配置分片 JSON（balance / season-events / marriage-rules / dedup-rules） |
| `audio.js` | Web Audio 实时合成音效（无需音频文件） |
| `season.js` | 季节轮与事件编译层 |
| `characters.js` | 角色线、好感度、婚后状态访问器 |
| `events.js` | 主事件库 |
| `events-chars.js` | 角色专属事件库 |
| `engine.js` | 核心引擎（抽取、去重、结算、结局） |
| `ai.js` | AI 叙事接入（可选，默认关闭） |
| `onboarding.js` | 新手引导 |
| `ui.js` | 界面渲染与交互 |
| `resources/cg/` | CG 美术资源（PNG） |
| `test-*.js` | Node 沙箱测试套件（10 套，225+ 断言） |

## 核心玩法

- **季节轮**：一年 4 次行动（春 → 夏 → 秋 → 冬），走完冬季 `年龄 +1`
- **四层去重**：周目永久去重 · 年度去重 · 事件自锁 · 婚后按年冷却
- **优先级抽取**：婚姻 900 → 主线 500 → 婚后 300~380 → 角色链 100/60 → 季节 0 → 日常 −100
- **角色线**：三位可攻略角色，好感阈值 `遇见 0 / 心动 20 / 相知 45 / 裂痕 70 / 和解 85`
- **婚后阶段**：家财 / 心累 / 子女三项状态 + 41 条婚后事件（8 大主题、链式推进）

## 测试

```bash
node test-boot.js            # 启动冒烟
node test-regression.js      # 回归测试
node test-dedup.js           # 去重测试
node test-balance.js         # 数值平衡
node test-chars.js           # 角色线
node test-season-marriage.js # 季节与婚姻
node test-marriage-refuse.js # 拒绝线
node test-marriage-post.js   # 婚后事件库（94 项）
node test-button-stall.js    # 按键卡死
node test-post-marriage-ui.js# 婚后 UI 集成（16 项）
```

## 发布新版本

推送 tag 即自动打包 Release 并部署 Pages：

```bash
git tag v1.1.0
git push origin v1.1.0
```

两条固定链接会自动指向新版本，无需改动任何 URL。
