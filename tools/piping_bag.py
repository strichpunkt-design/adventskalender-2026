# A piping bag filled with icing, rendered upright on a transparent background (one image per colour).
# The tip sits in the middle of the bottom edge. Usage: python tools/piping_bag.py <out folder>   (needs bpy)
import bpy, math, sys, os
OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.makedirs(OUT, exist_ok=True)
def hexc(h): return tuple(((int(h[i:i + 2], 16) / 255) ** 2.2) for i in (1, 3, 5))
COLS = {'guss-lila': '#B78CFF', 'guss-weiss': '#F4F0E8', 'schoko': '#3B1F12'}
for key, col in COLS.items():
    bpy.ops.wm.read_factory_settings(use_empty=True); sc = bpy.context.scene
    def mat(name, c, rough, trans=0., metal=0., coat=0.):
        m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*hexc(c), 1); b.inputs['Roughness'].default_value = rough
        b.inputs['Transmission Weight'].default_value = trans; b.inputs['Metallic'].default_value = metal; b.inputs['Coat Weight'].default_value = coat
        return m
    # bag: a cone, wrinkled a little, gathered and twisted at the top
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.004, radius2=0.035, depth=0.11, location=(0, 0, 0.065)); bag = bpy.context.object
    m = bag.modifiers.new('s', 'SUBSURF'); m.subdivision_type = 'SIMPLE'; m.levels = m.render_levels = 3
    t = bpy.data.textures.new('w', 'CLOUDS'); t.noise_scale = 0.012
    d = bag.modifiers.new('d', 'DISPLACE'); d.texture = t; d.strength = 0.002
    bag.data.materials.append(mat('plastic', '#FFFFFF', .12, trans=.92, coat=.5)); bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.0036, radius2=0.032, depth=0.1, location=(0, 0, 0.06)); fill = bpy.context.object
    fill.data.materials.append(mat('icing', col, .35, coat=.3)); bpy.ops.object.shade_smooth()
    bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=0.035, radius2=0.007, depth=0.028, location=(0, 0, 0.134)); top = bpy.context.object
    tw = top.modifiers.new('t', 'SIMPLE_DEFORM'); tw.deform_method = 'TWIST'; tw.angle = 1.6
    s2 = top.modifiers.new('s', 'SUBSURF'); s2.subdivision_type = 'SIMPLE'; s2.levels = s2.render_levels = 3
    d2 = top.modifiers.new('d', 'DISPLACE'); d2.texture = t; d2.strength = 0.003
    bpy.ops.mesh.primitive_torus_add(major_radius=0.0085, minor_radius=0.0018, location=(0, 0, 0.146)); band = bpy.context.object
    band.data.materials.append(mat('band', '#B78CFF', .4)); bpy.ops.object.shade_smooth()
    top.data.materials.append(mat('plastic2', '#FFFFFF', .15, trans=.9)); bpy.ops.object.shade_smooth()
    # metal star nozzle
    bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.0028, radius2=0.0065, depth=0.016, location=(0, 0, 0.004)); tip = bpy.context.object
    b = tip.modifiers.new('b', 'BEVEL'); b.width = 0.0006; b.segments = 2
    tip.data.materials.append(mat('steel', '#D6D9DE', .18, metal=1)); bpy.ops.object.shade_smooth()
    # light and camera
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = .8
    bpy.ops.object.light_add(type='AREA', location=(-.15, -.2, .25)); L = bpy.context.object; L.data.energy = 8; L.data.size = .2
    L.rotation_euler = (math.radians(50), 0, math.radians(-35))
    cd = bpy.data.cameras.new('c'); cd.type = 'ORTHO'; cd.ortho_scale = 0.16
    cam = bpy.data.objects.new('c', cd); sc.collection.objects.link(cam); sc.camera = cam
    cam.location = (0, -.5, .07); cam.rotation_euler = (math.radians(90), 0, 0)
    sc.render.engine = 'CYCLES'; sc.cycles.samples = 48; sc.cycles.use_denoising = True; sc.render.film_transparent = True
    sc.render.resolution_x, sc.render.resolution_y = 160, 320    # 0.08 × 0.16 m: the tip (z = -0.004) ends at the bottom edge
    sc.view_settings.view_transform = 'AgX'
    cam.location.z = 0.076; sc.render.filepath = os.path.join(OUT, f'bag-{key}.png'); bpy.ops.render.render(write_still=True); print('ok', key)
