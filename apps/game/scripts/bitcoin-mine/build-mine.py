"""Build the Bitcoin mine in Blender and export its raw GLB. The script is the source; the .blend it saves is
review output under .context and is not committed."""
import bpy
import bmesh
import json
import math
import random
from pathlib import Path
from mathutils import Vector, Euler, Matrix

ROOT = Path(__file__).resolve().parents[4]
APP = ROOT / 'apps/game'
WORK = ROOT / '.context/bitcoin-mine'
SOURCE = WORK / 'bitcoin-mine.blend'
REVIEW = WORK / 'review'
RAW_EXPORT = APP / 'public/models/ethereal/bitcoin-mine.glb'
PARTS = None
M = {}
CONTACT_REPORT = {}
PIXEL_PALETTES = {
    'shell':[(.014,.027,.058),(.020,.036,.074),(.027,.046,.092)],
    'gold':[(.78,.235,.006),(.89,.275,.007),(1.,.32,.008)],
}


def material(name, color, metallic=0, roughness=.65, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = roughness
    node.inputs['Emission Color'].default_value = (*color, 1)
    node.inputs['Emission Strength'].default_value = emission
    return mat


def wood_texture(mat):
    import numpy as np
    rng = np.random.default_rng(915)
    n = 256
    y, x = np.mgrid[0:n, 0:n] / n
    grain = np.sin(x*280 + np.sin(y*12)*1.6 + np.sin(y*29)*.4)
    split = np.maximum(0, np.sin(x*91 + .5*np.sin(y*5)))**28
    tone = np.clip(.72 + .10*grain + rng.normal(0,.045,(n,n)) - .28*split, .25, 1)
    pixels = np.ones((n,n,4), dtype=np.float32)
    pixels[:,:,:3] = tone[:,:,None]*np.array([.48,.28,.12])
    image = bpy.data.images.new('Mine timber / long grain', width=n, height=n)
    image.pixels.foreach_set(pixels.ravel())
    image.pack()
    node = mat.node_tree.nodes.new('ShaderNodeTexImage')
    node.image = image
    mat.node_tree.links.new(node.outputs['Color'],mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'])


def link_object(name, mesh):
    obj = bpy.data.objects.new(name, mesh)
    PARTS.objects.link(obj)
    return obj


def mesh_object(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.materials.append(mat)
    data.update()
    return link_object(name, data)


def bevel(obj, width):
    mod = obj.modifiers.new('Small worn edge', 'BEVEL')
    mod.width = width
    mod.segments = 1
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def box(name, location, size, mat, edge=.003):
    sx,sy,sz = (v/2 for v in size)
    vertices = [(x*sx,y*sy,z*sz) for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    faces = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
    obj=mesh_object(name, vertices, faces, mat)
    obj.location=location
    uv=obj.data.uv_layers.new(name='UVMap')
    for poly in obj.data.polygons:
        for loop, co in zip(poly.loop_indices,[(0,0),(1,0),(1,1),(0,1)]):
            uv.data[loop].uv=co
    if edge: bevel(obj,edge)
    return obj


def beam(name, a, b, width, mat, depth=None):
    a,b=Vector(a),Vector(b)
    obj=box(name,(a+b)/2,(width,depth or width,(b-a).length),mat,min(width*.1,.004))
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return obj


def cylinder(name, a, b, radius, mat, sides=10):
    a,b=Vector(a),Vector(b)
    axis=b-a
    rot=axis.to_track_quat('Z','Y').to_matrix()
    vertices=[tuple(a+rot@Vector((radius*math.cos(t*math.tau/sides),radius*math.sin(t*math.tau/sides),z))) for z in [0,axis.length] for t in range(sides)]
    faces=[tuple(range(sides-1,-1,-1)),tuple(range(sides,sides*2))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    return mesh_object(name,vertices,faces,mat)


def rope(name, points, width=.008):
    for i in range(len(points)-1):
        cylinder(name,points[i],points[i+1],width,M['rope'],6)


def ring(name, center, radius, thickness, mat, axis='Y'):
    n=16
    v=[]
    for side,r in [(-thickness/2,radius-thickness),(-thickness/2,radius),(thickness/2,radius),(thickness/2,radius-thickness)]:
        for i in range(n):
            a=i*math.tau/n
            p=(r*math.cos(a),side,r*math.sin(a))
            if axis=='Z':p=(p[0],p[2],p[1])
            v.append(tuple(Vector(center)+Vector(p)))
    f=[(k*n+i,k*n+(i+1)%n,((k+1)%4)*n+(i+1)%n,((k+1)%4)*n+i) for k in range(4) for i in range(n)]
    return mesh_object(name,v,f,mat)


def setup():
    global PARTS,M
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    REVIEW.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    scene.name='Block Excavation / representative review'
    scene.unit_settings.system='METRIC'
    PARTS=bpy.data.collections.new('MINE_EDITABLE_PARTS')
    scene.collection.children.link(PARTS)
    M['gold']=material('Satoshi gold / pixel core',(1,.32,.008),.15,.38,1.5)
    M['shell']=material('Digital block / dark ceramic',(.018,.032,.060),.4,.35)
    M['blue']=material('Digital block / blue circuitry',(.002,.065,1),.1,.28,1.2)
    M['wood']=material('Weathered oak / hand-built mining gear',(.35,.18,.065),0,.78)
    wood_texture(M['wood'])
    M['iron']=material('Forged iron / fittings',(.06,.07,.08),.65,.47)
    M['rope']=material('Hemp rope',(.42,.28,.115),0,.88)
    for key in ['gold','shell']:
        nodes=M[key].node_tree.nodes
        attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='Pixel tone'
        # Direct vertex RGB keeps the same three shades in Blender and glTF.
        M[key].node_tree.links.new(attr.outputs['Color'],nodes['Principled BSDF'].inputs['Base Color'])
    CONTACT_REPORT['support']={'modelLocalHeight':0,'runtimeSupportHeight':.12,'groundVeins':False}


def digital_block():
    n=16
    step=.0525
    half=n*step/2
    rotate=Euler(tuple(math.radians(a) for a in (18,-22,-9)),'XYZ').to_matrix()
    center=Vector((.07,.06,.08))
    def world(p):return tuple(center+rotate@Vector(p))
    # Hand-shaped contours give the mining shallow, irregular pixel margins.
    # Values are inclusive U ranges per V row. Cuts are one or two pixels deep.
    top={2:(6,10),3:(4,10),4:(3,9),5:(3,11),6:(4,12),
         7:(2,12),8:(3,11),9:(5,12),10:(4,10),11:(6,11),12:(8,10),13:(8,9)}
    right={5:(6,8),6:(5,10),7:(3,10),8:(3,11),9:(2,10),10:(4,12),
           11:(3,11),12:(5,11),13:(6,9),14:(7,8)}
    back={5:(6,7),6:(4,8),7:(3,9),8:(4,11),9:(2,10),10:(3,12),
          11:(4,11),12:(3,9),13:(5,9),14:(6,7)}
    def depth(mask,u,v):
        span=mask.get(v)
        if not span or not span[0]<=u<=span[1]:return 0
        # Keep a ragged one-cell lip, with scattered two-cell tool scars.
        interior=span[0]<u<span[1] and v-1 in mask and v+1 in mask
        return 2 if interior and (u*7+v*11)%5 in (0,1,3) else 1
    def removed(i,j,k):
        return k>=n-depth(top,i,j) or i>=n-depth(right,j,k) or j>=n-depth(back,i,k)
    alive={(i,j,k) for i in range(n) for j in range(n) for k in range(n) if not removed(i,j,k)}
    batches={key:([],[]) for key in ['shell','gold']}
    face_colors={key:[] for key in batches}
    palette_rng=random.Random(941)
    normals=[(-1,0,0),(1,0,0),(0,-1,0),(0,1,0),(0,0,-1),(0,0,1)]
    facecorners=[[(0,0,0),(0,0,1),(0,1,1),(0,1,0)],[(1,0,0),(1,1,0),(1,1,1),(1,0,1)],[(0,0,0),(1,0,0),(1,0,1),(0,0,1)],[(0,1,0),(0,1,1),(1,1,1),(1,1,0)],[(0,0,0),(0,1,0),(1,1,0),(1,0,0)],[(0,0,1),(1,0,1),(1,1,1),(0,1,1)]]
    for cell in sorted(alive):
        shades={key:palette_rng.choice(PIXEL_PALETTES[key]) for key in batches}
        i,j,k=cell
        for normal,corners in zip(normals,facecorners):
            neighbor=tuple(cell[a]+normal[a] for a in range(3))
            if neighbor in alive:continue
            cut=all(0<=c<n for c in neighbor)
            key='gold' if cut else 'shell'
            verts,faces=batches[key]
            outer=[Vector(tuple((cell[a]+corner[a])*step-half for a in range(3))) for corner in corners]
            middle=sum(outer,Vector())/4
            inner=[middle+(p-middle)*(.85 if cut else .94)+Vector(normal)*(.003 if cut else .001) for p in outer]
            start=len(verts)
            verts.extend(world(p) for p in outer+inner)
            faces.append(tuple(start+t for t in range(4,8)))
            faces.extend((start+t,start+(t+1)%4,start+(t+1)%4+4,start+t+4) for t in range(4))
            face_colors[key].extend([shades[key]]*5)
    for key,(v,f) in batches.items():
        obj=mesh_object('Block / '+key+' pixel faces',v,f,M[key])
        colors=obj.data.color_attributes.new(name='Pixel tone',type='BYTE_COLOR',domain='CORNER')
        for poly,color in zip(obj.data.polygons,face_colors[key]):
            for loop in poly.loop_indices:colors.data[loop].color=(*color,1)
        obj.data.color_attributes.active_color=colors
        obj.data.color_attributes.render_color_index=0
    CONTACT_REPORT['pixelPalettes']={'linearRGB':PIXEL_PALETTES,'seed':941,'assignment':'one random shade per voxel, shared by its faces and bevels'}
    # Large twelve-edge blue outline stays legible without full-screen bloom.
    for axis in range(3):
        others=[a for a in range(3) if a!=axis]
        for v in [-half,half]:
            for w in [-half,half]:
                a=[0.,0.,0.];b=[0.,0.,0.]
                a[axis]=-half;b[axis]=half
                for pt in [a,b]:pt[others[0]]=v;pt[others[1]]=w
                cylinder('Block / blue perimeter',world(a),world(b),.0065,M['blue'],6)
    # Split circuitry into short segments and omit anything over excavated pixels.
    paths=[[(1,1),(1,6),(2,6),(2,13),(5,13)],
           [(11,2),(14,2),(14,8),(13,8),(13,14)],
           [(4,14),(7,14),(7,15),(12,15)]]
    for face in ['top','right','back']:
        def point(uv):
            u,v=[t*step-half for t in uv]
            return world((u,v,half+.003) if face=='top' else (half+.003,u,v) if face=='right' else (u,half+.003,v))
        for path in paths:
            for a,b in zip(path,path[1:]):
                a,b=Vector(a),Vector(b)
                count=round((b-a).length*4)
                for t in range(count):
                    first,last=a.lerp(b,t/count),a.lerp(b,(t+1)/count)
                    mid=(first+last)/2
                    u,v=[min(n-1,max(0,math.floor(c))) for c in mid]
                    cell=(u,v,n-1) if face=='top' else (n-1,u,v) if face=='right' else (u,n-1,v)
                    if cell not in alive:continue
                    cylinder('Block / etched circuit route',point(first),point(last),.0035,M['blue'],5)
    # A shallow buried skirt prevents light leaking where the tilted cube meets terrain.
    for obj in [o for o in PARTS.objects if o.name.startswith('Block /')]:
        bm=bmesh.new();bm.from_mesh(obj.data)
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
            plane_co=(0,0,-.006),plane_no=(0,0,1),clear_inner=True,dist=.00001)
        bm.to_mesh(obj.data);bm.free();obj.data.update()


def platform(name,x,y,width,depth,z):
    count=max(3,round(width/.06))
    for i in range(count):
        box(name+' / oak plank',(x-width/2+(i+.5)*width/count,y,z),(width/count-.003,depth,.027),M['wood'])
    for dx in [-width*.40,width*.40]:
        for dy in [-depth*.34,depth*.34]:
            beam(name+' / grounded post',(x+dx,y+dy,0),(x+dx,y+dy,z+.015),.043,M['wood'])
        beam(name+' / cross brace',(x+dx,y-depth*.34,.15),(x+dx,y+depth*.34,z-.025),.025,M['wood'])
    for dy in [-depth*.36,depth*.36]:
        beam(name+' / underbeam',(x-width*.49,y+dy,z-.032),(x+width*.49,y+dy,z-.032),.045,M['wood'])


def ladder(name,x,edge,deck_top,outward,run,width=.12):
    # Stiles meet the outer deck fascia. Vertical extensions form handholds,
    # so the sloped rails never continue through the planks.
    tip_y=edge+outward*.019
    feet=[]
    for dx in [-width/2,width/2]:
        foot_y=edge+outward*run
        foot_z=-.004  # Slight embed hides the sloped stile's contact seam.
        a=Vector((x+dx,foot_y,foot_z));b=Vector((x+dx,tip_y,deck_top-.015))
        feet.append(a)
        beam(name+' / stile',a,b,.025,M['wood'])
        beam(name+' / handhold',b,(b.x,b.y,deck_top+.075),.025,M['wood'])
        beam(name+' / fascia bracket',(b.x,b.y,deck_top-.023),
             (b.x,edge-outward*.014,deck_top-.023),.012,M['iron'])
    top=Vector((x,tip_y,deck_top-.024))
    bottom=(feet[0]+feet[1])/2
    count=max(3,round((top-bottom).length/.046))
    for i in range(1,count+1):
        p=bottom.lerp(top,i/count)
        beam(name+' / rung',p+Vector((-width/2,0,0)),p+Vector((width/2,0,0)),.017,M['wood'])
    CONTACT_REPORT[name]={'landingEdge':edge,'deckTop':deck_top,'topRung':list(top),'footCenters':[list(p) for p in feet]}


def crate(name,center,size=.13,filled=True):
    x,y,z=center
    box(name+' / floor',(x,y,z),(size,size,.016),M['wood'])
    for sign in [-1,1]:
        for height in [size*.23,size*.55]:
            box(name+' / boards',(x,y+sign*size*.48,z+height),(size,.014,size*.27),M['wood'])
            box(name+' / boards',(x+sign*size*.48,y,z+height),(.014,size,size*.27),M['wood'])
    for dx in [-size*.43,size*.43]:
        for dy in [-size*.43,size*.43]:
            beam(name+' / corner stave',(x+dx,y+dy,z),(x+dx,y+dy,z+size*.72),.014,M['wood'])
    if filled:
        for dx,dy,dz in [(-.025,-.02,.06),(.025,.019,.065),(.005,-.015,.10)]:
            box(name+' / extracted satoshi',(x+dx,y+dy,z+dz),(.045,.045,.045),M['gold'],.001)


def mining_equipment():
    platform('Front working deck',-.11,-.64,.47,.18,.29)
    platform('Hoist landing',-.65,-.04,.21,.38,.49)
    platform('Rear working deck',-.04,.64,.40,.15,.31)
    ladder('Front access ladder',-.145,-.73,.3035,-1,.12,.12)
    ladder('Upper access ladder',-.69,-.23,.5035,-1,.22,.10)
    ladder('Rear access ladder',-.04,.715,.3235,1,.16,.12)
    # Keep the front ladder opening clear of the deck's rope guard.
    for x in [-.30,-.225,-.065,.10]:
        beam('Deck / guard post',(x,-.715,.29),(x,-.715,.44),.025,M['wood'])
    for a,b in [(-.30,-.225),(-.065,.10)]:
        rope('Deck / hand rope',[(a,-.715,.43),((a+b)/2,-.715,.415),(b,-.715,.43)],.006)
    # Uprights align with the cube-side pillars; the outboard deck is standing room.
    gx=-.65+.21*.40
    front_y=-.04-.38*.34;rear_y=-.04+.38*.34
    for y in [front_y,rear_y]:
        beam('Derrick / aligned upright',(gx,y,.49),(gx,y,.98),.043,M['wood'])
    beam('Derrick / head beam',(gx,front_y,.98),(gx,rear_y,.98),.043,M['wood'])
    beam('Derrick / frame brace',(gx,front_y,.72),(gx,rear_y,.94),.026,M['wood'])
    beam('Derrick / jib',(gx-.055,-.04,1.015),(-.006,-.04,1.015),.052,M['wood'])
    beam('Derrick / brace crossmember',(gx,front_y,.75),(gx,rear_y,.75),.043,M['wood'])
    beam('Derrick / jib brace',(gx,-.04,.75),(-.216,-.04,1.000),.03,M['wood'])
    # The windlass bearings and crank are carried by the frame, inside the deck.
    cylinder('Derrick / windlass axle',(gx,front_y-.01,.67),(gx,rear_y+.01,.67),.021,M['iron'],12)
    cylinder('Derrick / timber winding drum',(gx,front_y+.035,.67),(gx,rear_y-.035,.67),.031,M['wood'],12)
    for y in [front_y,rear_y]:
        box('Derrick / windlass bearing',(gx,y,.67),(.060,.034,.065),M['wood'])
    crank_y=rear_y+.028
    beam('Derrick / hand crank',(gx,crank_y,.67),(gx-.065,crank_y,.67),.016,M['iron'])
    cylinder('Derrick / crank grip',(gx-.065,crank_y,.67),(gx-.065,.137,.67),.011,M['wood'])
    # A forked iron mounting carries an axle beyond the end of the timber jib.
    # The outgoing rope clears the wood and follows the sheave's outer quarter.
    px,pz=.032,1.012
    for y in [-.073,-.007]:
        box('Derrick / pulley cheek plate',(-.003,y,1.012),(.124,.018,.080),M['iron'])
    cylinder('Derrick / pulley axle',(px,-.091,pz),(px,.011,pz),.009,M['iron'],10)
    ring('Derrick / pulley',(px,-.04,pz),.030,.010,M['wood'])
    cylinder('Derrick / pulley hub',(px,-.052,pz),(px,-.028,pz),.024,M['wood'],16)
    hx=px+.037
    curve=[(px+.037*math.sin(a),-.04,pz+.037*math.cos(a)) for a in [i*math.pi/16 for i in range(9)]]
    rope('Derrick / hoist rope',[(gx-.031,-.04,.67),(gx-.070,-.04,.73),(gx-.070,-.04,1.049)]+curve+[(hx,-.04,.81)],.006)
    crate('Suspended ore bucket',(hx,-.04,.66),.12)
    for dx in [-.055,.055]:
        box('Bucket / bridle attachment',(hx+dx,-.04,.740),(.012,.025,.030),M['iron'])
        rope('Bucket / rope bridle',[(hx+dx,-.04,.750),(hx,-.04,.81)],.006)
    CONTACT_REPORT['gantry']={'uprightX':gx,'platformInnerPillarX':gx,'uprightY':[front_y,rear_y],
        'platformCenter':[-.65,-.04],'clearStandingWidth':gx-.03-(-.755),'crankGrip': [gx-.065,.137,.67]}
    # Wheeled handcart, no rail network or motor hardware.
    cx,cy=.32,-.60
    box('Cart / bed',(cx,cy,.235),(.25,.145,.026),M['wood'])
    for x in [cx-.115,cx+.115]:
        for z in [.275,.32]:box('Cart / side board',(x,cy,z),(.018,.145,.035),M['wood'])
    for y in [cy-.065,cy+.065]:
        for z in [.275,.32]:box('Cart / end board',(cx,y,z),(.25,.018,.035),M['wood'])
    cylinder('Cart / axle',(cx-.03,cy-.13,.21),(cx-.03,cy+.13,.21),.014,M['iron'])
    for y in [cy-.11,cy+.11]:
        ring('Cart / wooden wheel',(cx-.03,y,.21),.085,.020,M['wood'])
        ring('Cart / iron tyre',(cx-.03,y,.21),.09,.008,M['iron'])
        for angle in [0,math.pi/3,2*math.pi/3]:
            delta=Vector((math.cos(angle)*.073,0,math.sin(angle)*.073))
            hub=Vector((cx-.03,y,.21))
            beam('Cart / spoke',hub-delta,hub+delta,.014,M['wood'])
    for y in [cy-.055,cy+.055]:beam('Cart / handle',(cx+.10,y,.235),(cx+.26,y,.235),.022,M['wood'])
    for dx,dy,dz in [(-.06,-.03,.28),(0,.02,.28),(.055,-.015,.29),(-.025,0,.335)]:
        box('Cart / recovered gold pixels',(cx+dx,cy+dy,dz),(.055,.05,.05),M['gold'],.002)
    seat_cart_on_support()
    # Flat pickaxe: both wooden haft and iron head contact the plank tops.
    beam('Pickaxe / haft',(-.23,-.615,.310),(-.04,-.615,.310),.013,M['wood'])
    beam('Pickaxe / iron head',(-.05,-.655,.3115),(-.05,-.575,.3115),.016,M['iron'])


def seat_cart_on_support():
    """Pitch the rigid cart until both tyres and both handle ends meet Z=0."""
    bpy.context.view_layer.update()
    objects=[o for o in PARTS.objects if o.name.startswith('Cart /')]
    tyres=[o for o in objects if o.name.startswith('Cart / iron tyre')]
    handles=[o for o in objects if o.name.startswith('Cart / handle')]
    pivot=Vector((.29,-.60,.21))
    points={o.name:[o.matrix_world@v.co-pivot for v in o.data.vertices] for o in tyres+handles}
    def bottom(obj,rotation):return min((rotation@p).z for p in points[obj.name])
    low,high=0.,math.pi/3
    for _ in range(50):
        pitch=(low+high)/2
        rotation=Euler((0,pitch,0),'XYZ').to_matrix()
        if bottom(handles[0],rotation)>bottom(tyres[0],rotation):low=pitch
        else:high=pitch
    offset=Vector((pivot.x,pivot.y,-bottom(tyres[0],rotation)))
    transform=Matrix.Translation(offset)@rotation.to_4x4()@Matrix.Translation(-pivot)
    for obj in objects:obj.matrix_world=transform@obj.matrix_world
    gaps={o.name:bottom(o,rotation)+offset.z for o in tyres+handles}
    if any(abs(gap)>1e-6 for gap in gaps.values()):
        raise RuntimeError(f'Cart contact fit failed: {gaps}')
    CONTACT_REPORT['cart']={'pitchDegrees':math.degrees(pitch),'groundGaps':gaps,
        'rollDegrees':0,'yawDegrees':0,'support':'flat occupied-hex terrain at model-local Z=0'}


def production_copy():
    production=bpy.data.collections.new('BITCOIN_MINE_PRODUCTION')
    bpy.context.scene.collection.children.link(production)
    groups={}
    for obj in list(PARTS.objects):
        if obj.type!='MESH':continue
        if obj.data.materials[0]==M['gold']:
            colors=obj.data.color_attributes.get('Pixel tone')
            if not colors:
                colors=obj.data.color_attributes.new(name='Pixel tone',type='BYTE_COLOR',domain='CORNER')
                for color in colors.data:color.color=(1,.32,.008,1)
            for attr in list(obj.data.color_attributes):
                if attr.name!='Pixel tone':obj.data.color_attributes.remove(attr)
            obj.data.color_attributes.active_color=colors
            obj.data.color_attributes.render_color_index=0
        clone=obj.copy();clone.data=obj.data.copy()
        production.objects.link(clone)
        clone.data.transform(obj.matrix_world)
        clone.parent=None;clone.matrix_world=Matrix.Identity(4)
        key=clone.data.materials[0].name
        groups.setdefault(key,[]).append(clone)
    for key,objects in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.object.join()
        obj=bpy.context.object
        obj.name='Mine / '+key
        # Identity transforms are mandatory for the generic production instancer.
        assert all(abs(v-1)<1e-6 for v in obj.scale)
    PARTS.hide_render=True
    PARTS.hide_viewport=True
    return production


def review_stage():
    scene=bpy.context.scene
    stage=bpy.data.collections.new('REVIEW_STAGE / excluded from export')
    scene.collection.children.link(stage)
    camera=bpy.data.cameras.new('Review camera')
    obj=bpy.data.objects.new('Review camera',camera);stage.objects.link(obj)
    obj.location=(2.8,-4.8,3.1)
    obj.rotation_euler=(Vector((0,0,.42))-obj.location).to_track_quat('-Z','Y').to_euler()
    camera.type='ORTHO';camera.ortho_scale=2.65;scene.camera=obj
    for name,loc,power,size,color in [('Key',(-3,-4,6),420,4,(1,.89,.74)),('Fill',(3,-1,4),260,3,(.6,.75,1)),('Rim',(0,3,5),450,3,(.75,.85,1))]:
        light=bpy.data.lights.new(name,'AREA');light.energy=power;light.shape='DISK';light.size=size;light.color=color
        obj=bpy.data.objects.new(name,light);stage.objects.link(obj);obj.location=loc
        obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
    scene.world=bpy.data.worlds.new('Review charcoal')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.035,.044,.06,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
    scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
    scene.render.resolution_x=1400;scene.render.resolution_y=1400;scene.render.resolution_percentage=100
    # Saturated emissive review, matching the runtime's untone-mapped local light.
    scene.view_settings.view_transform='Standard';scene.view_settings.exposure=-.5
    scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(REVIEW/'blender-review.png')


def export_and_report(production):
    scene=bpy.context.scene
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in production.objects:obj.select_set(True)
    bpy.context.view_layer.objects.active=next(iter(production.objects))
    for image in bpy.data.images:
        if image.source=='GENERATED' and not image.packed_file:image.pack()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
    output=RAW_EXPORT
    bpy.ops.export_scene.gltf(filepath=str(output),export_format='GLB',use_selection=True,export_yup=True,
        export_materials='EXPORT',export_vertex_color='ACTIVE',export_all_vertex_colors=False,
        export_animations=False,export_cameras=False,export_lights=False,export_extras=False,
        export_morph=False,export_draco_mesh_compression_enable=False)
    objects=list(production.objects)
    coords=[obj.matrix_world@v.co for obj in objects for v in obj.data.vertices]
    report={'source':str(SOURCE),'rawExport':str(output),'blender':bpy.app.version_string,
        'meshes':len(objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects),
        'boundsBlenderZUp':{'min':[min(p[i] for p in coords) for i in range(3)],'max':[max(p[i] for p in coords) for i in range(3)]},
        'hexOutsideVertexCount':sum(abs(p.x)>.867 or .5*abs(p.x)+math.sqrt(3)/2*abs(p.y)>.867 for p in coords),
        'materials':[o.data.materials[0].name for o in objects], 'animations':0,'rawBytes':output.stat().st_size}
    (REVIEW/'contact-report.json').write_text(json.dumps(CONTACT_REPORT,indent=2))
    (REVIEW/'structure-report.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))
    assert report['hexOutsideVertexCount']==0, 'Model exceeds the hex footprint'


def build():
    setup()
    digital_block()
    mining_equipment()
    bpy.context.view_layer.update()
    production=production_copy()
    review_stage()
    export_and_report(production)


if __name__=='__main__':build()
