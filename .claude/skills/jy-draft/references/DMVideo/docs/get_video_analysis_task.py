# from runtime import Args
# from typings.get_video_analysis_task.get_video_analysis_task import Input, Output

import base64
import hashlib
import hmac
import json
import math
import os
import uuid
from collections import OrderedDict
from datetime import datetime
from typing import Any, Dict, List, Optional, Union, Tuple
from urllib.parse import quote_plus, urlencode

import pytz
import requests
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

# API配置常量
ENDPOINT = "quanmiaolightapp.cn-beijing.aliyuncs.com"
WORKSPACE_ID = "llm-duqfbld2tm8dlsuy"
REQUEST_BASE_URL = f"/{WORKSPACE_ID}/quanmiao/lightapp/videoAnalysis/getVideoAnalysisTask"
APP_ID = "2d8bf0d0605d4d26a95bb988481514cb"
AGENT_KEY = "43865782df2748e6a62ebfbab99fc77e_p_efm"
ALIYUN_ACCESS_KEY_ID = "<ALIYUN_ACCESS_KEY_ID>"
ALIYUN_ACCESS_KEY_SECRET = "<ALIYUN_ACCESS_KEY_SECRET>"


class SignatureRequest:
    """签名请求对象"""

    def __init__(
            self,
            http_method: str,
            canonical_uri: str,
            host: str,
            x_acs_action: str,
            x_acs_version: str
    ):
        self.http_method = http_method
        self.canonical_uri = canonical_uri
        self.host = host
        self.x_acs_action = x_acs_action
        self.x_acs_version = x_acs_version
        self.headers = self._init_headers()
        self.query_param = OrderedDict()  # type: Dict[str, Any]
        self.body = None  # type: Optional[bytes]

    def _init_headers(self) -> Dict[str, str]:
        current_time = datetime.now(pytz.timezone('Etc/GMT'))
        headers = OrderedDict([
            ('host', self.host),
            ('x-acs-action', self.x_acs_action),
            ('x-acs-version', self.x_acs_version),
            ('x-acs-date', current_time.strftime('%Y-%m-%dT%H:%M:%SZ')),
            ('x-acs-signature-nonce', str(uuid.uuid4())),
        ])
        return headers

    def sorted_query_params(self) -> None:
        """对查询参数按名称排序并返回编码后的字符串"""
        self.query_param = dict(sorted(self.query_param.items()))

    def sorted_headers(self) -> None:
        """对请求头按名称排序并返回编码后的字符串"""
        self.headers = dict(sorted(self.headers.items()))


class SignatureUtils:
    """签名工具类 - 提供加密、编码等工具方法"""

    @staticmethod
    def process_object(result_map: Dict[str, str], key: str, value: Any) -> None:
        """递归处理对象，将嵌套结构转换为扁平化的键值对"""
        if value is None:
            return

        if isinstance(value, (list, tuple)):
            for i, item in enumerate(value):
                SignatureUtils.process_object(result_map, f"{key}.{i + 1}", item)
        elif isinstance(value, dict):
            for sub_key, sub_value in value.items():
                SignatureUtils.process_object(result_map, f"{key}.{sub_key}", sub_value)
        else:
            key = key.lstrip(".")
            result_map[key] = value.decode("utf-8") if isinstance(value, bytes) else str(value)

    @staticmethod
    def hmac256(key: bytes, msg: str) -> bytes:
        """计算HMAC-SHA256签名"""
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    @staticmethod
    def sha256_hex(s: bytes) -> str:
        """计算SHA256哈希值并返回十六进制字符串"""
        return hashlib.sha256(s).hexdigest()

    @staticmethod
    def percent_code(encoded_str: str) -> str:
        """对URL编码字符串进行特殊字符替换"""
        return encoded_str.replace("+", "%20").replace("*", "%2A").replace("%7E", "~")


class AuthorizationGenerator:
    """授权生成器 - 负责生成阿里云API签名和授权头"""

    def __init__(self, access_key_id: str, access_key_secret: str):
        self.access_key_id = access_key_id
        self.access_key_secret = access_key_secret

    def generate(self, request: SignatureRequest, security_token: Optional[str] = None) -> None:
        """为请求生成授权信息"""
        try:
            new_query_param = OrderedDict()
            SignatureUtils.process_object(new_query_param, '', request.query_param)
            request.query_param.clear()
            request.query_param.update(new_query_param)
            request.sorted_query_params()

            # 步骤 1：拼接规范请求串
            canonical_query_string = "&".join(
                f"{self._percent_code(quote_plus(k))}={self._percent_code(quote_plus(str(v)))}"
                for k, v in request.query_param.items()
            )
            hashed_request_payload = SignatureUtils.sha256_hex(request.body or b'')
            request.headers['x-acs-content-sha256'] = hashed_request_payload

            if security_token:
                request.headers["x-acs-security-token"] = security_token
            request.sorted_headers()

            filtered_headers = OrderedDict()
            for k, v in request.headers.items():
                if k.lower().startswith("x-acs-") or k.lower() in ["host", "content-type"]:
                    filtered_headers[k.lower()] = v

            canonical_headers = "\n".join(f"{k}:{v}" for k, v in filtered_headers.items()) + "\n"
            signed_headers = ";".join(filtered_headers.keys())

            canonical_request = (
                f"{request.http_method}\n{request.canonical_uri}\n{canonical_query_string}\n"
                f"{canonical_headers}\n{signed_headers}\n{hashed_request_payload}"
            )

            # 步骤 2：拼接待签名字符串
            hashed_canonical_request = SignatureUtils.sha256_hex(canonical_request.encode("utf-8"))
            string_to_sign = f"ACS3-HMAC-SHA256\n{hashed_canonical_request}"

            # 步骤 3：计算签名
            signature = SignatureUtils.hmac256(self.access_key_secret.encode("utf-8"), string_to_sign).hex().lower()

            # 步骤 4：拼接Authorization
            authorization = f'ACS3-HMAC-SHA256 Credential={self.access_key_id},SignedHeaders={signed_headers},Signature={signature}'
            request.headers["Authorization"] = authorization
        except Exception as e:
            print("Failed to get authorization")
            print(e)

    @staticmethod
    def _percent_code(encoded_str: str) -> str:
        """对URL编码字符串进行特殊字符替换"""
        return SignatureUtils.percent_code(encoded_str)


class TaskStatus:
    """任务状态常量"""
    PENDING = "PENDING"  # 待处理
    RUNNING = "RUNNING"  # 运行中
    SUCCESSED = "SUCCESSED"  # 成功
    FAILED = "FAILED"  # 失败
    CANCELLED = "CANCELLED"  # 已取消


class VideoAnalysisClient:
    """视频分析API客户端 - 封装视频分析任务相关操作"""

    # 默认配置
    DEFAULT_HOST = ENDPOINT  # quanmiaolightapp.cn-beijing.aliyuncs.com
    SUBMIT_ACTION = "SubmitVideoAnalysisTask"
    GET_ACTION = "GetVideoAnalysisTask"
    DEFAULT_VERSION = "2024-08-01"

    # 默认参数
    DEFAULT_VIDEO_MODEL_ID = "quanmiao-vl-max"
    DEFAULT_MODEL_ID = "quanmiao-llm-max"
    DEFAULT_GENERATE_OPTIONS = ["videoAnalysis"]
    DEFAULT_LANGUAGE = "chinese"
    DEFAULT_PROMPT_TEMPLATE = "请分析这个视频的内容：{videoAsrText}"

    def __init__(self, access_key_id: str, access_key_secret: str, security_token: Optional[str] = None,
                 workspace_id: Optional[str] = None):
        """
        初始化客户端

        Args:
            access_key_id: 阿里云AccessKey ID
            access_key_secret: 阿里云AccessKey Secret
            security_token: 安全令牌（可选）
            workspace_id: 工作空间ID（可选，如果不传则需要在调用方法时指定）
        """
        self.auth_generator = AuthorizationGenerator(access_key_id, access_key_secret)
        self.security_token = security_token
        self.workspace_id = workspace_id

    def submit_video_analysis_task(
            self,
            workspace_id: Optional[str] = None,
            video_url: str = "",
            video_model_id: Optional[str] = None,
            video_model_custom_prompt_template: Optional[str] = None,
            model_id: Optional[str] = None,
            generate_options: Optional[List[str]] = None,
            video_extra_info: Optional[str] = None,
            language: Optional[str] = None,
            **kwargs
    ) -> Dict[str, Any]:
        """
        提交视频分析任务（视频理解离线异步任务）

        Args:
            workspace_id: 阿里云百炼业务空间唯一标识
            video_url: 待分析的视频地址
            video_model_id: 视频 VL 任务模型唯一标识
            video_model_custom_prompt_template: 视频 VL 任务 prompt 模版
            model_id: 视频总结（文本加工）依赖的大模型唯一标识
            generate_options: 生成选项列表
            video_extra_info: 和视频相关的补充文字资料
            language: 语言设置
            **kwargs: 其他扩展参数

        Returns:
            API响应结果字典
        """
        workspace_id = workspace_id or self.workspace_id
        if not workspace_id:
            raise ValueError("workspace_id must be provided")

        # 构建请求
        http_method = "POST"
        host = self.DEFAULT_HOST
        canonical_uri = f"/{workspace_id}/quanmiao/lightapp/videoAnalysis/submitVideoAnalysisTask"

        # 创建请求对象
        request = SignatureRequest(http_method, canonical_uri, host, self.SUBMIT_ACTION, self.DEFAULT_VERSION)

        # 构建请求体，使用默认值
        body_data = {
            "videoUrl": video_url,
            "videoModelId": video_model_id or self.DEFAULT_VIDEO_MODEL_ID,
            "videoModelCustomPromptTemplate": video_model_custom_prompt_template or self.DEFAULT_PROMPT_TEMPLATE,
            "modelId": model_id or self.DEFAULT_MODEL_ID,
            "generateOptions": generate_options or self.DEFAULT_GENERATE_OPTIONS,
            "language": language or self.DEFAULT_LANGUAGE,
            **kwargs
        }

        # 只有当有值时才添加 videoExtraInfo
        if video_extra_info is not None:
            body_data["videoExtraInfo"] = video_extra_info

        # 设置请求体
        request.body = json.dumps(body_data, separators=(',', ':')).encode('utf-8')
        request.headers["content-type"] = "application/json"

        # 生成签名
        self.auth_generator.generate(request, self.security_token)

        # 发送请求
        url = f"https://{host}{canonical_uri}"
        response = requests.request(
            method=request.http_method,
            url=url,
            headers=request.headers,
            data=request.body
        )

        # 解析响应
        response_data = response.json()

        # 提取关键信息
        result = {
            "success": response_data.get("success", False),
            "request_id": response_data.get("requestId"),
            "task_id": response_data.get("data", {}).get("taskId") if response_data.get("data") else None,
            "message": response_data.get("message", ""),
            "code": response_data.get("code", "")
        }

        return result

    def get_video_analysis_task(
            self,
            workspace_id: Optional[str] = None,
            task_id: str = ""
    ) -> Dict[str, Any]:
        """
        获取视频分析任务结果

        Args:
            workspace_id: 阿里云百炼业务空间唯一标识
            task_id: 任务ID

        Returns:
            API响应结果字典，包含:
                - success: 是否成功
                - request_id: 请求ID
                - task_id: 任务ID
                - task_status: 任务状态 (PENDING/RUNNING/SUCCESSED/FAILED/CANCELLED)
                - message: 响应消息
                - code: 响应码
                - data: 完整的任务数据（如果成功）
        """
        workspace_id = workspace_id or self.workspace_id
        if not workspace_id:
            raise ValueError("workspace_id must be provided")
        if not task_id:
            raise ValueError("task_id must be provided")

        # 构建请求 - GET请求，host是动态的
        http_method = "GET"
        host = self.DEFAULT_HOST
        canonical_uri = f"/{workspace_id}/quanmiao/lightapp/videoAnalysis/getVideoAnalysisTask"

        # 创建请求对象
        request = SignatureRequest(http_method, canonical_uri, host, self.GET_ACTION, self.DEFAULT_VERSION)

        # 添加查询参数
        request.query_param['taskId'] = task_id

        # 生成签名
        self.auth_generator.generate(request, self.security_token)

        # 构建URL
        url = f"https://{host}{canonical_uri}"
        if request.query_param:
            query_parts = []
            for k, v in request.query_param.items():
                query_parts.append(
                    f"{SignatureUtils.percent_code(quote_plus(k))}={SignatureUtils.percent_code(quote_plus(str(v)))}")
            url += "?" + "&".join(query_parts)

        # 发送请求
        response = requests.request(
            method=request.http_method,
            url=url,
            headers=request.headers,
            data=request.body
        )

        # 解析响应
        response_data = response.json()

        # 提取关键信息
        result = {
            "success": response_data.get("success", False),
            "request_id": response_data.get("requestId"),
            "task_id": response_data.get("data", {}).get("taskId") if response_data.get("data") else None,
            "task_status": response_data.get("data", {}).get("taskStatus") if response_data.get("data") else None,
            "message": response_data.get("message", ""),
            "code": response_data.get("code", ""),
            "data": response_data.get("data")
        }

        return result

    def wait_for_task_completion(
            self,
            workspace_id: Optional[str] = None,
            task_id: str = "",
            timeout: int = 300,
            interval: int = 5
    ) -> Dict[str, Any]:
        """
        等待任务完成并返回结果

        Args:
            workspace_id: 阿里云百炼业务空间唯一标识
            task_id: 任务ID
            timeout: 超时时间（秒），默认300秒
            interval: 轮询间隔（秒），默认5秒

        Returns:
            任务最终结果
        """
        import time

        start_time = time.time()

        while time.time() - start_time < timeout:
            result = self.get_video_analysis_task(workspace_id, task_id)

            if result["task_status"] in [TaskStatus.SUCCESSED, TaskStatus.FAILED, TaskStatus.CANCELLED]:
                return result

            print(f"任务状态: {result['task_status']}, 等待中...")
            time.sleep(interval)

        raise TimeoutError(f"任务等待超时（{timeout}秒）")

    def parse_task_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        解析任务结果，提取关键信息

        Args:
            result: get_video_analysis_task 返回的结果

        Returns:
            解析后的结果字典
        """
        if not result.get("success") or result.get("task_status") != TaskStatus.SUCCESSED:
            return {
                "success": False,
                "error": result.get("message", "Task not completed successfully")
            }

        data = result.get("data", {})
        payload = data.get("payload", {})
        output = payload.get("output", {})

        parsed = {
            "success": True,
            "task_id": data.get("taskId"),
            "task_status": data.get("taskStatus"),
        }

        # 解析视频分析结果
        if "videoAnalysisResult" in output and output["videoAnalysisResult"].get("generateFinished"):
            parsed["video_analysis"] = output["videoAnalysisResult"].get("text", "")

        # 解析视频字幕
        if "videoCaptionResult" in output and output["videoCaptionResult"].get("generateFinished"):
            parsed["video_captions"] = output["videoCaptionResult"].get("videoCaptions", [])

        # 解析标题生成结果
        if "videoTitleGenerateResult" in output and output["videoTitleGenerateResult"].get("generateFinished"):
            parsed["video_title"] = output["videoTitleGenerateResult"].get("text", "")

        # 解析思维导图结果
        if "videoMindMappingGenerateResult" in output and output["videoMindMappingGenerateResult"].get(
                "generateFinished"):
            parsed["mind_mapping"] = output["videoMindMappingGenerateResult"].get("text", "")

        return parsed


# 便捷函数
def get_video_analysis_task(
        workspace_id: str,
        task_id: str,
        access_key_id: str,
        access_key_secret: str,
        security_token: Optional[str] = None
) -> Dict[str, Any]:
    """
    获取视频分析任务结果（便捷函数）

    Args:
        workspace_id: 阿里云百炼业务空间唯一标识
        task_id: 任务ID
        access_key_id: 阿里云AccessKey ID
        access_key_secret: 阿里云AccessKey Secret
        security_token: 安全令牌（可选）

    Returns:
        API响应结果字典
    """
    client = VideoAnalysisClient(access_key_id, access_key_secret, security_token)
    return client.get_video_analysis_task(workspace_id, task_id)


class TokenUtil:
    """Token工具类"""

    def __init__(self, api_token):
        self.api_token = api_token

    def get_token_info(self, task_id=None) -> Tuple[int, any]:
        """获取token信息"""
        session = requests.Session()

        if bool(task_id):
            url = f'https://test.dmaodata.cn/app-api/token/record/getTokenInfo?apiToken={self.api_token}&taskId={task_id}'
        else:
            url = 'https://test.dmaodata.cn/app-api/token/record/getTokenInfo?apiToken=' + self.api_token

        req = requests.Request(
            method='GET',
            url=url,
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
            return 1, str(e)

    def record_log_params(self, params: dict):
        """
        记录日志参数
        Args:
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

    def record_log_token(self, token_id, used_points, task_type, task_id, task_status):
        """
        记录token使用日志
        Args:
            token_id: token主键ID
            used_points: 本次消耗的积分数
            task_type: 这里默认为2-视频解析
            task_id:
            task_status:
        """
        params = {
            "tokenId": token_id,
            "usedPoints": used_points,
            "taskType": task_type,
            "taskId": task_id,
            "taskStatus": task_status
        }

        _key, _token = self.record_log_params(params)

        session = requests.Session()

        req = requests.Request(
            method='POST',
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
            response.raise_for_status()
            response_data = response.json()

            target = response_data["data"]

            if response_data["code"] != 0:
                return 1, target["msg"]

            return 0, target
        except requests.exceptions.RequestException as e:
            return 1, str(e)


class AES_CBC:
    """AES加密工具类"""

    def __init__(self, iv):
        key = "f5&8$f5b#527&eda"
        self.key = key.encode('utf-8')
        self.iv = iv.encode('utf-8')
        self.block_size = 16

    def encrypt(self, plaintext):
        """加密"""
        cipher = AES.new(self.key, AES.MODE_CBC, self.iv)
        padded_data = pad(plaintext.encode('utf-8'), self.block_size)
        encrypted = cipher.encrypt(padded_data)
        return base64.b64encode(encrypted).decode('utf-8')

    def decrypt(self, ciphertext):
        """解密"""
        cipher = AES.new(self.key, AES.MODE_CBC, self.iv)
        decoded = base64.b64decode(ciphertext)
        decrypted_padded = cipher.decrypt(decoded)
        try:
            decrypted = unpad(decrypted_padded, self.block_size)
        except ValueError as e:
            raise ValueError("Padding error during decryption. Possible key/iv mismatch.") from e
        return decrypted.decode('utf-8')


# 使用示例
# def handler(args: Args[Input]) -> Output:
def handler(args) -> dict:
    api_token = args.input.api_token
    task_id = args.input.task_id

    # 初始化 Token 工具
    token_util = TokenUtil(api_token)

    # 默认返回格式
    default_return = {
        "data": "",
        "code": 400,
        "extend_info": "",
        "msg": "请求参数错误，若不知如何使用，请查看联系管理员（esir1158）"
    }

    if not api_token.startswith("dm-"):
        default_return["msg"] = "参数错误，该api_token不支持当前操作，请联系管理员（esir1158）"
        return default_return

    # 验证 Token
    status, token_info = token_util.get_token_info(task_id)
    if status == 1:
        default_return["msg"] = "视频解析失败,原因是：积分已用完，请联系管理员（esir1158）"
        default_return["extend_info"] = json.dumps(token_info)
        return default_return

    # 从环境变量获取AccessKey（推荐方式）
    SECURITY_TOKEN = None

    # 如果没有设置环境变量，可以在这里直接赋值（不推荐在生产环境使用）
    ACCESS_KEY_ID = ALIYUN_ACCESS_KEY_ID
    ACCESS_KEY_SECRET = ALIYUN_ACCESS_KEY_SECRET

    workspace_id = WORKSPACE_ID
    # task_id = "f571b5c50a954d6f8e2bdd27651ae6cc"  # 替换为实际的任务ID

    try:

        # 方式2: 使用客户端类（推荐）
        client = VideoAnalysisClient(ACCESS_KEY_ID, ACCESS_KEY_SECRET, SECURITY_TOKEN, workspace_id)
        result = client.get_video_analysis_task(task_id=task_id)

        if result["success"]:

            task_type = token_info["taskType"]
            task_status = token_info["taskStatus"]

            # 解析并打印详细结果
            if result["task_status"] == TaskStatus.SUCCESSED:
                parsed = client.parse_task_result(result)

                print("\n=== 视频分析结果 ===")
                has_successsed = False
                if "video_analysis" in parsed:
                    video_analysis = parsed["video_analysis"]
                    default_return["code"] = 0
                    default_return["msg"] = "成功"
                    default_return["data"] = video_analysis  # 分析结果
                    has_successsed = True

                else:
                    # 数据分析失败，返回失败的原因，然后跳过
                    err_info = result["data"]["payload"]["output"]["videoAnalysisResult"]["text"]
                    default_return["msg"] = err_info
                    token_util.record_log_token(token_info["id"], 0, task_type, task_id, 3)
                    return default_return

                # 分成功和失败两种情况,同时考虑是否更新过记录

                # 计算积分消耗
                _data = result["data"]
                _payload = _data["payload"]
                _output = _payload["output"]
                _videoCalculatorResult = _output["videoCalculatorResult"]
                _items = _videoCalculatorResult["items"]
                _total_expense = 0  # 总消费金额
                for _item in _items:
                    te = _item["totalExpense"]
                    _total_expense += (te * 100000)

                if _total_expense < 1000:
                    _total_expense = 1000  # 等于1积分

                used_point = math.ceil(_total_expense / 1000) * 2  # 统计的积分消耗

                # default_return["msg"] = f"token_id = {token_info['id']}  used_point = {used_point} task_type = {task_type} _task_status = {task_status} has_succes = {has_successsed}"

                # 恢复为实际使用的积分
                if task_type == 2 and task_status == 1:
                    _task_status = 3 if has_successsed == False else 2
                    # default_return["msg"] = f"token_id = {token_info['id']}  used_point = {used_point} task_type = {task_type} _task_status = {_task_status}"
                    token_util.record_log_token(token_info["id"], used_point, task_type, task_id, _task_status)

                extend_info = {}
                # 计算 Token 消耗
                extend_info["api_token"] = token_info["apiToken"]
                extend_info["createTime"] = token_info["createTime"]
                extend_info["expireTime"] = token_info["expireTime"]
                extend_info["totalPoints"] = token_info["totalPoints"]

                if used_point - 100 > 0:
                    extend_info["unusedPoints"] = token_info["unusedPoints"] - (used_point - 100)
                    extend_info["usedPoints"] = token_info["usedPoints"] + (used_point - 100)
                else:
                    extend_info["unusedPoints"] = token_info["unusedPoints"] + (100 - used_point)
                    extend_info["usedPoints"] = token_info["usedPoints"] - (100 - used_point)

                extend_info["currUsedPoints"] = used_point
                extend_info["hasUsed"] = not (extend_info["unusedPoints"] > 0)

                default_return["extend_info"] = json.dumps(extend_info)
            else:
                print(f"\n任务未成功完成，错误信息: {result.get('data', {}).get('errorMessage', 'N/A')}")
                default_return[
                    "msg"] = f"\n任务未成功完成，错误信息: {result.get('data', {}).get('errorMessage', 'N/A')}"
        else:
            print(f"任务查询失败: {result['message']} (错误码: {result['code']})")
            default_return["msg"] = f"任务查询失败: {result['message']} (错误码: {result['code']})"

    except Exception as e:
        print(f"调用API时发生错误: {e}")
        default_return["msg"] = f"调用API时发生错误: {e}"

    return default_return


# if __name__ == '__main__':

#     class Input:

#         def __init__(self):
#             self.api_token = "dm-3c681c47c6b443e8baffd7af559088e810"
#             self.task_id = "b6d7137d1755461e9abb0ef554b8265c"

#     class Args:

#         def __init__(self):
#             self.input = Input()

#     args = Args()

#     handler(args)