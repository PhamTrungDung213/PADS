import { _decorator, Component, Node, Vec3, CCFloat } from 'cc';
import { EnemyAnimation } from './EnemyAnimation';
import { EnemyState, EnemyStateEnum } from './EnemyState';
import { EnemyMovement } from './EnemyMovement';
import { EnemyConfig } from '../Config/EnemyConfig';
import { EnemyPool } from './EnemyPool';
import { GameManager } from '../System/GameManager';
import { AudioManager } from '../System/AudioManager';
import { EventManager, GameEvent } from '../System/EventManager';
import { CharStats } from '../Char/CharStats';

const { ccclass, property } = _decorator;

@ccclass('Enemy')
export class Enemy extends Component {
    @property({ type: EnemyMovement, tooltip: 'Script quản lý di chuyển & xoay mặt của quái' })
    public movement: EnemyMovement = null;

    @property({ type: EnemyAnimation, tooltip: 'Script quản lý animation của quái' })
    public enemyAnim: EnemyAnimation = null;

    @property({ type: EnemyState, tooltip: 'Script quản lý trạng thái FSM của quái' })
    public enemyState: EnemyState = null;

    @property({ type: CCFloat, tooltip: 'Máu tối đa' })
    public maxHp: number = 20;

    @property({ type: CCFloat, tooltip: 'Sát thương lên Hero mỗi đòn đánh' })
    public damage: number = 2;

    @property({ type: CCFloat, tooltip: 'Khoảng cách cự ly tấn công Hero (m)' })
    public attackRange: number = 1.1;

    @property({ type: CCFloat, tooltip: 'Hồi chiêu đòn đánh quái (giây)' })
    public attackCooldown: number = 0.8;

    @property({ type: CCFloat, tooltip: 'Tốc độ hoạt ảnh chém kiếm của quái (hệ số x1.0, x1.5...)' })
    public attackAnimSpeed: number = 1.3;

    public currentHp: number = 20;
    public isAlive: boolean = true;
    public isStunned: boolean = false;

    private _attackTimer: number = 0;
    private _stunTimer: number = 0;
    private _isAttacking: boolean = false;
    private _enemyVFX: any = null;

    private _myPos: Vec3 = new Vec3();
    private _heroPos: Vec3 = new Vec3();

    // =========================================================================
    // GETTER / SETTER ĐỒNG BỘ VỚI ENEMYMOVEMENT (ĐẢM BẢO INSPECTOR & CONFIG CŨ)
    // =========================================================================
    @property({ type: CCFloat, tooltip: 'Tốc độ di chuyển (m/s)' })
    public get moveSpeed(): number {
        return this.movement ? this.movement.moveSpeed : this._moveSpeed;
    }
    public set moveSpeed(val: number) {
        this._moveSpeed = val;
        if (this.movement) this.movement.moveSpeed = val;
    }
    private _moveSpeed: number = 3.0;

    @property({ type: CCFloat, tooltip: 'Tốc độ quay hướng mặt quái' })
    public get rotateSpeed(): number {
        return this.movement ? this.movement.rotateSpeed : this._rotateSpeed;
    }
    public set rotateSpeed(val: number) {
        this._rotateSpeed = val;
        if (this.movement) this.movement.rotateSpeed = val;
    }
    private _rotateSpeed: number = 7.0;

    @property({ type: CCFloat, tooltip: 'Khoảng cách dừng trước Hero' })
    public get stopDistance(): number {
        return this.movement ? this.movement.stopDistance : this._stopDistance;
    }
    public set stopDistance(val: number) {
        this._stopDistance = val;
        if (this.movement) this.movement.stopDistance = val;
    }
    private _stopDistance: number = 0.85;

    @property({ type: CCFloat, tooltip: 'Bán kính né quái khác để không chụm một cục (m)' })
    public get separationRadius(): number {
        return this.movement ? this.movement.separationRadius : this._separationRadius;
    }
    public set separationRadius(val: number) {
        this._separationRadius = val;
        if (this.movement) this.movement.separationRadius = val;
    }
    private _separationRadius: number = 1.6;

    onLoad() {
        if (!this.movement) {
            this.movement = this.getComponent(EnemyMovement) || this.addComponent(EnemyMovement);
        }
        if (!this.enemyAnim) {
            this.enemyAnim = this.getComponent(EnemyAnimation);
        }
        if (!this.enemyState) {
            this.enemyState = this.getComponent(EnemyState);
        }
        this._enemyVFX = this.getComponent('EnemyVFX');

        this.applyConfig();
        this.initEnemy();
    }

    /**
     * Nạp toàn bộ thông số từ EnemyConfig (Stats & Movement)
     */
    public applyConfig() {
        const config = EnemyConfig.instance;
        if (config) {
            if (config.maxHp > 0) this.maxHp = config.maxHp;
            if (config.damage > 0) this.damage = config.damage;
            if (config.attackCooldown > 0) this.attackCooldown = config.attackCooldown;
            if (config.attackAnimSpeed > 0) this.attackAnimSpeed = config.attackAnimSpeed;
            if (config.attackRange > 0) this.attackRange = config.attackRange;
            if (config.moveSpeed > 0) this.moveSpeed = config.moveSpeed;
            if (config.rotateSpeed > 0) this.rotateSpeed = config.rotateSpeed;
            if (config.stopDistance > 0) this.stopDistance = config.stopDistance;
            if (config.separationRadius > 0) this.separationRadius = config.separationRadius;

            if (this.movement) {
                this.movement.applyConfig();
            }
        }
    }

    public initEnemy() {
        this.applyConfig();
        this.currentHp = this.maxHp;
        this.isAlive = true;
        this.isStunned = false;
        this._stunTimer = 0;
        this._isAttacking = false;

        // Đòn đánh sẵn sàng ngay khi spawn để khi chạm Hero là ra đòn được ngay, không bị đứng trơ 1.5s
        this._attackTimer = this.attackCooldown;
        if (!this._enemyVFX) {
            this._enemyVFX = this.getComponent('EnemyVFX');
        }

        if (this.movement) {
            this.movement.initMovement();
        }

        if (this.enemyState) {
            this.enemyState.setState(EnemyStateEnum.CHASE);
        }
        if (this.enemyAnim) {
            this.enemyAnim.playRun();
        }

        const hpComp = this.getComponent('EnemyHP') as any;
        if (hpComp && typeof hpComp.setHp === 'function') {
            hpComp.setHp(this.maxHp, this.maxHp);
        }

        // Kích hoạt hiển thị thanh máu quái ngay lập tức khi xuất hiện
        const barAttacher = this.getComponent('BarAttacher') as any
            || this.getComponent('Test') as any;
        if (barAttacher) {
            if (typeof barAttacher.resetBar === 'function') {
                barAttacher.resetBar();
            }
            if (typeof barAttacher.setHpRatio === 'function') {
                barAttacher.setHpRatio(1.0);
            }
        }
    }

    public takeDamage(damage: number, isCrit: boolean = false, attacker: Node = null, isAura: boolean = false): boolean {
        if (!this.isAlive) return true;

        this.currentHp = Math.max(0, this.currentHp - damage);

        if (this._enemyVFX) {
            this._enemyVFX.playHit(attacker);
        }

        // Đồng bộ component EnemyHP
        const hpComp = this.getComponent('EnemyHP') as any;
        if (hpComp && typeof hpComp.setHp === 'function') {
            hpComp.setHp(this.currentHp, this.maxHp);
        }

        // Cập nhật ngay lập tức lên BarAttacher
        const barAttacher = this.getComponent('BarAttacher') as any
            || this.getComponent('Test') as any;
        if (barAttacher && typeof barAttacher.setHpRatio === 'function') {
            barAttacher.setHpRatio(this.maxHp > 0 ? this.currentHp / this.maxHp : 0);
        }

        // QUAN TRỌNG: Hiệu ứng Bonk (choáng) CHỈ kích hoạt từ đòn chém cận chiến trực tiếp của kiếm!
        // Tuyệt đối không kích hoạt từ Aura đốt định kỳ (tránh làm quái bị đơ cứng liên tục)
        if (!isAura && attacker) {
            const combatComp = attacker.getComponent('CharacterCombat') as any;
            if (combatComp && combatComp.hasBonkStun) {
                this.applyStun(0.8);
            }
        }

        if (this.currentHp <= 0) {
            this.die();
            return true;
        }
        return false;
    }

    public applyStun(duration: number) {
        this.isStunned = true;
        this._stunTimer = duration;
        this._isAttacking = false;

        if (this.movement) {
            this.movement.lockMovement(true);
        }
        if (this.enemyState) {
            this.enemyState.setState(EnemyStateEnum.STUN);
        }
        if (this.enemyAnim) {
            this.enemyAnim.playHit();
        }
    }

    public die(immediateRecycle: boolean = false) {
        if (!this.isAlive) return;
        this.isAlive = false;
        this._isAttacking = false;

        if (this.movement) {
            this.movement.lockMovement(true);
        }
        if (this.enemyState) {
            this.enemyState.setState(EnemyStateEnum.DIE);
        }

        if (this._enemyVFX && this._enemyVFX.deathClip) {
            // Sẽ phát clip riêng của quái qua enemyVFX.playDeath()
        } else if (AudioManager.instance) {
            AudioManager.instance.playEnemyDie();
        }

        const barAttacher = this.getComponent('BarAttacher') as any
            || this.getComponent('Test') as any;
        if (barAttacher && typeof barAttacher.hideBar === 'function') {
            barAttacher.hideBar();
        }

        EventManager.instance.emit(GameEvent.ENEMY_KILLED);

        if (this._enemyVFX) {
            this._enemyVFX.playDeath();
        }

        if (immediateRecycle) {
            if (EnemyPool.instance) {
                EnemyPool.instance.recycle(this.node);
            }
            return;
        }

        if (this.enemyAnim) {
            this.enemyAnim.playDie(() => {
                if (EnemyPool.instance) {
                    EnemyPool.instance.recycle(this.node);
                }
            });
        } else {
            this.scheduleOnce(() => {
                if (EnemyPool.instance) {
                    EnemyPool.instance.recycle(this.node);
                }
            }, 0.5);
        }
    }

    update(deltaTime: number) {
        if (!this.isAlive) return;
        if (GameManager.instance && GameManager.instance.isPaused) return;

        // Xử lý bị choáng
        if (this.isStunned) {
            this._stunTimer -= deltaTime;
            if (this._stunTimer <= 0) {
                this.isStunned = false;
                if (this.movement) this.movement.lockMovement(false);
                if (this.enemyState) this.enemyState.setState(EnemyStateEnum.CHASE);
                if (this.enemyAnim) this.enemyAnim.playRun();
            }
            return;
        }

        // =====================================================================
        // 1. DI CHUYỂN & XOAY HƯỚNG (DO ENEMYMOVEMENT PHỤ TRÁCH)
        // =====================================================================
        let isMoving = false;
        if (this.movement) {
            isMoving = this.movement.updateMovement(deltaTime, this.isAlive);
        }

        // =====================================================================
        // 2. LOGIC TẤN CÔNG & PHẢN HỒI KHI NGƯỜI CHƠI DI CHUYỂN
        // =====================================================================
        const heroNode = this.movement ? this.movement.getTarget() : null;
        if (!heroNode || !heroNode.isValid) return;

        this.node.getWorldPosition(this._myPos);
        heroNode.getWorldPosition(this._heroPos);

        const dx = this._heroPos.x - this._myPos.x;
        const dz = this._heroPos.z - this._myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Đang trong phạm vi tấn công
        const effectiveCooldown = (EnemyConfig.instance && EnemyConfig.instance.attackCooldown > 0)
            ? EnemyConfig.instance.attackCooldown
            : this.attackCooldown;

        if (dist <= this.attackRange) {
            // Nếu hồi chiêu xong và chưa đang vung đòn: Ra đòn ngay lập tức
            if (this._attackTimer >= effectiveCooldown && !this._isAttacking) {
                this.executeAttack(heroNode);
            } else {
                this._attackTimer += deltaTime;

                if (!this._isAttacking) {
                    if (this.enemyState && this.enemyState.currentState !== EnemyStateEnum.CHASE) {
                        this.enemyState.setState(EnemyStateEnum.CHASE);
                    }
                    // LUÔN DUY TRÌ HOẠT ẢNH SỐNG ĐỘNG (PLAYRUN), KHÔNG BAO GIỜ BỊ ĐƠ CỨNG KHI ĐỨNG CHỜ HỒI CHIÊU!
                    if (this.enemyAnim) {
                        this.enemyAnim.playRun();
                    }
                }
            }
        } else {
            // Ngoài cự ly tấn công: Luôn tăng hồi chiêu và đảm bảo trạng thái chạy đuổi theo Hero
            this._attackTimer += deltaTime;

            if (!this._isAttacking) {
                if (this.enemyState && this.enemyState.currentState !== EnemyStateEnum.CHASE) {
                    this.enemyState.setState(EnemyStateEnum.CHASE);
                }
                if (this.enemyAnim) {
                    this.enemyAnim.playRun();
                }
            }
        }
    }

    /**
     * Thực hiện đòn tấn công: Tốc độ và hồi chiêu điều khiển linh hoạt qua EnemyConfig
     */
    private executeAttack(heroNode: Node) {
        this._isAttacking = true;
        this._attackTimer = 0;

        // Khóa di chuyển trong thời gian vung kiếm
        if (this.movement) {
            this.movement.lockMovement(true);
        }
        if (this.enemyState) {
            this.enemyState.setState(EnemyStateEnum.ATTACK);
        }

        if (this._enemyVFX) {
            this._enemyVFX.playAttack(heroNode);
        }

        // Gây sát thương lên Hero
        const heroStats = heroNode.getComponent(CharStats);
        if (heroStats) {
            heroStats.takeDamage(this.damage);
        }

        // Tốc độ vung kiếm lấy từ EnemyConfig
        const animSpeed = (EnemyConfig.instance && EnemyConfig.instance.attackAnimSpeed > 0)
            ? EnemyConfig.instance.attackAnimSpeed
            : this.attackAnimSpeed;

        const baseDuration = 0.45;
        const swingDuration = Math.max(0.12, baseDuration / Math.max(0.1, animSpeed));

        let attackEnded = false;
        const finishAttack = () => {
            if (attackEnded) return;
            attackEnded = true;
            this._isAttacking = false;
            if (this.movement) {
                this.movement.lockMovement(false);
            }
            if (this.isAlive) {
                if (this.enemyState) {
                    this.enemyState.setState(EnemyStateEnum.CHASE);
                }
                if (this.enemyAnim) {
                    this.enemyAnim.playRun();
                }
            }
        };

        // Phát animation tấn công kèm callback khi kết thúc nhát chém
        if (this.enemyAnim) {
            this.enemyAnim.playAttack(finishAttack, animSpeed);
        } else {
            this.scheduleOnce(finishAttack, swingDuration);
        }

        // Timer an toàn (safety fallback): Bảo đảm tuyệt đối không bao giờ bị kẹt _isAttacking
        this.scheduleOnce(() => {
            if (this._isAttacking) {
                finishAttack();
            }
        }, swingDuration + 0.1);
    }
}
