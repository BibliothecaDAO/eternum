//! The patch's renderer: a shadow pass fitted to the view, the scene into an HDR target, one full-screen pass that
//! lights the air and grades the frame, and a last pass that smooths its edges.

use std::cell::Cell;

use glam::{Mat4, Vec3, Vec4};
use wgpu::util::DeviceExt;

use crate::kit;
use crate::scatter;
use crate::scene::{floats, Kind, MeshRecord, Snapshot, INSTANCE_FLOATS, VERTEX_FLOATS};
use crate::shapes::{Build, RIG_FLOATS};
use crate::troops::{self, Role, ROLES};
use crate::world::{self, World};

const DEPTH_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Depth32Float;
const SCENE_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba16Float;
const GRADED_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba8Unorm;
/// The widest stretch of ground the shadow map is ever fitted round, and the narrowest.
const SHADOW_REACH: (f32, f32) = (5.0, 34.0);
const INSTANCE_BYTES: u64 = (INSTANCE_FLOATS * 4) as u64;
/// The side of the squares of ground units are batched by, to be culled and turned finer or coarser together.
const BATCH_CELL: f32 = 4.0;

#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct Globals {
    view_proj: [f32; 16],
    inv_view_proj: [f32; 16],
    light_view_proj: [f32; 16],
    eye: [f32; 4],
    toward_light: [f32; 4],
    light_colour: [f32; 4],
    sky: [f32; 4],
    ground: [f32; 4],
    hex_and_screen: [f32; 4],
    world_bounds: [f32; 4],
    water: [f32; 4],
    quality: [f32; 4],
    camera_right: [f32; 4],
    camera_up: [f32; 4],
    order_from: [f32; 4],
    order_to: [f32; 4],
}

/// Where the camera stands and how it sees, as the page's camera holds it.
pub struct Camera {
    pub world: Mat4,
    pub fov_y_radians: f32,
    pub near: f32,
    pub far: f32,
}

/// How much the renderer spends on a frame: the ladder a weak phone steps down.
#[derive(Clone, Copy)]
pub struct Tier {
    shadow_size: u32,
    soft_shadows: bool,
    contact_taps: f32,
    mist_steps: f32,
    smooth_edges: bool,
    /// How far from the eye units are still drawn with their limbs fully turned; how far with them half turned,
    /// casting shadows into the map (further off, each has only the soft shadow under it); and how far with their
    /// effects.
    fine_units: f32,
    middling_units: f32,
    effects: f32,
}

impl Tier {
    pub fn named(name: &str) -> Result<Tier, String> {
        match name {
            "high" => Ok(Tier {
                shadow_size: 2048,
                soft_shadows: true,
                contact_taps: 8.0,
                mist_steps: 8.0,
                smooth_edges: true,
                fine_units: 10.0,
                middling_units: 30.0,
                effects: 45.0,
            }),
            "mid" => Ok(Tier {
                shadow_size: 1024,
                soft_shadows: true,
                contact_taps: 6.0,
                mist_steps: 6.0,
                smooth_edges: true,
                fine_units: 5.0,
                middling_units: 14.0,
                effects: 28.0,
            }),
            "low" => Ok(Tier {
                shadow_size: 1024,
                soft_shadows: false,
                contact_taps: 4.0,
                mist_steps: 4.0,
                smooth_edges: false,
                fine_units: 3.0,
                middling_units: 0.0,
                effects: 16.0,
            }),
            other => Err(format!("No quality tier is called {other}")),
        }
    }
}

struct Geometry {
    vertices: wgpu::Buffer,
    indices: wgpu::Buffer,
    index_count: u32,
}

struct Mesh {
    material: wgpu::BindGroup,
    geometry: Geometry,
    instances: wgpu::Buffer,
    instance_count: u32,
    casts_shadow: bool,
    /// Where a mesh of the scatter is, and how far from the eye it is still drawn; none for a mesh always drawn.
    within: Option<(Vec3, f32, f32)>,
}

/// A run of a troop's instances that stand together.
struct Batch {
    first: u32,
    count: u32,
    centre: Vec3,
    radius: f32,
}

/// What one texture paints of a build, at three finenesses: fine, middling and coarse, each with what it is drawn
/// with.
struct Skin {
    levels: [(Geometry, wgpu::BindGroup); 3],
}

/// Every unit of one build: its skins, and its instances in batches. A troop starts with no units; the page
/// hands them in as the game's facts change.
struct Troop {
    role: Role,
    skins: Vec<Skin>,
    instances: wgpu::Buffer,
    batches: Vec<Batch>,
}

struct Units {
    troops: Vec<Troop>,
    effects: Geometry,
}

struct Pipelines {
    scene: wgpu::RenderPipeline,
    shadow: wgpu::RenderPipeline,
    unit: wgpu::RenderPipeline,
    unit_shadow: wgpu::RenderPipeline,
    effect: wgpu::RenderPipeline,
    post: wgpu::RenderPipeline,
    smooth: Option<wgpu::RenderPipeline>,
}

/// The targets a frame is drawn through, at the surface's size.
struct Targets {
    colour: wgpu::TextureView,
    depth: wgpu::TextureView,
    post_group: wgpu::BindGroup,
    graded: Option<(wgpu::TextureView, wgpu::BindGroup)>,
}

pub struct Renderer {
    surface: wgpu::Surface<'static>,
    surface_config: wgpu::SurfaceConfiguration,
    device: wgpu::Device,
    queue: wgpu::Queue,
    tier: Tier,
    globals: wgpu::Buffer,
    globals_group: wgpu::BindGroup,
    shadow_view: wgpu::TextureView,
    shadow_group: wgpu::BindGroup,
    /// A one-texel shadow map, bound while the real one is being drawn into.
    blank_shadow_group: wgpu::BindGroup,
    land_group: wgpu::BindGroup,
    pipelines: Pipelines,
    post_layout: wgpu::BindGroupLayout,
    smooth_layout: wgpu::BindGroupLayout,
    targets: Targets,
    /// What the post pass reads of the land: its features and its palette.
    land_maps: [wgpu::TextureView; 2],
    sampler: wgpu::Sampler,
    meshes: Vec<Mesh>,
    units: Units,
    light: crate::scene::Light,
    world_bounds: [f32; 4],
    water_level: f32,
    hex_spacing: [f32; 2],
    /// An order shown on the map: the picked army's hex, the two it crosses and the one it is sent to.
    order: Option<[glam::Vec2; 4]>,
    draws: Cell<usize>,
}

/// What a frame is seen from: the eye, its planes, and where units are still drawn fine.
struct View {
    eye: Vec3,
    planes: [Vec4; 6],
}

impl View {
    fn of(view_proj: Mat4, eye: Vec3) -> View {
        let row = |index| view_proj.row(index);
        let planes = [
            row(3) + row(0),
            row(3) - row(0),
            row(3) + row(1),
            row(3) - row(1),
            row(2),
            row(3) - row(2),
        ]
        .map(|plane: Vec4| plane / plane.truncate().length());
        View { eye, planes }
    }

    /// How far the eye is from a batch's units, taken half way between its middle and the nearest they may be: a
    /// batch is turned finer when most of it is near, not when its nearest corner is.
    fn distance_to(&self, batch: &Batch) -> f32 {
        (batch.centre - self.eye).length() - batch.radius * 0.5
    }

    fn sees(&self, centre: Vec3, radius: f32) -> bool {
        self.planes
            .iter()
            .all(|plane| plane.truncate().dot(centre) + plane.w > -radius)
    }
}

impl Renderer {
    pub async fn new(
        instance: wgpu::Instance,
        surface: wgpu::Surface<'static>,
        size: (u32, u32),
        snapshot: &Snapshot,
        buffer: &[u8],
        hex_spacing: [f32; 2],
        tier: Tier,
    ) -> Result<Self, String> {
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .ok_or("No GPU adapter draws to this surface")?;
        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("lab-renderer"),
                    required_features: wgpu::Features::empty(),
                    // WebGL2's limits where the adapter is WebGL2; the adapter's own otherwise.
                    required_limits: wgpu::Limits::downlevel_webgl2_defaults()
                        .using_resolution(adapter.limits()),
                    memory_hints: wgpu::MemoryHints::Performance,
                },
                None,
            )
            .await
            .map_err(|error| error.to_string())?;
        let surface_config = surface
            .get_default_config(&adapter, size.0.max(1), size.1.max(1))
            .ok_or("The surface has no format this adapter draws")?;
        surface.configure(&device, &surface_config);

        let globals = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("globals"),
            size: std::mem::size_of::<Globals>() as u64,
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let globals_layout = uniform_layout(&device, "globals");
        let globals_group = uniform_group(&device, &globals_layout, &globals);
        let material_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("material"),
            entries: &[
                uniform_entry(0),
                texture_entry(1, wgpu::TextureSampleType::Float { filterable: true }),
                sampler_entry(2, wgpu::SamplerBindingType::Filtering),
            ],
        });
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("linear"),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        let materials = Materials::new(&device, &queue, material_layout, snapshot, buffer);
        let material_layout = &materials.layout;

        let shadow_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("shadow"),
            entries: &[
                texture_entry(0, wgpu::TextureSampleType::Depth),
                sampler_entry(1, wgpu::SamplerBindingType::Comparison),
            ],
        });
        let shadow_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("shadow"),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            compare: Some(wgpu::CompareFunction::LessEqual),
            ..Default::default()
        });
        let shadow_size = (tier.shadow_size, tier.shadow_size);
        let shadow_view = create_target(&device, "shadow", shadow_size, DEPTH_FORMAT);
        let blank_shadow = create_target(&device, "blank shadow", (1, 1), DEPTH_FORMAT);
        let shadow_group_of =
            |view| texture_group(&device, &shadow_layout, &[view], &[&shadow_sampler]);
        let shadow_group = shadow_group_of(&shadow_view);
        let blank_shadow_group = shadow_group_of(&blank_shadow);

        let world = World::read(snapshot, buffer, hex_spacing[0]);
        let land_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("land"),
            entries: &[
                texture_entry(0, wgpu::TextureSampleType::Float { filterable: true }),
                texture_entry(1, wgpu::TextureSampleType::Float { filterable: true }),
                texture_entry(2, wgpu::TextureSampleType::Float { filterable: true }),
                texture_entry(3, wgpu::TextureSampleType::Float { filterable: true }),
                texture_entry(4, wgpu::TextureSampleType::Float { filterable: true }),
                sampler_entry(5, wgpu::SamplerBindingType::Filtering),
                sampler_entry(6, wgpu::SamplerBindingType::Filtering),
            ],
        });
        let land = upload_land(&device, &queue, &land_layout, &world, &sampler);
        let land_group = land.group;

        let scene_layouts = [
            &globals_layout,
            material_layout,
            &shadow_layout,
            &land_layout,
        ];
        let mesh_shader = shader(&device, "mesh", &[GLOBALS, LIT, include_str!("mesh.wgsl")]);
        let unit_shader = shader(&device, "unit", &[GLOBALS, LIT, include_str!("unit.wgsl")]);
        let post_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("post"),
            entries: &[
                texture_entry(0, wgpu::TextureSampleType::Float { filterable: false }),
                texture_entry(1, wgpu::TextureSampleType::Float { filterable: true }),
                texture_entry(2, wgpu::TextureSampleType::Float { filterable: true }),
                sampler_entry(3, wgpu::SamplerBindingType::Filtering),
            ],
        });
        let smooth_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("smooth"),
            entries: &[
                texture_entry(0, wgpu::TextureSampleType::Float { filterable: true }),
                sampler_entry(1, wgpu::SamplerBindingType::Filtering),
            ],
        });
        let post_shader = shader(&device, "post", &[GLOBALS, include_str!("post.wgsl")]);
        let smooth_shader = shader(&device, "smooth", &[GLOBALS, include_str!("fxaa.wgsl")]);
        let screen = surface_config.format;
        let pipelines = Pipelines {
            scene: surface_pipeline(
                &device,
                "scene",
                &mesh_shader,
                &scene_layouts,
                Vertices::Mesh,
                Draws::Lit,
            ),
            shadow: surface_pipeline(
                &device,
                "shadow",
                &mesh_shader,
                &scene_layouts,
                Vertices::Mesh,
                Draws::Shadow,
            ),
            unit: surface_pipeline(
                &device,
                "units",
                &unit_shader,
                &scene_layouts,
                Vertices::Rig,
                Draws::Lit,
            ),
            unit_shadow: surface_pipeline(
                &device,
                "unit shadows",
                &unit_shader,
                &scene_layouts,
                Vertices::Rig,
                Draws::Shadow,
            ),
            effect: surface_pipeline(
                &device,
                "effects",
                &unit_shader,
                &scene_layouts,
                Vertices::Rig,
                Draws::Effect,
            ),
            post: if tier.smooth_edges {
                screen_pipeline(
                    &device,
                    "post",
                    &post_shader,
                    "fs_encoded",
                    &[&globals_layout, &post_layout],
                    GRADED_FORMAT,
                )
            } else {
                screen_pipeline(
                    &device,
                    "post",
                    &post_shader,
                    "fs",
                    &[&globals_layout, &post_layout],
                    screen,
                )
            },
            smooth: tier.smooth_edges.then(|| {
                screen_pipeline(
                    &device,
                    "smooth",
                    &smooth_shader,
                    "fs",
                    &[&globals_layout, &smooth_layout],
                    screen,
                )
            }),
        };

        let mut meshes: Vec<Mesh> = snapshot
            .meshes
            .iter()
            .map(|record| {
                let companions = scatter::companions(snapshot, buffer, &world, record);
                upload_mesh(&device, &materials, record, buffer, &companions)
            })
            .collect();
        let scattered = scatter::scatter(&world);
        meshes.extend(
            scattered
                .iter()
                .map(|grown| upload_scattered(&device, &materials, grown)),
        );
        // A land may hold a mesh nothing stands in, or one with nothing to draw: neither has a buffer to bind.
        meshes.retain(|mesh| mesh.instance_count > 0 && mesh.geometry.index_count > 0);
        let units = upload_troops(&device, &materials, snapshot, buffer);
        let land_maps = [land.features, land.palette];
        let size = (surface_config.width, surface_config.height);
        let targets = create_targets(
            &device,
            size,
            &post_layout,
            &smooth_layout,
            &land_maps,
            &sampler,
            tier,
        );

        Ok(Self {
            surface,
            surface_config,
            device,
            queue,
            tier,
            globals,
            globals_group,
            shadow_view,
            shadow_group,
            blank_shadow_group,
            land_group,
            pipelines,
            post_layout,
            smooth_layout,
            targets,
            land_maps,
            sampler,
            meshes,
            units,
            light: snapshot.light.clone(),
            world_bounds: world.bounds,
            water_level: world.water_level,
            hex_spacing,
            order: None,
            draws: Cell::new(0),
        })
    }

    pub fn resize(&mut self, width: u32, height: u32) {
        if width == 0
            || height == 0
            || (width, height) == (self.surface_config.width, self.surface_config.height)
        {
            return;
        }
        self.surface_config.width = width;
        self.surface_config.height = height;
        self.surface.configure(&self.device, &self.surface_config);
        self.targets = create_targets(
            &self.device,
            (width, height),
            &self.post_layout,
            &self.smooth_layout,
            &self.land_maps,
            &self.sampler,
            self.tier,
        );
    }

    /// Replaces the units of one build: twenty floats a unit, as `unit.wgsl` reads an instance.
    pub fn set_troop(&mut self, role: Role, instances: &[f32]) {
        let Some(troop) = self
            .units
            .troops
            .iter_mut()
            .find(|troop| troop.role == role)
        else {
            return;
        };
        let (sorted, batches) = batched(instances);
        troop.instances = upload_instances(&self.device, bytemuck::cast_slice(&sorted));
        troop.batches = batches;
    }

    /// Shows an order on the map: the picked army's hex, the two it crosses and the one it is sent to. None
    /// clears it.
    pub fn show_order(&mut self, stops: Option<[glam::Vec2; 4]>) {
        self.order = stops;
    }

    /// Draws one frame of the patch from the camera at the world clock's `seconds`.
    pub fn render(&mut self, camera: &Camera, seconds: f32) -> Result<(), String> {
        let (view, light) = self.write_globals(camera, seconds);
        let frame = self
            .surface
            .get_current_texture()
            .map_err(|error| error.to_string())?;
        let target = frame.texture.create_view(&Default::default());
        let mut encoder = self.device.create_command_encoder(&Default::default());
        self.draws.set(0);
        self.draw_shadows(&mut encoder, &light, &view);
        self.draw_scene(&mut encoder, &view);
        match &self.targets.graded {
            Some((graded, smooth_group)) => {
                self.draw_screen(
                    &mut encoder,
                    graded,
                    &self.pipelines.post,
                    &self.targets.post_group,
                );
                let smooth = self
                    .pipelines
                    .smooth
                    .as_ref()
                    .expect("a tier that smooths edges");
                self.draw_screen(&mut encoder, &target, smooth, smooth_group);
            }
            None => self.draw_screen(
                &mut encoder,
                &target,
                &self.pipelines.post,
                &self.targets.post_group,
            ),
        }
        self.queue.submit([encoder.finish()]);
        frame.present();
        Ok(())
    }

    /// Writes what every pass reads, and returns the frame's view and the stretch of ground its shadows cover.
    fn write_globals(&self, camera: &Camera, seconds: f32) -> (View, LitGround) {
        let (width, height) = (
            self.surface_config.width as f32,
            self.surface_config.height as f32,
        );
        let projection = Mat4::perspective_rh(
            camera.fov_y_radians,
            width / height,
            camera.near,
            camera.far,
        );
        let view_proj = projection * camera.world.inverse();
        let inv_view_proj = view_proj.inverse();
        let eye = camera.world.w_axis.truncate();
        let toward = Vec3::from(self.light.toward).normalize();
        let light = LitGround::in_view(inv_view_proj, eye, toward, self.tier.shadow_size);
        let with = |rgb: [f32; 3], w: f32| [rgb[0], rgb[1], rgb[2], w];
        let stops = self.order.unwrap_or_default();
        let globals = Globals {
            view_proj: view_proj.to_cols_array(),
            inv_view_proj: inv_view_proj.to_cols_array(),
            light_view_proj: light.view_proj.to_cols_array(),
            eye: [eye.x, eye.y, eye.z, seconds],
            toward_light: with(
                toward.to_array(),
                f32::from(u8::from(self.surface_config.format.is_srgb())),
            ),
            light_colour: with(self.light.colour, light.texel),
            sky: with(self.light.sky, 0.0),
            ground: with(self.light.ground, 0.0),
            hex_and_screen: [self.hex_spacing[0], self.hex_spacing[1], width, height],
            world_bounds: self.world_bounds,
            water: [
                self.water_level,
                f32::from(u8::from(self.order.is_some())),
                0.0,
                0.0,
            ],
            quality: [
                f32::from(u8::from(self.tier.soft_shadows)),
                self.tier.contact_taps,
                self.tier.mist_steps,
                self.tier.shadow_size as f32,
            ],
            camera_right: camera.world.x_axis.to_array(),
            camera_up: camera.world.y_axis.to_array(),
            order_from: [stops[0].x, stops[0].y, stops[1].x, stops[1].y],
            order_to: [stops[2].x, stops[2].y, stops[3].x, stops[3].y],
        };
        self.queue
            .write_buffer(&self.globals, 0, bytemuck::bytes_of(&globals));
        (View::of(view_proj, eye), light)
    }

    fn draw_shadows(&self, encoder: &mut wgpu::CommandEncoder, light: &LitGround, view: &View) {
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("shadow"),
            color_attachments: &[],
            depth_stencil_attachment: Some(depth_attachment(&self.shadow_view)),
            ..Default::default()
        });
        pass.set_bind_group(0, &self.globals_group, &[]);
        // Every pipeline's layout names the shadow map, which this pass is drawing: a blank one stands in.
        pass.set_bind_group(2, &self.blank_shadow_group, &[]);
        pass.set_bind_group(3, &self.land_group, &[]);
        pass.set_pipeline(&self.pipelines.shadow);
        self.draw_meshes(&mut pass, view, |mesh| mesh.casts_shadow);
        let units = &self.units;
        pass.set_pipeline(&self.pipelines.unit_shadow);
        for troop in &units.troops {
            let casts = |batch: &&Batch| {
                (batch.centre - light.centre).length() < light.radius + batch.radius
                    && view.distance_to(batch) < self.tier.middling_units
            };
            for skin in &troop.skins {
                let (coarse, material) = &skin.levels[2];
                pass.set_bind_group(1, material, &[]);
                for batch in troop.batches.iter().filter(casts) {
                    self.draw_batch(&mut pass, coarse, &troop.instances, batch);
                }
            }
        }
    }

    fn draw_scene(&self, encoder: &mut wgpu::CommandEncoder, view: &View) {
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("scene"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: &self.targets.colour,
                resolve_target: None,
                ops: wgpu::Operations {
                    // Where nothing is drawn, at no distance from the eye, the post pass paints the sky or the
                    // floor of the unknown.
                    load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                    store: wgpu::StoreOp::Store,
                },
            })],
            depth_stencil_attachment: Some(depth_attachment(&self.targets.depth)),
            ..Default::default()
        });
        pass.set_bind_group(0, &self.globals_group, &[]);
        pass.set_bind_group(2, &self.shadow_group, &[]);
        pass.set_bind_group(3, &self.land_group, &[]);
        pass.set_pipeline(&self.pipelines.scene);
        self.draw_meshes(&mut pass, view, |_| true);
        let units = &self.units;
        pass.set_pipeline(&self.pipelines.unit);
        for troop in &units.troops {
            for skin in &troop.skins {
                for batch in troop
                    .batches
                    .iter()
                    .filter(|batch| view.sees(batch.centre, batch.radius))
                {
                    let distance = view.distance_to(batch);
                    let level = if distance < self.tier.fine_units {
                        0
                    } else if distance < self.tier.middling_units {
                        1
                    } else {
                        2
                    };
                    let (geometry, material) = &skin.levels[level];
                    pass.set_bind_group(1, material, &[]);
                    self.draw_batch(&mut pass, geometry, &troop.instances, batch);
                }
            }
        }
        // What is drawn over the scene, blended: the shadow, trail and dust of every unit on two feet.
        pass.set_pipeline(&self.pipelines.effect);
        let in_reach = |batch: &&Batch| {
            view.sees(batch.centre, batch.radius) && view.distance_to(batch) < self.tier.effects
        };
        for troop in &units.troops {
            pass.set_bind_group(1, &troop.skins[0].levels[2].1, &[]);
            for batch in troop.batches.iter().filter(in_reach) {
                self.draw_batch(&mut pass, &units.effects, &troop.instances, batch);
            }
        }
    }

    fn draw_batch<'pass>(
        &'pass self,
        pass: &mut wgpu::RenderPass<'pass>,
        geometry: &'pass Geometry,
        instances: &'pass wgpu::Buffer,
        batch: &Batch,
    ) {
        // A small part may be cut away altogether at a coarse fineness.
        if geometry.index_count == 0 {
            return;
        }
        // The batch's run is bound from its first instance: WebGL2 has no draw that starts at one.
        pass.set_vertex_buffer(0, geometry.vertices.slice(..));
        pass.set_vertex_buffer(1, instances.slice(batch.first as u64 * INSTANCE_BYTES..));
        pass.set_index_buffer(geometry.indices.slice(..), wgpu::IndexFormat::Uint32);
        pass.draw_indexed(0..geometry.index_count, 0, 0..batch.count);
        self.draws.set(self.draws.get() + 1);
    }

    fn draw_meshes<'pass>(
        &'pass self,
        pass: &mut wgpu::RenderPass<'pass>,
        view: &View,
        wanted: impl Fn(&Mesh) -> bool,
    ) {
        let in_view = |mesh: &&Mesh| {
            mesh.within.is_none_or(|(centre, radius, reach)| {
                view.sees(centre, radius) && (centre - view.eye).length() - radius < reach
            })
        };
        for mesh in self
            .meshes
            .iter()
            .filter(|mesh| wanted(mesh))
            .filter(in_view)
        {
            pass.set_bind_group(1, &mesh.material, &[]);
            pass.set_vertex_buffer(0, mesh.geometry.vertices.slice(..));
            pass.set_vertex_buffer(1, mesh.instances.slice(..));
            pass.set_index_buffer(mesh.geometry.indices.slice(..), wgpu::IndexFormat::Uint32);
            pass.draw_indexed(0..mesh.geometry.index_count, 0, 0..mesh.instance_count);
            self.draws.set(self.draws.get() + 1);
        }
    }

    fn draw_screen(
        &self,
        encoder: &mut wgpu::CommandEncoder,
        target: &wgpu::TextureView,
        pipeline: &wgpu::RenderPipeline,
        group: &wgpu::BindGroup,
    ) {
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("screen"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: target,
                resolve_target: None,
                ops: wgpu::Operations {
                    load: wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                    store: wgpu::StoreOp::Store,
                },
            })],
            ..Default::default()
        });
        pass.set_pipeline(pipeline);
        pass.set_bind_group(0, &self.globals_group, &[]);
        pass.set_bind_group(1, group, &[]);
        pass.draw(0..3, 0..1);
    }

    /// How many draws the last frame made.
    pub fn draw_count(&self) -> usize {
        self.draws.get()
    }
}

/// The stretch of ground the shadow map covers this frame: what the camera sees of it, and no more.
struct LitGround {
    view_proj: Mat4,
    centre: Vec3,
    radius: f32,
    /// The width of ground one texel covers.
    texel: f32,
}

impl LitGround {
    fn in_view(inv_view_proj: Mat4, eye: Vec3, toward_light: Vec3, map_size: u32) -> LitGround {
        // Where the view's corners meet the ground, none further than the widest reach.
        let corners = [(-1.0, -1.0), (1.0, -1.0), (1.0, 1.0), (-1.0, 1.0)].map(|(x, y)| {
            let far = inv_view_proj.project_point3(Vec3::new(x, y, 1.0));
            let ray = (far - eye).normalize();
            let to_ground = if ray.y < -0.01 {
                -eye.y / ray.y
            } else {
                f32::MAX
            };
            eye + ray * to_ground.min(SHADOW_REACH.1 * 2.0)
        });
        let middle = corners.iter().sum::<Vec3>() / 4.0;
        let widest = corners
            .iter()
            .map(|corner| (*corner - middle).length())
            .fold(0.0, f32::max);
        // The reach goes up in steps, so a slow zoom does not make every shadow's edge crawl.
        let wanted = (widest + 1.5).clamp(SHADOW_REACH.0, SHADOW_REACH.1);
        let radius = 1.2_f32.powf((wanted.ln() / 1.2_f32.ln()).ceil());
        let texel = radius * 2.0 / map_size as f32;
        // The map moves by whole texels, so a pan does not either.
        let right = Vec3::Y.cross(toward_light).normalize();
        let up = toward_light.cross(right);
        let snap =
            |along: Vec3| along * ((middle.dot(along) / texel).round() * texel - middle.dot(along));
        let centre = Vec3::new(middle.x, 0.0, middle.z) + snap(right) + snap(up);
        let view = Mat4::look_at_rh(centre + toward_light * 80.0, centre, Vec3::Y);
        let view_proj = Mat4::orthographic_rh(-radius, radius, -radius, radius, 1.0, 160.0) * view;
        LitGround {
            view_proj,
            centre,
            radius,
            texel,
        }
    }
}

const GLOBALS: &str = include_str!("globals.wgsl");
const LIT: &str = include_str!("lit.wgsl");

fn shader(device: &wgpu::Device, label: &str, sources: &[&str]) -> wgpu::ShaderModule {
    device.create_shader_module(wgpu::ShaderModuleDescriptor {
        label: Some(label),
        source: wgpu::ShaderSource::Wgsl(sources.concat().into()),
    })
}

fn uniform_entry(binding: u32) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
        ty: wgpu::BindingType::Buffer {
            ty: wgpu::BufferBindingType::Uniform,
            has_dynamic_offset: false,
            min_binding_size: None,
        },
        count: None,
    }
}

fn uniform_layout(device: &wgpu::Device, label: &str) -> wgpu::BindGroupLayout {
    device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some(label),
        entries: &[uniform_entry(0)],
    })
}

/// How each mesh is shaded: its kind, and the texture that paints it.
struct Materials {
    layout: wgpu::BindGroupLayout,
    kinds: [wgpu::Buffer; 5],
    /// The snapshot's textures, and after them a white one for a mesh with none.
    textures: Vec<wgpu::TextureView>,
    sampler: wgpu::Sampler,
}

impl Materials {
    fn new(
        device: &wgpu::Device,
        queue: &wgpu::Queue,
        layout: wgpu::BindGroupLayout,
        snapshot: &Snapshot,
        buffer: &[u8],
    ) -> Materials {
        let kinds = [
            Kind::Solid,
            Kind::Ground,
            Kind::Water,
            Kind::Plant,
            Kind::Bird,
        ]
        .map(|kind| {
            device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
                label: Some("material"),
                contents: bytemuck::cast_slice(&[kind as u32 as f32, 0.0, 0.0, 0.0]),
                usage: wgpu::BufferUsages::UNIFORM,
            })
        });
        let painted = snapshot.textures.iter().map(|record| {
            let bytes = (record.size * record.size * 4) as usize;
            (record.size, &buffer[record.offset..record.offset + bytes])
        });
        let white = [255u8; 4];
        // Each with its smaller copies: a model far off is painted from one of them, which is quicker and steadier.
        let textures = painted
            .chain([(1, &white[..])])
            .map(|(size, texels)| {
                upload_texture(
                    device,
                    queue,
                    "paint",
                    size,
                    world::levels_of(size as usize),
                    wgpu::TextureFormat::Rgba8Unorm,
                    &world::with_smaller_copies(texels.to_vec(), size as usize),
                )
            })
            .collect();
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("paint"),
            address_mode_u: wgpu::AddressMode::Repeat,
            address_mode_v: wgpu::AddressMode::Repeat,
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            mipmap_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });
        Materials {
            layout,
            kinds,
            textures,
            sampler,
        }
    }

    fn of(&self, device: &wgpu::Device, kind: Kind, texture: i32) -> wgpu::BindGroup {
        self.group(device, &self.kinds[kind as usize], texture)
    }

    /// What a build's skin is drawn with: the build's measures, and the texture that paints the skin.
    fn of_build(&self, device: &wgpu::Device, build: &Build, texture: i32) -> wgpu::BindGroup {
        let measures = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("build"),
            contents: bytemuck::bytes_of(build),
            usage: wgpu::BufferUsages::UNIFORM,
        });
        self.group(device, &measures, texture)
    }

    fn group(
        &self,
        device: &wgpu::Device,
        uniform: &wgpu::Buffer,
        texture: i32,
    ) -> wgpu::BindGroup {
        let white = self.textures.len() - 1;
        let texture = usize::try_from(texture).map_or(white, |index| index.min(white));
        device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: None,
            layout: &self.layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: uniform.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: wgpu::BindingResource::TextureView(&self.textures[texture]),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: wgpu::BindingResource::Sampler(&self.sampler),
                },
            ],
        })
    }
}

fn upload_texture(
    device: &wgpu::Device,
    queue: &wgpu::Queue,
    label: &str,
    size: u32,
    levels: u32,
    format: wgpu::TextureFormat,
    texels: &[u8],
) -> wgpu::TextureView {
    device
        .create_texture_with_data(
            queue,
            &wgpu::TextureDescriptor {
                label: Some(label),
                size: wgpu::Extent3d {
                    width: size,
                    height: size,
                    depth_or_array_layers: 1,
                },
                mip_level_count: levels,
                sample_count: 1,
                dimension: wgpu::TextureDimension::D2,
                format,
                usage: wgpu::TextureUsages::TEXTURE_BINDING,
                view_formats: &[],
            },
            wgpu::util::TextureDataOrder::LayerMajor,
            texels,
        )
        .create_view(&Default::default())
}

fn uniform_group(
    device: &wgpu::Device,
    layout: &wgpu::BindGroupLayout,
    buffer: &wgpu::Buffer,
) -> wgpu::BindGroup {
    device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: None,
        layout,
        entries: &[wgpu::BindGroupEntry {
            binding: 0,
            resource: buffer.as_entire_binding(),
        }],
    })
}

fn texture_entry(binding: u32, sample_type: wgpu::TextureSampleType) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
        ty: wgpu::BindingType::Texture {
            sample_type,
            view_dimension: wgpu::TextureViewDimension::D2,
            multisampled: false,
        },
        count: None,
    }
}

fn sampler_entry(binding: u32, kind: wgpu::SamplerBindingType) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding,
        visibility: wgpu::ShaderStages::VERTEX_FRAGMENT,
        ty: wgpu::BindingType::Sampler(kind),
        count: None,
    }
}

/// A group of textures, then samplers, bound in that order from 0.
fn texture_group(
    device: &wgpu::Device,
    layout: &wgpu::BindGroupLayout,
    textures: &[&wgpu::TextureView],
    samplers: &[&wgpu::Sampler],
) -> wgpu::BindGroup {
    let textures = textures
        .iter()
        .map(|view| wgpu::BindingResource::TextureView(view));
    let samplers = samplers
        .iter()
        .map(|sampler| wgpu::BindingResource::Sampler(sampler));
    let entries: Vec<wgpu::BindGroupEntry> = textures
        .chain(samplers)
        .enumerate()
        .map(|(binding, resource)| wgpu::BindGroupEntry {
            binding: binding as u32,
            resource,
        })
        .collect();
    device.create_bind_group(&wgpu::BindGroupDescriptor {
        label: None,
        layout,
        entries: &entries,
    })
}

fn create_target(
    device: &wgpu::Device,
    label: &str,
    size: (u32, u32),
    format: wgpu::TextureFormat,
) -> wgpu::TextureView {
    device
        .create_texture(&wgpu::TextureDescriptor {
            label: Some(label),
            size: wgpu::Extent3d {
                width: size.0,
                height: size.1,
                depth_or_array_layers: 1,
            },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        })
        .create_view(&Default::default())
}

fn create_targets(
    device: &wgpu::Device,
    size: (u32, u32),
    post_layout: &wgpu::BindGroupLayout,
    smooth_layout: &wgpu::BindGroupLayout,
    land_maps: &[wgpu::TextureView; 2],
    sampler: &wgpu::Sampler,
    tier: Tier,
) -> Targets {
    let colour = create_target(device, "scene colour", size, SCENE_FORMAT);
    let depth = create_target(device, "scene depth", size, DEPTH_FORMAT);
    let post_group = texture_group(
        device,
        post_layout,
        &[&colour, &land_maps[0], &land_maps[1]],
        &[sampler],
    );
    let graded = tier.smooth_edges.then(|| {
        let graded = create_target(device, "graded", size, GRADED_FORMAT);
        let group = texture_group(device, smooth_layout, &[&graded], &[sampler]);
        (graded, group)
    });
    Targets {
        colour,
        depth,
        post_group,
        graded,
    }
}

fn depth_attachment(view: &wgpu::TextureView) -> wgpu::RenderPassDepthStencilAttachment<'_> {
    wgpu::RenderPassDepthStencilAttachment {
        view,
        depth_ops: Some(wgpu::Operations {
            load: wgpu::LoadOp::Clear(1.0),
            store: wgpu::StoreOp::Store,
        }),
        stencil_ops: None,
    }
}

/// Which vertices a pipeline reads: the patch's meshes, or a figure with its bones.
#[derive(Clone, Copy, PartialEq)]
enum Vertices {
    Mesh,
    Rig,
}

/// What a pipeline over the scene draws: lit surfaces into the HDR target, depth into the shadow map, or effects
/// blended over the lit scene.
#[derive(Clone, Copy, PartialEq)]
enum Draws {
    Lit,
    Shadow,
    Effect,
}

fn surface_pipeline(
    device: &wgpu::Device,
    label: &str,
    module: &wgpu::ShaderModule,
    layouts: &[&wgpu::BindGroupLayout],
    vertices: Vertices,
    draws: Draws,
) -> wgpu::RenderPipeline {
    let mesh_vertex =
        wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3, 2 => Float32x4, 3 => Float32x2];
    let rig_vertex = wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3, 2 => Float32x4, 3 => Float32x4, 9 => Float32x2, 10 => Float32x2, 11 => Float32x3];
    let instance_attributes = wgpu::vertex_attr_array![4 => Float32x4, 5 => Float32x4, 6 => Float32x4, 7 => Float32x4, 8 => Float32x4];
    let (vertex_floats, vertex_attributes): (usize, &[_]) = match vertices {
        Vertices::Mesh => (VERTEX_FLOATS, &mesh_vertex),
        Vertices::Rig => (RIG_FLOATS, &rig_vertex),
    };
    let blended = wgpu::ColorTargetState {
        format: SCENE_FORMAT,
        blend: Some(wgpu::BlendState::ALPHA_BLENDING),
        write_mask: wgpu::ColorWrites::COLOR,
    };
    let targets = match draws {
        Draws::Lit => vec![Some(SCENE_FORMAT.into())],
        Draws::Effect => vec![Some(blended)],
        Draws::Shadow => vec![],
    };
    let (vertex_entry, fragment_entry) = match draws {
        Draws::Lit => ("vs", Some("fs")),
        Draws::Effect => ("vs_effect", Some("fs_effect")),
        Draws::Shadow => ("vs_shadow", None),
    };
    device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: Some(label),
        layout: Some(
            &device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some(label),
                bind_group_layouts: layouts,
                push_constant_ranges: &[],
            }),
        ),
        vertex: wgpu::VertexState {
            module,
            entry_point: Some(vertex_entry),
            compilation_options: Default::default(),
            buffers: &[
                wgpu::VertexBufferLayout {
                    array_stride: (vertex_floats * 4) as u64,
                    step_mode: wgpu::VertexStepMode::Vertex,
                    attributes: vertex_attributes,
                },
                wgpu::VertexBufferLayout {
                    array_stride: INSTANCE_BYTES,
                    step_mode: wgpu::VertexStepMode::Instance,
                    attributes: &instance_attributes,
                },
            ],
        },
        fragment: fragment_entry.map(|entry| wgpu::FragmentState {
            module,
            entry_point: Some(entry),
            compilation_options: Default::default(),
            targets: &targets,
        }),
        primitive: wgpu::PrimitiveState {
            cull_mode: None,
            ..Default::default()
        },
        depth_stencil: Some(wgpu::DepthStencilState {
            format: DEPTH_FORMAT,
            depth_write_enabled: draws != Draws::Effect,
            depth_compare: wgpu::CompareFunction::Less,
            stencil: Default::default(),
            bias: wgpu::DepthBiasState {
                constant: if draws == Draws::Shadow { 2 } else { 0 },
                slope_scale: if draws == Draws::Shadow { 2.0 } else { 0.0 },
                clamp: 0.0,
            },
        }),
        multisample: Default::default(),
        multiview: None,
        cache: None,
    })
}

/// A pipeline of one triangle over the whole frame.
fn screen_pipeline(
    device: &wgpu::Device,
    label: &str,
    module: &wgpu::ShaderModule,
    fragment_entry: &str,
    layouts: &[&wgpu::BindGroupLayout],
    format: wgpu::TextureFormat,
) -> wgpu::RenderPipeline {
    device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
        label: Some(label),
        layout: Some(
            &device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some(label),
                bind_group_layouts: layouts,
                push_constant_ranges: &[],
            }),
        ),
        vertex: wgpu::VertexState {
            module,
            entry_point: Some("vs"),
            compilation_options: Default::default(),
            buffers: &[],
        },
        fragment: Some(wgpu::FragmentState {
            module,
            entry_point: Some(fragment_entry),
            compilation_options: Default::default(),
            targets: &[Some(format.into())],
        }),
        primitive: Default::default(),
        depth_stencil: None,
        multisample: Default::default(),
        multiview: None,
        cache: None,
    })
}

fn upload_geometry(device: &wgpu::Device, vertices: &[u8], indices: &[u8]) -> Geometry {
    let upload = |label, contents, usage| {
        device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some(label),
            contents,
            usage,
        })
    };
    Geometry {
        vertices: upload("vertices", vertices, wgpu::BufferUsages::VERTEX),
        indices: upload("indices", indices, wgpu::BufferUsages::INDEX),
        index_count: (indices.len() / 4) as u32,
    }
}

fn upload_instances(device: &wgpu::Device, instances: &[u8]) -> wgpu::Buffer {
    device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("instances"),
        contents: instances,
        usage: wgpu::BufferUsages::VERTEX,
    })
}

fn upload_mesh(
    device: &wgpu::Device,
    materials: &Materials,
    record: &MeshRecord,
    buffer: &[u8],
    // More instances of the mesh than the scene held.
    companions: &[f32],
) -> Mesh {
    let vertices = floats(
        buffer,
        record.vertex_offset,
        record.vertex_count * VERTEX_FLOATS,
    );
    let indices = floats(buffer, record.index_offset, record.index_count);
    let instances = [
        floats(
            buffer,
            record.instance_offset,
            record.instance_count * INSTANCE_FLOATS,
        ),
        bytemuck::cast_slice(companions),
    ]
    .concat();
    Mesh {
        material: materials.of(device, record.kind, record.texture),
        geometry: upload_geometry(device, vertices, indices),
        instances: upload_instances(device, &instances),
        instance_count: (instances.len() / (INSTANCE_FLOATS * 4)) as u32,
        casts_shadow: record.casts_shadow,
        within: None,
    }
}

fn upload_scattered(
    device: &wgpu::Device,
    materials: &Materials,
    grown: &scatter::Scattered,
) -> Mesh {
    Mesh {
        material: materials.of(device, grown.kind, -1),
        geometry: upload_geometry(
            device,
            bytemuck::cast_slice(&grown.shape.scenery_floats()),
            bytemuck::cast_slice(grown.shape.indices()),
        ),
        instances: upload_instances(device, bytemuck::cast_slice(&grown.instances)),
        instance_count: (grown.instances.len() / INSTANCE_FLOATS) as u32,
        casts_shadow: false,
        within: Some((grown.centre, grown.radius, grown.reach)),
    }
}

/// Every build the game's models allow, each a troop with no units yet.
fn upload_troops(
    device: &wgpu::Device,
    materials: &Materials,
    snapshot: &Snapshot,
    buffer: &[u8],
) -> Units {
    let troops = ROLES
        .into_iter()
        .filter_map(|role| {
            let body = match role {
                Role::Knight => kit::knight(snapshot, buffer),
                Role::Crossbowman => kit::statue(snapshot, buffer, &kit::CROSSBOWMAN),
                Role::Paladin => kit::mounted_statue(snapshot, buffer),
            }?;
            Some(Troop {
                role,
                skins: body
                    .skins
                    .iter()
                    .map(|skin| upload_skin(device, materials, &body.build, skin))
                    .collect(),
                instances: upload_instances(device, &[]),
                batches: Vec::new(),
            })
        })
        .collect();
    Units {
        troops,
        effects: upload_geometry(
            device,
            bytemuck::cast_slice(&troops::effects().rig_floats()),
            bytemuck::cast_slice(troops::effects().indices()),
        ),
    }
}

fn upload_skin(
    device: &wgpu::Device,
    materials: &Materials,
    build: &Build,
    skin: &kit::Skin,
) -> Skin {
    Skin {
        levels: skin.levels.each_ref().map(|level| {
            let geometry = upload_geometry(
                device,
                bytemuck::cast_slice(&level.vertices),
                bytemuck::cast_slice(&level.indices),
            );
            (geometry, materials.of_build(device, build, level.texture))
        }),
    }
}

/// A troop's instances sorted so those that stand together are together, and the runs they fall into.
fn batched(instances: &[f32]) -> (Vec<f32>, Vec<Batch>) {
    let cell_of = |unit: &[f32]| {
        (
            (unit[0] / BATCH_CELL).floor() as i32,
            (unit[2] / BATCH_CELL).floor() as i32,
        )
    };
    let mut units: Vec<&[f32]> = instances.chunks_exact(INSTANCE_FLOATS).collect();
    units.sort_by_key(|unit| cell_of(unit));
    let mut batches: Vec<Batch> = Vec::new();
    for (index, run) in units
        .chunk_by(|a, b| cell_of(a) == cell_of(b))
        .scan(0, |first, run| {
            let start = *first;
            *first += run.len();
            Some((start, run))
        })
    {
        let stand = |unit: &[f32]| Vec3::new(unit[0], unit[1], unit[2]);
        let centre = run.iter().map(|unit| stand(unit)).sum::<Vec3>() / run.len() as f32;
        // A unit strays from its anchor by its patrol's radius or its march's length.
        let radius = run
            .iter()
            .map(|unit| (stand(unit) - centre).length() + unit[8].abs() + 1.0)
            .fold(0.0, f32::max);
        batches.push(Batch {
            first: index as u32,
            count: run.len() as u32,
            centre,
            radius,
        });
    }
    let sorted = units.into_iter().flatten().copied().collect();
    (sorted, batches)
}

/// The land's maps as the scene's shaders read them, and the two the post pass reads as well.
struct Land {
    group: wgpu::BindGroup,
    features: wgpu::TextureView,
    palette: wgpu::TextureView,
}

fn upload_land(
    device: &wgpu::Device,
    queue: &wgpu::Queue,
    layout: &wgpu::BindGroupLayout,
    world: &World,
    clamped: &wgpu::Sampler,
) -> Land {
    let texture = |label, size: usize, levels, format, texels: &[u8]| {
        upload_texture(device, queue, label, size as u32, levels, format, texels)
    };
    let map = texture(
        "land map",
        world::MAP_SIZE,
        1,
        wgpu::TextureFormat::Rgba16Float,
        bytemuck::cast_slice(&world.texels()),
    );
    let detail = texture(
        "detail tile",
        world::DETAIL_SIZE,
        world::detail_levels(),
        wgpu::TextureFormat::Rgba8Unorm,
        &world::detail_tile(),
    );
    let waves = texture(
        "wave tile",
        world::DETAIL_SIZE,
        world::detail_levels(),
        wgpu::TextureFormat::Rgba8Unorm,
        &world::wave_tile(),
    );
    let repeating = device.create_sampler(&wgpu::SamplerDescriptor {
        label: Some("repeating"),
        address_mode_u: wgpu::AddressMode::Repeat,
        address_mode_v: wgpu::AddressMode::Repeat,
        mag_filter: wgpu::FilterMode::Linear,
        min_filter: wgpu::FilterMode::Linear,
        mipmap_filter: wgpu::FilterMode::Linear,
        ..Default::default()
    });
    let plain = wgpu::TextureFormat::Rgba8Unorm;
    let features = texture(
        "land features",
        world::MAP_SIZE,
        1,
        plain,
        &world.feature_texels(),
    );
    let palette = texture(
        "land palette",
        world::MAP_SIZE,
        1,
        plain,
        &world.palette_texels(),
    );
    Land {
        group: texture_group(
            device,
            layout,
            &[&map, &detail, &waves, &features, &palette],
            &[clamped, &repeating],
        ),
        features,
        palette,
    }
}

#[cfg(test)]
mod tests {
    use super::{GLOBALS, LIT};
    use wgpu::naga;

    /// Every shader parses, validates and translates to WebGL2's language, so a mistake in one is caught here
    /// and not in a browser.
    #[test]
    fn shaders_are_valid_and_translate_for_webgl2() {
        let shaders = [
            ("mesh", [GLOBALS, LIT, include_str!("mesh.wgsl")].concat()),
            ("unit", [GLOBALS, LIT, include_str!("unit.wgsl")].concat()),
            ("post", [GLOBALS, include_str!("post.wgsl")].concat()),
            ("smooth", [GLOBALS, include_str!("fxaa.wgsl")].concat()),
        ];
        for (name, source) in shaders {
            let module = naga::front::wgsl::parse_str(&source)
                .unwrap_or_else(|error| panic!("{name}: {}", error.emit_to_string(&source)));
            let info = naga::valid::Validator::new(
                naga::valid::ValidationFlags::all(),
                naga::valid::Capabilities::empty(),
            )
            .validate(&module)
            .unwrap_or_else(|error| panic!("{name}: {}", error.emit_to_string(&source)));
            for entry in &module.entry_points {
                let options = naga::back::glsl::Options {
                    version: naga::back::glsl::Version::Embedded {
                        version: 300,
                        is_webgl: true,
                    },
                    ..Default::default()
                };
                let pipeline = naga::back::glsl::PipelineOptions {
                    shader_stage: entry.stage,
                    entry_point: entry.name.clone(),
                    multiview: None,
                };
                let mut translated = String::new();
                let policies = naga::proc::BoundsCheckPolicies::default();
                naga::back::glsl::Writer::new(
                    &mut translated,
                    &module,
                    &info,
                    &options,
                    &pipeline,
                    policies,
                )
                .and_then(|mut writer| writer.write())
                .unwrap_or_else(|error| panic!("{name}/{}: {error}", entry.name));
            }
        }
    }
}
