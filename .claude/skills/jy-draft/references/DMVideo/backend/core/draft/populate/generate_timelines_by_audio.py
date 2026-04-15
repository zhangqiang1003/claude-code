"""
根据音频列表生成时间线 API

根据输入的音频 URL 列表，自动分析每个音频的时长并生成时间线。
"""

import os
import tempfile
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

import requests
import pymediainfo


@dataclass
class AudioInfo:
    """音频信息"""
    url: str
    duration: int  # 微秒
    error: Optional[str] = None


def _download_audio(url: str, timeout: int = 30) -> Optional[str]:
    """
    下载音频文件到临时目录

    Args:
        url: 音频 URL
        timeout: 下载超时时间（秒）

    Returns:
        临时文件路径，失败返回 None
    """
    try:
        response = requests.get(url, timeout=timeout, stream=True)
        response.raise_for_status()

        # 获取文件扩展名
        url_path = url.split('?')[0]  # 移除查询参数
        ext = os.path.splitext(url_path)[1] or '.mp3'

        # 创建临时文件
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp_file:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    tmp_file.write(chunk)
            return tmp_file.name
    except Exception as e:
        return None


def _get_audio_duration(file_path: str) -> Optional[int]:
    """
    获取音频时长

    Args:
        file_path: 音频文件路径

    Returns:
        时长（微秒），失败返回 None
    """
    try:
        if not pymediainfo.MediaInfo.can_parse():
            return None

        info: pymediainfo.MediaInfo = pymediainfo.MediaInfo.parse(file_path)  # type: ignore

        if not info.audio_tracks:
            return None

        # 返回微秒单位
        return int(info.audio_tracks[0].duration * 1e3)  # type: ignore
    except Exception:
        return None


def _get_audio_duration_from_url(url: str, timeout: int = 30) -> AudioInfo:
    """
    从 URL 获取音频时长

    Args:
        url: 音频 URL
        timeout: 下载超时时间（秒）

    Returns:
        AudioInfo 对象
    """
    tmp_file = None
    try:
        # 下载音频
        tmp_file = _download_audio(url, timeout)
        if not tmp_file:
            return AudioInfo(url=url, duration=0, error="下载音频失败")

        # 获取时长
        duration = _get_audio_duration(tmp_file)
        if duration is None:
            return AudioInfo(url=url, duration=0, error="无法解析音频时长")

        return AudioInfo(url=url, duration=duration)
    except Exception as e:
        return AudioInfo(url=url, duration=0, error=str(e))
    finally:
        # 清理临时文件
        if tmp_file and os.path.exists(tmp_file):
            try:
                os.unlink(tmp_file)
            except Exception:
                pass


def generate_timelines_by_audio(
    audio_urls: List[str],
    timeout: int = 30,
    keep_temp_files: bool = False
) -> Dict[str, Any]:
    """
    根据音频 URL 列表自动分析时长并生成时间线

    Args:
        audio_urls: 音频文件 URL 列表
        timeout: 单个音频下载超时时间（秒），默认 30
        keep_temp_files: 是否保留临时文件（调试用），默认 False

    Returns:
        包含时间线信息的字典:
        - code: 状态码（0=成功，-1=失败）
        - message: 响应消息
        - target: 响应数据
            - all_timelines: 总时间线数组
            - timelines: 分段时间线数组
        - audio_infos: 音频信息列表（包含每个音频的时长和错误信息）

    Example:
        >>> result = generate_timelines_by_audio([
        ...     "https://example.com/audio1.mp3",
        ...     "https://example.com/audio2.mp3"
        ... ])
        >>> print(result['target']['timelines'])
    """
    if not audio_urls:
        return {
            "code": -1,
            "message": "音频 URL 列表不能为空",
            "target": {
                "all_timelines": [],
                "timelines": []
            },
            "audio_infos": []
        }

    audio_infos: List[AudioInfo] = []
    timelines = []
    current_start = 0
    total_duration = 0
    errors = []

    for url in audio_urls:
        audio_info = _get_audio_duration_from_url(url, timeout)
        audio_infos.append(audio_info)

        if audio_info.error:
            errors.append(f"{url}: {audio_info.error}")
            continue

        timelines.append({
            "start": current_start,
            "duration": audio_info.duration
        })
        current_start += audio_info.duration
        total_duration += audio_info.duration

    # 如果所有音频都解析失败
    if not timelines:
        return {
            "code": -1,
            "message": "所有音频解析失败: " + "; ".join(errors),
            "target": {
                "all_timelines": [],
                "timelines": []
            },
            "audio_infos": [
                {
                    "url": info.url,
                    "duration": info.duration,
                    "error": info.error
                } for info in audio_infos
            ]
        }

    # 如果部分失败
    message = "成功"
    if errors:
        message = f"部分音频解析失败: {len(errors)}/{len(audio_urls)}"

    return {
        "code": 0,
        "message": message,
        "target": {
            "all_timelines": [{
                "start": 0,
                "duration": total_duration
            }],
            "timelines": timelines
        },
        "audio_infos": [
            {
                "url": info.url,
                "duration": info.duration,
                "error": info.error
            } for info in audio_infos
        ]
    }


def get_audio_duration_batch(
    audio_urls: List[str],
    timeout: int = 30
) -> List[AudioInfo]:
    """
    批量获取音频时长（不生成时间线）

    Args:
        audio_urls: 音频 URL 列表
        timeout: 下载超时时间（秒）

    Returns:
        AudioInfo 列表
    """
    return [_get_audio_duration_from_url(url, timeout) for url in audio_urls]


def format_audio_timelines_output(result: Dict[str, Any]) -> str:
    """
    格式化音频时间线输出为可读字符串

    Args:
        result: generate_timelines_by_audio 返回的结果

    Returns:
        格式化后的字符串
    """
    if result["code"] != 0:
        return f"错误: {result['message']}"

    timelines = result["target"]["timelines"]
    total = result["target"]["all_timelines"][0]
    audio_infos = result.get("audio_infos", [])

    lines = [f"总时长: {total['duration'] / 1_000_000:.2f} 秒"]
    lines.append(f"音频数量: {len(audio_infos)}")
    lines.append("分段详情:")

    for i, segment in enumerate(timelines, 1):
        start_sec = segment['start'] / 1_000_000
        duration_sec = segment['duration'] / 1_000_000
        audio_url = audio_infos[i - 1]['url'] if i <= len(audio_infos) else "未知"
        lines.append(f"  分段 {i}: 开始 {start_sec:.2f}s, 时长 {duration_sec:.2f}s")
        lines.append(f"       URL: {audio_url}")

    # 显示错误信息
    errors = [info for info in audio_infos if info.get('error')]
    if errors:
        lines.append("\n错误信息:")
        for info in errors:
            lines.append(f"  {info['url']}: {info['error']}")

    return "\n".join(lines)


if __name__ == "__main__":
    # 测试示例
    test_urls = [
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
    ]

    print("正在分析音频...")
    result = generate_timelines_by_audio(test_urls, timeout=60)
    print(format_audio_timelines_output(result))