import {
    _decorator,
    Component,
    Node,
    Vec3,
    Camera,
    input,
    Input,
    EventKeyboard,
    KeyCode,
} from 'cc';
import { EventManager } from '../System/EventManager';
import { JoyStick } from '../UI/JoyStick';
import {
    DEFCHEST_EVENT_ALL_HEROES_DEAD,
    DEFCHEST_EVENT_PLAYER_FIRST_MOVE,
    DefChestHeroRole,
    IDefChestEnemyTarget,
} from './DefChestTypes';
import { DefChestConfig } from './DefChestConfig';
import { DefChestArenaBounds } from './DefChestArenaBounds';
import { DefChestCameraController } from './DefChestCameraController';
import { DefChestHeroAgent } from './DefChestHeroAgent';

const { ccclass, property } = _decorator;

export { DEFCHEST_EVENT_ALL_HEROES_DEAD, DEFCHEST_EVENT_PLAYER_FIRST_MOVE };

const _tmpRight = new Vec3();
const _tmpForward = new Vec3();

/**
 * DefChestSquadController — Điều khiển đội hình 3 nhân vật bằng 1 Joystick:
 * - Khi kéo Joystick: Cả 3 nhân vật chạy trực tiếp 1:1 theo hướng kéo (không trượt băng) và giữ đội hình tam giác.
 * - Khi thả Joystick: Các nhân vật lập tức dừng di chuyển tay và chuyển sang chế độ Tự động tìm quái (Auto-Chase) & Tấn công.
 */
@ccclass('DefChestSquadController')
export class DefChestSquadController extends Component {
    public static instance: DefChestSquadController | null = null;

    @property({ type: JoyStick, tooltip: 'Tham chiếu JoyStick điều khiển đội hình (UI/Control/JoyStick)' })
    public joystick: JoyStick = null;

    @property({ type: Camera, tooltip: 'Main Camera 3D để chiếu hướng kéo Joystick chuẩn theo góc nhìn' })
    public mainCamera: Camera = null;

    @property({ type: DefChestHeroAgent, tooltip: 'Nhân vật Paladin (Character/P_Paladin)' })
    public paladinAgent: DefChestHeroAgent = null;

    @property({ type: DefChestHeroAgent, tooltip: 'Nhân vật Warrior (Character/Character_Warrior)' })
    public warriorAgent: DefChestHeroAgent = null;

    @property({ type: DefChestHeroAgent, tooltip: 'Nhân vật Ranger (Character/Character_Ranger)' })
    public rangerAgent: DefChestHeroAgent = null;

    @property({ type: Node, tooltip: 'Container chứa Đạn & VFX (System/Pool)' })
    public poolContainer: Node = null;

    public isInputLocked: boolean = false;

    private _heroes: DefChestHeroAgent[] = [];
    private _squadCentroid: Vec3 = new Vec3();
    private _hasEmittedFirstMove: boolean = false;
    private _keysDown: Set<KeyCode> = new Set();
    private _getActiveEnemiesFn: (() => IDefChestEnemyTarget[]) | null = null;

    protected onLoad(): void {
        DefChestSquadController.instance = this;
        this.resolveHeroReferences();
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
    }

    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        if (DefChestSquadController.instance === this) {
            DefChestSquadController.instance = null;
        }
    }

    private onKeyDown(e: EventKeyboard): void {
        this._keysDown.add(e.keyCode);
    }

    private onKeyUp(e: EventKeyboard): void {
        this._keysDown.delete(e.keyCode);
    }

    public resolveHeroReferences(): void {
        if (!this.paladinAgent) {
            const pNode = this.node.getChildByName('P_Paladin');
            if (pNode) {
                this.paladinAgent = pNode.getComponent(DefChestHeroAgent) || pNode.addComponent(DefChestHeroAgent);
                this.paladinAgent.role = DefChestHeroRole.PALADIN;
                this.paladinAgent.modelForwardSign = -1.0;
            }
        }
        if (!this.warriorAgent) {
            const wNode = this.node.getChildByName('Character_Warrior');
            if (wNode) {
                this.warriorAgent = wNode.getComponent(DefChestHeroAgent) || wNode.addComponent(DefChestHeroAgent);
                this.warriorAgent.role = DefChestHeroRole.WARRIOR;
                this.warriorAgent.modelForwardSign = 1.0;
            }
        }
        if (!this.rangerAgent) {
            const rNode = this.node.getChildByName('Character_Ranger');
            if (rNode) {
                this.rangerAgent = rNode.getComponent(DefChestHeroAgent) || rNode.addComponent(DefChestHeroAgent);
                this.rangerAgent.role = DefChestHeroRole.RANGER;
                this.rangerAgent.modelForwardSign = 1.0;
            }
        }

        this._heroes = [this.paladinAgent, this.warriorAgent, this.rangerAgent].filter(Boolean) as DefChestHeroAgent[];
    }

    public initSquad(getActiveEnemies: () => IDefChestEnemyTarget[]): void {
        this._getActiveEnemiesFn = getActiveEnemies;
        this.resolveHeroReferences();

        if (!this.poolContainer && this.node.scene) {
            this.poolContainer = this.node.scene.getChildByPath('System/Pool');
        }
        if (!this.mainCamera && DefChestCameraController.instance) {
            this.mainCamera = DefChestCameraController.instance.camComponent;
        }
        if (!this.joystick) {
            this.joystick = JoyStick.instance;
        }

        this.recalculateCentroidFromHeroes();

        for (let i = 0; i < this._heroes.length; i++) {
            const h = this._heroes[i];
            if (!h || !h.node || !h.node.isValid) continue;
            const wp = h.node.worldPosition;
            h.formationOffset.set(wp.x - this._squadCentroid.x, 0, wp.z - this._squadCentroid.z);

            h.initHero({
                getActiveEnemies: () => (this._getActiveEnemiesFn ? this._getActiveEnemiesFn() : []),
                getAllHeroes: () => this._heroes,
                onHeroDied: () => this.onAnyHeroDied(),
                poolContainer: this.poolContainer,
            });
        }
    }

    private recalculateCentroidFromHeroes(): void {
        let sx = 0, sz = 0, count = 0;
        for (let i = 0; i < this._heroes.length; i++) {
            const h = this._heroes[i];
            if (h && !h.isDead && h.node && h.node.isValid) {
                const wp = h.node.worldPosition;
                sx += wp.x;
                sz += wp.z;
                count++;
            }
        }
        if (count > 0) {
            const groundY = DefChestArenaBounds.instance ? DefChestArenaBounds.instance.groundY : 0.32;
            this._squadCentroid.set(sx / count, groundY, sz / count);
        }
    }

    public get heroes(): DefChestHeroAgent[] {
        return this._heroes;
    }

    public get livingHeroesCount(): number {
        let count = 0;
        for (let i = 0; i < this._heroes.length; i++) {
            if (this._heroes[i] && !this._heroes[i].isDead) count++;
        }
        return count;
    }

    public get allHeroesDead(): boolean {
        return this._heroes.length > 0 && this.livingHeroesCount === 0;
    }

    private onAnyHeroDied(): void {
        if (this.allHeroesDead) {
            EventManager.instance.emit(DEFCHEST_EVENT_ALL_HEROES_DEAD);
        }
    }

    public applySkillUpgradeToRole(role: DefChestHeroRole, skillId: string): void {
        for (let i = 0; i < this._heroes.length; i++) {
            const h = this._heroes[i];
            if (h && h.role === role) {
                h.applySkillUpgrade(skillId);
            }
        }
    }

    public startVictoryCelebration(): void {
        this.isInputLocked = true;
        for (let i = 0; i < this._heroes.length; i++) {
            const h = this._heroes[i];
            if (h && !h.isDead) {
                h.startVictoryJumpLoop(i * 0.14);
            }
        }
    }

    public forceDefeatAllHeroes(): void {
        this.isInputLocked = true;
        for (let i = 0; i < this._heroes.length; i++) {
            const h = this._heroes[i];
            if (!h) continue;
            h.stopJoystickMove();
            if (!h.isDead) {
                h.forceDefeatDie();
            }
        }
    }

    protected update(dt: number): void {
        if (this.isInputLocked || this.allHeroesDead) {
            for (let i = 0; i < this._heroes.length; i++) {
                this._heroes[i]?.stopJoystickMove();
            }
            return;
        }

        const joy = this.joystick || JoyStick.instance;
        let inX = 0;
        let inY = 0;
        if (joy && joy.isHolding && joy.inputDir) {
            inX = joy.inputDir.x;
            inY = joy.inputDir.y;
        }

        if (Math.abs(inX) < 0.01 && Math.abs(inY) < 0.01 && this._keysDown.size > 0) {
            if (this._keysDown.has(KeyCode.KEY_A) || this._keysDown.has(KeyCode.ARROW_LEFT)) inX -= 1;
            if (this._keysDown.has(KeyCode.KEY_D) || this._keysDown.has(KeyCode.ARROW_RIGHT)) inX += 1;
            if (this._keysDown.has(KeyCode.KEY_W) || this._keysDown.has(KeyCode.ARROW_UP)) inY += 1;
            if (this._keysDown.has(KeyCode.KEY_S) || this._keysDown.has(KeyCode.ARROW_DOWN)) inY -= 1;
        }

        const inputMag = Math.sqrt(inX * inX + inY * inY);
        const isMoving = inputMag > 0.04;

        if (!isMoving) {
            // Người chơi buông tay -> Cả 3 nhân vật dừng nhận lệnh Joystick ngay lập tức (không trượt băng)
            for (let i = 0; i < this._heroes.length; i++) {
                this._heroes[i]?.stopJoystickMove();
            }
            this.recalculateCentroidFromHeroes();
            return;
        }

        if (!this._hasEmittedFirstMove) {
            this._hasEmittedFirstMove = true;
            EventManager.instance.emit(DEFCHEST_EVENT_PLAYER_FIRST_MOVE);
        }

        const normX = inX / inputMag;
        const normY = inY / inputMag;

        let worldMoveX = -normX;
        let worldMoveZ = normY;

        const camNode = this.mainCamera?.node || DefChestCameraController.instance?.node;
        if (camNode && camNode.isValid) {
            _tmpRight.set(camNode.right.x, 0, camNode.right.z);
            if (_tmpRight.lengthSqr() > 0.0001) _tmpRight.normalize();
            else _tmpRight.set(-1, 0, 0);

            _tmpForward.set(camNode.forward.x, 0, camNode.forward.z);
            if (_tmpForward.lengthSqr() > 0.0001) _tmpForward.normalize();
            else _tmpForward.set(0, 0, 1);

            worldMoveX = _tmpRight.x * normX + _tmpForward.x * normY;
            worldMoveZ = _tmpRight.z * normX + _tmpForward.z * normY;
        }

        const cfg = DefChestConfig.instance;
        const moveSpeed = cfg ? cfg.squadMoveSpeed : 4.6;
        const stepX = worldMoveX * moveSpeed * dt;
        const stepZ = worldMoveZ * moveSpeed * dt;

        this.recalculateCentroidFromHeroes();
        this._squadCentroid.x += stepX;
        this._squadCentroid.z += stepZ;
        DefChestArenaBounds.instance?.resolveHeroPosition(this._squadCentroid, 0.55);

        for (let i = 0; i < this._heroes.length; i++) {
            const h = this._heroes[i];
            if (!h || h.isDead || !h.node.isValid) continue;

            // Vừa bước 1:1 theo vận tốc kéo, vừa khép nhẹ về đội hình tam giác để không bị tách rời khi kéo lâu
            const hp = h.node.worldPosition;
            const targetFormX = this._squadCentroid.x + h.formationOffset.x;
            const targetFormZ = this._squadCentroid.z + h.formationOffset.z;
            const pullX = (targetFormX - (hp.x + stepX)) * Math.min(0.35, 3.5 * dt);
            const pullZ = (targetFormZ - (hp.z + stepZ)) * Math.min(0.35, 3.5 * dt);

            h.moveByJoystickStep(stepX + pullX, stepZ + pullZ, worldMoveX, worldMoveZ, dt);
        }
    }
}
