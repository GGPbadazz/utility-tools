"""
批号状态管理器
Batch Number State Manager

使用JSON文件存储已使用的批号状态
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from config import BATCH_DISPLAY


class BatchManager:
    """批号管理器"""

    def __init__(self, data_dir: str = None):
        """
        初始化批号管理器

        Args:
            data_dir: 数据文件存储目录，默认为 src/data/
        """
        if data_dir is None:
            # 默认使用 src/data/ 目录
            current_dir = os.path.dirname(os.path.abspath(__file__))
            data_dir = os.path.join(current_dir, 'data')

        self.data_dir = data_dir
        self.data_file = os.path.join(data_dir, 'used_batches.json')

        # 确保数据目录存在
        os.makedirs(data_dir, exist_ok=True)

        # 加载或初始化数据
        self._load_data()

    def _load_data(self):
        """加载数据文件"""
        if os.path.exists(self.data_file):
            try:
                with open(self.data_file, 'r', encoding='utf-8') as f:
                    self.data = json.load(f)
            except (json.JSONDecodeError, IOError):
                self.data = {}
        else:
            self.data = {}

    def _save_data(self):
        """保存数据到文件"""
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    def _get_year_month_key(self) -> str:
        """获取当前年月键 (如 "2511")"""
        now = datetime.now()
        return f"{now.year % 100:02d}{now.month:02d}"

    def _get_last_month_key(self) -> str:
        """获取上一个月的年月键 (如当前是2512，返回2511)"""
        now = datetime.now()
        year = now.year % 100
        month = now.month

        # 计算上个月
        if month == 1:
            year = (year - 1) % 100
            month = 12
        else:
            month = month - 1

        return f"{year:02d}{month:02d}"

    def reset_current_month(self) -> Dict:
        """
        重置当前月份的所有批号数据

        Returns:
            {
                "success": True,
                "year_month": "2511",
                "message": "已重置 2511 月份的所有批号数据"
            }
        """
        year_month = self._get_year_month_key()

        # 删除当前月份的所有数据
        if year_month in self.data:
            del self.data[year_month]

        self._save_data()

        return {
            "success": True,
            "year_month": year_month,
            "message": f"已重置 {year_month} 月份的所有批号数据"
        }

    def _check_auto_reset(self):
        """
        检查是否需要自动重置（新月份开始）

        如果数据中没有当前月份的数据，且有旧月份数据，
        说明是新的月份，此时旧数据仍保留用于历史查询，
        但新月份会自动从1开始
        """
        year_month = self._get_year_month_key()

        # 如果当前月份没有数据，说明是新月份，会自动从1开始
        # 不需要特别处理，_ensure_month_data 会自动创建
        return year_month

    def get_current_month_info(self) -> Dict:
        """
        获取当前月份信息

        Returns:
            {
                "year_month": "2511",
                "has_data": True,
                "prefixes": ["A", "D", "P"],
                "total_used": 15
            }
        """
        year_month = self._get_year_month_key()
        has_data = year_month in self.data

        prefixes = []
        total_used = 0

        if has_data:
            for key, value in self.data[year_month].items():
                if not key.endswith("-sub"):
                    prefixes.append(key)
                    total_used += len(value.get("used", []))

        return {
            "year_month": year_month,
            "has_data": has_data,
            "prefixes": prefixes,
            "total_used": total_used
        }

    def _ensure_month_data(self, year_month: str, prefix: str):
        """确保月份数据结构存在"""
        if year_month not in self.data:
            self.data[year_month] = {}
        if prefix not in self.data[year_month]:
            self.data[year_month][prefix] = {
                "next": 1,
                "used": []
            }

    def _ensure_sub_data(self, year_month: str, prefix: str, batch: int):
        """确保分段样品子序号数据结构存在"""
        self._ensure_month_data(year_month, prefix)

        sub_key = f"{prefix}-sub"
        if sub_key not in self.data[year_month]:
            self.data[year_month][sub_key] = {}

        batch_str = str(batch)
        if batch_str not in self.data[year_month][sub_key]:
            self.data[year_month][sub_key][batch_str] = {
                "next": 1,
                "used": []
            }

    def get_batch_status(self, prefix: str) -> Dict:
        """
        获取指定样品类型的批号状态

        Args:
            prefix: 样品前缀 (如 "A", "D", "P" 等)

        Returns:
            {
                "year_month": "2511",
                "prefix": "A",
                "next": 4,  # 下一个可用批号
                "used": [1, 2, 3],  # 已使用的批号列表
                "display_start": 1,  # 当前页面起始批号
                "display_end": 5,  # 当前页面结束批号
            }
        """
        year_month = self._get_year_month_key()
        self._ensure_month_data(year_month, prefix)

        batch_data = self.data[year_month][prefix]
        next_batch = batch_data["next"]
        used = batch_data["used"]

        # 计算显示范围（包含 next 的页面）
        buttons_per_page = BATCH_DISPLAY["buttons_per_page"]
        page = (next_batch - 1) // buttons_per_page
        display_start = page * buttons_per_page + 1
        display_end = display_start + buttons_per_page - 1

        return {
            "year_month": year_month,
            "prefix": prefix,
            "next": next_batch,
            "used": used,
            "display_start": display_start,
            "display_end": display_end,
            "buttons_per_page": buttons_per_page
        }

    def get_sub_batch_status(self, prefix: str, batch: int) -> Dict:
        """
        获取分段样品子序号状态

        Args:
            prefix: 样品前缀 (通常是 "P")
            batch: 主批号

        Returns:
            类似 get_batch_status 的结构
        """
        year_month = self._get_year_month_key()
        self._ensure_sub_data(year_month, prefix, batch)

        sub_key = f"{prefix}-sub"
        batch_str = str(batch)
        sub_data = self.data[year_month][sub_key][batch_str]
        next_sub = sub_data["next"]
        used = sub_data["used"]

        # 计算显示范围
        buttons_per_page = BATCH_DISPLAY["buttons_per_page"]
        page = (next_sub - 1) // buttons_per_page
        display_start = page * buttons_per_page + 1
        display_end = display_start + buttons_per_page - 1

        return {
            "year_month": year_month,
            "prefix": prefix,
            "batch": batch,
            "next": next_sub,
            "used": used,
            "display_start": display_start,
            "display_end": display_end,
            "buttons_per_page": buttons_per_page
        }

    def use_batch(self, prefix: str, batch: int) -> Tuple[bool, str]:
        """
        使用一个批号

        Args:
            prefix: 样品前缀
            batch: 批号

        Returns:
            (成功与否, 消息)
        """
        year_month = self._get_year_month_key()
        self._ensure_month_data(year_month, prefix)

        batch_data = self.data[year_month][prefix]
        next_batch = batch_data["next"]

        # 检查是否已使用（重新打印）
        if batch in batch_data["used"]:
            return True, "重新打印"

        # 使用新批号（允许跳级选择）
        batch_data["used"].append(batch)
        # 如果是跳级选择，更新next为当前批号+1
        if batch >= next_batch:
            batch_data["next"] = batch + 1
        self._save_data()

        return True, "新批号"

    def use_sub_batch(self, prefix: str, batch: int, sub: int) -> Tuple[bool, str]:
        """
        使用分段样品子序号

        Args:
            prefix: 样品前缀
            batch: 主批号
            sub: 子序号

        Returns:
            (成功与否, 消息)
        """
        year_month = self._get_year_month_key()
        self._ensure_sub_data(year_month, prefix, batch)

        sub_key = f"{prefix}-sub"
        batch_str = str(batch)
        sub_data = self.data[year_month][sub_key][batch_str]
        next_sub = sub_data["next"]

        # 检查是否可以使用
        if sub > next_sub:
            return False, f"不能跳选子序号，请先使用 {next_sub:02d}"

        if sub < next_sub:
            # 重新打印
            if sub in sub_data["used"]:
                return True, "重新打印"
            else:
                return False, "子序号状态异常"

        # 使用新子序号
        sub_data["used"].append(sub)
        sub_data["next"] = sub + 1
        self._save_data()

        return True, "新子序号"

    def get_last_month_final_batches(self, prefix: str) -> Dict:
        """
        获取上月末批次（用于延续上月生产）

        Args:
            prefix: 样品前缀

        Returns:
            如果上月有数据，返回最后一页的批号列表；
            如果上月无数据，返回上月第一页（001开始），用于跨月首次生产
        """
        last_month = self._get_last_month_key()
        buttons_per_page = BATCH_DISPLAY["buttons_per_page"]

        # 检查上月数据是否存在
        if last_month not in self.data or prefix not in self.data[last_month]:
            # 上月无数据，返回上月第一页，推荐001
            batches = []
            for i in range(1, buttons_per_page + 1):
                batches.append({
                    "number": i,
                    "status": "next" if i == 1 else "available",
                    "label": f"{i:03d}"
                })

            return {
                "year_month": last_month,
                "prefix": prefix,
                "page": 0,
                "start": 1,
                "end": buttons_per_page,
                "batches": batches,
                "has_prev": False,
                "has_next": True,
                "is_last_month": True
            }

        batch_data = self.data[last_month][prefix]
        used = batch_data.get("used", [])

        if not used:
            # 有数据结构但无已用批号，返回第一页
            batches = []
            for i in range(1, buttons_per_page + 1):
                batches.append({
                    "number": i,
                    "status": "next" if i == 1 else "available",
                    "label": f"{i:03d}"
                })

            return {
                "year_month": last_month,
                "prefix": prefix,
                "page": 0,
                "start": 1,
                "end": buttons_per_page,
                "batches": batches,
                "has_prev": False,
                "has_next": True,
                "is_last_month": True
            }

        # 找到最大的已使用批号
        max_used = max(used)

        # 计算包含最大批号的页码
        page = (max_used - 1) // buttons_per_page

        # 获取该页的批号
        start = page * buttons_per_page + 1
        end = start + buttons_per_page - 1

        # 下一个推荐批号（上月最大使用批号+1）
        next_batch = max_used + 1

        batches = []
        for i in range(start, end + 1):
            if i in used:
                status = "used"
            elif i == next_batch:
                status = "next"  # 标记为推荐批号
            else:
                status = "available"

            batches.append({
                "number": i,
                "status": status,
                "label": f"{i:03d}"
            })

        return {
            "year_month": last_month,
            "prefix": prefix,
            "page": page,
            "start": start,
            "end": end,
            "batches": batches,
            "has_prev": page > 0,
            "has_next": True,
            "is_last_month": True
        }

    def get_page_batches(self, prefix: str, page: int) -> Dict:
        """
        获取指定页的批号列表

        Args:
            prefix: 样品前缀
            page: 页码 (从0开始)

        Returns:
            包含该页批号状态的字典
        """
        year_month = self._get_year_month_key()
        self._ensure_month_data(year_month, prefix)

        batch_data = self.data[year_month][prefix]
        next_batch = batch_data["next"]
        used = batch_data["used"]

        buttons_per_page = BATCH_DISPLAY["buttons_per_page"]
        start = page * buttons_per_page + 1
        end = start + buttons_per_page - 1

        batches = []
        for i in range(start, end + 1):
            if i in used:
                status = "used"
            elif i == next_batch:
                status = "next"
            else:
                status = "available"  # 可选（允许跳级）

            batches.append({
                "number": i,
                "status": status,
                "label": f"{i:03d}"
            })

        return {
            "year_month": year_month,
            "prefix": prefix,
            "page": page,
            "start": start,
            "end": end,
            "next": next_batch,
            "batches": batches,
            "has_prev": page > 0,
            "has_next": True  # 总是可以往后翻
        }

    def get_page_sub_batches(self, prefix: str, batch: int, page: int, max_sub: int = 20) -> Dict:
        """
        获取分段样品子序号的指定页

        Args:
            prefix: 样品前缀
            batch: 主批号
            page: 页码 (从0开始)
            max_sub: 最大子序号数量

        Returns:
            包含该页子序号状态的字典
        """
        year_month = self._get_year_month_key()
        self._ensure_sub_data(year_month, prefix, batch)

        sub_key = f"{prefix}-sub"
        batch_str = str(batch)
        sub_data = self.data[year_month][sub_key][batch_str]
        next_sub = sub_data["next"]
        used = sub_data["used"]

        buttons_per_page = BATCH_DISPLAY["buttons_per_page"]
        start = page * buttons_per_page + 1
        end = min(start + buttons_per_page - 1, max_sub)

        subs = []
        for i in range(start, end + 1):
            if i in used or i < next_sub:
                status = "used"
            elif i == next_sub:
                status = "next"
            else:
                status = "disabled"

            subs.append({
                "number": i,
                "status": status,
                "label": f"{i:02d}"
            })

        max_page = (max_sub - 1) // buttons_per_page

        return {
            "year_month": year_month,
            "prefix": prefix,
            "batch": batch,
            "page": page,
            "start": start,
            "end": end,
            "next": next_sub,
            "subs": subs,
            "has_prev": page > 0,
            "has_next": page < max_page,
            "max_sub": max_sub
        }

    def format_batch_id(self, prefix: str, batch: int, sub: int = None, special_format: bool = False, sub_suffix: str = "", year_month: str = None) -> str:
        """
        格式化完整的批号ID

        Args:
            prefix: 样品前缀
            batch: 批号
            sub: 子序号 (可选，分段样品用)
            special_format: 是否使用特殊格式（如分段样品 LOT-YYMM-XXX）
            sub_suffix: 子序号后缀（如示例生产线的 #）
            year_month: 年月 (可选，用于延续上月生产)

        Returns:
            格式化的批号字符串
            普通格式: "A-2511001" 或 "P-2511001-05"
            特殊格式: "LOT-2511-001"
            带后缀格式: "F-2511001-01#"
        """
        if year_month is None:
            year_month = self._get_year_month_key()

        if special_format:
            # 特殊格式：LOT-YYMM-XXX
            if sub is not None:
                return f"{prefix}-{year_month}-{batch:03d}-{sub:02d}{sub_suffix}"
            else:
                return f"{prefix}-{year_month}-{batch:03d}"
        else:
            # 普通格式：A-2511001
            if sub is not None:
                return f"{prefix}-{year_month}{batch:03d}-{sub:02d}{sub_suffix}"
            else:
                return f"{prefix}-{year_month}{batch:03d}"

    def get_recommended_page(self, prefix: str) -> int:
        """获取推荐显示的页码（包含下一个可用批号的页）"""
        year_month = self._get_year_month_key()
        self._ensure_month_data(year_month, prefix)

        next_batch = self.data[year_month][prefix]["next"]
        buttons_per_page = BATCH_DISPLAY["buttons_per_page"]

        return (next_batch - 1) // buttons_per_page

    def get_recommended_sub_page(self, prefix: str, batch: int) -> int:
        """获取分段样品子序号推荐显示的页码"""
        year_month = self._get_year_month_key()
        self._ensure_sub_data(year_month, prefix, batch)

        sub_key = f"{prefix}-sub"
        batch_str = str(batch)
        next_sub = self.data[year_month][sub_key][batch_str]["next"]
        buttons_per_page = BATCH_DISPLAY["buttons_per_page"]

        return (next_sub - 1) // buttons_per_page


# 创建全局实例
batch_manager = BatchManager()
