# CG 资源说明 · 剑与丹

## 一、目录结构

```
剑与丹/
└── resources/
    └── cg/
        ├── cg-manifest.json      # 全部 CG 节点清单（自动生成）
        ├── cg_herb_meet_1.png    # 药谷姑娘 · 初识
        ├── cg_herb_rain_1.png    # 药谷姑娘 · 雨夜撑伞
        ├── ...
        └── cg_end_return_alone_1.png
```

## 二、命名规则

`{CG节点ID}_{变体序号}.png`

- **CG节点ID**：与事件里 `cg` 字段 / `choice.cg` 字段完全一致（见下表）。
- **变体序号**：从 `1` 开始。**同一节点可放多张**（`_1.png` / `_2.png` / `_3.png`…），
  游戏每次展示时会在 `1～3` 之间**随机取一张**，实现「同一节点、不同周目不同画面」。
- 若只放一张，命名为 `{CG节点ID}.png`（无序号）亦可，引擎会自动回落。

示例：
```
cg_herb_meet_1.png   ← 第 1 张
cg_herb_meet_2.png   ← 第 2 张（可选）
cg_herb_meet.png     ← 无序号回落（可选）
```

## 三、接入方式（零代码改动）

CG 展示逻辑由 `ui.js` 的 `UI.showCG(cgId)` 完成，已在以下位置自动接入：

1. **事件节点**：事件对象上的 `cg: 'cg_xxx'` 字段 → 抽到该事件时展示。
2. **选项节点**：`choice.cg: 'cg_xxx'` → 玩家选择该选项时展示。
3. **结局节点**：`ui.js` 中 `endCgMap` 映射 → 结局结算页展示大图。

**放图即生效**：把图片按命名规则丢进 `resources/cg/` 即可，无需改任何代码。
**缺图自动降级**：文件不存在时，前端自动显示「水墨占位卡片」（不报错、不阻塞流程）。

## 四、已生成资源清单（25 张）

### 药谷姑娘线（herb）
| 节点 ID | 场景 | 文件 |
|---|---|---|
| cg_herb_meet | 初识·山坡药苗 | cg_herb_meet_1.png |
| cg_herb_rain | 雨夜撑伞 | cg_herb_rain_1.png |
| cg_herb_bond | 春日药圃 | cg_herb_bond_1.png |
| cg_herb_pendant | 赠药佩 | cg_herb_pendant_1.png |
| cg_herb_conflict | 雨中分歧 | cg_herb_conflict_1.png |
| cg_herb_reconcile | 药庐和解 | cg_herb_reconcile_1.png |
| cg_herb_blossom | 待雪花开 | cg_herb_blossom_1.png |

### 剑宗师姐线（sister）
| 节点 ID | 场景 | 文件 |
|---|---|---|
| cg_sister_meet | 剑宗山门 | cg_sister_meet_1.png |
| cg_sister_snow | 剑峰雪战 | cg_sister_snow_1.png |
| cg_sister_shield | 格剑挡箭 | cg_sister_shield_1.png |
| cg_sister_tomb | 无字碑 | cg_sister_tomb_1.png |
| cg_sister_swordforest | 剑冢石林 | cg_sister_swordforest_1.png |
| cg_sister_reconcile | 剑峰第二把剑 | cg_sister_reconcile_1.png |

### 血海修罗线（third）
| 节点 ID | 场景 | 文件 |
|---|---|---|
| cg_third_meet | 血河芦苇 | cg_third_meet_1.png |
| cg_third_blade | 刀锋相向 | cg_third_blade_1.png |
| cg_third_pool | 月夜深潭 | cg_third_pool_1.png |
| cg_third_write | 烛下写信 | cg_third_write_1.png |
| cg_third_conflict | 宗门对峙 | cg_third_conflict_1.png |
| cg_third_reconcile | 落日原并肩 | cg_third_reconcile_1.png |
| cg_third_river | 渡口离别 | cg_third_river_1.png |
| cg_third_wedding | 落日成婚 | cg_third_wedding_1.png |

### 结局 CG
| 结局 ID | 文件 |
|---|---|
| marry_herb | cg_end_marry_herb_1.png |
| marry_sister | cg_end_marry_sister_1.png |
| marry_third | cg_end_marry_third_1.png |
| return_mortal_alone | cg_end_return_alone_1.png |

> 归凡线三结局（return_mortal_herb / sister / third）复用对应角色的结局 CG。

## 五、美术风格约定

全部 CG 统一为 **中国水墨仙侠风**：
- 竖构图（2:3，1024×1536）
- 淡墨晕染、宣纸质感、大量留白
- 人物：青衫男主 + 各角色主题色（药谷=浅绿 #7fb069 / 师姐=蓝白 #5b8dd6 / 修罗=暗红 #c0392b）
- 无文字、无水印

后续补图请沿用此风格以保证视觉一致。

## 六、接入验证步骤

1. 打开游戏 → 触发任一角色事件（如「你站我药苗上了」）。
2. 观察主区域右上方是否出现 CG 卡片（带淡入动画，6 秒后自动淡出，点击可立即关闭）。
3. 打开浏览器控制台，确认无 `404` 之外的报错（404 属正常降级）。
4. 删除任意一张图后重放该节点，应显示占位卡片而非报错。
