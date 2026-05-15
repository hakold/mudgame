# 武侠MUD游戏实现方案

基于北大侠客行MUD的核心玩法，制定P0功能实现方案。

## 一、核心系统优先级

### P0 - 必须立即实现
1. **战斗系统** - 怪物战斗、PVP
2. **商店系统** - buy/sell物品
3. **技能系统** - 学习技能、使用技能
4. **属性升级** - train提升属性
5. **任务系统** - 主线/支线任务

### P1 - 重要功能
- 门派系统完善
- 装备系统
- 组队系统
- 交易系统

### P2 - 锦上添花
- 帮派系统
- 结婚系统
- 房屋系统

## 二、P0功能详细设计

### 1. 战斗系统 (已有基础，需完善)

**怪物配置扩展**
```json
{
  "id": "monster_wild_boar",
  "name": "野猪",
  "level": 3,
  "hp": 150,
  "mp": 0,
  "attack": 15,
  "defense": 8,
  "exp": 30,
  "gold": 10,
  "drops": [
    { "itemId": "item_boar_meat", "rate": 0.3 },
    { "itemId": "item_boar_tusk", "rate": 0.1 }
  ],
  "skills": ["skill_charge"],
  "roomId": "forest_entrance",
  "respawnTime": 300
}
```

**战斗流程**
1. `kill <怪物名>` - 发起战斗
2. 回合制战斗，每回合选择动作
3. 可用动作：attack(攻击), skill <技能>(使用技能), item <物品>(使用物品), flee(逃跑)
4. 战斗结束获得经验、金币、掉落物品

**战斗快捷按钮**
- ⚔️ 攻击
- 🎯 技能
- 💊 物品
- 🏃 逃跑

### 2. 商店系统

**NPC商店类型**
- weapon_shop - 武器店
- armor_shop - 防具店
- potion_shop - 药店
- general_shop - 杂货店

**命令**
- `shop` - 查看商店物品列表
- `buy <物品ID>` - 购买物品
- `sell <物品ID>` - 出售物品
- `list` - 同shop，查看商品

**实现逻辑**
```javascript
socket.on('buy_item', async (data) => {
  const { itemId, quantity = 1 } = data;
  const room = getRoom(user.location.roomId);
  
  // 检查房间是否有商店服务
  if (!room.services?.includes('buy_item')) {
    return socket.emit('error', { message: '这里没有商店' });
  }
  
  const item = getItem(itemId);
  if (!item) {
    return socket.emit('error', { message: '物品不存在' });
  }
  
  const totalPrice = item.price * quantity;
  if (user.gold < totalPrice) {
    return socket.emit('error', { message: `金币不足，需要${totalPrice}金币` });
  }
  
  // 扣除金币
  user.gold -= totalPrice;
  
  // 添加到背包
  const existingItem = await Inventory.findOne({ userId: user._id, itemId });
  if (existingItem) {
    existingItem.quantity += quantity;
    await existingItem.save();
  } else {
    await Inventory.create({
      userId: user._id,
      itemId,
      quantity,
      equipped: false
    });
  }
  
  await user.save();
  
  socket.emit('item_bought', {
    item,
    quantity,
    totalGold: user.gold
  });
});
```

### 3. 技能系统

**技能类型**
- attack - 攻击技能
- defense - 防御技能
- heal - 治疗技能
- buff - 增益技能
- passive - 被动技能

**学习技能**
- `learn <技能ID>` - 向NPC学习技能
- `skills` - 查看已学技能
- `practice <技能ID>` - 练习技能提升熟练度

**技能配置**
```json
{
  "id": "skill_basic_sword",
  "name": "基础剑法",
  "type": "attack",
  "faction": "general",
  "requireLevel": 1,
  "mpCost": 5,
  "cooldown": 0,
  "damage": [10, 20],
  "description": "基础的剑法，造成10-20点伤害",
  "learnPrice": 100
}
```

**门派技能**
- 少林：金刚掌、罗汉拳、易筋经
- 武当：太极拳、太极剑、梯云纵
- 峨眉：峨眉剑法、九阳功
- 丐帮：打狗棒法、降龙十八掌
- 明教：乾坤大挪移、圣火功

### 4. 属性升级系统

**基础属性**
- strength (力量) - 影响物理攻击
- dexterity (敏捷) - 影响命中和闪避
- constitution (体质) - 影响HP上限
- intelligence (悟性) - 影响技能学习和MP上限

**升级方式**
- `train <属性>` - 在练武场训练属性
- 每次训练消耗经验和金币
- `stats` - 查看详细属性

**训练消耗**
```javascript
function getTrainCost(currentValue) {
  return {
    exp: currentValue * 100,
    gold: currentValue * 10
  };
}
```

### 5. 任务系统

**任务类型**
- main - 主线任务
- side - 支线任务
- daily - 日常任务
- repeatable - 可重复任务

**任务流程**
1. `quest list` - 查看可接任务
2. `quest accept <任务ID>` - 接取任务
3. `quest info` - 查看当前任务进度
4. `quest complete <任务ID>` - 完成任务（自动检测）

**新手主线任务链**
```
1. 【初入江湖】与村长对话
   - 奖励: 100经验, 50金币
   
2. 【装备自己】购买一把木剑
   - 前置: 任务1
   - 奖励: 200经验, 100金币
   
3. 【初试身手】击杀3只野猪
   - 前置: 任务2
   - 奖励: 300经验, 150金币, 新手护腕
   
4. 【拜师学艺】加入门派
   - 前置: 任务3
   - 奖励: 500经验, 200金币
   
5. 【技能初成】学习一个技能
   - 前置: 任务4
   - 奖励: 400经验, 技能书
   
6. 【森林探险】探索迷雾森林深处
   - 前置: 任务5
   - 奖励: 600经验, 300金币
   
7. 【挑战强敌】击杀森林狼王
   - 前置: 任务6
   - 奖励: 1000经验, 500金币, 狼王之牙
   
8. 【进城】前往洛阳城
   - 前置: 任务7
   - 奖励: 800经验, 400金币
```

## 三、UI快捷按钮设计

### 主界面底部按钮区

**第一行 - 常用操作**
```
[👁️查看] [📍位置] [📊状态] [🎒背包] [⚔️技能] [📜任务]
```

**第二行 - 战斗相关**
```
[🏪商店] [💊买药] [💤休息] [🏯门派] [❓帮助]
```

**战斗中按钮**
```
[⚔️攻击] [🎯技能] [💊物品] [🏃逃跑]
```

**NPC对话后按钮**
根据NPC类型动态显示：
- 商店NPC: [📦购买] [💰出售] [📋列表]
- 训练NPC: [📚学习技能] [💪训练属性]
- 任务NPC: [✅接取任务] [📋查看任务]

## 四、数据配置文件更新

### monsters.json 扩展
需要添加更多怪物，覆盖各个等级段：
- 1-5级：野兔、野猪、野狼
- 5-10级：山贼、强盗、毒蛇
- 10-20级：黑熊、老虎、山贼头目
- 20-30级：魔教弟子、江湖杀手
- 30-40级：妖兽、魔化动物
- 40-50级：精英怪物、小BOSS
- 50+级：BOSS级怪物

### items.json 扩展
- 武器：木剑、铁剑、钢剑、玄铁剑、倚天剑
- 防具：布衣、皮甲、铁甲、金丝甲
- 药品：小还丹、大还丹、九转还魂丹
- 材料：各种怪物掉落材料

### skills.json 扩展
- 基础技能：基础攻击、基础防御、冥想
- 门派技能：各门派特色技能
- 特殊技能：稀有技能、绝学

## 五、实现步骤

### 第一阶段：战斗系统完善
1. 扩展怪物配置（20+种怪物）
2. 完善战斗逻辑（技能使用、物品使用）
3. 添加战斗UI快捷按钮
4. 实现掉落系统

### 第二阶段：商店系统
1. 实现buy/sell命令
2. 添加商店NPC
3. 扩展物品配置
4. 实现物品价格系统

### 第三阶段：技能系统
1. 扩展技能配置（50+技能）
2. 实现learn命令
3. 实现技能升级（熟练度）
4. 门派技能绑定

### 第四阶段：属性升级
1. 实现train命令
2. 添加训练NPC
3. 平衡属性成长曲线

### 第五阶段：任务系统
1. 实现任务流程
2. 添加新手主线任务链
3. 添加日常任务
4. 任务奖励系统

## 六、快捷命令汇总

```
移动类:
  n/north, s/south, e/east, w/west - 方向移动
  up, down, in, out - 特殊方向

查看类:
  look/l - 查看房间
  where - 查看位置
  status - 查看状态
  inventory/i - 查看背包
  skills - 查看技能
  quests - 查看任务

交互类:
  talk <NPC> - 与NPC对话
  buy <物品> - 购买
  sell <物品> - 出售
  learn <技能> - 学习技能
  train <属性> - 训练属性

战斗类:
  kill <怪物> - 攻击怪物
  attack/a - 战斗中攻击
  skill <技能> - 使用技能
  flee - 逃跑

任务类:
  quest list - 查看任务列表
  quest accept <任务> - 接取任务
  quest complete <任务> - 完成任务

其他:
  rest - 休息恢复
  help - 帮助
  faction - 门派信息
  faction join <门派> - 加入门派
```

---

*文档版本: 1.0*
*最后更新: 2026-05-14*
