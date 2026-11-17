import { _decorator, Component } from 'cc';
import { EventManager, GameEvent } from '../System/EventManager';

const { ccclass, property } = _decorator;

@ccclass('SkillGain')
export class SkillGain extends Component {
    public learnedSkills: string[] = [];

    onLoad() {
        EventManager.instance.on(GameEvent.SKILL_SELECTED, this.onSkillSelected, this);
    }

    onDestroy() {
        EventManager.instance.off(GameEvent.SKILL_SELECTED, this.onSkillSelected, this);
    }

    private onSkillSelected(skillId: string) {
        if (this.learnedSkills.indexOf(skillId) === -1) {
            this.learnedSkills.push(skillId);
            console.log(`[SkillGain] Hero đã lĩnh ngộ kỹ năng: ${skillId}`);
        }
    }
}
