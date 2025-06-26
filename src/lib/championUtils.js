// Summoner spell data with cooldowns
export const SUMMONER_SPELLS = {
  Flash: { name: 'Flash', cooldown: 300, key: 'F' },
  Ignite: { name: 'Ignite', cooldown: 180, key: 'D' },
  Teleport: { name: 'Teleport', cooldown: 360, key: 'F' },
  Heal: { name: 'Heal', cooldown: 240, key: 'D' },
  Barrier: { name: 'Barrier', cooldown: 180, key: 'D' },
  Exhaust: { name: 'Exhaust', cooldown: 210, key: 'D' },
  Cleanse: { name: 'Cleanse', cooldown: 210, key: 'D' },
  Ghost: { name: 'Ghost', cooldown: 210, key: 'D' },
  Smite: { name: 'Smite', cooldown: 90, key: 'D' },
  Clarity: { name: 'Clarity', cooldown: 240, key: 'D' }
};

// Champion data processing utilities
import championsListData from '../assets/lol_app_data/champions_list.json';

// Calculate reduced cooldown based on ability haste
export const calculateCooldown = (baseCooldown, abilityHaste) => {
  return baseCooldown * (100 / (100 + abilityHaste));
};

// Calculate summoner spell cooldown (affected by Cosmic Insight and Ionian Boots)
export const calculateSummonerCooldown = (baseCooldown, summonerHaste = 0) => {
  // Summoner spell haste works the same as ability haste
  return baseCooldown * (100 / (100 + summonerHaste));
};

// Get champion list for selection
export const loadChampionList = async () => {
  const champions = Object.values(championsListData.data).map(champion => ({
    id: champion.id,
    name: champion.name,
    title: champion.title,
    image: champion.image
  }));
  
  return champions.sort((a, b) => a.name.localeCompare(b.name));
};

// Load detailed champion data
export const loadChampionData = async (championId) => {
  try {
    const championData = await import(`../assets/lol_app_data/champions/${championId}.json`);
    const champion = championData.data[championId];
    
    return {
      id: champion.id,
      name: champion.name,
      title: champion.title,
      image: champion.image,
      spells: champion.spells,
      passive: champion.passive
    };
  } catch (error) {
    console.error(`Failed to load champion data for ${championId}:`, error);
    return null;
  }
};

// Get current cooldown for an ability based on level and haste
export const getCurrentCooldown = (ability, abilityHaste) => {
  const levelIndex = ability.currentLevel - 1;
  const baseCooldown = ability.cooldowns[levelIndex];
  return calculateCooldown(baseCooldown, abilityHaste);
};

// Format time display (e.g., "12.3s" or "1m 23s")
export const formatTime = (seconds) => {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }
};

// Ability key mappings for keyboard shortcuts
export const ABILITY_KEYS = {
  Q: 0,
  W: 1,
  E: 2,
  R: 3
};

// Default ability haste increments
export const HASTE_INCREMENT = 10;

// Maximum ability levels
export const MAX_BASIC_LEVEL = 5;
export const MAX_ULTIMATE_LEVEL = 3;

