import { world, system, ItemStack } from "@minecraft/server";

const THIRST_TAG_PREFIX = "thirst:";
const MAX_THIRST = 20;
const THIRST_DECREASE_TICK = 1200; // 1 minute at 20tps

const SPOIL_CHANCE = 0.01; // Chance per minute for a food item to spoil

const FOOD_ITEMS = [
    "minecraft:apple",
    "minecraft:bread",
    "minecraft:cooked_beef",
    "minecraft:cooked_chicken",
    "minecraft:cooked_porkchop",
    "minecraft:cooked_mutton",
    "minecraft:cooked_salmon",
    "minecraft:cooked_cod",
    "minecraft:melon_slice",
    "minecraft:carrot",
    "minecraft:potato",
    "minecraft:baked_potato"
];

function getThirst(player) {
    const tag = player.getTags().find(t => t.startsWith(THIRST_TAG_PREFIX));
    if (!tag) return MAX_THIRST;
    return parseInt(tag.split(":")[1]);
}

function setThirst(player, value) {
    const oldTag = player.getTags().find(t => t.startsWith(THIRST_TAG_PREFIX));
    if (oldTag) player.removeTag(oldTag);
    const newValue = Math.max(0, Math.min(MAX_THIRST, value));
    player.addTag(`${THIRST_TAG_PREFIX}${newValue}`);
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        let thirst = getThirst(player);
        thirst--;
        setThirst(player, thirst);

        if (thirst <= 0) {
            player.applyDamage(1, { cause: "starvation" });
        }

        // Food spoilage logic
        const inventory = player.getComponent("minecraft:inventory").container;
        for (let i = 0; i < inventory.size; i++) {
            const item = inventory.getItem(i);
            if (item && FOOD_ITEMS.includes(item.typeId)) {
                if (Math.random() < SPOIL_CHANCE) {
                    inventory.setItem(i, new ItemStack("za:spoiled_food", item.amount));
                    player.sendMessage(`§cYour ${item.typeId.split(":")[1]} has spoiled!`);
                }
            }
        }
    }
}, THIRST_DECREASE_TICK);

// Hydration logic
world.afterEvents.itemUse.subscribe((event) => {
    const { itemStack, source: player } = event;
    if (itemStack.typeId === "minecraft:potion" || itemStack.typeId === "minecraft:water_bucket" || itemStack.typeId === "minecraft:honey_bottle" || itemStack.typeId === "za:dirty_water_bottle") {
        let thirst = getThirst(player);
        let amount = 10;
        if (itemStack.typeId === "za:dirty_water_bottle") {
            amount = 5;
            player.sendMessage("§6The water was murky, but it quenched some of your thirst.");
        } else {
            player.sendMessage("§bYour thirst has been quenched.");
        }
        setThirst(player, thirst + amount);
    }
});

// Harder Gameplay: Buff newly spawned zombies and add TNT placing logic
world.afterEvents.entitySpawn.subscribe((event) => {
    const { entity } = event;
    if (entity.typeId === "minecraft:zombie") {
        try {
            const health = entity.getComponent("minecraft:health");
            if (health) {
                health.setCurrentValue(30);
            }
            // Some zombies get speed boost
            if (Math.random() < 0.2) {
                entity.addEffect("speed", 999999, { amplifier: 1, showParticles: false });
            }
            // Some zombies get strength
            if (Math.random() < 0.1) {
                entity.addEffect("strength", 999999, { amplifier: 0, showParticles: false });
            }
        } catch (e) {}
    }
});

// TNT placing logic
system.runInterval(() => {
    for (const entity of world.getDimension("overworld").getEntities({ type: "minecraft:zombie" })) {
        if (Math.random() < 0.05) { // 5% chance every 5 seconds to try and place TNT
            const target = entity.target;
            if (target && target.typeId === "minecraft:player") {
                const dist = Math.sqrt(
                    Math.pow(entity.location.x - target.location.x, 2) +
                    Math.pow(entity.location.y - target.location.y, 2) +
                    Math.pow(entity.location.z - target.location.z, 2)
                );

                if (dist < 5) {
                    const block = entity.dimension.getBlock(entity.location);
                    if (block && block.isAir) {
                        block.setType("minecraft:tnt");
                        entity.dimension.spawnEntity("minecraft:tnt", {
                            x: entity.location.x,
                            y: entity.location.y,
                            z: entity.location.z
                        });
                        entity.dimension.playSound("random.fuse", entity.location);
                        // Optional: remove the block and just spawn primed tnt if we want it to explode immediately
                        block.setType("minecraft:air");
                    }
                }
            }
        }
    }
}, 100); // Every 5 seconds

// UI update for thirst (more frequent)
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const thirst = getThirst(player);
        if (thirst <= 0) {
            player.onScreenDisplay.setActionBar("§cYou are dying of thirst! Drink water!");
        } else if (thirst <= 5) {
            player.onScreenDisplay.setActionBar(`§6Thirst: ${thirst}/${MAX_THIRST} §e(Very Thirsty)`);
        } else {
            player.onScreenDisplay.setActionBar(`§bThirst: ${thirst}/${MAX_THIRST}`);
        }
    }
}, 20); // Every 1 second (20 ticks)

console.warn("Zombie Apocalypse Script Loaded");
