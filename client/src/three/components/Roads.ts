import * as THREE from 'three';

export class Roads {
	private roadMaterial: THREE.LineBasicMaterial;
	private roads: THREE.Line[];

	constructor(private hexSize: number) {
		this.roadMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 5 });
		this.roads = [];
	}

	createRandomRoads(hexPositions: THREE.Vector3[], count: number): THREE.Group {
		const roadGroup = new THREE.Group();

		for (let i = 0; i < count; i++) {
			const start = hexPositions[Math.floor(Math.random() * hexPositions.length)];
			const end = hexPositions[Math.floor(Math.random() * hexPositions.length)];

			// Elevate the road endpoints
			const elevatedStart = start.clone().setY(start.y + this.hexSize * 0.5);
			const elevatedEnd = end.clone().setY(end.y + this.hexSize * 0.5);

			const roadGeometry = new THREE.BufferGeometry().setFromPoints([elevatedStart, elevatedEnd]);
			const road = new THREE.Line(roadGeometry, this.roadMaterial);

			this.roads.push(road);
			roadGroup.add(road);
		}

		return roadGroup;
	}
}
