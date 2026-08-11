import * as THREE from 'three';

export type ProceduralModelOptions = {
  wireframe?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
  textureSize?: number;
  textureAnisotropy?: number;
  qualityPriority?: 'reference-fidelity' | 'balanced';
};

export type ProceduralModelRuntime = {
  nodes: Record<string, THREE.Object3D>;
  meshes: Record<string, THREE.Mesh>;
  sockets: Record<string, THREE.Object3D>;
  colliders: Record<string, unknown>;
  destructionGroups: Record<string, THREE.Object3D[]>;
};

type SculptMaterialSpec = Record<string, any>;

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function readLayerNumber(value: unknown, keys: string[], fallback: number): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of keys) {
      if (typeof record[key] === 'number') return record[key] as number;
    }
  }
  return fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = /^#[0-9a-f]{3}$/i.test(hex)
    ? '#' + hex.slice(1).split('').map((part) => part + part).join('')
    : hex;
  const value = /^#[0-9a-f]{6}$/i.test(normalized) ? Number.parseInt(normalized.slice(1), 16) : 0x8a7a5f;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function materialPalette(spec: SculptMaterialSpec): string[] {
  const palette = spec.colorVariation?.palette;
  if (Array.isArray(palette) && palette.length > 0) return palette.filter((value) => typeof value === 'string');
  const secondary = spec.albedo?.secondary;
  const colors = [spec.baseColor ?? spec.color ?? spec.albedo?.dominant, ...(Array.isArray(secondary) ? secondary : [])];
  return colors.filter((value): value is string => typeof value === 'string' && value.startsWith('#'));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothCurve(value: number): number {
  return value * value * (3 - 2 * value);
}

function periodicHash(x: number, y: number, seed: number, periodX: number, periodY: number): number {
  const wrappedX = ((x % periodX) + periodX) % periodX;
  const wrappedY = ((y % periodY) + periodY) % periodY;
  let value = Math.imul(wrappedX + seed * 17, 374761393) ^ Math.imul(wrappedY + seed * 31, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function periodicValueNoise(u: number, v: number, seed: number, periodX: number, periodY: number): number {
  const x = u * periodX;
  const y = v * periodY;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = smoothCurve(x - x0);
  const ty = smoothCurve(y - y0);
  const a = periodicHash(x0, y0, seed, periodX, periodY);
  const b = periodicHash(x0 + 1, y0, seed, periodX, periodY);
  const c = periodicHash(x0, y0 + 1, seed, periodX, periodY);
  const d = periodicHash(x0 + 1, y0 + 1, seed, periodX, periodY);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, tx), THREE.MathUtils.lerp(c, d, tx), ty);
}

type SurfaceBand = {
  frequency: number;
  amplitude: number;
  stretchX: number;
  stretchY: number;
  ridge: boolean;
};

function surfaceBands(spec: SculptMaterialSpec): SurfaceBand[] {
  const source = Array.isArray(spec.surfaceFrequencyBands) ? spec.surfaceFrequencyBands : [];
  const parsed = source.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return [];
    const band = item as Record<string, unknown>;
    const frequency = typeof band.frequency === 'number' ? band.frequency : 0;
    const amplitude = typeof band.amplitude === 'number' ? band.amplitude : 0;
    if (frequency <= 0 || amplitude <= 0) return [];
    const stretch = Array.isArray(band.stretch) ? band.stretch : [1, 1];
    const description = `${String(band.pattern ?? '')} ${String(band.role ?? '')}`.toLowerCase();
    return [{
      frequency,
      amplitude,
      stretchX: typeof stretch[0] === 'number' ? Math.max(0.1, stretch[0]) : 1,
      stretchY: typeof stretch[1] === 'number' ? Math.max(0.1, stretch[1]) : 1,
      ridge: /(ridge|groove|grain|fiber|striated|crack)/.test(description),
    }];
  });
  return parsed.length > 0 ? parsed : [
    { frequency: 2, amplitude: 0.42, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 12, amplitude: 0.22, stretchX: 1, stretchY: 1, ridge: false },
    { frequency: 56, amplitude: 0.08, stretchX: 1, stretchY: 1, ridge: false },
  ];
}

function sampleSurface(u: number, v: number, bands: SurfaceBand[], seed: number): number {
  let value = 0;
  let weight = 0;
  for (let index = 0; index < bands.length; index += 1) {
    const band = bands[index];
    const periodX = Math.max(1, Math.round(band.frequency * band.stretchX));
    const periodY = Math.max(1, Math.round(band.frequency * band.stretchY));
    let sample = periodicValueNoise(u, v, seed + index * 1013, periodX, periodY);
    if (band.ridge) sample = 1 - Math.abs(sample * 2 - 1);
    value += sample * band.amplitude;
    weight += band.amplitude;
  }
  return weight > 0 ? clamp01(value / weight) : 0.5;
}

function mixPalette(colors: [number, number, number][], value: number): [number, number, number] {
  if (colors.length === 1) return colors[0];
  const scaled = clamp01(value) * (colors.length - 1);
  const index = Math.min(colors.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const a = colors[index];
  const b = colors[index + 1];
  return [
    Math.round(THREE.MathUtils.lerp(a[0], b[0], mix)),
    Math.round(THREE.MathUtils.lerp(a[1], b[1], mix)),
    Math.round(THREE.MathUtils.lerp(a[2], b[2], mix)),
  ];
}

function writePixel(data: Uint8ClampedArray, offset: number, red: number, green: number, blue: number): void {
  data[offset] = Math.max(0, Math.min(255, Math.round(red)));
  data[offset + 1] = Math.max(0, Math.min(255, Math.round(green)));
  data[offset + 2] = Math.max(0, Math.min(255, Math.round(blue)));
  data[offset + 3] = 255;
}

function makeCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function createMapTexture(
  canvas: HTMLCanvasElement,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [2, 2];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 2,
    typeof repeat[1] === 'number' ? repeat[1] : 2,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

type ProceduralTextureSet = {
  albedo: THREE.Texture;
  roughness: THREE.Texture;
  height: THREE.Texture;
  normal: THREE.Texture;
  ao: THREE.Texture;
  source: 'reference-pixel-extraction' | 'procedural';
};

function referenceMapUrl(spec: SculptMaterialSpec, channel: string): string | null {
  const reference = spec.referencePbr;
  if (!reference || typeof reference !== 'object') return null;
  if (reference.usable === false) return null;
  const confidence = typeof reference.confidence === 'number'
    ? reference.confidence
    : (typeof reference.estimatedFidelity === 'number' ? reference.estimatedFidelity : 0);
  const threshold = typeof reference.targetThreshold === 'number' ? reference.targetThreshold : 0.7;
  if (confidence < threshold) return null;
  const maps = reference.maps;
  if (!maps || typeof maps !== 'object') return null;
  const map = (maps as Record<string, unknown>)[channel];
  if (!map || typeof map !== 'object') return null;
  const record = map as Record<string, unknown>;
  const url = typeof record.url === 'string' && record.url.trim() ? record.url : record.path;
  return typeof url === 'string' && url.trim() ? url : null;
}

function createLoadedMapTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  const projection = spec.textureProjection && typeof spec.textureProjection === 'object' ? spec.textureProjection : {};
  const repeat = Array.isArray(projection.repeat) ? projection.repeat : [1, 1];
  texture.colorSpace = colorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(
    typeof repeat[0] === 'number' ? repeat[0] : 1,
    typeof repeat[1] === 'number' ? repeat[1] : 1,
  );
  texture.anisotropy = Math.max(1, Math.round(options.textureAnisotropy ?? projection.anisotropy ?? 8));
  texture.needsUpdate = true;
  return texture;
}

function makeReferenceTextureSet(spec: SculptMaterialSpec, options: ProceduralModelOptions): ProceduralTextureSet | null {
  const albedo = referenceMapUrl(spec, 'albedo');
  const roughness = referenceMapUrl(spec, 'roughness');
  const height = referenceMapUrl(spec, 'height');
  const normal = referenceMapUrl(spec, 'normal');
  const ao = referenceMapUrl(spec, 'ao');
  if (!albedo || !roughness || !height || !normal || !ao) return null;
  return {
    albedo: createLoadedMapTexture(albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createLoadedMapTexture(roughness, THREE.NoColorSpace, spec, options),
    height: createLoadedMapTexture(height, THREE.NoColorSpace, spec, options),
    normal: createLoadedMapTexture(normal, THREE.NoColorSpace, spec, options),
    ao: createLoadedMapTexture(ao, THREE.NoColorSpace, spec, options),
    source: 'reference-pixel-extraction',
  };
}

function makeProceduralTextureSet(
  id: string,
  spec: SculptMaterialSpec,
  options: ProceduralModelOptions,
): ProceduralTextureSet | null {
  if (typeof document === 'undefined') return null;
  const qualityFirst = (options.qualityPriority ?? 'reference-fidelity') === 'reference-fidelity';
  const requested = options.textureSize ?? spec.textureResolution;
  const requestedSize = typeof requested === 'number' && Number.isFinite(requested)
    ? requested
    : (qualityFirst ? 1024 : 512);
  const size = Math.max(256, Math.min(2048, 2 ** Math.round(Math.log2(requestedSize))));
  const canvases = {
    albedo: makeCanvas(size),
    roughness: makeCanvas(size),
    height: makeCanvas(size),
    normal: makeCanvas(size),
    ao: makeCanvas(size),
  };
  const contexts = {
    albedo: canvases.albedo.getContext('2d'),
    roughness: canvases.roughness.getContext('2d'),
    height: canvases.height.getContext('2d'),
    normal: canvases.normal.getContext('2d'),
    ao: canvases.ao.getContext('2d'),
  };
  if (!contexts.albedo || !contexts.roughness || !contexts.height || !contexts.normal || !contexts.ao) return null;
  const images = {
    albedo: contexts.albedo.createImageData(size, size),
    roughness: contexts.roughness.createImageData(size, size),
    height: contexts.height.createImageData(size, size),
    normal: contexts.normal.createImageData(size, size),
    ao: contexts.ao.createImageData(size, size),
  };
  const seed = hashString(id);
  const bands = surfaceBands(spec);
  const heightField = new Float32Array(size * size);
  const roughnessField = new Float32Array(size * size);
  const palette = materialPalette(spec);
  const fallback = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const colors = (palette.length >= 2 ? palette : [fallback, '#6E614B', '#A08F70']).map(hexToRgb);
  const baseRoughness = clamp01(readLayerNumber(spec.roughness, ['base'], 0.76));
  const roughnessVariation = clamp01(readLayerNumber(spec.roughness, ['variation'], 0.18));
  const colorAmplitude = clamp01(readLayerNumber(spec.colorVariation, ['amplitude', 'variation'], 0.18));
  const heightCorrelation = clamp01(readLayerNumber(spec.colorVariation, ['heightCorrelation'], 0.3));
  for (let y = 0; y < size; y += 1) {
    const v = y / size;
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const index = y * size + x;
      const height = sampleSurface(u, v, bands, seed + 101);
      const roughNoise = sampleSurface(u, v, bands, seed + 7001);
      const colorNoise = sampleSurface(u, v, bands, seed + 15013);
      heightField[index] = height;
      roughnessField[index] = clamp01(baseRoughness + (roughNoise - 0.5) * roughnessVariation * 2);
      const paletteValue = clamp01(
        0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
      );
      const color = mixPalette(colors, paletteValue);
      writePixel(images.albedo.data, index * 4, color[0], color[1], color[2]);
    }
  }
  const normalStrength = Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35));
  const aoStrength = clamp01(readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35));
  for (let y = 0; y < size; y += 1) {
    const up = ((y - 1 + size) % size) * size;
    const down = ((y + 1) % size) * size;
    for (let x = 0; x < size; x += 1) {
      const left = (x - 1 + size) % size;
      const right = (x + 1) % size;
      const index = y * size + x;
      const center = heightField[index];
      const dx = (heightField[y * size + right] - heightField[y * size + left]) * normalStrength * 6;
      const dy = (heightField[down + x] - heightField[up + x]) * normalStrength * 6;
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + 1);
      const normalX = -dx * inverseLength;
      const normalY = -dy * inverseLength;
      const normalZ = inverseLength;
      const neighborAverage = (
        heightField[y * size + left] + heightField[y * size + right]
        + heightField[up + x] + heightField[down + x]
      ) * 0.25;
      const cavity = Math.max(0, neighborAverage - center);
      const ao = clamp01(1 - aoStrength * (cavity * 12 + (1 - center) * 0.16));
      const offset = index * 4;
      const heightByte = center * 255;
      const roughnessByte = roughnessField[index] * 255;
      writePixel(images.height.data, offset, heightByte, heightByte, heightByte);
      writePixel(images.roughness.data, offset, roughnessByte, roughnessByte, roughnessByte);
      writePixel(
        images.normal.data, offset,
        (normalX * 0.5 + 0.5) * 255,
        (normalY * 0.5 + 0.5) * 255,
        (normalZ * 0.5 + 0.5) * 255,
      );
      writePixel(images.ao.data, offset, ao * 255, ao * 255, ao * 255);
    }
  }
  contexts.albedo.putImageData(images.albedo, 0, 0);
  contexts.roughness.putImageData(images.roughness, 0, 0);
  contexts.height.putImageData(images.height, 0, 0);
  contexts.normal.putImageData(images.normal, 0, 0);
  contexts.ao.putImageData(images.ao, 0, 0);
  return {
    albedo: createMapTexture(canvases.albedo, THREE.SRGBColorSpace, spec, options),
    roughness: createMapTexture(canvases.roughness, THREE.NoColorSpace, spec, options),
    height: createMapTexture(canvases.height, THREE.NoColorSpace, spec, options),
    normal: createMapTexture(canvases.normal, THREE.NoColorSpace, spec, options),
    ao: createMapTexture(canvases.ao, THREE.NoColorSpace, spec, options),
    source: 'procedural',
  };
}

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : new THREE.Color(typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F'),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clamp01(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    if (bumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = bumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    if (displacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = displacementScale;
      material.displacementBias = -displacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.needsUpdate = true;
  return material;
}

type AttachmentEndpoint = {
  start: THREE.Vector3;
  midpoint: THREE.Vector3;
  quaternion: THREE.Quaternion;
  length: number;
  baseRadius: number;
  endRadius: number;
};

function readVector3(value: unknown, fallback: [number, number, number]): THREE.Vector3 {
  if (Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number')) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  return new THREE.Vector3(fallback[0], fallback[1], fallback[2]);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function makeAttachmentEndpoint(attachment: unknown): AttachmentEndpoint | null {
  if (!attachment || typeof attachment !== 'object') return null;
  const record = attachment as Record<string, unknown>;
  const start = readVector3(record.localStart, [0, 0, 0]);
  const end = readVector3(record.localEnd, [0, 1, 0]);
  const delta = end.clone().sub(start);
  const length = delta.length();
  if (length <= 0.0001) return null;
  const direction = delta.clone().normalize();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const baseRadius = Math.max(0.005, readNumber(record.baseRadius, 0.06));
  const endRadius = Math.max(0.003, readNumber(record.endRadius, baseRadius * 0.55));
  return {
    start,
    midpoint: delta.multiplyScalar(0.5),
    quaternion,
    length,
    baseRadius,
    endRadius,
  };
}

// Generated from ObjectSculptSpec target: Warm Paper Atelier Notebook
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createWarmPaperAtelierNotebookModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Warm Paper Atelier Notebook";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["hidden-root"] = createSculptMaterial(
    "hidden-root",
    {"id": "hidden-root", "name": "Hidden transform placeholder", "qualityTier": "utility", "type": "basic", "shaderModel": "MeshBasicMaterial", "baseColor": "#000000", "roughness": {"base": 1.0, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 0.0}, "localOverrides": [], "notes": "No visible mesh is emitted for root and pivot nodes."},
    options
  );
  materialMap["moss-cloth"] = createSculptMaterial(
    "moss-cloth",
    {"id": "moss-cloth", "name": "Moss-green woven book cloth", "qualityTier": "reference-primary", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#35382B", "albedo": {"dominant": "#35382B", "secondary": ["#2B2F23", "#3C3F31", "#4F4F3E"], "samplingNotes": "Book-cloth crop from the authoritative closed reference; suppress the crop's brass/background contamination with a cloth-local mask."}, "colorVariation": {"palette": ["#2B2F23", "#35382B", "#3C3F31", "#4F4F3E"], "pattern": "low-amplitude woven mottling", "amplitude": 0.08, "heightCorrelation": 0.22}, "textureResolution": 1024, "textureProjection": {"mode": "cover-plane UV with separate spine cylindrical UV", "repeat": [7.0, 9.0], "anisotropy": 8, "texelDensityIntent": "about 42 visible cloth ribs across a 3.12-unit cover width at nameplate close-up distance"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.035, "role": "subtle padded cover value and compression variation"}, {"id": "meso", "frequency": 14.0, "amplitude": 0.018, "role": "perimeter compression and cloth bundle irregularity"}, {"id": "micro", "frequency": 54.0, "amplitude": 0.012, "role": "directional warp/weft rib highlight breakup"}], "roughness": {"base": 0.88, "variation": 0.12, "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/book-cloth/book-cloth_roughness.png", "localResponse": "cavities rougher; handled rolled edge slightly less rough"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "independent book-cloth normal plus directional procedural ribs", "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/book-cloth/book-cloth_normal.png", "strength": 0.34, "scale": 54.0, "space": "tangent"}, "bump": {"pattern": "independent woven height", "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/book-cloth/book-cloth_height.png", "amplitude": 0.012, "scale": 54.0}, "displacement": {"pattern": "geometry only at rolled perimeter", "amplitude": 0.008, "scale": 1.0, "silhouetteAffects": true}, "ambientOcclusion": {"map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/book-cloth/book-cloth_ao.png", "cavityStrength": 0.28, "contactShadowBias": 0.32, "notes": "Apply to wrap seam, spine shoulders, and inner cover contact only."}, "localOverrides": [{"id": "cloth-warp-weft-ribbing", "region": "all cloth faces with UV direction locked per component", "normalStrength": 0.34, "roughnessVariation": 0.12, "anisotropy": 0.18, "anisotropyRotation": 1.5708, "evidenceRefs": ["closed-cloth-closeup"]}, {"id": "cloth-spine-compression", "region": "spine shoulders and cover roll", "roughness": 0.82, "cavityBias": 0.32, "evidenceRefs": ["closed-overall", "open-gutter-closeup"]}], "referencePbr": {"version": "1.0", "sourceImage": "docs/assets/model-reviews/dd-20260810-002/pbr-crops/book-cloth.png", "extractor": "img2threejs extract_pbr_evidence.py", "method": "single-image reference-derived inference", "verdict": "pass", "hardLimit": "Not inverse rendering; crop includes baked light and weak background separation, so screenshot relighting remains mandatory.", "usable": true, "confidence": 0.807, "estimatedFidelity": 0.807, "targetThreshold": 0.7, "maps": {"albedo": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/book-cloth/book-cloth_albedo.png", "channel": "albedo"}, "roughness": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/book-cloth/book-cloth_roughness.png", "channel": "roughness"}, "height": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/book-cloth/book-cloth_height.png", "channel": "height"}, "normal": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/book-cloth/book-cloth_normal.png", "channel": "normal"}, "ao": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/book-cloth/book-cloth_ao.png", "channel": "ao"}}}, "shaderNotes": ["Never alias cloth albedo into roughness, height, normal, or AO.", "Use the extracted maps as evidence and seed material, then visually reject brass/background leakage from the crop."]},
    options
  );
  materialMap["ivory-paper"] = createSculptMaterial(
    "ivory-paper",
    {"id": "ivory-paper", "name": "Warm ivory fibrous paper", "qualityTier": "reference-primary", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#E4D5C3", "albedo": {"dominant": "#E4D5C3", "secondary": ["#E0CFBD", "#E8DAC9", "#C8B197"], "samplingNotes": "Open paper crop is authoritative for face fiber and warmth; darker brown samples are excluded as desk/background."}, "colorVariation": {"palette": ["#E0CFBD", "#E4D5C3", "#E8DAC9", "#C8B197"], "pattern": "fine fiber clouding with warmer edge mask", "amplitude": 0.055, "heightCorrelation": 0.12}, "textureResolution": 1024, "textureProjection": {"mode": "page UV plus edge-strip UV", "repeat": [2.0, 2.0], "anisotropy": 8, "texelDensityIntent": "fiber remains subtle at overhead view but readable at paper close-up"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.1, "amplitude": 0.025, "role": "gentle warm sheet tone and edge warmth"}, {"id": "meso", "frequency": 10.0, "amplitude": 0.016, "role": "soft paper clouding and faint manufacturing variation"}, {"id": "micro", "frequency": 72.0, "amplitude": 0.006, "role": "fine cellulose fiber highlight breakup"}], "roughness": {"base": 0.94, "variation": 0.07, "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/ivory-paper/ivory-paper_roughness.png", "localResponse": "open faces matte; compressed fore edges slightly lower roughness but darker AO"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "independent cellulose fiber normal", "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/ivory-paper/ivory-paper_normal.png", "strength": 0.2, "scale": 72.0, "space": "tangent"}, "bump": {"pattern": "independent paper height", "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/ivory-paper/ivory-paper_height.png", "amplitude": 0.006, "scale": 72.0}, "displacement": {"pattern": "none on sheet faces; page crown is explicit geometry", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/ivory-paper/ivory-paper_ao.png", "cavityStrength": 0.34, "contactShadowBias": 0.4, "notes": "Concentrate between grouped leaf strata and gutter roots, not across broad clean faces."}, "localOverrides": [{"id": "paper-fiber-roughness", "region": "open page faces", "roughness": 0.96, "normalStrength": 0.2, "fiberScale": 72.0, "evidenceRefs": ["open-paper-closeup"]}, {"id": "paper-edge-warmth", "region": "all edge-facing leaf geometry", "baseColor": "#C8B197", "roughness": 0.9, "cavityBias": 0.38, "evidenceRefs": ["closed-fore-edge-closeup", "open-gutter-closeup"]}], "referencePbr": {"version": "1.0", "sourceImage": "docs/assets/model-reviews/dd-20260810-002/pbr-crops/ivory-paper.png", "extractor": "img2threejs extract_pbr_evidence.py", "method": "single-image reference-derived inference", "verdict": "pass", "hardLimit": "Not inverse rendering; desk/background pixels and baked shading remain possible, so only the isolated ivory range is authoritative.", "usable": true, "confidence": 0.829, "estimatedFidelity": 0.829, "targetThreshold": 0.7, "maps": {"albedo": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/ivory-paper/ivory-paper_albedo.png", "channel": "albedo"}, "roughness": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/ivory-paper/ivory-paper_roughness.png", "channel": "roughness"}, "height": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/ivory-paper/ivory-paper_height.png", "channel": "height"}, "normal": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/ivory-paper/ivory-paper_normal.png", "channel": "normal"}, "ao": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/ivory-paper/ivory-paper_ao.png", "channel": "ao"}}}, "shaderNotes": ["Keep rules in a separate low-opacity material; they must not emboss or replace paper normal detail.", "Use explicit page-crown geometry instead of displacement for the broad open-page curve."]},
    options
  );
  materialMap["aged-brass"] = createSculptMaterial(
    "aged-brass",
    {"id": "aged-brass", "name": "Aged blank brass hardware", "qualityTier": "reference-primary", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#8F6A41", "albedo": {"dominant": "#8F6A41", "secondary": ["#B48B59", "#6E5031", "#4D4B39"], "samplingNotes": "Restrict extraction to the plate and rivets; reject surrounding moss cloth/background colors."}, "colorVariation": {"palette": ["#6E5031", "#8F6A41", "#B48B59"], "pattern": "subtle mottled patina with no green oxidation", "amplitude": 0.12, "heightCorrelation": 0.08}, "textureResolution": 1024, "textureProjection": {"mode": "planar plate UV and spherical rivet UV", "repeat": [1.0, 1.0], "anisotropy": 8, "texelDensityIntent": "retain fine patina at nameplate close-up without visible tiling"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.4, "amplitude": 0.07, "role": "broad warm face variation"}, {"id": "meso", "frequency": 11.0, "amplitude": 0.035, "role": "aged mottling and handling patches"}, {"id": "micro", "frequency": 58.0, "amplitude": 0.012, "role": "fine metal roughness breakup"}], "roughness": {"base": 0.34, "variation": 0.18, "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/aged-brass/aged-brass_roughness.png", "localResponse": "plate face 0.42-0.58; chamfer crests and rivet crowns masked toward 0.18-0.24"}, "metalness": {"base": 0.88, "variation": 0.08}, "normal": {"pattern": "independent fine patina normal", "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/aged-brass/aged-brass_normal.png", "strength": 0.18, "scale": 58.0, "space": "tangent"}, "bump": {"pattern": "independent patina height", "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/aged-brass/aged-brass_height.png", "amplitude": 0.004, "scale": 58.0}, "displacement": {"pattern": "none; chamfer and domes are geometry", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/aged-brass/aged-brass_ao.png", "cavityStrength": 0.22, "contactShadowBias": 0.46, "notes": "Apply under plate and rivet bases; do not darken exposed crowns."}, "clearcoat": {"base": 0.12, "variation": 0.06}, "localOverrides": [{"id": "brass-aged-patina", "region": "broad plate face excluding chamfer", "roughness": 0.5, "dirtAmount": 0.08, "cavityBias": 0.12, "patinaColor": "#6E5031", "evidenceRefs": ["closed-nameplate-closeup"]}, {"id": "brass-edge-polish", "region": "plate chamfer crests and rivet crowns", "roughness": 0.18, "clearcoat": 0.22, "clearcoatRoughness": 0.16, "evidenceRefs": ["closed-nameplate-closeup"]}], "referencePbr": {"version": "1.0", "sourceImage": "docs/assets/model-reviews/dd-20260810-002/pbr-crops/aged-brass.png", "extractor": "img2threejs extract_pbr_evidence.py", "method": "single-image reference-derived inference", "verdict": "pass", "hardLimit": "Not inverse rendering; source contains surrounding cloth/background and baked highlights, so metalness and edge-polish masks require physically informed authoring plus screenshot review.", "usable": true, "confidence": 0.823, "estimatedFidelity": 0.823, "targetThreshold": 0.7, "maps": {"albedo": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/aged-brass/aged-brass_albedo.png", "channel": "albedo"}, "roughness": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/aged-brass/aged-brass_roughness.png", "channel": "roughness"}, "height": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/aged-brass/aged-brass_height.png", "channel": "height"}, "normal": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/aged-brass/aged-brass_normal.png", "channel": "normal"}, "ao": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/aged-brass/aged-brass_ao.png", "channel": "ao"}}}, "shaderNotes": ["Metalness comes from the known brass material family, not from grayscale extraction alone.", "Plate stays blank; do not add text, logo, inset plaque, or decorative border."]},
    options
  );
  materialMap["burgundy-ribbon"] = createSculptMaterial(
    "burgundy-ribbon",
    {"id": "burgundy-ribbon", "name": "Burgundy grosgrain bookmark", "qualityTier": "utility", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#6F2028", "albedo": {"dominant": "#6F2028", "secondary": ["#54161D", "#8A3038"], "samplingNotes": "Directly color-matched to the ribbon in both authoritative concepts; no isolated crop is clean enough to claim independent PBR inversion."}, "colorVariation": {"palette": ["#54161D", "#6F2028", "#8A3038"], "pattern": "longitudinal grosgrain ribs", "amplitude": 0.07, "heightCorrelation": 0.3}, "textureResolution": 512, "textureProjection": {"mode": "arc-length ribbon UV", "repeat": [1.0, 14.0], "anisotropy": 8, "texelDensityIntent": "8-12 longitudinal ribs remain visible across 0.11 ribbon width at close-up"}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.0, "amplitude": 0.025, "role": "gentle lengthwise color shift"}, {"id": "meso", "frequency": 12.0, "amplitude": 0.012, "role": "grosgrain rib bands"}, {"id": "micro", "frequency": 64.0, "amplitude": 0.005, "role": "fiber highlight breakup"}], "roughness": {"base": 0.82, "variation": 0.1, "map": "independent-procedural-ribbon-roughness", "localResponse": "slightly polished rib crests"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "independent longitudinal grosgrain field", "strength": 0.26, "scale": 64.0, "space": "tangent"}, "ambientOcclusion": {"map": "independent-procedural-ribbon-ao", "cavityStrength": 0.18, "contactShadowBias": 0.28, "notes": "Rib valleys and page contact only."}, "localOverrides": [{"id": "ribbon-woven-grosgrain", "region": "entire ribbon", "roughness": 0.82, "normalStrength": 0.26, "anisotropy": 0.22, "anisotropyRotation": 0.0, "evidenceRefs": ["closed-fore-edge-closeup", "open-gutter-closeup"]}], "notes": "Independent procedural channels are required. The absent isolated extraction is an explicit limitation, not permission to reuse book-cloth maps."},
    options
  );
  materialMap["page-rule-ink"] = createSculptMaterial(
    "page-rule-ink",
    {"id": "page-rule-ink", "name": "Faint warm-gray page rule ink", "qualityTier": "utility", "type": "standard", "shaderModel": "MeshBasicMaterial-compatible decal", "baseColor": "#B8AA99", "roughness": {"base": 0.96, "variation": 0.0}, "metalness": {"base": 0.0, "variation": 0.0}, "opacity": {"base": 0.22}, "localOverrides": [{"id": "rule-line-opacity", "region": "open page faces only", "opacity": 0.22, "evidenceRefs": ["open-overall", "open-paper-closeup"]}], "notes": "Albedo-only linework; inherit paper normals and remain below sticker/UI contrast."},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_root_0 = null;
  const endpoint_root_0 = makeAttachmentEndpoint(attachment_root_0);
  const node_root_0 = new THREE.Group();
  node_root_0.name = "Notebook stable root__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0.0, 0.0, 0.0);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
    node_root_0.scale.set(1.0, 1.0, 1.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Notebook stable root", "level": "macro", "role": "body", "importance": 1.0, "confidence": 1.0, "primitive": "box", "geometryDescriptor": {"topologyIntent": "hidden unit-scale transform root; no visible mesh", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "not applicable", "normalStrategy": "not applicable"}, "parent": null, "attachment": null, "dimensions": {"width": 3.2, "height": 0.4, "depth": 3.82, "units": "notebook-local", "confidence": 0.95}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "stable notebook local origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 1.0}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "front-cover-hinge-socket", "localPosition": [-1.5, 0.3, 0], "localRotation": [0, 0, 0]}, {"id": "spine-bookmark-socket", "localPosition": [-1.46, 0.31, 1.62], "localRotation": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0.2, 0], "scale": [3.18, 0.4, 3.82], "isTrigger": true, "notes": "Visual-model proxy only; retain existing app hit area and sticker plane."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "notebook-root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden-root"}}, "material": "hidden-root", "materialLayers": ["hidden-root"], "localFeatures": [], "evidenceRefs": ["closed-overall", "open-overall"], "fidelityTier": "runtime-contract"};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "stable notebook local origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 1.0}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "front-cover-hinge-socket", "localPosition": [-1.5, 0.3, 0], "localRotation": [0, 0, 0]}, {"id": "spine-bookmark-socket", "localPosition": [-1.46, 0.31, 1.62], "localRotation": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0.2, 0], "scale": [3.18, 0.4, 3.82], "isTrigger": true, "notes": "Visual-model proxy only; retain existing app hit area and sticker plane."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "notebook-root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden-root"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["hidden-root"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Notebook stable root";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Notebook stable root", "level": "macro", "role": "body", "importance": 1.0, "confidence": 1.0, "primitive": "box", "geometryDescriptor": {"topologyIntent": "hidden unit-scale transform root; no visible mesh", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "not applicable", "normalStrategy": "not applicable"}, "parent": null, "attachment": null, "dimensions": {"width": 3.2, "height": 0.4, "depth": 3.82, "units": "notebook-local", "confidence": 0.95}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "stable notebook local origin", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 1.0}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "front-cover-hinge-socket", "localPosition": [-1.5, 0.3, 0], "localRotation": [0, 0, 0]}, {"id": "spine-bookmark-socket", "localPosition": [-1.46, 0.31, 1.62], "localRotation": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0.2, 0], "scale": [3.18, 0.4, 3.82], "isTrigger": true, "notes": "Visual-model proxy only; retain existing app hit area and sticker plane."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "notebook-root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "hidden-root"}}, "material": "hidden-root", "materialLayers": ["hidden-root"], "localFeatures": [], "evidenceRefs": ["closed-overall", "open-overall"], "fidelityTier": "runtime-contract"};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "box", "offset": [0, 0.2, 0], "scale": [3.18, 0.4, 3.82], "isTrigger": true, "notes": "Visual-model proxy only; retain existing app hit area and sticker plane."};
  destructionGroups["notebook-root"] ??= [];
  destructionGroups["notebook-root"].push(node_root_0);
  const socket_root_front_cover_hinge_socket_0 = new THREE.Object3D();
  socket_root_front_cover_hinge_socket_0.name = "front-cover-hinge-socket";
  socket_root_front_cover_hinge_socket_0.position.set(-1.5, 0.3, 0.0);
  socket_root_front_cover_hinge_socket_0.rotation.set(0.0, 0.0, 0.0);
  socket_root_front_cover_hinge_socket_0.userData.socket = {"id": "front-cover-hinge-socket", "localPosition": [-1.5, 0.3, 0], "localRotation": [0, 0, 0]};
  node_root_0.add(socket_root_front_cover_hinge_socket_0);
  sockets["root:front-cover-hinge-socket"] = socket_root_front_cover_hinge_socket_0;
  const socket_root_spine_bookmark_socket_1 = new THREE.Object3D();
  socket_root_spine_bookmark_socket_1.name = "spine-bookmark-socket";
  socket_root_spine_bookmark_socket_1.position.set(-1.46, 0.31, 1.62);
  socket_root_spine_bookmark_socket_1.rotation.set(0.0, 0.0, 0.0);
  socket_root_spine_bookmark_socket_1.userData.socket = {"id": "spine-bookmark-socket", "localPosition": [-1.46, 0.31, 1.62], "localRotation": [0, 0, 0]};
  node_root_0.add(socket_root_spine_bookmark_socket_1);
  sockets["root:spine-bookmark-socket"] = socket_root_spine_bookmark_socket_1;

  const attachment_front_cover_pivot_1 = {"parentId": "root", "parentSocket": "front-cover-hinge-socket", "localStart": [-1.5, 0.3, 0], "localEnd": [-1.5, 0.3, 0.01], "contactType": "hinged bookbinding overlap", "overlap": 0.08, "gapTolerance": 0.01, "evidenceRefs": ["closed-overall", "open-gutter-closeup"]};
  const endpoint_front_cover_pivot_1 = makeAttachmentEndpoint(attachment_front_cover_pivot_1);
  const node_front_cover_pivot_1 = new THREE.Group();
  node_front_cover_pivot_1.name = "Front cover pivot__pivot";
  if (endpoint_front_cover_pivot_1) {
    node_front_cover_pivot_1.position.copy(endpoint_front_cover_pivot_1.start);
    node_front_cover_pivot_1.rotation.set(0, 0, 0);
    node_front_cover_pivot_1.scale.set(1, 1, 1);
  } else {
    node_front_cover_pivot_1.position.set(-1.5, 0.3, 0.0);
    node_front_cover_pivot_1.rotation.set(0.0, 0.0, 0.0);
    node_front_cover_pivot_1.scale.set(1.0, 1.0, 1.0);
  }
  node_front_cover_pivot_1.userData.sculptComponent = {"id": "front-cover-pivot", "name": "Front cover pivot", "level": "macro", "role": "pivot", "importance": 1.0, "confidence": 1.0, "primitive": "box", "geometryDescriptor": {"topologyIntent": "hidden hinge transform group", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "not applicable", "normalStrategy": "not applicable"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "front-cover-hinge-socket", "localStart": [-1.5, 0.3, 0], "localEnd": [-1.5, 0.3, 0.01], "contactType": "hinged bookbinding overlap", "overlap": 0.08, "gapTolerance": 0.01, "evidenceRefs": ["closed-overall", "open-gutter-closeup"]}, "dimensions": {"width": 0.02, "height": 0.02, "depth": 3.6, "units": "notebook-local", "confidence": 0.97}, "transform": {"position": [-1.5, 0.3, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "front-cover-articulation", "pivot": {"mode": "spine-side edge", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 1.0}, "transformChannels": {"translate": false, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "front-cover-content-socket", "localPosition": [1.5, 0, 0], "localRotation": [0, 0, 0]}], "collider": {"type": "box", "offset": [1.5, 0, 0], "scale": [3.12, 0.16, 3.76], "isTrigger": false, "notes": "Follows cover; not used for desk sticker placement."}, "constraints": ["closed rotation.z = 0", "open rotation.z = 0.97*pi", "ease uses existing NotebookPhase timing"], "destruction": {"breakable": false, "fractureGroup": "front-cover", "seamRefs": ["spine-shoulder-grooves"], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "moss-cloth"}}, "material": "hidden-root", "materialLayers": ["hidden-root"], "localFeatures": [{"id": "front-cover-hinge-axis", "type": "pivot", "closedAngle": 0.0, "openAngle": 3.0473, "axis": [0, 0, 1]}], "evidenceRefs": ["closed-overall", "open-overall", "open-gutter-closeup"], "fidelityTier": "interaction"};
  node_front_cover_pivot_1.userData.actionProfile = {"animationRole": "front-cover-articulation", "pivot": {"mode": "spine-side edge", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 1.0}, "transformChannels": {"translate": false, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "front-cover-content-socket", "localPosition": [1.5, 0, 0], "localRotation": [0, 0, 0]}], "collider": {"type": "box", "offset": [1.5, 0, 0], "scale": [3.12, 0.16, 3.76], "isTrigger": false, "notes": "Follows cover; not used for desk sticker placement."}, "constraints": ["closed rotation.z = 0", "open rotation.z = 0.97*pi", "ease uses existing NotebookPhase timing"], "destruction": {"breakable": false, "fractureGroup": "front-cover", "seamRefs": ["spine-shoulder-grooves"], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "moss-cloth"}};
  (nodes["root"] ?? root).add(node_front_cover_pivot_1);
  nodes["front-cover-pivot"] = node_front_cover_pivot_1;
  const mesh_front_cover_pivot_1Geometry = endpoint_front_cover_pivot_1
    ? new THREE.CylinderGeometry(endpoint_front_cover_pivot_1.endRadius, endpoint_front_cover_pivot_1.baseRadius, endpoint_front_cover_pivot_1.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_front_cover_pivot_1 = new THREE.Mesh(
    mesh_front_cover_pivot_1Geometry,
    materialMap["hidden-root"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_cover_pivot_1.name = "Front cover pivot";
  if (endpoint_front_cover_pivot_1) {
    mesh_front_cover_pivot_1.position.copy(endpoint_front_cover_pivot_1.midpoint);
    mesh_front_cover_pivot_1.quaternion.copy(endpoint_front_cover_pivot_1.quaternion);
  }
  mesh_front_cover_pivot_1.castShadow = options.castShadow ?? true;
  mesh_front_cover_pivot_1.receiveShadow = options.receiveShadow ?? true;
  mesh_front_cover_pivot_1.userData.sculptComponent = {"id": "front-cover-pivot", "name": "Front cover pivot", "level": "macro", "role": "pivot", "importance": 1.0, "confidence": 1.0, "primitive": "box", "geometryDescriptor": {"topologyIntent": "hidden hinge transform group", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "not applicable", "normalStrategy": "not applicable"}, "parent": "root", "attachment": {"parentId": "root", "parentSocket": "front-cover-hinge-socket", "localStart": [-1.5, 0.3, 0], "localEnd": [-1.5, 0.3, 0.01], "contactType": "hinged bookbinding overlap", "overlap": 0.08, "gapTolerance": 0.01, "evidenceRefs": ["closed-overall", "open-gutter-closeup"]}, "dimensions": {"width": 0.02, "height": 0.02, "depth": 3.6, "units": "notebook-local", "confidence": 0.97}, "transform": {"position": [-1.5, 0.3, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "front-cover-articulation", "pivot": {"mode": "spine-side edge", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 1.0}, "transformChannels": {"translate": false, "rotate": true, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": false}, "sockets": [{"id": "front-cover-content-socket", "localPosition": [1.5, 0, 0], "localRotation": [0, 0, 0]}], "collider": {"type": "box", "offset": [1.5, 0, 0], "scale": [3.12, 0.16, 3.76], "isTrigger": false, "notes": "Follows cover; not used for desk sticker placement."}, "constraints": ["closed rotation.z = 0", "open rotation.z = 0.97*pi", "ease uses existing NotebookPhase timing"], "destruction": {"breakable": false, "fractureGroup": "front-cover", "seamRefs": ["spine-shoulder-grooves"], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "moss-cloth"}}, "material": "hidden-root", "materialLayers": ["hidden-root"], "localFeatures": [{"id": "front-cover-hinge-axis", "type": "pivot", "closedAngle": 0.0, "openAngle": 3.0473, "axis": [0, 0, 1]}], "evidenceRefs": ["closed-overall", "open-overall", "open-gutter-closeup"], "fidelityTier": "interaction"};
  node_front_cover_pivot_1.add(mesh_front_cover_pivot_1);
  meshes["front-cover-pivot"] = mesh_front_cover_pivot_1;
  colliders["front-cover-pivot"] = {"type": "box", "offset": [1.5, 0, 0], "scale": [3.12, 0.16, 3.76], "isTrigger": false, "notes": "Follows cover; not used for desk sticker placement."};
  destructionGroups["front-cover"] ??= [];
  destructionGroups["front-cover"].push(node_front_cover_pivot_1);
  const socket_front_cover_pivot_front_cover_content_socket_0 = new THREE.Object3D();
  socket_front_cover_pivot_front_cover_content_socket_0.name = "front-cover-content-socket";
  socket_front_cover_pivot_front_cover_content_socket_0.position.set(1.5, 0.0, 0.0);
  socket_front_cover_pivot_front_cover_content_socket_0.rotation.set(0.0, 0.0, 0.0);
  socket_front_cover_pivot_front_cover_content_socket_0.userData.socket = {"id": "front-cover-content-socket", "localPosition": [1.5, 0, 0], "localRotation": [0, 0, 0]};
  node_front_cover_pivot_1.add(socket_front_cover_pivot_front_cover_content_socket_0);
  sockets["front-cover-pivot:front-cover-content-socket"] = socket_front_cover_pivot_front_cover_content_socket_0;

  const attachment_back_cover_pivot_2 = null;
  const endpoint_back_cover_pivot_2 = makeAttachmentEndpoint(attachment_back_cover_pivot_2);
  const node_back_cover_pivot_2 = new THREE.Group();
  node_back_cover_pivot_2.name = "Rear cover stable pivot__pivot";
  if (endpoint_back_cover_pivot_2) {
    node_back_cover_pivot_2.position.copy(endpoint_back_cover_pivot_2.start);
    node_back_cover_pivot_2.rotation.set(0, 0, 0);
    node_back_cover_pivot_2.scale.set(1, 1, 1);
  } else {
    node_back_cover_pivot_2.position.set(0.0, 0.0, 0.0);
    node_back_cover_pivot_2.rotation.set(0.0, 0.0, 0.0);
    node_back_cover_pivot_2.scale.set(1.0, 1.0, 1.0);
  }
  node_back_cover_pivot_2.userData.sculptComponent = {"id": "back-cover-pivot", "name": "Rear cover stable pivot", "level": "macro", "role": "pivot", "importance": 0.95, "confidence": 0.9, "primitive": "box", "geometryDescriptor": {"topologyIntent": "hidden stable transform group", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "not applicable", "normalStrategy": "not applicable"}, "parent": "root", "attachment": null, "dimensions": {"width": 3.2, "height": 0.2, "depth": 3.82, "units": "notebook-local", "confidence": 0.9}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "stable-rear-leaf", "pivot": {"mode": "root-aligned", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.98}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0.1, 0], "scale": [3.2, 0.2, 3.82], "isTrigger": false, "notes": "Stable desk-side cover proxy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rear-cover", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "moss-cloth"}}, "material": "hidden-root", "materialLayers": ["hidden-root"], "localFeatures": [], "evidenceRefs": ["open-overall", "rear-cover-consistency-inference"], "fidelityTier": "interaction"};
  node_back_cover_pivot_2.userData.actionProfile = {"animationRole": "stable-rear-leaf", "pivot": {"mode": "root-aligned", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.98}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0.1, 0], "scale": [3.2, 0.2, 3.82], "isTrigger": false, "notes": "Stable desk-side cover proxy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rear-cover", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "moss-cloth"}};
  (nodes["root"] ?? root).add(node_back_cover_pivot_2);
  nodes["back-cover-pivot"] = node_back_cover_pivot_2;
  const mesh_back_cover_pivot_2Geometry = endpoint_back_cover_pivot_2
    ? new THREE.CylinderGeometry(endpoint_back_cover_pivot_2.endRadius, endpoint_back_cover_pivot_2.baseRadius, endpoint_back_cover_pivot_2.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_back_cover_pivot_2 = new THREE.Mesh(
    mesh_back_cover_pivot_2Geometry,
    materialMap["hidden-root"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_back_cover_pivot_2.name = "Rear cover stable pivot";
  if (endpoint_back_cover_pivot_2) {
    mesh_back_cover_pivot_2.position.copy(endpoint_back_cover_pivot_2.midpoint);
    mesh_back_cover_pivot_2.quaternion.copy(endpoint_back_cover_pivot_2.quaternion);
  }
  mesh_back_cover_pivot_2.castShadow = options.castShadow ?? true;
  mesh_back_cover_pivot_2.receiveShadow = options.receiveShadow ?? true;
  mesh_back_cover_pivot_2.userData.sculptComponent = {"id": "back-cover-pivot", "name": "Rear cover stable pivot", "level": "macro", "role": "pivot", "importance": 0.95, "confidence": 0.9, "primitive": "box", "geometryDescriptor": {"topologyIntent": "hidden stable transform group", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "not applicable", "normalStrategy": "not applicable"}, "parent": "root", "attachment": null, "dimensions": {"width": 3.2, "height": 0.2, "depth": 3.82, "units": "notebook-local", "confidence": 0.9}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "stable-rear-leaf", "pivot": {"mode": "root-aligned", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.98}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "box", "offset": [0, 0.1, 0], "scale": [3.2, 0.2, 3.82], "isTrigger": false, "notes": "Stable desk-side cover proxy."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "rear-cover", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "moss-cloth"}}, "material": "hidden-root", "materialLayers": ["hidden-root"], "localFeatures": [], "evidenceRefs": ["open-overall", "rear-cover-consistency-inference"], "fidelityTier": "interaction"};
  node_back_cover_pivot_2.add(mesh_back_cover_pivot_2);
  meshes["back-cover-pivot"] = mesh_back_cover_pivot_2;
  colliders["back-cover-pivot"] = {"type": "box", "offset": [0, 0.1, 0], "scale": [3.2, 0.2, 3.82], "isTrigger": false, "notes": "Stable desk-side cover proxy."};
  destructionGroups["rear-cover"] ??= [];
  destructionGroups["rear-cover"].push(node_back_cover_pivot_2);

  const attachment_front_cover_shell_3 = null;
  const endpoint_front_cover_shell_3 = makeAttachmentEndpoint(attachment_front_cover_shell_3);
  const node_front_cover_shell_3 = new THREE.Group();
  node_front_cover_shell_3.name = "Front moss-cloth cover shell__pivot";
  if (endpoint_front_cover_shell_3) {
    node_front_cover_shell_3.position.copy(endpoint_front_cover_shell_3.start);
    node_front_cover_shell_3.rotation.set(0, 0, 0);
    node_front_cover_shell_3.scale.set(1, 1, 1);
  } else {
    node_front_cover_shell_3.position.set(1.5, 0.0, 0.0);
    node_front_cover_shell_3.rotation.set(0.0, 0.0, 0.0);
    node_front_cover_shell_3.scale.set(1.0, 1.0, 1.0);
  }
  node_front_cover_shell_3.userData.sculptComponent = {"id": "front-cover-shell", "name": "Front moss-cloth cover shell", "level": "meso", "role": "shell", "importance": 1.0, "confidence": 0.98, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "plan-view rounded-rectangle ShapeGeometry extrusion so radius is independent of thin Y thickness", "edgeTreatment": {"type": "rounded chamfer", "bevelRadius": 0.14, "segments": 4}, "deformationStack": ["subtle padded crown +0.018 Y", "compressed perimeter roll"], "uvStrategy": "stable cover-plane projection with cloth grain aligned along Z", "normalStrategy": "weighted vertex normals plus independent woven tangent normal"}, "parent": "front-cover-pivot", "attachment": null, "dimensions": {"width": 3.12, "height": 0.13, "depth": 3.76, "units": "notebook-local", "confidence": 0.98}, "transform": {"position": [1.5, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "material": "moss-cloth", "materialLayers": ["moss-cloth"], "localFeatures": [{"id": "cover-corner-chamfer", "type": "edgeTreatment", "bevelRadius": 0.14, "segments": 4, "plane": "XZ"}, {"id": "cloth-wrap-perimeter-seam", "type": "recessed groove", "width": 0.025, "depth": 0.008, "inset": 0.07}], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.18, "bumpAmplitude": 0.014, "normalPattern": "directional warp/weft rib field", "displacementPattern": "perimeter compression only", "occlusionPattern": "wrap seam and inner cover contact", "edgeWearPattern": "slightly lower roughness on handled roll", "notes": "Do not reuse albedo as roughness or normal."}, "evidenceRefs": ["closed-overall", "closed-cloth-closeup"], "fidelityTier": "hero"};
  node_front_cover_shell_3.userData.actionProfile = {};
  (nodes["front-cover-pivot"] ?? root).add(node_front_cover_shell_3);
  nodes["front-cover-shell"] = node_front_cover_shell_3;
  const mesh_front_cover_shell_3Geometry = endpoint_front_cover_shell_3
    ? new THREE.CylinderGeometry(endpoint_front_cover_shell_3.endRadius, endpoint_front_cover_shell_3.baseRadius, endpoint_front_cover_shell_3.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const mesh_front_cover_shell_3 = new THREE.Mesh(
    mesh_front_cover_shell_3Geometry,
    materialMap["moss-cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_cover_shell_3.name = "Front moss-cloth cover shell";
  if (endpoint_front_cover_shell_3) {
    mesh_front_cover_shell_3.position.copy(endpoint_front_cover_shell_3.midpoint);
    mesh_front_cover_shell_3.quaternion.copy(endpoint_front_cover_shell_3.quaternion);
  }
  mesh_front_cover_shell_3.castShadow = options.castShadow ?? true;
  mesh_front_cover_shell_3.receiveShadow = options.receiveShadow ?? true;
  mesh_front_cover_shell_3.userData.sculptComponent = {"id": "front-cover-shell", "name": "Front moss-cloth cover shell", "level": "meso", "role": "shell", "importance": 1.0, "confidence": 0.98, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "plan-view rounded-rectangle ShapeGeometry extrusion so radius is independent of thin Y thickness", "edgeTreatment": {"type": "rounded chamfer", "bevelRadius": 0.14, "segments": 4}, "deformationStack": ["subtle padded crown +0.018 Y", "compressed perimeter roll"], "uvStrategy": "stable cover-plane projection with cloth grain aligned along Z", "normalStrategy": "weighted vertex normals plus independent woven tangent normal"}, "parent": "front-cover-pivot", "attachment": null, "dimensions": {"width": 3.12, "height": 0.13, "depth": 3.76, "units": "notebook-local", "confidence": 0.98}, "transform": {"position": [1.5, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "material": "moss-cloth", "materialLayers": ["moss-cloth"], "localFeatures": [{"id": "cover-corner-chamfer", "type": "edgeTreatment", "bevelRadius": 0.14, "segments": 4, "plane": "XZ"}, {"id": "cloth-wrap-perimeter-seam", "type": "recessed groove", "width": 0.025, "depth": 0.008, "inset": 0.07}], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.18, "bumpAmplitude": 0.014, "normalPattern": "directional warp/weft rib field", "displacementPattern": "perimeter compression only", "occlusionPattern": "wrap seam and inner cover contact", "edgeWearPattern": "slightly lower roughness on handled roll", "notes": "Do not reuse albedo as roughness or normal."}, "evidenceRefs": ["closed-overall", "closed-cloth-closeup"], "fidelityTier": "hero"};
  node_front_cover_shell_3.add(mesh_front_cover_shell_3);
  meshes["front-cover-shell"] = mesh_front_cover_shell_3;
  colliders["front-cover-shell"] = {};
  // TODO: replace 'front-cover-shell' box fallback with extrude procedural geometry.

  const attachment_back_cover_shell_4 = null;
  const endpoint_back_cover_shell_4 = makeAttachmentEndpoint(attachment_back_cover_shell_4);
  const node_back_cover_shell_4 = new THREE.Group();
  node_back_cover_shell_4.name = "Rear moss-cloth cover shell (consistency inference)__pivot";
  if (endpoint_back_cover_shell_4) {
    node_back_cover_shell_4.position.copy(endpoint_back_cover_shell_4.start);
    node_back_cover_shell_4.rotation.set(0, 0, 0);
    node_back_cover_shell_4.scale.set(1, 1, 1);
  } else {
    node_back_cover_shell_4.position.set(0.0, 0.0, 0.0);
    node_back_cover_shell_4.rotation.set(0.0, 0.0, 0.0);
    node_back_cover_shell_4.scale.set(1.0, 1.0, 1.0);
  }
  node_back_cover_shell_4.userData.sculptComponent = {"id": "back-cover-shell", "name": "Rear moss-cloth cover shell (consistency inference)", "level": "meso", "role": "shell", "importance": 0.95, "confidence": 0.62, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "same plan-view rounded cloth shell construction as front, undecorated on hidden exterior", "edgeTreatment": {"type": "rounded chamfer", "bevelRadius": 0.15, "segments": 4}, "deformationStack": ["padded gutter dip near -X binding edge"], "uvStrategy": "cover-plane projection matched to front cloth texel density", "normalStrategy": "weighted vertex normals plus independent cloth normal"}, "parent": "back-cover-pivot", "attachment": null, "dimensions": {"width": 3.2, "height": 0.17, "depth": 3.82, "units": "notebook-local", "confidence": 0.9}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "material": "moss-cloth", "materialLayers": ["moss-cloth"], "localFeatures": [{"id": "open-cover-lip", "type": "contour", "pageInset": 0.11, "gutterDipDepth": 0.07}, {"id": "rear-cover-consistency", "type": "consistency inference", "observed": false, "decoration": "none; explicitly omit nameplate and rivets"}], "evidenceRefs": ["open-overall", "open-gutter-closeup", "rear-cover-consistency-inference"], "fidelityTier": "hero"};
  node_back_cover_shell_4.userData.actionProfile = {};
  (nodes["back-cover-pivot"] ?? root).add(node_back_cover_shell_4);
  nodes["back-cover-shell"] = node_back_cover_shell_4;
  const mesh_back_cover_shell_4Geometry = endpoint_back_cover_shell_4
    ? new THREE.CylinderGeometry(endpoint_back_cover_shell_4.endRadius, endpoint_back_cover_shell_4.baseRadius, endpoint_back_cover_shell_4.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const mesh_back_cover_shell_4 = new THREE.Mesh(
    mesh_back_cover_shell_4Geometry,
    materialMap["moss-cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_back_cover_shell_4.name = "Rear moss-cloth cover shell (consistency inference)";
  if (endpoint_back_cover_shell_4) {
    mesh_back_cover_shell_4.position.copy(endpoint_back_cover_shell_4.midpoint);
    mesh_back_cover_shell_4.quaternion.copy(endpoint_back_cover_shell_4.quaternion);
  }
  mesh_back_cover_shell_4.castShadow = options.castShadow ?? true;
  mesh_back_cover_shell_4.receiveShadow = options.receiveShadow ?? true;
  mesh_back_cover_shell_4.userData.sculptComponent = {"id": "back-cover-shell", "name": "Rear moss-cloth cover shell (consistency inference)", "level": "meso", "role": "shell", "importance": 0.95, "confidence": 0.62, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "same plan-view rounded cloth shell construction as front, undecorated on hidden exterior", "edgeTreatment": {"type": "rounded chamfer", "bevelRadius": 0.15, "segments": 4}, "deformationStack": ["padded gutter dip near -X binding edge"], "uvStrategy": "cover-plane projection matched to front cloth texel density", "normalStrategy": "weighted vertex normals plus independent cloth normal"}, "parent": "back-cover-pivot", "attachment": null, "dimensions": {"width": 3.2, "height": 0.17, "depth": 3.82, "units": "notebook-local", "confidence": 0.9}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "material": "moss-cloth", "materialLayers": ["moss-cloth"], "localFeatures": [{"id": "open-cover-lip", "type": "contour", "pageInset": 0.11, "gutterDipDepth": 0.07}, {"id": "rear-cover-consistency", "type": "consistency inference", "observed": false, "decoration": "none; explicitly omit nameplate and rivets"}], "evidenceRefs": ["open-overall", "open-gutter-closeup", "rear-cover-consistency-inference"], "fidelityTier": "hero"};
  node_back_cover_shell_4.add(mesh_back_cover_shell_4);
  meshes["back-cover-shell"] = mesh_back_cover_shell_4;
  colliders["back-cover-shell"] = {};
  // TODO: replace 'back-cover-shell' box fallback with extrude procedural geometry.

  const attachment_closed_page_block_5 = null;
  const endpoint_closed_page_block_5 = makeAttachmentEndpoint(attachment_closed_page_block_5);
  const node_closed_page_block_5 = new THREE.Group();
  node_closed_page_block_5.name = "Closed rounded page block__pivot";
  if (endpoint_closed_page_block_5) {
    node_closed_page_block_5.position.copy(endpoint_closed_page_block_5.start);
    node_closed_page_block_5.rotation.set(0, 0, 0);
    node_closed_page_block_5.scale.set(1, 1, 1);
  } else {
    node_closed_page_block_5.position.set(0.04, 0.135, 0.0);
    node_closed_page_block_5.rotation.set(0.0, 0.0, 0.0);
    node_closed_page_block_5.scale.set(1.0, 1.0, 1.0);
  }
  node_closed_page_block_5.userData.sculptComponent = {"id": "closed-page-block", "name": "Closed rounded page block", "level": "meso", "role": "page-volume", "importance": 1.0, "confidence": 0.98, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "rounded plan-view paper block with bowed fore-edge and grouped layer geometry", "edgeTreatment": {"type": "rounded paper edge", "bevelRadius": 0.1, "segments": 4}, "deformationStack": ["fore-edge convex bow 0.035", "corner leaf compression"], "uvStrategy": "separate face and edge projections", "normalStrategy": "smooth top face; edge normals preserve leaf strata"}, "parent": "back-cover-pivot", "attachment": null, "dimensions": {"width": 3.02, "height": 0.13, "depth": 3.62, "units": "notebook-local", "confidence": 0.98}, "transform": {"position": [0.04, 0.135, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "material": "ivory-paper", "materialLayers": ["ivory-paper"], "localFeatures": [{"id": "page-block-rounded-fore-edge", "type": "bowed contour", "bowDepth": 0.035, "coverInset": 0.1, "cornerRadius": 0.1}], "evidenceRefs": ["closed-overall", "closed-fore-edge-closeup"], "fidelityTier": "hero"};
  node_closed_page_block_5.userData.actionProfile = {};
  (nodes["back-cover-pivot"] ?? root).add(node_closed_page_block_5);
  nodes["closed-page-block"] = node_closed_page_block_5;
  const mesh_closed_page_block_5Geometry = endpoint_closed_page_block_5
    ? new THREE.CylinderGeometry(endpoint_closed_page_block_5.endRadius, endpoint_closed_page_block_5.baseRadius, endpoint_closed_page_block_5.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const mesh_closed_page_block_5 = new THREE.Mesh(
    mesh_closed_page_block_5Geometry,
    materialMap["ivory-paper"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_closed_page_block_5.name = "Closed rounded page block";
  if (endpoint_closed_page_block_5) {
    mesh_closed_page_block_5.position.copy(endpoint_closed_page_block_5.midpoint);
    mesh_closed_page_block_5.quaternion.copy(endpoint_closed_page_block_5.quaternion);
  }
  mesh_closed_page_block_5.castShadow = options.castShadow ?? true;
  mesh_closed_page_block_5.receiveShadow = options.receiveShadow ?? true;
  mesh_closed_page_block_5.userData.sculptComponent = {"id": "closed-page-block", "name": "Closed rounded page block", "level": "meso", "role": "page-volume", "importance": 1.0, "confidence": 0.98, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "rounded plan-view paper block with bowed fore-edge and grouped layer geometry", "edgeTreatment": {"type": "rounded paper edge", "bevelRadius": 0.1, "segments": 4}, "deformationStack": ["fore-edge convex bow 0.035", "corner leaf compression"], "uvStrategy": "separate face and edge projections", "normalStrategy": "smooth top face; edge normals preserve leaf strata"}, "parent": "back-cover-pivot", "attachment": null, "dimensions": {"width": 3.02, "height": 0.13, "depth": 3.62, "units": "notebook-local", "confidence": 0.98}, "transform": {"position": [0.04, 0.135, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "material": "ivory-paper", "materialLayers": ["ivory-paper"], "localFeatures": [{"id": "page-block-rounded-fore-edge", "type": "bowed contour", "bowDepth": 0.035, "coverInset": 0.1, "cornerRadius": 0.1}], "evidenceRefs": ["closed-overall", "closed-fore-edge-closeup"], "fidelityTier": "hero"};
  node_closed_page_block_5.add(mesh_closed_page_block_5);
  meshes["closed-page-block"] = mesh_closed_page_block_5;
  colliders["closed-page-block"] = {};
  // TODO: replace 'closed-page-block' box fallback with extrude procedural geometry.

  const attachment_left_page_stack_6 = null;
  const endpoint_left_page_stack_6 = makeAttachmentEndpoint(attachment_left_page_stack_6);
  const node_left_page_stack_6 = new THREE.Group();
  node_left_page_stack_6.name = "Left articulated page stack__pivot";
  if (endpoint_left_page_stack_6) {
    node_left_page_stack_6.position.copy(endpoint_left_page_stack_6.start);
    node_left_page_stack_6.rotation.set(0, 0, 0);
    node_left_page_stack_6.scale.set(1, 1, 1);
  } else {
    node_left_page_stack_6.position.set(1.5, -0.082, 0.0);
    node_left_page_stack_6.rotation.set(0.0, 0.0, 0.0);
    node_left_page_stack_6.scale.set(1.0, 1.0, 1.0);
  }
  node_left_page_stack_6.userData.sculptComponent = {"id": "left-page-stack", "name": "Left articulated page stack", "level": "meso", "role": "page-volume", "importance": 1.0, "confidence": 0.96, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "front-pivot child page wedge with curved outer fan", "edgeTreatment": {"type": "rounded paper edge", "bevelRadius": 0.08, "segments": 3}, "deformationStack": ["leaf fan rises at outer edge", "stack settles into gutter"], "uvStrategy": "page-plane projection", "normalStrategy": "smooth page normals plus layered edge strips"}, "parent": "front-cover-pivot", "attachment": null, "dimensions": {"width": 2.82, "height": 0.12, "depth": 3.46, "units": "notebook-local", "confidence": 0.95}, "transform": {"position": [1.5, -0.082, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "material": "ivory-paper", "materialLayers": ["ivory-paper"], "localFeatures": [{"id": "page-fan-outer-edge", "type": "deterministic layered fan", "visibleLayerGroups": 9, "offsetRange": [0.006, 0.026], "seed": 20260810}], "evidenceRefs": ["open-overall", "open-gutter-closeup"], "fidelityTier": "hero"};
  node_left_page_stack_6.userData.actionProfile = {};
  (nodes["front-cover-pivot"] ?? root).add(node_left_page_stack_6);
  nodes["left-page-stack"] = node_left_page_stack_6;
  const mesh_left_page_stack_6Geometry = endpoint_left_page_stack_6
    ? new THREE.CylinderGeometry(endpoint_left_page_stack_6.endRadius, endpoint_left_page_stack_6.baseRadius, endpoint_left_page_stack_6.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const mesh_left_page_stack_6 = new THREE.Mesh(
    mesh_left_page_stack_6Geometry,
    materialMap["ivory-paper"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_left_page_stack_6.name = "Left articulated page stack";
  if (endpoint_left_page_stack_6) {
    mesh_left_page_stack_6.position.copy(endpoint_left_page_stack_6.midpoint);
    mesh_left_page_stack_6.quaternion.copy(endpoint_left_page_stack_6.quaternion);
  }
  mesh_left_page_stack_6.castShadow = options.castShadow ?? true;
  mesh_left_page_stack_6.receiveShadow = options.receiveShadow ?? true;
  mesh_left_page_stack_6.userData.sculptComponent = {"id": "left-page-stack", "name": "Left articulated page stack", "level": "meso", "role": "page-volume", "importance": 1.0, "confidence": 0.96, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "front-pivot child page wedge with curved outer fan", "edgeTreatment": {"type": "rounded paper edge", "bevelRadius": 0.08, "segments": 3}, "deformationStack": ["leaf fan rises at outer edge", "stack settles into gutter"], "uvStrategy": "page-plane projection", "normalStrategy": "smooth page normals plus layered edge strips"}, "parent": "front-cover-pivot", "attachment": null, "dimensions": {"width": 2.82, "height": 0.12, "depth": 3.46, "units": "notebook-local", "confidence": 0.95}, "transform": {"position": [1.5, -0.082, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "material": "ivory-paper", "materialLayers": ["ivory-paper"], "localFeatures": [{"id": "page-fan-outer-edge", "type": "deterministic layered fan", "visibleLayerGroups": 9, "offsetRange": [0.006, 0.026], "seed": 20260810}], "evidenceRefs": ["open-overall", "open-gutter-closeup"], "fidelityTier": "hero"};
  node_left_page_stack_6.add(mesh_left_page_stack_6);
  meshes["left-page-stack"] = mesh_left_page_stack_6;
  colliders["left-page-stack"] = {};
  // TODO: replace 'left-page-stack' box fallback with extrude procedural geometry.

  const attachment_right_page_stack_7 = null;
  const endpoint_right_page_stack_7 = makeAttachmentEndpoint(attachment_right_page_stack_7);
  const node_right_page_stack_7 = new THREE.Group();
  node_right_page_stack_7.name = "Right stable page stack__pivot";
  if (endpoint_right_page_stack_7) {
    node_right_page_stack_7.position.copy(endpoint_right_page_stack_7.start);
    node_right_page_stack_7.rotation.set(0, 0, 0);
    node_right_page_stack_7.scale.set(1, 1, 1);
  } else {
    node_right_page_stack_7.position.set(0.08, 0.225, 0.0);
    node_right_page_stack_7.rotation.set(0.0, 0.0, 0.0);
    node_right_page_stack_7.scale.set(1.0, 1.0, 1.0);
  }
  node_right_page_stack_7.userData.sculptComponent = {"id": "right-page-stack", "name": "Right stable page stack", "level": "meso", "role": "page-volume", "importance": 1.0, "confidence": 0.97, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "rear-pivot child page wedge with curved outer fan", "edgeTreatment": {"type": "rounded paper edge", "bevelRadius": 0.08, "segments": 3}, "deformationStack": ["independent leaf offsets", "stack settles into gutter"], "uvStrategy": "page-plane projection", "normalStrategy": "smooth page normals plus layered edge strips"}, "parent": "back-cover-pivot", "attachment": null, "dimensions": {"width": 2.9, "height": 0.12, "depth": 3.54, "units": "notebook-local", "confidence": 0.96}, "transform": {"position": [0.08, 0.225, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "material": "ivory-paper", "materialLayers": ["ivory-paper"], "localFeatures": [{"id": "page-fan-outer-edge", "type": "deterministic layered fan", "visibleLayerGroups": 9, "offsetRange": [0.005, 0.024], "seed": 20260811}], "evidenceRefs": ["open-overall", "open-gutter-closeup"], "fidelityTier": "hero"};
  node_right_page_stack_7.userData.actionProfile = {};
  (nodes["back-cover-pivot"] ?? root).add(node_right_page_stack_7);
  nodes["right-page-stack"] = node_right_page_stack_7;
  const mesh_right_page_stack_7Geometry = endpoint_right_page_stack_7
    ? new THREE.CylinderGeometry(endpoint_right_page_stack_7.endRadius, endpoint_right_page_stack_7.baseRadius, endpoint_right_page_stack_7.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const mesh_right_page_stack_7 = new THREE.Mesh(
    mesh_right_page_stack_7Geometry,
    materialMap["ivory-paper"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_right_page_stack_7.name = "Right stable page stack";
  if (endpoint_right_page_stack_7) {
    mesh_right_page_stack_7.position.copy(endpoint_right_page_stack_7.midpoint);
    mesh_right_page_stack_7.quaternion.copy(endpoint_right_page_stack_7.quaternion);
  }
  mesh_right_page_stack_7.castShadow = options.castShadow ?? true;
  mesh_right_page_stack_7.receiveShadow = options.receiveShadow ?? true;
  mesh_right_page_stack_7.userData.sculptComponent = {"id": "right-page-stack", "name": "Right stable page stack", "level": "meso", "role": "page-volume", "importance": 1.0, "confidence": 0.97, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "rear-pivot child page wedge with curved outer fan", "edgeTreatment": {"type": "rounded paper edge", "bevelRadius": 0.08, "segments": 3}, "deformationStack": ["independent leaf offsets", "stack settles into gutter"], "uvStrategy": "page-plane projection", "normalStrategy": "smooth page normals plus layered edge strips"}, "parent": "back-cover-pivot", "attachment": null, "dimensions": {"width": 2.9, "height": 0.12, "depth": 3.54, "units": "notebook-local", "confidence": 0.96}, "transform": {"position": [0.08, 0.225, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "material": "ivory-paper", "materialLayers": ["ivory-paper"], "localFeatures": [{"id": "page-fan-outer-edge", "type": "deterministic layered fan", "visibleLayerGroups": 9, "offsetRange": [0.005, 0.024], "seed": 20260811}], "evidenceRefs": ["open-overall", "open-gutter-closeup"], "fidelityTier": "hero"};
  node_right_page_stack_7.add(mesh_right_page_stack_7);
  meshes["right-page-stack"] = mesh_right_page_stack_7;
  colliders["right-page-stack"] = {};
  // TODO: replace 'right-page-stack' box fallback with extrude procedural geometry.

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createWarmPaperAtelierNotebookLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Warm Paper Atelier Notebook look-dev lights";
  const hemi = new THREE.HemisphereLight(
    mode === 'reference' ? 0xfff0d6 : 0xf2f4ff,
    0x363b42,
    mode === 'grazing' ? 0.28 : mode === 'reference' ? 0.72 : 0.85,
  );
  lights.add(hemi);
  const key = new THREE.DirectionalLight(
    mode === 'reference' ? 0xffcf8a : 0xfff4e8,
    mode === 'grazing' ? 4.2 : mode === 'reference' ? 2.6 : 2.15,
  );
  if (mode === 'grazing') key.position.set(7.5, 1.1, 4.0);
  else if (mode === 'reference') key.position.set(-4.5, 7.5, 5.0);
  else key.position.set(-4.0, 6.0, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.00025;
  key.shadow.normalBias = 0.018;
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = [{"id": "warm-key", "type": "directional key light", "direction": [-0.62, 0.78, 0.38], "color": "#FFE4C2", "intensity": 2.0, "castsShadow": true, "shadowSoftness": "PCFSoftShadowMap with restrained 1024 map and contact definition at cover/page overlaps", "evidenceRefs": ["closed-overall", "closed-nameplate-closeup"]}, {"id": "cool-nonshadow-fill", "type": "hemisphere or low-intensity directional fill light", "direction": [0.45, 0.5, -0.62], "color": "#B9C7B8", "intensity": 0.34, "castsShadow": false, "purpose": "Lift gutter/page-stack values without flattening the key-light relief."}, {"id": "neutral-environment", "type": "non-shadow environment reflection", "color": "#D8D0BF", "intensity": 0.42, "castsShadow": false, "purpose": "Give brass a controlled reflection while cloth and paper remain matte."}, {"id": "renderer-and-contact", "type": "render intent", "exposure": 0.92, "toneMapping": "ACESFilmicToneMapping", "background": "#101713", "contactShadow": "Only the warm key casts real shadows; preserve AO/contact darkening beneath cover lips, page strata, plate, rivets, gutter, and ribbon without near fog."}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}
