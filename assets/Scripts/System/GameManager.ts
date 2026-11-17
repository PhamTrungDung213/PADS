import { _decorator, Component, Node, SpriteFrame, Vec3, tween, UIOpacity, UITransform, Sprite, Color, Camera, assetManager, view, ResolutionPolicy, Quat } from 'cc';
import { EventManager, GameEvent } from './EventManager';
import { LevelUpConfig } from '../Config/LevelUpConfig';
import { AudioManager } from './AudioManager';
import { SkillPopUp } from '../UI/SkillPopUp';
import { ADCtrl } from '../UI/ADCtrl';
import { CameraFollow } from '../Cam/CamFollow';
import { EnemyPool } from '../Enemies/EnemyPool';
import { DamageTextManager } from './DamageTextManger';
import { ResolutionAdapter } from '../UI/ResolutionAdapter';

const { ccclass, property } = _decorator;

export enum GameFlowState {
    STEP_0_START = 0,
    STEP_1_KILL_2 = 1,
    STEP_2_KILL_5 = 2,
    STEP_3_KILL_5 = 3,
    STEP_4_CLEAR_WIN = 4,
    STEP_5_AD = 5,
}

@ccclass('GameManager')
export class GameManager extends Component {
    public static instance: GameManager = null;

    @property({ type: Node, tooltip: 'Node người chơi (Character)' })
    public playerNode: Node = null;

    @property({ type: Node, tooltip: 'Node bảng chọn kỹ năng (SkillSelectPanel)' })
    public skillPopupNode: Node = null;

    @property({ type: Node, tooltip: 'Node quảng cáo kết thúc (AD)' })
    public adNode: Node = null;

    @property({ type: Node, tooltip: 'Node quản lý sinh quái (SpawnPoint)' })
    public spawnerNode: Node = null;

    @property({ type: SpriteFrame, tooltip: 'Sprite vòng sóng nổ toàn màn (S_Aura_Finish.png)' })
    public finishAuraSprite: SpriteFrame = null;

    public flowState: GameFlowState = GameFlowState.STEP_0_START;
    public totalKills: number = 0;
    public isPaused: boolean = false;

    private _nextMilestoneKills: number = 2;
    private _currentLevelUpStep: number = 0;
    private _isScreenClearTriggered: boolean = false;

    onLoad() {
        GameManager.instance = this;

        // Tải dự phòng sprite Aura Finish nếu chưa được kéo vào Inspector
        if (!this.finishAuraSprite) {
            assetManager.loadAny('c19e33b4-9f37-4bf8-b98b-9c00e9bbcb8a@f9941', (err, asset: SpriteFrame) => {
                if (!err && asset) {
                    this.finishAuraSprite = asset;
                }
            });
        }

        // Đảm bảo ResolutionAdapter được khởi tạo trên node UI
        const uiNode = this.node.scene?.getChildByName('UI');
        if (uiNode && !uiNode.getComponent(ResolutionAdapter)) {
            uiNode.addComponent(ResolutionAdapter);
        }

        // Tự động thích ứng kích thước màn hình Dọc/Ngang
        view.on('canvas-resize', this.onResize, this);
        this.onResize();

        // Đảm bảo cụm Control luôn active ngay từ onLoad
        this.ensureUIActive();
    }

    onDestroy() {
        if (GameManager.instance === this) {
            GameManager.instance = null;
        }
        view.off('canvas-resize', this.onResize, this);
        EventManager.instance.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);
        EventManager.instance.off(GameEvent.SKILL_SELECTED, this.onSkillSelected, this);
    }

    start() {
        if (!this.playerNode) {
            this.playerNode = this.node.scene?.getChildByName('Character');
        }
        if (!this.skillPopupNode) {
            this.skillPopupNode = this.node.scene?.getChildByPath('UI/SkillSelectPanel');
        }
        if (!this.adNode) {
            this.adNode = this.node.scene?.getChildByPath('UI/AD');
        }
        if (!this.spawnerNode) {
            this.spawnerNode = this.node.scene?.getChildByName('SpawnPoint')
                || this.node.scene?.getChildByPath('Building Map/SpawnPoint');
        }

        this.ensureUIActive();

        EventManager.instance.on(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);
        EventManager.instance.on(GameEvent.SKILL_SELECTED, this.onSkillSelected, this);

        const lvlConfig = LevelUpConfig.instance;
        this._nextMilestoneKills = lvlConfig ? lvlConfig.step1Kills : 2;
        this.flowState = GameFlowState.STEP_0_START;
        if (AudioManager.instance) {
            AudioManager.instance.isEnding = false;
        }
    }

    /**
     * BẢO ĐẢM TẤT CẢ UI CỐT LÕI HOẠT ĐỘNG:
     * - Node UI và cụm Control (JoyStick + GuideHand) luôn được bật
     * - SkillSelectPanel và AD mặc định ẩn, chỉ bật khi đúng sự kiện
     */
    public ensureUIActive() {
        const scene = this.node.scene;
        if (!scene) return;

        const uiNode = scene.getChildByName('UI');
        if (uiNode) {
            uiNode.active = true;
            const controlNode = uiNode.getChildByName('Control');
            if (controlNode) {
                // Chỉ bật Control khi chưa hiện AD
                controlNode.active = (this.flowState < GameFlowState.STEP_5_AD);
            }
        }

        if (this.skillPopupNode && this.flowState === GameFlowState.STEP_0_START) {
            this.skillPopupNode.active = false;
        }

        if (this.adNode && this.flowState < GameFlowState.STEP_5_AD) {
            this.adNode.active = false;
        }
    }

    private onResize() {
        if (ResolutionAdapter.instance) {
            ResolutionAdapter.instance.applyOrientation();
            return;
        }
        const size = view.getVisibleSize();
        if (size.width < size.height) {
            view.setResolutionPolicy(ResolutionPolicy.FIXED_WIDTH);
        } else {
            view.setResolutionPolicy(ResolutionPolicy.FIXED_HEIGHT);
        }
    }

    private onEnemyKilled() {
        if (this.flowState >= GameFlowState.STEP_4_CLEAR_WIN) return;
        if (this.isPaused) return;

        this.totalKills++;

        if (this.totalKills >= this._nextMilestoneKills) {
            this.triggerLevelUp();
        }
    }

    /** Tỉ lệ kinh nghiệm hiện tại của bậc cấp độ (0.0 -> 1.0) để nạp vào ExpBar */
    public getExpRatio(): number {
        const lvlConfig = LevelUpConfig.instance;
        const s1 = lvlConfig ? lvlConfig.step1Kills : 2;
        const s2 = lvlConfig ? lvlConfig.step2Kills : 5;
        const s3 = lvlConfig ? lvlConfig.step3Kills : 5;

        if (this._currentLevelUpStep === 0) {
            return Math.min(1.0, this.totalKills / Math.max(1, s1));
        } else if (this._currentLevelUpStep === 1) {
            const killsInStep = Math.max(0, this.totalKills - s1);
            return Math.min(1.0, killsInStep / Math.max(1, s2));
        } else if (this._currentLevelUpStep === 2) {
            const killsInStep = Math.max(0, this.totalKills - (s1 + s2));
            return Math.min(1.0, killsInStep / Math.max(1, s3));
        }
        return 1.0;
    }

    private triggerLevelUp() {
        if (this.flowState >= GameFlowState.STEP_4_CLEAR_WIN) return;
        if (this._currentLevelUpStep >= 3) return;

        this._currentLevelUpStep++;
        this.pauseGame();

        const lvlConfig = LevelUpConfig.instance;

        if (this._currentLevelUpStep === 1) {
            this.flowState = GameFlowState.STEP_1_KILL_2;
            const nextStep = lvlConfig ? lvlConfig.step2Kills : 5;
            this._nextMilestoneKills = this.totalKills + nextStep;
            this.openSkillPopup(1);
        } else if (this._currentLevelUpStep === 2) {
            this.flowState = GameFlowState.STEP_2_KILL_5;
            const nextStep = lvlConfig ? lvlConfig.step3Kills : 5;
            this._nextMilestoneKills = this.totalKills + nextStep;
            this.openSkillPopup(2);
        } else if (this._currentLevelUpStep === 3) {
            this.flowState = GameFlowState.STEP_3_KILL_5;
            this.openSkillPopup(3);
        }
    }

    private openSkillPopup(step: number) {
        if (!this.skillPopupNode) {
            this.skillPopupNode = this.node.scene?.getChildByPath('UI/SkillSelectPanel');
        }

        if (this.skillPopupNode) {
            this.skillPopupNode.active = true;
        }

        EventManager.instance.emit(GameEvent.LEVEL_UP, step);
    }

    private onSkillSelected(skillId: string) {
        this.resumeGame();

        // Mốc cuối cùng: Kích hoạt Screen Clear chắc chắn 100%
        if (skillId === 'holy_screen_clear' || this._currentLevelUpStep >= 3 || this.flowState === GameFlowState.STEP_3_KILL_5) {
            this.triggerScreenClear();
        }
    }

    /** Kích hoạt chiêu nổ toàn màn hình (Screen Clear Level 3) */
    public triggerScreenClear() {
        this.flowState = GameFlowState.STEP_4_CLEAR_WIN;

        // Phát duy nhất 1 âm thanh ĐÙNG chiêu cuối kết thúc (khóa mọi tiếng quái chết lộn xộn)
        if (AudioManager.instance) {
            AudioManager.instance.playFinalExplosion();
        }

        // 1. Rung màn hình camera
        if (CameraFollow.instance) {
            CameraFollow.instance.shake(0.85, 0.5);
        }

        // 2. Hiệu ứng vòng sóng Aura Finish nở rộ từ chân nhân vật lan tỏa toàn màn hình
        this.spawnScreenClearVFX();

        // 3. Tiêu diệt toàn bộ quái còn lại trên map
        this.scheduleOnce(() => {
            if (EnemyPool.instance) {
                const enemies = [...EnemyPool.instance.activeEnemies];
                for (const enemy of enemies) {
                    if (enemy && enemy.isValid && DamageTextManager.instance) {
                        DamageTextManager.instance.showDamage(enemy, 9999, true);
                    }
                }
                EnemyPool.instance.killAll();
            }
            EventManager.instance.emit(GameEvent.SCREEN_CLEAR);
        }, 0.3);

        // 4. Sau khi kết thúc đòn đánh thì mở màn hình AD kết thúc đúng 0.95s
        this.scheduleOnce(() => {
            this.showEndAd();
        }, 0.95);
    }

    /** Tạo hiệu ứng Aura Finish phóng to từ chân nhân vật quét sạch toàn sàn đấu */
    private spawnScreenClearVFX() {
        if (!this.playerNode) {
            this.playerNode = this.node.scene?.getChildByName('Character');
        }
        if (!this.playerNode) return;

        const charPos = this.playerNode.worldPosition;
        const auraNode = new Node('ScreenClearAura');
        auraNode.setParent(this.node.scene);
        auraNode.setWorldPosition(new Vec3(charPos.x, 0.1, charPos.z));

        // Xoay nằm phẳng trên mặt sàn (Euler X = -90)
        auraNode.setWorldRotationFromEuler(-90, 0, 0);
        auraNode.setScale(0.1, 0.1, 0.1);

        const ut = auraNode.addComponent(UITransform);
        ut.setContentSize(256, 256);

        const opacity = auraNode.addComponent(UIOpacity);
        opacity.opacity = 255;

        const sprite = auraNode.addComponent(Sprite);
        if (this.finishAuraSprite) {
            sprite.spriteFrame = this.finishAuraSprite;
        }
        sprite.color = new Color(255, 235, 120, 255);

        // Tween phóng to bao phủ toàn bộ map (scale từ 0.1 lên 35.0)
        tween(auraNode)
            .to(0.7, { scale: new Vec3(35.0, 35.0, 1.0) }, { easing: 'cubicOut' })
            .start();

        tween(opacity)
            .delay(0.4)
            .to(0.35, { opacity: 0 }, { easing: 'quadIn' })
            .call(() => {
                if (auraNode && auraNode.isValid) {
                    auraNode.destroy();
                }
            })
            .start();
    }

    public showEndAd() {
        this.flowState = GameFlowState.STEP_5_AD;

        // Tắt hẳn Joystick khi hiện AD theo đúng yêu cầu
        const uiNode = this.node.scene?.getChildByName('UI');
        if (uiNode) {
            const controlNode = uiNode.getChildByName('Control');
            if (controlNode) {
                controlNode.active = false;
            }
        }

        if (!this.adNode) {
            this.adNode = this.node.scene?.getChildByPath('UI/AD');
        }

        if (this.adNode) {
            this.adNode.active = true;
            const adCtrl = this.adNode.getComponent(ADCtrl);
            if (adCtrl) {
                adCtrl.showAD();
            }
        }

        EventManager.instance.emit(GameEvent.GAME_WIN);
    }

    public pauseGame() {
        this.isPaused = true;
    }

    public resumeGame() {
        this.isPaused = false;
    }
}
