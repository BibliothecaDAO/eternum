import * as THREE from 'three';
import { SetupResult } from '../dojo/generated/setup';
import { snoise } from '@dojoengine/utils';

export default class DetailedHexScene {
	scene: THREE.Scene;
	private renderer: THREE.WebGLRenderer;
	private camera: THREE.PerspectiveCamera;
	private dojo: SetupResult;

	constructor(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera, dojoContext: SetupResult) {
		this.renderer = renderer;
		this.camera = camera;
		this.dojo = dojoContext;
		this.scene = new THREE.Scene();
	}

	private hexSize = 0.4;
	private originalColor: THREE.Color = new THREE.Color('white');

	setup(clickedHex: THREE.Object3D) {
		// Clear existing scene
		while (this.scene.children.length > 0) {
			this.scene.remove(this.scene.children[0]);
		}

		const radius = 5; // Radius of the large hexagon (in terms of small hexagons)
		const group = new THREE.Group();
		const hexInstanced = this.createHexagonInstancedMesh(3 * radius * (radius - 1) + 1);
		group.add(hexInstanced);

		const horizontalSpacing = this.hexSize * Math.sqrt(3);
		const verticalSpacing = this.hexSize * 1.5;

		const dummy = new THREE.Object3D();
		let index = 0;

		for (let q = -radius + 1; q < radius; q++) {
			for (let r = Math.max(-radius + 1, -q - radius + 1); r < Math.min(radius, -q + radius); r++) {
				const x = horizontalSpacing * (q + r / 2);
				const z = verticalSpacing * r * -1;

				dummy.position.set(x, 0, z);

				const noiseInput = [q / 10, r / 10, 0];
				const noise = (snoise(noiseInput) + 1) / 2;

				dummy.scale.y = noise * 2;

				dummy.updateMatrix();
				hexInstanced.setMatrixAt(index, dummy.matrix);
				hexInstanced.setColorAt(index, new THREE.Color('green'));

				index++;
			}
		}

		hexInstanced.instanceMatrix.needsUpdate = true;
		hexInstanced.instanceColor!.needsUpdate = true;

		this.scene.add(group);

		// Add lights
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
		this.scene.add(ambientLight);

		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
		directionalLight.position.set(5, 5, 5);
		this.scene.add(directionalLight);

		// Adjust camera
		this.camera.position.set(3, 5, 8);
		this.camera.lookAt(3, 0, 3);
	}

	private createHexagonInstancedMesh(instanceCount: number): THREE.InstancedMesh {
		const hexGeometry = new THREE.CylinderGeometry(this.hexSize, this.hexSize, 1, 6);
		const material = new THREE.MeshPhongMaterial({ transparent: true });
		const hexInstanced = new THREE.InstancedMesh(hexGeometry, material, instanceCount);
		hexInstanced.castShadow = true;
		hexInstanced.userData.originalColor = this.originalColor.clone();
		return hexInstanced;
	}
	update(deltaTime: number) {
		// Update logic for detailed scene
	}
}
