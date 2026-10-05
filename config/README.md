# 剑与丹 · 配置目录

本目录存放可读、可编辑的配置文件。游戏运行时**不直接读取本目录的 `.json`**
（纯静态页面以 `file://` 双击打开时，浏览器会以 CORS 策略拦截 `fetch`），
而是由项目根目录的 **`config-data.js`** 把同样的内容内联到 `window.GAME_CONFIG`。

> 修改流程：改本目录的 JSON → 把内容同步到 `config-data.js` 对应字段 → 刷新页面。
> 两者字段结构完全一致，可直接复制。

---

## 一、文件清单

| 文件 | 作用 | 运行时字段 |
|---|---|---|
| `marriage-rules.json` | 婚姻结局规则、触发条件、唯一配偶锁定、与其它结局的相容/互斥矩阵 | `GAME_CONFIG.marriage` |
| `dedup-rules.json` | 三层去重策略、抽取优先级分档、兜底策略、冲突校验 | `GAME_CONFIG.dedup` |
| `season-events.json` | 季节化事件库（四季各 13 条）+ 婚姻事件（3 条） | `GAME_CONFIG.seasonEvents` |
| `balance.json` | **数值配平**：起始寿元 / 每年消耗 / 成长倍率 / 破境回血 / 步数保险丝 | `GAME_CONFIG.balance` |

> ⚠️ `balance.json` 是**游戏时长的总开关**。曾因破境回血无上限导致寿元净增数千点、
> 游戏永不结束（表现为「反复循环早逝结局」）。调整后请务必跑 `node test-balance.js` 验证。

---

## 二、季节时间系统

- 游戏内**每次行动 = 推进 1 个季节**，顺序固定：`春 → 夏 → 秋 → 冬`。
- 走完「冬」即**过了一年**：`age + 1`、`shou − shouPerYear`、清空 `usedSeasons`。
- 因此「一年 = 4 次行动」。不再有步数上限，**寿元耗尽即结束**
  （另有 `hardStepCap` 硬保险丝兜底，正常玩法碰不到）。

### 事件季节字段

| 取值 | 含义 |
|---|---|
| `"spring"` `"summer"` `"autumn"` `"winter"` | 只在对应季节出现 |
| `"any"` 或 `null` 或不写 | 全年可触发（不受季节过滤） |

> 婚姻事件固定 `season: null`，即**任意季节均可触发**；且 `priority: 900`，
> 必然优先于普通季节事件与好感事件。

---

## 三、三层去重机制

| 层 | 字段 | 作用域 | 何时清空 |
|---|---|---|---|
| 第 1 层 | `s.usedEvents` | 整个周目 | 开新周目 |
| 第 2 层 | `s.usedSeasons` | 当前年份 | **走完冬**（跨年可复用） |
| 第 3 层 | `s.charFlags` | 整个周目 | 开新周目 |

**季节事件默认走第 2 层（`once_per_year`）**：同一年内触发过一次后不再出现，
过了冬天进入新年，自动恢复可触发。这保证：

- 单周目内不会连续重复同一事件；
- 长周目也不会「事件耗尽」，因为每年都能重新抽到。

### 单条事件可用字段覆盖默认策略

| 字段 | 取值 | 含义 |
|---|---|---|
| `once_per_year` | `true` / `false` | 按年复用 / 不用年度去重 |
| `once` | `true` | 整周目只一次（写入 `usedEvents`） |
| `repeat` | `true` | 不占位，可无限重复（日常事件） |

---

## 四、婚姻系统

### 触发条件（全部满足）

1. 某角色好感 **≥ 100**（`thresholds.marriageAffection`）
2. 该角色已到成婚节点：`charFlags.{char}_married_ready === true`
3. 本周目尚未锁定配偶：`!s.marriageLocked`
4. 该角色婚姻事件本周目未走过：`!s.charFlags.marriageDone[char]`

### 分支判定

| 选项 | `isMarriageAccept` | 结果 |
|---|---|---|
| 「愿意 / 你算我的 / 点」 | `true` | 写入 `spouse_id = {char}`、`marriageLocked = true` → **进入婚姻结局** |
| 「拒绝 / 我们是同门 / 你回血海去吧」 | `false` | 婚姻**不成立**，写入 `marriageDone[char]`，好感下降 |
| 「让我想想 / 我得先了结一桩事」 | `false` | 婚姻**未定**，写入 `marriageDone[char]`，好感微升 |

> 只有 `isMarriageAccept: true` 的分支才会写入 `spouse_id`。
> 其余分支一律**不进入婚姻结局**。

### 唯一配偶锁定

- `spouse_id`：唯一配偶字段，单周目**只能有一个值**。
- `marriageLocked`：全局锁。一旦有一位角色答应，其余角色婚姻事件因
  `!s.marriageLocked` 条件不再触发 → **单周目仅可确定一位结婚对象**。
- `marriageDone`：记录已走完婚姻流程的角色，防止同一角色重复触发。
- 三人同时达到 100 时：**first_agree_wins** —— 谁先被选「同意」，谁就是唯一配偶。

### 婚姻结局与其它结局的优先级

| 优先级 | 结局 | 与婚姻的关系 |
|---|---|---|
| 0 | `return_mortal_*` 归凡线 | **覆盖**婚姻（主动散功优先） |
| 1 | `immortal_ascend` / `sword_god` / `returned_past` | **高于**婚姻（登顶线优先） |
| 2 | `marry_herb` / `marry_sister` / `marry_third` | 婚姻结局本身 |
| 3 | `hermit_life` / `dual_immortal` / `happy_ending` | **低于**婚姻（同时满足取婚姻） |
| 3 | `demon_path` / `avenged` / `lonely_sword` / `dan_master` / `young_death` / `ordinary_death` | **与婚姻互斥** |

#### 互斥矩阵（同周目不可能共存）

```
marry_herb   × marry_sister   × marry_third      （三者互斥）
marry_*      × demon_path / young_death / ordinary_death
```

#### 相容（可同时满足，按优先级取值）

```
marry_*      +  return_mortal_*   →  取 return_mortal_*
marry_*      +  happy_ending      →  取 marry_*
```

---

## 五、数值配平（balance.json）

这一节是**游戏时长的总开关**，决定一局能玩多久、能修到什么境界。

| 字段 | 默认 | 含义 |
|---|---|---|
| `startShou` | 60 | 起始寿元（天赋还会额外加成，均值约 +10） |
| `startAge` | 12 | 起始年龄 |
| `shouPerYear` | 4 | **每年消耗的寿元**（决定基础时长） |
| `growthMultiplier` | 1.5 | 修为成长倍率（决定能修到多高境界） |
| `shouCapMultiplier` | 1.8 | 寿元软上限倍率（60 × 1.8 = 108） |
| `hardStepCap` | 300 | 硬保险丝，防止无限循环 |
| `targetMinSteps` / `targetMaxSteps` | 120 / 200 | 目标步数区间（测试用） |

### 破境回血规则

```
healRatio = max(0.08, 0.25 − 境界序号 × 0.019)
heal      = max(3, floor(当前寿元 × healRatio))
寿元       = min(起始寿元 × 1.8, 当前寿元 + heal)
```

**炼气 25% → 渡劫 8%**：低境界回血多、高境界延寿「更贵」，
保证寿元长期单调下降、突破只是「缓一口气」。

### 修改示例

| 想要的效果 | 怎么改 |
|---|---|
| 游戏更长 | 调小 `shouPerYear`，或调大 `growthMultiplier` / `shouCapMultiplier` |
| 游戏更短 | 调大 `shouPerYear`，或调小 `shouCapMultiplier` |
| 能修到更高境界 | 调大 `growthMultiplier` |
| 破境完全不延寿 | `shouCapMultiplier` 设为 `1.0` |

> ⚠️ `shouCapMultiplier` 设到 **3.0 以上**可能重现「死不掉」问题。
> 任何改动后请跑 `node test-balance.js` 验证（16 项断言，含无死循环检查）。

---

## 六、依赖顺序（务必按此顺序理解）

```
好感度积累(≥100)
   ↓
婚姻事件触发条件成立（阈值 + *_married_ready + 未锁定 + 未走完）
   ↓
婚姻事件登场（priority 900，任意季节）
   ↓
选项分支判定（isMarriageAccept）
   ↓
结局判定（judgeEnding 以 spouse_id 为准）
   ↓
全局锁定（marriageLocked = true，其余角色婚姻事件关闭）
```

---

## 七、冲突校验规则

| 场景 | 策略 | 说明 |
|---|---|---|
| 多角色同时达到 100 | `first_agree_wins` | 以首个「同意」者为唯一配偶 |
| 同一角色婚姻事件重复触发 | `block` | `marriageLocked` 或 `marriageDone` 后直接阻止 |
| `spouse_id` 非法值 | `ignore` | 不在 `['herb','sister','third']` 中视为无配偶 |
| 事件 id 重复 | `block` | 测试脚本报错 |
| 某季事件少于 12 条 | `warn` | 测试脚本告警 |
| 事件 `choices` 为空 | `block` | 测试脚本报错 |

---

## 八、常见修改示例

### 1. 把婚姻阈值从 100 改成 90

```json
// marriage-rules.json
"thresholds": { "marriageAffection": 90, "legacyReadyAffection": 85 }
```

同步到 `config-data.js` 的 `GAME_CONFIG.marriage.thresholds.marriageAffection`。
同时把三条婚姻事件的 `req` 中的 `>= 100` 改为 `>= 90`。

### 2. 让季节事件「一周目只触发一次」（不再跨年复用）

```json
// dedup-rules.json
"seasonEventPolicy": { "mode": "once" }
```

### 3. 新增一条春季事件

在 `season-events.json` 的 `seasonEvents` 数组加入：

```json
{
  "id": "se_spring_new_1", "season": "spring", "stage": "crush",
  "title": "春·新事", "weight": 7, "priority": 0, "once_per_year": true,
  "place": "any", "affRange": "20-50", "usedFlag": "se_spring_new_1",
  "req": "s => s.age >= 16",
  "text": "s => `你的叙事文本，可用 ${s.herName} 插值。`",
  "choices": [
    { "text": "选项一", "hint": "好感 +10", "charaff": { "key": "herb", "d": 10 },
      "apply": "s => { Characters.addAff(s, 'herb', 10); s.log('结果叙述'); }" }
  ]
}
```

同步到 `config-data.js` 的 `GAME_CONFIG.seasonEvents` 数组即可。
`text` / `req` / `apply` 写成**字符串**，由 `season.js` 的 `compileExpr()` 在运行时编译为函数。

`charKey` 对照：`herb` = 药谷姑娘 · `sister` = 剑宗师姐 · `third` = 血海修罗。
