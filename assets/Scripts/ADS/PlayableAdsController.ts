import { _decorator, Component, Button, macro, sys, CCBoolean, CCString } from 'cc';
import super_html_playable from './super_html_playable';
import { EventManager, GameEvent, GlobalEvent } from '../System/EventManager';

const { ccclass, property } = _decorator;

const DEFAULT_ANDROID_URL = "https://play.google.com/store/apps/details?id=com.skybull.danger.dungeon";
const DEFAULT_IOS_URL = "https://apps.apple.com/us/app/adhd-squad/id6772141179";

@ccclass('PlayableAdsController')
export class PlayableAdsController extends Component {
    public static instance: PlayableAdsController = null;

    @property(CCBoolean)
    public isBuild: boolean = false;

    @property({ tooltip: 'Link Store Android' })
    public androidUrl: string = DEFAULT_ANDROID_URL;

    @property({ tooltip: 'Link Store iOS' })
    public iosUrl: string = DEFAULT_IOS_URL;

    public isActiveAutoStore: boolean = false;
    public channel: string = '';

    onLoad() {
        PlayableAdsController.instance = this;
        this.channel = this.getChannel();

        macro.ENABLE_MULTI_TOUCH = false;
        macro.ENABLE_TRANSPARENT_CANVAS = true;

        if (this.isBuild) {
            console.log = () => {};
            console.warn = () => {};
        }

        try {
            (window as any).gameReady && (window as any).gameReady();
            super_html_playable.set_google_play_url(this.androidUrl);
            super_html_playable.set_app_store_url(this.iosUrl);
        } catch (e) {
            console.warn('[PlayableAdsController] super_html_playable init error:', e);
        }
    }

    onDestroy() {
        if (PlayableAdsController.instance === this) {
            PlayableAdsController.instance = null;
        }
    }

    protected onEnable(): void {
        GlobalEvent.instance().addEventListener(GlobalEvent.OPEN_STORE, this.openStore, this);
        GlobalEvent.instance().addEventListener(GlobalEvent.ACTIVE_AUTO_OPEN_STORE, this.activeAutoStore, this);
        GlobalEvent.instance().addEventListener(GlobalEvent.CHECK_PLAYABLE, this.checkOpenStorePlayable, this);
        EventManager.instance.on(GameEvent.GAME_WIN, this.onGameWin, this);
    }

    protected onDisable(): void {
        GlobalEvent.instance().removeEventListener(GlobalEvent.OPEN_STORE, this.openStore, this);
        GlobalEvent.instance().removeEventListener(GlobalEvent.ACTIVE_AUTO_OPEN_STORE, this.activeAutoStore, this);
        GlobalEvent.instance().removeEventListener(GlobalEvent.CHECK_PLAYABLE, this.checkOpenStorePlayable, this);
        EventManager.instance.off(GameEvent.GAME_WIN, this.onGameWin, this);
    }

    start() {
        try {
            (window as any).gameReady && (window as any).gameReady();
        } catch (e) {
            // ignore
        }
    }

    private onGameWin() {
        console.log('[PlayableAdsController] Game Win event received');
    }

    public checkOpenStorePlayable() {
        if (this.isActiveAutoStore) {
            GlobalEvent.instance().dispatchEvent(GlobalEvent.OPEN_STORE);
        }
    }

    public openStore() {
        console.log('[PlayableAdsController] open store');
        try {
            super_html_playable.game_end();
            super_html_playable.download();
        } catch (e) {
            // fallback
        }
        this.installHandle();
    }

    public activeAutoStore() {
        this.isActiveAutoStore = true;
        this.openStore();
    }

    public getChannel(): string {
        try {
            (window as any).advChannels = '{{__adv_channels_adapter__}}';
            return (window as any).advChannels;
        } catch (e) {
            return '';
        }
    }

    public installHandle(): void {
        console.log('[PlayableAdsController] installHandle called');
        const linkStore: string = this.getLinkStore();

        try {
            (window as any).gameEnd && (window as any).gameEnd();
            super_html_playable.game_end();
            super_html_playable.download();
        } catch (e) {
            // ignore
        }

        switch (this.channel) {
            case "AppLovin":
                try { (window as any).mraid.open(linkStore); } catch (e) { window.open(linkStore); }
                break;
            case "Facebook":
                try { (window as any).FbPlayableAd.onCTAClick(); } catch (e) { window.open(linkStore); }
                break;
            case "Google":
                try { (window as any).ExitApi.exit(linkStore); } catch (e) { window.open(linkStore); }
                break;
            case "Mintegral":
                try {
                    (window as any).gameEnd && (window as any).gameEnd();
                    (window as any).install && (window as any).install();
                } catch (e) {
                    window.open(linkStore);
                }
                break;
            case "Unity":
                try { (window as any).mraid.open(linkStore); } catch (e) { window.open(linkStore); }
                break;
            case "Tiktok":
                try { (window as any).playableSDK.openAppStore(); } catch (e) { window.open(linkStore); }
                break;
            case "IronSource":
                try { (window as any).dapi.openStoreUrl(); } catch (e) { window.open(linkStore); }
                break;
            default:
                window.open(linkStore);
                break;
        }
    }

    public closeAd(): void {
        console.log('[PlayableAdsController] closeAd called');

        try {
            (window as any).gameEnd && (window as any).gameEnd();
            super_html_playable.game_end();
        } catch (e) {
            // ignore
        }

        switch (this.channel) {
            case "AppLovin":
            case "Unity":
                try { (window as any).mraid.close(); } catch (e) {}
                break;
            case "IronSource":
                try { (window as any).dapi.close(); } catch (e) {}
                break;
            case "Google":
                try { (window as any).ExitApi.exit(); } catch (e) {}
                break;
            case "Tiktok":
                try { (window as any).playableSDK.close(); } catch (e) {}
                break;
            default:
                break;
        }

        // MRAID tiêu chuẩn (chuẩn mạng quảng cáo toàn cầu: AppLovin, Unity, IronSource...)
        try {
            if ((window as any).mraid && typeof (window as any).mraid.close === 'function') {
                (window as any).mraid.close();
            }
        } catch (e) {}

        // Nếu chạy trong iframe (môi trường test AdPlay / Preview tool)
        try {
            if (window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'close' }, '*');
                window.parent.postMessage({ type: 'ad_close' }, '*');
                window.parent.postMessage('close', '*');
            }
        } catch (e) {}

        // Thử lệnh đóng cửa sổ tiêu chuẩn
        try {
            window.close();
        } catch (e) {}
    }

    public getLinkStore(): string {
        const mobile = this.getMobileOS();
        if (mobile === 'iOS') {
            return this.iosUrl || DEFAULT_IOS_URL;
        }
        return this.androidUrl || DEFAULT_ANDROID_URL;
    }

    public getMobileOS(): string {
        try {
            const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
            if (/android|Android/i.test(userAgent)) {
                return 'android';
            } else if (/iPad|iPhone|iPod|Macintosh/.test(userAgent) && !(window as any).MSStream) {
                return 'iOS';
            }
        } catch (e) {
            // ignore
        }
        return 'unknown';
    }
}

export default PlayableAdsController;
