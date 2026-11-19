import { _decorator, Component, AudioClip, AudioSource, CCFloat, Node, input, Input, assetManager } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('AudioManager')
export class AudioManager extends Component {
    public static instance: AudioManager = null;

    // ==========================================
    // NHÓM 1: BGM (NHẠC NỀN)
    // ==========================================
    @property({ type: AudioClip, tooltip: 'Nhạc nền chính (CryptRoom.mp3)' })
    public bgmClip: AudioClip = null;

    @property({ type: CCFloat, tooltip: 'Âm lượng nhạc nền' })
    public bgmVolume: number = 0.6;

    // ==========================================
    // NHÓM 2: CHARACTER SFX (ÂM THANH PALADIN)
    // ==========================================
    @property({ type: AudioClip, tooltip: 'Tiếng chém kiếm của Paladin' })
    public attackClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng nổ đòn đánh chí mạng (Critical Hit)' })
    public critClip: AudioClip = null;

    @property({ type: CCFloat, tooltip: 'Âm lượng âm thanh nhân vật' })
    public charVolume: number = 0.8;

    // ==========================================
    // NHÓM 3: ENEMY SFX (ÂM THANH QUÁI SKELETON)
    // ==========================================
    @property({ type: AudioClip, tooltip: 'Tiếng quái trúng đòn' })
    public enemyHitClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng quái gục chết tan xương' })
    public enemyDieClip: AudioClip = null;

    @property({ type: CCFloat, tooltip: 'Âm lượng âm thanh quái' })
    public enemyVolume: number = 0.7;

    // ==========================================
    // NHÓM 4: GAMEPLAY LEVEL UP & KẾT THÚC SFX
    // ==========================================
    @property({ type: AudioClip, tooltip: 'Tiếng LevelUp 1 (levelup_uncommon.mp3)' })
    public levelUpUncommonClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng LevelUp 2 (levelup_rare.mp3)' })
    public levelUpRareClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng LevelUp 3 (levelup_legendary.mp3)' })
    public levelUpLegendaryClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng chạm chọn kỹ năng' })
    public skillSelectClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng chiến thắng (victory.mp3)' })
    public victoryClip: AudioClip = null;

    @property({
        type: AudioClip,
        tooltip: 'Âm thanh nổ ĐÙNG kết thúc chiêu cuối Level 3 (Kéo thả file âm thanh chiêu cuối vào đây)'
    })
    public finalExplosionClip: AudioClip = null;

    @property({ type: CCFloat, tooltip: 'Âm lượng hiệu ứng gameplay' })
    public gameplayVolume: number = 0.9;

    // ==========================================
    // NHÓM 5: CLIP BỔ SUNG (RANGER, HEAVY SLAM, RƯƠNG COIN/WIN/FAIL)
    // ==========================================
    @property({ type: AudioClip, tooltip: 'Tiếng bắn cung của Ranger (Ranger Attack.mp3)' })
    public rangerAttackClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng quái tinh anh/giáp trúng đòn (Armored Take Damage.mp3)' })
    public armoredHitClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng mở Popup Skill Tím - Epic (levelup_epic_sfx.mp3)' })
    public levelUpEpicClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng cảnh báo Địch tinh anh xuất hiện' })
    public warningClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng vàng văng ra từ rương (Coin Flying.mp3)' })
    public coinFlyingClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng vàng rơi chạm đất (Coin hit the ground.mp3)' })
    public coinLandClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng bật mở rương kho báu (Loot Item.mp3)' })
    public chestOpenClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng rương vỡ khi thua (armor hit the ground.mp3)' })
    public chestBreakClip: AudioClip = null;

    @property({ type: AudioClip, tooltip: 'Tiếng thất bại (fail.mp3)' })
    public failClip: AudioClip = null;

    // Các kênh AudioSource chuyên biệt nhằm tránh nghẽn/rớt âm thanh
    private _bgmSource: AudioSource = null;
    private _uiSource: AudioSource = null;
    private _combatSource: AudioSource = null;
    private _enemySource: AudioSource = null;
    private _fxSource: AudioSource = null;
    private _coinSource: AudioSource = null;

    // Bộ đệm giới hạn tần suất (Rate Limiting) tránh Web Audio bị sập khi quái chết hàng loạt
    private _lastEnemyHitTime: number = 0;
    private _lastEnemyDieTime: number = 0;
    private _lastAttackTime: number = 0;
    private _lastRangerTime: number = 0;
    private _lastCoinTime: number = 0;
    private _lastSlamTime: number = 0;

    public isEnding: boolean = false;
    private _isAudioUnlocked: boolean = false;

    onLoad() {
        AudioManager.instance = this;

        // 1. Kênh BGM chính trên node này
        this._bgmSource = this.getComponent(AudioSource) || this.addComponent(AudioSource);

        // 2. Kênh UI độc lập (LevelUp, SkillSelect, FinalExplosion) - ƯU TIÊN TUYỆT ĐỐI, không bao giờ bị nghẽn
        let uiNode = this.node.getChildByName('UI_Audio');
        if (!uiNode) {
            uiNode = new Node('UI_Audio');
            uiNode.parent = this.node;
        }
        this._uiSource = uiNode.getComponent(AudioSource) || uiNode.addComponent(AudioSource);

        // 3. Kênh Combat độc lập (Chém kiếm, Crit)
        let combatNode = this.node.getChildByName('Combat_Audio');
        if (!combatNode) {
            combatNode = new Node('Combat_Audio');
            combatNode.parent = this.node;
        }
        this._combatSource = combatNode.getComponent(AudioSource) || combatNode.addComponent(AudioSource);

        // 4. Kênh Enemy độc lập (Quái trúng đòn, Quái chết)
        let enemyNode = this.node.getChildByName('Enemy_Audio');
        if (!enemyNode) {
            enemyNode = new Node('Enemy_Audio');
            enemyNode.parent = this.node;
        }
        this._enemySource = enemyNode.getComponent(AudioSource) || enemyNode.addComponent(AudioSource);

        // 5. Kênh FX độc lập (Ranger, Heavy Slam, Warning, Chest Open)
        let fxNode = this.node.getChildByName('FX_Audio');
        if (!fxNode) {
            fxNode = new Node('FX_Audio');
            fxNode.parent = this.node;
        }
        this._fxSource = fxNode.getComponent(AudioSource) || fxNode.addComponent(AudioSource);

        // 6. Kênh Coin / Break độc lập
        let coinNode = this.node.getChildByName('Coin_Audio');
        if (!coinNode) {
            coinNode = new Node('Coin_Audio');
            coinNode.parent = this.node;
        }
        this._coinSource = coinNode.getComponent(AudioSource) || coinNode.addComponent(AudioSource);

        // Đăng ký mở khóa Web Audio ngay khi người chơi chạm màn hình lần đầu
        this.setupAudioUnlock();

        // In kiểm tra trạng thái toàn bộ các file âm thanh
        this.checkSoundStatus();
    }

    onDestroy() {
        input.off(Input.EventType.TOUCH_START, this.unlockAudio, this);
        input.off(Input.EventType.MOUSE_DOWN, this.unlockAudio, this);
        if (AudioManager.instance === this) {
            AudioManager.instance = null;
        }
    }

    start() {
        this.playBGM();
    }

    /** Mở khóa AudioContext khi người chơi chạm vào màn hình (vượt qua chính sách Autoplay của trình duyệt) */
    private setupAudioUnlock() {
        input.on(Input.EventType.TOUCH_START, this.unlockAudio, this);
        input.on(Input.EventType.MOUSE_DOWN, this.unlockAudio, this);
    }

    private unlockAudio() {
        if (this._isAudioUnlocked) return;
        this._isAudioUnlocked = true;
        if (this._bgmSource && !this._bgmSource.playing && this.bgmClip) {
            this.playBGM();
        }
    }

    // ==========================================
    // NHÓM 1: BGM
    // ==========================================
    public playBGM() {
        if (!this.bgmClip || !this._bgmSource) return;
        this._bgmSource.clip = this.bgmClip;
        this._bgmSource.loop = true;
        this._bgmSource.volume = this.bgmVolume;
        try {
            this._bgmSource.play();
        } catch (e) {
            console.warn('[AudioManager] BGM play pending user interaction:', e);
        }
    }

    public stopBGM() {
        if (this._bgmSource) {
            this._bgmSource.stop();
        }
    }

    // ==========================================
    // NHÓM 2: COMBAT SFX (NHÂN VẬT)
    // ==========================================
    public playAttack() {
        if (this.isEnding) return;
        const now = Date.now();
        if (now - this._lastAttackTime < 100) return; // Không spam quá 10 lần/giây
        this._lastAttackTime = now;
        this.playOneShot(this._combatSource, this.attackClip, this.charVolume);
    }

    public playRangerAttack() {
        if (this.isEnding) return;
        const now = Date.now();
        if (now - this._lastRangerTime < 90) return;
        this._lastRangerTime = now;
        this.playOneShot(this._fxSource, this.rangerAttackClip || this.attackClip, this.charVolume);
    }

    public playCrit() {
        if (this.isEnding) return;
        this.playOneShot(this._combatSource, this.critClip, this.charVolume * 1.2);
    }

    public playHeavySlam() {
        if (this.isEnding) return;
        const now = Date.now();
        if (now - this._lastSlamTime < 140) return;
        this._lastSlamTime = now;
        this.playOneShot(this._fxSource, this.finalExplosionClip || this.critClip, this.gameplayVolume);
    }

    // ==========================================
    // NHÓM 3: ENEMY SFX (QUÁI)
    // ==========================================
    public playEnemyHit(isElite: boolean = false) {
        if (this.isEnding) return;
        const now = Date.now();
        if (now - this._lastEnemyHitTime < 70) return; // Rate limiting 70ms chống tràn bộ đệm
        this._lastEnemyHitTime = now;
        const clip = (isElite && this.armoredHitClip) ? this.armoredHitClip : this.enemyHitClip;
        this.playOneShot(this._enemySource, clip, this.enemyVolume);
    }

    public playEnemyDie() {
        if (this.isEnding) return;
        const now = Date.now();
        if (now - this._lastEnemyDieTime < 80) return; // Rate limiting 80ms khi nhiều quái chết cùng lúc
        this._lastEnemyDieTime = now;
        this.playOneShot(this._enemySource, this.enemyDieClip, this.enemyVolume);
    }

    public playEnemyDieWithClip(customClip?: AudioClip) {
        if (this.isEnding) return;
        const now = Date.now();
        if (now - this._lastEnemyDieTime < 80) return;
        this._lastEnemyDieTime = now;
        this.playOneShot(this._enemySource, customClip || this.enemyDieClip, this.enemyVolume);
    }

    // ==========================================
    // NHÓM 4: UI & GAMEPLAY LEVEL UP & KẾT THÚC
    // ==========================================
    /**
     * Phát âm thanh thăng cấp tương ứng trên kênh UI độc lập
     * Trả về thời lượng file âm thanh (giây) để đồng bộ thời gian quay cuộn slot card.
     */
    public playLevelUp(level: number): number {
        let clip: AudioClip = null;
        let fallbackDuration = 1.6;

        if (level === 1) {
            clip = this.levelUpUncommonClip;
            fallbackDuration = 1.5;
        } else if (level === 2) {
            clip = this.levelUpRareClip;
            fallbackDuration = 2.0;
        } else {
            clip = this.levelUpLegendaryClip || this.levelUpRareClip;
            fallbackDuration = 2.5;
        }

        if (clip) {
            this.playOneShot(this._uiSource, clip, this.gameplayVolume);
            const dur = clip.getDuration();
            return dur > 0 ? dur : fallbackDuration;
        }
        return fallbackDuration;
    }

    public playUpgradePopup(isLegendary: boolean): number {
        const clip = isLegendary
            ? (this.levelUpLegendaryClip || this.levelUpRareClip)
            : (this.levelUpEpicClip || this.levelUpRareClip);
        const fallbackDuration = isLegendary ? 2.5 : 1.8;
        if (clip) {
            this.playOneShot(this._uiSource, clip, this.gameplayVolume);
            const dur = clip.getDuration();
            return dur && dur > 0 ? dur : fallbackDuration;
        }
        return fallbackDuration;
    }

    public playSkillSelect() {
        if (this.isEnding) return;
        this.playOneShot(this._uiSource, this.skillSelectClip, this.gameplayVolume);
    }

    public playWarning() {
        if (this.isEnding) return;
        this.playOneShot(this._fxSource, this.warningClip, this.gameplayVolume);
    }

    public playCoinFlying() {
        const now = Date.now();
        if (now - this._lastCoinTime < 120) return;
        this._lastCoinTime = now;
        this.playOneShot(this._coinSource, this.coinFlyingClip, this.gameplayVolume * 0.7);
    }

    public playCoinLand() {
        this.playOneShot(this._coinSource, this.coinLandClip, this.gameplayVolume * 0.65);
    }

    public playChestOpen() {
        this.playOneShot(this._fxSource, this.chestOpenClip, this.gameplayVolume);
    }

    public playChestBreak() {
        this.playOneShot(this._fxSource, this.finalExplosionClip, this.gameplayVolume);
        this.playOneShot(this._coinSource, this.chestBreakClip, this.gameplayVolume);
    }

    public playVictory() {
        if (!this.victoryClip) {
            assetManager.loadAny('3298e2ba-bee7-4b17-9e68-c742a7fe5c2a', (err, asset: AudioClip) => {
                if (!err && asset) {
                    this.victoryClip = asset;
                    this.playOneShot(this._uiSource, this.victoryClip, this.gameplayVolume);
                }
            });
            return;
        }
        this.playOneShot(this._uiSource, this.victoryClip, this.gameplayVolume);
    }

    public playFail() {
        this.isEnding = true;
        this.stopBGM();
        this.playOneShot(this._uiSource, this.failClip, this.gameplayVolume);
    }

    /**
     * PHÁT DUY NHẤT 1 ÂM THANH ĐÙNG KẾT THÚC CHIÊU CUỐI (LEVEL 3)
     * - Khóa toàn bộ các âm thanh quái chết / trúng đòn râu ria.
     * - Phát finalExplosionClip bạn gán trong Inspector (nếu chưa gán sẽ fallback sang victoryClip/critClip).
     */
    public playFinalExplosion() {
        this.isEnding = true;

        const clip = this.finalExplosionClip || this.victoryClip || this.critClip;
        if (clip) {
            this.playOneShot(this._uiSource, clip, Math.min(1.0, this.gameplayVolume * 1.3));
        }
    }

    private playOneShot(source: AudioSource, clip: AudioClip, volume: number) {
        if (!clip) return;
        const targetSource = source || this._bgmSource;
        if (!targetSource) return;

        try {
            targetSource.playOneShot(clip, volume);
        } catch (e) {
            console.warn('[AudioManager] Failed to play audio:', e);
        }
    }

    /** Kiểm tra và báo cáo trạng thái các clip âm thanh */
    public checkSoundStatus() {
        const status = {
            'BGM': !!this.bgmClip,
            'Attack': !!this.attackClip,
            'Crit': !!this.critClip,
            'EnemyHit': !!this.enemyHitClip,
            'EnemyDie': !!this.enemyDieClip,
            'LevelUp1': !!this.levelUpUncommonClip,
            'LevelUp2': !!this.levelUpRareClip,
            'LevelUp3': !!this.levelUpLegendaryClip,
            'SkillSelect': !!this.skillSelectClip,
            'Victory': !!this.victoryClip,
            'FinalExplosion': !!this.finalExplosionClip,
        };
        console.log('[AudioManager] Audio Clips Status:', status);
    }
}
