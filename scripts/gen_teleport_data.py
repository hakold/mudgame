#!/usr/bin/env python3
"""Generate new rooms and NPCs for teleport system."""
import json
import os

BASE = '/home/ubuntu/home/workspace/mudgame/config/json'

# ============================================================
# 1. Generate new rooms
# ============================================================
new_rooms = [
    # --- City Center and surroundings ---
    {
        "id": "city_center",
        "name": "洛阳城中心",
        "description": "洛阳城的中心地带，车水马龙，商贾云集。这里是洛阳最繁华的区域，四通八达。",
        "mapId": "city",
        "exits": [
            {"direction": "north", "roomId": "city_north"},
            {"direction": "south", "roomId": "city_south"},
            {"direction": "east", "roomId": "city_east"},
            {"direction": "west", "roomId": "city_west"},
            {"direction": "square", "roomId": "city_square"}
        ],
        "features": ["钟楼", "鼓楼", "马车驿站"]
    },
    {
        "id": "city_north",
        "name": "洛阳北街",
        "description": "洛阳城的北街，居住着不少富商大贾，宅院气派。",
        "mapId": "city",
        "exits": [
            {"direction": "south", "roomId": "city_center"},
            {"direction": "east", "roomId": "city_gate"}
        ],
        "features": ["富商宅院", "酒楼"]
    },
    {
        "id": "city_south",
        "name": "洛阳南街",
        "description": "洛阳城的南街，多是平民百姓的住所，烟火气息浓厚。",
        "mapId": "city",
        "exits": [
            {"direction": "north", "roomId": "city_center"},
            {"direction": "west", "roomId": "city_arena"}
        ],
        "features": ["民居", "小吃摊"]
    },
    {
        "id": "city_east",
        "name": "洛阳东街",
        "description": "洛阳城的东街，靠近城门，过往行人络绎不绝。",
        "mapId": "city",
        "exits": [
            {"direction": "west", "roomId": "city_center"},
            {"direction": "north", "roomId": "city_square"}
        ],
        "features": ["驿站", "茶馆"]
    },
    {
        "id": "city_west",
        "name": "洛阳西街",
        "description": "洛阳城的西街，商铺林立，叫卖声此起彼伏。",
        "mapId": "city",
        "exits": [
            {"direction": "east", "roomId": "city_center"},
            {"direction": "north", "roomId": "city_market"}
        ],
        "features": ["商铺", "当铺"]
    },

    # --- Faction Gate rooms ---
    {
        "id": "shaolin_gate",
        "name": "少林寺山门",
        "description": "少林寺的山门前，古柏参天，石阶宽阔。门前立着一块巨大的石碑，上书「少林寺」三个大字。",
        "mapId": "mountain",
        "exits": [
            {"direction": "north", "roomId": "shaolin_temple"},
            {"direction": "south", "roomId": "mountain_temple"}
        ],
        "features": ["石碑", "古柏", "轿夫"]
    },
    {
        "id": "wudang_gate",
        "name": "武当山山门",
        "description": "武当山的山门前，云雾缭绕，仙气氤氲。一条石阶蜿蜒而上，通向紫霄宫。",
        "mapId": "mountain",
        "exits": [
            {"direction": "up", "roomId": "wudang_peak"},
            {"direction": "west", "roomId": "mountain_peak"}
        ],
        "features": ["石阶", "牌坊", "轿夫"]
    },
    {
        "id": "emei_gate",
        "name": "峨眉派山门",
        "description": "峨眉山的山门前，溪水潺潺，翠竹成林。门前有女弟子值守，英姿飒爽。",
        "mapId": "mountain",
        "exits": [
            {"direction": "east", "roomId": "emei_temple"},
            {"direction": "west", "roomId": "mountain_temple"}
        ],
        "features": ["竹林", "溪流", "轿夫"]
    },
    {
        "id": "gaibang_gate",
        "name": "丐帮总舵入口",
        "description": "丐帮总舵的入口，虽不起眼，却暗藏机关。门前的石狮子和竹竿透露出丐帮的威严。",
        "mapId": "city",
        "exits": [
            {"direction": "west", "roomId": "gaibang_hq"},
            {"direction": "east", "roomId": "city_square"}
        ],
        "features": ["石狮", "竹竿", "轿夫"]
    },
    {
        "id": "mingjiao_gate",
        "name": "明教光明顶入口",
        "description": "通往明教光明顶的山路入口，两侧悬崖陡壁，地势险峻。圣火的旗帜在风中猎猎作响。",
        "mapId": "volcano",
        "exits": [
            {"direction": "up", "roomId": "mingjiao_hall"},
            {"direction": "down", "roomId": "volcano_crater"}
        ],
        "features": ["圣火旗", "悬崖", "轿夫"]
    },
    {
        "id": "xiaoyao_gate",
        "name": "逍遥派入口",
        "description": "逍遥派的入口隐藏在桃花林中，若非有人指引，外人很难发现。",
        "mapId": "island",
        "exits": [
            {"direction": "south", "roomId": "xiaoyao_valley"},
            {"direction": "east", "roomId": "island_cave"}
        ],
        "features": ["桃花林", "石碑", "轿夫"]
    }
]

# ============================================================
# 2. Generate new NPCs
# ============================================================
new_npcs = [
    # Village carter in village_center
    {
        "id": "npc_village_carter",
        "name": "门派传送车夫",
        "description": "专门负责将侠客送往各大门派的马车夫",
        "roomId": "village_center",
        "type": "teleport",
        "services": ["teleport"],
        "dialogues": {
            "greeting": ["想去哪个门派？我可以送你一程，每次100金币。"],
            "teleport": "请选择目的地"
        },
        "teleportDestinations": [
            {"id": "shaolin", "name": "少林寺", "roomId": "shaolin_gate", "cost": 100},
            {"id": "wudang", "name": "武当山", "roomId": "wudang_gate", "cost": 100},
            {"id": "emei", "name": "峨眉派", "roomId": "emei_gate", "cost": 100},
            {"id": "gaibang", "name": "丐帮总舵", "roomId": "gaibang_gate", "cost": 100},
            {"id": "mingjiao", "name": "明教光明顶", "roomId": "mingjiao_gate", "cost": 100},
            {"id": "xiaoyao", "name": "逍遥派", "roomId": "xiaoyao_gate", "cost": 100}
        ]
    },
]

# Faction gate carter NPCs
faction_gate_npcs = [
    {"faction": "shaolin", "roomId": "shaolin_gate"},
    {"faction": "wudang", "roomId": "wudang_gate"},
    {"faction": "emei", "roomId": "emei_gate"},
    {"faction": "gaibang", "roomId": "gaibang_gate"},
    {"faction": "mingjiao", "roomId": "mingjiao_gate"},
    {"faction": "xiaoyao", "roomId": "xiaoyao_gate"},
]

for f in faction_gate_npcs:
    new_npcs.append({
        "id": f"npc_carter_{f['faction']}",
        "name": "门派传送轿夫",
        "description": f"在此等候的轿夫，可以送侠客去往别处。",
        "roomId": f["roomId"],
        "type": "teleport",
        "services": ["teleport"],
        "dialogues": {
            "greeting": [f"客官要坐轿子去哪里？"],
            "teleport": "请选择目的地"
        },
        "teleportDestinations": [
            {"id": "village", "name": "新手村", "roomId": "village_center", "cost": 100},
            {"id": "city", "name": "洛阳城", "roomId": "city_center", "cost": 150}
        ]
    })

# ============================================================
# 3. Output the data as JSON strings
# ============================================================
rooms_json = json.dumps(new_rooms, ensure_ascii=False, indent=2)
npcs_json = json.dumps(new_npcs, ensure_ascii=False, indent=2)

print("=== NEW ROOMS ===")
print(rooms_json)
print("\n=== NEW NPCS ===")
print(npcs_json)

# Save to temp files for patching
with open('/tmp/new_rooms.json', 'w', encoding='utf-8') as f:
    f.write(rooms_json)
with open('/tmp/new_npcs.json', 'w', encoding='utf-8') as f:
    f.write(npcs_json)

print("\n\nFiles written to /tmp/new_rooms.json and /tmp/new_npcs.json")
