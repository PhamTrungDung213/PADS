import { _decorator, Component, Vec3, math, CCFloat } from 'cc';
import { LCHPropObstacle } from './LCHPropObstacle';
const { ccclass, property } = _decorator;

export enum LCHBoundaryPhase {
    ROOM1_INTRO = 0,
    ROOM1_LOCKED = 1,
    ROOM1_TO_ROOM2 = 2,
    ROOM2_LOCKED = 3,
    ROOM2_TO_ROOM3 = 4,
    ROOM3_LOCKED = 5,
}

@ccclass('LCHRoomBoundary')
export class LCHRoomBoundary extends Component {
    public static instance: LCHRoomBoundary = null;

    @property({ type: CCFloat, tooltip: 'Giới hạn X tối đa nửa chiều rộng Phòng 1 & 2 (m)' })
    public room12HalfWidth: number = 2.15;

    @property({ type: CCFloat, tooltip: 'Giới hạn X tối đa nửa chiều rộng cửa qua phòng (m)' })
    public doorwayHalfWidth: number = 1.05;

    @property({ type: CCFloat, tooltip: 'Giới hạn X tối đa nửa chiều rộng Phòng 3 (scale 2x) (m)' })
    public room3HalfWidth: number = 4.35;

    @property({ type: CCFloat, tooltip: 'Z tối đa (phía cửa đầu Phòng 1)' })
    public room1MaxZ: number = -1.0;

    @property({ type: CCFloat, tooltip: 'Z tối thiểu của Phòng 1 (trước cửa Phòng 2)' })
    public room1MinZ: number = -11.2;

    @property({ type: CCFloat, tooltip: 'Z tối đa của Phòng 2 (sau khi đóng cửa Phòng 2)' })
    public room2MaxZ: number = -12.7;

    @property({ type: CCFloat, tooltip: 'Z tối thiểu của Phòng 2 (trước cửa Phòng 3)' })
    public room2MinZ: number = -22.9;

    @property({ type: CCFloat, tooltip: 'Z tối đa của Phòng 3 (sau khi đóng cửa Phòng 3)' })
    public room3MaxZ: number = -24.7;

    @property({ type: CCFloat, tooltip: 'Z tối thiểu của Phòng 3 (trước cửa cuối)' })
    public room3MinZ: number = -45.8;

    public currentPhase: LCHBoundaryPhase = LCHBoundaryPhase.ROOM1_INTRO;

    protected onLoad(): void {
        LCHRoomBoundary.instance = this;
    }

    protected onDestroy(): void {
        if (LCHRoomBoundary.instance === this) {
            LCHRoomBoundary.instance = null;
        }
    }

    public setPhase(phase: LCHBoundaryPhase): void {
        this.currentPhase = phase;
    }

    public clampPosition(outPos: Vec3): Vec3 {
        let x = outPos.x;
        let z = outPos.z;

        switch (this.currentPhase) {
            case LCHBoundaryPhase.ROOM1_INTRO:
                x = math.clamp(x, -this.doorwayHalfWidth, this.doorwayHalfWidth);
                z = math.clamp(z, this.room1MinZ, 1.0);
                break;

            case LCHBoundaryPhase.ROOM1_LOCKED:
                x = math.clamp(x, -this.room12HalfWidth, this.room12HalfWidth);
                z = math.clamp(z, this.room1MinZ, this.room1MaxZ);
                break;

            case LCHBoundaryPhase.ROOM1_TO_ROOM2:
                z = math.clamp(z, this.room2MinZ, this.room1MaxZ);
                if (z < -11.0 && z > -12.8) {
                    x = math.clamp(x, -this.doorwayHalfWidth, this.doorwayHalfWidth);
                } else {
                    x = math.clamp(x, -this.room12HalfWidth, this.room12HalfWidth);
                }
                break;

            case LCHBoundaryPhase.ROOM2_LOCKED:
                x = math.clamp(x, -this.room12HalfWidth, this.room12HalfWidth);
                z = math.clamp(z, this.room2MinZ, this.room2MaxZ);
                break;

            case LCHBoundaryPhase.ROOM2_TO_ROOM3:
                z = math.clamp(z, this.room3MinZ, this.room2MaxZ);
                if (z > -23.1) {
                    x = math.clamp(x, -this.room12HalfWidth, this.room12HalfWidth);
                } else if (z > -24.7) {
                    x = math.clamp(x, -this.doorwayHalfWidth * 1.3, this.doorwayHalfWidth * 1.3);
                } else {
                    x = math.clamp(x, -this.room3HalfWidth, this.room3HalfWidth);
                }
                break;

            case LCHBoundaryPhase.ROOM3_LOCKED:
                x = math.clamp(x, -this.room3HalfWidth, this.room3HalfWidth);
                z = math.clamp(z, this.room3MinZ, this.room3MaxZ);
                break;
        }

        outPos.set(x, 0, z);
        LCHPropObstacle.resolveActorPosition(outPos, 0.3);
        return outPos;
    }
}
