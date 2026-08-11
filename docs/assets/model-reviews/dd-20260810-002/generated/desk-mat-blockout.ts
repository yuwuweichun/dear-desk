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

// Generated from ObjectSculptSpec target: Warm Paper Atelier Desk Mat
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createWarmPaperAtelierDeskMatModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Warm Paper Atelier Desk Mat";

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["field-cloth"] = createSculptMaterial(
    "field-cloth",
    {"id": "field-cloth", "name": "Moss woven field cloth", "type": "standard", "shaderModel": "MeshStandardMaterial / PBR approximation", "qualityTier": "hero", "baseColor": "#3E3B29", "color": "#3E3B29", "albedo": {"dominant": "#3E3B29", "secondary": ["#373524", "#46422E", "#2D2C1E", "#504B34"], "samplingNotes": "Palette sampled by moss-cloth PBR evidence; preserve low-contrast olive variation without importing baked highlights."}, "colorVariation": {"palette": ["#3E3B29", "#373524", "#46422E", "#2D2C1E", "#504B34"], "pattern": "mottled", "amplitude": 0.08, "heightCorrelation": 0.16}, "textureResolution": 2048, "textureProjection": {"mode": "planar XZ generated UV", "repeat": [18.0, 13.0], "anisotropy": 8, "texelDensityIntent": "Preserve stable world/object-scale detail; do not stretch micro detail with component scale."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.5, "amplitude": 0.028, "role": "broad olive tonal mottling over 0.4 to 1.2 world units"}, {"id": "meso", "frequency": 18.0, "amplitude": 0.009, "role": "irregular yarn bundles and compressed fiber patches"}, {"id": "micro", "frequency": 96.0, "amplitude": 0.0025, "role": "interlaced crosshatch normal and roughness breakup under grazing light"}], "roughness": {"base": 0.888, "variation": 0.12, "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_roughness.png", "localResponse": "slightly higher roughness in compressed yarn cavities; no plastic clearcoat"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "independent woven crosshatch normal", "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_normal.png", "strength": 0.347, "scale": 96.0, "space": "tangent"}, "bump": {"pattern": "none", "amplitude": 0.0, "scale": 1.0}, "displacement": {"pattern": "none", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_ao.png", "cavityStrength": 0.25, "contactShadowBias": 0.35, "notes": "Darken creases, seams, intersections, and recessed local features."}, "wear": {"edgeWear": 0.0, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#2F2A22"}, "localOverrides": [{"id": "woven-crosshatch", "region": "complete inset top field", "normalStrength": 0.347, "roughnessVariation": 0.12, "evidenceRefs": ["mat-field", "moss-cloth-pbr"]}, {"id": "olive-tonal-mottle", "region": "broad irregular field patches", "fadedMask": 0.06, "dirtAmount": 0.0, "roughnessVariation": 0.05, "evidenceRefs": ["mat-field"]}], "referencePbr": {"version": "1.0", "sourceImage": "docs/assets/model-reviews/dd-20260810-002/pbr-crops/moss-cloth.png", "extractor": "forge/stage1_intake/extract_pbr_evidence.py", "method": "single-image reference-derived material evidence", "verdict": "pass", "usable": true, "confidence": 0.761, "estimatedFidelity": 0.761, "targetThreshold": 0.7, "hardLimit": "Single-image inverse rendering cannot prove physical PBR; neutral and grazing render review remains required.", "report": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth-report.json", "maps": {"albedo": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_albedo.png", "channel": "albedo"}, "roughness": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_roughness.png", "channel": "roughness"}, "height": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_height.png", "channel": "height"}, "normal": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_normal.png", "channel": "normal"}, "ao": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_ao.png", "channel": "ao"}}}, "shaderNotes": ["Prefer MeshPhysicalMaterial when clearcoat, sheen, transmission, or thin-surface response is observed; otherwise use MeshStandardMaterial-compatible PBR channels.", "Generate albedo, roughness, height/normal, and AO independently; never alias albedo into roughness.", "Use normal/bump/displacement only when they map to observed surface relief.", "Use displacement geometry when the observed relief changes the close-up silhouette; texture-only relief is insufficient there."], "notes": "Reference-fidelity field material. Generate independent 2048px albedo, roughness, height/normal, and AO channels; never alias albedo into another channel."},
    options
  );
  materialMap["binding-textile"] = createSculptMaterial(
    "binding-textile",
    {"id": "binding-textile", "name": "Dark wrapped moss binding", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "qualityTier": "hero", "baseColor": "#2D3022", "color": "#2D3022", "albedo": {"dominant": "#2D3022", "secondary": ["#353727", "#25271B", "#414230"], "samplingNotes": "Same moss textile family as the field, darkened at the wrapped perimeter and relit without baked source highlight."}, "colorVariation": {"palette": ["#2D3022", "#353727", "#25271B", "#414230"], "pattern": "curve-aligned fiber modulation", "amplitude": 0.07, "heightCorrelation": 0.18}, "textureResolution": 2048, "textureProjection": {"mode": "perimeter arc-length UV", "repeat": [30.0, 3.0], "anisotropy": 8, "texelDensityIntent": "Map U by rounded-path length and V around the rolled cross-section so fibers do not stretch at corners."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.3, "amplitude": 0.02, "role": "subtle dark olive variation along long perimeter runs"}, {"id": "meso", "frequency": 22.0, "amplitude": 0.007, "role": "wrapped yarn compression and corner-direction changes"}, {"id": "micro", "frequency": 110.0, "amplitude": 0.002, "role": "longitudinal and curved fiber highlight breakup"}], "roughness": {"base": 0.82, "variation": 0.14, "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_roughness.png", "localResponse": "crest wear locally lowers roughness to 0.28; seam-facing cavity remains rough"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "curve-aligned independent textile normal", "map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_normal.png", "strength": 0.31, "scale": 110.0, "space": "tangent"}, "bump": {"pattern": "independent wrapped-fiber height", "amplitude": 0.002, "scale": 110.0}, "displacement": {"pattern": "rolled geometry supplies silhouette relief", "amplitude": 0.0, "scale": 1.0, "silhouetteAffects": false}, "ambientOcclusion": {"map": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_ao.png", "cavityStrength": 0.34, "contactShadowBias": 0.42, "notes": "Concentrate AO at seam-facing groove and desktop contact, never as uniform dark noise."}, "wear": {"edgeWear": 0.08, "scratches": [], "chips": []}, "dirt": {"amount": 0.0, "cavityBias": 0.0, "color": "#202218"}, "localOverrides": [{"id": "perimeter-fiber-grain", "region": "complete wrapped binding", "normalDirection": "rounded-path tangent", "normalStrength": 0.31, "evidenceRefs": ["mat-edge-closeup", "moss-cloth-pbr"]}, {"id": "crest-wear-highlight", "region": "outer 20 percent of rolled crest", "roughness": 0.28, "clearcoat": 0.04, "clearcoatRoughness": 0.32, "evidenceRefs": ["mat-edge-closeup"]}], "referencePbr": {"version": "1.0", "sourceImage": "docs/assets/model-reviews/dd-20260810-002/pbr-crops/moss-cloth.png", "extractor": "forge/stage1_intake/extract_pbr_evidence.py", "method": "single-image evidence remapped along perimeter arc length", "verdict": "pass", "usable": true, "confidence": 0.761, "estimatedFidelity": 0.761, "targetThreshold": 0.7, "hardLimit": "The crop supports textile response but not exact wrapped-edge inverse rendering; grazing review must verify the remapping.", "report": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth-report.json", "maps": {"albedo": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_albedo.png", "channel": "albedo"}, "roughness": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_roughness.png", "channel": "roughness"}, "height": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_height.png", "channel": "height"}, "normal": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_normal.png", "channel": "normal"}, "ao": {"path": "docs/assets/model-reviews/dd-20260810-002/pbr-evidence/moss-cloth/moss-cloth_ao.png", "channel": "ao"}}}, "shaderNotes": ["Use a curve-length coordinate for the long direction and a rolled-profile coordinate across the binding.", "Do not reuse albedo as roughness, height, normal, or AO."], "notes": "The reference shows a restrained grazing highlight on the binding crest, not a uniformly glossy plastic tube."},
    options
  );
  materialMap["utility-dark"] = createSculptMaterial(
    "utility-dark",
    {"id": "utility-dark", "name": "Hidden root, seam cavity, and non-slip utility material", "type": "standard", "shaderModel": "MeshStandardMaterial", "qualityTier": "utility", "baseColor": "#202218", "color": "#202218", "albedo": {"dominant": "#202218", "secondary": ["#292B20"], "samplingNotes": "Utility support only."}, "colorVariation": {"palette": ["#202218", "#292B20"], "pattern": "none", "amplitude": 0.01, "heightCorrelation": 0.0}, "roughness": {"base": 0.96, "variation": 0.03, "map": "independent-procedural-utility-roughness"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "fine rubber grain", "strength": 0.08, "scale": 48.0}, "ambientOcclusion": {"cavityStrength": 0.4, "contactShadowBias": 0.5}, "localOverrides": [{"id": "contact-ao-band", "region": "desktop contact perimeter", "roughness": 0.98, "evidenceRefs": ["mat-edge-closeup"]}], "notes": "Root geometry should be invisible; only seam and underlay meshes use visible instances of this utility material."},
    options
  );
  materialMap["stitch-thread"] = createSculptMaterial(
    "stitch-thread",
    {"id": "stitch-thread", "name": "Muted olive stitch thread", "type": "standard", "shaderModel": "MeshStandardMaterial", "qualityTier": "utility", "baseColor": "#73745A", "color": "#73745A", "albedo": {"dominant": "#73745A", "secondary": ["#62644C"], "samplingNotes": "Low-contrast thread visible against the darker seam."}, "colorVariation": {"palette": ["#73745A", "#62644C"], "pattern": "per-instance deterministic variation", "amplitude": 0.04, "heightCorrelation": 0.0}, "roughness": {"base": 0.78, "variation": 0.08, "map": "independent-procedural-thread-roughness"}, "metalness": {"base": 0.0, "variation": 0.0}, "normal": {"pattern": "thread twist", "strength": 0.12, "scale": 80.0}, "ambientOcclusion": {"cavityStrength": 0.24, "contactShadowBias": 0.32}, "localOverrides": [{"id": "thread-contact-shadow", "region": "base of each raised dash", "roughness": 0.82, "evidenceRefs": ["mat-edge-closeup"]}], "notes": "One shared material and one instanced geometry; no per-stitch draw calls."},
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
  node_root_0.name = "Warm Paper Atelier Desk Mat__pivot";
  if (endpoint_root_0) {
    node_root_0.position.copy(endpoint_root_0.start);
    node_root_0.rotation.set(0, 0, 0);
    node_root_0.scale.set(1, 1, 1);
  } else {
    node_root_0.position.set(0.0, 0.025, 0.2);
    node_root_0.rotation.set(0.0, 0.0, 0.0);
    node_root_0.scale.set(1.0, 1.0, 1.0);
  }
  node_root_0.userData.sculptComponent = {"id": "root", "name": "Warm Paper Atelier Desk Mat", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.5, "primitive": "box", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 8.7, "height": 0.13, "depth": 6.25, "units": "Three.js world units", "confidence": 1.0}, "transform": {"position": [0, 0.025, 0.2], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 1.0}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "rounded-rectangle-prism", "offset": [0, 0, 0], "scale": [8.7, 0.13, 6.25], "isTrigger": false, "notes": "Plan radius 0.55. Preserve sticker hit plane y=0.11 and placement bounds x=[-4.05,4.05], z=[-2.72,2.72]."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "utility-dark"}}, "material": "utility-dark", "materialLayers": ["utility-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rounded-hit-proxy", "type": "collider", "shape": "rounded rectangle", "radius": 0.55}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["mat-full"], "details": [], "fidelityTier": "contract"};
  node_root_0.userData.actionProfile = {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 1.0}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "rounded-rectangle-prism", "offset": [0, 0, 0], "scale": [8.7, 0.13, 6.25], "isTrigger": false, "notes": "Plan radius 0.55. Preserve sticker hit plane y=0.11 and placement bounds x=[-4.05,4.05], z=[-2.72,2.72]."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "utility-dark"}};
  (nodes["root"] ?? root).add(node_root_0);
  nodes["root"] = node_root_0;
  const mesh_root_0Geometry = endpoint_root_0
    ? new THREE.CylinderGeometry(endpoint_root_0.endRadius, endpoint_root_0.baseRadius, endpoint_root_0.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 12, 12, 12);
  const mesh_root_0 = new THREE.Mesh(
    mesh_root_0Geometry,
    materialMap["utility-dark"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_root_0.name = "Warm Paper Atelier Desk Mat";
  if (endpoint_root_0) {
    mesh_root_0.position.copy(endpoint_root_0.midpoint);
    mesh_root_0.quaternion.copy(endpoint_root_0.quaternion);
  }
  mesh_root_0.castShadow = options.castShadow ?? true;
  mesh_root_0.receiveShadow = options.receiveShadow ?? true;
  mesh_root_0.userData.sculptComponent = {"id": "root", "name": "Warm Paper Atelier Desk Mat", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.5, "primitive": "box", "geometryDescriptor": {"topologyIntent": "low-poly blockout with bevel-ready edges", "edgeTreatment": {"type": "none", "bevelRadius": 0.0, "segments": 1}, "deformationStack": [], "uvStrategy": "generated procedural coordinates", "normalStrategy": "vertex normals from generated geometry"}, "parent": null, "attachment": null, "dimensions": {"width": 8.7, "height": 0.13, "depth": 6.25, "units": "Three.js world units", "confidence": 1.0}, "transform": {"position": [0, 0.025, 0.2], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 1.0}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": {"type": "rounded-rectangle-prism", "offset": [0, 0, 0], "scale": [8.7, 0.13, 6.25], "isTrigger": false, "notes": "Plan radius 0.55. Preserve sticker hit plane y=0.11 and placement bounds x=[-4.05,4.05], z=[-2.72,2.72]."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "root", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0.0, "debrisMaterial": "utility-dark"}}, "material": "utility-dark", "materialLayers": ["utility-dark"], "deformations": [], "joints": [], "seams": [], "localFeatures": [{"id": "rounded-hit-proxy", "type": "collider", "shape": "rounded rectangle", "radius": 0.55}], "surfaceDetail": {"macroRoughness": 0.0, "microRoughness": 0.0, "bumpAmplitude": 0.0, "normalPattern": "", "displacementPattern": "", "occlusionPattern": "", "edgeWearPattern": "", "notes": ""}, "evidenceRefs": ["mat-full"], "details": [], "fidelityTier": "contract"};
  node_root_0.add(mesh_root_0);
  meshes["root"] = mesh_root_0;
  colliders["root"] = {"type": "rounded-rectangle-prism", "offset": [0, 0, 0], "scale": [8.7, 0.13, 6.25], "isTrigger": false, "notes": "Plan radius 0.55. Preserve sticker hit plane y=0.11 and placement bounds x=[-4.05,4.05], z=[-2.72,2.72]."};
  destructionGroups["root"] ??= [];
  destructionGroups["root"].push(node_root_0);

  const attachment_mat_body_1 = null;
  const endpoint_mat_body_1 = makeAttachmentEndpoint(attachment_mat_body_1);
  const node_mat_body_1 = new THREE.Group();
  node_mat_body_1.name = "Rounded extruded mat body__pivot";
  if (endpoint_mat_body_1) {
    node_mat_body_1.position.copy(endpoint_mat_body_1.start);
    node_mat_body_1.rotation.set(0, 0, 0);
    node_mat_body_1.scale.set(1, 1, 1);
  } else {
    node_mat_body_1.position.set(0.0, 0.0, 0.0);
    node_mat_body_1.rotation.set(0.0, 0.0, 0.0);
    node_mat_body_1.scale.set(1.0, 1.0, 1.0);
  }
  node_mat_body_1.userData.sculptComponent = {"id": "mat-body", "name": "Rounded extruded mat body", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.96, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "2D rounded-rectangle Shape extruded along Y; do not use RoundedBoxGeometry because thin height clamps plan radius", "edgeTreatment": {"type": "rounded plan profile", "bevelRadius": 0.55, "segments": 12}, "deformationStack": ["0.012-unit low padded crown in the inset field"], "uvStrategy": "planar XZ projection with stable world-space texel density", "normalStrategy": "smooth side normals and independent tangent-space cloth normal"}, "parent": "root", "attachment": null, "dimensions": {"width": 8.7, "height": 0.1, "depth": 6.25, "units": "world", "confidence": 0.96}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 1.0}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": null, "constraints": []}, "material": "field-cloth", "materialLayers": ["field-cloth"], "deformations": ["subtle crown only; preserve planar usability"], "joints": [], "seams": ["seam-channel"], "localFeatures": [{"id": "plan-corner-radius", "type": "plan silhouette", "radius": 0.55, "segments": 12}, {"id": "low-padded-crown", "type": "local deformation", "height": 0.012, "falloff": "to inset seam datum"}], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.18, "bumpAmplitude": 0.004, "normalPattern": "woven crosshatch", "displacementPattern": "low crown only", "occlusionPattern": "binding and seam contacts", "edgeWearPattern": "none", "notes": "Keep the field low and nearly planar."}, "evidenceRefs": ["mat-full", "mat-field"], "fidelityTier": "hero"};
  node_mat_body_1.userData.actionProfile = {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 1.0}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": null, "constraints": []};
  (nodes["root"] ?? root).add(node_mat_body_1);
  nodes["mat-body"] = node_mat_body_1;
  const mesh_mat_body_1Geometry = endpoint_mat_body_1
    ? new THREE.CylinderGeometry(endpoint_mat_body_1.endRadius, endpoint_mat_body_1.baseRadius, endpoint_mat_body_1.length, 32, 12)
    : new THREE.BoxGeometry(1, 1, 1, 8, 8, 8);
  const mesh_mat_body_1 = new THREE.Mesh(
    mesh_mat_body_1Geometry,
    materialMap["field-cloth"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_mat_body_1.name = "Rounded extruded mat body";
  if (endpoint_mat_body_1) {
    mesh_mat_body_1.position.copy(endpoint_mat_body_1.midpoint);
    mesh_mat_body_1.quaternion.copy(endpoint_mat_body_1.quaternion);
  }
  mesh_mat_body_1.castShadow = options.castShadow ?? true;
  mesh_mat_body_1.receiveShadow = options.receiveShadow ?? true;
  mesh_mat_body_1.userData.sculptComponent = {"id": "mat-body", "name": "Rounded extruded mat body", "level": "macro", "role": "body", "importance": 1.0, "confidence": 0.96, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "2D rounded-rectangle Shape extruded along Y; do not use RoundedBoxGeometry because thin height clamps plan radius", "edgeTreatment": {"type": "rounded plan profile", "bevelRadius": 0.55, "segments": 12}, "deformationStack": ["0.012-unit low padded crown in the inset field"], "uvStrategy": "planar XZ projection with stable world-space texel density", "normalStrategy": "smooth side normals and independent tangent-space cloth normal"}, "parent": "root", "attachment": null, "dimensions": {"width": 8.7, "height": 0.1, "depth": 6.25, "units": "world", "confidence": 0.96}, "transform": {"position": [0, 0, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 1.0}, "transformChannels": {"translate": false, "rotate": false, "scale": false, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [], "collider": null, "constraints": []}, "material": "field-cloth", "materialLayers": ["field-cloth"], "deformations": ["subtle crown only; preserve planar usability"], "joints": [], "seams": ["seam-channel"], "localFeatures": [{"id": "plan-corner-radius", "type": "plan silhouette", "radius": 0.55, "segments": 12}, {"id": "low-padded-crown", "type": "local deformation", "height": 0.012, "falloff": "to inset seam datum"}], "surfaceDetail": {"macroRoughness": 0.08, "microRoughness": 0.18, "bumpAmplitude": 0.004, "normalPattern": "woven crosshatch", "displacementPattern": "low crown only", "occlusionPattern": "binding and seam contacts", "edgeWearPattern": "none", "notes": "Keep the field low and nearly planar."}, "evidenceRefs": ["mat-full", "mat-field"], "fidelityTier": "hero"};
  node_mat_body_1.add(mesh_mat_body_1);
  meshes["mat-body"] = mesh_mat_body_1;
  colliders["mat-body"] = null;
  // TODO: replace 'mat-body' box fallback with extrude procedural geometry.

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createWarmPaperAtelierDeskMatLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Warm Paper Atelier Desk Mat look-dev lights";
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
  lights.userData.lightingFromPhoto = [{"id": "warm-key", "type": "directional key light", "direction": [-4.0, 9.0, 5.0], "color": "#FFE0AD", "intensity": 2.25, "castsShadow": true, "shadowSoftness": 0.45, "notes": "The only shadow-casting light; reveal the rolled edge and stitch relief from upper-left."}, {"id": "cool-fill", "type": "hemisphere fill light", "direction": [7.0, 4.0, -5.0], "color": "#AEBDB4", "intensity": 0.34, "castsShadow": false, "notes": "Lift the dark moss field without flattening the seam channel or contact shadow."}, {"id": "environment-rim", "type": "non-shadowing environment and restrained rim response", "color": "#D7D3C4", "intensity": 0.22, "castsShadow": false, "notes": "Provide only enough environment reflection to separate the binding crest from the walnut desktop."}, {"id": "output-and-grounding", "type": "render output contract", "exposure": 1.0, "toneMapping": "ACES Filmic", "background": "warm walnut desktop; no decorative fog over the mat", "contactShadow": "tight soft shadow at world y=-0.04 with no visible floating gap or surface intersection", "notes": "Verify neutral, grazing, orthographic-top, and reference-match views before acceptance."}];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}
