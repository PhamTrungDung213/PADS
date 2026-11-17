import { _decorator, CCFloat, CCInteger, Color, Component, director, Material, Node, Prefab, Vec3 } from 'cc';
import {
    SoundManager,
    CharacterFacing,
    CharacterStats,
    GameplayLog,
    GameManager,
    GameState,
    AnimState,
    PlayerAnimation,
    PlayerController,
    DamageDealer,
    EnemyController,
    WA_EnemyStatus,
    PaladinStyle,
    PaladinUltimate,
    PA_PaladinGear,
    WA_ScreenFlash,
} from './PaladinTypesStub';
import { WA_GroundFx } from './WA_GroundFx';
import { WA_CameraShake } from './WA_ScreenFx';

const { ccclass, property } = _decorator;

const DEG = Math.PI / 180;

const C_SLASH = new Color(255, 236, 170, 255);
const C_HOLY = new Color(255, 225, 120, 255);
const C_WHITE = new Color(255, 255, 255, 255);
const C_THUNDER = new Color(120, 195, 255, 255);
const C_SUN = new Color(255, 185, 60, 255);
const C_PROTECT = new Color(255, 240, 170, 255);
const C_FIRE = new Color(255, 95, 30, 255);
const C_BONK = new Color(255, 230, 90, 255);

const _a = new Vec3();
const _b = new Vec3();

/** Prefab VFX có sẵn dùng cho Paladin. Trống ô nào thì chỉ còn hiệu ứng vẽ bằng code. */
@ccclass('PA_FxSet')
export class PA_FxSet {
    @property({ type: Prefab, tooltip: 'Tia nhỏ lúc sách đập trúng (FX_FireBolt_impact)' })
    public hitSpark: Prefab = null;

    @property({ type: Prefab, tooltip: 'Sét đánh xuống (FX_Lightning_Blue)' })
    public lightning: Prefab = null;

    @property({ type: Prefab, tooltip: 'Tia vàng: choáng / nổ thánh (FX_Lighting_Explosion)' })
    public holyBurst: Prefab = null;

    @property({ type: Prefab, tooltip: 'Bùng nắng nhỏ trên quái (FX_Fireball_impact)' })
    public sunBurst: Prefab = null;

    @property({ type: Prefab, tooltip: 'Lửa cháy trên người quái (FX_Burn)' })
    public burn: Prefab = null;

    @property({ type: Prefab, tooltip: 'Bùng lửa lớn (FX_FireInferno_impact)' })
    public fireBlast: Prefab = null;

    @property({ type: Prefab, tooltip: 'Vòm vàng (FX_StarCombo_Full)' })
    public goldDome: Prefab = null;

    @property({ type: Prefab, tooltip: 'Cột sáng thánh (FX_LevelUp)' })
    public pillar: Prefab = null;

    @property({ type: Prefab, tooltip: 'Nổ lớn ở tâm (FX_Fire_Explosion)' })
    public bigBlast: Prefab = null;
}

/** Đòn đang vung, chờ sách chạm mới tính sát thương. */
interface PendingHit {
    t: number;
    target: EnemyController;
    aim: Vec3;
}

interface BurnState {
    left: number;
    tick: number;
    fx: Node;
}

interface UltState {
    kind: PaladinUltimate;
    phase: 'windup' | 'wave' | 'outro';
    t: number;
    windup: number;
    lift: number;
    radius: number;
    speed: number;
    center: Vec3;
    hit: Set<EnemyController>;
    waveTime: number;
    onDone: () => void;
}

/**
 * Đánh của Paladin trong bản demo:
 * - Đòn thường: chỉ đánh khi đứng yên (thả joystick), đập sách quạt trước mặt.
 * - Popup 1 chọn 1 aura bao quanh hero (Thunder / Sun / Protective), aura chạy liên tục kể cả khi di chuyển.
 * - Popup 2 nâng cấp (Bonk / Burn Burn Burn / Righteous Fury), mỗi lần mở đổi trang bị (PA_PaladinGear).
 * - Popup 3 (PaladinUltimate): cột sáng thánh giáng xuống, aura nổ ra lan khắp map, quái chết sạch.
 * Gắn trên prefab hero Paladin (thay cho NE_PlayerCombat / WA_WarriorCombat).
 */
@ccclass('PA_PaladinCombat')
export class PaladinCombat extends Component {
    public static instance: PaladinCombat = null;

    @property(PlayerController)
    public player: PlayerController = null;

    @property(CharacterStats)
    public stats: CharacterStats = null;

    @property(PlayerAnimation)
    public anim: PlayerAnimation = null;

    @property({ type: Node, tooltip: 'Node model để bay lên khi tung chiêu cuối và phóng to khi Righteous Fury. Trống = node facing' })
    public visual: Node = null;

    @property({ type: Material, tooltip: 'Material vòng sóng / aura (Warrior/Materials/WA_Ring)' })
    public ringMaterial: Material = null;

    @property({ type: Material, tooltip: 'Material vệt chém / tia sáng (Warrior/Materials/WA_Swoosh)' })
    public swooshMaterial: Material = null;

    @property({ type: PA_FxSet })
    public fx: PA_FxSet = new PA_FxSet();

    @property({ type: CCFloat, tooltip: 'Nhân độ rung camera (0 = tắt rung)' })
    public shakeScale: number = 1;

    @property({ group: { name: 'Đòn thường' }, type: CCFloat, tooltip: 'Tầm đánh (m), lấy max với stats.meleeRange' })
    public attackReach: number = 2.4;

    @property({ group: { name: 'Đòn thường' }, type: CCFloat, tooltip: 'Góc quạt của đòn đập sách (độ)' })
    public cleaveArcDeg: number = 120;

    @property({ group: { name: 'Aura' }, type: CCFloat, tooltip: 'Bán kính aura (m)' })
    public auraRadius: number = 3.6;

    @property({ group: { name: 'Aura' }, type: CCFloat, tooltip: 'Aura of Thunder: giãn cách giữa 2 đợt sét (giây)' })
    public thunderInterval: number = 0.75;

    @property({ group: { name: 'Aura' }, type: CCInteger, tooltip: 'Aura of Thunder: số quái bị sét mỗi đợt' })
    public thunderTargets: number = 2;

    @property({ group: { name: 'Aura' }, type: CCFloat, tooltip: 'Aura of Thunder: sát thương = damage hero x hệ số' })
    public thunderDamageMul: number = 1.2;

    @property({ group: { name: 'Aura' }, type: CCFloat, tooltip: 'Aura of Thunder: choáng (giây)' })
    public thunderStun: number = 0.5;

    @property({ group: { name: 'Aura' }, type: CCFloat, tooltip: 'Aura of Sun: giãn cách giữa 2 nhịp đốt (giây)' })
    public sunInterval: number = 0.5;

    @property({ group: { name: 'Aura' }, type: CCFloat })
    public sunDamageMul: number = 0.55;

    @property({ group: { name: 'Aura' }, type: CCFloat, tooltip: 'Protective Aura: giãn cách giữa 2 lần bật văng (giây)' })
    public protectInterval: number = 1;

    @property({ group: { name: 'Aura' }, type: CCFloat })
    public protectDamageMul: number = 0.8;

    @property({ group: { name: 'Aura' }, type: CCFloat, tooltip: 'Protective Aura: văng ra quá mép aura thêm bấy nhiêu mét' })
    public protectPushExtra: number = 1.2;

    @property({ group: { name: 'Bonk' }, type: CCFloat, tooltip: 'Bán kính cụm quái bị choáng quanh quái trúng đòn' })
    public bonkRadius: number = 2.4;

    @property({ group: { name: 'Bonk' }, type: CCFloat })
    public bonkStun: number = 1.5;

    @property({ group: { name: 'Burn Burn Burn' }, type: CCFloat, tooltip: 'Nhịp aura lửa châm cháy quái trong aura (giây)' })
    public burnAuraInterval: number = 0.6;

    @property({ group: { name: 'Burn Burn Burn' }, type: CCFloat, tooltip: 'Cháy bao lâu sau khi rời aura (giây)' })
    public burnDuration: number = 2.4;

    @property({ group: { name: 'Burn Burn Burn' }, type: CCFloat, tooltip: 'Nhịp mất máu khi cháy (giây)' })
    public burnTick: number = 0.45;

    @property({ group: { name: 'Burn Burn Burn' }, type: CCFloat })
    public burnDamageMul: number = 0.4;

    @property({ group: { name: 'Burn Burn Burn' }, type: CCFloat, tooltip: 'Aura of Sun mạnh thêm bấy nhiêu lần khi có Burn' })
    public burnSunBoost: number = 2;

    @property({ group: { name: 'Burn Burn Burn' }, type: CCInteger, tooltip: 'Tối đa bấy nhiêu quái có lửa VFX cùng lúc (giữ FPS)' })
    public burnFxMax: number = 8;

    @property({ group: { name: 'Righteous Fury' }, type: CCFloat, tooltip: 'Nhân bán kính aura' })
    public furyRadiusMul: number = 1.6;

    @property({ group: { name: 'Righteous Fury' }, type: CCFloat, tooltip: 'Nhân sát thương aura' })
    public furyDamageMul: number = 1.8;

    @property({ group: { name: 'Righteous Fury' }, type: CCFloat, tooltip: '+% tốc đánh' })
    public furyAttackSpeed: number = 0.4;

    @property({ group: { name: 'Righteous Fury' }, type: CCFloat, tooltip: 'Phóng to model' })
    public furyScale: number = 1.12;

    @property({ group: { name: 'Chiêu cuối' }, type: CCFloat, tooltip: 'Tốc độ lan của sóng (m/giây)' })
    public ultSpeed: number = 20;

    @property({ group: { name: 'Chiêu cuối' }, type: CCFloat, tooltip: 'Sóng lan tối thiểu bấy nhiêu mét kể cả khi quái ở gần' })
    public ultMinRadius: number = 18;

    @property({ group: { name: 'Chiêu cuối' }, type: CCFloat, tooltip: 'Quá thời gian này mà còn quái thì giết thẳng (giây)' })
    public ultTimeout: number = 3.5;

    @property({ group: { name: 'Chiêu cuối' }, type: CCFloat, tooltip: 'Chờ sau khi quái chết hết rồi mới báo xong (giây)' })
    public ultOutro: number = 0.8;

    @property({ group: { name: 'Chiêu cuối' }, type: CCInteger, tooltip: 'Mỗi frame phát tối đa bấy nhiêu VFX trên quái (giữ FPS)' })
    public ultFxPerFrame: number = 2;

    private _styles: Set<PaladinStyle> = new Set<PaladinStyle>();
    private _cooldown: number = 0;
    private _auraTimer: number = 0;
    private _burnAuraTimer: number = 0;
    private _swingSide: number = 1;
    private _pending: PendingHit = null;
    private _ult: UltState = null;
    private _lockedInput: boolean = false;
    private _visualBaseY: number = 0;
    private _visualBaseScale: Vec3 = new Vec3(1, 1, 1);
    private _gear: PA_PaladinGear = null;
    private _auraFx: Node[] = [];
    private _burning: Map<EnemyController, BurnState> = new Map<EnemyController, BurnState>();
    private _burnFxCount: number = 0;
    private _upgrades: number = 0;

    public get isBusy(): boolean {
        return !!this._ult;
    }

    public has(style: PaladinStyle): boolean {
        return this._styles.has(style);
    }

    /** Aura đang dùng (None nếu chưa chọn). */
    public get aura(): PaladinStyle {
        if (this.has(PaladinStyle.AuraThunder)) return PaladinStyle.AuraThunder;
        if (this.has(PaladinStyle.AuraSun)) return PaladinStyle.AuraSun;
        if (this.has(PaladinStyle.ProtectiveAura)) return PaladinStyle.ProtectiveAura;
        return PaladinStyle.None;
    }

    private get radius(): number {
        return this.auraRadius * (this.has(PaladinStyle.RighteousFury) ? this.furyRadiusMul : 1);
    }

    private get auraMul(): number {
        return this.has(PaladinStyle.RighteousFury) ? this.furyDamageMul : 1;
    }

    onLoad() {
        PaladinCombat.instance = this;
        if (!this.player) this.player = this.getComponent(PlayerController);
        if (!this.stats) this.stats = this.getComponent(CharacterStats);
        if (!this.anim) this.anim = this.getComponent(PlayerAnimation);
        if (!this.visual) this.visual = this.player ? this.player.facingNode : this.node;
        this._gear = this.getComponent(PA_PaladinGear);
        if (this.ringMaterial) WA_GroundFx.material = this.ringMaterial;
        if (this.swooshMaterial) WA_GroundFx.swooshMaterial = this.swooshMaterial;
        WA_GroundFx.reset();
        if (this.visual) {
            this._visualBaseY = this.visual.position.y;
            this._visualBaseScale.set(this.visual.scale);
        }
    }

    start() {
        // Rung camera: gắn vào camera gameplay (camera follow riêng từng bản).
        const cam = this.player?.cameraNode || director.getScene()?.getChildByPath('CombatScene/Main Camera');
        WA_CameraShake.of(cam);
    }

    onDisable() {
        this.releaseInput();
        this.clearAuraFx();
    }

    onDestroy() {
        if (PaladinCombat.instance === this) PaladinCombat.instance = null;
    }

    // ---------------------------------------------------------------- mở kiểu đánh

    public unlock(style: PaladinStyle) {
        if (style === PaladinStyle.None || this._styles.has(style)) return;
        this._styles.add(style);
        this._upgrades += 1;
        GameplayLog.log('paladin', `mở kiểu đánh ${PaladinStyle[style]}`);
        // Popup 1 -> sách xịn hơn, popup 2 -> sách 2 tay.
        this._gear?.setStage(Math.min(this._upgrades, 2), true);

        const pos = this.node.worldPosition;
        switch (style) {
            case PaladinStyle.AuraThunder:
                this._auraTimer = 0.25;
                WA_GroundFx.prefab(this.fx.lightning, pos, 1.3, 1);
                WA_GroundFx.ring(pos, { from: 0.4, to: this.radius, duration: 0.45, color: C_THUNDER, easing: 'expoOut' });
                WA_ScreenFlash.flash(new Color(150, 210, 255, 255), 60, 0.35);
                break;
            case PaladinStyle.AuraSun:
                this._auraTimer = 0.2;
                WA_GroundFx.prefab(this.fx.sunBurst, pos, 1.6, 1.2);
                WA_GroundFx.ring(pos, { from: 0.4, to: this.radius, duration: 0.45, color: C_SUN, easing: 'expoOut' });
                WA_GroundFx.streaks(pos, { kind: 'spike', radius: this.radius * 1.2, color: C_SUN, duration: 0.6 });
                WA_ScreenFlash.flash(new Color(255, 210, 120, 255), 60, 0.35);
                break;
            case PaladinStyle.ProtectiveAura:
                this._auraTimer = 0.3;
                WA_GroundFx.prefab(this.fx.goldDome, pos, 1.4, 1.6, this.node);
                WA_GroundFx.ring(pos, { from: 0.4, to: this.radius, duration: 0.45, color: C_PROTECT, easing: 'expoOut' });
                WA_ScreenFlash.flash(new Color(255, 245, 200, 255), 60, 0.35);
                break;
            case PaladinStyle.Bonk:
                WA_GroundFx.prefab(this.fx.holyBurst, pos, 1.3, 1);
                WA_GroundFx.ring(pos, { from: 0.4, to: this.bonkRadius * 1.4, duration: 0.4, color: C_BONK, easing: 'expoOut' });
                this.shake(0.2);
                break;
            case PaladinStyle.BurnBurnBurn:
                this._burnAuraTimer = 0.15;
                WA_GroundFx.prefab(this.fx.fireBlast, pos, 1.4, 1.5);
                WA_GroundFx.ring(pos, { from: 0.4, to: this.radius, duration: 0.5, color: C_FIRE, easing: 'expoOut' });
                WA_GroundFx.streaks(pos, { kind: 'crack', radius: this.radius * 1.1, color: C_FIRE, duration: 0.7 });
                WA_ScreenFlash.flash(new Color(255, 110, 40, 255), 70, 0.4);
                this.shake(0.25);
                break;
            case PaladinStyle.RighteousFury:
                if (this.stats) this.stats.addAttackSpeedPercent(this.furyAttackSpeed);
                if (this.visual) {
                    const s = this.furyScale;
                    this.visual.setScale(this._visualBaseScale.x * s, this._visualBaseScale.y * s, this._visualBaseScale.z * s);
                }
                this._auraTimer = 0.1;
                WA_GroundFx.prefab(this.fx.pillar, pos, 1.2, 1.4);
                WA_GroundFx.ring(pos, { from: this.auraRadius, to: this.radius, duration: 0.5, color: C_WHITE, easing: 'backOut' });
                WA_GroundFx.streaks(pos, { kind: 'spike', radius: this.radius * 1.15, color: C_HOLY, duration: 0.6 });
                WA_ScreenFlash.flash(new Color(255, 250, 220, 255), 110, 0.45);
                this.shake(0.35);
                break;
        }
        this.refreshAuraFx();
    }

    // ---------------------------------------------------------------- vòng lặp

    update(dt: number) {
        const gm = GameManager.instance;
        if (gm && gm.state === GameState.Paused) return;

        // Đòn đang vung: tới lúc sách chạm thì mới ra sát thương + hiệu ứng.
        if (this._pending) {
            this._pending.t -= dt;
            if (this._pending.t <= 0) this.landPending();
        }

        if (this._ult) {
            this.updateUlt(dt);
            return;
        }
        if (!this.stats || this.stats.isDead) return;
        if (gm && gm.state !== GameState.Playing) return;

        this.tickBurns(dt);
        this.tickAura(dt);
        if (this.has(PaladinStyle.BurnBurnBurn)) this.tickBurnAura(dt);

        if (gm && !gm.canControl) return;
        this._cooldown = Math.max(0, this._cooldown - dt);

        // Đang kéo joystick thì chỉ chạy (aura vẫn chạy), thả tay ra mới đánh.
        if (this.player && this.player.isMoving) return;
        if (this._cooldown > 0 || this._pending) return;

        const target = this.nearestEnemy(this.reach);
        if (!target) return;
        this._cooldown = this.attackInterval;
        this.attack(target);
    }

    private get attackInterval(): number {
        return this.stats.attackCooldown * (this._gear ? this._gear.cooldownScale : 1);
    }

    private get reach(): number {
        return Math.max(this.attackReach, this.stats ? this.stats.meleeRange : 0);
    }

    /** Phát clip đánh, tua cho sách chạm sau tối đa maxWindup giây. Trả về số giây tới lúc chạm. */
    private swing(maxWindup: number, exact: boolean = false): number {
        const delay = this._gear ? this._gear.prepareAttack(maxWindup, exact) : 0;
        this.anim?.play(AnimState.Attack, true);
        return delay;
    }

    // ---------------------------------------------------------------- đòn thường

    private attack(target: EnemyController) {
        this.face(target.node.worldPosition);
        const delay = this.swing(this.attackInterval * 0.8);
        this._pending = { t: delay, target, aim: new Vec3(target.node.worldPosition) };
        if (delay <= 0.01) this.landPending();
    }

    private landPending() {
        const p = this._pending;
        this._pending = null;
        if (!p || !this.stats || this.stats.isDead) return;
        SoundManager.instance?.playHeroAttack(true);
        const target = p.target && p.target.isValid && p.target.isAlive ? p.target : null;
        this.strike(target, target ? target.node.worldPosition : p.aim);
    }

    private strike(target: EnemyController, tp: Vec3) {
        const pos = this.node.worldPosition;
        const hits = this.enemiesInArc(pos, tp, this.reach, this.cleaveArcDeg);
        if (target && hits.indexOf(target) < 0) hits.push(target);

        this._swingSide = -this._swingSide;
        WA_GroundFx.swoosh(pos, {
            angle: Math.atan2(tp.z - pos.z, tp.x - pos.x),
            radius: this.reach * 1.05,
            travel: 80 * this._swingSide,
            color: this.has(PaladinStyle.BurnBurnBurn) ? C_FIRE : C_SLASH,
        });

        const bonk = this.has(PaladinStyle.Bonk);
        const dmg = this.stats.damage;
        let sparks = 0;
        for (const e of hits) {
            if (sparks < 3) {
                this.spark(e);
                sparks += 1;
            }
            this.hit(e, dmg, pos, bonk ? 1.1 : 0.7, null, bonk ? 0.6 : 0.35);
            if (this.has(PaladinStyle.BurnBurnBurn)) this.ignite(e);
        }
        if (bonk) this.bonk(hits);
        if (hits.length >= 3) this.shake(0.08);
    }

    /** Bonk: choáng cả cụm quanh mỗi quái trúng đòn. */
    private bonk(hits: EnemyController[]) {
        if (hits.length === 0) return;
        const stunned = new Set<EnemyController>();
        let bursts = 0;
        for (const h of hits) {
            if (!h || !h.isValid) continue;
            const c = h.node.worldPosition;
            if (bursts < 2) {
                WA_GroundFx.ring(c, { from: 0.3, to: this.bonkRadius, duration: 0.3, color: C_BONK, easing: 'expoOut' });
                WA_GroundFx.prefab(this.fx.holyBurst, c, 0.9, 1);
                bursts += 1;
            }
            for (const e of this.enemiesInRadius(c, this.bonkRadius)) {
                if (stunned.has(e)) continue;
                stunned.add(e);
                WA_EnemyStatus.of(e)?.stun(this.bonkStun);
            }
        }
        this.shake(0.14);
    }

    // ---------------------------------------------------------------- aura

    private tickAura(dt: number) {
        const aura = this.aura;
        if (aura === PaladinStyle.None) return;
        this._auraTimer -= dt;
        if (this._auraTimer > 0) return;

        const pos = this.node.worldPosition;
        const r = this.radius;
        const mul = this.auraMul;
        const dmg = this.stats.damage;

        switch (aura) {
            case PaladinStyle.AuraThunder: {
                this._auraTimer = this.thunderInterval;
                const inside = this.enemiesInRadius(pos, r);
                if (inside.length === 0) return;
                const count = Math.min(inside.length, this.thunderTargets + (this.has(PaladinStyle.RighteousFury) ? 2 : 0));
                // Ưu tiên quái gần hero nhất (đang đe doạ), xáo nhẹ để sét không đánh mãi 1 chỗ.
                inside.sort((x, y) => this.dist2(x, pos) - this.dist2(y, pos) + (Math.random() - 0.5) * 4);
                const stun = this.has(PaladinStyle.Bonk) ? this.bonkStun : this.thunderStun;
                for (let i = 0; i < count; i++) {
                    const e = inside[i];
                    const ep = e.node.worldPosition;
                    WA_GroundFx.prefab(this.fx.lightning, ep, 1, 0.9);
                    WA_GroundFx.ring(ep, { from: 0.2, to: 1.4, duration: 0.25, color: C_THUNDER, easing: 'expoOut' });
                    this.hit(e, dmg * this.thunderDamageMul * mul, pos, 0.6, null, 0.5);
                    WA_EnemyStatus.of(e)?.stun(stun);
                }
                WA_GroundFx.ring(pos, { from: r * 0.4, to: r, duration: 0.3, color: C_THUNDER, easing: 'expoOut' });
                this.shake(0.06 * count);
                break;
            }
            case PaladinStyle.AuraSun: {
                const burn = this.has(PaladinStyle.BurnBurnBurn);
                this._auraTimer = this.sunInterval / (burn ? 1.4 : 1);
                const inside = this.enemiesInRadius(pos, r);
                WA_GroundFx.ring(pos, { from: r * 0.3, to: r, duration: 0.45, color: burn ? C_FIRE : C_SUN, easing: 'cubicOut' });
                if (inside.length === 0) return;
                const d = dmg * this.sunDamageMul * mul * (burn ? this.burnSunBoost : 1);
                let fx = 0;
                for (const e of inside) {
                    if (fx < 2 && Math.random() < 0.5) {
                        WA_GroundFx.prefab(burn ? this.fx.fireBlast : this.fx.sunBurst, e.node.worldPosition, burn ? 0.6 : 0.8, 1);
                        fx += 1;
                    }
                    this.hit(e, d, pos, 0, null, 0.25);
                }
                break;
            }
            case PaladinStyle.ProtectiveAura: {
                this._auraTimer = this.protectInterval;
                const inside = this.enemiesInRadius(pos, r);
                WA_GroundFx.ring(pos, { from: 0.6, to: r * 1.05, duration: 0.35, color: C_PROTECT, easing: 'expoOut' });
                if (inside.length === 0) return;
                WA_GroundFx.streaks(pos, { kind: 'spike', radius: r * 1.1, color: C_PROTECT, duration: 0.45 });
                const d = dmg * this.protectDamageMul * mul;
                const stun = this.has(PaladinStyle.Bonk) ? this.bonkStun * 0.6 : 0;
                for (const e of inside) {
                    const ep = e.node.worldPosition;
                    const dist = Math.sqrt((ep.x - pos.x) ** 2 + (ep.z - pos.z) ** 2);
                    const push = Math.max(1, r - dist + this.protectPushExtra);
                    this.hit(e, d, pos, push, null, 0.5);
                    if (stun > 0) WA_EnemyStatus.of(e)?.stun(stun);
                }
                if (inside.length >= 2) WA_GroundFx.prefab(this.fx.holyBurst, pos, 1.1, 0.8);
                this.shake(0.12);
                break;
            }
        }
    }

    // ---------------------------------------------------------------- Burn Burn Burn

    /** Aura lửa: châm cháy mọi quái trong aura theo nhịp. */
    private tickBurnAura(dt: number) {
        this._burnAuraTimer -= dt;
        if (this._burnAuraTimer > 0) return;
        this._burnAuraTimer = this.burnAuraInterval;
        const pos = this.node.worldPosition;
        const inside = this.enemiesInRadius(pos, this.radius);
        if (inside.length === 0) return;
        for (const e of inside) this.ignite(e);
    }

    private ignite(e: EnemyController) {
        if (!e || !e.isValid || !e.isAlive) return;
        let st = this._burning.get(e);
        if (!st) {
            st = { left: 0, tick: this.burnTick * 0.5, fx: null };
            this._burning.set(e, st);
            if (this._burnFxCount < this.burnFxMax && this.fx.burn) {
                st.fx = WA_GroundFx.prefab(this.fx.burn, e.node.worldPosition, 1, this.burnDuration + 0.5, e.node);
                if (st.fx) this._burnFxCount += 1;
            }
        }
        st.left = this.burnDuration;
    }

    private tickBurns(dt: number) {
        if (this._burning.size === 0) return;
        const dmg = this.stats.damage * this.burnDamageMul * this.auraMul;
        const dead: EnemyController[] = [];
        this._burning.forEach((st, e) => {
            if (!e || !e.isValid || !e.isAlive || !e.stats || e.stats.isDead) {
                dead.push(e);
                return;
            }
            st.left -= dt;
            st.tick -= dt;
            if (st.tick <= 0) {
                st.tick = this.burnTick;
                DamageDealer.apply(e.stats, dmg, this.stats);
                WA_EnemyStatus.of(e)?.punch(0.15);
            }
            if (st.left <= 0) dead.push(e);
        });
        for (const e of dead) {
            const st = this._burning.get(e);
            if (st?.fx) {
                if (st.fx.isValid) st.fx.destroy();
                this._burnFxCount = Math.max(0, this._burnFxCount - 1);
            }
            this._burning.delete(e);
        }
    }

    // ---------------------------------------------------------------- vòng aura vẽ liên tục

    /** Vẽ lại vòng aura quanh chân hero theo aura + nâng cấp đang có. */
    private refreshAuraFx() {
        this.clearAuraFx();
        const aura = this.aura;
        if (aura === PaladinStyle.None) return;
        const r = this.radius;
        const pos = this.node.worldPosition;
        const burn = this.has(PaladinStyle.BurnBurnBurn);
        const fury = this.has(PaladinStyle.RighteousFury);
        const base = aura === PaladinStyle.AuraThunder ? C_THUNDER : aura === PaladinStyle.AuraSun ? (burn ? C_FIRE : C_SUN) : C_PROTECT;
        const forever = { duration: 1e5, holdAlpha: 0.9999, easing: 'linear' as const, follow: this.node };

        // Viền aura.
        this._auraFx.push(WA_GroundFx.ring(pos, { ...forever, from: r, to: r, color: base, spin: 25 }));
        // Lớp trong mờ cho cảm giác "vùng" aura.
        const dim = new Color(base.r * 0.35, base.g * 0.35, base.b * 0.35, 255);
        this._auraFx.push(WA_GroundFx.ring(pos, { ...forever, from: r * 0.62, to: r * 0.62, color: dim, spin: -40 }));
        // Burn: vòng lửa chạy ngược chiều.
        if (burn) this._auraFx.push(WA_GroundFx.ring(pos, { ...forever, from: r * 0.86, to: r * 0.86, color: C_FIRE, spin: -70 }));
        // Fury: viền trắng sáng thứ 2.
        if (fury) this._auraFx.push(WA_GroundFx.ring(pos, { ...forever, from: r * 1.06, to: r * 1.06, color: C_WHITE, spin: 60 }));
        this._auraFx = this._auraFx.filter((n) => !!n);
    }

    private clearAuraFx() {
        for (const n of this._auraFx) if (n && n.isValid) n.destroy();
        this._auraFx.length = 0;
    }

    // ---------------------------------------------------------------- chiêu cuối (clear màn)

    /** Tung chiêu clear màn. `onDone` gọi khi mọi quái đã chết và hiệu ứng đã xong. */
    public castUltimate(kind: PaladinUltimate, onDone: () => void) {
        if (this._ult) return;
        this.lockInput();

        const windup = kind === PaladinUltimate.Radiance ? 0.75 : kind === PaladinUltimate.Judgement ? 0.55 : 0.65;
        const lift = kind === PaladinUltimate.Radiance ? 1.6 : kind === PaladinUltimate.HolyPillar ? 0.9 : 0.6;
        const speed = kind === PaladinUltimate.Judgement ? this.ultSpeed * 0.85 : this.ultSpeed;
        this._ult = {
            kind,
            phase: 'windup',
            t: 0,
            windup,
            lift,
            radius: 0,
            speed,
            center: new Vec3(),
            hit: new Set<EnemyController>(),
            waveTime: 0,
            onDone,
        };
        this._pending = null;
        // Sách đập xuống đúng lúc cột sáng giáng (hết pha gồng).
        this.swing(windup, true);
        const pos = this.node.worldPosition;
        const c = this.ultColors(kind)[0];
        // Gồng: aura co lại vào người + cột sáng bắt đầu toả.
        const r = Math.max(this.radius, 4);
        WA_GroundFx.ring(pos, { from: r * 1.2, to: 0.4, duration: windup, color: c, easing: 'quadOut' });
        WA_GroundFx.ring(pos, { from: r * 0.8, to: 0.3, duration: windup * 0.8, color: C_WHITE, easing: 'quadOut' });
        WA_GroundFx.prefab(this.fx.pillar, pos, 1.2, windup + 0.8);
        if (kind === PaladinUltimate.Radiance) WA_GroundFx.prefab(this.fx.goldDome, pos, 1.2, windup + 0.4, this.node);
        this.shake(0.15);
        GameplayLog.log('paladin', `tung chiêu cuối ${PaladinUltimate[kind]} — ${this.aliveEnemies().length} quái`);
    }

    private updateUlt(dt: number) {
        const u = this._ult;
        u.t += dt;

        if (u.phase === 'windup') {
            const k = Math.min(1, u.t / u.windup);
            // Bay lên chậm rồi giật xuống ở cuối (đập xuống đất).
            const h = k < 0.8 ? Math.sin((k / 0.8) * Math.PI * 0.5) * u.lift : u.lift * (1 - (k - 0.8) / 0.2);
            this.setVisualHop(h);
            if (k >= 1) {
                this.setVisualHop(0);
                this.impact(u);
            }
            return;
        }

        if (u.phase === 'wave') {
            u.waveTime += dt;
            u.radius += u.speed * dt;
            const alive = this.aliveEnemies();
            let fxLeft = Math.max(0, this.ultFxPerFrame);
            for (const e of alive) {
                if (u.hit.has(e)) continue;
                const ep = e.node.worldPosition;
                const dx = ep.x - u.center.x;
                const dz = ep.z - u.center.z;
                if (dx * dx + dz * dz > u.radius * u.radius && u.waveTime < this.ultTimeout) continue;
                u.hit.add(e);
                if (fxLeft > 0) {
                    this.ultHitFx(u.kind, ep);
                    fxLeft -= 1;
                }
                _a.set(dx, 0, dz);
                if (e.stats) e.stats.invulnerable = false;
                const st = WA_EnemyStatus.of(e);
                st?.knock(_a, 3, 0.55, u.kind === PaladinUltimate.Judgement ? 0.8 : 2.2);
                st?.punch(0.5);
                DamageDealer.apply(e.stats, Math.max(e.stats.hp + 1, this.stats.damage * 3), this.stats);
                if (!e.stats.isDead) u.hit.delete(e);
            }
            const overtime = u.waveTime > this.ultTimeout + 1.5;
            if ((alive.length === 0 && u.radius >= this.ultMinRadius) || overtime) {
                if (overtime && alive.length > 0) GameplayLog.log('paladin', `chiêu cuối quá giờ, còn ${alive.length} quái — kết thúc luôn`);
                u.phase = 'outro';
                u.t = 0;
            }
            return;
        }

        if (u.t >= this.ultOutro) {
            this._ult = null;
            this.releaseInput();
            this.anim?.play(AnimState.Idle, true);
            GameplayLog.log('paladin', 'chiêu cuối xong, map sạch quái');
            u.onDone?.();
        }
    }

    private impact(u: UltState) {
        u.phase = 'wave';
        u.t = 0;
        u.waveTime = 0;
        u.center.set(this.node.worldPosition);
        SoundManager.instance?.playHeroAttack(true);

        let far = this.ultMinRadius;
        for (const e of this.aliveEnemies()) {
            const p = e.node.worldPosition;
            far = Math.max(far, Math.sqrt((p.x - u.center.x) ** 2 + (p.z - u.center.z) ** 2) + 2);
        }
        const life = far / u.speed;
        const colors = this.ultColors(u.kind);
        const c = u.center;

        // Aura đã nổ ra -> tắt vòng aura thường.
        this.clearAuraFx();
        this.shake(1);
        WA_ScreenFlash.flash(new Color(255, 248, 215, 255), u.kind === PaladinUltimate.Radiance ? 230 : 180, 0.5);
        WA_GroundFx.ring(c, { from: 0.5, to: 7, duration: 0.3, color: C_WHITE, easing: 'expoOut' });
        WA_GroundFx.streaks(c, { kind: 'spike', radius: 12, color: colors[0], duration: 0.9 });

        for (let i = 0; i < 3; i++) {
            const color = colors[i % colors.length];
            this.scheduleOnce(() => {
                WA_GroundFx.ring(c, { from: 0.5, to: far, duration: life, color, easing: 'linear', holdAlpha: 0.6 });
            }, i * 0.12);
        }

        switch (u.kind) {
            case PaladinUltimate.HolyPillar: {
                WA_GroundFx.prefab(this.fx.pillar, c, 2.6, 2.2);
                WA_GroundFx.prefab(this.fx.goldDome, c, 2.4, 2);
                WA_GroundFx.prefab(this.fx.holyBurst, c, 2.4, 1.5);
                WA_GroundFx.ring(c, { from: 1, to: 10, duration: 0.7, color: colors[0], holdAlpha: 0.4, easing: 'cubicOut' });
                break;
            }
            case PaladinUltimate.Judgement: {
                WA_GroundFx.prefab(this.fx.holyBurst, c, 2.2, 1.5);
                WA_GroundFx.prefab(this.fx.pillar, c, 1.8, 1.8);
                // Vài cột sáng giáng quanh hero trước khi sóng chạm quái.
                for (let i = 0; i < 6; i++) {
                    const a = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
                    const rr = 3 + Math.random() * 3;
                    const at = new Vec3(c.x + Math.cos(a) * rr, c.y, c.z + Math.sin(a) * rr);
                    this.scheduleOnce(() => {
                        WA_GroundFx.prefab(this.fx.pillar, at, 1, 1.2);
                        WA_GroundFx.ring(at, { from: 0.3, to: 2, duration: 0.35, color: colors[1], easing: 'expoOut' });
                        this.shake(0.1);
                    }, 0.05 + i * 0.07);
                }
                break;
            }
            case PaladinUltimate.Radiance:
            default: {
                WA_GroundFx.prefab(this.fx.goldDome, c, 3, 2.2);
                WA_GroundFx.prefab(this.fx.bigBlast, c, 2.2, 2.2);
                WA_GroundFx.prefab(this.fx.fireBlast, c, 2, 2);
                WA_GroundFx.streaks(c, { kind: 'crack', radius: 10, color: colors[1], duration: 1.4 });
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    const at = new Vec3(c.x + Math.cos(a) * 4.5, c.y, c.z + Math.sin(a) * 4.5);
                    this.scheduleOnce(() => WA_GroundFx.prefab(this.fx.sunBurst, at, 1.3, 1.2), 0.04 + i * 0.03);
                }
                break;
            }
        }

        if (this.visual) {
            const s = this.visual.scale.clone();
            this.visual.setScale(s.x * 1.15, s.y * 0.88, s.z * 1.15);
            this.scheduleOnce(() => {
                if (this.visual && this.visual.isValid) this.visual.setScale(s);
            }, 0.15);
        }
    }

    private ultHitFx(kind: PaladinUltimate, at: Vec3) {
        switch (kind) {
            case PaladinUltimate.Judgement:
                WA_GroundFx.prefab(this.fx.pillar, at, 0.8, 1.1);
                break;
            case PaladinUltimate.HolyPillar:
                WA_GroundFx.prefab(this.fx.holyBurst, at, 0.9, 1);
                break;
            default:
                WA_GroundFx.prefab(Math.random() < 0.5 ? this.fx.sunBurst : this.fx.fireBlast, at, 0.8, 1.1);
                break;
        }
    }

    private ultColors(kind: PaladinUltimate): Color[] {
        switch (kind) {
            case PaladinUltimate.Judgement:
                return [new Color(255, 235, 150, 255), new Color(200, 230, 255, 255), new Color(255, 255, 255, 255)];
            case PaladinUltimate.Radiance:
                return [new Color(255, 190, 70, 255), new Color(255, 120, 40, 255), new Color(255, 240, 180, 255)];
            case PaladinUltimate.HolyPillar:
            default:
                return [new Color(255, 220, 110, 255), new Color(255, 250, 210, 255), new Color(255, 190, 80, 255)];
        }
    }

    // ---------------------------------------------------------------- tiện ích

    /** Trừ máu + nảy + (tuỳ chọn) đẩy văng ra xa `from` (hoặc theo `dir`). */
    private hit(e: EnemyController, damage: number, from: Vec3, knock: number, dir: Vec3 = null, punch: number = 0.35) {
        if (!e || !e.isValid || !e.isAlive || !e.stats || e.stats.isDead) return;
        const killed = DamageDealer.apply(e.stats, damage, this.stats);
        const status = WA_EnemyStatus.of(e);
        if (!status) return;
        status.punch(punch);
        if (knock <= 0) return;
        if (dir) {
            status.knock(dir, knock, 0.24, killed ? 1.2 : 0.45);
        } else if (from) {
            const p = e.node.worldPosition;
            _b.set(p.x - from.x, 0, p.z - from.z);
            status.knock(_b, knock, 0.24, killed ? 1.2 : 0.45);
        }
    }

    private spark(e: EnemyController) {
        if (!e || !e.isValid) return;
        const p = e.node.worldPosition;
        WA_GroundFx.prefab(this.fx.hitSpark, new Vec3(p.x, p.y + 1, p.z), 0.9, 0.8);
    }

    private shake(amount: number) {
        if (this.shakeScale <= 0) return;
        WA_CameraShake.shake(amount * this.shakeScale);
    }

    private dist2(e: EnemyController, p: Vec3): number {
        const q = e.node.worldPosition;
        return (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z);
    }

    private aliveEnemies(): EnemyController[] {
        const out: EnemyController[] = [];
        const all = EnemyController.all;
        for (let i = 0; i < all.length; i++) {
            const e = all[i];
            if (!e || !e.isValid || !e.isAlive || !e.node || !e.node.activeInHierarchy) continue;
            if (!e.stats || e.stats.isDead) continue;
            out.push(e);
        }
        return out;
    }

    private enemiesInRadius(center: Vec3, radius: number): EnemyController[] {
        const out: EnemyController[] = [];
        for (const e of this.aliveEnemies()) {
            const p = e.node.worldPosition;
            const r = radius + (e.hitRadius || 0) * 0.5;
            const dx = p.x - center.x;
            const dz = p.z - center.z;
            if (dx * dx + dz * dz <= r * r) out.push(e);
        }
        return out;
    }

    private enemiesInArc(center: Vec3, toward: Vec3, radius: number, arcDeg: number): EnemyController[] {
        const fx = toward.x - center.x;
        const fz = toward.z - center.z;
        const fl = Math.sqrt(fx * fx + fz * fz);
        if (fl < 1e-4) return this.enemiesInRadius(center, radius);
        const cosHalf = Math.cos(arcDeg * 0.5 * DEG);
        const out: EnemyController[] = [];
        for (const e of this.enemiesInRadius(center, radius)) {
            const p = e.node.worldPosition;
            const dx = p.x - center.x;
            const dz = p.z - center.z;
            const dl = Math.sqrt(dx * dx + dz * dz);
            if (dl < 0.5 || (dx * fx + dz * fz) / (dl * fl) >= cosHalf) out.push(e);
        }
        return out;
    }

    private nearestEnemy(maxDist: number): EnemyController {
        const pos = this.node.worldPosition;
        let best: EnemyController = null;
        let bestD = maxDist * maxDist;
        for (const e of this.aliveEnemies()) {
            const d = this.dist2(e, pos);
            if (d > bestD) continue;
            bestD = d;
            best = e;
        }
        return best;
    }

    private face(worldPos: Vec3) {
        CharacterFacing.lookAtXZ(this.player ? this.player.facingNode : this.node, worldPos);
    }

    private setVisualHop(h: number) {
        if (!this.visual || this.visual === this.node) return;
        const p = this.visual.position;
        this.visual.setPosition(p.x, this._visualBaseY + h, p.z);
    }

    private lockInput() {
        const gm = GameManager.instance;
        if (!gm || this._lockedInput) return;
        this._lockedInput = true;
        gm.inputLocked = true;
    }

    private releaseInput() {
        if (!this._lockedInput) return;
        this._lockedInput = false;
        const gm = GameManager.instance;
        if (gm) gm.inputLocked = false;
    }
}
