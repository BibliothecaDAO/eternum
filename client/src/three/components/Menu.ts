import { InstancedMesh, Color, Scene, Raycaster, Vector2 } from 'three';

export default class Menu {
	private contextMenu: HTMLElement | null = null;

	constructor(private scene: Scene, private raycaster: Raycaster, private camera: THREE.PerspectiveCamera, private mouse: THREE.Vector2) {}
}
