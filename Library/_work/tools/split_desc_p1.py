import json,os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","grids_p1"))
d=json.load(open("_incoming_desc.json")); m=json.load(open("_manifest.json")); n=0
for g,items in m.items():
    if os.path.exists(f"{g}.desc.json"): continue
    o={it["id"]:d[it["id"]] for it in items if it["id"] in d}
    if len(o)==len(items): json.dump(o,open(f"{g}.desc.json","w"),ensure_ascii=False); n+=1
print(n,"new desc files;", sum(1 for f in os.listdir('.') if f.endswith('.desc.json')),"total")
