import { _decorator, Component, Node } from 'cc';
import { CharacterConfig } from '../Config/CharacterConfig';
import { DamageTextManager } from './DamageTextManger';
import { AudioManager } from './AudioManager';
import { EventManager, GameEvent } from './EventManager';

const { ccclass, property } = _decorator;

export interface Damageable {
    takeDamage(damage: number, isCrit: boolean, attacker?: Node): boolean;
}

@ccclass('DmgDealer')
export class DmgDealer extends Component {
    public static instance: DmgDealer = null;

    onLoad() {
        DmgDealer.instance = this;
    }

    onDestroy() {
        if (DmgDealer.instance === this) {
            DmgDealer.instance = null;
        }
    }

    /**
     * Gây sát thương từ Attacker lên Target
     * @param isAura true nếu là sát thương đốt định kỳ từ Aura (không kích hoạt hiệu ứng choáng của kiếm)
     * @returns true nếu mục tiêu bị tiêu diệt
     */
    public dealDamage(targetNode: Node, rawDamage: number, attackerNode: Node = null, forceCrit: boolean = false, isAura: boolean = false): boolean {
        if (!targetNode || !targetNode.isValid) return false;

        const config = CharacterConfig.instance;
        const critRate = config ? config.critRate : 0.25;
        const critMultiplier = config ? config.critMultiplier : 2.0;

        const isCrit = forceCrit || (Math.random() < critRate);
        const actualDamage = isCrit ? rawDamage * critMultiplier : rawDamage;

        // Âm thanh
        if (AudioManager.instance) {
            if (isCrit) {
                AudioManager.instance.playCrit();
            } else {
                AudioManager.instance.playEnemyHit();
            }
        }

        // Damage Text UI (Hiển thị actualDamage * 100)
        if (DamageTextManager.instance) {
            DamageTextManager.instance.showDamage(targetNode, actualDamage, isCrit, attackerNode);
        }

        // Trừ máu quái
        let killed = false;
        const targetComp = targetNode.getComponent('Enemy') as any;
        if (targetComp && typeof targetComp.takeDamage === 'function') {
            killed = targetComp.takeDamage(actualDamage, isCrit, attackerNode, isAura);
        }

        EventManager.instance.emit(GameEvent.DAMAGE_DEALT, {
            target: targetNode,
            damage: actualDamage,
            isCrit: isCrit,
            killed: killed,
        });

        return killed;
    }
}
