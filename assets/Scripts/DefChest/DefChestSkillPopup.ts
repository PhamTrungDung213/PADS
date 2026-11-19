import {
    _decorator,
    Component,
    Node,
    Label,
    Sprite,
    Color,
    UITransform,
    js,
} from 'cc';
import {
    DefChestHeroRole,
    DefChestSkillOption,
    DefChestUpgradeTier,
} from './DefChestTypes';
import { AudioManager } from '../System/AudioManager';
import { DefChestSkillFactory } from './DefChestFactories';
import { SkillCardView } from '../UI/SkillCardView';
import { SkillData } from '../Config/LevelUpConfig';
import { GuildHandSkill } from '../UI/GuildHandSkill';

const { ccclass, property } = _decorator;

const HERO_UPGRADE_ORDER: ReadonlyArray<DefChestHeroRole> = [
    DefChestHeroRole.PALADIN,
    DefChestHeroRole.WARRIOR,
    DefChestHeroRole.RANGER,
];

const C_BANNER_EPIC = new Color(86, 30, 130, 255);
const C_BANNER_LEGEND = new Color(120, 52, 10, 255);
const C_TEXT_EPIC = new Color(255, 255, 255, 255);
const C_TEXT_LEGEND = new Color(255, 250, 224, 255);
const C_TEXT_OUTLINE = new Color(24, 10, 4, 255);

/** Popup nâng cấp kỹ năng 3 bước tuần tự (Paladin -> Warrior -> Ranger), tái sử dụng SkillCardView & GuildHandSkill. */
@ccclass('DefChestSkillPopup')
export class DefChestSkillPopup extends Component {
    public static instance: DefChestSkillPopup | null = null;

    @property({ type: [SkillCardView], tooltip: 'Danh sách 3 thẻ kỹ năng dùng SkillCardView (Cards/SkillCard_0, SkillCard_1, SkillCard_2)' })
    public cards: SkillCardView[] = [];

    @property({ type: Label, tooltip: 'Label hiển thị bước nâng cấp hiện tại (Title/LevelUpLabel)' })
    public stepHeaderLabel: Label = null;

    @property({ type: Label, tooltip: 'Label gợi ý bên dưới (Hint)' })
    public hintLabel: Label = null;

    @property({ type: GuildHandSkill, tooltip: 'Bàn tay hướng dẫn chỉ vào thẻ kỹ năng (TutorialHand)' })
    public guideHandSkill: GuildHandSkill = null;

    private _currentTier: DefChestUpgradeTier = DefChestUpgradeTier.EPIC;
    private _stepIndex: number = 0;
    private _onHeroSkillPicked: ((role: DefChestHeroRole, option: DefChestSkillOption) => void) | null = null;
    private _onAllThreePicked: (() => void) | null = null;

    protected onLoad(): void {
        DefChestSkillPopup.instance = this;
        this.disableOnlyLegacySkillScripts();
        this.resolveRefs();
    }

    protected onDestroy(): void {
        if (DefChestSkillPopup.instance === this) {
            DefChestSkillPopup.instance = null;
        }
    }

    /**
     * Chỉ tắt đúng `SkillPopUp` cũ của Survival nếu có,
     * GIỮ NGUYÊN 100% `SkillCardView`, `cc.Sprite`, `cc.Label`, `cc.Button`, `cc.Mask`, `cc.Graphics`!
     */
    private disableOnlyLegacySkillScripts(): void {
        const comps = this.node.getComponentsInChildren(Component);
        for (let i = 0; i < comps.length; i++) {
            const c = comps[i];
            if (!c || !c.isValid) continue;
            const cname = js.getClassName(c);
            if (cname === 'SkillPopUp') {
                c.enabled = false;
            }
        }
    }

    public resolveRefs(): void {
        if (!this.cards || this.cards.length === 0) {
            const cardsRoot = this.node.getChildByName('Cards') || this.node;
            const c0 = cardsRoot.getChildByName('SkillCard_0') || cardsRoot.getChildByName('Card1');
            const c1 = cardsRoot.getChildByName('SkillCard_1') || cardsRoot.getChildByName('Card2');
            const c2 = cardsRoot.getChildByName('SkillCard_2') || cardsRoot.getChildByName('Card3');
            const cardNodes = [c0, c1, c2].filter(Boolean) as Node[];
            this.cards = cardNodes.map(n => {
                const cv = n.getComponent(SkillCardView) || n.addComponent(SkillCardView);
                cv.cacheBaseTransform();
                return cv;
            });
        }

        if (!this.stepHeaderLabel) {
            const lvlLblNode = this.node.getChildByPath('Title/LevelUpLabel');
            if (lvlLblNode) this.stepHeaderLabel = lvlLblNode.getComponent(Label);
        }

        if (!this.hintLabel) {
            const hintNode = this.node.getChildByName('Hint');
            if (hintNode) this.hintLabel = hintNode.getComponent(Label);
        }

        if (!this.guideHandSkill) {
            const handNode = this.node.getChildByName('TutorialHand')
                || this.node.parent?.getChildByName('GuildHandSkill');
            if (handNode) {
                this.guideHandSkill = handNode.getComponent(GuildHandSkill)
                    || handNode.addComponent(GuildHandSkill);
            }
        }
    }

    public openSequentialUpgrade(
        tier: DefChestUpgradeTier,
        onHeroSkillPicked: (role: DefChestHeroRole, option: DefChestSkillOption) => void,
        onAllThreePicked: () => void
    ): void {
        this._currentTier = tier;
        this._stepIndex = 0;
        this._onHeroSkillPicked = onHeroSkillPicked;
        this._onAllThreePicked = onAllThreePicked;

        this.node.active = true;
        this.resolveRefs();

        this.presentCurrentHeroStep();
    }

    private presentCurrentHeroStep(): void {
        if (this._stepIndex >= HERO_UPGRADE_ORDER.length) {
            this.closePopupAndFinish();
            return;
        }

        const role = HERO_UPGRADE_ORDER[this._stepIndex];
        const options = DefChestSkillFactory.createOptionsForHero(role, this._currentTier);
        const isLegendary = this._currentTier === DefChestUpgradeTier.LEGENDARY;
        const cardLevel = isLegendary ? 3 : 2;
        const cardColorHex = isLegendary ? '#FFD700' : '#BA55D3';

        // Phát âm thanh gacha nâng cấp gắn trong AudioManager và đồng bộ độ dài hiệu ứng gacha đúng bằng độ dài audio!
        const audioDuration = AudioManager.instance
            ? AudioManager.instance.playUpgradePopup(isLegendary)
            : (isLegendary ? 2.5 : 1.8);

        if (this.guideHandSkill) {
            this.guideHandSkill.hide();
        }

        const bannerInnerSp = this.node.getChildByPath('Title/BannerInner')?.getComponent(Sprite);
        if (bannerInnerSp) {
            bannerInnerSp.color = isLegendary ? C_BANNER_LEGEND : C_BANNER_EPIC;
        }

        if (this.stepHeaderLabel) {
            this.stepHeaderLabel.node.active = true;
            const roleTitle = role === DefChestHeroRole.PALADIN
                ? 'PALADIN SKILL (1/3)'
                : role === DefChestHeroRole.WARRIOR
                    ? 'WARRIOR SKILL (2/3)'
                    : 'RANGER SKILL (3/3)';
            const ut = this.stepHeaderLabel.getComponent(UITransform);
            if (ut) ut.setContentSize(580, 84);
            this.stepHeaderLabel.fontSize = 50;
            this.stepHeaderLabel.lineHeight = 58;
            this.stepHeaderLabel.overflow = Label.Overflow.SHRINK;
            this.stepHeaderLabel.isBold = true;
            this.stepHeaderLabel.enableOutline = true;
            this.stepHeaderLabel.outlineColor = C_TEXT_OUTLINE;
            this.stepHeaderLabel.outlineWidth = 5;
            this.stepHeaderLabel.string = roleTitle;
            this.stepHeaderLabel.color = isLegendary ? C_TEXT_LEGEND : C_TEXT_EPIC;
        }

        if (this.hintLabel) {
            this.hintLabel.node.active = true;
            const tierWord = isLegendary ? 'LEGENDARY' : 'EPIC';
            this.hintLabel.string = `TAP TO SELECT ${tierWord} UPGRADE FOR ${role}!`;
        }

        let finishedCardCount = 0;
        const validCardCount = Math.min(this.cards.length, options.length);
        const onOneCardSpinDone = () => {
            finishedCardCount++;
            if (finishedCardCount >= validCardCount && this.isValid && this.node.active) {
                if (this.guideHandSkill) {
                    this.guideHandSkill.node.active = true;
                    // Luôn cho bàn tay lướt lần lượt qua cả 3 thẻ bài (cả đợt Epic lẫn Legendary đều có 3 thẻ)
                    this.guideHandSkill.pointToCards(
                        this.cards.map(c => c.node),
                        false
                    );
                }
            }
        };

        this.unscheduleAllCallbacks();
        for (let i = 0; i < this.cards.length; i++) {
            const card = this.cards[i];
            const opt = options[i];
            if (card && opt) {
                card.node.active = true;
                const skillData: SkillData = {
                    id: opt.id,
                    name: opt.name,
                    desc: opt.desc,
                    level: cardLevel,
                    colorHex: cardColorHex,
                    icon: opt.icon,
                    iconUuid: opt.iconUuid,
                };
                card.setupQuickCard(
                    skillData,
                    cardLevel,
                    audioDuration,
                    (_pickedSkill, pickedCard) => {
                        this.onCardSelectedInStep(role, opt, pickedCard || card);
                    },
                    onOneCardSpinDone
                );
            }
        }
    }

    private onCardSelectedInStep(
        role: DefChestHeroRole,
        pickedOption: DefChestSkillOption,
        pickedCard: SkillCardView
    ): void {
        for (let i = 0; i < this.cards.length; i++) {
            const c = this.cards[i];
            if (!c) continue;
            c.setInteractable(false);
            if (c !== pickedCard) {
                c.playUnselectedAnim();
            }
        }

        if (this.guideHandSkill) {
            this.guideHandSkill.hide();
        }

        AudioManager.instance?.playSkillSelect();

        if (this._onHeroSkillPicked) {
            this._onHeroSkillPicked(role, pickedOption);
        }

        pickedCard.playSelectedAnim(() => {
            this._stepIndex++;
            if (this._stepIndex < HERO_UPGRADE_ORDER.length) {
                this.presentCurrentHeroStep();
            } else {
                this.closePopupAndFinish();
            }
        });
    }

    private closePopupAndFinish(): void {
        this.unscheduleAllCallbacks();
        if (this.guideHandSkill) {
            this.guideHandSkill.hide();
            this.guideHandSkill.node.active = false;
        }
        this.node.active = false;

        const doneCb = this._onAllThreePicked;
        this._onAllThreePicked = null;
        if (doneCb) {
            doneCb();
        }
    }
}
