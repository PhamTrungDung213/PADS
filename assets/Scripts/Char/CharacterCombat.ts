import { _decorator, Component, Node, Vec3, Quat, CCFloat, Color } from 'cc';
import { CharacterAnimation } from './CharacterAnimation';
import { CharacterState, PlayerStateEnum } from './CharacterState';
import { CharacterConfig } from '../Config/CharacterConfig';
import { DmgDealer } from '../System/DmgDealer';
import { EnemyPool } from '../Enemies/EnemyPool';
import { GameManager } from '../System/GameManager';
import { AudioManager } from '../System/AudioManager';
import { CharVFX } from '../VFX/CharVFX';
import { PaladinGroundFx } from '../VFX/PaladinGroundFx';
import { EventManager, GameEvent } from '../System/EventManager';

const { ccclass, property } = _decorator;

export enum AuraType {
    NONE = 'NONE',
    THUNDER = 'THUNDER',
    SUN = 'SUN',
    PROTECTIVE = 'PROTECTIVE',
}

const DEG = Math.PI / 180;
const C_SLASH = new Color(255, 236, 170, 255);
const C_FIRE = new Color(255, 95, 30, 255);
const C_THUNDER = new Color(110, 215, 255, 255);
const C_SUN = new Color(255, 185, 60, 255);
const C_PROTECT = new Color(255, 240, 170, 255);
const C_BONK = new Color(255, 230, 90, 255);

@ccclass('CharacterCombat')
export class CharacterCombat extends Component {
    @property({ type: CharacterAnimation })
    public charAnim: CharacterAnimation = null;

    @property({ type: CharacterState })
    public charState: CharacterState = null;

    @property({ type: CCFloat, tooltip: 'Tầm đánh đòn đập sách (mét - chuẩn Paladin: 2.4m)' })
    public attackRange: number = 2.4;

    @property({ type: CCFloat, tooltip: 'Góc quạt đòn đập sách (độ)' })
    public cleaveArcDeg: number = 120;

    @property({ type: CCFloat, tooltip: 'Hồi chiêu đòn đập sách (giây)' })
    public attackCooldown: number = 0.55;

    @property({ type: CCFloat, tooltip: 'Bán kính quét đòn đánh của Aura (mét)' })
    public auraRadius: number = 4.0;

    @property({ type: CCFloat, tooltip: 'Khoảng cách mỗi đợt quét của Aura (giây)' })
    public auraTickInterval: number = 0.5;

    @property({ type: CCFloat, tooltip: 'Sát thương mỗi nhịp của Aura' })
    public auraDamage: number = 7.0;

    // Các nâng cấp từ Skill
    public currentAura: AuraType = AuraType.NONE;
    public hasBonkStun: boolean = false;
    public hasBurnBurnBurn: boolean = false;
    public hasRighteousFury: boolean = false;
    public baseDamage: number = 12.0;

    private _attackTimer: number = 0;
    private _auraTimer: number = 0;
    private _isAttacking: boolean = false;
    private _swingSide: number = 1;
    private _currentTarget: Node = null;
    private _heroPos: Vec3 = new Vec3();
    private _enemyPos: Vec3 = new Vec3();
    private _dirToEnemy: Vec3 = new Vec3();
    private _targetRot: Quat = new Quat();

    // Vòng hào quang sàn cố định quay liên tục dưới chân Hero
    private _permanentAuraRings: { node: Node; spinSpeed: number; currentAngle: number }[] = [];

    onLoad() {
        if (!this.charAnim) this.charAnim = this.getComponent(CharacterAnimation);
        if (!this.charState) this.charState = this.getComponent(CharacterState);

        this.applyConfig();

        this.currentAura = AuraType.NONE;
        this._attackTimer = -1.0;
        this._auraTimer = 0;
        this._isAttacking = false;
        this._swingSide = 1;

        EventManager.instance.on(GameEvent.SKILL_SELECTED, this.onSkillUpgraded, this);
        EventManager.instance.on(GameEvent.SCREEN_CLEAR, this.onScreenClear, this);
    }

    onDestroy() {
        EventManager.instance.off(GameEvent.SKILL_SELECTED, this.onSkillUpgraded, this);
        EventManager.instance.off(GameEvent.SCREEN_CLEAR, this.onScreenClear, this);
        this.clearAuraRings();
        this.cancelAttack(true);
    }

    public applyConfig() {
        const config = CharacterConfig.instance;
        if (config) {
            if (config.attackRange > 0) this.attackRange = config.attackRange;
            if (config.attackCooldown > 0) this.attackCooldown = config.attackCooldown;
            if (config.baseDamage > 0) this.baseDamage = config.baseDamage;
            if (config.auraRadius > 0) this.auraRadius = config.auraRadius;
            if (config.auraTickInterval > 0) this.auraTickInterval = config.auraTickInterval;
            if (config.auraDamage > 0) this.auraDamage = config.auraDamage;
        }
    }

    public isAttacking(): boolean {
        return this._isAttacking;
    }

    public cancelAttack(force: boolean = false) {
        if (!force && this._isAttacking) {
            return;
        }
        this.unscheduleAllCallbacks();
        this._isAttacking = false;
        this._currentTarget = null;
    }

    private onSkillUpgraded(skillId: string) {
        if (skillId === 'aura_thunder') {
            this.currentAura = AuraType.THUNDER;
            this.auraTickInterval = 0.7;
            this.auraDamage += 5;
            this.setupAuraRings();
        } else if (skillId === 'aura_sun') {
            this.currentAura = AuraType.SUN;
            this.auraTickInterval = 0.5;
            this.auraDamage += 7;
            this.setupAuraRings();
        } else if (skillId === 'aura_protective') {
            this.currentAura = AuraType.PROTECTIVE;
            this.auraTickInterval = 1.0;
            this.auraRadius += 1.2;
            this.setupAuraRings();
        } else if (skillId === 'bonk_stun') {
            this.hasBonkStun = true;
        } else if (skillId === 'burn_burn_burn') {
            this.hasBurnBurnBurn = true;
            this.auraDamage *= 2.0;
            this.setupAuraRings(); // Thêm vòng lửa đỏ xoay
        } else if (skillId === 'righteous_fury') {
            this.hasRighteousFury = true;
            // Phóng to Paladin model x1.12
            const visualNode = this.node.getChildByName('P_Paladin') || this.node;
            const currentScale = visualNode.scale;
            visualNode.setScale(currentScale.x * 1.12, currentScale.y * 1.12, currentScale.z * 1.12);

            this.auraRadius *= 1.6;
            this.auraDamage *= 1.8;
            this.attackCooldown = Math.max(0.25, this.attackCooldown * 0.7); // +40% tốc đánh
            this.setupAuraRings(); // Mở rộng viền và thêm vòng thánh trắng
        }
    }

    // =========================================================================
    // HỆ THỐNG VÒNG HÀO QUANG LIÊN TỤC DƯỚI SÀN (PERMANENT AURA RINGS)
    // =========================================================================
    public clearAuraRings() {
        for (const item of this._permanentAuraRings) {
            if (item.node && item.node.isValid) {
                item.node.destroy();
            }
        }
        this._permanentAuraRings.length = 0;
    }

    public setupAuraRings() {
        this.clearAuraRings();
        if (this.currentAura === AuraType.NONE) return;

        const r = this.auraRadius;
        const burn = this.hasBurnBurnBurn;
        const baseColor = this.currentAura === AuraType.THUNDER
            ? new Color(100, 220, 255, 255)
            : this.currentAura === AuraType.SUN
                ? (burn ? C_FIRE : C_SUN)
                : C_PROTECT;

        // 1. Vòng viền ngoài quay theo chiều kim đồng hồ
        const outerNode = PaladinGroundFx.makeRingNode('WA_AuraOuter', this.node, r, baseColor, 0.08);
        if (outerNode) {
            this._permanentAuraRings.push({ node: outerNode, spinSpeed: 28, currentAngle: 0 });
        }

        // 2. Vòng hào quang lớp trong quay ngược chiều tạo chiều sâu ma trận phép
        const dimColor = new Color(baseColor.r * 0.45, baseColor.g * 0.45, baseColor.b * 0.45, 255);
        const innerNode = PaladinGroundFx.makeRingNode('WA_AuraInner', this.node, r * 0.62, dimColor, 0.07);
        if (innerNode) {
            this._permanentAuraRings.push({ node: innerNode, spinSpeed: -42, currentAngle: 0 });
        }

        // 3. Nếu có bùa Burn: Vòng lửa thứ 3 cuộn ngược
        if (burn) {
            const fireNode = PaladinGroundFx.makeRingNode('WA_AuraFire', this.node, r * 0.85, C_FIRE, 0.085);
            if (fireNode) {
                this._permanentAuraRings.push({ node: fireNode, spinSpeed: -65, currentAngle: 0 });
            }
        }

        // 4. Nếu có Righteous Fury: Viền hào quang trắng sáng thứ 4 mở rộng
        if (this.hasRighteousFury) {
            const furyNode = PaladinGroundFx.makeRingNode('WA_AuraFury', this.node, r * 1.06, new Color(255, 255, 255, 255), 0.09);
            if (furyNode) {
                this._permanentAuraRings.push({ node: furyNode, spinSpeed: 50, currentAngle: 0 });
            }
        }
    }

    update(deltaTime: number) {
        if (GameManager.instance && GameManager.instance.isPaused) return;

        this._attackTimer += deltaTime;
        this._auraTimer += deltaTime;

        // Xoay liên tục các vòng hào quang sàn bám theo Paladin
        for (let i = 0; i < this._permanentAuraRings.length; i++) {
            const item = this._permanentAuraRings[i];
            if (item.node && item.node.isValid) {
                item.currentAngle = (item.currentAngle + item.spinSpeed * deltaTime) % 360;
                item.node.setRotationFromEuler(0, item.currentAngle, 0);
            }
        }

        // Aura quét định kỳ
        if (this._auraTimer >= this.auraTickInterval) {
            this._auraTimer = 0;
            this.tickAuraDamage();
        }
    }

    // =========================================================================
    // 1. ĐÒN ĐẬP SÁCH THƯỜNG (CHỈ ĐÁNH KHI ĐỨNG YÊN - THẢ JOYSTICK)
    // =========================================================================
    public executeAttack(targetEnemy: Node) {
        if (!targetEnemy || !targetEnemy.isValid) return;
        if (this._isAttacking) return;
        if (this._attackTimer < this.attackCooldown) return;

        // QUY TẮC CỐT LÕI: Tuyệt đối không đánh thường khi đang di chuyển!
        if (this.charState && this.charState.isMoving()) return;

        this._isAttacking = true;
        this._currentTarget = targetEnemy;
        this._attackTimer = 0;

        // Xoay mặt chuẩn xác về phía quái
        targetEnemy.getWorldPosition(this._enemyPos);
        this.node.getWorldPosition(this._heroPos);
        this._dirToEnemy.set(this._enemyPos.x - this._heroPos.x, 0, this._enemyPos.z - this._heroPos.z).normalize();
        if (this._dirToEnemy.lengthSqr() > 0.001) {
            const facingDir = new Vec3(-this._dirToEnemy.x, 0, -this._dirToEnemy.z);
            Quat.fromViewUp(this._targetRot, facingDir, Vec3.UP);
            this.node.setWorldRotation(this._targetRot);
            if (this.charState) {
                this.charState.setFacing(this._dirToEnemy);
                this.charState.setState(PlayerStateEnum.ATTACK);
            }
        }

        // Bắt đầu hoạt ảnh đập sách
        if (this.charAnim) {
            this.charAnim.playAttack(() => {
                this._isAttacking = false;
                this._currentTarget = null;
            });
        } else {
            this._isAttacking = false;
            this._currentTarget = null;
        }

        this.scheduleOnce(() => {
            if (this._isAttacking) {
                this._isAttacking = false;
                this._currentTarget = null;
            }
        }, 0.7);

        if (AudioManager.instance && !AudioManager.instance.isEnding) {
            AudioManager.instance.playAttack();
        }

        const targetNode = targetEnemy;
        this.scheduleOnce(() => {
            this.resolveCleaveAttack(targetNode);
        }, 0.16);
    }

    private resolveCleaveAttack(primaryTarget: Node) {
        if (!this.node || !this.node.isValid) return;
        this.node.getWorldPosition(this._heroPos);

        let aimDir = this._dirToEnemy;
        if (primaryTarget && primaryTarget.isValid) {
            primaryTarget.getWorldPosition(this._enemyPos);
            aimDir = new Vec3(this._enemyPos.x - this._heroPos.x, 0, this._enemyPos.z - this._heroPos.z).normalize();
        }

        // Đổi bên vung quạt trái / phải
        this._swingSide = -this._swingSide;
        const angle = Math.atan2(aimDir.z, aimDir.x);
        PaladinGroundFx.swoosh(this._heroPos, {
            angle,
            radius: this.attackRange * 1.05,
            travel: 80 * this._swingSide,
            color: this.hasBurnBurnBurn ? C_FIRE : C_SLASH,
        });

        // Quét quái trong hình nón 120 độ
        const hits = this.findEnemiesInArc(this._heroPos, aimDir, this.attackRange, this.cleaveArcDeg);
        if (primaryTarget && primaryTarget.isValid && hits.indexOf(primaryTarget) < 0) {
            hits.unshift(primaryTarget);
        }

        // Giới hạn tối đa 3 quái mỗi đòn chém
        const targets = hits.slice(0, 3);
        const dmg = this.baseDamage;

        for (let i = 0; i < targets.length; i++) {
            const e = targets[i];
            if (!e || !e.isValid) continue;

            const ep = e.worldPosition;
            if (CharVFX.instance) {
                CharVFX.instance.playHitSpark(ep);
            }

            if (DmgDealer.instance) {
                DmgDealer.instance.dealDamage(e, dmg, this.node, false, false);
            }

            if (this.hasBonkStun) {
                const statsComp = e.getComponent('Enemy') as any;
                if (statsComp && typeof statsComp.applyStun === 'function') {
                    statsComp.applyStun(1.5);
                }
                if (i === 0) {
                    PaladinGroundFx.ring(ep, { from: 0.3, to: 2.4, duration: 0.3, color: C_BONK, easing: 'expoOut' });
                    if (CharVFX.instance) CharVFX.instance.playHolyBurst(ep, 0.9);
                }
            }

            if (this.hasBurnBurnBurn && CharVFX.instance) {
                CharVFX.instance.attachBurn(e);
            }
        }
    }

    // =========================================================================
    // 2. LOGIC CÁC AURA KỸ NĂNG (ĐẬP MẠNH, SÉT GIẬT NHIỀU MỤC TIÊU)
    // =========================================================================
    private tickAuraDamage() {
        if (this.currentAura === AuraType.NONE) return;
        if (!EnemyPool.instance) return;

        this.node.getWorldPosition(this._heroPos);
        const r = this.auraRadius;
        const inside = EnemyPool.instance.findEnemiesInRadius(this._heroPos, r);

        switch (this.currentAura) {
            case AuraType.THUNDER: {
                // Sóng sét tỏa rộng dưới sàn
                PaladinGroundFx.ring(this._heroPos, { from: r * 0.25, to: r * 1.05, duration: 0.35, color: C_THUNDER, easing: 'expoOut' });
                if (inside.length === 0) return;

                // NÂNG CẤP: Đánh sét dồn dập vào 4 đến 6 quái (hoặc tất cả nếu <= 6 con)
                const targetCount = Math.min(inside.length, Math.max(4, Math.min(inside.length, 6)));
                const shuffled = [...inside].sort(() => Math.random() - 0.5);

                for (let i = 0; i < targetCount; i++) {
                    const e = shuffled[i];
                    if (e && e.isValid) {
                        const ep = e.worldPosition;
                        if (CharVFX.instance) {
                            CharVFX.instance.playLightningStrike(ep);
                            CharVFX.instance.playHolyBurst(ep, 0.65); // Nổ điện giật tại ngực
                        }
                        if (DmgDealer.instance) {
                            DmgDealer.instance.dealDamage(e, this.auraDamage * 1.3, this.node, false, true);
                        }

                        const stats = e.getComponent('Enemy') as any;
                        if (stats && typeof stats.applyStun === 'function') {
                            stats.applyStun(0.4);
                        }
                    }
                }

                // Rung camera khi sấm sét đánh giòn giã
                const cam = (this.node.scene?.getChildByName('CameraRoot')?.getComponent('CamFollow') as any)
                    || (this.node.scene?.getChildByName('CameraRoot')?.getComponent('CamTest') as any);
                if (cam && typeof cam.shake === 'function') {
                    cam.shake(0.2, 0.25);
                }
                break;
            }

            case AuraType.SUN: {
                const burn = this.hasBurnBurnBurn;
                PaladinGroundFx.ring(this._heroPos, { from: r * 0.25, to: r * 1.05, duration: 0.45, color: burn ? C_FIRE : C_SUN, easing: 'cubicOut' });
                if (inside.length === 0) return;

                const d = this.auraDamage;
                let fxCount = 0;
                for (const e of inside) {
                    if (e && e.isValid) {
                        if (DmgDealer.instance) DmgDealer.instance.dealDamage(e, d, this.node, false, true);

                        if (fxCount < 4 && Math.random() < 0.6) {
                            if (CharVFX.instance) {
                                if (burn) CharVFX.instance.playFireBlast(e.worldPosition, 0.7);
                                else CharVFX.instance.playSunBurst(e.worldPosition);
                            }
                            fxCount++;
                        }

                        if (burn && CharVFX.instance) {
                            CharVFX.instance.attachBurn(e);
                        }
                    }
                }
                break;
            }

            case AuraType.PROTECTIVE: {
                PaladinGroundFx.ring(this._heroPos, { from: 0.6, to: r * 1.05, duration: 0.35, color: C_PROTECT, easing: 'expoOut' });
                PaladinGroundFx.streaks(this._heroPos, { kind: 'spike', radius: r * 1.1, color: C_PROTECT, duration: 0.45 });
                if (inside.length === 0) return;

                let pushCount = 0;
                for (const e of inside) {
                    if (e && e.isValid) {
                        const ep = e.worldPosition;
                        const dx = ep.x - this._heroPos.x;
                        const dz = ep.z - this._heroPos.z;
                        const dist = Math.sqrt(dx * dx + dz * dz);
                        if (dist > 0.001) {
                            const pushDist = (r - dist) + 1.2;
                            const pushX = (dx / dist) * pushDist;
                            const pushZ = (dz / dist) * pushDist;
                            e.setWorldPosition(ep.x + pushX, ep.y, ep.z + pushZ);
                            pushCount++;
                        }
                        if (DmgDealer.instance) DmgDealer.instance.dealDamage(e, this.auraDamage * 0.8, this.node, false, true);
                    }
                }

                if (pushCount >= 2 && CharVFX.instance) {
                    CharVFX.instance.playHolyBurst(this._heroPos, 1.2);
                }
                break;
            }
        }
    }

    // =========================================================================
    // 3. CHIÊU CUỐI: CỘT SÁNG THÁNH DỌN SẠCH 100% MAP (HOLY RETRIBUTION)
    // =========================================================================
    private onScreenClear() {
        this.node.getWorldPosition(this._heroPos);
        this.clearAuraRings();

        // 1. Sóng vàng thánh quét toả ra toàn bộ màn hình
        PaladinGroundFx.ring(this._heroPos, {
            from: 0.5,
            to: 30,
            duration: 0.9,
            color: new Color(255, 235, 140, 255),
            easing: 'expoOut'
        });

        // 2. Cột sáng thánh giáng uy lực trên người Paladin
        if (CharVFX.instance) {
            CharVFX.instance.playLevelUp(2.8);
        }

        // 3. Phát âm thanh nổ sấm rền đùng một phát
        if (AudioManager.instance) {
            AudioManager.instance.playFinalExplosion();
        }

        // 4. Rung chuyển camera mạnh mẽ
        const cam = (this.node.scene?.getChildByName('CameraRoot')?.getComponent('CamFollow') as any)
            || (this.node.scene?.getChildByName('CameraRoot')?.getComponent('CamTest') as any);
        if (cam && typeof cam.shake === 'function') {
            cam.shake(0.85, 0.6);
        }

        // 5. TIÊU DIỆT TOÀN BỘ 100% QUÁI TRÊN TOÀN MAP NGAY LẬP TỨC (KHÔNG BỎ SÓT)
        if (EnemyPool.instance) {
            EnemyPool.instance.killAll();
        }
    }

    // =========================================================================
    // HELPER TÍNH TOÁN QUÁI TRONG HÌNH NÓN (CLEAVE ARC)
    // =========================================================================
    private findEnemiesInArc(center: Vec3, toward: Vec3, radius: number, arcDeg: number): Node[] {
        if (!EnemyPool.instance) return [];
        const inRadius = EnemyPool.instance.findEnemiesInRadius(center, radius);
        const fx = toward.x;
        const fz = toward.z;
        const fl = Math.sqrt(fx * fx + fz * fz);
        if (fl < 1e-4) return inRadius;

        const cosHalf = Math.cos(arcDeg * 0.5 * DEG);
        const out: Node[] = [];

        for (const e of inRadius) {
            if (!e || !e.isValid) continue;
            e.getWorldPosition(this._enemyPos);
            const dx = this._enemyPos.x - center.x;
            const dz = this._enemyPos.z - center.z;
            const dl = Math.sqrt(dx * dx + dz * dz);
            if (dl < 0.6 || (dx * fx + dz * fz) / (dl * fl) >= cosHalf) {
                out.push(e);
            }
        }
        return out;
    }
}
