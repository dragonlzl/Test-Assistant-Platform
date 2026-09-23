"""Server counterpart of reuseApplicabilityCore; parity fixtures protect both implementations."""
import copy

AUTO_ORIGIN = "auto-applicability"
CHARACTER = "character-skin-unlock-v1"
WEAPON = "weapon-evolution-skin-acquisition-v1"
CHARACTER_MODULES = {
    "碎片皮肤": "fragment", "宝石皮肤": "gem", "付费皮肤": "paid", "小鱼干皮肤": "fish",
    "赛季币皮肤": "season-store", "通过购买老皮肤送的新皮肤": "legacy-skin-gift", "条件皮肤": "condition",
}
PROFILES = {
    CHARACTER: {"key": CHARACTER, "label": "角色皮肤解锁方式", "options": [
        {"value": value, "label": label} for value, label in (
            ("fragment", "碎片"), ("gem", "宝石"), ("paid", "付费"), ("fish", "小鱼干"),
            ("season-store", "赛季商店"), ("legacy-skin-gift", "老皮肤赠送"), ("condition", "条件解锁"))]},
    WEAPON: {"key": WEAPON, "label": "武器进化皮肤获取方式", "options": [
        {"value": value, "label": label} for value, label in (
            ("gashapon", "扭蛋"), ("fish-store", "小鱼干商店"), ("blind-box", "盲盒"), ("mail", "邮箱"))]},
}


def text(value):
    return str(value).strip() if value is not None else ""


def normalize_applicability(value):
    if not isinstance(value, dict):
        return None
    profile, option = text(value.get("profile")), text(value.get("value"))
    if profile in PROFILES and option in {o["value"] for o in PROFILES[profile]["options"]}:
        return {"profile": profile, "value": option}
    return None


def detect_profile(project_name, modules, presets):
    if text(project_name) != "元气骑士":
        return None
    stored = {a["profile"] for p in presets if isinstance(p, dict)
              for a in [normalize_applicability(p.get("applicability"))] if a}
    if len(stored) == 1:
        return copy.deepcopy(PROFILES[next(iter(stored))])
    modules = {text(module) for module in modules}
    if len(modules & CHARACTER_MODULES.keys()) >= 2:
        return copy.deepcopy(PROFILES[CHARACTER])
    if "皮肤碎片" in modules and modules & {"皮肤操作", "皮肤使用", "皮肤存储", "联机同步"}:
        return copy.deepcopy(PROFILES[WEAPON])
    return None


def classify_case(profile_key, case):
    module = text(case.module)
    if profile_key == CHARACTER:
        return CHARACTER_MODULES.get(module, "")
    if profile_key == WEAPON and module == "皮肤碎片" and text(case.title) == "获取途径":
        for keyword, value in (("小鱼干商店", "fish-store"), ("扭蛋", "gashapon"), ("盲盒", "blind-box"), ("邮箱", "mail")):
            if keyword in text(case.steps):
                return value
    return ""


def apply_rules(details, presets, profile_key, case):
    """Only touch selected preset IDs; preserve manual results, notes and removed details."""
    counts = {"auto_set": 0, "auto_cleared": 0, "conflicts": 0}
    case_value = classify_case(profile_key, case)
    result = copy.deepcopy(details)
    for detail in result:
        if not isinstance(detail, dict) or detail.get("removed"):
            continue
        preset_id = text(detail.get("presetId"))
        if preset_id not in presets:
            continue
        applicability = normalize_applicability(presets[preset_id].get("applicability"))
        mismatch = bool(case_value and applicability and applicability["profile"] == profile_key
                        and applicability["value"] != case_value)
        auto_owned = (detail.get("statusOrigin") == AUTO_ORIGIN
                      and text(detail.get("statusOriginProfile")) in ("", profile_key))
        status = text(detail.get("status")) or "未执行"
        if mismatch:
            if auto_owned or status in ("pending", "未执行", "变更重跑", "有改动"):
                if status != "不适用" or detail.get("statusOrigin") != AUTO_ORIGIN or detail.get("statusOriginProfile") != profile_key:
                    counts["auto_set"] += 1
                detail.update(status="不适用", statusOrigin=AUTO_ORIGIN, statusOriginProfile=profile_key)
            else:
                counts["conflicts"] += 1
        elif auto_owned:
            detail.pop("statusOrigin", None)
            detail.pop("statusOriginProfile", None)
            if status == "不适用":
                detail["status"] = "未执行"
            counts["auto_cleared"] += 1
    return result, counts
