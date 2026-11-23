# Plätzchen-Simulator sketch: a semicolon cookie on baking paper, rendered with Blender (bpy).
# Usage: python tools/cookie_scene.py <out folder> [samples]
# Needs the bpy module (pip install bpy, Python 3.13) or run inside Blender: blender -b -P tools/cookie_scene.py -- <out>
import bpy, math, random, sys, os
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
OUT = args[0] if args else '.'
SAMPLES = int(args[1]) if len(args) > 1 else 48
os.makedirs(OUT, exist_ok=True)
random.seed(24)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

S = 0.0003                       # SVG unit -> metres (the semicolon is ~9 cm tall)
def P(x, y): return Vector(((x - 200) * S, -(y - 270) * S, 0))

# The Strichpunkt comma (same path as the site's animations) and the dot.
COMMA = [((200, 250), (178, 250), (222, 250)), ((240, 290), (240, 268), (240, 342)), ((178, 400), (220, 378), (175, 395)),
         ((168, 386), (171, 391), (194, 368)), ((204, 330), (204, 350), (182, 330)), ((160, 290), (160, 312), (160, 268))]
K = 0.5523
def circle(cx, cy, r):
    return [((cx + r, cy), (cx + r, cy - r * K), (cx + r, cy + r * K)), ((cx, cy + r), (cx + r * K, cy + r), (cx - r * K, cy + r)),
            ((cx - r, cy), (cx - r, cy + r * K), (cx - r, cy - r * K)), ((cx, cy - r), (cx - r * K, cy - r), (cx + r * K, cy - r))]

def semicolon_curve(name, extrude, bevel, offset=0.0, fill='BOTH'):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = fill
    cu.extrude, cu.bevel_depth, cu.bevel_resolution, cu.offset, cu.resolution_u = extrude, bevel, 4, offset, 24
    for pts in (COMMA, circle(200, 150, 40)):
        sp = cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts) - 1); sp.use_cyclic_u = True
        for bp, (co, hl, hr) in zip(sp.bezier_points, pts):
            bp.co, bp.handle_left, bp.handle_right = P(*co), P(*hl), P(*hr)
            bp.handle_left_type = bp.handle_right_type = 'FREE'
    ob = bpy.data.objects.new(name, cu); sc.collection.objects.link(ob)
    return ob

def to_mesh(ob):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects: o.select_set(False)
    ob.select_set(True); bpy.ops.object.convert(target='MESH'); bpy.ops.object.transform_apply(scale=True)
    return bpy.context.view_layer.objects.active

def mod(ob, kind, **kw):
    m = ob.modifiers.new(kind, kind)
    for k, v in kw.items(): setattr(m, k, v)
    return m

def mat(name, color, rough=0.5, metal=0.0, coat=0.0, sss=0.0, bump=None, ramp=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal; b.inputs['Coat Weight'].default_value = coat
    b.inputs['Subsurface Weight'].default_value = sss
    if ramp:   # colour varies with a noise texture, darker at the sharp edges
        n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = ramp[2]; n.inputs['Detail'].default_value = 8
        r = nt.nodes.new('ShaderNodeValToRGB'); r.color_ramp.elements[0].color = (*ramp[0], 1); r.color_ramp.elements[1].color = (*ramp[1], 1)
        nt.links.new(n.outputs['Fac'], r.inputs['Fac']); nt.links.new(r.outputs['Color'], b.inputs['Base Color'])
    if bump:
        n = nt.nodes.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = bump[0]; n.inputs['Detail'].default_value = 12
        bm = nt.nodes.new('ShaderNodeBump'); bm.inputs['Strength'].default_value = bump[1]; bm.inputs['Distance'].default_value = bump[2]
        nt.links.new(n.outputs['Fac'], bm.inputs['Height']); nt.links.new(bm.outputs['Normal'], b.inputs['Normal'])
    return m

def hexc(h): return tuple(((int(h[i:i + 2], 16) / 255) ** 2.2) for i in (1, 3, 5))
LILAC, RED = hexc('#B78CFF'), hexc('#E2231A')
M_COOKIE = mat('cookie', hexc('#D9A35E'), 0.75, bump=(900, .45, .0015), ramp=(hexc('#C8873F'), hexc('#E6B676'), 420))
M_ICING = mat('icing', LILAC, 0.22, coat=0.4, sss=0.15, bump=(160, .08, .0005))
M_PAPER = mat('paper', hexc('#EEE6D6'), 0.62, bump=(60, .15, .002))
M_TRAY = mat('tray', hexc('#2A2A2C'), 0.35, metal=1.0)
M_STEEL = mat('steel', hexc('#C9CCD1'), 0.18, metal=1.0)
SPR = [mat('spr_w', hexc('#F7F4EE'), .35, coat=.3), mat('spr_b', hexc('#141414'), .3, coat=.3), mat('spr_l', hexc('#8F5CF0'), .3, coat=.3), mat('spr_r', RED, .3, coat=.3)]
M_PEARL = mat('pearl', hexc('#E8E8EA'), 0.12, metal=1.0)

# ---- the cookie: rounded, slightly lumpy dough ----
TH, BV = 0.0028, 0.0018
ck = to_mesh(semicolon_curve('cookie', TH, BV))
mod(ck, 'REMESH', mode='VOXEL', voxel_size=0.00045)
tx = bpy.data.textures.new('lumps', 'CLOUDS'); tx.noise_scale = 0.006
mod(ck, 'DISPLACE', texture=tx, strength=0.0007, mid_level=0.5)
mod(ck, 'SMOOTH', factor=0.5, iterations=4)
ck.data.materials.append(M_COOKIE); bpy.ops.object.shade_smooth()
TOP = TH + BV

# ---- lilac icing, inset from the edge, thick and glossy ----
ic = to_mesh(semicolon_curve('icing', 0.0004, 0.0011, offset=-0.0026))
ic.location.z = TOP - 0.0002
mod(ic, 'REMESH', mode='VOXEL', voxel_size=0.0003); mod(ic, 'SMOOTH', factor=0.6, iterations=6)
ic.data.materials.append(M_ICING); bpy.ops.object.shade_smooth()
ITOP = TOP - 0.0002 + 0.0015

# ---- sprinkles and pearls on the icing (points inside the shape, away from the edge) ----
def flat(pts, n=16):
    out = []
    for i, (co, hl, hr) in enumerate(pts):
        a, c1 = Vector(co), Vector(hr); nx = pts[(i + 1) % len(pts)]; c2, b = Vector(nx[1]), Vector(nx[0])
        for k in range(n):
            t = k / n; out.append((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * b)
    return out
POLY = [flat(COMMA), flat(circle(200, 150, 40))]
def inside(x, y, poly):
    c = False
    for i in range(len(poly)):
        a, b = poly[i], poly[i - 1]
        if (a.y > y) != (b.y > y) and x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x: c = not c
    return c
def dist_edge(x, y, poly): return min((Vector((x, y)) - p).length for p in poly)
def sample(margin):
    while True:
        x, y = random.uniform(150, 250), random.uniform(100, 400)
        for poly in POLY:
            if inside(x, y, poly) and dist_edge(x, y, poly) > margin: return P(x, y)

bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.00045, depth=0.0036); spr = bpy.context.object
mod(spr, 'BEVEL', width=0.0005, segments=3); bpy.ops.object.shade_smooth(); spr.hide_render = spr.hide_viewport = True
spr_objs = []
for m in SPR:   # one mesh per colour so each keeps its material
    me = spr.data.copy(); me.materials.append(m); spr_objs.append(me)
def put_sprinkle(loc, rz, tilt=0.0):
    o = bpy.data.objects.new('spr', random.choice(spr_objs)); sc.collection.objects.link(o)
    for md in spr.modifiers: o.modifiers.new(md.name, md.type).width = md.width; o.modifiers[-1].segments = md.segments
    o.location = loc; o.rotation_euler = (math.pi / 2, tilt, rz)
for _ in range(70):
    p = sample(9); put_sprinkle(Vector((p.x, p.y, ITOP + 0.0004)), random.uniform(0, math.pi), random.uniform(-.2, .2))
# a few that rolled off onto the paper
for _ in range(14):
    a, r = random.uniform(0, 2 * math.pi), random.uniform(0.05, 0.085)
    put_sprinkle(Vector((math.cos(a) * r, math.sin(a) * r - 0.005, 0.0006)), random.uniform(0, math.pi))
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.0012, segments=24, ring_count=12); pearl = bpy.context.object
bpy.ops.object.shade_smooth(); pearl.data.materials.append(M_PEARL)
pl = []
for _ in range(14):
    p = sample(7); o = pearl.copy(); sc.collection.objects.link(o); o.location = (p.x, p.y, ITOP + 0.0006); pl.append(o)
pearl.location = (0.07, -0.05, 0.0012)

# ---- the semicolon cookie cutter beside it ----
cut = to_mesh(semicolon_curve('cutter', 0.0075, 0.0, offset=0.0, fill='NONE'))
mod(cut, 'SOLIDIFY', thickness=0.0005); mod(cut, 'BEVEL', width=0.0002, segments=2)
cut.data.materials.append(M_STEEL); bpy.ops.object.shade_smooth()
cut.location = (0.07, -0.002, 0.0075); cut.rotation_euler.z = math.radians(-152)

# ---- baking paper with soft creases on a dark tray ----
bpy.ops.mesh.primitive_plane_add(size=1); pp = bpy.context.object; pp.scale = (0.8, 0.6, 1)
bpy.ops.object.transform_apply(scale=True)
mod(pp, 'SUBSURF', subdivision_type='SIMPLE', levels=6, render_levels=6)
tx2 = bpy.data.textures.new('creases', 'CLOUDS'); tx2.noise_scale = 0.09
mod(pp, 'DISPLACE', texture=tx2, strength=0.0025, mid_level=0.7)
pp.data.materials.append(M_PAPER); pp.location.z = -0.0002; bpy.ops.object.shade_smooth()
bpy.ops.mesh.primitive_plane_add(size=1.4, location=(0, 0, -0.0025)); bpy.context.object.data.materials.append(M_TRAY)

# ---- light and render settings ----
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (*hexc('#9A9184'), 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.12
bpy.ops.object.light_add(type='AREA', location=(-0.35, 0.3, 0.55)); L = bpy.context.object
L.data.energy, L.data.size = 9, 0.3; L.rotation_euler = (math.radians(35), math.radians(-28), math.radians(-40))
bpy.ops.object.light_add(type='AREA', location=(0.4, -0.25, 0.3)); F = bpy.context.object
F.data.energy, F.data.size = 2, 0.6; F.rotation_euler = (math.radians(-50), math.radians(40), 0)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 1200, 900
sc.render.resolution_percentage = int(os.environ.get('PCT', 100))
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'

# Camera angles for the sketch: top, three-quarter, low "crumb" view.
CAMS = {'oben': ((0.012, 0.0, 0.2), (0, 0, 0), 40),
        'schraeg': ((0.012, -0.13, 0.12), (math.radians(47), 0, 0), 42),
        'kruemel': ((0.085, -0.1, 0.03), (math.radians(78), 0, math.radians(40)), 45)}
cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
cam_d.clip_start = 0.002; cam_d.dof.use_dof = True; cam_d.dof.aperture_fstop = 4
for name, (loc, rot, lens) in CAMS.items():
    cam.location, cam.rotation_euler, cam_d.lens = loc, rot, lens
    cam_d.dof.focus_distance = (Vector(loc) - Vector((0, -0.015, 0.004))).length
    sc.render.filepath = os.path.join(OUT, f'cookie-{name}.png'); bpy.ops.render.render(write_still=True)
    print('rendered', name, flush=True)
