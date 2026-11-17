import { _decorator, Component, CCFloat } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('EnemyHP')
export class EnemyHP extends Component {
    @property({ type: CCFloat })
    public maxHp: number = 20;

    @property({ type: CCFloat })
    public currentHp: number = 20;

    public setHp(current: number, max: number) {
        this.currentHp = current;
        this.maxHp = max;
    }

    public getHpRatio(): number {
        return this.maxHp > 0 ? Math.max(0, this.currentHp / this.maxHp) : 0;
    }
}
