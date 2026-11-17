import { _decorator, Component, Node, Vec3 } from 'cc';
import { LCHConfig } from './LCHConfig';
import { LCHRoomBoundary, LCHBoundaryPhase } from './LCHRoomBoundary';
import { LCHCameraController } from './LCHCameraController';
import { LCHDoorController } from './LCHDoorController';
import { LCHWarriorStats } from './LCHWarriorStats';
import { LCHWarriorMove } from './LCHWarriorMove';
import { LCHEnemyMove } from './LCHEnemyMove';
import { LCHEnemyCombat } from './LCHEnemyCombat';
import { LCHFireball } from './LCHFireball';
import { LCHChest } from './LCHChest';
import { LCHWeaponUpPopup } from './LCHWeaponUpPopup';
import { ADCtrl } from '../UI/ADCtrl';
import { GuideHand } from '../UI/GuideHand';
import { EventManager, GameEvent } from '../System/EventManager';

const { ccclass, property } = _decorator;

export enum LCHGameState {
    INTRO_ROOM1 = 0,
    ROOM1_COMBAT = 1,
    ROOM1_CHEST_WAIT = 2,
    ROOM1_WEAPON_POPUP = 3,
    WALK_TO_ROOM2 = 4,
    ROOM2_COMBAT = 5,
    ROOM2_CHEST_WAIT = 6,
    ROOM2_WEAPON_POPUP = 7,
    WALK_TO_ROOM3 = 8,
    ROOM3_CAM_PAN = 9,
    ROOM3_CHEST_WAIT = 10,
    ROOM3_AMBUSH = 11,
    HERO_DEAD_AD = 12,
}

@ccclass('LCHFlowManager')
export class LCHFlowManager extends Component {
    public static instance: LCHFlowManager = null;

    @property({ type: LCHConfig, tooltip: 'File cấu hình LCHConfig (System/Config)' })
    public config: LCHConfig = null;

    @property({ type: LCHRoomBoundary, tooltip: 'Giới hạn tường phòng LCHRoomBoundary' })
    public boundary: LCHRoomBoundary = null;

    @property({ type: LCHCameraController, tooltip: 'Điều khiển Camera 3 vị trí cố định + Follow Phòng 3' })
    public cameraCtrl: LCHCameraController = null;

    @property({ type: LCHDoorController, tooltip: 'Điều khiển 4 cặp cửa đá (LCHDoorController)' })
    public doorCtrl: LCHDoorController = null;

    @property({ type: LCHWarriorStats, tooltip: 'Thông số & vũ khí của Character_Warrior' })
    public warriorStats: LCHWarriorStats = null;

    @property({ type: LCHWarriorMove, tooltip: 'Di chuyển của Character_Warrior' })
    public warriorMove: LCHWarriorMove = null;

    @property({ type: LCHFireball, tooltip: 'Quản lý đạn cầu lửa của Mage (LCHFireball)' })
    public fireballMgr: LCHFireball = null;

    @property({ type: LCHChest, tooltip: 'Rương 1 (Map/Chest/Chest0)' })
    public chest0: LCHChest = null;

    @property({ type: LCHChest, tooltip: 'Rương 2 (Map/Chest/Chest1)' })
    public chest1: LCHChest = null;

    @property({ type: LCHChest, tooltip: 'Rương bẫy Phòng 3 (Map/Chest/Chest2)' })
    public chest2: LCHChest = null;

    @property({ type: LCHWeaponUpPopup, tooltip: 'UI nhận vũ khí (UI/WeaponUp)' })
    public weaponUpPopup: LCHWeaponUpPopup = null;

    @property({ type: ADCtrl, tooltip: 'UI Quảng cáo kết thúc (UI/AD)' })
    public adCtrl: ADCtrl = null;

    @property({ type: GuideHand, tooltip: 'Bàn tay hướng dẫn kéo Joystick (UI/Control/GuideHand)' })
    public guideHand: GuideHand = null;

    @property({ type: Node, tooltip: 'Bàn tay chỉ vào Hòm trên UI (UI/ChestTapGuide)' })
    public chestTapGuideNode: Node = null;

    @property({ type: Node, tooltip: 'Điểm xuất hiện quái ùa vào ở Phòng 3 (Map/Enemy/LastSpawn)' })
    public lastSpawnNode: Node = null;

    @property({ type: [LCHEnemyMove], tooltip: 'Danh sách 6 quái Phòng 1 (Pos1 & Pos2)' })
    public room1Enemies: LCHEnemyMove[] = [];

    @property({ type: [LCHEnemyMove], tooltip: 'Danh sách 12 quái Phòng 2 (Pos3.1, Pos3.2, Pos3.3)' })
    public room2Enemies: LCHEnemyMove[] = [];

    @property({ type: [LCHEnemyCombat], tooltip: 'Component chiến đấu của toàn bộ 18 quái' })
    public allEnemyCombats: LCHEnemyCombat[] = [];

    public state: LCHGameState = LCHGameState.INTRO_ROOM1;
    private _remainingEnemiesInRoom: number = 0;
    private _heroPos: Vec3 = new Vec3();

    protected onLoad(): void {
        LCHFlowManager.instance = this;
    }

    protected onDestroy(): void {
        if (LCHFlowManager.instance === this) LCHFlowManager.instance = null;
    }

    protected start(): void {
        this.initializeSceneState();
        this.beginRoom1Intro();
    }

    private initializeSceneState(): void {
        if (this.doorCtrl) this.doorCtrl.resetAllDoorsInitialState();
        if (this.cameraCtrl) this.cameraCtrl.snapToRoom1();
        if (this.boundary) this.boundary.setPhase(LCHBoundaryPhase.ROOM1_INTRO);

        const dealHeroDmg = (dmg: number) => {
            if (this.warriorStats) this.warriorStats.takeDamage(dmg);
        };
        const checkHeroAlive = () => (this.warriorStats ? this.warriorStats.isAlive : false);

        if (this.fireballMgr) {
            this.fireballMgr.onHitHeroCallback = dealHeroDmg;
            this.fireballMgr.isHeroAliveCheck = checkHeroAlive;
        }

        for (let i = 0; i < this.allEnemyCombats.length; i++) {
            const c = this.allEnemyCombats[i];
            if (c) c.onDealDamageToHero = dealHeroDmg;
        }

        for (let i = 0; i < this.room1Enemies.length; i++) {
            const e = this.room1Enemies[i];
            if (e) {
                e.isHeroAliveCheck = checkHeroAlive;
                if (e.stats) e.stats.onDeathCallback = () => this.onRoom1EnemyKilled();
                e.hideBeforeSpawn();
            }
        }
        for (let i = 0; i < this.room2Enemies.length; i++) {
            const e = this.room2Enemies[i];
            if (e) {
                e.isHeroAliveCheck = checkHeroAlive;
                if (e.stats) e.stats.onDeathCallback = () => this.onRoom2EnemyKilled();
                e.hideBeforeSpawn();
            }
        }

        if (this.chest0) {
            this.chest0.setupInitialState();
            this.chest0.onChestUpgradeNowCallback = () => {
                if (this.warriorMove) this.warriorMove.setControlLocked(true);
                if (this.guideHand) this.guideHand.onSkillPopupOpen();
                if (this.warriorStats) this.warriorStats.setWeaponStage(2, true);
            };
            this.chest0.onChestTriggeredCallback = (_c, remDur) => this.onChest0Opened(remDur);
        }
        if (this.chest1) {
            this.chest1.setupInitialState();
            this.chest1.onChestUpgradeNowCallback = () => {
                if (this.warriorMove) this.warriorMove.setControlLocked(true);
                if (this.guideHand) this.guideHand.onSkillPopupOpen();
                if (this.warriorStats) this.warriorStats.setWeaponStage(3, true);
            };
            this.chest1.onChestTriggeredCallback = (_c, remDur) => this.onChest1Opened(remDur);
        }
        if (this.chest2) {
            this.chest2.setupInitialState();
            this.chest2.onChestTriggeredCallback = () => this.onChest2Triggered();
        }

        if (this.weaponUpPopup && this.weaponUpPopup.node) this.weaponUpPopup.node.active = false;
        if (this.chestTapGuideNode) this.chestTapGuideNode.active = false;
        if (this.adCtrl && this.adCtrl.node) this.adCtrl.node.active = false;

        if (this.warriorStats) {
            this.warriorStats.canDieInCurrentRoom = false;
            this.warriorStats.setWeaponStage(1, false);
            this.warriorStats.onHeroDiedCallback = () => this.onWarriorDiedInRoom3();
        }
    }

    private beginRoom1Intro(): void {
        this.state = LCHGameState.INTRO_ROOM1;
        if (this.guideHand) this.guideHand.onSkillPopupOpen();
        if (this.doorCtrl) this.doorCtrl.openRoom1Entrance(0.45);

        if (this.warriorMove) {
            this.warriorMove.playIntroWalk(new Vec3(0, 0, -0.35), new Vec3(0, 0, -3.0), 0.78, () => {
                if (this.doorCtrl) this.doorCtrl.closeRoom1Entrance(0.35);
                if (this.boundary) this.boundary.setPhase(LCHBoundaryPhase.ROOM1_LOCKED);
                this.spawnRoom1Enemies();
            });
        }
    }

    private spawnRoom1Enemies(): void {
        this.state = LCHGameState.ROOM1_COMBAT;
        this._remainingEnemiesInRoom = this.room1Enemies.length;
        for (let i = 0; i < this.room1Enemies.length; i++) {
            if (this.room1Enemies[i]) this.room1Enemies[i].dropFromCeiling(i * 0.06, 1);
        }
        this.scheduleOnce(() => {
            if (this.warriorMove) this.warriorMove.setControlLocked(false);
            if (this.guideHand) {
                this.guideHand.onSkillPopupClose();
                this.guideHand.show();
            }
        }, 0.4);
    }

    private onRoom1EnemyKilled(): void {
        if (this.state !== LCHGameState.ROOM1_COMBAT) return;
        this._remainingEnemiesInRoom = Math.max(0, this._remainingEnemiesInRoom - 1);
        if (this._remainingEnemiesInRoom <= 0) {
            this.state = LCHGameState.ROOM1_CHEST_WAIT;
            if (this.fireballMgr) this.fireballMgr.clearAllFireballs();
            this.scheduleOnce(() => {
                if (this.chest0) this.chest0.dropFromCeiling();
            }, 0.25);
        }
    }

    private onChest0Opened(remainingAudioDur: number = 1.45): void {
        if (this.state !== LCHGameState.ROOM1_CHEST_WAIT) return;
        this.state = LCHGameState.ROOM1_WEAPON_POPUP;
        if (this.warriorMove) this.warriorMove.setControlLocked(true);
        if (this.guideHand) this.guideHand.onSkillPopupOpen();
        if (this.weaponUpPopup) {
            this.weaponUpPopup.showWeaponReward(1, remainingAudioDur, () => this.onRoom1RewardClaimed());
        }
    }

    private onRoom1RewardClaimed(): void {
        if (this.warriorMove) this.warriorMove.setControlLocked(false);
        if (this.doorCtrl) this.doorCtrl.openRoom2Entrance(0.55);
        if (this.boundary) this.boundary.setPhase(LCHBoundaryPhase.ROOM1_TO_ROOM2);
        if (this.guideHand) {
            this.guideHand.onSkillPopupClose();
            this.guideHand.show();
        }
        this.state = LCHGameState.WALK_TO_ROOM2;
    }

    private onPlayerEnteredRoom2(): void {
        this.state = LCHGameState.ROOM2_COMBAT;
        if (this.doorCtrl) this.doorCtrl.closeRoom2Entrance(0.3);
        if (this.boundary) this.boundary.setPhase(LCHBoundaryPhase.ROOM2_LOCKED);
        if (this.cameraCtrl) this.cameraCtrl.moveToRoom2(0.7);

        this._remainingEnemiesInRoom = this.room2Enemies.length;
        for (let i = 0; i < this.room2Enemies.length; i++) {
            if (this.room2Enemies[i]) this.room2Enemies[i].dropFromCeiling(0.2 + i * 0.045, 2);
        }
    }

    private onRoom2EnemyKilled(): void {
        if (this.state !== LCHGameState.ROOM2_COMBAT) return;
        this._remainingEnemiesInRoom = Math.max(0, this._remainingEnemiesInRoom - 1);
        if (this._remainingEnemiesInRoom <= 0) {
            this.state = LCHGameState.ROOM2_CHEST_WAIT;
            if (this.fireballMgr) this.fireballMgr.clearAllFireballs();
            this.scheduleOnce(() => {
                if (this.chest1) this.chest1.dropFromCeiling();
            }, 0.25);
        }
    }

    private onChest1Opened(remainingAudioDur: number = 1.55): void {
        if (this.state !== LCHGameState.ROOM2_CHEST_WAIT) return;
        this.state = LCHGameState.ROOM2_WEAPON_POPUP;
        if (this.warriorMove) this.warriorMove.setControlLocked(true);
        if (this.guideHand) this.guideHand.onSkillPopupOpen();
        if (this.weaponUpPopup) {
            this.weaponUpPopup.showWeaponReward(2, remainingAudioDur, () => this.onRoom2RewardClaimed());
        }
    }

    private onRoom2RewardClaimed(): void {
        if (this.warriorMove) this.warriorMove.setControlLocked(false);
        if (this.doorCtrl) this.doorCtrl.openRoom3Entrance(0.6);
        if (this.boundary) this.boundary.setPhase(LCHBoundaryPhase.ROOM2_TO_ROOM3);
        if (this.guideHand) {
            this.guideHand.onSkillPopupClose();
            this.guideHand.show();
        }
        this.state = LCHGameState.WALK_TO_ROOM3;
    }

    private onPlayerEnteredRoom3(): void {
        this.state = LCHGameState.ROOM3_CAM_PAN;
        if (this.doorCtrl) this.doorCtrl.closeRoom3Entrance(0.3);
        if (this.boundary) this.boundary.setPhase(LCHBoundaryPhase.ROOM3_LOCKED);
        if (this.warriorMove) this.warriorMove.setControlLocked(true);
        if (this.guideHand) this.guideHand.onSkillPopupOpen();
        if (this.chest2) this.chest2.enableInteraction();

        if (this.cameraCtrl) {
            this.cameraCtrl.panToRoom3ChestThenFollow(0.85, 0.65, () => {
                if (this.state === LCHGameState.ROOM3_CAM_PAN) {
                    this.state = LCHGameState.ROOM3_CHEST_WAIT;
                }
                if (this.warriorMove) this.warriorMove.setControlLocked(false);
                if (this.guideHand) {
                    this.guideHand.onSkillPopupClose();
                    this.guideHand.show();
                }
            });
        }
    }

    private onChest2Triggered(): void {
        if (this.state !== LCHGameState.ROOM3_CHEST_WAIT && this.state !== LCHGameState.ROOM3_CAM_PAN) return;
        this.state = LCHGameState.ROOM3_AMBUSH;

        if (this.warriorMove) this.warriorMove.setControlLocked(false);
        if (this.cameraCtrl) {
            this.cameraCtrl.enableFollowRoom3Immediate();
            this.cameraCtrl.shake(0.55, 0.38);
        }
        if (this.doorCtrl) this.doorCtrl.openFinalDoorTowardPlayer(0.5);
        if (this.warriorStats) this.warriorStats.canDieInCurrentRoom = true;

        const centerPos = this.lastSpawnNode ? this.lastSpawnNode.worldPosition : new Vec3(0, 0, -50);
        const allEnemies: LCHEnemyMove[] = [...this.room2Enemies, ...this.room1Enemies];

        for (let i = 0; i < allEnemies.length; i++) {
            const e = allEnemies[i];
            if (!e) continue;
            if (e.stats) e.stats.onDeathCallback = null;
            const col = (i % 5) - 2;
            const row = Math.floor(i / 5);
            const spawnPos = new Vec3(
                centerPos.x + col * 0.72 + (Math.random() - 0.5) * 0.2,
                0,
                centerPos.z + 3.2 - row * 1.05
            );
            e.respawnAtLastSpawn(spawnPos, i * 0.03);
        }
    }

    private onWarriorDiedInRoom3(): void {
        if (this.state === LCHGameState.HERO_DEAD_AD) return;
        this.state = LCHGameState.HERO_DEAD_AD;
        if (this.fireballMgr) this.fireballMgr.clearAllFireballs();
        if (this.guideHand) this.guideHand.onGameEnd();

        if (this.adCtrl) {
            this.adCtrl.node.active = true;
            this.adCtrl.showAD();
        } else {
            EventManager.instance.emit(GameEvent.GAME_WIN);
        }
    }

    protected update(): void {
        if (!this.warriorStats || !this.warriorStats.isValid || !this.warriorStats.isAlive) return;

        if (this.state === LCHGameState.WALK_TO_ROOM2) {
            this.warriorStats.node.getWorldPosition(this._heroPos);
            if (this._heroPos.z <= -12.85) this.onPlayerEnteredRoom2();
        } else if (this.state === LCHGameState.WALK_TO_ROOM3) {
            this.warriorStats.node.getWorldPosition(this._heroPos);
            if (this._heroPos.z <= -24.85) this.onPlayerEnteredRoom3();
        }
    }
}
