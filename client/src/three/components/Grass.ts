import * as THREE from 'three';

export class Grass {
	private hexSize: number;

	constructor(hexSize: number) {
		this.hexSize = hexSize;
	}

	createGrass(x: number, y: number, z: number): THREE.InstancedMesh {
		const numGrassBlades = Math.floor(Math.random() * 50) + 50; // 50-100 grass blades

		const grassGeometry = this.createGrassBladeGeometry();
		const grassMaterial = new THREE.MeshPhongMaterial({
			color: 'green',
			side: THREE.DoubleSide,
		});
		const grassInstanced = new THREE.InstancedMesh(grassGeometry, grassMaterial, numGrassBlades);

		const dummy = new THREE.Object3D();

		for (let i = 0; i < numGrassBlades; i++) {
			const angle = Math.random() * Math.PI * 2;
			const radius = Math.random() * this.hexSize;
			dummy.position.set(x + Math.cos(angle) * radius, y - 0.5, z + Math.sin(angle) * radius);
			// Increase the scale range for bigger grass
			dummy.scale.setScalar(0.08 + Math.random() * 0.07); // Random size between 0.08 and 0.15
			dummy.rotation.y = Math.random() * Math.PI * 2; // Random rotation
			dummy.updateMatrix();
			grassInstanced.setMatrixAt(i, dummy.matrix);
		}

		grassInstanced.instanceMatrix.needsUpdate = true;
		return grassInstanced;
	}

	private createGrassBladeGeometry(): THREE.BufferGeometry {
		const grassGeometry = new THREE.BufferGeometry();
		const positions = new Float32Array([0, 0, 0, -0.1, 0.5, 0, 0.1, 0.5, 0, 0, 1, 0]);
		const indices = new Uint16Array([0, 1, 2, 1, 3, 2]);

		grassGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		grassGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
		grassGeometry.computeVertexNormals();

		return grassGeometry;
	}
}
