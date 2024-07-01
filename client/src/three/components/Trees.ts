import * as THREE from 'three';

export class Trees {
	private treeSize = 0.2;

	constructor(private hexSize: number) {}

	createTrees(x: number, y: number, z: number, color: string = 'darkgreen'): THREE.InstancedMesh {
		const numTrees = Math.floor(Math.random() * 20) + 1; // Random number of trees (1-3)

		const treeGeometry = this.createTreeGeometry();
		const treeMaterial = new THREE.MeshPhongMaterial({ color: color });
		const treeInstanced = new THREE.InstancedMesh(treeGeometry, treeMaterial, numTrees);

		const dummy = new THREE.Object3D();

		for (let i = 0; i < numTrees; i++) {
			// Position trees randomly within the hexagon
			const angle = Math.random() * Math.PI * 2;
			const radius = Math.random() * (this.hexSize - this.treeSize);
			dummy.position.set(x + Math.cos(angle) * radius, y - 0.5, z + Math.sin(angle) * radius);
			dummy.scale.setScalar(0.2 + Math.random() * 0.1); // Random size variation
			dummy.rotation.y = Math.random() * Math.PI * 2; // Random rotation
			dummy.updateMatrix();
			treeInstanced.setMatrixAt(i, dummy.matrix);
		}

		treeInstanced.instanceMatrix.needsUpdate = true;
		return treeInstanced;
	}

	private createTreeGeometry(): THREE.BufferGeometry {
		const treeGeometry = new THREE.BufferGeometry();
		const coneGeometry = new THREE.ConeGeometry(0.5, 1, 8);
		const positions: number[] = [];
		const indices: number[] = [];

		// Create 3 cones stacked on top of each other
		for (let i = 0; i < 3; i++) {
			const scaleFactor = 1 - i * 0.3; // Each cone is slightly smaller
			const yOffset = i * 0.6; // Stack the cones vertically

			coneGeometry.scale(scaleFactor, scaleFactor, scaleFactor);
			coneGeometry.translate(0, yOffset, 0);

			positions.push(...Array.from(coneGeometry.attributes.position.array));
			const indexOffset = i * coneGeometry.attributes.position.count;
			for (let j = 0; j < coneGeometry.index!.array.length; j++) {
				indices.push(coneGeometry.index!.array[j] + indexOffset);
			}

			coneGeometry.translate(0, -yOffset, 0);
			coneGeometry.scale(1 / scaleFactor, 1 / scaleFactor, 1 / scaleFactor);
		}

		treeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		treeGeometry.setIndex(indices);
		treeGeometry.computeVertexNormals();

		return treeGeometry;
	}
}
