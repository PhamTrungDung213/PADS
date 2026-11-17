import { _decorator, Component, CCFloat, CCBoolean } from 'cc';
import { CharacterConfig } from '../Config/CharacterConfig';
import { EventManager, GameEvent } from '../System/EventManager';

const { ccclass, property } = _decorator;

@ccclass('CharStats')
export class CharStats extends Component {
    public static instance: CharStats = null;

    @property({ tooltip: 'Hero bất tử, không thể chết (theo đúng GD)' })
    public isImmortal: boolean = true;

    @property({ type: CCFloat, tooltip: 'Máu tối đa' })
    public maxHp: number = 1000;

    @property({ type: CCFloat, tooltip: 'Máu hiện tại' })
    public currentHp: number = 1000;

    public readonly isPlayer: boolean = true;

    onLoad() {
        CharStats.instance = this;
        const config = CharacterConfig.instance;
        if (config) {
            this.isImmortal = config.isImmortal;
            this.maxHp = config.maxHp;
            this.currentHp = config.maxHp;
        }


    }

    onDestroy() {
        if (CharStats.instance === this) {
            CharStats.instance = null;
        }
    }

    public takeDamage(damage: number): boolean {
        if (this.isImmortal) {
            // Khóa HP theo GD, không thể chết
            this.currentHp = Math.max(1, this.currentHp - 1);
            EventManager.instance.emit(GameEvent.PLAYER_HP_CHANGED, this.currentHp, this.maxHp);
            return false;
        }

        this.currentHp = Math.max(0, this.currentHp - damage);
        EventManager.instance.emit(GameEvent.PLAYER_HP_CHANGED, this.currentHp, this.maxHp);
        return this.currentHp <= 0;
    }

    public heal(amount: number) {
        this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
        EventManager.instance.emit(GameEvent.PLAYER_HP_CHANGED, this.currentHp, this.maxHp);
    }
}
