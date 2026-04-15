from runtime import Args
from typings.submit_video_analysis_task.submit_video_analysis_task import Input, Output

import hashlib
import hmac
from collections import OrderedDict
from typing import Any
from urllib.parse import quote_plus
import json
import uuid
from typing import Optional, Dict, List, Tuple
from datetime import datetime
import base64
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad


import pytz
import requests


ENDPOINT = "quanmiaolightapp.cn-beijing.aliyuncs.com"
WORKSPACE_ID = "llm-duqfbld2tm8dlsuy"
EQUEST_BASE_URL = f"/{WORKSPACE_ID}/quanmiao/lightapp/videoAnalysis/submitVideoAnalysisTask"
APP_ID = "2d8bf0d0605d4d26a95bb988481514cb"
AGENT_KEY = "43865782df2748e6a62ebfbab99fc77e_p_efm"
ALIYUN_ACCESS_KEY_ID = "<ALIYUN_ACCESS_KEY_ID>"
ALIYUN_ACCESS_KEY_SECRET = "<ALIYUN_ACCESS_KEY_SECRET>"


def handler(args: Args[Input])->Output:

    video_url = args.input.video_url
    api_token = args.input.api_token
    video_model_id = args.input.video_model_id
    video_model_prompt = args.input.video_model_prompt
    model_id = args.input.model_id
    generate_options = args.input.generate_options
    video_extra_info = args.input.video_extra_info
    language = args.input.language

    # 默认返回格式
    default_return: Output = {
        "code": 400,
        "task_id": "",
        "msg": "请求参数错误，若不知如何使用，请查看联系管理员（esir1158）",
        "extend_info": ""
    }

    if not api_token.startswith("dm-"):
        default_return["msg"] = "参数错误，该api_token不支持当前操作，请联系管理员（esir1158）"
        return default_return

    if not video_url.startswith("https"):
        return default_return

    
    if bool(video_extra_info) and 'videoExtraInfo' not in video_model_prompt:
        return default_return
    

    # 初始化 Token 工具
    token_util = TokenUtil(api_token)

    # 验证 Token
    status, token_info = token_util.get_token_info()
    if status == 1:
        default_return["msg"] = "视频解析失败,原因是：积分已用完，请联系管理员（esir1158）"
        default_return["extend_info"] = json.dumps(token_info)
        return default_return

    if token_info["unusedPoints"] < 100:
        default_return["msg"] = "视频解析失败,原因是：积分不足；本次视频解析需要预扣除100积分，你的剩余积分是：" + token_info["unusedPoints"]
        return default_return


    # 从环境变量获取AccessKey（推荐方式）
    SECURITY_TOKEN = None

    # 如果没有设置环境变量，可以在这里直接赋值（不推荐在生产环境使用）
    ACCESS_KEY_ID = ALIYUN_ACCESS_KEY_ID
    ACCESS_KEY_SECRET = ALIYUN_ACCESS_KEY_SECRET

    workspace_id = WORKSPACE_ID

    try:

        # 方式3: 使用客户端类 - 自定义完整参数
        client = VideoAnalysisClient(ACCESS_KEY_ID, ACCESS_KEY_SECRET, SECURITY_TOKEN)
        result = client.submit_video_analysis_task(
            workspace_id=workspace_id,
            video_url=video_url,
            video_model_id=video_model_id,
            video_model_custom_prompt_template=video_model_prompt,
            model_id=model_id,
            generate_options=generate_options,
            video_extra_info=video_extra_info,
            language=language
        )

        if result["success"]:
            print(f"任务提交成功！")
            default_return["code"] = 0
            default_return["task_id"] = result['task_id']

            # 预扣除100积分
            used_point = 100  # 预扣除100分

            extend_info = {}
            # 计算 Token 消耗
            extend_info["api_token"] = token_info["apiToken"]
            extend_info["createTime"] = token_info["createTime"]
            extend_info["expireTime"] = token_info["expireTime"]
            extend_info["totalPoints"] = token_info["totalPoints"]
            token_util.record_log_token(token_info["id"], used_point, 2, result['task_id'], 1)

            extend_info["unusedPoints"] = token_info["unusedPoints"] - used_point
            extend_info["usedPoints"] = token_info["usedPoints"] + used_point
            extend_info["currUsedPoints"] = used_point
            #extend_info["hasUsed"] = not (extend_info["unusedPoints"] > 0)
            extend_info["message"] = "本次预扣除100积分，将在获取任务结果后，采用多退少补的策略，折算实际的积分消耗"

            default_return["extend_info"] = json.dumps(extend_info)
            
        else:
            print(f"任务提交失败: {result['message']} (错误码: {result['code']})")
            default_return["msg"] = f"任务提交失败: {result['message']} (错误码: {result['code']})"

    except Exception as e:
        print(f"调用API时发生错误: {e}")
        default_return["msg"] = f"调用API时发生错误: {e}"
    
    return default_return



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


class VideoModelId:
    """视频VL任务模型ID常量"""
    QUANMIAO_VL_TURBO = "quanmiao-vl-turbo"
    QUANMIAO_VL_PLUS = "quanmiao-vl-plus"
    QUANMIAO_VL_MAX_THINKING = "quanmiao-vl-max-thinking"
    QUANMIAO_VL_MAX = "quanmiao-vl-max"
    QWEN_VL_POST = "Qwen-VL-Post"


class TextModelId:
    """文本加工大模型ID常量"""
    QUANMIAO_LLM_MAX = "quanmiao-llm-max"
    QUANMIAO_LLM_MAX_THINKING = "quanmiao-llm-max-thinking"
    QUANMIAO_LLM_PLUS = "quanmiao-llm-plus"
    QUANMIAO_LLM_TURBO = "quanmiao-llm-turbo"


class GenerateOption:
    """生成选项常量"""
    VIDEO_ANALYSIS = "videoAnalysis"  # 视频语言分析（VL）
    VIDEO_GENERATE = "videoGenerate"  # 文本加工-视频总结（默认），包含 videoAnalysis
    VIDEO_TITLE_GENERATE = "videoTitleGenerate"  # 视频标题生成，包含 videoAnalysis、videoGenerate
    VIDEO_MIND_MAPPING_GENERATE = "videoMindMappingGenerate"  # 视频思维导图生成，包含 videoAnalysis、videoGenerate
    VIDEO_ROLE_RECOGNITION = "videoRoleRecognition"  # 角色自动识别


class Language:
    """语言常量"""
    CHINESE = "chinese"
    FRENCH = "french"
    ENGLISH = "english"
    JAPANESE = "japanese"
    CHINESE_ENGLISH_FREELY = "chineseEnglishFreely"
    ARABIC = "arabic"
    KOREAN = "korean"
    MALAY = "malay"
    THAI = "thai"
    PORTUGUESE = "portuguese"
    SPANISH = "spanish"
    INDONESIAN = "indonesian"
    VIETNAMESE = "vietnamese"


class VideoAnalysisClient:
    """视频分析API客户端 - 封装视频分析任务相关操作"""

    # 默认配置
    DEFAULT_HOST = ENDPOINT
    DEFAULT_ACTION = "SubmitVideoAnalysisTask"
    DEFAULT_VERSION = "2024-08-01"

    # 默认参数
    DEFAULT_VIDEO_MODEL_ID = VideoModelId.QUANMIAO_VL_MAX
    DEFAULT_MODEL_ID = TextModelId.QUANMIAO_LLM_MAX
    DEFAULT_GENERATE_OPTIONS = [GenerateOption.VIDEO_ANALYSIS]
    DEFAULT_LANGUAGE = Language.CHINESE
    DEFAULT_PROMPT_TEMPLATE = "请分析这个视频的内容：{videoAsrText}"

    def __init__(self, access_key_id: str, access_key_secret: str, security_token: Optional[str] = None):
        """
        初始化客户端

        Args:
            access_key_id: 阿里云AccessKey ID
            access_key_secret: 阿里云AccessKey Secret
            security_token: 安全令牌（可选）
        """
        self.auth_generator = AuthorizationGenerator(access_key_id, access_key_secret)
        self.security_token = security_token

    def submit_video_analysis_task(
            self,
            workspace_id: str,
            video_url: str,
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
                - quanmiao-vl-turbo
                - quanmiao-vl-plus
                - quanmiao-vl-max-thinking
                - quanmiao-vl-max (默认)
                - Qwen-VL-Post
            video_model_custom_prompt_template: 视频 VL 任务 prompt 模版
                必须包含 {videoAsrText} 变量，{videoAsrText} 是视频的 ASR 文本信息
            model_id: 视频总结（文本加工）依赖的大模型唯一标识
                - quanmiao-llm-max (默认)
                - quanmiao-llm-max-thinking
                - quanmiao-llm-plus
                - quanmiao-llm-turbo
            generate_options: 生成选项列表
                - videoAnalysis: 视频语言分析（VL），如果仅传此值则运行到视频语言分析后就结束
                - videoGenerate: 文本加工-视频总结（默认），包含 videoAnalysis
                - videoTitleGenerate: 视频标题生成，包含 videoAnalysis、videoGenerate
                - videoMindMappingGenerate: 视频思维导图生成，包含 videoAnalysis、videoGenerate
                - videoRoleRecognition: 角色自动识别
            video_extra_info: 和视频相关的补充文字资料
                可以自定义扩展文本素材，应用到生成中
                需要手动调整 prompt 模版，增加 {videoExtraInfo} 变量
                传入的内容可以是视频摘要、视频简介或视频 ASR 转录信息
            language: 语言设置
                - chinese: 中文（默认）
                - french: 法语
                - english: 英语
                - japanese: 日语
                - chineseEnglishFreely: 中英文自由说
                - arabic: 阿拉伯语
                - korean: 韩语
                - malay: 马来语
                - thai: 泰语
                - portuguese: 葡萄牙语
                - spanish: 西班牙语
                - indonesian: 印尼语
                - vietnamese: 越南语
            **kwargs: 其他扩展参数

        Returns:
            API响应结果字典，包含:
                - success: 是否成功
                - request_id: 请求ID
                - task_id: 任务ID
                - message: 响应消息
                - code: 响应码
        """
        # 构建请求
        http_method = "POST"
        host = self.DEFAULT_HOST
        canonical_uri = f"/{workspace_id}/quanmiao/lightapp/videoAnalysis/submitVideoAnalysisTask"

        # 创建请求对象
        request = SignatureRequest(http_method, canonical_uri, host, self.DEFAULT_ACTION, self.DEFAULT_VERSION)

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


# 便捷函数（保持向后兼容）
def submit_video_analysis_task(
        workspace_id: str,
        video_url: str,
        access_key_id: str,
        access_key_secret: str,
        security_token: Optional[str] = None,
        video_model_id: Optional[str] = None,
        video_model_custom_prompt_template: Optional[str] = None,
        model_id: Optional[str] = None,
        generate_options: Optional[List[str]] = None,
        video_extra_info: Optional[str] = None,
        language: Optional[str] = None,
        **kwargs
) -> Dict[str, Any]:
    """
    调用SubmitVideoAnalysisTask API提交视频分析任务（便捷函数）

    Args:
        workspace_id: 阿里云百炼业务空间唯一标识
        video_url: 待分析的视频地址
        access_key_id: 阿里云AccessKey ID
        access_key_secret: 阿里云AccessKey Secret
        security_token: 安全令牌（可选）
        video_model_id: 视频 VL 任务模型ID
        video_model_custom_prompt_template: 视频 VL 任务 prompt 模版
        model_id: 视频总结依赖的大模型ID
        generate_options: 生成选项列表
        video_extra_info: 视频补充信息
        language: 语言设置
        **kwargs: 其他扩展参数

    Returns:
        API响应结果字典，包含:
            - success: 是否成功
            - request_id: 请求ID
            - task_id: 任务ID
            - message: 响应消息
            - code: 响应码
    """
    client = VideoAnalysisClient(access_key_id, access_key_secret, security_token)
    return client.submit_video_analysis_task(
        workspace_id=workspace_id,
        video_url=video_url,
        video_model_id=video_model_id,
        video_model_custom_prompt_template=video_model_custom_prompt_template,
        model_id=model_id,
        generate_options=generate_options,
        video_extra_info=video_extra_info,
        language=language,
        **kwargs
    )



class TokenUtil:
    """Token工具类"""
    def __init__(self, api_token):
        self.api_token = api_token

    def get_token_info(self) -> Tuple[int, any]:
        """获取token信息"""
        session = requests.Session()

        req = requests.Request(
            method='GET',
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


