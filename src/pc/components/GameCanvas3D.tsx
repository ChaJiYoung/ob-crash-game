import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BeerCrusherEngine, EngineShootResult } from '../engine/BeerCrusherEngine';
import { buildBreweryStage3D, BreweryStageRig } from '../three/BreweryStage3D';
import {
  createTargetMesh3D,
  createItemMesh3D,
  updateTargetAnimation3D,
  updateItemAnimation3D,
  applyTargetHitFlash3D,
  getTargetBaseY,
} from '../three/TargetModels3D';
import { DraftTapGun3D } from '../three/DraftTapGun3D';
import { ParticleEffects3D } from '../three/ParticleEffects3D';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { ITEM_BUFF_SPECS, TARGET_SPECS } from '../../shared/constants';

function disposeGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => m.dispose());
      } else if (mesh.material) {
        mesh.material.dispose();
      }
    }
  });
}

export interface GameCanvas3DProps {
  engine: BeerCrusherEngine;
  aimX: number;
  aimY: number;
  onAimChange?: (aimX: number, aimY: number) => void;
  onShoot?: (result: EngineShootResult) => void;
  soundSynth: SoundSynthesizer;
  lastShootResult?: { result: EngineShootResult; key: number };
}

export const GameCanvas3D: React.FC<GameCanvas3DProps> = ({
  engine,
  aimX,
  aimY,
  onAimChange,
  onShoot,
  soundSynth,
  lastShootResult,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const aimRef = useRef({ aimX, aimY });
  aimRef.current = { aimX, aimY };

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const tapGunRef = useRef<DraftTapGun3D | null>(null);
  const particlesRef = useRef<ParticleEffects3D | null>(null);
  const targetMeshMapRef = useRef<Map<string, THREE.Group>>(new Map());

  // Trigger 3D visual FX (tracer beam, recoil, hit flash, particles) for ANY shot
  useEffect(() => {
    if (!lastShootResult || lastShootResult.key === 0) return;
    const { result } = lastShootResult;
    if (!result.fired) return;

    const isFever = engine.scoreManager.getState().isFeverActive;
    const isPower = engine.isBuffActive('power_shot');
    const isFeverOrPower = isFever || isPower;

    if (tapGunRef.current) {
      tapGunRef.current.triggerRecoil(isFeverOrPower);
    }

    if (particlesRef.current && tapGunRef.current && cameraRef.current) {
      const muzzlePos = tapGunRef.current.getMuzzleWorldPosition(cameraRef.current);
      const curAim = aimRef.current;

      let targetPos: THREE.Vector3;
      let beamColor = isPower ? '#ef4444' : isFever ? '#fbbf24' : '#38bdf8';

      if (result.grade !== 'MISS' && result.target) {
        const mesh = targetMeshMapRef.current.get(result.target.id);
        if (mesh) {
          targetPos = mesh.position.clone();
          applyTargetHitFlash3D(mesh, performance.now() / 1000);

          const hitColor = result.target.isItem && result.target.itemKind
            ? ITEM_BUFF_SPECS[result.target.itemKind].auraColorHex
            : TARGET_SPECS[result.target.kind].brandColorHex;

          particlesRef.current.spawnHitEffect(
            targetPos,
            hitColor,
            result.killed ? 32 : 18
          );
        } else {
          targetPos = new THREE.Vector3(curAim.aimX * 7.5, 1.2 + curAim.aimY * 4.2, -14);
        }
      } else {
        // Miss shot: tracer shoots into distance
        targetPos = new THREE.Vector3(curAim.aimX * 8.5, 1.2 + curAim.aimY * 4.5, -16);
      }

      particlesRef.current.spawnTracerBeam(muzzlePos, targetPos, beamColor, isFeverOrPower);
    }
  }, [lastShootResult, engine]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e0906);
    scene.fog = new THREE.FogExp2(0x0e0906, 0.02);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(engine.vFovDeg, width / height, 0.1, 100);
    camera.position.set(0, 1.65, 2.2);
    camera.lookAt(0, 1.35, -12);
    cameraRef.current = camera;
    engine.aspect = width / height;

    let renderer: THREE.WebGLRenderer | null = null;
    let composer: EffectComposer | null = null;

    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.32;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      // UnrealBloomPass Post-Processing
      composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        0.48, // strength
        0.32, // radius
        0.82  // threshold
      );
      composer.addPass(bloomPass);
    } catch (e) {
      console.warn('WebGL or EffectComposer initialization failed:', e);
    }

    // 2. Add Brewery Stage, Gun, and Particle pool
    const stageRig: BreweryStageRig = buildBreweryStage3D(scene);
    const tapGun = new DraftTapGun3D();
    tapGunRef.current = tapGun;
    camera.add(tapGun.group);
    scene.add(camera);

    const particles = new ParticleEffects3D();
    particlesRef.current = particles;
    scene.add(particles.group);

    // 3. Target meshes map
    const targetMeshMap = targetMeshMapRef.current;

    // 4. Resize handler
    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      engine.aspect = w / h;
      renderer.setSize(w, h);
      if (composer) {
        composer.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    // 5. Mouse fallback handlers
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const normX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const normY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      if (onAimChange) {
        onAimChange(normX, normY);
      }
    };

    const executeShot = () => {
      const now = performance.now();
      const curAim = aimRef.current;
      const result = engine.shootAt(curAim.aimX, curAim.aimY, now);

      if (onShoot) {
        onShoot(result);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        executeShot();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const activated = engine.scoreManager.activateFever(performance.now());
        if (activated) {
          soundSynth.playFeverStart();
        }
      }
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKeyDown);

    // 6. Animation loop
    let animId = 0;
    let lastTime = performance.now();

    const animate = (time: number) => {
      animId = requestAnimationFrame(animate);
      const dtSec = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      const feverState = engine.scoreManager.getState();
      const curAim = aimRef.current;

      // Update Engine
      const { reloadedJustNow } = engine.update(time, dtSec);
      if (reloadedJustNow) {
        soundSynth.playAutoReload();
      }

      // Sync 3D Target Meshes
      const activeIds = new Set(engine.activeTargets.map((t) => t.id));

      // Remove dead target meshes with memory disposal
      targetMeshMap.forEach((mesh, id) => {
        if (!activeIds.has(id)) {
          scene.remove(mesh);
          disposeGroup(mesh);
          targetMeshMap.delete(id);
        }
      });

      // Add & update active target meshes (supports both monsters and items)
      engine.activeTargets.forEach((target) => {
        let mesh = targetMeshMap.get(target.id);
        if (!mesh) {
          if (target.isItem && target.itemKind) {
            mesh = createItemMesh3D(target.itemKind);
          } else {
            mesh = createTargetMesh3D(target.kind);
          }
          scene.add(mesh);
          targetMeshMap.set(target.id, mesh);
        }

        const baseY = getTargetBaseY(target.kind, target.isItem);
        mesh.position.set(target.x, baseY, target.z);

        if (target.isItem && target.itemKind) {
          updateItemAnimation3D(mesh, target.itemKind, time / 1000);
        } else {
          // Face player yaw
          mesh.rotation.y = Math.atan2(-target.x, -target.z);
          updateTargetAnimation3D(mesh, target.kind, time / 1000, target.hp / target.maxHp);
        }
      });

      // Update gun recoil and aim
      tapGun.updateAimAndRecoil(curAim.aimX, curAim.aimY, dtSec, feverState.isFeverActive);

      // Update stage lighting & alert
      const hasDanger = engine.activeTargets.some((t) => !t.isItem && t.radiusM < 5.0);
      stageRig.updateStageAnimation(time / 1000, feverState.isFeverActive, hasDanger);

      // Update particles and tracer beams
      particles.update(dtSec);

      if (composer) {
        composer.render();
      } else if (renderer) {
        renderer.render(scene, camera);
      }
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKeyDown);

      // Clean up target meshes
      targetMeshMap.forEach((mesh) => {
        scene.remove(mesh);
        disposeGroup(mesh);
      });
      targetMeshMap.clear();

      // Resource cleanup
      if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
        renderer.dispose();
      }
    };
  }, [engine, soundSynth, onAimChange, onShoot]);

  return (
    <div
      ref={mountRef}
      style={{
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        position: 'relative',
        cursor: 'crosshair',
      }}
    />
  );
};
