"""Tiny Overpass helper with retries. Usage: python tools/osm.py "<query>" out.json"""
import sys, time, urllib.request, urllib.parse, json

def overpass(q, tries=6):
    for i in range(tries):
        for url in ('https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'):
            try:
                req = urllib.request.Request(url, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': 'karmiel-game/1.0'})
                txt = urllib.request.urlopen(req, timeout=180).read().decode()
                return json.loads(txt)
            except Exception as e:
                print('retry', i, url, str(e)[:80], file=sys.stderr); time.sleep(5)
    raise SystemExit('overpass failed')

if __name__ == '__main__':
    json.dump(overpass(sys.argv[1]), open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False)
