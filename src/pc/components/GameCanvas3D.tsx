import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BeerCrusherEngine, EngineShootResult } from '../engine/BeerCrusherEngine';
import { buildBreweryStage3D, BreweryStageRig } from '../three/BreweryStage3D';
import {
  createTargetMesh3D,
  createItemMesh3D,
  createGoldenCanMesh3D,
  createProjectileMesh3D,
  createCardTargetMesh3D,
  updateTargetAnimation3D,
  updateItemAnimation3D,
  applyTargetHitFlash3D,
  getTargetBaseY,
} from '../three/TargetModels3D';
import { DraftTapGun3D } from '../three/DraftTapGun3D';
import { ParticleEffects3D } from '../three/ParticleEffects3D';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { ITEM_BUFF_SPECS, TARGET_SPECS } from '../../shared/constants';
import { WeaponKind, WeaponLevel } from '../../shared/types';
import { MonsterHudProjection, shouldRenderMonsterHpBar } from './ArcadeOverlayHUD';
import { aimToNdc, viewportRatioToAim } from './CrosshairOverlay';

export function computeAimWorldPoint(
  camera: THREE.PerspectiveCamera,
  aimX: number,
  aimY: number,
  distanceM = 14
): THREE.Vector3 {
  const { ndcX, ndcY } = aimToNdc(aimX, aimY);
  const targetNDC = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera);
  const dir = targetNDC.sub(camera.position).normalize();
  return camera.position.clone().addScaledVector(dir, distanceM);
}

export function disposeSceneGroup(group: THREE.Group): void {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh) {
      if (mesh.geometry && !mesh.geometry.userData?.isShared) {
        mesh.geometry.userData.disposed = true;
        mesh.geometry.dispose();
      }
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          if (!m.userData?.isShared) {
            m.userData.disposed = true;
            if ('map' in m && (m as any).map && !(m as any).map.userData?.isShared) {
              (m as any).map.dispose();
            }
            m.dispose();
          }
        });
      } else if (mesh.material && !mesh.material.userData?.isShared) {
        mesh.material.userData.disposed = true;
        if ('map' in mesh.material && (mesh.material as any).map && !(mesh.material as any).map.userData?.isShared) {
          (mesh.material as any).map.dispose();
        }
        mesh.material.dispose();
      }
    } else if ((obj as any).isSprite) {
      const sprite = obj as THREE.Sprite;
      if (sprite.material && !sprite.material.userData?.isShared) {
        sprite.material.userData.disposed = true;
        sprite.material.dispose();
      }
    }
  });
}

export interface GameCanvas3DHandle {
  setAim: (aimX: number, aimY: number, immediate?: boolean) => void;
  triggerSkillEffect?: (kind: WeaponKind, level?: WeaponLevel) => void;
}

export interface GameCanvas3DProps {
  engine: BeerCrusherEngine;
  aimX: number;
  aimY: number;
  onAimChange?: (aimX: number, aimY: number) => void;
  onShoot?: (result: EngineShootResult) => void;
  soundSynth: SoundSynthesizer;
  lastShootResult?: { result: EngineShootResult; key: number };
  lastSkillTriggered?: { kind: WeaponKind; level?: WeaponLevel; key: number };
  onMonsterProjectionsUpdate?: (projections: MonsterHudProjection[]) => void;
}

export const GameCanvas3D = React.memo(
  forwardRef<GameCanvas3DHandle, GameCanvas3DProps>(({
    engine,
    aimX,
    aimY,
    onAimChange,
    onShoot,
    soundSynth,
    lastShootResult,
    lastSkillTriggered,
    onMonsterProjectionsUpdate,
  }, ref) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const targetAimRef = useRef({ aimX, aimY });
    const currentAimRef = useRef({ aimX, aimY });
    const onAimChangeRef = useRef(onAimChange);
    onAimChangeRef.current = onAimChange;
    const onShootRef = useRef(onShoot);
    onShootRef.current = onShoot;
    const onMonsterProjectionsUpdateRef = useRef(onMonsterProjectionsUpdate);
    onMonsterProjectionsUpdateRef.current = onMonsterProjectionsUpdate;

    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const tapGunRef = useRef<DraftTapGun3D | null>(null);
    const particlesRef = useRef<ParticleEffects3D | null>(null);
    const stageRigRef = useRef<BreweryStageRig | null>(null);
    const targetMeshMapRef = useRef<Map<string, THREE.Group>>(new Map());

    useImperativeHandle(
      ref,
      () => ({
        setAim(nextX: number, nextY: number, immediate = false) {
          targetAimRef.current = { aimX: nextX, aimY: nextY };
          if (immediate) {
            currentAimRef.current = { aimX: nextX, aimY: nextY };
          }
        },
        triggerSkillEffect(kind: WeaponKind, level?: WeaponLevel) {
          if (!particlesRef.current) return;
          const monsterPositions = engine.activeTargets
            .filter((t) => !t.isItem && !t.isGoldenCan && !t.isProjectile && !t.weaponSelectKind && !t.rewardCardKind)
            .map((t) => new THREE.Vector3(t.x, (t as any).customBaseY ?? getTargetBaseY(t.kind, false), t.z));
          const actualLevel = level ?? engine.weaponSystem.getState().weaponLevel;
          particlesRef.current.spawnSkillEffect(kind, actualLevel, monsterPositions);
          soundSynth.playSkillActivation(kind);
        },
      }),
      [engine, soundSynth]
    );

    useEffect(() => {
      if (!lastSkillTriggered || !particlesRef.current) return;
      const monsterPositions = engine.activeTargets
        .filter((t) => !t.isItem && !t.isGoldenCan && !t.isProjectile && !t.weaponSelectKind && !t.rewardCardKind)
        .map((t) => new THREE.Vector3(t.x, (t as any).customBaseY ?? getTargetBaseY(t.kind, false), t.z));
      const level = lastSkillTriggered.level ?? engine.weaponSystem.getState().weaponLevel;
      particlesRef.current.spawnSkillEffect(lastSkillTriggered.kind, level, monsterPositions);
      soundSynth.playSkillActivation(lastSkillTriggered.kind);
    }, [lastSkillTriggered, engine, soundSynth]);

    // Trigger 3D visual FX (tracer beam, recoil, hit flash, particles) for ANY shot
    useEffect(() => {
      if (!lastShootResult || lastShootResult.key === 0) return;
      const { result } = lastShootResult;
      if (!result.fired) return;

      // Trigger defense line heal shockwave pulse if bar repair item was activated
      if (result.activatedItem === 'bar_repair' && stageRigRef.current) {
        stageRigRef.current.triggerHealPulse();
      }

      const isFever = engine.scoreManager.getState().isFeverActive;
      const isPower = engine.isBuffActive('power_shot');
      const isFeverOrPower = isFever || isPower;

      if (tapGunRef.current) {
        tapGunRef.current.triggerRecoil(isFeverOrPower);
      }

      if (particlesRef.current && tapGunRef.current && cameraRef.current) {
        const muzzlePos = tapGunRef.current.getMuzzleWorldPosition(cameraRef.current);
        const curAim = targetAimRef.current;

        let targetPos: THREE.Vector3;
        let beamColor = isPower ? '#ef4444' : isFever ? '#fbbf24' : '#38bdf8';
        const aimDist = result.target ? Math.max(3, result.target.radiusM) : 15;
        const projectedAimPoint = computeAimWorldPoint(cameraRef.current, curAim.aimX, curAim.aimY, aimDist);

        const weaponState = engine.weaponSystem.getState();

        if (result.grade !== 'MISS' && result.target) {
          const mesh = targetMeshMapRef.current.get(result.target.id);
          if (mesh) {
            targetPos = projectedAimPoint.clone().lerp(mesh.position.clone().add(new THREE.Vector3(0, 0.35, 0)), 0.35);
            applyTargetHitFlash3D(mesh, performance.now() / 1000);

            const hitColor = result.target.isItem && result.target.itemKind
              ? ITEM_BUFF_SPECS[result.target.itemKind].auraColorHex
              : TARGET_SPECS[result.target.kind]?.brandColorHex || '#fbbf24';

            if (result.killed) {
              if (result.target.kind === 'bottle') {
                soundSynth.playBottleShatterSound();
                particlesRef.current.triggerBottleCrash(targetPos);
              } else if (result.target.kind === 'boss') {
                soundSynth.playBossExplosionSound();
                particlesRef.current.spawnHitEffect(targetPos, hitColor, 48);
              } else {
                soundSynth.playCanCrushSound();
                particlesRef.current.spawnHitEffect(targetPos, hitColor, 32);
              }
            } else {
              soundSynth.playMetallicHitSound();
              particlesRef.current.spawnHitEffect(targetPos, hitColor, 18);
            }

            if (result.target.isItem && result.target.itemKind) {
              particlesRef.current.spawnFloatingLabel(targetPos, result.target.itemKind);
            }
          } else {
            targetPos = projectedAimPoint;
          }
        } else {
          // Miss shot: tracer shoots straight through the crosshair unprojected ray
          targetPos = computeAimWorldPoint(cameraRef.current, curAim.aimX, curAim.aimY, 16);
        }

        // Spawn 3D Flying Projectile according to weapon archetype
        particlesRef.current.spawnWeaponProjectile(muzzlePos, targetPos, weaponState.weaponKind, weaponState.weaponLevel);
        soundSynth.playWeaponShoot(weaponState.weaponKind, isFever);
      }
    }, [lastShootResult, engine, soundSynth]);

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
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;
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
      stageRigRef.current = stageRig;
      const tapGun = new DraftTapGun3D();
      tapGunRef.current = tapGun;
      camera.add(tapGun.group);
      scene.add(camera);

      const particles = new ParticleEffects3D();
      particlesRef.current = particles;
      scene.add(particles.group);

      // Pre-warm shaders to prevent first-spawn and first-shot compilation stutter
      if (renderer && typeof renderer.compile === 'function') {
        try {
          const warmupGroup = new THREE.Group();
          warmupGroup.position.set(0, -999, 0);
          const sampleMonster = createTargetMesh3D('pilgood');
          const sampleItem = createItemMesh3D('power_shot');
          warmupGroup.add(sampleMonster, sampleItem);
          scene.add(warmupGroup);
          renderer.compile(scene, camera);
          scene.remove(warmupGroup);
          disposeSceneGroup(warmupGroup);
        } catch {
          // Headless / unsupported WebGL context fallback
        }
      }

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
        const mapped = viewportRatioToAim(normX, normY);
        targetAimRef.current = mapped;
        currentAimRef.current = mapped;
        if (onAimChangeRef.current) {
          onAimChangeRef.current(mapped.aimX, mapped.aimY);
        }
      };

      const executeShot = () => {
        const now = performance.now();
        const curAim = targetAimRef.current;
        const result = engine.shootAt(curAim.aimX, curAim.aimY, now);

        if (onShootRef.current) {
          onShootRef.current(result);
        }
      };

      let mouseHoldInterval: ReturnType<typeof setInterval> | null = null;

      const stopMouseHold = () => {
        if (mouseHoldInterval !== null) {
          clearInterval(mouseHoldInterval);
          mouseHoldInterval = null;
        }
      };

      const handleMouseDown = (e: MouseEvent) => {
        if (e.button === 0) {
          executeShot();
          stopMouseHold();
          mouseHoldInterval = setInterval(() => {
            executeShot();
          }, 20);
        }
      };

      const handleMouseUp = (e: MouseEvent) => {
        if (e.button === 0) {
          stopMouseHold();
        }
      };

      const handleMouseLeave = () => {
        stopMouseHold();
      };

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          const activated = engine.activateFever(performance.now());
          if (activated) {
            soundSynth.playFeverStart();
            if (engine.isTutorialMode && engine.tutorialStep === 3) {
              engine.spawnTutorialStep3Enemies();
            }
          }
        }
      };

      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mouseup', handleMouseUp);
      container.addEventListener('mouseleave', handleMouseLeave);
      window.addEventListener('blur', stopMouseHold);
      window.addEventListener('keydown', handleKeyDown);

      // 6. Animation loop
      let animId = 0;
      let lastTime = performance.now();
      let lastProjUpdateTime = 0;
      const activeIds = new Set<string>();
      const projVec = new THREE.Vector3();

      const animate = (time: number) => {
        animId = requestAnimationFrame(animate);
        const dtSec = Math.min(0.1, (time - lastTime) / 1000);
        lastTime = time;

        const feverState = engine.scoreManager.getState();

        // Smooth aim interpolation for 60~120fps display
        const lerpFactor = Math.min(1, dtSec * 28);
        currentAimRef.current.aimX +=
          (targetAimRef.current.aimX - currentAimRef.current.aimX) * lerpFactor;
        currentAimRef.current.aimY +=
          (targetAimRef.current.aimY - currentAimRef.current.aimY) * lerpFactor;
        const curAim = currentAimRef.current;

        // Update Engine
        const { reloadedJustNow } = engine.update(time, dtSec);
        if (reloadedJustNow) {
          soundSynth.playAutoReload();
        }

        // Sync 3D Target Meshes
        activeIds.clear();
        for (let i = 0; i < engine.activeTargets.length; i++) {
          activeIds.add(engine.activeTargets[i].id);
        }

        // Remove dead target meshes with memory disposal
        targetMeshMap.forEach((mesh, id) => {
          if (!activeIds.has(id)) {
            scene.remove(mesh);
            disposeSceneGroup(mesh);
            targetMeshMap.delete(id);
          }
        });

        // Add & update active target meshes (monsters, items, golden cans, projectiles, cards)
        engine.activeTargets.forEach((target) => {
          let mesh = targetMeshMap.get(target.id);
          if (!mesh) {
            if (target.isGoldenCan) {
              mesh = createGoldenCanMesh3D();
            } else if (target.isProjectile) {
              mesh = createProjectileMesh3D();
            } else if (target.weaponSelectKind) {
              const wk = target.weaponSelectKind;
              let title = '맥주관 뚫어뻥';
              let sub = '산탄 & 넉백 밀쳐내기\n근접 화력 특화 샷건';
              let col = '#f59e0b';
              let ico = '🪠';
              if (wk === 'revolver') {
                title = '황금 병따개';
                sub = '일렬 다중 관통 저격\n단발 고화력 리볼버';
                col = '#fbbf24';
                ico = '🍾';
              } else if (wk === 'gatling') {
                title = '탄산 탭 개틀링';
                sub = '초고속 탄산 버블 난사\n대용량 탄창 개틀링';
                col = '#38bdf8';
                ico = '🍺';
              }
              mesh = createCardTargetMesh3D(title, sub, col, ico);
            } else if (target.rewardCardKind) {
              const rk = target.rewardCardKind;
              let title = '무기 레벨업';
              let sub = '화력 증폭 & 3D 외형 진화\n전용 액티브 스킬 강화';
              let col = '#fbbf24';
              let ico = '🌟';
              if (rk === 'rapid_reload') {
                title = '초고속 장전';
                sub = '재장전 딜레이 35% 단축\n최대 탄창 +2발 확장';
                col = '#38bdf8';
                ico = '⚡';
              } else if (rk === 'bar_repair') {
                title = '바리케이드 수리';
                sub = '방어선 체력 100% 전체 회복!\n최대 체력 상한 +1 영구 확장';
                col = '#10b981';
                ico = '🍺';
              } else if (rk === 'fever_boost') {
                title = '피버 부스터';
                sub = '피버 게이지 +50% 즉시 충전\n초고밀도 버스트 가속';
                col = '#f43f5e';
                ico = '🔥';
              } else if (rk === 'lucky_drop') {
                title = '행운의 보급품';
                sub = `아이템 드롭 빈도 ${engine.getNextLuckyDropMultiplier()}배 증가!\n처치 시 보급품 출현 대폭 상승`;
                col = '#a855f7';
                ico = '🍀';
              }
              mesh = createCardTargetMesh3D(title, sub, col, ico);
            } else if (target.isItem && target.itemKind) {
              mesh = createItemMesh3D(target.itemKind);
            } else {
              mesh = createTargetMesh3D(target.kind);
            }
            scene.add(mesh);
            targetMeshMap.set(target.id, mesh);
          }

          let baseY = (target as any).customBaseY;
          if (baseY === undefined) {
            if (target.weaponSelectKind || target.rewardCardKind) {
              baseY = 1.48; // 1인칭 총기에 가려지지 않도록 1.48m로 상향
            } else {
              baseY = getTargetBaseY(target.kind, target.isItem);
            }
          }
          mesh.position.set(target.x, baseY, target.z);

          if (target.isItem && target.itemKind) {
            updateItemAnimation3D(mesh, target.itemKind, time / 1000);
          } else if (target.isGoldenCan) {
            mesh.rotation.y += dtSec * 3.5;
            mesh.position.y = baseY + Math.sin(time / 200) * 0.12;
          } else if (target.isProjectile) {
            mesh.rotation.x += dtSec * 10;
            mesh.rotation.y += dtSec * 14;
          } else if (target.weaponSelectKind || target.rewardCardKind) {
            mesh.rotation.y = Math.atan2(-target.x, -target.z) + Math.sin(time / 300) * 0.12;
            mesh.position.y = baseY + Math.sin(time / 250) * 0.08;
          } else {
            // Face player yaw
            mesh.rotation.y = Math.atan2(-target.x, -target.z);
            const isIceFreeze = engine.isBuffActive('ice_freeze', time);
            const isWideScope = engine.isBuffActive('wide_scope', time);
            const isStunned = Boolean(target.stunUntilMs && target.stunUntilMs > time);
            const isSlowed = Boolean(target.slowUntilMs && target.slowUntilMs > time);
            updateTargetAnimation3D(mesh, target.kind, time / 1000, target.hp / target.maxHp, {
              isIceFreeze,
              isWideScope,
              isStunned,
              isSlowed,
              stuckPlungerCount: target.stuckPlungerCount ?? 0,
              isBossSummoning: target.kind === 'boss' && engine.isBossSummoning(time),
            });
          }
        });

        // Sync weapon 3D model archetype and level
        const currentWeaponState = engine.weaponSystem.getState();
        if (
          tapGun.currentWeaponKind !== currentWeaponState.weaponKind ||
          tapGun.currentWeaponLevel !== currentWeaponState.weaponLevel
        ) {
          tapGun.setWeaponAppearance(currentWeaponState.weaponKind, currentWeaponState.weaponLevel);
        }

        // Update gun recoil, aim, and buff modes
        tapGun.setPowerMode(engine.isBuffActive('power_shot', time));
        tapGun.setScopeMode(engine.isBuffActive('wide_scope', time));
        tapGun.updateAimAndRecoil(curAim.aimX, curAim.aimY, dtSec, feverState.isFeverActive);

        // Update stage lighting & alert
        const hasDanger = engine.activeTargets.some((t) => !t.isItem && t.radiusM < 5.0);
        stageRig.updateStageAnimation(time / 1000, feverState.isFeverActive, hasDanger);

        // Project monster 3D head positions to HUD screen percentage (~30fps throttled)
        if (
          onMonsterProjectionsUpdateRef.current &&
          cameraRef.current &&
          time - lastProjUpdateTime >= 32
        ) {
          lastProjUpdateTime = time;
          const camera = cameraRef.current;
          const projections: MonsterHudProjection[] = [];

          engine.activeTargets.forEach((target) => {
            if (!shouldRenderMonsterHpBar(target.maxHp, target.isItem, target.isProjectile, target.hp)) return;
            const mesh = targetMeshMap.get(target.id);
            if (!mesh) return;

            const headY = mesh.position.y + (target.hitRadiusM || 0.8) * 0.9 + 0.35;
            projVec.set(mesh.position.x, headY, mesh.position.z);
            projVec.project(camera);

            if (projVec.z > 1.0) return;

            const leftPercent = ((projVec.x + 1) / 2) * 100;
            const topPercent = ((-projVec.y + 1) / 2) * 100;

            projections.push({
              id: target.id,
              kind: target.kind,
              hp: target.hp,
              maxHp: target.maxHp,
              leftPercent,
              topPercent,
              isStunned: Boolean(target.stunUntilMs && target.stunUntilMs > time),
              isSlowed: Boolean(target.slowUntilMs && target.slowUntilMs > time),
              isBoss: target.kind === 'boss',
              isItem: target.isItem,
              isProjectile: target.isProjectile,
            });
          });
          onMonsterProjectionsUpdateRef.current(projections);
        }

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
        animId = 0;
        stopMouseHold();
        window.removeEventListener('resize', handleResize);
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mouseup', handleMouseUp);
        container.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('blur', stopMouseHold);
        window.removeEventListener('keydown', handleKeyDown);

        // Clean up target meshes
        targetMeshMap.forEach((mesh) => {
          scene.remove(mesh);
          disposeSceneGroup(mesh);
        });
        targetMeshMap.clear();

        // Resource cleanup
        if (renderer && renderer.domElement && container.contains(renderer.domElement)) {
          container.removeChild(renderer.domElement);
          renderer.dispose();
        }
      };
    }, [engine, soundSynth]);

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
  })
);

