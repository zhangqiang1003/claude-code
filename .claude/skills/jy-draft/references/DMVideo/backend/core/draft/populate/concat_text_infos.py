# -*- coding: utf-8 -*-
"""
拼接文本信息 API
"""

import json
from typing import Dict, Any, List


def concat_text_infos(text_infos1: str, text_infos2: str) -> Dict[str, Any]:
    """拼接两个文本素材信息"""

    if not text_infos1 and not text_infos2:
        return {"code": -1, "message": "两个素材信息都为空", "text_infos": "[]", "segment_ids": []}

    try:
        list1 = json.loads(text_infos1) if text_infos1 else []
        list2 = json.loads(text_infos2) if text_infos2 else []
    except:
        return {"code": -1, "message": "JSON 解析错误", "text_infos": "[]", "segment_ids": []}

    combined = list1 + list2
    if not combined:
        return {"code": -1, "message": "合并后为空", "text_infos": "[]", "segment_ids": []}

    current = 0
    for item in combined:
        dur = item.get("timerange", {}).get("duration", 0)
        item["timerange"] = {"start": current, "duration": dur}
        current += dur

    return {"code": 0, "message": "成功", "text_infos": json.dumps(combined, ensure_ascii=False), "segment_ids": [i.get("id", "") for i in combined]}