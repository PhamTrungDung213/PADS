import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

export enum GameEvent {
    JOYSTICK_MOVE = 'JOYSTICK_MOVE',
    JOYSTICK_STOP = 'JOYSTICK_STOP',
    ENEMY_KILLED = 'ENEMY_KILLED',
    LEVEL_UP = 'LEVEL_UP',
    SKILL_SELECTED = 'SKILL_SELECTED',
    SCREEN_CLEAR = 'SCREEN_CLEAR',
    GAME_WIN = 'GAME_WIN',
    GAME_OVER = 'GAME_OVER',
    DAMAGE_DEALT = 'DAMAGE_DEALT',
    PLAYER_HP_CHANGED = 'PLAYER_HP_CHANGED',
}

type EventCallback = (...args: any[]) => void;

interface EventSubscription {
    callback: EventCallback;
    target: any;
    once?: boolean;
}

@ccclass('EventManage')
export class EventManager extends Component {
    private static _instance: EventManager = null;
    private _events: Map<string, EventSubscription[]> = new Map();

    public static get instance(): EventManager {
        if (!this._instance) {
            this._instance = new EventManager();
        }
        return this._instance;
    }

    onLoad() {
        EventManager._instance = this;
    }

    onDestroy() {
        if (EventManager._instance === this) {
            EventManager._instance = null;
        }
        this._events.clear();
    }

    public on(event: string, callback: EventCallback, target?: any) {
        if (!this._events.has(event)) {
            this._events.set(event, []);
        }
        this._events.get(event)!.push({ callback, target, once: false });
    }

    public once(event: string, callback: EventCallback, target?: any) {
        if (!this._events.has(event)) {
            this._events.set(event, []);
        }
        this._events.get(event)!.push({ callback, target, once: true });
    }

    public off(event: string, callback: EventCallback, target?: any) {
        const subs = this._events.get(event);
        if (!subs) return;

        for (let i = subs.length - 1; i >= 0; i--) {
            const sub = subs[i];
            if (sub.callback === callback && (!target || sub.target === target)) {
                subs.splice(i, 1);
            }
        }
        if (subs.length === 0) {
            this._events.delete(event);
        }
    }

    public emit(event: string, ...args: any[]) {
        const subs = this._events.get(event);
        if (!subs || subs.length === 0) return;

        // Clone list để tránh mutate khi đang loop
        const list = [...subs];
        for (const sub of list) {
            try {
                if (sub.target) {
                    sub.callback.apply(sub.target, args);
                } else {
                    sub.callback(...args);
                }
            } catch (err) {
                console.error(`[EventManager] Error in handler for event "${event}":`, err);
            }

            if (sub.once) {
                this.off(event, sub.callback, sub.target);
            }
        }
    }

    public clear() {
        this._events.clear();
    }
}

// Cung cấp GlobalEvent tương thích cho các script ADS
export class GlobalEvent {
    public static OPEN_STORE = 'OPEN_STORE';
    public static ACTIVE_AUTO_OPEN_STORE = 'ACTIVE_AUTO_OPEN_STORE';
    public static CHECK_PLAYABLE = 'CHECK_PLAYABLE';

    private static _inst: GlobalEvent = null;

    public static instance(): GlobalEvent {
        if (!this._inst) {
            this._inst = new GlobalEvent();
        }
        return this._inst;
    }

    public addEventListener(event: string, cb: EventCallback, target?: any) {
        EventManager.instance.on(event, cb, target);
    }

    public removeEventListener(event: string, cb: EventCallback, target?: any) {
        EventManager.instance.off(event, cb, target);
    }

    public dispatchEvent(event: string, ...args: any[]) {
        EventManager.instance.emit(event, ...args);
    }
}

// Gắn lên window để PlayableAdsController có thể truy cập toàn cục an toàn
if (typeof window !== 'undefined') {
    (window as any).GlobalEvent = GlobalEvent;
}
