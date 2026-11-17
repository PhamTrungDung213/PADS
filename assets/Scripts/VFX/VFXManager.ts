import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('VFXManager')
export class VFXManager extends Component {
    public static instance: VFXManager = null;

    onLoad() {
        VFXManager.instance = this;
    }

    onDestroy() {
        if (VFXManager.instance === this) {
            VFXManager.instance = null;
        }
    }

    public playVFX(prefab: Prefab, worldPos: Vec3, duration: number = 0.6) {
        if (!prefab) return;

        const vfxNode = instantiate(prefab);
        vfxNode.setParent(this.node);
        vfxNode.setWorldPosition(worldPos);
        vfxNode.active = true;

        this.scheduleOnce(() => {
            if (vfxNode && vfxNode.isValid) {
                vfxNode.destroy();
            }
        }, duration);
    }
}
