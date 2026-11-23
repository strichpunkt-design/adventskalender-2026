# Plätzchen-Simulator: cookie shapes and toppings, modelled in Blender and rendered one by one.
# Each item is rendered on a transparent background (with its shadow) for the catalogue and the topping bar.
# Usage: python tools/cookie_assets.py <out folder> [samples] [size] [only=id,id]
# Needs the bpy module (pip install bpy, Python 3.13) and shapely.
import bpy, math, random, sys, os
from mathutils import Vector
from shapely.geometry import Polygon, Point, box, MultiPolygon
from shapely.ops import unary_union
from shapely import affinity

args = sys.argv[1:]
OUT = args[0] if args else 'out'
SAMPLES = int(args[1]) if len(args) > 1 else 40
SIZE = int(args[2]) if len(args) > 2 else 512
ONLY = args[3][5:].split(',') if len(args) > 3 and args[3].startswith('only=') else None
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
mm = 0.001

# ---------------- materials ----------------
def hexc(h): return tuple(((int(h[i:i + 2], 16) / 255) ** 2.2) for i in (1, 3, 5))
def mat(name, color, rough=0.5, metal=0.0, coat=0.0, sss=0.0, trans=0.0, bump=None, ramp=None, emit=None):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name); nt = m.node_tree if m.node_tree else None
    if nt is None: m.use_nodes = True; nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*hexc(color), 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal; b.inputs['Coat Weight'].default_value = coat
    b.inputs['Subsurface Weight'].default_value = sss; b.inputs['Transmission Weight'].default_value = trans
    if sss: b.inputs['Subsurface Radius'].default_value = (0.004, 0.002, 0.001)
    if ramp:
        m['ramp'] = '|'.join(map(str, ramp))
        n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = ramp[2]; n.inputs['Detail'].default_value = 8
        r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].color = (*hexc(ramp[0]), 1); r.color_ramp.elements[1].color = (*hexc(ramp[1]), 1)
        nt.links.new(n.outputs['Fac'], r.inputs['Fac']); nt.links.new(r.outputs['Color'], b.inputs['Base Color'])
    if bump:
        n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = bump[0]; n.inputs['Detail'].default_value = 12
        bm = nt.nodes.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = bump[1]; bm.inputs['Distance'].default_value = bump[2]
        nt.links.new(n.outputs['Fac'], bm.inputs['Height']); nt.links.new(bm.outputs['Normal'], b.inputs['Normal'])
    return m

DOUGH = lambda: mat('dough', '#D9A35E', .75, bump=(900, .45, .0015), ramp=('#C8873F', '#E6B676', 420))
GINGER = lambda: mat('ginger', '#7A4521', .7, bump=(700, .5, .0015), ramp=('#5E3317', '#8C5228', 300))
CHOCO_D = lambda: mat('chocodough', '#4A2A1A', .7, bump=(800, .4, .0015), ramp=('#3A1F12', '#5A3522', 300))

# ---------------- helpers ----------------
def link(ob): sc.collection.objects.link(ob); return ob
def active(ob):
    for o in bpy.context.selected_objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True); return ob
def to_mesh(ob): active(ob); bpy.ops.object.convert(target='MESH'); return bpy.context.view_layer.objects.active
def mod(ob, kind, **kw):
    m = ob.modifiers.new(kind, kind)
    for k, v in kw.items(): setattr(m, k, v)
    return m
def smooth(ob): active(ob); bpy.ops.object.shade_smooth(); return ob
def give(ob, m): ob.data.materials.clear(); ob.data.materials.append(m); return ob
def clouds(scale):
    t = bpy.data.textures.new('c', 'CLOUDS'); t.noise_scale = scale; return t

def sphere(r, loc=(0, 0, 0), scale=(1, 1, 1), m=None, seg=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=seg, ring_count=seg // 2)
    o = bpy.context.object; o.scale = scale; smooth(o)
    if m: give(o, m)
    return o

def tube(points, radius, m, taper=None, closed=False, res=12):
    """A round tube along 3D points (metres). taper: radius factor per point."""
    cu = bpy.data.curves.new('t', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius; cu.bevel_resolution = 6
    cu.use_fill_caps = True; cu.resolution_u = res
    sp = cu.splines.new('NURBS'); sp.points.add(len(points) - 1); sp.use_endpoint_u = not closed; sp.use_cyclic_u = closed; sp.order_u = 4
    for i, (p, q) in enumerate(zip(sp.points, points)):
        p.co = (*q, 1); p.radius = taper[i] if taper else 1
    o = link(bpy.data.objects.new('t', cu)); give(o, m); o = to_mesh(o); smooth(o); return o

def metaballs(elems, m, res=0.0008):
    """A soft blob made of balls and ellipsoids: joined, remeshed and smoothed so the parts melt together."""
    parts = []
    for e in elems:
        co, r = e[1], e[2]; sz = e[3] if len(e) > 3 else (1, 1, 1)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=co, segments=32, ring_count=16); o = bpy.context.object; o.scale = sz
        bpy.ops.object.transform_apply(scale=True); parts.append(o)
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); o = parts[0]
    mod(o, 'REMESH', mode='VOXEL', voxel_size=res * 0.6); mod(o, 'SMOOTH', factor=1, iterations=12)
    give(o, m); smooth(o); return o

def flat_shape(geom, extrude, bevel, m, lumpy=True, z=None):
    """Extrude a shapely outline (metres) into a rounded slab, like rolled-out dough."""
    cu = bpy.data.curves.new('s', 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = 'BOTH'
    cu.extrude, cu.bevel_depth, cu.bevel_resolution = extrude, bevel, 4
    polys = geom.geoms if isinstance(geom, MultiPolygon) else [geom]
    for pg in polys:
        for ring in [pg.exterior, *pg.interiors]:
            pts = list(ring.coords)[:-1]
            sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1); sp.use_cyclic_u = True
            for p, (x, y) in zip(sp.points, pts): p.co = (x, y, 0, 1)
    o = to_mesh(link(bpy.data.objects.new('s', cu)))
    o.location.z = z if z is not None else extrude + bevel
    if lumpy:
        mod(o, 'REMESH', mode='VOXEL', voxel_size=0.00045)
        mod(o, 'DISPLACE', texture=clouds(0.006), strength=0.0007, mid_level=0.5)
        mod(o, 'SMOOTH', factor=0.5, iterations=4)
    give(o, m); smooth(o); return o

# Pieces: things that fall separately in the game (each sprinkle, each pearl, each googly eye).
# mark() tags every object made since the last call as one piece; untagged objects form one piece together.
_pid = [0]
def mark():
    _pid[0] += 1
    for o in bpy.data.objects:
        if 'piece' not in o: o['piece'] = _pid[0]

def rounded(g, r): return g.buffer(-r).buffer(2 * r).buffer(-r)

# ---------------- shapes (about 8 cm) ----------------
def semicolon_geom():
    C = [((200, 250), (178, 250), (222, 250)), ((240, 290), (240, 268), (240, 342)), ((178, 400), (220, 378), (175, 395)),
         ((168, 386), (171, 391), (194, 368)), ((204, 330), (204, 350), (182, 330)), ((160, 290), (160, 312), (160, 268))]
    pts = []
    for i, (co, hl, hr) in enumerate(C):
        a, c1 = Vector(co), Vector(hr); nx = C[(i + 1) % len(C)]; c2, b = Vector(nx[1]), Vector(nx[0])
        for k in range(24):
            t = k / 24; p = (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * b
            pts.append(((p.x - 200) * 0.0003, -(p.y - 275) * 0.0003))
    return unary_union([Polygon(pts), Point(0, (275 - 150) * 0.0003).buffer(40 * 0.0003, 48)])
def star_geom(n=5, R=0.044, r=0.02):
    return rounded(Polygon([((R if i % 2 == 0 else r) * math.sin(i * math.pi / n), (R if i % 2 == 0 else r) * math.cos(i * math.pi / n)) for i in range(2 * n)]), R * 0.07)
def _unused(n, R, r):
    return rounded(Polygon([((R if i % 2 == 0 else r) * math.sin(i * math.pi / n), (R if i % 2 == 0 else r) * math.cos(i * math.pi / n)) for i in range(2 * n)]), 0.003)
def tree_geom():
    t = [Polygon([(-w, y0), (w, y0), (0, y0 + h)]) for w, y0, h in ((0.034, -0.026, 0.04), (0.027, -0.004, 0.034), (0.019, 0.016, 0.029))]
    return rounded(unary_union(t + [box(-0.007, -0.04, 0.007, -0.02)]), 0.0025)
def heart_geom():
    pts = [(16 * math.sin(t) ** 3, 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)) for t in [i / 200 * 2 * math.pi for i in range(200)]]
    return rounded(Polygon([(x * 0.0026, y * 0.0026 + 0.004) for x, y in pts]), 0.002)
def moon_geom():
    return rounded(Point(0, 0).buffer(0.04, 64).difference(Point(0.021, 0.012).buffer(0.035, 64)), 0.003)
def man_geom():
    parts = [Point(0, 0.03).buffer(0.0135, 48), box(-0.013, -0.018, 0.013, 0.02),
             affinity.rotate(box(-0.034, 0.004, 0, 0.015), 12, origin=(0, 0.01)), affinity.rotate(box(0, 0.004, 0.034, 0.015), -12, origin=(0, 0.01)),
             affinity.rotate(box(-0.016, -0.045, -0.003, -0.01), -12, origin=(-0.01, -0.012)), affinity.rotate(box(0.003, -0.045, 0.016, -0.01), 12, origin=(0.01, -0.012))]
    return rounded(unary_union(parts).buffer(0.002), 0.004)

TH, BV = 0.0028, 0.0018
def cookie(geom, m=None):
    return flat_shape(geom, TH, BV, m or DOUGH())

def shape_man():
    o = cookie(man_geom(), GINGER())
    ic = mat('icing_w', '#F7F4EE', .3, coat=.3, sss=.1)
    for x, y in ((-0.005, 0.033), (0.005, 0.033)): sphere(0.0016, (x, y, 2 * (TH + BV) - 0.0003), (1, 1, .5), ic)
    tube([(-0.006, 0.025, 0), (-0.002, 0.022, 0), (0.002, 0.022, 0), (0.006, 0.025, 0)], 0.0008, ic).location.z = 2 * (TH + BV) - 0.0002
    for y in (0.012, 0.004, -0.004): sphere(0.0019, (0, y, 2 * (TH + BV) - 0.0003), (1, 1, .5), ic)

# ---------------- toppings ----------------
LILAC, WHITE = '#B78CFF', '#F7F4EE'
def piped(color, name, turns=2.6, r0=0.011, h=0.012, rad=0.0042):
    """A piped swirl, like icing from a bag."""
    pts, tp = [], []
    N = 60
    for i in range(N):
        t = i / (N - 1); a = t * turns * 2 * math.pi; r = r0 * (1 - 0.85 * t)
        pts.append((r * math.cos(a), r * math.sin(a), rad * 0.8 + h * t ** 1.3)); tp.append(1 - 0.7 * t ** 2)
    o = tube(pts, rad, mat(name, color, .25, coat=.5, sss=.15, bump=(140, .06, .0004)), tp)
    o = to_mesh(o); mod(o, 'REMESH', mode='VOXEL', voxel_size=0.0004); mod(o, 'SMOOTH', factor=.7, iterations=6); smooth(o)
    return o
SPRINKLE_COLS = ['#F7F4EE', '#141414', '#8F5CF0', '#E2231A']
def sprinkles(n=70, spread=0.018, cols=SPRINKLE_COLS):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.00055, depth=0.0045); base = bpy.context.object
    mod(base, 'BEVEL', width=0.0005, segments=3); smooth(base)
    meshes = []
    for c in cols:
        me = base.data.copy(); me.materials.append(mat('spr' + c, c, .3, coat=.3)); meshes.append(me)
    random.seed(3)
    for i in range(n):
        o = link(bpy.data.objects.new('s', random.choice(meshes))); md = o.modifiers.new('b', 'BEVEL'); md.width, md.segments = 0.0005, 3
        r = spread * math.sqrt(random.random()); a = random.uniform(0, 6.28); z = 0.0006 + (spread - r) * 0.35 * random.random()
        o.location = (r * math.cos(a), r * math.sin(a), z); o.rotation_euler = (math.pi / 2 + random.uniform(-.3, .3), 0, random.uniform(0, 3.14))
        if n > 1: mark()
    bpy.data.objects.remove(base)
def pile(make, n, spread, h=0.35, seed=4):
    random.seed(seed)
    for i in range(n):
        r = spread * math.sqrt(random.random()); a = random.uniform(0, 6.28)
        make((r * math.cos(a), r * math.sin(a), (spread - r) * h * random.random()), i); mark()

def t_icing_lilac(): piped(LILAC, 'icing_l')
def t_icing_white(): piped(WHITE, 'icing_w2')
def t_sprinkles(): sprinkles()
def t_pearls():
    m = mat('pearl', '#E8E8EA', .12, metal=1)
    pile(lambda p, i: sphere(0.0013, (p[0], p[1], p[2] + 0.0013), m=m, seg=24), 60, 0.016)
def t_lentils():
    cols = ['#E2231A', '#F2C230', '#2E7D32', '#1E5BD8', '#8F5CF0', '#E8772E', '#6B3A1E']
    pile(lambda p, i: setattr(sphere(0.0065, (p[0], p[1], p[2] * 1.4 + 0.0028), (1, 1, .42), mat('len' + cols[i % 7], cols[i % 7], .18, coat=.8)), 'rotation_euler', (random.uniform(-.4, .4), random.uniform(-.4, .4), 0)), 16, 0.02, .5)
def t_almond():
    m = mat('almond', '#EAD6B0', .55, bump=(300, .3, .0006), ramp=('#E2C99B', '#F1E2C6', 80))
    for i, (x, y, a) in enumerate(((-0.012, 0, .3), (0.008, 0.006, -.6), (0.004, -0.012, 1.4))):
        o = sphere(0.009, (x, y, 0.0022), (1, .62, .27), m); o.rotation_euler.z = a
        bm = o.modifiers.new('t', 'SIMPLE_DEFORM'); bm.deform_method = 'TAPER'; bm.factor = .5; bm.deform_axis = 'X'; mark()
def t_cherry():
    # candied cherries: deep red, glassy, a dimple on top with a thin stalk
    m = mat('cherry', '#7E0711', .06, coat=1, sss=.55, ramp=('#5E040C', '#B3101C', 18))
    stalk = mat('stalk2', '#6E6A2E', .55, ramp=('#4F5A22', '#8A7A3C', 40))
    for x, y, bend in ((-0.009, 0, 1), (0.009, 0.004, -1)):
        o = sphere(0.0085, (x, y, 0.0078), (1, 1, .9), m, 48)
        sm = o.modifiers.new('dimple', 'DISPLACE'); sm.strength = 0  # placeholder keeps stack simple
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0024, location=(x, y, 0.0078 + 0.0085 * .9 + 0.0006)); dim = bpy.context.object
        b = o.modifiers.new('cut', 'BOOLEAN'); b.object = dim; b.operation = 'DIFFERENCE'
        active(o); bpy.ops.object.modifier_apply(modifier='cut'); bpy.data.objects.remove(dim, do_unlink=True); smooth(o)
        z0 = 0.0078 + 0.0085 * .9 - 0.0012
        tube([(x, y, z0), (x + bend * 0.0015, y, z0 + 0.008), (x + bend * 0.006, y + 0.002, z0 + 0.016), (x + bend * 0.013, y + 0.004, z0 + 0.02)], 0.00075, stalk, [1.1, 1, .9, .8])
        mark()
def t_powder():
    bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.022, depth=0.011, location=(0, 0, 0.0055)); o = bpy.context.object
    mod(o, 'SUBSURF', levels=3, render_levels=3); mod(o, 'DISPLACE', texture=clouds(0.004), strength=0.0012)
    give(o, mat('powder', '#FBFAF7', .95, sss=.3, bump=(1600, .6, .0004))); smooth(o)
def t_hail():
    m = mat('hail', '#FFFFFF', .35, sss=.5, trans=.2)
    random.seed(9)
    def chunk(p, i):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.0016, location=(p[0], p[1], p[2] + 0.0014)); o = bpy.context.object
        o.scale = (random.uniform(.7, 1.3), random.uniform(.7, 1.3), random.uniform(.6, 1)); o.rotation_euler = (random.random() * 3, random.random() * 3, random.random() * 3)
        give(o, m); mod(o, 'BEVEL', width=0.0003, segments=2)
    pile(chunk, 70, 0.016)
def t_choc():
    m = mat('choc', '#3B1F12', .18, coat=.6)
    metaballs([('ELLIPSOID', (0, 0, 0.001), 0.02, (1, .8, .12)), ('ELLIPSOID', (0.013, 0.008, 0.001), 0.011, (1, 1, .15))], m)
    pts = [(-0.022 + i * 0.0045, (0.012 if i % 2 else -0.012) + random.uniform(-.002, .002), 0.0035) for i in range(11)]
    tube(pts, 0.0012, m)
def t_jam():
    m = mat('jam', '#B3122B', .08, coat=1, trans=.55, sss=.3)
    metaballs([('BALL', (0, 0, 0.002), 0.016), ('BALL', (0.009, 0.006, 0.0015), 0.011), ('BALL', (-0.008, 0.004, 0.0018), 0.01)], m, 0.0007).scale.z = 0.35
def t_goldstars():
    m = mat('gold', '#E6B84A', .22, metal=1)
    random.seed(5)
    for i in range(14):
        r = 0.018 * math.sqrt(random.random()); a = random.uniform(0, 6.28)
        o = flat_shape(star_geom(5, 0.0045, 0.002), 0.0006, 0.0003, m, lumpy=False, z=0.0012 + random.random() * 0.002)
        o.location.x, o.location.y = r * math.cos(a), r * math.sin(a); o.rotation_euler = (random.uniform(-.3, .3), random.uniform(-.3, .3), random.uniform(0, 6)); mark()

# --- weird and funny ---
def t_pickle():
    m = mat('pickle', '#6F7F2A', .35, coat=.4, sss=.2, bump=(120, .5, .0012), ramp=('#5D6B22', '#8C9A3A', 60))
    pts = [(-0.03, -0.006, 0.008), (-0.012, 0.004, 0.009), (0.012, 0.004, 0.009), (0.03, -0.006, 0.008)]
    o = tube(pts, 0.0085, m, [.55, 1, 1, .55], res=24); o = to_mesh(o)
    mod(o, 'REMESH', mode='VOXEL', voxel_size=0.0006); mod(o, 'DISPLACE', texture=clouds(0.003), strength=0.0007); mod(o, 'SMOOTH', factor=.6, iterations=3); smooth(o)
def t_gummy():
    m = mat('gummy', '#E0242E', .2, coat=.5, trans=.7, sss=.4)
    B = [('ELLIPSOID', (0, 0, 0.007), 0.009, (1, 1.25, .7)), ('BALL', (0, 0.013, 0.008), 0.0075), ('BALL', (-0.0055, 0.0185, 0.008), 0.0035), ('BALL', (0.0055, 0.0185, 0.008), 0.0035),
         ('ELLIPSOID', (-0.009, 0.003, 0.007), 0.004, (1.3, .8, .8)), ('ELLIPSOID', (0.009, 0.003, 0.007), 0.004, (1.3, .8, .8)),
         ('ELLIPSOID', (-0.006, -0.011, 0.006), 0.0045, (1, 1.2, .9)), ('ELLIPSOID', (0.006, -0.011, 0.006), 0.0045, (1, 1.2, .9))]
    o = metaballs(B, m, 0.0005); o.rotation_euler.z = 0.3
def t_sprout():
    m = mat('sprout', '#7FA43A', .45, sss=.2, bump=(90, .6, .0015), ramp=('#5E8A2A', '#B5CF6A', 40))
    o = sphere(0.012, (0, 0, 0.012), (1, 1, .95), m, 48)
    vt = bpy.data.textures.new('v', 'VORONOI'); vt.noise_scale = 0.006
    mod(o, 'DISPLACE', texture=vt, strength=-0.0012)
    for a in (0.5, 2.6, 4.4):   # loose outer leaves
        lf = sphere(0.0105, (0.0028 * math.cos(a), 0.0028 * math.sin(a), 0.011), (1.05, 1.05, .9), m, 48); lf.rotation_euler = (0.25 * math.sin(a), -0.25 * math.cos(a), 0)
        mod(lf, 'BOOLEAN', object=None) if False else None
    sphere(0.0035, (0, -0.011, 0.006), (1, 1, 1), mat('stem', '#D9E3A6', .6)).rotation_euler.x = 1.2
def t_egg():
    w = mat('eggwhite', '#FBF8F1', .25, coat=.3, sss=.4)
    random.seed(2)
    metaballs([('ELLIPSOID', (0, 0, 0.0012), 0.022, (1, .9, .1))] + [('ELLIPSOID', (0.02 * math.cos(a), 0.018 * math.sin(a), 0), 0.009, (1, 1, .2)) for a in [i * 1.05 + random.random() * .3 for i in range(6)]], w, 0.0009)
    sphere(0.0075, (0.003, 0.002, 0.003), (1, 1, .6), mat('yolk', '#F4A00F', .15, coat=.8, sss=.6))
def t_fishstick():
    m = mat('crumb', '#D58A3A', .85, bump=(260, 1.2, .0012), ramp=('#C2702A', '#E8A653', 120))
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.0065)); o = bpy.context.object; o.scale = (0.05, 0.015, 0.012)
    bpy.ops.object.transform_apply(scale=True); mod(o, 'BEVEL', width=0.003, segments=4); mod(o, 'SUBSURF', levels=2, render_levels=2)
    mod(o, 'DISPLACE', texture=clouds(0.0015), strength=0.0006); give(o, m); smooth(o); o.rotation_euler.z = 0.35
def t_paperclip():
    m = mat('clip', '#C9CCD1', .2, metal=1)
    pts = [(0.02, -0.004, 0), (0.02, 0.004, 0), (0.024, 0.004, 0), (0.024, -0.007, 0), (-0.022, -0.007, 0), (-0.026, -0.004, 0), (-0.026, 0.004, 0),
           (-0.022, 0.007, 0), (0.026, 0.007, 0), (0.029, 0.004, 0), (0.029, -0.004, 0), (0.026, -0.0095, 0), (-0.014, -0.0095, 0)]
    pts = [(x * 1.05, y * 1.05, 0.0007) for x, y, _ in [(-p[0], p[1], p[2]) for p in pts]]
    o = tube(pts, 0.0006, m); o.rotation_euler.z = 0.5
def t_coffee():
    m = mat('bean', '#3E2416', .4, coat=.3, bump=(180, .2, .0005))
    for x, y, a in ((-0.008, 0.002, .4), (0.007, -0.004, -.7), (0.002, 0.011, 1.8)):
        o = sphere(0.0062, (x, y, 0.0034), (1, .75, .55), m); o.rotation_euler.z = a
        ca, sa = math.cos(a), math.sin(a)
        tube([(x + ca * u - sa * v, y + sa * u + ca * v, 0.0034 + 0.0062 * .55 * (1 - (u / 0.0062) ** 2) ** .5 - 0.0002) for u, v in ((-0.0048, 0.0005), (-0.0016, -0.0006), (0.0016, 0.0006), (0.0048, -0.0005))], 0.0005, mat('beancrease', '#1E120A', .6)); mark()
def t_tinsel():
    m = mat('tinsel', '#D8DCE3', .12, metal=1)
    random.seed(7)
    for k in range(9):
        cu = bpy.data.curves.new('ti', 'CURVE'); cu.dimensions = '3D'; cu.extrude = 0.0007
        sp = cu.splines.new('NURBS'); n = 9; sp.points.add(n - 1); sp.use_endpoint_u = True; sp.order_u = 4
        x0, a = random.uniform(-0.01, 0.01), random.uniform(-.5, .5)
        for i, p in enumerate(sp.points):
            t = i / (n - 1) - .5; p.co = (x0 + t * 0.06 * math.cos(a) + random.uniform(-.003, .003), t * 0.06 * math.sin(a) + random.uniform(-.006, .006), 0.0008 + random.uniform(0, .004), 1)
            p.tilt = random.uniform(0, 3)
        o = link(bpy.data.objects.new('ti', cu)); give(o, m); to_mesh(o); mark()
def t_pretzel():
    m = mat('pretzel', '#7B3E12', .25, coat=.7, bump=(200, .2, .0005), ramp=('#5E2C0B', '#9A5420', 70))
    s = 0.0011
    pts = [(-2, -8), (-8, -4), (-11, 4), (-7, 11), (0, 10), (4, 3), (6, -6), (8, -11), (11, -12)]
    pts = [(x * s * 2, y * s * 2, 0.004) for x, y in pts]
    tube(pts, 0.0042, m, res=24)
    tube([(-x, y, z) for x, y, z in pts], 0.0042, m, res=24)
    tube([(-0.011, 0.004, 0.0042), (0, 0.007, 0.0046), (0.011, 0.004, 0.0042)], 0.004, m)
    salt = mat('salt', '#FFFFFF', .3, sss=.4); random.seed(11)
    for i in range(16):
        p = random.choice(pts); bpy.ops.mesh.primitive_cube_add(size=0.0014, location=(p[0] * random.choice((1, -1)) + random.uniform(-.002, .002), p[1] + random.uniform(-.002, .002), 0.0082))
        o = bpy.context.object; o.rotation_euler = (random.random(), random.random(), random.random()); give(o, salt)
def t_chili():
    m = mat('chili', '#C4140F', .15, coat=.8, sss=.2)
    pts = [(-0.024, 0.002, 0.007), (-0.01, -0.003, 0.0075), (0.006, -0.002, 0.0065), (0.018, 0.004, 0.005), (0.026, 0.012, 0.004)]
    tube(pts, 0.0075, m, [1, 1, .8, .45, .12], res=24)
    tube([(-0.024, 0.002, 0.007), (-0.029, 0.003, 0.0085), (-0.033, 0.007, 0.0095)], 0.0016, mat('stalk', '#4E7A2A', .5))
def t_popcorn():
    m = mat('popcorn', '#F6E7C1', .7, sss=.3, bump=(150, .4, .0008), ramp=('#EDD69C', '#FFF7E6', 50))
    random.seed(8)
    for k, (cx, cy) in enumerate(((-0.01, 0), (0.009, 0.004), (0, -0.012))):
        el = [('BALL', (cx + random.uniform(-.004, .004), cy + random.uniform(-.004, .004), 0.006 + random.uniform(0, .004)), random.uniform(.0035, .005)) for _ in range(9)]
        o = metaballs(el, m, 0.0006); mod(o, 'DISPLACE', texture=clouds(0.0022), strength=0.0012); mark()
def t_eyes():
    w = mat('eyewhite', '#FFFFFF', .35); b = mat('pupil', '#0A0A0A', .3); g = mat('dome', '#FFFFFF', .02, trans=1)
    for x, px in ((-0.0085, 0.0025), (0.0085, -0.002)):
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.0075, depth=0.0012, location=(x, 0, 0.0006)); give(bpy.context.object, w)
        bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.0036, depth=0.0006, location=(x + px, -0.0022, 0.0015)); give(bpy.context.object, b)
        sphere(0.0075, (x, 0, 0.0012), (1, 1, .38), g); mark()
def t_mustard(): piped('#E3B21A', 'mustard', turns=2.2, r0=0.01, h=0.009, rad=0.0036)
def t_ketchup(): piped('#B5150E', 'ketchup', turns=2.2, r0=0.01, h=0.009, rad=0.0036)
def t_garlic():
    m = mat('garlic', '#F3EBDD', .5, sss=.5, bump=(60, .4, .0008), ramp=('#E9DCC4', '#FBF6EE', 30))
    for x, y, a in ((-0.008, 0, .3), (0.008, 0.003, -.5)):
        o = sphere(0.009, (x, y, 0.006), (.7, 1, .62), m); o.rotation_euler.z = a
        sd = o.modifiers.new('t', 'SIMPLE_DEFORM'); sd.deform_method = 'TAPER'; sd.factor = 1.2; sd.deform_axis = 'Y'; mark()
def t_sardine():
    m = mat('sardine', '#9AA7B3', .25, metal=.5, coat=.6, bump=(220, .2, .0004), ramp=('#5C6B7A', '#D9E0E6', 40))
    o = sphere(0.007, (0, 0, 0.0045), (3.6, 1, .65), m, 48)
    sd = o.modifiers.new('t', 'SIMPLE_DEFORM'); sd.deform_method = 'TAPER'; sd.factor = -.35; sd.deform_axis = 'X'
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.006, depth=0.0015, location=(0.028, 0, 0.0045)); tail = bpy.context.object
    tail.rotation_euler = (0, math.pi / 2, 0); tail.scale = (1, 1.2, 1); give(tail, m)
    sphere(0.0011, (-0.019, 0.0045, 0.006), m=mat('pupil', '#0A0A0A', .3))
    o.rotation_euler.z = tail.rotation_euler.z = 0
def t_bigsprinkle():   # one ridiculously large sprinkle
    sprinkles(1, 0, ['#8F5CF0']); o = [x for x in sc.objects if x.type == 'MESH'][-1]; o.scale = (9, 9, 7); o.location = (0, 0, 0.0045); o.rotation_euler = (math.pi / 2, 0, 0.4)

ITEMS = [
    # id, group, German, English, builder
    ('semikolon', 'form', 'Strichpunkt', 'Semicolon', lambda: cookie(semicolon_geom())),
    ('stern', 'form', 'Stern', 'Star', lambda: cookie(star_geom())),
    ('baum', 'form', 'Tannenbaum', 'Christmas tree', lambda: cookie(tree_geom())),
    ('herz', 'form', 'Herz', 'Heart', lambda: cookie(heart_geom())),
    ('mond', 'form', 'Halbmond', 'Crescent', lambda: cookie(moon_geom())),
    ('mann', 'form', 'Lebkuchenmann', 'Gingerbread man', shape_man),
    ('stern-schoko', 'form', 'Schoko-Stern', 'Chocolate star', lambda: cookie(star_geom(8, 0.04, 0.026), CHOCO_D())),
    ('guss-lila', 'klassisch', 'Zuckerguss lila', 'Lilac icing', t_icing_lilac),
    ('guss-weiss', 'klassisch', 'Zuckerguss weiß', 'White icing', t_icing_white),
    ('streusel', 'klassisch', 'Streusel', 'Sprinkles', t_sprinkles),
    ('perlen', 'klassisch', 'Silberperlen', 'Silver pearls', t_pearls),
    ('linsen', 'klassisch', 'Schokolinsen', 'Chocolate buttons', t_lentils),
    ('mandeln', 'klassisch', 'Mandeln', 'Almonds', t_almond),
    ('kirschen', 'klassisch', 'Belegkirschen', 'Glacé cherries', t_cherry),
    ('puder', 'klassisch', 'Puderzucker', 'Icing sugar', t_powder),
    ('hagel', 'klassisch', 'Hagelzucker', 'Pearl sugar', t_hail),
    ('schoko', 'klassisch', 'Schokoglasur', 'Chocolate glaze', t_choc),
    ('marmelade', 'klassisch', 'Marmelade', 'Jam', t_jam),
    ('goldsterne', 'klassisch', 'Goldsterne', 'Gold stars', t_goldstars),
    ('gurke', 'schraeg', 'Gewürzgurke', 'Pickle', t_pickle),
    ('gummibaer', 'schraeg', 'Gummibärchen', 'Gummy bear', t_gummy),
    ('rosenkohl', 'schraeg', 'Rosenkohl', 'Brussels sprout', t_sprout),
    ('spiegelei', 'schraeg', 'Spiegelei', 'Fried egg', t_egg),
    ('fischstaebchen', 'schraeg', 'Fischstäbchen', 'Fish finger', t_fishstick),
    ('senf', 'schraeg', 'Senf', 'Mustard', t_mustard),
    ('ketchup', 'schraeg', 'Ketchup', 'Ketchup', t_ketchup),
    ('knoblauch', 'schraeg', 'Knoblauch', 'Garlic', t_garlic),
    ('sardine', 'schraeg', 'Sardine', 'Sardine', t_sardine),
    ('chili', 'schraeg', 'Chili', 'Chilli', t_chili),
    ('popcorn', 'schraeg', 'Popcorn', 'Popcorn', t_popcorn),
    ('brezel', 'schraeg', 'Salzbrezel', 'Pretzel', t_pretzel),
    ('augen', 'schraeg', 'Wackelaugen', 'Googly eyes', t_eyes),
    ('bueroklammer', 'schraeg', 'Büroklammer', 'Paper clip', t_paperclip),
    ('kaffee', 'schraeg', 'Kaffeebohnen', 'Coffee beans', t_coffee),
    ('lametta', 'schraeg', 'Lametta', 'Tinsel', t_tinsel),
    ('riesenstreusel', 'schraeg', 'Ein Riesenstreusel', 'One giant sprinkle', t_bigsprinkle),
]

# ---------------- stage: soft light, shadow on transparent ground ----------------
def render_item(iid, build):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    build()
    bpy.context.view_layer.update()
    lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in sc.objects:
        if o.type not in ('MESH', 'CURVE', 'META'): continue
        for c in o.evaluated_get(dg).bound_box:
            w = o.matrix_world @ Vector(c); lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    ctr = (lo + hi) / 2; size = max(hi.x - lo.x, hi.y - lo.y, (hi.z - lo.z) * 1.4)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(ctr.x, ctr.y, 0)); g = bpy.context.object; g.is_shadow_catcher = True
    bpy.ops.object.light_add(type='AREA', location=(ctr.x - 0.25, ctr.y + 0.2, 0.45)); L = bpy.context.object
    L.data.energy, L.data.size = 6, 0.3; L.rotation_euler = (math.radians(30), math.radians(-30), math.radians(-40))
    bpy.ops.object.light_add(type='AREA', location=(ctr.x + 0.3, ctr.y - 0.25, 0.25)); F = bpy.context.object
    F.data.energy, F.data.size = 1.6, 0.6; F.rotation_euler = (math.radians(-50), math.radians(45), 0)
    cd = bpy.data.cameras.new('cam'); cam = link(bpy.data.objects.new('cam', cd)); sc.camera = cam
    cd.lens = 70; cd.clip_start = 0.002
    dist = size / (36 / 70) * 1.25
    d = Vector((0, -math.sin(math.radians(52)), math.cos(math.radians(52))))
    cam.location = ctr + d * dist; cam.rotation_euler = (math.radians(52), 0, 0)
    sc.render.filepath = os.path.join(OUT, iid + '.png'); bpy.ops.render.render(write_still=True)

w = bpy.data.worlds.new('w'); sc.world = w
bg = w.node_tree.nodes['Background'] if w.node_tree else None
if bg is None: w.use_nodes = True; bg = w.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (*hexc('#B8AFA3'), 1); bg.inputs['Strength'].default_value = 0.35
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = SIZE
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
sc.cycles.transmission_bounces = 8; sc.cycles.max_bounces = 10

# ---------------- export for the browser (glTF) ----------------
# Every piece becomes one mesh node (p0, p1, …) with its origin in the middle; shapes become one node "cookie".
# Noise colours (dough, almonds, pickle …) are painted into vertex colours, because glTF cannot carry Blender's noise.
from mathutils import noise
def export_item(iid, grp, build, out):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    _pid[0] = 0
    build()
    objs = [o for o in sc.objects if o.type in ('MESH', 'CURVE', 'META')]
    for o in sc.objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.make_single_user(object=True, obdata=True)
    bpy.ops.object.convert(target='MESH')
    objs = [o for o in sc.objects if o.type == 'MESH']
    for o in objs: o.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    pieces = {}
    for o in objs: pieces.setdefault(o.get('piece', 0), []).append(o)
    scatter = len(pieces) > 1
    for o in objs:
        me = o.data
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        budget = 9000 if grp == 'form' else (320 if scatter else 4000)
        if tris > budget:
            active(o); d = o.modifiers.new('d', 'DECIMATE'); d.ratio = budget / tris; bpy.ops.object.modifier_apply(modifier=d.name)
        active(o); bpy.ops.object.shade_smooth()
        ramps = {i: (lambda a: (a[0], a[1], float(a[2])))(m['ramp'].split('|')) for i, m in enumerate(me.materials) if m and 'ramp' in m}
        ca = me.color_attributes.new('Col', 'BYTE_COLOR', 'POINT')
        vs = [v.co for v in me.vertices]
        mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs))); mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
        size = Vector((max(mx.x - mn.x, 1e-6), max(mx.y - mn.y, 1e-6), max(mx.z - mn.z, 1e-6)))
        vr = {}
        for poly in me.polygons:
            r = ramps.get(poly.material_index)
            for vi in poly.vertices: vr[vi] = r
        for vi, r in vr.items():
            if True:
                li = vi
                if r:
                    v = me.vertices[vi].co + o.location
                    g = Vector(((v.x + 1) * 40, (v.y + 1) * 40, (v.z + 1) * 40)) * (min(r[2], 140) / 4)
                    t = max(0.0, min(1.0, 0.5 + 0.7 * noise.fractal(g, 1.0, 2.0, 4)))
                    c0, c1 = hexc(r[0]), hexc(r[1]); col = tuple(c0[k] + (c1[k] - c0[k]) * t for k in range(3))
                else: col = (1, 1, 1)
                ca.data[li].color = (*col, 1)
        me.color_attributes.active_color = ca
    for m in bpy.data.materials:   # base colour comes from the vertex colours; bumps do not export
        nt = m.node_tree
        if not nt: continue
        b = nt.nodes.get('Principled BSDF')
        for l in list(nt.links):
            if l.to_socket in (b.inputs['Base Color'], b.inputs['Normal']) and ('ramp' in m or l.to_socket == b.inputs['Normal']): nt.links.remove(l)
        if 'ramp' in m: b.inputs['Base Color'].default_value = (1, 1, 1, 1)
    names = []
    for k, (pid, group) in enumerate(sorted(pieces.items())):
        for o in sc.objects: o.select_set(False)
        for o in group: o.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        if len(group) > 1: bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active; o.name = 'cookie' if grp == 'form' else f'p{k}'
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS'); names.append(o.name)
    for o in sc.objects: o.select_set(o.type == 'MESH')
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, iid + '.glb'), export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_vertex_color='ACTIVE', export_texcoords=False, export_animations=False)
    return len(names)

if os.environ.get('EXPORT'):
    man = []
    for iid, grp, de, en, fn in ITEMS:
        if ONLY and iid not in ONLY: continue
        try:
            n = export_item(iid, grp, fn, OUT); man.append({'id': iid, 'group': grp, 'de': de, 'en': en, 'pieces': n}); print('ok', iid, n, flush=True)
        except Exception as e:
            import traceback; traceback.print_exc(); print('FAIL', iid, repr(e), flush=True)
    import json
    if not ONLY: json.dump(man, open(os.path.join(OUT, 'items.json'), 'w'), ensure_ascii=False, indent=1)
    sys.exit(0)

for iid, grp, de, en, fn in ITEMS:
    if ONLY and iid not in ONLY: continue
    try:
        render_item(iid, fn); print('ok', iid, flush=True)
    except Exception as e:
        print('FAIL', iid, repr(e), flush=True)
import json
json.dump([{'id': i, 'group': g, 'de': d, 'en': e} for i, g, d, e, _ in ITEMS], open(os.path.join(OUT, 'items.json'), 'w'), ensure_ascii=False, indent=1)
