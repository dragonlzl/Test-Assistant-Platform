import json
import re
from datetime import datetime, timezone
from typing import List, Optional
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..audit import log_operation
from ..db import get_db
from ..dependencies import get_current_user


router = APIRouter(tags=["settings"])


def _normalize_scope(scope: Optional[str], allow_all: bool = False) -> str:
    value = (scope or "user").lower()
    if allow_all and value == "all":
        return "all"
    if value in ("user", "global"):
        return value
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="scope 无效")


def _resolve_owner_id(scope: str, user: models.User) -> Optional[int]:
    if scope == "global":
        return None
    return user.id


def _normalize_timeout_sec(value: Optional[int]) -> int:
    try:
        timeout = int(value or 60)
    except Exception:
        timeout = 60
    if timeout < 5:
        return 5
    if timeout > 1800:
        return 1800
    return timeout


def _validate_model_url(raw_url: Optional[str]) -> str:
    url = (raw_url or "").strip()
    if not url:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模型地址不能为空")
    parsed = urllib_parse.urlparse(url)
    scheme = (parsed.scheme or "").lower()
    if scheme not in ("http", "https"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="模型地址仅支持 http/https"
        )
    if not parsed.netloc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="模型地址格式不正确"
        )
    return url


def _normalize_web_search_limit(value: Optional[int]) -> int:
    try:
        limit = int(value or 5)
    except Exception:
        limit = 5
    if limit < 1:
        return 1
    if limit > 10:
        return 10
    return limit


def _sanitize_web_search_query(raw: Optional[str]) -> str:
    text = (raw or "").strip()
    if not text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="搜索关键词不能为空")
    if len(text) > 120:
        text = text[:120]
    return text


def _extract_bing_rss_items(raw_xml: bytes, limit: int) -> List[dict]:
    if not raw_xml:
        return []
    try:
        root = ET.fromstring(raw_xml)
    except Exception:
        return []
    items: List[dict] = []

    def local_name(tag: Optional[str]) -> str:
        raw_tag = tag or ""
        if "}" in raw_tag:
            return raw_tag.split("}", 1)[1]
        return raw_tag

    def first_child(node: Optional[ET.Element], name: str) -> Optional[ET.Element]:
        if node is None:
            return None
        for child in list(node):
            if local_name(child.tag) == name:
                return child
        return None

    def all_children(node: Optional[ET.Element], name: str) -> List[ET.Element]:
        if node is None:
            return []
        result: List[ET.Element] = []
        for child in list(node):
            if local_name(child.tag) == name:
                result.append(child)
        return result

    def child_text(node: Optional[ET.Element], name: str) -> str:
        child = first_child(node, name)
        if child is None or child.text is None:
            return ""
        return child.text.strip()

    channel = first_child(root, "channel")
    if channel is None and local_name(root.tag) == "channel":
        channel = root
    if channel is not None:
        for item in all_children(channel, "item"):
            title = child_text(item, "title")
            link = child_text(item, "link")
            desc = child_text(item, "description")
            if not title and not link and not desc:
                continue
            items.append(
                {
                    "title": title or link or "未命名结果",
                    "url": link,
                    "snippet": desc,
                    "source": "bing-rss",
                }
            )
            if len(items) >= limit:
                break
        if items:
            return items

    # 兼容少量 Atom feed 响应。
    for entry in all_children(root, "entry"):
        title = child_text(entry, "title")
        desc = child_text(entry, "summary") or child_text(entry, "content")
        link = ""
        for link_node in all_children(entry, "link"):
            href = (link_node.attrib.get("href") or "").strip()
            if href:
                link = href
                break
        if not title and not link and not desc:
            continue
        items.append(
            {
                "title": title or link or "未命名结果",
                "url": link,
                "snippet": desc,
                "source": "bing-rss",
            }
        )
        if len(items) >= limit:
            break
    return items


def _looks_like_weather_query(text: str) -> bool:
    raw = (text or "").lower()
    if not raw:
        return False
    return any(
        key in raw
        for key in (
            "天气",
            "weather",
            "forecast",
            "气温",
            "温度",
            "下雨",
            "降雨",
        )
    )


def _looks_like_weather_item(item: dict) -> bool:
    payload = item if isinstance(item, dict) else {}
    title = str(payload.get("title") or "").lower()
    snippet = str(payload.get("snippet") or "").lower()
    url = str(payload.get("url") or "").lower()
    merged = " ".join([title, snippet, url])
    if any(
        key in merged
        for key in (
            "天气",
            "weather",
            "forecast",
            "气象",
            "温度",
            "降水",
            "rain",
            "wind",
            "humidity",
        )
    ):
        return True
    weather_hosts = (
        "weather.cma.cn",
        "weather.com.cn",
        "nmc.cn",
        "open-meteo.com",
        "msn.com",
        "accuweather.com",
    )
    return any(host in url for host in weather_hosts)


def _dedup_search_items(items: List[dict], limit: int) -> List[dict]:
    result: List[dict] = []
    seen = set()
    for item in items:
        payload = item if isinstance(item, dict) else {}
        url = str(payload.get("url") or "").strip().lower()
        title = str(payload.get("title") or "").strip().lower()
        snippet = str(payload.get("snippet") or "").strip().lower()
        key = url or f"{title}|{snippet}"
        if not key or key in seen:
            continue
        seen.add(key)
        result.append(payload)
        if len(result) >= limit:
            break
    return result


def _extract_weather_city(query: str) -> str:
    raw = (query or "").strip()
    if not raw:
        return ""
    cleaned = re.sub(r"[，,。！？!?;；:：/\\]+", " ", raw)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    pattern = re.compile(
        r"([A-Za-z\u4e00-\u9fff]{2,24})\s*(?:今天天气|今日天气|天气|weather|forecast)",
        re.IGNORECASE,
    )
    match = pattern.search(cleaned)
    candidate = match.group(1).strip() if match else ""
    if not candidate:
        tokens = [item.strip() for item in cleaned.split(" ") if item.strip()]
        if tokens:
            candidate = tokens[0]

    for prefix in ("帮我", "请帮我", "请问", "查询", "查下", "查一下", "看下", "看看", "现在", "当前", "今天", "今日"):
        if candidate.startswith(prefix):
            candidate = candidate[len(prefix) :].strip()
    for suffix in ("怎么样", "如何", "天气", "weather", "forecast", "今天", "今日", "的"):
        if candidate.endswith(suffix):
            candidate = candidate[: -len(suffix)].strip()

    generic_words = {"今天", "今日", "现在", "当前", "天气", "weather", "forecast"}
    if not candidate or candidate.lower() in generic_words:
        return ""
    return candidate


def _weather_code_text(code: Optional[int]) -> str:
    mapping = {
        0: "晴",
        1: "大部晴朗",
        2: "多云",
        3: "阴",
        45: "雾",
        48: "雾凇",
        51: "小毛雨",
        53: "毛雨",
        55: "大毛雨",
        56: "冻毛雨",
        57: "强冻毛雨",
        61: "小雨",
        63: "中雨",
        65: "大雨",
        66: "冻雨",
        67: "强冻雨",
        71: "小雪",
        73: "中雪",
        75: "大雪",
        77: "冰粒",
        80: "阵雨",
        81: "较强阵雨",
        82: "强阵雨",
        85: "阵雪",
        86: "强阵雪",
        95: "雷暴",
        96: "雷暴伴小冰雹",
        99: "雷暴伴强冰雹",
    }
    if code is None:
        return ""
    return mapping.get(int(code), "")


def _fetch_weather_item(query: str) -> Optional[dict]:
    city = _extract_weather_city(query)
    if not city:
        return None

    geocode_url = (
        "https://geocoding-api.open-meteo.com/v1/search?"
        + urllib_parse.urlencode({"name": city, "count": 1, "language": "zh", "format": "json"})
    )
    geocode_req = urllib_request.Request(
        url=geocode_url,
        headers={"Accept": "application/json", "User-Agent": "tap-web-search/1.0"},
        method="GET",
    )
    try:
        with urllib_request.urlopen(geocode_req, timeout=10) as geocode_resp:
            geocode_raw = geocode_resp.read() or b"{}"
        geocode_body = json.loads(geocode_raw.decode("utf-8", errors="ignore") or "{}")
    except Exception:
        return None

    results = geocode_body.get("results") if isinstance(geocode_body, dict) else None
    if not isinstance(results, list) or not results:
        return None
    first = results[0] if isinstance(results[0], dict) else {}
    latitude = first.get("latitude")
    longitude = first.get("longitude")
    if latitude is None or longitude is None:
        return None

    forecast_query = {
        "latitude": latitude,
        "longitude": longitude,
        "timezone": "auto",
        "current": "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
        "daily": "temperature_2m_max,temperature_2m_min,weather_code",
        "forecast_days": 1,
    }
    forecast_url = "https://api.open-meteo.com/v1/forecast?" + urllib_parse.urlencode(forecast_query)
    forecast_req = urllib_request.Request(
        url=forecast_url,
        headers={"Accept": "application/json", "User-Agent": "tap-web-search/1.0"},
        method="GET",
    )
    try:
        with urllib_request.urlopen(forecast_req, timeout=10) as forecast_resp:
            forecast_raw = forecast_resp.read() or b"{}"
        forecast_body = json.loads(forecast_raw.decode("utf-8", errors="ignore") or "{}")
    except Exception:
        return None

    current = forecast_body.get("current") if isinstance(forecast_body, dict) else {}
    daily = forecast_body.get("daily") if isinstance(forecast_body, dict) else {}
    if not isinstance(current, dict):
        current = {}
    if not isinstance(daily, dict):
        daily = {}

    temp = current.get("temperature_2m")
    humidity = current.get("relative_humidity_2m")
    wind = current.get("wind_speed_10m")
    weather_code = current.get("weather_code")

    max_temps = daily.get("temperature_2m_max") if isinstance(daily.get("temperature_2m_max"), list) else []
    min_temps = daily.get("temperature_2m_min") if isinstance(daily.get("temperature_2m_min"), list) else []
    daily_codes = daily.get("weather_code") if isinstance(daily.get("weather_code"), list) else []
    if weather_code is None and daily_codes:
        weather_code = daily_codes[0]

    parts: List[str] = []
    weather_text = _weather_code_text(weather_code)
    if weather_text:
        parts.append(f"天气{weather_text}")
    if temp is not None:
        parts.append(f"当前{temp}℃")
    if min_temps and max_temps:
        parts.append(f"今日{min_temps[0]}~{max_temps[0]}℃")
    if humidity is not None:
        parts.append(f"湿度{humidity}%")
    if wind is not None:
        parts.append(f"风速{wind}km/h")

    place_name = (first.get("name") or city).strip()
    if first.get("country_code"):
        place_name = f"{place_name}({first['country_code']})"
    snippet = f"{place_name}实时天气：{'，'.join(parts)}" if parts else f"{place_name}天气数据已获取。"
    return {
        "title": f"{place_name}今日天气",
        "url": "https://open-meteo.com/",
        "snippet": snippet,
        "source": "open-meteo",
    }


@router.get("/settings", response_model=List[schemas.SettingOut])
def list_settings(
    scope: str = "all",
    owner_id: Optional[int] = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_norm = _normalize_scope(scope, allow_all=True)
    effective_owner = owner_id if owner_id is not None else user.id
    if owner_id is not None and user.role != "admin" and owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限查看该用户设置")
    query = db.query(models.Setting)
    if scope_norm == "user":
        query = query.filter(
            models.Setting.scope == "user",
            models.Setting.owner_id == effective_owner,
        )
    elif scope_norm == "global":
        query = query.filter(models.Setting.scope == "global")
    else:
        query = query.filter(
            or_(
                models.Setting.scope == "global",
                and_(
                    models.Setting.scope == "user",
                    models.Setting.owner_id == effective_owner,
                ),
            )
        )
    return query.order_by(models.Setting.updated_at.desc()).all()


@router.put("/settings", response_model=List[schemas.SettingOut])
def save_settings(
    payload: schemas.SettingsUpdateRequest,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_norm = _normalize_scope(payload.scope or "user")
    if scope_norm == "global" and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可保存全局设置")
    if not payload.items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设置项不能为空")
    owner_id = _resolve_owner_id(scope_norm, user)
    saved = []
    now = datetime.now(timezone.utc)
    for item in payload.items:
        key = item.key.strip() if item and item.key else ""
        if not key:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="设置 key 不能为空")
        setting = (
            db.query(models.Setting)
            .filter(
                models.Setting.scope == scope_norm,
                models.Setting.owner_id == owner_id,
                models.Setting.key == key,
            )
            .first()
        )
        if setting:
            setting.value_json = item.value_json
            setting.updated_at = now
        else:
            setting = models.Setting(
                scope=scope_norm,
                owner_id=owner_id,
                key=key,
                value_json=item.value_json,
                updated_at=now,
            )
            db.add(setting)
        saved.append(setting)
    db.flush()
    log_operation(
        db=db,
        user_id=user.id,
        action="update_settings",
        target_type="settings",
        target_id=owner_id,
        detail={
            "scope": scope_norm,
            "keys": [item.key for item in payload.items],
            "items": [{"key": item.key, "value_json": item.value_json} for item in payload.items],
        },
    )
    db.commit()
    for setting in saved:
        db.refresh(setting)
    return saved


@router.get("/models", response_model=List[schemas.ModelConfigOut])
def list_model_configs(
    scope: str = "all",
    owner_id: Optional[int] = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_norm = _normalize_scope(scope, allow_all=True)
    query = db.query(models.ModelConfig).filter(models.ModelConfig.is_active.is_(True))
    if owner_id is not None:
        if user.role != "admin" and owner_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权限查看该用户模型配置"
            )
        query = query.filter(models.ModelConfig.owner_id == owner_id)
    elif scope_norm == "user":
        query = query.filter(models.ModelConfig.owner_id == user.id)
    elif scope_norm == "global":
        query = query.filter(models.ModelConfig.owner_id.is_(None))
    else:
        query = query.filter(
            or_(models.ModelConfig.owner_id.is_(None), models.ModelConfig.owner_id == user.id)
        )
    return query.order_by(models.ModelConfig.id.desc()).all()


@router.post("/models", response_model=schemas.ModelConfigOut, status_code=status.HTTP_201_CREATED)
def create_model_config(
    payload: schemas.ModelConfigCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_norm = _normalize_scope(payload.scope or "user")
    if scope_norm == "global" and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可创建全局模型配置")
    owner_id = _resolve_owner_id(scope_norm, user)
    existing = (
        db.query(models.ModelConfig)
        .filter(models.ModelConfig.owner_id == owner_id, models.ModelConfig.name == payload.name)
        .first()
    )
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模型名称已存在")
    config = models.ModelConfig(
        owner_id=owner_id,
        name=payload.name,
        config_json=payload.config_json,
        is_active=True if payload.is_active is None else payload.is_active,
    )
    db.add(config)
    db.flush()
    log_operation(
        db=db,
        user_id=user.id,
        action="create_model_config",
        target_type="model_config",
        target_id=config.id,
        detail={"scope": scope_norm, "name": payload.name},
    )
    db.commit()
    db.refresh(config)
    return config


@router.patch("/models/{config_id}", response_model=schemas.ModelConfigOut)
def update_model_config(
    config_id: int,
    payload: schemas.ModelConfigUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = db.query(models.ModelConfig).filter(models.ModelConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="模型配置不存在")
    if config.owner_id is None and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可修改全局配置")
    if config.owner_id is not None and config.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限修改该配置")
    if payload.name and payload.name != config.name:
        exists = (
            db.query(models.ModelConfig)
            .filter(
                models.ModelConfig.owner_id == config.owner_id,
                models.ModelConfig.name == payload.name,
                models.ModelConfig.id != config.id,
            )
            .first()
        )
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="模型名称已存在")
        config.name = payload.name
    if payload.config_json is not None:
        config.config_json = payload.config_json
    if payload.is_active is not None:
        config.is_active = payload.is_active
    config.updated_at = datetime.now(timezone.utc)
    db.add(config)
    log_operation(
        db=db,
        user_id=user.id,
        action="update_model_config",
        target_type="model_config",
        target_id=config.id,
    )
    db.commit()
    db.refresh(config)
    return config


@router.post("/model-proxy")
def proxy_model_request(
    payload: schemas.ModelProxyRequest,
    _: models.User = Depends(get_current_user),
):
    target_url = _validate_model_url(payload.base_url)
    timeout_sec = _normalize_timeout_sec(payload.timeout_sec)
    request_payload = payload.payload if payload.payload is not None else {}
    try:
        body_bytes = json.dumps(request_payload, ensure_ascii=False).encode("utf-8")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"模型请求体不是合法 JSON：{exc}"
        ) from exc

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json,text/plain,*/*",
        "User-Agent": "tap-model-proxy/1.0",
    }
    api_key = (payload.api_key or "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    request_obj = urllib_request.Request(
        url=target_url,
        data=body_bytes,
        headers=headers,
        method="POST",
    )

    try:
        with urllib_request.urlopen(request_obj, timeout=timeout_sec) as upstream_resp:
            raw = upstream_resp.read()
            content_type = upstream_resp.headers.get("Content-Type", "application/json")
            return Response(
                content=raw,
                status_code=int(upstream_resp.status),
                headers={"Content-Type": content_type},
            )
    except urllib_error.HTTPError as exc:
        raw = b""
        try:
            raw = exc.read() or b""
        except Exception:
            raw = b""
        content_type = (
            exc.headers.get("Content-Type", "text/plain; charset=utf-8")
            if exc.headers
            else "text/plain; charset=utf-8"
        )
        if not raw:
            reason = str(exc.reason or "upstream error")
            raw = reason.encode("utf-8")
        return Response(
            content=raw,
            status_code=int(exc.code or 502),
            headers={"Content-Type": content_type},
        )
    except urllib_error.URLError as exc:
        reason = getattr(exc, "reason", None)
        msg = str(reason or exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"连接模型服务失败：{msg}"
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="模型服务连接超时"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"模型代理请求失败：{exc}"
        ) from exc


@router.get("/web-search")
def web_search(
    q: str,
    limit: int = 5,
    _: models.User = Depends(get_current_user),
):
    query = _sanitize_web_search_query(q)
    safe_limit = _normalize_web_search_limit(limit)
    target_url = (
        "https://www.bing.com/search?format=rss&q="
        + urllib_parse.quote(query)
    )
    request_obj = urllib_request.Request(
        url=target_url,
        headers={
            "Accept": "application/rss+xml,application/xml,text/xml,*/*",
            "User-Agent": "tap-web-search/1.0",
        },
        method="GET",
    )
    try:
        with urllib_request.urlopen(request_obj, timeout=15) as upstream_resp:
            raw = upstream_resp.read() or b""
    except urllib_error.HTTPError as exc:
        code = int(exc.code or 502)
        raise HTTPException(status_code=code, detail="搜索服务返回异常状态码") from exc
    except urllib_error.URLError as exc:
        reason = getattr(exc, "reason", None)
        msg = str(reason or exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"搜索服务连接失败：{msg}"
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT, detail="搜索服务连接超时"
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=f"搜索请求失败：{exc}"
        ) from exc

    items = _extract_bing_rss_items(raw, safe_limit)
    provider = "bing-rss"
    if _looks_like_weather_query(query):
        weather_item = _fetch_weather_item(query)
        weather_items = [item for item in items if _looks_like_weather_item(item)]
        merged_items: List[dict] = []
        if weather_item:
            merged_items.append(weather_item)
            provider = "open-meteo+bing-rss"
        merged_items.extend(weather_items)
        if merged_items:
            items = _dedup_search_items(merged_items, safe_limit)
        elif weather_item:
            items = [weather_item]
            provider = "open-meteo"
    return {
        "ok": True,
        "query": query,
        "provider": provider,
        "items": items,
        "total": len(items),
        "reason": "no_results" if not items else "",
    }


@router.get("/features", response_model=List[schemas.FeatureAssignmentOut])
def list_feature_assignments(
    scope: str = "all",
    owner_id: Optional[int] = None,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_norm = _normalize_scope(scope, allow_all=True)
    query = db.query(models.FeatureAssignment)
    if owner_id is not None:
        if user.role != "admin" and owner_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="无权限查看该用户功能指派"
            )
        query = query.filter(models.FeatureAssignment.owner_id == owner_id)
    elif scope_norm == "user":
        query = query.filter(models.FeatureAssignment.owner_id == user.id)
    elif scope_norm == "global":
        query = query.filter(models.FeatureAssignment.owner_id.is_(None))
    else:
        query = query.filter(
            or_(
                models.FeatureAssignment.owner_id.is_(None),
                models.FeatureAssignment.owner_id == user.id,
            )
        )
    return query.order_by(models.FeatureAssignment.id.desc()).all()


@router.post(
    "/features",
    response_model=schemas.FeatureAssignmentOut,
    status_code=status.HTTP_201_CREATED,
)
def create_feature_assignment(
    payload: schemas.FeatureAssignmentCreate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    scope_norm = _normalize_scope(payload.scope or "user")
    if scope_norm == "global" and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可创建全局指派")
    owner_id = _resolve_owner_id(scope_norm, user)
    exists = (
        db.query(models.FeatureAssignment)
        .filter(
            models.FeatureAssignment.owner_id == owner_id,
            models.FeatureAssignment.name == payload.name,
        )
        .first()
    )
    if exists:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="功能指派名称已存在")
    assignment = models.FeatureAssignment(
        owner_id=owner_id,
        name=payload.name,
        config_json=payload.config_json,
    )
    db.add(assignment)
    db.flush()
    log_operation(
        db=db,
        user_id=user.id,
        action="create_feature_assignment",
        target_type="feature_assignment",
        target_id=assignment.id,
        detail={"scope": scope_norm, "name": payload.name},
    )
    db.commit()
    db.refresh(assignment)
    return assignment


@router.patch("/features/{assignment_id}", response_model=schemas.FeatureAssignmentOut)
def update_feature_assignment(
    assignment_id: int,
    payload: schemas.FeatureAssignmentUpdate,
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    assignment = (
        db.query(models.FeatureAssignment)
        .filter(models.FeatureAssignment.id == assignment_id)
        .first()
    )
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="功能指派不存在")
    if assignment.owner_id is None and user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="仅管理员可修改全局指派")
    if assignment.owner_id is not None and assignment.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="无权限修改该指派")
    if payload.name and payload.name != assignment.name:
        exists = (
            db.query(models.FeatureAssignment)
            .filter(
                models.FeatureAssignment.owner_id == assignment.owner_id,
                models.FeatureAssignment.name == payload.name,
                models.FeatureAssignment.id != assignment.id,
            )
            .first()
        )
        if exists:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="功能指派名称已存在")
        assignment.name = payload.name
    if payload.config_json is not None:
        assignment.config_json = payload.config_json
    assignment.updated_at = datetime.now(timezone.utc)
    db.add(assignment)
    log_operation(
        db=db,
        user_id=user.id,
        action="update_feature_assignment",
        target_type="feature_assignment",
        target_id=assignment.id,
    )
    db.commit()
    db.refresh(assignment)
    return assignment
