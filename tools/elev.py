"""Fetch an SRTM elevation grid from opentopodata (100 points/request, 1 req/s)."""
import json, time, urllib.request, os
LAT0, LAT1, LON0, LON1, NX, NZ = 32.945, 32.880, 35.245, 35.375, 110, 60
pts = [(LAT0 + (LAT1 - LAT0) * j / (NZ - 1), LON0 + (LON1 - LON0) * i / (NX - 1)) for j in range(NZ) for i in range(NX)]
out = json.load(open('raw_elev.json')) if os.path.exists('raw_elev.json') else []
while len(out) < len(pts):
    chunk = pts[len(out):len(out) + 100]
    url = 'https://api.opentopodata.org/v1/srtm30m?locations=' + '|'.join(f'{a:.6f},{b:.6f}' for a, b in chunk)
    try:
        r = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'karmiel-game'}), timeout=60).read())
        out += [round(x['elevation'] or 0, 1) for x in r['results']]
        json.dump(out, open('raw_elev.json', 'w'))
    except Exception as e:
        print('retry', e)
    time.sleep(1.1)
json.dump({'lat0': LAT0, 'lat1': LAT1, 'lon0': LON0, 'lon1': LON1, 'nx': NX, 'nz': NZ, 'h': out}, open('raw_elev_grid.json', 'w'))
print('done', min(out), max(out))
