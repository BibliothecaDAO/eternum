//! The world map's own renderer. The page hands it the land as it stands (`scene::Snapshot`: the ground, the
//! buildings, the hexes and the game's unit models) and a canvas, then the units and the order as the game's facts
//! change; it draws the map on WebGPU, or on WebGL2 where the browser has no WebGPU or the page asks for it.

mod kit;
mod renderer;
mod scatter;
mod scene;
mod shapes;
mod troops;
mod world;

pub use renderer::{Camera, Renderer, Tier};
pub use scene::Snapshot;
pub use troops::Role;

#[cfg(target_arch = "wasm32")]
mod web {
    use glam::{Mat4, Vec2};
    use wasm_bindgen::prelude::*;

    use crate::{Camera, Renderer, Role, Snapshot, Tier};

    #[wasm_bindgen]
    pub struct MapRenderer {
        renderer: Renderer,
        backend: String,
    }

    #[wasm_bindgen]
    impl MapRenderer {
        /// Starts the renderer on a canvas with the land's table (JSON) and buffer, on WebGPU or, with `on_webgl2`,
        /// on WebGL2: the page chooses, and starts again on WebGL2 if WebGPU fails. `quality` names the tier: high,
        /// mid or low.
        pub async fn start(
            canvas: web_sys::HtmlCanvasElement,
            table: String,
            buffer: Vec<u8>,
            hex_horizontal: f32,
            hex_vertical: f32,
            on_webgl2: bool,
            quality: String,
        ) -> Result<MapRenderer, JsValue> {
            console_error_panic_hook::set_once();
            let snapshot: Snapshot =
                serde_json::from_str(&table).map_err(|error| error.to_string())?;
            let size = (canvas.width(), canvas.height());
            let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
                backends: if on_webgl2 {
                    wgpu::Backends::GL
                } else {
                    wgpu::Backends::BROWSER_WEBGPU
                },
                ..Default::default()
            });
            let surface = instance
                .create_surface(wgpu::SurfaceTarget::Canvas(canvas))
                .map_err(|error| error.to_string())?;
            let renderer = Renderer::new(
                instance,
                surface,
                size,
                &snapshot,
                &buffer,
                [hex_horizontal, hex_vertical],
                Tier::named(&quality)?,
            )
            .await?;
            let backend = if on_webgl2 { "webgl2" } else { "webgpu" }.to_string();
            Ok(MapRenderer { renderer, backend })
        }

        pub fn resize(&mut self, width: u32, height: u32) {
            self.renderer.resize(width, height);
        }

        /// Replaces the units of one build (knight, crossbowman or paladin): twenty floats a unit.
        pub fn set_troop(&mut self, role: &str, instances: &[f32]) -> Result<(), JsValue> {
            self.renderer.set_troop(Role::named(role)?, instances);
            Ok(())
        }

        /// Shows an order as four hexes' middles on the ground, x then z each: the picked army's hex, the two it
        /// crosses and the one it is sent to. Anything else clears it.
        pub fn show_order(&mut self, stops: &[f32]) {
            let stop = |at: usize| Vec2::new(stops[at * 2], stops[at * 2 + 1]);
            self.renderer
                .show_order((stops.len() == 8).then(|| [stop(0), stop(1), stop(2), stop(3)]));
        }

        /// Draws a frame from a camera given as the page's camera holds it: its world matrix and its lens.
        pub fn render(
            &mut self,
            camera_world: &[f32],
            fov_y_radians: f32,
            near: f32,
            far: f32,
            seconds: f32,
        ) -> Result<(), JsValue> {
            let camera = Camera {
                world: Mat4::from_cols_slice(camera_world),
                fov_y_radians,
                near,
                far,
            };
            self.renderer.render(&camera, seconds).map_err(Into::into)
        }

        pub fn backend(&self) -> String {
            self.backend.clone()
        }
    }
}
