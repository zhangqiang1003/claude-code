from runtime import Args
from typings.local_text_export.local_text_export import Input, Output

import binascii
import uuid
import oss2
from aliyunsdkcore.auth.credentials import AccessKeyCredential
from aliyunsdkcore.client import AcsClient

from io import BytesIO

import dashscope
from typing import List
from http import HTTPStatus

from datetime import datetime

import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
import uuid
import json
import requests
import math

# -------------------------- 阿里云OSS配置项（替换为你的信息） --------------------------
ALIYUN_ACCESS_KEY_ID = "<ALIYUN_ACCESS_KEY_ID>"
ALIYUN_ACCESS_KEY_SECRET = "<ALIYUN_ACCESS_KEY_SECRET>"
ALIYUN_OSS_BUCKET_NAME = "tts-plugins"
ALIYUN_OSS_ENDPOINT = "oss-cn-beijing.aliyuncs.com"
ALIYUN_INTERNAL_OSS_ENDPOINT = "oss-cn-beijing-internal.aliyuncs.com"
AUDIO_FORMAT = "mp3"  # 根据语音合成接口返回的格式调整（如wav、aac）
OSS_OBJECT_PREFIX = "tts/"  # OSS中存储音频的目录前缀（便于分类管理）

# 核心配置：50MB的字节数、分块大小（1MB/块，平衡内存占用和速度）
MAX_NUMBER = 512
MAX_FILE_SIZE = MAX_NUMBER * 1024 * 1024  # 52428800 字节
FREE_MAX_NUMBER = 50
FREE_MAX_FILE_SIZE = FREE_MAX_NUMBER * 1024 * 1024  # 10M(免费限制10M)
CHUNK_SIZE = 1024 * 1024  # 1MB/块
FREE_API_TOKEN = "dm-25a160ee641e420f8424783a493f39e610"

# ========================
# 各平台请求头配置
# ========================

def douyin_headers(cookie=None):
    """抖音请求头"""
    _ = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "accept-language": "zh-CN,zh;q=0.9",
        "origin": "https://www.douyin.com",
        "referer": "https://www.douyin.com/user/self"
    }

    if bool(cookie) and len(cookie) > 200:
        _["Cookie"] = cookie

    return _


def kuaishou_headers(cookie=None):
    """快手请求头"""
    _ = {
        "Content-Type": "application/json;charset=UTF-8",
        "Accept": "application/json, text/plain, */*",
        "accept-language": "zh-CN,zh;q=0.9",
        "origin": "https://www.kuaishou.com",
        "referer": "https://www.kuaishou.com",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    }

    if bool(cookie) and len(cookie) > 50:
        _["Cookie"] = cookie

    return _


def xiaohongshu_headers(cookie=None):
    """小红书请求头"""
    _ = {
        "accept": "*/*",
        # "accept-language": "zh-CN,zh;q=0.9",
        # "cache-control": "no-cache",
        # "content-type": "application/json;charset=UTF-8",
        # "origin": "https://www.xiaohongshu.com",
        # "pragma": "no-cache",
        "priority": "u=1, i",
        "range": "bytes=0-",
        "referer": "https://www.xiaohongshu.com/",
        "sec-ch-ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "video",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-site": "same-site",
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
    }

    if bool(cookie) and len(cookie) > 50:
        _["Cookie"] = cookie

    return _


def bilibili_headers(cookie=None):
    """B站请求头"""
    _ = {
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Origin": "https://www.bilibili.com",
        "Referer": "https://www.bilibili.com",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    }

    if bool(cookie) and len(cookie) > 50:
        _["Cookie"] = cookie

    return _


def weibo_headers(cookie=None):
    """微博请求头"""
    _ = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Origin": "https://weibo.com",
        "Referer": "https://weibo.com",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    }

    if bool(cookie) and len(cookie) > 50:
        _["Cookie"] = cookie

    return _


def get_platform_headers(audio_url: str, cookie: str = None) -> dict:
    """
    根据URL自动识别平台并返回对应请求头

    Args:
        audio_url: 音视频URL
        cookie: 可选的cookie

    Returns:
        dict: 对应平台的请求头
    """
    # 抖音相关域名
    douyin_domains = ["douyinvod", "douyin", "aweme", "byteimg"]
    # 快手相关域名
    kuaishou_domains = ["kuaishou", "ks", "gifshow", "kwaicdn"]
    # 小红书相关域名
    xhs_domains = ["xiaohongshu", "xhscdn", "xhs"]
    # B站相关域名
    bili_domains = ["bilibili", "bili", "acgvideo"]
    # 微博相关域名
    weibo_domains = ["weibo", "sina"]

    # 默认请求头
    default_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
    }

    url_lower = audio_url.lower()

    # 识别平台
    if any(domain in url_lower for domain in douyin_domains) or "douyin" in url_lower:
        return douyin_headers(cookie)
    elif any(domain in url_lower for domain in kuaishou_domains) or "kuaishou" in url_lower:
        return kuaishou_headers(cookie)
    elif any(domain in url_lower for domain in xhs_domains) or "xiaohongshu" in url_lower:
        return xiaohongshu_headers(cookie)
    elif any(domain in url_lower for domain in bili_domains) or "bilibili" in url_lower:
        return bilibili_headers(cookie)
    elif any(domain in url_lower for domain in weibo_domains):
        return weibo_headers(cookie)
    else:
        return default_headers


def detect_platform(audio_url: str) -> str:
    """
    检测URL所属平台

    Args:
        audio_url: 音视频URL

    Returns:
        str: 平台名称 (douyin/kuaishou/xiaohongshu/bilibili/weibo/unknown)
    """
    url_lower = audio_url.lower()

    if "douyinvod" in url_lower or "douyin" in url_lower:
        return "douyin"
    elif "kuaishou" in url_lower or "gifshow" in url_lower:
        return "kuaishou"
    elif "xiaohongshu" in url_lower or "xhs" in url_lower or "xhscdn" in url_lower:
        return "xiaohongshu"
    elif "bilibili" in url_lower or "bili" in url_lower:
        return "bilibili"
    elif "weibo" in url_lower or "sina" in url_lower:
        return "weibo"
    else:
        return "unknown"


token_util = None


def handler(args: Args[Input]) -> Output:
    api_token = args.input.api_token  # 暂时不用
    audio_url = args.input.audio_url  # 音视频地址
    cookie = getattr(args.input, "cookie", "")  # 可选cookie参数

    if not bool(api_token):
        api_token = FREE_API_TOKEN

    if not api_token.startswith("dm-"):
        return {
            "code": 500,
            "msg": "参数错误，该api_token不支持当前操作，请联系管理员（esir1158）",
            "data": {}
        }

    token_util = TokenUtil(api_token)

    status, token_info = token_util.get_token_info()
    if status == 1:
        return {
            "code": 400,
            "msg": "本地音视频文案提取失败,原因是：积分已用完，请联系管理员（esir1158）",
            "data": {},
            "extend_info": json.dumps(token_info),
        }

    # 检测平台并获取对应请求头
    platform = detect_platform(audio_url)
    headers = get_platform_headers(audio_url, cookie)

    print(f"检测到平台: {platform}")
    print(f"使用请求头: {list(headers.keys())}")

    # 根据平台下载音视频
    result = download_media_to_bytes(audio_url, api_token, headers=headers)

    if result["type"] == "text":
        return {
            "code": 500,
            "msg": result["content"],
            "data": {},
            "extend_info": json.dumps(token_info) + "<1>",
        }

    upload_status, internal_audio_url = hex_to_audio_url(result["content"])
    if upload_status == 1:
        return {
            "code": 500,
            "msg": "本地音视频文案提取失败 " + internal_audio_url,
            "data": {},
            # "extend_info": json.dumps(token_info) + "<2>",
            "extend_info": "<2>",
        }

    api_key = "sk-0b104fd68d1c4619afbeb881270d3eac"
    translate_status, translate_info = transcribe_audio_from_oss_internal(api_key=api_key, file_url=internal_audio_url)
    if translate_status == 1:
        if "tts-plugins.oss-cn-beijing-internal" in translate_info:
            translate_info = translate_info.replace("tts-plugins.oss-cn-beijing-internal",
                                                    "tts.oss-cn-beijing-internal")
        return {
            "code": 500,
            "msg": "本地音视频文案提取失败 " + translate_info,
            "data": {},
            "extend_info": json.dumps(token_info)
        }

    properties = translate_info["properties"]
    original_duration_in_milliseconds = properties["original_duration_in_milliseconds"]

    transcripts = translate_info["transcripts"]
    transcript = transcripts[0]
    text = transcript["text"]
    sentences = transcript["sentences"]

    data = {
        "duration": original_duration_in_milliseconds,
        "text": text,
        "sentences": json.dumps(sentences, ensure_ascii=False)
    }

    extend_info = {}
    extend_info["api_token"] = token_info["apiToken"]
    extend_info["createTime"] = token_info["createTime"]
    extend_info["expireTime"] = token_info["expireTime"]
    extend_info["totalPoints"] = token_info["totalPoints"]

    try:
        points = math.ceil(original_duration_in_milliseconds / 1000 / 60)
        token_util.record_log_token(token_info["id"], points)

        extend_info["unusedPoints"] = token_info["unusedPoints"] - points
        extend_info["usedPoints"] = token_info["usedPoints"] + points
        extend_info["currUsedPoints"] = points
        extend_info["hasUsed"] = not (data["unusedPoints"] > 0)
    except Exception as e:
        pass

    return {
        "code": 0,
        "msg": "成功",
        "data": data,
        "extend_info": json.dumps(extend_info)
    }


# 录音文件识别
def transcribe_audio_from_oss_internal(
        api_key: str,
        file_url: str,
        model: str = "fun-asr", #"paraformer-v2",
        language_hints=['zh', 'en']
) -> tuple:
    """
    使用 DashScope SDK 调用录音文件识别服务（北京地域，OSS内网）

    Args:
        api_key (str): DashScope API Key
        file_url: 文件地址
        model (str): 语音识别模型，默认 paraformer-v1
        language_hints: 指定待识别语音的语言代码。

    Returns:
        tuple: 识别结果
    """
    # 构造OSS内网URL（北京地域）
    file_urls = [file_url]

    # 设置API Key
    dashscope.api_key = api_key

    # 提交异步转写任务
    task_response = dashscope.audio.asr.Transcription.async_call(
        model=model,
        file_urls=file_urls,
        language_hints=language_hints
    )

    if task_response.status_code != 200:
        # raise RuntimeError(f"Task submission failed: {task_response}")
        return 1, f"Task submission failed: {task_response}"

    # 等待并获取结果
    result_response = dashscope.audio.asr.Transcription.wait(
        task=task_response.output.task_id
    )

    if result_response.status_code != 200:
        # raise RuntimeError(f"Transcription failed: {result_response}")
        return 1, f"Transcription failed: {task_response}"

    # return 0, result_response.output

    if result_response.status_code == HTTPStatus.OK:
        for transcription in result_response.output['results']:
            if transcription['subtask_status'] == 'SUCCEEDED':
                url = transcription['transcription_url']
                response = requests.get(url)
                result = response.json()
                return 0, result
            else:
                # print('transcription failed!')
                # print(transcription)
                return 1, f"Transcription failed: {transcription}"
    else:
        # print('Error: ', result_response.output.message)
        return 1, f"Transcription failed: {result_response.output.message}"


# 下载媒体文件为二进制字节流
def download_media_to_bytes(media_url: str, api_token: str | None, headers: dict = dict()) -> dict:
    """
    从音视频URL下载文件为二进制字节流，限制文件大小≤50MB
    :param media_url: 音视频文件的公网可访问URL（必填）
    :param api_token: 密钥
    :param headers: 下载请求的自定义请求头（可选，如User-Agent、Referer等）
    :return: Coze插件标准响应字典（成功返回bytes流，失败返回错误信息）
    """
    # 初始化默认请求头（适配部分需要UA验证的URL）
    default_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    if headers:
        default_headers.update(headers)

    # 步骤1：HEAD请求预检查文件大小（优先策略）
    file_size = None
    try:
        head_resp = requests.head(
            media_url,
            headers=default_headers,
            allow_redirects=True,  # 跟随重定向，避免获取不到真实文件大小
            timeout=10
        )
        head_resp.raise_for_status()
        if "Content-Length" in head_resp.headers:
            file_size = int(head_resp.headers["Content-Length"])

            if api_token == FREE_API_TOKEN and file_size > FREE_MAX_FILE_SIZE:
                return {
                    "type": "text",
                    "content": f"免费版文件大小超限：{file_size / 1024 / 1024:.2f}MB（最大允许{FREE_MAX_NUMBER}MB），终止下载"
                }

            if file_size > MAX_FILE_SIZE:
                return {
                    "type": "text",
                    "content": f"文件大小超限：{file_size / 1024 / 1024:.2f}MB（最大允许{MAX_NUMBER}MB），终止下载"
                }
    except Exception as e:
        # HEAD请求失败（如服务器禁止HEAD），不终止，后续下载时实时校验
        print(f"HEAD请求获取文件大小失败：{str(e)}，将在下载时实时校验")

    # 步骤2：流式下载到内存缓冲区（BytesIO），实时校验大小
    byte_buffer = BytesIO()
    downloaded_size = 0

    try:
        with requests.get(
                media_url,
                headers=default_headers,
                stream=True,  # 流式下载，不一次性加载到内存
                timeout=60  # 下载超时设为60秒，适配大文件
        ) as download_resp:
            download_resp.raise_for_status()  # 捕获4xx/5xx HTTP错误

            # 分块读取并写入内存缓冲区
            for chunk in download_resp.iter_content(chunk_size=CHUNK_SIZE):
                if not chunk:
                    continue  # 过滤空块

                # 累计已下载大小，判断是否超限
                downloaded_size += len(chunk)

                if api_token == FREE_API_TOKEN and downloaded_size > FREE_MAX_FILE_SIZE:
                    return {
                        "type": "text",
                        "content": f"免费版文件大小超限：{downloaded_size / 1024 / 1024:.2f}MB（最大允许{FREE_MAX_NUMBER}MB），终止下载"
                    }

                if downloaded_size > MAX_FILE_SIZE:
                    byte_buffer.close()  # 清空缓冲区
                    return {
                        "type": "text",
                        "content": f"下载过程中检测到文件大小超限（已下载{downloaded_size / 1024 / 1024:.2f}MB），终止下载"
                    }

                # 将分块写入内存缓冲区
                byte_buffer.write(chunk)

        # 步骤3：下载完成，返回二进制字节流（重置缓冲区指针到开头）
        byte_buffer.seek(0)
        media_bytes = byte_buffer.getvalue()

        if api_token == FREE_API_TOKEN and len(media_bytes) > FREE_MAX_FILE_SIZE:
            return {
                "type": "text",
                "content": f"免费版文件大小超限：{len(media_bytes) / 1024 / 1024:.2f}MB（最大允许{FREE_MAX_NUMBER}MB），终止下载"
            }

        # 二次校验（防止HEAD和实际下载大小不一致）
        if len(media_bytes) > MAX_FILE_SIZE:
            return {
                "type": "text",
                "content": f"下载完成后校验大小超限：{len(media_bytes) / 1024 / 1024:.2f}MB，终止返回"
            }

        # 成功响应：返回二进制字节流（Coze插件中可直接传递给后续逻辑）
        return {
            "type": "byte",  # 自定义类型，标识返回的是字节流
            "content": media_bytes,
            "meta": {
                "file_size_mb": round(len(media_bytes) / 1024 / 1024, 2),
                "media_url": media_url
            }
        }

    except requests.exceptions.HTTPError as e:
        return {
            "type": "text",
            "content": f"HTTP请求错误：{str(e)}（状态码：{download_resp.status_code}）"
        }
    except requests.exceptions.ConnectionError:
        return {
            "type": "text",
            "content": "网络连接错误：无法访问该音视频URL，请检查URL有效性或网络"
        }
    except requests.exceptions.Timeout:
        return {
            "type": "text",
            "content": "下载超时：60秒内未完成下载，请检查URL是否可访问或重试"
        }
    except Exception as e:
        return {
            "type": "text",
            "content": f"下载失败：{str(e)}"
        }
    finally:
        # 确保缓冲区关闭，释放内存
        byte_buffer.close()


"""
上传值oss
"""


def hex_to_audio_url(byte_audio_data) -> tuple:
    """
    核心函数：将hex格式音频数据转换为阿里云OSS可访问URL
    :param hex_audio_data: 语音合成接口返回的hex字符串（含空格/换行也可）
    :return: 公网可访问的音频URL / 异常信息
    """
    try:
        audio_bytes = byte_audio_data

        # 步骤2：生成唯一文件名（避免覆盖，格式：目录前缀 + UUID + 后缀）
        file_name = f"{OSS_OBJECT_PREFIX}audio_{uuid.uuid4()}.{AUDIO_FORMAT}"

        # 步骤3：初始化阿里云OSS客户端
        # 方式1：使用AccessKey直接初始化（适合插件环境，无复杂权限）
        auth = oss2.Auth(ALIYUN_ACCESS_KEY_ID, ALIYUN_ACCESS_KEY_SECRET)
        bucket = oss2.Bucket(auth, ALIYUN_OSS_ENDPOINT, ALIYUN_OSS_BUCKET_NAME)

        # 步骤4：上传二进制音频数据到OSS（无需本地文件）
        # 可选：设置文件HTTP头，支持浏览器直接播放（关键！否则可能触发下载而非播放）
        headers = {
            "Content-Type": f"audio/{AUDIO_FORMAT.lower()}",  # 音频MIME类型
            "Cache-Control": "max-age=86400"  # 浏览器缓存1天，减少OSS访问压力
        }
        result = bucket.put_object(file_name, audio_bytes, headers=headers)

        # 验证上传结果（HTTP状态码200表示成功）
        if result.status != 200:
            # raise Exception(f"OSS上传失败，状态码：{result.status}")
            return 1, f"OSS上传失败，状态码：{result.status}"

        # 步骤5：生成公网可访问的URL
        # 方式1：公共读Bucket直接拼接URL（推荐，简单高效）- 内网地址
        audio_url = f"https://{ALIYUN_OSS_BUCKET_NAME}.{ALIYUN_INTERNAL_OSS_ENDPOINT}/{file_name}"

        # 方式2：如果Bucket是私有读（需临时URL，有效期3600秒）
        # audio_url = bucket.sign_url('GET', file_name, 3600)

        return 0, audio_url

    except binascii.Error as e:
        return 1, f"解码失败：{str(e)}"
    except oss2.exceptions.OssError as e:
        return 1, f"上传操作失败：{e.message}（错误码：{e.code}）"
    except Exception as e:
        return 1, f"音频URL生成失败：{str(e)}"


class TokenUtil:
    def __init__(self, api_token):
        self.api_token = api_token

    def get_token_info(self):
        session = requests.Session()

        req = requests.Request(
            method='GET',  # 推测获取列表应该用 POST 请求，因为有请求体
            url='https://test.dmaodata.cn/app-api/token/record/getTokenInfo?apiToken=' + self.api_token,
            headers={'Content-Type': 'application/json', 'tenant-id': "1"}
        )

        prepped = req.prepare()

        try:
            response = session.send(prepped)
            response.raise_for_status()
            response_data = response.json()

            target = response_data["data"]

            # 转换为秒（浮点数，保留毫秒小数部分）
            dt = datetime.fromtimestamp(target["createTime"] / 1000)
            target["createTime"] = dt.strftime("%Y-%m-%d %H:%M:%S")
            dt1 = datetime.fromtimestamp(target["expireTime"] / 1000)
            target["expireTime"] = dt1.strftime("%Y-%m-%d %H:%M:%S")

            totalPoints = target["totalPoints"] or 0
            usedPoints = target["usedPoints"] or 0

            target["unusedPoints"] = totalPoints - usedPoints if totalPoints - usedPoints >= 0 else 0

            if response_data["code"] != 0:
                return 1, target

            return 0, target
        except requests.exceptions.RequestException as e:
            # 记录错误日志
            return 1, str(e)

    def record_log_params(self, params: dict):
        """
            params:
                tokenId: token主键ID
                apiToken:
                usedPoints: 本次消耗的积分数
                val: 默认值：DMAO10012026UPDATETOKEN
        """
        random_uuid = uuid.uuid4()

        content = params
        content["apiToken"] = self.api_token
        content["val"] = "DMAO10012026UPDATETOKEN"

        _uuid = str(random_uuid).replace("-", "")
        iv = _uuid[8:24]

        aes = AES_CBC(iv)

        _token = aes.encrypt(json.dumps(content))
        _key = _uuid
        return _key, _token

    def record_log_token(self, token_id, used_points):
        """
            token_id: token主键ID
            used_points: 本次消耗的积分数
        """
        params = {
            "tokenId": token_id,
            "usedPoints": used_points
        }

        _key, _token = self.record_log_params(params)

        session = requests.Session()

        req = requests.Request(
            method='POST',  # 推测获取列表应该用 POST 请求，因为有请求体
            url='https://test.dmaodata.cn/app-api/token/record/recordLogToken',
            json={
                "data": _token,
                "key": _key
            },
            headers={'Content-Type': 'application/json', 'tenant-id': "1"}
        )

        prepped = req.prepare()

        try:
            response = session.send(prepped)
            response.raise_for_status()  # 检查响应状态码
            response_data = response.json()

            target = response_data["data"]

            if response_data["code"] != 0:
                return 1, target["msg"]

            return 0, target
        except requests.exceptions.RequestException as e:
            # 记录错误日志
            return 1, str(e)


class AES_CBC:
    def __init__(self, iv):
        key = "f5&8$f5b#527&eda"
        self.key = key.encode('utf-8')  # 必须是 bytes
        self.iv = iv.encode('utf-8')  # 必须是 bytes
        self.block_size = 16  # AES block size is 16 bytes

    def encrypt(self, plaintext):
        cipher = AES.new(self.key, AES.MODE_CBC, self.iv)
        # 对明文进行 PKCS7 填充（Java 的 PKCS5Padding 等同于 PKCS7）
        padded_data = pad(plaintext.encode('utf-8'), self.block_size)
        encrypted = cipher.encrypt(padded_data)
        return base64.b64encode(encrypted).decode('utf-8')

    def decrypt(self, ciphertext):
        cipher = AES.new(self.key, AES.MODE_CBC, self.iv)
        decoded = base64.b64decode(ciphertext)
        decrypted_padded = cipher.decrypt(decoded)
        # 去除填充
        try:
            decrypted = unpad(decrypted_padded, self.block_size)
        except ValueError as e:
            raise ValueError("Padding error during decryption. Possible key/iv mismatch.") from e
        return decrypted.decode('utf-8')

        
