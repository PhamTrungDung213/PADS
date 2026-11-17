import { _decorator, Component, Node, Vec3, Quat, tween, Tween } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('LCHDoorController')
export class LCHDoorController extends Component {
    public static instance: LCHDoorController = null;

    @property({ type: Node, tooltip: 'Cánh trái cửa vào Phòng 1 (ancient_floor_0/Wall_08/Door_01_1)' })
    public r1EntranceWingL: Node = null;

    @property({ type: Node, tooltip: 'Cánh phải cửa vào Phòng 1 (ancient_floor_0/Wall_08/Door_02_1)' })
    public r1EntranceWingR: Node = null;

    @property({ type: Node, tooltip: 'Cánh trái cửa vào Phòng 2 (ancient_floor_1/Wall_08/Door_01_1)' })
    public r2EntranceWingL: Node = null;

    @property({ type: Node, tooltip: 'Cánh phải cửa vào Phòng 2 (ancient_floor_1/Wall_08/Door_02_1)' })
    public r2EntranceWingR: Node = null;

    @property({ type: Node, tooltip: 'Cánh trái cửa vào Phòng 3 (ancient_floor_2/Wall_08/Door_01_1)' })
    public r3EntranceWingL: Node = null;

    @property({ type: Node, tooltip: 'Cánh phải cửa vào Phòng 3 (ancient_floor_2/Wall_08/Door_02_1)' })
    public r3EntranceWingR: Node = null;

    @property({ type: Node, tooltip: 'Cánh trái cửa cuối Phòng 3 (ancient_floor_2/Wall_02/Door_01)' })
    public r3FinalWingL: Node = null;

    @property({ type: Node, tooltip: 'Cánh phải cửa cuối Phòng 3 (ancient_floor_2/Wall_02/Door_02)' })
    public r3FinalWingR: Node = null;

    protected onLoad(): void {
        LCHDoorController.instance = this;
    }

    protected onDestroy(): void {
        if (LCHDoorController.instance === this) {
            LCHDoorController.instance = null;
        }
    }

    public resetAllDoorsInitialState(): void {
        this.setDoorPairAngleImmediate(this.r1EntranceWingL, this.r1EntranceWingR, 0);
        this.setDoorPairAngleImmediate(this.r2EntranceWingL, this.r2EntranceWingR, 0);
        this.setDoorPairAngleImmediate(this.r3EntranceWingL, this.r3EntranceWingR, 0);
        this.setDoorPairAngleImmediate(this.r3FinalWingL, this.r3FinalWingR, 0);
    }

    private setDoorPairAngleImmediate(wingL: Node, wingR: Node, openAngleDeg: number): void {
        if (wingL) {
            wingL.setRotationFromEuler(180, 180, openAngleDeg);
        }
        if (wingR) {
            wingR.setRotationFromEuler(0, 180, -openAngleDeg);
        }
    }

    /**
     * Xoay mở/đóng cặp cửa bản lề:
     * - openAngleDeg > 0 (VD: +90): Mở tiến về phía trước (-Z, vào phòng trong)
     * - openAngleDeg < 0 (VD: -95): Mở ngược về hướng người chơi (+Z)
     * - openAngleDeg = 0: Đóng kín
     */
    private animateDoorPair(wingL: Node, wingR: Node, openAngleDeg: number, duration: number, easingName: string, onDone?: () => void): void {
        if (wingL) {
            Tween.stopAllByTarget(wingL);
            const rotL = new Quat();
            Quat.fromEuler(rotL, 180, 180, openAngleDeg);
            tween(wingL)
                .to(duration, { rotation: rotL }, { easing: easingName as any })
                .start();
        }
        if (wingR) {
            Tween.stopAllByTarget(wingR);
            const rotR = new Quat();
            Quat.fromEuler(rotR, 0, 180, -openAngleDeg);
            tween(wingR)
                .to(duration, { rotation: rotR }, { easing: easingName as any })
                .call(() => {
                    if (onDone) onDone();
                })
                .start();
        } else if (onDone) {
            this.scheduleOnce(onDone, duration);
        }
    }

    public openRoom1Entrance(duration: number = 0.45, onDone?: () => void): void {
        this.animateDoorPair(this.r1EntranceWingL, this.r1EntranceWingR, 90, duration, 'quadOut', onDone);
    }

    public closeRoom1Entrance(duration: number = 0.35, onDone?: () => void): void {
        this.animateDoorPair(this.r1EntranceWingL, this.r1EntranceWingR, 0, duration, 'quadIn', onDone);
    }

    public openRoom2Entrance(duration: number = 0.55, onDone?: () => void): void {
        this.animateDoorPair(this.r2EntranceWingL, this.r2EntranceWingR, 95, duration, 'backOut', onDone);
    }

    public closeRoom2Entrance(duration: number = 0.3, onDone?: () => void): void {
        this.animateDoorPair(this.r2EntranceWingL, this.r2EntranceWingR, 0, duration, 'quadIn', onDone);
    }

    public openRoom3Entrance(duration: number = 0.6, onDone?: () => void): void {
        this.animateDoorPair(this.r3EntranceWingL, this.r3EntranceWingR, 95, duration, 'backOut', onDone);
    }

    public closeRoom3Entrance(duration: number = 0.3, onDone?: () => void): void {
        this.animateDoorPair(this.r3EntranceWingL, this.r3EntranceWingR, 0, duration, 'quadIn', onDone);
    }

    /** Mở cửa cuối Phòng 3 xoay bản lề VỀ HƯỚNG NGƯỜI CHƠI (+Z) */
    public openFinalDoorTowardPlayer(duration: number = 0.55, onDone?: () => void): void {
        this.animateDoorPair(this.r3FinalWingL, this.r3FinalWingR, -95, duration, 'backOut', onDone);
    }
}
