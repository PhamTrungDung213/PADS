import { _decorator, Component, Node, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('CamTest')
export class CameraFollow extends Component {
    @property({ type: Node, tooltip: 'Target cần Camera bám theo' })
    public target: Node | null = null;

    @property({ tooltip: 'Khoảng cách lệch (X, Y, Z)' })
    public offset: Vec3 = new Vec3(0, 5, 10);

    @property({ tooltip: 'Bật/tắt bám mượt' })
    public isSmooth: boolean = true;

    @property({ tooltip: 'Tốc độ bám theo (giá trị từ 3 - 10)' })
    public smoothSpeed: number = 5.0;

    private _tempDesiredPos: Vec3 = new Vec3();
    private _tempCurrentPos: Vec3 = new Vec3();

    lateUpdate(dt: number) {
        if (!this.target) return;

        // 1. Tính toán vị trí mong muốn
        Vec3.add(this._tempDesiredPos, this.target.worldPosition, this.offset);

        // 2. Cập nhật vị trí
        if (this.isSmooth) {
            this._tempCurrentPos.set(this.node.worldPosition);
            Vec3.lerp(
                this._tempCurrentPos,
                this._tempCurrentPos,
                this._tempDesiredPos,
                Math.min(1, dt * this.smoothSpeed)
            );
            this.node.setWorldPosition(this._tempCurrentPos);
        } else {
            this.node.setWorldPosition(this._tempDesiredPos);
        }
    }
}