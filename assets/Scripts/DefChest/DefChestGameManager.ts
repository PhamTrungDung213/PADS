import { _decorator, Component, Color } from 'cc';
import { EventManager } from '../System/EventManager';
import { AudioManager } from '../System/AudioManager';
import { PlayableAdsController } from '../ADS/PlayableAdsController';
import { GuideHand } from '../UI/GuideHand';
import { ADCtrl } from '../UI/ADCtrl';
import { ResolutionAdapter } from '../UI/ResolutionAdapter';
import { DefChestConfig, DefChestUpgradeTier } from './DefChestConfig';
import { DefChestArenaBounds } from './DefChestArenaBounds';
import { DefChestCameraController } from './DefChestCameraController';
import {
    DefChestTreasureChest,
    DEFCHEST_EVENT_CHEST_EMPTY,
} from './DefChestTreasureChest';
import {
    DefChestSquadController,
    DEFCHEST_EVENT_ALL_HEROES_DEAD,
    DEFCHEST_EVENT_PLAYER_FIRST_MOVE,
} from './DefChestSquadController';
import { DefChestEnemySpawner } from './DefChestEnemySpawner';
import { DefChestSkillPopup } from './DefChestSkillPopup';
import { DefChestHUD } from './DefChestHUD';

const { ccclass, property } = _decorator;

export enum DefChestPhase {
    BOOT = 0,
    WAVE_1_A = 1,
    UPGRADE_1_EPIC = 2,
    WAVE_2_B = 3,
    UPGRADE_2_LEGENDARY = 4,
    WAVE_3_C_FINAL = 5,
    ENDED_WIN = 6,
    ENDED_LOSE = 7,
}

const GRP_GM_SYS = { name: '1. Hệ Thống & Cấu Hình (System)', id: 'gm_sys', displayOrder: 1, style: 'section' };
const GRP_GM_WORLD = { name: '2. Gameplay 3D (Ta / Địch / Rương / Map)', id: 'gm_world', displayOrder: 2, style: 'section' };
const GRP_GM_UI = { name: '3. Giao Diện UI & Ads', id: 'gm_ui', displayOrder: 3, style: 'section' };

const C_WAVE_1 = new Color(255, 236, 120, 255);
const C_WAVE_2 = new Color(255, 214, 110, 255);
const C_WAVE_3 = new Color(255, 96, 86, 255);
const C_VICTORY = new Color(139, 255, 122, 255);
const C_DEFEAT = new Color(255, 85, 85, 255);

/** Điều phối vòng lặp 3 Wave, nâng cấp kỹ năng và kết thúc Thắng/Thua. */
@ccclass('DefChestGameManager')
export class DefChestGameManager extends Component {
    public static instance: DefChestGameManager | null = null;

    @property({ group: GRP_GM_SYS, type: DefChestConfig, tooltip: 'Bảng cấu hình tổng (System/01_Config_ThongSo)' })
    public config: DefChestConfig = null;

    @property({ group: GRP_GM_SYS, type: AudioManager, tooltip: 'Hệ thống âm thanh (System/03_Audio_AmThanh)' })
    public audio: AudioManager = null;

    @property({ group: GRP_GM_SYS, type: PlayableAdsController, tooltip: 'Bộ điều khiển mạng quảng cáo (System/04_Ad_QuangCao)' })
    public playableAdsController: PlayableAdsController = null;

    @property({ group: GRP_GM_WORLD, type: DefChestSquadController, tooltip: 'Đội hình 3 nhân vật phe Ta (Character)' })
    public squadController: DefChestSquadController = null;

    @property({ group: GRP_GM_WORLD, type: DefChestEnemySpawner, tooltip: 'Bộ sinh quái 3 hướng phe Địch (Map/SpawnPoints)' })
    public enemySpawner: DefChestEnemySpawner = null;

    @property({ group: GRP_GM_WORLD, type: DefChestTreasureChest, tooltip: 'Rương Kho Báu cần bảo vệ (Map/BaseClearChest)' })
    public treasureChest: DefChestTreasureChest = null;

    @property({ group: GRP_GM_WORLD, type: DefChestArenaBounds, tooltip: 'Ranh giới đảo & vật cản (Map/ArenaBounds)' })
    public arenaBounds: DefChestArenaBounds = null;

    @property({ group: GRP_GM_WORLD, type: DefChestCameraController, tooltip: 'Camera động theo đội hình (Main Camera)' })
    public cameraController: DefChestCameraController = null;

    @property({ group: GRP_GM_UI, type: DefChestHUD, tooltip: 'HUD mục tiêu & Banner cảnh báo Phase (UI/TreasureHUD)' })
    public hud: DefChestHUD = null;

    @property({ group: GRP_GM_UI, type: DefChestSkillPopup, tooltip: 'Popup chọn kỹ năng nâng cấp (UI/SkillSelectPanel)' })
    public skillPopup: DefChestSkillPopup = null;

    @property({ group: GRP_GM_UI, type: ADCtrl, tooltip: 'Bộ điều khiển Popup Thắng/Thua (UI/AD)' })
    public adCtrl: ADCtrl = null;

    @property({ group: GRP_GM_UI, type: ResolutionAdapter, tooltip: 'Bộ thích ứng màn hình ngang/dọc (UI)' })
    public resolutionAdapter: ResolutionAdapter = null;

    @property({ group: GRP_GM_UI, type: GuideHand, tooltip: 'Bàn tay hướng dẫn kéo Joystick (UI/Control/GuideHand)' })
    public guideHand: GuideHand = null;

    public currentPhase: DefChestPhase = DefChestPhase.BOOT;
    private _isGameEnded: boolean = false;
    private _pendingWaveTimer: number = 0;
    private _pendingWaveCb: (() => void) | null = null;
    private _pendingEndAdTimer: number = 0;
    private _pendingEndAdMode: 'NONE' | 'WIN' | 'LOSE' = 'NONE';

    protected onLoad(): void {
        DefChestGameManager.instance = this;
        this.resolveSystemReferences();

        EventManager.instance.on(DEFCHEST_EVENT_CHEST_EMPTY, this.onTreasureDepleted, this);
        EventManager.instance.on(DEFCHEST_EVENT_ALL_HEROES_DEAD, this.onAllHeroesDead, this);
        EventManager.instance.on(DEFCHEST_EVENT_PLAYER_FIRST_MOVE, this.onPlayerFirstMove, this);
    }

    protected start(): void {
        this.resolveSystemReferences();

        // Khởi tạo Đội hình 3 Hero & Spawner 3 hướng
        if (this.squadController && this.enemySpawner) {
            this.squadController.initSquad(() => this.enemySpawner.activeEnemies);
            this.enemySpawner.initSpawner({
                getHeroes: () => this.squadController.heroes,
                onWaveCleared: (waveIndex: number) => this.onWaveCleared(waveIndex),
                onProgress: (killed: number, total: number, waveIndex: number) => {
                    this.hud?.setWaveInfo(waveIndex, killed, total);
                },
            });
        }

        // Bật bàn tay hướng dẫn kéo Joystick lúc mở màn
        if (this.guideHand) {
            this.guideHand.node.active = true;
            this.guideHand.show();
        }

        // Đảm bảo Popup chọn skill ẩn lúc đầu
        if (this.skillPopup && this.skillPopup.node) {
            this.skillPopup.node.active = false;
        }

        // Bắt đầu ngay Giai đoạn 1 (Wave A: 5 quái từ 1 hướng ngẫu nhiên)
        this.startPhaseWave1();
    }

    protected onDestroy(): void {
        this._pendingWaveTimer = 0;
        this._pendingWaveCb = null;
        this._pendingEndAdTimer = 0;
        this._pendingEndAdMode = 'NONE';
        this.unscheduleAllCallbacks();
        EventManager.instance.off(DEFCHEST_EVENT_CHEST_EMPTY, this.onTreasureDepleted, this);
        EventManager.instance.off(DEFCHEST_EVENT_ALL_HEROES_DEAD, this.onAllHeroesDead, this);
        EventManager.instance.off(DEFCHEST_EVENT_PLAYER_FIRST_MOVE, this.onPlayerFirstMove, this);
        if (DefChestGameManager.instance === this) {
            DefChestGameManager.instance = null;
        }
    }

    protected update(dt: number): void {
        // Bộ đếm khởi động Wave (sau nhịp tín hiệu Banner cảnh báo)
        if (this._pendingWaveCb && !this._isGameEnded) {
            this._pendingWaveTimer -= dt;
            if (this._pendingWaveTimer <= 0) {
                const cb = this._pendingWaveCb;
                this._pendingWaveCb = null;
                cb();
            }
        }

        // Bộ đếm bật Popup AD kết thúc (Win / Lose) — chạy bằng update(dt) tuyệt đối không bị mất callback
        if (this._pendingEndAdMode !== 'NONE') {
            this._pendingEndAdTimer -= dt;
            if (this._pendingEndAdTimer <= 0) {
                const mode = this._pendingEndAdMode;
                this._pendingEndAdMode = 'NONE';
                this.openEndAdPopup(mode === 'WIN');
            }
        }
    }

    private queueWaveSpawnAfterBanner(delaySec: number, cb: () => void): void {
        this._pendingWaveTimer = Math.max(0, delaySec);
        this._pendingWaveCb = cb;
    }

    private hideGameplayControlsForEnding(): void {
        if (this.guideHand) {
            this.guideHand.hide();
            this.guideHand.node.active = false;
        }
        if (this.skillPopup && this.skillPopup.node) {
            this.skillPopup.node.active = false;
        }
        const controlNode = this.node.scene?.getChildByPath('UI/Control');
        if (controlNode) {
            controlNode.active = false;
        }
    }

    private openEndAdPopup(isWin: boolean): void {
        this.resolveSystemReferences();
        if (!this.adCtrl && this.node.scene) {
            const adNode = this.node.scene.getChildByPath('UI/AD');
            if (adNode) this.adCtrl = adNode.getComponent(ADCtrl);
        }
        if (!this.adCtrl) return;
        if (isWin) {
            this.adCtrl.showAD();
        } else {
            this.adCtrl.showLoseAD();
        }
    }

    private resolveSystemReferences(): void {
        if (!this.config) this.config = DefChestConfig.instance;
        if (!this.audio) this.audio = AudioManager.instance;
        if (!this.arenaBounds) this.arenaBounds = DefChestArenaBounds.instance;
        if (!this.cameraController) this.cameraController = DefChestCameraController.instance;
        if (!this.treasureChest) this.treasureChest = DefChestTreasureChest.instance;
        if (!this.squadController) this.squadController = DefChestSquadController.instance;
        if (!this.enemySpawner) this.enemySpawner = DefChestEnemySpawner.instance;
        if (!this.skillPopup) this.skillPopup = DefChestSkillPopup.instance;
        if (!this.hud) this.hud = DefChestHUD.instance;
        if (!this.adCtrl) {
            this.adCtrl = ADCtrl.instance
                || this.node.scene?.getChildByPath('UI/AD')?.getComponent(ADCtrl)
                || null;
        }
        if (!this.resolutionAdapter) this.resolutionAdapter = ResolutionAdapter.instance;
        if (!this.playableAdsController) {
            this.playableAdsController = this.getComponent(PlayableAdsController);
        }
        if (!this.guideHand && this.node.scene) {
            const ghNode = this.node.scene.getChildByPath('UI/Control/GuideHand')
                || this.node.scene.getChildByPath('UI/GuildHand');
            if (ghNode) this.guideHand = ghNode.getComponent(GuideHand);
        }
    }

    private onPlayerFirstMove(): void {
        if (this.guideHand) {
            this.guideHand.hide();
        }
    }

    // --- Giai đoạn 1..3 & Nâng cấp ---

    private startPhaseWave1(): void {
        if (this._isGameEnded) return;
        this.currentPhase = DefChestPhase.WAVE_1_A;
        if (this.squadController) this.squadController.isInputLocked = false;
        const wave1Total = this.config ? this.config.wave1BasicCount : 5;
        this.hud?.setWaveInfo(1, 0, wave1Total);
        this.hud?.showBannerAnnouncement('DEFEND THE TREASURE - WAVE 1', C_WAVE_1, 2.6, 'GOLD');
        this.queueWaveSpawnAfterBanner(0.45, () => {
            if (this._isGameEnded || !this.isValid || this.currentPhase !== DefChestPhase.WAVE_1_A) return;
            this.enemySpawner?.startWave1();
        });
    }

    private startPhaseUpgrade1Epic(): void {
        if (this._isGameEnded) return;
        this.currentPhase = DefChestPhase.UPGRADE_1_EPIC;
        if (this.squadController) this.squadController.isInputLocked = true;
        this.guideHand?.hide();

        if (this.skillPopup) {
            this.skillPopup.openSequentialUpgrade(
                DefChestUpgradeTier.EPIC,
                (role, option) => this.squadController?.applySkillUpgradeToRole(role, option.id),
                () => this.startPhaseWave2()
            );
        } else {
            this.startPhaseWave2();
        }
    }

    private startPhaseWave2(): void {
        if (this._isGameEnded) return;
        this.currentPhase = DefChestPhase.WAVE_2_B;
        if (this.squadController) this.squadController.isInputLocked = false;
        const wave2Total = this.config ? (this.config.wave2DirectionCount * this.config.wave2BasicPerDirection) : 10;
        this.audio?.playWarning();
        this.hud?.setWaveInfo(2, 0, wave2Total);
        this.hud?.showBannerAnnouncement('WAVE 2', C_WAVE_2, 2.4, 'ORANGE');
        this.queueWaveSpawnAfterBanner(0.65, () => {
            if (this._isGameEnded || !this.isValid || this.currentPhase !== DefChestPhase.WAVE_2_B) return;
            this.enemySpawner?.startWave2();
        });
    }

    private startPhaseUpgrade2Legendary(): void {
        if (this._isGameEnded) return;
        this.currentPhase = DefChestPhase.UPGRADE_2_LEGENDARY;
        if (this.squadController) this.squadController.isInputLocked = true;

        if (this.skillPopup) {
            this.skillPopup.openSequentialUpgrade(
                DefChestUpgradeTier.LEGENDARY,
                (role, option) => this.squadController?.applySkillUpgradeToRole(role, option.id),
                () => this.startPhaseWave3Final()
            );
        } else {
            this.startPhaseWave3Final();
        }
    }

    private startPhaseWave3Final(): void {
        if (this._isGameEnded) return;
        this.currentPhase = DefChestPhase.WAVE_3_C_FINAL;
        if (this.squadController) this.squadController.isInputLocked = false;

        const wave3Total = this.config
            ? (this.config.wave3EliteCount + 3 * this.config.wave3BasicPerDirection)
            : 16;
        this.audio?.playWarning();
        this.cameraController?.shake(0.32, 0.22);
        this.hud?.setWaveInfo(3, 0, wave3Total);
        this.hud?.showBannerAnnouncement('LAST WAVE', C_WAVE_3, 2.9, 'RED');
        this.queueWaveSpawnAfterBanner(0.85, () => {
            if (this._isGameEnded || !this.isValid || this.currentPhase !== DefChestPhase.WAVE_3_C_FINAL) return;
            this.enemySpawner?.startWave3();
        });
    }

    private onWaveCleared(waveIndex: number): void {
        if (this._isGameEnded) return;
        if (waveIndex === 1) this.startPhaseUpgrade1Epic();
        else if (waveIndex === 2) this.startPhaseUpgrade2Legendary();
        else if (waveIndex >= 3) this.triggerVictory();
    }

    // --- Kết thúc Thắng / Thua ---

    public triggerVictory(): void {
        if (this._isGameEnded) return;
        this._isGameEnded = true;
        this.currentPhase = DefChestPhase.ENDED_WIN;
        this._pendingWaveCb = null;
        this._pendingWaveTimer = 0;

        if (this.audio) this.audio.isEnding = true;
        this.hideGameplayControlsForEnding();
        this.enemySpawner?.freezeAllEnemies();
        this.hud?.showBannerAnnouncement('VICTORY', C_VICTORY, 1.55, 'VICTORY');
        this.squadController?.startVictoryCelebration();
        this.treasureChest?.playWinOpenAndGoldFountain();

        this._pendingEndAdMode = 'WIN';
        this._pendingEndAdTimer = 1.65;
    }

    private onTreasureDepleted(): void {
        this.triggerDefeat('YOU LOSE THE TREASURE');
    }

    private onAllHeroesDead(): void {
        this.triggerDefeat('YOU LOSE THE TREASURE');
    }

    public triggerDefeat(alertMessage: string = 'YOU LOSE THE TREASURE'): void {
        if (this._isGameEnded) return;
        this._isGameEnded = true;
        this.currentPhase = DefChestPhase.ENDED_LOSE;
        this._pendingWaveCb = null;
        this._pendingWaveTimer = 0;

        if (this.audio) this.audio.isEnding = true;
        this.hideGameplayControlsForEnding();
        this.squadController?.forceDefeatAllHeroes();
        this.enemySpawner?.startEnemiesVictoryCelebration();
        this.hud?.showBannerAnnouncement(alertMessage, C_DEFEAT, 1.45, 'DEFEAT');
        this.cameraController?.shake(0.38, 0.30);
        this.treasureChest?.playLoseShatter();

        this._pendingEndAdMode = 'LOSE';
        this._pendingEndAdTimer = 1.55;
    }
}
