import { _decorator, Component, SpriteFrame, CCInteger, CCFloat } from 'cc';
import { LevelUpConfig, SkillData } from '../Config/LevelUpConfig';

const { ccclass, property } = _decorator;

@ccclass('SkillPoolEntry')
export class SkillPoolEntry {
    @property
    public id: string = '';

    @property
    public displayName: string = '';

    @property
    public description: string = '';

    @property({ type: CCInteger })
    public skillType: number = 0;

    @property({ type: CCInteger })
    public effectKind: number = 0;

    @property({ type: CCInteger })
    public statBuffKind: number = 0;

    @property({ type: CCInteger })
    public attackSkillKind: number = 0;

    @property({ type: CCInteger })
    public allowedClasses: number = 0;

    @property({ type: CCFloat })
    public value: number = 0;

    @property({ type: CCFloat })
    public value2: number = 0;

    @property({ type: CCInteger })
    public stackLimit: number = 99;

    @property({ type: SpriteFrame })
    public icon: SpriteFrame = null;
}

@ccclass('SkillPool')
export class SkillPool extends Component {
    public static instance: SkillPool = null;

    @property({ type: [SkillPoolEntry], tooltip: 'Skill entries list in Prefab' })
    public entries: SkillPoolEntry[] = [];

    @property({ type: [SpriteFrame], tooltip: 'Skill icons list' })
    public skillIcons: SpriteFrame[] = [];

    onLoad() {
        SkillPool.instance = this;
    }

    onDestroy() {
        if (SkillPool.instance === this) {
            SkillPool.instance = null;
        }
    }

    public getSkillsForLevel(level: number): SkillData[] {
        const config = LevelUpConfig.instance;
        if (!config) return [];

        if (level === 1) {
            return config.level1Skills;
        } else if (level === 2) {
            return config.level2Skills;
        } else {
            return config.level3Skills;
        }
    }
}
