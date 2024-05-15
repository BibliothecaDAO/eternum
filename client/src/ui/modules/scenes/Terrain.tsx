import * as THREE from 'three';
import { Terrain, generateBlendedMaterial, Linear } from "@repcomm/three.terrain";

const easing = 'Linear';
const maxHeight = 40;
const segments = 258;
const steps = 1;
const turbulent = false;
const size = 2048;

export const getMapTerrain = () => {
	const heightMapImage = new Image();
	heightMapImage.src='/textures/terrain/heightmap.png';

	return new Promise((resolve, reject) => {
		heightMapImage.onload = () => {
			let blend;
	
			const loader = new THREE.TextureLoader();
			loader.load('/textures/terrain/terrain_z1.jpg', (t1) => {
				t1.wrapS = t1.wrapT = THREE.RepeatWrapping;
				blend = generateBlendedMaterial([
						{
							texture: t1 as any,
						}
				]);
		
				const options = {
					easing: Linear,
					heightmap: heightMapImage,
					material: blend,
					maxHeight: maxHeight - 100,
					minHeight: -100,
					steps: steps,
					stretch: true,
					turbulent: turbulent,
					xSize: size,
					ySize: size,
					xSegments: segments,
					ySegments: segments,
					widthSegments: segments,
					heightSegments: segments,
					width: size,
					height: size,
				}
		
				const terrainScene = new Terrain(options);
				
				resolve(terrainScene)
			})
		}
	})
}