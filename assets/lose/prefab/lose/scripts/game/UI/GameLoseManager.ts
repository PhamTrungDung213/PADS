import { _decorator, Animation, Component, Node, tween, UIOpacity, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

const GameplayEvents = {
    ShowLose: 'ShowLose',
    OpenStore: 'OpenStore',
};

const EventManager = {
    instance: {
        on: (...args: any[]) => {},
        off: (...args: any[]) => {},
        emit: (...args: any[]) => {},
    }
};

@ccclass('GameLoseManager')
export class GameLoseManager extends Component {
    @property(Node)
    content: Node = null;
    @property(Node)
    failed: Node = null;
    @property(Node)
    icon: Node = null;
    @property(Node)
    playNow: Node = null;

    protected onLoad(): void {}

    protected onEnable(): void {
        EventManager.instance.on(GameplayEvents.ShowLose, this.show, this);
    }
    protected onDisable(): void {

        EventManager.instance.off(GameplayEvents.ShowLose, this.show, this)
    }
    show() {

        console.log("show lose")

        this.icon.active = false;
        this.icon.setScale(Vec3.ZERO)
        this.content.active = true;
        this.failed.setScale(new Vec3(1, 1, 1))
        EventManager.instance.emit(GameplayEvents.OpenStore);
        this.playNow.active = false;
        this.playNow.setScale(Vec3.ZERO)
        tween(this.failed)
            .to(0.4, { scale: new Vec3(2, 2, 2) }, { easing: this.backOut })
            .delay(1)
            .call(() => {
                this.showIcon()
            })
            .start();
    }
    backOut(k: number) {
        if (k === 0) {
            return 0;
        }
        const s = 3.5;
        return --k * k * ((s + 1) * k + s) + 1;
    }
    showIcon() {

        let uiOpactityFailed: UIOpacity = this.failed.getComponent(UIOpacity);
        this.icon.active = true;
        this.icon.setScale(Vec3.ZERO)

        this.playNow.active = true;

        tween(this.icon)
            .to(0.4, { scale: new Vec3(2, 2, 2) }, { easing: this.backOut })
            .start();

        tween(this.playNow)
            .to(0.4, { scale: new Vec3(1, 1, 1) }, { easing: this.backOut })
            .call(() => {
                this.playNow.getComponent(Animation).play("Pulse_UI");
            })
            .start();

        tween(uiOpactityFailed)
            .to(0.4, { opacity: 0 },)
            .start();

        tween(this.failed)
            .to(0.4, { scale: Vec3.ZERO })
            .start();
    }
}
