"""Author connected creature cages, sculpt their surfaces, and retain packed editable sources."""
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

SOURCE = Path(__file__).resolve().parents[2] / "asset-sources/frontier-beasts"


class Creature:
    def __init__(self, species, tone):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.species = species
        self.verts, self.edges, self.radii = [], [], []
        self.parts = []
        self.paint = bpy.data.images.load(str(SOURCE / "painted-hide.png"))
        self.paint.scale(512, 512)
        self.paint.pack()
        self.skin = self.material("Painted hide", tone)
        self.ivory = self.material("Worn horn", (.58, .44, .24))
        self.dark = self.material("Mouth and hoof", (.025, .016, .009))
        self.eyes = self.material("Amber iris", (.8, .34, .025))
        self.leather = self.material("Dark mane and leather", (.065, .075, .08) if species == "wolf" else (.085, .038, .017))

    def material(self, name, color):
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        n, l = mat.node_tree.nodes, mat.node_tree.links
        shader = n.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = .85
        tex = n.new("ShaderNodeTexImage")
        tex.image = self.paint
        tex.projection = "BOX"
        tex.projection_blend = .3
        coord = n.new("ShaderNodeTexCoord")
        l.new(coord.outputs["Generated"], tex.inputs["Vector"])
        tint = n.new("ShaderNodeMixRGB")
        tint.blend_type = "MULTIPLY"
        tint.inputs[0].default_value = 1
        tint.inputs[2].default_value = (*[min(1, c * 3.0) for c in color], 1)
        l.new(tex.outputs["Color"], tint.inputs[1])
        ao = n.new("ShaderNodeAmbientOcclusion")
        ao.inputs["Distance"].default_value = .12
        shade = n.new("ShaderNodeMixRGB")
        shade.blend_type = "MULTIPLY"
        shade.inputs[0].default_value = .65
        l.new(tint.outputs[0], shade.inputs[1])
        l.new(ao.outputs["Color"], shade.inputs[2])
        l.new(shade.outputs[0], shader.inputs["Base Color"])
        bump = n.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = .18
        bump.inputs["Distance"].default_value = .016
        l.new(tex.outputs["Color"], bump.inputs["Height"])
        l.new(bump.outputs["Normal"], shader.inputs["Normal"])
        return mat

    def joint(self, co, radius, parent=None):
        index = len(self.verts)
        self.verts.append(co)
        self.radii.append(radius if isinstance(radius, tuple) else (radius, radius))
        if parent is not None:
            self.edges.append((parent, index))
        return index

    def surface(self, name, verts, faces, material, subdiv=0):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(verts, [], faces)
        mesh.update()
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(mesh)
        bm.free()
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(material)
        self.parts.append(obj)
        self.active(obj)
        if subdiv:
            mod = obj.modifiers.new("Sculpt surface", "SUBSURF")
            mod.levels = subdiv
            bpy.ops.object.modifier_apply(modifier=mod.name)
        for face in obj.data.polygons:
            face.use_smooth = True
        return obj

    def active(self, obj):
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj

    def anatomy(self):
        mesh = bpy.data.meshes.new("Connected anatomy cage")
        mesh.from_pydata(self.verts, self.edges, [])
        mesh.update()
        obj = bpy.data.objects.new("Connected anatomy sculpt", mesh)
        bpy.context.collection.objects.link(obj)
        obj.data.materials.append(self.skin)
        self.active(obj)
        skin = obj.modifiers.new("Connected skin topology", "SKIN")
        bpy.context.view_layer.update()
        for index, radius in enumerate(self.radii):
            mesh.skin_vertices[0].data[index].radius = radius
        mesh.skin_vertices[0].data[0].use_root = True
        bpy.ops.object.modifier_apply(modifier=skin.name)
        sub = obj.modifiers.new("Anatomy subdivision", "SUBSURF")
        sub.levels = 3
        bpy.ops.object.modifier_apply(modifier=sub.name)
        # Broad chest, cheek and tendon planes are sculpted into the connected surface.
        for v in obj.data.vertices:
            x, y, z = v.co
            ripple = .003 * math.sin(x * 38 + z * 18) * math.sin(y * 29 - z * 11)
            v.co += v.normal * ripple
            v.co.z = max(.012, v.co.z)
        for f in obj.data.polygons:
            f.use_smooth = True
        self.body = obj
        self.sculpt_anatomy(obj)
        self.parts.append(obj)
        return obj

    def sculpt_anatomy(self, obj):
        biped = self.species not in ["wolf", "chimera"]
        muscles = [(sx*x, y, z, radius, depth) for sx in [-1,1] for x,y,z,radius,depth in [
            (.14,-.16,.99,.14,.065), (.30,.0,1.01,.13,.045),
            (.38,-.02,.84,.10,.035), (.16,-.03,.43,.10,.025),
            (.14,.02,.18,.075,.018), (.075,-.115,.82,.07,.02),
            (.065,-.11,.73,.065,.02),
        ]]
        for vertex in obj.data.vertices:
            x,y,z=vertex.co
            if biped:
                for mx,my,mz,radius,depth in muscles:
                    distance=((x-mx)**2+(y-my)**2+(z-mz)**2)/radius**2
                    vertex.co += vertex.normal * (depth*math.exp(-distance*2))
                if z>1.40:
                    vertex.co.z += .06*max(0,1-(x/.19)**2)*min(1,(z-1.40)/.035)
                if self.species=="minotaur" and z<.12:
                    vertex.co.y -= .04*max(0,1-z/.12)
            else:
                # A ridge over the shoulders and a tucked belly preserve a quadruped silhouette.
                if z>.6: vertex.co.z += .045*math.exp(-((y+.25)/.25)**2)
            vertex.co.z=max(.012,vertex.co.z)
        obj.data.update()
        # A distinct muzzle, hooves, and mane are painted onto the sculpt's own faces.
        obj.data.materials.append(self.dark)
        obj.data.materials.append(self.leather)
        for face in obj.data.polygons:
            center=face.center
            if self.species=="minotaur" and center.z<.12: face.material_index=1
            if self.species=="minotaur" and center.z>1.2 and center.y>0: face.material_index=2
            if self.species=="minotaur" and 1.16<center.z<1.3 and center.y<-.30: face.material_index=2
            if self.species=="wolf" and center.z>.55 and center.y>-.35: face.material_index=2
        obj.data.update()

    def face_y(self, x, z):
        hit, point, _, _ = self.body.ray_cast(Vector((x, -2, z)), Vector((0, 1, 0)))
        if not hit:
            raise ValueError(f"Facial detail misses the sculpt at {x}, {z}")
        return point.y

    def extrusion(self, name, centers, widths, material, sides=12):
        verts, faces = [], []
        for i, center in enumerate(centers):
            tangent = Vector(centers[min(i+1, len(centers)-1)]) - Vector(centers[max(0,i-1)])
            tangent.normalize()
            across = tangent.cross(Vector((0,1,0)))
            if across.length < .01:
                across = tangent.cross(Vector((1,0,0)))
            across.normalize()
            up = tangent.cross(across).normalized()
            for j in range(sides):
                a = j * math.tau / sides
                verts.append(Vector(center) + widths[i] * (math.cos(a)*across + math.sin(a)*up))
        faces.append(tuple(reversed(range(sides))))
        for i in range(len(centers)-1):
            for j in range(sides):
                a=i*sides+j; b=i*sides+(j+1)%sides
                faces.append((a,b,b+sides,a+sides))
        faces.append(tuple(range((len(centers)-1)*sides,len(centers)*sides)))
        return self.surface(name, verts, faces, material, 1)

    def eye(self, x, y, z, size=.025):
        # An inset almond rim, amber lens and vertical dark pupil face toward -Y.
        y = self.face_y(x,z)-.002
        for label, scale, depth, mat in [("Eye socket", 1.1,0,self.dark),("Amber eye",.70,.002,self.eyes),("Pupil",.33,.004,self.dark)]:
            verts=[(x,y-depth-.008,z)]
            for i in range(12):
                a=i*math.tau/12
                verts.append((x+math.cos(a)*size*scale,y-depth,z+math.sin(a)*size*scale*.63))
            faces=[(0,1+i,1+(i+1)%12) for i in range(12)]
            self.surface(label,verts,faces,mat)

    def biped(self):
        goblin=self.species=="goblin"
        broad=.72 if goblin else 1
        hip=self.joint((0,.02,.57),(.15*broad,.12))
        waist=self.joint((0,.02,.73),(.14*broad,.12),hip)
        chest=self.joint((0,.025,.95),(.27*broad,.19),waist)
        neck=self.joint((0,-.015,1.14),(.13,.12),chest)
        head=self.joint((0,-.06,1.31),(.15,.14),neck)
        self.joint((0,-.075,1.45),(.105,.11),head)
        nose_y=-.38 if self.species=="minotaur" else -.26
        nose=self.joint((0,nose_y,1.26),(.10 if not goblin else .055,.065),head)
        self.joint((0,nose_y-.03,1.2),(.08 if not goblin else .025,.04),nose)
        for side in [-1,1]:
            shoulder=self.joint((side*.29*broad,.01,1.015),(.17*broad,.15),chest)
            arm=self.joint((side*.39*broad,-.015,.85),(.12*broad,.11),shoulder)
            elbow=self.joint((side*.44*broad,-.06,.70),(.07,.065),arm)
            wrist=self.joint((side*.46*broad,-.16,.51),(.065,.06),elbow)
            palm=self.joint((side*.45*broad,-.20,.43),(.072,.055),wrist)
            for finger in range(3):
                f=self.joint((side*(.415+.032*finger)*broad,-.23,.36),.018,palm)
                self.joint((side*(.41+.032*finger)*broad,-.25,.33),.012,f)
            thigh=self.joint((side*.12,.025,.46),(.11*broad,.10),hip)
            knee=self.joint((side*.17,-.08,.29),(.075,.07),thigh)
            ankle=self.joint((side*.14,.0,.10),(.055,.05),knee)
            foot=self.joint((side*.15,-.085,.055),(.085,.045),ankle)
            self.joint((side*.15,-.20,.05),(.075,.04),foot)
            ear=self.joint((side*.14,-.025,1.36),(.04,.055),head)
            self.joint((side*(.30 if goblin else .22),.01,1.40),(.008,.012),ear)
        self.anatomy()
        if self.species=="cyclops":
            self.eye(0,-.208,1.345,.056)
        else:
            for side in [-1,1]: self.eye(side*.085,-.198,1.335,.020)
        for side in [-1,1]:
            self.extrusion("Nostril",[(side*.04,nose_y-.037,1.275),(side*.05,nose_y-.043,1.26)],[.018,.022],self.dark,8)
            brow_y=self.face_y(side*.075,1.36)-.015
            if self.species!="cyclops":
                self.extrusion("Angled brow",[(side*.015,brow_y,1.365),(side*.075,brow_y-.012,1.38),(side*.13,brow_y+.01,1.36)],[.015,.025,.014],self.skin)
        self.extrusion("Mouth crease",[(-.08,nose_y+.02,1.19),(0,nose_y-.012,1.175),(.08,nose_y+.02,1.19)],[.014,.018,.014],self.dark)
        for side in [-1,1]:
            if self.species=="minotaur":
                self.extrusion("Swept bull horn",[(side*.12,-.01,1.42),(side*.23,.015,1.44),(side*.32,.025,1.50),(side*.34,.015,1.62)],[.055,.05,.033,.001],self.ivory)
            else:
                self.extrusion("Lower tusk",[(side*.065,nose_y,1.18),(side*.083,nose_y-.02,1.23),(side*.08,nose_y-.01,1.27)],[.018,.012,.001],self.ivory)
        verts=[]
        for level in [0,1]:
            for i in range(16):
                a=i*math.tau/16
                z=.63 if level==0 else .40+.035*math.cos(i*2.4)
                verts.append((math.cos(a)*(.17+level*.03),.02+math.sin(a)*(.135+level*.02),z))
        self.surface("Worn hide wrap",verts,[(i,(i+1)%16,(i+1)%16+16,i+16) for i in range(16)],self.leather)
        if self.species=="minotaur":
            for side in [-1,1]:
                for i in range(6):
                    x=side*(.10+.027*i)
                    self.extrusion("Mane lock",[(x,.075,1.45-i*.023),(x*1.1,.015,1.32-i*.035),(x*.95,-.015,1.13-i*.037)],[.045,.035,.001],self.leather,8)

    def quadruped(self):
        wolf=self.species=="wolf"
        hip=self.joint((0,.30,.55),(.17,.16))
        spine=self.joint((0,.08,.60),(.18,.18),hip)
        chest=self.joint((0,-.25,.64),(.23,.23),spine)
        neck=self.joint((0,-.40,.74 if wolf else .81),(.17,.17),chest)
        head=self.joint((0,-.55,.84 if wolf else .92),(.14,.13),neck)
        muzzle=self.joint((0,-.70,.78 if wolf else .86),(.075,.06),head)
        self.joint((0,-.81,.76 if wolf else .84),(.05,.045),muzzle)
        for side in [-1,1]:
            ear=self.joint((side*.10,-.49,.93 if wolf else 1.04),(.035,.035),head)
            self.joint((side*.13,-.47,1.055 if wolf else 1.09),(.003,.003),ear)
            for parent,y,front in [(chest,-.28,True),(hip,.31,False)]:
                shoulder=self.joint((side*.17,y,.50),(.095,.10),parent)
                knee=self.joint((side*.19,y+(.035 if front else -.10),.29),(.06,.06),shoulder)
                ankle=self.joint((side*.19,y+(.0 if front else .09),.10),(.035,.035),knee)
                paw=self.joint((side*.19,y-.03,.05),(.065,.045),ankle)
                self.joint((side*.19,y-.14,.045),(.06,.035),paw)
        tail=self.joint((0,.47,.59),(.09,.09),hip)
        if wolf:
            tail=self.joint((.06,.63,.40),(.11,.10),tail)
            self.joint((.1,.67,.19),(.02,.025),tail)
        else:
            tail=self.joint((.13,.65,.70),(.05,.05),tail)
            tail=self.joint((.26,.57,.96),(.045,.045),tail)
            tail=self.joint((.28,.45,1.12),(.065,.05),tail)
            self.joint((.28,.31,1.10),(.04,.04),tail)
            goat=self.joint((.085,-.04,.85),(.09,.085),spine)
            goat=self.joint((.085,-.08,1.10),(.09,.08),goat)
            self.joint((.085,-.20,1.14),(.06,.065),goat)
        self.anatomy()
        for side in [-1,1]: self.eye(side*.085,-.622,.865 if wolf else .945,.013 if wolf else .018)
        nose_z=.775 if wolf else .865
        nose_y=-.825 if wolf else -.793
        self.extrusion("Dark nose",[(-.03,nose_y+.01,nose_z),(0,nose_y,nose_z),(.03,nose_y+.01,nose_z)],[.016,.023,.016],self.dark)
        for side in [-1,1]:
            for i in range(7):
                start_z=(.83 if wolf else .98)-i*.017
                self.extrusion("Neck ruff",[(side*.12,-.37+i*.025,start_z),(side*(.21+i*.004),-.32+i*.025,start_z-.055),(side*(.23+i*.004),-.27+i*.025,start_z-.15)],[.025,.035,.001],self.leather if not wolf else self.skin,8)
        if not wolf:
            for side in [-1,1]:
                self.extrusion("Goat horn",[(.085+side*.055,-.065,1.16),(.085+side*.09,-.015,1.29),(.085+side*.12,.09,1.26)],[.025,.025,.001],self.ivory)
            self.eye(.095,-.238,1.16,.018)
            self.eye(.28,-.34,1.13,.018)

    def finish(self):
        for obj in self.parts: self.active(obj)
        bpy.ops.object.select_all(action="DESELECT")
        for obj in self.parts: obj.select_set(True)
        bpy.context.view_layer.objects.active=self.parts[0]
        bpy.ops.object.join()
        obj=bpy.context.object
        obj.name=self.species+" sculpt"
        # Keep the complete sculpt as the editable source; export works on a separate duplicate.
        obj["concept"] = self.species+"-concept.png"
        bpy.context.scene["species"]=self.species
        bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(self.species+".blend")))


if __name__=="__main__":
    species=sys.argv[sys.argv.index("--")+1]
    tones={"minotaur":(.17,.21,.24),"cyclops":(.28,.30,.22),"goblin":(.24,.30,.11),"wolf":(.28,.27,.22),"chimera":(.40,.23,.10)}
    creature=Creature(species,tones[species])
    if species in ["wolf","chimera"]: creature.quadruped()
    else: creature.biped()
    creature.finish()
