"""
脱敏后的样品配置示例
Sanitized workshop and sample configuration.
"""

# 示例生产线 A
WORKSHOP_1 = {
    "id": "1",
    "name": "生产线A",
    "samples": [
        {
            "id": "raw_material",
            "name": "原料样品",
            "prefix": "RM",
            "has_sub": False
        },
        {
            "id": "reaction_liquid",
            "name": "反应过程样",
            "prefix": "RX",
            "has_sub": False
        },
        {
            "id": "intermediate",
            "name": "中间体样品",
            "prefix": "IM",
            "has_sub": False
        },
        {
            "id": "segment_sample",
            "name": "分段样品",
            "prefix": "SG",
            "has_sub": True,
            "sub_suffix": "#"
        }
    ]
}

# 示例生产线 B
WORKSHOP_2 = {
    "id": "2",
    "name": "生产线B",
    "samples": [
        {
            "id": "mother_liquor",
            "name": "母液样品",
            "prefix": "ML",
            "has_sub": False
        },
        {
            "id": "filtrate",
            "name": "过滤液样品",
            "prefix": "FT",
            "has_sub": False
        },
        {
            "id": "solid_sample",
            "name": "固体样品",
            "prefix": "SD",
            "has_sub": False
        },
        {
            "id": "finished_product",
            "name": "成品样品",
            "prefix": "FP",
            "has_sub": False
        }
    ]
}

# 示例生产线 C
WORKSHOP_3 = {
    "id": "3",
    "name": "生产线C",
    "samples": [
        {
            "id": "process_check",
            "name": "过程检查样",
            "prefix": "PC",
            "has_sub": False
        },
        {
            "id": "quality_check",
            "name": "质量确认样",
            "prefix": "QC",
            "has_sub": False
        },
        {
            "id": "special_lot",
            "name": "特殊批次样",
            "prefix": "LOT",
            "has_sub": False,
            "special_format": True
        }
    ]
}

# 预留区域
WORKSHOP_4 = {
    "id": "4",
    "name": "预留区域",
    "samples": []
}

# 自定义样品入口
WORKSHOP_RD = {
    "id": "rd",
    "name": "自定义样品",
    "samples": []
}

# 所有区域配置
WORKSHOPS = {
    "1": WORKSHOP_1,
    "2": WORKSHOP_2,
    "3": WORKSHOP_3,
    "4": WORKSHOP_4,
    "rd": WORKSHOP_RD,
}

# 区域列表（用于前端显示）
WORKSHOP_LIST = [
    {"id": "1", "name": "生产线A", "enabled": True},
    {"id": "2", "name": "生产线B", "enabled": True},
    {"id": "3", "name": "生产线C", "enabled": True},
    {"id": "4", "name": "预留区域", "enabled": False},
    {"id": "rd", "name": "自定义样品", "enabled": True},
]

# 批号显示配置
BATCH_DISPLAY = {
    "buttons_per_page": 5,
    "max_batch_number": 999
}

# 默认送样人列表配置（示例）
SENDERS = [
    {"id": "operator_a", "name": "操作员A"},
    {"id": "operator_b", "name": "操作员B"},
]

# 标签配置
LABEL_CONFIG = {
    "width_mm": 40,
    "height_mm": 15,
    "dpi": 203
}

# 字体配置（按优先级排列）
FONT_PATHS = [
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
    '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc',
    '/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf',
]

# 记录保存配置
RECORD_CONFIG = {
    "save_path": "records",
    "format": "html"
}
