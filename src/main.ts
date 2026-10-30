import { beforeEvents } from "@minecraft/server-admin";
import { system, world } from "@minecraft/server";

/** 20 second timeout before a player is treated like a bot. */
const spawnTimeout = 400;
const awaitingSpawn = new Map<string, number>();
const kickMessage = "Failed to verify your account. discord.gg/aras";

/**
 * Logs a message with the anti-tp prefix.
 * @param {string} message - The message to log.
 */
function log(message: string) {
    console.warn(`[anti-tp] ${message}`);
}

/**
 * Stop waiting for a player by their name and clear their active timeout.
 * @param {string} name - The player's name (available in join, spawn and leave events).
 */
function stopWaiting(name: string) {
    const handle = awaitingSpawn.get(name);
    if (handle === undefined) return;
    system.clearRun(handle);
    awaitingSpawn.delete(name);
}

world.afterEvents.worldLoad.subscribe(() => {
    beforeEvents.asyncPlayerJoin.subscribe(async (ev) => {
        const { name, persistentId } = ev;

        // Validate persistent ID and name
        if (!persistentId?.trim() || name.includes('"')) {
            log(`Refused "${name}": no persistent ID`);
            ev.disallowJoin(kickMessage);
            return;
        }

        ev.allowJoin();

        // Clear any existing active timeout for this name to prevent orphaned timers
        stopWaiting(name);

        const handle = system.runTimeout(() => {
            awaitingSpawn.delete(name);
            log(`Kicking "${name}" because they failed to spawn in ${spawnTimeout} seconds`);
            try {
                world.getDimension("overworld").runCommand(`kick "${name}" ${kickMessage}`);
            } catch (error) {
                log(`Failed to kick "${name}" - ${error}`);
            }
        }, spawnTimeout);

        awaitingSpawn.set(name, handle);
    });
});

// Cancel a player's timeout when they successfully spawn.
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (initialSpawn) {
        stopWaiting(player.name);
    }
});

// Don't track players who left.
world.afterEvents.playerLeave.subscribe(({ playerName }) => {
    stopWaiting(playerName);
});