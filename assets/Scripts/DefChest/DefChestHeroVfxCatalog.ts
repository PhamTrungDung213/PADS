import { _decorator, Component, Node, Prefab, assetManager } from 'cc';

const { ccclass, property } = _decorator;

const ARROW_PREFAB_UUID = '8a4f5ac7-3f01-4a20-b871-cbfa932e4764';
const FX_LEVELUP_UUID = '08fafacb-155f-4daf-af98-8c8635c1f19d';
const FX_RAY_UUID = '60e76d4a-d0e8-4130-899a-f37711c531f1';
const FX_ANGEL_UUID = '8912d4e8-fd6d-49f2-a8c8-6ca16f086132';
const FX_BONK_UUID = '9f0cab4c-d710-4773-b6cc-e2e78a560dfd';
const FX_INFERNO_UUID = '284e5075-25d8-4069-8aa7-bde86d8a1b1f';
const FX_FIRE_EXP_UUID = '314ef492-ae72-4105-b339-face74d0a55c';
const FX_FIRE_BALL_UUID = 'edf0f2ee-10e8-4894-8c6a-48c7d22295fa';
const FX_FIRE_IMP_UUID = '2358db51-e474-40f5-967d-6f76184729e2';
const FX_BURN_UUID = '29ae4751-5055-4d24-be1b-ffe46e75b5cc';
const FX_LIGHT_BALL_UUID = '61605848-f666-4fb9-8aae-f7eb1fd642fc';
const FX_LIGHT_EXP_UUID = 'c0dabd11-2bed-4dfb-be09-50b116b40748';
const FX_LIGHT_CHAIN_UUID = '86768a64-1f15-42f2-ba38-613e33286f43';
const FX_SPEED_UUID = 'e973b5b9-b4c6-4127-863a-9f5a3f2e1ed1';
const FX_BONE_UUID = '644acb0e-a4b6-499e-b8a8-2cbce34f4380';
const FX_SMOKE_DIE_UUID = 'b5795420-e3c2-48f9-91dc-b7eb18264a9b';

/**
 * DefChestHeroVfxCatalog — Chứa toàn bộ Prefab Đạn & Hiệu ứng VFX của Hero trong Inspector,
 * kèm cơ chế tự nạp UUID dự phòng an toàn.
 */
@ccclass('DefChestHeroVfxCatalog')
export class DefChestHeroVfxCatalog extends Component {
    @property({ type: Prefab, tooltip: '[Ranger] Prefab Mũi tên (FX_Arrow_Bullet.prefab)' })
    public arrowPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng cột sáng thăng cấp (FX_LevelUp.prefab)' })
    public fxLevelUpPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng tia sáng Righteous Fury (FX_Levelup_Ray.prefab)' })
    public fxLevelUpRayPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng khiên thánh Protective Aura (FX_Angel_Buff.prefab)' })
    public fxAngelBuffPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng đập đất Bonk của Paladin (FX_Paladin_Cleanse_Impact.prefab)' })
    public fxPaladinBonkPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng cột lửa địa ngục Burn Burn Burn (FX_FireInferno_impact.prefab)' })
    public fxFireInfernoPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng nổ lửa Heavy Hand / Burn (FX_Fire_Explosion.prefab)' })
    public fxFireExplosionPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng cầu lửa gắn vào mũi tên Fire Arrow (FX_Fire_Ball.prefab)' })
    public fxFireBallPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng nổ cầu lửa Fire Arrow (FX_Fireball_impact.prefab)' })
    public fxFireballImpactPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng cháy DoT trên người quái (FX_Burn.prefab)' })
    public fxBurnLoopPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng cầu sét gắn vào mũi tên Lightning Arrow (FX_Lighting_Ball.prefab)' })
    public fxLightningBallPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng sét nổ Aura of Thunder / Lightning Arrow (FX_Lighting_Explosion.prefab)' })
    public fxLightningExplosionPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng tia sét giật lan (FX_Lightning_Blue.prefab)' })
    public fxLightningChainPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng lướt Charge Skill của Warrior (FX_Speed_Boost.prefab)' })
    public fxSpeedBoostPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng gai xương Spikes / trúng đòn (FX_common_impact_bone.prefab)' })
    public fxBoneImpactPrefab: Prefab = null;

    @property({ type: Prefab, tooltip: 'Hiệu ứng khói khi tử trận (FX_Smoke_Die.prefab)' })
    public fxSmokeDiePrefab: Prefab = null;

    @property({ type: Node, tooltip: 'Container chứa Đạn & VFX (System/Pool)' })
    public poolContainer: Node = null;

    protected onLoad(): void {
        this.preloadFallbackPrefabs();
    }

    public preloadFallbackPrefabs(): void {
        const loadPf = (uuid: string, assign: (p: Prefab) => void, cur: Prefab) => {
            if (cur) return;
            assetManager.loadAny(uuid, (err, pf: Prefab) => {
                if (!err && pf && this.isValid) assign(pf);
            });
        };
        loadPf(ARROW_PREFAB_UUID, p => { if (!this.arrowPrefab) this.arrowPrefab = p; }, this.arrowPrefab);
        loadPf(FX_LEVELUP_UUID, p => { if (!this.fxLevelUpPrefab) this.fxLevelUpPrefab = p; }, this.fxLevelUpPrefab);
        loadPf(FX_RAY_UUID, p => { if (!this.fxLevelUpRayPrefab) this.fxLevelUpRayPrefab = p; }, this.fxLevelUpRayPrefab);
        loadPf(FX_ANGEL_UUID, p => { if (!this.fxAngelBuffPrefab) this.fxAngelBuffPrefab = p; }, this.fxAngelBuffPrefab);
        loadPf(FX_BONK_UUID, p => { if (!this.fxPaladinBonkPrefab) this.fxPaladinBonkPrefab = p; }, this.fxPaladinBonkPrefab);
        loadPf(FX_INFERNO_UUID, p => { if (!this.fxFireInfernoPrefab) this.fxFireInfernoPrefab = p; }, this.fxFireInfernoPrefab);
        loadPf(FX_FIRE_EXP_UUID, p => { if (!this.fxFireExplosionPrefab) this.fxFireExplosionPrefab = p; }, this.fxFireExplosionPrefab);
        loadPf(FX_FIRE_BALL_UUID, p => { if (!this.fxFireBallPrefab) this.fxFireBallPrefab = p; }, this.fxFireBallPrefab);
        loadPf(FX_FIRE_IMP_UUID, p => { if (!this.fxFireballImpactPrefab) this.fxFireballImpactPrefab = p; }, this.fxFireballImpactPrefab);
        loadPf(FX_BURN_UUID, p => { if (!this.fxBurnLoopPrefab) this.fxBurnLoopPrefab = p; }, this.fxBurnLoopPrefab);
        loadPf(FX_LIGHT_BALL_UUID, p => { if (!this.fxLightningBallPrefab) this.fxLightningBallPrefab = p; }, this.fxLightningBallPrefab);
        loadPf(FX_LIGHT_EXP_UUID, p => { if (!this.fxLightningExplosionPrefab) this.fxLightningExplosionPrefab = p; }, this.fxLightningExplosionPrefab);
        loadPf(FX_LIGHT_CHAIN_UUID, p => { if (!this.fxLightningChainPrefab) this.fxLightningChainPrefab = p; }, this.fxLightningChainPrefab);
        loadPf(FX_SPEED_UUID, p => { if (!this.fxSpeedBoostPrefab) this.fxSpeedBoostPrefab = p; }, this.fxSpeedBoostPrefab);
        loadPf(FX_BONE_UUID, p => { if (!this.fxBoneImpactPrefab) this.fxBoneImpactPrefab = p; }, this.fxBoneImpactPrefab);
        loadPf(FX_SMOKE_DIE_UUID, p => { if (!this.fxSmokeDiePrefab) this.fxSmokeDiePrefab = p; }, this.fxSmokeDiePrefab);
    }
}
