import {
    _decorator,
    Component,
    Node,
    Sprite,
    SpriteFrame,
    Label,
    Vec3,
    tween,
    Tween,
    input,
    Input,
} from 'cc';
import { AudioManager } from '../System/AudioManager';

const { ccclass, property } = _decorator;

@ccclass('LCHWeaponUpPopup')
export class LCHWeaponUpPopup extends Component {
    @property({ type: Node, tooltip: 'Node khung thẻ chính (UI/WeaponUp/Card)' })
    public cardNode: Node = null;

    @property({ type: Sprite, tooltip: 'Sprite nền thẻ tím/vàng (UI/WeaponUp/Card/CardBg)' })
    public cardBgSprite: Sprite = null;

    @property({ type: Node, tooltip: 'Node hào quang xoay sau vũ khí (UI/WeaponUp/Card/Glow)' })
    public glowNode: Node = null;

    @property({ type: Sprite, tooltip: 'Sprite hiển thị ảnh Rìu (UI/WeaponUp/Card/WeaponIcon)' })
    public weaponIconSprite: Sprite = null;

    @property({ type: Label, tooltip: 'Label tiêu đề trên thẻ (UI/WeaponUp/Card/TitleLabel)' })
    public titleLabel: Label = null;

    @property({ type: Label, tooltip: 'Label tên vũ khí (UI/WeaponUp/Card/WeaponNameLabel)' })
    public weaponNameLabel: Label = null;

    @property({ type: [Node], tooltip: '5 Node khung sao dưới ảnh vũ khí (Star_1..Star_5)' })
    public starSlotNodes: Node[] = [];

    @property({ type: [Node], tooltip: '5 Node ngôi sao vàng bên trong khung sao (Star_1/Fill..Star_5/Fill)' })
    public starFillNodes: Node[] = [];

    @property({ type: Node, tooltip: 'Node chữ nhắc nhấn nhận quà (UI/WeaponUp/Card/TapHint)' })
    public tapHintNode: Node = null;

    @property({ type: Node, tooltip: 'Node bàn tay chỉ vào nút nhận quà (UI/WeaponUp/Card/TapHand)' })
    public tapHandNode: Node = null;

    @property({ type: SpriteFrame, tooltip: 'Ảnh nền tím Phòng 1 (skill_Purple)' })
    public purpleCardFrame: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Ảnh nền vàng Phòng 2 (skill_Gold)' })
    public goldCardFrame: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Sprite rìu 1 tay Phòng 1 (S_Ic_Item_Weapon_Axe_Tier_2)' })
    public axe1IconFrame: SpriteFrame = null;

    @property({ type: SpriteFrame, tooltip: 'Sprite rìu 2 tay Phòng 2 (S_Ic_Item_Weapon_2hAxe_Tier_2)' })
    public axe2IconFrame: SpriteFrame = null;

    private _isShowing: boolean = false;
    private _canClaim: boolean = false;
    private _onClaimCallback: (() => void) | null = null;
    private _glowAngle: number = 0;

    protected onEnable(): void {
        input.on(Input.EventType.TOUCH_START, this.onUserTap, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onUserTap, this);
    }

    protected onDisable(): void {
        input.off(Input.EventType.TOUCH_START, this.onUserTap, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onUserTap, this);
    }

    /**
     * Hiển thị bảng nhận vũ khí với thời lượng khớp phần còn lại của âm thanh nâng cấp:
     * - rewardTier = 1 (Phòng 1): axe_Tier2, nền tím, 4 sao hiện dần dần
     * - rewardTier = 2 (Phòng 2): two_handed_axe_Tier2, nền vàng, 5 sao hiện dần dần
     */
    public showWeaponReward(rewardTier: number, animDuration: number, onClaimed: () => void): void {
        this.unscheduleAllCallbacks();
        this._isShowing = true;
        this._canClaim = false;
        this._onClaimCallback = onClaimed;

        const isGoldTier = rewardTier >= 2;
        const targetStars = isGoldTier ? 5 : 4;
        const totalDur = Math.max(1.1, animDuration || 1.45);

        if (this.cardBgSprite) {
            this.cardBgSprite.spriteFrame = isGoldTier ? this.goldCardFrame : this.purpleCardFrame;
        }
        if (this.weaponIconSprite) {
            this.weaponIconSprite.spriteFrame = isGoldTier ? this.axe2IconFrame : this.axe1IconFrame;
        }
        if (this.titleLabel) {
            this.titleLabel.string = isGoldTier ? 'MYTHIC WEAPON!' : 'EPIC WEAPON!';
        }
        if (this.weaponNameLabel) {
            this.weaponNameLabel.string = isGoldTier ? 'TWO-HANDED AXE' : 'BATTLE AXE';
        }

        // Sắp xếp vị trí các ngôi sao cân đối ngay dưới ảnh rìu
        const spacing = 72;
        const startX = -((targetStars - 1) * spacing) * 0.5;
        for (let i = 0; i < this.starSlotNodes.length; i++) {
            const slot = this.starSlotNodes[i];
            if (!slot) continue;
            if (i < targetStars) {
                slot.active = true;
                slot.setPosition(startX + i * spacing, slot.position.y, 0);
            } else {
                slot.active = false;
            }
        }

        for (let i = 0; i < this.starFillNodes.length; i++) {
            const fill = this.starFillNodes[i];
            if (!fill) continue;
            Tween.stopAllByTarget(fill);
            fill.setScale(0, 0, 1);
            fill.active = false;
        }

        if (this.tapHintNode) this.tapHintNode.active = false;
        if (this.tapHandNode) this.tapHandNode.active = false;

        this.node.active = true;

        const cardPopDur = Math.min(0.32, totalDur * 0.24);
        if (this.cardNode) {
            Tween.stopAllByTarget(this.cardNode);
            this.cardNode.setScale(0.2, 0.2, 1);
            tween(this.cardNode)
                .to(cardPopDur, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
        }

        // Hiệu ứng các ngôi sao hiện lên dần dần khớp chính xác với thời lượng âm thanh nâng cấp
        const starStepDelay = Math.max(0.18, (totalDur - cardPopDur - 0.08) / targetStars);
        for (let i = 0; i < targetStars; i++) {
            this.scheduleOnce(() => {
                const fill = this.starFillNodes[i];
                if (fill && fill.isValid) {
                    fill.active = true;
                    fill.setScale(0, 0, 1);
                    tween(fill)
                        .to(0.18, { scale: new Vec3(1.38, 1.38, 1) }, { easing: 'backOut' })
                        .to(0.1, { scale: new Vec3(1.0, 1.0, 1) }, { easing: 'sineOut' })
                        .start();
                }
            }, cardPopDur + i * starStepDelay);
        }

        // Sau khi sao đã hiện đủ và âm thanh nâng cấp vừa dứt -> Cho phép nhấn tiếp tục
        const unlockTime = cardPopDur + targetStars * starStepDelay;
        this.scheduleOnce(() => {
            this._canClaim = true;
            if (this.tapHintNode) {
                this.tapHintNode.active = true;
            }
            if (this.tapHandNode) {
                this.tapHandNode.active = true;
            }
        }, unlockTime);
    }

    private onUserTap(): void {
        if (!this._isShowing || !this._canClaim) return;
        this._canClaim = false;
        this._isShowing = false;

        if (AudioManager.instance) {
            AudioManager.instance.playSkillSelect();
        }

        const cb = this._onClaimCallback;
        this._onClaimCallback = null;

        if (this.cardNode) {
            Tween.stopAllByTarget(this.cardNode);
            tween(this.cardNode)
                .to(0.2, { scale: new Vec3(0.15, 0.15, 1) }, { easing: 'backIn' })
                .call(() => {
                    this.node.active = false;
                    if (cb) cb();
                })
                .start();
        } else {
            this.node.active = false;
            if (cb) cb();
        }
    }

    protected update(dt: number): void {
        if (this._isShowing && this.glowNode && this.glowNode.isValid) {
            this._glowAngle = (this._glowAngle + 55 * dt) % 360;
            this.glowNode.setRotationFromEuler(0, 0, this._glowAngle);
        }
    }
}
