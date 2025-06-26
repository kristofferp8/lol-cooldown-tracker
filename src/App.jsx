import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { loadChampionList, loadChampionData, calculateCooldown, calculateSummonerCooldown, SUMMONER_SPELLS } from './lib/championUtils';

// PWA Install prompt component
const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!showInstallPrompt) return null;

  return (
    <div className="fixed top-4 left-4 right-4 bg-blue-600 text-white p-3 rounded-lg shadow-lg z-50">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium">Install LoL Tracker</p>
          <p className="text-xs opacity-90">Add to home screen for quick access</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowInstallPrompt(false)}
            className="px-3 py-1 text-xs bg-blue-700 rounded hover:bg-blue-800"
          >
            Later
          </button>
          <button
            onClick={handleInstallClick}
            className="px-3 py-1 text-xs bg-white text-blue-600 rounded hover:bg-gray-100"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
};

// Info tooltip component
const InfoTooltip = ({ title, description, isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg p-4 max-w-sm w-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">{title}</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full text-white text-sm font-bold"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
};

// Sound utility for cooldown completion alerts
const playNotificationSound = () => {
  // Create a simple beep sound using Web Audio API
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
  oscillator.type = 'sine';
  
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.3);
};

// Fixed custom hook for individual cooldown timers
const useCooldownTimer = (ability, soundEnabled = false) => {
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const intervalRef = useRef(null);

  const start = (duration) => {
    if (duration <= 0) return;
    
    setTotalTime(duration);
    setTimeLeft(duration);
    setIsActive(true);
  };

  const stop = () => {
    setIsActive(false);
    setTimeLeft(0);
    setTotalTime(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const reset = () => {
    stop();
  };

  const reduceTime = (seconds) => {
    if (isActive && timeLeft > 0) {
      setTimeLeft(prev => Math.max(0, prev - seconds));
    }
  };

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = Math.max(0, prev - 0.1);
          if (newTime <= 0) {
            setIsActive(false);
            // Play sound when cooldown finishes
            if (soundEnabled) {
              playNotificationSound();
            }
            return 0;
          }
          return newTime;
        });
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, timeLeft, soundEnabled]);

  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  return {
    isActive,
    timeLeft,
    progress,
    start,
    stop,
    reset,
    reduceTime
  };
};

function App() {
  const [champions, setChampions] = useState([]);
  const [selectedChampion, setSelectedChampion] = useState(null);
  const [championData, setChampionData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [abilityHaste, setAbilityHaste] = useState(0);
  const [summonerHaste, setSummonerHaste] = useState(0);
  const [abilityLevels, setAbilityLevels] = useState({ Q: 1, W: 1, E: 1, R: 1 });
  const [selectedSummoners, setSelectedSummoners] = useState(['Flash', 'Ignite']);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const searchInputRef = useRef(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // Info tooltip state - only one can be open at a time
  const [activeInfoModal, setActiveInfoModal] = useState(null); // null, 'AH', or 'SH'

  // Individual timer hooks for each ability
  const qTimer = useCooldownTimer('Q', soundEnabled);
  const wTimer = useCooldownTimer('W', soundEnabled);
  const eTimer = useCooldownTimer('E', soundEnabled);
  const rTimer = useCooldownTimer('R', soundEnabled);

  // Summoner spell timers
  const summ1Timer = useCooldownTimer('Summ1', soundEnabled);
  const summ2Timer = useCooldownTimer('Summ2', soundEnabled);

  const timers = { Q: qTimer, W: wTimer, E: eTimer, R: rTimer, Summ1: summ1Timer, Summ2: summ2Timer };

  // Load champion list on mount
  useEffect(() => {
    loadChampionList().then(setChampions);
  }, []);

  // Load champion data when selected
  useEffect(() => {
    if (selectedChampion) {
      loadChampionData(selectedChampion.id).then(setChampionData);
    }
  }, [selectedChampion]);

  // Keyboard shortcuts (only when search is not focused)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (isSearchFocused || !championData) return;

      const key = e.key.toLowerCase();
      if (['q', 'w', 'e', 'r'].includes(key)) {
        e.preventDefault();
        toggleCooldown(key.toUpperCase());
      } else if (e.key === ' ') {
        e.preventDefault();
        setAbilityHaste(prev => prev + 10);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        resetAllCooldowns();
      } else if (e.key === 'f') {
        e.preventDefault();
        toggleSummonerCooldown('Summ1');
      } else if (e.key === 'd') {
        e.preventDefault();
        toggleSummonerCooldown('Summ2');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [championData, isSearchFocused, selectedSummoners]);

  const filteredChampions = champions.filter(champion =>
    champion.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectChampion = (champion) => {
    setSelectedChampion(champion);
    setSearchTerm('');
    setAbilityHaste(0);
    setSummonerHaste(0);
    setAbilityLevels({ Q: 1, W: 1, E: 1, R: 1 });
    resetAllCooldowns();
  };

  const toggleCooldown = (ability) => {
    if (!championData) return;

    const timer = timers[ability];
    
    if (timer.isActive) {
      timer.stop();
    } else {
      const { actual } = getAbilityCooldown(ability);
      if (actual > 0) {
        timer.start(actual);
      }
    }
  };

  const toggleSummonerCooldown = (summonerSlot) => {
    const timer = timers[summonerSlot];
    const summonerIndex = summonerSlot === 'Summ1' ? 0 : 1;
    const summonerName = selectedSummoners[summonerIndex];
    const summonerData = SUMMONER_SPELLS[summonerName];
    
    if (timer.isActive) {
      timer.stop();
    } else {
      const actualCooldown = calculateSummonerCooldown(summonerData.cooldown, summonerHaste);
      timer.start(actualCooldown);
    }
  };

  const adjustLevel = (ability, delta) => {
    const maxLevel = ability === 'R' ? 3 : 5;
    setAbilityLevels(prev => ({
      ...prev,
      [ability]: Math.max(1, Math.min(maxLevel, prev[ability] + delta))
    }));
  };

  const resetAllCooldowns = () => {
    Object.values(timers).forEach(timer => timer.reset());
  };

  const getAbilityData = (ability) => {
    if (!championData) return null;
    
    if (ability === 'R') {
      return championData.spells[3];
    }
    
    const index = ['Q', 'W', 'E'].indexOf(ability);
    return championData.spells[index];
  };

  const getAbilityCooldown = (ability) => {
    const abilityData = getAbilityData(ability);
    if (!abilityData?.cooldown) return { base: 0, actual: 0 };
    
    const baseCooldown = abilityData.cooldown[abilityLevels[ability] - 1] || 0;
    const actualCooldown = calculateCooldown(baseCooldown, abilityHaste);
    
    return { base: baseCooldown, actual: actualCooldown };
  };

  const changeSummoner = (slot, summonerName) => {
    const newSummoners = [...selectedSummoners];
    newSummoners[slot] = summonerName;
    setSelectedSummoners(newSummoners);
    
    // Reset the timer for this slot
    const timerSlot = slot === 0 ? 'Summ1' : 'Summ2';
    timers[timerSlot].reset();
  };

  return (
    <div className="mobile-container">
      {/* PWA Install Prompt */}
      <PWAInstallPrompt />

      {/* Info Tooltips */}
      <InfoTooltip
        title="Ability Haste (AH)"
        description="Reduces cooldown of champion abilities (Q, W, E, R). Higher AH = shorter cooldowns."
        isVisible={activeInfoModal === 'AH'}
        onClose={() => setActiveInfoModal(null)}
      />
      
      <InfoTooltip
        title="Summoner Haste (SH)"
        description="Reduces cooldown of summoner spells (Flash, Ignite, etc.). Higher SH = shorter cooldowns."
        isVisible={activeInfoModal === 'SH'}
        onClose={() => setActiveInfoModal(null)}
      />

      {/* Mobile Header */}
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold gradient-text mb-1">
          LoL Cooldown Tracker
        </h1>
        <p className="text-muted-foreground text-sm">Track opponent abilities & summoners</p>
      </div>

      {/* Search Section */}
      <div className="glass-effect rounded-lg p-3 space-y-3">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search champions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
          className="w-full px-3 py-3 bg-card border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-base"
        />
        
        {/* Champion suggestions */}
        {searchTerm && (
          <div className="max-h-40 overflow-y-auto bg-card rounded-lg border border-border">
            {filteredChampions.slice(0, 8).map(champion => (
              <button
                key={champion.id}
                onClick={() => selectChampion(champion)}
                className="w-full px-3 py-3 text-left hover:bg-accent border-b border-border last:border-b-0 transition-colors touch-button"
              >
                <div className="font-medium text-sm">{champion.name}</div>
                <div className="text-muted-foreground text-xs">{champion.title}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="glass-effect rounded-lg p-3">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="relative">
            <button
              onClick={() => setActiveInfoModal('AH')}
              className="absolute -top-3 -right-1 w-3 h-3 bg-gray-600 hover:bg-gray-500 rounded-full text-white flex items-center justify-center"
              title="What is Ability Haste?"
              style={{ fontSize: '8px' }}
            >
              i
            </button>
            <div className="bg-primary/20 px-3 py-2 rounded-lg text-sm font-medium">
              AH: {abilityHaste}
            </div>
          </div>
          <button
            onClick={() => setAbilityHaste(prev => prev + 10)}
            className="bg-yellow-600 hover:bg-yellow-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-button"
          >
            +10
          </button>
          <div className="relative">
            <button
              onClick={() => setActiveInfoModal('SH')}
              className="absolute -top-3 -right-1 w-3 h-3 bg-gray-600 hover:bg-gray-500 rounded-full text-white flex items-center justify-center"
              title="What is Summoner Haste?"
              style={{ fontSize: '8px' }}
            >
              i
            </button>
            <div className="bg-blue-600/20 px-3 py-2 rounded-lg text-sm font-medium">
              SH: {summonerHaste}
            </div>
          </div>
          <button
            onClick={() => setSummonerHaste(prev => prev + 10)}
            className="bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-button"
          >
            +10
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-button ${
              soundEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            🔊 {soundEnabled ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => {setAbilityHaste(0); setSummonerHaste(0);}}
            className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-button"
          >
            Reset Haste
          </button>
          <button
            onClick={resetAllCooldowns}
            className="bg-red-600 hover:bg-red-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors touch-button"
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Selected Champion */}
      {selectedChampion && (
        <div className="glass-effect rounded-lg p-3 text-center">
          <h2 className="text-xl font-bold">{selectedChampion.name}</h2>
          <p className="text-muted-foreground text-sm">{selectedChampion.title}</p>
        </div>
      )}

      {/* Summoner Spells */}
      <div className="glass-effect rounded-lg p-3">
        <h3 className="font-bold mb-3 text-center">Summoner Spells</h3>
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map(slot => {
            const summonerName = selectedSummoners[slot];
            const summonerData = SUMMONER_SPELLS[summonerName];
            const timer = timers[slot === 0 ? 'Summ1' : 'Summ2'];
            const actualCooldown = calculateSummonerCooldown(summonerData.cooldown, summonerHaste);
            
            return (
              <div
                key={slot}
                className={`ability-card ${timer.isActive ? 'ability-cooldown' : 'ability-ready'}`}
              >
                {/* Summoner Header */}
                <div className="flex items-center justify-between mb-2">
                  <select
                    value={summonerName}
                    onChange={(e) => changeSummoner(slot, e.target.value)}
                    className="bg-card border border-border rounded px-2 py-1 text-xs"
                  >
                    {Object.keys(SUMMONER_SPELLS).map(spell => (
                      <option key={spell} value={spell}>{spell}</option>
                    ))}
                  </select>
                  <div className="text-xs">
                    {summonerData.key}
                  </div>
                </div>

                {/* Cooldown info */}
                <div className="text-xs mb-2">
                  Base: {summonerData.cooldown}s | Actual: {actualCooldown.toFixed(1)}s
                </div>

                {/* Progress bar */}
                {timer.isActive && (
                  <div className="mb-2">
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full progress-bar"
                        style={{ width: `${Math.min(100, Math.max(0, timer.progress))}%` }}
                      />
                    </div>
                    <div className="text-center text-xs mt-1">
                      {timer.timeLeft.toFixed(1)}s ({Math.round(timer.progress)}%)
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleSummonerCooldown(slot === 0 ? 'Summ1' : 'Summ2')}
                    className={`flex-1 py-2 rounded text-xs font-medium transition-colors touch-button ${
                      timer.isActive
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {timer.isActive ? 'Stop' : 'Start'}
                  </button>
                  {timer.isActive && (
                    <button
                      onClick={() => timer.reduceTime(10)}
                      className="px-2 py-2 bg-yellow-600 hover:bg-yellow-700 rounded text-xs font-medium transition-colors touch-button"
                    >
                      -10s
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Abilities */}
      {championData && (
        <div className="space-y-3">
          {['Q', 'W', 'E', 'R'].map(ability => {
            const abilityData = getAbilityData(ability);
            const { base, actual } = getAbilityCooldown(ability);
            const timer = timers[ability];
            
            return (
              <div
                key={ability}
                className={`ability-card ${timer.isActive ? 'ability-cooldown' : 'ability-ready'}`}
              >
                {/* Ability Header */}
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ability-${ability.toLowerCase()}`}>
                      {ability}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-xs truncate">{abilityData?.name || 'Unknown'}</h3>
                      <p className="text-xs text-muted-foreground">Level {abilityLevels[ability]}</p>
                    </div>
                  </div>
                  
                  {/* Level controls */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => adjustLevel(ability, -1)}
                      className="w-5 h-5 bg-red-600 hover:bg-red-700 rounded text-xs font-bold touch-button"
                    >
                      -
                    </button>
                    <button
                      onClick={() => adjustLevel(ability, 1)}
                      className="w-5 h-5 bg-green-600 hover:bg-green-700 rounded text-xs font-bold touch-button"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Cooldown info */}
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span>Base: {base}s</span>
                  <span>Actual: {actual.toFixed(1)}s</span>
                </div>

                {/* Progress bar */}
                {timer.isActive && (
                  <div className="mb-1">
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-1.5 rounded-full progress-bar"
                        style={{ width: `${Math.min(100, Math.max(0, timer.progress))}%` }}
                      />
                    </div>
                    <div className="text-center text-xs mt-0.5 font-medium">
                      {timer.timeLeft.toFixed(1)}s ({Math.round(timer.progress)}%)
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-1">
                  <button
                    onClick={() => toggleCooldown(ability)}
                    className={`flex-1 py-1.5 rounded-lg font-medium text-xs transition-colors touch-button ${
                      timer.isActive
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {timer.isActive ? `Stop ${ability}` : `Start ${ability}`}
                  </button>
                  {timer.isActive && (
                    <button
                      onClick={() => timer.reduceTime(10)}
                      className="px-2 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded-lg font-medium text-xs transition-colors touch-button"
                    >
                      -10s
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Instructions */}
      {!selectedChampion && (
        <div className="glass-effect rounded-lg p-4">
          <h3 className="font-bold mb-3 text-center">How to Use</h3>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
              <span>Search and select opponent's champion</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
              <span>Set their summoner spells (Flash, Ignite, etc.)</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
              <span>Use +/- buttons (top right of each ability) to adjust levels</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</div>
              <span>Tap "Start" when they use abilities/summoners</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">5</div>
              <span>Use "-10s" for reaction time delays</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">6</div>
              <span>Get sound alerts when cooldowns finish!</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">7</div>
              <span>Tap the "i" icons to learn about AH and SH!</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">8</div>
              <span>Install this app for quick access during games!</span>
            </div>
            <div className="mt-4 p-3 bg-blue-600/20 rounded-lg">
              <div className="text-xs font-medium mb-2 text-blue-300">📱 iOS Installation:</div>
              <div className="text-xs text-blue-200">
                On iPhone: Open in Safari → Tap Share button → "Add to Home Screen"
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

