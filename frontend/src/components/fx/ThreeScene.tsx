import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Stars } from '@react-three/drei';
import * as THREE from 'three';

/** Central mouse-reactive distorted metaball. */
function Blob() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    m.rotation.x = state.clock.elapsedTime * 0.12;
    m.rotation.y = state.clock.elapsedTime * 0.16;
    m.position.x = THREE.MathUtils.lerp(m.position.x, state.pointer.x * 0.6, 0.04);
    m.position.y = THREE.MathUtils.lerp(m.position.y, state.pointer.y * 0.6, 0.04);
  });
  return (
    <Float speed={1.6} rotationIntensity={1.2} floatIntensity={1.8}>
      <mesh ref={ref} scale={1.5}>
        <icosahedronGeometry args={[1.4, 20]} />
        <MeshDistortMaterial
          color="#1d4ed8"
          emissive="#0b1e6b"
          emissiveIntensity={0.6}
          roughness={0.15}
          metalness={0.35}
          distort={0.45}
          speed={2.4}
        />
      </mesh>
    </Float>
  );
}

/** Floating crystal shards in portal accent colours. */
function Crystals() {
  const items = useMemo(() => {
    const colors = ['#3b82f6', '#8b1a1a', '#7c3aed', '#0d9488', '#22c55e'];
    return Array.from({ length: 14 }, (_, i) => ({
      pos: [
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 6 - 2,
      ] as [number, number, number],
      scale: 0.18 + Math.random() * 0.35,
      color: colors[i % colors.length],
      speed: 1 + Math.random() * 2,
    }));
  }, []);

  return (
    <>
      {items.map((c, i) => (
        <Float key={i} speed={c.speed} rotationIntensity={2} floatIntensity={2.5}>
          <mesh position={c.pos} scale={c.scale}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial
              color={c.color}
              emissive={c.color}
              emissiveIntensity={0.5}
              roughness={0.1}
              metalness={0.6}
              flatShading
            />
          </mesh>
        </Float>
      ))}
    </>
  );
}

/**
 * Immersive WebGL hero background (react-three-fiber). Transparent canvas so it
 * layers over the page gradient. Lazy-load this — three.js is ~150 kB.
 */
export default function ThreeScene() {
  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[6, 6, 6]} intensity={2.4} color="#3b82f6" />
      <pointLight position={[-6, -4, 2]} intensity={1.8} color="#8b1a1a" />
      <pointLight position={[0, 4, -4]} intensity={1.2} color="#7c3aed" />
      <Suspense fallback={null}>
        <Blob />
        <Crystals />
        <Stars radius={70} depth={45} count={2600} factor={4} saturation={0} fade speed={1.2} />
      </Suspense>
    </Canvas>
  );
}
