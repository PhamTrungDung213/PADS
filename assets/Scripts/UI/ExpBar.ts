import { _decorator, Component, Sprite, Node, js } from 'cc';
import { EventManager, GameEvent } from '../System/EventManager';
import { GameManager } from '../System/GameManager';

const { ccclass, property } = _decorator;

/**
 * Thanh kinh nghiệm chuẩn 2 Sprite:
 * - bgSprite: Sprite hình nền (Node BG)
 * - fillSprite: Sprite đổ đầy (Node Fill, Type FILLED)
 */
@ccclass('ExpEarn')
export class ExpBar extends Component {
    @property({ type: Sprite, tooltip: 'Background sprite (Node BG)' })
    public bgSprite: Sprite = null;

    @property({ type: Sprite, tooltip: 'Experience fill sprite (Node Fill - Type FILLED)' })
    public fillSprite: Sprite = null;

    @property({ tooltip: 'Use this ExpBar as a Hero Health Bar (starts at 100%, ignores EXP events)' })
    public useAsHealthBar: boolean = false;

    onLoad() {
        this.resolveSprites();
        if (this.useAsHealthBar) {
            this.setProgress(1.0);
        } else {
            this.setProgress(0);
            EventManager.instance.on(GameEvent.ENEMY_KILLED, this.onExpGained, this);
            EventManager.instance.on(GameEvent.LEVEL_UP, this.onLevelUp, this);
        }
    }

    onDestroy() {
        if (!this.useAsHealthBar) {
            EventManager.instance.off(GameEvent.ENEMY_KILLED, this.onExpGained, this);
            EventManager.instance.off(GameEvent.LEVEL_UP, this.onLevelUp, this);
        }
    }

    public resolveSprites() {
        if (!this.bgSprite) {
            this.bgSprite = this.node.getChildByName('BG')?.getComponent(Sprite) || null;
        }
        if (!this.fillSprite) {
            this.fillSprite = this.node.getChildByName('Fill')?.getComponent(Sprite) || null;
        }
    }

    /**
     * Cập nhật tỉ lệ thanh exp (từ 0.0 đến 1.0) trực tiếp qua fillRange của Sprite Fill
     */
    public setProgress(ratio: number) {
        this.resolveSprites();
        if (this.fillSprite) {
            if (this.fillSprite.type !== Sprite.Type.FILLED) {
                this.fillSprite.type = Sprite.Type.FILLED;
                this.fillSprite.fillType = Sprite.FillType.HORIZONTAL;
            }
            this.fillSprite.fillRange = Math.max(0, Math.min(1.0, ratio));
        }
    }

    private onExpGained() {
        const gm = GameManager.instance;
        if (gm && typeof (gm as any).getExpRatio === 'function') {
            this.setProgress((gm as any).getExpRatio());
        }
    }

    private onLevelUp(level: number) {
        this.setProgress(0);
    }
}

js.setClassName('ExpEarn', ExpBar);
js.setClassName('ExpBar', ExpBar);
