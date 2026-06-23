import json, time, sys
from pathlib import Path

pf = Path(__file__).parent / ".seed_progress.json"
while True:
    try:
        d = json.loads(pf.read_text(encoding="utf-8"))
        n = len(d["completed"])
        print(f"已导入: {n} / 5525 只  ({n*100//5525}%)")
    except Exception as e:
        print(f"读取失败: {e}")
    time.sleep(10)
