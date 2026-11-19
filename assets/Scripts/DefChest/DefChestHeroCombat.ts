import {
    _decorator,
    Component,
    Node,
    Vec3,
    Color,
    instantiate,
    ParticleSystem,
} from 'cc';
import {
    DefChestHeroRole,
    DefChestHeroSkillModifiers,
    IDefChestEnemyTarget,
} from './DefChestTypes';
import { DefChestConfig } from './DefChestConfig';
import { AudioManager } from '../System/AudioManager';
import { PoolManager } from '../System/PoolManager';
import { DefChestArenaBounds } from './DefChestArenaBounds';
import { DefChestCameraController } from './DefChestCameraController';
import { DefChestProjectile } from './DefChestProjectile';
import { spawnOneShotVfx } from './DefChestSkillStrategies';
import { DefChestHeroVfxCatalog } from './DefChestHeroVfxCatalog';
import { PaladinGroundFx } from '../VFX/PaladinGroundFx';

const { ccclass, property } = _decorator;

const POOL_KEY_ARROW = 'DefChest_Arrow';
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

// Màu cố định tái sử dụng (tránh cấp phát Color mới mỗi đòn đánh)
const C_THUNDER = new Color(100, 220, 255, 255);
const C_SUN = new Color(255, 185, 60, 255);
const C_FIRE = new Color(255, 95, 30, 255);
const C_PROTECT = new Color(255, 240, 170, 255);
const C_HOLY_DEFAULT = new Color(255, 230, 130, 255);
const C_WHITE = new Color(255, 255, 255, 255);
const C_PALADIN_SWOOSH = new Color(255, 215, 110, 230);
const C_PALADIN_FURY_SWOOSH = new Color(255, 240, 95, 255);
const C_PALADIN_BONK = new Color(255, 225, 110, 255);
const C_WARRIOR_T1 = new Color(220, 240, 255, 225);
const C_WARRIOR_T2 = new Color(255, 165, 55, 245);
const C_WARRIOR_T3 = new Color(255, 75, 45, 255);

const _tmpMyPos = new Vec3();
const _tmpTargetPos = new Vec3();
const _tmpKnockDir = new Vec3();
const _tmpArrowDir = new Vec3();
const _tmpOrigin = new Vec3();
const _tmpInnerColor = new Color();

/** Xử lý tấn công, Aura Paladin và kỹ năng chiến đấu cho 3 Hero. */
@ccclass('DefChestHeroCombat')
export class DefChestHeroCombat extends Component {
    @property({ type: DefChestHeroVfxCatalog, tooltip: 'Danh mục Prefab Đạn & VFX trên cùng Hero' })
    public vfxCatalog: DefChestHeroVfxCatalog = null;

    private _strikeCounter: number = 0;
    private _permanentAuraRings: { node: Node; spinSpeed: number; currentAngle: number }[] = [];
    private _protectiveDomeNode: Node | null = null;
    private _auraRingsBuilt: boolean = false;
    private _hitCandidatesBuf: IDefChestEnemyTarget[] = [];

    protected onLoad(): void {
        this.ensureCatalog();
        PaladinGroundFx.ensureMaterials();
    }

    protected onDestroy(): void {
        this.clearPaladinAuraVisuals();
    }

    public ensureCatalog(): DefChestHeroVfxCatalog {
        if (!this.vfxCatalog) {
            this.vfxCatalog = this.getComponent(DefChestHeroVfxCatalog) || this.addComponent(DefChestHeroVfxCatalog);
        }
        return this.vfxCatalog;
    }

    private get vfxRoot(): Node | null {
        const cat = this.ensureCatalog();
        return cat.poolContainer || this.node.scene?.getChildByPath('System/Pool') || this.node.parent;
    }

    public spawnUpgradeFx(skillId: string): void {
        const cat = this.ensureCatalog();
        const root = this.vfxRoot;
        if (!root) return;
        spawnOneShotVfx(cat.fxLevelUpPrefab, root, this.node.worldPosition, 1.15, 1.2, 0.05);
        if (skillId === 'PALADIN_BURN_BURN') {
            spawnOneShotVfx(cat.fxFireInfernoPrefab, root, this.node.worldPosition, 1.2, 1.1, 0.15);
        } else if (skillId === 'PALADIN_RIGHTEOUS_FURY') {
            spawnOneShotVfx(cat.fxLevelUpRayPrefab, root, this.node.worldPosition, 1.35, 1.3, 0.05);
        }
    }

    public spawnDeathFx(): void {
        const cat = this.ensureCatalog();
        spawnOneShotVfx(cat.fxSmokeDiePrefab, this.vfxRoot, this.node.worldPosition, 1.25, 1.0, 0.35);
    }

    // --- Aura Paladin (chuẩn Survival, chỉ kích hoạt sau khi chọn skill Aura) ---

    public hasUnlockedPaladinAura(mods: DefChestHeroSkillModifiers): boolean {
        return !!(mods.hasThunderAura || mods.hasSunAura || mods.hasProtectiveAura || mods.hasBurnBurnBurn || mods.hasRighteousFury);
    }

    public clearPaladinAuraVisuals(): void {
        for (let i = 0; i < this._permanentAuraRings.length; i++) {
            const n = this._permanentAuraRings[i].node;
            if (n && n.isValid) n.destroy();
        }
        this._permanentAuraRings.length = 0;
        this._auraRingsBuilt = false;

        if (this._protectiveDomeNode && this._protectiveDomeNode.isValid) {
            this._protectiveDomeNode.destroy();
            this._protectiveDomeNode = null;
        }
    }

    private resolvePaladinAuraColor(mods: DefChestHeroSkillModifiers): Color {
        if (mods.hasThunderAura) return C_THUNDER;
        if (mods.hasSunAura) return mods.hasBurnBurnBurn ? C_FIRE : C_SUN;
        if (mods.hasProtectiveAura) return C_PROTECT;
        return C_HOLY_DEFAULT;
    }

    public setupPaladinAuraRings(mods: DefChestHeroSkillModifiers): void {
        for (let i = 0; i < this._permanentAuraRings.length; i++) {
            const n = this._permanentAuraRings[i].node;
            if (n && n.isValid) n.destroy();
        }
        this._permanentAuraRings.length = 0;

        if (!this.hasUnlockedPaladinAura(mods)) {
            this._auraRingsBuilt = true;
            return;
        }

        PaladinGroundFx.ensureMaterials();
        if (!PaladinGroundFx.material) {
            this._auraRingsBuilt = false;
            return;
        }

        const cfg = DefChestConfig.instance;
        const r = (cfg ? cfg.paladinAuraRadius : 3.6) * mods.auraRadiusMultiplier;
        const baseColor = this.resolvePaladinAuraColor(mods);

        const outerNode = PaladinGroundFx.makeRingNode('WA_AuraOuter', this.node, r, baseColor, 0.08);
        if (outerNode) this._permanentAuraRings.push({ node: outerNode, spinSpeed: 28, currentAngle: 0 });

        _tmpInnerColor.set(Math.round(baseColor.r * 0.45), Math.round(baseColor.g * 0.45), Math.round(baseColor.b * 0.45), 255);
        const innerNode = PaladinGroundFx.makeRingNode('WA_AuraInner', this.node, r * 0.62, _tmpInnerColor, 0.07);
        if (innerNode) this._permanentAuraRings.push({ node: innerNode, spinSpeed: -42, currentAngle: 0 });

        if (mods.hasBurnBurnBurn) {
            const fireNode = PaladinGroundFx.makeRingNode('WA_AuraFire', this.node, r * 0.85, C_FIRE, 0.085);
            if (fireNode) this._permanentAuraRings.push({ node: fireNode, spinSpeed: -65, currentAngle: 0 });
        }

        if (mods.hasRighteousFury) {
            const furyNode = PaladinGroundFx.makeRingNode('WA_AuraFury', this.node, r * 1.06, C_WHITE, 0.09);
            if (furyNode) this._permanentAuraRings.push({ node: furyNode, spinSpeed: 50, currentAngle: 0 });
        }

        if (mods.hasProtectiveAura) {
            const cat = this.ensureCatalog();
            if (cat.fxAngelBuffPrefab && (!this._protectiveDomeNode || !this._protectiveDomeNode.isValid)) {
                const dome = instantiate(cat.fxAngelBuffPrefab);
                dome.setParent(this.node);
                dome.setPosition(0, 0.05, 0);
                dome.setScale(1.15, 1.15, 1.15);
                dome.active = true;
                const ps = dome.getComponentsInChildren(ParticleSystem);
                for (let i = 0; i < ps.length; i++) {
                    ps[i].clear();
                    ps[i].play();
                }
                this._protectiveDomeNode = dome;
            }
        }

        this._auraRingsBuilt = this._permanentAuraRings.length > 0;
    }

    public updatePaladinAuraVisuals(dt: number, mods: DefChestHeroSkillModifiers): void {
        if (!this.hasUnlockedPaladinAura(mods)) return;

        if (!this._auraRingsBuilt) {
            if (PaladinGroundFx.material) this.setupPaladinAuraRings(mods);
            else PaladinGroundFx.ensureMaterials();
        }

        for (let i = 0; i < this._permanentAuraRings.length; i++) {
            const item = this._permanentAuraRings[i];
            if (item.node && item.node.isValid) {
                item.currentAngle = (item.currentAngle + item.spinSpeed * dt) % 360;
                item.node.setRotationFromEuler(0, item.currentAngle, 0);
            }
        }
    }

    public executePaladinAuraPulse(
        mods: DefChestHeroSkillModifiers,
        enemies: IDefChestEnemyTarget[],
        onHealAllies: (amount: number) => void
    ): void {
        if (!this.hasUnlockedPaladinAura(mods)) return;

        const cfg = DefChestConfig.instance;
        const cat = this.ensureCatalog();
        const radius = (cfg ? cfg.paladinAuraRadius : 3.6) * mods.auraRadiusMultiplier;
        const dmg = Math.max(1, Math.round((cfg ? cfg.paladinAuraDamage : 12) * mods.auraDamageMultiplier));
        const root = this.vfxRoot;
        const myPos = this.node.worldPosition;
        const pulseColor = this.resolvePaladinAuraColor(mods);

        if (root) {
            PaladinGroundFx.ring(myPos, { from: radius * 0.25, to: radius * 1.05, duration: 0.35, lift: 0.08, color: pulseColor, easing: 'expoOut' });
        }
        if (mods.hasProtectiveAura) onHealAllies(5);

        const r2 = radius * radius;
        const hits = this._hitCandidatesBuf;
        hits.length = 0;

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.isDead || !e.node.isValid) continue;
            const ep = e.node.worldPosition;
            if ((ep.x - myPos.x) ** 2 + (ep.z - myPos.z) ** 2 <= r2) {
                hits.push(e);
                if (mods.hasProtectiveAura) {
                    _tmpKnockDir.set(ep.x - myPos.x, 0, ep.z - myPos.z).normalize();
                    e.takeDamage(dmg, false, _tmpKnockDir, 0.35);
                } else {
                    e.takeDamage(dmg, false);
                }
                if ((mods.hasSunAura || mods.hasBurnBurnBurn) && e.applyBurnDot) {
                    e.applyBurnDot(mods.hasBurnBurnBurn ? 24 : 14, 2.5, cat.fxBurnLoopPrefab);
                }
            }
        }

        if ((mods.hasSunAura || mods.hasBurnBurnBurn) && hits.length > 0 && root) {
            const fxLimit = Math.min(3, hits.length);
            for (let i = 0; i < fxLimit; i++) {
                const target = hits[i];
                if (target && !target.isDead && target.node.isValid) {
                    const tp = target.node.worldPosition;
                    if (mods.hasBurnBurnBurn) spawnOneShotVfx(cat.fxFireInfernoPrefab, root, tp, 0.72, 0.85, 0.12);
                    else spawnOneShotVfx(cat.fxFireballImpactPrefab, root, tp, 0.82, 0.75, 0.65);
                }
            }
        }

        if (mods.hasThunderAura && hits.length > 0 && root) {
            const strikeCount = Math.min(4, hits.length);
            for (let s = 0; s < strikeCount; s++) {
                const pick = hits[Math.floor(Math.random() * hits.length)];
                if (pick && !pick.isDead && pick.node.isValid) {
                    const tp = pick.node.worldPosition;
                    pick.takeDamage(Math.round(dmg * 1.45), true);
                    spawnOneShotVfx(cat.fxLightningChainPrefab, root, tp, 1.35, 0.75, 0.05);
                    spawnOneShotVfx(cat.fxLightningExplosionPrefab, root, tp, 0.72, 0.8, 0.35);
                }
            }
            DefChestCameraController.instance?.shake(0.14, 0.14);
        }
    }

    // --- Tấn công thường & kỹ năng chủ động ---

    public executeAttack(
        role: string,
        target: IDefChestEnemyTarget,
        baseDamage: number,
        attackRange: number,
        mods: DefChestHeroSkillModifiers,
        getActiveEnemies: () => IDefChestEnemyTarget[],
        onSelfHeal: (amt: number) => void
    ): boolean {
        this._strikeCounter++;
        const cfg = DefChestConfig.instance;
        const isCrit = Math.random() < (cfg ? cfg.critRate : 0.25);
        const critMult = isCrit ? (cfg ? cfg.critMultiplier : 2.0) : 1.0;
        const finalDamage = Math.max(1, Math.round(baseDamage * mods.damageMultiplier * critMult));

        if (role === DefChestHeroRole.PALADIN) {
            this.doPaladinStrike(target, finalDamage, isCrit, mods, getActiveEnemies());
            return mods.hasBonk && this._strikeCounter % 2 === 0;
        }
        if (role === DefChestHeroRole.WARRIOR) {
            this.doWarriorStrike(target, finalDamage, isCrit, mods, getActiveEnemies(), onSelfHeal);
            return mods.isFullCircle360 || mods.hasHeavyHand;
        }
        this.doRangerVolley(target, finalDamage, isCrit, attackRange, mods, getActiveEnemies);
        return false;
    }

    private doPaladinStrike(
        target: IDefChestEnemyTarget,
        damage: number,
        isCrit: boolean,
        mods: DefChestHeroSkillModifiers,
        enemies: IDefChestEnemyTarget[]
    ): void {
        if (isCrit) AudioManager.instance?.playCrit();
        else AudioManager.instance?.playAttack();

        const cat = this.ensureCatalog();
        const root = this.vfxRoot;
        this.node.getWorldPosition(_tmpMyPos);
        target.node.getWorldPosition(_tmpTargetPos);
        const yawDeg = Math.atan2(_tmpTargetPos.x - _tmpMyPos.x, _tmpTargetPos.z - _tmpMyPos.z) * RAD_TO_DEG;

        if (root) {
            PaladinGroundFx.swoosh(_tmpMyPos, {
                angle: yawDeg,
                radius: 1.9,
                duration: 0.24,
                color: mods.hasRighteousFury ? C_PALADIN_FURY_SWOOSH : C_PALADIN_SWOOSH,
            });
        }

        _tmpKnockDir.set(_tmpTargetPos.x - _tmpMyPos.x, 0, _tmpTargetPos.z - _tmpMyPos.z).normalize();
        target.takeDamage(damage, isCrit, _tmpKnockDir, mods.hasBonk ? 0.55 : 0.25);
        if (!root) return;

        if (mods.hasRighteousFury) {
            spawnOneShotVfx(cat.fxLevelUpRayPrefab, root, _tmpTargetPos, 0.85, 0.7, 0.2);
        }
        if (mods.hasBonk && this._strikeCounter % 2 === 0) {
            AudioManager.instance?.playHeavySlam();
            PaladinGroundFx.streaks(_tmpTargetPos, { radius: 2.2, duration: 0.6, kind: 'crack', color: C_PALADIN_BONK });
            spawnOneShotVfx(cat.fxPaladinBonkPrefab, root, _tmpTargetPos, 1.15, 0.9, 0.15);
            this.dealAoE(enemies, _tmpTargetPos, 2.5, Math.round(damage * 0.75), isCrit, _tmpKnockDir, 0.5, target, false);
        }
        if (mods.hasBurnBurnBurn) {
            spawnOneShotVfx(cat.fxFireInfernoPrefab, root, _tmpTargetPos, 1.0, 0.95, 0.15);
            spawnOneShotVfx(cat.fxFireExplosionPrefab, root, _tmpTargetPos, 0.9, 0.85, 0.25);
            this.dealAoE(enemies, _tmpTargetPos, 2.4, Math.round(damage * 0.65), false, _tmpKnockDir, 0.25, target, true);
        }
    }

    private doWarriorStrike(
        target: IDefChestEnemyTarget,
        damage: number,
        isCrit: boolean,
        mods: DefChestHeroSkillModifiers,
        enemies: IDefChestEnemyTarget[],
        onSelfHeal: (amt: number) => void
    ): void {
        const cat = this.ensureCatalog();
        const root = this.vfxRoot;
        this.node.getWorldPosition(_tmpMyPos);
        target.node.getWorldPosition(_tmpTargetPos);

        if (mods.hasChargeSkill) {
            const dx = _tmpTargetPos.x - _tmpMyPos.x;
            const dz = _tmpTargetPos.z - _tmpMyPos.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > 1.25) {
                const dashStep = Math.min(dist - 0.95, 1.45);
                _tmpMyPos.x += (dx / dist) * dashStep;
                _tmpMyPos.z += (dz / dist) * dashStep;
                DefChestArenaBounds.instance?.resolveHeroPosition(_tmpMyPos);
                this.node.setWorldPosition(_tmpMyPos);
                spawnOneShotVfx(cat.fxSpeedBoostPrefab, root, _tmpMyPos, 0.9, 0.6, 0.25);
            }
        }

        if (mods.hasHeavyHand || mods.hasShellShock) AudioManager.instance?.playHeavySlam();
        else if (isCrit) AudioManager.instance?.playCrit();
        else AudioManager.instance?.playAttack();

        const yawDeg = Math.atan2(_tmpTargetPos.x - _tmpMyPos.x, _tmpTargetPos.z - _tmpMyPos.z) * RAD_TO_DEG;
        _tmpKnockDir.set(_tmpTargetPos.x - _tmpMyPos.x, 0, _tmpTargetPos.z - _tmpMyPos.z).normalize();

        if (root) {
            const stage = mods.weaponStage;
            const radius = stage >= 3 ? 2.45 : stage === 2 ? 2.05 : 1.55;
            const color = stage >= 3 ? C_WARRIOR_T3 : stage === 2 ? C_WARRIOR_T2 : C_WARRIOR_T1;

            PaladinGroundFx.swoosh(_tmpMyPos, { angle: yawDeg, radius, duration: 0.24, color });

            if (mods.isFullCircle360) {
                PaladinGroundFx.swoosh(_tmpMyPos, { angle: yawDeg, radius, duration: 0.28, color, full: true });
                PaladinGroundFx.ring(_tmpMyPos, { from: 0.4, to: radius * 1.15, duration: 0.32, color });
            }
            if (mods.hasShellShock || mods.hasHeavyHand) {
                PaladinGroundFx.streaks(_tmpTargetPos, { radius: stage >= 3 ? 2.4 : 1.85, duration: 0.58, kind: 'crack', color });
            }
            if (mods.hasHeavyHand) {
                spawnOneShotVfx(cat.fxFireExplosionPrefab, root, _tmpTargetPos, 1.15, 0.9, 0.2);
                DefChestCameraController.instance?.shake(0.18, 0.16);
            }
            if (mods.hasSpikes) {
                spawnOneShotVfx(cat.fxBoneImpactPrefab, root, _tmpTargetPos, 1.45, 0.75, 0.35);
            }
        }

        if (mods.hasBerserker) onSelfHeal(5);

        target.takeDamage(damage, isCrit, _tmpKnockDir, mods.weaponStage >= 2 ? 0.42 : 0.22);
        const cleaveRadius = mods.isFullCircle360 ? 2.85 : mods.weaponStage >= 3 ? 2.45 : mods.weaponStage === 2 ? 2.0 : 1.35;
        this.dealAoE(enemies, mods.isFullCircle360 ? _tmpMyPos : _tmpTargetPos, cleaveRadius, Math.round(damage * 0.8), isCrit, _tmpKnockDir, 0.32, target, false);
    }

    private doRangerVolley(
        target: IDefChestEnemyTarget,
        damage: number,
        isCrit: boolean,
        attackRange: number,
        mods: DefChestHeroSkillModifiers,
        getActiveEnemies: () => IDefChestEnemyTarget[]
    ): void {
        AudioManager.instance?.playRangerAttack();
        const myPos = this.node.worldPosition;
        const targetPos = target.node.worldPosition;
        const baseYaw = Math.atan2(targetPos.x - myPos.x, targetPos.z - myPos.z);

        const count = Math.max(1, mods.arrowCount);
        const spreadRad = mods.spreadAngleDeg * DEG_TO_RAD;
        const speed = DefChestConfig.instance ? DefChestConfig.instance.arrowSpeed : 13.5;

        for (let i = 0; i < count; i++) {
            const yaw = baseYaw + (i - (count - 1) * 0.5) * spreadRad;
            _tmpArrowDir.set(Math.sin(yaw), 0, Math.cos(yaw));
            this.launchArrow(myPos, _tmpArrowDir, speed, attackRange, damage, isCrit, mods, getActiveEnemies);
        }
    }

    private launchArrow(
        heroPos: Vec3,
        dir: Vec3,
        speed: number,
        attackRange: number,
        damage: number,
        isCrit: boolean,
        mods: DefChestHeroSkillModifiers,
        getActiveEnemies: () => IDefChestEnemyTarget[]
    ): void {
        const cat = this.ensureCatalog();
        const container = this.vfxRoot;
        if (!container || !cat.arrowPrefab) return;

        const poolMgr = PoolManager.instance || container.getComponent(PoolManager) || container.addComponent(PoolManager);
        const projNode = poolMgr.get(POOL_KEY_ARROW, cat.arrowPrefab, container);
        if (!projNode) return;

        const proj = projNode.getComponent(DefChestProjectile) || projNode.addComponent(DefChestProjectile);
        _tmpOrigin.set(heroPos.x + dir.x * 0.45, heroPos.y + 0.85, heroPos.z + dir.z * 0.45);

        proj.launch({
            origin: _tmpOrigin,
            direction: dir,
            speed,
            maxDistance: attackRange + 2.5,
            damage,
            isCrit,
            arrowKind: mods.arrowKind,
            ricochetBounces: mods.ricochetBounces,
            ricochetRadius: 4.5,
            pierceCount: mods.pierceCount,
            fireAoeRadius: 2.3,
            fireBurnDps: 16,
            fireBurnDuration: 2.5,
            lightningAoeRadius: 2.8,
            lightningChainCount: 3,
            getActiveEnemies,
            onRecycle: (n: Node) => {
                const pm = PoolManager.instance;
                if (pm && pm.isValid) pm.put(POOL_KEY_ARROW, n, container);
                else if (n && n.isValid) n.active = false;
            },
            fireTrailPrefab: cat.fxFireBallPrefab,
            fireImpactPrefab: cat.fxFireballImpactPrefab,
            burnLoopPrefab: cat.fxBurnLoopPrefab,
            lightningTrailPrefab: cat.fxLightningBallPrefab,
            lightningImpactPrefab: cat.fxLightningExplosionPrefab,
            lightningChainPrefab: cat.fxLightningChainPrefab,
            hitImpactPrefab: cat.fxBoneImpactPrefab,
            vfxRoot: container,
        });
    }

    private dealAoE(
        enemies: IDefChestEnemyTarget[],
        center: Vec3,
        radius: number,
        damage: number,
        isCrit: boolean,
        knockDir: Vec3,
        knockDist: number,
        excludeTarget?: IDefChestEnemyTarget,
        applyBurn: boolean = false
    ): void {
        const cat = this.ensureCatalog();
        const r2 = radius * radius;
        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e === excludeTarget || e.isDead || !e.node.isValid) continue;
            const ep = e.node.worldPosition;
            if ((ep.x - center.x) ** 2 + (ep.z - center.z) ** 2 <= r2) {
                e.takeDamage(damage, isCrit, knockDir, knockDist);
                if (applyBurn && e.applyBurnDot) {
                    e.applyBurnDot(16, 2.4, cat.fxBurnLoopPrefab);
                }
            }
        }
    }
}
