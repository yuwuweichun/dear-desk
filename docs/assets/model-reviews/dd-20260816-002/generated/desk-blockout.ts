import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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

// bevelEnabled defaults to true on THREE.ExtrudeGeometry and rounds every
// corner — sharp/pointed profiles (blades, fork tines, spikes) need
// bevelEnabled: false plus lineTo()-only path segments near the tip, since a
// curve command cannot produce a true converging point.
function buildExtrudeShape(points: [number, number][], holes?: [number, number][][]): THREE.Shape {
  const shape = new THREE.Shape();
  if (points.length > 0) {
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      shape.lineTo(points[i][0], points[i][1]);
    }
  }
  // Cutouts (e.g. an oval wire-cutter hole) as THREE.Path added to shape.holes —
  // dep-free boolean subtraction via the tessellator, no CSG library needed.
  for (const loop of holes ?? []) {
    if (loop.length < 3) continue;
    const path = new THREE.Path();
    path.moveTo(loop[0][0], loop[0][1]);
    for (let i = 1; i < loop.length; i += 1) path.lineTo(loop[i][0], loop[i][1]);
    path.closePath();
    shape.holes.push(path);
  }
  return shape;
}

// Build an N-gon oval loop (for hole authoring from a compact {cx,cy,rx,ry} descriptor).
function ovalLoop(cx: number, cy: number, rx: number, ry: number, seg = 24): [number, number][] {
  const loop: [number, number][] = [];
  for (let i = 0; i < seg; i += 1) {
    const a = (i / seg) * Math.PI * 2;
    loop.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return loop;
}

function buildExtrudeGeometry(profile: { points: [number, number][]; depth: number; holes?: [number, number][][]; ovalHoles?: { cx: number; cy: number; rx: number; ry: number }[] }): THREE.ExtrudeGeometry {
  const holes = [...(profile.holes ?? []), ...((profile.ovalHoles ?? []).map((o) => ovalLoop(o.cx, o.cy, o.rx, o.ry)))];
  const shape = buildExtrudeShape(profile.points, holes);
  return new THREE.ExtrudeGeometry(shape, {
    depth: profile.depth,
    bevelEnabled: false,
    steps: 1,
  });
}

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
  return [clampAlbedoChannel((value >> 16) & 255), clampAlbedoChannel((value >> 8) & 255), clampAlbedoChannel(value & 255)];
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

function clampAlbedoChannel(value: number): number {
  return Math.max(30, Math.min(240, Math.round(value)));
}

function clampPbrF0(value: number): number {
  return Math.max(0.02, Math.min(1, value));
}

function clampPbrIor(value: number): number {
  return Math.max(1, Math.min(2.5, value));
}

function clampPbrMetalness(value: number): number {
  return value >= 0.5 ? 1 : 0;
}

function clampedAlbedoColor(spec: SculptMaterialSpec): THREE.Color {
  const source = typeof spec.baseColor === 'string' ? spec.baseColor : '#8A7A5F';
  const [red, green, blue] = hexToRgb(source);
  return new THREE.Color(red / 255, green / 255, blue / 255);
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

type ColorGradientStop = { offset: number; color: string };
type ColorGradientSpec = {
  type: 'linear' | 'radial';
  axis: [number, number];
  stops: ColorGradientStop[];
};

function parseRgba(value: string): [number, number, number] {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value);
  if (!match) return [138, 122, 95];
  return [clampAlbedoChannel(Number(match[1])), clampAlbedoChannel(Number(match[2])), clampAlbedoChannel(Number(match[3]))];
}

// Analytical per-pixel gradient sample. The extraction schema's colorGradient carries
// exact rgba(...) stop colors (see extract_part_color_recipe.py), so this samples the
// same trend directly in JS math rather than round-tripping through a Canvas 2D
// createLinearGradient/createRadialGradient object — same visual result, and it composes
// directly with the existing noise/height-correlated colorVariation blend below.
function sampleColorGradient(gradient: ColorGradientSpec, u: number, v: number): [number, number, number] {
  const stops = gradient.stops.length >= 2 ? gradient.stops : [{ offset: 0, color: 'rgba(138,122,95,1)' }, { offset: 1, color: 'rgba(138,122,95,1)' }];
  let t: number;
  if (gradient.type === 'radial') {
    const [cx, cy] = gradient.axis;
    const dx = u - cx;
    const dy = v - cy;
    const maxRadius = Math.max(0.001, Math.hypot(Math.max(cx, 1 - cx), Math.max(cy, 1 - cy)));
    t = clamp01(Math.hypot(dx, dy) / maxRadius);
  } else {
    const [ax, ay] = gradient.axis;
    const projection = (u - 0.5) * ax + (v - 0.5) * ay;
    const maxProjection = 0.5 * (Math.abs(ax) + Math.abs(ay)) || 0.5;
    t = clamp01(projection / maxProjection + 0.5);
  }
  const scaled = t * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.max(0, Math.floor(scaled)));
  const mix = scaled - index;
  const a = parseRgba(stops[index].color);
  const b = parseRgba(stops[index + 1].color);
  return [
    THREE.MathUtils.lerp(a[0], b[0], mix),
    THREE.MathUtils.lerp(a[1], b[1], mix),
    THREE.MathUtils.lerp(a[2], b[2], mix),
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
  const colorGradient: ColorGradientSpec | undefined = spec.colorGradient;
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
      let color: [number, number, number];
      if (colorGradient) {
        // Evidence-derived spatial gradient (Plan 1.3 Workstream C) takes priority
        // over the noise-based palette blend below — it is a measured trend, not a guess.
        color = sampleColorGradient(colorGradient, u, v);
      } else {
        const paletteValue = clamp01(
          0.5 + (colorNoise - 0.5) * colorAmplitude * 2 + (height - 0.5) * heightCorrelation
        );
        color = mixPalette(colors, paletteValue);
      }
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

function createSculptMaterial(id: string, spec: SculptMaterialSpec, options: ProceduralModelOptions, denseComponent = false): THREE.MeshPhysicalMaterial {
  const textures = makeReferenceTextureSet(spec, options) ?? makeProceduralTextureSet(id, spec, options);
  const material = new THREE.MeshPhysicalMaterial({
    color: textures ? 0xffffff : clampedAlbedoColor(spec),
    roughness: textures ? 1 : clamp01(readLayerNumber(spec.roughness, ['base'], 0.76)),
    metalness: clampPbrMetalness(readLayerNumber(spec.metalness, ['base'], 0.0)),
    clearcoat: clamp01(readLayerNumber(spec.clearcoat, ['base', 'amount'], 0)),
    clearcoatRoughness: clamp01(readLayerNumber(spec.clearcoatRoughness, ['base'], 0.25)),
    transmission: clamp01(readLayerNumber(spec.transmission, ['base', 'amount'], 0)),
    ior: clampPbrIor(readLayerNumber(spec.ior, ['base', 'value'], 1.5)),
    thickness: Math.max(0, readLayerNumber(spec.thickness, ['base', 'amount'], 0)),
    attenuationDistance: Math.max(0.001, readLayerNumber(spec.attenuationDistance, ['base', 'value'], Infinity)),
    attenuationColor: new THREE.Color(typeof spec.attenuationColor === 'string' ? spec.attenuationColor : '#ffffff'),
    sheen: clamp01(readLayerNumber(spec.sheen, ['base', 'amount'], 0)),
    sheenColor: new THREE.Color(typeof spec.sheenColor === 'string' ? spec.sheenColor : '#ffffff'),
    sheenRoughness: clamp01(readLayerNumber(spec.sheenRoughness, ['base'], 1.0)),
    iridescence: clamp01(readLayerNumber(spec.iridescence, ['base', 'amount'], 0)),
    iridescenceIOR: clampPbrIor(readLayerNumber(spec.iridescenceIOR, ['base', 'value'], 1.3)),
    anisotropy: clamp01(readLayerNumber(spec.anisotropy, ['base', 'amount'], 0)),
    anisotropyRotation: readLayerNumber(spec.anisotropy, ['rotation'], 0),
    specularIntensity: clampPbrF0(readLayerNumber(spec.specularF0 ?? spec.f0 ?? spec.specularIntensity, ['base', 'value'], 1.0)),
    specularColor: new THREE.Color(typeof spec.specularColor === 'string' ? spec.specularColor : '#ffffff'),
    emissive: new THREE.Color(typeof spec.emissive === 'string' ? spec.emissive : '#000000'),
    emissiveIntensity: Math.max(0, readLayerNumber(spec.emissiveIntensity, ['base'], 1.0)),
    opacity: clamp01(readLayerNumber(spec.opacity, ['base'], 1)),
    transparent: readLayerNumber(spec.transmission, ['base', 'amount'], 0) > 0 || readLayerNumber(spec.opacity, ['base'], 1) < 1,
    alphaTest: Math.max(0, readLayerNumber(spec.alpha, ['cutoff', 'alphaTest'], 0)),
    wireframe: options.wireframe ?? false,
    side: spec.doubleSided === true ? THREE.DoubleSide : THREE.FrontSide,
    flatShading: spec.flatShading === true,
  });
  if (textures) {
    material.map = textures.albedo;
    material.roughnessMap = textures.roughness;
    material.normalMap = textures.normal;
    material.normalScale.setScalar(Math.max(0.05, readLayerNumber(spec.normal, ['strength', 'amplitude'], 0.35)));
    material.aoMap = textures.ao;
    material.aoMap.channel = 0;
    material.aoMapIntensity = readLayerNumber(spec.ambientOcclusion, ['cavityStrength', 'strength'], 0.35);
    const denseMesh = denseComponent || spec.denseMesh === true || spec.geometryDensity === 'dense' || spec.topologyClass === 'dense';
    const bumpScale = Math.max(0, readLayerNumber(spec.bump, ['amplitude', 'strength'], 0));
    const effectiveBumpScale = denseMesh ? Math.max(0.05, bumpScale) : bumpScale;
    if (effectiveBumpScale > 0) {
      material.bumpMap = textures.height;
      material.bumpScale = effectiveBumpScale;
    }
    const displacementScale = Math.max(0, readLayerNumber(spec.displacement, ['amplitude', 'strength'], 0));
    const effectiveDisplacementScale = denseMesh ? Math.max(0.005, displacementScale) : displacementScale;
    if (effectiveDisplacementScale > 0) {
      material.displacementMap = textures.height;
      material.displacementScale = effectiveDisplacementScale;
      material.displacementBias = -effectiveDisplacementScale * 0.5;
    }
  }
  material.envMapIntensity = readLayerNumber(spec, ['envMapIntensity'], 0.8);
  material.userData.sculptMaterial = spec;
  material.userData.proceduralMapsIndependent = true;
  material.userData.pbrConstraints = { albedoRange: [30, 240], binaryMetalness: true, f0Range: [0.02, 1], iorRange: [1, 2.5] };
  material.userData.pbrTextureSource = textures?.source ?? 'flat-fallback';
  material.userData.referencePbr = spec.referencePbr ?? null;
  material.userData.referenceMaterialId = spec.referenceMaterialId ?? spec.materialReference?.profileId ?? null;
  material.userData.materialEvidence = spec.materialEvidence ?? null;
  material.userData.validationViews = spec.materialReference?.validationViews ?? [];
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

// Generated from ObjectSculptSpec target: Warm Paper Atelier Desk
// Sculpt build pass: blockout
// This factory is intentionally pass-gated. Finish browser screenshot review before unlocking deeper passes.
export function createWarmPaperAtelierDeskModel(options: ProceduralModelOptions = {}): THREE.Group {
  const root = new THREE.Group();
  root.name = "Warm Paper Atelier Desk";
  root.userData.reconstructionEvidence = {"itemFamily": null, "subtype": null, "componentAdapter": null, "route": null, "exactnessTier": null, "referenceCamera": {"solved": false, "fovDegrees": 40, "aspect": 1, "orientation": {"yaw": 0, "pitch": 0, "roll": 0}, "positionHint": [0, 0, 3], "note": "Named review camera will be aligned to the source front-three-quarter framing; projection is intentionally skipped because the model must remain relightable."}, "approximationNotes": []};
  root.userData.materialPipeline = {};
  root.userData.materialReferenceRegistry = null;

  const materialMap: Record<string, THREE.Material> = {};
  materialMap["walnut-top"] = createSculptMaterial(
    "walnut-top",
    {"id": "walnut-top", "name": "Warm walnut tabletop", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#64381C", "color": "#64381C", "albedo": {"dominant": "#64381C", "secondary": ["#884C24", "#4D2D17", "#3B2312"], "samplingNotes": "Palette from walnut-report.json; exclude dark-green background contamination during procedural synthesis."}, "colorVariation": {"palette": ["#64381C", "#884C24", "#4D2D17"], "pattern": "longitudinal walnut bands with deterministic seed 2101", "amplitude": 0.16, "heightCorrelation": 0.22}, "textureResolution": 2048, "textureProjection": {"mode": "component-aware planar-and-perimeter UV", "repeat": [3.2, 1.1], "anisotropy": 12, "texelDensityIntent": "Stable grain width across the 3.6-unit top; +X on face and arc length on edge."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.8, "amplitude": 0.16, "role": "broad heartwood/sapwood tonal flow"}, {"id": "meso", "frequency": 13, "amplitude": 0.075, "role": "long grain ribbons"}, {"id": "micro", "frequency": 64, "amplitude": 0.018, "role": "pore-level grazing highlight breakup"}], "roughness": {"base": 0.56, "variation": 0.13, "map": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut/walnut_roughness.png", "localResponse": "0.48 on handled front crest, 0.68 in underside cavities"}, "metalness": {"base": 0, "variation": 0}, "normal": {"map": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut/walnut_normal.png", "pattern": "independent longitudinal height derivative", "strength": 0.22, "scale": 32, "space": "tangent"}, "bump": {"pattern": "independent pore field", "amplitude": 0.008, "scale": 64}, "displacement": {"pattern": "none; silhouette relief is authored as geometry", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"map": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut/walnut_ao.png", "cavityStrength": 0.24, "contactShadowBias": 0.34, "notes": "Independent AO for edge underside and join contacts."}, "wear": {"edgeWear": 0.07, "scratches": [], "chips": []}, "dirt": {"amount": 0.02, "cavityBias": 0.25, "color": "#2A170C"}, "localOverrides": [{"id": "longitudinal-top-grain", "region": "top face", "direction": "+X", "albedoAmplitude": 0.16, "normalStrength": 0.22, "roughnessVariation": 0.13, "evidenceRefs": ["tabletop-main"]}, {"id": "perimeter-edge-darkening", "region": "vertical perimeter band", "dirtAmount": 0.12, "cavityBias": true, "baseColor": "#4D2D17", "roughness": 0.61, "evidenceRefs": ["tabletop-main", "tabletop-corner-inset"]}], "referencePbr": {"version": "1.0", "sourceImage": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-crops/walnut.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.784, "estimatedFidelity": 0.784, "targetThreshold": 0.7, "hardLimit": "single-image PBR extraction is an estimate; 70%+ extraction confidence still needs render screenshot review", "maps": {"albedo": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-top/walnut-top_albedo.png", "url": "walnut-top_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-top/walnut-top_roughness.png", "url": "walnut-top_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-top/walnut-top_height.png", "url": "walnut-top_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-top/walnut-top_normal.png", "url": "walnut-top_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-top/walnut-top_ao.png", "url": "walnut-top_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 1050, "sourceHeight": 165, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 1050, "height": 165}, "mask": {"backgroundColor": "#422919", "backgroundNoise": 59.338, "transparentPixelFraction": 0, "foregroundCoverage": 0.9999}, "mapStats": {"valueRange": 0.2974, "heightP90Gradient": 0.03472, "roughnessBase": 0.71, "roughnessVariation": 0.065, "normalStrength": 0.197, "blurRadius": 21}, "palette": ["#532F18", "#3E2614", "#6D3D1E", "#10120C", "#945528"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "shaderNotes": ["Do not alias albedo into other PBR channels.", "Keep extracted maps as evidence; synthesize direction-aware full-resolution procedural channels."], "notes": "Warm polished but not lacquered top; single-image evidence confidence 0.774."},
    options
  );
  materialMap["walnut-frame"] = createSculptMaterial(
    "walnut-frame",
    {"id": "walnut-frame", "name": "Vertical-grain walnut frame", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#553019", "color": "#553019", "albedo": {"dominant": "#553019", "secondary": ["#6B3A1D", "#3B2312"], "samplingNotes": "Walnut palette shifted darker for shaded apron and legs."}, "colorVariation": {"palette": ["#553019", "#6B3A1D", "#3B2312"], "pattern": "construction-axis walnut with deterministic seed 2102", "amplitude": 0.14, "heightCorrelation": 0.2}, "textureResolution": 2048, "textureProjection": {"mode": "component-axis box projection", "repeat": [2, 4], "anisotropy": 12, "texelDensityIntent": "Vertical grain on legs, horizontal grain on rails, depth grain on side rails."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.6, "amplitude": 0.14, "role": "board-to-board tonal variation"}, {"id": "meso", "frequency": 14, "amplitude": 0.07, "role": "directional grain"}, {"id": "micro", "frequency": 68, "amplitude": 0.017, "role": "fine pores"}], "roughness": {"base": 0.61, "variation": 0.14, "map": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut/walnut_roughness.png", "localResponse": "higher in joint cavities and lower on exposed bevel crests"}, "metalness": {"base": 0, "variation": 0}, "normal": {"map": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut/walnut_normal.png", "pattern": "axis-aligned independent grain", "strength": 0.24, "scale": 36, "space": "tangent"}, "bump": {"pattern": "independent pore field", "amplitude": 0.008, "scale": 68}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"map": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut/walnut_ao.png", "cavityStrength": 0.35, "contactShadowBias": 0.42, "notes": "Local joinery and reveal AO."}, "wear": {"edgeWear": 0.05, "scratches": [], "chips": []}, "dirt": {"amount": 0.04, "cavityBias": 0.55, "color": "#26150B"}, "localOverrides": [{"id": "vertical-leg-grain", "region": "four legs and front stiles", "direction": "+Y", "normalStrength": 0.24, "roughnessVariation": 0.14, "evidenceRefs": ["leg-grain"]}, {"id": "joinery-cavity-darkening", "region": "under-top reveal, apron/leg contacts, cabinet underside", "dirtAmount": 0.18, "cavityBias": true, "roughness": 0.7, "evidenceRefs": ["drawer-bank-front", "left-leg", "right-leg"]}], "referencePbr": {"version": "1.0", "sourceImage": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-crops/walnut.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.784, "estimatedFidelity": 0.784, "targetThreshold": 0.7, "hardLimit": "single-image PBR extraction is an estimate; 70%+ extraction confidence still needs render screenshot review", "maps": {"albedo": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-frame/walnut-frame_albedo.png", "url": "walnut-frame_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-frame/walnut-frame_roughness.png", "url": "walnut-frame_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-frame/walnut-frame_height.png", "url": "walnut-frame_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-frame/walnut-frame_normal.png", "url": "walnut-frame_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-frame/walnut-frame_ao.png", "url": "walnut-frame_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 1050, "sourceHeight": 165, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 1050, "height": 165}, "mask": {"backgroundColor": "#422919", "backgroundNoise": 59.338, "transparentPixelFraction": 0, "foregroundCoverage": 0.9999}, "mapStats": {"valueRange": 0.2974, "heightP90Gradient": 0.03472, "roughnessBase": 0.71, "roughnessVariation": 0.065, "normalStrength": 0.197, "blurRadius": 21}, "palette": ["#532F18", "#3E2614", "#6D3D1E", "#10120C", "#945528"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "shaderNotes": ["Rotate grain by construction axis; never stretch top mapping onto legs."], "notes": "Darker structural wood; evidence confidence 0.774."},
    options
  );
  materialMap["walnut-drawer"] = createSculptMaterial(
    "walnut-drawer",
    {"id": "walnut-drawer", "name": "Horizontal-grain walnut drawer fronts", "type": "standard", "shaderModel": "MeshStandardMaterial", "baseColor": "#5E341A", "color": "#5E341A", "albedo": {"dominant": "#5E341A", "secondary": ["#743F1F", "#482815"], "samplingNotes": "Reference walnut palette with distinct phase per drawer."}, "colorVariation": {"palette": ["#5E341A", "#743F1F", "#482815"], "pattern": "horizontal bookmatched-like flow without mirroring", "amplitude": 0.15, "heightCorrelation": 0.23}, "textureResolution": 2048, "textureProjection": {"mode": "front-planar plus box-side projection", "repeat": [2.6, 1], "anisotropy": 12, "texelDensityIntent": "Same grain scale across unequal drawer widths; phase changes per drawer."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.7, "amplitude": 0.15, "role": "broad tonal flow"}, {"id": "meso", "frequency": 15, "amplitude": 0.072, "role": "horizontal grain ribbons"}, {"id": "micro", "frequency": 66, "amplitude": 0.018, "role": "pore highlight breakup"}], "roughness": {"base": 0.59, "variation": 0.13, "map": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut/walnut_roughness.png", "localResponse": "slightly polished front bevel and rougher reveal edges"}, "metalness": {"base": 0, "variation": 0}, "normal": {"map": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut/walnut_normal.png", "pattern": "horizontal independent grain", "strength": 0.23, "scale": 36, "space": "tangent"}, "bump": {"pattern": "independent pore field", "amplitude": 0.008, "scale": 66}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"map": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut/walnut_ao.png", "cavityStrength": 0.3, "contactShadowBias": 0.4, "notes": "Perimeter reveal and knob stem contacts."}, "wear": {"edgeWear": 0.06, "scratches": [], "chips": []}, "dirt": {"amount": 0.025, "cavityBias": 0.45, "color": "#27150B"}, "localOverrides": [{"id": "horizontal-drawer-grain", "region": "all three front faces", "direction": "+X", "phaseSeeds": [3101, 3102, 3103], "normalStrength": 0.23, "roughnessVariation": 0.13, "evidenceRefs": ["drawer-bank-front"]}], "referencePbr": {"version": "1.0", "sourceImage": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-crops/walnut.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.784, "estimatedFidelity": 0.784, "targetThreshold": 0.7, "hardLimit": "single-image PBR extraction is an estimate; 70%+ extraction confidence still needs render screenshot review", "maps": {"albedo": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-drawer/walnut-drawer_albedo.png", "url": "walnut-drawer_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-drawer/walnut-drawer_roughness.png", "url": "walnut-drawer_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-drawer/walnut-drawer_height.png", "url": "walnut-drawer_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-drawer/walnut-drawer_normal.png", "url": "walnut-drawer_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/walnut-drawer/walnut-drawer_ao.png", "url": "walnut-drawer_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 1050, "sourceHeight": 165, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 1050, "height": 165}, "mask": {"backgroundColor": "#422919", "backgroundNoise": 59.338, "transparentPixelFraction": 0, "foregroundCoverage": 0.9999}, "mapStats": {"valueRange": 0.2974, "heightP90Gradient": 0.03472, "roughnessBase": 0.71, "roughnessVariation": 0.065, "normalStrength": 0.197, "blurRadius": 21}, "palette": ["#532F18", "#3E2614", "#6D3D1E", "#10120C", "#945528"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "shaderNotes": ["Use separate deterministic phases, not one stretched drawer atlas."], "notes": "Drawer-specific horizontal grain; evidence confidence 0.774."},
    options
  );
  materialMap["aged-brass"] = createSculptMaterial(
    "aged-brass",
    {"id": "aged-brass", "name": "Aged brass knob material", "type": "physical", "shaderModel": "MeshPhysicalMaterial", "baseColor": "#8F6A41", "color": "#8F6A41", "albedo": {"dominant": "#8F6A41", "secondary": ["#B48B59", "#4D4B39", "#2F3225"], "samplingNotes": "Palette from aged-brass-report.json and knob inset."}, "colorVariation": {"palette": ["#8F6A41", "#B48B59", "#4D4B39"], "pattern": "rim-biased tarnish mottle with deterministic instance seeds", "amplitude": 0.2, "heightCorrelation": 0.08}, "textureResolution": 2048, "textureProjection": {"mode": "cylindrical lathe UV", "repeat": [1, 1], "anisotropy": 8, "texelDensityIntent": "Stable across all three identical knob profiles."}, "surfaceFrequencyBands": [{"id": "macro", "frequency": 1.2, "amplitude": 0.16, "role": "crown-to-rim value gradient"}, {"id": "meso", "frequency": 10, "amplitude": 0.09, "role": "tarnish mottling"}, {"id": "micro", "frequency": 54, "amplitude": 0.02, "role": "fine oxidation highlight breakup"}], "roughness": {"base": 0.34, "variation": 0.18, "map": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/aged-brass/aged-brass_roughness.png", "localResponse": "0.18 crown highlight and 0.5 tarnished rim"}, "metalness": {"base": 0.92, "variation": 0.06}, "clearcoat": 0.12, "clearcoatRoughness": 0.2, "normal": {"map": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/aged-brass/aged-brass_normal.png", "pattern": "independent oxidation mottle", "strength": 0.16, "scale": 28, "space": "tangent"}, "bump": {"pattern": "fine patina", "amplitude": 0.003, "scale": 54}, "displacement": {"pattern": "none", "amplitude": 0, "scale": 1, "silhouetteAffects": false}, "ambientOcclusion": {"map": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/aged-brass/aged-brass_ao.png", "cavityStrength": 0.28, "contactShadowBias": 0.38, "notes": "Stem mount and crown rim cavities."}, "wear": {"edgeWear": 0.12, "scratches": [], "chips": []}, "dirt": {"amount": 0.08, "cavityBias": 0.5, "color": "#302315"}, "localOverrides": [{"id": "crown-polish-highlight", "region": "upper-left crown lobe", "roughness": 0.18, "clearcoat": 0.18, "clearcoatRoughness": 0.16, "keyLightDirection": [-0.55, -0.75, 0.35], "evidenceRefs": ["knob-inset"]}, {"id": "rim-tarnish-mottle", "region": "crown rim and lower half", "dirtAmount": 0.22, "cavityBias": true, "patinaColor": "#4D4B39", "roughness": 0.5, "evidenceRefs": ["knob-inset"]}], "referencePbr": {"version": "1.0", "sourceImage": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-crops/aged-brass.png", "extractor": "stage1_intake/extract_pbr_evidence.py", "method": "single-image pixel evidence with de-lighting estimate; not photogrammetry", "usable": true, "verdict": "pass", "confidence": 0.786, "estimatedFidelity": 0.786, "targetThreshold": 0.7, "hardLimit": "single-image PBR extraction is an estimate; 70%+ extraction confidence still needs render screenshot review", "maps": {"albedo": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/aged-brass/aged-brass_albedo.png", "url": "aged-brass_albedo.png", "channel": "albedo", "source": "reference-pixel-extraction"}, "roughness": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/aged-brass/aged-brass_roughness.png", "url": "aged-brass_roughness.png", "channel": "roughness", "source": "reference-pixel-extraction"}, "height": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/aged-brass/aged-brass_height.png", "url": "aged-brass_height.png", "channel": "height", "source": "reference-pixel-extraction"}, "normal": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/aged-brass/aged-brass_normal.png", "url": "aged-brass_normal.png", "channel": "normal", "source": "reference-pixel-extraction"}, "ao": {"path": "/home/song/dear-desk/docs/assets/model-reviews/dd-20260816-002/pbr-evidence/aged-brass/aged-brass_ao.png", "url": "aged-brass_ao.png", "channel": "ao", "source": "reference-pixel-extraction"}}, "diagnostics": {"sourceWidth": 125, "sourceHeight": 125, "mapSize": 1024, "cropBBoxPixels": {"x": 0, "y": 0, "width": 125, "height": 125}, "mask": {"backgroundColor": "#3D210F", "backgroundNoise": 8.775, "transparentPixelFraction": 0, "foregroundCoverage": 1}, "mapStats": {"valueRange": 0.3059, "heightP90Gradient": 0.02749, "roughnessBase": 0.704, "roughnessVariation": 0.05, "normalStrength": 0.188, "blurRadius": 21}, "palette": ["#492A11", "#371F0C", "#1F1104", "#6D471E", "#B0814B"]}, "warnings": ["image is not clearly isolated from background; using most pixels as material evidence", "object/background separation is weak", "single-image inverse rendering cannot prove true physical PBR; confidence is capped"]}, "shaderNotes": ["Keep metalness high through tarnish; avoid yellow dielectric plastic."], "notes": "Knob-inset evidence confidence 0.823; single-image limitation retained."},
    options
  );

  const nodes: Record<string, THREE.Object3D> = { root };
  const meshes: Record<string, THREE.Mesh> = {};
  const sockets: Record<string, THREE.Object3D> = {};
  const colliders: Record<string, unknown> = {};
  const destructionGroups: Record<string, THREE.Object3D[]> = {};

  const attachment_tabletop_slab_0 = null;
  const endpoint_tabletop_slab_0 = makeAttachmentEndpoint(attachment_tabletop_slab_0);
  const node_tabletop_slab_0 = new THREE.Group();
  node_tabletop_slab_0.name = "Profile-extruded tabletop slab and desk root__pivot";
  node_tabletop_slab_0.scale.set(1, 1, 1);
  if (endpoint_tabletop_slab_0) {
    node_tabletop_slab_0.position.copy(endpoint_tabletop_slab_0.start);
    node_tabletop_slab_0.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_tabletop_slab_0.position.set(0.0, 1.69, 0.0);
    node_tabletop_slab_0.rotation.set(0.0, 0.0, 0.0);
  }
  node_tabletop_slab_0.userData.sculptComponent = {"id": "tabletop-slab", "name": "Profile-extruded tabletop slab and desk root", "level": "macro", "role": "surface", "importance": 1, "confidence": 0.99, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "rounded-rectangle plan profile extruded through thickness; plan radius remains independent of slab height", "edgeTreatment": {"type": "rounded-bevel", "bevelRadius": 0.055, "segments": 4}, "deformationStack": ["plan-corner radius 0.16", "subtle 0.006 top-plane crown"], "uvStrategy": "planar top coordinates with grain along +X and separate perimeter projection", "normalStrategy": "weighted vertex normals plus independent tangent-space walnut normal"}, "parent": null, "attachment": null, "dimensions": {"width": 3.6, "height": 0.18, "depth": 1.34, "units": "relative", "confidence": 0.96}, "transform": {"position": [0, 1.69, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root-static-surface", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.99}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "front-apron-contact", "localPosition": [0, -0.18, 0.52], "localRotation": [0, 0, 0]}, {"id": "rear-apron-contact", "localPosition": [0, -0.18, -0.52], "localRotation": [0, 0, 0]}, {"id": "left-front-leg-contact", "localPosition": [-1.55, -0.34, 0.49], "localRotation": [0, 0, 0]}, {"id": "right-front-leg-contact", "localPosition": [1.55, -0.34, 0.49], "localRotation": [0, 0, 0]}, {"id": "left-rear-leg-contact", "localPosition": [-1.55, -0.34, -0.49], "localRotation": [0, 0, 0]}, {"id": "right-rear-leg-contact", "localPosition": [1.55, -0.34, -0.49], "localRotation": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.6, 0.18, 1.34], "isTrigger": false, "notes": "Rounded slab broad-phase proxy; visible bevel remains render geometry only."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tabletop", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "walnut-top"}}, "material": "walnut-top", "materialLayers": ["walnut-top"], "deformations": ["0.006 broad top-plane crown"], "joints": [], "seams": ["tabletop-to-carcass-reveal"], "localFeatures": [{"id": "tabletop-plan-corner-radius", "type": "plan-profile-radius", "radius": 0.16, "segments": 10, "notes": "Independent of slab thickness; authoritative corner-inset feature."}, {"id": "tabletop-perimeter-bevel", "type": "rounded-bevel", "bevelRadius": 0.055, "segments": 4, "notes": "Broad grazing highlight without pill-shaped slab."}, {"id": "top-surface-crown", "type": "local-deformation", "amplitude": 0.006, "falloff": "broad-center", "notes": "Subtle only."}], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.2, "bumpAmplitude": 0.008, "normalPattern": "longitudinal walnut fibers along +X", "displacementPattern": "", "occlusionPattern": "underside perimeter and carcass contacts", "edgeWearPattern": "slightly polished front bevel crest", "notes": "Extracted PBR is single-image reference evidence; procedural orientation remains component-aware."}, "evidenceRefs": ["full-object", "tabletop-main", "tabletop-corner-inset"], "details": ["broad plan radius", "soft edge roll", "horizontal grain", "darker edge band"], "fidelityTier": "hero", "topologyClass": "assembled-solid", "topologyRationale": "A discrete rigid furniture part with countable planar or simply rounded faces; rounded extrusion/box-family geometry matches the visible construction.", "colorMaterialRecipe": {"dominantAlbedo": "rgba(100, 56, 28, 1.0)", "secondaryAlbedo": "rgba(77, 45, 23, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.96, "evidenceRefs": ["tabletop-main", "drawer-bank-front", "leg-grain"]}};
  node_tabletop_slab_0.userData.actionProfile = {"animationRole": "root-static-surface", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.99}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "front-apron-contact", "localPosition": [0, -0.18, 0.52], "localRotation": [0, 0, 0]}, {"id": "rear-apron-contact", "localPosition": [0, -0.18, -0.52], "localRotation": [0, 0, 0]}, {"id": "left-front-leg-contact", "localPosition": [-1.55, -0.34, 0.49], "localRotation": [0, 0, 0]}, {"id": "right-front-leg-contact", "localPosition": [1.55, -0.34, 0.49], "localRotation": [0, 0, 0]}, {"id": "left-rear-leg-contact", "localPosition": [-1.55, -0.34, -0.49], "localRotation": [0, 0, 0]}, {"id": "right-rear-leg-contact", "localPosition": [1.55, -0.34, -0.49], "localRotation": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.6, 0.18, 1.34], "isTrigger": false, "notes": "Rounded slab broad-phase proxy; visible bevel remains render geometry only."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tabletop", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "walnut-top"}};
  (nodes["root"] ?? root).add(node_tabletop_slab_0);
  nodes["tabletop-slab"] = node_tabletop_slab_0;
  const mesh_tabletop_slab_0Geometry = endpoint_tabletop_slab_0
    ? new THREE.CylinderGeometry(endpoint_tabletop_slab_0.endRadius, endpoint_tabletop_slab_0.baseRadius, endpoint_tabletop_slab_0.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  if (!endpoint_tabletop_slab_0) {
    mesh_tabletop_slab_0Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_tabletop_slab_0 = new THREE.Mesh(
    mesh_tabletop_slab_0Geometry,
    materialMap["walnut-top"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_tabletop_slab_0.name = "Profile-extruded tabletop slab and desk root";
  if (endpoint_tabletop_slab_0) {
    mesh_tabletop_slab_0.position.copy(endpoint_tabletop_slab_0.midpoint);
    mesh_tabletop_slab_0.quaternion.copy(endpoint_tabletop_slab_0.quaternion);
  }
  mesh_tabletop_slab_0.castShadow = options.castShadow ?? true;
  mesh_tabletop_slab_0.receiveShadow = options.receiveShadow ?? true;
  mesh_tabletop_slab_0.userData.sculptComponent = {"id": "tabletop-slab", "name": "Profile-extruded tabletop slab and desk root", "level": "macro", "role": "surface", "importance": 1, "confidence": 0.99, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "rounded-rectangle plan profile extruded through thickness; plan radius remains independent of slab height", "edgeTreatment": {"type": "rounded-bevel", "bevelRadius": 0.055, "segments": 4}, "deformationStack": ["plan-corner radius 0.16", "subtle 0.006 top-plane crown"], "uvStrategy": "planar top coordinates with grain along +X and separate perimeter projection", "normalStrategy": "weighted vertex normals plus independent tangent-space walnut normal"}, "parent": null, "attachment": null, "dimensions": {"width": 3.6, "height": 0.18, "depth": 1.34, "units": "relative", "confidence": 0.96}, "transform": {"position": [0, 1.69, 0], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "root-static-surface", "pivot": {"mode": "center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.99}, "transformChannels": {"translate": true, "rotate": true, "scale": true, "bend": false, "twist": false, "detach": false, "visibility": true, "materialState": true}, "sockets": [{"id": "front-apron-contact", "localPosition": [0, -0.18, 0.52], "localRotation": [0, 0, 0]}, {"id": "rear-apron-contact", "localPosition": [0, -0.18, -0.52], "localRotation": [0, 0, 0]}, {"id": "left-front-leg-contact", "localPosition": [-1.55, -0.34, 0.49], "localRotation": [0, 0, 0]}, {"id": "right-front-leg-contact", "localPosition": [1.55, -0.34, 0.49], "localRotation": [0, 0, 0]}, {"id": "left-rear-leg-contact", "localPosition": [-1.55, -0.34, -0.49], "localRotation": [0, 0, 0]}, {"id": "right-rear-leg-contact", "localPosition": [1.55, -0.34, -0.49], "localRotation": [0, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, 0], "scale": [3.6, 0.18, 1.34], "isTrigger": false, "notes": "Rounded slab broad-phase proxy; visible bevel remains render geometry only."}, "constraints": [], "destruction": {"breakable": false, "fractureGroup": "tabletop", "seamRefs": [], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "walnut-top"}}, "material": "walnut-top", "materialLayers": ["walnut-top"], "deformations": ["0.006 broad top-plane crown"], "joints": [], "seams": ["tabletop-to-carcass-reveal"], "localFeatures": [{"id": "tabletop-plan-corner-radius", "type": "plan-profile-radius", "radius": 0.16, "segments": 10, "notes": "Independent of slab thickness; authoritative corner-inset feature."}, {"id": "tabletop-perimeter-bevel", "type": "rounded-bevel", "bevelRadius": 0.055, "segments": 4, "notes": "Broad grazing highlight without pill-shaped slab."}, {"id": "top-surface-crown", "type": "local-deformation", "amplitude": 0.006, "falloff": "broad-center", "notes": "Subtle only."}], "surfaceDetail": {"macroRoughness": 0.12, "microRoughness": 0.2, "bumpAmplitude": 0.008, "normalPattern": "longitudinal walnut fibers along +X", "displacementPattern": "", "occlusionPattern": "underside perimeter and carcass contacts", "edgeWearPattern": "slightly polished front bevel crest", "notes": "Extracted PBR is single-image reference evidence; procedural orientation remains component-aware."}, "evidenceRefs": ["full-object", "tabletop-main", "tabletop-corner-inset"], "details": ["broad plan radius", "soft edge roll", "horizontal grain", "darker edge band"], "fidelityTier": "hero", "topologyClass": "assembled-solid", "topologyRationale": "A discrete rigid furniture part with countable planar or simply rounded faces; rounded extrusion/box-family geometry matches the visible construction.", "colorMaterialRecipe": {"dominantAlbedo": "rgba(100, 56, 28, 1.0)", "secondaryAlbedo": "rgba(77, 45, 23, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.96, "evidenceRefs": ["tabletop-main", "drawer-bank-front", "leg-grain"]}};
  node_tabletop_slab_0.add(mesh_tabletop_slab_0);
  meshes["tabletop-slab"] = mesh_tabletop_slab_0;
  colliders["tabletop-slab"] = {"type": "box", "offset": [0, 0, 0], "scale": [3.6, 0.18, 1.34], "isTrigger": false, "notes": "Rounded slab broad-phase proxy; visible bevel remains render geometry only."};
  destructionGroups["tabletop"] ??= [];
  destructionGroups["tabletop"].push(node_tabletop_slab_0);
  const socket_tabletop_slab_front_apron_contact_0 = new THREE.Object3D();
  socket_tabletop_slab_front_apron_contact_0.name = "front-apron-contact";
  socket_tabletop_slab_front_apron_contact_0.position.set(0.0, -0.18, 0.52);
  socket_tabletop_slab_front_apron_contact_0.rotation.set(0.0, 0.0, 0.0);
  socket_tabletop_slab_front_apron_contact_0.userData.socket = {"id": "front-apron-contact", "localPosition": [0, -0.18, 0.52], "localRotation": [0, 0, 0]};
  node_tabletop_slab_0.add(socket_tabletop_slab_front_apron_contact_0);
  sockets["tabletop-slab:front-apron-contact"] = socket_tabletop_slab_front_apron_contact_0;
  const socket_tabletop_slab_rear_apron_contact_1 = new THREE.Object3D();
  socket_tabletop_slab_rear_apron_contact_1.name = "rear-apron-contact";
  socket_tabletop_slab_rear_apron_contact_1.position.set(0.0, -0.18, -0.52);
  socket_tabletop_slab_rear_apron_contact_1.rotation.set(0.0, 0.0, 0.0);
  socket_tabletop_slab_rear_apron_contact_1.userData.socket = {"id": "rear-apron-contact", "localPosition": [0, -0.18, -0.52], "localRotation": [0, 0, 0]};
  node_tabletop_slab_0.add(socket_tabletop_slab_rear_apron_contact_1);
  sockets["tabletop-slab:rear-apron-contact"] = socket_tabletop_slab_rear_apron_contact_1;
  const socket_tabletop_slab_left_front_leg_contact_2 = new THREE.Object3D();
  socket_tabletop_slab_left_front_leg_contact_2.name = "left-front-leg-contact";
  socket_tabletop_slab_left_front_leg_contact_2.position.set(-1.55, -0.34, 0.49);
  socket_tabletop_slab_left_front_leg_contact_2.rotation.set(0.0, 0.0, 0.0);
  socket_tabletop_slab_left_front_leg_contact_2.userData.socket = {"id": "left-front-leg-contact", "localPosition": [-1.55, -0.34, 0.49], "localRotation": [0, 0, 0]};
  node_tabletop_slab_0.add(socket_tabletop_slab_left_front_leg_contact_2);
  sockets["tabletop-slab:left-front-leg-contact"] = socket_tabletop_slab_left_front_leg_contact_2;
  const socket_tabletop_slab_right_front_leg_contact_3 = new THREE.Object3D();
  socket_tabletop_slab_right_front_leg_contact_3.name = "right-front-leg-contact";
  socket_tabletop_slab_right_front_leg_contact_3.position.set(1.55, -0.34, 0.49);
  socket_tabletop_slab_right_front_leg_contact_3.rotation.set(0.0, 0.0, 0.0);
  socket_tabletop_slab_right_front_leg_contact_3.userData.socket = {"id": "right-front-leg-contact", "localPosition": [1.55, -0.34, 0.49], "localRotation": [0, 0, 0]};
  node_tabletop_slab_0.add(socket_tabletop_slab_right_front_leg_contact_3);
  sockets["tabletop-slab:right-front-leg-contact"] = socket_tabletop_slab_right_front_leg_contact_3;
  const socket_tabletop_slab_left_rear_leg_contact_4 = new THREE.Object3D();
  socket_tabletop_slab_left_rear_leg_contact_4.name = "left-rear-leg-contact";
  socket_tabletop_slab_left_rear_leg_contact_4.position.set(-1.55, -0.34, -0.49);
  socket_tabletop_slab_left_rear_leg_contact_4.rotation.set(0.0, 0.0, 0.0);
  socket_tabletop_slab_left_rear_leg_contact_4.userData.socket = {"id": "left-rear-leg-contact", "localPosition": [-1.55, -0.34, -0.49], "localRotation": [0, 0, 0]};
  node_tabletop_slab_0.add(socket_tabletop_slab_left_rear_leg_contact_4);
  sockets["tabletop-slab:left-rear-leg-contact"] = socket_tabletop_slab_left_rear_leg_contact_4;
  const socket_tabletop_slab_right_rear_leg_contact_5 = new THREE.Object3D();
  socket_tabletop_slab_right_rear_leg_contact_5.name = "right-rear-leg-contact";
  socket_tabletop_slab_right_rear_leg_contact_5.position.set(1.55, -0.34, -0.49);
  socket_tabletop_slab_right_rear_leg_contact_5.rotation.set(0.0, 0.0, 0.0);
  socket_tabletop_slab_right_rear_leg_contact_5.userData.socket = {"id": "right-rear-leg-contact", "localPosition": [1.55, -0.34, -0.49], "localRotation": [0, 0, 0]};
  node_tabletop_slab_0.add(socket_tabletop_slab_right_rear_leg_contact_5);
  sockets["tabletop-slab:right-rear-leg-contact"] = socket_tabletop_slab_right_rear_leg_contact_5;

  const attachment_front_apron_1 = null;
  const endpoint_front_apron_1 = makeAttachmentEndpoint(attachment_front_apron_1);
  const node_front_apron_1 = new THREE.Group();
  node_front_apron_1.name = "Front drawer apron and rail__pivot";
  node_front_apron_1.scale.set(1, 1, 1);
  if (endpoint_front_apron_1) {
    node_front_apron_1.position.copy(endpoint_front_apron_1.start);
    node_front_apron_1.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_front_apron_1.position.set(0.0, -0.25, 0.54);
    node_front_apron_1.rotation.set(0.0, 0.0, 0.0);
  }
  node_front_apron_1.userData.sculptComponent = {"id": "front-apron", "name": "Front drawer apron and rail", "level": "macro", "role": "panel", "importance": 1, "confidence": 0.97, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "shallow front rail with three real drawer openings and softly beveled lower edge", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.02, "segments": 3}, "deformationStack": [], "uvStrategy": "planar front projection with grain along +X", "normalStrategy": "weighted normals plus directional walnut normal"}, "parent": "tabletop-slab", "attachment": null, "dimensions": {"width": 3.24, "height": 0.34, "depth": 0.14, "units": "relative", "confidence": 0.95}, "transform": {"position": [0, -0.25, 0.54], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-panel", "pivot": {"mode": "component-center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.97}, "sockets": [{"id": "drawer-left-slide", "localPosition": [-1.2, 0, 0.07], "localRotation": [0, 0, 0]}, {"id": "drawer-center-slide", "localPosition": [0, 0, 0.07], "localRotation": [0, 0, 0]}, {"id": "drawer-right-slide", "localPosition": [1.2, 0, 0.07], "localRotation": [0, 0, 0]}], "collider": {"type": "box-frame", "offset": [0, 0, 0], "scale": [3.24, 0.34, 0.14], "isTrigger": false, "notes": "Use rail/stile compound proxies; do not block drawer travel."}, "destruction": {"breakable": false, "fractureGroup": "carcass", "seamRefs": ["tabletop-to-carcass-reveal", "drawer-reveals"], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "walnut-frame"}}, "material": "walnut-frame", "materialLayers": ["walnut-frame"], "deformations": [], "joints": [], "seams": ["tabletop-to-carcass-reveal", "drawer-reveals"], "localFeatures": [{"id": "top-shadow-reveal", "type": "recessed-seam", "width": 0.015, "depth": 0.012, "aoStrength": 0.48, "notes": "Continuous dark reveal below tabletop."}, {"id": "apron-soft-lower-edge", "type": "rounded-bevel", "bevelRadius": 0.02, "segments": 3, "notes": "Keeps the lower rail from reading as a sharp box."}], "surfaceDetail": {"macroRoughness": 0.13, "microRoughness": 0.22, "bumpAmplitude": 0.007, "normalPattern": "horizontal frame grain", "displacementPattern": "none", "occlusionPattern": "under-top reveal and drawer cavities", "edgeWearPattern": "restrained rail crest polish", "notes": "Maintain dark separation without black outlines."}, "evidenceRefs": ["primary-three-quarter", "drawer-bank-front"], "details": ["continuous upper reveal", "three openings", "soft lower edge"], "fidelityTier": "hero", "topologyClass": "assembled-solid", "topologyRationale": "A discrete rigid furniture part with countable planar or simply rounded faces; rounded extrusion/box-family geometry matches the visible construction.", "colorMaterialRecipe": {"dominantAlbedo": "rgba(85, 48, 25, 1.0)", "secondaryAlbedo": "rgba(59, 35, 18, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.96, "evidenceRefs": ["tabletop-main", "drawer-bank-front", "leg-grain"]}};
  node_front_apron_1.userData.actionProfile = {"animationRole": "static-panel", "pivot": {"mode": "component-center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.97}, "sockets": [{"id": "drawer-left-slide", "localPosition": [-1.2, 0, 0.07], "localRotation": [0, 0, 0]}, {"id": "drawer-center-slide", "localPosition": [0, 0, 0.07], "localRotation": [0, 0, 0]}, {"id": "drawer-right-slide", "localPosition": [1.2, 0, 0.07], "localRotation": [0, 0, 0]}], "collider": {"type": "box-frame", "offset": [0, 0, 0], "scale": [3.24, 0.34, 0.14], "isTrigger": false, "notes": "Use rail/stile compound proxies; do not block drawer travel."}, "destruction": {"breakable": false, "fractureGroup": "carcass", "seamRefs": ["tabletop-to-carcass-reveal", "drawer-reveals"], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "walnut-frame"}};
  (nodes["tabletop-slab"] ?? root).add(node_front_apron_1);
  nodes["front-apron"] = node_front_apron_1;
  const mesh_front_apron_1Geometry = endpoint_front_apron_1
    ? new THREE.CylinderGeometry(endpoint_front_apron_1.endRadius, endpoint_front_apron_1.baseRadius, endpoint_front_apron_1.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  if (!endpoint_front_apron_1) {
    mesh_front_apron_1Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_front_apron_1 = new THREE.Mesh(
    mesh_front_apron_1Geometry,
    materialMap["walnut-frame"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_front_apron_1.name = "Front drawer apron and rail";
  if (endpoint_front_apron_1) {
    mesh_front_apron_1.position.copy(endpoint_front_apron_1.midpoint);
    mesh_front_apron_1.quaternion.copy(endpoint_front_apron_1.quaternion);
  }
  mesh_front_apron_1.castShadow = options.castShadow ?? true;
  mesh_front_apron_1.receiveShadow = options.receiveShadow ?? true;
  mesh_front_apron_1.userData.sculptComponent = {"id": "front-apron", "name": "Front drawer apron and rail", "level": "macro", "role": "panel", "importance": 1, "confidence": 0.97, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "shallow front rail with three real drawer openings and softly beveled lower edge", "edgeTreatment": {"type": "chamfer", "bevelRadius": 0.02, "segments": 3}, "deformationStack": [], "uvStrategy": "planar front projection with grain along +X", "normalStrategy": "weighted normals plus directional walnut normal"}, "parent": "tabletop-slab", "attachment": null, "dimensions": {"width": 3.24, "height": 0.34, "depth": 0.14, "units": "relative", "confidence": 0.95}, "transform": {"position": [0, -0.25, 0.54], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "static-panel", "pivot": {"mode": "component-center", "localPosition": [0, 0, 0], "axis": [0, 1, 0], "confidence": 0.97}, "sockets": [{"id": "drawer-left-slide", "localPosition": [-1.2, 0, 0.07], "localRotation": [0, 0, 0]}, {"id": "drawer-center-slide", "localPosition": [0, 0, 0.07], "localRotation": [0, 0, 0]}, {"id": "drawer-right-slide", "localPosition": [1.2, 0, 0.07], "localRotation": [0, 0, 0]}], "collider": {"type": "box-frame", "offset": [0, 0, 0], "scale": [3.24, 0.34, 0.14], "isTrigger": false, "notes": "Use rail/stile compound proxies; do not block drawer travel."}, "destruction": {"breakable": false, "fractureGroup": "carcass", "seamRefs": ["tabletop-to-carcass-reveal", "drawer-reveals"], "detachableFragments": [], "breakImpulse": 0, "debrisMaterial": "walnut-frame"}}, "material": "walnut-frame", "materialLayers": ["walnut-frame"], "deformations": [], "joints": [], "seams": ["tabletop-to-carcass-reveal", "drawer-reveals"], "localFeatures": [{"id": "top-shadow-reveal", "type": "recessed-seam", "width": 0.015, "depth": 0.012, "aoStrength": 0.48, "notes": "Continuous dark reveal below tabletop."}, {"id": "apron-soft-lower-edge", "type": "rounded-bevel", "bevelRadius": 0.02, "segments": 3, "notes": "Keeps the lower rail from reading as a sharp box."}], "surfaceDetail": {"macroRoughness": 0.13, "microRoughness": 0.22, "bumpAmplitude": 0.007, "normalPattern": "horizontal frame grain", "displacementPattern": "none", "occlusionPattern": "under-top reveal and drawer cavities", "edgeWearPattern": "restrained rail crest polish", "notes": "Maintain dark separation without black outlines."}, "evidenceRefs": ["primary-three-quarter", "drawer-bank-front"], "details": ["continuous upper reveal", "three openings", "soft lower edge"], "fidelityTier": "hero", "topologyClass": "assembled-solid", "topologyRationale": "A discrete rigid furniture part with countable planar or simply rounded faces; rounded extrusion/box-family geometry matches the visible construction.", "colorMaterialRecipe": {"dominantAlbedo": "rgba(85, 48, 25, 1.0)", "secondaryAlbedo": "rgba(59, 35, 18, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.96, "evidenceRefs": ["tabletop-main", "drawer-bank-front", "leg-grain"]}};
  node_front_apron_1.add(mesh_front_apron_1);
  meshes["front-apron"] = mesh_front_apron_1;
  colliders["front-apron"] = {"type": "box-frame", "offset": [0, 0, 0], "scale": [3.24, 0.34, 0.14], "isTrigger": false, "notes": "Use rail/stile compound proxies; do not block drawer travel."};
  destructionGroups["carcass"] ??= [];
  destructionGroups["carcass"].push(node_front_apron_1);
  const socket_front_apron_drawer_left_slide_0 = new THREE.Object3D();
  socket_front_apron_drawer_left_slide_0.name = "drawer-left-slide";
  socket_front_apron_drawer_left_slide_0.position.set(-1.2, 0.0, 0.07);
  socket_front_apron_drawer_left_slide_0.rotation.set(0.0, 0.0, 0.0);
  socket_front_apron_drawer_left_slide_0.userData.socket = {"id": "drawer-left-slide", "localPosition": [-1.2, 0, 0.07], "localRotation": [0, 0, 0]};
  node_front_apron_1.add(socket_front_apron_drawer_left_slide_0);
  sockets["front-apron:drawer-left-slide"] = socket_front_apron_drawer_left_slide_0;
  const socket_front_apron_drawer_center_slide_1 = new THREE.Object3D();
  socket_front_apron_drawer_center_slide_1.name = "drawer-center-slide";
  socket_front_apron_drawer_center_slide_1.position.set(0.0, 0.0, 0.07);
  socket_front_apron_drawer_center_slide_1.rotation.set(0.0, 0.0, 0.0);
  socket_front_apron_drawer_center_slide_1.userData.socket = {"id": "drawer-center-slide", "localPosition": [0, 0, 0.07], "localRotation": [0, 0, 0]};
  node_front_apron_1.add(socket_front_apron_drawer_center_slide_1);
  sockets["front-apron:drawer-center-slide"] = socket_front_apron_drawer_center_slide_1;
  const socket_front_apron_drawer_right_slide_2 = new THREE.Object3D();
  socket_front_apron_drawer_right_slide_2.name = "drawer-right-slide";
  socket_front_apron_drawer_right_slide_2.position.set(1.2, 0.0, 0.07);
  socket_front_apron_drawer_right_slide_2.rotation.set(0.0, 0.0, 0.0);
  socket_front_apron_drawer_right_slide_2.userData.socket = {"id": "drawer-right-slide", "localPosition": [1.2, 0, 0.07], "localRotation": [0, 0, 0]};
  node_front_apron_1.add(socket_front_apron_drawer_right_slide_2);
  sockets["front-apron:drawer-right-slide"] = socket_front_apron_drawer_right_slide_2;

  const attachment_drawer_bank_2 = {"parentId": "front-apron", "parentSocket": "drawer-center-slide", "localStart": [0, 0, 0], "localEnd": [0, 0, 0.3], "contactType": "linear drawer slide", "overlap": 0.3, "gapTolerance": 0.006, "contactNormal": [0, 0, 1], "evidenceRefs": ["drawer-bank-front"]};
  const endpoint_drawer_bank_2 = makeAttachmentEndpoint(attachment_drawer_bank_2);
  const node_drawer_bank_2 = new THREE.Group();
  node_drawer_bank_2.name = "Wide center drawer and layout anchor__pivot";
  node_drawer_bank_2.scale.set(1, 1, 1);
  if (endpoint_drawer_bank_2) {
    node_drawer_bank_2.position.copy(endpoint_drawer_bank_2.start);
    node_drawer_bank_2.rotation.set(0.0, 0.0, 0.0);
  } else {
    node_drawer_bank_2.position.set(0.0, 0.0, 0.08);
    node_drawer_bank_2.rotation.set(0.0, 0.0, 0.0);
  }
  node_drawer_bank_2.userData.sculptComponent = {"id": "drawer-bank", "name": "Wide center drawer and layout anchor", "level": "macro", "role": "moving-panel", "importance": 1, "confidence": 0.99, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "rounded-rectangle front plus shallow box extending into -Z", "edgeTreatment": {"type": "rounded-bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["subtle 0.012 outward bow on lower front edge"], "uvStrategy": "front planar grain +X; box sides construction-aligned", "normalStrategy": "weighted normals plus horizontal walnut normal"}, "parent": "front-apron", "attachment": {"parentId": "front-apron", "parentSocket": "drawer-center-slide", "localStart": [0, 0, 0], "localEnd": [0, 0, 0.3], "contactType": "linear drawer slide", "overlap": 0.3, "gapTolerance": 0.006, "contactNormal": [0, 0, 1], "evidenceRefs": ["drawer-bank-front"]}, "dimensions": {"width": 1.52, "height": 0.25, "depth": 0.42, "units": "relative", "confidence": 0.98}, "transform": {"position": [0, 0, 0.08], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "linear-slide", "pivot": {"mode": "closed-center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.99}, "sockets": [{"id": "center-knob-mount", "localPosition": [0, 0, 0.27], "localRotation": [1.5708, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, -0.14], "scale": [1.52, 0.25, 0.42], "isTrigger": false, "notes": "Moves with drawer pivot."}, "constraints": [{"type": "linear-limit", "axis": [0, 0, 1], "min": 0, "max": 0.3}], "destruction": {"breakable": false, "fractureGroup": "drawers", "seamRefs": ["drawer-reveals"], "detachableFragments": ["knob-assemblies"], "breakImpulse": 0, "debrisMaterial": "walnut-drawer"}}, "material": "walnut-drawer", "materialLayers": ["walnut-drawer"], "deformations": ["lower-edge bow 0.012"], "joints": ["center linear slide"], "seams": ["drawer-reveals"], "localFeatures": [{"id": "wide-center-narrow-side-layout", "type": "proportion-system", "ratio": [1, 2.15, 1], "gap": 0.035, "notes": "Center remains 2.15x each side front."}, {"id": "drawer-front-soft-bevel", "type": "edge-treatment", "cornerRadius": 0.035, "bevelRadius": 0.018, "segments": 3}, {"id": "drawer-perimeter-recess", "type": "recessed-groove", "width": 0.012, "depth": 0.018, "aoStrength": 0.42, "notes": "True geometry and AO, not painted line."}], "surfaceDetail": {"macroRoughness": 0.13, "microRoughness": 0.22, "bumpAmplitude": 0.008, "normalPattern": "horizontal walnut", "displacementPattern": "none", "occlusionPattern": "perimeter reveal", "edgeWearPattern": "subtle front crest", "notes": "Grain phase distinct from side drawers."}, "evidenceRefs": ["drawer-bank-front"], "details": ["wide center proportion", "rounded front", "lower bow", "centered knob"], "fidelityTier": "hero", "topologyClass": "assembled-solid", "topologyRationale": "A discrete rigid furniture part with countable planar or simply rounded faces; rounded extrusion/box-family geometry matches the visible construction.", "colorMaterialRecipe": {"dominantAlbedo": "rgba(94, 52, 26, 1.0)", "secondaryAlbedo": "rgba(72, 40, 21, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.96, "evidenceRefs": ["tabletop-main", "drawer-bank-front", "leg-grain"]}};
  node_drawer_bank_2.userData.actionProfile = {"animationRole": "linear-slide", "pivot": {"mode": "closed-center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.99}, "sockets": [{"id": "center-knob-mount", "localPosition": [0, 0, 0.27], "localRotation": [1.5708, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, -0.14], "scale": [1.52, 0.25, 0.42], "isTrigger": false, "notes": "Moves with drawer pivot."}, "constraints": [{"type": "linear-limit", "axis": [0, 0, 1], "min": 0, "max": 0.3}], "destruction": {"breakable": false, "fractureGroup": "drawers", "seamRefs": ["drawer-reveals"], "detachableFragments": ["knob-assemblies"], "breakImpulse": 0, "debrisMaterial": "walnut-drawer"}};
  (nodes["front-apron"] ?? root).add(node_drawer_bank_2);
  nodes["drawer-bank"] = node_drawer_bank_2;
  const mesh_drawer_bank_2Geometry = endpoint_drawer_bank_2
    ? new THREE.CylinderGeometry(endpoint_drawer_bank_2.endRadius, endpoint_drawer_bank_2.baseRadius, endpoint_drawer_bank_2.length, 32, 12)
    : buildExtrudeGeometry({"points": [[-0.3, -0.3], [0.3, -0.3], [0.3, 0.3], [-0.3, 0.3]], "depth": 0.1});
  if (!endpoint_drawer_bank_2) {
    mesh_drawer_bank_2Geometry.scale(1.0, 1.0, 1.0);
  }
  const mesh_drawer_bank_2 = new THREE.Mesh(
    mesh_drawer_bank_2Geometry,
    materialMap["walnut-drawer"] ?? new THREE.MeshStandardMaterial({ color: 0x888888 })
  );
  mesh_drawer_bank_2.name = "Wide center drawer and layout anchor";
  if (endpoint_drawer_bank_2) {
    mesh_drawer_bank_2.position.copy(endpoint_drawer_bank_2.midpoint);
    mesh_drawer_bank_2.quaternion.copy(endpoint_drawer_bank_2.quaternion);
  }
  mesh_drawer_bank_2.castShadow = options.castShadow ?? true;
  mesh_drawer_bank_2.receiveShadow = options.receiveShadow ?? true;
  mesh_drawer_bank_2.userData.sculptComponent = {"id": "drawer-bank", "name": "Wide center drawer and layout anchor", "level": "macro", "role": "moving-panel", "importance": 1, "confidence": 0.99, "primitive": "extrude", "geometryDescriptor": {"topologyIntent": "rounded-rectangle front plus shallow box extending into -Z", "edgeTreatment": {"type": "rounded-bevel", "bevelRadius": 0.018, "segments": 3}, "deformationStack": ["subtle 0.012 outward bow on lower front edge"], "uvStrategy": "front planar grain +X; box sides construction-aligned", "normalStrategy": "weighted normals plus horizontal walnut normal"}, "parent": "front-apron", "attachment": {"parentId": "front-apron", "parentSocket": "drawer-center-slide", "localStart": [0, 0, 0], "localEnd": [0, 0, 0.3], "contactType": "linear drawer slide", "overlap": 0.3, "gapTolerance": 0.006, "contactNormal": [0, 0, 1], "evidenceRefs": ["drawer-bank-front"]}, "dimensions": {"width": 1.52, "height": 0.25, "depth": 0.42, "units": "relative", "confidence": 0.98}, "transform": {"position": [0, 0, 0.08], "rotation": [0, 0, 0], "scale": [1, 1, 1]}, "actionProfile": {"animationRole": "linear-slide", "pivot": {"mode": "closed-center", "localPosition": [0, 0, 0], "axis": [0, 0, 1], "confidence": 0.99}, "sockets": [{"id": "center-knob-mount", "localPosition": [0, 0, 0.27], "localRotation": [1.5708, 0, 0]}], "collider": {"type": "box", "offset": [0, 0, -0.14], "scale": [1.52, 0.25, 0.42], "isTrigger": false, "notes": "Moves with drawer pivot."}, "constraints": [{"type": "linear-limit", "axis": [0, 0, 1], "min": 0, "max": 0.3}], "destruction": {"breakable": false, "fractureGroup": "drawers", "seamRefs": ["drawer-reveals"], "detachableFragments": ["knob-assemblies"], "breakImpulse": 0, "debrisMaterial": "walnut-drawer"}}, "material": "walnut-drawer", "materialLayers": ["walnut-drawer"], "deformations": ["lower-edge bow 0.012"], "joints": ["center linear slide"], "seams": ["drawer-reveals"], "localFeatures": [{"id": "wide-center-narrow-side-layout", "type": "proportion-system", "ratio": [1, 2.15, 1], "gap": 0.035, "notes": "Center remains 2.15x each side front."}, {"id": "drawer-front-soft-bevel", "type": "edge-treatment", "cornerRadius": 0.035, "bevelRadius": 0.018, "segments": 3}, {"id": "drawer-perimeter-recess", "type": "recessed-groove", "width": 0.012, "depth": 0.018, "aoStrength": 0.42, "notes": "True geometry and AO, not painted line."}], "surfaceDetail": {"macroRoughness": 0.13, "microRoughness": 0.22, "bumpAmplitude": 0.008, "normalPattern": "horizontal walnut", "displacementPattern": "none", "occlusionPattern": "perimeter reveal", "edgeWearPattern": "subtle front crest", "notes": "Grain phase distinct from side drawers."}, "evidenceRefs": ["drawer-bank-front"], "details": ["wide center proportion", "rounded front", "lower bow", "centered knob"], "fidelityTier": "hero", "topologyClass": "assembled-solid", "topologyRationale": "A discrete rigid furniture part with countable planar or simply rounded faces; rounded extrusion/box-family geometry matches the visible construction.", "colorMaterialRecipe": {"dominantAlbedo": "rgba(94, 52, 26, 1.0)", "secondaryAlbedo": "rgba(72, 40, 21, 1.0)", "materialClass": "wood", "materialClassConfidence": 0.96, "evidenceRefs": ["tabletop-main", "drawer-bank-front", "leg-grain"]}};
  node_drawer_bank_2.add(mesh_drawer_bank_2);
  meshes["drawer-bank"] = mesh_drawer_bank_2;
  colliders["drawer-bank"] = {"type": "box", "offset": [0, 0, -0.14], "scale": [1.52, 0.25, 0.42], "isTrigger": false, "notes": "Moves with drawer pivot."};
  destructionGroups["drawers"] ??= [];
  destructionGroups["drawers"].push(node_drawer_bank_2);
  const socket_drawer_bank_center_knob_mount_0 = new THREE.Object3D();
  socket_drawer_bank_center_knob_mount_0.name = "center-knob-mount";
  socket_drawer_bank_center_knob_mount_0.position.set(0.0, 0.0, 0.27);
  socket_drawer_bank_center_knob_mount_0.rotation.set(1.5708, 0.0, 0.0);
  socket_drawer_bank_center_knob_mount_0.userData.socket = {"id": "center-knob-mount", "localPosition": [0, 0, 0.27], "localRotation": [1.5708, 0, 0]};
  node_drawer_bank_2.add(socket_drawer_bank_center_knob_mount_0);
  sockets["drawer-bank:center-knob-mount"] = socket_drawer_bank_center_knob_mount_0;

  root.userData.sculptRuntime = { nodes, meshes, sockets, colliders, destructionGroups } satisfies ProceduralModelRuntime;
  root.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  root.userData.actionReadiness = {
    note: 'Use root.userData.sculptRuntime.nodes for transforms, sockets for attachments, colliders for physics proxies, and destructionGroups for breakable sets.',
  };
  return root;
}

export function createWarmPaperAtelierDeskLookDevLights(
  mode: 'neutral' | 'grazing' | 'reference' = 'neutral',
): THREE.Group {
  const lights = new THREE.Group();
  lights.name = "Warm Paper Atelier Desk look-dev lights";
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
  key.shadow.radius = 7;
  key.shadow.blurSamples = 24;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 30;
  key.shadow.camera.left = -2.6;
  key.shadow.camera.right = 2.6;
  key.shadow.camera.top = 2.6;
  key.shadow.camera.bottom = -2.6;
  key.shadow.camera.updateProjectionMatrix();
  lights.add(key);
  const fill = new THREE.DirectionalLight(0xa8c4ff, mode === 'grazing' ? 0.12 : 0.42);
  fill.position.set(4.0, 3.0, 3.5);
  lights.add(fill);
  const rim = new THREE.DirectionalLight(0xfff1c4, mode === 'grazing' ? 0.28 : 0.85);
  rim.position.set(0.5, 4.5, -6.0);
  lights.add(rim);
  lights.userData.reviewMode = mode;
  lights.userData.lightingFromPhoto = ["key light: one shadow-casting warm area/directional key from upper-left-front, direction [-0.55,-0.75,0.35], color #FFD2A0, relative intensity 3.1, broad 2.4-unit emitter, soft PCF shadow; this is the only shadow-casting light", "fill light: non-shadow-casting cool-neutral hemisphere or very broad fill from camera-right, color #9FB5A5, relative intensity 0.38; retain drawer and under-apron depth", "environment/rim: dark-green low-intensity environment reflection #16271F with a restrained non-shadow rim from rear-right, color #B8C7AA, relative intensity 0.24 to separate rear legs", "exposure and tone mapping: ACES filmic tone mapping, exposure 0.92, physicallyCorrectLights true, highlight rolloff preserving brass crown and tabletop bevel detail", "background and contact shadow: matte dark-green background #0F211A; one soft ground receiver at Y=0 with foot contact shadows and localized AO, no near fog and no ambient-only wash"];
  lights.userData.lookDevTargets = {"qualityPriority": "reference-fidelity", "materialPass": {"albedoPaletteRequired": true, "roughnessVariationRequired": true, "normalOrBumpRequired": true, "localOverridesRequired": true, "minimumTextureResolution": 1024, "preferredTextureResolution": 2048, "independentMapChannels": ["albedo", "roughness", "height", "normal", "ambient-occlusion"], "requiredSurfaceFrequencyBands": ["macro", "meso", "micro"], "geometryReliefRequiredWhenSilhouetteAffected": true, "referencePbrExtraction": {"requiredWhenSourceImagePresent": true, "targetThreshold": 0.7, "stopOnLowConfidence": true, "script": "forge/stage1_intake/extract_pbr_evidence.py", "acceptedLimitation": "single-image extraction is reference-derived inference, not exact photogrammetry"}, "mustAvoid": ["single flat albedo per material", "uniform roughness", "albedo texture reused as roughness/height/normal/AO", "single-frequency random noise", "plastic-looking smooth bark, stone, cloth, foliage, or aged material", "local color/detail described only in prose without material masks", "claiming exact PBR recovery when confidence is below the target threshold"]}, "lightingPass": {"requiredTerms": ["key light", "fill light", "rim or environment light", "exposure", "tone mapping", "background", "contact shadow"], "mustAvoid": ["ambient-only lighting", "flat value range", "missing contact shadow", "reference lighting copied without separating material readability"]}, "screenshotReview": ["Compare albedo palette and local color zones.", "Compare roughness/normal/bump response under light.", "Compare cavity dirt, edge wear, stains, moss, scratches, or other local masks.", "Compare key/fill/rim structure, exposure, tone mapping, background, and contact shadows.", "Capture a neutral-light render to verify material readability without reference lighting.", "Capture a grazing-light close-up to expose flat normals, uniform roughness, tiling, and plastic highlights.", "Capture a reference-matched render from the same camera framing as the source."]};
  return lights;
}

// PBR materials (clearcoat/iridescence/transmission/anisotropy) need an environment
// map to visually behave as intended — call this once per renderer and assign the
// result to scene.environment before rendering. No external HDR asset required.
export function createWarmPaperAtelierDeskEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return texture;
}

// Plan 1.3 §3.2 — auto-framing by bounding box. The Divine Eye can only compare a
// render to the reference if the object is FRAMED consistently (an object framed
// differently scores as wrong even when its shape is right). This positions the camera
// deterministically from the object's bounding box so it fills the frame at a stable
// margin, and sets near/far to the object scale. Call after adding the model to the
// scene, and again on resize (after updating camera.aspect).
export function frameWarmPaperAtelierDeskCamera(
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  options: { margin?: number; azimuthDeg?: number; elevationDeg?: number } = {},
): void {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const margin = options.margin ?? 1.15;
  const maxDim = Math.max(size.x, size.y, size.z) * margin;
  const fov = (camera.fov * Math.PI) / 180;
  // distance so the largest object dimension fits vertically in the frame
  const distance = (maxDim / 2) / Math.tan(fov / 2);
  const az = ((options.azimuthDeg ?? 0) * Math.PI) / 180;
  const el = ((options.elevationDeg ?? 0) * Math.PI) / 180;
  const dir = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  );
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = Math.max(0.01, distance - maxDim);
  camera.far = distance + maxDim * 2;
  camera.lookAt(center);
  camera.updateProjectionMatrix();
}

// Plan 1.3 §3.2c — PRESENTATION composer (DOF + bloom). CRITICAL (R-POSTFX): this is
// for the showcase/hero render ONLY. The Divine Eye's EVALUATION render MUST use a
// plain renderer with NO composer — bloom blows highlights and DOF blurs edges, which
// would corrupt the deterministic IoU/DCD/edge/blowout signals. Enable dof/bloom ONLY
// when the reference photo actually exhibits them (detect_reference_effects.py authorizes).
export function createWarmPaperAtelierDeskPresentationComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: { dof?: boolean; bloom?: boolean; bloomStrength?: number; dofFocus?: number; dofAperture?: number } = {},
): EffectComposer {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  if (options.dof) {
    composer.addPass(new BokehPass(scene, camera, {
      focus: options.dofFocus ?? 10.0,
      aperture: options.dofAperture ?? 0.0002,
      maxblur: 0.01,
    }));
  }
  if (options.bloom) {
    const size = new THREE.Vector2();
    renderer.getSize(size);
    composer.addPass(new UnrealBloomPass(size, options.bloomStrength ?? 0.4, 0.4, 0.85));
  }
  return composer;
}

export function configureWarmPaperAtelierDeskRenderer(renderer: THREE.WebGLRenderer): void {
  // Load-bearing for view-dependent finishes (anodized / Doppler): without ACES + sRGB
  // the environment reflection reads flat/washed instead of a believable metal response.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}

export function createWarmPaperAtelierDeskInspectControls(
  camera: THREE.Camera,
  domElement: HTMLElement,
): OrbitControls {
  // View-dependent finishes only read correctly once the user orbits — their color
  // comes from the environment reflection, not albedo, so free rotation matters here.
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.minDistance = 1.0;
  controls.maxDistance = 8.0;
  controls.autoRotate = false;
  return controls;
}
