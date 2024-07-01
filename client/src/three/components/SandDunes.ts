import * as THREE from 'three';

export class SandDunes {
	private hexSize: number;

	constructor(hexSize: number) {
		this.hexSize = hexSize;
	}

	createSandDunes(x: number, y: number, z: number): THREE.Mesh {
		const geometry = new THREE.BufferGeometry();
		const positions = [];
		const indices = [];
		const colors = [];
		const color = new THREE.Color();

		// Create hexagon vertices (rotated by 30 degrees)
		for (let i = 0; i < 6; i++) {
			const angle = (Math.PI / 3) * i + Math.PI / 6; // Add 30 degrees (PI/6) rotation
			const px = this.hexSize * Math.cos(angle);
			const pz = this.hexSize * Math.sin(angle);
			positions.push(px, 0, pz);
		}

		// Add center vertex
		positions.push(0, 0, 0);

		// Add mid-edge vertices
		for (let i = 0; i < 6; i++) {
			const angle1 = (Math.PI / 3) * i + Math.PI / 6;
			const angle2 = (Math.PI / 3) * ((i + 1) % 6) + Math.PI / 6;
			const px = this.hexSize * 0.5 * (Math.cos(angle1) + Math.cos(angle2));
			const pz = this.hexSize * 0.5 * (Math.sin(angle1) + Math.sin(angle2));
			const py = Math.random() * 0.1 * this.hexSize;
			positions.push(px, py, pz);
		}

		// Add top vertex (peak of the dune)
		const peakHeight = Math.random() * 0.2 * this.hexSize + 0.1 * this.hexSize;
		positions.push(0, peakHeight, 0);

		// Add mid-height vertices
		for (let i = 0; i < 6; i++) {
			const angle = (Math.PI / 3) * i + Math.PI / 6;
			const px = this.hexSize * 0.5 * Math.cos(angle);
			const pz = this.hexSize * 0.5 * Math.sin(angle);
			const py = peakHeight * 0.5 + Math.random() * 0.1 * this.hexSize;
			positions.push(px, py, pz);
		}

		// Set colors
		for (let i = 0; i < positions.length / 3; i++) {
			const height = positions[i * 3 + 1];
			color.setHSL(0.1 + (height / peakHeight) * 0.1, 0.75, 0.5 + (height / peakHeight) * 0.3);
			colors.push(color.r, color.g, color.b);
		}

		// Create faces
		for (let i = 0; i < 6; i++) {
			indices.push(i, (i + 1) % 6, 6); // Bottom faces
			indices.push(i, 7 + i, (i + 1) % 6); // Lower side faces
			indices.push(7 + i, 7 + ((i + 1) % 6), (i + 1) % 6); // Upper side faces
			indices.push(7 + i, 13, 7 + ((i + 1) % 6)); // Top faces
			indices.push(i, 14 + i, 7 + i); // Mid-height faces (lower)
			indices.push(14 + i, 13, 7 + i); // Mid-height faces (upper)
		}

		geometry.setIndex(indices);
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

		// Compute vertex normals for proper lighting
		geometry.computeVertexNormals();

		const material = new THREE.MeshPhongMaterial({
			vertexColors: true,
			flatShading: true,
		});

		const dune = new THREE.Mesh(geometry, material);
		dune.position.set(x, y - 0.18, z);

		return dune;
	}
}
