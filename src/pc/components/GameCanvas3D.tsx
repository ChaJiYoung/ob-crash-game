import React, { useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { computeRenderPixelRatio } from '../three/renderBudget';
import { buildShaderAnchorGroup } from '../three/ShaderWarmup';
import { ActiveTargetEntity, BeerCrusherEngine, EngineShootResult, ShotSource } from '../engine/BeerCrusherEngine';
import { buildBreweryStage3D, BreweryStageRig } from '../three/BreweryStage3D';
import {
  createTargetMesh3D,
  createItemMesh3D,
  createGoldenCanMesh3D,
  createProjectileMesh3D,
  createCardTargetMesh3D,
  createLandingMarker3D,
  updateLandingMarker3D,
  MINION_DROP_HEIGHT_M,
  getMinionDropRemaining,
  updateTargetAnimation3D,
  updateItemAnimation3D,
  applyTargetHitFlash3D,
  getTargetBaseY,
} from '../three/TargetModels3D';
import { DraftTapGun3D } from '../three/DraftTapGun3D';
import { ParticleEffects3D, HIT_PARTICLE_COUNTS } from '../three/ParticleEffects3D';
import { SoundSynthesizer } from '../audio/SoundSynthesizer';
import { ITEM_BUFF_SPECS, REWARD_CARD_SPECS, TARGET_SPECS } from '../../shared/constants';
import { WeaponKind, WeaponLevel } from '../../shared/types';
import { GAME_TUNING } from '../../shared/gameTuning';
import { MonsterHudProjection, shouldRenderMonsterHpBar } from './ArcadeOverlayHUD';
import { aimToNdc, viewportRatioToAim } from './CrosshairOverlay';
import { computeHorizontalHalfFovRad } from '../engine/FanSpawner';

export function resolveHitFxColor(target: ActiveTargetEntity): string {
  if (target.isProjectile) return '#f87171';
  if (target.isItem && target.itemKind) return ITEM_BUFF_SPECS[target.itemKind].auraColorHex;
  return TARGET_SPECS[target.kind]?.brandColorHex || '#fbbf24';
}

/** 칼날·거품이 닿았을 때 효과가 나올 위치: 몬스터가 실제로 있는 높이. 죽은 몬스터의 메시는 곧 지워지므로 대상 좌표에서 계산한다. */
export function computeSkillHitFxPosition(target: ActiveTargetEntity): THREE.Vector3 {
  const baseY = target.customBaseY ?? getTargetBaseY(target.kind, target.isItem);
  return new THREE.Vector3(target.x, baseY + 0.35, target.z);
}

/** 맞은 몬스터에서 나는 파편과(선택) 소리. 평타와 스킬이 같이 쓴다. */
export function playTargetBurst(
  particles: ParticleEffects3D,
  soundSynth: SoundSynthesizer,
  target: ActiveTargetEntity,
  pos: THREE.Vector3,
  killed: boolean,
  withSound: boolean
): void {
  const hitColor = resolveHitFxColor(target);
  if (killed) {
    if (target.isProjectile) {
      // Intercepted projectiles burst like monsters; the intercept sound is played by the caller.
      // (A projectile's kind is 'pilgood', so it must not fall through to the can-crush sound.)
      particles.spawnHitEffect(pos, hitColor, HIT_PARTICLE_COUNTS.kill);
    } else if (target.kind === 'bottle' && target.isSplitChild) {
      if (withSound) soundSynth.playCanCrushSound();
      particles.spawnHitEffect(pos, hitColor, HIT_PARTICLE_COUNTS.kill);
    } else if (target.kind === 'bottle') {
      if (withSound) soundSynth.playBottleShatterSound();
      particles.triggerBottleCrash(pos);
    } else if (target.kind === 'boss') {
      if (withSound) soundSynth.playBossExplosionSound();
      particles.spawnHitEffect(pos, hitColor, HIT_PARTICLE_COUNTS.boss);
    } else {
      if (withSound) soundSynth.playCanCrushSound();
      particles.spawnHitEffect(pos, hitColor, HIT_PARTICLE_COUNTS.kill);
    }
  } else {
    if (withSound) soundSynth.playMetallicHitSound();
    particles.spawnHitEffect(pos, hitColor, HIT_PARTICLE_COUNTS.hit);
  }
}

const SKILL_HIT_SOUND_GAP_MS = 70;

/** 관통으로 맞은 몬스터(주 대상 제외). */
export function getPiercedTargets(result: EngineShootResult): ActiveTargetEntity[] {
  return (result.hitTargets ?? []).filter((t) => t !== result.target);
}

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
  /** 사격 직후 동기로 호출한다. 렌더 루프가 죽은 대상의 메시를 지우기 전에 폭발을 보장하기 위해서다. */
  playShotFx: (result: EngineShootResult) => void;
}

export interface RenderPerformanceMetrics {
  fps: number;
  drawCalls: number;
  geometries: number;
  textures: number;
}

export interface GameCanvas3DProps {
  engine: BeerCrusherEngine;
  aimX: number;
  aimY: number;
  onAimChange?: (aimX: number, aimY: number) => void;
  onShoot?: (result: EngineShootResult) => void;
  soundSynth: SoundSynthesizer;
  onMonsterProjectionsUpdate?: (projections: MonsterHudProjection[]) => void;
  onRenderMetrics?: (metrics: RenderPerformanceMetrics) => void;
}

export const GameCanvas3D = React.memo(
  forwardRef<GameCanvas3DHandle, GameCanvas3DProps>(({
    engine,
    aimX,
    aimY,
    onAimChange,
    onShoot,
    soundSynth,
    onMonsterProjectionsUpdate,
    onRenderMetrics,
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
    const onRenderMetricsRef = useRef(onRenderMetrics);
    onRenderMetricsRef.current = onRenderMetrics;

    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const tapGunRef = useRef<DraftTapGun3D | null>(null);
    const particlesRef = useRef<ParticleEffects3D | null>(null);
    const stageRigRef = useRef<BreweryStageRig | null>(null);
    const targetMeshMapRef = useRef<Map<string, THREE.Group>>(new Map());

    // Trigger 3D visual FX (tracer beam, recoil, hit flash, particles) for ANY shot.
    // Shoot sound is played once by the page (PCGamePage.handleShootEvent), not here.
    const playShotFx = useCallback(
      (result: EngineShootResult) => {
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

              if (result.shieldBlocked) {
                // Blocked by the obi shield: a quick spark only (the page plays the "ting"); no flash, no hit sound
                particlesRef.current.spawnHitEffect(targetPos, '#e2e8f0', 2);
              } else {
                applyTargetHitFlash3D(mesh, performance.now() / 1000);

                playTargetBurst(particlesRef.current, soundSynth, result.target, targetPos, Boolean(result.killed), true);

                if (result.target.isItem && result.target.itemKind) {
                  particlesRef.current.spawnFloatingLabel(targetPos, result.target.itemKind);
                }

                // 리볼버 관통: 뒤쪽에 맞은 몬스터도 찌그러지고 파편이 튄다(소리는 주 대상 한 번).
                getPiercedTargets(result).forEach((rear) => {
                  const rearKilled = rear.hp <= 0;
                  const rearMesh = targetMeshMapRef.current.get(rear.id);
                  if (rearMesh && !rearKilled) applyTargetHitFlash3D(rearMesh, performance.now() / 1000);
                  playTargetBurst(particlesRef.current!, soundSynth, rear, computeSkillHitFxPosition(rear), rearKilled, rearKilled);
                });
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
        }
      },
      [engine, soundSynth]
    );

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
          const skillTargets = engine.activeTargets
            .filter((t) => !t.isItem && !t.isGoldenCan && !t.isProjectile && !t.weaponSelectKind && !t.rewardCardKind && engine.isTargetLanded(t, performance.now()));
          const monsterPositions = skillTargets.map(
            (t) => new THREE.Vector3(t.x, (t as any).customBaseY ?? getTargetBaseY(t.kind, false), t.z)
          );
          const actualLevel = level ?? engine.weaponSystem.getState().weaponLevel;
          particlesRef.current.spawnSkillEffect(
            kind,
            actualLevel,
            monsterPositions,
            skillTargets.map((t) => t.kind === 'boss')
          );
        },
        playShotFx,
      }),
      [engine, playShotFx]
    );

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

      if (typeof window !== 'undefined') {
        (window as any).__scene = scene;
        (window as any).__camera = camera;
        (window as any).__targetMeshMap = targetMeshMapRef.current;
      }

      let renderer: THREE.WebGLRenderer | null = null;

      try {
        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        });
        renderer.setPixelRatio(computeRenderPixelRatio(width, height, window.devicePixelRatio));
        renderer.setSize(width, height);
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.32;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.shadowMap.autoUpdate = false;
        renderer.shadowMap.needsUpdate = true;
        container.appendChild(renderer.domElement);
      } catch (e) {
        console.warn('WebGL initialization failed:', e);
      }

      // 2. Add Brewery Stage, Gun, and Particle pool
      let disposed = false;
      let shaderAnchors: THREE.Group | null = null;
      let environmentReady = false;
      let sceneReady = false;

      // Pre-warm shaders after the HDRI is applied: the environment map changes the PBR shader
      // variants, so warming up earlier would be wasted. The anchor group stays referenced
      // (never disposed during play) so shader programs are not released.
      const runShaderWarmup = () => {
        if (!renderer || disposed) return;
        if (typeof renderer.compile !== 'function') return;
        let anchors: THREE.Group | null = null;
        try {
          anchors = buildShaderAnchorGroup(particles);
          anchors.position.set(0, -999, 0);
          // Draw (not only compile) every anchor once: ANGLE/Metal builds the pipeline state lazily on the
          // first draw, which otherwise shows up as a 0.5s+ stall the first time an item, boss, or card is drawn.
          anchors.traverse((o) => {
            o.frustumCulled = false;
          });
          scene.add(anchors);
          renderer.compile(scene, camera);
          renderer.render(scene, camera);
          anchors.traverse((obj) => {
            const mat = (obj as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
            if (mat && !Array.isArray(mat) && mat.map) renderer!.initTexture(mat.map);
          });
          // Keep the newest anchors alive; release the ones from an earlier (fallback environment) warmup.
          const previous = shaderAnchors;
          shaderAnchors = anchors;
          if (previous) disposeSceneGroup(previous);
        } catch {
          // Headless / unsupported WebGL context fallback
          if (anchors) disposeSceneGroup(anchors);
        } finally {
          if (anchors) scene.remove(anchors);
        }
      };

      // The HDRI changes the PBR shader variants, so the real warmup waits for it. If it is slow,
      // warm up against the fallback environment so play never starts completely cold.
      const fallbackWarmupTimer = window.setTimeout(() => {
        if (sceneReady && !environmentReady) runShaderWarmup();
      }, 4000);

      const particles = new ParticleEffects3D();
      particlesRef.current = particles;

      const stageRig: BreweryStageRig = buildBreweryStage3D(scene, () => {
        environmentReady = true;
        if (sceneReady) runShaderWarmup();
      });
      stageRigRef.current = stageRig;
      const tapGun = new DraftTapGun3D();
      tapGunRef.current = tapGun;
      camera.add(tapGun.group);
      scene.add(camera);
      scene.add(particles.group);

      sceneReady = true;
      if (environmentReady) runShaderWarmup();

      // 3. Target meshes map
      const targetMeshMap = targetMeshMapRef.current;

      // Landing markers for falling boss minions (pooled: a summon drops at most ~7 at once)
      const dropMarkers = new Map<string, THREE.Mesh>();
      const markerPool: THREE.Mesh[] = [];
      const releaseMarker = (id: string) => {
        const marker = dropMarkers.get(id);
        if (!marker) return;
        scene.remove(marker);
        dropMarkers.delete(id);
        markerPool.push(marker);
      };

      // 4. Resize handler
      const handleResize = () => {
        if (!container || !renderer) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        engine.aspect = w / h;
        renderer.setPixelRatio(computeRenderPixelRatio(w, h, window.devicePixelRatio));
        renderer.setSize(w, h);
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

      const executeShot = (source: ShotSource) => {
        const now = performance.now();
        const curAim = targetAimRef.current;
        const result = engine.shootAt(curAim.aimX, curAim.aimY, now, source);

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
          executeShot('press');
          stopMouseHold();
          mouseHoldInterval = setInterval(() => {
            executeShot('hold');
          }, 5);
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
      let lastSkillHitSoundMs = 0;
      let lastMetricsReportMs = performance.now();
      let fpsFrameCount = 0;
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

        // 칼날·거품이 닿은 순간의 연출. 사격과 같은 파편·소리를 쓰고 소리는 70ms에 한 번만 낸다.
        for (const ev of engine.drainSkillHitEvents()) {
          const pos = computeSkillHitFxPosition(ev.target);
          const nowMs = performance.now();
          const bigKill = ev.killed && (ev.target.kind === 'boss' || ev.target.kind === 'bottle');
          const canSound = bigKill || nowMs - lastSkillHitSoundMs >= SKILL_HIT_SOUND_GAP_MS;
          if (canSound && !bigKill) lastSkillHitSoundMs = nowMs;
          if (ev.blocked) {
            particles.spawnHitEffect(pos, '#e2e8f0', 2);
            if (canSound) soundSynth.playShieldBlockSound();
            continue;
          }
          const hitMesh = targetMeshMap.get(ev.target.id);
          if (hitMesh && !ev.killed) applyTargetHitFlash3D(hitMesh, nowMs / 1000);
          playTargetBurst(particles, soundSynth, ev.target, pos, ev.killed, canSound);
          if (ev.target.isProjectile && canSound) soundSynth.playInterceptSound();
          if (ev.source === 'blade') particles.spawnSlashMark(pos);
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
        dropMarkers.forEach((_marker, id) => {
          if (!activeIds.has(id)) releaseMarker(id);
        });

        // Add & update active target meshes (monsters, items, golden cans, projectiles, cards)
        const dropClock = engine.getEffectiveNowMs(time);
        engine.activeTargets.forEach((target) => {
          let mesh = targetMeshMap.get(target.id);
          const needsAdd = !mesh || mesh.parent !== scene;

          if (mesh && mesh.parent && mesh.parent !== scene) {
            mesh.parent.remove(mesh);
          }

          if (!mesh) {
            if (target.isGoldenCan) {
              mesh = createGoldenCanMesh3D();
            } else if (target.isProjectile) {
              mesh = createProjectileMesh3D();
            } else if (target.weaponSelectKind) {
              const wk = target.weaponSelectKind;
              let title = '맥주관 뚫어뻥';
              let sub = '넓은 명중 범위\n한 발 강한 화력 샷건';
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
              const cardSpec = REWARD_CARD_SPECS[target.rewardCardKind];
              const title = cardSpec.nameKo;
              let sub = cardSpec.cardSubtitleKo;
              const col = cardSpec.colorHex;
              const ico = cardSpec.icon;
              if (target.rewardCardKind === 'lucky_drop') {
                // Dynamic text; a different string produces a different cached texture key
                sub = `아이템 드롭 빈도 ${engine.getNextLuckyDropMultiplier()}배 증가!\n처치 시 보급품 출현 대폭 상승`;
              }
              mesh = createCardTargetMesh3D(title, sub, col, ico);
            } else if (target.isItem && target.itemKind) {
              mesh = createItemMesh3D(target.itemKind);
            } else {
              mesh = createTargetMesh3D(target.kind);
              if (target.modelScaleMult) {
                // Big bottle (x1.2) and split children (x0.5); the boss king uses the same hook
                const innerGroup = mesh.userData.inner as THREE.Group;
                innerGroup.scale.multiplyScalar(target.modelScaleMult);
                mesh.userData.baseScale *= target.modelScaleMult;
              }
            }
            targetMeshMap.set(target.id, mesh);
          }

          if (needsAdd) {
            scene.add(mesh);
          }

          let baseY = (target as any).customBaseY;
          if (baseY === undefined) {
            if (target.weaponSelectKind || target.rewardCardKind) {
              baseY = 1.50; // 1인칭 총기에 가려지지 않도록 1.50m로 상향
            } else {
              baseY = getTargetBaseY(target.kind, target.isItem);
            }
          }
          mesh.position.set(target.x, baseY, target.z);
          // Falling boss minion: lift the whole mesh before the animation pass so its shadow stays on the floor
          const dropRemaining = getMinionDropRemaining(target.dropLandAtMs, dropClock, GAME_TUNING.boss.minionDrop.dropMs);
          if (dropRemaining > 0) mesh.position.y += MINION_DROP_HEIGHT_M * dropRemaining * dropRemaining;

          if (target.isItem && target.itemKind) {
            updateItemAnimation3D(mesh, target.itemKind, time / 1000);
          } else if (target.isGoldenCan) {
            mesh.rotation.y += dtSec * 3.5;
            mesh.position.y = baseY + Math.sin(time / 200) * 0.12;
          } else if (target.isProjectile) {
            mesh.rotation.x += dtSec * 10;
            mesh.rotation.y += dtSec * 14;
          } else if (target.weaponSelectKind || target.rewardCardKind) {
            mesh.rotation.y = Math.atan2(-target.x, 2.2 - target.z) + Math.sin(time / 300) * 0.08;
            mesh.position.y = baseY + Math.sin(time / 250) * 0.06;
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
              isGuarding: Boolean(target.isGuarding),
              isShielded: Boolean(target.isShielded),
            });
          }

          // Landing ring on the floor while the minion falls in
          if (dropRemaining > 0) {
            let marker = dropMarkers.get(target.id);
            if (!marker) {
              marker = markerPool.pop() ?? createLandingMarker3D();
              dropMarkers.set(target.id, marker);
              scene.add(marker);
            }
            marker.position.x = target.x;
            marker.position.z = target.z;
            updateLandingMarker3D(marker, dropRemaining, target.hitRadiusM || 0.8);
          } else if (dropMarkers.has(target.id)) {
            releaseMarker(target.id);
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
        const hasDanger = engine.activeTargets.some((t) => !t.isItem && !t.weaponSelectKind && !t.rewardCardKind && t.radiusM < 5.0);
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
            if (getMinionDropRemaining(target.dropLandAtMs, engine.getEffectiveNowMs(time), GAME_TUNING.boss.minionDrop.dropMs) > 0) return; // still falling in
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
        particles.syncSkillBlades(engine.activeSkillBlades);
        particles.syncSkillFoam(
          engine.activeSkillFoamWaves,
          computeHorizontalHalfFovRad(engine.vFovDeg, engine.aspect) + 0.15 // 화면 양옆 끝까지
        );
        particles.update(dtSec);

        if (renderer) renderer.render(scene, camera);

        // Periodic render performance reporting (~250ms throttled)
        fpsFrameCount++;
        const nowMs = performance.now();
        if (nowMs - lastMetricsReportMs >= 250) {
          if (onRenderMetricsRef.current && renderer) {
            const elapsedSec = (nowMs - lastMetricsReportMs) / 1000;
            const fps = Math.round(fpsFrameCount / elapsedSec);
            onRenderMetricsRef.current({
              fps,
              drawCalls: renderer.info.render.calls,
              geometries: renderer.info.memory.geometries,
              textures: renderer.info.memory.textures,
            });
          }
          fpsFrameCount = 0;
          lastMetricsReportMs = nowMs;
        }
      };

      animId = requestAnimationFrame(animate);

      return () => {
        if (animId) {
          cancelAnimationFrame(animId);
          animId = 0;
        }
        disposed = true;
        window.clearTimeout(fallbackWarmupTimer);
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
        dropMarkers.forEach((marker) => {
          scene.remove(marker);
          disposeSceneGroup(marker as unknown as THREE.Group);
        });
        dropMarkers.clear();
        markerPool.forEach((marker) => disposeSceneGroup(marker as unknown as THREE.Group));
        markerPool.length = 0;

        if (shaderAnchors) {
          disposeSceneGroup(shaderAnchors);
          shaderAnchors = null;
        }

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

