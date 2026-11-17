import { _decorator, Component, Node, Vec3, tween, Sprite, SpriteFrame, CCFloat, UITransform, assetManager } from 'cc';
import { SkillData } from '../Config/LevelUpConfig';

const { ccclass, property } = _decorator;

@ccclass('SkillReelView')
export class SkillReelView extends Component {
    @property({ type: Node, tooltip: 'Node containing the icon reel strip' })
    public reelContent: Node = null;

    @property({ type: Sprite, tooltip: 'Sprite displaying the final result icon' })
    public finalIconSprite: Sprite = null;

    @property({ type: CCFloat, tooltip: 'Reel roll speed' })
    public spinSpeed: number = 800.0;

    private _isSpinning: boolean = false;
    private _spinTime: number = 0;
    private _totalDuration: number = 1.5;
    private _onFinished: () => void = null;
    private _initialPos: Vec3 = new Vec3();

    onLoad() {
        if (!this.reelContent) {
            this.reelContent = this.node.getChildByName('Strip') || this.node;
        }
        if (!this.finalIconSprite && this.reelContent) {
            this.finalIconSprite = this.reelContent.getComponent(Sprite)
                || this.reelContent.addComponent(Sprite);
            this.finalIconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            const ut = this.reelContent.getComponent(UITransform);
            if (ut) {
                ut.setContentSize(186, 186);
            }
        }
        if (this.finalIconSprite && this.finalIconSprite.isValid) {
            this.finalIconSprite.node.active = false;
        }
        if (this.reelContent) {
            this.reelContent.getPosition(this._initialPos);
        }
    }

    /**
     * Bắt đầu quay cuộn xổ số đồng bộ chuẩn xác với độ dài âm thanh
     */
    public spin(duration: number, targetSkill: SkillData, onFinished?: () => void) {
        this.unscheduleAllCallbacks();
        this._isSpinning = true;
        this._spinTime = 0;
        this._totalDuration = duration > 0 ? duration : 1.5;
        this._onFinished = onFinished || null;

        // Cố định vị trí tâm (0, 0, 0), tuyệt đối không di chuyển tụt lên tụt xuống
        const content = this.reelContent;
        if (content && content.isValid) {
            content.setPosition(0, 0, 0);
        }
        if (this.finalIconSprite && this.finalIconSprite.isValid) {
            this.finalIconSprite.node.setPosition(0, 0, 0);
            this.finalIconSprite.node.active = false;
        }

        // Cập nhật icon mục tiêu (chỉ gán ảnh, TUYỆT ĐỐI KHÔNG BẬT ACTIVE Ở ĐÂY để SkillCardView tự điều khiển)
        if (targetSkill) {
            this.setFinalIcon(targetSkill);
        }

        // Đợi hết thời gian xoay để kết thúc đồng bộ
        this.scheduleOnce(() => {
            this._isSpinning = false;
            if (this._onFinished) {
                this._onFinished();
            }
        }, this._totalDuration * 0.8);
    }

    /**
     * Gán chính xác icon SpriteFrame cho cuộn slot reel (chỉ gán ảnh, không can thiệp active)
     */
    public setFinalIcon(targetSkill: SkillData) {
        if (!this.finalIconSprite && this.reelContent) {
            this.finalIconSprite = this.reelContent.getComponent(Sprite)
                || this.reelContent.addComponent(Sprite);
            this.finalIconSprite.sizeMode = Sprite.SizeMode.CUSTOM;
            const ut = this.reelContent.getComponent(UITransform);
            if (ut) {
                ut.setContentSize(186, 186);
            }
        }
        if (!this.finalIconSprite) return;

        if (targetSkill.icon) {
            this.finalIconSprite.spriteFrame = targetSkill.icon;
        } else if (targetSkill.iconUuid) {
            assetManager.loadAny(targetSkill.iconUuid, (err, sf: SpriteFrame) => {
                if (!err && sf) {
                    targetSkill.icon = sf;
                    if (this.finalIconSprite && this.finalIconSprite.isValid) {
                        this.finalIconSprite.spriteFrame = sf;
                    }
                }
            });
        }
    }
}
