# A kitchen around the chopping board, rendered as a 360° panorama for the cookie simulator's background.
# Usage: python tools/kitchen_pano.py <out.png> [samples]   (needs the bpy module)
import bpy, math, random, sys
from mathutils import Vector

OUT = sys.argv[1] if len(sys.argv) > 1 else 'kitchen.png'
SAMPLES = int(sys.argv[2]) if len(sys.argv) > 2 else 64
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def hexc(h): return tuple(((int(h[i:i + 2], 16) / 255) ** 2.2) for i in (1, 3, 5))
def mat(name, col, rough=.5, metal=0., emit=0., trans=0.):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*hexc(col), 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    b.inputs['Transmission Weight'].default_value = trans
    if emit: b.inputs['Emission Color'].default_value = (*hexc(col), 1); b.inputs['Emission Strength'].default_value = emit
    return m
def box(sx, sy, sz, loc, m, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o = bpy.context.object; o.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    if bevel: md = o.modifiers.new('b', 'BEVEL'); md.width = bevel; md.segments = 3
    o.data.materials.append(m); return o
def cyl(r, h, loc, m, v=32):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, location=loc, vertices=v); o = bpy.context.object; o.data.materials.append(m)
    bpy.ops.object.shade_smooth(); return o

WALL, TILE, GROUT = mat('wall', '#D8CFC2', .8), mat('tile', '#F4F1EC', .15), mat('grout', '#CFC7BB', .9)
STONE, WOOD, DARK = mat('stone', '#BFB5A6', .35), mat('wood', '#A87A4E', .5), mat('dark', '#2E2A27', .4)
LIL, CREAM, GREEN, TERRA, STEEL = mat('lilac', '#B78CFF', .35), mat('cream', '#E9DFCF', .4), mat('leaf', '#4F6E3A', .6), mat('terra', '#B4674A', .7), mat('steel', '#CCCFD3', .2, 1)
GLASS = mat('glass', '#FFFFFF', .02, trans=1)

# room: worktop runs left-right in front (y>0 is the back wall), the camera sits just above the board
box(6, 6, .04, (0, 0, -.02), STONE)                      # worktop
box(6, .04, 3, (0, .75, 1.5), WALL); box(6, .04, 3, (0, -2.6, 1.5), WALL); box(.04, 6, 3, (2.4, 0, 1.5), WALL); box(.04, 6, 3, (-2.4, 0, 1.5), WALL)
box(6, 6, .04, (0, 0, 2.6), WALL)                        # ceiling
# backsplash tiles
for r in range(7):
    for c in range(-20, 20):
        box(.145, .01, .07, (c * .15 + (r % 2) * .075, .725, .06 + r * .075), TILE, .004)
box(6, .005, .55, (0, .728, .28), GROUT)
# window with bright daylight
box(1.1, .05, .9, (-.9, .74, 1.05), mat('sky', '#FFFFFF', 1, emit=3))
for x in (-1.45, -.9, -.35): box(.04, .08, .94, (x, .72, 1.05), DARK)
for z in (.6, 1.05, 1.5): box(1.14, .08, .04, (-.9, .72, z), DARK)
# upper cabinets and a shelf with jars
box(1.4, .35, .7, (1.2, .55, 1.6), CREAM, .01); box(.01, .36, .7, (1.2, .37, 1.6), DARK)
box(1.0, .22, .03, (.3, .62, .85), WOOD, .005)
for i, (m, h) in enumerate([(LIL, .16), (CREAM, .2), (GLASS, .14), (TERRA, .12), (LIL, .18)]):
    cyl(.045, h, (-.08 + i * .17, .62, .865 + h / 2), m)
# things on the worktop: kettle, plant, a jar of spoons, a second board, flour bag, mixing bowl
cyl(.09, .2, (1.1, .5, .1), STEEL, 48); cyl(.07, .02, (1.1, .5, .21), DARK)
cyl(.08, .14, (-1.6, .5, .07), TERRA)
for i in range(14):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=.06, location=(-1.6 + random.uniform(-.08, .08), .5 + random.uniform(-.08, .08), .2 + i * .02)); o = bpy.context.object
    o.scale = (.5, .5, 1.6); o.rotation_euler = (random.uniform(-.8, .8), random.uniform(-.8, .8), 0); o.data.materials.append(GREEN); bpy.ops.object.shade_smooth()
cyl(.06, .16, (.75, .55, .08), CREAM); [box(.012, .012, .2, (.75 + random.uniform(-.03, .03), .55 + random.uniform(-.03, .03), .22), WOOD) for _ in range(5)]
box(.45, .03, .32, (-.35, .66, .16), WOOD, .01)
box(.16, .1, .24, (1.6, .45, .12), mat('bag', '#E8DCC2', .9), .02)
bpy.ops.mesh.primitive_uv_sphere_add(radius=.16, location=(-1.0, .2, .05)); bw = bpy.context.object; bw.scale = (1, 1, .55); bw.data.materials.append(LIL); bpy.ops.object.shade_smooth()
# a bit of the room behind the camera: fridge and a doorway
box(.7, .65, 1.9, (-1.3, -2.25, .95), mat('fridge', '#DCD8D2', .3), .02)
box(.9, .05, 2.1, (.8, -2.55, 1.05), WOOD)

# light
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (*hexc('#F3EEE6'), 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = .15
bpy.ops.object.light_add(type='AREA', location=(-.9, .5, 1.1)); L = bpy.context.object; L.data.energy = 90; L.data.size = 1.2; L.rotation_euler = (math.radians(-80), 0, 0)
bpy.ops.object.light_add(type='AREA', location=(0, -.8, 2.4)); L2 = bpy.context.object; L2.data.energy = 45; L2.data.size = 2

# panorama camera just above the board
cd = bpy.data.cameras.new('cam'); cd.type = 'PANO'
try: cd.panorama_type = 'EQUIRECTANGULAR'
except Exception: cd.cycles.panorama_type = 'EQUIRECTANGULAR'
cam = bpy.data.objects.new('cam', cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = (0, 0, .25); cam.rotation_euler = (math.radians(90), 0, 0)
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = SAMPLES; sc.cycles.use_denoising = True
sc.render.resolution_x, sc.render.resolution_y = 2048, 1024
sc.view_settings.view_transform = 'AgX'; sc.view_settings.look = 'AgX - Medium High Contrast'
sc.render.filepath = OUT; bpy.ops.render.render(write_still=True); print('ok')
