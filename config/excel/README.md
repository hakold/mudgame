# Excel配置文件说明

本目录存放Excel格式的游戏配置源文件。

## 文件列表

| 文件名 | 说明 |
|--------|------|
| maps.xlsx | 地图配置 |
| rooms.xlsx | 房间配置 |
| npcs.xlsx | NPC配置 |
| monsters.xlsx | 怪物配置 |
| items.xlsx | 物品配置 |
| skills.xlsx | 技能配置 |
| quests.xlsx | 任务配置 |
| factions.xlsx | 门派配置 |

## 使用方法

1. 使用Excel或WPS打开对应的xlsx文件
2. 编辑配置内容
3. 保存文件
4. 运行转换命令生成JSON：
   ```bash
   cd ~/Desktop/Gameproject/server
   npm run import-config
   ```
5. 重启服务器

## 注意事项

- 请勿修改表头行
- ID字段必须唯一
- 数值字段请填写数字
- 布尔字段填写 true 或 false
- 数组字段使用逗号分隔

## 直接编辑JSON

如果不想使用Excel，可以直接编辑 `config/json/` 目录下的JSON文件。

详细字段说明请参考 `doc/配置说明.md`。