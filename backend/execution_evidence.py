"""MCP-only immutable failure snapshots; images never travel with case lists."""
import base64
import binascii
import io
import warnings
from typing import Optional

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel, ConfigDict, Field

from . import models


class CropRegion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class FailureScreenshot(BaseModel):
    model_config = ConfigDict(extra="forbid")
    data_url: str = Field(max_length=1400000, description="真实失败截图的 PNG/JPEG/WebP base64 data URL，原图不超过 1 MiB；不能传本地路径或外链。优先先裁出关键区域。")
    crop: Optional[CropRegion] = Field(default=None, description="可选关键区域像素坐标；服务端裁剪后保存。必须覆盖能说明失败的画面并保留必要上下文。")


class FailureEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    reason: str = Field(min_length=1, max_length=20000, description="明确、简要、直接的实际失败原因：操作后观察到了什么、与预期有何差异。只写真实观察，不猜测根因。")
    screenshot: Optional[FailureScreenshot] = Field(default=None, description="有截图时提供关键失败截图；无截图时省略，reason 仍必填。")


def normalize_screenshot(screenshot):
    if screenshot is None:
        return None
    try:
        header, encoded = screenshot.data_url.split(",", 1)
        formats = {"data:image/png;base64": "PNG", "data:image/jpeg;base64": "JPEG", "data:image/webp;base64": "WEBP"}
        if header not in formats:
            raise ValueError()
        raw = base64.b64decode(encoded, validate=True)
        if not raw or len(raw) > 1024 * 1024:
            raise ValueError()
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as source:
                if source.format != formats[header] or source.width * source.height > 16000000:
                    raise ValueError()
                source.load()
                crop = screenshot.crop
                if crop:
                    if crop.x + crop.width > source.width or crop.y + crop.height > source.height:
                        raise ValueError()
                    source = source.crop((crop.x, crop.y, crop.x + crop.width, crop.y + crop.height))
                # 重新编码去掉元数据，保存独立截图，不依赖客户端路径或外部 URL。
                source.thumbnail((2000, 2000))
                clean = Image.new("RGB", source.size, "white")
                rgba = source.convert("RGBA")
                clean.paste(rgba, mask=rgba.getchannel("A"))
                output = io.BytesIO()
                clean.save(output, format="PNG")
                mime = "png"
                if output.tell() > 1024 * 1024:
                    output = io.BytesIO()
                    clean.save(output, format="JPEG", quality=85)
                    mime = "jpeg"
                return "data:image/" + mime + ";base64," + base64.b64encode(output.getvalue()).decode("ascii")
    except (ValueError, binascii.Error, OSError, UnidentifiedImageError,
            Image.DecompressionBombWarning, Image.DecompressionBombError):
        raise HTTPException(400, "失败截图须为有效的 PNG/JPEG/WebP base64 图片（原图 ≤1 MiB、≤1600万像素），裁剪区域不能超出原图")


def make_failure_evidence(user, row, fields, detail, evidence, now):
    if fields["status"] != "失败":
        if evidence is not None:
            raise HTTPException(400, "仅失败结果可提交 failure_evidence")
        return None
    # 兼容已有客户端的实际结果描述，但绝不拿旧结果/旧备注生成新凭证。
    reason = evidence.reason if evidence else str(fields.get("actual_result") or "").strip()
    if not reason or reason.lower() in {"失败", "failed", "测试失败", "不通过"}:
        raise HTTPException(400, "MCP 执行失败须提供 failure_evidence.reason 或明确的 actual_result；有截图时同时提交关键截图")
    return models.ExecFailureEvidence(
        reuse_detail_id=str(detail["id"]) if detail else None,
        reuse_detail_name=detail.get("text", "") if detail else None,
        case_title=row.title, reason=reason,
        screenshot=normalize_screenshot(evidence.screenshot) if evidence else None,
        created_by=user.id, executor_name=user.username, created_at=now,
    )
