import { _decorator, Component, Node, Vec3, tween, UITransform } from 'cc';
import { SkillCardView } from './SkillCardView';

const { ccclass, property } = _decorator;

@ccclass('GuildHandSkill')
export class GuildHandSkill extends Component {
    @property({ tooltip: 'Hand position offset relative to card center (X, Y)' })
    public offset: Vec3 = new Vec3(240, 160, 0);

    @property({ tooltip: 'Bounce distance of the tutorial hand (pixels)' })
    public bounceDistance: number = 22.0;

    @property({ tooltip: 'Duration of one bounce interval (seconds)' })
    public bounceInterval: number = 0.35;

    @property({ tooltip: 'Glide duration between cards in Level 1 & 2 (seconds)' })
    public glideDuration: number = 0.38;

    private _tweenAnim: any = null;
    private _isPointing: boolean = false;

    onLoad() {
        if (!this.offset) {
            this.offset = new Vec3(240, 160, 0);
        }
    }

    /**
     * Chỉ dẫn bàn tay vào các thẻ bài:
     * - Level 1 & 2 (isFinalLevel = false): Di chuyển lần lượt qua cả 3 thẻ bài (0 -> 1 -> 2 -> lặp lại),
     *   mỗi khi dừng ở thẻ nào thì ngón tay chạm nảy thẻ đó lên.
     * - Level 3 (isFinalLevel = true): Chỉ đứng cố định ở thẻ chính giữa và nảy nảy tại chỗ.
     */
    public pointToCards(cardNodes: Node[], isFinalLevel: boolean = false) {
        if (!cardNodes || cardNodes.length === 0) return;

        if (!this.offset) {
            this.offset = new Vec3(240, 160, 0);
        }

        this.node.active = true;
        this.stopTween();
        this._isPointing = true;

        const parentTransform = this.node.parent?.getComponent(UITransform);
        if (!parentTransform) return;

        const off = this.offset || new Vec3(240, 160, 0);

        // Tính toán toạ độ đích (đã bù trừ offset chuẩn) cho từng thẻ bài
        const targets: { pos: Vec3; cardView: SkillCardView | null; node: Node }[] = [];
        for (const card of cardNodes) {
            if (!card || !card.isValid) continue;
            const worldPos = new Vec3();
            card.getWorldPosition(worldPos);
            const localPos = new Vec3();
            parentTransform.convertToNodeSpaceAR(worldPos, localPos);
            const targetPos = new Vec3(localPos.x + off.x, localPos.y + off.y, 0);
            targets.push({
                pos: targetPos,
                cardView: card.getComponent(SkillCardView),
                node: card,
            });
        }

        if (targets.length === 0) return;

        // =========================================================================
        // TRƯỜNG HỢP 1: CẤP CUỐI (LEVEL 3) - CHỈ Ở CHÍNH GIỮA VÀ NẢY NẢY LIÊN TỤC
        // =========================================================================
        if (isFinalLevel || targets.length === 1) {
            const centerTarget = targets[Math.floor(targets.length / 2)] || targets[0];
            const targetX = centerTarget.pos.x;
            const targetY = centerTarget.pos.y;

            this.node.setPosition(targetX, targetY, 0);

            if (centerTarget.cardView) {
                centerTarget.cardView.playBounce();
            }

            const upPos = new Vec3(targetX, targetY + this.bounceDistance, 0);
            const downPos = new Vec3(targetX, targetY, 0);

            this._tweenAnim = tween(this.node)
                .to(this.bounceInterval, { position: upPos }, { easing: 'sineOut' })
                .to(this.bounceInterval, { position: downPos }, { easing: 'sineIn' })
                .call(() => {
                    if (centerTarget.cardView && centerTarget.cardView.isValid) {
                        centerTarget.cardView.playBounce();
                    }
                })
                .union()
                .repeatForever()
                .start();
            return;
        }

        // =========================================================================
        // TRƯỜNG HỢP 2: CẤP 1 & 2 - DI CHUYỂN LẦN LƯỢT QUA CẢ 3 THẺ VÀ LẶP LẠI
        // =========================================================================
        // Đặt vị trí bàn tay ngay tại thẻ bài đầu tiên
        this.node.setPosition(targets[0].pos.clone());

        let t = tween(this.node);

        for (let i = 0; i < targets.length; i++) {
            const current = targets[i];
            const next = targets[(i + 1) % targets.length];

            const downPos = current.pos.clone();
            const upPos = new Vec3(current.pos.x, current.pos.y + this.bounceDistance, 0);

            t = t
                // 1. Nhịp nảy tại thẻ hiện tại (chạm tay xuống và thẻ nảy lên)
                .to(0.18, { position: upPos }, { easing: 'sineOut' })
                .to(0.18, { position: downPos }, { easing: 'sineIn' })
                .call(() => {
                    if (current.cardView && current.cardView.isValid) {
                        current.cardView.playBounce();
                    }
                })
                // 2. Dừng nhẹ 0.15s cho người xem kịp quan sát thẻ
                .delay(0.15)
                // 3. Lướt mượt mà sang thẻ kế tiếp
                .to(this.glideDuration, { position: next.pos }, { easing: 'cubicInOut' });
        }

        this._tweenAnim = t.union().repeatForever().start();
    }

    public hide() {
        this._isPointing = false;
        this.stopTween();
        this.node.active = false;
    }

    private stopTween() {
        if (this._tweenAnim) {
            this._tweenAnim.stop();
            this._tweenAnim = null;
        }
    }
}
