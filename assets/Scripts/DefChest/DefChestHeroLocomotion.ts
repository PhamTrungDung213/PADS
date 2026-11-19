import { _decorator, Component, Vec3, Quat } from 'cc';
import { IDefChestEnemyTarget } from './DefChestTypes';
import { DefChestConfig } from './DefChestConfig';
import { DefChestArenaBounds } from './DefChestArenaBounds';
import { DefChestHeroAnim } from './DefChestHeroAnim';

const { ccclass } = _decorator;

const RAD_TO_DEG = 180 / Math.PI;
const _tmpPos = new Vec3();
const _tmpQuat = new Quat();

/** Điều khiển di chuyển 1:1 theo Joystick, tự tìm đuổi quái và tách đồng đội cho Hero. */
@ccclass('DefChestHeroLocomotion')
export class DefChestHeroLocomotion extends Component {
    public isMovingByJoystick: boolean = false;

    public moveByJoystickStep(
        stepX: number,
        stepZ: number,
        moveDirX: number,
        moveDirZ: number,
        modelForwardSign: number,
        heroAnim: DefChestHeroAnim | null,
        getAllies: (() => { node: any; isDead: boolean }[]) | null,
        dt: number
    ): void {
        this.isMovingByJoystick = true;
        this.node.getWorldPosition(_tmpPos);
        _tmpPos.x += stepX;
        _tmpPos.z += stepZ;

        this.applyAllySeparation(_tmpPos, 0.85, getAllies, dt);
        DefChestArenaBounds.instance?.resolveHeroPosition(_tmpPos);
        this.node.setWorldPosition(_tmpPos);

        this.faceDirection(moveDirX, moveDirZ, modelForwardSign, dt);
        heroAnim?.playRun();
    }

    public stopJoystickMove(): void {
        this.isMovingByJoystick = false;
    }

    public chaseTargetEnemy(
        target: IDefChestEnemyTarget,
        stopRange: number,
        modelForwardSign: number,
        heroAnim: DefChestHeroAnim | null,
        getAllies: (() => { node: any; isDead: boolean }[]) | null,
        dt: number
    ): boolean {
        const myPos = this.node.worldPosition;
        const ep = target.node.worldPosition;
        const dx = ep.x - myPos.x;
        const dz = ep.z - myPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        if (dist <= stopRange) {
            this.faceDirection(dx, dz, modelForwardSign, dt * 2.0);
            return true;
        }

        const cfg = DefChestConfig.instance;
        const chaseSpeed = (cfg ? cfg.squadMoveSpeed : 4.6) * 0.92;
        const step = Math.min(dist - stopRange * 0.9, chaseSpeed * dt);

        this.node.getWorldPosition(_tmpPos);
        _tmpPos.x += (dx / dist) * step;
        _tmpPos.z += (dz / dist) * step;

        this.applyAllySeparation(_tmpPos, 0.95, getAllies, dt);
        DefChestArenaBounds.instance?.resolveHeroPosition(_tmpPos);
        this.node.setWorldPosition(_tmpPos);

        this.faceDirection(dx, dz, modelForwardSign, dt * 1.5);
        heroAnim?.playRun();
        return false;
    }

    public findNearestEnemy(
        maxRange: number,
        getActiveEnemies: (() => IDefChestEnemyTarget[]) | null
    ): IDefChestEnemyTarget | null {
        if (!getActiveEnemies) return null;
        const enemies = getActiveEnemies();
        const myPos = this.node.worldPosition;
        let best: IDefChestEnemyTarget | null = null;
        let bestD2 = maxRange * maxRange;

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            if (!e || e.isDead || !e.node.isValid) continue;
            const ep = e.node.worldPosition;
            const d2 = (ep.x - myPos.x) ** 2 + (ep.z - myPos.z) ** 2;
            if (d2 <= bestD2) {
                bestD2 = d2;
                best = e;
            }
        }
        return best;
    }

    public applyAllySeparation(
        pos: Vec3,
        minSep: number,
        getAllies: (() => { node: any; isDead: boolean }[]) | null,
        dt: number
    ): void {
        if (!getAllies) return;
        const allies = getAllies();
        const minSepSq = minSep * minSep;
        for (let i = 0; i < allies.length; i++) {
            const other = allies[i];
            if (!other || other.node === this.node || other.isDead || !other.node.isValid) continue;
            const op = other.node.worldPosition;
            const dx = pos.x - op.x;
            const dz = pos.z - op.z;
            const dSq = dx * dx + dz * dz;
            if (dSq > 0.0001 && dSq < minSepSq) {
                const d = Math.sqrt(dSq);
                const push = (minSep - d) * 4.5 * dt;
                pos.x += (dx / d) * push;
                pos.z += (dz / d) * push;
            }
        }
    }

    public faceDirection(dirX: number, dirZ: number, modelForwardSign: number, dt: number): void {
        if (dirX * dirX + dirZ * dirZ < 0.0001) return;
        let targetYaw = Math.atan2(dirX, dirZ) * RAD_TO_DEG;
        if (modelForwardSign < 0) targetYaw += 180;
        Quat.fromEuler(_tmpQuat, 0, targetYaw, 0);

        const curRot = this.node.worldRotation;
        if (Quat.dot(curRot, _tmpQuat) < 0) {
            _tmpQuat.set(-_tmpQuat.x, -_tmpQuat.y, -_tmpQuat.z, -_tmpQuat.w);
        }
        const rotSpeed = DefChestConfig.instance ? DefChestConfig.instance.heroRotateSpeed : 18.0;
        Quat.slerp(_tmpQuat, curRot, _tmpQuat, Math.min(1.0, rotSpeed * dt));
        this.node.setWorldRotation(_tmpQuat);
    }
}
