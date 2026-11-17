import { _decorator, Component, Sprite, Color, Node, js } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Thanh máu chuẩn 2 Sprite: 
 * - bgSprite: Sprite hình nền (Node BG)
 * - fillSprite: Sprite đổ đầy (Node Fill, Type FILLED)
 */
@ccclass('UI_HPBar')
export class HPBar extends Component {
    @property({ type: Sprite, tooltip: 'Background sprite (Node BG)' })
    public bgSprite: Sprite = null;

    @property({ type: Sprite, tooltip: 'Health fill sprite (Node Fill - Type FILLED)' })
    public fillSprite: Sprite = null;

    onLoad() {
        this.resolveSprites();
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
     * Cập nhật tỉ lệ thanh máu (từ 0.0 đến 1.0) trực tiếp qua fillRange của Sprite Fill
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

    public setFillColor(color: Color) {
        this.resolveSprites();
        if (this.fillSprite) {
            this.fillSprite.color = color;
        }
    }
}

js.setClassName('UI_HPBar', HPBar);
js.setClassName('HPBar', HPBar);
