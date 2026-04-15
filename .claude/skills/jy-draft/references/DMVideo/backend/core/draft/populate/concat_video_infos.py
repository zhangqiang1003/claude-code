# -*- coding: utf-8 -*-
"""
拼接视频/图片信息 API
"""

import json
from typing import Dict, Any, List


def concat_video_infos(video_infos1: str, video_infos2: str) -> Dict[str, Any]:
    """拼接两个视频素材信息"""

    if not video_infos1 and not video_infos2:
        return {"code": -1, "message": "两个素材信息都为空", "video_infos": "[]", "segment_ids": []}

    try:
        list1 = json.loads(video_infos1) if video_infos1 else []
        list2 = json.loads(video_infos2) if video_infos2 else []
    except json.JSONDecodeError as e:
        return {"code": -1, "message": f"JSON 解析错误: {e}", "video_infos": "[]", "segment_ids": []}

    combined = list1 + list2
    if not combined:
        return {"code": -1, "message": "合并后为空", "video_infos": "[]", "segment_ids": []}

    # 重新计算时间
    current = 0
    for item in combined:
        dur = item.get("target_timerange", {}).get("duration", 0)
        item["target_timerange"] = {"start": current, "duration": dur}
        current += dur

    return {"code": 0, "message": "成功", "video_infos": json.dumps(combined, ensure_ascii=False), "segment_ids": [i.get("id", "") for i in combined]}


def concat_video_infos_list(video_infos_list: List[str]) -> Dict[str, Any]:
    """拼接多个视频素材信息"""
    if not video_infos_list:
        return {"code": -1, "message": "列表不能为空", "video_infos": "[]", "segment_ids": []}

    result = None
    current = "[]"
    for i, v in enumerate(video_infos_list):
        if i == 0:
            current = v
        else:
            result = concat_video_infos(current, v)
            if result["code"] != 0:
                return result
            current = result["video_infos"]

    try:
        final = json.loads(current)
    except:
        return {"code": -1, "message": "解析错误", "video_infos": "[]", "segment_ids": []}

    return {"code": 0, "message": "成功", "video_infos": current, "segment_ids": [i.get("id", "") for i in final]}