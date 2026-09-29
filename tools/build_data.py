"""Convert raw OSM + SRTM downloads into ../data.js for the game.

Run from tools/:  python build_data.py
Inputs : raw_osm.json, raw_roads.json, raw_elev_grid.json (see osm.py / elev.py)
World  : x = east, z = south, 1 unit = 1/S metres (S = world scale).
"""
import json, math, random

S = 0.7
LAT0, LON0 = 32.914, 35.2985
MX = math.cos(math.radians(LAT0)) * 111320 * S
MZ = 110900 * S
PLAY = dict(lat0=32.8945, lat1=32.9345, lon0=35.262, lon1=35.336)   # buildings / roads kept inside

def P(lat, lon):
    return round((lon - LON0) * MX, 1), round(-(lat - LAT0) * MZ, 1)

def inside(lat, lon, m=0.0):
    return PLAY['lat0'] - m < lat < PLAY['lat1'] + m and PLAY['lon0'] - m < lon < PLAY['lon1'] + m

def dp(pts, eps):
    """Douglas-Peucker simplification of a list of (x, z)."""
    if len(pts) < 3: return pts
    (ax, az), (bx, bz) = pts[0], pts[-1]
    dx, dz = bx - ax, bz - az; L = math.hypot(dx, dz) or 1e-9
    i, dmax = 0, 0
    for k in range(1, len(pts) - 1):
        d = abs((pts[k][0] - ax) * dz - (pts[k][1] - az) * dx) / L
        if d > dmax: i, dmax = k, d
    if dmax <= eps: return [pts[0], pts[-1]]
    return dp(pts[:i + 1], eps)[:-1] + dp(pts[i:], eps)

def dp_ring(pts, eps):
    """Simplify a closed ring (no repeated last point) by splitting at the farthest vertex."""
    i = max(range(len(pts)), key=lambda k: math.hypot(pts[k][0] - pts[0][0], pts[k][1] - pts[0][1]))
    if i == 0: return pts
    return dp(pts[:i + 1], eps)[:-1] + dp(pts[i:] + [pts[0]], eps)[:-1]

def area(pts):
    return abs(sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))) / 2

def flat(pts):
    return [c for p in pts for c in p]

osm = json.load(open('raw_osm.json', encoding='utf-8'))['elements']
roads_raw = json.load(open('raw_roads.json', encoding='utf-8'))['elements']
elev = json.load(open('raw_elev_grid.json'))
random.seed(1964)

# ---------------------------------------------------------------- landmarks
LANDMARK_WAYS = {124981105: 'kikar', 542836888: 'lev', 544563705: 'cityhall', 106949579: 'hutzot',
                 **{i: 'chet' for i in range(545612269, 545612276)}}   # "החתים" on Sha'ar HaGai St. — ח-shaped towers
POI = {}
def cen(e):
    if 'lat' in e: return e['lat'], e['lon']
    g = e.get('geometry') or []
    if g: return sum(p['lat'] for p in g) / len(g), sum(p['lon'] for p in g) / len(g)
    b = e['bounds']; return (b['minlat'] + b['maxlat']) / 2, (b['minlon'] + b['maxlon']) / 2
POI_IDS = {
    ('node', 2942466195): 'station', ('node', 3738656026): 'bus', ('way', 124981105): 'kikar', ('way', 542836888): 'lev',
    ('way', 544563705): 'cityhall', ('way', 106949579): 'hutzot', ('way', 265955255): 'big', ('way', 129120247): 'braude',
    ('way', 1396687679): 'amphi', ('way', 124928718): 'galilPark', ('way', 544391456): 'familyPark', ('way', 489658190): 'japanese',
    ('way', 159804629): 'makosh', ('node', 5299440408): 'schnitzelia', ('node', 278477793): 'kamon', ('node', 2009043919): 'kamonView',
    ('way', 124981801): 'rabinPark', ('way', 1469951883): 'eggedDepot',
}
for e in osm:
    k = POI_IDS.get((e['type'], e['id']))
    if k: POI[k] = P(*cen(e))

# ---------------------------------------------------------------- buildings
def ring_of(e):
    if e['type'] == 'way': return e.get('geometry')
    outers = [m for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
    return max(outers, key=lambda m: len(m['geometry']))['geometry'] if outers else None

BT = {'house': 1, 'detached': 1, 'semidetached_house': 1, 'terrace': 1, 'apartments': 2, 'residential': 2,
      'industrial': 3, 'warehouse': 3, 'service': 3, 'retail': 4, 'commercial': 4, 'school': 5, 'college': 5,
      'kindergarten': 5, 'public': 5, 'bunker': 6, 'synagogue': 7, 'mosque': 7, 'church': 7}
buildings = []
for e in osm:
    t = e.get('tags', {})
    if 'building' not in t or e['type'] not in ('way', 'relation'): continue
    g = ring_of(e)
    if not g or not inside(*cen({'geometry': g})): continue
    pts = [P(p['lat'], p['lon']) for p in g]
    if pts[0] == pts[-1]: pts = pts[:-1]
    pts = dp_ring(pts, 0.35)
    if len(pts) < 3: continue
    a = area(pts)
    if a < 6: continue
    typ = BT.get(t['building'], 0)
    if typ == 0:  # untagged "yes": guess from footprint (world units², S=0.7 → 1u² ≈ 2 m²)
        typ = 1 if a < 110 else 2 if a < 900 else 4
    lv = t.get('building:levels')
    try: lv = int(float(lv))
    except (TypeError, ValueError): lv = None
    if lv is None and 'height' in t:
        try: lv = max(1, round(float(t['height'].split()[0]) / 3))
        except ValueError: pass
    if lv is None:
        lv = {1: random.choice([1, 2, 2]), 2: random.choice([4, 4, 5, 6, 7, 8]), 3: 1, 4: 2, 5: 2, 6: 1, 7: 2}.get(typ, 2)
    lm = LANDMARK_WAYS.get(e['id'], '')
    buildings.append([typ, min(lv, 16), lm] + flat(pts))

# ---------------------------------------------------------------- roads (graph with junction nodes)
RC = {'motorway': 0, 'trunk': 0, 'primary': 1, 'secondary': 2, 'tertiary': 3, 'unclassified': 4, 'residential': 4,
      'living_street': 4, 'service': 5, 'pedestrian': 6}
node_use = {}
ways = []
for e in roads_raw:
    t = e['tags']; hw = t['highway'].replace('_link', '')
    if hw not in RC or 'geometry' not in e: continue
    if t.get('service') in ('parking_aisle', 'driveway') : continue
    g = e['geometry']
    if not any(inside(p['lat'], p['lon'], 0.004) for p in g): continue
    ways.append(e)
    for i, n in enumerate(e['nodes']):
        node_use[n] = node_use.get(n, 0) + (2 if i in (0, len(e['nodes']) - 1) else 1)
junction_id = {}
roads = []
for e in ways:
    t = e['tags']; cls = RC[t['highway'].replace('_link', '')]
    pts = [P(p['lat'], p['lon']) for p in e['geometry']]
    # keep junction nodes, simplify the rest lightly
    keep = [i for i, n in enumerate(e['nodes']) if node_use[n] >= 2]
    simp, js = [], []
    for i, (p, n) in enumerate(zip(pts, e['nodes'])):
        if i in keep or i in (0, len(pts) - 1) or not simp or math.hypot(p[0] - simp[-1][0], p[1] - simp[-1][1]) > 4:
            if node_use[n] >= 2:
                js += [len(simp), junction_id.setdefault(n, len(junction_id))]
            simp.append(p)
    oneway = 1 if t.get('oneway') == 'yes' or t.get('junction') == 'roundabout' else -1 if t.get('oneway') == '-1' else 0
    rb = 1 if t.get('junction') == 'roundabout' else 0
    roads.append([cls, oneway, rb, t.get('name', ''), js, flat(simp)])

# ---------------------------------------------------------------- rail
rails = []
for e in osm:
    t = e.get('tags', {})
    if t.get('railway') == 'rail' and 'geometry' in e and any(inside(p['lat'], p['lon'], 0.01) for p in e['geometry']):
        rails.append(flat(dp([P(p['lat'], p['lon']) for p in e['geometry']], 0.5)))

# ---------------------------------------------------------------- areas (ground colours / tree scatter)
AREA = {('leisure', 'park'): 'park', ('leisure', 'garden'): 'park', ('leisure', 'playground'): 'park', ('landuse', 'grass'): 'grass',
        ('leisure', 'pitch'): 'pitch', ('landuse', 'forest'): 'forest', ('natural', 'wood'): 'forest', ('natural', 'scrub'): 'scrub',
        ('landuse', 'orchard'): 'orchard', ('landuse', 'meadow'): 'grass', ('landuse', 'farmland'): 'farm', ('landuse', 'retail'): 'retail',
        ('landuse', 'commercial'): 'retail', ('landuse', 'industrial'): 'industrial', ('amenity', 'parking'): 'parking',
        ('landuse', 'residential'): 'residential', ('railway', 'platform'): 'platform', ('landuse', 'cemetery'): 'grass'}
areas = []
for e in osm:
    if e['type'] != 'way' or 'geometry' not in e: continue
    t = e.get('tags', {})
    cls = next((v for (k, val), v in AREA.items() if t.get(k) == val), None)
    if not cls: continue
    g = e['geometry']
    if g[0] != g[-1] and cls != 'platform': continue
    if not any(inside(p['lat'], p['lon'], 0.01) for p in g): continue
    pts = [P(p['lat'], p['lon']) for p in g]
    if pts[0] == pts[-1]: pts = pts[:-1]
    pts = dp_ring(pts, 1.0)
    if len(pts) < 3: continue
    areas.append([cls] + flat(pts))

# ---------------------------------------------------------------- place names (neighbourhoods / villages)
places, seen = [], set()
for e in json.load(open('raw_places.json', encoding='utf-8'))['elements']:
    t = e['tags']; c = e.get('center', e); nm = t.get('name:he') or t.get('name')
    if nm in seen or not inside(c['lat'], c['lon'], 0.003): continue
    seen.add(nm); x, z = P(c['lat'], c['lon'])
    places.append([nm, x, z, 1 if t['place'] in ('neighbourhood', 'quarter', 'suburb') else 0])

# ---------------------------------------------------------------- terrain
x0, z0 = P(elev['lat0'], elev['lon0']); x1, z1 = P(elev['lat1'], elev['lon1'])
bx0, bz0 = P(PLAY['lat1'], PLAY['lon0']); bx1, bz1 = P(PLAY['lat0'], PLAY['lon1'])
data = dict(
    S=S, elev=dict(x0=x0, z0=z0, x1=x1, z1=z1, nx=elev['nx'], nz=elev['nz'], h=elev['h']),
    bounds=dict(x0=bx0, z0=bz0, x1=bx1, z1=bz1), poi=POI, places=places, b=buildings, r=roads, rail=rails, a=areas,
)
txt = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
open('../src/data.js', 'w', encoding='utf-8').write('// Generated by tools/build_data.py from OpenStreetMap (ODbL) + SRTM. Do not edit.\nexport const KDATA = ' + txt + ';\n')
print(f'buildings {len(buildings)} roads {len(roads)} junctions {len(junction_id)} rails {len(rails)} areas {len(areas)} size {len(txt)//1024}KB')
print('bounds', data['bounds']); print('poi', POI)
