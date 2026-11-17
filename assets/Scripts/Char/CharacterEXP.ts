import { _decorator, Component, CCInteger } from 'cc';
import { EventManager, GameEvent } from '../System/EventManager';

const { ccclass, property } = _decorator;

@ccclass('CharacterEXP')
export class CharacterEXP extends Component {
    @property({ type: CCInteger, tooltip: 'Cấp độ hiện tại' })
    public currentLevel: number = 0;

    @property({ type: CCInteger, tooltip: 'Số quái đã tiêu diệt' })
    public currentExp: number = 0;

    onLoad() {
        EventManager.instance.on(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);
        EventManager.instance.on(GameEvent.LEVEL_UP, this.onLevelUp, this);
    }

    onDestroy() {
        EventManager.instance.off(GameEvent.ENEMY_KILLED, this.onEnemyKilled, this);
        EventManager.instance.off(GameEvent.LEVEL_UP, this.onLevelUp, this);
    }

    private onEnemyKilled() {
        this.currentExp++;
    }

    private onLevelUp(level: number) {
        this.currentLevel = level;
    }
}
