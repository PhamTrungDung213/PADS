"""Rollback script cho dot toi uu dung luong DefChest.scene.
Nam ngay trong e:\CocosProjects\PADS\_backup_defchest_build_opt\ (khong luu gi o o C:).
Chay lenh:
  python "e:\CocosProjects\PADS\_backup_defchest_build_opt\rollback.py"
"""
import os
import shutil
import json
import urllib.request

BK = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(BK)
NEW_DIR = os.path.join(ROOT, "assets", "DefChest_Optimized")

ASSET_FILES = [
    r"assets\Scene\DefChest.scene",
    r"assets\OtherAssets\Item\M_GoldBar\M_GoldBar.mtl",
    r"assets\source\ADHD_asset\Prefab\Coin\Collectible_Coin.prefab",
    r"assets\OtherAssets\Enemy\SkeletonKing\skin-003.mtl",
    r"assets\OtherAssets\Enemy\SkeletonKing\SkeletonK.prefab",
    r"assets\OtherAssets\Paladin_VFX\Shared\vfx\Mage\FX_Fireball_impact\textures\Crater32_5883f93c.png",
]


def call_editor_js(code):
    url = "http://127.0.0.1:24175/mcp/project/736b7cef460d0b6fedd8111c/"
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": "execute_javascript", "arguments": {"context": "editor", "code": code}},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        return json.loads(resp.read().decode("utf-8"))


def rollback():
    for rel in ASSET_FILES:
        src = os.path.join(BK, rel)
        dst = os.path.join(ROOT, rel)
        if os.path.exists(src):
            shutil.copy2(src, dst)
            print("Restored:", rel)
    if os.path.isdir(NEW_DIR):
        shutil.rmtree(NEW_DIR)
        meta = NEW_DIR + ".meta"
        if os.path.exists(meta):
            os.remove(meta)
        print("Removed:", NEW_DIR)
    try:
        call_editor_js("await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets'); return 'ok';")
        call_editor_js("await Editor.Message.request('scene', 'open-scene', '9a7fad9b-e50e-4a72-a3cb-0232559be3df'); return 'ok';")
        print("Cocos Editor refreshed & reopened DefChest.scene!")
    except Exception as e:
        print("Da khoi phuc file thanh cong. Hay bam Refresh trong Cocos Editor va mo lai DefChest.scene:", e)


if __name__ == "__main__":
    rollback()
