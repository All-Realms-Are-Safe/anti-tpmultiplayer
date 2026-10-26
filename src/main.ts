import { beforeEvents } from "@minecraft/server-admin";
import { system, world } from "@minecraft/server";

/** 20 second timeout before a player is treated like a bot. This gives plenty of time */
const spawnTimeout = 400;
const awaitingSpawn = new Map<string, number>();
const kickMessage = "Failed to verify your account. discord.gg/aras";

function log(message: string): void {
    console.warn(`[anti-tp] ${message}`);
};

/** Stop waiting for a player to spawn */
function stopWaiting(displayName: string): void {
    const handle = awaitingSpawn.get(displayName);
    if (handle === undefined) return;
    system.clearRun(handle);
    awaitingSpawn.delete(displayName);
};

beforeEvents.asyncPlayerJoin.subscribe(async (ev) => {
    const { name, persistentId } = ev;

    // Persistent ID is a value that can be used to track an account across multiple different sessions (platforms).
    // A missing ID is a clear sign the account is not legitimate. Gamertags also can
    // never have quotes, handling this now will prevent errors from trying to kick later.
    if (!persistentId?.trim() || name.includes('"')) {
        log(`Refused "${name}": no persistent ID`);
        ev.disallowJoin(kickMessage);
        return;
    };

    ev.allowJoin();

    const handle = system.runTimeout(() => {
        awaitingSpawn.delete(name);
        log(`Kicking "${name}" because they failed to spawn in ${spawnTimeout} seconds`);
        try {
            world.getDimension("overworld").runCommand(`kick "${name}" ${kickMessage}`);
        } catch (error) {
            log(`Failed to kick "${name}" - ${error}`);
        };
    }, spawnTimeout);

    awaitingSpawn.set(name, handle);
});

// Cancel a player's timeout when they successfully spawn. Does not include respawns
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
    if (initialSpawn) stopWaiting(player.name);
});

// Don't track player's who left
world.afterEvents.playerLeave.subscribe(({ playerName }) => stopWaiting(playerName));