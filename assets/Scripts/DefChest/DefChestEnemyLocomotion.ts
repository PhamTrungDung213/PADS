import { _decorator, Component, Vec3 } from 'cc';
import { IDefChestHeroTarget } from './DefChestTypes';
import { DefChestArenaBounds } from './DefChestArenaBounds';
import { DefChestEnemyVisual } from './DefChestEnemyVisual';

const { ccclass } = _decorator;

const RAD_TO_DEG = 180 / Math.PI;
const _tmpPos = new Vec3();

/** Điều hướng di chuyển của Quái, tách đàn và kẹp ranh giới đảo. */
@ccclass('DefChestEnemyLocomotion')
export class DefChestEnemyLocomotion extends Component {
    public moveTowardChestSlot(
        chestPos: Vec3,
        stopRadius: number,
        slotAngle: number,
        moveSpeed: number,
        visual: DefChestEnemyVisual | null,
        peers: { node: any; isDead: boolean }[],
        dt: number
    ): void {
        const slotX = chestPos.x + Math.cos(slotAngle) * (stopRadius * 0.90);
        const slotZ = chestPos.z + Math.sin(slotAngle) * (stopRadius * 0.90);
        this.moveTowardPoint(slotX, slotZ, moveSpeed, false, visual, peers, dt);
    }

    public moveTowardPoint(
        targetX: number,
        targetZ: number,
        moveSpeed: number,
        avoidChest: boolean,
        visual: DefChestEnemyVisual | null,
        peers: { node: any; isDead: boolean }[],
        dt: number
    ): void {
        this.node.getWorldPosition(_tmpPos);
        const dx = targetX - _tmpPos.x;
        const dz = targetZ - _tmpPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 0.05) {
            visual?.playIdle();
            return;
        }

        const step = Math.min(dist, moveSpeed * dt);
        _tmpPos.x += (dx / dist) * step;
        _tmpPos.z += (dz / dist) * step;

        this.applyPeerSeparation(_tmpPos, 0.82, peers, dt);
        DefChestArenaBounds.instance?.resolveEnemyPosition(_tmpPos, 0.42, avoidChest);

        this.node.setWorldPosition(_tmpPos);
        this.faceToward(targetX, targetZ);
        visual?.playWalk();
    }

    public applyKnockback(knockbackDir: Vec3, knockbackDist: number, isElite: boolean): void {
        const kbScale = isElite ? 0.35 : 1.0;
        this.node.getWorldPosition(_tmpPos);
        _tmpPos.x += knockbackDir.x * knockbackDist * kbScale;
        _tmpPos.z += knockbackDir.z * knockbackDist * kbScale;
        DefChestArenaBounds.instance?.resolveEnemyPosition(_tmpPos, 0.42, true);
        this.node.setWorldPosition(_tmpPos);
    }

    private applyPeerSeparation(pos: Vec3, minSep: number, peers: { node: any; isDead: boolean }[], dt: number): void {
        const minSepSq = minSep * minSep;
        for (let i = 0; i < peers.length; i++) {
            const other = peers[i];
            if (!other || other.node === this.node || other.isDead || !other.node.isValid) continue;
            const op = other.node.worldPosition;
            const dx = pos.x - op.x;
            const dz = pos.z - op.z;
            const dSq = dx * dx + dz * dz;
            if (dSq > 0.0001 && dSq < minSepSq) {
                const d = Math.sqrt(dSq);
                const push = (minSep - d) * 3.5 * dt;
                pos.x += (dx / d) * push;
                pos.z += (dz / d) * push;
            }
        }
    }

    public faceToward(targetX: number, targetZ: number): void {
        const myPos = this.node.worldPosition;
        const dx = targetX - myPos.x;
        const dz = targetZ - myPos.z;
        if (dx * dx + dz * dz < 0.0001) return;
        this.node.setRotationFromEuler(0, Math.atan2(dx, dz) * RAD_TO_DEG, 0);
    }

    public findNearestLivingHero(
        maxRadius: number,
        getHeroes: (() => IDefChestHeroTarget[]) | null
    ): IDefChestHeroTarget | null {
        if (!getHeroes) return null;
        const heroes = getHeroes();
        const fromPos = this.node.worldPosition;
        let best: IDefChestHeroTarget | null = null;
        let bestD2 = maxRadius * maxRadius;

        for (let i = 0; i < heroes.length; i++) {
            const h = heroes[i];
            if (!h || h.isDead || !h.node || !h.node.isValid) continue;
            const hp = h.node.worldPosition;
            const d2 = (hp.x - fromPos.x) ** 2 + (hp.z - fromPos.z) ** 2;
            if (d2 <= bestD2) {
                bestD2 = d2;
                best = h;
            }
        }
        return best;
    }
}
