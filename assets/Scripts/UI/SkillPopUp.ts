import { _decorator, Component, Node, Vec3 } from 'cc';
import { SkillCardView } from './SkillCardView';
import { GuildHandSkill } from './GuildHandSkill';
import { SkillPool } from './SkillPool';
import { SkillData } from '../Config/LevelUpConfig';
import { AudioManager } from '../System/AudioManager';
import { EventManager, GameEvent } from '../System/EventManager';

const { ccclass, property } = _decorator;

@ccclass('SkillPopUp')
export class SkillPopUp extends Component {
    @property({ type: [SkillCardView], tooltip: 'List of 3 skill cards (SkillCard_0, 1, 2)' })
    public cards: SkillCardView[] = [];

    @property({ type: GuildHandSkill, tooltip: 'Tutorial hand component/node in scene (TutorialHand)' })
    public tutorialHand: GuildHandSkill = null;

    @property({ tooltip: 'Hand position offset relative to card center (X, Y)' })
    public handOffset: Vec3 = new Vec3(240, 160, 0);

    private _currentLevel: number = 1;
    private _canSelect: boolean = false;
    private _isShowing: boolean = false;

    onLoad() {
        if (this.cards.length === 0) {
            this.cards = this.getComponentsInChildren(SkillCardView);
        }

        const off = this.handOffset || new Vec3(240, 160, 0);
        const handComp = this.getOrCreateTutorialHand();
        if (handComp) {
            if (!handComp.offset) handComp.offset = new Vec3();
            handComp.offset.set(off);
        }

        // Mặc định ẩn popup
        this.node.active = false;

        EventManager.instance.on(GameEvent.LEVEL_UP, this.show, this);

        // Chạm vào bất kỳ vị trí nào trên popup ở Level 3 đều kích hoạt chiêu cuối (chống đơ 100%)
        this.node.on(Node.EventType.TOUCH_END, this.onPanelTouched, this);
    }

    onDestroy() {
        this._isShowing = false;
        EventManager.instance.off(GameEvent.LEVEL_UP, this.show, this);
        this.node.off(Node.EventType.TOUCH_END, this.onPanelTouched, this);
    }

    private onPanelTouched() {
        // Tuyệt đối không cho chọn, không cho nhấn khi skill chưa xong, chưa hiện xong, chưa hết audio
        if (!this._canSelect) return;

        if (this._currentLevel === 3) {
            const skill = (this.cards.length > 0 && this.cards[0].currentSkill)
                ? this.cards[0].currentSkill
                : { id: 'holy_screen_clear', name: 'Holy Retribution', desc: 'Summons a divine light pillar, obliterating all enemies!', level: 3, colorHex: '#FFD700' };
            this.onSelectSkill(skill);
        }
    }

    private getOrCreateTutorialHand(): GuildHandSkill {
        if (this.tutorialHand && this.tutorialHand.isValid) {
            return this.tutorialHand;
        }

        // Tìm component trên node TutorialHand trong Scene
        const existingComp = this.getComponentInChildren(GuildHandSkill);
        if (existingComp) {
            this.tutorialHand = existingComp;
            return this.tutorialHand;
        }

        const existingNode = this.node.getChildByName('TutorialHand');
        if (existingNode) {
            this.tutorialHand = existingNode.getComponent(GuildHandSkill)
                || existingNode.addComponent(GuildHandSkill);
            return this.tutorialHand;
        }

        return null;
    }

    public show(level: number) {
        if (this._isShowing && this.node.active) {
            return;
        }
        this._isShowing = true;
        this._currentLevel = level;
        // Khóa tương tác ngay từ đầu: skill chưa xong, chưa hiện xong, chưa hết audio thì KHÔNG cho chọn, KHÔNG cho nhấn
        this._canSelect = false;
        this.node.active = true;

        if (this.cards.length === 0) {
            this.cards = this.getComponentsInChildren(SkillCardView);
        }

        const off = this.handOffset || new Vec3(240, 160, 0);
        const handComp = this.getOrCreateTutorialHand();
        if (handComp) {
            if (!handComp.offset) handComp.offset = new Vec3();
            handComp.offset.set(off);
            handComp.hide();
        }

        // Phát âm thanh thăng cấp và lấy thời lượng chuẩn xác của file nhạc
        let spinDuration = 1.6;
        if (AudioManager.instance) {
            spinDuration = AudioManager.instance.playLevelUp(level);
        }

        const skills = SkillPool.instance ? SkillPool.instance.getSkillsForLevel(level) : [];

        // Level 3: Theo đúng yêu cầu, chỉ hiện 1 lá bài to màu vàng giữa màn hình
        if (level === 3) {
            if (this.cards.length > 0) {
                // Giữ thẻ đầu tiên phóng to ở giữa, ẩn các thẻ khác
                this.cards[0].node.active = true;
                this.cards[0].resetTransform();
                this.cards[0].node.setPosition(0, 0, 0);

                // Tỉ lệ tương đối so với baseScale đã chỉnh, không áp đặt cứng
                const l3Scale = this.cards[0].baseScale.clone().multiplyScalar(1.25);
                this.cards[0].node.setScale(l3Scale);

                const screenClearSkill: SkillData = skills[0] || {
                    id: 'holy_screen_clear',
                    name: 'Holy Retribution',
                    desc: 'Calls down a divine light pillar, obliterating all enemies!',
                    level: 3,
                    colorHex: '#FFD700',
                };

                this.cards[0].setup(screenClearSkill, 3, (skill) => this.onSelectSkill(skill));
                for (let i = 1; i < this.cards.length; i++) {
                    this.cards[i].node.active = false;
                }

                this.cards[0].startSpin(spinDuration, () => {
                    // Xoay xong, banner mở ra và hết audio -> MỚI MỞ KHÓA CHO NHẤN
                    this._canSelect = true;
                    const h = this.getOrCreateTutorialHand();
                    if (h) {
                        // Level 3 cuối cùng: chỉ nảy cố định ở giữa
                        h.pointToCards([this.cards[0].node], true);
                    }
                });
            }
            return;
        }

        // Level 1 và Level 2: Hiển thị 3 thẻ bài với tỉ lệ chuẩn xác 100% người dùng đã chỉnh
        let finishedCount = 0;
        const totalCards = Math.min(this.cards.length, skills.length);

        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            const skill = skills[i];

            if (card && skill) {
                card.node.active = true;
                // Khôi phục đúng 100% scale và vị trí trong Scene
                card.resetTransform();
                card.setup(skill, level, (s) => this.onSelectSkill(s));

                // Thêm độ trễ nhẹ giữa 3 thẻ bài (slot cascade: lá 0 dừng trước, lá 1, lá 2)
                const staggerDelay = i * 0.08;
                card.startSpin(spinDuration + staggerDelay, () => {
                    finishedCount++;
                    if (finishedCount >= totalCards) {
                        // Toàn bộ 3 lá bài xoay xong, hiện đầy đủ banner và hết audio -> MỚI MỞ KHÓA CHO NHẤN
                        this._canSelect = true;
                        const h = this.getOrCreateTutorialHand();
                        if (h) {
                            const activeNodes = this.cards.filter((c) => c.node.active).map((c) => c.node);
                            // Level 1 & 2: Bàn tay di chuyển lần lượt qua cả 3 thẻ và lặp lại
                            h.pointToCards(activeNodes, false);
                        }
                    }
                });
            } else if (card) {
                card.node.active = false;
            }
        }
    }

    private onSelectSkill(skill: SkillData) {
        // Tuyệt đối không cho chọn, không cho nhấn khi chưa hiện xong hoặc chưa hết audio
        if (!this._canSelect) return;
        this._canSelect = false; // Khóa ngay lập tức tránh spam nhấn đúp

        // Chỉ phát âm thanh skill select ở Level 1 và 2.
        // Ở Level 3 kết thúc, chỉ phát duy nhất 1 âm thanh ĐÙNG chiêu cuối (playFinalExplosion) trong triggerScreenClear.
        if (this._currentLevel < 3 && AudioManager.instance) {
            AudioManager.instance.playSkillSelect();
        }

        const handComp = this.getOrCreateTutorialHand();
        if (handComp) {
            handComp.hide();
        }

        // Reset lại vị trí và scale ban đầu cho các thẻ
        for (const c of this.cards) {
            if (c) c.resetTransform();
        }

        this._isShowing = false;
        this.node.active = false;
        EventManager.instance.emit(GameEvent.SKILL_SELECTED, skill.id);
    }
}
